/**
 * Benchmark report — see bench/score.ts for the data source and scoring.
 * Run: npx tsx bench/run.ts   (from the repo root)
 */

import { writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { ALL_SMELL_NAMES } from '../packages/core/src/index.js'
import { runBenchmark, f1, precision, recall } from './score.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { data, cases, ms, rules, rulesPlusReview, geminiScore } = runBenchmark()

const pct = (x: number) => x.toFixed(2)
const lines: string[] = []
lines.push(`# Benchmark — Gemini 3 study sample (${data.items.length} items, ${cases.length} test cases)`)
lines.push('')
lines.push(`Detection time: ${ms.toFixed(0)} ms, no network, no AI.`)
lines.push('')
lines.push('| Detector | TP | FP | FN | TN | Precision | Recall | F1 |')
lines.push('|---|---|---|---|---|---|---|---|')
for (const [name, s] of [
  ['Test Case Exorcist (rules)', rules],
  ['Rules + review candidates counted as smells', rulesPlusReview],
  ['Gemini 3 (from the study data)', geminiScore],
] as const) {
  lines.push(`| ${name} | ${s.total.tp} | ${s.total.fp} | ${s.total.fn} | ${s.total.tn} | ${pct(precision(s.total))} | ${pct(recall(s.total))} | **${pct(f1(s.total))}** |`)
}
lines.push('| GPT-5.2 (published) | | | | | | | 0.82 |')
lines.push('| Manual Test Sensei (published) | | | | | | | 0.66 |')
lines.push('')
lines.push('## Per smell (rules)')
lines.push('')
lines.push('| Smell | Baseline labels | TP | FP | FN | Precision | Recall | F1 | Gemini 3 F1 |')
lines.push('|---|---|---|---|---|---|---|---|---|')
for (const s of ALL_SMELL_NAMES) {
  const c = rules.perSmell[s]
  const g = geminiScore.perSmell[s]
  lines.push(`| ${s} | ${c.tp + c.fn} | ${c.tp} | ${c.fp} | ${c.fn} | ${pct(precision(c))} | ${pct(recall(c))} | ${pct(f1(c))} | ${pct(f1(g))} |`)
}
lines.push('')
lines.push('## Disagreements (rules vs baseline)')
lines.push('')
for (const m of rules.misses) {
  lines.push(`- ${m.id} (${m.where}) "${m.text.slice(0, 110)}${m.text.length > 110 ? '…' : ''}" — missed: ${m.missed.join(', ') || '—'}; extra: ${m.extra.join(', ') || '—'}`)
}

const report = lines.join('\n')
console.log(report)
mkdirSync(resolve(root, 'bench/results'), { recursive: true })
writeFileSync(resolve(root, 'bench/results/gemini3-sample.md'), report + '\n')
writeFileSync(
  resolve(root, 'bench/results/gemini3-sample.json'),
  JSON.stringify({ items: data.items.length, ms, rules: rules.total, rulesF1: f1(rules.total), perSmell: rules.perSmell, gemini3F1: f1(geminiScore.total) }, null, 2) + '\n',
)
