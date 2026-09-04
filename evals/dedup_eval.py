"""
EchoVault duplicate-card eval.

Measures near-duplicate cards WITHIN a generation batch via embedding cosine
similarity -- catches paraphrase duplicates that plain text/string matching
misses (e.g. "What is FastAPI?" vs "FastAPI is primarily used for..." across
different notes -- the exact pattern found in production logs, five near-
identical cards from five different fastapi-*.md files).

This is deliberately a SEPARATE script from run_eval.py: it needs an API call
(an embedding per card), so it isn't "free/structural" in the Layer 1 sense
(see evals/EVAL.md) even though it's mechanical, not LLM-judgement-based.

Usage:
    # Score cards from a previous run_eval.py artifact
    uv run python dedup_eval.py --input /tmp/echovault_eval_output.json --prompt-version baseline

    # Run generation + dedup check in one step
    uv run python dedup_eval.py --notes fixtures --prompt-version v2

Scores logged to MLflow (experiment: echovault-dedup):
    duplicate_pair_count   — pairs above the similarity threshold
    duplicate_card_count   — cards involved in at least one such pair
    duplicate_rate         — duplicate_card_count / total_cards
    max_similarity         — highest pairwise similarity found (sanity check)
"""

import argparse
import hashlib
import itertools
import json
import math
import os
import time
from pathlib import Path

import httpx
import mlflow
from dotenv import load_dotenv

load_dotenv()

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "standard"
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
MLFLOW_URL = os.getenv("MLFLOW_URL", "http://localhost:5001")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
EMBEDDING_MODEL = "openai/text-embedding-3-small"  # cheap, verified working via OpenRouter
EXPERIMENT_NAME = "echovault-dedup"
SIMILARITY_THRESHOLD = 0.87  # cosine sim above this = treated as a duplicate pair


def card_text(card: dict) -> str:
    """What we embed: question + answer, not options -- two cards testing the
    same fact should embed close together regardless of MCQ vs standard phrasing."""
    return f"{card.get('question', '')} {card.get('answer', '')}".strip()


def embed_batch(texts: list[str]) -> list[list[float]]:
    response = httpx.post(
        "https://openrouter.ai/api/v1/embeddings",
        headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
        json={"model": EMBEDDING_MODEL, "input": texts},
        timeout=30.0,
    )
    response.raise_for_status()
    data = response.json()["data"]
    # OpenRouter returns embeddings in the same order as input, but keyed by index -- sort defensively
    data.sort(key=lambda d: d["index"])
    return [d["embedding"] for d in data]


def cosine_sim(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def compute_metrics(response: dict) -> tuple[dict, list[dict]]:
    file_results = response.get("file_results", [])
    all_cards = []
    for fr in file_results:
        if not fr.get("error"):
            for card in fr.get("cards", []):
                all_cards.append({**card, "source_note": fr["source_note"]})

    total = len(all_cards)
    if total < 2:
        return {"total_cards": total, "duplicate_pair_count": 0, "duplicate_card_count": 0,
                "duplicate_rate": 0.0, "max_similarity": 0.0}, []

    texts = [card_text(c) for c in all_cards]
    print(f"  Embedding {total} cards with {EMBEDDING_MODEL} ...")
    vectors = embed_batch(texts)

    duplicate_pairs = []
    duplicate_card_idx = set()
    max_sim = 0.0
    for i, j in itertools.combinations(range(total), 2):
        sim = cosine_sim(vectors[i], vectors[j])
        max_sim = max(max_sim, sim)
        if sim >= SIMILARITY_THRESHOLD:
            duplicate_card_idx.add(i)
            duplicate_card_idx.add(j)
            duplicate_pairs.append({
                "similarity": round(sim, 3),
                "a": {"source_note": all_cards[i]["source_note"], "question": all_cards[i].get("question")},
                "b": {"source_note": all_cards[j]["source_note"], "question": all_cards[j].get("question")},
            })

    metrics = {
        "total_cards": total,
        "duplicate_pair_count": len(duplicate_pairs),
        "duplicate_card_count": len(duplicate_card_idx),
        "duplicate_rate": round(len(duplicate_card_idx) / total, 3),
        "max_similarity": round(max_sim, 3),
    }
    return metrics, sorted(duplicate_pairs, key=lambda p: -p["similarity"])


def fixture_set_hash(notes_dir: Path) -> str:
    h = hashlib.sha256()
    for path in sorted(notes_dir.glob("*.md")):
        h.update(path.name.encode())
        h.update(path.read_bytes())
    return h.hexdigest()[:12]


def load_notes(notes_dir: Path) -> list[dict]:
    notes = []
    for path in sorted(notes_dir.glob("*.md")):
        content = path.read_text()
        if content.strip():
            notes.append({"path": path.name, "diff_content": content, "max_cards": 10})
    return notes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=None, help="Path to existing eval output JSON (skip generation)")
    parser.add_argument("--notes", type=Path, default=FIXTURES_DIR)
    parser.add_argument("--backend", default=BACKEND_URL)
    parser.add_argument("--mlflow", default=MLFLOW_URL)
    parser.add_argument("--prompt-version", default="current")
    args = parser.parse_args()

    if not OPENROUTER_API_KEY:
        print("Error: OPENROUTER_API_KEY not set in .env")
        return

    if args.input and args.input.exists():
        print(f"Loading cards from {args.input} ...")
        response = json.loads(args.input.read_text())
    else:
        notes = load_notes(args.notes)
        if not notes:
            print(f"No .md files found in {args.notes}")
            return
        print(f"Generating cards from {len(notes)} notes ...")
        resp = httpx.post(f"{args.backend}/generate-flashcards-batch",
                          json={"files": notes, "max_cards": 10}, timeout=120.0)
        resp.raise_for_status()
        response = resp.json()

    metrics, duplicate_pairs = compute_metrics(response)

    print("\nDedup metrics:")
    for k, v in metrics.items():
        print(f"  {k}: {v}")
    if duplicate_pairs:
        print(f"\nTop duplicate pairs (threshold={SIMILARITY_THRESHOLD}):")
        for p in duplicate_pairs[:5]:
            print(f"  [{p['similarity']}] {p['a']['source_note']}: {p['a']['question'][:50]!r}")
            print(f"          ~= {p['b']['source_note']}: {p['b']['question'][:50]!r}")

    mlflow.set_tracking_uri(args.mlflow)
    mlflow.set_experiment(EXPERIMENT_NAME)

    with mlflow.start_run() as run:
        mlflow.log_param("prompt_version", args.prompt_version)
        mlflow.log_param("embedding_model", EMBEDDING_MODEL)
        mlflow.log_param("similarity_threshold", SIMILARITY_THRESHOLD)
        mlflow.log_param("fixture_set_hash", fixture_set_hash(args.notes))
        for k, v in metrics.items():
            mlflow.log_metric(k, v)

        pairs_path = Path("/tmp/echovault_dedup_pairs.json")
        pairs_path.write_text(json.dumps(duplicate_pairs, indent=2))
        mlflow.log_artifact(str(pairs_path), artifact_path="dedup")

        print(f"\nRun ID: {run.info.run_id}")
        print(f"View at: {args.mlflow}")


if __name__ == "__main__":
    main()
