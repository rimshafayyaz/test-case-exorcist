# Kiro Log — Test Case Exorcist

Track of every Kiro-assisted action: date, feature, what Kiro did, notes/screenshots.
Used for the Kiroween 2026 write-up.

---

## 2026-10-30

### Session 1 — Project context & steering setup

**Feature:** Steering docs + smell-detector spec

**What Kiro did:**
- Read the project plan (now `docs/project-brief.md`) to set up steering and specs.
- Created `.kiro/steering/product.md` — product rules and positioning.
- Created `.kiro/steering/tech.md` — TypeScript strict, package layout, LLM caching rules.
- Created `.kiro/steering/structure.md` — full repo layout + naming conventions.
- Created `.kiro/steering/testing-domain.md` — domain rules, data policy, accuracy targets.
- Created `.kiro/specs/smell-detector/requirements.md` — functional requirements, data models, acceptance criteria.
- Created `.kiro/specs/smell-detector/design.md` — detector strategies (7 smells), file layout, deduplication.
- Created `.kiro/specs/smell-detector/tasks.md` — 10 tasks from bootstrap to public API.
- Created `docs/kiro-log.md` (this file).
- Made first commit: "Add project context and steering".

**Notes:** All code must start from today (Oct 30) per Kiroween eligibility rules.
`.kiro/` is not gitignored so steering, specs, and hooks are all tracked.

## 2026-11-02

### Session 2 — Spec review and gap fixes

**Feature:** smell-detector spec hardening

**What Kiro did:**
- Note: the smell-detector spec was redrafted on Nov 2 from the research notes (outside Kiro) to match Kiro's spec format and the new data model; Kiro then reviewed and refined it.
- Reviewed smell-detector spec against `docs/smells.md` and `testing-domain.md`.
- 15 gaps identified; 6 rejected as stale (on-disk spec already had the correct models); 9 accepted; 2 added by user (navigation verbs word list, tie-break tests).

**Changes applied:**

`docs/smells.md`
- Keyword ownership table: split verification-verb row to separate "make sure"/"ensure that" with tie-break rule; split "when" out of subordinating conjunctions with confident-vs-review-candidate nuance; added Navigation verbs row (owned by Unverified Action low-severity exception).
- Conditional Test detection note: "when" as time reference → review candidate only.
- Unverified Action detection note: expanded with navigation-verb list and `severity: "low"` wording.

`testing-domain.md`
- `Finding` type: added `severity: 'normal' | 'low'`.

`requirements.md`
- Introduction: listed four stretch smells (Long Test Steps, Hard-Coded Values, Test Clones, Tacit Knowledge) as out of scope.
- Req 2.1: added `verificationIndex` and `severity` fields.
- Req 2.4: required `src/smells.ts` to mirror `docs/smells.md`; detectors must import from it.
- Req 7.2: added "make sure"/"ensure that" + state description in first step → Misplaced Precondition.
- Req 8.2: added tie-break — "make sure"/"ensure that" + state in first step → Misplaced Precondition, not Misplaced Verification.
- Req 9: added AC 9.3 (navigation exception → `severity: "low"`) and AC 9.4 (reason wording).
- Req 11.1: stated LLM reviewer retrieves full TestCase via caseId; ReviewCandidate does not duplicate case data.

`design.md`
- `Finding` type: added `severity: 'normal' | 'low'`.
- Detector table: updated `misplacedPrecondition` (added "make sure"/"ensure that" + state in first step), `misplacedVerification` (excluded that first-step case), `unverifiedAction` (added navigation-verb → `severity: "low"` row).

`tasks.md`
- Task 1–3, 5–11: added "Add a line to docs/kiro-log.md" sub-step.
- Task 4: added navigation-exception test ("Open the browser." → severity low, reason notes may be intentional).
- Task 6: added tie-break tests ("Make sure the user is logged in." as step 3 → Misplaced Verification; "Ensure the total is 100." → Misplaced Verification).
- Task 8: added tie-break test ("Make sure the user is logged in." as step 1 → Misplaced Precondition only).
- Task 11: added tie-break ownership test (step-1 case produces exactly one finding).
- Task 12: added preconditions[] fixture requirement; assert precondition text is never flagged; noted Zenodo benchmark belongs to the separate benchmark spec.

## 2026-11-03

### Session 3 — Workspace bootstrap

**Feature:** smell-detector task 1

**What Kiro did:**
- 2026-11-03 · smell-detector task 1 · Set up pnpm workspace, @exorcist/core package with TypeScript strict mode, Vitest, and compromise dependency
- Created `pnpm-workspace.yaml` (packages/*, apps/*; allowBuilds esbuild).
- Created root `package.json` with build/test/lint workspace scripts and Node ≥20 / pnpm ≥9 engines.
- Created `tsconfig.base.json` with strict mode, ES2022, NodeNext modules.
- Created `packages/core/package.json` (`@exorcist/core`, ESM, compromise 14.14.3, vitest 3.2.4, typescript 5.8.3).
- Created `packages/core/tsconfig.json` extending base, `packages/core/vitest.config.ts`.
- Created `packages/core/src/index.ts` and `packages/core/tests/index.test.ts` placeholder.
- Ran `pnpm install` and confirmed `pnpm -F @exorcist/core test` passes (1 test, 0 failures).

## 2026-11-03

### Session 3 — Data models and smell constants

**Feature:** smell-detector task 2

**What Kiro did:**
- Created `packages/core/src/models/index.ts` — exports `SmellName`, `FixName`, `TestSuite`, `TestCase`, `Step`, `Finding` (with `severity`), `ReviewCandidate`, `DetectionResult`.
- Created `packages/core/src/smells.ts` — `SMELLS` record and `ALL_SMELL_NAMES` array; ghost names and fix labels mirror `docs/smells.md` exactly; `SmellMeta` type exported.
- Updated `packages/core/src/index.ts` to re-export all types and smell constants.
- Created `packages/core/tests/models.test.ts` — 8 tests verifying every `SmellName` has a ghost name, fix label and typed fix name matching `docs/smells.md`.
- All 9 tests pass (including pre-existing VERSION test).

## 2026-11-03

### Session 4 — Text utilities

**Feature:** smell-detector task 3

**What Kiro did:**
- 2026-11-03 · text-utilities · Built splitClauses, tag, isImperativeStart, findWords and wordLists; verified compromise tag names; all unit tests pass
- Created `packages/core/src/text/wordLists.ts` — 12 named constants covering all keyword ownership groups from `docs/smells.md` (verification verbs, subordinating conjunctions + phrases, navigation verbs + phrases, outcome words, prerequisite words, vague words, indefinite determiners, indefinite pronouns, manner adverbs, make-sure tie-break phrases).
- Created `packages/core/src/text/utils.ts` — `tag()` (compromise wrapper with character offsets), `splitClauses()` (splits on sentence ends, semicolons, commas, "and"/"then"), `isImperativeStart()` (Imperative tag + Verb+Infinitive fallback, excludes Modal/Auxiliary), `findWords()` (case-insensitive whole-word + phrase matching with Span offsets).
- Created `packages/core/src/text/index.ts` — re-exports all utilities and word lists.
- Updated `packages/core/src/index.ts` to re-export text layer.
- **Compromise tag discovery:** `term.tags` in `doc.json()` is an array of strings (e.g. `["Verb", "Imperative"]`), not a Record — confirmed via probe script. Confirmed tag names: Imperative, Verb, Infinitive, Auxiliary, Modal, PastTense, Comparative, Adverb, Determiner, Conjunction, Adjective, Noun.
- Created `packages/core/tests/text/wordLists.test.ts` — 16 tests: non-empty checks, exact values from smells.md, keyword ownership (no word in two lists, Req 10.2).
- Created `packages/core/tests/text/utils.test.ts` — 44 tests: all utility functions with smelly/clean examples, offset accuracy (Req 2.2), edge cases (empty, punctuation, mixed case).
- All 69 tests pass; TypeScript strict mode clean.

## 2026-11-03

### Session 5 — Unverified Action detector

**Feature:** smell-detector task 4

**What Kiro did:**
- 2026-11-03 · smell-detector task 4 · Implemented Unverified Action detector (Silent Ghost) with navigation exception and full unit tests; all 94 tests pass
- Created `packages/core/src/detectors/types.ts` — `DetectorContext` (with `nextStep?: Step` for navigation exception), `DetectorOutput` and `Detector` shared types.
- Created `packages/core/src/detectors/unverifiedAction.ts` — reports `UnverifiedAction` with `field: "verification"` when a step has no non-empty verification; applies navigation-exception logic (step starts with a navigation verb and next step has ≥1 verification → `severity: "low"`, reason notes missing verification may be intentional; all other unverified steps → `severity: "normal"`).
- Created `packages/core/tests/detectors/unverifiedAction.test.ts` — 16 unit tests covering: smelly (no verifications), clean (has verification), whitespace-only verifications treated as missing, navigation exception for single-word verbs (open, launch) and multi-word phrases (go to, navigate to, switch to), case-insensitive matching, last-step edge case, next-step-unverified edge case, and caseId/stepIndex propagation.
- All 94 tests pass; TypeScript strict mode clean, no diagnostics.

## 2026-11-03

### Session 6 — Conditional Test detector

**Feature:** smell-detector task 5

**What Kiro did:**
- 2026-11-03 · smell-detector task 5 · Implemented Conditional Test detector (Fork Spirit) with "when" tie-break; all 118 tests pass
- Created `packages/core/src/detectors/conditionalTest.ts` — inspects both `step.action` and each `step.verifications[i]`; reports `ConditionalTest` / "Fork Spirit" with `confidence: 'rule'`, `severity: 'normal'`, `fixName: 'ExtractConditional'`.
- Subordinating conjunctions (`if`, `whether`, `unless`, `otherwise`) and multi-word phrases (`in case`, `depending on`) → confident finding via whole-word, case-insensitive regex.
- "when" tie-break: if the word immediately before "when" is a time-reference verb (`note`, `record`, `notice`, `observe`, `watch`, `wait`) → ReviewCandidate; if the first word after "when" is a personal pronoun (`you`, `i`, `we`, …) or a determiner (`the`, `a`, `an`) without a time-reference verb before "when" → confident finding.
- Fixed reason string: "Step contains conditional logic; different testers may follow different paths." (10 words ≤ 25, Req 2.3).
- Created `packages/core/tests/detectors/conditionalTest.test.ts` — 21 unit tests: all 6 canonical smelly/clean examples, "when" condition vs. time-reference distinction, verification-field detection with `verificationIndex`, simultaneous action+verification findings, case-insensitive matching, finding shape validation, and Req 2.3 reason-length guard.
- All 118 tests pass; TypeScript strict mode clean.

- Task 12 · smell-detector spec · Created datasets/samples/smells-fixture.json (8 cases: one per smell + one clean) and packages/core/tests/integration/fixture.test.ts (integration tests asserting exact findings, clean case, preconditions ignored).
