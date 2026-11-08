"""Embedding-based near-duplicate detection for generated cards.

Draft (harness-design.md step 2) -- the mechanical half of dedup: given a
candidate card and the existing cards for its note/topic, find near-duplicates
by cosine similarity over embeddings. The algorithm mirrors
`evals/dedup_eval.py`, which already validated this exact approach offline
against 415 real historical cards (2.7% duplicate rate, catching real
paraphrase duplicates plain text matching misses -- e.g. five differently
worded "What is FastAPI?" cards across five notes).

Not yet wired into generation. Will become an `@agent.tool` on
`generator_agent` (harness-design.md step 3) -- kept as a plain async function
for now so it's testable in isolation first.
"""
import math

import httpx

from ..config import settings

EMBEDDING_MODEL = "openai/text-embedding-3-small"  # same model evals/dedup_eval.py verified

# Interpretation bands for the returned similarity score (policy lives with the
# CALLER, e.g. generator_agent -- this tool just measures and reports):
#   >= 0.87  near-exact duplicate -> skip the candidate
#   0.75-0.87  same concept, different angle -> a signal to go deeper/harder,
#              not necessarily a skip
#   < 0.75   unrelated -> not returned at all (the floor below)
SIMILARITY_FLOOR = 0.75


def _card_text(card: dict) -> str:
    """What gets embedded: question + answer, not options -- two cards testing
    the same fact should embed close together regardless of MCQ vs standard
    phrasing."""
    return f"{card.get('question', '')} {card.get('answer', '')}".strip()


async def _embed(texts: list[str]) -> list[list[float]]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/embeddings",
            headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
            json={"model": EMBEDDING_MODEL, "input": texts},
        )
        response.raise_for_status()
        data = response.json()["data"]
        data.sort(key=lambda d: d["index"])  # OpenRouter returns embeddings keyed by index
        return [d["embedding"] for d in data]


def _cosine_sim(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


async def similar_cards(candidate: dict, existing_cards: list[dict],
                        floor: float = SIMILARITY_FLOOR) -> list[dict]:
    """Find existing cards similar to `candidate` by embedding cosine
    similarity. Returns matches at or above `floor`, sorted by similarity
    (highest first): `[{"card": <existing card>, "similarity": float}, ...]`.
    Empty list = nothing similar found -- the candidate is safe to keep as-is.

    Doesn't decide skip vs. deepen vs. keep -- that's the caller's judgment
    call (see the similarity bands above); this tool only measures.
    """
    if not existing_cards:
        return []
    texts = [_card_text(candidate)] + [_card_text(c) for c in existing_cards]
    vectors = await _embed(texts)
    candidate_vec, existing_vecs = vectors[0], vectors[1:]

    matches = [
        {"card": card, "similarity": round(sim, 3)}
        for card, vec in zip(existing_cards, existing_vecs)
        if (sim := _cosine_sim(candidate_vec, vec)) >= floor
    ]
    return sorted(matches, key=lambda m: -m["similarity"])
