# BLOO Copilot — UI Design Notes
# Status: PENDING APPROVAL

---

## Known Issue to Fix
The Vite dev proxy buffers SSE responses before forwarding to the React app.
Fix: add `headers: { 'X-Accel-Buffering': 'no' }` to the Vite proxy config
and set `selfHandleResponse: false`. This will be applied alongside the redesign.

---

## Theme

**Light theme** — clean, professional, suitable for a security product.

| Token | Value | Usage |
|---|---|---|
| Page background | `#f1f5f9` | Outer app shell |
| Surface | `#ffffff` | Cards, messages, header |
| Border | `#e2e8f0` | Dividers, card outlines |
| Text primary | `#0f172a` | Main text |
| Text secondary | `#64748b` | Labels, timestamps, hints |
| Accent blue | `#2563eb` | User bubble, send button, links |
| Accent yellow | `#f59e0b` | BLOO brand highlight (bee icon tint) |
| Success green | `#16a34a` | Result events |
| Warning amber | `#d97706` | Waiting / guardrail warnings |
| Error red | `#dc2626` | Error events |
| Code background | `#f8fafc` | Inline code, code blocks |

---

## Layout

```
┌────────────────────────────────────────────┐
│                  HEADER                    │  ← fixed, white, bottom border
│  [bee icon]  BLOO Copilot    [model▾] [●]  │
├────────────────────────────────────────────┤
│                                            │
│              CHAT WINDOW                  │  ← scrollable, #f1f5f9 bg
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  COPILOT MESSAGE CARD (white)        │  │
│  │  ┌─────────────────────────────┐    │  │
│  │  │ ▸ Reasoning   [collapse]    │    │  │  ← collapsible, #f8fafc bg
│  │  │  thinking  Generating DQL  │    │  │
│  │  │  skill     translate_to_dql│    │  │
│  │  └─────────────────────────────┘    │  │
│  │                                      │  │
│  │  Main response (markdown)            │  │  ← clean prose
│  │  ```dql                              │  │  ← syntax-highlighted code block
│  │  stream=auth where...                │  │
│  │  ```                                 │  │
│  │                                      │  │
│  │  ┌─ result ─────────────────────┐   │  │  ← green info box
│  │  │ Query ready. DNIF API pending │   │  │
│  │  └──────────────────────────────┘   │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  [chip: Visualize] [chip: Investigate]     │  ← skill suggestion chips
│                                            │
│                      ┌──────────────────┐  │
│                      │ user message     │  │  ← right-aligned, blue bubble
│                      └──────────────────┘  │
├────────────────────────────────────────────┤
│              INPUT BAR                     │  ← fixed, white, top border
│  [ Ask BLOO something...          ] [➤]   │
└────────────────────────────────────────────┘
```

---

## Header

- White background, 1px bottom border (`#e2e8f0`)
- Left: bee icon (32px) + "BLOO Copilot" bold + "Bloo Hypercloud AI Assistant" subtitle
- Right: model selector dropdown + status dot (green=ready, amber=busy)
- Model selector: outlined dropdown, subtle, not distracting

---

## Chat Window

- Background: `#f1f5f9` (light slate)
- Padding: 20px sides
- Messages stacked vertically with 16px gap
- Auto-scrolls to bottom on new content

---

## Copilot Message Card

- White card (`#ffffff`), rounded corners (12px), subtle shadow (`0 1px 3px rgba(0,0,0,0.08)`)
- Bee avatar (28px, circular) top-left
- Two sections inside the card:

### Section 1 — Reasoning (collapsible)
- Collapsed by default once streaming ends, expanded while streaming
- Toggle button: `▸ Reasoning` / `▾ Reasoning` in secondary text color
- Background: `#f8fafc`, rounded, inside the card
- Events shown as rows:
  - `thinking` → gray italic text, no badge
  - `skill` → `→ skill_name` in blue monospace
  - `waiting` → amber text with ⏳
- Pulsing amber dot on the toggle while streaming

### Section 2 — Response
- Rendered markdown (prose, headings, lists, tables)
- Inline code: light blue background, dark text
- Blinking cursor `▌` at end while streaming

### DQL Code Block (special treatment)
DQL queries get a distinct, styled code block:
```
┌─ DQL ──────────────────────────────── [📋 Copy] ┐
│  stream=authentication                            │
│    where action='LOGIN' and status='FAILED'       │
│    | duration 3d                                  │
│    | groupby user                                 │
│    | limit 20                                     │
└───────────────────────────────────────────────────┘
```
- Header bar: `DQL` label (left) + `📋 Copy` button (right)
- Header background: `#1e3a5f` (dark blue) — makes the block visually distinct
- Code background: `#0f2744` (darker blue) — high contrast for readability
- Code text: `#7dd3fc` (light blue) — easy on the eyes
- Copy button: copies the raw query to clipboard, shows `✓ Copied!` toast for 2s
- Monospace font, line-by-line indented for readability
- Applied to all ` ```dql ` fenced blocks in the response

### Section 3 — Result / Warning boxes
- Shown below the response
- `result` → green left-border box with result text
- `error` → red left-border box
- Guardrail warnings (⚠️) → amber left-border box

---

## User Message

- Right-aligned
- Blue bubble (`#2563eb`), white text, rounded (16px 4px 16px 16px)
- Max width 65%

---

## Skill Suggestion Chips

- Below the copilot card (not inside it)
- Outlined pill buttons, gray border, gray text
- Hover: blue border, blue text
- Example: `[ 📊 Visualize results ]  [ 🔍 Investigate ]  [ 🏹 Threat hunt ]`

---

## Input Bar

- White background, 1px top border
- Full-width textarea (2 rows), rounded, subtle border
- Enter to send, Shift+Enter for new line
- Blue send button (➤), disabled state when loading
- Placeholder: `"Ask BLOO something... (e.g. show me failed logins in the last hour)"`

---

## Typography

| Element | Font | Size | Weight |
|---|---|---|---|
| App title | Inter | 15px | 600 |
| Subtitle | Inter | 11px | 400 |
| Message prose | Inter | 14px | 400 |
| Code blocks | JetBrains Mono / monospace | 13px | 400 |
| Event text | Inter | 12px | 400 |
| Chips | Inter | 12px | 500 |
| Input | Inter | 14px | 400 |

---

## Responsive

- Max width: 860px, centered
- Full height viewport
- Input bar always anchored to bottom

---

---

## UI/UX Tip — Copy with Context

**Tip: When the analyst copies a DQL query, copy a comment header along with it.**

Instead of copying just the raw query, the clipboard gets:

```
# BLOO Copilot — show me failed logins in the last hour
# Generated: 2026-03-16 14:32
stream=authentication where action='LOGIN' and status='FAILED' | duration 3d | limit 20
```

**Why this matters for security teams:**
- Analysts paste queries directly into runbooks, incident tickets (Jira, ServiceNow), and SOC documentation
- The comment preserves *why* the query was written — critical context for post-incident reviews
- Requires zero extra effort from the analyst — one click does it all

**Implementation:** on copy button click, prepend `# BLOO Copilot — {original user query}\n# Generated: {timestamp}\n` to the copied text. Show a `✓ Copied with context!` toast.

---

## Components to build / update

| Component | Change |
|---|---|
| `BlooCopilot.tsx` | Light theme shell, header update |
| `StreamingMessage.tsx` | Card layout, collapsible reasoning, result boxes |
| `SkillChips.tsx` | Light theme chip styling |
| `InputBar.tsx` | Light theme, no change to logic |
| `EventBadge.tsx` | Update colors for light theme |
| `copilot.css` | Full rewrite for light theme |
| `vite.config.ts` | Fix SSE proxy buffering |
