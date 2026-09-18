# EchoVault — long-term ML roadmap

> Opinionated, phased plan for turning EchoVault from a single-shot card
> generator into a self-improving personal learning system. Each phase builds
> on the previous one's data and infrastructure. Don't skip ahead — Phase 2
> is worthless without Phase 1's signal.

---

## Phase 0 — Seed (now, weeks 1–4)

**Goal:** get real data flowing.

- Run baseline eval (`make eval + make judge --prompt-version baseline`)
- Use the product daily; let `feedback.jsonl` and `review-events.jsonl` grow
- Merge `feature/agent-first-generation` once the backtest passes

**Exit criteria:** ≥ 50 accepted cards, ≥ 2 weeks of review events.

---

## Phase 1 — Retrieval-augmented generation (1–3 months)

**What:** before generating, retrieve relevant context — not just "do I already
have a card about this?" but "what concepts near this note are undertested?"

### 1a. Vector store for cards
`tools/embeddings.py` already computes embeddings on demand. Add a persistent
local store (FAISS or `chromadb` — both zero-infra) so the generator doesn't
re-embed on every call.

```
backend/app/tools/vector_store.py
  upsert_card(card_id, embedding)   # called when card is accepted
  search(query_embedding, top_k)    # called as @agent.tool
  delete(card_id)                   # called when card is retired
```

The generator's `similar_cards` tool shifts from re-embedding each time to
a fast ANN lookup. At 1000 cards this already matters; at 5000 it's necessary.

### 1b. Coverage map
Track which concepts in a note already have cards and which are dark.

```
tools/coverage.py
  covered_concepts(note_path) → list[str]  # topics with ≥1 card
  uncovered_sections(note_path) → list[str]  # paragraphs with no card
```

Wire into the generator prompt: "these sections already have cards — focus
on the uncovered parts." This directly addresses the most common generation
failure (repeating concepts that already have good cards).

### 1c. `agents/gap_finder.py`
Weekly proactive scan (HANDOFF step 8). Finds:
- Notes linked to by many others but thin on cards (prerequisite gaps)
- Cards with `easinessFactor` < 1.8 after ≥3 reviews (card is too hard → rephrase)
- Notes that have changed significantly (high diff) but haven't been processed

Runs as a scheduled job, surfaces a digest to the plugin sidebar.

**ML angle:** this is the first feedback loop — gap_finder uses SM-2 outcomes
(from `review-events.jsonl`) to drive what gets regenerated.

---

## Phase 2 — Preference data + fine-tuning (3–6 months)

**Prerequisite:** ≥ 500 accepted cards, ≥ 200 explicit edits, ≥ 6 weeks of reviews.

**Goal:** replace the general-purpose generator model with a fine-tuned version
that generates in your style, at your difficulty level, for your domain.

### 2a. Dataset construction
Three signal sources, combined:

| Source | Label | How |
|---|---|---|
| `feedback.jsonl` accepted cards | positive | (note, card) pairs where `decision == accepted` and not heavily edited |
| `feedback.jsonl` rejected cards | negative | same structure, `decision == rejected` |
| `feedback.jsonl` edited cards | weak positive + edit target | original card as rejected, edited card as accepted |
| `review-events.jsonl` | quality signal | cards with `quality ≥ 4` on first review = strong positive |

Export script: `backend/fine_tuning/build_dataset.py`
- Input: `feedback.jsonl` + `review-events.jsonl` + `flashcards.json`
- Output: JSONL of `{prompt, chosen, rejected}` triples (for DPO) or `{prompt, completion}` pairs (for SFT)

### 2b. Training method — DPO first, SFT as fallback
**DPO (Direct Preference Optimization)** is the right choice here:
- Directly trains on (accepted, rejected) card pairs — exactly what you have
- No reward model needed
- Works on models as small as 7B

Framework: `trl` (Hugging Face) with a 7B base (Qwen3-7B or Llama-3.1-8B).
Training infra: local GPU (your setup) or Modal/RunPod for a one-off run.

If DPO is unstable (small dataset), fall back to **SFT on accepted cards only**
as a baseline — simpler but ignores the rejection signal.

### 2c. Evaluation before shipping
Use the same `evals/` harness (structural + judge + dedup) against the
fine-tuned model with `--prompt-version ft-v1`. The fine-tuned model only ships
if it beats the OpenRouter baseline on `avg_overall` and `mcq_ratio`.

**Cost case:** at 50 cards/week, a fine-tuned local 7B model breaks even with
OpenRouter costs within 2–3 months of use.

---

## Phase 3 — Self-improving loop (6–9 months)

**What:** the system detects its own failures and schedules regeneration without
prompting.

### 3a. Card retirement + regeneration
Add `retire_card` and `update_card` tools to the orchestrator (deferred from
HANDOFF step 5). Triggered by:
- `easinessFactor` < 1.6 after ≥ 5 reviews (card is consistently failed)
- User explicitly edits a card → old version archived, new version is the gold label
- gap_finder detects the source note has changed substantially

### 3b. Active learning selection
Not all notes are equal worth processing. A simple scorer:
- `change_magnitude` — how large was the diff? (already in manifest)
- `link_centrality` — how many other notes link here? (from link_graph.py)
- `card_staleness` — how long since cards were generated, vs. how much has changed?
- `review_weakness` — average easiness of existing cards for this note

The generator runs on the highest-scoring notes first when processing a batch,
rather than sequential file order.

### 3c. Difficulty calibration
The SM-2 easiness factor is a direct signal for card difficulty. Once you have
~3 months of reviews:

- Cluster cards by easiness trajectory (consistently easy / volatile / hard)
- Feed this back to the generator: "previous cards for this note were too easy
  (avg EF 2.9) — generate harder questions"
- Adjust `max_cards` budget dynamically: notes that produce low-retention cards
  get more cards generated (more angles on the same concept)

---

## Phase 4 — Personalized model (9–12 months)

**What:** a model that knows your domain, your difficulty preference, and your
knowledge gaps — not just "good flashcards" in general.

### 4a. Continued fine-tuning on accumulated data
At 6–12 months you'll have thousands of (note, card, outcome) triples. Re-run
the DPO fine-tune on the full dataset. The model's priors now reflect your
actual learning outcomes, not general flashcard quality.

### 4b. Concept graph generation
By this point `link_graph.py` has enough traversal data to build a sparse
concept dependency graph. Use it to:
- Generate "prerequisite check" cards (quiz concept A before introducing B)
- Detect and surface orphan concepts — topics in your notes with no outward
  links (either a gap or a terminal node worth reinforcing)
- Route gap_finder's proactive suggestions by dependency depth, not just
  link count

### 4c. Self-hosted inference
A fine-tuned 7B model running locally via **Ollama** or **vLLM** costs nothing
per call, runs offline, and is faster than OpenRouter for small batches.

At this point the backend's `OpenAIProvider` `base_url` is just a config
change — the whole inference stack is swappable because PydanticAI is already
abstracting it.

---

## ML systems engineering summary

| Phase | Technique | Why it matters here |
|---|---|---|
| 1 | ANN vector store (FAISS/Chroma) | Fast duplicate detection at scale |
| 1 | Coverage map | First feedback loop — data-driven card targeting |
| 2 | DPO fine-tuning | Personalized card style + difficulty without human labeling |
| 2 | Dataset construction from implicit signals | SM-2 outcomes as preference labels |
| 3 | Active learning selection | Maximise review ROI per note processed |
| 3 | Difficulty calibration from SM-2 | Closes the generation→review→generation loop |
| 4 | Concept dependency graph | Curriculum structure, not just individual cards |
| 4 | Self-hosted inference (Ollama/vLLM) | Operationalises the fine-tuned model |

---

## What to ignore (for now)

- **Transformer-from-scratch card generation** — the LLM already handles this;
  the leverage is in the data pipeline and fine-tuning, not architecture.
- **Multi-user / shared card libraries** — EchoVault's value is personal context.
  A shared deck loses the groundedness signal.
- **Exotic retrieval** (ColBERT, HyDE, etc.) — standard embedding similarity is
  sufficient until the card corpus exceeds ~10k cards. Flag this for Phase 2
  re-evaluation.
- **RL from human feedback (RLHF)** — DPO achieves the same goal without a
  separate reward model. RLHF only makes sense if the preference signal becomes
  rich enough to train a reliable reward model (probably not at personal scale).
