/**
 * Story 7 (epic: second-brain) — Teach it what matters: priority signals.
 *
 * Story: engineering-team/stories/second-brain/7-teach-it-what-matters.md
 * ADR:   engineering-team/decisions/second-brain/0007-teach-it-what-matters.md
 *
 * Test classes (ADR "Test-class guidance", per test-hermeticity-ci/0001):
 *
 *   U-class (EXECUTED, stack-free, always gates CI) — the new pure signals core
 *     (src/lib/brain/signals.js): parseSignalRow's whitelisting shape
 *     (prefers/over/reason/judgedBy/judgedOn/framing — distinct framing tags
 *     preserved per row, AC5), groupSignalsByGoal's TWO-KEY fan-out (one record
 *     appears under BOTH its prefers and over slugs; malformed/self-pairs
 *     dropped — AC3's both-spines guarantee at the pure layer), and the
 *     signalEntry side-specific wording (the ADR d5 ratified templates,
 *     verbatim, with and without the reason fold; date = judgedOn) — all over
 *     SYNTHETIC records (no stack).
 *
 *   S-class (source assertions, stack-free) — the one new normalize producer
 *     (record-priority-signal) with route/gate/refusals (same-goal,
 *     goal-not-found) and NO viability requirement (ADR d4 — no
 *     deriveStanding/not-viable in the signal core); the append-only mint
 *     (nonce/random d-tag; NO regenerateJson on the signal path); the
 *     server-stamped framing constant (never read from the request body — ADR
 *     d8); judgedBy 'owner' + judgedOn stamped (ADR d7); the self-bootstrap
 *     (ensureSignalConcept); the shared write mutex; NO launch/egress and NO
 *     signal consumption in the story-6 proposer (AC4); the goal-detail
 *     records[] gaining the signal projection; the brain import surface
 *     re-pinned to NINE; NO new brain route (the goal detail is the visibility
 *     surface); jargon/no-numeral-clean wording templates; and the zero-UI-diff
 *     + read-only + no-64-hex sentinels.
 *
 *   H-class (live local stack, per-test SKIP when unreachable) — the concept
 *     self-bootstraps on the first signal; a signal between two NON-VIABLE
 *     (captured) goals round-trips onto BOTH goals' spines with the ratified
 *     side-specific wording and the reason fold (the d4 no-standing ruling made
 *     live); the stored element carries judgedBy/judgedOn/framing (AC2); the
 *     reversal (B-over-A) coexists with the original — append-only, the first
 *     element byte-unchanged (AC3); refusals (same-goal, goal-not-found) write
 *     nothing; a repeat of the same pair succeeds (the corpus accumulates) and
 *     the proposals queue is untouched by any of it (AC4); the spine MERGES
 *     work-record + signal entries newest-first; hygiene stays green;
 *     host-side caller classes (the POST 401s; /api/brain/signals 404s — no
 *     route exists).
 *
 *   R-class (regression sentinels, stack-free, pass before AND after).
 *
 * Pass-by-design sentinels (documented, story-2→6 review precedent) that pass
 * BEFORE the feature lands: S3 (mutex survives; per-handler check guarded), S9
 * (no /api/brain/signals route — true before and after), S10 (the proposer
 * consumes no signals — true before and after), S12 (zero UI diff — true before
 * and after), S13 (brain read-only today), S14 (no 64-hex), H6 (the middleware
 * default-denies the unauthenticated POST before routing, and /api/brain/signals
 * 404s — both true before and after), H7 (hygiene), R1, R2. The rest FAIL until
 * the feature lands (the signals core is missing, the
 * route 404s, the concept is absent, the goal-detail records[] carries no
 * signal projection). H tests SKIP when the stack is absent (CI's stack-free
 * job).
 *
 * Fixture hygiene: the H rows create two sentinel-named CAPTURED goals (alpha,
 * beta — deliberately non-viable, proving ADR d4) plus append-only signal
 * elements and one work record (the merge proof). run()'s finally tears them
 * all down: strfry delete by d-tag first (goals' deterministic d-tags via the
 * real dtag core; signals'/work records' random d-tags captured from the
 * create responses' uuids), then Neo4j element+tags, then a value-scoped
 * orphan-tag sweep (json CONTAINS the 'harness-signal-' sentinel), then a
 * strfry count-0 verify. Pre-clean runs the same routine best-effort. A
 * teardown failure is a loud suite failure. The Priority Signal CONCEPT, once
 * bootstrapped, persists (only fixture ELEMENTS are torn down); the suite is
 * idempotent across runs (ensureSignalConcept no-ops when present).
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SIGNALS_CORE = path.join(ROOT, 'src/lib/brain/signals.js');
const BRAIN_API = path.join(ROOT, 'src/api/brain/index.js');
const NORMALIZE_INDEX = path.join(ROOT, 'src/api/normalize/index.js');
const RELATIONSHIPS = path.join(ROOT, 'src/api/normalize/relationships.js');
const PROBE = path.join(ROOT, 'src/api/normalize/probe.js');
const AUTH = path.join(ROOT, 'src/middleware/auth.js');
const GOAL_DETAIL_JSX = path.join(ROOT, 'ui/src/pages/brain/GoalDetail.jsx');
const APP_JSX = path.join(ROOT, 'ui/src/App.jsx');
const LAYOUT_JSX = path.join(ROOT, 'ui/src/components/Layout.jsx');
const STYLES_CSS = path.join(ROOT, 'ui/src/styles.css');
const DTAG_CORE = path.join(ROOT, 'src/lib/dtag.js');

const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

// The Priority Signal concept (ADR 0007 d1) — runtime-created, TA-scoped.
const SIGNAL_CONCEPT_SLUG = 'tapestry-priority-signal';
const SIGNAL_CONCEPT_NAME = 'tapestry priority signal';
const GOAL_CONCEPT_SLUG = 'tapestry-owner-goal';
// The v1 framing tag — server-stamped on every signal (ADR 0007 d8).
const FRAMING_V1 = 'solve-one-today';

// The ratified spine wording (ADR 0007 d5 — operator, 2026-07-24). Verbatim.
const TYPE_PREFERRED = 'preferred';
const TYPE_PASSED_OVER = 'passed over';
const wordPrefers = (other, reason) => `chose this over "${other}"` + (reason ? ` — ${reason}` : '');
const wordOver = (other, reason) => `"${other}" chosen over this` + (reason ? ` — ${reason}` : '');

// H fixtures — all sentinel-tagged so the Neo4j orphan sweep (json CONTAINS the
// sentinel) is the catch-all. BOTH goals are CAPTURED (no deliverable/boundary):
// the round-trip succeeding on non-viable goals IS the ADR d4 ruling, live.
const FIX_SENTINEL = 'harness-signal-';
const FIX_A_NAME = 'harness signal alpha goal';
const FIX_A_SLUG = 'harness-signal-alpha';
const FIX_A_JSON = { tapestryOwnerGoal: {
  name: FIX_A_NAME, slug: FIX_A_SLUG,
  description: 'a harness-signal captured (non-viable) goal, alpha',
  origin: 'harness test, in conversation', capturedOn: '2026-07-24',
} };
const FIX_B_NAME = 'harness signal beta goal';
const FIX_B_SLUG = 'harness-signal-beta';
const FIX_B_JSON = { tapestryOwnerGoal: {
  name: FIX_B_NAME, slug: FIX_B_SLUG,
  description: 'a harness-signal captured (non-viable) goal, beta',
  origin: 'harness test, in conversation', capturedOn: '2026-07-24',
} };
const FIX_REASON = 'harness-signal reason: closer to revenue this week';
const FIX_REASON_REPEAT = 'harness-signal reason: still the closer one';
const FIX_WORK_SESSION = 'harness signal merge session';
const FIX_WORK_SUMMARY = 'harness-signal work record for the merge proof';
const FIX_MISSING_SLUG = 'harness-signal-nonexistent';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function short(x, n = 260) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}

function loadSignalsCore() {
  if (!fs.existsSync(SIGNALS_CORE)) {
    throw new Error('src/lib/brain/signals.js does not exist yet — the signals core (ADR 0007 d10) is not implemented.');
  }
  try { return require(SIGNALS_CORE); }
  catch (e) { throw new Error(`src/lib/brain/signals.js failed to require: ${e.message}`); }
}
const CORE_MISSING_FN = (fn) =>
  `src/lib/brain/signals.js does not export ${fn}() yet — the signals core (ADR 0007 d10) is not implemented.`;

// The real d-tag core — deterministic fixture d-tags for goal teardown (signals
// use random d-tags captured from responses). Loaded lazily (stack-free runs skip it).
let _dtag = null;
function dtagCore() { if (_dtag) return _dtag; _dtag = require(DTAG_CORE); return _dtag; }

// Extract a named function's body from the normalize source (S-class regions).
function fnBody(src, name) {
  const i = src.indexOf(`function ${name}`);
  if (i === -1) return '';
  const after = src.slice(i + 10);
  const next = after.search(/\n(?:async )?function /);
  return next === -1 ? src.slice(i) : src.slice(i, i + 10 + next);
}

/* ── synthetic fixtures (U-class) ─────────────────────────────────────── */

const TA = 'synthetic-ta'; // handles are opaque strings to the core — no hex needed
function core39999(slug) { return `39999:${TA}:${slug}`; }

// A parsed signal record in the ADR 0007 d1 shape (parseSignalRow out).
function sig(over = {}) {
  return {
    uuid: core39999('harness-signal-fixture'),
    name: 'preferred: goal-a over goal-b',
    slug: 'preferred-goal-a-abcd1234',
    description: 'chose "Goal A" over "Goal B"',
    prefers: 'goal-a',
    over: 'goal-b',
    reason: null,
    judgedBy: 'owner',
    judgedOn: '2026-07-24',
    framing: FRAMING_V1,
    createdAt: 1784000000,
    ...over,
  };
}

/* ── live-stack helpers (H-class; the house pattern) ──────────────────── */

function dockerCurl(args) {
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], { encoding: 'utf8', timeout: 15000 });
}
function loopbackGetJson(pathname) {
  const out = dockerCurl(['-s', '-m', '8', `${CONTAINER_BASE}${pathname}`]);
  try { return JSON.parse(out); }
  catch { throw new Error(`loopback GET ${pathname} did not return JSON: ${short(out)}`); }
}
function loopbackPostJson(pathname, body) {
  const out = dockerCurl(['-s', '-m', '20', '-X', 'POST', '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(body), `${CONTAINER_BASE}${pathname}`]);
  try { return JSON.parse(out); }
  catch { throw new Error(`loopback POST ${pathname} did not return JSON: ${short(out)}`); }
}

let reachable = null;
async function stackAvailable() {
  if (reachable !== null) return reachable;
  let host = false;
  try {
    const r = await fetch(`${HOST_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    host = r.ok;
  } catch { host = false; }
  let loopback = false;
  try {
    const out = dockerCurl(['-s', '-m', '3', `${CONTAINER_BASE}/api/auth/user-classification`]);
    loopback = /"success"\s*:\s*true/.test(out);
  } catch { loopback = false; }
  reachable = host && loopback;
  return reachable;
}

let taPubkey = null;
function getTaPubkey() {
  if (taPubkey) return taPubkey;
  const r = loopbackGetJson('/api/assistant/pubkey');
  assert(r && r.success && /^[0-9a-f]{64}$/.test(r.pubkey || ''),
    `could not resolve the runtime TA pubkey via /api/assistant/pubkey (got ${short(r)}).`);
  taPubkey = r.pubkey;
  return taPubkey;
}

function getGoalDetail(slug) { return loopbackGetJson(`/api/brain/goals/${encodeURIComponent(slug)}`); }
function getProposals() { return loopbackGetJson('/api/brain/proposals'); }
// A goal's record spine, as the detail endpoint returns it — the append-only +
// refusal tests compare this before/after to prove nothing moved.
function recordSnapshot(slug) {
  const r = getGoalDetail(slug);
  const records = Array.isArray(r?.records) ? r.records : [];
  return records.map((e) => [e.date, e.type, e.summary].join('|')).sort().join('\n');
}
// The stored element's json-tag value — the AC2 attribution + byte-unchanged proofs.
function elementJsonTag(uuid) {
  const r = loopbackPostJson('/api/neo4j/query', {
    cypher: "MATCH (e:NostrEvent {uuid: $uuid})-[:HAS_TAG]->(t:NostrEventTag {type: 'json'}) RETURN t.value AS json LIMIT 1",
    params: { uuid },
  });
  const rows = (r && (r.data || r.rows)) || [];
  assert(rows.length === 1 && typeof rows[0].json === 'string',
    `could not read the stored element json for ${uuid} (got ${short(r, 300)}).`);
  return rows[0].json;
}

/* ── H fixture bookkeeping ─────────────────────────────────────────────── */

let fixturesArmed = false;
let teardownFailure = null;
const createdSignalUuids = [];     // random-d-tag signal elements — captured from responses
const createdWorkRecordUuids = []; // the merge-proof work record — captured from response
const createdGoalNames = [];       // fixture goals — d-tags derived via dtag

function dTagFromUuid(uuid) { return String(uuid).split(':').slice(2).join(':'); }
function goalHeaderUuid() { return `39998:${getTaPubkey()}:${GOAL_CONCEPT_SLUG}`; }
function goalDtag(name) { return dtagCore().childDTag(name, goalHeaderUuid()); }
function allFixtureDtags() {
  const goalDtags = createdGoalNames.map((n) => goalDtag(n));
  const elemDtags = [...createdSignalUuids, ...createdWorkRecordUuids].map(dTagFromUuid);
  return [...new Set([...goalDtags, ...elemDtags].filter(Boolean))];
}
function allFixtureUuids() {
  const ta = getTaPubkey();
  return allFixtureDtags().map((d) => `39999:${ta}:${d}`);
}

function deleteFixturesFromStrfry() {
  const dtags = allFixtureDtags();
  for (const dTag of dtags) {
    const scan = loopbackGetJson(
      `/api/strfry/scan?filter=${encodeURIComponent(JSON.stringify({ kinds: [39999], '#d': [dTag] }))}`);
    const events = Array.isArray(scan?.events) ? scan.events : (Array.isArray(scan) ? scan : []);
    for (const ev of events) {
      if (ev && ev.id) {
        cp.execFileSync('docker', ['exec', CONTAINER, 'strfry', 'delete', `--filter={"ids":["${ev.id}"]}`],
          { encoding: 'utf8', timeout: 15000 });
      }
    }
  }
  for (const dTag of dtags) {
    const verify = loopbackGetJson(
      `/api/strfry/scan/count?filter=${encodeURIComponent(JSON.stringify({ kinds: [39999], '#d': [dTag] }))}`);
    assert(verify && verify.count === 0,
      `strfry still holds ${verify && verify.count} fixture event(s) for d-tag ${dTag} after teardown. ` +
      `Delete manually: docker exec ${CONTAINER} strfry delete --filter='{"kinds":[39999],"#d":["${dTag}"]}'`);
  }
}

function deleteFixturesFromNeo4j() {
  const r1 = loopbackPostJson('/api/neo4j/query', {
    cypher: 'UNWIND $uuids AS u MATCH (e:NostrEvent {uuid: u}) OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag) DETACH DELETE e, t',
    params: { uuids: allFixtureUuids() },
  });
  assert(r1 && r1.success !== false, `fixture Neo4j teardown failed: ${short(r1)}`);
  // Orphan-tag sweep, value-scoped to the sentinel family and the tracked d-tags.
  // Never by z value (the z value is a concept header uuid, shared with the real concept).
  const r2 = loopbackPostJson('/api/neo4j/query', {
    cypher: `MATCH (t:NostrEventTag) WHERE (t.type = 'd' AND t.value IN $dtags)
             OR (t.type = 'json' AND t.value CONTAINS $sentinel)
             DETACH DELETE t`,
    params: { dtags: allFixtureDtags(), sentinel: FIX_SENTINEL },
  });
  assert(r2 && r2.success !== false, `fixture orphan-tag sweep failed: ${short(r2)}`);
}

function preCleanFixtures() {
  try { deleteFixturesFromStrfry(); } catch { /* best-effort */ }
  try { deleteFixturesFromNeo4j(); } catch { /* best-effort */ }
}
function teardownFixtures() {
  if (!fixturesArmed) return;
  try { deleteFixturesFromStrfry(); deleteFixturesFromNeo4j(); fixturesArmed = false; }
  catch (e) { teardownFailure = e.message; }
}

// Create a goal fixture (story-1 create-element lane). Track its name for teardown.
function armGoal(name, jsonBody) {
  const created = loopbackPostJson('/api/normalize/create-element', {
    concept: 'tapestry owner goal', name, json: jsonBody,
  });
  assert(created && created.success === true,
    `create-element rejected the goal fixture "${name}" (got ${short(created, 400)}).`);
  if (!createdGoalNames.includes(name)) createdGoalNames.push(name);
}
// Arm the two goal fixtures (alpha, beta — both captured/non-viable) once per run.
function armGoalFixtures() {
  fixturesArmed = true;
  preCleanFixtures();
  armGoal(FIX_A_NAME, FIX_A_JSON);
  armGoal(FIX_B_NAME, FIX_B_JSON);
}
function recordSignal(body) {
  const r = loopbackPostJson('/api/normalize/record-priority-signal', body);
  if (r && r.success === true && r.signal && r.signal.uuid) createdSignalUuids.push(r.signal.uuid);
  return r;
}
function recordWork(body) {
  const r = loopbackPostJson('/api/normalize/create-work-record', body);
  if (r && r.success === true && r.record && r.record.uuid) createdWorkRecordUuids.push(r.record.uuid);
  return r;
}

// Cross-test state: the first signal's uuid + stored json (H2's byte-unchanged proof).
let firstSignalUuid = null;
let firstSignalJson = null;

/* ══════════════ U-class — the pure signals core (EXECUTED) ══════════════ */

test('U1 (contract): signals core exports parseSignalRow, groupSignalsByGoal, signalEntry — and requires NOTHING (dependency-free)', () => {
  const core = loadSignalsCore();
  assert(typeof core.parseSignalRow === 'function', CORE_MISSING_FN('parseSignalRow'));
  const grouper = core.groupSignalsByGoal || core.groupByGoal;
  assert(typeof grouper === 'function',
    'signals core must export a group-by-goal helper (groupSignalsByGoal) — ADR 0007 d10.');
  assert(typeof core.signalEntry === 'function',
    'signals core must export signalEntry(record, side, otherGoalName) → {date,type,summary} (ADR 0007 d10).');
  // Pure and dependency-free (the goals.js/resources.js/work-records.js/proposals.js precedent).
  const src = safeRead(SIGNALS_CORE);
  assert(!/require\s*\(/.test(src),
    'src/lib/brain/signals.js must require NOTHING — the pure core is dependency-free (ADR 0007 d10).');
});

test('U2 (AC1/AC2/AC5): parseSignalRow extracts prefers/over/reason/judgedBy/judgedOn/framing; distinct framing tags are preserved per row; non-signal/malformed → null', () => {
  const core = loadSignalsCore();
  const parsed = core.parseSignalRow({
    uuid: core39999('harness-signal-x'), name: 'preferred: goal-a over goal-b', createdAt: 1784000001,
    json: JSON.stringify({ prioritySignal: {
      name: 'preferred: goal-a over goal-b', slug: 'preferred-goal-a-abcd1234',
      description: 'chose "Goal A" over "Goal B"',
      prefers: 'goal-a', over: 'goal-b', reason: 'closer to revenue',
      judgedBy: 'owner', judgedOn: '2026-07-24', framing: FRAMING_V1,
    } }),
  });
  assert(parsed, 'parseSignalRow must return a record for a well-formed signal row.');
  assert(parsed.prefers === 'goal-a' && parsed.over === 'goal-b',
    `the prefers/over goal slugs must be extracted — record-based linkage (ADR 0007 d3); got ${short(parsed)}.`);
  assert(parsed.reason === 'closer to revenue', `the optional reason must be extracted (AC1); got ${short(parsed.reason)}.`);
  assert(parsed.judgedBy === 'owner' && parsed.judgedOn === '2026-07-24' && parsed.framing === FRAMING_V1,
    `judged-by, judged-on, and the framing tag must ALL be extracted (AC2); got ${short(parsed)}.`);
  // AC5 — the framing identification is carried BY each signal: two rows with
  // DISTINCT tags each keep their own; nothing substitutes a global value.
  const otherFraming = core.parseSignalRow({
    uuid: core39999('harness-signal-y'), name: 'preferred: goal-c over goal-d', createdAt: 1784000002,
    json: JSON.stringify({ prioritySignal: {
      name: 'preferred: goal-c over goal-d', slug: 'preferred-goal-c-ef567890',
      description: 'chose "Goal C" over "Goal D"',
      prefers: 'goal-c', over: 'goal-d',
      judgedBy: 'owner', judgedOn: '2026-07-20', framing: 'ship-by-friday',
    } }),
  });
  assert(otherFraming && otherFraming.framing === 'ship-by-friday' && parsed.framing === FRAMING_V1,
    `distinct framing tags must coexist, each read back from its own signal (AC5); got ${short([parsed.framing, otherFraming && otherFraming.framing])}.`);
  assert(otherFraming.reason === null || otherFraming.reason === undefined,
    'a signal without a reason must parse with an empty reason (the reason is optional — AC1).');
  // A goal row (wrong section) is not a signal.
  const notSignal = core.parseSignalRow({
    uuid: core39999('g'), name: 'g', createdAt: 1, json: JSON.stringify({ tapestryOwnerGoal: { name: 'g', slug: 'g' } }),
  });
  assert(notSignal === null, 'a row without a prioritySignal section must parse to null (never a phantom signal).');
  const malformed = core.parseSignalRow({ uuid: core39999('m'), name: 'm', createdAt: 1, json: '{not json' });
  assert(malformed === null, 'malformed json must parse to null, never throw (event-tagging 0009 discipline).');
});

test('U3 (AC3 — the two-goal fan-out): groupSignalsByGoal returns the SAME record under BOTH its prefers and over keys; malformed/self-pairs are dropped', () => {
  const core = loadSignalsCore();
  const grouper = core.groupSignalsByGoal || core.groupByGoal;
  const s1 = sig({ uuid: core39999('s1'), prefers: 'goal-a', over: 'goal-b' });
  const s2 = sig({ uuid: core39999('s2'), prefers: 'goal-c', over: 'goal-a', slug: 'preferred-goal-c-2222' });
  const out = grouper([s1, s2]);
  const forA = out instanceof Map ? out.get('goal-a') : out['goal-a'];
  const forB = out instanceof Map ? out.get('goal-b') : out['goal-b'];
  const forC = out instanceof Map ? out.get('goal-c') : out['goal-c'];
  assert(Array.isArray(forA) && forA.length === 2,
    `goal-a touches TWO signals (once as prefers, once as over) — one record must appear under BOTH goals it touches (AC3; ADR 0007 d3); got ${short(forA && forA.length)}.`);
  assert(Array.isArray(forB) && forB.length === 1 && forB[0].uuid === s1.uuid,
    `goal-b must bucket s1 (its over side) — the SAME record object, not a copy of half the fact (got ${short(forB)}).`);
  assert(Array.isArray(forC) && forC.length === 1,
    `goal-c must bucket s2 (its prefers side); got ${short(forC)}.`);
  // Malformed rows: a missing slug on either side, or a self-pair, is dropped.
  const missing = sig({ uuid: core39999('s3'), prefers: 'goal-x', over: null });
  const selfPair = sig({ uuid: core39999('s4'), prefers: 'goal-x', over: 'goal-x' });
  const out2 = grouper([missing, selfPair]);
  const forX = out2 instanceof Map ? out2.get('goal-x') : out2['goal-x'];
  assert(!forX || forX.length === 0,
    'a signal missing either slug, or preferring a goal over itself, must be dropped as malformed (ADR 0007 d10) — never rendered.');
});

test('U4 (AC3/AC6 — the ratified wording): signalEntry words each side from that goal\'s perspective, verbatim, reason folded when present; date = judgedOn', () => {
  const core = loadSignalsCore();
  const withReason = sig({ reason: 'closer to revenue' });
  const noReason = sig({ reason: null });
  // The preferred goal's side.
  const p1 = core.signalEntry(withReason, 'prefers', 'harness beta goal');
  assert(p1 && p1.date === '2026-07-24' && p1.type === TYPE_PREFERRED,
    `the prefers-side entry must be {date: judgedOn, type: '${TYPE_PREFERRED}', …} (ADR 0007 d5); got ${short(p1)}.`);
  assert(p1.summary === wordPrefers('harness beta goal', 'closer to revenue'),
    `the prefers-side summary must be the ratified template verbatim (ADR 0007 d5): ` +
    `'${wordPrefers('harness beta goal', 'closer to revenue')}' — got '${short(p1.summary)}'.`);
  const p2 = core.signalEntry(noReason, 'prefers', 'harness beta goal');
  assert(p2.summary === wordPrefers('harness beta goal', null),
    `without a reason the prefers-side summary carries no fold (ADR 0007 d5); got '${short(p2.summary)}'.`);
  // The passed-over goal's side.
  const o1 = core.signalEntry(withReason, 'over', 'harness alpha goal');
  assert(o1 && o1.type === TYPE_PASSED_OVER,
    `the over-side entry's type word must be '${TYPE_PASSED_OVER}' (ADR 0007 d5); got ${short(o1 && o1.type)}.`);
  assert(o1.summary === wordOver('harness alpha goal', 'closer to revenue'),
    `the over-side summary must be the ratified template verbatim (ADR 0007 d5): ` +
    `'${wordOver('harness alpha goal', 'closer to revenue')}' — got '${short(o1.summary)}'.`);
  const o2 = core.signalEntry(noReason, 'over', 'harness alpha goal');
  assert(o2.summary === wordOver('harness alpha goal', null),
    `without a reason the over-side summary carries no fold; got '${short(o2.summary)}'.`);
  // A vanished other-goal falls back to its slug (read-tolerant, never a crash).
  const fb = core.signalEntry(noReason, 'prefers', null);
  assert(fb && typeof fb.summary === 'string' && fb.summary.includes(noReason.over),
    `with the other goal gone, the wording falls back to its slug (ADR 0007 d10); got '${short(fb && fb.summary)}'.`);
});

/* ══════════════ S-class — source assertions (stack-free) ══════════════ */

test('S1 (ADR d6): record-priority-signal — route, gate, refusals (same-goal, goal-not-found), result recorded', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/\/api\/normalize\/record-priority-signal/.test(src),
    'POST /api/normalize/record-priority-signal is not registered (ADR 0007 d6) — not implemented yet.');
  const start = src.indexOf('handleRecordPrioritySignal');
  assert(start !== -1, 'handleRecordPrioritySignal not found in src/api/normalize/index.js (ADR 0007 d6).');
  const slice = src.slice(start, start + 10000);
  assert(/isOwner\s*\(\s*req\s*\)/.test(slice) && /localTrusted/.test(slice) && /403/.test(slice),
    'record-priority-signal must carry the explicit in-handler gate (isOwner(req) || req.localTrusted → 403) — ADR 0007 d6.');
  for (const tok of ['same-goal', 'goal-not-found']) {
    assert(src.includes(tok),
      `record-priority-signal must answer the named refusal '${tok}' (ADR 0007 d6) — loud, named, nothing written.`);
  }
});

test('S2 (ADR d4 — no standing requirement): the signal core resolves goals but checks NO viability', () => {
  const src = safeRead(NORMALIZE_INDEX);
  const region = fnBody(src, 'recordPrioritySignal');
  assert(region,
    'the recordPrioritySignal core is not implemented yet (ADR 0007 d6).');
  assert(!/deriveStanding|isViable|not-viable|\bviable\b/.test(region),
    'the signal core must NOT check viability — any two distinct real goals are comparable ' +
    '(ADR 0007 d4, operator-ratified: the owner is teaching relative value, not certifying execution-readiness).');
});

test('S3 (ADR d9 — sentinel): the shared write mutex survives, and the signal handler runs through it', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/serializeGoalWrite/.test(src),
    'serializeGoalWrite must survive (story-3→6 pins) — ADR 0007 d9 reuses it, never renames it.');
  const start = src.indexOf('handleRecordPrioritySignal');
  if (start === -1) return; // S1 fails loudly on the missing handler; this stays a mutex sentinel
  const slice = src.slice(start, start + 8000);
  assert(/serializeGoalWrite/.test(slice),
    'handleRecordPrioritySignal must run its read-validate-write body through the shared write mutex (ADR 0007 d9).');
});

test('S4 (ADR d2 — append-only by construction): the signal write path uses a random/nonce d-tag and NEVER regenerateJsons', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/function recordPrioritySignal|function mintSignalElement/.test(src),
    'the signal write cores are not implemented yet (recordPrioritySignal / mintSignalElement) — ADR 0007 d2/d6.');
  const region = ['recordPrioritySignal', 'mintSignalElement'].map((n) => fnBody(src, n)).join('\n--\n');
  assert(/randomDTag\s*\(|childDTag\s*\([^)]+,[^)]+,[^)]+\)/.test(region),
    'the signal mint must use a random d-tag or a nonce\'d childDTag (ADR 0007 d2) — append-only by construction, ' +
    'so no write can ever MERGE over a prior signal.');
  assert(!/regenerateJson\s*\(/.test(region),
    'the signal write path must NEVER regenerateJson — a signal is born final, never edited ' +
    '(ADR 0007 d2; PRD §7.2).');
});

test('S5 (ADR d8 — the framing is server-stamped): a solve-one-today framing constant exists and is never read from the request body', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(src.includes(FRAMING_V1),
    `the v1 framing tag '${FRAMING_V1}' must exist as a named constant in normalize/index.js (ADR 0007 d8) — not implemented yet.`);
  assert(/SIGNAL_FRAMING\w*\s*=\s*['"`]solve-one-today['"`]/.test(src),
    'the framing must be a SINGLE named constant (SIGNAL_FRAMING_V1 = \'solve-one-today\') — ADR 0007 d8/d13.');
  const start = src.indexOf('handleRecordPrioritySignal');
  if (start !== -1) {
    const slice = src.slice(start, start + 10000);
    assert(!/body\s*[.[]\s*['"`]?framing/.test(slice) && !/framing\s*[,}]\s*=\s*req\.body/.test(slice)
      && !/{[^}]*\bframing\b[^}]*}\s*=\s*req\.body/.test(slice),
      'the handler must NOT read a framing from the request body — a caller-supplied framing is the swap hatch ' +
      '§7.6 defers to owner ratification (ADR 0007 d8). The server stamps the constant.');
  }
});

test('S6 (ADR d7 — attribution): the signal core stamps judgedBy \'owner\', a judgedOn date, and the framing', () => {
  const src = safeRead(NORMALIZE_INDEX);
  const region = fnBody(src, 'recordPrioritySignal');
  assert(region, 'the recordPrioritySignal core is not implemented yet (ADR 0007 d6).');
  assert(/judgedBy/.test(region) && /['"`]owner['"`]/.test(region),
    "the core must stamp judgedBy: 'owner' (ADR 0007 d7 — v1's single judge, instance-relative).");
  assert(/judgedOn/.test(region), 'the core must stamp a judgedOn date (AC2; ADR 0007 d7).');
  assert(/framing/.test(region), 'the core must stamp the framing tag (AC2; ADR 0007 d8).');
});

test('S7 (ADR d9): the Priority Signal concept self-bootstraps — ensureSignalConcept via create-concept + save-schema, guarded', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/ensureSignalConcept/.test(src),
    'ensureSignalConcept (the self-bootstrap helper, ADR 0007 d9) does not exist yet.');
  const start = src.indexOf('ensureSignalConcept');
  const slice = src.slice(start, start + 4000);
  assert(/create-concept|createConcept|handleCreateConcept/.test(slice) && /save-schema|saveSchema|handleSaveSchema/.test(slice),
    'ensureSignalConcept must provision via create-concept + save-schema when the concept is absent (ADR 0007 d9).');
  assert(src.includes(SIGNAL_CONCEPT_SLUG) || src.includes(SIGNAL_CONCEPT_NAME),
    `the write path must reference the Priority Signal concept (${SIGNAL_CONCEPT_SLUG}) — ADR 0007 d1/d9.`);
});

test('S8 (ADR d10): the goal-detail projects signal facts into records[]; the brain requires the signals core; the import surface is re-pinned to NINE', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(/require\s*\(\s*['"`][^'"`]*lib\/brain\/signals['"`]\s*\)/.test(src),
    'the brain module must require ../../lib/brain/signals — the signal projection core (ADR 0007 d10) is not wired yet.');
  const start = src.indexOf('handleGetGoalDetail');
  const slice = start !== -1 ? src.slice(start, start + 8000) : '';
  assert(/signal/i.test(slice),
    'handleGetGoalDetail must MERGE the signal projection into records[] (ADR 0007 d10) — the signal facts must reach BOTH touched goals\' spines.');
  const requires = [...src.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1]);
  const allowed = [/neo4j-driver$/, /middleware\/auth$/, /assistantKeys$/, /lib\/brain\/goals$/, /lib\/brain\/hygiene$/, /lib\/brain\/resources$/, /lib\/brain\/work-records$/, /lib\/brain\/proposals$/, /lib\/brain\/signals$/, /lib\/brain\/export$/, /lib\/brain\/direction$/];
  for (const spec of requires) {
    assert(allowed.some((re) => re.test(spec)),
      `import surface violation: require('${spec}') — story 7 adds exactly lib/brain/signals; the brain module ` +
      'allows only the nine cores (ADR 0007 d10; the six sibling re-pins widen to nine).');
  }
});

test('S9 (ADR d10 — sentinel): NO new brain route — /api/brain/signals does not exist; the goal detail is the visibility surface', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(!/\/api\/brain\/signals/.test(src),
    'the brain module must NOT register /api/brain/signals — signals have no feature surface (ADR 0007 d10; ' +
    'the story pins the three-view inventory as binding; visibility rides the goal detail).');
});

test('S10 (AC4 — sentinel): the signal path launches nothing, and the story-6 proposer consumes no signals', () => {
  const src = safeRead(NORMALIZE_INDEX);
  // The proposer half holds before AND after: make-proposal's rationale stays
  // caller-supplied; no mechanical signal consumption (AC4).
  for (const name of ['makeProposal', 'decideProposal']) {
    const region = fnBody(src, name);
    assert(region, `${name} missing — story-6 regression.`);
    assert(!/signal/i.test(region),
      `${name} must NOT read or consume signals (AC4; ADR 0007 d14) — a proposal's citation of signals is ` +
      'conversational words, never plumbing.');
  }
  // The signal half applies once the core exists.
  const region = fnBody(src, 'recordPrioritySignal');
  if (region) {
    assert(!/\bfetch\s*\(|https?\.get\s*\(|https?\.request\s*\(|publishEverywhere|spawn\s*\(|\.enqueue\s*\(|scheduler|launch(Session|Task|Job)/i.test(region),
      'recording a signal must launch NOTHING (AC4; §5.6/§7.1) — no fetch/spawn/enqueue/scheduler/launch call in the signal core.');
  }
});

test('S11 (AC6/AC3 — copy discipline): the signals core wording is jargon-free, numeral-free, exclamation-free', () => {
  const src = safeRead(SIGNALS_CORE);
  assert(src, 'src/lib/brain/signals.js does not exist yet (ADR 0007 d10).');
  const strings = [
    ...[...src.matchAll(/'([^'\\\n]*)'/g)].map((m) => m[1]),
    ...[...src.matchAll(/"([^"\\\n]*)"/g)].map((m) => m[1]),
    ...[...src.matchAll(/`([^`]*)`/g)].map((m) => m[1]),
  ].join('\n');
  for (const w of ['element', 'kind', 'schema', 'event', 'pubkey', 'superset', 'concept header', 'persona', 'acceptance criteria', 'lease', 'payload', 'endpoint']) {
    assert(!new RegExp(`\\b${w}\\b`, 'i').test(strings),
      `banned jargon "${w}" found in the signals core's strings (style guide; AC6) — the wording templates live here.`);
  }
  assert(!/!/.test(strings),
    'no exclamation marks in the wording templates (style guide; AC6).');
  assert(!/\bscore\b|\brank\b|\bpercent|\bgauge\b|★|⭐|toFixed\s*\(/i.test(src),
    'the signals core must render NO numeric score/rank/percentage/gauge/star (AC6) — comparisons and words only.');
});

test('S12 (ADR d14 — sentinel, zero UI diff): no brain UI file references signals — GoalDetail/App/Layout/styles carry no signal surface', () => {
  for (const [f, label] of [[GOAL_DETAIL_JSX, 'GoalDetail.jsx'], [APP_JSX, 'App.jsx'], [LAYOUT_JSX, 'Layout.jsx'], [STYLES_CSS, 'styles.css']]) {
    const src = safeRead(f);
    assert(src, `${label} missing — regression.`);
    assert(!/priority-signal|prioritySignal|brain\/signals|record-priority-signal/i.test(src),
      `${label} must NOT reference signals — this story ships ZERO UI diff (ADR 0007 d14; the story pins no new ` +
      'view/capture form; RecordEntry renders signal entries as-is).');
  }
});

test('S13 (sentinel — ADR d10): the brain module stays structurally read-only — no mutation/strfry tokens', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(!/child_process|execFile|exec\s*\(|strfry|publishToStrfry|regenerateJson|nostrPublish|signAndFinalize/.test(src),
    'the brain module must stay mutation- and strfry-free — signal WRITES live in normalize (ADR 0007 d10 / story-2 S6 / story-5 S13).');
});

test('S14 (sentinel — house rule): no hardcoded 64-hex pubkey in the story\'s touched server files', () => {
  for (const f of [SIGNALS_CORE, BRAIN_API, NORMALIZE_INDEX]) {
    const src = safeRead(f);
    if (!src && f === SIGNALS_CORE) continue; // the core does not exist pre-impl; U1 fails loudly for that
    assert(src, `${path.relative(ROOT, f)} missing.`);
    assert(!/\b[0-9a-f]{64}\b/i.test(src),
      `${path.relative(ROOT, f)} contains a 64-hex literal — the TA pubkey is per-deployment and must be resolved ` +
      'at runtime (house rule; PRD §7.8).');
  }
});

/* ══════════════ H-class — live local stack (SKIP when absent) ══════════════ */

test('H1 (AC1/AC2/AC3 — the round-trip): a signal between two NON-VIABLE goals self-bootstraps the concept and lands on BOTH spines with the ratified wording + attribution', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  armGoalFixtures();
  const r = recordSignal({ prefers: FIX_A_SLUG, over: FIX_B_SLUG, reason: FIX_REASON });
  assert(r && r.success === true && r.result === 'recorded',
    `record-priority-signal must answer {success:true, result:'recorded', …} — BOTH fixture goals are captured/non-viable, ` +
    `and viability is NOT required (ADR 0007 d4, operator-ratified). Got ${short(r, 400)}.`);
  assert(r.signal && r.signal.slug && r.signal.uuid,
    `the response must carry the signal's slug + uuid (durability/teardown; ADR 0007 d6). Got ${short(r.signal)}.`);
  firstSignalUuid = r.signal.uuid;
  // The concept must now exist live — self-bootstrapped, never firmware-seeded.
  const ta = getTaPubkey();
  const node = loopbackGetJson(`/api/concept-graph/node/${encodeURIComponent(`39998:${ta}:${SIGNAL_CONCEPT_SLUG}`)}`);
  assert(node && node.success !== false && node.node,
    `the Priority Signal concept (39998:<TA>:${SIGNAL_CONCEPT_SLUG}) must exist after the first signal — ` +
    `ensureSignalConcept did not provision it (ADR 0007 d9). Got ${short(node, 300)}.`);
  // BOTH goals' spines carry the signal, each side worded from its own perspective (AC3; d5 verbatim).
  const a = getGoalDetail(FIX_A_SLUG);
  const aEntry = (a.records || []).find((e) => e.type === TYPE_PREFERRED);
  assert(aEntry, `the preferred goal's spine must show a '${TYPE_PREFERRED}' entry (AC3; got ${short(a.records, 300)}).`);
  assert(aEntry.summary === wordPrefers(FIX_B_NAME, FIX_REASON),
    `the preferred side must read the ratified template verbatim (ADR 0007 d5):\n  want '${wordPrefers(FIX_B_NAME, FIX_REASON)}'\n  got  '${short(aEntry.summary)}'.`);
  const b = getGoalDetail(FIX_B_SLUG);
  const bEntry = (b.records || []).find((e) => e.type === TYPE_PASSED_OVER);
  assert(bEntry, `the passed-over goal's spine must show a '${TYPE_PASSED_OVER}' entry (AC3; got ${short(b.records, 300)}).`);
  assert(bEntry.summary === wordOver(FIX_A_NAME, FIX_REASON),
    `the passed-over side must read the ratified template verbatim (ADR 0007 d5):\n  want '${wordOver(FIX_A_NAME, FIX_REASON)}'\n  got  '${short(bEntry.summary)}'.`);
  assert(aEntry.date === bEntry.date && typeof aEntry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(aEntry.date),
    `both sides project the SAME judged-on date (one fact, two views; ADR 0007 d3); got ${short([aEntry.date, bEntry.date])}.`);
  // AC2 — the STORED element carries judged-by, judged-on, and the framing tag.
  firstSignalJson = elementJsonTag(firstSignalUuid);
  const section = JSON.parse(firstSignalJson).prioritySignal;
  assert(section && section.judgedBy === 'owner',
    `the stored signal must carry judgedBy 'owner' (AC2; ADR 0007 d7); got ${short(section && section.judgedBy)}.`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(section.judgedOn || ''),
    `the stored signal must carry a judgedOn date (AC2); got ${short(section && section.judgedOn)}.`);
  assert(section.framing === FRAMING_V1,
    `the stored signal must carry the server-stamped framing '${FRAMING_V1}' (AC2/AC5; ADR 0007 d8); got ${short(section && section.framing)}.`);
});

test('H2 (AC3/AC5 — reversal + append-only): B-over-A (no reason) coexists with the original; the first element is byte-unchanged; no fold without a reason', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  assert(firstSignalUuid, 'H1 must have recorded the first signal — H1 failed.');
  const aBefore = recordSnapshot(FIX_A_SLUG);
  const bBefore = recordSnapshot(FIX_B_SLUG);
  const r = recordSignal({ prefers: FIX_B_SLUG, over: FIX_A_SLUG });
  assert(r && r.success === true,
    `the reversal (B over A) must be recordable — a changed mind is a NEW signal (AC3; §7.2). Got ${short(r, 300)}.`);
  // The new entries appear, worded per side, with NO reason fold.
  const b = getGoalDetail(FIX_B_SLUG);
  const bPreferred = (b.records || []).find((e) => e.type === TYPE_PREFERRED);
  assert(bPreferred && bPreferred.summary === wordPrefers(FIX_A_NAME, null),
    `beta's preferred-side entry must read '${wordPrefers(FIX_A_NAME, null)}' (no reason fold; ADR 0007 d5); got '${short(bPreferred && bPreferred.summary)}'.`);
  const a = getGoalDetail(FIX_A_SLUG);
  const aPassedOver = (a.records || []).find((e) => e.type === TYPE_PASSED_OVER);
  assert(aPassedOver && aPassedOver.summary === wordOver(FIX_B_NAME, null),
    `alpha's passed-over entry must read '${wordOver(FIX_B_NAME, null)}' (no reason fold); got '${short(aPassedOver && aPassedOver.summary)}'.`);
  // Append-only: every prior spine line survives on BOTH goals (nothing rewritten).
  const aAfter = recordSnapshot(FIX_A_SLUG);
  const bAfter = recordSnapshot(FIX_B_SLUG);
  for (const line of aBefore.split('\n').filter(Boolean)) {
    assert(aAfter.includes(line), `append-only violated on alpha: a prior spine entry changed or vanished.\n  missing: ${line}`);
  }
  for (const line of bBefore.split('\n').filter(Boolean)) {
    assert(bAfter.includes(line), `append-only violated on beta: a prior spine entry changed or vanished.\n  missing: ${line}`);
  }
  // …and the FIRST element is byte-unchanged in the store (nothing re-signed).
  const nowJson = elementJsonTag(firstSignalUuid);
  assert(nowJson === firstSignalJson,
    'append-only violated: the first signal\'s stored json changed after a later signal (PRD §7.2; ADR 0007 d2 — a signal is born final).');
});

test('H3 (AC1 — refusals write nothing): a goal over itself is refused same-goal; an unknown goal is refused goal-not-found', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const aBefore = recordSnapshot(FIX_A_SLUG);
  const self = loopbackPostJson('/api/normalize/record-priority-signal', { prefers: FIX_A_SLUG, over: FIX_A_SLUG });
  assert(self && self.success === false && /same/i.test(self.refusal || self.error || ''),
    `a choice of a goal over itself must be REFUSED (same-goal; AC1; got ${short(self, 300)}).`);
  const unknown = loopbackPostJson('/api/normalize/record-priority-signal', { prefers: FIX_A_SLUG, over: FIX_MISSING_SLUG });
  assert(unknown && unknown.success === false && /found|unknown|exist/i.test(unknown.refusal || unknown.error || ''),
    `a choice naming an unknown goal must be REFUSED (goal-not-found; AC1; got ${short(unknown, 300)}).`);
  assert(recordSnapshot(FIX_A_SLUG) === aBefore,
    'AC1 violated: a refused signal left a spine entry — a refusal must write NOTHING.');
});

test('H4 (AC4 — recorded, never acted on): a repeat of the same pair succeeds (the corpus accumulates) and the proposals queue is untouched', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const queueBefore = JSON.stringify(getProposals());
  const r = recordSignal({ prefers: FIX_A_SLUG, over: FIX_B_SLUG, reason: FIX_REASON_REPEAT });
  assert(r && r.success === true,
    `the SAME pair must be recordable again — each choice is a new dated fact (ADR 0007 d2; got ${short(r, 300)}).`);
  const a = getGoalDetail(FIX_A_SLUG);
  const preferredEntries = (a.records || []).filter((e) => e.type === TYPE_PREFERRED);
  assert(preferredEntries.length >= 2,
    `alpha's spine must now carry BOTH its preferred entries (the corpus accumulates; got ${preferredEntries.length}).`);
  const queueAfter = JSON.stringify(getProposals());
  assert(queueAfter === queueBefore,
    'AC4 violated: recording signals changed the proposals queue — signals must never produce, decide, or launch anything.');
});

test('H5 (ADR d10 — merge): the goal-detail records[] merges work-record + signal entries newest-first on one spine', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const w = recordWork({ goal: FIX_A_SLUG, session: FIX_WORK_SESSION, summary: FIX_WORK_SUMMARY });
  assert(w && w.success === true, `create-work-record on alpha must succeed (got ${short(w, 300)}).`);
  const detail = getGoalDetail(FIX_A_SLUG);
  const types = new Set((detail.records || []).map((e) => e.type));
  assert(types.has('worked') && types.has(TYPE_PREFERRED) && types.has(TYPE_PASSED_OVER),
    `alpha's spine must MERGE work-record + signal entries (worked + ${TYPE_PREFERRED} + ${TYPE_PASSED_OVER}; ADR 0007 d10); got ${short([...types])}.`);
  const dates = (detail.records || []).map((e) => e.date || '');
  for (let i = 1; i < dates.length; i++) {
    assert(dates[i - 1] >= dates[i],
      `the merged records must be newest-date first (ADR 0007 d10); got out-of-order ${short(dates)}.`);
  }
});

test('H6 (gates): host-side POST record-priority-signal is 401\'d; /api/brain/signals is 404 (no route exists)', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const p = await fetch(`${HOST_BASE}/api/normalize/record-priority-signal`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}), signal: AbortSignal.timeout(5000),
  });
  assert(p.status === 401,
    `an unauthenticated remote mutation to /api/normalize/record-priority-signal must be 401'd by the middleware ` +
    `(security-auth-exposure/0002). Got ${p.status}${p.status === 404 ? ' — route not registered yet' : ''}.`);
  const g = await fetch(`${HOST_BASE}/api/brain/signals`, { signal: AbortSignal.timeout(5000) });
  assert(g.status === 404,
    `/api/brain/signals must NOT exist (ADR 0007 d10 — no new brain route; the goal detail is the surface). Got ${g.status}.`);
});

test('H7 (sentinel — AC6): the hygiene check stays green — creating the Priority Signal concept does not disturb it', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackGetJson('/api/brain/hygiene');
  assert(r && r.success === true && r.sound === true && Array.isArray(r.problems) && r.problems.length === 0,
    `the hygiene check must stay green — the runtime-created Priority Signal concept is not in its scope. Got: ${short(r, 500)}.`);
});

/* ══════════════ R-class — regression sentinels (pass before AND after) ══════════════ */

test('R1: the brain read surfaces this story extends are still registered (goals/detail/hygiene/orient/proposals)', () => {
  const src = safeRead(BRAIN_API);
  assert(/\/api\/brain\/goals/.test(src) && /\/api\/brain\/hygiene/.test(src) && /\/api\/brain\/orient/.test(src)
    && /\/api\/brain\/proposals/.test(src),
    'src/api/brain/index.js must keep the goals + hygiene + orient + proposals read routes (story 1/2/5/6 regression).');
});

test('R2: the byte-pinned untouchables and PUBLIC_MUTATIONS stay free of this story', () => {
  for (const f of [RELATIONSHIPS, PROBE]) {
    const src = safeRead(f);
    assert(src, `${path.relative(ROOT, f)} missing — relationship-primitives regression.`);
    assert(!/record-priority-signal|tapestry-priority-signal|prioritySignal/.test(src),
      `${path.relative(ROOT, f)} must not be touched by this story (byte-pinned untouchable; ADR 0007 d14).`);
  }
  const auth = safeRead(AUTH);
  assert(auth, 'src/middleware/auth.js missing — regression.');
  assert(!/record-priority-signal/.test(auth),
    'PUBLIC_MUTATIONS / the middleware must NOT special-case the signal route — it stays owner/loopback-gated (ADR 0007 d6).');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- teach-it-what-matters tests (epic second-brain, Story 7) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  try {
    for (const [name, fn] of tests) {
      try {
        const r = await fn();
        if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
        else { console.log(`  PASS  ${name}`); pass++; }
      } catch (err) {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      }
    }
  } finally {
    teardownFixtures();
    if (teardownFailure) {
      console.log(`  FAIL  fixture teardown\n        ${teardownFailure}`);
      failures.push({ name: 'fixture teardown', message: teardownFailure });
      fail++;
    }
  }
  console.log(`\nteach-it-what-matters: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
