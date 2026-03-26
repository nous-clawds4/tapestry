/**
 * Meilisearch-powered profile search proxy
 * Endpoint: GET /api/search/profiles/meili?q=<query>&limit=<n>&offset=<n>
 *
 * Proxies search requests to the nostr-search-api container (Meilisearch backend).
 * Returns sub-10ms full-text search across 750K+ kind 0 profiles with typo tolerance.
 */

const NOSTR_SEARCH_URL = process.env.NOSTR_SEARCH_URL || 'http://nostr-search-api:3069';

async function handleMeiliSearchProfiles(req, res) {
  const { q, limit = 20, offset = 0 } = req.query;

  if (!q || !q.trim()) {
    return res.json({
      success: true,
      hits: [],
      estimatedTotalHits: 0,
      processingTimeMs: 0,
    });
  }

  try {
    const url = new URL('/api/search', NOSTR_SEARCH_URL);
    url.searchParams.set('q', q.trim());
    url.searchParams.set('limit', String(Math.min(parseInt(limit) || 20, 100)));
    url.searchParams.set('offset', String(parseInt(offset) || 0));

    const response = await fetch(url.toString());

    if (!response.ok) {
      const text = await response.text();
      console.error(`[meili-proxy] nostr-search-api returned ${response.status}: ${text}`);
      return res.status(502).json({
        success: false,
        error: 'Search service unavailable',
        detail: `nostr-search-api returned ${response.status}`,
      });
    }

    const data = await response.json();
    return res.json({
      success: true,
      ...data,
    });
  } catch (err) {
    console.error(`[meili-proxy] Failed to reach nostr-search-api: ${err.message}`);
    return res.status(503).json({
      success: false,
      error: 'Search service unavailable',
      detail: err.message,
    });
  }
}

/**
 * Check Meilisearch index stats (document count, indexing status).
 */
async function handleMeiliSearchStats(req, res) {
  try {
    const response = await fetch(`${NOSTR_SEARCH_URL}/api/stats`);
    if (!response.ok) {
      return res.status(502).json({ success: false, error: 'Search service unavailable' });
    }
    const data = await response.json();
    return res.json({ success: true, ...data });
  } catch (err) {
    return res.status(503).json({ success: false, error: err.message });
  }
}

module.exports = {
  handleMeiliSearchProfiles,
  handleMeiliSearchStats,
};
