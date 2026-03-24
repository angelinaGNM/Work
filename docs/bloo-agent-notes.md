# bloo-agent — Architecture Notes & Code Walkthrough

> Added: 2026-03-24
> Source: https://github.com/bloo-team/bloo-copilot/tree/bloo-agent
> Local clone: `/home/angelinag/DNIF Official/Projects/claude-code/bloo-agent/`

---

## 1. Architecture Summary — bloo-agent vs our server/

---

### A. Orchestration — LangGraph StateGraph vs if/elif

**bloo-agent:** Every workflow is a `StateGraph` — nodes declared explicitly, edges drawn between
them, routing functions decide which path to take. LangGraph manages execution, state, and
checkpointing.

**Ours (`server/`):** `orchestrator.py` is a big async if/elif — intent comes in, we manually call
the right function.

| | bloo-agent | Ours |
|---|---|---|
| **Pro** | Resumable, checkpointed, visual graph, supports interrupts | Simple, easy to debug, fast to prototype |
| **Con** | More boilerplate per workflow, steeper learning curve | Hard to extend, no resumability, no interrupts, grows messy |

---

### B. Workflow Discovery — WorkflowRegistry vs manual routing

**bloo-agent:** `WorkflowRegistry` auto-discovers workflows by naming convention
(`fetch_logs/` → `FetchLogsWorkflow`). Just drop a folder in, the registry picks it up.
Lazy-compiled and cached.

**Ours:** Every new skill requires editing `orchestrator.py`.

| | bloo-agent | Ours |
|---|---|---|
| **Pro** | Adding a skill = just a new folder, zero central file changes | Explicit — you can see all skills in one place |
| **Con** | Naming convention is implicit/magic | Central file grows unwieldy as skills grow |

---

### C. Supervisor routing — skills.md vs intent classifier

**bloo-agent:** A dedicated `SupervisorWorkflow` (gpt-4o, temp 0.2) reads a `skills.md` file from
each workflow folder and decides which workflow to call. The supervisor has zero knowledge of skill
internals.

**Ours:** `orchestrator.py` reads intent and routes — tightly coupled.

| | bloo-agent | Ours |
|---|---|---|
| **Pro** | Completely decoupled — adding a skill updates routing automatically via skills.md | One LLM call path, no extra routing cost |
| **Con** | Extra LLM call on every request just for routing | Skills and routing are entangled in the same file |

---

### D. Semantic stream matching — SemanticMatcher vs nothing

**bloo-agent:** Uses `all-MiniLM-L12-v2` (Sentence Transformers) to semantically match the user
query to DNIF stream categories from `stream_to_action.json`. Embeddings are pre-computed at
startup, cached as `.npz` with SHA-256 stale detection — so matching at request time is just a dot
product, near-instant.

**Ours:** Not built yet.

| | bloo-agent | Ours |
|---|---|---|
| **Pro** | Highly accurate stream matching even for varied phrasing | No extra dependency |
| **Con** | ~120MB+ model download, startup cost | Brittle keyword matching — will miss paraphrases |

---

### E. OOTB content as few-shot examples

**bloo-agent:** `_ootb_matcher.match()` semantically finds the top-3 most similar OOTB queries
from `OOTB_content.json` (760KB) and passes them to the DQL generator as few-shot examples. This
makes generated DQL significantly more accurate.

**Ours:** We have `bloo-copilot/kb/OOTB-2025.xlsx` — same data, not yet wired in.

| | bloo-agent | Ours |
|---|---|---|
| **Pro** | OOTB used actively to improve DQL quality | xlsx is easier to maintain and update |
| **Con** | JSON format, 760KB loaded in memory | Not integrated — not benefiting from it at all yet |

---

### F. Clarity check + interrupt/resume

**bloo-agent:** `query_clarity_node` scores the query 0–1. If score ≤ 0.3 (vague), it calls
`interrupt()` — LangGraph pauses execution mid-graph, sends a `clarification_needed` SSE event to
the UI, waits for the answer, then resumes from where it stopped via `Command(resume=answer)`. The
DQL generator does the same for medium-clarity queries — shows a preview, asks "is this right?",
waits.

**Ours:** No clarification mechanism. Vague queries either fail or return wrong results.

| | bloo-agent | Ours |
|---|---|---|
| **Pro** | Handles vague queries gracefully, multi-turn conversation feels natural | Simpler UX, no extra round trips |
| **Con** | Complex interrupt/resume flow, widget must handle `clarification_needed` event | Vague queries fail silently, bad UX |

---

### G. LLM abstraction — LangChain vs our custom client

**bloo-agent:** `get_llm_client(provider, model, temperature)` returns a LangChain `BaseChatModel`.
All nodes call `.ainvoke()` and `.with_structured_output()` uniformly — provider-agnostic.

**Ours:** Custom `llm_client.py` calling Anthropic SDK directly. Adding OpenAI or Gemini means
rewriting.

| | bloo-agent | Ours |
|---|---|---|
| **Pro** | Provider swap = change one string, structured output built-in | Direct SDK, no abstraction overhead |
| **Con** | LangChain adds version pinning complexity | Must rewrite per provider — doesn't scale |

---

### H. Per-node model config — config.py

**bloo-agent:** Each workflow has a `config.py` declaring exactly which model/provider each node
uses. Currently all nodes use `gpt-4o-mini` but the structure is ready for per-node model
differentiation.

**Ours:** No per-node config — model selection is ad-hoc.

| | bloo-agent | Ours |
|---|---|---|
| **Pro** | Clean place to implement Quick/Auto/Deep mode per skill | N/A |
| **Con** | In practice all nodes use the same model today — no differentiation yet | N/A |

---

### I. Hardcoded credentials in dql_executor.py

**bloo-agent:** `TENANT_ID`, `TOKEN`, `CONSOLE_ADDR` are hardcoded directly in
`utils/dql_executor.py`. This is a dev shortcut.

**Ours:** `.env` file — correct approach.

| | bloo-agent | Ours |
|---|---|---|
| **Pro** | N/A | Env-based, deployable, secure |
| **Con** | Security risk, can't be deployed differently | N/A |

---

## 2. OOTB Content

Our `bloo-copilot/kb/OOTB-2025.xlsx` is the maintained source of truth for OOTB content.
When we wire OOTB semantic matching into our server, we convert xlsx → JSON as a build step
(same pattern as bloo-agent's `OOTB_content.json`).

---

## 3. Code Walkthrough

A single request flowing through every file:

---

### Step 1 — Request arrives (`interfaces/api/src/main.py`)
```
POST /api/query { "input_query": "show failed logins", "thread_id": null }
```
FastAPI hands it to `WorkflowExecutor.execute()`.

---

### Step 2 — WorkflowExecutor (`core/engine/executor.py`)
- New request → generates a `thread_id` UUID, emits `SSEEvent(type="thread")` immediately so the
  widget can track the conversation
- Existing request (resuming after interrupt) → wraps the answer in `Command(resume=answer)`
- Calls `workflow.astream()` in `stream_mode='updates'` — each node's state changes stream as they
  happen
- Watches for `__interrupt__` in the stream — if found, emits `clarification_needed` and stops

---

### Step 3 — WorkflowRegistry (`core/engine/registry.py`)
- On first call, converts `"supervisor"` → imports `core.workflows.supervisor` → finds
  `SupervisorWorkflow` → calls `.build_graph()` → caches the compiled graph
- Next calls reuse the cached `CompiledStateGraph`
- Adding a new workflow: create `core/workflows/my_skill/workflow.py` with `MySkillWorkflow` —
  the registry finds it automatically via naming convention

---

### Step 4 — SupervisorWorkflow (`core/workflows/supervisor.py`)
- Reads all `*/skills.md` files in `core/workflows/` at build time
- Builds a prompt: "here are the available workflows and what they do — route this query"
- Uses `langgraph_supervisor.create_supervisor()` with gpt-4o (temp 0.2)
- Delegates to the selected sub-workflow (e.g. `fetch_logs`)

---

### Step 5 — FetchLogsWorkflow (`core/workflows/fetch_logs/workflow.py`)
Graph structure with conditional routing:

```
guardrail_check
    ↓ (pass)
classification → intent
    ↓ (log_analysis)
query_clarity ← [interrupt if score ≤ 0.3]
    ↓
stream_action_context
    ↓
dql_generator ← [interrupt if medium clarity: show preview → confirm → feedback]
    ↓ (not generate_query)
dql_executor
    ↓ (not run_query)
log_summary → END
```

---

### Step 6 — Nodes (`core/workflows/fetch_logs/nodes.py`)

Each node reads from state, calls an LLM, writes back to state. They never call each other —
LangGraph sequences them.

| Node | What it does |
|---|---|
| `guardrail_check_node` | gpt-4o-mini safety prompt → `guardrail_passed: bool` |
| `classification_node` | Classifies into `log_analysis \| enrich_results \| endpoint_analysis \| other` |
| `intent_node` | Within `log_analysis`, determines `generate_query \| run_query \| summarize` |
| `query_clarity_node` | Scores query 0–1. ≤ 0.3 → `interrupt()` → pauses graph, asks user |
| `stream_action_context_node` | `SemanticMatcher("stream_to_action.json").match(query)` → finds DNIF stream |
| `dql_generator_node` | `_ootb_matcher.match(query, top_k=3)` for few-shot → generates DQL. Medium clarity → interrupts twice |
| `dql_executor_node` | `execute_dql(dql_query)` → invoke → poll → fetch → builds `[text_block, table_block]` |
| `log_summary_node` | Takes results, generates human-readable summary, appends to response blocks |

---

### Step 7 — LLM client (`clients/llm_client.py`)
```python
get_llm_client("openai", model="gpt-4o-mini", temperature=0.2)
# Returns ChatOpenAI — a LangChain BaseChatModel
```
All nodes use `.with_structured_output(SomePydanticSchema)` — LLM returns JSON, automatically
parsed into a typed object.

Supported providers: `openai`, `claude`, `gemini`

---

### Step 8 — SemanticMatcher (`utils/embedding_generator.py`)
1. At startup (`entrypoint.sh → precompute_all()`) — loads `all-MiniLM-L12-v2`, encodes all
   entries in each `*.json` file, saves as `.npz` with SHA-256 of the source file
2. At request time — loads `.npz` from cache, encodes user query, dot product, returns top-k
   above threshold
3. If source JSON changes → SHA-256 mismatch → re-encodes automatically

---

### Step 9 — DQL executor (`utils/dql_executor.py`)
Three-step DNIF API flow:
```
invoke_query(dql)           → task_id
check_status(task_id)       → poll every 1s until SUCCESS/FAILED
fetch_results(task_id)      → rows, columns, count
```
**Note:** `TENANT_ID`, `TOKEN`, `CONSOLE_ADDR` are currently hardcoded — needs to move to `.env`.

---

### State schema (`core/workflows/fetch_logs/state.py`)

```python
class WorkflowState(TypedDict):
    input_query:            str            # user query (may be refined mid-run)
    guardrail_passed:       bool
    classification:         Optional[str]  # log_analysis | enrich_results | endpoint_analysis | other
    intent:                 Optional[str]  # generate_query | run_query | summarize
    clarity_score:          Optional[float] # 0.0 (vague) → 1.0 (clear)
    stream_action_context:  Optional[Any]  # top semantic matches from stream_to_action.json
    dql_query:              Optional[List[str]]
    dql_status:             Optional[str]  # success | failed | error
    dql_result:             Optional[Any]  # raw rows
    response:               Optional[Any]  # UI blocks (text + table)
    reasoning:              Optional[str]  # chain-of-thought shown in UI
```

---

### Per-node model config (`core/workflows/fetch_logs/config.py`)

```python
_GUARDRAIL_MODEL     = "gpt-4o-mini"
_CLASSIFICATION_MODEL = "gpt-4o-mini"
_INTENT_MODEL        = "gpt-4o-mini"
_CLARITY_MODEL       = "gpt-4o-mini"
_DQL_GENERATOR_MODEL = "gpt-4o-mini"
_SUMMARY_MODEL       = "gpt-4o-mini"
```
Currently all nodes use `gpt-4o-mini`. Structure is ready for Quick/Auto/Deep mode differentiation.
