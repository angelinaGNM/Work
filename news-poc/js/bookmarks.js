/**
 * bookmarks.js — localStorage-backed bookmark management.
 *
 * Bookmarks are stored as an array of article objects under the key 'news_bookmarks'.
 * Articles are identified by their URL.
 */

const BOOKMARKS_KEY = 'news_bookmarks';

/**
 * Load all bookmarked articles from localStorage.
 * @returns {Array} array of article objects
 */
function loadBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Re-hydrate publishedAt strings to Date objects
    return parsed.map(a => ({
      ...a,
      publishedAt: a.publishedAt ? new Date(a.publishedAt) : new Date(0),
    }));
  } catch {
    return [];
  }
}

/**
 * Save the given array of articles as bookmarks.
 * @param {Array} articles
 */
function saveBookmarks(articles) {
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(articles));
  } catch (err) {
    console.error('Failed to save bookmarks:', err);
  }
}

/**
 * Check if an article URL is bookmarked.
 * @param {string} url
 * @returns {boolean}
 */
function isBookmarked(url) {
  return loadBookmarks().some(a => a.url === url);
}

/**
 * Toggle bookmark for a given article. Adds if not present, removes if present.
 * @param {Object} article
 * @returns {boolean} true if now bookmarked, false if removed
 */
function toggleBookmark(article) {
  const bookmarks = loadBookmarks();
  const idx = bookmarks.findIndex(a => a.url === article.url);
  if (idx === -1) {
    bookmarks.unshift(article); // newest first
    saveBookmarks(bookmarks);
    return true;
  } else {
    bookmarks.splice(idx, 1);
    saveBookmarks(bookmarks);
    return false;
  }
}
