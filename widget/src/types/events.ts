export type EventType =
  | 'thinking'
  | 'skill'
  | 'content'
  | 'waiting'
  | 'result'
  | 'table'
  | 'suggest'
  | 'error'
  | 'done'
  | 'transcription'
  | 'clarify'
  | 'blocked'

export interface CopilotEvent {
  type: EventType
  content: string
}

export interface Suggestion {
  skillId: string
  label: string
}

export interface PhaseTimes {
  skill?:   number   // ms timestamp when skill event arrived
  waiting?: number   // ms timestamp when waiting event arrived (query executing)
  result?:  number   // ms timestamp when result event arrived
  done?:    number   // ms timestamp when done event arrived
}

export interface Message {
  id: string
  role: 'user' | 'copilot'
  text?: string
  originalQuery?: string   // original user query, used for copy-with-context
  events: CopilotEvent[]
  suggestions: Suggestion[]
  isStreaming: boolean
  startedAt: number        // Date.now() when query was sent
  phaseTimes: PhaseTimes
}
