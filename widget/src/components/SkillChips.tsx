import type { Suggestion } from '../types/events'

const SKILL_ICONS: Record<string, string> = {
  suggest_visualization: '📊',
  suggest_investigation: '🔍',
  threat_hunt:           '🏹',
  incident_response:     '🚨',
  executive_summary:     '📋',
  platform_faq:          '💬',
  explain_signal:        '💡',
  translate_to_dql:      '⚙️',
  // Module integrations
  b_epm:                 '🖥️',
  b_ueba:                '👤',
  b_nbad:                '🌐',
}

interface Props {
  suggestions: Suggestion[]
  onSelect: (skillId: string, label: string) => void
}

export function SkillChips({ suggestions, onSelect }: Props) {
  if (!suggestions.length) return null
  return (
    <div className="skill-chips">
      {suggestions.map(s => (
        <button key={s.skillId} className="chip" onClick={() => onSelect(s.skillId, s.label)}>
          <span>{SKILL_ICONS[s.skillId] ?? '→'}</span>
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  )
}
