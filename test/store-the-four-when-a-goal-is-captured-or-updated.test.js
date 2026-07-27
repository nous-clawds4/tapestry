/**
 * Story 1 (epic: goal-intent-fields) — Store the four when a goal is captured
 * or updated.
 *
 * Story: engineering-team/stories/goal-intent-fields/1-store-the-four-when-a-goal-is-captured-or-updated.md
 * ADR:   engineering-team/decisions/goal-intent-fields/0001-shared-intent-field-picker-and-provisioned-schema.md
 * Book:  engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md
 *
 * The four, in the concept's own declared names:
 *   prompt (string) · chanceOfSuccess (number) · needsHumanInput (boolean) ·
 *   needsBreakdown (boolean).
 *
 * Test classes (per test-hermeticity-ci/0001):
 *
 *   U-class (EXECUTED, stack-free, always gates CI) — the new pure picker in
 *     src/lib/brain/goals.js: INTENT_FIELDS, and pickIntentFields over
 *     SYNTHETIC input. Each field alone; all four; none; `undefined` omitted
 *     vs `null` STORED; falsy-but-supplied (0 / false / '') kept; no trim on a
 *     padded multi-line markdown prompt; no coercion of a numeric string;
 *     nothing outside the four copied; non-mutation; deterministic key order.
 *
 *   S-class (source assertions, stack-free, structure-bounded) — the picker is
 *     applied at the HANDLER (the trust boundary) on all three constructing
 *     write paths and no raw req.body reaches a core; the four never enter
 *     handleUpdateGoalIntent's empty-value / trim region (ADR d4 — "the one
 *     place the obvious implementation is wrong"); GOAL_SCHEMA declares all
 *     four with `required` unmoved and the single-concept-object wrapper
 *     intact; the seven replicating paths gain NO whitelist; no clamp, coercion
 *     or range rule anywhere on the goal write path; gates, routes, privacy
 *     posture and firmware unchanged.
 *
 *   H-class (live local stack, per-test SKIP when unreachable) — capture
 *     through BOTH constructing capture paths with a SUBSET supplied, read back
 *     through GET /api/brain/export (which returns each stored section
 *     VERBATIM), asserting the supplied keys carry the supplied values and the
 *     unsupplied keys are ABSENT from the section; a multi-line markdown prompt
 *     byte-identical on round-trip; an update that sets one of the four leaves
 *     the other three and every pre-existing field untouched; the two refusal
 *     traps (prompt:'' and chanceOfSuccess:0 must both be accepted); an
 *     adversarial-looking prompt stored unexamined; the replicating
 *     create-element path still carrying all four; and the fresh-instance
 *     schema constant mirroring the live concept's own four declarations.
 *     Fixtures are sentinel-named with pre-clean + raw teardown (the ADR
 *     0003/0004 precedent) — no real goal is ever written or mutated, and a
 *     before/after export snapshot proves it.
 *
 *   R-class (regression sentinels, stack-free) — the goal shape's single
 *     exact-key sentinel (R1), the Direction core keeping its local
 *     chanceOfSuccess read (operational-direction ADR 0001 d6 — retiring it is
 *     story 2's call), and the goals core keeping every export it already had.
 *     **R1 was RE-AIMED by goal-intent-fields #2** (ADR 0002 d1), which it
 *     named as its re-pin: the goal shape grows from ten fields to fourteen, so
 *     R1 alone in this suite fails until #2's parser change lands. R2/R3 still
 *     pass before and after.
 *
 * ── Pass-by-design sentinels (they pass BEFORE the Implementer touches
 *    anything, and must STILL pass after) — 16 of 40. Stated here so a green
 *    line is never mistaken for evidence the feature landed: ──
 *      S1  goals.js zero-require purity
 *      S4  the four are absent from the empty-value / trim region
 *      S7  the seven replicating paths carry no whitelist
 *      S8  no clamp / coercion / range rule on the goal write path
 *      S9  no new goal-write endpoint (Option D was rejected)
 *      S10 the three in-handler owner gates
 *      S11 privacy posture: publishToStrfry + importEventDirect only
 *      S12 ensureGoalConcept hands GOAL_SCHEMA to save-schema
 *      S13 firmware carries no goal concept (no reinstall required)
 *      S14 the untouchables stay free of the four
 *      H3  a capture with none of the four still succeeds
 *      H9  the replicating create-element path already carries all four
 *      H11 no goal outside the fixtures is written or moved
 *      R2/R3 the scope sentinels (R1 was re-aimed by #2 — see the R-class note)
 *    The other 24 FAIL until the feature lands.
 *
 * ── Harness defects this suite is designed around (OPEN.md) ──
 *   #104/#106 — a fully-skipped H-class still reports suite PASS. run() prints
 *     an explicit `H-class: n executed / m skipped` line and shouts when the
 *     live class did not run; TAPESTRY_REQUIRE_LIVE=1 turns an all-skipped
 *     H-class into a suite FAILURE, so a gate can demand live execution. The
 *     reachability probe also retries (the recorded false-negative mode).
 *   #108 — vacuous iteration. Every loop over a collection asserts arity FIRST
 *     (Array.isArray(x) && x.length === N), and every U-class loop iterates the
 *     SPEC's own field list, never the list the implementation exports.
 *   #109 — byte-offset source assertions. No fixed-width src.slice anywhere:
 *     function bodies are bounded by the NEXT top-level declaration, object
 *     literals by brace matching (and then EVALUATED, so a mis-slice fails
 *     loudly instead of passing).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GOALS_CORE = path.join(ROOT, 'src/lib/brain/goals.js');
const DIRECTION_CORE = path.join(ROOT, 'src/lib/brain/direction.js');
const NORMALIZE_INDEX = path.join(ROOT, 'src/api/normalize/index.js');
const IO_INDEX = path.join(ROOT, 'src/api/io.js');
const EVENT_SYNC = path.join(ROOT, 'src/api/neo4j/eventSync.js');
const RELATIONSHIPS = path.join(ROOT, 'src/api/normalize/relationships.js');
const PROBE = path.join(ROOT, 'src/api/normalize/probe.js');
const AUTH = path.join(ROOT, 'src/middleware/auth.js');
const DTAG_CORE = path.join(ROOT, 'src/lib/dtag.js');
const FIRMWARE_DIR = path.join(ROOT, 'firmware');

const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

const GOAL_CONCEPT_NAME = 'tapestry owner goal';
const GOAL_CONCEPT_SLUG = 'tapestry-owner-goal';
const GOAL_SCHEMA_SLUG = 'tapestry-owner-goal-schema';

/**
 * THE SPEC's own list — the four in the concept's declared names and order.
 * U-class iterates THIS, never the constant the implementation exports: a loop
 * over an empty/absent export would run zero bodies and pass vacuously
 * (OPEN.md row 108).
 */
const EXPECTED_FIELDS = ['prompt', 'chanceOfSuccess', 'needsHumanInput', 'needsBreakdown'];
/** The declared JSON-Schema type of each, read from the live concept (ADR context). */
const EXPECTED_TYPES = { prompt: 'string', chanceOfSuccess: 'number', needsHumanInput: 'boolean', needsBreakdown: 'boolean' };
/** The eight GOAL_SCHEMA declares today — the four are ADDITIVE to these. */
const EXISTING_SCHEMA_PROPS = ['name', 'slug', 'description', 'origin', 'capturedOn', 'deliverable', 'boundary', 'parent'];

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function short(x, n = 300) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}
/** JSON-quoted, so whitespace differences are visible in a failure message. */
function quoted(x, n = 240) { return String(JSON.stringify(x)).slice(0, n); }
function sameArray(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}

/* ── structure-bounded source extraction (never a byte window; OPEN.md #109) ── */

/**
 * Blank out whole-line comments, preserving every other line verbatim. A
 * function body bounded by the next top-level declaration picks up the banner
 * comment that introduces the NEXT section, and those banners name the very
 * tokens these pins forbid ("… never publishEverywhere"). Only whole-line
 * comments are removed: stripping trailing `//` would corrupt code lines that
 * carry a URL inside a string literal, which could delete real code and turn a
 * violation into a green line.
 */
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
 * round (OPEN.md row 109), so no assertion in this suite uses one.
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

/** A top-level `const NAME = { … }` object literal, bounded by brace matching. */
function objectLiteralText(src, name) {
  const m = new RegExp(`\\nconst\\s+${name}\\s*=\\s*\\{`).exec(src);
  if (!m) return '';
  const open = src.indexOf('{', m.index);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(open, i + 1); }
  }
  return '';
}

/**
 * The same literal, EVALUATED. A mis-slice or a moved declaration then fails
 * loudly with a parse error instead of quietly matching nothing — the failure
 * mode row 109 is about. Requires the constant to stay a self-contained literal.
 */
function evalObjectLiteral(src, name) {
  const text = objectLiteralText(src, name);
  assert(text, `could not locate the top-level object literal \`const ${name} = {…}\` in the source.`);
  try {
    // eslint-disable-next-line no-new-func
    return new Function(`return (${text});`)();
  } catch (e) {
    throw new Error(
      `${name} no longer evaluates as a self-contained object literal (${e.message}). This pin reads the constant ` +
      'straight from source because a fresh instance provisions from it without a running server — keep it a plain literal.');
  }
}

/** The text between two structural markers inside an already-bounded region. */
function between(text, startMarker, endMarker) {
  const a = text.indexOf(startMarker);
  if (a === -1) return '';
  const b = text.indexOf(endMarker, a + startMarker.length);
  return b === -1 ? text.slice(a) : text.slice(a, b);
}

/* ── U-class loading ─────────────────────────────────────────────────────── */

function loadGoalsCore() {
  if (!fs.existsSync(GOALS_CORE)) throw new Error('src/lib/brain/goals.js missing — second-brain #1 regression.');
  try { return require(GOALS_CORE); }
  catch (e) { throw new Error(`src/lib/brain/goals.js failed to require: ${e.message}`); }
}
function needPicker() {
  const core = loadGoalsCore();
  assert(typeof core.pickIntentFields === 'function',
    'src/lib/brain/goals.js does not export pickIntentFields() yet — the shared intent picker (ADR 0001 d2) ' +
    'is not implemented, so nothing carries the four onto a goal section.');
  return core.pickIntentFields;
}

/* ── live-stack helpers (H-class; the house pattern) ──────────────────────── */

function dockerCurl(args, timeout = 20000) {
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], { encoding: 'utf8', timeout });
}
function loopbackGetJson(pathname, timeout = 20000) {
  const out = dockerCurl(['-s', '-m', '40', `${CONTAINER_BASE}${pathname}`], timeout + 25000);
  try { return JSON.parse(out); }
  catch { throw new Error(`loopback GET ${pathname} did not return JSON: ${short(out)}`); }
}
function loopbackPostJson(pathname, body) {
  const out = dockerCurl(['-s', '-m', '30', '-X', 'POST', '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(body), `${CONTAINER_BASE}${pathname}`], 45000);
  try { return JSON.parse(out); }
  catch { throw new Error(`loopback POST ${pathname} did not return JSON: ${short(out)}`); }
}

/**
 * Reachability, RETRIED. The single-shot probe is a recorded false-negative
 * source (OPEN.md #104/#106): identical code flipped ten H tests between
 * executed and skipped across consecutive runs. Three attempts at a 5s budget
 * (the harness ceiling) makes a skip mean "no stack", not "busy container".
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

let taPubkey = null;
function getTaPubkey() {
  if (taPubkey) return taPubkey;
  const r = loopbackGetJson('/api/assistant/pubkey');
  assert(r && r.success && /^[0-9a-f]{64}$/.test(r.pubkey || ''),
    `could not resolve the runtime TA pubkey via /api/assistant/pubkey (got ${short(r)}). Never hardcode it.`);
  taPubkey = r.pubkey;
  return taPubkey;
}
let _dtag = null;
function dtagCore() { if (!_dtag) _dtag = require(DTAG_CORE); return _dtag; }
function goalHeaderUuid() { return `39998:${getTaPubkey()}:${GOAL_CONCEPT_SLUG}`; }
function goalDtag(name) { return dtagCore().childDTag(name, goalHeaderUuid()); }

/** The whole export artifact — each entry is {name, section} with the section RAW. */
function exportArtifact() {
  const art = loopbackGetJson('/api/brain/export', 60000);
  assert(art && art.content && Array.isArray(art.content.goals),
    `GET /api/brain/export must answer an artifact with content.goals[] (got ${short(art)}).`);
  return art;
}
function exportGoals() { return exportArtifact().content.goals; }
/** Exactly one exported goal by slug — the arity assertion is the point (#108). */
function goalSection(slug, entries) {
  const all = entries || exportGoals();
  const hits = all.filter((e) => e && e.section && e.section.slug === slug);
  assert(hits.length === 1,
    `expected exactly ONE exported goal with slug '${slug}'; found ${hits.length}. ` +
    (hits.length === 0 ? 'The capture did not land (or was refused).' : 'Fixture teardown from a prior run may be incomplete.'));
  return hits[0].section;
}
/**
 * A stable, comparable digest of every NON-fixture record in the WHOLE brain —
 * goals and all four record families. This is the "nothing else moved" probe:
 * teardown deletes by a value-scoped sentinel sweep, and this is what proves
 * the sweep never reached a real record.
 */
function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}
function realBrainDigest(artifact) {
  const art = artifact || exportArtifact();
  const lines = [];
  for (const family of Object.keys(art.content).sort()) {
    const entries = Array.isArray(art.content[family]) ? art.content[family] : [];
    for (const e of entries) {
      if (!e || !e.section) continue;
      const text = stableStringify(e.section);
      if (String(e.name || '').startsWith('harness intent') || text.includes(FIX_SENTINEL)) continue;
      lines.push(`${family} ${e.name} ${text}`);
    }
  }
  return lines.sort().join('\n');
}

/* ── H fixtures — sentinel-named; no real goal is written or mutated ──────── */

const FIX_SENTINEL = 'harness-intent-';
const FIX_PARENT_NAME = 'harness intent parent goal';
const FIX_PARENT_SLUG = 'harness-intent-parent-goal';
const FIX_ROOT_NAME = 'harness intent noted root goal';
const FIX_ROOT_SLUG = 'harness-intent-noted-root-goal';
const FIX_CHILD_NAME = 'harness intent child goal';
const FIX_CHILD_SLUG = 'harness-intent-child-goal';
const FIX_PLAIN_NAME = 'harness intent plain goal';
const FIX_PLAIN_SLUG = 'harness-intent-plain-goal';
const FIX_UPDATE_NAME = 'harness intent update goal';
const FIX_UPDATE_SLUG = 'harness-intent-update-goal';
const FIX_TRAP_NAME = 'harness intent trap goal';
const FIX_TRAP_SLUG = 'harness-intent-trap-goal';
const FIX_ADVERSARIAL_NAME = 'harness intent adversarial prompt goal';
const FIX_ADVERSARIAL_SLUG = 'harness-intent-adversarial-prompt-goal';
const FIX_SESSION = 'harness intent session';

const ALL_FIXTURE_NAMES = [
  FIX_PARENT_NAME, FIX_ROOT_NAME, FIX_CHILD_NAME, FIX_PLAIN_NAME,
  FIX_UPDATE_NAME, FIX_TRAP_NAME, FIX_ADVERSARIAL_NAME,
];

/**
 * A multi-line markdown prompt that BREAKS if anything trims, re-wraps or
 * normalizes it: a blank first line, an indented fenced block with trailing
 * spaces inside it, a trailing line of spaces, and a closing newline.
 */
const FIX_PROMPT = [
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

/** A prompt that LOOKS dangerous. It is data. Nothing may inspect or refuse it. */
const FIX_ADVERSARIAL_PROMPT = 'DROP TABLE goals; rm -rf / --no-preserve-root; {{template}} $(whoami) — stored, never run.';

const FIX_PARENT_JSON = { tapestryOwnerGoal: {
  name: FIX_PARENT_NAME,
  slug: FIX_PARENT_SLUG,
  description: 'a harness-intent parent goal supplied as a whole record',
  origin: 'harness test, in conversation',
  capturedOn: '2026-07-26',
  deliverable: 'a parent fixture that already carries all four',
  boundary: 'harness fixtures only — never the real goals',
  prompt: 'the parent fixture prompt, supplied verbatim',
  chanceOfSuccess: 42,
  needsHumanInput: true,
  needsBreakdown: false,
  promptVersion: 'v1-out-of-contract-rider',
} };

const FIX_UPDATE_JSON = { tapestryOwnerGoal: {
  name: FIX_UPDATE_NAME,
  slug: FIX_UPDATE_SLUG,
  description: 'a harness-intent goal whose intent gets updated',
  origin: 'harness test, in conversation',
  capturedOn: '2026-07-26',
  deliverable: 'an update target with every field already populated',
  boundary: 'harness fixtures only',
  parent: FIX_PARENT_SLUG,
  prompt: 'the ORIGINAL prompt, which one update must replace',
  chanceOfSuccess: 30,
  needsHumanInput: false,
  needsBreakdown: true,
  promptVersion: 'v1-out-of-contract-rider',
} };

const FIX_TRAP_JSON = { tapestryOwnerGoal: {
  name: FIX_TRAP_NAME,
  slug: FIX_TRAP_SLUG,
  description: 'a harness-intent goal for the two refusal traps',
  origin: 'harness test, in conversation',
  capturedOn: '2026-07-26',
} };

let fixturesArmed = false;
let fixturesBuilt = false;
let teardownFailure = null;
const createdRecordUuids = [];   // note-goal-idea's `noted` work records (random d-tags)

function fixtureDtags() {
  return ALL_FIXTURE_NAMES.map(goalDtag);
}
function fixtureUuids() {
  const ta = getTaPubkey();
  return fixtureDtags().map((d) => `39999:${ta}:${d}`);
}
/** Every element whose stored json carries the sentinel — catches the random-d-tag records. */
function sentinelUuidsFromNeo4j() {
  const r = loopbackPostJson('/api/neo4j/query', {
    cypher: `MATCH (e:NostrEvent)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
             WHERE j.value CONTAINS $sentinel RETURN DISTINCT e.uuid AS uuid`,
    params: { sentinel: FIX_SENTINEL },
  });
  const rows = (r && Array.isArray(r.data)) ? r.data : [];
  return rows.map((x) => x && x.uuid).filter(Boolean);
}
function dTagFromUuid(uuid) { return String(uuid).split(':').slice(2).join(':'); }

function deleteFixturesFromStrfry() {
  const discovered = (() => { try { return sentinelUuidsFromNeo4j().map(dTagFromUuid); } catch { return []; } })();
  const dtags = [...new Set([...fixtureDtags(), ...createdRecordUuids.map(dTagFromUuid), ...discovered])].filter(Boolean);
  for (const dTag of dtags) {
    const scan = loopbackGetJson(
      `/api/strfry/scan?filter=${encodeURIComponent(JSON.stringify({ kinds: [39999], '#d': [dTag] }))}`);
    const events = Array.isArray(scan && scan.events) ? scan.events : (Array.isArray(scan) ? scan : []);
    for (const ev of events) {
      if (ev && ev.id) {
        cp.execFileSync('docker', ['exec', CONTAINER, 'strfry', 'delete', `--filter={"ids":["${ev.id}"]}`],
          { encoding: 'utf8', timeout: 20000 });
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
    params: { uuids: [...fixtureUuids(), ...createdRecordUuids] },
  });
  assert(r1 && r1.success !== false, `fixture Neo4j teardown failed: ${short(r1)}`);
  // Value-scoped sweep for anything else the sentinel names (the `noted` work
  // records carry random d-tags). NEVER by z value — that is the goal header
  // uuid, shared with every real goal.
  const r2 = loopbackPostJson('/api/neo4j/query', {
    cypher: `MATCH (e:NostrEvent)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
             WHERE j.value CONTAINS $sentinel
             OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag) DETACH DELETE e, t`,
    params: { sentinel: FIX_SENTINEL },
  });
  assert(r2 && r2.success !== false, `fixture sentinel sweep failed: ${short(r2)}`);
  const r3 = loopbackPostJson('/api/neo4j/query', {
    cypher: `MATCH (t:NostrEventTag) WHERE (t.type = 'd' AND t.value IN $dtags)
             OR (t.type = 'name' AND t.value IN $names)
             OR (t.type = 'json' AND t.value CONTAINS $sentinel)
             DETACH DELETE t`,
    params: { dtags: fixtureDtags(), names: ALL_FIXTURE_NAMES, sentinel: FIX_SENTINEL },
  });
  assert(r3 && r3.success !== false, `fixture orphan-tag sweep failed: ${short(r3)}`);
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

function createElementGoal(name, json) {
  const created = loopbackPostJson('/api/normalize/create-element', { concept: GOAL_CONCEPT_NAME, name, json });
  assert(created && created.success === true,
    `create-element rejected the '${name}' fixture (got ${short(created, 400)}).`);
  return created;
}
function noteIdea(body) {
  const r = loopbackPostJson('/api/normalize/note-goal-idea', body);
  if (r && r.success === true && r.record && r.record.uuid) createdRecordUuids.push(r.record.uuid);
  return r;
}
function createChild(body) { return loopbackPostJson('/api/normalize/create-child-goal', body); }
function updateIntent(body) { return loopbackPostJson('/api/normalize/update-goal-intent', body); }

/** The three record-supplied fixtures, created once. Arms teardown FIRST. */
let baselineDigest = null;
function armFixtures() {
  if (fixturesBuilt) return;
  fixturesArmed = true;              // arm teardown before any write
  preCleanFixtures();
  baselineDigest = realBrainDigest();
  createElementGoal(FIX_PARENT_NAME, FIX_PARENT_JSON);
  createElementGoal(FIX_UPDATE_NAME, FIX_UPDATE_JSON);
  createElementGoal(FIX_TRAP_NAME, FIX_TRAP_JSON);
  fixturesBuilt = true;
}

/** "Absent" means the key is not there at all — never `undefined`, never null. */
function assertAbsent(section, field, why) {
  assert(!Object.prototype.hasOwnProperty.call(section, field),
    `'${field}' must be ABSENT from the stored record when it was not supplied (${why}); ` +
    `the section carries it as ${short(JSON.stringify(section[field]))}. ` +
    'Absence is the only representation of "unset" that survives storage, export and restore.');
}
function assertPresent(section, field, value, why) {
  assert(Object.prototype.hasOwnProperty.call(section, field),
    `'${field}' is missing from the stored record — the write path dropped it (${why}). Section keys: ${short(Object.keys(section))}.`);
  assert(Object.is(section[field], value),
    `'${field}' must be stored exactly as supplied (${why}).\n        want ${short(JSON.stringify(value), 200)}\n        got  ${short(JSON.stringify(section[field]), 200)}`);
}

/* ══════════════════════════════════════════════════════════════════════
   U-class — the pure intent picker (AC1, AC3, AC5)
   ══════════════════════════════════════════════════════════════════════ */

test('U1 (ADR d1/d2): the goals core exports INTENT_FIELDS and pickIntentFields alongside everything it already exported', () => {
  const core = loadGoalsCore();
  for (const fn of ['parseGoalRow', 'deriveStanding', 'resolveCaptureDate', 'sortGoals', 'resolveDecomposition', 'validateDecompositionOp']) {
    assert(typeof core[fn] === 'function', `src/lib/brain/goals.js stopped exporting ${fn}() — the export list grows, it never shrinks.`);
  }
  assert(core.INTENT_FIELDS !== undefined,
    'src/lib/brain/goals.js does not export INTENT_FIELDS yet (ADR 0001 d1) — the four have no single home, ' +
    'so story 2 would have to re-declare them on the read side.');
  assert(typeof core.pickIntentFields === 'function',
    'src/lib/brain/goals.js does not export pickIntentFields() yet (ADR 0001 d1/d2).');
});

test('U2 (ADR d1): INTENT_FIELDS names exactly the four properties the concept declares, in the concept\'s own words', () => {
  const core = loadGoalsCore();
  const got = core.INTENT_FIELDS;
  assert(Array.isArray(got) && got.length === EXPECTED_FIELDS.length,
    `INTENT_FIELDS must be an array of exactly ${EXPECTED_FIELDS.length} field names; got ${short(got)}.`);
  assert(sameArray(got, EXPECTED_FIELDS),
    `INTENT_FIELDS must be exactly ${JSON.stringify(EXPECTED_FIELDS)} — the concept's declared names, used verbatim ` +
    `as request-body keys (no new vocabulary; ADR d1). Got ${short(got)}.`);
});

test('U3 (AC1): each of the four supplied on its own is carried, and only it', () => {
  const pick = needPicker();
  assert(Array.isArray(EXPECTED_FIELDS) && EXPECTED_FIELDS.length === 4, 'the spec list itself is malformed — fix the test.');
  const sample = { prompt: 'a one-line prompt', chanceOfSuccess: 75, needsHumanInput: true, needsBreakdown: true };
  for (const field of EXPECTED_FIELDS) {
    const out = pick({ [field]: sample[field] });
    const keys = Object.keys(out);
    assert(keys.length === 1 && keys[0] === field,
      `supplying only '${field}' must yield exactly {${field}}; got ${short(out)}.`);
    assert(Object.is(out[field], sample[field]), `'${field}' must be copied verbatim; got ${short(out[field])}.`);
  }
});

test('U4 (AC1): all four supplied are all four carried', () => {
  const pick = needPicker();
  const input = { prompt: 'all four', chanceOfSuccess: 100, needsHumanInput: false, needsBreakdown: true };
  const out = pick(input);
  const keys = Object.keys(out);
  assert(keys.length === 4, `all four supplied must yield four keys; got ${short(keys)}.`);
  for (const field of EXPECTED_FIELDS) {
    assert(Object.is(out[field], input[field]), `'${field}' must be copied verbatim; got ${short(out[field])}.`);
  }
});

test('U5 (AC1 edge): none of the four supplied yields an empty result — a capture with none of them still has something to store', () => {
  const pick = needPicker();
  const out = pick({ name: 'a goal', statement: 'its ask', session: 'a session' });
  assert(out && typeof out === 'object' && !Array.isArray(out), `the picker must return an object; got ${short(out)}.`);
  assert(Object.keys(out).length === 0, `no supplied intent field must yield {}; got ${short(out)}.`);
});

test('U6 (ADR d2): `undefined` is the ONLY omission test — a supplied null is a supplied value and is kept', () => {
  const pick = needPicker();
  const out = pick({ prompt: undefined, chanceOfSuccess: null });
  assert(!Object.prototype.hasOwnProperty.call(out, 'prompt'),
    `an \`undefined\` field must be omitted entirely (not written as undefined); got keys ${short(Object.keys(out))}.`);
  assert(Object.prototype.hasOwnProperty.call(out, 'chanceOfSuccess'),
    'a supplied `null` must be KEPT — a `!= null` test would silently drop it, which is a content-driven ' +
    'transform AC5 forbids (ADR d2).');
  assert(out.chanceOfSuccess === null, `a supplied null must be stored as null; got ${short(out.chanceOfSuccess)}.`);
});

test('U7 (AC1/AC5): falsy-but-supplied values survive — 0, false and the empty string are values, not absences', () => {
  const pick = needPicker();
  const out = pick({ prompt: '', chanceOfSuccess: 0, needsHumanInput: false, needsBreakdown: false });
  const keys = Object.keys(out);
  assert(keys.length === 4,
    `every supplied value must be carried even when falsy — a truthiness test (\`if (input[f])\`) drops all four here. Got ${short(out)}.`);
  assert(out.prompt === '' && Object.is(out.chanceOfSuccess, 0) && out.needsHumanInput === false && out.needsBreakdown === false,
    `falsy values must be copied verbatim; got ${short(out)}.`);
});

test('U8 (AC3): a multi-line markdown prompt is copied byte-identical — nothing trims, re-wraps or normalizes it', () => {
  const pick = needPicker();
  const out = pick({ prompt: FIX_PROMPT });
  assert(out.prompt === FIX_PROMPT,
    'the prompt must be byte-identical to what was supplied (AC3) — no .trim(), no normalization.\n' +
    `        want ${quoted(FIX_PROMPT)}\n        got  ${quoted(out.prompt)}`);
});

test('U9 (AC5): nothing is coerced — a numeric string stays a string, a number stays a number', () => {
  const pick = needPicker();
  const out = pick({ chanceOfSuccess: '75', needsHumanInput: 'yes', needsBreakdown: 0, prompt: 12 });
  assert(out.chanceOfSuccess === '75' && typeof out.chanceOfSuccess === 'string',
    `a supplied value must be copied as supplied — no Number() coercion (ADR d2); got ${short(out.chanceOfSuccess)} (${typeof out.chanceOfSuccess}).`);
  assert(out.needsHumanInput === 'yes', `no Boolean() coercion; got ${short(out.needsHumanInput)}.`);
  assert(Object.is(out.needsBreakdown, 0), `no Boolean() coercion; got ${short(out.needsBreakdown)}.`);
  assert(Object.is(out.prompt, 12), `no String() coercion; got ${short(out.prompt)}.`);
});

test('U10 (AC1): nothing outside the four is ever copied', () => {
  const pick = needPicker();
  const out = pick({
    prompt: 'kept', name: 'dropped', statement: 'dropped', deliverable: 'dropped',
    boundary: 'dropped', parent: 'dropped', promptVersion: 'dropped', team: 'dropped',
  });
  assert(sameArray(Object.keys(out), ['prompt']),
    `only the four may be copied — the picker is a whitelist, not a merge; got ${short(Object.keys(out))}.`);
});

test('U11 (ADR d2): the picker does not mutate its input, and its result is a separate object', () => {
  const pick = needPicker();
  const input = { prompt: 'p', chanceOfSuccess: 5, name: 'n' };
  const before = JSON.stringify(input);
  const out = pick(input);
  assert(JSON.stringify(input) === before, `the input object must be untouched; it became ${short(input)}.`);
  assert(out !== input, 'the result must be a NEW object — returning the caller\'s body would leak every other key onto the record.');
  out.prompt = 'mutated';
  assert(input.prompt === 'p', 'mutating the result must not reach back into the input (no shared reference).');
});

test('U12 (ADR d2): the result\'s key order is deterministic — INTENT_FIELDS order, whatever order the caller supplied', () => {
  const pick = needPicker();
  const out = pick({ needsBreakdown: true, chanceOfSuccess: 1, needsHumanInput: false, prompt: 'p' });
  const keys = Object.keys(out);
  assert(Array.isArray(keys) && keys.length === 4, `expected four keys; got ${short(keys)}.`);
  assert(sameArray(keys, EXPECTED_FIELDS),
    `Object.keys() of the result doubles as the "which fields were written" report and must be deterministic ` +
    `in INTENT_FIELDS order (ADR d2); got ${short(keys)}.`);
});

/* ══════════════════════════════════════════════════════════════════════
   S-class — source assertions, structure-bounded (AC1, AC2, AC4, AC5)
   ══════════════════════════════════════════════════════════════════════ */

test('S1 (sentinel — ADR constraint): the goals core stays dependency-free CommonJS — zero require() calls', () => {
  const src = safeRead(GOALS_CORE);
  assert(src, 'src/lib/brain/goals.js is unreadable.');
  assert(!/\brequire\s*\(/.test(src),
    'src/lib/brain/goals.js must contain ZERO require() calls — it is the shared pure core the read endpoint, ' +
    'the hygiene checker and the write primitives all import (S1 purity pin, capture-a-goal-and-see-it.test.js).');
  assert(/module\.exports\s*=/.test(src), 'the goals core must stay CommonJS (module.exports).');
});

test('S2 (ADR d3 / AC1): the root-capture path applies the picker at the handler — the trust boundary — and hands a whitelisted object to its core', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(src, 'src/api/normalize/index.js is unreadable.');
  const handler = functionBody(src, 'handleNoteGoalIdea');
  const core = functionBody(src, 'noteGoalIdea');
  assert(handler, 'handleNoteGoalIdea not found in src/api/normalize/index.js.');
  assert(core, 'noteGoalIdea (the core) not found in src/api/normalize/index.js.');
  assert(/pickIntentFields/.test(handler),
    'handleNoteGoalIdea must apply pickIntentFields to the request body (ADR d3) — today it builds its goal section ' +
    'from a fixed set of fields and drops all four silently.');
  assert(!/req\.body/.test(core),
    'no raw request body may reach the core — the whitelist is applied in the handler, which is the trust boundary ' +
    'and the region the source pins scan (ADR d3).');
});

test('S3 (ADR d3 / AC1): the child-capture path applies the picker at the handler too', () => {
  const src = safeRead(NORMALIZE_INDEX);
  const handler = functionBody(src, 'handleCreateChildGoal');
  const core = functionBody(src, 'createChildGoal');
  assert(handler, 'handleCreateChildGoal not found in src/api/normalize/index.js.');
  assert(core, 'createChildGoal (the core) not found in src/api/normalize/index.js.');
  assert(/pickIntentFields/.test(handler),
    'handleCreateChildGoal must apply pickIntentFields to the request body (ADR d3) — today its fixed-field ' +
    'section build drops all four.');
  assert(!/req\.body/.test(core), 'no raw request body may reach createChildGoal (ADR d3).');
});

test('S4 (sentinel — ADR d4 / AC5): the four never enter update-goal-intent\'s empty-value refusal or its trim calls', () => {
  const src = safeRead(NORMALIZE_INDEX);
  const handler = functionBody(src, 'handleUpdateGoalIntent');
  assert(handler, 'handleUpdateGoalIntent not found in src/api/normalize/index.js.');
  const providedStmt = between(handler, 'const provided =', ';');
  assert(providedStmt, "could not locate the `const provided = …` statement inside handleUpdateGoalIntent.");
  const refusalRegion = between(handler, 'const provided =', 'serializeGoalWrite');
  assert(refusalRegion, 'could not locate the region between `provided` and the serialized write.');
  for (const field of EXPECTED_FIELDS) {
    assert(!new RegExp(`\\b${field}\\b`).test(providedStmt),
      `'${field}' must NOT join the \`provided\` list (ADR d4). That one-line change silently creates a validation ` +
      "rule the frame forbids: the empty-value loop rejects any non-string and any empty-after-trim value, so " +
      '`chanceOfSuccess: 75` would be refused for its content (AC5) and a prompt would be trimmed (AC3).');
    assert(!new RegExp(`\\b${field}\\s*\\.\\s*trim\\s*\\(`).test(refusalRegion),
      `'${field}' must never be .trim()ed — AC3 requires the prompt byte-identical to what was supplied.`);
  }
  assert(/empty-value/.test(handler), "the existing 'empty-value' refusal must survive for the three string fields it governs.");
});

test('S5 (ADR d4 / AC2): the update path computes the intent fields BEFORE its "at least one field" refusal, names all seven accepted fields, and merges them onto the section', () => {
  const src = safeRead(NORMALIZE_INDEX);
  const handler = functionBody(src, 'handleUpdateGoalIntent');
  const core = functionBody(src, 'updateGoalIntent');
  assert(handler && core, 'handleUpdateGoalIntent / updateGoalIntent not found in src/api/normalize/index.js.');
  const pickAt = handler.indexOf('pickIntentFields');
  assert(pickAt !== -1,
    'handleUpdateGoalIntent must apply pickIntentFields (ADR d4) — today `provided` is the only accepted set, so ' +
    'none of the four can be set on an existing goal.');
  const refusalAt = handler.indexOf('At least one');
  assert(refusalAt !== -1, 'the "at least one field" 400 has moved or lost its wording — re-aim this pin.');
  assert(pickAt < refusalAt,
    'the four must be computed BEFORE the "at least one field" refusal (ADR d4), or an update supplying only one ' +
    'of them is rejected before it is ever seen. The refusal becomes a PRESENCE test over both lists, never a content test.');
  const blocks = [];
  let from = 0;
  for (;;) {
    const start = handler.indexOf('res.status(400).json({', from);
    if (start === -1) break;
    let depth = 0;
    let i = handler.indexOf('{', start + 'res.status(400).json('.length - 1);
    for (; i < handler.length; i += 1) {
      if (handler[i] === '{') depth += 1;
      else if (handler[i] === '}') { depth -= 1; if (depth === 0) break; }
    }
    blocks.push(handler.slice(start, i + 1));
    from = i + 1;
  }
  assert(blocks.length > 0, 'no brace-matched res.status(400).json({…}) block found in handleUpdateGoalIntent.');
  const namesAll = blocks.some((b) => EXPECTED_FIELDS.every((f) => b.includes(f))
    && ['deliverable', 'boundary', 'parent'].every((f) => b.includes(f)));
  assert(namesAll,
    'the "at least one field" refusal must name all SEVEN accepted fields (ADR d4) — a caller told only about ' +
    'deliverable/boundary/parent cannot discover that the four are now settable.');
  assert(/pickIntentFields|intent/.test(core),
    'updateGoalIntent must merge the whitelisted intent object onto the parsed section and report the written ' +
    'field names alongside the existing three (ADR d4).');
  assert(/capturedOn/.test(core),
    'the capturedOn backfill must still run first and untouched (ADR 0003 d7) — without it the first edit of a ' +
    'legacy goal moves its capture date to today.');
});

test('S6 (ADR d5 / AC4): the schema a fresh instance provisions declares all four — additively, with `required` unmoved and the single-concept-object wrapper intact', () => {
  const src = safeRead(NORMALIZE_INDEX);
  const schema = evalObjectLiteral(src, 'GOAL_SCHEMA');
  const topKeys = Object.keys(schema.properties || {});
  assert(sameArray(topKeys, ['tapestryOwnerGoal']),
    `GOAL_SCHEMA must stay a single-concept-object wrapper (exactly one top-level property). This is load-bearing: ` +
    "handleCreateElement's no-json branch walks the TOP-LEVEL properties and would start auto-populating type " +
    `defaults — prompt:'' , chanceOfSuccess:0, both flags false — if the wrapper were flattened, which AC1 forbids. Got ${short(topKeys)}.`);
  assert(sameArray(schema.required, ['tapestryOwnerGoal']), `the wrapper's top-level required must stay ['tapestryOwnerGoal']; got ${short(schema.required)}.`);
  const inner = schema.properties.tapestryOwnerGoal;
  const props = Object.keys(inner.properties || {});
  assert(Array.isArray(props) && props.length === EXISTING_SCHEMA_PROPS.length + EXPECTED_FIELDS.length,
    `the provisioned concept must declare ${EXISTING_SCHEMA_PROPS.length + EXPECTED_FIELDS.length} properties — the ` +
    `${EXISTING_SCHEMA_PROPS.length} it already declares PLUS the four (ADR d5). It declares ${props.length}: ${short(props)}.`);
  for (const p of EXISTING_SCHEMA_PROPS) {
    assert(props.includes(p), `the addition must be ADDITIVE — '${p}' disappeared from GOAL_SCHEMA.`);
  }
  for (const f of EXPECTED_FIELDS) {
    assert(props.includes(f),
      `GOAL_SCHEMA does not declare '${f}' (ADR d5). On a fresh or restored instance undeclared properties are ` +
      'silently dropped, so the frame\'s "I can set" fails outright there no matter what the write paths accept.');
    assert(inner.properties[f] && inner.properties[f].type === EXPECTED_TYPES[f],
      `'${f}' must be declared as type '${EXPECTED_TYPES[f]}' (the live concept's own declaration); got ${short(inner.properties[f])}.`);
  }
  assert(sameArray(inner.required, ['name', 'slug', 'description']),
    `\`required\` must stay exactly ['name','slug','description'] — which properties are required is explicitly out ` +
    `of scope for this story, on every instance (second-brain ADR 0003 d13's invariant). Got ${short(inner.required)}.`);
  const unique = inner['x-tapestry'] && inner['x-tapestry'].unique;
  assert(sameArray(unique, ['name', 'slug']), `x-tapestry.unique must be untouched (['name','slug']); got ${short(unique)}.`);
});

test('S7 (sentinel — ADR d6): none of the seven record-replicating paths gains an intent-field whitelist', () => {
  const targets = [
    [NORMALIZE_INDEX, 'handleCreateElement'], [NORMALIZE_INDEX, 'handleSaveElementJson'],
    [NORMALIZE_INDEX, 'handleSetJsonTag'], [NORMALIZE_INDEX, 'mintRestoredGoal'],
    [NORMALIZE_INDEX, 'handleForkNode'], [IO_INDEX, 'handleImportExecute'], [EVENT_SYNC, 'handleEventUpdate'],
  ];
  assert(targets.length === 7, 'the replicating-path inventory must list exactly seven paths (ADR d6).');
  for (const [file, fn] of targets) {
    const body = functionBody(safeRead(file), fn);
    assert(body, `${fn} not found in ${path.relative(ROOT, file)} — the ADR's no-change inventory has drifted.`);
    for (const field of EXPECTED_FIELDS) {
      assert(!new RegExp(`\\b${field}\\b`).test(body),
        `${fn} must NOT learn about '${field}'. It replicates a supplied or stored record verbatim, so it already ` +
        'carries the four; adding a whitelist would NARROW a path that currently carries everything, including the ' +
        'out-of-contract fields the export is required to preserve (ADR d6).');
    }
  }
});

test('S8 (sentinel — AC5): no rule inspects what the four contain — no clamp, no coercion, no range check on the goal write path', () => {
  const src = safeRead(NORMALIZE_INDEX);
  const regions = ['handleNoteGoalIdea', 'noteGoalIdea', 'handleCreateChildGoal', 'createChildGoal',
    'handleUpdateGoalIntent', 'updateGoalIntent'].map((fn) => [fn, functionBody(src, fn)]);
  for (const [fn, body] of regions) {
    assert(body, `${fn} not found in src/api/normalize/index.js.`);
    for (const tok of ['Math.min', 'Math.max', 'parseInt', 'parseFloat', 'toFixed', 'clamp']) {
      assert(!body.includes(tok),
        `${fn} must not ${tok} anything — the four are carried, never consulted (AC5). Any future rule that gates, ` +
        'ranks, filters or clamps them must supersede the ADR rather than extend it.');
    }
  }
  const picker = functionBody(safeRead(GOALS_CORE), 'pickIntentFields');
  if (picker) {
    for (const tok of ['Math.min', 'Math.max', 'parseInt', 'parseFloat', 'toFixed', '.trim(', 'Number(', 'Boolean(', 'String(']) {
      assert(!picker.includes(tok), `pickIntentFields must copy verbatim — found '${tok}' in its body (ADR d2).`);
    }
  }
  assert(!/chanceOfSuccess[^\n]{0,60}(<=?|>=?)\s*\d/.test(src) && !/\d\s*(<=?|>=?)[^\n]{0,60}chanceOfSuccess/.test(src),
    'no range comparison on chanceOfSuccess may appear in the goal write module — an estimate outside 0-100 is ' +
    "explicitly undefined territory for this story, and inventing a rejection or a clamp rule widens the frame (AC5).");
});

test('S9 (sentinel): the three goal-write routes are unchanged and no new goal-write endpoint appears', () => {
  const src = safeRead(NORMALIZE_INDEX);
  for (const route of ['/api/normalize/note-goal-idea', '/api/normalize/create-child-goal', '/api/normalize/update-goal-intent']) {
    assert(src.includes(route), `${route} is no longer registered — the four ride the EXISTING contracts.`);
  }
  assert(!/set-goal-intent-fields|set-intent-fields/.test(src),
    'no new goal-write endpoint may be added (Option D was rejected) — splitting "update a goal\'s intent" across ' +
    'two endpoints would contradict ADR 0003 d7 and would do nothing for either capture path.');
});

test('S10 (sentinel): all three goal-write handlers keep their explicit owner gate', () => {
  const src = safeRead(NORMALIZE_INDEX);
  for (const fn of ['handleNoteGoalIdea', 'handleCreateChildGoal', 'handleUpdateGoalIntent']) {
    const body = functionBody(src, fn);
    assert(body, `${fn} not found.`);
    assert(/isOwner\s*\(\s*req\s*\)/.test(body) && /localTrusted/.test(body) && /403/.test(body),
      `${fn} must keep the in-handler gate (isOwner(req) || req.localTrusted → 403) — untouched by this story.`);
  }
});

test('S11 (sentinel): the goal writes stay local — publishToStrfry + importEventDirect only, never an outbound publish', () => {
  const src = safeRead(NORMALIZE_INDEX);
  for (const fn of ['noteGoalIdea', 'createChildGoal', 'updateGoalIntent']) {
    const body = functionBody(src, fn);
    assert(body, `${fn} not found.`);
    assert(!/publishEverywhere|nostrPublish/.test(body),
      `${fn} must never publish outward (event-tagging ADR 0002) — the goal z-tag stays outside every outbound router stream.`);
  }
});

test('S12 (sentinel — ADR d5): ensureGoalConcept is what provisions a fresh instance, and GOAL_SCHEMA is what it hands to save-schema', () => {
  const src = safeRead(NORMALIZE_INDEX);
  const ensure = functionBody(src, 'ensureGoalConcept');
  assert(ensure, 'ensureGoalConcept not found — a fresh instance would have no way to self-provision the goal concept.');
  assert(/handleCreateConcept|create-concept/.test(ensure) && /handleSaveSchema|save-schema/.test(ensure),
    'ensureGoalConcept must provision via create-concept + save-schema when the concept is absent (ADR 0008 d8).');
  assert(/GOAL_SCHEMA/.test(ensure),
    'ensureGoalConcept must hand GOAL_SCHEMA to save-schema — that constant is the whole of what a fresh instance ' +
    'declares, which is why S6 pins its contents.');
});

test('S13 (sentinel): the goal concept is runtime-created, never firmware-seeded — so no firmware reinstall is required', () => {
  const offenders = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && /\.json$/.test(e.name)) {
        if (safeRead(p).includes('tapestryOwnerGoal')) offenders.push(path.relative(ROOT, p));
      }
    }
  };
  walk(FIRMWARE_DIR);
  assert(offenders.length === 0,
    `firmware must carry no goal concept — if it did, this story would need a firmware reinstall and the ADR's ` +
    `"Firmware reinstall required? No" would be wrong. Found: ${short(offenders)}.`);
});

test('S14 (sentinel): the untouchables stay untouched by the four', () => {
  for (const f of [RELATIONSHIPS, PROBE, AUTH]) {
    const src = safeRead(f);
    assert(src, `${path.relative(ROOT, f)} is unreadable.`);
    for (const field of EXPECTED_FIELDS) {
      assert(!new RegExp(`\\b${field}\\b`).test(src),
        `${path.relative(ROOT, f)} is an untouchable — '${field}' must not appear in it.`);
    }
  }
});

/* ══════════════════════════════════════════════════════════════════════
   H-class — the live local stack (SKIP when unreachable)
   ══════════════════════════════════════════════════════════════════════ */

htest('H1 (AC1): a root goal captured from a session with a prompt and an estimate stores exactly those two — and the two flags stay ABSENT', () => {
  armFixtures();
  const r = noteIdea({
    name: FIX_ROOT_NAME, statement: 'a harness-intent root goal captured with a subset of the four',
    session: FIX_SESSION, prompt: FIX_PROMPT, chanceOfSuccess: 75,
  });
  assert(r && r.success === true && r.result === 'noted',
    `note-goal-idea must still answer {success:true, result:'noted', …} when the four ride along (got ${short(r, 400)}).`);
  const section = goalSection(FIX_ROOT_SLUG);
  assertPresent(section, 'prompt', FIX_PROMPT, 'supplied at capture through note-goal-idea');
  assertPresent(section, 'chanceOfSuccess', 75, 'supplied at capture through note-goal-idea');
  assertAbsent(section, 'needsHumanInput', 'not supplied at capture');
  assertAbsent(section, 'needsBreakdown', 'not supplied at capture');
});

htest('H2 (AC1): a child goal captured while breaking a bigger one down stores the two flags it was given — including the one set FALSE — and the prompt and estimate stay ABSENT', () => {
  armFixtures();
  const r = createChild({
    parent: FIX_PARENT_SLUG, name: FIX_CHILD_NAME,
    statement: 'a harness-intent child goal captured with the two flags',
    needsHumanInput: true, needsBreakdown: false,
  });
  assert(r && r.success === true && r.result === 'created',
    `create-child-goal must still answer {success:true, result:'created', …} when the four ride along (got ${short(r, 400)}).`);
  const section = goalSection(FIX_CHILD_SLUG);
  assertPresent(section, 'needsHumanInput', true, 'supplied at capture through create-child-goal');
  assertPresent(section, 'needsBreakdown', false,
    'supplied FALSE at capture — a stored false is a supplied value and must not collapse into absence, which the ' +
    'concept reads as "absent means false"');
  assertAbsent(section, 'prompt', 'not supplied at capture');
  assertAbsent(section, 'chanceOfSuccess', 'not supplied at capture');
  assert(section.parent === FIX_PARENT_SLUG, `the child must still record its parent; got ${short(section.parent)}.`);
});

htest('H3 (sentinel, AC1 edge): a capture with none of the four still succeeds, and stores none of them', () => {
  armFixtures();
  const r = noteIdea({ name: FIX_PLAIN_NAME, statement: 'a harness-intent goal captured with none of the four', session: FIX_SESSION });
  assert(r && r.success === true && r.result === 'noted',
    `a capture supplying none of the four must still succeed (got ${short(r, 400)}).`);
  const section = goalSection(FIX_PLAIN_SLUG);
  for (const field of EXPECTED_FIELDS) assertAbsent(section, field, 'none of the four was supplied');
  assert(section.name === FIX_PLAIN_NAME && typeof section.description === 'string',
    `the ordinary capture contract must be unchanged; got ${short(section)}.`);
});

htest('H4 (AC3): the stored record has the shape the concept declares — a multi-line markdown prompt byte-identical, the estimate a number, each flag a boolean', () => {
  armFixtures();
  const root = goalSection(FIX_ROOT_SLUG);
  assert(root.prompt === FIX_PROMPT,
    'the prompt must be byte-identical after a full round-trip through signing, storage and export (AC3).\n' +
    `        want ${quoted(FIX_PROMPT)}\n        got  ${quoted(root.prompt)}`);
  assert(typeof root.chanceOfSuccess === 'number',
    `the estimate must be stored as a number, not a string (AC3); got ${short(root.chanceOfSuccess)} (${typeof root.chanceOfSuccess}).`);
  const child = goalSection(FIX_CHILD_SLUG);
  assert(typeof child.needsHumanInput === 'boolean' && typeof child.needsBreakdown === 'boolean',
    `each flag must be stored as a boolean (AC3); got ${short([child.needsHumanInput, child.needsBreakdown])}.`);
});

htest('H5 (AC2): updating one of the four leaves the other three, and everything else on the goal, exactly as it was', () => {
  armFixtures();
  const before = goalSection(FIX_UPDATE_SLUG);
  const NEW_PROMPT = 'the REPLACEMENT prompt supplied by update-goal-intent\n\n  with its own second line  \n';
  const r = updateIntent({ goal: FIX_UPDATE_SLUG, prompt: NEW_PROMPT });
  assert(r && r.success === true && r.result === 'updated',
    `update-goal-intent must accept a prompt-only update (got ${short(r, 400)}).`);
  assert(Array.isArray(r.fields) && r.fields.includes('prompt'),
    `the response must report which fields it wrote, including 'prompt'; got ${short(r.fields)}.`);
  const after = goalSection(FIX_UPDATE_SLUG);
  assertPresent(after, 'prompt', NEW_PROMPT, 'supplied to update-goal-intent');
  assertPresent(after, 'chanceOfSuccess', before.chanceOfSuccess, 'not supplied to this update — it must be unchanged');
  assertPresent(after, 'needsHumanInput', before.needsHumanInput, 'not supplied to this update — it must be unchanged');
  assertPresent(after, 'needsBreakdown', before.needsBreakdown, 'not supplied to this update — it must be unchanged');
  for (const key of ['name', 'slug', 'description', 'origin', 'capturedOn', 'deliverable', 'boundary', 'parent', 'promptVersion']) {
    assert(Object.is(after[key], before[key]),
      `'${key}' must be unchanged by an intent update (AC2) — including the out-of-contract riders the export ` +
      `must preserve.\n        want ${short(JSON.stringify(before[key]))}\n        got  ${short(JSON.stringify(after[key]))}`);
  }
});

htest('H6 (AC5, the refusal trap): a prompt supplied as an empty string is a value — the write proceeds and stores it, and the empty-value refusal never fires', () => {
  armFixtures();
  const r = updateIntent({ goal: FIX_TRAP_SLUG, prompt: '' });
  assert(r && r.refusal !== 'empty-value',
    "an empty prompt must NOT trip the 'empty-value' refusal: that rule governs the three string fields it was " +
    'written for, and admitting the four to it would reject a write for what one of the four contains (AC5). ' +
    `Got ${short(r, 400)}.`);
  assert(r && r.success === true,
    `supplying only one of the four must satisfy the "at least one field" requirement (ADR d4); got ${short(r, 400)}.`);
  const section = goalSection(FIX_TRAP_SLUG);
  assertPresent(section, 'prompt', '', 'supplied as an empty string — a supplied value, stored as given');
});

htest('H7 (AC5, the falsy trap): an estimate of 0 is a value — the write proceeds and stores the number 0', () => {
  armFixtures();
  const r = updateIntent({ goal: FIX_TRAP_SLUG, chanceOfSuccess: 0 });
  assert(r && r.success === true,
    `an update supplying only chanceOfSuccess: 0 must succeed — 0 is the concept's own documented default, not an ` +
    `absence (got ${short(r, 400)}).`);
  const section = goalSection(FIX_TRAP_SLUG);
  assertPresent(section, 'chanceOfSuccess', 0, 'supplied as 0 — a truthiness test would drop it');
  assertPresent(section, 'prompt', '', 'set by the previous update and not supplied to this one');
});

htest('H8 (AC5): nothing decides which prompts may run — an adversarial-looking prompt is stored unexamined, at capture and at update', () => {
  armFixtures();
  const created = createChild({
    parent: FIX_PARENT_SLUG, name: FIX_ADVERSARIAL_NAME,
    statement: 'a harness-intent goal whose prompt looks dangerous and is only data',
    prompt: FIX_ADVERSARIAL_PROMPT, chanceOfSuccess: 100, needsHumanInput: false,
  });
  assert(created && created.success === true,
    `no write may be rejected because of what a prompt contains (AC5); got ${short(created, 400)}.`);
  const section = goalSection(FIX_ADVERSARIAL_SLUG);
  assertPresent(section, 'prompt', FIX_ADVERSARIAL_PROMPT, 'supplied at capture — stored, never inspected');
  assertPresent(section, 'chanceOfSuccess', 100, 'the top of the declared range is an ordinary value');
  assertPresent(section, 'needsHumanInput', false, 'a supplied false');
  assertAbsent(section, 'needsBreakdown', 'not supplied');
  const updated = updateIntent({ goal: FIX_TRAP_SLUG, prompt: FIX_ADVERSARIAL_PROMPT });
  assert(updated && updated.success === true,
    `the same content must be accepted on the update path too (AC5); got ${short(updated, 400)}.`);
  assertPresent(goalSection(FIX_TRAP_SLUG), 'prompt', FIX_ADVERSARIAL_PROMPT, 'supplied to update-goal-intent');
});

htest('H9 (sentinel, AC1): the path that stores a supplied record as given still carries all four — it must not regress', () => {
  armFixtures();
  const section = goalSection(FIX_PARENT_SLUG);
  assertPresent(section, 'prompt', FIX_PARENT_JSON.tapestryOwnerGoal.prompt, 'supplied inside a whole record');
  assertPresent(section, 'chanceOfSuccess', 42, 'supplied inside a whole record');
  assertPresent(section, 'needsHumanInput', true, 'supplied inside a whole record');
  assertPresent(section, 'needsBreakdown', false, 'supplied inside a whole record');
  assertPresent(section, 'promptVersion', 'v1-out-of-contract-rider',
    'an out-of-contract field the replicating paths carry and must keep carrying');
});

htest('H10 (AC4): the schema a fresh instance would provision declares the same four properties, with the same types, as the live concept does', () => {
  const src = safeRead(NORMALIZE_INDEX);
  const provisioned = evalObjectLiteral(src, 'GOAL_SCHEMA');
  const node = loopbackGetJson(`/api/concept-graph/node/${encodeURIComponent(`39999:${getTaPubkey()}:${GOAL_SCHEMA_SLUG}`)}`);
  const n = (node && node.node) || node;
  assert(n && Array.isArray(n.tags), `could not read the live goal schema node from the graph; got ${short(node)}.`);
  const jsonTags = n.tags.filter((t) => (Array.isArray(t) ? t[0] : t && t.type) === 'json');
  assert(jsonTags.length === 1, `the live schema node must carry exactly one json tag; got ${jsonTags.length}.`);
  const raw = Array.isArray(jsonTags[0]) ? jsonTags[0][1] : jsonTags[0].value;
  let live;
  try { live = JSON.parse(raw).jsonSchema.properties.tapestryOwnerGoal.properties; }
  catch (e) { throw new Error(`the live goal schema node is unreadable (${e.message}).`); }
  const liveNames = Object.keys(live || {});
  for (const f of EXPECTED_FIELDS) {
    assert(liveNames.includes(f),
      `the live goal concept does not declare '${f}' — the story's premise (all four already declared on this ` +
      'instance) no longer holds; stop and re-check the graph before implementing.');
  }
  const mine = (provisioned.properties && provisioned.properties.tapestryOwnerGoal && provisioned.properties.tapestryOwnerGoal.properties) || {};
  for (const f of EXPECTED_FIELDS) {
    assert(Object.prototype.hasOwnProperty.call(mine, f),
      `GOAL_SCHEMA omits '${f}', which the live concept declares — an instance that self-provisions would silently ` +
      'drop it, so the frame\'s "I can set" fails on a fresh or restored instance (AC4).');
    assert(mine[f].type === live[f].type,
      `'${f}' must be provisioned with the type the concept declares — live '${short(live[f].type)}', ` +
      `GOAL_SCHEMA '${short(mine[f].type)}'.`);
  }
  // Deliberately NOT compared: the live node's `required`. OPEN.md row 102 is
  // out of scope for this story, and nothing here is evidence about its state.
});

htest('H11 (AC2 safety): no record outside the harness fixtures was written, moved or touched by this suite', () => {
  armFixtures();
  assert(typeof baselineDigest === 'string' && baselineDigest.length > 0,
    'the baseline snapshot of the real brain was never taken — armFixtures() did not run.');
  const now = realBrainDigest();
  assert(now === baselineDigest,
    'every real record — goals and all four record families — must be byte-identical before and after this suite: ' +
    'every write here targets a sentinel-named fixture, and the legacy records are never mutated. A difference means ' +
    'a fixture escaped its naming, that a write path touched a record it was not given, or that teardown over-reached.');
});

/* ══════════════════════════════════════════════════════════════════════
   R-class — regression sentinels (pass BEFORE and after)
   ══════════════════════════════════════════════════════════════════════ */

// RE-AIMED by goal-intent-fields #2 (ADR 0002 d1), which this sentinel named as
// its re-pin: the read side now carries the four, so the goal shape grows from
// ten fields to fourteen — the four APPENDED after `parent`, in the concept's
// own order. Still the single exact-key sentinel over a goal shape in this
// suite; nothing about it is weakened. It FAILS until #2's parser change lands.
test('R1 (scope): parseGoalRow projects exactly its fourteen fields — the ten it had, plus the four appended after the parent', () => {
  const core = loadGoalsCore();
  const section = {
    name: 'a goal', slug: 'a-goal', description: 'its ask', origin: 'owner', capturedOn: '2026-07-01',
    deliverable: 'what done produces', boundary: 'what it stays inside', parent: 'a-parent',
    prompt: 'a prompt', chanceOfSuccess: 60, needsHumanInput: true, needsBreakdown: false,
  };
  const rec = core.parseGoalRow({ uuid: '39999:ta:a-goal', name: 'a goal', createdAt: 1784000000, json: JSON.stringify({ tapestryOwnerGoal: section }) });
  assert(rec && typeof rec === 'object', 'parseGoalRow must still parse a goal row.');
  const expected = ['uuid', 'name', 'slug', 'statement', 'origin', 'capturedOn', 'createdAt', 'deliverable', 'boundary', 'parent',
    ...EXPECTED_FIELDS];
  const keys = Object.keys(rec);
  assert(Array.isArray(keys) && keys.length === expected.length,
    `parseGoalRow must project exactly ${expected.length} fields — the ten it projected for story 1 plus the four this ` +
    `story's sibling (goal-intent-fields #2, ADR 0002 d1) appends after \`parent\`. Got ${keys.length}: ${short(keys)}.`);
  assert(sameArray(keys, expected), `parseGoalRow's projection changed; got ${short(keys)}.`);
  assert(rec.deliverable === 'what done produces' && rec.parent === 'a-parent', 'the existing projection must still be correct.');
  assert(rec.prompt === 'a prompt' && rec.chanceOfSuccess === 60 && rec.needsHumanInput === true && rec.needsBreakdown === false,
    `the four must be projected VERBATIM from the stored section; got ${short({ prompt: rec.prompt, chanceOfSuccess: rec.chanceOfSuccess, needsHumanInput: rec.needsHumanInput, needsBreakdown: rec.needsBreakdown })}.`);
});

test('R2 (scope): the Direction core keeps its own local chanceOfSuccess read — retiring it is story 2\'s call, not this story\'s', () => {
  const src = safeRead(DIRECTION_CORE);
  assert(src, 'src/lib/brain/direction.js is unreadable — operational-direction #1 regression.');
  assert(/function\s+parseEstimate\s*\(/.test(src) && /chanceOfSuccess/.test(src),
    'the Direction core must keep reading chanceOfSuccess off the raw goal record (operational-direction ADR 0001 d6). ' +
    'This story makes that read retirable; it does not retire it.');
});

test('R3 (scope): the goal write module gains no new require of the brain cores beyond the goals core it already imports', () => {
  const src = safeRead(NORMALIZE_INDEX);
  const brainRequires = [...src.matchAll(/require\s*\(\s*['"`]([^'"`]*lib\/brain\/[^'"`]+)['"`]\s*\)/g)].map((m) => m[1]);
  assert(Array.isArray(brainRequires) && brainRequires.length > 0, 'normalize must still import at least one brain core.');
  const allowed = [/brain\/goals$/, /brain\/hygiene$/, /brain\/resources$/, /brain\/work-records$/, /brain\/proposals$/, /brain\/signals$/, /brain\/export$/, /brain\/restore$/];
  for (const spec of brainRequires) {
    assert(allowed.some((re) => re.test(spec)),
      `unexpected brain import in normalize: require('${spec}') — the four arrive through the shared goals core ` +
      '(ADR d1/d2), not through a new module.');
  }
});

/* ══════════════════════════════════════════════════════════════════════ */

async function run() {
  console.log('\n=== store-the-four-when-a-goal-is-captured-or-updated (goal-intent-fields #1) ===');
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
  // OPEN.md #104/#106: a fully-skipped H-class is otherwise indistinguishable
  // from a real pass. Say so out loud, and let a gate demand live execution.
  console.log(`store-the-four: H-class ${hExecuted} executed / ${hSkipped} skipped`);
  if (hSkipped > 0 && hExecuted === 0) {
    console.log('store-the-four: !! LIVE COVERAGE DID NOT RUN — every H-class assertion skipped (stack unreachable).');
    if (process.env.TAPESTRY_REQUIRE_LIVE === '1') {
      const msg = 'TAPESTRY_REQUIRE_LIVE=1 was set but the whole H-class skipped — the live stack was unreachable.';
      console.log(`  FAIL  H-class execution required\n        ${msg}`);
      failures.push({ name: 'H-class execution required', message: msg });
      fail++;
    }
  }
  console.log(`\nstore-the-four-when-a-goal-is-captured-or-updated: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped, hExecuted, hSkipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
