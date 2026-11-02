# testing-domain.md — Test Case Exorcist

## Smell catalog (single source of truth)
#[[file:docs/smells.md]]

- Smell names, definitions, detection rules and fix names come from `docs/smells.md` only.
  Never invent a smell name or change a definition without updating that file first.
- Research lineage: Hauptmann et al. 2013 (7 smells) → Soares et al. 2023 (8 smells) →
  Soares 2024 (13 manual-test smells) → 2025 SLM study and 2026 Gemini study (same 7 smells).
- **We implement the 7 smells used in the 2025/2026 studies.** Tacit Knowledge, Long Test Steps,
  Hard-Coded Values and Test Clones are stretch goals.
- No keyword may be owned by two detectors (see "Keyword ownership" in `docs/smells.md`).

## Data model rules
- `TestCase { id, title, preconditions: string[], steps: Step[] }`
- `Step { index, action: string, verifications: string[], source }` — Ubuntu format: `<dt>` action, `<dd>` verification.
- Preconditions belong to the **test case**, not to a step.
- `Finding { caseId, stepIndex, field: 'action' | 'verification' | 'precondition', verificationIndex?, span?, smellName, ghostName, reason, confidence: 'rule' | 'llm' | 'hybrid', fixName, severity: 'normal' | 'low' }`
- `ReviewCandidate { caseId, stepIndex, smellName, hint }` — uncertain rule results passed to the LLM reviewer.
- `DetectionResult { findings, reviewCandidates, errors }` — the single output shape used by every interface.
- `fixName` uses the 2024 transformation names: Extract Conditional, Extract Action, Separate Actions,
  Extract Verification, Extract Ambiguity, Extract Precondition, Fill Verification.

## Data rules
- Use **only public or synthetic test cases**.
- Reference dataset: Ubuntu Manual Tests (Launchpad `ubuntu-manual-tests`). Check its license before
  committing any files; otherwise provide a download script.
- Benchmark: the 2026 study's labelled sample (103 steps, 15 cases) from Zenodo
  (https://doi.org/10.5281/zenodo.20549059), plus our own extra labels in `datasets/labelled.csv`.
- **Never use employer data, employer test cases, or internal company tools.**
- Small demo samples live in `datasets/samples/`.

## Detector rules
- Every detector in `packages/core/src/detectors/` must have Vitest unit tests with at least one
  smelly and one clean example, using the examples in `docs/smells.md`.
- Rule detectors run **before** the LLM reviewer; the LLM is only called for uncertain steps and
  Ambiguous Test checks.
- Research shows LLMs struggle with Misplaced Action/Verification/Precondition when given one
  sentence only, so the LLM prompt must include the whole test case (preconditions + all steps).

## Accuracy target
- Overall F1 ≥ 0.75 on the benchmark before shipping.
- References on the same 2026 sample: Gemini 3 F1 0.91, GPT-5.2 F1 0.82, Manual Test Sensei F1 0.66.
- A pre-commit hook re-runs a 30-step subset; fail if F1 drops below `bench/baseline.json`.

## Fix rules
- Fixes follow the transformations in `docs/smells.md`.
- Every fix is a **before/after diff**; nothing is overwritten without user approval.
- Fixes must not change the observable testing intent of the step.
