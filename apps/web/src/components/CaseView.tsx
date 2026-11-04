import type { CaseScore, Finding, ReviewCandidate, SmellName, TestCase } from '@exorcist/core'
import { SMELL_STYLE } from '../smellStyle'
import { Highlight } from './Highlight'

const CONFIDENCE_LABEL = { rule: 'rule', hybrid: 'rule + AI', llm: 'AI' } as const

export function CaseView({
  testCase,
  score,
  findings,
  candidates,
  filter,
  onFix,
}: {
  testCase: TestCase
  score: CaseScore | undefined
  findings: Finding[]
  candidates: ReviewCandidate[]
  filter: SmellName | null
  onFix: (finding: Finding) => void
}) {
  const shown = filter ? findings.filter(f => f.smellName === filter) : findings
  const preconditionFindings = shown.filter(f => f.field === 'precondition')
  return (
    <article className="panel case" aria-label={`Test case ${testCase.title}`}>
      <header className="case-head">
        <h3>{testCase.title}</h3>
        {score && (
          <span className={`case-grade grade-${score.grade}`} title={`Score ${score.score}/100`}>
            {score.grade} · {score.score}
          </span>
        )}
      </header>
      {testCase.preconditions.length > 0 && (
        <div className="preconditions">
          <span className="label">Preconditions</span>
          <ul>
            {testCase.preconditions.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          <Chips findings={preconditionFindings} onFix={onFix} />
        </div>
      )}
      <ol className="steps">
        {testCase.steps.map(step => {
          const stepFindings = shown.filter(f => f.stepIndex === step.index && f.field !== 'precondition')
          const stepCandidates = candidates.filter(
            c => c.stepIndex === step.index && (!filter || c.smellName === filter) && !stepFindings.some(f => f.smellName === c.smellName),
          )
          const missingCheck = stepFindings.some(f => f.smellName === 'UnverifiedAction')
          const haunted = stepFindings.length > 0
          return (
            <li key={step.index} className={`step${haunted ? ' haunted' : ''}`}>
              <div className="step-action">
                <Highlight text={step.action} findings={stepFindings.filter(f => f.field === 'action')} />
              </div>
              {step.verifications.length > 0 ? (
                <ul className="verifications">
                  {step.verifications.map((v, i) => (
                    <li key={i}>
                      <span aria-hidden>✓ </span>
                      <Highlight
                        text={v}
                        findings={stepFindings.filter(f => f.field === 'verification' && (f.verificationIndex ?? 0) === i)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={`no-check${missingCheck ? ' haunted' : ''}`}>no expected result</div>
              )}
              <Chips findings={stepFindings} onFix={onFix} />
              {stepCandidates.length > 0 && (
                <div className="candidates">
                  {stepCandidates.map((c, i) => (
                    <span key={i} className="candidate" title={c.hint}>
                      ❔ maybe {SMELL_STYLE[c.smellName].label}: {c.hint}
                    </span>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </article>
  )
}

function Chips({ findings, onFix }: { findings: Finding[]; onFix: (f: Finding) => void }) {
  if (findings.length === 0) return null
  return (
    <div className="chips">
      {findings.map((f, i) => {
        const style = SMELL_STYLE[f.smellName]
        return (
          <div key={i} className={`chip${f.severity === 'low' ? ' low' : ''}`} style={{ ['--ghost' as string]: style.color }}>
            <span className="chip-name">
              <span aria-hidden>{style.emoji}</span> {f.ghostName} <small>({style.label})</small>
            </span>
            <span className="chip-reason">{f.reason}</span>
            <span className="chip-meta">
              <span className="badge">{CONFIDENCE_LABEL[f.confidence]}</span>
              {f.severity === 'low' && <span className="badge">low</span>}
              <button type="button" className="small" onClick={() => onFix(f)}>
                Exorcise…
              </button>
            </span>
          </div>
        )
      })}
    </div>
  )
}
