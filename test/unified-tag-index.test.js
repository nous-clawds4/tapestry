/**
 * Tests for Story 9 (epic: event-tagging) — unified tag index (notes + profiles).
 *
 * Story: engineering-team/stories/event-tagging/9-unified-tag-index-notes-and-profiles.md
 * ADR:   engineering-team/decisions/event-tagging/0009-unified-taggings-normalization.md
 * Design: engineering-team/designs/unified-taggings.md
 *
 * The crux is a PURE read-time normalization core (no protocol/write change,
 * dependency-free so the SDK inherits it, opinionated LOCAL aggregation):
 *
 *   normalizeTaggings({ assertions, headers, members, honoredAuthorities })
 *     -> Tagging[] = [{ tag:{authorPubkey,slug}, target:{type,ref}, stance:'apply'|'dispute',
 *                       asserter, eventId, createdAt }]
 *   indexByTag(taggings, { isAsserterTrusted, viewerPubkey })
 *     -> rows keyed by the tag COORDINATE, counts across ALL target types + `mine`.
 *
 * `nostr-user-tag` (profiles) and `nostr-event-tag` (notes) are the first two
 * registry members; a future type joins by registering ONE member (proven below).
 * Per ADR 0009 all ACs land here; the Tags.jsx UI is verified manually (operator).
 *
 * Row contract asserted here:
 *   row = { tag:{authorPubkey,slug}, applications, disputes,   // POV-counted totals across types
 *           byType: { profile:{applications,disputes}, event:{...}, ... },
 *           mine: 'apply'|'dispute'|null }
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const CORE = '../src/lib/event-tagging';
const API_INDEX = path.join(REPO, 'src/api/index.js');
const BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { if (!fs.existsSync(p)) throw new Error(`${p} does not exist`); return fs.readFileSync(p, 'utf8'); }
function core() { return require(CORE); }
function normalize() {
  const c = core();
  if (typeof c.normalizeTaggings !== 'function') throw new Error('normalizeTaggings not implemented/exported in src/lib/event-tagging');
  return c.normalizeTaggings;
}
function index() {
  const c = core();
  if (typeof c.indexByTag !== 'function') throw new Error('indexByTag not implemented/exported in src/lib/event-tagging');
  return c.indexByTag;
}

// ─── fixtures ───
const AUTH_A  = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833'; // honored authority
const AUTH_B  = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'; // un-honored
const JACK    = '1111111111111111111111111111111111111111111111111111111111111111'; // tag author / header author
const ALICE   = '2222222222222222222222222222222222222222222222222222222222222222'; // trusted asserter
const BOB     = '3333333333333333333333333333333333333333333333333333333333333333'; // untrusted asserter
const VIEWER  = '7777777777777777777777777777777777777777777777777777777777777777'; // logged-in viewer
const PROFILE = '4444444444444444444444444444444444444444444444444444444444444444'; // a profile being tagged
const NOTE1   = 'a1'.repeat(32);

const HON = [AUTH_A];

// nostr-user-tag (profile) assertion — direct `a` tag ref + `p` target (wire per publishProfileTag.js).
function userTag({ asserter = ALICE, tagAuthor = JACK, slug, target = PROFILE, polarity = '1', authority = AUTH_A, id, created_at = 2000 } = {}) {
  return {
    id: id || `u_${asserter.slice(0, 4)}_${slug}_${polarity}`,
    pubkey: asserter, created_at,
    tags: [
      ['d', `profile-tag-${slug}-${target.slice(0, 8)}-${asserter.slice(0, 8)}`],
      ['p', target],
      ['a', `39999:${tagAuthor}:${slug}`],
      ['e', `evid-${tagAuthor}-${slug}`],
      ['z', `39998:${authority}:nostr-user-tag`],
      ['polarity', String(polarity)],
    ],
  };
}

// nostr-event-tag (note) assertion — target `e`, tag via descriptor → header.
function eventTag({ asserter = ALICE, headerAuthor = JACK, slug, target = { id: NOTE1 }, polarity = '1', authority = AUTH_A, id, created_at = 2000 } = {}) {
  const tags = [
    ['d', `event-tag-${slug}-${(target.id || target.address || '').slice(0, 8)}-${asserter.slice(0, 8)}`],
    ['z', `39998:${authority}:nostr-event-tag`],
    ['z', `39999:${headerAuthor}:tagging:${slug}-tagging`],
    ['polarity', String(polarity)],
  ];
  if (target.id) tags.push(['e', target.id]); else if (target.address) tags.push(['a', target.address]);
  return { id: id || `e_${asserter.slice(0, 4)}_${slug}_${polarity}`, pubkey: asserter, created_at, tags };
}

// the tagging header event-tag needs, naming tag 39999:<tagAuthor>:<slug>.
function header({ headerAuthor = JACK, tagAuthor = JACK, slug, authority = AUTH_A } = {}) {
  return {
    id: `h_${headerAuthor.slice(0, 4)}_${slug}`, pubkey: headerAuthor, created_at: 1000,
    tags: [
      ['d', `tagging:${slug}-tagging`],
      ['z', `39998:${authority}:tagging-with-specific-tag`],
      ['a', `39999:${tagAuthor}:${slug}`],
    ],
  };
}

const ALL_TRUSTED = () => true;
const TRUST_ONLY = (...pks) => (pk) => pks.includes(pk);

function rowFor(rows, slug, author = JACK) {
  return (rows || []).find((r) => r.tag && r.tag.slug === slug && r.tag.authorPubkey === author);
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// ─── normalizeTaggings: both members → one tuple ───

t('normalize: a nostr-user-tag assertion → {target.type=profile, tag coordinate, stance}', () => {
  const n = normalize();
  const out = n({ assertions: [userTag({ slug: 'climate' })], headers: [], honoredAuthorities: HON });
  assert(out.length === 1, `expected 1 normalized tagging, got ${out.length}`);
  const tg = out[0];
  assert(tg.tag.authorPubkey === JACK && tg.tag.slug === 'climate', `tag coordinate wrong: ${JSON.stringify(tg.tag)}`);
  assert(tg.target.type === 'profile' && tg.target.ref === PROFILE, `target wrong: ${JSON.stringify(tg.target)}`);
  assert(tg.stance === 'apply' && tg.asserter === ALICE, `stance/asserter wrong: ${tg.stance}/${tg.asserter}`);
});

t('normalize: a nostr-event-tag assertion → {target.type=event, tag coordinate via header, stance}', () => {
  const n = normalize();
  const out = n({ assertions: [eventTag({ slug: 'climate' })], headers: [header({ slug: 'climate' })], honoredAuthorities: HON });
  assert(out.length === 1, `expected 1 normalized tagging, got ${out.length}`);
  const tg = out[0];
  assert(tg.tag.authorPubkey === JACK && tg.tag.slug === 'climate', `tag coordinate (via header) wrong: ${JSON.stringify(tg.tag)}`);
  assert(tg.target.type === 'event' && tg.target.ref === NOTE1, `target wrong: ${JSON.stringify(tg.target)}`);
});

t('normalize: a profile-tag and a note-tag of the SAME tag normalize to the SAME coordinate (merge key)', () => {
  const n = normalize();
  const out = n({
    assertions: [userTag({ slug: 'climate' }), eventTag({ slug: 'climate' })],
    headers: [header({ slug: 'climate' })], honoredAuthorities: HON,
  });
  assert(out.length === 2, `both normalize, got ${out.length}`);
  const keys = new Set(out.map((tg) => `${tg.tag.authorPubkey}:${tg.tag.slug}`));
  assert(keys.size === 1, `both must share ONE tag coordinate; got ${JSON.stringify([...keys])}`);
});

// ─── indexByTag: the ACs ───

t('index AC-1: a NOTE-only tag appears in the index (keyed by coordinate)', () => {
  const n = normalize(); const idx = index();
  const taggings = n({ assertions: [eventTag({ slug: 'notesonly' })], headers: [header({ slug: 'notesonly' })], honoredAuthorities: HON });
  const rows = idx(taggings, { isAsserterTrusted: ALL_TRUSTED }).rows || idx(taggings, { isAsserterTrusted: ALL_TRUSTED });
  const r = rowFor(rows, 'notesonly');
  assert(r, 'a tag used only on notes must appear in the unified index');
  assert((r.byType?.event?.applications || 0) >= 1, `note usage must be reflected: ${JSON.stringify(r.byType)}`);
});

t('index AC-2: a SHARED tag merges into ONE row reflecting BOTH profile and note usage', () => {
  const n = normalize(); const idx = index();
  const taggings = n({
    assertions: [userTag({ slug: 'climate', asserter: ALICE }), eventTag({ slug: 'climate', asserter: ALICE })],
    headers: [header({ slug: 'climate' })], honoredAuthorities: HON,
  });
  const res = idx(taggings, { isAsserterTrusted: ALL_TRUSTED });
  const rows = res.rows || res;
  const climate = (rows || []).filter((r) => r.tag.slug === 'climate');
  assert(climate.length === 1, `shared tag must be ONE merged row, got ${climate.length}`);
  const r = climate[0];
  assert((r.byType?.profile?.applications || 0) >= 1 && (r.byType?.event?.applications || 0) >= 1,
    `row must reflect BOTH profile and note usage: ${JSON.stringify(r.byType)}`);
  assert((r.applications || 0) >= 2, `combined applications total must span both types, got ${r.applications}`);
});

t('index AC-3: POV trust filter — an untrusted asserter does not inflate the counted totals', () => {
  const n = normalize(); const idx = index();
  const taggings = n({
    assertions: [userTag({ slug: 'climate', asserter: ALICE, id: 'al' }), eventTag({ slug: 'climate', asserter: BOB, id: 'bo' })],
    headers: [header({ slug: 'climate' })], honoredAuthorities: HON,
  });
  const res = idx(taggings, { isAsserterTrusted: TRUST_ONLY(ALICE) });
  const r = rowFor(res.rows || res, 'climate');
  assert(r, 'row present (ALICE trusted)');
  assert((r.applications || 0) === 1, `only the trusted asserter counts; BOB must be excluded, got ${r.applications}`);
});

t('index (mine): the viewer\'s own tagging surfaces on the tag even when the POV does not count them', () => {
  const n = normalize(); const idx = index();
  const taggings = n({ assertions: [eventTag({ slug: 'mine-tag', asserter: VIEWER })], headers: [header({ slug: 'mine-tag' })], honoredAuthorities: HON });
  const res = idx(taggings, { isAsserterTrusted: () => false, viewerPubkey: VIEWER });
  const r = rowFor(res.rows || res, 'mine-tag');
  assert(r, 'a tag the viewer used must appear even when the POV trusts no one');
  assert(r.mine === 'apply', `the viewer's own stance must be surfaced as mine, got ${JSON.stringify(r.mine)}`);
});

t('index AC-5: a PROFILE-only tag still appears (backward compatible)', () => {
  const n = normalize(); const idx = index();
  const taggings = n({ assertions: [userTag({ slug: 'profilesonly' })], headers: [], honoredAuthorities: HON });
  const r = rowFor((idx(taggings, { isAsserterTrusted: ALL_TRUSTED }).rows) || idx(taggings, { isAsserterTrusted: ALL_TRUSTED }), 'profilesonly');
  assert(r && (r.byType?.profile?.applications || 0) >= 1, 'a profile-only tag must still appear with its profile usage');
});

t('index AC-4: combined usage drives ranking — a note-heavy tag out-counts a profile-light one', () => {
  const n = normalize(); const idx = index();
  const assertions = [
    userTag({ slug: 'light', asserter: ALICE, target: PROFILE, id: 'lp' }),
    eventTag({ slug: 'heavy', asserter: ALICE, target: { id: NOTE1 }, id: 'h1' }),
    eventTag({ slug: 'heavy', asserter: BOB, target: { id: 'b2'.repeat(32) }, id: 'h2' }),
    eventTag({ slug: 'heavy', asserter: VIEWER, target: { id: 'c3'.repeat(32) }, id: 'h3' }),
  ];
  const taggings = n({ assertions, headers: [header({ slug: 'light' }), header({ slug: 'heavy' })], honoredAuthorities: HON });
  const res = idx(taggings, { isAsserterTrusted: ALL_TRUSTED });
  const rows = res.rows || res;
  const heavy = rowFor(rows, 'heavy'); const light = rowFor(rows, 'light');
  assert(heavy && light, 'both tags present');
  assert((heavy.applications || 0) > (light.applications || 0),
    `the note-heavy tag must have a higher combined count (${heavy.applications}) than the profile-light one (${light.applications})`);
});

// ─── extensibility: a future member drops in with no new stack ───

t('extensibility: a THIRD registry member (new concept/target type) normalizes + counts', () => {
  const n = normalize(); const idx = index();
  // A fake future member per the ADR-0009 interface: { name, conceptZ, extractTag, extractTarget }.
  const thingMember = {
    name: 'nostr-thing-tag',
    conceptZ: (ta) => `39998:${ta}:nostr-thing-tag`,
    extractTag: (ev) => {
      const a = (ev.tags || []).find((x) => x[0] === 'a' && /^39999:[0-9a-f]{64}:/.test(x[1] || ''));
      if (!a) return null;
      const m = /^39999:([0-9a-f]{64}):(.+)$/.exec(a[1]); return m ? { authorPubkey: m[1], slug: m[2] } : null;
    },
    extractTarget: (ev) => { const g = (ev.tags || []).find((x) => x[0] === 'g'); return g ? { type: 'thing', ref: g[1] } : null; },
  };
  const thingAssertion = {
    id: 'thing1', pubkey: ALICE, created_at: 2000,
    tags: [['d', 'x'], ['g', 'some-thing'], ['a', `39999:${JACK}:climate`], ['z', `39998:${AUTH_A}:nostr-thing-tag`], ['polarity', '1']],
  };
  const c = core();
  const members = [...(c.taggingMembers || []), thingMember];
  const taggings = n({ assertions: [thingAssertion], headers: [], honoredAuthorities: HON, members });
  assert(taggings.length === 1 && taggings[0].target.type === 'thing',
    `a registered future member must normalize its assertions, got ${JSON.stringify(taggings)}`);
  const r = rowFor((idx(taggings, { isAsserterTrusted: ALL_TRUSTED }).rows) || idx(taggings, { isAsserterTrusted: ALL_TRUSTED }), 'climate');
  assert(r && (r.byType?.thing?.applications || 0) >= 1, 'the new target type must count in the unified index without a new stack');
});

t('normalize: un-honored event-tag header excluded; empty input → empty', () => {
  const n = normalize();
  const unhon = n({ assertions: [eventTag({ slug: 'x' })], headers: [header({ slug: 'x', authority: AUTH_B })], honoredAuthorities: [AUTH_A] });
  assert(unhon.length === 0, 'an event-tag whose header joins an un-honored authority must be excluded');
  assert(n({ assertions: [], headers: [], honoredAuthorities: HON }).length === 0, 'empty → empty, no throw');
});

// ─── source-contract ───

t('src: the core exports normalizeTaggings, indexByTag, and the taggingMembers registry', () => {
  const c = core();
  assert(typeof c.normalizeTaggings === 'function', 'must export normalizeTaggings');
  assert(typeof c.indexByTag === 'function', 'must export indexByTag');
  assert(Array.isArray(c.taggingMembers) && c.taggingMembers.length >= 2,
    'must export a taggingMembers registry seeded with >=2 members (nostr-user-tag, nostr-event-tag)');
  const names = c.taggingMembers.map((m) => m.name);
  assert(names.includes('nostr-user-tag') && names.includes('nostr-event-tag'),
    `registry must include both built-in members, got ${JSON.stringify(names)}`);
});

t('src: a unified index route is registered and its handler consumes the normalizer + scans multiple concept-z members', () => {
  const src = read(API_INDEX);
  assert(/['"]\/api\/tags\/index['"]/.test(src), 'src/api/index.js must register the unified GET /api/tags/index route');
  // the handler module must consume the core aggregation (not re-count per-type)
  const candidates = [path.join(REPO, 'src/api/tags/index.js'), path.join(REPO, 'src/api/event-tags/index.js')];
  const handlerSrc = candidates.filter(fs.existsSync).map((p) => read(p)).join('\n');
  assert(/indexByTag/.test(handlerSrc) && /normalizeTaggings|taggingMembers/.test(handlerSrc),
    'the unified index handler must consume normalizeTaggings/taggingMembers + indexByTag from the core');
});

// ─── HTTP smoke (skip-gated on the existing for-event route as the stack probe) ───

async function httpGet(url) {
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(to);
    const json = await r.json().catch(() => null);
    return { status: r.status, json };
  } catch { return { status: null, json: null }; }
}

t('http: /api/tags/index returns 200 with a rows array (skip if stack down; 404 while up = not wired)', async () => {
  const probe = await httpGet(`${BASE}/api/event-tags/for-event`);
  if (probe.status === null) return 'SKIP';
  const ok = await httpGet(`${BASE}/api/tags/index`);
  assert(ok.status === 200, `unified index must return 200 (got ${ok.status}) — 404 means the route isn't wired`);
  assert(ok.json && Array.isArray(ok.json.rows), 'the unified index response must include a `rows` array');
});

async function run() {
  console.log('\n--- unified tag index tests (epic event-tagging, Story 9) ---');
  let pass = 0, fail = 0, skipped = 0; const failures = [];
  for (const [name, fn] of tests) {
    try { const r = await fn(); if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; } else { console.log(`  PASS  ${name}`); pass++; } }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\nunified-tag-index: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
