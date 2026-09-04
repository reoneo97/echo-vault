# EchoVault Eval Design

This document covers what a proper evaluation framework for EchoVault looks like, the key design decisions that shape it, and the tooling options available at each layer.

---

## Why evals matter here

EchoVault generates flashcards from unstructured notes using an LLM. The quality of output is subjective and hard to measure automatically — there is no ground truth label telling you whether a generated MCQ question is good. This makes it a classic **generative AI evaluation problem**: you need a principled way to measure quality so you can iterate on the prompt without regressing.

Without evals, every prompt change is a guess. With evals, you can quantify: "version 2 improved distractor quality by 0.4 points and didn't reduce card volume."

---

## The three layers of evaluation

A complete eval for EchoVault has three layers, each measuring something the previous layer cannot.

### Layer 1 — Structural metrics (offline, free)

Measures properties of the output that can be computed without human judgement or a second LLM call.

**What to measure:**
- Card type distribution (`mcq_ratio`, `tf_ratio`, `qa_ratio`)
- Card volume (`total_cards`, `cards_per_file`)
- Question and answer length (proxy for specificity and depth)
- Failure rate (`failed_files`, `judge_errors`)
- Generation latency

**What it catches:**
- Prompt regressions that cause the LLM to generate all Q&A and no MCQ
- Changes that reduce card volume (prompt became too conservative)
- Latency regressions

**What it misses:**
- Whether the cards are actually good
- Whether distractors are plausible
- Whether the answer is faithful to the source

**Implementation:** `run_eval.py` — already built.

---

### Layer 2 — LLM-as-judge (offline, costs tokens)

Uses a second LLM call to score each card against a rubric. This is the current state of the art for evaluating generative outputs at scale without human annotation.

**What to measure:**
- `question_clarity` — is the question specific and unambiguous?
- `answer_quality` — is the answer faithful to the source note?
- `distractor_quality` — are MCQ distractors plausible but clearly wrong?
- `mcq_answer_is_explanation` — does the MCQ answer field explain *why*, not just repeat the correct option?

**Key design decisions:**

**1. Judge model selection**
The judge model must be at least as capable as the generation model, ideally more so. Using the same model to judge its own outputs introduces self-preference bias — a model will rate its own phrasing patterns higher than equivalent alternatives. Options:

| Model | Cost | Quality | Self-bias risk |
|---|---|---|---|
| Same model as generator | Free (already paying) | Medium | High |
| `qwen/qwen3-8b` (current) | Very cheap | Medium | Low |
| `claude-sonnet-4-6` | Medium | High | None |
| `gpt-4o` | Medium | High | None |

**Recommendation:** Use a different model family than the generator. Claude Sonnet is a good judge for outputs from Qwen models.

**2. Rubric design**
The rubric is the single most important part of the judge. A vague rubric produces inconsistent scores that aren't actionable. Each criterion needs:
- A clear definition of what 1, 3, and 5 mean
- Concrete examples of good and bad
- No ambiguity about what "correct" means

Poor rubric: *"Is this a good question? Score 1-5."*

Better rubric:
```
question_clarity (1-5):
  1 = could be answered without reading the source note, or has multiple correct answers
  3 = specific enough, but the correct answer could be debated
  5 = tests a precise concept from the source, one unambiguously correct answer
```

**3. Temperature**
Judge calls should use temperature 0.0–0.1. Higher temperature introduces randomness that makes scores unreliable across runs. You want the same card to score the same way every time.

**4. Source grounding**
Always pass the source note content to the judge. Without it, the judge cannot verify whether the answer is faithful. Truncate to ~1500 tokens to stay within context limits while preserving the key content.

**5. Output format**
Ask for structured JSON output only. Unstructured prose is hard to parse reliably. Use a strict schema:
```json
{"question_clarity": 4, "answer_quality": 3, "distractor_quality": null, "reasoning": "one sentence"}
```

**6. Positional bias**
LLM judges tend to score items that appear first in a prompt higher. For MCQ distractor evaluation, shuffle the options before sending to the judge.

**Implementation:** `judge.py` — already built.

---

### Layer 3 — Human signal (online, delayed)

The most reliable quality signal, but it only accumulates through real usage. Two sources:

**Explicit:** staging panel decisions — accept, reject, edit, type change. Stored in `feedback.jsonl`.

**Implicit:** SM-2 review scores. Cards that consistently score 0–2 (Again/Hard) are bad cards — either the question is ambiguous, the answer is wrong, or the distractor was misleading. Cards rated 4–5 consistently are good cards.

**What this enables (long term):**
- Compute acceptance rate per prompt version as ground-truth quality
- Build a labelled dataset: `(note_content, card)` → `accepted/rejected`
- Use rejected cards as negative few-shot examples in the prompt
- Eventually: fine-tune a small model on accepted cards

**Key design decision — annotation consistency:**
The staging panel is a single user (you). This is actually an advantage: your annotations are consistent. A multi-annotator setup needs inter-annotator agreement metrics (Cohen's kappa); single-annotator is simpler and more coherent for a personal tool.

---

## Key design decisions summary

### 1. What is the test set?

**The hardest decision in eval design.** The test set determines what the eval actually measures.

| Option | Pros | Cons |
|---|---|---|
| Fixed fixtures (current) | Reproducible, free, no vault access needed | Doesn't reflect your actual notes |
| Sample of your real notes | Reflects real usage | Changes over time as you add notes |
| Held-out set (notes never used for prompting) | True generalisation test | Hard to maintain, vault is small |

**Recommendation:** use a frozen snapshot of 10–20 representative notes from your vault as the eval set. Pick notes from different topics and lengths. Never include these notes in prompt few-shot examples. Re-run with the same set every time.

### 2. What is the reference (gold standard)?

Currently there is no gold standard — the judge scores cards against the rubric, but there's no "perfect card" to compare against. Two approaches to add one:

**Option A — Human-written reference cards**
For each fixture note, write 2–3 "ideal" cards by hand. Score the LLM output against these using semantic similarity. High similarity = the LLM is generating the right things.

**Option B — Acceptance rate as proxy**
After enough real usage, cards from a specific prompt version have an acceptance rate. Use this as the quality score. Version 1: 72% acceptance. Version 2: 81% acceptance. No human reference needed.

Option B is more scalable and doesn't require upfront labelling effort.

### 3. Offline vs. online evaluation

| | Offline eval | Online eval |
|---|---|---|
| When | Before shipping prompt changes | After real usage accumulates |
| Signal | LLM judge scores | Human accept/reject rates |
| Speed | Fast (minutes) | Slow (days/weeks) |
| Cost | Tokens per run | Free (already happening) |
| Reliability | Medium | High |

**Use both.** Offline eval for fast iteration on prompt changes. Online eval (acceptance rate from `feedback.jsonl`) as the ground truth that validates whether offline improvements translated to real quality.

### 4. Evaluation cadence

Running the judge on every prompt change is the right habit. The eval should be cheap enough to run in <5 minutes. Current bottleneck is the per-card judge API call — batching or caching identical cards across runs would help.

---

## Tooling options

### Experiment tracking

| Tool | Hosting | Strengths | Weaknesses |
|---|---|---|---|
| **MLflow** (current) | Self-hosted | Open source, full control, model registry | UI is dated, no built-in LLM eval tooling |
| **Weights & Biases** | SaaS | Excellent UI, LLM eval features, traces | Paid for teams |
| **Langsmith** | SaaS | LLM-native, built-in prompt versioning | LangChain-centric |
| **Comet ML** | SaaS/self-hosted | Good LLM support | Less commonly used |

For EchoVault, MLflow is the right choice — it's already running, self-hosted, and the experiments are simple enough that the UI limitations don't matter.

### LLM evaluation frameworks

These sit between your eval scripts and the judge LLM, providing structured rubrics, caching, and aggregation:

| Tool | What it adds |
|---|---|
| **RAGAS** | Purpose-built for RAG eval: faithfulness, answer relevance, context recall. Some metrics apply to flashcard generation (faithfulness to source). |
| **DeepEval** | General LLM eval framework with pre-built metrics (G-Eval, hallucination, conciseness). Integrates with pytest. |
| **Promptfoo** | Prompt A/B testing focused. Runs multiple prompts against the same inputs and compares. Good for prompt iteration specifically. |
| **LangSmith Evals** | Tight LangChain integration, annotation queues for human review. Overkill without LangChain. |

**Recommendation for EchoVault:** `DeepEval` is worth adding. Its `GEval` metric lets you define a custom rubric in natural language and handles the judge call, parsing, and aggregation. It would replace the manual judge logic in `judge.py` with something more robust and tested.

### Prompt versioning

Currently prompt versions are just string labels (`--prompt-version v2`). More structured options:

| Approach | What it gives you |
|---|---|
| **String labels + MLflow params** (current) | Simple, works |
| **Git tags on backend** | Ties prompt version to exact code state |
| **Promptfoo config files** | Declarative prompt variants, automatic A/B comparison |
| **LangSmith Hub** | Versioned prompt registry with pull-by-version |

Git tags is the simplest upgrade — tag the repo when you run an eval so you can always reconstruct what prompt produced a given run.

---

## Current state vs. target state

| Component | Current state | Target state |
|---|---|---|
| Structural metrics | ✅ `run_eval.py` | Add `mcq_answer_repetition` score |
| LLM judge | ✅ `judge.py` (basic) | Improve rubric, switch to Claude Sonnet as judge |
| Test set | ⚠️ 3 generic fixtures | 10–20 frozen notes from real vault |
| Gold standard | ❌ None | Acceptance rate from `feedback.jsonl` |
| Online eval | ⚠️ Data collected, not computed | Script to compute acceptance rate per prompt version |
| Prompt versioning | ⚠️ String labels only | Git tags tied to eval runs |
| Human annotation | ⚠️ Stored in `feedback.jsonl` | Joined back to eval runs for ground-truth validation |

---

## Recommended next steps

1. **Add your own notes as fixtures** — pick 10 representative notes from your vault, freeze them as the eval set. This is the single highest-leverage change to make evals meaningful.

2. **Add `mcq_answer_repetition` to `run_eval.py`** — cheap proxy for whether MCQ answers are explanations vs. repetitions. Directly relevant to the current prompt change being considered.

3. **Build the acceptance rate script** — read `feedback.jsonl`, group by the commit hash or timestamp range that corresponds to a prompt version, compute acceptance/edit/rejection rates. This closes the loop between offline eval and real usage.

4. **Upgrade the judge model** — switch from `qwen3-8b` to `claude-sonnet-4-6` for judging. More reliable scores, especially for distractor quality which requires nuanced reasoning.
