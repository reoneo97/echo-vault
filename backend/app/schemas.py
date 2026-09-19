from enum import Enum
from typing import Literal, Optional

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
    tags: list[str] = []
    vault_path: str = ""


class BatchGenerateRequest(BaseModel):
    files: list[FileDiffEntry]
    max_cards: int = 10
    source: Literal["live", "eval"] = "live"


class FileResultEntry(BaseModel):
    source_note: str
    cards: list[FlashcardPair]
    error: str | None = None


class BatchGenerateResponse(BaseModel):
    file_results: list[FileResultEntry]


class CardFeedbackEntry(BaseModel):
    card_id: str
    question: str
    answer: str
    source_note: str
    commit_hash: str
    decision: str  # "accepted" | "rejected" | "edited"
    original_type: str  # "qa" | "mcq" | "tf"
    edited_question: str | None = None
    edited_answer: str | None = None
    edited_type: str | None = None  # set only when type was changed


class ReviewEvent(BaseModel):
    card_id: str
    source_note: str
    card_type: str
    quality: int  # SM-2 quality 0–5
    reviewed_at: str
    interval_days: int
    repetition_number: int


class ReviewEventsRequest(BaseModel):
    events: list[ReviewEvent]


class FeedbackRequest(BaseModel):
    entries: list[CardFeedbackEntry]


class FeedbackResponse(BaseModel):
    status: str
    received: int


# ── Tutor ─────────────────────────────────────────────────────────────────────

class TutorMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class TutorChatRequest(BaseModel):
    session_id: str
    message: str
    history: list[TutorMessage] = []


class TutorChatResponse(BaseModel):
    session_id: str
    reply: str
    cards_referenced: list[str] = []
    assessment: str = "none"
    topic: str = ""
