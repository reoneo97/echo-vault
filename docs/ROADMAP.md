# EchoVault — measurement & improvement roadmap

What the empty-looking `evals/`, `backend/experiments/`, and `backend/fine_tuning/`
directories are actually for — their real status, not just the wishlist. See
`docs/EVAL.md` for the full evaluation design; this page is the map across all
three, plus the parts that are just future plans.

## `evals/` — built, in active use

Not aspirational — this is the real, working evaluation harness: structural
metrics, LLM-as-judge scoring (clarity, answer quality, distractor quality,
groundedness, cognitive-level), embedding-based duplicate detection, and a
historical backtest built from real production logs. See `evals/README.md` for
commands (`make eval` / `make judge` / `make dedup` / `make backtest`) and
`docs/EVAL.md` for the three-layer design (structural → LLM-judge → human/SM-2
signal) and the key decisions behind it (judge model selection, rubric design,
single-annotator reasoning).

## `backend/experiments/` — mostly superseded, kept as a placeholder

This directory (`prompt_variants/`, `results/`) predates `evals/`. Its original
intent — A/B testing prompts and tracking which produces better cards — is now
**actually delivered** by `evals/`: `--prompt-version` tagging + MLflow already
gives you exactly that comparison (`make eval ARGS="--prompt-version v2"` vs
`baseline`, compared in the MLflow UI). There isn't a second, separate
"experiments framework" left to build here.

**Still open**, if this directory gets used for something in the future:
- A **prompt regression test suite** — golden fixtures with expected
  qualitative properties, run automatically to catch a prompt change silently
  degrading output (distinct from the interactive `make eval`/`judge` flow).
- Storing actual **prompt variant snapshots** side by side (the raw prompt
  text per version) for human review — `run_eval.py` already logs the prompt
  text as an MLflow artifact per run, so this would only add value as a
  quick-diff view across versions without opening MLflow.

Until one of those becomes a real need, treat `backend/experiments/` as
inactive — reach for `evals/` first.

## `backend/fine_tuning/` — real future work, not started

Genuinely forward-looking, building on `docs/EVAL.md`'s Layer 3 design (human
signal via `feedback.jsonl` + SM-2 review outcomes). The path, in order:

1. **Training data collection** — export high-quality cards as labeled
   examples: accepted (not rejected/heavily-edited) in `feedback.jsonl`, and/or
   cards with strong SM-2 retention (`easinessFactor` > ~2.5, several
   successful reviews) as an implicit "this card was good" signal.
2. **Dataset preparation** — convert `(note_content, card)` pairs into a
   fine-tuning format (prompt/completion or chat-style), with rejected cards
   as negative examples if the target training method supports contrastive
   data.
3. **Train a smaller, faster model** on the resulting dataset — the actual
   fine-tune.
4. **Cost/quality comparison** — benchmark the fine-tuned model against the
   current OpenRouter-hosted model using the same `evals/` harness (structural
   + judge + dedup), so this has the same before/after rigor as any other
   pipeline change, not a separate one-off comparison.

This depends on `feedback.jsonl` accumulating enough real accept/reject/edit
decisions to be worth training on — not a near-term priority, but the plan is
concrete when it becomes one.

## Where this fits with the agent-first redesign

The second-brain repo's `docs/echo-vault-redesign.md` (agent-first card
generation, replacing single-shot extraction) is a separate, larger change —
see that doc for its own design + build order. This page is scoped to the
measurement/evaluation side specifically.
