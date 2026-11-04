/**
 * Unit tests for the scorer.
 *
 * Requirements (spec scorer): 1.1–1.6, 2.1–2.3, 3.1
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { scoreSuite, gradeFor } from '../../src/index.js'
import { detectAll } from '../../src/index.js'
import type { DetectionResult, Finding, ReviewCandidate, TestCase, TestSuite, SmellName } from '../../src/index.js'

function suiteWith(stepsPerCase: number[]): TestSuite {
  return {
    id: 's',
    name: 'S',
    cases: stepsPerCase.map((n, c) => ({
      id: `c${c}`,
      title: `Case ${c}`,
      preconditions: [],
      steps: Array.from({ length: n }, (_, i) => ({ index: i, action: 'Click Save.', verifications: ['Saved.'] })),
    })),
  }
}

function finding(caseId: string, stepIndex: number, smellName: SmellName = 'EagerAction', severity: 'normal' | 'low' = 'normal'): Finding {
  return {
    caseId, stepIndex, field: 'action', smellName, ghostName: 'g', reason: 'r',
    confidence: 'rule', fixName: 'SeparateActions', severity,
  }
}

function result(findings: Finding[] = [], reviewCandidates: ReviewCandidate[] = []): DetectionResult {
  return { findings, reviewCandidates, errors: [] }
}

describe('scorer — score and grade (Req 1)', () => {
  it('empty suite → 100 / A with zero counts', () => {
    const s = scoreSuite({ id: 's', name: 'S', cases: [] }, result())
    expect(s).toMatchObject({ score: 100, grade: 'A', totalSteps: 0, cleanSteps: 0, findingCount: 0, worstSmell: null })
  })

  it('all clean → 100 / A', () => {
    const s = scoreSuite(suiteWith([5, 5]), result())
    expect(s.score).toBe(100)
    expect(s.grade).toBe('A')
    expect(s.cleanSteps).toBe(10)
  })

  it('one normal finding in 10 steps → 90 / A', () => {
    const s = scoreSuite(suiteWith([10]), result([finding('c0', 3)]))
    expect(s.score).toBe(90)
    expect(s.grade).toBe('A')
  })

  it('one low-severity finding in 4 steps → 94 (weight 0.25)', () => {
    expect(scoreSuite(suiteWith([4]), result([finding('c0', 0, 'UnverifiedAction', 'low')])).score).toBe(94)
  })

  it('three findings on one step count as one bad step', () => {
    const s = scoreSuite(suiteWith([2]), result([finding('c0', 0, 'EagerAction'), finding('c0', 0, 'AmbiguousTest'), finding('c0', 0, 'ConditionalTest')]))
    expect(s.score).toBe(50)
    expect(s.findingCount).toBe(3)
    expect(s.cleanSteps).toBe(1)
  })

  it.each([
    [100, 'A'], [90, 'A'], [89, 'B'], [80, 'B'], [79, 'C'], [70, 'C'], [69, 'D'], [60, 'D'], [59, 'F'], [0, 'F'],
  ])('gradeFor(%i) → %s', (score, grade) => {
    expect(gradeFor(score)).toBe(grade)
  })

  it('review candidates do not lower the score and are counted as uncertainSteps', () => {
    const review: ReviewCandidate = { caseId: 'c0', stepIndex: 1, smellName: 'AmbiguousTest', hint: 'h' }
    const s = scoreSuite(suiteWith([4]), result([], [review]))
    expect(s.score).toBe(100)
    expect(s.uncertainSteps).toBe(1)
  })

  it('a step with both a finding and a review candidate is not uncertain', () => {
    const review: ReviewCandidate = { caseId: 'c0', stepIndex: 0, smellName: 'AmbiguousTest', hint: 'h' }
    expect(scoreSuite(suiteWith([4]), result([finding('c0', 0)], [review])).uncertainSteps).toBe(0)
  })
})

describe('scorer — breakdown (Req 2)', () => {
  it('counts every smell, with 0 for absent ones', () => {
    const s = scoreSuite(suiteWith([5]), result([finding('c0', 0, 'EagerAction'), finding('c0', 1, 'EagerAction'), finding('c0', 2, 'ConditionalTest')]))
    expect(Object.keys(s.perSmell)).toHaveLength(7)
    expect(s.perSmell.EagerAction).toBe(2)
    expect(s.perSmell.ConditionalTest).toBe(1)
    expect(s.perSmell.AmbiguousTest).toBe(0)
    expect(s.worstSmell).toBe('EagerAction')
  })

  it('one score per test case, in suite order', () => {
    const s = scoreSuite(suiteWith([2, 4]), result([finding('c1', 0)]))
    expect(s.cases.map(c => [c.caseId, c.score, c.grade, c.findingCount])).toEqual([
      ['c0', 100, 'A', 0],
      ['c1', 75, 'C', 1],
    ])
  })

  it('uses step.index values that do not start at 0', () => {
    const tc: TestCase = { id: 'c', title: 'T', preconditions: [], steps: [5, 6].map(i => ({ index: i, action: 'A.', verifications: [] })) }
    expect(scoreSuite({ id: 's', name: 'S', cases: [tc] }, result([finding('c', 6)])).score).toBe(50)
  })

  it('findings for unknown steps are counted but do not change the score', () => {
    const s = scoreSuite(suiteWith([2]), result([finding('other', 0)]))
    expect(s.score).toBe(100)
    expect(s.findingCount).toBe(1)
  })
})

describe('scorer — through the public API with the smells fixture (Req 3.1)', () => {
  it('scores the fixture suite', () => {
    const here = fileURLToPath(new URL('.', import.meta.url))
    const suite = JSON.parse(readFileSync(resolve(here, '../../../../datasets/samples/smells-fixture.json'), 'utf-8')) as TestSuite
    const s = scoreSuite(suite, detectAll(suite))
    // 19 steps; 7 normal findings + 1 low finding (0.25) → 100 × (1 − 7.25/19) = 61.8 → 62
    expect(s.totalSteps).toBe(19)
    expect(s.score).toBe(62)
    expect(s.grade).toBe('D')
    expect(s.cases.find(c => c.caseId === 'case-clean')!.grade).toBe('A')
  })
})
