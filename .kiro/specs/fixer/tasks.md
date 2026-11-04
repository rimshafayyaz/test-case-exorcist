# Implementation Plan

- [x] 1. Models and text helpers
  - `FixProposal`, `FixOutcome`, `FixCheck` types; `fixers/text.ts` (clean connectors, capitalise, full stop, renumber steps, deep copy)
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 2. Separate Actions, Extract Verification, Extract Action
  - Tests with the docs/smells.md examples; check `resolved` and word preservation
  - _Requirements: 2.1, 2.2, 2.3, 1.5_

- [x] 3. Extract Precondition, Fill Verification, Extract Conditional, unsupported outcomes
  - _Requirements: 2.4, 2.5, 2.6, 2.7_

- [x] 4. Dispatcher, self-check, applyFix, exorciseSuite, caseToText
  - Test: exorcising the smells fixture raises its grade and never throws
  - _Requirements: 1.1, 3.1, 3.2, 4.1–4.3_

- [x] 5. Property-based tests (fast-check)
  - For generated steps: proposeFix never throws, never mutates its input, keeps every non-connector word, and every rule-based proposal for a confident finding resolves it
  - _Requirements: 1.1, 1.3, 1.5, 3.1_

- [x] 6. Public API
  - Export from `packages/core/src/index.ts`; test through the entry point
  - _Requirements: 5.1_
