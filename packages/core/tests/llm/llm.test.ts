/**
 * Unit tests for the LLM reviewer and the Gemini client — no network: the
 * model and fetch are fakes.
 *
 * Requirements (spec llm-reviewer): 1.1–1.5, 2.1–2.4, 3.1–3.3
 */

import { describe, it, expect } from 'vitest'
import {
  detectAll, reviewWithLlm, memoryCache, createGeminiClient, buildPrompt, parseVerdict, LlmError,
} from '../../src/index.js'
import type { LlmClient, TestSuite } from '../../src/index.js'

function suiteOf(rows: [string, string[]][]): TestSuite {
  return {
    id: 's',
    name: 'S',
    cases: [{ id: 'c1', title: 'Demo', preconditions: [], steps: rows.map(([action, verifications], i) => ({ index: i, action, verifications })) }],
  }
}

/** A fake model: answers by looking at the text in the prompt. */
function fakeModel(decide: (prompt: string) => { isSmell: boolean; reason?: string; words?: string } | string): LlmClient & { calls: string[] } {
  const calls: string[] = []
  return {
    name: 'fake',
    calls,
    async complete(prompt: string) {
      calls.push(prompt)
      const d = decide(prompt)
      return typeof d === 'string' ? d : JSON.stringify({ reason: 'Because.', words: '', ...d })
    },
  }
}

// "Insert a media card" → Ambiguous Test review candidate; "Upload a larger file" → review candidate.
const suite = suiteOf([
  ['Insert a media card into the reader.', ['The card is shown.']],
  ['Upload a larger file.', ['The upload finishes.']],
  ['Click Save.', ['Saved.']],
])

describe('reviewWithLlm — review candidates (Req 1)', () => {
  it('a "yes" becomes a hybrid finding, a "no" drops the review candidate', async () => {
    const result = detectAll(suite)
    expect(result.reviewCandidates.map(r => r.stepIndex)).toEqual([0, 1])
    const model = fakeModel(p => (p.includes('into the reader') ? { isSmell: true, reason: 'Which media card is not said.', words: 'a media card' } : { isSmell: false }))

    const reviewed = await reviewWithLlm(suite, result, model)

    const f = reviewed.findings.find(x => x.smellName === 'AmbiguousTest')!
    expect(f).toMatchObject({ stepIndex: 0, confidence: 'hybrid', reason: 'Which media card is not said.', fixName: 'ExtractAmbiguity', ghostName: 'Fog Wraith' })
    expect(suite.cases[0]!.steps[0]!.action.slice(f.span!.start, f.span!.end)).toBe('a media card')
    expect(reviewed.reviewCandidates).toEqual([])
    expect(reviewed.llm).toEqual({ asked: 2, cached: 0, confirmed: 1, rejected: 1, failed: 0 })
  })

  it('never removes a rule finding', async () => {
    const s = suiteOf([['Reload the page quickly.', ['Shown.']]])
    const result = detectAll(s)
    const reviewed = await reviewWithLlm(s, result, fakeModel(() => ({ isSmell: false })))
    expect(reviewed.findings).toEqual(result.findings)
  })

  it('a failed call keeps the review candidate and records the error', async () => {
    const broken: LlmClient = { name: 'broken', complete: async () => { throw new LlmError('Gemini request failed with 503', 503) } }
    const reviewed = await reviewWithLlm(suite, detectAll(suite), broken)
    expect(reviewed.reviewCandidates).toHaveLength(2)
    expect(reviewed.errors[0]!.message).toContain('LLM reviewer: Gemini request failed with 503')
    expect(reviewed.llm.failed).toBe(2)
  })

  it('an answer that is not the expected JSON keeps the review candidate', async () => {
    const reviewed = await reviewWithLlm(suite, detectAll(suite), fakeModel(() => 'I think so!'))
    expect(reviewed.reviewCandidates).toHaveLength(2)
    expect(reviewed.llm.failed).toBe(2)
  })
})

describe('reviewWithLlm — stops after repeated failures', () => {
  it('stops calling the model after 3 failed calls in a row', async () => {
    let calls = 0
    const broken: LlmClient = { name: 'broken', complete: async () => { calls++; throw new LlmError('Gemini request failed with 404', 404) } }
    const s = suiteOf([['Boot up the image.', ['Shown.']], ['Click Save.', ['Saved.']], ['Open the app.', ['Opens.']]])
    const reviewed = await reviewWithLlm(s, detectAll(s), broken, { sweep: ['AmbiguousTest'] })
    expect(calls).toBe(3)
    expect(reviewed.llm.failed).toBe(reviewed.llm.asked)
    expect(reviewed.errors.some(e => e.message.includes('stopped calling the model'))).toBe(true)
  })
})

describe('reviewWithLlm — cache (Req 1.4)', () => {
  it('the same question is asked only once', async () => {
    const cache = memoryCache()
    const model = fakeModel(() => ({ isSmell: true }))
    await reviewWithLlm(suite, detectAll(suite), model, { cache })
    const again = await reviewWithLlm(suite, detectAll(suite), model, { cache })
    expect(model.calls).toHaveLength(2)
    expect(again.llm.cached).toBe(2)
  })

  it('a failed answer is not cached', async () => {
    const cache = memoryCache()
    await reviewWithLlm(suite, detectAll(suite), fakeModel(() => 'nope'), { cache })
    const model = fakeModel(() => ({ isSmell: false }))
    await reviewWithLlm(suite, detectAll(suite), model, { cache })
    expect(model.calls).toHaveLength(2)
  })
})

describe('reviewWithLlm — sweep (Req 3)', () => {
  it('asks about every field without a finding for that smell; a "yes" is an llm finding', async () => {
    const s = suiteOf([['Boot up the image.', ['The desktop appears.']], ['Click Save.', ['Saved.']]])
    const model = fakeModel(p => ({ isSmell: p.includes('"Boot up the image."') && p.includes('Decide ONLY whether the action') }))
    const reviewed = await reviewWithLlm(s, detectAll(s), model, { sweep: ['AmbiguousTest'] })
    expect(model.calls).toHaveLength(4) // 2 actions + 2 expected results
    expect(reviewed.findings.filter(f => f.smellName === 'AmbiguousTest')).toMatchObject([{ stepIndex: 0, field: 'action', confidence: 'llm' }])
  })

  it('does not ask again about a field that already has a finding', async () => {
    const s = suiteOf([['Reload the page quickly.', ['Shown.']]])
    const model = fakeModel(() => ({ isSmell: true }))
    await reviewWithLlm(s, detectAll(s), model, { sweep: ['AmbiguousTest'] })
    expect(model.calls).toHaveLength(1) // only the expected result
  })
})

describe('prompt and answer parsing', () => {
  it('the prompt names the smell, its definition, the whole step and the exact text', () => {
    const s = suiteOf([['Insert a media card.', ['The card is shown.']]])
    const p = buildPrompt({ smell: 'AmbiguousTest', testCase: s.cases[0]!, step: s.cases[0]!.steps[0]!, field: 'action', hint: 'h' })
    expect(p).toContain('Smell to decide: AmbiguousTest')
    expect(p).toContain('Expected result 1: "The card is shown."')
    expect(p).toContain('Decide ONLY whether the action — "Insert a media card."')
    expect(p).toContain('{"isSmell": true or false')
  })

  it.each([
    ['{"isSmell": true, "reason": "Vague.", "words": "a card"}', { isSmell: true, reason: 'Vague.', words: 'a card' }],
    ['```json\n{"isSmell": false, "reason": "Clear.", "words": ""}\n```', { isSmell: false, reason: 'Clear.' }],
    ['{"isSmell": "yes"}', null],
    ['not json', null],
  ])('parseVerdict(%s)', (answer, expected) => {
    expect(parseVerdict(answer)).toEqual(expected)
  })

  it('clips reasons to 25 words', () => {
    const long = Array.from({ length: 40 }, () => 'word').join(' ')
    expect(parseVerdict(JSON.stringify({ isSmell: true, reason: long }))!.reason.split(' ')).toHaveLength(25)
  })
})

describe('Gemini client (Req 2) — fake fetch', () => {
  type Call = { url: string; init: RequestInit }
  function fakeFetch(responses: { status: number; body: unknown }[]) {
    const calls: Call[] = []
    const fn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      const r = responses.shift()!
      return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status })
    }) as unknown as typeof fetch
    return { fn, calls }
  }
  const ok = (text: string) => ({ status: 200, body: { candidates: [{ content: { parts: [{ text }] } }] } })

  it('sends the key once, in the x-goog-api-key header, to the native endpoint, asking for JSON', async () => {
    const f = fakeFetch([ok('{"isSmell":true}')])
    const client = createGeminiClient({ apiKey: 'AQ.test-key', model: 'gemini-3.8-flash', fetchImpl: f.fn })
    expect(await client.complete('hello')).toBe('{"isSmell":true}')
    const { url, init } = f.calls[0]!
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent')
    expect(url).not.toContain('key=')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AQ.test-key')
    const body = JSON.parse(init.body as string)
    expect(body.generationConfig).toEqual({ temperature: 0, responseMimeType: 'application/json' })
    expect(client.name).toBe('gemini:gemini-3.8-flash')
  })

  it('retries 429 with the server\'s retry delay, then succeeds', async () => {
    const waits: number[] = []
    const f = fakeFetch([
      { status: 429, body: '{"error":{"details":[{"retryDelay":"7s"}]}}' },
      ok('{"isSmell":false}'),
    ])
    const client = createGeminiClient({ apiKey: 'k', fetchImpl: f.fn, sleep: async ms => void waits.push(ms) })
    expect(await client.complete('x')).toBe('{"isSmell":false}')
    expect(waits).toEqual([7000])
  })

  it('gives up after maxRetries and the error never contains the key', async () => {
    const f = fakeFetch(Array.from({ length: 3 }, () => ({ status: 503, body: '{"error":{"message":"overloaded"}}' })))
    const client = createGeminiClient({ apiKey: 'AQ.secret', fetchImpl: f.fn, maxRetries: 2, sleep: async () => {} })
    await expect(client.complete('x')).rejects.toThrow('Gemini request failed with 503: overloaded')
    await expect(createGeminiClient({ apiKey: 'AQ.secret', fetchImpl: fakeFetch([{ status: 401, body: '{}' }]).fn }).complete('x')).rejects.not.toThrow(/AQ\.secret/)
  })

  it('fails at once when the server asks to wait longer than maxRetryDelayMs (quota used up)', async () => {
    const waits: number[] = []
    const f = fakeFetch([{ status: 429, body: '{"error":{"message":"Quota exceeded","details":[{"retryDelay":"21600s"}]}}' }])
    const client = createGeminiClient({ apiKey: 'k', fetchImpl: f.fn, sleep: async ms => void waits.push(ms) })
    await expect(client.complete('x')).rejects.toThrow('Gemini asked to wait 21600 s (quota used up?): Quota exceeded')
    expect(waits).toEqual([])
  })

  it('a request that never answers times out instead of hanging', async () => {
    const hanging = ((_url: string, init: RequestInit) =>
      new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' }))))) as unknown as typeof fetch
    const client = createGeminiClient({ apiKey: 'k', fetchImpl: hanging, timeoutMs: 20, maxRetries: 1, sleep: async () => {} })
    await expect(client.complete('x')).rejects.toThrow('Gemini did not answer within 0 s.')
  })

  it('does not retry a 400', async () => {
    const f = fakeFetch([{ status: 400, body: '{"error":{"message":"bad request"}}' }])
    const client = createGeminiClient({ apiKey: 'k', fetchImpl: f.fn, sleep: async () => {} })
    await expect(client.complete('x')).rejects.toThrow('400')
    expect(f.calls).toHaveLength(1)
  })

  it('refuses an empty key', () => {
    expect(() => createGeminiClient({ apiKey: '' })).toThrow('No Gemini API key')
  })
})
