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
const { computeTagMatches, meiliFetchProfilesByPubkey } = require('../../../profile-tags');

// Internal wrapper so the proxy can compose tag-matching in parallel
// without making a self-loopback HTTP request.
async function handleTagMatchInternal({ q, povSuffix, minRank }) {
  return computeTagMatches({ q, povSuffix, minRank });
}

// ── NIP-05 verification ──────────────────────────────────────────
const NIP05_REGEX = /^(?:([\w.+-]+)@)?([\w_-]+(\.[\w_-]+)+)$/;
const MEILI_URL = process.env.MEILI_URL || 'http://nostr-search-meili:7700';
const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';

/**
 * Verify a NIP-05 identifier by fetching the domain's .well-known/nostr.json.
 * Returns the hex pubkey if valid, null otherwise. 5-second timeout.
 */
async function verifyNip05(nip05Address) {
  const match = nip05Address.match(NIP05_REGEX);
  if (!match) return null;
  const name = match[1] || '_';
  const domain = match[2];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(
      `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!resp.ok) return null;
    const json = await resp.json();
    const pubkey = json.names?.[name] || json.names?.[name.toLowerCase()];
    if (!pubkey || !/^[0-9a-f]{64}$/.test(pubkey)) return null;
    return pubkey;
  } catch {
    return null;
  }
}

/**
 * Fetch a single profile document from Meilisearch by pubkey.
 * Returns the document or null.
 */
async function fetchMeiliDocument(pubkey) {
  try {
    const resp = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/documents/${pubkey}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

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
    // ── Direct pubkey lookup (bypasses WoT filtering/sorting entirely) ──
    const pubkeyLookup = req.query.pubkeyLookup;
    if (pubkeyLookup && /^[0-9a-f]{64}$/.test(pubkeyLookup)) {
      const document = await fetchMeiliDocument(pubkeyLookup);
      return res.json({
        success: true,
        hits: document ? [document] : [],
        estimatedTotalHits: document ? 1 : 0,
        processingTimeMs: 0,
        query: q.trim(),
        povSuffix: null,
      });
    }

    // ── NIP-05 lookup (runs in parallel with normal search) ──
    const nip05Lookup = req.query.nip05Lookup;
    const nip05Promise = (nip05Lookup && NIP05_REGEX.test(nip05Lookup))
      ? verifyNip05(nip05Lookup).then(pubkey => pubkey ? fetchMeiliDocument(pubkey) : null)
      : Promise.resolve(null);

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
    //
    // Three-layer cascade (already resolved into the local `sort` variable above):
    //   1. User's saved sortConfig (per-user, /var/lib/brainstorm/user-prefs/<pubkey>.json)
    //   2. House's grapevine.searchPreferences.sort (settings.json, owner-controlled)
    //   3. None — fall through to Meilisearch's text-relevance ranking
    //
    // "None" is represented as { metric: null } in user prefs. The `sort?.metric`
    // check correctly treats both that case AND a fully-null `sort` as
    // "do not impose a sort" — we send no `sort` param downstream and let
    // Meilisearch rank by text relevance.
    if (sort?.metric && povSuffix) {
      url.searchParams.set('sort', `wot_${sort.metric}_${povSuffix}:${sort.direction || 'desc'}`);
    }

    // ── Step 4: Forward to nostr-search-api (parallel with NIP-05 + tag-match) ──
    // Tag-match runs at query time against local strfry + Meili author
    // lookups; it filters by the active POV's WoT (see CLAUDE.md → "Filter
    // at view time"). When povSuffix or rank filter is unset, tag-match
    // returns all positive assertions.
    const minRankFromFilters = filters?.rank?.min;
    const tagMatchPromise = handleTagMatchInternal({
      q: q.trim(),
      povSuffix,
      minRank: typeof minRankFromFilters === 'number' ? minRankFromFilters : null,
    }).catch((err) => {
      console.error(`[meili-proxy] tag-match failed: ${err.message}`);
      return { matches: [] };
    });

    const [searchResponse, nip05Doc, tagMatchResult] = await Promise.all([
      fetch(url.toString()),
      nip05Promise.catch(() => null),
      tagMatchPromise,
    ]);

    if (!searchResponse.ok) {
      const text = await searchResponse.text();
      console.error(`[meili-proxy] nostr-search-api returned ${searchResponse.status}: ${text.slice(0, 300)}`);
      return res.status(502).json({
        success: false,
        error: 'Search service unavailable',
        detail: `nostr-search-api returned ${searchResponse.status}`,
      });
    }

    const data = await searchResponse.json();

    // Deduplicate: remove NIP-05 profile from normal results if present
    const nip05Result = nip05Doc ? { ...nip05Doc, _nip05Verified: true } : null;
    if (nip05Result && data.hits) {
      const nip05Pubkey = nip05Result.pubkey || nip05Result.id;
      data.hits = data.hits.filter(h => (h.pubkey || h.id) !== nip05Pubkey);
    }

    // Merge tag-match hits AFTER name-match hits, deduped by pubkey.
    // Name-match hits ranked first preserves Meili's text-relevance ordering.
    if (tagMatchResult?.matches?.length > 0) {
      const existingPubkeys = new Set(
        (data.hits || []).map((h) => h.pubkey || h.id)
      );
      const matchesByPubkey = new Map(tagMatchResult.matches.map((m) => [m.pubkey, m]));

      // Annotate name-match hits that ALSO match a tag (so the chip can show
      // even when the name was the primary reason).
      if (data.hits) {
        for (const h of data.hits) {
          const pk = h.pubkey || h.id;
          const m = matchesByPubkey.get(pk);
          if (m) h._matchedTags = m.matchedTags;
        }
      }

      // For tag-match-only pubkeys (not already in name-match hits), fetch
      // enriched Meili docs and append. Targets without a Meili doc still
      // appear as minimal stub hits so the UI can render at least the chip.
      const tagOnlyPubkeys = tagMatchResult.matches
        .map((m) => m.pubkey)
        .filter((pk) => !existingPubkeys.has(pk));

      if (tagOnlyPubkeys.length > 0) {
        const docs = await meiliFetchProfilesByPubkey(tagOnlyPubkeys);
        const appended = tagOnlyPubkeys.map((pk) => {
          const base = docs.get(pk) || { id: pk, pubkey: pk };
          return { ...base, _matchedTags: matchesByPubkey.get(pk).matchedTags };
        });
        data.hits = (data.hits || []).concat(appended);
        data.estimatedTotalHits = (data.estimatedTotalHits || 0) + appended.length;
      }
    }

    // Count how many hits have scores for this POV
    const wotCount = data.hits ? data.hits.filter(h => h[`wot_rank_${povSuffix}`] != null).length : 0;

    return res.json({
      success: true,
      povSuffix,
      nip05Result,
      _wotCount: wotCount,
      _filtered: !!(filters && povSuffix),
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

/**
 * GET /api/search/profiles/meili/tasks
 * Return Meilisearch task queue summary: counts by status, recent failed tasks.
 */
async function handleMeiliTasks(req, res) {
  try {
    const MEILI_URL = process.env.MEILI_URL || 'http://nostr-search-meili:7700';

    // Fetch counts for each status in parallel
    const statuses = ['enqueued', 'processing', 'succeeded', 'failed', 'canceled'];
    const countPromises = statuses.map(async (status) => {
      const resp = await fetch(`${MEILI_URL}/tasks?statuses=${status}&limit=0`);
      if (!resp.ok) return { status, total: 0 };
      const data = await resp.json();
      return { status, total: data.total || 0 };
    });

    // Fetch recent failed tasks for debugging
    const failedPromise = fetch(`${MEILI_URL}/tasks?statuses=failed&limit=10`)
      .then(r => r.ok ? r.json() : { results: [] })
      .catch(() => ({ results: [] }));

    const [counts, failedData] = await Promise.all([
      Promise.all(countPromises),
      failedPromise,
    ]);

    const summary = {};
    for (const c of counts) summary[c.status] = c.total;

    const recentFailed = (failedData.results || []).map(t => ({
      uid: t.uid,
      type: t.type,
      error: t.error?.message?.slice(0, 200) || 'Unknown error',
      enqueuedAt: t.enqueuedAt,
      finishedAt: t.finishedAt,
    }));

    return res.json({
      success: true,
      queue: summary,
      pending: (summary.enqueued || 0) + (summary.processing || 0),
      recentFailed,
    });
  } catch (err) {
    return res.status(503).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/search/profiles/meili/prune-unscored
 * Delete all profiles from Meilisearch that have no WoT scores.
 * Strategy: paginate through ALL docs, collect IDs of those without any wot_* score field,
 * then delete them in batches.
 */
async function handleMeiliPruneUnscored(req, res) {
  const MEILI_URL = process.env.MEILI_URL || 'http://nostr-search-meili:7700';
  const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';
  const BATCH_SIZE = 50000;

  try {
    // 1. Discover which wot score fields exist (filterable)
    const settingsResp = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/settings`);
    if (!settingsResp.ok) {
      return res.status(502).json({ success: false, error: 'Cannot read Meilisearch settings' });
    }
    const settings = await settingsResp.json();
    const wotFilterable = (settings.filterableAttributes || []).filter(
      f => f.startsWith('wot_rank_') || f.startsWith('wot_followers_')
    );

    if (wotFilterable.length === 0) {
      return res.json({ success: false, error: 'No WoT score fields found — cannot determine which profiles are scored.' });
    }

    // 2. Collect IDs of scored profiles using search with filter
    const scoredIds = new Set();
    const filterField = wotFilterable[0]; // Use first wot_rank_* or wot_followers_* field
    let offset = 0;
    const SEARCH_BATCH = 1000;

    while (true) {
      const searchResp = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: '',
          filter: `${filterField} EXISTS`,
          attributesToRetrieve: ['id'],
          limit: SEARCH_BATCH,
          offset,
        }),
      });
      if (!searchResp.ok) break;
      const data = await searchResp.json();
      const hits = data.hits || [];
      for (const hit of hits) scoredIds.add(hit.id);
      if (hits.length < SEARCH_BATCH) break;
      offset += SEARCH_BATCH;
      // Safety: Meilisearch caps offset at 1000 for search. Use documents endpoint instead.
      if (offset >= 1000) break;
    }

    // If search offset cap was hit, use documents endpoint for remaining scored profiles
    // Actually, let's use the documents endpoint for ALL IDs and filter locally
    // This is more reliable than search offset limits.

    // 3. Collect ALL document IDs via documents endpoint (paginated)
    const allIds = [];
    let docOffset = 0;
    const DOC_BATCH = 50000;

    while (true) {
      const resp = await fetch(
        `${MEILI_URL}/indexes/${MEILI_INDEX}/documents?fields=id,${filterField}&offset=${docOffset}&limit=${DOC_BATCH}`
      );
      if (!resp.ok) break;
      const data = await resp.json();
      const results = data.results || [];
      for (const doc of results) {
        const hasScore = doc[filterField] !== undefined && doc[filterField] !== null;
        if (!hasScore) {
          allIds.push(doc.id);
        }
      }
      if (results.length < DOC_BATCH) break;
      docOffset += DOC_BATCH;
    }

    const unscoredCount = allIds.length;

    if (unscoredCount === 0) {
      return res.json({ success: true, deleted: 0, message: 'All profiles have scores — nothing to prune.' });
    }

    // 4. Delete unscored profiles in batches
    let deletedTotal = 0;
    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      const batch = allIds.slice(i, i + BATCH_SIZE);
      const delResp = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/documents/delete-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (delResp.ok) {
        deletedTotal += batch.length;
      }
    }

    return res.json({
      success: true,
      deleted: deletedTotal,
      message: `Pruned ${deletedTotal.toLocaleString()} unscored profiles. ${scoredIds.size > 0 ? scoredIds.size.toLocaleString() + ' scored profiles retained.' : ''}`,
    });
  } catch (err) {
    return res.status(503).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/search/profiles/meili/scored-missing-profile
 * Find scored profiles that have no kind 0 profile data (no created_at field).
 * Returns count and sample pubkeys.
 */
async function handleMeiliScoredMissingProfile(req, res) {
  const MEILI_URL = process.env.MEILI_URL || 'http://nostr-search-meili:7700';
  const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';

  try {
    // Find a wot score field to filter on
    const settingsResp = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/settings`);
    if (!settingsResp.ok) return res.status(502).json({ success: false, error: 'Cannot read settings' });
    const settings = await settingsResp.json();
    const wotField = (settings.filterableAttributes || []).find(f => f.startsWith('wot_rank_'));
    if (!wotField) return res.json({ success: true, missingCount: 0, totalScored: 0, message: 'No WoT score fields found.' });

    // Ensure created_at is filterable so we can use EXISTS
    const filterableAttrs = settings.filterableAttributes || [];
    if (!filterableAttrs.includes('created_at')) {
      // Add created_at as filterable
      await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filterableAttributes: [...filterableAttrs, 'created_at'] }),
      });
      // Wait for Meilisearch to process
      await new Promise(r => setTimeout(r, 2000));
    }

    // Paginate through scored documents, check for missing created_at
    const missingPubkeys = [];
    let totalScored = 0;
    let offset = 0;
    const BATCH = 50000;

    while (true) {
      const resp = await fetch(
        `${MEILI_URL}/indexes/${MEILI_INDEX}/documents?fields=id,pubkey,created_at,${wotField}&offset=${offset}&limit=${BATCH}`
      );
      if (!resp.ok) break;
      const data = await resp.json();
      const results = data.results || [];

      for (const doc of results) {
        const hasScore = doc[wotField] !== undefined && doc[wotField] !== null;
        if (hasScore) {
          totalScored++;
          if (!doc.created_at) {
            missingPubkeys.push(doc.pubkey || doc.id);
          }
        }
      }

      if (results.length < BATCH) break;
      offset += BATCH;
    }

    return res.json({
      success: true,
      missingCount: missingPubkeys.length,
      totalScored,
      samplePubkeys: missingPubkeys.slice(0, 20),
    });
  } catch (err) {
    return res.status(503).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/search/profiles/meili/backfill-profiles
 * For scored profiles missing kind 0 data, look up their kind 0 events in local strfry
 * and merge the profile data into Meilisearch.
 */
async function handleMeiliBackfillProfiles(req, res) {
  const MEILI_URL = process.env.MEILI_URL || 'http://nostr-search-meili:7700';
  const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';

  try {
    // 1. Find scored profiles missing created_at (reuse logic from above)
    const settingsResp = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/settings`);
    if (!settingsResp.ok) return res.status(502).json({ success: false, error: 'Cannot read settings' });
    const settings = await settingsResp.json();
    const wotField = (settings.filterableAttributes || []).find(f => f.startsWith('wot_rank_'));
    if (!wotField) return res.json({ success: true, backfilled: 0, message: 'No WoT score fields found.' });

    const missingPubkeys = [];
    let offset = 0;
    const BATCH = 50000;

    while (true) {
      const resp = await fetch(
        `${MEILI_URL}/indexes/${MEILI_INDEX}/documents?fields=id,pubkey,created_at,${wotField}&offset=${offset}&limit=${BATCH}`
      );
      if (!resp.ok) break;
      const data = await resp.json();
      const results = data.results || [];

      for (const doc of results) {
        const hasScore = doc[wotField] !== undefined && doc[wotField] !== null;
        if (hasScore && !doc.created_at) {
          missingPubkeys.push(doc.pubkey || doc.id);
        }
      }

      if (results.length < BATCH) break;
      offset += BATCH;
    }

    if (missingPubkeys.length === 0) {
      return res.json({ success: true, backfilled: 0, notFound: 0, message: 'All scored profiles already have kind 0 data.' });
    }

    // 2. Query strfry for kind 0 events for these pubkeys (in batches)
    const { execSync } = require('child_process');
    const nip19 = require('nostr-tools/nip19');

    function sanitizeStr(s) {
      if (typeof s !== 'string') return s;
      return s
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
        .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
        .replace(/\\u[0-9a-fA-F]{0,3}(?![0-9a-fA-F])/g, '')
        .replace(/\0/g, '');
    }

    const docsToUpdate = [];
    let notFoundCount = 0;
    const STRFRY_BATCH = 500;

    for (let i = 0; i < missingPubkeys.length; i += STRFRY_BATCH) {
      const batch = missingPubkeys.slice(i, i + STRFRY_BATCH);
      const filter = JSON.stringify({ kinds: [0], authors: batch });

      let rawOutput;
      try {
        rawOutput = execSync(`strfry scan '${filter.replace(/'/g, "'\\''")}'`, {
          maxBuffer: 100 * 1024 * 1024,
          timeout: 60000,
        }).toString();
      } catch {
        continue;
      }

      const foundPubkeys = new Set();
      const lines = rawOutput.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (!event.pubkey) continue;
          foundPubkeys.add(event.pubkey);

          let profile = {};
          try { profile = JSON.parse(event.content || '{}'); } catch { continue; }

          let npub = '';
          try { npub = nip19.npubEncode(event.pubkey); } catch { /* ignore */ }

          docsToUpdate.push({
            id: event.pubkey,
            pubkey: event.pubkey,
            npub,
            created_at: event.created_at || 0,
            indexed_at: Math.floor(Date.now() / 1000),
            name: sanitizeStr(profile.name || ''),
            display_name: sanitizeStr(profile.display_name || ''),
            displayName: sanitizeStr(profile.displayName || profile.display_name || ''),
            username: sanitizeStr(profile.username || ''),
            nip05: sanitizeStr(profile.nip05 || ''),
            about: sanitizeStr(profile.about || ''),
            picture: sanitizeStr(profile.picture || ''),
            banner: sanitizeStr(profile.banner || ''),
            lud16: sanitizeStr(profile.lud16 || ''),
            lud06: sanitizeStr(profile.lud06 || ''),
            website: sanitizeStr(profile.website || ''),
          });
        } catch { /* skip malformed */ }
      }

      for (const pk of batch) {
        if (!foundPubkeys.has(pk)) notFoundCount++;
      }
    }

    // 3. Update Meilisearch with the backfilled profiles
    let backfilled = 0;
    const UPDATE_BATCH = 5000;
    for (let i = 0; i < docsToUpdate.length; i += UPDATE_BATCH) {
      const chunk = docsToUpdate.slice(i, i + UPDATE_BATCH);
      const resp = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/documents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (resp.ok) backfilled += chunk.length;
    }

    return res.json({
      success: true,
      backfilled,
      notFound: notFoundCount,
      total: missingPubkeys.length,
      message: `Backfilled ${backfilled.toLocaleString()} profiles from strfry. ${notFoundCount.toLocaleString()} not found in local relay.`,
    });
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
  handleMeiliTasks,
  handleMeiliPruneUnscored,
  handleMeiliScoredMissingProfile,
  handleMeiliBackfillProfiles,
};
