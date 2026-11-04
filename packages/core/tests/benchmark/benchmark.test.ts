/**
 * Benchmark regression gate: the rule-based detectors on the public sample of
 * the 2026 Gemini 3 study (bench/score.ts, datasets/benchmark/gemini3-sample.json).
 *
 * The scoring is checked first: it must reproduce the study's own Gemini 3
 * result (TP 97, FP 9, FN 10, TN 30, F1 0.91). Then our result must not drop
 * below the level reached when this gate was added.
 */

import { describe, it, expect } from 'vitest'
import { runBenchmark, f1, precision } from '../../../../bench/score.js'

describe('benchmark — Gemini 3 study sample (103 items)', () => {
  const { rules, geminiScore } = runBenchmark()

  it('the scoring reproduces the study\'s Gemini 3 confusion matrix', () => {
    expect(geminiScore.total).toEqual({ tp: 97, fp: 9, fn: 10, tn: 30 })
    expect(f1(geminiScore.total)).toBeCloseTo(0.911, 3)
  })

  it('rule-based F1 stays at or above 0.80 and precision at or above 0.90', () => {
    expect(f1(rules.total)).toBeGreaterThanOrEqual(0.8)
    expect(precision(rules.total)).toBeGreaterThanOrEqual(0.9)
  })
})
