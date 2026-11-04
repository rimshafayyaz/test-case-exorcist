import { describe, it, expect } from 'vitest'
import { SMELLS, ALL_SMELL_NAMES } from '../src/smells.js'
import type { SmellName, FixName } from '../src/models/index.js'

const EXPECTED_SMELL_NAMES: SmellName[] = [
  'AmbiguousTest',
  'ConditionalTest',
  'EagerAction',
  'MisplacedAction',
  'MisplacedPrecondition',
  'MisplacedVerification',
  'UnverifiedAction',
]

const EXPECTED_FIX_NAMES: FixName[] = [
  'ExtractAmbiguity',
  'ExtractConditional',
  'SeparateActions',
  'ExtractAction',
  'ExtractPrecondition',
  'ExtractVerification',
  'FillVerification',
]

describe('SMELLS constants', () => {
  it('covers all 7 smell names', () => {
    expect(ALL_SMELL_NAMES).toHaveLength(7)
    for (const name of EXPECTED_SMELL_NAMES) {
      expect(ALL_SMELL_NAMES).toContain(name)
    }
  })

  it('every SmellName has a non-empty ghostName', () => {
    for (const name of EXPECTED_SMELL_NAMES) {
      const meta = SMELLS[name]
      expect(meta.ghostName, `ghostName missing for ${name}`).toBeTruthy()
      expect(meta.ghostName.trim().length, `ghostName empty for ${name}`).toBeGreaterThan(0)
    }
  })

  it('every SmellName has a non-empty fixLabel', () => {
    for (const name of EXPECTED_SMELL_NAMES) {
      const meta = SMELLS[name]
      expect(meta.fixLabel, `fixLabel missing for ${name}`).toBeTruthy()
      expect(meta.fixLabel.trim().length, `fixLabel empty for ${name}`).toBeGreaterThan(0)
    }
  })

  it('every SmellName has a valid fixName', () => {
    for (const name of EXPECTED_SMELL_NAMES) {
      const meta = SMELLS[name]
      expect(EXPECTED_FIX_NAMES, `fixName invalid for ${name}`).toContain(meta.fixName)
    }
  })

  it('smellName field matches the key', () => {
    for (const name of EXPECTED_SMELL_NAMES) {
      expect(SMELLS[name].smellName).toBe(name)
    }
  })

  it('ghost names match docs/smells.md exactly', () => {
    const expected: Record<SmellName, string> = {
      AmbiguousTest: 'Fog Wraith',
      ConditionalTest: 'Fork Spirit',
      EagerAction: 'Hydra',
      MisplacedAction: 'Wanderer',
      MisplacedPrecondition: 'Early Riser',
      MisplacedVerification: 'Mixed Soul',
      UnverifiedAction: 'Silent Ghost',
    }
    for (const name of EXPECTED_SMELL_NAMES) {
      expect(SMELLS[name].ghostName).toBe(expected[name])
    }
  })

  it('fix labels match docs/smells.md exactly', () => {
    const expected: Record<SmellName, string> = {
      AmbiguousTest: 'Extract Ambiguity',
      ConditionalTest: 'Extract Conditional',
      EagerAction: 'Separate Actions',
      MisplacedAction: 'Extract Action',
      MisplacedPrecondition: 'Extract Precondition',
      MisplacedVerification: 'Extract Verification',
      UnverifiedAction: 'Fill Verification',
    }
    for (const name of EXPECTED_SMELL_NAMES) {
      expect(SMELLS[name].fixLabel).toBe(expected[name])
    }
  })

  it('fix names map to typed FixName values', () => {
    const expected: Record<SmellName, FixName> = {
      AmbiguousTest: 'ExtractAmbiguity',
      ConditionalTest: 'ExtractConditional',
      EagerAction: 'SeparateActions',
      MisplacedAction: 'ExtractAction',
      MisplacedPrecondition: 'ExtractPrecondition',
      MisplacedVerification: 'ExtractVerification',
      UnverifiedAction: 'FillVerification',
    }
    for (const name of EXPECTED_SMELL_NAMES) {
      expect(SMELLS[name].fixName).toBe(expected[name])
    }
  })
})
