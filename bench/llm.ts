/**
 * Benchmark with the LLM reviewer (Gemini). Runs on your PC; needs GEMINI_API_KEY.
 *
 *   pnpm bench:llm              sample: rules, rules + reviewer, rules + reviewer + Ambiguous sweep
 *   pnpm bench:llm --heldout    also the held-out test half (reviewer only, no sweep)
 *   pnpm bench:llm --dry-run    no key, no calls: counts the questions (every answer is "no")
 *
 * Settings (environment variables):
 *   GEMINI_API_KEY             required; never printed
 *   EXORCIST_LLM_MODEL         default gemini-3.5-flash-lite
 *   EXORCIST_LLM_INTERVAL_MS   wait between calls, default 6500 (free-tier rate limits)
 *
 * Every answer is saved in bench/llm-cache.json right away, so an interrupted
 * run continues where it stopped, and re-running costs nothing.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { detectAll, reviewWithLlm, createGeminiClient, ALL_SMELL_NAMES } from '../packages/core/src/index.js'
import type { DetectionResult, Finding, LlmCache, LlmClient, SmellName, Step, TestCase } from '../packages/core/src/index.js'
import { buildCases, data, keyOf, score, f1, precision, recall } from './score.js'
import type { Counts } from './score.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry-run')
const apiKey = process.env['GEMINI_API_KEY']
if (!apiKey && !dryRun) {
  console.error('GEMINI_API_KEY is not set in this terminal. See bench/README.md ("LLM reviewer").')
  process.exit(1)
}
const model = dryRun ? 'dry-run' : (process.env['EXORCIST_LLM_MODEL'] ?? 'gemini-3.5-flash-lite')
const interval = Number(process.env['EXORCIST_LLM_INTERVAL_MS'] ?? 6500)
const gemini: LlmClient = dryRun
  ? { name: 'dry-run', complete: async () => '{"isSmell": false, "reason": "dry run", "words": ""}' }
  : createGeminiClient({ apiKey: apiKey!, model, minIntervalMs: interval })
// Show every failure as it happens, so a wrong model name or a used-up quota is visible at once.
const client: LlmClient = {
  name: gemini.name,
  async complete(prompt: string) {
    try {
      return await gemini.complete(prompt)
    } catch (err) {
      console.error(`\n  ! ${err instanceof Error ? err.message : String(err)}`)
      throw err
    }
  },
}

// File-backed cache: written after every answer (not in a dry run).
const cachePath = resolve(root, 'bench/llm-cache.json')
const store: Record<string, string> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf-8')) : {}
const cache: LlmCache = {
  get: k => store[k],
  set: (k, v) => {
    if (dryRun) return
    store[k] = v
    writeFileSync(cachePath, JSON.stringify(store, null, 1) + '\n')
  },
}
const progress = (label: string) => (done: number, total: number) => process.stdout.write(`\r${label}: ${done}/${total}   `)

const pct = (x: number) => x.toFixed(2)
const row = (name: string, c: Counts) => `| ${name} | ${pct(precision(c))} | ${pct(recall(c))} | **${pct(f1(c))}** |`

async function main() {
  // ---------------------------------------------------------------------------
  // 1. Human-labelled sample (103 items)
  // ---------------------------------------------------------------------------

  const { cases, locate } = buildCases(data.items)
  const suite = { id: 'gemini3-sample', name: 'Gemini 3 study sample', cases }

  function labels(result: DetectionResult) {
    const map = new Map<string, Set<SmellName>>()
    for (const f of result.findings) {
      const item = locate(f)
      if (item) map.set(keyOf(item), (map.get(keyOf(item)) ?? new Set()).add(f.smellName))
    }
    return map
  }

  const rules = detectAll(suite)
  const reviewed = await reviewWithLlm(suite, rules, client, { cache, onProgress: progress('sample, review candidates') })
  console.log()
  const swept = await reviewWithLlm(suite, reviewed, client, { cache, sweep: ['AmbiguousTest'], onProgress: progress('sample, Ambiguous sweep') })
  console.log()

  const sRules = score(labels(rules))
  const sReviewed = score(labels(reviewed))
  const sSwept = score(labels(swept))

  const lines = [
    `# Benchmark with the LLM reviewer (${model})`,
    '',
    `Human-labelled sample, ${data.items.length} items. Same scoring as bench/README.md.`,
    '',
    '| | Precision | Recall | F1 |',
    '|---|---|---|---|',
    row('Rules only', sRules.total),
    row(`Rules + LLM reviewer (${reviewed.llm.asked} questions: ${reviewed.llm.confirmed} confirmed, ${reviewed.llm.rejected} rejected, ${reviewed.llm.failed} failed)`, sReviewed.total),
    row(`Rules + LLM reviewer + Ambiguous sweep (${swept.llm.asked} more questions)`, sSwept.total),
    '| Gemini 3 alone (study data) | 0.92 | 0.91 | **0.91** |',
    '',
    '## Per smell (rules + reviewer + sweep)',
    '',
    '| Smell | F1 rules | F1 with LLM |',
    '|---|---|---|',
    ...ALL_SMELL_NAMES.map(s => `| ${s} | ${pct(f1(sRules.perSmell[s]))} | ${pct(f1(sSwept.perSmell[s]))} |`),
  ]
  const failures = [...reviewed.errors, ...swept.errors].filter(e => e.message.startsWith('LLM reviewer'))
  if (failures.length > 0) lines.push('', `LLM failures: ${failures.length} (first: ${failures[0]!.message})`)

  // ---------------------------------------------------------------------------
  // 2. Optional: held-out test half (silver standard = Gemini 3 outputs)
  // ---------------------------------------------------------------------------

  if (process.argv.includes('--heldout')) {
    interface SItem { id: number; where: 'action' | 'verification'; text: string; gemini3: SmellName[] }
    interface SCase { testCase: string; testIndex: string; inSample: boolean; items: SItem[] }
    const silver = JSON.parse(readFileSync(resolve(root, 'datasets/benchmark/gemini3-outputs.json'), 'utf-8')) as { cases: SCase[] }
    const unseen = silver.cases.filter(c => !c.inSample).sort((a, b) => `${a.testCase}#${a.testIndex}`.localeCompare(`${b.testCase}#${b.testIndex}`))
    const testHalf = unseen.filter((_, i) => i % 2 === 1) // same split as bench/heldout.ts

    const built = testHalf.map(c => {
      const tc: TestCase = { id: `${c.testCase}#${c.testIndex}`, title: c.testCase, preconditions: [], steps: [] }
      const itemOf = new Map<string, number>()
      c.items.forEach((item, i) => {
        if (item.where === 'action' || tc.steps.length === 0) {
          const step: Step = { index: tc.steps.length, action: item.where === 'action' ? item.text : '', verifications: [] }
          tc.steps.push(step)
          if (item.where === 'action') itemOf.set(`${step.index}|a`, i)
        }
        if (item.where === 'verification') {
          const step = tc.steps[tc.steps.length - 1]!
          itemOf.set(`${step.index}|v${step.verifications.length}`, i)
          step.verifications.push(item.text)
        }
      })
      return { c, tc, itemOf }
    })
    const hSuite = { id: 'heldout-test', name: 'Held-out test half', cases: built.map(b => b.tc) }
    const hRules = detectAll(hSuite)
    const hReviewed = await reviewWithLlm(hSuite, hRules, client, { cache, onProgress: progress('held-out test half, review candidates') })
    console.log()

    const compare = (result: DetectionResult) => {
      const total: Counts = { tp: 0, fp: 0, fn: 0 }
      for (const { c, tc, itemOf } of built) {
        const ours = c.items.map(() => new Set<SmellName>())
        for (const f of result.findings.filter((x: Finding) => x.caseId === tc.id)) {
          const i = f.smellName === 'UnverifiedAction' || f.field === 'action' ? itemOf.get(`${f.stepIndex}|a`) : itemOf.get(`${f.stepIndex}|v${f.verificationIndex ?? 0}`)
          if (i !== undefined) ours[i]!.add(f.smellName)
        }
        c.items.forEach((item, i) => {
          const g = new Set(item.gemini3)
          for (const s of g) ours[i]!.has(s) ? total.tp++ : total.fn++
          for (const s of ours[i]!) if (!g.has(s)) total.fp++
        })
      }
      return total
    }
    lines.push(
      '',
      '## Held-out test half (agreement with Gemini 3, silver standard)',
      '',
      '| | Precision | Recall | F1 |',
      '|---|---|---|---|',
      row('Rules only', compare(hRules)),
      row(`Rules + LLM reviewer (${hReviewed.llm.asked} questions)`, compare(hReviewed)),
      '',
      'Note: the silver standard is Gemini 3 output and the reviewer is also a Gemini model, so agreement here may be higher than with human labels.',
    )
  }

  const report = lines.join('\n')
  console.log(report)
  mkdirSync(resolve(root, 'bench/results'), { recursive: true })
  if (!dryRun) writeFileSync(resolve(root, `bench/results/llm-${model}.md`), report + '\n')
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
