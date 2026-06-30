/**
 * Tests for Story 4 (epic: event-tagging) — the read API.
 *
 * Story: engineering-team/stories/event-tagging/4-event-tagging-read-api.md
 * ADR:   engineering-team/decisions/event-tagging/0004-event-tagging-read-api.md
 *
 * Three layers:
 *   CLASSIFIER — deterministic unit tests of the pure read-time classifier
 *     classifyEventTaggings({candidates, headers, honoredAuthorities, isAsserterTrusted})
 *     in src/lib/event-tagging (the read-side complement to the filter builders).
 *     This is where the 3-state classification + sovereignty + POV logic is proven.
 *   SOURCE-CONTRACT — routes wired; module requires the CJS core + resolvePov; the
 *     legitimacy authority is a parameter (no single hardcoded gate).
 *   HTTP — skip-gated smoke against :7778 (input validation + route exists).
 *
 * Intentionally failing until classifyEventTaggings + src/api/event-tags land.
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

function classifier() {
  const c = require(CORE);
  if (typeof c.classifyEventTaggings !== 'function') {
    throw new Error('classifyEventTaggings is not implemented/exported in src/lib/event-tagging (read-side classifier)');
  }
  return c.classifyEventTaggings;
}

// ─── fixtures ───
const AUTH_A = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833'; // canonical authority
const AUTH_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'; // splinter authority
const JACK   = '1111111111111111111111111111111111111111111111111111111111111111'; // header + tag author
const ALICE  = '2222222222222222222222222222222222222222222222222222222222222222'; // asserter (trusted)
const BOB    = '3333333333333333333333333333333333333333333333333333333333333333'; // asserter (untrusted)
const CAROL  = '4444444444444444444444444444444444444444444444444444444444444444';
const DAVE   = '5555555555555555555555555555555555555555555555555555555555555555';
const NOTE   = '6666666666666666666666666666666666666666666666666666666666666666';

const DESC_AWESOME = `39999:${JACK}:tagging:awesome-tag-tagging`;
const DESC_USEFUL  = `39999:${JACK}:tagging:useful-tag-tagging`;
const DESC_LOST    = `39999:${JACK}:tagging:lost-tag-tagging`;

/** A per-tag tagging header that joins `authority`'s tagging-with-specific-tag and names `slug`. */
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

/** A tagging assertion targeting NOTE, with a descriptor z and a concept-namespace z. */
function assertion({ asserter = ALICE, polarity = '1', descriptor = DESC_AWESOME, conceptZ = AUTH_A, id, hasDescriptor = true } = {}) {
  const tags = [
    ['d', `event-tag-x-${NOTE.slice(0, 8)}-${asserter.slice(0, 8)}`],
    ['e', NOTE],
    ['z', `39998:${conceptZ}:nostr-event-tag`],
  ];
  if (hasDescriptor) tags.push(['z', descriptor]);
  if (polarity != null) tags.push(['polarity', String(polarity)]);
  return { id: id || `a_${asserter.slice(0, 4)}_${polarity}_${descriptor.slice(-12)}`, pubkey: asserter, created_at: 2000, tags };
}

const ALL_TRUSTED = () => true;
function tagOf(result, slug) { return (result.tags || []).find((t) => t.tag && t.tag.slug === slug); }

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// ─── CLASSIFIER ───

t('classify: resolves descriptor (assertion z→header→tag), counts under applications', () => {
  const classify = classifier();
  const r = classify({ candidates: [assertion()], headers: [header()], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED });
  const tg = tagOf(r, 'awesome-tag');
  assert(tg, 'expected a tag group for awesome-tag (descriptor resolved through the header)');
  assert(tg.tag.authorPubkey === JACK, 'tag author should be parsed from the header\'s a-tag');
  assert(tg.applications.length === 1 && tg.applications[0].authorPubkey === ALICE, 'the apply should be grouped under the tag');
  assert(tg.disputes.length === 0, 'no disputes expected');
});

t('classify: counted / illegitimate (header not honored) / unverifiable (header absent)', () => {
  const classify = classifier();
  const candidates = [
    assertion({ descriptor: DESC_AWESOME }),                 // legit (header joins A, honored)
    assertion({ asserter: BOB, descriptor: DESC_USEFUL }),   // illegitimate (header joins B, not honored)
    assertion({ asserter: CAROL, descriptor: DESC_LOST }),   // unverifiable (no header)
  ];
  const headers = [header({ slug: 'awesome-tag', authority: AUTH_A }), header({ slug: 'useful-tag', authority: AUTH_B })];
  const r = classify({ candidates, headers, honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED });
  assert(tagOf(r, 'awesome-tag'), 'awesome-tag (legit) must be counted');
  assert(!tagOf(r, 'useful-tag'), 'useful-tag (header joins an un-honored authority) must be EXCLUDED (illegitimate)');
  assert((r.unverifiable || []).some((u) => u.descriptor === DESC_LOST && u.authorPubkey === CAROL),
    'the candidate whose header is absent must be surfaced in unverifiable, not dropped');
  assert(!(r.unverifiable || []).some((u) => u.descriptor === DESC_USEFUL),
    'an illegitimate (header found, not honored) candidate is NOT unverifiable — the two states are distinct');
});

t('classify: candidate with no resolvable header is surfaced in unverifiable, never dropped', () => {
  const classify = classifier();
  const r = classify({ candidates: [assertion({ descriptor: DESC_LOST })], headers: [], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED });
  assert((r.tags || []).length === 0, 'no header → nothing counted');
  assert((r.unverifiable || []).length === 1, 'the candidate must appear in unverifiable (unverifiable ≠ erased)');
});

t('classify: legitimacy authority is a parameter — same input flips counted↔excluded; splinter readable when honored', () => {
  const classify = classifier();
  const cand = [assertion({ descriptor: DESC_AWESOME })];
  const hdr = [header({ slug: 'awesome-tag', authority: AUTH_A })]; // header joins A
  // Honor A → counted.
  assert(tagOf(classify({ candidates: cand, headers: hdr, honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED }), 'awesome-tag'),
    'with authority A honored, the tagging must count');
  // Honor only B → same data, now excluded (re-interpreted, not erased).
  const onlyB = classify({ candidates: cand, headers: hdr, honoredAuthorities: [AUTH_B], isAsserterTrusted: ALL_TRUSTED });
  assert(!tagOf(onlyB, 'awesome-tag'), 'with only authority B honored, the A-rooted header is excluded — authority is a parameter, not hardcoded');
  // A splinter header (joins B) is READABLE by a reader who honors B.
  const splinter = classify({ candidates: cand, headers: [header({ slug: 'awesome-tag', authority: AUTH_B })], honoredAuthorities: [AUTH_B], isAsserterTrusted: ALL_TRUSTED });
  assert(tagOf(splinter, 'awesome-tag'), 'a splinter authority\'s tagging must be readable by a reader honoring that authority');
});

t('classify: candidates with different nostr-event-tag concept-z are both classified by descriptor (namespace-agnostic)', () => {
  const classify = classifier();
  const candidates = [
    assertion({ asserter: ALICE, conceptZ: AUTH_A }),
    assertion({ asserter: BOB, conceptZ: AUTH_B }), // different concept-namespace z
  ];
  const r = classify({ candidates, headers: [header()], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED });
  const tg = tagOf(r, 'awesome-tag');
  assert(tg && tg.applications.length === 2,
    'both candidates must count regardless of which nostr-event-tag concept namespace they carry — only the descriptor header\'s authority gates');
});

t('classify: polarity 1/-1/0/absent → applied/disputed/dropped/applied, grouped by tag', () => {
  const classify = classifier();
  const candidates = [
    assertion({ asserter: ALICE, polarity: '1' }),
    assertion({ asserter: BOB, polarity: '-1' }),
    assertion({ asserter: CAROL, polarity: '0' }),
    assertion({ asserter: DAVE, polarity: null }), // absent → default applied
  ];
  const r = classify({ candidates, headers: [header()], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED });
  const tg = tagOf(r, 'awesome-tag');
  assert(tg, 'expected the awesome-tag group');
  const applyAuthors = tg.applications.map((e) => e.authorPubkey).sort();
  assert(tg.applications.length === 2 && applyAuthors.includes(ALICE) && applyAuthors.includes(DAVE),
    'polarity 1 and absent (default 1) must be applied');
  assert(tg.disputes.length === 1 && tg.disputes[0].authorPubkey === BOB, 'polarity -1 must be disputed');
  assert(!tg.applications.concat(tg.disputes).some((e) => e.authorPubkey === CAROL), 'polarity 0 must be dropped (neutral)');
});

t('classify: isAsserterTrusted predicate drops out-of-trust asserters (POV)', () => {
  const classify = classifier();
  const candidates = [assertion({ asserter: ALICE }), assertion({ asserter: BOB })];
  const r = classify({ candidates, headers: [header()], honoredAuthorities: [AUTH_A], isAsserterTrusted: (pk) => pk === ALICE });
  const tg = tagOf(r, 'awesome-tag');
  assert(tg && tg.applications.length === 1 && tg.applications[0].authorPubkey === ALICE,
    'only the in-trust asserter (ALICE) should count; BOB must be dropped by the POV predicate');
});

t('classify: empty candidates → empty result; a candidate with no descriptor z is skipped', () => {
  const classify = classifier();
  const empty = classify({ candidates: [], headers: [], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED });
  assert((empty.tags || []).length === 0 && (empty.unverifiable || []).length === 0, 'empty input → empty {tags,unverifiable}, no throw');
  const noDesc = classify({ candidates: [assertion({ hasDescriptor: false })], headers: [header()], honoredAuthorities: [AUTH_A], isAsserterTrusted: ALL_TRUSTED });
  assert((noDesc.tags || []).length === 0 && (noDesc.unverifiable || []).length === 0,
    'a kind-39999 event with no descriptor z is not an event-tagging — skipped, not unverifiable');
});

// ─── SOURCE-CONTRACT ───

t('src: src/api/index.js registers /api/event-tags/for-event + /headers-for-tag', () => {
  const src = read(API_INDEX);
  assert(/['"]\/api\/event-tags\/for-event['"]/.test(src), 'src/api/index.js must register /api/event-tags/for-event');
  assert(/['"]\/api\/event-tags\/headers-for-tag['"]/.test(src), 'src/api/index.js must register /api/event-tags/headers-for-tag');
});

t('src: module requires the CJS core + resolvePov; authority is parameterized (no single hardcoded gate)', () => {
  const src = read(EVENT_TAGS_MODULE);
  assert(/require\(['"][^'"]*lib\/event-tagging['"]\)/.test(src), 'src/api/event-tags must require the Story-1 core (../../lib/event-tagging)');
  assert(/resolvePov/.test(src) && /_shared\/pov/.test(src), 'must reuse resolvePov from ../_shared/pov');
  assert(/req\.query\.authorities/.test(src), 'the legitimacy authority must be a request parameter (req.query.authorities)');
  assert(/getOwnerAssistantPubkey/.test(src),
    'the default honored authority set must include the RUNTIME TA (getOwnerAssistantPubkey) — not a single hardcoded canonical as THE gate');
});

// ─── HTTP smoke (skip-gated) ───

async function httpStatus(url) {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(to);
    return r.status;
  } catch { return null; }
}

t('http: for-event with no/malformed target → 400 (skip if route absent/unreachable)', async () => {
  const noParam = await httpStatus(`${BASE}/api/event-tags/for-event`);
  if (noParam === null || noParam === 404) return 'SKIP'; // stack down or route not wired yet
  assert(noParam === 400, `for-event with no target must return 400 (got ${noParam})`);
  const bad = await httpStatus(`${BASE}/api/event-tags/for-event?eventId=not-hex`);
  assert(bad === 400, `for-event with a malformed eventId must return 400 (got ${bad})`);
});

async function run() {
  console.log('\n--- event-tagging read-api tests (epic event-tagging, Story 4) ---');
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
  console.log(`\nevent-tagging-read-api: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
