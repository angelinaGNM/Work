"""
Skill: translate_to_dql

Translates a natural language query into a valid DQL statement,
streams chain-of-thought events, executes it against DNIF,
generates LLM insights over the results, and emits a collapsible
results table + contextual follow-up suggestions.
"""

import json
import re
from datetime import date, timedelta
from typing import AsyncIterator

from server.llm.base import LLMClient
from server.kb.loader import load_dql_kb, load_system_prompt, load_skill_prompt, load_stream_ddm
from server.dnif import dnif_client
from server.skills.events import CopilotEvent, EventType
from server.guardrails import check_dql

# ── Stream detection ──────────────────────────────────────────────────────────

_KNOWN_STREAMS = frozenset([
    'authentication', 'firewall', 'iam', 'dns', 'dhcp', 'email-gateway',
    'webfilter', 'webserver', 'threat', 'audit', 'auditd', 'compliance',
    'azure', 'configuration', 'win-audit',
    'ep-process', 'ep-network', 'ep-file', 'ep-registry', 'ep-service',
    'ep-driver-load', 'ep-image-load', 'ep-config', 'ep-wmi', 'ep-dns',
    'nta-connection', 'nta-ssh', 'nta-ssl', 'nta-dns', 'nta-rdp',
    'nta-http', 'nta-smtp', 'nta-ftp', 'nta-smb', 'nta-kerberos',
])

_STREAM_OPTIONS = [
    {"label": "Firewall",          "value": "firewall"},
    {"label": "Authentication",    "value": "authentication"},
    {"label": "IAM",               "value": "iam"},
    {"label": "DNS",               "value": "dns"},
    {"label": "DHCP",              "value": "dhcp"},
    {"label": "Email Gateway",     "value": "email-gateway"},
    {"label": "Web Filter",        "value": "webfilter"},
    {"label": "Web Server",        "value": "webserver"},
    {"label": "Threat",            "value": "threat"},
    {"label": "Win Audit",         "value": "win-audit"},
    {"label": "EP — Process",      "value": "ep-process"},
    {"label": "EP — Network",      "value": "ep-network"},
    {"label": "EP — File",         "value": "ep-file"},
    {"label": "EP — Registry",     "value": "ep-registry"},
    {"label": "NTA — HTTP",        "value": "nta-http"},
    {"label": "NTA — DNS",         "value": "nta-dns"},
    {"label": "NTA — SSH",         "value": "nta-ssh"},
    {"label": "NTA — SMTP",        "value": "nta-smtp"},
]

# Semantic domain keywords — if any appear, the LLM can infer the stream
_DOMAIN_HINTS_RE = re.compile(
    r'\b(login|logon|logoff|logout|auth|authentication|credential|password|'
    r'kerberos|saml|sso|2fa|mfa|sign.?in|'
    r'firewall|packet|traffic|block|allow|deny|drop|port|nat|vpn|inbound|outbound|'
    r'dns|domain|lookup|resolution|nameserver|'
    r'email|mail|phish|spam|smtp|sender|recipient|attachment|'
    r'process|executable|registry|file|endpoint|'
    r'http|https?|url|proxy|web|browse|'
    r'iam|group|role|permission|privilege|access|identity|'
    r'dhcp|lease|ip.address|'
    r'threat|malware|virus|intrusion|attack|exploit|'
    r'audit|compliance|policy|event.log|'
    r'network|connection|flow|bandwidth|lateral|'
    r'user|account)\b',
    re.IGNORECASE,
)

def _is_stream_ambiguous(query: str) -> bool:
    """True only when the query has zero stream name or domain context clues."""
    q = query.lower()
    if any(s in q for s in _KNOWN_STREAMS):
        return False
    if _DOMAIN_HINTS_RE.search(query):
        return False
    return True


# ── Duration detection ────────────────────────────────────────────────────────

_DURATION_RE = re.compile(
    r'\b(last|past|recent|hour|hours|day|days|week|weeks|minute|minutes|'
    r'ago|since|today|yesterday|this\s+week|last\s+week|this\s+month|'
    r'duration|\d+\s*h\b|\d+\s*d\b|\d+\s*m\b|\d+\s*w\b)\b',
    re.IGNORECASE,
)

_RELATIVE_DATE_RE = re.compile(
    r'\b(today|yesterday|this\s+week|last\s+week|this\s+month)\b',
    re.IGNORECASE,
)

def _resolve_relative_dates(query: str) -> str | None:
    """Return a date-context hint for the LLM when the query uses relative date words."""
    if not _RELATIVE_DATE_RE.search(query):
        return None
    today = date.today()
    q = query.lower()
    lines = []
    if 'today' in q:
        lines.append(f"'today' = {today.isoformat()} (from {today} 00:00:00 to {today} 23:59:59)")
    if 'yesterday' in q:
        yd = today - timedelta(days=1)
        lines.append(f"'yesterday' = {yd.isoformat()} (from {yd} 00:00:00 to {yd} 23:59:59)")
    if 'this week' in q:
        start = today - timedelta(days=today.weekday())
        lines.append(f"'this week' = {start.isoformat()} to {today.isoformat()}")
    if 'last week' in q:
        start = today - timedelta(days=today.weekday() + 7)
        end = start + timedelta(days=6)
        lines.append(f"'last week' = {start.isoformat()} to {end.isoformat()}")
    if 'this month' in q:
        start = today.replace(day=1)
        lines.append(f"'this month' = {start.isoformat()} to {today.isoformat()}")
    return '\n'.join(lines) if lines else None


# ── Clarify payload ───────────────────────────────────────────────────────────

_CLARIFY_STREAM = {
    "question": "Which data stream would you like to query?",
    "options": _STREAM_OPTIONS,
}

_CLARIFY_DURATION = {
    "question": "What time range?",
    "hint": "Queries are capped at 3 days to keep things performant.",
    "presets": [
        {"label": "Last 1 hour",   "value": "1h"},
        {"label": "Last 6 hours",  "value": "6h"},
        {"label": "Last 24 hours", "value": "24h"},
        {"label": "Last 3 days",   "value": "3d"},
    ],
    "allow_custom": True,
}

_CLARIFY_LIMIT = {
    "question": "How many records?",
    "options": ["5", "10", "20"],
    "default": "20",
}

# ── Limit detection ───────────────────────────────────────────────────────────

_EXPLICIT_LIMIT_RE = re.compile(
    r'\b(?:limit|top|show|get|fetch|return|give\s+me)\s+(\d+)\b',
    re.IGNORECASE,
)

def _get_requested_limit(query: str) -> int | None:
    """Return the user-specified record count if explicitly stated, else None."""
    match = _EXPLICIT_LIMIT_RE.search(query)
    return int(match.group(1)) if match else None


# ── Guardrail constants ──────────────────────────────────────────────────────
MAX_DAYS    = 3
MAX_RECORDS = 20

# ── Downstream skill suggestions ─────────────────────────────────────────────
DOWNSTREAM_SKILLS = [
    ("suggest_visualization", "visualize these results as a dashboard widget"),
    ("suggest_investigation", "investigate the activity this query uncovers"),
    ("threat_hunt",           "run a broader threat hunt related to this scenario"),
    ("incident_response",     "get incident response guidance for this scenario"),
]

# ── Entity field detection for module integrations ────────────────────────────
_HOST_FIELDS = {'host', 'hostname', 'device', 'computer', 'machine', 'endpoint', 'dvc', 'dvchost'}
_USER_FIELDS = {'user', 'username', 'account', 'login', 'uid', 'userid', 'src_user', 'dst_user'}
_IP_FIELDS   = {'src_ip', 'dst_ip', 'ip', 'source_ip', 'dest_ip', 'remote_ip', 'client_ip', 'server_ip'}

_ENTITY_SUGGESTS = {
    'host': ('b_epm',  'Investigate endpoint activity for hosts in these results using b-EPM'),
    'user': ('b_ueba', 'Analyze user behavior anomalies for users in these results using b-UEBA'),
    'ip':   ('b_nbad', 'Investigate network behavior anomalies for IPs in these results using b-NBAD'),
}


# ── Guardrails ────────────────────────────────────────────────────────────────

def _apply_guardrails(dql: str) -> tuple[str, list[str]]:
    warnings = []

    def replace_duration(match):
        value, unit = int(match.group(1)), match.group(2)
        days = {'d': value, 'h': value / 24, 'm': value / 1440, 'w': value * 7, 'M': value * 30}.get(unit, 0)
        if days > MAX_DAYS:
            warnings.append(f"⚠️ Duration clipped from `{value}{unit}` to `{MAX_DAYS}d` to keep the query performant.")
            return f"duration {MAX_DAYS}d"
        return match.group(0)

    dql = re.sub(r'duration\s+(\d+)([dhwmM])', replace_duration, dql)

    limit_match = re.search(r'\|\s*limit\s+(\d+)', dql, re.IGNORECASE)
    if limit_match:
        if int(limit_match.group(1)) > MAX_RECORDS:
            warnings.append(f"⚠️ Result set limited to {MAX_RECORDS} records (requested {limit_match.group(1)}).")
            dql = re.sub(r'\|\s*limit\s+\d+', f'| limit {MAX_RECORDS}', dql, flags=re.IGNORECASE)
    else:
        dql = dql.rstrip() + f' | limit {MAX_RECORDS}'
        warnings.append(f"⚠️ Result set limited to {MAX_RECORDS} records.")

    return dql, warnings


def _apply_guardrails_to_response(text: str) -> tuple[str, list[str]]:
    all_warnings: list[str] = []

    def replace_block(m):
        lang, code = m.group(1), m.group(2)
        if lang.lower() in ('dql', ''):
            new_code, w = _apply_guardrails(code)
            all_warnings.extend(w)
            return f"```{lang}\n{new_code}\n```"
        return m.group(0)

    return re.sub(r'```(\w*)\n(.*?)```', replace_block, text, flags=re.DOTALL), all_warnings


def _extract_dql(text: str) -> str | None:
    match = re.search(r'```(?:dql|DQL)\n(.*?)```', text, re.DOTALL)
    return match.group(1).strip() if match else None


# ── Entity detection ──────────────────────────────────────────────────────────

def _detect_entities(results: list[dict]) -> set[str]:
    if not results:
        return set()
    all_keys = {k.lower() for row in results for k in row.keys()}
    entities = set()
    if all_keys & _HOST_FIELDS: entities.add('host')
    if all_keys & _USER_FIELDS: entities.add('user')
    if all_keys & _IP_FIELDS:   entities.add('ip')
    return entities


# ── Insight generation ────────────────────────────────────────────────────────

async def _stream_insights(
    llm: LLMClient,
    original_query: str,
    dql: str,
    results: list[dict],
    total: int,
) -> AsyncIterator[str]:
    sample = results[:5]
    system = (
        "You are a DNIF SIEM security analyst reviewing query results. "
        "Provide a response in exactly two sections:\n\n"
        "**Insights**\n"
        "- 2-3 concise bullet points on what is notable, anomalous, or significant in the data\n\n"
        "**Suggested Next Steps**\n"
        "- 3 specific, actionable follow-up investigation questions\n\n"
        "Be concise. Use security analyst language. Under 200 words total."
    )
    user_content = (
        f"Original query: {original_query}\n"
        f"DQL executed: {dql}\n"
        f"Total records returned: {total}\n"
        f"Sample results (up to 5 rows):\n{json.dumps(sample, indent=2, default=str)}"
    )
    async for token in llm.stream_complete(system=system, messages=[{"role": "user", "content": user_content}]):
        yield token


# ── Main skill entry point ─────────────────────────────────────────────────────

async def run(
    query: str,
    llm: LLMClient,
    stream_name: str | None = None,
    duration: str | None = None,
) -> AsyncIterator[CopilotEvent]:

    yield CopilotEvent(type=EventType.THINKING, content="Understanding your query...")
    yield CopilotEvent(type=EventType.SKILL,    content="translate_to_dql")

    # ── Clarify only when genuinely needed ───────────────────────────────────
    stream_ambiguous  = _is_stream_ambiguous(query)
    duration_missing  = not duration and not _DURATION_RE.search(query)
    requested_limit   = _get_requested_limit(query)
    limit_exceeded    = requested_limit is not None and requested_limit > MAX_RECORDS

    if stream_ambiguous or duration_missing or limit_exceeded:
        payload: dict = {"original_query": query, "missing": []}
        if stream_ambiguous:
            payload["missing"].append("stream")
            payload["stream"] = _CLARIFY_STREAM
        if duration_missing:
            payload["missing"].append("duration")
            payload["duration"] = _CLARIFY_DURATION
        if limit_exceeded:
            payload["missing"].append("limit")
            payload["limit"] = {**_CLARIFY_LIMIT, "requested": requested_limit}
        yield CopilotEvent(type=EventType.CLARIFY, content=json.dumps(payload))
        return

    system = "\n\n---\n\n".join([load_system_prompt(), load_skill_prompt("translate_to_dql")])

    dql_kb = load_dql_kb()
    user_content = (
        f"Here is the DQL knowledge base for reference:\n\n<dql_kb>\n{dql_kb}\n</dql_kb>\n\n"
        f"User query: {query}"
    )
    if stream_name:
        user_content += f"\nTarget stream: {stream_name}"
        ddm_fields = load_stream_ddm(stream_name)
        if ddm_fields:
            user_content += (
                f"\n\nAvailable fields for the `{stream_name}` stream "
                f"(use lowercase in queries):\n{ddm_fields}"
            )
    if duration:    user_content += f"\nDuration specified: {duration}"

    date_context = _resolve_relative_dates(query)
    if date_context:
        user_content += f"\n\nDate context — use these exact dates when generating DQL:\n{date_context}"

    # ── Stream LLM response ──────────────────────────────────────────────────
    yield CopilotEvent(type=EventType.THINKING, content="Generating DQL query...")

    full_response = ""
    async for token in llm.stream_complete(system=system, messages=[{"role": "user", "content": user_content}]):
        full_response += token
        yield CopilotEvent(type=EventType.CONTENT, content=token)

    # ── Guardrails ───────────────────────────────────────────────────────────
    modified_response, guardrail_warnings = _apply_guardrails_to_response(full_response)
    for warning in guardrail_warnings:
        yield CopilotEvent(type=EventType.RESULT, content=warning)

    # ── Extract DQL ──────────────────────────────────────────────────────────
    dql_query = _extract_dql(modified_response)
    if not dql_query:
        yield CopilotEvent(
            type=EventType.ERROR,
            content="Could not extract a DQL query from the response. Please try rephrasing your question.",
        )
        return

    # ── Layer 2: DQL output guard ────────────────────────────────────────────
    dql_block = check_dql(dql_query)
    if dql_block:
        yield CopilotEvent(type=EventType.BLOCKED, content=dql_block)
        return

    # ── Execute against DNIF ─────────────────────────────────────────────────
    yield CopilotEvent(
        type=EventType.WAITING,
        content="Executing query in DNIF... this may take a moment.",
    )

    try:
        execution_result = await dnif_client.execute_dql(dql_query)
    except Exception as e:
        yield CopilotEvent(type=EventType.ERROR, content=f"DNIF execution failed: {str(e)}")
        for skill_id, description in DOWNSTREAM_SKILLS:
            yield CopilotEvent(type=EventType.SUGGEST, content=f"{skill_id}:Would you like me to {description}?")
        return

    # ── Stub path ────────────────────────────────────────────────────────────
    if execution_result.get("status") == "stub":
        yield CopilotEvent(
            type=EventType.RESULT,
            content="**Query ready.** DNIF API is disabled — set `DNIF_API_ENABLED=true` to execute.",
        )
        for skill_id, description in DOWNSTREAM_SKILLS:
            yield CopilotEvent(type=EventType.SUGGEST, content=f"{skill_id}:Would you like me to {description}?")
        return

    # ── Real results path ────────────────────────────────────────────────────
    results = execution_result.get("results", [])
    total   = execution_result.get("total_records", len(results))

    yield CopilotEvent(
        type=EventType.RESULT,
        content=f"Query executed. **{total} record(s)** returned.",
    )

    if results:
        # Stream LLM-generated insights
        yield CopilotEvent(type=EventType.CONTENT, content="\n\n---\n\n")
        async for token in _stream_insights(llm, query, dql_query, results, total):
            yield CopilotEvent(type=EventType.CONTENT, content=token)

        # Emit TABLE event for collapsible UI table
        table_payload = json.dumps(
            {"results": results, "total": total, "shown": len(results)},
            default=str,
        )
        yield CopilotEvent(type=EventType.TABLE, content=table_payload)

        # Entity-based module integration suggestions
        entities = _detect_entities(results)
        for entity in ('host', 'user', 'ip'):   # deterministic order
            if entity in entities:
                skill_id, label = _ENTITY_SUGGESTS[entity]
                yield CopilotEvent(type=EventType.SUGGEST, content=f"{skill_id}:{label}")
    else:
        yield CopilotEvent(
            type=EventType.CONTENT,
            content="\n\nNo records matched your query. Try broadening the time range or adjusting your filters.",
        )

    # Downstream skill suggestions
    for skill_id, description in DOWNSTREAM_SKILLS:
        yield CopilotEvent(type=EventType.SUGGEST, content=f"{skill_id}:Would you like me to {description}?")
