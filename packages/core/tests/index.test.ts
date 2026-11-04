/**
 * Public API of @exorcist/core (Req 13.1).
 */

import { describe, it, expect } from 'vitest'
import * as core from '../src/index.js'
import type {
  TestSuite,
  TestCase,
  Step,
  Finding,
  ReviewCandidate,
  DetectionResult,
  SmellName,
  FixName,
} from '../src/index.js'

describe('@exorcist/core', () => {
  it('exports VERSION', () => {
    expect(core.VERSION).toBe('0.1.0')
  })

  it('exports detectAll, detectSmell and DETECTORS', () => {
    expect(typeof core.detectAll).toBe('function')
    expect(typeof core.detectSmell).toBe('function')
    expect(Object.keys(core.DETECTORS)).toHaveLength(7)
  })

  it('detectAll works through the public entry point with the public types', () => {
    const step: Step = { index: 0, action: 'Click Save.', verifications: [] }
    const testCase: TestCase = { id: 'c1', title: 'Save', preconditions: [], steps: [step] }
    const suite: TestSuite = { id: 's1', name: 'Suite', cases: [testCase] }

    const result: DetectionResult = core.detectAll(suite)
    expect(result.findings).toHaveLength(1)
    const finding: Finding = result.findings[0]!
    const smell: SmellName = finding.smellName
    const fix: FixName = finding.fixName
    const reviews: ReviewCandidate[] = result.reviewCandidates

    expect(smell).toBe('UnverifiedAction')
    expect(fix).toBe('FillVerification')
    expect(reviews).toEqual([])
  })

  it('detectSmell runs a single detector through the public entry point', () => {
    const suite: TestSuite = {
      id: 's1',
      name: 'Suite',
      cases: [{ id: 'c1', title: 'T', preconditions: [], steps: [{ index: 0, action: 'Verify the total is 100.', verifications: [] }] }],
    }
    const result = core.detectSmell('MisplacedVerification', suite)
    expect(result.findings.map(f => f.smellName)).toEqual(['MisplacedVerification'])
  })
})
