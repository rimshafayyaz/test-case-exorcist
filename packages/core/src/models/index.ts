/**
 * Core data models for @exorcist/core.
 * These types are the single shared contract consumed by detectors,
 * fixers, the scorer, CLI, MCP server and web app.
 */

export type SmellName =
  | 'AmbiguousTest'
  | 'ConditionalTest'
  | 'EagerAction'
  | 'MisplacedAction'
  | 'MisplacedPrecondition'
  | 'MisplacedVerification'
  | 'UnverifiedAction'

export type FixName =
  | 'ExtractAmbiguity'
  | 'ExtractConditional'
  | 'SeparateActions'
  | 'ExtractAction'
  | 'ExtractPrecondition'
  | 'ExtractVerification'
  | 'FillVerification'

export interface TestSuite {
  id: string
  name: string
  cases: TestCase[]
}

export interface TestCase {
  id: string
  title: string
  preconditions: string[]
  steps: Step[]
}

export interface Step {
  index: number
  action: string
  verifications: string[]
  source?: {
    file?: string
    row?: number
    line?: number
  }
}

export interface Finding {
  caseId: string
  stepIndex: number
  field: 'action' | 'verification' | 'precondition'
  verificationIndex?: number
  span?: { start: number; end: number }
  smellName: SmellName
  ghostName: string
  reason: string
  confidence: 'rule' | 'llm' | 'hybrid'
  fixName: FixName
  severity: 'normal' | 'low'
}

export interface ReviewCandidate {
  caseId: string
  stepIndex: number
  smellName: SmellName
  /** Which field the uncertain text is in (lets the LLM reviewer focus). */
  field?: 'action' | 'verification' | 'precondition'
  /** Which entry of `verifications[]`, when `field` is 'verification'. */
  verificationIndex?: number
  hint: string
}

export interface DetectionResult {
  findings: Finding[]
  reviewCandidates: ReviewCandidate[]
  errors: {
    detector: SmellName
    caseId: string
    stepIndex: number
    message: string
  }[]
}
