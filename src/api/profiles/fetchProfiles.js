/**
 * Profile fetch endpoint with in-memory cache.
 *
 * GET /api/profiles?pubkeys=hex1,hex2,...[&fresh=1]
 *
 * Fetches kind:0 profiles from PROFILE_RELAYS AND the local strfry store, then
 * keeps the newest by created_at per pubkey (rev. 2, Finding 1 — local writes
 * must not be masked by a stale external profile). Caches in memory (5-min TTL).
 * `?fresh=1` bypasses the cache; invalidateProfileCache() lets the kind-0 save
 * path drop a stale entry the moment a profile is republished.
 */

const NOSTR_TOOLS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools';
const WS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/ws';

// Inject WebSocket global for nostr-tools SimplePool (Node has no native WebSocket)
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = require(WS_PATH);
}

const { SimplePool } = require(NOSTR_TOOLS_PATH);
const { getSettings } = require('../../config/settings');
const { mergeNewestByPubkey } = require('../../lib/receiving/newest');

// --- Config ---
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 6000;        // 6s per batch

// --- In-memory cache: pubkey -> { profile, fetchedAt } ---
const cache = new Map();

/**
 * Get profile relays from merged settings (re-reads on each call so overrides take effect immediately).
 */
function getProfileRelays() {
  try {
    const settings = getSettings();
    const relays = settings.aRelays?.aProfileRelays;
    if (Array.isArray(relays) && relays.length > 0) return relays;
  } catch (err) {
    console.warn('fetchProfiles: could not read settings, using fallback relays');
  }
  return ['wss://purplepag.es'];
}

/**
 * Gather kind:0 events for the given pubkeys from BOTH the local strfry store
 * and the external profile relays. Local is collected first so it wins ties
 * (it's the source of truth for a just-published profile); a genuinely newer
 * external profile still wins on a strictly-greater created_at. Best-effort:
 * a failure of either source is logged, not thrown.
 * Returns a flat array of events.
 */
async function collectKind0Events(needed) {
  const events = [];

  // Local strfry store (always — newest-wins decides, not "missing only").
  try {
    const { execSync } = require('child_process');
    const filter = JSON.stringify({ kinds: [0], authors: needed });
    // strfry scan takes a nostr filter as a CLI argument and outputs matching events as JSONL
    const raw = execSync(`strfry scan '${filter.replace(/'/g, "\\'")}'`, {
      timeout: 5000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    for (const line of raw.trim().split('\n').filter(Boolean)) {
      try {
        const ev = JSON.parse(line);
        if (ev && ev.kind === 0 && needed.includes(ev.pubkey)) events.push(ev);
      } catch {}
    }
  } catch (localErr) {
    console.warn('fetchProfiles: local strfry scan error:', localErr.message);
  }

  // External profile relays.
  const profileRelays = getProfileRelays();
  const pool = new SimplePool();
  try {
    const ext = await Promise.race([
      pool.querySync(profileRelays, { kinds: [0], authors: needed }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT_MS)),
    ]);
    if (Array.isArray(ext)) {
      for (const ev of ext) if (ev && ev.kind === 0 && needed.includes(ev.pubkey)) events.push(ev);
    }
  } catch (err) {
    console.warn('fetchProfiles: relay fetch error:', err.message);
  } finally {
    try { pool.close(profileRelays); } catch {}
  }

  return events;
}

/**
 * Fetch profiles for a list of pubkeys, using cache where possible.
 * @param {string[]} pubkeys
 * @param {object} [opts]
 * @param {boolean} [opts.bypassCache=false] skip the read-through cache (?fresh=1)
 * Returns Map<pubkey, profileObj>.
 */
async function getProfiles(pubkeys, { bypassCache = false } = {}) {
  const now = Date.now();
  const results = new Map();
  const needed = [];

  for (const pk of pubkeys) {
    if (!bypassCache) {
      const cached = cache.get(pk);
      if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
        results.set(pk, cached.profile);
        continue;
      }
    }
    needed.push(pk);
  }

  if (needed.length === 0) return results;

  const events = await collectKind0Events(needed);
  const latest = mergeNewestByPubkey(events); // pubkey -> newest kind:0 event across both sources

  for (const [pk, ev] of latest) {
    let profile = {};
    try { profile = JSON.parse(ev.content); } catch {}
    cache.set(pk, { profile, fetchedAt: now });
    results.set(pk, profile);
  }

  // Cache misses as empty (so we don't re-fetch constantly)
  for (const pk of needed) {
    if (!results.has(pk)) {
      cache.set(pk, { profile: null, fetchedAt: now });
      results.set(pk, null);
    }
  }

  return results;
}

/**
 * Drop cached profiles for the given pubkey(s). Called by the kind-0 save path
 * so a freshly-published profile is re-read on the next request (Finding 1).
 */
function invalidateProfileCache(pubkeys) {
  const list = Array.isArray(pubkeys) ? pubkeys : [pubkeys];
  for (const pk of list) if (pk) cache.delete(pk);
}

/**
 * Express handler: GET /api/profiles?pubkeys=hex1,hex2,...
 */
async function handleFetchProfiles(req, res) {
  const raw = req.query.pubkeys;
  if (!raw) {
    return res.status(400).json({ success: false, error: 'pubkeys query param required' });
  }

  const pubkeys = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (pubkeys.length === 0) {
    return res.json({ success: true, profiles: {} });
  }

  // Cap at 50 to avoid abuse
  if (pubkeys.length > 50) {
    return res.status(400).json({ success: false, error: 'max 50 pubkeys per request' });
  }

  // ?fresh=1 (or true) bypasses the cache — used right after a profile save.
  const bypassCache = req.query.fresh === '1' || req.query.fresh === 'true';

  try {
    const profileMap = await getProfiles(pubkeys, { bypassCache });
    const profiles = {};
    for (const [pk, p] of profileMap) {
      profiles[pk] = p;
    }
    res.json({ success: true, profiles });
  } catch (err) {
    console.error('handleFetchProfiles error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handleFetchProfiles, getProfiles, invalidateProfileCache };
