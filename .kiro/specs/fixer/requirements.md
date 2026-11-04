# Requirements Document

## Introduction

The fixer proposes a research-defined transformation (docs/smells.md, "Fix") for each finding and shows it as a before/after change. It never changes a test without the user's approval (product.md): it returns proposals, and `applyFix` is only called after the user accepts one. Every proposal is **self-checked**: the detectors run again on the result to prove the target smell is gone and to report any smell the change introduced. It is pure, synchronous and makes no network calls.

Rule-based fixes cover 5 of the 7 smells. Extract Ambiguity (choosing a measurable value) and conditions outside the simple "If X, Y" shape need the LLM reviewer (spec `llm-reviewer`); for those the fixer returns an explained "not supported" outcome instead of guessing.

Out of scope: LLM-written fixes, the diff UI (spec `haunted-ui`) and storing accepted fixes.

## Requirements

### Requirement 1 — Proposals

**User Story:** As a QA engineer, I want a concrete before/after proposal for each smell, so that I can accept or reject it.

#### Acceptance Criteria

1. WHEN `proposeFix` receives a test case and one of its findings THEN the system SHALL return either `{ ok: true, proposal }` or `{ ok: false, reason }`; it SHALL NOT throw for any finding.
2. WHEN a proposal is returned THEN it SHALL contain `fixName`, `smellName`, `caseId`, `stepIndex`, a one-sentence `summary`, the unchanged `before` test case, the resulting `after` test cases (one, or two for Extract Conditional) and `needsInput` (things the tester still has to write).
3. WHEN a fix is proposed THEN the input test case SHALL NOT be modified.
4. WHEN steps are added or removed THEN the steps of the resulting test case SHALL be renumbered consecutively from the first step's original index.
5. WHEN text is moved THEN no word of the original step SHALL be lost, except connectors ("and", "then") and the phrases "make sure" / "ensure that" that the transformation removes.

### Requirement 2 — Rule-based transformations

1. **Separate Actions (Eager Action):** split the action into one step per action. The original verifications SHALL go to the last new step; the other new steps SHALL get no verification and an entry in `needsInput`.
2. **Extract Verification (Misplaced Verification):** move the check (from the matched word to the end of the check) to the start of the step's verifications, keeping any following action in the action. "make sure" / "ensure that" SHALL be removed from the moved text. WHEN nothing is left in the action AND a previous step exists THEN the moved text and the step's verifications SHALL be appended to the previous step's verifications and the step SHALL be removed.
3. **Extract Action (Misplaced Action):** move the action clause out of the verification into a new step inserted after the current step. The rest of that verification (if any) SHALL stay. The new step SHALL get an entry in `needsInput` for its expected result.
4. **Extract Precondition (Misplaced Precondition):** move every state clause (and, for prerequisite wording, the clause holding the word) of the first step to the test case preconditions. WHEN nothing is left in the action THEN the step SHALL be removed and its verifications SHALL be added to the preconditions.
5. **Fill Verification (Unverified Action):** add a clearly marked placeholder verification ("TODO: …") naming the action, with an entry in `needsInput`. The placeholder SHALL still count as missing (smell-detector Req 9.3), so `check.resolved` is false and `exorciseSuite` does not apply it: the score only improves when the tester writes the real expected result.
6. **Extract Conditional (Conditional Test):** for an action of the form "If/When/In case X, Y" or "Y if/when X", return two test cases: one with X added as a precondition and the step reduced to Y, and one without the conditional step and the steps after it (omitted when it would have no steps).
7. WHEN the smell is Ambiguous Test, OR the condition uses "unless", "otherwise", "whether" or "depending on", OR the finding is in a verification THEN the system SHALL return `{ ok: false, reason }` naming the LLM reviewer.

### Requirement 3 — Self-check

**User Story:** As a QA engineer, I want proof that a fix removes the smell, so that I can trust the tool.

1. WHEN a proposal is returned THEN it SHALL include `check.resolved`: true when the number of findings for the target smell in `after` is lower than in `before`.
2. WHEN a proposal is returned THEN it SHALL include `check.introduced`: the smells whose finding count increased, with the increase.

### Requirement 4 — Applying fixes

1. WHEN `applyFix(suite, proposal)` is called THEN the system SHALL return a new suite in which the case `proposal.caseId` is replaced by `proposal.after`, keeping the order of the other cases, without modifying the input suite.
2. WHEN `exorciseSuite(suite)` is called THEN the system SHALL repeatedly apply the first resolving proposal of each case until no rule-based fix resolves a finding (at most 50 rounds per case) and SHALL return the new suite and the list of applied proposals.
3. WHEN `caseToText(testCase)` is called THEN the system SHALL return a stable plain-text form (title, preconditions, numbered steps with their verifications) for diff views.

### Requirement 5 — Public API

1. WHEN another package imports `@exorcist/core` THEN it SHALL be able to use `proposeFix`, `proposeFixes`, `applyFix`, `exorciseSuite`, `caseToText` and the types `FixProposal`, `FixOutcome` and `FixCheck`.
