/**
 * shared-concepts-adoption #3 — inverse queue (publish candidates).
 * Story: engineering-team/stories/shared-concepts-adoption/3-inverse-queue-publish-candidates.md
 * ADR:   engineering-team/decisions/shared-concepts-adoption/0003-inverse-queue-publish-candidates.md
 * Book:  engineering-team/audits/shared-concepts-adoption/book.md
 *
 * Three classes:
 *
 *   U1..U7 — pure tests of computePublishCandidates (src/lib/adoptionQueue.js,
 *            zero-require; b-state classification happens at the HANDLER seam
 *            per ADR 0003, so the core takes pre-classified
 *            {coord, name, bState} headers): population (bState 'none' ∧
 *            cross-author usage), both evidence kinds counted cross-author-only
 *            and DISTINGUISHABLY (z filings vs b affiliations), the
 *            deferred-in-use split, 'real' exclusion, sorting, empties.
 *   S1..S4 — structural pins (line-based; OPEN.md #109/#143 discipline): the
 *            endpoint's additive response keys + seam classification import;
 *            the page's three-view control + collapsed reveal + extracted
 *            action helpers (panel re-pointed); no new route (name-based); the
 *            lib exports the new function while computeQueue stays exported.
 *   H1..H5 — live-stack integration (SKIP when the stack is down; the OPEN.md
 *            #144 nextStamp discipline on every fixture write): a bare TA
 *            header with a foreign z-filing AND a foreign b-affiliation
 *            appears as a publish candidate with both evidence kinds;
 *            self-declare removes it and stamps the self-b; defer moves a
 *            second fixture to deferredInUse; submit-from-reveal strips the
 *            sentinel; F1's response arrays stay present and untouched by the
 *            fixtures (regression).
 *
 * EXPECTED NOW (pre-implementation):
 *   U1–U7 FAIL (computePublishCandidates is not exported);
 *   S1, S2 FAIL (endpoint keys, UI seams, action helpers absent);
 *   S3 PASS (no new route — regression guard);
 *   S4 FAIL on its first assert (new export missing), its computeQueue
 *     regression half is reached only after implementation;
 *   H1–H4 FAIL when the stack is up (the response lacks the new arrays);
 *   H5 PASS (F1's arrays present — regression guard);
 *   all H SKIP (recorded) when the stack is down.
 *
 * Fixture safety: stable d-tags, every write out-stamps the coordinate's
 * current version (nextStamp — OPEN.md #144), teardown republishes bare.
 * The foreign identity is F1's deliberately NON-SECRET throwaway key.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LIB_JS = path.join(ROOT, 'src/lib/adoptionQueue.js');
const ADOPTION_API_JS = path.join(ROOT, 'src/api/adoption/index.js');
const APP_JSX = path.join(ROOT, 'ui/src/App.jsx');
const QUEUE_PAGE_JSX = path.join(ROOT, 'ui/src/pages/shared-concepts/AdoptionQueue.jsx');
const PANEL_JSX = path.join(ROOT, 'ui/src/components/DispositionPanel.jsx');
const ACTIONS_JS = path.join(ROOT, 'ui/src/utils/dispositionActions.js');

const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_PORT || '7778'}`;

const FOREIGN_SK = Uint8Array.from(Array(32).fill(7)); // F1's non-secret throwaway
const MINE_A_DTAG = 'publish-candidate-fixture-f2a';
const MINE_B_DTAG = 'publish-candidate-fixture-f2b';
const CARRIER_Z_DTAG = 'publish-evidence-z-fixture-f2';
const CARRIER_B_DTAG = 'publish-evidence-b-fixture-f2';
const SENTINEL = 'b-tag-deferred';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

function libMod() { return require(LIB_JS); }
function fnOrFail() {
  const { computePublishCandidates } = libMod();
  assert(typeof computePublishCandidates === 'function',
    'computePublishCandidates must be exported from src/lib/adoptionQueue.js (ADR 0003) — implement the pure sibling first');
  return computePublishCandidates;
}

// ── U fixtures (pre-classified headers per the ADR's seam contract) ────

const TA = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const OTHER2 = 'c'.repeat(64);
const myCoord = (d) => `39998:${TA}:${d}`;

const myHeader = (d, bState) => ({ coord: myCoord(d), name: d, bState });
function zc(pk, target) {
  return { pubkey: pk, id: Math.random().toString(16).slice(2).padEnd(64, 'e').slice(0, 64), tags: [['z', target]] };
}
function bc(pk, target) {
  return { pubkey: pk, id: Math.random().toString(16).slice(2).padEnd(64, 'd').slice(0, 64), tags: [['b', target, 'pointer']] };
}
const base = (over) => ({ myHeaders: [], zCarriers: [], bCarriers: [], taPubkey: TA, ...over });

// ═══ U — the publish-candidates arithmetic ═════════════════════════════

test('U1: empty inputs → empty candidates and empty deferred-in-use', () => {
  const out = fnOrFail()(base());
  assert(Array.isArray(out.candidates) && out.candidates.length === 0, 'no inputs → no candidates');
  assert(Array.isArray(out.deferredInUse) && out.deferredInUse.length === 0, 'no inputs → nothing deferred-in-use');
});

test('U2: population — a no-b header with cross-author z-usage is a candidate; my own filings and zero usage are not', () => {
  const out = fnOrFail()(base({
    myHeaders: [myHeader('recipes', 'none'), myHeader('selfish', 'none'), myHeader('silent', 'none')],
    zCarriers: [
      zc(OTHER, myCoord('recipes')),  // cross-author → evidence
      zc(TA, myCoord('selfish')),     // my own filing → never evidence
    ],
  }));
  const coords = out.candidates.map((c) => c.coord);
  assert(coords.includes(myCoord('recipes')), 'cross-author z-usage must nominate');
  assert(!coords.includes(myCoord('selfish')), "the instance's own filings are never evidence");
  assert(!coords.includes(myCoord('silent')), 'zero usage must not nominate');
});

test('U3: b-affiliation evidence — a foreign b pointing at my header nominates; my own inter-header wiring does not', () => {
  const out = fnOrFail()(base({
    myHeaders: [myHeader('recipes', 'none'), myHeader('wired-by-me', 'none')],
    bCarriers: [
      bc(OTHER, myCoord('recipes')),      // foreign affiliation → evidence
      bc(TA, myCoord('wired-by-me')),     // my own wiring → never evidence
    ],
  }));
  const coords = out.candidates.map((c) => c.coord);
  assert(coords.includes(myCoord('recipes')), 'a foreign b-affiliation must nominate');
  assert(!coords.includes(myCoord('wired-by-me')), 'my own inter-header b is never evidence');
});

test('U4: the two evidence kinds are counted distinguishably and cross-author-only', () => {
  const out = fnOrFail()(base({
    myHeaders: [myHeader('recipes', 'none')],
    zCarriers: [zc(OTHER, myCoord('recipes')), zc(OTHER, myCoord('recipes')), zc(OTHER2, myCoord('recipes')), zc(TA, myCoord('recipes'))],
    bCarriers: [bc(OTHER, myCoord('recipes'))],
  }));
  assert(out.candidates.length === 1, `one candidate expected, got ${out.candidates.length}`);
  const c = out.candidates[0];
  assert(c.filingEvents === 3, `filing events: OTHER×2 + OTHER2×1 = 3 (TA's own excluded), got ${c.filingEvents}`);
  assert(c.filingAuthors === 2, `filing authors: 2, got ${c.filingAuthors}`);
  assert(c.affiliationEvents === 1, `affiliation events: 1, got ${c.affiliationEvents}`);
  assert(c.affiliationAuthors === 1, `affiliation authors: 1, got ${c.affiliationAuthors}`);
});

test('U5: bState routing — real is excluded even with usage; deferred with usage goes to deferred-in-use only; deferred without usage goes nowhere', () => {
  const out = fnOrFail()(base({
    myHeaders: [myHeader('declared', 'real'), myHeader('private-used', 'deferred'), myHeader('private-quiet', 'deferred')],
    zCarriers: [zc(OTHER, myCoord('declared')), zc(OTHER, myCoord('private-used'))],
  }));
  assert(out.candidates.length === 0, 'real and deferred headers must never be candidates');
  const d = out.deferredInUse.map((x) => x.coord);
  assert(d.includes(myCoord('private-used')), 'a deferred header WITH cross-author usage must surface in deferred-in-use');
  assert(!d.includes(myCoord('private-quiet')), 'a deferred header with no usage stays hidden entirely');
  assert(!d.includes(myCoord('declared')), 'a real-b header never appears in deferred-in-use');
});

test('U6: candidates sort by total cross-author usage', () => {
  const out = fnOrFail()(base({
    myHeaders: [myHeader('small', 'none'), myHeader('big', 'none')],
    zCarriers: [zc(OTHER, myCoord('small')), zc(OTHER, myCoord('big')), zc(OTHER2, myCoord('big'))],
    bCarriers: [bc(OTHER, myCoord('big'))],
  }));
  assert(out.candidates[0].coord === myCoord('big'),
    `the most-used candidate sorts first, got ${out.candidates.map((c) => c.coord).join(', ')}`);
});

test('U7: the lib stays zero-require and computeQueue remains exported beside the new function', () => {
  const src = safeRead(LIB_JS);
  assert(src && !/\brequire\s*\(/.test(src), 'the pure core must remain zero-require');
  fnOrFail();
  assert(typeof libMod().computeQueue === 'function', 'computeQueue must remain exported (F1 unregressed)');
});

// ═══ S — structural pins ═══════════════════════════════════════════════

test('S1: the endpoint grows the additive keys and classifies at the seam', () => {
  const mod = safeRead(ADOPTION_API_JS);
  assert(mod, 'src/api/adoption/index.js unreadable');
  assert(/publishCandidates/.test(mod) && /deferredInUse/.test(mod),
    'the response must carry publishCandidates + deferredInUse (additive — ADR 0003)');
  assert(/require\([^)]*bValueForms/.test(mod) && /dispositionOf/.test(mod),
    'b-state classification happens at the handler seam via bValueForms.dispositionOf — the semantics single owner');
  assert(/computePublishCandidates/.test(mod), 'the handler must delegate the arithmetic to the pure sibling');
});

test('S2: the UI seams exist — three-view control, collapsed reveal, extracted action helpers, panel re-pointed', () => {
  const page = safeRead(QUEUE_PAGE_JSX);
  assert(page, 'AdoptionQueue.jsx unreadable');
  assert(/Mine to publish/i.test(page) && /Theirs to adopt/i.test(page),
    'the page must present the two queues as one adoption loop (three-view control)');
  assert(/kept-private headers have active usage/i.test(page),
    'the deferred-but-in-use collapsed reveal line must be present (the story\'s pinned behavior)');
  assert(fs.existsSync(ACTIONS_JS), 'ui/src/utils/dispositionActions.js (the extraction) is missing');
  const panel = safeRead(PANEL_JSX);
  assert(panel && /utils\/dispositionActions/.test(panel),
    'DispositionPanel must re-point to the extracted helpers (behavior-preserving)');
  assert(/utils\/dispositionActions/.test(page), 'the page must use the same extracted helpers');
});

test('S3 (regression, passes pre AND post): no new route — the view lives on the existing page', () => {
  const app = safeRead(APP_JSX);
  assert(app, 'App.jsx unreadable');
  const paths = [...app.matchAll(/\bpath:\s*['"`]([^'"`]*)['"`]/g)].map((m) => m[1]);
  assert(!paths.some((p) => /publish-candidate|inverse-queue|mine-to-publish/i.test(p)),
    'F2 adds no route (asserted by name — OPEN.md #143 discipline)');
  assert(paths.includes('adoption-queue'), "the existing 'adoption-queue' route must still be registered");
});

test('S4: the lib exports the sibling and the suite header contract holds', () => {
  fnOrFail();
  const src = safeRead(LIB_JS);
  assert(/computePublishCandidates/.test(src) && /computeQueue/.test(src),
    'both queue functions must live in the one arithmetic home');
});

// ═══ H — live integration (SKIP when the stack is down) ════════════════

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
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], { encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 });
}
function loopbackPostJson(pathname, body) {
  const out = dockerCurl(['-s', '-m', '25', '-X', 'POST', '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(body), `${CONTAINER_BASE}${pathname}`]);
  try { return JSON.parse(out); } catch { return { _raw: out }; }
}
async function hostGetJson(pathname) {
  const r = await fetch(`${HOST_BASE}${pathname}`, { signal: AbortSignal.timeout(25000) });
  let j = null; try { j = await r.json(); } catch { }
  return { status: r.status, json: j };
}
async function currentStamp(filter) {
  try {
    const f = encodeURIComponent(JSON.stringify(filter));
    const r = await fetch(`${HOST_BASE}/api/strfry/scan?filter=${f}`, { signal: AbortSignal.timeout(15000) });
    const j = await r.json();
    const events = j.events || j.data || [];
    return events.reduce((m, e) => Math.max(m, e.created_at || 0), 0);
  } catch { return 0; }
}
async function nextStamp(filter) {
  return Math.max(Math.floor(Date.now() / 1000), (await currentStamp(filter)) + 1);
}
async function publishTaEvent(dTag, kind, extraTags) {
  const s = await stack();
  const created_at = await nextStamp({ kinds: [kind], authors: [s.ta], '#d': [dTag] });
  return loopbackPostJson('/api/strfry/publish', {
    event: { kind, content: '', tags: [['d', dTag], ['name', dTag], ...(extraTags || [])], created_at },
    signAs: 'assistant',
  });
}
function foreignPk() { return require('nostr-tools').getPublicKey(FOREIGN_SK); }
async function publishForeignEvent(dTag, kind, extraTags) {
  const { finalizeEvent } = require('nostr-tools');
  const created_at = await nextStamp({ kinds: [kind], authors: [foreignPk()], '#d': [dTag] });
  const event = finalizeEvent({
    kind, content: '', tags: [['d', dTag], ['name', dTag], ...(extraTags || [])], created_at,
  }, FOREIGN_SK);
  return loopbackPostJson('/api/strfry/publish', { event, signAs: 'client' });
}
async function scanMyHeader(dTag) {
  const s = await stack();
  const f = encodeURIComponent(JSON.stringify({ kinds: [39998], authors: [s.ta], '#d': [dTag] }));
  const r = await fetch(`${HOST_BASE}/api/strfry/scan?filter=${f}`, { signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  const events = j.events || j.data || [];
  return events.reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
}

async function queue() {
  const { status, json } = await hostGetJson('/api/adoption-queue');
  assert(status === 200 && json && json.success !== false,
    `GET /api/adoption-queue failed (${status}): ${JSON.stringify(json).slice(0, 200)}`);
  assert(Array.isArray(json.nominations) && Array.isArray(json.declined),
    'F1 arrays must stay present');
  assert(Array.isArray(json.publishCandidates) && Array.isArray(json.deferredInUse),
    `the response must carry publishCandidates[] and deferredInUse[] (ADR 0003 additive keys); got keys ${Object.keys(json).join(',')}`);
  return json;
}
async function queueUntil(predicate, label) {
  let last = null;
  for (let i = 0; i < 12; i++) {
    last = await queue();
    if (predicate(last)) return last;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} — not observed within 6s; publishCandidates=${JSON.stringify((last.publishCandidates || []).map((c) => c.coord)).slice(0, 200)} deferredInUse=${JSON.stringify((last.deferredInUse || []).map((d) => d.coord)).slice(0, 200)}`);
}

const mineCoord = async (d) => `39998:${(await stack()).ta}:${d}`;

test('H1: a bare TA header with foreign z AND b evidence is a publish candidate carrying both counts', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const pm = await publishTaEvent(MINE_A_DTAG, 39998, [['names', 'publish candidate fixture', 'x']]);
  assert(pm.success === true, `my-header fixture publish failed: ${JSON.stringify(pm).slice(0, 200)}`);
  const target = await mineCoord(MINE_A_DTAG);
  const pz = await publishForeignEvent(CARRIER_Z_DTAG, 39999, [['z', target]]);
  const pb = await publishForeignEvent(CARRIER_B_DTAG, 39998, [['b', target, 'pointer']]);
  assert(pz.success === true && pb.success === true, 'foreign evidence publishes failed');
  const q = await queueUntil((x) => x.publishCandidates.some((c) => c.coord === target), 'the fixture must be a publish candidate');
  const c = q.publishCandidates.find((x) => x.coord === target);
  assert(c.filingEvents >= 1 && c.filingAuthors >= 1, `z-filing evidence must be counted, got ${JSON.stringify(c)}`);
  assert(c.affiliationEvents >= 1 && c.affiliationAuthors >= 1, `b-affiliation evidence must be counted, got ${JSON.stringify(c)}`);
});

test('H2: self-declare removes the candidate and stamps the self-b', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const target = await mineCoord(MINE_A_DTAG);
  const resp = loopbackPostJson(`/api/concept/${encodeURIComponent(target)}/self-declare`, {});
  assert(resp && resp.success === true, `self-declare failed: ${JSON.stringify(resp).slice(0, 200)}`);
  await queueUntil((x) => !x.publishCandidates.some((c) => c.coord === target), 'an accepted candidate must leave the view');
  const ev = await scanMyHeader(MINE_A_DTAG);
  assert((ev.tags || []).some((t) => t[0] === 'b' && t[1] === target), 'the header must now carry its self-pointing b');
});

test('H3: keep-private moves a used header to deferred-in-use', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const pm = await publishTaEvent(MINE_B_DTAG, 39998, [['names', 'publish candidate fixture b', 'x']]);
  assert(pm.success === true, 'fixture b publish failed');
  const target = await mineCoord(MINE_B_DTAG);
  const pz = await publishForeignEvent(CARRIER_Z_DTAG, 39999, [['z', target]]);
  assert(pz.success === true, 'foreign z evidence re-point failed');
  await queueUntil((x) => x.publishCandidates.some((c) => c.coord === target), 'fixture b must first be a candidate');
  const resp = loopbackPostJson(`/api/concept/${encodeURIComponent(target)}/b-defer`, {});
  assert(resp && resp.success === true, `b-defer failed: ${JSON.stringify(resp).slice(0, 200)}`);
  await queueUntil((x) => !x.publishCandidates.some((c) => c.coord === target)
    && x.deferredInUse.some((d) => d.coord === target),
  'a declined candidate must leave the view and surface in deferred-in-use');
});

test('H4: submit-from-reveal strips the sentinel (the un-defer path)', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const target = await mineCoord(MINE_B_DTAG);
  const resp = loopbackPostJson(`/api/concept/${encodeURIComponent(target)}/self-declare`, {});
  assert(resp && resp.success === true, `self-declare after defer failed: ${JSON.stringify(resp).slice(0, 200)}`);
  await queueUntil((x) => !x.deferredInUse.some((d) => d.coord === target), 'the header must leave deferred-in-use');
  const ev = await scanMyHeader(MINE_B_DTAG);
  const bs = (ev.tags || []).filter((t) => t[0] === 'b').map((t) => t[1]);
  assert(bs.includes(target), 'the self-b must be present');
  assert(!bs.includes(SENTINEL), 'the sentinel must be stripped (F5\'s carve-out, exercised from this surface)');
});

test('H5 (regression, passes pre AND post): F1\'s arrays stay present and unpolluted by these fixtures — then teardown', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  try {
    const { status, json } = await hostGetJson('/api/adoption-queue');
    assert(status === 200 && Array.isArray(json.nominations) && Array.isArray(json.declined),
      'F1 response arrays must remain intact');
    const target = await mineCoord(MINE_A_DTAG);
    assert(!json.nominations.some((n) => n.coord === target),
      'my headers never appear in the adopt-theirs nominations');
  } finally {
    await publishTaEvent(MINE_A_DTAG, 39998, [['names', 'publish candidate fixture', 'x']]);
    await publishTaEvent(MINE_B_DTAG, 39998, [['names', 'publish candidate fixture b', 'x']]);
    await publishForeignEvent(CARRIER_Z_DTAG, 39999);
    await publishForeignEvent(CARRIER_B_DTAG, 39998);
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
  console.log(`\ninverse-queue-publish-candidates: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
