/**
 * Unit tests for the Ambiguous Test detector (Fog Wraith).
 *
 * Requirements: 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 11.1, 11.2, 11.3
 */

import { describe, it, expect } from 'vitest'
import { ambiguousTest, reasonFor } from '../../src/detectors/ambiguousTest.js'
import type { TestCase, Step } from '../../src/models/index.js'

function makeCase(id = 'tc-1'): TestCase {
  return { id, title: 'Test', preconditions: [], steps: [] }
}

function makeStep(index: number, action: string, verifications: string[] = []): Step {
  return { index, action, verifications }
}

function run(action: string, verifications: string[] = []) {
  return ambiguousTest({ testCase: makeCase(), step: makeStep(1, action, verifications), isFirstStep: false })
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('ambiguousTest — examples from docs/smells.md', () => {
  it('"Check the page loads quickly." → smelly', () => {
    const { findings, reviewCandidates } = run('Check the page loads quickly.')
    expect(findings).toHaveLength(1)
    const f = findings[0]!
    expect(f.smellName).toBe('AmbiguousTest')
    expect(f.ghostName).toBe('Fog Wraith')
    expect(f.fixName).toBe('ExtractAmbiguity')
    expect(f.field).toBe('action')
    expect(f.confidence).toBe('rule')
    expect(f.severity).toBe('normal')
    expect(f.reason).toBe('"quickly" is vague; replace it with a specific, measurable value.')
    expect(reviewCandidates).toHaveLength(0)
  })

  it('"Open any application and suspend machine." → finding on "any" (verb + indefinite determiner, Req 3.1)', () => {
    const { findings, reviewCandidates } = run('Open any application and suspend machine.')
    expect(findings).toHaveLength(1)
    expect(findings[0]!.reason).toContain('"any"')
    expect(reviewCandidates).toHaveLength(0)
  })

  it.each(['The page loads within 2 seconds.', 'Open the Calculator application.'])('"%s" → clean', text => {
    const { findings, reviewCandidates } = run(text)
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(0)
  })
})

describe('ambiguousTest — word lists give findings (Req 3.3)', () => {
  it.each([
    ['Verify the feature works.', 'works'],
    ['Use a similar file.', 'similar'],
    ['The menu is clear.', 'clear'],
    ['Restart the app normally.', 'normally'],
    ['Close it more easily.', 'easily'],
    ['Check the layout looks appropriate.', 'appropriate'],
  ])('"%s" → finding on "%s"', (text, word) => {
    const { findings } = run(text)
    expect(findings).toHaveLength(1)
    const span = findings[0]!.span!
    expect(text.slice(span.start, span.end).toLowerCase()).toBe(word)
  })

  it.each(['Clear the field.', 'Click Save, then clear the cache.'])(
    '"clear" as a command verb is an action: "%s" → clean',
    text => {
      expect(run(text).findings).toHaveLength(0)
    },
  )

  it('does not match parts of words ("fastener", "normalize")', () => {
    expect(run('Tighten the fastener.').findings).toHaveLength(0)
    expect(run('Normalize the input file.').findings).toHaveLength(0)
  })
})

describe('ambiguousTest — indefinite words give findings (Req 3.1, 3.2)', () => {
  it.each([
    ['Press any key.', 'any'],
    ['Enter some text.', 'some'],
    ['Type something.', 'something'],
    ['Select either of the .ogg files.', 'either'],
    ['Add a few items.', 'a few'],
    ['Talk briefly into the microphone.', 'briefly'],
    ['Turn the volume to a reasonable level.', 'reasonable'],
  ])('"%s" → finding on "%s"', (text, word) => {
    const { findings } = run(text)
    expect(findings).toHaveLength(1)
    expect(findings[0]!.reason).toContain(`"${word}"`)
  })
})

describe('ambiguousTest — POS-only patterns are review candidates (Req 3.2, 3.4)', () => {
  it.each([
    ['Check the page loads faster.', 'faster'],
    ['Pick the best option.', 'best'],
    ['Install the latest version.', 'latest'],
    ['Upload a larger file.', 'larger'],
    ['Insert a media card into the reader.', 'a'],
    ['Repeat for every type of media.', 'every'],
    ['It should change the results.', 'It'],
  ])('"%s" → review on "%s"', (text, word) => {
    const { findings, reviewCandidates } = run(text)
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(1)
    expect(reviewCandidates[0]!.hint).toContain(`"${word}"`)
  })

  it.each([
    'Password has at least 8 characters.',
    'File is larger than 2 MB.',
    'Enter more than 5 items.',
    'Some fields are empty.',
    'Select the first item.',
  ])('measurable or specific wording: "%s" → clean', text => {
    const { findings, reviewCandidates } = run(text)
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(0)
  })
})

describe('ambiguousTest — verifications (Req 11.3)', () => {
  it('finding in a verification has field and verificationIndex', () => {
    const { findings } = run('Click Save.', ['A message appears.', 'The page loads fast.'])
    expect(findings).toHaveLength(1)
    expect(findings[0]!.field).toBe('verification')
    expect(findings[0]!.verificationIndex).toBe(1)
  })

  it('one finding per field entry: action and verification both vague → 2 findings', () => {
    const { findings } = run('Restart the app normally.', ['It works.'])
    expect(findings.map(f => f.field)).toEqual(['action', 'verification'])
  })

  it('review candidate in a verification keeps its index', () => {
    const { reviewCandidates } = run('Click Save.', ['The message appears.', 'It should change.'])
    expect(reviewCandidates).toHaveLength(1)
    expect(reviewCandidates[0]!.field).toBe('verification')
    expect(reviewCandidates[0]!.verificationIndex).toBe(1)
  })

  it('Req 11.2: a finding anywhere in the step drops the review candidate', () => {
    const { findings, reviewCandidates } = run('Upload a larger file.', ['The page loads fast.'])
    expect(findings).toHaveLength(1)
    expect(reviewCandidates).toHaveLength(0)
  })
})

describe('ambiguousTest — shape and edge cases', () => {
  it('empty action and verifications → nothing', () => {
    const { findings, reviewCandidates } = run('', ['', '  '])
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(0)
  })

  it('at most one finding per field entry, span on the first vague word', () => {
    const text = 'Restart the app normally and check it works.'
    const { findings } = run(text)
    expect(findings).toHaveLength(1)
    const span = findings[0]!.span!
    expect(text.slice(span.start, span.end)).toBe('normally')
  })

  it('caseId and stepIndex come from the context', () => {
    const { findings } = ambiguousTest({
      testCase: makeCase('case-2'),
      step: makeStep(6, 'Verify it works.'),
      isFirstStep: false,
    })
    expect(findings[0]!.caseId).toBe('case-2')
    expect(findings[0]!.stepIndex).toBe(6)
  })

  it('reason names the word and is at most 25 words (Req 2.3)', () => {
    expect(wordCount(reasonFor('appropriately'))).toBeLessThanOrEqual(25)
  })
})

describe('ambiguousTest — review follow-ups', () => {
  it.each(['Clear and simple steps.', 'Clear instructions are shown.'])(
    '"clear" as an adjective at the start: "%s" → finding',
    text => {
      const { findings } = run(text)
      expect(findings).toHaveLength(1)
      expect(findings[0]!.reason).toContain('"clear"')
    },
  )

  it.each(['Clear all filters.', 'Clear cache.', 'Clear.'])('"clear" as a command: "%s" → clean', text => {
    expect(run(text).findings).toHaveLength(0)
  })

  it.each([
    ['The page loads fast.', 'fast'],
    ['Verify it responds appropriately for all users.', 'appropriately'],
    ['The result is better than expected.', 'better'],
  ])('"%s" → finding on "%s"', (text, word) => {
    const { findings } = run(text)
    expect(findings).toHaveLength(1)
    expect(findings[0]!.reason).toContain(`"${word}"`)
  })

  it.each(['Response time is less than 100 ms.', 'Enter the value more than once.'])(
    'measurable: "%s" → clean',
    text => {
      const { findings, reviewCandidates } = run(text)
      expect(findings).toHaveLength(0)
      expect(reviewCandidates).toHaveLength(0)
    },
  )

  it('Req 11.2 other direction: finding in the action drops a review from a verification', () => {
    const { findings, reviewCandidates } = run('Restart the app normally.', ['It should change.'])
    expect(findings).toHaveLength(1)
    expect(reviewCandidates).toHaveLength(0)
  })
})
