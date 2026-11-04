/**
 * Extract Conditional — fix for Conditional Test (Fork Spirit).
 *
 * For an action "If/When/In case X, Y" or "Y if/when/in case X", returns two
 * test cases (docs/smells.md §2):
 *   A — X becomes a precondition and the step is reduced to Y;
 *   B — without the conditional step and the steps after it
 *       (omitted when B would have no steps).
 * "unless", "otherwise", "whether", "depending on" and conditions in a
 * verification need rewording, so they are left to the LLM reviewer.
 *
 * Requirements (spec fixer): 2.6, 2.7
 */

import type { Finding, TestCase } from '../models/index.js'
import { asSentence, cloneCase, positionOf, renumber } from './text.js'
import type { Transformation } from './types.js'

const LEADING_CONDITION = /^\s*(if|when|in case)\s+(.+?)(?:,\s*|\s+then\s+)(.+)$/i
const TRAILING_CONDITION = /^(.+?)\s+(if|when|in case)\s+(.+)$/i
const NEEDS_LLM = /\b(unless|otherwise|whether|depending on)\b/i

export function extractConditional(testCase: TestCase, finding: Finding): Transformation {
  if (finding.field !== 'action') {
    return { reason: 'Conditions inside an expected result need rewording; the LLM reviewer will propose this fix.' }
  }
  const pos = positionOf(testCase, finding.stepIndex)
  if (pos === -1) return { reason: 'The step of this finding is not in the test case.' }
  const step = testCase.steps[pos]!
  const text = step.action.trim()
  if (NEEDS_LLM.test(text)) {
    return { reason: 'This condition needs rewording ("unless", "otherwise", "whether", "depending on"); the LLM reviewer will propose this fix.' }
  }

  let condition: string | undefined
  let rest: string | undefined
  const lead = LEADING_CONDITION.exec(text)
  if (lead) {
    condition = lead[2]
    rest = lead[3]
  } else {
    const trail = TRAILING_CONDITION.exec(text)
    if (trail) {
      rest = trail[1]
      condition = trail[3]
    }
  }
  const pre = asSentence(condition ?? '')
  const action = asSentence(rest ?? '')
  if (!pre || !action) return { reason: 'The condition could not be separated from the action; the LLM reviewer will propose this fix.' }

  const withCondition = cloneCase(testCase)
  withCondition.id = `${testCase.id}-a`
  withCondition.title = `${testCase.title} (${pre.slice(0, -1)})`
  withCondition.preconditions = [...withCondition.preconditions, pre]
  withCondition.steps[pos]!.action = action

  const after = [withCondition]
  const needsInput: string[] = []
  if (pos > 0) {
    const without = cloneCase(testCase)
    without.id = `${testCase.id}-b`
    without.title = `${testCase.title} (without: ${pre.slice(0, -1).toLowerCase()})`
    without.steps = renumber(without.steps.slice(0, pos), testCase.steps[0]!.index)
    after.push(without)
    needsInput.push(`Check whether test case "${without.title}" needs steps of its own`)
  }

  return {
    after,
    summary:
      after.length === 2
        ? `Split the test into one case where "${pre.slice(0, -1)}" is a precondition and one without the conditional step.`
        : `Made "${pre.slice(0, -1)}" a precondition and reduced step ${step.index + 1} to "${action}".`,
    needsInput,
  }
}
