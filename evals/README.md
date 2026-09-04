# EchoVault Evals

Evaluation framework for measuring and comparing flashcard generation quality across prompt versions.

---

## Structure

```
evals/
├── run_eval.py      — structural metrics (card type ratios, lengths, timing)
├── judge.py         — LLM-as-judge quality scores
├── fixtures/        — fixed test notes for reproducible evals
│   ├── binary_search.md
│   ├── transformer_attention.md
│   └── sql_indexes.md
├── pyproject.toml   — own uv project (mlflow, httpx, python-dotenv)
└── .env             — OPENROUTER_API_KEY, BACKEND_URL, MLFLOW_URL
```

---

## Quick start

```bash
# 1. Start the stack
make up

# 2. Log current prompt as baseline (structural metrics)
make eval ARGS="--prompt-version baseline"

# 3. Score quality with LLM judge
make judge ARGS="--prompt-version baseline"

# 4. View results
open http://localhost:5001
```

---

## Commands

### `make eval` — structural metrics

Sends the fixture notes to the backend, computes card type ratios and lengths, logs to MLflow.

```bash
make eval ARGS="--prompt-version baseline"
make eval ARGS="--prompt-version v2 --notes /path/to/your/vault"
```

**Metrics logged:**

| Metric | What it means |
|---|---|
| `mcq_ratio` | Fraction of multiple choice cards (target ≥ 0.60) |
| `tf_ratio` | Fraction of true/false cards (target ≥ 0.20) |
| `qa_ratio` | Fraction of open-ended Q&A (target ≤ 0.20) |
| `avg_question_words` | Proxy for question specificity |
| `avg_answer_words` | Proxy for explanation depth |
| `generation_time_seconds` | Total wall-clock time |
| `total_cards` | Cards generated across all files |
| `malformed_card_rate` | Fraction failing basic structural validity (null/missing `correct_answer`, duplicate options, empty question/answer) — mechanical, catches real bugs like `correct_answer: null` seen in production logs |

### `make judge` — LLM quality scores

Generates cards then scores each one with a judge LLM on a 1–5 rubric. Costs tokens.

```bash
make judge ARGS="--prompt-version baseline"

# Score an existing artifact without re-generating
make judge ARGS="--prompt-version baseline --input /tmp/echovault_eval_output.json"
```

**Metrics logged (experiment: `echovault-card-quality`):**

| Metric | What it means |
|---|---|
| `avg_question_clarity` | Are questions specific and unambiguous? |
| `avg_answer_quality` | Are answers faithful and clear? |
| `avg_distractor_quality` | Are MCQ distractors plausible? (MCQ only) |
| `avg_groundedness` | Is the answer actually supported by the source note, or added from general knowledge? |
| `avg_overall` | Mean of all scores above (groundedness included, cognitive level excluded — it's a classification, not a score) |
| `cognitive_ratio_recall` / `_application` / `_mechanism` / `_connection` | What fraction of cards test each kind of thinking — the real signal for "are we testing deeper, not just recall" |

The per-card scores are saved as a JSON artifact in each run — open a run in MLflow and read the `judge/` artifact to see exactly which cards scored low and why.

---

### `make dedup` — near-duplicate detection

Embeds each card (question + answer) and flags pairs above a cosine-similarity
threshold (0.87) — catches paraphrase duplicates plain text matching misses
(e.g. "What is FastAPI?" vs. "FastAPI is primarily used for..." across
different notes).

```bash
make dedup ARGS="--prompt-version baseline"
```

**Metrics logged** (experiment: `echovault-dedup`): `duplicate_pair_count`,
`duplicate_card_count`, `duplicate_rate`, `max_similarity`. The full list of
flagged pairs (with both questions) is saved as an artifact.

---

### Historical backtest — comparing against real production output

`backend/logs/requests.jsonl` already contains real diffs the OLD pipeline
processed, plus the cards it actually produced. `build_historical_fixtures.py`
turns that into a proper backtest set — no regeneration needed for the OLD
side, since its cards are already logged:

```bash
uv run python build_historical_fixtures.py          # all logged notes
uv run python build_historical_fixtures.py --limit 50   # most recent 50 only

# Score the OLD pipeline's real historical output (free — no regeneration):
uv run python judge.py  --input fixtures/historical/baseline_output.json --notes fixtures/historical --prompt-version old-extraction
uv run python dedup_eval.py --input fixtures/historical/baseline_output.json --notes fixtures/historical --prompt-version old-extraction

# Regenerate the SAME real notes with a new pipeline/prompt, then compare in MLflow:
uv run python run_eval.py   --notes fixtures/historical --prompt-version agent-v1
uv run python judge.py      --notes fixtures/historical --prompt-version agent-v1
uv run python dedup_eval.py --notes fixtures/historical --prompt-version agent-v1
```

`fixtures/historical/` is gitignored (derived from real personal notes via the
gitignored logs) — regenerate it locally, don't commit it. Unlike
`fixtures/standard`/`hard` (curated, committed), this is a live extraction.

---

## Workflow for comparing prompt versions

```
1. make eval ARGS="--prompt-version baseline"
2. make judge ARGS="--prompt-version baseline"
3. Edit prompt in backend/app/openrouter.py
4. make restart
5. make eval ARGS="--prompt-version v2-my-change"
6. make judge ARGS="--prompt-version v2-my-change"
7. Open http://localhost:5001 → compare runs
```

A good change improves `avg_overall` and `avg_distractor_quality` without reducing `mcq_ratio` or `total_cards`.

---

## Using your own notes

```bash
make eval ARGS="--prompt-version baseline --notes /Users/reo/Documents/Reo/data-science/data-science-notes"
```

This is more meaningful than fixtures since it reflects your actual note style. Run it once to establish a real baseline before making any prompt changes.

---

## Adding fixtures

Drop any `.md` file into `evals/fixtures/`. Pick notes that are representative of what you actually study — the eval is only as meaningful as the test data.
