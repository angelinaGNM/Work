# Explore Skills — Spec

> Added: 2026-03-23
> Skills: `explore_logs`, `explore_detections`

---

## Background — User-Driven vs Copilot-Driven

`translate_to_dql` is **user-driven**: the user knows what they want and expresses it in natural
language. The copilot translates and executes.

`explore_logs` and `explore_detections` are **copilot-driven**: the user doesn't know what to look
for — they want to browse. The copilot presents structured options and guides them to a result.

These are complementary, not overlapping.

---

## `explore_logs`

### Purpose
Let users browse raw DNIF stream data without needing to formulate a query. Triggered by open-ended
inputs like "check logs", "what's in the logs?", "show me activity".

### Log Categories (options presented to user)

| # | Category | Streams |
|---|---|---|
| 1 | Failed Logins | Authentication streams — failed auth events by user/IP |
| 2 | Privilege Changes | Sudo, role grants, admin assignments |
| 3 | Destructive Operations | File deletes, process terminations, service stops |
| 4 | Network Connections | Outbound/inbound connection attempts, port activity |
| 5 | Endpoint Activity | Process execution, file writes, registry changes |
| 6 | Data Access | Large file reads, bulk queries, sensitive path access |

### Interaction Flow
```
User: "check logs"
  → explore_logs skill
    → [choices event] — present 6 log categories as clickable options
      → User picks "Failed Logins"
        → skill generates DQL for failed auth events
          → executes against DNIF
            → streams results back
```

### Default Time Range
**24 hours.** User can override in natural language ("last 7 days", "this week").

### Notes
- This is raw stream data — not detections or signals
- DQL generation reuses the same pattern as `translate_to_dql` but the query is copilot-generated,
  not user-specified
- After results stream back, offer `translate_to_dql` as a follow-up for more specific queries

---

## `explore_detections`

### Purpose
Let users browse DNIF detections (signals that have fired) without formulating a query. Triggered
by inputs like "show me detections", "what alerts fired?", "any suspicious activity?".

### Detection Categories (options presented to user)

| # | Category | What it covers |
|---|---|---|
| 1 | Authentication Anomalies | Brute force, credential stuffing, impossible travel |
| 2 | Privilege Escalation | Unexpected admin grants, sudo abuse, role changes |
| 3 | Lateral Movement | Internal recon, unusual access between hosts |
| 4 | Data Exfiltration | Bulk exports, large outbound transfers, sensitive data access |
| 5 | Malware / Execution | Suspicious process execution, known bad hashes, script execution |
| 6 | Network Threats | C2 communication, port scanning, DNS anomalies |

### Interaction Flow
```
User: "show me detections"
  → explore_detections skill
    → [choices event] — present 6 detection categories as clickable options
      → User picks "Lateral Movement"
        → skill generates DQL targeting lateral movement signals
          → executes against DNIF
            → streams results back
              → offers: explain_signal, triage_host, incident_response
```

### Default Time Range
**3 days.** Same default as `translate_to_dql`. User can override.

### Notes
- This queries fired signals/detections — not raw logs
- Distinct from `explore_logs` which queries raw streams
- After results, natural chain to `explain_signal`, `triage_*`, `incident_response`

---

## Skill Taxonomy Placement

| Skill | Category | Type |
|---|---|---|
| `explore_logs` | 2B — Operational Queries | Copilot-driven |
| `explore_detections` | 2A — Threat Detections | Copilot-driven |
| `translate_to_dql` | 2A / 2B / 2C | User-driven |

---

## Widget — Choices Event

Both skills yield a `choices` SSE event before executing. The widget renders these as clickable
chips. Once the user picks, the skill resumes and generates + executes the DQL.

```
event: choices
data: {
  "prompt": "What type of logs would you like to check?",
  "options": ["Failed Logins", "Privilege Changes", "Destructive Operations", ...]
}
```

This requires a new SSE event type (`choices`) and corresponding widget handling — to be specced
in `docs/ui-design.md`.
