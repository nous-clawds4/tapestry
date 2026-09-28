'use strict';
/**
 * Shared fixtures for the tagging-edges story-2 suites (the gap-filling pass).
 *
 * Story: engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.md
 * ADR:   engineering-team/decisions/tagging-edges/0002-gap-filling-pass.md (binding context: ADR 0001, amended,
 *        and src/lib/tagging-edges/contract.js)
 * Plan:  engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.test-plan.md
 *
 * One copy of the events, identities and graph-snapshot rows the story-2 suites build from, so the planner, runner,
 * graph-port and route suites cannot disagree about what a tagging or a stored relationship looks like.
 *
 * Mirrors story 1's fixtures (test/tagging-edge-contract.test.js:45-95): the same fake identities, the same default
 * tagging (Alice tags Bob as Jack's "podcaster"), the same tag order in each event. Story 1's standing-rule truth
 * table is built from those fixtures, so the parity test against `standingEdge` reads the same events here.
 *
 * Pure: plain objects in and out; no I/O, no clock, no randomness, no environment. Nothing under src/ is required at
 * load time — `contractEdge` requires the contract lazily, so a suite that loads this file always loads, red phase
 * included. Every pubkey is a fake 64-hex value: never a deployment's TA and never the ADR 0015 literal. The canonical
 * identity is a PARAMETER of the contract (ADR 0001), so a fake stands in for it; the canonical and local identities
 * are kept different (story 2, "For Test Design").
 */

const crypto = require('crypto');

// ─── Identities and people (story 1's values) ──────────────────────────────────────────────────────────────────
const hex = (c) => c.repeat(64);

/** Stands in for the canonical `nostr-user-tag` stamp's pubkey (the ADR 0015 site passes the real one). */
const CANONICAL = hex('a');
/** Stands in for this deployment's own TA (resolved at runtime on a real instance). Different from CANONICAL. */
const LOCAL = hex('5');
/** Some other deployment's TA: its stamps are honoured by neither identity. */
const OTHER_DEPLOY = hex('6');
/** The two identities in the options shape the contract takes (`{ canonicalPubkey, localPubkey }`). */
const IDENTITIES = Object.freeze({ canonicalPubkey: CANONICAL, localPubkey: LOCAL });

/** Tag-element author (the author of the "podcaster" tag). */
const JACK = hex('1');
/** The default tagger. */
const ALICE = hex('2');
/** The default tagged person. */
const BOB = hex('3');
/** Another tagged person (a move target) or another author. */
const CAROL = hex('4');

/**
 * A deterministic lower-case 64-hex value from a seed. A number seed gives story 1's `id(n)` form (zero-padded hex,
 * so `idOf(0x100)` is story 1's default tagging id); a string seed gives the sha256 of that string.
 */
function idOf(seed) {
  if (typeof seed === 'number') {
    if (!Number.isSafeInteger(seed) || seed < 0) throw new Error(`idOf: a number seed must be a non-negative safe integer, got ${seed}`);
    return seed.toString(16).padStart(64, '0');
  }
  if (typeof seed === 'bigint') return seed.toString(16).padStart(64, '0');
  if (typeof seed === 'string') return crypto.createHash('sha256').update(seed, 'utf8').digest('hex');
  throw new Error(`idOf: seed must be a number, bigint or string, got ${typeof seed}`);
}

/** A deterministic fake pubkey for bulk fixtures (distinct taggers or targets); never equal to the named ones. */
const pubkeyOf = (seed) => idOf(`pubkey:${seed}`);

// ─── Stamps ────────────────────────────────────────────────────────────────────────────────────────────────────
/** `39998:<pk>:nostr-user-tag` — the stamp that makes a kind-39999 a tagging. */
const STAMP = (pk) => `39998:${pk}:nostr-user-tag`;
/** `39998:<pk>:tag` — the stamp that makes a kind-39999 a tag element. */
const TAG_STAMP = (pk) => `39998:${pk}:tag`;

/**
 * The four `#z` stamps of the pass's one relay scan, in ADR 0002 D2 (i)'s order: canonical and local
 * `nostr-user-tag`, then canonical and local `tag`. Not de-duplicated: when the two identities are equal the list
 * repeats, and removing the repeats is `sweepFilter`'s job, not the fixture's.
 */
function fourStamps({ canonicalPubkey = CANONICAL, localPubkey = LOCAL } = {}) {
  return [STAMP(canonicalPubkey), STAMP(localPubkey), TAG_STAMP(canonicalPubkey), TAG_STAMP(localPubkey)];
}

/** The four stamps for the fixture identities, by name. */
const Z = Object.freeze({
  canonicalTagging: STAMP(CANONICAL),
  localTagging: STAMP(LOCAL),
  canonicalTag: TAG_STAMP(CANONICAL),
  localTag: TAG_STAMP(LOCAL),
});

// ─── The default tagging (story 1's) ───────────────────────────────────────────────────────────────────────────
/** The default tag element's event id (story 1's TAG_V1). */
const TAG_V1 = idOf(0x7001);
/** The default tagging's `d`, in the publisher's form. It does not follow `target`, so a new target is a move. */
const D = `profile-tag-podcaster-${BOB.slice(0, 8)}-${ALICE.slice(0, 8)}`;
/** The default tagging's address. */
const ADDRESS = `39999:${ALICE}:${D}`;
/** The default tag's address. */
const TAG_ADDR = `39999:${JACK}:podcaster`;

const dTag = (x) => (Array.isArray(x) ? x : ['d', x]);

/**
 * A kind-39999 tagging, shaped exactly as story 1's `tagging()` (tags in the order d, p, a, e, z…, polarity, extra;
 * content '{}', a fake sig). Pass `null` for d / target / a / e / polarity to omit that tag.
 *
 *   author      the tagger (default ALICE)            d          the first d value (default D)
 *   target      the p value (default BOB)             a          the tag's address (default TAG_ADDR)
 *   e           the tag element's id (default TAG_V1) polarity   the stance (default '1')
 *   createdAt   created_at (default 1000)             id         the event id (default idOf(0x100))
 *   stamps      the z values (default [STAMP(CANONICAL)])
 *   kind        (default 39999)                       extraTags  raw tags appended at the end
 *   extraDTags  more d tags straight after the first: a string is ['d', s], an array is used as the raw tag
 *               (so `{ d: 'L'.repeat(300), extraDTags: ['x'] }` is a version strfry files under d = 'x')
 */
function makeTagging(o = {}) {
  const f = {
    author: ALICE, d: D, target: BOB, a: TAG_ADDR, e: TAG_V1, polarity: '1',
    stamps: [STAMP(CANONICAL)], createdAt: 1000, id: idOf(0x100), kind: 39999, extraTags: [], extraDTags: [], ...o,
  };
  const tags = [];
  if (f.d !== null) tags.push(['d', f.d]);
  for (const x of f.extraDTags) tags.push(dTag(x));
  if (f.target !== null) tags.push(['p', f.target]);
  if (f.a !== null) tags.push(['a', f.a]);
  if (f.e !== null) tags.push(['e', f.e]);
  for (const z of f.stamps) tags.push(['z', z]);
  if (f.polarity !== null) tags.push(['polarity', f.polarity]);
  tags.push(...f.extraTags);
  return { id: f.id, pubkey: f.author, created_at: f.createdAt, kind: f.kind, tags, content: '{}', sig: 'f'.repeat(128) };
}

/**
 * A tag element (a kind-39999 joined to the tag concept), shaped as story 1's `tagElement()`: tags d, then any
 * extra d tags, then the z stamps. Pass `d: null` to give it no first d.
 *
 *   author (default JACK), d (default 'podcaster'), id (default TAG_V1), stamps (default [TAG_STAMP(CANONICAL)]),
 *   kind (default 39999), createdAt (default 500),
 *   extraDTags  more d tags straight after the first (a string is ['d', s]; an array is the raw tag), so
 *               `{ d: 'L'.repeat(256), extraDTags: ['podcaster'] }` is R2-NB2's element.
 */
function makeElement(o = {}) {
  const f = { author: JACK, d: 'podcaster', id: TAG_V1, stamps: [TAG_STAMP(CANONICAL)], kind: 39999, createdAt: 500, extraDTags: [], ...o };
  const tags = [];
  if (f.d !== null) tags.push(['d', f.d]);
  for (const x of f.extraDTags) tags.push(dTag(x));
  for (const z of f.stamps) tags.push(['z', z]);
  return { id: f.id, pubkey: f.author, created_at: f.createdAt, kind: f.kind, tags, content: '{}', sig: 'f'.repeat(128) };
}

const TAGGING_ADDRESS_PARTS = /^39999:([0-9a-f]{64}):(.+)$/s;

/**
 * How `makeNonTagging` spoils a tagging so the contract refuses it after step 1 — so the refusal carries the address
 * and, in the relay's current state, stands there as "a version the definition refuses". All but the last keep a
 * `nostr-user-tag` stamp, so the pass's `#z` scan reads them.
 */
const NON_TAGGING = Object.freeze({
  'no-target': { target: null },
  'several-targets': { extraTags: [['p', CAROL]] },
  'bad-target': { target: 'xyz' },
  'no-tag-reference': { a: null, e: null },
  'several-tag-references': { extraTags: [['a', `39999:${JACK}:musician`]] },
  'bad-tag-address': { a: `39998:${JACK}:podcaster` },
  // No nostr-user-tag stamp: refused, but the scan sees it only if it carries a :tag stamp as well.
  'no-nostr-user-tag-stamp': { stamps: [] },
});

/**
 * A kind-39999 version at a tagging address that the contract refuses (a non-tagging). The address fixes the author
 * and the identity d. Options: `refusal` (a NON_TAGGING key, default 'no-target'), `id`, `createdAt`,
 * `overLongFirstD` (true: a 300-byte first d before the address's d, which strfry skips — R2-10), and any
 * makeTagging option (applied last).
 */
function makeNonTagging({ address = ADDRESS, refusal = 'no-target', overLongFirstD = false, ...rest } = {}) {
  const m = TAGGING_ADDRESS_PARTS.exec(address);
  if (!m) throw new Error(`makeNonTagging: ${JSON.stringify(address)} is not a tagging address`);
  const spoil = NON_TAGGING[refusal];
  if (!spoil) throw new Error(`makeNonTagging: unknown refusal ${JSON.stringify(refusal)} (one of ${Object.keys(NON_TAGGING).join(', ')})`);
  const ds = overLongFirstD ? { d: 'L'.repeat(300), extraDTags: [m[2]] } : { d: m[2] };
  return makeTagging({ author: m[1], ...ds, ...spoil, ...rest });
}

/** A kind-5 deletion shaped as story 1's `deletion()`. The pass reads none (ADR 0002 D2); this is for "ignored" cases. */
function makeDeletion(o = {}) {
  const f = { author: ALICE, e: [], a: [], createdAt: 2000, id: idOf(0x5000), kind: 5, ...o };
  const tags = [...f.e.map((x) => ['e', x]), ...f.a.map((x) => ['a', x])];
  return { id: f.id, pubkey: f.author, created_at: f.createdAt, kind: f.kind, tags, content: 'revoked', sig: 'f'.repeat(128) };
}

/**
 * `n` distinct taggings for bulk and limit fixtures: tagging i has d `${prefix}-${i}` (so its own address) and id
 * idOf(`${prefix}:${i}`); `over(i)` may return more makeTagging options for tagging i.
 */
function manyTaggings(n, { prefix = 'bulk', over = () => ({}), ...base } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(makeTagging({ d: `${prefix}-${i}`, id: idOf(`${prefix}:${i}`), ...base, ...over(i) }));
  return out;
}

// ─── The contract, lazily ──────────────────────────────────────────────────────────────────────────────────────
const CONTRACT_REQUIRE = '../../src/lib/tagging-edges';

/**
 * The contract edge for an event (`taggingToEdge(event, options).edge`), requiring the contract only when called.
 * Throws a descriptive error when the contract cannot load or the event is refused.
 */
function contractEdge(event, options = IDENTITIES) {
  let m;
  try { m = require(CONTRACT_REQUIRE); }
  catch (e) { throw new Error(`tagging-edges contract not loadable (require('${CONTRACT_REQUIRE}') failed: ${e.message})`); }
  const r = m.taggingToEdge(event, options);
  if (!r || r.ok !== true) throw new Error(`contractEdge: expected the contract to accept the event, got ${JSON.stringify(r)}`);
  return r.edge;
}

// ─── Graph snapshot rows (ADR 0002, READ_ALL's projection) ─────────────────────────────────────────────────────
/** The nine TAGS properties (the contract edge's keys minus type / from / to), sorted. */
const PROPERTY_KEYS = Object.freeze(['address', 'createdAt', 'eventId', 'polarity', 'tagAddress', 'tagEventId', 'tagSlug', 'zCanonical', 'zLocal']);
/** Every key of a contract edge, sorted (story 1's EDGE_KEYS). */
const EDGE_KEYS = Object.freeze(['address', 'createdAt', 'eventId', 'from', 'polarity', 'tagAddress', 'tagEventId', 'tagSlug', 'to', 'type', 'zCanonical', 'zLocal']);
/** READ_ALL's `$scalarTypes` (ADR 0002): the types whose value travels as Cypher's toString text. */
const SCALAR_TYPES = Object.freeze(['INTEGER NOT NULL', 'FLOAT NOT NULL', 'STRING NOT NULL', 'BOOLEAN NOT NULL']);

/** Cypher's toString of a float: an integral value keeps a ".0" (toString(1000.0) = '1000.0'). */
function floatText(x) {
  if (Number.isNaN(x)) return 'NaN';
  if (x === Infinity) return 'Infinity';
  if (x === -Infinity) return '-Infinity';
  return Number.isInteger(x) ? `${x}.0` : String(x);
}

/** A Cypher list's valueType for a homogeneous JS array (Neo4j stores only homogeneous lists). */
function listType(xs) {
  if (xs.length && xs.every((x) => typeof x === 'string')) return 'LIST<STRING NOT NULL> NOT NULL';
  if (xs.length && xs.every((x) => typeof x === 'bigint' || Number.isInteger(x))) return 'LIST<INTEGER NOT NULL> NOT NULL';
  if (xs.length && xs.every((x) => typeof x === 'number')) return 'LIST<FLOAT NOT NULL> NOT NULL';
  if (xs.length && xs.every((x) => typeof x === 'boolean')) return 'LIST<BOOLEAN NOT NULL> NOT NULL';
  return 'LIST<NOTHING> NOT NULL';
}

/**
 * One `props` entry `[key, type, text, raw]` as READ_ALL returns it for a stored value: `text` is Cypher's toString
 * for the four scalar types (raw null); `raw` is the value itself for anything else (text null). A JS integer or
 * BigInt is an INTEGER, any other number a FLOAT, an array a LIST.
 */
function propEntry(key, value) {
  if (typeof value === 'string') return [key, 'STRING NOT NULL', value, null];
  if (typeof value === 'boolean') return [key, 'BOOLEAN NOT NULL', String(value), null];
  if (typeof value === 'bigint') return [key, 'INTEGER NOT NULL', value.toString(), null];
  if (typeof value === 'number') {
    return Number.isInteger(value) ? [key, 'INTEGER NOT NULL', String(value), null] : [key, 'FLOAT NOT NULL', floatText(value), null];
  }
  if (Array.isArray(value)) return [key, listType(value), null, value];
  throw new Error(`propEntry: no stored form for ${key} = ${JSON.stringify(value)} (Neo4j stores no null or map property)`);
}

/**
 * A graph snapshot row in READ_ALL's projection (ADR 0002 § Implementation notes, graph.js):
 *   { rid, fromPubkey, fromPubkeyType, fromIsUser, toPubkey, toPubkeyType, toIsUser, props: [[key, type, text, raw], …] }
 * built from a contract edge as a correct write would have stored it: the nine properties, a null one ABSENT (Neo4j
 * stores no null property; `toWriteProps` omits nulls), `createdAt` an INTEGER, both ends NostrUser nodes keyed by the
 * edge's `from` / `to`. `props` follows the edge's key order; READ_ALL gives no order, and the fingerprint sorts.
 *
 * Options — each spoils the row one way:
 *   rid              the relationship's element id (default: derived from the address, stable)
 *   missing          keys to drop, e.g. ['createdAt'] (a missing key)
 *   floatCreatedAt   true: createdAt stored as FLOAT ('1000.0')
 *   set              { key: value } — replace or add values (type inferred by propEntry), e.g. { createdAt: '1000' };
 *                    null / undefined removes the key, as Neo4j stores it (a "null" createdAt reads back missing)
 *   raw              { key: [type, text, raw] } — an exact entry, for values propEntry cannot infer
 *   extra            { key: value } — keys outside the nine (an extra key; same inference as `set`)
 *   address          the stored `address` value; null drops it (missing-address)
 *   nonTaggingAddress true: `address` becomes a kind-39998 address (not-a-tagging-address)
 *   wrongEndLabel    'from' | 'to' | 'both': that end is not a NostrUser node
 *   fromPubkey / toPubkey   the end node's pubkey (default the edge's from / to); null → type 'NULL'
 *   fromIsUser / toIsUser   explicit end labels (override wrongEndLabel)
 */
function storedRow(edge, o = {}) {
  if (!edge || typeof edge !== 'object' || typeof edge.address !== 'string') {
    throw new Error(`storedRow: expected a contract edge, got ${JSON.stringify(edge)}`);
  }
  const values = {};
  for (const k of Object.keys(edge)) {
    if (k === 'type' || k === 'from' || k === 'to') continue;
    if (edge[k] !== null && edge[k] !== undefined) values[k] = edge[k];
  }
  if (o.nonTaggingAddress) values.address = `39998:${edge.from}:${edge.address.split(':').slice(2).join(':')}`;
  if ('address' in o) {
    if (o.address === null) delete values.address; else values.address = o.address;
  }
  for (const [k, v] of Object.entries(o.set || {})) {
    if (v === null || v === undefined) delete values[k]; else values[k] = v; // SET r.k = null removes the key
  }
  for (const k of o.missing || []) delete values[k];

  const entries = Object.keys(values).map((k) => propEntry(k, values[k]));
  const at = (k) => entries.findIndex((e) => e[0] === k);
  if (o.floatCreatedAt && at('createdAt') >= 0) {
    const i = at('createdAt');
    entries[i] = ['createdAt', 'FLOAT NOT NULL', floatText(Number(values.createdAt)), null];
  }
  for (const [k, entry] of Object.entries(o.raw || {})) {
    const i = at(k);
    const full = [k, ...entry];
    if (i >= 0) entries[i] = full; else entries.push(full);
  }
  for (const [k, v] of Object.entries(o.extra || {})) entries.push(propEntry(k, v));

  const wrong = o.wrongEndLabel;
  const fromPubkey = 'fromPubkey' in o ? o.fromPubkey : edge.from;
  const toPubkey = 'toPubkey' in o ? o.toPubkey : edge.to;
  return {
    rid: o.rid || `5:fixture:${idOf(`rid:${edge.address}`).slice(0, 16)}`,
    fromPubkey,
    fromPubkeyType: fromPubkey === null || fromPubkey === undefined ? 'NULL' : 'STRING NOT NULL',
    fromIsUser: 'fromIsUser' in o ? o.fromIsUser : !(wrong === 'from' || wrong === 'both'),
    toPubkey,
    toPubkeyType: toPubkey === null || toPubkey === undefined ? 'NULL' : 'STRING NOT NULL',
    toIsUser: 'toIsUser' in o ? o.toIsUser : !(wrong === 'to' || wrong === 'both'),
    props: entries,
  };
}

/** storedRow(contractEdge(event, options), rowOptions): the row a correct write of this event would read back as. */
function storedRowFor(event, rowOptions = {}, options = IDENTITIES) {
  return storedRow(contractEdge(event, options), rowOptions);
}

module.exports = {
  // identities and people
  CANONICAL, LOCAL, OTHER_DEPLOY, IDENTITIES, JACK, ALICE, BOB, CAROL, idOf, pubkeyOf,
  // stamps
  STAMP, TAG_STAMP, fourStamps, Z,
  // events
  TAG_V1, D, ADDRESS, TAG_ADDR, NON_TAGGING,
  makeTagging, makeElement, makeNonTagging, makeDeletion, manyTaggings,
  // the contract, lazily
  contractEdge,
  // graph rows
  PROPERTY_KEYS, EDGE_KEYS, SCALAR_TYPES, propEntry, storedRow, storedRowFor,
};
