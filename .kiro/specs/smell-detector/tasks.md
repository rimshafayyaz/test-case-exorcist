# Tasks: smell-detector

## Task 1 — Bootstrap packages/core
- [ ] Init pnpm workspace at repo root (`pnpm-workspace.yaml`)
- [ ] Scaffold `packages/core` with `package.json`, `tsconfig.json` (strict), `vitest.config.ts`
- [ ] Install `compromise` and `vitest` as dependencies
- [ ] Create `packages/core/src/models/step.ts`, `finding.ts`, `index.ts`

## Task 2 — Unverified Action detector (simplest; no NLP)
- [ ] Implement `packages/core/src/detectors/unverifiedAction.ts`
- [ ] Write `packages/core/tests/detectors/unverifiedAction.test.ts`
  - smelly: step with no expectedResult
  - clean: step with a non-empty expectedResult

## Task 3 — Conditional Test detector
- [ ] Implement `packages/core/src/detectors/conditionalTest.ts` (regex)
- [ ] Write tests: smelly ("If the popup appears, close it"), clean ("Click the popup close button")

## Task 4 — Misplaced Verification detector
- [ ] Implement `packages/core/src/detectors/misplacedVerification.ts` (regex on action)
- [ ] Write tests: smelly ("Verify the total is 100"), clean ("Enter the total as 100")

## Task 5 — Misplaced Action detector
- [ ] Implement `packages/core/src/detectors/misplacedAction.ts` (compromise POS on expectedResult)
- [ ] Write tests: smelly (expectedResult: "Click OK"), clean (expectedResult: "The dialog closes")

## Task 6 — Misplaced Precondition detector
- [ ] Implement `packages/core/src/detectors/misplacedPrecondition.ts` (regex)
- [ ] Write tests: smelly ("Make sure the user is logged in"), clean ("Log in as admin")

## Task 7 — Ambiguous Test detector
- [ ] Build vague-word list in `packages/core/src/detectors/wordLists.ts`
- [ ] Implement `packages/core/src/detectors/ambiguousTest.ts`
- [ ] Write tests: smelly ("Check the page works properly"), clean ("Check the page title is 'Dashboard'")

## Task 8 — Eager Action detector
- [ ] Implement `packages/core/src/detectors/eagerAction.ts` (compromise verb count)
- [ ] Write tests: smelly ("Open settings, change language and save"), clean ("Open settings")

## Task 9 — detectAll + deduplication
- [ ] Implement `packages/core/src/detectors/index.ts` with `detectAll` and `deduplicate`
- [ ] Write `packages/core/tests/detectors/detectAll.test.ts`
  - empty input → `[]`
  - mixed suite → findings only on smelly steps
  - duplicate finding (same stepIndex+field+smellName) → deduplicated to one

## Task 10 — Public API
- [ ] Implement `packages/core/src/index.ts` with the public exports
- [ ] Verify `pnpm -F @exorcist/core test` passes all tests
- [ ] Confirm 1,000-step run completes in < 500 ms (add a simple perf test or note)
