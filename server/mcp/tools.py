"""
MCP Tools — BLOO Copilot skills exposed as callable MCP tools.

Each tool collects the full SSE event stream from the underlying skill
and returns a single formatted text result. Claude reasons over this output
and decides what to do next.

Guardrails (Layer 1 regex + Layer 1.5 LLM classifier once built) apply to
every tool call exactly as they do in the chat widget.
"""

from server.mcp.server import mcp
from server.llm import get_llm_client
from server.guardrails import check_input_full
from server.skills import translate_to_dql as _skill_translate
from server.skills import platform_faq as _skill_platform_faq
from server.skills.events import EventType


# ── Helper ────────────────────────────────────────────────────────────────────

async def _collect(skill_gen) -> str:
    """
    Drain an async skill generator and return all meaningful content as a
    single string. Blocked and error events short-circuit immediately.
    """
    parts: list[str] = []
    async for event in skill_gen:
        if event.type == EventType.BLOCKED:
            return f"🚫 {event.content}"
        if event.type == EventType.ERROR:
            return f"❌ {event.content}"
        if event.type == EventType.CONTENT:
            parts.append(event.content)
        elif event.type == EventType.RESULT:
            parts.append(f"\n\n**Result:** {event.content}")
        elif event.type == EventType.TABLE:
            parts.append(f"\n\n**Data:**\n{event.content}")
        elif event.type == EventType.CLARIFY:
            parts.append(
                f"\n\n**Clarification needed** — the query was ambiguous. "
                f"Details: {event.content}"
            )
    return "".join(parts).strip()


async def _guard(query: str) -> str | None:
    """Run full guardrail check (Layer 1 regex + Layer 1.5 LLM). Returns block message or None if safe."""
    return await check_input_full(query)


# ── Implemented skills ────────────────────────────────────────────────────────

@mcp.tool()
async def translate_to_dql(
    query: str,
    stream_name: str = "",
    duration: str = "",
    provider: str = "",
) -> str:
    """
    Translate a natural language security question into a DQL query, execute
    it against DNIF, and return the results with AI-generated insights.

    Use this for any request to search, investigate, or analyse security events —
    failed logins, blocked traffic, DNS lookups, endpoint activity, and so on.

    Args:
        query: The natural language security question (e.g. "show failed logins in the last hour").
        stream_name: Optional — the DNIF stream to target (e.g. "authentication", "firewall").
                     Leave blank to let the skill infer from context.
        duration: Optional — time range override (e.g. "1h", "24h", "3d").
                  Leave blank if the duration is stated in the query.
        provider: Optional — LLM provider to use ("anthropic" or "openai"). Defaults to the
                  server's configured default (ANTHROPIC).
    """
    block = await _guard(query)
    if block:
        return block

    llm = get_llm_client(provider or None)
    return await _collect(
        _skill_translate.run(
            query=query,
            llm=llm,
            stream_name=stream_name or None,
            duration=duration or None,
        )
    )


@mcp.tool()
async def platform_faq(question: str, provider: str = "") -> str:
    """
    Answer questions about the Bloo Hypercloud security platform — its modules,
    features, pricing, integrations, blog content, and company background.

    Use this for any question about what Bloo is, how it works, what it costs,
    or what modules/integrations are available. Do NOT use for querying security data.

    Args:
        question: The platform question (e.g. "What is b-ueba?", "How does DNIF pricing work?").
        provider: Optional — LLM provider to use ("anthropic" or "openai"). Defaults to the
                  server's configured default (ANTHROPIC).
    """
    block = await _guard(question)
    if block:
        return block

    llm = get_llm_client(provider or None)
    return await _collect(_skill_platform_faq.run(query=question, llm=llm))


# ── Stub skills (not yet implemented — Phase 2+) ──────────────────────────────

_NOT_IMPLEMENTED = (
    "This skill is not yet implemented. It is planned for a future build phase. "
    "Use translate_to_dql or platform_faq for now."
)


@mcp.tool()
async def explain_signal(signal_id: str, signal_data: str = "") -> str:
    """
    Explain what a DNIF alert or signal means in plain English, including
    severity, likely cause, and recommended immediate actions.

    Args:
        signal_id: The signal or alert ID from the DNIF console.
        signal_data: Optional raw signal JSON or description for additional context.
    """
    return _NOT_IMPLEMENTED


@mcp.tool()
async def suggest_investigation(signal: str, context: str = "") -> str:
    """
    Given a security signal or alert, suggest ordered next investigation steps —
    what to look for, which streams to query, and what to pivot on.

    Args:
        signal: Description or ID of the signal to investigate.
        context: Optional additional context (user, host, IP, timeframe).
    """
    return _NOT_IMPLEMENTED


@mcp.tool()
async def threat_hunt(tactic: str, technique: str = "") -> str:
    """
    Generate DQL queries for proactive threat hunting based on a MITRE ATT&CK
    tactic or technique.

    Args:
        tactic: MITRE ATT&CK tactic name (e.g. "Lateral Movement", "Persistence").
        technique: Optional specific technique (e.g. "T1078 - Valid Accounts").
    """
    return _NOT_IMPLEMENTED


@mcp.tool()
async def suggest_visualization(dql: str) -> str:
    """
    Given a DQL query, recommend the best chart type and field mappings for
    visualising the results in a DNIF dashboard.

    Args:
        dql: The DQL query whose results you want to visualise.
    """
    return _NOT_IMPLEMENTED


@mcp.tool()
async def incident_response(attack_type: str) -> str:
    """
    Provide a NIST CSF-aligned incident response guide for a given attack type —
    covering identification, containment, eradication, recovery, and lessons learned.

    Args:
        attack_type: The attack or incident type (e.g. "ransomware", "phishing", "brute force").
    """
    return _NOT_IMPLEMENTED


@mcp.tool()
async def executive_summary(findings: str) -> str:
    """
    Summarise security findings in plain, non-technical language suitable for
    C-suite and board-level stakeholders.

    Args:
        findings: The security findings or investigation summary to translate.
    """
    return _NOT_IMPLEMENTED


@mcp.tool()
async def refresh_kb() -> str:
    """
    Trigger a full rescrape of bloo.io and update the platform knowledge base.
    This is the same operation that runs automatically on the weekly schedule.

    Returns a status message with pages scraped and sections updated.
    """
    return (
        "KB auto-refresh is not yet implemented (planned in a future build phase). "
        "To manually reload the current KB from disk, call POST /copilot/kb/reload."
    )
