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


class FileDiffEntry(BaseModel):
    path: str
    diff_content: str
    images: list[ImageData] = []
    max_cards: int | None = None


class BatchGenerateRequest(BaseModel):
    files: list[FileDiffEntry]
    max_cards: int = 10


class FileResultEntry(BaseModel):
    source_note: str
    cards: list[FlashcardPair]
    error: str | None = None


class BatchGenerateResponse(BaseModel):
    file_results: list[FileResultEntry]


class CardFeedbackEntry(BaseModel):
    question: str
    answer: str
    source_note: str
    commit_hash: str
    decision: str  # "accepted" | "rejected" | "edited"
    edited_question: str | None = None
    edited_answer: str | None = None


class FeedbackRequest(BaseModel):
    entries: list[CardFeedbackEntry]


class FeedbackResponse(BaseModel):
    status: str
    received: int
