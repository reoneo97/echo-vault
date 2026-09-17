# EchoVault eval plan

> Living document. Update it when a phase ships, when a metric proves useless,
> or when user behaviour reveals a new signal worth capturing.

## Philosophy

Evals here are not a CI gate — they're a feedback loop. The goal is to know,
over time, whether changes to the generation pipeline actually improve the cards
you remember. That means combining three signals:

1. **Structural** — can the backend even produce well-formed cards?
2. **LLM-as-judge quality** — does an independent model rate them highly?
3. **User behaviour** — do *you* accept, edit, and retain them?

Signal 3 is the only one that matters long-term. Signals 1 and 2 exist because
signal 3 takes weeks to accumulate. Start with 1 and 2, build toward 3.

---

## What is already instrumented

| Signal | Where it lives | Backend? |
|---|---|---|
| Card acceptance / rejection / edit | `feedback.jsonl` via `/feedback` | ✅ |
| Edit diffs (question/answer before→after) | `feedback.jsonl` | ✅ |
| Per-card SM-2 quality ratings | `flashcards.json` reviewHistory | ❌ local only |
| Daily review aggregate (reviewed, correct, avgRating) | `review-log.json` | ❌ local only |
| Structural card metrics (type ratios, malformed rate) | `run_eval.py` → MLflow `echovault-evals` | ✅ on demand |
| LLM judge scores (clarity, groundedness, etc.) | `judge.py` → MLflow `echovault-evals` | ✅ on demand |
| Per-generation MLflow traces (token counts, latency) | `observability.py` autolog | ✅ live |

**Gaps that matter for real use:**
- `feedback.jsonl` entries lack a `card_id`, making it impossible to join user
  acceptance with judge scores for the same card.
- Per-card SM-2 ratings never reach the backend, so retention signal is dark.

Both gaps are fixed as part of this plan (see Phase 2).

---

## Eval tiers

### Tier 1 — Structural (already done)
**Script:** `make eval`  
**What it measures:** card format validity, type distribution (MCQ/TF/QA ratios),
malformed rates (null correct_answer, duplicate options, etc.), generation latency.  
**When to run:** before and after any change to the generator prompt or model.  
**Pass bar:** `malformed_card_rate < 0.05`, `mcq_ratio > 0.50`, `tf_ratio > 0.15`.

### Tier 2 — LLM-as-judge quality (already done)
**Script:** `make judge`  
**What it measures:** question_clarity, answer_quality, distractor_quality,
groundedness, cognitive_level distribution — scored 1–5 by a separate judge model.  
**When to run:** any prompt or model change; monthly baseline snapshot.  
**Pass bar:** `avg_groundedness ≥ 3.5`, `avg_question_clarity ≥ 3.5`,
`cognitive_ratio_recall < 0.60` (shift away from rote recall).

### Tier 3 — User acceptance (Phase 2, this week)
**Data source:** `feedback.jsonl` with `card_id` added.  
**What it measures:** acceptance rate per source note, per card type, per judge
quality tier. The key question: *do high judge scores predict user acceptance?*  
**Script:** `evals/acceptance_eval.py` (to be written).  
**Pass bar:** acceptance rate for judge-score ≥ 4 cards should exceed acceptance
rate for score ≤ 2 cards by at least 20 percentage points. If it doesn't, the
judge criteria need revisiting.

### Tier 4 — Retention signal (Phase 3, ~2 weeks in)
**Data source:** `/review-events` endpoint (per-card SM-2 quality ratings streamed
from plugin).  
**What it measures:** cards that score quality ≥ 4 on first review → what
fraction score ≥ 3 on the third review? (a proxy for genuine learning).  
**Script:** `evals/retention_eval.py` (to be written once data accumulates).  
**Pass bar:** retention rate (quality ≥ 3 at review 3) > 70% for accepted cards.

### Tier 5 — Critic precision (Phase 4, after Tier 4 baseline)
**Data source:** MLflow traces (critic_rejected metric) + feedback.jsonl.  
**What it measures:** of the cards the critic rejected, what fraction would the
user also have rejected? (critic precision) And what fraction of accepted cards
did the critic also approve? (critic recall).  
**Pass bar:** critic precision > 80%, recall > 70%. If precision is low, the
critic rubric thresholds are too aggressive.

---

## The eval loop

```
week 0:  run baseline (make eval + make judge --prompt-version baseline)
         → commit results to MLflow, tag the run

week 1+: use the product for real. plugin sends feedback + review events.

monthly: run make eval + make judge --prompt-version current
         compare to baseline in MLflow Experiments tab
         if avg_overall drops > 0.3: investigate before any new changes

as feedback accumulates (≥50 accepted cards):
         run acceptance_eval.py
         check: does judge score predict acceptance?

after 2 weeks of reviews:
         run retention_eval.py
         check: are reviewed cards sticking?
```

---

## Plugin logging requirements

### Now (Phase 2 — implemented this week)

**`card_id` in feedback entries**
Every `CardFeedbackEntry` must include the card's stable store `id` so feedback
can be joined with judge scores and future retention data.

**Per-card review events sent to backend**
After each card is rated in a review session, a lightweight event is sent to
`/review-events`. This unblocks Tier 4 analysis without waiting for a full
export of `flashcards.json`.

Shape:
```json
{
  "card_id": "abc123",
  "source_note": "notes/ML.md",
  "card_type": "mcq",
  "quality": 4,
  "reviewed_at": "2026-09-17T14:32:00Z",
  "interval_days": 3,
  "repetition_number": 2
}
```

### Later (Phase 3 — once the above is stable)

- **Edit diff quality**: when a card is edited, capture what changed (question,
  answer, or both) — already stored in feedback.jsonl but not yet analysed.
- **Batch review sync**: after a review session, sync all cards reviewed today
  including their full SM-2 state — useful for drift detection (cards whose
  easiness factor has dropped below 1.8 are probably too hard or poorly worded).

---

## Running evals

```bash
# Step 1: make sure backend is running
make up

# Step 2: structural + latency (no extra LLM cost)
make eval ARGS="--prompt-version <tag>"

# Step 3: LLM judge quality (uses judge model, costs tokens)
make judge ARGS="--input /tmp/echovault_eval_output.json --prompt-version <tag>"

# View results
# → http://mlflow.reoneo.dev  Experiments → echovault-evals

# Backtest (compare baseline vs current once new pipeline is live)
make eval ARGS="--prompt-version agent-first"
make judge ARGS="--input /tmp/echovault_eval_output.json --prompt-version agent-first"
# Then compare both runs in MLflow side-by-side
```

---

## Fixture notes

Live in `evals/fixtures/standard/`. These are the notes used for every eval run.
Keep them representative of your actual vault — update them when your note-taking
style changes, and bump the `version` field in `fixtures/manifest.json` when you do.
The `fixture_set_hash` logged by each eval run detects silent fixture changes.

---

## Open questions

- **Critic precision**: only measurable once the new pipeline has been running
  for ≥2 weeks and user feedback has accumulated. Don't tune the rubric before then.
- **Judge model alignment**: does `qwen/qwen3-8b` agree with your personal
  judgment? Run `make judge` on a batch of cards you've already rated and compare.
  If agreement is < 70%, switch to a stronger judge model or revise the rubric.
- **Fixture coverage**: the current 5-note fixture set is thin. Add notes from
  domains you actually study (ML, systems, etc.) to make eval results more
  predictive of real performance.
