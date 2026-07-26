/**
 * Story 1 (epic: operational-direction) — Operational direction: a run's terms
 * derived from the goal being pursued.
 *
 * Story: engineering-team/stories/operational-direction/1-operational-direction-mode.md
 * ADR:   engineering-team/decisions/operational-direction/0001-operational-direction-mode.md
 *
 * Test classes (per test-hermeticity-ci/0001):
 *
 *   U-class (EXECUTED, stack-free, always gates CI) — the new pure core
 *     src/lib/brain/direction.js over SYNTHETIC records fed through the REAL
 *     resolveDecomposition (src/lib/brain/goals.js), so the ancestry walk is
 *     exercised against the real annotation + cycle-breaking, not a mock:
 *     resolveAnchor (eligible/refusals/distance), the policy parameter at
 *     distances 0/1/2 through ONE code path (ADR d3), isAnchorStale (d4),
 *     boundarySteps + applyBoundaryVerdicts with INJECTED verdicts (d5),
 *     deriveTerms + parseEstimate incl. the absent case (d6), termsMatch (d9.3),
 *     and the SURRENDERED/UNAVAILABLE data (d6).
 *
 *   S-class (source assertions, stack-free) — the core's ZERO-require purity;
 *     the read-only GET /api/brain/direction/:slug with the platform gate;
 *     the brain import surface re-pinned to NINE across all eight sibling
 *     suites; the doc changes (director.md naming two modes and referencing —
 *     never restating — the non-negotiables; the skill's Stage-0 mode fork +
 *     the d9.3 mismatch check; the book template's distinctly-headed operational
 *     section carrying the d9.1 warning and the d9.2 provenance block;
 *     CLAUDE.md's line-neutral doctrine rewrite); OPEN.md row 41 dispositioned.
 *
 *   H-class (live local stack, per-test SKIP when unreachable) — the endpoint
 *     answers on loopback, is 403 host-side, refuses a nonexistent slug, returns
 *     a well-formed no-anchor refusal for a real un-approved goal, and WRITES
 *     NOTHING. **Deliberately fixture-free**: the endpoint is read-only, so this
 *     suite creates no elements and needs no teardown — sidestepping the
 *     stranded-node pre-clean cascade of OPEN.md row 94 by construction.
 *
 *   R-class (regression sentinels, stack-free, pass BEFORE and after) — armed
 *     mode unweakened (six stopping rules, the ceiling list, the binding
 *     KICK_BACK, owner-only ratification all still present and stated once);
 *     CLAUDE.md still exactly at its 190-line budget; the five phase workflows
 *     untouched by mode text; gate-judge.md's blinding contract intact.
 *
 * Pass-by-design sentinels (documented; story-2/3/4/5/6 review precedent) that
 * pass BEFORE the Implementer touches anything — 8 of 61:
 *   - R1–R6: regression sentinels. They must STILL pass afterward; that is the
 *     whole of AC1's "no armed-mode rule weakened" and AC5's "phases unchanged."
 *   - S8: also a regression sentinel in effect — it passes now because each
 *     non-negotiable has exactly ONE heading in director.md, and it FAILS if the
 *     Implementer satisfies the operational section by duplicating them per mode
 *     instead of referencing them (AC5's "by reference, not by copy").
 *   - S5: asserts THIS PHASE's own deliverable — the eight-suite import re-pin,
 *     which the ADR assigns to the Tester's lane because Gate 4 pins an empty
 *     `test/` diff after the Gate-3 commit. It passes on this commit by
 *     construction and guards the re-pin against later removal.
 *
 * The other 53 FAIL until the feature lands (the direction core is missing, the
 * endpoint 404s, the docs name one mode, the book template has no operational
 * section, row 41 is OPEN). H tests SKIP when the stack is absent (CI's
 * stack-free job); they were confirmed EXECUTING (not skipping) at Gate 3.
 *
 * ── ADR 0002 (fail-closed boundary judgment) — U34–U44, S17–S20, H7–H8 ──
 *
 * Added after review CHANGES_REQUESTED. The guard being closed is that
 * `resolveAnchor` ran the boundary check ONLY when a caller injected a verdict,
 * so the same chain was eligible or refused depending on whether the caller
 * remembered. U34 is the regression guard for exactly that.
 *
 * Two of these pass BEFORE the amendment, for different reasons — stated so 64
 * green lines don't hide one of them:
 *   - U40 is a true regression sentinel: at the v1 policy distance (0) the chain
 *     is one goal, so there are zero steps and the new guard must NOT fire. It
 *     must keep passing afterward — that is the proof v1 behavior is unchanged.
 *   - U38 currently passes VACUOUSLY: the un-amended core ignores the
 *     `boundaryVerdicts` array entirely, so its eligible:true comes from the
 *     ABSENT guard rather than from verdicts working. It is not discriminating
 *     on its own; it becomes meaningful only once the guard exists, and the
 *     discrimination in the meantime is carried by U34/U36/U37/U39, which all
 *     fail now.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIRECTION_CORE = path.join(ROOT, 'src/lib/brain/direction.js');
const GOALS_CORE = path.join(ROOT, 'src/lib/brain/goals.js');
const BRAIN_API = path.join(ROOT, 'src/api/brain/index.js');
const DIRECTOR_ROLE = path.join(ROOT, 'engineering-team/roles/director.md');
const DIRECT_SKILL = path.join(ROOT, '.claude/skills/direct-feature/SKILL.md');
const BOOK_TEMPLATE = path.join(ROOT, 'engineering-team/templates/book.md');
const GATE_JUDGE = path.join(ROOT, '.claude/agents/gate-judge.md');
const CLAUDE_MD = path.join(ROOT, 'CLAUDE.md');
const OPEN_MD = path.join(ROOT, 'OPEN.md');
const BUDGETS = path.join(ROOT, 'scripts/harness-budgets.txt');

const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

// The eight sibling suites that pin the brain module's import surface; each must
// positively re-pin to admit lib/brain/direction (ADR Consequences — Phase-3 lane).
const IMPORT_PINNED_SUITES = [
  'attach-the-world.test.js',
  'break-a-goal-into-pieces.test.js',
  'capture-a-goal-and-see-it.test.js',
  'sessions-read-the-brain.test.js',
  'structures-the-brain-can-trust.test.js',
  'teach-it-what-matters.test.js',
  'the-brain-survives.test.js',
  'the-proposal-loop.test.js',
];

// The refusal codes the ADRs name — SEVEN since ADR 0002 d10 added the
// fail-closed `boundary-unjudged` (0001 d2/d4/d5 named the first six).
const REFUSALS = ['goal-not-found', 'ambiguous-slug', 'no-anchor-in-range', 'chain-broken', 'anchor-stale', 'boundary-widened', 'boundary-unjudged'];

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function short(x, n = 260) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}

function loadDirectionCore() {
  if (!fs.existsSync(DIRECTION_CORE)) {
    throw new Error('src/lib/brain/direction.js does not exist yet — the direction core (ADR 0001 d1) is not implemented.');
  }
  try { return require(DIRECTION_CORE); }
  catch (e) { throw new Error(`src/lib/brain/direction.js failed to require: ${e.message}`); }
}
const CORE_MISSING_FN = (fn) =>
  `src/lib/brain/direction.js does not export ${fn}() yet — the direction core (ADR 0001 d1) is not implemented.`;

function needFn(core, name) {
  assert(typeof core[name] === 'function', CORE_MISSING_FN(name));
  return core[name];
}

/* ── synthetic fixtures (U-class) ─────────────────────────────────────── */

const TA = 'synthetic-ta'; // handles are opaque strings to the core — no hex needed

/** A parsed goal record in the parseGoalRow shape (src/lib/brain/goals.js:39-51). */
function goal(over = {}) {
  const slug = over.slug || 'some-goal';
  return {
    uuid: `39999:${TA}:${slug}`,
    name: slug.replace(/-/g, ' '),
    slug,
    statement: `the ask for ${slug}`,
    origin: 'owner',
    capturedOn: '2026-07-01',
    createdAt: 1_784_000_000,
    deliverable: `what done produces for ${slug}`,
    boundary: `what ${slug} stays inside`,
    parent: null,
    ...over,
  };
}

/** A parsed proposal record in the parseProposalRow shape (src/lib/brain/proposals.js:54-67). */
function prop(over = {}) {
  return {
    uuid: `39999:${TA}:proposed-fixture`,
    name: 'proposed: some goal',
    slug: 'proposed-some-goal-abcd1234',
    summary: 'why now',
    type: 'proposed',
    goal: 'some-goal',
    whyNow: 'why now',
    passedOver: [],
    proposalId: null,
    reason: null,
    happenedOn: '2026-07-20',
    createdAt: 1_784_000_000,
    ...over,
  };
}

/** An `approved` decision fact naming `goalSlug` (ADR 0006 d4/d7 shape). */
function approvedFor(goalSlug, over = {}) {
  return prop({
    uuid: `39999:${TA}:approved-${goalSlug}`,
    name: `approved: ${goalSlug}`,
    slug: `approved-${goalSlug}-0001`,
    type: 'approved',
    goal: goalSlug,
    proposalId: `proposed-${goalSlug}-0001`,
    happenedOn: '2026-07-21',
    createdAt: 1_784_000_000,
    ...over,
  });
}

/** Goal records → resolveDecomposition-annotated records, via the REAL goals core. */
function annotate(records) {
  const { resolveDecomposition } = require(GOALS_CORE);
  return resolveDecomposition(records);
}

/**
 * A three-generation chain: grandparent ← parent ← child (child is the target).
 *
 * The boundary TEXT is deliberately slug-free. `goal()`'s default boundary
 * embeds its own slug ("what child stays inside"), which would make U23's
 * blinding assertion — "no slug appears in what the verdict function receives"
 * — unsatisfiable by ANY correct implementation, since the two boundary strings
 * are exactly what a blinded judge is supposed to get. Neutral text keeps the
 * assertion honest: the slugs stay `grandparent`/`parent`/`child`, so a leak of
 * slugs or chain position still trips it.
 */
function chainOfThree() {
  return [
    goal({ slug: 'grandparent', boundary: 'the outermost limit of this work' }),
    goal({ slug: 'parent', parent: 'grandparent', boundary: 'a narrower limit inside the outermost one' }),
    goal({ slug: 'child', parent: 'parent', boundary: 'the narrowest limit of the three' }),
  ];
}

/** Call resolveAnchor with the house defaults; `over` overrides any argument. */
function anchor(core, over = {}) {
  const fn = needFn(core, 'resolveAnchor');
  return fn({
    goals: annotate(over.goals || [goal({ slug: 'some-goal' })]),
    proposals: over.proposals || [],
    goalSlug: over.goalSlug || 'some-goal',
    maxAnchorDistance: over.maxAnchorDistance === undefined ? 0 : over.maxAnchorDistance,
    ...(over.boundaryVerdict ? { boundaryVerdict: over.boundaryVerdict } : {}),
    ...(over.boundaryVerdicts !== undefined ? { boundaryVerdicts: over.boundaryVerdicts } : {}),
  });
}

/** A distance-2 chain whose grandparent is ratified — 2 boundary steps to judge. */
function judgeableChain(over = {}) {
  return {
    goals: chainOfThree(),
    proposals: [approvedFor('grandparent')],
    goalSlug: 'child',
    maxAnchorDistance: 2,
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

/** Count Owner-Goal elements — the read-only proof that a GET wrote nothing. */
function goalElementCount() {
  const r = loopbackPostJson('/api/neo4j/query', {
    cypher: 'MATCH (e:NostrEvent)-[:HAS_TAG]->(j:NostrEventTag {type:"json"}) WHERE j.value CONTAINS "tapestryOwnerGoal" RETURN count(e) AS n',
  });
  const row = r && r.data && r.data[0];
  assert(row && typeof row.n !== 'undefined', `goal-count probe returned no row: ${short(r)}`);
  return Number(row.n);
}

/* ══════════════════════════════════════════════════════════════════════
   U-class — the pure direction core (AC2, AC3, AC4 + d4, d9.3)
   ══════════════════════════════════════════════════════════════════════ */

test('U1 (AC3): the goal itself, approved, anchors at distance 0 — eligible', () => {
  const core = loadDirectionCore();
  const r = anchor(core, { proposals: [approvedFor('some-goal')] });
  assert(r && r.eligible === true, `expected eligible:true for a goal with its own approved proposal fact; got ${short(r)}`);
  assert(r.anchor && r.anchor.slug === 'some-goal', `expected the anchor to be the goal itself; got ${short(r.anchor)}`);
  assert(r.anchor.distance === 0, `expected distance 0; got ${short(r.anchor.distance)}`);
  assert(!r.refusal, `expected no refusal; got ${short(r.refusal)}`);
});

test('U2 (AC3): the anchor carries the ratifying proposal — proposalId and approvedOn', () => {
  const core = loadDirectionCore();
  const r = anchor(core, { proposals: [approvedFor('some-goal', { proposalId: 'proposed-some-goal-0001', happenedOn: '2026-07-21' })] });
  assert(r.eligible === true, `expected eligible; got ${short(r)}`);
  assert(r.anchor.proposalId === 'proposed-some-goal-0001',
    `the anchor must name the ratifying proposal (ADR d9.2 provenance); got ${short(r.anchor.proposalId)}`);
  assert(r.anchor.approvedOn === '2026-07-21',
    `the anchor must carry approvedOn; got ${short(r.anchor.approvedOn)}`);
});

test('U3 (AC3): an un-approved goal at distance 0 refuses `no-anchor-in-range` and NAMES every goal walked', () => {
  const core = loadDirectionCore();
  const r = anchor(core, { proposals: [] });
  assert(r.eligible === false, `expected eligible:false with no approved fact; got ${short(r)}`);
  assert(r.refusal === 'no-anchor-in-range', `expected refusal 'no-anchor-in-range'; got ${short(r.refusal)}`);
  const said = `${r.error || ''} ${short(r.detail, 400)} ${JSON.stringify(r.chain || [])}`;
  assert(said.includes('some-goal'),
    `AC3 requires the refusal to report which goals it walked — 'some-goal' appears nowhere in the refusal: ${short(said, 400)}`);
});

test('U4 (AC3): a `proposed` fact does NOT anchor — only an `approved` decision does', () => {
  const core = loadDirectionCore();
  const r = anchor(core, { proposals: [prop({ goal: 'some-goal', type: 'proposed' })] });
  assert(r.eligible === false,
    `a nomination is not a ratification — only type:'approved' anchors (ADR d2); got ${short(r)}`);
  assert(r.refusal === 'no-anchor-in-range', `expected 'no-anchor-in-range'; got ${short(r.refusal)}`);
});

test('U5 (AC3): a `skipped` fact does NOT anchor', () => {
  const core = loadDirectionCore();
  const r = anchor(core, { proposals: [prop({ goal: 'some-goal', type: 'skipped', reason: 'not now' })] });
  assert(r.eligible === false, `a skip is not a ratification; got ${short(r)}`);
  assert(r.refusal === 'no-anchor-in-range', `expected 'no-anchor-in-range'; got ${short(r.refusal)}`);
});

test('U6 (AC3, THE POLICY-PARAMETER PROOF): the SAME call resolves an ancestor anchor at distance 2 when maxAnchorDistance is 2 — 0 is not special-cased', () => {
  const core = loadDirectionCore();
  const goals = chainOfThree();
  const proposals = [approvedFor('grandparent')];

  const atZero = anchor(core, { goals, proposals, goalSlug: 'child', maxAnchorDistance: 0 });
  assert(atZero.eligible === false && atZero.refusal === 'no-anchor-in-range',
    `at v1's distance 0 an ancestor ratification must NOT anchor the child; got ${short(atZero)}`);

  const atTwo = anchor(core, { goals, proposals, goalSlug: 'child', maxAnchorDistance: 2 });
  assert(atTwo.eligible === true,
    `raising the policy parameter to 2 must resolve the grandparent anchor through the SAME code path (ADR d3 — loosening is a policy act, not a redesign); got ${short(atTwo)}`);
  assert(atTwo.anchor.slug === 'grandparent', `expected anchor 'grandparent'; got ${short(atTwo.anchor)}`);
  assert(atTwo.anchor.distance === 2, `expected distance 2; got ${short(atTwo.anchor.distance)}`);
});

test('U7 (AC3): distance 1 resolves a parent anchor — the walk is continuous, not two special cases', () => {
  const core = loadDirectionCore();
  const r = anchor(core, { goals: chainOfThree(), proposals: [approvedFor('parent')], goalSlug: 'child', maxAnchorDistance: 1 });
  assert(r.eligible === true, `a parent ratification must anchor at distance 1; got ${short(r)}`);
  assert(r.anchor.slug === 'parent' && r.anchor.distance === 1, `expected parent@1; got ${short(r.anchor)}`);
});

test('U8 (AC3): the nearest ratified ancestor wins when several are approved', () => {
  const core = loadDirectionCore();
  const r = anchor(core, {
    goals: chainOfThree(),
    proposals: [approvedFor('grandparent'), approvedFor('parent')],
    goalSlug: 'child',
    maxAnchorDistance: 2,
  });
  assert(r.eligible === true, `expected eligible; got ${short(r)}`);
  assert(r.anchor.slug === 'parent',
    `ADR d2 says the NEAREST ratified goal in the chain is the anchor; got ${short(r.anchor.slug)}`);
});

test('U9 (AC3): an anchor beyond the configured distance refuses, and the refusal names all goals walked', () => {
  const core = loadDirectionCore();
  const r = anchor(core, { goals: chainOfThree(), proposals: [approvedFor('grandparent')], goalSlug: 'child', maxAnchorDistance: 1 });
  assert(r.refusal === 'no-anchor-in-range', `expected 'no-anchor-in-range'; got ${short(r.refusal)}`);
  const said = `${r.error || ''} ${short(r.detail, 400)} ${JSON.stringify(r.chain || [])}`;
  assert(said.includes('child') && said.includes('parent'),
    `the refusal must report the goals actually walked (child, parent); got ${short(said, 400)}`);
  assert(!said.includes('grandparent'),
    `the walk stops at the configured distance — 'grandparent' was never reached and must not be reported as walked: ${short(said, 400)}`);
});

test('U10 (AC3): an unknown slug refuses `goal-not-found`', () => {
  const core = loadDirectionCore();
  const r = anchor(core, { goalSlug: 'no-such-goal' });
  assert(r.refusal === 'goal-not-found', `expected 'goal-not-found'; got ${short(r)}`);
});

test('U11 (AC3): two goals sharing a slug refuse `ambiguous-slug` — never guess (the updateGoalIntent:2325 precedent)', () => {
  const core = loadDirectionCore();
  const dupe = goal({ slug: 'some-goal' });
  dupe.uuid = `39999:${TA}:some-goal-second`;
  const r = anchor(core, { goals: [goal({ slug: 'some-goal' }), dupe], proposals: [approvedFor('some-goal')] });
  assert(r.refusal === 'ambiguous-slug', `expected 'ambiguous-slug'; got ${short(r)}`);
});

test('U12 (AC3): a chain whose parent slug does not resolve refuses `chain-broken`', () => {
  const core = loadDirectionCore();
  const orphan = goal({ slug: 'child', parent: 'nowhere' });
  const r = anchor(core, { goals: [orphan], proposals: [approvedFor('nowhere')], goalSlug: 'child', maxAnchorDistance: 2 });
  assert(r.refusal === 'chain-broken',
    `an unresolvable parent must refuse rather than walk a broken chain (ADR d2); got ${short(r)}`);
});

test('U13 (AC3): a parent cycle refuses `chain-broken` and terminates (resolveDecomposition breaks it; the walk must not spin)', () => {
  const core = loadDirectionCore();
  const a = goal({ slug: 'goal-a', parent: 'goal-b' });
  const b = goal({ slug: 'goal-b', parent: 'goal-a' });
  const r = anchor(core, { goals: [a, b], proposals: [approvedFor('goal-b')], goalSlug: 'goal-a', maxAnchorDistance: 3 });
  assert(r.refusal === 'chain-broken', `a cycle must refuse 'chain-broken'; got ${short(r)}`);
});

test('U14 (d4): isAnchorStale is TRUE when the goal was re-signed after its approval', () => {
  const core = loadDirectionCore();
  const isAnchorStale = needFn(core, 'isAnchorStale');
  const g = goal({ slug: 'some-goal', createdAt: 1_784_000_500 });
  const a = approvedFor('some-goal', { createdAt: 1_784_000_000 });
  assert(isAnchorStale(g, a) === true,
    'a goal whose createdAt exceeds its approval\'s createdAt was rewritten after ratification (ADR d4) — expected stale:true.');
});

test('U15 (d4): isAnchorStale is FALSE when the goal predates or matches its approval', () => {
  const core = loadDirectionCore();
  const isAnchorStale = needFn(core, 'isAnchorStale');
  const older = goal({ slug: 'some-goal', createdAt: 1_784_000_000 });
  const appr = approvedFor('some-goal', { createdAt: 1_784_000_500 });
  assert(isAnchorStale(older, appr) === false, 'a goal older than its approval is not stale.');
  const same = goal({ slug: 'some-goal', createdAt: 1_784_000_500 });
  assert(isAnchorStale(same, appr) === false, 'equal timestamps are not stale — only strictly-newer is a rewrite.');
});

test('U16 (d4): a stale anchor refuses `anchor-stale`, and the refusal names the goal and both timestamps', () => {
  const core = loadDirectionCore();
  const r = anchor(core, {
    goals: [goal({ slug: 'some-goal', createdAt: 1_784_000_500 })],
    proposals: [approvedFor('some-goal', { createdAt: 1_784_000_000 })],
  });
  assert(r.eligible === false && r.refusal === 'anchor-stale', `expected refusal 'anchor-stale'; got ${short(r)}`);
  const said = `${r.error || ''} ${short(r.detail, 400)}`;
  assert(said.includes('some-goal'), `the refusal must name the goal; got ${short(said, 400)}`);
  assert(/1784000500/.test(said.replace(/[_,]/g, '')) && /1784000000/.test(said.replace(/[_,]/g, '')),
    `the refusal must report both timestamps so the owner can see what moved; got ${short(said, 400)}`);
});

test('U17 (AC4): boundarySteps on a length-1 chain yields ZERO steps — the v1 vacuity, present but unexercised', () => {
  const core = loadDirectionCore();
  const boundarySteps = needFn(core, 'boundarySteps');
  const steps = boundarySteps([goal({ slug: 'some-goal' })]);
  assert(Array.isArray(steps), `boundarySteps must return an array; got ${short(steps)}`);
  assert(steps.length === 0,
    `at v1's anchor distance the chain is length 1, so there are no parent→child steps to judge (ADR d5); got ${steps.length}`);
});

test('U18 (AC4): boundarySteps on a length-3 chain yields 2 ordered steps carrying both boundary texts', () => {
  const core = loadDirectionCore();
  const boundarySteps = needFn(core, 'boundarySteps');
  const chain = [
    goal({ slug: 'grandparent', boundary: 'GP boundary' }),
    goal({ slug: 'parent', parent: 'grandparent', boundary: 'P boundary' }),
    goal({ slug: 'child', parent: 'parent', boundary: 'C boundary' }),
  ];
  const steps = boundarySteps(chain);
  assert(steps.length === 2, `a 3-goal chain has 2 parent→child steps; got ${steps.length}`);
  const texts = steps.map((s) => `${s.parentBoundary}→${s.childBoundary}`);
  assert(texts.includes('GP boundary→P boundary') && texts.includes('P boundary→C boundary'),
    `each step must carry the parent's and child's boundary TEXT (the judge sees only these two strings — ADR d5); got ${short(texts)}`);
  for (const s of steps) {
    assert(s.parentSlug && s.childSlug, `each step must name its parent and child slugs; got ${short(s)}`);
  }
});

test('U19 (AC4): applyBoundaryVerdicts returns null when every step narrows', () => {
  const core = loadDirectionCore();
  const boundarySteps = needFn(core, 'boundarySteps');
  const applyBoundaryVerdicts = needFn(core, 'applyBoundaryVerdicts');
  const steps = boundarySteps(chainOfThree());
  const widening = applyBoundaryVerdicts(steps, steps.map(() => 'narrows'));
  assert(widening === null, `all-narrows must yield null (no widening step); got ${short(widening)}`);
});

test('U20 (AC4): applyBoundaryVerdicts returns the widening step, and it is the FIRST one', () => {
  const core = loadDirectionCore();
  const boundarySteps = needFn(core, 'boundarySteps');
  const applyBoundaryVerdicts = needFn(core, 'applyBoundaryVerdicts');
  const steps = boundarySteps(chainOfThree());
  assert(steps.length === 2, `precondition: expected 2 steps; got ${steps.length}`);
  const both = applyBoundaryVerdicts(steps, ['widens', 'widens']);
  assert(both && both.childSlug === steps[0].childSlug,
    `when several steps widen, the FIRST is reported; got ${short(both)}`);
  const second = applyBoundaryVerdicts(steps, ['narrows', 'widens']);
  assert(second && second.childSlug === steps[1].childSlug,
    `expected the second step to be reported when only it widens; got ${short(second)}`);
});

test('U21 (AC4): a widening step in the chain refuses `boundary-widened` and NAMES the step — verdicts injected, never imported', () => {
  const core = loadDirectionCore();
  const r = anchor(core, {
    goals: chainOfThree(),
    proposals: [approvedFor('grandparent')],
    goalSlug: 'child',
    maxAnchorDistance: 2,
    boundaryVerdict: () => 'widens',
  });
  assert(r.eligible === false, `a widening boundary must block the run; got ${short(r)}`);
  assert(r.refusal === 'boundary-widened', `expected refusal 'boundary-widened'; got ${short(r.refusal)}`);
  const said = `${r.error || ''} ${short(r.detail, 400)}`;
  assert(said.includes('parent') || said.includes('child'),
    `the refusal must name the widening step (AC4); got ${short(said, 400)}`);
});

test('U22 (AC4): with all-narrows verdicts the same distance-2 chain is eligible — the check gates, it does not merely exist', () => {
  const core = loadDirectionCore();
  const r = anchor(core, {
    goals: chainOfThree(),
    proposals: [approvedFor('grandparent')],
    goalSlug: 'child',
    maxAnchorDistance: 2,
    boundaryVerdict: () => 'narrows',
  });
  assert(r.eligible === true, `all-narrows must pass the boundary check; got ${short(r)}`);
});

test('U23 (AC4): the injected verdict function receives ONLY the two boundary strings — no slugs, no chain position (the blinding contract)', () => {
  const core = loadDirectionCore();
  const seen = [];
  anchor(core, {
    goals: chainOfThree(),
    proposals: [approvedFor('grandparent')],
    goalSlug: 'child',
    maxAnchorDistance: 2,
    boundaryVerdict: (...args) => { seen.push(args); return 'narrows'; },
  });
  assert(seen.length > 0, 'the boundary verdict function was never called on a multi-goal chain.');
  for (const args of seen) {
    const blob = JSON.stringify(args);
    assert(!/grandparent|parent|child/.test(blob),
      `ADR d5: the judge sees only the two boundary strings — no slugs, no chain position, nothing carrying a progress signal. Got: ${short(blob, 300)}`);
  }
});

test('U24 (AC2): deriveTerms maps statement→ask, deliverable→successCriteria, boundary→ceiling', () => {
  const core = loadDirectionCore();
  const deriveTerms = needFn(core, 'deriveTerms');
  const g = goal({ slug: 'some-goal', statement: 'THE ASK', deliverable: 'THE DELIVERABLE', boundary: 'THE BOUNDARY' });
  const t = deriveTerms(g, 50);
  assert(t.ask === 'THE ASK', `statement → ask; got ${short(t.ask)}`);
  assert(t.successCriteria === 'THE DELIVERABLE', `deliverable → successCriteria; got ${short(t.successCriteria)}`);
  assert(t.ceiling === 'THE BOUNDARY', `boundary → ceiling; got ${short(t.ceiling)}`);
  assert(t.estimate === 50, `chanceOfSuccess → estimate; got ${short(t.estimate)}`);
  assert(t.estimateSource === 'goal', `a present estimate is sourced from the goal; got ${short(t.estimateSource)}`);
});

test('U25 (AC2): an absent estimate is RECORDED AS ABSENT — never invented', () => {
  const core = loadDirectionCore();
  const deriveTerms = needFn(core, 'deriveTerms');
  const t = deriveTerms(goal({ slug: 'some-goal' }), null);
  assert(t.estimate === null, `an absent estimate must be null, never a default number; got ${short(t.estimate)}`);
  assert(t.estimateSource === 'absent',
    `AC2 requires the artifact to record the estimate as ABSENT rather than invent one; got ${short(t.estimateSource)}`);
});

test('U26 (AC2): parseEstimate reads chanceOfSuccess from the raw row, and tolerates absence and junk', () => {
  const core = loadDirectionCore();
  const parseEstimate = needFn(core, 'parseEstimate');
  const row = (section) => ({ uuid: 'u', name: 'n', createdAt: 1, json: JSON.stringify({ tapestryOwnerGoal: section }) });
  assert(parseEstimate(row({ slug: 'g', chanceOfSuccess: 50 })) === 50, 'a numeric chanceOfSuccess must be read through.');
  assert(parseEstimate(row({ slug: 'g' })) === null, 'an absent chanceOfSuccess must yield null.');
  assert(parseEstimate(row({ slug: 'g', chanceOfSuccess: 'lots' })) === null, 'a non-numeric chanceOfSuccess must yield null, not NaN.');
  assert(parseEstimate({ uuid: 'u', json: 'not json' }) === null, 'malformed json must yield null, never throw (the parseGoalRow tolerance idiom).');
  assert(parseEstimate(null) === null, 'a null row must yield null, never throw.');
});

test('U27 (AC2): SURRENDERED names the baseline commit AND the pinned governing versions, with a reason', () => {
  const core = loadDirectionCore();
  const list = core.SURRENDERED;
  assert(Array.isArray(list) && list.length > 0, CORE_MISSING_FN('SURRENDERED (as exported data)'));
  const blob = JSON.stringify(list).toLowerCase();
  assert(blob.includes('baseline'), `SURRENDERED must name the baseline commit; got ${short(blob, 300)}`);
  assert(blob.includes('pinned') || blob.includes('governing'), `SURRENDERED must name the pinned governing versions; got ${short(blob, 300)}`);
  assert(blob.includes('reproducib'),
    `AC2 requires the reason to be stated, not just the fact — expected the reproducibility trade named; got ${short(blob, 300)}`);
});

test('U28 (AC2): UNAVAILABLE names the estimate dependency AND dependsOn', () => {
  const core = loadDirectionCore();
  const list = core.UNAVAILABLE;
  assert(Array.isArray(list) && list.length > 0, CORE_MISSING_FN('UNAVAILABLE (as exported data)'));
  const blob = JSON.stringify(list);
  assert(/store-and-show-the-prompt-and-the-estimate/.test(blob),
    `UNAVAILABLE must name the estimate's dependency goal by slug; got ${short(blob, 300)}`);
  assert(/dependsOn/.test(blob), `UNAVAILABLE must name dependsOn as a field that does not exist; got ${short(blob, 300)}`);
});

test('U29 (d9.3): termsMatch is TRUE when the live goal equals the recorded verbatim text — a benign re-sign does not halt a run', () => {
  const core = loadDirectionCore();
  const termsMatch = needFn(core, 'termsMatch');
  const g = goal({ slug: 'some-goal', deliverable: 'D', boundary: 'B', createdAt: 9_999_999 });
  const r = termsMatch(g, { deliverable: 'D', boundary: 'B' });
  assert(r && r.match === true,
    'd9.3 compares verbatim TEXT, not timestamps — a re-signed goal with unchanged terms must not halt the run.');
  assert(Array.isArray(r.changed) && r.changed.length === 0, `expected changed:[]; got ${short(r.changed)}`);
});

test('U30 (d9.3): termsMatch reports WHICH field moved — deliverable, boundary, or both', () => {
  const core = loadDirectionCore();
  const termsMatch = needFn(core, 'termsMatch');
  const g = goal({ slug: 'some-goal', deliverable: 'D2', boundary: 'B' });
  const d = termsMatch(g, { deliverable: 'D1', boundary: 'B' });
  assert(d.match === false && d.changed.join() === 'deliverable', `expected changed:['deliverable']; got ${short(d)}`);

  const g2 = goal({ slug: 'some-goal', deliverable: 'D', boundary: 'B2' });
  const b = termsMatch(g2, { deliverable: 'D', boundary: 'B1' });
  assert(b.match === false && b.changed.join() === 'boundary', `expected changed:['boundary']; got ${short(b)}`);

  const g3 = goal({ slug: 'some-goal', deliverable: 'D2', boundary: 'B2' });
  const both = termsMatch(g3, { deliverable: 'D1', boundary: 'B1' });
  assert(both.match === false && both.changed.length === 2,
    `expected both fields reported so the halt can name what moved; got ${short(both)}`);
});

test('U31 (d9.3): termsMatch trims — leading/trailing whitespace is not a term change', () => {
  const core = loadDirectionCore();
  const termsMatch = needFn(core, 'termsMatch');
  const g = goal({ slug: 'some-goal', deliverable: '  D  ', boundary: '\nB\n' });
  const r = termsMatch(g, { deliverable: 'D', boundary: 'B' });
  assert(r.match === true, `whitespace-only difference must not halt a run; got ${short(r)}`);
});

test('U32: every refusal the ADR names is reachable, and no refusal outside the named set is ever produced', () => {
  const core = loadDirectionCore();
  const produced = new Set();
  const collect = (r) => { if (r && r.refusal) produced.add(r.refusal); };
  collect(anchor(core, { goalSlug: 'no-such-goal' }));
  const dupe = goal({ slug: 'some-goal' }); dupe.uuid = `39999:${TA}:dup`;
  collect(anchor(core, { goals: [goal({ slug: 'some-goal' }), dupe] }));
  collect(anchor(core, { proposals: [] }));
  collect(anchor(core, { goals: [goal({ slug: 'child', parent: 'nowhere' })], goalSlug: 'child', maxAnchorDistance: 2 }));
  collect(anchor(core, {
    goals: [goal({ slug: 'some-goal', createdAt: 2 })],
    proposals: [approvedFor('some-goal', { createdAt: 1 })],
  }));
  collect(anchor(core, judgeableChain({ boundaryVerdict: () => 'widens' })));
  // ADR 0002 d10 — the seventh: steps exist and nobody judged them.
  collect(anchor(core, judgeableChain()));
  for (const code of produced) {
    assert(REFUSALS.includes(code), `unnamed refusal code '${code}' — the ADRs name exactly: ${REFUSALS.join(', ')}`);
  }
  for (const code of REFUSALS) {
    assert(produced.has(code), `refusal '${code}' was never produced by its scenario — got: ${[...produced].join(', ') || '(none)'}`);
  }
});

test('U33 (AC3): DEFAULT_MAX_ANCHOR_DISTANCE is 0 — v1 policy is the goal itself', () => {
  const core = loadDirectionCore();
  assert(core.DEFAULT_MAX_ANCHOR_DISTANCE === 0,
    `ADR d3 fixes the v1 policy value at 0 (the anchor must be the goal itself); got ${short(core.DEFAULT_MAX_ANCHOR_DISTANCE)}`);
});

/* ══════════════════════════════════════════════════════════════════════
   U-class, ADR 0002 — the boundary guard must FAIL CLOSED (d10–d13)
   ══════════════════════════════════════════════════════════════════════ */

test('U34 (0002 d10, THE REGRESSION GUARD): steps exist and NOBODY judged them — the run is refused, not blessed', () => {
  const core = loadDirectionCore();
  const r = anchor(core, judgeableChain());
  assert(r.eligible === false,
    'ADR 0002 d10: a chain with unjudged boundary steps must NEVER be eligible. Before this fix the same call returned eligible:true — the invariant was opt-in, so a caller who forgot to inject a verdict silently bypassed half a paired guard.');
  assert(r.refusal === 'boundary-unjudged', `expected refusal 'boundary-unjudged'; got ${short(r.refusal)}`);
});

test('U35 (0002 d10): the unjudged refusal is HONEST — it says nobody judged, never that something widened', () => {
  const core = loadDirectionCore();
  const r = anchor(core, judgeableChain());
  const said = `${r.error || ''} ${short(r.detail, 400)}`;
  assert(!/widen/i.test(said),
    `the refusal must not assert a widening no judge produced — that sentence lands in the decision journal and the book audit as though a judgment happened. Got: ${short(said, 400)}`);
  assert(/judg/i.test(said),
    `the refusal must say the steps were not judged; got: ${short(said, 400)}`);
});

test('U36 (0002 d11): a verdict list shorter or longer than the step count refuses — never a silent pass', () => {
  const core = loadDirectionCore();
  const short1 = anchor(core, judgeableChain({ boundaryVerdicts: ['narrows'] }));
  assert(short1.refusal === 'boundary-unjudged',
    `2 steps but 1 verdict must refuse 'boundary-unjudged'; got ${short(short1)}`);
  const long1 = anchor(core, judgeableChain({ boundaryVerdicts: ['narrows', 'narrows', 'narrows'] }));
  assert(long1.refusal === 'boundary-unjudged',
    `2 steps but 3 verdicts must refuse 'boundary-unjudged'; got ${short(long1)}`);
  const empty = anchor(core, judgeableChain({ boundaryVerdicts: [] }));
  assert(empty.refusal === 'boundary-unjudged',
    `2 steps but 0 verdicts must refuse 'boundary-unjudged'; got ${short(empty)}`);
});

test('U37 (0002 d11): an unrecognized verdict token refuses — a typo must not read as approval', () => {
  const core = loadDirectionCore();
  for (const bad of [['narrows', 'yes'], ['ok', 'narrows'], ['narrows', ''], ['narrows', null]]) {
    const r = anchor(core, judgeableChain({ boundaryVerdicts: bad }));
    assert(r.refusal === 'boundary-unjudged',
      `verdict list ${JSON.stringify(bad)} contains a token that is neither 'narrows' nor 'widens' and must refuse 'boundary-unjudged'; got ${short(r)}`);
  }
});

test('U38 (0002 d11): a complete valid verdict list of all-narrows passes the guard', () => {
  const core = loadDirectionCore();
  const r = anchor(core, judgeableChain({ boundaryVerdicts: ['narrows', 'narrows'] }));
  assert(r.eligible === true, `2 steps + 2 'narrows' verdicts must be eligible; got ${short(r)}`);
  assert(r.anchor && r.anchor.slug === 'grandparent', `expected the grandparent anchor; got ${short(r.anchor)}`);
});

test('U39 (0002 d11): a `widens` token in the list refuses boundary-WIDENED, distinct from unjudged, and names the step', () => {
  const core = loadDirectionCore();
  const r = anchor(core, judgeableChain({ boundaryVerdicts: ['narrows', 'widens'] }));
  assert(r.refusal === 'boundary-widened',
    `a judged widening is 'boundary-widened' — NOT 'boundary-unjudged'. The two must stay distinguishable in the journal so an operator can tell "a judge said no" from "nobody looked". Got ${short(r.refusal)}`);
  const said = `${r.error || ''} ${short(r.detail, 400)}`;
  assert(said.includes('child') || said.includes('parent'), `the refusal must name the widening step; got ${short(said, 400)}`);
});

test('U40 (0002 d11 — v1 IS UNCHANGED): at the v1 policy distance there are no steps, so no verdicts are needed', () => {
  const core = loadDirectionCore();
  const r = anchor(core, { proposals: [approvedFor('some-goal')], maxAnchorDistance: 0 });
  assert(r.eligible === true,
    `at maxAnchorDistance 0 the chain is one goal, so there are zero steps and the fail-closed guard must not fire. Got ${short(r)}`);
  assert(r.refusal == null, `expected no refusal at v1; got ${short(r.refusal)}`);
});

test('U41 (0002 d12): staleness fails CLOSED — an unknowable goal timestamp is treated as stale', () => {
  const core = loadDirectionCore();
  const isAnchorStale = needFn(core, 'isAnchorStale');
  assert(isAnchorStale(goal({ slug: 'g', createdAt: null }), approvedFor('g', { createdAt: 100 })) === true,
    'a missing goal createdAt means currency cannot be established; a safety guard must refuse rather than assume fresh.');
  assert(isAnchorStale(goal({ slug: 'g', createdAt: 100 }), approvedFor('g', { createdAt: null })) === true,
    'a missing approval createdAt likewise cannot establish currency.');
});

test('U42 (0002 d12): the unknowable-currency refusal is distinguishable from "rewritten after ratification"', () => {
  const core = loadDirectionCore();
  const unknowable = anchor(core, {
    goals: [goal({ slug: 'some-goal', createdAt: null })],
    proposals: [approvedFor('some-goal', { createdAt: 100 })],
  });
  assert(unknowable.refusal === 'anchor-stale', `expected 'anchor-stale'; got ${short(unknowable)}`);
  const said = `${unknowable.error || ''} ${short(unknowable.detail, 400)}`;
  assert(!/rewritten/i.test(said),
    `an unknowable timestamp must NOT be reported as "rewritten after ratification" — nothing established that it was. Got: ${short(said, 400)}`);
  assert(/currency|could not|unknown|missing/i.test(said),
    `the refusal must say currency could not be established; got: ${short(said, 400)}`);
});

test('U43 (0002 d13): the chain carries identity — each entry has both slug and uuid', () => {
  const core = loadDirectionCore();
  const r = anchor(core, judgeableChain({ boundaryVerdicts: ['narrows', 'narrows'] }));
  assert(Array.isArray(r.chain) && r.chain.length === 3, `expected a 3-goal chain; got ${short(r.chain)}`);
  for (const entry of r.chain) {
    assert(entry && typeof entry === 'object' && !Array.isArray(entry),
      `ADR 0002 d13: chain entries must be objects carrying identity, not bare slugs; got ${short(entry)}`);
    assert(typeof entry.slug === 'string' && entry.slug !== '', `each chain entry needs a slug; got ${short(entry)}`);
    assert(typeof entry.uuid === 'string' && entry.uuid !== '',
      `each chain entry needs a uuid so the endpoint stops re-resolving ancestors by slug (a shadowed duplicate would otherwise surface the wrong boundary text to a judge); got ${short(entry)}`);
  }
});

test('U44 (0002 d13): a refusal carries the same identity-bearing chain shape as a success', () => {
  const core = loadDirectionCore();
  const r = anchor(core, judgeableChain());
  assert(Array.isArray(r.chain), `a refusal must still carry its chain; got ${short(r.chain)}`);
  for (const entry of r.chain) {
    assert(entry && typeof entry.slug === 'string' && typeof entry.uuid === 'string',
      `refusal chains must use the same {slug, uuid} shape as success chains, so callers need no branch; got ${short(entry)}`);
  }
});

/* ══════════════════════════════════════════════════════════════════════
   S-class — source + doc assertions (AC1, AC5, d1, d7, d9)
   ══════════════════════════════════════════════════════════════════════ */

test('S1 (d1): the direction core is PURE — zero require() calls', () => {
  const src = safeRead(DIRECTION_CORE);
  assert(src, 'src/lib/brain/direction.js does not exist yet.');
  const requires = [...src.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1]);
  assert(requires.length === 0,
    `the direction core must be dependency-free like goals.js/proposals.js (ADR d1, and d5's injected verdict exists to keep it so); found: ${requires.join(', ')}`);
});

test('S2 (d1): the brain module requires the direction core and registers the read-only route', () => {
  const src = safeRead(BRAIN_API);
  assert(/require\s*\(\s*['"`][^'"`]*lib\/brain\/direction['"`]\s*\)/.test(src),
    'src/api/brain/index.js must require the direction core (the ninth).');
  assert(/app\.get\(\s*['"`]\/api\/brain\/direction\/:slug['"`]/.test(src),
    'registerBrainRoutes must register GET /api/brain/direction/:slug (ADR d1).');
});

test('S3 (d1): the direction endpoint carries the platform gate — isOwner(req) || req.localTrusted → 403', () => {
  const src = safeRead(BRAIN_API);
  const idx = src.indexOf('handleGetDirection');
  assert(idx > -1, 'src/api/brain/index.js must define handleGetDirection.');
  const body = src.slice(idx, idx + 1200);
  assert(/isOwner\s*\(\s*req\s*\)/.test(body) && /localTrusted/.test(body) && /403/.test(body),
    'the handler must gate with the platform template isOwner(req) || req.localTrusted → 403 (route-level requireOwner would 401 the loopback agent).');
});

test('S4 (d1): the direction endpoint is READ-ONLY — no mutation or strfry tokens in its handler', () => {
  const src = safeRead(BRAIN_API);
  const idx = src.indexOf('handleGetDirection');
  assert(idx > -1, 'src/api/brain/index.js must define handleGetDirection.');
  const body = src.slice(idx, idx + 1200);
  for (const tok of ['regenerateJson', 'publishToStrfry', 'signAndFinalize', 'MERGE', 'CREATE ', 'DELETE ']) {
    assert(!body.includes(tok), `the direction read must not contain the mutation token '${tok}'.`);
  }
});

test('S5 (ADR Consequences): all EIGHT sibling suites positively re-pin the brain import allowlist to admit lib/brain/direction', () => {
  const missing = [];
  for (const f of IMPORT_PINNED_SUITES) {
    const src = safeRead(path.join(ROOT, 'test', f));
    if (!src) { missing.push(`${f} (unreadable)`); continue; }
    if (!/lib\\?\/brain\\?\/direction/.test(src)) missing.push(f);
  }
  assert(missing.length === 0,
    `these suites pin the brain module's import surface and must be re-pinned to admit lib/brain/direction (Phase-3 lane — Gate 4 pins an empty test/ diff): ${missing.join(', ')}`);
});

test('S6 (AC1): director.md names BOTH modes and says which to use when', () => {
  const src = safeRead(DIRECTOR_ROLE);
  assert(/operational/i.test(src), 'engineering-team/roles/director.md must name the operational mode (ADR d7).');
  assert(/pre-registered|armed/i.test(src), 'director.md must still name the armed/pre-registered mode.');
  assert(/## Operational direction/.test(src),
    "director.md must carry a '## Operational direction' section (ADR d7).");
});

test('S7 (AC3): director.md makes an eligible anchor a PRECONDITION and points at the endpoint', () => {
  const src = safeRead(DIRECTOR_ROLE);
  assert(/\/api\/brain\/direction/.test(src),
    'director.md must point at GET /api/brain/direction/:slug rather than restating the resolution rules (ADR d1/d7).');
  assert(/eligible/i.test(src), "director.md must state that an 'eligible' answer is a precondition to running.");
});

test('S8 (AC5): the non-negotiables are stated ONCE — the operational section references them, never restates', () => {
  const src = safeRead(DIRECTOR_ROLE);
  const stoppingHeadings = (src.match(/^##+\s*Stopping rules/gim) || []).length;
  assert(stoppingHeadings === 1,
    `AC5 requires the stopping rules to live in ONE place that both modes reference; found ${stoppingHeadings} 'Stopping rules' headings.`);
  const rubricHeadings = (src.match(/^##+\s*Gate rubrics/gim) || []).length;
  assert(rubricHeadings === 1, `the gate rubrics must not be duplicated per mode; found ${rubricHeadings}.`);
  const judgeHeadings = (src.match(/^##+\s*The blinded gate-judge protocol/gim) || []).length;
  assert(judgeHeadings === 1, `the judge protocol must not be duplicated per mode; found ${judgeHeadings}.`);
});

test('S9 (AC4/d5): director.md states the boundary judge is blinded to everything but the two boundary strings', () => {
  const src = safeRead(DIRECTOR_ROLE);
  const idx = src.search(/## Operational direction/);
  assert(idx > -1, "director.md must carry a '## Operational direction' section.");
  const section = src.slice(idx, idx + 4000);
  assert(/boundar/i.test(section), 'the operational section must describe the boundary-narrowing check.');
  assert(/blind/i.test(section),
    'ADR d5: the boundary verdict comes from a blinded judge — the section must say so.');
});

test('S10 (d7/d9.3): the skill forks Stage 0 by mode and runs the terms-mismatch check', () => {
  const src = safeRead(DIRECT_SKILL);
  assert(/operational/i.test(src), '.claude/skills/direct-feature/SKILL.md must name the operational mode.');
  assert(/\/api\/brain\/direction/.test(src),
    'Stage 0 must call GET /api/brain/direction/:slug for an operational run (ADR d7).');
  assert(/docker exec|inside the container|container/i.test(src),
    'ADR d7: the Stage-0 call is made from INSIDE the container — host-side brain reads answer 403.');
  assert(/mismatch|re-derive|termsMatch/i.test(src),
    'ADR d9.3: Stage 0 must run the terms-mismatch check and halt on a mismatch.');
});

test('S11 (d9): the book template carries a DISTINCTLY HEADED operational section', () => {
  const src = safeRead(BOOK_TEMPLATE);
  assert(/^##\s*Direction mode \(operational\) — goal-derived\s*$/m.test(src),
    "the book template must carry '## Direction mode (operational) — goal-derived' (ADR d9) so the mode is visible at a glance.");
  assert(/^##\s*Direction mode \(experiment\)/m.test(src),
    "the pre-registered section's heading must remain distinct and present.");
});

test('S12 (d9.1): the operational section warns IN ITS OWN BODY that it is generated and hand-editing it is a defect', () => {
  const src = safeRead(BOOK_TEMPLATE);
  const idx = src.search(/^##\s*Direction mode \(operational\)/m);
  assert(idx > -1, 'the book template has no operational section yet.');
  const rest = src.slice(idx);
  const end = rest.slice(2).search(/^## /m);
  const section = end > -1 ? rest.slice(0, end + 2) : rest;
  assert(/generated|derived/i.test(section),
    'ADR d9.1: the section must say it is generated/derived from the goal.');
  assert(/defect/i.test(section),
    'ADR d9.1: the section must state IN ITS OWN BODY that hand-editing it is a defect — so the next person to open the file is told before they type.');
});

test('S13 (d9.2): the operational section carries all four provenance fields', () => {
  const src = safeRead(BOOK_TEMPLATE);
  const idx = src.search(/^##\s*Direction mode \(operational\)/m);
  assert(idx > -1, 'the book template has no operational section yet.');
  const rest = src.slice(idx);
  const end = rest.slice(2).search(/^## /m);
  const section = end > -1 ? rest.slice(0, end + 2) : rest;
  const need = [
    [/goal slug|goal:/i, 'the goal slug'],
    [/deliverable/i, 'the verbatim deliverable derived from'],
    [/boundary/i, 'the verbatim boundary derived from'],
    [/derived (at|on)|derivation/i, 'the derivation timestamp'],
    [/proposalId|ratifying proposal|approvedOn/i, 'the ratifying proposal'],
  ];
  for (const [re, what] of need) {
    assert(re.test(section), `ADR d9.2 requires ${what} in the provenance block; not found.`);
  }
});

test('S14 (AC2): the operational section carries the surrendered and unavailable lists', () => {
  const src = safeRead(BOOK_TEMPLATE);
  const idx = src.search(/^##\s*Direction mode \(operational\)/m);
  assert(idx > -1, 'the book template has no operational section yet.');
  const rest = src.slice(idx);
  const end = rest.slice(2).search(/^## /m);
  const section = end > -1 ? rest.slice(0, end + 2) : rest;
  assert(/surrender/i.test(section), 'AC2: the section must state what this mode gave up (baseline, pinned versions).');
  assert(/unavailable|not available/i.test(section), 'AC2: the section must state which terms are unavailable.');
});

test('S15 (AC1): CLAUDE.md\'s doctrine line names BOTH modes and forbids ad-hoc gate pre-authorization', () => {
  const src = safeRead(CLAUDE_MD);
  const line = (src.split('\n').find((l) => /Honor the gates/.test(l))) || '';
  assert(line, 'CLAUDE.md must still carry the "Honor the gates" doctrine bullet.');
  assert(/operational/i.test(line),
    `AC1: the doctrine line must name the operational mode; got: ${short(line, 300)}`);
  assert(/armed|pre-registered/i.test(line),
    `the doctrine line must still name the armed mode; got: ${short(line, 300)}`);
});

test('S16 (AC1/d8): OPEN.md row 41 is dispositioned DONE and cites this work', () => {
  const src = safeRead(OPEN_MD);
  const row = (src.split('\n').find((l) => /^\|\s*41\s*\|/.test(l))) || '';
  assert(row, 'OPEN.md row 41 (session-mode standing gate authorization) not found.');
  assert(/\|\s*DONE\s*\|/.test(row),
    `ADR d8: row 41 must be flipped to DONE by this story; got: ${short(row, 300)}`);
  assert(/operational[- ]direction|operational direction/i.test(row),
    `row 41's disposition must cite operational direction as its named-mode answer; got: ${short(row, 300)}`);
});

test('S17 (0002 d11): the endpoint threads the ordered `verdicts` query parameter into the core', () => {
  const src = safeRead(BRAIN_API);
  const idx = src.indexOf('handleGetDirection');
  assert(idx > -1, 'src/api/brain/index.js must define handleGetDirection.');
  const body = src.slice(idx, idx + 2600);
  assert(/req\.query/.test(body) && /verdicts/.test(body),
    'ADR 0002 d11: the handler must read req.query.verdicts and pass the ordered list to the core — otherwise the two-call flow has no second call.');
  assert(!/app\.post\(\s*['"`]\/api\/brain\/direction/.test(src),
    'the eligibility surface must stay a GET — the brain routes carry no writes (ADR 0002 Context constraint 3).');
});

test('S18 (0002 d13): the endpoint builds boundary steps from the walked chain, not by re-resolving slugs', () => {
  const src = safeRead(BRAIN_API);
  const idx = src.indexOf('handleGetDirection');
  assert(idx > -1, 'src/api/brain/index.js must define handleGetDirection.');
  const body = src.slice(idx, idx + 2600);
  assert(!/resolved\.find\s*\(\s*\(?\s*g\s*\)?\s*=>\s*g\s*&&\s*g\.slug\s*===\s*slug/.test(body),
    'ADR 0002 d13: re-resolving chain ancestors by slug can surface a shadowed duplicate\'s boundary text to a judge — build the steps from what the walk actually visited.');
});

test('S19 (0002 d11): director.md documents the two-call flow AND that passed verdicts must match journaled ones', () => {
  const src = safeRead(DIRECTOR_ROLE);
  assert(/boundary-unjudged/.test(src),
    'roles/director.md must name the boundary-unjudged outcome so a Director knows it is a judge-then-re-ask, not a halt.');
  assert(/verdicts/.test(src),
    'roles/director.md must document the verdicts channel (ADR 0002 d11).');
  assert(/journal/i.test(src) && /match/i.test(src),
    'ADR 0002 d11: the query parameter is NOT a trust boundary — director.md must require that verdicts passed here match the journaled judge verdicts.');
});

test('S20 (0002 d11): the skill treats boundary-unjudged as judge-then-re-ask, not a halt', () => {
  const src = safeRead(DIRECT_SKILL);
  assert(/boundary-unjudged/.test(src),
    '.claude/skills/direct-feature/SKILL.md Stage 0 must distinguish boundary-unjudged (judge, journal, re-ask) from the refusals that halt.');
});

/* ══════════════════════════════════════════════════════════════════════
   H-class — live local stack, READ-ONLY, fixture-free (SKIP when absent)
   ══════════════════════════════════════════════════════════════════════ */

test('H1: GET /api/brain/direction/:slug answers on loopback (not 404)', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const out = dockerCurl(['-s', '-m', '8', '-o', '/dev/null', '-w', '%{http_code}',
    `${CONTAINER_BASE}/api/brain/direction/hand-work-to-the-engineering-team-without-arming-a-book`]);
  assert(out.trim() !== '404',
    'GET /api/brain/direction/:slug is not registered — the endpoint 404s on loopback (ADR d1).');
});

test('H2: the direction endpoint is gated host-side (403), matching the other brain reads', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = await fetch(`${HOST_BASE}/api/brain/direction/hand-work-to-the-engineering-team-without-arming-a-book`, {
    signal: AbortSignal.timeout(5000),
  });
  assert(r.status === 403,
    `brain reads are owner/loopback-gated — expected 403 from the host (proxy header ⇒ localTrusted false); got ${r.status}.`);
});

test('H3: a nonexistent slug refuses `goal-not-found` over the wire', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackGetJson('/api/brain/direction/no-such-goal-harness-probe');
  assert(r && r.success === false, `expected a refusal envelope; got ${short(r)}`);
  assert(r.refusal === 'goal-not-found', `expected refusal 'goal-not-found'; got ${short(r)}`);
});

test('H4: a real un-ratified goal refuses `no-anchor-in-range` and names what it walked', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackGetJson('/api/brain/direction/hand-work-to-the-engineering-team-without-arming-a-book');
  assert(r && typeof r === 'object', `expected JSON; got ${short(r)}`);
  assert(r.eligible !== true || r.anchor,
    'an eligible answer must carry its anchor; an ineligible one must carry a refusal.');
  if (r.eligible === false) {
    assert(REFUSALS.includes(r.refusal), `refusal must be one of the named codes; got ${short(r.refusal)}`);
    const said = `${r.error || ''} ${short(r.detail, 400)} ${JSON.stringify(r.chain || [])}`;
    assert(said.includes('hand-work-to-the-engineering-team'),
      `AC3: the refusal must report the goal it walked; got ${short(said, 400)}`);
  }
});

test('H5: an eligible answer carries terms, surrendered and unavailable; an ineligible one still carries no invented estimate', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackGetJson('/api/brain/direction/hand-work-to-the-engineering-team-without-arming-a-book');
  if (r.eligible === true) {
    assert(r.terms && r.terms.ask && r.terms.successCriteria && r.terms.ceiling,
      `AC2: an eligible answer must carry ask/successCriteria/ceiling; got ${short(r.terms)}`);
    assert(Array.isArray(r.surrendered) && Array.isArray(r.unavailable),
      'AC2: surrendered and unavailable must be returned as data so the artifacts cannot silently omit them.');
    assert(r.terms.estimateSource === 'goal' || r.terms.estimateSource === 'absent',
      `estimateSource must be 'goal' or 'absent', never missing; got ${short(r.terms.estimateSource)}`);
  } else {
    assert(!r.terms || r.terms.estimate === null || typeof r.terms.estimate === 'number',
      'an estimate must never be invented.');
  }
});

test('H6: the direction read WRITES NOTHING — the goal element count is unchanged across the call', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const before = goalElementCount();
  loopbackGetJson('/api/brain/direction/hand-work-to-the-engineering-team-without-arming-a-book');
  loopbackGetJson('/api/brain/direction/no-such-goal-harness-probe');
  const after = goalElementCount();
  assert(after === before,
    `the direction endpoint is read-only (ADR d1) — goal element count moved ${before} → ${after}.`);
});

test('H7 (0002 d11): the endpoint accepts a `verdicts` parameter without changing the v1 answer', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const slug = 'hand-work-to-the-engineering-team-without-arming-a-book';
  const plain = loopbackGetJson(`/api/brain/direction/${slug}`);
  const withV = loopbackGetJson(`/api/brain/direction/${slug}?verdicts=narrows,narrows`);
  assert(plain.refusal === withV.refusal && plain.eligible === withV.eligible,
    `at the v1 policy distance there are zero boundary steps, so supplying verdicts must not change the answer (the parameter is inert until the policy parameter is raised). plain=${short(plain.refusal)} withVerdicts=${short(withV.refusal)}`);
});

test('H8 (0002 d6): the response reports which policy value was actually in force', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackGetJson('/api/brain/direction/hand-work-to-the-engineering-team-without-arming-a-book');
  assert(typeof r.maxAnchorDistance === 'number',
    `ADR 0002 d6: maxAnchorDistance is contractual — a run's artifacts must record which policy value was in force, since it is the one goalpost read from the environment rather than the goal. Got ${short(r.maxAnchorDistance)}`);
});

/* ══════════════════════════════════════════════════════════════════════
   R-class — regression sentinels (pass BEFORE and after)
   ══════════════════════════════════════════════════════════════════════ */

test('R1 (AC1): all six stopping rules survive in director.md', () => {
  const src = safeRead(DIRECTOR_ROLE);
  for (const needle of ['Deadline', 'consecutive KICK_BACK', 'ADR amendment', 'story count', 'Ceiling breach', 'External interference']) {
    assert(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(src),
      `AC1: armed-mode rule '${needle}' must not be removed or weakened by this story.`);
  }
});

test('R2 (AC1): the ceiling and the binding KICK_BACK are unweakened', () => {
  const src = safeRead(DIRECTOR_ROLE);
  assert(/cycle-prod/.test(src) && /cycle-full/.test(src),
    'AC1: the ceiling must still forbid /cycle-prod and /cycle-full.');
  assert(/KICK_BACK is binding|Binding, no exceptions/i.test(src),
    'AC1: a judge KICK_BACK must remain binding, with no exceptions.');
  assert(/Ratify your own completion|never ratifies|owner|operator/i.test(src),
    'AC1: completion ratification must remain reserved to the operator.');
});

test('R3 (AC5): the five phase workflows are untouched by mode text', () => {
  const dir = path.join(ROOT, 'engineering-team/workflows');
  const phases = ['1-planning.md', '2-architecture.md', '3-test-design.md', '4-implementation.md', '5-review.md'];
  for (const f of phases) {
    const src = safeRead(path.join(dir, f));
    assert(src, `workflows/${f} is unreadable.`);
    assert(!/operational direction/i.test(src),
      `AC5 + story scope: the five engineering phases do not change — workflows/${f} must not mention operational direction.`);
  }
});

test('R4 (AC5): gate-judge.md keeps its blinding contract', () => {
  const src = safeRead(GATE_JUDGE);
  assert(src, '.claude/agents/gate-judge.md is unreadable.');
  assert(/APPROVE/.test(src) && /KICK_BACK/.test(src),
    'the judge must still return APPROVE / KICK_BACK.');
  assert(!/operational direction/i.test(src),
    'story scope: gate-judge.md does not change beyond what naming the second mode requires — it should not need mode text at all.');
});

test('R5: CLAUDE.md stays within its declared line budget — the doctrine change must be line-neutral', () => {
  const budgets = safeRead(BUDGETS);
  const row = (budgets.split('\n').find((l) => l.startsWith('CLAUDE.md'))) || '';
  const cap = Number((row.split(/\s+/)[1] || '0').trim());
  assert(cap > 0, `could not read CLAUDE.md's cap from scripts/harness-budgets.txt; got: ${short(row)}`);
  // Count exactly as harness-lint L11 does (`wc -l` = newline count), so this
  // sentinel and the lint agree; split('\n') would over-count by one on a
  // trailing newline and fail forever regardless of the implementation.
  const body = safeRead(CLAUDE_MD);
  const lines = body.split('\n').length - (body.endsWith('\n') ? 1 : 0);
  assert(lines <= cap,
    `CLAUDE.md is ${lines} lines against a cap of ${cap} — ADR d7 requires the doctrine sentence to be REWRITTEN in place, not added to (raising a cap is a separate, ratified harness-definition change).`);
});

test('R6: the armed mode still has a book to run — the pre-registered template section survives', () => {
  const src = safeRead(BOOK_TEMPLATE);
  assert(/Direction mode \(experiment\)/.test(src),
    'AC1: adding the operational section must not remove the pre-registered one.');
  assert(/Armed/.test(src) && /Deadline/.test(src),
    'AC1: the armed section must keep its Armed/Deadline fields — the skill parses them.');
});

/* ══════════════════════════════════════════════════════════════════════ */

async function run() {
  console.log('\n=== operational-direction (operational-direction #1) ===');
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
  console.log(`\noperational-direction: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
