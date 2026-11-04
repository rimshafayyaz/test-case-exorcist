/**
 * LLM reviewer (spec llm-reviewer): optional, async, never needed for detection.
 */
export { reviewWithLlm, memoryCache } from './reviewer.js'
export type { ReviewOptions, ReviewedResult } from './reviewer.js'
export { createGeminiClient, LlmError } from './gemini.js'
export type { GeminiOptions } from './gemini.js'
export { buildPrompt, parseVerdict, SMELL_DEFINITIONS } from './prompt.js'
export type { Question } from './prompt.js'
export type { LlmClient, LlmCache, LlmVerdict, LlmStats } from './types.js'
