import { useState } from 'react'

interface Props {
  content: string  // JSON: { results, total, shown }
}

export function ResultsTable({ content }: Props) {
  const [expanded, setExpanded] = useState(false)

  let results: Record<string, unknown>[] = []
  let total = 0
  let shown = 0

  try {
    const parsed = JSON.parse(content)
    results = parsed.results ?? []
    total   = parsed.total   ?? 0
    shown   = parsed.shown   ?? results.length
  } catch {
    return null
  }

  if (!results.length) return null

  // Collect all unique field names, cap at 10 columns
  const fields = Array.from(new Set(results.flatMap(r => Object.keys(r)))).slice(0, 10)

  const countLabel = shown === total
    ? `${shown} record${shown !== 1 ? 's' : ''}`
    : `${shown} of ${total} records`

  return (
    <div className="results-table-wrapper">
      <button className="results-toggle" onClick={() => setExpanded(p => !p)}>
        <span className="results-chevron">{expanded ? '▾' : '▸'}</span>
        <span className="results-count">{countLabel}</span>
        <span className="results-action">{expanded ? 'collapse' : 'expand table'}</span>
      </button>

      {expanded && (
        <div className="results-table-scroll">
          <table className="results-table">
            <thead>
              <tr>
                {fields.map(f => <th key={f}>{f}</th>)}
              </tr>
            </thead>
            <tbody>
              {results.map((row, i) => (
                <tr key={i}>
                  {fields.map(f => (
                    <td key={f} title={String(row[f] ?? '')}>
                      {String(row[f] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
