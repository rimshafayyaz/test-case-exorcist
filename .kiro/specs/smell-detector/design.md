# Design: smell-detector

## Architecture

```
detectAll(steps: Step[]): Finding[]
  │
  ├─ ambiguousTest(step)    → Finding[]   (vague-word list + compromise POS)
  ├─ conditionalTest(step)  → Finding[]   (if/when/otherwise regex)
  ├─ eagerAction(step)      → Finding[]   (verb count / conjunction count)
  ├─ misplacedAction(step)  → Finding[]   (imperative verb in expectedResult)
  ├─ misplacedPrecondition(step) → Finding[]  (setup language in action field)
  ├─ misplacedVerification(step) → Finding[]  (verify/check/ensure in action)
  └─ unverifiedAction(step) → Finding[]   (empty/missing expectedResult)
  │
  └─ deduplicate(findings) → Finding[]
```

## Detector strategies

### 1. Ambiguous Test (Fog Wraith)
- **Field:** `action` and/or `expectedResult`
- **Signal:** vague words that allow multiple interpretations
- **Word list:** `properly`, `correctly`, `appropriately`, `works`, `normal`, `reasonable`,
  `sufficient`, `adequate`, `as expected`, `as required`, `suitable`, `relevant`,
  `appropriate`, `good`, `bad`, `quickly`, `slowly`
- **Rule:** if any vague word appears (case-insensitive whole-word match), emit a finding.
- **Uncertain path:** if the step has no vague words but compromise detects abstract nouns
  that could be ambiguous, flag for LLM review.

### 2. Conditional Test (Fork Spirit)
- **Field:** `action`
- **Signal:** branching keywords that imply two paths
- **Regex:** `/\b(if|when|in case|otherwise|else|depending on|or if)\b/i`
- **Rule:** any match → finding.

### 3. Eager Action (Hydra)
- **Field:** `action`
- **Signal:** multiple distinct actions in one step
- **Rule:** count imperative verbs via compromise POS (`VB` at start of clause) OR count
  coordinating conjunctions (`and`, `then`) joining verb phrases. If count ≥ 2 → finding.
- **Reason template:** `"Step contains N actions; split into separate steps."`

### 4. Misplaced Action (Wanderer)
- **Field:** `expectedResult`
- **Signal:** imperative verb at start of sentence (action written where a verification should be)
- **Rule:** tokenise `expectedResult`; if first token is tagged `VB` (base-form verb) by
  compromise and is not a verification verb (`verify`, `check`, `confirm`, `ensure`, `assert`,
  `validate`, `see`, `observe`) → finding.

### 5. Misplaced Precondition (Early Riser)
- **Field:** `action`
- **Signal:** setup/state language in an action step
- **Regex patterns:**
  - `/(make sure|ensure that|given that|assuming|prerequisite|precondition)/i`
  - First step of a suite AND action describes state rather than an action verb.
- **Rule:** any match → finding. LLM escalation if pattern is borderline.

### 6. Misplaced Verification (Mixed Soul)
- **Field:** `action`
- **Signal:** verification verb in the action field
- **Regex:** `/^(verify|check|ensure|assert|validate|confirm|observe|see)\b/i`
- **Rule:** any match → finding.

### 7. Unverified Action (Silent Ghost)
- **Field:** `expectedResult`
- **Signal:** missing or empty expected result
- **Rule:** `expectedResult` is `undefined`, `null`, or blank after trim → finding.
- No LLM escalation needed (structural check).

## File layout

```
packages/core/src/
  models/
    step.ts
    finding.ts
    index.ts          # re-exports
  detectors/
    ambiguousTest.ts
    conditionalTest.ts
    eagerAction.ts
    misplacedAction.ts
    misplacedPrecondition.ts
    misplacedVerification.ts
    unverifiedAction.ts
    index.ts          # detectAll + deduplicate
  index.ts            # public API

packages/core/tests/
  detectors/
    ambiguousTest.test.ts
    conditionalTest.test.ts
    eagerAction.test.ts
    misplacedAction.test.ts
    misplacedPrecondition.test.ts
    misplacedVerification.test.ts
    unverifiedAction.test.ts
    detectAll.test.ts
```

## Deduplication
Two findings are considered duplicates if `stepIndex`, `field`, and `smellName` all match.
Keep the first occurrence (rule findings are preferred over LLM findings).

## Dependency notes
- `compromise` for POS tagging (browser + Node compatible).
- No network calls in this spec; LLM escalation is wired in the `llm-reviewer` spec.
- Each detector exports a single function: `(step: Step) => Finding[]`.
