# EchoVault Tutor — design & extension plan

> A Socratic conversational agent that reads the user's SM-2 flashcard store
> and review history to identify weak areas, then tests and discusses them in
> natural dialogue. The goal is to improve retention beyond what passive
> card review achieves, by forcing active recall and concept connections.

---

## Current implementation (shipped)

**Endpoint:** `POST /tutor/chat`

**Request:**
```json
{
  "session_id": "20260919-143022",
  "message": "I want to review my weak cards",
  "history": [
    {"role": "user",    "content": "..."},
    {"role": "assistant","content": "..."}
  ]
}
```

**Response:**
```json
{
  "session_id": "20260919-143022",
  "reply": "Let's look at attention mechanisms — you've failed those 3 times recently...",
  "cards_referenced": ["card-abc123"],
  "assessment": "none",
  "topic": "attention"
}
```

**Agent tools:**
| Tool | What it reads | Used for |
|---|---|---|
| `get_weak_cards` | `flashcards.json` (EF < 2.1) | What to focus on |
| `get_recent_review_failures` | `review-events.jsonl` (quality < 3) | What's been hard lately |
| `get_card_by_id` | `flashcards.json` | Full card text when needed |

**Session state:** Stateless server-side. Client sends full `history` on every call
(last 10 turns used for context). Keeps the server simple and makes sessions
resumable after restart.

**MLflow:** `echovault-tutor` experiment. One trace per `/tutor/chat` call,
tagged with `session_id`, `topic`, `assessment`, `component: tutor`.

---

## Planned extensions

### v2 — Difficulty targeting

Right now the tutor picks from EF < 2.1 cards. A better selection policy:

```python
def select_cards_for_session(cards, review_events, n=5):
    """Score each card and pick the top-n to focus on this session."""
    scores = {}
    for card in cards:
        ef = card["easinessFactor"]
        reps = card["repetitions"]
        recent_fails = sum(
            1 for e in review_events
            if e["card_id"] == card["id"] and e["quality"] < 3
        )
        # Lower EF + more recent failures = higher priority
        scores[card["id"]] = (2.5 - ef) * 2 + recent_fails
    return sorted(cards, key=lambda c: scores[c["id"]], reverse=True)[:n]
```

Add a `max_cards_per_session` setting (default 5) so sessions are focused.

### v3 — Session persistence

Currently history is client-side only. For the plugin sidebar view, add
server-side session storage:

```
backend/logs/tutor-sessions.jsonl
  { "session_id": "...", "timestamp": "...", "turns": [...], "topics": [...] }
```

New endpoint: `GET /tutor/sessions?limit=10` — lets the plugin show recent
tutor conversation history.

### v4 — Proactive session suggestions

The `gap_finder` agent (HANDOFF step 8) already scans for weak cards and
stale notes. Wire it into the tutor: when gap_finder identifies a concept
gap, pre-seed a tutor session with those cards so the user gets a focused
review rather than a cold start.

### v5 — Retention tracking

After each tutor session, record a synthetic "tutor review" event in
`review-events.jsonl` (quality 4 if the user got it right in conversation,
quality 2 if they struggled). This feeds the SM-2 algorithm without
requiring a formal card review, and builds training data for Phase 2
DPO fine-tuning (tutor conversations as preference pairs).

### v6 — Plugin sidebar integration

A new `TutorPanel` component in the Obsidian sidebar:
- Text input + send button (like a chat UI)
- Shows `cards_referenced` highlighted in the panel
- `assessment` badge (✓ correct / ≈ partial / ✗ incorrect)
- "Open note" link from `topic` to the source note

This is the highest-leverage UX improvement: brings the tutor into the
same workflow as review, rather than requiring a separate API call.

---

## Three MLflow experiments

| Experiment | What goes there | Set by |
|---|---|---|
| `echovault-cards` | Live card generation traces | `routes.py` at batch request start |
| `echovault-cards-evals` | Eval harness runs (structural + judge + dedup) | `evals/run_eval.py`, `evals/judge.py` |
| `echovault-tutor` | Tutor conversation traces | `agents/tutor.py` tutor_chat() |

**Filtering within an experiment:** all traces are tagged with `session_id`,
`note_slug` (or `topic` for tutor), and `component`. Filter in the MLflow
Traces tab by `component = generator` vs `component = critic` vs `component = tutor`.

---

## Open questions

- Should the tutor use a cheaper/faster model than the generator? DeepSeek V4
  Flash (the critic model) would work — the tutor prompt is simpler than card
  generation. Adds a `tutor_model` config field.
- How long should tutor session history be kept? 10 turns is conservative —
  could go to 20 for longer concept explorations.
- Should the tutor suggest new cards for gaps it discovers? A natural extension:
  if the user can't answer a question that doesn't have a card yet, flag it for
  generation. Links tutor back into the card-creation loop.
