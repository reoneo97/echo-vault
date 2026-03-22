from unittest.mock import AsyncMock, patch

import pytest

from app.schemas import FlashcardPair


class TestHealthEndpoint:
    def test_health_returns_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestGenerateFlashcardsEndpoint:
    @patch("app.routes.generate_cards_from_diff", new_callable=AsyncMock)
    def test_generates_cards(self, mock_generate, client):
        mock_generate.return_value = [
            FlashcardPair(question="What is TCP?", answer="A transport protocol."),
        ]

        resp = client.post(
            "/generate-flashcards",
            json={"diff_content": "+ TCP is a transport protocol", "source_note": "networking.md"},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["cards"]) == 1
        assert data["cards"][0]["question"] == "What is TCP?"

    @patch("app.routes.generate_cards_from_diff", new_callable=AsyncMock)
    def test_passes_images_to_generator(self, mock_generate, client):
        mock_generate.return_value = [
            FlashcardPair(question="What does the diagram show?", answer="A cell."),
        ]

        resp = client.post(
            "/generate-flashcards",
            json={
                "diff_content": "Added ![[cell.png]]",
                "source_note": "biology.md",
                "images": [
                    {
                        "filename": "cell.png",
                        "data": "aGVsbG8=",  # base64 of "hello"
                        "media_type": "image/png",
                    }
                ],
            },
        )

        assert resp.status_code == 200
        # Verify images were passed through
        call_kwargs = mock_generate.call_args
        assert call_kwargs.kwargs.get("images") is not None
        assert len(call_kwargs.kwargs["images"]) == 1

    def test_empty_diff_returns_400(self, client):
        resp = client.post(
            "/generate-flashcards",
            json={"diff_content": "   "},
        )
        assert resp.status_code == 400
        assert "empty" in resp.json()["detail"]

    @patch("app.routes.generate_cards_from_diff", new_callable=AsyncMock)
    def test_no_images_passes_none(self, mock_generate, client):
        mock_generate.return_value = []

        resp = client.post(
            "/generate-flashcards",
            json={"diff_content": "some text"},
        )

        assert resp.status_code == 200
        call_kwargs = mock_generate.call_args
        assert call_kwargs.kwargs.get("images") is None

    @patch("app.routes.generate_cards_from_diff", new_callable=AsyncMock)
    def test_respects_max_cards(self, mock_generate, client):
        mock_generate.return_value = [
            FlashcardPair(question=f"Q{i}", answer=f"A{i}") for i in range(3)
        ]

        resp = client.post(
            "/generate-flashcards",
            json={"diff_content": "content", "max_cards": 3},
        )

        assert resp.status_code == 200
        call_kwargs = mock_generate.call_args
        assert call_kwargs.kwargs["max_cards"] == 3

    @patch("app.routes.generate_cards_from_diff", new_callable=AsyncMock)
    def test_generator_error_propagates(self, mock_generate, client):
        mock_generate.side_effect = Exception("LLM error")

        with pytest.raises(Exception, match="LLM error"):
            client.post(
                "/generate-flashcards",
                json={"diff_content": "content"},
            )
