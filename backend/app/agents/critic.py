"""Critic agent — reviews generated cards against rubric.md before response.

Uses a different model family than the generator (CRITIC_MODEL in .env) to
avoid self-approval bias. Reads rubric.md so criteria stay in sync with the
offline judge in evals/judge.py.

Verdict policy (matches rubric.md thresholds):
  approve  — all applicable scores ≥ 4 (returned to caller)
  improve  — any score is 2-3 (returned, with optional improved text)
  reject   — any score < 2, or groundedness < 2 (dropped, logged)
"""
from __future__ import annotations

import logging
from copy import deepcopy
from pathlib import Path
from typing import Literal

import mlflow
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.settings import ModelSettings

from ..config import settings
from ..schemas import FlashcardPair

logger = logging.getLogger(__name__)

RUBRIC_PATH = Path(__file__).parent.parent / "rubric.md"


def _load_rubric() -> str:
    try:
        return RUBRIC_PATH.read_text()
    except OSError:
        logger.warning("rubric.md not found at %s — critic will use minimal criteria", RUBRIC_PATH)
        return "Reject cards that are vague, trivial, or not grounded in the source."


RUBRIC = _load_rubric()

_critic_provider = OpenAIProvider(
    base_url="https://openrouter.ai/api/v1",
    api_key=settings.openrouter_api_key,
)

_critic_model = OpenAIChatModel(settings.critic_model, provider=_critic_provider)

CRITIC_SETTINGS = ModelSettings(temperature=0.1, max_tokens=2048)

_CRITIC_SYSTEM = f"""You are a strict flashcard quality critic. Review AI-generated flashcards
against the rubric below and return a structured verdict for each card.

{RUBRIC}

Return a JSON verdict for every card index you receive. Be strict — prefer reject over approve
when groundedness is uncertain or the question is vague."""


class CardVerdict(BaseModel):
    card_index: int
    verdict: Literal["approve", "improve", "reject"]
    reason: str
    improved_question: str | None = None
    improved_answer: str | None = None


class CriticResponse(BaseModel):
    verdicts: list[CardVerdict]


critic_agent = Agent(
    _critic_model,
    system_prompt=_CRITIC_SYSTEM,
    output_type=CriticResponse,
)


async def critique_cards(
    cards: list[FlashcardPair],
    source_content: str,
    source_note: str,
) -> list[FlashcardPair]:
    """Run critic over generated cards; return those not rejected.

    Rejected cards are logged but not returned. Cards with verdict 'improve'
    are returned with any suggested text applied.
    """
    if not cards:
        return []

    cards_text = "\n\n".join(
        f"Card {i} (type={c.type}):\n  Q: {c.question}\n  A: {c.answer}"
        + (f"\n  Options: {c.options}" if c.options else "")
        for i, c in enumerate(cards)
    )

    prompt = (
        f"Source note: {source_note}\n\n"
        f"Source excerpt:\n{source_content[:1500]}\n\n"
        f"Cards to review:\n{cards_text}\n\n"
        f"Return a verdict for each card (indices 0–{len(cards) - 1})."
    )

    result = await critic_agent.run(prompt, model_settings=CRITIC_SETTINGS)
    verdicts = result.output.verdicts
    verdict_map = {v.card_index: v for v in verdicts}

    approved: list[FlashcardPair] = []
    rejected_count = 0

    for i, card in enumerate(cards):
        v = verdict_map.get(i)
        if v is None:
            approved.append(card)
            continue

        if v.verdict == "reject":
            rejected_count += 1
            logger.info("Critic rejected card %d from %s: %s", i, source_note, v.reason)
        elif v.verdict == "improve" and (v.improved_question or v.improved_answer):
            improved = deepcopy(card)
            if v.improved_question:
                improved.question = v.improved_question
            if v.improved_answer:
                improved.answer = v.improved_answer
            approved.append(improved)
        else:
            approved.append(card)

    usage = result.usage()
    with mlflow.start_span(name="critic.usage") as span:
        span.set_attributes({
            "component": "critic",
            "model": settings.critic_model,
            "source_note": source_note,
            "cards_reviewed": len(cards),
            "cards_approved": len(approved),
            "cards_rejected": rejected_count,
            "request_tokens": usage.request_tokens or 0,
            "response_tokens": usage.response_tokens or 0,
            "total_tokens": usage.total_tokens or 0,
        })

    if rejected_count:
        logger.info(
            "Critic: %d/%d cards rejected from %s",
            rejected_count, len(cards), source_note,
        )

    return approved
