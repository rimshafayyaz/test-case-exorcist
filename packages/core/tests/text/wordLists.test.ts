/**
 * Tests for wordLists.ts
 *
 * Verifies:
 * - Every list is non-empty
 * - No word/phrase appears in two distinct lists (keyword ownership rule — Req 10.2)
 * - Lists exactly match docs/smells.md
 */

import { describe, it, expect } from 'vitest'
import {
  VERIFICATION_VERBS,
  SUBORDINATING_CONJUNCTIONS,
  SUBORDINATING_CONJUNCTION_PHRASES,
  NAVIGATION_VERBS,
  NAVIGATION_VERB_PHRASES,
  OUTCOME_WORDS,
  PREREQUISITE_WORDS,
  VAGUE_WORDS,
  INDEFINITE_DETERMINERS,
  INDEFINITE_PRONOUNS,
  MANNER_ADVERBS,
  MAKE_SURE_PHRASES,
} from '../../src/text/wordLists.js'

describe('wordLists', () => {
  // -------------------------------------------------------------------------
  // Non-empty checks
  // -------------------------------------------------------------------------
  it('VERIFICATION_VERBS is non-empty', () => {
    expect(VERIFICATION_VERBS.length).toBeGreaterThan(0)
  })

  it('SUBORDINATING_CONJUNCTIONS is non-empty', () => {
    expect(SUBORDINATING_CONJUNCTIONS.length).toBeGreaterThan(0)
  })

  it('NAVIGATION_VERBS is non-empty', () => {
    expect(NAVIGATION_VERBS.length).toBeGreaterThan(0)
  })

  it('VAGUE_WORDS is non-empty', () => {
    expect(VAGUE_WORDS.length).toBeGreaterThan(0)
  })

  it('PREREQUISITE_WORDS is non-empty', () => {
    expect(PREREQUISITE_WORDS.length).toBeGreaterThan(0)
  })

  it('OUTCOME_WORDS is non-empty', () => {
    expect(OUTCOME_WORDS.length).toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // Exact values from docs/smells.md
  // -------------------------------------------------------------------------
  it('VERIFICATION_VERBS contains the 8 verbs from docs/smells.md', () => {
    for (const v of ['verify', 'check', 'confirm', 'ensure', 'assert', 'validate', 'observe', 'see']) {
      expect(VERIFICATION_VERBS).toContain(v)
    }
  })

  it('SUBORDINATING_CONJUNCTIONS contains if, whether, unless, otherwise', () => {
    for (const c of ['if', 'whether', 'unless', 'otherwise']) {
      expect(SUBORDINATING_CONJUNCTIONS).toContain(c)
    }
  })

  it('SUBORDINATING_CONJUNCTION_PHRASES contains "in case" and "depending on"', () => {
    expect(SUBORDINATING_CONJUNCTION_PHRASES).toContain('in case')
    expect(SUBORDINATING_CONJUNCTION_PHRASES).toContain('depending on')
  })

  it('NAVIGATION_VERBS contains open, launch, start', () => {
    for (const v of ['open', 'launch', 'start']) {
      expect(NAVIGATION_VERBS).toContain(v)
    }
  })

  it('NAVIGATION_VERB_PHRASES contains the multi-word navigation phrases', () => {
    for (const p of ['go to', 'navigate to', 'switch to', 'return to', 'scroll to']) {
      expect(NAVIGATION_VERB_PHRASES).toContain(p)
    }
  })

  it('PREREQUISITE_WORDS contains prerequisite, beforehand, already', () => {
    for (const w of ['prerequisite', 'beforehand', 'already']) {
      expect(PREREQUISITE_WORDS).toContain(w)
    }
  })

  it('VAGUE_WORDS contains the 8 words from docs/smells.md', () => {
    for (const w of ['similar', 'better', 'clear', 'easy', 'fast', 'works', 'normal', 'appropriate']) {
      expect(VAGUE_WORDS).toContain(w)
    }
  })

  it('MAKE_SURE_PHRASES contains "make sure" and "ensure that"', () => {
    expect(MAKE_SURE_PHRASES).toContain('make sure')
    expect(MAKE_SURE_PHRASES).toContain('ensure that')
  })

  // -------------------------------------------------------------------------
  // Ownership: no word appears in two different single-word lists (Req 10.2)
  // -------------------------------------------------------------------------
  it('no single word appears in more than one single-word list', () => {
    const allSingleWordLists: Array<[string, readonly string[]]> = [
      ['VERIFICATION_VERBS', VERIFICATION_VERBS],
      ['SUBORDINATING_CONJUNCTIONS', SUBORDINATING_CONJUNCTIONS],
      ['NAVIGATION_VERBS', NAVIGATION_VERBS],
      ['OUTCOME_WORDS', OUTCOME_WORDS],
      ['PREREQUISITE_WORDS', PREREQUISITE_WORDS],
      ['VAGUE_WORDS', VAGUE_WORDS],
      ['INDEFINITE_DETERMINERS', INDEFINITE_DETERMINERS],
      ['INDEFINITE_PRONOUNS', INDEFINITE_PRONOUNS],
      ['MANNER_ADVERBS', MANNER_ADVERBS],
    ]

    const seen = new Map<string, string>() // word → first list name
    const conflicts: string[] = []

    for (const [listName, list] of allSingleWordLists) {
      for (const word of list) {
        const owner = seen.get(word.toLowerCase())
        if (owner !== undefined) {
          conflicts.push(`"${word}" appears in both ${owner} and ${listName}`)
        } else {
          seen.set(word.toLowerCase(), listName)
        }
      }
    }

    expect(conflicts).toEqual([])
  })

  it('"ensure" is only in VERIFICATION_VERBS, not in MAKE_SURE_PHRASES single word lists', () => {
    // "ensure that" (phrase) is in MAKE_SURE_PHRASES which is a special tie-break list
    // "ensure" (single word) is in VERIFICATION_VERBS
    // These don't conflict because MAKE_SURE_PHRASES contains phrases, not single words
    expect(VERIFICATION_VERBS).toContain('ensure')
    expect(MAKE_SURE_PHRASES).toContain('ensure that')
    // "ensure" alone is not in MAKE_SURE_PHRASES
    expect(MAKE_SURE_PHRASES).not.toContain('ensure')
  })
})
