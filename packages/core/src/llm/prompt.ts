/**
 * Prompts and answer parsing for the LLM reviewer.
 *
 * One question per decision: "Is THIS text a <smell>?" with the smell's
 * definition (docs/smells.md and the 2026 study's rules), the whole step for
 * context, and the rule engine's hint. The model must answer with JSON only.
 *
 * Requirements (spec llm-reviewer): 1.2, 1.3, 3.1
 */

import type { SmellName, Step, TestCase } from '../models/index.js'
import type { LlmVerdict } from './types.js'

/** Short, test-oriented definitions; examples from docs/smells.md. */
export const SMELL_DEFINITIONS: Record<SmellName, string> = {
  AmbiguousTest:
    'The text is vague or under-specified, so two testers could do or judge it differently: an unnamed object ("Open any application", "Insert a media card"), subjective or unmeasurable words ("quickly", "reasonable level", "works", "without noise"), comparatives without a metric ("faster", "best"), or an unclear referent ("It should change"). Concrete names, values, paths and UI labels are NOT ambiguous.',
  ConditionalTest:
    'The text contains branching logic, so testers may follow different paths: "if", "when <condition>", "unless", "in case", "whether", "depending on", or alternatives joined by "or" ("Press X, or click Y").',
  EagerAction:
    'One action step groups two or more distinct operations that should be separate steps ("Open settings, change language and save"). One gesture ("press and hold") or a list of labels ("Click OK, Cancel or Close") is one operation.',
  MisplacedAction:
    'An expected result (verification) contains an instruction to DO something ("Click OK to continue", "Run mutt and press enter") instead of describing an outcome.',
  MisplacedPrecondition:
    'The text describes a setup state that must already hold before the test, so it belongs in the preconditions ("The user is already logged in", "Make sure you have internet access").',
  MisplacedVerification:
    'An action step contains a check or an expected outcome ("Close flip and check app continuity", "The menu should appear").',
  UnverifiedAction:
    'An action step has no expected result, so it cannot pass or fail.',
}

function describeStep(step: Step): string {
  const lines = [`Action: ${JSON.stringify(step.action)}`]
  step.verifications.forEach((v, i) => lines.push(`Expected result ${i + 1}: ${JSON.stringify(v)}`))
  if (step.verifications.length === 0) lines.push('Expected result: (none)')
  return lines.join('\n')
}

export interface Question {
  smell: SmellName
  testCase: TestCase
  step: Step
  field: 'action' | 'verification'
  verificationIndex?: number
  /** What the rule engine noticed (review candidates only). */
  hint?: string
}

/** The exact text the question is about. */
export function questionText(q: Question): string {
  return q.field === 'verification' ? (q.step.verifications[q.verificationIndex ?? 0] ?? '') : q.step.action
}

export function buildPrompt(q: Question): string {
  const where = q.field === 'verification' ? `expected result ${(q.verificationIndex ?? 0) + 1}` : 'action'
  return [
    'You are an expert QA engineer reviewing one step of a manual test case for natural-language test smells.',
    '',
    `Smell to decide: ${q.smell}`,
    `Definition: ${SMELL_DEFINITIONS[q.smell]}`,
    '',
    `Test case: ${JSON.stringify(q.testCase.title)}`,
    describeStep(q.step),
    '',
    `Decide ONLY whether the ${where} — ${JSON.stringify(questionText(q))} — has the smell ${q.smell}. Be conservative: answer true only with clear evidence in that text.`,
    q.hint ? `A rule-based checker was unsure: ${q.hint}` : '',
    '',
    'Answer with JSON only, exactly this shape:',
    '{"isSmell": true or false, "reason": "one sentence, at most 25 words", "words": "the exact words from the text that carry the smell, or empty"}',
  ]
    .filter(line => line !== '')
    .join('\n')
}

/** Parse the model's answer; null when it is not the expected JSON. */
export function parseVerdict(answer: string): LlmVerdict | null {
  const json = answer.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  if (typeof d['isSmell'] !== 'boolean') return null
  const reason = typeof d['reason'] === 'string' ? d['reason'].trim() : ''
  const words = typeof d['words'] === 'string' && d['words'].trim() !== '' ? d['words'].trim() : undefined
  // Req 2.3 of the smell detector: reasons are at most 25 words.
  const clipped = reason.split(/\s+/).filter(Boolean).slice(0, 25).join(' ')
  return { isSmell: d['isSmell'], reason: clipped || 'Confirmed by the LLM reviewer.', ...(words ? { words } : {}) }
}
