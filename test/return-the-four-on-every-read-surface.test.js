/**
 * Story 2 (epic: goal-intent-fields) — Return the four on every read surface
 * that shows a goal.
 *
 * Story: engineering-team/stories/goal-intent-fields/2-return-the-four-on-every-read-surface.md
 * ADR:   engineering-team/decisions/goal-intent-fields/0002-read-side-intent-projection-absence-as-null.md
 * Book:  engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md
 *
 * The four, in the concept's own declared names:
 *   prompt (string) · chanceOfSuccess (number) · needsHumanInput (boolean) ·
 *   needsBreakdown (boolean).
 *
 * ── The one thing this suite exists to pin ────────────────────────────────
 * A property that was never set must come back as `null` — REPORTED, never
 * MANUFACTURED. Not `0`, not `false`, not an empty prompt. The discrimination
 * is tested directly and repeatedly: a goal that stores `needsHumanInput:
 * false` EXPLICITLY and a goal that never set it must be distinguishable on
 * every surface. That distinction exists on live records today (see the census
 * printed by H1), so a surface that emits `false` for both is not merely
 * inventing — it is LOSSY.
 *
 * Test classes (per test-hermeticity-ci/0001):
 *
 *   U-class (EXECUTED, stack-free, always gates CI) — the pure cores over
 *     SYNTHETIC input: parseGoalRow's fourteen-field projection, the new
 *     projectIntentFields, and direction.js's deriveTerms. Verbatim copying
 *     (0 / false / '' / a non-numeric estimate / an out-of-range estimate / a
 *     multi-line markdown prompt), never-set ⇒ null, and the stored-false vs
 *     never-set discrimination.
 *
 *   D-class (EXECUTED, stack-free, always gates CI) — the FIVE PROJECTING
 *     SURFACES driven for real, dependency-injected. The genuine handlers from
 *     src/api/brain/index.js are loaded with runCypher / getOwnerAssistantPubkey
 *     / isOwner stubbed, and answered from a synthetic goal corpus. This is
 *     where the acceptance criteria are proved end-to-end WITHOUT a stack: the
 *     goals list, the goal detail, orient's `served`, the proposal card and the
 *     Direction transcription. It also drives the export (a VERBATIM surface)
 *     to prove key-omission survives untouched.
 *     Deliberate: the D-class exists because a claim about a response shape
 *     should be made by reading the response, not by grepping for a token.
 *
 *   S-class (source assertions, stack-free, structure-bounded) — the things a
 *     response cannot show: the two cores stay dependency-free (the pinned
 *     purity that forces direction.js to name its three literally), the brain
 *     module gains no new require SPEC, the blinding contract stays closed to
 *     goal content, the verbatim class is untouched, and no sort / filter /
 *     cap / gate / tie-break / refusal mentions any of the four (AC4).
 *
 *   H-class (live local stack, READ-ONLY, FIXTURE-FREE, per-test SKIP) — the
 *     real wire over the REAL corpus. Nothing is written: the D-class already
 *     supplies determinism, so writing fixtures into the definitive local-first
 *     graph (CLAUDE.md principle 4) would be risk with no coverage to show for
 *     it. H1 prints a census of what the live corpus actually contains and
 *     asserts the evidence the other H tests discriminate on still exists.
 *
 *   R-class (regression sentinels, stack-free, pass BEFORE and after) — the
 *     closed book's U25 contract restated here so this suite cannot go green
 *     while operational-direction's "never invented" pin is broken; orient's
 *     bounded roots slice; and the Direction raw-record workaround, which this
 *     story makes unnecessary but does NOT retire.
 *
 * ── Pass-by-design sentinels — 24 of the 54. They pass BEFORE the Implementer
 *    touches anything and must STILL pass after. Stated here so a green line is
 *    never mistaken for evidence the feature landed: ──
 *      U16 U17               the Direction surface's own estimate word; the shared list
 *      D7  D9  D10 D13       the shapes that must NOT gain the four (ADR d6) + AC6
 *      D14 D15 D16 D17       the verbatim class + "nothing acts on them"
 *      S1  S3  S4  S5 S6 S7 S8   purity, require surface, blinding, AC4, export
 *      H1  H6  H7  H8        the census, export omission, unfiltered set, no score key
 *      R1  R2  R3            the closed-book and scope sentinels
 *    The other 30 FAIL until the feature lands.
 *
 * ── Harness defects this suite is designed around (OPEN.md) ──
 *   #104/#106 — a fully-skipped H-class still reports suite PASS. run() prints
 *     an explicit `H-class: n executed / m skipped` line and shouts when the
 *     live class did not run; TAPESTRY_REQUIRE_LIVE=1 turns an all-skipped
 *     H-class into a suite FAILURE. The reachability probe retries (the
 *     recorded false-negative mode). The D-class means a skipped H-class no
 *     longer leaves the surface claims resting on source greps.
 *   #108 — vacuous iteration. Every loop over a collection asserts ARITY first,
 *     and the live conformance sweep counts the comparisons it actually made
 *     and fails if that count is zero.
 *   #109 — byte-offset source assertions. No fixed-width src.slice anywhere:
 *     function bodies are bounded by the NEXT top-level declaration.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GOALS_CORE = path.join(ROOT, 'src/lib/brain/goals.js');
const DIRECTION_CORE = path.join(ROOT, 'src/lib/brain/direction.js');
const PROPOSALS_CORE = path.join(ROOT, 'src/lib/brain/proposals.js');
const EXPORT_CORE = path.join(ROOT, 'src/lib/brain/export.js');
const BRAIN_API = path.join(ROOT, 'src/api/brain/index.js');
const DRIVER_MODULE = path.join(ROOT, 'src/lib/neo4j-driver.js');
const KEYS_MODULE = path.join(ROOT, 'src/utils/assistantKeys.js');
const AUTH_MODULE = path.join(ROOT, 'src/middleware/auth.js');

const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

/**
 * THE SPEC's own list — the four in the concept's declared names and order.
 * Every loop iterates THIS, never the constant the implementation exports: a
 * loop over an absent/empty export would run zero bodies and pass vacuously
 * (OPEN.md row 108).
 */
const EXPECTED_FIELDS = ['prompt', 'chanceOfSuccess', 'needsHumanInput', 'needsBreakdown'];

/** The ten fields parseGoalRow projected before this story, in order. */
const EXISTING_RECORD_FIELDS = [
  'uuid', 'name', 'slug', 'statement', 'origin', 'capturedOn', 'createdAt',
  'deliverable', 'boundary', 'parent',
];
/** ADR d1: the four are APPENDED after `parent` — fourteen, in this order. */
const EXPECTED_RECORD_FIELDS = [...EXISTING_RECORD_FIELDS, ...EXPECTED_FIELDS];

/** The three values AC3 forbids a surface from substituting for "not set". */
const FORBIDDEN_SUBSTITUTES = [0, false, ''];

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function short(x, n = 300) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}
/** JSON-quoted, so whitespace and type differences are visible in a failure. */
function quoted(x, n = 240) { return String(JSON.stringify(x)).slice(0, n); }
function sameArray(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}

/* ── structure-bounded source extraction (never a byte window; OPEN.md #109) ── */

/** Blank out whole-line comments, preserving every other line verbatim. */
function stripComments(text) {
  const out = [];
  let inBlock = false;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (inBlock) { if (t.includes('*/')) inBlock = false; out.push(''); continue; }
    if (t.startsWith('/*')) { if (!t.includes('*/')) inBlock = true; out.push(''); continue; }
    if (t.startsWith('//') || t.startsWith('*')) { out.push(''); continue; }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * The source CODE of one top-level function declaration, bounded by the NEXT
 * top-level declaration and stripped of whole-line comments. A fixed-width
 * slice both failed on correct code and passed on broken code in a single prior
 * round (OPEN.md row 109), so no assertion in this suite uses one. An unfound
 * name returns '' — every caller asserts non-empty FIRST, so a renamed function
 * fails loudly instead of matching nothing.
 */
function functionBody(src, name) {
  const decl = new RegExp(`\\n(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = decl.exec(src);
  if (!m) return '';
  const start = m.index + 1;
  const rest = src.slice(start + m[0].length);
  const next = rest.search(/\n(?:async\s+)?function\s+\w|\nconst\s+\w+\s*=|\nmodule\.exports/);
  const body = next === -1 ? src.slice(start) : src.slice(start, start + m[0].length + next);
  return stripComments(body);
}

/** A bounded function body, asserted to exist. */
function needBody(src, name, file) {
  const body = functionBody(src, name);
  assert(body, `could not locate the top-level function \`${name}\` in ${file} — it was renamed or removed. ` +
    'This pin is structure-bounded on purpose (OPEN.md #109); it will not silently match nothing.');
  return body;
}

/** Which of the four a bounded source region names. */
function fourNamesIn(text) {
  return EXPECTED_FIELDS.filter((f) => new RegExp(`\\b${f}\\b`).test(text));
}

/* ── U-class loading ─────────────────────────────────────────────────────── */

function loadGoalsCore() {
  if (!fs.existsSync(GOALS_CORE)) throw new Error('src/lib/brain/goals.js missing — second-brain #1 regression.');
  try { return require(GOALS_CORE); }
  catch (e) { throw new Error(`src/lib/brain/goals.js failed to require: ${e.message}`); }
}
function loadDirectionCore() {
  if (!fs.existsSync(DIRECTION_CORE)) throw new Error('src/lib/brain/direction.js missing — operational-direction #1 regression.');
  try { return require(DIRECTION_CORE); }
  catch (e) { throw new Error(`src/lib/brain/direction.js failed to require: ${e.message}`); }
}
function needProjector() {
  const core = loadGoalsCore();
  assert(typeof core.projectIntentFields === 'function',
    'src/lib/brain/goals.js does not export projectIntentFields() yet — the read-side projector (ADR 0002 d2) is not ' +
    'implemented, so no surface can carry the four with a stable four-key shape.');
  return core.projectIntentFields;
}

/** A goal row as the goals Cypher returns it. */
function row(section, createdAt = 1_780_000_000, uuid) {
  return {
    uuid: uuid || `39999:ta:${section.slug}`,
    name: section.name != null ? section.name : section.slug,
    createdAt,
    json: JSON.stringify({ tapestryOwnerGoal: section }),
  };
}

/** Assert the four on one object, exactly — presence AND value. */
function assertFour(obj, expected, where) {
  assert(obj && typeof obj === 'object', `${where}: expected an object to inspect; got ${short(obj)}`);
  for (const f of EXPECTED_FIELDS) {
    assert(Object.prototype.hasOwnProperty.call(obj, f),
      `${where} must carry the key '${f}'. All four come back on every surface that shows a goal (the frame's ` +
      `success criterion); a missing key is not "not set", it is not answered. Got keys ${short(Object.keys(obj))}.`);
    assert(Object.is(obj[f], expected[f]),
      `${where}: '${f}' must read ${quoted(expected[f])}; got ${quoted(obj[f])}.` +
      (expected[f] === null
        ? ' A never-set property is REPORTED as null — never substituted with 0, false or an empty prompt (AC3).'
        : ' A stored value is copied VERBATIM — no trim, no coercion, no clamp, no default substitution (ADR d1).'));
  }
}

/** Assert none of the four appears on an object (ADR d6's excluded shapes). */
function assertNoFour(obj, where) {
  assert(obj && typeof obj === 'object', `${where}: expected an object to inspect; got ${short(obj)}`);
  for (const f of EXPECTED_FIELDS) {
    assert(!Object.prototype.hasOwnProperty.call(obj, f),
      `${where} must NOT carry '${f}' (ADR 0002 d6). It names a goal other than the one the surface is about, or its ` +
      `size/blinding is a ratified property of the response. Got keys ${short(Object.keys(obj))}.`);
  }
}

/* ══════════════════════════════════════════════════════════════════════
   D-class harness — the real handlers, dependency-injected (stack-free)
   ══════════════════════════════════════════════════════════════════════ */

const TA = 'ab'.repeat(32);
const GOAL_HEADER = `39998:${TA}:tapestry-owner-goal`;
const PROPOSAL_HEADER = `39998:${TA}:tapestry-proposal`;

/**
 * Load src/api/brain/index.js with its three environment dependencies replaced,
 * capture the registered handlers, then restore the require cache exactly as it
 * was. The handlers destructure their dependencies at module load, so the
 * captured closures keep the stubs after the cache is restored — no other suite
 * in the same `npm test` process sees a stubbed driver.
 */
function loadInjectedBrain(runCypherImpl) {
  const paths = [DRIVER_MODULE, KEYS_MODULE, AUTH_MODULE, BRAIN_API].map((p) => {
    try { return require.resolve(p); }
    catch (e) { throw new Error(`cannot resolve ${p}: ${e.message}`); }
  });
  const saved = paths.map((p) => require.cache[p]);
  const fake = (p, exports) => {
    require.cache[p] = { id: p, filename: p, loaded: true, exports, children: [], paths: [] };
  };
  const routes = {};
  try {
    for (const p of paths) delete require.cache[p];
    fake(paths[0], { runCypher: runCypherImpl });
    fake(paths[1], { getOwnerAssistantPubkey: () => TA });
    fake(paths[2], { isOwner: () => true });
    const brain = require(paths[3]);
    assert(brain && typeof brain.registerBrainRoutes === 'function',
      'src/api/brain/index.js must export registerBrainRoutes — the read surface module changed shape.');
    brain.registerBrainRoutes({ get: (p, h) => { routes[p] = h; } });
  } finally {
    paths.forEach((p, i) => {
      if (saved[i] === undefined) delete require.cache[p];
      else require.cache[p] = saved[i];
    });
  }
  for (const need of ['/api/brain/goals', '/api/brain/goals/:slug', '/api/brain/orient',
    '/api/brain/proposals', '/api/brain/direction/:slug', '/api/brain/export']) {
    assert(typeof routes[need] === 'function', `the brain module no longer registers ${need}.`);
  }
  return routes;
}

/** A minimal express-shaped response recorder. */
function recorder() {
  const r = { _json: null, _status: 200 };
  r.status = (s) => { r._status = s; return r; };
  r.json = (j) => { r._json = j; return r; };
  r.setHeader = () => {};
  return r;
}

/**
 * Drive the read surfaces over a synthetic corpus. `goals` and `proposals` are
 * arrays of raw rows; every other family answers empty.
 */
function drive({ goals = [], proposals = [] } = {}) {
  const byHeader = { [GOAL_HEADER]: goals, [PROPOSAL_HEADER]: proposals };
  const routes = loadInjectedBrain(async (_cypher, params) => {
    const h = params && params.headerUuid;
    return byHeader[h] || [];
  });
  const call = async (route, req) => {
    const res = recorder();
    await routes[route](Object.assign({ localTrusted: true, params: {}, query: {} }, req), res);
    assert(res._json && typeof res._json === 'object',
      `${route} answered no JSON body (status ${res._status}).`);
    return res._json;
  };
  return {
    list: () => call('/api/brain/goals', {}),
    detail: (slug) => call('/api/brain/goals/:slug', { params: { slug } }),
    orient: (slug) => call('/api/brain/orient', { query: slug ? { goal: slug } : {} }),
    proposals: () => call('/api/brain/proposals', {}),
    direction: (slug, query) => call('/api/brain/direction/:slug', { params: { slug }, query: query || {} }),
    exported: () => call('/api/brain/export', {}),
  };
}

/* ── the synthetic corpus the D-class reads ───────────────────────────────
 * Four goals, chosen so that every value AC3 forbids as a substitute is also a
 * value some goal legitimately STORES. If a projection manufactures a default,
 * it collides with a real stored value and the discrimination assertions fail.
 */

/** A prompt that breaks if anything trims, re-wraps, re-escapes or truncates it. */
const D_PROMPT = [
  '',
  '# Session prompt',
  '',
  'Read the goal, then:',
  '',
  '1. orient with `GET /api/concept-graph/summaries`',
  '2. publish nothing outward',
  '',
  '```',
  '  indented   and   spaced  ',
  '```',
  '   ',
].join('\n') + '\n';

const SEC_PARENT = {
  name: 'a parent goal', slug: 'four-parent', description: 'the parent ask',
  capturedOn: '2026-07-05', deliverable: 'parent deliverable', boundary: 'parent boundary',
};
const SEC_ALL = {
  name: 'a goal with all four', slug: 'four-all', description: 'the ask',
  capturedOn: '2026-07-04', deliverable: 'what done produces', boundary: 'what it stays inside',
  parent: 'four-parent',
  prompt: D_PROMPT, chanceOfSuccess: 0, needsHumanInput: false, needsBreakdown: true,
};
const SEC_NONE = {
  name: 'a goal with none of the four', slug: 'four-none', description: 'the ask',
  capturedOn: '2026-07-03', deliverable: 'what done produces', boundary: 'what it stays inside',
};
const SEC_PARTIAL = {
  name: 'a goal with one of the four', slug: 'four-partial', description: 'the ask',
  capturedOn: '2026-07-02', deliverable: 'what done produces', boundary: 'what it stays inside',
  needsHumanInput: false,
};
const SEC_ODD = {
  name: 'a goal with malformed stored values', slug: 'four-odd', description: 'the ask',
  capturedOn: '2026-07-01', deliverable: 'what done produces', boundary: 'what it stays inside',
  prompt: '', chanceOfSuccess: 'lots', needsBreakdown: false,
};

const EXPECT_ALL = { prompt: D_PROMPT, chanceOfSuccess: 0, needsHumanInput: false, needsBreakdown: true };
const EXPECT_NONE = { prompt: null, chanceOfSuccess: null, needsHumanInput: null, needsBreakdown: null };
const EXPECT_PARTIAL = { prompt: null, chanceOfSuccess: null, needsHumanInput: false, needsBreakdown: null };
const EXPECT_ODD = { prompt: '', chanceOfSuccess: 'lots', needsHumanInput: null, needsBreakdown: false };

function corpus() {
  return [
    row(SEC_PARENT, 1_780_000_000),
    row(SEC_ALL, 1_780_000_100),
    row(SEC_NONE, 1_780_000_200),
    row(SEC_PARTIAL, 1_780_000_300),
    row(SEC_ODD, 1_780_000_400),
  ];
}

/** A section with the four stripped — the AC4 differential's other half. */
function withoutFour(section) {
  const out = {};
  for (const k of Object.keys(section)) if (!EXPECTED_FIELDS.includes(k)) out[k] = section[k];
  return out;
}

function proposalRow(section, createdAt) {
  return { uuid: `39999:${TA}:${section.slug}`, name: section.slug, createdAt, json: JSON.stringify({ proposal: section }) };
}
/** An OPEN nomination of four-all, passing over four-partial (which stores a false). */
const PROP_OPEN = proposalRow({
  slug: 'proposed-four-all', type: 'proposed', goal: 'four-all', happenedOn: '2026-07-06',
  summary: 'nominating four-all', whyNow: 'it is next',
  passedOver: [{ goal: 'four-partial', whyNot: 'nothing is blocked by it' }],
}, 1_780_001_000);
/** A ratification of four-all (a DIFFERENT proposalId, so the nomination stays open). */
const PROP_APPROVED = proposalRow({
  slug: 'approved-four-all', type: 'approved', goal: 'four-all', proposalId: 'earlier-nomination',
  happenedOn: '2026-07-06', summary: 'approved',
}, 1_780_001_100);

/* ── live-stack helpers (H-class; the house pattern, READ-ONLY) ───────────── */

function dockerCurl(args, timeout = 20000) {
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], { encoding: 'utf8', timeout });
}
function loopbackGetJson(pathname, timeout = 20000) {
  const out = dockerCurl(['-s', '-m', '40', `${CONTAINER_BASE}${pathname}`], timeout + 25000);
  try { return JSON.parse(out); }
  catch { throw new Error(`loopback GET ${pathname} did not return JSON: ${short(out)}`); }
}

/**
 * Reachability, RETRIED. The single-shot probe is a recorded false-negative
 * source (OPEN.md #104/#106): identical code flipped ten H tests between
 * executed and skipped across consecutive runs.
 */
let reachable = null;
async function stackAvailable() {
  if (reachable !== null) return reachable;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let host = false;
    try {
      const r = await fetch(`${HOST_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(5000) });
      host = r.ok;
    } catch { host = false; }
    let loopback = false;
    try {
      const out = dockerCurl(['-s', '-m', '5', `${CONTAINER_BASE}/api/auth/user-classification`], 12000);
      loopback = /"success"\s*:\s*true/.test(out);
    } catch { loopback = false; }
    if (host && loopback) { reachable = true; return reachable; }
  }
  reachable = false;
  return reachable;
}

let hExecuted = 0;
let hSkipped = 0;
/** Register a live test that counts its own execution (OPEN.md #104/#106). */
function htest(name, fn) {
  test(name, async () => {
    if (!(await stackAvailable())) { hSkipped += 1; return 'SKIP'; }
    hExecuted += 1;
    return fn();
  });
}

/** The live export artifact — each goal entry is {name, section} with the section RAW. */
let liveArtifact = null;
function liveExport() {
  if (!liveArtifact) {
    const art = loopbackGetJson('/api/brain/export', 60000);
    assert(art && art.content && Array.isArray(art.content.goals),
      `GET /api/brain/export must answer an artifact with content.goals[] (got ${short(art)}).`);
    liveArtifact = art;
  }
  return liveArtifact;
}
/** Map slug → the RAW stored section, asserting slugs are unique (arity, #108). */
function liveSections() {
  const goals = liveExport().content.goals;
  assert(goals.length > 0, 'the live corpus holds no goals — these live checks have nothing to read.');
  const bySlug = new Map();
  for (const e of goals) {
    const s = e && e.section && e.section.slug;
    if (typeof s !== 'string' || s === '') continue;
    assert(!bySlug.has(s), `two exported goals share the slug '${s}' — the live conformance sweep needs slugs to be unique.`);
    bySlug.set(s, e.section);
  }
  assert(bySlug.size > 0, 'no exported goal carries a slug — the live conformance sweep cannot key on anything.');
  return bySlug;
}
/** What a projecting surface must answer for a stored section: present ⇒ verbatim, absent ⇒ null. */
function expectedFrom(section) {
  const out = {};
  for (const f of EXPECTED_FIELDS) {
    out[f] = Object.prototype.hasOwnProperty.call(section, f) && section[f] != null ? section[f] : null;
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════
   U-class — the pure cores (stack-free, always executed)
   ══════════════════════════════════════════════════════════════════════ */

test('U1 (AC1): a parsed goal record carries all four properties it stores', () => {
  const core = loadGoalsCore();
  const rec = core.parseGoalRow(row(SEC_ALL));
  assert(rec && typeof rec === 'object', 'parseGoalRow must still parse a goal row.');
  assertFour(rec, EXPECT_ALL, 'the parsed goal record');
});

test('U2 (AC3): a property that was never set is reported as not-set — never as 0, false or an empty prompt', () => {
  const core = loadGoalsCore();
  const rec = core.parseGoalRow(row(SEC_NONE));
  assert(rec && typeof rec === 'object', 'a goal that never set any of the four must still parse.');
  assertFour(rec, EXPECT_NONE, 'the parsed record of a goal that never set any of the four');
  for (const f of EXPECTED_FIELDS) {
    for (const bad of FORBIDDEN_SUBSTITUTES) {
      assert(!Object.is(rec[f], bad),
        `AC3: '${f}' was never set, so the record must not substitute ${quoted(bad)} for it. ` +
        'The concept\'s declared defaults tell a CONSUMER how to read absence; they do not license a read layer to manufacture one.');
    }
  }
});

test('U3 (AC3, the discrimination): a goal storing a flag as false and a goal that never set it come back different', () => {
  const core = loadGoalsCore();
  const stored = core.parseGoalRow(row(SEC_PARTIAL));
  const never = core.parseGoalRow(row(SEC_NONE));
  assert(stored && never, 'both goals must parse.');
  assert(Object.is(stored.needsHumanInput, false),
    `a stored false is a value the owner supplied and must survive the read; got ${quoted(stored.needsHumanInput)}.`);
  assert(never.needsHumanInput === null,
    `a flag nobody set must read null; got ${quoted(never.needsHumanInput)}.`);
  assert(!Object.is(stored.needsHumanInput, never.needsHumanInput),
    'stored-false and never-set must remain DISTINGUISHABLE. Live records carry both today, so collapsing them is ' +
    'not merely inventing a value — it destroys a distinction the owner already made.');
});

test('U4 (AC1): a stored value is copied verbatim — 0, false, an empty string, a non-numeric estimate and an out-of-range estimate all come back as themselves', () => {
  const core = loadGoalsCore();
  const rec = core.parseGoalRow(row(SEC_ODD));
  assert(rec, 'a goal with malformed stored values must still parse.');
  assertFour(rec, EXPECT_ODD, 'the parsed record of a goal with malformed stored values');
  const wide = core.parseGoalRow(row({ ...SEC_NONE, chanceOfSuccess: 150 }));
  assert(Object.is(wide.chanceOfSuccess, 150),
    `no range clamp on read: an out-of-range estimate comes back as stored; got ${quoted(wide.chanceOfSuccess)}.`);
  const numeric = core.parseGoalRow(row({ ...SEC_NONE, chanceOfSuccess: '75' }));
  assert(Object.is(numeric.chanceOfSuccess, '75'),
    `no coercion on read: a numeric STRING stays a string; got ${quoted(numeric.chanceOfSuccess)}.`);
  const truthy = core.parseGoalRow(row({ ...SEC_NONE, needsBreakdown: 'yes' }));
  assert(Object.is(truthy.needsBreakdown, 'yes'),
    `no Boolean() coercion on read; got ${quoted(truthy.needsBreakdown)}.`);
});

test('U5 (AC2): a multi-line markdown prompt comes back byte-identical — not trimmed, reflowed or re-escaped', () => {
  const core = loadGoalsCore();
  const rec = core.parseGoalRow(row(SEC_ALL));
  assert(rec.prompt === D_PROMPT,
    'the prompt must be byte-identical to what was stored. Difference: ' +
    `stored ${quoted(D_PROMPT, 400)} vs read ${quoted(rec.prompt, 400)}`);
  assert(rec.prompt.split('\n').length === D_PROMPT.split('\n').length,
    'the line count changed — something reflowed the prompt.');
});

test('U6 (AC1): the goal record projects exactly fourteen fields — the ten it had, plus the four appended after the parent', () => {
  const core = loadGoalsCore();
  const rec = core.parseGoalRow(row(SEC_ALL));
  const keys = Object.keys(rec);
  assert(Array.isArray(keys) && keys.length === EXPECTED_RECORD_FIELDS.length,
    `the record must project exactly ${EXPECTED_RECORD_FIELDS.length} fields (ADR 0002 d1). Got ${keys.length}: ${short(keys)}.`);
  assert(sameArray(keys, EXPECTED_RECORD_FIELDS),
    `the record's field order must be ${short(EXPECTED_RECORD_FIELDS)}; got ${short(keys)}.`);
  assert(rec.deliverable === 'what done produces' && rec.parent === 'four-parent',
    'the ten pre-existing fields must still be projected correctly — this story ADDS, it does not re-shape.');
});

test('U7 (AC1): the intent projection returns all four keys, in the concept\'s own order, for a goal that has them', () => {
  const project = needProjector();
  const core = loadGoalsCore();
  const out = project(core.parseGoalRow(row(SEC_ALL)));
  const keys = Object.keys(out);
  assert(Array.isArray(keys) && keys.length === EXPECTED_FIELDS.length,
    `the projection must emit exactly the four keys; got ${keys.length}: ${short(keys)}.`);
  assert(sameArray(keys, EXPECTED_FIELDS),
    `the projection's key order must follow the concept's own list ${short(EXPECTED_FIELDS)}; got ${short(keys)}.`);
  assertFour(out, EXPECT_ALL, 'the intent projection');
});

test('U8 (AC3): the intent projection still returns all four keys, each not-set, for a goal that set none', () => {
  const project = needProjector();
  const core = loadGoalsCore();
  const out = project(core.parseGoalRow(row(SEC_NONE)));
  assert(sameArray(Object.keys(out), EXPECTED_FIELDS),
    `the response shape must be the same whether or not anything was set; got ${short(Object.keys(out))}.`);
  assertFour(out, EXPECT_NONE, 'the intent projection of a goal that set none of the four');
});

test('U9 (AC1/AC3): the intent projection copies a stored 0, false and empty string through as themselves', () => {
  const project = needProjector();
  const out = project({ prompt: '', chanceOfSuccess: 0, needsHumanInput: false, needsBreakdown: false });
  assertFour(out, { prompt: '', chanceOfSuccess: 0, needsHumanInput: false, needsBreakdown: false },
    'the intent projection of falsy-but-stored values');
});

test('U10: the intent projection is pure — it returns a new object and mutates nothing', () => {
  const project = needProjector();
  const record = { slug: 'g', prompt: 'p', chanceOfSuccess: 40, needsHumanInput: true, needsBreakdown: false };
  const before = JSON.stringify(record);
  const out = project(record);
  assert(out !== record, 'the projection must return a NEW object, not the record itself.');
  assert(JSON.stringify(record) === before, `the projection must not mutate the record it was given; it became ${short(record)}.`);
});

test('U11: the intent projection tolerates a missing or empty record without throwing', () => {
  const project = needProjector();
  for (const input of [null, undefined, {}]) {
    let out;
    try { out = project(input); }
    catch (e) { throw new Error(`the projection threw on ${quoted(input)}: ${e.message}. Read paths are tolerant by construction.`); }
    assertFour(out, EXPECT_NONE, `the intent projection of ${quoted(input)}`);
  }
});

test('U12: the intent projection emits only the four — no other record field leaks into a response', () => {
  const project = needProjector();
  const out = project({
    slug: 'g', statement: 'the ask', parentUnresolved: true, slugShadowed: true, cycleOf: 'x',
    prompt: 'p', chanceOfSuccess: 1, needsHumanInput: true, needsBreakdown: true,
  });
  assert(sameArray(Object.keys(out), EXPECTED_FIELDS),
    'the projection must carry the four and nothing else — a response must not leak the resolver\'s internal ' +
    `annotations (parentUnresolved / slugShadowed / cycleOf). Got ${short(Object.keys(out))}.`);
});

test('U13 (AC1): the Direction transcription carries the prompt and the two flags off the goal', () => {
  const core = loadDirectionCore();
  const goals = loadGoalsCore();
  const t = core.deriveTerms(goals.parseGoalRow(row(SEC_ALL)), 0);
  for (const f of ['prompt', 'needsHumanInput', 'needsBreakdown']) {
    assert(Object.prototype.hasOwnProperty.call(t, f),
      `the Direction transcription must carry '${f}' (ADR 0002 d5). Got keys ${short(Object.keys(t))}.`);
  }
  assert(t.prompt === D_PROMPT, `the prompt must be transcribed byte-identical; got ${quoted(t.prompt, 200)}.`);
  assert(Object.is(t.needsHumanInput, false), `a stored false must survive transcription; got ${quoted(t.needsHumanInput)}.`);
  assert(Object.is(t.needsBreakdown, true), `a stored true must survive transcription; got ${quoted(t.needsBreakdown)}.`);
});

test('U14 (AC3): the Direction transcription reports never-set terms as not-set, and still records an absent estimate as absent', () => {
  const core = loadDirectionCore();
  const goals = loadGoalsCore();
  const t = core.deriveTerms(goals.parseGoalRow(row(SEC_NONE)), null);
  for (const f of ['prompt', 'needsHumanInput', 'needsBreakdown']) {
    assert(t[f] === null, `'${f}' was never set on this goal, so the transcription must report null; got ${quoted(t[f])}.`);
  }
  assert(t.estimate === null && t.estimateSource === 'absent',
    'the shipped "not set" contract on this surface is preserved EXACTLY: an absent estimate stays null with ' +
    `estimateSource 'absent' (AC3; operational-direction U25 — "never invented"). Got ${short(t)}.`);
});

test('U15 (AC3, the discrimination on the Direction surface): a stored false and a never-set flag transcribe differently', () => {
  const core = loadDirectionCore();
  const goals = loadGoalsCore();
  const stored = core.deriveTerms(goals.parseGoalRow(row(SEC_PARTIAL)), null);
  const never = core.deriveTerms(goals.parseGoalRow(row(SEC_NONE)), null);
  assert(Object.is(stored.needsHumanInput, false), `a stored false must transcribe as false; got ${quoted(stored.needsHumanInput)}.`);
  assert(never.needsHumanInput === null, `a never-set flag must transcribe as null; got ${quoted(never.needsHumanInput)}.`);
  assert(!Object.is(stored.needsHumanInput, never.needsHumanInput),
    'the two must stay distinguishable on this surface too.');
});

test('U16 (ADR d5): on the Direction surface the estimate keeps this surface\'s own word — terms.estimate, and a stored 0 reads as 0', () => {
  const core = loadDirectionCore();
  const goals = loadGoalsCore();
  const t = core.deriveTerms(goals.parseGoalRow(row(SEC_ALL)), 0);
  assert(Object.is(t.estimate, 0) && t.estimateSource === 'goal',
    `a stored estimate of 0 is a supplied value, not an absence: expected estimate 0 / source 'goal'; got ${short(t)}.`);
  assert(!Object.prototype.hasOwnProperty.call(t, 'chanceOfSuccess'),
    'this surface renamed the estimate at ship time (statement→ask, deliverable→successCriteria, boundary→ceiling, ' +
    `chanceOfSuccess→estimate). The value comes back; the vocabulary is this surface's own. Got keys ${short(Object.keys(t))}.`);
});

test('U17: the shared list of the four still names exactly the concept\'s four properties, in its order', () => {
  const core = loadGoalsCore();
  assert(Array.isArray(core.INTENT_FIELDS), 'src/lib/brain/goals.js must export INTENT_FIELDS (goal-intent-fields ADR 0001 d1).');
  assert(sameArray(core.INTENT_FIELDS, EXPECTED_FIELDS),
    `one list, one place: INTENT_FIELDS must read ${short(EXPECTED_FIELDS)}; got ${short(core.INTENT_FIELDS)}.`);
});

/* ══════════════════════════════════════════════════════════════════════
   D-class — the five projecting surfaces, dependency-injected (stack-free)
   ══════════════════════════════════════════════════════════════════════ */

test('D1 (AC1): the goals list returns all four for a goal that stores them', async () => {
  const r = await drive({ goals: corpus() }).list();
  assert(r.success === true && Array.isArray(r.goals), `the goals list must answer {success, goals[]}; got ${short(r)}`);
  assert(r.goals.length === 5, `expected all 5 corpus goals on the list; got ${r.goals.length}.`);
  const g = r.goals.find((x) => x.slug === 'four-all');
  assert(g, 'the goal that stores all four must be on the list.');
  assertFour(g, EXPECT_ALL, 'the goals list row');
});

test('D2 (AC3): the goals list returns a goal that never set any of the four — present, error-free, and reported as not set', async () => {
  const r = await drive({ goals: corpus() }).list();
  const g = r.goals.find((x) => x.slug === 'four-none');
  assert(g, 'a goal that never set any of the four must still be RETURNED, not omitted (AC3).');
  assertFour(g, EXPECT_NONE, 'the goals list row of a goal that never set any of the four');
});

test('D3 (AC3, the discrimination): on one list read, a stored false and a never-set flag are distinguishable', async () => {
  const r = await drive({ goals: corpus() }).list();
  const stored = r.goals.find((x) => x.slug === 'four-partial');
  const never = r.goals.find((x) => x.slug === 'four-none');
  assert(stored && never, 'both goals must be on the list.');
  assert(Object.is(stored.needsHumanInput, false) && never.needsHumanInput === null,
    'a goal that stored the flag as false and a goal that never set it must read differently on the SAME response: ' +
    `expected false vs null; got ${quoted(stored.needsHumanInput)} vs ${quoted(never.needsHumanInput)}.`);
  const odd = r.goals.find((x) => x.slug === 'four-odd');
  assertFour(odd, EXPECT_ODD, 'the goals list row of a goal with malformed stored values');
});

test('D4 (AC1/AC3): a single goal\'s detail returns all four — stored values on a goal that has them, not-set on one that does not', async () => {
  const d = drive({ goals: corpus() });
  const withAll = await d.detail('four-all');
  assert(withAll.success === true && withAll.goal, `the detail read must answer a goal; got ${short(withAll)}`);
  assertFour(withAll.goal, EXPECT_ALL, 'the goal detail');
  const withNone = await d.detail('four-none');
  assert(withNone.goal, 'a goal that never set any of the four must still have a detail read.');
  assertFour(withNone.goal, EXPECT_NONE, 'the goal detail of a goal that never set any of the four');
});

test('D5 (AC2): the full multi-line prompt travels on the LIST surface, byte-identical — not truncated and not replaced by a presence indicator', async () => {
  const d = drive({ goals: corpus() });
  const list = await d.list();
  const onList = list.goals.find((x) => x.slug === 'four-all');
  assert(onList && typeof onList.prompt === 'string',
    `the list row must carry the prompt as a string, not a flag or a length; got ${quoted(onList && onList.prompt)}.`);
  assert(onList.prompt === D_PROMPT,
    `the prompt must be byte-identical on the LIST surface. Stored ${D_PROMPT.length} chars, list returned ` +
    `${onList.prompt.length}: ${quoted(onList.prompt, 400)}`);
  const detail = await d.detail('four-all');
  assert(detail.goal.prompt === D_PROMPT, 'and byte-identical on the detail surface.');
  const orient = await d.orient('four-all');
  assert(orient.served && orient.served.prompt === D_PROMPT, 'and byte-identical on the orientation read.');
});

test('D6 (AC1/AC3): the session orientation read returns all four on the goal it serves', async () => {
  const d = drive({ goals: corpus() });
  const withAll = await d.orient('four-all');
  assert(withAll.success === true && withAll.served, `orient must answer a served goal for a known slug; got ${short(withAll)}`);
  assertFour(withAll.served, EXPECT_ALL, 'the orientation read\'s served goal');
  const withNone = await d.orient('four-none');
  assert(withNone.served, 'a goal that never set any of the four must still be served.');
  assertFour(withNone.served, EXPECT_NONE, 'the orientation read\'s served goal (none of the four set)');
});

test('D7 (ADR d6): the orientation read\'s bounded roots slice and its ancestry carry none of the four', async () => {
  const r = await drive({ goals: corpus() }).orient('four-all');
  assert(Array.isArray(r.roots) && r.roots.length === 4,
    `expected the 4 parent-less corpus goals in the roots slice; got ${short(r.roots)}.`);
  for (const root of r.roots) assertNoFour(root, 'an orientation roots entry');
  assert(Array.isArray(r.served.ancestry) && r.served.ancestry.length === 1,
    `expected one ancestor for four-all; got ${short(r.served.ancestry)}.`);
  for (const a of r.served.ancestry) assertNoFour(a, 'an orientation ancestry entry');
});

test('D8 (AC1): the proposal queue returns the nominated goal\'s four', async () => {
  const r = await drive({ goals: corpus(), proposals: [PROP_OPEN] }).proposals();
  assert(r.success === true && Array.isArray(r.proposals), `the queue must answer {success, proposals[]}; got ${short(r)}`);
  assert(r.proposals.length === 1, `expected exactly one open proposal; got ${r.proposals.length}.`);
  const card = r.proposals[0];
  assert(card.goal === 'four-all' && card.goalName === 'a goal with all four',
    `the card must still name the goal it nominates; got ${short(card)}.`);
  assertFour(card, EXPECT_ALL, 'the proposal queue card');
});

test('D9 (ADR d6): the proposal card\'s passed-over runners-up carry none of the four', async () => {
  const r = await drive({ goals: corpus(), proposals: [PROP_OPEN] }).proposals();
  const card = r.proposals[0];
  assert(Array.isArray(card.passedOver) && card.passedOver.length === 1,
    `expected one passed-over entry; got ${short(card.passedOver)}.`);
  for (const p of card.passedOver) assertNoFour(p, 'a passed-over runner-up entry');
});

test('D10 (second-brain AC6): the proposal card carries no key that reads as a score, rank or percentage', async () => {
  const r = await drive({ goals: corpus(), proposals: [PROP_OPEN] }).proposals();
  const card = r.proposals[0];
  const keys = Object.keys(card);
  assert(keys.length > 0, 'the card must have keys to inspect.');
  for (const k of keys) {
    assert(!/score|rank|percent/i.test(k),
      `a closed book forbids a numeric score, percentage, gauge or ranking number on an owner-facing proposal ` +
      `(second-brain ADR 0006 d13, pinned by the-proposal-loop H2) — found key '${k}'.`);
  }
});

test('D11 (AC1): the Direction transcription returns the prompt and the two flags, with the estimate under this surface\'s own word', async () => {
  const r = await drive({ goals: corpus(), proposals: [PROP_APPROVED] }).direction('four-all');
  assert(r.eligible === true, `expected an eligible answer for the ratified goal; got ${short(r, 400)}`);
  assert(r.terms && typeof r.terms === 'object', `an eligible answer must carry terms; got ${short(r)}`);
  assert(r.terms.prompt === D_PROMPT, `the transcription must carry the prompt byte-identical; got ${quoted(r.terms.prompt, 200)}.`);
  assert(Object.is(r.terms.needsHumanInput, false), `expected needsHumanInput false; got ${quoted(r.terms.needsHumanInput)}.`);
  assert(Object.is(r.terms.needsBreakdown, true), `expected needsBreakdown true; got ${quoted(r.terms.needsBreakdown)}.`);
  assert(Object.is(r.terms.estimate, 0) && r.terms.estimateSource === 'goal',
    `the estimate travels as terms.estimate on this surface, and a stored 0 is a value: got ${short(r.terms)}.`);
});

test('D12 (AC3, preserved exactly): the Direction transcription still records an absent or unusable estimate as absent, while the list returns the stored value verbatim', async () => {
  const goals = [row(SEC_NONE, 1_780_000_200), row(SEC_ODD, 1_780_000_400)];
  const approveNone = proposalRow({ slug: 'a1', type: 'approved', goal: 'four-none', proposalId: 'x', happenedOn: '2026-07-06' }, 1_780_001_000);
  const approveOdd = proposalRow({ slug: 'a2', type: 'approved', goal: 'four-odd', proposalId: 'y', happenedOn: '2026-07-06' }, 1_780_001_000);
  const d = drive({ goals, proposals: [approveNone, approveOdd] });

  const none = await d.direction('four-none');
  assert(none.eligible === true, `expected an eligible answer; got ${short(none, 400)}`);
  assert(none.terms.estimate === null && none.terms.estimateSource === 'absent',
    `a goal with no stored estimate keeps the shipped contract: null + 'absent'. Got ${short(none.terms)}.`);

  const odd = await d.direction('four-odd');
  assert(odd.terms.estimate === null && odd.terms.estimateSource === 'absent',
    'this surface\'s own type-checked estimate read is byte-unchanged by this story, so a non-numeric stored ' +
    `estimate still reads as absent HERE. Got ${short(odd.terms)}.`);
  const list = await d.list();
  const oddRow = list.goals.find((g) => g.slug === 'four-odd');
  assert(Object.is(oddRow.chanceOfSuccess, 'lots'),
    `...while the goals list returns the stored value verbatim, because AC1 asks for "the stored values" and this ` +
    `story adds no type rule on read. Got ${quoted(oddRow.chanceOfSuccess)}.`);
});

test('D13 (ADR d6, the blinding contract): the Direction envelope\'s chain and boundary steps carry no goal content', async () => {
  const saved = process.env.BRAINSTORM_MAX_ANCHOR_DISTANCE;
  process.env.BRAINSTORM_MAX_ANCHOR_DISTANCE = '2';
  try {
    const approveParent = proposalRow(
      { slug: 'a3', type: 'approved', goal: 'four-parent', proposalId: 'z', happenedOn: '2026-07-06' }, 1_780_001_000);
    const r = await drive({ goals: corpus(), proposals: [approveParent] }).direction('four-all');
    assert(Array.isArray(r.chain) && r.chain.length === 2, `expected a two-goal chain; got ${short(r.chain)}`);
    for (const link of r.chain) {
      assert(sameArray(Object.keys(link), ['slug', 'uuid']),
        `a chain entry is {slug, uuid} by construction and must gain no goal field; got ${short(Object.keys(link))}.`);
    }
    assert(r.boundaryReview && Array.isArray(r.boundaryReview.steps) && r.boundaryReview.steps.length === 1,
      `expected one unjudged boundary step; got ${short(r.boundaryReview)}`);
    for (const step of r.boundaryReview.steps) {
      assert(sameArray(Object.keys(step), ['parentBoundary', 'childBoundary']),
        'a boundary judge sees exactly two strings and nothing carrying a progress signal — adding a goal field to a ' +
        `blinded step is a defect, not an extension. Got ${short(Object.keys(step))}.`);
    }
  } finally {
    if (saved === undefined) delete process.env.BRAINSTORM_MAX_ANCHOR_DISTANCE;
    else process.env.BRAINSTORM_MAX_ANCHOR_DISTANCE = saved;
  }
});

test('D14 (AC1, verbatim surface — pass-by-design): the export still carries all four exactly as stored', async () => {
  const art = await drive({ goals: corpus() }).exported();
  assert(art && art.content && Array.isArray(art.content.goals) && art.content.goals.length === 5,
    `expected all 5 corpus goals in the export; got ${short(art && art.content && art.content.goals)}`);
  const entry = art.content.goals.find((e) => e.section && e.section.slug === 'four-all');
  assert(entry, 'the goal that stores all four must be in the export.');
  assertFour(entry.section, EXPECT_ALL, 'the exported goal section');
});

test('D15 (AC3, verbatim surface — pass-by-design): the export OMITS the key entirely for a property that was never set', async () => {
  const art = await drive({ goals: corpus() }).exported();
  const entry = art.content.goals.find((e) => e.section && e.section.slug === 'four-none');
  assert(entry, 'the goal that set none of the four must be in the export.');
  for (const f of EXPECTED_FIELDS) {
    assert(!Object.prototype.hasOwnProperty.call(entry.section, f),
      `the export must keep OMITTING '${f}' for a never-set property — not null, not 0, not false. Restore stores an ` +
      'artifact\'s section verbatim, so a value invented here would be written back permanently on the next backup ' +
      `cycle: "never estimated" would become "estimated at zero". Got ${short(Object.keys(entry.section))}.`);
  }
  const partial = art.content.goals.find((e) => e.section && e.section.slug === 'four-partial');
  assert(Object.is(partial.section.needsHumanInput, false) && !('chanceOfSuccess' in partial.section),
    `a partial subset must survive the export exactly: the one stored key present, the three unset ones absent. Got ${short(Object.keys(partial.section))}.`);
});

test('D16 (AC4 — pass-by-design): which goals each surface returns, and in what order, does not depend on the four', async () => {
  const withFour = drive({ goals: corpus(), proposals: [PROP_OPEN] });
  const stripped = drive({
    goals: [SEC_PARENT, SEC_ALL, SEC_NONE, SEC_PARTIAL, SEC_ODD]
      .map((s, i) => row(withoutFour(s), 1_780_000_000 + i * 100)),
    proposals: [PROP_OPEN],
  });

  const a = await withFour.list();
  const b = await stripped.list();
  assert(a.goals.length === 5 && b.goals.length === 5, `both reads must return all 5 goals; got ${a.goals.length} / ${b.goals.length}.`);
  assert(sameArray(a.goals.map((g) => g.slug), b.goals.map((g) => g.slug)),
    'no ranking, filtering, gating or selection may key off the four: the list\'s goal set and order must be identical ' +
    `with and without them. Got ${short(a.goals.map((g) => g.slug))} vs ${short(b.goals.map((g) => g.slug))}.`);

  const oa = await withFour.orient('four-all');
  const ob = await stripped.orient('four-all');
  assert(oa.goalCount === ob.goalCount, `orient's goalCount must not depend on the four; got ${oa.goalCount} vs ${ob.goalCount}.`);
  assert(sameArray(oa.roots.map((r) => r.slug), ob.roots.map((r) => r.slug)),
    `orient's roots slice and its cap must not depend on the four; got ${short(oa.roots)} vs ${short(ob.roots)}.`);

  const pa = await withFour.proposals();
  const pb = await stripped.proposals();
  assert(sameArray(pa.proposals.map((p) => p.goal), pb.proposals.map((p) => p.goal)),
    'which proposals are open, and in what order, must not depend on the four.');
});

test('D17 (AC4 — pass-by-design): a goal with a high estimate does not outrank one with a low estimate', async () => {
  const goals = [
    row({ ...SEC_NONE, slug: 'low-estimate', capturedOn: '2026-07-09', chanceOfSuccess: 1 }, 1_780_000_100),
    row({ ...SEC_NONE, slug: 'high-estimate', capturedOn: '2026-07-08', chanceOfSuccess: 99 }, 1_780_000_200),
  ];
  const r = await drive({ goals }).list();
  assert(r.goals.length === 2, `expected both goals; got ${r.goals.length}.`);
  assert(sameArray(r.goals.map((g) => g.slug), ['low-estimate', 'high-estimate']),
    'the list order is the shipped capture-date order (newest first) and nothing else — an estimate is carried, ' +
    `never consulted. Got ${short(r.goals.map((g) => g.slug))}.`);
});

test('D18 (AC3, the majority case): a corpus in which no goal ever set any of the four answers on every surface without error', async () => {
  const goals = [row(SEC_PARENT, 1_780_000_000), row(SEC_NONE, 1_780_000_200)];
  const approved = proposalRow({ slug: 'a4', type: 'approved', goal: 'four-none', proposalId: 'q', happenedOn: '2026-07-06' }, 1_780_001_000);
  const d = drive({ goals, proposals: [approved] });
  const list = await d.list();
  assert(list.success === true && list.goals.length === 2, `the list must answer normally; got ${short(list)}`);
  for (const g of list.goals) assertFour(g, EXPECT_NONE, `the list row for '${g.slug}'`);
  const detail = await d.detail('four-none');
  assert(detail.success === true && detail.goal, `the detail must answer normally; got ${short(detail)}`);
  assertFour(detail.goal, EXPECT_NONE, 'the detail of a never-set goal');
  const orient = await d.orient('four-none');
  assert(orient.success === true && orient.served, `orient must answer normally; got ${short(orient)}`);
  assertFour(orient.served, EXPECT_NONE, 'the served goal of a never-set goal');
  const dir = await d.direction('four-none');
  assert(dir.eligible === true && dir.terms.estimate === null && dir.terms.estimateSource === 'absent',
    `the Direction transcription must answer normally with the estimate absent; got ${short(dir, 400)}`);
});

/* ══════════════════════════════════════════════════════════════════════
   S-class — structure-bounded source assertions (stack-free)
   ══════════════════════════════════════════════════════════════════════ */

test('S1 (purity — pass-by-design): the goals core stays dependency-free', () => {
  const src = safeRead(GOALS_CORE);
  assert(src, 'src/lib/brain/goals.js is unreadable.');
  assert(!/\brequire\s*\(/.test(src) && !/\bimport\s/.test(src),
    'the goals core must require/import nothing — purity is what makes it reusable and executable in the stack-free ' +
    'CI job (pinned by capture-a-goal-and-see-it S1).');
});

test('S2: the goals core exports the read-side projector alongside the write-side picker', () => {
  const core = loadGoalsCore();
  assert(typeof core.projectIntentFields === 'function',
    'src/lib/brain/goals.js must export projectIntentFields (ADR 0002 d2) — the four surfaces spread it.');
  assert(typeof core.pickIntentFields === 'function',
    'and must keep exporting pickIntentFields — story 1\'s write-side picker is untouched by this story.');
});

test('S3 (purity — pass-by-design): the Direction core stays dependency-free, which is why it names its three literally', () => {
  const src = safeRead(DIRECTION_CORE);
  assert(src, 'src/lib/brain/direction.js is unreadable.');
  const requires = [...src.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1]);
  assert(requires.length === 0,
    'the Direction core must stay dependency-free (pinned by operational-direction S1), so it cannot import the shared ' +
    `list of the four and names them literally instead (ADR 0002 d5). Found: ${requires.join(', ')}`);
});

test('S4: the brain read module gains no new import — the projector arrives through the goals core it already requires', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js is unreadable.');
  const specs = [...src.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1]);
  assert(specs.length > 0, 'the brain module must declare its imports via require().');
  const allowed = [/neo4j-driver$/, /middleware\/auth$/, /assistantKeys$/, /lib\/brain\/goals$/, /lib\/brain\/hygiene$/,
    /lib\/brain\/resources$/, /lib\/brain\/work-records$/, /lib\/brain\/proposals$/, /lib\/brain\/signals$/,
    /lib\/brain\/export$/, /lib\/brain\/direction$/];
  for (const spec of specs) {
    assert(allowed.some((re) => re.test(spec)),
      `unexpected import in the brain module: require('${spec}'). The read-side projector is a destructured name from ` +
      'the goals core, not a new module — the module\'s require list is an allow-list pinned across six second-brain suites.');
  }
});

test('S5 (ADR d6 — pass-by-design): the blinded step and chain projections stay closed to goal content', () => {
  const src = safeRead(DIRECTION_CORE);
  for (const fn of ['blindSteps', 'identify']) {
    const body = needBody(src, fn, 'src/lib/brain/direction.js');
    const named = fourNamesIn(body);
    assert(named.length === 0,
      `${fn}() must never carry any of the four: a boundary judge sees exactly two strings, and a chain entry is ` +
      `{slug, uuid} by construction. Found ${short(named)} in its body.`);
  }
});

test('S6 (AC4 — pass-by-design): no sort, filter, cap, gate, tie-break or refusal reads any of the four', () => {
  const goalsSrc = safeRead(GOALS_CORE);
  const dirSrc = safeRead(DIRECTION_CORE);
  const propSrc = safeRead(PROPOSALS_CORE);
  const regions = [
    ['deriveStanding', goalsSrc, 'src/lib/brain/goals.js'],
    ['resolveCaptureDate', goalsSrc, 'src/lib/brain/goals.js'],
    ['sortGoals', goalsSrc, 'src/lib/brain/goals.js'],
    ['slugIndex', goalsSrc, 'src/lib/brain/goals.js'],
    ['resolveDecomposition', goalsSrc, 'src/lib/brain/goals.js'],
    ['validateDecompositionOp', goalsSrc, 'src/lib/brain/goals.js'],
    ['openProposals', propSrc, 'src/lib/brain/proposals.js'],
    ['proposalEntry', propSrc, 'src/lib/brain/proposals.js'],
    ['resolveAnchor', dirSrc, 'src/lib/brain/direction.js'],
    ['boundarySteps', dirSrc, 'src/lib/brain/direction.js'],
    ['applyBoundaryVerdicts', dirSrc, 'src/lib/brain/direction.js'],
  ];
  assert(regions.length === 11, 'the AC4 region list changed shape.');
  for (const [fn, src, file] of regions) {
    const body = needBody(src, fn, file);
    const named = fourNamesIn(body);
    assert(named.length === 0,
      `${fn}() in ${file} references ${short(named)}. The four are CARRIED, never CONSULTED (AC4): no standing rule, ` +
      'sort key, slug resolution, cap, tie-break, validation or refusal may read what they contain.');
  }
});

test('S7 (ADR d8 — pass-by-design): the export core still emits the stored section as stored, and names none of the four', () => {
  const src = safeRead(EXPORT_CORE);
  assert(src, 'src/lib/brain/export.js is unreadable.');
  const body = needBody(src, 'familyEntries', 'src/lib/brain/export.js');
  const named = fourNamesIn(body);
  assert(named.length === 0,
    `the export must stay a VERBATIM surface — it carries whatever the record holds, including out-of-contract riders. ` +
    `Naming ${short(named)} there would NARROW a path that currently carries everything.`);
  assert(/section/.test(body), 'the export must still emit the raw stored section.');
});

test('S8 (scope — pass-by-design): the Direction endpoint keeps its raw-record estimate read; retiring the workaround is not this story', () => {
  const dirSrc = safeRead(DIRECTION_CORE);
  assert(/function\s+parseEstimate\s*\(/.test(dirSrc),
    'parseEstimate must survive: this story makes the raw-record workaround unnecessary, it does not retire it (ADR 0002 d5, Out of scope).');
  const apiSrc = safeRead(BRAIN_API);
  assert(/readGoalRowsAndResolved/.test(apiSrc) && /parseEstimate\s*\(/.test(apiSrc),
    'the Direction handler must still read the estimate off the raw row through parseEstimate — its derivation is byte-unchanged here.');
});

/* ══════════════════════════════════════════════════════════════════════
   H-class — the live stack, READ-ONLY and FIXTURE-FREE (SKIP when absent)
   ══════════════════════════════════════════════════════════════════════ */

htest('H1 (evidence — pass-by-design): the live corpus still holds what these live checks discriminate on', () => {
  const bySlug = liveSections();
  const sections = [...bySlug.values()];
  const census = { total: sections.length, storedFalse: 0, neverSetAnything: 0, multiLinePrompt: 0, partialSubset: 0, ratified: 0 };
  for (const s of sections) {
    const present = EXPECTED_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(s, f));
    if (present.length === 0) census.neverSetAnything += 1;
    if (present.length > 0 && present.length < EXPECTED_FIELDS.length) census.partialSubset += 1;
    if (s.needsHumanInput === false || s.needsBreakdown === false) census.storedFalse += 1;
    if (typeof s.prompt === 'string' && s.prompt.includes('\n')) census.multiLinePrompt += 1;
  }
  const approved = new Set((liveExport().content.proposals || [])
    .filter((p) => p && p.section && p.section.type === 'approved' && typeof p.section.goal === 'string')
    .map((p) => p.section.goal));
  census.ratified = [...approved].filter((s) => bySlug.has(s)).length;
  console.log(`      live corpus census: ${JSON.stringify(census)}`);

  assert(census.storedFalse > 0,
    'no live goal stores a flag as false any more, so the stored-false vs never-set discrimination has no live ' +
    'evidence left. The D-class still covers it deterministically; this test is the LIVE claim and it can no longer be made.');
  assert(census.neverSetAnything > 0,
    'every live goal now carries at least one of the four, so "never set" has no live evidence left.');
  assert(census.multiLinePrompt > 0,
    'no live goal carries a multi-line prompt any more, so AC2\'s byte-identity claim has no live evidence left ' +
    '(H3 depends on this; the D-class still covers AC2 deterministically).');
  assert(census.ratified > 0,
    'no live goal is owner-ratified any more, so the Direction transcription cannot be read live (H5 depends on this).');
});

htest('H2 (AC1/AC3): every live goal reads back on the goals list exactly as the export stores it', () => {
  const bySlug = liveSections();
  const r = loopbackGetJson('/api/brain/goals', 40000);
  assert(r && r.success === true && Array.isArray(r.goals),
    `GET /api/brain/goals must answer {success, goals[]}; got ${short(r)}`);
  assert(r.goals.length > 0, 'the live goals list is empty — nothing to compare.');
  let compared = 0;
  let sawStored = 0;
  let sawNeverSet = 0;
  for (const g of r.goals) {
    const section = bySlug.get(g.slug);
    if (!section) continue;
    const expected = expectedFrom(section);
    assertFour(g, expected, `the live goals list row for '${g.slug}'`);
    compared += EXPECTED_FIELDS.length;
    for (const f of EXPECTED_FIELDS) {
      if (expected[f] === null) sawNeverSet += 1; else sawStored += 1;
    }
  }
  assert(compared > 0,
    'not one live goal was actually compared — the sweep matched nothing and would have passed vacuously (OPEN.md #108).');
  assert(sawStored > 0 && sawNeverSet > 0,
    `the sweep must exercise BOTH sides: ${sawStored} stored values and ${sawNeverSet} never-set properties were compared.`);
});

htest('H3 (AC2): every prompt stored in the live corpus comes back byte-identical on the goals list', () => {
  const bySlug = liveSections();
  const withPrompt = [...bySlug.entries()].filter(([, s]) => typeof s.prompt === 'string' && s.prompt !== '');
  assert(withPrompt.length > 0, 'no live goal stores a prompt — H1 should have caught this first.');
  const r = loopbackGetJson('/api/brain/goals', 40000);
  let checked = 0;
  for (const [slug, section] of withPrompt) {
    const g = r.goals.find((x) => x.slug === slug);
    assert(g, `the goal '${slug}' carries a prompt in the export but is missing from the goals list.`);
    assert(g.prompt === section.prompt,
      `'${slug}': the prompt must be byte-identical on the LIST surface — not truncated, reflowed, re-escaped or ` +
      `replaced by a presence indicator. Stored ${section.prompt.length} chars, list returned ` +
      `${typeof g.prompt === 'string' ? g.prompt.length : quoted(g.prompt)}.`);
    checked += 1;
  }
  assert(checked === withPrompt.length, `expected to check ${withPrompt.length} prompts; checked ${checked}.`);
});

htest('H4 (AC1/AC3): a live goal reads back with its four on the goal detail and on the orientation read', () => {
  const bySlug = liveSections();
  const carriers = [...bySlug.entries()]
    .filter(([, s]) => EXPECTED_FIELDS.some((f) => Object.prototype.hasOwnProperty.call(s, f)));
  assert(carriers.length > 0, 'no live goal carries any of the four — H1 should have caught this first.');
  const neverSet = [...bySlug.entries()]
    .filter(([, s]) => !EXPECTED_FIELDS.some((f) => Object.prototype.hasOwnProperty.call(s, f)));
  assert(neverSet.length > 0, 'no live goal is free of all four — H1 should have caught this first.');

  for (const [slug, section] of [carriers[0], neverSet[0]]) {
    const expected = expectedFrom(section);
    const detail = loopbackGetJson(`/api/brain/goals/${encodeURIComponent(slug)}`, 40000);
    assert(detail && detail.success === true && detail.goal, `the detail read for '${slug}' answered ${short(detail)}`);
    assertFour(detail.goal, expected, `the live goal detail for '${slug}'`);
    const orient = loopbackGetJson(`/api/brain/orient?goal=${encodeURIComponent(slug)}`, 40000);
    assert(orient && orient.success === true && orient.served, `the orientation read for '${slug}' answered ${short(orient)}`);
    assertFour(orient.served, expected, `the live orientation read's served goal for '${slug}'`);
    assert(Array.isArray(orient.roots), 'orient must still answer a roots slice.');
    for (const root of orient.roots) assertNoFour(root, 'a live orientation roots entry');
  }
});

htest('H5 (AC1/AC3): the live Direction transcription carries the three by name and keeps the estimate under its own word', () => {
  const bySlug = liveSections();
  const approved = [...new Set((liveExport().content.proposals || [])
    .filter((p) => p && p.section && p.section.type === 'approved' && typeof p.section.goal === 'string')
    .map((p) => p.section.goal))].filter((s) => bySlug.has(s));
  assert(approved.length > 0, 'no ratified live goal — H1 should have caught this first.');
  let checked = 0;
  for (const slug of approved) {
    const r = loopbackGetJson(`/api/brain/direction/${encodeURIComponent(slug)}`, 40000);
    if (r.eligible !== true) continue;      // stale/broken anchors are other stories' business
    const section = bySlug.get(slug);
    const expected = expectedFrom(section);
    for (const f of ['prompt', 'needsHumanInput', 'needsBreakdown']) {
      assert(Object.prototype.hasOwnProperty.call(r.terms, f),
        `the live transcription for '${slug}' must carry '${f}'; got keys ${short(Object.keys(r.terms))}.`);
      assert(Object.is(r.terms[f], expected[f]),
        `'${slug}': terms.${f} must read ${quoted(expected[f])}; got ${quoted(r.terms[f])}.`);
    }
    const storedEstimate = section.chanceOfSuccess;
    const numeric = typeof storedEstimate === 'number' && Number.isFinite(storedEstimate);
    assert(Object.is(r.terms.estimate, numeric ? storedEstimate : null),
      `'${slug}': the estimate travels as terms.estimate and its derivation is byte-unchanged by this story; ` +
      `expected ${quoted(numeric ? storedEstimate : null)}, got ${quoted(r.terms.estimate)}.`);
    assert(r.terms.estimateSource === (numeric ? 'goal' : 'absent'),
      `'${slug}': estimateSource must stay ${numeric ? "'goal'" : "'absent'"}; got ${quoted(r.terms.estimateSource)}.`);
    checked += 1;
  }
  assert(checked > 0, 'no ratified live goal answered eligible, so nothing was actually checked (OPEN.md #108).');
});

htest('H6 (AC3, verbatim surface — pass-by-design): the live export still omits the key for every never-set property', () => {
  const bySlug = liveSections();
  let omissions = 0;
  for (const [, section] of bySlug) {
    for (const f of EXPECTED_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(section, f)) {
        assert(section[f] !== null,
          `the export carries '${f}' as null on a live goal. Absence on a stored record is KEY-ABSENCE — the only ` +
          'representation that survives storage, export and restore. Writing null (or 0, or false) here would be ' +
          'restored back into the record permanently.');
      } else {
        omissions += 1;
      }
    }
  }
  assert(omissions > 0, 'no live goal omits any of the four — the omission claim has no live evidence (OPEN.md #108).');
});

htest('H7 (AC4): the live goals list still returns every goal the export holds — nothing is filtered by what the four contain', () => {
  const bySlug = liveSections();
  const r = loopbackGetJson('/api/brain/goals', 40000);
  const listed = new Set(r.goals.map((g) => g.slug));
  const missing = [...bySlug.keys()].filter((s) => !listed.has(s));
  assert(missing.length === 0,
    `every parser-valid goal must still be listed — no ranking, filtering or gating keys off the four. Missing: ${short(missing)}`);
  assert(listed.size === bySlug.size,
    `the list and the export must hold the same goal set; list ${listed.size} vs export ${bySlug.size}.`);
  const orient = loopbackGetJson('/api/brain/orient', 40000);
  assert(orient.goalCount === r.goals.length,
    `orient's goalCount must still equal the number of goals; got ${orient.goalCount} vs ${r.goals.length}.`);
});

htest('H8 (second-brain AC6 — pass-by-design): the live proposal queue carries no key that reads as a score, rank or percentage', () => {
  const q = loopbackGetJson('/api/brain/proposals', 40000);
  assert(q && q.success === true && Array.isArray(q.proposals), `the queue must answer {success, proposals[]}; got ${short(q)}`);
  if (q.proposals.length === 0) {
    console.log('      (the live queue is empty; the D-class covers the card shape deterministically)');
    return;
  }
  for (const card of q.proposals) {
    for (const k of Object.keys(card)) {
      assert(!/score|rank|percent/i.test(k),
        `a closed book forbids a numeric score, percentage, gauge or ranking number on an owner-facing proposal — found key '${k}'.`);
    }
  }
});

/* ══════════════════════════════════════════════════════════════════════
   R-class — regression sentinels (pass BEFORE and after)
   ══════════════════════════════════════════════════════════════════════ */

test('R1 (closed book): an absent estimate is still recorded as absent, never invented — the pin this story must leave green', () => {
  const core = loadDirectionCore();
  const t = core.deriveTerms({ slug: 'some-goal', statement: 'a', deliverable: 'b', boundary: 'c' }, null);
  assert(t.estimate === null,
    `operational-direction U25 (a CLOSED book, live in production): an absent estimate must be null, never a default ` +
    `number; got ${quoted(t.estimate)}.`);
  assert(t.estimateSource === 'absent',
    `and the artifact must record it as ABSENT rather than invent one; got ${quoted(t.estimateSource)}.`);
});

test('R2 (second-brain ADR 0005 d11): the orientation read\'s roots slice is still the bounded {slug, name, standing} projection', async () => {
  const r = await drive({ goals: corpus() }).orient(null);
  assert(Array.isArray(r.roots) && r.roots.length === 4, `expected 4 root goals; got ${short(r.roots)}`);
  for (const root of r.roots) {
    assert(sameArray(Object.keys(root), ['slug', 'name', 'standing']),
      'boundedness is a ratified property of this response: roots stays a slice of {slug, name, standing}, and the ' +
      `goal in full lives in \`served\`. Got ${short(Object.keys(root))}.`);
  }
});

test('R3 (scope): the write side is untouched — the write-side picker still expresses absence as key-absence', () => {
  const core = loadGoalsCore();
  assert(typeof core.pickIntentFields === 'function', 'goal-intent-fields #1 shipped pickIntentFields; it must survive.');
  const out = core.pickIntentFields({ needsHumanInput: false });
  assert(Object.is(out.needsHumanInput, false), 'a supplied false must still be written.');
  for (const f of ['prompt', 'chanceOfSuccess', 'needsBreakdown']) {
    assert(!Object.prototype.hasOwnProperty.call(out, f),
      `on a stored RECORD absence stays key-absence — the read side's null is a different convention for a different ` +
      `place, and collapsing the two is a regression, not a cleanup. Got keys ${short(Object.keys(out))}.`);
  }
});

/* ══════════════════════════════════════════════════════════════════════ */

async function run() {
  console.log('\n=== return-the-four-on-every-read-surface (goal-intent-fields #2) ===');
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
  // OPEN.md #104/#106: a fully-skipped H-class is otherwise indistinguishable
  // from a real pass. Say so out loud, and let a gate demand live execution.
  console.log(`return-the-four: H-class ${hExecuted} executed / ${hSkipped} skipped`);
  if (hSkipped > 0 && hExecuted === 0) {
    console.log('return-the-four: !! LIVE COVERAGE DID NOT RUN — every H-class assertion skipped (stack unreachable). ' +
      'The D-class still drove all five surfaces stack-free.');
    if (process.env.TAPESTRY_REQUIRE_LIVE === '1') {
      const msg = 'TAPESTRY_REQUIRE_LIVE=1 was set but the whole H-class skipped — the live stack was unreachable.';
      console.log(`  FAIL  H-class execution required\n        ${msg}`);
      failures.push({ name: 'H-class execution required', message: msg });
      fail++;
    }
  }
  console.log(`\nreturn-the-four-on-every-read-surface: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped, hExecuted, hSkipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
