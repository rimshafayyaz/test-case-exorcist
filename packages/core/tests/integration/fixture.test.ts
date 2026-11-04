/**
 * Integration test: run detectAll on the smells-fixture and assert exact findings.
 *
 * Requirements: 1.1, 2.1, 2.3, 12.2
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { detectAll } from '../../src/detectors/index.js'
import type { TestSuite, Finding } from '../../src/models/index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const FIXTURE_PATH = resolve(__dirname, '../../../../datasets/samples/smells-fixture.json')

/** "caseId:stepIndex:field:smellName" label used throughout. */
function label(f: Finding): string {
  return `${f.caseId}:${f.stepIndex}:${f.field}:${f.smellName}`
}

let suite: TestSuite
let result: ReturnType<typeof detectAll>

beforeAll(() => {
  suite = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as TestSuite
  result = detectAll(suite)
})

// ---------------------------------------------------------------------------
// 1. No detector errors — all 7 detectors ran cleanly
// ---------------------------------------------------------------------------

describe('fixture — no errors', () => {
  it('detectAll produces no errors', () => {
    expect(result.errors).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 2. Exact expected findings
// ---------------------------------------------------------------------------

describe('fixture — exact findings', () => {
  const EXPECTED_LABELS = [
    'case-ambiguous:1:action:AmbiguousTest',
    'case-conditional:1:action:ConditionalTest',
    'case-eager:1:action:EagerAction',
    'case-misplaced-action:0:verification:MisplacedAction',
    'case-misplaced-precondition:0:action:MisplacedPrecondition',
    'case-misplaced-verification:1:action:MisplacedVerification',
    'case-unverified:0:verification:UnverifiedAction',
    'case-unverified:2:verification:UnverifiedAction',
  ]

  it('produces exactly one finding per smell (8 findings total)', () => {
    expect(result.findings.map(label)).toEqual(EXPECTED_LABELS)
  })

  it('Unverified Action step 0 (navigation, followed by verified step) has severity "low"', () => {
    const f = result.findings.find(f => f.caseId === 'case-unverified' && f.stepIndex === 0)
    expect(f?.severity).toBe('low')
  })

  it('Unverified Action step 2 (non-navigation, last step) has severity "normal"', () => {
    const f = result.findings.find(f => f.caseId === 'case-unverified' && f.stepIndex === 2)
    expect(f?.severity).toBe('normal')
  })

  it('Misplaced Action finding has verificationIndex 0', () => {
    const f = result.findings.find(f => f.smellName === 'MisplacedAction')
    expect(f?.verificationIndex).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 3. Clean case has no findings and no review candidates
// ---------------------------------------------------------------------------

describe('fixture — clean case', () => {
  it('case-clean has no findings', () => {
    const findings = result.findings.filter(f => f.caseId === 'case-clean')
    expect(findings).toHaveLength(0)
  })

  it('case-clean has no review candidates', () => {
    const reviews = result.reviewCandidates.filter(r => r.caseId === 'case-clean')
    expect(reviews).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 4. Preconditions are never inspected (Req 1.1, 2.1)
// ---------------------------------------------------------------------------

describe('fixture — preconditions ignored', () => {
  it('no finding has field "precondition"', () => {
    expect(result.findings.every(f => f.field !== 'precondition')).toBe(true)
  })

  it('no finding points at text that only exists in a precondition', () => {
    // case-clean has precondition "Verify the user is logged in quickly." — contains
    // "quickly" (MANNER_ADVERBS) and "Verify" (verification verb). No finding for case-clean.
    const cleanFindings = result.findings.filter(f => f.caseId === 'case-clean')
    expect(cleanFindings).toHaveLength(0)
  })

  it('case-misplaced-precondition precondition text does not generate a finding', () => {
    // precondition: "A valid user account exists in the system."
    const findings = result.findings.filter(f => f.caseId === 'case-misplaced-precondition')
    // only one finding: the state description in step 0 action
    expect(findings).toHaveLength(1)
    expect(findings[0]!.field).toBe('action')
    expect(findings[0]!.stepIndex).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 5. One smell per case (no cross-smell leakage on smelly cases)
// ---------------------------------------------------------------------------

describe('fixture — one smell per smelly case', () => {
  const SMELLY_CASES = [
    'case-ambiguous',
    'case-conditional',
    'case-eager',
    'case-misplaced-action',
    'case-misplaced-precondition',
    'case-misplaced-verification',
  ]

  it.each(SMELLY_CASES)('%s has exactly 1 finding', (caseId) => {
    expect(result.findings.filter(f => f.caseId === caseId)).toHaveLength(1)
  })

  it('case-unverified has exactly 2 findings (both UnverifiedAction)', () => {
    const findings = result.findings.filter(f => f.caseId === 'case-unverified')
    expect(findings).toHaveLength(2)
    expect(findings.every(f => f.smellName === 'UnverifiedAction')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 6. Every finding satisfies Req 2.1 (required fields present)
// ---------------------------------------------------------------------------

describe('fixture — finding shape (Req 2.1)', () => {
  it('every finding has caseId, stepIndex, field, smellName, ghostName, reason, confidence and fixName', () => {
    for (const f of result.findings) {
      expect(f.caseId).toBeTruthy()
      expect(typeof f.stepIndex).toBe('number')
      expect(['action', 'verification', 'precondition']).toContain(f.field)
      expect(f.smellName).toBeTruthy()
      expect(f.ghostName).toBeTruthy()
      expect(f.reason).toBeTruthy()
      expect(f.confidence).toBe('rule')
      expect(f.fixName).toBeTruthy()
    }
  })
})