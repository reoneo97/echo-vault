"""
EchoVault flashcard generation eval.

Sends a fixed set of test notes to the backend, measures card quality metrics,
and logs results as an MLflow run so prompt versions can be compared over time.

Usage:
    uv run python evals/run_eval.py
    uv run python evals/run_eval.py --notes evals/fixtures --prompt-version v2
    uv run python evals/run_eval.py --backend http://localhost:8000 --mlflow http://localhost:5000
"""

import argparse
import json
import time
from pathlib import Path

import httpx
import mlflow

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
FIXTURES_DIR = Path(__file__).parent / "fixtures"
BACKEND_URL = "http://localhost:8000"
MLFLOW_URL = "http://localhost:5000"
EXPERIMENT_NAME = "echovault-card-generation"


def load_notes(notes_dir: Path) -> list[dict]:
    """Read all .md files from the given directory."""
    notes = []
    for path in sorted(notes_dir.glob("*.md")):
        content = path.read_text()
        if content.strip():
            notes.append({"path": path.name, "diff_content": content, "max_cards": 10})
    return notes


def call_backend(notes: list[dict], backend_url: str) -> tuple[dict, float]:
    """POST to /generate-flashcards-batch and return (response_json, elapsed_seconds)."""
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
    """Derive quality metrics from the batch response."""
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
        return {
            "total_cards": 0,
            "failed_files": failed_files,
            "generation_time_seconds": round(elapsed, 2),
        }

    type_counts = {"standard": 0, "multiple_choice": 0, "true_false": 0}
    question_lengths = []
    answer_lengths = []

    for card in all_cards:
        card_type = card.get("type", "standard")
        type_counts[card_type] = type_counts.get(card_type, 0) + 1
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


def fetch_model_info(backend_url: str) -> str:
    """Read the model name from the backend health endpoint (best-effort)."""
    try:
        r = httpx.get(f"{backend_url}/health", timeout=5.0)
        return r.json().get("model", "unknown")
    except Exception:
        return "unknown"


def main():
    parser = argparse.ArgumentParser(description="Run EchoVault card generation eval")
    parser.add_argument("--notes", type=Path, default=FIXTURES_DIR, help="Directory of .md test notes")
    parser.add_argument("--backend", default=BACKEND_URL, help="Backend URL")
    parser.add_argument("--mlflow", default=MLFLOW_URL, help="MLflow tracking server URL")
    parser.add_argument("--prompt-version", default="current", help="Label for the prompt version being tested")
    args = parser.parse_args()

    notes = load_notes(args.notes)
    if not notes:
        print(f"No .md files found in {args.notes}")
        return

    print(f"Loaded {len(notes)} test notes from {args.notes}")
    print(f"Calling backend at {args.backend} ...")

    response, elapsed = call_backend(notes, args.backend)
    metrics = compute_metrics(response, elapsed)

    print(f"\nMetrics:")
    for k, v in metrics.items():
        print(f"  {k}: {v}")

    # Log to MLflow
    mlflow.set_tracking_uri(args.mlflow)
    mlflow.set_experiment(EXPERIMENT_NAME)

    with mlflow.start_run():
        # Parameters — what changed between runs
        mlflow.log_param("prompt_version", args.prompt_version)
        mlflow.log_param("notes_dir", str(args.notes))
        mlflow.log_param("num_test_files", len(notes))

        # Metrics — what we're optimising for
        for k, v in metrics.items():
            mlflow.log_metric(k, v)

        # Artifacts — full output for inspection
        artifact_path = Path("/tmp/echovault_eval_output.json")
        artifact_path.write_text(json.dumps(response, indent=2))
        mlflow.log_artifact(str(artifact_path), artifact_path="outputs")

        run_id = mlflow.active_run().info.run_id
        print(f"\nLogged to MLflow run: {run_id}")
        print(f"View at: {args.mlflow}/#/experiments")


if __name__ == "__main__":
    main()
