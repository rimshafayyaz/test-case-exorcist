/**
 * Text and structure helpers shared by the fixers.
 */

import type { Step, TestCase } from '../models/index.js'
import { MAKE_SURE_PHRASES } from '../text/index.js'

/** Leading and trailing connectors removed when a piece of text becomes its own sentence. */
const LEADING = /^(?:\s|,|;|\b(?:and|then|also|or)\b)+/i
const TRAILING = /(?:\s|,|;|:|\.|!|\?|\b(?:and|then|also|or)\b)+$/i

/** "  and change language, " → "Change language." */
export function asSentence(text: string): string {
  const core = text.replace(LEADING, '').replace(TRAILING, '').trim()
  if (core === '') return ''
  return core.charAt(0).toUpperCase() + core.slice(1) + '.'
}

/** Remove a leading "make sure" / "ensure that" ("make sure the user is logged in" → "the user is logged in"). */
export function stripMakeSure(text: string): string {
  const t = text.replace(LEADING, '')
  for (const phrase of MAKE_SURE_PHRASES) {
    if (t.toLowerCase().startsWith(phrase + ' ')) return t.slice(phrase.length + 1).replace(/^that\s+/i, '')
  }
  return t
}

/** Deep copy of a test case (fixes never modify their input). */
export function cloneCase(testCase: TestCase): TestCase {
  return {
    ...testCase,
    preconditions: [...(testCase.preconditions ?? [])],
    steps: (testCase.steps ?? []).map(cloneStep),
  }
}

export function cloneStep(step: Step): Step {
  return { ...step, verifications: [...step.verifications], ...(step.source ? { source: { ...step.source } } : {}) }
}

/** Renumber steps consecutively from the first step's original index. */
export function renumber(steps: Step[], firstIndex: number): Step[] {
  return steps.map((s, i) => ({ ...s, index: firstIndex + i }))
}

/** Array position of the step with `stepIndex`, or -1. */
export function positionOf(testCase: TestCase, stepIndex: number): number {
  return testCase.steps.findIndex(s => s.index === stepIndex)
}

/** Lower-cased words (letters, digits, apostrophes, hyphens), for word-preservation checks. */
export function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? []
}
