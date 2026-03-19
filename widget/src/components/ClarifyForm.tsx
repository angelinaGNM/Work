import { useState } from 'react'

interface StreamOption  { label: string; value: string }
interface DurationPreset { label: string; value: string }

interface ClarifyPayload {
  original_query: string
  missing: string[]
  stream?:   { question: string; options: StreamOption[] }
  duration?: { question: string; hint?: string; presets: DurationPreset[]; allow_custom: boolean }
  limit?:    { question: string; options: string[]; default: string; requested?: number }
}

interface Props {
  content: string
  onSubmit: (query: string) => void
}

export function ClarifyForm({ content, onSubmit }: Props) {
  const payload: ClarifyPayload = JSON.parse(content)

  const [stream,        setStream]        = useState('')
  const [durationMode,  setDurationMode]  = useState<'preset' | 'custom'>('preset')
  const [preset,        setPreset]        = useState('')
  const [fromDate,      setFromDate]      = useState('')
  const [toDate,        setToDate]        = useState('')
  const [limit,         setLimit]         = useState(payload.limit?.default ?? '20')

  const streamOk   = !payload.missing.includes('stream')   || stream !== ''
  const durationOk = !payload.missing.includes('duration') ||
    (durationMode === 'preset' ? preset !== '' : (fromDate !== '' && toDate !== ''))
  const canSubmit  = streamOk && durationOk

  const handleSubmit = () => {
    let q = payload.original_query
    if (stream) q += ` stream=${stream}`
    if (durationMode === 'preset' && preset) {
      q += ` for the last ${preset}`
    } else if (durationMode === 'custom' && fromDate && toDate) {
      q += ` from ${fromDate} to ${toDate}`
    }
    q += ` limit ${limit}`
    onSubmit(q)
  }

  return (
    <div className="clarify-form">

      {/* Stream */}
      {payload.stream && (
        <div className="clarify-section">
          <p className="clarify-label">
            {payload.stream.question}
            {!payload.missing.includes('stream') && <span className="clarify-optional"> (optional)</span>}
          </p>
          <div className="clarify-pills">
            {payload.stream.options.map(opt => (
              <button
                key={opt.value}
                className={`clarify-pill${stream === opt.value ? ' clarify-pill--active' : ''}`}
                onClick={() => setStream(s => s === opt.value ? '' : opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Duration */}
      {payload.duration && (
        <div className="clarify-section">
          <p className="clarify-label">
            {payload.duration.question}
            {!payload.missing.includes('duration') && <span className="clarify-optional"> (optional)</span>}
          </p>
          <div className="clarify-pills">
            {payload.duration.presets.map(p => (
              <button
                key={p.value}
                className={`clarify-pill${durationMode === 'preset' && preset === p.value ? ' clarify-pill--active' : ''}`}
                onClick={() => { setDurationMode('preset'); setPreset(p.value) }}
              >
                {p.label}
              </button>
            ))}
            {payload.duration.allow_custom && (
              <button
                className={`clarify-pill clarify-pill--outline${durationMode === 'custom' ? ' clarify-pill--active' : ''}`}
                onClick={() => { setDurationMode('custom'); setPreset('') }}
              >
                Custom range
              </button>
            )}
          </div>

          {durationMode === 'custom' && (
            <div className="clarify-daterange">
              <label className="clarify-date-label">
                From
                <input
                  type="date"
                  className="clarify-date-input"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
              </label>
              <span className="clarify-date-sep">→</span>
              <label className="clarify-date-label">
                To
                <input
                  type="date"
                  className="clarify-date-input"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </label>
            </div>
          )}

          {payload.duration.hint && (
            <p className="clarify-hint">ℹ️ {payload.duration.hint}</p>
          )}
        </div>
      )}

      {/* Limit — only shown when user explicitly exceeded the cap */}
      {payload.limit && (
        <div className="clarify-section">
          {payload.limit.requested && (
            <p className="clarify-exceeded">
              ⚠️ You requested <strong>{payload.limit.requested} records</strong> — the maximum is 20.
            </p>
          )}
          <p className="clarify-label">{payload.limit.question}</p>
          <div className="clarify-pills">
            {payload.limit.options.map(opt => (
              <button
                key={opt}
                className={`clarify-pill${limit === opt ? ' clarify-pill--active' : ''}`}
                onClick={() => setLimit(opt)}
              >
                {opt} records
              </button>
            ))}
          </div>
        </div>
      )}

      <button className="clarify-run-btn" onClick={handleSubmit} disabled={!canSubmit}>
        Run Query ➤
      </button>

    </div>
  )
}
