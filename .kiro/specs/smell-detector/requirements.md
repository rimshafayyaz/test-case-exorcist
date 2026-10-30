# Spec: smell-detector

## Overview
The smell detector is the heart of `@exorcist/core`. Given a parsed test suite (a list of `Step` objects), it returns a list of `Finding` objects — one per detected smell — each pointing to an exact step and field with a one-sentence reason.

## Requirements

### Functional

1. **Detect all 7 smells** at the step level using rule-based detectors:
   - Ambiguous Test (Fog Wraith)
   - Conditional Test (Fork Spirit)
   - Eager Action (Hydra)
   - Misplaced Action (Wanderer)
   - Misplaced Precondition (Early Riser)
   - Misplaced Verification (Mixed Soul)
   - Unverified Action (Silent Ghost)

2. **Each finding must include:**
   - `stepIndex` — 0-based index of the step in the suite
   - `field` — which field contains the smell: `action`, `expectedResult`, or `precondition`
   - `smellName` — canonical name from `docs/smells.md`
   - `ghostName` — display name (e.g., "Fog Wraith")
   - `reason` — one sentence explaining why the step smells
   - `confidence` — `"rule"` for rule-based, `"llm"` for LLM-assisted findings

3. **Rule detectors run first**, without any LLM call, and must be synchronous.

4. **Steps flagged as uncertain** (configurable threshold) are escalated to the LLM reviewer (a separate spec), which returns findings in the same `Finding` shape.

5. **Detectors are composable**: `detectAll(steps)` runs all 7 detectors and merges results, deduplicating findings for the same step+field+smell.

6. **Public API** exposed from `packages/core/src/index.ts`:
   ```ts
   export { detectAll, detectSmell } from './detectors/index.js'
   export type { Step, Finding, SmellName } from './models/index.js'
   ```

### Data models

```ts
// packages/core/src/models/step.ts
export interface Step {
  index: number
  action: string
  expectedResult?: string
  precondition?: string
}

// packages/core/src/models/finding.ts
export type SmellName =
  | 'AmbiguousTest'
  | 'ConditionalTest'
  | 'EagerAction'
  | 'MisplacedAction'
  | 'MisplacedPrecondition'
  | 'MisplacedVerification'
  | 'UnverifiedAction'

export type FieldName = 'action' | 'expectedResult' | 'precondition'
export type Confidence = 'rule' | 'llm'

export interface Finding {
  stepIndex: number
  field: FieldName
  smellName: SmellName
  ghostName: string
  reason: string
  confidence: Confidence
}
```

### Non-functional

- All 7 rule detectors must run on 1,000 steps in < 500 ms (no LLM calls).
- Each detector file is independently testable with no external dependencies.
- Detectors import only from `packages/core`; no web/CLI/MCP imports.
- TypeScript strict mode; no `any`.

## Acceptance criteria

1. `detectAll([])` returns `[]` without error.
2. Each detector correctly identifies its smell in at least one smelly example and correctly passes at least one clean example (verified by Vitest unit tests).
3. `detectAll` called with a mixed suite returns findings only for smelly steps.
4. Two findings with the same `stepIndex + field + smellName` are deduplicated to one.
5. All 7 smells have corresponding test files in `packages/core/tests/detectors/`.
