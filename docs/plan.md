# BLOO Copilot — Implementation Plan

> Working document. Supersedes the build phases in b-copilot.md where they conflict.
> Last updated: 2026-03-19

---

## 1. Scope & Goals

The copilot serves users inside the DNIF console. A single deployment scope can have multiple
concurrent users. Every query goes through guardrails, is routed to the right skill graph, and
may chain across multiple skills autonomously — pausing for user input where needed.

Three major query categories drive the entire skill and graph design:

| # | Category | Nature |
|---|---|---|
| 1 | **Platform FAQ** | Informational + navigational; answers from KB or routes the UI |
| 2A | **Threat Detections** | Investigative; DQL → enrich → triage → respond |
| 2B | **Operational Queries** | Health and usage monitoring; DQL-based |
| 2C | **Analytics** | Data exploration, patterns, distributions, reports |

---

## 2. Skill Taxonomy

### Category 1 — Platform FAQ

| Skill | Description |
|---|---|
| `platform_faq` | Company info, blogs, research, pricing, integrations — KB RAG from bloo-platform.md |
| `product_guide` | How-to guidance for any product page or feature (workbooks, extractors, models, playbooks, connectors) |
| `page_navigator` | Routes the user to a specific console page (signals, workbooks, UEBA, etc.) |
| `page_context_advisor` | Reads current page context passed by the frontend, offers leading questions and next actions |
| `workbook_builder` | Step-by-step guided workflow for building a DNIF detection rule / workbook |
| `extractor_builder` | Guided extractor creation — field mapping, regex, test against sample log |
| `playbook_builder` | Guided playbook / response automation creation |
| `model_advisor` | Guidance on anomaly model configuration, tuning, and baselines (UEBA / NBAD) |

**Page context the frontend can pass:**
- Landing dashboard → offer: top threats summary, stream health, quick investigation
- Signals page → offer: explain this signal, triage, similar signals, IR guide
- Workbook page → offer: build a rule for X, explain this rule, test rule against data
- Data sources page → offer: set up extractor, check source health, test connector
- UEBA pages (threat dashboard, baselines, anomaly models, anomaly rules) → offer: explain anomaly, tune model, compare baseline, peer group analysis
- NBAD pages → offer: investigate network behaviour, explain connection pattern
- EPM pages → offer: investigate host activity, process timeline, lateral movement check

---

### Category 2A — Threat Detections

| Skill | Description |
|---|---|
| `translate_to_dql` | Natural language → DQL → execute → stream results |
| `enrich_ioc` | Enrich IPs, domains, hashes with VirusTotal, AbuseIPDB, reputation feeds |
| `mitre_lookup` | Map detected activity to MITRE ATT&CK tactics and techniques |
| `cve_lookup` | Enrich CVE IDs found in results with severity, patch status, affected products |
| `correlate_signals` | Run parallel DQL queries across related streams to reconstruct an attack timeline |
| `triage_user` | UEBA check — user risk score, anomaly history, peer group deviation |
| `triage_entity` | UEBA entity baseline — entity risk, behaviour deviation |
| `triage_host` | EPM host investigation — process tree, file activity, network connections |
| `triage_ip` | NBAD IP investigation — connection patterns, protocol anomalies, geolocation |
| `suggest_visualization` | Recommend chart type and field mappings for dashboard widgets |
| `incident_response` | NIST CSF-aligned IR guide: identify → contain → eradicate → recover → lessons |
| `executive_summary` | Non-technical C-suite summary of findings, risk level, and recommended actions |

**Suggested additions:**
- `threat_hunt` — proactive MITRE-based hunting queries across streams
- `explain_signal` — plain-English explanation of a specific DNIF signal/alert
- `false_positive_check` — analyse if a signal pattern is likely a false positive based on history

---

### Category 2B — Operational Queries

| Skill | Description |
|---|---|
| `translate_to_dql` | Reused — operational DQL queries use the same skill |
| `stream_health` | Ingestion rate, parsing success rate, last-seen timestamp per stream |
| `source_health` | Connectivity status of data sources, last event received, extractor errors |
| `usage_analytics` | Event volume trends, storage usage, top sources by volume, ingestion lag |

**Suggested additions:**
- `alert_volume_trend` — alert/signal counts over time, spike detection
- `extractor_health` — parsing failure rates, field extraction accuracy per extractor
- `data_gap_detection` — identify streams with unexpected silence or drops in ingestion

---

### Category 2C — Analytics on Data

| Skill | Description |
|---|---|
| `translate_to_dql` | Reused — analytics queries are standard DQL with groupby/timeslice |
| `field_distribution` | Analyse value distribution of a specific field across a stream |
| `time_series_analysis` | Trend lines, rolling averages, anomaly spikes over a time period |
| `compliance_report` | Generate a structured compliance-oriented report (login attempts, privilege changes, etc.) |

**Suggested additions:**
- `data_quality_report` — missing fields, null rates, cardinality stats per stream
- `peer_comparison` — compare a user/host/IP against its peer group baseline
- `top_n_report` — top N users/IPs/hosts by a chosen metric (failed logins, bytes sent, etc.)

---

## 3. LangGraph Architecture

### 3.1 Design Principles

1. **One graph per workflow** — not one monolithic graph. Each major entry skill has its own
   `StateGraph`. The `WorkflowRegistry` (pattern from angie-og-copilot) maps skill name → graph class.

2. **Shared state via TypedDict** — every node in a workflow reads from and writes to a typed
   state object. No ad-hoc argument passing between nodes.

3. **Dynamic routing via conditional edges** — routing decisions are made at runtime based on
   what previous nodes produced (entities found, threat level, user choice). Not hardcoded.

4. **`interrupt()` for user decisions** — graph pauses mid-execution, emits a SUGGEST/CLARIFY
   SSE event, and resumes when the user picks an option. State is preserved across the pause.

5. **`MemorySaver` per thread** — conversation history and mid-graph state are checkpointed
   per `thread_id`. Resuming a paused graph = calling the graph again with the same `thread_id`.

6. **Parallel nodes via `Send()`** — enrichment tasks (VirusTotal, MITRE, CVE) and triage tasks
   (user, host, IP) run concurrently, not sequentially.

---

### 3.2 Shared State Design

```python
class CopilotState(TypedDict):
    # Input
    user_query:       str
    session_id:       str
    user_id:          str
    page_context:     dict | None        # current console page + data passed by frontend
    provider:         str                # "anthropic" | "openai" | "local"
    model_tier:       str                # "fast" | "standard" | "deep"

    # Guardrail
    guardrail_passed: bool
    guardrail_block:  str | None

    # Skill routing
    resolved_skill:   str
    stream_name:      str | None
    duration:         str | None

    # translate_to_dql outputs
    dql:              str | None
    dql_results:      list[dict]
    total_records:    int
    insights:         str | None

    # Enrichment outputs
    ioc_enrichment:   dict | None        # VirusTotal / reputation results
    mitre_mappings:   list[dict] | None
    cve_details:      list[dict] | None
    correlated_events: list[dict] | None

    # Triage outputs
    user_risk:        dict | None        # UEBA user triage
    entity_risk:      dict | None        # UEBA entity triage
    host_activity:    dict | None        # EPM host triage
    ip_behaviour:     dict | None        # NBAD IP triage

    # Final outputs
    ir_guide:         str | None
    executive_summary: str | None
    visualization:    dict | None

    # Flow control
    status:           str                # "running" | "waiting_user" | "done" | "blocked"
    next_suggestions: list[str]          # skills offered to user at interrupt points
    failed:           bool
    error:            str | None
```

---

### 3.3 Workflow Graphs

#### Graph 1 — Platform FAQ

```
guardrail_check
    → [blocked] → END
    → [passed]  → intent_classify_faq
                    → platform_faq          (company info, blogs, pricing)
                    → product_guide         (how-to for features)
                    → page_context_advisor  (page-aware leading questions)
                    → page_navigator        (route to a page)
                    → workbook_builder      (multi-step, uses interrupt())
                    → extractor_builder     (multi-step, uses interrupt())
                    → playbook_builder      (multi-step, uses interrupt())
                    → model_advisor
```

`workbook_builder`, `extractor_builder`, `playbook_builder` are multi-turn workflows.
Each step emits a CLARIFY event and `interrupt()`s. The graph resumes at the same node
with user input in state. MemorySaver preserves progress across turns.

---

#### Graph 2 — Threat Detection (most complex)

```
guardrail_check
    → [blocked] → END
    → [passed]  → translate_and_execute
                    → [no results] → END (suggest broadening query)
                    → [results]    → interrupt("Threats found. Enrich and investigate?")
                                   → [user confirms] →

                        ┌─────────────────────────────────────┐
                        │  Parallel enrichment (Send() API)    │
                        │  enrich_ioc  |  mitre_lookup  |  cve │
                        └──────────────┬──────────────────────┘
                                       ↓
                              correlate_signals
                                       ↓
                        interrupt("Which entities to triage?")
                                       ↓
                        ┌─────────────────────────────────────┐
                        │  Conditional parallel triage         │
                        │  triage_user  (if users in results)  │
                        │  triage_host  (if hosts in results)  │
                        │  triage_ip    (if IPs in results)    │
                        └──────────────┬──────────────────────┘
                                       ↓
                        interrupt("Generate IR guide or summary?")
                                       ↓
                        ┌───────────────────┐
                        │ incident_response │
                        │ executive_summary │  (parallel)
                        │ suggest_viz       │
                        └───────────────────┘
                                       ↓
                                      END
```

**Dynamic routing rules:**
- Enrichment nodes only run if results contain IPs / domains / hashes
- `triage_user` only runs if `user` field present in results
- `triage_host` only runs if `host`/`hostname` field present
- `triage_ip` only runs if `src_ip`/`dst_ip` field present
- User can skip any interrupt step to short-circuit to summary

---

#### Graph 3 — Operational Query

```
guardrail_check
    → translate_and_execute
        → [stream health query]  → stream_health
        → [source health query]  → source_health
        → [usage/volume query]   → usage_analytics
        → [raw DQL]              → present results + suggest_visualization
```

Routing from `translate_and_execute` uses a lightweight classifier node that reads
the query intent and result shape to decide the next node.

---

#### Graph 4 — Analytics

```
guardrail_check
    → translate_and_execute
        → [distribution query]   → field_distribution
        → [time-series query]    → time_series_analysis
        → [compliance query]     → compliance_report
        → [peer comparison]      → peer_comparison
        → [top-N query]          → top_n_report
        → [raw data retrieval]   → present results + suggest_visualization
    → executive_summary (optional, on interrupt)
```

---

### 3.4 Dynamic Flow — How It Works

Conditional edges in LangGraph take the state and return the name of the next node.
This makes all routing decisions data-driven:

```python
def route_after_translate(state: CopilotState) -> str | list[str]:
    if not state["dql_results"]:
        return "no_results_node"
    entities = _detect_entities(state["dql_results"])
    if entities:
        return "enrich_ioc"   # threats found, go to enrichment
    return "present_results"  # clean data, just show it

def route_triage(state: CopilotState) -> list[str]:
    # Returns multiple targets for parallel execution via Send()
    targets = []
    if "user" in state.get("entities", set()):  targets.append("triage_user")
    if "host" in state.get("entities", set()):  targets.append("triage_host")
    if "ip"   in state.get("entities", set()):  targets.append("triage_ip")
    return targets or ["present_results"]
```

---

## 4. Guardrails Integration

Guardrails run as the **first node in every graph** — no query ever reaches a skill node
without passing through `guardrail_check_node`.

```
Layer 1   — Regex (~0ms, sync)
              Blocks: destructive ops, jailbreaks, system probes, bulk exfiltration
              Auto-promotes high-confidence LLM hits back into regex (no restart needed)

Layer 1.5 — LLM classifier (~300ms, async, Haiku)
              Covers all 4 threat classes
              confidence ≥ 0.95 → auto-promote to Layer 1 immediately
              confidence 0.80–0.94 → block + gap log for manual review

Layer 2   — DQL write guard (inside translate_to_dql node only)
              Validates generated DQL is read-only before execution
```

Guardrail state fields (`guardrail_passed`, `guardrail_block`) are part of `CopilotState`.
The entry edge checks `guardrail_passed` to route to `END` or continue.

---

## 5. Session Management

### Thread ID Design

Each user session maps to a LangGraph `thread_id`:

```
thread_id = f"{scope_id}:{user_id}:{session_id}"
```

- `scope_id` — the DNIF deployment/tenant (isolates multi-tenant data)
- `user_id` — the logged-in user
- `session_id` — browser session or conversation ID (rotates on "clear history")

### Checkpointer Strategy

| Environment | Checkpointer | Notes |
|---|---|---|
| Development | `MemorySaver` | In-memory, lost on restart |
| Production | `PostgresSaver` or `RedisSaver` | Persistent, survives restarts, horizontally scalable |

The checkpointer config is passed at graph invocation time, not baked into the graph definition.
Switching from `MemorySaver` → `PostgresSaver` requires no graph code changes.

### Clear History

User clicks "Clear conversation" → backend deletes the checkpoint for that `thread_id` and
issues a new `session_id`. The next request starts a fresh graph state.

### Conversation Memory Across Turns

Because state is checkpointed, the user can:
- Ask a follow-up ("what about the last 3 days instead?") and the graph resumes with prior DQL + results in state
- Pick a suggestion chip hours later and the graph resumes from the interrupt point
- The copilot always knows what was previously queried in the session

---

## 6. Model Strategy

### Model Tiers

| Tier | Model | Used for |
|---|---|---|
| `fast` | `claude-haiku-4-5-20251001` | Guardrail classifier, intent routing, simple FAQ, streaming tokens |
| `standard` | `claude-sonnet-4-6` | `translate_to_dql`, enrichment, triage nodes, most skills |
| `deep` | `claude-opus-4-6` | `incident_response`, `executive_summary`, `compliance_report` |

### Per-Node Model Selection

Each node declares its preferred tier. `get_model(tier, provider)` resolves to the right model:

```python
def translate_and_execute_node(state):
    model = get_model(tier=state["model_tier"] or "standard", provider=state["provider"])
    ...

def executive_summary_node(state):
    model = get_model(tier="deep", provider=state["provider"])
    ...
```

### Public / Private Toggle

| Mode | Provider | Config |
|---|---|---|
| Public | Anthropic API | `ANTHROPIC_API_KEY` |
| Public | OpenAI API | `OPENAI_API_KEY` |
| Private | Local Ollama | `OLLAMA_BASE_URL`, model name (e.g. `llama3`) |
| Private | Azure OpenAI | `AZURE_OPENAI_ENDPOINT` + deployment name |

Provider is set per-session (user can switch mid-conversation). The `provider` field in
`CopilotState` carries the choice into every node. `get_model()` abstracts the SDK differences.

### User-Facing Model Switching

Frontend sends `provider` and `model_tier` in the chat request. Users can toggle:
- "Quick answer" → `fast` tier
- "Deep analysis" → `deep` tier
- "Use private LLM" → `provider=local`

---

## 7. KB Strategy

### Current: Context Stuffing (selective)

- `dql-kb.md` — loaded fully into every `translate_to_dql` call (DQL syntax, examples)
- `bloo-platform.md` — loaded fully into every `platform_faq` call
- `kb/ddm/{STREAM}_DDM` — loaded per-call, only the resolved stream's fields (targeted retrieval)

### Why Not Vector RAG (yet)

The KBs are small and domain-specific. Full-context loading works well and has no retrieval
latency. The DDM approach (111 small files, load one per query) already solves the main
token-waste problem without a vector store.

### When to Add Vector RAG

Add a vector store (ChromaDB / pgvector) when:
1. `bloo-platform.md` grows beyond ~50K tokens
2. We add per-extractor documentation (hundreds of documents)
3. We add CVE / threat intel knowledge bases (large, updated frequently)

At that point, embed on ingest, retrieve top-k chunks at query time using the resolved intent
as the search query. The `load_*` functions in `kb/loader.py` become the abstraction layer —
callers don't change, only the implementation behind them changes.

### KB Auto-Refresh

- `bloo-platform.md` — weekly scrape of bloo.io (documented in Section 12)
- `kb/ddm/` — updated when DNIF releases new stream DDMs; trigger via `POST /copilot/kb/reload`
- Future: CVE feed (NVD API), MITRE ATT&CK STIX bundle — scheduled daily refresh

---

## 8. Voice (Future)

Already in the stack: `POST /copilot/transcribe` → Whisper → text.

Full voice loop:
```
User speaks → Whisper STT → text query → graph executes → response text
→ ElevenLabs TTS (or OpenAI TTS) → audio streamed back to user
```

Voice-specific considerations:
- Response nodes emit shorter, conversational text when `input_mode=voice` is in state
- Clarify forms (stream picker, duration picker) replaced with voice prompts
  ("Which stream — authentication, firewall, or DNS?")
- Interrupts become verbal confirmations ("Should I investigate further? Say yes or no.")

---

## 9. Build Phases

### Phase 1 — LangGraph Foundation (current priority)
- [ ] Define `CopilotState` TypedDict
- [ ] Implement `WorkflowRegistry` + base graph class
- [ ] Port `guardrail_check` as a reusable entry node
- [ ] Port `translate_to_dql` as Graph 2 (threat detection), wired with MemorySaver
- [ ] Port `platform_faq` as Graph 1 (basic, no multi-step yet)
- [ ] Replace `orchestrator.py` if/elif with `WorkflowRegistry.execute()`
- [ ] Thread ID design + session isolation

### Phase 2 — Threat Detection Chain
- [ ] `enrich_ioc` node (VirusTotal / AbuseIPDB stubs)
- [ ] `mitre_lookup` node
- [ ] `correlate_signals` node
- [ ] Parallel enrichment via `Send()`
- [ ] `interrupt()` at enrichment and triage decision points
- [ ] Dynamic triage routing (user/host/IP conditional edges)
- [ ] `incident_response` + `executive_summary` nodes

### Phase 3 — Platform FAQ (navigation + multi-step)
- [ ] `page_context_advisor` — frontend passes page context in request
- [ ] `page_navigator` — backend emits NAVIGATE event; frontend handles routing
- [ ] `product_guide` — how-to KB loaded per page/feature
- [ ] `workbook_builder` — multi-step interrupt workflow
- [ ] `extractor_builder` — multi-step interrupt workflow

### Phase 4 — Operational + Analytics
- [ ] `stream_health`, `source_health`, `usage_analytics`
- [ ] `field_distribution`, `time_series_analysis`, `compliance_report`
- [ ] Classifier node that reads query intent + result shape to route correctly

### Phase 5 — Model + Session
- [ ] `get_model(tier, provider)` factory
- [ ] Per-node model tier declarations
- [ ] `PostgresSaver` checkpointer for production
- [ ] Clear history endpoint
- [ ] Frontend: model tier toggle, provider toggle

### Phase 6 — Voice
- [ ] `input_mode` field in `CopilotState`
- [ ] Voice-optimised response formatting in each node
- [ ] TTS streaming endpoint
- [ ] Voice clarify flows

---

## 10. LangGraph Node Sketches

Legend:
```
[ node_name ]          — standard node (runs a function, writes to state)
[ node_name* ]         — uses LLM (model tier shown in comments)
[[ node_name ]]        — interrupt node (pauses graph, waits for user input)
< condition >          — conditional edge label
═══                    — parallel fan-out via Send() API
───                    — sequential edge
⬡ START / ⬡ END       — graph entry and exit points
```

---

### Graph 1 — Platform FAQ

```
⬡ START
    │
    ▼
┌─────────────────────────────────────┐
│         guardrail_check             │  Layer 1 regex + Layer 1.5 LLM (Haiku)
│  reads:  user_query                 │
│  writes: guardrail_passed,          │
│          guardrail_block            │
└──────────────┬──────────────────────┘
               │
     ┌─────────┴──────────┐
     │ <blocked>          │ <passed>
     ▼                    ▼
┌──────────┐   ┌──────────────────────────┐
│  END     │   │    intent_classify*       │  model: fast (Haiku)
│ (blocked)│   │  reads:  user_query,      │
└──────────┘   │          page_context     │
               │  writes: resolved_skill   │
               └────────────┬─────────────┘
                            │
        ┌───────────────────┼────────────────────────┐
        │                   │                        │
        │ <platform_faq>    │ <product_guide>        │ <page_navigator>
        ▼                   ▼                        ▼
┌──────────────┐  ┌──────────────────┐  ┌────────────────────┐
│ platform_faq*│  │  product_guide*  │  │  page_navigator*   │
│              │  │                  │  │                    │
│ KB: bloo-    │  │ KB: product docs │  │ emits NAVIGATE     │
│ platform.md  │  │ per page/feature │  │ SSE event          │
│              │  │                  │  │                    │
│ model:       │  │ model: standard  │  │ model: fast        │
│ standard     │  │                  │  │                    │
└──────┬───────┘  └────────┬─────────┘  └──────────┬─────────┘
       │                   │                        │
       │           <page_context_advisor>           │
       │                   │                        │
       │          ┌─────────────────────┐           │
       │          │ page_context_advisor*│           │
       │          │                     │           │
       │          │ reads: page_context │           │
       │          │ writes: next_sugg.. │           │
       │          │ model: standard     │           │
       │          └────────┬────────────┘           │
       │                   │                        │
       │          ┌────────▼────────────┐           │
       │          │ [[ user_decision ]] │           │
       │          │  interrupt()        │           │
       │          │  shows suggestions  │           │
       │          └────────┬────────────┘           │
       │                   │                        │
       │        <workbook> │ <extractor> <playbook> │
       │                   │                        │
       │          ┌────────▼──────────────┐         │
       │          │  multi_step_builder*  │         │
       │          │                       │         │
       │          │  interrupt() per step │         │
       │          │  resumes on user input│         │
       │          │  model: standard      │         │
       │          └────────┬──────────────┘         │
       │                   │                        │
       └───────────────────┼────────────────────────┘
                           ▼
                        ⬡ END
```

---

### Graph 2 — Threat Detection

```
⬡ START
    │
    ▼
┌─────────────────────────────────────┐
│         guardrail_check             │  Layer 1 + 1.5 (Haiku)
└──────────────┬──────────────────────┘
               │
     ┌─────────┴──────────┐
     │ <blocked>          │ <passed>
     ▼                    ▼
  ⬡ END       ┌──────────────────────────┐
              │   translate_and_execute*  │  model: standard (Sonnet)
              │                           │
              │  reads:  user_query,      │
              │          stream_name,     │
              │          duration,        │
              │          ddm_fields       │  ← loaded from kb/ddm/{STREAM}_DDM
              │  writes: dql,             │
              │          dql_results,     │
              │          total_records,   │
              │          insights,        │
              │          entities         │
              └────────────┬──────────────┘
                           │
              ┌────────────┴──────────────┐
              │ <no_results>              │ <results_found>
              ▼                           ▼
     ┌─────────────────┐      ┌─────────────────────────┐
     │ no_results_node │      │   [[ enrich_confirm ]]  │
     │                 │      │   interrupt()            │
     │ suggests query  │      │   "Threats found.        │
     │ broadening      │      │    Enrich & investigate?"│
     └────────┬────────┘      └────────────┬────────────┘
              │                            │
              ▼                  ┌─────────┴──────────┐
           ⬡ END                │ <yes>              │ <no>
                                 ▼                    ▼
                    ┌────────────────────┐         ⬡ END
                    │   PARALLEL (Send() API)       │
                    │ ══════════════════ │
                    │                   │
              ┌─────▼──────┐  ┌────────▼──────┐  ┌────────────┐
              │ enrich_ioc*│  │ mitre_lookup* │  │ cve_lookup*│
              │            │  │               │  │            │
              │ VirusTotal │  │ ATT&CK STIX   │  │ NVD API    │
              │ AbuseIPDB  │  │ tactic/tech   │  │ severity   │
              │ reputation │  │ mapping       │  │ patch info │
              │            │  │               │  │            │
              │ model:fast │  │ model:fast    │  │ model:fast │
              └─────┬──────┘  └────────┬──────┘  └──────┬─────┘
                    │                  │                 │
                    └──────────────────┴─────────────────┘
                                       │
                                       ▼
                          ┌────────────────────────┐
                          │   correlate_signals*    │  model: standard
                          │                        │
                          │  runs parallel DQL     │
                          │  across related streams │
                          │  reconstructs timeline  │
                          └────────────┬────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │  [[ triage_confirm ]]   │
                          │  interrupt()             │
                          │  shows enrichment        │
                          │  "Triage user/host/IP?"  │
                          └────────────┬─────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │  route_triage            │  conditional edge
                          │  reads: entities in      │  returns list of
                          │  dql_results             │  target nodes
                          └────────────┬─────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │ PARALLEL (Send() — only if entity present)
                    │                  │                  │
              ┌─────▼──────┐  ┌───────▼───────┐  ┌──────▼──────┐
              │ triage_user│  │  triage_host  │  │  triage_ip  │
              │            │  │               │  │             │
              │ UEBA risk  │  │ EPM: process  │  │ NBAD: conn  │
              │ score      │  │ tree, files,  │  │ patterns,   │
              │ anomaly    │  │ network conns │  │ geo, proto  │
              │ history    │  │               │  │ anomalies   │
              │            │  │ model:std     │  │             │
              │ model:std  │  │               │  │ model:std   │
              └─────┬──────┘  └───────┬───────┘  └──────┬──────┘
                    │                 │                  │
                    └─────────────────┴──────────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │  [[ response_confirm ]] │
                         │  interrupt()             │
                         │  "Generate IR guide      │
                         │   or executive summary?" │
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │  PARALLEL (Send() API)   │
                         │ ═══════════════════════ │
                         │                         │
                   ┌─────▼──────┐  ┌──────────────▼──────┐  ┌────────────────┐
                   │ incident_  │  │  executive_summary*  │  │ suggest_       │
                   │ response*  │  │                      │  │ visualization* │
                   │            │  │  non-technical       │  │                │
                   │ NIST CSF   │  │  C-suite summary     │  │ chart type     │
                   │ identify   │  │  risk level          │  │ field mapping  │
                   │ contain    │  │  recommendations     │  │ for dashboard  │
                   │ eradicate  │  │                      │  │                │
                   │ recover    │  │  model: deep (Opus)  │  │ model: fast    │
                   │            │  │                      │  │                │
                   │ model:deep │  │                      │  │                │
                   └─────┬──────┘  └──────────────┬───────┘  └───────┬────────┘
                         │                        │                  │
                         └────────────────────────┴──────────────────┘
                                                  │
                                               ⬡ END
```

---

### Graph 3 — Operational Query

```
⬡ START
    │
    ▼
┌─────────────────────────────────────┐
│         guardrail_check             │
└──────────────┬──────────────────────┘
               │
     ┌─────────┴──────────┐
     │ <blocked>          │ <passed>
     ▼                    ▼
  ⬡ END      ┌────────────────────────┐
             │  translate_and_execute* │  model: standard
             │                        │
             │  same node as Graph 2  │
             │  reused across graphs  │
             └────────────┬───────────┘
                          │
             ┌────────────▼────────────┐
             │  route_operational      │  conditional edge
             │  reads: user_query      │  lightweight classifier
             │         result_shape    │  (no LLM — keyword match)
             └────────────┬────────────┘
                          │
        ┌─────────────────┼──────────────────────┐
        │                 │                      │
  <stream_health>  <source_health>        <usage_analytics>
        ▼                 ▼                      ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ stream_health│  │  source_health   │  │ usage_analytics* │
│              │  │                  │  │                  │
│ ingestion    │  │ last event recv  │  │ volume trends    │
│ rate         │  │ extractor errors │  │ storage usage    │
│ parse rate   │  │ connectivity     │  │ top sources      │
│ last seen    │  │                  │  │ ingestion lag    │
│              │  │ model: fast      │  │                  │
│ model: fast  │  │                  │  │ model: standard  │
└──────┬───────┘  └────────┬─────────┘  └──────────┬───────┘
       │                   │                        │
       └───────────────────┴────────────────────────┘
                           │
                    ┌──────▼───────┐
                    │ present +    │
                    │ suggest_viz* │  optional, model: fast
                    └──────┬───────┘
                           │
                        ⬡ END
```

---

### Graph 4 — Analytics

```
⬡ START
    │
    ▼
┌─────────────────────────────────────┐
│         guardrail_check             │
└──────────────┬──────────────────────┘
               │
     ┌─────────┴──────────┐
     │ <blocked>          │ <passed>
     ▼                    ▼
  ⬡ END      ┌────────────────────────┐
             │  translate_and_execute* │  model: standard
             └────────────┬───────────┘
                          │
             ┌────────────▼────────────┐
             │  route_analytics        │  conditional edge
             │  reads: user_query,     │
             │         result_shape    │
             └────────────┬────────────┘
                          │
        ┌──────────────────┼───────────────────────────┐
        │                  │                           │
  <distribution>    <time_series>              <compliance>
        ▼                  ▼                           ▼
┌─────────────┐   ┌─────────────────┐   ┌──────────────────────┐
│ field_dist* │   │ time_series*    │   │  compliance_report*  │
│             │   │                 │   │                      │
│ value dist  │   │ rolling avg     │   │ login attempts       │
│ cardinality │   │ trend lines     │   │ privilege changes    │
│ null rates  │   │ spike detect    │   │ policy violations    │
│             │   │                 │   │ structured report    │
│ model: fast │   │ model: standard │   │ model: deep (Opus)   │
└──────┬──────┘   └────────┬────────┘   └──────────┬───────────┘
       │                   │                        │
       └───────────────────┴────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │  [[ summary_confirm ]]  │  optional interrupt
              │  "Generate executive    │
              │   summary?"             │
              └────────────┬────────────┘
                           │
              ┌────────────┴────────────┐
              │ <yes>                   │ <no / skip>
              ▼                         ▼
    ┌──────────────────┐             ⬡ END
    │ executive_sum*   │
    │ model: deep      │
    └──────────┬───────┘
               │
            ⬡ END
```

---

### Node Anatomy (what every node looks like in code)

```python
async def translate_and_execute_node(state: CopilotState) -> CopilotState:
    """
    Reads from state  → runs skill logic → writes back to state.
    Never calls other nodes directly — routing is done by the graph edges.
    """
    model = get_model(
        tier  = state.get("model_tier", "standard"),
        provider = state.get("provider", "anthropic"),
    )

    # 1. Load context
    dql_kb    = load_dql_kb()
    ddm_fields = load_stream_ddm(state.get("stream_name"))

    # 2. Run skill
    dql, results, insights = await _translate_and_run(
        query      = state["user_query"],
        model      = model,
        dql_kb     = dql_kb,
        ddm_fields = ddm_fields,
        stream     = state.get("stream_name"),
        duration   = state.get("duration"),
    )

    # 3. Write outputs back to state — never mutate in place, return new dict
    return {
        **state,
        "dql":          dql,
        "dql_results":  results,
        "total_records": len(results),
        "insights":     insights,
        "entities":     _detect_entities(results),
        "status":       "running",
    }


# ── Registered in the graph ───────────────────────────────────────────────────

def build_threat_detection_graph() -> CompiledGraph:
    workflow = StateGraph(CopilotState)

    workflow.add_node("guardrail_check",        guardrail_check_node)
    workflow.add_node("translate_and_execute",  translate_and_execute_node)
    workflow.add_node("enrich_confirm",         enrich_confirm_node)   # interrupt
    workflow.add_node("enrich_ioc",             enrich_ioc_node)
    workflow.add_node("mitre_lookup",           mitre_lookup_node)
    workflow.add_node("cve_lookup",             cve_lookup_node)
    workflow.add_node("correlate_signals",      correlate_signals_node)
    workflow.add_node("triage_confirm",         triage_confirm_node)   # interrupt
    workflow.add_node("triage_user",            triage_user_node)
    workflow.add_node("triage_host",            triage_host_node)
    workflow.add_node("triage_ip",              triage_ip_node)
    workflow.add_node("response_confirm",       response_confirm_node) # interrupt
    workflow.add_node("incident_response",      incident_response_node)
    workflow.add_node("executive_summary",      executive_summary_node)
    workflow.add_node("suggest_visualization",  suggest_visualization_node)
    workflow.add_node("no_results",             no_results_node)

    workflow.set_entry_point("guardrail_check")

    workflow.add_conditional_edges("guardrail_check", route_after_guardrail, {
        "blocked":  END,
        "passed":   "translate_and_execute",
    })
    workflow.add_conditional_edges("translate_and_execute", route_after_translate, {
        "no_results":     "no_results",
        "results_found":  "enrich_confirm",
    })
    workflow.add_conditional_edges("enrich_confirm", route_after_enrich_confirm, {
        "yes": "enrich_ioc",   # Send() fans out to mitre + cve in parallel
        "no":  END,
    })
    # parallel enrichment merges back before correlate
    workflow.add_edge("enrich_ioc",    "correlate_signals")
    workflow.add_edge("mitre_lookup",  "correlate_signals")
    workflow.add_edge("cve_lookup",    "correlate_signals")
    workflow.add_edge("correlate_signals", "triage_confirm")

    workflow.add_conditional_edges("triage_confirm", route_triage, {
        # route_triage returns list → Send() fans out dynamically
    })
    # triage nodes merge back before response_confirm
    workflow.add_edge("triage_user",   "response_confirm")
    workflow.add_edge("triage_host",   "response_confirm")
    workflow.add_edge("triage_ip",     "response_confirm")

    workflow.add_conditional_edges("response_confirm", route_response, {
        "ir":      "incident_response",  # Send() fans out to exec_summary + viz too
        "summary": "executive_summary",
        "skip":    END,
    })
    workflow.add_edge("incident_response",     END)
    workflow.add_edge("executive_summary",     END)
    workflow.add_edge("suggest_visualization", END)
    workflow.add_edge("no_results",            END)

    return workflow.compile(checkpointer=MemorySaver())
```

---

### How Interrupt Works (mid-graph pause)

```
1. Graph running → reaches enrich_confirm_node
2. enrich_confirm_node calls interrupt(value={"message": "Threats found. Enrich?"})
3. Graph state is checkpointed to MemorySaver under thread_id
4. Backend SSE stream emits SUGGEST event to frontend → user sees buttons
5. User clicks "Yes, enrich" → frontend sends new POST /copilot/chat
   with same thread_id + {"resume": true, "choice": "yes"} in context
6. Graph resumes from enrich_confirm_node with user's choice in state
7. Conditional edge reads choice → routes to enrich_ioc (fan-out via Send())
```

No state is lost. The graph picks up exactly where it paused.

---

## 11. Cross-Graph Transitions — How Graphs Connect

### The Problem

A user's conversation doesn't stay inside one graph. Examples:

- "How does UEBA work?" → *(Platform FAQ)* → "Now show me recent anomalies" → *(Threat Detection)*
- "Show me top users by failed logins" → *(Analytics)* → "Investigate this user" → *(Threat Detection)*
- "Is the firewall stream healthy?" → *(Operational)* → "Show me blocked traffic from that source" → *(Threat Detection)*
- Mid-investigation: "How do I build a workbook for this detection rule?" → *(Platform FAQ)*
- After threat detection results: "Give me a compliance report for this period" → *(Analytics)*

There are three transition triggers:

| Trigger | When | Example |
|---|---|---|
| **Fresh turn** | User sends a new message after a graph finishes | New query, different intent |
| **Mid-graph pivot** | User sends something off-topic while paused at an interrupt | "Actually, how do I write a workbook for this?" |
| **Output-driven** | A graph's results suggest continuing in another graph | Analytics finds anomaly → offer threat investigation |

---

### Architecture: Supervisor + Subgraphs

The solution is a **top-level Supervisor graph** that owns the session and dispatches to the
four workflow subgraphs. Each workflow graph runs as a **subgraph node** inside the supervisor.

```
⬡ START (every user message)
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│                    SUPERVISOR GRAPH                       │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              session_context_loader              │    │
│  │                                                  │    │
│  │  reads checkpointed state for thread_id          │    │
│  │  surfaces: last_graph, last_results, entities,   │    │
│  │            pending_interrupt, active_skill        │    │
│  └──────────────────────┬───────────────────────────┘    │
│                         │                                │
│  ┌──────────────────────▼───────────────────────────┐    │
│  │              guardrail_check                     │    │
│  │   (runs once here — subgraphs skip it)           │    │
│  └──────────────────────┬───────────────────────────┘    │
│              ┌──────────┴──────────┐                     │
│         <blocked>             <passed>                   │
│              │                    │                      │
│           ⬡ END    ┌─────────────▼──────────────────┐   │
│                    │          dispatcher*             │   │
│                    │                                 │   │
│                    │  reads: user_query,             │   │
│                    │         last_graph,             │   │
│                    │         pending_interrupt,      │   │
│                    │         last_results            │   │
│                    │  writes: target_graph,          │   │
│                    │          resume_or_new,         │   │
│                    │          carry_context          │   │
│                    │                                 │   │
│                    │  model: fast (Haiku)            │   │
│                    └─────────────┬───────────────────┘   │
│                                  │                       │
│          ┌───────────────────────┼──────────────────┐    │
│          │           │           │                  │    │
│    <faq_graph> <threat_graph> <ops_graph>  <analytics_graph>
│          │           │           │                  │    │
│    ┌─────▼────┐ ┌────▼──────┐ ┌─▼──────────┐ ┌────▼──┐  │
│    │ Graph 1  │ │  Graph 2  │ │  Graph 3   │ │Graph 4│  │
│    │ Platform │ │  Threat   │ │ Operational│ │Analyt │  │
│    │   FAQ    │ │ Detection │ │  Queries   │ │  ics  │  │
│    │          │ │           │ │            │ │       │  │
│    │ subgraph │ │ subgraph  │ │  subgraph  │ │subgrph│  │
│    └─────┬────┘ └────┬──────┘ └─┬──────────┘ └────┬──┘  │
│          │           │          │                  │     │
│          └───────────┴──────────┴──────────────────┘     │
│                                  │                       │
│  ┌───────────────────────────────▼───────────────────┐   │
│  │              output_router                        │   │
│  │                                                   │   │
│  │  reads: subgraph outputs, result shape            │   │
│  │  decides: done | suggest_next_graph | interrupt   │   │
│  └───────────────────────────────┬───────────────────┘   │
│                                  │                       │
│          ┌───────────────────────┼──────────────────┐    │
│          │                       │                  │    │
│       <done>          <suggest_transition>    <pivot_detected>
│          │                       │                  │    │
│       ⬡ END         ┌────────────▼──────┐           │    │
│                     │ [[ cross_graph_  ││  loop back │    │
│                     │    interrupt ]]  ││  to        │    │
│                     │                  ││  dispatcher│    │
│                     │ "Results show X. ││            │    │
│                     │ Investigate      ││            │    │
│                     │ further?"        ││            │    │
│                     └────────────┬─────┘└───────────┘    │
│                                  │                       │
│                     ┌────────────┴─────┐                 │
│                     │ <yes>            │ <no>            │
│                     │ loop back to     │                 │
│                     │ dispatcher with  │  ⬡ END          │
│                     │ target_graph set │                 │
│                     └──────────────────┘                 │
└──────────────────────────────────────────────────────────┘
```

---

### The Dispatcher Node

The dispatcher is a fast LLM call (Haiku) that reads the full session context and decides:

1. **Is there a pending interrupt to resume?** → resume the same graph, pass user's choice
2. **Is this a pivot?** → detect if the new query is off-topic from the current graph
3. **Which graph should handle this?** → classify into graph 1–4
4. **What context to carry?** → which prior state fields are relevant to the new graph

```python
_DISPATCHER_SYSTEM = """
You are a session router for BLOO Copilot. Given the conversation context, decide what to do.

Output ONLY a JSON object:
{
  "action": "resume" | "new_graph" | "pivot",
  "target_graph": "faq" | "threat_detection" | "operational" | "analytics",
  "resume_interrupt": true | false,
  "carry_context": ["dql_results", "entities", "insights"],  // prior state fields to pass
  "reasoning": "<one sentence>"
}

Guidelines:
- "resume": user is responding to an interrupt in the current graph (yes/no, picked a stream, etc.)
- "pivot": user asked something off-topic mid-graph — start the new graph but preserve prior outputs in state
- "new_graph": fresh question after previous graph completed
- carry_context: which outputs from the prior graph are useful input to the next
"""
```

---

### Context Inheritance Between Graphs

When the dispatcher routes to a new graph, it doesn't wipe the state — it carries
relevant fields forward. This is how the results from one graph become the input to another.

```
Analytics (Graph 4) completes:
    state.dql_results = [top 10 users by failed logins]
    state.entities    = {"user": ["alice", "bob"], "ip": ["1.2.3.4"]}
    state.insights    = "Unusual spike in failed logins from alice at 3am"

User says: "Investigate alice"

Dispatcher output:
    action:        "new_graph"
    target_graph:  "threat_detection"
    carry_context: ["dql_results", "entities", "insights"]

Graph 2 (Threat Detection) starts with:
    state.user_query   = "Investigate alice"
    state.dql_results  = [already have the data — skip translate_and_execute]
    state.entities     = {"user": ["alice"]}  ← triage_user runs immediately
    state.insights     = carried forward as context for enrichment nodes
```

The `translate_and_execute` node in Graph 2 checks if `dql_results` is already populated
and the query is a continuation — if so, it skips re-running the DQL and goes straight
to enrichment. This is a **conditional skip edge**.

---

### Pivot Detection Mid-Graph

If a user pivots while Graph 2 is paused at `enrich_confirm`:

```
Graph 2 paused at: [[ enrich_confirm ]]  — waiting for "Yes, enrich?"

User types: "Actually, how do I write a detection rule for this?"

Dispatcher detects: action="pivot", target_graph="faq"

Behaviour:
  1. Save current Graph 2 checkpoint (state preserved under thread_id)
  2. Run Graph 1 (Platform FAQ) for the workbook question
  3. After Graph 1 completes → output_router offers:
     "Want to continue your threat investigation?"
  4. User says yes → dispatcher resumes Graph 2 from enrich_confirm
     with prior state fully intact
```

The paused graph is never lost — it's checkpointed. The supervisor simply runs another
graph in the same session thread, then offers to return.

---

### Natural Output-Driven Transitions

Some graph outputs naturally suggest a specific next graph. The `output_router` node
handles this by inspecting result shape and emitting a cross-graph interrupt:

| Graph output | Suggested transition | Interrupt message |
|---|---|---|
| Analytics finds anomalous users/IPs | → Threat Detection | "Unusual activity detected. Investigate?" |
| Threat Detection finds CVEs | → Platform FAQ (product guide) | "Patching guidance available. Show remediation steps?" |
| Threat Detection IR guide complete | → Analytics | "Generate compliance report for this period?" |
| Operational finds source downtime | → Analytics | "Show ingestion gap analysis?" |
| Platform FAQ explains a feature | → Analytics or Threat | "Want me to run a query to see this data?" |

These are **pre-wired suggestions** in the `output_router` node — not LLM-generated.
They're deterministic rules based on the current graph + result fields populated in state.

---

### Complete Transition Flow Summary

```
User message arrives (any turn)
    │
    ▼
session_context_loader  — load checkpointed state for thread_id
    │
    ▼
guardrail_check  — single check, covers all graphs
    │
    ▼
dispatcher (Haiku, fast)
    ├── pending interrupt? → resume same graph with user's choice
    ├── pivot detected?   → checkpoint current graph, run new graph, offer to return
    └── fresh query?      → classify → run target graph
                                       carry relevant prior state fields
    │
    ▼
[subgraph runs — Graph 1 / 2 / 3 / 4]
    │
    ▼
output_router
    ├── done?                  → END
    ├── natural next graph?    → cross_graph_interrupt → user confirms → dispatcher
    └── pivot mid-graph?       → checkpoint, run new graph, offer resume
```

---

## 12. Open Questions

1. **Page context protocol** — how does the frontend pass current page + visible data to the copilot? REST body field? SSE header? Need to agree on the contract.

2. **UEBA / EPM / NBAD API access** — do `triage_user`, `triage_host`, `triage_ip` call DNIF APIs directly, or do they run DQL queries against those module streams?

3. **Enrichment API keys** — VirusTotal, AbuseIPDB — are these available in the deployment environment or stub-only?

4. **Multi-tenant isolation** — is `scope_id` the DNIF cluster ID, or a separate tenant identifier?

5. **Persistent checkpointer** — which DB is available in the deployment environment? (Postgres preferred for LangGraph's `PostgresSaver`)

6. **Private LLM** — which local models are being considered? Ollama + Llama3? Azure OpenAI?

7. **Voice** — ElevenLabs for TTS (already have the key from mummy-chat) or OpenAI TTS?
