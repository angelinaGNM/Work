/**
 * app.js — Orchestrator: init, tabs, search, auto-refresh, render cards.
 *
 * Depends on: newsapi.js, rss.js, bookmarks.js
 */

// ===== State =====
const state = {
  activeTab: 'ai',          // 'ai' | 'cybersecurity' | 'bookmarks' | 'summaries'
  articles: { ai: [], cybersecurity: [] },
  searchQuery: '',
  loading: false,
  refreshTimer: null,
  lastRefresh: null,
  fetchLog: [],             // per-source status entries
  selectMode: false,        // multi-select mode
  selectedUrls: new Set(),  // URLs of selected articles
  activeLabels: new Set(),  // active label filter pills
};

// ===== Storage Keys =====
const KEYS = {
  darkMode: 'news_dark_mode',
  refreshInterval: 'news_refresh_interval',
  newsWindow: 'news_window',
  slackBotToken: 'news_slack_bot_token',
  slackChannel:  'news_slack_channel',
  slackWebhook:  'news_slack_webhook',
};
// CLAUDE_KEY_KEY is defined in summarize.js (loaded before this file)

// ===== DOM References =====
const $ = id => document.getElementById(id);
const dom = {};

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initDomRefs();
  initTheme();
  initTabs();
  initSearch();
  initSettingsPanel();
  initRefreshBtn();
  initSelectMode();
  initLabelFilters();

  fetchAll();
  scheduleAutoRefresh();
});

function initDomRefs() {
  dom.cardGrid    = $('card-grid');
  dom.searchInput = $('search-input');
  dom.statusText  = $('status-text');
  dom.tabBtns     = document.querySelectorAll('.tab-btn');
  dom.themeToggle = $('theme-toggle');
  dom.settingsBtn = $('settings-btn');
  dom.settingsOverlay = $('settings-overlay');
  dom.settingsPanel   = $('settings-panel');
  dom.settingsClose   = $('settings-close');
  dom.claudeKeyInput    = $('claude-key-input');
  dom.slackTokenInput   = $('slack-token-input');
  dom.slackChannelInput = $('slack-channel-input');
  dom.slackWebhookInput = $('slack-webhook-input');
  dom.newsWindowSelect  = $('news-window-select');
  dom.refreshSelect     = $('refresh-select');
  dom.saveSettings    = $('save-settings');
  dom.refreshBtn      = $('refresh-btn');
  dom.refreshIcon     = $('refresh-icon');
  dom.fetchLog        = $('fetch-log');
  dom.selectToggle    = $('select-toggle');
  dom.selectBar       = $('select-bar');
  dom.selectCount     = $('select-count');
  dom.labelFilterBar  = $('label-filter-bar');
}

// ===== Theme =====
function initTheme() {
  const dark = localStorage.getItem(KEYS.darkMode) === 'true';
  applyTheme(dark);
  dom.themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    applyTheme(!isDark);
    localStorage.setItem(KEYS.darkMode, String(!isDark));
  });
}

function applyTheme(dark) {
  document.body.setAttribute('data-theme', dark ? 'dark' : 'light');
  dom.themeToggle.textContent = dark ? '☀️' : '🌙';
}

// ===== Tabs =====
function initTabs() {
  dom.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.tab;
      dom.tabBtns.forEach(b => b.classList.toggle('active', b === btn));
      // Hide label filter bar and select controls on summaries/bookmarks tabs
      const showFilters = state.activeTab === 'ai' || state.activeTab === 'cybersecurity';
      if (dom.labelFilterBar) dom.labelFilterBar.hidden = !showFilters;
      if (dom.selectToggle) dom.selectToggle.style.display = showFilters ? '' : 'none';
      if (!showFilters && state.selectMode) {
        state.selectMode = false;
        state.selectedUrls.clear();
        dom.selectToggle.classList.remove('active');
        dom.selectToggle.textContent = '☑ Select';
        document.body.classList.remove('select-mode');
        updateSelectBar();
      }
      renderCards();
    });
  });
}

// ===== Search =====
function initSearch() {
  dom.searchInput.addEventListener('input', () => {
    state.searchQuery = dom.searchInput.value.toLowerCase().trim();
    renderCards();
  });
}

// ===== Settings Panel =====
function initSettingsPanel() {
  dom.claudeKeyInput.value    = localStorage.getItem(CLAUDE_KEY_KEY) || '';
  dom.slackTokenInput.value   = localStorage.getItem(KEYS.slackBotToken) || '';
  dom.slackChannelInput.value = localStorage.getItem(KEYS.slackChannel) || 'ai-news';
  dom.slackWebhookInput.value = localStorage.getItem(KEYS.slackWebhook) || '';
  dom.refreshSelect.value     = localStorage.getItem(KEYS.refreshInterval) || '10';
  dom.newsWindowSelect.value  = localStorage.getItem(KEYS.newsWindow) || '1';

  dom.settingsBtn.addEventListener('click', openSettings);
  dom.settingsClose.addEventListener('click', closeSettings);
  dom.settingsOverlay.addEventListener('click', closeSettings);

  dom.saveSettings.addEventListener('click', () => {
    const claudeKey    = dom.claudeKeyInput.value.trim();
    const slackToken   = dom.slackTokenInput.value.trim();
    const slackChannel = dom.slackChannelInput.value.trim();
    const slackWebhook = dom.slackWebhookInput.value.trim();
    if (claudeKey)    localStorage.setItem(CLAUDE_KEY_KEY, claudeKey);
    if (slackToken)   localStorage.setItem(KEYS.slackBotToken, slackToken);
    if (slackChannel) localStorage.setItem(KEYS.slackChannel, slackChannel);
    if (slackWebhook) localStorage.setItem(KEYS.slackWebhook, slackWebhook);
    localStorage.setItem(KEYS.refreshInterval, dom.refreshSelect.value);
    localStorage.setItem(KEYS.newsWindow, dom.newsWindowSelect.value);

    closeSettings();
    scheduleAutoRefresh();
    fetchAll();
    showToast('Settings saved');
  });
}

function openSettings() {
  dom.settingsOverlay.classList.add('open');
  dom.settingsPanel.classList.add('open');
}

function closeSettings() {
  dom.settingsOverlay.classList.remove('open');
  dom.settingsPanel.classList.remove('open');
}

// ===== Refresh Button =====
function initRefreshBtn() {
  dom.refreshBtn.addEventListener('click', () => {
    if (!state.loading) fetchAll();
  });
}

// ===== Multi-Select =====
function initSelectMode() {
  dom.selectToggle.addEventListener('click', () => {
    state.selectMode = !state.selectMode;
    state.selectedUrls.clear();
    dom.selectToggle.classList.toggle('active', state.selectMode);
    dom.selectToggle.textContent = state.selectMode ? '✕ Cancel' : '☑ Select';
    document.body.classList.toggle('select-mode', state.selectMode);
    renderCards();
    updateSelectBar();
  });

  $('select-bar-summarize').addEventListener('click', () => {
    const articles = getSelectedArticles();
    if (articles.length) openSummarizePanelMulti(articles, 'summarize');
  });

  $('select-bar-categorize').addEventListener('click', () => {
    const articles = getSelectedArticles();
    if (articles.length) openSummarizePanelMulti(articles, 'categorize');
  });

  $('select-bar-clear').addEventListener('click', () => {
    state.selectedUrls.clear();
    renderCards();
    updateSelectBar();
  });

  $('select-bar-select-all').addEventListener('click', () => {
    const visible = getVisibleArticles();
    const allSelected = visible.every(a => state.selectedUrls.has(a.url));
    if (allSelected) {
      visible.forEach(a => state.selectedUrls.delete(a.url));
    } else {
      visible.forEach(a => state.selectedUrls.add(a.url));
    }
    // Update card visuals directly — avoids full DOM rebuild
    dom.cardGrid.querySelectorAll('.news-card[data-url]').forEach(cardEl => {
      const selected = state.selectedUrls.has(cardEl.dataset.url);
      cardEl.classList.toggle('selected', selected);
      const cb = cardEl.querySelector('.card-checkbox');
      if (cb) cb.textContent = selected ? '☑' : '☐';
    });
    updateSelectBar();
  });
}

function getSelectedArticles() {
  const all = [
    ...(state.articles.ai || []),
    ...(state.articles.cybersecurity || []),
    ...loadBookmarks(),
  ];
  const seen = new Set();
  return all.filter(a => {
    if (state.selectedUrls.has(a.url) && !seen.has(a.url)) {
      seen.add(a.url);
      return true;
    }
    return false;
  });
}

function updateSelectBar() {
  const count = state.selectedUrls.size;
  const visible = getVisibleArticles();
  const allSelected = visible.length > 0 && visible.every(a => state.selectedUrls.has(a.url));
  dom.selectBar.classList.toggle('visible', state.selectMode);
  dom.selectCount.textContent = count > 0
    ? `${count} article${count !== 1 ? 's' : ''} selected`
    : 'Click articles to select';
  const selectAllBtn = $('select-bar-select-all');
  if (selectAllBtn) selectAllBtn.textContent = allSelected ? 'Deselect All' : 'Select All';
}

// Returns the articles currently visible in the grid (respects tab + search + label filters)
function getVisibleArticles() {
  let articles = state.activeTab === 'bookmarks'
    ? loadBookmarks()
    : (state.articles[state.activeTab] || []);
  if (state.activeLabels.size > 0) {
    articles = articles.filter(a => (a.labels || []).some(l => state.activeLabels.has(l)));
  }
  if (state.searchQuery) {
    articles = articles.filter(a =>
      a.title.toLowerCase().includes(state.searchQuery) ||
      (a.description || '').toLowerCase().includes(state.searchQuery) ||
      (a.source || '').toLowerCase().includes(state.searchQuery)
    );
  }
  return articles;
}

// ===== Label Filters =====
function initLabelFilters() {
  // Populated dynamically by refreshLabelFilters()
}

function refreshLabelFilters() {
  if (!dom.labelFilterBar) return;
  const tab = state.activeTab === 'ai' || state.activeTab === 'cybersecurity' ? state.activeTab : null;
  if (!tab) return;

  const articles = state.articles[tab] || [];
  const allLabels = [...new Set(articles.flatMap(a => a.labels || []))].sort();

  if (allLabels.length === 0) {
    dom.labelFilterBar.hidden = true;
    return;
  }

  dom.labelFilterBar.hidden = false;
  dom.labelFilterBar.innerHTML = `
    <span class="filter-bar-label">Filter by label:</span>
    ${allLabels.map(l => `
      <button class="label-pill ${state.activeLabels.has(l) ? 'active' : ''}" data-label="${escHtml(l)}">${escHtml(l)}</button>
    `).join('')}
    ${state.activeLabels.size > 0 ? '<button class="label-pill-clear">✕ Clear filters</button>' : ''}
  `;

  dom.labelFilterBar.querySelectorAll('.label-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.dataset.label;
      if (state.activeLabels.has(label)) {
        state.activeLabels.delete(label);
      } else {
        state.activeLabels.add(label);
      }
      refreshLabelFilters();
      renderCards();
    });
  });

  const clearBtn = dom.labelFilterBar.querySelector('.label-pill-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.activeLabels.clear();
      refreshLabelFilters();
      renderCards();
    });
  }
}

// ===== Auto Refresh =====
function scheduleAutoRefresh() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  const minutes = parseInt(localStorage.getItem(KEYS.refreshInterval) || '10', 10);
  // Always run — RSS feeds work without an API key
  state.refreshTimer = setInterval(fetchAll, minutes * 60 * 1000);
}

// ===== Fetch All =====
async function fetchAll() {
  if (state.loading) return;
  state.loading = true;
  state.fetchLog = [];
  setLoadingUI(true);
  renderFetchLog();

  // Only show the loading spinner on first load (no articles yet).
  // On subsequent refreshes keep the existing cards visible — don't wipe the grid.
  const isFirstLoad = state.articles.ai.length === 0 && state.articles.cybersecurity.length === 0;
  if (isFirstLoad) renderCards();

  const days   = parseInt(localStorage.getItem(KEYS.newsWindow) || '1', 10);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Helper: wrap a fetch promise with per-source log updates
  function tracked(label, promise) {
    addLogEntry(label, 'loading');
    return promise.then(
      articles => { updateLogEntry(label, 'ok', articles.length); return articles; },
      err      => { updateLogEntry(label, 'error', 0, err); return []; }
    );
  }

  // Apply news window cutoff to RSS results client-side
  function withinWindow(promise) {
    return promise.then(articles =>
      articles.filter(a => a.publishedAt > new Date(0) ? a.publishedAt >= cutoff : true)
    );
  }

  const sources = [
    tracked('VentureBeat AI',    withinWindow(fetchSingleFeed('https://venturebeat.com/category/ai/feed/', 'VentureBeat AI', 'ai'))),
    tracked('MIT News AI',       withinWindow(fetchSingleFeed('https://news.mit.edu/topic/artificial-intelligence2/rss.xml', 'MIT News AI', 'ai'))),
    tracked('TechCrunch AI',     withinWindow(fetchSingleFeed('https://techcrunch.com/category/artificial-intelligence/feed/', 'TechCrunch AI', 'ai'))),
    tracked('The Verge AI',      withinWindow(fetchSingleFeed('https://www.theverge.com/ai-artificial-intelligence/rss/index.xml', 'The Verge AI', 'ai'))),
    tracked('Microsoft AI Blog', withinWindow(fetchSingleFeed('https://blogs.microsoft.com/ai/feed/', 'Microsoft AI Blog', 'ai'))),
    tracked('OpenAI News',       withinWindow(fetchSingleFeed('https://openai.com/news/rss.xml', 'OpenAI News', 'ai'))),
    tracked('Krebs on Security', withinWindow(fetchSingleFeed('https://krebsonsecurity.com/feed/', 'Krebs on Security', 'cybersecurity'))),
    tracked('The Hacker News',   withinWindow(fetchSingleFeed('https://feeds.feedburner.com/TheHackersNews', 'The Hacker News', 'cybersecurity'))),
    tracked('Bleeping Computer', withinWindow(fetchSingleFeed('https://www.bleepingcomputer.com/feed/', 'Bleeping Computer', 'cybersecurity'))),
  ];

  const [vbAi, mitAi, tcAi, tvAi, msAi, oaiAi, krebs, thn, bc] = await Promise.all(sources);

  const prevAi    = state.articles.ai.length;
  const prevCyber = state.articles.cybersecurity.length;

  state.articles.ai            = mergeAndDeduplicate(state.articles.ai,           vbAi, mitAi, tcAi, tvAi, msAi, oaiAi);
  state.articles.cybersecurity = mergeAndDeduplicate(state.articles.cybersecurity, krebs, thn, bc);
  state.lastRefresh = new Date();

  const newAi    = state.articles.ai.length    - prevAi;
  const newCyber = state.articles.cybersecurity.length - prevCyber;
  const totalNew = newAi + newCyber;

  state.loading = false;
  setLoadingUI(false);
  renderCards();
  updateStatus();
  renderFetchLog(); // final state with all counts

  if (!isFirstLoad) {
    showToast(totalNew > 0 ? `+${totalNew} new article${totalNew !== 1 ? 's' : ''}` : 'Up to date');
  }
}

/**
 * Merge arrays, deduplicate by URL, sort by publishedAt descending.
 */
function mergeAndDeduplicate(...arrays) {
  const seen = new Set();
  const merged = [];
  for (const arr of arrays) {
    for (const article of arr) {
      if (article.url && !seen.has(article.url)) {
        seen.add(article.url);
        merged.push(article);
      }
    }
  }
  merged.sort((a, b) => b.publishedAt - a.publishedAt);
  return merged;
}

// ===== Fetch Log =====
function addLogEntry(label, status) {
  state.fetchLog.push({ label, status, count: null });
  renderFetchLog();
}

function updateLogEntry(label, status, count, err) {
  const entry = state.fetchLog.find(e => e.label === label);
  if (entry) { entry.status = status; entry.count = count; entry.err = err; }
  renderFetchLog();
}

function renderFetchLog() {
  if (!dom.fetchLog) return;

  if (state.fetchLog.length === 0) {
    dom.fetchLog.innerHTML = '';
    dom.fetchLog.hidden = true;
    return;
  }

  const icons = { loading: '⏳', ok: '✓', error: '✗', skipped: '—' };
  const rows = state.fetchLog.map(e => {
    let detail = '';
    if (e.status === 'loading')  detail = 'fetching…';
    else if (e.status === 'ok')  detail = `${e.count} article${e.count !== 1 ? 's' : ''}`;
    else if (e.status === 'skipped') detail = 'no API key';
    else if (e.status === 'error')   detail = e.err?.message ? `failed: ${e.err.message}` : 'failed';

    return `<span class="log-row log-${e.status}">${icons[e.status]} <b>${e.label}</b> — ${detail}</span>`;
  }).join('');

  dom.fetchLog.hidden = false;
  dom.fetchLog.innerHTML = rows;
}

// ===== UI Helpers =====
function setLoadingUI(loading) {
  dom.refreshBtn.classList.toggle('spinning', loading);
  dom.refreshIcon.textContent = '↻';
  if (!loading) {
    const totalArticles = state.articles.ai.length + state.articles.cybersecurity.length;
    if (totalArticles > 0) {
      // Articles loaded fine — hide log after 6 seconds
      setTimeout(() => {
        if (dom.fetchLog) dom.fetchLog.hidden = true;
        state.fetchLog = [];
      }, 6000);
    }
    // If 0 articles, keep log visible so user can see what failed
  }
}

function updateStatus() {
  if (!state.lastRefresh) {
    dom.statusText.textContent = '';
    return;
  }
  const count = state.activeTab === 'bookmarks'
    ? loadBookmarks().length
    : (state.articles[state.activeTab] || []).length;
  const time = state.lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const total = state.articles.ai.length + state.articles.cybersecurity.length;
  dom.statusText.textContent = `${count} articles shown · ${total} total · Updated ${time}`;
}

// ===== Render Cards =====
function renderCards() {
  updateStatus();

  // Summaries tab — delegate entirely
  if (state.activeTab === 'summaries') {
    renderSummariesTab(state.searchQuery);
    return;
  }

  let articles;
  if (state.activeTab === 'bookmarks') {
    articles = loadBookmarks();
  } else {
    articles = state.articles[state.activeTab] || [];
  }

  // Apply label filters (OR logic — match any active label)
  if (state.activeLabels.size > 0) {
    articles = articles.filter(a =>
      (a.labels || []).some(l => state.activeLabels.has(l))
    );
  }

  // Apply text search filter
  if (state.searchQuery) {
    articles = articles.filter(a =>
      a.title.toLowerCase().includes(state.searchQuery) ||
      (a.description || '').toLowerCase().includes(state.searchQuery) ||
      (a.source || '').toLowerCase().includes(state.searchQuery) ||
      (a.labels || []).some(l => l.toLowerCase().includes(state.searchQuery))
    );
  }

  dom.cardGrid.innerHTML = '';

  if (state.loading && articles.length === 0) {
    dom.cardGrid.innerHTML = `
      <div class="state-message">
        <div class="loading-spinner"></div>
        <p>Fetching the latest news…</p>
      </div>`;
    return;
  }

  if (articles.length === 0) {
    const icon = state.activeTab === 'bookmarks' ? '🔖' : '📰';
    const msg = state.activeTab === 'bookmarks'
      ? 'No bookmarks yet. Click the bookmark icon on any article to save it.'
      : state.searchQuery || state.activeLabels.size > 0
        ? 'No articles match your filters.'
        : state.loading
          ? 'Fetching articles…'
          : 'No articles loaded. Check the fetch log above — if all sources show "0 articles", try widening the News Window in Settings (⚙️) to "Last 3 days".';
    dom.cardGrid.innerHTML = `
      <div class="state-message">
        <div class="state-icon">${icon}</div>
        <p>${msg}</p>
      </div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const article of articles) {
    fragment.appendChild(createCard(article));
  }
  dom.cardGrid.appendChild(fragment);
}

// ===== Card Creation =====
function createCard(article) {
  const card = document.createElement('div');
  const isSelected = state.selectedUrls.has(article.url);
  card.className = 'news-card' + (isSelected ? ' selected' : '');
  card.dataset.url = article.url;

  const thumbnailHtml = article.urlToImage
    ? `<img class="card-thumbnail" src="${escHtml(article.urlToImage)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\"card-thumbnail-placeholder\\">📰</div>'">`
    : `<div class="card-thumbnail-placeholder">${article.category === 'ai' ? '🤖' : '🔒'}</div>`;

  const badgeClass = article.category === 'ai' ? 'badge-ai' : 'badge-cybersecurity';
  const badgeLabel = article.category === 'ai' ? 'AI' : 'Cybersecurity';

  const timeAgo = formatTimeAgo(article.publishedAt);
  const bookmarked = isBookmarked(article.url);

  const checkboxHtml = `<div class="card-checkbox" aria-hidden="true">${isSelected ? '☑' : '☐'}</div>`;

  card.innerHTML = `
    <div class="card-thumb-wrap">
      ${thumbnailHtml}
      ${checkboxHtml}
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="badge ${badgeClass}">${badgeLabel}</span>
        <span class="card-source">${escHtml(article.source)}</span>
        <span class="card-dot"></span>
        <span class="card-time">${escHtml(timeAgo)}</span>
      </div>
      <h3 class="card-title">${escHtml(article.title)}</h3>
      ${article.description ? `<p class="card-description">${escHtml(article.description)}</p>` : ''}
      ${article.labels && article.labels.length ? `<div class="card-labels">${article.labels.map(l => `<span class="card-label-pill">${escHtml(l)}</span>`).join('')}</div>` : ''}
      <div class="card-footer">
        <a href="${escHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="read-more">
          Read more →
        </a>
        <div class="card-actions">
          <button class="summarize-btn" title="Summarize with AI">✦</button>
          <button class="bookmark-btn ${bookmarked ? 'active' : ''}" title="${bookmarked ? 'Remove bookmark' : 'Bookmark'}" data-url="${escHtml(article.url)}">
            ${bookmarked ? '🔖' : '🏷️'}
          </button>
        </div>
      </div>
    </div>
  `;

  // Summarize button handler
  card.querySelector('.summarize-btn').addEventListener('click', (e) => {
    if (state.selectMode) return; // let card-click handle it in select mode
    openSummarizePanel(article);
  });

  // Select mode: clicking anywhere on card (not buttons) toggles selection
  card.addEventListener('click', (e) => {
    if (!state.selectMode) return;
    if (e.target.closest('a, button')) return; // let links/buttons through
    if (state.selectedUrls.has(article.url)) {
      state.selectedUrls.delete(article.url);
    } else {
      state.selectedUrls.add(article.url);
    }
    renderCards();
    updateSelectBar();
  });

  // Bookmark button handler
  const bookmarkBtn = card.querySelector('.bookmark-btn');
  bookmarkBtn.addEventListener('click', () => {
    const nowBookmarked = toggleBookmark(article);
    bookmarkBtn.classList.toggle('active', nowBookmarked);
    bookmarkBtn.textContent = nowBookmarked ? '🔖' : '🏷️';
    bookmarkBtn.title = nowBookmarked ? 'Remove bookmark' : 'Bookmark';
    showToast(nowBookmarked ? 'Bookmarked!' : 'Bookmark removed');
    if (state.activeTab === 'bookmarks') renderCards();
  });

  return card;
}

// ===== Utilities =====
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTimeAgo(date) {
  if (!date || isNaN(date)) return 'Unknown time';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

let toastTimer = null;
function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}
