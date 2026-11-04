/**
 * Importers (spec importers): turn pasted text, CSV, table rows (Excel) or
 * JSON into a TestSuite. Pure functions, no file system: the CLI and the web
 * app read the file and pass its text (or rows) here.
 */

import { importCsv } from './csv.js'
import { importJson } from './json.js'
import { importText } from './text.js'
import { importRows, cellLines } from './rows.js'
import { ImportError } from './types.js'
import type { ImportFormat, ImportResult } from './types.js'

export { importCsv, importJson, importText, importRows, cellLines, ImportError }
export type { ImportFormat, ImportResult }

/** Import text in the given format ('rows' needs `importRows` with a table instead). */
export function importSuite(format: Exclude<ImportFormat, 'rows'>, text: string, options: { name?: string } = {}): ImportResult {
  switch (format) {
    case 'text':
      return importText(text, options)
    case 'csv':
      return importCsv(text, options)
    case 'json':
      return importJson(text, options)
  }
}
