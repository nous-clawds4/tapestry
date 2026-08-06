/**
 * shared-concepts-adoption #1 — b-coverage audit + guided disposition.
 * Story: engineering-team/stories/shared-concepts-adoption/1-b-coverage-audit-and-disposition.md
 * ADR:   engineering-team/decisions/shared-concepts-adoption/0001-b-coverage-audit-and-disposition.md
 * Book:  engineering-team/audits/shared-concepts-adoption/book.md
 *
 * Four classes:
 *
 *   U1..U8 — pure tests of src/lib/bValueForms.js (zero-require CJS, the single
 *            code owner of the W16 ruling): classifyBValue over the closed value
 *            forms (a-tag | event-id | the reserved sentinel | malformed),
 *            dispositionOf (wired / self-declared / deferred; deferred is FALSE
 *            whenever a real b is present — the mutual-exclusivity rule),
 *            stripSentinel, SENTINEL export, zero-require discipline.
 *   G1..G3 — behavioral tests of the import-chokepoint guard via the EXPORTED
 *            buildImportCypher (src/api/neo4j/eventSync.js) — no stack needed:
 *            sentinel and malformed b values must derive NO phantom
 *            NostrEvent MERGE and no INHERITS_FROM/REFERENCES statement, while
 *            valid pointer/inherit values keep their derivation (regression).
 *   S1..S7 — structural pins, line-based only (the OPEN.md #109 lesson: no byte
 *            windows): route registrations carry requireOwner; the sentinel
 *            literal is byte-identical in its four homes; the b-surfaces skip it
 *            by name; the specs + worksheet carry the ruling; App.jsx gains no
 *            feature-named route (asserted by ABSENCE, never by count — the
 *            OPEN.md #143 lesson).
 *   H1..H8 — live-stack integration (SKIP when the stack is down): the two new
 *            owner-only endpoints round-trip against real headers (stable
 *            fixture d-tags, OPEN.md #128 — replaceable events, zero corpus
 *            growth), the sentinel replace/refuse semantics hold, the graph
 *            carries no phantom node, coverage b-values surface via the public
 *            Cypher read, and non-owner host callers are refused.
 *
 * EXPECTED NOW (pre-implementation):
 *   U1–U8 FAIL (src/lib/bValueForms.js does not exist);
 *   G1–G2 FAIL (the chokepoint MERGEs a phantom node for any truthy b value);
 *   G3 PASS (existing derivation — regression guard, must stay green);
 *   S1–S3, S5–S7 FAIL (routes, lib, UI util, skips, spec edits absent);
 *   S4 PASS (App.jsx untouched — regression guard);
 *   H1, H2, H4–H7 FAIL when the stack is up (new endpoints unrouted — the
 *     loopback caller is localTrusted, passes default-deny, and hits 404);
 *   H3 PASS when the stack is up (no phantom yet — regression guard);
 *   H8 PASS pre AND post (regression-class: an unauthenticated remote POST is
 *     401'd by the default-deny middleware BEFORE routing — security-auth
 *     0002 — so the refusal holds whether or not the routes exist);
 *   all H SKIP (recorded, never silent) when the stack is down.
 *
 * Fixture safety: live writes use STABLE d-tags (`b-coverage-fixture-s1a`,
 * `b-coverage-fixture-s1b`) on TA-signed kind-39998 headers, so each run
 * REPLACES the previous run's addressable event — zero corpus growth. Teardown
 * republishes each fixture bare (no b tags), best-effort. Fixture pubkeys are
 * non-secret literals (test files only — production code resolves the TA at
 * runtime, never hardcodes; CLAUDE.md).
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LIB_JS = path.join(ROOT, 'src/lib/bValueForms.js');
const EVENT_SYNC_JS = path.join(ROOT, 'src/api/neo4j/eventSync.js');
const API_INDEX_JS = path.join(ROOT, 'src/api/index.js');
const SELF_DECLARE_JS = path.join(ROOT, 'src/api/concept/selfDeclare.js');
const B_DISPOSITION_API_JS = path.join(ROOT, 'src/api/concept/bDisposition.js');
const UI_UTIL_JS = path.join(ROOT, 'ui/src/utils/bDisposition.js');
const APP_JSX = path.join(ROOT, 'ui/src/App.jsx');
const CONCEPT_LIST_JSX = path.join(ROOT, 'ui/src/pages/concepts/ConceptList.jsx');
const PANEL_JSX = path.join(ROOT, 'ui/src/components/DispositionPanel.jsx');
const HOOK_JS = path.join(ROOT, 'ui/src/hooks/useCommunitySharedConcepts.js');
const ACTIVE_B_JSX = path.join(ROOT, 'ui/src/pages/shared-concepts/ActiveBTags.jsx');
const B_DETAIL_JSX = path.join(ROOT, 'ui/src/pages/shared-concepts/BTagDetail.jsx');
const SELF_DECLARED_JSX = path.join(ROOT, 'ui/src/pages/shared-concepts/SelfDeclaredSharedConcepts.jsx');
const INHERIT_FROM_MD = path.join(ROOT, 'protocols/drafts/inherit-from.md');
const SHARED_CONCEPTS_MD = path.join(ROOT, 'protocols/drafts/shared-concepts.md');
const WORKSHEET_MD = path.join(ROOT, 'protocols/worksheet.md');

const SENTINEL = 'b-tag-deferred'; // the W16 ruling's reserved literal (test-file copy)

const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_PORT || '7778'}`;

// Fixture identities (non-secret literals; test files only).
const FIX_THIRD_PK = 'd'.repeat(63) + '4';
const FIX_A_DTAG = 'b-coverage-fixture-s1a';
const FIX_B_DTAG = 'b-coverage-fixture-s1b';
const EXT_TARGET = `39998:${FIX_THIRD_PK}:ext-shared-fixture`;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

// ── module loaders ─────────────────────────────────────────────────────

function libMod() {
  try { return require(LIB_JS); }
  catch { throw new Error('precondition: src/lib/bValueForms.js is missing (the U-class contract) — implement the pure value-form core first'); }
}

function eventSyncMod() {
  return require(EVENT_SYNC_JS); // ships today; G tests exercise buildImportCypher
}

// A minimal signed-shaped event for buildImportCypher (no signature checks there).
function importFixture(bTags) {
  return {
    id: 'f'.repeat(64),
    pubkey: 'e'.repeat(64),
    kind: 39998,
    created_at: 1754000000,
    content: '',
    tags: [['d', 'g-class-fixture'], ['names', 'g fixture', 'g fixtures'], ...bTags],
  };
}

function cypherText(event) {
  const out = eventSyncMod().buildImportCypher(event);
  if (Array.isArray(out)) return out.join('\n');
  if (typeof out === 'string') return out;
  return JSON.stringify(out);
}

// ── live-stack helpers (reads via host fetch; privileged writes via
//    docker-exec loopback → req.localTrusted; the house pattern) ────────

let _stack = null;
async function stack() {
  if (_stack) return _stack;
  try {
    const r = await fetch(`${HOST_BASE}/api/assistant/pubkey`, { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    _stack = (j && j.success && /^[0-9a-f]{64}$/.test(j.pubkey)) ? { up: true, ta: j.pubkey } : { up: false };
  } catch { _stack = { up: false }; }
  return _stack;
}

function dockerCurl(args) {
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], { encoding: 'utf8', timeout: 30000 });
}

function loopbackPostJson(pathname, body) {
  const out = dockerCurl(['-s', '-m', '25', '-X', 'POST', '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(body), `${CONTAINER_BASE}${pathname}`]);
  try { return JSON.parse(out); } catch { return { _raw: out }; }
}

async function hostPostJson(pathname, body) {
  const r = await fetch(`${HOST_BASE}${pathname}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}), signal: AbortSignal.timeout(20000),
  });
  let j = null; try { j = await r.json(); } catch { /* non-JSON */ }
  return { status: r.status, json: j };
}

async function scanHeader(ta, dTag) {
  const filter = encodeURIComponent(JSON.stringify({ kinds: [39998], authors: [ta], '#d': [dTag] }));
  const r = await fetch(`${HOST_BASE}/api/strfry/scan?filter=${filter}`, { signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  const events = j && (j.events || j.data || (Array.isArray(j) ? j : []));
  assert(Array.isArray(events), `strfry scan did not return an event array for ${dTag}: ${JSON.stringify(j).slice(0, 200)}`);
  return events.reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
}

function bValuesOf(ev) {
  return (ev && ev.tags ? ev.tags : []).filter((t) => t[0] === 'b').map((t) => t[1]);
}

function publishFixtureHeader(dTag, extraTags) {
  const event = {
    kind: 39998,
    content: '',
    tags: [['d', dTag], ['names', 'b-coverage fixture', 'b-coverage fixtures'], ...(extraTags || [])],
    created_at: Math.floor(Date.now() / 1000),
  };
  return loopbackPostJson('/api/strfry/publish', { event, signAs: 'assistant' });
}

async function cypherRows(cypher, params) {
  const { status, json } = await hostPostJson('/api/neo4j/query', { cypher, params: params || {} });
  assert(status === 200 && json && json.success !== false,
    `public read-Cypher failed (${status}): ${JSON.stringify(json).slice(0, 200)}`);
  return json.data || [];
}

// ═══ U — the pure value-form core ══════════════════════════════════════

test('U1: classifyBValue accepts the a-tag form across kinds', () => {
  const { classifyBValue } = libMod();
  const pk = 'a'.repeat(64);
  const fixtures = [`39998:${pk}:recipes`, `9998:${pk}:x`, `0:${pk}:slug-with-dashes`, `39999:${pk}:nested:colons:ok`];
  assert(fixtures.length === 4, 'fixture arity (OPEN.md #108)');
  for (const v of fixtures) {
    assert(classifyBValue(v) === 'a-tag', `expected 'a-tag' for ${v}, got '${classifyBValue(v)}'`);
  }
});

test('U2: classifyBValue accepts a bare 64-hex event id', () => {
  const { classifyBValue } = libMod();
  const v = '0123456789abcdef'.repeat(4);
  assert(classifyBValue(v) === 'event-id', `expected 'event-id' for a 64-hex value, got '${classifyBValue(v)}'`);
});

test('U3: classifyBValue recognizes exactly the reserved sentinel', () => {
  const { classifyBValue } = libMod();
  assert(classifyBValue(SENTINEL) === 'sentinel', `expected 'sentinel' for '${SENTINEL}', got '${classifyBValue(SENTINEL)}'`);
});

test('U4: classifyBValue fails closed on near-misses (malformed)', () => {
  const { classifyBValue } = libMod();
  const pk = 'a'.repeat(64);
  const fixtures = [
    'f'.repeat(63),               // 63-hex
    'f'.repeat(65),               // 65-hex
    `39998:${pk}:`,               // empty d-tag
    `39998:${'a'.repeat(63)}:x`,  // short pubkey
    `x:${pk}:y`,                  // non-numeric kind
    'B-TAG-DEFERRED',             // case matters — the literal is exact
    `${SENTINEL} `,               // trailing space
    '',                           // empty
  ];
  assert(fixtures.length === 8, 'fixture arity (OPEN.md #108)');
  for (const v of fixtures) {
    assert(classifyBValue(v) === 'malformed', `expected 'malformed' for ${JSON.stringify(v)}, got '${classifyBValue(v)}'`);
  }
});

test('U5: dispositionOf derives each single state', () => {
  const { dispositionOf } = libMod();
  const self = `39998:${'a'.repeat(64)}:recipes`;
  const foreign = `39998:${'b'.repeat(64)}:cooking`;
  const cases = [
    [[], { wired: false, selfDeclared: false, deferred: false }],
    [[self], { wired: false, selfDeclared: true, deferred: false }],
    [[foreign], { wired: true, selfDeclared: false, deferred: false }],
    [[SENTINEL], { wired: false, selfDeclared: false, deferred: true }],
  ];
  assert(cases.length === 4, 'fixture arity (OPEN.md #108)');
  for (const [values, want] of cases) {
    const got = dispositionOf(values, self);
    for (const k of Object.keys(want)) {
      assert(got[k] === want[k], `dispositionOf(${JSON.stringify(values)}).${k}: expected ${want[k]}, got ${got[k]}`);
    }
  }
});

test('U6: a real b beats a stale sentinel — deferred is false whenever any real b exists', () => {
  const { dispositionOf } = libMod();
  const self = `39998:${'a'.repeat(64)}:recipes`;
  const foreign = `39998:${'b'.repeat(64)}:cooking`;
  const got = dispositionOf([SENTINEL, foreign], self);
  assert(got.deferred === false, 'a header carrying both a sentinel and a real b must NOT read as deferred (mutual-exclusivity rule)');
  assert(got.wired === true, 'the real b must still read as wired');
  const both = dispositionOf([foreign, self], self);
  assert(both.wired === true && both.selfDeclared === true, 'wired and self-declared may coexist (multi-b headers are ratified)');
});

test('U7: stripSentinel removes only the sentinel b and preserves everything else in order', () => {
  const { stripSentinel } = libMod();
  const tags = [['d', 'x'], ['b', SENTINEL], ['names', 'n', 'ns'], ['b', `39998:${'c'.repeat(64)}:y`, 'pointer']];
  const out = stripSentinel(tags);
  assert(Array.isArray(out) && out.length === 3, `expected 3 tags after strip, got ${out && out.length}`);
  assert(out[0][0] === 'd' && out[1][0] === 'names' && out[2][0] === 'b', 'non-sentinel tags must survive in order');
  assert(!out.some((t) => t[0] === 'b' && t[1] === SENTINEL), 'the sentinel must be gone');
  const untouched = [['d', 'x'], ['b', `39998:${'c'.repeat(64)}:y`, 'pointer']];
  assert(stripSentinel(untouched).length === 2, 'stripSentinel is a no-op when no sentinel is present');
});

test('U8: the lib is zero-require and exports the exact reserved literal', () => {
  const src = safeRead(LIB_JS);
  assert(src, 'src/lib/bValueForms.js is missing');
  assert(!/\brequire\s*\(/.test(src), 'the pure core must have zero requires (the house lib pattern)');
  const { SENTINEL: exported } = libMod();
  assert(exported === SENTINEL, `SENTINEL must be exactly '${SENTINEL}', got '${exported}'`);
});

// ═══ G — the chokepoint guard, behaviorally ════════════════════════════

test('G1: a sentinel b derives NO phantom node and NO edge, while its plain tag node survives', () => {
  // The fixture carries exactly one b tag, so any derivation statement in the
  // output is necessarily the sentinel's — no positional scoping needed.
  const text = cypherText(importFixture([['b', SENTINEL]]));
  assert(!text.includes(`uuid: '${SENTINEL}'`),
    `buildImportCypher must not MERGE a NostrEvent keyed by the sentinel — phantom node (found uuid: '${SENTINEL}' in the generated Cypher)`);
  assert(!/INHERITS_FROM/.test(text) && !/source = 'b-tag'/.test(text),
    'no INHERITS_FROM or REFERENCES{source:b-tag} derivation may exist for a sentinel value');
  assert(/type = 'b'/.test(text), "the sentinel's plain NostrEventTag node must still be created (coverage reads it)");
});

test('G2: a malformed b value derives no edge and no phantom', () => {
  const text = cypherText(importFixture([['b', 'garbage-not-a-coordinate']]));
  assert(!text.includes("uuid: 'garbage-not-a-coordinate'"),
    'buildImportCypher must not MERGE a NostrEvent keyed by a malformed b value');
  assert(!/INHERITS_FROM/.test(text) && !/source = 'b-tag'/.test(text),
    'no derivation statement may exist for a malformed b value');
});

test('G3 (regression, passes pre AND post): valid pointer and inherit values keep their derivation', () => {
  const target = `39998:${'c'.repeat(64)}:cooking`;
  const pointer = cypherText(importFixture([['b', target, 'pointer']]));
  assert(pointer.includes("source = 'b-tag'") && pointer.includes(`uuid: '${target}'`),
    'a valid pointer-typed b must still derive REFERENCES{source:b-tag} to its target');
  const inherit = cypherText(importFixture([['b', target, 'inherit']]));
  assert(inherit.includes('INHERITS_FROM') && inherit.includes(`uuid: '${target}'`),
    'a valid inherit-typed b must still derive INHERITS_FROM');
});

// ═══ S — structural pins (line-based; no byte windows — OPEN.md #109) ══

test('S1: both disposition routes are registered and gate owner-only in-handler (loopback-operable)', () => {
  // ADR 0001's dated correction: requireOwner middleware is session-only and
  // blocks the localTrusted class the H rows and operational scripts need; the
  // shipped pattern is the in-handler gate (publishEvent.js:37, the brain
  // module). Pin the corrected contract: routes registered without middleware,
  // one gate helper carrying BOTH classes, invoked first in BOTH handlers.
  const src = safeRead(API_INDEX_JS);
  assert(src, 'src/api/index.js unreadable');
  const lines = src.split('\n');
  const appendLine = lines.find((l) => l.includes("'/api/concept/:handle/b-append'"));
  const deferLine = lines.find((l) => l.includes("'/api/concept/:handle/b-defer'"));
  assert(appendLine, 'POST /api/concept/:handle/b-append is not registered');
  assert(deferLine, 'POST /api/concept/:handle/b-defer is not registered');
  const bd = safeRead(B_DISPOSITION_API_JS);
  assert(bd, 'src/api/concept/bDisposition.js is missing');
  assert(/isOwner\(req\)\s*\|\|\s*req\.localTrusted/.test(bd),
    'the gate must carry exactly the owner-or-localTrusted pair (publishEvent.js:37 pattern)');
  const gateCalls = (bd.match(/refuseUnlessOwnerOrLocal\(req,\s*res\)/g) || []).length;
  assert(gateCalls >= 2, `both handlers must invoke the gate first (found ${gateCalls} call sites)`);
});

test('S2: the chokepoint requires the value-form lib', () => {
  const src = safeRead(EVENT_SYNC_JS);
  assert(src, 'eventSync.js unreadable');
  assert(/require\([^)]*bValueForms/.test(src),
    'eventSync.js must consume src/lib/bValueForms.js — the guard has one code owner (ADR 0001; the behavioral contract is G1/G2)');
});

test('S3: the sentinel literal is byte-identical in its four homes, and selfDeclare carries the strip carve-out', () => {
  const homes = [
    [LIB_JS, 'src/lib/bValueForms.js'],
    [UI_UTIL_JS, 'ui/src/utils/bDisposition.js'],
    [INHERIT_FROM_MD, 'protocols/drafts/inherit-from.md'],
    [SHARED_CONCEPTS_MD, 'protocols/drafts/shared-concepts.md'],
  ];
  assert(homes.length === 4, 'fixture arity (OPEN.md #108)');
  for (const [p, label] of homes) {
    const src = safeRead(p);
    assert(src, `${label} is missing`);
    assert(src.includes(SENTINEL), `${label} must carry the exact literal '${SENTINEL}'`);
  }
  const sd = safeRead(SELF_DECLARE_JS);
  assert(sd && (/stripSentinel/.test(sd) || /SENTINEL/.test(sd)),
    'selfDeclare.js must strip the sentinel before appending the self-coord (the ADR 0001 carve-out)');
});

test('S4 (regression, passes pre AND post): App.jsx gains no feature-named route — asserted by absence, never by count (OPEN.md #143)', () => {
  const src = safeRead(APP_JSX);
  assert(src, 'ui/src/App.jsx unreadable');
  const paths = [...src.matchAll(/\bpath:\s*['"`]([^'"`]*)['"`]/g)].map((m) => m[1]);
  const suspicious = paths.filter((p) => /disposition|b-coverage|coverage-audit/i.test(p));
  assert(suspicious.length === 0,
    `the flow lives on the existing ConceptList page — no new route (found ${JSON.stringify(suspicious)})`);
});

test('S5: the b-surfaces skip the sentinel by name via the UI util', () => {
  const surfaces = [
    [ACTIVE_B_JSX, 'ActiveBTags.jsx'],
    [B_DETAIL_JSX, 'BTagDetail.jsx'],
    [SELF_DECLARED_JSX, 'SelfDeclaredSharedConcepts.jsx'],
  ];
  assert(surfaces.length === 3, 'fixture arity (OPEN.md #108)');
  for (const [p, label] of surfaces) {
    const src = safeRead(p);
    assert(src, `${label} is missing`);
    assert(/utils\/bDisposition/.test(src) || src.includes(SENTINEL),
      `${label} must skip the sentinel deliberately (import the UI util or reference the literal)`);
  }
});

test('S6: the spec ruling landed — inherit-from reserves the literal, shared-concepts carries the ruling, W16 graduated', () => {
  const inh = safeRead(INHERIT_FROM_MD);
  assert(inh && /reserved/i.test(inh) && inh.includes(SENTINEL),
    'inherit-from.md must reserve the sentinel as the third value form');
  const sc = safeRead(SHARED_CONCEPTS_MD);
  assert(sc && /non-affiliation/i.test(sc),
    'shared-concepts.md must carry the deliberate-non-affiliation ruling');
  const ws = safeRead(WORKSHEET_MD);
  const w16 = ws && ws.split(/^## /m).find((s) => s.startsWith('W16'));
  assert(w16, 'worksheet W16 section missing');
  assert(/\*\*Status:\*\*\s*Graduated/.test(w16), 'W16 must flip to Graduated in this story');
});

test('S7: the UI seams exist — mirror util, panel component, extracted hook, coverage in the ConceptList query', () => {
  assert(fs.existsSync(UI_UTIL_JS), 'ui/src/utils/bDisposition.js (the UI mirror) is missing');
  assert(fs.existsSync(PANEL_JSX), 'ui/src/components/DispositionPanel.jsx is missing');
  assert(fs.existsSync(HOOK_JS), 'ui/src/hooks/useCommunitySharedConcepts.js is missing');
  const sd = safeRead(SELF_DECLARED_JSX);
  assert(sd && /useCommunitySharedConcepts/.test(sd),
    'SelfDeclaredSharedConcepts.jsx must re-point to the extracted hook (behavior-preserving)');
  const cl = safeRead(CONCEPT_LIST_JSX);
  assert(cl && /bValues/.test(cl) && /NostrEventTag\s*\{type:\s*'b'\}/.test(cl),
    "ConceptList's QUERY must collect b-tag values (the coverage read)");
  assert(cl && /utils\/bDisposition/.test(cl), 'ConceptList must classify via the UI util');
});

// ═══ H — live integration (SKIP when the stack is down) ════════════════

test('H1: b-defer stamps exactly one sentinel on a bare header (fixture created via the shipped publish path)', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const pub = publishFixtureHeader(FIX_A_DTAG);
  assert(pub && pub.success === true, `fixture publish failed: ${JSON.stringify(pub).slice(0, 200)}`);
  const resp = loopbackPostJson(`/api/concept/${encodeURIComponent(`39998:${s.ta}:${FIX_A_DTAG}`)}/b-defer`, {});
  assert(resp && resp.success === true, `b-defer failed: ${JSON.stringify(resp).slice(0, 200)}`);
  const ev = await scanHeader(s.ta, FIX_A_DTAG);
  const bs = bValuesOf(ev);
  assert(bs.length === 1 && bs[0] === SENTINEL, `expected exactly one sentinel b, got ${JSON.stringify(bs)}`);
});

test('H2: re-defer is idempotent — still exactly one sentinel, no new version spam', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const resp = loopbackPostJson(`/api/concept/${encodeURIComponent(`39998:${s.ta}:${FIX_A_DTAG}`)}/b-defer`, {});
  assert(resp && resp.success === true, `repeat b-defer failed: ${JSON.stringify(resp).slice(0, 200)}`);
  const bs = bValuesOf(await scanHeader(s.ta, FIX_A_DTAG));
  assert(bs.filter((v) => v === SENTINEL).length === 1, `idempotency: expected one sentinel, got ${JSON.stringify(bs)}`);
});

test('H3 (regression, passes pre AND post): the graph holds no phantom node keyed by the sentinel', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const rows = await cypherRows("MATCH (e:NostrEvent {uuid: $u}) RETURN e.uuid AS uuid", { u: SENTINEL });
  assert(rows.length === 0, `a phantom NostrEvent {uuid: '${SENTINEL}'} exists in the graph — the chokepoint guard is not holding`);
});

test('H4: b-append replaces the sentinel with a real pointer b, and the graph carries the coverage value', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const resp = loopbackPostJson(`/api/concept/${encodeURIComponent(`39998:${s.ta}:${FIX_A_DTAG}`)}/b-append`, { target: EXT_TARGET });
  assert(resp && resp.success === true, `b-append failed: ${JSON.stringify(resp).slice(0, 200)}`);
  assert(resp.event && Array.isArray(resp.event.tags), 'b-append must return the signed event for community broadcast');
  const bs = bValuesOf(await scanHeader(s.ta, FIX_A_DTAG));
  assert(bs.includes(EXT_TARGET), `the external target must be present, got ${JSON.stringify(bs)}`);
  assert(!bs.includes(SENTINEL), 'the sentinel must be REPLACED by the real b (re-disposition rule)');
  const rows = await cypherRows(
    "MATCH (h:NostrEvent {uuid: $u})-[:HAS_TAG]->(bt:NostrEventTag {type: 'b'}) RETURN collect(bt.value) AS bValues",
    { u: `39998:${s.ta}:${FIX_A_DTAG}` });
  const graphBs = (rows[0] && (rows[0].bValues || rows[0]['bValues'])) || [];
  assert(graphBs.includes(EXT_TARGET), `the ConceptList coverage read must see the b value in the graph, got ${JSON.stringify(graphBs)}`);
});

test('H5: defer refuses when a real b exists — domain refusal, header unchanged', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const resp = loopbackPostJson(`/api/concept/${encodeURIComponent(`39998:${s.ta}:${FIX_A_DTAG}`)}/b-defer`, {});
  assert(resp && resp.success === false, `b-defer on a wired header must refuse, got ${JSON.stringify(resp).slice(0, 200)}`);
  const bs = bValuesOf(await scanHeader(s.ta, FIX_A_DTAG));
  assert(bs.includes(EXT_TARGET) && !bs.includes(SENTINEL), `the refused defer must leave the header unchanged, got ${JSON.stringify(bs)}`);
});

test('H6: b-append is idempotent on a repeated target', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const resp = loopbackPostJson(`/api/concept/${encodeURIComponent(`39998:${s.ta}:${FIX_A_DTAG}`)}/b-append`, { target: EXT_TARGET });
  assert(resp && resp.success === true, `repeat b-append failed: ${JSON.stringify(resp).slice(0, 200)}`);
  const bs = bValuesOf(await scanHeader(s.ta, FIX_A_DTAG));
  assert(bs.filter((v) => v === EXT_TARGET).length === 1, `no duplicate b for a repeated target, got ${JSON.stringify(bs)}`);
});

test('H7: self-declare after defer replaces the sentinel with the self-coordinate', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const selfCoord = `39998:${s.ta}:${FIX_B_DTAG}`;
  const pub = publishFixtureHeader(FIX_B_DTAG);
  assert(pub && pub.success === true, `fixture B publish failed: ${JSON.stringify(pub).slice(0, 200)}`);
  const defer = loopbackPostJson(`/api/concept/${encodeURIComponent(selfCoord)}/b-defer`, {});
  assert(defer && defer.success === true, `b-defer on fixture B failed: ${JSON.stringify(defer).slice(0, 200)}`);
  const declare = loopbackPostJson(`/api/concept/${encodeURIComponent(selfCoord)}/self-declare`, {});
  assert(declare && declare.success === true, `self-declare after defer failed: ${JSON.stringify(declare).slice(0, 200)}`);
  const bs = bValuesOf(await scanHeader(s.ta, FIX_B_DTAG));
  assert(bs.includes(selfCoord), `the self-coordinate b must be present, got ${JSON.stringify(bs)}`);
  assert(!bs.includes(SENTINEL), 'the sentinel must be gone after self-declare (the strip carve-out)');
});

test('H8: non-owner host callers are refused, and fixtures tear down bare', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  try {
    const { status } = await hostPostJson(`/api/concept/${encodeURIComponent(`39998:${s.ta}:${FIX_A_DTAG}`)}/b-defer`, {});
    assert(status === 401 || status === 403,
      `an unauthenticated host caller must be refused with 401/403, got ${status}`);
  } finally {
    publishFixtureHeader(FIX_A_DTAG); // bare republish resets state (stable d-tag)
    publishFixtureHeader(FIX_B_DTAG);
  }
});

// ═══ runner ════════════════════════════════════════════════════════════

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${t.name}`); skipped++; }
      else { console.log(`  ✓ ${t.name}`); pass++; }
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      failures.push({ name: t.name, message: err.message });
      fail++;
    }
  }
  console.log(`\nb-coverage-audit-and-disposition: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
