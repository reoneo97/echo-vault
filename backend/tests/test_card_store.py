"""Tests for tools/card_store.py — manifest diffing and card read/write."""
import json
import pytest

from app.tools import card_store


@pytest.fixture(autouse=True)
def patch_store_path(tmp_path, monkeypatch):
    monkeypatch.setattr(card_store.settings, "echovault_store_path", str(tmp_path))
    return tmp_path


# ── compute_diff ──────────────────────────────────────────────────────────────

def test_compute_diff_no_prior_returns_full_content():
    content = "# Attention\nScaled dot-product attention."
    assert card_store.compute_diff("knowledge/attention.md", content) == content


def test_compute_diff_unchanged_returns_empty():
    content = "# Attention\nScaled dot-product attention."
    card_store.record_processed("knowledge/attention.md", content)
    assert card_store.compute_diff("knowledge/attention.md", content) == ""


def test_compute_diff_returns_only_new_lines():
    old = "# Attention\nLine one."
    new = "# Attention\nLine one.\nLine two added."
    card_store.record_processed("knowledge/attention.md", old)
    diff = card_store.compute_diff("knowledge/attention.md", new)
    assert "Line two added." in diff
    assert "Line one." not in diff


# ── record_processed ──────────────────────────────────────────────────────────

def test_record_processed_writes_manifest(tmp_path):
    card_store.record_processed("knowledge/note.md", "some content")
    manifest = json.loads((tmp_path / "manifest.json").read_text())
    assert manifest["knowledge/note.md"]["content"] == "some content"
    assert "processed_at" in manifest["knowledge/note.md"]


def test_record_processed_overwrites_previous(tmp_path):
    card_store.record_processed("knowledge/note.md", "v1")
    card_store.record_processed("knowledge/note.md", "v2")
    manifest = json.loads((tmp_path / "manifest.json").read_text())
    assert manifest["knowledge/note.md"]["content"] == "v2"


# ── card read/write ───────────────────────────────────────────────────────────

def test_get_cards_for_note_empty_store():
    assert card_store.get_cards_for_note("knowledge/note.md") == []


def test_append_and_retrieve_cards(tmp_path):
    cards = [
        {"id": "1", "question": "Q1", "answer": "A1", "sourceNotePath": "knowledge/note.md", "tags": ["ml"]},
        {"id": "2", "question": "Q2", "answer": "A2", "sourceNotePath": "knowledge/other.md", "tags": ["ml"]},
    ]
    card_store.append_cards(cards)
    result = card_store.get_cards_for_note("knowledge/note.md")
    assert len(result) == 1
    assert result[0]["id"] == "1"


def test_get_cards_for_tags():
    cards = [
        {"id": "1", "question": "Q", "answer": "A", "sourceNotePath": "n.md", "tags": ["ml", "cnn"]},
        {"id": "2", "question": "Q", "answer": "A", "sourceNotePath": "n.md", "tags": ["nlp"]},
    ]
    card_store.append_cards(cards)
    result = card_store.get_cards_for_tags(["ml"])
    assert len(result) == 1
    assert result[0]["id"] == "1"


def test_get_cards_for_tags_empty():
    assert card_store.get_cards_for_tags([]) == []


@pytest.mark.anyio
async def test_append_cards_async(tmp_path):
    cards = [{"id": "a", "question": "Q", "answer": "A", "sourceNotePath": "n.md", "tags": []}]
    await card_store.append_cards_async(cards)
    result = card_store.get_cards_for_note("n.md")
    assert len(result) == 1
