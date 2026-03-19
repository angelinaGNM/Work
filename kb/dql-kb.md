# DQL Knowledge Base
# DNIF Query Language (DQL) — Version 9
# This file is pipeline-updatable. Do not edit manually during scheduled KB refreshes.

---

## Overview

DQL (DNIF Query Language) is a query language built for the DNIF SIEM platform.
It is similar to SQL and is used to analyze log data ingested from devices across an organization's network.
Tables in SQL are called **Dataset Streams** in DQL.

Reference: https://www.dnif.it/en/kb

---

## Basic Syntax

```dql
stream=<stream_name> | <keyword> <condition> | <keyword> ...
```

- Stream names are **lowercase**
- Field names are **lowercase** in queries
- The **pipe operator `|`** is used to chain conditions and keywords
- String values use single quotes: `'value'`

### Fetch all records from a stream
```dql
stream=authentication
```

### Select specific fields
```dql
stream=authentication | select user, srcip
```

### Limit results
```dql
stream=authentication | limit 100
```

---

## Keywords

| Keyword | Description | Example |
|---|---|---|
| `where` | Filter condition (like SQL WHERE) | `where status='FAILED'` |
| `select` | Display specific fields | `select user, srcip` |
| `limit` | Restrict number of rows returned | `limit 100` |
| `first` | View oldest/first records from stream | `first 50` |
| `last` | View latest/most recent records | `last 50` |
| `groupby` | Group results by field(s) — like SQL GROUP BY | `groupby user` |
| `having` | Condition after groupby — like SQL HAVING | `having count_col1 > 100` |
| `distinct` | Return unique values of a field | `distinct user` |
| `duration` | Filter by time range | `duration 1h` |
| `timeslice` | Count events per time interval | `timeslice 1m` |
| `like` | Pattern matching — like SQL LIKE | `where commandline like '%AppData%'` |

### Keyword Order
```
stream=<name> where <condition> | duration <range> | timeslice <interval> | first/last <n> | groupby <field> | having <condition> | limit <n>
```

---

## Duration

### Relative durations
| Notation | Meaning |
|---|---|
| `1m` | 1 minute |
| `1h` | 1 hour |
| `1d` | 1 day |
| `1w` | 1 week |
| `1M` | 1 month |

```dql
stream=authentication | duration 1h
stream=authentication | duration 10m | timeslice 1m
```

### Absolute duration range
Format: `YYYY-MM-DDTHH:MM:SS` (24-hour)

```dql
stream=authentication | duration from 2024-01-01T10:00:00 to 2024-01-02T19:00:00
```

### Natural language duration
Resolve to absolute timestamps using NOW() before generating the query.
- "yesterday" → from YYYY-MM-DDT00:00:00 to YYYY-MM-DDT23:59:59
- "last 3 days" → from (NOW - 3d) to NOW

> **Query safety rule:** Always ask for duration if not specified. If duration > 7 days, warn the user about query weight.

---

## Aggregate Functions

### count (default after groupby)
DQL automatically generates `count_col1`, `count_col2` etc. after a groupby.

```dql
stream=authentication | groupby user | having count_col1 > 100
```

### count_if
Count records that match a specific condition within a groupby.

```dql
stream=authentication where action='LOGIN' and status='FAILED' | groupby user | select user, count_if(reason='BAD_USER_PASSWORD') as failed_passwords
```

Having with count_if: use `count_if_col1`
```dql
stream=FIREWALL | groupby dstip | select dstip, count_if(dstport==23) | having count_if_col1 > 0
```

### distinct_count
Count distinct values of a field within a groupby.

```dql
stream=authentication | groupby srcip | select srcip, distinct_count(user)
```

Having with distinct_count: use `distinct_count_col1`
```dql
stream=firewall | groupby dstcn | select dstcn, distinct_count(dstip) | having distinct_count_col1 > 10
```

### percentage_of
```dql
stream=FIREWALL | groupby dstip | select dstip, percentage_of(dstport==23)
```

### ratio_of
```dql
stream=FIREWALL | groupby dstip | select dstip, ratio_of(dstport==23)
```

---

## Directives

> **Important:** Directives must be run in a **separate DQL query pane** from the main query.

### _checkif
Filters rows based on a condition applied to a field.

```
_checkif [function] [include | exclude]
```

Functions:
- `int_compare $field > | < | = | != | >= | <= integer`
- `str_compare $field [ eq | neq | substr ] 'string' | regex 'pattern'`
- `key_exists $field`
- `lookup eventstore_name join $field1 = $field2 [condition] [include | exclude]`

Example:
- Pane 1: `stream=firewall | select sourcename, srccn`
- Pane 2: `_checkif key_exists srccn include`

### _sort by
Sorts results from a prior query.

Example:
- Pane 1: `stream=authentication where action='LOGIN' and status='FAILED' | groupby user`
- Pane 2: `_sort by count_col1 ASC`

### _fetch
Similar to SELECT in SQL — fetches directly from the event store.

```dql
_fetch * from event where $Stream=FIREWALL AND $Duration=1M limit 5
```

---

## SQL Spark Functions

These functions follow MySQL-like syntax.

| Function | Description | Example |
|---|---|---|
| `concat` | Concatenate field values (no separator) | `select concat(user, srcip)` |
| `concat_ws` | Concatenate with a separator | `select concat_ws('-', user, srcip)` |
| `locate` | Find pattern position in a string | `select locate('@', 'user')` |

---

## SQL Translation Rules

When translating DQL to SQL:
- Prefix all field names with `$` symbol
- Use UPPERCASE for stream/table names
- Example:

```sql
SELECT $SrcIP, COUNT(*) FROM FIREWALL WHERE $Action='PACKET_BLOCKED' AND $DstPort=80 GROUP BY $SrcIP HAVING COUNT(*) > 10
```

---

## Stream: Authentication

Fields for the `authentication` stream. Use **lowercase** field names in queries.

| Field | Description | Values |
|---|---|---|
| `cnamtime` | Timestamp of log event on DNIF console | — |
| `system` | Host Name | — |
| `sourcename` | Device Name | — |
| `sourcetype` | Device Type | — |
| `stream` | Stream name | — |
| `action` | Action taken on the log event | `LOGIN` / `LOGOUT` |
| `user` | Name of the user | — |
| `srcip` | Source IP address | — |
| `authproto` | Authentication Protocol | — |
| `devsrcip` | Device Source IP address | — |
| `eid` | Event ID (Windows Logs only) | — |
| `evtlen` | Event Length | — |
| `reason` | Reason for authentication failure | `BAD_USER_PASSWORD` / `USER_DISABLED` / `INVALID_CREDENTIALS` |
| `srctype` | Source Type | `Public` / `Private` |
| `status` | Status of the event | `FAILED` / `PASSED` |
| `systemtstamp` | Log sample date field | — |
| `xhour` | Hour representation | — |
| `xminute` | Minute representation | — |
| `srccn` | Source Country | — |
| `srcasn` | Source Autonomous System Number | — |
| `srcisp` | Source Internet Service Provider | — |
| `extractorid` | Extractor Identification Number | — |
| `estatus` | Enriched Status | — |
| `pstatus` | Parsing Status | — |
| `logevent` | Raw Event Log | — |

---

## Visualization Mappings

When suggesting visualizations, use these mappings:

| Chart Type | Widget Name | Best for |
|---|---|---|
| Bar / Column | `Bar` | Comparing counts across categories |
| Stacked Bar | `Bar` (Type: Stacked) | Two dimensions + count |
| Grouped Bar | `Bar` (Type: Group) | Side-by-side comparison of two dimensions |
| Pie / Donut | `Pie` (Type: Default or Donut) | Distribution / proportions |
| Bubble | `Bubble` | Three-variable relationship |
| Radial | `Radial` | Multi-category proportional view |
| Stacked Radial | `Radial` (Type: Stacked) | Radial with second dimension |
| Bipartite Chord | `BipartiteChord` | Flow/relationship between two entity sets |
| Timebar | `Timebar` | Signal/event timelines with start and end |

### Visualization Output Format
```
DQL Query: <query>
Widget Name: <name>
Field1: <field>
Field2: <field>
Field3: <field> (Stacked/Group only)
Type: <Default | Stacked | Group | Donut>
```

Also output as JSON:
```json
{
  "dql_query": "",
  "widget": "",
  "field1": "",
  "field2": "",
  "field3": null,
  "type": ""
}
```

---

## Common Query Examples

### Failed logins in last hour
```dql
stream=authentication where action='LOGIN' and status='FAILED' | duration 1h
```

### Users with over 100 failed logins in a month
```dql
stream=authentication where action='LOGIN' and status='FAILED' | duration 1M | groupby user | having count_col1 > 100
```

### Logins grouped by action and status
```dql
stream=authentication | groupby action, status
```

### Count of logs per minute over last 10 minutes
```dql
stream=authentication | duration 10m | timeslice 1m
```

### Search for process commandline pattern
```dql
stream=ep-process where commandline like '%AppData%' or commandline like 'http%' | select commandline, image
```

### Signal timeline
```dql
stream=signals | groupby detectionname, firstseen, lastseen
```

---

## Cybersecurity Use Case Response Format

When responding to a cybersecurity use case (e.g. "insider attacks"), use this structure:

```
Overview: <50 words or less>
References: <3 resources>
MITRE Tactic|Technique: <tactic, technique, sub-techniques>
DQL Query: <sample queries on authentication and relevant streams>
SQL Query: <DQL translated to SQL>
Visualizations: <suggested visualization plots>
Mitigation Measures:
  - Identify: ...
  - Protect: ...
  - Detect: ...
  - Respond: ...
  - Recover: ...
```

---

## KB Maintenance Notes

- This file is updated via a scheduled pipeline
- Stream field definitions are also maintained in `stream_action.txt` and `stream_DDM.txt`
- OOTB signal library is maintained in `OOTB-2025.xlsx`
- Full internal DQL v9 reference is in `DNIF-DQL-Internal.pdf`
- Last reviewed: 2026-03-16
