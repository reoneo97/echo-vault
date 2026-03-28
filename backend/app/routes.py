import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from fastapi.templating import Jinja2Templates

from .config import settings
from .openrouter import generate_cards_from_diff, agent_health_stream
from .schemas import GenerateRequest, GenerateResponse

logger = logging.getLogger(__name__)

LOGS_DIR = Path(__file__).parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

templates = Jinja2Templates(directory=Path(__file__).parent / "templates")

router = APIRouter()


@router.get("/health")
async def health():
    return {"status":"ok"}


@router.get("/agent-health")
def test_open_router():
    return StreamingResponse(agent_health_stream(), media_type="text/html")


@router.post("/generate-flashcards", response_model=GenerateResponse)
async def generate_flashcards(req: GenerateRequest):
    if not req.diff_content.strip():
        raise HTTPException(status_code=400, detail="diff_content is empty")

    logger.info(
        "Generate request: source=%s, diff_len=%d, images=%d, max_cards=%d",
        req.source_note, len(req.diff_content), len(req.images), req.max_cards,
    )

    start = time.time()
    try:
        cards = await generate_cards_from_diff(
            diff_content=req.diff_content,
            source_note=req.source_note,
            max_cards=req.max_cards,
            images=req.images if req.images else None,
        )
    except Exception:
        logger.exception("Generate failed for source=%s", req.source_note)
        raise

    elapsed = time.time() - start
    logger.info("Generated %d cards in %.1fs for source=%s", len(cards), elapsed, req.source_note)

    # Save request/response log
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model": settings.openrouter_model,
        "source_note": req.source_note,
        "diff_content": req.diff_content,
        "max_cards": req.max_cards,
        "cards": [c.model_dump() for c in cards],
        "elapsed_seconds": round(elapsed, 2),
    }
    log_file = LOGS_DIR / "requests.jsonl"
    with open(log_file, "a") as f:
        f.write(json.dumps(log_entry) + "\n")

    return GenerateResponse(cards=cards)


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


@router.get("/")
async def root():
    return {"repsonse":"Hello World"}