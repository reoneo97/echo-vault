import asyncio
import hashlib
import json
import logging
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import logfire

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from fastapi.templating import Jinja2Templates

from .config import settings
from .observability import batch_files, cards_generated, llm_errors, cards_accepted, cards_rejected, cards_edited
from .openrouter import generate_cards_from_diff, agent_health_stream, FLASHCARD_PROMPT
from .schemas import (
    BatchGenerateRequest, BatchGenerateResponse, FileResultEntry,
    FeedbackRequest, FeedbackResponse,
)

logger = logging.getLogger(__name__)

LOGS_DIR = Path(__file__).parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

templates = Jinja2Templates(directory=Path(__file__).parent / "templates")

router = APIRouter()

MAX_RETRIES = 2
RETRY_BASE_DELAY = 0.5  # seconds
MAX_CONCURRENT_LLM = 5  # max parallel LLM calls per batch request

_semaphore = asyncio.Semaphore(MAX_CONCURRENT_LLM)

async def generate_with_retry(f, path: str) -> list:
    async with _semaphore:
        last_exc: Exception | None = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                return await f()
            except Exception as e:
                last_exc = e
                if attempt < MAX_RETRIES:
                    delay = RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning("Retrying file=%s (attempt %d/%d) after %.1fs: %s", path, attempt + 1, MAX_RETRIES, delay, e)
                    await asyncio.sleep(delay)
        raise last_exc


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/config")
async def get_config():
    """Returns the current backend configuration for eval logging."""
    def _git_sha() -> str:
        try:
            return subprocess.check_output(
                ["git", "rev-parse", "--short", "HEAD"], stderr=subprocess.DEVNULL
            ).decode().strip()
        except Exception:
            return "unknown"

    return {
        "model": settings.openrouter_model,
        "temperature": settings.temperature,
        "top_p": settings.top_p,
        "max_tokens": settings.max_tokens,
        "max_concurrent_llm": MAX_CONCURRENT_LLM,
        "max_retries": MAX_RETRIES,
        "prompt_text": FLASHCARD_PROMPT,
        "prompt_hash": hashlib.sha256(FLASHCARD_PROMPT.encode()).hexdigest()[:12],
        "git_sha": _git_sha(),
    }


@router.get("/agent-health")
def test_open_router():
    return StreamingResponse(agent_health_stream(), media_type="text/html")



@router.post("/generate-flashcards-batch", response_model=BatchGenerateResponse)
async def generate_flashcards_batch(req: BatchGenerateRequest):
    valid_files = [f for f in req.files if f.diff_content.strip()]
    if not valid_files:
        raise HTTPException(status_code=400, detail="all diffs are empty")
    logfire.info("batch generate started", file_count=len(valid_files))

    # Per-file budgets set by plugin based on word count heuristic; default 5 if missing
    budgets = [f.max_cards if f.max_cards is not None else 5 for f in valid_files]

    logger.info(
        "Batch request: %d files, budgets=%s",
        len(valid_files), budgets,
    )

    start = time.time()
    tasks = [
        generate_with_retry(
            lambda f=f, budget=budget: generate_cards_from_diff(
                diff_content=f.diff_content,
                source_note=f.path,
                max_cards=budget,
                images=f.images if f.images else None,
            ),
            path=f.path,
        )
        for f, budget in zip(valid_files, budgets)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    elapsed = time.time() - start

    file_results: list[FileResultEntry] = []
    for f, result in zip(valid_files, results):
        if isinstance(result, Exception):
            logger.error("Generate failed for file=%s after %d retries: %s", f.path, MAX_RETRIES, result)
            file_results.append(FileResultEntry(source_note=f.path, cards=[], error=str(result)))
        else:
            file_results.append(FileResultEntry(source_note=f.path, cards=result))

    total_cards = sum(len(fr.cards) for fr in file_results)
    failures = sum(1 for fr in file_results if fr.error)

    # Record custom Prometheus metrics
    batch_files.observe(len(valid_files))
    llm_errors.inc(failures)
    for fr in file_results:
        for card in fr.cards:
            cards_generated.labels(card_type=card.type.value).inc()

    logger.info("Batch done: %d cards in %.1fs across %d files", total_cards, elapsed, len(valid_files))
    logfire.info(
        "batch generate complete",
        total_cards=total_cards,
        elapsed_seconds=round(elapsed, 2),
        files=len(valid_files),
        failures=failures,
    )

    # Log batch request
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model": settings.openrouter_model,
        "batch": True,
        "max_cards": req.max_cards,
        "files": [
            {
                "source_note": fr.source_note,
                "tags": f.tags,
                "diff_content": f.diff_content,
                "num_images": len(f.images),
                "cards": [c.model_dump() for c in fr.cards],
                "budget": budget,
            }
            for f, fr, budget in zip(valid_files, file_results, budgets)
        ],
        "total_cards": total_cards,
        "elapsed_seconds": round(elapsed, 2),
    }
    log_file = LOGS_DIR / "requests.jsonl"
    with open(log_file, "a") as fh:
        fh.write(json.dumps(log_entry) + "\n")

    return BatchGenerateResponse(file_results=file_results)


@router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(req: FeedbackRequest):
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_entries": len(req.entries),
        "accepted": sum(1 for e in req.entries if e.decision == "accepted"),
        "rejected": sum(1 for e in req.entries if e.decision == "rejected"),
        "edited": sum(1 for e in req.entries if e.decision == "edited"),
        "entries": [e.model_dump() for e in req.entries],
    }
    log_file = LOGS_DIR / "feedback.jsonl"
    with open(log_file, "a") as f:
        f.write(json.dumps(log_entry) + "\n")

    cards_accepted.inc(log_entry["accepted"])
    cards_rejected.inc(log_entry["rejected"])
    cards_edited.inc(log_entry["edited"])

    logger.info(
        "Feedback received: %d entries (%d accepted, %d rejected, %d edited)",
        log_entry["total_entries"], log_entry["accepted"],
        log_entry["rejected"], log_entry["edited"],
    )
    return FeedbackResponse(status="ok", received=len(req.entries))


@router.get("/logs")
async def view_logs(request: Request, limit: int = Query(default=20, ge=1, le=200)):
    log_file = LOGS_DIR / "requests.jsonl"
    entries: list[dict] = []
    if log_file.exists():
        lines = log_file.read_text().strip().splitlines()
        for line in reversed(lines):
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
            if len(entries) >= limit:
                break

    return templates.TemplateResponse("logs.html", {
        "request": request,
        "entries": entries,
    })


@router.get("/feedback-logs")
async def view_feedback_logs(request: Request, limit: int = Query(default=20, ge=1, le=200)):
    log_file = LOGS_DIR / "feedback.jsonl"
    entries: list[dict] = []
    if log_file.exists():
        lines = log_file.read_text().strip().splitlines()
        for line in reversed(lines):
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
            if len(entries) >= limit:
                break

    return templates.TemplateResponse("feedback-logs.html", {
        "request": request,
        "entries": entries,
    })


@router.get("/")
async def root():
    return {"repsonse":"Hello World"}