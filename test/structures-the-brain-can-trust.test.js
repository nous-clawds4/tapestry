/**
 * Story 2 (epic: second-brain) — Structures the brain can trust.
 *
 * Story: engineering-team/stories/second-brain/2-structures-the-brain-can-trust.md
 * ADR:   engineering-team/decisions/second-brain/0002-hygiene-check-and-primary-property-reconcile.md
 *
 * Test classes (ADR "Test-class guidance", per test-hermeticity-ci/0001):
 *
 *   U-class (EXECUTED, stack-free, always gates CI) — the pure hygiene core
 *     src/lib/brain/hygiene.js over SYNTHETIC rows. This is the primary AC-4
 *     coverage: every defect kind is provoked without touching any live graph.
 *     The contracts pinned here (object-parameter signatures, problem record
 *     shape {concept, subject, kind, detail}) are the Tester's lane per the
 *     ADR's "exports ≈" latitude.
 *
 *   S-class (source assertions, stack-free) — hygiene-core purity (requires
 *     only ./goals); the brain module's new route, gate, import-surface re-pin,
 *     and structural read-only-ness; the reconcile handler's presence, gate,
 *     regenerateJson mechanism, and discriminated results; no hardcoded TA
 *     pubkey anywhere touched.
 *
 *   H-class (live local stack, per-test SKIP when unreachable) — the check is
 *     green and deterministic on the real graph (AC 1/AC 3); the primary-
 *     property drift is livedly fixed (AC 3); the reconcile round-trip
 *     preserves the goal set (AC 5) and is idempotent; host-side callers get
 *     the gate answers (GET → in-handler 403; POST → middleware 401).
 *     H5 exercises the real reconcile against the live concept — that IS the
 *     story's cleanup, idempotent by contract, so no teardown exists or is
 *     needed: the operation converges to the correct state.
 *
 *   H3 is a live SENTINEL (passes before AND after implementation): the four
 *     adjudicated membership edges — falsely accused by the queue, verified
 *     legitimate at planning — are present and must remain present (AC 2).
 *     No AC-4 defect is ever INTRODUCED into the live graph; synthetic rows
 *     cover the taxonomy (ADR decision: the throwaway-concept H path is
 *     declined — the U-class rows are the coverage, without fixture risk).
 *
 *   R-class (regression sentinels, stack-free, pass before AND after) — the
 *     goals core this checker reuses, the normalize routes the bootstrap
 *     rides, and the byte-pinned untouchables staying free of this story.
 *
 * ALL U tests and S1–S6 FAIL until the feature lands (the hygiene core and
 * both surfaces do not exist yet); H1/H2/H4/H5/H6 FAIL against a running
 * stack (routes 404, drift live). H tests SKIP when the stack is absent
 * (CI's stack-free job). That is the point.
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

const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

// The two work-item concepts — the story's confirmed scope (planning gate).
const GOAL_SLUG = 'tapestry-owner-goal';
const PROJECT_SLUG = 'project-for-the-engineering-team';

// The six per-concept machinery relationships every sound runtime concept
// carries INTO its header (verified live on both work-item concepts,
// planning recon 2026-07-23).
const MACHINERY_IN = [
  'IS_THE_JSON_SCHEMA_FOR',
  'IS_THE_PRIMARY_PROPERTY_FOR',
  'IS_THE_PROPERTIES_SET_FOR',
  'IS_THE_CONCEPT_GRAPH_FOR',
  'IS_THE_CORE_GRAPH_FOR',
  'IS_THE_PROPERTY_TREE_GRAPH_FOR',
];

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function short(x, n = 260) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}

const HYGIENE_MISSING =
  'src/lib/brain/hygiene.js does not exist yet — the pure hygiene core (ADR 0002 ' +
  'decision 2 / implementation notes) is not implemented.';
function loadHygiene() {
  if (!fs.existsSync(HYGIENE_CORE)) throw new Error(HYGIENE_MISSING);
  try { return require(HYGIENE_CORE); }
  catch (e) { throw new Error(`src/lib/brain/hygiene.js exists but failed to require as CommonJS: ${e.message}`); }
}
function loadGoalsCore() {
  if (!fs.existsSync(GOALS_CORE)) throw new Error('src/lib/brain/goals.js missing — story 1 regression.');
  return require(GOALS_CORE);
}

/* ── synthetic fixtures (U-class) ─────────────────────────────────────── */

const TA = 'synthetic-ta'; // handles are opaque strings to the core — no hex needed
function header(slug) { return `39998:${TA}:${slug}`; }
function core39999(slug) { return `39999:${TA}:${slug}`; }

// The verified-live sound wiring of a work-item concept header, as synthetic
// edge rows: out HAS_TAG ×6 + exactly one IS_THE_CONCEPT_FOR to the concept's
// superset; in: the universal concept-header-superset membership + the six
// machinery relationships.
function soundHeaderEdges(slug) {
  const edges = [];
  for (let i = 0; i < 6; i++) {
    edges.push({ direction: 'out', rel: 'HAS_TAG', otherUuid: `tag-${slug}-${i}`, otherLabels: ['NostrEventTag'] });
  }
  edges.push({
    direction: 'out', rel: 'IS_THE_CONCEPT_FOR',
    otherUuid: core39999(`${slug}-superset`), otherLabels: ['NostrEvent', 'ListItem', 'Superset'],
  });
  edges.push({
    direction: 'in', rel: 'HAS_ELEMENT',
    otherUuid: core39999('concept-header-superset'), otherLabels: ['NostrEvent', 'ListItem', 'Superset'],
  });
  for (const rel of MACHINERY_IN) {
    edges.push({
      direction: 'in', rel,
      otherUuid: core39999(`${slug}-machinery-${rel.toLowerCase()}`), otherLabels: ['NostrEvent', 'ListItem'],
    });
  }
  return edges;
}

function goalElementRow(overrides = {}) {
  return {
    uuid: core39999('some-goal-1903378a'),
    name: 'some goal',
    createdAt: 1784391581,
    json: JSON.stringify({ tapestryOwnerGoal: {
      name: 'some goal', slug: 'some-goal', description: 'a statement', origin: 'owner', capturedOn: '2026-07-23',
    } }),
    hasEdge: true,
    hasZTag: true,
    ...overrides,
  };
}

// The extended goal schema's concept-object (post story-1 save-schema shape).
function extendedSchemaObject() {
  return {
    type: 'object',
    required: ['name', 'slug', 'description'],
    'x-tapestry': { unique: ['name', 'slug'] },
    properties: {
      name: { type: 'string', name: 'name', slug: 'name', title: 'Name', description: 'The name' },
      slug: { type: 'string', name: 'slug', slug: 'slug', title: 'Slug', description: 'The slug' },
      description: { type: 'string', name: 'description', slug: 'description', title: 'Description', description: 'The description' },
      origin: { type: 'string', description: 'where this goal came from' },
      capturedOn: { type: 'string', description: 'the date the goal was captured' },
    },
  };
}

// The primary-property node's property section in its pre-reconcile (drifted)
// and post-reconcile (agreeing, stripped-to-{type}) shapes.
function driftedPropertySection() {
  return {
    key: 'tapestryOwnerGoal', title: 'Tapestry Owner Goal', type: 'object',
    required: ['name', 'slug', 'description'],
    properties: { name: { type: 'string' }, slug: { type: 'string' }, description: { type: 'string' } },
  };
}
function reconciledPropertySection() {
  const s = driftedPropertySection();
  s.properties.origin = { type: 'string' };
  s.properties.capturedOn = { type: 'string' };
  return s;
}

/* ── live-stack helpers (H-class; the story-1 house pattern) ──────────── */

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

function goalSetSnapshot() {
  const r = loopbackGetJson('/api/brain/goals');
  assert(r && r.success === true && Array.isArray(r.goals),
    `GET /api/brain/goals must answer {success:true, goals:[…]} (got ${short(r)}).`);
  return r.goals
    .map((g) => [g.uuid, g.name, g.statement, g.origin, g.capturedOn].join('|'))
    .sort()
    .join('\n');
}

/* ══════════════ U-class — the pure hygiene core (EXECUTED) ══════════════ */

test('U1 (contract): hygiene core exports classifyHeaderEdges, classifyElementConsistency, comparePropertyRecord, assembleReport', () => {
  const hygiene = loadHygiene();
  for (const fn of ['classifyHeaderEdges', 'classifyElementConsistency', 'comparePropertyRecord', 'assembleReport']) {
    assert(typeof hygiene[fn] === 'function',
      `src/lib/brain/hygiene.js must export ${fn}() (ADR 0002 decision 2 / implementation notes).`);
  }
});

test('U2 (AC 1/AC 2): the verified-live sound header wiring classifies to zero problems — incoming memberships are sound', () => {
  const hygiene = loadHygiene();
  const problems = hygiene.classifyHeaderEdges({
    concept: GOAL_SLUG, headerUuid: header(GOAL_SLUG), edges: soundHeaderEdges(GOAL_SLUG),
  });
  assert(Array.isArray(problems),
    'classifyHeaderEdges must return an array of problem records.');
  assert(problems.length === 0,
    `the live-verified sound wiring (incl. the INCOMING concept-header-superset membership the queue ` +
    `falsely flagged) must classify to zero problems — direction-aware adjudication is AC 2. Got: ${short(problems)}.`);
});

test('U3 (AC 4 kind: wrong-direction-membership): an OUTGOING HAS_ELEMENT on a header is reported specifically', () => {
  const hygiene = loadHygiene();
  const edges = soundHeaderEdges(GOAL_SLUG);
  edges.push({
    direction: 'out', rel: 'HAS_ELEMENT',
    otherUuid: core39999('concept-header-superset'), otherLabels: ['NostrEvent', 'ListItem', 'Superset'],
  });
  const problems = hygiene.classifyHeaderEdges({ concept: GOAL_SLUG, headerUuid: header(GOAL_SLUG), edges });
  assert(problems.length === 1,
    `exactly one problem expected for one wrong-direction edge (got ${problems.length}: ${short(problems)}).`);
  const p = problems[0];
  assert(p.kind === 'wrong-direction-membership',
    `kind must be 'wrong-direction-membership' (got ${short(p.kind)}) — headers are never containers.`);
  assert(p.concept === GOAL_SLUG && p.subject === header(GOAL_SLUG),
    `the problem must name the specific structure: concept + header uuid as subject (got ${short(p)}).`);
  assert(typeof p.detail === 'string' && p.detail.includes('HAS_ELEMENT'),
    `detail must name the offending relationship, not a generic failure (AC 4). Got: ${short(p.detail)}.`);
});

test('U4 (AC 4 kind: machinery-incomplete): missing and duplicated expected wiring are each reported by name', () => {
  const hygiene = loadHygiene();
  // (a) one machinery relationship missing
  const missing = soundHeaderEdges(GOAL_SLUG).filter((e) => e.rel !== 'IS_THE_JSON_SCHEMA_FOR');
  const p1 = hygiene.classifyHeaderEdges({ concept: GOAL_SLUG, headerUuid: header(GOAL_SLUG), edges: missing });
  assert(p1.length === 1 && p1[0].kind === 'machinery-incomplete',
    `a missing machinery edge must yield one 'machinery-incomplete' problem (got ${short(p1)}).`);
  assert(p1[0].detail.includes('IS_THE_JSON_SCHEMA_FOR'),
    `detail must name WHICH relationship is missing (AC 4 specificity). Got: ${short(p1[0].detail)}.`);
  // (b) duplicated IS_THE_CONCEPT_FOR (a concept has exactly one superset)
  const dup = soundHeaderEdges(GOAL_SLUG);
  dup.push({
    direction: 'out', rel: 'IS_THE_CONCEPT_FOR',
    otherUuid: core39999('another-superset'), otherLabels: ['NostrEvent', 'ListItem', 'Superset'],
  });
  const p2 = hygiene.classifyHeaderEdges({ concept: GOAL_SLUG, headerUuid: header(GOAL_SLUG), edges: dup });
  assert(p2.length === 1 && p2[0].kind === 'machinery-incomplete' && p2[0].detail.includes('IS_THE_CONCEPT_FOR'),
    `a duplicated IS_THE_CONCEPT_FOR must be reported as machinery-incomplete naming the relationship (got ${short(p2)}).`);
});

test('U5 (AC 4 kind: membership-declaration-mismatch): edge/declaration disagreement is reported per element, each side named', () => {
  const hygiene = loadHygiene();
  const consistent = goalElementRow();
  const edgeOnly = goalElementRow({ uuid: core39999('edge-only-1903378a'), name: 'edge only', hasZTag: false });
  const tagOnly = goalElementRow({ uuid: core39999('tag-only-1903378a'), name: 'tag only', hasEdge: false });
  const problems = hygiene.classifyElementConsistency({
    concept: GOAL_SLUG, elements: [consistent, edgeOnly, tagOnly], parseRecord: null,
  });
  assert(problems.length === 2,
    `exactly the two inconsistent elements must be flagged (got ${problems.length}: ${short(problems)}).`);
  for (const p of problems) {
    assert(p.kind === 'membership-declaration-mismatch',
      `kind must be 'membership-declaration-mismatch' (got ${short(p.kind)}).`);
  }
  const subjects = problems.map((p) => p.subject).sort();
  assert(subjects.join(',') === [edgeOnly.uuid, tagOnly.uuid].sort().join(','),
    `each problem must name its element as subject (got ${short(subjects)}).`);
  const details = problems.map((p) => p.detail).join(' ⇄ ');
  assert(problems[0].detail !== problems[1].detail,
    `the two mismatch directions (edge-without-declaration vs declaration-without-edge — the reinstall-return ` +
    `signature) must be distinguished in detail, not reported identically (AC 4). Got: ${short(details)}.`);
});

test('U6 (AC 4 kind: unreadable-record): a goal-concept element the shared core cannot read is flagged; sibling concept skips record classification', () => {
  const hygiene = loadHygiene();
  const goals = loadGoalsCore();
  const unreadable = goalElementRow({
    uuid: core39999('not-a-goal-1903378a'), name: 'not a goal', json: '{"somethingElse":{}}',
  });
  const withParse = hygiene.classifyElementConsistency({
    concept: GOAL_SLUG, elements: [unreadable], parseRecord: goals.parseGoalRow,
  });
  assert(withParse.length === 1 && withParse[0].kind === 'unreadable-record',
    `an element parseGoalRow classifies out must yield one 'unreadable-record' problem — the check and the ` +
    `Goals view share ONE classification (handoff-binding). Got: ${short(withParse)}.`);
  assert(withParse[0].subject === unreadable.uuid,
    `the problem must name the element (got ${short(withParse[0])}).`);
  const withoutParse = hygiene.classifyElementConsistency({
    concept: PROJECT_SLUG, elements: [unreadable], parseRecord: null,
  });
  assert(withoutParse.length === 0,
    `with parseRecord null (the sibling concept), record classification is skipped — goal-record rules must ` +
    `not leak onto project elements. Got: ${short(withoutParse)}.`);
});

test('U7 (AC 3 / AC 4 kind: property-record-drift): schema-vs-property-record comparison on key set, required, and per-key type only', () => {
  const hygiene = loadHygiene();
  // (a) the live drift: origin/capturedOn missing from the property record
  const drift = hygiene.comparePropertyRecord({
    concept: GOAL_SLUG, schemaObject: extendedSchemaObject(), propertySection: driftedPropertySection(),
  });
  assert(drift.length === 1 && drift[0].kind === 'property-record-drift',
    `the lagging property record must yield one 'property-record-drift' problem (got ${short(drift)}).`);
  assert(drift[0].detail.includes('origin') && drift[0].detail.includes('capturedOn'),
    `detail must name the missing keys specifically (AC 4). Got: ${short(drift[0].detail)}.`);
  // (b) agreement with cosmetic differences → no problem (stripped {type} vs rich schema objects)
  const agree = hygiene.comparePropertyRecord({
    concept: GOAL_SLUG, schemaObject: extendedSchemaObject(), propertySection: reconciledPropertySection(),
  });
  assert(agree.length === 0,
    `key set + required + per-key type agree (the create-concept stripped convention) — cosmetic per-property ` +
    `extras (title/description) must NOT be defects. Got: ${short(agree)}.`);
  // (c) per-key type mismatch is a defect naming the key
  const typeMismatch = reconciledPropertySection();
  typeMismatch.properties.description = { type: 'number' };
  const p3 = hygiene.comparePropertyRecord({
    concept: GOAL_SLUG, schemaObject: extendedSchemaObject(), propertySection: typeMismatch,
  });
  assert(p3.length === 1 && p3[0].kind === 'property-record-drift' && p3[0].detail.includes('description'),
    `a per-key type disagreement must be reported naming the key (got ${short(p3)}).`);
  // (d) required-list disagreement is a defect
  const reqMismatch = reconciledPropertySection();
  reqMismatch.required = ['name', 'description'];
  const p4 = hygiene.comparePropertyRecord({
    concept: GOAL_SLUG, schemaObject: extendedSchemaObject(), propertySection: reqMismatch,
  });
  assert(p4.length === 1 && p4[0].kind === 'property-record-drift',
    `a required-list disagreement must be reported as drift (got ${short(p4)}).`);
  // (e) a missing/unreadable property section is a drift-class problem, never a throw
  const p5 = hygiene.comparePropertyRecord({
    concept: GOAL_SLUG, schemaObject: extendedSchemaObject(), propertySection: null,
  });
  assert(Array.isArray(p5) && p5.length === 1 && p5[0].kind === 'property-record-drift',
    `a null property section must classify as drift, not throw (got ${short(p5)}).`);
});

test('U8 (AC 1): assembleReport is deterministic — same problems in any input order produce identical output; sound reflects problems', () => {
  const hygiene = loadHygiene();
  const pA = { concept: GOAL_SLUG, subject: header(GOAL_SLUG), kind: 'wrong-direction-membership', detail: 'x HAS_ELEMENT y' };
  const pB = { concept: GOAL_SLUG, subject: core39999('e-1903378a'), kind: 'membership-declaration-mismatch', detail: 'edge without declaration' };
  const pC = { concept: PROJECT_SLUG, subject: core39999('pp'), kind: 'property-record-drift', detail: 'missing k' };
  const r1 = hygiene.assembleReport([
    { concept: GOAL_SLUG, present: true, elements: 3, problems: [pA, pB] },
    { concept: PROJECT_SLUG, present: true, elements: 5, problems: [pC] },
  ]);
  const r2 = hygiene.assembleReport([
    { concept: PROJECT_SLUG, present: true, elements: 5, problems: [pC] },
    { concept: GOAL_SLUG, present: true, elements: 3, problems: [pB, pA] },
  ]);
  assert(r1 && r1.sound === false && Array.isArray(r1.problems) && r1.problems.length === 3,
    `a report with problems must be sound:false carrying all problems (got ${short(r1)}).`);
  assert(JSON.stringify(r1.problems) === JSON.stringify(r2.problems),
    'the problems list must be deterministically ordered (concept, kind, subject) regardless of input order — ' +
    'two runs on an unchanged graph must report identically (AC 1).');
  const clean = hygiene.assembleReport([
    { concept: GOAL_SLUG, present: true, elements: 3, problems: [] },
    { concept: PROJECT_SLUG, present: true, elements: 5, problems: [] },
  ]);
  assert(clean.sound === true && clean.problems.length === 0,
    `zero problems must report sound:true (got ${short(clean)}).`);
});

test('U9 (AC 6): an absent concept is nothing-to-check — sound stays true, checked says present:false', () => {
  const hygiene = loadHygiene();
  const r = hygiene.assembleReport([
    { concept: GOAL_SLUG, present: false },
    { concept: PROJECT_SLUG, present: false },
  ]);
  assert(r.sound === true,
    `absence is a state, not a defect (PRD §5.9; AC 6) — sound must stay true (got ${short(r)}).`);
  assert(r.problems.length === 0, `no problems may be reported for absent concepts (got ${short(r.problems)}).`);
  assert(Array.isArray(r.checked) && r.checked.length === 2 && r.checked.every((c) => c.present === false),
    `checked must record each absent concept with present:false — the nothing-to-check answer (got ${short(r.checked)}).`);
});

/* ══════════════ S-class — source assertions (stack-free) ══════════════ */

test('S1 (purity): the hygiene core requires only ./goals — nothing else', () => {
  const src = safeRead(HYGIENE_CORE);
  assert(src, HYGIENE_MISSING);
  const requires = [...src.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1]);
  assert(requires.length >= 1 && requires.every((s) => /(^|\/)goals$/.test(s)),
    `src/lib/brain/hygiene.js may require ONLY the goals core (the shared classification surface) — ` +
    `found requires: ${short(requires)}. Purity keeps the defect taxonomy U-testable and CI-stack-free (ADR 0002).`);
  assert(!/\bimport\s/.test(src), 'no ESM imports — the core is CJS like its sibling.');
});

test('S2 (ADR d1): the brain module registers GET /api/brain/hygiene behind the in-handler gate', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(/\/api\/brain\/hygiene/.test(src),
    'the brain module must register GET /api/brain/hygiene (ADR 0002 decision 1) — not implemented yet.');
  const gates = (src.match(/isOwner\s*\(\s*req\s*\)/g) || []).length;
  assert(gates >= 2 && /localTrusted/.test(src) && /403/.test(src),
    `both brain handlers (goals + hygiene) must carry the in-handler gate isOwner(req) || req.localTrusted → 403 ` +
    `(found ${gates} gate expression(s)); route-level requireOwner would 401 the loopback agent (ADR 0001/0002).`);
});

test('S3 (ADR d1): brain import surface re-pin — the 0001 four plus lib/brain/hygiene, nothing else', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  const requires = [...src.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1]);
  assert(requires.some((s) => /lib\/brain\/hygiene$/.test(s)),
    'the brain module must require ../../lib/brain/hygiene — the checker core (ADR 0002) is not wired yet.');
  // second-brain #4 (ADR 0004 d5) adds lib/brain/resources — the per-goal
  // endpoint's freshness core; this re-pin admits the six, nothing else.
  const allowed = [/neo4j-driver$/, /middleware\/auth$/, /assistantKeys$/, /lib\/brain\/goals$/, /lib\/brain\/hygiene$/, /lib\/brain\/resources$/];
  for (const spec of requires) {
    assert(allowed.some((re) => re.test(spec)),
      `import surface violation: require('${spec}') — the brain module allows only lib/neo4j-driver, ` +
      'middleware/auth, utils/assistantKeys, lib/brain/goals, lib/brain/hygiene, lib/brain/resources (ADR 0002 + ADR 0004 re-pins).');
  }
});

test('S4 (ADR d4, as amended by 0003 d8): the reconcile primitive — route, gate, regenerateJson mechanism, discriminated results', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/\/api\/normalize\/reconcile-primary-property/.test(src),
    'POST /api/normalize/reconcile-primary-property is not registered (ADR 0002 decision 4) — not implemented yet.');
  const start = src.indexOf('async function handleReconcilePrimaryProperty');
  assert(start !== -1, 'handleReconcilePrimaryProperty not found in src/api/normalize/index.js.');
  const nextFn = src.indexOf('\nasync function ', start + 1);
  const body = src.slice(start, nextFn === -1 ? src.length : nextFn);
  assert(/isOwner\s*\(\s*req\s*\)/.test(body) && /localTrusted/.test(body) && /403/.test(body),
    'the reconcile handler must carry the explicit in-handler gate (isOwner(req) || req.localTrusted → 403) — ' +
    'the relationships.js template (security-auth-exposure discipline).');
  // Mechanism + discriminated results: ADR 0003 d8 extracts the post-gate body
  // into reconcilePrimaryPropertyForConcept (the save-schema fold). Accept the
  // tokens in the handler OR the extracted function, so this pin stays green
  // across the 0003 transition. (Amended in story-3 Test Design.)
  let mech = body;
  const exStart = src.indexOf('function reconcilePrimaryPropertyForConcept');
  if (exStart !== -1) {
    const exNext = src.indexOf('\nasync function ', exStart + 1);
    mech = body + src.slice(exStart, exNext === -1 ? src.length : exNext);
  }
  assert(/regenerateJson\s*\(/.test(mech),
    'the reconcile must ride regenerateJson() — the same sign/publish/import path save-schema uses (ADR decision 4).');
  assert(/already-consistent/.test(mech) && /reconciled/.test(mech),
    "the reconcile must answer discriminated results: 'reconciled' | 'already-consistent' (idempotency contract).");
});

test('S5 (house rule): no hardcoded 64-hex pubkey in the story\'s touched server files', () => {
  assert(fs.existsSync(HYGIENE_CORE), HYGIENE_MISSING);
  for (const f of [HYGIENE_CORE, BRAIN_API, NORMALIZE_INDEX]) {
    const src = safeRead(f);
    assert(!/\b[0-9a-f]{64}\b/i.test(src),
      `${path.relative(ROOT, f)} contains a 64-hex literal — the TA pubkey is per-deployment and must be ` +
      'resolved at runtime (CLAUDE.md house rule; PRD §7.8; AC 6).');
  }
});

test('S6 (ADR d1): the brain module — including the new hygiene surface — stays structurally read-only', () => {
  const src = safeRead(BRAIN_API);
  assert(src && /\/api\/brain\/hygiene/.test(src),
    'the hygiene route must exist in the brain module before read-only-ness is meaningful (see S2).');
  assert(!/child_process|execFile|exec\s*\(|strfry|publishToStrfry|regenerateJson|nostrPublish/.test(src),
    'the brain module must stay mutation- and strfry-free — the reconcile write lives in normalize, never here ' +
    '(ADR 0002 decision 1/4; the 0001 read/write separation).');
});

/* ══════════════ H-class — live local stack (SKIP when absent) ══════════════ */

test('H1 (AC 1/AC 3): GET /api/brain/hygiene is green on the live graph — both concepts present, zero problems', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackGetJson('/api/brain/hygiene');
  assert(r && r.success === true,
    `the hygiene endpoint must answer {success:true, …} (got ${short(r)}) — is the check surface deployed?`);
  assert(r.sound === true && Array.isArray(r.problems) && r.problems.length === 0,
    `the live graph must check green (AC 1; PRD §10 "hygiene check green"). sound=${short(r.sound)}; ` +
    `problems: ${short(r.problems, 500)}. If property-record-drift is listed, the reconcile cleanup (AC 3) has not run.`);
  assert(Array.isArray(r.checked) && r.checked.length === 2 && r.checked.every((c) => c.present === true),
    `checked must cover exactly the two work-item concepts, both present on this instance (got ${short(r.checked)}).`);
});

test('H2 (AC 1): two consecutive checks on an unchanged graph report identically', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const a = loopbackGetJson('/api/brain/hygiene');
  const b = loopbackGetJson('/api/brain/hygiene');
  assert(JSON.stringify(a) === JSON.stringify(b),
    `repeatability failure: two back-to-back checks answered differently.\n  first:  ${short(a, 300)}\n  second: ${short(b, 300)}`);
});

test('H3 (AC 2 sentinel — passes before AND after): the four adjudicated membership edges are present and stay present', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const ta = getTaPubkey();
  const pairs = [
    [`39999:${ta}:set-superset`, `39999:${ta}:${GOAL_SLUG}-superset`],
    [`39999:${ta}:superset-superset`, `39999:${ta}:${GOAL_SLUG}-superset`],
    [`39999:${ta}:concept-header-superset`, `39998:${ta}:${GOAL_SLUG}`],
    [`39999:${ta}:concept-header-superset`, `39998:${ta}:${PROJECT_SLUG}`],
  ];
  const r = loopbackPostJson('/api/neo4j/query', {
    cypher: 'UNWIND $pairs AS p MATCH (a {uuid: p[0]})-[:HAS_ELEMENT]->(b {uuid: p[1]}) RETURN count(*) AS found',
    params: { pairs },
  });
  assert(r && r.success !== false && Array.isArray(r.data),
    `directed edge query failed (got ${short(r)}).`);
  const found = r.data[0] && (r.data[0].found ?? r.data[0]['found']);
  assert(Number(found) === 4,
    `AC 2 violated: expected all 4 adjudicated membership edges present (the queue's falsely-accused edges are ` +
    `legitimate and must be RETAINED — deleting them was the falsified premise). Found ${short(found)}/4.`);
});

test('H4 (AC 3): the primary-property record agrees with the extended schema on the live instance', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const ta = getTaPubkey();
  const node = loopbackGetJson(`/api/concept-graph/node/${encodeURIComponent(`39999:${ta}:${GOAL_SLUG}-primary-property`)}`);
  assert(node && node.success !== false && node.node,
    `could not fetch the goal primary-property node (got ${short(node)}).`);
  const jsonTag = (node.node.tags || []).find((t) => t.type === 'json');
  assert(jsonTag, 'the primary-property node must carry a json tag.');
  const prop = JSON.parse(jsonTag.value).property;
  assert(prop && prop.properties,
    `unexpected primary-property shape (got ${short(jsonTag.value, 400)}).`);
  for (const k of ['origin', 'capturedOn']) {
    assert(prop.properties[k] && prop.properties[k].type === 'string',
      `AC 3: the property record still lags the schema — properties.${k} missing (the documented save-schema ` +
      `drift, ADR 0001 Consequences (a)). The reconcile cleanup has not landed. Got keys: ${short(Object.keys(prop.properties))}.`);
  }
  const req = (prop.required || []).slice().sort();
  assert(JSON.stringify(req) === JSON.stringify(['description', 'name', 'slug']),
    `required must stay exactly [name, slug, description] — origin/capturedOn are OPTIONAL (got ${short(prop.required)}).`);
});

test('H5 (AC 5 + idempotency): reconcile preserves the goal set exactly and answers already-consistent on repeat', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const before = goalSetSnapshot();
  const first = loopbackPostJson('/api/normalize/reconcile-primary-property', { concept: 'tapestry owner goal' });
  assert(first && first.success === true,
    `reconcile-primary-property must succeed for the goal concept (got ${short(first, 400)}).`);
  assert(first.result === 'reconciled' || first.result === 'already-consistent',
    `the reconcile must answer a discriminated result ('reconciled' | 'already-consistent'); got ${short(first.result)}.`);
  const after = goalSetSnapshot();
  assert(before === after,
    `AC 5 violated: the goal set changed across a reconcile.\n  before:\n${before}\n  after:\n${after}`);
  const second = loopbackPostJson('/api/normalize/reconcile-primary-property', { concept: 'tapestry owner goal' });
  assert(second && second.success === true && second.result === 'already-consistent',
    `a second reconcile with no schema change must answer 'already-consistent' (idempotency contract); got ${short(second)}.`);
});

test('H6 (gates): host-side GET gets the in-handler 403; host-side POST gets the middleware 401', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const g = await fetch(`${HOST_BASE}/api/brain/hygiene`, { signal: AbortSignal.timeout(5000) });
  assert(g.status === 403,
    `host :7778 is the remote caller class — the hygiene GET must answer the in-handler 403 ` +
    `(got ${g.status}${g.status === 404 ? ' — route not registered yet' : ''}).`);
  const gBody = await g.json().catch(() => null);
  assert(gBody && gBody.success === false,
    `the 403 must be structured {success:false} (got ${short(gBody)}).`);
  const p = await fetch(`${HOST_BASE}/api/normalize/reconcile-primary-property`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ concept: 'tapestry owner goal' }),
    signal: AbortSignal.timeout(5000),
  });
  assert(p.status === 401,
    `an unauthenticated remote mutation is refused by the default-deny middleware with 401 before the handler ` +
    `(security-auth-exposure/0002; relationship-primitives precedent). Got ${p.status}` +
    `${p.status === 404 ? ' — route not registered yet' : ''}.`);
});

/* ══════════════ R-class — regression sentinels (pass before AND after) ══════════════ */

test('R1: the goals core still exports the shared classification surface this checker reuses', () => {
  const goals = loadGoalsCore();
  assert(typeof goals.parseGoalRow === 'function',
    'src/lib/brain/goals.js must keep exporting parseGoalRow — the hygiene checker reuses it (handoff-binding; ADR 0001/0002).');
});

test('R2: the normalize routes the concept bootstrap rides are still registered', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/create-element/.test(src) && /save-schema/.test(src),
    'src/api/normalize/index.js must keep create-element and save-schema — the bootstrap sequence (create-concept → ' +
    'save-schema → reconcile → create-element) depends on them (ADR 0001 d1, 0002 d4).');
});

test('R3: the byte-pinned untouchables stay free of this story', () => {
  for (const f of [RELATIONSHIPS, PROBE]) {
    const src = safeRead(f);
    assert(src, `${path.relative(ROOT, f)} missing — relationship-primitives regression.`);
    assert(!/hygiene|reconcile-primary-property/.test(src),
      `${path.relative(ROOT, f)} must not be touched by this story (byte-pinned untouchable; ADR 0002).`);
  }
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- structures-the-brain-can-trust tests (epic second-brain, Story 2) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
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
  console.log(`\nstructures-the-brain-can-trust: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
