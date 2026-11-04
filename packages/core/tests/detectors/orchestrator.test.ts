/**
 * Unit tests for the orchestrator (detectAll / detectSmell).
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 10.1, 10.2, 11.2
 */

import { describe, it, expect } from 'vitest'
import { detectAll, detectSmell, detectWith, DETECTORS } from '../../src/detectors/index.js'
import { ALL_SMELL_NAMES } from '../../src/smells.js'
import type { TestSuite, TestCase, Step, Finding } from '../../src/models/index.js'
import type { Detector } from '../../src/detectors/types.js'

function step(index: number, action: string, verifications: string[] = []): Step {
  return { index, action, verifications }
}

function testCase(id: string, steps: Step[], preconditions: string[] = []): TestCase {
  return { id, title: id, preconditions, steps }
}

function suite(...cases: TestCase[]): TestSuite {
  return { id: 'suite-1', name: 'Suite', cases }
}

/** Findings for one step as "Smell/field" labels. */
function labels(findings: Finding[], caseId = 'c1', stepIndex = 0): string[] {
  return findings
    .filter(f => f.caseId === caseId && f.stepIndex === stepIndex)
    .map(f => `${f.smellName}/${f.field}`)
}

describe('orchestrator — empty input (Req 1.2)', () => {
  it('empty suite → empty result', () => {
    expect(detectAll(suite())).toEqual({ findings: [], reviewCandidates: [], errors: [] })
  })

  it('test case with no steps → empty result', () => {
    expect(detectAll(suite(testCase('c1', [])))).toEqual({ findings: [], reviewCandidates: [], errors: [] })
  })
})

describe('orchestrator — runs every detector (Req 1.1, 1.3)', () => {
  it('has a detector for each of the 7 smells', () => {
    expect(Object.keys(DETECTORS).sort()).toEqual([...ALL_SMELL_NAMES].sort())
  })

  it('every detector runs on every step', () => {
    const calls: string[] = []
    const spies = Object.fromEntries(
      ALL_SMELL_NAMES.map(name => [name, ((ctx) => { calls.push(`${name}:${ctx.testCase.id}:${ctx.step.index}`); return { findings: [], reviewCandidates: [] } }) as Detector]),
    )
    detectWith(suite(testCase('c1', [step(0, 'A.'), step(1, 'B.')]), testCase('c2', [step(0, 'C.')])), spies)
    expect(calls).toHaveLength(7 * 3)
  })

  it('returns synchronously (not a Promise)', () => {
    const result = detectAll(suite(testCase('c1', [step(0, 'Click Save.')])))
    expect(result).not.toBeInstanceOf(Promise)
    expect(Array.isArray(result.findings)).toBe(true)
  })
})

describe('orchestrator — context passed to detectors (Task 11 notes)', () => {
  it('isFirstStep comes from the array position, not step.index', () => {
    const seen: boolean[] = []
    const spy: Detector = ctx => { seen.push(ctx.isFirstStep); return { findings: [], reviewCandidates: [] } }
    detectWith(suite(testCase('c1', [step(5, 'A.'), step(6, 'B.')])), { EagerAction: spy })
    expect(seen).toEqual([true, false])
  })

  it('nextStep is the following step in the array', () => {
    const next: (number | undefined)[] = []
    const spy: Detector = ctx => { next.push(ctx.nextStep?.index); return { findings: [], reviewCandidates: [] } }
    detectWith(suite(testCase('c1', [step(1, 'A.'), step(2, 'B.'), step(3, 'C.')])), { EagerAction: spy })
    expect(next).toEqual([2, 3, undefined])
  })

  it('a misplaced precondition is found when step indexes start at 1', () => {
    const r = detectAll(suite(testCase('c1', [step(1, 'The user is already logged in.', ['The home page is shown.'])])))
    expect(labels(r.findings, 'c1', 1)).toContain('MisplacedPrecondition/action')
  })

  it('navigation exception uses nextStep: "Open the settings page." before a verified step → low severity', () => {
    const r = detectAll(
      suite(testCase('c1', [step(0, 'Open the settings page.'), step(1, 'Click Language.', ['The language list appears.'])])),
    )
    const unverified = r.findings.find(f => f.smellName === 'UnverifiedAction' && f.stepIndex === 0)
    expect(unverified?.severity).toBe('low')
  })
})

describe('orchestrator — errors (Req 1.4)', () => {
  it('a detector that throws is recorded and the others still run', () => {
    const boom: Detector = () => { throw new Error('boom') }
    const r = detectWith(suite(testCase('c1', [step(0, 'Click Save.')])), { ...DETECTORS, EagerAction: boom })
    expect(r.errors).toEqual([{ detector: 'EagerAction', caseId: 'c1', stepIndex: 0, message: 'boom' }])
    expect(labels(r.findings)).toContain('UnverifiedAction/verification')
  })

  it('non-Error throws are recorded as text', () => {
    const boom: Detector = () => { throw 'bad input' }
    const r = detectWith(suite(testCase('c1', [step(0, 'A.')])), { AmbiguousTest: boom })
    expect(r.errors[0]!.message).toBe('bad input')
  })
})

describe('orchestrator — de-duplication (Req 10.1, 11.2)', () => {
  const f = (over: Partial<Finding> = {}): Finding => ({
    caseId: 'c1', stepIndex: 0, field: 'action', smellName: 'EagerAction', ghostName: 'Hydra',
    reason: 'r', confidence: 'rule', fixName: 'SeparateActions', severity: 'normal', ...over,
  })

  it('two findings with the same case, step, field and smell → one', () => {
    const dup: Detector = () => ({ findings: [f(), f({ reason: 'other' })], reviewCandidates: [] })
    const r = detectWith(suite(testCase('c1', [step(0, 'A.')])), { EagerAction: dup })
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0]!.reason).toBe('r')
  })

  it('findings for different verification entries are kept separately', () => {
    const two: Detector = () => ({
      findings: [
        f({ field: 'verification', verificationIndex: 0, smellName: 'MisplacedAction' }),
        f({ field: 'verification', verificationIndex: 1, smellName: 'MisplacedAction' }),
      ],
      reviewCandidates: [],
    })
    expect(detectWith(suite(testCase('c1', [step(0, 'A.')])), { MisplacedAction: two }).findings).toHaveLength(2)
  })

  it('a review candidate is dropped when another detector output has a finding for the same step and smell', () => {
    const finding: Detector = () => ({ findings: [f()], reviewCandidates: [] })
    const review: Detector = () => ({
      findings: [],
      reviewCandidates: [{ caseId: 'c1', stepIndex: 0, smellName: 'EagerAction', hint: 'h' }],
    })
    const r = detectWith(suite(testCase('c1', [step(0, 'A.')])), { EagerAction: finding, AmbiguousTest: review })
    expect(r.reviewCandidates).toHaveLength(0)
  })

  it('duplicate review candidates → one', () => {
    const review: Detector = () => ({
      findings: [],
      reviewCandidates: [
        { caseId: 'c1', stepIndex: 0, smellName: 'AmbiguousTest', hint: 'a' },
        { caseId: 'c1', stepIndex: 0, smellName: 'AmbiguousTest', hint: 'b' },
      ],
    })
    expect(detectWith(suite(testCase('c1', [step(0, 'A.')])), { AmbiguousTest: review }).reviewCandidates).toHaveLength(1)
  })
})

describe('orchestrator — keyword ownership across all 7 detectors (Req 10.2)', () => {
  /** Run one step (with a clean verification so Unverified Action stays quiet). */
  function only(action: string, first = false): string[] {
    const steps = first
      ? [step(0, action, ['The home page is shown.'])]
      : [step(0, 'Open the app.', ['The app opens.']), step(1, action, ['The home page is shown.'])]
    const r = detectAll(suite(testCase('c1', steps)))
    return labels(r.findings, 'c1', first ? 0 : 1)
  }

  it('"Verify the total is 100." → only Misplaced Verification', () => {
    expect(only('Verify the total is 100.')).toEqual(['MisplacedVerification/action'])
  })

  it('"Make sure the user is logged in." as step 1 → exactly one finding: Misplaced Precondition', () => {
    expect(only('Make sure the user is logged in.', true)).toEqual(['MisplacedPrecondition/action'])
  })

  it('"Make sure the user is logged in." as step 2 → exactly one finding: Misplaced Precondition', () => {
    expect(only('Make sure the user is logged in.')).toEqual(['MisplacedPrecondition/action'])
  })

  it('"Click Save and make sure the file is stored." as step 2 → Misplaced Verification', () => {
    expect(only('Click Save and make sure the file is stored.')).toContain('MisplacedVerification/action')
  })

  it('"If you have a USB drive, plug it in." as step 1 → only Conditional Test, no review candidates', () => {
    const r = detectAll(suite(testCase('c1', [step(0, 'If you have a USB drive, plug it in.', ['The drive appears.'])])))
    expect(labels(r.findings)).toEqual(['ConditionalTest/action'])
    expect(r.reviewCandidates).toHaveLength(0)
  })

  it('"Close flip and check app continuity." → Eager Action and Misplaced Verification (both, as in the 2026 study)', () => {
    expect(only('Close flip and check app continuity.')).toEqual(['EagerAction/action', 'MisplacedVerification/action'])
  })

  it('"Verify the total is 100." → still only Misplaced Verification (a check alone is not two operations)', () => {
    expect(only('Verify the total and check the list.')).toEqual(['MisplacedVerification/action'])
  })

  it('"Open settings, change language and save." → only Eager Action', () => {
    expect(only('Open settings, change language and save.')).toEqual(['EagerAction/action'])
  })

  it('"Log in as the admin user." as step 1 → clean', () => {
    expect(only('Log in as the admin user.', true)).toEqual([])
  })
})

describe('orchestrator — detectSmell and sorting', () => {
  const s = suite(
    testCase('c2', [step(0, 'Open settings, change language and save.')]),
    testCase('c1', [step(0, 'Click Save.'), step(1, 'Verify the total is 100.', ['Click OK.'])]),
  )

  it('detectSmell runs only the requested detector', () => {
    const r = detectSmell('UnverifiedAction', s)
    expect(r.findings.length).toBeGreaterThan(0)
    expect(r.findings.every(f => f.smellName === 'UnverifiedAction')).toBe(true)
  })

  it('findings are sorted by case order in the suite, then step, field and smell', () => {
    const order = detectAll(s).findings.map(f => `${f.caseId}:${f.stepIndex}:${f.field}:${f.smellName}`)
    expect(order).toEqual([
      'c2:0:action:EagerAction',
      'c2:0:verification:UnverifiedAction',
      'c1:0:verification:UnverifiedAction',
      'c1:1:action:MisplacedVerification',
      'c1:1:verification:MisplacedAction',
    ])
  })

  it('preconditions are never inspected', () => {
    const r = detectAll(suite(testCase('c1', [step(0, 'Click Save.', ['A message appears.'])], ['Verify the user is logged in quickly.'])))
    expect(r.findings).toHaveLength(0)
  })
})

describe('orchestrator — review follow-ups', () => {
  it('Req 11.2 across fields: an action finding drops a verification review candidate for the same smell', () => {
    const r = detectAll(suite(testCase('c1', [step(0, 'Restart the app normally.', ['Something changes.'])])))
    expect(r.findings.some(f => f.smellName === 'AmbiguousTest' && f.field === 'action')).toBe(true)
    expect(r.reviewCandidates.filter(c => c.smellName === 'AmbiguousTest')).toHaveLength(0)
  })

  it('"Verify any item is selected." → Misplaced Verification ("verify") and Ambiguous Test ("any")', () => {
    const r = detectAll(
      suite(testCase('c1', [step(0, 'Open the app.', ['The app opens.']), step(1, 'Verify any item is selected.', ['The list is shown.'])])),
    )
    expect(labels(r.findings, 'c1', 1)).toEqual(['AmbiguousTest/action', 'MisplacedVerification/action'])
    expect(r.reviewCandidates).toHaveLength(0)
  })

  it('sorts by step position in the test case, not by step.index', () => {
    const r = detectAll(suite(testCase('c1', [step(10, 'Click Save.'), step(2, 'Click Next.')])))
    expect(r.findings.map(f => f.stepIndex)).toEqual([10, 2])
  })
})

describe('orchestrator — TODO placeholders (smell-detector Req 9.3)', () => {
  it('a "TODO: …" expected result counts as missing and is never checked for smells', () => {
    const r = detectAll(suite(testCase('c1', [step(0, 'Click Save.', ['TODO: expected result of "Check the page loads quickly if needed"'])])))
    expect(labels(r.findings)).toEqual(['UnverifiedAction/verification'])
    expect(r.reviewCandidates).toHaveLength(0)
  })

  it('other verifications of the step keep their index', () => {
    const r = detectAll(suite(testCase('c1', [step(0, 'Click Save.', ['TODO: later', 'Click OK to continue.'])])))
    const f = r.findings.find(x => x.smellName === 'MisplacedAction')
    expect(f?.verificationIndex).toBe(1)
  })
})
