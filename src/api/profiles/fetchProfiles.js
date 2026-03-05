/**
 * Profile fetch endpoint with in-memory cache.
 *
 * GET /api/profiles?pubkeys=hex1,hex2,...
 *
 * Fetches kind:0 profiles from PROFILE_RELAYS (defaults.conf),
 * caches in memory with 1-hour TTL.
 */

const NOSTR_TOOLS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools';
const WS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/ws';

// Inject WebSocket global for nostr-tools SimplePool (Node has no native WebSocket)
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = require(WS_PATH);
}

const { SimplePool } = require(NOSTR_TOOLS_PATH);
const { getSettings } = require('../../config/settings');

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
 * Fetch profiles for a list of pubkeys, using cache where possible.
 * Returns Map<pubkey, profileObj>.
 */
async function getProfiles(pubkeys) {
  const now = Date.now();
  const results = new Map();
  const needed = [];

  for (const pk of pubkeys) {
    const cached = cache.get(pk);
    if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
      results.set(pk, cached.profile);
    } else {
      needed.push(pk);
    }
  }

  if (needed.length === 0) return results;

  // Fetch from relays
  const profileRelays = getProfileRelays();
  const pool = new SimplePool();
  try {
    const events = await Promise.race([
      pool.querySync(profileRelays, { kinds: [0], authors: needed }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT_MS)),
    ]);

    // Keep only the latest kind:0 per pubkey
    const latest = new Map();
    for (const ev of events) {
      const prev = latest.get(ev.pubkey);
      if (!prev || ev.created_at > prev.created_at) {
        latest.set(ev.pubkey, ev);
      }
    }

    for (const [pk, ev] of latest) {
      let profile = {};
      try { profile = JSON.parse(ev.content); } catch {}
      cache.set(pk, { profile, fetchedAt: now });
      results.set(pk, profile);
    }

    // For any still-missing pubkeys, try local strfry via CLI scan with proper filter
    const stillMissing = needed.filter(pk => !results.has(pk));
    if (stillMissing.length > 0) {
      try {
        const { execSync } = require('child_process');
        const filter = JSON.stringify({ kinds: [0], authors: stillMissing });
        // strfry scan takes a nostr filter as a CLI argument and outputs matching events as JSONL
        const raw = execSync(`strfry scan '${filter.replace(/'/g, "\\'")}'`, {
          timeout: 5000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
        });
        const lines = raw.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const ev = JSON.parse(line);
            if (ev.kind === 0 && stillMissing.includes(ev.pubkey)) {
              let profile = {};
              try { profile = JSON.parse(ev.content); } catch {}
              if (!results.has(ev.pubkey)) {
                cache.set(ev.pubkey, { profile, fetchedAt: now });
                results.set(ev.pubkey, profile);
              }
            }
          } catch {}
        }
      } catch (localErr) {
        console.warn('fetchProfiles: local strfry scan fallback error:', localErr.message);
      }
    }

    // Cache misses as empty (so we don't re-fetch constantly)
    for (const pk of needed) {
      if (!results.has(pk)) {
        cache.set(pk, { profile: null, fetchedAt: now });
        results.set(pk, null);
      }
    }
  } catch (err) {
    console.warn('fetchProfiles: relay fetch error:', err.message);
    // Return what we have from cache; don't cache failures
  } finally {
    pool.close(profileRelays);
  }

  return results;
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

  try {
    const profileMap = await getProfiles(pubkeys);
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

module.exports = { handleFetchProfiles };
