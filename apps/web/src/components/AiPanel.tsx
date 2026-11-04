import { useState } from 'react'
import { createGeminiClient } from '@exorcist/core'
import type { LlmClient, LlmStats } from '@exorcist/core'
import { SAVED_MODEL, savedAnswersClient } from '../demo'

const KEY_STORAGE = 'exorcist.geminiKey'
const DEFAULT_MODEL = 'gemini-3.5-flash-lite'

function loadKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

function storeKey(key: string | null) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    // Private window or blocked storage: the key just isn't remembered.
  }
}

export function AiPanel({
  candidates,
  busy,
  progress,
  stats,
  error,
  onRun,
}: {
  candidates: number
  busy: boolean
  progress: { done: number; total: number } | null
  stats: LlmStats | null
  error: string | null
  onRun: (client: LlmClient) => void
}) {
  const [tab, setTab] = useState<'demo' | 'own'>('demo')
  const [key, setKey] = useState(loadKey)
  const [remember, setRemember] = useState(() => loadKey() !== '')
  const [model, setModel] = useState(DEFAULT_MODEL)

  const run = () => {
    if (tab === 'demo') return onRun(savedAnswersClient)
    storeKey(remember ? key.trim() : null)
    onRun(
      createGeminiClient({
        apiKey: key.trim(),
        model: model.trim() || DEFAULT_MODEL,
        minIntervalMs: 4500, // free tier: 15 requests a minute
        maxRetries: 2,
        fetchImpl: (input, init) => fetch(input, init),
      }),
    )
  }

  return (
    <section className="panel" aria-label="AI review">
      <h2 className="panel-title">🔮 AI second opinion</h2>
      <p className="muted small">
        The rules flag {candidates} uncertain step{candidates === 1 ? '' : 's'}. An AI model decides only those (one call
        each); in our benchmark this lifted F1 from 0.81 to 0.83.
      </p>
      <div className="tabs" role="tablist">
        <button role="tab" type="button" aria-selected={tab === 'demo'} onClick={() => setTab('demo')}>
          Demo (saved AI answers)
        </button>
        <button role="tab" type="button" aria-selected={tab === 'own'} onClick={() => setTab('own')}>
          Your own Gemini key
        </button>
      </div>
      {tab === 'demo' ? (
        <p className="tab-body small">
          Replays answers that {SAVED_MODEL} gave for the 🐧 Ubuntu demo suite. No key, no network. Other test cases
          have no saved answers, so their uncertain steps stay uncertain.
        </p>
      ) : (
        <div className="tab-body">
          <label className="field">
            <span>Gemini API key</span>
            <input
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="from aistudio.google.com"
            />
          </label>
          <label className="field">
            <span>Model</span>
            <input value={model} onChange={e => setModel(e.target.value)} spellCheck={false} />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => {
                setRemember(e.target.checked)
                if (!e.target.checked) storeKey(null)
              }}
            />
            Remember the key in this browser
          </label>
          <p className="muted small">
            Your key goes only from your browser to Google; this site has no server and never sees it. On Google's free
            tier, prompts may be used for training — send only public or made-up test cases.
          </p>
        </div>
      )}
      <div className="row">
        <button type="button" className="primary" disabled={busy || candidates === 0 || (tab === 'own' && key.trim() === '')} onClick={run}>
          {busy ? `Asking… ${progress ? `${progress.done}/${progress.total}` : ''}` : `Ask about ${candidates} uncertain step${candidates === 1 ? '' : 's'}`}
        </button>
      </div>
      {stats && (
        <p className="small" role="status">
          AI review: {stats.confirmed} confirmed, {stats.rejected} rejected, {stats.failed} without an answer
          {stats.cached > 0 && ` (${stats.cached} from cache)`}.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
