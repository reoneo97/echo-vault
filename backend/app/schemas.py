from pydantic import BaseModel


class FlashcardPair(BaseModel):
    question: str
    answer: str


class ImageData(BaseModel):
    filename: str
    data: str  # base64-encoded
    media_type: str


class GenerateRequest(BaseModel):
    diff_content: str
    source_note: str = ""
    max_cards: int = 10
    images: list[ImageData] = []


class GenerateResponse(BaseModel):
    cards: list[FlashcardPair]


class HealthResponse(BaseModel):
    status: str
