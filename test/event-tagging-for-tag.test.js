/**
 * Tests for Story 8 (epic: event-tagging) — notes tagged with a tag.
 *
 * Story: engineering-team/stories/event-tagging/8-tag-page-notes-tagged-with-tag.md
 * ADR:   engineering-team/decisions/event-tagging/0008-tag-page-notes-tagged-with-tag.md
 *
 * Per the operator, the UI portion (Tag.jsx Notes view) is NOT auto-tested. The
 * risky read logic is isolated in a pure core function `groupTaggingsByTarget`,
 * which is where every AC about WHAT the notes view contains is proven:
 *
 *   groupTaggingsByTarget({ candidates, headers, honoredAuthorities,
 *                           isAsserterTrusted, viewerPubkey, tag })
 *     -> { targets: [{ target:{id?|address?}, applications:[…], disputes:[…] }],
 *          mine:    [{ target, stance:'apply'|'dispute', eventId, createdAt }] }
 *
 *   Groups taggings of a FIXED tag BY TARGET note, unioning across the tag's
 *   legitimate headers (Q1). Counted set is POV-trust-filtered; `mine` is the
 *   viewer's own targets, trust-UNfiltered but legitimacy-gated (AC-3/-4).
 *
 * Three layers (no stack for the first two):
 *   CORE          — deterministic unit tests of `groupTaggingsByTarget`.
 *   SOURCE-CONTRACT — the for-tag handler + route wired; composes the core +
 *                     the note-enrichment read path; passes viewerPubkey.
 *   HTTP          — skip-gated smoke: 400 on bad input + a 200 shape. Gated on the
 *                   EXISTING for-event route as the "is the stack up?" probe, so a
 *                   404 on for-tag while the stack is up is a real RED (not wired).
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const CORE = '../src/lib/event-tagging';
const EVENT_TAGS_MODULE = path.join(REPO, 'src/api/event-tags/index.js');
const API_INDEX = path.join(REPO, 'src/api/index.js');
const BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { if (!fs.existsSync(p)) throw new Error(`${p} does not exist`); return fs.readFileSync(p, 'utf8'); }

function grouper() {
  const c = require(CORE);
  if (typeof c.groupTaggingsByTarget !== 'function') {
    throw new Error('groupTaggingsByTarget is not implemented/exported in src/lib/event-tagging (the by-target read grouping)');
  }
  return c.groupTaggingsByTarget;
}

// ─── fixtures ───
const AUTH_A  = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833'; // honored authority
const AUTH_B  = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'; // un-honored here
const JACK    = '1111111111111111111111111111111111111111111111111111111111111111'; // tag author + a header author
const CANON   = '2222222222222222222222222222222222222222222222222222222222222222'; // a SECOND header author for the same tag
const ALICE   = '3333333333333333333333333333333333333333333333333333333333333333'; // trusted asserter
const BOB      = '4444444444444444444444444444444444444444444444444444444444444444'; // untrusted asserter
const VIEWER  = '7777777777777777777777777777777777777777777777777777777777777777'; // the logged-in viewer
const NOTE1   = 'a1'.repeat(32);
const NOTE2   = 'a2'.repeat(32);
const NOTE3   = 'a3'.repeat(32);
const ADDR_T  = `39999:${CANON}:some-addressable`;

const SLUG = 'awesome-tag';
const TAG = { authorPubkey: JACK, slug: SLUG }; // the tag whose page this is

/** A per-tag tagging header. `headerAuthor` mints it; `tagAuthor`/`slug` is the tag it names. */
function header({ headerAuthor = JACK, authority = AUTH_A, tagAuthor = JACK, slug = SLUG } = {}) {
  return {
    id: `h_${headerAuthor.slice(0, 4)}_${authority.slice(0, 4)}_${slug}`,
    pubkey: headerAuthor,
    created_at: 1000,
    tags: [
      ['d', `tagging:${slug}-tagging`],
      ['names', `Tagging as ${slug}`],
      ['z', `39998:${authority}:tagging-with-specific-tag`],
      ['a', `39999:${tagAuthor}:${slug}`],
    ],
  };
}

/** A tagging assertion: references `headerAuthor`'s header for `slug`, targets a note. */
function assertion({ asserter = ALICE, headerAuthor = JACK, slug = SLUG, target = { id: NOTE1 }, polarity = '1', conceptZ = AUTH_A, created_at = 2000, id } = {}) {
  const tags = [
    ['d', `event-tag-${slug}-x-${asserter.slice(0, 8)}-${(target.id || target.address || '').slice(0, 6)}`],
    ['z', `39998:${conceptZ}:nostr-event-tag`],
    ['z', `39999:${headerAuthor}:tagging:${slug}-tagging`],
  ];
  if (target.id) tags.push(['e', target.id]);
  else if (target.address) tags.push(['a', target.address]);
  if (polarity != null) tags.push(['polarity', String(polarity)]);
  return { id: id || `a_${asserter.slice(0, 4)}_${(target.id || target.address || '').slice(0, 6)}_${polarity}`, pubkey: asserter, created_at, tags };
}

const ALL_TRUSTED = () => true;
const NONE_TRUSTED = () => false;
const TRUST_ONLY = (...pks) => (pk) => pks.includes(pk);

function targetOf(result, id) { return (result.targets || []).find((t) => t.target && t.target.id === id); }
function mineOf(result, id) { return (result.mine || []).find((m) => m.target && m.target.id === id); }

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// ─── CORE: groupTaggingsByTarget ───

t('group: groups taggings of a fixed tag BY TARGET note (one group per distinct note)', () => {
  const group = grouper();
  const r = group({
    candidates: [assertion({ asserter: ALICE, target: { id: NOTE1 } }), assertion({ asserter: ALICE, target: { id: NOTE2 } })],
    headers: [header()], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED, tag: TAG,
  });
  assert(targetOf(r, NOTE1) && targetOf(r, NOTE2), 'both tagged notes must appear as separate target groups');
  assert((r.targets || []).length === 2, `expected exactly 2 target groups, got ${(r.targets || []).length}`);
});

t('group: per-target apply/dispute counts (for curation)', () => {
  const group = grouper();
  const r = group({
    candidates: [
      assertion({ asserter: ALICE, target: { id: NOTE1 }, polarity: '1', id: 'al' }),
      assertion({ asserter: BOB, target: { id: NOTE1 }, polarity: '1', id: 'bo' }),
      assertion({ asserter: CANON, target: { id: NOTE1 }, polarity: '-1', id: 'ca' }),
    ],
    headers: [header()], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED, tag: TAG,
  });
  const g = targetOf(r, NOTE1);
  assert(g && g.applications.length === 2, `NOTE1 must have 2 applications, got ${g && g.applications.length}`);
  assert(g.disputes.length === 1, `NOTE1 must have 1 dispute, got ${g.disputes.length}`);
});

t('group: POV trust filter — an untrusted asserter does not put a note in the counted targets', () => {
  const group = grouper();
  const r = group({
    candidates: [assertion({ asserter: BOB, target: { id: NOTE2 } })],
    headers: [header()], honoredAuthorities: [AUTH_A], isAsserterTrusted: TRUST_ONLY(ALICE), tag: TAG,
  });
  assert(!targetOf(r, NOTE2), 'a note tagged only by an untrusted asserter must NOT be in the counted targets');
});

// AC-3 / AC-4 — the by-tag analogue of Story 7
t('group: my own tagged note appears in `mine` even when the POV does not trust me', () => {
  const group = grouper();
  const r = group({
    candidates: [assertion({ asserter: VIEWER, target: { id: NOTE3 }, polarity: '1' })],
    headers: [header()], honoredAuthorities: [AUTH_A], isAsserterTrusted: NONE_TRUSTED, viewerPubkey: VIEWER, tag: TAG,
  });
  const m = mineOf(r, NOTE3);
  assert(m && m.stance === 'apply', 'the untrusted viewer\'s own tagged note must appear in `mine` (apply)');
  assert(!targetOf(r, NOTE3), 'and it must NOT be in the counted targets (distinct from community-endorsed)');
});

// AC-1 multi-header union (Q1)
t('group: unions taggings across MULTIPLE legitimate headers for the same tag', () => {
  const group = grouper();
  const r = group({
    candidates: [
      assertion({ asserter: ALICE, headerAuthor: JACK,  target: { id: NOTE1 }, id: 'viaJack' }),
      assertion({ asserter: ALICE, headerAuthor: CANON, target: { id: NOTE2 }, id: 'viaCanon' }),
    ],
    headers: [header({ headerAuthor: JACK }), header({ headerAuthor: CANON })], // two headers, same tag (a → 39999:JACK:awesome-tag)
    honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED, tag: TAG,
  });
  assert(targetOf(r, NOTE1) && targetOf(r, NOTE2),
    'taggings via different (but legitimate) headers for the same tag must both count toward that tag');
});

// Tag-identity gate — only THIS tag's taggings
t('group: excludes a tagging whose header names a DIFFERENT tag', () => {
  const group = grouper();
  const otherHeader = header({ headerAuthor: JACK, tagAuthor: JACK, slug: 'other-tag' }); // a → 39999:JACK:other-tag
  const r = group({
    candidates: [assertion({ asserter: ALICE, headerAuthor: JACK, slug: 'other-tag', target: { id: NOTE1 } })],
    headers: [otherHeader], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED, tag: TAG,
  });
  assert(!targetOf(r, NOTE1), 'a tagging whose header names a different tag must not be grouped under this tag');
});

t('group: legitimacy-gated — a header joining an un-honored authority is excluded', () => {
  const group = grouper();
  const r = group({
    candidates: [assertion({ asserter: ALICE, target: { id: NOTE1 } })],
    headers: [header({ authority: AUTH_B })], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED, viewerPubkey: ALICE, tag: TAG,
  });
  assert(!targetOf(r, NOTE1) && (r.mine || []).length === 0,
    'an un-honored header is illegitimate → the tagging counts for neither the targets nor `mine`');
});

t('group: polarity 0 (neutral) is dropped from both targets and mine', () => {
  const group = grouper();
  const r = group({
    candidates: [assertion({ asserter: VIEWER, target: { id: NOTE1 }, polarity: '0' })],
    headers: [header()], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED, viewerPubkey: VIEWER, tag: TAG,
  });
  assert(!targetOf(r, NOTE1), 'neutral polarity → not a counted target');
  assert((r.mine || []).length === 0, 'neutral polarity → not in mine');
});

t('group: mine reflects the current (deduped-latest) stance per target — flip apply→dispute shows dispute', () => {
  const group = grouper();
  const r = group({
    candidates: [assertion({ asserter: VIEWER, target: { id: NOTE3 }, polarity: '-1', created_at: 3000 })],
    headers: [header()], honoredAuthorities: [AUTH_A], isAsserterTrusted: NONE_TRUSTED, viewerPubkey: VIEWER, tag: TAG,
  });
  const entries = (r.mine || []).filter((m) => m.target && m.target.id === NOTE3);
  assert(entries.length === 1 && entries[0].stance === 'dispute', `one mine entry per target, current stance dispute; got ${JSON.stringify(entries)}`);
});

t('group: empty candidates → empty targets + mine; no viewerPubkey → mine []', () => {
  const group = grouper();
  const empty = group({ candidates: [], headers: [], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED, tag: TAG });
  assert((empty.targets || []).length === 0 && (empty.mine || []).length === 0, 'empty input → empty result, no throw');
  const noViewer = group({ candidates: [assertion({ asserter: ALICE, target: { id: NOTE1 } })], headers: [header()], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED, tag: TAG });
  assert((noViewer.mine || []).length === 0, 'no viewerPubkey → mine is empty');
});

t('group: addressable (a) target groups by address (core stays general; UI scopes to e)', () => {
  const group = grouper();
  const r = group({
    candidates: [assertion({ asserter: ALICE, target: { address: ADDR_T } })],
    headers: [header()], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED, tag: TAG,
  });
  const g = (r.targets || []).find((x) => x.target && x.target.address === ADDR_T);
  assert(g, 'an addressable-target tagging must group by its a-coordinate');
});

// ─── SOURCE-CONTRACT ───

t('src: the core exports groupTaggingsByTarget', () => {
  const c = require(CORE);
  assert(typeof c.groupTaggingsByTarget === 'function', 'src/lib/event-tagging must export groupTaggingsByTarget');
});

t('src: src/api/index.js registers /api/event-tags/for-tag', () => {
  assert(/['"]\/api\/event-tags\/for-tag['"]/.test(read(API_INDEX)), 'src/api/index.js must register /api/event-tags/for-tag');
});

t('src: handleForTag composes the by-tag scan + grouping + note enrichment, threading viewerPubkey', () => {
  const src = read(EVENT_TAGS_MODULE);
  assert(/groupTaggingsByTarget/.test(src), 'the handler must call groupTaggingsByTarget');
  assert(/filterTaggingHeadersForTag/.test(src) && /filterTaggingsUsingTag/.test(src),
    'the handler must discover the tag\'s headers and scan taggings-using-tag per header (multi-header union)');
  assert(/enrichNotes/.test(src), 'the handler must enrich the target kind-1 notes for NoteCard (reuse _shared/noteEnrichment)');
  assert(/req\.query\.viewerPubkey/.test(src) && /viewerPubkey/.test(src), 'the handler must thread req.query.viewerPubkey into the grouping');
});

// ─── HTTP smoke (skip-gated on the EXISTING for-event route as the stack probe) ───

async function httpGet(url) {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(to);
    const json = await r.json().catch(() => null);
    return { status: r.status, json };
  } catch { return { status: null, json: null }; }
}

t('http: for-tag validates input (400) and returns a notes array on a well-formed query', async () => {
  // Stack-up probe via the existing for-event route (Story 4).
  const probe = await httpGet(`${BASE}/api/event-tags/for-event`);
  if (probe.status === null) return 'SKIP'; // stack down
  assert(probe.status === 400, `probe sanity: for-event with no target should 400 (got ${probe.status})`);

  const bad = await httpGet(`${BASE}/api/event-tags/for-tag?tagAuthor=not-hex&slug=x`);
  assert(bad.status === 400, `for-tag with a malformed tagAuthor must 400 (got ${bad.status}) — 404 here means the route isn't wired`);

  const ok = await httpGet(`${BASE}/api/event-tags/for-tag?tagAuthor=${JACK}&slug=${SLUG}&viewerPubkey=${VIEWER}`);
  assert(ok.status === 200, `a well-formed for-tag query must return 200 (got ${ok.status})`);
  assert(ok.json && Array.isArray(ok.json.notes), 'the for-tag response must include a `notes` array');
});

async function run() {
  console.log('\n--- event-tagging for-tag tests (epic event-tagging, Story 8) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++;
    }
  }
  console.log(`\nevent-tagging-for-tag: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
