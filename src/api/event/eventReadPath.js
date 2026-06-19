/**
 * Event read path (Story event-page #1, ADR event-page/0001 — Option A).
 *
 * A self-contained, additive, read-only module that resolves a single kind-1 event for the
 * /event page: either by event id (from nevent/id) or the most-recent kind-1 by a given author
 * (from pubkey/npub/nprofile). Events are fetched from a RELAY UNION — supplied hints + the
 * author's outbox (NIP-65 kind-10002 write relays) + the instance's well-known relays (the
 * general-purpose set, else the fixed fallback) — verified, kind-gated, and enriched into the
 * shared feed item shape (author/mention names from LOCAL kind-0).
 *
 * naddr is NOT handled here: its kind is in the coordinate (addressable, never kind-1), so the
 * page reports "kind <N> not yet supported" without a fetch. This path is by-id / by-author only.
 *
 * Exports:
 *   - buildEvent(options) — discriminated `status` union { OK, UNSUPPORTED_KIND, INVALID_EVENT,
 *     NOT_FOUND, NO_AUTHOR_NOTE, INVALID } (+ `relaySource` { set, fallback } on the fetched
 *     outcomes; `kind` on UNSUPPORTED_KIND; `item` (feed shape) on OK).
 *   - handleGetEvent(req, res) — public GET /api/event (INVALID → 400; else 200 { success, ... }).
 *
 * Injectable dependency seam (mirrors feedReadPath / userNotesReadPath): buildEvent reads its
 * three I/O boundaries from options, each defaulting to the real helper (from _shared/relaySource):
 *   - scanStrfry(filter)     — local kind-0 (via enrichNotes)
 *   - runCypher(cypher,prms) — general-purpose relay-set resolution
 *   - querySync(relays,flt)  — external fetch (by-id / by-author / kind-10002 outbox)
 */

const {
  resolveGeneralPurposeRelays, realQuerySync, realScanStrfry, realRunCypher, NOSTR_TOOLS_PATH,
} = require('../_shared/relaySource');
const { enrichNotes } = require('../_shared/noteEnrichment');

const HEX64 = /^[0-9a-f]{64}$/i;
const AUTHOR_FETCH_CAP = 10;   // newest batch to verify through for a by-author lookup
const OUTBOX_FETCH_CAP = 5;    // newest kind-10002s to consider for the outbox

let _verifyEvent;
function verify(ev) {
  if (_verifyEvent === undefined) {
    try { _verifyEvent = require(NOSTR_TOOLS_PATH).verifyEvent; }
    catch { try { _verifyEvent = require('nostr-tools').verifyEvent; } catch { _verifyEvent = null; } }
  }
  if (!_verifyEvent) return false;
  try { return _verifyEvent(ev) === true; } catch { return false; }
}

function onlyWs(arr) {
  return (arr || []).filter(r => typeof r === 'string' && (r.startsWith('wss://') || r.startsWith('ws://')));
}
function unionRelays(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const r of onlyWs(list)) { if (!seen.has(r)) { seen.add(r); out.push(r); } }
  }
  return out;
}

/**
 * The author's outbox = write-eligible relays from their newest NIP-65 kind-10002, fetched from
 * the bootstrap relays. Read-marked r-tags are excluded. Missing / none → [].
 */
async function fetchOutboxRelays(author, bootstrapRelays, querySync) {
  if (!author || !HEX64.test(author) || bootstrapRelays.length === 0) return [];
  let events = [];
  try { events = (await querySync(bootstrapRelays, { kinds: [10002], authors: [author], limit: OUTBOX_FETCH_CAP })) || []; }
  catch { return []; }
  const lists = events.filter(ev => ev && ev.kind === 10002 && ev.pubkey === author);
  if (lists.length === 0) return [];
  const newest = lists.reduce((a, b) => (b.created_at > a.created_at ? b : a));
  const relays = [];
  for (const t of newest.tags || []) {
    if (!Array.isArray(t) || t[0] !== 'r' || typeof t[1] !== 'string' || !t[1]) continue;
    if (t[2] === 'read') continue; // write-eligible only (no marker = read+write)
    relays.push(t[1]);
  }
  return onlyWs(relays);
}

/**
 * Resolve a single kind-1 for /event. See the discriminated-outcome contract in the header.
 * @param {Object} options - { id?, author?, relays? } plus optional injected deps (spread or
 *   under options.deps): scanStrfry, runCypher, querySync.
 */
async function buildEvent(options = {}) {
  const { id, author, relays, deps } = options;
  const scanStrfry = deps?.scanStrfry ?? options.scanStrfry ?? realScanStrfry;
  const runCypher = deps?.runCypher ?? options.runCypher ?? realRunCypher;
  const querySync = deps?.querySync ?? options.querySync ?? realQuerySync;

  const validId = typeof id === 'string' && HEX64.test(id);
  const validAuthor = typeof author === 'string' && HEX64.test(author);

  // Mode: by-id wins; else by-author; else INVALID (no relays/Neo4j queried).
  if (!validId && !validAuthor) return { status: 'INVALID' };

  const hints = onlyWs(relays);
  const { relays: wellKnown, source: relaySource } = await resolveGeneralPurposeRelays(runCypher);

  // Outbox lookup whenever we know an author (by-author always; by-id when an author hint rode
  // along, e.g. from an nevent). Bootstrap from hints + well-known.
  const outbox = validAuthor
    ? await fetchOutboxRelays(author, unionRelays(hints, wellKnown), querySync)
    : [];
  const union = unionRelays(hints, outbox, wellKnown);

  if (validId) {
    const events = (await querySync(union, { ids: [id] })) || [];
    const ev = events.find(e => e && e.id === id);
    if (!ev) return { status: 'NOT_FOUND', relaySource };
    if (!verify(ev)) return { status: 'INVALID_EVENT', relaySource };
    if (ev.kind !== 1) return { status: 'UNSUPPORTED_KIND', kind: ev.kind, relaySource };
    const [item] = await enrichNotes([ev], scanStrfry);
    return { status: 'OK', relaySource, item };
  }

  // by-author: newest VERIFIED kind-1 by this author.
  const events = (await querySync(union, { kinds: [1], authors: [author], limit: AUTHOR_FETCH_CAP })) || [];
  const candidates = events
    .filter(e => e && e.kind === 1 && e.pubkey === author)
    .sort((a, b) => b.created_at - a.created_at);
  const chosen = candidates.find(verify);
  if (!chosen) return { status: 'NO_AUTHOR_NOTE', relaySource };
  const [item] = await enrichNotes([chosen], scanStrfry);
  return { status: 'OK', relaySource, item };
}

/** GET /api/event — public, read-only. INVALID → 400; OK/EMPTY-ish outcomes → 200. */
async function handleGetEvent(req, res) {
  try {
    const { id, author, relays } = req.query || {};
    const relayList = typeof relays === 'string' ? relays.split(',').map(r => r.trim()).filter(Boolean) : undefined;
    const r = await buildEvent({ id, author, relays: relayList });
    if (r.status === 'INVALID') {
      return res.status(400).json({ success: false, ...r, error: 'no valid id or author' });
    }
    return res.json({ success: true, ...r });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { buildEvent, handleGetEvent, fetchOutboxRelays };
