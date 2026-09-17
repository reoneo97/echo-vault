from unittest.mock import AsyncMock, patch

import pytest

from app.schemas import FlashcardPair


class TestHealthEndpoint:
    def test_health_returns_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestGenerateFlashcardsBatchEndpoint:
    @patch("app.routes.run_pipeline", new_callable=AsyncMock)
    def test_generates_cards(self, mock_pipeline, client):
        mock_pipeline.return_value = [
            FlashcardPair(question="What is TCP?", answer="A transport protocol."),
        ]

        resp = client.post(
            "/generate-flashcards-batch",
            json={"files": [{"path": "networking.md", "diff_content": "+ TCP is a transport protocol"}]},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["file_results"]) == 1
        assert data["file_results"][0]["cards"][0]["question"] == "What is TCP?"

    @patch("app.routes.run_pipeline", new_callable=AsyncMock)
    def test_passes_images_to_pipeline(self, mock_pipeline, client):
        mock_pipeline.return_value = [
            FlashcardPair(question="What does the diagram show?", answer="A cell."),
        ]

        resp = client.post(
            "/generate-flashcards-batch",
            json={
                "files": [
                    {
                        "path": "biology.md",
                        "diff_content": "Added ![[cell.png]]",
                        "images": [
                            {
                                "filename": "cell.png",
                                "data": "aGVsbG8=",
                                "media_type": "image/png",
                            }
                        ],
                    }
                ]
            },
        )

        assert resp.status_code == 200
        call_kwargs = mock_pipeline.call_args
        assert call_kwargs.kwargs.get("images") is not None
        assert len(call_kwargs.kwargs["images"]) == 1

    def test_empty_diff_returns_400(self, client):
        resp = client.post(
            "/generate-flashcards-batch",
            json={"files": [{"path": "note.md", "diff_content": "   "}]},
        )
        assert resp.status_code == 400
        assert "empty" in resp.json()["detail"]

    @patch("app.routes.run_pipeline", new_callable=AsyncMock)
    def test_no_images_passes_none(self, mock_pipeline, client):
        mock_pipeline.return_value = []

        resp = client.post(
            "/generate-flashcards-batch",
            json={"files": [{"path": "note.md", "diff_content": "some text"}]},
        )

        assert resp.status_code == 200
        call_kwargs = mock_pipeline.call_args
        assert call_kwargs.kwargs.get("images") is None

    @patch("app.routes.run_pipeline", new_callable=AsyncMock)
    def test_passes_tags_to_pipeline(self, mock_pipeline, client):
        mock_pipeline.return_value = []

        resp = client.post(
            "/generate-flashcards-batch",
            json={"files": [{"path": "note.md", "diff_content": "content", "tags": ["ml", "python"]}]},
        )

        assert resp.status_code == 200
        call_kwargs = mock_pipeline.call_args
        assert call_kwargs.kwargs.get("tags") == ["ml", "python"]

    @patch("app.routes.run_pipeline", new_callable=AsyncMock)
    def test_pipeline_error_returns_file_error(self, mock_pipeline, client):
        mock_pipeline.side_effect = Exception("LLM error")

        resp = client.post(
            "/generate-flashcards-batch",
            json={"files": [{"path": "note.md", "diff_content": "content"}]},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["file_results"][0]["error"] is not None
        assert "LLM error" in data["file_results"][0]["error"]
