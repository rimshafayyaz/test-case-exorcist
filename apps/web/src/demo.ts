import type { LlmClient, TestSuite } from '@exorcist/core'
import haunted from './demo/haunted.json'
import ubuntu from './demo/ubuntu.json'
import saved from './demo/ai-answers.json'

export const DEMO_SUITES: Record<'haunted' | 'ubuntu', { label: string; suite: TestSuite }> = {
  haunted: { label: '🏦 Haunted mobile banking suite (one ghost per test case)', suite: haunted as TestSuite },
  ubuntu: { label: '🐧 Real test cases from the 2026 study (Ubuntu, 14 cases, AI answers saved)', suite: ubuntu as TestSuite },
}

/**
 * Demo mode: answers the AI reviewer's questions with the Gemini answers the
 * benchmark already saved (no key, no network). A question without a saved
 * answer fails, and its review candidate stays uncertain.
 */
export const savedAnswersClient: LlmClient = {
  name: saved.model,
  async complete(prompt: string) {
    const answer = (saved.answers as Record<string, string>)[prompt]
    if (!answer) throw new Error('no saved AI answer for this step (use your own key to ask Gemini)')
    return answer
  },
}

export const SAVED_MODEL = saved.model.replace(/^gemini:/, '')
