/**
 * Story 1 (epic: deploy-safety-gate) — Deploy-safety status endpoint.
 *
 * Story: engineering-team/stories/deploy-safety-gate/1-deploy-safety-status-endpoint.md
 * ADR:   engineering-team/decisions/deploy-safety-gate/0001-deploy-safety-status-endpoint.md
 *
 * Three test classes:
 *
 *   U-class (unit, stack-free) — the ADR's pure-core seam: the exported
 *     `computeVerdict()` from src/api/deploy-safety/index.js. Covers AC-3
 *     (phantom-running exclusion), AC-4 (verdict policy + buffer boundaries),
 *     AC-2's per-source verdict rules, AC-5's queue-disabled policy, and the
 *     fail-closed QUEUE_STATE_UNAVAILABLE rule. These run everywhere,
 *     including CI's stack-free job, and GATE the build.
 *
 *   S-class (structural, stack-free) — source sentinels in the
 *     generalized-task-scheduler T3/T4 precedent: the AC-3 anti-pattern guard
 *     (the module must never read the events.jsonl history that phantoms),
 *     the AC-2 two-source aggregation, route registration, the ratified
 *     10-minute default, and the new customer-schedule getInFlightCount()
 *     export. These also gate stack-free.
 *
 *   H-class (live HTTP, per-test SKIP when the stack is absent) — the AC-1
 *     payload contract against the real control panel at :7778, bufferMinutes
 *     validation/override, the AC-5 enabled-side response shape, and a live
 *     AC-2(a) observation (a genuinely running queue task flips the verdict).
 *     CI is stack-free: every H test SKIPs cleanly there.
 *
 * ALL U/S tests and (stack-present) H tests FAIL until the feature lands —
 * the module, the export, and the route do not exist yet. That is the point.
 *
 * Live-trigger policy (H6): the only task this suite ever enqueues is
 * `refreshApplicabilityLists` — registered in taskRegistry.json with NO
 * resourceClass (not neo4j-heavy), bounded (strfry scan + diff-guarded
 * publish, seconds), and never reconcileAll. The trigger fires ONLY after the
 * status endpoint has answered 200 (so the pre-implementation run enqueues
 * nothing), and non-observation of the active window SKIPs rather than fails
 * (racy-environment honesty; the Reviewer's manual verify is the backstop).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEPLOY_SAFETY = path.join(ROOT, 'src/api/deploy-safety/index.js');
const CUSTOMER_SCHEDULE = path.join(ROOT, 'src/api/customer-schedule/index.js');
const API_INDEX = path.join(ROOT, 'src/api/index.js');

const BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const STATUS_URL = `${BASE}/api/deploy-safety/status`;
const DEFAULT_BUFFER_MS = 10 * 60 * 1000; // the ratified default (story AC-4)
const REASON_CODES = [
  'QUEUE_TASK_RUNNING',
  'LEGACY_TASK_RUNNING',
  'NEXT_FIRE_WITHIN_BUFFER',
  'QUEUE_STATE_UNAVAILABLE',
];
// The benign live-trigger task for H6 — registry entry has no resourceClass.
const LIVE_TRIGGER_TASK = 'refreshApplicabilityLists';

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return null; }
}

/**
 * The feature's pure core. Throws a feature-missing error (not an opaque
 * MODULE_NOT_FOUND) when the module has not been implemented yet, so the
 * pre-implementation failure reads as "the feature is missing".
 */
function requireDeploySafety() {
  if (!fs.existsSync(DEPLOY_SAFETY)) {
    throw new Error(
      'src/api/deploy-safety/index.js does not exist yet — the deploy-safety ' +
      'module (ADR deploy-safety-gate/0001 Option A) is not implemented.'
    );
  }
  // Must be requireable stack-free: the route registers unconditionally
  // (outside the TASK_QUEUE_ENABLED gate) so module init cannot need Redis.
  return require(DEPLOY_SAFETY);
}

function getComputeVerdict() {
  const mod = requireDeploySafety();
  assert(
    typeof mod.computeVerdict === 'function',
    'src/api/deploy-safety/index.js does not export computeVerdict() — the ' +
    'pure verdict core (ADR §Implementation notes) is the unit seam AC-3/AC-4 ' +
    'tests stand on.'
  );
  return mod.computeVerdict;
}

/** Baseline "nothing running, nothing scheduled, queue healthy" input. */
function baseInput(overrides = {}) {
  return {
    now: Date.parse('2026-07-18T12:00:00.000Z'),
    bufferMs: DEFAULT_BUFFER_MS,
    queueEnabled: true,
    queueStateKnown: true,
    activeCount: 0,
    legacyInFlightCount: 0,
    nextFires: [],
    ...overrides,
  };
}

function fire(entryId, taskId, label, atMs) {
  return { entryId, taskId, label, at: new Date(atMs).toISOString() };
}

async function fetchStatus(query = '') {
  const r = await fetch(`${STATUS_URL}${query}`, { signal: AbortSignal.timeout(8000) });
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

async function controlPanelReachable() {
  try {
    const r = await fetch(`${BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ══════════════ U-class — computeVerdict pure-core units ══════════════ */

t('U1 (AC-3): a fabricated orphaned-TASK_START history is invisible — nothing actually running reads safe', () => {
  const computeVerdict = getComputeVerdict();
  // The signature a deploy-killed task leaves in events.jsonl: TASK_START,
  // no TASK_END, hours old. The gate's whole reason to exist is that this
  // record must NOT read as "running".
  const phantomHistory = [
    { eventType: 'TASK_START', taskName: 'updateAllScoresForOwner', timestamp: '2026-07-18T04:00:00.000Z', pid: 12345 },
    // no TASK_END — the phantom
  ];
  // Live state says nothing is executing. The phantom rides in on every
  // plausible key name; a computeVerdict that consults ANY history channel
  // would flip unsafe here.
  const result = computeVerdict(baseInput({
    events: phantomHistory,
    history: phantomHistory,
    sessions: [{ taskName: 'updateAllScoresForOwner', status: 'running' }],
  }));
  assert(result.verdict === 'safe',
    `verdict must be "safe": no covered task is actually executing; the orphaned ` +
    `TASK_START in the fabricated history is exactly the phantom-running trap ` +
    `AC-3 forbids (got verdict=${JSON.stringify(result.verdict)}).`);
  assert(result.safeToDeploy === true,
    'safeToDeploy must be true — the stale record must not be made a running signal.');
  assert(Array.isArray(result.reasons) && result.reasons.length === 0,
    `reasons must be empty when safe (got ${JSON.stringify(result.reasons)}).`);
});

t('U2 (AC-2a): an active queue job makes the verdict unsafe with QUEUE_TASK_RUNNING', () => {
  const computeVerdict = getComputeVerdict();
  const result = computeVerdict(baseInput({ activeCount: 1 }));
  assert(result.verdict === 'unsafe' && result.safeToDeploy === false,
    `one active queue job ⇒ unsafe (got verdict=${JSON.stringify(result.verdict)}, safeToDeploy=${result.safeToDeploy}).`);
  assert(result.reasons.includes('QUEUE_TASK_RUNNING'),
    `reasons must carry QUEUE_TASK_RUNNING (got ${JSON.stringify(result.reasons)}).`);
});

t('U3 (AC-2b): a legacy per-customer run in flight makes the verdict unsafe with LEGACY_TASK_RUNNING', () => {
  const computeVerdict = getComputeVerdict();
  const result = computeVerdict(baseInput({ legacyInFlightCount: 1 }));
  assert(result.verdict === 'unsafe' && result.safeToDeploy === false,
    `one legacy in-flight run ⇒ unsafe (got verdict=${JSON.stringify(result.verdict)}).`);
  assert(result.reasons.includes('LEGACY_TASK_RUNNING'),
    `reasons must carry LEGACY_TASK_RUNNING (got ${JSON.stringify(result.reasons)}).`);
});

t('U4 (AC-2): both sources running at once ⇒ unsafe with both reasons', () => {
  const computeVerdict = getComputeVerdict();
  const result = computeVerdict(baseInput({ activeCount: 2, legacyInFlightCount: 1 }));
  assert(result.verdict === 'unsafe', 'both sources running ⇒ unsafe.');
  assert(result.reasons.includes('QUEUE_TASK_RUNNING') && result.reasons.includes('LEGACY_TASK_RUNNING'),
    `reasons must carry both running codes (got ${JSON.stringify(result.reasons)}).`);
});

t('U5 (AC-4 boundary): next fire exactly AT the buffer edge (inMs === bufferMs) is within the buffer ⇒ unsafe', () => {
  const computeVerdict = getComputeVerdict();
  const now = Date.parse('2026-07-18T12:00:00.000Z');
  const result = computeVerdict(baseInput({
    now,
    nextFires: [fire('seed:x', 'refreshSearchIndex', 'Refresh search index', now + DEFAULT_BUFFER_MS)],
  }));
  assert(result.verdict === 'unsafe' && result.safeToDeploy === false,
    `a fire landing exactly at the buffer edge (inMs === bufferMs) must be unsafe — ` +
    `the ADR rule is inMs <= bufferMs (got verdict=${JSON.stringify(result.verdict)}).`);
  assert(result.reasons.includes('NEXT_FIRE_WITHIN_BUFFER'),
    `reasons must carry NEXT_FIRE_WITHIN_BUFFER (got ${JSON.stringify(result.reasons)}).`);
  assert(result.nextFire && result.nextFire.withinBuffer === true,
    'nextFire.withinBuffer must be true at the edge.');
  assert(result.nextFire.inMs === DEFAULT_BUFFER_MS,
    `nextFire.inMs must be at − now (got ${result.nextFire && result.nextFire.inMs}).`);
});

t('U6 (AC-4 boundary): next fire just OUTSIDE the buffer (inMs === bufferMs + 1) ⇒ safe, and the fire is still reported', () => {
  const computeVerdict = getComputeVerdict();
  const now = Date.parse('2026-07-18T12:00:00.000Z');
  const result = computeVerdict(baseInput({
    now,
    nextFires: [fire('seed:x', 'refreshSearchIndex', 'Refresh search index', now + DEFAULT_BUFFER_MS + 1)],
  }));
  assert(result.verdict === 'safe' && result.safeToDeploy === true,
    `one ms beyond the buffer must be safe (got verdict=${JSON.stringify(result.verdict)}).`);
  assert(result.reasons.length === 0, `reasons must be empty when safe (got ${JSON.stringify(result.reasons)}).`);
  assert(result.nextFire && result.nextFire.withinBuffer === false && result.nextFire.inMs === DEFAULT_BUFFER_MS + 1,
    'the next fire must still be reported (AC-1(b): name, fire time, time remaining) even when safe.');
});

t('U7 (AC-4): no enabled entries ⇒ safe with nextFire null', () => {
  const computeVerdict = getComputeVerdict();
  const result = computeVerdict(baseInput({ nextFires: [] }));
  assert(result.verdict === 'safe' && result.safeToDeploy === true,
    `no enabled entries ⇒ safe (the operator's disable-everything habit reads safe) — got ${JSON.stringify(result.verdict)}.`);
  assert(result.nextFire === null,
    `nextFire must be null when no enabled entry has a scheduled next run (got ${JSON.stringify(result.nextFire)}).`);
});

t('U8 (AC-4): among several enabled entries the EARLIEST fire is the next fire, decorated with inMs + withinBuffer', () => {
  const computeVerdict = getComputeVerdict();
  const now = Date.parse('2026-07-18T12:00:00.000Z');
  const result = computeVerdict(baseInput({
    now,
    nextFires: [
      fire('seed:late', 'reconcileAll', 'Reconcile (full)', now + 3 * 3600000),
      fire('seed:soon', 'refreshPinnedTagTLs', 'Refresh pinned tag TLs', now + 7 * 60 * 1000),
      fire('seed:mid', 'refreshSearchIndex', 'Refresh search index', now + 45 * 60 * 1000),
    ],
  }));
  assert(result.nextFire && result.nextFire.entryId === 'seed:soon',
    `nextFire must be the min-at entry (got ${JSON.stringify(result.nextFire && result.nextFire.entryId)}).`);
  assert(result.nextFire.taskId === 'refreshPinnedTagTLs' && result.nextFire.label === 'Refresh pinned tag TLs',
    'nextFire must carry the entry\'s taskId and label (AC-1(b): the entry\'s name).');
  assert(result.nextFire.inMs === 7 * 60 * 1000 && result.nextFire.withinBuffer === true,
    `nextFire must be decorated with inMs (7 min) and withinBuffer=true under the 10-min buffer ` +
    `(got inMs=${result.nextFire.inMs}, withinBuffer=${result.nextFire.withinBuffer}).`);
  assert(result.verdict === 'unsafe' && result.reasons.includes('NEXT_FIRE_WITHIN_BUFFER'),
    '7 minutes out is within the 10-minute buffer ⇒ unsafe.');
});

t('U9 (fail-closed): queue enabled but state unknown ⇒ unsafe with QUEUE_STATE_UNAVAILABLE, never fail-open', () => {
  const computeVerdict = getComputeVerdict();
  const result = computeVerdict(baseInput({ queueStateKnown: false, activeCount: 0 }));
  assert(result.verdict === 'unsafe' && result.safeToDeploy === false,
    `unknown queue state with the queue enabled must fail CLOSED (got verdict=${JSON.stringify(result.verdict)}) — ` +
    'a gate that fails open would green-light a deploy exactly when it is blind.');
  assert(result.reasons.includes('QUEUE_STATE_UNAVAILABLE'),
    `reasons must carry QUEUE_STATE_UNAVAILABLE (got ${JSON.stringify(result.reasons)}).`);
});

t('U10 (AC-5): queue disabled with nothing in flight ⇒ safe — and QUEUE_STATE_UNAVAILABLE must not fire for a disabled queue', () => {
  const computeVerdict = getComputeVerdict();
  const result = computeVerdict(baseInput({ queueEnabled: false, queueStateKnown: false, nextFires: [] }));
  assert(result.verdict === 'safe' && result.safeToDeploy === true,
    `queue disabled, no legacy run, no fires ⇒ safe per the ratified policy (got ${JSON.stringify(result.verdict)}).`);
  assert(!result.reasons.includes('QUEUE_STATE_UNAVAILABLE'),
    'a DISABLED queue is a known state, not an unavailable one — QUEUE_STATE_UNAVAILABLE is ' +
    'only for enabled-but-unintrospectable (AC-5 distinguishes disabled from broken).');
});

t('U11 (AC-5): queue disabled but a legacy run in flight ⇒ unsafe with LEGACY_TASK_RUNNING', () => {
  const computeVerdict = getComputeVerdict();
  const result = computeVerdict(baseInput({ queueEnabled: false, queueStateKnown: false, legacyInFlightCount: 1 }));
  assert(result.verdict === 'unsafe' && result.reasons.includes('LEGACY_TASK_RUNNING'),
    `AC-5: with the queue disabled the verdict is unsafe iff a covered task (e.g. a legacy ` +
    `per-customer run) is in flight (got verdict=${JSON.stringify(result.verdict)}, reasons=${JSON.stringify(result.reasons)}).`);
});

t('U12 (contract): safeToDeploy is the boolean twin of verdict, and reasons is empty exactly when safe', () => {
  const computeVerdict = getComputeVerdict();
  const now = Date.parse('2026-07-18T12:00:00.000Z');
  const scenarios = [
    baseInput(),
    baseInput({ activeCount: 3 }),
    baseInput({ legacyInFlightCount: 2 }),
    baseInput({ queueStateKnown: false }),
    baseInput({ now, nextFires: [fire('e', 'refreshSearchIndex', 'x', now + 60000)] }),
    baseInput({ now, nextFires: [fire('e', 'refreshSearchIndex', 'x', now + 3600000)] }),
    baseInput({ queueEnabled: false, queueStateKnown: false }),
  ];
  for (const input of scenarios) {
    const r = computeVerdict(input);
    assert(r.verdict === 'safe' || r.verdict === 'unsafe',
      `verdict must be "safe"|"unsafe" (got ${JSON.stringify(r.verdict)}).`);
    assert(r.safeToDeploy === (r.verdict === 'safe'),
      `safeToDeploy must equal (verdict === 'safe') — the jq -e calling convention story 2 ` +
      `leans on (verdict=${r.verdict}, safeToDeploy=${r.safeToDeploy}).`);
    assert(Array.isArray(r.reasons) && ((r.reasons.length === 0) === (r.verdict === 'safe')),
      `reasons must be [] iff safe (verdict=${r.verdict}, reasons=${JSON.stringify(r.reasons)}).`);
    assert(r.reasons.every((c) => REASON_CODES.includes(c)),
      `every reason must be one of the four contract codes (got ${JSON.stringify(r.reasons)}).`);
  }
});

/* ══════════════ S-class — structural sentinels (stack-free) ══════════════ */

t('S1 (AC-3 anti-pattern guard): the deploy-safety module never touches the events.jsonl history surfaces', () => {
  const src = readSafe(DEPLOY_SAFETY);
  assert(src !== null,
    'src/api/deploy-safety/index.js does not exist yet — the deploy-safety module ' +
    '(ADR deploy-safety-gate/0001 Option A) is not implemented.');
  for (const forbidden of ['events.jsonl', 'EVENTS_PATH', 'getRecentRuns', 'groupEventsIntoSessions']) {
    assert(!src.includes(forbidden),
      `src/api/deploy-safety/index.js references "${forbidden}" — the events.jsonl TASK_START/` +
      'TASK_END history is the phantom-running trap (a deploy-killed task reads "running" there ' +
      'for up to 24h). AC-3 forbids this source structurally; running-now must come from live ' +
      'state only (BullMQ actives + the legacy in-memory map). ADR Option C was rejected for ' +
      'exactly this.');
  }
});

t('S2 (AC-2): the module aggregates BOTH ratified running sources — queue actives and the legacy in-flight export', () => {
  const src = readSafe(DEPLOY_SAFETY);
  assert(src !== null,
    'src/api/deploy-safety/index.js does not exist yet — cannot verify the two-source aggregation.');
  assert(/getActive/.test(src),
    'the module never reads BullMQ ACTIVE jobs (getActive/getActiveCount) — AC-2(a): running-now ' +
    'must cover active jobs on any task queue, scheduled and manual triggers alike.');
  assert(/getInFlightCount/.test(src),
    'the module never consults the legacy scheduler\'s in-flight aggregate (getInFlightCount) — ' +
    'AC-2(b): an in-flight legacy per-customer run must count as running.');
});

t('S3 (AC-1): GET /api/deploy-safety/status is registered in src/api/index.js', () => {
  const src = readSafe(API_INDEX);
  assert(src !== null, 'src/api/index.js missing — re-baseline this sentinel.');
  assert(/deploy-safety\/status/.test(src),
    'src/api/index.js does not register the /api/deploy-safety/status route — the endpoint must ' +
    'exist (and register unconditionally, outside the TASK_QUEUE_ENABLED gate, so the AC-5 ' +
    'queue-disabled response can be served).');
});

t('S4 (AC-4): the ratified 10-minute default buffer is pinned in the module', () => {
  const src = readSafe(DEPLOY_SAFETY);
  assert(src !== null,
    'src/api/deploy-safety/index.js does not exist yet — cannot verify the default buffer.');
  assert(/10\s*\*\s*60\s*\*\s*1000|600000|600_000/.test(src),
    'the module does not pin the 10-minute default buffer (600000 ms) — the default is the ' +
    'ratified requirement (story AC-4 / product decision 1); the override mechanism is the ' +
    'ADR\'s, the number is not negotiable.');
});

t('S5 (AC-2b seam): customer-schedule exports getInFlightCount() and it returns a number (0 with no timers)', () => {
  const mod = require(CUSTOMER_SCHEDULE);
  assert(typeof mod.getInFlightCount === 'function',
    'src/api/customer-schedule/index.js does not export getInFlightCount() — the new in-process ' +
    'aggregate over the customerTimers map (ADR sub-decision 3) is how AC-2(b) is answered ' +
    'without per-pubkey HTTP iteration.');
  const n = mod.getInFlightCount();
  assert(typeof n === 'number' && Number.isFinite(n) && n >= 0,
    `getInFlightCount() must return a non-negative number (got ${JSON.stringify(n)}).`);
  assert(n === 0,
    `with no customer timers started in this process, getInFlightCount() must be 0 (got ${n}).`);
});

/* ══════════════ H-class — live HTTP contract (SKIP when stack absent) ══════════════ */
// Each H test returns 'SKIP' when the control panel is unreachable — CI's
// stack-free job skips these cleanly while the U/S classes still gate.

let reachable = null; // memoized probe
async function stackAvailable() {
  if (reachable === null) reachable = await controlPanelReachable();
  return reachable;
}

t('H1 (AC-1): one plain unauthenticated GET answers with the full machine-readable contract', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const { status, json } = await fetchStatus();
  assert(status !== 401 && status !== 403,
    `the endpoint must be unauthenticated — a shell script with no login must be able to call it (got ${status}).`);
  assert(status === 200,
    `GET /api/deploy-safety/status must answer 200 (got ${status}) — the endpoint is not implemented.`);
  assert(json && json.success === true, `success must be true (got ${JSON.stringify(json && json.success)}).`);
  // (c) the explicit verdict, in both spellings
  assert(json.verdict === 'safe' || json.verdict === 'unsafe',
    `verdict must be "safe"|"unsafe" (got ${JSON.stringify(json.verdict)}).`);
  assert(typeof json.safeToDeploy === 'boolean' && json.safeToDeploy === (json.verdict === 'safe'),
    'safeToDeploy must be the boolean twin of verdict.');
  assert(Array.isArray(json.reasons) && json.reasons.every((c) => REASON_CODES.includes(c)),
    `reasons must be an array drawn from the four contract codes (got ${JSON.stringify(json.reasons)}).`);
  assert(typeof json.checkedAt === 'string' && !Number.isNaN(Date.parse(json.checkedAt)),
    `checkedAt must be a parseable timestamp (got ${JSON.stringify(json.checkedAt)}).`);
  assert(json.bufferMs === DEFAULT_BUFFER_MS,
    `bufferMs must echo the ratified 10-minute default when no override is passed (got ${json.bufferMs}).`);
  // (a) running-now: the per-source blocks
  assert(json.queue && typeof json.queue.enabled === 'boolean',
    'queue.enabled must be a boolean — the AC-5 distinguishing flag.');
  assert(json.legacy && typeof json.legacy.inFlightCount === 'number',
    'legacy.inFlightCount must be a number (AC-2(b) source).');
  // (b) the next scheduled fire — name, fire time, time remaining
  assert(json.schedule && typeof json.schedule.enabledEntryCount === 'number',
    'schedule.enabledEntryCount must be a number.');
  const nf = json.schedule.nextFire;
  assert(nf === null || (
    typeof nf.entryId === 'string' &&
    typeof nf.taskId === 'string' &&
    typeof nf.label === 'string' &&
    typeof nf.at === 'string' && !Number.isNaN(Date.parse(nf.at)) &&
    typeof nf.inMs === 'number' &&
    typeof nf.withinBuffer === 'boolean'
  ), `schedule.nextFire must be null or {entryId, taskId, label, at, inMs, withinBuffer} — ` +
     `AC-1(b)'s three facts (got ${JSON.stringify(nf)}).`);
});

t('H2 (AC-1): the request is repeatable and read-only — three calls succeed and change no schedule state', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const before = await fetch(`${BASE}/api/scheduled-tasks/list`, { signal: AbortSignal.timeout(8000) })
    .then((r) => r.json()).catch(() => null);
  for (let i = 0; i < 3; i++) {
    const { status, json } = await fetchStatus();
    assert(status === 200 && json && json.success === true,
      `call ${i + 1} of 3 must succeed identically (got ${status}) — repeatability is the contract.`);
  }
  const after = await fetch(`${BASE}/api/scheduled-tasks/list`, { signal: AbortSignal.timeout(8000) })
    .then((r) => r.json()).catch(() => null);
  if (before && after && Array.isArray(before.tasks || before.entries) && Array.isArray(after.tasks || after.entries)) {
    const shape = (b) => (b.tasks || b.entries).map((e) => `${e.id || e.entryId || e.taskId}:${e.enabled}`).sort().join(',');
    assert(shape(before) === shape(after),
      'calling the status endpoint must not create, enable, disable, or remove any scheduled ' +
      `entry (before: ${shape(before)} — after: ${shape(after)}).`);
  }
});

t('H3 (buffer validation): a malformed bufferMinutes fails loudly with 400, never silently gates at the wrong width', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  for (const bad of ['abc', '0', '-5', '1441']) {
    const { status, json } = await fetchStatus(`?bufferMinutes=${bad}`);
    assert(status === 400,
      `bufferMinutes=${bad} must be rejected with 400 (finite, > 0, <= 1440 — ADR sub-decision 2); ` +
      `got ${status}. A typo in a future cycle-skill invocation must fail loudly.`);
    assert(json && json.success === false,
      `the 400 body must carry success:false (got ${JSON.stringify(json)}).`);
  }
});

t('H4 (buffer override): a valid bufferMinutes override is applied and echoed in bufferMs', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const r45 = await fetchStatus('?bufferMinutes=45');
  assert(r45.status === 200 && r45.json && r45.json.bufferMs === 45 * 60 * 1000,
    `bufferMinutes=45 must answer 200 with bufferMs=2700000 echoed (got status=${r45.status}, ` +
    `bufferMs=${r45.json && r45.json.bufferMs}).`);
  const rMax = await fetchStatus('?bufferMinutes=1440');
  assert(rMax.status === 200 && rMax.json && rMax.json.bufferMs === 1440 * 60 * 1000,
    `bufferMinutes=1440 (the boundary) must be valid (got status=${rMax.status}, bufferMs=${rMax.json && rMax.json.bufferMs}).`);
});

t('H5 (AC-5, enabled half): with the queue enabled the response says so, with the queue-state block present', async () => {
  // The local stack runs TASK_QUEUE_ENABLED=true, so only the enabled half of
  // AC-5's distinction is observable live; the disabled half's verdict policy
  // is pinned by U10/U11. Documented in the test plan.
  if (!(await stackAvailable())) return 'SKIP';
  const { status, json } = await fetchStatus();
  assert(status === 200 && json, `status endpoint must answer (got ${status}).`);
  assert(json.queue && json.queue.enabled === true,
    'this stack runs TASK_QUEUE_ENABLED=true, so queue.enabled must be true — "queue enabled ' +
    'but nothing scheduled" must be distinguishable from "queue disabled" by this flag.');
  assert(typeof json.queue.stateKnown === 'boolean',
    'queue.stateKnown must be a boolean when the queue is enabled.');
  if (json.queue.stateKnown) {
    assert(typeof json.queue.activeCount === 'number' && Array.isArray(json.queue.activeTasks),
      'with a known queue state, activeCount (number) and activeTasks (array) must be present.');
    assert(typeof json.queue.schedulerHalted === 'boolean',
      'schedulerHalted must surface the ADR 0019 kill-switch state as a boolean.');
  } else {
    assert(json.verdict === 'unsafe' && json.reasons.includes('QUEUE_STATE_UNAVAILABLE'),
      'an enabled queue whose state is unknown must fail closed (QUEUE_STATE_UNAVAILABLE).');
  }
});

t(`H6 (AC-2a live): a genuinely running queue task (${LIVE_TRIGGER_TASK}) flips running-now and the verdict`, async () => {
  if (!(await stackAvailable())) return 'SKIP';
  // Endpoint first: on a pre-implementation stack this fails HERE, before
  // anything is ever enqueued.
  const pre = await fetchStatus();
  assert(pre.status === 200 && pre.json && pre.json.success === true,
    `GET /api/deploy-safety/status must answer 200 before the live trigger (got ${pre.status}) — ` +
    'the endpoint is not implemented; no task was enqueued.');

  // Fire the benign trigger WITHOUT awaiting: for sync-mode tasks the POST
  // only returns after completion, and we need to observe the active window.
  const trigger = fetch(`${BASE}/api/run-task?taskName=${LIVE_TRIGGER_TASK}`, {
    method: 'POST',
    signal: AbortSignal.timeout(60000),
  }).catch(() => null);

  // Poll for the active window: up to 20s at 200ms.
  let observed = null;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const { status, json } = await fetchStatus();
    if (status === 200 && json && json.queue && Array.isArray(json.queue.activeTasks) &&
        json.queue.activeTasks.some((j) => j.taskName === LIVE_TRIGGER_TASK)) {
      observed = json;
      break;
    }
    await sleep(200);
  }
  trigger.catch(() => {}); // fire-and-forget; the job finishes on its own

  if (!observed) {
    // The task can genuinely complete inside a poll gap — racy environment,
    // not a code verdict. The Reviewer's manual verify covers this path.
    console.log(`        (note) ${LIVE_TRIGGER_TASK} was never observed active within 20s — skipping, not failing.`);
    return 'SKIP';
  }
  assert(observed.verdict === 'unsafe' && observed.safeToDeploy === false,
    `with ${LIVE_TRIGGER_TASK} active, the verdict must be unsafe (got ${JSON.stringify(observed.verdict)}).`);
  assert(observed.reasons.includes('QUEUE_TASK_RUNNING'),
    `reasons must carry QUEUE_TASK_RUNNING while the job is active (got ${JSON.stringify(observed.reasons)}).`);
  assert(observed.queue.activeCount >= 1,
    `queue.activeCount must be >= 1 while the job is active (got ${observed.queue.activeCount}).`);
  const entry = observed.queue.activeTasks.find((j) => j.taskName === LIVE_TRIGGER_TASK);
  assert(typeof entry.startedAt === 'string' && !Number.isNaN(Date.parse(entry.startedAt)),
    `an activeTasks entry must carry a parseable startedAt (got ${JSON.stringify(entry.startedAt)}).`);
  const extraKeys = Object.keys(entry).filter((k) => k !== 'taskName' && k !== 'startedAt');
  assert(extraKeys.length === 0,
    `activeTasks entries must carry ONLY {taskName, startedAt} — job ids and job.data are ` +
    `deliberately excluded from this unauthenticated surface (ADR sub-decision 4); got extra ` +
    `keys: ${JSON.stringify(extraKeys)}.`);
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- deploy-safety status endpoint tests (epic deploy-safety-gate, Story 1) ---');
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
  console.log(`\ndeploy-safety-status: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
