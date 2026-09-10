/**
 * Tests for Story 2 (epic: dlist-item-tagging) — addressable-target assertion `d`-tag.
 *
 * Story: engineering-team/stories/dlist-item-tagging/2-addressable-target-dtag-collision.md
 * ADR:   engineering-team/decisions/dlist-item-tagging/0001-addressable-target-dtag.md (Accepted)
 * Wire:  protocols/drafts/event-taggings.md § "The assertion d-tag (normative)"
 *
 * The old rule took `<target8>` for an `a` target from the coordinate's AUTHOR
 * segment, so every addressable event by one author collapsed to one replaceable
 * address per (asserter, tag). The new rule (ADR 0001, Decision):
 *
 *   d = event-tag-<slug>-<author8>-<d16>-<hash8>-<asserter8>
 *
 *   author8 = coord author-pubkey segment, first 8 hex        (readable decoration)
 *   d16     = coord `d` segment (everything after the 2nd ':'), first 16 chars, verbatim
 *   hash8   = first 8 hex of SHA-256 over the FULL coordinate string as carried in the `a` tag
 *             — the ONLY segment that carries uniqueness; INJECTED (the core ships no hashing)
 *   e-target rule is UNCHANGED: event-tag-<slug>-<id8>-<asserter8>
 *
 * Intentionally failing until the builder/orchestrator/spec land (red phase).
 * The core is require()d LAZILY inside each test so loading this suite cannot
 * crash test/test.js's require phase. Pure construction only: the hash is a
 * node:crypto closure supplied BY THE TEST (the ADR's "direct caller" lane).
 */

const fs = require('fs');
const path = require('path');
const { createHash } = require('node:crypto');

const REPO_ROOT = path.join(__dirname, '..');
const CORE_REQUIRE = '../src/lib/event-tagging';
const SPEC = 'protocols/drafts/event-taggings.md';
const README = 'protocols/README.md';

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function jsonEq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}\n        expected: ${e}\n        actual:   ${a}`);
}
function load() {
  try { return require(CORE_REQUIRE); }
  catch (e) { throw new Error(`event-tagging core not loadable (require('${CORE_REQUIRE}') failed: ${e.message})`); }
}
function read(rel) {
  const p = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(p)) throw new Error(`${rel} does not exist`);
  return fs.readFileSync(p, 'utf-8');
}
function dOf(ev) { const t = (ev.tags || []).find((x) => x[0] === 'd'); return t ? t[1] : null; }
function tagVal(ev, name) { const t = (ev.tags || []).find((x) => x[0] === name); return t ? t[1] : null; }

/** The house hash8 convention (src/lib/dtag.js): first 8 hex of SHA-256 over the UTF-8 bytes. */
function hash8(str) { return createHash('sha256').update(str, 'utf8').digest('hex').slice(0, 8); }

// ─── fixtures ───
const TA      = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833'; // canonical namespace
const LOCAL   = '5555555555555555555555555555555555555555555555555555555555555555'; // local namespace
const JACK    = '1111111111111111111111111111111111111111111111111111111111111111'; // header author
const ALICE   = '2222222222222222222222222222222222222222222222222222222222222222'; // asserter #1
const BOB     = '3333333333333333333333333333333333333333333333333333333333333333'; // asserter #2
const NOTE_ID = '4444444444444444444444444444444444444444444444444444444444444444'; // kind-1 note id
// The real `github-accounts` list author (the collision case that motivated the story).
const GH_AUTHOR = 'b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450';
const ITEM_VCAVALLO = `39999:${GH_AUTHOR}:vcavallo-1i6dn0p`; // d is exactly 16 chars
const ITEM_ABURRA16 = `39999:${GH_AUTHOR}:aburra16-io3q45`;  // d is 15 chars
// Worked values from ADR 0001 § Consequences (re-verified with node:crypto in the test plan).
const HASH_VCAVALLO = '086cb8ff';
const HASH_ABURRA16 = '878ce18a';
const SLUG = 'white-hat-hacker';

function buildA({ address, slug = SLUG, asserter = ALICE, polarity = 1, h = hash8 } = {}) {
  const c = load();
  return c.buildEventTaggingAssertion({
    headerAuthorPubkey: JACK, slug, target: { address }, polarity, asserterPubkey: asserter, taPubkeys: [TA, LOCAL], hash8: h,
  });
}

/** Fake orchestrator deps; records every call so ordering/absence can be asserted. */
function makeDeps({ hash8Impl } = {}) {
  const rec = { findHeaders: 0, signed: [], published: [], hashCalls: [] };
  const deps = {
    findHeaders: async () => { rec.findHeaders += 1; return [{ author: JACK }]; },
    sign: async (u) => { const ev = { ...u, id: 'f'.repeat(64), sig: '0'.repeat(128) }; rec.signed.push(ev); return ev; },
    publish: async (ev) => { rec.published.push(ev); return { local: { success: true } }; },
    now: () => 1700000000,
  };
  if (hash8Impl !== undefined) {
    deps.hash8 = (s) => { rec.hashCalls.push(s); return hash8Impl(s); };
  }
  return { deps, rec };
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ─────────────────────────── AC-1 / AC-6: the collision is gone ─────────────────────────── */

t('AC-1: two addressable targets by the SAME author with different d yield DIFFERENT assertion d-tags', () => {
  const a = buildA({ address: ITEM_VCAVALLO });
  const b = buildA({ address: ITEM_ABURRA16 });
  assert(dOf(a) !== dOf(b),
    `same asserter + same tag on two same-author items must NOT share an address (old rule collapsed both to event-tag-${SLUG}-b83a28b7-22222222); got ${dOf(a)} for both`);
  // The a tag is still the authoritative target and is untouched by the rule change.
  assert(tagVal(a, 'a') === ITEM_VCAVALLO && tagVal(b, 'a') === ITEM_ABURRA16, 'the a tag must still carry the full coordinate verbatim');
});

t('AC-1 (worked example): d = event-tag-<slug>-<author8>-<d16>-<hash8>-<asserter8> with the ADR fixtures 086cb8ff / 878ce18a', () => {
  const a = buildA({ address: ITEM_VCAVALLO });
  const b = buildA({ address: ITEM_ABURRA16 });
  jsonEq(dOf(a), `event-tag-${SLUG}-b83a28b7-vcavallo-1i6dn0p-${HASH_VCAVALLO}-22222222`, 'vcavallo item d (d16 = full 16-char d)');
  jsonEq(dOf(b), `event-tag-${SLUG}-b83a28b7-aburra16-io3q45-${HASH_ABURRA16}-22222222`, 'aburra16 item d (d16 = the whole 15-char d, verbatim)');
});

t('AC-1 (full tag shape): the rest of the assertion is unchanged — a, dual concept-z, header z, polarity', () => {
  const ev = buildA({ address: ITEM_VCAVALLO, polarity: -1 });
  jsonEq(Object.keys(ev).sort(), ['content', 'kind', 'tags'], 'assertion must still be exactly {kind,tags,content}');
  jsonEq(ev.tags, [
    ['d', `event-tag-${SLUG}-b83a28b7-vcavallo-1i6dn0p-${HASH_VCAVALLO}-22222222`],
    ['a', ITEM_VCAVALLO],
    ['z', `39998:${TA}:nostr-event-tag`],
    ['z', `39998:${LOCAL}:nostr-event-tag`],
    ['z', `39999:${JACK}:tagging:${SLUG}-tagging`],
    ['polarity', '-1'],
  ], 'only the d value changes; tag order and every other tag are as before');
});

/* ─────────────────────────── AC-2: still deterministic ─────────────────────────── */

t('AC-2: the same (tag, target, asserter) built twice yields the SAME d (republishing still replaces)', () => {
  const a = buildA({ address: ITEM_VCAVALLO, polarity: 1 });
  const b = buildA({ address: ITEM_VCAVALLO, polarity: -1 }); // a flip lands at the same address
  assert(dOf(a) === dOf(b), `apply and dispute of the same stance must share one d, got ${dOf(a)} vs ${dOf(b)}`);
  jsonEq(buildA({ address: ITEM_VCAVALLO }), buildA({ address: ITEM_VCAVALLO }), 'deep-equal output for equal inputs');
});

t('AC-2 (asserter isolation): a different asserter on the same target gets a different d that differs ONLY in asserter8', () => {
  const alice = dOf(buildA({ address: ITEM_VCAVALLO, asserter: ALICE }));
  const bob = dOf(buildA({ address: ITEM_VCAVALLO, asserter: BOB }));
  assert(alice !== bob, 'two asserters must not share an address');
  assert(alice.slice(0, -8) === bob.slice(0, -8), `everything before asserter8 must be identical (target-derived), got ${alice} vs ${bob}`);
  assert(alice.endsWith('-22222222') && bob.endsWith('-33333333'), 'asserter8 remains the trailing segment');
});

/* ─────────────────────────── AC-3: e targets byte-identical to today ─────────────────────────── */

t('AC-3: an e target keeps event-tag-<slug>-<id8>-<asserter8> — with or without a hash8 supplied', () => {
  const c = load();
  const base = { headerAuthorPubkey: JACK, slug: 'awesome-tag', target: { id: NOTE_ID }, polarity: 1, asserterPubkey: ALICE, taPubkeys: [TA, LOCAL] };
  const without = c.buildEventTaggingAssertion(base);
  const withHash = c.buildEventTaggingAssertion({ ...base, hash8 });
  jsonEq(dOf(without), 'event-tag-awesome-tag-44444444-22222222', 'e-target d without hash8 (the pre-story shape, verbatim)');
  jsonEq(withHash, without, 'supplying hash8 must not change an e-target assertion in any byte');
  jsonEq(withHash.tags[1], ['e', NOTE_ID], 'e tag untouched');
});

t('AC-3: hash8 is NOT consulted for an e target (the dep is only touched on the a branch)', () => {
  const c = load();
  let calls = 0;
  c.buildEventTaggingAssertion({
    headerAuthorPubkey: JACK, slug: 'awesome-tag', target: { id: NOTE_ID }, polarity: 1, asserterPubkey: ALICE, taPubkeys: [TA],
    hash8: (s) => { calls += 1; return hash8(s); },
  });
  assert(calls === 0, `hash8 must not be called for an e target, called ${calls}×`);
});

/* ─────────────────────────── the hash contract ─────────────────────────── */

t('hash8 receives the FULL coordinate string exactly as placed in the a tag (no trimming/normalizing), exactly once', () => {
  const address = `30023:${GH_AUTHOR}:https://tomgruber.org/writing/ontology-of-folksonomy.htm-1778765623`;
  const seen = [];
  const ev = buildA({ address, h: (s) => { seen.push(s); return hash8(s); } });
  jsonEq(seen, [address], 'hash8 must be called once with the untouched coordinate');
  assert(tagVal(ev, 'a') === address, 'the a tag carries the same string the hash covered');
});

t('hash8 segment in d equals the caller-supplied value verbatim (the core does not re-hash or post-process it)', () => {
  const ev = buildA({ address: ITEM_VCAVALLO, h: () => 'deadbeef' });
  jsonEq(dOf(ev), `event-tag-${SLUG}-b83a28b7-vcavallo-1i6dn0p-deadbeef-22222222`, 'd embeds the injected 8-hex as-is');
});

/* ─────────────────────────── edge cases on the d16 slice ─────────────────────────── */

t('edge: a coordinate d containing colons — d16 is taken from EVERYTHING after the second colon, and the hash covers the whole coordinate', () => {
  const address = `30023:${GH_AUTHOR}:https://tomgruber.org/writing/ontology-of-folksonomy.htm-1778765623`;
  const ev = buildA({ address, slug: 'folksonomy' });
  // d segment = "https://tomgruber.org/writing/…" → first 16 chars = "https://tomgrube"
  jsonEq(dOf(ev), `event-tag-folksonomy-b83a28b7-https://tomgrube-${hash8(address)}-22222222`, 'd16 spans the colon inside the URL-ish d');
});

t('edge: a coordinate d shorter than 16 chars is used verbatim (no padding)', () => {
  const address = `39999:${GH_AUTHOR}:good-tag`;
  const ev = buildA({ address, slug: 'awesome-tag' });
  jsonEq(dOf(ev), `event-tag-awesome-tag-b83a28b7-good-tag-${hash8(address)}-22222222`, '8-char d → 8-char d16');
});

t('edge: a coordinate d longer than 16 chars is truncated to exactly the first 16 chars', () => {
  const address = `39999:${GH_AUTHOR}:a-really-long-item-d-tag-that-keeps-going-1a2b3c4d`;
  const ev = buildA({ address, slug: 'awesome-tag' });
  jsonEq(dOf(ev), `event-tag-awesome-tag-b83a28b7-a-really-long-it-${hash8(address)}-22222222`, 'd16 = first 16 chars');
});

t('edge: an EMPTY coordinate d yields an empty d16 (…-<author8>--<hash8>-…) and is still a valid, unique d', () => {
  const address = `30023:${GH_AUTHOR}:`;
  const ev = buildA({ address, slug: 'awesome-tag' });
  jsonEq(dOf(ev), `event-tag-awesome-tag-b83a28b7--${hash8(address)}-22222222`, 'empty d16 leaves a double hyphen');
  // And it must not collide with a sibling that has a d.
  assert(dOf(ev) !== dOf(buildA({ address: `30023:${GH_AUTHOR}:x`, slug: 'awesome-tag' })), 'empty-d and one-char-d targets must differ');
});

t('edge: two coordinates sharing author AND the first 16 chars of d (but differing later) still get different d-tags (uniqueness lives in hash8)', () => {
  const a = buildA({ address: `39999:${GH_AUTHOR}:same-prefix-here-AAAA` });
  const b = buildA({ address: `39999:${GH_AUTHOR}:same-prefix-here-BBBB` });
  assert(dOf(a).slice(0, -18) === dOf(b).slice(0, -18), 'author8 and d16 decoration are identical for the pair (sanity)');
  assert(dOf(a) !== dOf(b), `identical decoration must still yield distinct d via hash8, got ${dOf(a)} for both`);
});

t('edge: two coordinates differing only in KIND (same author, same d) get different d-tags', () => {
  const a = buildA({ address: `30023:${GH_AUTHOR}:foo` });
  const b = buildA({ address: `39999:${GH_AUTHOR}:foo` });
  assert(dOf(a) !== dOf(b), `kind participates in the hash; got ${dOf(a)} for both`);
});

/* ─────────────────────────── recursion: tagging a tagging ─────────────────────────── */

t('recursion: tagging a tagging — d16 is event-tag-white- (16 chars, trailing hyphen kept) and the length is FLAT vs depth 1 for the same slug', () => {
  // Alice's depth-1 assertion is itself a kind-39999 addressable → Bob can target it.
  const aliceAssertion = buildA({ address: ITEM_VCAVALLO, asserter: ALICE });
  const aliceCoord = `39999:${ALICE}:${dOf(aliceAssertion)}`;
  jsonEq(aliceCoord, `39999:${ALICE}:event-tag-${SLUG}-b83a28b7-vcavallo-1i6dn0p-${HASH_VCAVALLO}-22222222`, 'sanity: alice coord per ADR');

  const depth2 = buildA({ address: aliceCoord, slug: 'disputed-claim', asserter: BOB, polarity: -1 });
  jsonEq(dOf(depth2), `event-tag-disputed-claim-22222222-event-tag-white--${hash8(aliceCoord)}-33333333`, 'depth-2 d per ADR (author8 = alice8, d16 = "event-tag-white-", double hyphen)');

  // Flat length: a depth-1 assertion with the same slug against a target whose d is >= 16 chars.
  const depth1 = buildA({ address: ITEM_VCAVALLO, slug: 'disputed-claim', asserter: BOB, polarity: -1 });
  assert(dOf(depth1).length === dOf(depth2).length,
    `d length must not grow with nesting depth: depth1=${dOf(depth1).length} depth2=${dOf(depth2).length}`);
  // Bound from ADR: slug + 54 chars.
  assert(dOf(depth2).length === 'disputed-claim'.length + 54, `worst-case length must be slug+54, got ${dOf(depth2).length}`);
});

/* ─────────────────────────── fail-loud guards ─────────────────────────── */

t('fail loud: an a target with NO hash8 throws (never silently mints a collidable address)', () => {
  let err = null;
  try { buildA({ address: ITEM_VCAVALLO, h: undefined }); } catch (e) { err = e; }
  assert(err, 'must throw');
  assert(/hash8/.test(err.message), `error must name the missing dep (hash8), got: ${err.message}`);
});

t('fail loud: a non-function hash8 (string / object) on an a target throws', () => {
  for (const bad of ['deadbeef', {}, 42, null]) {
    let threw = false;
    try { buildA({ address: ITEM_VCAVALLO, h: bad }); } catch { threw = true; }
    assert(threw, `hash8=${JSON.stringify(bad)} must throw (not a function)`);
  }
});

t('fail loud: hash8 returning anything other than exactly 8 lowercase hex chars throws', () => {
  for (const bad of ['DEADBEEF', 'deadbee', 'deadbeef0', 'zzzzzzzz', '', undefined, null, 12345678]) {
    let threw = false;
    try { buildA({ address: ITEM_VCAVALLO, h: () => bad }); } catch { threw = true; }
    assert(threw, `hash8 result ${JSON.stringify(bad)} must be rejected (need /^[0-9a-f]{8}$/)`);
  }
});

t('fail loud: a hash8 that throws propagates (the builder does not swallow it)', () => {
  let err = null;
  try { buildA({ address: ITEM_VCAVALLO, h: () => { throw new Error('digest unavailable'); } }); } catch (e) { err = e; }
  assert(err && /digest unavailable/.test(err.message), `the supplier's error must surface, got: ${err && err.message}`);
});

/* ─────────────────────────── orchestrator: applyEventTagging + deps.hash8 ─────────────────────────── */

t('orchestrator: applyEventTagging WITHOUT deps.hash8 throws at entry — even for an e target — before findHeaders, sign, or publish', async () => {
  const c = load();
  const { deps, rec } = makeDeps(); // no hash8
  let err = null;
  try {
    await c.applyEventTagging({ tagInput: { authorPubkey: JACK, slug: SLUG }, target: { id: NOTE_ID }, polarity: 1, asserterPubkey: ALICE, taPubkeys: [TA, LOCAL], deps });
  } catch (e) { err = e; }
  assert(err, 'must throw when deps.hash8 is missing');
  assert(/hash8/.test(err.message), `entry error must name hash8, got: ${err.message}`);
  assert(rec.findHeaders === 0 && rec.signed.length === 0 && rec.published.length === 0,
    `must fail before any discovery/sign/publish (findHeaders=${rec.findHeaders}, signed=${rec.signed.length}, published=${rec.published.length})`);
});

t('orchestrator: an ASYNC deps.hash8 (browser SubtleCrypto shape) is awaited and its value lands in the assertion d', async () => {
  const c = load();
  const { deps, rec } = makeDeps({ hash8Impl: async (s) => { await new Promise((r) => setImmediate(r)); return hash8(s); } });
  const out = await c.applyEventTagging({ tagInput: { authorPubkey: JACK, slug: SLUG }, target: { address: ITEM_VCAVALLO }, polarity: 1, asserterPubkey: ALICE, taPubkeys: [TA, LOCAL], deps });
  assert(out.sequence === 'a' && rec.published.length === 1, 'existing header → one assertion published');
  jsonEq(dOf(rec.published[0]), `event-tag-${SLUG}-b83a28b7-vcavallo-1i6dn0p-${HASH_VCAVALLO}-22222222`, 'assertion d via async hash8');
  jsonEq(out.published[0].address, `39999:${ALICE}:event-tag-${SLUG}-b83a28b7-vcavallo-1i6dn0p-${HASH_VCAVALLO}-22222222`, 'reported address uses the new d');
  jsonEq(rec.hashCalls, [ITEM_VCAVALLO], 'hash8 resolved exactly once, up front, over the full coordinate');
});

t('orchestrator: a SYNC deps.hash8 (server node:crypto shape) works identically', async () => {
  const c = load();
  const { deps, rec } = makeDeps({ hash8Impl: hash8 });
  await c.applyEventTagging({ tagInput: { authorPubkey: JACK, slug: SLUG }, target: { address: ITEM_ABURRA16 }, polarity: 1, asserterPubkey: ALICE, taPubkeys: [TA, LOCAL], deps });
  jsonEq(dOf(rec.published[0]), `event-tag-${SLUG}-b83a28b7-aburra16-io3q45-${HASH_ABURRA16}-22222222`, 'assertion d via sync hash8');
});

t('orchestrator (AC-1 end-to-end): tagging two same-author DList items lands at two DIFFERENT addresses', async () => {
  const c = load();
  const run = async (address) => {
    const { deps } = makeDeps({ hash8Impl: hash8 });
    const out = await c.applyEventTagging({ tagInput: { authorPubkey: JACK, slug: SLUG }, target: { address }, polarity: 1, asserterPubkey: ALICE, taPubkeys: [TA, LOCAL], deps });
    return out.published[0].address;
  };
  const a1 = await run(ITEM_VCAVALLO);
  const a2 = await run(ITEM_ABURRA16);
  assert(a1 !== a2, `second item must not replace the first: ${a1} === ${a2}`);
});

t('orchestrator: an e target with deps.hash8 present does not call it, and its d is byte-identical to today', async () => {
  const c = load();
  const { deps, rec } = makeDeps({ hash8Impl: hash8 });
  await c.applyEventTagging({ tagInput: { authorPubkey: JACK, slug: 'awesome-tag' }, target: { id: NOTE_ID }, polarity: 1, asserterPubkey: ALICE, taPubkeys: [TA, LOCAL], deps });
  jsonEq(rec.hashCalls, [], 'no hash for an e target');
  jsonEq(dOf(rec.published[0]), 'event-tag-awesome-tag-44444444-22222222', 'e-target d unchanged through the orchestrator');
});

t('orchestrator: a deps.hash8 that resolves to a non-8-hex value fails BEFORE signing (no orphan signed event)', async () => {
  const c = load();
  const { deps, rec } = makeDeps({ hash8Impl: async () => 'NOPE' });
  let threw = false;
  try {
    await c.applyEventTagging({ tagInput: { authorPubkey: JACK, slug: SLUG }, target: { address: ITEM_VCAVALLO }, polarity: 1, asserterPubkey: ALICE, taPubkeys: [TA, LOCAL], deps });
  } catch { threw = true; }
  assert(threw, 'a bad hash8 result must throw');
  assert(rec.signed.length === 0 && rec.published.length === 0, 'nothing may be signed or published when the hash is invalid');
});

/* ─────────────────────────── purity: the core still ships no hashing ─────────────────────────── */

t('purity: builders.js and apply.js still contain no "crypto" token and require only siblings (the hash is injected, not shipped)', () => {
  const dir = path.join(REPO_ROOT, 'src/lib/event-tagging');
  for (const f of ['builders.js', 'apply.js']) {
    const src = fs.readFileSync(path.join(dir, f), 'utf-8');
    assert(!src.includes('crypto'), `${f} must not mention "crypto" (write "SHA-256 digest"/"hash8" in comments)`);
    const reqs = [...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
    for (const r of reqs) assert(r.startsWith('./'), `${f}: require('${r}') must be a sibling`);
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
  assert(!files.some((f) => /sha|hash/i.test(f)), `no hash module may be added to the core (found: ${files.filter((f) => /sha|hash/i.test(f)).join(', ')})`);
});

/* ─────────────────────────── AC-4: the spec ─────────────────────────── */

function dTagSection(src) {
  const m = src.match(/^## The assertion d-tag \(normative\)\s*$([\s\S]*?)(?=^## )/m);
  if (!m) throw new Error(`${SPEC} must keep the section heading "## The assertion d-tag (normative)"`);
  return m[1];
}

t('AC-4 (spec): the d-tag section states the five-segment a-target rule with hash8 = SHA-256 over the full coordinate', () => {
  const sec = dTagSection(read(SPEC));
  assert(/author8/.test(sec) && /d16/.test(sec) && /hash8/.test(sec), 'section must name the author8 / d16 / hash8 segments');
  assert(/SHA-?256/i.test(sec), 'section must say the hash is SHA-256');
  assert(/first 8|8 (lowercase )?hex/i.test(sec), 'section must say "first 8 hex" of the digest');
  assert(/full coordinate|<kind>:<author>:<d>/.test(sec), 'section must say the hash covers the full <kind>:<author>:<d> coordinate');
  assert(/first 16|16 char/i.test(sec), 'section must define d16 as the first 16 characters of the coordinate d');
  assert(/event-tag-<(slug|descriptor)>-<author8>-<d16>-<hash8>-<asserter8>/.test(sec),
    'section must show the literal five-segment form event-tag-<slug>-<author8>-<d16>-<hash8>-<asserter8>');
  assert(/event-tag-<(slug|descriptor)>-<(id8|target8)>-<asserter8>/.test(sec) || /event id/i.test(sec),
    'section must keep the e-target sentence (first 8 of the event id)');
  assert(/tagging:<slug>-tagging/.test(sec), 'section must keep the header d sentence');
});

t('AC-4 (spec): readers MUST NOT parse d; the a/e tag is authoritative for the target', () => {
  const sec = dTagSection(read(SPEC));
  assert(/MUST NOT parse/i.test(sec), 'section must contain the normative "MUST NOT parse" sentence');
  assert(/authoritative/i.test(sec), 'section must state the a (or e) tag is authoritative for the target');
});

t('AC-4 (spec): the old author-segment rule is recorded as superseded on 2026-09-10 with the compatibility posture', () => {
  const sec = dTagSection(read(SPEC));
  assert(/superseded/i.test(sec) && /2026-09-10/.test(sec), 'section must carry a dated "Superseded 2026-09-10" note');
  assert(/author-pubkey segment|author segment/i.test(sec), 'the superseded note must identify the old rule (author-pubkey segment)');
  assert(/remain valid|still valid|stay valid/i.test(sec), 'section must state that old-rule assertions remain valid');
  assert(/not replaced|are not replaced|orphan/i.test(sec), 'section must state that re-assertions under the new rule do not replace old-rule events');
  // The old rule must no longer be presented as THE rule for a targets.
  assert(!/`<coord>\.split\(":"\)\[1\]\[0:8\]`/.test(sec.replace(/superseded[\s\S]*/i, '')),
    'the old split-on-author expression may only appear inside the superseded note, not as the live rule');
});

t('AC-4 (spec): the worked github-accounts example values appear (086cb8ff / 878ce18a) and the spec still hardcodes no 64-hex pubkey', () => {
  const src = read(SPEC);
  const sec = dTagSection(src);
  assert(sec.includes(HASH_VCAVALLO) && sec.includes(HASH_ABURRA16), 'section should carry the two worked hash8 values so a third party can self-check');
  const m = src.match(/[0-9a-f]{64}/);
  assert(!m, `spec must elide the example author (e.g. b83a28b7…) — found a literal 64-hex: ${m && m[0]}`);
});

t('AC-4 (protocols/README.md): the Event Taggings status row names dlist-item-tagging #2', () => {
  const src = read(README);
  const row = src.split('\n').find((l) => /Event Taggings/.test(l) && /event-taggings\.md/.test(l));
  assert(row, 'README must still index the Event Taggings spec');
  assert(/dlist-item-tagging/.test(row) && /#\s?2/.test(row), `the Event Taggings row must append "dlist-item-tagging #2" to its Story column, got: ${row}`);
});

async function run() {
  console.log('\n--- event-tagging a-target d-tag tests (epic dlist-item-tagging, Story 2) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\nevent-tagging-a-target-dtag: ${pass} passed, ${fail} failed`);
  return { pass, fail, skipped: 0, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
