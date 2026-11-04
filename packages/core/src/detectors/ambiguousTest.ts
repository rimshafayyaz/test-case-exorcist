/**
 * Ambiguous Test detector — "Fog Wraith"
 *
 * Reports under-specified wording that leaves pass/fail open to
 * interpretation, e.g. "Check the page loads quickly." or
 * "Open any application and suspend machine."
 *
 * Detection (docs/smells.md §1):
 * - Confident finding (word lists, Req 3.3):
 *     VAGUE_WORDS (similar, better, clear, easy, fast, works, normal, appropriate)
 *     and MANNER_ADVERBS (properly, correctly, quickly, …).
 *     "clear" used as the command verb ("Clear the field.") is an action, not vague.
 * - Review candidate only (part-of-speech patterns, Req 3.4):
 *     verb + indefinite determiner ("open any application", "enter some text"),
 *     indefinite pronoun (something, anyone, …),
 *     comparative or superlative adjective ("faster", "latest", "best"),
 *     comparative adverb ("more easily").
 *   Measurable comparisons are not vague and are skipped:
 *     "larger than 2 MB", "more than 5 items", "at least 8 characters".
 *
 * Fields: action and each verification (with verificationIndex). At most one
 * finding per field entry; the span points to the first vague word.
 * Review candidates are dropped when the step has a finding (Req 11.2).
 * Confidence: rule · Severity: normal · Fix: ExtractAmbiguity
 *
 * Requirements: 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 10.2, 11.1, 11.2, 11.3
 */

import type { Finding, ReviewCandidate } from '../models/index.js'
import { SMELLS } from '../smells.js'
import {
  VAGUE_WORDS,
  MANNER_ADVERBS,
  INDEFINITE_DETERMINERS,
  INDEFINITE_PRONOUNS,
  findWords,
  tag,
  isDeclarativeClause,
  imperativeStartInfo,
} from '../text/index.js'
import type { ImperativeStart, Span, Token } from '../text/index.js'
import type { DetectorContext, DetectorOutput } from './types.js'

const META = SMELLS['AmbiguousTest']

/** One-sentence reason naming the vague word (<= 25 words, Req 2.3). */
export function reasonFor(word: string): string {
  return `"${word.toLowerCase()}" is vague; replace it with a specific, measurable value.`
}

type Field = 'action' | 'verification'

/** Words that make a comparison without the -er/-est form. */
const IRREGULAR_COMPARATIVES = new Set(['worse', 'worst', 'best', 'more', 'most', 'less', 'least', 'fewer', 'fewest'])

function isComparativeOrSuperlative(token: Token): boolean {
  const t = token.tags
  if (!t.includes('Adjective') && !t.includes('Adverb') && !t.includes('Determiner')) return false
  if (t.includes('Comparative') || t.includes('Superlative')) return true
  if (IRREGULAR_COMPARATIVES.has(token.normal)) return true
  // compromise does not always tag superlatives ("best"); fall back on -est adjectives.
  return t.includes('Adjective') && token.normal.length >= 5 && token.normal.endsWith('est')
}

/** True when the comparison at `i` is measurable: "larger than 2 MB", "at least 8". */
function isMeasurable(tokens: Token[], i: number): boolean {
  const prev = tokens[i - 1]
  if (prev?.normal === 'at') return true // "at least", "at most"
  const isValue = (k: number) => tokens[k]?.tags.includes('Value') ?? false
  if (isValue(i + 1)) return true // "fewer 3"-style counts
  if (tokens[i + 1]?.normal === 'than') return isValue(i + 2) || isValue(i + 3)
  return false
}

interface Hit {
  word: string
  span: Span
}

interface Hit {
  word: string
  span: Span
}

/**
 * Common words ending in -er that are not comparatives (only -er words: every
 * -est word still goes to the tagger). Add a word only if it can never be a
 * comparative, e.g. not "later" or "faster". They are skipped
 * only by the cheap pre-check below; the tagger still decides for other words.
 */
const NOT_COMPARATIVE = new Set([
  'user', 'users', 'number', 'browser', 'folder', 'filter', 'server', 'enter', 'order', 'after', 'under',
  'other', 'never', 'over', 'ever', 'either', 'whether', 'register', 'header', 'footer', 'owner', 'member',
  'printer', 'computer', 'character', 'parameter', 'container', 'layer', 'marker', 'timer', 'counter',
  'slider', 'banner', 'answer', 'letter', 'paper', 'water', 'cover', 'power', 'center', 'master', 'player',
  'trigger', 'scanner', 'reader', 'viewer', 'manager', 'customer', 'provider', 'controller', 'driver',
  'cluster', 'remember', 'offer', 'transfer', 'tester',
])

/**
 * Cheap pre-check: a POS-only pattern needs an indefinite word or a
 * comparative/superlative-looking word. Skipping texts without one saves a
 * compromise call; the result is the same for every text that is tagged.
 */
const INDEFINITE_OR_IRREGULAR = new Set([...INDEFINITE_DETERMINERS, ...INDEFINITE_PRONOUNS, ...IRREGULAR_COMPARATIVES])

function hasPosCandidate(text: string): boolean {
  for (const raw of text.toLowerCase().split(/[^a-z-]+/)) {
    if (!raw) continue
    if (INDEFINITE_OR_IRREGULAR.has(raw)) return true
    if (/^[a-z]{2,}er$|^[a-z]{3,}est$/.test(raw) && !NOT_COMPARATIVE.has(raw)) return true
  }
  return false
}

/** Single-word indefinite determiners; multi-word ones ("a few") are matched as phrases. */
const SINGLE_DETERMINERS = new Set(INDEFINITE_DETERMINERS.filter(w => !w.includes(' ')))
const PHRASE_DETERMINERS = INDEFINITE_DETERMINERS.filter(w => w.includes(' '))

/**
 * Verb + indefinite determiner ("open any application", "select either of the
 * files", "add a few items") or an indefinite pronoun ("type something").
 * Both are word-list matches, so they are findings (Req 3.1, 3.2).
 */
function firstIndefinite(text: string): Hit | null {
  const lower = text.toLowerCase()
  const hasWord = (w: string) => new RegExp(`\\b${w}\\b`).test(lower)
  if (![...SINGLE_DETERMINERS, ...PHRASE_DETERMINERS, ...INDEFINITE_PRONOUNS].some(hasWord)) return null
  const tokens = tag(text)
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!
    const hit = (end = tok.end): Hit => ({ word: text.slice(tok.start, end), span: { start: tok.start, end, text: text.slice(tok.start, end) } })
    if (INDEFINITE_PRONOUNS.includes(tok.normal)) return hit()
    const phrase = PHRASE_DETERMINERS.find(p => text.slice(tok.start).toLowerCase().startsWith(p + ' '))
    if (!SINGLE_DETERMINERS.has(tok.normal) && !phrase) continue
    let k = i - 1
    if (tokens[k]?.tags.includes('Particle')) k--
    // compromise sometimes tags a command verb as an adjective ("Select either …").
    const verbBefore = tokens[k]?.tags.includes('Verb') || (k === 0 && imperativeStartInfo(text) !== null)
    if (verbBefore) return hit(phrase ? tok.start + phrase.length : tok.end)
  }
  return null
}

/** First POS-only pattern in `text`, or null (Req 3.2, 3.4): comparatives and superlatives. */
function firstPosPattern(text: string): Hit | null {
  if (!hasPosCandidate(text)) return null
  const tokens = tag(text)
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!
    const hit = (): Hit => ({ word: tok.text, span: { start: tok.start, end: tok.end, text: tok.text } })
    if (isComparativeOrSuperlative(tok) && !isMeasurable(tokens, i)) {
      // "more"/"less" alone only counts before an adjective or adverb ("more easily").
      if (tok.normal === 'more' || tok.normal === 'less') {
        const next = tokens[i + 1]
        if (!next || !(next.tags.includes('Adjective') || next.tags.includes('Adverb'))) continue
      }
      return hit()
    }
  }
  return null
}

/**
 * Other under-specified wording from the 2026 study, as review candidates
 * (often fine, so the LLM reviewer decides, Req 3.4):
 *   - a command with an unnamed object: "Insert a media card", "Make a search";
 *   - "each"/"every" ("Repeat for every type of media");
 *   - an unclear subject: "It should change the results".
 * Plain text checks, no extra tagging.
 */
function firstVagueReference(text: string): Hit | null {
  const at = (re: RegExp): Hit | null => {
    const m = re.exec(text)
    if (!m) return null
    const start = m.index + (m[0].length - m[0].trimStart().length)
    const word = m[1]!
    const s = text.indexOf(word, start)
    return { word, span: { start: s, end: s + word.length, text: word } }
  }
  const unnamed = /^\s*([A-Za-z][\w-]*)\s+an?\s/.exec(text)
  if (unnamed && imperativeStartInfo(text)) {
    const s = text.indexOf(' a', unnamed[0].length - 3) + 1
    const word = text.slice(s, unnamed[0].length).trim()
    return { word, span: { start: s, end: s + word.length, text: word } }
  }
  return at(/\b(each|every)\b/i) ?? at(/^\s*(it|this|that)\s+(?:should|is|will|must|does|has|can|may)\b/i)
}

/** First vague-word or manner-adverb match in `text`, or null (Req 3.3). */
function firstListHit(text: string): Hit | null {
  const spans = [...findWords(text, VAGUE_WORDS), ...findWords(text, MANNER_ADVERBS)]
    .filter(span => !isClearCommand(text, span))
    .sort((a, b) => a.start - b.start)
  const first = spans[0]
  return first ? { word: first.text, span: first } : null
}

/**
 * "clear" used as a command verb ("Clear the field", "then clear the cache")
 * is an action. At the start of a clause it is a command only when an object
 * follows and the clause is not a statement: "Clear instructions are shown."
 * and "Clear and simple steps." use "clear" as an adjective.
 */
function isClearCommand(text: string, span: Span): boolean {
  if (span.text.toLowerCase() !== 'clear') return false
  const before = text.slice(0, span.start)
  if (/(?:^|[.;,!?]|\b(?:and|then))\s*$/i.test(before)) {
    const clause = text.slice(span.start).split(/[.;,!?]/)[0] ?? ''
    const tokens = tag(clause)
    const next = tokens[1]
    if (!next) return true // "Clear." — the button or command on its own
    if (next.tags.includes('Conjunction')) return false
    const info: ImperativeStart = {
      word: tokens[0]!.text,
      normal: tokens[0]!.normal,
      start: tokens[0]!.start,
      end: tokens[0]!.end,
      via: 'list',
      tokens,
      index: 0,
    }
    return !isDeclarativeClause(info)
  }
  const token = tag(text).find(t => t.start === span.start)
  return token?.tags.includes('Imperative') ?? false
}

export const ambiguousTest = (ctx: DetectorContext): DetectorOutput => {
  const { testCase, step } = ctx
  const findings: Finding[] = []
  let review: ReviewCandidate | null = null

  const entries: { field: Field; text: string; verificationIndex?: number }[] = [
    { field: 'action', text: step.action ?? '' },
    ...step.verifications.map((text, i) => ({ field: 'verification' as const, text, verificationIndex: i })),
  ]

  for (const { field, text, verificationIndex } of entries) {
    if (!text || text.trim() === '') continue

    const listHit = firstListHit(text)
    if (listHit) {
      findings.push({
        caseId: testCase.id,
        stepIndex: step.index,
        field,
        ...(verificationIndex !== undefined ? { verificationIndex } : {}),
        span: { start: listHit.span.start, end: listHit.span.end },
        smellName: META.smellName,
        ghostName: META.ghostName,
        reason: reasonFor(listHit.word),
        confidence: 'rule',
        fixName: META.fixName,
        severity: 'normal',
      })
      continue
    }

    const indefinite = firstIndefinite(text)
    if (indefinite) {
      findings.push({
        caseId: testCase.id,
        stepIndex: step.index,
        field,
        ...(verificationIndex !== undefined ? { verificationIndex } : {}),
        span: { start: indefinite.span.start, end: indefinite.span.end },
        smellName: META.smellName,
        ghostName: META.ghostName,
        reason: reasonFor(indefinite.word),
        confidence: 'rule',
        fixName: META.fixName,
        severity: 'normal',
      })
      continue
    }

    if (review) continue
    const posHit = firstPosPattern(text) ?? firstVagueReference(text)
    if (posHit) {
      const where = field === 'action' ? 'the action' : `verification[${verificationIndex}]`
      review = {
        caseId: testCase.id,
        stepIndex: step.index,
        smellName: META.smellName,
        field,
        ...(verificationIndex !== undefined ? { verificationIndex } : {}),
        hint: `"${posHit.word}" in ${where} may be vague; review needed.`,
      }
    }
  }

  // Req 11.2: a confident finding for this step makes the review candidate redundant.
  return { findings, reviewCandidates: findings.length === 0 && review ? [review] : [] }
}
