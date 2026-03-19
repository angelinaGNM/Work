# Skill: threat_hunt

## Purpose
Suggest proactive threat hunting DQL queries and investigation angles for a given MITRE ATT&CK tactic, technique, or attack scenario.

## Input
- `scenario` (string): Attack type, MITRE tactic/technique, or threat description
- `stream` (string, optional): Preferred stream to hunt in
- `signal_data` (object, optional): Context from a prior explain_signal or suggest_investigation result

## Behavior

1. Map the scenario to relevant **MITRE ATT&CK Tactics and Techniques**
2. Identify which **DNIF streams** are most relevant for this hunt
3. Generate **3–5 DQL hunting queries** targeting different angles of the technique
4. For each query, explain what it is hunting for and what a positive result would mean
5. Reference `kb/OOTB-2025.xlsx` for any OOTB signals that already cover this technique
6. Reference `kb/dql-kb.md` for correct stream field names

## Output Format

```
**Threat Hunt: <scenario>**
**MITRE ATT&CK:** Tactic: <tactic> | Technique: <T####> — <name>

**Overview:** <2-3 sentences on what this hunt is looking for>

**References:**
- <resource 1>
- <resource 2>
- <resource 3>

---

### Hunt Query 1: <hunt angle>
\```dql
<query>
\```
**What to look for:** <what a hit means>

### Hunt Query 2: <hunt angle>
\```dql
<query>
\```
**What to look for:** <what a hit means>

[...repeat for each query...]

---

**OOTB Signals to check:** <list any relevant OOTB signals from DNIF>
```

## Chaining Suggestions (after output)
- `executive_summary` — "Would you like an executive summary of this threat hunt?"
- `incident_response` — "If you find hits, would you like incident response guidance?"

## Examples

**Input:** "Brute Force"

```
Threat Hunt: Brute Force
MITRE ATT&CK: Tactic: Credential Access | Technique: T1110 — Brute Force

Hunt Query 1: Failed login spike by IP
stream=authentication where action='LOGIN' and status='FAILED' | duration 1h | groupby srcip | having count_col1 > 50

Hunt Query 2: Failed logins followed by success (potential compromise)
stream=authentication where status='FAILED' | duration 1h | groupby user
[then] stream=authentication where status='PASSED' and user='<flagged_user>' | duration 1h

Hunt Query 3: Logins from public IPs
stream=authentication where action='LOGIN' and srctype='Public' | duration 1h | groupby srcip, user
```
