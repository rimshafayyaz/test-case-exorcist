/**
 * Fill Verification — fix for Unverified Action (Silent Ghost).
 *
 * Adds a clearly marked placeholder expected result naming the action. The
 * tester must replace it; the fixer never invents a result (docs/smells.md §7).
 *
 * Requirements (spec fixer): 2.5
 */

import type { Finding, TestCase } from '../models/index.js'
import { cloneCase, positionOf } from './text.js'
import type { Transformation } from './types.js'

export function placeholderFor(action: string): string {
  const what = action.trim().replace(/[.!?]+$/, '')
  return `TODO: expected result of "${what}"`
}

export function fillVerification(testCase: TestCase, finding: Finding): Transformation {
  const pos = positionOf(testCase, finding.stepIndex)
  if (pos === -1) return { reason: 'The step of this finding is not in the test case.' }
  const after = cloneCase(testCase)
  const step = after.steps[pos]!
  step.verifications = [placeholderFor(step.action)]
  return {
    after: [after],
    summary: `Added a placeholder expected result to step ${step.index + 1}.`,
    needsInput: [`Expected result for step ${step.index + 1} ("${step.action.trim()}")`],
  }
}
