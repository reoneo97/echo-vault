from fastapi import APIRouter, HTTPException

from .openrouter import generate_cards_from_diff
from .schemas import GenerateRequest, GenerateResponse, HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok")


@router.post("/generate-flashcards", response_model=GenerateResponse)
async def generate_flashcards(req: GenerateRequest):
    if not req.diff_content.strip():
        raise HTTPException(status_code=400, detail="diff_content is empty")

    cards = await generate_cards_from_diff(
        diff_content=req.diff_content,
        source_note=req.source_note,
        max_cards=req.max_cards,
    )
    return GenerateResponse(cards=cards)
