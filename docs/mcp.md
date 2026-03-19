# BLOO Copilot MCP Server

Connect Claude to your Bloo Hypercloud environment. BLOO Copilot exposes security analytics skills as MCP tools, allowing Claude to query live security telemetry, answer platform questions, and analyse results — all from within a Claude conversation.

---

## Overview

| Property | Value |
|---|---|
| **Transport** | Streamable HTTP (MCP spec 2025-03-26) |
| **Default endpoint** | `http://localhost:8000/mcp/` |
| **Protocol** | JSON-RPC 2.0 |
| **Auth** | Optional — `X-API-Key` header (configurable) |
| **MCP SDK version** | `mcp >= 1.0.0` |

### What you can do

- **Query security events** in natural language — failed logins, blocked traffic, DNS anomalies, endpoint activity, and more
- **Answer platform questions** about Bloo Hypercloud — features, modules, pricing, integrations
- **Read KB files** — DQL reference, stream definitions, platform knowledge base
- **Use skill prompts** — prime Claude with skill-specific context before calling a tool
- **Switch LLM providers per call** — use Anthropic or OpenAI on demand

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Python 3.11+ | Required to run the backend server |
| BLOO Copilot server | Clone and set up from the repository |
| Anthropic or OpenAI API key | At least one LLM provider must be configured |
| DNIF API access | Optional — required for live telemetry queries |
| Claude Code | `claude mcp add` command available |

---

## Setup

### 1. Install dependencies

```bash
cd bloo-copilot
python -m venv b-copilot-env
source b-copilot-env/bin/activate        # Windows: b-copilot-env\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your credentials:

```env
# LLM — at least one required
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# DNIF API — optional, enables live telemetry queries
DNIF_API_ENABLED=false
DNIF_CONSOLE_DOMAIN=your-console.dnif.it
DNIF_CLUSTER_ID=your-cluster-id
DNIF_API_TOKEN=your-token

# MCP — optional API key for access control
MCP_API_KEY=                             # leave blank to disable auth
```

### 3. Start the server

```bash
b-copilot-env/bin/uvicorn server.main:app --port 8000
```

Confirm it is running:

```bash
curl http://localhost:8000/health
# {"status": "ok"}
```

### 4. Register with Claude Code

```bash
claude mcp add --transport http bloo-copilot http://localhost:8000/mcp/
```

Verify the connection:

```bash
claude mcp list
# bloo-copilot: http://localhost:8000/mcp/ (HTTP) - ✓ Connected
```

---

## Tools

All tools enforce the same security guardrails as the chat widget — destructive operations, jailbreak attempts, system probes, and bulk exfiltration are blocked at the input layer before any LLM or DNIF call is made.

---

### `translate_to_dql`

Translates a natural language security question into a DQL query, executes it against DNIF, and returns results with AI-generated insights.

Use this for any request to search, investigate, or analyse security events.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | string | ✅ | Natural language security question |
| `stream_name` | string | — | DNIF stream to target (e.g. `authentication`, `firewall`). Omit to let the skill infer from context. |
| `duration` | string | — | Time range override (e.g. `1h`, `24h`, `3d`). Omit if stated in the query. |
| `provider` | string | — | LLM provider: `anthropic` or `openai`. Defaults to server config. |

**Example prompts**

```
Show failed login attempts in the last hour
Which firewall IPs were blocked in the last 24 hours?
List users with failed logins in the last 3 days — use openai
Show DNS queries to unusual domains in the last 6 hours
```

**Example tool call**

```json
{
  "query": "show failed login attempts in the last hour",
  "stream_name": "authentication",
  "provider": "openai"
}
```

**Example response**

```
DQL: stream=authentication where action='LOGIN' and status='FAILED' | duration 1h | limit 20

Result: 20 record(s) returned.

Insights:
- All failures originate from external IPs targeting SMTP-MTA2 (Mimecast)
- Two source ASNs: TEAM-HOST RU and OVH SAS CA — typical abuse infrastructure
- Failure reasons split between "App disabled" and "Account disabled" — suggests
  credential stuffing against harvested account lists, not targeted attacks

Suggested next steps:
1. Pivot on source IPs over a longer timeframe to detect spray patterns
2. Check for any successful logins from the same IPs
3. Enumerate whether targeted accounts are still active
```

---

### `platform_faq`

Answers questions about the Bloo Hypercloud security platform using a curated knowledge base scraped from bloo.io.

Use this for any question about what Bloo is, how it works, its modules, pricing, integrations, leadership, or blog content. Do **not** use this for querying security telemetry.

**Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `question` | string | ✅ | Platform question |
| `provider` | string | — | LLM provider: `anthropic` or `openai`. Defaults to server config. |

**Example prompts**

```
What is Bloo Hypercloud?
Tell me about Bloo's leadership team
What does b-ueba do?
What are Bloo's pricing tiers?
What blogs has Bloo published on threat intelligence?
```

**Example tool call**

```json
{
  "question": "What is the Bloo platform and who leads it?",
  "provider": "anthropic"
}
```

---

### `explain_signal` *(coming in Phase 2)*

Explains what a DNIF alert or signal means in plain English — severity, likely cause, and recommended immediate actions.

| Parameter | Type | Description |
|---|---|---|
| `signal_id` | string | Signal or alert ID from the DNIF console |
| `signal_data` | string | Optional raw signal JSON or description |

---

### `suggest_investigation` *(coming in Phase 2)*

Given a security signal, suggests ordered next investigation steps — what to look for, which streams to query, and what to pivot on.

| Parameter | Type | Description |
|---|---|---|
| `signal` | string | Signal description or ID |
| `context` | string | Optional context: user, host, IP, timeframe |

---

### `threat_hunt` *(coming in Phase 2)*

Generates DQL queries for proactive threat hunting based on a MITRE ATT&CK tactic or technique.

| Parameter | Type | Description |
|---|---|---|
| `tactic` | string | MITRE ATT&CK tactic (e.g. `Lateral Movement`, `Persistence`) |
| `technique` | string | Optional technique (e.g. `T1078 - Valid Accounts`) |

---

### `suggest_visualization` *(coming in Phase 2)*

Recommends the best chart type and field mappings for visualising a DQL query's results in a DNIF dashboard.

| Parameter | Type | Description |
|---|---|---|
| `dql` | string | The DQL query whose results you want to visualise |

---

### `incident_response` *(coming in Phase 2)*

Provides a NIST CSF-aligned incident response guide for a given attack type — identification, containment, eradication, recovery, and lessons learned.

| Parameter | Type | Description |
|---|---|---|
| `attack_type` | string | Attack or incident type (e.g. `ransomware`, `phishing`, `brute force`) |

---

### `executive_summary` *(coming in Phase 2)*

Summarises security findings in plain, non-technical language for C-suite and board-level stakeholders.

| Parameter | Type | Description |
|---|---|---|
| `findings` | string | Security findings or investigation summary to translate |

---

### `refresh_kb` *(coming in Phase 3)*

Triggers a full rescrape of bloo.io and updates the platform knowledge base. Same operation as the automatic weekly scheduled job.

| Parameter | Type | Description |
|---|---|---|
| *(none)* | — | No inputs required |

---

## Resources

Resources let Claude read KB files directly without a tool call — useful for priming context before generating queries or answering platform questions.

| URI | Contents |
|---|---|
| `bloo://kb/dql-reference` | Full DQL reference — syntax, keywords, operators, stream field names, aggregate functions, examples |
| `bloo://kb/dql-quick-ref` | Compact DQL quick-reference card — essential syntax for most security queries |
| `bloo://kb/bloo-platform` | Bloo platform KB — overview, modules, features, pricing, integrations, blog summaries |
| `bloo://kb/stream-definitions` | DNIF stream and action definitions — field schemas for authentication, firewall, DNS, endpoint, NTA, and more |

---

## Prompts

Prompt templates prime Claude with a skill's persona and instructions before calling the corresponding tool. Invoke via `/mcp` in Claude Code.

| Prompt name | Description |
|---|---|
| `bloo_system` | Master system prompt — BLOO Copilot identity, scope, and absolute restrictions |
| `translate_to_dql_prompt` | DQL syntax rules, stream field names, guardrail constraints, example query formats |
| `platform_faq_prompt` | Platform KB answer guidelines, tone, and response format |
| `explain_signal_prompt` | Signal interpretation methodology and analyst communication style |
| `suggest_investigation_prompt` | Investigation methodology, pivot strategies, MITRE ATT&CK alignment |
| `threat_hunt_prompt` | Hunting query generation from MITRE tactics and techniques |
| `incident_response_prompt` | NIST CSF phases, response playbook structure, escalation guidance |
| `executive_summary_prompt` | Tone, language level, and structure for C-suite security summaries |

---

## Security

### Guardrail Layers

Every tool call passes through the same three-layer guardrail system as the chat widget:

| Layer | Where | What it blocks |
|---|---|---|
| **Layer 1 — Input guard** | Before LLM call | Destructive operations, jailbreak attempts, system probes, bulk exfiltration — matched by regex patterns |
| **Layer 1.5 — LLM classifier** | After Layer 1 passes | Novel threats not covered by regex — semantic classification via a lightweight model |
| **Layer 2 — DQL output guard** | Before DNIF execution | Write operations in generated DQL (`INSERT`, `DELETE`, `DROP`, `TRUNCATE`, etc.) |

When a guardrail fires, the tool returns a `🚫` message explaining the block reason. No LLM call or DNIF query is made.

### Audit Log

All blocked requests are written to `guardrail.log`:

```
2026-03-18 09:41:22  WARNING  BLOCKED  trigger=destructive_operation  hash=a3f1b2c4d5e6f7a8  len=42
```

Raw query text is never stored — only a SHA-256 hash prefix, trigger name, and input length.

### API Key Authentication

Set `MCP_API_KEY` in `.env` to require an `X-API-Key` header on all `/mcp/` requests:

```env
MCP_API_KEY=your-secret-key
```

Register in Claude Code with the key:

```bash
claude mcp add --transport http bloo-copilot http://localhost:8000/mcp/ \
  --header "X-API-Key: your-secret-key"
```

Leave `MCP_API_KEY` blank to disable auth (suitable for local development).

---

## Query Constraints

These limits are enforced at the prompt, skill, and guardrail levels — they cannot be bypassed through conversation or tool arguments:

| Constraint | Limit | Behaviour |
|---|---|---|
| Result set | 20 records | `limit 20` appended automatically |
| Duration | 3 days max | Clipped to `3d` if exceeded; user notified |
| Operations | Read-only | All write, delete, and schema operations are blocked |

---

## Configuration Reference

All settings are loaded from `.env` in the project root:

```env
# LLM
LLM_PROVIDER=anthropic                  # default provider: anthropic | openai
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1

# DNIF
DNIF_API_ENABLED=false
DNIF_CONSOLE_DOMAIN=
DNIF_CLUSTER_ID=
DNIF_API_TOKEN=
DNIF_SCOPE_ID=training
DNIF_TIMEZONE=Asia/Kolkata
DNIF_POLL_INTERVAL=5                    # seconds between query status polls
DNIF_MAX_WAIT_TIME=180                  # max seconds to wait for query result

# Speech (Voice input)
WHISPER_MODEL=whisper-1

# Paths
KB_PATH=kb
PROMPTS_PATH=prompts

# MCP
MCP_API_KEY=                            # blank = no auth required

# Guardrails
GUARDRAIL_AUTO_PROMOTE=true
GUARDRAIL_AUTO_PROMOTE_THRESHOLD=0.95
GUARDRAIL_CLASSIFIER_MODEL=claude-haiku-4-5-20251001

# KB Refresh
KB_REFRESH_ENABLED=true
KB_REFRESH_SCHEDULE=weekly
KB_REFRESH_DAY=sunday
KB_REFRESH_HOUR=0
```

---

## Troubleshooting

### `✗ Failed to connect` in `claude mcp list`

The bloo-copilot server is not running. Start it:

```bash
b-copilot-env/bin/uvicorn server.main:app --port 8000
```

---

### `Not Acceptable: Client must accept text/event-stream`

The server was started without `json_response=True`. This is set automatically in `server/mcp/server.py` — ensure you are running the latest version of the code.

---

### `Not Acceptable: Client must accept application/json`

The request is missing the `Accept: application/json` header. This is handled automatically by Claude Code — if testing manually via `curl`, add:

```bash
-H "Accept: application/json"
```

---

### `DNIF execution failed`

- Confirm `DNIF_API_ENABLED=true` in `.env`
- Confirm `DNIF_CONSOLE_DOMAIN`, `DNIF_CLUSTER_ID`, and `DNIF_API_TOKEN` are set correctly
- Test connectivity: `curl http://localhost:8000/dnif/test`

---

### Tool returns `🚫 Blocked`

The input triggered a guardrail. BLOO Copilot is a **read-only** security analytics assistant — write operations, identity overrides, prompt disclosure, and bulk data exports are not permitted. Rephrase the request as a read query.

---

## Usage Examples

### In Claude Code

After registering the server, start a Claude Code session and ask directly:

```
> Show me failed logins in the last hour
> Which users had the most failed login attempts in the last 3 days?
> What is Bloo's b-ueba module?
> Tell me about Bloo's recent threat intelligence blogs — use anthropic
> List blocked firewall IPs in the last 24 hours — use openai
```

Claude will automatically select the appropriate tool (`translate_to_dql` or `platform_faq`), call it, and present the results with insights.

### Specifying a provider

Add `use anthropic` or `use openai` to any prompt to override the default LLM for that query:

```
Show DNS anomalies in the last 6 hours — use openai
What is Bloo's pricing? — use anthropic
```

### Testing via curl

```bash
# Initialize session
curl -s -X POST http://localhost:8000/mcp/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "test", "version": "0.1" }
    }
  }'

# List available tools
curl -s -X POST http://localhost:8000/mcp/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}'
```

---

## File Structure

```
bloo-copilot/
├── server/
│   └── mcp/
│       ├── __init__.py        # imports tools, resources, prompts to trigger registration
│       ├── server.py          # FastMCP instance, HTTP transport, optional auth middleware
│       ├── tools.py           # skill registrations with input schemas and guardrail wiring
│       ├── resources.py       # KB file registrations with bloo:// URIs
│       └── prompts.py         # skill prompt template registrations
├── server/main.py             # mounts MCP server at /mcp/, starts session manager lifespan
├── docs/
│   ├── mcp.md                 # this document
│   └── b-copilot.md           # full architecture and design reference
└── .env                       # environment configuration
```

---

## Related

- [BLOO Copilot Architecture](b-copilot.md) — full design document covering skills, guardrails, KB refresh, dynamic guardrail learning, and roadmap
- [DNIF DQL Reference](../kb/dql-kb.md) — complete DQL syntax and field reference
- [MCP Specification](https://modelcontextprotocol.io) — Anthropic's Model Context Protocol
