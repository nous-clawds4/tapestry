/**
 * The real-time path's planner (epic tagging-edges, story 3; ADR tagging-edges/0003 and its amendment A1).
 *
 * Pure, like its siblings: plain values, Maps and Sets in and out; only sibling requires, no I/O, clock,
 * randomness, hashing or logging (the engine in src/pipeline/tagging-edges/realtime/ does those). No pubkey is
 * written here: both stamp identities are parameters.
 *
 * A live result is a trigger, never state: every decision reads the relay again (ADR 0002 binding 3). This module
 * turns what the path hears into address prompts, keeps the maps that say what changed while it was away (D3-A:
 * S seen, B the first-start baseline, R refused versions seen; and L, the lineage, A1-1), sizes the strict scans,
 * decides nothing itself — `decideAddress` does — and only holds back what `gateAction` says a round may not do
 * (D4-A). Signatures and shapes are the ADR's clarifications T1–T19, T25, T32 and T33, as A1-17 amends them.
 *
 * The lineage (A1-1, A1-2, A1-15): per tagging address, the latest version the path has learned there (`top`) and
 * up to 8 versions it learned there before it that the graph may still record (`older`). It compares no versions and
 * reads no created_at: it records the order in which the relay's own stores reached the path — a delivery when it is
 * drained, a read or a scan at its capture — and is read in only two places, both of which can only withhold:
 *   - a deletion's `e` target resolves only while it is its address's top (A1-3);
 *   - the gate lets a by-e revoke of X remove the relationship recording G only when X = G (clause i), or when X is
 *     the top and G is in `older` (clause ii, owner decision 11) (A1-4).
 * So nothing discards a revoke for being stale (A1-5): a stale by-e revoke is inert under those two rules.
 *
 * The maps: set S and R entries through `recordId` only (T3), and the lineage through `learnVersion` / `learnOlder`
 * (A1-2), `setLineage` (a record row or a journal line) and `pruneLineage` (A1-7). They also keep two indexes: the
 * address index the ADR keeps with the maps (address → the ids S and R record there), so a deletion's `a` target
 * costs one lookup however many taggings are known, and the top index (`maps.tops`: top id → address), so an `e`
 * target does too. An id deleted straight from a map is forgotten by the address index at its next look.
 *
 * The journal (T19, A1-6): every line that changes a lineage is absolute (`v {id, a, top, older}`, `o {a, top,
 * older}`), so a line lost, torn or replayed alone can leave a lineage only as it was earlier. Each compaction opens a
 * new generation with `e {epoch}`, and `replayJournal` applies only the record's generation, line by line as it reads.
 */

const { taggingToEdge, revokeApplies, revokeTargets, stamp } = require('./contract');
const { REMOVAL_REASON, RUN_ID_RE, checkIdentity, isTaggingAddress, readRelay, storedFromRow } = require('./sweep');

/** The path's bounds (T2). Frozen; nothing configures them. */
const LIMITS = Object.freeze({
  roundAddresses: 500,
  roundCatchUpShare: 100,
  filtersPerScan: 200,
  writeRows: 25,
  elementIds: 1000,
  backlogAddresses: 20000,
  catchUpChunk: 5000,
  roundKeptBytes: 16777216,
  roundScanMaxBytes: 8388608,
  candidateScanMaxBytes: 8388608,
  argvFilterBytes: 100000,
  aTargetMaxBytes: 255,
  journalCompactBytes: 1048576,
  journalFlushMs: 250,
});

const HEX64 = /^[0-9a-f]{64}$/;
// An address's `older` never holds more than 8 ids, learning a ninth drops the oldest-learned (A1-7); an entry keeps at
// most 8 by-e revokes, the most recently merged (A1-5). Dropping either only withholds a removal, never enables one.
// They are module constants, not LIMITS keys: A1-17 leaves LIMITS unchanged.
const OLDER_MAX = 8;
const ENTRY_BY_E_MAX = 8;
const TAGGING_ADDRESS_PARTS = /^39999:([0-9a-f]{64}):(.+)$/s;
// strfry indexes a `d` of at most 255 bytes, and `#d` matches any of an event's `d` tags.
const MAX_D_BYTES = 255;
const RECORDED = Object.freeze(['S', 'R']);
const emptyEntry = () => ({ version: null, revokes: [], look: false });

/** The ScanError codes strfryScanStrict raises (ADR 0003 § Failure handling). */
const SCAN_ERROR_CODES = Object.freeze([
  'spawn', 'process-error', 'timeout', 'exit', 'signal', 'truncated', 'unparseable', 'not-an-event-line', 'duplicate',
  'off-filter', 'too-large', 'filter-too-large',
]);

function isObject(x) { return !!x && typeof x === 'object'; }
function isString(x) { return typeof x === 'string'; }
function list(x) { return Array.isArray(x) ? x : []; }

/** A failed read is never an empty relay (principle 4): refuse to compact or look for deletions without a scan. */
function requireScan(where, scannedIds) {
  if (!(scannedIds instanceof Set)) throw new TypeError(`${where}: scannedIds must be the complete stamp scan's Set of ids`);
}

/** A tagging address's pubkey segment and d, or null. */
function addressParts(address) {
  const m = typeof address === 'string' ? TAGGING_ADDRESS_PARTS.exec(address) : null;
  return m ? { pubkey: m[1], d: m[2] } : null;
}

// ─── T1: the argv escape ─────────────────────────────────────────────────────────────────────────────────────

/**
 * The filter as strfry's argv carries it: JSON with every `/` written `\/`. JSON-equivalent, and no argv of the path
 * can then carry the pass's pgrep pattern, even when a publisher's `d` does (ADR 0003 § Where it runs; AC-5).
 */
function escapeFilterArgv(filter) {
  return JSON.stringify(filter).replace(/\//g, '\\/');
}

/** The escaped text's UTF-8 byte length (T1). */
function filterArgvBytes(filter) {
  return Buffer.byteLength(escapeFilterArgv(filter), 'utf8');
}

/**
 * Split items into groups of at most `maxItems` whose built filter stays within the argv budget. Adding an item to
 * the array a filter carries adds its own escaped JSON, plus a comma after the first, so the size is kept exactly.
 */
function packWithinArgv(items, maxItems, build) {
  const groups = [];
  const base = filterArgvBytes(build([]));
  let group = [];
  let bytes = base;
  for (const item of items) {
    const own = filterArgvBytes(item);
    if (group.length && (group.length >= maxItems || bytes + 1 + own > LIMITS.argvFilterBytes)) {
      groups.push(group);
      group = [];
      bytes = base;
    }
    bytes += (group.length ? 1 : 0) + own;
    group.push(item);
  }
  if (group.length) groups.push(group);
  return groups;
}

// ─── T3: the maps ────────────────────────────────────────────────────────────────────────────────────────────

const INDEX = 'byAddress';

function indexId(index, id, address) {
  let ids = index.get(address);
  if (!ids) { ids = new Set(); index.set(address, ids); }
  ids.add(id);
}

/** The address index kept with the maps: not one of T3's four keys, so it is attached non-enumerably. */
function addressIndex(maps) {
  if (!(maps[INDEX] instanceof Map)) {
    const index = new Map();
    for (const which of RECORDED) for (const [id, e] of maps[which]) indexId(index, id, e.a);
    Object.defineProperty(maps, INDEX, { value: index, configurable: true, writable: true });
  }
  return maps[INDEX];
}

/** The ids the named maps record at an address. Index entries no map holds there any more are forgotten. */
function idsAt(maps, address, which) {
  const index = addressIndex(maps);
  const ids = index.get(address);
  const out = [];
  if (!ids) return out;
  for (const id of ids) {
    const held = RECORDED.filter((w) => { const e = maps[w].get(id); return !!e && e.a === address; });
    if (held.length === 0) ids.delete(id);
    else if (held.some((w) => which.includes(w))) out.push(id);
  }
  if (ids.size === 0) index.delete(address);
  return out;
}

const TOPS = 'tops';

/** The top index kept with the maps (top id → its address; A1-1), attached non-enumerably like the address index. */
function topIndex(maps) {
  if (!(maps[TOPS] instanceof Map)) {
    const index = new Map();
    if (maps.L instanceof Map) for (const [a, lin] of maps.L) if (lin && typeof lin.top === 'string') index.set(lin.top, a);
    Object.defineProperty(maps, TOPS, { value: index, configurable: true, writable: true });
  }
  return maps[TOPS];
}

/**
 * Fresh maps: S seen (completed or baseline), B the baseline ids, R refused versions seen, and L the lineage — per
 * tagging address, `{ top, older }`: the latest version the path has learned there (null for an address only a census
 * recorded, A1-8) and a Set of the versions it learned there before it that the graph may still record, or null when
 * there are none (T3 as A1-17 amends it).
 */
function newMaps() {
  const maps = { S: new Map(), B: new Set(), R: new Map(), L: new Map() };
  addressIndex(maps);
  topIndex(maps);
  return maps;
}

/** The live lineage at an address, or null (A1 clarification 1). */
function lineageAt(maps, address) {
  return maps.L.get(address) || null;
}

// `older` is allocated lazily: most addresses never hold more than their top. Its Set order is the order the ids were
// learned there, so the cap (A1-7) drops the first.
const olderHas = (lin, id) => lin.older !== null && lin.older.has(id);
const olderAdd = (lin, id) => {
  if (lin.older === null) lin.older = new Set();
  lin.older.add(id);
  while (lin.older.size > OLDER_MAX) lin.older.delete(lin.older.values().next().value);
};
const olderDelete = (lin, id) => { if (lin.older !== null) { lin.older.delete(id); if (lin.older.size === 0) lin.older = null; } };
const olderList = (lin) => (lin.older === null ? [] : [...lin.older]);

/**
 * The path learned version `id` at `address` (A1-2): delivered, returned by a strict read, or found by a stamp scan.
 * It becomes the address's top and leaves `older`, and the previous top joins `older` — unless `under` (a read or scan
 * whose capture precedes a later learning at that address), when their order is unknown and it teaches nothing there.
 * → whether the lineage changed
 */
function learnVersion(maps, address, id, { under = false } = {}) {
  if (under) return false;
  let lin = maps.L.get(address);
  if (!lin) { lin = { top: null, older: null }; maps.L.set(address, lin); }
  if (lin.top === id) return false;
  const tops = topIndex(maps);
  olderDelete(lin, id); // first, so the cap never drops an id for one that is leaving (A1 clarification 2)
  if (lin.top !== null) { olderAdd(lin, lin.top); if (tops.get(lin.top) === address) tops.delete(lin.top); }
  lin.top = id;
  const was = tops.get(id);
  if (was !== undefined && was !== address) { const other = maps.L.get(was); if (other && other.top === id) other.top = null; }
  tops.set(id, address);
  return true;
}

/**
 * The graph recorded `id` at `address` below a version the path learned there, or a census recorded it (A1-2, A1-8):
 * `id` joins `older`. → whether the lineage changed
 */
function learnOlder(maps, address, id) {
  if (typeof id !== 'string') return false;
  let lin = maps.L.get(address);
  if (!lin) { lin = { top: null, older: null }; maps.L.set(address, lin); }
  if (lin.top === id || olderHas(lin, id)) return false;
  olderAdd(lin, id);
  return true;
}

/** A copy of the lineage at an address, as a journal line or record row carries it: { top, older: [ids] }, or null. */
function lineageValue(maps, address) {
  const lin = maps.L.get(address);
  return lin ? { top: lin.top, older: olderList(lin) } : null;
}

/**
 * Set an address's lineage exactly (a record row, a `v` or `o` line: A1-6), or drop it with `null`. `older` is listed
 * oldest-learned first; past the cap only the last 8 are kept (A1-7).
 */
function setLineage(maps, address, value) {
  const tops = topIndex(maps);
  const prev = maps.L.get(address);
  if (prev && prev.top !== null && tops.get(prev.top) === address) tops.delete(prev.top);
  if (!value) { maps.L.delete(address); return; }
  const ids = [...new Set(list(value.older).filter((x) => typeof x === 'string' && x !== value.top))].slice(-OLDER_MAX);
  const lin = { top: typeof value.top === 'string' ? value.top : null, older: ids.length ? new Set(ids) : null };
  maps.L.set(address, lin);
  if (lin.top !== null) tops.set(lin.top, address);
}

/** Set one `{ a, seq }` entry in S or R (T3; A1-17). → the entry. */
function recordId(maps, which, id, address, seq) {
  if (!RECORDED.includes(which)) throw new TypeError(`recordId: which must be 'S' or 'R', got ${String(which)}`);
  const entry = { a: address, seq };
  maps[which].set(id, entry);
  indexId(addressIndex(maps), id, address);
  return entry;
}

// ─── T4, T5: what it hears ───────────────────────────────────────────────────────────────────────────────────

/** The one live REQ's two filters, both limit 0 with no since (T4). Throws on an identity checkIdentity refuses. */
function subscriptionFilters({ canonicalPubkey, localPubkey } = {}) {
  for (const [k, v] of [['canonicalPubkey', canonicalPubkey], ['localPubkey', localPubkey]]) {
    const problem = checkIdentity(v);
    if (problem) throw new TypeError(`subscriptionFilters: identities.${k} is ${problem}`);
  }
  const z = [stamp(canonicalPubkey, 'nostr-user-tag'), stamp(localPubkey, 'nostr-user-tag')];
  return [{ kinds: [39999], '#z': [...new Set(z)], limit: 0 }, { kinds: [5], limit: 0 }];
}

/**
 * A stamped kind 39999 → a version prompt `{ address, id }`: the contract edge's address, or its refusal's for a
 * non-tagging version. Null for anything else, and whenever the contract gives no address (T5, T25).
 */
function promptFromVersion(ev, identities) {
  if (!isObject(ev) || ev.kind !== 39999 || !Array.isArray(ev.tags)) return null;
  const ids = isObject(identities) ? identities : {};
  const stamps = [stamp(ids.canonicalPubkey, 'nostr-user-tag'), stamp(ids.localPubkey, 'nostr-user-tag')].filter(Boolean);
  if (!ev.tags.some((t) => Array.isArray(t) && t[0] === 'z' && stamps.includes(t[1]))) return null;
  const r = taggingToEdge(ev, { canonicalPubkey: ids.canonicalPubkey, localPubkey: ids.localPubkey });
  const address = r && r.ok === true ? r.edge.address : r && r.address;
  return typeof address === 'string' ? { address, id: ev.id } : null;
}

/**
 * A kind-5 resolved on receipt, in memory (T6 as amended, A1-3; D5-A). An `e` target resolves only while it is the
 * top of its address's lineage — strfry delivers in store order, so a deletion naming any other id acted on nothing —
 * and an `a` target only when it is a tagging address of at most 255 bytes that the lineage holds, that S records an
 * id at, or that the graph's keys hold. A resolved target of another author is counted in `foreign` and prompts
 * nothing: strfry does not act on it. → { prompts: [{ address, prompt }], matchedNothing, foreign }
 */
function resolveDeletion(ev, maps, graphAddresses) {
  const named = revokeTargets(ev); // both empty unless a well-formed kind 5
  const graph = graphAddresses && typeof graphAddresses.has === 'function' ? graphAddresses : new Set();
  const prompts = [];
  const keys = new Set();
  let foreign = 0;
  const resolve = (address, by, target) => {
    const parts = addressParts(address);
    if (!parts) return;
    if (parts.pubkey !== ev.pubkey) { foreign += 1; return; }
    const key = JSON.stringify([address, by, target]);
    if (keys.has(key)) return;
    keys.add(key);
    prompts.push({ address, prompt: { type: 'revoke', kind5Id: ev.id, created_at: ev.created_at, by, target } });
  };
  // A1-3: an e target resolves only while it is the latest version the path has learned at its address.
  const tops = topIndex(maps);
  for (const id of named.eventIds) {
    const a = tops.get(id);
    const lin = a === undefined ? null : maps.L.get(a);
    if (lin && lin.top === id) resolve(a, 'e', id);
  }
  for (const address of named.addresses) {
    if (!isTaggingAddress(address) || Buffer.byteLength(address, 'utf8') > LIMITS.aTargetMaxBytes) continue;
    if (graph.has(address) || maps.L.has(address) || idsAt(maps, address, ['S']).length > 0) resolve(address, 'a', address);
  }
  return { prompts, matchedNothing: prompts.length === 0 && foreign === 0, foreign };
}

// ─── T7, T8: how the maps shrink ─────────────────────────────────────────────────────────────────────────────

/**
 * A successful strict read at an address: drop, from S and R, the ids recorded there at or before the capture other
 * than the one the read returned (`null` for an empty read), and drop them from B (T7). The lineage is not touched: a
 * read only ever teaches it (A1-2), and an empty read changes nothing. → { dropped: [ids] }
 */
function shrinkOnRead(maps, address, returnedId, captureSeq) {
  const dropped = [];
  for (const id of idsAt(maps, address, RECORDED)) {
    if (id === returnedId) continue;
    let gone = false;
    for (const which of RECORDED) {
      const e = maps[which].get(id);
      if (e && e.a === address && e.seq <= captureSeq) { maps[which].delete(id); gone = true; }
    }
    if (gone) { maps.B.delete(id); dropped.push(id); }
  }
  return { dropped };
}

/**
 * A catch-up's compaction of S, R and B against its complete stamp scan (T8 as amended, A1-1/A1-7). Entries recorded
 * after the scan began are kept; of the others, S and R keep scanned ids, and B becomes B ∩ scanned. The lineage is
 * pruned by `pruneLineage`. → { dropped: [ids] }
 */
function compact(maps, scannedIds, captureSeq) {
  requireScan('compact', scannedIds);
  const dropped = new Set();
  const prune = (which, keep) => {
    for (const [id, e] of maps[which]) {
      if (e.seq > captureSeq || keep(id)) continue;
      maps[which].delete(id);
      dropped.add(id);
    }
  };
  prune('S', (id) => scannedIds.has(id));
  prune('R', (id) => scannedIds.has(id));
  for (const id of maps.B) {
    if (!scannedIds.has(id)) { maps.B.delete(id); dropped.add(id); }
  }
  delete maps[INDEX];
  addressIndex(maps);
  return { dropped: [...dropped] };
}

/**
 * A catch-up's compaction of the lineage (A1-7). An address's lineage is dropped when all of these hold: its top is not
 * in the stamp scan, the graph's keys did not hold the address, it is not in `keep` (work pending, in flight, parked or
 * re-looked there), and nothing was learned there after the scan's capture (`learnedAfter`: address → ids; A1
 * clarification 1). At every address kept, `older` is cut to the id the graph's keys recorded there plus the ids
 * learned there after the capture, whether or not work waits there. While a pass may still write from an older read
 * (`keepOlder`, the pass exception), nothing is dropped or cut: only the cap applies. → { droppedAddresses }
 */
function pruneLineage(maps, { scannedIds, graphKeys, keep, keepOlder = false, learnedAfter } = {}) {
  requireScan('pruneLineage', scannedIds);
  const graph = graphKeys instanceof Map ? graphKeys : new Map();
  const held = keep instanceof Set ? keep : new Set();
  const after = learnedAfter instanceof Map ? learnedAfter : new Map();
  let droppedAddresses = 0;
  if (keepOlder) return { droppedAddresses };
  for (const [address, lin] of [...maps.L]) {
    const late = after.get(address);
    const learnedLate = late instanceof Set && late.size > 0;
    const onRelay = lin.top !== null && scannedIds.has(lin.top);
    if (!held.has(address) && !learnedLate && !onRelay && !graph.has(address)) {
      setLineage(maps, address, null);
      droppedAddresses += 1;
      continue;
    }
    const g = graph.get(address);
    for (const id of olderList(lin)) if (id !== g && !(late && late.has(id))) olderDelete(lin, id);
  }
  return { droppedAddresses };
}

// ─── T9–T11: the catch-up ────────────────────────────────────────────────────────────────────────────────────

/**
 * The stamp scan against the maps and the graph's keys (T9). Arrivals are scanned ids S does not hold, back-dated
 * history and still-pending heard ids alike. A look-only prompt goes to an address, not already an arrival, where
 * (i) the graph records another event id, or (ii) the graph holds nothing and the id is in S but not B — never for
 * an (id, address) in R. → { arrivals: [{ address, id }], lookOnly: [address] }
 */
function arrivalsAndLookOnly(scanPairs, maps, graphKeys) {
  const graph = graphKeys instanceof Map ? graphKeys : new Map();
  const arrivals = [];
  const arrivalKeys = new Set();
  const arrivalAddresses = new Set();
  for (const [id, address] of list(scanPairs)) {
    if (maps.S.has(id)) continue;
    const key = JSON.stringify([address, id]);
    if (arrivalKeys.has(key)) continue;
    arrivalKeys.add(key);
    arrivalAddresses.add(address);
    arrivals.push({ address, id });
  }
  const lookOnly = [];
  const looked = new Set();
  for (const [id, address] of list(scanPairs)) {
    if (arrivalAddresses.has(address) || looked.has(address)) continue;
    const refused = maps.R.get(id);
    if (refused && refused.a === address) continue;
    const otherInGraph = graph.has(address) && graph.get(address) !== id;
    const unheldBySelf = !graph.has(address) && maps.S.has(id) && !maps.B.has(id);
    if (otherInGraph || unheldBySelf) {
      looked.add(address);
      lookOnly.push(address);
    }
  }
  return { arrivals, lookOnly };
}

/**
 * Versions that may have been revoked while the path was away (T10; A1-9): graph event ids the scan no longer finds,
 * and each lineage top the scan no longer finds at an address the graph holds with another id (rule 2: the
 * heard-then-revoked case; no other id could pass the gate). Tagging addresses only; each once. → [{ address, id }]
 */
function deletionCandidates(graphKeys, scannedIds, maps) {
  requireScan('deletionCandidates', scannedIds);
  const graph = graphKeys instanceof Map ? graphKeys : new Map();
  const out = [];
  const keys = new Set();
  const add = (address, id) => {
    if (!isTaggingAddress(address) || typeof id !== 'string' || !HEX64.test(id)) return;
    const key = JSON.stringify([address, id]);
    if (keys.has(key)) return;
    keys.add(key);
    out.push({ address, id });
  };
  for (const [address, eventId] of graph) {
    if (!scannedIds.has(eventId)) add(address, eventId);
  }
  for (const [address, lin] of maps.L) {
    const id = lin.top;
    if (id !== null && !scannedIds.has(id) && graph.has(address) && graph.get(address) !== id) add(address, id);
  }
  return out;
}

/**
 * The author-scoped kind-5 scans for deletion candidates (T11): per author, `#e` filters of its ids and `#a`
 * filters of its addresses of at most 255 bytes, each sized to the argv budget after the escape.
 * → [{ pubkey, by: 'e' | 'a', targets, filter }]
 */
function deletionScanFilters(candidates) {
  const byAuthor = new Map();
  for (const c of list(candidates)) {
    const parts = isObject(c) ? addressParts(c.address) : null;
    if (!parts) continue;
    let mine = byAuthor.get(parts.pubkey);
    if (!mine) { mine = { e: new Set(), a: new Set() }; byAuthor.set(parts.pubkey, mine); }
    if (typeof c.id === 'string') mine.e.add(c.id);
    if (Buffer.byteLength(c.address, 'utf8') <= LIMITS.aTargetMaxBytes) mine.a.add(c.address);
  }
  const out = [];
  for (const [pubkey, mine] of byAuthor) {
    for (const by of ['e', 'a']) {
      const build = (targets) => ({ kinds: [5], authors: [pubkey], [`#${by}`]: targets });
      for (const targets of packWithinArgv([...mine[by]], Infinity, build)) {
        out.push({ pubkey, by, targets, filter: build(targets.slice()) });
      }
    }
  }
  return out;
}

/** Does a kind-5 answer its candidate scan? Kind 5, the requested author, and a requested target by `by` (T11). */
function isExpectedDeletion(ev, { pubkey, by, targets } = {}) {
  if (!isObject(ev) || ev.kind !== 5 || typeof ev.pubkey !== 'string' || ev.pubkey.toLowerCase() !== pubkey) return false;
  if (!Array.isArray(ev.tags) || (by !== 'e' && by !== 'a')) return false;
  const named = new Set();
  for (const t of ev.tags) {
    if (Array.isArray(t) && t[0] === by && typeof t[1] === 'string') named.add(by === 'e' ? t[1].toLowerCase() : t[1]);
  }
  return list(targets).some((x) => named.has(x));
}

// ─── T12–T14: a round's strict reads ─────────────────────────────────────────────────────────────────────────

/** The round's address reads: chunks of at most 200 one-address filters, each chunk within the argv budget (T12). */
function addressScanFilters(addresses) {
  const filters = [];
  for (const address of new Set(list(addresses))) {
    const parts = addressParts(address);
    if (parts) filters.push({ kinds: [39999], authors: [parts.pubkey], '#d': [parts.d] });
  }
  return packWithinArgv(filters, LIMITS.filtersPerScan, (chunk) => chunk);
}

/** Does an event answer an address read? Kind 39999, a requested address's author, and its `d` as any `d` ≤ 255 bytes. */
function isExpectedAddressEvent(ev, addresses) {
  if (!isObject(ev) || ev.kind !== 39999 || typeof ev.pubkey !== 'string' || !Array.isArray(ev.tags)) return false;
  const prefix = `39999:${ev.pubkey.toLowerCase()}:`;
  const ds = new Set();
  for (const t of ev.tags) {
    if (Array.isArray(t) && t[0] === 'd' && typeof t[1] === 'string' && Buffer.byteLength(t[1], 'utf8') <= MAX_D_BYTES) ds.add(t[1]);
  }
  return list(addresses).some((a) => typeof a === 'string' && a.startsWith(prefix) && ds.has(a.slice(prefix.length)));
}

/** The round's element reads: `{ kinds: [39999], ids }` of 1 to 1,000 ids, each within the argv budget (T12). */
function elementScanFilters(ids) {
  const build = (chunk) => ({ kinds: [39999], ids: chunk });
  return packWithinArgv([...new Set(list(ids))], LIMITS.elementIds, build).map(build);
}

/** Does an event answer an element read? Kind 39999 and a requested lower-cased id (T12). */
function isExpectedElementEvent(ev, ids) {
  return isObject(ev) && ev.kind === 39999 && typeof ev.id === 'string' && list(ids).includes(ev.id.toLowerCase());
}

/** The first event per lower-cased id, in order (T13). */
function dedupeById(events) {
  const seen = new Set();
  const out = [];
  for (const ev of list(events)) {
    const key = isObject(ev) && typeof ev.id === 'string' ? ev.id.toLowerCase() : null;
    if (key !== null) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(ev);
  }
  return out;
}

/**
 * What the relay holds at one address from a round's reads (T14): the address events whose identity `d` gives this
 * address, plus the element events unfiltered (so a tag element elsewhere still resolves an id-only tagging),
 * de-duplicated by id and read by `readRelay`. → an edge, a refusal, `{ conflict: true, count }` or null.
 */
function relayAtAddress(addressEvents, elementEvents, address, identities) {
  const here = list(addressEvents).filter((ev) => {
    const p = promptFromVersion(ev, identities);
    return p !== null && p.address === address;
  });
  const at = readRelay(dedupeById(here.concat(list(elementEvents))), identities).byAddress.get(address);
  return at || null;
}

// ─── T15, T16: prompts, entries and the gate ─────────────────────────────────────────────────────────────────

/**
 * Merge a prompt into an address's entry (T15) → a new entry `{ version, revokes, look }`: the latest version
 * prompt; per `(by, target)` the revoke with the greatest created_at, whole (a tie keeps the one held); look ORed.
 * At most 8 by-e revokes are kept, the most recently merged (A1-5): a by-e revoke merged again with a newer created_at
 * moves to the end (the same one again, or an older one, keeps its place: A1 clarification 6), and a ninth drops the
 * least recently merged (that only withholds a removal). An entry holds at most one by-a revoke, since a by-a revoke
 * names the entry's own address.
 */
function mergePrompt(entry, prompt) {
  const e = isObject(entry) ? entry : emptyEntry();
  const out = {
    version: isObject(e.version) ? e.version : null,
    revokes: list(e.revokes).slice(),
    look: e.look === true,
  };
  if (!isObject(prompt)) return out;
  if (prompt.type === 'version') {
    out.version = { id: prompt.id };
  } else if (prompt.type === 'look') {
    out.look = true;
  } else if (prompt.type === 'revoke') {
    const i = out.revokes.findIndex((r) => r.by === prompt.by && r.target === prompt.target);
    const newer = i < 0 || prompt.created_at > out.revokes[i].created_at;
    const kept = newer ? { ...prompt } : out.revokes[i];
    if (i < 0) out.revokes.push(kept);
    else if (prompt.by === 'e' && newer) { out.revokes.splice(i, 1); out.revokes.push(kept); } else out.revokes[i] = kept;
    if (prompt.by === 'e') {
      let n = out.revokes.filter((r) => isObject(r) && r.by === 'e').length;
      while (n > ENTRY_BY_E_MAX) {
        out.revokes.splice(out.revokes.findIndex((r) => isObject(r) && r.by === 'e'), 1);
        n -= 1;
      }
    }
  }
  return out;
}

/** Merge a whole entry into another by mergePrompt's rules (re-looks, restored pending work). */
function mergeEntry(entry, more) {
  let e = mergePrompt(entry, null);
  if (!isObject(more)) return e;
  if (isObject(more.version)) e = mergePrompt(e, { type: 'version', id: more.version.id });
  for (const p of list(more.revokes)) if (isObject(p)) e = mergePrompt(e, { ...p, type: 'revoke' });
  if (more.look === true) e = mergePrompt(e, { type: 'look' });
  return e;
}

/**
 * Hold back what a round may not do (T16; A1-4; D4-A). It never substitutes an action. A create is held while the
 * relay's version is in the baseline (the backfill owns it). A `not-on-relay` removal needs a valid revoke; a
 * `non-tagging` one a valid revoke or a version prompt here. A by-`e` revoke naming X is valid when X is the event id
 * the relationship records (clause i), or when X is the top of `lineage` — the round's copy, taken when it decides the
 * address — and the relationship records a version in its `older` (clause ii, owner decision 11); a by-`a` one only
 * through `revokeApplies` on a well-formed stored edge, with the author taken from the address. A look never removes.
 * → { act: true } | { act: false, held: 'pre-existing' | 'removal-not-prompted' }
 */
function gateAction(decision, { address, storedRow, relayVersionId, entry, baseline, lineage } = {}) {
  const action = isObject(decision) ? decision.action : null;
  if (action === 'create') {
    return baseline && baseline.has(relayVersionId) ? { act: false, held: 'pre-existing' } : { act: true };
  }
  if (action !== 'remove') return { act: true };

  const e = isObject(entry) ? entry : emptyEntry();
  let stored = null;
  const lin = isObject(lineage) ? lineage : null;
  const revokeHolds = (p) => {
    if (!isObject(p)) return false;
    if (p.by === 'e') {
      stored = stored || storedFromRow(storedRow);
      // An eventId that is missing, not a string or not an id satisfies neither clause (A1 clarification 3).
      const recorded = typeof stored.edge.eventId === 'string' && HEX64.test(stored.edge.eventId) ? stored.edge.eventId : null;
      if (recorded === null) return false;
      if (p.target === recorded) return true;
      // `older` as a live lineage holds it (a Set) or as lineageValue lists it.
      const older = lin && lin.older instanceof Set ? lin.older : new Set(list(lin && lin.older));
      return !!lin && lin.top === p.target && older.has(recorded);
    }
    if (p.by !== 'a') return false;
    const parts = addressParts(address);
    if (!parts) return false;
    stored = stored || storedFromRow(storedRow);
    if (!stored.wellFormed) return false;
    const author = parts.pubkey;
    const deletion = { id: p.kind5Id, kind: 5, pubkey: author, created_at: p.created_at, tags: [['a', address]] };
    return revokeApplies({ ...stored.edge, from: author }, deletion).applies === true;
  };
  if (list(e.revokes).some(revokeHolds)) return { act: true };
  if (decision.reason === REMOVAL_REASON.NON_TAGGING && isObject(e.version)) return { act: true };
  return { act: false, held: 'removal-not-prompted' };
}

// ─── T17, T18: the pass and the round order ──────────────────────────────────────────────────────────────────

/**
 * The report runs that overlapped a round (T17; § Coexisting with the pass): started before the round's commit, and
 * ended at or after its graph read, still alive, or dead with endedAt null and first seen dead at or after the graph
 * read. A dead run with no deadSeenAt does not overlap (the caller records it first). startedAt < commitAt is strict;
 * the graph-read ties overlap (A1 clarification 13: endedAt >= graphReadAt, graphReadAt <= deadSeenAt). → [runId]
 */
function passOverlaps({ graphReadAt, commitAt } = {}, runs, isAlive, deadSeenAt) {
  const out = [];
  for (const run of list(runs)) {
    if (!isObject(run) || typeof run.runId !== 'string' || out.includes(run.runId)) continue;
    if (!(Date.parse(run.startedAt) < commitAt)) continue;
    const endedAt = run.endedAt == null ? null : Date.parse(run.endedAt);
    if (endedAt !== null && endedAt >= graphReadAt) { out.push(run.runId); continue; }
    if (typeof isAlive === 'function' && isAlive(run) === true) { out.push(run.runId); continue; }
    const seen = isObject(deadSeenAt) && Object.prototype.hasOwnProperty.call(deadSeenAt, run.runId)
      ? deadSeenAt[run.runId] : null;
    if (endedAt === null && typeof seen === 'number' && graphReadAt <= seen) out.push(run.runId);
  }
  return out;
}

/**
 * A round's addresses (T18; § Lanes and rounds): up to 100 catch-up entries, then live, then re-looks, then the rest
 * of the catch-up, each lane by seq. An address in more than one lane is placed once, at its earliest position, and
 * a repeat takes none of the round's 500 places (T25, T32). → [address]
 */
function roundOrder(queue) {
  const lanes = { catchup: [], live: [], relook: [] };
  for (const q of list(queue)) {
    if (isObject(q) && (q.lane === 'catchup' || q.lane === 'live' || q.lane === 'relook')) lanes[q.lane].push(q);
  }
  const bySeq = (xs) => xs.slice().sort((a, b) => a.seq - b.seq).map((x) => x.address);
  const catchUp = [...new Set(bySeq(lanes.catchup))];
  const ordered = [
    ...catchUp.slice(0, LIMITS.roundCatchUpShare),
    ...bySeq(lanes.live),
    ...bySeq(lanes.relook),
    ...catchUp.slice(LIMITS.roundCatchUpShare),
  ];
  const out = [];
  const placed = new Set();
  for (const address of ordered) {
    if (out.length >= LIMITS.roundAddresses) break;
    if (placed.has(address)) continue;
    placed.add(address);
    out.push(address);
  }
  return out;
}

// ─── T19: the journal ────────────────────────────────────────────────────────────────────────────────────────

/** One journal fact as one compact JSON line, with its newline (T19). */
function journalLine(obj) {
  return `${JSON.stringify(obj)}\n`;
}

/**
 * Rebuild the path's state: `record.json` (or `null`), then each journal line of the record's generation in order
 * (T19, T25, T33; A1-6: the lines after the `e {epoch}` line matching `record.epoch`). A line that does not parse, is
 * not an object, has an unknown `t` or lacks its fields is skipped and counted; an empty line, and a line of another
 * generation, is ignored. Restored and replayed entries get seq 0; `pending` holds entries only, a parked row's entry
 * among them (A1-12). Lines are applied one by one as the iterable yields them, never buffered (A1-6).
 * → { maps, pending: Map<address, entry>, rechecks: [{ a, runId, entry }], deadSeenAt, parked: Map<address, code>,
 *     skippedLines }
 */
function replayJournal(lines, record) {
  const rec = isObject(record) ? record : {};
  const maps = newMaps();
  for (const [which, key] of [['S', 'seen'], ['R', 'refusedSeen']]) {
    for (const pair of list(rec[key])) {
      if (Array.isArray(pair) && isString(pair[0]) && isString(pair[1])) recordId(maps, which, pair[0], pair[1], 0);
    }
  }
  for (const id of list(rec.baseline)) if (isString(id)) maps.B.add(id);
  for (const row of list(rec.lineage)) {
    if (Array.isArray(row) && isString(row[0])) setLineage(maps, row[0], { top: row[1], older: row[2] });
  }

  const pending = new Map();
  for (const p of list(rec.pending)) {
    if (isObject(p) && isString(p.a)) pending.set(p.a, mergeEntry(pending.get(p.a) || null, p.entry));
  }
  const relooks = new Map(); // address → Map<runId, entry>
  const relook = (a, runId, entry) => {
    let at = relooks.get(a);
    if (!at) { at = new Map(); relooks.set(a, at); }
    at.set(runId, mergeEntry(at.get(runId) || null, entry));
  };
  for (const r of list(rec.rechecks)) {
    if (isObject(r) && isString(r.a) && isString(r.runId)) relook(r.a, r.runId, r.entry);
  }
  const deadSeenAt = {};
  const seenDead = (runId, at) => {
    if (RUN_ID_RE.test(runId) && typeof at === 'number' && !Object.prototype.hasOwnProperty.call(deadSeenAt, runId)) {
      deadSeenAt[runId] = at;
    }
  };
  if (isObject(rec.deadSeenAt)) for (const [runId, at] of Object.entries(rec.deadSeenAt)) seenDead(runId, at);
  const parked = new Map(); // address → code (T19); a parked row's entry comes back as its pending entry (A1-12)
  for (const p of list(rec.parked)) {
    if (!isObject(p) || !isString(p.a)) continue;
    parked.set(p.a, p.code);
    if (isObject(p.entry)) pending.set(p.a, mergeEntry(pending.get(p.a) || null, p.entry));
  }

  // A1-6: every line that changes a lineage carries the whole of it, so a line skipped, torn or cut off can leave a
  // lineage only as it was earlier — never in an order the relay did not store. A `v` or `o` line without a well-formed
  // `top` and `older` (an array of ids: a member that is not a string makes it malformed) is skipped and counted (A1
  // clarification 5).
  const lineageOf = (o) => (o.top === null || isString(o.top)) && Array.isArray(o.older) && o.older.every(isString);
  const apply = (o) => {
    if (!isObject(o) || Array.isArray(o)) return false;
    switch (o.t) {
      case 'v': {
        // v {id, a, top, older}: L(a) becomes exactly {top, older}, plus a version prompt for id.
        if (!isString(o.id) || !isString(o.a) || !lineageOf(o)) return false;
        setLineage(maps, o.a, { top: o.top, older: o.older });
        pending.set(o.a, mergePrompt(pending.get(o.a) || null, { type: 'version', id: o.id }));
        return true;
      }
      case 'o':
        // o {a, top, older}: L(a) becomes exactly {top, older}; no prompt (A1 clarification 5).
        if (!isString(o.a) || !lineageOf(o)) return false;
        setLineage(maps, o.a, { top: o.top, older: o.older });
        return true;
      case 'd':
        if (!isString(o.a) || !isObject(o.p) || o.p.type !== 'revoke') return false;
        pending.set(o.a, mergePrompt(pending.get(o.a) || null, o.p));
        return true;
      case 'c': {
        if (!isString(o.id) || !isString(o.a)) return false;
        recordId(maps, 'S', o.id, o.a, 0);
        // A1-5: `c` answers only the version prompt it names; revoke prompts stay (the gate judges them), and an entry
        // left with no version, no revokes and no look is deleted.
        const entry = pending.get(o.a);
        if (entry) {
          const matched = isObject(entry.version) && entry.version.id === o.id;
          const cleared = matched ? { ...entry, version: null } : entry;
          if (!cleared.version && cleared.revokes.length === 0 && !cleared.look) pending.delete(o.a);
          else pending.set(o.a, cleared);
        }
        return true;
      }
      case 'x':
        // x drops the ids it lists from S, R and B only: the lineage is untouched (A1-6).
        if (!isString(o.a) || !Array.isArray(o.dropped)) return false;
        for (const id of o.dropped) {
          for (const which of RECORDED) maps[which].delete(id);
          maps.B.delete(id);
        }
        return true;
      case 'b':
        if (!isString(o.id)) return false;
        maps.B.delete(o.id);
        return true;
      case 'f':
        if (!isString(o.id) || !isString(o.a)) return false;
        recordId(maps, 'R', o.id, o.a, 0);
        return true;
      case 'r':
        if (!isString(o.a) || !isString(o.runId) || !isObject(o.p)) return false;
        relook(o.a, o.runId, o.p);
        return true;
      case 'rc': {
        if (!isString(o.a) || !isString(o.runId)) return false;
        const at = relooks.get(o.a);
        if (at) { at.delete(o.runId); if (at.size === 0) relooks.delete(o.a); }
        return true;
      }
      case 'p':
        if (!isString(o.a) || !isString(o.code)) return false;
        parked.set(o.a, o.code);
        return true;
      case 'k':
        if (!isString(o.runId) || !RUN_ID_RE.test(o.runId) || typeof o.at !== 'number') return false;
        seenDead(o.runId, o.at);
        return true;
      default:
        return false;
    }
  };

  // A1-6, the epoch: every compaction writes record.json with a new `epoch`, then starts the journal with `e {epoch}`.
  // Only the lines after the `e` line matching the record's epoch are the record's generation, and a later `e` line of
  // another epoch ends it. So after a truncation that failed, the older generation's lines (already in the record) are
  // never replayed over it. A record with no epoch (none: a lost record; or one written before A1) takes every line.
  const epoch = typeof rec.epoch === 'number' || isString(rec.epoch) ? rec.epoch : null;
  let inGeneration = epoch === null;
  let generationEnded = false;
  let skippedLines = 0;
  for (const line of lines == null ? [] : lines) {
    if (line === '') continue;
    let o = null;
    try { o = isString(line) ? JSON.parse(line) : null; } catch (_) { o = null; }
    if (isObject(o) && !Array.isArray(o) && o.t === 'e') {
      if (typeof o.epoch !== 'number' && !isString(o.epoch)) { skippedLines += 1; continue; }
      if (epoch === null || generationEnded) continue;
      if (o.epoch === epoch) inGeneration = true;
      else if (inGeneration) { inGeneration = false; generationEnded = true; }
      continue;
    }
    if (!inGeneration) continue; // another generation's line: not damaged, so not counted
    if (!apply(o)) skippedLines += 1;
  }

  const rechecks = [];
  for (const [a, at] of relooks) for (const [runId, entry] of at) rechecks.push({ a, runId, entry });
  return { maps, pending, rechecks, deadSeenAt, parked, skippedLines };
}

// ─── Status text ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * An error code fit for the status (§ Status and switch: all text is fixed), else 'error': an E-code, a Neo4j status
 * code, ServiceUnavailable, SessionExpired or a ScanError code. Never a message, host, address or port.
 */
function allowErrorCode(code) {
  if (typeof code !== 'string') return 'error';
  if (/^E[A-Z0-9_]+$/.test(code)) return code;
  if (/^Neo\.(ClientError|TransientError|DatabaseError)\.[A-Za-z]+\.[A-Za-z]+$/.test(code)) return code;
  if (code === 'ServiceUnavailable' || code === 'SessionExpired') return code;
  if (SCAN_ERROR_CODES.includes(code)) return code;
  return 'error';
}

module.exports = {
  LIMITS,
  escapeFilterArgv,
  filterArgvBytes,
  subscriptionFilters,
  promptFromVersion,
  newMaps,
  recordId,
  learnVersion,
  learnOlder,
  lineageAt,
  lineageValue,
  setLineage,
  pruneLineage,
  resolveDeletion,
  shrinkOnRead,
  compact,
  arrivalsAndLookOnly,
  deletionCandidates,
  deletionScanFilters,
  isExpectedDeletion,
  addressScanFilters,
  isExpectedAddressEvent,
  elementScanFilters,
  isExpectedElementEvent,
  dedupeById,
  relayAtAddress,
  mergePrompt,
  gateAction,
  passOverlaps,
  roundOrder,
  journalLine,
  replayJournal,
  allowErrorCode,
};
