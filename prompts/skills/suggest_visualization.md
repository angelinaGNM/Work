# Skill: suggest_visualization

## Purpose
Recommend the most appropriate DNIF dashboard visualization (widget type, fields, configuration) for a given DQL query or data scenario.

## Input
- `dql_query` (string): The DQL query to visualize
- `intent` (string, optional): What the user wants to see (e.g. "trend over time", "top attackers", "distribution by country")

## Behavior

1. Analyze the DQL query — what fields are being grouped, what counts are being generated
2. Select the most appropriate chart type based on the data shape and user intent
3. Map the groupby fields to Widget Field1, Field2, Field3 slots
4. Output both a human-readable recommendation and a JSON config block
5. Reference `kb/dql-kb.md` visualization mappings for chart selection logic

## Chart Selection Guide

| Use case | Widget |
|---|---|
| Compare counts across categories | Bar / Column |
| Part-of-whole distribution | Pie / Donut |
| Two dimensions stacked/grouped | Stacked or Grouped Bar |
| Trends over time | Timebar |
| Relationship between two entities | BipartiteChord |
| Proportional multi-metric | Radial |
| Three-variable scatter | Bubble |

## Output Format

Human-readable:
```
**Recommended Visualization**
Widget: <widget name>
Field1: <field>
Field2: <field>
Field3: <field> (if applicable)
Type: <Default | Stacked | Group | Donut>
Why: <one sentence rationale>
```

JSON config:
```json
{
  "dql_query": "<query>",
  "widget": "<widget name>",
  "field1": "<field>",
  "field2": "<field>",
  "field3": "<field or null>",
  "type": "<Default | Stacked | Group | Donut>"
}
```

## Chaining Suggestions (after output)
This skill is typically a terminal step — no further chaining required unless the user asks to investigate the data.

## Examples

**Input:** `stream=authentication where action='LOGIN' and status='FAILED' | groupby user`

```
Widget: Bar
Field1: user
Field2: count_col1
Type: Default
Why: Comparing failed login counts across users — a simple bar chart is ideal.
```

**Input:** `stream=authentication | groupby action, status`

```
Widget: Bar
Field1: action
Field2: status
Field3: count_col1
Type: Stacked
Why: Two categorical dimensions with a count — stacked bar shows composition.
```

**Input:** `stream=signals | groupby detectionname, firstseen, lastseen`

```
Widget: Timebar
Field1: detectionname
Field2: firstseen
Field3: lastseen
Why: Signal timeline data — Timebar is designed for detection event ranges.
```
