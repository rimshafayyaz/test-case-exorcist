/**
 * Property-based tests for the fixers (spec fixer, Task 5), with fast-check.
 *
 * fast-check generates thousands of realistic test steps from smelly and clean
 * fragments, runs the detectors, proposes a fix for every finding and checks
 * properties that must hold for ANY input:
 *   P1  proposeFix never throws and never modifies its input        (Req 1.1, 1.3)
 *   P2  no word of the original test case is lost                    (Req 1.5)
 *   P3  every rule-based fix removes its smell (self-check)          (Req 3.1)
 *   P4  steps are numbered consecutively from the first index        (Req 1.4)
 *
 * 150 runs per property by default; set EXORCIST_PBT_RUNS for a longer search
 * (1,500 runs × 3 passed while developing).
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { detectAll, proposeFix } from '../../src/index.js'
import type { Step, TestCase } from '../../src/index.js'
import { words } from '../../src/fixers/text.js'

const ACTION_FRAGMENTS = [
  'open the settings page', 'click Save', 'change the language', 'type your name', 'press Enter',
  'close the dialog', 'select Urdu', 'reload the page quickly', 'verify the total is 100', 'check the list',
  'make sure the user is logged in', 'the menu should appear', 'the monitor is not connected',
  'open any file', 'click OK, Cancel or Close', 'press and hold the power button',
]
const CONDITIONS = ['if the dialog opens', 'when the file is saved', 'in case the page is empty']
const SEPARATORS = [', ', ' and ', ', then ', '; ']
const VERIFICATIONS = [
  'The dialog closes.', 'Click OK to continue.', 'A message appears.', 'It works.',
  'The dialog opens, then click OK.', 'The total is 100.', 'Select the first item.',
]

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const plainAction = fc
  .tuple(fc.array(fc.constantFrom(...ACTION_FRAGMENTS), { minLength: 1, maxLength: 3 }), fc.constantFrom(...SEPARATORS))
  .map(([parts, sep]) => capitalise(parts.join(sep)) + '.')

const conditionalAction = fc
  .tuple(fc.constantFrom(...CONDITIONS), fc.constantFrom(...ACTION_FRAGMENTS.slice(0, 7)), fc.boolean())
  .map(([cond, act, leading]) => (leading ? `${capitalise(cond)}, ${act}.` : `${capitalise(act)} ${cond}.`))

const stepArb = fc.record({
  action: fc.oneof({ weight: 4, arbitrary: plainAction }, { weight: 1, arbitrary: conditionalAction }),
  verifications: fc.array(fc.constantFrom(...VERIFICATIONS), { maxLength: 2 }),
})

const caseArb = fc
  .tuple(
    fc.array(stepArb, { minLength: 1, maxLength: 4 }),
    fc.array(fc.constantFrom('A user account exists.', 'The app is installed.'), { maxLength: 1 }),
    fc.integer({ min: 0, max: 5 }),
  )
  .map(([steps, preconditions, firstIndex]): TestCase => ({
    id: 'gen',
    title: 'Generated',
    preconditions,
    steps: steps.map((s, i): Step => ({ index: firstIndex + i, action: s.action, verifications: s.verifications })),
  }))

/** Words a transformation may remove: connectors and the phrases it rewrites. */
const REMOVABLE = new Set(['and', 'then', 'also', 'or', 'make', 'sure', 'ensure', 'that', 'if', 'when', 'in', 'case'])

function allWords(cases: TestCase[]): Set<string> {
  const out = new Set<string>()
  for (const c of cases) {
    for (const t of [...c.preconditions, ...c.steps.flatMap(s => [s.action, ...s.verifications])]) {
      for (const w of words(t)) out.add(w)
    }
  }
  return out
}

/** Run `check` on every proposal for every finding of the generated case. */
function forEachProposal(check: (tc: TestCase, outcome: ReturnType<typeof proposeFix>) => void) {
  fc.assert(
    fc.property(caseArb, tc => {
      for (const f of detectAll({ id: 's', name: 'S', cases: [tc] }).findings) check(tc, proposeFix(tc, f))
    }),
    { numRuns: Number(process.env["EXORCIST_PBT_RUNS"] ?? 150) },
  )
}

describe('fixer properties (fast-check)', () => {
  it('P1: never throws and never modifies the input', () => {
    fc.assert(
      fc.property(caseArb, tc => {
        const copy = JSON.parse(JSON.stringify(tc)) as TestCase
        for (const f of detectAll({ id: 's', name: 'S', cases: [tc] }).findings) {
          expect(() => proposeFix(tc, f)).not.toThrow()
        }
        expect(tc).toEqual(copy)
      }),
      { numRuns: Number(process.env["EXORCIST_PBT_RUNS"] ?? 150) },
    )
  }, 60_000)

  it('P2: keeps every word of the test case (except removed connectors)', () => {
    forEachProposal((tc, outcome) => {
      if (!outcome.ok) return
      const after = allWords(outcome.proposal.after)
      const missing = [...allWords([tc])].filter(w => !after.has(w) && !REMOVABLE.has(w))
      expect(missing, `${outcome.proposal.fixName}: ${outcome.proposal.summary}`).toEqual([])
    })
  }, 60_000)

  it('P3: every rule-based fix except the TODO placeholder removes its smell', () => {
    forEachProposal((_, outcome) => {
      if (!outcome.ok || outcome.proposal.fixName === 'FillVerification') return
      expect(outcome.proposal.check.resolved, `${outcome.proposal.fixName}: ${outcome.proposal.summary}`).toBe(true)
    })
  }, 60_000)

  it('P4: steps stay numbered consecutively from the first index', () => {
    forEachProposal((tc, outcome) => {
      if (!outcome.ok) return
      for (const c of outcome.proposal.after) {
        const first = tc.steps[0]!.index
        expect(c.steps.map(s => s.index)).toEqual(c.steps.map((_, i) => first + i))
      }
    })
  }, 60_000)
})
