/**
 * Unverified Action detector — "Silent Ghost"
 *
 * Reports when an action step has no non-empty verification before the next
 * action. Steps whose verifications are all empty or whitespace are treated
 * as unverified.
 *
 * Navigation exception (configurable, on by default):
 * A step whose action STARTS WITH a navigation verb (open, go to, navigate to,
 * launch, start, switch to, return to, scroll to) and is immediately followed
 * by a step with at least one non-empty verification gets severity "low" with a
 * reason noting the missing verification may be intentional.
 *
 * Not reported when the action already holds its own check ("Adjust the
 * volume. Verify that it changes.") or is a setup state ("Make sure the user
 * is logged in."): those belong to Misplaced Verification / Precondition (Req 9.4).
 *
 * Field: verification (missing)
 * Confidence: rule
 * Fix: FillVerification
 *
 * Reason strings are capped at 25 words (Req 2.3).
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import type { Finding } from '../models/index.js'
import { SMELLS } from '../smells.js'
import { NAVIGATION_VERBS, NAVIGATION_VERB_PHRASES, splitClauses } from '../text/index.js'
import { findChecks } from './misplacedVerification.js'
import { isStateClause } from './misplacedPrecondition.js'
import type { DetectorContext, DetectorOutput } from './types.js'

const META = SMELLS['UnverifiedAction']

// Reason strings — must be <= 25 words (Req 2.3).
const REASON_NORMAL = 'No expected result, so this step cannot pass or fail.'
const REASON_NAV    = 'No expected result; for a navigation step this may be intentional.'

/**
 * Return true if `text` starts with a navigation verb or phrase (case-insensitive).
 */
function startsWithNavigationVerb(text: string): boolean {
  const lower = text.trim().toLowerCase()

  // Check multi-word phrases first (longer matches take priority)
  for (const phrase of NAVIGATION_VERB_PHRASES) {
    if (lower.startsWith(phrase)) return true
  }

  // Check single-word navigation verbs
  for (const verb of NAVIGATION_VERBS) {
    // Must be followed by whitespace or end-of-string so "starts" doesn't match "starter"
    if (lower === verb || lower.startsWith(verb + ' ')) return true
  }

  return false
}

/**
 * Return true if a step has at least one non-empty (non-whitespace) verification.
 */
function hasVerification(verifications: string[]): boolean {
  return verifications.some(v => v.trim().length > 0)
}

/**
 * True when the action is not a plain action without an outcome (Req 9.4):
 * it already holds its own check (owned by Misplaced Verification), or it is a
 * setup state (owned by Misplaced Precondition), so there is nothing to verify.
 */
function isCheckOrSetup(action: string, isFirstStep: boolean): boolean {
  if (findChecks(action).checks.length > 0) return true
  const clauses = splitClauses(action)
  if (clauses.length === 0) return false
  if (isStateClause(clauses[0]!, true)) return true
  return isFirstStep && clauses.every(c => isStateClause(c))
}

export const unverifiedAction = ({ testCase, step, nextStep, isFirstStep }: DetectorContext): DetectorOutput => {
  // If the step has at least one non-empty verification, no smell.
  if (hasVerification(step.verifications)) {
    return { findings: [], reviewCandidates: [] }
  }
  if (isCheckOrSetup(step.action ?? '', isFirstStep)) {
    return { findings: [], reviewCandidates: [] }
  }

  // Determine whether the navigation exception applies.
  const isNavStep = startsWithNavigationVerb(step.action)
  const nextHasVerification = nextStep !== undefined && hasVerification(nextStep.verifications)
  const isNavigationException = isNavStep && nextHasVerification

  const severity = isNavigationException ? 'low' : 'normal'
  const reason   = isNavigationException ? REASON_NAV : REASON_NORMAL

  const finding: Finding = {
    caseId: testCase.id,
    stepIndex: step.index,
    field: 'verification',
    smellName: META.smellName,
    ghostName: META.ghostName,
    reason,
    confidence: 'rule',
    fixName: META.fixName,
    severity,
  }

  return { findings: [finding], reviewCandidates: [] }
}