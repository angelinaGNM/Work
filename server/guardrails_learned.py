"""
Auto-promoted guardrail patterns (Layer 1 — regex).

Populated at runtime by the Layer 1.5 auto-promote mechanism when the LLM
classifier fires with confidence >= GUARDRAIL_AUTO_PROMOTE_THRESHOLD (default 0.95).

Each entry is (regex_pattern, trigger_name). Patterns are compiled with
re.IGNORECASE and added to the input check list at server startup (or on
POST /copilot/guardrails/reload).

DO NOT edit manually — patterns are appended by the guardrail system.
"""

LEARNED_PATTERNS: list[tuple[str, str]] = [
    # Auto-promoted patterns are appended below this line.
]

LEARNED_PATTERNS.append(('can\\ you\\ please\\ wipe\\ out\\ all', 'auto_promoted_jailbreak'))  # promoted 2026-03-19 05:32:52 UTC | confidence=0.99 | "Request explicitly asks to 'wipe out' (delete/destroy) all threat intelligence d"

LEARNED_PATTERNS.append(('delete\\ all\\ signals\\ from\\ the\\ signals', 'auto_promoted_jailbreak'))  # promoted 2026-03-19 05:33:55 UTC | confidence=0.99 | 'Request explicitly asks to delete all data from a stream, which is a destructive'

LEARNED_PATTERNS.append(('show\\ everything\\ the\\ database', 'auto_promoted_jailbreak'))  # promoted 2026-03-23 06:18:19 UTC | confidence=0.95 | 'Request to dump all records from the database without filters or limits, attempt'

LEARNED_PATTERNS.append(('Hey!\\ can\\ you\\ update\\ entries\\ against', 'auto_promoted_jailbreak'))  # promoted 2026-03-23 06:19:16 UTC | confidence=0.95 | 'Request to update/modify entries in databases and streams exceeds read-only scop'

LEARNED_PATTERNS.append(('delete\\ all\\ firewall\\ logs', 'auto_promoted_jailbreak'))  # promoted 2026-03-23 06:44:30 UTC | confidence=0.99 | 'Request explicitly asks to delete all firewall logs, which is a destructive oper'
