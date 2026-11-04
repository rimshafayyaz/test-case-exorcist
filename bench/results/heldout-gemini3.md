# Held-out check — agreement with Gemini 3 (silver standard)

Gemini 3 labels are predictions (F1 0.91 against the human labels on the sample), not ground truth.

| Test cases | Cases | Items | Precision | Recall | F1 (agreement) |
|---|---|---|---|---|---|
| Sample (seen while tuning) | 21 | 160 | 0.88 | 0.66 | **0.75** |
| Held-out, all | 80 | 2464 | 0.89 | 0.73 | **0.80** |
| Held-out, dev half (may be used for tuning) | 40 | 1180 | 0.89 | 0.71 | **0.79** |
| **Held-out, test half (never looked at)** | 40 | 1284 | 0.89 | 0.74 | **0.81** |

## Per smell, test half

| Smell | Gemini 3 labels | TP | FP | FN | Precision | Recall | F1 |
|---|---|---|---|---|---|---|---|
| AmbiguousTest | 210 | 79 | 28 | 131 | 0.74 | 0.38 | 0.50 |
| ConditionalTest | 97 | 90 | 5 | 7 | 0.95 | 0.93 | 0.94 |
| EagerAction | 267 | 179 | 8 | 88 | 0.96 | 0.67 | 0.79 |
| MisplacedAction | 60 | 48 | 13 | 12 | 0.79 | 0.80 | 0.79 |
| MisplacedPrecondition | 8 | 6 | 13 | 2 | 0.32 | 0.75 | 0.44 |
| MisplacedVerification | 141 | 109 | 20 | 32 | 0.84 | 0.77 | 0.81 |
| UnverifiedAction | 278 | 271 | 7 | 7 | 0.97 | 0.97 | 0.97 |
