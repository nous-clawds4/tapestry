/**
 * tagging-edges #4 — the tagging pipeline panel: realistic answers for the five reads the panel makes.
 * tagging-edges #5 — the real-time path's switch on the panel: the switch's record (GET) and its change (POST).
 *
 * Story: engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.md
 * ADR:   engineering-team/decisions/tagging-edges/0004-tagging-pipeline-panel.md (§ Seams, T1–T10)
 * Story: engineering-team/stories/tagging-edges/5-real-time-path-switch.md
 * ADR:   engineering-team/decisions/tagging-edges/0005-real-time-path-switch.md (D3, D6, D7, D11; § Seams "Browser
 *        fixtures")
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
 *   - GET /api/tagging-edges/realtime/switch  story 5's record (ADR 0005 D6): { success, on, switchUnreadable,
 *     historyUnreadable, state, latest, history }, each change { on, at, role, key } (D3).
 *   - POST /api/tagging-edges/realtime/switch story 5's change (ADR 0005 D11): { success, on, changedAt, recorded,
 *     takesEffectWithinSeconds }, or a refusal / failure body with `code`.
 *   - The realtime status gains `inStartWindow` (ADR 0005 D7), false unless a fixture says otherwise.
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
const OWNER_KEY = OWNER.slice(0, 8);    // 'aaaaaaaa': who the switch's record names (ADR 0005 D1: pubkey.slice(0, 8))
const ADMIN_KEY = ADMIN.slice(0, 8);    // 'dddddddd'

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

/*
 * Story 4 review round 1 (B42, B44). A pass that failed at the write stage on a full data volume: fsFailure's shape
 * (reconcileTaggingEdges.js:101-104, :486), `ENOSPC <file>`.
 */
const WRITE_FAILED_RECORD = (() => {
  const r = passRecord({
    startedMinutesAgo: 12,
    suffix: 'e05ce05c',
    outcome: 'failed',
    reasonCode: 'write',
    reason: 'a write failed; every committed batch stands at one version of each tagging',
    phases: clone(PHASES_DONE).slice(0, 4),
  });
  r.failure = { stage: 'write', code: 'ENOSPC', message: `ENOSPC preimages/${r.runId}.jsonl` };
  return r;
})();

/*
 * A schema refusal whose cause is Neo4j itself: readSchema is the pass's first contact with the database, so an
 * unreachable Neo4j is refused as `schema` with the driver's code (reconcileTaggingEdges.js:340-349).
 */
const SCHEMA_UNREACHABLE_RECORD = passRecord({
  startedMinutesAgo: 8,
  suffix: '5c4e5c4e',
  outcome: 'refused',
  reasonCode: 'schema',
  reason: 'the one-per-tagging rule could not be checked or created',
  failure: { stage: 'schema', code: 'ServiceUnavailable', message: 'Could not perform discovery. No routing servers available.' },
  taggingsRead: 0,
  tagElementsRead: 0,
  relationships: relationships({ atStart: 0 }),
  identities: { canonical: CANONICAL_PREFIX, local: LOCAL_PREFIX },
  reads: { graph: null, relay: null },
  phases: [],
});

/*
 * A confirmed run: the pass claimed the owner's confirmation of HELD_RECORD's list (confirmation.honoured is set at
 * claim time, reconcileTaggingEdges.js:372-375) and then failed writing, so it applied none of the removals
 * (confirmed.removalsApplied 0; runner SR67).
 */
const CONFIRMED_FAILED_RECORD = (() => {
  const r = passRecord({
    startedMinutesAgo: 6,
    suffix: 'cf0fa110',
    outcome: 'failed',
    reasonCode: 'write',
    reason: 'a write failed; every committed batch stands at one version of each tagging',
    phases: clone(PHASES_DONE).slice(0, 4),
    confirmation: { found: true, honoured: true },
    relationships: relationships({ atStart: 700 }),
  });
  r.failure = { stage: 'write', code: 'SessionExpired', message: 'the session expired' };
  r.confirmed = { confirmedRunId: HELD_RECORD.runId, heldCount: HELD_TOTAL, removalsApplied: 0, heldNoLongerDue: null };
  return r;
})();

/* ... and a confirmed run that finished and applied every confirmed removal. */
const CONFIRMED_APPLIED_RECORD = passRecord({
  startedMinutesAgo: 6,
  suffix: 'cf0dd0e0',
  confirmation: { found: true, honoured: true },
  confirmed: { confirmedRunId: HELD_RECORD.runId, heldCount: HELD_TOTAL, removalsApplied: HELD_TOTAL, heldNoLongerDue: 0 },
  relationships: relationships({ atStart: 700, removed: HELD_TOTAL, removedBy: { 'not-on-relay': 100, 'non-tagging': 20 }, unchanged: 580 }),
  limit: { base: 700, leftInPlaceExcluded: 0, baseAfterConfirmed: 580, removalsPlanned: HELD_TOTAL, floor: 50, fraction: '1/10', exceeded: false },
});

/*
 * Story 4 review round 2, R2-3 (a story 5 carry-forward). A confirmed run that never recorded its end: the pass died
 * (a time-out, a restart or a deploy) after claiming the owner's confirmation, so its record is the pessimistic
 * "failed, stopped" one as of its last save, and it is no longer alive. The record is saved every 10 write batches,
 * so `confirmed.removalsApplied` counts what it had applied by its last save: a lower bound, not the total.
 */
function stoppedConfirmedRecord({ suffix, removalsApplied }) {
  const r = pessimisticRecord({ startedMinutesAgo: 50, suffix, phases: clone(PHASES_DONE) });
  r.running = false;
  r.confirmation = { found: true, honoured: true };
  r.confirmed = { confirmedRunId: HELD_RECORD.runId, heldCount: HELD_TOTAL, removalsApplied, heldNoLongerDue: 0 };
  r.relationships = relationships({
    atStart: 700,
    removed: removalsApplied,
    removedBy: { 'not-on-relay': removalsApplied, 'non-tagging': 0 },
  });
  return r;
}
/** ... it had applied 60 of the 120 confirmed removals by its last save. */
const STOPPED_CONFIRMED_RECORD = stoppedConfirmedRecord({ suffix: '5709ed60', removalsApplied: 60 });
/** ... it had applied none of them by its last save (it may have applied some after). */
const STOPPED_CONFIRMED_NONE_RECORD = stoppedConfirmedRecord({ suffix: '5709ed00', removalsApplied: 0 });

/*
 * Story 4 review round 2, R2-6 (a story 5 carry-forward). A relay read whose strfry command ended with a failure
 * code: the runner keeps the error's redacted `message` and, for the relay read, its redacted `stderrTail`
 * (reconcileTaggingEdges.js:422-425; strfryScanStrict.js summarizeStderr). The panel shows both under "Where it
 * failed".
 */
const RELAY_EXIT_MESSAGE = 'strfry scan exited with code 1';
const RELAY_EXIT_STDERR_TAIL = 'strfry error: unable to open the database at <path>: Resource temporarily unavailable';
const RELAY_EXIT_RECORD = passRecord({
  startedMinutesAgo: 7,
  suffix: 'e7e7e7e7',
  outcome: 'failed',
  reasonCode: 'read',
  reason: 'the relay read failed',
  failure: { stage: 'read', read: 'relay', code: 'exit', message: RELAY_EXIT_MESSAGE, stderrTail: RELAY_EXIT_STDERR_TAIL },
  phases: clone(PHASES_DONE).slice(0, 2),
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
  /** The latest pass failed writing, on a full data volume (ENOSPC). */
  WRITE_FAILED: statusBody({ latest: WRITE_FAILED_RECORD, previous: [LATEST_DONE] }),
  /** The latest pass was refused at the schema check because Neo4j could not be reached (ServiceUnavailable). */
  SCHEMA_UNREACHABLE: statusBody({ latest: SCHEMA_UNREACHABLE_RECORD, previous: [LATEST_DONE] }),
  /** The latest pass claimed the owner's confirmation, then failed: it applied no removals. */
  CONFIRMED_FAILED: statusBody({ latest: CONFIRMED_FAILED_RECORD, previous: [HELD_RECORD] }),
  /** The latest pass claimed the owner's confirmation and applied all 120 confirmed removals. */
  CONFIRMED_APPLIED: statusBody({ latest: CONFIRMED_APPLIED_RECORD, previous: [HELD_RECORD] }),
  /** R2-3: a confirmed pass that never recorded its end, 60 removals applied by its last save; no pass is alive. */
  STOPPED_CONFIRMED: statusBody({ latest: STOPPED_CONFIRMED_RECORD, previous: [HELD_RECORD] }),
  /** R2-3: ... none applied by its last save. */
  STOPPED_CONFIRMED_NONE: statusBody({ latest: STOPPED_CONFIRMED_NONE_RECORD, previous: [HELD_RECORD] }),
  /** R2-6: the latest pass failed at the relay read, its strfry command having exited with a failure code. */
  RELAY_EXIT: statusBody({ latest: RELAY_EXIT_RECORD, previous: [LATEST_DONE] }),
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

/** A last catch-up as endCatchUp writes it (realtime/index.js:1026-1040), at PATH_TIMES.catchUpStartedAt, 4.2 s long. */
function catchUpLast(extra = {}) {
  return {
    outcome: 'done',
    startedAt: PATH_TIMES.catchUpStartedAt,
    endedAt: new Date(Date.parse(PATH_TIMES.catchUpStartedAt) + 4200).toISOString(),
    durationMs: 4200,
    reflected: { added: 3, changed: 1, removed: 0, unchanged: 7020 },
    ...extra,
  };
}

/**
 * The realtime status route's answer, started and running and live unless overridden. `on`/`running` follow the
 * route's rules: state is 'off' whenever `on` is false; onSince/runningSince only when on/running. Story 5 adds
 * `inStartWindow` (ADR 0005 D7), the server's verdict that the path was switched on less than 60 s ago and no process
 * started since: false here unless overridden.
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
    inStartWindow: false,
    ...o,
  };
}

/*
 * Story 5's times (ADR 0005 D4, D7). NOW is 12:00:00, so every switch time inside the 60 s starting window prints as
 * 11:59; the process that completes the start (STARTED) starts at NOW, so its running-since prints as 12:00.
 */
const SWITCH_TIMES = Object.freeze({
  /** The owner turned the path off; its last figures were written at 09:41:07 (OFF_WITH_FIGURES). */
  offAt: '2026-09-30T09:41:02.000Z',
  /** The last change the path reflected before it went off. */
  lastReflectedBeforeOff: '2026-09-30T09:40:55.000Z',
  /** The last catch-up before it went off. */
  catchUpBeforeOff: '2026-09-30T09:20:00.000Z',
  /** The switch went from off to on 15 s before NOW: inside the 60 s window. */
  startOnAt: at(0.25),
  /** A quick off, 9 s before that on (STARTING_OLD_PROCESS). */
  quickOffAt: at(0.4),
  /** An "on" pressed while the path was already on (ON_WHILE_ON): it moves no onSince. */
  onWhileOnAt: at(2),
  /**
   * The process that completes the start (STARTED): it starts 15 s after startOnAt, at NOW. Its running-since prints
   * as 12:00, a minute apart from onSince's 11:59, so a check can tell the two times apart.
   */
  processStartedAt: NOW,
});

/**
 * The path as it is while it starts (ADR 0005 § Seams "Browser fixtures"): switched on 15 s ago, inside the window,
 * the new process not yet alive. status.json is still the old process's, written when it went off.
 */
function startingBody(o = {}) {
  return rtBody({
    running: false,
    state: 'off',
    inStartWindow: true,
    onSince: SWITCH_TIMES.startOnAt,
    lastReflectedAt: SWITCH_TIMES.lastReflectedBeforeOff,
    updatedAt: '2026-09-30T09:41:07.000Z',
    catchUp: {
      underway: false,
      current: null,
      last: catchUpLast({ startedAt: SWITCH_TIMES.catchUpBeforeOff, endedAt: new Date(Date.parse(SWITCH_TIMES.catchUpBeforeOff) + 4200).toISOString() }),
    },
    ...o,
  });
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
  /**
   * The last catch-up failed at its stamp scan while a not-established reason was still to be reported: endCatchUp
   * keeps the reason on a failed or stopped catch-up (realtime/index.js:1033-1038). Story 4 review round 1 (B45).
   */
  CATCH_UP_FAILED_WITH_REASON: rtBody({ catchUp: { underway: false, current: null, last: catchUpLast({ outcome: 'failed', stage: 'stamp-scan', reason: 'record-missing' }) } }),
  /** The last catch-up ran on a lost record: outcome not-established, with its reason. */
  CATCH_UP_NOT_ESTABLISHED: rtBody({ catchUp: { underway: false, current: null, last: catchUpLast({ outcome: 'not-established', reason: 'record-missing' }) } }),

  /* ── Story 5 (ADR 0005 D7, D8; § Seams "Browser fixtures") ── */
  /** Switched on 15 s ago (inStartWindow), the new process not yet alive; the old status.json still reads 'off'. */
  STARTING: startingBody(),
  /**
   * A quick off then on: switched on 15 s ago (inStartWindow) while the process from before that "on" is still alive
   * (runningSince 11:02, before onSince) and its stored state still reads 'live'. It does not count as running.
   */
  STARTING_OLD_PROCESS: rtBody({ running: true, state: 'live', inStartWindow: true, onSince: SWITCH_TIMES.startOnAt }),
  /**
   * The start completed: a process started after the "on" (at SWITCH_TIMES.processStartedAt) is alive, so the window
   * is over (inStartWindow false).
   */
  STARTED: rtBody({
    onSince: SWITCH_TIMES.startOnAt,
    runningSince: SWITCH_TIMES.processStartedAt,
    process: { pid: 6161, startTime: 991199, startedAt: SWITCH_TIMES.processStartedAt },
  }),
  /** An "on" while already on: the same onSince as ON_LIVE (08:14:58), not in the window, running and live. */
  ON_WHILE_ON: rtBody(),
  /** On, running, during its first start: firstStartedAt not yet served, though counts are (ADR 0005 D8). */
  FIRST_STARTING: rtBody({ state: 'starting', firstStartedAt: null }),
});

/* ── The switch's record and its change (story 5; ADR 0005 D3, D6, D11) ─────────────────────────────────────── */

/** One change as the record serves it (D3): who is a role and an 8-hex key; a change not recorded has all three null. */
const ownerChange = (on, iso) => ({ on, at: iso, role: 'owner', key: OWNER_KEY });
const adminChange = (on, iso, key = ADMIN_KEY) => ({ on, at: iso, role: 'admin', key });
const unrecordedChange = (on) => ({ on, at: null, role: null, key: null });

/** The GET's answer (D6): { success, on, switchUnreadable, historyUnreadable, state, latest, history }. */
function recordBody({ state = 'recorded', on, latest = null, history = [], switchUnreadable = false, historyUnreadable = false } = {}) {
  return { success: true, on, switchUnreadable, historyUnreadable, state, latest, history };
}

const sameChange = (a, b) => !!a && !!b && a.on === b.on && a.at === b.at && a.role === b.role && a.key === b.key;

/**
 * The record after a change the server recorded (D2, D3): the change is the latest, and the history is that change
 * on top of the list the record showed before, an entry equal to the one before it dropped, at most 10 (foldHistory).
 */
function foldRecord(prev, change) {
  const before = prev && Array.isArray(prev.history) ? prev.history : [];
  const history = [];
  for (const e of [change, ...before]) if (!sameChange(e, history[history.length - 1])) history.push(e);
  return recordBody({ state: 'recorded', on: change.on, latest: change, history: history.slice(0, 10) });
}

/** Ten changes, newest first, alternating on and off: the owner's, then nine admins' (each its own key, d1d1d1d1…). */
const HISTORY_TEN = Array.from({ length: 10 }, (_, i) => (i === 0
  ? ownerChange(true, at(3))
  : adminChange(i % 2 === 0, at(3 + i * 7), `d${i}`.repeat(4))));

function withLatest(changes, o = {}) {
  return recordBody({ on: changes[0].on, latest: changes[0], history: changes, ...o });
}

const RECORD = deepFreeze({
  /** The owner turned it on at ON_LIVE's onSince (08:14:58), after turning it off earlier. */
  ON_BY_OWNER: withLatest([ownerChange(true, PATH_TIMES.onSince), ownerChange(false, '2026-09-30T08:02:00.000Z'), adminChange(true, '2026-09-29T16:30:00.000Z')]),
  /** The owner turned it off at 09:41 (OFF_WITH_FIGURES). */
  OFF_BY_OWNER: withLatest([ownerChange(false, SWITCH_TIMES.offAt), ownerChange(true, PATH_TIMES.onSince)]),
  /** An admin turned it off at 09:41. */
  OFF_BY_ADMIN: withLatest([adminChange(false, SWITCH_TIMES.offAt), ownerChange(true, PATH_TIMES.onSince)]),
  /** The owner turned it on 15 s ago (STARTING). */
  STARTING: withLatest([ownerChange(true, SWITCH_TIMES.startOnAt), ownerChange(false, SWITCH_TIMES.offAt), ownerChange(true, PATH_TIMES.onSince)]),
  /** An admin turned it on 15 s ago, after the owner had turned it off (another viewer's change). */
  STARTING_BY_ADMIN: withLatest([adminChange(true, SWITCH_TIMES.startOnAt), ownerChange(false, SWITCH_TIMES.offAt), ownerChange(true, PATH_TIMES.onSince)]),
  /** A quick off (an admin) then on (the owner) (STARTING_OLD_PROCESS). */
  STARTING_OLD_PROCESS: withLatest([ownerChange(true, SWITCH_TIMES.startOnAt), adminChange(false, SWITCH_TIMES.quickOffAt), ownerChange(true, PATH_TIMES.onSince)]),
  /** An admin pressed "on" at 11:58 while the owner's "on" of 08:14:58 held (ON_WHILE_ON). */
  ON_WHILE_ON: withLatest([adminChange(true, SWITCH_TIMES.onWhileOnAt), ownerChange(true, PATH_TIMES.onSince)]),
  /** The last ten changes, newest first (on, with the path switched on 3 minutes ago). */
  HISTORY_TEN: withLatest(HISTORY_TEN),
  /** A record that holds the state but not who or when (a hand edit that broke changedBy): recorded, role null. */
  NULL_ROLE: withLatest([unrecordedChange(true), ownerChange(false, SWITCH_TIMES.offAt), ownerChange(true, PATH_TIMES.onSince)]),
  /** An off the server could not record (switch.json unlinked); the history recorded before it survives. */
  UNRECORDED_OFF: recordBody({
    state: 'unrecorded-off',
    on: false,
    latest: unrecordedChange(false),
    history: [unrecordedChange(false), ownerChange(true, PATH_TIMES.onSince), adminChange(false, '2026-09-30T08:02:00.000Z')],
  }),
  /** An instance never switched: the path ships off, and nothing is recorded. */
  NEVER_SWITCHED: recordBody({ state: 'never-switched', on: false, latest: null, history: [] }),
  /** switch.json cannot be read (it counts as off): no latest change, the stored history still served. */
  SWITCH_UNREADABLE: recordBody({
    state: 'switch-unreadable',
    on: false,
    switchUnreadable: true,
    latest: null,
    history: [ownerChange(true, PATH_TIMES.onSince), adminChange(false, '2026-09-30T08:02:00.000Z')],
  }),
  /** The history file cannot be read: the latest change still shown, and the history is that change alone. */
  HISTORY_UNREADABLE: withLatest([ownerChange(true, PATH_TIMES.onSince)], { historyUnreadable: true }),
});

/** The record that agrees with a realtime status body (the browser mock's default for GET .../realtime/switch). */
function recordFor(rt) {
  if (rt && rt.switchUnreadable === true) return RECORD.SWITCH_UNREADABLE;
  if (rt && rt.on === true) return RECORD.ON_BY_OWNER;
  return RECORD.OFF_BY_OWNER;
}

/** The POST's answers (ADR 0005 D11; the refusal bodies are the drift route's, D5), each { status, body }. */
const SWITCH_ANSWER = deepFreeze({
  ON: { status: 200, body: { success: true, on: true, changedAt: NOW, recorded: true, takesEffectWithinSeconds: 5 } },
  OFF: { status: 200, body: { success: true, on: false, changedAt: NOW, recorded: true, takesEffectWithinSeconds: 5 } },
  /** An off whose write failed: switch.json unlinked ("off means off"), not recorded. */
  OFF_UNRECORDED: { status: 200, body: { success: true, on: false, recorded: false, takesEffectWithinSeconds: 5 } },
  /** A lapsed session. */
  REFUSED_401: { status: 401, body: { success: false, error: 'Not authenticated' } },
  /** A viewer who is no longer the owner or an admin. */
  REFUSED_403: { status: 403, body: { success: false, error: 'Owner or admin access required' } },
  /** An on whose switch write failed on a full data volume: nothing changed. */
  FAILED_ON: { status: 500, body: { success: false, error: 'could not write the switch: ENOSPC', code: 'ENOSPC' } },
  /** An off that could neither be written nor removed: the path is still on. */
  FAILED_OFF: { status: 500, body: { success: false, error: 'could not write or remove the switch: EIO, EIO', code: 'EIO', unlinkCode: 'EIO' } },
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
  /**
   * Counts taken 40 minutes before NOW, before DRIFT_EXAMPLE_RECORD ended (25 minutes before NOW, plus 83 s): that
   * pass cannot explain them (T5 countsPredatePass). Arithmetic alone would read difference 132, explained 3,
   * unexplained 129. Story 4 review round 1 (B43).
   */
  PREDATING: driftCounts({ relay: 7032, graph: 6900, takenAt: at(40) }),
});

/** The arithmetic AC-4 names, for the fixtures above (a cross-check, not the panel's code). */
const EXPECTED_DRIFT = deepFreeze({
  EXAMPLE: { difference: 3, explained: 3, unexplained: 0 },
  UNEXPLAINED_8: { difference: 11, explained: 3, unexplained: 8 },
  LEFT_TO_NEXT: { leftToNextPass: 119 },
  PREDATING: { difference: 132, explained: 3, unexplained: 129, countsPredatePass: true },
});

/* Freeze every exported record and list too (the STATUS/REALTIME/SCHEDULE/DRIFT bodies are frozen above). */
[LATEST_DONE, EARLIER_NINE, HELD_RECORD, HELD_LIST, RUNNING_RECORD, DRIFT_EXAMPLE_RECORD, LEFT_TO_NEXT_RECORD,
  FAILED_READ_RECORD, REFUSED_RECORD, UNKNOWN_OUTCOME_RECORD, WRITE_FAILED_RECORD, SCHEMA_UNREACHABLE_RECORD,
  CONFIRMED_FAILED_RECORD, CONFIRMED_APPLIED_RECORD, PATH_TIMES, OTHER_ENTRY, PHASES_DONE,
  STOPPED_CONFIRMED_RECORD, STOPPED_CONFIRMED_NONE_RECORD, RELAY_EXIT_RECORD, HISTORY_TEN].forEach(deepFreeze);

/* ── The routes ──────────────────────────────────────────────────────────────────────────────────────────────── */

const ROUTES = Object.freeze({
  status: '/api/tagging-edges/status',
  held: '/api/tagging-edges/held',
  realtime: '/api/tagging-edges/realtime/status',
  schedule: '/api/scheduled-tasks/list',
  drift: '/api/tagging-edges/drift-counts',
  /** Story 5 (ADR 0005 D6, D12): GET reads the switch's record; POST is the panel's one change. */
  switch: '/api/tagging-edges/realtime/switch',
});

module.exports = {
  // who
  OWNER, ADMIN, CUSTOMER, CANONICAL_PREFIX, LOCAL_PREFIX, OWNER_KEY, ADMIN_KEY,
  // time
  NOW, at, after, runIdAt,
  // helpers
  clone, deepFreeze,
  // the pass
  STOPPED_REASON, CLEAN_REASON, passRecord, pessimisticRecord, statusBody, relationships,
  LATEST_FIGURES, LATEST_DONE, EARLIER_NINE, RUNNING_RECORD, HELD_RECORD, DRIFT_EXAMPLE_RECORD, LEFT_TO_NEXT_RECORD,
  FAILED_READ_RECORD, REFUSED_RECORD, UNKNOWN_OUTCOME_RECORD, WRITE_FAILED_RECORD, SCHEMA_UNREACHABLE_RECORD,
  CONFIRMED_FAILED_RECORD, CONFIRMED_APPLIED_RECORD, STATUS,
  STOPPED_CONFIRMED_RECORD, STOPPED_CONFIRMED_NONE_RECORD, RELAY_EXIT_RECORD, RELAY_EXIT_MESSAGE, RELAY_EXIT_STDERR_TAIL,
  // held
  HELD_TOTAL, HELD_PAGE, HELD_LIST, confirmation, heldAnswer,
  // the path
  PATH_FIGURES, PATH_TIMES, PATH_STATES, pathCounts, catchUpLast, rtBody, REALTIME, realtimeInState,
  // the switch (story 5)
  SWITCH_TIMES, startingBody, ownerChange, adminChange, unrecordedChange, recordBody, foldRecord, HISTORY_TEN, RECORD,
  recordFor, SWITCH_ANSWER,
  // the schedule
  TASK_ID, TASK_NAME, scheduleEntry, OTHER_ENTRY, SCHEDULE,
  // drift
  driftCounts, DRIFT, EXPECTED_DRIFT,
  // routes
  ROUTES,
};
