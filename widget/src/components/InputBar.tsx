import { useState, useRef, type KeyboardEvent } from 'react'
import { MicButton } from './MicButton'

interface Props {
  onSend: (query: string) => void
  disabled: boolean
}

export function InputBar({ onSend, disabled }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTranscribed = (text: string) => {
    setValue(text)
    textareaRef.current?.focus()
  }

  return (
    <div className="input-bar">
      <MicButton onTranscribed={handleTranscribed} disabled={disabled} />
      <textarea
        ref={textareaRef}
        className="input-textarea"
        placeholder="Ask BLOO something… or hold 🎙 to speak"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={2}
      />
      <button className="send-btn" onClick={handleSend} disabled={disabled || !value.trim()}>
        {disabled ? '…' : '➤'}
      </button>
    </div>
  )
}
