"""
MCP Resources — BLOO Copilot KB files exposed as readable MCP resources.

Claude can read these directly (without a tool call) to prime its context
before generating queries or answering platform questions.

URI scheme: bloo://kb/<resource-name>
"""

from server.mcp.server import mcp
from server.kb.loader import (
    load_dql_kb,
    load_dql_quick_ref,
    load_platform_kb,
)
from config.settings import settings
from pathlib import Path


@mcp.resource("bloo://kb/dql-reference")
def dql_reference() -> str:
    """
    Full DQL (DNIF Query Language) reference — syntax, keywords, operators,
    stream field names, aggregation functions, and example queries.
    Use this when generating or explaining DQL queries.
    """
    return load_dql_kb()


@mcp.resource("bloo://kb/dql-quick-ref")
def dql_quick_ref() -> str:
    """
    Compact DQL quick-reference card — the essential syntax subset needed
    for most security queries. Faster to read than the full reference.
    """
    return load_dql_quick_ref()


@mcp.resource("bloo://kb/bloo-platform")
def bloo_platform() -> str:
    """
    Bloo Hypercloud platform knowledge base — overview, modules, features,
    use cases, pricing tiers, integrations, and blog insights scraped from bloo.io.
    Use this when answering questions about the Bloo platform.
    """
    return load_platform_kb()


@mcp.resource("bloo://kb/stream-definitions")
def stream_definitions() -> str:
    """
    DNIF stream and action definitions — all available data streams
    (authentication, firewall, DNS, endpoint, NTA, etc.) with their
    field schemas. Use this to understand what data is in each stream.
    """
    kb_dir = settings.kb_dir
    parts = []
    for filename in ("stream_action.txt", "stream_DDM.txt"):
        path = Path(kb_dir) / filename
        if path.exists():
            parts.append(f"# {filename}\n\n{path.read_text(encoding='utf-8')}")
    return "\n\n---\n\n".join(parts) if parts else "Stream definitions not found."
