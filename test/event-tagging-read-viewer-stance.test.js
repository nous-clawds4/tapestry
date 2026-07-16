/**
 * Tests for Story 7 (epic: event-tagging) — the viewer's own stance ("mine" channel).
 *
 * Story: engineering-team/stories/event-tagging/7-event-tagging-read-viewer-own-stance.md
 * ADR:   engineering-team/decisions/event-tagging/0007-event-tagging-read-viewer-own-stance.md
 *
 * The fix: a logged-in viewer must always see their OWN apply/dispute on a note,
 * durably, even when the active POV doesn't trust them — surfaced SEPARATELY from
 * the POV-counted set, so it never inflates the community tally. ADR Option A adds
 * an optional `viewerPubkey` to the pure-core classifier, emitting a `mine` channel:
 *
 *   classifyEventTaggings({ candidates, headers, honoredAuthorities, isAsserterTrusted, viewerPubkey })
 *     -> { tags, unverifiable, mine: [{ tag:{authorPubkey,slug}, stance:'apply'|'dispute', eventId, createdAt }] }
 *
 *   `mine` is LEGITIMACY-gated (header resolves + honored authority) but
 *   TRUST-unfiltered (the viewer's stance shows regardless of POV trust).
 *
 * Three layers, mirroring the Story-4 read-api suite:
 *   CLASSIFIER     — deterministic unit tests of `mine` (the meat).
 *   SOURCE-CONTRACT — the for-event handler threads `req.query.viewerPubkey`
 *                     (hex-validated) into the core and returns `mine`.
 *   HTTP           — skip-gated smoke: bad-input 400 unchanged (regression) and
 *                     a 200 response carries a `mine` array.
 *
 * Intentionally failing until the classifier gains `viewerPubkey`/`mine` and the
 * handler threads it. The core is require()d lazily inside each test.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const CORE = '../src/lib/event-tagging';
const EVENT_TAGS_MODULE = path.join(REPO, 'src/api/event-tags/index.js');
const BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { if (!fs.existsSync(p)) throw new Error(`${p} does not exist`); return fs.readFileSync(p, 'utf8'); }

function classifier() {
  const c = require(CORE);
  if (typeof c.classifyEventTaggings !== 'function') {
    throw new Error('classifyEventTaggings is not implemented/exported in src/lib/event-tagging');
  }
  return c.classifyEventTaggings;
}

// ─── fixtures (mirror the Story-4 read-api suite) ───
const AUTH_A  = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833'; // canonical (honored)
const AUTH_B  = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'; // splinter (not honored here)
const JACK    = '1111111111111111111111111111111111111111111111111111111111111111'; // header + tag author
const ALICE   = '2222222222222222222222222222222222222222222222222222222222222222'; // a trusted OTHER asserter
const VIEWER  = '7777777777777777777777777777777777777777777777777777777777777777'; // the logged-in viewer
const NOTE    = '6666666666666666666666666666666666666666666666666666666666666666'; // target note id

const DESC_AWESOME = `39999:${JACK}:tagging:awesome-tag-tagging`;
const DESC_LOST    = `39999:${JACK}:tagging:lost-tag-tagging`; // no header resolves for this

function header({ authority = AUTH_A, slug = 'awesome-tag', id } = {}) {
  return {
    id: id || `h_${authority.slice(0, 4)}_${slug}`,
    pubkey: JACK,
    created_at: 1000,
    tags: [
      ['d', `tagging:${slug}-tagging`],
      ['names', `Tagging as ${slug}`],
      ['z', `39998:${authority}:tagging-with-specific-tag`],
      ['a', `39999:${JACK}:${slug}`],
    ],
  };
}

function assertion({ asserter = VIEWER, polarity = '1', descriptor = DESC_AWESOME, conceptZ = AUTH_A, id, created_at = 2000, hasDescriptor = true } = {}) {
  const tags = [
    ['d', `event-tag-x-${NOTE.slice(0, 8)}-${asserter.slice(0, 8)}`],
    ['e', NOTE],
    ['z', `39998:${conceptZ}:nostr-event-tag`],
  ];
  if (hasDescriptor) tags.push(['z', descriptor]);
  if (polarity != null) tags.push(['polarity', String(polarity)]);
  return { id: id || `a_${asserter.slice(0, 4)}_${polarity}_${descriptor.slice(-12)}`, pubkey: asserter, created_at, tags };
}

const ALL_TRUSTED = () => true;
const NONE_TRUSTED = () => false;
const TRUST_ONLY = (...pks) => (pk) => pks.includes(pk);

function tagOf(result, slug) { return (result.tags || []).find((t) => t.tag && t.tag.slug === slug); }
function mineOf(result, slug) { return (result.mine || []).find((m) => m.tag && m.tag.slug === slug); }

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// ─── CLASSIFIER: the `mine` channel ───

// AC: my applied tag is reflected even when the POV would not count me
t('mine: a viewer the POV does NOT trust still sees their own APPLIED tag in `mine`', () => {
  const classify = classifier();
  const r = classify({
    candidates: [assertion({ asserter: VIEWER, polarity: '1' })],
    headers: [header()], honoredAuthorities: [AUTH_A],
    isAsserterTrusted: NONE_TRUSTED, viewerPubkey: VIEWER,
  });
  const m = mineOf(r, 'awesome-tag');
  assert(m, 'the untrusted viewer\'s own apply must appear in `mine` (trust-unfiltered)');
  assert(m.stance === 'apply', `mine stance must be 'apply', got ${JSON.stringify(m.stance)}`);
  assert(!tagOf(r, 'awesome-tag'), 'the untrusted viewer must NOT appear in the counted `tags` set');
});

// AC: my disputed tag is reflected even when the POV would not count me
t('mine: a viewer the POV does NOT trust still sees their own DISPUTED tag in `mine`', () => {
  const classify = classifier();
  const r = classify({
    candidates: [assertion({ asserter: VIEWER, polarity: '-1' })],
    headers: [header()], honoredAuthorities: [AUTH_A],
    isAsserterTrusted: NONE_TRUSTED, viewerPubkey: VIEWER,
  });
  const m = mineOf(r, 'awesome-tag');
  assert(m && m.stance === 'dispute', `the untrusted viewer's own dispute must be in mine with stance 'dispute', got ${JSON.stringify(m && m.stance)}`);
});

// AC: my stance is distinct from the community count AND does not inflate the tally
t('mine: the viewer\'s untrusted stance is surfaced in `mine` but NEVER inflates the counted tally', () => {
  const classify = classifier();
  const r = classify({
    candidates: [
      assertion({ asserter: ALICE, polarity: '1', id: 'alice-apply' }),   // trusted other → counts
      assertion({ asserter: VIEWER, polarity: '1', id: 'viewer-apply' }), // untrusted viewer → mine only
    ],
    headers: [header()], honoredAuthorities: [AUTH_A],
    isAsserterTrusted: TRUST_ONLY(ALICE), viewerPubkey: VIEWER,
  });
  const tg = tagOf(r, 'awesome-tag');
  assert(tg && tg.applications.length === 1 && tg.applications[0].authorPubkey === ALICE,
    `counted applications must be exactly [ALICE] (viewer must not leak in), got ${JSON.stringify((tg && tg.applications || []).map((e) => e.authorPubkey))}`);
  assert(mineOf(r, 'awesome-tag'), 'the viewer still sees their own apply in `mine`');
  assert(!tg.applications.some((e) => e.authorPubkey === VIEWER), 'the untrusted viewer must not appear in the counted applications');
});

// AC: latest-wins / flip — the classifier reflects the single (deduped) latest stance.
// NOTE: the apply→dispute collapse itself is done UPSTREAM by the handler's
// dedupeReplaceable (apply and dispute of one (tag,target,viewer) share a
// deterministic d-tag — proven in the write-path suite). The classifier reflects
// whichever single candidate survives.
t('mine: reflects the current (deduped-latest) stance — a flipped dispute shows as dispute, not also apply', () => {
  const classify = classifier();
  const r = classify({
    candidates: [assertion({ asserter: VIEWER, polarity: '-1', created_at: 3000 })], // the surviving latest = dispute
    headers: [header()], honoredAuthorities: [AUTH_A],
    isAsserterTrusted: NONE_TRUSTED, viewerPubkey: VIEWER,
  });
  const mineEntries = (r.mine || []).filter((m) => m.tag && m.tag.slug === 'awesome-tag');
  assert(mineEntries.length === 1, `exactly one mine entry per tag for the target, got ${mineEntries.length}`);
  assert(mineEntries[0].stance === 'dispute', `the current stance must be 'dispute', got ${mineEntries[0].stance}`);
});

// Edge: a TRUSTED viewer appears in BOTH the counted tally AND `mine` (mine is not exclusive)
t('mine: a TRUSTED viewer appears in BOTH the counted tags and `mine` (mine is additive, not exclusive)', () => {
  const classify = classifier();
  const r = classify({
    candidates: [assertion({ asserter: VIEWER, polarity: '1' })],
    headers: [header()], honoredAuthorities: [AUTH_A],
    isAsserterTrusted: ALL_TRUSTED, viewerPubkey: VIEWER,
  });
  const tg = tagOf(r, 'awesome-tag');
  assert(tg && tg.applications.some((e) => e.authorPubkey === VIEWER), 'a trusted viewer must still COUNT in the community tally');
  assert(mineOf(r, 'awesome-tag'), 'a trusted viewer must ALSO see their stance in `mine`');
});

// ADR Open-Q1: `mine` is legitimacy-gated — an own assertion whose header is
// unresolvable stays in `unverifiable`, NOT in `mine`.
t('mine: legitimacy-gated — the viewer\'s own UNVERIFIABLE assertion is NOT in `mine` (stays in unverifiable)', () => {
  const classify = classifier();
  const r = classify({
    candidates: [assertion({ asserter: VIEWER, descriptor: DESC_LOST })], // no header for DESC_LOST
    headers: [header()], honoredAuthorities: [AUTH_A],
    isAsserterTrusted: NONE_TRUSTED, viewerPubkey: VIEWER,
  });
  assert((r.mine || []).length === 0, '`mine` must be empty — an unverifiable own assertion can\'t be keyed to a tag identity');
  assert((r.unverifiable || []).some((u) => u.authorPubkey === VIEWER && u.descriptor === DESC_LOST),
    'the viewer\'s own unverifiable assertion must still be surfaced in `unverifiable` (unchanged behavior)');
});

// ADR: `mine` is legitimacy-gated — an own assertion under an UN-HONORED authority is excluded
t('mine: legitimacy-gated — the viewer\'s own assertion under an un-honored authority is NOT in `mine`', () => {
  const classify = classifier();
  const r = classify({
    candidates: [assertion({ asserter: VIEWER, polarity: '1' })],
    headers: [header({ authority: AUTH_B })], // header joins B, reader honors only A
    honoredAuthorities: [AUTH_A],
    isAsserterTrusted: NONE_TRUSTED, viewerPubkey: VIEWER,
  });
  assert((r.mine || []).length === 0, 'an own assertion whose header joins an un-honored authority is illegitimate → not in `mine`');
});

// AC: backward-compatible AND additive — no viewerPubkey ⇒ mine:[] and IDENTICAL tags/unverifiable
t('mine: backward-compatible + additive — omitting viewerPubkey yields mine:[] and byte-identical tags/unverifiable', () => {
  const classify = classifier();
  const candidates = [
    assertion({ asserter: ALICE, polarity: '1', id: 'alice-apply' }),
    assertion({ asserter: VIEWER, polarity: '-1', id: 'viewer-dispute' }),
  ];
  const headers = [header()];
  const args = { candidates, headers, honoredAuthorities: [AUTH_A], isAsserterTrusted: TRUST_ONLY(ALICE) };

  const without = classify({ ...args });
  assert(Array.isArray(without.mine) && without.mine.length === 0,
    'with no viewerPubkey, `mine` must be an empty array (no viewer-stance information)');

  const withViewer = classify({ ...args, viewerPubkey: VIEWER });
  assert(JSON.stringify(withViewer.tags) === JSON.stringify(without.tags),
    'passing viewerPubkey must NOT change the counted `tags` (additive)');
  assert(JSON.stringify(withViewer.unverifiable) === JSON.stringify(without.unverifiable),
    'passing viewerPubkey must NOT change `unverifiable` (additive)');
  assert(mineOf(withViewer, 'awesome-tag'), 'with the viewer, their own (untrusted) stance is surfaced in `mine`');
});

// Edge: viewer present but with no stance on this target ⇒ mine:[]; empty input ⇒ mine:[]
t('mine: empty when the viewer has no assertion on the target, and when there are no candidates', () => {
  const classify = classifier();
  const noStance = classify({
    candidates: [assertion({ asserter: ALICE, polarity: '1' })], // only ALICE asserted; viewer didn't
    headers: [header()], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED, viewerPubkey: VIEWER,
  });
  assert((noStance.mine || []).length === 0, 'no viewer assertion on the target ⇒ mine:[]');
  const empty = classify({ candidates: [], headers: [], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED, viewerPubkey: VIEWER });
  assert((empty.mine || []).length === 0, 'empty candidates ⇒ mine:[], no throw');
});

// Shape contract for a mine entry
t('mine: each entry is { tag:{authorPubkey,slug}, stance, eventId, createdAt }', () => {
  const classify = classifier();
  const ev = assertion({ asserter: VIEWER, polarity: '1', id: 'view-apply-1', created_at: 2222 });
  const r = classify({
    candidates: [ev], headers: [header()], honoredAuthorities: [AUTH_A],
    isAsserterTrusted: NONE_TRUSTED, viewerPubkey: VIEWER,
  });
  const m = mineOf(r, 'awesome-tag');
  assert(m, 'expected a mine entry');
  assert(m.tag && m.tag.authorPubkey === JACK && m.tag.slug === 'awesome-tag', `mine.tag must identify the tag {authorPubkey,slug}, got ${JSON.stringify(m.tag)}`);
  assert(m.stance === 'apply', 'stance');
  assert(m.eventId === 'view-apply-1', `mine.eventId must carry the assertion id, got ${JSON.stringify(m.eventId)}`);
  assert(m.createdAt === 2222, `mine.createdAt must carry the assertion created_at, got ${JSON.stringify(m.createdAt)}`);
});

// ─── SOURCE-CONTRACT ───

t('src: for-event threads a hex-validated req.query.viewerPubkey into classifyEventTaggings and returns `mine`', () => {
  const src = read(EVENT_TAGS_MODULE);
  assert(/req\.query\.viewerPubkey/.test(src), 'handleForEvent must read req.query.viewerPubkey');
  assert(/isHexPubkey\s*\(\s*req\.query\.viewerPubkey/.test(src) || /viewerPubkey[\s\S]{0,80}isHexPubkey/.test(src),
    'viewerPubkey must be hex-validated (malformed → treated as absent)');
  assert(/viewerPubkey/.test(src) && /classifyEventTaggings\s*\(/.test(src),
    'viewerPubkey must be passed into classifyEventTaggings');
  assert(/\bmine\b/.test(src) && /res\.json\(/.test(src), 'the handler must return `mine` in the for-event JSON response');
});

// ─── HTTP smoke (skip-gated) ───

async function httpGet(url) {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(to);
    const json = await r.json().catch(() => null);
    return { status: r.status, json };
  } catch { return { status: null, json: null }; }
}

t('http: for-event still 400s on bad input (regression) and a 200 response carries a `mine` array', async () => {
  const noParam = await httpGet(`${BASE}/api/event-tags/for-event`);
  if (noParam.status === null || noParam.status === 404) return 'SKIP'; // stack down or route not wired
  assert(noParam.status === 400, `no target must still 400 (got ${noParam.status})`);

  // A well-formed but tag-less target returns 200 with empty sets — enough to assert the `mine` key exists.
  const ok = await httpGet(`${BASE}/api/event-tags/for-event?eventId=${NOTE}&viewerPubkey=${VIEWER}`);
  assert(ok.status === 200, `a well-formed eventId must return 200 (got ${ok.status})`);
  assert(ok.json && Array.isArray(ok.json.mine), 'the for-event response must include a `mine` array');
});

async function run() {
  console.log('\n--- event-tagging read viewer-stance tests (epic event-tagging, Story 7) ---');
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
  console.log(`\nevent-tagging-read-viewer-stance: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
