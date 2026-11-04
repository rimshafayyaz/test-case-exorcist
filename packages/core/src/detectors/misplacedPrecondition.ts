/**
 * Misplaced Precondition detector — "Early Riser"
 *
 * Reports when the first step's action describes system state instead of an
 * action, e.g. step 1 "The monitor is not connected, and the PC is not paired."
 * or "The user is already logged in."
 *
 * Detection (docs/smells.md §5, Keyword ownership table) — first step only:
 * 1. State description: a clause that is not a command and contains
 *    subject + auxiliary + participle/state word (hasStateDescription).
 *    Clauses that start with an imperative ("Open the file that is saved")
 *    are actions and are skipped; clauses that start with a verification verb
 *    ("ensure Wi-Fi is disabled") belong to Misplaced Verification and are skipped; "make sure"/"ensure that" clauses are not
 *    skipped (tie-break: first step + state description → this smell).
 * 2. Prerequisite wording (PREREQUISITE_WORDS: prerequisite, beforehand, already).
 * 3. Review candidate: a statement with "is/are/has/have…" but no clear
 *    participle or state word ("User has an account.").
 *
 * Field: action. At most one finding per step. The span covers the first
 * state clause (the text the fix moves to the preconditions), or the
 * prerequisite word when no state clause exists.
 * Confidence: rule · Severity: normal · Fix: ExtractPrecondition
 *
 * Requirements: 2.2, 2.3, 7.1, 7.2, 7.3, 10.2, 11.1, 11.2
 */

import type { Finding, ReviewCandidate } from '../models/index.js'
import { SMELLS } from '../smells.js'
import {
  MAKE_SURE_PHRASES,
  VERIFICATION_VERBS,
  SUBORDINATING_CONJUNCTIONS,
  SUBORDINATING_CONJUNCTION_PHRASES,
  PREREQUISITE_WORDS,
  splitClauses,
  imperativeStartInfo,
  isDeclarativeClause,
  findWords,
  hasStateDescription,
  tag,
} from '../text/index.js'
import type { Span } from '../text/index.js'
import type { DetectorContext, DetectorOutput } from './types.js'

const META = SMELLS['MisplacedPrecondition']

export const STATE_REASON = 'The first step describes system state; move it to the test case preconditions.'
export const SETUP_REASON = 'This step asks to make sure of a setup state; move it to the test case preconditions.'

/** One-sentence reason (<= 25 words, Req 2.3). */
export function reasonFor(prerequisiteWord?: string): string {
  return prerequisiteWord
    ? `"${prerequisiteWord.toLowerCase()}" marks a prerequisite; move it to the test case preconditions.`
    : STATE_REASON
}

/** Verbs that make a statement about state without a participle ("User has an account."). */
const STATE_VERBS = new Set(['is', 'are', 'was', 'were', 'has', 'have', 'exists', 'exist'])

type ClauseKind = 'command' | 'check' | 'make-sure' | 'condition' | 'statement'

/**
 * Classify a clause:
 * - 'condition': starts with if/whether/unless/otherwise/in case/depending on/when —
 *   owned by Conditional Test, so skipped here;
 * - 'check': starts with a verification verb ("ensure Wi-Fi is disabled") —
 *   owned by Misplaced Verification, so skipped here;
 * - 'make-sure': starts with "make sure" / "ensure that" (tie-break: reported
 *   here only with a state description);
 * - 'command': starts with an imperative verb and is not a statement;
 * - 'statement': anything else.
 */
function classify(clause: string): ClauseKind {
  // "If you have a USB drive" — a condition, owned by Conditional Test.
  const lower = clause.trim().toLowerCase()
  if ([...SUBORDINATING_CONJUNCTIONS, ...SUBORDINATING_CONJUNCTION_PHRASES, 'when'].some(w => lower === w || lower.startsWith(w + ' '))) {
    return 'condition'
  }
  const info = imperativeStartInfo(clause)
  if (!info) return 'statement'
  const rest = clause.slice(info.start).toLowerCase()
  if (MAKE_SURE_PHRASES.some(p => rest.startsWith(p)) || info.normal === 'ensure') return 'make-sure'
  if (VERIFICATION_VERBS.includes(info.normal)) return 'check'
  return isDeclarativeClause(info) ? 'statement' : 'command'
}

/**
 * True when a clause describes system state that belongs in the preconditions
 * (a statement or "make sure"/"ensure that" clause with a state description).
 * Also used by the Extract Precondition fixer.
 */
/** Cheap check: the clause opens with "make sure" / "ensure" (optionally after "please"). */
export function opensWithMakeSure(clause: string): boolean {
  return /^\s*(?:(?:please|then|and|also|now)\s+)*(?:make\s+sure|ensure)\b/i.test(clause)
}

/** Verbs that describe a state or a capability after "make sure" ("you have internet access"). */
const STATE_STATEMENT = /^\s*(?:[\w'-]+\s+){1,4}(?:has|have|supports?|contains?|exists?|(?:is|are)\s+(?:not\s+)?(?:in|on|at)\s)/i

/**
 * True when a "make sure" / "ensure (that)" clause asks for a setup state:
 * "Make sure the user is logged in", "Please ensure you have internet access",
 * "Make sure that your processor supports …". Not "Make sure to click Save".
 */
export function isMakeSureState(clause: string): boolean {
  const m = /^\s*(?:(?:please|then|and|also|now)\s+)*(?:make\s+sure|ensure)\s+(?:that\s+)?([\s\S]*)$/i.exec(clause)
  if (!m) return false
  const rest = m[1]!
  if (/^to\b/i.test(rest)) return false
  return hasStateDescription(rest) || STATE_STATEMENT.test(rest)
}

export function isStateClause(clause: string, makeSureOnly = false): boolean {
  if (makeSureOnly && !opensWithMakeSure(clause)) return false
  const kind = classify(clause)
  if (kind === 'make-sure') return isMakeSureState(clause)
  if (makeSureOnly) return false
  return kind === 'statement' && hasStateDescription(clause)
}

/**
 * "With <things>: <action>" — the prefix lists what must be set up first
 * ("With an HDMI monitor plugged in, and an MP3 file: install mpg321 …").
 * Returns the prefix span (without ":"), or null.
 */
export function withPrefix(text: string): Span | null {
  const m = /^(\s*)(with\s+[^:]{3,}?):\s*\S/i.exec(text)
  if (!m) return null
  const start = m[1]!.length
  const end = start + m[2]!.length
  return { start, end, text: text.slice(start, end) }
}

/** Span of a clause inside `text`, without surrounding spaces, leading "and"/"but" or the final period. */
function clauseSpan(text: string, clause: string, from: number): Span & { next: number } {
  const offset = text.indexOf(clause, from)
  const base = offset === -1 ? from : offset
  let start = base
  let end = base + clause.length
  const lead = /^\s*(?:(?:and|but|then)\s+)?/i.exec(clause)
  if (lead) start += lead[0].length
  while (end > start && /[\s.,;:!]/.test(text[end - 1]!)) end--
  return { start, end, text: text.slice(start, end), next: base + clause.length }
}

/** Later steps: only a "make sure"/"ensure" clause with a state description (Req 7.4). */
function laterStep({ testCase, step }: DetectorContext, text: string): DetectorOutput {
  const prefix = withPrefix(text)
  // Only when the step opens with "make sure"/"ensure" or "With …:".
  if (!prefix && !opensWithMakeSure(text)) return { findings: [], reviewCandidates: [] }
  const clause = prefix ? undefined : splitClauses(text)[0]
  if (prefix || (clause && isStateClause(clause, true))) {
    const span = prefix ?? clauseSpan(text, clause!, 0)
    const finding: Finding = {
      caseId: testCase.id,
      stepIndex: step.index,
      field: 'action',
      span: { start: span.start, end: span.end },
      smellName: META.smellName,
      ghostName: META.ghostName,
      reason: SETUP_REASON,
      confidence: 'rule',
      fixName: META.fixName,
      severity: 'normal',
    }
    return { findings: [finding], reviewCandidates: [] }
  }
  return { findings: [], reviewCandidates: [] }
}

export const misplacedPrecondition = (ctx: DetectorContext): DetectorOutput => {
  const { testCase, step, isFirstStep } = ctx
  const empty: DetectorOutput = { findings: [], reviewCandidates: [] }
  const text = step.action ?? ''
  if (text.trim() === '') return empty
  // Req 7.3: plain state and prerequisite wording only in the first step;
  // Req 7.4: "make sure"/"ensure" + a setup state in any step.
  if (!isFirstStep) return laterStep(ctx, text)

  let stateSpan: Span | null = null
  let reviewWord: string | null = null
  let cursor = 0

  for (const [i, clause] of splitClauses(text).entries()) {
    const span = clauseSpan(text, clause, cursor)
    cursor = span.next
    const kind = classify(clause)
    if (kind === 'command' || kind === 'check' || kind === 'condition') continue
    // "make sure"/"ensure" after another clause is a check, not a setup state.
    if (kind === 'make-sure' && i > 0) continue
    if (kind === 'make-sure' ? isMakeSureState(clause) : hasStateDescription(clause)) {
      stateSpan = { start: span.start, end: span.end, text: span.text }
      break
    }
    // "make sure" without a state description belongs to Misplaced Verification.
    if (kind === 'make-sure') continue
    reviewWord ??= tag(clause).find(t => STATE_VERBS.has(t.normal))?.text ?? null
  }

  stateSpan ??= withPrefix(text)
  const prerequisite = findWords(text, PREREQUISITE_WORDS)[0]

  if (stateSpan || prerequisite) {
    const span = stateSpan ?? prerequisite!
    const finding: Finding = {
      caseId: testCase.id,
      stepIndex: step.index,
      field: 'action',
      span: { start: span.start, end: span.end },
      smellName: META.smellName,
      ghostName: META.ghostName,
      reason: stateSpan ? reasonFor() : reasonFor(prerequisite!.text),
      confidence: 'rule',
      fixName: META.fixName,
      severity: 'normal',
    }
    // Req 11.2: a finding makes the review candidate redundant.
    return { findings: [finding], reviewCandidates: [] }
  }

  if (reviewWord) {
    const review: ReviewCandidate = {
      caseId: testCase.id,
      stepIndex: step.index,
      smellName: META.smellName,
      field: 'action',
      hint: `The first step is a statement ("${reviewWord}") that may describe system state; review needed.`,
    }
    return { findings: [], reviewCandidates: [review] }
  }

  return empty
}
