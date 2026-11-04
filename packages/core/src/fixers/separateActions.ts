/**
 * Separate Actions — fix for Eager Action (Hydra).
 *
 * Splits the action into one step per action found by the detector
 * (findActions). The original verifications go to the last new step; the
 * other new steps get no verification and a needsInput entry (docs/smells.md §3).
 *
 * Requirements (spec fixer): 2.1, 1.4, 1.5
 */

import type { Finding, TestCase } from '../models/index.js'
import { findActions } from '../detectors/eagerAction.js'
import { asSentence, cloneCase, positionOf, renumber } from './text.js'
import type { Transformation } from './types.js'

export function separateActions(testCase: TestCase, finding: Finding): Transformation {
  const pos = positionOf(testCase, finding.stepIndex)
  if (pos === -1) return { reason: 'The step of this finding is not in the test case.' }
  const step = testCase.steps[pos]!
  const actions = findActions(step.action)
  if (actions.length < 2) return { reason: 'The action no longer contains several actions.' }

  // Cut the text at the start of each action after the first; text before the
  // first action stays with it.
  const cuts = [0, ...actions.slice(1).map(a => a.start), step.action.length]
  const pieces = cuts.slice(0, -1).map((start, i) => asSentence(step.action.slice(start, cuts[i + 1])))

  const after = cloneCase(testCase)
  const newSteps = pieces.map((action, i) => ({
    ...step,
    action,
    verifications: i === pieces.length - 1 ? [...step.verifications] : [],
  }))
  const firstIndex = testCase.steps[0]!.index
  after.steps = renumber([...after.steps.slice(0, pos), ...newSteps, ...after.steps.slice(pos + 1)], firstIndex)

  const needsInput = newSteps
    .slice(0, -1)
    .map((s, i) => `Expected result for step ${firstIndex + pos + i + 1} ("${s.action}")`)

  return {
    after: [after],
    summary: `Split step ${step.index + 1} into ${pieces.length} steps, one per action.`,
    needsInput,
  }
}
