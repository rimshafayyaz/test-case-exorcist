/**
 * Unit tests for the Misplaced Verification detector (Mixed Soul).
 *
 * Requirements: 2.2, 2.3, 7.2, 8.1, 8.2, 10.2
 */

import { describe, it, expect } from 'vitest'
import { misplacedVerification, reasonFor, findChecks } from '../../src/detectors/misplacedVerification.js'
import type { TestCase, Step } from '../../src/models/index.js'

function makeCase(id = 'tc-1'): TestCase {
  return { id, title: 'Test', preconditions: [], steps: [] }
}

function makeStep(index: number, action: string, verifications: string[] = []): Step {
  return { index, action, verifications }
}

function run(action: string, isFirstStep = false, index = isFirstStep ? 0 : 2) {
  return misplacedVerification({
    testCase: makeCase(),
    step: makeStep(index, action),
    isFirstStep,
  })
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('misplacedVerification — examples from docs/smells.md', () => {
  it('"Close flip and check app continuity." → smelly (verb in the middle)', () => {
    const { findings, reviewCandidates } = run('Close flip and check app continuity.')
    expect(findings).toHaveLength(1)
    expect(findings[0]!.smellName).toBe('MisplacedVerification')
    expect(findings[0]!.ghostName).toBe('Mixed Soul')
    expect(findings[0]!.fixName).toBe('ExtractVerification')
    expect(findings[0]!.field).toBe('action')
    expect(findings[0]!.confidence).toBe('rule')
    expect(findings[0]!.severity).toBe('normal')
    expect(reviewCandidates).toHaveLength(0)
  })

  it('"Verify the total is 100." → smelly', () => {
    expect(run('Verify the total is 100.').findings).toHaveLength(1)
  })

  it('"The menu should appear." → smelly (outcome wording)', () => {
    expect(run('The menu should appear.').findings).toHaveLength(1)
  })

  it('"The confirmation must be displayed." → smelly (outcome phrase)', () => {
    expect(run('The confirmation must be displayed.').findings).toHaveLength(1)
  })

  it('"Close the flip." → clean', () => {
    const { findings, reviewCandidates } = run('Close the flip.')
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(0)
  })

  it('every verification verb is detected anywhere in the action', () => {
    for (const verb of ['verify', 'check', 'confirm', 'ensure', 'assert', 'validate', 'observe', 'see']) {
      expect(run(`Open the report and ${verb} the totals.`).findings, verb).toHaveLength(1)
    }
  })
})

describe('misplacedVerification — "make sure" / "ensure that" tie-break', () => {
  it('"Make sure the user is logged in." as step 3 → nothing here (setup state, owned by Misplaced Precondition)', () => {
    expect(run('Make sure the user is logged in.', false, 2).findings).toHaveLength(0)
  })

  it('"Make sure the user is logged in." as step 1 → nothing here (owned by Misplaced Precondition)', () => {
    const { findings, reviewCandidates } = run('Make sure the user is logged in.', true)
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(0)
  })

  it('"Ensure that the file is saved." in any step → nothing here (state description)', () => {
    expect(run('Ensure that the file is saved.', true).findings).toHaveLength(0)
    expect(run('Ensure that the file is saved.', false, 1).findings).toHaveLength(0)
  })

  it('"Click Save and ensure that the form is saved." → exactly one finding, span on "ensure that"', () => {
    const text = 'Click Save and ensure that the form is saved.'
    const { findings } = run(text, false, 2)
    expect(findings).toHaveLength(1)
    const span = findings[0]!.span!
    expect(text.slice(span.start, span.end)).toBe('ensure that')
  })

  it('"Go to the Input tab and ensure the volume is set." → check after an action', () => {
    expect(run('Go to the Input tab and ensure the volume is set.', false, 2).findings).toHaveLength(1)
  })

  it('"The user is already logged in." as step 1 → nothing here (prerequisite wording belongs to Misplaced Precondition)', () => {
    expect(run('The user is already logged in.', true).findings).toHaveLength(0)
  })

  it('"Make sure to click Save." as step 1 → Misplaced Verification (no state description)', () => {
    expect(run('Make sure to click Save.', true).findings).toHaveLength(1)
  })

  it('"Ensure the total is 100." → Misplaced Verification in any step', () => {
    expect(run('Ensure the total is 100.', true).findings).toHaveLength(1)
    expect(run('Ensure the total is 100.', false, 4).findings).toHaveLength(1)
  })
})

describe('misplacedVerification — tick-box "check" is an action', () => {
  it('"Check the Remember me checkbox." → clean', () => {
    expect(run('Check the "Remember me" checkbox.').findings).toHaveLength(0)
  })

  it('"Uncheck the newsletter option." → clean', () => {
    expect(run('Uncheck the newsletter option.').findings).toHaveLength(0)
  })

  it('"Check the box and verify the total." → smelly (verify is still a check)', () => {
    expect(run('Check the box and verify the total.').findings).toHaveLength(1)
  })

  it('"Check the page title." → smelly (not a tick-box)', () => {
    expect(run('Check the page title.').findings).toHaveLength(1)
  })
})

describe('misplacedVerification — finding shape and limits', () => {
  it('reports at most one finding per step, with the span on the first match', () => {
    const text = 'Click Save, verify the toast and check the list.'
    const { findings } = run(text)
    expect(findings).toHaveLength(1)
    const span = findings[0]!.span!
    expect(text.slice(span.start, span.end).toLowerCase()).toBe('verify')
  })

  it('span points to "should" for outcome wording', () => {
    const text = 'The menu should appear.'
    const span = run(text).findings[0]!.span!
    expect(text.slice(span.start, span.end)).toBe('should')
  })

  it('does not match parts of words ("checkout", "seeding", "assertive")', () => {
    expect(run('Open the checkout page.').findings).toHaveLength(0)
    expect(run('Start database seeding.').findings).toHaveLength(0)
  })

  it('ignores verifications (only the action field is inspected)', () => {
    const { findings } = misplacedVerification({
      testCase: makeCase(),
      step: makeStep(1, 'Click Save.', ['Verify the toast appears.']),
      isFirstStep: false,
    })
    expect(findings).toHaveLength(0)
  })

  it('empty action → no findings', () => {
    expect(run('').findings).toHaveLength(0)
    expect(run('   ').findings).toHaveLength(0)
  })

  it('caseId and stepIndex come from the context', () => {
    const { findings } = misplacedVerification({
      testCase: makeCase('case-9'),
      step: makeStep(5, 'Verify the total.'),
      isFirstStep: false,
    })
    expect(findings[0]!.caseId).toBe('case-9')
    expect(findings[0]!.stepIndex).toBe(5)
  })

  it('reason names the word found and is at most 25 words (Req 2.3)', () => {
    expect(run('Verify the total.').findings[0]!.reason).toBe('"verify" is a check; move it to the expected result.')
    expect(run('The menu should appear.').findings[0]!.reason).toBe('"should" describes an outcome; move it to the expected result.')
    expect(run('Make sure to click Save.', true).findings[0]!.reason).toBe('"make sure" is a check; move it to the expected result.')
    for (const w of ['verify', 'should', 'make sure', 'ensure that']) {
      expect(wordCount(reasonFor(w))).toBeLessThanOrEqual(25)
    }
  })
})

describe('misplacedVerification — "See"/"Observe" pointing at documentation', () => {
  it('"See the Help page for details." → review candidate, not a finding', () => {
    const { findings, reviewCandidates } = run('See the Help page for details.')
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(1)
    expect(reviewCandidates[0]!.smellName).toBe('MisplacedVerification')
    expect(reviewCandidates[0]!.field).toBe('action')
  })

  it('"Observe the steps in the guide above." → review candidate', () => {
    expect(run('Observe the steps in the guide above.').reviewCandidates).toHaveLength(1)
  })

  it('"See the welcome message." → finding (a real check)', () => {
    const { findings, reviewCandidates } = run('See the welcome message.')
    expect(findings).toHaveLength(1)
    expect(reviewCandidates).toHaveLength(0)
  })

  it('Req 11.2: "See the Help page and verify the total." → finding only', () => {
    const { findings, reviewCandidates } = run('See the Help page and verify the total.')
    expect(findings).toHaveLength(1)
    expect(reviewCandidates).toHaveLength(0)
  })
})

describe('Misplaced Verification — button labels', () => {
  it.each(['Tap Confirm.', 'Click the Verify button.', "Press 'check' to continue."])('"%s" is a button, not a check', action => {
    expect(findChecks(action).checks).toEqual([])
  })
  it('a real check is still found', () => {
    expect(findChecks('Tap Save and confirm the payment.').checks.map(c => c.text)).toEqual(['confirm'])
  })
})
