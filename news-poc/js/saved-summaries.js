/**
 * saved-summaries.js — localStorage CRUD for saved AI summary/categorize results.
 *
 * Each entry shape:
 * {
 *   id:        string  (timestamp-based)
 *   mode:      'summarize' | 'categorize'
 *   savedAt:   string  (ISO)
 *   articles:  Array<{ title, url, source, category }>
 *   tags:      string[]
 *   output:    string  (raw AI text)
 * }
 */

const SUMMARIES_KEY = 'news_summaries';

// ===== CRUD =====

function loadSavedSummaries() {
  try {
    return JSON.parse(localStorage.getItem(SUMMARIES_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSummaryEntry(entry) {
  const all = loadSavedSummaries();
  all.unshift(entry); // newest first
  localStorage.setItem(SUMMARIES_KEY, JSON.stringify(all));
}

function deleteSummaryEntry(id) {
  const all = loadSavedSummaries().filter(e => e.id !== id);
  localStorage.setItem(SUMMARIES_KEY, JSON.stringify(all));
}

function buildSummaryEntry(mode, articles, tags, output, assignments = []) {
  return {
    id: `sum_${Date.now()}`,
    mode,
    savedAt: new Date().toISOString(),
    articles: articles.map(a => ({ title: a.title, url: a.url, source: a.source, category: a.category })),
    tags: [...new Set(tags)],
    output,
    // Per-article structured data for the detail view
    assignments: assignments.map(({ article, tags: t, summary: s }) => ({
      article: { title: article.title, url: article.url, source: article.source, category: article.category },
      tags: t,
      summary: s || '',
    })),
  };
}

// ===== Render Summaries Tab =====

function renderSummariesTab(searchQuery = '') {
  const grid = document.getElementById('card-grid');
  if (!grid) return;

  let entries = loadSavedSummaries();

  // Apply search/tag filter
  const q = searchQuery.toLowerCase().trim();
  if (q) {
    entries = entries.filter(e =>
      e.tags.some(t => t.toLowerCase().includes(q)) ||
      e.output.toLowerCase().includes(q) ||
      e.articles.some(a => a.title.toLowerCase().includes(q))
    );
  }

  grid.innerHTML = '';

  if (entries.length === 0) {
    grid.innerHTML = `
      <div class="state-message">
        <div class="state-icon">💾</div>
        <p>${q ? 'No saved summaries match your search.' : 'No saved summaries yet. Run Summarize or Categorize & Summarize on any article and hit Save.'}</p>
      </div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const entry of entries) {
    fragment.appendChild(buildSummaryCard(entry));
  }
  grid.appendChild(fragment);
}

function buildSummaryCard(entry) {
  const card = document.createElement('div');
  card.className = 'summary-card';
  card.style.cursor = 'pointer';

  const date = new Date(entry.savedAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const modeBadge = entry.mode === 'categorize'
    ? '<span class="summary-mode-badge summary-mode-categorize">Categorize & Summarize</span>'
    : '<span class="summary-mode-badge summary-mode-summarize">Summarize</span>';

  const tagsHtml = entry.tags.length
    ? `<div class="summary-tags">${entry.tags.map(t =>
        `<span class="ai-tag summary-tag-clickable" data-tag="${escSummaryHtml(t)}">${escSummaryHtml(t)}</span>`
      ).join('')}</div>`
    : '';

  const articleListHtml = entry.articles.length === 1
    ? `<div class="summary-article-title">${escSummaryHtml(entry.articles[0].title)}</div>`
    : `<div class="summary-article-count-preview">${entry.articles.length} articles — click to view</div>`;

  card.innerHTML = `
    <div class="summary-card-header">
      <div class="summary-card-meta">
        ${modeBadge}
        <span class="summary-date">${escSummaryHtml(date)}</span>
        <span class="summary-article-count">${entry.articles.length} article${entry.articles.length !== 1 ? 's' : ''}</span>
      </div>
      <button class="summary-delete-btn" title="Delete" data-id="${escSummaryHtml(entry.id)}">✕</button>
    </div>
    <div class="summary-card-body">
      ${articleListHtml}
      ${tagsHtml}
      <p class="summary-open-hint">Click to open full view →</p>
    </div>
  `;

  // Click card body → open detail view
  card.addEventListener('click', (e) => {
    if (e.target.closest('.summary-delete-btn, .summary-tag-clickable')) return;
    openSummaryDetail(entry);
  });

  // Delete button
  card.querySelector('.summary-delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteSummaryEntry(entry.id);
    card.remove();
    const grid = document.getElementById('card-grid');
    if (grid && grid.querySelectorAll('.summary-card').length === 0) {
      renderSummariesTab();
    }
  });

  // Tag click — filter summaries by that tag
  card.querySelectorAll('.summary-tag-clickable').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.value = pill.dataset.tag;
        searchInput.dispatchEvent(new Event('input'));
      }
    });
  });

  return card;
}

// ===== Summary Detail View =====
function openSummaryDetail(entry) {
  // Build or reuse overlay
  let overlay = document.getElementById('summary-detail-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'summary-detail-overlay';
    overlay.className = 'summary-detail-overlay';
    document.body.appendChild(overlay);
  }

  const date = new Date(entry.savedAt).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const modeBadge = entry.mode === 'categorize'
    ? '<span class="summary-mode-badge summary-mode-categorize">Categorize & Summarize</span>'
    : '<span class="summary-mode-badge summary-mode-summarize">Summarize</span>';

  let bodyHtml = '';

  if (entry.mode === 'categorize' && entry.assignments && entry.assignments.length > 0) {
    // Group assignments by tag
    const tagGroups = new Map();
    for (const { article, tags } of entry.assignments) {
      for (const tag of (tags || [])) {
        if (!tagGroups.has(tag)) tagGroups.set(tag, []);
        tagGroups.get(tag).push(article);
      }
    }

    if (tagGroups.size > 0) {
      for (const [tag, articles] of tagGroups) {
        const articlesHtml = articles.map(a => `
          <div class="detail-article-item">
            <a href="${escSummaryHtml(a.url)}" target="_blank" rel="noopener noreferrer" class="detail-article-link">${escSummaryHtml(a.title)}</a>
            <span class="detail-article-source">${escSummaryHtml(a.source)}</span>
          </div>`).join('');
        bodyHtml += `
          <div class="detail-section">
            <div class="detail-section-header"><span class="ai-tag">${escSummaryHtml(tag)}</span><span class="detail-section-count">${articles.length} article${articles.length !== 1 ? 's' : ''}</span></div>
            ${articlesHtml}
          </div>`;
      }
    } else {
      bodyHtml = buildDetailFlatList(entry);
    }
  } else if (entry.mode === 'summarize') {
    bodyHtml = buildDetailFlatList(entry);
  } else {
    // categorize but no assignments saved (old entries) — show flat list
    bodyHtml = buildDetailFlatList(entry);
  }

  const hasSlackBtn = entry.mode === 'categorize' && entry.assignments && entry.assignments.length > 0;

  overlay.innerHTML = `
    <div class="summary-detail-panel">
      <div class="summary-detail-header">
        <div class="summary-detail-meta">
          ${modeBadge}
          <span class="summary-date">${escSummaryHtml(date)}</span>
          <span class="summary-article-count">${entry.articles.length} article${entry.articles.length !== 1 ? 's' : ''}</span>
        </div>
        <button class="summary-detail-close" aria-label="Close">✕</button>
      </div>
      ${entry.tags.length ? `<div class="detail-tags-row">${entry.tags.map(t => `<span class="ai-tag">${escSummaryHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="summary-detail-body">${bodyHtml}</div>
      ${hasSlackBtn ? `
        <div class="detail-slack-row">
          <button class="slack-send-btn" id="detail-slack-btn">📤 Send to Slack</button>
          <span class="slack-send-status"></span>
        </div>` : ''}
    </div>
  `;

  overlay.classList.add('open');
  overlay.querySelector('.summary-detail-close').addEventListener('click', () => overlay.classList.remove('open'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });

  const slackBtn = overlay.querySelector('#detail-slack-btn');
  if (slackBtn) {
    slackBtn.addEventListener('click', () => sendToSlack(entry, slackBtn, overlay.querySelector('.slack-send-status')));
  }
}

function buildDetailFlatList(entry) {
  return entry.articles.map((a, i) => `
    <div class="detail-article-item">
      <span class="detail-item-num">${i + 1}</span>
      <div>
        <a href="${escSummaryHtml(a.url)}" target="_blank" rel="noopener noreferrer" class="detail-article-link">${escSummaryHtml(a.title)}</a>
        <span class="detail-article-source">${escSummaryHtml(a.source)}</span>
      </div>
    </div>`).join('');
}

function escSummaryHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===== Slack Integration =====

const LABEL_EMOJI_MAP = [
  { keys: ['llm','large language','gpt','gemini','claude','mistral'],   emoji: '🤖' },
  { keys: ['openai','anthropic','google ai','deepmind','meta ai'],       emoji: '🏢' },
  { keys: ['generative','genai','gen ai','diffusion','image gen'],       emoji: '✨' },
  { keys: ['agent','agentic','autonomous'],                              emoji: '🕹️' },
  { keys: ['safety','alignment','ethics','bias','responsible'],          emoji: '⚖️' },
  { keys: ['research','paper','benchmark','dataset'],                    emoji: '📐' },
  { keys: ['chip','hardware','gpu','tpu','compute','nvidia'],            emoji: '💾' },
  { keys: ['ransomware','malware','trojan','worm','spyware'],            emoji: '🦠' },
  { keys: ['breach','leak','stolen','exposed','theft'],                  emoji: '🔓' },
  { keys: ['vulnerability','zero.?day','exploit','cve','patch'],        emoji: '⚡' },
  { keys: ['phishing','social engineering','scam','fraud'],              emoji: '🎣' },
  { keys: ['privacy','gdpr','regulation','compliance','law'],            emoji: '⚖️' },
  { keys: ['cloud','aws','azure','gcp','infrastructure'],                emoji: '☁️' },
  { keys: ['nation.?state','apt','espionage','government'],              emoji: '🕵️' },
  { keys: ['healthcare','hospital','medical'],                           emoji: '🏥' },
  { keys: ['finance','bank','crypto','payment'],                         emoji: '💰' },
];

const FALLBACK_EMOJIS = ['🔵','🟢','🟡','🟠','🔴','🟣','⚪','🟤','🔷','🔶'];

function emojiForLabel(label, index) {
  const lower = label.toLowerCase();
  for (const { keys, emoji } of LABEL_EMOJI_MAP) {
    if (keys.some(k => new RegExp(k).test(lower))) return emoji;
  }
  return FALLBACK_EMOJIS[index % FALLBACK_EMOJIS.length];
}

function buildSlackMessage(entry) {
  const date = new Date(entry.savedAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  // Group articles by primary label (first tag in each assignment)
  const primaryGroups = new Map();
  for (const assignment of (entry.assignments || [])) {
    const label = (assignment.tags && assignment.tags[0]) || 'General';
    if (!primaryGroups.has(label)) primaryGroups.set(label, []);
    primaryGroups.get(label).push(assignment);
  }

  let msg = `📰 *AI & Cybersecurity Digest — ${date}*\n\n`;

  let sectionIndex = 0;
  for (const [label, items] of primaryGroups) {
    const emoji = emojiForLabel(label, sectionIndex++);
    msg += `${emoji} *${label}*\n`;
    for (const item of items) {
      const url    = item.article.url    || '';
      const source = item.article.source || '';
      const blurb  = item.summary ? shortenForSlack(item.summary) : item.article.title || '';
      msg += `• ${blurb}`;
      if (source) msg += ` _(${source})_`;
      if (url) msg += ` <${url}|Read more>`;
      msg += '\n';
    }
    msg += '\n';
  }

  msg += '_Sent from NewsWatch_';
  return msg;
}

function shortenForSlack(text) {
  // First two sentences, capped at 280 chars total
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const two = sentences.slice(0, 2).join(' ').trim();
  if (two) return two.length > 280 ? two.slice(0, 280).trim() + '…' : two;
  return text.length > 280 ? text.slice(0, 280).trim() + '…' : text.trim();
}

async function sendToSlack(entry, btnEl, statusEl) {
  const botToken   = localStorage.getItem('news_slack_bot_token') || '';
  const webhookUrl = localStorage.getItem('news_slack_webhook') || '';

  if (!botToken && !webhookUrl) {
    document.getElementById('settings-btn')?.click();
    if (statusEl) statusEl.textContent = 'Add a Slack Bot Token in Settings first.';
    return;
  }

  btnEl.disabled = true;
  btnEl.textContent = 'Sending…';
  if (statusEl) statusEl.textContent = '';

  try {
    const text = buildSlackMessage(entry);

    if (botToken) {
      // Primary: route through local proxy (Slack API blocks direct browser CORS)
      const channel = localStorage.getItem('news_slack_channel') || 'ai-news';
      const res = await fetch('http://localhost:3002', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: botToken, channel, text }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Slack API error');
    } else {
      // Fallback: Incoming Webhook
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mrkdwn: true }),
      });
      if (!res.ok) throw new Error(`Slack returned ${res.status}`);
    }

    btnEl.textContent = '✓ Sent to Slack';
    if (typeof showToast === 'function') showToast('Digest sent to Slack ✓');
  } catch (err) {
    btnEl.disabled = false;
    btnEl.textContent = '📤 Send to Slack';
    if (statusEl) statusEl.textContent = `Failed: ${err.message}`;
  }
}
