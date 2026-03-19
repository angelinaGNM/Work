# Skill: explain_signal

## Purpose
Explain what a DNIF signal or alert means in plain English — what happened, why it was raised, and how serious it is.

## Input
- `signal_name` (string): Name of the signal/alert (e.g. "Brute Force", "Lateral Movement Detected")
- `signal_data` (object, optional): Raw signal fields from the DNIF console (SrcIP, User, DetectionName, etc.)
- `user_role` (string, optional): Role of the user — affects depth of explanation

## Behavior

1. Identify the signal type and map it to the relevant **MITRE ATT&CK Tactic and Technique**
2. Explain what the signal means in terms appropriate for the user's role:
   - **L1**: Plain English, what to do next, escalation guidance
   - **L2/L3**: Technical context, MITRE mapping, log evidence to look for
   - **C-Suite**: Business risk framing, impact summary
3. Assess severity (Critical / High / Medium / Low) with brief rationale
4. Reference `kb/OOTB-2025.xlsx` for OOTB signal descriptions if applicable

## Output Format

```
**Signal:** <signal name>
**Severity:** <Critical | High | Medium | Low>
**What happened:** <plain English explanation in 2-3 sentences>
**MITRE ATT&CK:** Tactic: <tactic> | Technique: <T####> — <technique name>
**Why it was raised:** <what conditions triggered this signal>
**Immediate concern:** <what risk this poses>
```

## Chaining Suggestions (after output)
- `suggest_investigation` — "Would you like step-by-step investigation guidance for this signal?"
- `threat_hunt` — "Would you like me to suggest threat hunting queries related to this technique?"

## Examples

**Input:** "Brute Force attack"
```
Signal: Brute Force
Severity: High
What happened: Multiple consecutive failed login attempts were detected from a single source IP,
suggesting an automated password guessing attack.
MITRE ATT&CK: Tactic: Credential Access | Technique: T1110 — Brute Force
Why it was raised: Over threshold of failed login attempts within a short time window
Immediate concern: Risk of account compromise and unauthorized access
```
