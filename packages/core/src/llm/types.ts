/**
 * Types for the LLM reviewer (spec llm-reviewer).
 */

/** Any text-in, text-out model. The Gemini client is one; tests use fakes. */
export interface LlmClient {
  /** Stable name used in cache keys, e.g. "gemini:gemini-3.5-flash-lite". */
  readonly name: string
  /** Send one prompt; resolve with the model's text answer. */
  complete(prompt: string): Promise<string>
}

/** Where answers are kept so the same question is never paid for twice. */
export interface LlmCache {
  get(key: string): string | undefined
  set(key: string, value: string): void
}

/** The model's decision for one question. */
export interface LlmVerdict {
  isSmell: boolean
  /** One sentence, at most 25 words. */
  reason: string
  /** The exact words that carry the smell, when there are some. */
  words?: string
}

export interface LlmStats {
  /** Questions asked in total. */
  asked: number
  /** Answers taken from the cache (no model call). */
  cached: number
  /** Review candidates or sweep questions the model confirmed as smells. */
  confirmed: number
  /** Review candidates the model rejected (dropped). */
  rejected: number
  /** Calls or answers that failed; those review candidates are kept. */
  failed: number
}
