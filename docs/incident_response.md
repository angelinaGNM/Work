# Incident Response — Design & Architecture

## Overview

The `incident_response` skill transforms BLOO Copilot from a passive query assistant into an **active investigation and response orchestrator**. Given a security signal, alert, or DQL result, it extracts IOCs, correlates across streams, enriches with threat intelligence, generates a NIST CSF-aligned response plan, and notifies stakeholders — all from a single natural language prompt.

This document covers the full design: skill architecture, new skills required, threat intelligence integration (from scratch and via b-soar), Slack notification, MCP extensibility, and the complete requirements checklist.

---

## What the Skill Does

```
Input: a signal, alert description, or DQL result
    │
    ├── 1. Classify incident type + severity
    ├── 2. Extract IOCs (IPs, users, domains, file hashes)
    ├── 3. Correlate across streams (auth + firewall + DNS + endpoint + NTA)
    ├── 4. Enrich each IOC (reputation, geolocation, threat intel)
    ├── 5. Generate NIST CSF-structured response plan
    ├── 6. Notify via Slack (severity-routed, Block Kit formatted)
    └── 7. Optionally trigger SOAR actions (block IP, disable user, create ticket)
```

---

## Skill Chain

```
incident_response
    ├──→ correlate_signals     cross-stream DQL timeline reconstruction
    │         └──→ enrich_ioc  IP reputation + geolocation + TI enrichment
    │                   └──→ notify_slack    structured Slack alert
    ├──→ threat_hunt            MITRE ATT&CK-based hunting queries
    ├──→ suggest_investigation  ordered analyst next steps
    └──→ executive_summary
              └──→ notify_slack    C-suite briefing delivery
```

### Skill Chaining Rules (addition to SKILL_CHAINS)

```python
SKILL_CHAINS = {
    ...
    "incident_response":   ["correlate_signals", "enrich_ioc", "notify_slack",
                             "threat_hunt", "suggest_investigation", "executive_summary"],
    "correlate_signals":   ["enrich_ioc", "incident_response"],
    "enrich_ioc":          ["notify_slack", "incident_response"],
}
```

---

## New Skills

### 1. `incident_response`

The orchestrating skill. Accepts a signal or alert as input, classifies it, and drives the full response workflow.

**Inputs**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `signal` | string | ✅ | Signal description, alert text, or raw DQL result |
| `context` | string | — | Additional context: affected user, host, IP, timeframe |
| `provider` | string | — | LLM provider (`anthropic` \| `openai`) |

**Output structure**

```
## Incident Classification
- Type: Credential Stuffing / Brute Force
- Severity: HIGH
- Confidence: 0.91
- MITRE ATT&CK: T1110.003 — Password Spraying

## Affected Assets
- Users: sbhatia@DARC.com, nbilliau@DARC.com (+ 18 others)
- Source IPs: 185.211.245.170, 149.56.254.120
- Stream: authentication

## Correlated Signals
[→ calls correlate_signals]

## IOC Enrichment
[→ calls enrich_ioc]

## NIST CSF Response Plan
### Identify
### Protect
### Detect
### Respond
### Recover

## Notification
[→ calls notify_slack]
```

---

### 2. `correlate_signals`

Runs coordinated DQL queries across multiple streams around a given IOC or time window to reconstruct a unified attack timeline.

**Inputs**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `iocs` | string | ✅ | Comma-separated list of IOCs (IPs, users, domains) to pivot on |
| `time_window` | string | — | Time range to search (default: `24h`) |
| `streams` | string | — | Comma-separated stream list to query. Defaults to all relevant streams. |
| `provider` | string | — | LLM provider |

**What it runs**

For each seed IOC, the skill generates and executes DQL queries across:

| Stream | What it looks for |
|---|---|
| `authentication` | Login attempts (success + failure) by this user/IP |
| `firewall` | Inbound/outbound traffic to/from this IP |
| `dns` | Domain lookups from this host, DGA patterns |
| `ep-process` | Process execution on affected endpoints |
| `ep-network` | Lateral movement indicators from this host |
| `nta-connection` | Unusual connection patterns, beaconing |

Results are merged into a **chronological timeline**, deduplicated, and ranked by frequency and severity. The LLM then identifies patterns — login failure spike → successful login → lateral movement → exfiltration, for example.

**Example output**

```
## Correlated Timeline — 185.211.245.170 (last 24h)

14:01  [firewall]        Inbound connection blocked — port 443
14:03  [authentication]  Failed login — sbhatia@DARC.com (SMTP-MTA2)
14:03  [authentication]  Failed login — nbilliau@DARC.com (SMTP-MTA2)
14:04  [authentication]  Failed login — 17 additional DARC.com accounts
14:09  [firewall]        Inbound connection allowed — port 587
14:11  [authentication]  SUCCESSFUL login — ewallace@DARC.com ⚠️
14:14  [ep-network]      Lateral movement detected from ewallace workstation

Pattern: Password spray → account compromise → lateral movement
```

---

### 3. `enrich_ioc`

Enriches a list of IOCs with reputation scores, geolocation, ASN data, and threat intelligence context. Private IPs are automatically bypassed.

**Inputs**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `iocs` | string | ✅ | Comma-separated IPs, domains, or file hashes |
| `provider` | string | — | LLM provider |

**Private IP detection**

RFC 1918 and special-use addresses are detected and skipped automatically:

```python
import ipaddress

SKIP_RANGES = [
    "10.0.0.0/8",       # RFC 1918
    "172.16.0.0/12",    # RFC 1918
    "192.168.0.0/16",   # RFC 1918
    "127.0.0.0/8",      # Loopback
    "169.254.0.0/16",   # Link-local
    "::1/128",          # IPv6 loopback
    "fc00::/7",         # IPv6 ULA
]

def is_enrichable(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
        return not any(addr in ipaddress.ip_network(r) for r in SKIP_RANGES)
    except ValueError:
        return False  # not a valid IP — treat as domain
```

**Per-IOC enrichment card**

```
## 185.211.245.170

Geolocation:    Russia (RU) — Moscow
ASN:            AS202984 — TEAM-HOST
Type:           Datacenter / Hosting provider
Risk level:     🔴 HIGH

AbuseIPDB:      Confidence: 97%  |  Reports: 842  |  Last seen: 2026-03-17
VirusTotal:     18/94 engines malicious  |  Community: malicious
AlienVault OTX: 4 threat pulses  |  Tags: scanner, brute-force, spam

Summary: Known malicious hosting infrastructure with extensive abuse history.
         Consistently associated with credential stuffing campaigns.
```

---

### 4. `notify_slack`

Formats and delivers incident notifications to Slack. Uses Block Kit for rich formatting. Routes to different channels by severity.

**Inputs**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `incident_type` | string | ✅ | e.g. `Credential Stuffing`, `Ransomware`, `Data Exfiltration` |
| `severity` | string | ✅ | `critical` \| `high` \| `medium` \| `low` |
| `summary` | string | ✅ | One-paragraph incident summary |
| `affected_assets` | string | — | Comma-separated users, hosts, IPs |
| `iocs` | string | — | Comma-separated IOC list |
| `recommended_actions` | string | — | Comma-separated action items |
| `thread_ts` | string | — | Slack thread timestamp for update posts |

**Channel routing**

| Severity | Default channel |
|---|---|
| critical | `#soc-critical` |
| high | `#soc-alerts` |
| medium | `#soc-alerts` |
| low | `#soc-notifications` |

Channels are configurable via `.env`. All channels can be overridden per call.

**Example Slack message**

```
🔴 HIGH — Credential Stuffing Detected

Authentication stream · DARC.com · 2026-03-18 14:03 UTC

18 accounts targeted in a 3-minute password spray from
185.211.245.170 (Russia, TEAM-HOST AS202984). One account
compromised: ewallace@DARC.com. Lateral movement detected
from compromised workstation 14 minutes post-breach.

Affected users: sbhatia, nbilliau, ewallace (+15 others)
Source IP:      185.211.245.170 — AbuseIPDB: 97% | VT: 18/94

Recommended actions:
  1. Disable ewallace@DARC.com immediately
  2. Block 185.211.245.170 at perimeter firewall
  3. Audit ewallace workstation for lateral movement artefacts
  4. Force password reset for all 18 targeted accounts

[View in DNIF Console] [Run Threat Hunt] [Create Ticket]
```

---

## Threat Intelligence Integration

### Architecture — Two Paths

#### Path A: Direct API Clients

bloo-copilot calls each TI source directly. Suitable when b-soar is not deployed or when a source is not yet integrated in b-soar.

```
enrich_ioc skill
    ├── server/integrations/threat_intel/abuseipdb.py   → AbuseIPDB API
    ├── server/integrations/threat_intel/virustotal.py  → VirusTotal API v3
    ├── server/integrations/threat_intel/alienvault.py  → AlienVault OTX API
    └── server/integrations/geo/ip_lookup.py            → ip-api.com / MaxMind GeoIP2
```

Each client is independently enabled/disabled via `.env`. Missing API keys are skipped gracefully — a source with no key configured is simply omitted from the enrichment card.

#### Path B: b-soar API (Recommended)

Route all enrichment through the existing b-soar enrichment endpoints. bloo-copilot calls one client; b-soar internally fans out to all configured integrations.

```
enrich_ioc skill
    └── server/integrations/soar_client.py
            └── POST /soar/enrich/ip     → b-soar → VirusTotal + AbuseIPDB + AlienVault
            └── POST /soar/enrich/domain → b-soar → VirusTotal + URLScan
            └── POST /soar/enrich/hash   → b-soar → VirusTotal + MalwareBazaar
```

**Advantages:**
- Zero duplication — reuse existing b-soar integrations
- New TI source added to b-soar → immediately available in bloo-copilot
- Unified enrichment schema regardless of source count
- SOAR-managed API key rotation and rate limiting

#### Hybrid (Default Behaviour)

```python
if settings.soar_api_enabled:
    result = await soar_client.enrich_ip(ip)
else:
    result = await _direct_enrich_ip(ip)  # fan out to direct clients
```

### Supported Sources

| Source | Type | What it provides |
|---|---|---|
| **AbuseIPDB** | IP reputation | Abuse confidence score (0–100%), total reports, last seen date, usage type |
| **VirusTotal** | IP / domain / hash | Engine detection count, community votes, last analysis date, associated samples |
| **AlienVault OTX** | IP / domain / hash | Threat pulse count, adversary tags, malware family associations, country |
| **ip-api.com** | Geolocation (free) | Country, city, region, ASN, ISP, mobile/proxy/hosting flags |
| **MaxMind GeoIP2** | Geolocation (paid) | Country, city, postal code, coordinates, ISP, connection type |
| **MalwareBazaar** | Hash | Malware family, file type, first/last seen, tags |
| **URLScan.io** | Domain / URL | Screenshot, DOM analysis, network activity, verdict |

### Adding New TI Sources

**Via b-soar (zero code):**
1. Add the integration in the b-soar integrations UI
2. bloo-copilot picks it up automatically through `/soar/enrich/*`

**Via direct client (code):**
1. Add `server/integrations/threat_intel/<source>.py` implementing `async def enrich(ioc: str) -> dict`
2. Add config flags in `settings.py`: `<source>_api_key`, `<source>_enabled`
3. Register in `enrich_ioc.py`'s source router

**Via external MCP server:**
1. Register a third-party TI MCP server in Claude Code (`claude mcp add`)
2. Claude can call it as a tool in the same conversation as bloo-copilot
3. No bloo-copilot code changes required — pure MCP composition

---

## SOAR Integration

### b-soar API Client

`server/integrations/soar_client.py` provides a unified interface to all b-soar capabilities:

**Enrichment**
```
POST /soar/enrich/ip       { "ip": "185.211.245.170" }
POST /soar/enrich/domain   { "domain": "malicious.example.com" }
POST /soar/enrich/hash     { "hash": "abc123..." }
```

**Notifications**
```
POST /soar/notify/slack    { "channel": "#soc-alerts", "blocks": [...] }
POST /soar/notify/teams    { "webhook_url": "...", "message": "..." }
POST /soar/notify/email    { "to": "soc@company.com", "subject": "...", "body": "..." }
```

**Response Actions**
```
POST /soar/action/block-ip          { "ip": "185.211.245.170", "reason": "..." }
POST /soar/action/disable-user      { "user": "ewallace@DARC.com", "reason": "..." }
POST /soar/action/isolate-endpoint  { "hostname": "ewallace-ws01" }
POST /soar/action/create-ticket     { "title": "...", "severity": "high", "body": "..." }
```

### On-the-Fly Integration Setup

If a required integration (e.g. a new Slack workspace) is not yet configured in b-soar, `incident_response` can guide the user through setup inline:

```
User: Notify the security team on Slack about this incident.
BLOO: Slack is not yet configured. I can help you set it up.
      Please provide:
        1. Your Slack webhook URL (Settings → Integrations → Incoming Webhooks)
        2. Default alert channel (e.g. #soc-alerts)
      Once configured in b-soar, all future notifications will route automatically.
```

---

## File Structure

```
bloo-copilot/
├── server/
│   ├── skills/
│   │   ├── incident_response.py      orchestrator — classify, correlate, respond, notify
│   │   ├── correlate_signals.py      cross-stream DQL timeline reconstruction
│   │   ├── enrich_ioc.py             IOC enrichment — TI + geolocation + private IP bypass
│   │   └── notify_slack.py           Slack Block Kit notification delivery
│   │
│   └── integrations/
│       ├── __init__.py
│       ├── soar_client.py            b-soar API client — enrichment, notify, actions
│       ├── threat_intel/
│       │   ├── __init__.py
│       │   ├── abuseipdb.py          AbuseIPDB API client
│       │   ├── virustotal.py         VirusTotal v3 API client
│       │   └── alienvault.py         AlienVault OTX API client
│       ├── geo/
│       │   ├── __init__.py
│       │   └── ip_lookup.py          ip-api.com (free) / MaxMind GeoIP2 (paid)
│       └── notify/
│           ├── __init__.py
│           └── slack.py              Slack webhook + Block Kit message builder
│
├── prompts/skills/
│   └── incident_response.md          skill system prompt
│
└── docs/
    └── incident_response.md          this document
```

---

## Configuration Reference

```env
# Threat Intelligence — direct API clients
ABUSEIPDB_API_KEY=
ABUSEIPDB_ENABLED=true

VIRUSTOTAL_API_KEY=
VIRUSTOTAL_ENABLED=true

ALIENVAULT_API_KEY=
ALIENVAULT_ENABLED=true

# Geolocation
GEOIP_PROVIDER=ip-api           # ip-api (free) | maxmind (paid)
MAXMIND_LICENSE_KEY=            # required only when GEOIP_PROVIDER=maxmind

# Slack notifications
SLACK_WEBHOOK_URL=
SLACK_DEFAULT_CHANNEL=#soc-alerts
SLACK_CRITICAL_CHANNEL=#soc-critical
SLACK_NOTIFICATIONS_CHANNEL=#soc-notifications

# b-soar integration
SOAR_API_ENABLED=false
SOAR_BASE_URL=
SOAR_API_TOKEN=
```

---

## Requirements Checklist

### `incident_response` Core Skill
- [ ] Input: `signal`, optional `context`, optional `provider`
- [ ] Incident classification: ransomware, brute force, credential stuffing, exfiltration, C2 beaconing, phishing, insider threat, supply chain
- [ ] Severity scoring: Critical / High / Medium / Low with confidence score and rationale
- [ ] MITRE ATT&CK tactic + technique mapping from classified incident type
- [ ] IOC extraction from free-text or structured DQL result (IPs, users, domains, hashes)
- [ ] NIST CSF-structured output: Identify → Protect → Detect → Respond → Recover
- [ ] Chains to `correlate_signals`, `enrich_ioc`, `notify_slack`, `threat_hunt`, `suggest_investigation`, `executive_summary`
- [ ] Prompt: `prompts/skills/incident_response.md`

### `correlate_signals` Skill
- [ ] Input: `iocs` (comma-separated), `time_window` (default `24h`), `streams` (default all)
- [ ] Parallel DQL queries across authentication, firewall, dns, ep-process, ep-network, nta-connection
- [ ] Timeline reconstruction: events N minutes before and after seed IOC timestamp
- [ ] Deduplication and ranking by event frequency and severity
- [ ] LLM-generated pattern analysis (spray → compromise → lateral movement, etc.)
- [ ] Returns unified chronological timeline with stream-tagged events
- [ ] Prompt: `prompts/skills/correlate_signals.md`

### `enrich_ioc` Skill
- [ ] Input: `iocs` (comma-separated IPs, domains, file hashes)
- [ ] Private IP detection and bypass (RFC 1918, loopback, link-local)
- [ ] Per-IOC type routing: IP → reputation + geo, domain → reputation, hash → AV scan
- [ ] Geolocation: country, city, ASN, ISP, datacenter vs residential classification
- [ ] AbuseIPDB: abuse confidence score, total reports, last seen date, usage type
- [ ] VirusTotal: malicious engine count, suspicious count, community score, last analysis date
- [ ] AlienVault OTX: pulse count, adversary tags, malware family associations
- [ ] b-soar routing: when `SOAR_API_ENABLED=true`, route through `/soar/enrich/*`
- [ ] Direct API fallback when SOAR is not configured
- [ ] Graceful skip for sources with no API key configured
- [ ] Enrichment card per IOC with risk level (🔴 HIGH / 🟡 MEDIUM / 🟢 LOW)
- [ ] Prompt: `prompts/skills/enrich_ioc.md`

### `notify_slack` Skill
- [ ] Input: `incident_type`, `severity`, `summary`, optional `affected_assets`, `iocs`, `recommended_actions`, `thread_ts`
- [ ] Slack Block Kit formatted message (not plain text)
- [ ] Severity-based channel routing (configurable via `.env`)
- [ ] Thread support: initial post creates thread, subsequent updates append
- [ ] Webhook-based delivery (no Slack app/OAuth required)
- [ ] Action buttons: View in DNIF Console, Run Threat Hunt, Create Ticket
- [ ] Optional: Microsoft Teams webhook (same data, different format)
- [ ] b-soar routing: when `SOAR_API_ENABLED=true`, route through `/soar/notify/slack`

### TI Integration — Direct Clients
- [ ] `abuseipdb.py`: `async def enrich_ip(ip) → AbuseIPDBResult`
- [ ] `virustotal.py`: `async def enrich_ip(ip) → VTResult`, `enrich_domain()`, `enrich_hash()`
- [ ] `alienvault.py`: `async def enrich_ip(ip) → OTXResult`, `enrich_domain()`, `enrich_hash()`
- [ ] `ip_lookup.py`: `async def geolocate(ip) → GeoResult` (ip-api free / MaxMind paid)
- [ ] Config-driven enable/disable per source
- [ ] Rate limiting and retry with exponential backoff
- [ ] Timeout handling (default 5s per source, sources run concurrently)

### b-soar API Client
- [ ] `soar_client.py`: base async HTTP client with auth header + retry
- [ ] Enrichment: `enrich_ip()`, `enrich_domain()`, `enrich_hash()`
- [ ] Notifications: `notify_slack()`, `notify_teams()`, `notify_email()`
- [ ] Actions: `block_ip()`, `disable_user()`, `isolate_endpoint()`, `create_ticket()`
- [ ] Graceful degradation: if SOAR unreachable, fallback to direct clients

### MCP Tool Registration
- [ ] `enrich_ioc` registered as MCP tool with `iocs` input
- [ ] `correlate_signals` registered as MCP tool
- [ ] `notify_slack` registered as MCP tool
- [ ] `incident_response` registered as MCP tool
- [ ] All tools added to `server/mcp/tools.py`
- [ ] All prompts added to `server/mcp/prompts.py`
- [ ] Skill chain updated in `orchestrator.py`

### Configuration
- [ ] All new `.env` keys added to `config/settings.py`
- [ ] All new keys documented in `docs/mcp.md` configuration reference
- [ ] `.env.example` updated

### Documentation
- [ ] `docs/incident_response.md` — this document
- [ ] `docs/b-copilot.md` — Section 17: Incident Response (summary + skill chain)
- [ ] `docs/mcp.md` — `incident_response`, `correlate_signals`, `enrich_ioc`, `notify_slack` tool entries updated from "coming in Phase 2" to full docs

---

## Build Order

| Phase | What | Dependencies |
|---|---|---|
| IR-1 | `enrich_ioc` skill + direct TI clients (AbuseIPDB, VirusTotal, AlienVault, ip-api) | None |
| IR-2 | `correlate_signals` skill | `translate_to_dql` (exists) |
| IR-3 | `notify_slack` skill | Slack webhook URL |
| IR-4 | `incident_response` orchestrator | IR-1, IR-2, IR-3 |
| IR-5 | b-soar API client + SOAR routing in enrich_ioc + notify_slack | b-soar API available |
| IR-6 | Register all 4 skills as MCP tools | IR-1 through IR-4 |
| IR-7 | `threat_hunt` + `suggest_investigation` + `executive_summary` full implementation | IR-4 |

---

## Example End-to-End Flow

```
User: There are 18 failed logins from 185.211.245.170 targeting DARC.com
      in the last hour and one successful login. Respond to this incident.

→ incident_response classifies: Credential Stuffing, HIGH severity, T1110.003
→ correlate_signals runs DQL across auth + firewall + ep-network for 185.211.245.170
  → finds: spray at 14:03, success at 14:11 (ewallace), lateral movement at 14:14
→ enrich_ioc enriches 185.211.245.170:
  → Russia, TEAM-HOST AS202984, datacenter
  → AbuseIPDB 97%, VirusTotal 18/94, OTX 4 pulses
→ incident_response generates NIST CSF plan:
  Identify: 18 accounts targeted, 1 compromised (ewallace@DARC.com)
  Protect:  Force MFA, disable ewallace, block 185.211.245.170
  Detect:   Enable alerts for logins from RU/VPS infrastructure
  Respond:  Audit ewallace workstation, reset all targeted passwords
  Recover:  Review email sent/received by ewallace in last 30min
→ notify_slack posts to #soc-critical with full context + action buttons
→ suggest_investigation: pivot on ewallace's workstation lateral movement artefacts
→ threat_hunt: generates T1110.003 DQL hunting queries for broader campaign detection
```
