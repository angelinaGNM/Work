# Skill: suggest_investigation

## Purpose
Provide a structured investigation playbook for a given signal, alert, or suspicious activity — guiding the analyst through what to check, what evidence to collect, and what questions to answer.

## Input
- `signal_name` (string): The alert or attack type being investigated
- `signal_data` (object, optional): Available context — SrcIP, User, DevSrcIP, stream fields
- `dql_results` (object, optional): Results from a prior `translate_to_dql` execution
- `user_role` (string, optional): Analyst level — L1, L2, L3

## Behavior

1. Structure the investigation into phases (Prepare → Detect & Analyze → Contain → Post-Incident)
2. Generate specific **investigative questions** based on available signal data
3. Suggest **DQL queries** the analyst should run at each phase
4. Reference `kb/OOTB-2025.xlsx` for known investigation patterns for OOTB signals
5. Tailor depth to analyst level — L1 gets guided steps, L2/L3 gets advanced pivot queries

## Output Format

```
**Investigation: <signal name>**

### Prepare
- <question or check 1>
- <question or check 2>
- <DQL query to run>

### Detection and Analysis
- <what to investigate>
- <pivot points: other users, IPs, systems to correlate>
- <DQL query to run>

### Contain, Eradicate and Recover
- <containment actions>
- <remediation steps>

### Post-Incident
- Document findings per SOP
- Update detection rules if needed
```

## Chaining Suggestions (after output)
- `threat_hunt` — "Would you like me to run a broader threat hunt for related activity?"
- `incident_response` — "Would you like full incident response guidance following NIST CSF?"
- `executive_summary` — "Would you like an executive summary of this investigation?"

## Examples

**Input:** "Brute Force attack" with SrcIP = 192.168.1.50

```
Investigation: Brute Force

### Prepare
- Is 192.168.1.50 a known malicious IP? (check threat intel)
- Does 192.168.1.50 target only one device or multiple?
- Which users were targeted?

DQL:
stream=authentication where action='LOGIN' and status='FAILED' and srcip='192.168.1.50' | duration 1h | groupby user

### Detection and Analysis
- Analyse LDAP/AD logs for the targeted users
- Check if any login succeeded after the failures (potential compromise)
- List all systems the SrcIP communicated with

DQL:
stream=authentication where srcip='192.168.1.50' | duration 1h | groupby user, status

### Contain, Eradicate and Recover
- If malicious, block SrcIP at firewall
- Enable MFA for targeted accounts
- Reset credentials for any compromised accounts

### Post-Incident
- Document all affected users and systems
- Update brute force threshold rules in DNIF
```
