/**
 * Story 4 (epic: second-brain) — Attach the world: pointers and the goal's page.
 *
 * Story: engineering-team/stories/second-brain/4-attach-the-world.md
 * ADR:   engineering-team/decisions/second-brain/0004-external-resource-pointers-and-one-spine-detail.md
 *
 * Test classes (ADR "Test-class guidance", per test-hermeticity-ci/0001):
 *
 *   U-class (EXECUTED, stack-free, always gates CI) — the new pure resources
 *     core (src/lib/brain/resources.js): parseResourceRow's whitelisting
 *     shape, deriveFreshness's current/stale/unreachable derivation (parallel
 *     to deriveStanding — read-time, never stored), freshnessDays, and the
 *     group/count-by-goal helper, all over SYNTHETIC records with a fixed
 *     `nowMs` so the day math is deterministic.
 *       Contracts pinned here (Tester's lane per the ADR's latitude):
 *         parseResourceRow(row) → { uuid, title, slug, description,
 *           locatorKind, locator, goal, whyKept, keywords, notedOn,
 *           lastVerified, lastVerifyStatus, createdAt } or null.
 *         deriveFreshness(record, nowMs) → 'current' | 'stale' | 'unreachable'
 *           (lastVerifyStatus 'unreachable' wins; else age > STALE_AFTER_DAYS
 *           is 'stale'; else 'current'; missing lastVerified → 'stale').
 *         freshnessDays(record, nowMs) → integer days since lastVerified.
 *
 *   S-class (source assertions, stack-free) — the two validated normalize
 *     write primitives (routes, gates, discriminated results/refusals, the
 *     verify handler's NO-egress guard), the self-bootstrap helper, the shared
 *     write mutex re-use, the per-goal detail read endpoint + pointerCount, the
 *     pointer-card + record-entries UI (verbatim freshness strings, empty
 *     state, kind markers, open-native/no-embed, no record edit affordance),
 *     the new detail hook, the tree pointer count, and sentinels pinning what
 *     must NOT change (brain import surface re-pinned to SIX, brain read-only,
 *     no 64-hex, ADR-0003 Amended-by pointer).
 *
 *   H-class (live local stack, per-test SKIP when unreachable) — the concept
 *     self-bootstraps on the first attach; attach + verify round-trips read
 *     back through the per-goal endpoint with derived freshness; the refusal
 *     matrix with read-back proving nothing written; pointerCount on the list
 *     read; hygiene stays green after the concept lands; host-side caller-class
 *     401s.
 *
 *   R-class (regression sentinels, stack-free, pass before AND after).
 *
 * Pass-by-design sentinels (documented, story-2/3 review precedent): S12, S13,
 * S14, H7, H8, R1, R2 pass before AND after implementation — they pin
 * invariants the story must not break. Everything else FAILS until the feature
 * lands (the resources core is missing, routes 404, the concept is absent, the
 * detail page has no pointers/record sections). H tests SKIP when the stack is
 * absent (CI's stack-free job).
 *
 * Fixture hygiene: the H rows create ONE sentinel-named goal (via the story-1
 * create-element contract, fully-controlled json) and attach resources to it
 * via create-resource. run()'s finally tears them down: strfry delete by d-tag
 * first (the goal's known d-tag + each created resource's d-tag, derived from
 * the uuid the response returns), then Neo4j element+tags, then a value-scoped
 * orphan-tag sweep (json CONTAINS the 'harness-resource-' sentinel — never by z
 * value, shared with the real concept headers), then strfry count-0 verify.
 * Pre-clean runs the same routine best-effort. A teardown failure is a loud
 * suite failure. The External Resource CONCEPT, once bootstrapped, persists (it
 * is the real feature concept; only fixture ELEMENTS are torn down) — the
 * suite is idempotent across runs (ensureResourceConcept no-ops when present).
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RESOURCES_CORE = path.join(ROOT, 'src/lib/brain/resources.js');
const BRAIN_API = path.join(ROOT, 'src/api/brain/index.js');
const NORMALIZE_INDEX = path.join(ROOT, 'src/api/normalize/index.js');
const RELATIONSHIPS = path.join(ROOT, 'src/api/normalize/relationships.js');
const PROBE = path.join(ROOT, 'src/api/normalize/probe.js');
const AUTH = path.join(ROOT, 'src/middleware/auth.js');
const GOALS_PAGE = path.join(ROOT, 'ui/src/pages/brain/Goals.jsx');
const DETAIL_PAGE = path.join(ROOT, 'ui/src/pages/brain/GoalDetail.jsx');
const DETAIL_HOOK = path.join(ROOT, 'ui/src/hooks/useBrainGoalDetail.js');
const ADR_0003 = path.join(ROOT, 'engineering-team/decisions/second-brain/0003-record-based-decomposition-and-validated-goal-writes.md');

const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

// Verbatim owner-facing copy — the style guide's freshness wording and the
// design guide's pointer empty state (binding at review; byte-exact).
const FRESH_VERIFIED = 'verified';            // "verified N days ago"
const FRESH_DAYS_AGO = 'days ago';
const FRESH_NOT_VERIFIED = 'not verified in';  // "not verified in N days"
const FRESH_UNREACHABLE = 'unreachable at last check';
const POINTER_EMPTY = 'Nothing attached yet — resources this goal needs will appear here.';
const KIND_MARKERS = ['file', 'vault', 'event', 'repo', 'web'];

// The External Resource concept (ADR 0004 d1) — runtime-created, TA-scoped.
const RESOURCE_CONCEPT_SLUG = 'tapestry-external-resource';
const RESOURCE_CONCEPT_NAME = 'tapestry external resource';
const LOCATOR_KINDS = ['file', 'vault-note', 'nostr-event', 'repository', 'web-address'];

// H fixtures — a sentinel-named host goal + resources attached to it. The goal
// d-tag scheme is slug(name)-hash8(goalHeaderUuid); hash8 of the goal header is
// 1903378a (story-1 verified — same header the resources' goal slug points at).
const FIX_SENTINEL = 'harness-resource-';
const FIX_GOAL_NAME = 'harness resource host goal';
const FIX_GOAL_SLUG = 'harness-resource-host-goal';
const FIX_GOAL_DTAG = 'harness-resource-host-goal-1903378a';
const FIX_GOAL_JSON = { tapestryOwnerGoal: {
  name: FIX_GOAL_NAME,
  slug: FIX_GOAL_SLUG,
  description: 'a host goal that acquires resource pointers',
  origin: 'harness test, in conversation',
  capturedOn: '2026-07-23',
} };
// The primary fixture resource (a web address — the simplest open-native case).
const FIX_RES_TITLE = 'harness resource fixture web';
const FIX_RES_KIND = 'web-address';
const FIX_RES_LOCATOR = 'https://example.org/harness-resource-fixture-web';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function short(x, n = 260) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}

function loadResourcesCore() {
  if (!fs.existsSync(RESOURCES_CORE)) {
    throw new Error('src/lib/brain/resources.js does not exist yet — the freshness core (ADR 0004 d4) is not implemented.');
  }
  try { return require(RESOURCES_CORE); }
  catch (e) { throw new Error(`src/lib/brain/resources.js failed to require: ${e.message}`); }
}
const CORE_MISSING_FN = (fn) =>
  `src/lib/brain/resources.js does not export ${fn}() yet — the resources core (ADR 0004 d4) is not implemented.`;

/* ── synthetic fixtures (U-class) ─────────────────────────────────────── */

const TA = 'synthetic-ta'; // handles are opaque strings to the core — no hex needed
function core39999(slug) { return `39999:${TA}:${slug}`; }

// A parsed resource record in the ADR 0004 d1 shape (parseResourceRow output).
function rrec(over = {}) {
  return {
    uuid: core39999('harness-resource-host-goal-fixture'),
    title: 'a resource',
    slug: 'a-resource',
    description: 'a resource',
    locatorKind: 'web-address',
    locator: 'https://example.org/thing',
    goal: 'some-goal',
    whyKept: null,
    keywords: null,
    notedOn: '2026-07-01',
    lastVerified: '2026-07-01',
    lastVerifyStatus: 'reachable',
    createdAt: 1784000000,
    ...over,
  };
}
// A fixed "now" for deterministic freshness math (2026-07-31).
const NOW_MS = Date.parse('2026-07-31T00:00:00Z');

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
  const r = loopbackGetJson(`/api/brain/goals/${encodeURIComponent(slug)}`);
  return r; // shape is asserted by the caller (H5)
}
// The fixture goal's pointer set, as the detail endpoint returns it — the
// refusal matrix compares this before/after to prove nothing was written.
function pointerSnapshot() {
  const r = getGoalDetail(FIX_GOAL_SLUG);
  const pointers = Array.isArray(r?.pointers) ? r.pointers : [];
  return pointers
    .map((p) => [p.title, p.locatorKind, p.locator, p.freshness].join('|'))
    .sort()
    .join('\n');
}

/* ── H fixture bookkeeping ─────────────────────────────────────────────── */

let fixturesArmed = false;
let teardownFailure = null;
const createdResourceUuids = []; // filled from create-resource responses

function dTagFromUuid(uuid) {
  // uuid is 39999:<pubkey>:<dTag>; the dTag is everything after the 2nd colon.
  const parts = String(uuid).split(':');
  return parts.slice(2).join(':');
}
function goalFixtureUuid() {
  return `39999:${getTaPubkey()}:${FIX_GOAL_DTAG}`;
}
function allFixtureDtags() {
  return [FIX_GOAL_DTAG, ...createdResourceUuids.map(dTagFromUuid)];
}
function allFixtureUuids() {
  return [goalFixtureUuid(), ...createdResourceUuids];
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
  // Orphan-tag sweep, value-scoped to the sentinel family. Never by z value
  // (the z value is a concept header uuid, shared with the real concepts).
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

// Create the host goal fixture (story-1 create-element lane) — resources
// attach to a real goal. Idempotent-ish: pre-clean first.
function armGoalFixture() {
  fixturesArmed = true;
  preCleanFixtures();
  const created = loopbackPostJson('/api/normalize/create-element', {
    concept: 'tapestry owner goal', name: FIX_GOAL_NAME, json: FIX_GOAL_JSON,
  });
  assert(created && created.success === true,
    `create-element rejected the host-goal fixture (got ${short(created, 400)}).`);
}
// Attach the primary fixture resource; track its uuid for teardown.
function attachFixtureResource() {
  const r = loopbackPostJson('/api/normalize/create-resource', {
    goal: FIX_GOAL_SLUG, title: FIX_RES_TITLE, locatorKind: FIX_RES_KIND, locator: FIX_RES_LOCATOR,
    whyKept: 'the fixture that proves attach round-trips',
  });
  if (r && r.success === true && r.resource && r.resource.uuid) {
    createdResourceUuids.push(r.resource.uuid);
  }
  return r;
}

/* ══════════════ U-class — the pure resources core (EXECUTED) ══════════════ */

test('U1 (contract): resources core exports parseResourceRow, deriveFreshness, freshnessDays, a group-by-goal helper, and STALE_AFTER_DAYS', () => {
  const core = loadResourcesCore();
  for (const fn of ['parseResourceRow', 'deriveFreshness', 'freshnessDays']) {
    assert(typeof core[fn] === 'function', CORE_MISSING_FN(fn));
  }
  const grouper = core.groupResourcesByGoal || core.countResourcesByGoal || core.resourcesByGoal;
  assert(typeof grouper === 'function',
    'resources core must export a group/count-by-goal helper (groupResourcesByGoal / countResourcesByGoal) — ADR 0004 d4/d5.');
  assert(typeof core.STALE_AFTER_DAYS === 'number' && core.STALE_AFTER_DAYS === 30,
    `STALE_AFTER_DAYS must be the single tunable staleness threshold, defaulting to 30 (ADR 0004 d13); got ${short(core.STALE_AFTER_DAYS)}.`);
});

test('U2 (AC 1/AC 2): parseResourceRow extracts title, locatorKind, locator, goal, optionals; non-resource/malformed rows → null', () => {
  const core = loadResourcesCore();
  const full = core.parseResourceRow({
    uuid: core39999('harness-resource-x'), name: 'The Survey', createdAt: 1784000001,
    json: JSON.stringify({ externalResource: {
      name: 'The Survey', slug: 'the-survey', description: 'why kept text',
      locatorKind: 'web-address', locator: 'https://example.org/survey',
      goal: 'the-big-goal', whyKept: 'framed the options', keywords: ['search', 'fuzzy'],
      notedOn: '2026-07-20', lastVerified: '2026-07-27', lastVerifyStatus: 'reachable',
    } }),
  });
  assert(full, 'parseResourceRow must return a record for a well-formed resource row.');
  assert(full.title === 'The Survey',
    `the record must carry the title (element name / section title); got ${short(full.title)}.`);
  assert(full.locatorKind === 'web-address' && full.locator === 'https://example.org/survey',
    `locatorKind + locator must be extracted (got ${short([full.locatorKind, full.locator])}).`);
  assert(full.goal === 'the-big-goal',
    `the pointing goal slug must be extracted — it is the record-based linkage (ADR 0004 d2); got ${short(full.goal)}.`);
  assert(full.lastVerified === '2026-07-27' && full.lastVerifyStatus === 'reachable',
    `lastVerified + lastVerifyStatus must be extracted (freshness inputs); got ${short([full.lastVerified, full.lastVerifyStatus])}.`);
  // A goal row (wrong section) is not a resource.
  const notResource = core.parseResourceRow({
    uuid: core39999('g'), name: 'g', createdAt: 1, json: JSON.stringify({ tapestryOwnerGoal: { name: 'g', slug: 'g', description: 'x' } }),
  });
  assert(notResource === null, 'a row without an externalResource section must parse to null (never a phantom resource).');
  const malformed = core.parseResourceRow({ uuid: core39999('m'), name: 'm', createdAt: 1, json: '{not json' });
  assert(malformed === null, 'malformed json must parse to null, never throw (event-tagging 0009 discipline).');
});

test('U3 (AC 4): deriveFreshness — unreachable status wins; age boundary at STALE_AFTER_DAYS; missing lastVerified is not current', () => {
  const core = loadResourcesCore();
  const N = core.STALE_AFTER_DAYS;
  const days = (n) => new Date(NOW_MS - n * 86400000).toISOString().slice(0, 10);
  assert(core.deriveFreshness(rrec({ lastVerified: days(3), lastVerifyStatus: 'reachable' }), NOW_MS) === 'current',
    'a resource verified 3 days ago is current (AC 4).');
  assert(core.deriveFreshness(rrec({ lastVerified: days(N), lastVerifyStatus: 'reachable' }), NOW_MS) === 'current',
    `verified exactly STALE_AFTER_DAYS (${N}) days ago is still current — the boundary is > threshold (ADR 0004 d4).`);
  assert(core.deriveFreshness(rrec({ lastVerified: days(N + 1), lastVerifyStatus: 'reachable' }), NOW_MS) === 'stale',
    `verified STALE_AFTER_DAYS + 1 days ago is stale (ADR 0004 d4).`);
  assert(core.deriveFreshness(rrec({ lastVerified: days(2), lastVerifyStatus: 'unreachable' }), NOW_MS) === 'unreachable',
    'an unreachable last-verify outcome wins over age — even a recent check (AC 4; the asserted-re-check outcome).');
  assert(core.deriveFreshness(rrec({ lastVerified: null, lastVerifyStatus: 'reachable' }), NOW_MS) === 'stale',
    'a resource with no last-verified date is not current — freshness cannot be confirmed (tolerant default: stale).');
});

test('U4 (AC 2): freshnessDays counts whole days since lastVerified, deterministically', () => {
  const core = loadResourcesCore();
  const days = (n) => new Date(NOW_MS - n * 86400000).toISOString().slice(0, 10);
  assert(core.freshnessDays(rrec({ lastVerified: days(3) }), NOW_MS) === 3,
    `freshnessDays must be the integer day-count the "verified N days ago" line renders; got ${short(core.freshnessDays(rrec({ lastVerified: days(3) }), NOW_MS))}.`);
  assert(core.freshnessDays(rrec({ lastVerified: days(40) }), NOW_MS) === 40,
    'freshnessDays must match the "not verified in N days" line (the API and UI share one N — ADR 0004 d5).');
});

test('U5 (AC 5/AC 2): the group-by-goal helper buckets resources by their goal slug; unrelated resources are excluded', () => {
  const core = loadResourcesCore();
  const grouper = core.groupResourcesByGoal || core.countResourcesByGoal || core.resourcesByGoal;
  const a1 = rrec({ uuid: core39999('a1'), goal: 'goal-a', locator: 'https://example.org/a1' });
  const a2 = rrec({ uuid: core39999('a2'), goal: 'goal-a', locator: 'https://example.org/a2' });
  const b1 = rrec({ uuid: core39999('b1'), goal: 'goal-b', locator: 'https://example.org/b1' });
  const out = grouper([a1, a2, b1]);
  // The helper may return a Map, a plain object, or a {slug: count} — accept
  // any shape that answers "how many / which resources for goal-a".
  const forA = out instanceof Map ? out.get('goal-a') : out['goal-a'];
  const countA = Array.isArray(forA) ? forA.length : forA;
  assert(countA === 2, `goal-a must bucket its two resources (got ${short(forA)}).`);
  const forB = out instanceof Map ? out.get('goal-b') : out['goal-b'];
  const countB = Array.isArray(forB) ? forB.length : forB;
  assert(countB === 1, `goal-b must bucket its one resource (got ${short(forB)}).`);
  const forC = out instanceof Map ? out.get('goal-c') : out['goal-c'];
  assert(forC == null || (Array.isArray(forC) ? forC.length === 0 : forC === 0),
    'a goal with no resources buckets to nothing — the tree renders no pointer count for it (ADR 0004 d5).');
});

/* ══════════════ S-class — source assertions (stack-free) ══════════════ */

test('S1 (ADR d6): create-resource — route, gate, and the named discriminated results/refusals', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/\/api\/normalize\/create-resource/.test(src),
    'POST /api/normalize/create-resource is not registered (ADR 0004 d6) — not implemented yet.');
  const start = src.indexOf('handleCreateResource');
  assert(start !== -1, 'handleCreateResource not found in src/api/normalize/index.js.');
  const slice = src.slice(start, start + 9000);
  assert(/isOwner\s*\(\s*req\s*\)/.test(slice) && /localTrusted/.test(slice) && /403/.test(slice),
    'create-resource must carry the explicit in-handler gate (isOwner(req) || req.localTrusted → 403) — ADR 0004 d6.');
  for (const tok of ['attached', 'goal-not-found', 'unknown-kind', 'resource-exists']) {
    assert(slice.includes(tok),
      `create-resource must answer the named discriminated result/refusal '${tok}' (ADR 0004 d6) — loud, named, nothing written.`);
  }
});

test('S2 (ADR d7): verify-resource — route, gate, named results/refusals, and NO outbound egress', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/\/api\/normalize\/verify-resource/.test(src),
    'POST /api/normalize/verify-resource is not registered (ADR 0004 d7) — not implemented yet.');
  const start = src.indexOf('handleVerifyResource');
  assert(start !== -1, 'handleVerifyResource not found in src/api/normalize/index.js.');
  const slice = src.slice(start, start + 9000);
  assert(/isOwner\s*\(\s*req\s*\)/.test(slice) && /localTrusted/.test(slice) && /403/.test(slice),
    'verify-resource must carry the explicit in-handler gate.');
  for (const tok of ['verified', 'resource-not-found']) {
    assert(slice.includes(tok),
      `verify-resource must answer the named discriminated result/refusal '${tok}' (ADR 0004 d7).`);
  }
  assert(!/\bfetch\s*\(|https?\.get\s*\(|https?\.request\s*\(|require\(['"`](?:node-fetch|axios|got|undici)['"`]\)/.test(slice),
    'verify is an ASSERTED re-check — the handler must NOT fetch/ping the resource locator (no outbound egress; ' +
    'ADR 0004 d7 / PRD §7.4). Found an egress call in the verify handler.');
});

test('S3 (ADR d8): the External Resource concept self-bootstraps — ensureResourceConcept via create-concept + save-schema, guarded', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/ensureResourceConcept/.test(src),
    'ensureResourceConcept (the self-bootstrap helper, ADR 0004 d8) does not exist yet.');
  const start = src.indexOf('ensureResourceConcept');
  const slice = src.slice(start, start + 4000);
  assert(/create-concept|createConcept|handleCreateConcept/.test(slice) && /save-schema|saveSchema|handleSaveSchema/.test(slice),
    'ensureResourceConcept must provision via create-concept + save-schema when the concept is absent (ADR 0004 d8).');
  assert(src.includes(RESOURCE_CONCEPT_SLUG) || src.includes(RESOURCE_CONCEPT_NAME),
    `the write path must reference the External Resource concept (${RESOURCE_CONCEPT_SLUG}) — ADR 0004 d1/d8.`);
});

test('S4 (ADR d9): both resource writes run through the existing serializeGoalWrite mutex (not renamed)', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/serializeGoalWrite/.test(src),
    'serializeGoalWrite must survive (story-3 S5 pins it) — ADR 0004 d9 reuses it, never renames it.');
  for (const handler of ['handleCreateResource', 'handleVerifyResource']) {
    const start = src.indexOf(handler);
    if (start === -1) continue; // S1/S2 already fail loudly on a missing handler
    const slice = src.slice(start, start + 9000);
    assert(/serializeGoalWrite|mutex|serializ|writeChain|writeQueue/i.test(slice),
      `${handler} must run its read-validate-write body through the shared write mutex (ADR 0004 d9) — ` +
      'a duplicate-(goal,locator) attack or attach/verify race is otherwise unserialized.');
  }
});

test('S5 (ADR d5): the brain read grows a per-goal detail endpoint and a pointer count — read-only', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(/goals\/:slug/.test(src) && /handleGetGoalDetail/.test(src),
    'the brain module must register GET /api/brain/goals/:slug → handleGetGoalDetail (ADR 0004 d5; 0003 d11 scheduled it).');
  assert(/pointerCount/.test(src),
    'the list read (GET /api/brain/goals) must project pointerCount per goal for the tree row (ADR 0004 d5/d10).');
  assert(/require\s*\(\s*['"`][^'"`]*lib\/brain\/resources['"`]\s*\)/.test(src),
    'the brain module must require ../../lib/brain/resources — the freshness core (ADR 0004 d4) is not wired yet.');
});

test('S6 (ADR d10): the Goal detail renders pointer cards — freshness wording verbatim, empty state, kind markers, open-native, no embed', () => {
  const src = safeRead(DETAIL_PAGE);
  assert(src, 'ui/src/pages/brain/GoalDetail.jsx missing — story 3 regression.');
  assert(src.includes(FRESH_VERIFIED) && src.includes(FRESH_DAYS_AGO) && src.includes(FRESH_NOT_VERIFIED) && src.includes(FRESH_UNREACHABLE),
    `the freshness line must use the style guide's wording verbatim: "verified N days ago" / "not verified in N days" / "${FRESH_UNREACHABLE}" (AC 2).`);
  assert(src.includes(POINTER_EMPTY),
    `the pointer empty state must be byte-exact: "${POINTER_EMPTY}" (AC 5; design guide).`);
  for (const m of KIND_MARKERS) {
    assert(new RegExp(`['"\`>]${m}['"\`<]`).test(src),
      `the kind marker '${m}' must render (design guide pointer-card markers file/vault/event/repo/web; AC 2).`);
  }
  assert(/target=\{?['"`]_blank['"`]/.test(src) && /rel=\{?['"`][^'"`]*noopener/.test(src),
    'the pointer title must open the resource in its native home (target="_blank" rel="noopener…") — open native (AC 3).');
  assert(!/<iframe|dangerouslySetInnerHTML|<embed|<object\b/.test(src),
    'nothing may be embedded — no iframe/embed/object/innerHTML of a resource (AC 3: content never enters the brain).');
});

test('S7 (ADR d10 / AC 6): the Goal detail carries no write/edit affordance — the record section is append-only', () => {
  const src = safeRead(DETAIL_PAGE);
  assert(src, 'ui/src/pages/brain/GoalDetail.jsx missing — story 3 regression.');
  assert(!/<input\b|<textarea\b|contentEditable|onSubmit=|<form\b/i.test(src),
    'the detail page is display-only — no input/textarea/form/contentEditable anywhere (AC 6: record entries are append-only, ' +
    'no edit affordance ever; PRD §7.2).');
  assert(!/deleteRecord|editRecord|removeEntry|onEdit|onDelete/i.test(src),
    'no per-entry edit/delete handler may exist — the ledger is the ledger (AC 6).');
});

test('S8 (AC 2/AC 7): the Goal detail\'s new owner-facing strings are jargon-clean — the kind markers are the sanctioned exception', () => {
  const src = safeRead(DETAIL_PAGE);
  assert(src, 'ui/src/pages/brain/GoalDetail.jsx missing — story 3 regression.');
  const visible = [
    ...[...src.matchAll(/'([^'\\\n]*)'/g)].map((m) => m[1]),
    ...[...src.matchAll(/"([^"\\\n]*)"/g)].map((m) => m[1]),
    ...[...src.matchAll(/`([^`]*)`/g)].map((m) => m[1]),
    ...[...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]),
  ].join('\n');
  // 'event'/'kind' are EXCLUDED: 'event' is a design-guide-sanctioned kind
  // marker (ADR 0004 d11); the banned-jargon rule governs prose, not the
  // typographic markers the design guide mandates.
  for (const w of ['superset', 'pubkey', 'payload', 'concept header', 'acceptance criteria', 'lease', 'schema', 'endpoint']) {
    assert(!new RegExp(`\\b${w}\\b`, 'i').test(visible),
      `banned jargon "${w}" found in owner-visible text of GoalDetail.jsx (style guide; AC 7).`);
  }
});

test('S9 (ADR d5/d10): the per-goal detail hook fetches /api/brain/goals/:slug', () => {
  const src = safeRead(DETAIL_HOOK);
  assert(src,
    'ui/src/hooks/useBrainGoalDetail.js does not exist yet — the one-spine page reads the per-goal endpoint (ADR 0004 d5/d10).');
  assert(/\/api\/brain\/goals\//.test(src) && /fetch\s*\(/.test(src),
    'useBrainGoalDetail must fetch /api/brain/goals/${slug} (the per-goal endpoint) — ADR 0004 d5.');
  const page = safeRead(DETAIL_PAGE);
  assert(/useBrainGoalDetail/.test(page),
    'GoalDetail.jsx must consume useBrainGoalDetail for its one-spine data (intent + pointers + records) — ADR 0004 d10.');
});

test('S10 (ADR d10): the Goals tree renders the pointer count per row', () => {
  const src = safeRead(GOALS_PAGE);
  assert(src, 'ui/src/pages/brain/Goals.jsx missing — story 1 regression.');
  assert(/pointerCount/.test(src),
    'the tree row must read g.pointerCount (ADR 0004 d5/d10) — the design guide goal-row spec includes the pointer count.');
  assert(/pointer/i.test(src) && /pointers/.test(src),
    'the row must render the count as text ("N pointer"/"N pointers") — design guide goal-row spec.');
});

test('S11 (ADR d5): the brain import surface is re-pinned to SIX — the story-3 five plus lib/brain/resources, nothing else', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  const requires = [...src.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1]);
  assert(requires.some((s) => /lib\/brain\/resources$/.test(s)),
    'the brain module must require ../../lib/brain/resources — the freshness core (ADR 0004 d4) is not wired yet.');
  // second-brain #5 (ADR 0005 d10) widens this by lib/brain/work-records, the
  // records projection core — this pin stays green (widen-only) and admits seven.
  const allowed = [/neo4j-driver$/, /middleware\/auth$/, /assistantKeys$/, /lib\/brain\/goals$/, /lib\/brain\/hygiene$/, /lib\/brain\/resources$/, /lib\/brain\/work-records$/, /lib\/brain\/proposals$/];
  for (const spec of requires) {
    assert(allowed.some((re) => re.test(spec)),
      `import surface violation: require('${spec}') — story 4 adds lib/brain/resources, story 5 adds lib/brain/work-records; ` +
      'the brain module allows only the seven cores (ADR 0004 d5 + ADR 0005 d10; story-1 S2 + story-2 S3 + story-3 S1 re-pins).');
  }
});

test('S12 (sentinel — ADR d5): the brain module stays structurally read-only — no mutation/strfry tokens', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(!/child_process|execFile|exec\s*\(|strfry|publishToStrfry|regenerateJson|nostrPublish/.test(src),
    'the brain module must stay mutation- and strfry-free — resource WRITES live in normalize (ADR 0004 d5 / story-2 S6).');
});

test('S13 (sentinel — house rule): no hardcoded 64-hex pubkey in the story\'s touched server files', () => {
  for (const f of [RESOURCES_CORE, BRAIN_API, NORMALIZE_INDEX]) {
    const src = safeRead(f);
    if (!src && f === RESOURCES_CORE) continue; // the core does not exist pre-impl; U1 fails loudly for that
    assert(src, `${path.relative(ROOT, f)} missing.`);
    assert(!/\b[0-9a-f]{64}\b/i.test(src),
      `${path.relative(ROOT, f)} contains a 64-hex literal — the TA pubkey is per-deployment and must be resolved ` +
      'at runtime (house rule; PRD §7.8).');
  }
});

test('S14 (sentinel — Amends discipline): ADR 0003 carries the reciprocal Amended-by pointer to ADR 0004', () => {
  const src = safeRead(ADR_0003);
  assert(src, 'ADR 0003 missing — repository regression.');
  assert(/\*\*Amended by:\*\*\s*ADR 0004/.test(src),
    'ADR 0003\'s header must point at ADR 0004 (the 0027/0028/0029 amendment convention) — 0003 d11\'s interim ' +
    'read-path is superseded by the per-goal endpoint.');
});

/* ══════════════ H-class — live local stack (SKIP when absent) ══════════════ */

test('H1 (ADR d8 / AC 1): the External Resource concept self-bootstraps on the first attach; the resource reads back', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  armGoalFixture();
  const r = attachFixtureResource();
  assert(r && r.success === true && r.result === 'attached',
    `create-resource must answer {success:true, result:'attached', …} (got ${short(r, 400)}).`);
  assert(r.resource && r.resource.uuid,
    `the response must carry the created resource's uuid for durability + teardown (got ${short(r.resource)}).`);
  // The concept must now exist live — self-bootstrapped, never firmware-seeded.
  const ta = getTaPubkey();
  const node = loopbackGetJson(`/api/concept-graph/node/${encodeURIComponent(`39998:${ta}:${RESOURCE_CONCEPT_SLUG}`)}`);
  assert(node && node.success !== false && node.node,
    `the External Resource concept (39998:<TA>:${RESOURCE_CONCEPT_SLUG}) must exist after the first attach — ` +
    `ensureResourceConcept did not provision it (ADR 0004 d8). Got ${short(node, 300)}.`);
});

test('H2 (AC 2/AC 5): the attached resource reads back on the per-goal detail with derived freshness current', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const detail = getGoalDetail(FIX_GOAL_SLUG);
  assert(detail && detail.success === true && Array.isArray(detail.pointers),
    `GET /api/brain/goals/${FIX_GOAL_SLUG} must answer {success:true, pointers:[…]} (got ${short(detail, 300)}).`);
  const p = detail.pointers.find((x) => x.locator === FIX_RES_LOCATOR);
  assert(p, `the attached fixture resource must read back on its goal's detail (AC 5 one spine; got ${short(detail.pointers, 300)}).`);
  assert(p.locatorKind === FIX_RES_KIND && p.title === FIX_RES_TITLE,
    `the pointer must carry its kind + title (got ${short([p.locatorKind, p.title])}).`);
  assert(p.freshness === 'current',
    `a just-attached resource derives freshness 'current' (attach sets last-verified = today; AC 4); got ${short(p.freshness)}.`);
});

test('H3 (AC 4): verify-resource flips freshness — unreachable when asserted, back to current on a fresh check', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const marked = loopbackPostJson('/api/normalize/verify-resource', {
    goal: FIX_GOAL_SLUG, locator: FIX_RES_LOCATOR, reachable: false,
  });
  assert(marked && marked.success === true && marked.result === 'verified',
    `verify-resource must answer {success:true, result:'verified', …} (got ${short(marked, 400)}).`);
  let p = getGoalDetail(FIX_GOAL_SLUG).pointers.find((x) => x.locator === FIX_RES_LOCATOR);
  assert(p && p.freshness === 'unreachable',
    `after an asserted unreachable check the pointer derives 'unreachable' (AC 4); got ${short(p && p.freshness)}.`);
  const rechecked = loopbackPostJson('/api/normalize/verify-resource', {
    goal: FIX_GOAL_SLUG, locator: FIX_RES_LOCATOR, reachable: true,
  });
  assert(rechecked && rechecked.success === true,
    `re-verifying reachable must succeed (got ${short(rechecked, 400)}).`);
  p = getGoalDetail(FIX_GOAL_SLUG).pointers.find((x) => x.locator === FIX_RES_LOCATOR);
  assert(p && p.freshness === 'current',
    `a fresh reachable check returns the pointer to 'current' with last-verified advanced (AC 4); got ${short(p && p.freshness)}.`);
});

test('H4 (AC 1): the refusal matrix — every invalid write refused loudly with NOTHING written', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const before = pointerSnapshot();
  const cases = [
    ['attach to a nonexistent goal', '/api/normalize/create-resource',
      { goal: 'no-such-goal-slug', title: 'x', locatorKind: 'web-address', locator: 'https://example.org/harness-resource-nope' }, /goal|found/i],
    ['attach with an unknown kind', '/api/normalize/create-resource',
      { goal: FIX_GOAL_SLUG, title: 'x', locatorKind: 'telepathy', locator: 'https://example.org/harness-resource-kind' }, /kind|unknown|invalid/i],
    ['attach a duplicate (goal, locator)', '/api/normalize/create-resource',
      { goal: FIX_GOAL_SLUG, title: 'dup', locatorKind: FIX_RES_KIND, locator: FIX_RES_LOCATOR }, /exist|dup|already/i],
    ['attach with an empty locator', '/api/normalize/create-resource',
      { goal: FIX_GOAL_SLUG, title: 'x', locatorKind: 'web-address', locator: '   ' }, /locator|empty|required|blank/i],
    ['verify a resource that is not attached', '/api/normalize/verify-resource',
      { goal: FIX_GOAL_SLUG, locator: 'https://example.org/harness-resource-never-attached' }, /not|found|resource/i],
  ];
  for (const [label, route, body, errRe] of cases) {
    const r = loopbackPostJson(route, body);
    assert(r && r.success === false,
      `${label}: must be REFUSED (success:false), got ${short(r, 300)}.`);
    assert((typeof r.error === 'string' && errRe.test(r.error)) || (typeof r.refusal === 'string' && errRe.test(r.refusal)),
      `${label}: the refusal must be loud and named (error/refusal matching ${errRe}); got ${short(r, 200)}.`);
  }
  const after = pointerSnapshot();
  assert(before === after,
    `AC 1 violated: a refused write changed the goal's pointer set.\n  before:\n${before}\n  after:\n${after}`);
});

test('H5 (AC 5 / ADR d5): the per-goal detail is one spine — intent + pointers + records; unknown slug is a clean empty', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const detail = getGoalDetail(FIX_GOAL_SLUG);
  assert(detail && detail.success === true, `the detail endpoint must answer success:true (got ${short(detail, 200)}).`);
  assert(detail.goal && detail.goal.slug === FIX_GOAL_SLUG,
    `the spine must carry the goal's intent (name, standing, done-means/stays-inside) (AC 5; got ${short(detail.goal, 200)}).`);
  assert(Array.isArray(detail.pointers) && Array.isArray(detail.records),
    'the one spine returns both pointers and records arrays (AC 5; records is present-but-empty in story 4 — producers are stories 5–7).');
  const unknown = getGoalDetail('no-such-goal-anywhere');
  assert(unknown && unknown.success === true && unknown.goal === null,
    `an unknown slug is an empty state, not an error: {success:true, goal:null} (ADR 0004 d5); got ${short(unknown, 200)}.`);
});

test('H6 (AC 2 / ADR d5): the Goals list read reports pointerCount per goal', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const goals = getGoals();
  const host = goals.find((g) => g.slug === FIX_GOAL_SLUG);
  assert(host, 'the fixture host goal must be in the Goals read.');
  assert(typeof host.pointerCount === 'number',
    `every goal must carry a numeric pointerCount for the tree row (ADR 0004 d5/d10); got ${short(host.pointerCount)}.`);
  assert(host.pointerCount >= 1,
    `the host goal has one attached resource — pointerCount must reflect it (got ${short(host.pointerCount)}).`);
});

test('H7 (sentinel — AC 7): the hygiene check is green — creating the External Resource concept does not disturb it', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackGetJson('/api/brain/hygiene');
  assert(r && r.success === true && r.sound === true && Array.isArray(r.problems) && r.problems.length === 0,
    `the hygiene check must stay green (AC 7; PRD §10) — the runtime-created External Resource concept is not in its ` +
    `scope and must not turn it red. Got: ${short(r, 500)}.`);
});

test('H8 (gates): host-side POSTs to both new routes are refused by the default-deny middleware with 401', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  for (const route of ['/api/normalize/create-resource', '/api/normalize/verify-resource']) {
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

test('R1: the brain read surfaces this story extends are still registered', () => {
  const src = safeRead(BRAIN_API);
  assert(/\/api\/brain\/goals/.test(src) && /\/api\/brain\/hygiene/.test(src),
    'src/api/brain/index.js must keep both read routes — story 4 extends the goals payload and adds goals/:slug (ADR 0004 d5).');
});

test('R2: the byte-pinned untouchables and PUBLIC_MUTATIONS stay free of this story', () => {
  for (const f of [RELATIONSHIPS, PROBE]) {
    const src = safeRead(f);
    assert(src, `${path.relative(ROOT, f)} missing — relationship-primitives regression.`);
    assert(!/create-resource|verify-resource|externalResource|deriveFreshness/.test(src),
      `${path.relative(ROOT, f)} must not be touched by this story (byte-pinned untouchable; ADR 0004).`);
  }
  const auth = safeRead(AUTH);
  assert(auth, 'src/middleware/auth.js missing — regression.');
  assert(!/create-resource|verify-resource/.test(auth),
    'PUBLIC_MUTATIONS / the middleware must NOT special-case the resource routes — they stay owner/loopback-gated (ADR 0004 d6).');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- attach-the-world tests (epic second-brain, Story 4) ---');
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
  console.log(`\nattach-the-world: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
