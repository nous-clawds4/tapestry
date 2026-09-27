/**
 * Tests for Story 1 (epic: tagging-edges) — the tagging edge contract.
 *
 * Story: engineering-team/stories/tagging-edges/1-tagging-edge-contract.md
 * ADR:   engineering-team/decisions/tagging-edges/0001-tagging-edge-contract.md
 * Plan:  engineering-team/stories/tagging-edges/1-tagging-edge-contract.test-plan.md
 *
 * Intentionally failing until src/lib/tagging-edges/ lands (red phase). The module is
 * require()d LAZILY inside each test, so loading this suite cannot crash the runner.
 *
 * Pure: no stack, no network, no signing. Fixture pubkeys are fake 64-hex; the two stamp
 * pubkeys are parameters of the contract, so no deployment's real key appears here.
 * Hand-rolled in the project's existing test style — no new framework.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const MODULE_REQUIRE = '../src/lib/tagging-edges';
const MODULE_DIR = path.join(REPO_ROOT, 'src/lib/tagging-edges');
const BIBLE = path.join(REPO_ROOT, 'BIBLE.md');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
function same(actual, expected, label) {
  const a = JSON.stringify(sortKeys(actual));
  const e = JSON.stringify(sortKeys(expected));
  if (a !== e) throw new Error(`${label}\n        expected: ${e}\n        actual:   ${a}`);
}
function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`);
}

/** Lazily load the module under test with a descriptive red-phase message. */
function load() {
  try { return require(MODULE_REQUIRE); }
  catch (e) { throw new Error(`tagging-edges contract not implemented yet (require('${MODULE_REQUIRE}') failed: ${e.message})`); }
}

// ─── fixtures (fixed, fake-but-valid 64-hex) ───
const hex = (c) => c.repeat(64);
const CANON = hex('a');        // stands in for the canonical nostr-user-tag stamp pubkey (a parameter)
const LOCAL = hex('5');        // this deployment's runtime TA (a parameter)
const OTHER_DEPLOY = hex('6'); // some other deployment's TA
const JACK = hex('1');         // tag-element author
const ALICE = hex('2');        // tagger
const BOB = hex('3');          // target
const CAROL = hex('4');        // another target / another author
const id = (n) => n.toString(16).padStart(64, '0');

const STAMP = (pk) => `39998:${pk}:nostr-user-tag`;
const TAG_STAMP = (pk) => `39998:${pk}:tag`;
const OPTS = { canonicalPubkey: CANON, localPubkey: LOCAL };

const TAG_V1 = id(0x7001);     // a tag element's event id
const D = `profile-tag-podcaster-${BOB.slice(0, 8)}-${ALICE.slice(0, 8)}`;
const ADDRESS = `39999:${ALICE}:${D}`;
const TAG_ADDR = `39999:${JACK}:podcaster`;

/** A tagging event. Pass null for a field to omit its tag. */
function tagging(o = {}) {
  const f = {
    author: ALICE, d: D, target: BOB, a: TAG_ADDR, e: TAG_V1, polarity: '1',
    z: [STAMP(CANON)], created_at: 1000, eventId: id(0x100), kind: 39999, extraTags: [], ...o,
  };
  const tags = [];
  if (f.d !== null) tags.push(['d', f.d]);
  if (f.target !== null) tags.push(['p', f.target]);
  if (f.a !== null) tags.push(['a', f.a]);
  if (f.e !== null) tags.push(['e', f.e]);
  for (const z of f.z) tags.push(['z', z]);
  if (f.polarity !== null) tags.push(['polarity', f.polarity]);
  tags.push(...f.extraTags);
  return { id: f.eventId, pubkey: f.author, created_at: f.created_at, kind: f.kind, tags, content: '{}', sig: 'f'.repeat(128) };
}

/** A tag element (kind 39999 joined to the tag concept). */
function tagElement(o = {}) {
  const f = { author: JACK, slug: 'podcaster', eventId: TAG_V1, z: [TAG_STAMP(CANON)], kind: 39999, ...o };
  const tags = [];
  if (f.slug !== null) tags.push(['d', f.slug]);
  for (const z of f.z) tags.push(['z', z]);
  return { id: f.eventId, pubkey: f.author, created_at: 500, kind: f.kind, tags, content: '{}', sig: 'f'.repeat(128) };
}

function deletion(o = {}) {
  const f = { author: ALICE, e: [], a: [], created_at: 2000, eventId: id(0x5000), kind: 5, ...o };
  const tags = [...f.e.map((x) => ['e', x]), ...f.a.map((x) => ['a', x])];
  return { id: f.eventId, pubkey: f.author, created_at: f.created_at, kind: f.kind, tags, content: 'revoked', sig: 'f'.repeat(128) };
}

const EDGE_KEYS = ['address', 'createdAt', 'eventId', 'from', 'polarity', 'tagAddress', 'tagEventId', 'tagSlug', 'to', 'type', 'zCanonical', 'zLocal'];

function convert(ev, opts = OPTS) { return load().taggingToEdge(ev, opts); }
function edgeOf(ev, opts = OPTS) {
  const r = convert(ev, opts);
  assert(r && r.ok === true, `expected a record, got ${JSON.stringify(r)}`);
  return r.edge;
}
function refusalOf(ev, opts = OPTS) {
  const r = convert(ev, opts);
  assert(r && r.ok === false, `expected a refusal, got ${JSON.stringify(r)}`);
  return r;
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// ─── module surface ───
t('surface: exports taggingToEdge, standingEdge, revokeApplies, revokeTargets, REFUSAL and TAGS_RELATIONSHIP = "TAGS"', () => {
  const m = load();
  for (const fn of ['taggingToEdge', 'standingEdge', 'revokeApplies', 'revokeTargets']) {
    eq(typeof m[fn], 'function', `export ${fn}`);
  }
  eq(m.TAGS_RELATIONSHIP, 'TAGS', 'TAGS_RELATIONSHIP');
});

t('surface: REFUSAL is frozen and holds exactly the ten stable reason strings', () => {
  const { REFUSAL } = load();
  assert(REFUSAL && Object.isFrozen(REFUSAL), 'REFUSAL must be a frozen object');
  same(Object.values(REFUSAL).sort(), [
    'bad-tag-address', 'bad-target', 'no-d', 'no-nostr-user-tag-stamp', 'no-tag-reference', 'no-target',
    'not-an-event', 'several-tag-references', 'several-targets', 'wrong-kind',
  ], 'REFUSAL values');
});

// ─── AC-1: every deployed tagging shape converts to a record of the same form ───
t('AC-1: a tagging naming its tag by address and id converts to the full record', () => {
  same(convert(tagging()), {
    ok: true,
    edge: {
      type: 'TAGS', from: ALICE, to: BOB, address: ADDRESS, eventId: id(0x100), createdAt: 1000, polarity: '1',
      tagAddress: TAG_ADDR, tagEventId: TAG_V1, tagSlug: 'podcaster', zCanonical: true, zLocal: false,
    },
  }, 'address+id tagging');
});

t('AC-1: an address-only tagging carries the address and slug, and no tag event id', () => {
  const edge = edgeOf(tagging({ e: null }));
  eq(edge.tagAddress, TAG_ADDR, 'tagAddress');
  eq(edge.tagSlug, 'podcaster', 'tagSlug');
  eq(edge.tagEventId, null, 'tagEventId');
});

t('AC-1: an id-only tagging resolves its address and slug from the supplied tag element', () => {
  const edge = edgeOf(tagging({ a: null }), { ...OPTS, tagElementsById: new Map([[TAG_V1, tagElement()]]) });
  eq(edge.tagAddress, TAG_ADDR, 'tagAddress');
  eq(edge.tagSlug, 'podcaster', 'tagSlug');
  eq(edge.tagEventId, TAG_V1, 'tagEventId');
});

t('AC-1: an id-only tagging with no element supplied is unresolved — id kept, no address, no slug', () => {
  const edge = edgeOf(tagging({ a: null }));
  eq(edge.tagEventId, TAG_V1, 'tagEventId');
  eq(edge.tagAddress, null, 'tagAddress');
  eq(edge.tagSlug, null, 'tagSlug');
});

t('AC-1: an id-only tagging never takes the address of a same-slug tag by another author', () => {
  const imposter = tagElement({ author: CAROL, eventId: id(0x7999) }); // same slug, different id and author
  const edge = edgeOf(tagging({ a: null }), { ...OPTS, tagElementsById: new Map([[id(0x7999), imposter]]) });
  eq(edge.tagAddress, null, 'tagAddress must stay null');
  eq(edge.tagSlug, null, 'tagSlug must stay null');
});

t('AC-1: every shape\'s record carries exactly the contract\'s properties — no names, counts, ranks or applied flags', () => {
  same(Object.keys(edgeOf(tagging())).sort(), EDGE_KEYS, 'address and id');
  same(Object.keys(edgeOf(tagging({ e: null }))).sort(), EDGE_KEYS, 'address only');
  same(Object.keys(edgeOf(tagging({ a: null }))).sort(), EDGE_KEYS, 'id only, unresolved');
  same(Object.keys(edgeOf(tagging({ a: null }), { ...OPTS, tagElementsById: new Map([[TAG_V1, tagElement()]]) })).sort(), EDGE_KEYS, 'id only, resolved');
});

t('AC-1: the stance is kept exactly as published', () => {
  for (const p of ['1', '-1', '0', '0.5', '']) eq(edgeOf(tagging({ polarity: p })).polarity, p, `polarity "${p}"`);
});

t('AC-1: an absent stance is recorded as null, not as "1"', () => {
  eq(edgeOf(tagging({ polarity: null })).polarity, null, 'no polarity tag');
  eq(edgeOf(tagging({ polarity: null, extraTags: [['polarity']] })).polarity, null, 'polarity tag with no value');
  eq(edgeOf(tagging({ polarity: null, extraTags: [['polarity', 5]] })).polarity, null, 'non-string polarity value');
});

t('AC-1: the first polarity tag is the stance', () => {
  eq(edgeOf(tagging({ polarity: '-1', extraTags: [['polarity', '1']] })).polarity, '-1', 'first polarity wins');
});

t('AC-1: identity is 39999:<author>:<first d>, with event id and created_at', () => {
  const edge = edgeOf(tagging({ d: 'x', extraTags: [['d', 'y']], eventId: id(0x123), created_at: 4242 }));
  eq(edge.address, `39999:${ALICE}:x`, 'address uses the first d');
  eq(edge.eventId, id(0x123), 'eventId');
  eq(edge.createdAt, 4242, 'createdAt');
});

t('AC-1: the target is the p pubkey, lower-cased', () => {
  eq(edgeOf(tagging()).to, BOB, 'to');
  eq(edgeOf(tagging({ target: 'ABCD'.repeat(16) })).to, 'abcd'.repeat(16), 'upper-case p lower-cased');
});

t('AC-1: which stamps the event carried — canonical, this deployment\'s own, both, or canonical plus another deployment\'s', () => {
  const flags = (z, opts = OPTS) => { const e = edgeOf(tagging({ z }), opts); return [e.zCanonical, e.zLocal]; };
  same(flags([STAMP(CANON)]), [true, false], 'canonical only');
  same(flags([STAMP(LOCAL)]), [false, true], 'local only');
  same(flags([STAMP(CANON), STAMP(LOCAL)]), [true, true], 'both');
  same(flags([STAMP(CANON), STAMP(OTHER_DEPLOY)]), [true, false], 'canonical + another deployment\'s own');
  same(flags([STAMP(CANON)], { canonicalPubkey: CANON, localPubkey: CANON }), [true, true], 'canonical pubkey == local pubkey');
});

t('AC-1: a tag address and a tag event id are lower-cased', () => {
  const upperId = 'ABCD'.repeat(16);
  const lowerId = 'abcd'.repeat(16);
  const edge = edgeOf(tagging({ a: `39999:${'ABCD'.repeat(16)}:podcaster`, e: upperId }));
  eq(edge.tagAddress, `39999:${'abcd'.repeat(16)}:podcaster`, 'tagAddress pubkey segment lower-cased');
  eq(edge.tagEventId, lowerId, 'tagEventId lower-cased');
  const resolved = edgeOf(tagging({ a: null, e: upperId }), {
    ...OPTS, tagElementsById: new Map([[lowerId, tagElement({ eventId: lowerId })]]),
  });
  eq(resolved.tagAddress, TAG_ADDR, 'an upper-case e still resolves through the lower-case id');
});

t('AC-1: a supplied element resolves only if it is a kind-39999 tag element (a :tag stamp, a non-empty d)', () => {
  const resolve = (el) => edgeOf(tagging({ a: null }), { ...OPTS, tagElementsById: new Map([[TAG_V1, el]]) }).tagAddress;
  eq(resolve(tagElement({ z: [TAG_STAMP(LOCAL)] })), TAG_ADDR, 'local :tag stamp resolves');
  eq(resolve(tagElement({ z: [STAMP(CANON)] })), null, 'an element that is not a tag (another tagging) does not resolve');
  eq(resolve(tagElement({ z: [TAG_STAMP(OTHER_DEPLOY)] })), null, 'an element stamped only by another deployment\'s :tag does not resolve');
  eq(resolve(tagElement({ kind: 1 })), null, 'a kind-1 event does not resolve');
  eq(resolve(tagElement({ slug: '' })), null, 'an element with an empty d does not resolve');
});

t('AC-1: a tag-element lookup that throws leaves the record unresolved rather than refusing it', () => {
  const throwing = { get() { throw new Error('lookup failed'); } };
  const edge = edgeOf(tagging({ a: null }), { ...OPTS, tagElementsById: throwing });
  eq(edge.tagAddress, null, 'tagAddress');
  eq(edge.tagEventId, TAG_V1, 'tagEventId');
});

t('AC-1 (owner ruling): when a and e name different tags, a is the tag and e is provenance — no refusal', () => {
  const other = tagElement({ author: CAROL, slug: 'musician' }); // e resolves to a different tag than a names
  const edge = edgeOf(tagging(), { ...OPTS, tagElementsById: new Map([[TAG_V1, other]]) });
  eq(edge.tagAddress, TAG_ADDR, 'tagAddress follows a');
  eq(edge.tagSlug, 'podcaster', 'tagSlug follows a');
  eq(edge.tagEventId, TAG_V1, 'tagEventId kept as provenance');
});

// ─── AC-2: anything else is refused with a reason; nothing is refused for who wrote it ───
t('AC-2: malformed events are refused as not-an-event', () => {
  const base = tagging();
  const cases = {
    'null': null,
    'a number': 42,
    'a string': 'event',
    'upper-case id': { ...base, id: 'ABCD'.repeat(16) },
    'upper-case pubkey': { ...base, pubkey: 'ABCD'.repeat(16) },
    'short id': { ...base, id: 'abc' },
    'non-integer created_at': { ...base, created_at: 1.5 },
    'negative created_at': { ...base, created_at: -1 },
    'tags not an array': { ...base, tags: 'nope' },
  };
  for (const [label, ev] of Object.entries(cases)) eq(refusalOf(ev).reason, 'not-an-event', label);
});

t('AC-2: another kind is refused as wrong-kind', () => {
  for (const kind of [1, 3, 30000, 39998]) eq(refusalOf(tagging({ kind })).reason, 'wrong-kind', `kind ${kind}`);
});

t('AC-2: a missing, empty, or over-long first d is refused as no-d (255 UTF-8 bytes is the limit)', () => {
  eq(refusalOf(tagging({ d: null })).reason, 'no-d', 'no d');
  eq(refusalOf(tagging({ d: '', extraTags: [['d', 'second']] })).reason, 'no-d', 'empty first d, non-empty second');
  eq(edgeOf(tagging({ d: 'profile-tag-' + '€'.repeat(81) })).address.endsWith('€'.repeat(81)), true, '255 bytes is accepted');
  eq(refusalOf(tagging({ d: 'profile-tag-' + '€'.repeat(82) })).reason, 'no-d', '258 bytes (94 characters) is refused');
});

t('AC-2: a tagging without a nostr-user-tag stamp this deployment honours is refused', () => {
  eq(refusalOf(tagging({ z: [] })).reason, 'no-nostr-user-tag-stamp', 'no z');
  eq(refusalOf(tagging({ z: [TAG_STAMP(CANON)] })).reason, 'no-nostr-user-tag-stamp', 'a :tag stamp, not :nostr-user-tag');
  eq(refusalOf(tagging({ z: [STAMP(OTHER_DEPLOY)] })).reason, 'no-nostr-user-tag-stamp', 'only another deployment\'s own stamp');
  eq(refusalOf(tagging({ z: [STAMP(LOCAL)] }), { canonicalPubkey: CANON }).reason, 'no-nostr-user-tag-stamp', 'local stamp but no localPubkey supplied');
  eq(refusalOf(tagging(), {}).reason, 'no-nostr-user-tag-stamp', 'no stamp pubkeys supplied');
});

t('AC-2: zero, several, or malformed p targets are refused', () => {
  eq(refusalOf(tagging({ target: null })).reason, 'no-target', 'no p');
  eq(refusalOf(tagging({ target: null, extraTags: [['p', 7]] })).reason, 'no-target', 'non-string p');
  eq(refusalOf(tagging({ extraTags: [['p', CAROL]] })).reason, 'several-targets', 'two distinct p');
  eq(refusalOf(tagging({ target: 'xyz' })).reason, 'bad-target', 'non-hex p');
  eq(refusalOf(tagging({ target: BOB.slice(1) })).reason, 'bad-target', '63-char p');
});

t('AC-2: the same p repeated (even in another case) is one target, not several', () => {
  eq(edgeOf(tagging({ extraTags: [['p', BOB]] })).to, BOB, 'duplicate p');
  eq(edgeOf(tagging({ target: 'abcd'.repeat(16), extraTags: [['p', 'ABCD'.repeat(16)]] })).to, 'abcd'.repeat(16), 'same p, two cases');
});

t('AC-2: no tag named at all is refused as no-tag-reference (a non-hex e does not count)', () => {
  eq(refusalOf(tagging({ a: null, e: null })).reason, 'no-tag-reference', 'neither a nor e');
  eq(refusalOf(tagging({ a: null, e: 'not-hex' })).reason, 'no-tag-reference', 'only a non-hex e');
});

t('AC-2: several different tags named — more than one distinct a, or more than one distinct e — are refused', () => {
  eq(refusalOf(tagging({ extraTags: [['a', `39999:${JACK}:musician`]] })).reason, 'several-tag-references', 'two distinct a');
  eq(refusalOf(tagging({ extraTags: [['e', id(0x7002), '', 'mention']] })).reason, 'several-tag-references', 'two distinct e (markers not considered)');
  eq(edgeOf(tagging({ extraTags: [['a', TAG_ADDR], ['e', TAG_V1]] })).tagAddress, TAG_ADDR, 'repeated identical a / e are one reference');
});

t('AC-2: an a that is not 39999:<64-hex>:<slug> is refused as bad-tag-address', () => {
  for (const [label, a] of [
    ['kind 39998', `39998:${JACK}:podcaster`],
    ['short pubkey', `39999:${JACK.slice(2)}:podcaster`],
    ['non-hex pubkey', `39999:${'g'.repeat(64)}:podcaster`],
    ['empty slug', `39999:${JACK}:`],
    ['no slug part', `39999:${JACK}`],
  ]) eq(refusalOf(tagging({ a })).reason, 'bad-tag-address', label);
});

t('AC-2: once the event is valid, a refusal also carries its address, event id, created_at and author', () => {
  const r = refusalOf(tagging({ target: null, eventId: id(0x999), created_at: 1234 }));
  same({ reason: r.reason, address: r.address, eventId: r.eventId, createdAt: r.createdAt, from: r.from },
    { reason: 'no-target', address: ADDRESS, eventId: id(0x999), createdAt: 1234, from: ALICE }, 'addressed refusal');
});

t('AC-2: a refusal before the event is known to be a valid kind-39999 with a d carries no address', () => {
  for (const ev of [null, tagging({ kind: 1 }), tagging({ d: null })]) {
    eq(refusalOf(ev).address, undefined, `address on ${JSON.stringify(refusalOf(ev).reason)}`);
  }
});

t('AC-2: the conversion never throws on garbage', () => {
  const garbage = [undefined, null, 0, '', [], {}, { tags: [null, 5, 'x', [], [null]] },
    { ...tagging(), tags: [null, ['d'], ['p'], ['z'], ['a'], ['e'], ['polarity']] },
    { ...tagging(), tags: [['d', {}], ['p', []], ['z', 1]] }];
  const { taggingToEdge, REFUSAL } = load();
  const reasons = new Set(Object.values(REFUSAL));
  for (const g of garbage) {
    let r;
    try { r = taggingToEdge(g, OPTS); } catch (e) { throw new Error(`threw on ${JSON.stringify(g)}: ${e.message}`); }
    assert(r && r.ok === false && reasons.has(r.reason), `expected a named refusal for ${JSON.stringify(g)}, got ${JSON.stringify(r)}`);
  }
  try { taggingToEdge(tagging()); } catch (e) { throw new Error(`threw with no options: ${e.message}`); }
});

t('AC-2: nothing is refused for who wrote it — any author, self-taggings, disputes, neutral, absent stance, unknown tag, fixture slugs, any d', () => {
  assert(edgeOf(tagging({ author: hex('9'), d: 'profile-tag-x-1-2' })).from === hex('9'), 'unknown author');
  const self = edgeOf(tagging({ target: ALICE }));
  eq(self.to, self.from, 'a self-tagging produces a record');
  eq(edgeOf(tagging({ polarity: '-1' })).polarity, '-1', 'dispute');
  eq(edgeOf(tagging({ polarity: '0' })).polarity, '0', 'neutral');
  eq(edgeOf(tagging({ polarity: null })).polarity, null, 'absent');
  eq(edgeOf(tagging({ a: null, e: id(0xdead) })).tagAddress, null, 'a tag not on this relay');
  assert(edgeOf(tagging({ a: `39999:${JACK}:tagdetail-s2-1785079329400-ucjwo0` })), 'a test-fixture slug');
  eq(edgeOf(tagging({ d: 'not-the-usual-prefix' })).address, `39999:${ALICE}:not-the-usual-prefix`, 'no d-format rule');
});

// ─── AC-3: one version of a tagging stands ───
const v = (o) => edgeOf(tagging(o));

t('AC-3: the newer created_at stands, whichever order the versions arrive in', () => {
  const { standingEdge } = load();
  const older = v({ eventId: id(0x10), created_at: 100, polarity: '1' });
  const newer = v({ eventId: id(0x20), created_at: 200, polarity: '-1' });
  const r1 = standingEdge(older, newer);
  eq(r1.standing.eventId, newer.eventId, 'older then newer: newer stands');
  eq(r1.reason, 'newer', 'reason');
  eq(r1.superseded.eventId, older.eventId, 'superseded');
  eq(r1.changed, true, 'changed');
  const r2 = standingEdge(newer, older);
  eq(r2.standing.eventId, newer.eventId, 'newer then older: newer stands');
  eq(r2.reason, 'older-ignored', 'reason');
  eq(r2.superseded.eventId, older.eventId, 'superseded is the ignored incoming');
  eq(r2.changed, false, 'changed');
});

t('AC-3: on equal created_at the lower event id stands (NIP-01), in both orders', () => {
  const { standingEdge } = load();
  const low = v({ eventId: id(0x0a), created_at: 300 });
  const high = v({ eventId: id(0x0b), created_at: 300 });
  eq(standingEdge(low, high).standing.eventId, low.eventId, 'low then high');
  eq(standingEdge(high, low).standing.eventId, low.eventId, 'high then low');
  eq(standingEdge(high, low).reason, 'newer', 'the lower id supersedes the higher');
});

t('AC-3: a version that moves the tagging to another target names the target that no longer holds it', () => {
  const { standingEdge } = load();
  const toBob = v({ eventId: id(0x10), created_at: 100 });
  const toCarol = v({ eventId: id(0x20), created_at: 200, target: CAROL });
  eq(standingEdge(toBob, toCarol).droppedTarget, BOB, 'Bob no longer holds the tagging');
  eq(standingEdge(toCarol, toBob).droppedTarget, null, 'an ignored older version drops nothing');
  eq(standingEdge(toBob, v({ eventId: id(0x30), created_at: 300 })).droppedTarget, null, 'same target drops nothing');
});

t('AC-3: the same version seen twice is no change, and resolution only moves from unresolved to resolved', () => {
  const { standingEdge } = load();
  const unresolved = v({ a: null });
  const resolved = edgeOf(tagging({ a: null }), { ...OPTS, tagElementsById: new Map([[TAG_V1, tagElement()]]) });
  const same1 = standingEdge(resolved, resolved);
  eq(same1.reason, 'same-version', 'reason');
  eq(same1.changed, false, 'identical: unchanged');
  const up = standingEdge(unresolved, resolved);
  eq(up.standing.tagAddress, TAG_ADDR, 'unresolved + resolved → resolved');
  eq(up.standing.tagSlug, 'podcaster', 'slug filled');
  eq(up.changed, true, 'upgrade is a change');
  const down = standingEdge(resolved, unresolved);
  eq(down.standing.tagAddress, TAG_ADDR, 'resolved + unresolved stays resolved');
  eq(down.changed, false, 'no downgrade, no change');
});

t('AC-3: for the same version, the stamp flags follow the incoming record', () => {
  const { standingEdge } = load();
  const seenHere = v({ z: [STAMP(CANON), STAMP(LOCAL)] });
  const seenElsewhere = edgeOf(tagging({ z: [STAMP(CANON), STAMP(LOCAL)] }), { canonicalPubkey: CANON, localPubkey: OTHER_DEPLOY });
  const r = standingEdge(seenHere, seenElsewhere);
  eq(r.standing.zLocal, false, 'zLocal from incoming');
  eq(r.changed, true, 'flag change is a change');
});

t('AC-3: a first version is new; no incoming version changes nothing; different addresses change nothing', () => {
  const { standingEdge } = load();
  const a = v({});
  const r0 = standingEdge(null, a);
  same({ s: r0.standing.eventId, reason: r0.reason, changed: r0.changed, dropped: r0.droppedTarget }, { s: a.eventId, reason: 'new', changed: true, dropped: null }, 'new');
  const r1 = standingEdge(a, null);
  same({ s: r1.standing.eventId, reason: r1.reason, changed: r1.changed }, { s: a.eventId, reason: 'no-incoming', changed: false }, 'no-incoming');
  const other = v({ d: 'another-d', eventId: id(0x77), created_at: 9999 });
  const r2 = standingEdge(a, other);
  same({ s: r2.standing.eventId, reason: r2.reason, changed: r2.changed }, { s: a.eventId, reason: 'address-mismatch', changed: false }, 'address-mismatch');
});

t('AC-3: a newer non-tagging version at the same address retires the edge and drops its target', () => {
  const { standingEdge } = load();
  const edge = v({ eventId: id(0x10), created_at: 100 });
  const cleared = refusalOf(tagging({ target: null, eventId: id(0x20), created_at: 200 })); // e.g. the p removed
  const r = standingEdge(edge, cleared);
  same({ standing: r.standing, reason: r.reason, changed: r.changed, dropped: r.droppedTarget, sup: r.superseded && r.superseded.eventId },
    { standing: null, reason: 'retired-by-non-tagging', changed: true, dropped: BOB, sup: edge.eventId }, 'retired');
});

t('AC-3: an older non-tagging version is ignored; a non-tagging version with nothing standing retires nothing', () => {
  const { standingEdge } = load();
  const edge = v({ eventId: id(0x20), created_at: 200 });
  const olderRefusal = refusalOf(tagging({ target: null, eventId: id(0x10), created_at: 100 }));
  const r = standingEdge(edge, olderRefusal);
  same({ s: r.standing.eventId, reason: r.reason, changed: r.changed }, { s: edge.eventId, reason: 'older-ignored', changed: false }, 'older refusal ignored');
  const r0 = standingEdge(null, olderRefusal);
  same({ s: r0.standing, reason: r0.reason, changed: r0.changed }, { s: null, reason: 'retired-by-non-tagging', changed: false }, 'nothing to retire');
});

t('AC-3: the same event later seen as a non-tagging retires the edge', () => {
  const { standingEdge } = load();
  const edge = v({ z: [STAMP(LOCAL)] });
  const sameEventRefused = refusalOf(tagging({ z: [STAMP(LOCAL)] }), { canonicalPubkey: CANON, localPubkey: OTHER_DEPLOY });
  const r = standingEdge(edge, sameEventRefused);
  eq(r.standing, null, 'standing');
  eq(r.reason, 'retired-by-non-tagging', 'reason');
});

// ─── AC-4: a revoke removes only what it names, whenever it arrives ───
t('AC-4: the tagger\'s kind-5 naming the version\'s event id applies — even if seen before the version', () => {
  const { revokeApplies } = load();
  const edge = v({ eventId: id(0x10), created_at: 100 });
  same(revokeApplies(edge, deletion({ e: [id(0x10)], created_at: 200 })), { applies: true, reason: 'names-event-id' }, 'after');
  same(revokeApplies(edge, deletion({ e: [id(0x10)], created_at: 50 })), { applies: true, reason: 'names-event-id' }, 'seen before (older created_at)');
  const lettered = v({ eventId: 'abcd'.repeat(16) });
  same(revokeApplies(lettered, deletion({ e: ['ABCD'.repeat(16)] })), { applies: true, reason: 'names-event-id' }, 'e value case-insensitive');
});

t('AC-4: a kind-5 naming a superseded or a later version does not apply', () => {
  const { revokeApplies } = load();
  const edge = v({ eventId: id(0x20), created_at: 200 });
  same(revokeApplies(edge, deletion({ e: [id(0x10)] })), { applies: false, reason: 'not-named' }, 'superseded version');
  same(revokeApplies(edge, deletion({ e: [id(0x30)] })), { applies: false, reason: 'not-named' }, 'a later version');
});

t('AC-4: a kind-5 naming the tagging\'s address applies from the version\'s created_at on, not before', () => {
  const { revokeApplies } = load();
  const edge = v({ eventId: id(0x20), created_at: 200 });
  same(revokeApplies(edge, deletion({ a: [ADDRESS], created_at: 300 })), { applies: true, reason: 'names-address' }, 'later deletion');
  same(revokeApplies(edge, deletion({ a: [ADDRESS], created_at: 200 })), { applies: true, reason: 'names-address' }, 'equal created_at');
  same(revokeApplies(edge, deletion({ a: [ADDRESS], created_at: 199 })), { applies: false, reason: 'address-deletion-older' }, 'older deletion');
  same(revokeApplies(edge, deletion({ a: [`39999:${ALICE}:another-d`], created_at: 300 })), { applies: false, reason: 'not-named' }, 'a different address');
});

t('AC-4: the address match is case-insensitive in the pubkey segment', () => {
  const { revokeApplies } = load();
  const author = 'abcd'.repeat(16);
  const edge = v({ author, d: 'x' });
  same(revokeApplies(edge, deletion({ author, a: [`39999:${'ABCD'.repeat(16)}:x`] })), { applies: true, reason: 'names-address' }, 'upper-case segment');
});

t('AC-4: a kind-5 signed by anyone other than the tagger does not apply', () => {
  const { revokeApplies } = load();
  const edge = v({ eventId: id(0x10) });
  same(revokeApplies(edge, deletion({ author: CAROL, e: [id(0x10)] })), { applies: false, reason: 'not-the-tagger' }, 'by id');
  same(revokeApplies(edge, deletion({ author: CAROL, a: [ADDRESS] })), { applies: false, reason: 'not-the-tagger' }, 'by address');
});

t('AC-4: anything that is not a well-formed kind-5 is not-a-deletion, and garbage never throws', () => {
  const { revokeApplies } = load();
  const edge = v({ eventId: id(0x10) });
  eq(revokeApplies(edge, deletion({ kind: 1, e: [id(0x10)] })).reason, 'not-a-deletion', 'kind 1');
  eq(revokeApplies(edge, deletion({ author: 'ABCD'.repeat(16), e: [id(0x10)] })).reason, 'not-a-deletion', 'upper-case deletion pubkey');
  for (const g of [undefined, null, 5, 'x', {}, { kind: 5 }, { kind: 5, tags: 'no' }]) {
    let r;
    try { r = revokeApplies(edge, g); } catch (e) { throw new Error(`threw on ${JSON.stringify(g)}: ${e.message}`); }
    same(r, { applies: false, reason: 'not-a-deletion' }, `garbage ${JSON.stringify(g)}`);
  }
});

t('AC-4: revokeTargets lists what a kind-5 names — valid e ids and a addresses, lower-cased — and nothing for anything else', () => {
  const { revokeTargets } = load();
  const r = revokeTargets(deletion({ e: ['ABCD'.repeat(16), 'not-hex'], a: [`39999:${'ABCD'.repeat(16)}:x`] }));
  same({ e: [...r.eventIds].sort(), a: [...r.addresses].sort() },
    { e: ['abcd'.repeat(16)], a: [`39999:${'abcd'.repeat(16)}:x`] }, 'targets');
  for (const g of [undefined, null, tagging(), { kind: 5, tags: 'no' }]) {
    let out;
    try { out = revokeTargets(g); } catch (e) { throw new Error(`threw on ${JSON.stringify(g)}: ${e.message}`); }
    same(out, { eventIds: [], addresses: [] }, `nothing for ${JSON.stringify(g) || String(g)}`);
  }
});

// ─── rules pinned after mutation testing (Test Design validation, 2026-09-27) ───
t('AC-1: a non-string or valueless first polarity tag makes the stance null, even if a later one is a string', () => {
  eq(edgeOf(tagging({ polarity: null, extraTags: [['polarity', 5], ['polarity', '1']] })).polarity, null, 'non-string first');
  eq(edgeOf(tagging({ polarity: null, extraTags: [['polarity'], ['polarity', '-1']] })).polarity, null, 'valueless first');
});

t('AC-1: only the pubkey segment of a is lower-cased — the slug keeps its case', () => {
  const edge = edgeOf(tagging({ a: `39999:${'ABCD'.repeat(16)}:PodCaster` }));
  eq(edge.tagAddress, `39999:${'abcd'.repeat(16)}:PodCaster`, 'tagAddress');
  eq(edge.tagSlug, 'PodCaster', 'tagSlug');
});

t('AC-1: the slug is everything after 39999:<pubkey>:, even when it contains a colon', () => {
  eq(edgeOf(tagging({ a: `39999:${JACK}:ns:podcaster` })).tagSlug, 'ns:podcaster', 'from a');
  const resolved = edgeOf(tagging({ a: null }), { ...OPTS, tagElementsById: new Map([[TAG_V1, tagElement({ slug: 'ns:podcaster' })]]) });
  eq(resolved.tagAddress, `39999:${JACK}:ns:podcaster`, 'resolved tagAddress');
  eq(resolved.tagSlug, 'ns:podcaster', 'resolved tagSlug');
});

t('AC-1: a supplied element must itself be a well-formed event — an upper-case pubkey or id, or no usable first d, leaves the record unresolved', () => {
  const resolve = (el) => edgeOf(tagging({ a: null }), { ...OPTS, tagElementsById: new Map([[TAG_V1, el]]) }).tagAddress;
  eq(resolve(tagElement({ author: 'ABCD'.repeat(16) })), null, 'upper-case element pubkey');
  eq(resolve({ ...tagElement(), id: 'ABCD'.repeat(16) }), null, 'upper-case element id');
  eq(resolve(tagElement({ slug: null })), null, 'element with no d');
  eq(resolve({ ...tagElement(), tags: [['d', ''], ['d', 'podcaster'], ['z', TAG_STAMP(CANON)]] }), null, 'element whose first d is empty');
});

t('AC-1: an empty stamp pubkey matches nothing, for the tagging and for the tag element', () => {
  eq(refusalOf(tagging({ z: ['39998::nostr-user-tag'] }), { canonicalPubkey: CANON, localPubkey: '' }).reason, 'no-nostr-user-tag-stamp', 'empty localPubkey');
  eq(refusalOf(tagging({ z: ['39998::nostr-user-tag'] }), {}).reason, 'no-nostr-user-tag-stamp', 'no options');
  const el = tagElement({ z: ['39998::tag'] });
  eq(edgeOf(tagging({ a: null }), { canonicalPubkey: CANON, localPubkey: '', tagElementsById: new Map([[TAG_V1, el]]) }).tagAddress, null, 'element with an empty-pubkey :tag stamp');
});

t('AC-1: created_at 0 is a valid non-negative integer', () => {
  eq(edgeOf(tagging({ created_at: 0 })).createdAt, 0, 'createdAt 0');
});

t('AC-2: a valueless or non-string first d is no-d, even with a later valued d', () => {
  eq(refusalOf(tagging({ d: null, extraTags: [['d'], ['d', 'y']] })).reason, 'no-d', 'valueless first d');
  eq(refusalOf(tagging({ d: null, extraTags: [['d', 5], ['d', 'y']] })).reason, 'no-d', 'non-string first d');
});

t('AC-2: a valid p beside a malformed p is several-targets', () => {
  eq(refusalOf(tagging({ extraTags: [['p', 'xyz']] })).reason, 'several-targets', 'valid + malformed p');
});

t('AC-2: the same e in two cases, or the same a in two pubkey cases, is one tag reference', () => {
  eq(edgeOf(tagging({ e: 'abcd'.repeat(16), extraTags: [['e', 'ABCD'.repeat(16)]] })).tagEventId, 'abcd'.repeat(16), 'e');
  eq(edgeOf(tagging({ a: `39999:${'abcd'.repeat(16)}:x`, extraTags: [['a', `39999:${'ABCD'.repeat(16)}:x`]] })).tagAddress,
    `39999:${'abcd'.repeat(16)}:x`, 'a');
});

t('AC-2: a non-string a value is not a tag reference', () => {
  eq(edgeOf(tagging({ extraTags: [['a', 5]] })).tagAddress, TAG_ADDR, 'beside a valid a');
  eq(edgeOf(tagging({ a: null, extraTags: [['a', 5]] })).tagEventId, TAG_V1, 'beside an e only');
});

t('AC-2: every refusal after step 1 carries the address, event id, created_at and author', () => {
  const cases = {
    'no-nostr-user-tag-stamp': tagging({ z: [] }),
    'no-target': tagging({ target: null }),
    'several-targets': tagging({ extraTags: [['p', CAROL]] }),
    'bad-target': tagging({ target: 'xyz' }),
    'no-tag-reference': tagging({ a: null, e: null }),
    'several-tag-references': tagging({ extraTags: [['a', `39999:${JACK}:musician`]] }),
    'bad-tag-address': tagging({ a: `39998:${JACK}:podcaster` }),
  };
  for (const [reason, ev] of Object.entries(cases)) {
    const r = refusalOf(ev);
    same({ reason: r.reason, address: r.address, eventId: r.eventId, createdAt: r.createdAt, from: r.from },
      { reason, address: ADDRESS, eventId: ev.id, createdAt: ev.created_at, from: ALICE }, reason);
  }
});

t('AC-3: a non-tagging version at the same created_at retires the edge only if its id is lower (NIP-01)', () => {
  const { standingEdge } = load();
  const edge = v({ eventId: id(0x50), created_at: 500 });
  const lower = refusalOf(tagging({ target: null, eventId: id(0x40), created_at: 500 }));
  const higher = refusalOf(tagging({ target: null, eventId: id(0x60), created_at: 500 }));
  eq(standingEdge(edge, lower).reason, 'retired-by-non-tagging', 'lower id retires');
  eq(standingEdge(edge, higher).reason, 'older-ignored', 'higher id is ignored');
});

t('AC-3: the same event later seen as a non-tagging supersedes the edge and drops its target', () => {
  const { standingEdge } = load();
  const edge = v({ z: [STAMP(LOCAL)] });
  const refused = refusalOf(tagging({ z: [STAMP(LOCAL)] }), { canonicalPubkey: CANON, localPubkey: OTHER_DEPLOY });
  const r = standingEdge(edge, refused);
  same({ changed: r.changed, dropped: r.droppedTarget, sup: r.superseded && r.superseded.eventId },
    { changed: true, dropped: BOB, sup: edge.eventId }, 'retire outcome');
});

t('AC-3: for the same version both stamp flags follow the incoming record', () => {
  const { standingEdge } = load();
  const canonOnly = edgeOf(tagging({ z: [STAMP(CANON)] }));
  const viaLocal = edgeOf(tagging({ z: [STAMP(CANON)] }), { canonicalPubkey: OTHER_DEPLOY, localPubkey: CANON });
  const r = standingEdge(canonOnly, viaLocal);
  same({ zc: r.standing.zCanonical, zl: r.standing.zLocal }, { zc: false, zl: true }, 'flags from incoming');
});

t('AC-3: nothing standing and nothing incoming is no change, and never throws', () => {
  const { standingEdge } = load();
  let r;
  try { r = standingEdge(null, null); } catch (e) { throw new Error(`threw: ${e.message}`); }
  same({ s: r.standing, changed: r.changed, reason: r.reason }, { s: null, changed: false, reason: 'no-incoming' }, 'null/null');
});

t('AC-4: an id match applies even when the same kind-5 also names the address with an older created_at', () => {
  const { revokeApplies } = load();
  same(revokeApplies(v({ eventId: id(0x10), created_at: 200 }), deletion({ e: [id(0x10)], a: [ADDRESS], created_at: 100 })),
    { applies: true, reason: 'names-event-id' }, 'e wins');
});

t('AC-4: a kind-5 naming several ids applies if any of them is the version', () => {
  const { revokeApplies } = load();
  eq(revokeApplies(v({ eventId: id(0x10) }), deletion({ e: [id(0x99), id(0x10)] })).applies, true, 'second e matches');
});

t('AC-4: revoke matching keeps the d\'s case — only the pubkey segment is lower-cased', () => {
  const { revokeApplies, revokeTargets } = load();
  same(revokeTargets(deletion({ a: [`39999:${'ABCD'.repeat(16)}:Mixed-Case`] })).addresses, [`39999:${'abcd'.repeat(16)}:Mixed-Case`], 'revokeTargets');
  same(revokeApplies(v({ d: 'Mixed-Case' }), deletion({ a: [`39999:${ALICE}:Mixed-Case`] })), { applies: true, reason: 'names-address' }, 'revokeApplies');
});

t('AC-4: a deletion with an upper-case id or a bad created_at is not-a-deletion', () => {
  const { revokeApplies } = load();
  const edge = v({ eventId: id(0x10) });
  eq(revokeApplies(edge, { ...deletion({ e: [id(0x10)] }), id: 'ABCD'.repeat(16) }).reason, 'not-a-deletion', 'upper-case id');
  eq(revokeApplies(edge, { ...deletion({ e: [id(0x10)] }), created_at: 'soon' }).reason, 'not-a-deletion', 'non-integer created_at');
});

t('AC-4: revokeApplies with no edge never throws and does not apply', () => {
  const { revokeApplies } = load();
  for (const bad of [null, undefined, 5, 'edge']) {
    let r;
    try { r = revokeApplies(bad, deletion({ e: [id(0x10)] })); } catch (e) { throw new Error(`threw on edge ${JSON.stringify(bad)}: ${e.message}`); }
    eq(r && r.applies, false, `edge ${JSON.stringify(bad)}`);
  }
});

// ─── review round (2026-09-27): ADR 0001 clarifications 9–12 ───
t('clarification 9: an over-long first d is skipped, as strfry does — the next d is the identity', () => {
  const long = 'L'.repeat(300);
  eq(edgeOf(tagging({ d: long, extraTags: [['d', 'x']] })).address, `39999:${ALICE}:x`, 'identity is the first indexable d');
  eq(refusalOf(tagging({ d: long, extraTags: [['d', 'M'.repeat(256)]] })).reason, 'no-d', 'no indexable d left');
  eq(refusalOf(tagging({ d: long, extraTags: [['d', '']] })).reason, 'no-d', 'the first indexable d is empty');
});

t('clarification 9: a version the relay filed under a later d retires or replaces the edge at that address', () => {
  const { standingEdge } = load();
  const v1 = v({ d: 'x', eventId: id(0x10), created_at: 100 });
  const v2 = edgeOf(tagging({ d: 'L'.repeat(300), extraTags: [['d', 'x']], target: CAROL, eventId: id(0x20), created_at: 200 }));
  const r = standingEdge(v1, v2);
  same({ reason: r.reason, s: r.standing.eventId, dropped: r.droppedTarget }, { reason: 'newer', s: id(0x20), dropped: BOB }, 'v2 stands at x');
});

t('clarification 10: the version order holds when createdAt is a BigInt or an Integer-like object read back from Neo4j', () => {
  const { standingEdge } = load();
  const high = v({ eventId: id(0x09), created_at: 1000 });
  const low = v({ eventId: id(0x01), created_at: 1000, target: CAROL });
  const bigHigh = { ...high, createdAt: 1000n };
  const intLikeHigh = { ...high, createdAt: { valueOf: () => 1000n, toString: () => '1000' } };
  for (const [label, cur] of [['BigInt', bigHigh], ['Integer-like', intLikeHigh]]) {
    eq(standingEdge(cur, low).standing.eventId, id(0x01), `${label} current, tie: the lower id stands`);
    eq(standingEdge(low, cur).standing.eventId, id(0x01), `${label} incoming, tie: the lower id stands`);
  }
  eq(standingEdge({ ...high, createdAt: 999n }, low).standing.eventId, id(0x01), 'BigInt older loses');
  eq(standingEdge({ ...high, createdAt: 1001n }, low).standing.eventId, id(0x09), 'BigInt newer wins');
});

t('clarification 11: a supplied element resolves only if its id is the e the tagging names', () => {
  const liar = { get: () => tagElement({ author: CAROL, eventId: id(0x9999) }) }; // answers every lookup with another tag
  const edge = edgeOf(tagging({ a: null }), { ...OPTS, tagElementsById: liar });
  eq(edge.tagAddress, null, 'tagAddress stays null');
  eq(edge.tagEventId, TAG_V1, 'tagEventId kept');
});

t('clarification 11: an element that throws while being read leaves the tagging unresolved, not refused', () => {
  const trap = new Map([[TAG_V1, { get id() { throw new Error('boom'); } }]]);
  const r = convert(tagging({ a: null }), { ...OPTS, tagElementsById: trap });
  assert(r.ok === true, `expected a record, got ${JSON.stringify(r)}`);
  eq(r.edge.tagAddress, null, 'unresolved');
});

t('clarification 12: an address may carry any character after the second colon, line terminators included', () => {
  const { revokeApplies, revokeTargets } = load();
  const slug = 'foo\nbar';
  const edge = edgeOf(tagging({ a: `39999:${JACK}:${slug}` }));
  eq(edge.tagAddress, `39999:${JACK}:${slug}`, 'tagging a with a newline in the slug');
  eq(edge.tagSlug, slug, 'slug kept whole');
  const author = 'abcd'.repeat(16);
  const tagged = edgeOf(tagging({ author, d: 'x\ny' }));
  same(revokeTargets(deletion({ author, a: [`39999:${'ABCD'.repeat(16)}:x\ny`] })).addresses, [`39999:${author}:x\ny`], 'revokeTargets lower-cases the pubkey');
  same(revokeApplies(tagged, deletion({ author, a: [`39999:${'ABCD'.repeat(16)}:x\ny`] })), { applies: true, reason: 'names-address' }, 'revoke by that address');
});

// ─── purity / ADR 0015 ───
t('purity: the module is pure CommonJS — sibling requires only, no I/O, no time, no randomness, no logging', () => {
  if (!fs.existsSync(MODULE_DIR)) throw new Error('src/lib/tagging-edges/ does not exist yet (purity check)');
  const files = fs.readdirSync(MODULE_DIR).filter((f) => f.endsWith('.js'));
  assert(files.includes('index.js') && files.includes('contract.js'), `expected index.js and contract.js, found ${files.join(', ')}`);
  // Behaviour, not vocabulary: comments are stripped before scanning, so a comment may name what the code avoids.
  const banned = ['Date.now', 'new Date', 'Math.random', 'fetch(', 'crypto.', 'console.', 'process.', 'XMLHttpRequest', 'WebSocket'];
  for (const f of files) {
    const src = fs.readFileSync(path.join(MODULE_DIR, f), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    for (const bad of banned) assert(!src.includes(bad), `${f} must not use "${bad}"`);
    assert(!/^\s*import\s/m.test(src) && !/\bimport\(/.test(src), `${f} must be CommonJS (no ESM import)`);
    for (const m of src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      assert(m[1].startsWith('./'), `${f}: require('${m[1]}') is not a sibling './' path`);
    }
  }
});

t('ADR 0015: the module hard-codes no pubkey — both stamp pubkeys are parameters', () => {
  if (!fs.existsSync(MODULE_DIR)) throw new Error('src/lib/tagging-edges/ does not exist yet');
  for (const f of fs.readdirSync(MODULE_DIR).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(MODULE_DIR, f), 'utf-8');
    assert(!/[0-9a-f]{64}/i.test(src), `${f} contains a 64-hex literal`);
  }
});

// ─── AC-5: BIBLE says what a tagging edge is ───
/** The text from the heading matching startRe up to (not including) the next line matching endRe. */
function bibleSection(startRe, endRe) {
  const text = fs.readFileSync(BIBLE, 'utf-8');
  const start = text.search(startRe);
  assert(start >= 0, `BIBLE.md: no section matching ${startRe}`);
  return untilNext(text.slice(start), endRe);
}
function untilNext(fromHeading, endRe) {
  const nl = fromHeading.indexOf('\n');
  if (nl < 0) return fromHeading;
  const body = fromHeading.slice(nl + 1);
  const end = body.search(endRe);
  return end < 0 ? fromHeading : fromHeading.slice(0, nl + 1 + end);
}

t('AC-5: BIBLE §6 has a Social Graph Relationships subsection after Infrastructure', () => {
  const s6 = bibleSection(/^## 6\. /m, /^## 7\. /m);
  const infra = s6.indexOf('#### Infrastructure');
  const social = s6.indexOf('#### Social Graph Relationships (NostrUser → NostrUser)');
  assert(infra >= 0, '§6 lost its "#### Infrastructure" heading');
  assert(social > infra, '§6 needs "#### Social Graph Relationships (NostrUser → NostrUser)" after "#### Infrastructure"');
});

function socialSubsection() {
  const s6 = bibleSection(/^## 6\. /m, /^## 7\. /m);
  const i = s6.indexOf('#### Social Graph Relationships (NostrUser → NostrUser)');
  assert(i >= 0, 'no Social Graph Relationships subsection in §6');
  return untilNext(s6.slice(i), /^#{2,4} /m);
}

t('AC-5: the subsection names FOLLOWS, MUTES, REPORTS and TAGS with direction and source kind — the first three by those only', () => {
  const s = socialSubsection();
  const lines = s.split('\n');
  for (const [rel, kind] of [['FOLLOWS', '3'], ['MUTES', '10000'], ['REPORTS', '1984'], ['TAGS', '39999']]) {
    const line = lines.find((l) => new RegExp(`\\b${rel}\\b`).test(l) && new RegExp(`\\b${kind}\\b`).test(l));
    assert(line, `a line naming ${rel} with source kind ${kind}`);
    assert(/NostrUser\s*(→|->)\s*NostrUser/.test(line), `${rel}'s own line states its direction (NostrUser → NostrUser)`);
    if (rel !== 'TAGS') {
      assert(!/timestamp|report_type/.test(line), `${rel} is documented by direction and source kind only — no properties`);
    }
  }
  assert(/nostr-user-tag/.test(s), 'TAGS\' source names the nostr-user-tag stamp');
});

t('AC-5: the subsection gives TAGS\' identity, every property, the absent-stance rule, the standing and revoke rules, and read-time POV', () => {
  const s = socialSubsection();
  for (const prop of ['address', 'eventId', 'createdAt', 'polarity', 'tagAddress', 'tagEventId', 'tagSlug', 'zCanonical', 'zLocal']) {
    assert(s.includes(`\`${prop}\``), `property \`${prop}\` documented`);
  }
  assert(/absent[^\n]*apply/i.test(s), 'says an absent stance counts as apply');
  assert(s.includes('coalesce(toFloat(r.polarity), 1.0)'), 'gives graph readers the bucketing expression');
  assert(/NIP-01|lower[^\n]{0,40}\bid\b/i.test(s), 'states the standing rule (newer wins; ties to the lower id)');
  assert(/kind[- ]?5|NIP-09/i.test(s) && /tagger|same author|its author/i.test(s), 'states the revoke rule (only the tagger\'s kind-5)');
  assert(/\bdifferent (person|target)\b|\bmoves (the relationship|it) to\b/i.test(s), 'states that a newer version naming another person moves the relationship');
  assert(/no trust/i.test(s) && /read time/i.test(s), 'says it is a raw assertion — no trust or counts; POV applied at read time');
  assert(/event-projection/i.test(s), 'names its §30 class (event-projection)');
  assert(s.includes('src/lib/tagging-edges') && s.includes('tagging-edges/0001'), 'points to src/lib/tagging-edges/ and this ADR');
});

t('AC-5: the docs say plainly that no pipeline writes TAGS yet', () => {
  assert(/no pipeline writes `?TAGS`? yet/i.test(socialSubsection()), 'the subsection says "no pipeline writes TAGS yet"');
});

t('AC-5: the glossary tells TAGS apart from HAS_TAG and NostrEventTag', () => {
  const g = bibleSection(/^## 21\. Glossary/m, /^## 22\. /m);
  const row = g.split('\n').find((l) => /^\|\s*\*\*`?TAGS`?/.test(l));
  assert(row, 'a glossary row for TAGS');
  assert(row.includes('HAS_TAG') && row.includes('NostrEventTag'), 'the TAGS row distinguishes HAS_TAG and NostrEventTag');
});

t('AC-5: BIBLE\'s Last updated line records this change', () => {
  const line = fs.readFileSync(BIBLE, 'utf-8').split('\n').find((l) => l.startsWith('**Last updated:**'));
  assert(line && /tagging-edges|\bTAGS\b/.test(line), 'the Last updated line names the TAGS / tagging-edges change');
});

t('AC-5: §30\'s coverage status line lists TAGS among the social edges derivers do not cover', () => {
  const s30 = bibleSection(/^## 30\. /m, /^## 31\. /m);
  const line = s30.split('\n').find((l) => l.includes('today\'s derivers cover only concept-graph labels'));
  assert(line, '§30 coverage status line present');
  assert(/\bTAGS\b/.test(line), '§30 coverage status line names TAGS');
});

async function run() {
  console.log('\n--- tagging edge contract tests (epic tagging-edges, Story 1) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ntagging-edge-contract: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
