"""
Skill: platform_faq

Answers questions about the Bloo platform — its products, modules, features,
pricing, integrations, blog content, and company background — using the
bloo-platform knowledge base.
"""

from typing import AsyncIterator

from server.llm.base import LLMClient
from server.kb.loader import load_platform_kb, load_system_prompt
from server.skills.events import CopilotEvent, EventType

DOWNSTREAM_SKILLS = [
    ("translate_to_dql", "write a DQL query to explore this in your data"),
]

SYSTEM_PROMPT = """\
You are BLOO Copilot, an expert on the Bloo Hypercloud security platform.
Answer the user's question using the platform knowledge base provided.
Be concise, accurate, and helpful. Use plain language unless the user is clearly technical.
If the knowledge base does not contain the answer, say so honestly — do not fabricate.
Format responses with markdown where it improves readability (bullet points, bold headers, tables).
"""


async def run(
    query: str,
    llm: LLMClient,
) -> AsyncIterator[CopilotEvent]:

    yield CopilotEvent(type=EventType.THINKING, content="Looking up platform information...")
    yield CopilotEvent(type=EventType.SKILL, content="platform_faq")

    platform_kb = load_platform_kb()
    system = load_system_prompt() + "\n\n---\n\n" + SYSTEM_PROMPT
    user_content = (
        f"<platform_kb>\n{platform_kb}\n</platform_kb>\n\n"
        f"User question: {query}"
    )

    async for token in llm.stream_complete(
        system=system,
        messages=[{"role": "user", "content": user_content}],
    ):
        yield CopilotEvent(type=EventType.CONTENT, content=token)

    for skill_id, description in DOWNSTREAM_SKILLS:
        yield CopilotEvent(type=EventType.SUGGEST, content=f"{skill_id}:{description}")
