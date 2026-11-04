/**
 * Smell constants — single source of truth for ghost names and fix names.
 * Values mirror docs/smells.md exactly. Change docs/smells.md first,
 * then update this file.
 */

import type { SmellName, FixName } from './models/index.js'

export interface SmellMeta {
  smellName: SmellName
  /** Human-readable ghost persona from docs/smells.md */
  ghostName: string
  /** Human-readable transformation name from docs/smells.md */
  fixLabel: string
  /** Typed fix name used in Finding.fixName */
  fixName: FixName
}

export const SMELLS: Record<SmellName, SmellMeta> = {
  AmbiguousTest: {
    smellName: 'AmbiguousTest',
    ghostName: 'Fog Wraith',
    fixLabel: 'Extract Ambiguity',
    fixName: 'ExtractAmbiguity',
  },
  ConditionalTest: {
    smellName: 'ConditionalTest',
    ghostName: 'Fork Spirit',
    fixLabel: 'Extract Conditional',
    fixName: 'ExtractConditional',
  },
  EagerAction: {
    smellName: 'EagerAction',
    ghostName: 'Hydra',
    fixLabel: 'Separate Actions',
    fixName: 'SeparateActions',
  },
  MisplacedAction: {
    smellName: 'MisplacedAction',
    ghostName: 'Wanderer',
    fixLabel: 'Extract Action',
    fixName: 'ExtractAction',
  },
  MisplacedPrecondition: {
    smellName: 'MisplacedPrecondition',
    ghostName: 'Early Riser',
    fixLabel: 'Extract Precondition',
    fixName: 'ExtractPrecondition',
  },
  MisplacedVerification: {
    smellName: 'MisplacedVerification',
    ghostName: 'Mixed Soul',
    fixLabel: 'Extract Verification',
    fixName: 'ExtractVerification',
  },
  UnverifiedAction: {
    smellName: 'UnverifiedAction',
    ghostName: 'Silent Ghost',
    fixLabel: 'Fill Verification',
    fixName: 'FillVerification',
  },
} as const

/** All 7 smell names, in the order they appear in docs/smells.md. */
export const ALL_SMELL_NAMES: SmellName[] = Object.keys(SMELLS) as SmellName[]
