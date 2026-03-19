# Skill: incident_response

## Purpose
Provide structured incident response guidance for a given attack type or active incident, organized across the NIST Cybersecurity Framework (CSF) phases.

## Input
- `incident_type` (string): Type of attack or incident (e.g. "Ransomware", "Credential Stuffing", "Data Exfiltration")
- `signal_data` (object, optional): Available context — affected users, IPs, systems
- `investigation_findings` (object, optional): Output from a prior `suggest_investigation` result

## Behavior

1. Map the incident to **MITRE ATT&CK Tactic(s) and Technique(s)**
2. Structure the response across all **5 NIST CSF phases**: Identify → Protect → Detect → Respond → Recover
3. For each phase, provide specific, actionable steps tailored to the DNIF context
4. Include relevant **DQL queries** the responder should run during the Detect phase
5. Include **containment and eradication** steps in the Respond phase
6. Adapt detail level to user role — L1 gets a checklist, L2/L3 gets technical depth

## Output Format

```
**Incident Response: <incident type>**
**MITRE ATT&CK:** Tactic: <tactic> | Technique: <T####>

**Overview:** <brief description of the attack and its impact>

---

### Identify
- <asset inventory checks>
- <affected systems/users to enumerate>

### Protect
- <immediate protective measures>
- <access controls, MFA, isolation>

### Detect
- <what to look for in DNIF>
- DQL queries to run:
\```dql
<detection query>
\```

### Respond
- <containment steps>
- <eradication steps>
- <communication steps (internal, legal, regulatory)>

### Recover
- <restoration steps>
- <verification steps>
- <lessons learned>

---

### Post-Incident Documentation
- Update SOP based on findings
- Review and tune detection rules in DNIF
- Document timeline, affected assets, actions taken
```

## Chaining Suggestions (after output)
- `executive_summary` — "Would you like an executive summary of this incident for leadership?"

## Examples

**Input:** "Brute Force attack" with SrcIP = 192.168.1.50, affected users = ["admin", "jdoe"]

```
Incident Response: Brute Force

### Identify
- Enumerate all accounts targeted by 192.168.1.50
- Identify whether any targeted account had a successful login after failed attempts

### Protect
- Immediately enforce MFA for admin and jdoe
- Review account lockout policy threshold

### Detect
DQL:
stream=authentication where srcip='192.168.1.50' | duration 24h | groupby user, status

### Respond
- Block 192.168.1.50 at the perimeter firewall
- Reset passwords for admin and jdoe
- Notify affected users

### Recover
- Verify no unauthorized sessions remain active
- Monitor the accounts for 72 hours post-incident
```
