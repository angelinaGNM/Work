"""
MCP Prompts — BLOO Copilot skill prompt templates exposed as MCP prompts.

Claude Code can invoke these to prime a skill's persona and instructions
before calling the corresponding tool.
"""

from mcp.server.fastmcp import Context
from server.mcp.server import mcp
from server.kb.loader import load_skill_prompt, load_system_prompt


@mcp.prompt()
def bloo_system() -> str:
    """
    BLOO Copilot master system prompt — core identity, scope, and absolute
    restrictions. Apply this to any BLOO Copilot interaction.
    """
    return load_system_prompt()


@mcp.prompt()
def translate_to_dql_prompt() -> str:
    """
    Prompt template for the translate_to_dql skill — DQL syntax rules,
    stream field names, guardrail constraints, and example query formats.
    """
    return load_skill_prompt("translate_to_dql")


@mcp.prompt()
def platform_faq_prompt() -> str:
    """
    Prompt template for the platform_faq skill — how to answer Bloo platform
    questions using the KB, tone guidelines, and response format.
    """
    return load_skill_prompt("platform_faq")


@mcp.prompt()
def explain_signal_prompt() -> str:
    """
    Prompt template for the explain_signal skill — how to interpret DNIF
    signals and explain them clearly to analysts of varying experience.
    """
    return load_skill_prompt("explain_signal")


@mcp.prompt()
def suggest_investigation_prompt() -> str:
    """
    Prompt template for the suggest_investigation skill — investigation
    methodology, pivot strategies, and MITRE ATT&CK alignment.
    """
    return load_skill_prompt("suggest_investigation")


@mcp.prompt()
def threat_hunt_prompt() -> str:
    """
    Prompt template for the threat_hunt skill — how to generate DQL-based
    hunting queries from MITRE tactics and techniques.
    """
    return load_skill_prompt("threat_hunt")


@mcp.prompt()
def incident_response_prompt() -> str:
    """
    Prompt template for the incident_response skill — NIST CSF phases,
    response playbook structure, and escalation guidance.
    """
    return load_skill_prompt("incident_response")


@mcp.prompt()
def executive_summary_prompt() -> str:
    """
    Prompt template for the executive_summary skill — tone, language level,
    and structure for C-suite security summaries.
    """
    return load_skill_prompt("executive_summary")
