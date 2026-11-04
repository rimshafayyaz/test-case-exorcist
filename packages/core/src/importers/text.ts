/**
 * Plain-text importer — test cases pasted as a numbered list.
 *
 *   Test case: Change language          ← starts a test case ("Test case:", "TC:", "#", "Title:")
 *   Preconditions:                      ← following "-" lines are preconditions
 *   - The user is logged in.
 *   1. Open the settings page.          ← a numbered line starts a step ("1.", "1)", "Step 1:")
 *      Expected: The settings appear.   ← "Expected:", "Result:", "=>", "->", "→", "✓" lines are expected results
 *   2. Click Language.
 *      - The language list appears.     ← an indented "-" line under a step is an expected result too
 *
 * Text without any "Test case:" line is one test case; a blank line followed
 * by a non-numbered line starts a new one.
 *
 * Requirements (spec importers): 1.1–1.5
 */

import type { Step, TestCase } from '../models/index.js'
import { ImportError } from './types.js'
import type { ImportResult } from './types.js'

const CASE_LINE = /^\s*(?:#{1,3}\s+|(?:test\s*case|tc|title|scenario)\s*[:\-]\s*)(.+)$/i
const PRECONDITION_LINE = /^\s*(?:pre-?conditions?|prerequisites?|setup)\s*:?\s*(.*)$/i
const STEP_LINE = /^\s*(?:step\s*)?(\d+)\s*[.):\-]\s*(.+)$/i
const EXPECTED_LINE = /^\s*(?:expected(?:\s*results?)?|results?|verify|verification|=>|->|→|✓|✔)\s*[:\-]?\s*(.+)$/i
const BULLET_LINE = /^(\s*)[-*•]\s+(.+)$/

export function importText(text: string, options: { name?: string } = {}): ImportResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  const warnings: string[] = []
  const cases: TestCase[] = []
  let current: TestCase | undefined
  let mode: 'none' | 'preconditions' | 'step' = 'none'
  let blank = false

  const newCase = (title: string) => {
    current = { id: `case-${cases.length + 1}`, title, preconditions: [], steps: [] }
    cases.push(current)
    mode = 'none'
  }
  const lastStep = (): Step | undefined => current?.steps[current.steps.length - 1]

  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '')
    if (line.trim() === '') {
      blank = true
      return
    }
    const wasBlank = blank
    blank = false

    const caseMatch = CASE_LINE.exec(line)
    if (caseMatch && !STEP_LINE.test(line)) return newCase(caseMatch[1]!.trim())

    const pre = PRECONDITION_LINE.exec(line)
    if (pre) {
      if (!current) newCase(`Test case ${cases.length + 1}`)
      mode = 'preconditions'
      if (pre[1]!.trim()) current!.preconditions.push(pre[1]!.trim())
      return
    }

    const step = STEP_LINE.exec(line)
    if (step) {
      if (!current) newCase(`Test case ${cases.length + 1}`)
      current!.steps.push({ index: current!.steps.length, action: step[2]!.trim(), verifications: [], source: { line: i + 1 } })
      mode = 'step'
      return
    }

    const expected = EXPECTED_LINE.exec(line)
    const bullet = BULLET_LINE.exec(line)
    if (mode === 'preconditions' && (bullet || !wasBlank)) {
      current!.preconditions.push((bullet ? bullet[2]! : line).trim())
      return
    }
    if (expected && lastStep()) {
      lastStep()!.verifications.push(expected[1]!.trim())
      return
    }
    if (bullet && mode === 'step' && lastStep()) {
      lastStep()!.verifications.push(bullet[2]!.trim())
      return
    }
    if (mode === 'step' && lastStep() && !wasBlank && /^\s+/.test(line)) {
      // An indented continuation line belongs to the step's action.
      lastStep()!.action += ' ' + line.trim()
      return
    }
    // Any other line: a title for a new test case (after a blank line or at the start).
    if (!current || wasBlank || current.steps.length > 0) return newCase(line.trim())
    warnings.push(`Line ${i + 1} was not understood ("${line.trim().slice(0, 40)}"); skipped.`)
  })

  for (const c of cases.filter(c => c.steps.length === 0)) warnings.push(`Test case "${c.title}" has no numbered steps; skipped.`)
  const kept = cases.filter(c => c.steps.length > 0)
  if (kept.length === 0) throw new ImportError('No numbered steps found. Write each step on its own line, starting with "1.", "2.", …')
  return { suite: { id: 'imported', name: options.name ?? 'Pasted suite', cases: kept }, warnings }
}
