/**
 * CSV importer — parses with papaparse (delimiter detected: comma, semicolon,
 * tab), then hands the rows to the table importer.
 *
 * Requirements (spec importers): 2.1–2.6
 */

import Papa from 'papaparse'
import { importRows } from './rows.js'
import { ImportError } from './types.js'
import type { ImportResult } from './types.js'

export function importCsv(text: string, options: { name?: string } = {}): ImportResult {
  const input = text.replace(/^﻿/, '') // Excel adds a BOM to UTF-8 CSV
  if (input.trim() === '') throw new ImportError('The CSV file is empty.')
  const parsed = Papa.parse<string[]>(input, { skipEmptyLines: 'greedy' })
  const warnings = parsed.errors.slice(0, 5).map(e => `CSV${e.row !== undefined ? ` row ${e.row + 1}` : ''}: ${e.message}`)
  const result = importRows(parsed.data, options)
  return { suite: result.suite, warnings: [...warnings, ...result.warnings] }
}
