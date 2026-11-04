/**
 * Unit tests for the Misplaced Precondition detector (Early Riser).
 *
 * Requirements: 2.2, 2.3, 7.1, 7.2, 7.3, 11.1, 11.2
 */

import { describe, it, expect } from 'vitest'
import { misplacedPrecondition, reasonFor, STATE_REASON, SETUP_REASON } from '../../src/detectors/misplacedPrecondition.js'
import { misplacedVerification } from '../../src/detectors/misplacedVerification.js'
import type { TestCase, Step } from '../../src/models/index.js'

function makeCase(id = 'tc-1'): TestCase {
  return { id, title: 'Test', preconditions: [], steps: [] }
}

function makeStep(index: number, action: string, verifications: string[] = []): Step {
  return { index, action, verifications }
}

function run(action: string, isFirstStep = true, index = isFirstStep ? 0 : 2) {
  return misplacedPrecondition({ testCase: makeCase(), step: makeStep(index, action), isFirstStep })
}

function spanText(action: string): string {
  const span = run(action).findings[0]!.span!
  return action.slice(span.start, span.end)
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('misplacedPrecondition — examples from docs/smells.md', () => {
  it('step 1 "The monitor is not connected, and the PC is not paired." → smelly', () => {
    const { findings, reviewCandidates } = run('The monitor is not connected, and the PC is not paired.')
    expect(findings).toHaveLength(1)
    const f = findings[0]!
    expect(f.smellName).toBe('MisplacedPrecondition')
    expect(f.ghostName).toBe('Early Riser')
    expect(f.fixName).toBe('ExtractPrecondition')
    expect(f.field).toBe('action')
    expect(f.confidence).toBe('rule')
    expect(f.severity).toBe('normal')
    expect(f.reason).toBe(STATE_REASON)
    expect(reviewCandidates).toHaveLength(0)
  })

  it('step 1 "The user is already logged in." → smelly', () => {
    expect(run('The user is already logged in.').findings).toHaveLength(1)
  })

  it('step 1 "Log in as the admin user." → clean', () => {
    const { findings, reviewCandidates } = run('Log in as the admin user.')
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(0)
  })
})

describe('misplacedPrecondition — first step only (Req 7.3)', () => {
  it.each([
    'The monitor is not connected, and the PC is not paired.',
    'The user is already logged in.',
    'Install the prerequisite packages.',
    'User has an account.',
  ])('"%s" as step 3 → nothing', text => {
    const { findings, reviewCandidates } = run(text, false)
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(0)
  })
})

describe('misplacedPrecondition — state descriptions (Req 7.1)', () => {
  it.each([
    'Monitor is connected.',
    'Wi-Fi is turned off.',
    'Device is charged and Bluetooth is enabled.',
    'The printer is on the network.',
    'The settings have been reset.',
  ])('step 1 "%s" → smelly', text => {
    expect(run(text).findings).toHaveLength(1)
  })

  it('a command with a relative clause is an action: "Open the file that is saved in Documents." → clean', () => {
    expect(run('Open the file that is saved in Documents.').findings).toHaveLength(0)
  })

  it('a statement whose first word looks like a verb: "Close button is disabled." → smelly', () => {
    expect(run('Close button is disabled.').findings).toHaveLength(1)
  })

  it('state after a command: "Click Save, and the dialog is closed." → smelly, span on the state clause', () => {
    const text = 'Click Save, and the dialog is closed.'
    expect(spanText(text)).toBe('the dialog is closed')
  })

  it('span covers the first state clause without the final period', () => {
    expect(spanText('The monitor is not connected, and the PC is not paired.')).toBe('The monitor is not connected')
    expect(spanText('The user is already logged in.')).toBe('The user is already logged in')
  })
})

describe('misplacedPrecondition — prerequisite wording (Req 7.2)', () => {
  it('"Install the prerequisite packages." → smelly, span on "prerequisite"', () => {
    const text = 'Install the prerequisite packages.'
    const { findings } = run(text)
    expect(findings).toHaveLength(1)
    expect(spanText(text)).toBe('prerequisite')
    expect(findings[0]!.reason).toBe('"prerequisite" marks a prerequisite; move it to the test case preconditions.')
  })

  it('"Create a backup beforehand." → smelly', () => {
    expect(run('Create a backup beforehand.').findings).toHaveLength(1)
  })

  it('state clause wins the span over a prerequisite word in the same step', () => {
    const { findings } = run('The user is already logged in.')
    expect(findings).toHaveLength(1)
    expect(findings[0]!.reason).toBe(STATE_REASON)
  })
})

describe('misplacedPrecondition — "make sure" / "ensure that" tie-break', () => {
  it('step 1 "Make sure the user is logged in." → Misplaced Precondition only', () => {
    const ctx = { testCase: makeCase(), step: makeStep(0, 'Make sure the user is logged in.'), isFirstStep: true }
    expect(misplacedPrecondition(ctx).findings).toHaveLength(1)
    expect(misplacedVerification(ctx).findings).toHaveLength(0)
  })

  it('step 3 "Make sure the user is logged in." → Misplaced Precondition only (setup state, Req 7.4)', () => {
    const ctx = { testCase: makeCase(), step: makeStep(2, 'Make sure the user is logged in.'), isFirstStep: false }
    expect(misplacedPrecondition(ctx).findings).toHaveLength(1)
    expect(misplacedPrecondition(ctx).findings[0]!.reason).toBe(SETUP_REASON)
    expect(misplacedVerification(ctx).findings).toHaveLength(0)
  })

  it('step 3 "Click Save and make sure the file is stored." → Misplaced Verification only (a check after an action)', () => {
    const ctx = { testCase: makeCase(), step: makeStep(2, 'Click Save and make sure the file is stored.'), isFirstStep: false }
    expect(misplacedPrecondition(ctx).findings).toHaveLength(0)
    expect(misplacedVerification(ctx).findings).toHaveLength(1)
  })

  it.each(['Ensure wireless is enabled.', 'Please ensure the Nautilus window is focused.', 'Make sure xubuntu-desktop is not installed.'])(
    'step 3 "%s" → Misplaced Precondition (bare "ensure" and "please" too)',
    text => {
      const ctx = { testCase: makeCase(), step: makeStep(2, text), isFirstStep: false }
      expect(misplacedPrecondition(ctx).findings).toHaveLength(1)
      expect(misplacedVerification(ctx).findings).toHaveLength(0)
    },
  )

  it('step 3 plain state "The user is logged in." → not reported (only the first step, Req 7.3)', () => {
    expect(run('The user is logged in.', false).findings).toHaveLength(0)
  })

  it('step 1 "Make sure to click Save." → not a precondition (no state description)', () => {
    expect(run('Make sure to click Save.').findings).toHaveLength(0)
  })

  it('step 1 "Ensure that the file is saved." → smelly', () => {
    expect(run('Ensure that the file is saved.').findings).toHaveLength(1)
  })
})

describe('misplacedPrecondition — review candidates (Req 11.1)', () => {
  it('step 1 "User has an account." (state without a participle) → review candidate', () => {
    const { findings, reviewCandidates } = run('User has an account.')
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(1)
    expect(reviewCandidates[0]!.smellName).toBe('MisplacedPrecondition')
    expect(reviewCandidates[0]!.field).toBe('action')
    expect(reviewCandidates[0]!.hint).toContain('"has"')
  })

  it('commands never become review candidates', () => {
    expect(run('Click Save.').reviewCandidates).toHaveLength(0)
    expect(run('Open the settings page.').reviewCandidates).toHaveLength(0)
  })
})

describe('misplacedPrecondition — shape and edge cases', () => {
  it('empty and whitespace actions → nothing', () => {
    expect(run('').findings).toHaveLength(0)
    expect(run('   ').reviewCandidates).toHaveLength(0)
  })

  it('caseId and stepIndex come from the context', () => {
    const { findings } = misplacedPrecondition({
      testCase: makeCase('case-3'),
      step: makeStep(1, 'The user is logged in.'),
      isFirstStep: true,
    })
    expect(findings[0]!.caseId).toBe('case-3')
    expect(findings[0]!.stepIndex).toBe(1)
  })

  it('ignores verifications', () => {
    const { findings } = misplacedPrecondition({
      testCase: makeCase(),
      step: makeStep(0, 'Click Save.', ['The file is saved.']),
      isFirstStep: true,
    })
    expect(findings).toHaveLength(0)
  })

  it('reasons are at most 25 words (Req 2.3)', () => {
    expect(wordCount(reasonFor())).toBeLessThanOrEqual(25)
    expect(wordCount(reasonFor('beforehand'))).toBeLessThanOrEqual(25)
  })
})

describe('misplacedPrecondition — review fixes (one owner per input)', () => {
  function both(action: string) {
    const ctx = { testCase: makeCase(), step: makeStep(0, action), isFirstStep: true }
    const p = misplacedPrecondition(ctx)
    return { mp: p.findings.length, mpReview: p.reviewCandidates.length, mv: misplacedVerification(ctx).findings.length }
  }

  it('step 1 "Ensure that the total is 100." (no state description) → Misplaced Verification only, no review here', () => {
    expect(both('Ensure that the total is 100.')).toEqual({ mp: 0, mpReview: 0, mv: 1 })
  })

  it('step 1 "Open Settings and ensure Wi-Fi is disabled." → Misplaced Verification only', () => {
    expect(both('Open Settings and ensure Wi-Fi is disabled.')).toEqual({ mp: 0, mpReview: 0, mv: 1 })
  })

  it('step 1 "Make sure the app has started." → Misplaced Precondition only', () => {
    expect(both('Make sure the app has started.')).toEqual({ mp: 1, mpReview: 0, mv: 0 })
  })

  it.each([
    'The app has started.',
    'The device has connected.',
    'Network adapters have been configured.',
    'Admin credentials are provided.',
  ])('step 1 "%s" → smelly ("has/have" + participle, proper-noun subjects)', text => {
    expect(run(text).findings).toHaveLength(1)
  })

  it('two state clauses: span covers the first one only', () => {
    expect(spanText('Network connection is available and Wi-Fi password is correct.')).toBe('Network connection is available')
  })

  it('"has" without a participle stays a review candidate: "The user has admin rights."', () => {
    const { findings, reviewCandidates } = run('The user has admin rights.')
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(1)
  })

  it('a command with a condition is not a precondition: "Log in as admin if the account exists."', () => {
    const { findings, reviewCandidates } = run('Log in as admin if the account exists.')
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(0)
  })
})

describe('misplacedPrecondition — noun subjects that look like verbs', () => {
  it.each(['Set of items is loaded.', 'Set of configuration items is loaded.'])('step 1 "%s" → smelly', text => {
    expect(run(text).findings).toHaveLength(1)
  })
})

describe('misplacedPrecondition — conditions belong to Conditional Test', () => {
  it.each(['If you have a USB drive, plug it in.', 'If the user is logged in, click Logout.', 'When the file is saved, close the app.'])(
    'step 1 "%s" → nothing here',
    text => {
      const { findings, reviewCandidates } = run(text)
      expect(findings).toHaveLength(0)
      expect(reviewCandidates).toHaveLength(0)
    },
  )
})

describe('misplacedPrecondition — held-out tuning (dev half)', () => {
  it.each([
    'Please ensure you have internet access or a local mirror.',
    'Make sure that your processor supports hardware virtualization.',
    'Make sure that Evince is not in fullscreen mode.',
  ])('setup state in a later step: "%s" → smelly', text => {
    expect(run(text, false).findings).toHaveLength(1)
  })

  it('"With …:" prefix lists what must be set up: smelly in any step, span on the prefix', () => {
    const text = 'With an HDMI monitor plugged in, and an MP3 file: install mpg321.'
    const { findings } = run(text, false)
    expect(findings).toHaveLength(1)
    const span = findings[0]!.span!
    expect(text.slice(span.start, span.end)).toBe('With an HDMI monitor plugged in, and an MP3 file')
  })

  it('"before proceeding" is prerequisite wording in the first step', () => {
    expect(run('Follow the network test steps before proceeding.').findings).toHaveLength(1)
  })

  it('"Ensure that the total is 100." stays a check (a value, not a setup state)', () => {
    const ctx = { testCase: makeCase(), step: makeStep(2, 'Ensure that the total is 100.'), isFirstStep: false }
    expect(misplacedPrecondition(ctx).findings).toHaveLength(0)
    expect(misplacedVerification(ctx).findings).toHaveLength(1)
  })
})
