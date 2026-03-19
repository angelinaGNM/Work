# DQL Quick Reference — Runtime Use

## Basic Syntax
```
stream=<name> | where <cond> | duration <range> | groupby <field> | having <cond> | limit <n>
```
- Fields: lowercase. Strings: single quotes. Pipe `|` chains clauses.

## Keywords
| Keyword | Usage |
|---|---|
| `where` | filter: `where status='FAILED' and action='LOGIN'` |
| `select` | fields: `select user, srcip` |
| `groupby` | group: `groupby user` → auto-creates `count_col1` |
| `having` | post-group filter: `having count_col1 > 10` |
| `limit` | cap rows: `limit 20` |
| `first/last` | oldest/newest N rows |
| `duration` | time filter (see below) |
| `timeslice` | event count per interval: `timeslice 1m` |
| `like` | pattern: `where cmd like '%AppData%'` |

## Duration
- Relative: `1m` `1h` `1d` `3d` `1w` `1M`
- Absolute: `duration from 2024-01-01T00:00:00 to 2024-01-03T23:59:59`
- Natural language → resolve to absolute using NOW()

## Aggregate Functions
- `count_if(cond)` → `count_if_col1` in having
- `distinct_count(field)` → `distinct_count_col1` in having
- `percentage_of(cond)`, `ratio_of(cond)`

## Directives (run in separate pane)
- `_checkif key_exists $field include/exclude`
- `_checkif int_compare $field > N include`
- `_checkif str_compare $field eq 'val' include`
- `_sort by count_col1 ASC`
- `_fetch * from event where $Stream=FIREWALL AND $Duration=1M limit 5`

## Authentication Stream Fields
`cnamtime` `system` `sourcename` `sourcetype` `action`(LOGIN/LOGOUT)
`user` `srcip` `authproto` `devsrcip` `eid` `reason`(BAD_USER_PASSWORD/USER_DISABLED/INVALID_CREDENTIALS)
`srctype`(Public/Private) `status`(FAILED/PASSED) `srccn` `srcasn` `srcisp`
`extractorid` `estatus` `pstatus` `logevent`

## Guardrails (enforce always)
- Duration > 3 days → clip to `3d`
- Always append `| limit 20` unless user specifies lower
