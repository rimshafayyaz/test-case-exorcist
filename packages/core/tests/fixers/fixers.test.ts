/**
 * Unit tests for the fixers (spec fixer).
 *
 * Requirements: 1.1–1.5, 2.1–2.7, 3.1, 3.2, 4.1–4.3, 5.1
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import {
  detectAll, proposeFix, proposeFixes, applyFix, exorciseSuite, caseToText, scoreSuite,
} from '../../src/index.js'
import type { Finding, FixProposal, SmellName, TestCase, TestSuite } from '../../src/index.js'

type Row = [action: string, verifications: string[]]

function makeCase(rows: Row[], preconditions: string[] = [], id = 'c1', firstIndex = 0): TestCase {
  return {
    id,
    title: 'Demo',
    preconditions,
    steps: rows.map(([action, verifications], i) => ({ index: firstIndex + i, action, verifications })),
  }
}

function findingFor(testCase: TestCase, smell: SmellName): Finding {
  const f = detectAll({ id: 's', name: 'S', cases: [testCase] }).findings.find(x => x.smellName === smell)
  if (!f) throw new Error(`no ${smell} finding`)
  return f
}

function fix(testCase: TestCase, smell: SmellName): FixProposal {
  const outcome = proposeFix(testCase, findingFor(testCase, smell))
  if (!outcome.ok) throw new Error(outcome.reason)
  return outcome.proposal
}

const rows = (c: TestCase) => c.steps.map(s => [s.index, s.action, s.verifications] as const)

describe('Separate Actions (Eager Action, Req 2.1)', () => {
  const tc = makeCase([['Open the app.', ['The app opens.']], ['Open settings, change language and save.', ['The language is changed.']]])

  it('splits the step into one step per action; verifications go to the last one', () => {
    const p = fix(tc, 'EagerAction')
    expect(rows(p.after[0]!)).toEqual([
      [0, 'Open the app.', ['The app opens.']],
      [1, 'Open settings.', []],
      [2, 'Change language.', []],
      [3, 'Save.', ['The language is changed.']],
    ])
    expect(p.needsInput).toHaveLength(2)
    expect(p.check.resolved).toBe(true)
    expect(p.check.introduced).toEqual({ UnverifiedAction: 2 })
  })

  it('keeps a UI list with its action: "Click OK, Cancel or Close" is not split further', () => {
    const p = fix(makeCase([['Open the dialog and click OK, Cancel or Close.', ['The dialog closes.']]]), 'EagerAction')
    expect(p.after[0]!.steps.map(s => s.action)).toEqual(['Open the dialog.', 'Click OK, Cancel or Close.'])
  })
})

describe('Extract Verification (Misplaced Verification, Req 2.2)', () => {
  it('moves the check to the start of the verifications', () => {
    const tc = makeCase([['Open the app.', ['The app opens.']], ['Close flip and check app continuity.', ['The app keeps running.']]])
    const p = fix(tc, 'MisplacedVerification')
    expect(rows(p.after[0]!)[1]).toEqual([1, 'Close flip.', ['Check app continuity.', 'The app keeps running.']])
    expect(p.check).toEqual({ resolved: true, introduced: {} })
  })

  it('a later command stays in the action', () => {
    const tc = makeCase([['Open the app.', ['The app opens.']], ['Click Save, verify the toast and click Close.', ['The dialog closes.']]])
    const step = fix(tc, 'MisplacedVerification').after[0]!.steps[1]!
    expect(step.action).toBe('Click Save, then click Close.')
    expect(step.verifications[0]).toBe('Verify the toast.')
  })

  it('a step that is only a check moves to the previous step and is removed', () => {
    const tc = makeCase([['Open the app.', ['The app opens.']], ['Verify the total is 100.', []], ['Click Save.', ['Saved.']]])
    const p = fix(tc, 'MisplacedVerification')
    expect(rows(p.after[0]!)).toEqual([
      [0, 'Open the app.', ['The app opens.', 'Verify the total is 100.']],
      [1, 'Click Save.', ['Saved.']],
    ])
  })

  it('removes "make sure" from the moved text', () => {
    const tc = makeCase([['Open the app.', ['The app opens.']], ['Click Save and make sure the file is stored.', []]])
    expect(fix(tc, 'MisplacedVerification').after[0]!.steps[1]!.verifications).toEqual(['The file is stored.'])
  })

  it('outcome wording: "The menu should appear." moves as a whole', () => {
    const tc = makeCase([['Click Menu.', ['The menu opens.']], ['The menu should appear.', []]])
    expect(fix(tc, 'MisplacedVerification').after[0]!.steps).toHaveLength(1)
  })
})

describe('Extract Action (Misplaced Action, Req 2.3)', () => {
  it('moves the action into a new step after the current one, keeping the rest of the verification', () => {
    const tc = makeCase([['Click Save.', ['The dialog opens, then click OK.']], ['Close the app.', ['The app closes.']]])
    const p = fix(tc, 'MisplacedAction')
    expect(rows(p.after[0]!)).toEqual([
      [0, 'Click Save.', ['The dialog opens.']],
      [1, 'Click OK.', []],
      [2, 'Close the app.', ['The app closes.']],
    ])
    expect(p.needsInput).toEqual(['Expected result for the new step 2 ("Click OK.")'])
    expect(p.check.resolved).toBe(true)
  })

  it('a verification that is only an action is removed from the step', () => {
    const p = fix(makeCase([['Press Submit.', ['Click OK to continue.']]]), 'MisplacedAction')
    expect(rows(p.after[0]!)).toEqual([
      [0, 'Press Submit.', []],
      [1, 'Click OK to continue.', []],
    ])
    expect(p.needsInput).toHaveLength(2)
  })
})

describe('Extract Precondition (Misplaced Precondition, Req 2.4)', () => {
  it('a state-only first step moves to the preconditions with its verifications', () => {
    const tc = makeCase(
      [['The monitor is not connected, and the PC is not paired.', ['The screen remains off.']], ['Connect the monitor.', ['The display turns on.']]],
      ['A user account exists.'],
    )
    const p = fix(tc, 'MisplacedPrecondition')
    expect(p.after[0]!.preconditions).toEqual([
      'A user account exists.', 'The monitor is not connected.', 'The PC is not paired.', 'The screen remains off.',
    ])
    expect(rows(p.after[0]!)).toEqual([[0, 'Connect the monitor.', ['The display turns on.']]])
    expect(p.check.resolved).toBe(true)
  })

  it('keeps the command and moves only the state ("make sure" removed)', () => {
    const p = fix(makeCase([['Make sure the user is logged in, then open Settings.', ['Settings opens.']]]), 'MisplacedPrecondition')
    expect(p.after[0]!.preconditions).toEqual(['The user is logged in.'])
    expect(p.after[0]!.steps[0]!.action).toBe('Open Settings.')
  })

  it('prerequisite wording moves the clause that holds the word', () => {
    const p = fix(makeCase([['Install the prerequisite packages.', ['Packages are installed.']], ['Run the app.', ['It starts.']]]), 'MisplacedPrecondition')
    expect(p.after[0]!.preconditions).toEqual(['Install the prerequisite packages.', 'Packages are installed.'])
    expect(p.after[0]!.steps.map(s => s.action)).toEqual(['Run the app.'])
  })
})

describe('Fill Verification (Unverified Action, Req 2.5)', () => {
  it('adds a TODO placeholder that still counts as missing', () => {
    const p = fix(makeCase([['Click Save.', []]]), 'UnverifiedAction')
    expect(p.after[0]!.steps[0]!.verifications).toEqual(['TODO: expected result of "Click Save"'])
    expect(p.needsInput).toEqual(['Expected result for step 1 ("Click Save.")'])
    expect(p.check.resolved).toBe(false)
  })
})

describe('Extract Conditional (Conditional Test, Req 2.6, 2.7)', () => {
  const tc = makeCase([
    ['Open the app.', ['The app opens.']],
    ['If you have a USB drive, plug it in.', ['The drive is detected.']],
    ['Open the drive.', ['Files are listed.']],
  ])

  it('returns a case with the condition as a precondition and a case without the conditional step', () => {
    const p = fix(tc, 'ConditionalTest')
    expect(p.after.map(c => c.id)).toEqual(['c1-a', 'c1-b'])
    expect(p.after[0]!.preconditions).toEqual(['You have a USB drive.'])
    expect(p.after[0]!.steps[1]!.action).toBe('Plug it in.')
    expect(rows(p.after[1]!)).toEqual([[0, 'Open the app.', ['The app opens.']]])
    expect(p.check.resolved).toBe(true)
  })

  it('handles a trailing condition: "Click OK if the dialog opens."', () => {
    const p = fix(makeCase([['Click OK if the dialog opens.', ['The dialog closes.']]]), 'ConditionalTest')
    expect(p.after).toHaveLength(1)
    expect(p.after[0]!.preconditions).toEqual(['The dialog opens.'])
    expect(p.after[0]!.steps[0]!.action).toBe('Click OK.')
  })

  it('"unless" needs the LLM reviewer', () => {
    const c = makeCase([['Unless the dialog closes, press Esc.', ['The dialog closes.']]])
    const outcome = proposeFix(c, findingFor(c, 'ConditionalTest'))
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.reason).toContain('LLM reviewer')
  })

  it('a condition in a verification needs the LLM reviewer', () => {
    const c = makeCase([['Click Save.', ['If the file exists, a warning appears.']]])
    expect(proposeFix(c, findingFor(c, 'ConditionalTest')).ok).toBe(false)
  })
})

describe('Ambiguous Test needs the LLM reviewer (Req 2.7)', () => {
  it('returns ok: false with a reason', () => {
    const c = makeCase([['Reload the page quickly.', ['The page is shown.']]])
    const outcome = proposeFix(c, findingFor(c, 'AmbiguousTest'))
    expect(outcome).toMatchObject({ ok: false })
  })
})

describe('proposal shape and safety (Req 1)', () => {
  const tc = makeCase([['Open the app.', ['The app opens.']], ['Open settings, change language and save.', ['Done.']]], [], 'c1', 5)

  it('never modifies the input test case', () => {
    const copy = JSON.parse(JSON.stringify(tc))
    fix(tc, 'EagerAction')
    expect(tc).toEqual(copy)
  })

  it('renumbers from the first step\'s original index', () => {
    expect(fix(tc, 'EagerAction').after[0]!.steps.map(s => s.index)).toEqual([5, 6, 7, 8])
  })

  it('has every field of a proposal', () => {
    const p = fix(tc, 'EagerAction')
    expect(p).toMatchObject({ fixName: 'SeparateActions', smellName: 'EagerAction', caseId: 'c1', stepIndex: 6 })
    expect(p.before).toEqual(tc)
    expect(p.summary.length).toBeGreaterThan(0)
  })

  it('never throws, even for a finding that points nowhere', () => {
    const bad: Finding = { ...findingFor(tc, 'EagerAction'), stepIndex: 99 }
    expect(proposeFix(tc, bad).ok).toBe(false)
    expect(proposeFix(tc, { ...bad, fixName: 'Nope' as never }).ok).toBe(false)
  })
})

describe('applyFix, exorciseSuite, caseToText (Req 4)', () => {
  const here = fileURLToPath(new URL('.', import.meta.url))
  const fixture = JSON.parse(readFileSync(resolve(here, '../../../../datasets/samples/smells-fixture.json'), 'utf-8')) as TestSuite

  it('applyFix replaces the case in place and keeps the input suite unchanged', () => {
    const copy = JSON.parse(JSON.stringify(fixture))
    const outcome = proposeFixes(fixture).find(o => o.ok && o.proposal.caseId === 'case-eager')!
    if (!outcome.ok) throw new Error('expected a proposal')
    const next = applyFix(fixture, outcome.proposal)
    expect(next.cases.map(c => c.id)).toEqual(fixture.cases.map(c => c.id))
    expect(next.cases.find(c => c.id === 'case-eager')!.steps).toHaveLength(4)
    expect(fixture).toEqual(copy)
  })

  it('exorcising the fixture raises its grade and leaves only what needs a person', () => {
    const before = scoreSuite(fixture, detectAll(fixture))
    const { suite, applied } = exorciseSuite(fixture)
    const after = scoreSuite(suite, detectAll(suite))
    expect(before.grade).toBe('D')
    expect(after.score).toBeGreaterThan(before.score)
    expect(applied.every(p => p.check.resolved)).toBe(true)
    // Left: the ambiguous value (needs the LLM) and the expected results only a tester can write.
    expect(Object.entries(after.perSmell).filter(([, n]) => n > 0).map(([s]) => s).sort()).toEqual(['AmbiguousTest', 'UnverifiedAction'])
  })

  it('caseToText gives a stable plain-text form', () => {
    expect(caseToText(makeCase([['Click Save.', ['Saved.']]], ['Logged in.']))).toBe(
      ['# Demo', 'Preconditions:', '  - Logged in.', '1. Click Save.', '     ✓ Saved.'].join('\n'),
    )
  })
})

describe('Extract Precondition — "With …:" prefix', () => {
  it('moves the prefix to the preconditions and keeps the action', () => {
    const tc = makeCase([['Open the app.', ['The app opens.']], ['With an MP3 file and headphones: play the file.', ['Music plays.']]])
    const p = fix(tc, 'MisplacedPrecondition')
    expect(p.after[0]!.preconditions).toEqual(['An MP3 file and headphones.'])
    expect(p.after[0]!.steps[1]!.action).toBe('Play the file.')
    expect(p.check.resolved).toBe(true)
  })
})
