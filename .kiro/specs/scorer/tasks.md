# Implementation Plan

- [x] 1. Implement the scorer
  - `packages/core/src/scorer/index.ts`: `scoreSuite`, `gradeFor`, types `Grade`, `SuiteScore`, `CaseScore`
  - Tests: empty suite → 100/A; all clean → 100/A; one normal finding in 10 steps → 90/A; one low finding in 4 steps → 94/A; three findings on one step count once; grade boundaries 90/89/80/79/70/69/60/59; review candidates do not lower the score; per-case scores in suite order; worstSmell
  - _Requirements: 1.1–1.6, 2.1–2.3_

- [x] 2. Export the public API
  - Export `scoreSuite`, `gradeFor`, `SuiteScore`, `CaseScore`, `Grade` from `packages/core/src/index.ts`; test through the entry point with the smells fixture (`datasets/samples/smells-fixture.json`)
  - _Requirements: 3.1_
