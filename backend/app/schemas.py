from enum import Enum
from typing import Optional

from pydantic import BaseModel


class CardType(str, Enum):
    standard = "standard"
    true_false = "true_false"
    multiple_choice = "multiple_choice"


class FlashcardPair(BaseModel):
    type: CardType = CardType.standard
    question: str
    answer: str
    options: Optional[list[str]] = None
    correct_answer: Optional[str] = None


class GenerateRequest(BaseModel):
    diff_content: str
    source_note: str = ""
    max_cards: int = 10


class GenerateResponse(BaseModel):
    cards: list[FlashcardPair]


class HealthResponse(BaseModel):
    status: str
