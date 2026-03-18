/**
 * rss.js — Fetch RSS feeds via allorigins.win CORS proxy, parse XML, normalize.
 *
 * Common article shape:
 * { title, url, source, publishedAt, description, urlToImage, category }
 */

// CORS proxying handled by corsProxyFetch() in utils.js

const RSS_FEEDS = {
  ai: [
    { url: 'https://venturebeat.com/category/ai/feed/',                               name: 'VentureBeat AI' },
    { url: 'https://news.mit.edu/topic/artificial-intelligence2/rss.xml',             name: 'MIT News AI' },
    { url: 'https://techcrunch.com/category/artificial-intelligence/feed/',           name: 'TechCrunch AI' },
    { url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml',       name: 'The Verge AI' },
    { url: 'https://blogs.microsoft.com/ai/feed/',                                    name: 'Microsoft AI Blog' },
    { url: 'https://openai.com/news/rss.xml',                                         name: 'OpenAI News' },
  ],
  cybersecurity: [
    { url: 'https://krebsonsecurity.com/feed/',                                       name: 'Krebs on Security' },
    { url: 'https://feeds.feedburner.com/TheHackersNews',                             name: 'The Hacker News' },
    { url: 'https://www.bleepingcomputer.com/feed/',                                  name: 'Bleeping Computer' },
  ],
};

/**
 * Fetch all RSS feeds for a given category.
 * @param {string} category - 'ai' or 'cybersecurity'
 * @returns {Promise<Array>} normalized articles
 */
async function fetchRSSFeeds(category) {
  const feeds = RSS_FEEDS[category];
  if (!feeds) return [];

  const results = await Promise.allSettled(
    feeds.map(feed => fetchSingleFeed(feed.url, feed.name, category))
  );

  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);
}

/**
 * Fetch and parse a single RSS feed.
 */
async function fetchSingleFeed(feedUrl, sourceName, category) {
  const xmlText = await corsProxyFetch(feedUrl); // throws on failure — let tracked() surface it
  if (!xmlText) throw new Error('Empty response from proxy');

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('RSS parse error');

  const items = Array.from(doc.querySelectorAll('item'));
  return items
    .map(item => normalizeRSSItem(item, sourceName, category))
    .filter(a => a.title && a.url);
}

/**
 * Normalize an RSS <item> element to the common article shape.
 */
function normalizeRSSItem(item, sourceName, category) {
  const getText = (tag) => item.querySelector(tag)?.textContent?.trim() || '';

  const title = getText('title');
  const url = getText('link') || item.querySelector('guid')?.textContent?.trim() || '';
  const description = stripHtml(getText('description'));
  const pubDateStr = getText('pubDate');
  const publishedAt = pubDateStr ? new Date(pubDateStr) : new Date(0);

  // Try to extract image from media:content, enclosure, or description img tag
  const urlToImage = extractImage(item, getText('description'));

  return {
    title,
    url,
    source: sourceName,
    publishedAt,
    description,
    urlToImage,
    category,
  };
}

/**
 * Extract an image URL from an RSS item using multiple strategies.
 */
function extractImage(item, rawDescription) {
  // 1. media:content or media:thumbnail
  const mediaContent = item.querySelector('content') || item.querySelector('thumbnail');
  if (mediaContent?.getAttribute('url')) {
    return mediaContent.getAttribute('url');
  }

  // 2. enclosure with image type
  const enclosure = item.querySelector('enclosure');
  if (enclosure) {
    const type = enclosure.getAttribute('type') || '';
    const encUrl = enclosure.getAttribute('url') || '';
    if (type.startsWith('image/') || encUrl.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
      return encUrl;
    }
  }

  // 3. Parse img tag from description HTML
  if (rawDescription) {
    const imgMatch = rawDescription.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) return imgMatch[1];
  }

  return null;
}

/**
 * Strip HTML tags from a string.
 */
function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}
