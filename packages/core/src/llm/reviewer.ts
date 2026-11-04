/**
 * LLM reviewer — decides the cases the rules were unsure about (hybrid mode).
 *
 * - Every review candidate becomes one question. A "yes" turns it into a
 *   finding with confidence "hybrid" (the rules suspected it, the model
 *   confirmed it); a "no" drops it. If the call or the answer fails, the
 *   review candidate is kept and the failure is recorded in `errors`.
 * - Optional sweep: ask about chosen smells for every action and expected
 *   result that has no finding for that smell yet (e.g. Ambiguous Test, where
 *   the rules miss judgement calls). A "yes" becomes a finding with
 *   confidence "llm".
 * - Answers are cached by model + prompt, so re-running costs nothing.
 * - Rule findings are never removed: the model only decides uncertain cases.
 *
 * Requirements (spec llm-reviewer): 1.1–1.5, 3.1–3.3
 */

import type { DetectionResult, Finding, SmellName, Step, TestCase, TestSuite } from '../models/index.js'
import { SMELLS } from '../smells.js'
import { mergeResults } from '../detectors/index.js'
import { buildPrompt, parseVerdict, questionText } from './prompt.js'
import type { Question } from './prompt.js'
import type { LlmCache, LlmClient, LlmStats, LlmVerdict } from './types.js'

export interface ReviewOptions {
  cache?: LlmCache
  /** Smells to ask about for every step field without a finding (costs one call each). */
  sweep?: SmellName[]
  /** Called after every question. */
  onProgress?: (done: number, total: number) => void
}

export interface ReviewedResult extends DetectionResult {
  llm: LlmStats
}

/** A simple in-memory cache. */
export function memoryCache(): LlmCache {
  const map = new Map<string, string>()
  return { get: k => map.get(k), set: (k, v) => void map.set(k, v) }
}

function spanOf(text: string, words: string | undefined): { start: number; end: number } | undefined {
  if (!words) return undefined
  const start = text.toLowerCase().indexOf(words.toLowerCase())
  return start === -1 ? undefined : { start, end: start + words.length }
}

function toFinding(q: Question, verdict: LlmVerdict, confidence: 'hybrid' | 'llm'): Finding {
  const meta = SMELLS[q.smell]
  const span = spanOf(questionText(q), verdict.words)
  return {
    caseId: q.testCase.id,
    stepIndex: q.step.index,
    // Unverified Action findings point at the missing verification.
    field: q.smell === 'UnverifiedAction' ? 'verification' : q.field,
    ...(q.field === 'verification' ? { verificationIndex: q.verificationIndex ?? 0 } : {}),
    ...(span ? { span } : {}),
    smellName: q.smell,
    ghostName: meta.ghostName,
    reason: verdict.reason,
    confidence,
    fixName: meta.fixName,
    severity: 'normal',
  }
}

const hasText = (s: string) => s.trim() !== ''

export async function reviewWithLlm(
  suite: TestSuite,
  result: DetectionResult,
  client: LlmClient,
  options: ReviewOptions = {},
): Promise<ReviewedResult> {
  const stats: LlmStats = { asked: 0, cached: 0, confirmed: 0, rejected: 0, failed: 0 }
  const findings: Finding[] = [...result.findings]
  const keptReviews: DetectionResult['reviewCandidates'] = []
  const errors = [...result.errors]

  const cases = new Map(suite.cases.map(c => [c.id, c]))
  const stepOf = (caseId: string, stepIndex: number): [TestCase, Step] | undefined => {
    const tc = cases.get(caseId)
    const step = tc?.steps.find(s => s.index === stepIndex)
    return tc && step ? [tc, step] : undefined
  }

  // 1. Questions for the review candidates.
  const questions: { q: Question; review?: DetectionResult['reviewCandidates'][number] }[] = []
  for (const r of result.reviewCandidates) {
    const found = stepOf(r.caseId, r.stepIndex)
    if (!found) {
      keptReviews.push(r)
      continue
    }
    const field = r.field === 'verification' ? 'verification' : 'action'
    questions.push({
      q: { smell: r.smellName, testCase: found[0], step: found[1], field, ...(field === 'verification' ? { verificationIndex: r.verificationIndex ?? 0 } : {}), hint: r.hint },
      review: r,
    })
  }

  // 2. Sweep questions: every field without a finding (or review) for that smell.
  const flagged = new Set([
    ...findings.map(f => `${f.caseId}|${f.stepIndex}|${f.smellName}|${f.field}|${f.verificationIndex ?? ''}`),
    ...result.reviewCandidates.map(r => `${r.caseId}|${r.stepIndex}|${r.smellName}|${r.field ?? 'action'}|${r.verificationIndex ?? ''}`),
  ])
  for (const smell of options.sweep ?? []) {
    for (const tc of suite.cases) {
      for (const step of tc.steps) {
        if (hasText(step.action) && !flagged.has(`${tc.id}|${step.index}|${smell}|action|`)) {
          questions.push({ q: { smell, testCase: tc, step, field: 'action' } })
        }
        step.verifications.forEach((v, i) => {
          if (hasText(v) && !flagged.has(`${tc.id}|${step.index}|${smell}|verification|${i}`)) {
            questions.push({ q: { smell, testCase: tc, step, field: 'verification', verificationIndex: i } })
          }
        })
      }
    }
  }

  // 3. Ask, one question at a time (rate limits), using the cache.
  //    Stop calling the model after 3 failed calls in a row (a wrong model
  //    name or key would otherwise fail every question, slowly).
  let failedInARow = 0
  let stopped: string | undefined
  for (const [n, { q, review }] of questions.entries()) {
    const prompt = buildPrompt(q)
    if (stopped && options.cache?.get(`${client.name}\u0000${prompt}`) === undefined) {
      stats.asked++
      stats.failed++
      if (review) keptReviews.push(review)
      options.onProgress?.(n + 1, questions.length)
      continue
    }
    const key = `${client.name}\u0000${prompt}`
    stats.asked++
    let answer = options.cache?.get(key)
    let verdict: LlmVerdict | null = null
    try {
      if (answer !== undefined) stats.cached++
      else {
        answer = await client.complete(prompt)
      }
      verdict = parseVerdict(answer)
      if (verdict && options.cache && options.cache.get(key) === undefined) options.cache.set(key, answer)
      if (!verdict) throw new Error('the answer was not the expected JSON')
    } catch (err) {
      stats.failed++
      if (review) keptReviews.push(review)
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ detector: q.smell, caseId: q.testCase.id, stepIndex: q.step.index, message: `LLM reviewer: ${message}` })
      if (++failedInARow >= 3 && !stopped) {
        stopped = message
        errors.push({ detector: q.smell, caseId: q.testCase.id, stepIndex: q.step.index, message: `LLM reviewer: stopped calling the model after 3 failed calls in a row (${message})` })
      }
      options.onProgress?.(n + 1, questions.length)
      continue
    }
    failedInARow = 0
    if (verdict.isSmell) {
      stats.confirmed++
      findings.push(toFinding(q, verdict, review ? 'hybrid' : 'llm'))
    } else if (review) {
      stats.rejected++
    }
    options.onProgress?.(n + 1, questions.length)
  }

  return { ...mergeResults(suite, findings, keptReviews, errors), llm: stats }
}
