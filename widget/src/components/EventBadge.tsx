import type { EventType } from '../types/events'

const BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  thinking: { label: 'thinking', className: 'badge badge-thinking' },
  skill:    { label: 'skill',    className: 'badge badge-skill'    },
  waiting:  { label: 'waiting',  className: 'badge badge-waiting'  },
  result:   { label: 'result',   className: 'badge badge-result'   },
  error:    { label: 'error',    className: 'badge badge-error'    },
}

export function EventBadge({ type }: { type: EventType }) {
  const config = BADGE_CONFIG[type]
  if (!config) return null
  return <span className={config.className}>{config.label}</span>
}
