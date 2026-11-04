/**
 * Shared types for all smell detectors.
 *
 * The DetectorContext is passed to every detector by the orchestrator.
 * Change this file only when a new field is needed by at least one detector.
 */

import type { TestCase, Step, Finding, ReviewCandidate } from '../models/index.js'

export interface DetectorContext {
  /** The test case that owns this step. Gives detectors access to preconditions
   *  and all sibling steps (needed for context-dependent smells). */
  testCase: TestCase
  /** The step being analysed. */
  step: Step
  /** True when step.index === 0 (first step of the test case). */
  isFirstStep: boolean
  /** The step immediately after this one, if any.
   *  Used by the Unverified Action detector to apply the navigation exception. */
  nextStep?: Step
}

export interface DetectorOutput {
  findings: Finding[]
  reviewCandidates: ReviewCandidate[]
}

export type Detector = (ctx: DetectorContext) => DetectorOutput
