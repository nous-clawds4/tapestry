/**
 * Story 3 (epic: second-brain) — Break a goal into pieces.
 *
 * Story: engineering-team/stories/second-brain/3-break-a-goal-into-pieces.md
 * ADR:   engineering-team/decisions/second-brain/0003-record-based-decomposition-and-validated-goal-writes.md
 *
 * Test classes (ADR "Test-class guidance", per test-hermeticity-ci/0001):
 *
 *   U-class (EXECUTED, stack-free, always gates CI) — the extended goals core
 *     (parseGoalRow new fields, children-aware deriveStanding, the
 *     resolveDecomposition read truth, the validateDecompositionOp write
 *     truth) and the grown hygiene taxonomy (classifyDecomposition's three
 *     kinds + the schema-unreadable split), all over SYNTHETIC records.
 *     Contracts pinned here (Tester's lane per the ADR's latitude):
 *       resolveDecomposition(records) → same-length, same-order array; each
 *         record gains parentUuid (string|null) and hasChildren (boolean);
 *         a record whose parent did not resolve (dangling, cycle-broken)
 *         carries parentUnresolved: true; a slug-shadowed record carries
 *         slugShadowed: true.
 *       validateDecompositionOp(records, op) → { ok: true } or
 *         { ok: false, refusal: '<kind>', detail: '<sentence>' } with kinds
 *         parent-not-found | ambiguous-slug | self-parent | cycle |
 *         already-has-parent.
 *       classifyDecomposition({concept, records}) → problem records
 *         {concept, subject, kind, detail}: dangling-parent-reference
 *         (subject = the goal uuid), decomposition-cycle (one problem per
 *         cycle; subject = the lexicographically smallest member uuid;
 *         detail names every member), duplicate-slug (subject = the slug;
 *         detail names the sharing uuids).
 *
 *   S-class (source assertions, stack-free) — the two validated normalize
 *     primitives (routes, gates, discriminated-result and refusal tokens,
 *     serialization trace); the save-schema fold (extracted
 *     reconcilePrimaryPropertyForConcept, not-applicable, primaryProperty in
 *     the response); the hygiene taxonomy tokens; the tree + detail UI
 *     (verbatim hint line, "Done means"/"Stays inside", disclosure glyph,
 *     navigation, jargon guard on the NEW page — story-1's S8 scans only
 *     Goals.jsx); route registration; the ADR-0002 Amended-by pointer;
 *     sentinels pinning what must NOT change (brain import surface, brain
 *     read-only-ness, untouchables).
 *
 *   H-class (live local stack, per-test SKIP when unreachable) — the d13
 *     schema extension is live (the suite never calls save-schema itself);
 *     hygiene stays green; create-child-goal and update-goal-intent
 *     round-trips on SENTINEL-NAMED FIXTURES (the three legacy goals are
 *     never mutated — adoption is irreversible in-contract); the full
 *     refusal matrix with read-back proving nothing written; legacy-goal
 *     integrity; host-side caller-class 401s.
 *
 *   R-class (regression sentinels, stack-free, pass before AND after).
 *
 * Pass-by-design sentinels (documented, story-2 review precedent): S1, S2,
 * S11, S12, H2, H6, R1, R2 pass before AND after implementation — they pin
 * invariants the story must not break. Everything else FAILS until the
 * feature lands (cores lack the functions, routes 404, schema not extended).
 * H tests SKIP when the stack is absent (CI's stack-free job).
 *
 * Fixture hygiene: H3/H4 create three goals with fixed sentinel names (one
 * parent via the create-element contract with a fully-controlled json, one
 * child via create-child-goal, one adoptee via create-element). run()'s
 * finally tears them down: strfry delete by d-tag first (kills the sync
 * source), then Neo4j element+tags together, then a value-scoped orphan-tag
 * sweep (d/name by exact value, json by the sentinel substring — never by
 * z value, which is shared with real goals), then strfry count-0 verify.
 * Pre-clean runs the same routine best-effort so a crashed prior run never
 * poisons this one. A teardown failure is a loud suite failure.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GOALS_CORE = path.join(ROOT, 'src/lib/brain/goals.js');
const HYGIENE_CORE = path.join(ROOT, 'src/lib/brain/hygiene.js');
const BRAIN_API = path.join(ROOT, 'src/api/brain/index.js');
const NORMALIZE_INDEX = path.join(ROOT, 'src/api/normalize/index.js');
const RELATIONSHIPS = path.join(ROOT, 'src/api/normalize/relationships.js');
const PROBE = path.join(ROOT, 'src/api/normalize/probe.js');
const GOALS_PAGE = path.join(ROOT, 'ui/src/pages/brain/Goals.jsx');
const DETAIL_PAGE = path.join(ROOT, 'ui/src/pages/brain/GoalDetail.jsx');
const APP = path.join(ROOT, 'ui/src/App.jsx');
const ADR_0002 = path.join(ROOT, 'engineering-team/decisions/second-brain/0002-hygiene-check-and-primary-property-reconcile.md');

const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

// Verbatim owner-facing copy — the design guide's hint line and the
// wireframe-§2 field labels (binding at review; byte-exact).
const HINT_LINE = 'needs a deliverable and boundary before it can be proposed';
const DONE_MEANS = 'Done means';
const STAYS_INSIDE = 'Stays inside';

// The three adopted legacy goals (story-1 pin; never mutated by this suite).
const LEGACY_GOAL_NAMES = [
  'NosFabrica success',
  'advance physical understanding of the world',
  'develop tapestry into an agentic second brain',
];

// H fixtures — fixed sentinel names; d-tag scheme slug(name)-hash8(headerUuid),
// hash8 of the goal header is 1903378a (story-1 verified).
const FIX_SENTINEL = 'harness decomposition';
const FIX_PARENT_NAME = 'harness decomposition parent goal';
const FIX_PARENT_SLUG = 'harness-decomposition-parent-goal';
const FIX_CHILD_NAME = 'harness decomposition child goal';
const FIX_CHILD_SLUG = 'harness-decomposition-child-goal';
const FIX_ADOPTEE_NAME = 'harness decomposition adoptee goal';
const FIX_ADOPTEE_SLUG = 'harness-decomposition-adoptee-goal';
const FIX_SLUGS = [FIX_PARENT_SLUG, FIX_CHILD_SLUG, FIX_ADOPTEE_SLUG];
const FIX_DTAGS = FIX_SLUGS.map((s) => `${s}-1903378a`);
const FIX_NAMES = [FIX_PARENT_NAME, FIX_CHILD_NAME, FIX_ADOPTEE_NAME];

// The parent fixture's json (create-element contract — fully controlled).
// It carries deliverable + boundary so H3 can prove AC 3 live: a goal with
// BOTH fields and a child must still derive 'captured', never 'viable'.
const FIX_PARENT_JSON = { tapestryOwnerGoal: {
  name: FIX_PARENT_NAME,
  slug: FIX_PARENT_SLUG,
  description: 'prove decomposition round-trips through the brain read',
  origin: 'harness test, in conversation',
  capturedOn: '2026-07-23',
  deliverable: 'a parent fixture that acquires a child',
  boundary: 'harness fixtures only — never the real goals',
} };
// The adoptee's json deliberately OMITS capturedOn: H4 proves the d7 backfill
// (update-goal-intent must pin a capture date before its re-sign).
const FIX_ADOPTEE_JSON = { tapestryOwnerGoal: {
  name: FIX_ADOPTEE_NAME,
  slug: FIX_ADOPTEE_SLUG,
  description: 'prove intent updates and adoption round-trip',
  origin: 'harness test, in conversation',
} };

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function short(x, n = 260) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}

const CORE_MISSING_FN = (fn) =>
  `src/lib/brain/goals.js does not export ${fn}() yet — the decomposition core (ADR 0003 d3/d4) is not implemented.`;
function loadGoalsCore() {
  if (!fs.existsSync(GOALS_CORE)) throw new Error('src/lib/brain/goals.js missing — story 1 regression.');
  try { return require(GOALS_CORE); }
  catch (e) { throw new Error(`src/lib/brain/goals.js failed to require: ${e.message}`); }
}
function loadHygiene() {
  if (!fs.existsSync(HYGIENE_CORE)) throw new Error('src/lib/brain/hygiene.js missing — story 2 regression.');
  try { return require(HYGIENE_CORE); }
  catch (e) { throw new Error(`src/lib/brain/hygiene.js failed to require: ${e.message}`); }
}

/* ── synthetic fixtures (U-class) ─────────────────────────────────────── */

const TA = 'synthetic-ta'; // handles are opaque strings to the core — no hex needed
function core39999(slug) { return `39999:${TA}:${slug}`; }

// A parsed goal record in the ADR 0003 d1 shape (parseGoalRow output).
function rec(slug, over = {}) {
  return {
    uuid: core39999(`${slug}-1903378a`),
    name: slug.replace(/-/g, ' '),
    slug,
    statement: 'a statement',
    origin: null,
    capturedOn: null,
    createdAt: 1784000000,
    deliverable: null,
    boundary: null,
    parent: null,
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
  const out = dockerCurl(['-s', '-m', '15', '-X', 'POST', '-H', 'Content-Type: application/json',
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
// Full-record snapshot (extends the story-2 shape with the decomposition
// fields) — the refusal matrix compares this before/after: nothing written.
function goalSetSnapshot() {
  return getGoals()
    .map((g) => [g.uuid, g.name, g.statement, g.origin, g.capturedOn, g.deliverable, g.boundary, g.parent].join('|'))
    .sort()
    .join('\n');
}

/* ── H fixture bookkeeping ─────────────────────────────────────────────── */

let fixturesArmed = false;
let teardownFailure = null;

function fixtureUuids() {
  const ta = getTaPubkey();
  return FIX_DTAGS.map((d) => `39999:${ta}:${d}`);
}

function deleteFixturesFromStrfry() {
  for (const dTag of FIX_DTAGS) {
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
  for (const dTag of FIX_DTAGS) {
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
    params: { uuids: fixtureUuids() },
  });
  assert(r1 && r1.success !== false, `fixture Neo4j teardown failed: ${short(r1)}`);
  // Orphan-tag sweep, value-scoped to the sentinel family. Never by z value
  // (the z value is the goal header uuid, shared with the real goals).
  const r2 = loopbackPostJson('/api/neo4j/query', {
    cypher: `MATCH (t:NostrEventTag) WHERE (t.type = 'd' AND t.value IN $dtags)
             OR (t.type = 'name' AND t.value IN $names)
             OR (t.type = 'json' AND t.value CONTAINS $sentinel)
             DETACH DELETE t`,
    params: { dtags: FIX_DTAGS, names: FIX_NAMES, sentinel: 'harness-decomposition-' },
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

/* ══════════════ U-class — the extended goals core (EXECUTED) ══════════════ */

test('U1 (contract): goals core exports the story-1 four plus resolveDecomposition and validateDecompositionOp', () => {
  const core = loadGoalsCore();
  for (const fn of ['parseGoalRow', 'deriveStanding', 'resolveCaptureDate', 'sortGoals',
    'resolveDecomposition', 'validateDecompositionOp']) {
    assert(typeof core[fn] === 'function', CORE_MISSING_FN(fn));
  }
});

test('U2 (AC 1/AC 5): parseGoalRow extracts slug, deliverable, boundary, parent; legacy rows stay valid with nulls', () => {
  const core = loadGoalsCore();
  const full = core.parseGoalRow({
    uuid: core39999('piece-1903378a'), name: 'piece', createdAt: 1784000001,
    json: JSON.stringify({ tapestryOwnerGoal: {
      name: 'piece', slug: 'piece', description: 'a session-sized piece',
      origin: 'owner', capturedOn: '2026-07-23',
      deliverable: 'a one-page comparison', boundary: 'research only — no code',
      parent: 'the-big-goal',
    } }),
  });
  assert(full, 'parseGoalRow must return a record for a well-formed decomposed goal row.');
  assert(full.slug === 'piece',
    `the record must carry the json slug — it is the parent-reference key (ADR 0003 d1/d2); got ${short(full.slug)}.`);
  assert(full.deliverable === 'a one-page comparison' && full.boundary === 'research only — no code',
    `deliverable/boundary must be extracted (got ${short([full.deliverable, full.boundary])}).`);
  assert(full.parent === 'the-big-goal',
    `parent must be extracted (got ${short(full.parent)}).`);
  const legacy = core.parseGoalRow({
    uuid: core39999('legacy-1903378a'), name: 'legacy', createdAt: 1784000002,
    json: JSON.stringify({ tapestryOwnerGoal: { name: 'legacy', slug: 'legacy', description: 'old' } }),
  });
  assert(legacy, 'a legacy (pre-story-3) row must still parse — the fields are optional (ADR 0003 d1).');
  assert(legacy.deliverable == null && legacy.boundary == null && legacy.parent == null,
    `absent fields must come through as null-ish, never invented (got ${short(legacy)}).`);
});

test('U3 (AC 2/AC 3): deriveStanding — viable iff leaf with both fields non-empty; children always force captured', () => {
  const core = loadGoalsCore();
  const both = rec('a', { deliverable: 'done thing', boundary: 'stays here' });
  assert(core.deriveStanding(both, { hasChildren: false }) === 'viable',
    'a leaf with a deliverable AND a boundary derives viable (ADR 0003 d3; AC 2).');
  assert(core.deriveStanding(rec('b', { deliverable: 'done thing' }), { hasChildren: false }) === 'captured',
    'a leaf missing the boundary derives captured (AC 2).');
  assert(core.deriveStanding(rec('c', { boundary: 'stays here' }), { hasChildren: false }) === 'captured',
    'a leaf missing the deliverable derives captured (AC 2).');
  assert(core.deriveStanding(rec('d', { deliverable: '   ', boundary: 'x' }), { hasChildren: false }) === 'captured',
    'whitespace-only fields do not count — viable needs the owner\'s words, not blanks (ADR 0003 d3).');
  assert(core.deriveStanding(both, { hasChildren: true }) === 'captured',
    'a goal WITH CHILDREN derives captured even when it carries both fields — never viable (AC 3).');
  assert(core.deriveStanding(rec('e')) === 'captured',
    'one-argument calls keep the story-1 behavior: captured (backward-compatible extension point, ADR 0003 d3).');
});

test('U4 (AC 1/AC 4): resolveDecomposition — attachment by slug, hasChildren, order preserved', () => {
  const core = loadGoalsCore();
  const parent = rec('big-goal');
  const child = rec('piece-one', { parent: 'big-goal' });
  const other = rec('unrelated');
  const out = core.resolveDecomposition([parent, child, other]);
  assert(Array.isArray(out) && out.length === 3,
    `resolveDecomposition must return the same-length array (got ${short(out && out.length)}).`);
  assert(out.map((r) => r.uuid).join(',') === [parent, child, other].map((r) => r.uuid).join(','),
    'resolveDecomposition must preserve input order — sortGoals stays the one ordering truth (ADR 0003 d5).');
  const [p, c, o] = out;
  assert(c.parentUuid === parent.uuid,
    `the child's parent slug must resolve to the parent's uuid (got ${short(c.parentUuid)}).`);
  assert(p.hasChildren === true && c.hasChildren === false && o.hasChildren === false,
    `hasChildren must be computed for every record (got ${short(out.map((r) => r.hasChildren))}).`);
  assert(p.parentUuid == null && o.parentUuid == null,
    'parentless records resolve to root (parentUuid null).');
});

test('U5 (read tolerance): duplicate slugs resolve deterministically — oldest createdAt wins, losers flagged slugShadowed', () => {
  const core = loadGoalsCore();
  const older = rec('dup', { uuid: core39999('dup-old-1903378a'), createdAt: 100 });
  const newer = rec('dup', { uuid: core39999('dup-new-1903378a'), createdAt: 200 });
  const child = rec('kid', { parent: 'dup' });
  const a = core.resolveDecomposition([older, newer, child]);
  const b = core.resolveDecomposition([newer, child, older]);
  const childA = a.find((r) => r.slug === 'kid');
  const childB = b.find((r) => r.slug === 'kid');
  assert(childA.parentUuid === older.uuid && childB.parentUuid === older.uuid,
    `a duplicated parent slug must attach children to the OLDEST record deterministically, regardless of input ` +
    `order (ADR 0003 d4); got ${short([childA.parentUuid, childB.parentUuid])}, expected ${older.uuid}.`);
  const shadowedA = a.find((r) => r.uuid === newer.uuid);
  assert(shadowedA.slugShadowed === true,
    'the losing duplicate must be flagged slugShadowed:true — the view never silently hides the collision.');
  const winner = a.find((r) => r.uuid === older.uuid);
  assert(!winner.slugShadowed, 'the winning record is not shadowed.');
});

test('U6 (read tolerance): dangling parents root+flag; cycles break at the members only — descendants stay attached', () => {
  const core = loadGoalsCore();
  // dangling
  const dangling = rec('orphan', { parent: 'no-such-slug' });
  const d = core.resolveDecomposition([dangling])[0];
  assert(d.parentUuid == null && d.parentUnresolved === true,
    `a dangling parent reference must resolve to root and be flagged parentUnresolved (got ${short(d)}).`);
  // self-parent (cycle of length 1)
  const selfie = rec('selfie', { parent: 'selfie' });
  const s = core.resolveDecomposition([selfie])[0];
  assert(s.parentUuid == null && s.parentUnresolved === true,
    `self-parenting is the length-1 cycle — root + flagged (got ${short(s)}).`);
  // mutual cycle with a well-formed descendant hanging off one member
  const a = rec('cyc-a', { parent: 'cyc-b' });
  const b = rec('cyc-b', { parent: 'cyc-a' });
  const kid = rec('cyc-kid', { parent: 'cyc-a' });
  const out = core.resolveDecomposition([a, b, kid]);
  const ra = out.find((r) => r.slug === 'cyc-a');
  const rb = out.find((r) => r.slug === 'cyc-b');
  const rk = out.find((r) => r.slug === 'cyc-kid');
  assert(ra.parentUuid == null && ra.parentUnresolved === true && rb.parentUuid == null && rb.parentUnresolved === true,
    `cycle members must each become flagged roots (got ${short([ra, rb])}).`);
  assert(rk.parentUuid === a.uuid && rk.parentUnresolved !== true,
    'a well-formed descendant of a cycle member must stay attached — the break nulls the CYCLE MEMBERS only, ' +
    `never their subtrees (ADR 0003 d4). Got ${short(rk)}.`);
  assert(ra.hasChildren === true,
    'the cycle member keeps its legitimate child (hasChildren true).');
});

test('U7 (AC 1): validateDecompositionOp — every refusal named; multi-level trees and sound adoptions pass', () => {
  const core = loadGoalsCore();
  const root = rec('root');
  const mid = rec('mid', { parent: 'root' });
  const leaf = rec('leaf', { parent: 'mid' });
  const loner = rec('loner');
  const dupA = rec('twin', { uuid: core39999('twin-a-1903378a'), createdAt: 100 });
  const dupB = rec('twin', { uuid: core39999('twin-b-1903378a'), createdAt: 200 });
  const records = [root, mid, leaf, loner, dupA, dupB];
  const refusal = (op) => {
    const v = core.validateDecompositionOp(records, op);
    assert(v && v.ok === false && typeof v.refusal === 'string',
      `expected a refusal for op ${short(op)} (got ${short(v)}).`);
    return v.refusal;
  };
  const ok = (op) => {
    const v = core.validateDecompositionOp(records, op);
    assert(v && v.ok === true, `expected ok for op ${short(op)} (got ${short(v)}).`);
  };
  // refusals, each by its ADR-named kind
  assert(refusal({ type: 'create-child', parentSlug: 'no-such' }) === 'parent-not-found',
    'creating a child under a nonexistent parent must refuse parent-not-found (AC 1).');
  assert(refusal({ type: 'create-child', parentSlug: 'twin' }) === 'ambiguous-slug',
    'a duplicated parent slug must refuse ambiguous-slug — never guess between records (ADR 0003 d4).');
  assert(refusal({ type: 'set-parent', goalSlug: 'loner', parentSlug: 'loner' }) === 'self-parent',
    'self-parenting must refuse self-parent (AC 1).');
  assert(refusal({ type: 'set-parent', goalSlug: 'root', parentSlug: 'leaf' }) === 'cycle',
    'placing a goal under its own descendant must refuse cycle (AC 1: a goal may not be placed under its own descendant).');
  assert(refusal({ type: 'set-parent', goalSlug: 'mid', parentSlug: 'loner' }) === 'already-has-parent',
    'adoption is for PARENTLESS goals only (gate ruling) — must refuse already-has-parent.');
  assert(refusal({ type: 'set-parent', goalSlug: 'no-such', parentSlug: 'root' }) != null,
    'an unknown goal slug must refuse (goal-not-found at the endpoint; any named refusal here).');
  // sound ops
  ok({ type: 'create-child', parentSlug: 'leaf' });   // a child can itself acquire children (tree, AC 1)
  ok({ type: 'create-child', parentSlug: 'mid' });    // parent mid-tree is fine
  ok({ type: 'set-parent', goalSlug: 'loner', parentSlug: 'leaf' }); // adoption of a parentless goal
});

test('U8 (AC 6 / hygiene): classifyDecomposition — dangling, cycle, duplicate-slug, each specific and deterministic', () => {
  const hygiene = loadHygiene();
  assert(typeof hygiene.classifyDecomposition === 'function',
    'src/lib/brain/hygiene.js must export classifyDecomposition() (ADR 0003 d9) — not implemented yet.');
  const CONCEPT = 'tapestry-owner-goal';
  // sound structures → zero problems
  const sound = [rec('a'), rec('b', { parent: 'a' })];
  const clean = hygiene.classifyDecomposition({ concept: CONCEPT, records: sound });
  assert(Array.isArray(clean) && clean.length === 0,
    `a sound tree must classify to zero decomposition problems (got ${short(clean)}).`);
  // dangling
  const dangling = rec('lost', { parent: 'gone' });
  const p1 = hygiene.classifyDecomposition({ concept: CONCEPT, records: [dangling] });
  assert(p1.length === 1 && p1[0].kind === 'dangling-parent-reference' && p1[0].subject === dangling.uuid,
    `a dangling parent must yield one 'dangling-parent-reference' problem naming the goal (got ${short(p1)}).`);
  assert(p1[0].detail.includes('gone'),
    `detail must name the unresolvable slug (AC-4-style specificity; got ${short(p1[0].detail)}).`);
  // cycle — one problem per cycle, subject = smallest member uuid, detail names members
  const ca = rec('cyc-a', { parent: 'cyc-b', uuid: core39999('cyc-a-1903378a') });
  const cb = rec('cyc-b', { parent: 'cyc-a', uuid: core39999('cyc-b-1903378a') });
  const p2a = hygiene.classifyDecomposition({ concept: CONCEPT, records: [ca, cb] });
  const p2b = hygiene.classifyDecomposition({ concept: CONCEPT, records: [cb, ca] });
  assert(p2a.length === 1 && p2a[0].kind === 'decomposition-cycle',
    `one cycle must yield exactly one 'decomposition-cycle' problem (got ${short(p2a)}).`);
  assert(p2a[0].subject === [ca.uuid, cb.uuid].sort()[0],
    `the cycle's subject must be the lexicographically smallest member uuid — deterministic (got ${short(p2a[0].subject)}).`);
  assert(p2a[0].detail.includes('cyc-a') && p2a[0].detail.includes('cyc-b'),
    `detail must name every cycle member (got ${short(p2a[0].detail)}).`);
  assert(JSON.stringify(p2a) === JSON.stringify(p2b),
    'cycle reporting must be input-order independent (deterministic).');
  // self-parent is the length-1 cycle
  const selfie = rec('selfie', { parent: 'selfie' });
  const p3 = hygiene.classifyDecomposition({ concept: CONCEPT, records: [selfie] });
  assert(p3.length === 1 && p3[0].kind === 'decomposition-cycle',
    `self-parenting must classify as a decomposition-cycle (length 1); got ${short(p3)}.`);
  // duplicate slug
  const d1 = rec('twin', { uuid: core39999('twin-a-1903378a') });
  const d2 = rec('twin', { uuid: core39999('twin-b-1903378a') });
  const p4 = hygiene.classifyDecomposition({ concept: CONCEPT, records: [d1, d2] });
  assert(p4.length === 1 && p4[0].kind === 'duplicate-slug' && p4[0].subject === 'twin',
    `a shared slug must yield one 'duplicate-slug' problem with the slug as subject (got ${short(p4)}).`);
  assert(p4[0].detail.includes(d1.uuid) && p4[0].detail.includes(d2.uuid),
    `detail must name the sharing uuids (got ${short(p4[0].detail)}).`);
});

test('U9 (row 85c): an unreadable SCHEMA reports kind schema-unreadable; an unreadable property section stays property-record-drift', () => {
  const hygiene = loadHygiene();
  const section = {
    key: 'tapestryOwnerGoal', title: 'T', type: 'object', required: ['name'],
    properties: { name: { type: 'string' } },
  };
  const p1 = hygiene.comparePropertyRecord({
    concept: 'tapestry-owner-goal', schemaObject: null, propertySection: section,
  });
  assert(Array.isArray(p1) && p1.length === 1 && p1[0].kind === 'schema-unreadable',
    `an unreadable/missing schema is the SCHEMA's defect — kind 'schema-unreadable' (ADR 0003 d9, row 85c); ` +
    `got ${short(p1)}.`);
  const p2 = hygiene.comparePropertyRecord({
    concept: 'tapestry-owner-goal',
    schemaObject: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
    propertySection: null,
  });
  assert(Array.isArray(p2) && p2.length === 1 && p2[0].kind === 'property-record-drift',
    `a null property section remains the RECORD's defect — kind 'property-record-drift' (story-2 U7(e) semantics ` +
    `preserved); got ${short(p2)}.`);
});

/* ══════════════ S-class — source assertions (stack-free) ══════════════ */

test('S1 (sentinel — ADR d5, re-pinned by second-brain #4): the brain import surface allows the story-3 five plus lib/brain/resources, nothing else', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  const requires = [...src.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1]);
  // second-brain #4 (ADR 0004 d5) widened this by lib/brain/resources; second-brain
  // #5 (ADR 0005 d10) widens it by lib/brain/work-records. Green on every side: a
  // pre-#4 module has five requires (all allowed), a post-#4 six, a post-#5 seven.
  const allowed = [/neo4j-driver$/, /middleware\/auth$/, /assistantKeys$/, /lib\/brain\/goals$/, /lib\/brain\/hygiene$/, /lib\/brain\/resources$/, /lib\/brain\/work-records$/];
  for (const spec of requires) {
    assert(allowed.some((re) => re.test(spec)),
      `import surface violation: require('${spec}') — story 3/4/5 behavior arrives through the goals/hygiene/resources/work-records ` +
      'cores only, never an unlisted require (ADR 0003 d5; ADR 0004 d5; ADR 0005 d10; story-1 S2 + story-2 S3 pins).');
  }
});

test('S2 (sentinel — ADR d5): the brain module stays structurally read-only — no mutation/strfry tokens', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(!/child_process|execFile|exec\s*\(|strfry|publishToStrfry|regenerateJson|nostrPublish/.test(src),
    'the brain module must stay mutation- and strfry-free — the decomposition writes live in normalize ' +
    '(ADR 0003 Option A / story-2 S6).');
});

test('S3 (ADR d6): create-child-goal — route, gate, and the named discriminated results', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/\/api\/normalize\/create-child-goal/.test(src),
    'POST /api/normalize/create-child-goal is not registered (ADR 0003 d6) — not implemented yet.');
  const start = src.indexOf('handleCreateChildGoal');
  assert(start !== -1, 'handleCreateChildGoal not found in src/api/normalize/index.js.');
  const slice = src.slice(start, start + 8000);
  assert(/isOwner\s*\(\s*req\s*\)/.test(slice) && /localTrusted/.test(slice) && /403/.test(slice),
    'create-child-goal must carry the explicit in-handler gate (isOwner(req) || req.localTrusted → 403).');
  for (const tok of ['created', 'parent-not-found', 'name-collides']) {
    assert(slice.includes(tok),
      `create-child-goal must answer the named discriminated result/refusal '${tok}' (ADR 0003 d6) — ` +
      'loud, named, nothing written.');
  }
});

test('S4 (ADR d7): update-goal-intent — route, gate, named refusals, and the capturedOn backfill', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/\/api\/normalize\/update-goal-intent/.test(src),
    'POST /api/normalize/update-goal-intent is not registered (ADR 0003 d7) — not implemented yet.');
  const start = src.indexOf('handleUpdateGoalIntent');
  assert(start !== -1, 'handleUpdateGoalIntent not found in src/api/normalize/index.js.');
  const slice = src.slice(start, start + 8000);
  assert(/isOwner\s*\(\s*req\s*\)/.test(slice) && /localTrusted/.test(slice) && /403/.test(slice),
    'update-goal-intent must carry the explicit in-handler gate.');
  for (const tok of ['updated', 'already-has-parent', 'empty-value']) {
    assert(slice.includes(tok),
      `update-goal-intent must answer the named discriminated result/refusal '${tok}' (ADR 0003 d7).`);
  }
  assert(/capturedOn/.test(slice),
    'update-goal-intent must backfill capturedOn before its re-sign — without it the first edit of a legacy ' +
    'goal silently moves its capture date to today (ADR 0003 d7).');
});

test('S5 (ADR d7): the two decomposition writes are serialized — a lexical trace of the mutex exists', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/create-child-goal/.test(src), 'create-child-goal missing (see S3).');
  assert(/mutex|serializ|writeChain|writeQueue/i.test(src),
    'the two decomposition write handlers must run through a module-level serialization primitive — two ' +
    'concurrent adoptions can otherwise commit a cycle that is unrepairable in-contract (ADR 0003 d7). ' +
    'No mutex/serialization trace found in src/api/normalize/index.js.');
});

test('S6 (ADR d8): the save-schema fold — extracted reconcile function, not-applicable, primaryProperty in the response', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/reconcilePrimaryPropertyForConcept/.test(src),
    'reconcilePrimaryPropertyForConcept (the extracted reconcile body, ADR 0003 d8) does not exist yet.');
  assert(/not-applicable/.test(src),
    "the fold needs the non-alarming 'not-applicable' result for unconventional/pp-less concepts (ADR 0003 d8) — " +
    'otherwise every firmware install call turns into noise.');
  const start = src.indexOf('async function handleSaveSchema');
  assert(start !== -1, 'handleSaveSchema not found.');
  const nextFn = src.indexOf('\nasync function ', start + 1);
  const body = src.slice(start, nextFn === -1 ? src.length : nextFn);
  assert(/reconcilePrimaryPropertyForConcept/.test(body),
    'handleSaveSchema must invoke the extracted reconcile after regenerating the schema node (Option C lands — ' +
    'ADR 0002 Consequences (a) dissolved by ADR 0003 d8).');
  assert(/primaryProperty/.test(body),
    "handleSaveSchema's response must report the fold outcome as 'primaryProperty' (ADR 0003 d8).");
});

test('S7 (ADR d9): the hygiene taxonomy grows deliberately — classifyDecomposition exported, all four new kinds present, purity kept', () => {
  const src = safeRead(HYGIENE_CORE);
  assert(src, 'src/lib/brain/hygiene.js missing — story 2 regression.');
  for (const kind of ['dangling-parent-reference', 'decomposition-cycle', 'duplicate-slug', 'schema-unreadable']) {
    assert(src.includes(kind),
      `hygiene taxonomy kind '${kind}' not present (ADR 0003 d9) — the taxonomy must grow deliberately, ` +
      'not accidentally (ADR 0002 Consequences).');
  }
  const requires = [...src.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1]);
  assert(requires.length >= 1 && requires.every((s) => /(^|\/)goals$/.test(s)),
    `hygiene purity re-pin: only ./goals may be required (found ${short(requires)}) — story-2 S1 semantics.`);
});

test('S8 (ADR d10): the Goals view renders the tree — hint line verbatim, viable, disclosure glyph, navigation; no toggle tokens', () => {
  const src = safeRead(GOALS_PAGE);
  assert(src, 'ui/src/pages/brain/Goals.jsx missing — story 1 regression.');
  assert(src.includes(HINT_LINE),
    `the inline hint must be the design guide's sentence, byte-exact: "${HINT_LINE}" (AC 2).`);
  assert(/['"`>]viable['"`<]/.test(src),
    'the standing word "viable" must render in the view (AC 2) — story-1 S7 was amended to admit it.');
  assert(src.includes('▸'),
    'parent rows carry the disclosure glyph ▸ (design guide goal-row spec; AC 4).');
  assert(/useNavigate|<Link/.test(src),
    'rows must navigate to the Goal detail (story ruling: minimal detail in this story; AC 5).');
  assert(!/toggle|checkbox|switch/i.test(src),
    'story-1 S5b scans this file for toggle/checkbox/switch — use disclose/expand-family identifiers ' +
    '(ADR 0003 d10 token constraint).');
});

test('S9 (ADR d11): the minimal Goal detail — labels verbatim, hint for captured leaves, back link, gate, register clean', () => {
  const src = safeRead(DETAIL_PAGE);
  assert(src,
    'ui/src/pages/brain/GoalDetail.jsx does not exist yet — the minimal detail surface (ADR 0003 d11) is not implemented.');
  assert(src.includes(DONE_MEANS) && src.includes(STAYS_INSIDE),
    `the detail must label the two fields verbatim: "${DONE_MEANS}" / "${STAYS_INSIDE}" (AC 5; wireframe §2).`);
  assert(src.includes(HINT_LINE),
    'a captured LEAF missing either field shows the verbatim hint line on the detail too (ADR 0003 d11).');
  assert(/part of/.test(src),
    'the metadata line carries the wireframe\'s parent context: part of "{parent}" (AC 5).');
  assert(/['"`]\/tapestry\/goals['"`]|to=\{?['"`]\/tapestry\/goals/.test(src) || /← Goals/.test(src),
    'the detail opens with a back link to the Goals view (wireframe §2; responsive rule 768–1024px).');
  assert(/classification\s*===\s*['"`]owner['"`]/.test(src) && /['"`]admin['"`]/.test(src),
    'the detail is owner-gated with the platform pair-check, like Goals.jsx (ADR 0003 d11).');
  assert(!/nostrPublish|publishEverywhere|publishToRelays/.test(src),
    'no publish machinery in the detail page (ADR 0001 d7 / event-tagging 0002).');
  assert(!/\b[0-9a-f]{64}\b/i.test(src),
    'no hardcoded 64-hex pubkey in the detail page (house rule).');
  // Jargon guard over visible strings — story-1 S8 covers only Goals.jsx.
  const visible = [
    ...[...src.matchAll(/'([^'\\\n]*)'/g)].map((m) => m[1]),
    ...[...src.matchAll(/"([^"\\\n]*)"/g)].map((m) => m[1]),
    ...[...src.matchAll(/`([^`]*)`/g)].map((m) => m[1]),
    ...[...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]),
  ].join('\n');
  for (const w of ['superset', 'pubkey', 'payload', 'concept header', 'acceptance criteria', 'lease']) {
    assert(!new RegExp(`\\b${w}\\b`, 'i').test(visible),
      `banned jargon "${w}" found in owner-visible text of GoalDetail.jsx (style guide; AC 6).`);
  }
});

test('S10 (ADR d11): the detail route is registered — goals/:slug under /tapestry', () => {
  const app = safeRead(APP);
  assert(/['"`]goals\/:slug['"`]/.test(app),
    'App.jsx must register the goals/:slug child route (ADR 0003 implementation notes).');
  assert(/GoalDetail/.test(app),
    'App.jsx must import and mount GoalDetail.');
});

test('S11 (sentinel — Amends discipline): ADR 0002 carries the reciprocal Amended-by pointer', () => {
  const src = safeRead(ADR_0002);
  assert(src, 'ADR 0002 missing — repository regression.');
  assert(/\*\*Amended by:\*\*\s*ADR 0003/.test(src),
    'ADR 0002\'s header must point at ADR 0003 (the 0027/0028/0029 amendment convention) — a later architect ' +
    'reading 0002 d4 alone would rebuild against the superseded phrasing.');
});

test('S12 (sentinel — house rule): no hardcoded 64-hex pubkey in the story\'s touched server files', () => {
  for (const f of [GOALS_CORE, HYGIENE_CORE, BRAIN_API, NORMALIZE_INDEX]) {
    const src = safeRead(f);
    assert(src, `${path.relative(ROOT, f)} missing.`);
    assert(!/\b[0-9a-f]{64}\b/i.test(src),
      `${path.relative(ROOT, f)} contains a 64-hex literal — the TA pubkey is per-deployment and must be ` +
      'resolved at runtime (house rule; PRD §7.8).');
  }
});

/* ══════════════ H-class — live local stack (SKIP when absent) ══════════════ */

test('H1 (ADR d13): the goal schema declares optional deliverable, boundary, parent; required set unchanged', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const ta = getTaPubkey();
  const node = loopbackGetJson(`/api/concept-graph/node/${encodeURIComponent(`39999:${ta}:tapestry-owner-goal-schema`)}`);
  assert(node && node.success !== false, `could not fetch the goal schema node (got ${short(node)}).`);
  const jsonTag = (node.node?.tags || []).find((t) => t.type === 'json');
  assert(jsonTag, 'the schema node must carry a json tag.');
  const inner = JSON.parse(jsonTag.value)?.jsonSchema?.properties?.tapestryOwnerGoal;
  assert(inner && inner.properties, `unexpected schema shape (got ${short(jsonTag.value, 400)}).`);
  for (const f of ['deliverable', 'boundary', 'parent']) {
    assert(inner.properties[f],
      `schema extension not applied: tapestryOwnerGoal.properties.${f} missing — the one-time save-schema step ` +
      '(ADR 0003 d13; auto-reconciling under the d8 fold) has not run. Undeclared fields get silently dropped ' +
      'by the element editor.');
  }
  const required = (inner.required || []).slice().sort();
  assert(JSON.stringify(required) === JSON.stringify(['description', 'name', 'slug']),
    `required must stay exactly [name, slug, description] — the new fields are OPTIONAL (got ${short(inner.required)}).`);
});

test('H2 (sentinel — AC 6): the hygiene check is green — before AND after the schema extension (the fold\'s live proof)', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackGetJson('/api/brain/hygiene');
  assert(r && r.success === true && r.sound === true && Array.isArray(r.problems) && r.problems.length === 0,
    `the hygiene check must stay green (AC 6; PRD §10). If property-record-drift is listed after the d13 ` +
    `schema extension, the d8 save-schema fold did not reconcile. Got: ${short(r, 500)}.`);
});

test('H3 (AC 1/AC 2/AC 3): create-child-goal round-trip — child records parent durably; viable child; parent never viable', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  fixturesArmed = true; // arm teardown before any write
  preCleanFixtures();
  // Parent fixture rides the story-1 capture contract (top-level goals are
  // create-element's lane; carrying deliverable+boundary makes AC 3 provable).
  const parentCreated = loopbackPostJson('/api/normalize/create-element', {
    concept: 'tapestry owner goal', name: FIX_PARENT_NAME, json: FIX_PARENT_JSON,
  });
  assert(parentCreated && parentCreated.success === true,
    `create-element rejected the parent fixture (got ${short(parentCreated, 400)}).`);
  const childCreated = loopbackPostJson('/api/normalize/create-child-goal', {
    parent: FIX_PARENT_SLUG,
    name: FIX_CHILD_NAME,
    statement: 'a session-sized piece of the parent fixture',
    deliverable: 'one green harness run',
    boundary: 'the test fixtures only',
    origin: 'harness test, in conversation',
    capturedOn: '2026-07-23',
  });
  assert(childCreated && childCreated.success === true && childCreated.result === 'created',
    `create-child-goal must answer {success:true, result:'created', …} (got ${short(childCreated, 400)}).`);
  assert(childCreated.element && childCreated.element.slug === FIX_CHILD_SLUG,
    `the created child must carry its derived slug (got ${short(childCreated.element)}).`);
  // READ-BACK is the assertion (publishToStrfry silent-drop mitigation).
  const goals = getGoals();
  const parent = goals.find((g) => g.name === FIX_PARENT_NAME);
  const child = goals.find((g) => g.name === FIX_CHILD_NAME);
  assert(parent && child, 'both fixtures must read back through GET /api/brain/goals (AC 1 durability).');
  assert(child.parent === FIX_PARENT_SLUG,
    `the child's parent reference must read back (got ${short(child.parent)}).`);
  assert(child.parentUuid === parent.uuid,
    `the child must resolve to its parent's uuid (got ${short(child.parentUuid)}, expected ${short(parent.uuid)}).`);
  assert(child.standing === 'viable',
    `a LEAF with deliverable + boundary derives viable (AC 2); got ${short(child.standing)}.`);
  assert(parent.hasChildren === true,
    'the parent must report hasChildren after the child lands.');
  assert(parent.standing === 'captured',
    `AC 3 live: the parent carries BOTH fields yet has a child — standing must be captured, never viable ` +
    `(got ${short(parent.standing)}).`);
});

test('H4 (AC 5 + adoption): update-goal-intent — sharpen to viable, capturedOn backfilled, then adopt under the parent', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  fixturesArmed = true;
  const adopteeCreated = loopbackPostJson('/api/normalize/create-element', {
    concept: 'tapestry owner goal', name: FIX_ADOPTEE_NAME, json: FIX_ADOPTEE_JSON,
  });
  assert(adopteeCreated && adopteeCreated.success === true,
    `create-element rejected the adoptee fixture (got ${short(adopteeCreated, 400)}).`);
  const sharpened = loopbackPostJson('/api/normalize/update-goal-intent', {
    goal: FIX_ADOPTEE_SLUG,
    deliverable: 'an adoptee that turns viable',
    boundary: 'fixtures only',
  });
  assert(sharpened && sharpened.success === true && sharpened.result === 'updated',
    `update-goal-intent must answer {success:true, result:'updated', …} (got ${short(sharpened, 400)}).`);
  let adoptee = getGoals().find((g) => g.name === FIX_ADOPTEE_NAME);
  assert(adoptee, 'the adoptee must still read back after the intent update.');
  assert(adoptee.deliverable === 'an adoptee that turns viable' && adoptee.boundary === 'fixtures only',
    `the owner's words must read back exactly (AC 5); got ${short([adoptee.deliverable, adoptee.boundary])}.`);
  assert(adoptee.standing === 'viable',
    `a leaf given both fields derives viable on read (AC 2); got ${short(adoptee.standing)}.`);
  assert(typeof adoptee.capturedOn === 'string' && adoptee.capturedOn,
    'the d7 backfill must have pinned capturedOn during the update — the fixture was created WITHOUT one, and ' +
    `a re-sign without backfill silently moves capture dates (got ${short(adoptee.capturedOn)}).`);
  const adopted = loopbackPostJson('/api/normalize/update-goal-intent', {
    goal: FIX_ADOPTEE_SLUG, parent: FIX_PARENT_SLUG,
  });
  assert(adopted && adopted.success === true && adopted.result === 'updated',
    `adoption of a parentless goal must succeed (gate ruling; got ${short(adopted, 400)}).`);
  adoptee = getGoals().find((g) => g.name === FIX_ADOPTEE_NAME);
  const parent = getGoals().find((g) => g.name === FIX_PARENT_NAME);
  assert(adoptee.parent === FIX_PARENT_SLUG && parent && adoptee.parentUuid === parent.uuid,
    `the adoption must read back durably (got parent=${short(adoptee.parent)}, parentUuid=${short(adoptee.parentUuid)}).`);
  assert(adoptee.standing === 'viable',
    'the adoptee stays a viable LEAF after adoption (it has both fields and no children).');
});

test('H5 (AC 1): the refusal matrix — every invalid write refused loudly with NOTHING written', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const before = goalSetSnapshot();
  const cases = [
    ['create-child under a nonexistent parent', '/api/normalize/create-child-goal',
      { parent: 'no-such-parent-slug', name: 'harness decomposition never-created goal', statement: 'x' }, /parent/i],
    ['create-child whose name collides by slug/d-tag (case variant)', '/api/normalize/create-child-goal',
      { parent: FIX_PARENT_SLUG, name: 'Harness Decomposition PARENT Goal', statement: 'x' }, /collid|exist|taken|slug|name/i],
    ['intent update on a nonexistent goal', '/api/normalize/update-goal-intent',
      { goal: 'no-such-goal-slug', deliverable: 'x' }, /found|goal/i],
    ['self-parenting', '/api/normalize/update-goal-intent',
      { goal: FIX_PARENT_SLUG, parent: FIX_PARENT_SLUG }, /self|itself|own/i],
    ['placing a goal under its own descendant (cycle)', '/api/normalize/update-goal-intent',
      { goal: FIX_PARENT_SLUG, parent: FIX_CHILD_SLUG }, /cycle|descend/i],
    ['adopting a goal that already has a parent', '/api/normalize/update-goal-intent',
      { goal: FIX_CHILD_SLUG, parent: FIX_ADOPTEE_SLUG }, /already|parent/i],
    ['empty-string value (the clearing backdoor)', '/api/normalize/update-goal-intent',
      { goal: FIX_PARENT_SLUG, deliverable: '   ' }, /empty|value|blank/i],
  ];
  for (const [label, route, body, errRe] of cases) {
    const r = loopbackPostJson(route, body);
    assert(r && r.success === false,
      `${label}: must be REFUSED (success:false), got ${short(r, 300)}.`);
    assert(typeof r.error === 'string' && errRe.test(r.error),
      `${label}: the refusal must be loud and named (error matching ${errRe}); got "${short(r.error)}".`);
  }
  const after = goalSetSnapshot();
  assert(before === after,
    `AC 1 violated: a refused write changed the goal set.\n  before:\n${before}\n  after:\n${after}`);
});

test('H6 (sentinel — AC 4/AC 6): the three legacy goals stay intact, captured, at the root', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const goals = getGoals();
  for (const legacy of LEGACY_GOAL_NAMES) {
    const g = goals.find((x) => x.name === legacy);
    assert(g, `legacy goal "${legacy}" missing from the Goals read (AC 6: every pre-story goal survives).`);
    assert(g.standing === 'captured',
      `legacy goal "${legacy}" must stay captured (un-sharpened leaf); got ${short(g.standing)}.`);
    assert(!g.parent && !g.parentUuid,
      `legacy goal "${legacy}" must stay at the root — this suite never mutates the real goals (got parent=${short(g.parent)}).`);
  }
});

test('H7 (gates): host-side POSTs to both new routes are refused by the default-deny middleware with 401', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  for (const route of ['/api/normalize/create-child-goal', '/api/normalize/update-goal-intent']) {
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
    'src/api/brain/index.js must keep both read routes — story 3 extends their payloads (ADR 0003 d5/d9).');
});

test('R2: the byte-pinned untouchables stay free of this story', () => {
  for (const f of [RELATIONSHIPS, PROBE]) {
    const src = safeRead(f);
    assert(src, `${path.relative(ROOT, f)} missing — relationship-primitives regression.`);
    assert(!/create-child-goal|update-goal-intent|classifyDecomposition/.test(src),
      `${path.relative(ROOT, f)} must not be touched by this story (byte-pinned untouchable; ADR 0003).`);
  }
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- break-a-goal-into-pieces tests (epic second-brain, Story 3) ---');
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
  console.log(`\nbreak-a-goal-into-pieces: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
