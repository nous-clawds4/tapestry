/**
 * Story 5 (epic: second-brain) — Sessions read the brain: bounded orientation
 * and append-only work records.
 *
 * Story: engineering-team/stories/second-brain/5-sessions-read-the-brain.md
 * ADR:   engineering-team/decisions/second-brain/0005-work-records-and-bounded-orientation.md
 *
 * Test classes (ADR "Test-class guidance", per test-hermeticity-ci/0001):
 *
 *   U-class (EXECUTED, stack-free, always gates CI) — the new pure work-records
 *     core (src/lib/brain/work-records.js): parseWorkRecordRow's whitelisting
 *     shape (type/goal/session/summary/questions/produced/happenedOn), the
 *     group-by-goal helper, the recency sort (newest happenedOn first), and the
 *     WORK_RECORD_TYPES constant — all over SYNTHETIC records (no stack).
 *
 *   S-class (source assertions, stack-free) — the two new normalize write
 *     primitives (create-work-record → worked; note-goal-idea → capture + noted)
 *     with their routes/gates/discriminated results/refusals; the append-only
 *     mint (nonce/random d-tag; NO regenerateJson on the record path); the
 *     self-bootstrap; the shared write mutex re-use; the bounded orient endpoint
 *     + ORIENT_ROOT_CAP; the populated records[] projection; the brain import
 *     surface re-pinned to SEVEN; the extended record-entry UI (session,
 *     questions, produced pointers, STILL no edit affordance); the dispositioned
 *     GoalDetail findings (86b accessible Retry button in both surfaces; 87a
 *     dead fallback dropped; 87b headings ratified); jargon-clean strings; and
 *     read-only/no-64-hex sentinels.
 *
 *   H-class (live local stack, per-test SKIP when unreachable) — the concept
 *     self-bootstraps on the first record; create-work-record round-trips onto
 *     the goal's spine with a produced resource resolved to a pointer card;
 *     append-only (a second record leaves the first byte-unchanged);
 *     too-many-questions is refused; note-goal-idea captures a session-attributed
 *     root goal + a noted record and launches nothing; name-collides is refused;
 *     bounded orient stays flat past ORIENT_ROOT_CAP; the refusal matrix writes
 *     nothing; hygiene stays green; host-side caller-classes.
 *
 *   R-class (regression sentinels, stack-free, pass before AND after).
 *
 * Pass-by-design sentinels (documented, story-2/3/4 review precedent) that pass
 * BEFORE the feature lands: S13, S14, H9, R1, R2 (invariants the story must not
 * break); S10 (the detail page carries no banned jargon today and must keep it);
 * and S4, S5 (conditional pins — guarded with `if (handler absent) continue`, so
 * they are vacuous until the handlers exist and bind once they do, catching a
 * dropped mutex / a deterministic non-append d-tag post-impl). The other 22
 * FAIL until the feature lands (the work-records core is missing, routes 404,
 * the concept is absent, the detail page has no session/questions/produced
 * rendering, orient 404s). Verified 2026-07-23 pre-impl: 8 passed, 22 failed, 0
 * skipped (stack present). H tests SKIP when the stack is absent (CI's stack-free
 * job).
 *
 * Fixture hygiene: the H rows create sentinel-named goals (a work-record host
 * goal, a produced resource on it, a note-goal-idea root goal, and
 * ORIENT_ROOT_CAP+1 orient root goals) plus append-only work records. run()'s
 * finally tears them all down: strfry delete by d-tag first (goals' + resources'
 * deterministic d-tags computed via the real dtag core; work records' random
 * d-tags captured from the create responses' uuids), then Neo4j element+tags,
 * then a value-scoped orphan-tag sweep (json CONTAINS the 'harness-workrec-'
 * sentinel — every fixture's json carries it via its slug/goal/locator), then a
 * strfry count-0 verify. Pre-clean runs the same routine best-effort. A teardown
 * failure is a loud suite failure. The Work Record CONCEPT, once bootstrapped,
 * persists (it is the real feature concept; only fixture ELEMENTS are torn
 * down); the suite is idempotent across runs (ensureWorkRecordConcept no-ops
 * when present).
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const WORK_RECORDS_CORE = path.join(ROOT, 'src/lib/brain/work-records.js');
const BRAIN_API = path.join(ROOT, 'src/api/brain/index.js');
const NORMALIZE_INDEX = path.join(ROOT, 'src/api/normalize/index.js');
const RELATIONSHIPS = path.join(ROOT, 'src/api/normalize/relationships.js');
const PROBE = path.join(ROOT, 'src/api/normalize/probe.js');
const AUTH = path.join(ROOT, 'src/middleware/auth.js');
const GOALS_PAGE = path.join(ROOT, 'ui/src/pages/brain/Goals.jsx');
const DETAIL_PAGE = path.join(ROOT, 'ui/src/pages/brain/GoalDetail.jsx');
const DTAG_CORE = path.join(ROOT, 'src/lib/dtag.js');

const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

// The Work Record concept (ADR 0005 d1) — runtime-created, TA-scoped.
const WORK_RECORD_CONCEPT_SLUG = 'tapestry-work-record';
const WORK_RECORD_CONCEPT_NAME = 'tapestry work record';
const RESOURCE_CONCEPT_SLUG = 'tapestry-external-resource';
const GOAL_CONCEPT_SLUG = 'tapestry-owner-goal';
const RECORD_TYPES = ['worked', 'noted'];

// Bounded orientation (ADR 0005 d11/d15) — the single named cap on the roots
// slice; the test pins the ADR's value and grows the corpus past it.
const ORIENT_ROOT_CAP = 24;

// H fixtures — all sentinel-tagged so the Neo4j orphan sweep (json CONTAINS the
// sentinel) is the catch-all; every fixture's json carries it via slug/goal/
// locator (dashes, not the space-separated owner-facing labels).
const FIX_SENTINEL = 'harness-workrec-';
const FIX_GOAL_NAME = 'harness workrec host goal';
const FIX_GOAL_SLUG = 'harness-workrec-host-goal';
const FIX_GOAL_DELIVERABLE = 'a harness-workrec host goal with a verbatim done-means line';
const FIX_GOAL_BOUNDARY = 'stays inside the harness-workrec fixture set';
const FIX_GOAL_JSON = { tapestryOwnerGoal: {
  name: FIX_GOAL_NAME,
  slug: FIX_GOAL_SLUG,
  description: 'a host goal that acquires work records',
  deliverable: FIX_GOAL_DELIVERABLE,
  boundary: FIX_GOAL_BOUNDARY,
  origin: 'harness test, in conversation',
  capturedOn: '2026-07-23',
} };
const FIX_SESSION = 'harness workrec session';
const FIX_SUMMARY = 'harness workrec ran and left this standing summary';
// The produced resource (a web address — the simplest open-native case). Its
// locator carries the sentinel so the sweep catches it.
const FIX_PROD_TITLE = 'harness workrec produced resource';
const FIX_PROD_KIND = 'web-address';
const FIX_PROD_LOCATOR = 'https://example.org/harness-workrec-produced';
// The session-born idea (note-goal-idea) — a new root goal + a noted record.
const FIX_IDEA_NAME = 'harness workrec noted idea';
const FIX_IDEA_SLUG = 'harness-workrec-noted-idea';
const FIX_IDEA_STATEMENT = 'a harness-workrec idea that arose inside a session';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function short(x, n = 260) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}

function loadWorkRecordsCore() {
  if (!fs.existsSync(WORK_RECORDS_CORE)) {
    throw new Error('src/lib/brain/work-records.js does not exist yet — the work-records core (ADR 0005 d9) is not implemented.');
  }
  try { return require(WORK_RECORDS_CORE); }
  catch (e) { throw new Error(`src/lib/brain/work-records.js failed to require: ${e.message}`); }
}
const CORE_MISSING_FN = (fn) =>
  `src/lib/brain/work-records.js does not export ${fn}() yet — the work-records core (ADR 0005 d9) is not implemented.`;

// The real d-tag core — used to compute deterministic fixture d-tags for
// teardown (goals + resources; work records use random d-tags captured from
// their create responses). Loaded lazily so a stack-free U/S run never needs it.
let _dtag = null;
function dtagCore() {
  if (_dtag) return _dtag;
  _dtag = require(DTAG_CORE);
  return _dtag;
}

/* ── synthetic fixtures (U-class) ─────────────────────────────────────── */

const TA = 'synthetic-ta'; // handles are opaque strings to the core — no hex needed
function core39999(slug) { return `39999:${TA}:${slug}`; }

// A parsed work-record record in the ADR 0005 d1 shape (parseWorkRecordRow out).
function wrec(over = {}) {
  return {
    uuid: core39999('harness-workrec-fixture'),
    name: 'worked: some goal',
    slug: 'worked-some-goal-abcd1234',
    type: 'worked',
    goal: 'some-goal',
    session: 'a session',
    summary: 'did the thing',
    questions: [],
    produced: [],
    happenedOn: '2026-07-20',
    createdAt: 1784000000,
    ...over,
  };
}

/* ── live-stack helpers (H-class; the house pattern) ──────────────────── */

function dockerCurl(args) {
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], {
    encoding: 'utf8', timeout: 15000,
  });
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

function getGoals() {
  const r = loopbackGetJson('/api/brain/goals');
  assert(r && r.success === true && Array.isArray(r.goals),
    `GET /api/brain/goals must answer {success:true, goals:[…]} (got ${short(r)}).`);
  return r.goals;
}
function getGoalDetail(slug) {
  return loopbackGetJson(`/api/brain/goals/${encodeURIComponent(slug)}`);
}
function getOrient(slug) {
  const q = slug ? `?goal=${encodeURIComponent(slug)}` : '';
  return loopbackGetJson(`/api/brain/orient${q}`);
}
// The fixture goal's record set, as the detail endpoint returns it — the
// append-only + refusal tests compare this before/after to prove nothing moved.
function recordSnapshot(slug) {
  const r = getGoalDetail(slug);
  const records = Array.isArray(r?.records) ? r.records : [];
  return records
    .map((e) => [e.date, e.type, e.summary, e.session].join('|'))
    .sort()
    .join('\n');
}

/* ── H fixture bookkeeping ─────────────────────────────────────────────── */

let fixturesArmed = false;
let teardownFailure = null;
const createdRecordUuids = [];   // random-d-tag work records — captured from responses
const createdGoalSlugs = [];     // note-goal-idea + orient roots — d-tags derived via dtag

function dTagFromUuid(uuid) {
  const parts = String(uuid).split(':');
  return parts.slice(2).join(':');
}
function goalHeaderUuid() { return `39998:${getTaPubkey()}:${GOAL_CONCEPT_SLUG}`; }
function resourceHeaderUuid() { return `39998:${getTaPubkey()}:${RESOURCE_CONCEPT_SLUG}`; }
// A goal element's d-tag = childDTag(name, goalHeaderUuid) — the create-element /
// createChildGoal mint scheme (deterministic; no nonce).
function goalDtag(name) { return dtagCore().childDTag(name, goalHeaderUuid()); }
// A resource element's d-tag = childDTag(identitySlug, resourceHeaderUuid) where
// identitySlug = `${goalSlug}-${hash8(kind\nlocator)}` (ADR 0004 d3).
function resourceDtag(goalSlug, kind, locator) {
  const d = dtagCore();
  const identitySlug = `${goalSlug}-${d.hash8(`${kind}\n${locator}`)}`;
  return d.childDTag(identitySlug, resourceHeaderUuid());
}
function allFixtureDtags() {
  const goalDtags = [FIX_GOAL_SLUG === '' ? '' : goalDtag(FIX_GOAL_NAME), ...createdGoalSlugs.map((n) => goalDtag(n))];
  const recordDtags = createdRecordUuids.map(dTagFromUuid);
  const resourceDtags = [resourceDtag(FIX_GOAL_SLUG, FIX_PROD_KIND, FIX_PROD_LOCATOR)];
  return [...new Set([...goalDtags, ...recordDtags, ...resourceDtags].filter(Boolean))];
}
function allFixtureUuids() {
  const ta = getTaPubkey();
  const dtags = allFixtureDtags();
  return dtags.map((d) => `39999:${ta}:${d}`);
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
  // Orphan-tag sweep, value-scoped to the sentinel family and the tracked
  // d-tags. Never by z value (the z value is a concept header uuid, shared with
  // the real concepts).
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
  try {
    deleteFixturesFromStrfry();
    deleteFixturesFromNeo4j();
    fixturesArmed = false;
  } catch (e) {
    teardownFailure = e.message;
  }
}

// Create the host goal fixture (story-1 create-element lane) — records attach to
// a real goal. Idempotent-ish: pre-clean first.
function armGoalFixture() {
  fixturesArmed = true;
  preCleanFixtures();
  const created = loopbackPostJson('/api/normalize/create-element', {
    concept: 'tapestry owner goal', name: FIX_GOAL_NAME, json: FIX_GOAL_JSON,
  });
  assert(created && created.success === true,
    `create-element rejected the host-goal fixture (got ${short(created, 400)}).`);
}
// Record work on the host goal; track the (random-d-tag) record uuid for teardown.
function recordWork(body) {
  const r = loopbackPostJson('/api/normalize/create-work-record', body);
  if (r && r.success === true && r.record && r.record.uuid) createdRecordUuids.push(r.record.uuid);
  return r;
}
// Note a session-born idea; track the new goal's name + the noted record uuid.
function noteIdea(body) {
  const r = loopbackPostJson('/api/normalize/note-goal-idea', body);
  if (r && r.success === true) {
    if (r.goal && r.goal.name && !createdGoalSlugs.includes(r.goal.name)) createdGoalSlugs.push(r.goal.name);
    else if (body && body.name && !createdGoalSlugs.includes(body.name)) createdGoalSlugs.push(body.name);
    if (r.record && r.record.uuid) createdRecordUuids.push(r.record.uuid);
  }
  return r;
}
// Create N sentinel root goals for the bounded-orient test (create-element lane).
function armOrientRoots(n) {
  for (let i = 0; i < n; i++) {
    const name = `harness workrec orient ${i}`;
    const slug = `harness-workrec-orient-${i}`;
    const created = loopbackPostJson('/api/normalize/create-element', {
      concept: 'tapestry owner goal', name,
      json: { tapestryOwnerGoal: { name, slug, description: 'a harness-workrec orient root goal', capturedOn: '2026-07-23' } },
    });
    if (created && created.success === true && !createdGoalSlugs.includes(name)) createdGoalSlugs.push(name);
  }
}

/* ══════════════ U-class — the pure work-records core (EXECUTED) ══════════════ */

test('U1 (contract): work-records core exports parseWorkRecordRow, a group-by-goal helper, a recency sort, and WORK_RECORD_TYPES', () => {
  const core = loadWorkRecordsCore();
  assert(typeof core.parseWorkRecordRow === 'function', CORE_MISSING_FN('parseWorkRecordRow'));
  const grouper = core.groupWorkRecordsByGoal || core.groupByGoal || core.recordsByGoal;
  assert(typeof grouper === 'function',
    'work-records core must export a group-by-goal helper (groupWorkRecordsByGoal) — ADR 0005 d9/d10.');
  const sorter = core.sortRecordsByRecency || core.sortRecords || core.sortByRecency;
  assert(typeof sorter === 'function',
    'work-records core must export a recency sort helper (sortRecordsByRecency) — ADR 0005 d10 (newest happenedOn first).');
  const types = core.WORK_RECORD_TYPES;
  assert(Array.isArray(types) && RECORD_TYPES.every((t) => types.includes(t)),
    `WORK_RECORD_TYPES must include ${RECORD_TYPES.join('/')} (ADR 0005 d2); got ${short(types)}.`);
});

test('U2 (AC 3/AC 4): parseWorkRecordRow extracts type/goal/session/summary/questions/produced/happenedOn; non-record/malformed → null', () => {
  const core = loadWorkRecordsCore();
  const full = core.parseWorkRecordRow({
    uuid: core39999('harness-workrec-x'), name: 'worked: the big goal', createdAt: 1784000001,
    json: JSON.stringify({ workRecord: {
      name: 'worked: the big goal', slug: 'worked-the-big-goal-abcd1234', description: 'shipped the read path',
      type: 'worked', goal: 'the-big-goal', session: 'session 42',
      summary: 'shipped the read path', questions: ['is the boundary right?', 'ship it?'],
      produced: ['https://example.org/produced-a'], happenedOn: '2026-07-22',
    } }),
  });
  assert(full, 'parseWorkRecordRow must return a record for a well-formed work-record row.');
  assert(full.type === 'worked', `the record type must be extracted (worked/noted); got ${short(full.type)}.`);
  assert(full.goal === 'the-big-goal',
    `the served goal slug must be extracted — the record-based linkage (ADR 0005 d4); got ${short(full.goal)}.`);
  assert(full.session === 'session 42', `the session attribution must be extracted (AC 4); got ${short(full.session)}.`);
  assert(full.summary === 'shipped the read path', `the one-sentence summary must be extracted (AC 3); got ${short(full.summary)}.`);
  assert(Array.isArray(full.questions) && full.questions.length === 2,
    `the (≤2) questions must be extracted (AC 3); got ${short(full.questions)}.`);
  assert(Array.isArray(full.produced) && full.produced[0] === 'https://example.org/produced-a',
    `the produced locators must be extracted (AC 3); got ${short(full.produced)}.`);
  assert(full.happenedOn === '2026-07-22', `the happened-on date must be extracted (AC 4); got ${short(full.happenedOn)}.`);
  // A resource row (wrong section) is not a work record.
  const notRecord = core.parseWorkRecordRow({
    uuid: core39999('r'), name: 'r', createdAt: 1, json: JSON.stringify({ externalResource: { name: 'r', slug: 'r', locator: 'x' } }),
  });
  assert(notRecord === null, 'a row without a workRecord section must parse to null (never a phantom record).');
  const malformed = core.parseWorkRecordRow({ uuid: core39999('m'), name: 'm', createdAt: 1, json: '{not json' });
  assert(malformed === null, 'malformed json must parse to null, never throw (event-tagging 0009 discipline).');
});

test('U3 (AC 3): the group-by-goal helper buckets records by their goal slug; unrelated records are excluded', () => {
  const core = loadWorkRecordsCore();
  const grouper = core.groupWorkRecordsByGoal || core.groupByGoal || core.recordsByGoal;
  const a1 = wrec({ uuid: core39999('a1'), goal: 'goal-a' });
  const a2 = wrec({ uuid: core39999('a2'), goal: 'goal-a' });
  const b1 = wrec({ uuid: core39999('b1'), goal: 'goal-b' });
  const out = grouper([a1, a2, b1]);
  const forA = out instanceof Map ? out.get('goal-a') : out['goal-a'];
  assert(Array.isArray(forA) ? forA.length === 2 : forA === 2, `goal-a must bucket its two records (got ${short(forA)}).`);
  const forB = out instanceof Map ? out.get('goal-b') : out['goal-b'];
  assert(Array.isArray(forB) ? forB.length === 1 : forB === 1, `goal-b must bucket its one record (got ${short(forB)}).`);
  const forC = out instanceof Map ? out.get('goal-c') : out['goal-c'];
  assert(forC == null || (Array.isArray(forC) ? forC.length === 0 : forC === 0),
    'a goal with no records buckets to nothing (ADR 0005 d10).');
});

test('U4 (AC 4 / ADR d10): the recency sort orders records newest happenedOn first', () => {
  const core = loadWorkRecordsCore();
  const sorter = core.sortRecordsByRecency || core.sortRecords || core.sortByRecency;
  const older = wrec({ uuid: core39999('older'), happenedOn: '2026-07-01', createdAt: 1 });
  const newer = wrec({ uuid: core39999('newer'), happenedOn: '2026-07-20', createdAt: 2 });
  const middle = wrec({ uuid: core39999('middle'), happenedOn: '2026-07-10', createdAt: 3 });
  const sorted = sorter([older, newer, middle]);
  assert(Array.isArray(sorted) && sorted.length === 3, `the sort must return all three records (got ${short(sorted)}).`);
  assert(sorted[0].happenedOn === '2026-07-20' && sorted[2].happenedOn === '2026-07-01',
    `records must be newest-happenedOn first (ADR 0005 d10; the morning-review reads downward); got ${short(sorted.map((r) => r.happenedOn))}.`);
});

/* ══════════════ S-class — source assertions (stack-free) ══════════════ */

test('S1 (ADR d6): create-work-record — route, gate, discriminated result/refusals incl. the ≤2-questions rule', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/\/api\/normalize\/create-work-record/.test(src),
    'POST /api/normalize/create-work-record is not registered (ADR 0005 d6) — not implemented yet.');
  const start = src.indexOf('handleCreateWorkRecord');
  assert(start !== -1, 'handleCreateWorkRecord not found in src/api/normalize/index.js.');
  const slice = src.slice(start, start + 12000);
  assert(/isOwner\s*\(\s*req\s*\)/.test(slice) && /localTrusted/.test(slice) && /403/.test(slice),
    'create-work-record must carry the explicit in-handler gate (isOwner(req) || req.localTrusted → 403) — ADR 0005 d6.');
  for (const tok of ['recorded', 'goal-not-found', 'too-many-questions']) {
    assert(slice.includes(tok),
      `create-work-record must answer the named discriminated result/refusal '${tok}' (ADR 0005 d6) — loud, named, nothing written.`);
  }
});

test('S2 (ADR d7): note-goal-idea — route, gate, named result/refusal (noted/name-collides), and NO launch/egress', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/\/api\/normalize\/note-goal-idea/.test(src),
    'POST /api/normalize/note-goal-idea is not registered (ADR 0005 d7) — not implemented yet.');
  const start = src.indexOf('handleNoteGoalIdea');
  assert(start !== -1, 'handleNoteGoalIdea not found in src/api/normalize/index.js.');
  const slice = src.slice(start, start + 12000);
  assert(/isOwner\s*\(\s*req\s*\)/.test(slice) && /localTrusted/.test(slice) && /403/.test(slice),
    'note-goal-idea must carry the explicit in-handler gate — ADR 0005 d7.');
  for (const tok of ['noted', 'name-collides']) {
    assert(slice.includes(tok),
      `note-goal-idea must answer the named discriminated result/refusal '${tok}' (ADR 0005 d7).`);
  }
  // Sessions propose, never launch (§7.3): the handler writes facts only — no
  // job/session spawn, no scheduler enqueue, no outbound egress.
  assert(!/\bfetch\s*\(|https?\.get\s*\(|https?\.request\s*\(|publishEverywhere|spawn\s*\(|\.enqueue\s*\(|scheduler|launch(Session|Task|Job)/i.test(slice),
    'note-goal-idea must launch NOTHING (PRD §7.3) — no fetch/spawn/enqueue/scheduler/launch call in the handler.');
});

test('S3 (ADR d8): the Work Record concept self-bootstraps — ensureWorkRecordConcept via create-concept + save-schema, guarded', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/ensureWorkRecordConcept/.test(src),
    'ensureWorkRecordConcept (the self-bootstrap helper, ADR 0005 d8) does not exist yet.');
  const start = src.indexOf('ensureWorkRecordConcept');
  const slice = src.slice(start, start + 4000);
  assert(/create-concept|createConcept|handleCreateConcept/.test(slice) && /save-schema|saveSchema|handleSaveSchema/.test(slice),
    'ensureWorkRecordConcept must provision via create-concept + save-schema when the concept is absent (ADR 0005 d8).');
  assert(src.includes(WORK_RECORD_CONCEPT_SLUG) || src.includes(WORK_RECORD_CONCEPT_NAME),
    `the write path must reference the Work Record concept (${WORK_RECORD_CONCEPT_SLUG}) — ADR 0005 d1/d8.`);
});

test('S4 (ADR d9): both new writes run through the existing serializeGoalWrite mutex (not renamed)', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/serializeGoalWrite/.test(src),
    'serializeGoalWrite must survive (story-3 S5 / story-4 S4 pin it) — ADR 0005 d9 reuses it, never renames it.');
  for (const handler of ['handleCreateWorkRecord', 'handleNoteGoalIdea']) {
    const start = src.indexOf(handler);
    if (start === -1) continue; // S1/S2 already fail loudly on a missing handler
    const slice = src.slice(start, start + 12000);
    assert(/serializeGoalWrite/.test(slice),
      `${handler} must run its read-validate-write body through the shared write mutex (ADR 0005 d9).`);
  }
});

test('S5 (ADR d3 — append-only by construction): the work-record write uses a random/nonce d-tag and never regenerateJsons a record', () => {
  const src = safeRead(NORMALIZE_INDEX);
  // The ADR pins the append-only PROPERTY, not where the mint lives — inline in
  // the cores or in a shared helper are both valid. Gather each function's body
  // (bounded to the next declaration, so no bleed into neighbours) and check the
  // write region as a whole.
  const fnBody = (name) => {
    const i = src.indexOf(`function ${name}`);
    if (i === -1) return '';
    const after = src.slice(i + 10);
    const next = after.search(/\n(?:async )?function /);
    return next === -1 ? src.slice(i) : src.slice(i, i + 10 + next);
  };
  const region = ['createWorkRecord', 'noteGoalIdea', 'mintWorkRecordElement', 'mintWorkRecord'].map(fnBody).join('\n--\n');
  assert(/function createWorkRecord|function noteGoalIdea/.test(src),
    'the work-record write cores are not implemented yet (createWorkRecord / noteGoalIdea) — ADR 0005 d6/d7.');
  // A fresh element each write — a random d-tag or a 3-arg childDTag(base, header,
  // nonce), never a deterministic 2-arg natural-key d-tag that could MERGE over a
  // prior record. (H3 is the live proof; this is the supporting source pin.)
  assert(/randomDTag\s*\(|childDTag\s*\([^)]+,[^)]+,[^)]+\)/.test(region),
    'the work-record mint must use a random d-tag or a nonce\'d childDTag (ADR 0005 d3) — append-only by construction, ' +
    'so a second record can never MERGE over a prior one.');
  // Work records are never re-signed — regenerateJson is the durable-intent
  // mutation path (resources/goals), never the append-only record path.
  assert(!/regenerateJson\s*\(/.test(region),
    'the work-record write path must NEVER regenerateJson — work records are append-only and never re-signed (ADR 0005 d3; PRD §7.2).');
});

test('S6 (ADR d11/d15): GET /api/brain/orient — route, gate, and the single named ORIENT_ROOT_CAP applied', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(/\/api\/brain\/orient/.test(src) && /handleGetOrient/.test(src),
    'the brain module must register GET /api/brain/orient → handleGetOrient (ADR 0005 d11) — the bounded orientation surface.');
  const start = src.indexOf('handleGetOrient');
  const slice = start !== -1 ? src.slice(start, start + 6000) : '';
  assert(/isOwner\s*\(\s*req\s*\)/.test(slice) && /localTrusted/.test(slice) && /403/.test(slice),
    'orient must carry the in-handler owner/loopback gate (403) — ADR 0005 d11.');
  assert(/ORIENT_ROOT_CAP/.test(src),
    'the roots slice must be bounded by a single named constant ORIENT_ROOT_CAP (ADR 0005 d11/d15).');
  assert(/goalCount/.test(slice) && /roots/.test(slice) && /served/.test(slice),
    'orient must return {goalCount, roots, served} — the bounded corpus-independent payload (ADR 0005 d11).');
});

test('S7 (ADR d10): the per-goal detail projects records[] (no longer hardcoded []) and the brain requires the work-records core', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(/require\s*\(\s*['"`][^'"`]*lib\/brain\/work-records['"`]\s*\)/.test(src),
    'the brain module must require ../../lib/brain/work-records — the records projection core (ADR 0005 d10) is not wired yet.');
  const start = src.indexOf('handleGetGoalDetail');
  const slice = start !== -1 ? src.slice(start, start + 5000) : '';
  assert(!/records:\s*\[\s*\]/.test(slice),
    'handleGetGoalDetail must PROJECT records (ADR 0005 d10) — the hardcoded `records: []` (story 4 placeholder) must be gone.');
});

test('S8 (ADR d10): the brain import surface is re-pinned to SEVEN — the story-4 six plus lib/brain/work-records, nothing else', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  const requires = [...src.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1]);
  assert(requires.some((s) => /lib\/brain\/work-records$/.test(s)),
    'the brain module must require ../../lib/brain/work-records — the records core (ADR 0005 d10) is not wired yet.');
  const allowed = [/neo4j-driver$/, /middleware\/auth$/, /assistantKeys$/, /lib\/brain\/goals$/, /lib\/brain\/hygiene$/, /lib\/brain\/resources$/, /lib\/brain\/work-records$/];
  for (const spec of requires) {
    assert(allowed.some((re) => re.test(spec)),
      `import surface violation: require('${spec}') — story 5 adds exactly lib/brain/work-records; the brain module ` +
      'allows only the seven cores (ADR 0005 d10; story-1 S2 + story-2 S3 + story-3 S1 + story-4 S11 re-pins).');
  }
});

test('S9 (ADR d12 / AC 3/AC 6): the record entry renders session, questions, and produced pointers — still no edit affordance', () => {
  const src = safeRead(DETAIL_PAGE);
  assert(src, 'ui/src/pages/brain/GoalDetail.jsx missing — story 3/4 regression.');
  const start = src.indexOf('function RecordEntry');
  assert(start !== -1, 'RecordEntry must exist (story 4 built it) — GoalDetail.jsx regression.');
  const slice = src.slice(start, start + 2500);
  assert(/session/i.test(slice), 'RecordEntry must render the session attribution (AC 3; ADR 0005 d12).');
  assert(/question/i.test(slice), 'RecordEntry must render the (≤2) questions (AC 3; ADR 0005 d12).');
  assert(/produced/i.test(slice) && /PointerCard/.test(slice),
    'RecordEntry must render produced resources as PointerCards (AC 3; design guide — work entries list produced pointers).');
  // The no-edit contract holds now that entries are LIVE (AC 6; story-4 S7).
  assert(!/<input\b|<textarea\b|contentEditable|onSubmit=|<form\b/i.test(src),
    'the detail page stays display-only — no input/textarea/form/contentEditable (AC 6: record entries are append-only, no edit affordance ever).');
  assert(!/deleteRecord|editRecord|removeEntry|onEdit|onDelete/i.test(src),
    'no per-entry edit/delete handler may exist — the ledger is the ledger (AC 6; PRD §7.2).');
});

test('S10 (AC 7): the Goal detail\'s new owner-facing strings are jargon-clean', () => {
  const src = safeRead(DETAIL_PAGE);
  assert(src, 'ui/src/pages/brain/GoalDetail.jsx missing — regression.');
  const visible = [
    ...[...src.matchAll(/'([^'\\\n]*)'/g)].map((m) => m[1]),
    ...[...src.matchAll(/"([^"\\\n]*)"/g)].map((m) => m[1]),
    ...[...src.matchAll(/`([^`]*)`/g)].map((m) => m[1]),
    ...[...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]),
  ].join('\n');
  // 'event'/'kind' stay excluded (design-guide-sanctioned pointer-kind markers, ADR 0004 d11).
  for (const w of ['superset', 'pubkey', 'payload', 'concept header', 'acceptance criteria', 'lease', 'schema', 'endpoint']) {
    assert(!new RegExp(`\\b${w}\\b`, 'i').test(visible),
      `banned jargon "${w}" found in owner-visible text of GoalDetail.jsx (style guide; AC 7).`);
  }
});

test('S11 (OPEN.md row 86b): the Retry control is an accessible <button> (not a href-less <a onClick>) in BOTH GoalDetail and Goals', () => {
  for (const f of [DETAIL_PAGE, GOALS_PAGE]) {
    const src = safeRead(f);
    assert(src, `${path.relative(ROOT, f)} missing — regression.`);
    if (!/retry/i.test(src)) continue; // no retry control on this surface → nothing to fix
    assert(/<button[^>]*brain-retry|brain-retry[^>]*onClick|<button[^>]*onClick=\{?\s*refetch/i.test(src)
        || (/<button/.test(src) && /refetch/.test(src) && !/<a[^>]*onClick=\{?\s*refetch/i.test(src)),
      `${path.relative(ROOT, f)}: the Retry control must be a focusable <button onClick={refetch}>, not a href-less <a onClick> ` +
      '(OPEN.md row 86b — keyboard accessibility; ADR 0005 d12).');
    assert(!/<a[^>]*className=['"`]brain-retry['"`][^>]*onClick/i.test(src),
      `${path.relative(ROOT, f)}: the href-less <a className="brain-retry" onClick=…> must be gone (OPEN.md row 86b).`);
  }
});

test('S12 (OPEN.md row 87a/87b): the dead freshness fallback is dropped; the ratified section headings remain', () => {
  const src = safeRead(DETAIL_PAGE);
  assert(src, 'ui/src/pages/brain/GoalDetail.jsx missing — regression.');
  // 87a: the dead `current`-branch null fallback is removed (the server never
  // returns 'current' with a null day-count — ADR 0005 d12). Match the LITERAL
  // `'verified recently'` (with quotes) so the ratified stale fallback
  // `'not verified recently'` — which contains the substring — is not tripped.
  assert(!/'verified recently'/.test(src),
    "the dead freshness fallback 'verified recently' must be dropped (OPEN.md row 87a; ADR 0005 d12) — it is unreachable.");
  // 87b: the section headings are ratified and pinned (they aid the one spine).
  assert(/>Resources</.test(src) && />Record</.test(src),
    'the ratified section headings "Resources" and "Record" must remain (OPEN.md row 87b; ADR 0005 d12).');
});

test('S13 (sentinel — ADR d10): the brain module stays structurally read-only — no mutation/strfry tokens', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(!/child_process|execFile|exec\s*\(|strfry|publishToStrfry|regenerateJson|nostrPublish|signAndFinalize/.test(src),
    'the brain module must stay mutation- and strfry-free — record WRITES live in normalize (ADR 0005 d10 / story-2 S6).');
});

test('S14 (sentinel — house rule): no hardcoded 64-hex pubkey in the story\'s touched server files', () => {
  for (const f of [WORK_RECORDS_CORE, BRAIN_API, NORMALIZE_INDEX]) {
    const src = safeRead(f);
    if (!src && f === WORK_RECORDS_CORE) continue; // the core does not exist pre-impl; U1 fails loudly for that
    assert(src, `${path.relative(ROOT, f)} missing.`);
    assert(!/\b[0-9a-f]{64}\b/i.test(src),
      `${path.relative(ROOT, f)} contains a 64-hex literal — the TA pubkey is per-deployment and must be resolved ` +
      'at runtime (house rule; PRD §7.8).');
  }
});

/* ══════════════ H-class — live local stack (SKIP when absent) ══════════════ */

test('H1 (ADR d8 / AC 3): the Work Record concept self-bootstraps on the first record; the record reads back on the goal spine', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  armGoalFixture();
  const r = recordWork({ goal: FIX_GOAL_SLUG, session: FIX_SESSION, summary: FIX_SUMMARY, questions: ['is the boundary right?'] });
  assert(r && r.success === true && r.result === 'recorded',
    `create-work-record must answer {success:true, result:'recorded', …} (got ${short(r, 400)}).`);
  assert(r.record && r.record.uuid,
    `the response must carry the created record's uuid for durability + teardown (got ${short(r.record)}).`);
  // The concept must now exist live — self-bootstrapped, never firmware-seeded.
  const ta = getTaPubkey();
  const node = loopbackGetJson(`/api/concept-graph/node/${encodeURIComponent(`39998:${ta}:${WORK_RECORD_CONCEPT_SLUG}`)}`);
  assert(node && node.success !== false && node.node,
    `the Work Record concept (39998:<TA>:${WORK_RECORD_CONCEPT_SLUG}) must exist after the first record — ` +
    `ensureWorkRecordConcept did not provision it (ADR 0005 d8). Got ${short(node, 300)}.`);
  // …and it reads back on the goal's one spine (AC 3).
  const detail = getGoalDetail(FIX_GOAL_SLUG);
  assert(detail && detail.success === true && Array.isArray(detail.records),
    `the per-goal detail must return a records array (got ${short(detail, 300)}).`);
  const entry = detail.records.find((e) => e.summary === FIX_SUMMARY);
  assert(entry, `the work record must read back on its goal's spine (AC 3; got ${short(detail.records, 300)}).`);
  assert(entry.type === 'worked' && entry.session === FIX_SESSION && entry.date,
    `the entry must carry type 'worked', its session, and a date (AC 3/AC 4); got ${short(entry, 300)}.`);
  assert(Array.isArray(entry.questions) && entry.questions.length === 1,
    `the entry must carry its (≤2) questions (AC 3); got ${short(entry.questions)}.`);
});

test('H2 (AC 3): a produced resource is attached to the goal and resolved in the record as a pointer card', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = recordWork({
    goal: FIX_GOAL_SLUG, session: FIX_SESSION, summary: 'harness workrec produced a resource',
    produced: [{ locatorKind: FIX_PROD_KIND, locator: FIX_PROD_LOCATOR, title: FIX_PROD_TITLE }],
  });
  assert(r && r.success === true, `create-work-record with a produced resource must succeed (got ${short(r, 400)}).`);
  const detail = getGoalDetail(FIX_GOAL_SLUG);
  // The produced resource is attached to the goal (ensure-and-reference, ADR 0005 d4).
  const p = (detail.pointers || []).find((x) => x.locator === FIX_PROD_LOCATOR);
  assert(p, `the produced resource must be attached to the goal (appears in pointers; ADR 0005 d4); got ${short(detail.pointers, 300)}.`);
  // …and resolved inside the record's produced list as a pointer card.
  const entry = (detail.records || []).find((e) => e.summary === 'harness workrec produced a resource');
  assert(entry, `the produced-resource record must read back (got ${short(detail.records, 300)}).`);
  assert(Array.isArray(entry.produced) && entry.produced.length >= 1,
    `the record's produced list must resolve to pointer cards (AC 3; got ${short(entry.produced, 300)}).`);
  const pc = entry.produced.find((x) => x && x.locator === FIX_PROD_LOCATOR);
  assert(pc && pc.locatorKind === FIX_PROD_KIND && typeof pc.freshness === 'string',
    `the produced pointer must carry kind + a derived freshness (design guide; got ${short(entry.produced, 300)}).`);
});

test('H3 (AC 4 — append-only): a second record on the goal adds an entry and leaves the first byte-unchanged', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const before = recordSnapshot(FIX_GOAL_SLUG);
  const beforeCount = (getGoalDetail(FIX_GOAL_SLUG).records || []).length;
  const r = recordWork({ goal: FIX_GOAL_SLUG, session: 'harness workrec session two', summary: 'harness workrec second pass, corrections are new facts' });
  assert(r && r.success === true, `a second work record must succeed (got ${short(r, 300)}).`);
  const after = getGoalDetail(FIX_GOAL_SLUG);
  assert((after.records || []).length === beforeCount + 1,
    `append-only: a second record must ADD exactly one entry (was ${beforeCount}, now ${(after.records || []).length}; PRD §7.2).`);
  const afterSnap = recordSnapshot(FIX_GOAL_SLUG);
  // Every prior line must still be present — nothing was edited or deleted.
  for (const line of before.split('\n').filter(Boolean)) {
    assert(afterSnap.includes(line),
      `append-only violated: a prior record entry changed or vanished after a new write.\n  missing: ${line}`);
  }
});

test('H4 (AC 3): a work record with more than two questions is refused, with NOTHING written', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const before = recordSnapshot(FIX_GOAL_SLUG);
  const r = loopbackPostJson('/api/normalize/create-work-record', {
    goal: FIX_GOAL_SLUG, session: FIX_SESSION, summary: 'harness workrec too many questions',
    questions: ['one?', 'two?', 'three?'],
  });
  assert(r && r.success === false,
    `three questions must be REFUSED (success:false) — the ≤2 rule is system behavior (got ${short(r, 300)}).`);
  assert((typeof r.refusal === 'string' && /question/i.test(r.refusal)) || (typeof r.error === 'string' && /question|two|2/i.test(r.error)),
    `the refusal must be loud and named (too-many-questions); got ${short(r, 200)}.`);
  const after = recordSnapshot(FIX_GOAL_SLUG);
  assert(before === after, `AC 3 violated: a refused write changed the goal's record set.\n  before:\n${before}\n  after:\n${after}`);
});

test('H5 (AC 5 / §7.3): note-goal-idea captures a session-attributed ROOT goal + a noted record, and launches nothing', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = noteIdea({ name: FIX_IDEA_NAME, statement: FIX_IDEA_STATEMENT, session: FIX_SESSION, servingGoal: FIX_GOAL_SLUG });
  assert(r && r.success === true && r.result === 'noted',
    `note-goal-idea must answer {success:true, result:'noted', …} (got ${short(r, 400)}).`);
  assert(r.goal && r.goal.slug && r.record && r.record.uuid,
    `the response must carry the captured goal + the noted record's uuid (for teardown); got ${short(r, 300)}.`);
  // The captured goal exists, is a ROOT (no parent), attributed to the session.
  const goals = getGoals();
  const captured = goals.find((g) => g.slug === r.goal.slug);
  assert(captured, `the session-born idea must be captured as a goal in the Goals view (AC 5; got ${short(r.goal, 200)}).`);
  assert(!captured.parent && !captured.parentUuid,
    `the captured idea is a ROOT goal in v1 (no parent; ADR 0005 d7); got parent ${short(captured.parent)}.`);
  assert(captured.standing === 'captured',
    `a freshly captured idea stands 'captured' (AC 5); got ${short(captured.standing)}.`);
  assert(typeof captured.origin === 'string' && captured.origin.length > 0,
    `the capture must be attributed (origin names the session provenance; AC 5); got ${short(captured.origin)}.`);
  // Its spine shows a NOTED record; nothing was launched (the only new artifacts
  // are the goal + its noted record — no child goal, no work record elsewhere).
  const detail = getGoalDetail(r.goal.slug);
  const noted = (detail.records || []).find((e) => e.type === 'noted');
  assert(noted, `the captured idea's spine must show a 'noted' record (AC 5; got ${short(detail.records, 300)}).`);
  assert(!captured.hasChildren, 'note-goal-idea must launch nothing — no work spawned, no child decomposition (PRD §7.3).');
});

test('H6 (AC 5): a session-born idea whose name collides is refused, with NOTHING written', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const dup = loopbackPostJson('/api/normalize/note-goal-idea', {
    name: FIX_IDEA_NAME, statement: 'a duplicate harness-workrec idea', session: FIX_SESSION,
  });
  assert(dup && dup.success === false,
    `a colliding idea name must be REFUSED (success:false) — no silent overwrite (got ${short(dup, 300)}).`);
  assert((typeof dup.refusal === 'string' && /collide|exist|name/i.test(dup.refusal)) || (typeof dup.error === 'string' && /collide|exist|name/i.test(dup.error)),
    `the refusal must be loud and named (name-collides); got ${short(dup, 200)}.`);
});

test('H7 (AC 1): orient is bounded — goalCount + a roots slice capped at ORIENT_ROOT_CAP + the served goal verbatim, flat past the cap', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  // Grow the corpus past the cap: ORIENT_ROOT_CAP + 1 fresh root goals guarantee
  // more roots than the cap regardless of the existing corpus.
  armOrientRoots(ORIENT_ROOT_CAP + 1);
  const o = getOrient(FIX_GOAL_SLUG);
  assert(o && o.success === true, `GET /api/brain/orient must answer success:true (got ${short(o, 300)}).`);
  assert(typeof o.goalCount === 'number' && o.goalCount >= ORIENT_ROOT_CAP + 1,
    `orient must report the true goalCount, now grown past the cap (>= ${ORIENT_ROOT_CAP + 1}); got ${short(o.goalCount)}.`);
  assert(Array.isArray(o.roots) && o.roots.length <= ORIENT_ROOT_CAP,
    `the roots slice must be BOUNDED at ORIENT_ROOT_CAP (${ORIENT_ROOT_CAP}) — corpus-independent (AC 1); got ${short(o.roots && o.roots.length)}.`);
  assert(o.roots.length < o.goalCount,
    `AC 1: with more goals than the cap, the roots slice must be strictly smaller than goalCount — the payload does NOT grow with N.`);
  // The served goal comes back in full, deliverable + boundary VERBATIM.
  assert(o.served && o.served.slug === FIX_GOAL_SLUG,
    `orient?goal=<slug> must return the served goal in full (AC 1); got ${short(o.served, 200)}.`);
  assert(o.served.deliverable === FIX_GOAL_DELIVERABLE && o.served.boundary === FIX_GOAL_BOUNDARY,
    `the served goal's deliverable + boundary must come back VERBATIM (AC 1); got ${short([o.served.deliverable, o.served.boundary], 300)}.`);
});

test('H8 (AC 2): the refusal matrix — an invalid record write is refused loudly with NOTHING written', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const before = recordSnapshot(FIX_GOAL_SLUG);
  const cases = [
    ['record work on a nonexistent goal', '/api/normalize/create-work-record',
      { goal: 'no-such-goal-slug', session: FIX_SESSION, summary: 'harness workrec orphan' }, /goal|found/i],
    ['record work with an empty session', '/api/normalize/create-work-record',
      { goal: FIX_GOAL_SLUG, session: '   ', summary: 'harness workrec no session' }, /session|empty|required|blank/i],
    ['record work with an empty summary', '/api/normalize/create-work-record',
      { goal: FIX_GOAL_SLUG, session: FIX_SESSION, summary: '   ' }, /summary|empty|required|blank/i],
    ['note an idea with an empty name', '/api/normalize/note-goal-idea',
      { name: '   ', statement: 'harness workrec empty name', session: FIX_SESSION }, /name|empty|required|blank/i],
  ];
  for (const [label, route, body, errRe] of cases) {
    const r = loopbackPostJson(route, body);
    assert(r && r.success === false, `${label}: must be REFUSED (success:false), got ${short(r, 300)}.`);
    assert((typeof r.error === 'string' && errRe.test(r.error)) || (typeof r.refusal === 'string' && errRe.test(r.refusal)),
      `${label}: the refusal must be loud and named (error/refusal matching ${errRe}); got ${short(r, 200)}.`);
  }
  const after = recordSnapshot(FIX_GOAL_SLUG);
  assert(before === after, `AC 2 violated: a refused write changed the goal's record set.\n  before:\n${before}\n  after:\n${after}`);
});

test('H9 (sentinel — AC 7): the hygiene check stays green — creating the Work Record concept does not disturb it', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackGetJson('/api/brain/hygiene');
  assert(r && r.success === true && r.sound === true && Array.isArray(r.problems) && r.problems.length === 0,
    `the hygiene check must stay green (AC 7; PRD §10) — the runtime-created Work Record concept is not in its scope. Got: ${short(r, 500)}.`);
});

test('H10 (gates): host-side calls to the new surfaces are refused by their caller-class — orient 403, the two writes 401', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  // The bounded orient is a read with an in-handler owner/loopback gate → 403 for a remote caller.
  const o = await fetch(`${HOST_BASE}/api/brain/orient`, { signal: AbortSignal.timeout(5000) });
  assert(o.status === 403,
    `an unauthenticated remote GET /api/brain/orient must be 403'd by the in-handler gate (ADR 0005 d11). Got ${o.status}${o.status === 404 ? ' — route not registered yet' : ''}.`);
  // The two mutations are default-denied by the middleware before the handler → 401.
  for (const route of ['/api/normalize/create-work-record', '/api/normalize/note-goal-idea']) {
    const p = await fetch(`${HOST_BASE}${route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), signal: AbortSignal.timeout(5000),
    });
    assert(p.status === 401,
      `an unauthenticated remote mutation to ${route} must be 401'd by the middleware before the handler ` +
      `(security-auth-exposure/0002). Got ${p.status}${p.status === 404 ? ' — route not registered yet' : ''}.`);
  }
});

/* ══════════════ R-class — regression sentinels (pass before AND after) ══════════════ */

test('R1: the brain read surfaces this story extends are still registered, plus the new orient', () => {
  const src = safeRead(BRAIN_API);
  assert(/\/api\/brain\/goals/.test(src) && /\/api\/brain\/hygiene/.test(src),
    'src/api/brain/index.js must keep the goals + hygiene read routes (story 1/2/4 regression).');
});

test('R2: the byte-pinned untouchables and PUBLIC_MUTATIONS stay free of this story', () => {
  for (const f of [RELATIONSHIPS, PROBE]) {
    const src = safeRead(f);
    assert(src, `${path.relative(ROOT, f)} missing — relationship-primitives regression.`);
    assert(!/create-work-record|note-goal-idea|workRecord|handleGetOrient/.test(src),
      `${path.relative(ROOT, f)} must not be touched by this story (byte-pinned untouchable; ADR 0005).`);
  }
  const auth = safeRead(AUTH);
  assert(auth, 'src/middleware/auth.js missing — regression.');
  assert(!/create-work-record|note-goal-idea/.test(auth),
    'PUBLIC_MUTATIONS / the middleware must NOT special-case the record routes — they stay owner/loopback-gated (ADR 0005 d6/d7).');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- sessions-read-the-brain tests (epic second-brain, Story 5) ---');
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
  console.log(`\nsessions-read-the-brain: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
