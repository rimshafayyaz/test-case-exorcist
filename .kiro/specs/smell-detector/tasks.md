# Implementation Plan

- [ ] 1. Set up the workspace and the core package
  - Create `pnpm-workspace.yaml`, root `package.json` scripts (`build`, `test`, `lint`) and `tsconfig.base.json` with strict mode
  - Create `packages/core` with `package.json` (`@exorcist/core`, ESM), `tsconfig.json`, `vitest.config.ts`
  - Install `compromise` and dev dependencies `vitest`, `typescript`
  - Add one placeholder test and confirm `pnpm -F @exorcist/core test` passes
  - _Requirements: 12.3, 13.1_
  - Add a line to `docs/kiro-log.md`

- [ ] 2. Define the data models and smell constants
  - Create `src/models/` with `TestSuite`, `TestCase`, `Step`, `Finding`, `ReviewCandidate`, `DetectionResult`, `SmellName`, `FixName`
  - Create `src/smells.ts` with ghost names and fix names exactly as in `docs/smells.md`
  - Add a test that every `SmellName` has a ghost name and fix name
  - _Requirements: 2.1, 2.4_
  - Add a line to `docs/kiro-log.md`

- [ ] 3. Build the text utilities
  - Implement `splitClauses`, `tag` (compromise wrapper with character offsets), `isImperativeStart`, `findWords`
  - Create `wordLists.ts` (vague words, verification verbs, prerequisite words, outcome words, subordinating conjunctions) from `docs/smells.md`
  - Verify compromise tag names against its docs; unit-test each utility
  - _Requirements: 2.2, 10.2_
  - Add a line to `docs/kiro-log.md`

- [ ] 4. Implement the Unverified Action detector
  - `src/detectors/unverifiedAction.ts`: report when a step has no non-empty verification
  - Tests: smelly "Click Save." with no verification; clean "Click Save." with "A 'Saved' message appears."; whitespace-only verification counts as missing
  - Test (navigation exception): step `action: "Open the browser."` with no verification, immediately followed by a step with a non-empty verification → finding with `severity: "low"` and a reason that notes the missing verification may be intentional
  - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - Add a line to `docs/kiro-log.md`

- [ ] 5. Implement the Conditional Test detector
  - Subordinating-conjunction match in actions and verifications; "when" without a condition becomes a review candidate
  - Tests: "If you have a USB drive, plug it in." (smelly), "Unless the dialog closes, press Esc." (smelly), "Plug the USB drive into a free port." (clean)
  - _Requirements: 4.1, 4.2, 11.1_
  - Add a line to `docs/kiro-log.md`

- [ ] 6. Implement the Misplaced Verification detector
  - Verification verb anywhere in the action (excluding "make sure"/"ensure that" + state description in the first step), or "should" / "must be displayed"
  - Tests: "Close flip and check app continuity.", "Verify the total is 100.", "The menu should appear." (smelly); "Close the flip." (clean)
  - Tie-break tests: "Make sure the user is logged in." as step 3 → Misplaced Verification only (not Misplaced Precondition); "Ensure the total is 100." in any step → Misplaced Verification
  - _Requirements: 8.1, 8.2_
  - Add a line to `docs/kiro-log.md`

- [ ] 7. Implement the Misplaced Action detector
  - Verification clause starting with a non-verification imperative verb; ambiguous verb/noun starts become review candidates
  - Tests: verification "Click OK to continue." (smelly); "The confirmation dialog closes." and "Verify the dialog closes." (clean)
  - _Requirements: 6.1, 6.2, 11.1_
  - Add a line to `docs/kiro-log.md`

- [ ] 8. Implement the Misplaced Precondition detector
  - First step only: subject + auxiliary + past participle, or prerequisite words, or "make sure"/"ensure that" + state description
  - Tests: "The monitor is not connected, and the PC is not paired." and "The user is already logged in." as step 1 (smelly); same text as step 3 (not reported); "Log in as the admin user." (clean)
  - Tie-break test: "Make sure the user is logged in." as step 1 → Misplaced Precondition only (not Misplaced Verification)
  - _Requirements: 7.1, 7.2, 7.3_
  - Add a line to `docs/kiro-log.md`

- [ ] 9. Implement the Eager Action detector
  - Count clauses that start with an imperative verb; ≥ 2 → finding with the count in the reason
  - Tests: "Open settings, change language and save." (3 actions), "Close flip and reopen the app." (2 actions); "Open settings." (clean)
  - _Requirements: 5.1, 5.2_
  - Add a line to `docs/kiro-log.md`

- [ ] 10. Implement the Ambiguous Test detector
  - Vague-word list → finding; POS-only patterns (verb + indefinite determiner, indefinite pronoun, comparative/superlative, manner adverb) → review candidate
  - Tests: "Check the page loads quickly." (smelly), "Open any application and suspend machine." (review candidate); "The page loads within 2 seconds." (clean)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 11.1_
  - Add a line to `docs/kiro-log.md`

- [ ] 11. Implement the orchestrator
  - `detectAll` and `detectSmell` in `src/detectors/index.ts`: run all detectors with try/catch, dedupe, drop duplicate review candidates, sort
  - Tests: empty suite → empty result; detector error is recorded and others still run; duplicates removed; keyword-ownership test ("Verify the total is 100." only gives Misplaced Verification); tie-break ownership test ("Make sure the user is logged in." as step 1 produces exactly one finding: Misplaced Precondition)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 10.1, 11.2_
  - Add a line to `docs/kiro-log.md`

- [ ] 12. Add fixtures and the integration test
  - `datasets/samples/smells-fixture.json`: one test case per smell plus one clean test case (synthetic text and the paper examples)
  - The fixture MUST include at least one `TestCase` with a non-empty `preconditions[]`; assert that precondition text is never returned as a finding (detectors only inspect steps)
  - Note: accuracy measurement on the labelled benchmark (103 steps, 15 cases from Zenodo https://doi.org/10.5281/zenodo.20549059) is handled by the separate `benchmark` spec, not here
  - Integration test asserting the exact findings for the fixture
  - _Requirements: 1.1, 2.1, 2.3, 12.2_
  - Add a line to `docs/kiro-log.md`

- [ ] 13. Expose the public API and check performance
  - Export functions and types from `packages/core/src/index.ts`
  - Performance test: 1,000 generated steps in under 500 ms
  - Update `docs/kiro-log.md` with what was built and any decisions changed during implementation
  - _Requirements: 12.1, 13.1_
