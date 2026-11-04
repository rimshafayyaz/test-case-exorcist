/**
 * Extract Action — fix for Misplaced Action (Wanderer).
 *
 * Moves the action clause out of a verification into a new step inserted
 * right after the current step (docs/smells.md §4). The rest of that
 * verification stays; the new step needs an expected result.
 *
 * Requirements (spec fixer): 2.3, 1.4, 1.5
 */

import type { Finding, TestCase } from '../models/index.js'
import { asSentence, cloneCase, positionOf, renumber } from './text.js'
import { pieceAt, pieces } from './clauses.js'
import type { Transformation } from './types.js'

export function extractAction(testCase: TestCase, finding: Finding): Transformation {
  const pos = positionOf(testCase, finding.stepIndex)
  if (pos === -1) return { reason: 'The step of this finding is not in the test case.' }
  const vi = finding.verificationIndex
  const step = testCase.steps[pos]!
  if (vi === undefined || step.verifications[vi] === undefined) {
    return { reason: 'The finding does not point to a verification.' }
  }
  const text = step.verifications[vi]!
  const list = pieces(text)
  if (list.length === 0) return { reason: 'The verification is empty.' }

  // The action runs from the clause holding the verb to the end of the verification.
  const runStart = list[pieceAt(list, finding.span?.start ?? 0)]!.start
  const moved = asSentence(text.slice(runStart))
  const kept = asSentence(text.slice(0, runStart))

  const after = cloneCase(testCase)
  const current = after.steps[pos]!
  current.verifications = kept
    ? current.verifications.map((v, i) => (i === vi ? kept : v))
    : current.verifications.filter((_, i) => i !== vi)

  const newStep = { ...current, action: moved, verifications: [] as string[] }
  const firstIndex = testCase.steps[0]!.index
  after.steps = renumber([...after.steps.slice(0, pos + 1), newStep, ...after.steps.slice(pos + 1)], firstIndex)

  const needsInput = [`Expected result for the new step ${firstIndex + pos + 2} ("${moved}")`]
  if (current.verifications.length === 0) needsInput.unshift(`Expected result for step ${current.index + 1}`)
  return {
    after: [after],
    summary: `Moved the action "${moved}" from an expected result of step ${step.index + 1} into a new step after it.`,
    needsInput,
  }
}
