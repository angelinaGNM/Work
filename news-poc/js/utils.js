/**
 * utils.js — Shared utilities. Must be loaded before newsapi.js and rss.js.
 */

/**
 * Fetch a URL via CORS proxy, trying allorigins.win first then corsproxy.io as fallback.
 * Both return the response body as a string — caller parses it.
 *
 * @param {string} targetUrl  The actual URL to fetch (will be proxied)
 * @returns {Promise<string>} Response body text
 */
async function corsProxyFetch(targetUrl) {
  const encoded = encodeURIComponent(targetUrl);

  // --- Proxy 1: allorigins.win (returns JSON wrapper) ---
  try {
    const res = await fetch('https://api.allorigins.win/get?url=' + encoded, { signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const json = await res.json();
      if (json.contents) return json.contents;
    }
  } catch (e) { console.warn('[proxy1] allorigins.win:', e.message); }

  // --- Proxy 2: corsproxy.io (returns raw body) ---
  try {
    const res = await fetch('https://corsproxy.io/?' + encoded, { signal: AbortSignal.timeout(12000) });
    if (res.ok) return res.text();
  } catch (e) { console.warn('[proxy2] corsproxy.io:', e.message); }

  // --- Proxy 3: allorigins.win raw endpoint ---
  try {
    const res = await fetch('https://api.allorigins.win/raw?url=' + encoded, { signal: AbortSignal.timeout(12000) });
    if (res.ok) return res.text();
  } catch (e) { console.warn('[proxy3] allorigins.win/raw:', e.message); }

  // --- Proxy 4: codetabs ---
  try {
    const res = await fetch('https://api.codetabs.com/v1/proxy?quest=' + encoded, { signal: AbortSignal.timeout(12000) });
    if (res.ok) return res.text();
  } catch (e) { console.warn('[proxy4] codetabs:', e.message); }

  throw new Error(`All proxies failed for: ${new URL(targetUrl).hostname}`);
}
