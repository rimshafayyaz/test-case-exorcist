import type { SmellName } from '@exorcist/core'

/** Colour, emoji and short label per smell, used everywhere in the UI. */
export const SMELL_STYLE: Record<SmellName, { color: string; emoji: string; label: string }> = {
  AmbiguousTest: { color: '#a78bfa', emoji: '🌫️', label: 'Ambiguous Test' },
  ConditionalTest: { color: '#f472b6', emoji: '🔀', label: 'Conditional Test' },
  EagerAction: { color: '#fb923c', emoji: '🐉', label: 'Eager Action' },
  MisplacedAction: { color: '#38bdf8', emoji: '🚶', label: 'Misplaced Action' },
  MisplacedPrecondition: { color: '#facc15', emoji: '🌅', label: 'Misplaced Precondition' },
  MisplacedVerification: { color: '#4ade80', emoji: '🎭', label: 'Misplaced Verification' },
  UnverifiedAction: { color: '#f87171', emoji: '🤫', label: 'Unverified Action' },
}
