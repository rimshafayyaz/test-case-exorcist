/**
 * Text analysis utilities — public re-export for @exorcist/core text layer.
 */
export { tag, splitClauses, isImperativeStart, imperativeStartInfo, isDeclarativeClause, startsWithNonVerb, firstClauseWord, findWords, hasStateDescription } from './utils.js'
export type { Token, Span, ImperativeStart } from './utils.js'

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
  COMMON_ACTION_VERBS,
} from './wordLists.js'
