from typing import AsyncIterator
from server.llm import get_llm_client
from server.skills.events import CopilotEvent, EventType
from server.skills import translate_to_dql, platform_faq
from server.guardrails import check_input_full

SKILL_CHAINS: dict[str, list[str]] = {
    "translate_to_dql":      ["suggest_visualization", "suggest_investigation",
                               "incident_response", "threat_hunt"],
    "suggest_investigation": ["threat_hunt", "incident_response", "executive_summary"],
    "incident_response":     ["executive_summary"],
    "threat_hunt":           ["executive_summary"],
    "explain_signal":        ["threat_hunt", "suggest_investigation"],
    "platform_faq":          ["translate_to_dql"],
}

# ── Intent classification ──────────────────────────────────────────────────────

_INTENT_SYSTEM = """\
You are a query router for BLOO Copilot. Given a user's message, output exactly one skill name.

Skills:
- platform_faq: questions about the Bloo platform, its products, features, pricing, modules,
  company background, blog posts, integrations, how things work, or general security concepts.
- translate_to_dql: requests to query, search, or investigate security data — anything that
  requires writing a DQL query or looking at logs/events in the SIEM.

Output only the skill name, nothing else.\
"""


async def _classify_intent(query: str, llm) -> str:
    response = ""
    async for token in llm.stream_complete(
        system=_INTENT_SYSTEM,
        messages=[{"role": "user", "content": query}],
    ):
        response += token
    skill = response.strip().lower()
    return skill if skill in SKILL_CHAINS else "translate_to_dql"


# ── Main orchestrator entry point ─────────────────────────────────────────────

async def run(
    query: str,
    skill: str | None = None,
    context: dict | None = None,
    provider: str | None = None,
) -> AsyncIterator[CopilotEvent]:
    llm = get_llm_client(provider)
    context = context or {}

    try:
        # ── Layer 1 + 1.5: Input guard ───────────────────────────────────────
        block_msg = await check_input_full(query)
        if block_msg:
            yield CopilotEvent(type=EventType.BLOCKED, content=block_msg)
            yield CopilotEvent(type=EventType.DONE, content="")
            return


        # Use explicit skill if provided, otherwise classify intent
        if skill:
            resolved_skill = skill
        else:
            resolved_skill = await _classify_intent(query, llm)

        if resolved_skill == "translate_to_dql":
            async for event in translate_to_dql.run(
                query=query,
                llm=llm,
                stream_name=context.get("stream_name"),
                duration=context.get("duration"),
            ):
                yield event

        elif resolved_skill == "platform_faq":
            async for event in platform_faq.run(query=query, llm=llm):
                yield event

        else:
            yield CopilotEvent(
                type=EventType.ERROR,
                content=f"Skill '{resolved_skill}' is not yet implemented. Coming in a future phase.",
            )

    except Exception as e:
        yield CopilotEvent(type=EventType.ERROR, content=f"An error occurred: {str(e)}")

    yield CopilotEvent(type=EventType.DONE, content="")
