/**
 * Canonical word lists for smell detection.
 *
 * Each list maps to one keyword ownership group from docs/smells.md.
 * No word may appear in more than one list — ownership is exclusive.
 *
 * Change docs/smells.md first, then update this file.
 */

/**
 * Owned by: Misplaced Verification (in actions).
 * Also used as the exclusion list for Misplaced Action.
 */
export const VERIFICATION_VERBS: readonly string[] = [
  'verify',
  'check',
  'confirm',
  'ensure',
  'assert',
  'validate',
  'observe',
  'see',
] as const

/**
 * Owned by: Conditional Test.
 * Single-word subordinating conjunctions.
 * Multi-word phrases ("in case", "depending on") are handled separately.
 */
export const SUBORDINATING_CONJUNCTIONS: readonly string[] = [
  'if',
  'whether',
  'unless',
  'otherwise',
] as const

/**
 * Multi-word subordinating conjunction phrases owned by Conditional Test.
 * Matched as whole sub-strings (case-insensitive).
 */
export const SUBORDINATING_CONJUNCTION_PHRASES: readonly string[] = [
  'in case',
  'depending on',
] as const

/**
 * Owned by: Unverified Action (low-severity exception only).
 * Single-word navigation verbs.
 */
export const NAVIGATION_VERBS: readonly string[] = [
  'open',
  'launch',
  'start',
] as const

/**
 * Multi-word navigation verb phrases owned by Unverified Action.
 * "go to", "navigate to", "switch to", "return to", "scroll to" need phrase matching.
 */
export const NAVIGATION_VERB_PHRASES: readonly string[] = [
  'go to',
  'navigate to',
  'switch to',
  'return to',
  'scroll to',
] as const

/**
 * Owned by: Misplaced Verification (outcome wording detection).
 */
export const OUTCOME_WORDS: readonly string[] = [
  'should',
  'must be displayed',
] as const

/**
 * Owned by: Misplaced Precondition.
 */
export const PREREQUISITE_WORDS: readonly string[] = [
  'prerequisite',
  'beforehand',
  'already',
  'before proceeding',
] as const

/**
 * Vague words owned by: Ambiguous Test.
 * These trigger confident findings (word-list hits, not POS-only).
 */
export const VAGUE_WORDS: readonly string[] = [
  'similar',
  'better',
  'clear',
  'easy',
  'fast',
  'works',
  'normal',
  'appropriate',
  // From the 2026 Gemini 3 study's smell rules (subjective words and phrases)
  'reasonable',
  'approximately',
  'as expected',
  'user-friendly',
  'as you like',
] as const

/**
 * Indefinite determiners that make a step ambiguous.
 * Owned by: Ambiguous Test.
 * Used alongside "any", "some" which are also indefinite determiners.
 */
export const INDEFINITE_DETERMINERS: readonly string[] = [
  'any',
  'some',
  'either',
  'several',
  'various',
  'a few',
] as const

/**
 * Indefinite pronouns that make a step ambiguous.
 * Owned by: Ambiguous Test.
 */
export const INDEFINITE_PRONOUNS: readonly string[] = [
  'something',
  'anything',
  'anyone',
  'someone',
  'somebody',
  'anybody',
  'everything',
  'nothing',
] as const

/**
 * Manner adverbs (adverbs ending in -ly that describe how an action is performed).
 * Owned by: Ambiguous Test.
 * Compromise tags all adverbs as "Adverb"; we use this list to narrow to manner adverbs.
 */
export const MANNER_ADVERBS: readonly string[] = [
  'properly',
  'correctly',
  'quickly',
  'easily',
  'effectively',
  'efficiently',
  'successfully',
  'appropriately',
  'smoothly',
  'normally',
  'adequately',
  'randomly',
  'briefly',
] as const

/**
 * Tie-break phrases: in the first step with a state description → Misplaced Precondition.
 * In any other step, or without a state description → Misplaced Verification.
 * These belong to NEITHER word list exclusively; the detectors implement the tie-break logic.
 */
export const MAKE_SURE_PHRASES: readonly string[] = [
  'make sure',
  'ensure that',
] as const

/**
 * Common action verbs used as a fallback for imperative detection only.
 *
 * This list is NOT a smell keyword list and is NOT subject to keyword ownership rules.
 * It exists solely to work around compromise mis-tagging well-known test verbs as
 * Noun or Adjective (e.g. "Close" → Adjective, "Check" → Noun).
 *
 * Detectors MUST NOT use this list to classify smells. It is only consumed by
 * `isImperativeStart()` in text/utils.ts.
 */
// Only single words: isImperativeStart() compares the first word of a clause,
// so "log in" / "sign in" are covered by "log" / "sign".
export const COMMON_ACTION_VERBS: readonly string[] = [
  'click',
  'tap',
  'press',
  'select',
  'choose',
  'type',
  'enter',
  'close',
  'open',
  'check',
  'uncheck',
  'save',
  'submit',
  'delete',
  'remove',
  'add',
  'drag',
  'scroll',
  'switch',
  'reopen',
  'restart',
  'log',
  'sign',
  'upload',
  'download',
  'wait',
  'reset',
  'set',
  'refresh',
  'reload',
  'copy',
  'paste',
  'install',
  'connect',
  'disconnect',
  'insert',
  'plug',
  'unplug',
  'toggle',
  'enable',
  'disable',
  'right-click',
  'double-click',
  'left-click',
] as const
