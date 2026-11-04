/**
 * Clause helpers for the fixers, built on the detectors' own segmenting so a
 * fix always cuts the text where the detector saw the problem.
 */

import { segment } from '../detectors/eagerAction.js'
import { MAKE_SURE_PHRASES, VERIFICATION_VERBS, imperativeStartInfo, isDeclarativeClause } from '../text/index.js'

export interface Piece {
  text: string
  start: number
  end: number
}

/** Clause-level pieces of `text` with offsets (sentence ends, ";", ",", "and", "then", "or"). */
export function pieces(text: string): Piece[] {
  return segment(text).map(s => ({ text: s.text, start: s.start, end: s.end }))
}

/** Index of the piece that holds `offset` (or the first piece after it). */
export function pieceAt(list: Piece[], offset: number): number {
  const i = list.findIndex(p => offset < p.end)
  return i === -1 ? list.length - 1 : i
}

/** True when a piece is a command (not a check, not "make sure", not a statement). */
export function isCommand(text: string): boolean {
  const info = imperativeStartInfo(text)
  if (!info) return false
  if (VERIFICATION_VERBS.includes(info.normal)) return false
  const rest = text.slice(info.start).toLowerCase()
  if (MAKE_SURE_PHRASES.some(p => rest.startsWith(p))) return false
  return !isDeclarativeClause(info)
}
