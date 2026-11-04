/**
 * Benchmark: our rule-based detectors on the public sample of the 2026 Gemini 3
 * study (103 step items from 14 Ubuntu manual test cases, labelled by the authors).
 *
 * Data: datasets/benchmark/gemini3-sample.json, extracted from
 *   Lucas, Gheyi, Ribeiro, Palomba, Martins, Soares — Zenodo 2026,
 *   https://doi.org/10.5281/zenodo.20549059 (CC BY 4.0).
 *
 * Scoring follows the study's confusion matrix (CM sheet): per item and per
 * smell label, TP = label in both, FP = predicted only, FN = baseline only,
 * TN = 1 when both have no smell. F1 = 2·TP / (2·TP + FP + FN).
 * Unverified Action is counted on the action item, as in the study.
 *
 * Used by bench/run.ts (report) and packages/core/tests/benchmark (regression gate).
 */

import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { detectAll, ALL_SMELL_NAMES } from '../packages/core/src/index.js'
import type { SmellName, Step, TestCase, Finding } from '../packages/core/src/index.js'

export interface Item {
  id: number
  testCase: string
  where: 'action' | 'verification'
  text: string
  baseline: SmellName[]
  gemini3: SmellName[]
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const data = JSON.parse(readFileSync(resolve(root, 'datasets/benchmark/gemini3-sample.json'), 'utf-8')) as { items: Item[] }

/** Rebuild test cases: each <dt> starts a step, following <dd> items are its verifications. */
export function buildCases(items: Item[]): { cases: TestCase[]; locate: (f: Finding) => Item | undefined } {
  const cases = new Map<string, TestCase>()
  const where = new Map<string, Item>() // "case|step|field|verificationIndex" → item
  for (const item of items) {
    let tc = cases.get(item.testCase)
    if (!tc) {
      tc = { id: item.testCase, title: item.testCase, preconditions: [], steps: [] }
      cases.set(item.testCase, tc)
    }
    if (item.where === 'action' || tc.steps.length === 0) {
      const step: Step = { index: tc.steps.length, action: item.where === 'action' ? item.text : '', verifications: [] }
      tc.steps.push(step)
      if (item.where === 'action') where.set(`${tc.id}|${step.index}|action|`, item)
    }
    if (item.where === 'verification') {
      const step = tc.steps[tc.steps.length - 1]!
      where.set(`${tc.id}|${step.index}|verification|${step.verifications.length}`, item)
      step.verifications.push(item.text)
    }
  }
  const locate = (f: Finding) =>
    f.smellName === 'UnverifiedAction' || f.field === 'action'
      ? where.get(`${f.caseId}|${f.stepIndex}|action|`)
      : where.get(`${f.caseId}|${f.stepIndex}|verification|${f.verificationIndex ?? 0}`)
  return { cases: [...cases.values()], locate }
}

export type Counts = { tp: number; fp: number; fn: number }
export const f1 = (c: Counts) => (2 * c.tp + c.fp + c.fn === 0 ? 1 : (2 * c.tp) / (2 * c.tp + c.fp + c.fn))
export const precision = (c: Counts) => (c.tp + c.fp === 0 ? 1 : c.tp / (c.tp + c.fp))
export const recall = (c: Counts) => (c.tp + c.fn === 0 ? 1 : c.tp / (c.tp + c.fn))

/** Item ids restart in every test case (and repeat in one), so items are keyed by position. */
const seq = new Map(data.items.map((item, i) => [item, i]))
export const keyOf = (i: Item) => `${i.testCase}#${i.id}@${seq.get(i)}`

export function score(predicted: Map<string, Set<SmellName>>) {
  const total: Counts & { tn: number } = { tp: 0, fp: 0, fn: 0, tn: 0 }
  const perSmell = Object.fromEntries(ALL_SMELL_NAMES.map(s => [s, { tp: 0, fp: 0, fn: 0 }])) as Record<SmellName, Counts>
  const misses: { id: string; text: string; where: string; missed: SmellName[]; extra: SmellName[] }[] = []
  for (const item of data.items) {
    const b = new Set(item.baseline)
    const p = predicted.get(keyOf(item)) ?? new Set<SmellName>()
    if (b.size === 0 && p.size === 0) total.tn++
    const missed = [...b].filter(s => !p.has(s))
    const extra = [...p].filter(s => !b.has(s))
    for (const s of b) if (p.has(s)) { total.tp++; perSmell[s].tp++ }
    for (const s of extra) { total.fp++; perSmell[s].fp++ }
    for (const s of missed) { total.fn++; perSmell[s].fn++ }
    if (missed.length || extra.length) misses.push({ id: keyOf(item), text: item.text, where: item.where, missed, extra })
  }
  return { total, perSmell, misses }
}

export function runBenchmark() {
  const { cases, locate } = buildCases(data.items)
  const start = performance.now()
  const result = detectAll({ id: 'gemini3-sample', name: 'Gemini 3 study sample', cases })
  const ms = performance.now() - start

  const ours = new Map<string, Set<SmellName>>()
  const reviews = new Map<string, Set<SmellName>>()
  for (const f of result.findings) {
    const item = locate(f)
    if (item) ours.set(keyOf(item), (ours.get(keyOf(item)) ?? new Set()).add(f.smellName))
  }
  for (const r of result.reviewCandidates) {
    const item = locate({ ...r, field: r.field ?? 'action' } as Finding)
    if (item) reviews.set(keyOf(item), (reviews.get(keyOf(item)) ?? new Set()).add(r.smellName))
  }
  const gemini = new Map(data.items.map(i => [keyOf(i), new Set(i.gemini3)]))

  const rules = score(ours)
  const rulesPlusReview = score(new Map(data.items.map(i => [keyOf(i), new Set([...(ours.get(keyOf(i)) ?? []), ...(reviews.get(keyOf(i)) ?? [])])])))
  const geminiScore = score(gemini)
  return { data, cases, ms, rules, rulesPlusReview, geminiScore }
}
