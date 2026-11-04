/**
 * Shared types for the importers (spec importers).
 */

import type { TestSuite } from '../models/index.js'

/** What every importer returns: a suite plus readable notes about what it skipped or guessed. */
export interface ImportResult {
  suite: TestSuite
  /** Plain-language notes, e.g. "Row 7 has no action; skipped." */
  warnings: string[]
}

/** The input formats the web app's dropdown offers. */
export type ImportFormat = 'text' | 'csv' | 'json' | 'rows'

export class ImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportError'
  }
}
