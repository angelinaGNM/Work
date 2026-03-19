from dataclasses import dataclass
from enum import StrEnum


class EventType(StrEnum):
    THINKING = "thinking"   # Copilot reasoning / status narration
    SKILL    = "skill"      # Skill being invoked
    CONTENT  = "content"    # Streaming LLM token output
    WAITING  = "waiting"    # Async operation in progress (DQL execution etc.)
    RESULT   = "result"     # Final structured output from a skill
    TABLE    = "table"      # JSON-encoded query results for collapsible table UI
    SUGGEST       = "suggest"        # Downstream skill suggestion offered to user
    ERROR         = "error"          # Something went wrong
    DONE          = "done"           # Stream complete
    TRANSCRIPTION = "transcription"  # Voice input transcribed to text
    CLARIFY       = "clarify"        # Copilot needs more info — JSON payload with options
    BLOCKED       = "blocked"        # Request blocked by guardrail


@dataclass
class CopilotEvent:
    type: EventType
    content: str

    def to_sse(self) -> dict:
        """Serialize to SSE-compatible dict for sse-starlette."""
        return {
            "event": self.type.value,
            "data": self.content,
        }
