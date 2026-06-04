"""
EchoVault flashcard generation eval.

Sends a set of test notes to the backend, measures structural card quality metrics,
and logs results as an MLflow run so prompt versions can be compared over time.

Usage:
    uv run python run_eval.py
    uv run python run_eval.py --notes fixtures --prompt-version v2
    uv run python run_eval.py --notes /path/to/vault/notes --prompt-version baseline
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
EXPERIMENT_NAME = "echovault-card-generation"


def load_notes(notes_dir: Path) -> list[dict]:
    notes = []
    for path in sorted(notes_dir.glob("*.md")):
        content = path.read_text()
        if content.strip():
            notes.append({"path": path.name, "diff_content": content, "max_cards": 10})
    return notes


def fixture_set_hash(notes_dir: Path) -> str:
    """SHA256 of all fixture file contents sorted by name. Changes if any note is edited."""
    h = hashlib.sha256()
    for path in sorted(notes_dir.glob("*.md")):
        h.update(path.name.encode())
        h.update(path.read_bytes())
    return h.hexdigest()[:12]


def fixture_set_version(notes_dir: Path) -> str:
    """Read version from manifest.json if present, else return 'unknown'."""
    manifest = notes_dir / "manifest.json"
    if manifest.exists():
        return json.loads(manifest.read_text()).get("version", "unknown")
    return "unknown"


def call_backend(notes: list[dict], backend_url: str) -> tuple[dict, float]:
    payload = {"files": notes, "max_cards": 10}
    t0 = time.perf_counter()
    response = httpx.post(
        f"{backend_url}/generate-flashcards-batch",
        json=payload,
        timeout=120.0,
    )
    elapsed = time.perf_counter() - t0
    response.raise_for_status()
    return response.json(), elapsed


def compute_metrics(response: dict, elapsed: float) -> dict:
    file_results = response.get("file_results", [])
    all_cards = []
    failed_files = 0
    for fr in file_results:
        if fr.get("error"):
            failed_files += 1
        else:
            all_cards.extend(fr.get("cards", []))

    total = len(all_cards)
    if total == 0:
        return {"total_cards": 0, "failed_files": failed_files, "generation_time_seconds": round(elapsed, 2)}

    type_counts = {"standard": 0, "multiple_choice": 0, "true_false": 0}
    question_lengths, answer_lengths = [], []

    for card in all_cards:
        type_counts[card.get("type", "standard")] = type_counts.get(card.get("type", "standard"), 0) + 1
        question_lengths.append(len(card.get("question", "").split()))
        answer_lengths.append(len(card.get("answer", "").split()))

    return {
        "total_cards": total,
        "cards_per_file": round(total / max(len(file_results), 1), 2),
        "failed_files": failed_files,
        "mcq_ratio": round(type_counts["multiple_choice"] / total, 3),
        "tf_ratio": round(type_counts["true_false"] / total, 3),
        "qa_ratio": round(type_counts["standard"] / total, 3),
        "avg_question_words": round(sum(question_lengths) / total, 1),
        "avg_answer_words": round(sum(answer_lengths) / total, 1),
        "generation_time_seconds": round(elapsed, 2),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--notes", type=Path, default=FIXTURES_DIR)
    parser.add_argument("--backend", default=BACKEND_URL)
    parser.add_argument("--mlflow", default=MLFLOW_URL)
    parser.add_argument("--prompt-version", default="current")
    args = parser.parse_args()

    notes = load_notes(args.notes)
    if not notes:
        print(f"No .md files found in {args.notes}")
        return

    print(f"Loaded {len(notes)} notes — calling backend at {args.backend} ...")
    response, elapsed = call_backend(notes, args.backend)
    metrics = compute_metrics(response, elapsed)

    print("\nMetrics:")
    for k, v in metrics.items():
        print(f"  {k}: {v}")

    mlflow.set_tracking_uri(args.mlflow)
    mlflow.set_experiment(EXPERIMENT_NAME)

    fixture_hash = fixture_set_hash(args.notes)
    fixture_version = fixture_set_version(args.notes)
    print(f"Fixture set: {fixture_version} (hash: {fixture_hash})")

    with mlflow.start_run() as run:
        mlflow.log_param("prompt_version", args.prompt_version)
        mlflow.log_param("fixture_set_version", fixture_version)
        mlflow.log_param("fixture_set_hash", fixture_hash)
        mlflow.log_param("notes_dir", str(args.notes))
        mlflow.log_param("num_test_files", len(notes))
        for k, v in metrics.items():
            mlflow.log_metric(k, v)

        artifact_path = Path("/tmp/echovault_eval_output.json")
        artifact_path.write_text(json.dumps(response, indent=2))
        mlflow.log_artifact(str(artifact_path), artifact_path="outputs")

        print(f"\nRun ID: {run.info.run_id}")
        print(f"View at: {args.mlflow}")


if __name__ == "__main__":
    main()
