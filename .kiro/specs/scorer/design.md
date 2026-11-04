# Design Document

## Overview

`scoreSuite(suite, result)` in `packages/core/src/scorer/index.ts`. Pure function: counts findings per step (by array position, like the orchestrator), applies severity weights, caps each step's penalty at 1 and converts the ghost-free share into a score and grade.

## Why this formula

- **Per-step cap:** a step with three smells is one bad step, not three; it keeps the score readable as "x % of steps are ghost-free".
- **Low severity = 0.25:** the navigation exception (Unverified Action, `severity: "low"`) may be intentional, so it costs a quarter of a step.
- **Review candidates excluded:** they are uncertain until the LLM reviewer confirms them.

## Interfaces

```ts
type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

interface CaseScore { caseId: string; title: string; score: number; grade: Grade; findingCount: number }

interface SuiteScore {
  score: number            // 0–100
  grade: Grade
  totalSteps: number
  cleanSteps: number       // steps with no finding
  uncertainSteps: number   // steps with review candidates but no finding
  findingCount: number
  perSmell: Record<SmellName, number>
  worstSmell: SmellName | null
  cases: CaseScore[]
}

function scoreSuite(suite: TestSuite, result: DetectionResult): SuiteScore
function gradeFor(score: number): Grade
```

Findings whose `caseId`/`stepIndex` are not in the suite are ignored for step penalties but still counted in `findingCount` and `perSmell`.
