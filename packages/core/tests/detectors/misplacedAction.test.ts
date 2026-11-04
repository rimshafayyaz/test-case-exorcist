/**
 * Unit tests for the Misplaced Action detector (Wanderer).
 *
 * Requirements: 2.1, 2.2, 2.3, 6.1, 6.2, 11.1
 */

import { describe, it, expect } from 'vitest'
import { misplacedAction, reasonFor } from '../../src/detectors/misplacedAction.js'
import type { TestCase, Step } from '../../src/models/index.js'

function makeCase(id = 'tc-1'): TestCase {
  return { id, title: 'Test', preconditions: [], steps: [] }
}

function makeStep(index: number, action: string, verifications: string[] = []): Step {
  return { index, action, verifications }
}

function run(...verifications: string[]) {
  return misplacedAction({
    testCase: makeCase(),
    step: makeStep(1, 'Open the settings page.', verifications),
    isFirstStep: false,
  })
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('misplacedAction — examples from docs/smells.md', () => {
  it('verification "Click OK to continue." → smelly', () => {
    const { findings, reviewCandidates } = run('Click OK to continue.')
    expect(findings).toHaveLength(1)
    const f = findings[0]!
    expect(f.smellName).toBe('MisplacedAction')
    expect(f.ghostName).toBe('Wanderer')
    expect(f.fixName).toBe('ExtractAction')
    expect(f.field).toBe('verification')
    expect(f.verificationIndex).toBe(0)
    expect(f.confidence).toBe('rule')
    expect(f.severity).toBe('normal')
    expect(reviewCandidates).toHaveLength(0)
  })

  it('paper example "Add the files to the folder as in the previous step." → smelly, span on "Add"', () => {
    const text = 'Add the files to the folder as in the previous step.'
    const { findings } = run(text)
    expect(findings).toHaveLength(1)
    const span = findings[0]!.span!
    expect(text.slice(span.start, span.end)).toBe('Add')
  })

  it('"The confirmation dialog closes." → clean', () => {
    const { findings, reviewCandidates } = run('The confirmation dialog closes.')
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(0)
  })

  it('"Verify the dialog closes." → clean (verification verb, Req 6.2)', () => {
    expect(run('Verify the dialog closes.').findings).toHaveLength(0)
  })
})

describe('misplacedAction — verification verbs are never reported (Req 6.2)', () => {
  it.each([
    'Check the page title is Dashboard.',
    'Confirm the order is placed.',
    'Ensure the total is 100.',
    'Observe the progress bar.',
    'See the welcome message.',
    'Validate the receipt.',
    'Make sure the dialog closes.',
    'Ensure that the file is saved.',
    'Assert the modal is shown.',
    'Verify the total is correct.',
  ])('"%s" → clean', text => {
    const { findings, reviewCandidates } = run(text)
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(0)
  })
})

describe('misplacedAction — statements are not actions (declarative guard)', () => {
  it.each([
    'Message appears.',
    'Save button is enabled.',
    'Close button is visible.',
    'Login page is displayed.',
    'Saved message appears.',
    'The app keeps running.',
    'Settings page opens.',
  ])('"%s" → clean', text => {
    const { findings, reviewCandidates } = run(text)
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(0)
  })
})

describe('misplacedAction — more actions in verifications', () => {
  it.each([
    'Close the dialog.',
    'Select Urdu.',
    'Wait 5 seconds.',
    'Type your name.',
    'Press Enter.',
  ])('"%s" → smelly', text => {
    expect(run(text).findings).toHaveLength(1)
  })

  it('action in a later clause: "The dialog opens, then click OK." → smelly', () => {
    const text = 'The dialog opens, then click OK.'
    const { findings } = run(text)
    expect(findings).toHaveLength(1)
    const span = findings[0]!.span!
    expect(text.slice(span.start, span.end)).toBe('click')
  })

  it('span points to the verb inside the verification text', () => {
    const text = 'Click OK to continue.'
    const span = run(text).findings[0]!.span!
    expect(text.slice(span.start, span.end)).toBe('Click')
  })

  it('reports per verification entry with the right verificationIndex', () => {
    const { findings } = run('The dialog closes.', 'Click OK.', 'Press Enter.')
    expect(findings.map(f => f.verificationIndex)).toEqual([1, 2])
  })

  it('at most one finding per verification entry', () => {
    expect(run('Click OK and press Enter.').findings).toHaveLength(1)
  })
})

describe('misplacedAction — ambiguous starts become review candidates (Req 11.1)', () => {
  it('"Switch position" (noun/verb unclear, no object marker) → review candidate', () => {
    const { findings, reviewCandidates } = run('Switch position')
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(1)
    expect(reviewCandidates[0]!.smellName).toBe('MisplacedAction')
    expect(reviewCandidates[0]!.hint).toMatch(/verification\[0\]/)
    expect(reviewCandidates[0]!.field).toBe('verification')
    expect(reviewCandidates[0]!.verificationIndex).toBe(0)
  })

  it('review candidate keeps its verificationIndex for later entries', () => {
    const { reviewCandidates } = run('The dialog closes.', 'Switch position')
    expect(reviewCandidates).toHaveLength(1)
    expect(reviewCandidates[0]!.verificationIndex).toBe(1)
  })

  it('Req 11.2: a finding in another entry of the same step drops the review candidate', () => {
    const { findings, reviewCandidates } = run('Switch position', 'Click OK.')
    expect(findings).toHaveLength(1)
    expect(findings[0]!.verificationIndex).toBe(1)
    expect(reviewCandidates).toHaveLength(0)
  })

  it('a finding in the same entry wins over a review candidate', () => {
    const { findings, reviewCandidates } = run('Switch position, then click OK.')
    expect(findings).toHaveLength(1)
    expect(reviewCandidates).toHaveLength(0)
  })
})

describe('misplacedAction — shape and edge cases', () => {
  it('ignores the action field', () => {
    const { findings } = misplacedAction({
      testCase: makeCase(),
      step: makeStep(0, 'Click OK.', ['The dialog closes.']),
      isFirstStep: true,
    })
    expect(findings).toHaveLength(0)
  })

  it('empty and whitespace verifications → nothing', () => {
    const { findings, reviewCandidates } = run('', '   ')
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(0)
  })

  it('caseId and stepIndex come from the context', () => {
    const { findings } = misplacedAction({
      testCase: makeCase('case-7'),
      step: makeStep(4, 'Open the app.', ['Click OK.']),
      isFirstStep: false,
    })
    expect(findings[0]!.caseId).toBe('case-7')
    expect(findings[0]!.stepIndex).toBe(4)
  })

  it('reason names the verb and is at most 25 words (Req 2.3)', () => {
    expect(run('Click OK.').findings[0]!.reason).toBe(
      '"click" is an action; move it from the expected result to the step actions.',
    )
    expect(wordCount(reasonFor('Click'))).toBeLessThanOrEqual(25)
  })
})

describe('misplacedAction — held-out tuning (dev half)', () => {
  it.each([
    'Name, username and password are accepted.',
    'Apt hits each of the package mirrors and update all of them without error.',
    'The timezone, date and time match the settings you selected.',
    "The system boots and loads the installer with 'Try Ubuntu' and 'Install Ubuntu' buttons.",
    'Return: Prompt=normal',
    'Check that on boot a question to enable and boot from a degraded array is asked.',
  ])('statement, not a command: "%s" → clean', text => {
    expect(run(text).findings).toHaveLength(0)
  })

  it.each(['cat /proc/mdstat', 'sudo mount', 'telnet 127.0.0.1 25', 'sudo apt-get install -y binutils'])(
    'a shell command line is an action: "%s" → smelly',
    text => {
      const { findings } = run(text)
      expect(findings).toHaveLength(1)
      expect(text.slice(findings[0]!.span!.start, findings[0]!.span!.end)).toBe(text.split(' ')[0])
    },
  )

  it('a command after ", then" in a statement is still an action: "The dialog opens, then click OK."', () => {
    expect(run('The dialog opens, then click OK.').findings).toHaveLength(1)
  })

  it('a command sentence keeps its "and" actions: "Click OK and press Enter."', () => {
    expect(run('Click OK and press Enter.').findings).toHaveLength(1)
  })
})
