/**
 * Performance: 1,000 steps in under 500 ms (Req 12.1).
 *
 * - Every step text is unique, so the tag cache cannot hide the cost.
 * - One full warm-up run first (1,000 other steps): it loads the compromise lexicon and lets the
 *   JavaScript engine optimise the code, as in a long-running process
 *   (web app, MCP server, Kiro hook).
 * - The median of three runs is compared with the budget, so one slow run
 *   on a busy machine does not fail the test.
 * - Set EXORCIST_PERF_BUDGET_MS to raise the budget on slow CI machines.
 */

import { describe, it, expect } from 'vitest'
import { detectAll } from '../../src/detectors/index.js'
import { generateSuite } from './generate.js'
import { ALL_SMELL_NAMES } from '../../src/smells.js'

const BUDGET_MS = Number(process.env['EXORCIST_PERF_BUDGET_MS'] ?? 500)

describe('performance (Req 12.1)', () => {
  it('generated suite has 1,000 unique steps', () => {
    const suite = generateSuite(100, 10, 'shape')
    const actions = suite.cases.flatMap(c => c.steps.map(s => s.action))
    expect(actions).toHaveLength(1000)
    expect(new Set(actions).size).toBe(1000)
  })

  it(`1,000 steps are checked by all 7 detectors in under ${BUDGET_MS} ms (median of 3)`, () => {
    detectAll(generateSuite(100, 10, 'warm'))

    const times: number[] = []
    for (const seed of ['p', 'q', 'r']) {
      const suite = generateSuite(100, 10, seed)
      const start = performance.now()
      const result = detectAll(suite)
      times.push(performance.now() - start)
      expect(result.errors).toEqual([])
      // Guard against a speed shortcut silencing a detector: every smell must
      // still be found in roughly the expected amount (exact counts today:
      // 200–290 per smell, 9 Misplaced Precondition, 1,246 in total).
      const perSmell = new Map<string, number>()
      for (const f of result.findings) perSmell.set(f.smellName, (perSmell.get(f.smellName) ?? 0) + 1)
      for (const smell of ALL_SMELL_NAMES) {
        expect(perSmell.get(smell) ?? 0, smell).toBeGreaterThanOrEqual(smell === 'MisplacedPrecondition' ? 5 : 50)
      }
      expect(result.findings.length).toBeGreaterThanOrEqual(1000)
    }

    const median = [...times].sort((a, b) => a - b)[1]!
    console.log(`detectAll on 1,000 steps: ${times.map(t => t.toFixed(0)).join(', ')} ms (median ${median.toFixed(0)} ms)`)
    expect(median).toBeLessThan(BUDGET_MS)
  }, 30_000)
})
