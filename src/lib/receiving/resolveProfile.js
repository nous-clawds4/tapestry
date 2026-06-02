/**
 * Newest-wins profile resolver (rev. 2, Finding 1).
 *
 * Gathers a pubkey's kind-0 events from BOTH the external PROFILE_RELAYS and
 * the local strfry store, then keeps the one with the greatest created_at. This
 * is the resolution `/api/profiles` should perform and that the CLI's
 * `show` / `resolve` commands use to confirm a just-published method actually
 * wins over a stale external copy.
 *
 * I/O module (SimplePool + strfry scan). Dependency loader tolerant of the
 * Docker install path; injects a WebSocket global for SimplePool.
 */

const { execSync } = require('child_process');
const { pickNewestEvent } = require('./newest');
const { getProfileRelays } = require('./publish');

function loadDep(name) {
  try {
    return require(name);
  } catch {
    return require(`/usr/local/lib/node_modules/brainstorm/node_modules/${name}`);
  }
}

// nostr-tools' SimplePool needs a global WebSocket (Node has none until v21+).
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = loadDep('ws');
}

const { SimplePool } = loadDep('nostr-tools');

const DEFAULT_TIMEOUT_MS = 6000;

/**
 * Query external profile relays for a pubkey's kind-0 events.
 * Returns an array of events (possibly empty); never throws.
 */
async function queryExternal(pubkeyHex, relays, timeoutMs) {
  const pool = new SimplePool();
  try {
    const events = await Promise.race([
      pool.querySync(relays, { kinds: [0], authors: [pubkeyHex] }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  } finally {
    try { pool.close(relays); } catch {}
  }
}

/**
 * Scan the local strfry store for a pubkey's kind-0 events.
 * Returns an array of events (possibly empty); never throws.
 */
function scanLocal(pubkeyHex) {
  try {
    const filter = JSON.stringify({ kinds: [0], authors: [pubkeyHex] });
    const raw = execSync(`strfry scan '${filter.replace(/'/g, "\\'")}'`, {
      timeout: 5000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    return raw.trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(ev => ev && ev.kind === 0 && ev.pubkey === pubkeyHex);
  } catch {
    return [];
  }
}

/**
 * Resolve a single pubkey's active kind-0 profile, newest across local + external.
 *
 * @param {string} pubkeyHex
 * @param {object} [opts]
 * @param {string[]} [opts.relays] override profile relays
 * @param {boolean} [opts.includeLocal=true]
 * @param {boolean} [opts.includeExternal=true]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<{event:object|null, profile:object|null, createdAt:number|null, source:'local'|'external'|null, sources:{local:number,external:number}}>}
 */
async function resolveProfile(pubkeyHex, opts = {}) {
  if (!/^[0-9a-f]{64}$/i.test(pubkeyHex)) {
    throw new Error('resolveProfile: pubkeyHex must be 64-char hex');
  }
  const {
    relays = getProfileRelays(),
    includeLocal = true,
    includeExternal = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts;

  const externalEvents = includeExternal ? await queryExternal(pubkeyHex, relays, timeoutMs) : [];
  const localEvents = includeLocal ? scanLocal(pubkeyHex) : [];

  // Tag each event with its origin so we can report which source won.
  const tagged = [
    ...externalEvents.map(ev => ({ ev, source: 'external' })),
    ...localEvents.map(ev => ({ ev, source: 'local' })),
  ];

  const newestTagged = pickNewestEvent(tagged.map(t => ({ ...t.ev, __source: t.source })));
  if (!newestTagged) {
    return { event: null, profile: null, createdAt: null, source: null, sources: { local: localEvents.length, external: externalEvents.length } };
  }

  let profile = {};
  try { profile = JSON.parse(newestTagged.content); } catch { profile = {}; }
  const source = newestTagged.__source;
  const event = { ...newestTagged };
  delete event.__source;

  return {
    event,
    profile,
    createdAt: Number(newestTagged.created_at) || null,
    source,
    sources: { local: localEvents.length, external: externalEvents.length },
  };
}

module.exports = { resolveProfile, queryExternal, scanLocal };
