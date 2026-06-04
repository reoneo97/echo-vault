"""
EchoVault LLM-as-judge eval.

Scores generated flashcards on quality criteria using a second LLM call.
Can be run standalone against an artifact file, or chained after run_eval.py.

Usage:
    # Score cards from a previous run_eval.py artifact
    uv run python judge.py --input /tmp/echovault_eval_output.json --prompt-version baseline

    # Run generation + judging in one step
    uv run python judge.py --notes fixtures --prompt-version v2

Scores logged to MLflow (experiment: echovault-card-quality):
    avg_question_clarity    — is the question specific and unambiguous? (1-5)
    avg_answer_quality      — is the answer faithful and clear? (1-5)
    avg_distractor_quality  — are MCQ distractors plausible? (1-5, MCQ only)
    avg_overall             — mean of above scores
    judged_cards            — how many cards were scored
    judge_errors            — how many cards failed to score
"""

import argparse
import hashlib
import json
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
JUDGE_MODEL = "qwen/qwen3-8b"  # fast + cheap for judging
EXPERIMENT_NAME = "echovault-card-quality"

JUDGE_SYSTEM = """You are evaluating the quality of a flashcard generated from study notes.
Score the card on the criteria below. Respond with JSON only — no explanation outside the JSON."""

JUDGE_TEMPLATE = """Source note excerpt:
{source}

Flashcard:
  Type: {card_type}
  Question: {question}
  Answer/Explanation: {answer}
{choices_section}
Score each criterion from 1 to 5:

- question_clarity: Is the question specific, unambiguous, and tests genuine understanding (not trivial recall)?
  1 = vague or trivial, 3 = acceptable, 5 = precise and thought-provoking

- answer_quality: Is the answer/explanation accurate, clear, and faithful to the source note?
  1 = wrong or missing, 3 = acceptable, 5 = clear and well-explained

- distractor_quality: (MCQ only) Are the wrong choices plausible but clearly incorrect on reflection?
  1 = obviously wrong or partially correct, 3 = acceptable, 5 = excellent distractors
  Set to null if not MCQ.

Respond with this JSON and nothing else:
{{"question_clarity": <1-5>, "answer_quality": <1-5>, "distractor_quality": <1-5 or null>, "reasoning": "<one sentence>"}}"""


def format_choices(card: dict) -> str:
    options = card.get("options") or []
    correct = card.get("correct_answer", "")
    if not options:
        return ""
    lines = ["  Options:"]
    for opt in options:
        marker = " ✓" if opt == correct else ""
        lines.append(f"    - {opt}{marker}")
    return "\n".join(lines) + "\n"


def judge_card(card: dict, source: str) -> dict | None:
    """Call the judge LLM and return parsed scores, or None on failure."""
    choices_section = format_choices(card)
    prompt = JUDGE_TEMPLATE.format(
        source=source[:1500],  # truncate long notes
        card_type=card.get("type", "standard"),
        question=card.get("question", ""),
        answer=card.get("answer", ""),
        choices_section=choices_section,
    )

    try:
        response = httpx.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": JUDGE_MODEL,
                "messages": [
                    {"role": "system", "content": JUDGE_SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.1,  # low temp for consistent scoring
            },
            timeout=30.0,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"].strip()

        # Strip markdown code fences if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]

        return json.loads(content)
    except Exception as e:
        print(f"  Judge error: {e}")
        return None


def score_response(response: dict) -> tuple[dict, list[dict]]:
    """Score all cards in a batch response. Returns (aggregate_metrics, per_card_results)."""
    file_results = response.get("file_results", [])

    # Build source lookup: note path → content
    sources: dict[str, str] = {}
    for fr in file_results:
        # The response doesn't include source content, so we try to load from fixtures
        note_path = Path(__file__).parent / "fixtures" / fr["source_note"]
        if note_path.exists():
            sources[fr["source_note"]] = note_path.read_text()[:1500]
        else:
            sources[fr["source_note"]] = ""

    clarity_scores, answer_scores, distractor_scores = [], [], []
    per_card = []
    errors = 0

    for fr in file_results:
        source = sources.get(fr["source_note"], "")
        cards = fr.get("cards", [])
        print(f"  Judging {len(cards)} cards from {fr['source_note']}...")

        for i, card in enumerate(cards):
            print(f"    Card {i+1}/{len(cards)}: {card.get('question', '')[:60]}...")
            scores = judge_card(card, source)
            time.sleep(0.3)  # gentle rate limiting

            if scores is None:
                errors += 1
                continue

            clarity_scores.append(scores.get("question_clarity", 0))
            answer_scores.append(scores.get("answer_quality", 0))
            if scores.get("distractor_quality") is not None:
                distractor_scores.append(scores["distractor_quality"])

            per_card.append({
                "source_note": fr["source_note"],
                "question": card.get("question"),
                "type": card.get("type"),
                "scores": scores,
            })

    all_scores = clarity_scores + answer_scores + distractor_scores
    metrics = {
        "avg_question_clarity": round(sum(clarity_scores) / len(clarity_scores), 2) if clarity_scores else 0,
        "avg_answer_quality": round(sum(answer_scores) / len(answer_scores), 2) if answer_scores else 0,
        "avg_distractor_quality": round(sum(distractor_scores) / len(distractor_scores), 2) if distractor_scores else 0,
        "avg_overall": round(sum(all_scores) / len(all_scores), 2) if all_scores else 0,
        "judged_cards": len(per_card),
        "judge_errors": errors,
    }
    return metrics, per_card


def fixture_set_hash(notes_dir: Path) -> str:
    h = hashlib.sha256()
    for path in sorted(notes_dir.glob("*.md")):
        h.update(path.name.encode())
        h.update(path.read_bytes())
    return h.hexdigest()[:12]


def fixture_set_version(notes_dir: Path) -> str:
    manifest = notes_dir / "manifest.json"
    if manifest.exists():
        return json.loads(manifest.read_text()).get("version", "unknown")
    return "unknown"


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
    parser.add_argument("--notes", type=Path, default=FIXTURES_DIR, help="Directory of .md test notes (used if --input not provided)")
    parser.add_argument("--backend", default=BACKEND_URL)
    parser.add_argument("--mlflow", default=MLFLOW_URL)
    parser.add_argument("--prompt-version", default="current")
    args = parser.parse_args()

    if not OPENROUTER_API_KEY:
        print("Error: OPENROUTER_API_KEY not set in .env")
        return

    # Get the cards to judge
    if args.input and args.input.exists():
        print(f"Loading cards from {args.input} ...")
        response = json.loads(args.input.read_text())
    else:
        notes = load_notes(args.notes)
        if not notes:
            print(f"No .md files found in {args.notes}")
            return
        print(f"Generating cards from {len(notes)} notes ...")
        resp = httpx.post(
            f"{args.backend}/generate-flashcards-batch",
            json={"files": notes, "max_cards": 10},
            timeout=120.0,
        )
        resp.raise_for_status()
        response = resp.json()

    total_cards = sum(len(fr.get("cards", [])) for fr in response.get("file_results", []))
    print(f"\nJudging {total_cards} cards with {JUDGE_MODEL} ...")

    metrics, per_card = score_response(response)

    print("\nQuality scores:")
    for k, v in metrics.items():
        print(f"  {k}: {v}")

    # Log to MLflow
    mlflow.set_tracking_uri(args.mlflow)
    mlflow.set_experiment(EXPERIMENT_NAME)

    fixture_hash = fixture_set_hash(args.notes)
    fixture_version = fixture_set_version(args.notes)

    with mlflow.start_run() as run:
        mlflow.log_param("prompt_version", args.prompt_version)
        mlflow.log_param("judge_model", JUDGE_MODEL)
        mlflow.log_param("fixture_set_version", fixture_version)
        mlflow.log_param("fixture_set_hash", fixture_hash)
        mlflow.log_param("notes_dir", str(args.notes))
        for k, v in metrics.items():
            mlflow.log_metric(k, v)

        # Save per-card scores as artifact for inspection
        artifact_path = Path("/tmp/echovault_judge_output.json")
        artifact_path.write_text(json.dumps(per_card, indent=2))
        mlflow.log_artifact(str(artifact_path), artifact_path="judge")

        print(f"\nRun ID: {run.info.run_id}")
        print(f"View at: {args.mlflow}")


if __name__ == "__main__":
    main()
