/**
 * Unit tests for the Unverified Action detector (Silent Ghost).
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { describe, it, expect } from 'vitest'
import { unverifiedAction } from '../../src/detectors/unverifiedAction.js'
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
// Core smell detection (9.1, 9.2)
// ---------------------------------------------------------------------------

describe('unverifiedAction — core detection', () => {
  it('reports Unverified Action when a step has no verifications at all (smelly)', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Click Save.')

    const { findings, reviewCandidates } = unverifiedAction({
      testCase: tc,
      step,
      isFirstStep: true,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]!.smellName).toBe('UnverifiedAction')
    expect(findings[0]!.field).toBe('verification')
    expect(findings[0]!.severity).toBe('normal')
    expect(findings[0]!.confidence).toBe('rule')
    expect(findings[0]!.fixName).toBe('FillVerification')
    expect(findings[0]!.ghostName).toBe('Silent Ghost')
    expect(findings[0]!.caseId).toBe('tc-1')
    expect(findings[0]!.stepIndex).toBe(0)
    expect(reviewCandidates).toHaveLength(0)
  })

  it('does NOT report when the step has a non-empty verification (clean)', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Click Save.', ["A 'Saved' message appears."])

    const { findings } = unverifiedAction({
      testCase: tc,
      step,
      isFirstStep: true,
    })

    expect(findings).toHaveLength(0)
  })

  it('reports when all verifications are whitespace-only (req 9.2)', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Click Save.', ['   ', '\t', ''])

    const { findings } = unverifiedAction({
      testCase: tc,
      step,
      isFirstStep: false,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]!.smellName).toBe('UnverifiedAction')
    expect(findings[0]!.severity).toBe('normal')
  })

  it('does NOT report when at least one verification is non-empty among mixed list', () => {
    const tc = makeCase()
    const step = makeStep(1, 'Press Enter.', ['', "The form is submitted."])

    const { findings } = unverifiedAction({
      testCase: tc,
      step,
      isFirstStep: false,
    })

    expect(findings).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Navigation exception (9.3, 9.4)
// ---------------------------------------------------------------------------

describe('unverifiedAction — navigation exception', () => {
  it('reports severity "low" for a navigation step followed by a verified step (req 9.3)', () => {
    const tc = makeCase()
    const navStep = makeStep(0, 'Open the browser.')
    const nextStep = makeStep(1, 'Click Sign In.', ['The sign-in page is displayed.'])

    const { findings } = unverifiedAction({
      testCase: tc,
      step: navStep,
      isFirstStep: true,
      nextStep,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]!.smellName).toBe('UnverifiedAction')
    expect(findings[0]!.severity).toBe('low')
  })

  it('reason for navigation exception notes that missing verification may be intentional (req 9.4)', () => {
    const tc = makeCase()
    const navStep = makeStep(0, 'Open the browser.')
    const nextStep = makeStep(1, 'Click Sign In.', ['The sign-in page is displayed.'])

    const { findings } = unverifiedAction({
      testCase: tc,
      step: navStep,
      isFirstStep: true,
      nextStep,
    })

    expect(findings[0]!.reason.toLowerCase()).toMatch(/may be intentional/)
  })

  it('normal reason says step cannot pass or fail', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Click Save.')

    const { findings } = unverifiedAction({ testCase: tc, step, isFirstStep: false })

    expect(findings[0]!.reason).toBe(
      'No expected result, so this step cannot pass or fail.'
    )
  })

  it('navigation reason uses the fixed phrase (Req 2.3)', () => {
    const tc = makeCase()
    const navStep = makeStep(0, 'Open the browser.')
    const nextStep = makeStep(1, 'Click Sign In.', ['The sign-in page is displayed.'])

    const { findings } = unverifiedAction({
      testCase: tc,
      step: navStep,
      isFirstStep: true,
      nextStep,
    })

    expect(findings[0]!.reason).toBe(
      'No expected result; for a navigation step this may be intentional.'
    )
  })

  it('every reason is at most 25 words (Req 2.3)', () => {
    const tc = makeCase()

    // Normal case
    const { findings: f1 } = unverifiedAction({
      testCase: tc,
      step: makeStep(0, 'Click Save.'),
      isFirstStep: false,
    })
    expect(wordCount(f1[0]!.reason)).toBeLessThanOrEqual(25)

    // Navigation exception case
    const { findings: f2 } = unverifiedAction({
      testCase: tc,
      step: makeStep(0, 'Open the browser.'),
      isFirstStep: true,
      nextStep: makeStep(1, 'Click Login.', ['The page loads.']),
    })
    expect(wordCount(f2[0]!.reason)).toBeLessThanOrEqual(25)
  })

  it('reports severity "normal" for a navigation step that is the LAST step (no next step)', () => {
    const tc = makeCase()
    const navStep = makeStep(0, 'Open the browser.')

    const { findings } = unverifiedAction({
      testCase: tc,
      step: navStep,
      isFirstStep: true,
      // nextStep is undefined
    })

    expect(findings[0]!.severity).toBe('normal')
  })

  it('reports severity "normal" for a navigation step followed by an UNVERIFIED step', () => {
    const tc = makeCase()
    const navStep = makeStep(0, 'Open the browser.')
    const nextStep = makeStep(1, 'Click Sign In.') // no verifications

    const { findings } = unverifiedAction({
      testCase: tc,
      step: navStep,
      isFirstStep: true,
      nextStep,
    })

    // Next step has no verification, so the exception does NOT apply
    expect(findings[0]!.severity).toBe('normal')
  })

  it('applies the navigation exception for "go to" (multi-word phrase)', () => {
    const tc = makeCase()
    const navStep = makeStep(0, 'Go to the settings page.')
    const nextStep = makeStep(1, 'Click Save.', ['The settings are saved.'])

    const { findings } = unverifiedAction({
      testCase: tc,
      step: navStep,
      isFirstStep: true,
      nextStep,
    })

    expect(findings[0]!.severity).toBe('low')
  })

  it('applies the navigation exception for "navigate to" (multi-word phrase)', () => {
    const tc = makeCase()
    const navStep = makeStep(0, 'Navigate to the dashboard.')
    const nextStep = makeStep(1, 'Click Save.', ['The dashboard is displayed.'])

    const { findings } = unverifiedAction({
      testCase: tc,
      step: navStep,
      isFirstStep: true,
      nextStep,
    })

    expect(findings[0]!.severity).toBe('low')
  })

  it('applies the navigation exception for "launch" (single navigation verb)', () => {
    const tc = makeCase()
    const navStep = makeStep(0, 'Launch the application.')
    const nextStep = makeStep(1, 'Click Login.', ['The login screen appears.'])

    const { findings } = unverifiedAction({
      testCase: tc,
      step: navStep,
      isFirstStep: true,
      nextStep,
    })

    expect(findings[0]!.severity).toBe('low')
  })

  it('applies navigation exception case-insensitively', () => {
    const tc = makeCase()
    const navStep = makeStep(0, 'OPEN the browser.')
    const nextStep = makeStep(1, 'Click Login.', ['The login page is displayed.'])

    const { findings } = unverifiedAction({
      testCase: tc,
      step: navStep,
      isFirstStep: true,
      nextStep,
    })

    expect(findings[0]!.severity).toBe('low')
  })

  it('does NOT apply navigation exception for a non-navigation verb step', () => {
    const tc = makeCase()
    const step = makeStep(1, 'Click Save.')
    const nextStep = makeStep(2, 'Press OK.', ['The dialog closes.'])

    const { findings } = unverifiedAction({
      testCase: tc,
      step,
      isFirstStep: false,
      nextStep,
    })

    expect(findings[0]!.severity).toBe('normal')
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('unverifiedAction — edge cases', () => {
  it('reports when verifications array is empty', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Press Enter.', [])

    const { findings } = unverifiedAction({ testCase: tc, step, isFirstStep: false })

    expect(findings).toHaveLength(1)
  })

  it('does NOT report when step has a verification with just a period (non-whitespace)', () => {
    const tc = makeCase()
    const step = makeStep(0, 'Press Enter.', ['.'])

    const { findings } = unverifiedAction({ testCase: tc, step, isFirstStep: false })

    expect(findings).toHaveLength(0)
  })

  it('finding caseId matches the test case id', () => {
    const tc = makeCase('my-case-42')
    const step = makeStep(3, 'Delete the record.')

    const { findings } = unverifiedAction({ testCase: tc, step, isFirstStep: false })

    expect(findings[0]!.caseId).toBe('my-case-42')
    expect(findings[0]!.stepIndex).toBe(3)
  })
})
describe('unverifiedAction — steps that are checks or setup (Req 9.4)', () => {
  const run = (action: string, isFirstStep = false) =>
    unverifiedAction({ testCase: makeCase(), step: makeStep(1, action, []), isFirstStep })

  it.each([
    'Adjust the volume. Verify that the audio volume changes.',
    'Make sure the user is logged in.',
    'Please ensure the Nautilus window is running.',
    'The menu should appear.',
  ])('"%s" with no verification → not reported (the check or setup is in the action)', text => {
    expect(run(text).findings).toHaveLength(0)
  })

  it('a pure state first step → not reported (it is a precondition)', () => {
    expect(run('The monitor is not connected.', true).findings).toHaveLength(0)
  })

  it('"Click Save." with no verification → still reported', () => {
    expect(run('Click Save.').findings).toHaveLength(1)
  })
})
