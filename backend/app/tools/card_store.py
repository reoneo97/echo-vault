"""Read/write access to the shared EchoVault card store and content manifest.

Two files inside the vault's EchoVault/ directory (set via ECHOVAULT_STORE_PATH):

  flashcards.json  — the card store the plugin already reads/writes.
                     This tool reads it so the generator can check existing
                     coverage per note; the critic writes approved cards back.

  manifest.json    — NEW: stores the previous full content of each processed
                     note so the backend can compute a text diff without git.
                     Shape: { "<note_path>": { "content": str, "processed_at": str } }

The manifest replaces the plugin's git-checkpoint diffing (harness-design.md §1,
redesign doc §3). The backend receives diff_content as plain text either way —
the source of that diff is internal to the plugin; the API contract is unchanged.
"""
import asyncio
import difflib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from ..config import settings

logger = logging.getLogger(__name__)

FLASHCARDS_FILENAME = "flashcards.json"
MANIFEST_FILENAME = "manifest.json"


def _store_path() -> Path:
    if not settings.echovault_store_path:
        raise RuntimeError(
            "ECHOVAULT_STORE_PATH is not set. "
            "Add it to .env pointing at the vault's EchoVault/ directory."
        )
    return Path(settings.echovault_store_path)


# ── Manifest ──────────────────────────────────────────────────────────────────

def _load_manifest(store: Path) -> dict:
    path = store / MANIFEST_FILENAME
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        logger.warning("manifest.json unreadable, starting fresh")
        return {}


def _save_manifest(store: Path, manifest: dict) -> None:
    store.mkdir(parents=True, exist_ok=True)
    (store / MANIFEST_FILENAME).write_text(json.dumps(manifest, indent=2))


def compute_diff(note_path: str, current_content: str) -> str:
    """Return a unified-diff string of new lines vs. the last processed content.

    If the note has never been processed, the whole content is returned as-is
    (everything is "new"). The diff is what gets sent to the generator as
    diff_content — identical to what the plugin's git-diff produced before.
    """
    manifest = _load_manifest(_store_path())
    entry = manifest.get(note_path)
    if not entry:
        return current_content

    previous = entry["content"]
    if previous == current_content:
        return ""

    diff_lines = list(difflib.unified_diff(
        previous.splitlines(),
        current_content.splitlines(),
        fromfile=f"{note_path} (previous)",
        tofile=f"{note_path} (current)",
        lineterm="",
    ))
    # Return only the added lines (strip the unified-diff header and context),
    # matching the format the generator prompt already expects.
    added = [line[1:] for line in diff_lines if line.startswith("+") and not line.startswith("+++")]
    return "\n".join(added)


def record_processed(note_path: str, content: str) -> None:
    """Update the manifest entry for a note after its cards have been approved."""
    store = _store_path()
    manifest = _load_manifest(store)
    manifest[note_path] = {
        "content": content,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_manifest(store, manifest)


# ── Card store ────────────────────────────────────────────────────────────────

def _load_flashcards(store: Path) -> dict:
    path = store / FLASHCARDS_FILENAME
    if not path.exists():
        return {"version": 1, "cards": []}
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        logger.warning("flashcards.json unreadable")
        return {"version": 1, "cards": []}


def _save_flashcards(store: Path, data: dict) -> None:
    store.mkdir(parents=True, exist_ok=True)
    (store / FLASHCARDS_FILENAME).write_text(json.dumps(data, indent=2))


def get_cards_for_note(note_path: str) -> list[dict]:
    """Return all approved cards whose sourceNotePath matches note_path.

    Used by the generator to check existing coverage before drafting new cards.
    """
    data = _load_flashcards(_store_path())
    return [c for c in data.get("cards", []) if c.get("sourceNotePath") == note_path]


def get_cards_for_tags(tags: list[str]) -> list[dict]:
    """Return approved cards whose tags overlap with the given list.

    Used by the generator for topic-level coverage checks (not just per-note).
    """
    if not tags:
        return []
    tag_set = set(tags)
    data = _load_flashcards(_store_path())
    return [c for c in data.get("cards", []) if tag_set & set(c.get("tags", []))]


# asyncio lock so concurrent batch requests don't interleave writes
_write_lock = asyncio.Lock()


def append_cards(cards: list[dict]) -> None:
    """Write a batch of newly approved cards into flashcards.json (sync).

    Safe to call from sync contexts (tests, CLI). Does not hold the asyncio
    lock — use append_cards_async inside agent/route code where concurrency
    is possible.
    """
    store = _store_path()
    data = _load_flashcards(store)
    data["cards"].extend(cards)
    _save_flashcards(store, data)
    logger.info("card_store: appended %d cards", len(cards))


async def append_cards_async(cards: list[dict]) -> None:
    """Async-safe variant for use inside agents and route handlers.

    Holds the asyncio lock so concurrent batch requests don't interleave writes.
    """
    async with _write_lock:
        store = _store_path()
        data = _load_flashcards(store)
        data["cards"].extend(cards)
        _save_flashcards(store, data)
        logger.info("card_store: appended %d cards (async)", len(cards))
