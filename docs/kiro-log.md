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
