# BLOO Copilot

AI-powered security assistant for **Bloo Hypercloud** — DNIF's cloud-native SIEM platform. Helps security analysts (L1–L3), DNIF admins, and C-Suite move from raw telemetry to actionable insight through natural language.

---

## Architecture Overview

```
┌──────────────────────────────────────────┐
│           React Widget (Vite + TS)        │
│  Chat UI · SSE streaming · Skill chips    │
└─────────────────┬────────────────────────┘
                  │ HTTP/SSE
┌─────────────────▼────────────────────────┐
│         FastAPI Server (Python)           │
│  /copilot/chat  ·  SSE event stream       │
│                                           │
│  Orchestrator → Skill DAG                 │
│  LLM Abstraction (Anthropic / OpenAI)     │
└──────┬─────────────────┬─────────────────┘
       │                 │
┌──────▼──────┐   ┌──────▼──────────────────┐
│  DNIF API   │   │  Knowledge Base           │
│  invoke →   │   │  DQL KB · system prompt   │
│  poll →     │   │  skill prompts            │
│  results    │   └─────────────────────────-┘
└─────────────┘
```

---

## Agentic Skill DAG

Skills chain automatically — after each response, the copilot offers contextual next steps:

```
platform_faq
     └──→ translate_to_dql
               ├──→ suggest_visualization
               ├──→ suggest_investigation ──→ threat_hunt ──→ executive_summary
               │         └──────────────────→ incident_response ──→ executive_summary
               ├──→ incident_response ──→ executive_summary
               └──→ threat_hunt ──→ executive_summary

explain_signal
     ├──→ threat_hunt ──→ executive_summary
     └──→ suggest_investigation ──→ (same as above)
```

**Chaining strategy:** Phase 1 = copilot proactively offers next steps via skill chips. Phase 2 = intent classifier determines full chain upfront and runs autonomously.

---

## Skills

| Skill | Description |
|---|---|
| `translate_to_dql` | Natural language → DQL query, executes against DNIF, returns AI insights + results table |
| `explain_signal` | Explain what an alert/signal means in plain English |
| `suggest_investigation` | Given a signal, suggest next investigation steps |
| `suggest_visualization` | Recommend chart type + fields for a DQL result set |
| `threat_hunt` | Suggest DQL queries for a given MITRE tactic/technique |
| `platform_faq` | Answer DNIF console how-to questions |
| `incident_response` | Guide through NIST CSF phases for a given attack type |
| `executive_summary` | Summarize security posture in plain language for C-Suite |

### Module Integrations (Phase 3+)

| Module | Trigger | What it provides |
|---|---|---|
| `b_epm` | Host/device fields detected in results | Endpoint telemetry — process trees, file activity, registry changes |
| `b_ueba` | User/account fields detected in results | Behavioral baselines, anomaly scores, peer group comparisons |
| `b_nbad` | IP fields detected in results | Network traffic anomalies, lateral movement indicators, C2 patterns |

---

## SSE Event Types

All responses stream over Server-Sent Events. The widget renders each event type differently:

| Event | Description | UI |
|---|---|---|
| `thinking` | Copilot status narration | Collapsible reasoning section |
| `skill` | Skill being invoked | Monospace badge |
| `waiting` | Async op in progress (DQL executing) | Amber badge |
| `content` | Streaming LLM tokens | Main response body (markdown) |
| `result` | Structured outcome / guardrail warning | Green/red result box |
| `table` | JSON-encoded query results | Collapsible results table |
| `suggest` | Downstream skill suggestion | Clickable skill chip |
| `error` | Something went wrong | Red error box |
| `done` | Stream complete | — |

---

## Query Guardrails

Enforced at prompt level and in skill code as a safety net:

| Guardrail | Limit | Behaviour |
|---|---|---|
| Duration | Max **3 days** | Auto-clipped to `3d`, user notified |
| Result set | Max **20 records** | `limit 20` appended, user notified |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Python 3.13 + FastAPI + sse-starlette |
| LLM | Anthropic (`claude-sonnet-4-6`) · OpenAI (`gpt-4.1`) |
| DNIF API | REST — invoke → poll → results |
| Config | pydantic-settings + `.env` |

---

## Setup

### Backend

```bash
cd bloo-copilot
python -m venv b-copilot-env && source b-copilot-env/bin/activate
pip install -r requirements.txt

# Copy and fill in credentials
cp .env.example .env   # edit with your keys

# Run
PYTHONPATH=. uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```bash
cd widget
npm install
npm run dev   # http://localhost:5173
```

---

## API Reference

Interactive Swagger UI is available at **`http://localhost:8000/docs`** when the server is running.

The OpenAPI spec is also exported at [`docs/openapi.json`](docs/openapi.json) — import it into:
- [Swagger Editor](https://editor.swagger.io) — paste the JSON for interactive docs
- Postman — *Import → Raw text* → paste `docs/openapi.json`
- Any OpenAPI-compatible tool

### Key endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/copilot/chat` | Main chat endpoint — streams SSE events |
| `GET` | `/dnif/test` | Test DNIF API connectivity |
| `POST` | `/copilot/kb/reload` | Hot-reload knowledge base |
| `GET` | `/health` | Health check |

#### Example request

```bash
curl -X POST http://localhost:8000/copilot/chat \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"query": "show me failed SSH logins in the last hour", "provider": "anthropic"}'
```

---

## Environment Variables

```env
# LLM
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-6
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1

# DNIF API
DNIF_API_ENABLED=true
DNIF_CONSOLE_DOMAIN=...
DNIF_CLUSTER_ID=...
DNIF_API_TOKEN=...
DNIF_SCOPE_ID=...
DNIF_TIMEZONE=Asia/Kolkata
DNIF_POLL_INTERVAL=5
DNIF_MAX_WAIT_TIME=180
```

---

## Roadmap

| Phase | Status | What |
|---|---|---|
| 1 | ✅ Done | `translate_to_dql` + SSE streaming + React widget |
| 2 | ✅ Done | DNIF API client (invoke → poll → results) + AI insights + results table |
| 3 | 🔜 Next | All 8 skills + b-epm / b-ueba / b-nbad integrations |
| 4 | 🔜 | MCP server + tool registry |
| 5 | 🔜 | b-soar integration (threat intel + automated response) |
| 6 | 🔜 | Intent classifier — autonomous skill chain execution |
