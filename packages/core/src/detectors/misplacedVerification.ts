/**
 * Misplaced Verification detector — "Mixed Soul"
 *
 * Reports when a check (verification) is written inside the action field,
 * e.g. "Close flip and check app continuity." or "The menu should appear."
 *
 * Detection (docs/smells.md §6, Keyword ownership table):
 * 1. A verification verb (VERIFICATION_VERBS) anywhere in the action.
 *    Exception: "check"/"uncheck" used to tick a checkbox, radio button or
 *    option is an action, not a verification ("Check the 'Remember me' box").
 * 2. Outcome wording (OUTCOME_WORDS: "should", "must be displayed").
 * 3. "make sure" / "ensure that" (MAKE_SURE_PHRASES) — tie-break:
 *    - first step + state description → owned by Misplaced Precondition,
 *      so this detector reports nothing for that phrase;
 *    - any other step, or no state description → Misplaced Verification.
 *
 * Field: action. At most one finding per step; the span points to the first
 * matching word or phrase.
 * Confidence: rule · Severity: normal · Fix: ExtractVerification
 *
 * "See"/"Observe" followed by a documentation reference ("See the Help page")
 * becomes a review candidate instead of a finding.
 *
 * Requirements: 2.2, 2.3, 7.2, 8.1, 8.2, 10.2, 11.1, 11.2
 */

import type { Finding, ReviewCandidate } from '../models/index.js'
import { SMELLS } from '../smells.js'
import {
  VERIFICATION_VERBS,
  OUTCOME_WORDS,
  MAKE_SURE_PHRASES,
  findWords,
  hasStateDescription,
} from '../text/index.js'
import type { Span } from '../text/index.js'
import { isMakeSureState } from './misplacedPrecondition.js'
import type { DetectorContext, DetectorOutput } from './types.js'

const META = SMELLS['MisplacedVerification']

/** One-sentence reason naming the word found (<= 25 words, Req 2.3). */
export function reasonFor(word: string): string {
  const w = word.toLowerCase()
  return OUTCOME_WORDS.includes(w)
    ? `"${w}" describes an outcome; move it to the expected result.`
    : `"${w}" is a check; move it to the expected result.`
}

/**
 * "See" / "Observe" pointing at documentation ("See the Help page for
 * details") is an instruction to read something, not a verification.
 */
const DOC_REFERENCE = /\b(?:page|section|docs?|documentation|manual|guide|help|link|appendix|chapter|readme|note|notes|above|below)\b/i

function isDocReference(text: string, span: Span): boolean {
  const verb = span.text.toLowerCase()
  if (verb !== 'see' && verb !== 'observe') return false
  const rest = text.slice(span.end).split(/[,;.]|\band\b/i)[0] ?? ''
  return DOC_REFERENCE.test(rest)
}

/** Objects that make "check"/"uncheck" a tick-box action rather than a verification. */
const TICK_TARGET = /\b(?:check\s*box|checkbox|box|radio(?:\s+button)?|option|toggle|tick)\b/i

/** True when "check"/"uncheck" at `span` refers to ticking a control. */
function isTickAction(text: string, span: Span): boolean {
  const verb = span.text.toLowerCase()
  if (verb !== 'check' && verb !== 'uncheck') return false
  // Look at the rest of the clause after the verb (up to the next , ; . or "and").
  const rest = text.slice(span.end).split(/[,;.]|\band\b/i)[0] ?? ''
  return TICK_TARGET.test(rest)
}

/** True when a span lies inside any of the given spans. */
function insideAny(span: Span, others: Span[]): boolean {
  return others.some(o => span.start >= o.start && span.end <= o.end)
}

/** The clause that starts at `span` ("make sure …" up to the next clause break). */
function clauseFrom(text: string, span: Span): string {
  return text.slice(span.start).split(/[.;!?]|,\s*(?:then|and)\b|\s+then\s+/i)[0] ?? ''
}

/**
 * True when a "make sure"/"ensure" span opens the step and introduces a setup
 * state ("Make sure the user is logged in") — owned by Misplaced Precondition.
 * After another action ("Go to the tab and ensure the volume is set") it is a check.
 */
function isSetupState(text: string, span: Span): boolean {
  if (!/^\s*(?:please\s+)?$/i.test(text.slice(0, span.start))) return false
  return isMakeSureState(clauseFrom(text, span))
}

/**
 * Every check in an action text: verification verbs (except tick-box "check"
 * and documentation references), outcome wording and "make sure"/"ensure that"
 * (unless the first-step tie-break hands it to Misplaced Precondition).
 * Also used by the Extract Verification fixer to move every check.
 */
export function findChecks(text: string, _isFirstStep = false): { checks: Span[]; docReferences: Span[] } {
  const checks: Span[] = []
  const docReferences: Span[] = []

  // 3. "make sure" / "ensure that" / "ensure" tie-break: followed by a setup
  //    state ("make sure the user is logged in") it belongs to Misplaced
  //    Precondition in any step; otherwise ("make sure to click Save") it is a check.
  const makeSure = findWords(text, MAKE_SURE_PHRASES)
  for (const span of makeSure) if (!isSetupState(text, span)) checks.push(span)

  // 1. Verification verbs anywhere (skip words already covered by a make-sure
  //    phrase, e.g. "ensure" inside "ensure that", and tick-box "check").
  for (const span of findWords(text, VERIFICATION_VERBS)) {
    if (insideAny(span, makeSure)) continue
    if (span.text.toLowerCase() === 'ensure' && isSetupState(text, span)) continue
    if (isTickAction(text, span)) continue
    if (isDocReference(text, span)) {
      docReferences.push(span)
      continue
    }
    checks.push(span)
  }

  // 2. Outcome wording
  checks.push(...findWords(text, OUTCOME_WORDS))
  checks.sort((a, b) => a.start - b.start)
  return { checks, docReferences }
}

export const misplacedVerification = (ctx: DetectorContext): DetectorOutput => {
  const { testCase, step } = ctx
  const text = step.action ?? ''
  if (text.trim() === '') return { findings: [], reviewCandidates: [] }

  const { checks: candidates, docReferences } = findChecks(text)

  // Req 11.2: review candidates only when there is no finding for this step.
  if (candidates.length === 0) {
    const doc = docReferences[0]
    if (!doc) return { findings: [], reviewCandidates: [] }
    const review: ReviewCandidate = {
      caseId: testCase.id,
      stepIndex: step.index,
      smellName: META.smellName,
      field: 'action',
      hint: `"${doc.text}" may point to documentation rather than a check; review needed.`,
    }
    return { findings: [], reviewCandidates: [review] }
  }

  const first = candidates[0]!

  const finding: Finding = {
    caseId: testCase.id,
    stepIndex: step.index,
    field: 'action',
    span: { start: first.start, end: first.end },
    smellName: META.smellName,
    ghostName: META.ghostName,
    reason: reasonFor(first.text),
    confidence: 'rule',
    fixName: META.fixName,
    severity: 'normal',
  }

  return { findings: [finding], reviewCandidates: [] }
}
