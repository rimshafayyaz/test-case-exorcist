/**
 * Extract Precondition — fix for Misplaced Precondition (Early Riser).
 *
 * Moves every state clause of the first step (and, for prerequisite wording,
 * the clause holding the word) into the test case preconditions
 * (docs/smells.md §5). In a later step, only an opening "make sure"/"ensure"
 * + state clause moves. When nothing is left in the action, the step is removed
 * and its verifications become preconditions too.
 *
 * Requirements (spec fixer): 2.4, 1.4, 1.5
 */

import type { Finding, TestCase } from '../models/index.js'
import { isStateClause, withPrefix } from '../detectors/misplacedPrecondition.js'
import { asSentence, cloneCase, positionOf, renumber, stripMakeSure } from './text.js'
import { pieceAt, pieces } from './clauses.js'
import type { Transformation } from './types.js'

export function extractPrecondition(testCase: TestCase, finding: Finding): Transformation {
  const pos = positionOf(testCase, finding.stepIndex)
  if (pos === -1) return { reason: 'The step of this finding is not in the test case.' }
  const step = testCase.steps[pos]!
  const text = step.action

  // "With <things>: <action>" — the prefix is the precondition.
  const prefix = withPrefix(text)
  if (prefix) {
    const pre = asSentence(prefix.text.replace(/^with\s+/i, ''))
    const rest = asSentence(text.slice(text.indexOf(':', prefix.end) + 1))
    const after = cloneCase(testCase)
    after.preconditions = [...after.preconditions, pre]
    after.steps[pos]!.action = rest
    return {
      after: [after],
      summary: `Moved "${pre}" from step ${step.index + 1} to the preconditions.`,
      needsInput: rest === '' ? [`Action for step ${step.index + 1}`] : [],
    }
  }

  const list = pieces(text)
  if (list.length === 0) return { reason: 'The action is empty.' }

  // The opening run of setup clauses ("Make sure X is …, make sure Y is …").
  const moveIdx = new Set<number>()
  for (let i = 0; i < list.length && isStateClause(list[i]!.text, pos > 0); i++) moveIdx.add(i)
  // First step: every other plain state clause too.
  if (pos === 0) list.forEach((p, i) => { if (isStateClause(p.text) && !isStateClause(p.text, true)) moveIdx.add(i) })
  // Prerequisite wording ("Install the prerequisite packages.") has no state clause.
  if (moveIdx.size === 0) moveIdx.add(pieceAt(list, finding.span?.start ?? 0))

  const moved = list.filter((_, i) => moveIdx.has(i)).map(p => asSentence(stripMakeSure(p.text))).filter(Boolean)
  // Keep the remaining text with its original separators.
  let action = ''
  list.forEach((p, i) => {
    if (moveIdx.has(i)) return
    const next = list[i + 1]
    action += text.slice(p.start, next && !moveIdx.has(i + 1) ? next.start : p.end) + ' '
  })
  action = asSentence(action)

  const after = cloneCase(testCase)
  after.preconditions = [...after.preconditions, ...moved]
  if (action === '') {
    after.preconditions.push(...step.verifications.map(v => asSentence(v)).filter(Boolean))
    after.steps = renumber([...after.steps.slice(0, pos), ...after.steps.slice(pos + 1)], testCase.steps[0]!.index)
    return {
      after: [after],
      summary: `Moved step ${step.index + 1} ("${text.trim()}") to the preconditions, because it only describes system state.`,
      needsInput: [],
    }
  }
  after.steps[pos]!.action = action
  return {
    after: [after],
    summary: `Moved ${moved.map(m => `"${m}"`).join(' and ')} from step ${step.index + 1} to the preconditions.`,
    needsInput: [],
  }
}
