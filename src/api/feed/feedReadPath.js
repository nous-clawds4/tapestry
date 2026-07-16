/**
 * Live-feed read path (Story live-feed #1, ADR live-feed/0001 — Option A).
 *
 * A single self-contained, additive, read-only module that assembles the feed's
 * contents: kind-1 notes authored by the accounts a single SOURCE identity
 * follows, newest-first, capped at the 50 most recent, with author display name +
 * avatar drawn from LOCAL kind-0 profile data (never the external relays).
 *
 * Exports:
 *   - buildFeed(options)   — the orchestrator, returns a discriminated `status`
 *     union { OK, EMPTY, NO_SOURCE, FOLLOW_LIST_UNAVAILABLE } plus, on OK/EMPTY,
 *     a `relaySource` discriminator { set, fallback } and an `items` array shaped
 *       { id, pubkey, createdAt, content, author: { displayName, avatar },
 *         mentions: { <pubkey>: <displayName> } }.
 *     `mentions` resolves the note's `nostr:npub…/nprofile…` references to local
 *     display names (so the UI shows "@name" not a raw npub); empty when none resolve.
 *   - handleGetFeed(req, res) — the public GET /api/feed Express handler.
 *
 * Injectable dependency seam (ADR amendment 2026-06-15; fifth boundary added by
 * story test-hermeticity-ci #1, 2026-07-05). buildFeed reads its five I/O
 * boundaries from `options`, each defaulting to the real helper when absent.
 * Fakes may be spread onto the options object OR live under `options.deps`
 * (read `options.deps?.X ?? options.X ?? <realHelper>`):
 *   - getSettings()          — House-PoV read (resolveSource)
 *   - scanStrfry(filter)     — local strfry scan for kind-3 / kind-0
 *   - runCypher(cypher,prms) — general-purpose relay-set resolution
 *   - querySync(relays,flt)  — external kind-1 fetch
 *   - getTaPubkey()          — TA pubkey for the relay-set handle (runtime-
 *     resolved via utils/assistantKeys: env → brainstorm.conf → secure storage;
 *     never hardcoded — CLAUDE.md house rule)
 * Production callers invoke buildFeed({ sessionPubkey }) with no deps and get the
 * real helpers unchanged. The seam is parameter wiring only — no new dependency,
 * no behavior change, no firmware change. Relay-set degrade is LEGIBLE: any
 * resolution failure logs its cause alongside the fallback decision.
 */

// nostr-tools / ws are required via the container's absolute module path, the
// same convention fetchEvents.js / fetchProfiles.js use. Done lazily inside the
// real querySync helper so the module loads in test/CI where the path is absent.
const NOSTR_TOOLS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools';
const WS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/ws';

// Shared note enrichment (author + mention display names from local kind-0). Extracted
// so the profile "latest note" and per-user notes read paths reuse the same logic/shape.
const { enrichNotes } = require('../_shared/noteEnrichment');

const FETCH_TIMEOUT_MS = 8000;
const FEED_CAP = 50;
const FALLBACK_RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol'];
const RELAY_SET_SLUG = 'the-set-of-general-purpose-relays';

const HEX64 = /^[0-9a-f]{64}$/i;

/**
 * Coerce a pagination `until` (Unix seconds; arrives as a query string) to a positive
 * integer, or `undefined` for absent/junk. Undefined ⇒ no cursor ⇒ the most-recent page.
 */
function coerceUntil(raw) {
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

// ─── Real helper defaults (used when no deps are injected) ──────────────────────

/** Default House-PoV read. */
function realGetSettings() {
  return require('../../config/settings').getSettings();
}

/** Default local strfry scan (kind-3 follows / kind-0 profiles). */
function realScanStrfry(filter) {
  const { execSync } = require('child_process');
  const filterStr = typeof filter === 'string' ? filter : JSON.stringify(filter);
  const raw = execSync(`strfry scan '${filterStr.replace(/'/g, "\\'")}'`, {
    timeout: 5000, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const events = [];
  for (const line of raw.trim().split('\n')) {
    if (!line) continue;
    try { events.push(JSON.parse(line)); } catch { /* skip non-event log lines */ }
  }
  return events;
}

/** Default relay-set resolution via Neo4j. */
function realRunCypher(cypher, params) {
  return require('../../lib/neo4j-driver').runCypher(cypher, params);
}

/** Default TA-pubkey read — lazy + runtime-resolved (never hardcoded). */
function realGetTaPubkey() {
  return require('../../utils/assistantKeys').getOwnerAssistantPubkey();
}

/** Default external kind-1 fetch via SimplePool. */
async function realQuerySync(relays, filter) {
  if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = require(WS_PATH);
  }
  const { SimplePool } = require(NOSTR_TOOLS_PATH);
  const pool = new SimplePool();
  try {
    return await Promise.race([
      pool.querySync(relays, filter),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), FETCH_TIMEOUT_MS)),
    ]);
  } finally {
    try { pool.close(relays); } catch { /* ignore */ }
  }
}

// ─── Internal orchestration helpers ─────────────────────────────────────────────

/**
 * Resolve the source identity: the logged-in user wins; else the House PoV; else
 * null. → { pubkey, origin: 'login' | 'house' } or null.
 */
function resolveSource(sessionPubkey, getSettings) {
  if (sessionPubkey && HEX64.test(sessionPubkey)) {
    return { pubkey: sessionPubkey, origin: 'login' };
  }
  let povPubkey = null;
  try {
    povPubkey = getSettings()?.grapevine?.searchPreferences?.povPubkey || null;
  } catch { /* treat unreadable settings as no House PoV */ }
  if (povPubkey && HEX64.test(povPubkey)) {
    return { pubkey: povPubkey, origin: 'house' };
  }
  return null;
}

/**
 * Read the source's latest kind-3 follow list from local strfry.
 * → { follows: string[] } when a kind-3 is present (zero p-tags ⇒ follows: []),
 *   or null when NO kind-3 exists at all (the FOLLOW_LIST_UNAVAILABLE sentinel).
 */
async function getLocalFollows(pubkey, scanStrfry) {
  const events = await scanStrfry({ kinds: [3], authors: [pubkey] });
  const kind3s = (events || []).filter(ev => ev && ev.kind === 3 && ev.pubkey === pubkey);
  if (kind3s.length === 0) return null; // no kind-3 at all ⇒ unavailable
  const newest = kind3s.reduce((a, b) => (b.created_at > a.created_at ? b : a));
  const follows = [];
  const seen = new Set();
  for (const tag of newest.tags || []) {
    if (Array.isArray(tag) && tag[0] === 'p' && tag[1] && !seen.has(tag[1])) {
      seen.add(tag[1]);
      follows.push(tag[1]);
    }
  }
  return { follows };
}

/** One legible line naming why the relay set degraded (see module header). */
function logRelaySetDegrade(stage, err) {
  const detail = err ? `${err.message}${err.code ? ` [${err.code}]` : ''}` : 'no TA pubkey resolvable';
  console.error(`[feed] relay-set resolution failed (${stage}: ${detail}); using fallback relays`);
}

/**
 * Resolve the general-purpose relay set by slug-from-TA. Empty / error ⇒ the
 * hardcoded fallback relays. → { relays: string[], source: 'set' | 'fallback' }.
 * The TA read and the query are guarded separately so a packaging/install
 * failure (e.g. MODULE_NOT_FOUND) is never silently indistinguishable from an
 * empty relay set; a null TA short-circuits (no 39999:null:… handle is queried).
 */
async function resolveGeneralPurposeRelays(runCypher, getTaPubkey) {
  let ta;
  try {
    ta = getTaPubkey();
  } catch (err) {
    logRelaySetDegrade('TA pubkey read', err);
    return { relays: FALLBACK_RELAYS.slice(), source: 'fallback' };
  }
  if (!ta) {
    logRelaySetDegrade('TA pubkey read', null);
    return { relays: FALLBACK_RELAYS.slice(), source: 'fallback' };
  }
  try {
    const handle = `39999:${ta}:${RELAY_SET_SLUG}`;
    const rows = await runCypher(
      'MATCH (s:Set {uuid:$h})-[:HAS_ELEMENT]->(m:ListItem) WHERE NOT m:Superset ' +
      'MATCH (m)-[:HAS_TAG]->(jt:NostrEventTag {type:\'json\'}) RETURN jt.value AS json',
      { h: handle }
    );
    const relays = [];
    for (const row of rows || []) {
      try {
        const url = JSON.parse(row.json)?.nostrRelay?.websocketUrl;
        if (typeof url === 'string' && (url.startsWith('wss://') || url.startsWith('ws://'))) {
          relays.push(url);
        }
      } catch { /* skip unparseable member */ }
    }
    if (relays.length > 0) return { relays, source: 'set' };
  } catch (err) {
    logRelaySetDegrade('set query', err);
  }
  return { relays: FALLBACK_RELAYS.slice(), source: 'fallback' };
}

/**
 * Fetch kind-1 notes from the relays for the followed authors, then app-side:
 * keep only kind-1 authored by a followed pubkey, sort newest-first, cap at 50.
 */
async function fetchNotes(followPubkeys, relays, querySync, until) {
  if (followPubkeys.length === 0) return [];
  const followSet = new Set(followPubkeys);
  const filter = { kinds: [1], authors: followPubkeys, limit: FEED_CAP };
  if (until) filter.until = until;  // relay cursor: notes at-or-before `until` (pagination)
  const events = (await querySync(relays, filter)) || [];
  const seen = new Set();
  const notes = [];
  for (const ev of events) {
    if (!ev || ev.kind !== 1) continue;        // kind-1 only ⇒ excludes kind-6 / kind-7
    if (!followSet.has(ev.pubkey)) continue;   // drop non-followed authors
    if (seen.has(ev.id)) continue;             // dedup by id
    seen.add(ev.id);
    notes.push(ev);
  }
  notes.sort((a, b) => b.created_at - a.created_at);
  return notes.slice(0, FEED_CAP);
}

// ─── Orchestrator ───────────────────────────────────────────────────────────────

/**
 * Assemble the feed. See the four-outcome contract in the module header / ADR.
 * @param {Object} options - { sessionPubkey } plus optional injected deps (spread
 *   or under `options.deps`): getSettings, scanStrfry, runCypher, querySync.
 */
async function buildFeed(options = {}) {
  const { sessionPubkey, until, deps } = options;
  const getSettings = deps?.getSettings ?? options.getSettings ?? realGetSettings;
  const scanStrfry = deps?.scanStrfry ?? options.scanStrfry ?? realScanStrfry;
  const runCypher = deps?.runCypher ?? options.runCypher ?? realRunCypher;
  const querySync = deps?.querySync ?? options.querySync ?? realQuerySync;
  const getTaPubkey = deps?.getTaPubkey ?? options.getTaPubkey ?? realGetTaPubkey;
  const untilCursor = coerceUntil(until);  // pagination cursor; junk/absent ⇒ undefined (page 1)

  // 1. Source identity. None ⇒ NO_SOURCE (no relays queried).
  const source = resolveSource(sessionPubkey, getSettings);
  if (!source) return { status: 'NO_SOURCE' };

  // 2. Local kind-3 follow list. No kind-3 at all ⇒ FOLLOW_LIST_UNAVAILABLE.
  const followResult = await getLocalFollows(source.pubkey, scanStrfry);
  if (followResult === null) {
    return { status: 'FOLLOW_LIST_UNAVAILABLE', source };
  }

  // 3. Relay set (slug-from-TA) with fallback.
  const { relays, source: relaySource } = await resolveGeneralPurposeRelays(runCypher, getTaPubkey);

  // 4. Fetch + filter + order + cap, then enrich from local profiles.
  const notes = await fetchNotes(followResult.follows, relays, querySync, untilCursor);
  const items = await enrichNotes(notes, scanStrfry);

  if (items.length === 0) {
    return { status: 'EMPTY', source, relaySource, items: [] };
  }
  return { status: 'OK', source, relaySource, items };
}

// ─── Public Express handler ─────────────────────────────────────────────────────

/** GET /api/feed — public, read-only. */
async function handleGetFeed(req, res) {
  try {
    const r = await buildFeed({ sessionPubkey: req.session?.pubkey, until: req.query.until });
    res.json({ success: true, ...r });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { buildFeed, handleGetFeed };
