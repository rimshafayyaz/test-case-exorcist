/**
 * Unit tests for the importers (spec importers).
 */

import { describe, it, expect } from 'vitest'
import { importText, importCsv, importJson, importRows, importSuite, ImportError, detectAll } from '../../src/index.js'
import type { TestSuite } from '../../src/index.js'

const shape = (s: TestSuite) => s.cases.map(c => ({ id: c.id, title: c.title, pre: c.preconditions, steps: c.steps.map(st => [st.index, st.action, st.verifications]) }))

describe('importText — pasted numbered steps (Req 1)', () => {
  it('reads titles, preconditions, numbered steps and expected results', () => {
    const { suite, warnings } = importText(
      [
        'Test case: Change language',
        'Preconditions:',
        '- The user is logged in.',
        '1. Open the settings page.',
        '   Expected: The settings appear.',
        '2) Click Language.',
        '   - The language list appears.',
        '   - Urdu is listed.',
        'Step 3: Click Save.',
        '',
        '# Logout',
        '1. Click Logout.',
        '   => The login page is shown.',
      ].join('\n'),
    )
    expect(warnings).toEqual([])
    expect(shape(suite)).toEqual([
      {
        id: 'case-1', title: 'Change language', pre: ['The user is logged in.'],
        steps: [[0, 'Open the settings page.', ['The settings appear.']], [1, 'Click Language.', ['The language list appears.', 'Urdu is listed.']], [2, 'Click Save.', []]],
      },
      { id: 'case-2', title: 'Logout', pre: [], steps: [[0, 'Click Logout.', ['The login page is shown.']]] },
    ])
  })

  it('text without a title is one test case', () => {
    const { suite } = importText('1. Click Save.\n2. Close the app.')
    expect(suite.cases).toHaveLength(1)
    expect(suite.cases[0]!.steps.map(s => s.action)).toEqual(['Click Save.', 'Close the app.'])
  })

  it('an indented line under a step continues its action', () => {
    const { suite } = importText('1. Open the settings page\n   and change the language.')
    expect(suite.cases[0]!.steps[0]!.action).toBe('Open the settings page and change the language.')
  })

  it('remembers the line number of each step', () => {
    expect(importText('Title: T\n1. Click Save.').suite.cases[0]!.steps[0]!.source).toEqual({ line: 2 })
  })

  it('no numbered steps → a clear error', () => {
    expect(() => importText('just some notes')).toThrow(ImportError)
    expect(() => importText('just some notes')).toThrow('No numbered steps found')
  })
})

describe('importCsv / importRows — CSV and Excel tables (Req 2)', () => {
  const csv = [
    'Test Case ID,Title,Preconditions,Step,Action,Expected Result',
    'TC1,Login,User exists,1,Open the app.,The app opens.',
    'TC1,Login,,2,"Enter username and password, then click Login.","1. Home page shown',
    '2. Welcome message"',
    'TC2,Search,,1,Make a search,',
    'TC2,Search,,,,Results are listed.',
  ].join('\n')

  it('groups rows by test case and splits multi-line expected results', () => {
    const { suite, warnings } = importCsv(csv)
    expect(warnings).toEqual([])
    expect(shape(suite)).toEqual([
      { id: 'TC1', title: 'Login', pre: ['User exists'], steps: [[0, 'Open the app.', ['The app opens.']], [1, 'Enter username and password, then click Login.', ['Home page shown', 'Welcome message']]] },
      { id: 'TC2', title: 'Search', pre: [], steps: [[0, 'Make a search', ['Results are listed.']]] },
    ])
  })

  it('the imported suite goes straight into the detectors', () => {
    const labels = detectAll(importCsv(csv).suite).findings.map(f => `${f.caseId}:${f.stepIndex}:${f.smellName}`)
    expect(labels).toContain('TC1:1:EagerAction')
  })

  it('detects semicolon and tab delimiters and the Excel BOM', () => {
    expect(importCsv('﻿Action;Expected\nClick Save.;Saved.').suite.cases[0]!.steps[0]!.verifications).toEqual(['Saved.'])
    expect(importCsv('Action\tExpected\nClick Save.\tSaved.').suite.cases[0]!.steps).toHaveLength(1)
  })

  it('accepts common column names from test-management exports', () => {
    const { suite } = importRows([
      ['Test Name', 'Step Description', 'Expected Outcome'],
      ['Login', 'Open the app.', 'The app opens.'],
      ['Login', 'Click Login.', 'The form appears.'],
      ['Logout', 'Click Logout.', 'Bye.'],
    ])
    expect(suite.cases.map(c => [c.title, c.steps.length])).toEqual([['Login', 2], ['Logout', 1]])
  })

  it('a table without an action column → a clear error naming the columns found', () => {
    expect(() => importRows([['Name', 'Notes'], ['A', 'B']])).toThrow('No action column found')
  })

  it('rows without an action are reported, not silently lost', () => {
    const { warnings } = importRows([['Action', 'Expected'], ['Click Save.', 'Saved.'], ['', ''], ['', '']])
    expect(warnings).toEqual([])
    expect(importRows([['Case', 'Action'], ['A', 'Click.'], ['B', '']]).warnings).toEqual(['Row 3 has no action; skipped.', 'Test case "B" has no steps; skipped.'])
  })

  it('remembers the spreadsheet row of each step', () => {
    expect(importRows([['Action'], ['Click Save.']]).suite.cases[0]!.steps[0]!.source).toEqual({ row: 2 })
  })
})

describe('importJson — our format, forgiving (Req 3)', () => {
  it('reads a full TestSuite', () => {
    const json = JSON.stringify({ id: 's', name: 'Suite', cases: [{ id: 'c1', title: 'T', preconditions: ['P'], steps: [{ index: 0, action: 'Click.', verifications: ['Done.'] }] }] })
    expect(shape(importJson(json).suite)).toEqual([{ id: 'c1', title: 'T', pre: ['P'], steps: [[0, 'Click.', ['Done.']]] }])
  })

  it('accepts a bare array, "expected" instead of "verifications", missing ids and indexes', () => {
    const { suite } = importJson(JSON.stringify([{ title: 'T', steps: [{ action: 'Click.', expected: 'Done.' }, 'Close.'] }]))
    expect(shape(suite)).toEqual([{ id: 'case-1', title: 'T', pre: [], steps: [[0, 'Click.', ['Done.']], [1, 'Close.', []]] }])
  })

  it('invalid JSON → a clear error', () => {
    expect(() => importJson('{ nope')).toThrow('This is not valid JSON')
    expect(() => importJson('{"a": 1}')).toThrow('Expected a suite like')
  })
})

describe('importSuite — the web app dropdown', () => {
  it.each(['text', 'csv', 'json'] as const)('format "%s" works', format => {
    const input = { text: '1. Click Save.', csv: 'Action\nClick Save.', json: '[{"title":"T","steps":["Click Save."]}]' }[format]
    expect(importSuite(format, input).suite.cases[0]!.steps[0]!.action).toBe('Click Save.')
  })
})
