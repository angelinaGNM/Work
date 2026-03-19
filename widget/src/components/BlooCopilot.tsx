import { useEffect, useRef, useState } from 'react'
import { useCopilotStream } from '../hooks/useCopilotStream'
import { StreamingMessage } from './StreamingMessage'
import { SkillChips } from './SkillChips'
import { InputBar } from './InputBar'
import blooIcon from '@copilot-poc/icons/icons8-bee-top-view-96.png'

const MODELS = [
  { provider: 'anthropic', label: 'Claude Sonnet 4.6' },
  { provider: 'openai',    label: 'GPT-4.1'           },
]

export function BlooCopilot() {
  const { messages, isLoading, sendQuery } = useCopilotStream()
  const [provider, setProvider] = useState('anthropic')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const activeModel = MODELS.find(m => m.provider === provider)!

  return (
    <div className="copilot-shell">

      <header className="copilot-header">
        <img src={blooIcon} alt="BLOO" className="header-icon" />
        <div className="header-titles">
          <h1 className="header-title">BLOO Copilot</h1>
          <p className="header-subtitle">Bloo Hypercloud AI Assistant</p>
        </div>

        <div className="model-selector">
          <span className="model-label">Model</span>
          <select
            className="model-select"
            value={provider}
            onChange={e => setProvider(e.target.value)}
            disabled={isLoading}
          >
            {MODELS.map(m => (
              <option key={m.provider} value={m.provider}>{m.label}</option>
            ))}
          </select>
        </div>

        <span className={`status-dot ${isLoading ? 'status-busy' : 'status-ready'}`} title={isLoading ? 'Thinking…' : 'Ready'} />
      </header>

      <div className="chat-window">
        {messages.length === 0 && (
          <div className="empty-state">
            <img src={blooIcon} alt="BLOO" className="empty-icon" />
            <p className="empty-title">How can I help you today?</p>
            <p className="empty-hint">Ask me to write a DQL query, investigate an alert, hunt for threats, or explain a signal.</p>
            <p className="empty-model">Using <strong>{activeModel.label}</strong></p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className="message-row">
            {msg.role === 'user' ? (
              <div className="user-message">
                <div className="user-bubble">{msg.text}</div>
              </div>
            ) : (
              <div className="copilot-message-wrapper">
                <StreamingMessage
                  events={msg.events}
                  isStreaming={msg.isStreaming}
                  originalQuery={msg.originalQuery}
                  onClarify={query => sendQuery(query, undefined, provider)}
                  startedAt={msg.startedAt}
                  phaseTimes={msg.phaseTimes}
                />
                <SkillChips
                  suggestions={msg.suggestions}
                  onSelect={(skillId, label) => sendQuery(label, skillId, provider)}
                />
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      <InputBar onSend={query => sendQuery(query, undefined, provider)} disabled={isLoading} />
    </div>
  )
}
