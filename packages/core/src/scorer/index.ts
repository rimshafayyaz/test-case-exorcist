/**
 * Scorer — turns detector output into an A–F grade and a 0–100 score.
 *
 * score = 100 × (1 − Σ stepPenalty / totalSteps), rounded.
 * A step's penalty is the sum of its finding weights, capped at 1
 * (normal = 1, low = 0.25), so the score reads as "x % of steps are ghost-free".
 * Review candidates do not lower the score; they are counted as uncertainSteps.
 *
 * Requirements (spec scorer): 1.1–1.6, 2.1–2.3
 */

import type { DetectionResult, Finding, SmellName, TestCase, TestSuite } from '../models/index.js'
import { ALL_SMELL_NAMES } from '../smells.js'

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface CaseScore {
  caseId: string
  title: string
  score: number
  grade: Grade
  findingCount: number
}

export interface SuiteScore {
  /** 0–100, rounded. */
  score: number
  grade: Grade
  totalSteps: number
  /** Steps with no finding. */
  cleanSteps: number
  /** Steps with review candidates but no finding. */
  uncertainSteps: number
  findingCount: number
  perSmell: Record<SmellName, number>
  /** Smell with the most findings, or null when there are none. */
  worstSmell: SmellName | null
  cases: CaseScore[]
}

const WEIGHT = { normal: 1, low: 0.25 } as const

/** A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F < 60. */
export function gradeFor(score: number): Grade {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

const key = (caseId: string, stepIndex: number) => `${caseId}\u0000${stepIndex}`

/** Ghost-free share of `steps` as a 0–100 score. */
function scoreOf(penalty: number, steps: number): number {
  if (steps === 0) return 100
  return Math.round(100 * (1 - penalty / steps))
}

function casePenalty(testCase: TestCase, penaltyByStep: Map<string, number>): number {
  return (testCase.steps ?? []).reduce((sum, step) => sum + (penaltyByStep.get(key(testCase.id, step.index)) ?? 0), 0)
}

export function scoreSuite(suite: TestSuite, result: DetectionResult): SuiteScore {
  const findings: Finding[] = result?.findings ?? []

  // Penalty per step: sum of weights, capped at 1.
  const penaltyByStep = new Map<string, number>()
  for (const f of findings) {
    const k = key(f.caseId, f.stepIndex)
    penaltyByStep.set(k, Math.min(1, (penaltyByStep.get(k) ?? 0) + WEIGHT[f.severity]))
  }
  const reviewedSteps = new Set((result?.reviewCandidates ?? []).map(r => key(r.caseId, r.stepIndex)))

  const cases = suite?.cases ?? []
  let totalSteps = 0
  let cleanSteps = 0
  let uncertainSteps = 0
  let totalPenalty = 0
  for (const c of cases) {
    for (const step of c.steps ?? []) {
      const k = key(c.id, step.index)
      totalSteps++
      if (penaltyByStep.has(k)) totalPenalty += penaltyByStep.get(k)!
      else {
        cleanSteps++
        if (reviewedSteps.has(k)) uncertainSteps++
      }
    }
  }

  const perSmell = Object.fromEntries(ALL_SMELL_NAMES.map(s => [s, 0])) as Record<SmellName, number>
  for (const f of findings) perSmell[f.smellName]++
  let worstSmell: SmellName | null = null
  for (const s of ALL_SMELL_NAMES) if (perSmell[s] > 0 && (worstSmell === null || perSmell[s] > perSmell[worstSmell])) worstSmell = s

  const score = scoreOf(totalPenalty, totalSteps)
  return {
    score,
    grade: gradeFor(score),
    totalSteps,
    cleanSteps,
    uncertainSteps,
    findingCount: findings.length,
    perSmell,
    worstSmell,
    cases: cases.map(c => {
      const s = scoreOf(casePenalty(c, penaltyByStep), (c.steps ?? []).length)
      return {
        caseId: c.id,
        title: c.title,
        score: s,
        grade: gradeFor(s),
        findingCount: findings.filter(f => f.caseId === c.id).length,
      }
    }),
  }
}
