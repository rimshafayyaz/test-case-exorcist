/**
 * Fixer — proposes research-defined transformations as before/after changes,
 * self-checked by running the detectors again (spec fixer).
 *
 * Nothing is changed without approval: proposeFix/proposeFixes return
 * proposals; applyFix is called only after the user accepts one.
 *
 * Requirements (spec fixer): 1.1–1.3, 3.1, 3.2, 4.1–4.3
 */

import type { Finding, FixName, SmellName, TestCase, TestSuite } from '../models/index.js'
import { ALL_SMELL_NAMES } from '../smells.js'
import { detectAll } from '../detectors/index.js'
import { separateActions } from './separateActions.js'
import { extractVerification } from './extractVerification.js'
import { extractAction } from './extractAction.js'
import { extractPrecondition } from './extractPrecondition.js'
import { fillVerification } from './fillVerification.js'
import { extractConditional } from './extractConditional.js'
import { cloneCase } from './text.js'
import type { FixCheck, FixOutcome, FixProposal, Transform } from './types.js'

export type { FixCheck, FixOutcome, FixProposal } from './types.js'

const NEEDS_LLM: Transform = () => ({
  reason: 'Choosing a specific, measurable value needs the LLM reviewer; no rule-based fix is proposed.',
})

/** The transformation for each fix name. */
export const TRANSFORMS: Readonly<Record<FixName, Transform>> = {
  SeparateActions: separateActions,
  ExtractVerification: extractVerification,
  ExtractAction: extractAction,
  ExtractPrecondition: extractPrecondition,
  FillVerification: fillVerification,
  ExtractConditional: extractConditional,
  ExtractAmbiguity: NEEDS_LLM,
}

function findingsOf(cases: TestCase[]): Finding[] {
  return detectAll({ id: 'check', name: 'check', cases }).findings
}

function countBySmell(findings: Finding[]): Record<SmellName, number> {
  const counts = Object.fromEntries(ALL_SMELL_NAMES.map(s => [s, 0])) as Record<SmellName, number>
  for (const f of findings) counts[f.smellName]++
  return counts
}

/** The text a finding points at (the action or one verification). */
function fieldText(testCase: TestCase, f: Finding): string | undefined {
  const step = testCase.steps.find(s => s.index === f.stepIndex)
  if (!step) return undefined
  return f.field === 'verification' ? step.verifications[f.verificationIndex ?? 0] : step.action
}

/**
 * Run the detectors on before and after (Req 3).
 *
 * - Only the first result case is compared: a second case (Extract
 *   Conditional's "without" case) holds steps copied unchanged from `before`,
 *   so counting it would count old smells twice.
 * - `resolved` is true when the target smell has fewer findings, or when every
 *   remaining finding of that smell is on text copied unchanged from another
 *   step (the fix exposed an existing problem, e.g. the next step became the
 *   first step).
 */
export function checkFix(before: TestCase, after: TestCase[], target: Finding): FixCheck {
  const first = after.slice(0, 1)
  const beforeFindings = findingsOf([before])
  const afterFindings = findingsOf(first)
  const b = countBySmell(beforeFindings)
  const a = countBySmell(afterFindings)
  const introduced: Partial<Record<SmellName, number>> = {}
  for (const s of ALL_SMELL_NAMES) if (a[s] > b[s]) introduced[s] = a[s] - b[s]

  const smell = target.smellName
  let resolved = a[smell] < b[smell]
  if (!resolved && first[0]) {
    const fixedStep = before.steps.find(s => s.index === target.stepIndex)
    const others = before.steps.filter(s => s !== fixedStep).flatMap(s => [s.action, ...s.verifications])
    const remaining = afterFindings.filter(f => f.smellName === smell).map(f => fieldText(first[0]!, f))
    resolved = remaining.every(t => {
      const i = t === undefined ? -1 : others.indexOf(t)
      if (i === -1) return false
      others.splice(i, 1)
      return true
    })
  }
  return { resolved, introduced }
}

/** Propose the fix for one finding of `testCase`. Never throws (Req 1.1). */
export function proposeFix(testCase: TestCase, finding: Finding): FixOutcome {
  try {
    const transform = TRANSFORMS[finding.fixName]
    if (!transform) return { ok: false, finding, reason: `Unknown fix "${finding.fixName}".` }
    const before = cloneCase(testCase)
    const result = transform(cloneCase(testCase), finding)
    if ('reason' in result) return { ok: false, finding, reason: result.reason }
    const proposal: FixProposal = {
      fixName: finding.fixName,
      smellName: finding.smellName,
      caseId: testCase.id,
      stepIndex: finding.stepIndex,
      summary: result.summary,
      before,
      after: result.after,
      needsInput: result.needsInput,
      check: checkFix(before, result.after, finding),
    }
    return { ok: true, proposal }
  } catch (err) {
    return { ok: false, finding, reason: `The fix failed: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/** One outcome per finding, each proposed on the original test case. */
export function proposeFixes(suite: TestSuite, findings: Finding[] = detectAll(suite).findings): FixOutcome[] {
  const byId = new Map(suite.cases.map(c => [c.id, c]))
  return findings.map(f => {
    const testCase = byId.get(f.caseId)
    return testCase ? proposeFix(testCase, f) : { ok: false as const, finding: f, reason: 'The test case of this finding is not in the suite.' }
  })
}

/** Replace the proposal's case by its result; returns a new suite (Req 4.1). */
export function applyFix(suite: TestSuite, proposal: FixProposal): TestSuite {
  return {
    ...suite,
    cases: suite.cases.flatMap(c => (c.id === proposal.caseId ? proposal.after.map(cloneCase) : [cloneCase(c)])),
  }
}

const MAX_ROUNDS = 50

/**
 * Apply rule-based fixes until none resolves a finding (Req 4.2). Works one
 * test case at a time: each round applies the first proposal that resolves its
 * smell, then the detectors run again on the result.
 */
export function exorciseSuite(suite: TestSuite): { suite: TestSuite; applied: FixProposal[] } {
  const applied: FixProposal[] = []
  const cases = suite.cases.flatMap(original => {
    let queue: TestCase[] = [cloneCase(original)]
    const done: TestCase[] = []
    let rounds = 0
    while (queue.length > 0) {
      const testCase = queue.shift()!
      let fixed: FixProposal | undefined
      if (rounds++ < MAX_ROUNDS) {
        for (const f of detectAll({ id: 'case', name: 'case', cases: [testCase] }).findings) {
          const outcome = proposeFix(testCase, f)
          if (outcome.ok && outcome.proposal.check.resolved) {
            fixed = outcome.proposal
            break
          }
        }
      }
      if (fixed) {
        applied.push(fixed)
        queue = [...fixed.after, ...queue]
      } else {
        done.push(testCase)
      }
    }
    return done
  })
  return { suite: { ...suite, cases }, applied }
}

/** Stable plain-text form of a test case for diff views (Req 4.3). */
export function caseToText(testCase: TestCase): string {
  const lines = [`# ${testCase.title}`]
  if (testCase.preconditions.length > 0) {
    lines.push('Preconditions:')
    for (const p of testCase.preconditions) lines.push(`  - ${p}`)
  }
  testCase.steps.forEach((step, i) => {
    lines.push(`${i + 1}. ${step.action}`)
    for (const v of step.verifications) lines.push(`     ✓ ${v}`)
  })
  return lines.join('\n')
}
