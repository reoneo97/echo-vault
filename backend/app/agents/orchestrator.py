"""Orchestrator — generator → critic pipeline, drop-in for generate_cards_from_diff.

The API contract (routes.py) is unchanged. Internally, each file's cards go
through the generator (with retrieval tools) then the critic (different model
family) before being returned. Both steps are traced by MLflow autolog.
"""
from __future__ import annotations

import logging

from ..schemas import FlashcardPair, ImageData
from .critic import critique_cards
from .generator import generate_cards

logger = logging.getLogger(__name__)


async def run_pipeline(
    diff_content: str,
    source_note: str,
    max_cards: int,
    images: list[ImageData] | None = None,
    tags: list[str] | None = None,
    source_content: str = "",
    vault_path: str = "",
) -> list[FlashcardPair]:
    """Generator → critic pipeline. Returns cards that survived critic review.

    `source_content` is the full note text used by the critic for groundedness
    checks. Falls back to `diff_content` if not provided (new notes, first run).
    """
    cards = await generate_cards(
        diff_content=diff_content,
        source_note=source_note,
        max_cards=max_cards,
        images=images,
        tags=tags or [],
        vault_path=vault_path,
    )

    approved = await critique_cards(
        cards=cards,
        source_content=source_content or diff_content,
        source_note=source_note,
    )

    logger.info(
        "Pipeline: %d generated → %d approved for %s",
        len(cards), len(approved), source_note,
    )
    return approved
