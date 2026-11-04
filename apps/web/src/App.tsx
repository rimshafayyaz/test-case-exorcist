import { useEffect, useMemo, useRef, useState } from 'react'
import { applyFix, detectAll, exorciseSuite, memoryCache, proposeFix, reviewWithLlm, scoreSuite } from '@exorcist/core'
import type { DetectionResult, Finding, FixOutcome, LlmClient, LlmStats, SmellName, TestSuite } from '@exorcist/core'
import { AiPanel } from './components/AiPanel'
import { CaseView } from './components/CaseView'
import { FixDialog } from './components/FixDialog'
import { InputPanel } from './components/InputPanel'
import type { Loaded } from './components/InputPanel'
import { ScorePanel } from './components/ScorePanel'
import { DEMO_SUITES } from './demo'

const START: Loaded = { suite: DEMO_SUITES.haunted.suite, warnings: [], source: DEMO_SUITES.haunted.label }

export function App() {
  const [loaded, setLoaded] = useState<Loaded>(START)
  const [suite, setSuite] = useState<TestSuite>(START.suite)
  const [history, setHistory] = useState<TestSuite[]>([])
  const [filter, setFilter] = useState<SmellName | null>(null)
  const [fix, setFix] = useState<FixOutcome | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // AI review state. Answers are cached, so after a fix the review is
  // replayed from the cache for free (steps that changed stay uncertain).
  const cache = useRef(memoryCache())
  const [aiModel, setAiModel] = useState<string | null>(null)
  const [ai, setAi] = useState<{ suite: TestSuite; result: DetectionResult } | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [stats, setStats] = useState<LlmStats | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const detection = useMemo(() => detectAll(suite), [suite])
  const result = ai && ai.suite === suite ? ai.result : detection
  const score = useMemo(() => scoreSuite(suite, result), [suite, result])

  useEffect(() => {
    if (!aiModel || busy || (ai && ai.suite === suite)) return
    let live = true
    const cacheOnly: LlmClient = { name: aiModel, complete: () => Promise.reject(new Error('not asked yet')) }
    void reviewWithLlm(suite, detection, cacheOnly, { cache: cache.current }).then(r => {
      if (live) setAi({ suite, result: r })
    })
    return () => {
      live = false
    }
  }, [suite, detection, aiModel, busy, ai])

  const change = (next: TestSuite, message: string | null) => {
    setHistory(h => [...h, suite])
    setSuite(next)
    setNotice(message)
  }

  const load = (l: Loaded) => {
    setLoaded(l)
    setSuite(l.suite)
    setHistory([])
    setFilter(null)
    setNotice(null)
    setStats(null)
    setAiError(null)
  }

  const runAi = async (client: LlmClient) => {
    setBusy(true)
    setAiError(null)
    setProgress(null)
    try {
      const r = await reviewWithLlm(suite, detection, client, {
        cache: cache.current,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      setAi({ suite, result: r })
      setAiModel(client.name)
      setStats(r.llm)
      const failures = r.errors.filter(e => e.message.startsWith('LLM reviewer:'))
      if (failures.length > 0) setAiError(failures[failures.length - 1]!.message.replace(/^LLM reviewer: /, ''))
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const openFix = (finding: Finding) => {
    const testCase = suite.cases.find(c => c.id === finding.caseId)
    if (testCase) setFix(proposeFix(testCase, finding))
  }

  const exorciseAll = () => {
    const { suite: next, applied } = exorciseSuite(suite)
    if (applied.length === 0) return setNotice('No rule-based fix left to apply. The remaining ghosts need a human (or the AI).')
    change(next, `Applied ${applied.length} rule-based fix${applied.length === 1 ? '' : 'es'}. Check the result, then fill in the TODO expected results.`)
  }

  const download = () => {
    const blob = new Blob([JSON.stringify(suite, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(suite.name || 'suite').replace(/[^\w.-]+/g, '-').toLowerCase()}-exorcised.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const visibleCases = suite.cases
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !filter || result.findings.some(f => f.caseId === c.id && f.smellName === filter))
  const detectorErrors = result.errors.filter(e => !e.message.startsWith('LLM reviewer:'))

  return (
    <div className="page">
      <header className="site-head">
        <h1>
          <span aria-hidden>👻</span> Test Case Exorcist
        </h1>
        <p>
          Finds the 7 known smells in manual test cases at the exact words, proposes self-checked fixes and grades the
          suite A–F.
        </p>
      </header>

      <div className="layout">
        <aside className="side">
          <InputPanel onLoad={load} />
          <AiPanel candidates={result.reviewCandidates.length} busy={busy} progress={progress} stats={stats} error={aiError} onRun={c => void runAi(c)} />
        </aside>

        <main className="main">
          <ScorePanel score={score} uncertain={score.uncertainSteps} filter={filter} onFilter={setFilter} />

          <div className="toolbar">
            <span className="muted small">
              {loaded.source} · {suite.cases.length} test case{suite.cases.length === 1 ? '' : 's'}
            </span>
            <span className="spacer" />
            <button type="button" onClick={exorciseAll} disabled={score.findingCount === 0}>
              ✨ Exorcise all (rule fixes)
            </button>
            <button
              type="button"
              disabled={history.length === 0}
              onClick={() => {
                setSuite(history[history.length - 1]!)
                setHistory(h => h.slice(0, -1))
                setNotice(null)
              }}
            >
              ↶ Undo
            </button>
            <button type="button" onClick={download}>
              ⬇ Download JSON
            </button>
          </div>

          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {loaded.warnings.length > 0 && suite === loaded.suite && (
            <details className="warnings">
              <summary>
                {loaded.warnings.length} import warning{loaded.warnings.length === 1 ? '' : 's'}
              </summary>
              <ul>
                {loaded.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
          {detectorErrors.length > 0 && (
            <p className="error">
              {detectorErrors.length} check{detectorErrors.length === 1 ? '' : 's'} failed and were skipped (first: {detectorErrors[0]!.message}).
            </p>
          )}

          {visibleCases.map(({ c, i }) => (
            <CaseView
              key={`${i}:${c.id}`}
              testCase={c}
              score={score.cases[i]}
              findings={result.findings.filter(f => f.caseId === c.id)}
              candidates={result.reviewCandidates.filter(r => r.caseId === c.id)}
              filter={filter}
              onFix={openFix}
            />
          ))}
          {visibleCases.length === 0 && <p className="muted">No test case has this ghost. 🎉</p>}
        </main>
      </div>

      <footer className="site-foot small muted">
        Smell definitions and the Ubuntu demo cases come from the 2026 study on natural-language test smells (data:
        Zenodo, doi 10.5281/zenodo.20549059, CC BY 4.0). Built for Kiroween 2026.
      </footer>

      {fix && (
        <FixDialog
          key={JSON.stringify(fix.ok ? [fix.proposal.caseId, fix.proposal.stepIndex, fix.proposal.fixName] : fix.reason)}
          outcome={fix}
          onAccept={() => {
            if (fix.ok) change(applyFix(suite, fix.proposal), `Applied: ${fix.proposal.summary}`)
          }}
          onClose={() => setFix(null)}
        />
      )}
    </div>
  )
}
