import { useState } from 'react'
import { importRows, importSuite, ImportError } from '@exorcist/core'
import type { ImportResult } from '@exorcist/core'
import { DEMO_SUITES } from '../demo'

type Format = 'text' | 'csv' | 'json'

const FORMATS: Record<Format, { label: string; accept: string; example: string }> = {
  text: {
    label: 'Pasted text (numbered steps)',
    accept: '.txt,.md,text/plain',
    example: [
      'Test case: Freeze a debit card',
      'Preconditions:',
      '- The customer is logged in.',
      '1. Open the Cards screen and select the debit card.',
      '   Expected: The card details are displayed.',
      '2. If the card is active, tap Freeze card.',
      '3. Transfer a reasonable amount to a saved payee.',
    ].join('\n'),
  },
  csv: {
    label: 'CSV or Excel table',
    accept: '.csv,.tsv,.xlsx,text/csv',
    example: [
      'Test Case ID,Title,Step,Action,Expected Result',
      'PAY-1,Pay a bill,1,Open the Bill Pay screen.,The list of billers is displayed.',
      'PAY-1,Pay a bill,2,Select the biller and enter the amount.,The amount is shown.',
      'PAY-1,Pay a bill,3,Tap Pay now.,',
    ].join('\n'),
  },
  json: {
    label: 'JSON',
    accept: '.json,application/json',
    example: JSON.stringify(
      [{ title: 'Add money to the wallet', preconditions: ['The customer is logged in.'], steps: [{ action: 'Open the Wallet screen.', expected: 'The wallet balance is displayed.' }, { action: 'Enter some amount and tap Add money.', expected: 'The balance increases.' }, 'Open the Transactions screen.'] }],
      null,
      2,
    ),
  },
}

export type Loaded = ImportResult & { source: string }

export function InputPanel({ onLoad }: { onLoad: (loaded: Loaded) => void }) {
  const [tab, setTab] = useState<'demo' | 'own'>('demo')
  const [demo, setDemo] = useState<keyof typeof DEMO_SUITES>('haunted')
  const [format, setFormat] = useState<Format>('text')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const run = (f: () => ImportResult, source: string) => {
    try {
      setError(null)
      onLoad({ ...f(), source })
    } catch (err) {
      setError(err instanceof ImportError || err instanceof Error ? err.message : String(err))
    }
  }

  const onFile = async (file: File) => {
    setError(null)
    if (/\.xlsx$/i.test(file.name)) {
      try {
        // Loaded only when someone opens an Excel file.
        const { readSheet } = await import('read-excel-file/browser')
        const data = await readSheet(file)
        const rows = data.map(row => row.map(cell => (cell === null || cell === undefined ? '' : String(cell))))
        run(() => importRows(rows, { name: file.name }), file.name)
      } catch (err) {
        setError(`Could not read this Excel file: ${err instanceof Error ? err.message : String(err)}`)
      }
      return
    }
    const content = await file.text()
    setText(content)
    run(() => importSuite(format, content, { name: file.name }), file.name)
  }

  return (
    <section className="panel" aria-label="Test cases to check">
      <div className="tabs" role="tablist">
        <button role="tab" type="button" aria-selected={tab === 'demo'} onClick={() => setTab('demo')}>
          Demo suites
        </button>
        <button role="tab" type="button" aria-selected={tab === 'own'} onClick={() => setTab('own')}>
          Your test cases
        </button>
      </div>

      {tab === 'demo' ? (
        <div className="tab-body">
          <label className="field">
            <span>Suite</span>
            <select value={demo} onChange={e => setDemo(e.target.value as keyof typeof DEMO_SUITES)}>
              {Object.entries(DEMO_SUITES).map(([key, d]) => (
                <option key={key} value={key}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="primary" onClick={() => run(() => ({ suite: DEMO_SUITES[demo].suite, warnings: [] }), DEMO_SUITES[demo].label)}>
            👻 Summon the ghosts
          </button>
        </div>
      ) : (
        <div className="tab-body">
          <label className="field">
            <span>Format</span>
            <select
              value={format}
              onChange={e => {
                setFormat(e.target.value as Format)
                setError(null)
              }}
            >
              {Object.entries(FORMATS).map(([key, f]) => (
                <option key={key} value={key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={FORMATS[format].example}
            spellCheck={false}
            aria-label="Test cases"
            rows={9}
          />
          <div className="row">
            <button type="button" className="primary" disabled={text.trim() === ''} onClick={() => run(() => importSuite(format, text), 'Your test cases')}>
              👻 Find the ghosts
            </button>
            <label className="file-button">
              Open a file…
              <input
                type="file"
                accept={format === 'csv' ? FORMATS.csv.accept : FORMATS[format].accept}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) void onFile(file)
                  e.target.value = ''
                }}
              />
            </label>
            <button type="button" className="link" onClick={() => setText(FORMATS[format].example)}>
              Use the example
            </button>
          </div>
          <p className="muted small">
            Everything runs in your browser; your test cases are not uploaded. Use public or made-up test cases if you
            switch on your own AI key below.
          </p>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
