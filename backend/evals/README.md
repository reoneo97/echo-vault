# EchoVault Eval Framework

This directory contains the evaluation harness for measuring flashcard generation quality across prompt versions.

---

## What Was Added

### Files

```
backend/evals/
├── run_eval.py          — eval script: calls backend, computes metrics, logs to MLflow
└── fixtures/
    ├── binary_search.md       — test note: algorithms
    ├── transformer_attention.md — test note: ML concepts
    └── sql_indexes.md         — test note: databases
```

### Services

**MLflow** was added to `docker-compose.yml` as a fourth service:

```yaml
mlflow:
  image: ghcr.io/mlflow/mlflow:v2.16.0
  ports:
    - "5000:5000"
  volumes:
    - mlflow_data:/mlflow
  command: >
    mlflow server
    --backend-store-uri sqlite:////mlflow/mlflow.db
    --default-artifact-root /mlflow/artifacts
```

- Uses SQLite as the backend store (zero-config, file-backed, persisted in a Docker volume)
- Artifacts (generated card JSON) stored in the same volume
- No authentication — local use only

### Python dependency

`mlflow` was added to the dev dependency group in `pyproject.toml`:

```toml
[dependency-groups]
dev = ["mlflow", ...]
```

---

## How to Run

```bash
# 1. Start everything (backend must be running)
make up

# 2. Run eval against the built-in test fixtures
make eval

# 3. View results
open http://localhost:5000
```

To label a specific prompt version:

```bash
make eval ARGS="--prompt-version v2-peer-distractors"
```

To eval against your own notes:

```bash
make eval ARGS="--notes /path/to/your/notes"
```

---

## What Gets Measured

Each eval run logs the following to MLflow:

| Metric | What it tells you |
|---|---|
| `total_cards` | How many cards were generated across all test files |
| `cards_per_file` | Average cards per note — too low means the prompt is conservative |
| `mcq_ratio` | Fraction of multiple choice cards (target: ≥ 0.60) |
| `tf_ratio` | Fraction of true/false cards (target: ≥ 0.20) |
| `qa_ratio` | Fraction of open-ended Q&A cards (target: ≤ 0.20) |
| `avg_question_words` | Average question length in words — proxy for specificity |
| `avg_answer_words` | Average answer length — very short answers may lack explanation |
| `generation_time_seconds` | Total wall-clock time for the batch call |
| `failed_files` | Files that errored after retries |

**Parameters** (what changed between runs):

| Parameter | Description |
|---|---|
| `prompt_version` | Free-text label — e.g. `"v1-baseline"`, `"v2-peer-distractors"` |
| `num_test_files` | How many fixtures were used |
| `notes_dir` | Which fixture directory was used |

**Artifacts**: the full JSON response from the backend is saved per run so you can read the actual cards generated.

---

## How to Compare Runs

1. Open `http://localhost:5000`
2. Click the **echovault-card-generation** experiment
3. Select two or more runs → **Compare**
4. MLflow shows a side-by-side diff of all parameters and metrics

A good prompt change should increase `mcq_ratio` and `tf_ratio` without reducing `total_cards` or increasing `generation_time_seconds` significantly.

---

## Step-by-Step: How This Was Built From Scratch

This section explains every decision so you can reproduce or extend the setup.

### Step 1 — Choose an experiment tracking tool

The options were MLflow, Weights & Biases, and Neptune. MLflow was chosen because:
- **Fully open source and self-hostable** — no SaaS dependency
- **Simple to add to Docker** — one service, SQLite backend, no external database needed
- **Standard API** — `mlflow.log_param`, `mlflow.log_metric`, `mlflow.log_artifact` are the core primitives; easy to learn

### Step 2 — Add MLflow to Docker Compose

MLflow ships an official Docker image at `ghcr.io/mlflow/mlflow`. The server needs two things:

1. A **backend store** — where run metadata (params, metrics, tags) is saved. Options are SQLite (file), PostgreSQL, or MySQL. SQLite is fine for local use.
2. A **default artifact root** — where files (JSON outputs, model weights, etc.) are stored. A local path or S3.

Both are passed as CLI flags to `mlflow server`. Mounting a named volume means data persists across `docker compose down` / `up`.

```yaml
command: >
  mlflow server
  --host 0.0.0.0
  --port 5000
  --backend-store-uri sqlite:////mlflow/mlflow.db   # four slashes = absolute path
  --default-artifact-root /mlflow/artifacts
```

Note the four slashes in the SQLite URI: `sqlite:////path` means `sqlite://` (protocol) + `/path` (absolute).

### Step 3 — Install the Python client

MLflow has a Python client (`mlflow`) that talks to the tracking server over HTTP. It was added as a dev dependency because evals are not needed at runtime:

```bash
uv add --dev mlflow
```

The client is configured with two calls at the start of the script:

```python
mlflow.set_tracking_uri("http://localhost:5000")  # where the server is
mlflow.set_experiment("echovault-card-generation") # logical grouping of runs
```

### Step 4 — Decide what to measure

Three categories of things to log:

**Parameters** — things you *control* that vary between runs. These are the independent variables. For a prompt eval: prompt version label, which test files were used. Parameters are set once per run with `mlflow.log_param(key, value)`.

**Metrics** — things you *measure* to evaluate quality. For flashcard generation: card type ratios, average lengths, generation time. Metrics are set with `mlflow.log_metric(key, value)`. You can also log metrics over time (e.g. step-by-step) but a single value per run is enough here.

**Artifacts** — arbitrary files. The full JSON output is logged so you can open a run and read the actual cards generated, not just the aggregated numbers. Logged with `mlflow.log_artifact(path)`.

### Step 5 — Write the eval script

The script follows a simple pipeline:

```
load test notes → call backend → compute metrics → log to MLflow
```

Key decisions:
- Uses `httpx` (already a test dependency) to call the backend — the eval treats the backend as a black box, same as the plugin does
- Metrics are computed client-side from the response JSON — no changes needed to the backend
- `--prompt-version` is a free-text CLI flag so you can label runs before you run them

### Step 6 — Add test fixtures

The fixtures are real-content markdown notes (not toy examples) because the card quality metrics only make sense with realistic input. Three notes were chosen to cover different domains: algorithms, ML, and databases.

To add your own: drop any `.md` file into `evals/fixtures/` or pass `--notes /path/to/dir`.

### Step 7 — Wire it into the Makefile

```makefile
eval:
    cd $(BACKEND_SRC) && uv run python evals/run_eval.py $(ARGS)
```

`$(ARGS)` lets you pass extra flags: `make eval ARGS="--prompt-version v2"`.

---

## What's Next

The current eval measures **output statistics** (card type ratios, lengths). The next level is **output quality**, which requires human judgment or an LLM judge:

1. **LLM-as-judge** — send each generated card to a second LLM call with a scoring rubric (1–5 for clarity, specificity, distractor quality). Log `avg_quality_score` as a metric.
2. **Acceptance rate as a delayed metric** — after using the plugin for a week, join the `feedback.jsonl` accept/reject decisions back to the cards from a specific eval run. The acceptance rate becomes a ground-truth quality label.
3. **A/B prompt testing** — run eval with `--prompt-version A` and `--prompt-version B` by temporarily swapping the prompt in `openrouter.py`, then compare in the MLflow UI.
