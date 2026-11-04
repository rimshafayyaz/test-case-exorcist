import { useEffect, useRef } from 'react'
import { caseToText, SMELLS } from '@exorcist/core'
import type { FixOutcome, SmellName } from '@exorcist/core'
import { diffLines } from '../diff'
import { SMELL_STYLE } from '../smellStyle'

export function FixDialog({ outcome, onAccept, onClose }: { outcome: FixOutcome; onAccept: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const smell: SmellName = outcome.ok ? outcome.proposal.smellName : outcome.finding.smellName
  const style = SMELL_STYLE[smell]

  return (
    <dialog ref={ref} className="fix-dialog" onClose={onClose} aria-label="Fix proposal">
      <h2>
        <span aria-hidden>{style.emoji}</span> {SMELLS[smell].fixLabel}
        <small> — banishes the {SMELLS[smell].ghostName}</small>
      </h2>
      {outcome.ok ? (
        <Proposal outcome={outcome} />
      ) : (
        <p className="warn">
          No automatic fix for this one: {outcome.reason} Rewrite this step by hand.
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" onClick={() => ref.current?.close()}>
          {outcome.ok ? 'Cancel' : 'Close'}
        </button>
        {outcome.ok && (
          <button
            type="button"
            className="primary"
            onClick={() => {
              onAccept()
              ref.current?.close()
            }}
          >
            Accept fix
          </button>
        )}
      </div>
    </dialog>
  )
}

function Proposal({ outcome }: { outcome: Extract<FixOutcome, { ok: true }> }) {
  const p = outcome.proposal
  const introduced = Object.entries(p.check.introduced) as [SmellName, number][]
  const diff = diffLines(caseToText(p.before), p.after.map(caseToText).join('\n\n'))
  return (
    <>
      <p>{p.summary}</p>
      <div className="self-check">
        {p.check.resolved ? (
          <span className="badge ok">✓ Self-check: the detectors no longer see this ghost</span>
        ) : (
          <span className="badge warn">⚠ Self-check: the ghost is still there after this fix</span>
        )}
        {introduced.map(([name, n]) => (
          <span key={name} className="badge warn">
            +{n} {SMELL_STYLE[name].label}
          </span>
        ))}
      </div>
      {p.needsInput.length > 0 && (
        <div className="needs-input">
          <b>You still need to write:</b>
          <ul>
            {p.needsInput.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      <pre className="diff" aria-label="Before and after">
        {diff.map((line, i) => (
          <div key={i} className={`diff-${line.kind}`}>
            <span aria-hidden>{line.kind === 'added' ? '+ ' : line.kind === 'removed' ? '− ' : '  '}</span>
            {line.text}
          </div>
        ))}
      </pre>
    </>
  )
}
