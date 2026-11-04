/**
 * JSON importer — our TestSuite format, with forgiving defaults:
 *   { "name": "...", "cases": [ { "title": "...", "preconditions": [...],
 *       "steps": [ { "action": "...", "verifications": [...] } ] } ] }
 * Also accepted: a bare array of test cases; "expected" (string or array)
 * instead of "verifications"; missing ids and step indexes.
 *
 * Requirements (spec importers): 3.1–3.3
 */

import type { Step, TestCase, TestSuite } from '../models/index.js'
import { ImportError } from './types.js'
import type { ImportResult } from './types.js'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const strings = (v: unknown): string[] =>
  typeof v === 'string' ? (v.trim() ? [v.trim()] : []) : Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(x => x.trim()) : []

export function importJson(text: string, options: { name?: string } = {}): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text.replace(/^﻿/, ''))
  } catch (err) {
    throw new ImportError(`This is not valid JSON: ${err instanceof Error ? err.message : String(err)}`)
  }
  const rawCases = Array.isArray(data) ? data : isObj(data) && Array.isArray(data['cases']) ? data['cases'] : undefined
  if (!rawCases) throw new ImportError('Expected a suite like { "cases": [ … ] } or an array of test cases.')

  const warnings: string[] = []
  const cases: TestCase[] = []
  rawCases.forEach((raw, ci) => {
    if (!isObj(raw)) return void warnings.push(`Test case ${ci + 1} is not an object; skipped.`)
    const rawSteps = Array.isArray(raw['steps']) ? raw['steps'] : []
    const steps: Step[] = []
    rawSteps.forEach((rs, si) => {
      const action = isObj(rs) ? (typeof rs['action'] === 'string' ? rs['action'].trim() : '') : typeof rs === 'string' ? rs.trim() : ''
      if (!action) return void warnings.push(`Test case ${ci + 1}, step ${si + 1} has no action; skipped.`)
      const verifications = isObj(rs) ? strings(rs['verifications'] ?? rs['expected'] ?? rs['expectedResult']) : []
      steps.push({ index: steps.length, action, verifications })
    })
    const title = typeof raw['title'] === 'string' && raw['title'].trim() ? raw['title'].trim() : typeof raw['name'] === 'string' ? raw['name'] : `Test case ${ci + 1}`
    if (steps.length === 0) return void warnings.push(`Test case "${title}" has no steps; skipped.`)
    const id = typeof raw['id'] === 'string' || typeof raw['id'] === 'number' ? String(raw['id']) : `case-${ci + 1}`
    cases.push({ id, title, preconditions: strings(raw['preconditions'] ?? raw['precondition']), steps })
  })
  if (cases.length === 0) throw new ImportError('No test case with steps was found.')

  const suite: TestSuite = {
    id: isObj(data) && typeof data['id'] === 'string' ? data['id'] : 'imported',
    name: options.name ?? (isObj(data) && typeof data['name'] === 'string' ? data['name'] : 'Imported suite'),
    cases,
  }
  return { suite, warnings }
}
