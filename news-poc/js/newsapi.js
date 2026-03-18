/**
 * newsapi.js — Fetch articles from NewsAPI.org and normalize to common shape.
 *
 * Common article shape:
 * { title, url, source, publishedAt, description, urlToImage, category }
 */

const NEWSAPI_BASE = 'https://newsapi.org/v2/everything';
// CORS proxying handled by corsProxyFetch() in utils.js

const NEWSAPI_QUERIES = {
  ai: 'OpenAI OR Anthropic OR "artificial intelligence" OR "machine learning" OR ChatGPT OR "large language model" OR "generative AI"',
  cybersecurity: 'cybersecurity OR "cyber attack" OR ransomware OR "data breach" OR malware OR "zero day"',
};

/**
 * Fetch articles from NewsAPI for a given category.
 * @param {string} category - 'ai' or 'cybersecurity'
 * @param {string} apiKey
 * @returns {Promise<Array>} normalized articles
 */
async function fetchNewsAPI(category, apiKey, days = 3) {
  if (!apiKey) return [];

  const q = NEWSAPI_QUERIES[category];
  if (!q) return [];

  // NewsAPI requires YYYY-MM-DD format — full ISO timestamps cause parameterInvalid errors
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const from = fromDate.toISOString().split('T')[0]; // "2026-03-15"

  const params = new URLSearchParams({
    q,
    language: 'en',
    sortBy: 'publishedAt',
    pageSize: '30',
    from,
    apiKey,
  });

  const newsapiUrl = `${NEWSAPI_BASE}?${params.toString()}`;

  try {
    const text = await corsProxyFetch(newsapiUrl);
    const data = JSON.parse(text);
    if (data.status !== 'ok') {
      // Throw so the tracked() wrapper in app.js shows the real error in the fetch log
      throw new Error(data.message || `NewsAPI error (${data.code || 'unknown'})`);
    }
    return (data.articles || [])
      .filter(a => a.title && a.title !== '[Removed]' && a.url)
      .map(a => normalizeNewsAPIArticle(a, category));
  } catch (err) {
    throw err; // re-throw so tracked() can surface it
  }
}

/**
 * Normalize a raw NewsAPI article to the common shape.
 */
function normalizeNewsAPIArticle(article, category) {
  return {
    title: article.title || '',
    url: article.url || '',
    source: article.source?.name || 'NewsAPI',
    publishedAt: article.publishedAt ? new Date(article.publishedAt) : new Date(0),
    description: article.description || article.content || '',
    urlToImage: article.urlToImage || null,
    category,
  };
}
