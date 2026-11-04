// @exorcist/core — public API
export const VERSION = '0.1.0'

export type {
  SmellName,
  FixName,
  TestSuite,
  TestCase,
  Step,
  Finding,
  ReviewCandidate,
  DetectionResult,
} from './models/index.js'

// Detection — the main entry point for the CLI, MCP server, web app and Kiro hook (Req 13.1)
export { detectAll, detectSmell, DETECTORS } from './detectors/index.js'
export type { Detector, DetectorContext, DetectorOutput } from './detectors/index.js'

// Fixing — before/after proposals with a self-check (spec fixer)
export { proposeFix, proposeFixes, applyFix, exorciseSuite, caseToText, checkFix } from './fixers/index.js'
export type { FixProposal, FixOutcome, FixCheck } from './fixers/index.js'

// LLM reviewer — optional, decides the uncertain cases (spec llm-reviewer)
export { reviewWithLlm, memoryCache, createGeminiClient, LlmError, buildPrompt, parseVerdict, SMELL_DEFINITIONS } from './llm/index.js'
export type { ReviewOptions, ReviewedResult, GeminiOptions, LlmClient, LlmCache, LlmVerdict, LlmStats } from './llm/index.js'

// Importers — pasted text, CSV, table rows (Excel) and JSON (spec importers)
export { importSuite, importText, importCsv, importJson, importRows, ImportError } from './importers/index.js'
export type { ImportFormat, ImportResult } from './importers/index.js'

// Scoring — A–F grade for a suite (spec scorer)
export { scoreSuite, gradeFor } from './scorer/index.js'
export type { Grade, SuiteScore, CaseScore } from './scorer/index.js'

export { SMELLS, ALL_SMELL_NAMES } from './smells.js'
export type { SmellMeta } from './smells.js'

export { tag, splitClauses, isImperativeStart, findWords } from './text/index.js'
export type { Token, Span } from './text/index.js'

export {
  VERIFICATION_VERBS,
  SUBORDINATING_CONJUNCTIONS,
  SUBORDINATING_CONJUNCTION_PHRASES,
  NAVIGATION_VERBS,
  NAVIGATION_VERB_PHRASES,
  OUTCOME_WORDS,
  PREREQUISITE_WORDS,
  VAGUE_WORDS,
  INDEFINITE_DETERMINERS,
  INDEFINITE_PRONOUNS,
  MANNER_ADVERBS,
  MAKE_SURE_PHRASES,
} from './text/index.js'
