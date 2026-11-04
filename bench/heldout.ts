/**
 * Held-out check: agreement with Gemini 3 on test cases our rules were NOT tuned on.
 *
 * The Zenodo package (Lucas et al. 2026, https://doi.org/10.5281/zenodo.20549059,
 * CC BY 4.0) has human labels only for the 103-item sample, but it also holds
 * Gemini 3's output for 101 Ubuntu test cases ("Gemini-3 (outputs).txt").
 * Gemini 3 agrees with the human labels at F1 0.91 on the sample, so its labels
 * are a "silver standard": not ground truth, but a useful reference.
 *
 * We compare our rules with Gemini 3 on
 *   - the sample test cases (seen while tuning), and
 *   - the other test cases (never seen while tuning).
 * If agreement is similar on both, the tuning did not overfit the sample.
 *
 * Run: npx tsx bench/heldout.ts   (from the repo root)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { detectAll, ALL_SMELL_NAMES } from '../packages/core/src/index.js'
import type { Finding, SmellName, Step, TestCase } from '../packages/core/src/index.js'
import { f1, precision, recall } from './score.js'
import type { Counts } from './score.js'

interface Item { id: number; where: 'action' | 'verification'; text: string; gemini3: SmellName[] }
interface Case { testCase: string; testIndex: string; inSample: boolean; items: Item[] }

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(readFileSync(resolve(root, 'datasets/benchmark/gemini3-outputs.json'), 'utf-8')) as { cases: Case[] }

/** Our labels per item of one test case (same mapping as bench/score.ts). */
function ourLabels(c: Case): Set<SmellName>[] {
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
  const labels = c.items.map(() => new Set<SmellName>())
  const locate = (f: Finding) =>
    f.smellName === 'UnverifiedAction' || f.field === 'action'
      ? itemOf.get(`${f.stepIndex}|a`)
      : itemOf.get(`${f.stepIndex}|v${f.verificationIndex ?? 0}`)
  for (const f of detectAll({ id: 's', name: 's', cases: [tc] }).findings) {
    const i = locate(f)
    if (i !== undefined) labels[i]!.add(f.smellName)
  }
  return labels
}

function compare(cases: Case[]) {
  const total: Counts & { tn: number } = { tp: 0, fp: 0, fn: 0, tn: 0 }
  const perSmell = Object.fromEntries(ALL_SMELL_NAMES.map(s => [s, { tp: 0, fp: 0, fn: 0 }])) as Record<SmellName, Counts>
  let items = 0
  for (const c of cases) {
    const ours = ourLabels(c)
    c.items.forEach((item, i) => {
      items++
      const g = new Set(item.gemini3)
      const o = ours[i]!
      if (g.size === 0 && o.size === 0) total.tn++
      for (const s of g) (o.has(s) ? (total.tp++, perSmell[s].tp++) : (total.fn++, perSmell[s].fn++))
      for (const s of o) if (!g.has(s)) { total.fp++; perSmell[s].fp++ }
    })
  }
  return { cases: cases.length, items, total, perSmell }
}

/**
 * The unseen cases are split once, by sorted name, into two halves:
 *   dev  — may be looked at to improve the rules;
 *   test — never looked at; the honest number.
 */
const unseenCases = data.cases.filter(c => !c.inSample).sort((a, b) => `${a.testCase}#${a.testIndex}`.localeCompare(`${b.testCase}#${b.testIndex}`))
export const devCases = unseenCases.filter((_, i) => i % 2 === 0)
export const testCases = unseenCases.filter((_, i) => i % 2 === 1)

const seen = compare(data.cases.filter(c => c.inSample))
const unseen = compare(unseenCases)
const dev = compare(devCases)
const test = compare(testCases)
const pct = (x: number) => x.toFixed(2)

const lines = [
  '# Held-out check — agreement with Gemini 3 (silver standard)',
  '',
  'Gemini 3 labels are predictions (F1 0.91 against the human labels on the sample), not ground truth.',
  '',
  '| Test cases | Cases | Items | Precision | Recall | F1 (agreement) |',
  '|---|---|---|---|---|---|',
  `| Sample (seen while tuning) | ${seen.cases} | ${seen.items} | ${pct(precision(seen.total))} | ${pct(recall(seen.total))} | **${pct(f1(seen.total))}** |`,
  `| Held-out, all | ${unseen.cases} | ${unseen.items} | ${pct(precision(unseen.total))} | ${pct(recall(unseen.total))} | **${pct(f1(unseen.total))}** |`,
  `| Held-out, dev half (may be used for tuning) | ${dev.cases} | ${dev.items} | ${pct(precision(dev.total))} | ${pct(recall(dev.total))} | **${pct(f1(dev.total))}** |`,
  `| **Held-out, test half (never looked at)** | ${test.cases} | ${test.items} | ${pct(precision(test.total))} | ${pct(recall(test.total))} | **${pct(f1(test.total))}** |`,
  '',
  '## Per smell, test half',
  '',
  '| Smell | Gemini 3 labels | TP | FP | FN | Precision | Recall | F1 |',
  '|---|---|---|---|---|---|---|---|',
  ...ALL_SMELL_NAMES.map(s => {
    const c = test.perSmell[s]
    return `| ${s} | ${c.tp + c.fn} | ${c.tp} | ${c.fp} | ${c.fn} | ${pct(precision(c))} | ${pct(recall(c))} | ${pct(f1(c))} |`
  }),
]
if (process.env['EXORCIST_DEV_DUMP']) {
  for (const c of devCases) {
    const ours = ourLabels(c)
    c.items.forEach((item, i) => {
      const smell = process.env['EXORCIST_DEV_DUMP'] as SmellName
      const g = item.gemini3.includes(smell)
      const o = ours[i]!.has(smell)
      if (g !== o) console.error(`${o ? 'FP' : 'FN'} ${item.where.padEnd(12)} ${item.text.slice(0, 150)}`)
    })
  }
}

const report = lines.join('\n')
console.log(report)
mkdirSync(resolve(root, 'bench/results'), { recursive: true })
writeFileSync(resolve(root, 'bench/results/heldout-gemini3.md'), report + '\n')
