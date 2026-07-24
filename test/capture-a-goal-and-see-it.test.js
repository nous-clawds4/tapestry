/**
 * Story 1 (epic: second-brain) — Capture a goal and see it.
 *
 * Story: engineering-team/stories/second-brain/1-capture-a-goal-and-see-it.md
 * ADR:   engineering-team/decisions/second-brain/0001-goal-capture-and-goals-view.md
 *
 * Test classes (ADR "Test-class guidance", per test-hermeticity-ci/0001):
 *
 *   U-class (EXECUTED, stack-free, always gates CI) — the pure core
 *     src/lib/brain/goals.js. CommonJS + zero require() calls (Tester note:
 *     the ADR sketch said "ESM" by analogy with the ui-side placement.js
 *     precedent, but this core is consumed by the CJS server module — the
 *     binding property is purity, pinned by S1). Covers row parsing +
 *     classification (AC 3), the derived standing word (AC 2/6), capture-date
 *     resolution with created_at fallback (AC 1), and sort order.
 *
 *   S-class (source assertions, stack-free) — the brain API module's gate,
 *     import surface, and registration (ADR decisions 3); the Goals view's
 *     verbatim style-guide copy, owner gate, jargon guard, and route/nav
 *     wiring (AC 4/5/6; ADR decisions 5); no publish machinery anywhere in
 *     the new UI files (ADR decision 7); no hardcoded TA pubkey (house rule).
 *     Source-level because the harness has no jsdom/testing-library.
 *
 *   H-class (live local stack, per-test SKIP when unreachable) — the read
 *     endpoint returns the three adopted legacy goals and never the strays
 *     (AC 3); the schema extension landed (ADR decision 2); the capture
 *     round-trip via the existing create-element contract READS BACK through
 *     the new endpoint (AC 1 — read-back, not response-success, because of
 *     the known publishToStrfry silent-drop bug); the host-side unauthenticated
 *     caller gets the in-handler 403 (ADR decision 3 — host :7778 is the
 *     remote class per security-auth-exposure/0001).
 *
 *   R-class (regression sentinels, stack-free, pass before AND after) — the
 *     Layout ownerOnly nav filter and the create-element route this story
 *     depends on still exist.
 *
 * ALL U and S tests FAIL until the feature lands (the core, API module, hook,
 * and page do not exist yet); H1–H6 FAIL against a running stack (route 404s,
 * schema not yet extended). H tests SKIP when the stack is absent (CI's
 * stack-free job). That is the point.
 *
 * Fixture hygiene: H4 creates ONE goal element with a fixed sentinel name via
 * the capture contract, and tears it down (Neo4j DETACH DELETE + strfry
 * delete, both verified) in run()'s finally. The graph is left as found; a
 * teardown failure is reported loudly as a suite failure, never silently.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CORE = path.join(ROOT, 'src/lib/brain/goals.js');
const BRAIN_API = path.join(ROOT, 'src/api/brain/index.js');
const API_INDEX = path.join(ROOT, 'src/api/index.js');
const NORMALIZE_INDEX = path.join(ROOT, 'src/api/normalize/index.js');
const GOALS_PAGE = path.join(ROOT, 'ui/src/pages/brain/Goals.jsx');
const HOOK = path.join(ROOT, 'ui/src/hooks/useBrainGoals.js');
const APP = path.join(ROOT, 'ui/src/App.jsx');
const LAYOUT = path.join(ROOT, 'ui/src/components/Layout.jsx');

const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

// Verbatim owner-facing copy — the style guide is the copy authority
// (product-team/guides/second-brain-style-guide.md). Byte-exact.
const COLD_START =
  "Your brain is empty — that's the right place to start. Tell your assistant a goal in plain words and it will appear here.";
const PRIVACY_LINE =
  'This brain stays on this machine — nothing here is published.';

// The three adopted legacy goals (verified live 2026-07-22; ADR Context).
const LEGACY_GOAL_NAMES = [
  'NosFabrica success',
  'advance physical understanding of the world',
  'develop tapestry into an agentic second brain',
];

// H4 fixture — fixed sentinel name so repeated runs overwrite, never accumulate.
// FIXTURE_JSON is shared between the capture body and the teardown: the json
// tag's byte-exact string is an input to the deterministic tag-node uuids.
const FIXTURE_NAME = 'harness capture round-trip goal';
const FIXTURE_DTAG = 'harness-capture-round-trip-goal-1903378a';
const FIXTURE_JSON = { tapestryOwnerGoal: {
  name: FIXTURE_NAME,
  slug: 'harness-capture-round-trip-goal',
  description: 'prove the capture contract lands a readable goal',
  origin: 'harness test, in conversation',
  capturedOn: '2026-07-22',
} };

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function short(x, n = 220) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}

const CORE_MISSING =
  'src/lib/brain/goals.js does not exist yet — the pure goals core (ADR 0001 ' +
  'implementation notes) is not implemented.';
function loadCore() {
  if (!fs.existsSync(CORE)) throw new Error(CORE_MISSING);
  try { return require(CORE); }
  catch (e) { throw new Error(`src/lib/brain/goals.js exists but failed to require as CommonJS: ${e.message}`); }
}

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
  const out = dockerCurl(['-s', '-m', '12', '-X', 'POST', '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(body), `${CONTAINER_BASE}${pathname}`]);
  try { return JSON.parse(out); }
  catch { throw new Error(`loopback POST ${pathname} did not return JSON: ${short(out)}`); }
}

// Stack availability — BOTH paths must answer (relationship-primitives plumbing).
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

/* ── H4 fixture bookkeeping ────────────────────────────────────────────── */

let fixtureCreated = false;
let teardownFailure = null;

function fixtureUuid() {
  // d-tag scheme: slug(name)-hash8(headerUuid); hash8 of the goal header is
  // 1903378a (verified against all three live goal elements — ADR Context).
  return `39999:${getTaPubkey()}:harness-capture-round-trip-goal-1903378a`;
}

// The element's tag-node uuids are deterministic — sha256(`${uuid}:${tag.join(',')}:${i}`)
// over the exact tags create-element mints ([d, name, z, json] in order; the
// json string is JSON.stringify(FIXTURE_JSON) verbatim). Reproducing them
// lets teardown also remove ORPHANED tag nodes: a plain DETACH DELETE of the
// element leaves its NostrEventTag nodes behind, and the next create-element
// then collides on the tag-uuid uniqueness constraint (found live 2026-07-22).
function fixtureTagUuids() {
  const uuid = fixtureUuid();
  const headerUuid = `39998:${getTaPubkey()}:tapestry-owner-goal`;
  const tags = [
    ['d', FIXTURE_DTAG],
    ['name', FIXTURE_NAME],
    ['z', headerUuid],
    ['json', JSON.stringify(FIXTURE_JSON)],
  ];
  return tags.map((tag, i) =>
    crypto.createHash('sha256').update(`${uuid}:${tag.join(',')}:${i}`).digest('hex'));
}

function deleteFixtureFromNeo4j() {
  const q1 = {
    cypher: 'MATCH (e:NostrEvent {uuid: $uuid}) OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag) DETACH DELETE e, t',
    params: { uuid: fixtureUuid() },
  };
  const r1 = loopbackPostJson('/api/neo4j/query', q1);
  assert(r1 && r1.success !== false, `fixture Neo4j teardown query failed: ${short(r1)}`);
  const q2 = {
    cypher: 'MATCH (t:NostrEventTag) WHERE t.uuid IN $tagUuids DETACH DELETE t',
    params: { tagUuids: fixtureTagUuids() },
  };
  const r2 = loopbackPostJson('/api/neo4j/query', q2);
  assert(r2 && r2.success !== false, `fixture orphan-tag teardown query failed: ${short(r2)}`);
}

function deleteFixtureFromStrfry() {
  // Find the fixture event id by its deterministic d-tag, then strfry-delete it.
  const dTag = 'harness-capture-round-trip-goal-1903378a';
  const scan = loopbackGetJson(
    `/api/strfry/scan?filter=${encodeURIComponent(JSON.stringify({ kinds: [39999], '#d': [dTag] }))}`);
  const events = Array.isArray(scan?.events) ? scan.events : (Array.isArray(scan) ? scan : []);
  for (const ev of events) {
    if (ev && ev.id) {
      cp.execFileSync('docker', ['exec', CONTAINER, 'strfry', 'delete', `--filter={"ids":["${ev.id}"]}`],
        { encoding: 'utf8', timeout: 15000 });
    }
  }
  const verify = loopbackGetJson(
    `/api/strfry/scan/count?filter=${encodeURIComponent(JSON.stringify({ kinds: [39999], '#d': [dTag] }))}`);
  assert(verify && verify.count === 0,
    `strfry still holds ${verify && verify.count} fixture event(s) after teardown — residue would ` +
    'resurface in the Goals view via strfry→Neo4j sync. Delete it manually: ' +
    `docker exec ${CONTAINER} strfry delete --filter='{"kinds":[39999],"#d":["${dTag}"]}'`);
}

function teardownFixture() {
  if (!fixtureCreated) return;
  try {
    deleteFixtureFromNeo4j();
    deleteFixtureFromStrfry();
    fixtureCreated = false;
  } catch (e) {
    teardownFailure = e.message;
  }
}

/* ══════════════ U-class — the pure core (EXECUTED) ══════════════ */

test('U1 (contract): goals core exports parseGoalRow, deriveStanding, resolveCaptureDate, sortGoals', () => {
  const core = loadCore();
  for (const fn of ['parseGoalRow', 'deriveStanding', 'resolveCaptureDate', 'sortGoals']) {
    assert(typeof core[fn] === 'function',
      `src/lib/brain/goals.js must export ${fn}() — it is the shared surface story 2's checker reuses (ADR 0001).`);
  }
});

test('U2 (AC 1/AC 3): parseGoalRow maps a well-formed row to {uuid,name,statement,origin,capturedOn,createdAt}', () => {
  const core = loadCore();
  const row = {
    uuid: '39999:ta:some-goal-1903378a',
    name: 'ship the demo',
    createdAt: 1784391581,
    json: JSON.stringify({ tapestryOwnerGoal: {
      name: 'ship the demo', slug: 'ship-the-demo',
      description: 'a runnable demo exists and is linked from the readme',
      origin: 'owner, in conversation', capturedOn: '2026-07-22',
    } }),
  };
  const rec = core.parseGoalRow(row);
  assert(rec, 'parseGoalRow must return a record for a well-formed goal row.');
  assert(rec.uuid === row.uuid && rec.name === 'ship the demo',
    `record must carry uuid and name through (got ${short(rec)}).`);
  assert(rec.statement === 'a runnable demo exists and is linked from the readme',
    `statement must be the json description — the PRD's statement IS the description field (ADR decision 2); got ${short(rec.statement)}.`);
  assert(rec.origin === 'owner, in conversation',
    `record must carry origin (got ${short(rec.origin)}).`);
  assert(rec.capturedOn === '2026-07-22',
    `record must carry capturedOn (got ${short(rec.capturedOn)}).`);
  assert(rec.createdAt === 1784391581,
    `record must carry createdAt for the legacy fallback (got ${short(rec.createdAt)}).`);
});

test('U3 (AC 3): parseGoalRow classifies out rows that are not parseable goal records', () => {
  const core = loadCore();
  assert(core.parseGoalRow({ uuid: 'x', name: 'no json at all', createdAt: 1, json: null }) == null,
    'a row with no json tag is not a goal record — parseGoalRow must return null/undefined, not throw.');
  assert(core.parseGoalRow({ uuid: 'x', name: 'broken', createdAt: 1, json: '{not json' }) == null,
    'a row with malformed json must be classified out, not thrown on.');
  assert(core.parseGoalRow({ uuid: 'x', name: 'other section', createdAt: 1, json: '{"somethingElse":{}}' }) == null,
    'a row whose json lacks the tapestryOwnerGoal section is not a goal record.');
});

test('U4 (AC 2/AC 6): deriveStanding returns the canonical lowercase word "captured" for every v1 record', () => {
  const core = loadCore();
  const rec = { uuid: 'u', name: 'n', statement: 's', origin: null, capturedOn: null, createdAt: 1 };
  assert(core.deriveStanding(rec) === 'captured',
    `v1 standing is derived, and every goal this story can represent derives to 'captured' ` +
    `(lowercase, canonical set) — got ${short(core.deriveStanding(rec))}.`);
});

test('U5 (AC 1): resolveCaptureDate prefers capturedOn, falls back to created_at, degrades to null', () => {
  const core = loadCore();
  assert(core.resolveCaptureDate({ capturedOn: '2026-07-22', createdAt: 1000 }) === '2026-07-22',
    'capturedOn (the stable json field) must win when present — created_at resets on re-sign (ADR decision 2).');
  const fromCreated = core.resolveCaptureDate({ capturedOn: null, createdAt: 1784391581 });
  assert(typeof fromCreated === 'string' && fromCreated.startsWith('2026-07-18'),
    `legacy records fall back to the event created_at (1784391581 → 2026-07-18…); got ${short(fromCreated)}.`);
  assert(core.resolveCaptureDate({ capturedOn: null, createdAt: null }) == null,
    'a record with neither date resolves to null — the view renders nothing, never "Invalid Date".');
});

test('U6 (view order): sortGoals orders capture date descending across mixed date sources', () => {
  const core = loadCore();
  const a = { uuid: 'a', name: 'oldest', capturedOn: null, createdAt: 1700000000 };
  const b = { uuid: 'b', name: 'middle', capturedOn: '2026-07-10', createdAt: 1900000000 };
  const c = { uuid: 'c', name: 'newest', capturedOn: '2026-07-22', createdAt: 1600000000 };
  const sorted = core.sortGoals([a, b, c]);
  assert(Array.isArray(sorted) && sorted.map((g) => g.uuid).join(',') === 'c,b,a',
    `sortGoals must order by resolved capture date, newest first (ADR decision 4 interpretation); ` +
    `got ${short(sorted && sorted.map((g) => g.uuid))}.`);
});

/* ══════════════ S-class — source assertions (stack-free) ══════════════ */

test('S1 (purity): the goals core is dependency-free — zero require/import in src/lib/brain/goals.js', () => {
  const src = safeRead(CORE);
  assert(src, CORE_MISSING);
  assert(!/\brequire\s*\(/.test(src) && !/\bimport\s/.test(src),
    'the core must not require/import anything — purity is what makes it reusable by story 2\'s checker ' +
    'and executable in the stack-free CI job (ADR 0001 implementation notes).');
});

test('S2 (ADR d3): brain API module — gate, route, and exact import surface', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js does not exist yet — the owner-gated read surface (ADR decision 3) is not implemented.');
  assert(/\/api\/brain\/goals|['"`]\/goals['"`]/.test(src) && /\bget\b/i.test(src),
    'the module must register GET /api/brain/goals.');
  assert(/isOwner\s*\(\s*req\s*\)/.test(src) && /localTrusted/.test(src) && /403/.test(src),
    'the in-handler gate must be the platform template: isOwner(req) || req.localTrusted, else 403 ' +
    '(route-level requireOwner would 401 the loopback conversational agent — ADR Context).');
  const requires = [...src.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1]);
  assert(requires.length > 0, 'the module must declare its imports via require().');
  // lib/brain/hygiene added by second-brain #2; lib/brain/resources added by
  // second-brain #4 (ADR 0004 d5); lib/brain/work-records added by second-brain
  // #5 (ADR 0005 d10, the records projection core) — this re-pin admits exactly
  // those seven, nothing else.
  const allowed = [/neo4j-driver$/, /middleware\/auth$/, /assistantKeys$/, /lib\/brain\/goals$/, /lib\/brain\/hygiene$/, /lib\/brain\/resources$/, /lib\/brain\/work-records$/, /lib\/brain\/proposals$/];
  for (const spec of requires) {
    assert(allowed.some((re) => re.test(spec)),
      `import surface violation: require('${spec}') — the brain read module allows only lib/neo4j-driver, ` +
      'middleware/auth, utils/assistantKeys, lib/brain/goals, lib/brain/hygiene, lib/brain/resources, lib/brain/work-records ' +
      '(ADR 0001 + ADR 0002 + ADR 0004 + ADR 0005 re-pins; keeps the module S-auditable and structurally strfry-free).');
  }
});

test('S3 (ADR d3): the brain routes are registered in src/api/index.js', () => {
  const src = safeRead(API_INDEX);
  assert(/require\s*\(\s*['"`]\.\/brain['"`]\s*\)|require\s*\(\s*['"`]\.\/brain\/index(\.js)?['"`]\s*\)/.test(src),
    'src/api/index.js must require the new brain module.');
  assert(/registerBrainRoutes|brain/.test(src),
    'src/api/index.js must invoke the brain route registration.');
});

test('S4 (house rule): no hardcoded 64-hex pubkey in any new file of this story', () => {
  const files = [CORE, BRAIN_API, GOALS_PAGE, HOOK];
  const existing = files.filter((f) => fs.existsSync(f));
  assert(existing.length > 0,
    'none of the story\'s new files exist yet (core, API module, page, hook) — nothing to scan.');
  for (const f of existing) {
    const src = safeRead(f);
    assert(!/\b[0-9a-f]{64}\b/i.test(src),
      `${path.relative(ROOT, f)} contains a 64-hex literal — the TA pubkey is per-deployment and must be ` +
      'resolved at runtime (CLAUDE.md house rule; PRD §7.8).');
  }
});

test('S5 (AC 4/AC 5): Goals view carries the verbatim style-guide copy — cold start and privacy line', () => {
  const src = safeRead(GOALS_PAGE);
  assert(src, 'ui/src/pages/brain/Goals.jsx does not exist yet — the Goals view (ADR decision 5) is not implemented.');
  assert(src.includes(COLD_START),
    'the cold-start empty state must be the style guide\'s canonical sentence, byte-exact ' +
    '(the style guide is the copy authority; the wireframe\'s embellishment is not the copy).');
  assert(src.includes(PRIVACY_LINE),
    'the privacy indicator line must be verbatim from the style guide.');
});

test('S5b (AC 5): the privacy line is an indicator — no toggle/control vocabulary in the view', () => {
  const src = safeRead(GOALS_PAGE);
  assert(src, 'Goals.jsx missing (see S5).');
  assert(!/toggle|checkbox|switch/i.test(src),
    'AC 5: the privacy line is an indicator, never a control — no toggle/checkbox/switch may exist in the Goals view.');
});

test('S6 (ADR d5): Goals view is owner-gated with the platform classification check', () => {
  const src = safeRead(GOALS_PAGE);
  assert(src, 'Goals.jsx missing (see S5).');
  assert(/classification\s*===\s*['"`]owner['"`]/.test(src) && /['"`]admin['"`]/.test(src),
    'the view must gate on the platform pair-check (owner || admin), mirroring settings/Index.jsx (ADR decision 5).');
});

test('S7 (AC 2/AC 6): standing words in the view stay within the canonical set the epic has reached', () => {
  const src = safeRead(GOALS_PAGE);
  assert(src, 'Goals.jsx missing (see S5).');
  assert(/['"`>]captured['"`<]/.test(src) || /captured/.test(src),
    'the standing word "captured" (lowercase, canonical) must appear — it is the baseline standing.');
  // 'viable' admitted by second-brain #3 (ADR 0003 d3/d10) — story 3's own
  // suite asserts it renders; this pin now excludes only the still-future
  // standings. (Amended in story-3 Test Design, per the story-2 lesson:
  // sibling re-pins are planned in Phase 3, never discovered at the impl gate.)
  for (const w of ['achieved', 'abandoned']) {
    assert(!new RegExp(`['"\`>]${w}['"\`<]`).test(src),
      `standing word "${w}" belongs to later stories (6+) — rendering it now is scope leak (AC 6: canonical set only).`);
  }
});

test('S8 (AC 6): no banned jargon in the view\'s quoted strings and JSX text', () => {
  const src = safeRead(GOALS_PAGE);
  assert(src, 'Goals.jsx missing (see S5).');
  const visible = [
    ...[...src.matchAll(/'([^'\\\n]*)'/g)].map((m) => m[1]),
    ...[...src.matchAll(/"([^"\\\n]*)"/g)].map((m) => m[1]),
    ...[...src.matchAll(/`([^`]*)`/g)].map((m) => m[1]),
    ...[...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]),
  ].join('\n');
  // The unambiguous subset of the banned list — words with no legitimate code
  // use inside quoted strings/JSX text. (element/kind/event/schema appear in
  // legitimate identifiers; the Reviewer's guide audit covers those.)
  for (const w of ['superset', 'pubkey', 'payload', 'concept header', 'acceptance criteria', 'lease']) {
    assert(!new RegExp(`\\b${w}\\b`, 'i').test(visible),
      `banned jargon "${w}" found in owner-visible text of Goals.jsx (style guide: banned words; AC 6).`);
  }
});

test('S9 (ADR d5): route and nav wiring — /tapestry/goals child route, ownerOnly nav entry', () => {
  const app = safeRead(APP);
  assert(/['"`]goals['"`]/.test(app) && /Goals/.test(app),
    'App.jsx must register the goals child route under /tapestry (ADR implementation notes).');
  const layout = safeRead(LAYOUT);
  assert(/\/tapestry\/goals/.test(layout),
    'Layout.jsx must carry a nav entry pointing at /tapestry/goals.');
  assert(/ownerOnly\s*:\s*true/.test(layout),
    'the Goals nav entry must set ownerOnly: true — the first consumer of the existing Layout nav filter.');
});

test('S10 (ADR d5): useBrainGoals hook — fetches the brain endpoint with AbortController', () => {
  const src = safeRead(HOOK);
  assert(src, 'ui/src/hooks/useBrainGoals.js does not exist yet (ADR implementation notes).');
  assert(/\/api\/brain\/goals/.test(src),
    'the hook must fetch /api/brain/goals.');
  assert(/AbortController/.test(src),
    'the hook must use AbortController cleanup (useGrapevineFollows.js house pattern).');
});

test('S11 (ADR d7): no publish machinery in any new UI file', () => {
  for (const f of [GOALS_PAGE, HOOK]) {
    const src = safeRead(f);
    if (!src) continue; // existence is asserted elsewhere; this test pins content when present
    assert(!/nostrPublish|publishEverywhere|publishToRelays/.test(src),
      `${path.relative(ROOT, f)} must not touch the browser publish machinery — capture is server-side, ` +
      'local strfry only (ADR decision 7; event-tagging ADR 0002).');
  }
  const page = safeRead(GOALS_PAGE);
  assert(page, 'Goals.jsx missing — S11 needs at least the page to exist to be meaningful.');
});

test('S12 (design guide): loading skeleton and plain-language error-with-retry are designed states', () => {
  const src = safeRead(GOALS_PAGE);
  assert(src, 'Goals.jsx missing (see S5).');
  assert(/skeleton/i.test(src),
    'loading must render skeleton rows (design guide: "three skeleton rows", never a bare spinner).');
  assert(/retry/i.test(src),
    'the error state must offer a retry affordance (design guide goal-row error spec).');
});

/* ══════════════ H-class — live local stack (SKIP when absent) ══════════════ */

test('H1 (AC 3): GET /api/brain/goals returns the three adopted legacy goals; standing always follows the derivation rule', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackGetJson('/api/brain/goals');
  assert(r && r.success === true && Array.isArray(r.goals),
    `the endpoint must answer {success:true, goals:[…]} (got ${short(r)}) — is the brain read surface deployed?`);
  const names = r.goals.map((g) => g.name);
  for (const legacy of LEGACY_GOAL_NAMES) {
    assert(names.includes(legacy),
      `adoption failure: legacy goal "${legacy}" missing from the Goals read (AC 3 — the brain adopts the ` +
      `existing concept's elements). Got names: ${short(names)}.`);
  }
  // Amended by second-brain #3 (ADR 0003 d3): the old pin — "every goal is
  // captured" — is falsified by the feature's first real use (any sharpened
  // leaf derives viable, durably). The durable invariant is derivation
  // CONSISTENCY: standing must match the goal's own record fields. Both
  // fields undefined pre-story-3 → 'captured', so this passes on both sides.
  for (const g of r.goals) {
    const both = typeof g.deliverable === 'string' && g.deliverable.trim() !== '' &&
                 typeof g.boundary === 'string' && g.boundary.trim() !== '';
    const expected = g.hasChildren ? 'captured' : (both ? 'viable' : 'captured');
    assert(g.standing === expected,
      `standing must follow the derivation rule (leaf + deliverable + boundary → viable; children → captured; ` +
      `else captured — ADR 0003 d3): expected '${expected}', got ${short(g.standing)} on "${short(g.name)}".`);
  }
});

test('H2 (AC 3): the class-machinery entries never render as goals', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackGetJson('/api/brain/goals');
  assert(r && r.success === true, `endpoint not answering (got ${short(r)}).`);
  for (const g of r.goals) {
    assert(!/superset for the concept/i.test(g.name || ''),
      `stray class-machinery entry rendered as a goal: "${short(g.name)}" — the read must use the directed ` +
      'walk (ADR decision 3); incoming HAS_ELEMENT edges are not goals.');
    assert(!/-superset$/.test((g.uuid || '').split(':').pop() || ''),
      `a Superset node leaked into the goals list (uuid ${short(g.uuid)}).`);
  }
});

test('H3 (ADR d2): the goal schema carries optional origin and capturedOn; required set unchanged', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const ta = getTaPubkey();
  const node = loopbackGetJson(`/api/concept-graph/node/${encodeURIComponent(`39999:${ta}:tapestry-owner-goal-schema`)}`);
  assert(node && node.success !== false, `could not fetch the goal schema node (got ${short(node)}).`);
  const tags = node.node?.tags || [];
  const jsonTag = tags.find((t) => t.type === 'json');
  assert(jsonTag, 'the schema node must carry a json tag.');
  const parsed = JSON.parse(jsonTag.value);
  const schema = parsed.jsonSchema || parsed;
  const inner = schema?.properties?.tapestryOwnerGoal;
  assert(inner && inner.properties,
    `unexpected schema shape (got ${short(jsonTag.value, 400)}).`);
  for (const f of ['origin', 'capturedOn']) {
    assert(inner.properties[f],
      `schema extension not applied: tapestryOwnerGoal.properties.${f} missing — the one-time save-schema ` +
      'step (ADR decision 2) has not run. Undeclared fields get silently dropped by the element editor.');
  }
  const required = inner.required || [];
  assert(required.includes('name') && required.includes('slug') && required.includes('description'),
    `the original required set must survive the extension (got ${short(required)}).`);
  assert(!required.includes('origin') && !required.includes('capturedOn'),
    'origin/capturedOn must be OPTIONAL — required would break the three legacy elements under advisory validation.');
});

test('H4 (AC 1): capture round-trip — the create-element contract body reads back through the Goals endpoint', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  // Pre-clean any residue from a previously failed run (idempotent).
  fixtureCreated = true; // arm teardown from this point, even on mid-test failure
  try { deleteFixtureFromNeo4j(); deleteFixtureFromStrfry(); } catch { /* best-effort pre-clean */ }
  const body = {
    concept: 'tapestry owner goal',
    name: FIXTURE_NAME,
    json: FIXTURE_JSON,
  };
  const created = loopbackPostJson('/api/normalize/create-element', body);
  assert(created && created.success === true,
    `create-element rejected the capture contract body (got ${short(created, 400)}).`);
  // READ-BACK is the assertion — response success alone is untrustworthy
  // (publishToStrfry silent-drop bug, ADR Consequences (b)).
  const r = loopbackGetJson('/api/brain/goals');
  assert(r && r.success === true, `Goals read not answering after capture (got ${short(r)}).`);
  const mine = r.goals.find((g) => g.name === FIXTURE_NAME);
  assert(mine,
    'captured goal did not read back through GET /api/brain/goals — capture-to-view is broken (AC 1/AC 2).');
  assert(mine.statement === 'prove the capture contract lands a readable goal',
    `statement must read back (got ${short(mine.statement)}).`);
  assert(mine.origin === 'harness test, in conversation',
    `origin must read back (got ${short(mine.origin)}).`);
  assert(mine.capturedOn === '2026-07-22',
    `capturedOn must read back (got ${short(mine.capturedOn)}).`);
  assert(mine.standing === 'captured',
    `a fresh capture derives standing 'captured' (got ${short(mine.standing)}).`);
});

test('H5 (ADR d3): host-side unauthenticated GET is refused with the in-handler 403', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const res = await fetch(`${HOST_BASE}/api/brain/goals`, { signal: AbortSignal.timeout(5000) });
  assert(res.status === 403,
    `host :7778 is the remote caller class (security-auth-exposure/0001) and carries no session — the ` +
    `in-handler gate must answer 403 (got ${res.status}${res.status === 404 ? ' — route not registered yet' : ''}).`);
  const body = await res.json().catch(() => null);
  assert(body && body.success === false,
    `the 403 must be a structured {success:false} answer (got ${short(body)}).`);
});

test('H6 (contract): every goal in the response carries the full record shape', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackGetJson('/api/brain/goals');
  assert(r && r.success === true && r.goals.length >= 3, `expected ≥3 goals (got ${short(r)}).`);
  for (const g of r.goals) {
    for (const k of ['uuid', 'name', 'statement', 'origin', 'capturedOn', 'createdAt', 'standing']) {
      assert(k in g,
        `goal record missing key "${k}" (goal ${short(g.name)}) — the response contract is ` +
        '{uuid,name,statement,origin,capturedOn,createdAt,standing} with null for absent optionals (ADR decision 3).');
    }
  }
});

/* ══════════════ R-class — regression sentinels (pass before AND after) ══════════════ */

test('R1: Layout\'s ownerOnly nav filter still exists (the mechanism the Goals nav entry rides)', () => {
  const src = safeRead(LAYOUT);
  assert(/!item\.ownerOnly\s*\|\|\s*isOwner/.test(src),
    'Layout.jsx must keep the ownerOnly nav filter — the Goals entry depends on it (ADR decision 5).');
});

test('R2: the create-element route this story\'s capture contract rides is still registered', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/create-element/.test(src),
    'src/api/normalize/index.js must keep the create-element route — the capture contract adopts it (ADR decision 1).');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- capture-a-goal-and-see-it tests (epic second-brain, Story 1) ---');
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
    teardownFixture();
    if (teardownFailure) {
      console.log(`  FAIL  fixture teardown\n        ${teardownFailure}`);
      failures.push({ name: 'fixture teardown', message: teardownFailure });
      fail++;
    }
  }
  console.log(`\ncapture-a-goal-and-see-it: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
