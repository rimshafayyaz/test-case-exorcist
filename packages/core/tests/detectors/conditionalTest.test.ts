/**
 * Unit tests for the Conditional Test detector (Fork Spirit).
 *
 * Requirements: 4.1, 4.2, 11.1
 */

import { describe, it, expect } from 'vitest'
import { conditionalTest } from '../../src/detectors/conditionalTest.js'
import type { TestCase, Step } from '../../src/models/index.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCase(id = 'tc-1'): TestCase {
  return { id, title: 'Test', preconditions: [], steps: [] }
}

function makeStep(index: number, action: string, verifications: string[] = []): Step {
  return { index, action, verifications }
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

// ---------------------------------------------------------------------------
// Confident findings — single-word conjunctions in action (4.1)
// ---------------------------------------------------------------------------

describe('conditionalTest — subordinating conjunctions in action', () => {
  it('"If you have a USB drive, plug it in." → smelly (if)', () => {
    const tc = makeCase()
    const step = makeStep(0, 'If you have a USB drive, plug it in.')

    const { findings, reviewCandidates } = conditionalTest({
      testCase: tc, step, isFirstStep: true,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]!.smellName).toBe('ConditionalTest')
    expect(findings[0]!.field).toBe('action')
    expect(findings[0]!.confidence).toBe('rule')
    expect(findings[0]!.severity).toBe('normal')
    expect(findings[0]!.ghostName).toBe('Fork Spirit')
    expect(findings[0]!.fixName).toBe('ExtractConditional')
    expect(findings[0]!.caseId).toBe('tc-1')
    expect(findings[0]!.stepIndex).toBe(0)
    expect(reviewCandidates).toHaveLength(0)
  })

  it('"Unless the dialog closes, press Esc." → smelly (unless)', () => {
    const tc = makeCase()
    const step = makeStep(1, 'Unless the dialog closes, press Esc.')

    const { findings } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]!.smellName).toBe('ConditionalTest')
    expect(findings[0]!.field).toBe('action')
  })

  it('"Whether you use Chrome or Firefox, open the login page." → smelly (whether)', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Whether you use Chrome or Firefox, open the login page.')

    const { findings } = conditionalTest({
      testCase: tc, step, isFirstStep: true,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]!.smellName).toBe('ConditionalTest')
    expect(findings[0]!.field).toBe('action')
  })

  it('"otherwise" → smelly', () => {
    const tc = makeCase()
    const step = makeStep(2, 'Otherwise, close the application.')

    const { findings } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]!.field).toBe('action')
  })

  it('"Plug the USB drive into a free port." → clean (no findings, no review)', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Plug the USB drive into a free port.')

    const { findings, reviewCandidates } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Confident findings — multi-word conjunction phrases (4.1)
// ---------------------------------------------------------------------------

describe('conditionalTest — multi-word conjunction phrases', () => {
  it('"In case the dialog appears, dismiss it." → smelly (in case)', () => {
    const tc = makeCase()
    const step = makeStep(0, 'In case the dialog appears, dismiss it.')

    const { findings } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]!.smellName).toBe('ConditionalTest')
    expect(findings[0]!.field).toBe('action')
  })

  it('"Depending on the OS, choose the right installer." → smelly (depending on)', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Depending on the OS, choose the right installer.')

    const { findings } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]!.smellName).toBe('ConditionalTest')
    expect(findings[0]!.field).toBe('action')
  })
})

// ---------------------------------------------------------------------------
// "when" tie-break (4.2)
// ---------------------------------------------------------------------------

describe('conditionalTest — "when" tie-break', () => {
  it('"Click Save when you are ready." → confident finding (condition clause)', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Click Save when you are ready.')

    const { findings, reviewCandidates } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]!.smellName).toBe('ConditionalTest')
    expect(findings[0]!.field).toBe('action')
    expect(reviewCandidates).toHaveLength(0)
  })

  it('"Note when the download finishes." → review candidate only (time reference)', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Note when the download finishes.')

    const { findings, reviewCandidates } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    // Should NOT produce a confident finding
    expect(findings).toHaveLength(0)
    // Should produce exactly one review candidate
    expect(reviewCandidates).toHaveLength(1)
    expect(reviewCandidates[0]!.smellName).toBe('ConditionalTest')
    expect(reviewCandidates[0]!.caseId).toBe('tc-1')
    expect(reviewCandidates[0]!.stepIndex).toBe(0)
    expect(reviewCandidates[0]!.hint).toMatch(/when/)
  })

  it('"Submit the form when the user is logged in." → confident finding', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Submit the form when the user is logged in.')

    const { findings, reviewCandidates } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]!.smellName).toBe('ConditionalTest')
    expect(reviewCandidates).toHaveLength(0)
  })

  it('"when" followed by "the" (determiner) → confident finding', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Click OK when the dialog appears.')

    const { findings, reviewCandidates } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]!.smellName).toBe('ConditionalTest')
    expect(reviewCandidates).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Verification field detection (4.1 — also inspects verifications)
// ---------------------------------------------------------------------------

describe('conditionalTest — verification field', () => {
  it('detects conditional in a verification (field = "verification")', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Press OK.', ['If the file exists, it is deleted.'])

    const { findings } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]!.smellName).toBe('ConditionalTest')
    expect(findings[0]!.field).toBe('verification')
    expect(findings[0]!.verificationIndex).toBe(0)
  })

  it('detects conditional in the second verification (verificationIndex = 1)', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Click Submit.', [
      'The form is submitted.',
      'Unless an error occurs, the page reloads.',
    ])

    const { findings } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    // Second verification is smelly
    const verFindings = findings.filter(f => f.field === 'verification')
    expect(verFindings).toHaveLength(1)
    expect(verFindings[0]!.verificationIndex).toBe(1)
  })

  it('detects conditional in both action and verification simultaneously', () => {
    const tc = makeCase()
    const step = makeStep(0, 'If the file exists, delete it.', [
      'Whether the backup exists, check it.',
    ])

    const { findings } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings.length).toBeGreaterThanOrEqual(2)
    const actionFindings = findings.filter(f => f.field === 'action')
    const verFindings = findings.filter(f => f.field === 'verification')
    expect(actionFindings).toHaveLength(1)
    expect(verFindings).toHaveLength(1)
  })

  it('"when" in verification as time reference → review candidate (field context in hint)', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Click Save.', ['Note when the progress bar finishes.'])

    const { findings, reviewCandidates } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(1)
    expect(reviewCandidates[0]!.hint).toMatch(/verification/)
  })

  it('skips empty verifications without error', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Click Save.', ['', '   '])

    const { findings, reviewCandidates } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Case-insensitivity (11.1)
// ---------------------------------------------------------------------------

describe('conditionalTest — case-insensitive matching', () => {
  it('detects "IF" (uppercase) as smelly', () => {
    const tc = makeCase()
    const step = makeStep(0, 'IF you have a USB drive, plug it in.')

    const { findings } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings).toHaveLength(1)
  })

  it('detects "Unless" (mixed case) as smelly', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Unless the dialog closes, press Esc.')

    const { findings } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings).toHaveLength(1)
  })

  it('detects "IN CASE" (all caps) as smelly', () => {
    const tc = makeCase()
    const step = makeStep(0, 'IN CASE the file is missing, create it.')

    const { findings } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Finding shape validation
// ---------------------------------------------------------------------------

describe('conditionalTest — finding shape', () => {
  it('finding has the correct smellName, ghostName, fixName, confidence, severity', () => {
    const tc = makeCase('tc-99')
    const step = makeStep(3, 'If the file is missing, skip this step.')

    const { findings } = conditionalTest({
      testCase: tc, step, isFirstStep: false,
    })

    expect(findings).toHaveLength(1)
    const f = findings[0]!
    expect(f.smellName).toBe('ConditionalTest')
    expect(f.ghostName).toBe('Fork Spirit')
    expect(f.fixName).toBe('ExtractConditional')
    expect(f.confidence).toBe('rule')
    expect(f.severity).toBe('normal')
    expect(f.caseId).toBe('tc-99')
    expect(f.stepIndex).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Req 2.3 — every reason ≤ 25 words
// ---------------------------------------------------------------------------

describe('conditionalTest — reason length (Req 2.3)', () => {
  it('every confident finding reason is at most 25 words', () => {
    const tc = makeCase()
    const cases = [
      makeStep(0, 'If you have a USB drive, plug it in.'),
      makeStep(1, 'Unless the dialog closes, press Esc.'),
      makeStep(2, 'Whether you use Chrome or Firefox, open the login page.'),
      makeStep(3, 'In case the dialog appears, dismiss it.'),
      makeStep(4, 'Depending on the OS, choose the right installer.'),
      makeStep(5, 'Click Save when you are ready.'),
    ]

    for (const step of cases) {
      const { findings } = conditionalTest({ testCase: tc, step, isFirstStep: false })
      for (const f of findings) {
        expect(wordCount(f.reason)).toBeLessThanOrEqual(25)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Review candidate details and Req 11.2
// ---------------------------------------------------------------------------

describe('conditionalTest — review candidate fields and Req 11.2', () => {
  it('review candidate for the action has field "action"', () => {
    const { reviewCandidates } = conditionalTest({
      testCase: makeCase(), step: makeStep(1, 'Note when the download finishes.'), isFirstStep: false,
    })
    expect(reviewCandidates).toHaveLength(1)
    expect(reviewCandidates[0]!.field).toBe('action')
    expect(reviewCandidates[0]!.verificationIndex).toBeUndefined()
  })

  it('review candidate for a verification has field "verification" and its index', () => {
    const { reviewCandidates } = conditionalTest({
      testCase: makeCase(),
      step: makeStep(1, 'Click Download.', ['The bar fills up.', 'Note when the download finishes.']),
      isFirstStep: false,
    })
    expect(reviewCandidates).toHaveLength(1)
    expect(reviewCandidates[0]!.field).toBe('verification')
    expect(reviewCandidates[0]!.verificationIndex).toBe(1)
  })

  it('Req 11.2: a finding for the step drops review candidates for the same smell', () => {
    const { findings, reviewCandidates } = conditionalTest({
      testCase: makeCase(),
      step: makeStep(1, 'If a popup appears, close it.', ['Note when the download finishes.']),
      isFirstStep: false,
    })
    expect(findings).toHaveLength(1)
    expect(reviewCandidates).toHaveLength(0)
  })
})

describe('conditionalTest — specific reasons', () => {
  it('reason names the conditional word', () => {
    const { findings } = conditionalTest({
      testCase: makeCase(), step: makeStep(1, 'Unless the dialog closes, press Esc.'), isFirstStep: false,
    })
    expect(findings[0]!.reason).toMatch(/^"unless" adds a condition/)
    expect(wordCount(findings[0]!.reason)).toBeLessThanOrEqual(25)
  })

  it('reason for multi-word phrases names the phrase', () => {
    const { findings } = conditionalTest({
      testCase: makeCase(), step: makeStep(1, 'In case the dialog appears, dismiss it.'), isFirstStep: false,
    })
    expect(findings[0]!.reason).toMatch(/^"in case" adds a condition/)
  })
})

describe('conditionalTest — alternatives joined by "or" (2026 study)', () => {
  const runAction = (action: string) =>
    conditionalTest({ testCase: { id: 'c', title: 'T', preconditions: [], steps: [] }, step: { index: 1, action, verifications: [] }, isFirstStep: false })

  it.each([
    "Open ''Sound Preferences'' or ''Sound Setting''.",
    'Press the Super key, or click the Ubuntu logo.',
    'Click OK or press Enter.',
  ])('"%s" → finding on "or"', text => {
    const { findings } = runAction(text)
    expect(findings).toHaveLength(1)
    expect(findings[0]!.reason).toBe('"or" offers alternative paths; testers may follow different ones, so split it into separate tests.')
  })

  it.each(['Click OK, Cancel or Close.', 'Select Yes or No.', 'Open a .doc or .docx file.', 'Type your name or email.'])(
    'a list of options is not alternatives: "%s" → clean',
    text => {
      expect(runAction(text).findings).toHaveLength(0)
    },
  )
})
