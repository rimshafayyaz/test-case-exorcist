# Benchmark with the LLM reviewer (gemini-3.5-flash-lite)

Human-labelled sample, 103 items. Same scoring as bench/README.md.

| | Precision | Recall | F1 |
|---|---|---|---|
| Rules only | 0.92 | 0.72 | **0.81** |
| Rules + LLM reviewer (8 questions: 6 confirmed, 2 rejected, 0 failed) | 0.91 | 0.77 | **0.83** |
| Rules + LLM reviewer + Ambiguous sweep (86 more questions) | 0.77 | 0.83 | **0.80** |
| Gemini 3 alone (study data) | 0.92 | 0.91 | **0.91** |

## Per smell (rules + reviewer + sweep)

| Smell | F1 rules | F1 with LLM |
|---|---|---|
| AmbiguousTest | 0.54 | 0.63 |
| ConditionalTest | 0.93 | 0.88 |
| EagerAction | 0.84 | 0.87 |
| MisplacedAction | 0.80 | 0.80 |
| MisplacedPrecondition | 0.92 | 0.92 |
| MisplacedVerification | 0.71 | 0.71 |
| UnverifiedAction | 0.94 | 0.94 |

## Held-out test half (agreement with Gemini 3, silver standard)

| | Precision | Recall | F1 |
|---|---|---|---|
| Rules only | 0.89 | 0.74 | **0.81** |
| Rules + LLM reviewer (90 questions) | 0.88 | 0.79 | **0.83** |

Note: the silver standard is Gemini 3 output and the reviewer is also a Gemini model, so agreement here may be higher than with human labels.
