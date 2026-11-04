/**
 * Orchestrator — runs the smell detectors on a whole test suite.
 *
 * - Every detector runs on every step of every test case (Req 1.1).
 * - Synchronous, no network calls (Req 1.3).
 * - A detector that throws is recorded in `errors`; the others still run (Req 1.4).
 * - `isFirstStep` comes from the step's array position, and `nextStep` is the
 *   following step in the array (Task 11 notes), not from `step.index`.
 * - Findings are de-duplicated by caseId, stepIndex, field, verificationIndex
 *   and smellName (Req 10.1). verificationIndex is part of the key because
 *   Misplaced Action and Ambiguous Test report each verification entry separately.
 * - Review candidates are dropped when a finding exists for the same case,
 *   step and smell (Req 11.2), and duplicate review candidates are removed.
 * - "TODO: …" placeholder expected results count as empty (isPlaceholder).
 * - Output is sorted by case order in the suite, then step position in the
 *   test case, field, verificationIndex and smell.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 10.1, 11.2
 */

import type { DetectionResult, Finding, ReviewCandidate, SmellName, Step, TestSuite } from '../models/index.js'
import { ALL_SMELL_NAMES } from '../smells.js'
import type { Detector, DetectorContext } from './types.js'
import { ambiguousTest } from './ambiguousTest.js'
import { conditionalTest } from './conditionalTest.js'
import { eagerAction } from './eagerAction.js'
import { misplacedAction } from './misplacedAction.js'
import { misplacedPrecondition } from './misplacedPrecondition.js'
import { misplacedVerification } from './misplacedVerification.js'
import { unverifiedAction } from './unverifiedAction.js'

export type { Detector, DetectorContext, DetectorOutput } from './types.js'

/** The detector for each smell. */
export const DETECTORS: Readonly<Record<SmellName, Detector>> = {
  AmbiguousTest: ambiguousTest,
  ConditionalTest: conditionalTest,
  EagerAction: eagerAction,
  MisplacedAction: misplacedAction,
  MisplacedPrecondition: misplacedPrecondition,
  MisplacedVerification: misplacedVerification,
  UnverifiedAction: unverifiedAction,
}

/** Run all 7 detectors on every step of the suite. */
export function detectAll(suite: TestSuite): DetectionResult {
  return detectWith(suite, DETECTORS)
}

/** Run one detector on every step of the suite. */
export function detectSmell(smell: SmellName, suite: TestSuite): DetectionResult {
  return detectWith(suite, { [smell]: DETECTORS[smell] })
}

/**
 * Run the given detectors on the suite. Exported for tests (e.g. to inject a
 * detector that throws); use `detectAll` or `detectSmell` instead.
 */
/**
 * A "TODO: …" expected result is a placeholder the tester still has to write
 * (Fill Verification adds one). Detectors see it as empty, so the step still
 * counts as unverified and the placeholder text is never checked for smells.
 * Indexes are kept, so verificationIndex values stay valid.
 */
export function isPlaceholder(text: string): boolean {
  return /^\s*TODO\b/i.test(text)
}

function withoutPlaceholders(step: Step): Step {
  return step.verifications.some(isPlaceholder)
    ? { ...step, verifications: step.verifications.map(v => (isPlaceholder(v) ? '' : v)) }
    : step
}

export function detectWith(suite: TestSuite, detectors: Partial<Record<SmellName, Detector>>): DetectionResult {
  const findings: Finding[] = []
  const reviewCandidates: ReviewCandidate[] = []
  const errors: DetectionResult['errors'] = []
  const entries = ALL_SMELL_NAMES.flatMap(name => {
    const detector = detectors[name]
    return detector ? [[name, detector] as const] : []
  })

  for (const testCase of suite?.cases ?? []) {
    const steps = testCase.steps ?? []
    steps.forEach((step, i) => {
      const ctx: DetectorContext = {
        testCase,
        step: withoutPlaceholders(step),
        isFirstStep: i === 0,
        ...(i + 1 < steps.length ? { nextStep: steps[i + 1] } : {}),
      }
      for (const [name, detector] of entries) {
        try {
          const out = detector(ctx)
          findings.push(...out.findings)
          reviewCandidates.push(...out.reviewCandidates)
        } catch (err) {
          errors.push({
            detector: name,
            caseId: testCase.id,
            stepIndex: step.index,
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }
    })
  }

  return mergeResults(suite, findings, reviewCandidates, errors)
}

const stepKey = (caseId: string, stepIndex: number, smell: SmellName) => `${caseId}\u0000${stepIndex}\u0000${smell}`

function findingKey(f: Finding): string {
  return [f.caseId, f.stepIndex, f.field, f.verificationIndex ?? '', f.smellName].join('\u0000')
}

function reviewKey(r: ReviewCandidate): string {
  return [r.caseId, r.stepIndex, r.smellName, r.field ?? '', r.verificationIndex ?? ''].join('\u0000')
}

/**
 * De-duplicate, apply Req 11.2 and sort (exported for the LLM reviewer, which
 * adds findings after detection and must merge them the same way).
 */
export function mergeResults(
  suite: TestSuite,
  findings: Finding[],
  reviewCandidates: ReviewCandidate[],
  errors: DetectionResult['errors'],
): DetectionResult {
  // Req 10.1: one finding per case, step, field, verification and smell.
  const uniqueFindings = new Map<string, Finding>()
  for (const f of findings) if (!uniqueFindings.has(findingKey(f))) uniqueFindings.set(findingKey(f), f)

  // Req 11.2: no review candidate where the same step and smell has a finding.
  const flagged = new Set([...uniqueFindings.values()].map(f => stepKey(f.caseId, f.stepIndex, f.smellName)))
  const uniqueReviews = new Map<string, ReviewCandidate>()
  for (const r of reviewCandidates) {
    if (flagged.has(stepKey(r.caseId, r.stepIndex, r.smellName))) continue
    if (!uniqueReviews.has(reviewKey(r))) uniqueReviews.set(reviewKey(r), r)
  }

  const caseOrder = new Map((suite?.cases ?? []).map((c, i) => [c.id, i]))
  // Steps are ordered by their position in the test case, not by step.index,
  // so imported suites with gaps or out-of-order indexes keep their natural order.
  const stepOrder = new Map<string, number>()
  for (const c of suite?.cases ?? []) {
    ;(c.steps ?? []).forEach((st, i) => {
      const key = `${c.id}\u0000${st.index}`
      if (!stepOrder.has(key)) stepOrder.set(key, i)
    })
  }
  const position = (x: { caseId: string; stepIndex: number }) =>
    stepOrder.get(`${x.caseId}\u0000${x.stepIndex}`) ?? x.stepIndex
  const smellOrder = new Map(ALL_SMELL_NAMES.map((s, i) => [s, i]))
  const fieldOrder = { precondition: 0, action: 1, verification: 2 } as const
  type Sortable = {
    caseId: string
    stepIndex: number
    smellName: SmellName
    field?: keyof typeof fieldOrder
    verificationIndex?: number
  }
  const compare = (a: Sortable, b: Sortable) =>
    (caseOrder.get(a.caseId) ?? 0) - (caseOrder.get(b.caseId) ?? 0) ||
    position(a) - position(b) ||
    fieldOrder[a.field ?? 'action'] - fieldOrder[b.field ?? 'action'] ||
    (a.verificationIndex ?? -1) - (b.verificationIndex ?? -1) ||
    smellOrder.get(a.smellName)! - smellOrder.get(b.smellName)!

  return {
    findings: [...uniqueFindings.values()].sort(compare),
    reviewCandidates: [...uniqueReviews.values()].sort(compare),
    errors,
  }
}
