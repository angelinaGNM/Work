import { useState, useCallback } from 'react'
import type { Message, CopilotEvent, Suggestion, EventType, PhaseTimes } from '../types/events'

function parseSSEBlock(block: string): CopilotEvent | null {
  const lines = block.split(/\r?\n/)
  let type = ''
  const dataParts: string[] = []

  for (const line of lines) {
    if (line.startsWith('event:')) {
      type = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      // Collect all data lines — SSE spec: multiple data lines concat with \n
      dataParts.push(line.replace(/^data: ?/, ''))
    }
  }

  if (!type) return null
  return { type: type as EventType, content: dataParts.join('\n') }
}

function parseSuggestion(content: string): Suggestion {
  const colonIdx = content.indexOf(':')
  return { skillId: content.slice(0, colonIdx), label: content.slice(colonIdx + 1) }
}

export function useCopilotStream() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const sendQuery = useCallback(async (query: string, skill?: string, provider?: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(), role: 'user', text: query,
      events: [], suggestions: [], isStreaming: false,
      startedAt: Date.now(), phaseTimes: {},
    }
    const copilotMsg: Message = {
      id: crypto.randomUUID(), role: 'copilot',
      originalQuery: query,
      events: [], suggestions: [], isStreaming: true,
      startedAt: Date.now(), phaseTimes: {},
    }

    setMessages(prev => [...prev, userMsg, copilotMsg])
    setIsLoading(true)

    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
      const response = await fetch(`${apiUrl}/copilot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({ query, skill: skill ?? null, provider: provider ?? null }),
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split(/\r\n\r\n|\n\n/)
        buffer = parts.pop() ?? ''

        const events = parts.map(parseSSEBlock).filter((e): e is CopilotEvent => e !== null)
        if (!events.length) continue

        setMessages(prev =>
          prev.map(msg => {
            if (msg.id !== copilotMsg.id) return msg
            const newEvents = [...msg.events]
            const newSuggestions = [...msg.suggestions]
            const newPhaseTimes: PhaseTimes = { ...msg.phaseTimes }
            let isStreaming = msg.isStreaming
            for (const event of events) {
              if (event.type === 'suggest') {
                newSuggestions.push(parseSuggestion(event.content))
              } else if (event.type === 'done') {
                isStreaming = false
                newPhaseTimes.done = Date.now()
              } else {
                newEvents.push(event)
                if (event.type === 'skill')   newPhaseTimes.skill   = Date.now()
                if (event.type === 'waiting') newPhaseTimes.waiting = Date.now()
                if (event.type === 'result')  newPhaseTimes.result  = Date.now()
              }
            }
            return { ...msg, events: newEvents, suggestions: newSuggestions, isStreaming, phaseTimes: newPhaseTimes }
          })
        )
      }
    } catch {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === copilotMsg.id
            ? { ...msg, events: [...msg.events, { type: 'error' as EventType, content: 'Connection error. Please try again.' }], isStreaming: false, phaseTimes: { ...msg.phaseTimes, done: Date.now() } }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { messages, isLoading, sendQuery }
}
