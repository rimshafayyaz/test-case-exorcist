/**
 * Conditional Test detector — "Fork Spirit"
 *
 * Reports when a step contains conditional logic so that different testers may
 * follow different execution paths.
 *
 * Detection strategy (docs/smells.md §2, Keyword ownership table):
 *
 * 1. Subordinating conjunctions from SUBORDINATING_CONJUNCTIONS
 *    ('if', 'whether', 'unless', 'otherwise') anywhere in the text
 *    → confident finding.
 *
 * 2. Multi-word conjunction phrases from SUBORDINATING_CONJUNCTION_PHRASES
 *    ('in case', 'depending on') anywhere in the text
 *    → confident finding.
 *
 * 3. "when" — requires a tie-break:
 *    - Followed by a condition clause (subject + verb pattern, e.g.
 *      "when you have", "when the user is") → confident finding.
 *    - Used only as a time reference (e.g. "Note when the download finishes",
 *      where "when" is followed only by a noun/gerund before a sentence-ending
 *      verb like "finishes") → ReviewCandidate.
 *
 *    Heuristic: after "when" extract the next 1–3 words. If the first word is a
 *    pronoun ("you", "I", "we", "they", "he", "she", "it") or a determiner
 *    followed by a noun-ish word — i.e. the pattern looks like a subject —
 *    treat it as a condition clause. Otherwise it is a time reference.
 *
 * Inspected fields: action (field = 'action') and every verification
 * (field = 'verification', verificationIndex = i).
 *
 * Confidence: rule
 * Severity: normal
 * Fix: ExtractConditional
 *
 * Reason strings are capped at 25 words (Req 2.3).
 *
 * Requirements: 4.1, 4.2, 11.1
 */

import type { Finding, ReviewCandidate } from '../models/index.js'
import { SMELLS } from '../smells.js'
import {
  SUBORDINATING_CONJUNCTIONS,
  SUBORDINATING_CONJUNCTION_PHRASES,
} from '../text/index.js'
import { imperativeStartInfo, isDeclarativeClause } from '../text/index.js'
import { segment } from './eagerAction.js'
import type { DetectorContext, DetectorOutput } from './types.js'

const META = SMELLS['ConditionalTest']

// Reason strings — must be <= 25 words (Req 2.3). Do NOT quote step text.
/** One-sentence reason naming the conditional word (<= 25 words, Req 2.3). */
export function reasonFor(word: string): string {
  if (word.toLowerCase() === 'or') {
    return '"or" offers alternative paths; testers may follow different ones, so split it into separate tests.'
  }
  return `"${word.toLowerCase()}" adds a condition; testers may follow different paths, so split it into separate tests.`
}

/**
 * Alternatives joined by "or" are different flows (2026 study):
 *   - two quoted UI options: "Open 'Sound Preferences' or 'Sound Setting'";
 *   - two commands: "Press the Super key, or click the Ubuntu logo".
 * A list of labels ("Click OK, Cancel or Close") is one action, not alternatives.
 */
function hasAlternatives(text: string): boolean {
  if (!/\bor\b/i.test(text)) return false
  if (/["'”’]\s*,?\s+or\s+["'‘“]/i.test(text)) return true
  const segs = segment(text)
  return segs.some((seg, i) => {
    // ", or click …" arrives as a comma segment that starts with "or".
    const leadingOr = /^or\s+/i.exec(seg.text)
    if (i === 0 || (seg.sep !== 'or' && !leadingOr)) return false
    const text = leadingOr ? seg.text.slice(leadingOr[0].length) : seg.text
    const info = imperativeStartInfo(text)
    if (!info || isDeclarativeClause(info)) return false
    // Needs an object or more words: a lone "Close" in a label list is not a command.
    return text.trim().split(/\s+/).length > 1 && imperativeStartInfo(segs[0]!.text) !== null
  })
}

// ---------------------------------------------------------------------------
// "when" tie-break helpers
// ---------------------------------------------------------------------------

/**
 * Personal subject pronouns: these are unambiguous — if the word immediately
 * after "when" is one of these, the clause is a condition ("when you have",
 * "when it crashes"), not a time reference.
 */
const PERSONAL_PRONOUNS = new Set([
  'you', 'i', 'we', 'they', 'he', 'she', 'it', 'your', 'this', 'that', 'there',
])

/**
 * Verbs that typically introduce a time-reference "when" clause.
 * e.g. "Note when the download finishes", "Record when the process completes".
 * When the main verb preceding "when" is one of these, "when" is a time marker.
 */
const TIME_REFERENCE_VERBS = new Set([
  'note', 'record', 'notice', 'observe', 'watch', 'wait',
])

/**
 * Returns true when the text following "when" looks like a condition clause
 * (subject + verb pattern), making it a confident finding.
 *
 * Strategy:
 * 1. If the main verb immediately BEFORE "when" is a time-reference verb
 *    (note, record, notice, observe, watch, wait), it is a time reference.
 * 2. If the word immediately AFTER "when" is a personal pronoun, it is a
 *    confident condition clause.
 * 3. If the word after "when" is a determiner ("a", "an", "the") followed
 *    by a noun + verb, check whether the main clause before "when" ends with
 *    a clear action verb (non-time-reference). If so, it is a condition.
 * 4. Otherwise: review candidate.
 */
function whenIsConditionClause(text: string): boolean {
  // Match "when" as a whole word, then capture the surrounding context.
  const whenPattern = /\bwhen\b\s+(\S+)/gi
  let match: RegExpExecArray | null

  while ((match = whenPattern.exec(text)) !== null) {
    const whenIndex = match.index
    const firstWordAfter = (match[1] ?? '').replace(/[.,!?;:]+$/g, '').toLowerCase()

    // Check 1: Is the word immediately before "when" a time-reference verb?
    // Extract the word just before "when".
    const beforeWhen = text.slice(0, whenIndex).trim()
    const wordsBefore = beforeWhen.split(/\s+/)
    const wordBeforeWhen = (wordsBefore[wordsBefore.length - 1] ?? '')
      .replace(/[.,!?;:]+$/g, '')
      .toLowerCase()

    if (TIME_REFERENCE_VERBS.has(wordBeforeWhen)) {
      // This occurrence of "when" is a time reference — not a condition.
      continue
    }

    // Check 2: Personal pronoun after "when" → always a condition clause.
    if (PERSONAL_PRONOUNS.has(firstWordAfter)) {
      return true
    }

    // Check 3: Determiner ("a", "an", "the") after "when" → condition clause
    // only if the preceding verb is NOT a time-reference verb (already handled).
    // "when the/a/an <noun> <verb>" after a real action verb → condition.
    if (firstWordAfter === 'the' || firstWordAfter === 'a' || firstWordAfter === 'an') {
      return true
    }
  }

  return false
}

// ---------------------------------------------------------------------------
// Core detection helpers
// ---------------------------------------------------------------------------

/**
 * Check whether `text` contains a subordinating conjunction or phrase that
 * makes it a confident Conditional Test finding.
 * Returns the matched word/phrase, or null if none found.
 */
function findConjunction(text: string): string | null {
  const lower = text.toLowerCase()

  // Check multi-word phrases first (longer matches take priority)
  for (const phrase of SUBORDINATING_CONJUNCTION_PHRASES) {
    const pattern = new RegExp(`(?<![\\w])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`, 'i')
    if (pattern.test(text)) return phrase
  }

  // Check single-word conjunctions
  for (const conj of SUBORDINATING_CONJUNCTIONS) {
    const pattern = new RegExp(`(?<![\\w])${conj}(?![\\w])`, 'i')
    if (pattern.test(lower)) return conj
  }

  return null
}

/**
 * Check whether `text` contains "when" and classify it.
 *
 * Returns:
 * - 'confident' if "when" is followed by a condition clause
 * - 'review' if "when" appears but looks like a time reference
 * - null if "when" is not present
 */
function classifyWhen(text: string): 'confident' | 'review' | null {
  if (!/\bwhen\b/i.test(text)) return null
  return whenIsConditionClause(text) ? 'confident' : 'review'
}

// ---------------------------------------------------------------------------
// Per-field analysis
// ---------------------------------------------------------------------------

interface FieldResult {
  type: 'confident' | 'review' | 'clean'
  matched?: string
}

function analyseText(text: string): FieldResult {
  if (!text || text.trim() === '') return { type: 'clean' }

  // 1. Check subordinating conjunctions / phrases first (these win over "when")
  const matched = findConjunction(text)
  if (matched !== null) {
    return { type: 'confident', matched }
  }

  // 2. Check "when" tie-break
  const whenResult = classifyWhen(text)
  if (whenResult === 'confident') {
    return { type: 'confident', matched: 'when' }
  }

  // 3. Alternatives joined by "or"
  if (hasAlternatives(text)) return { type: 'confident', matched: 'or' }

  if (whenResult === 'review') {
    return { type: 'review', matched: 'when' }
  }

  return { type: 'clean' }
}

// ---------------------------------------------------------------------------
// Exported detector
// ---------------------------------------------------------------------------

export const conditionalTest = (ctx: DetectorContext): DetectorOutput => {
  const { testCase, step } = ctx
  const findings: Finding[] = []
  const reviewCandidates: ReviewCandidate[] = []

  // Helper to build a confident finding for a given field
  const addFinding = (
    field: 'action' | 'verification',
    matched: string,
    verificationIndex?: number,
  ): void => {
    const finding: Finding = {
      caseId: testCase.id,
      stepIndex: step.index,
      field,
      smellName: META.smellName,
      ghostName: META.ghostName,
      reason: reasonFor(matched),
      confidence: 'rule',
      fixName: META.fixName,
      severity: 'normal',
    }
    if (verificationIndex !== undefined) {
      finding.verificationIndex = verificationIndex
    }
    findings.push(finding)
  }

  // Helper to build a review candidate
  const addReview = (
    hint: string,
    field: 'action' | 'verification',
    verificationIndex?: number,
  ): void => {
    const candidate: ReviewCandidate = {
      caseId: testCase.id,
      stepIndex: step.index,
      smellName: META.smellName,
      field,
      hint,
    }
    if (verificationIndex !== undefined) candidate.verificationIndex = verificationIndex
    reviewCandidates.push(candidate)
  }

  // --- Inspect action ---
  const actionResult = analyseText(step.action)
  if (actionResult.type === 'confident') {
    addFinding('action', actionResult.matched ?? 'if')
  } else if (actionResult.type === 'review') {
    addReview(
      `"when" in action may be a time reference rather than a condition — review needed.`,
      'action',
    )
  }

  // --- Inspect each verification ---
  for (let i = 0; i < step.verifications.length; i++) {
    const verText = step.verifications[i]
    if (!verText || verText.trim() === '') continue

    const verResult = analyseText(verText)
    if (verResult.type === 'confident') {
      addFinding('verification', verResult.matched ?? 'if', i)
    } else if (verResult.type === 'review') {
      addReview(
        `"when" in verification[${i}] may be a time reference rather than a condition — review needed.`,
        'verification',
        i,
      )
    }
  }

  // Req 11.2: a confident finding for this step and smell makes review candidates redundant.
  return { findings, reviewCandidates: findings.length > 0 ? [] : reviewCandidates }
}
