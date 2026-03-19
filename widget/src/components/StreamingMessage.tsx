import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import type { CopilotEvent, PhaseTimes } from '../types/events'
import { EventBadge } from './EventBadge'
import { DqlCodeBlock } from './DqlCodeBlock'
import { ResultsTable } from './ResultsTable'
import { ClarifyForm } from './ClarifyForm'
import blooIcon from '@copilot-poc/icons/icons8-bee-top-view-96.png'

interface Props {
  events: CopilotEvent[]
  isStreaming: boolean
  originalQuery?: string
  onClarify?: (query: string) => void
  startedAt: number
  phaseTimes: PhaseTimes
}

function fmt(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function computePhases(startedAt: number, pt: PhaseTimes) {
  const phases: { label: string; ms: number }[] = []
  if (pt.skill)                          phases.push({ label: 'Routing',    ms: pt.skill   - startedAt  })
  if (pt.skill   && pt.waiting)          phases.push({ label: 'Generating', ms: pt.waiting - pt.skill   })
  if (pt.waiting && pt.result)           phases.push({ label: 'Query',      ms: pt.result  - pt.waiting })
  if (pt.result  && pt.done)             phases.push({ label: 'Insights',   ms: pt.done    - pt.result  })
  else if (pt.skill && pt.done && !pt.waiting)
                                         phases.push({ label: 'Response',   ms: pt.done    - pt.skill   })
  const totalMs = pt.done ? pt.done - startedAt : null
  return { phases, totalMs }
}

const COT_TYPES     = new Set(['thinking', 'skill', 'waiting'])
const RESULT_TYPES  = new Set(['result', 'error'])
const TABLE_TYPES   = new Set(['table'])
const CLARIFY_TYPES = new Set(['clarify'])
const BLOCKED_TYPES = new Set(['blocked'])

export function StreamingMessage({ events, isStreaming, originalQuery, onClarify, startedAt, phaseTimes }: Props) {
  const [reasoningOpen, setReasoningOpen] = useState(true)

  // Auto-collapse reasoning section 1.5s after streaming ends
  useEffect(() => {
    if (!isStreaming) {
      const t = setTimeout(() => setReasoningOpen(false), 1500)
      return () => clearTimeout(t)
    } else {
      setReasoningOpen(true)
    }
  }, [isStreaming])

  const { phases, totalMs } = computePhases(startedAt, phaseTimes)

  const cotEvents     = events.filter(e => COT_TYPES.has(e.type))
  const resultEvents  = events.filter(e => RESULT_TYPES.has(e.type))
  const tableEvents   = events.filter(e => TABLE_TYPES.has(e.type))
  const clarifyEvents = events.filter(e => CLARIFY_TYPES.has(e.type))
  const blockedEvents = events.filter(e => BLOCKED_TYPES.has(e.type))
  const contentText   = events.filter(e => e.type === 'content').map(e => e.content).join('')

  // Custom markdown renderer — DQL code blocks get special treatment
  const markdownComponents: Components = {
    code({ className, children }) {
      const lang = /language-(\w+)/.exec(className || '')?.[1]
      if (lang === 'dql') {
        return <DqlCodeBlock code={String(children)} originalQuery={originalQuery} />
      }
      return <code className={className ?? 'inline-code'}>{children}</code>
    },
    pre({ children }) {
      // Let DqlCodeBlock handle its own wrapper; for other langs use default pre
      return <>{children}</>
    },
  }

  return (
    <div className="copilot-card">
      <div className="copilot-card-avatar">
        <img src={blooIcon} alt="BLOO" className="avatar" />
      </div>

      <div className="copilot-card-body">

        {/* Reasoning section */}
        {cotEvents.length > 0 && (
          <div className="reasoning-section">
            <button className="reasoning-toggle" onClick={() => setReasoningOpen(p => !p)}>
              <span className="reasoning-chevron">{reasoningOpen ? '▾' : '▸'}</span>
              <span>Reasoning</span>
              {isStreaming && <span className="reasoning-pulse" />}
            </button>

            {reasoningOpen && (
              <div className="reasoning-body">
                {cotEvents.map((event, i) => (
                  <div key={i} className={`event-row event-${event.type}`}>
                    <EventBadge type={event.type} />
                    <span className="event-text">{event.content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main response */}
        {contentText && (
          <div className="response-body">
            <ReactMarkdown components={markdownComponents}>{contentText}</ReactMarkdown>
            {isStreaming && <span className="cursor-blink">▌</span>}
          </div>
        )}

        {!contentText && isStreaming && <span className="cursor-blink">▌</span>}

        {/* Result / warning boxes */}
        {resultEvents.map((event, i) => (
          <div key={i} className={`result-box result-box-${event.type}`}>
            <EventBadge type={event.type} />
            <span className="result-text">{event.content}</span>
          </div>
        ))}

        {/* Collapsible results table */}
        {tableEvents.map((event, i) => (
          <ResultsTable key={i} content={event.content} />
        ))}

        {/* Blocked — guardrail triggered */}
        {blockedEvents.map((event, i) => (
          <div key={i} className="blocked-box">
            <span className="blocked-icon">🛡️</span>
            <span className="blocked-text">{event.content}</span>
          </div>
        ))}

        {/* Clarify form — missing params */}
        {clarifyEvents.map((event, i) => (
          <ClarifyForm
            key={i}
            content={event.content}
            onSubmit={query => onClarify?.(query)}
          />
        ))}

        {/* Timing bar — shown after streaming completes */}
        {!isStreaming && totalMs !== null && phases.length > 0 && (
          <div className="timing-bar">
            {phases.map((p, i) => (
              <span key={i} className="timing-phase">
                <span className="timing-label">{p.label}</span>
                <span className="timing-value">{fmt(p.ms)}</span>
              </span>
            ))}
            <span className="timing-total">{fmt(totalMs)} total</span>
          </div>
        )}

      </div>
    </div>
  )
}
