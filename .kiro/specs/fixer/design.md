# Design Document

## Overview

```
packages/core/src/fixers/
  index.ts               proposeFix, proposeFixes, applyFix, exorciseSuite, caseToText, self-check
  text.ts                sentence helpers (clean connectors, capitalise, full stop, renumber)
  separateActions.ts     Eager Action
  extractVerification.ts Misplaced Verification
  extractAction.ts       Misplaced Action
  extractPrecondition.ts Misplaced Precondition
  fillVerification.ts    Unverified Action
  extractConditional.ts  Conditional Test
```

Each transformation is `(testCase, finding) => { after, summary, needsInput } | { reason }`. `proposeFix` dispatches on `finding.fixName`, deep-copies the input, and adds the self-check by running `detectAll` on `[before]` and on `after`.

The transformations reuse the detectors' own analysis so fix and detection always agree: `findActions` (Eager Action), `segment` (clause offsets), `isStateClause` (Misplaced Precondition) and the finding's `span`.

## Interfaces

```ts
interface FixCheck { resolved: boolean; introduced: Partial<Record<SmellName, number>> }

interface FixProposal {
  fixName: FixName; smellName: SmellName; caseId: string; stepIndex: number
  summary: string; before: TestCase; after: TestCase[]; needsInput: string[]; check: FixCheck
}

type FixOutcome = { ok: true; proposal: FixProposal } | { ok: false; finding: Finding; reason: string }
```

## Decisions

- **Proposals, not edits:** the UI shows `caseToText(before)` vs `caseToText(after)`; `applyFix` runs only after the user accepts.
- **Placeholders are visible:** missing expected results become `TODO: …` text and `needsInput` entries, never invented results.
- **Self-check counts per smell**, because steps move and renumber; comparing counts is robust where comparing step indexes is not. A finding that remains only on text copied unchanged from another step still counts as resolved: the fix exposed an existing problem (e.g. removing step 1 makes step 2 the first step). Found by the property-based test P3.
- **Self-check uses the first result case.** Extract Conditional's second case ("without the conditional step") only holds steps copied unchanged from `before`; counting it would count existing smells twice. Found by the property-based test P3.
- **Compound gestures start at their first verb.** "press and hold" is one action that starts at "press", so Separate Actions cuts before "press". Found by the property-based test P3.
- **Extract Verification moves every check in the action**, not only the first one, using the detector's own `findChecks`. Found by the property-based test P3.
