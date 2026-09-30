/**
 * tagging-edges #4 — the tagging pipeline panel: realistic answers for the five reads the panel makes.
 *
 * Story: engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.md
 * ADR:   engineering-team/decisions/tagging-edges/0004-tagging-pipeline-panel.md (§ Seams, T1–T10)
 *
 * Each body has the shape its route answers today (read at 88af7df3):
 *   - GET /api/tagging-edges/status           computeStatus (src/api/tagging-edges/index.js:101-118): no `success` key;
 *     a record is the pass's own record (src/pipeline/tagging-edges/reconcileTaggingEdges.js:106-150, :269-300).
 *   - GET /api/tagging-edges/held             handleHeld (index.js:196-231): { success, runId, outcome, digest, total,
 *     offset, limit, items[{ address, seenEventId, reason }] }; 404 { latestRunId } for another run id.
 *   - GET /api/tagging-edges/realtime/status  computeRealtimeStatus (src/api/tagging-edges/realtime.js:85-108) over the
 *     engine's statusObject (src/pipeline/tagging-edges/realtime/index.js:560-584): no `success` key.
 *   - GET /api/scheduled-tasks/list           handleList (src/api/scheduled-tasks/index.js:302-321).
 *   - GET /api/tagging-edges/drift-counts     the new route (ADR 0004 § Server, "The answer").
 *
 * CommonJS, no dependencies: the browser spec (tests/brainstorm/tagging-pipeline-panel.spec.js) and any Node suite
 * can require it. Every exported body, record and list is frozen deep; take a copy (`clone`) before changing one.
 *
 * Figures a test looks for are distinct and at least 100, so no printed hour, minute, second, day or small count can
 * stand in for one (the browser spec runs in UTC). The AC-4 example keeps the story's small numbers; the spec matches
 * those beside their labels instead.
 */

const hex = (c) => c.repeat(64);

/* ── Who is looking ──────────────────────────────────────────────────────────────────────────────────────────── */

const OWNER = hex('a');                 // the signed-in owner of the stubbed instance
const ADMIN = hex('d');                 // an admin (in getAdminPubkeys)
const CUSTOMER = hex('c');              // a signed-in customer: neither owner nor admin
const CANONICAL_PREFIX = '82b75e47';    // the ADR 0015 literal's first 8 characters
const LOCAL_PREFIX = '8387ec0e';        // this deployment's TA, first 8 characters

/* ── Times ───────────────────────────────────────────────────────────────────────────────────────────────────── */

const NOW = '2026-09-30T12:00:00.000Z';
const at = (minutesBeforeNow) => new Date(Date.parse(NOW) - minutesBeforeNow * 60000).toISOString();
const after = (minutesAfterNow) => new Date(Date.parse(NOW) + minutesAfterNow * 60000).toISOString();

/** A run id as RUN_ID_RE (src/lib/tagging-edges/sweep.js:29) accepts it: yyyymmddThhmmssZ-<8 hex>. */
function runIdAt(iso, suffix) {
  const d = new Date(iso);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  const stamp = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  return `${stamp}-${suffix}`;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────────────────────────────────────── */

function deepFreeze(x) {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) deepFreeze(v);
  }
  return x;
}
const clone = (x) => JSON.parse(JSON.stringify(x));

/* ── The pass's records ──────────────────────────────────────────────────────────────────────────────────────── */

const STOPPED_REASON = 'stopped before it finished (time-out, deploy or restart)';
const CLEAN_REASON = 'the graph agrees with the relay';

function relationships(o = {}) {
  return {
    atStart: 7000,
    added: 0,
    changed: 0,
    changedBy: { newer: 0, older: 0, moved: 0, refreshed: 0, repaired: 0 },
    removed: 0,
    removedBy: { 'not-on-relay': 0, 'non-tagging': 0 },
    unchanged: 0,
    unresolved: 0,
    leftInPlace: 0,
    leftInPlaceBy: { 'missing-address': 0, 'not-a-tagging-address': 0 },
    lostRace: { create: 0, update: 0, move: 0, remove: 0 },
    strippedKeys: [],
    preimagesWritten: 0,
    preimageFile: null,
    ...o,
  };
}

const PHASES_DONE = [
  { phase: 'schema', ms: 40, batches: 0, transientRetries: 0 },
  { phase: 'graph-read', ms: 1900, batches: 0, transientRetries: 0 },
  { phase: 'relay-read', ms: 2300, batches: 0, transientRetries: 0 },
  { phase: 'plan', ms: 310, batches: 0, transientRetries: 0 },
  { phase: 'write-create', ms: 4100, batches: 3, transientRetries: 0 },
];

/**
 * A finished pass record, outcome `done` with the clean reason unless overridden. `startedMinutesAgo` sets its
 * startedAt/endedAt (83 s long) and its run id; `suffix` is the run id's 8 hex.
 */
function passRecord({ startedMinutesAgo = 60, suffix = '0a0b0c0d', ...o } = {}) {
  const startedAt = at(startedMinutesAgo);
  const endedAt = new Date(Date.parse(startedAt) + 83000).toISOString();
  return {
    runId: runIdAt(startedAt, suffix),
    startedAt,
    endedAt,
    durationMs: 83000,
    outcome: 'done',
    reasonCode: 'done',
    reason: CLEAN_REASON,
    stopped: false,
    failure: null,
    confirmed: null,
    confirmation: { found: false, honoured: false },
    taggingsRead: 7027,
    tagElementsRead: 214,
    relationships: relationships(),
    peopleAdded: 0,
    refused: { total: 0, byReason: {} },
    held: { total: 0, byReason: {}, digest: null },
    limit: { base: 7000, leftInPlaceExcluded: 0, baseAfterConfirmed: null, removalsPlanned: 0, floor: 50, fraction: '1/10', exceeded: false },
    identities: { canonical: CANONICAL_PREFIX, local: LOCAL_PREFIX },
    reads: { graph: { rows: 7000 }, relay: { events: 7027 } },
    phases: clone(PHASES_DONE),
    anomalies: { sameAddressConflicts: 0, snapshotConflicts: 0 },
    running: false,
    process: { pid: 4242, startTime: 991122 },
    ...o,
  };
}

/** The pass's pessimistic first record (reconcileTaggingEdges.js:126-150): outcome failed, reason stopped, all 0. */
function pessimisticRecord({ startedMinutesAgo = 1, suffix = 'feedbeef', phases = [] } = {}) {
  const startedAt = at(startedMinutesAgo);
  return {
    ...passRecord({ startedMinutesAgo, suffix }),
    endedAt: null,
    durationMs: null,
    outcome: 'failed',
    reasonCode: 'stopped',
    reason: STOPPED_REASON,
    stopped: true,
    taggingsRead: 0,
    tagElementsRead: 0,
    relationships: relationships({ atStart: 0 }),
    peopleAdded: 0,
    identities: { canonical: null, local: null },
    reads: { graph: null, relay: null },
    phases,
    running: true,
    startedAt,
  };
}

/** The status route's answer (computeStatus): { reportVersion, running, latest, previous, confirmationPending }. */
function statusBody({ running = false, latest = null, previous = [], confirmationPending = null } = {}) {
  return {
    reportVersion: 1,
    running,
    latest: latest ? { ...latest, running } : null,
    previous,
    confirmationPending,
  };
}

/*
 * The latest pass the panel details (AC-2 "The latest pass"): every figure distinct, at least 100, and unlike any
 * figure of the nine earlier passes (whose added is 200–208, unchanged 6692–6700, taggings read 7027), so each can be
 * found. `held` is 0 and is not looked for.
 */
const LATEST_FIGURES = Object.freeze({
  taggingsRead: 7064, added: 112, changed: 134, removed: 156, unchanged: 6725, refused: 117, held: 0, leftInPlace: 103,
  peopleAdded: 141,
});

const LATEST_DONE = passRecord({
  startedMinutesAgo: 30,
  suffix: '1a2b3c4d',
  taggingsRead: LATEST_FIGURES.taggingsRead,
  relationships: relationships({
    added: LATEST_FIGURES.added,
    changed: LATEST_FIGURES.changed,
    changedBy: { newer: 130, older: 0, moved: 4, refreshed: 0, repaired: 0 },
    removed: LATEST_FIGURES.removed,
    removedBy: { 'not-on-relay': 150, 'non-tagging': 6 },
    unchanged: LATEST_FIGURES.unchanged,
    leftInPlace: LATEST_FIGURES.leftInPlace,
    leftInPlaceBy: { 'missing-address': 102, 'not-a-tagging-address': 1 },
  }),
  peopleAdded: LATEST_FIGURES.peopleAdded,
  refused: { total: LATEST_FIGURES.refused, byReason: { 'no-target': 100, 'bad-tag-address': 17 } },
});

/** Nine earlier passes, newest first, each one hour apart and each with its own run id. */
const EARLIER_NINE = Array.from({ length: 9 }, (_, i) => passRecord({
  startedMinutesAgo: 90 + i * 60,
  suffix: `e${i}e${i}e${i}e${i}`,
  relationships: relationships({ added: 200 + i, unchanged: 6700 - i }),
}));

/* ── The held removals ───────────────────────────────────────────────────────────────────────────────────────── */

const HELD_TOTAL = 120;
const HELD_PAGE = 50;

const HELD_RECORD = passRecord({
  startedMinutesAgo: 20,
  suffix: '4e1d4e1d',
  outcome: 'done-removals-held',
  reasonCode: 'removals-held',
  reason: `removals held: ${HELD_TOTAL} over the limit (more than 50 and more than 1/10 of 700); the owner can confirm them`,
  relationships: relationships({ atStart: 700, unchanged: 580 }),
  held: { total: HELD_TOTAL, byReason: { 'not-on-relay': 100, 'non-tagging': 20 }, digest: 'c0ffee'.padEnd(64, '0') },
  limit: { base: 700, leftInPlaceExcluded: 0, baseAfterConfirmed: null, removalsPlanned: HELD_TOTAL, floor: 50, fraction: '1/10', exceeded: true },
});

/** The held list: 120 removals, each with its own address; the first 100 not on the relay, the last 20 non-taggings. */
const HELD_LIST = Array.from({ length: HELD_TOTAL }, (_, i) => ({
  address: `39999:${hex('2')}:held-address-${String(i + 1).padStart(3, '0')}`,
  seenEventId: (i + 1).toString(16).padStart(64, '0'),
  reason: i < 100 ? 'not-on-relay' : 'non-tagging',
}));

/** The owner's confirmation as the status route shows it (index.js:104-110): the file less its nonce, plus `expired`. */
function confirmation({ runId = HELD_RECORD.runId, expiresAt = after(45), expired = false } = {}) {
  return { version: 1, runId, heldDigest: HELD_RECORD.held.digest, confirmedAt: at(15), expiresAt, expired };
}

/**
 * What GET /api/tagging-edges/held answers for this status body and URL (handleHeld): the latest report's list,
 * sliced; 404 { latestRunId } for another run id; 404 'no report yet' with no latest.
 */
function heldAnswer(status, list, url) {
  const u = new URL(url, 'http://stub');
  const q = u.searchParams;
  const latest = status && status.latest;
  if (!latest) return { status: 404, body: { success: false, error: 'no report yet' } };
  if (q.has('runId') && q.get('runId') !== latest.runId) {
    return { status: 404, body: { success: false, error: 'that run is not the latest report', latestRunId: latest.runId } };
  }
  const offset = q.has('offset') ? Number(q.get('offset')) : 0;
  const limit = q.has('limit') ? Number(q.get('limit')) : 1000;
  const heldTotal = latest.held && Number.isInteger(latest.held.total) ? latest.held.total : 0;
  const items = heldTotal > 0 ? list : [];
  return {
    status: 200,
    body: {
      success: true,
      runId: latest.runId,
      outcome: latest.outcome,
      digest: latest.held ? latest.held.digest || null : null,
      total: items.length,
      offset,
      limit,
      items: items.slice(offset, offset + limit),
    },
  };
}

/* ── The status route's answers ──────────────────────────────────────────────────────────────────────────────── */

const RUNNING_RECORD = pessimisticRecord({ startedMinutesAgo: 1, suffix: 'feedbeef', phases: [{ phase: 'schema', ms: 40, batches: 0, transientRetries: 0 }] });

/*
 * AC-4's example: 5 refused taggings, 1 held removal, 1 relationship left in place — explained 5 − 1 − 1 = 3. The
 * story's example is arithmetic only: a real pass holds removals only over its limit (more than 50), so the reason
 * below keeps the producer's template (reconcileTaggingEdges.js:576) with the example's count.
 */
const DRIFT_EXAMPLE_RECORD = passRecord({
  startedMinutesAgo: 25,
  suffix: 'd1f7d1f7',
  outcome: 'done-removals-held',
  reasonCode: 'removals-held',
  reason: 'removals held: 1 over the limit (more than 50 and more than 1/10 of 7024); the owner can confirm them',
  refused: { total: 5, byReason: { 'no-target': 5 } },
  held: { total: 1, byReason: { 'not-on-relay': 1 }, digest: 'd1f7'.padEnd(64, '0') },
  relationships: relationships({ atStart: 7026, unchanged: 7024, leftInPlace: 1, leftInPlaceBy: { 'missing-address': 1, 'not-a-tagging-address': 0 } }),
});

/*
 * A finished pass (it held 1 removal, so `done-removals-held`) that left 112 lost races and 7 conflicting addresses to
 * the next one (leftToNextPass 119). Explained as the example: 5 − 1 − 1 = 3.
 */
const LEFT_TO_NEXT_RECORD = passRecord({
  startedMinutesAgo: 25,
  suffix: '1ef71ef7',
  outcome: 'done-removals-held',
  reasonCode: 'removals-held',
  reason: 'removals held: 1 over the limit (more than 50 and more than 1/10 of 7000); the owner can confirm them',
  refused: { total: 5, byReason: { 'no-target': 5 } },
  held: { total: 1, byReason: { 'not-on-relay': 1 }, digest: '1ef7'.padEnd(64, '0') },
  relationships: relationships({ leftInPlace: 1, leftInPlaceBy: { 'missing-address': 1, 'not-a-tagging-address': 0 }, lostRace: { create: 88, update: 12, move: 7, remove: 5 } }),
  anomalies: { sameAddressConflicts: 4, snapshotConflicts: 3 },
});

const FAILED_READ_RECORD = passRecord({
  startedMinutesAgo: 10,
  suffix: 'fa11fa11',
  outcome: 'failed',
  reasonCode: 'read',
  reason: 'the relay read failed',
  failure: { stage: 'read', read: 'relay', code: 'timeout', message: 'timeout' },
  phases: clone(PHASES_DONE).slice(0, 2),
});

const REFUSED_RECORD = passRecord({
  startedMinutesAgo: 70,
  suffix: 'ef05ef05',
  outcome: 'refused',
  reasonCode: 'schema',
  reason: 'the one-per-tagging rule is not in place',
  failure: { stage: 'schema', code: 'tags_address-missing', message: 'the uniqueness rule tags_address is not in place' },
  phases: [],
});

const UNKNOWN_OUTCOME_RECORD = passRecord({
  startedMinutesAgo: 5,
  suffix: '0dd00dd0',
  outcome: 'paused-for-lunch',
  reasonCode: 'lunch-break',
  reason: 'a future outcome this panel does not know',
});

const STATUS = deepFreeze({
  /** The report holds no pass (AC-2 "No pass yet"). */
  NO_PASS: statusBody(),
  /** A pass is alive; its stored record reads failed/stopped (AC-2 "Running now"). The last finished pass is previous[0]. */
  RUNNING: statusBody({ running: true, latest: RUNNING_RECORD, previous: [LATEST_DONE, ...EARLIER_NINE.slice(0, 8)] }),
  /** A running first pass: the report held nothing before it. Not "no pass yet". */
  RUNNING_FIRST: statusBody({ running: true, latest: RUNNING_RECORD, previous: [] }),
  /** The latest pass finished clean, with nine earlier passes (AC-2 "The latest pass"). */
  LATEST_AND_NINE: statusBody({ latest: LATEST_DONE, previous: EARLIER_NINE }),
  /** A clean latest pass alone. */
  CLEAN: statusBody({ latest: passRecord({ startedMinutesAgo: 15, suffix: 'c1ea0c1e' }), previous: [] }),
  /** The latest pass held 120 removals; no confirmation. */
  HELD_NONE: statusBody({ latest: HELD_RECORD, previous: [LATEST_DONE] }),
  /** ... with the owner's confirmation pending until 45 minutes from NOW. */
  HELD_PENDING: statusBody({ latest: HELD_RECORD, previous: [LATEST_DONE], confirmationPending: confirmation() }),
  /** ... with an expired confirmation: it stays until the next pass, which does not honour it. */
  HELD_EXPIRED: statusBody({ latest: HELD_RECORD, previous: [LATEST_DONE], confirmationPending: confirmation({ expiresAt: at(5), expired: true }) }),
  /** ... with a confirmation file that cannot be read (index.js:171). */
  HELD_UNREADABLE: statusBody({ latest: HELD_RECORD, previous: [LATEST_DONE], confirmationPending: { unreadable: 'EACCES' } }),
  /** AC-4's example pass, the latest and finished. */
  DRIFT_EXAMPLE: statusBody({ latest: DRIFT_EXAMPLE_RECORD, previous: [] }),
  /** A finished pass that left 19 addresses to the next pass. */
  LEFT_TO_NEXT: statusBody({ latest: LEFT_TO_NEXT_RECORD, previous: [] }),
  /** The latest pass failed; the newest finished pass is the one before it (AC-4 "No finished pass", second half). */
  LATEST_FAILED: statusBody({ latest: FAILED_READ_RECORD, previous: [DRIFT_EXAMPLE_RECORD] }),
  /** No finished pass at all: one failed, one refused. */
  NO_FINISHED: statusBody({ latest: FAILED_READ_RECORD, previous: [REFUSED_RECORD] }),
  /** The latest pass carries an outcome and reason code the panel does not know. */
  UNKNOWN_OUTCOME: statusBody({ latest: UNKNOWN_OUTCOME_RECORD, previous: [] }),
});

/* ── The real-time path's answers ────────────────────────────────────────────────────────────────────────────── */

/**
 * The path's own counts (engine emptyCounts, realtime/index.js:192-214): every one distinct, from 100 to 999, and unlike
 * the latest pass's figures, so no printed time or other figure stands in for one. failedReads sums to 423.
 */
const PATH_FIGURES = deepFreeze({
  added: 812, changed: 137, removed: 129, unchanged: 654, peopleAdded: 143, refused: 119,
  failedReads: { relay: 102, graph: 105, element: 107, catchUp: 109 }, dbRefused: 104, removalsNotPrompted: 123,
  droppedOverBacklog: 111, parked: 147, pending: 113,
});

function pathCounts(o = {}) {
  return {
    added: PATH_FIGURES.added,
    changed: PATH_FIGURES.changed,
    changedBy: { newer: 120, older: 0, moved: 17, refreshed: 0, repaired: 0 },
    removed: PATH_FIGURES.removed,
    removedBy: { 'not-on-relay': 129, 'non-tagging': 0 },
    unchanged: PATH_FIGURES.unchanged,
    peopleAdded: PATH_FIGURES.peopleAdded,
    refused: { total: PATH_FIGURES.refused, byReason: { 'no-target': PATH_FIGURES.refused } },
    leftInPlace: { total: 0, byReason: {} },
    deletionsMatchedNothing: 0,
    deletionsForeign: 0,
    failedReads: { ...PATH_FIGURES.failedReads },
    lostRaces: { create: 0, update: 0, move: 0, remove: 0 },
    dbRefused: { total: PATH_FIGURES.dbRefused, byReason: { 'Neo.ClientError.Schema.ConstraintValidationFailed': PATH_FIGURES.dbRefused } },
    heldPreExisting: 0,
    removalsNotPrompted: PATH_FIGURES.removalsNotPrompted,
    relooks: 0,
    conflicts: 0,
    droppedOverBacklog: PATH_FIGURES.droppedOverBacklog,
    ...o,
  };
}

const PATH_TIMES = Object.freeze({
  firstStartedAt: '2026-09-30T08:15:00.000Z',
  onSince: '2026-09-30T08:14:58.000Z',
  runningSince: '2026-09-30T11:02:00.000Z',
  lastReflectedAt: at(1),
  updatedAt: at(0.2),
  catchUpStartedAt: at(40),
});

/**
 * The realtime status route's answer, started and running and live unless overridden. `on`/`running` follow the
 * route's rules: state is 'off' whenever `on` is false; onSince/runningSince only when on/running.
 */
function rtBody({ on = true, running = true, state = 'live', started = true, ...o } = {}) {
  const pass = started ? {
    firstStartedAt: PATH_TIMES.firstStartedAt,
    relay: { lastReadOkAt: at(0.5) },
    subscription: { connected: true, since: PATH_TIMES.runningSince, reconnects: 0 },
    lastReflectedAt: PATH_TIMES.lastReflectedAt,
    lastRound: { at: at(1), prompts: 3, applied: 3 },
    catchUp: {
      underway: false,
      current: null,
      last: {
        outcome: 'done', startedAt: PATH_TIMES.catchUpStartedAt,
        endedAt: new Date(Date.parse(PATH_TIMES.catchUpStartedAt) + 4200).toISOString(), durationMs: 4200,
        reflected: { added: 3, changed: 1, removed: 0, unchanged: 7020 },
      },
    },
    counts: pathCounts(),
    pending: PATH_FIGURES.pending,
    parked: PATH_FIGURES.parked,
    seen: 7027,
    heard: 912,
    journal: { bytes: 20480, skippedLines: 0 },
    setupProblem: null,
    lastError: null,
    preimageFile: null,
    process: { pid: 5151, startTime: 881122, startedAt: PATH_TIMES.runningSince },
    updatedAt: PATH_TIMES.updatedAt,
  } : {
    firstStartedAt: null, relay: null, subscription: null, lastReflectedAt: null, lastRound: null, catchUp: null,
    counts: null, pending: null, parked: null, seen: null, heard: null, journal: null, setupProblem: null,
    lastError: null, preimageFile: null, process: null, updatedAt: null,
  };
  return {
    statusVersion: 1,
    on,
    onSince: on ? PATH_TIMES.onSince : null,
    running,
    runningSince: running && started ? PATH_TIMES.runningSince : null,
    state: on ? state : 'off',
    ...pass,
    switchUnreadable: false,
    stale: false,
    ...o,
  };
}

/** The eight states AC-3 names, as the engine's currentState() and the route's forced 'off' give them. */
const PATH_STATES = Object.freeze(['off', 'starting', 'waiting-setup', 'waiting-graph', 'waiting-relay', 'catching-up', 'live', 'stopped']);

const REALTIME = deepFreeze({
  /** Before the first start: the switch off, status.json never written (every pass-through field null). */
  NEVER_STARTED: rtBody({ on: false, running: false, started: false }),
  /** Switched on before the first start: the process is not alive yet. */
  ON_NEVER_STARTED: rtBody({ on: true, running: false, started: false, state: null }),
  /** On, running, live. */
  ON_LIVE: rtBody(),
  /** On but the process is not alive; the stored state still reads 'live' (realtime.js:89-100). */
  ON_NOT_RUNNING: rtBody({ running: false, state: 'live' }),
  /** Off, with the figures it produced before (its last figures, written at updatedAt). */
  OFF_WITH_FIGURES: rtBody({ on: false, running: false, updatedAt: '2026-09-30T09:41:07.000Z' }),
  /** Running, but status.json not rewritten for over a minute. */
  STALE: rtBody({ stale: true, updatedAt: at(4) }),
  /** status.json cannot be read or parsed: no process named, so not running. */
  STATUS_UNREADABLE: { ...rtBody({ on: true, running: false, started: false, state: null }), statusUnreadable: true },
  /** switch.json cannot be read: the path counts as off. */
  SWITCH_UNREADABLE: rtBody({ on: false, running: false, switchUnreadable: true }),
  /** Counts reset because the path's status was lost (realtime/index.js:226, :2250). */
  COUNTS_RESET: rtBody({ counts: pathCounts({ countsReset: true }) }),
  /** Waiting on a setup problem (a schema rule not online), with a last error. */
  WAITING_SETUP: rtBody({
    state: 'waiting-setup',
    setupProblem: { kind: 'schema', rule: 'tags_address', problem: 'not-online' },
    lastError: { at: at(2), stage: 'graph-read', code: 'ServiceUnavailable', text: 'the graph could not be read' },
  }),
  /** A running path whose state the panel does not know. */
  UNKNOWN_STATE: rtBody({ state: 'hibernating' }),
});

/** A running path in the given state (for 'off', the switch is off and the process is winding down). */
function realtimeInState(state) {
  if (state === 'off') return clone(REALTIME.OFF_WITH_FIGURES);
  return rtBody({ state });
}

/* ── The schedule list ───────────────────────────────────────────────────────────────────────────────────────── */

const TASK_ID = 'reconcileTaggingEdges';
const TASK_NAME = 'Reconcile tagging relationships';

function scheduleEntry({ id, enabled = true, intervalDays = 0, intervalHours = 6, intervalMinutes = 0, cron = '', nextRunAt = after(90), taskId = TASK_ID, taskName = TASK_NAME, label } = {}) {
  return {
    id,
    taskId,
    taskName,
    label: label || taskName,
    enabled,
    intervalDays,
    intervalHours,
    intervalMinutes,
    cron,
    args: {},
    timer: { active: !!nextRunAt, nextRunAt, lastRunAt: at(270) },
  };
}

/** Another task's entry, enabled: never counted as a backstop. */
const OTHER_ENTRY = scheduleEntry({ id: 'entry-search-index', taskId: 'refreshSearchIndex', taskName: 'Refresh the search index', intervalHours: 1 });

const listBody = (entries) => ({ success: true, entries });

const SCHEDULE = deepFreeze({
  /** No entry runs the pass. */
  NONE: listBody([OTHER_ENTRY]),
  /** The only entry that runs the pass is disabled. */
  NONE_WITH_DISABLED: listBody([OTHER_ENTRY, scheduleEntry({ id: 'entry-tagging-off', enabled: false, nextRunAt: null })]),
  /** One enabled entry, every 6 hours, next run in 90 minutes; plus a disabled one (mentioned, not counted). */
  ONE: listBody([OTHER_ENTRY, scheduleEntry({ id: 'entry-tagging-6h' }), scheduleEntry({ id: 'entry-tagging-old', enabled: false, nextRunAt: null, intervalHours: 12 })]),
  /** One enabled entry the scheduler has no next run for. */
  ONE_UNSCHEDULED: listBody([scheduleEntry({ id: 'entry-tagging-6h', nextRunAt: null })]),
  /** One enabled entry every 2 days: weaker than daily. */
  ONE_WEAKER_INTERVAL: listBody([scheduleEntry({ id: 'entry-tagging-2d', intervalDays: 2, intervalHours: 0 })]),
  /** One enabled weekly cron entry (the cron wins over the interval fields): weaker than daily. */
  ONE_WEAKER_CRON: listBody([scheduleEntry({ id: 'entry-tagging-weekly', cron: '0 3 * * 0', intervalHours: 6 })]),
  /** Two enabled entries. */
  SEVERAL: listBody([scheduleEntry({ id: 'entry-tagging-6h' }), scheduleEntry({ id: 'entry-tagging-12h', intervalHours: 12, nextRunAt: after(300) })]),
});

/* ── The drift counts ────────────────────────────────────────────────────────────────────────────────────────── */

/** The drift-counts answer (ADR 0004 § Server): `relay`/`graph` a number (known) or an error code (unknown). */
function driftCounts({ relay, graph, takenAt = NOW, limitMs = 10000 } = {}) {
  const side = (v) => (typeof v === 'number'
    ? { known: true, count: v, takenAt, ms: 212 }
    : { known: false, code: v, takenAt, ms: v === 'timeout' ? limitMs : 30 });
  return {
    success: true,
    limitMs,
    relay: side(relay),
    graph: side(graph),
    stamps: { canonical: CANONICAL_PREFIX, local: LOCAL_PREFIX },
  };
}

const DRIFT = deepFreeze({
  /** AC-4's example over DRIFT_EXAMPLE: relay 7032, graph 7029 → difference 3, explained 3, unexplained 0. */
  EXAMPLE: driftCounts({ relay: 7032, graph: 7029 }),
  /** The same pass, 8 more relay taggings: difference 11, explained 3, unexplained 8. */
  UNEXPLAINED_8: driftCounts({ relay: 7040, graph: 7029 }),
  /** A clean pass, nothing changed since: relay equals graph. */
  CLEAN: driftCounts({ relay: 7027, graph: 7027 }),
  /** The relay count timed out; the graph count is known. */
  RELAY_TIMEOUT: driftCounts({ relay: 'timeout', graph: 7029 }),
  /** The second answer of a recount: the relay moved on. */
  RECOUNT: driftCounts({ relay: 7051, graph: 7043, takenAt: after(1) }),
});

/** The arithmetic AC-4 names, for the fixtures above (a cross-check, not the panel's code). */
const EXPECTED_DRIFT = deepFreeze({
  EXAMPLE: { difference: 3, explained: 3, unexplained: 0 },
  UNEXPLAINED_8: { difference: 11, explained: 3, unexplained: 8 },
  LEFT_TO_NEXT: { leftToNextPass: 119 },
});

/* Freeze every exported record and list too (the STATUS/REALTIME/SCHEDULE/DRIFT bodies are frozen above). */
[LATEST_DONE, EARLIER_NINE, HELD_RECORD, HELD_LIST, RUNNING_RECORD, DRIFT_EXAMPLE_RECORD, LEFT_TO_NEXT_RECORD,
  FAILED_READ_RECORD, REFUSED_RECORD, UNKNOWN_OUTCOME_RECORD, PATH_TIMES, OTHER_ENTRY, PHASES_DONE].forEach(deepFreeze);

/* ── The routes ──────────────────────────────────────────────────────────────────────────────────────────────── */

const ROUTES = Object.freeze({
  status: '/api/tagging-edges/status',
  held: '/api/tagging-edges/held',
  realtime: '/api/tagging-edges/realtime/status',
  schedule: '/api/scheduled-tasks/list',
  drift: '/api/tagging-edges/drift-counts',
});

module.exports = {
  // who
  OWNER, ADMIN, CUSTOMER, CANONICAL_PREFIX, LOCAL_PREFIX,
  // time
  NOW, at, after, runIdAt,
  // helpers
  clone, deepFreeze,
  // the pass
  STOPPED_REASON, CLEAN_REASON, passRecord, pessimisticRecord, statusBody, relationships,
  LATEST_FIGURES, LATEST_DONE, EARLIER_NINE, RUNNING_RECORD, HELD_RECORD, DRIFT_EXAMPLE_RECORD, LEFT_TO_NEXT_RECORD,
  FAILED_READ_RECORD, REFUSED_RECORD, UNKNOWN_OUTCOME_RECORD, STATUS,
  // held
  HELD_TOTAL, HELD_PAGE, HELD_LIST, confirmation, heldAnswer,
  // the path
  PATH_FIGURES, PATH_TIMES, PATH_STATES, pathCounts, rtBody, REALTIME, realtimeInState,
  // the schedule
  TASK_ID, TASK_NAME, scheduleEntry, OTHER_ENTRY, SCHEDULE,
  // drift
  driftCounts, DRIFT, EXPECTED_DRIFT,
  // routes
  ROUTES,
};
