/**
 * Profile "Content" card read path (Story feed-usability #3 / ADR feed-usability/0003).
 *
 * A self-contained, additive, read-only module that selects the ONE note the profile
 * "Content" section shows, in order:
 *   1. the viewed user's PINNED note — the first resolvable `e`-tag of their most-recent
 *      NIP-51 kind-10001 pin list (the pinned note may be authored by anyone);
 *   2. else their most-recent TOP-LEVEL note (`!isReply`, from the shared enrichment);
 *   3. else NO_TOPLEVEL (kind-1 notes exist but all replies) or EMPTY (no kind-1 at all).
 *
 * Built on the SHARED sourcing module `_shared/relaySource` (the third consumer — the
 * consolidation the note-surfaces ADR asked for) and the shared `enrichNotes` (item shape +
 * `isReply`). It is the first kind-10001 reader in the codebase.
 *
 * Exports:
 *   - buildProfileContent(options) — discriminated `status` union { OK, NO_TOPLEVEL, EMPTY,
 *     INVALID } (+ `pinned` boolean and `item` (feed shape) on OK; `relaySource` on the
 *     fetched outcomes).
 *   - handleGetProfileContent(req, res) — public GET /api/user/:pubkey/content
 *     (INVALID → 400; else 200 { success, ... }).
 *   - pinnedNoteIds(tags) — the pure `e`-tag id extractor.
 *
 * Injectable dependency seam (mirrors userNotesReadPath / eventReadPath): buildProfileContent
 * reads its three I/O boundaries from options, each defaulting to the real helper from
 * `_shared/relaySource`:
 *   - scanStrfry(filter)      — local kind-0 (via enrichNotes)
 *   - runCypher(cypher,prms)  — general-purpose relay-set resolution
 *   - querySync(relays,flt)   — external fetch (pin list / pinned notes by id / recent kind-1)
 */

const {
  resolveGeneralPurposeRelays, realQuerySync, realScanStrfry, realRunCypher,
} = require('../_shared/relaySource');
const { enrichNotes } = require('../_shared/noteEnrichment');

const HEX64 = /^[0-9a-f]{64}$/i;
const CONTENT_CAP = 50;   // recent-window for the top-level fallback
const PIN_TRY_CAP = 10;   // max pin ids to attempt resolving

/**
 * The kind-1 event ids referenced by a kind-10001 pin list's `e` tags, in list order
 * (the leading entry is the most-recently-pinned by common client convention), capped at
 * PIN_TRY_CAP. Ignores non-`e` tags and id-less `e` tags. Non-array input ⇒ [].
 */
function pinnedNoteIds(tags) {
  if (!Array.isArray(tags)) return [];
  const ids = [];
  for (const t of tags) {
    if (Array.isArray(t) && t[0] === 'e' && t[1]) ids.push(t[1]);
    if (ids.length >= PIN_TRY_CAP) break;
  }
  return ids;
}

/** The newest event in a list (by created_at), or null. */
function newest(events) {
  let best = null;
  for (const ev of events || []) {
    if (!ev) continue;
    if (best === null || ev.created_at > best.created_at) best = ev;
  }
  return best;
}

/**
 * Resolve the viewed user's pinned note → an enriched item, or null. Reads the newest
 * kind-10001 by `pubkey`, then fetches the referenced ids in one query and picks the FIRST
 * pin-list id that resolves to a kind-1 (deterministic; favors most-recently-pinned).
 */
async function resolvePinnedItem(pubkey, relays, querySync, scanStrfry) {
  const pinEvents = (await querySync(relays, { kinds: [10001], authors: [pubkey] })) || [];
  const list = newest(pinEvents.filter(ev => ev && ev.kind === 10001 && ev.pubkey === pubkey));
  if (!list) return null;
  const ids = pinnedNoteIds(list.tags);
  if (ids.length === 0) return null;
  const notes = (await querySync(relays, { ids, kinds: [1] })) || [];
  const byId = new Map();
  for (const ev of notes) {
    if (ev && ev.kind === 1 && !byId.has(ev.id)) byId.set(ev.id, ev);
  }
  const chosen = ids.map(id => byId.get(id)).find(Boolean);  // first resolvable, in list order
  if (!chosen) return null;
  const [item] = await enrichNotes([chosen], scanStrfry);
  return item || null;
}

/**
 * Assemble the profile "Content" card selection. See the discriminated contract in the
 * module header / ADR.
 * @param {Object} options - { pubkey } plus optional injected deps (spread or under
 *   `options.deps`): scanStrfry, runCypher, querySync.
 */
async function buildProfileContent(options = {}) {
  const { pubkey, deps } = options;
  const scanStrfry = deps?.scanStrfry ?? options.scanStrfry ?? realScanStrfry;
  const runCypher = deps?.runCypher ?? options.runCypher ?? realRunCypher;
  const querySync = deps?.querySync ?? options.querySync ?? realQuerySync;

  // 1. Validate the pubkey FIRST — malformed ⇒ INVALID, no relays/Neo4j queried.
  if (!pubkey || !HEX64.test(pubkey)) return { status: 'INVALID' };

  // 2. Relay set (slug-from-TA) with fallback.
  const { relays, source: relaySource } = await resolveGeneralPurposeRelays(runCypher);

  // 3. Pinned note wins.
  const pinned = await resolvePinnedItem(pubkey, relays, querySync, scanStrfry);
  if (pinned) return { status: 'OK', relaySource, pinned: true, item: pinned };

  // 4. Fallback: most-recent TOP-LEVEL note in the recent window.
  const events = (await querySync(relays, { kinds: [1], authors: [pubkey], limit: CONTENT_CAP })) || [];
  const seen = new Set();
  const raw = [];
  for (const ev of events) {
    if (!ev || ev.kind !== 1) continue;
    if (ev.pubkey !== pubkey) continue;   // author-only ⇒ drop relay-leaked strangers
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    raw.push(ev);
  }
  raw.sort((a, b) => b.created_at - a.created_at);
  const items = await enrichNotes(raw, scanStrfry);
  const top = items.find(it => !it.isReply);
  if (top) return { status: 'OK', relaySource, pinned: false, item: top };

  // 5. Notes exist but all replies ⇒ NO_TOPLEVEL; none at all ⇒ EMPTY.
  return items.length > 0 ? { status: 'NO_TOPLEVEL', relaySource } : { status: 'EMPTY', relaySource };
}

/** GET /api/user/:pubkey/content — public, read-only. INVALID → 400; else 200. */
async function handleGetProfileContent(req, res) {
  try {
    const r = await buildProfileContent({ pubkey: req.params.pubkey });
    if (r.status === 'INVALID') {
      return res.status(400).json({ success: false, ...r, error: 'invalid pubkey' });
    }
    return res.json({ success: true, ...r });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { buildProfileContent, handleGetProfileContent, pinnedNoteIds, CONTENT_CAP, PIN_TRY_CAP };
