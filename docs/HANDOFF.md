# Handoff — EchoVault agent-first rework

> For the agent picking up this work. Read this first, then `docs/harness-design.md`.

## What we're building
Turn EchoVault's single-shot `flashcard_agent` into a **generator → critic**
pipeline with **on-demand tools**, gated by an **evals backtest**. Not "adopt an
agent framework" — the backend already runs **PydanticAI** (`flashcard_agent =
Agent(...)` in `openrouter.py`), and **Logfire tracing is already wired**
(`observability.py`). This is turning one agent into a few, with tools.

## Read first (in order)
1. `docs/harness-design.md` — the concrete build plan (modules, call flow, build
   order §6, open decisions §7). **Authoritative for how.**
2. second-brain `docs/echo-vault-redesign.md` + `ADR-014` — the why/what
   (principles; source of truth).
3. Skim `openrouter.py`, `routes.py`, `schemas.py`, `observability.py`,
   `evals/judge.py` to see what exists.

## Current state (2026-09-16, branch `feature/agent-first-generation`)
- ✅ Step 2 retrieval tools **drafted**: `backend/app/tools/embeddings.py`
  (`similar_cards`), `tools/link_graph.py` (`related_notes`).
- ❌ **Step 1 `tools/card_store.py` + manifest is MISSING** — the foundation
  everything reads/writes. The drafted tools sit on a store that doesn't exist yet.
- ❌ No `agents/` dir (generator/critic/orchestrator), no `rubric.md`.

## Build order (from harness-design.md §6)
1. **`tools/card_store.py` + manifest** ← **START HERE.** Read/write
   `notes/EchoVault/` cards + manifest; replaces git-checkpoint diffing.
2. Finish/review `tools/embeddings.py` + `tools/link_graph.py` against the real store.
3. `agents/generator.py` — evolve `flashcard_agent`: attach tools, richer prompt.
4. `agents/critic.py` + shared `rubric.md` — **separate agent, separate `CRITIC_MODEL`**.
5. `agents/orchestrator.py` — chain generator → critic; wire into `routes.py`.
6. **Backtest via `evals/`** (old baseline vs new) — the **ship gate**, not a courtesy.
7. second-brain `mcp/echo.py` — thin client (out of this repo).
8. `agents/gap_finder.py` — **LAST**, weekly proactive pass.

## Non-negotiable principles
- **Contract unchanged:** `routes.py`'s `/generate-flashcards-batch` signature and
  the response shape stay the same — **zero Obsidian-plugin changes**. Orchestrator
  is internal.
- **Critic is a genuinely separate `.run()`** with a **different model family** than
  the generator (same rule as `evals/judge.py`) — avoids self-approval bias.
- **Tools are dumb `@agent.tool` pipes** the generator calls **on-demand**
  mid-reasoning — not a fetch-everything-up-front step.
- **One shared `rubric.md`** read by both `critic.py` (runtime) and `judge.py`
  (eval) so criteria don't drift (backend + evals are separate `uv` projects — no
  Python import between them).
- **Don't trust the pipeline until the evals backtest beats the old baseline.**

## Working conventions
- Stay on **`feature/agent-first-generation`** (don't commit to `main`/`dev`).
- **Don't commit on the user's behalf** without asking; creating/editing files is fine.
- Keep changes reviewable; update `docs/harness-design.md` if the design shifts.

## Open decisions (harness-design.md §7 — confirm with Reo before locking)
- `CRITIC_MODEL` choice; confirm-before-write vs digest-only (leaning digest);
  `retire_card`/`update_card` now or with `gap_finder`; explicit two-call
  orchestrator vs PydanticAI agent-delegation (leaning explicit).

## Definition of done (reactive pipeline, steps 1–6)
A generation request runs generator (with tools) → separate critic → writes
approved cards, same response shape, per-step Logfire traces, and the evals
backtest shows the new pipeline ≥ the old baseline on the shared rubric.
