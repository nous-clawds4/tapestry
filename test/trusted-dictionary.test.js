/**
 * shared-concepts-adoption #5 — trusted dictionary.
 * Story: engineering-team/stories/shared-concepts-adoption/5-trusted-dictionary.md
 * ADR:   engineering-team/decisions/shared-concepts-adoption/0005-trusted-dictionary.md
 * Book:  engineering-team/audits/shared-concepts-adoption/book.md
 *
 * Three classes:
 *
 *   U1..U7 — pure tests of computeDictionary (src/lib/trustedDictionary.js,
 *            zero-require; the qualifying set is resolved at the HANDLER seam
 *            per ADR 0005, so the core takes {headers, zCarriers, qualifying,
 *            threshold, taPubkey} with headers pre-classified
 *            {coord, name, author, isMine, bState}): threshold membership over
 *            distinct qualifying authors, the cross-author + TA exclusions
 *            (they beat qualifying-set membership), the qualifying/total count
 *            split, the isMine/sentinelDeferred flags (real headers stay in —
 *            the dictionary is not the worklist), sorting, empties.
 *   S1..S4 — structural pins (line/name-based; OPEN.md #109/#143 discipline):
 *            the read route + its Neo4j seam + the two config knobs; the
 *            owner-gated snapshot mint (concept name, derivation marker,
 *            sentinel drop); the UI surface (page + route + nav + POV params);
 *            the F1/F2 contract untouched (regression, passes pre AND post).
 *   H1..H5 — live-stack integration (SKIP when the stack is down; OPEN.md
 *            #144 nextStamp discipline on every fixture header/carrier write;
 *            Neo4j fixture rows written via the localTrusted loopback
 *            POST /api/neo4j/query and DETACH-DELETEd at teardown): house
 *            membership/threshold/evidence + the sentinel-marked view row;
 *            the personalized branch (card-scored, provably different from
 *            house) and the no-cards → house fallback disclosure; read-time
 *            freshness (a new qualifying carrier enters the view with no
 *            republish step); the snapshot mint (params + derivation +
 *            sentinel exclusion + no b tags + the 403 gate + the snapshots
 *            strip); the adoption-queue regression + teardown.
 *
 * EXPECTED NOW (pre-implementation):
 *   U1–U7 FAIL (src/lib/trustedDictionary.js does not exist);
 *   S1–S3 FAIL (route, mint handler, UI absent);
 *   S4 PASS (F1/F2 surfaces untouched — regression guard);
 *   H1–H4 FAIL when the stack is up (GET /api/trusted-dictionary 404s);
 *   H5 PASS (adoption-queue regression + teardown);
 *   all H SKIP (recorded) when the stack is down.
 *
 * Fixture safety: stable d-tags, every strfry write out-stamps the
 * coordinate's current version (nextStamp — OPEN.md #144), teardown
 * republishes bare and DETACH-DELETEs the Neo4j fixture rows. All carrier /
 * observer identities are deliberately NON-SECRET throwaway keys (the F1
 * idiom). Documented residue (the F4 precedent): each full run mints ONE
 * snapshot element (create-element has no delete path) — self-identifying by
 * its fixture member coords.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LIB_JS = path.join(ROOT, 'src/lib/trustedDictionary.js');
const ADOPTION_API_JS = path.join(ROOT, 'src/api/adoption/index.js');
const NORMALIZE_JS = path.join(ROOT, 'src/api/normalize/index.js');
const ADOPTION_LIB_JS = path.join(ROOT, 'src/lib/adoptionQueue.js');
const APP_JSX = path.join(ROOT, 'ui/src/App.jsx');
const LAYOUT_JSX = path.join(ROOT, 'ui/src/components/Layout.jsx');
const PAGE_JSX = path.join(ROOT, 'ui/src/pages/shared-concepts/TrustedDictionary.jsx');

const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_PORT || '7778'}`;

// Non-secret throwaway identities (the F1 idiom).
const T1_SK = Uint8Array.from(Array(32).fill(11)); // house-trusted carrier
const T2_SK = Uint8Array.from(Array(32).fill(12)); // house-trusted carrier
const T3_SK = Uint8Array.from(Array(32).fill(13)); // house-UNtrusted carrier
const OBS_SK = Uint8Array.from(Array(32).fill(14)); // personalized fixture observer
const NOCARDS_SK = Uint8Array.from(Array(32).fill(15)); // observer with zero cards

const HDR_A = 'trusted-dictionary-fixture-f3a'; // bare; house member
const HDR_B = 'trusted-dictionary-fixture-f3b'; // sentinel-deferred; view yes, snapshot no
const HDR_C = 'trusted-dictionary-fixture-f3c'; // bare; house OUT, personalized IN
const HDR_D = 'trusted-dictionary-fixture-f3d'; // bare; the freshness row's target
const SENTINEL = 'b-tag-deferred';
const SNAPSHOT_SLUG = 'trusted-dictionary-snapshot';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

function fnOrFail() {
  let mod;
  try { mod = require(LIB_JS); } catch {
    throw new Error('src/lib/trustedDictionary.js must exist (ADR 0005) — implement the pure core first');
  }
  assert(typeof mod.computeDictionary === 'function',
    'computeDictionary must be exported from src/lib/trustedDictionary.js (ADR 0005)');
  return mod.computeDictionary;
}

// ── U fixtures (the ADR's seam contract) ───────────────────────────────

const TA = 'a'.repeat(64);
const FH = 'f'.repeat(64); // a foreign header author
const Q1 = '1'.repeat(64);
const Q2 = '2'.repeat(64);
const UQ = '3'.repeat(64); // never in the qualifying set
const myCoord = (d) => `39998:${TA}:${d}`;
const foreignCoord = (d) => `39998:${FH}:${d}`;

const mine = (d, bState) => ({ coord: myCoord(d), name: d, author: TA, isMine: true, bState });
const foreign = (d) => ({ coord: foreignCoord(d), name: d, author: FH, isMine: false, bState: 'none' });
let _id = 0;
function zc(pk, target) {
  _id += 1;
  return { pubkey: pk, id: String(_id).padStart(64, '0'), tags: [['z', target]] };
}
const base = (over) => ({
  headers: [], zCarriers: [], qualifying: new Set(), threshold: 2, taPubkey: TA, ...over,
});

// ═══ U — the dictionary arithmetic ═════════════════════════════════════

test('U1: empty inputs → empty entries', () => {
  const out = fnOrFail()(base());
  assert(out && Array.isArray(out.entries) && out.entries.length === 0, 'no inputs → no entries');
});

test('U2: membership — ≥ threshold distinct qualifying authors admits, fewer does not; both header populations are eligible', () => {
  const out = fnOrFail()(base({
    headers: [mine('rich', 'none'), foreign('rich-foreign'), mine('poor', 'none')],
    zCarriers: [
      zc(Q1, myCoord('rich')), zc(Q2, myCoord('rich')),
      zc(Q1, foreignCoord('rich-foreign')), zc(Q2, foreignCoord('rich-foreign')),
      zc(Q1, myCoord('poor')),
    ],
    qualifying: new Set([Q1, Q2]),
  }));
  const coords = out.entries.map((e) => e.coord);
  assert(coords.includes(myCoord('rich')), 'my header with 2 qualifying authors must be a member');
  assert(coords.includes(foreignCoord('rich-foreign')), 'a foreign header with 2 qualifying authors must be a member (S3b spans both populations)');
  assert(!coords.includes(myCoord('poor')), 'one qualifying author < threshold 2 must not be a member');
});

test('U3: exclusions beat the qualifying set — the header\'s own author and the TA never count', () => {
  const out = fnOrFail()(base({
    headers: [foreign('self-filed'), foreign('ta-filed')],
    zCarriers: [
      zc(FH, foreignCoord('self-filed')), zc(Q1, foreignCoord('self-filed')), // FH files own header
      zc(TA, foreignCoord('ta-filed')), zc(Q1, foreignCoord('ta-filed')),     // the instance files
    ],
    qualifying: new Set([FH, TA, Q1]), // even when both are nominally qualifying
  }));
  const coords = out.entries.map((e) => e.coord);
  assert(!coords.includes(foreignCoord('self-filed')),
    "the header's own author never counts (cross-author rule) — 1 qualifying < 2");
  assert(!coords.includes(foreignCoord('ta-filed')),
    'the TA never counts toward the threshold (self-evidence is not community evidence) — 1 qualifying < 2');
});

test('U4: the qualifying/total split — distinct authors and events counted correctly', () => {
  const out = fnOrFail()(base({
    headers: [mine('counted', 'none')],
    zCarriers: [
      zc(Q1, myCoord('counted')), zc(Q1, myCoord('counted')), // Q1 twice
      zc(Q2, myCoord('counted')),
      zc(UQ, myCoord('counted')),
    ],
    qualifying: new Set([Q1, Q2]),
  }));
  assert(out.entries.length === 1, `one entry expected, got ${out.entries.length}`);
  const e = out.entries[0];
  assert(e.qualifyingAuthorCount === 2, `qualifying authors: Q1+Q2 = 2, got ${e.qualifyingAuthorCount}`);
  assert(e.totalAuthorCount === 3, `total cross-authors: Q1+Q2+UQ = 3, got ${e.totalAuthorCount}`);
  assert(e.totalEventCount === 4, `total cross-author events: 4, got ${e.totalEventCount}`);
});

test('U5: flags — sentinel-deferred mine is marked (and stays in the view); real mine stays in unmarked; foreign carries isMine false', () => {
  const out = fnOrFail()(base({
    headers: [mine('kept-private', 'deferred'), mine('declared', 'real'), foreign('theirs')],
    zCarriers: [zc(Q1, myCoord('kept-private')), zc(Q1, myCoord('declared')), zc(Q1, foreignCoord('theirs'))],
    qualifying: new Set([Q1]),
    threshold: 1,
  }));
  const byCoord = new Map(out.entries.map((e) => [e.coord, e]));
  const kp = byCoord.get(myCoord('kept-private'));
  assert(kp, 'a sentinel-deferred header with qualifying usage stays IN the view (marked, dropped only at snapshot)');
  assert(kp.sentinelDeferred === true && kp.isMine === true, `kept-private must carry sentinelDeferred:true isMine:true, got ${JSON.stringify(kp)}`);
  const dec = byCoord.get(myCoord('declared'));
  assert(dec && dec.sentinelDeferred === false, 'a real-b header is a normal member — the dictionary is not the worklist');
  const th = byCoord.get(foreignCoord('theirs'));
  assert(th && th.isMine === false && th.sentinelDeferred === false, 'foreign entries carry isMine:false, sentinelDeferred:false');
});

test('U6: sort — qualifying-author count desc, then total events desc', () => {
  const out = fnOrFail()(base({
    headers: [mine('bronze', 'none'), mine('gold', 'none'), mine('silver', 'none')],
    zCarriers: [
      zc(Q1, myCoord('gold')), zc(Q2, myCoord('gold')), zc(UQ, myCoord('gold')),
      zc(Q1, myCoord('silver')), zc(Q2, myCoord('silver')), zc(Q2, myCoord('silver')), zc(Q1, myCoord('silver')),
      zc(Q1, myCoord('bronze')), zc(Q2, myCoord('bronze')),
    ],
    qualifying: new Set([Q1, Q2, 'x'.repeat(64)]),
    threshold: 2,
  }));
  // gold qc=2 ev=3(incl UQ)... silver qc=2 ev=4; bronze qc=2 ev=2 → silver, gold, bronze
  const order = out.entries.map((e) => e.coord);
  assert(order[0] === myCoord('silver') && order[1] === myCoord('gold') && order[2] === myCoord('bronze'),
    `tie on qualifying count breaks by total events desc; got ${order.join(', ')}`);
});

test('U7: the core stays zero-require and exports computeDictionary', () => {
  const src = safeRead(LIB_JS);
  assert(src, 'src/lib/trustedDictionary.js unreadable — the pure core must exist');
  assert(!/\brequire\s*\(/.test(src), 'the pure core must be zero-require (the adoptionQueue.js house style)');
  fnOrFail();
});

// ═══ S — structural pins ═══════════════════════════════════════════════

test('S1: the read route exists with its Neo4j seam and the two config knobs', () => {
  const mod = safeRead(ADOPTION_API_JS);
  assert(mod, 'src/api/adoption/index.js unreadable');
  assert(/['"`]\/api\/trusted-dictionary['"`]/.test(mod),
    'GET /api/trusted-dictionary must be registered in the adoption module (ADR 0005)');
  assert(/require\([^)]*trustedDictionary/.test(mod) && /computeDictionary/.test(mod),
    'the handler must delegate the arithmetic to the pure core src/lib/trustedDictionary.js');
  assert(/require\([^)]*neo4j-driver/.test(mod) && /runCypher/.test(mod),
    'the qualifying set resolves via runCypher (src/lib/neo4j-driver) at the handler seam');
  assert(/assembleTrustedDictionary/.test(mod),
    'assembleTrustedDictionary must exist (shared by the GET and the snapshot POST — server-side recompute)');
  assert(/VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF/.test(mod) && /0\.01/.test(mod),
    'the cutoff reads VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF with the batch-side default 0.01 (ADR 0005 fixed point 1)');
  assert(/TRUSTED_DICTIONARY_MIN_USERS/.test(mod) && /['"(,\s]2[),\s]/.test(mod),
    'the threshold reads TRUSTED_DICTIONARY_MIN_USERS with default 2 (ADR 0005 fixed point 2)');
});

test('S2: the snapshot mint is owner-gated, concept-named, usage-marked, and sentinel-dropping', () => {
  const mod = safeRead(NORMALIZE_JS);
  assert(mod, 'src/api/normalize/index.js unreadable');
  assert(/['"`]\/api\/normalize\/trusted-dictionary-snapshot['"`]/.test(mod),
    'POST /api/normalize/trusted-dictionary-snapshot must be registered');
  assert(/trusted dictionary snapshot/.test(mod),
    "the runtime concept 'trusted dictionary snapshot' must be named (the adoption-disposition precedent)");
  const h = mod.slice(mod.indexOf('trusted-dictionary-snapshot') - 4000, mod.indexOf('trusted-dictionary-snapshot') + 4000);
  assert(/isOwner\s*\(\s*req\s*\)/.test(mod) && /localTrusted/.test(mod),
    'the mint must gate on isOwner(req) || req.localTrusted (F1 precedent)');
  assert(/z-usage/.test(mod),
    "the snapshot json must self-describe with derivation 'z-usage' (AC-7)");
  assert(/sentinelDeferred/.test(mod),
    'the mint must drop sentinelDeferred entries (AC-6) — the drop site must be visible in the handler');
});

test('S3: the UI surface — page, route, nav, POV params, publish action', () => {
  const page = safeRead(PAGE_JSX);
  assert(page, 'ui/src/pages/shared-concepts/TrustedDictionary.jsx is missing');
  assert(/\/api\/trusted-dictionary/.test(page), 'the page must fetch /api/trusted-dictionary');
  assert(/usePov\s*\(/.test(page), "the page must consume usePov() (the povParams contract — AC-3)");
  assert(/\/api\/normalize\/trusted-dictionary-snapshot/.test(page),
    'the publish-snapshot action must POST the normalize route');
  const app = safeRead(APP_JSX);
  assert(app, 'App.jsx unreadable');
  assert(/path:\s*['"`]dictionary['"`]/.test(app) && /TrustedDictionary/.test(app),
    "App.jsx must register the 'dictionary' route under shared-concepts (ADR 0005)");
  const layout = safeRead(LAYOUT_JSX);
  assert(layout && /dictionary/i.test(layout),
    'Layout.jsx must link the dictionary in the Shared Concepts nav');
});

test('S4 (regression, passes pre AND post): the F1/F2 surfaces stay untouched', () => {
  const mod = safeRead(ADOPTION_API_JS);
  assert(mod && /['"`]\/api\/adoption-queue['"`]/.test(mod), 'GET /api/adoption-queue must stay registered');
  const lib = safeRead(ADOPTION_LIB_JS);
  assert(lib && /computeQueue/.test(lib) && /computePublishCandidates/.test(lib),
    'the F1/F2 arithmetic exports must remain in src/lib/adoptionQueue.js');
  const app = safeRead(APP_JSX);
  assert(app && [...app.matchAll(/\bpath:\s*['"`]([^'"`]*)['"`]/g)].some((m) => m[1] === 'adoption-queue'),
    "the 'adoption-queue' route must still be registered");
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
async function hostPostJson(pathname, body) {
  const r = await fetch(`${HOST_BASE}${pathname}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}), signal: AbortSignal.timeout(25000),
  });
  let j = null; try { j = await r.json(); } catch { }
  return { status: r.status, json: j };
}
function cypher(cypherText, params) {
  const resp = loopbackPostJson('/api/neo4j/query', { cypher: cypherText, params: params || {} });
  if (!resp || resp.success !== true) {
    throw new Error(`neo4j fixture cypher failed: ${JSON.stringify(resp).slice(0, 200)}`);
  }
  return resp.data || [];
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
function pkOf(sk) { return require('nostr-tools').getPublicKey(sk); }
async function publishSignedEvent(sk, dTag, kind, extraTags) {
  const { finalizeEvent } = require('nostr-tools');
  const created_at = await nextStamp({ kinds: [kind], authors: [pkOf(sk)], '#d': [dTag] });
  const event = finalizeEvent({
    kind, content: '', tags: [['d', dTag], ['name', dTag], ...(extraTags || [])], created_at,
  }, sk);
  return loopbackPostJson('/api/strfry/publish', { event, signAs: 'client' });
}
const mineCoord = async (d) => `39998:${(await stack()).ta}:${d}`;

async function dictionary(query) {
  const { status, json } = await hostGetJson(`/api/trusted-dictionary${query || ''}`);
  assert(status === 200 && json && json.success === true,
    `GET /api/trusted-dictionary${query || ''} must answer 200 success:true as a PUBLIC read (got ${status}): ${JSON.stringify(json).slice(0, 200)}`);
  assert(Array.isArray(json.entries) && Array.isArray(json.snapshots) && json.pov && typeof json.pov === 'object',
    `the response must carry entries[], snapshots[], and the pov disclosure block; got keys ${Object.keys(json || {}).join(',')}`);
  return json;
}
async function dictionaryUntil(query, predicate, label) {
  let last = null;
  for (let i = 0; i < 12; i++) {
    last = await dictionary(query);
    if (predicate(last)) return last;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} — not observed within 6s; entries=${JSON.stringify((last.entries || []).map((e) => e.coord)).slice(0, 300)}`);
}

async function seedFixtures() {
  // Neo4j trust rows (house + the OBS cards) — localTrusted loopback writes.
  cypher(
    'UNWIND $rows AS row MERGE (u:NostrUser {pubkey: row.pk}) SET u.influence = row.inf',
    { rows: [{ pk: pkOf(T1_SK), inf: 0.5 }, { pk: pkOf(T2_SK), inf: 0.5 }, { pk: pkOf(T3_SK), inf: 0.001 }] },
  );
  cypher(
    'UNWIND $rows AS row MERGE (c:NostrUserWotMetricsCard {observer_pubkey: $obs, observee_pubkey: row.pk}) SET c.influence = row.inf',
    { obs: pkOf(OBS_SK), rows: [{ pk: pkOf(T1_SK), inf: 0.9 }, { pk: pkOf(T3_SK), inf: 0.9 }] },
  );
  // Headers.
  const pa = await publishTaEvent(HDR_A, 39998, [['names', 'trusted dictionary fixture a', 'x']]);
  const pb = await publishTaEvent(HDR_B, 39998, [['names', 'trusted dictionary fixture b', 'x'], ['b', SENTINEL]]);
  const pc = await publishTaEvent(HDR_C, 39998, [['names', 'trusted dictionary fixture c', 'x']]);
  assert(pa.success === true && pb.success === true && pc.success === true,
    `fixture header publishes failed: ${JSON.stringify({ pa, pb, pc }).slice(0, 300)}`);
  // Carriers: A ← {T1, T2, T3}; B ← {T1, T2}; C ← {T1, T3}.
  const a = await mineCoord(HDR_A); const b = await mineCoord(HDR_B); const c = await mineCoord(HDR_C);
  for (const [sk, dTag, target] of [
    [T1_SK, 'td-z-t1-a', a], [T2_SK, 'td-z-t2-a', a], [T3_SK, 'td-z-t3-a', a],
    [T1_SK, 'td-z-t1-b', b], [T2_SK, 'td-z-t2-b', b],
    [T1_SK, 'td-z-t1-c', c], [T3_SK, 'td-z-t3-c', c],
  ]) {
    const r = await publishSignedEvent(sk, dTag, 39999, [['z', target]]);
    assert(r.success === true, `carrier ${dTag} publish failed: ${JSON.stringify(r).slice(0, 200)}`);
  }
}

test('H1: house membership — threshold + evidence split + the sentinel-marked row, on a public unauthenticated read', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  await seedFixtures();
  const a = await mineCoord(HDR_A); const b = await mineCoord(HDR_B); const c = await mineCoord(HDR_C);
  const j = await dictionaryUntil('', (x) => x.entries.some((e) => e.coord === a),
    'fixture A (two house-trusted authors) must be a dictionary member');
  const ea = j.entries.find((e) => e.coord === a);
  assert(ea.qualifyingAuthorCount === 2, `A qualifying authors: T1+T2 = 2 (T3 below cutoff), got ${ea.qualifyingAuthorCount}`);
  assert(ea.totalAuthorCount === 3, `A total cross-authors: 3, got ${ea.totalAuthorCount}`);
  assert(!j.entries.some((e) => e.coord === c),
    'fixture C (one trusted + one untrusted author) must be below the default threshold 2');
  const eb = j.entries.find((e) => e.coord === b);
  assert(eb && eb.sentinelDeferred === true,
    'fixture B (sentinel-deferred, qualifying usage) must be IN the view and marked sentinelDeferred');
  assert(j.pov.branch === 'house', `the default read runs the house branch, got ${JSON.stringify(j.pov)}`);
});

test('H2: the personalized branch scores from the observer\'s cards (provably different from house) and no-cards falls back disclosed', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const c = await mineCoord(HDR_C);
  const jp = await dictionaryUntil(`?wotPov=user&userPubkey=${pkOf(OBS_SK)}`,
    (x) => x.entries.some((e) => e.coord === c),
    'under OBS\'s cards (T1+T3 trusted) fixture C must be a member — the house view excludes it');
  assert(jp.pov.branch === 'personalized', `pov.branch must be 'personalized', got ${JSON.stringify(jp.pov)}`);
  const jf = await dictionary(`?wotPov=user&userPubkey=${pkOf(NOCARDS_SK)}`);
  assert(jf.pov.fellBackToHouse === true,
    `an observer with zero cards must fall back to house, disclosed (pov.fellBackToHouse), got ${JSON.stringify(jf.pov)}`);
  assert(!jf.entries.some((e) => e.coord === c), 'the fallback read scores as house — fixture C stays out');
});

test('H3: read-time freshness — a new qualifying carrier enters the view with no republish step', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const pd = await publishTaEvent(HDR_D, 39998, [['names', 'trusted dictionary fixture d', 'x']]);
  assert(pd.success === true, 'fixture d header publish failed');
  const d = await mineCoord(HDR_D);
  const r1 = await publishSignedEvent(T1_SK, 'td-z-t1-d', 39999, [['z', d]]);
  assert(r1.success === true, 'first carrier publish failed');
  const before = await dictionary('');
  assert(!before.entries.some((e) => e.coord === d), 'one qualifying author — fixture D not yet a member');
  const r2 = await publishSignedEvent(T2_SK, 'td-z-t2-d', 39999, [['z', d]]);
  assert(r2.success === true, 'second carrier publish failed');
  await dictionaryUntil('', (x) => x.entries.some((e) => e.coord === d),
    'the second qualifying carrier must appear on a plain re-read (computed at read; nothing to republish)');
});

test('H4: the snapshot — owner gate, server recompute, params + derivation, sentinel exclusion, no b tags, the strip', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  const a = await mineCoord(HDR_A); const b = await mineCoord(HDR_B);
  const un = await hostPostJson('/api/normalize/trusted-dictionary-snapshot', {});
  assert(un.status === 401 || un.status === 403,
    `an unauthenticated host POST must be refused (401 middleware / 403 handler gate), got ${un.status}: ${JSON.stringify(un.json).slice(0, 150)}`);
  const minted = loopbackPostJson('/api/normalize/trusted-dictionary-snapshot', {});
  assert(minted && minted.success === true, `the owner-side mint must succeed: ${JSON.stringify(minted).slice(0, 250)}`);
  const f = encodeURIComponent(JSON.stringify({ kinds: [39999], '#z': [`39998:${s.ta}:${SNAPSHOT_SLUG}`] }));
  const { json: scan } = await hostGetJson(`/api/strfry/scan?filter=${f}`);
  const events = (scan && (scan.events || scan.data)) || [];
  assert(events.length >= 1, 'a snapshot element must exist under the runtime concept coord');
  const latest = events.reduce((x, y) => (!x || y.created_at > x.created_at ? y : x), null);
  const jsonTag = (latest.tags || []).find((t) => t[0] === 'json');
  assert(jsonTag, 'the snapshot element must carry a json section');
  const sec = JSON.parse(jsonTag[1]).trustedDictionarySnapshot;
  assert(sec, 'the json section must be named trustedDictionarySnapshot');
  assert(sec.derivation === 'z-usage', `the snapshot must self-describe derivation 'z-usage' (AC-7), got ${sec.derivation}`);
  assert(sec.pov && typeof sec.cutoff === 'number' && typeof sec.threshold === 'number' && sec.computedAt,
    `the snapshot must embed pov/cutoff/threshold/computedAt (AC-5), got ${JSON.stringify(sec).slice(0, 200)}`);
  const memberCoords = (sec.members || []).map((m) => m.coord);
  assert(sec.memberCount === memberCoords.length, 'memberCount must equal members.length');
  assert(memberCoords.includes(a), 'fixture A must ride into the snapshot');
  assert(!memberCoords.includes(b), 'the sentinel-deferred fixture B must NOT ride into the snapshot (AC-6)');
  assert(!(latest.tags || []).some((t) => t[0] === 'b'), 'the snapshot element must carry no b tags (AC-7)');
  await dictionaryUntil('', (x) => x.snapshots.some((sn) => sn.id === latest.id),
    'the minted snapshot must appear in the snapshots strip');
});

test('H5 (regression, passes pre AND post): the adoption queue is untouched — then teardown', async () => {
  const s = await stack(); if (!s.up) return 'SKIP';
  try {
    const { status, json } = await hostGetJson('/api/adoption-queue');
    assert(status === 200 && json && json.success === true
      && Array.isArray(json.nominations) && Array.isArray(json.declined)
      && Array.isArray(json.publishCandidates) && Array.isArray(json.deferredInUse),
    'the F1/F2 response contract must remain intact beside the dictionary');
  } finally {
    for (const d of [HDR_A, HDR_B, HDR_C, HDR_D]) {
      await publishTaEvent(d, 39998, [['names', `trusted dictionary fixture ${d.slice(-1)}`, 'x']]);
    }
    for (const [sk, dTag] of [
      [T1_SK, 'td-z-t1-a'], [T1_SK, 'td-z-t1-b'], [T1_SK, 'td-z-t1-c'], [T1_SK, 'td-z-t1-d'],
      [T2_SK, 'td-z-t2-a'], [T2_SK, 'td-z-t2-b'], [T2_SK, 'td-z-t2-d'],
      [T3_SK, 'td-z-t3-a'], [T3_SK, 'td-z-t3-c'],
    ]) {
      await publishSignedEvent(sk, dTag, 39999);
    }
    cypher('MATCH (u:NostrUser) WHERE u.pubkey IN $pks DETACH DELETE u',
      { pks: [pkOf(T1_SK), pkOf(T2_SK), pkOf(T3_SK)] });
    cypher('MATCH (c:NostrUserWotMetricsCard {observer_pubkey: $obs}) WHERE c.observee_pubkey IN $pks DETACH DELETE c',
      { obs: pkOf(OBS_SK), pks: [pkOf(T1_SK), pkOf(T3_SK)] });
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
  console.log(`\ntrusted-dictionary: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
