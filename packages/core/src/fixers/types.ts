/**
 * Types shared by the fixers (spec fixer, design).
 */

import type { Finding, FixName, SmellName, TestCase } from '../models/index.js'

/** Self-check: the detectors run again on the result (Req 3). */
export interface FixCheck {
  /** True when the target smell has fewer findings after the fix. */
  resolved: boolean
  /** Smells whose finding count went up, with the increase. */
  introduced: Partial<Record<SmellName, number>>
}

export interface FixProposal {
  fixName: FixName
  smellName: SmellName
  caseId: string
  stepIndex: number
  /** One sentence: what the fix does. */
  summary: string
  /** The unchanged input test case. */
  before: TestCase
  /** The resulting test cases: one, or two for Extract Conditional. */
  after: TestCase[]
  /** What the tester still has to write (e.g. an expected result). */
  needsInput: string[]
  check: FixCheck
}

export type FixOutcome =
  | { ok: true; proposal: FixProposal }
  | { ok: false; finding: Finding; reason: string }

/** Result of one transformation, before the self-check is added. */
export type Transformation =
  | { after: TestCase[]; summary: string; needsInput: string[] }
  | { reason: string }

export type Transform = (testCase: TestCase, finding: Finding) => Transformation
