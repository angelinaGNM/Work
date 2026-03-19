# Skill: translate_to_dql

## Purpose
Translate a natural language query into a valid DQL (DNIF Query Language) statement.

## Input
- `query` (string): The user's natural language request
- `stream` (string, optional): The target data stream if known
- `duration` (string, optional): Time range specified by the user

## Behavior

1. Identify the **target stream** from the query context (authentication, firewall, ep-process, signals, etc.)
2. If no stream is mentioned, ask the user which stream to query
3. If no duration is mentioned, ask the user for a time range before generating the query
4. **Duration guardrail**: If the duration exceeds **3 days**, automatically clip it to `3d` and prepend a warning:
   > ⚠️ This is a compute-intensive query. Duration has been clipped to 3 days to keep it performant.
5. **Record guardrail**: Always append `| limit 20` to the query. If the user specified a limit > 20, clip it to 20 and note it.
6. If the user uses natural language for time (e.g. "yesterday", "last 3 days"), resolve to absolute `YYYY-MM-DDTHH:MM:SS` using NOW()
7. Generate the DQL query using correct syntax from `kb/dql-kb.md`
8. Always use **lowercase field names** in the query
9. Follow the standard keyword order: `where → duration → timeslice → first/last → groupby → having → limit`

## Output Format

```
**DQL Query:**
\```dql
<generated query>
\```

**Explanation:** <brief plain-English description of what the query does>

**SQL Equivalent** (if requested):
\```sql
<SQL translation with $field prefix and UPPERCASE stream names>
\```
```

## Chaining Suggestions (after output)
- `suggest_visualization` — "Would you like me to suggest a visualization for this query?"
- `suggest_investigation` — "Would you like me to suggest investigation steps based on these results?"
- `threat_hunt` — "Would you like me to suggest threat hunting queries related to this activity?"
- `incident_response` — "Would you like incident response guidance for this scenario?"

## Examples

**Input:** "Show me all failed logins in the last hour"
```dql
stream=authentication where action='LOGIN' and status='FAILED' | duration 1h
```

**Input:** "Who logged in from outside the country yesterday?"
```dql
stream=authentication where action='LOGIN' and srctype='Public' | duration from 2024-01-14T00:00:00 to 2024-01-14T23:59:59
```

**Input:** "Top 10 users with failed logins this month"
```dql
stream=authentication where action='LOGIN' and status='FAILED' | duration 1M | groupby user | having count_col1 > 0 | limit 10
```

## Notes
- Reference `kb/dql-kb.md` for full keyword list, field names, functions, and directives
- For `_checkif` and `_sort by` directives, instruct the user to run them in a **separate DQL query pane**
- For `like` operator usage: `stream=ep-process where commandline like '%AppData%'`
