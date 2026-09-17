# EchoVault card quality rubric

Used by the runtime critic (`agents/critic.py`) and the offline judge (`evals/judge.py`).
If you change criteria here, bump the version line below and re-register the MLflow prompts.

**Version:** 1.0

## Criteria (each scored 1–5)

### question_clarity
Is the question specific, unambiguous, and tests genuine understanding rather than trivial recall?
- 1 = vague, trivial, or unanswerable without context
- 3 = acceptable — clear enough, tests something real
- 5 = precise and thought-provoking; a student must understand the concept to answer

### answer_quality
Is the answer/explanation accurate, clear, and faithful to the source note?
- 1 = wrong or missing key information
- 3 = acceptable — correct with minor gaps
- 5 = clear, accurate, and well-explained

### distractor_quality (MCQ only — null for other types)
Are the wrong choices plausible but clearly incorrect on reflection?
- 1 = obviously wrong, partially correct, or a superset of the correct answer
- 3 = acceptable distractors — require some thought
- 5 = excellent distractors drawn from peer-level concepts in the notes

### groundedness
Is the answer/explanation supported by the source note — not general knowledge added by the model?
- 1 = not supported by the source (possibly hallucinated)
- 3 = mostly supported with minor unsupported detail
- 5 = fully and precisely grounded in the source text

## Cognitive level (classification, not a score)

What kind of thinking does this card actually test?

- **recall**: asks to state a fact/definition verbatim or near-verbatim from the source
- **application**: asks how a concept would be used/chosen in a scenario, not just what it is
- **mechanism**: asks WHY or HOW something works, not just that it exists
- **connection**: relates two or more concepts/notes to each other

Goal: shift the distribution away from recall-only towards mechanism and connection.

## Verdict thresholds (critic policy)

A card is **rejected** if any of:
- `question_clarity` < 2
- `answer_quality` < 2
- `groundedness` < 2
- `distractor_quality` < 2 (MCQ only)

A card is flagged for **improvement** if any applicable score is 2 or 3.
A card is **approved** if all applicable scores are ≥ 4.
