import { ALL_SMELL_NAMES, SMELLS } from '@exorcist/core'
import type { SmellName, SuiteScore } from '@exorcist/core'
import { SMELL_STYLE } from '../smellStyle'

const GRADE_TEXT = {
  A: 'Barely haunted',
  B: 'A few restless spirits',
  C: 'Noticeably haunted',
  D: 'Badly haunted',
  F: 'Full haunted house',
} as const

export function ScorePanel({
  score,
  uncertain,
  filter,
  onFilter,
}: {
  score: SuiteScore
  uncertain: number
  filter: SmellName | null
  onFilter: (smell: SmellName | null) => void
}) {
  return (
    <section className="panel score-panel" aria-label="Suite score">
      <div className={`grade grade-${score.grade}`} aria-label={`Grade ${score.grade}`}>
        {score.grade}
      </div>
      <div className="score-text">
        <div className="score-number">
          {score.score}
          <small>/100</small>
        </div>
        <div>{GRADE_TEXT[score.grade]}</div>
        <div className="muted">
          {score.cleanSteps} of {score.totalSteps} steps ghost-free · {score.findingCount} ghost
          {score.findingCount === 1 ? '' : 's'}
          {uncertain > 0 && ` · ${uncertain} uncertain`}
        </div>
      </div>
      <div className="smell-chips" role="group" aria-label="Filter by smell">
        {ALL_SMELL_NAMES.map(name => {
          const count = score.perSmell[name] ?? 0
          const style = SMELL_STYLE[name]
          return (
            <button
              key={name}
              type="button"
              className={`smell-chip${filter === name ? ' active' : ''}${count === 0 ? ' zero' : ''}`}
              style={{ ['--ghost' as string]: style.color }}
              onClick={() => onFilter(filter === name ? null : name)}
              aria-pressed={filter === name}
              title={`${SMELLS[name].ghostName} — fix: ${SMELLS[name].fixLabel}`}
            >
              <span aria-hidden>{style.emoji}</span> {style.label} <b>{count}</b>
            </button>
          )
        })}
      </div>
    </section>
  )
}
