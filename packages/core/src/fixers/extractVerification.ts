/**
 * Extract Verification — fix for Misplaced Verification (Mixed Soul).
 *
 * Moves every check out of the action to the start of the verifications
 * (docs/smells.md §6). A check runs from the clause holding the check word up
 * to the next command; commands stay in the action. The checks are found with
 * the detector's own findChecks, so fix and detection always agree.
 * When nothing is left in the action, the checks belong to the previous step:
 * they are appended to that step's verifications and this step is removed.
 *
 * Requirements (spec fixer): 2.2, 1.4, 1.5
 */

import type { Finding, TestCase } from '../models/index.js'
import { findChecks } from '../detectors/misplacedVerification.js'
import { asSentence, cloneCase, positionOf, renumber, stripMakeSure } from './text.js'
import { isCommand, pieceAt, pieces } from './clauses.js'
import type { Piece } from './clauses.js'
import type { Transformation } from './types.js'

/** Consecutive runs of pieces with the same "moved" flag, as text slices of `text`. */
function runs(text: string, list: Piece[], moved: boolean[], want: boolean): string[] {
  const out: string[] = []
  let i = 0
  while (i < list.length) {
    if (moved[i] !== want) {
      i++
      continue
    }
    let j = i
    while (j + 1 < list.length && moved[j + 1] === want) j++
    const end = j + 1 < list.length ? list[j + 1]!.start : text.length
    out.push(text.slice(list[i]!.start, end))
    i = j + 1
  }
  return out
}

/** Join the actions left around the moved checks: "Click Save, then click Close." */
function joinActions(parts: string[]): string {
  const sentences = parts.map(asSentence).filter(Boolean)
  return sentences.reduce((acc, s) => (acc ? `${acc.slice(0, -1)}, then ${s.charAt(0).toLowerCase()}${s.slice(1)}` : s), '')
}

export function extractVerification(testCase: TestCase, finding: Finding): Transformation {
  const pos = positionOf(testCase, finding.stepIndex)
  if (pos === -1) return { reason: 'The step of this finding is not in the test case.' }
  const step = testCase.steps[pos]!
  const text = step.action
  const list = pieces(text)
  if (list.length === 0) return { reason: 'The action is empty.' }

  // Mark every piece that holds a check, plus the non-command pieces after it.
  const moved = list.map(() => false)
  const starts = findChecks(text, pos === 0).checks.map(c => c.start)
  if (starts.length === 0) starts.push(finding.span?.start ?? 0)
  for (const start of starts) {
    let i = pieceAt(list, start)
    moved[i] = true
    while (i + 1 < list.length && !moved[i + 1] && !isCommand(list[i + 1]!.text)) moved[++i] = true
  }

  const checks = runs(text, list, moved, true).map(t => asSentence(stripMakeSure(t))).filter(Boolean)
  const action = joinActions(runs(text, list, moved, false))
  const quoted = checks.map(c => `"${c}"`).join(' and ')

  const after = cloneCase(testCase)
  const firstIndex = testCase.steps[0]!.index

  if (action === '' && pos > 0) {
    const prev = after.steps[pos - 1]!
    prev.verifications = [...prev.verifications, ...checks, ...step.verifications]
    after.steps = renumber([...after.steps.slice(0, pos), ...after.steps.slice(pos + 1)], firstIndex)
    return {
      after: [after],
      summary: `Moved ${quoted} to the expected results of step ${prev.index + 1} and removed step ${step.index + 1}, which had no action left.`,
      needsInput: [],
    }
  }

  const target = after.steps[pos]!
  target.action = action
  target.verifications = [...checks, ...step.verifications]
  return {
    after: [after],
    summary: `Moved ${quoted} from the action to the expected results of step ${step.index + 1}.`,
    needsInput: action === '' ? [`Action for step ${step.index + 1}`] : [],
  }
}
