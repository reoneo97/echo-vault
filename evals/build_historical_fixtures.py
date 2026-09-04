"""
Build a historical backtest set from real production logs.

Two outputs from the same source (backend/logs/requests.jsonl):
1. fixtures/historical/*.md + manifest.json -- the real notes, so a NEW
   pipeline can be run against the exact same inputs the OLD pipeline saw.
2. A "baseline" artifact JSON in the same {"file_results": [...]} shape
   run_eval.py/judge.py/dedup_eval.py already expect, built directly from
   the OLD pipeline's cards already sitting in the logs -- no regeneration,
   no cost, this IS the old-pipeline backtest baseline.

Usage:
    uv run python build_historical_fixtures.py
    uv run python build_historical_fixtures.py --limit 20
"""

import argparse
import json
from pathlib import Path

LOGS_PATH = Path(__file__).parent.parent / "backend" / "logs" / "requests.jsonl"
FIXTURES_OUT = Path(__file__).parent / "fixtures" / "historical"
BASELINE_OUT = Path(__file__).parent / "fixtures" / "historical" / "baseline_output.json"


def _flatten_line(rec: dict) -> list[dict]:
    """The log mixes two shapes: flat per-file records (source_note/diff_content/
    cards at the top level) and batch records (batch: true, a nested "files" list,
    each entry shaped like a flat record). Normalize both to a list of flat dicts."""
    if rec.get("batch") and "files" in rec:
        return [{**f, "timestamp": rec.get("timestamp")} for f in rec["files"]]
    return [rec]


def load_log_records(limit: int | None) -> list[dict]:
    records = []
    seen_notes = set()
    for line in LOGS_PATH.read_text().splitlines():
        if not line.strip():
            continue
        for rec in _flatten_line(json.loads(line)):
            note = rec.get("source_note")
            if not note or not rec.get("diff_content", "").strip():
                continue
            # de-dupe: keep the LATEST record per source_note (a note may have
            # been (re)processed more than once across the log's history)
            if note in seen_notes:
                records = [r for r in records if r.get("source_note") != note]
            seen_notes.add(note)
            records.append(rec)
    if limit:
        records = records[-limit:]
    return records


def write_fixtures(records: list[dict]) -> None:
    FIXTURES_OUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "version": "v1",
        "description": "Real historical diffs from backend/logs/requests.jsonl -- "
                       "the exact inputs the OLD (extraction) pipeline saw. Used to "
                       "backtest a new pipeline on identical, real-world content "
                       "(see docs/echo-vault-redesign.md, second-brain repo).",
        "source": "backend/logs/requests.jsonl",
        "notes": [],
    }
    for rec in records:
        note_path = rec["source_note"]
        # flatten path separators into a safe filename, keep provenance in the manifest
        safe_name = note_path.replace("/", "__")
        (FIXTURES_OUT / safe_name).write_text(rec["diff_content"])
        manifest["notes"].append({"file": safe_name, "original_path": note_path,
                                  "logged_timestamp": rec.get("timestamp")})
    (FIXTURES_OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))


def write_baseline_artifact(records: list[dict]) -> None:
    # "historical/" prefix matters: judge.py resolves source content via a
    # hardcoded `fixtures/{source_note}` lookup, so this must match where
    # write_fixtures() actually put the file.
    file_results = [
        {"source_note": "historical/" + rec["source_note"].replace("/", "__"),
         "cards": rec.get("cards", []), "error": None}
        for rec in records
    ]
    BASELINE_OUT.parent.mkdir(parents=True, exist_ok=True)
    BASELINE_OUT.write_text(json.dumps({"file_results": file_results}, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None,
                        help="Only use the N most recent log entries (default: all)")
    args = parser.parse_args()

    if not LOGS_PATH.exists():
        print(f"No log file at {LOGS_PATH}")
        return

    records = load_log_records(args.limit)
    total_cards = sum(len(r.get("cards", [])) for r in records)
    print(f"Loaded {len(records)} unique historical notes ({total_cards} already-generated cards)")

    write_fixtures(records)
    print(f"Wrote fixture notes -> {FIXTURES_OUT}")

    write_baseline_artifact(records)
    print(f"Wrote OLD-pipeline baseline artifact -> {BASELINE_OUT}")
    print("\nNext steps:")
    print(f"  # Score the OLD pipeline's real historical output (no regeneration, free):")
    print(f"  uv run python judge.py --input {BASELINE_OUT} --notes {FIXTURES_OUT} --prompt-version old-extraction")
    print(f"  uv run python dedup_eval.py --input {BASELINE_OUT} --notes {FIXTURES_OUT} --prompt-version old-extraction")
    print(f"  # Regenerate the SAME notes with the new pipeline, then compare:")
    print(f"  uv run python run_eval.py --notes {FIXTURES_OUT} --prompt-version agent-v1")


if __name__ == "__main__":
    main()
