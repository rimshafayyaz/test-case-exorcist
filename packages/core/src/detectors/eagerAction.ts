/**
 * Eager Action detector — "Hydra"
 *
 * Reports when one action step bundles several actions, e.g.
 * "Open settings, change language and save." (3 actions) or
 * "Close flip and reopen the app." (2 actions).
 *
 * Detection (docs/smells.md §3):
 * - The action is split into segments on sentence ends, semicolons, commas,
 *   "and", "then" and "or" (the separator before each segment is kept).
 * - A segment counts as an action when it starts with an imperative verb and
 *   is not a statement ("Close button is disabled").
 * - Not counted:
 *     · segments after "or" — alternatives, not extra actions ("Click OK or press Enter");
 *     · UI labels in a list — a single capitalised word or a quoted label after
 *       the first segment ("Click OK, Cancel or Close.");
 *     · a compound gesture joined by "and" — one action ("Press and hold", "Drag and drop");
 *     · segments starting with a verification verb or "make sure"/"ensure that"
 *       (owned by Misplaced Verification, keyword ownership table).
 * - Confidence:
 *     ≥ 2 confident actions → finding ("pos" verbs, or list verbs followed by an object);
 *     ≥ 2 actions but fewer than 2 confident ones ("Switch position and click OK")
 *       → review candidate.
 *
 * Field: action. One finding per step. The span starts at the second action's
 * verb (where the extra action begins) and runs to the end of the last action.
 * Confidence: rule · Severity: normal · Fix: SeparateActions
 *
 * Requirements: 2.2, 2.3, 5.1, 5.2, 10.2, 11.1, 11.2
 */

import type { Finding, ReviewCandidate } from '../models/index.js'
import { SMELLS } from '../smells.js'
import {
  VERIFICATION_VERBS,
  MAKE_SURE_PHRASES,
  imperativeStartInfo,
  startsWithNonVerb,
  firstClauseWord,
  isDeclarativeClause,
} from '../text/index.js'
import { isStateClause } from './misplacedPrecondition.js'
import type { DetectorContext, DetectorOutput } from './types.js'

const META = SMELLS['EagerAction']

/** Verbs listed in the reason before it is shortened with "…". */
const MAX_VERBS_IN_REASON = 5

/** One-sentence reason with the number of actions (Req 5.2, <= 25 words, Req 2.3). */
export function reasonFor(verbs: string[]): string {
  const shown = verbs.slice(0, MAX_VERBS_IN_REASON).map(v => v.toLowerCase())
  const list = shown.join(', ') + (verbs.length > MAX_VERBS_IN_REASON ? ', …' : '')
  return `This step has ${verbs.length} actions (${list}); split it into one step per action.`
}

/** Tags that show an object directly follows the verb ("Select Urdu", "Close the dialog"). */
const OBJECT_START_TAGS = ['Determiner', 'ProperNoun', 'Pronoun', 'Possessive', 'Value', 'Acronym', 'Noun']

interface Segment {
  text: string
  start: number
  end: number
  /** Separator before this segment: '' for the first one. */
  sep: '' | 'sentence' | ';' | ',' | 'and' | 'then' | 'or'
}

const SEPARATOR = /([.!?](?=\s|$)|;|,)\s*|\s+(and|then|or)\s+/gi

/** Split the action into segments with character offsets and their leading separator. */
export function segment(text: string): Segment[] {
  const segments: Segment[] = []
  let last = 0
  let sep: Segment['sep'] = ''
  const push = (end: number) => {
    const raw = text.slice(last, end)
    const lead = raw.length - raw.trimStart().length
    const trimmed = raw.trim()
    if (trimmed !== '') segments.push({ text: trimmed, start: last + lead, end: last + lead + trimmed.length, sep })
  }
  for (const m of text.matchAll(SEPARATOR)) {
    push(m.index!)
    const p = m[1]
    sep = p
      ? p === ';' || p === ','
        ? p
        : 'sentence'
      : (m[2]!.toLowerCase() as 'and' | 'then' | 'or')
    last = m.index! + m[0].length
  }
  push(text.length)
  return segments
}

/** True for a UI label in a list: one capitalised word ("Cancel") or a quoted label. */
function isListLabel(seg: Segment): boolean {
  const t = seg.text.replace(/[.!?]+$/, '')
  if (/^["'“‘].*["'”’]$/.test(t)) return true
  return /^[A-Z][\w-]*$/.test(t)
}

/** Two verbs joined by "and" that describe one gesture. */
const COMPOUND_GESTURES = new Set([
  'press hold', 'tap hold', 'click hold', 'touch hold',
  'drag drop', 'click drag', 'copy paste', 'cut paste',
])

/** True when `seg` is the first verb of a compound gesture continued by `following`. */
function isCompoundStart(seg: Segment, following: Segment | undefined): boolean {
  return following?.sep === 'and' && COMPOUND_GESTURES.has(`${seg.text} ${firstWord(following.text)}`.toLowerCase())
}

function firstWord(text: string): string {
  return text.split(/\s+/)[0]!.replace(/[^\w-]/g, '')
}

export interface Action {
  verb: string
  start: number
  end: number
  confident: boolean
  /** A check ("verify …") rather than a plain action. */
  isCheck: boolean
}

/**
 * Checks that need no tagging. A segment that fails one can never be an
 * action, so the step is skipped without calling the tagger when fewer than
 * two segments pass (most steps).
 */
function mayBeAction(seg: Segment, index: number, following: Segment | undefined): boolean {
  if (index > 0 && seg.sep === 'or') return false
  if (isCompoundStart(seg, following)) return false
  if (index > 0 && (seg.sep === ',' || seg.sep === 'and') && isListLabel(seg)) return false
  if (startsWithNonVerb(seg.text)) return false
  // An opening "make sure"/"ensure" + setup state is a precondition, not an action.
  if (index === 0 && isStateClause(seg.text, true)) return false
  return true
}

function actionIn(seg: Segment, index: number, following: Segment | undefined): Action | null {
  // mayBeAction() already rejects alternatives, compound gestures, list labels,
  // non-verb starts, check words and "make sure"; only tagged checks follow.
  if (!mayBeAction(seg, index, following)) return null

  const info = imperativeStartInfo(seg.text)
  if (!info) return null
  if (isDeclarativeClause(info)) return null
  // A check ("verify …", "make sure …") is an operation too: a step that does
  // something AND checks something bundles two operations (Eager Action) as
  // well as a misplaced check (Misplaced Verification), as in the 2026 study.
  const rest = seg.text.slice(info.start).toLowerCase()
  const isCheck = VERIFICATION_VERBS.includes(info.normal) || MAKE_SURE_PHRASES.some(p => rest.startsWith(p))

  const next = info.tokens[info.index + 1]
  const quotedLabel = /^\s*["'“‘]/.test(seg.text.slice(info.end))
  const objectFollows = quotedLabel || (next !== undefined && OBJECT_START_TAGS.some(tag => next.tags.includes(tag)))
  // A lone verb at the end ("… and save.") is still a clear action.
  const loneVerb = next === undefined
  return {
    verb: info.word,
    start: seg.start + info.start,
    end: seg.end,
    confident: isCheck || info.via === 'pos' || objectFollows || loneVerb,
    isCheck,
  }
}

/**
 * The actions counted in an action text, in order (verb and offsets).
 * Returns fewer than 2 entries when the step is not an Eager Action.
 * Also used by the Separate Actions fixer to split the step.
 */
export function findActions(text: string): Action[] {
  const segments = segment(text)
  // One segment can hold at most one action; skip tagging it.
  if (segments.length < 2) return []
  if (segments.filter((seg, i) => mayBeAction(seg, i, segments[i + 1])).length < 2) return []
  const actions = segments
    .map((seg, i) => {
      const action = actionIn(seg, i, segments[i + 1])
      // A compound gesture ("press and hold") starts at its first verb, so the
      // fixer cuts before "press", not between "press" and "hold".
      const prev = segments[i - 1]
      if (action && prev && isCompoundStart(prev, seg)) {
        return { ...action, verb: `${prev.text} and ${action.verb}`, start: prev.start }
      }
      return action
    })
    .filter((a): a is Action => a !== null)
  // Checks alone ("Verify X and check Y") are one misplaced check, not bundled actions.
  return actions.some(a => !a.isCheck) ? actions : []
}

export const eagerAction = (ctx: DetectorContext): DetectorOutput => {
  const { testCase, step } = ctx
  const text = step.action ?? ''
  if (text.trim() === '') return { findings: [], reviewCandidates: [] }

  const actions = findActions(text)

  if (actions.length < 2) return { findings: [], reviewCandidates: [] }

  const verbs = actions.map(a => a.verb)
  const confident = actions.filter(a => a.confident).length

  if (confident >= 2) {
    const end = actions[actions.length - 1]!.end
    const finding: Finding = {
      caseId: testCase.id,
      stepIndex: step.index,
      field: 'action',
      span: { start: actions[1]!.start, end: end - (/[.!?]$/.test(text.slice(0, end)) ? 1 : 0) },
      smellName: META.smellName,
      ghostName: META.ghostName,
      reason: reasonFor(verbs),
      confidence: 'rule',
      fixName: META.fixName,
      severity: 'normal',
    }
    return { findings: [finding], reviewCandidates: [] }
  }

  const review: ReviewCandidate = {
    caseId: testCase.id,
    stepIndex: step.index,
    smellName: META.smellName,
    field: 'action',
    hint: `Possibly ${actions.length} actions (${verbs.map(v => v.toLowerCase()).join(', ')}), but some words may be nouns; review needed.`,
  }
  return { findings: [], reviewCandidates: [review] }
}
