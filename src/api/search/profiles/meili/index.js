/**
 * Meilisearch-powered profile search proxy
 * Endpoint: GET /api/search/profiles/meili?q=<query>&limit=<n>&offset=<n>
 *
 * Proxies search requests to the nostr-search-api container (Meilisearch backend).
 * Returns sub-10ms full-text search across 750K+ kind 0 profiles with typo tolerance.
 */

// nostr-search-api is a sibling service in the same docker-compose stack,
// reachable by service name on the Docker network.
// Override via NOSTR_SEARCH_URL env var if running outside Docker.
const NOSTR_SEARCH_URL = process.env.NOSTR_SEARCH_URL || 'http://nostr-search-api:3069';

async function handleMeiliSearchProfiles(req, res) {
  const { q, limit = 100, offset = 0 } = req.query;

  if (!q || !q.trim()) {
    return res.json({
      success: true,
      hits: [],
      estimatedTotalHits: 0,
      processingTimeMs: 0,
    });
  }

  try {
    // Read saved filter/sort preferences
    let filterSort = {};
    try {
      const { getSettings } = require('../../../../config/settings');
      const settings = getSettings();
      const prefs = settings.grapevine?.searchPreferences || {};
      if (prefs.filters || prefs.sort) {
        filterSort = { filters: prefs.filters, sort: prefs.sort };
      }
    } catch { /* ignore */ }

    const url = new URL('/api/search', NOSTR_SEARCH_URL);
    url.searchParams.set('q', q.trim());
    url.searchParams.set('limit', String(Math.min(parseInt(limit) || 100, 200)));
    url.searchParams.set('offset', String(parseInt(offset) || 0));

    // Pass filter/sort config to nostr-search-api
    if (filterSort.filters) {
      url.searchParams.set('wotFilters', JSON.stringify(filterSort.filters));
    }
    if (filterSort.sort?.metric) {
      url.searchParams.set('sort', `wot_${filterSort.sort.metric}:${filterSort.sort.direction || 'desc'}`);
    }

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

/**
 * Load WoT scores into Meilisearch.
 * Receives an array of { pubkey, wot_rank, wot_followers, ... } objects
 * and upserts them into the profiles index.
 */
async function handleMeiliLoadScores(req, res) {
  const { povPubkey, metrics, scores } = req.body;

  if (!scores || !Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ success: false, error: 'No scores provided' });
  }

  if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
    return res.status(400).json({ success: false, error: 'No metrics specified' });
  }

  try {
    // Forward to nostr-search-api for Meilisearch update
    const response = await fetch(`${NOSTR_SEARCH_URL}/api/load-scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ povPubkey, metrics, scores }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[meili-proxy] load-scores returned ${response.status}: ${text}`);
      return res.status(502).json({ success: false, error: 'Search service error' });
    }

    const data = await response.json();
    return res.json({ success: true, ...data });
  } catch (err) {
    console.error(`[meili-proxy] load-scores failed: ${err.message}`);
    return res.status(503).json({ success: false, error: err.message });
  }
}

/**
 * Trigger full bulk re-index of all kind 0 profiles from strfry into Meilisearch.
 * Uses streaming scan (no 500-event cap, no memory limit).
 */
async function handleMeiliResync(req, res) {
  try {
    const response = await fetch(`${NOSTR_SEARCH_URL}/api/bulk-ingest`, { method: 'POST' });
    if (!response.ok) {
      return res.status(502).json({ success: false, error: 'Search service unavailable' });
    }
    const data = await response.json();
    return res.json({ success: true, ...data });
  } catch (err) {
    return res.status(503).json({ success: false, error: err.message });
  }
}

/**
 * Get bulk ingest status (progress, indexed count, etc.)
 */
async function handleMeiliBulkStatus(req, res) {
  try {
    const response = await fetch(`${NOSTR_SEARCH_URL}/api/bulk-ingest/status`);
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
  handleMeiliResync,
  handleMeiliBulkStatus,
  handleMeiliLoadScores,
};
