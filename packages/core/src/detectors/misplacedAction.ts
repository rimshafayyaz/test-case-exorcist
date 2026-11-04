/**
 * Misplaced Action detector — "Wanderer"
 *
 * Reports when an action is written in a verification (expected result),
 * e.g. verification "Click OK to continue." or
 * "Add the files to the folder as in the previous step."
 *
 * Detection (docs/smells.md §4):
 * - Each verification is split into clauses. A clause that starts with an
 *   imperative verb that is NOT a verification verb is an action.
 * - Verification verbs (VERIFICATION_VERBS) and "make sure"/"ensure that"
 *   starts are expected in verifications and are never reported (Req 6.2).
 * - Declarative guard: if the clause has its own main verb later
 *   ("Message appears.", "Save button is enabled."), the first word is a
 *   subject or modifier, not a command, so nothing is reported.
 * - Confidence:
 *     compromise tags the first word as a verb → finding;
 *     only COMMON_ACTION_VERBS matched (compromise saw a noun/adjective) and
 *       an object follows ("Select Urdu", "Close the dialog") → finding;
 *     otherwise ("Close button", "Check status") → review candidate.
 *
 * Field: verification (with verificationIndex). At most one finding per
 * verification entry; the span points to the verb inside that entry.
 * Confidence: rule · Severity: normal · Fix: ExtractAction
 *
 * Review candidates are dropped when the step already has a finding (Req 11.2).
 *
 * Requirements: 2.1, 2.2, 2.3, 6.1, 6.2, 11.1, 11.2
 */

import type { Finding, ReviewCandidate } from '../models/index.js'
import { SMELLS } from '../smells.js'
import {
  VERIFICATION_VERBS,
  MAKE_SURE_PHRASES,
  imperativeStartInfo,
  isDeclarativeClause,
} from '../text/index.js'
import type { ImperativeStart } from '../text/index.js'
import { segment } from './eagerAction.js'
import type { DetectorContext, DetectorOutput } from './types.js'

const META = SMELLS['MisplacedAction']

/** One-sentence reason naming the verb found (<= 25 words, Req 2.3). */
export function reasonFor(verb: string): string {
  return `"${verb.toLowerCase()}" is an action; move it from the expected result to the step actions.`
}

/** Tags that show an object directly follows the verb ("Select Urdu", "Close the dialog"). */
const OBJECT_START_TAGS = ['Determiner', 'ProperNoun', 'Pronoun', 'Possessive', 'Value', 'Acronym']

/** True when the clause starts with a verification verb or "make sure"/"ensure that". */
function startsWithVerification(clause: string, info: ImperativeStart): boolean {
  if (VERIFICATION_VERBS.includes(info.normal)) return true
  const rest = clause.slice(info.start).toLowerCase()
  return MAKE_SURE_PHRASES.some(p => rest.startsWith(p))
}

type Verdict = { type: 'finding' | 'review'; start: number; end: number; word: string } | null

/** Classify one clause. Offsets are relative to the clause. */
function classifyClause(clause: string): Verdict {
  const info = imperativeStartInfo(clause)
  if (!info) return null
  if (startsWithVerification(clause, info)) return null
  if (isDeclarativeClause(info)) return null

  if (info.via === 'pos') return { type: 'finding', start: info.start, end: info.end, word: info.word }

  const next = info.tokens[info.index + 1]
  const objectFollows = next !== undefined && OBJECT_START_TAGS.some(tag => next.tags.includes(tag))
  return { type: objectFollows ? 'finding' : 'review', start: info.start, end: info.end, word: info.word }
}

/** Shell commands that make a verification an action when it starts with one. */
const SHELL_COMMAND = /^\s*(?:sudo\s+)?(?:cat|ls|grep|mount|umount|df|dmesg|lsblk|mdadm|dmsetup|apt|apt-get|dpkg|dpkg-reconfigure|systemctl|service|netstat|telnet|ssh|ping|ifconfig|route|dig|curl|wget|mkdir|rm|cp|mv|echo|touch|tail|head|uname|lsb_release|modprobe|lsmod|blkid|fdisk|parted|mutt)\b(?:\s+\S+)?/

/** True when the clause is a command line: a known shell command typed in lower case. */
function isCommandLine(clause: string): boolean {
  return /^\s*[a-z]/.test(clause) && SHELL_COMMAND.test(clause)
}

/**
 * A clause after "and"/"or"/"then" inside a sentence that is a statement
 * ("Apt hits each mirror and update all of them") shares that sentence's
 * subject, so it is not a separate command. Only check it when the sentence
 * itself started with a command.
 */
function continuation(clause: string, sentenceIsCommand: boolean): Verdict {
  return sentenceIsCommand ? classifyClause(clause) : null
}

function makeFinding({ testCase, step }: DetectorContext, i: number, start: number, end: number, word: string): Finding {
  return {
    caseId: testCase.id,
    stepIndex: step.index,
    field: 'verification',
    verificationIndex: i,
    span: { start, end },
    smellName: META.smellName,
    ghostName: META.ghostName,
    reason: reasonFor(word),
    confidence: 'rule',
    fixName: META.fixName,
    severity: 'normal',
  }
}

export const misplacedAction = (ctx: DetectorContext): DetectorOutput => {
  const { testCase, step } = ctx
  const findings: Finding[] = []
  const reviewCandidates: ReviewCandidate[] = []

  step.verifications.forEach((text, i) => {
    if (!text || text.trim() === '') return

    let review: ReviewCandidate | null = null
    const segs = segment(text)
    let sentenceIsCommand = false

    for (const seg of segs) {
      const startsSentence = seg.sep === '' || seg.sep === 'sentence' || seg.sep === ';'
      // ", then click OK" arrives as a comma segment starting with "then".
      const clause = seg.text.replace(/^then\s+/i, '')
      const base = seg.start + (seg.text.length - clause.length)

      // A shell command line is an action ("sudo cat /proc/mdstat").
      if (startsSentence && isCommandLine(clause)) {
        const word = clause.split(/\s+/)[0]!
        findings.push(makeFinding(ctx, i, base, base + word.length, word))
        review = null
        return
      }

      const verdict: Verdict = startsSentence || seg.text !== clause || seg.sep === ',' ? classifyClause(clause) : continuation(clause, sentenceIsCommand)
      if (startsSentence) sentenceIsCommand = verdict !== null
      if (!verdict) continue
      // A lone word ("Name, username and password are accepted") or a label
      // followed by ":" ("Return: Prompt=normal") is not a command.
      if (clause.trim().split(/\s+/).length === 1 && segs.length > 1) continue
      if (/^\s*:/.test(clause.slice(verdict.end))) continue


      if (verdict.type === 'finding') {
        findings.push(makeFinding(ctx, i, base + verdict.start, base + verdict.end, verdict.word))
        review = null
        return // one finding per verification entry
      }

      review ??= {
        caseId: testCase.id,
        stepIndex: step.index,
        smellName: META.smellName,
        field: 'verification',
        verificationIndex: i,
        hint: `verification[${i}] starts with "${verdict.word}", which may be a noun or an action; review needed.`,
      }
    }

    if (review) reviewCandidates.push(review)
  })

  // Req 11.2: a confident finding for this step and smell makes review candidates redundant.
  return { findings, reviewCandidates: findings.length > 0 ? [] : reviewCandidates }
}
