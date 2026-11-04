/**
 * Text analysis utilities for smell detectors.
 *
 * All functions are pure and synchronous with no network calls.
 * Uses `compromise` for POS tagging.
 *
 * Tag names confirmed against compromise 14.14.3:
 *   Verb, Imperative, Auxiliary, Modal, PastTense, PresentTense,
 *   Adjective, Comparative, Adverb, Noun, Determiner, Pronoun, Conjunction
 */

import nlp from 'compromise'
import { COMMON_ACTION_VERBS } from './wordLists.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single POS-tagged token with its position in the original text. */
export interface Token {
  /** The original text of the token (preserves case). */
  text: string
  /** Lower-cased normal form. */
  normal: string
  /** POS tags assigned by compromise (e.g. ["Verb", "Imperative"]). */
  tags: string[]
  /** Character offset of the first character of this token in the input string. */
  start: number
  /** Character offset one past the last character of this token. */
  end: number
}

/** A span of matched text with character offsets. */
export interface Span {
  start: number
  end: number
  /** The matched text as it appears in the input. */
  text: string
}

// ---------------------------------------------------------------------------
// tag() — wrap compromise and return tokens with character offsets
// ---------------------------------------------------------------------------

/**
 * Tokenise and POS-tag `text` using compromise.
 * Returns one `Token` per word-token, each with accurate character offsets
 * computed by scanning forward through the original string.
 */
/** Cache of tagged texts: detectors analyse the same step text many times. */
const TAG_CACHE = new Map<string, Token[]>()
const TAG_CACHE_LIMIT = 20000

/**
 * Tokenise and POS-tag `text`, reusing earlier results for the same text.
 * The returned array is shared between callers and must not be modified.
 */
export function tag(text: string): Token[] {
  if (!text || text.trim() === '') return []
  const cached = TAG_CACHE.get(text)
  if (cached) return cached
  if (TAG_CACHE.size >= TAG_CACHE_LIMIT) TAG_CACHE.clear()
  const tokens = tagUncached(text)
  TAG_CACHE.set(text, tokens)
  return tokens
}

/** The parts of a compromise term we read (compromise 14 internal document view). */
interface CompromiseTerm {
  text: string
  normal?: string
  tags: Set<string>
}

function tagUncached(text: string): Token[] {
  // Read the tagged terms straight from the document view (doc.docs) instead
  // of doc.json(): same text, normal form and tags, without building JSON.
  const sentences = (nlp(text) as unknown as { docs: CompromiseTerm[][] }).docs

  // compromise doesn't give character offsets, so rebuild them by scanning
  // the original string in document order.
  const tokens: Token[] = []
  let cursor = 0
  for (const sentence of sentences) {
    for (const term of sentence) {
      const tokenText = term.text
      const idx = text.indexOf(tokenText, cursor)
      const start = idx === -1 ? cursor : idx
      const end = start + tokenText.length
      cursor = end
      tokens.push({
        text: tokenText,
        normal: term.normal ?? tokenText.toLowerCase(),
        tags: [...term.tags],
        start,
        end,
      })
    }
  }
  return tokens
}

// ---------------------------------------------------------------------------
// splitClauses() — split text into clause-level fragments
// ---------------------------------------------------------------------------

/**
 * Split `text` into clause-level fragments.
 * Splits on: sentence ends (. ! ?), semicolons, commas, "and", "then"
 * between verb phrases (when the remaining clause is long enough to be one).
 *
 * Returns non-empty trimmed strings only.
 */
export function splitClauses(text: string): string[] {
  if (!text || text.trim() === '') return []

  const clauses = text
    // Split on sentence-ending punctuation
    .split(/(?<=[.!?])\s+/)
    // Split on semicolons
    .flatMap(fragment => fragment.split(/;\s*/))
    // Split on commas (the design spec says "commas before verbs")
    .flatMap(fragment => fragment.split(/,\s+/))
    // Split on " and " / " then " / " or " when the clause is at least 3 words
    // (avoids splitting "open and close" when it's a short 2-word fragment)
    .flatMap(fragment => {
      const words = fragment.trim().split(/\s+/)
      if (words.length >= 3) {
        return fragment.split(/\s+(?:and|then|or)\s+/i)
      }
      return [fragment]
    })
    .map(s => s.trim())
    .filter(s => s.length > 0)

  return clauses
}

// ---------------------------------------------------------------------------
// isImperativeStart() — detect an imperative-first clause
// ---------------------------------------------------------------------------

/**
 * Leading connector words that may prefix a clause after splitting on "and"/"then".
 * These are skipped before checking whether the first real word is imperative.
 */
const LEADING_CONNECTORS = new Set([
  'then',
  'and',
  'also',
  'please',
  'now',
])

/**
 * Returns `true` when `clause` begins with a base-form verb that is not
 * a modal or auxiliary (i.e. an imperative command).
 *
 * Strategy (in order):
 * 1. Strip leading connector words ("then", "and", "also", "please", "now").
 * 2. Check whether the first remaining word is in COMMON_ACTION_VERBS — a
 *    curated list of verbs that compromise sometimes mis-tags as Noun/Adjective.
 *    If it matches, return true immediately (no POS needed).
 * 3. Fall back to compromise tagging: accept `Imperative`, or
 *    `Verb + Infinitive` without `Modal`/`Auxiliary`.
 */
export function isImperativeStart(clause: string): boolean {
  return imperativeStartInfo(clause) !== null
}

/** Details about the imperative verb that starts a clause. */
export interface ImperativeStart {
  /** The verb as written. */
  word: string
  /** Lower-cased verb. */
  normal: string
  /** Character offsets of the verb inside the clause. */
  start: number
  end: number
  /**
   * 'pos'  — compromise tagged it as an imperative / base-form verb;
   * 'list' — only matched COMMON_ACTION_VERBS (compromise tagged it as a
   *          noun or adjective), so it is less certain.
   */
  via: 'pos' | 'list'
  /** All tokens of the clause (for callers that need more context). */
  tokens: Token[]
  /** Index of the verb token in `tokens`. */
  index: number
}

/**
 * First words that can never start a command (articles, pronouns, numbers).
 * Checking them before tagging saves a compromise call for most statements
 * ("The dialog closes.", "It works."); the result is the same as tagging.
 */
const NON_VERB_STARTS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'it', 'its', 'he', 'she', 'they', 'we', 'i',
  'my', 'your', 'his', 'her', 'their', 'our', 'no', 'each', 'every', 'all', 'some', 'any',
  'if', 'when', 'unless', 'whether', 'while', 'because', 'otherwise',
])

/** First word of a clause after leading connectors ("then", "and", …), lower-cased, without punctuation. */
export function firstClauseWord(clause: string): string {
  const words = clause.trim().toLowerCase().split(/\s+/)
  let i = 0
  while (i < words.length && LEADING_CONNECTORS.has(words[i]!.replace(/[^a-z]/g, ''))) i++
  return (words[i] ?? '').replace(/[^a-z0-9-]/g, '')
}

/** True when the clause cannot start with a command (checked without tagging). */
export function startsWithNonVerb(clause: string): boolean {
  const first = firstClauseWord(clause)
  return first === '' || /^[0-9]/.test(first) || NON_VERB_STARTS.has(first)
}

/**
 * Like `isImperativeStart`, but returns details about the starting verb, or
 * `null` when the clause does not start with an imperative.
 */
export function imperativeStartInfo(clause: string): ImperativeStart | null {
  if (!clause || clause.trim() === '') return null
  if (startsWithNonVerb(clause)) return null

  const tokens = tag(clause)
  if (tokens.length === 0) return null

  // Step 1: skip leading connector tokens
  let idx = 0
  while (idx < tokens.length && LEADING_CONNECTORS.has(tokens[idx]!.normal)) {
    idx++
  }
  if (idx >= tokens.length) return null

  const first = tokens[idx]!
  const info = (via: 'pos' | 'list'): ImperativeStart => ({
    word: first.text,
    normal: first.normal,
    start: first.start,
    end: first.end,
    via,
    tokens,
    index: idx,
  })

  // Step 2: POS-based check
  const t = first.tags
  if (t.includes('Imperative')) return info('pos')
  if (
    t.includes('Verb') &&
    t.includes('Infinitive') &&
    !t.includes('Modal') &&
    !t.includes('Auxiliary')
  ) {
    return info('pos')
  }

  // Step 3: "right-click" / "double-click" — compromise splits them into two words.
  const second = tokens[idx + 1]
  if (second && second.normal === 'click' && COMMON_ACTION_VERBS.includes(`${first.normal}-click`)) {
    return { word: clause.slice(first.start, second.end), normal: `${first.normal}-click`, start: first.start, end: second.end, via: 'list', tokens, index: idx + 1 }
  }

  // Step 4: common action verbs that compromise sometimes mis-tags
  if (COMMON_ACTION_VERBS.includes(first.normal)) return info('list')

  return null
}

/** True when a token is a finite verb that makes a clause a statement. */
function isMainVerb(token: Token): boolean {
  const t = token.tags
  if (t.includes('Copula') || t.includes('Modal')) return true
  if (t.includes('Auxiliary') && !t.includes('Particle')) return true
  // 3rd-person present ("appears", "closes") or past ("closed", "appeared").
  return t.includes('Verb') && !t.includes('Infinitive') && !t.includes('Gerund') && !t.includes('Particle')
}

/**
 * True when a clause that seems to start with a verb is really a statement,
 * because a main verb follows the first word ("Message appears.",
 * "Close button is disabled."). The first word is then a subject or modifier.
 */
export function isDeclarativeClause(info: ImperativeStart): boolean {
  for (const token of info.tokens.slice(info.index + 1)) {
    // A determiner, preposition, pronoun or relative word after the first
    // word starts an object or a sub-clause ("Open the file that is saved"),
    // so any later verb does not belong to a subject + verb statement.
    // When only the word list made the first word a verb (compromise saw a
    // noun), a preposition can belong to the subject ("Set of items is loaded").
    const isBreak = CLAUSE_BREAK_TAGS.some(
      t => token.tags.includes(t) && !(t === 'Preposition' && info.via === 'list'),
    )
    if (isBreak || RELATIVE_WORDS.has(token.normal)) return false
    if (isMainVerb(token)) return true
  }
  return false
}

const CLAUSE_BREAK_TAGS = ['Determiner', 'Preposition', 'Pronoun', 'Possessive', 'Conjunction']
const RELATIVE_WORDS = new Set(['that', 'which', 'who', 'where', 'when', 'until', 'so'])

// ---------------------------------------------------------------------------
// findWords() — case-insensitive whole-word match with offsets
// ---------------------------------------------------------------------------

/**
 * Find all occurrences of any word (or phrase) from `wordList` in `text`.
 * Matching is case-insensitive and whole-word (word boundaries prevent
 * "check" matching "checkbox").
 *
 * Returns one `Span` per match (in document order, left to right).
 * Overlapping matches are not deduplicated; each entry in `wordList` is
 * searched independently.
 */
/** Compiled whole-word patterns, one per word or phrase. */
const WORD_PATTERNS = new Map<string, RegExp>()

/** Case-insensitive whole-word pattern for `word` (cached). */
function wordPattern(word: string): RegExp {
  let pattern = WORD_PATTERNS.get(word)
  if (!pattern) {
    // Escape regex special characters; lookarounds give whole-word matching
    // for single words and multi-word phrases alike.
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    pattern = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'gi')
    WORD_PATTERNS.set(word, pattern)
  }
  return pattern
}

export function findWords(text: string, wordList: readonly string[]): Span[] {
  if (!text || wordList.length === 0) return []

  const spans: Span[] = []

  for (const word of wordList) {
    const pattern = wordPattern(word)
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
      })
    }
  }

  // Sort by start offset
  spans.sort((a, b) => a.start - b.start)

  return spans
}

// ---------------------------------------------------------------------------
// hasStateDescription() — detect a "subject + auxiliary + participle" state
// ---------------------------------------------------------------------------

/** Auxiliaries that introduce a state ("is", "are", "has been", ...). */
const STATE_AUXILIARIES = new Set(['is', 'are', 'was', 'were', 'been', 'has', 'have', 'had'])

/** Words that may sit between the auxiliary and the participle. */
const STATE_MODIFIERS = new Set(['not', 'already', 'still', 'currently', 'fully', 'successfully'])

/**
 * Irregular past participles that look like the present tense, so compromise
 * tags them as Infinitive ("The file is read", "The password has been reset").
 */
const IRREGULAR_PARTICIPLES = new Set([
  'read', 'reset', 'set', 'put', 'cut', 'shut', 'hit', 'quit', 'spread', 'cast', 'upset', 'run',
])

/** States that are adjectives or particles rather than participles. */
const STATE_WORDS = new Set([
  'open', 'closed', 'shown', 'hidden', 'available', 'visible', 'enabled', 'disabled',
  'on', 'off', 'empty', 'running', 'active', 'inactive', 'online', 'offline', 'ready',
])

/**
 * Returns `true` when `text` describes a system state rather than an action:
 * an auxiliary ("is", "are", "was", "were", "has/have been"), optional
 * modifiers ("not", "already"), then a past participle or state word, e.g.
 * "The monitor is not connected", "The user is already logged in",
 * "The app is broken", "The password has been reset", "The dialog is open".
 *
 * Gerunds ("is loading") and numbers ("is 100") are not states.
 *
 * Used by the Misplaced Precondition / Misplaced Verification tie-break for
 * "make sure" / "ensure that" (docs/smells.md, Keyword ownership), and by the
 * Misplaced Precondition detector.
 */
export function hasStateDescription(text: string): boolean {
  if (!text || text.trim() === '') return false
  const tokens = tag(text)

  for (let i = 0; i < tokens.length; i++) {
    if (!STATE_AUXILIARIES.has(tokens[i]!.normal)) continue

    // Skip modifiers between the auxiliary and the participle.
    let j = i + 1
    while (j < tokens.length && STATE_MODIFIERS.has(tokens[j]!.normal)) j++
    const word = tokens[j]
    if (!word) continue

    const w = word.normal.replace(/[^a-z-]/g, '')
    const t = word.tags
    // State words first: "is running" is a state even though "running" is a gerund.
    if (STATE_WORDS.has(w)) return true
    if (t.includes('Gerund') || t.includes('Value') || t.includes('Adverb')) continue

    if (
      t.includes('Participle') ||
      t.includes('PastTense') ||
      t.includes('Adjective') ||
      IRREGULAR_PARTICIPLES.has(w) ||
      STATE_WORDS.has(w) ||
      (w.length >= 5 && /(?:ed|en)$/.test(w))
    ) {
      // "has been" — "been" itself is tagged Participle; look at the next word.
      if (w === 'been') continue
      return true
    }
  }
  return false
}
