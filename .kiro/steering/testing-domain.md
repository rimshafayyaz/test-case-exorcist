# testing-domain.md — Test Case Exorcist

## Domain knowledge rules
- Smell names and definitions come from **`docs/smells.md` only**.
  Never invent a smell name or change a definition without updating that file first.
- The canonical smell list is the 7 smells from Soares et al. 2023
  (https://arxiv.org/abs/2308.01386) and the 2026 Gemini study
  (https://arxiv.org/html/2606.13804).

## Data rules
- Use **only public or synthetic test cases**.
- The reference public dataset is the Ubuntu manual test cases
  (same dataset used by Manual Test Sensei and the 2026 study).
- **Never use employer data, employer test cases, or internal company tools.**
- Sample files live in `datasets/samples/`; the labelled benchmark is `datasets/labelled.csv`.

## Detector rules
- Every detector in `packages/core/src/detectors/` must have Vitest unit tests.
- Each test file must contain **at least one smelly example and one clean example**.
- Rule detectors must run **before** the LLM reviewer; LLM is only called for ambiguous/uncertain steps.
- A `Finding` must include: `stepIndex`, `field` (`action` | `expectedResult` | `precondition`),
  `smellName`, `reason` (one sentence), `confidence` (`rule` | `llm`).

## Accuracy target
- Overall F1 ≥ 0.75 on the labelled benchmark before shipping.
- Pre-commit hook re-runs a 30-step subset; fails if F1 drops below baseline.
- Reference baseline: Manual Test Sensei F1 0.66 (different sample — not a head-to-head).

## Fix rules
- Fixes come from the transformation catalog (2024 paper: https://arxiv.org/pdf/2404.16992).
- Every fix is a **before/after diff**; the original step is never overwritten automatically.
- Fixes must not change the observable testing intent of the step.
