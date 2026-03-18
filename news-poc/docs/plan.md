# Plan: News POC — AI & Cybersecurity News App

## Context
Build a simple, self-contained web app that aggregates the latest AI and Cybersecurity news
from two sources: the NewsAPI.org REST API and curated RSS feeds. No build tools or backend
required — purely browser-runnable HTML/CSS/JS. API key is entered by the user at runtime
and stored in localStorage. RSS feeds are fetched via the allorigins.win CORS proxy.

---

## Folder Structure

```
news-poc/
├── docs/
│   └── plan.md               ← requirements + architecture doc
├── index.html                ← single-page shell, settings panel, card grid
├── css/
│   └── styles.css            ← responsive card layout, dark mode variables
└── js/
    ├── app.js                ← orchestrator: init, tabs, search, auto-refresh
    ├── newsapi.js            ← NewsAPI.org fetch + normalize
    ├── rss.js                ← RSS fetch via allorigins proxy + parse + normalize
    └── bookmarks.js          ← localStorage save/load/toggle bookmarks
```

---

## Requirements

### Categories
- **AI** — fetches from NewsAPI (`q=artificial intelligence`) + RSS (VentureBeat AI, MIT News AI)
- **Cybersecurity** — fetches from NewsAPI (`q=cybersecurity`) + RSS (Krebs on Security, The Hacker News, Bleeping Computer)

### Data Sources
| Source | Type | Notes |
|--------|------|-------|
| NewsAPI.org | REST API | Key stored in localStorage; prompted via settings panel on first load |
| VentureBeat AI | RSS | https://venturebeat.com/category/ai/feed/ |
| MIT News AI | RSS | https://news.mit.edu/topic/artificial-intelligence2/rss.xml |
| Krebs on Security | RSS | https://krebsonsecurity.com/feed/ |
| The Hacker News | RSS | https://feeds.feedburner.com/TheHackersNews |
| Bleeping Computer | RSS | https://www.bleepingcomputer.com/feed/ |

All RSS feeds routed through `https://api.allorigins.win/get?url=<encoded-url>`.

### UI Layout
- Top bar: app title, category tabs (AI / Cybersecurity / Bookmarks), dark mode toggle, settings icon
- Settings panel (slide-in): API key input, auto-refresh interval selector
- Search bar: filters visible cards by headline/snippet in real time
- Card grid: responsive CSS grid, each card shows:
  - Category badge, headline, source name, time ago, snippet, thumbnail (if available)
  - Bookmark icon (filled = saved)
  - "Read more" link opens article in new tab

### Features
| Feature | Implementation |
|---------|----------------|
| Search/filter | `input` event on search bar, filter rendered cards by text |
| Dark mode | CSS custom properties toggled via `data-theme` on `<body>`, preference in localStorage |
| Auto-refresh | `setInterval` (default 10 min, configurable 5/10/30 min) re-fetches all sources |
| Bookmarks | `bookmarks.js` manages array in localStorage; Bookmarks tab shows saved cards |
| API key prompt | Settings panel shown automatically on load if no key in localStorage |

### Data Normalization
Both NewsAPI and RSS items are normalized to a common shape:
```js
{ title, url, source, publishedAt, description, urlToImage, category }
```
Items are deduplicated by URL and sorted by `publishedAt` descending.

---

## Feature: Summarize & Categorize (v2)

### New UI Elements
- **Summarize button** (✦) on each card footer, next to the bookmark icon
- **AI side panel** — slides in from the right, same pattern as settings panel
  - Shows: article title, source, time-ago, two action buttons, output area
  - Only one article open at a time; opening another replaces it
  - Close via ✕ button or overlay click

### Action Buttons
| Button | Output |
|--------|--------|
| Summarize | 3–5 sentence plain-language summary |
| Categorize & Summarize | Topic tags (e.g. `LLMs`, `Ransomware`) + summary paragraph |

### AI Integration
- Model: `claude-haiku-4-5-20251001` (fast, low-cost) via Anthropic Messages API
- Called directly from the browser with `fetch` to `https://api.anthropic.com/v1/messages`
- Claude API key stored in `localStorage` under `news_claude_key`
- If no key set, clicking Summarize prompts user to add it in Settings
- Content sent: article `title` + `description` (no extra fetch needed)
- Results not cached — each button press re-calls the API

### Settings Panel Addition
- New **Claude API Key** field (password input, `news_claude_key` in localStorage)
- Hint: "Used for Summarize & Categorize. Get a key at console.anthropic.com"

### New File
- `js/summarize.js` — Claude API call, prompt construction, response rendering into panel

### Folder Structure (updated)
```
news-poc/
├── docs/
│   └── plan.md
├── index.html
├── css/
│   └── styles.css
└── js/
    ├── app.js
    ├── newsapi.js
    ├── rss.js
    ├── bookmarks.js
    └── summarize.js          ← NEW
```

---

## Feature: Saved Summaries, Select All, Label Grouping & Filters (v3)

### 1. Save Summary Results
- After any Summarize or Categorize & Summarize result renders in the AI panel, a **Save** button appears below the output
- Saving stores the result in `localStorage` under `news_summaries` as an array of entries:
  - `id` — timestamp-based unique ID
  - `mode` — `'summarize'` or `'categorize'`
  - `savedAt` — ISO timestamp
  - `articles` — array of `{ title, url, source, category }` (articles analysed)
  - `tags` — array of unique tag strings extracted (empty for summarize-only)
  - `output` — the full AI text output
- New **Summaries tab** in top navigation (alongside AI / Cybersecurity / Bookmarks)
- Summaries view shows saved results as cards: date saved, mode badge, article title(s), tags, summary preview, delete button

### 2. Select All
- When select mode is active, a **Select All** button appears in the floating select bar
- Selects all articles currently visible (respects active tab + search filter)
- If all visible are already selected, acts as Deselect All (toggle)

### 3. Categorize Output: Grouped by Label
- Multi-article Categorize & Summarize output is grouped by shared tag under **section headers**
- Articles sharing a tag are listed under that section; articles with multiple tags appear in each relevant section
- Single-article categorize stays as-is (tags + summary inline)

### 4. Labels Written Back to Articles
- When a categorize result is generated, extracted tags are written onto the article objects in `state.articles` as a `labels` field
- Also written back onto bookmarked copies if applicable
- Powers label filtering and search

### 5. Label Filter Bar
- Horizontal filter bar above the card grid, populated from all unique labels on `state.articles` for the active tab
- Each label is a clickable pill — clicking toggles it as an active filter
- Multiple labels active at once → OR logic (card matches any selected label)
- Active filters highlighted; **Clear filters** button appears when any filter is active
- Updates automatically when new categorize results add new tags

### 6. Search Saved Summaries by Label
- In Summaries tab, a search bar filters saved results by free text (title, summary) or by clicking a tag pill on any result (filters to all results sharing that tag)

### New File
- `js/saved-summaries.js` — localStorage CRUD for saved summary entries, render Summaries tab

### Updated Files
- `js/summarize.js` — Save button after result, write-back tags to article state
- `js/app.js` — Summaries tab, Select All, label filter bar, label filtering logic
- `css/styles.css` — Summaries cards, label filter bar, grouped output section headers
- `index.html` — Summaries tab button, label filter bar container, saved-summaries.js script tag

---

## Feature: Slack Digest (v4)

### Overview
From the **Summary detail view** (opened by clicking a saved Categorize & Summarize entry), a
**"Send to Slack"** button composes and posts a formatted digest message to a Slack channel.

### Message Format
```
📰 *AI & Cybersecurity Digest — 18 Mar 2026*

🤖 *LLMs*
• Two-sentence AI-generated summary of article. Second sentence here. _(VentureBeat AI)_ <link|Read more>

🦠 *Ransomware*
• Two-sentence AI-generated summary of article. Second sentence here. _(Bleeping Computer)_ <link|Read more>

_Sent from NewsWatch_
```
- **Title line**: `📰 *AI & Cybersecurity Digest — <date>*`
- **One section per label** with an emoji prefix (keyword-matched; cycling colour circles as fallback)
- **One bullet per article**: 2-sentence AI-generated summary, source in italics, Read more link
- No article title in bullets — summary speaks for itself
- Articles appearing under multiple labels assigned to **primary label only** (first tag), no duplication
- Footer: `_Sent from NewsWatch_`

### Emoji Label Mapping
Keyword-matched emojis for common topics (LLMs → 🤖, Ransomware → 🦠, Zero-day → ⚡, etc.).
Unknown labels fall back to a cycling set: 🔵 🟢 🟡 🟠 🔴 🟣 ⚪ 🟤 🔷 🔶

### Slack Integration
- **Primary method**: Slack Bot Token (`xoxb-…`) via local proxy server (see below)
- **Fallback**: Incoming Webhook URL (paste directly, no proxy needed)
- Both stored in `localStorage` (`news_slack_bot_token`, `news_slack_webhook`)
- Channel stored in `localStorage` under `news_slack_channel` (default: `ai-news`)
- If neither is set, clicking "Send to Slack" opens Settings

### Local Proxy Server (required for Bot Token)
Slack's Web API does not support browser CORS requests. A tiny Node.js proxy bridges the gap:
- **File**: `news-poc/slack-proxy.js` (no npm dependencies — built-in `http`/`https` only)
- **Port**: `3002`
- **Start**: `node news-poc/slack-proxy.js`
- Browser POSTs `{ token, channel, text }` to `http://localhost:3002`
- Proxy forwards to `https://slack.com/api/chat.postMessage` with the Bot Token

### Running the App (full setup)
```bash
# Terminal 1 — app server
cd "/home/angelinag/DNIF Official/Projects/claude-code"
python3 -m http.server 8080

# Terminal 2 — Slack proxy
node "/home/angelinag/DNIF Official/Projects/claude-code/news-poc/slack-proxy.js"
```
Then open: `http://localhost:8080/news-poc/`

### Settings Panel Fields Added
| Field | localStorage key | Notes |
|-------|-----------------|-------|
| Slack Bot Token | `news_slack_bot_token` | `xoxb-…`, requires `chat:write` scope |
| Slack Channel | `news_slack_channel` | Channel name without `#`, default `ai-news` |
| Slack Webhook URL | `news_slack_webhook` | Optional fallback, no proxy needed |

### UI
- **"Send to Slack"** button in summary detail panel footer (categorize entries only)
- Loading state ("Sending…") while in flight; disabled after success to prevent double-send
- Inline error message on failure (e.g. `Failed: not_in_channel`)

### Data Flow
1. User opens saved Categorize entry → detail view renders grouped label sections
2. User clicks "📤 Send to Slack"
3. `buildSlackMessage(entry)` groups assignments by primary label, formats mrkdwn
4. `sendToSlack()` POSTs to local proxy → proxy calls Slack API
5. Toast "Digest sent to Slack ✓" on success

### Files
- `js/saved-summaries.js` — `buildSlackMessage`, `emojiForLabel`, `shortenForSlack`, `sendToSlack`, Send button in `openSummaryDetail`
- `slack-proxy.js` — local Node.js CORS proxy (no dependencies)
- `index.html` — Slack settings fields
- `js/app.js` — save/load slack keys in `initSettingsPanel`
- `css/styles.css` — `.slack-send-btn`, `.detail-slack-row`, `.slack-send-status`

---

## Future Extension: News Feeds via BLOO Copilot

### Idea
Integrate NewsWatch's news aggregation and AI summarization capabilities directly into
BLOO Copilot, so users can ask the assistant for the latest AI or cybersecurity news,
get digests on demand, and have news summaries delivered proactively via chat.

### Possible Capabilities
| User asks BLOO | BLOO does |
|----------------|-----------|
| "What's new in AI today?" | Fetches AI RSS feeds, returns top 5 headlines with 1-line summaries |
| "Summarize today's cybersecurity news" | Fetches + runs Claude categorize, returns grouped digest |
| "Send me the news digest on Slack" | Triggers the Slack digest flow automatically |
| "Anything about OpenAI this week?" | Filters fetched articles by keyword, summarizes matches |

### Integration Approach
- **RSS fetching**: Reuse `rss.js` feed list and `fetchSingleFeed` logic, ported to Node.js (`node-fetch` or built-in `fetch`)
- **Summarization**: Call Claude API server-side (already done in mummy-chat-poc pattern) — no browser CORS workaround needed
- **Slack delivery**: Call `chat.postMessage` directly from Node.js — no proxy needed
- **Trigger**: Either on user message ("give me the news") or on a scheduled cron job (e.g. every morning at 9am via `node-cron`)
- **Storage**: Save fetched articles and summaries in a JSON file or lightweight DB (SQLite) so BLOO doesn't re-fetch on every question

### Suggested Architecture
```
bloo-copilot/
└── src/
    ├── skills/
    │   └── news.js       ← fetchFeeds(), summarizeArticles(), buildDigest()
    ├── cron/
    │   └── news-digest.js ← scheduled morning digest via node-cron
    └── server.js          ← existing, add intent handler for "news" queries
```

### Key Difference from NewsWatch
NewsWatch is a standalone browser app for manual browsing and selective summarization.
BLOO Copilot integration would make news **conversational and proactive** —
the assistant surfaces relevant news without the user having to open a separate app.
