/**
 * Unit tests for the Eager Action detector (Hydra).
 *
 * Requirements: 2.2, 2.3, 5.1, 5.2, 11.1, 11.2
 */

import { describe, it, expect } from 'vitest'
import { eagerAction, reasonFor, segment } from '../../src/detectors/eagerAction.js'
import { misplacedVerification } from '../../src/detectors/misplacedVerification.js'
import type { TestCase, Step } from '../../src/models/index.js'

function makeCase(id = 'tc-1'): TestCase {
  return { id, title: 'Test', preconditions: [], steps: [] }
}

function makeStep(index: number, action: string, verifications: string[] = []): Step {
  return { index, action, verifications }
}

function run(action: string) {
  return eagerAction({ testCase: makeCase(), step: makeStep(1, action), isFirstStep: false })
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

describe('eagerAction — examples from docs/smells.md', () => {
  it('"Open settings, change language and save." → 3 actions', () => {
    const { findings, reviewCandidates } = run('Open settings, change language and save.')
    expect(findings).toHaveLength(1)
    const f = findings[0]!
    expect(f.smellName).toBe('EagerAction')
    expect(f.ghostName).toBe('Hydra')
    expect(f.fixName).toBe('SeparateActions')
    expect(f.field).toBe('action')
    expect(f.confidence).toBe('rule')
    expect(f.severity).toBe('normal')
    expect(f.reason).toBe('This step has 3 actions (open, change, save); split it into one step per action.')
    expect(reviewCandidates).toHaveLength(0)
  })

  it('"Close flip and reopen the app." → 2 actions', () => {
    expect(run('Close flip and reopen the app.').findings[0]!.reason).toContain('2 actions (close, reopen)')
  })

  it('"Open settings." → clean', () => {
    const { findings, reviewCandidates } = run('Open settings.')
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(0)
  })
})

describe('eagerAction — more bundled actions (Req 5.1)', () => {
  it.each([
    ['Copy the file. Paste it into the folder.', 2],
    ['Log in as admin and open the reports page.', 2],
    ['Type your name then press Enter.', 2],
    ['Go to Settings and select Language.', 2],
    ['Open the app; tap Menu; choose Help.', 3],
    ['Reset settings and restart.', 2],
    ['Restart and log in.', 2],
  ])('"%s" → %i actions', (text, n) => {
    const { findings } = run(text)
    expect(findings).toHaveLength(1)
    expect(findings[0]!.reason).toContain(`${n} actions`)
  })
})

describe('eagerAction — not extra actions', () => {
  it.each([
    'Click OK, Cancel or Close.',
    'Click Save and Close.',
    'Select "Yes", "No" and "Maybe".',
    'Enter username and password.',
  ])('UI labels in a list: "%s" → clean', text => {
    expect(run(text).findings).toHaveLength(0)
  })

  it('alternatives after "or": "Click OK or press Enter." → clean', () => {
    expect(run('Click OK or press Enter.').findings).toHaveLength(0)
  })

  it.each([
    'Press and hold the power button.',
    'Drag and drop the file onto the folder.',
    'Copy and paste the text.',
  ])('compound gesture: "%s" → clean', text => {
    expect(run(text).findings).toHaveLength(0)
  })

  it('statement after a command: "Click Save, and the dialog is closed." → clean', () => {
    expect(run('Click Save, and the dialog is closed.').findings).toHaveLength(0)
  })

  it('an action plus a check: "Close flip and check app continuity." → Eager Action AND Misplaced Verification (as in the 2026 study)', () => {
    const ctx = { testCase: makeCase(), step: makeStep(1, 'Close flip and check app continuity.'), isFirstStep: false }
    expect(eagerAction(ctx).findings[0]!.reason).toContain('2 actions (close, check)')
    expect(misplacedVerification(ctx).findings).toHaveLength(1)
  })

  it('checks alone: "Verify the total and check the list." → not Eager Action (one misplaced check)', () => {
    expect(run('Verify the total and check the list.').findings).toHaveLength(0)
  })

  it('an opening setup state is not an action: "Make sure the user is logged in, then click Save." → clean here', () => {
    expect(run('Make sure the user is logged in, then click Save.').findings).toHaveLength(0)
  })

  it('a quoted label counts as the object: \'Press "Try FAMILY" and wait for the session to start\' → 2 actions', () => {
    expect(run('Press "Try FAMILY" and wait for the session to start.').findings).toHaveLength(1)
  })

  it('"make sure" after an action is a second operation: "Click Save and make sure the file is stored." → 2 actions', () => {
    expect(run('Click Save and make sure the file is stored.').findings).toHaveLength(1)
  })
})

describe('eagerAction — review candidates (Req 11.1, 11.2)', () => {
  it('"Toggle on and click OK." (first word may be a noun) → review candidate', () => {
    const { findings, reviewCandidates } = run('Toggle on and click OK.')
    expect(findings).toHaveLength(0)
    expect(reviewCandidates).toHaveLength(1)
    expect(reviewCandidates[0]!.smellName).toBe('EagerAction')
    expect(reviewCandidates[0]!.field).toBe('action')
    expect(reviewCandidates[0]!.hint).toContain('2 actions')
  })

  it('a finding drops the review candidate', () => {
    expect(run('Open settings, change language and save.').reviewCandidates).toHaveLength(0)
  })
})

describe('eagerAction — span and shape', () => {
  function spanText(text: string): string {
    const span = run(text).findings[0]!.span!
    return text.slice(span.start, span.end)
  }

  it('span runs from the second action to the end of the last action', () => {
    expect(spanText('Open settings, change language and save.')).toBe('change language and save')
    expect(spanText('Close flip and reopen the app.')).toBe('reopen the app')
  })

  it('segment() keeps offsets and separators', () => {
    const text = 'Open settings, change language and save.'
    const segs = segment(text)
    expect(segs.map(s => s.sep)).toEqual(['', ',', 'and'])
    for (const s of segs) expect(text.slice(s.start, s.end)).toBe(s.text)
  })

  it('empty and whitespace actions → nothing', () => {
    expect(run('').findings).toHaveLength(0)
    expect(run('   ').reviewCandidates).toHaveLength(0)
  })

  it('ignores verifications', () => {
    const { findings } = eagerAction({
      testCase: makeCase(),
      step: makeStep(1, 'Click Save.', ['Close the dialog and press Enter.']),
      isFirstStep: false,
    })
    expect(findings).toHaveLength(0)
  })

  it('caseId and stepIndex come from the context', () => {
    const { findings } = eagerAction({
      testCase: makeCase('case-5'),
      step: makeStep(3, 'Open settings and change language.'),
      isFirstStep: false,
    })
    expect(findings[0]!.caseId).toBe('case-5')
    expect(findings[0]!.stepIndex).toBe(3)
  })

  it('reason states the count and stays within 25 words (Req 5.2, 2.3)', () => {
    const many = ['open', 'tap', 'choose', 'type', 'press', 'save', 'close', 'reopen']
    const reason = reasonFor(many)
    expect(reason).toContain('8 actions')
    expect(reason).toContain('…')
    expect(wordCount(reason)).toBeLessThanOrEqual(25)
  })
})

describe('eagerAction — review follow-ups', () => {
  it('"Verify the totals and click Submit." → Eager Action and Misplaced Verification', () => {
    const ctx = { testCase: makeCase(), step: makeStep(1, 'Verify the totals and click Submit.'), isFirstStep: false }
    expect(eagerAction(ctx).findings).toHaveLength(1)
    expect(misplacedVerification(ctx).findings).toHaveLength(1)
  })

  it('new list verbs: "Disable Wi-Fi and enable Airplane mode." → 2 actions', () => {
    expect(run('Disable Wi-Fi and enable Airplane mode.').findings[0]!.reason).toContain('2 actions (disable, enable)')
  })

  it('"then" path: "Click the OK button then close the dialog." → span on the second action', () => {
    const text = 'Click the OK button then close the dialog.'
    const span = run(text).findings[0]!.span!
    expect(text.slice(span.start, span.end)).toBe('close the dialog')
  })

  it('statement as a second sentence: "Insert the USB drive. The light turns on." → clean', () => {
    expect(run('Insert the USB drive. The light turns on.').findings).toHaveLength(0)
  })

  it('segment() marks a sentence end with "sentence"', () => {
    expect(segment('Click Save. Reopen the app.').map(s => s.sep)).toEqual(['', 'sentence'])
  })

  it('"or" drops only the alternative: "Open the file or create a new one and save." → 2 actions (open, save)', () => {
    expect(run('Open the file or create a new one and save.').findings[0]!.reason).toContain('2 actions (open, save)')
  })
})
