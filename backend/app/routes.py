import logging
import time

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from .openrouter import generate_cards_from_diff, agent_health_stream
from .schemas import GenerateRequest, GenerateResponse

logger = logging.getLogger(__name__)

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

    return GenerateResponse(cards=cards)


@router.get("/")
async def root():
    return {"repsonse":"Hello World"}