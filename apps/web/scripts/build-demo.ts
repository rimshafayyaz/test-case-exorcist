/**
 * Builds the web app's demo data from the repo (run from the repo root):
 *   npx tsx apps/web/scripts/build-demo.ts
 *
 * - demo/haunted.json   synthetic mobile-banking suite (one ghost per test case)
 * - demo/ubuntu.json    the 14 Ubuntu test cases of the 2026 study sample (CC BY 4.0)
 * - demo/ai-answers.json  the Gemini answers already saved by the benchmark
 *   (bench/llm-cache.json) for the review candidates of these suites, so the
 *   Demo mode shows real AI decisions without a key.
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { detectAll, buildPrompt } from '../../../packages/core/src/index.js'
import type { TestSuite } from '../../../packages/core/src/index.js'
import { buildCases, data } from '../../../bench/score.js'

const root = resolve(import.meta.dirname, '../../..')
const out = (name: string, value: unknown) => writeFileSync(resolve(root, 'apps/web/src/demo', name), JSON.stringify(value, null, 1) + '\n')

const haunted = JSON.parse(readFileSync(resolve(root, 'datasets/samples/fintech-haunted.json'), 'utf-8')) as TestSuite
const ubuntu: TestSuite = { id: 'ubuntu-sample', name: 'Ubuntu test cases (2026 study sample)', cases: buildCases(data.items).cases }

const MODEL = 'gemini:gemini-3.5-flash-lite'
const cache = JSON.parse(readFileSync(resolve(root, 'bench/llm-cache.json'), 'utf-8')) as Record<string, string>
const answers: Record<string, string> = {}
let missing = 0
for (const suite of [haunted, ubuntu]) {
  for (const r of detectAll(suite).reviewCandidates) {
    const tc = suite.cases.find(c => c.id === r.caseId)!
    const step = tc.steps.find(s => s.index === r.stepIndex)!
    const field = r.field === 'verification' ? 'verification' : 'action'
    const prompt = buildPrompt({ smell: r.smellName, testCase: tc, step, field, ...(field === 'verification' ? { verificationIndex: r.verificationIndex ?? 0 } : {}), hint: r.hint })
    const answer = cache[`${MODEL}\u0000${prompt}`]
    if (answer) answers[prompt] = answer
    else missing++
  }
}
out('haunted.json', haunted)
out('ubuntu.json', ubuntu)
out('ai-answers.json', { model: MODEL, answers })
console.log(`demo suites written; ${Object.keys(answers).length} saved AI answers, ${missing} review candidates without a saved answer`)
