/**
 * summarize.js — Claude API integration for Summarize & Categorize actions.
 *
 * Exposes:
 *   openSummarizePanel(article)  — open the panel for a given article
 *   closeSummarizePanel()        — close the panel
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL   = 'claude-haiku-4-5-20251001';
const CLAUDE_KEY_KEY = 'news_claude_key';

// ===== Panel State =====
let currentArticle  = null;   // single-article mode
let currentArticles = null;   // multi-article mode

// ===== Panel DOM (built once, reused) =====
let panelEl = null;
let overlayEl = null;

function ensurePanel() {
  if (panelEl) return;

  // Overlay
  overlayEl = document.createElement('div');
  overlayEl.className = 'ai-panel-overlay';
  overlayEl.addEventListener('click', closeSummarizePanel);
  document.body.appendChild(overlayEl);

  // Panel
  panelEl = document.createElement('aside');
  panelEl.className = 'ai-panel';
  panelEl.setAttribute('aria-label', 'Article AI analysis');
  panelEl.innerHTML = `
    <div class="ai-panel-header">
      <h2>✦ AI Analysis</h2>
      <button class="settings-close ai-panel-close" aria-label="Close panel">✕</button>
    </div>
    <div class="ai-panel-body">
      <div class="ai-article-meta" id="ai-article-meta"></div>
      <div class="ai-actions">
        <button class="ai-action-btn" id="ai-btn-summarize">Summarize</button>
        <button class="ai-action-btn ai-action-btn--accent" id="ai-btn-categorize">Categorize &amp; Summarize</button>
      </div>
      <div class="ai-output" id="ai-output"></div>
    </div>
  `;
  document.body.appendChild(panelEl);

  panelEl.querySelector('.ai-panel-close').addEventListener('click', closeSummarizePanel);
  panelEl.querySelector('#ai-btn-summarize').addEventListener('click', () => {
    currentArticles ? runMultiAction('summarize') : runAction('summarize');
  });
  panelEl.querySelector('#ai-btn-categorize').addEventListener('click', () => {
    currentArticles ? runMultiAction('categorize') : runAction('categorize');
  });
}

// ===== Open / Close =====
function openSummarizePanel(article) {
  ensurePanel();
  currentArticle = article;

  // Populate article meta
  const meta = panelEl.querySelector('#ai-article-meta');
  meta.innerHTML = `
    <h3 class="ai-article-title">${escHtml(article.title)}</h3>
    <div class="ai-article-source">
      <span class="badge ${article.category === 'ai' ? 'badge-ai' : 'badge-cybersecurity'}">
        ${article.category === 'ai' ? 'AI' : 'Cybersecurity'}
      </span>
      <span>${escHtml(article.source)}</span>
      <span class="card-dot"></span>
      <span>${formatTimeAgo(article.publishedAt)}</span>
    </div>
    ${article.description ? `<p class="ai-article-snippet">${escHtml(article.description)}</p>` : ''}
  `;

  // Clear previous output
  panelEl.querySelector('#ai-output').innerHTML = '';

  overlayEl.classList.add('open');
  panelEl.classList.add('open');
}

// ===== Open multi-article panel =====
function openSummarizePanelMulti(articles, defaultMode) {
  ensurePanel();
  currentArticle  = null;
  currentArticles = articles;

  const meta = panelEl.querySelector('#ai-article-meta');
  meta.innerHTML = `
    <div class="ai-multi-header">
      <strong>✦ ${articles.length} articles selected</strong>
    </div>
    <ol class="ai-multi-list">
      ${articles.map(a => `
        <li>
          <span class="badge ${a.category === 'ai' ? 'badge-ai' : 'badge-cybersecurity'}" style="font-size:0.65rem">${a.category === 'ai' ? 'AI' : 'Cyber'}</span>
          ${escHtml(a.title)}
        </li>`).join('')}
    </ol>
  `;

  panelEl.querySelector('#ai-output').innerHTML = '';
  overlayEl.classList.add('open');
  panelEl.classList.add('open');

  if (defaultMode) runMultiAction(defaultMode);
}

function closeSummarizePanel() {
  if (!panelEl) return;
  overlayEl.classList.remove('open');
  panelEl.classList.remove('open');
  currentArticle  = null;
  currentArticles = null;
}

// ===== Run Action =====
async function runAction(mode) {
  if (!currentArticle) return;

  const claudeKey = localStorage.getItem(CLAUDE_KEY_KEY) || '';
  if (!claudeKey) {
    showAIOutput(`
      <div class="ai-no-key">
        <p>⚠️ No Claude API key set.</p>
        <p>Add your key in <strong>Settings (⚙️)</strong> under "Claude API Key".</p>
        <p>Get one at <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a>.</p>
      </div>
    `);
    return;
  }

  const outputEl = panelEl.querySelector('#ai-output');
  outputEl.innerHTML = '<div class="ai-loading"><div class="loading-spinner"></div><p>Thinking…</p></div>';
  setActionBtnsDisabled(true);

  try {
    const prompt = buildPrompt(currentArticle, mode);
    const result = await callClaude(claudeKey, prompt);
    const tags = renderResult(result, mode);
    const assignments = mode === 'categorize' ? [{ article: currentArticle, tags }] : [];
    if (mode === 'categorize') writeTagsToArticles(assignments);
    appendSaveButton(mode, [currentArticle], tags, result, assignments);
  } catch (err) {
    outputEl.innerHTML = `<div class="ai-error">⚠️ ${escHtml(err.message || 'Request failed. Check your API key and try again.')}</div>`;
  } finally {
    setActionBtnsDisabled(false);
  }
}

// ===== Prompt Building =====
function buildPrompt(article, mode) {
  const context = `Title: ${article.title}\n\nSource: ${article.source}\n\nSnippet: ${article.description || '(no description available)'}`;

  if (mode === 'summarize') {
    return {
      system: 'You are a concise news analyst. You receive article metadata (title, source, snippet) and produce a clear, 3–5 sentence summary in plain language. Acknowledge you are working from a snippet, not the full article.',
      user: `Please summarize this article:\n\n${context}`,
    };
  } else {
    return {
      system: 'You are a news analyst. You receive article metadata (title, source, snippet) and produce: 1) A list of 3–6 specific topic tags (e.g. "LLMs", "Zero-day exploit", "OpenAI", "Ransomware") and 2) A 3–5 sentence summary. Format your response as:\n\nTAGS: tag1, tag2, tag3\n\nSUMMARY: <your summary here>',
      user: `Please categorize and summarize this article:\n\n${context}`,
    };
  }
}

// ===== Claude API Call =====
async function callClaude(apiKey, { system, user }, maxTokens = 512) {
  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ===== Render Result (single article) — returns tags array =====
function renderResult(text, mode) {
  const outputEl = panelEl.querySelector('#ai-output');

  if (mode === 'summarize') {
    outputEl.innerHTML = `
      <div class="ai-result">
        <div class="ai-result-label">Summary</div>
        <p class="ai-result-text">${escHtml(text)}</p>
      </div>`;
    return [];
  }

  const tagsMatch   = text.match(/TAGS:\s*(.+?)(?:\n|$)/i);
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]+)/i);
  const tagsRaw  = tagsMatch   ? tagsMatch[1].trim()   : '';
  const summary  = summaryMatch ? summaryMatch[1].trim() : text;
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  const tagsHtml = tags.map(t => `<span class="ai-tag">${escHtml(t)}</span>`).join('');

  outputEl.innerHTML = `
    <div class="ai-result">
      ${tagsHtml ? `<div class="ai-result-label">Topics</div><div class="ai-tags">${tagsHtml}</div>` : ''}
      <div class="ai-result-label" style="margin-top:14px">Summary</div>
      <p class="ai-result-text">${escHtml(summary)}</p>
    </div>`;

  return tags;
}

// ===== Multi-Article Action =====
async function runMultiAction(mode) {
  if (!currentArticles || currentArticles.length === 0) return;

  const claudeKey = localStorage.getItem(CLAUDE_KEY_KEY) || '';
  if (!claudeKey) {
    showAIOutput(`
      <div class="ai-no-key">
        <p>⚠️ No Claude API key set.</p>
        <p>Add your key in <strong>Settings (⚙️)</strong> under "Claude API Key".</p>
        <p>Get one at <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a>.</p>
      </div>`);
    return;
  }

  const outputEl = panelEl.querySelector('#ai-output');
  outputEl.innerHTML = `<div class="ai-loading"><div class="loading-spinner"></div><p>Analysing ${currentArticles.length} articles…</p></div>`;
  setActionBtnsDisabled(true);

  try {
    const prompt = buildMultiPrompt(currentArticles, mode);
    const result = await callClaude(claudeKey, prompt, 2048);
    const { allTags, assignments } = renderMultiResult(result, mode, currentArticles.length);
    if (mode === 'categorize') writeTagsToArticles(assignments);
    appendSaveButton(mode, currentArticles, allTags, result, assignments);
  } catch (err) {
    outputEl.innerHTML = `<div class="ai-error">⚠️ ${escHtml(err.message || 'Request failed. Check your API key and try again.')}</div>`;
  } finally {
    setActionBtnsDisabled(false);
  }
}

function buildMultiPrompt(articles, mode) {
  const articlesText = articles.map((a, i) =>
    `Article ${i + 1}:\nTitle: ${a.title}\nSource: ${a.source}\nSnippet: ${a.description || '(no description available)'}`
  ).join('\n\n---\n\n');

  if (mode === 'summarize') {
    return {
      system: 'You are a concise news analyst. You receive multiple articles (title, source, snippet each). For each article produce a numbered 2–3 sentence summary. Format strictly as:\n\n1. [2-3 sentence summary]\n2. [2-3 sentence summary]\n...',
      user: `Please summarize each of these ${articles.length} articles:\n\n${articlesText}`,
    };
  } else {
    return {
      system: 'You are a news analyst. You receive multiple articles. For each article produce: topic tags and a 2–3 sentence summary. Format strictly as:\n\n1.\nTAGS: tag1, tag2, tag3\nSUMMARY: [summary]\n\n2.\nTAGS: ...\nSUMMARY: ...\n\nand so on.',
      user: `Please categorize and summarize each of these ${articles.length} articles:\n\n${articlesText}`,
    };
  }
}

// ===== Render Multi Result — returns { allTags, assignments } =====
function renderMultiResult(text, mode, count) {
  const outputEl = panelEl.querySelector('#ai-output');

  if (mode === 'summarize') {
    const blocks = text.split(/\n(?=\d+\.)/).map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
    const html = blocks.map((summary, i) => `
      <div class="ai-multi-item">
        <div class="ai-multi-item-num">${i + 1}</div>
        <div>
          <div class="ai-result-label" style="margin-bottom:4px">${escHtml(currentArticles[i]?.source || '')}</div>
          <p class="ai-result-text">${escHtml(summary)}</p>
        </div>
      </div>`).join('');
    outputEl.innerHTML = `<div class="ai-result"><div class="ai-result-label">Summaries (${blocks.length} of ${count})</div>${html}</div>`;
    return { allTags: [], assignments: [] };
  }

  // ---- Categorize: parse blocks ----
  const blocks = text.split(/\n(?=\d+\.\n)/).map(s => s.replace(/^\d+\.\s*\n?/, '').trim()).filter(Boolean);

  const parsed = blocks.map((block, i) => {
    const tagsMatch    = block.match(/TAGS:\s*(.+?)(?:\n|$)/i);
    const summaryMatch = block.match(/SUMMARY:\s*([\s\S]+)/i);
    const tagsRaw = tagsMatch ? tagsMatch[1].trim() : '';
    const tags    = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    const summary = summaryMatch ? summaryMatch[1].trim() : block;
    return { article: currentArticles[i], tags, summary, idx: i + 1 };
  });

  // Count tag frequency across all articles, keep top 10
  const tagFreq = new Map();
  for (const item of parsed) {
    for (const tag of item.tags) tagFreq.set(tag, (tagFreq.get(tag) || 0) + 1);
  }
  const top10Set = new Set(
    [...tagFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t)
  );

  // Filter each article's tags to top 10 only
  for (const item of parsed) item.tags = item.tags.filter(t => top10Set.has(t));
  const allTags = [...top10Set];

  // Build tag → items map for grouped display
  const tagGroups = new Map();
  for (const item of parsed) {
    for (const tag of item.tags) {
      if (!tagGroups.has(tag)) tagGroups.set(tag, []);
      tagGroups.get(tag).push(item);
    }
  }

  // Render grouped sections
  let sectionsHtml = '';
  if (tagGroups.size > 0) {
    for (const [tag, items] of tagGroups) {
      const itemsHtml = items.map(item => `
        <div class="ai-multi-item">
          <div class="ai-multi-item-num">${item.idx}</div>
          <div style="flex:1;min-width:0">
            <div class="ai-result-label" style="margin-bottom:4px">${escHtml(item.article?.source || '')}</div>
            <p class="ai-result-text" style="font-size:0.82rem">${escHtml(item.article?.title || '')}</p>
            <p class="ai-result-text">${escHtml(item.summary)}</p>
          </div>
        </div>`).join('');
      sectionsHtml += `
        <div class="ai-group-section">
          <div class="ai-group-header"><span class="ai-tag">${escHtml(tag)}</span><span class="ai-group-count">${items.length} article${items.length !== 1 ? 's' : ''}</span></div>
          ${itemsHtml}
        </div>`;
    }
  } else {
    sectionsHtml = parsed.map(item => `
      <div class="ai-multi-item">
        <div class="ai-multi-item-num">${item.idx}</div>
        <div style="flex:1;min-width:0">
          <div class="ai-result-label" style="margin-bottom:4px">${escHtml(item.article?.source || '')}</div>
          <p class="ai-result-text">${escHtml(item.summary)}</p>
        </div>
      </div>`).join('');
  }

  outputEl.innerHTML = `<div class="ai-result"><div class="ai-result-label">Categorised & Summarised — ${tagGroups.size} label${tagGroups.size !== 1 ? 's' : ''}</div>${sectionsHtml}</div>`;

  const assignments = parsed.map(({ article, tags, summary }) => ({ article, tags, summary }));
  return { allTags, assignments };
}

// ===== Save Button =====
function appendSaveButton(mode, articles, tags, rawOutput, assignments = []) {
  const outputEl = panelEl.querySelector('#ai-output');
  const saveWrap = document.createElement('div');
  saveWrap.className = 'ai-save-wrap';
  saveWrap.innerHTML = `<button class="ai-save-btn">💾 Save result</button>`;
  saveWrap.querySelector('.ai-save-btn').addEventListener('click', function () {
    const entry = buildSummaryEntry(mode, articles, tags, rawOutput, assignments);
    saveSummaryEntry(entry);
    this.textContent = '✓ Saved';
    this.disabled = true;
    if (typeof showToast === 'function') showToast('Summary saved');
  });
  outputEl.appendChild(saveWrap);
}

// ===== Write Per-Article Tags Back to State =====
// assignments: [{ article, tags }]
function writeTagsToArticles(assignments) {
  if (!assignments || assignments.length === 0) return;
  const allArrays = [
    ...(typeof state !== 'undefined' ? state.articles.ai : []),
    ...(typeof state !== 'undefined' ? state.articles.cybersecurity : []),
  ];
  for (const { article, tags } of assignments) {
    if (!tags || tags.length === 0) continue;
    const match = allArrays.find(a => a.url === article.url);
    if (match) match.labels = [...new Set([...(match.labels || []), ...tags])];
  }
  if (typeof refreshLabelFilters === 'function') refreshLabelFilters();
  if (typeof renderCards === 'function') renderCards();
}

// ===== Helpers =====
function showAIOutput(html) {
  if (!panelEl) return;
  panelEl.querySelector('#ai-output').innerHTML = html;
}

function setActionBtnsDisabled(disabled) {
  if (!panelEl) return;
  panelEl.querySelectorAll('.ai-action-btn').forEach(b => b.disabled = disabled);
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
