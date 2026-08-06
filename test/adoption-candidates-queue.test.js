/**
 * shared-concepts-adoption #2 — adoption-candidates queue.
 * Story: engineering-team/stories/shared-concepts-adoption/2-adoption-candidates-queue.md
 * ADR:   engineering-team/decisions/shared-concepts-adoption/0002-adoption-candidates-queue.md
 * Book:  engineering-team/audits/shared-concepts-adoption/book.md
 *
 * Four classes:
 *
 *   U1..U8 — pure tests of src/lib/adoptionQueue.js (zero-require CJS, the
 *            single owner of the queue arithmetic): the S3 base (cross-author
 *            usage only; self-filed excluded), the three exclusions (wired /
 *            recognized / latest-disposition-declined), usage counts +
 *            usedByMe, latest-per-target supersede chains, the
 *            tie-toward-visibility rule, the declined view's data.
 *   S1..S5 — structural pins, line-based / structure-bounded only (OPEN.md
 *            #109): the queue GET and the gated producer registered; the
 *            producer's function body carries the F5 gate pair BEFORE any
 *            mint; the ledger concept never appears under firmware/; the UI
 *            seams exist (route asserted BY NAME — presence, never a count:
 *            OPEN.md #143); the strfryScan helper is exported and shared, not
 *            copied (OPEN.md #142).
 *   H1..H6 — live-stack integration (SKIP when the stack is down): a
 *            client-signed foreign fixture header + a TA z-carrier appear as
 *            a nomination with correct evidence; decline removes it and the
 *            Declined view lists it; requeue returns it; wiring a twin
 *            (F5's b-append) removes it; the disposition producer refuses
 *            remote unauthenticated callers (401, default-deny — regression-
 *            class) and unknown disposition words; full teardown.
 *
 * EXPECTED NOW (pre-implementation):
 *   U1–U8 FAIL (src/lib/adoptionQueue.js does not exist);
 *   S1, S2, S4, S5 FAIL (routes, producer, UI seams, shared export absent);
 *   S3 PASS (nothing under firmware/ — regression guard, must stay green);
 *   H1–H5 FAIL when the stack is up (the queue GET and producer are
 *     unrouted: loopback callers reach routing and 404; host GET 404s);
 *   H6's 401 half PASSES pre AND post (default-deny refuses unauthenticated
 *     remote POSTs before routing — security-auth 0002); its bad-word half
 *     FAILS pre (unrouted → no {success:false} envelope);
 *   all H SKIP (recorded, never silent) when the stack is down.
 *
 * Fixture safety (OPEN.md #128): all live writes are replaceable events with
 * STABLE d-tags — the foreign header (`adoption-queue-fixture-f1`, signed by
 * a deliberately NON-SECRET throwaway key: test files only; production code
 * never hardcodes keys), the TA z-carrier (`adoption-carrier-fixture-f1`),
 * and the TA twin (`adoption-twin-fixture-f1`) — so each run REPLACES the
 * prior run's events and teardown republishes them bare (no z, no b): zero
 * visible corpus growth. Accepted bounded residue, named in the test plan:
 * ledger records are append-only BY DESIGN (nonce d-tags), so each full run
 * leaves a declined+requeued pair of dated records whose names carry the
 * fixture slug — recognizable, excluded-from-queue by the bare teardown
 * (zero usage), and sweepable by name. The recognized-exclusion path is
 * U-covered only (U5); an H row would mint a PERMANENT registry element per
 * run (create-element has no teardown), which #128 forbids — gap recorded in
 * the test plan.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LIB_JS = path.join(ROOT, 'src/lib/adoptionQueue.js');
const ADOPTION_API_JS = path.join(ROOT, 'src/api/adoption/index.js');
const API_INDEX_JS = path.join(ROOT, 'src/api/index.js');
const NORMALIZE_JS = path.join(ROOT, 'src/api/normalize/index.js');
const B_DISPOSITION_API_JS = path.join(ROOT, 'src/api/concept/bDisposition.js');
const APP_JSX = path.join(ROOT, 'ui/src/App.jsx');
const LAYOUT_JSX = path.join(ROOT, 'ui/src/components/Layout.jsx');
const QUEUE_PAGE_JSX = path.join(ROOT, 'ui/src/pages/shared-concepts/AdoptionQueue.jsx');

const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_PORT || '7778'}`;

// Deliberately NON-SECRET throwaway foreign identity (test files only).
const FOREIGN_SK = Uint8Array.from(Array(32).fill(7));
const FOREIGN_DTAG = 'adoption-queue-fixture-f1';
const CARRIER_DTAG = 'adoption-carrier-fixture-f1';
const TWIN_DTAG = 'adoption-twin-fixture-f1';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

function libMod() {
  try { return require(LIB_JS); }
  catch { throw new Error('precondition: src/lib/adoptionQueue.js is missing (the U-class contract) — implement the pure arithmetic core first'); }
}

// ── U fixtures ─────────────────────────────────────────────────────────

const TA = 'a'.repeat(64);
const ALICE = 'b'.repeat(64);
const BOB = 'c'.repeat(64);
const coordOf = (pk, d) => `39998:${pk}:${d}`;

function header(pk, d, name) {
  return { id: `${d}-id`.padEnd(64, '0').slice(0, 64), pubkey: pk, kind: 39998, created_at: 1000, tags: [['d', d], ['names', name || d]] };
}
function carrier(pk, targetCoord, at) {
  return { id: Math.random().toString(16).slice(2).padEnd(64, 'f').slice(0, 64), pubkey: pk, kind: 39999, created_at: at || 1000, tags: [['d', `c-${Math.random().toString(16).slice(2, 8)}`], ['z', targetCoord]] };
}
function ledger(target, disposition, at) {
  return { pubkey: TA, created_at: at, tags: [['json', JSON.stringify({ adoptionDisposition: { target, disposition, decidedOn: '2026-08-06' } })]] };
}
function registry(aTag, eventId) {
  return { pubkey: TA, created_at: 1000, tags: [['json', JSON.stringify({ sharedConcept: { identifiers: { 'a-tag': aTag || '', 'event-id': eventId || '' } } })]] };
}
function base(over) {
  return {
    foreignHeaders: [], zCarriers: [], myBTargets: [], registryRecords: [], dispositionRecords: [],
    taPubkey: TA, ...over,
  };
}

// ═══ U — the queue arithmetic ══════════════════════════════════════════

test('U1: empty inputs → empty queue and empty declined view', () => {
  const { computeQueue } = libMod();
  const out = computeQueue(base());
  assert(Array.isArray(out.nominations) && out.nominations.length === 0, 'no inputs → no nominations');
  assert(Array.isArray(out.declined) && out.declined.length === 0, 'no inputs → nothing declined');
});

test('U2: the S3 base — cross-author usage nominates; self-filed-only and zero-usage do not', () => {
  const { computeQueue } = libMod();
  const hA = header(ALICE, 'recipes', 'recipes');
  const hB = header(BOB, 'gardens', 'gardens');
  const hC = header(BOB, 'unused', 'unused');
  const out = computeQueue(base({
    foreignHeaders: [hA, hB, hC],
    zCarriers: [
      carrier(BOB, coordOf(ALICE, 'recipes')),   // cross-author → counts
      carrier(BOB, coordOf(BOB, 'gardens')),      // self-filed → does NOT count
    ],
  }));
  const coords = out.nominations.map((n) => n.coord);
  assert(coords.includes(coordOf(ALICE, 'recipes')), 'cross-author usage must nominate');
  assert(!coords.includes(coordOf(BOB, 'gardens')), 'self-filed-only usage must NOT nominate (the PR #494 rule)');
  assert(!coords.includes(coordOf(BOB, 'unused')), 'zero usage must NOT nominate');
});

test('U3: evidence — event and author counts are cross-author only, and a TA carrier sets usedByMe', () => {
  const { computeQueue } = libMod();
  const hA = header(ALICE, 'recipes', 'recipes');
  const target = coordOf(ALICE, 'recipes');
  const out = computeQueue(base({
    foreignHeaders: [hA],
    zCarriers: [carrier(BOB, target), carrier(BOB, target), carrier(TA, target), carrier(ALICE, target)],
  }));
  assert(out.nominations.length === 1, `expected one nomination, got ${out.nominations.length}`);
  const n = out.nominations[0];
  assert(n.eventCount === 3, `cross-author events: BOB×2 + TA×1 = 3 (ALICE's self-filing excluded), got ${n.eventCount}`);
  assert(n.authorCount === 2, `cross-author authors: BOB + TA = 2, got ${n.authorCount}`);
  assert(n.usedByMe === true, 'a TA-authored carrier must set usedByMe (S3a)');
});

test('U4: wired exclusion — any of my b targets removes the nomination', () => {
  const { computeQueue } = libMod();
  const hA = header(ALICE, 'recipes', 'recipes');
  const target = coordOf(ALICE, 'recipes');
  const out = computeQueue(base({
    foreignHeaders: [hA],
    zCarriers: [carrier(BOB, target)],
    myBTargets: [target],
  }));
  assert(out.nominations.length === 0, 'a concept my headers already b-point at must not be nominated (S2a)');
});

test('U5: recognized exclusion — a registry record matching by a-tag OR by event id removes it; malformed records are tolerated', () => {
  const { computeQueue } = libMod();
  const hA = header(ALICE, 'recipes', 'recipes');
  const hB = header(BOB, 'gardens', 'gardens');
  const target = coordOf(ALICE, 'recipes');
  const out = computeQueue(base({
    foreignHeaders: [hA, hB],
    zCarriers: [carrier(BOB, target), carrier(ALICE, coordOf(BOB, 'gardens'))],
    registryRecords: [
      registry(target, ''),                                   // a-tag match → excludes recipes
      registry('', hB.id),                                    // event-id match → excludes gardens
      { pubkey: TA, created_at: 1, tags: [['json', '{not json']] }, // malformed → tolerated
    ],
  }));
  assert(out.nominations.length === 0,
    `registry-recognized concepts must not be nominated (matched by a-tag or event id); got ${JSON.stringify(out.nominations.map((n) => n.coord))}`);
});

test('U6: disposition chains — latest per target wins; declined hides, requeued returns; equal-timestamp ties resolve toward visibility', () => {
  const { computeQueue } = libMod();
  const hA = header(ALICE, 'recipes', 'recipes');
  const target = coordOf(ALICE, 'recipes');
  const inputs = (records) => base({ foreignHeaders: [hA], zCarriers: [carrier(BOB, target)], dispositionRecords: records });

  assert(libMod().computeQueue(inputs([ledger(target, 'declined', 100)])).nominations.length === 0,
    'a declined target must leave the queue');
  assert(libMod().computeQueue(inputs([ledger(target, 'declined', 100), ledger(target, 'requeued', 200)])).nominations.length === 1,
    'declined then requeued → the latest record wins and the target returns');
  assert(libMod().computeQueue(inputs([ledger(target, 'requeued', 100), ledger(target, 'declined', 200)])).nominations.length === 0,
    'requeued then declined → hidden again');
  assert(libMod().computeQueue(inputs([ledger(target, 'declined', 300), ledger(target, 'requeued', 300)])).nominations.length === 1,
    'equal created_at ties resolve toward VISIBILITY (wrongly-shown is benign; wrongly-hidden is not)');
});

test('U7: the Declined view — latest-declined targets surface with their record', () => {
  const { computeQueue } = libMod();
  const hA = header(ALICE, 'recipes', 'recipes');
  const target = coordOf(ALICE, 'recipes');
  const out = computeQueue(base({
    foreignHeaders: [hA],
    zCarriers: [carrier(BOB, target)],
    dispositionRecords: [ledger(target, 'declined', 100)],
  }));
  assert(out.declined.length === 1, 'the declined view must list latest-declined targets');
  assert(out.declined[0].target === target, `declined entry must carry the target, got ${JSON.stringify(out.declined[0])}`);
  assert(out.declined[0].decidedOn === '2026-08-06', 'declined entry must carry decidedOn');
});

test('U8: the lib is zero-require and exports computeQueue', () => {
  const src = safeRead(LIB_JS);
  assert(src, 'src/lib/adoptionQueue.js is missing');
  assert(!/\brequire\s*\(/.test(src), 'the pure core must have zero requires (the house lib pattern)');
  assert(typeof libMod().computeQueue === 'function', 'computeQueue must be exported');
});

// ═══ S — structural pins ═══════════════════════════════════════════════

/** Structure-bounded function body (the OPEN.md #109-ratified shape): from the
 *  named top-level function declaration to the next top-level declaration. */
function topLevelFunctionBody(src, name) {
  const re = new RegExp(`^(async )?function ${name}\\b`, 'm');
  const m = src.match(re);
  if (!m) return null;
  const start = m.index;
  const rest = src.slice(start + m[0].length);
  const next = rest.search(/^(async )?function |^module\.exports/m);
  return next === -1 ? src.slice(start) : src.slice(start, start + m[0].length + next);
}

test('S1: the queue read is registered — GET /api/adoption-queue via a dedicated adoption module', () => {
  assert(fs.existsSync(ADOPTION_API_JS), 'src/api/adoption/index.js is missing');
  const idx = safeRead(API_INDEX_JS);
  assert(idx && /registerAdoptionRoutes|adoption\/index/.test(idx), 'src/api/index.js must wire the adoption module');
  const mod = safeRead(ADOPTION_API_JS);
  assert(mod && mod.includes("'/api/adoption-queue'"), 'GET /api/adoption-queue must be registered in the adoption module');
});

test('S2: the disposition producer is registered and gates owner-only BEFORE any mint (structure-bounded)', () => {
  const src = safeRead(NORMALIZE_JS);
  assert(src, 'normalize/index.js unreadable');
  assert(src.includes("'/api/normalize/adoption-disposition'"), 'POST /api/normalize/adoption-disposition must be registered');
  assert(/ADOPTION_DISPOSITION_SCHEMA/.test(src) && /ensureAdoptionDispositionConcept/.test(src),
    'the ledger schema + ensure must exist (the runtime-concept idiom)');
  const body = topLevelFunctionBody(src, 'handleAdoptionDisposition');
  assert(body, 'function handleAdoptionDisposition not found as a top-level declaration');
  // Both house spellings of the same gate are valid: the positive pair
  // (bDisposition.js) and the normalize producers' De Morgan form.
  const gateAt = body.search(/isOwner\(req\)\s*\|\|\s*req\.localTrusted|!isOwner\(req\)\s*&&\s*!req\.localTrusted/);
  assert(gateAt >= 0, 'the handler must carry the F5 gate pair (isOwner || localTrusted, either spelling)');
  const mintAt = body.search(/invokeNormalizeHandler|handleCreateElement/);
  assert(mintAt === -1 || gateAt < mintAt, 'the gate must run BEFORE the mint call in the handler body');
});

test('S3 (regression, passes pre AND post): the ledger concept is never firmware-seeded', () => {
  const out = cp.execSync(`grep -rl "adoption-disposition" ${path.join(ROOT, 'firmware')} 2>/dev/null || true`, { encoding: 'utf8' }).trim();
  assert(out === '', `firmware/ must never carry the runtime-created ledger concept; found: ${out}`);
});

test('S4: the UI seams exist — page, route by NAME (never a count), nav entry, endpoint fetch', () => {
  assert(fs.existsSync(QUEUE_PAGE_JSX), 'ui/src/pages/shared-concepts/AdoptionQueue.jsx is missing');
  const app = safeRead(APP_JSX);
  assert(app && /path:\s*['"`]adoption-queue['"`]/.test(app),
    "App.jsx must register the 'adoption-queue' route (asserted by presence — OPEN.md #143 forbids count pins)");
  const layout = safeRead(LAYOUT_JSX);
  assert(layout && /adoption-queue/.test(layout), 'Layout.jsx must carry the nav entry');
  const page = safeRead(QUEUE_PAGE_JSX);
  assert(page && page.includes('/api/adoption-queue'), 'the page must fetch the server-assembled queue (never re-derive the arithmetic)');
});

test('S5: the scan helper is shared, not copied — bDisposition exports the scan family and the adoption module STREAMS (OPEN.md #142; corpus-scale fix)', () => {
  const bd = safeRead(B_DISPOSITION_API_JS);
  assert(bd && /module\.exports\s*=\s*\{[^}]*strfryScan/.test(bd),
    'bDisposition.js must export the scan helpers for the adoption module');
  assert(bd && /function strfryScanStream/.test(bd),
    'the streaming variant must live beside strfryScan (a deployed corpus exceeds any fixed exec buffer — the staging smoke failure)');
  const mod = safeRead(ADOPTION_API_JS);
  assert(mod && /require\([^)]*concept\/bDisposition/.test(mod) && /strfryScanStream/.test(mod),
    'the adoption module must import the STREAMING scan from bDisposition — no new copy, no buffered corpus reads');
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

/** Current created_at of a replaceable fixture event (0 when absent). */
async function currentStamp(filter) {
  try {
    const f = encodeURIComponent(JSON.stringify(filter));
    const r = await fetch(`${HOST_BASE}/api/strfry/scan?filter=${f}`, { signal: AbortSignal.timeout(15000) });
    const j = await r.json();
    const events = j.events || j.data || [];
    return events.reduce((m, e) => Math.max(m, e.created_at || 0), 0);
  } catch { return 0; }
}

/**
 * Strictly-monotonic stamp for a replaceable fixture write: max(now, cur+1).
 * Blind `now` stamps let two writes tie within a second — and strfry's
 * replaceable tie-break (lowest id) then keeps an ARBITRARY version, which is
 * exactly the shadow this suite spent an evening chasing. Every fixture write
 * out-stamps whatever version currently holds the coordinate.
 */
async function nextStamp(filter) {
  return Math.max(Math.floor(Date.now() / 1000), (await currentStamp(filter)) + 1);
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
async function hostPostJson(pathname, body) {
  const r = await fetch(`${HOST_BASE}${pathname}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}), signal: AbortSignal.timeout(20000),
  });
  let j = null; try { j = await r.json(); } catch { }
  return { status: r.status, json: j };
}

function foreignPk() {
  const { getPublicKey } = require('nostr-tools');
  return getPublicKey(FOREIGN_SK);
}
async function publishForeignHeader(extraTags) {
  const { finalizeEvent } = require('nostr-tools');
  const created_at = await nextStamp({ kinds: [39998], authors: [foreignPk()], '#d': [FOREIGN_DTAG] });
  const event = finalizeEvent({
    kind: 39998, content: '',
    tags: [['d', FOREIGN_DTAG], ['names', 'adoption queue fixture', 'adoption queue fixtures'], ...(extraTags || [])],
    created_at,
  }, FOREIGN_SK);
  return loopbackPostJson('/api/strfry/publish', { event, signAs: 'client' });
}
async function publishTaEvent(dTag, kind, extraTags) {
  const s = await stack();
  const created_at = await nextStamp({ kinds: [kind], authors: [s.ta], '#d': [dTag] });
  return loopbackPostJson('/api/strfry/publish', {
    event: {
      kind, content: '',
      tags: [['d', dTag], ['name', dTag], ...(extraTags || [])],
      created_at,
    },
    signAs: 'assistant',
  });
}
const fixtureCoord = () => `39998:${foreignPk()}:${FOREIGN_DTAG}`;

async function queue() {
  const { status, json } = await hostGetJson('/api/adoption-queue');
  assert(status === 200 && json && json.success !== false,
    `GET /api/adoption-queue failed (${status}): ${JSON.stringify(json).slice(0, 200)}`);
  assert(Array.isArray(json.nominations) && Array.isArray(json.declined),
    `queue payload must carry nominations[] and declined[]: ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

/**
 * Bounded settle-poll: strfry's LMDB writes propagate to a NEW scan process
 * sub-second but not instantaneously (cross-process visibility — the OPEN.md
 * #141 genus; observed intermittently on back-to-back runs). The product
 * contract is the next human-timescale read, so H rows poll the queue until
 * the expected transition shows (≤6s) and FAIL on exhaustion — the semantic
 * assertion is preserved; only cross-process propagation is absorbed.
 */
async function queueUntil(predicate, label) {
  let last = null;
  for (let i = 0; i < 12; i++) {
    last = await queue();
    if (predicate(last)) return last;
    await new Promise((r) => setTimeout(r, 500));
  }
  // Self-describing timeout: dump the direct-scan view of every queue input
  // for the fixture, so a flake names its own missing ingredient.
  let diag = '';
  try {
    const s = await stack();
    const sscan = (f) => {
      const out = dockerCurl(['-s', '-m', '20', '-G', '--data-urlencode', `filter=${JSON.stringify(f)}`, `${CONTAINER_BASE}/api/strfry/scan`]);
      try { const j = JSON.parse(out); return j.events || j.data || []; } catch { return []; }
    };
    const hdr = sscan({ kinds: [39998], authors: [foreignPk()] }).length;
    const carZ = sscan({ kinds: [39999], authors: [s.ta], '#d': [CARRIER_DTAG] })
      .filter((e) => (e.tags || []).some((t) => t[0] === 'z' && t[1] === fixtureCoord())).length;
    const myB = sscan({ kinds: [39998, 39999], authors: [s.ta] })
      .flatMap((e) => (e.tags || []).filter((t) => t[0] === 'b').map((t) => t[1]))
      .filter((v) => v === fixtureCoord()).length;
    const zhit = sscan({ '#z': [fixtureCoord()] }).length;
    diag = ` [diag hdrScan:${hdr} carZ:${carZ} myB-hits:${myB} zFilterHits:${zhit}]`;
  } catch (e) { diag = ` [diag failed: ${e.message}]`; }
  throw new Error(`${label} — not observed within 6s${diag}; last state: nominations=${JSON.stringify((last.nominations || []).map((n) => n.coord)).slice(0, 200)} declined=${JSON.stringify((last.declined || []).map((d) => d.target)).slice(0, 200)}`);
}

test('H1: a foreign header with a cross-author TA carrier is nominated with correct evidence', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const ph = await publishForeignHeader();
  assert(ph && ph.success === true, `foreign fixture publish failed: ${JSON.stringify(ph).slice(0, 200)}`);
  const pc = await publishTaEvent(CARRIER_DTAG, 39999, [['z', fixtureCoord()]]);
  assert(pc && pc.success === true, `carrier fixture publish failed: ${JSON.stringify(pc).slice(0, 200)}`);
  // Fixture integrity: the signed event the server returns must carry the z —
  // if this trips, the publish path dropped the tag; if it holds and the scan
  // still misses, the loss is strfry-side.
  assert(pc.event && (pc.event.tags || []).some((t) => t[0] === 'z' && t[1] === fixtureCoord()),
    `the signed carrier must carry the z tag; got tags ${JSON.stringify(pc.event && pc.event.tags).slice(0, 200)}`);
  const q = await queueUntil((s) => s.nominations.some((x) => x.coord === fixtureCoord()),
    'the fixture must be nominated');
  const n = q.nominations.find((x) => x.coord === fixtureCoord());
  assert(n.eventCount >= 1 && n.authorCount >= 1, `usage evidence must be present, got ${JSON.stringify(n)}`);
  assert(n.usedByMe === true, 'the TA carrier must set usedByMe');
});

test('H2: decline removes the nomination and the Declined view lists it', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const resp = loopbackPostJson('/api/normalize/adoption-disposition', { target: fixtureCoord(), disposition: 'declined' });
  assert(resp && resp.success === true, `decline failed: ${JSON.stringify(resp).slice(0, 200)}`);
  await queueUntil((s) => !s.nominations.some((x) => x.coord === fixtureCoord())
    && s.declined.some((x) => x.target === fixtureCoord()),
  'a declined target must leave the queue and appear in the Declined view');
});

test('H3: requeue (un-decline) returns the nomination', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const resp = loopbackPostJson('/api/normalize/adoption-disposition', { target: fixtureCoord(), disposition: 'requeued' });
  assert(resp && resp.success === true, `requeue failed: ${JSON.stringify(resp).slice(0, 200)}`);
  await queueUntil((s) => s.nominations.some((x) => x.coord === fixtureCoord())
    && !s.declined.some((x) => x.target === fixtureCoord()),
  'a requeued target must return to the queue and leave the Declined view');
});

test('H4: wiring a twin via the shipped primitive removes the nomination (S2a)', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const pt = await publishTaEvent(TWIN_DTAG, 39998, [['names', 'adoption twin fixture', 'adoption twin fixtures']]);
  assert(pt && pt.success === true, `twin fixture publish failed: ${JSON.stringify(pt).slice(0, 200)}`);
  const resp = loopbackPostJson(`/api/concept/${encodeURIComponent(`39998:${s.ta}:${TWIN_DTAG}`)}/b-append`, { target: fixtureCoord() });
  assert(resp && resp.success === true, `b-append failed: ${JSON.stringify(resp).slice(0, 200)}`);
  await queueUntil((s2) => !s2.nominations.some((x) => x.coord === fixtureCoord()),
    'a wired target must leave the queue');
});

test('H5: the queue survives an empty world — bare teardown drops the fixture from the base', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  // Teardown first half: republish carrier bare (no z) and twin bare (no b).
  // The twin's teardown must OUT-STAMP the b-append monotonic bump (F5's
  // resignWithTags stamps max(now, prev+1)): a same-second bare republish
  // would LOSE the replaceable tie and leave the twin wired — which then
  // poisons the NEXT run's H1 via the wired exclusion (found the hard way).
  const pc = await publishTaEvent(CARRIER_DTAG, 39999);
  const pt = await publishTaEvent(TWIN_DTAG, 39998, [['names', 'adoption twin fixture', 'adoption twin fixtures']]);
  assert(pc.success === true && pt.success === true, 'teardown republishes failed');
  await queueUntil((s2) => !s2.nominations.some((x) => x.coord === fixtureCoord()),
    'with zero carriers the fixture must drop out of the S3 base entirely');
});

test('H6: the producer refuses remote unauthenticated callers (401, regression-class) and unknown disposition words', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  try {
    const { status } = await hostPostJson('/api/normalize/adoption-disposition', { target: fixtureCoord(), disposition: 'declined' });
    assert(status === 401 || status === 403, `remote unauthenticated must be refused 401/403, got ${status}`);
    const bad = loopbackPostJson('/api/normalize/adoption-disposition', { target: fixtureCoord(), disposition: 'maybe-later' });
    assert(bad && bad.success === false && bad.error,
      `an unknown disposition word must be refused with a named error, got ${JSON.stringify(bad).slice(0, 200)}`);
  } finally {
    await publishForeignHeader(); // teardown second half: bare foreign header
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
  console.log(`\nadoption-candidates-queue: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
