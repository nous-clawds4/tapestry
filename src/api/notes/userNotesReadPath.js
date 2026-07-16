/**
 * By-author notes read path (Story note-surfaces #1, ADR note-surfaces/0001 — Option A).
 *
 * A single self-contained, additive, read-only module that assembles ONE user's own recent
 * kind-1 notes: the N most-recent kind-1 events authored by a given pubkey, newest-first,
 * capped at the requested limit (hard max NOTES_CAP), with author display name + avatar (and
 * in-text mention names) drawn from LOCAL kind-0 profile data — never the external relays.
 *
 * It is the simpler sibling of feedReadPath.js: there is NO source identity, NO kind-3 follow
 * list, and NO point-of-view — the author is the pubkey in the URL. Only the SELECTION of raw
 * kind-1 differs (by-author here vs by-follow-set in the feed). The notes are fetched from the
 * general-purpose relays (settled empirically — local strfry holds 0 kind-1); the enrichment
 * reuses the shared enrichNotes seam unchanged.
 *
 * Exports:
 *   - buildUserNotes(options) — the orchestrator, returns a discriminated `status` union
 *     { OK, EMPTY, INVALID } plus, on OK/EMPTY, a `relaySource` discriminator { set, fallback }
 *     and an `items` array of the SAME shape the feed serves:
 *       { id, pubkey, createdAt, content, author: { displayName, avatar }, mentions }.
 *   - handleGetUserNotes(req, res) — the public GET /api/user/:pubkey/notes Express handler
 *     (INVALID → 400; OK/EMPTY → 200 { success:true, ... }).
 *   - clampLimit(raw) — the limit default + hard cap (req.query.limit is a string).
 *   - NOTES_CAP — the hard maximum (and default) note count.
 *
 * Injectable dependency seam (mirrors feedReadPath.js). buildUserNotes reads its three I/O
 * boundaries from `options`, each defaulting to the real helper when absent. Fakes may be
 * spread onto the options object OR live under `options.deps` (read
 * `options.deps?.X ?? options.X ?? <realHelper>`):
 *   - scanStrfry(filter)     — local strfry scan for kind-0 (via enrichNotes)
 *   - runCypher(cypher,prms) — general-purpose relay-set resolution
 *   - querySync(relays,flt)  — external kind-1 fetch (by author)
 * Production callers invoke buildUserNotes({ pubkey, limit }) with no deps and get the real
 * helpers. The seam is parameter wiring only — no behavior change.
 *
 * NOTE (ADR note-surfaces/0001 §Consequences): the sourcing helpers below
 * (resolveGeneralPurposeRelays / realQuerySync / realScanStrfry / the module-path constants)
 * are intentionally DUPLICATED from feedReadPath.js rather than extracted, to keep this change
 * additive and leave the staging-shipped feed read path byte-identical. Consolidation into
 * src/api/_shared/relaySource.js (re-pointing both) is a deferred follow-up.
 */

// nostr-tools / ws required via the container's absolute module path (the convention
// fetchEvents.js / feedReadPath.js use). Done lazily inside the real querySync helper so the
// module loads in test/CI where the path is absent.
const NOSTR_TOOLS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools';
const WS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/ws';

// Shared note enrichment (author + mention display names from local kind-0). Reused unchanged
// from the feed — the one shared seam; only the SELECTION of raw notes differs per read path.
const { enrichNotes } = require('../_shared/noteEnrichment');

const FETCH_TIMEOUT_MS = 8000;
const NOTES_CAP = 50;                 // hard maximum + default note count
const FALLBACK_RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol'];
const RELAY_SET_SLUG = 'the-set-of-general-purpose-relays';

const HEX64 = /^[0-9a-f]{64}$/i;

// ─── Real helper defaults (used when no deps are injected) ──────────────────────

/** Default local strfry scan (kind-0 profiles, via enrichNotes). */
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
 * The note count: default to NOTES_CAP, floor at 1, cap at NOTES_CAP. `req.query.limit` arrives
 * as a string; absent/non-numeric ⇒ the default. (No unbounded result.)
 */
function clampLimit(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return NOTES_CAP;   // absent / non-numeric → default
  if (n < 1) return 1;                          // floor
  if (n > NOTES_CAP) return NOTES_CAP;          // hard cap
  return n;
}

/**
 * Coerce a pagination `until` (Unix seconds; arrives as a query string) to a positive
 * integer, or `undefined` for absent/junk. Undefined ⇒ no cursor ⇒ the most-recent page.
 */
function coerceUntil(raw) {
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * Resolve the general-purpose relay set by slug-from-TA. Empty / error ⇒ the hardcoded fallback
 * relays. → { relays: string[], source: 'set' | 'fallback' }. (Mirrors feedReadPath.js.)
 */
async function resolveGeneralPurposeRelays(runCypher) {
  try {
    const ta = require('../../utils/assistantKeys').getOwnerAssistantPubkey();
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
  } catch { /* fall through to fallback */ }
  return { relays: FALLBACK_RELAYS.slice(), source: 'fallback' };
}

/**
 * Fetch kind-1 notes for a single author from the relays, then app-side: keep only kind-1
 * authored by that pubkey, dedup by id, sort newest-first, cap at `limit`.
 */
async function fetchAuthorNotes(pubkey, limit, relays, querySync, until) {
  const filter = { kinds: [1], authors: [pubkey], limit };
  if (until) filter.until = until;  // relay cursor: notes at-or-before `until` (pagination)
  const events = (await querySync(relays, filter)) || [];
  const seen = new Set();
  const notes = [];
  for (const ev of events) {
    if (!ev || ev.kind !== 1) continue;        // kind-1 only ⇒ excludes kind-6 / kind-7
    if (ev.pubkey !== pubkey) continue;        // author-only ⇒ drop relay-leaked strangers
    if (seen.has(ev.id)) continue;             // dedup by id
    seen.add(ev.id);
    notes.push(ev);
  }
  notes.sort((a, b) => b.created_at - a.created_at);
  return notes.slice(0, limit);
}

// ─── Orchestrator ───────────────────────────────────────────────────────────────

/**
 * Assemble one user's recent notes. See the three-outcome contract in the module header / ADR.
 * @param {Object} options - { pubkey, limit } plus optional injected deps (spread or under
 *   `options.deps`): scanStrfry, runCypher, querySync.
 */
async function buildUserNotes(options = {}) {
  const { pubkey, limit, until, deps } = options;
  const scanStrfry = deps?.scanStrfry ?? options.scanStrfry ?? realScanStrfry;
  const runCypher = deps?.runCypher ?? options.runCypher ?? realRunCypher;
  const querySync = deps?.querySync ?? options.querySync ?? realQuerySync;
  const untilCursor = coerceUntil(until);  // pagination cursor; junk/absent ⇒ undefined (page 1)

  // 1. Validate the author pubkey FIRST — malformed ⇒ INVALID, no relays/Neo4j queried.
  if (!pubkey || !HEX64.test(pubkey)) return { status: 'INVALID' };

  // 2. Count (default + hard cap).
  const n = clampLimit(limit);

  // 3. Relay set (slug-from-TA) with fallback.
  const { relays, source: relaySource } = await resolveGeneralPurposeRelays(runCypher);

  // 4. Fetch + filter + order + cap, then enrich from local profiles.
  const notes = await fetchAuthorNotes(pubkey, n, relays, querySync, untilCursor);
  const items = await enrichNotes(notes, scanStrfry);

  if (items.length === 0) {
    return { status: 'EMPTY', relaySource, items: [] };
  }
  return { status: 'OK', relaySource, items };
}

// ─── Public Express handler ─────────────────────────────────────────────────────

/** GET /api/user/:pubkey/notes — public, read-only. INVALID → 400; OK/EMPTY → 200. */
async function handleGetUserNotes(req, res) {
  try {
    const r = await buildUserNotes({ pubkey: req.params.pubkey, limit: req.query.limit, until: req.query.until });
    if (r.status === 'INVALID') {
      return res.status(400).json({ success: false, ...r, error: 'invalid pubkey' });
    }
    return res.json({ success: true, ...r });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { buildUserNotes, handleGetUserNotes, clampLimit, NOTES_CAP };
