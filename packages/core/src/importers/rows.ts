/**
 * Table importer — rows of cells, as they come from CSV or Excel.
 *
 * The first row is the header. Columns are found by name (case-insensitive,
 * common synonyms from test-management exports):
 *   test case:     "test case", "test case id", "case", "id", "test id", "tc id"
 *   title:         "title", "name", "test case name", "summary", "scenario"
 *   precondition:  "precondition(s)", "pre-condition(s)", "prerequisite(s)", "setup"
 *   step number:   "step", "step no", "step #", "step number", "#", "no"
 *   action:        "action", "step description", "steps", "description", "test step", "step action"
 *   expected:      "expected", "expected result(s)", "expected outcome", "verification", "result"
 * Only the action column is required.
 *
 * Rows that share a test case (or follow a row with one, when the cell is
 * empty) form one test case. A cell with several lines ("1. …\n2. …") in the
 * expected column gives several expected results.
 *
 * Requirements (spec importers): 2.1–2.5
 */

import type { Step, TestCase } from '../models/index.js'
import { ImportError } from './types.js'
import type { ImportResult } from './types.js'

const COLUMNS = {
  caseId: ['test case', 'test case id', 'testcase', 'testcase id', 'case', 'case id', 'id', 'test id', 'tc id', 'tc'],
  title: ['title', 'name', 'test case name', 'test name', 'summary', 'scenario', 'test case title'],
  precondition: ['precondition', 'preconditions', 'pre-condition', 'pre-conditions', 'prerequisite', 'prerequisites', 'setup'],
  stepNo: ['step', 'step no', 'step no.', 'step #', 'step number', '#', 'no', 'no.', 'step id'],
  action: ['action', 'actions', 'step description', 'steps', 'description', 'test step', 'step action', 'test steps', 'step details'],
  expected: ['expected', 'expected result', 'expected results', 'expected outcome', 'expected output', 'verification', 'verifications', 'result', 'expected behaviour', 'expected behavior'],
} as const

type Column = keyof typeof COLUMNS

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[:*]+$/, '')

/** Split a cell into separate lines, removing list markers ("1.", "-", "•"). */
export function cellLines(cell: string): string[] {
  return cell
    .split(/\r?\n/)
    .map(l => l.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, '').trim())
    .filter(l => l !== '')
}

function findColumns(header: string[]): Partial<Record<Column, number>> {
  const found: Partial<Record<Column, number>> = {}
  const names = header.map(norm)
  // Exact names first, so "test case" is not taken by "test case name".
  for (const col of Object.keys(COLUMNS) as Column[]) {
    const i = names.findIndex((n, idx) => (COLUMNS[col] as readonly string[]).includes(n) && !Object.values(found).includes(idx))
    if (i !== -1) found[col] = i
  }
  return found
}

export function importRows(rows: string[][], options: { name?: string } = {}): ImportResult {
  const clean = rows.map(r => r.map(c => (c ?? '').toString()))
  const headerIndex = clean.findIndex(r => r.some(c => c.trim() !== ''))
  if (headerIndex === -1) throw new ImportError('The table is empty.')
  const header = clean[headerIndex]!
  const col = findColumns(header)
  if (col.action === undefined) {
    throw new ImportError(
      `No action column found. Name one column "Action" or "Step description" (found: ${header.filter(h => h.trim()).map(h => `"${h.trim()}"`).join(', ')}).`,
    )
  }

  const warnings: string[] = []
  const cases: TestCase[] = []
  let current: TestCase | undefined
  const cell = (row: string[], c: Column) => (col[c] === undefined ? '' : (row[col[c]!] ?? '').trim())

  clean.slice(headerIndex + 1).forEach((row, i) => {
    const rowNo = headerIndex + i + 2 // 1-based, as a spreadsheet shows it
    if (row.every(c => c.trim() === '')) return
    const caseId = cell(row, 'caseId')
    const title = cell(row, 'title')
    const startsCase = !current || (caseId !== '' && caseId !== current.id) || (col.caseId === undefined && title !== '' && title !== current.title)
    if (startsCase) {
      const id = caseId || title || `case-${cases.length + 1}`
      current = { id, title: title || caseId || `Test case ${cases.length + 1}`, preconditions: [], steps: [] }
      cases.push(current)
    }
    const tc = current!
    for (const p of cellLines(cell(row, 'precondition'))) if (!tc.preconditions.includes(p)) tc.preconditions.push(p)

    const action = cell(row, 'action')
    const expected = cellLines(cell(row, 'expected'))
    if (action === '') {
      const last = tc.steps[tc.steps.length - 1]
      if (expected.length > 0 && last) {
        last.verifications.push(...expected) // a row with only an expected result continues the step above
      } else if (expected.length > 0 || tc.preconditions.length === 0) {
        warnings.push(`Row ${rowNo} has no action; skipped.`)
      }
      return
    }
    const step: Step = { index: tc.steps.length, action, verifications: expected, source: { row: rowNo } }
    tc.steps.push(step)
  })

  const empty = cases.filter(c => c.steps.length === 0)
  for (const c of empty) warnings.push(`Test case "${c.title}" has no steps; skipped.`)
  const suite = { id: 'imported', name: options.name ?? 'Imported suite', cases: cases.filter(c => c.steps.length > 0) }
  if (suite.cases.length === 0) throw new ImportError('No steps found. Each step needs text in the action column.')
  // Make ids unique (two cases with the same title, no id column).
  const seen = new Map<string, number>()
  for (const c of suite.cases) {
    const n = (seen.get(c.id) ?? 0) + 1
    seen.set(c.id, n)
    if (n > 1) c.id = `${c.id}-${n}`
  }
  return { suite, warnings }
}
