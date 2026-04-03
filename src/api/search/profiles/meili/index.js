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

const fs = require('fs');
const path = require('path');

const USER_PREFS_DIR = '/var/lib/brainstorm/user-prefs';

/**
 * Read a user's saved preferences by pubkey (server-side, no auth required).
 * Returns {} if no prefs found.
 */
function readUserPrefs(pubkey) {
  if (!pubkey || pubkey.length !== 64) return {};
  const filePath = path.join(USER_PREFS_DIR, `${pubkey.replace(/[^0-9a-f]/gi, '')}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch { /* ignore */ }
  return {};
}

/**
 * GET /api/search/profiles/meili?q=<query>&limit=<n>&offset=<n>&wotPov=house|user&userPubkey=<hex>
 *
 * This proxy is the SINGLE AUTHORITY for:
 *   1. POV resolution (which delegated pubkey → which 8-char suffix)
 *   2. Filter/sort config (read from house prefs or user prefs)
 *   3. Field namespacing (wot_<metric>_<suffix>)
 *
 * The client only sends: q, limit, offset, wotPov, userPubkey.
 * The client NEVER sends filter config, sort config, or field names.
 */
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
    // ── Step 1: Load house preferences (always needed as fallback) ──
    let housePrefs = {};
    try {
      const { getSettings } = require('../../../../config/settings');
      const settings = getSettings();
      housePrefs = settings.grapevine?.searchPreferences || {};
    } catch { /* ignore */ }

    // ── Step 2: Determine POV → delegated pubkey → suffix ──
    const wotPov = req.query.wotPov || 'house';
    const userPubkey = req.query.userPubkey || null;

    let delegatedPubkey = null;
    let filters = null;
    let sort = null;

    if (wotPov === 'user' && userPubkey) {
      // User POV: read user's saved preferences
      const userPrefs = readUserPrefs(userPubkey);
      delegatedPubkey = userPrefs.rankAuthor || null;
      filters = userPrefs.filters || null;
      sort = userPrefs.sortConfig || null;
    }

    // Fall back to house for anything not resolved
    if (!delegatedPubkey) {
      delegatedPubkey = housePrefs.delegatedPubkey || null;
    }
    if (!filters) {
      filters = housePrefs.filters || null;
    }
    if (!sort) {
      sort = housePrefs.sort || null;
    }

    const povSuffix = delegatedPubkey ? delegatedPubkey.slice(0, 8) : null;

    // ── Step 3: Build downstream URL with fully-qualified field names ──
    const url = new URL('/api/search', NOSTR_SEARCH_URL);
    url.searchParams.set('q', q.trim());
    url.searchParams.set('limit', String(Math.min(parseInt(limit) || 100, 200)));
    url.searchParams.set('offset', String(parseInt(offset) || 0));

    // Namespace filter keys: { rank: {...} } → { wot_rank_<suffix>: {...} }
    if (filters && povSuffix) {
      const namespacedFilters = {};
      for (const [metric, config] of Object.entries(filters)) {
        namespacedFilters[`wot_${metric}_${povSuffix}`] = config;
      }
      url.searchParams.set('wotFilters', JSON.stringify(namespacedFilters));
    }

    // Namespace sort: { metric: "followers", direction: "desc" } → wot_followers_<suffix>:desc
    if (sort?.metric && povSuffix) {
      url.searchParams.set('sort', `wot_${sort.metric}_${povSuffix}:${sort.direction || 'desc'}`);
    } else if (povSuffix) {
      url.searchParams.set('sort', `wot_followers_${povSuffix}:desc`);
    }

    // ── Step 4: Forward to nostr-search-api ──
    const response = await fetch(url.toString());

    if (!response.ok) {
      const text = await response.text();
      console.error(`[meili-proxy] nostr-search-api returned ${response.status}: ${text.slice(0, 300)}`);
      return res.status(502).json({
        success: false,
        error: 'Search service unavailable',
        detail: `nostr-search-api returned ${response.status}`,
      });
    }

    const data = await response.json();
    return res.json({
      success: true,
      povSuffix,
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
  const { povPubkey, delegatedPubkey, metrics, scores } = req.body;

  if (!scores || !Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ success: false, error: 'No scores provided' });
  }

  if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
    return res.status(400).json({ success: false, error: 'No metrics specified' });
  }

  // Score fields are already namespaced by the client: wot_rank_<pubkey8>
  // Derive the suffix so we can tell nostr-search-api which fields to register
  const povSuffix = delegatedPubkey ? delegatedPubkey.slice(0, 8) : null;
  const namespacedMetrics = povSuffix
    ? metrics.map(m => `${m}_${povSuffix}`)
    : metrics;

  try {
    // Forward to nostr-search-api for Meilisearch update
    const response = await fetch(`${NOSTR_SEARCH_URL}/api/load-scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        povPubkey,
        delegatedPubkey,
        metrics: namespacedMetrics,
        scores,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[meili-proxy] load-scores returned ${response.status}: ${text.slice(0, 500)}`);
      return res.status(502).json({ success: false, error: `Search service error: ${response.status}`, detail: text.slice(0, 300) });
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

/**
 * GET /api/search/profiles/meili/document/:pubkey
 * Fetch a single profile document from Meilisearch by pubkey.
 * Returns the full document including wot_* score fields.
 */
async function handleMeiliGetDocument(req, res) {
  const { pubkey } = req.params;
  if (!pubkey || pubkey.length !== 64) {
    return res.status(400).json({ success: false, error: 'Invalid pubkey' });
  }
  try {
    // Hit Meilisearch directly for single document lookup
    const MEILI_URL = process.env.MEILI_URL || 'http://nostr-search-meili:7700';
    const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';
    const response = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/documents/${pubkey}`);
    if (!response.ok) {
      if (response.status === 404) {
        return res.json({ success: true, document: null });
      }
      return res.status(502).json({ success: false, error: `Meilisearch returned ${response.status}` });
    }
    const data = await response.json();
    return res.json({ success: true, document: data });
  } catch (err) {
    return res.status(503).json({ success: false, error: err.message });
  }
}

/**
 * DELETE /api/search/profiles/meili/wipe
 * Delete the entire Meilisearch profiles index. Requires re-ingest + re-load scores after.
 */
async function handleMeiliWipe(req, res) {
  try {
    const MEILI_URL = process.env.MEILI_URL || 'http://nostr-search-meili:7700';
    const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';
    const response = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}`, { method: 'DELETE' });
    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ success: false, error: `Meilisearch returned ${response.status}`, detail: text.slice(0, 300) });
    }
    const data = await response.json();
    return res.json({ success: true, ...data });
  } catch (err) {
    return res.status(503).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/search/profiles/meili/settings
 * Return Meilisearch index settings (filterable, sortable attributes, etc.)
 */
async function handleMeiliSettings(req, res) {
  try {
    const MEILI_URL = process.env.MEILI_URL || 'http://nostr-search-meili:7700';
    const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';
    const response = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/settings`);
    if (!response.ok) {
      return res.status(502).json({ success: false, error: `Meilisearch returned ${response.status}` });
    }
    const data = await response.json();
    return res.json({ success: true, settings: data });
  } catch (err) {
    return res.status(503).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/search/profiles/meili/random-scored
 * Return a random profile that has at least one wot_* score field.
 * Uses Meilisearch search with a random offset into scored profiles.
 */
async function handleMeiliRandomScored(req, res) {
  try {
    const MEILI_URL = process.env.MEILI_URL || 'http://nostr-search-meili:7700';
    const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';

    // First, find any wot_* filterable field to filter on
    const settingsResp = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/settings`);
    if (!settingsResp.ok) {
      return res.status(502).json({ success: false, error: 'Cannot read Meilisearch settings' });
    }
    const settings = await settingsResp.json();
    const wotFilterable = (settings.filterableAttributes || []).filter(f => f.startsWith('wot_') && f !== 'wot_pov' && f !== 'wot_updated_at');

    if (wotFilterable.length === 0) {
      return res.json({ success: true, document: null, message: 'No WoT score fields found in index' });
    }

    // Use the first wot field to filter for scored profiles
    const filterField = wotFilterable[0];
    const searchResp = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: '',
        filter: `${filterField} > 0`,
        limit: 1,
        offset: Math.floor(Math.random() * 1000), // random offset for variety
      }),
    });
    if (!searchResp.ok) {
      return res.status(502).json({ success: false, error: 'Meilisearch search failed' });
    }
    const searchData = await searchResp.json();
    const hit = searchData.hits?.[0] || null;
    return res.json({ success: true, document: hit, filterField });
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
  handleMeiliGetDocument,
  handleMeiliWipe,
  handleMeiliSettings,
  handleMeiliRandomScored,
};
