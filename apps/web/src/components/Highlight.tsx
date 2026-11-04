import type { Finding } from '@exorcist/core'
import { SMELL_STYLE } from '../smellStyle'

/**
 * Text with the exact words of each finding underlined in its smell colour.
 * Overlapping spans are split into segments; a segment shows the colour of
 * the first finding that covers it, and its tooltip lists all of them.
 */
export function Highlight({ text, findings }: { text: string; findings: Finding[] }) {
  const spans = findings.filter(f => f.span && f.span.end > f.span.start && f.span.end <= text.length)
  if (spans.length === 0) return <>{text}</>
  const points = new Set<number>([0, text.length])
  for (const f of spans) {
    points.add(f.span!.start)
    points.add(f.span!.end)
  }
  const cuts = [...points].sort((a, b) => a - b)
  const parts = []
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i]!
    const end = cuts[i + 1]!
    const piece = text.slice(start, end)
    const covering = spans.filter(f => f.span!.start <= start && f.span!.end >= end)
    if (covering.length === 0) {
      parts.push(<span key={start}>{piece}</span>)
      continue
    }
    const style = SMELL_STYLE[covering[0]!.smellName]
    parts.push(
      <mark
        key={start}
        className="ghost-mark"
        style={{ ['--ghost' as string]: style.color }}
        title={covering.map(f => `${SMELL_STYLE[f.smellName].emoji} ${f.ghostName}: ${f.reason}`).join('\n')}
      >
        {piece}
      </mark>,
    )
  }
  return <>{parts}</>
}
