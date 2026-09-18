"""Tutor agent — conversational spaced-repetition coach.

Reads the user's flashcards and review history to identify weak areas,
then conducts a Socratic dialogue to gauge and improve retention.

MLflow experiment: echovault-tutor
One MLflow trace per tutor.chat() call, tagged with session_id.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

import mlflow
from pydantic import BaseModel
from pydantic_ai import Agent, RunContext

from ..config import settings
from ..openrouter import model, GENERATION_SETTINGS
from ..utils.llm_retry import run_with_fallback

logger = logging.getLogger(__name__)

LOGS_DIR = Path(__file__).parent.parent.parent / "logs"


# ── Deps ──────────────────────────────────────────────────────────────────────

@dataclass
class TutorDeps:
    session_id: str
    history: list[dict] = field(default_factory=list)


# ── Output schema ─────────────────────────────────────────────────────────────

class TutorOutput(BaseModel):
    reply: str
    """What the tutor says or asks next."""
    cards_referenced: list[str] = []
    """Card IDs currently being tested or discussed."""
    assessment: Literal["correct", "partial", "incorrect", "none"] = "none"
    """Feedback on the user's last answer. 'none' when asking a fresh question."""
    topic: str = ""
    """Short label for the current topic being discussed."""


# ── System prompt ─────────────────────────────────────────────────────────────

_TUTOR_SYSTEM = """You are a Socratic tutor helping a student review their spaced-repetition flashcards.

Your goals:
1. Test understanding, not just recall — ask "why" and "how" not just "what".
2. Focus on weak areas — cards the student has failed recently or cards with low easiness factor.
3. Be conversational — don't quiz mechanically. React to what the student says.
4. When the student answers incorrectly: guide them toward the answer without giving it away.
5. When correct: briefly acknowledge it, then probe deeper or move to a related concept.
6. Connect concepts across notes when you spot related ideas.

Use your tools to load the student's weak cards and recent review history before asking questions.
Pick one concept at a time — don't overwhelm them.

Return structured output: reply (what you say), cards_referenced (IDs you're testing),
assessment of their last answer, and the current topic label."""


# ── Agent ─────────────────────────────────────────────────────────────────────

tutor_agent = Agent(
    model,
    system_prompt=_TUTOR_SYSTEM,
    output_type=TutorOutput,
    deps_type=TutorDeps,
)


@tutor_agent.tool
async def get_weak_cards(ctx: RunContext[TutorDeps]) -> list[dict]:
    """Return flashcards with low retention — easinessFactor < 2.0 or recently failed.
    Call this at the start of a session to decide what to focus on."""
    store_path = settings.echovault_store_path
    if not store_path:
        return []
    try:
        data = json.loads(Path(store_path, "flashcards.json").read_text())
        cards = data.get("cards", [])
        weak = [
            {
                "id": c.get("id"),
                "question": c.get("question"),
                "answer": c.get("answer"),
                "type": c.get("type"),
                "sourceNotePath": c.get("sourceNotePath"),
                "easinessFactor": c.get("easinessFactor", 2.5),
                "repetitions": c.get("repetitions", 0),
                "interval": c.get("interval", 0),
            }
            for c in cards
            if c.get("easinessFactor", 2.5) < 2.1 or c.get("repetitions", 0) == 0
        ]
        # Sort worst first, cap at 20
        weak.sort(key=lambda c: c["easinessFactor"])
        return weak[:20]
    except Exception as e:
        logger.warning("Could not load weak cards: %s", e)
        return []


@tutor_agent.tool
async def get_recent_review_failures(ctx: RunContext[TutorDeps]) -> list[dict]:
    """Return recent review events where quality < 3 (failed or hard).
    Use this to identify what the student has been struggling with lately."""
    log_file = LOGS_DIR / "review-events.jsonl"
    if not log_file.exists():
        return []
    try:
        failures = []
        for line in log_file.read_text().splitlines()[-100:]:  # last 100 lines
            entry = json.loads(line)
            for event in entry.get("events", []):
                if event.get("quality", 5) < 3:
                    failures.append({
                        "card_id": event.get("card_id"),
                        "source_note": event.get("source_note"),
                        "quality": event.get("quality"),
                        "reviewed_at": event.get("reviewed_at"),
                    })
        return failures[-20:]  # most recent 20 failures
    except Exception as e:
        logger.warning("Could not load review failures: %s", e)
        return []


@tutor_agent.tool
async def get_card_by_id(ctx: RunContext[TutorDeps], card_id: str) -> dict | None:
    """Fetch full card details by ID. Use this when you need the full question/answer
    for a card you identified from the weak cards or review history."""
    store_path = settings.echovault_store_path
    if not store_path:
        return None
    try:
        data = json.loads(Path(store_path, "flashcards.json").read_text())
        for c in data.get("cards", []):
            if c.get("id") == card_id:
                return c
    except Exception as e:
        logger.warning("Could not load card %s: %s", card_id, e)
    return None


# ── Public interface ───────────────────────────────────────────────────────────

async def tutor_chat(
    message: str,
    session_id: str,
    history: list[dict],
) -> TutorOutput:
    """Run one turn of the tutor conversation.

    history: list of {"role": "user"|"assistant", "content": str}
    Returns TutorOutput with the tutor's reply and metadata.
    """
    mlflow.set_experiment("echovault-tutor")

    deps = TutorDeps(session_id=session_id, history=history)

    # Build conversation context from history (last 10 turns to stay within context)
    recent = history[-10:]
    context_lines = [
        f"{'Student' if m['role'] == 'user' else 'Tutor'}: {m['content']}"
        for m in recent
    ]
    context_str = "\n".join(context_lines)
    prompt = f"Conversation so far:\n{context_str}\n\nStudent: {message}" if context_str else f"Student: {message}"

    result = await run_with_fallback(
        tutor_agent, prompt,
        fallback_model_ids=settings.generator_fallback_models,
        api_key=settings.openrouter_api_key,
        deps=deps,
        model_settings=GENERATION_SETTINGS,
    )

    output = result.output
    usage = result.usage()
    with mlflow.start_span(name="tutor.usage") as span:
        span.set_attributes({
            "component": "tutor",
            "experiment": "echovault-tutor",
            "session_id": session_id,
            "model": settings.openrouter_model,
            "topic": output.topic,
            "assessment": output.assessment,
            "cards_referenced": len(output.cards_referenced),
            "history_turns": len(history),
            "request_tokens": usage.request_tokens or 0,
            "response_tokens": usage.response_tokens or 0,
            "total_tokens": usage.total_tokens or 0,
        })

    return output
