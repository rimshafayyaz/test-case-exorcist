/**
 * Gemini client for the LLM reviewer (Google AI Studio / Gemini API).
 *
 * - The key is sent once, in the `x-goog-api-key` header, to the native
 *   endpoint. Keys are treated as opaque strings, so both "AIza…" and the
 *   newer "AQ.…" keys work.
 * - JSON output, temperature 0, so answers are as repeatable as possible.
 * - Free-tier friendly: optional minimum interval between calls, and retries
 *   with back-off on 429 / 5xx (honouring the server's retry delay).
 * - Error messages never contain the key.
 *
 * Requirements (spec llm-reviewer): 2.1–2.4
 */

import type { LlmClient } from './types.js'

export interface GeminiOptions {
  apiKey: string
  /** Default "gemini-3.5-flash-lite". */
  model?: string
  /** Wait at least this long between two calls (rate limits). Default 0. */
  minIntervalMs?: number
  /** Retries on 429 / 5xx. Default 4. */
  maxRetries?: number
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
  /** Injected for tests; defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>
  /** Give up on one request after this long. Default 60 000. */
  timeoutMs?: number
  /** Longest wait before a retry; a server asking for longer (e.g. a daily quota) fails at once. Default 60 000. */
  maxRetryDelayMs?: number
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/** "12s" / "1.5s" from a google.rpc.RetryInfo detail, in ms. */
function retryDelayMs(body: string): number | undefined {
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body)
  return m ? Math.ceil(Number(m[1]) * 1000) : undefined
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'LlmError'
  }
}

export function createGeminiClient(options: GeminiOptions): LlmClient {
  const model = options.model ?? 'gemini-3.5-flash-lite'
  const fetchImpl = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? defaultSleep
  const maxRetries = options.maxRetries ?? 4
  const minInterval = options.minIntervalMs ?? 0
  const timeoutMs = options.timeoutMs ?? 60_000
  const maxRetryDelay = options.maxRetryDelayMs ?? 60_000
  if (!options.apiKey || options.apiKey.trim() === '') throw new LlmError('No Gemini API key was given.')
  let lastCall = 0

  return {
    name: `gemini:${model}`,
    async complete(prompt: string): Promise<string> {
      for (let attempt = 0; ; attempt++) {
        const wait = lastCall + minInterval - Date.now()
        if (wait > 0) await sleep(wait)
        lastCall = Date.now()

        let response: Response
        try {
          response = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
          signal: AbortSignal.timeout(timeoutMs),
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': options.apiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, responseMimeType: 'application/json' },
          }),
          })
        } catch (err) {
          const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
          if (attempt < maxRetries) {
            await sleep(2000 * 2 ** attempt)
            continue
          }
          throw new LlmError(timedOut ? `Gemini did not answer within ${Math.round(timeoutMs / 1000)} s.` : `Could not reach Gemini: ${err instanceof Error ? err.message : String(err)}`)
        }
        const body = await response.text()

        if (response.ok) {
          let data: unknown
          try {
            data = JSON.parse(body)
          } catch {
            throw new LlmError('Gemini returned a response that is not JSON.', response.status)
          }
          const text = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
            .candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('')
          if (!text) throw new LlmError('Gemini returned no text (the answer may have been blocked).', response.status)
          return text
        }

        const retryable = response.status === 429 || response.status >= 500
        const delay = retryDelayMs(body) ?? 2000 * 2 ** attempt
        const detail = /"message"\s*:\s*"([^"]{0,200})/.exec(body)?.[1] ?? ''
        if (retryable && delay > maxRetryDelay) {
          throw new LlmError(`Gemini asked to wait ${Math.round(delay / 1000)} s (quota used up?)${detail ? `: ${detail}` : ''}`, response.status)
        }
        if (retryable && attempt < maxRetries) {
          await sleep(delay)
          continue
        }
        throw new LlmError(`Gemini request failed with ${response.status}${detail ? `: ${detail}` : ''}`, response.status)
      }
    },
  }
}
