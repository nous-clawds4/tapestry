/**
 * Story 6 (epic: second-brain) — The proposal loop: nominate one viable goal,
 * decide it on the spine.
 *
 * Story: engineering-team/stories/second-brain/6-the-proposal-loop.md
 * ADR:   engineering-team/decisions/second-brain/0006-the-proposal-loop.md
 *
 * Test classes (ADR "Test-class guidance", per test-hermeticity-ci/0001):
 *
 *   U-class (EXECUTED, stack-free, always gates CI) — the new pure proposals
 *     core (src/lib/brain/proposals.js): parseProposalRow's whitelisting shape
 *     (type/goal/whyNow/passedOver/proposalId/reason/summary/happenedOn), the
 *     group-by-goal helper, openProposals (a `proposed` with a matching decision
 *     by proposalId is excluded; one with none is open; newest-first), the
 *     proposalEntry projection (uniform summary across types), and the
 *     PROPOSAL_TYPES constant — all over SYNTHETIC records (no stack).
 *
 *   S-class (source assertions, stack-free) — the three new normalize write
 *     primitives (make-proposal → proposed; approve-proposal → approved;
 *     skip-proposal → skipped) with routes/gates/discriminated results/refusals
 *     (not-viable, already-open, runner-up-*, already-decided, reason-required);
 *     the append-only mint (nonce/random d-tag; NO regenerateJson on the proposal
 *     path); the self-bootstrap; the shared write mutex re-use; NO launch/egress;
 *     the queue read GET /api/brain/proposals; the goal-detail records[] gaining
 *     the proposal projection; the brain import surface re-pinned to EIGHT; the
 *     new Proposal-queue view (emphasis card, equal-weight Approve/Skip…, inline
 *     skip-reason disabled-until-non-empty, verbatim copy incl. the ratified
 *     approve string, no numeric score); the route + owner-gated nav entry;
 *     jargon-clean strings; and read-only/no-64-hex sentinels.
 *
 *   H-class (live local stack, per-test SKIP when unreachable) — the concept
 *     self-bootstraps on the first proposal; make-proposal round-trips onto the
 *     queue and the goal spine; the queue card carries no numeric score; refusals
 *     (not-viable, already-open, runner-up-*) write nothing; approve retires the
 *     proposal + adds an append-only `approved` spine entry (the `proposed` entry
 *     byte-unchanged) and launches nothing; a second decide is refused
 *     (already-decided); skip requires a reason then records `skipped`+reason; the
 *     goal-detail records[] MERGES proposal + work-record entries newest-first;
 *     hygiene stays green; host-side caller-classes.
 *
 *   R-class (regression sentinels, stack-free, pass before AND after).
 *
 * Pass-by-design sentinels (documented, story-2/3/4/5 review precedent) that pass
 * BEFORE the feature lands: S14, S15, H10, R1, R2 (invariants the story must not
 * break). The rest FAIL until the feature lands (the proposals core is missing,
 * the three routes 404, the concept is absent, the queue read 404s, the Proposal
 * view does not exist, the goal-detail records[] carries no proposal projection).
 * H tests SKIP when the stack is absent (CI's stack-free job).
 *
 * Fixture hygiene: the H rows create sentinel-named goals (a viable nominee, a
 * viable runner-up, a non-viable/captured goal) plus append-only proposal
 * elements (proposed/approved/skipped) and one work record (the merge proof).
 * run()'s finally tears them all down: strfry delete by d-tag first (goals'
 * deterministic d-tags computed via the real dtag core; proposals'/work records'
 * random d-tags captured from the create responses' uuids), then Neo4j
 * element+tags, then a value-scoped orphan-tag sweep (json CONTAINS the
 * 'harness-proposal-' sentinel), then a strfry count-0 verify. Pre-clean runs the
 * same routine best-effort. A teardown failure is a loud suite failure. The
 * Proposal CONCEPT, once bootstrapped, persists (only fixture ELEMENTS are torn
 * down); the suite is idempotent across runs (ensureProposalConcept no-ops when
 * present).
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PROPOSALS_CORE = path.join(ROOT, 'src/lib/brain/proposals.js');
const BRAIN_API = path.join(ROOT, 'src/api/brain/index.js');
const NORMALIZE_INDEX = path.join(ROOT, 'src/api/normalize/index.js');
const RELATIONSHIPS = path.join(ROOT, 'src/api/normalize/relationships.js');
const PROBE = path.join(ROOT, 'src/api/normalize/probe.js');
const AUTH = path.join(ROOT, 'src/middleware/auth.js');
const PROPOSALS_PAGE = path.join(ROOT, 'ui/src/pages/brain/Proposals.jsx');
const APP_JSX = path.join(ROOT, 'ui/src/App.jsx');
const LAYOUT_JSX = path.join(ROOT, 'ui/src/components/Layout.jsx');
const DTAG_CORE = path.join(ROOT, 'src/lib/dtag.js');

const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

// The Proposal concept (ADR 0006 d1) — runtime-created, TA-scoped.
const PROPOSAL_CONCEPT_SLUG = 'tapestry-proposal';
const PROPOSAL_CONCEPT_NAME = 'tapestry proposal';
const GOAL_CONCEPT_SLUG = 'tapestry-owner-goal';
const PROPOSAL_TYPES = ['proposed', 'approved', 'skipped'];

// Owner-facing copy that must appear VERBATIM (style/design guides; ADR d12/d13/d16).
const COPY_VIEW_TITLE = 'What next?';
const COPY_EMPTY = 'No proposal right now — the next one appears when there are viable goals to choose between.';
const COPY_CONSIDERED = 'considered instead';
const COPY_SKIP_PLACEHOLDER = 'why not this one, in a few words';
const COPY_SKIP_CONFIRM = 'Skipped — noted.';
const COPY_APPROVE_CONFIRM = "Approved — launch it when you're ready."; // ADR d16 — ratified 2026-07-24

// H fixtures — all sentinel-tagged so the Neo4j orphan sweep (json CONTAINS the
// sentinel) is the catch-all; every fixture's json carries it via slug/goal/
// whyNow/whyNot/reason (dashes, not the space-separated owner-facing labels).
const FIX_SENTINEL = 'harness-proposal-';
// A viable NOMINEE — a leaf with both a deliverable and a boundary (standing 'viable').
const FIX_NOMINEE_NAME = 'harness proposal nominee goal';
const FIX_NOMINEE_SLUG = 'harness-proposal-nominee';
const FIX_NOMINEE_JSON = { tapestryOwnerGoal: {
  name: FIX_NOMINEE_NAME, slug: FIX_NOMINEE_SLUG,
  description: 'a harness-proposal viable nominee goal',
  deliverable: 'a harness-proposal nominee deliverable line', boundary: 'stays inside the harness-proposal fixtures',
  origin: 'harness test, in conversation', capturedOn: '2026-07-24',
} };
// A viable RUNNER-UP — also a leaf with a deliverable and a boundary.
const FIX_RUNNER_NAME = 'harness proposal runner goal';
const FIX_RUNNER_SLUG = 'harness-proposal-runner';
const FIX_RUNNER_JSON = { tapestryOwnerGoal: {
  name: FIX_RUNNER_NAME, slug: FIX_RUNNER_SLUG,
  description: 'a harness-proposal viable runner-up goal',
  deliverable: 'a harness-proposal runner deliverable line', boundary: 'stays inside the harness-proposal fixtures',
  origin: 'harness test, in conversation', capturedOn: '2026-07-24',
} };
// A NON-VIABLE (captured) goal — a leaf missing a deliverable/boundary (standing 'captured').
const FIX_CAPTURED_NAME = 'harness proposal captured goal';
const FIX_CAPTURED_SLUG = 'harness-proposal-captured';
const FIX_CAPTURED_JSON = { tapestryOwnerGoal: {
  name: FIX_CAPTURED_NAME, slug: FIX_CAPTURED_SLUG,
  description: 'a harness-proposal non-viable (captured) goal, no deliverable/boundary',
  origin: 'harness test, in conversation', capturedOn: '2026-07-24',
} };
const FIX_WHYNOW = 'harness-proposal why-now: the smallest viable piece, and it unblocks its sibling';
const FIX_WHYNOT = 'harness-proposal runner-up — bigger; no session has scoped it yet';
const FIX_SKIP_REASON = 'harness-proposal skip reason: the launch date is not set yet';
const FIX_WORK_SESSION = 'harness proposal merge session';
const FIX_WORK_SUMMARY = 'harness-proposal work record for the merge proof';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function short(x, n = 260) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}

function loadProposalsCore() {
  if (!fs.existsSync(PROPOSALS_CORE)) {
    throw new Error('src/lib/brain/proposals.js does not exist yet — the proposals core (ADR 0006 d10) is not implemented.');
  }
  try { return require(PROPOSALS_CORE); }
  catch (e) { throw new Error(`src/lib/brain/proposals.js failed to require: ${e.message}`); }
}
const CORE_MISSING_FN = (fn) =>
  `src/lib/brain/proposals.js does not export ${fn}() yet — the proposals core (ADR 0006 d10) is not implemented.`;

// The real d-tag core — deterministic fixture d-tags for goal teardown (proposals
// use random d-tags captured from responses). Loaded lazily (stack-free runs skip it).
let _dtag = null;
function dtagCore() { if (_dtag) return _dtag; _dtag = require(DTAG_CORE); return _dtag; }

/* ── synthetic fixtures (U-class) ─────────────────────────────────────── */

const TA = 'synthetic-ta'; // handles are opaque strings to the core — no hex needed
function core39999(slug) { return `39999:${TA}:${slug}`; }

// A parsed proposal record in the ADR 0006 d1 shape (parseProposalRow out).
function prop(over = {}) {
  return {
    uuid: core39999('harness-proposal-fixture'),
    name: 'proposed: some goal',
    slug: 'proposed-some-goal-abcd1234',
    summary: 'why now',
    type: 'proposed',
    goal: 'some-goal',
    whyNow: 'why now',
    passedOver: [],
    proposalId: null,
    reason: null,
    happenedOn: '2026-07-24',
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

function getGoals() {
  const r = loopbackGetJson('/api/brain/goals');
  assert(r && r.success === true && Array.isArray(r.goals),
    `GET /api/brain/goals must answer {success:true, goals:[…]} (got ${short(r)}).`);
  return r.goals;
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

/* ── H fixture bookkeeping ─────────────────────────────────────────────── */

let fixturesArmed = false;
let teardownFailure = null;
const createdProposalUuids = [];   // random-d-tag proposal elements — captured from responses
const createdWorkRecordUuids = []; // the merge-proof work record — captured from response
const createdGoalNames = [];       // fixture goals — d-tags derived via dtag

function dTagFromUuid(uuid) { return String(uuid).split(':').slice(2).join(':'); }
function goalHeaderUuid() { return `39998:${getTaPubkey()}:${GOAL_CONCEPT_SLUG}`; }
function goalDtag(name) { return dtagCore().childDTag(name, goalHeaderUuid()); }
function allFixtureDtags() {
  const goalDtags = createdGoalNames.map((n) => goalDtag(n));
  const elemDtags = [...createdProposalUuids, ...createdWorkRecordUuids].map(dTagFromUuid);
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
// Arm the three goal fixtures (nominee, runner-up, captured) once per run.
function armGoalFixtures() {
  fixturesArmed = true;
  preCleanFixtures();
  armGoal(FIX_NOMINEE_NAME, FIX_NOMINEE_JSON);
  armGoal(FIX_RUNNER_NAME, FIX_RUNNER_JSON);
  armGoal(FIX_CAPTURED_NAME, FIX_CAPTURED_JSON);
}
function makeProposal(body) {
  const r = loopbackPostJson('/api/normalize/make-proposal', body);
  if (r && r.success === true && r.proposal && r.proposal.uuid) createdProposalUuids.push(r.proposal.uuid);
  return r;
}
function approveProposal(body) {
  const r = loopbackPostJson('/api/normalize/approve-proposal', body);
  if (r && r.success === true && r.decision && r.decision.uuid) createdProposalUuids.push(r.decision.uuid);
  return r;
}
function skipProposal(body) {
  const r = loopbackPostJson('/api/normalize/skip-proposal', body);
  if (r && r.success === true && r.decision && r.decision.uuid) createdProposalUuids.push(r.decision.uuid);
  return r;
}
function recordWork(body) {
  const r = loopbackPostJson('/api/normalize/create-work-record', body);
  if (r && r.success === true && r.record && r.record.uuid) createdWorkRecordUuids.push(r.record.uuid);
  return r;
}

// Cross-test state: the open proposals made by the H rows.
let proposedNomineeSlug = null; // H1's proposal on the nominee (approved in H6)
let proposedRunnerSlug = null;  // H8's proposal on the runner-up (skipped in H8)

/* ══════════════ U-class — the pure proposals core (EXECUTED) ══════════════ */

test('U1 (contract): proposals core exports parseProposalRow, a group-by-goal helper, openProposals, a proposalEntry projection, and PROPOSAL_TYPES', () => {
  const core = loadProposalsCore();
  assert(typeof core.parseProposalRow === 'function', CORE_MISSING_FN('parseProposalRow'));
  const grouper = core.groupProposalsByGoal || core.groupByGoal;
  assert(typeof grouper === 'function', 'proposals core must export a group-by-goal helper (groupProposalsByGoal) — ADR 0006 d10.');
  assert(typeof core.openProposals === 'function',
    'proposals core must export openProposals(records) — the open-derivation (ADR 0006 d10/d11).');
  const projector = core.proposalEntry || core.projectProposal;
  assert(typeof projector === 'function',
    'proposals core must export a proposalEntry(record) projection → {date,type,summary} (ADR 0006 d10).');
  const types = core.PROPOSAL_TYPES;
  assert(Array.isArray(types) && PROPOSAL_TYPES.every((t) => types.includes(t)),
    `PROPOSAL_TYPES must include ${PROPOSAL_TYPES.join('/')} (ADR 0006 d2); got ${short(types)}.`);
});

test('U2 (AC1/AC4/AC5): parseProposalRow extracts type/goal/whyNow/passedOver/proposalId/reason/summary/happenedOn; non-proposal/malformed → null', () => {
  const core = loadProposalsCore();
  const proposed = core.parseProposalRow({
    uuid: core39999('harness-proposal-x'), name: 'proposed: the big goal', createdAt: 1784000001,
    json: JSON.stringify({ proposal: {
      name: 'proposed: the big goal', slug: 'proposed-the-big-goal-abcd1234', description: 'why now text',
      summary: 'why now text', type: 'proposed', goal: 'the-big-goal', whyNow: 'why now text',
      passedOver: [{ goal: 'runner-a', whyNot: 'bigger' }, { goal: 'runner-b', whyNot: 'routine' }],
      happenedOn: '2026-07-24',
    } }),
  });
  assert(proposed, 'parseProposalRow must return a record for a well-formed proposed row.');
  assert(proposed.type === 'proposed', `the type must be extracted; got ${short(proposed.type)}.`);
  assert(proposed.goal === 'the-big-goal',
    `the nominated goal slug must be extracted — record-based linkage (ADR 0006 d4); got ${short(proposed.goal)}.`);
  assert(proposed.whyNow === 'why now text', `the why-now must be extracted (AC1); got ${short(proposed.whyNow)}.`);
  assert(Array.isArray(proposed.passedOver) && proposed.passedOver.length === 2
    && proposed.passedOver[0].goal === 'runner-a' && proposed.passedOver[0].whyNot === 'bigger',
    `the passed-over runners-up (goal + why-not) must be extracted (AC1); got ${short(proposed.passedOver)}.`);
  assert(proposed.happenedOn === '2026-07-24', `the date must be extracted; got ${short(proposed.happenedOn)}.`);
  // A decision element carries proposalId + (skip) reason.
  const skipped = core.parseProposalRow({
    uuid: core39999('harness-proposal-d'), name: 'skipped: the big goal', createdAt: 1784000002,
    json: JSON.stringify({ proposal: {
      name: 'skipped: the big goal', slug: 'skipped-the-big-goal-ef567890', description: 'not now',
      summary: 'not now', type: 'skipped', goal: 'the-big-goal',
      proposalId: 'proposed-the-big-goal-abcd1234', reason: 'not now', happenedOn: '2026-07-25',
    } }),
  });
  assert(skipped && skipped.type === 'skipped' && skipped.proposalId === 'proposed-the-big-goal-abcd1234' && skipped.reason === 'not now',
    `a decision row must extract type/proposalId/reason (ADR 0006 d4); got ${short(skipped)}.`);
  // A goal row (wrong section) is not a proposal.
  const notProposal = core.parseProposalRow({
    uuid: core39999('g'), name: 'g', createdAt: 1, json: JSON.stringify({ tapestryOwnerGoal: { name: 'g', slug: 'g' } }),
  });
  assert(notProposal === null, 'a row without a proposal section must parse to null (never a phantom proposal).');
  const malformed = core.parseProposalRow({ uuid: core39999('m'), name: 'm', createdAt: 1, json: '{not json' });
  assert(malformed === null, 'malformed json must parse to null, never throw (event-tagging 0009 discipline).');
});

test('U3 (AC5 — open derivation): openProposals returns proposeds with NO matching decision; a decided proposal is excluded; newest-first', () => {
  const core = loadProposalsCore();
  const p1 = prop({ uuid: core39999('p1'), slug: 'proposed-goal-a-1111', goal: 'goal-a', happenedOn: '2026-07-20' });
  const p2 = prop({ uuid: core39999('p2'), slug: 'proposed-goal-b-2222', goal: 'goal-b', happenedOn: '2026-07-22' });
  const decisionForP1 = prop({
    uuid: core39999('d1'), slug: 'approved-goal-a-3333', type: 'approved', goal: 'goal-a',
    proposalId: 'proposed-goal-a-1111', whyNow: undefined, happenedOn: '2026-07-21',
  });
  const open = core.openProposals([p1, p2, decisionForP1]);
  const openSlugs = open.map((r) => r.slug);
  assert(!openSlugs.includes('proposed-goal-a-1111'),
    'a proposed with a matching approved/skipped (by proposalId) must be EXCLUDED from open (ADR 0006 d10/d11).');
  assert(openSlugs.includes('proposed-goal-b-2222'),
    'a proposed with no decision must be OPEN (ADR 0006 d10/d11).');
  assert(open.every((r) => r.type === 'proposed'),
    'openProposals must return only `proposed` elements, never decisions.');
  // A second open proposal, older, must sort after the newer one.
  const p3 = prop({ uuid: core39999('p3'), slug: 'proposed-goal-c-4444', goal: 'goal-c', happenedOn: '2026-07-18' });
  const openSorted = core.openProposals([p3, p2]);
  assert(openSorted[0].slug === 'proposed-goal-b-2222',
    `open proposals must sort newest-happenedOn first (ADR 0006 d11); got ${short(openSorted.map((r) => r.happenedOn))}.`);
});

test('U4 (AC5 — spine projection): proposalEntry projects {date,type,summary} uniformly across proposed/approved/skipped', () => {
  const core = loadProposalsCore();
  const projector = core.proposalEntry || core.projectProposal;
  const eProposed = projector(prop({ type: 'proposed', summary: 'why now', happenedOn: '2026-07-24' }));
  assert(eProposed && eProposed.date === '2026-07-24' && eProposed.type === 'proposed' && eProposed.summary === 'why now',
    `proposalEntry(proposed) must be {date,type,summary} (ADR 0006 d10); got ${short(eProposed)}.`);
  const eSkipped = projector(prop({ type: 'skipped', summary: 'not now', reason: 'not now', proposalId: 'x', happenedOn: '2026-07-25' }));
  assert(eSkipped && eSkipped.type === 'skipped' && eSkipped.summary === 'not now',
    `proposalEntry(skipped) must carry the reason as its summary (ADR 0006 d7/d10); got ${short(eSkipped)}.`);
});

test('U5 (AC5): the group-by-goal helper buckets proposal facts by their goal slug', () => {
  const core = loadProposalsCore();
  const grouper = core.groupProposalsByGoal || core.groupByGoal;
  const a1 = prop({ uuid: core39999('a1'), goal: 'goal-a', type: 'proposed' });
  const a2 = prop({ uuid: core39999('a2'), goal: 'goal-a', type: 'approved', proposalId: 'x' });
  const b1 = prop({ uuid: core39999('b1'), goal: 'goal-b', type: 'proposed' });
  const out = grouper([a1, a2, b1]);
  const forA = out instanceof Map ? out.get('goal-a') : out['goal-a'];
  assert(Array.isArray(forA) && forA.length === 2, `goal-a must bucket its two proposal facts (got ${short(forA)}).`);
  const forB = out instanceof Map ? out.get('goal-b') : out['goal-b'];
  assert(Array.isArray(forB) && forB.length === 1, `goal-b must bucket its one proposal fact (got ${short(forB)}).`);
});

/* ══════════════ S-class — source assertions (stack-free) ══════════════ */

test('S1 (ADR d6): make-proposal — route, gate, discriminated result/refusals incl. not-viable + already-open + runner-up-*', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/\/api\/normalize\/make-proposal/.test(src),
    'POST /api/normalize/make-proposal is not registered (ADR 0006 d6) — not implemented yet.');
  const start = src.indexOf('handleMakeProposal');
  assert(start !== -1, 'handleMakeProposal not found in src/api/normalize/index.js.');
  const slice = src.slice(start, start + 14000);
  assert(/isOwner\s*\(\s*req\s*\)/.test(slice) && /localTrusted/.test(slice) && /403/.test(slice),
    'make-proposal must carry the explicit in-handler gate (isOwner(req) || req.localTrusted → 403) — ADR 0006 d6.');
  for (const tok of ['proposed', 'not-viable', 'already-open']) {
    assert(src.includes(tok),
      `make-proposal must answer the named discriminated result/refusal '${tok}' (ADR 0006 d6) — loud, named, nothing written.`);
  }
  assert(/runner-up-/.test(src),
    'make-proposal must carry the runner-up refusals (runner-up-not-viable / runner-up-is-nominee / …) — ADR 0006 d6.');
});

test('S2 (ADR d7): approve-proposal + skip-proposal — routes, gates, results (approved/skipped), reason-required, already-decided, and NO launch/egress', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/\/api\/normalize\/approve-proposal/.test(src) && /\/api\/normalize\/skip-proposal/.test(src),
    'POST /api/normalize/approve-proposal and /skip-proposal must be registered (ADR 0006 d7) — not implemented yet.');
  for (const handler of ['handleApproveProposal', 'handleSkipProposal']) {
    const start = src.indexOf(handler);
    assert(start !== -1, `${handler} not found in src/api/normalize/index.js (ADR 0006 d7).`);
    const slice = src.slice(start, start + 8000);
    assert(/isOwner\s*\(\s*req\s*\)/.test(slice) && /localTrusted/.test(slice) && /403/.test(slice),
      `${handler} must carry the explicit in-handler gate — ADR 0006 d7.`);
  }
  for (const tok of ['approved', 'skipped', 'already-decided', 'reason-required', 'proposal-not-found']) {
    assert(src.includes(tok),
      `the decision path must answer the named result/refusal '${tok}' (ADR 0006 d7).`);
  }
  // Approve/skip record facts only — sessions propose, never launch (§7.3): the
  // decideProposal core must NOT spawn/enqueue/schedule/launch/fetch.
  const dstart = src.indexOf('function decideProposal');
  const dslice = dstart !== -1 ? src.slice(dstart, dstart + 8000) : src.slice(src.indexOf('handleApproveProposal'), src.indexOf('handleApproveProposal') + 12000);
  assert(!/\bfetch\s*\(|https?\.get\s*\(|https?\.request\s*\(|publishEverywhere|spawn\s*\(|\.enqueue\s*\(|scheduler|launch(Session|Task|Job)/i.test(dslice),
    'approve/skip must launch NOTHING (PRD §7.3 / AC3) — no fetch/spawn/enqueue/scheduler/launch call in the decision core.');
});

test('S3 (ADR d8): the Proposal concept self-bootstraps — ensureProposalConcept via create-concept + save-schema, guarded', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/ensureProposalConcept/.test(src),
    'ensureProposalConcept (the self-bootstrap helper, ADR 0006 d8) does not exist yet.');
  const start = src.indexOf('ensureProposalConcept');
  const slice = src.slice(start, start + 4000);
  assert(/create-concept|createConcept|handleCreateConcept/.test(slice) && /save-schema|saveSchema|handleSaveSchema/.test(slice),
    'ensureProposalConcept must provision via create-concept + save-schema when the concept is absent (ADR 0006 d8).');
  assert(src.includes(PROPOSAL_CONCEPT_SLUG) || src.includes(PROPOSAL_CONCEPT_NAME),
    `the write path must reference the Proposal concept (${PROPOSAL_CONCEPT_SLUG}) — ADR 0006 d1/d8.`);
});

test('S4 (ADR d9): all three new writes run through the existing serializeGoalWrite mutex (not renamed)', () => {
  const src = safeRead(NORMALIZE_INDEX);
  assert(/serializeGoalWrite/.test(src),
    'serializeGoalWrite must survive (story-3 S5 / story-4 S4 / story-5 pins) — ADR 0006 d9 reuses it, never renames it.');
  for (const handler of ['handleMakeProposal', 'handleApproveProposal', 'handleSkipProposal']) {
    const start = src.indexOf(handler);
    if (start === -1) continue; // S1/S2 already fail loudly on a missing handler
    const slice = src.slice(start, start + 8000);
    assert(/serializeGoalWrite/.test(slice),
      `${handler} must run its read-validate-write body through the shared write mutex (ADR 0006 d9).`);
  }
});

test('S5 (ADR d3 — append-only by construction): the proposal write path uses a random/nonce d-tag and NEVER regenerateJsons', () => {
  const src = safeRead(NORMALIZE_INDEX);
  const fnBody = (name) => {
    const i = src.indexOf(`function ${name}`);
    if (i === -1) return '';
    const after = src.slice(i + 10);
    const next = after.search(/\n(?:async )?function /);
    return next === -1 ? src.slice(i) : src.slice(i, i + 10 + next);
  };
  const region = ['makeProposal', 'decideProposal', 'mintProposalElement'].map(fnBody).join('\n--\n');
  assert(/function makeProposal|function decideProposal|function mintProposalElement/.test(src),
    'the proposal write cores are not implemented yet (makeProposal / decideProposal / mintProposalElement) — ADR 0006 d3/d6/d7.');
  // A fresh element each write — a random d-tag or a 3-arg childDTag(base, header,
  // nonce), never a deterministic 2-arg natural-key d-tag that could MERGE over a
  // prior fact. (H6's byte-unchanged proof is the live check; this is the source pin.)
  assert(/randomDTag\s*\(|childDTag\s*\([^)]+,[^)]+,[^)]+\)/.test(region),
    'the proposal mint must use a random d-tag or a nonce\'d childDTag (ADR 0006 d3) — append-only by construction, ' +
    'so a decision can never MERGE over the proposal (nor a re-proposal over a prior one).');
  // A decision NEVER mutates the proposed element — the whole proposal path is
  // free of regenerateJson (the durable-intent path, not the append-only path).
  assert(!/regenerateJson\s*\(/.test(region),
    'the proposal write path must NEVER regenerateJson — proposals AND decisions are append-only, never re-signed ' +
    '(ADR 0006 d3; PRD §7.2). This is the load-bearing (a)/(b) decision: shape (b), append separate facts.');
});

test('S6 (ADR d11): GET /api/brain/proposals — route, gate, returns {proposals}', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(/\/api\/brain\/proposals/.test(src) && /handleGetProposals/.test(src),
    'the brain module must register GET /api/brain/proposals → handleGetProposals (ADR 0006 d11) — the queue read.');
  const start = src.indexOf('handleGetProposals');
  const slice = start !== -1 ? src.slice(start, start + 6000) : '';
  assert(/isOwner\s*\(\s*req\s*\)/.test(slice) && /localTrusted/.test(slice) && /403/.test(slice),
    'the queue read must carry the in-handler owner/loopback gate (403) — ADR 0006 d11.');
  assert(/proposals/.test(slice),
    'the queue read must return a {proposals:[…]} payload (ADR 0006 d11).');
});

test('S7 (ADR d10): the goal-detail projects the proposal facts into records[]; the brain requires the proposals core', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(/require\s*\(\s*['"`][^'"`]*lib\/brain\/proposals['"`]\s*\)/.test(src),
    'the brain module must require ../../lib/brain/proposals — the proposal projection core (ADR 0006 d10) is not wired yet.');
  const start = src.indexOf('handleGetGoalDetail');
  const slice = start !== -1 ? src.slice(start, start + 6000) : '';
  assert(/proposal/i.test(slice),
    'handleGetGoalDetail must MERGE the proposal projection into records[] (ADR 0006 d10) — the proposal facts must reach the spine.');
});

test('S8 (ADR d10): the brain import surface is re-pinned to EIGHT — the story-5 seven plus lib/brain/proposals, nothing else', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  const requires = [...src.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((m) => m[1]);
  assert(requires.some((s) => /lib\/brain\/proposals$/.test(s)),
    'the brain module must require ../../lib/brain/proposals — the proposals core (ADR 0006 d10) is not wired yet.');
  const allowed = [/neo4j-driver$/, /middleware\/auth$/, /assistantKeys$/, /lib\/brain\/goals$/, /lib\/brain\/hygiene$/, /lib\/brain\/resources$/, /lib\/brain\/work-records$/, /lib\/brain\/proposals$/];
  for (const spec of requires) {
    assert(allowed.some((re) => re.test(spec)),
      `import surface violation: require('${spec}') — story 6 adds exactly lib/brain/proposals; the brain module ` +
      'allows only the eight cores (ADR 0006 d10; the five sibling re-pins widen to eight).');
  }
});

test('S9 (ADR d12 / AC2/AC4): the Proposal-queue view renders the emphasis card, equal-weight Approve/Skip, and the inline skip-reason disabled until non-empty', () => {
  const src = safeRead(PROPOSALS_PAGE);
  assert(src, 'ui/src/pages/brain/Proposals.jsx does not exist yet — the Proposal-queue view (ADR 0006 d12) is not implemented.');
  assert(src.includes(COPY_VIEW_TITLE), `the view title must be "${COPY_VIEW_TITLE}" verbatim (wireframes §3; ADR 0006 d12).`);
  assert(/Next:/.test(src) && src.includes(COPY_CONSIDERED),
    `the card must render "Next: {goal}" and the "${COPY_CONSIDERED}" block (ADR 0006 d12).`);
  assert(/Approve/.test(src) && /Skip/.test(src),
    'the card must render equal-weight Approve and Skip… actions (AC2; ADR 0006 d12).');
  assert(src.includes(COPY_SKIP_PLACEHOLDER),
    `the inline skip field must carry the verbatim placeholder "${COPY_SKIP_PLACEHOLDER}" (AC4; style guide).`);
  // Skip is DISABLED until the reason is non-empty (AC4) — a disabled binding tied
  // to the reason's emptiness must exist.
  assert(/disabled=\{[^}]*(reason|trim)/i.test(src) || /disabled=\{\s*![^}]*reason/i.test(src),
    'the Skip control must be DISABLED until the reason is non-empty (AC4; ADR 0006 d12) — a disabled binding on the reason is missing.');
});

test('S10 (AC4/AC3/AC7): the verbatim confirmations + empty/error states appear in the Proposal view', () => {
  const src = safeRead(PROPOSALS_PAGE);
  assert(src, 'ui/src/pages/brain/Proposals.jsx does not exist yet (ADR 0006 d12).');
  assert(src.includes(COPY_SKIP_CONFIRM), `the skip confirmation "${COPY_SKIP_CONFIRM}" must appear verbatim (AC4; style guide).`);
  assert(src.includes(COPY_APPROVE_CONFIRM),
    `the ratified approve confirmation "${COPY_APPROVE_CONFIRM}" must appear verbatim (ADR 0006 d16; AC3).`);
  assert(src.includes(COPY_EMPTY), `the canonical empty state must appear verbatim (AC2; design guide).`);
  assert(/couldn't run|could not run/i.test(src) && /Nothing was decided for you/.test(src),
    'the canonical error state ("The proposer couldn\'t run — … Nothing was decided for you.") must appear (AC2; design guide).');
});

test('S11 (AC6): the Proposal view renders NO numeric score — no score/gauge/percentage/star affordance', () => {
  const src = safeRead(PROPOSALS_PAGE);
  assert(src, 'ui/src/pages/brain/Proposals.jsx does not exist yet (ADR 0006 d12).');
  // No score-rendering token: a `score`/`rank` value shown, a percentage, a star
  // rating, or a gauge. Comparisons and words only (design principle 2; AC6).
  assert(!/\bscore\b|\brank\b|\bpercent|\bgauge\b|★|⭐|toFixed\s*\(/i.test(src),
    'the Proposal view must show NO numeric score/rank/percentage/gauge/star (AC6; design principle 2) — comparisons and words only.');
});

test('S12 (ADR d12 / AC2): the Proposal-queue route + owner-gated nav entry are registered', () => {
  const app = safeRead(APP_JSX);
  assert(app, 'ui/src/App.jsx missing — regression.');
  assert(/path:\s*['"`]proposals['"`]/.test(app) && /Proposals/.test(app),
    'ui/src/App.jsx must register the `proposals` route under /tapestry with the <Proposals /> element (ADR 0006 d12).');
  const layout = safeRead(LAYOUT_JSX);
  assert(layout, 'ui/src/components/Layout.jsx missing — regression.');
  assert(/tapestry\/proposals/.test(layout) && /ownerOnly:\s*true/.test(layout),
    'ui/src/components/Layout.jsx must add an OWNER-GATED nav entry to /tapestry/proposals (ADR 0006 d12; AC2 — never visitor-facing).');
});

test('S13 (AC7): the Proposal view carries no banned jargon and no exclamation marks', () => {
  const src = safeRead(PROPOSALS_PAGE);
  assert(src, 'ui/src/pages/brain/Proposals.jsx does not exist yet (ADR 0006 d12).');
  const visible = [
    ...[...src.matchAll(/'([^'\\\n]*)'/g)].map((m) => m[1]),
    ...[...src.matchAll(/"([^"\\\n]*)"/g)].map((m) => m[1]),
    ...[...src.matchAll(/`([^`]*)`/g)].map((m) => m[1]),
    ...[...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]),
  ].join('\n');
  for (const w of ['element', 'kind', 'schema', 'pubkey', 'superset', 'concept header', 'persona', 'acceptance criteria', 'lease', 'payload', 'endpoint']) {
    assert(!new RegExp(`\\b${w}\\b`, 'i').test(visible),
      `banned jargon "${w}" found in owner-visible text of Proposals.jsx (style guide; AC7).`);
  }
  // No exclamation marks in owner-facing copy (style guide). "What next?" and the
  // canonical strings carry none; a stray "!" in JSX text is a defect.
  const jsxText = [...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]).join('\n');
  assert(!/!/.test(jsxText.replace(/[<>]/g, '')),
    'no exclamation marks in owner-facing copy (style guide; AC7).');
});

test('S14 (sentinel — ADR d10): the brain module stays structurally read-only — no mutation/strfry tokens', () => {
  const src = safeRead(BRAIN_API);
  assert(src, 'src/api/brain/index.js missing — story 1 regression.');
  assert(!/child_process|execFile|exec\s*\(|strfry|publishToStrfry|regenerateJson|nostrPublish|signAndFinalize/.test(src),
    'the brain module must stay mutation- and strfry-free — proposal WRITES live in normalize (ADR 0006 d10 / story-2 S6 / story-5 S13).');
});

test('S15 (sentinel — house rule): no hardcoded 64-hex pubkey in the story\'s touched server files', () => {
  for (const f of [PROPOSALS_CORE, BRAIN_API, NORMALIZE_INDEX]) {
    const src = safeRead(f);
    if (!src && f === PROPOSALS_CORE) continue; // the core does not exist pre-impl; U1 fails loudly for that
    assert(src, `${path.relative(ROOT, f)} missing.`);
    assert(!/\b[0-9a-f]{64}\b/i.test(src),
      `${path.relative(ROOT, f)} contains a 64-hex literal — the TA pubkey is per-deployment and must be resolved ` +
      'at runtime (house rule; PRD §7.8).');
  }
});

/* ══════════════ H-class — live local stack (SKIP when absent) ══════════════ */

test('H1 (ADR d6/d8 / AC1): make-proposal self-bootstraps the concept; the proposal reads back on the queue AND the goal spine', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  armGoalFixtures();
  const r = makeProposal({ goal: FIX_NOMINEE_SLUG, whyNow: FIX_WHYNOW, passedOver: [{ goal: FIX_RUNNER_SLUG, whyNot: FIX_WHYNOT }] });
  assert(r && r.success === true && r.result === 'proposed',
    `make-proposal must answer {success:true, result:'proposed', …} for a viable nominee (got ${short(r, 400)}).`);
  assert(r.proposal && r.proposal.slug && r.proposal.uuid,
    `the response must carry the proposal's slug (the proposalId) + uuid (for durability/teardown; ADR 0006 d6, the create-work-record precedent). Got ${short(r.proposal)}.`);
  proposedNomineeSlug = r.proposal.slug;
  // The concept must now exist live — self-bootstrapped, never firmware-seeded.
  const ta = getTaPubkey();
  const node = loopbackGetJson(`/api/concept-graph/node/${encodeURIComponent(`39998:${ta}:${PROPOSAL_CONCEPT_SLUG}`)}`);
  assert(node && node.success !== false && node.node,
    `the Proposal concept (39998:<TA>:${PROPOSAL_CONCEPT_SLUG}) must exist after the first proposal — ` +
    `ensureProposalConcept did not provision it (ADR 0006 d8). Got ${short(node, 300)}.`);
  // …and it appears as an OPEN card in the queue (AC2 data surface).
  const q = getProposals();
  assert(q && q.success === true && Array.isArray(q.proposals),
    `GET /api/brain/proposals must answer {success:true, proposals:[…]} (got ${short(q, 300)}).`);
  const card = q.proposals.find((p) => p.goal === FIX_NOMINEE_SLUG);
  assert(card, `the open proposal must appear in the queue for its nominee (AC2; got ${short(q.proposals, 300)}).`);
  assert(card.whyNow === FIX_WHYNOW, `the card must carry the why-now verbatim (AC1); got ${short(card.whyNow)}.`);
  assert(Array.isArray(card.passedOver) && card.passedOver.some((x) => x.goal === FIX_RUNNER_SLUG && x.whyNot === FIX_WHYNOT),
    `the card must name the passed-over runner-up with its why-not (AC1); got ${short(card.passedOver, 300)}.`);
  // …and it appears on the nominee's goal spine as a `proposed` entry (AC5, one spine).
  const detail = getGoalDetail(FIX_NOMINEE_SLUG);
  const entry = (detail.records || []).find((e) => e.type === 'proposed');
  assert(entry, `the making of a proposal must appear on the nominee's spine as a 'proposed' entry (AC5; got ${short(detail.records, 300)}).`);
});

test('H2 (AC6): the queue card carries NO numeric score field — comparisons and words only', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const q = getProposals();
  const card = (q.proposals || []).find((p) => p.goal === FIX_NOMINEE_SLUG);
  assert(card, `H1's open proposal must still be in the queue (got ${short(q.proposals, 200)}).`);
  for (const k of Object.keys(card)) {
    assert(!/score|rank|percent/i.test(k),
      `the queue card must carry NO numeric score field (AC6; design principle 2) — found key '${k}'.`);
  }
  assert(!('score' in card) && !('rank' in card),
    'the queue card must not expose a numeric score/rank (AC6).');
});

test('H3 (AC1): make-proposal on a NON-VIABLE (captured) goal is refused not-viable, with NOTHING written', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackPostJson('/api/normalize/make-proposal', { goal: FIX_CAPTURED_SLUG, whyNow: FIX_WHYNOW });
  assert(r && r.success === false,
    `a proposal on a non-viable goal must be REFUSED (success:false) — only viable leaves are nominated (AC1; got ${short(r, 300)}).`);
  assert((typeof r.refusal === 'string' && /viable/i.test(r.refusal)) || (typeof r.error === 'string' && /viable/i.test(r.error)),
    `the refusal must be loud and named (not-viable); got ${short(r, 200)}.`);
  const q = getProposals();
  assert(!(q.proposals || []).some((p) => p.goal === FIX_CAPTURED_SLUG),
    'AC1 violated: a refused non-viable proposal must not appear in the queue.');
});

test('H4 (AC5): a SECOND proposal for a goal that already has an open one is refused already-open', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackPostJson('/api/normalize/make-proposal', {
    goal: FIX_NOMINEE_SLUG, whyNow: 'harness-proposal a second why-now', passedOver: [{ goal: FIX_RUNNER_SLUG, whyNot: FIX_WHYNOT }],
  });
  assert(r && r.success === false,
    `a second proposal for a goal with an open proposal must be REFUSED (one open per goal; ADR 0006 d6; got ${short(r, 300)}).`);
  assert((typeof r.refusal === 'string' && /open/i.test(r.refusal)) || (typeof r.error === 'string' && /open|already/i.test(r.error)),
    `the refusal must be loud and named (already-open); got ${short(r, 200)}.`);
});

test('H5 (AC1): runner-up refusals — a runner-up that is the nominee, or is non-viable, is refused with NOTHING written', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  // A runner-up equal to the nominee. (Use the still-open-able RUNNER goal as the
  // nominee so the refusal — not already-open — is exercised.)
  const isNominee = loopbackPostJson('/api/normalize/make-proposal', {
    goal: FIX_RUNNER_SLUG, whyNow: FIX_WHYNOW, passedOver: [{ goal: FIX_RUNNER_SLUG, whyNot: FIX_WHYNOT }],
  });
  assert(isNominee && isNominee.success === false && /runner-up|nominee|itself/i.test(isNominee.refusal || isNominee.error || ''),
    `a runner-up equal to the nominee must be REFUSED (runner-up-is-nominee; ADR 0006 d6; got ${short(isNominee, 300)}).`);
  // A non-viable runner-up.
  const badRunner = loopbackPostJson('/api/normalize/make-proposal', {
    goal: FIX_RUNNER_SLUG, whyNow: FIX_WHYNOW, passedOver: [{ goal: FIX_CAPTURED_SLUG, whyNot: FIX_WHYNOT }],
  });
  assert(badRunner && badRunner.success === false && /runner-up|viable/i.test(badRunner.refusal || badRunner.error || ''),
    `a non-viable runner-up must be REFUSED (runner-up-not-viable; ADR 0006 d6; got ${short(badRunner, 300)}).`);
  // Nothing written: the RUNNER goal still has no open proposal.
  const q = getProposals();
  assert(!(q.proposals || []).some((p) => p.goal === FIX_RUNNER_SLUG),
    'AC1 violated: a refused runner-up write left an open proposal on the nominee.');
});

test('H6 (AC3 — approve + append-only): approve retires the proposal, adds an `approved` spine entry, leaves the `proposed` entry byte-unchanged', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  assert(proposedNomineeSlug, 'H1 must have created the nominee proposal (proposalId) — H1 failed.');
  const before = recordSnapshot(FIX_NOMINEE_SLUG);
  const beforeCount = (getGoalDetail(FIX_NOMINEE_SLUG).records || []).length;
  const r = approveProposal({ proposalId: proposedNomineeSlug });
  assert(r && r.success === true && r.result === 'approved',
    `approve-proposal must answer {success:true, result:'approved', …} (got ${short(r, 400)}).`);
  // The proposal leaves the queue (open-derivation: a decision now references it).
  const q = getProposals();
  assert(!(q.proposals || []).some((p) => p.proposalId === proposedNomineeSlug || p.goal === FIX_NOMINEE_SLUG),
    'AC3: an approved proposal must leave the queue (got it still open).');
  // An `approved` entry appears on the nominee's spine, ADDED (append-only).
  const after = getGoalDetail(FIX_NOMINEE_SLUG);
  assert((after.records || []).some((e) => e.type === 'approved'),
    `AC3: the nominee's spine must show an 'approved' entry after approval (got ${short(after.records, 300)}).`);
  assert((after.records || []).length === beforeCount + 1,
    `append-only: approval must ADD exactly one entry (was ${beforeCount}, now ${(after.records || []).length}; PRD §7.2).`);
  // The prior `proposed` entry is byte-unchanged (nothing re-signed).
  const afterSnap = recordSnapshot(FIX_NOMINEE_SLUG);
  for (const line of before.split('\n').filter(Boolean)) {
    assert(afterSnap.includes(line),
      `append-only violated: a prior spine entry changed or vanished after the decision.\n  missing: ${line}`);
  }
});

test('H7 (AC5 — decided exactly once): a second decide of the same proposal is refused already-decided', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  assert(proposedNomineeSlug, 'H1 must have created the nominee proposal — H1 failed.');
  const r = loopbackPostJson('/api/normalize/approve-proposal', { proposalId: proposedNomineeSlug });
  assert(r && r.success === false && /decided|already/i.test(r.refusal || r.error || ''),
    `re-deciding an already-decided proposal must be REFUSED (already-decided; ADR 0006 d7; got ${short(r, 300)}).`);
  // …and a skip of the same proposal is equally refused (the guard is on the proposal, not the verb).
  const s = loopbackPostJson('/api/normalize/skip-proposal', { proposalId: proposedNomineeSlug, reason: FIX_SKIP_REASON });
  assert(s && s.success === false && /decided|already/i.test(s.refusal || s.error || ''),
    `skipping an already-approved proposal must be REFUSED (already-decided; got ${short(s, 300)}).`);
});

test('H8 (AC4 — skip requires a reason): empty reason refused; with a reason a `skipped` entry carries it and leaves the queue', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  // A fresh open proposal on the RUNNER goal (nominee is now decided).
  const mk = makeProposal({ goal: FIX_RUNNER_SLUG, whyNow: FIX_WHYNOW, passedOver: [{ goal: FIX_NOMINEE_SLUG, whyNot: FIX_WHYNOT }] });
  assert(mk && mk.success === true && mk.proposal && mk.proposal.slug,
    `a proposal on the runner goal must succeed for the skip test (got ${short(mk, 300)}).`);
  proposedRunnerSlug = mk.proposal.slug;
  // Empty reason → refused, nothing written.
  const empty = loopbackPostJson('/api/normalize/skip-proposal', { proposalId: proposedRunnerSlug, reason: '   ' });
  assert(empty && empty.success === false && /reason/i.test(empty.refusal || empty.error || ''),
    `a skip with an empty reason must be REFUSED (reason-required; AC4; got ${short(empty, 300)}).`);
  const stillOpen = getProposals();
  assert((stillOpen.proposals || []).some((p) => p.proposalId === proposedRunnerSlug),
    'AC4: a refused (empty-reason) skip must leave the proposal OPEN — nothing written.');
  // With a reason → skipped; the reason lands on the spine; it leaves the queue.
  const ok = skipProposal({ proposalId: proposedRunnerSlug, reason: FIX_SKIP_REASON });
  assert(ok && ok.success === true && ok.result === 'skipped',
    `skip-proposal with a reason must answer {success:true, result:'skipped', …} (got ${short(ok, 300)}).`);
  const detail = getGoalDetail(FIX_RUNNER_SLUG);
  const skippedEntry = (detail.records || []).find((e) => e.type === 'skipped');
  assert(skippedEntry, `the runner's spine must show a 'skipped' entry (AC4; got ${short(detail.records, 300)}).`);
  assert(typeof skippedEntry.summary === 'string' && skippedEntry.summary.includes(FIX_SKIP_REASON),
    `the 'skipped' entry must carry the skip reason (AC4); got ${short(skippedEntry.summary)}.`);
  const q = getProposals();
  assert(!(q.proposals || []).some((p) => p.proposalId === proposedRunnerSlug),
    'AC4: a skipped proposal must leave the queue.');
});

test('H9 (ADR d10 — merge): the goal-detail records[] merges proposal + work-record entries newest-first', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  // Add a work record on the nominee (which already has proposed + approved
  // proposal entries) — the three concepts land on ONE spine, sorted by date.
  const w = recordWork({ goal: FIX_NOMINEE_SLUG, session: FIX_WORK_SESSION, summary: FIX_WORK_SUMMARY });
  assert(w && w.success === true, `create-work-record on the nominee must succeed (got ${short(w, 300)}).`);
  const detail = getGoalDetail(FIX_NOMINEE_SLUG);
  const types = new Set((detail.records || []).map((e) => e.type));
  assert(types.has('worked') && types.has('proposed') && types.has('approved'),
    `the nominee's spine must MERGE work-record + proposal entries (worked + proposed + approved; ADR 0006 d10); got ${short([...types])}.`);
  // Newest-first: dates must be non-increasing down the list.
  const dates = (detail.records || []).map((e) => e.date || '');
  for (let i = 1; i < dates.length; i++) {
    assert(dates[i - 1] >= dates[i],
      `the merged records must be newest-date first (ADR 0006 d10); got out-of-order ${short(dates)}.`);
  }
});

test('H10 (sentinel — AC7): the hygiene check stays green — creating the Proposal concept does not disturb it', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r = loopbackGetJson('/api/brain/hygiene');
  assert(r && r.success === true && r.sound === true && Array.isArray(r.problems) && r.problems.length === 0,
    `the hygiene check must stay green (AC7; PRD §10) — the runtime-created Proposal concept is not in its scope. Got: ${short(r, 500)}.`);
});

test('H11 (gates): host-side calls to the new surfaces are refused by their caller-class — queue read 403, the three writes 401', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const g = await fetch(`${HOST_BASE}/api/brain/proposals`, { signal: AbortSignal.timeout(5000) });
  assert(g.status === 403,
    `an unauthenticated remote GET /api/brain/proposals must be 403'd by the in-handler gate (ADR 0006 d11). Got ${g.status}${g.status === 404 ? ' — route not registered yet' : ''}.`);
  for (const route of ['/api/normalize/make-proposal', '/api/normalize/approve-proposal', '/api/normalize/skip-proposal']) {
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

test('R1: the brain read surfaces this story extends are still registered (goals/detail/hygiene/orient)', () => {
  const src = safeRead(BRAIN_API);
  assert(/\/api\/brain\/goals/.test(src) && /\/api\/brain\/hygiene/.test(src) && /\/api\/brain\/orient/.test(src),
    'src/api/brain/index.js must keep the goals + hygiene + orient read routes (story 1/2/5 regression).');
});

test('R2: the byte-pinned untouchables and PUBLIC_MUTATIONS stay free of this story', () => {
  for (const f of [RELATIONSHIPS, PROBE]) {
    const src = safeRead(f);
    assert(src, `${path.relative(ROOT, f)} missing — relationship-primitives regression.`);
    assert(!/make-proposal|approve-proposal|skip-proposal|handleGetProposals|tapestry-proposal/.test(src),
      `${path.relative(ROOT, f)} must not be touched by this story (byte-pinned untouchable; ADR 0006).`);
  }
  const auth = safeRead(AUTH);
  assert(auth, 'src/middleware/auth.js missing — regression.');
  assert(!/make-proposal|approve-proposal|skip-proposal/.test(auth),
    'PUBLIC_MUTATIONS / the middleware must NOT special-case the proposal routes — they stay owner/loopback-gated (ADR 0006 d6/d7).');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- the-proposal-loop tests (epic second-brain, Story 6) ---');
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
  console.log(`\nthe-proposal-loop: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
