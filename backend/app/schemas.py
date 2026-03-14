from pydantic import BaseModel


class FlashcardPair(BaseModel):
    question: str
    answer: str


class GenerateRequest(BaseModel):
    diff_content: str
    source_note: str = ""
    max_cards: int = 10


class GenerateResponse(BaseModel):
    cards: list[FlashcardPair]


class HealthResponse(BaseModel):
    status: str
