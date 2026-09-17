"""Generator agent — flashcard_agent with on-demand retrieval tools.

Tools are called by the model mid-reasoning, not fetched upfront. The model
decides whether it needs existing coverage or related notes before generating.
"""
from __future__ import annotations

import base64
import logging
from dataclasses import dataclass, field

from pydantic_ai import Agent, BinaryContent, RunContext

from ..config import settings
from ..openrouter import FLASHCARD_PROMPT, GENERATION_SETTINGS, model, normalize_image_refs
from ..schemas import FlashcardPair, GenerateResponse, ImageData
from ..tools.card_store import get_cards_for_note, get_cards_for_tags
from ..tools.link_graph import related_notes

logger = logging.getLogger(__name__)


@dataclass
class GeneratorDeps:
    source_note: str
    vault_path: str
    tags: list[str] = field(default_factory=list)


generator_agent = Agent(
    model,
    system_prompt=FLASHCARD_PROMPT,
    output_type=GenerateResponse,
    deps_type=GeneratorDeps,
)


@generator_agent.tool
async def existing_cards_for_note(ctx: RunContext[GeneratorDeps]) -> list[dict]:
    """Return approved flashcards already generated for this note. Call this
    to avoid duplicating cards that already exist for the same source."""
    try:
        cards = get_cards_for_note(ctx.deps.source_note)
        return [{"question": c.get("question"), "type": c.get("type")} for c in cards]
    except RuntimeError:
        return []


@generator_agent.tool
async def existing_cards_for_tags(ctx: RunContext[GeneratorDeps]) -> list[dict]:
    """Return approved flashcards that share tags with this note. Call this to
    check topic-level coverage before generating cards on a concept."""
    try:
        cards = get_cards_for_tags(ctx.deps.tags)
        return [
            {
                "question": c.get("question"),
                "type": c.get("type"),
                "source": c.get("sourceNotePath"),
            }
            for c in cards
        ]
    except RuntimeError:
        return []


@generator_agent.tool
async def notes_related_to_this(ctx: RunContext[GeneratorDeps], hops: int = 1) -> list[dict]:
    """Return notes linked to or sharing tags with this note (up to `hops` away).
    Use this to author 'connection' cards that bridge concepts across notes."""
    if not ctx.deps.vault_path:
        return []
    try:
        return related_notes(ctx.deps.source_note, ctx.deps.vault_path, hops=hops)
    except Exception:
        return []


async def generate_cards(
    diff_content: str,
    source_note: str,
    max_cards: int,
    images: list[ImageData] | None = None,
    tags: list[str] | None = None,
    vault_path: str = "",
) -> list[FlashcardPair]:
    """Run the generator agent and return the cards it produces."""
    deps = GeneratorDeps(
        source_note=source_note,
        vault_path=vault_path,
        tags=tags or [],
    )

    user_message = f"Source note: {source_note}\n\nNew content:\n{diff_content}"
    if max_cards:
        user_message += f"\n\nGenerate at most {max_cards} flashcards."

    if images:
        user_message += (
            f"\n\nThe content references {len(images)} image(s). "
            "Examine the images and generate flashcards about their visual content as well. "
            "When referencing an image in a question, use exactly this Obsidian syntax: ![[filename]] "
            "(e.g. ![[Pasted image 20230912.png]]). Do not use any other format."
        )
        message_parts: list = [user_message]
        for img in images:
            image_bytes = base64.b64decode(img.data)
            message_parts.append(BinaryContent(data=image_bytes, media_type=img.media_type))
        result = await generator_agent.run(message_parts, deps=deps, model_settings=GENERATION_SETTINGS)
    else:
        result = await generator_agent.run(user_message, deps=deps, model_settings=GENERATION_SETTINGS)

    cards = result.output.cards[:max_cards]
    for card in cards:
        card.question = normalize_image_refs(card.question)
        card.answer = normalize_image_refs(card.answer)
    return cards
