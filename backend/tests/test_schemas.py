import pytest
from pydantic import ValidationError

from app.schemas import (
    FlashcardPair,
    ImageData,
    GenerateRequest,
    GenerateResponse,
    HealthResponse,
)


class TestFlashcardPair:
    def test_valid(self):
        pair = FlashcardPair(question="What is X?", answer="X is Y.")
        assert pair.question == "What is X?"
        assert pair.answer == "X is Y."

    def test_missing_question(self):
        with pytest.raises(ValidationError):
            FlashcardPair(answer="answer")  # type: ignore

    def test_missing_answer(self):
        with pytest.raises(ValidationError):
            FlashcardPair(question="question")  # type: ignore


class TestImageData:
    def test_valid(self):
        img = ImageData(
            filename="photo.png",
            data="iVBORw0KGgoAAAANS...",
            media_type="image/png",
        )
        assert img.filename == "photo.png"
        assert img.media_type == "image/png"

    def test_missing_fields(self):
        with pytest.raises(ValidationError):
            ImageData(filename="photo.png")  # type: ignore


class TestGenerateRequest:
    def test_minimal(self):
        req = GenerateRequest(diff_content="+ some new line")
        assert req.diff_content == "+ some new line"
        assert req.source_note == ""
        assert req.max_cards == 10
        assert req.images == []

    def test_with_images(self):
        img = ImageData(
            filename="img.png", data="base64data", media_type="image/png"
        )
        req = GenerateRequest(
            diff_content="diff",
            source_note="notes/bio.md",
            max_cards=5,
            images=[img],
        )
        assert len(req.images) == 1
        assert req.images[0].filename == "img.png"

    def test_empty_diff_allowed_by_schema(self):
        # Schema allows empty string — route validates it
        req = GenerateRequest(diff_content="")
        assert req.diff_content == ""


class TestGenerateResponse:
    def test_valid(self):
        resp = GenerateResponse(
            cards=[
                FlashcardPair(question="Q1", answer="A1"),
                FlashcardPair(question="Q2", answer="A2"),
            ]
        )
        assert len(resp.cards) == 2

    def test_empty_cards(self):
        resp = GenerateResponse(cards=[])
        assert resp.cards == []


class TestHealthResponse:
    def test_valid(self):
        resp = HealthResponse(status="ok")
        assert resp.status == "ok"
