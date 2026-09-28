/**
 * The gap-filling pass's planner (epic tagging-edges, story 2; ADR tagging-edges/0002).
 *
 * Pure, like its sibling contract: plain values in, plain values out; only sibling requires, no
 * I/O, clock, randomness, hashing or logging (the runner in src/pipeline/tagging-edges/ does those).
 * No pubkey is written here: both stamp identities are parameters.
 *
 * The pass follows the relay's current version at each tagging address (D3): it never orders
 * versions to decide a write. For each address it compares what the graph holds (a snapshot row,
 * read first) with what the definition gives for what the relay holds (read second), and plans a
 * create, update, move or removal. Removals are judged against a frozen limit (AC-5).
 */

const { TAGS_RELATIONSHIP, taggingToEdge, standingEdge, stamp } = require('./contract');

/** The nine properties a `TAGS` relationship carries — the contract's edge keys minus type, from and to. */
const TAGS_PROPERTY_KEYS = Object.freeze([
  'address', 'createdAt', 'eventId', 'polarity', 'tagAddress', 'tagEventId', 'tagSlug', 'zCanonical', 'zLocal',
]);

/** The mass-removal limit: held iff removals > floor AND fraction × removals > base. Frozen; nothing configures it. */
const LIMIT = Object.freeze({ floor: 50, fraction: 10 });

const REMOVAL_REASON = Object.freeze({ NOT_ON_RELAY: 'not-on-relay', NON_TAGGING: 'non-tagging' });
const LEFT_REASON = Object.freeze({ MISSING_ADDRESS: 'missing-address', NOT_A_TAGGING_ADDRESS: 'not-a-tagging-address' });
const CHANGE_KIND = Object.freeze({ NEWER: 'newer', OLDER: 'older', MOVED: 'moved', REFRESHED: 'refreshed', REPAIRED: 'repaired' });

/** The one run-id grammar: UTC start `YYYYMMDDTHHMMSSZ`, a dash, 8 lower-case hex characters. */
const RUN_ID_RE = /^\d{8}T\d{6}Z-[0-9a-f]{8}$/;

const HEX64 = /^[0-9a-f]{64}$/;
const HEX64_ANY_CASE = /^[0-9a-fA-F]{64}$/;
const TAGGING_ADDRESS_RE = /^39999:[0-9a-f]{64}:(.+)$/s;
const MAX_D_BYTES = 255;

const TYPE = Object.freeze({
  STRING: 'STRING NOT NULL',
  INTEGER: 'INTEGER NOT NULL',
  BOOLEAN: 'BOOLEAN NOT NULL',
});
/** The Cypher value type each of the nine properties is stored as. */
const EXPECTED_TYPE = Object.freeze({
  address: TYPE.STRING,
  eventId: TYPE.STRING,
  createdAt: TYPE.INTEGER,
  polarity: TYPE.STRING,
  tagAddress: TYPE.STRING,
  tagEventId: TYPE.STRING,
  tagSlug: TYPE.STRING,
  zCanonical: TYPE.BOOLEAN,
  zLocal: TYPE.BOOLEAN,
});
const REQUIRED_KEYS = Object.freeze(['address', 'eventId', 'createdAt', 'zCanonical', 'zLocal']);

function isObject(x) { return !!x && typeof x === 'object'; }

/**
 * Is this a usable stamp identity? → null when it is, else the problem:
 * 'missing' (undefined, null, not a string) | 'empty' | 'upper-case' (64 hex with any A-F) | 'not-64-hex'.
 */
function checkIdentity(value) {
  if (typeof value !== 'string') return 'missing';
  if (value === '') return 'empty';
  if (HEX64_ANY_CASE.test(value) && /[A-F]/.test(value)) return 'upper-case';
  if (!HEX64.test(value)) return 'not-64-hex';
  return null;
}

/** Exactly the addresses the contract can produce: `39999:<64 lower-case hex>:<d>`, d of 1–255 UTF-8 bytes. */
function isTaggingAddress(a) {
  if (typeof a !== 'string') return false;
  const m = TAGGING_ADDRESS_RE.exec(a);
  if (!m) return false;
  const bytes = Buffer.byteLength(m[1], 'utf8');
  return bytes >= 1 && bytes <= MAX_D_BYTES;
}

/** Throw unless both stamp identities are usable: a missing one would read its taggings as non-taggings. */
function requireIdentities(where, identities) {
  for (const k of ['canonicalPubkey', 'localPubkey']) {
    const problem = checkIdentity(identities && identities[k]);
    if (problem) throw new TypeError(`${where}: identities.${k} is ${problem}`);
  }
}

/** The one relay read: kind 39999 carrying any of the four stamps, built only from the two identities. */
function sweepFilter({ canonicalPubkey, localPubkey } = {}) {
  requireIdentities('sweepFilter', { canonicalPubkey, localPubkey });
  const z = [
    stamp(canonicalPubkey, 'nostr-user-tag'),
    stamp(localPubkey, 'nostr-user-tag'),
    stamp(canonicalPubkey, 'tag'),
    stamp(localPubkey, 'tag'),
  ].filter(Boolean);
  return { kinds: [39999], '#z': [...new Set(z)] };
}

/** Does a scanned event match the filter it was asked for (kind and at least one requested `z`)? */
function isExpectedScanEvent(ev, filter) {
  if (!isObject(ev) || !isObject(filter)) return false;
  const kinds = Array.isArray(filter.kinds) ? filter.kinds : [];
  const zs = Array.isArray(filter['#z']) ? filter['#z'] : [];
  if (!kinds.includes(ev.kind)) return false;
  if (!Array.isArray(ev.tags)) return false;
  return ev.tags.some((t) => Array.isArray(t) && t[0] === 'z' && typeof t[1] === 'string' && zs.includes(t[1]));
}

function zValues(ev) {
  return isObject(ev) && Array.isArray(ev.tags)
    ? ev.tags.filter((t) => Array.isArray(t) && t[0] === 'z' && typeof t[1] === 'string').map((t) => t[1])
    : [];
}

/**
 * What the relay holds at each tagging address.
 * → { byAddress: Map<address, edge | refusal | { conflict: true, count }>, taggingsRead, tagElementsRead,
 *     refused: { total, byReason }, anomalies: { sameAddressConflicts } }
 * An address with more than one result is a conflict — never absent, which would read as "nothing on the relay".
 */
function readRelay(events, identities = {}) {
  const canonicalPubkey = identities.canonicalPubkey;
  const localPubkey = identities.localPubkey;
  const list = Array.isArray(events) ? events : [];
  const taggingStamps = [stamp(canonicalPubkey, 'nostr-user-tag'), stamp(localPubkey, 'nostr-user-tag')].filter(Boolean);
  const tagStamps = [stamp(canonicalPubkey, 'tag'), stamp(localPubkey, 'tag')].filter(Boolean);

  const tagElementsById = new Map();
  for (const ev of list) {
    if (isObject(ev) && typeof ev.id === 'string') tagElementsById.set(ev.id, ev);
  }
  const options = { canonicalPubkey, localPubkey, tagElementsById };

  const results = new Map();
  const refused = { total: 0, byReason: {} };
  let taggingsRead = 0;
  let tagElementsRead = 0;
  for (const ev of list) {
    const zs = zValues(ev);
    if (zs.some((z) => tagStamps.includes(z))) tagElementsRead += 1;
    if (!zs.some((z) => taggingStamps.includes(z))) continue;
    taggingsRead += 1;
    const r = taggingToEdge(ev, options);
    if (r && r.ok === true) {
      const found = results.get(r.edge.address) || [];
      found.push(r.edge);
      results.set(r.edge.address, found);
      continue;
    }
    const reason = (r && r.reason) || 'not-an-event';
    refused.total += 1;
    refused.byReason[reason] = (refused.byReason[reason] || 0) + 1;
    if (r && typeof r.address === 'string') {
      const found = results.get(r.address) || [];
      found.push(r);
      results.set(r.address, found);
    }
  }

  const byAddress = new Map();
  let sameAddressConflicts = 0;
  for (const [address, found] of results) {
    if (found.length === 1) {
      byAddress.set(address, found[0]);
    } else {
      byAddress.set(address, { conflict: true, count: found.length });
      sameAddressConflicts += 1;
    }
  }
  return { byAddress, taggingsRead, tagElementsRead, refused, anomalies: { sameAddressConflicts } };
}

/** A snapshot row's properties as a Map key → { type, text, raw }. */
function propMap(row) {
  const map = new Map();
  const props = isObject(row) && Array.isArray(row.props) ? row.props : [];
  for (const p of props) {
    if (!Array.isArray(p)) continue;
    map.set(String(p[0]), { type: p[1] == null ? null : String(p[1]), text: p[2] == null ? null : String(p[2]), raw: p[3] });
  }
  return map;
}

/** A stored string property, or null when it is missing or not a string. */
function storedString(props, key) {
  const p = props.get(key);
  return p && p.type === TYPE.STRING && typeof p.text === 'string' ? p.text : null;
}

/**
 * Read a snapshot row as an edge. → { wellFormed, edge, problems, strippedKeys }
 * `wellFormed`: every one of the nine that is present has its type (createdAt an INTEGER ≥ 0), and
 * address, eventId, createdAt, zCanonical and zLocal are present. Keys outside the nine are listed in
 * `strippedKeys` (an update or move drops them; their values go to the pre-image first).
 */
function storedFromRow(row) {
  const props = propMap(row);
  const problems = [];
  const strippedKeys = [];
  const edge = {
    type: TAGS_RELATIONSHIP,
    from: isObject(row) && typeof row.fromPubkey === 'string' ? row.fromPubkey : null,
    to: isObject(row) && typeof row.toPubkey === 'string' ? row.toPubkey : null,
  };
  for (const k of TAGS_PROPERTY_KEYS) edge[k] = null;

  for (const [k, p] of props) {
    if (!TAGS_PROPERTY_KEYS.includes(k)) { strippedKeys.push(k); continue; }
    const want = EXPECTED_TYPE[k];
    if (p.type !== want || typeof p.text !== 'string') { problems.push(`${k}:type`); continue; }
    if (want === TYPE.STRING) edge[k] = p.text;
    else if (want === TYPE.BOOLEAN) edge[k] = p.text === 'true';
    else if (want === TYPE.INTEGER) {
      if (!/^\d+$/.test(p.text)) { problems.push(`${k}:not-a-non-negative-integer`); continue; }
      const n = Number(p.text);
      if (!Number.isSafeInteger(n)) { problems.push(`${k}:out-of-range`); continue; }
      edge[k] = n;
    }
  }
  for (const k of REQUIRED_KEYS) {
    if (!props.has(k)) problems.push(`${k}:missing`);
  }
  strippedKeys.sort();
  return { wellFormed: problems.length === 0, edge, problems, strippedKeys };
}

/** Canonical text of a raw value: strings JSON-quoted, arrays element by element, anything else String(v). */
function canonicalValue(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalValue).join(',')}]`;
  return String(v);
}

/**
 * The guard's fingerprint of one projected row (ADR 0002, the guard, step 4): the element id, both
 * ends (pubkey, its type, NostrUser or not) and every property as [key, type, text, raw], sorted.
 * Two reads of an unchanged relationship give the same string; any change gives a different one.
 */
function fingerprint(row) {
  const r = isObject(row) ? row : {};
  const props = (Array.isArray(r.props) ? r.props : [])
    .map((p) => (Array.isArray(p)
      ? [String(p[0]), p[1] == null ? null : String(p[1]), p[2] == null ? null : String(p[2]), canonicalValue(p[3])]
      : ['', null, null, canonicalValue(p)]))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return JSON.stringify([
    r.rid == null ? null : String(r.rid),
    canonicalValue(r.fromPubkey), r.fromPubkeyType == null ? null : String(r.fromPubkeyType), r.fromIsUser === true,
    canonicalValue(r.toPubkey), r.toPubkeyType == null ? null : String(r.toPubkeyType), r.toIsUser === true,
    props,
  ]);
}

/** `39999:<64 lower-case hex>:<slug>` with its slug as `tagSlug` — a resolution the contract could have made. */
function isWellFormedResolution(tagAddress, tagSlug) {
  if (typeof tagAddress !== 'string' || typeof tagSlug !== 'string') return false;
  const m = TAGGING_ADDRESS_RE.exec(tagAddress);
  return !!m && m[1] === tagSlug;
}

/**
 * What the graph should hold at an address, given the relay's accepted edge `E` there: E's properties
 * and ends, except that for the same version (same eventId and tagEventId) an id-only tagging the relay
 * can no longer resolve keeps a well-formed stored resolution (resolution only moves from null to a value).
 */
function desiredFor(stored, relayEdge) {
  const { type, from, to, ...props } = relayEdge;
  const desired = { type: TAGS_RELATIONSHIP, from, to, ...props };
  if (stored) {
    const sp = propMap(stored);
    const storedTagAddress = storedString(sp, 'tagAddress');
    const storedTagSlug = storedString(sp, 'tagSlug');
    if (storedString(sp, 'eventId') === relayEdge.eventId
      && relayEdge.tagEventId != null
      && storedString(sp, 'tagEventId') === relayEdge.tagEventId
      && relayEdge.tagAddress == null
      && isWellFormedResolution(storedTagAddress, storedTagSlug)) {
      desired.tagAddress = storedTagAddress;
      desired.tagSlug = storedTagSlug;
    }
  }
  return desired;
}

/** The stored props a relationship must have to equal `desired`: [key, type, text] for every non-null value. */
function expectedProps(desired) {
  const out = [];
  for (const k of TAGS_PROPERTY_KEYS) {
    const v = desired[k];
    if (v === null || v === undefined) continue;
    if (typeof v === 'string') out.push([k, TYPE.STRING, v]);
    else if (typeof v === 'boolean') out.push([k, TYPE.BOOLEAN, v ? 'true' : 'false']);
    else if (typeof v === 'bigint' || (typeof v === 'number' && Number.isInteger(v))) out.push([k, TYPE.INTEGER, String(v)]);
    else out.push([k, null, String(v)]); // never matches a stored value: forces a rewrite
  }
  return out;
}

function endsRight(row, desired) {
  return typeof row.fromPubkey === 'string' && row.fromPubkey === desired.from && row.fromIsUser === true
    && typeof row.toPubkey === 'string' && row.toPubkey === desired.to && row.toIsUser === true;
}

function propsEqual(row, desired) {
  const have = propMap(row);
  const want = expectedProps(desired);
  if (have.size !== want.length) return false;
  for (const [k, type, text] of want) {
    const p = have.get(k);
    if (!p || p.type !== type || p.text !== text || (p.raw !== null && p.raw !== undefined)) return false;
  }
  return true;
}

/** Why a relationship is left in place (AC-3), or null when its address is a tagging address. */
function leftReason(row) {
  const p = propMap(row).get('address');
  if (!p) return LEFT_REASON.MISSING_ADDRESS;
  if (p.type !== TYPE.STRING || !isTaggingAddress(p.text)) return LEFT_REASON.NOT_A_TAGGING_ADDRESS;
  return null;
}

/** The relay's state at one address, whatever shape it was handed in. */
function relayKind(relayAt) {
  if (!isObject(relayAt)) return { kind: 'nothing' };
  if (relayAt.conflict === true) return { kind: 'conflict' };
  if (relayAt.ok === false) return { kind: 'refusal', refusal: relayAt };
  if (relayAt.ok === true && isObject(relayAt.edge)) return { kind: 'edge', edge: relayAt.edge };
  if (relayAt.type === TAGS_RELATIONSHIP) return { kind: 'edge', edge: relayAt };
  throw new TypeError('decideAddress: relayAt must be a contract edge, a refusal, a conflict marker or nothing');
}

function outcome(action, desired, reason, label) {
  return { action, desired, reason, label };
}

/**
 * The rule for one address (ADR 0002, "The rule for one address"). Pure.
 * `stored`: the snapshot row there, or null. `relayAt`: the relay's accepted edge E, a refusal carrying
 * this address, or nothing. → { action, desired, reason, label }
 *   leave   — a relationship whose address is missing or not a tagging address (reason: LEFT_REASON)
 *   create  — nothing stored, E on the relay (reason 'added')
 *   none    — nothing stored and nothing to add (reason 'refused' | 'absent'), already equal (reason 'unchanged'),
 *             or more than one scanned version at the address (reason 'conflict')
 *   remove  — stored, and the relay holds nothing ('not-on-relay') or a non-tagging ('non-tagging')
 *   update  — ends right, anything else differs (reason 'changed', label newer | older | refreshed | repaired)
 *   move    — ends not NostrUser from → NostrUser to (reason 'changed', label 'moved')
 */
function decideAddress(stored, relayAt) {
  const row = isObject(stored) ? stored : null;
  const relay = relayKind(relayAt);
  if (row) {
    const left = leftReason(row);
    if (left) return outcome('leave', null, left, null);
  }
  if (relay.kind === 'conflict') return outcome('none', null, 'conflict', null);

  if (!row) {
    if (relay.kind === 'edge') return outcome('create', desiredFor(null, relay.edge), 'added', null);
    if (relay.kind === 'refusal') return outcome('none', null, 'refused', relay.refusal.reason || null);
    return outcome('none', null, 'absent', null);
  }

  if (relay.kind === 'nothing') return outcome('remove', null, REMOVAL_REASON.NOT_ON_RELAY, null);
  if (relay.kind === 'refusal') return outcome('remove', null, REMOVAL_REASON.NON_TAGGING, null);

  const desired = desiredFor(row, relay.edge);
  if (!endsRight(row, desired)) return outcome('move', desired, 'changed', CHANGE_KIND.MOVED);
  if (propsEqual(row, desired)) return outcome('none', desired, 'unchanged', null);

  // The label is for the report only; it never drives a write.
  const s = storedFromRow(row);
  let label = CHANGE_KIND.REPAIRED;
  if (s.wellFormed) {
    const reason = standingEdge(s.edge, relay.edge).reason;
    label = reason === 'newer' ? CHANGE_KIND.NEWER : reason === 'older-ignored' ? CHANGE_KIND.OLDER : CHANGE_KIND.REFRESHED;
  }
  return outcome('update', desired, 'changed', label);
}

/**
 * Group a graph snapshot by address. → { byAddress: Map<tagging address, row>, leftInPlace: [{ row, reason }],
 * conflicts: [address], base, atStart }. Two rows at one address, or a repeated element id, is a concurrent
 * write: that address is a conflict and the pass leaves it alone. `base` counts the relationships at tagging
 * addresses (the ones a pass may remove); `atStart` counts every relationship.
 */
function groupSnapshot(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const seenRid = new Map();
  const atAddress = new Map();
  const leftInPlace = [];
  const leftRids = new Set();
  const conflicts = new Set();
  const taggingRids = new Set();
  const allRids = new Set();

  for (const row of list) {
    if (!isObject(row)) continue;
    const rid = row.rid == null ? null : String(row.rid);
    const left = leftReason(row);
    const address = left ? null : propMap(row).get('address').text;
    if (rid !== null) {
      allRids.add(rid);
      if (seenRid.has(rid)) {
        const earlier = seenRid.get(rid);
        if (earlier) conflicts.add(earlier);
        if (address) conflicts.add(address);
      } else {
        seenRid.set(rid, address);
      }
    }
    if (left) {
      if (rid === null || !leftRids.has(rid)) {
        if (rid !== null) leftRids.add(rid);
        leftInPlace.push({ row, reason: left });
      }
      continue;
    }
    if (rid !== null) taggingRids.add(rid);
    const found = atAddress.get(address) || [];
    found.push(row);
    atAddress.set(address, found);
  }

  const byAddress = new Map();
  for (const [address, found] of atAddress) {
    if (found.length > 1) conflicts.add(address);
    if (!conflicts.has(address)) byAddress.set(address, found[0]);
  }
  for (const address of conflicts) byAddress.delete(address);
  return {
    byAddress,
    leftInPlace,
    conflicts: [...conflicts].sort(),
    base: taggingRids.size,
    atStart: allRids.size,
  };
}

function heldEntry(r) {
  return { address: r.address, seenEventId: r.seenEventId == null ? null : r.seenEventId, reason: r.reason };
}

/** The one key for a removal at the version seen: (address, seenEventId), `null` equal to `null`. */
function removalKey(address, seenEventId) {
  return JSON.stringify([address, seenEventId == null ? null : seenEventId]);
}

function exceeds(count, base) {
  return count > LIMIT.floor && LIMIT.fraction * count > base;
}

/**
 * AC-5. `removals`: every removal the plan makes ({ address, seenEventId, reason, … }). `base`: the
 * relationships at tagging addresses at the start. `confirmedHeld`: the held list the owner confirmed,
 * or null for an unconfirmed run.
 * → { apply: [removal], held: [{ address, seenEventId, reason }], limit }
 * A confirmed run applies C (its removals the owner saw held, at the version seen; null equals null)
 * and judges the rest, O, against base − |C|.
 */
function judgeRemovals({ removals, base, confirmedHeld } = {}) {
  const list = Array.isArray(removals) ? removals : [];
  const b = Number.isInteger(base) ? base : 0;
  const limit = {
    base: b,
    baseAfterConfirmed: null,
    removalsPlanned: list.length,
    floor: LIMIT.floor,
    fraction: `1/${LIMIT.fraction}`,
    exceeded: false,
  };
  if (!Array.isArray(confirmedHeld)) {
    const exceeded = exceeds(list.length, b);
    limit.exceeded = exceeded;
    return { apply: exceeded ? [] : list.slice(), held: exceeded ? list.map(heldEntry) : [], limit };
  }
  const confirmed = new Set(confirmedHeld.filter(isObject).map((h) => removalKey(h.address, h.seenEventId)));
  const c = [];
  const o = [];
  for (const r of list) (confirmed.has(removalKey(r.address, r.seenEventId)) ? c : o).push(r);
  const baseAfter = b - c.length;
  const exceeded = exceeds(o.length, baseAfter);
  limit.baseAfterConfirmed = baseAfter;
  limit.exceeded = exceeded;
  return {
    apply: exceeded ? c : c.concat(o),
    held: exceeded ? o.map(heldEntry) : [],
    limit,
  };
}

/** The canonical text a held list's digest is taken over: `address\tseenEventId\treason\n` per entry, sorted. */
function heldLines(held) {
  const list = Array.isArray(held) ? held : [];
  return list
    .map((h) => `${isObject(h) ? h.address : ''}\t${isObject(h) && h.seenEventId != null ? h.seenEventId : ''}\t${isObject(h) ? h.reason : ''}\n`)
    .sort()
    .join('');
}

function countBy(items, keyOf) {
  const out = {};
  for (const it of items) {
    const k = keyOf(it);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function byEnds(a, b) {
  const ka = [a.from || '', a.to || '', a.address || ''];
  const kb = [b.from || '', b.to || '', b.address || ''];
  for (let i = 0; i < 3; i += 1) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

/**
 * Plan one pass. → { creates, updates, moves, removals (the ones to apply), held, removalsPlanned, limit,
 * counts, refused, anomalies, taggingsRead, tagElementsRead }. Every write item is sorted by (from, to).
 * Items are the graph port's rows (clarification C6): { address, desired } for a create, { address, snapshot,
 * desired } for an update or move, { address, snapshot } for a removal, plus the report's own keys.
 */
function planPass({ snapshotRows, relayEvents, identities, confirmedHeld } = {}) {
  // A failed read is never an empty relay (principle 4): refuse to plan rather than plan removals.
  if (!Array.isArray(snapshotRows)) throw new TypeError('planPass: snapshotRows must be an array');
  if (!Array.isArray(relayEvents)) throw new TypeError('planPass: relayEvents must be an array');
  requireIdentities('planPass', identities);
  const snap = groupSnapshot(snapshotRows);
  const relay = readRelay(relayEvents, identities);
  const snapshotConflicts = new Set(snap.conflicts);

  const creates = [];
  const updates = [];
  const moves = [];
  const removals = [];
  let unchanged = 0;
  let unresolvedUntouched = 0;

  const addresses = new Set([...snap.byAddress.keys(), ...relay.byAddress.keys()]);
  for (const address of [...addresses].sort()) {
    if (snapshotConflicts.has(address)) continue;
    const row = snap.byAddress.get(address) || null;
    const relayAt = relay.byAddress.has(address) ? relay.byAddress.get(address) : null;
    const d = decideAddress(row, relayAt);
    const stored = row ? storedFromRow(row) : null;
    const fromRow = row ? { address, snapshot: row, strippedKeys: stored.strippedKeys } : null;
    switch (d.action) {
      case 'create':
        creates.push({ address, from: d.desired.from, to: d.desired.to, desired: d.desired, unresolved: d.desired.tagAddress == null });
        break;
      case 'update':
        updates.push({ ...fromRow, from: d.desired.from, to: d.desired.to, desired: d.desired, label: d.label, unresolved: d.desired.tagAddress == null });
        break;
      case 'move':
        moves.push({ ...fromRow, from: d.desired.from, to: d.desired.to, desired: d.desired, label: d.label, unresolved: d.desired.tagAddress == null });
        break;
      case 'remove':
        removals.push({
          ...fromRow,
          from: stored.edge.from,
          to: stored.edge.to,
          seenEventId: stored.edge.eventId,
          reason: d.reason,
          storedUnresolved: stored.edge.tagAddress == null,
        });
        break;
      case 'none':
        // A relationship this pass leaves as it is — equal to desired, or at a relay conflict — is counted
        // under `unresolved` when it has no tagAddress.
        if (d.reason === 'unchanged') {
          unchanged += 1;
          if (d.desired.tagAddress == null) unresolvedUntouched += 1;
        } else if (d.reason === 'conflict' && stored && stored.edge.tagAddress == null) {
          unresolvedUntouched += 1;
        }
        break;
      default:
        break;
    }
  }

  const judged = judgeRemovals({ removals, base: snap.base, confirmedHeld });
  const heldKeys = new Set(judged.held.map((h) => removalKey(h.address, h.seenEventId)));
  const unresolvedHeld = removals.filter((r) => r.storedUnresolved && heldKeys.has(removalKey(r.address, r.seenEventId))).length;

  creates.sort(byEnds);
  updates.sort(byEnds);
  moves.sort(byEnds);
  const apply = judged.apply.slice().sort(byEnds);

  const leftInPlaceBy = { [LEFT_REASON.MISSING_ADDRESS]: 0, [LEFT_REASON.NOT_A_TAGGING_ADDRESS]: 0 };
  for (const l of snap.leftInPlace) leftInPlaceBy[l.reason] += 1;

  return {
    creates,
    updates,
    moves,
    removals: apply,
    held: judged.held,
    removalsPlanned: removals,
    limit: { ...judged.limit, leftInPlaceExcluded: snap.leftInPlace.length },
    counts: {
      atStart: snap.atStart,
      base: snap.base,
      unchanged,
      unresolvedUntouched,
      unresolvedHeld,
      leftInPlace: snap.leftInPlace.length,
      leftInPlaceBy,
      heldByReason: countBy(judged.held, (h) => h.reason),
    },
    leftInPlace: snap.leftInPlace,
    refused: relay.refused,
    anomalies: { sameAddressConflicts: relay.anomalies.sameAddressConflicts, snapshotConflicts: snap.conflicts.length },
    snapshotConflicts: snap.conflicts,
    taggingsRead: relay.taggingsRead,
    tagElementsRead: relay.tagElementsRead,
  };
}

module.exports = {
  TAGS_PROPERTY_KEYS,
  LIMIT,
  REMOVAL_REASON,
  LEFT_REASON,
  CHANGE_KIND,
  RUN_ID_RE,
  checkIdentity,
  isTaggingAddress,
  sweepFilter,
  isExpectedScanEvent,
  readRelay,
  storedFromRow,
  fingerprint,
  canonicalValue,
  desiredFor,
  decideAddress,
  judgeRemovals,
  removalKey,
  planPass,
  groupSnapshot,
  heldLines,
};
