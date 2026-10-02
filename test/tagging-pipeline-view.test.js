'use strict';
/**
 * Tests for Story 4 (epic tagging-edges) — the tagging pipeline panel's view model.
 *
 * Story: engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.md — AC-2 (the pass judged running by
 *        liveness, the latest and earlier passes, "no pass yet", the confirmation's state, the backstop schedule), AC-3
 *        (the path: liveness first, its warnings, its counts and gauges, "not yet available" against 0, its last
 *        figures), AC-4 (drift: the difference, the explained part from the newest finished pass, the remainder, what
 *        is named beside it, "unknown, never 0") and AC-5's "every state has its own text" (the explanations and their
 *        "not recognised" fallback).
 * ADR:   engineering-team/decisions/tagging-edges/0004-tagging-pipeline-panel.md — § Implementation notes › UI
 *        (ui/src/utils/taggingPipelineView.js: its form, POLL_MS / SCHEDULE_POLL_MS, EXPLANATIONS, FAMILIES, explain,
 *        passView, newestFinishedPass, pathView, scheduleView, driftView), § Seams for Test Design ("the two view modules
 *        are loaded by import() from Node suites"), and § Clarifications (Test Design, 2026-09-30) T1–T6.
 *
 * Intentionally failing until the implementation lands (red phase): ui/src/utils/taggingPipelineView.js does not exist
 * yet. It is import()ed lazily inside every test (the test/next-task-countdown.test.js:49-66 precedent) through a
 * loader that names the export it needs, so the suite always loads and each test fails by name with
 * "<file> not implemented yet: it does not export X (ADR 0004 § …)".
 *
 * Classes:
 *   TV1–TV4   the module's exports and its form (plain ESM .js, no JSX, no React, relative .js imports only, no clock).
 *   TV5–TV11  explain(kind, code) (T6; own-property lookup; the FAMILIES patterns; unknown kind; code as given).
 *   TV12–TV22 passView(statusBody) (T1) and newestFinishedPass(statusBody) (T2).
 *   TV23–TV33 pathView(rtBody) (T3).
 *   TV34–TV44 scheduleView(listBody) (T4 and § UI's "weaker than daily" rule).
 *   TV45–TV58 driftView(counts, statusBody, rtBody) (T5 and § UI).
 *   TV59–TV63 driftView after story 4's review, round 1 (ADR 0004 T5 as amended at c496d853): countsPredatePass —
 *             true only with an explaining pass, both counts known, and min(Date.parse(relay.takenAt),
 *             Date.parse(graph.takenAt)) < Date.parse(explainedBy.endedAt); tone neutral when true; explained and
 *             unexplained still computed (TV59–TV62; review Non-blocking 3) — and usedInsteadOfLatest true while a
 *             pass runs (TV63; T5's note; review Non-blocking 1). The flags helper now holds five flags, so TV48–TV51
 *             pin countsPredatePass's boolean too.
 *   TV64–TV81 Story 5 (engineering-team/stories/tagging-edges/5-real-time-path-switch.md; ADR
 *             engineering-team/decisions/tagging-edges/0005-real-time-path-switch.md D7, D8, D12, D14 and § Seams "The
 *             view module"), still clock-free (TV4):
 *             TV64–TV67 pathView's starting window (D7: starting, runningForThisOn, onButNotRunning and state while
 *             starting, the server's inStartWindow verdict only); TV68 offPromptVariant (D8); TV69 turnOnWarning
 *             (D14); TV70–TV77 switchRecordView (D12: each record state's own sentence, and the two consistency
 *             cases); TV78–TV81 switchOutcome (D12: each outcome against each target).
 *   TV82      Story 5's review, round 1, requested 6: a failed change with no body.code (a body-less 404 or 502)
 *             names no data-volume remedy, claims no state and says the state shown is from the next read; one
 *             carrying the handler's code keeps the remedy. It fails until a code-less failure has its own sentence.
 *   R2-12 (story 5 § Carry-forwards): TV48's title now says five flags, as the helper holds (a title-only edit).
 *
 * Story 5's readings where ADR 0005 leaves a detail open (reported at the Test Design gate):
 *   - switchRecordView's and switchOutcome's answer shapes are not fixed, so these tests read them shape-free: every
 *     string value in the answer, deep (keys are never read). switchOutcome must name exactly one of D12's five outcomes
 *     as a string value, and its sentence is its string values holding a space.
 *   - The history the record shows is found as an array in the answer whose rows carry the record's history newest
 *     first: a recorded row its key and its time, a row not recorded neither (D12). The list may be the whole history
 *     or all of it but the latest, which has its own line (AC-5: the latest change plus the last 10).
 *   - The panel prints a time in the viewer's locale (parts.jsx when()) and the view module reads no clock, so the form
 *     a time takes in the answer is the view's choice: "when" is checked as the record's instant present in the answer
 *     in any form that reads back to it — a string value s with Date.parse(s) === Date.parse(at), a number equal to
 *     it, or the ISO text inside a longer string (carriesTime; TV70, TV75, and every history row TV70–TV72 and TV74
 *     find). A row not recorded carries none of the history's times in any of those forms, and no ISO-looking text.
 *   - switchOutcome's target is the boolean the panel sent (sendSwitch(on, …)).
 *   - TV80–TV81 pin only words D12 itself gives the sentences: the refused one's "sign in again" and "owner or an
 *     admin" (its "from the instance's own address" is checked as the sentence naming where, in any of address, URL,
 *     origin, site, host, domain or page), the failed on's "unchanged", "free space" and "writable", and the failed
 *     off's "could not be turned off" and "still on".
 *   - turnOnWarning's "none" is null, undefined or 'none'.
 *   - A record read is "current" when its state is 'ready'; a failed read keeps its body (useRead) but is not current.
 *
 * Fixtures are modelled on the real shapes: the status route's computeStatus (src/api/tagging-edges/index.js:104-118),
 * the pass's records (src/pipeline/tagging-edges/reconcileTaggingEdges.js pessimisticRecord :126-150, finish), the
 * realtime route's computeRealtimeStatus (src/api/tagging-edges/realtime.js:85-108) and the schedule list
 * (src/api/scheduled-tasks/index.js handleList), with values taken from staging's public GETs of 2026-09-30.
 *
 * Choices this suite makes where the ADR leaves a detail open (reported to the owner in the Test Design return):
 *   - T4's "every N day(s)" is read as plural for N > 1 ("every 2 days"); for N = 1 either "every 1 day" or
 *     "every 1 days" is accepted, since the ADR does not settle it.
 *   - Returned objects are checked field by field for what T1–T5 name; extra fields are not refused. Where a test
 *     pins a whole result (explain's answer, scheduleView's result, the confirmation's "none", pathView's gauges), the
 *     one extra key allowed is `tone`, one of ok | warn | bad | neutral (§ UI "Tones" does not say which result
 *     carries one).
 *   - A family pattern applies only under its own kind (FAMILIES entries carry a kind).
 *   - EXPLANATIONS is read as frozen at both levels: the map and each kind's table.
 *   - "Its derivations never read a clock" is pinned by stubbing Date.now (and counting calls) and by a source scan for
 *     any reference to Date.now or performance.now (a captured `const now = Date.now` included), and for new Date()
 *     or Date() with no argument. The source scans read code only: comments and string literals are masked first, so
 *     an explanation sentence that says "read from \"report.json\"" is not taken for an import.
 *
 * Hermetic: no network, no stack, no file written. Stack-free on Node 16 and Node 22.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO_ROOT = path.join(__dirname, '..');
const VIEW_REL = 'ui/src/utils/taggingPipelineView.js';
const NL = '\n';

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const show = (v) => { try { return JSON.stringify(v); } catch (_) { return String(v); } };
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
const sameJson = (a, b) => show(sortKeys(a)) === show(sortKeys(b));
function same(actual, expected, what) {
  assert(sameJson(actual, expected), `${what}: expected ${show(expected)}, got ${show(actual)}`);
}
/** Every key of `expected` is present in `actual` with a JSON-equal value; extra keys are allowed. */
function fields(actual, expected, what) {
  assert(actual && typeof actual === 'object', `${what}: expected an object carrying ${show(expected)}, got ${show(actual)}`);
  for (const k of Object.keys(expected)) {
    assert(sameJson(actual[k], expected[k]), `${what}.${k}: expected ${show(expected[k])}, got ${show(actual[k])}`);
  }
}
const TONES = ['ok', 'warn', 'bad', 'neutral'];
/**
 * The whole result: every key of `expected` JSON-equal in `actual`, and no other key except an optional `tone`, which
 * must then be one of ok | warn | bad | neutral (ADR 0004 § UI "Tones").
 */
function exactly(actual, expected, what) {
  fields(actual, expected, what);
  const extra = Object.keys(actual).filter((k) => !Object.prototype.hasOwnProperty.call(expected, k));
  const notTone = extra.filter((k) => k !== 'tone');
  assert(notTone.length === 0, `${what}: carries key(s) ${show(notTone)} beyond ${show(Object.keys(expected))} (only a tone may be added)`);
  if (extra.includes('tone')) {
    assert(TONES.includes(actual.tone), `${what}.tone must be one of ${show(TONES)} (ADR 0004 § UI "Tones"); got ${show(actual.tone)}`);
  }
}

/**
 * Reads module source as code only. Comments are dropped, and every string, template and regex literal is replaced by
 * a placeholder "__S<i>__" (its text kept in `strings[i]`), so scans of `code` never match inside a sentence.
 * A `/` opens a regex after an operator, an opening bracket, a comma, a semicolon or a keyword such as return.
 */
function scanModule(src) {
  const strings = [];
  let code = '';
  let i = 0;
  let prev = ''; // the last significant code token's text
  const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw',
    'instanceof', 'yield', 'await']);
  const regexAllowed = () => prev === '' || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || REGEX_AFTER_WORD.has(prev);
  const place = (text) => { strings.push(text); code += `"__S${strings.length - 1}__"`; prev = '"'; };
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== NL) i++; continue; }
    if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      code += src.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      let text = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') { text += src.slice(j, j + 2); j += 2; continue; }
        if (c !== '`' && src[j] === NL) break;
        text += src[j];
        j++;
      }
      place(text);
      i = j + 1;
      continue;
    }
    if (c === '/' && regexAllowed()) {
      let j = i + 1;
      let inClass = false;
      while (j < src.length && src[j] !== NL) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        else if (src[j] === '/' && !inClass) break;
        j++;
      }
      j++;
      while (j < src.length && /[a-z]/i.test(src[j])) j++;
      place(src.slice(i, j));
      i = j;
      continue;
    }
    if (/[A-Za-z_$0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z_$0-9]/.test(src[j])) j++;
      prev = src.slice(i, j);
      code += prev;
      i = j;
      continue;
    }
    if (!/\s/.test(c)) prev = c;
    code += c;
    i++;
  }
  return { code, strings };
}
function readSafe(rel) {
  try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8'); } catch (_e) { return null; }
}
const clone = (v) => JSON.parse(JSON.stringify(v));

let modPromise = null;
async function importView() {
  if (!modPromise) {
    modPromise = import(pathToFileURL(path.join(REPO_ROOT, VIEW_REL)).href)
      .then((mod) => ({ mod }), (err) => ({ err }));
  }
  return modPromise;
}

/** Loads the view module and checks it exports `name`; throws a message that says what is missing. */
async function need(name, where, adr = 'ADR 0004') {
  const { mod, err } = await importView();
  if (err) {
    const why = (err && (err.code || String(err.message).split(NL)[0])) || 'error';
    throw new Error(`${VIEW_REL} not implemented yet: it does not export ${name} (${adr} ${where}; the module cannot ` +
      `be imported by Node: ${why})`);
  }
  if (mod[name] === undefined) {
    throw new Error(`${VIEW_REL} not implemented yet: it does not export ${name} (${adr} ${where})`);
  }
  return mod[name];
}
const fn = async (name, where) => {
  const f = await need(name, where);
  assert(typeof f === 'function', `${VIEW_REL} exports ${name}, but it is not a function (ADR 0004 ${where})`);
  return f;
};
const explainFn = () => fn('explain', '§ UI, T6');
const passViewFn = () => fn('passView', '§ UI, T1');
const newestFn = () => fn('newestFinishedPass', '§ UI, T2');
const pathViewFn = () => fn('pathView', '§ UI, T3');
const scheduleViewFn = () => fn('scheduleView', '§ UI, T4');
const driftViewFn = () => fn('driftView', '§ UI, T5');
/** Story 5's new exports (ADR 0005): the same loader, citing ADR 0005. */
const fn5 = async (name, where) => {
  const f = await need(name, where, 'ADR 0005');
  assert(typeof f === 'function', `${VIEW_REL} exports ${name}, but it is not a function (ADR 0005 ${where})`);
  return f;
};
const offPromptVariantFn = () => fn5('offPromptVariant', 'D8');
const turnOnWarningFn = () => fn5('turnOnWarning', 'D14');
const switchRecordViewFn = () => fn5('switchRecordView', 'D12');
const switchOutcomeFn = () => fn5('switchOutcome', 'D12');

/** Runs `body` with Date.now answering `at` and counting its calls; restores it in finally. */
async function withClock(at, body) {
  const real = Date.now;
  const calls = { n: 0 };
  Date.now = () => { calls.n += 1; return at; };
  try { return await body(calls); } finally { Date.now = real; }
}

// ─── fixtures: the pass report (GET /api/tagging-edges/status) ─────────────────────────────────────────────────────

const STOPPED_REASON = 'stopped before it finished (time-out, deploy or restart)';
const PHASES_DONE = ['identities', 'schema', 'graph-read', 'relay-read', 'plan', 'write-creates', 'write-updates',
  'write-moves', 'write-removals', 'report'].map((phase) => ({ phase, ms: 4, batches: 0, transientRetries: 0 }));
const phasesUpTo = (last) => PHASES_DONE.slice(0, PHASES_DONE.findIndex((p) => p.phase === last) + 1);

function relationships(over = {}) {
  return {
    atStart: 7026, added: 0, changed: 0,
    changedBy: { newer: 0, older: 0, moved: 0, refreshed: 0, repaired: 0 },
    removed: 0, removedBy: { 'not-on-relay': 0, 'non-tagging': 0 },
    unchanged: 7026, unresolved: 6, leftInPlace: 0,
    leftInPlaceBy: { 'missing-address': 0, 'not-a-tagging-address': 0 },
    lostRace: { create: 0, update: 0, move: 0, remove: 0 },
    strippedKeys: [], preimagesWritten: 0, preimageFile: null,
    ...over,
  };
}

/** A finished `done` record as staging served it on 2026-09-30 (running as computeStatus sets it). */
function doneRecord(over = {}) {
  return {
    runId: '20260930T142646Z-a7f04da9',
    startedAt: '2026-09-30T14:26:46.908Z',
    endedAt: '2026-09-30T14:26:48.167Z',
    durationMs: 1259,
    outcome: 'done',
    reasonCode: 'done',
    reason: 'the graph agrees with the relay',
    stopped: false,
    failure: null,
    confirmed: null,
    confirmation: { found: false, honoured: false },
    taggingsRead: 7026,
    tagElementsRead: 3381,
    relationships: relationships(),
    peopleAdded: 0,
    refused: { total: 0, byReason: {} },
    held: { total: 0, byReason: {}, digest: null },
    limit: { base: 7026, baseAfterConfirmed: null, removalsPlanned: 0, floor: 50, fraction: '1/10', exceeded: false, leftInPlaceExcluded: 0 },
    identities: { canonical: '82b75e47', local: '8e901369' },
    reads: { graph: { rows: 7026, ms: 271 }, relay: { events: 10407, bytes: 8229855, ms: 261 } },
    phases: clone(PHASES_DONE),
    anomalies: { sameAddressConflicts: 0, snapshotConflicts: 0 },
    running: false,
    process: { pid: 28343, startTime: '1413314262' },
    ...over,
  };
}

/** The story's AC-4 example: 5 refused taggings, 1 held removal, 1 relationship left in place. */
function heldRecord(over = {}) {
  return doneRecord({
    runId: '20260929T030000Z-0badc0de',
    startedAt: '2026-09-29T03:00:00.120Z',
    endedAt: '2026-09-29T03:00:06.480Z',
    durationMs: 6360,
    outcome: 'done-removals-held',
    reasonCode: 'removals-held',
    reason: 'removals held: 1 over the limit (more than 50 and more than 1/10 of 7026); the owner can confirm them',
    taggingsRead: 7031,
    relationships: relationships({
      atStart: 7028, unchanged: 7026, leftInPlace: 1,
      leftInPlaceBy: { 'missing-address': 1, 'not-a-tagging-address': 0 },
    }),
    refused: { total: 5, byReason: { 'no-target': 3, 'bad-tag-address': 2 } },
    held: { total: 1, byReason: { 'not-on-relay': 1 }, digest: 'c0ffee00'.repeat(8) },
    ...over,
  });
}

/** The first record a pass writes (reconcileTaggingEdges.js pessimisticRecord): it already reads "failed — stopped". */
function pessimisticRecord(over = {}) {
  return {
    runId: '20260930T151500Z-5eed1e55',
    startedAt: '2026-09-30T15:15:00.004Z',
    endedAt: null,
    durationMs: null,
    outcome: 'failed',
    reasonCode: 'stopped',
    reason: STOPPED_REASON,
    stopped: true,
    failure: null,
    confirmed: null,
    confirmation: { found: false, honoured: false },
    taggingsRead: 0,
    tagElementsRead: 0,
    relationships: relationships({ atStart: 0, unchanged: 0, unresolved: 0 }),
    peopleAdded: 0,
    refused: { total: 0, byReason: {} },
    held: { total: 0, byReason: {}, digest: null },
    limit: { base: 0, leftInPlaceExcluded: 0, baseAfterConfirmed: null, removalsPlanned: 0, floor: 50, fraction: '1/10', exceeded: false },
    identities: { canonical: null, local: null },
    reads: { graph: null, relay: null },
    phases: [],
    anomalies: { sameAddressConflicts: 0, snapshotConflicts: 0 },
    running: true,
    process: { pid: 30111, startTime: '1413399001' },
    ...over,
  };
}

/** A pass that failed at a write, after planning (it may have written). */
function failedWriteRecord(over = {}) {
  return doneRecord({
    runId: '20260930T120000Z-feedf00d',
    startedAt: '2026-09-30T12:00:00.010Z',
    endedAt: '2026-09-30T12:00:04.900Z',
    durationMs: 4890,
    outcome: 'failed',
    reasonCode: 'write',
    reason: 'a write failed; every committed batch stands at one version of each tagging',
    failure: { stage: 'write', code: 'Neo.TransientError.General.DatabaseUnavailable', message: 'the database is unavailable' },
    phases: phasesUpTo('write-creates'),
    ...over,
  });
}

/** A pass that failed reading the relay, before planning (it wrote nothing). */
function failedReadRecord(over = {}) {
  return doneRecord({
    runId: '20260930T110000Z-deadbeef',
    startedAt: '2026-09-30T11:00:00.010Z',
    endedAt: '2026-09-30T11:00:10.020Z',
    durationMs: 10010,
    outcome: 'failed',
    reasonCode: 'read',
    reason: 'the relay read failed',
    failure: { stage: 'read', read: 'relay', code: 'timeout', message: 'the relay read timed out' },
    phases: phasesUpTo('graph-read'),
    ...over,
  });
}

function refusedRecord(over = {}) {
  return doneRecord({
    runId: '20260929T090000Z-00c0ffee',
    startedAt: '2026-09-29T09:00:00.010Z',
    endedAt: '2026-09-29T09:00:00.300Z',
    durationMs: 290,
    outcome: 'refused',
    reasonCode: 'schema',
    reason: 'the one-per-tagging rule is not in place',
    failure: { stage: 'schema', code: 'tags_address-not-online', message: 'the uniqueness rule tags_address is not in place' },
    phases: phasesUpTo('schema'),
    ...over,
  });
}

function statusBody({ running = false, latest = doneRecord(), previous = [], confirmationPending = null } = {}) {
  return {
    reportVersion: 1,
    running,
    latest: latest ? { ...latest, running } : null,
    previous,
    confirmationPending,
  };
}

const PENDING_CONFIRMATION = {
  version: 1,
  runId: '20260929T030000Z-0badc0de',
  heldDigest: 'c0ffee00'.repeat(8),
  heldCount: 1,
  mintedAt: '2026-09-30T15:00:00.000Z',
  expiresAt: '2026-09-30T16:00:00.000Z',
  mintedBy: '8e901369',
  expired: false,
};

// ─── fixtures: the real-time path (GET /api/tagging-edges/realtime/status) ─────────────────────────────────────────

function pathCounts(over = {}) {
  return {
    added: 1, changed: 0,
    changedBy: { newer: 0, older: 0, moved: 0, refreshed: 0, repaired: 0 },
    removed: 0, removedBy: { 'not-on-relay': 0, 'non-tagging': 0 },
    unchanged: 0, peopleAdded: 0,
    refused: { total: 0, byReason: {} },
    leftInPlace: { total: 0, byReason: {} },
    deletionsMatchedNothing: 0, deletionsForeign: 0,
    failedReads: { relay: 0, graph: 0, element: 0, catchUp: 0 },
    lostRaces: { create: 0, update: 0, move: 0, remove: 0 },
    dbRefused: { total: 0, byReason: {} },
    heldPreExisting: 0, removalsNotPrompted: 0, relooks: 0, conflicts: 0, droppedOverBacklog: 0,
    ...over,
  };
}

const CATCH_UP_LAST = {
  outcome: 'done',
  startedAt: '2026-09-30T19:56:41.561Z',
  endedAt: '2026-09-30T19:56:43.205Z',
  durationMs: 1644,
  reflected: { added: 0, changed: 0, removed: 0, unchanged: 0 },
};

/** The realtime status staging served on 2026-09-30: on, running, live. */
function rtLive(over = {}) {
  return {
    statusVersion: 1,
    on: true,
    onSince: '2026-09-30T14:26:35.366Z',
    running: true,
    runningSince: '2026-09-30T14:26:36.170Z',
    state: 'live',
    firstStartedAt: '2026-09-30T14:26:36.170Z',
    relay: { lastReadOkAt: '2026-09-30T19:56:43.117Z' },
    subscription: { connected: true, since: '2026-09-30T14:26:36.956Z', lastEventAt: '2026-09-30T15:20:32.962Z' },
    lastReflectedAt: '2026-09-30T15:20:33.465Z',
    lastRound: { ms: 233, addresses: 1 },
    catchUp: { underway: false, current: null, last: clone(CATCH_UP_LAST) },
    counts: pathCounts(),
    pending: 0,
    parked: 0,
    seen: 7027,
    heard: 0,
    journal: { bytes: 32, skippedLines: 0 },
    setupProblem: null,
    lastError: null,
    preimageFile: null,
    process: { pid: 28230, startTime: '1413313189', startedAt: '2026-09-30T14:26:36.170Z' },
    updatedAt: '2026-09-30T19:57:13.808Z',
    switchUnreadable: false,
    stale: false,
    ...over,
  };
}

/** computeRealtimeStatus with no status.json and no switch.json: a fresh install, the path never started. */
function rtNeverStarted(over = {}) {
  const out = { statusVersion: 1, on: false, onSince: null, running: false, runningSince: null, state: 'off' };
  for (const k of ['firstStartedAt', 'relay', 'subscription', 'lastReflectedAt', 'lastRound', 'catchUp', 'counts',
    'pending', 'parked', 'seen', 'heard', 'journal', 'setupProblem', 'lastError', 'preimageFile', 'process', 'updatedAt']) {
    out[k] = null;
  }
  out.switchUnreadable = false;
  out.stale = false;
  return { ...out, ...over };
}

/** The path switched off after it ran: state forced to 'off', its figures still served. */
function rtOffAfterRunning(over = {}) {
  return rtLive({ on: false, onSince: null, running: false, runningSince: null, state: 'off', ...over });
}

// ─── fixtures: the schedule list (GET /api/scheduled-tasks/list) ───────────────────────────────────────────────────

function entry(over = {}) {
  return {
    id: 'entry-c2a4d900-b5ee-4db6-a2ba-d60453964951',
    taskId: 'reconcileTaggingEdges',
    label: 'Reconcile tagging relationships',
    args: {},
    enabled: true,
    intervalDays: 1,
    intervalHours: 0,
    intervalMinutes: 0,
    cron: '',
    taskName: 'Reconcile tagging relationships',
    timer: { active: true, nextRunAt: '2026-10-01T14:26:18.654Z', lastRunAt: '2026-09-30T14:26:46.911Z' },
    ...over,
  };
}
function otherEntries() {
  return [
    { id: 'legacy:updateAllScoresForOwner', taskId: 'updateAllScoresForOwner', label: 'Update All Scores For Owner', args: {}, enabled: false,
      intervalDays: 0, intervalHours: 7, intervalMinutes: 0, cron: '', taskName: 'Update All Scores For Owner',
      timer: { active: false, nextRunAt: null, lastRunAt: '2026-06-07T21:15:47+00:00' } },
    { id: 'legacy:reconcileAll', taskId: 'reconcileAll', label: 'Reconcile (full)', args: {}, enabled: true,
      intervalDays: 0, intervalHours: 6, intervalMinutes: 0, cron: '', taskName: 'Reconcile (full)',
      timer: { active: true, nextRunAt: '2026-09-30T20:00:00.000Z', lastRunAt: '2026-09-30T14:00:00.000Z' } },
  ];
}
const listBody = (entries) => ({ success: true, entries });

// ─── fixtures: the drift counts (GET /api/tagging-edges/drift-counts) ──────────────────────────────────────────────

const FLAGS = ['passRunning', 'newerUnfinished', 'countsPredatePass', 'waitsForPass', 'pathUnknown'];
/**
 * T5: the five flags are booleans in every case, never null or undefined. countsPredatePass joined them at story 4's
 * review, round 1 (ADR 0004 T5 as amended at c496d853), so every test that calls this helper also pins it.
 */
function flagsAreBooleans(v, what) {
  for (const k of FLAGS) assert(v && typeof v[k] === 'boolean', `${what}.${k} must be a boolean (T5); got ${show(v && v[k])}`);
}
const known = (count, takenAt = '2026-09-30T16:00:00.000Z', ms = 212) => ({ known: true, count, takenAt, ms });
const unknown = (code, takenAt = '2026-09-30T16:00:00.000Z', ms = 10000) => ({ known: false, code, takenAt, ms });
function driftCounts(relay, graph) {
  return { success: true, limitMs: 10000, relay, graph, stamps: { canonical: '82b75e47', local: '8e901369' } };
}

// ─── fixtures (story 5): the starting window (ADR 0005 D7) ─────────────────────────────────────────────────────────

/** The server's recorded off-to-on time for the starting fixtures (the status's onSince, ADR 0005 D4). */
const ON_AT = '2026-10-01T14:02:11.000Z';

/**
 * STARTING (ADR 0005 § Seams, "Browser fixtures"): on, the server's inStartWindow true, its process not running yet.
 * The stored state is whatever the last process wrote (here 'stopped').
 */
function rtStarting(over = {}) {
  return rtLive({ onSince: ON_AT, inStartWindow: true, running: false, runningSince: null, state: 'stopped', ...over });
}

/** STARTING_OLD_PROCESS: on, in the window, a process alive that started before that on (a quick off then on). */
function rtStartingOldProcess(over = {}) {
  const startedAt = '2026-10-01T13:40:00.000Z';
  return rtLive({
    onSince: ON_AT, inStartWindow: true, running: true, runningSince: startedAt, state: 'live',
    process: { pid: 28230, startTime: '1413313189', startedAt }, ...over,
  });
}

// ─── fixtures (story 5): the switch's record (GET /api/tagging-edges/realtime/switch, ADR 0005 D3, D6) ─────────────

const KEY_ADMIN = 'ab12cd34'; // the story's AC-5 example
const KEY_OWNER = 'f0178122'; // ADR 0005 D10's local owner key
const KEY_ADMIN2 = '0badc0de';
const KEYS = [KEY_ADMIN, KEY_OWNER, KEY_ADMIN2];
const AT_LATEST = '2026-10-01T14:02:11.000Z';

/** One change as D3 serves it: { on, at, role, key }; a change not recorded has at, role and key null. */
const entryOf = (on, at, role, key) => ({ on, at, role, key });
const unrecorded = (on) => entryOf(on, null, null, null);

/**
 * The GET's answer (D6): { success, on, switchUnreadable, historyUnreadable, state, latest, history }. By default an
 * admin turned the path off; the history, newest first, holds an earlier owner's on, an off not recorded, and an
 * admin's on (ADR 0005 D3: the history's first row is the latest change).
 */
function recordBody(over = {}) {
  const latest = entryOf(false, AT_LATEST, 'admin', KEY_ADMIN);
  return {
    success: true, on: false, switchUnreadable: false, historyUnreadable: false, state: 'recorded', latest,
    history: [
      latest,
      entryOf(true, '2026-10-01T09:30:00.000Z', 'owner', KEY_OWNER),
      unrecorded(false),
      entryOf(true, '2026-09-29T17:43:18.937Z', 'admin', KEY_ADMIN2),
    ],
    ...over,
  };
}

/** The panel's reads (useRead): { state, body, error, readAt }. A failure after a good answer keeps that body. */
const READ_LOADING = { state: 'loading', body: null, error: null, readAt: null };
const readyRead = (body) => ({ state: 'ready', body: clone(body), error: null, readAt: '2026-10-01T14:02:15.000Z' });
function failedRead(keptBody = null, error = { ok: false, code: 'http-500', httpStatus: 500, body: null }) {
  return { state: 'error', body: keptBody === null ? null : clone(keptBody), error, readAt: keptBody === null ? null : '2026-10-01T14:02:15.000Z' };
}

// ─── reading story 5's answers shape-free (ADR 0005 D12 fixes their content, not their field names) ───────────────

/** Every string value inside `v`, deep (array elements and object values; keys are never read). `skip` is not entered. */
function stringsIn(v, skip = null, out = [], seen = new Set()) {
  if (typeof v === 'string') { out.push(v); return out; }
  if (v && typeof v === 'object') {
    if (seen.has(v) || (skip && v === skip)) return out;
    seen.add(v);
    for (const x of Array.isArray(v) ? v : Object.values(v)) stringsIn(x, skip, out, seen);
  }
  return out;
}
/** Every array inside `v`, deep, `v` itself included. */
function arraysIn(v, out = [], seen = new Set()) {
  if (v && typeof v === 'object' && !seen.has(v)) {
    seen.add(v);
    if (Array.isArray(v)) out.push(v);
    for (const x of Array.isArray(v) ? v : Object.values(v)) arraysIn(x, out, seen);
  }
  return out;
}
/** Every string and every number inside `v`, deep (array elements and object values; keys are never read). `skip` is not entered. */
function leavesIn(v, skip = null, out = [], seen = new Set()) {
  if (typeof v === 'string' || typeof v === 'number') { out.push(v); return out; }
  if (v && typeof v === 'object') {
    if (seen.has(v) || (skip && v === skip)) return out;
    seen.add(v);
    for (const x of Array.isArray(v) ? v : Object.values(v)) leavesIn(x, skip, out, seen);
  }
  return out;
}
/**
 * Does `v` (outside `skip`) carry the record's time `at` (ISO, as D3 serves it)? The view may pass a time through in any
 * form that reads back to the same instant: a string value s with Date.parse(s) === Date.parse(at), a number equal to
 * Date.parse(at), or the ISO text itself inside a longer string. The view reads no clock (TV4) and the panel prints the
 * time in the viewer's locale (parts.jsx when()), so the form is the view's choice; the instant is not.
 */
function carriesTime(v, at, skip = null) {
  const ms = Date.parse(at);
  return leavesIn(v, skip).some((x) => (typeof x === 'number' ? x === ms : x.includes(at) || Date.parse(x) === ms));
}
const ISO_TIME = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
/**
 * Does one shown row carry `entry`: a recorded change's key and time (any form, carriesTime), or, for a change not
 * recorded, no key and no time — no ISO-looking text and none of `history`'s recorded times in any form?
 */
function rowCarries(row, entry, history) {
  const s = stringsIn(row);
  if (entry.key) return s.some((x) => x.includes(entry.key)) && carriesTime(row, entry.at);
  const times = history.filter((e) => e.at).map((e) => e.at);
  return !s.some((x) => ISO_TIME.test(x) || KEYS.some((k) => x.includes(k))) && !times.some((at) => carriesTime(row, at));
}
/**
 * The history the answer shows: an array whose rows carry the record's history newest first — the whole history, or
 * all of it but the latest change, which has its own line. null when the answer shows none.
 */
function shownHistory(v, history) {
  for (const want of [history, history.slice(1)]) {
    if (want.length === 0 || !want.some((e) => e.key)) continue;
    const hit = arraysIn(v).find((a) => a.length === want.length && want.every((e, i) => rowCarries(a[i], e, history)));
    if (hit) return hit;
  }
  return null;
}
/** The answer's text outside the shown history (the latest line and any note), joined. */
const textOutside = (v, history) => stringsIn(v, history || null).join(' | ');
/** The answer's sentences outside the shown history: its string values that hold a space. */
const sentencesOutside = (v, history) => stringsIn(v, history || null).filter((s) => /\s/.test(s)).sort();
/** No sentence in a story 5 answer carries '!' (AC-6, story 4's copy rules; ADR 0005 D13 "no !"). */
function noBang(v, what) {
  const bad = stringsIn(v).filter((s) => s.includes('!'));
  assert(bad.length === 0, `${what}: its sentences must have no "!" (story 4's copy rules, ADR 0005 D13); got ${show(bad)}`);
}
/** After a failed record read, or with a skewed pair, nothing of the record's body is shown (ADR 0005 D12). */
function showsNothingOfTheRecord(v, what) {
  const all = stringsIn(v);
  const keys = KEYS.filter((k) => all.some((s) => s.includes(k)));
  assert(keys.length === 0, `${what}: it must not show the record's latest change or history, so no key appears (ADR 0005 ` +
    `D12 "never renders a kept body's latest line"); found ${show(keys)} in ${show(v)}`);
  const turned = all.filter((s) => /turned (on|off) by/i.test(s));
  assert(turned.length === 0, `${what}: no "Turned … by" line may show (ADR 0005 D12); got ${show(turned)}`);
}

const OUTCOMES = ['done', 'done-unrecorded', 'unknown', 'refused', 'failed'];
/** The outcome switchOutcome names: exactly one of D12's five, as a string value of its answer. */
function outcomeOf(r, what) {
  assert(r && typeof r === 'object', `${what}: switchOutcome must give an answer that names its outcome and carries its ` +
    `sentence (ADR 0005 D12); got ${show(r)}`);
  const names = [...new Set(stringsIn(r).filter((s) => OUTCOMES.includes(s)))];
  assert(names.length === 1, `${what}: the answer must name exactly one of ${show(OUTCOMES)} (ADR 0005 D12); got ${show(r)}`);
  return names[0];
}
/** switchOutcome's sentence: its string values that hold a space (a code such as http-500 holds none). */
const sentenceOf = (r) => stringsIn(r).filter((s) => /\s/.test(s)).join(' ');

// ─── tests ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

/* TV1–TV4: exports and form */

test('TV1: the module exports POLL_MS as 5000 and SCHEDULE_POLL_MS as 60000, the two refresh periods the panel uses by name [AC-5; ADR 0004 § UI]', async () => {
  const poll = await need('POLL_MS', '§ UI');
  const sched = await need('SCHEDULE_POLL_MS', '§ UI');
  assert(poll === 5000, `POLL_MS must be 5000 (a 5 s poll keeps AC-5's "within 10 seconds"); got ${show(poll)}`);
  assert(sched === 60000, `SCHEDULE_POLL_MS must be 60000 (the schedule list is not polled every 5 s); got ${show(sched)}`);
});

const KINDS = ['passOutcome', 'passReason', 'failureStage', 'failureRead', 'refusedReason', 'heldReason',
  'leftInPlaceReason', 'changeKind', 'confirmationWhy', 'pathState', 'setupProblem', 'lastErrorStage',
  'catchUpOutcome', 'catchUpStage', 'notEstablishedReason', 'countCode', 'fetchCode',
  // ADR 0004 T12 (story 4's review, round 1): a pass's own failure.code.
  'failureCode'];

test('TV2: EXPLANATIONS is a frozen map holding one code-to-sentence table for each of the eighteen kinds the ADR lists (the seventeen of § UI, and T12\'s failureCode), and neither the map nor any kind\'s table can be changed [AC-5 "Explanations"; ADR 0004 § UI "a frozen map"; T12]', async () => {
  const ex = await need('EXPLANATIONS', '§ UI');
  assert(ex && typeof ex === 'object' && !Array.isArray(ex), `EXPLANATIONS must be a plain object; got ${show(ex)}`);
  assert(Object.isFrozen(ex), 'EXPLANATIONS must be frozen (Object.isFrozen)');
  const missing = KINDS.filter((k) => !Object.prototype.hasOwnProperty.call(ex, k) || !ex[k] || typeof ex[k] !== 'object');
  assert(missing.length === 0, `EXPLANATIONS lacks a table for the kind(s) ${show(missing)}`);
  const mutable = KINDS.filter((k) => !Object.isFrozen(ex[k]));
  assert(mutable.length === 0, `each kind's table in EXPLANATIONS must be frozen too (a frozen map); not frozen: ${show(mutable)}`);
  for (const k of KINDS) {
    for (const [code, sentence] of Object.entries(ex[k])) {
      assert(typeof sentence === 'string' && sentence.trim() !== '', `EXPLANATIONS.${k}[${show(code)}] must be a non-empty sentence; got ${show(sentence)}`);
    }
  }
});

test('TV3: FAMILIES is a frozen list of { kind, test: RegExp, sentence } entries covering the open code families under fetchCode, countCode and confirmationWhy [AC-5 "Explanations"; ADR 0004 § UI]', async () => {
  const fam = await need('FAMILIES', '§ UI');
  assert(Array.isArray(fam), `FAMILIES must be an array; got ${show(fam)}`);
  assert(Object.isFrozen(fam), 'FAMILIES must be frozen (Object.isFrozen)');
  for (const f of fam) {
    assert(f && typeof f.kind === 'string' && KINDS.includes(f.kind), `a FAMILIES entry must name one of the kinds; got ${show(f && f.kind)}`);
    assert(f.test instanceof RegExp, `a FAMILIES entry's test must be a RegExp; got ${show(f.test)} for kind ${f.kind}`);
    assert(typeof f.sentence === 'string' && f.sentence.trim() !== '', `a FAMILIES entry's sentence must be non-empty; got ${show(f.sentence)}`);
  }
  const kinds = new Set(fam.map((f) => f.kind));
  for (const k of ['fetchCode', 'countCode', 'confirmationWhy']) assert(kinds.has(k), `FAMILIES has no entry for kind ${k}`);
});

test('TV4: the module is plain ESM .js that Node imports as it is — no JSX, no React, only relative import specifiers ending in .js (no alias, no package), no Node-20-only array method, and no clock read (no reference to Date.now or performance.now, no new Date() or Date() with no argument) — all read from its code, not from its sentences [AC-5; ADR 0004 § UI "Form", "Clock"]', async () => {
  const raw = readSafe(VIEW_REL);
  assert(raw !== null, `${VIEW_REL} not implemented yet: it does not exist (ADR 0004 § UI "Form": plain ESM under ui/src/utils/)`);
  await need('explain', '§ UI "Form"'); // importable by this Node
  const { code, strings } = scanModule(raw);
  const lit = (n) => strings[Number(n)];
  const specs = [];
  code.replace(/\bfrom\s*"__S(\d+)__"/g, (m, n) => { specs.push(lit(n)); return m; });
  code.replace(/\bimport\s*\(\s*"__S(\d+)__"/g, (m, n) => { specs.push(lit(n)); return m; });
  code.replace(/\bimport\s*"__S(\d+)__"/g, (m, n) => { specs.push(lit(n)); return m; });
  code.replace(/\brequire\s*\(\s*"__S(\d+)__"/g, (m, n) => { specs.push(lit(n)); return m; });
  assert(!specs.includes('react') && !/\bReact\s*\./.test(code), `${VIEW_REL} must not use React (ADR 0004 § UI "Form")`);
  assert(!/\brequire\s*\(/.test(code), `${VIEW_REL} is ESM: it must not call require() (ADR 0004 § UI "Form")`);
  assert(!/<\/[A-Za-z][\w.]*\s*>/.test(code) && !/<[A-Za-z][\w.]*(\s[^<>]*)?\/>/.test(code),
    `${VIEW_REL} must hold no JSX (ADR 0004 § UI "Form")`);
  const bad = specs.filter((s) => !/^\.\.?\//.test(s) || !/\.js$/.test(s));
  assert(bad.length === 0, `${VIEW_REL} may import only relative .js modules (no alias, no package, no React); found ${show(bad)}`);
  const newer = (code.match(/\.(findLast|findLastIndex|toSorted|toReversed|toSpliced)\s*\(/g) || []);
  assert(newer.length === 0, `${VIEW_REL} must use only Node 16 built-ins; found ${show(newer)}`);
  const clock = (code.match(/\bDate\s*\.\s*now\b|\bperformance\s*\.\s*now\b|\bnew\s+Date\s*\(\s*\)|\bDate\s*\(\s*\)/g) || []);
  assert(clock.length === 0, `${VIEW_REL}'s derivations never read a clock (a captured Date.now counts); found ${show(clock)}`);
});

/* TV5–TV11: explain */

test('TV5: explain(kind, code) for a code the table knows answers { code, text, recognised: true }, the code as given and a sentence that is not the code itself — the pass outcome "done" and the path state "live" [AC-5 "Explanations"; ADR 0004 § UI; T6]', async () => {
  const explain = await explainFn();
  for (const [kind, code] of [['passOutcome', 'done'], ['passOutcome', 'done-removals-held'], ['pathState', 'live'], ['pathState', 'waiting-setup']]) {
    const r = explain(kind, code);
    assert(r && r.recognised === true, `explain(${kind}, ${code}).recognised must be true; got ${show(r)}`);
    assert(r.code === code, `explain(${kind}, ${code}).code must be ${show(code)}; got ${show(r.code)}`);
    assert(typeof r.text === 'string' && r.text.trim() !== '' && r.text !== code && r.text !== 'not recognised',
      `explain(${kind}, ${code}).text must be a sentence other than the code; got ${show(r.text)}`);
    assert(!/!/.test(r.text), `explain(${kind}, ${code}).text must have no "!"; got ${show(r.text)}`);
  }
});

test('TV6: a code the table does not know answers { code, text: "not recognised", recognised: false }, never blank, with the code exactly as given [AC-5 "A code the panel does not know is shown as it is, with not recognised beside it"; ADR 0004 § UI; T6]', async () => {
  const explain = await explainFn();
  for (const [kind, code] of [['passOutcome', 'finished-early'], ['pathState', 'Live'], ['passReason', 'brand-new-reason'], ['fetchCode', '']]) {
    const r = explain(kind, code);
    exactly(r, { code, text: 'not recognised', recognised: false }, `explain(${show(kind)}, ${show(code)})`);
  }
});

test('TV7: the lookup is by own property only — "constructor", "__proto__", "toString", "hasOwnProperty" and "valueOf" are not recognised as codes, and are not recognised as kinds either [AC-5 "Explanations"; ADR 0004 § UI "looked up by own property only"; T6]', async () => {
  const explain = await explainFn();
  for (const code of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
    exactly(explain('passOutcome', code), { code, text: 'not recognised', recognised: false }, `explain('passOutcome', ${show(code)})`);
    exactly(explain('pathState', code), { code, text: 'not recognised', recognised: false }, `explain('pathState', ${show(code)})`);
  }
  for (const kind of ['constructor', '__proto__', 'toString']) {
    exactly(explain(kind, 'done'), { code: 'done', text: 'not recognised', recognised: false }, `explain(${show(kind)}, 'done')`);
  }
});

test('TV8: an unknown kind answers as an unknown code, even for a code another kind knows [AC-5; ADR 0004 § UI; T6 "An unknown kind answers as an unknown code"]', async () => {
  const explain = await explainFn();
  exactly(explain('outcome', 'done'), { code: 'done', text: 'not recognised', recognised: false }, "explain('outcome', 'done')");
  exactly(explain('pathStates', 'live'), { code: 'live', text: 'not recognised', recognised: false }, "explain('pathStates', 'live')");
  exactly(explain(undefined, 'done'), { code: 'done', text: 'not recognised', recognised: false }, "explain(undefined, 'done')");
});

test('TV9: the code is returned exactly as given, a non-string included — a number, null, undefined and an object each come back unchanged, not recognised [AC-5 "shown as it is"; ADR 0004 § UI; T6 "code is returned as given, a non-string included"]', async () => {
  const explain = await explainFn();
  const obj = { code: 'odd' };
  for (const code of [42, null, undefined, obj, true]) {
    const r = explain('passOutcome', code);
    assert(r && r.code === code, `explain('passOutcome', ${show(code)}).code must be the value given (the same value); got ${show(r && r.code)}`);
    assert(r.recognised === false && r.text === 'not recognised', `explain('passOutcome', ${show(code)}) must be not recognised; got ${show(r)}`);
  }
});

test('TV10: each open family of § UI is recognised under its own kind with the full code returned — http-503 (fetchCode); ECONNREFUSED, ETIMEDOUT, Neo.ClientError.Security.Unauthorized, Neo.TransientError.General.DatabaseUnavailable, Neo.DatabaseError.General.UnknownError, ServiceUnavailable and SessionExpired (countCode); "held-file-unreadable EACCES" and "claim failed: ENOSPC" (confirmationWhy) [AC-5 "Explanations"; ADR 0004 § UI FAMILIES; T6]', async () => {
  const explain = await explainFn();
  const cases = [
    ['fetchCode', 'http-503'], ['fetchCode', 'http-404'],
    ['countCode', 'ECONNREFUSED'], ['countCode', 'ETIMEDOUT'],
    ['countCode', 'Neo.ClientError.Security.Unauthorized'],
    ['countCode', 'Neo.TransientError.General.DatabaseUnavailable'],
    ['countCode', 'Neo.DatabaseError.General.UnknownError'],
    ['countCode', 'ServiceUnavailable'], ['countCode', 'SessionExpired'],
    ['confirmationWhy', 'held-file-unreadable EACCES'], ['confirmationWhy', 'claim failed: ENOSPC'],
  ];
  for (const [kind, code] of cases) {
    const r = explain(kind, code);
    assert(r && r.recognised === true, `explain(${kind}, ${show(code)}) must be recognised by its family; got ${show(r)}`);
    assert(r.code === code, `explain(${kind}, ${show(code)}).code must be the whole code as given; got ${show(r.code)}`);
    assert(typeof r.text === 'string' && r.text.trim() !== '' && r.text !== code && r.text !== 'not recognised',
      `explain(${kind}, ${show(code)}).text must be the family's sentence; got ${show(r.text)}`);
  }
});

test('TV11: a family pattern matches only its whole shape and only under its own kind — http-5033, http-50, Http-503, Neo.ClientError.Security, Neo.OtherError.A.B and E (bare) are not recognised; http-503 is not a pass outcome and ECONNREFUSED is not a path state [AC-5; ADR 0004 § UI FAMILIES; T6]', async () => {
  const explain = await explainFn();
  const no = [
    ['fetchCode', 'http-5033'], ['fetchCode', 'http-50'], ['fetchCode', 'Http-503'],
    ['countCode', 'Neo.ClientError.Security'], ['countCode', 'Neo.OtherError.A.B'], ['countCode', 'E'],
    ['passOutcome', 'http-503'], ['pathState', 'ECONNREFUSED'], ['passOutcome', 'held-file-unreadable EACCES'],
    ['confirmationWhy', 'held-file-unreadableEACCES'], ['confirmationWhy', 'claim failed:x'],
  ];
  for (const [kind, code] of no) {
    exactly(explain(kind, code), { code, text: 'not recognised', recognised: false }, `explain(${kind}, ${show(code)})`);
  }
});

/* TV12–TV22: passView and newestFinishedPass */

test('TV12: while a pass runs, passView judges it by statusBody.running alone — the stored pessimistic record (outcome failed, reason code stopped) is never the latest pass and gives no result: latest is null and current is { runId, startedAt, phases, finishing: false } with no outcome or reason [AC-2 "Running now"; ADR 0004 § UI; T1]', async () => {
  const passView = await passViewFn();
  const prev = doneRecord({ runId: '20260930T142619Z-4db0d448' });
  const rec = pessimisticRecord({ phases: phasesUpTo('graph-read') });
  const v = passView(statusBody({ running: true, latest: rec, previous: [prev] }));
  assert(v && v.running === true, `running must be true; got ${show(v && v.running)}`);
  assert(v.latest === null, `latest must be null while running (the stored "failed — stopped" record is not a result); got ${show(v.latest)}`);
  fields(v.current, { runId: rec.runId, startedAt: rec.startedAt, phases: rec.phases, finishing: false }, 'current');
  for (const k of ['outcome', 'reasonCode', 'reason']) {
    assert(v.current[k] === undefined, `current must carry no ${k} while running (it shows no result); got ${show(v.current[k])}`);
  }
  same(v.earlier, [prev], 'earlier (the report\'s previous entries, the running record not among them)');
  assert(v.empty === false, `a running pass is not "no pass yet"; empty was ${show(v.empty)}`);
});

test('TV13: a running pass whose record already has an endedAt is shown as finishing, and still not as a result [AC-2 "Running now"; ADR 0004 § UI "finishing is true when the record already has an endedAt"; T1]', async () => {
  const passView = await passViewFn();
  const rec = doneRecord({ runId: '20260930T151500Z-5eed1e55' });
  const v = passView(statusBody({ running: true, latest: rec }));
  assert(v && v.running === true && v.latest === null, `running true and latest null while alive; got ${show(v && { running: v.running, latest: v.latest })}`);
  fields(v.current, { runId: rec.runId, startedAt: rec.startedAt, phases: rec.phases, finishing: true }, 'current');
});

test('TV14: running is statusBody.running === true and nothing else — a stored running: true on the record, or a running of "true" or 1, does not make it running, and a record left by a kill then reads as the latest pass, failed, stopped [AC-2 "judged by whether it is alive, never by the stored outcome"; ADR 0004 § UI; T1]', async () => {
  const passView = await passViewFn();
  const killed = { ...pessimisticRecord(), running: true };
  const body = { reportVersion: 1, running: false, latest: killed, previous: [], confirmationPending: null };
  const v = passView(body);
  assert(v && v.running === false && v.current === null, `running false and current null; got ${show(v && { running: v.running, current: v.current })}`);
  fields(v.latest, { runId: killed.runId, outcome: 'failed', reasonCode: 'stopped' }, 'latest');
  for (const odd of ['true', 1]) {
    const w = passView({ ...body, running: odd });
    assert(w && w.running === false, `running ${show(odd)} must not count as running; got ${show(w && w.running)}`);
  }
});

test('TV15: when no pass runs, latest is the report\'s latest record with every figure the panel shows — taggings read, added, changed, removed, unchanged, left in place, refused, held, people added, start, end and duration — and earlier keeps the report\'s order, newest first [AC-2 "The latest pass"; ADR 0004 § UI "The pass\'s figures"; T1]', async () => {
  const passView = await passViewFn();
  const latest = heldRecord();
  const p1 = failedWriteRecord({ runId: '20260928T030000Z-11111111', startedAt: '2026-09-28T03:00:00.000Z' });
  const p2 = doneRecord({ runId: '20260927T030000Z-22222222', startedAt: '2026-09-27T03:00:00.000Z' });
  const body = statusBody({ latest, previous: [p1, p2] });
  const v = passView(body);
  assert(v && v.running === false && v.current === null, `running false and current null; got ${show(v && { running: v.running, current: v.current })}`);
  fields(v.latest, {
    runId: latest.runId, outcome: 'done-removals-held', reasonCode: 'removals-held',
    taggingsRead: 7031, peopleAdded: 0, startedAt: latest.startedAt, endedAt: latest.endedAt, durationMs: 6360,
    relationships: latest.relationships, refused: latest.refused, held: latest.held,
  }, 'latest');
  same(v.earlier.map((r) => r.runId), [p1.runId, p2.runId], 'earlier run ids, newest first');
  assert(v.empty === false, `empty must be false; got ${show(v.empty)}`);
});

test('TV16: earlier is [] when the report has no previous list, and the latest pass alone is not "no pass yet" [AC-2; ADR 0004 § UI; T1]', async () => {
  const passView = await passViewFn();
  const body = statusBody({ latest: doneRecord() });
  delete body.previous;
  const v = passView(body);
  same(v && v.earlier, [], 'earlier');
  assert(v.empty === false, `empty must be false with a latest pass; got ${show(v.empty)}`);
});

test('TV17: empty is true only when the report holds no pass at all (latest null, previous empty); a running first pass is not empty, and neither is a report with only earlier passes [AC-2 "No pass yet"; ADR 0004 § UI; T1]', async () => {
  const passView = await passViewFn();
  const none = passView(statusBody({ latest: null, previous: [] }));
  assert(none && none.empty === true, `a report with no pass must be empty; got ${show(none && none.empty)}`);
  assert(none.latest === null && none.current === null && none.running === false, `and shows no latest or current pass; got ${show(none)}`);
  const first = passView(statusBody({ running: true, latest: pessimisticRecord(), previous: [] }));
  assert(first && first.empty === false, `a running first pass is not "no pass yet"; empty was ${show(first && first.empty)}`);
  const onlyEarlier = passView({ reportVersion: 1, running: false, latest: null, previous: [doneRecord()], confirmationPending: null });
  assert(onlyEarlier && onlyEarlier.empty === false, `a report holding earlier passes is not empty; got ${show(onlyEarlier && onlyEarlier.empty)}`);
});

test('TV18: passView of null, a string or a number is null [ADR 0004 § UI; T1 "A null or non-object statusBody gives null"]', async () => {
  const passView = await passViewFn();
  for (const bad of [null, undefined, 'status', 42]) {
    assert(passView(bad) === null, `passView(${show(bad)}) must be null; got ${show(passView(bad))}`);
  }
});

test('TV19: the confirmation has five states, checked in order — none (null), unreadable ({ unreadable: "EACCES", expired: false } as the route serves it), expired (expired true, even with an unparseable expiresAt), unknown-expiry (an expiresAt that does not parse), else pending with its run id and expiry [AC-2 "Confirmation"; ADR 0004 § UI; T1]', async () => {
  const passView = await passViewFn();
  const withConf = (c) => passView(statusBody({ latest: heldRecord(), confirmationPending: c })).confirmation;
  exactly(withConf(null), { state: 'none' }, 'confirmation for null');
  fields(withConf({ unreadable: 'EACCES', expired: false }), { state: 'unreadable', code: 'EACCES' }, 'confirmation for { unreadable: "EACCES" }');
  fields(withConf({ ...PENDING_CONFIRMATION, unreadable: 'EIO', expired: true }), { state: 'unreadable', code: 'EIO' }, 'unreadable before expired');
  fields(withConf({ ...PENDING_CONFIRMATION, expired: true }),
    { state: 'expired', runId: PENDING_CONFIRMATION.runId, expiresAt: PENDING_CONFIRMATION.expiresAt }, 'confirmation expired');
  fields(withConf({ ...PENDING_CONFIRMATION, expiresAt: 'soon', expired: true }),
    { state: 'expired', runId: PENDING_CONFIRMATION.runId }, 'expired before unknown-expiry');
  fields(withConf({ ...PENDING_CONFIRMATION, expiresAt: 'soon', expired: false }),
    { state: 'unknown-expiry', runId: PENDING_CONFIRMATION.runId }, 'confirmation with an unparseable expiresAt');
  fields(withConf({ ...PENDING_CONFIRMATION, expiresAt: undefined, expired: false }),
    { state: 'unknown-expiry', runId: PENDING_CONFIRMATION.runId }, 'confirmation with no expiresAt');
  fields(withConf({ ...PENDING_CONFIRMATION }),
    { state: 'pending', runId: PENDING_CONFIRMATION.runId, expiresAt: PENDING_CONFIRMATION.expiresAt }, 'confirmation pending');
});

test('TV20: the confirmation never reads the client clock — with Date.now stubbed to 2099 a record the server calls unexpired stays pending, with it stubbed to 1970 an expired one stays expired, and Date.now is never called [AC-2 "Confirmation"; ADR 0004 § UI "It never reads the client clock", "Clock"; T1]', async () => {
  const passView = await passViewFn();
  await withClock(Date.parse('2099-01-01T00:00:00Z'), async (calls) => {
    const v = passView(statusBody({ latest: heldRecord(), confirmationPending: { ...PENDING_CONFIRMATION } }));
    fields(v && v.confirmation, { state: 'pending', runId: PENDING_CONFIRMATION.runId, expiresAt: PENDING_CONFIRMATION.expiresAt },
      'confirmation with the client clock in 2099');
    assert(calls.n === 0, `passView must not call Date.now; it was called ${calls.n} time(s)`);
  });
  await withClock(0, async (calls) => {
    const v = passView(statusBody({ latest: heldRecord(), confirmationPending: { ...PENDING_CONFIRMATION, expired: true } }));
    fields(v && v.confirmation, { state: 'expired' }, 'confirmation with the client clock in 1970');
    assert(calls.n === 0, `passView must not call Date.now; it was called ${calls.n} time(s)`);
  });
});

test('TV21: newestFinishedPass returns the latest record itself (the same object) when it is done or done-removals-held and no pass runs [AC-4 "the newest finished pass"; ADR 0004 § UI; T2]', async () => {
  const newest = await newestFn();
  for (const latest of [doneRecord(), heldRecord()]) {
    const body = statusBody({ latest, previous: [doneRecord({ runId: '20260929T030000Z-33333333' })] });
    const got = newest(body);
    assert(got === body.latest, `newestFinishedPass must return statusBody.latest itself for outcome ${latest.outcome}; got ${show(got && got.runId)}`);
  }
});

test('TV22: newestFinishedPass skips a running latest (even one already reading done), and a failed or refused one, for the first done or done-removals-held in previous — the same object — and is null when there is none [AC-4 "When the latest pass is not finished"; ADR 0004 § UI; T2]', async () => {
  const newest = await newestFn();
  const fin = doneRecord({ runId: '20260929T030000Z-44444444' });
  const held = heldRecord();
  let body = statusBody({ running: true, latest: pessimisticRecord(), previous: [fin] });
  assert(newest(body) === body.previous[0], `running: must return previous[0]; got ${show(newest(body) && newest(body).runId)}`);
  body = statusBody({ running: true, latest: doneRecord({ runId: '20260930T151500Z-5eed1e55' }), previous: [fin] });
  assert(newest(body) === body.previous[0], `a running latest that already reads done is not taken; got ${show(newest(body) && newest(body).runId)}`);
  body = statusBody({ latest: failedWriteRecord(), previous: [refusedRecord(), failedReadRecord(), held, fin] });
  assert(newest(body) === body.previous[2], `failed latest: must skip refused and failed to the done-removals-held; got ${show(newest(body) && newest(body).runId)}`);
  body = statusBody({ latest: refusedRecord(), previous: [failedReadRecord()] });
  assert(newest(body) === null, `no finished pass: must be null; got ${show(newest(body))}`);
  body = statusBody({ latest: null, previous: [] });
  assert(newest(body) === null, `an empty report: must be null; got ${show(newest(body))}`);
});

/* TV23–TV33: pathView */

test('TV23: before the path\'s first start every figure is "not yet available", not 0 — started false, and counts, gauges, countsSince, lastCatchUp, setupProblemKey and lastError null, with state off and lastFigures null while the path is off [AC-3 "Values not yet produced"; ADR 0004 § UI "Nulls"; T3]', async () => {
  const pathView = await pathViewFn();
  const v = pathView(rtNeverStarted());
  fields(v, {
    on: false, running: false, onButNotRunning: false, started: false, state: 'off', warnings: [],
    countsSince: null, lastFigures: null, counts: null, gauges: null, lastCatchUp: null, setupProblemKey: null, lastError: null,
  }, 'pathView(never started)');
});

test('TV24: a path switched on whose process is not running is onButNotRunning, and its stored state is not shown as current even when it reads live — state is null; switched on before any start, it is not started either [AC-3 "On but not running"; ADR 0004 § UI; T3]', async () => {
  const pathView = await pathViewFn();
  const killed = pathView(rtLive({ running: false, runningSince: null, state: 'live' }));
  fields(killed, { on: true, running: false, onButNotRunning: true, state: null, started: true, lastFigures: null }, 'pathView(on, killed, stored live)');
  const early = pathView(rtNeverStarted({ on: true, onSince: '2026-09-30T14:26:35.366Z', state: null }));
  fields(early, { on: true, running: false, onButNotRunning: true, state: null, started: false, counts: null, gauges: null }, 'pathView(on, not yet started)');
});

test('TV25: a path on and running shows its state as the status gives it — live as staging served it, and catching-up, waiting-relay and stopped too — with no warning, counts since the first start and no last figures [AC-3 "Running"; ADR 0004 § UI; T3]', async () => {
  const pathView = await pathViewFn();
  const body = rtLive();
  fields(pathView(body), {
    on: true, running: true, onButNotRunning: false, started: true, state: 'live', warnings: [],
    countsSince: { from: 'first-start', at: body.firstStartedAt }, lastFigures: null,
    gauges: { parked: 0, pending: 0 }, lastCatchUp: CATCH_UP_LAST, setupProblemKey: null, lastError: null,
  }, 'pathView(staging live)');
  for (const state of ['catching-up', 'waiting-relay', 'waiting-graph', 'starting', 'stopped']) {
    fields(pathView(rtLive({ state })), { state, onButNotRunning: false }, `pathView(running, ${state})`);
  }
});

test('TV26: with the path off, state is "off" even while its process is still alive, and the figures it produced before are its last figures, with the time they were written [AC-3 "While the path is off, the figures it produced before are still shown, labelled as its last figures"; ADR 0004 § UI; T3]', async () => {
  const pathView = await pathViewFn();
  const off = rtOffAfterRunning();
  fields(pathView(off), { on: false, running: false, onButNotRunning: false, started: true, state: 'off', lastFigures: { updatedAt: off.updatedAt } },
    'pathView(off after running)');
  const stopping = rtOffAfterRunning({ running: true, runningSince: '2026-09-30T14:26:36.170Z' });
  fields(pathView(stopping), { on: false, running: true, onButNotRunning: false, state: 'off', lastFigures: { updatedAt: stopping.updatedAt } },
    'pathView(off, process still alive)');
});

test('TV27: warnings lists, in the order stale, statusUnreadable, switchUnreadable, those whose field is true, and is [] when none is [AC-3 "Warnings"; ADR 0004 § UI; T3]', async () => {
  const pathView = await pathViewFn();
  same(pathView(rtLive({ stale: true, statusUnreadable: true, switchUnreadable: true })).warnings,
    ['stale', 'statusUnreadable', 'switchUnreadable'], 'warnings, all three');
  same(pathView(rtLive({ stale: true })).warnings, ['stale'], 'warnings, stale');
  same(pathView(rtNeverStarted({ switchUnreadable: true })).warnings, ['switchUnreadable'], 'warnings, switch unreadable');
  same(pathView(rtNeverStarted({ statusUnreadable: true, running: false })).warnings, ['statusUnreadable'], 'warnings, status unreadable');
  same(pathView(rtLive({ stale: false, switchUnreadable: false })).warnings, [], 'warnings, none');
});

test('TV28: counts maps the status\'s counts one to one — added, changed, removed, unchanged, people added, refused taggings counted at each look, failed reads by kind with their total, database refusals, removals not prompted and changes dropped over the backlog — and gauges are parked and pending [AC-3 "What it has done", "As it stands now"; ADR 0004 § UI "Counts and gauges are separate"; T3]', async () => {
  const pathView = await pathViewFn();
  const body = rtLive({
    counts: pathCounts({
      added: 11, changed: 12, removed: 13, unchanged: 14, peopleAdded: 15,
      refused: { total: 16, byReason: { 'no-target': 16 } },
      failedReads: { relay: 1, graph: 2, element: 3, catchUp: 4 },
      dbRefused: { total: 17, byReason: { 'Neo.ClientError.Schema.ConstraintValidationFailed': 17 } },
      removalsNotPrompted: 18, droppedOverBacklog: 19,
    }),
    parked: 7, pending: 21,
  });
  const v = pathView(body);
  fields(v && v.counts, {
    added: 11, changed: 12, removed: 13, unchanged: 14, peopleAdded: 15, refusedLooks: 16,
    failedReads: { relay: 1, graph: 2, element: 3, catchUp: 4, total: 10 },
    dbRefused: 17, removalsNotPrompted: 18, droppedOverBacklog: 19,
  }, 'counts');
  exactly(v.gauges, { parked: 7, pending: 21 }, 'gauges');
});

test('TV29: counts reset because the path\'s status was lost run from the reset, which has no time — countsSince is { from: "reset", at: null } — and a status with counts but no firstStartedAt is still started [AC-3 "When they were reset…the panel says so, and that they run from the reset"; ADR 0004 § UI "countsSince"; T3]', async () => {
  const pathView = await pathViewFn();
  const reset = pathView(rtLive({ counts: { ...pathCounts({ added: 0 }), countsReset: true } }));
  fields(reset, { started: true, countsSince: { from: 'reset', at: null } }, 'pathView(countsReset)');
  const noFirst = pathView(rtLive({ firstStartedAt: null, counts: { ...pathCounts(), countsReset: true } }));
  fields(noFirst, { started: true, countsSince: { from: 'reset', at: null } }, 'pathView(countsReset, no firstStartedAt)');
  assert(noFirst.counts !== null && noFirst.gauges !== null, `a started path has counts and gauges; got ${show({ counts: noFirst.counts, gauges: noFirst.gauges })}`);
});

test('TV30: a setup problem is keyed identity:<problem> or schema:<rule>:<problem> — identity local not-64-hex from env TA_PUBKEY, identity canonical missing, schema tags_address not-online, schema nostrUser_pubkey missing — and is null without one [AC-3 "Problems"; ADR 0004 § UI "A setup problem"; T3]', async () => {
  const pathView = await pathViewFn();
  const key = (sp) => pathView(rtLive({ state: 'waiting-setup', setupProblem: sp })).setupProblemKey;
  assert(key({ kind: 'identity', identity: 'local', problem: 'not-64-hex', source: 'env TA_PUBKEY' }) === 'identity:not-64-hex',
    `identity problem key; got ${show(key({ kind: 'identity', identity: 'local', problem: 'not-64-hex', source: 'env TA_PUBKEY' }))}`);
  assert(key({ kind: 'identity', identity: 'canonical', problem: 'missing', source: 'profile-tags' }) === 'identity:missing',
    `identity missing key; got ${show(key({ kind: 'identity', identity: 'canonical', problem: 'missing', source: 'profile-tags' }))}`);
  assert(key({ kind: 'schema', rule: 'tags_address', problem: 'not-online' }) === 'schema:tags_address:not-online',
    `schema problem key; got ${show(key({ kind: 'schema', rule: 'tags_address', problem: 'not-online' }))}`);
  assert(key({ kind: 'schema', rule: 'nostrUser_pubkey', problem: 'missing' }) === 'schema:nostrUser_pubkey:missing',
    `schema missing key; got ${show(key({ kind: 'schema', rule: 'nostrUser_pubkey', problem: 'missing' }))}`);
  assert(key(null) === null, `no setup problem: key must be null; got ${show(key(null))}`);
});

test('TV31: lastError is the status\'s lastError as served, and lastCatchUp is catchUp.last, or null when there is no last catch-up [AC-3 "Problems", "Its last catch-up"; ADR 0004 § UI; T3]', async () => {
  const pathView = await pathViewFn();
  const err = { at: '2026-09-30T15:00:00.000Z', stage: 'graph-read', code: 'ServiceUnavailable', text: 'the graph could not be read' };
  const v = pathView(rtLive({ state: 'waiting-graph', lastError: err }));
  same(v && v.lastError, err, 'lastError');
  same(v.lastCatchUp, CATCH_UP_LAST, 'lastCatchUp');
  const failedCu = { outcome: 'failed', startedAt: '2026-09-30T15:00:00.000Z', endedAt: '2026-09-30T15:00:10.000Z', durationMs: 10000,
    reflected: { added: 0, changed: 0, removed: 0, unchanged: 0 }, stage: 'relay-read' };
  same(pathView(rtLive({ catchUp: { underway: false, current: null, last: failedCu } })).lastCatchUp, failedCu, 'lastCatchUp (failed)');
  assert(pathView(rtLive({ catchUp: { underway: true, current: { startedAt: '2026-09-30T15:00:00.000Z' }, last: null } })).lastCatchUp === null,
    'lastCatchUp must be null with no last catch-up');
  assert(pathView(rtLive({ catchUp: null })).lastCatchUp === null, 'lastCatchUp must be null with no catchUp');
});

test('TV32: pathView of null, undefined, a string or a number is null [ADR 0004 § UI; T3 "A null or non-object rtBody gives null"]', async () => {
  const pathView = await pathViewFn();
  for (const bad of [null, undefined, 'status', 7]) {
    assert(pathView(bad) === null, `pathView(${show(bad)}) must be null; got ${show(pathView(bad))}`);
  }
});

test('TV33: pathView never reads the client clock — with Date.now stubbed far ahead, a status the server calls fresh gives no stale warning, and Date.now is never called [AC-3 "Warnings" (stale as the server reports it); ADR 0004 § UI "Clock", "as the server reports them"; T3]', async () => {
  const pathView = await pathViewFn();
  await withClock(Date.parse('2099-01-01T00:00:00Z'), async (calls) => {
    same(pathView(rtLive()).warnings, [], 'warnings with the client clock in 2099');
    assert(calls.n === 0, `pathView must not call Date.now; it was called ${calls.n} time(s)`);
  });
});

/* TV34–TV44: scheduleView */

/** T4's "every N day(s)" leaves N = 1 open: "every 1 day" and "every 1 days" are both accepted; anything else is compared to `want`. */
const oneUnit = (got, want) => (typeof got === 'string' && got === `${want}s` ? got : want);

test('TV34: one enabled "Reconcile tagging relationships" entry among other tasks, as on staging, is verdict one — its interval text, its next run, scheduled, and not weaker than daily for a daily interval [AC-2 "The backstop schedule — One"; ADR 0004 § UI; T4]', async () => {
  const scheduleView = await scheduleViewFn();
  const v = scheduleView(listBody([...otherEntries(), entry()]));
  exactly(v, {
    verdict: 'one', enabledCount: 1, disabledCount: 0, intervalText: oneUnit(v && v.intervalText, 'every 1 day'),
    nextRunAt: '2026-10-01T14:26:18.654Z', unscheduled: false, weakerThanDaily: false,
  }, 'scheduleView(staging list)');
});

test('TV35: only entries whose taskId is reconcileTaggingEdges count — another task labelled "Reconcile tagging relationships" does not — and an entry counts as enabled only when enabled === true; with none enabled the verdict is none, and disabledCount says how many disabled entries exist [AC-2 "None enabled"; ADR 0004 § UI; T4]', async () => {
  const scheduleView = await scheduleViewFn();
  const lookalike = entry({ id: 'entry-x', taskId: 'reconcileAll', label: 'Reconcile tagging relationships' });
  exactly(scheduleView(listBody([...otherEntries(), lookalike])), {
    verdict: 'none', enabledCount: 0, disabledCount: 0, intervalText: null, nextRunAt: null, unscheduled: false, weakerThanDaily: false,
  }, 'scheduleView(no reconcileTaggingEdges entry)');
  const disabled = entry({ enabled: false, timer: { active: false, nextRunAt: null, lastRunAt: null } });
  const stringy = entry({ id: 'entry-y', enabled: 'true' });
  exactly(scheduleView(listBody([...otherEntries(), disabled, stringy])), {
    verdict: 'none', enabledCount: 0, disabledCount: 2, intervalText: null, nextRunAt: null, unscheduled: false, weakerThanDaily: false,
  }, 'scheduleView(two disabled entries, one with enabled "true")');
  exactly(scheduleView(listBody([])), {
    verdict: 'none', enabledCount: 0, disabledCount: 0, intervalText: null, nextRunAt: null, unscheduled: false, weakerThanDaily: false,
  }, 'scheduleView(no entries)');
});

test('TV36: more than one enabled entry is verdict several with the count, and disabled entries are still counted; the one-entry fields are null and false [AC-2 "More than one"; ADR 0004 § UI; T4]', async () => {
  const scheduleView = await scheduleViewFn();
  const v = scheduleView(listBody([entry(), entry({ id: 'entry-2', intervalDays: 0, intervalHours: 6 }), entry({ id: 'entry-3', enabled: false })]));
  exactly(v, {
    verdict: 'several', enabledCount: 2, disabledCount: 1, intervalText: null, nextRunAt: null, unscheduled: false, weakerThanDaily: false,
  }, 'scheduleView(two enabled, one disabled)');
});

test('TV37: one enabled entry with no next run (timer.nextRunAt null: the scheduler has none, or could not be asked) is unscheduled, and a disabled sibling is still counted [AC-2 "If it has no next run, a warning that it is enabled but not scheduled"; ADR 0004 § UI; T4]', async () => {
  const scheduleView = await scheduleViewFn();
  const v = scheduleView(listBody([entry({ timer: { active: false, nextRunAt: null, lastRunAt: '2026-09-30T14:26:46.911Z' } }), entry({ id: 'entry-3', enabled: false })]));
  fields(v, { verdict: 'one', enabledCount: 1, disabledCount: 1, nextRunAt: null, unscheduled: true }, 'scheduleView(enabled, no next run)');
});

test('TV38: the interval text is the sum in the largest whole unit — every 1 day, every 2 days, every 30 hours for 1 day 6 hours, every 1 day for 24 hours, every 6 hours, every 1 hour, every 90 minutes, every 1 minute (for N = 1 the plural is also accepted) — with string and missing fields read as numbers and 0, and an absent or null cron leaving the interval in charge without throwing [AC-2 "Its interval"; ADR 0004 § UI; T4; scheduler.js toRepeatOpts]', async () => {
  const scheduleView = await scheduleViewFn();
  const text = (f) => scheduleView(listBody([entry({ intervalDays: undefined, intervalHours: undefined, intervalMinutes: undefined, ...f })])).intervalText;
  const cases = [
    [{ intervalDays: 1 }, 'every 1 day'],
    [{ intervalDays: 2, intervalHours: 0, intervalMinutes: 0 }, 'every 2 days'],
    [{ intervalDays: 1, intervalHours: 6 }, 'every 30 hours'],
    [{ intervalHours: 24 }, 'every 1 day'],
    [{ intervalHours: '6' }, 'every 6 hours'],
    [{ intervalHours: 1, intervalMinutes: 0 }, 'every 1 hour'],
    [{ intervalHours: 1, intervalMinutes: 30 }, 'every 90 minutes'],
    [{ intervalMinutes: 1 }, 'every 1 minute'],
  ];
  for (const [f, want] of cases) {
    const got = text(f);
    assert(got === oneUnit(got, want), `interval text for ${show(f)}: expected ${show(want)}, got ${show(got)}`);
  }
  // cron absent or null leaves the interval fields in charge, and reading it does not throw (scheduler.js toRepeatOpts)
  for (const [f, want, weaker] of [[{ cron: undefined, intervalDays: 2 }, 'every 2 days', true], [{ cron: null, intervalHours: 6 }, 'every 6 hours', false]]) {
    let v;
    try { v = scheduleView(listBody([entry({ intervalDays: undefined, intervalHours: undefined, intervalMinutes: undefined, ...f })])); } catch (e) {
      throw new Error(`scheduleView must not throw for an entry with cron ${show(f.cron)}; it threw ${e && e.message}`);
    }
    fields(v, { intervalText: want, weakerThanDaily: weaker }, `scheduleView(cron ${f.cron === null ? 'null' : 'absent'}, ${show(f)})`);
  }
});

test('TV39: an interval is weaker than daily only when it is over 1,440 minutes — 1 day and 24 hours are not; 1 day 1 minute, 25 hours, 2 days and 7 days with the other fields missing are [AC-2 "If it runs less often than daily, a warning"; ADR 0004 § UI "Weaker than daily"; T4]', async () => {
  const scheduleView = await scheduleViewFn();
  const weaker = (f) => scheduleView(listBody([entry({ intervalDays: undefined, intervalHours: undefined, intervalMinutes: undefined, ...f })])).weakerThanDaily;
  for (const f of [{ intervalDays: 1 }, { intervalHours: 24 }, { intervalHours: 6 }, { intervalDays: 0, intervalHours: 23, intervalMinutes: 60 }]) {
    assert(weaker(f) === false, `${show(f)} is not weaker than daily; got ${show(weaker(f))}`);
  }
  for (const f of [{ intervalDays: 1, intervalMinutes: 1 }, { intervalHours: 25 }, { intervalDays: 2 }, { intervalDays: 7 }, { intervalDays: '3' }]) {
    assert(weaker(f) === true, `${show(f)} is weaker than daily; got ${show(weaker(f))}`);
  }
});

test('TV40: a non-blank cron wins over the interval fields — its trimmed text is the interval text and only it decides the verdict — while a blank cron leaves the interval in charge [AC-2; ADR 0004 § UI "a non-blank cron wins"; T4]', async () => {
  const scheduleView = await scheduleViewFn();
  let v = scheduleView(listBody([entry({ cron: '  0 3 * * *  ', intervalDays: 7 })]));
  fields(v, { intervalText: '0 3 * * *', weakerThanDaily: false }, 'cron daily over a 7-day interval');
  v = scheduleView(listBody([entry({ cron: '0 3 * * 1', intervalDays: 0, intervalHours: 1 })]));
  fields(v, { intervalText: '0 3 * * 1', weakerThanDaily: true }, 'cron weekly over a 1-hour interval');
  v = scheduleView(listBody([entry({ cron: '   ', intervalDays: 2 })]));
  fields(v, { intervalText: 'every 2 days', weakerThanDaily: true }, 'blank cron');
});

test('TV41: the cron rule — @hourly and @daily are not weaker than daily; @weekly, @monthly and @yearly are [AC-2; ADR 0004 § UI "Weaker than daily"; T4]', async () => {
  const scheduleView = await scheduleViewFn();
  const weaker = (cron) => scheduleView(listBody([entry({ cron })])).weakerThanDaily;
  for (const c of ['@hourly', '@daily']) assert(weaker(c) === false, `${c} is not weaker than daily; got ${show(weaker(c))}`);
  for (const c of ['@weekly', '@monthly', '@yearly']) assert(weaker(c) === true, `${c} is weaker than daily; got ${show(weaker(c))}`);
});

test('TV42: a 5- or 6-field cron is not weaker than daily when each of its last three fields is *, ?, */1 or that field\'s full range (1-31, 1-12, 0-6, 0-7, 1-7), its fields split on any run of whitespace (two spaces, a tab), its interval text the trimmed cron as written [AC-2; ADR 0004 § UI "trim it and split it on whitespace", "Weaker than daily"; T4]', async () => {
  const scheduleView = await scheduleViewFn();
  const weaker = (cron) => scheduleView(listBody([entry({ cron })])).weakerThanDaily;
  for (const c of ['0 3 * * *', '*/15 * * * *', '0 0 3 * * *', '0 3 ? * *', '0 3 */1 * *', '0 3 1-31 1-12 0-6', '0 3 * * 0-7',
    '0 0 3 ? * 1-7', '30 2 * */1 ?', '0 0 3 1-31 * *']) {
    assert(weaker(c) === false, `${show(c)} is not weaker than daily; got ${show(weaker(c))}`);
  }
  for (const c of ['0  3\t* * *', '0 3 *  * *', '\t0 3 * *\t* ']) {
    const v = scheduleView(listBody([entry({ cron: c, intervalDays: 7 })]));
    fields(v, { intervalText: c.trim(), weakerThanDaily: false }, `scheduleView(cron ${show(c)}: split on any whitespace)`);
  }
});

test('TV43: any other cron warns as weaker than daily — a day of week (0 3 * * 1), a day of month (0 3 1 * *), a month (0 3 * 6 *), a range that is not its field\'s full one (0 3 1-12 * *), a 6-field weekly, @reboot, 4 or 7 fields, and garbage [AC-2; ADR 0004 § UI "Any other shape warns"; T4]', async () => {
  const scheduleView = await scheduleViewFn();
  const weaker = (cron) => scheduleView(listBody([entry({ cron })])).weakerThanDaily;
  for (const c of ['0 3 * * 1', '0 3 1 * *', '0 3 * 6 *', '0 3 1-12 * *', '0 0 3 * * 1', '@reboot', '0 3 * *', '0 0 3 * * * 2026', 'garbage', 'every day']) {
    assert(weaker(c) === true, `${show(c)} is weaker than daily; got ${show(weaker(c))}`);
  }
});

test('TV44: scheduleView of null, a string, or a body whose entries is not an array is null [ADR 0004 § UI; T4]', async () => {
  const scheduleView = await scheduleViewFn();
  for (const bad of [null, undefined, 'list', { success: true }, { success: true, entries: null }, { success: true, entries: {} }]) {
    assert(scheduleView(bad) === null, `scheduleView(${show(bad)}) must be null; got ${show(scheduleView(bad))}`);
  }
});

/* TV45–TV58: driftView */

test('TV45: the story\'s example — 5 refused taggings on the relay, 1 held removal and 1 relationship left in place in the graph — reads difference 3, explained 3 (5 − 1 − 1), unexplained 0, explained by that pass with its run id and end time [AC-4 "Example"; ADR 0004 § UI "The arithmetic"; T5]', async () => {
  const driftView = await driftViewFn();
  const held = heldRecord();
  const counts = driftCounts(known(7031), known(7028));
  const v = driftView(counts, statusBody({ latest: held }), rtOffAfterRunning());
  fields(v, {
    known: true, relay: counts.relay, graph: counts.graph, difference: 3, explained: 3, unexplained: 0, explainedReason: null,
    explainedBy: { runId: held.runId, endedAt: held.endedAt, usedInsteadOfLatest: false }, leftToNextPass: 0, passRunning: false,
  }, 'driftView(story example)');
});

test('TV46: after a clean pass (done, "the graph agrees with the relay") with nothing changed since, unexplained reads 0 [AC-4 "A clean pass"; ADR 0004 § UI; T5]', async () => {
  const driftView = await driftViewFn();
  const v = driftView(driftCounts(known(7026), known(7026)), statusBody({ latest: doneRecord() }), rtLive());
  fields(v, { known: true, difference: 0, explained: 0, unexplained: 0, explainedReason: null, leftToNextPass: 0 }, 'driftView(clean pass)');
});

test('TV47: the difference is relay minus graph and can be negative; unexplained is the difference minus the explained part [AC-4 "What it shows"; ADR 0004 § UI; T5]', async () => {
  const driftView = await driftViewFn();
  const v = driftView(driftCounts(known(7020), known(7026)), statusBody({ latest: heldRecord() }), rtLive());
  fields(v, { known: true, difference: -6, explained: 3, unexplained: -9 }, 'driftView(graph ahead)');
});

test('TV48: an unknown count is never 0 — with either count unknown (a timeout, an ECONNREFUSED, an unparseable answer) known is false and the difference, explained part, remainder, explainedBy and explainedReason are all null, with the answer\'s count objects passed through, and the five flags still booleans [AC-4 "Unknown, never 0"; ADR 0004 § UI "Unknown counts"; T5]', async () => {
  const driftView = await driftViewFn();
  const cases = [
    driftCounts(known(7026), unknown('timeout')),
    driftCounts(unknown('ECONNREFUSED', '2026-09-30T16:00:00.000Z', 3), known(7026)),
    driftCounts(unknown('unparseable', '2026-09-30T16:00:00.000Z', 40), unknown('Neo.ClientError.Security.Unauthorized', '2026-09-30T16:00:00.000Z', 12)),
  ];
  for (const counts of cases) {
    const v = driftView(counts, statusBody({ latest: heldRecord() }), rtLive());
    fields(v, {
      known: false, relay: counts.relay, graph: counts.graph,
      difference: null, explained: null, unexplained: null, explainedBy: null, explainedReason: null,
    }, `driftView(${show({ relay: counts.relay.known, graph: counts.graph.known })})`);
    flagsAreBooleans(v, `driftView(${show({ relay: counts.relay.known, graph: counts.graph.known })})`);
  }
});

test('TV49: a failed drift-counts read (counts null) makes both counts unknown with no code — { known: false, code: null } — and no difference [AC-4 "Unknown, never 0"; AC-5 "When a read fails"; ADR 0004 § UI "A failed drift-counts read makes both counts unknown"; T5]', async () => {
  const driftView = await driftViewFn();
  const v = driftView(null, statusBody({ latest: doneRecord() }), rtLive());
  fields(v, {
    known: false, relay: { known: false, code: null }, graph: { known: false, code: null },
    difference: null, explained: null, unexplained: null, explainedBy: null, explainedReason: null,
  }, 'driftView(null counts)');
  flagsAreBooleans(v, 'driftView(null counts)');
});

test('TV50: with the pass report unavailable (statusBody null) no part is explained — explained null, explainedReason report-unavailable, and the whole difference unexplained — and passRunning and newerUnfinished are false, not null [T5 "booleans"; AC-4 "No finished pass…says why"; ADR 0004 § UI "When no part can be explained"; T5]', async () => {
  const driftView = await driftViewFn();
  const v = driftView(driftCounts(known(7031), known(7028)), null, rtLive());
  fields(v, { known: true, difference: 3, explained: null, unexplained: 3, explainedReason: 'report-unavailable', leftToNextPass: null }, 'driftView(no report)');
  assert(v.explainedBy == null, `explainedBy must be null without an explaining pass; got ${show(v.explainedBy)}`);
  flagsAreBooleans(v, 'driftView(no report)');
  assert(v.passRunning === false && v.newerUnfinished === false,
    `with no report nothing runs and nothing is newer: passRunning and newerUnfinished must be false; got ${show({ passRunning: v.passRunning, newerUnfinished: v.newerUnfinished })}`);
});

test('TV51: with no finished pass in the report (a refused latest and a failed earlier one, or an empty report) explained is null, explainedReason no-finished-pass, and unexplained is the whole difference [AC-4 "No finished pass"; ADR 0004 § UI; T5]', async () => {
  const driftView = await driftViewFn();
  for (const body of [statusBody({ latest: refusedRecord(), previous: [failedReadRecord()] }), statusBody({ latest: null, previous: [] })]) {
    const v = driftView(driftCounts(known(7031), known(7028)), body, rtLive());
    fields(v, { known: true, difference: 3, explained: null, unexplained: 3, explainedReason: 'no-finished-pass', leftToNextPass: null },
      `driftView(no finished pass, latest ${body.latest ? body.latest.outcome : 'null'})`);
    assert(v.explainedBy == null, `explainedBy must be null without an explaining pass; got ${show(v.explainedBy)}`);
    flagsAreBooleans(v, `driftView(no finished pass, latest ${body.latest ? body.latest.outcome : 'null'})`);
  }
});

test('TV52: when the latest pass failed, the explained part comes from the newest finished pass before it, and explainedBy says it was used instead of the latest [AC-4 "When the latest pass is not finished, the panel says which finished pass it used instead"; ADR 0004 § UI; T5]', async () => {
  const driftView = await driftViewFn();
  const held = heldRecord();
  const v = driftView(driftCounts(known(7031), known(7028)), statusBody({ latest: failedReadRecord(), previous: [refusedRecord(), held] }), rtLive());
  fields(v, { explained: 3, unexplained: 0, explainedReason: null, explainedBy: { runId: held.runId, endedAt: held.endedAt, usedInsteadOfLatest: true } },
    'driftView(latest failed)');
});

test('TV53: leftToNextPass is the explaining pass\'s lost races (create, update, move, remove) plus its conflicting addresses (same-address and snapshot), named beside the remainder and never subtracted [AC-4 "the addresses that pass left to the next one"; ADR 0004 § UI; T5]', async () => {
  const driftView = await driftViewFn();
  const pass = doneRecord({
    reason: 'finished; 4 lost race(s) and 3 conflicting address(es) are left to the next pass',
    relationships: relationships({ lostRace: { create: 1, update: 2, move: 0, remove: 1 } }),
    anomalies: { sameAddressConflicts: 2, snapshotConflicts: 1 },
  });
  const v = driftView(driftCounts(known(7030), known(7026)), statusBody({ latest: pass }), rtLive());
  fields(v, { leftToNextPass: 7, difference: 4, explained: 0, unexplained: 4 }, 'driftView(lost races and conflicts)');
});

test('TV54: while a pass runs, passRunning is true and the explained part comes from the newest finished earlier pass, used instead of the running latest [AC-4; ADR 0004 § UI "passRunning"; T5]', async () => {
  const driftView = await driftViewFn();
  const fin = doneRecord({ runId: '20260930T142619Z-4db0d448', endedAt: '2026-09-30T14:26:24.500Z' });
  const v = driftView(driftCounts(known(7026), known(7026)), statusBody({ running: true, latest: pessimisticRecord(), previous: [fin] }), rtLive());
  fields(v, { passRunning: true, explained: 0, explainedBy: { runId: fin.runId, endedAt: fin.endedAt, usedInsteadOfLatest: true } }, 'driftView(pass running)');
  const idle = driftView(driftCounts(known(7026), known(7026)), statusBody({ latest: fin }), rtLive());
  assert(idle && idle.passRunning === false, `passRunning must be false when no pass runs; got ${show(idle && idle.passRunning)}`);
});

test('TV55: newerUnfinished is true when a record newer than the explaining pass is not finished and reached its plan phase (it may have written after it) — a failed write, or a running pass past planning even when its record already reads done — and false for one that stopped before planning or one older than the explaining pass [AC-2 "one still running, is not finished"; AC-4; ADR 0004 § UI "newerUnfinished"; T2; T5]', async () => {
  const driftView = await driftViewFn();
  const fin = doneRecord({ runId: '20260930T090000Z-aaaaaaaa' });
  const counts = driftCounts(known(7026), known(7026));
  const nu = (body) => driftView(counts, body, rtLive()).newerUnfinished;
  assert(nu(statusBody({ latest: failedWriteRecord(), previous: [fin] })) === true, 'a failed write after planning: newerUnfinished must be true');
  assert(nu(statusBody({ running: true, latest: pessimisticRecord({ phases: phasesUpTo('write-creates') }), previous: [fin] })) === true,
    'a running pass past planning: newerUnfinished must be true');
  assert(nu(statusBody({ latest: failedReadRecord(), previous: [fin] })) === false, 'a failed relay read before planning: newerUnfinished must be false');
  assert(nu(statusBody({ running: true, latest: pessimisticRecord(), previous: [fin] })) === false, 'a running pass with no phase yet: newerUnfinished must be false');
  assert(nu(statusBody({ latest: fin })) === false, 'the explaining pass is the latest: newerUnfinished must be false');
  assert(nu(statusBody({ latest: refusedRecord(), previous: [failedWriteRecord(), fin] })) === true,
    'a failed write between a refused latest and the explaining pass: newerUnfinished must be true');
  // only records NEWER than the explaining pass count: an older failed write does not (T5, § UI "newer than")
  assert(nu(statusBody({ latest: fin, previous: [failedWriteRecord({ runId: '20260929T010000Z-99999999' })] })) === false,
    'a failed write older than the explaining pass: newerUnfinished must be false');
  // a running pass is not finished even when its record already reads done (AC-2 "one still running, is not finished"; T2),
  // and past planning it may have written after the explaining pass
  assert(nu(statusBody({ running: true, latest: doneRecord({ runId: '20260930T151500Z-5eed1e55' }), previous: [fin] })) === true,
    'a running pass that already reads done, past planning: newerUnfinished must be true (running is not finished)');
});

test('TV56: when the path is on, driftView names its refused taggings counted at each look and its parked addresses beside the remainder, never subtracting them, and waitsForPass is false [AC-4 "when the path is on, the path\'s refused taggings and parked addresses, which the explained part does not include"; ADR 0004 § UI "The path"; T5]', async () => {
  const driftView = await driftViewFn();
  const rt = rtLive({ counts: pathCounts({ refused: { total: 4, byReason: { 'no-target': 4 } } }), parked: 2 });
  const v = driftView(driftCounts(known(7031), known(7028)), statusBody({ latest: heldRecord() }), rt);
  fields(v, { pathRefusedLooks: 4, parked: 2, waitsForPass: false, pathUnknown: false, explained: 3, unexplained: 0 }, 'driftView(path on)');
});

test('TV57: when the path is off, driftView says changes since that pass wait for the next pass (waitsForPass true) and names no path figures [AC-4 "when the path is off, that changes since that pass wait for the next pass"; ADR 0004 § UI; T5]', async () => {
  const driftView = await driftViewFn();
  for (const rt of [rtOffAfterRunning({ parked: 3 }), rtNeverStarted()]) {
    const v = driftView(driftCounts(known(7031), known(7028)), statusBody({ latest: heldRecord() }), rt);
    fields(v, { waitsForPass: true, pathUnknown: false, pathRefusedLooks: null, parked: null }, `driftView(path off, started ${rt.firstStartedAt !== null})`);
  }
});

test('TV58: with the path status unreadable (rtBody null) driftView says the path is unknown instead, with no path figures and no waitsForPass [AC-4; AC-5 "The other sections keep what they loaded"; ADR 0004 § UI "A null rtBody gives pathUnknown: true instead"; T5]', async () => {
  const driftView = await driftViewFn();
  const v = driftView(driftCounts(known(7031), known(7028)), statusBody({ latest: heldRecord() }), null);
  fields(v, { pathUnknown: true, waitsForPass: false, pathRefusedLooks: null, parked: null, known: true, difference: 3, explained: 3, unexplained: 0 },
    'driftView(path status unreadable)');
});

/* TV59–TV63: driftView after story 4's review, round 1 (ADR 0004 T5 as amended at c496d853) */

const T_COUNTS = '2026-09-30T16:00:00.000Z'; // known()'s default takenAt
const T_PASS_AFTER = '2026-09-30T16:30:00.000Z'; // an explaining pass that ended after the counts were taken
const T_LATER = '2026-09-30T17:00:00.000Z';
/** driftView's countsPredatePass must be exactly true or false (T5: a boolean); says what was expected and why. */
function predates(v, expected, what, why) {
  assert(v && v.countsPredatePass === expected,
    `${what}: countsPredatePass must be ${expected} — ${why} (ADR 0004 T5, amended at story 4's review, round 1); ` +
    `got ${show(v && v.countsPredatePass)}`);
}

test('TV59: countsPredatePass is true when an explaining pass exists, both counts are known, and the earlier of the two takenAt times is before that pass\'s endedAt — both counts earlier, or only one of them (the earlier one decides), compared as Date.parse instants (an offset time counts by its instant); tone is then neutral, and difference, explained, unexplained and explainedBy are still computed [review Non-blocking 3; AC-4; ADR 0004 § UI; T5 "countsPredatePass", "tone is then neutral", "The two figures are still computed"]', async () => {
  const driftView = await driftViewFn();
  const pass = heldRecord({ endedAt: T_PASS_AFTER });
  const body = statusBody({ latest: pass });
  const cases = [
    // [label, relay, graph, difference, explained, unexplained] — one combination whose remainder is 0 (tone would
    // otherwise be ok) and others whose remainder is not (tone would otherwise be warn)
    ['both counts before the pass ended', known(7031, T_COUNTS), known(7028, T_COUNTS), 3, 3, 0],
    ['both before, a remainder left', known(7031, T_COUNTS), known(7020, T_COUNTS), 11, 3, 8],
    ['only the relay count before (graph after)', known(7031, T_COUNTS), known(7020, T_LATER), 11, 3, 8],
    ['only the graph count before (relay after)', known(7031, T_LATER), known(7028, T_COUNTS), 3, 3, 0],
    // 18:00+02:00 is 16:00Z, before 16:30Z, though its text sorts after it: the times compare as Date.parse instants
    ['an offset takenAt whose instant is before', known(7031, '2026-09-30T18:00:00+02:00'), known(7028, T_LATER), 3, 3, 0],
  ];
  for (const [label, relay, graph, difference, explained, unexplained] of cases) {
    const what = `driftView(${label}; pass ended ${T_PASS_AFTER})`;
    const v = driftView(driftCounts(relay, graph), body, rtLive());
    predates(v, true, what, `the earlier takenAt (${[relay.takenAt, graph.takenAt].join(' / ')}) is before the explaining pass's endedAt, so that pass cannot explain these counts`);
    assert(v.tone === 'neutral', `${what}: tone must be 'neutral' when the counts predate the explaining pass (T5); got ${show(v.tone)}`);
    fields(v, {
      known: true, difference, explained, unexplained, explainedReason: null,
      explainedBy: { runId: pass.runId, endedAt: T_PASS_AFTER, usedInsteadOfLatest: false },
    }, `${what} (the two figures are still computed, T5)`);
    flagsAreBooleans(v, what);
  }
});

test('TV60: countsPredatePass is false when the counts were taken after the explaining pass ended, when the earlier takenAt equals its endedAt (strictly before only), when the time compared is the explaining pass\'s endedAt and not a later failed latest\'s, and when an offset takenAt\'s instant is after it though its text sorts before [review Non-blocking 3; ADR 0004 T5 "the earlier of … is before Date.parse(explainedBy.endedAt)"]', async () => {
  const driftView = await driftViewFn();
  const counts = driftCounts(known(7031, T_COUNTS), known(7028, T_COUNTS));
  const cases = [
    ['counts after the pass ended (heldRecord ended 14:26:48Z)', counts, statusBody({ latest: heldRecord() })],
    ['earlier takenAt equal to endedAt', driftCounts(known(7031, T_COUNTS), known(7028, T_LATER)), statusBody({ latest: heldRecord({ endedAt: T_COUNTS }) })],
    // the explaining pass ended at 15:00Z, before the counts; the failed latest ended at 16:45Z, after them
    ['a later failed latest, an earlier explaining pass', counts, statusBody({
      latest: failedWriteRecord({ runId: '20260930T164000Z-feedf00d', startedAt: '2026-09-30T16:40:00.000Z', endedAt: '2026-09-30T16:45:00.000Z' }),
      previous: [heldRecord({ endedAt: '2026-09-30T15:00:00.000Z' })],
    })],
    // 15:00-02:00 is 17:00Z, after 16:30Z, though its text sorts before it
    ['an offset takenAt whose instant is after', driftCounts(known(7031, '2026-09-30T15:00:00-02:00'), known(7028, T_LATER)),
      statusBody({ latest: heldRecord({ endedAt: T_PASS_AFTER }) })],
  ];
  for (const [label, c, body] of cases) {
    const what = `driftView(${label})`;
    const v = driftView(c, body, rtLive());
    assert(v && v.explainedBy, `${what}: an explaining pass is expected in this fixture; got explainedBy ${show(v && v.explainedBy)}`);
    predates(v, false, what, 'the counts were not taken before the explaining pass ended');
    flagsAreBooleans(v, what);
  }
});

test('TV61: a time that does not parse makes countsPredatePass false — a relay or graph takenAt that is garbage, null or missing (even when the other count is earlier than the pass), or an explaining pass whose endedAt is garbage or null — and the figures are still computed [review Non-blocking 3; ADR 0004 T5 "A time that does not parse makes it false"]', async () => {
  const driftView = await driftViewFn();
  const without = (c, k) => { const o = { ...c }; delete o[k]; return o; };
  const early = known(7028, T_COUNTS);
  const cases = [
    ['relay takenAt garbage, graph earlier', known(7031, 'garbage'), early, T_PASS_AFTER],
    ['relay takenAt null, graph earlier', known(7031, null), early, T_PASS_AFTER],
    ['graph takenAt missing, relay earlier', known(7031, T_COUNTS), without(early, 'takenAt'), T_PASS_AFTER],
    ['graph takenAt an empty string, relay earlier', known(7031, T_COUNTS), known(7028, ''), T_PASS_AFTER],
    ['explaining pass endedAt garbage', known(7031, '2020-01-01T00:00:00.000Z'), known(7028, '2020-01-01T00:00:00.000Z'), 'not-a-time'],
    ['explaining pass endedAt null', known(7031, '2020-01-01T00:00:00.000Z'), known(7028, '2020-01-01T00:00:00.000Z'), null],
  ];
  for (const [label, relay, graph, endedAt] of cases) {
    const what = `driftView(${label})`;
    const v = driftView(driftCounts(relay, graph), statusBody({ latest: heldRecord({ endedAt }) }), rtLive());
    predates(v, false, what, 'a time that does not parse makes it false');
    fields(v, { known: true, difference: 3, explained: 3, unexplained: 0 }, what);
    flagsAreBooleans(v, what);
  }
});

test('TV62: countsPredatePass is false without an explaining pass (report unavailable, or no finished pass while a refused or failed record ended after the counts) and when either count is unknown or the counts read failed, even with every takenAt before the pass ended [review Non-blocking 3; ADR 0004 T5 "true only when there is an explaining pass, both counts are known"]', async () => {
  const driftView = await driftViewFn();
  const after = (rec) => rec({ endedAt: '2026-09-30T16:45:00.000Z' });
  const both = driftCounts(known(7031, T_COUNTS), known(7028, T_COUNTS));
  const passAfter = statusBody({ latest: heldRecord({ endedAt: T_PASS_AFTER }) });
  const cases = [
    ['report unavailable', both, null],
    ['no finished pass (refused latest, failed earlier, both ended after the counts)', both,
      statusBody({ latest: after(refusedRecord), previous: [after(failedReadRecord)] })],
    ['an empty report', both, statusBody({ latest: null, previous: [] })],
    ['relay unknown, its takenAt earlier than the pass', driftCounts(unknown('timeout', T_COUNTS), known(7028, T_COUNTS)), passAfter],
    ['graph unknown, its takenAt earlier than the pass', driftCounts(known(7031, T_COUNTS), unknown('ECONNREFUSED', T_COUNTS)), passAfter],
    ['the counts read failed (counts null)', null, passAfter],
  ];
  for (const [label, c, body] of cases) {
    const what = `driftView(${label})`;
    const v = driftView(c, body, rtLive());
    predates(v, false, what, 'it is true only with an explaining pass and both counts known');
    flagsAreBooleans(v, what);
  }
});

test('TV63: while a pass runs, driftView gives passRunning true AND explainedBy.usedInsteadOfLatest true, the explaining pass being the newest finished earlier one — whether the running latest\'s record is still pessimistic or already reads done — with the story example\'s figures [review Non-blocking 1; AC-4; ADR 0004 T5 "usedInsteadOfLatest … includes a pass that is still running (passRunning is then true too)"; T2]', async () => {
  const driftView = await driftViewFn();
  const fin = heldRecord({ runId: '20260930T142619Z-4db0d448', endedAt: '2026-09-30T14:26:24.500Z' });
  const counts = driftCounts(known(7031), known(7028));
  const runningLatests = [
    ['is still pessimistic', pessimisticRecord({ phases: phasesUpTo('write-creates') })],
    ['already reads done', doneRecord({ runId: '20260930T151500Z-5eed1e55', startedAt: '2026-09-30T15:15:00.000Z', endedAt: '2026-09-30T15:15:01.300Z' })],
  ];
  for (const [label, latest] of runningLatests) {
    const what = `driftView(story example, a running latest that ${label})`;
    const v = driftView(counts, statusBody({ running: true, latest, previous: [fin] }), rtLive());
    assert(v && v.passRunning === true, `${what}: passRunning must be true while a pass runs (T5); got ${show(v && v.passRunning)}`);
    assert(v.explainedBy && v.explainedBy.usedInsteadOfLatest === true,
      `${what}: explainedBy.usedInsteadOfLatest must be true — a running latest is not the explaining pass (T5's note; T2); got ${show(v.explainedBy)}`);
    fields(v, {
      known: true, difference: 3, explained: 3, unexplained: 0, explainedReason: null,
      explainedBy: { runId: fin.runId, endedAt: fin.endedAt, usedInsteadOfLatest: true },
    }, what);
  }
});

/* TV64–TV67: pathView's starting window (story 5 AC-3; ADR 0005 D7) */

test('TV64: within the starting window (on, and the status\'s inStartWindow true) a path whose process is not running yet is starting, not failed — starting true, onButNotRunning false, runningForThisOn false, state null whatever the stored state, and a tone that is not bad — on a first start too [story 5 AC-3 "Within the window … the panel says the path is starting, never that it has failed"; ADR 0005 D7 "pathView", § Seams "The view module"]', async () => {
  const pathView = await pathViewFn();
  const cases = [
    ['STARTING, stored state stopped', rtStarting()],
    ['STARTING, stored state live', rtStarting({ state: 'live' })],
    ['STARTING, no stored state', rtStarting({ state: null })],
    ['a first start in its window (no firstStartedAt, no counts)', rtNeverStarted({ on: true, onSince: ON_AT, inStartWindow: true, state: null })],
  ];
  for (const [label, body] of cases) {
    const what = `pathView(${label}) [ADR 0005 D7]`;
    const v = pathView(body);
    fields(v, { on: true, running: false, starting: true, onButNotRunning: false, runningForThisOn: false, state: null }, what);
    assert(v.tone !== 'bad', `${what}: a path that is starting has not failed, so its tone is not bad (story 5 AC-3); got ${show(v.tone)}`);
  }
});

test('TV65: within the window, a process that started before that on (a quick off then on, STARTING_OLD_PROCESS) does not count as running for this on — running stays liveness (true), but starting is true, runningForThisOn false, onButNotRunning false and state null, even though the stored state reads live [story 5 AC-3 "A process that started before that on does not count as running"; ADR 0005 D7 "running stays liveness alone", "runningForThisOn = running && !starting"]', async () => {
  const pathView = await pathViewFn();
  const v = pathView(rtStartingOldProcess());
  fields(v, { on: true, running: true, starting: true, runningForThisOn: false, onButNotRunning: false, state: null },
    'pathView(STARTING_OLD_PROCESS) [ADR 0005 D7]');
  assert(v.tone !== 'bad', `pathView(STARTING_OLD_PROCESS): starting is not failed, so its tone is not bad (story 5 AC-3); got ${show(v.tone)}`);
});

test('TV66: outside the window starting is false — past 60 seconds with no process the path is onButNotRunning again (story 4\'s red), a running process is this on\'s (runningForThisOn true, its state shown), a status without inStartWindow (a story-4 server) reads as before, and only inStartWindow === true counts (not "true", 1 or null) [story 5 AC-3 "Past 60 seconds … story 4\'s warning, as today"; ADR 0005 D7 "starting = on && rtBody.inStartWindow === true"]', async () => {
  const pathView = await pathViewFn();
  fields(pathView(rtStarting({ inStartWindow: false })),
    { on: true, running: false, starting: false, onButNotRunning: true, runningForThisOn: false, state: null },
    'pathView(on, past the window, no process) [ADR 0005 D7]');
  fields(pathView(rtLive({ running: false, runningSince: null })),
    { starting: false, onButNotRunning: true, runningForThisOn: false, state: null },
    'pathView(on, no inStartWindow, no process: a story-4 server) [ADR 0005 D7]');
  fields(pathView(rtLive({ inStartWindow: false })),
    { on: true, running: true, starting: false, runningForThisOn: true, onButNotRunning: false, state: 'live' },
    'pathView(on, past the window, running) [ADR 0005 D7]');
  fields(pathView(rtLive()),
    { starting: false, runningForThisOn: true, onButNotRunning: false, state: 'live' },
    'pathView(on, no inStartWindow, running: a story-4 server) [ADR 0005 D7]');
  for (const odd of ['true', 1, null]) {
    fields(pathView(rtStarting({ inStartWindow: odd })), { starting: false, onButNotRunning: true, state: null },
      `pathView(inStartWindow ${show(odd)}: only true counts) [ADR 0005 D7]`);
  }
});

test('TV67: the window applies only while on — an off path with a stray inStartWindow is off, not starting — and the verdict is the server\'s alone: with the client clock stubbed far ahead or to 1970 the flag decides, the same body gives every viewer and every reload the same view, and Date.now is never called [story 5 AC-3 "Every viewer sees it, and it survives a reload"; ADR 0005 D7 "a verdict on the public status", § Constraints "The view module stays clock-free"; TV4]', async () => {
  const pathView = await pathViewFn();
  fields(pathView(rtOffAfterRunning({ inStartWindow: true })), { on: false, starting: false, onButNotRunning: false, state: 'off' },
    'pathView(off, a stray inStartWindow) [ADR 0005 D7 "starting = on && …"]');
  for (const at of [Date.parse('2099-01-01T00:00:00Z'), 0]) {
    await withClock(at, async (calls) => {
      const first = pathView(rtStarting());
      const again = pathView(rtStarting());
      fields(first, { starting: true, onButNotRunning: false }, `pathView(STARTING, client clock ${at}) [ADR 0005 D7]`);
      same(again, first, `pathView(STARTING) read twice (a second viewer, a reload) [story 5 AC-3]`);
      fields(pathView(rtStarting({ inStartWindow: false })), { starting: false, onButNotRunning: true },
        `pathView(past the window, client clock ${at}) [ADR 0005 D7]`);
      assert(calls.n === 0, `pathView must not call Date.now (ADR 0005 D7: the window is the server's verdict); it was called ${calls.n} time(s)`);
    });
  }
});

/* TV68: offPromptVariant (story 5 AC-2; ADR 0005 D8) */

test('TV68: offPromptVariant is "unknown" when the status is unreadable (checked first), "normal" when firstStartedAt is a string, and "first-start" otherwise — never keyed on state "starting" (every start reports it) or on the path having counts (pathView\'s started, true during a first start) [story 5 AC-2 "Before the path has completed its first start"; ADR 0005 D8]', async () => {
  const variant = await offPromptVariantFn();
  const pathView = await pathViewFn();
  const firstStartCatchingUp = rtLive({ firstStartedAt: null, state: 'catching-up' });
  assert(pathView(firstStartCatchingUp).started === true,
    'fixture check: a first start with counts already reads started in pathView (the case D8 must not key on)');
  const cases = [
    ['live, past its first start', rtLive(), 'normal'],
    ['a later start: state starting, firstStartedAt a string', rtLive({ state: 'starting' }), 'normal'],
    ['within the starting window, past its first start', rtStarting(), 'normal'],
    ['statusUnreadable not exactly true', rtLive({ statusUnreadable: 'true' }), 'normal'],
    ['a first start under way: state starting, no firstStartedAt', rtNeverStarted({ on: true, onSince: ON_AT, inStartWindow: true, state: 'starting' }), 'first-start'],
    ['a first start catching up, with counts (pathView: started), no firstStartedAt', firstStartCatchingUp, 'first-start'],
    ['firstStartedAt missing', (() => { const b = rtLive(); delete b.firstStartedAt; return b; })(), 'first-start'],
    ['firstStartedAt not a string', rtLive({ firstStartedAt: 1727706396170 }), 'first-start'],
    ['status unreadable, firstStartedAt null', rtNeverStarted({ on: true, onSince: ON_AT, state: null, statusUnreadable: true }), 'unknown'],
    ['status unreadable, checked before a firstStartedAt string', rtLive({ statusUnreadable: true }), 'unknown'],
  ];
  const wrong = [];
  for (const [label, body, want] of cases) {
    const got = variant(body);
    if (got !== want) wrong.push(`${label}: expected ${show(want)}, got ${show(got)}`);
  }
  assert(wrong.length === 0, `offPromptVariant (ADR 0005 D8): ${wrong.join('; ')}`);
});

/* TV69: turnOnWarning (story 5 AC-1; ADR 0005 D14) */

test('TV69: turnOnWarning(statusRead) is "no-finished-pass" when the status body is present and holds no finished pass (a refused and a failed pass, an empty report, a running first pass, or a kept body after a failed read), "could-not-check" when the status read failed with no body, and none while loading or when a finished pass exists (none is null, undefined or "none") [story 5 AC-1 "A warning beside Turn on"; ADR 0005 D14]', async () => {
  const warning = await turnOnWarningFn();
  const none = (w) => w === null || w === undefined || w === 'none';
  const cases = [
    ['a refused latest and a failed earlier pass', readyRead(statusBody({ latest: refusedRecord(), previous: [failedReadRecord()] })), 'no-finished-pass'],
    ['an empty report', readyRead(statusBody({ latest: null, previous: [] })), 'no-finished-pass'],
    ['a running first pass', readyRead(statusBody({ running: true, latest: pessimisticRecord(), previous: [] })), 'no-finished-pass'],
    ['a failed read keeping a body with no finished pass', failedRead(statusBody({ latest: refusedRecord() })), 'no-finished-pass'],
    ['a failed first read (http-500, no body)', failedRead(null), 'could-not-check'],
    ['a failed first read (network, no body)', failedRead(null, { ok: false, code: 'network', httpStatus: null, body: null }), 'could-not-check'],
    ['the first read still loading', READ_LOADING, 'none'],
    ['a done latest pass', readyRead(statusBody({ latest: doneRecord() })), 'none'],
    ['a done-removals-held latest pass', readyRead(statusBody({ latest: heldRecord() })), 'none'],
    ['a failed latest after a finished one', readyRead(statusBody({ latest: failedWriteRecord(), previous: [heldRecord()] })), 'none'],
    ['a running pass after a finished one', readyRead(statusBody({ running: true, latest: pessimisticRecord(), previous: [doneRecord()] })), 'none'],
    ['a failed read keeping a body with a finished pass', failedRead(statusBody({ latest: doneRecord() })), 'none'],
  ];
  const wrong = [];
  for (const [label, read, want] of cases) {
    const got = warning(read);
    const ok = want === 'none' ? none(got) : got === want;
    if (!ok) wrong.push(`${label}: expected ${want === 'none' ? 'none (null, undefined or "none")' : show(want)}, got ${show(got)}`);
  }
  assert(wrong.length === 0, `turnOnWarning (ADR 0005 D14): ${wrong.join('; ')}`);
});

/* TV70–TV77: switchRecordView (story 5 AC-5; ADR 0005 D3, D12) */

test('TV70: a recorded change with a role reads "Turned off by an admin" or "Turned on by the owner", with its shortened key and its time, and the history shows newest first, each recorded row with its key and time and a row not recorded with neither [story 5 AC-5 "What the panel shows": "Turned off by an admin (ab12cd34…) at 14:02", "the last 10 changes, newest first"; ADR 0005 D12 "recorded, with a role", "History rows that were not recorded render without who or when"]', async () => {
  const view = await switchRecordViewFn();
  const ownerOn = entryOf(true, '2026-10-01T15:10:00.000Z', 'owner', KEY_OWNER);
  const cases = [
    ['an admin turned it off', recordBody(), rtOffAfterRunning(), /turned off by an admin/i, /by the owner/i, KEY_ADMIN],
    ['the owner turned it on', recordBody({
      on: true, latest: ownerOn,
      history: [ownerOn, entryOf(false, AT_LATEST, 'admin', KEY_ADMIN), unrecorded(true), entryOf(false, '2026-09-29T17:43:18.937Z', 'admin', KEY_ADMIN2)],
    }), rtLive(), /turned on by the owner/i, /by an admin/i, KEY_OWNER],
  ];
  for (const [label, body, rt, says, notSays, key] of cases) {
    const what = `switchRecordView(recorded: ${label}) [ADR 0005 D12]`;
    const v = view(readyRead(body), rt);
    const shown = shownHistory(v, body.history);
    assert(shown, `${what}: the history must be shown newest first, each recorded row with its key and time and a row not ` +
      `recorded with neither (story 5 AC-5; D12); got ${show(v)}`);
    const top = textOutside(v, shown);
    assert(says.test(top), `${what}: the latest change must read ${says} (story 5 AC-5); got ${show(top)}`);
    assert(!notSays.test(top), `${what}: the latest change must not read ${notSays}; got ${show(top)}`);
    assert(top.includes(key), `${what}: the latest change must show its shortened key ${key} (story 5 AC-5 "a shortened key"); got ${show(top)}`);
    assert(carriesTime(v, body.latest.at, shown), `${what}: the latest change must carry its time ${body.latest.at}, which the ` +
      `panel prints (story 5 AC-5 "and when"), in any form that reads back to that instant — a string s with ` +
      `Date.parse(s) === ${Date.parse(body.latest.at)}, that number, or the ISO text in a sentence; got ${show(top)}`);
    assert(!/not recorded|no change has been recorded/i.test(top), `${what}: a recorded change is not "not recorded"; got ${show(top)}`);
    noBang(v, what);
  }
});

test('TV71: a recorded change with a null role (a switch.json that names no role, D3) reads turned on, or turned off, with who and when not recorded — no "by the owner" or "by an admin" and no key in its line — while the history still shows [ADR 0005 D3 "Anything else readable is a change not recorded", D12 "recorded, with a null role: turned on (or off); who and when were not recorded"]', async () => {
  const view = await switchRecordViewFn();
  for (const on of [true, false]) {
    const latest = unrecorded(on);
    const body = recordBody({
      on, latest,
      history: [latest, entryOf(!on, '2026-10-01T09:30:00.000Z', 'owner', KEY_OWNER), entryOf(on, '2026-09-29T17:43:18.937Z', 'admin', KEY_ADMIN2)],
    });
    const what = `switchRecordView(recorded, null role, ${on ? 'on' : 'off'}) [ADR 0005 D12]`;
    const v = view(readyRead(body), on ? rtLive() : rtOffAfterRunning());
    const shown = shownHistory(v, body.history);
    assert(shown, `${what}: the history must still be shown (D12); got ${show(v)}`);
    const top = textOutside(v, shown);
    assert(new RegExp(`turned ${on ? 'on' : 'off'}`, 'i').test(top) && /not recorded/i.test(top),
      `${what}: it must say the path was turned ${on ? 'on' : 'off'} and that who and when were not recorded (D12); got ${show(top)}`);
    assert(!/by (the owner|an admin)/i.test(top), `${what}: it names no role (D12); got ${show(top)}`);
    assert(!KEYS.some((k) => top.includes(k)), `${what}: its line shows no key (D12); got ${show(top)}`);
    noBang(v, what);
  }
});

test('TV72: an off the server could not record (state unrecorded-off) reads turned off, with the change not recorded — never an earlier "Turned on by …" as the latest, no key in its line — the history recorded before it still shows, and its sentence is its own, not the null-role recorded off\'s [story 5 AC-5 "The one exception"; ADR 0005 D3 "unrecorded-off", D12 "unrecorded-off: turned off, but the change was not recorded"]', async () => {
  const view = await switchRecordViewFn();
  const latest = unrecorded(false);
  const history = [latest, entryOf(true, '2026-10-01T09:30:00.000Z', 'owner', KEY_OWNER), entryOf(false, '2026-09-30T20:00:00.000Z', 'admin', KEY_ADMIN2)];
  const body = recordBody({ on: false, state: 'unrecorded-off', latest, history });
  const what = 'switchRecordView(unrecorded-off) [ADR 0005 D12]';
  const v = view(readyRead(body), rtOffAfterRunning());
  const shown = shownHistory(v, history);
  assert(shown, `${what}: the history recorded before it survives and shows (story 5 AC-5); got ${show(v)}`);
  const top = textOutside(v, shown);
  assert(/turned off/i.test(top) && /not recorded/i.test(top), `${what}: it must say turned off, and that the change was not recorded (D12); got ${show(top)}`);
  assert(!/turned on/i.test(top), `${what}: an earlier "Turned on by …" is never the latest change (story 5 AC-5); got ${show(top)}`);
  assert(!/by (the owner|an admin)/i.test(top) && !KEYS.some((k) => top.includes(k)), `${what}: its line names no role and no key; got ${show(top)}`);
  const nullRoleOff = view(readyRead({ ...body, state: 'recorded' }), rtOffAfterRunning());
  const a = sentencesOutside(v, shown);
  const b = sentencesOutside(nullRoleOff, shownHistory(nullRoleOff, history));
  assert(show(a) !== show(b), `${what}: its sentence must be its own, not the null-role recorded off's (D12 "One sentence per state"); both read ${show(a)}`);
  noBang(v, what);
});

test('TV73: on an instance never switched (state never-switched) the record says no change has been recorded, with no latest line and no history [story 5 AC-5 "When no change is recorded … the panel says no change has been recorded and the history is empty"; ADR 0005 D3 "never-switched", D12]', async () => {
  const view = await switchRecordViewFn();
  const body = recordBody({ on: false, state: 'never-switched', latest: null, history: [] });
  const what = 'switchRecordView(never-switched) [ADR 0005 D12]';
  const v = view(readyRead(body), rtNeverStarted());
  const all = textOutside(v, null);
  assert(/no change has been recorded/i.test(all), `${what}: it must say no change has been recorded (story 5 AC-5); got ${show(v)}`);
  assert(!/turned (on|off)/i.test(all), `${what}: it shows no change; got ${show(all)}`);
  noBang(v, what);
});

test('TV74: when switch.json cannot be read (state switch-unreadable, the status agreeing) the record says the on/off record cannot be read, shows no latest line and is not "no change has been recorded" [ADR 0005 D3 "switch-unreadable", D12 "switch-unreadable: the on/off record cannot be read"]', async () => {
  const view = await switchRecordViewFn();
  const history = [entryOf(true, '2026-10-01T09:30:00.000Z', 'owner', KEY_OWNER), entryOf(false, '2026-09-30T20:00:00.000Z', 'admin', KEY_ADMIN)];
  const body = recordBody({ on: false, switchUnreadable: true, state: 'switch-unreadable', latest: null, history });
  const what = 'switchRecordView(switch-unreadable) [ADR 0005 D12]';
  const v = view(readyRead(body), rtOffAfterRunning({ switchUnreadable: true }));
  const top = textOutside(v, shownHistory(v, history));
  assert(/(cannot|could not|can't) be read/i.test(top), `${what}: it must say the on/off record cannot be read (D12); got ${show(top)}`);
  assert(!/turned (on|off) by/i.test(top), `${what}: it shows no latest change (D3: latest is null); got ${show(top)}`);
  assert(!/no change has been recorded/i.test(top), `${what}: an unreadable switch is not "no change has been recorded"; got ${show(top)}`);
  noBang(v, what);
});

test('TV75: when the history file cannot be read (historyUnreadable) the latest change is still shown — "Turned off by an admin", its key — and a sentence says the history cannot be read [ADR 0005 D3 "historyUnreadable", D12 "historyUnreadable: the history cannot be read, with the latest change still shown"]', async () => {
  const view = await switchRecordViewFn();
  const latest = entryOf(false, AT_LATEST, 'admin', KEY_ADMIN);
  const body = recordBody({ historyUnreadable: true, latest, history: [latest] });
  const what = 'switchRecordView(recorded, historyUnreadable) [ADR 0005 D12]';
  const v = view(readyRead(body), rtOffAfterRunning());
  const all = stringsIn(v);
  assert(all.some((s) => /history/i.test(s) && /(cannot|could not|can't) be read/i.test(s)),
    `${what}: a sentence must say the history cannot be read (D12); got ${show(all)}`);
  const joined = all.join(' | ');
  assert(/turned off by an admin/i.test(joined) && joined.includes(KEY_ADMIN) && carriesTime(v, AT_LATEST),
    `${what}: the latest change is still shown, with its role, key and time (D12; the time in any form that reads back ` +
    `to ${AT_LATEST}: a string s with Date.parse(s) === ${Date.parse(AT_LATEST)}, that number, or the ISO text in a ` +
    `sentence); got ${show(leavesIn(v))}`);
  noBang(v, what);
});

test('TV76: a skewed pair shows nothing of the record and says it is being refreshed — a current record read whose on differs from the status\'s (the record still on, the status off), or whose switchUnreadable disagrees with the status\'s either way — while the same record with an agreeing status does show [ADR 0005 D12 "only when the record read is current, its on equals rtBody.on, and its switchUnreadable agrees. Otherwise it says the record is being refreshed"; § Seams "the two consistency cases"]', async () => {
  const view = await switchRecordViewFn();
  const ownerOn = entryOf(true, '2026-10-01T15:10:00.000Z', 'owner', KEY_OWNER);
  const onBody = recordBody({ on: true, latest: ownerOn, history: [ownerOn, entryOf(false, AT_LATEST, 'admin', KEY_ADMIN)] });
  const control = view(readyRead(onBody), rtLive());
  assert(stringsIn(control).some((s) => s.includes(KEY_OWNER)),
    `control: the same record with an agreeing status must show its latest change (D12); got ${show(control)}`);
  const unreadableBody = recordBody({ on: false, switchUnreadable: true, state: 'switch-unreadable', latest: null,
    history: [entryOf(false, AT_LATEST, 'admin', KEY_ADMIN)] });
  const cases = [
    ['the record on, the status off', onBody, rtOffAfterRunning()],
    ['the record\'s switch readable, the status\'s unreadable', recordBody(), rtOffAfterRunning({ switchUnreadable: true })],
    ['the record\'s switch unreadable, the status\'s readable', unreadableBody, rtOffAfterRunning()],
  ];
  for (const [label, body, rt] of cases) {
    const what = `switchRecordView(skewed pair: ${label}) [ADR 0005 D12]`;
    const v = view(readyRead(body), rt);
    showsNothingOfTheRecord(v, what);
    assert(/refresh/i.test(stringsIn(v).join(' | ')), `${what}: it must say the record is being refreshed (D12); got ${show(v)}`);
    noBang(v, what);
  }
});

test('TV77: a failed record read after a good one (useRead keeps the old body) never renders that body\'s latest line or history and says the record could not be read — for an http-500 and for a refused 403 — a failed first read says so too, a first read still loading shows no change, and Date.now is never called [ADR 0005 D12 "it never renders a kept body\'s latest line after a failed record read"; § Seams "a failed record read after a good one"; TV4]', async () => {
  const view = await switchRecordViewFn();
  const body = recordBody();
  const rt = rtOffAfterRunning();
  await withClock(Date.parse('2099-01-01T00:00:00Z'), async (calls) => {
    const refused = { ok: false, code: 'http-403', httpStatus: 403, body: { success: false, error: 'Owner or admin access required' } };
    for (const [label, read] of [['http-500, body kept', failedRead(body)], ['http-403, body kept', failedRead(body, refused)],
      ['network, no body yet', failedRead(null, { ok: false, code: 'network', httpStatus: null, body: null })]]) {
      const what = `switchRecordView(a failed record read: ${label}) [ADR 0005 D12]`;
      const v = view(read, rt);
      showsNothingOfTheRecord(v, what);
      assert(/(could not|cannot|can't) be read/i.test(stringsIn(v).join(' | ')), `${what}: it must say the record could not be read (D12); got ${show(v)}`);
      noBang(v, what);
    }
    const loading = view(READ_LOADING, rt);
    showsNothingOfTheRecord(loading, 'switchRecordView(the first record read, still loading) [ADR 0005 D12]');
    assert(calls.n === 0, `switchRecordView must not call Date.now (the view module is clock-free, ADR 0005 § Constraints); it was called ${calls.n} time(s)`);
  });
});

/* TV78–TV81: switchOutcome (story 5 AC-1, AC-4, AC-5; ADR 0005 D11, D12) */

const recordedAnswer = (on) => ({ success: true, on, changedAt: '2026-10-01T15:10:00.000Z', recorded: true, takesEffectWithinSeconds: 5 });

test('TV78: an answered change is done — ok with recorded true, or with no recorded field (not false) — with a sentence of its own for each target; an ok with recorded false is done-unrecorded, whose off sentence says the path is off and the change was not recorded [story 5 AC-5 "Its answer says the change could not be recorded"; ADR 0005 D11, D12 "done: ok, and recorded is not false", "done-unrecorded: ok, and recorded === false"]', async () => {
  const outcome = await switchOutcomeFn();
  const sentences = {};
  for (const on of [true, false]) {
    for (const [label, body] of [['recorded true', recordedAnswer(on)], ['no recorded field', (() => { const b = recordedAnswer(on); delete b.recorded; return b; })()]]) {
      const what = `switchOutcome({ ok: true, ${label} }, ${on}) [ADR 0005 D12]`;
      const r = outcome({ ok: true, body }, on);
      assert(outcomeOf(r, what) === 'done', `${what}: expected done; got ${show(r)}`);
      assert(sentenceOf(r).trim() !== '', `${what}: it must carry a sentence (D12 "each with a fixed sentence for its target"); got ${show(r)}`);
      noBang(r, what);
      sentences[on] = sentenceOf(r);
    }
  }
  assert(sentences[true] !== sentences[false], `switchOutcome done: the sentence for turning on must differ from turning off's (D12 "for its target"); both ${show(sentences[true])}`);
  for (const on of [false, true]) {
    const what = `switchOutcome({ ok: true, recorded: false }, ${on}) [ADR 0005 D12]`;
    const r = outcome({ ok: true, body: { success: true, on: false, recorded: false, takesEffectWithinSeconds: 5 } }, on);
    assert(outcomeOf(r, what) === 'done-unrecorded', `${what}: expected done-unrecorded; got ${show(r)}`);
    if (on === false) {
      const s = sentenceOf(r);
      assert(/\boff\b/i.test(s) && /(not|n't)( be(en)?)? recorded/i.test(s),
        `${what}: the off takes effect, so its sentence says the path is off and the change was not recorded (story 5 AC-4, AC-5); got ${show(s)}`);
    }
    noBang(r, what);
  }
});

test('TV79: with no usable answer — a timeout, a network failure, or a 2xx whose JSON is bad — the outcome is unknown for either target, and its sentence says so [story 5 AC-1 "If the server has not answered within 15 seconds … the panel says the outcome is unknown"; ADR 0005 D12 "unknown: timeout, network, or bad JSON"]', async () => {
  const outcome = await switchOutcomeFn();
  const results = [
    { ok: false, code: 'timeout', httpStatus: null, body: null },
    { ok: false, code: 'network', httpStatus: null, body: null },
    { ok: false, code: 'bad-json', httpStatus: 200, body: null },
  ];
  for (const on of [true, false]) {
    for (const res of results) {
      const what = `switchOutcome(${res.code}, ${on}) [ADR 0005 D12]`;
      const r = outcome(res, on);
      assert(outcomeOf(r, what) === 'unknown', `${what}: expected unknown; got ${show(r)}`);
      assert(/unknown/i.test(sentenceOf(r)), `${what}: its sentence must say the outcome is unknown (story 5 AC-1); got ${show(sentenceOf(r))}`);
      noBang(r, what);
    }
  }
});

test('TV80: a 401 or 403 is refused for either target — signed out, neither owner nor admin, or cross-site, with or without a JSON body — and its own sentence says to sign in again as the owner or an admin, from the instance\'s own address, which a failed change\'s sentence does not [story 5 AC-4 "A refusal can come from a lapsed session, or from a viewer who is no longer owner or admin"; ADR 0005 D12 "refused: http-401 or http-403. Its own sentence says to sign in again as the owner or an admin, from the instance\'s own address"]', async () => {
  const outcome = await switchOutcomeFn();
  const refusals = [
    { ok: false, code: 'http-401', httpStatus: 401, body: { success: false, error: 'Not authenticated' } },
    { ok: false, code: 'http-403', httpStatus: 403, body: { success: false, error: 'Owner or admin access required' } },
    { ok: false, code: 'http-403', httpStatus: 403, body: { success: false, error: 'cross-site request refused' } },
    { ok: false, code: 'http-403', httpStatus: 403, body: null },
  ];
  for (const on of [true, false]) {
    const failed = sentenceOf(outcome({ ok: false, code: 'http-500', httpStatus: 500, body: { success: false, error: 'x', code: 'EIO' } }, on));
    assert(!/sign in again/i.test(failed), `switchOutcome(http-500, ${on}): a failed change is not told to sign in again (D12: refused has its own sentence); got ${show(failed)}`);
    for (const res of refusals) {
      const what = `switchOutcome(${res.code} ${show(res.body && res.body.error)}, ${on}) [ADR 0005 D12]`;
      const r = outcome(res, on);
      assert(outcomeOf(r, what) === 'refused', `${what}: expected refused; got ${show(r)}`);
      const s = sentenceOf(r);
      assert(/sign in again/i.test(s) && /owner or an admin/i.test(s),
        `${what}: its sentence must say to sign in again as the owner or an admin (D12); got ${show(s)}`);
      assert(/\b(address|URL|origin|site|host|domain|page)\b/i.test(s),
        `${what}: its sentence must point at the instance's own address — in any of the words address, URL, origin, site, ` +
        `host, domain or page, since D12 fixes that it says so but not the word (D12 "from the instance's own address"); got ${show(s)}`);
      noBang(r, what);
    }
  }
});

test('TV81: any other non-2xx is failed, carrying the answer\'s body.code — a failed on says the path\'s state is unchanged and to check the data volume has free space and is writable; a failed off says the path could not be turned off and is still on as before; a 400, 415, 404 or a 502 with no JSON is failed too [story 5 AC-4 "Refused or failed … the panel shows the reason and the path\'s state unchanged"; ADR 0005 D11 (the 500s gain code), D12 "failed: any other non-2xx, with body.code"]', async () => {
  const outcome = await switchOutcomeFn();
  const onFailed = { ok: false, code: 'http-500', httpStatus: 500, body: { success: false, error: 'could not write the switch', code: 'ENOSPC' } };
  let what = 'switchOutcome(http-500 ENOSPC, true) [ADR 0005 D12]';
  let r = outcome(onFailed, true);
  assert(outcomeOf(r, what) === 'failed', `${what}: expected failed; got ${show(r)}`);
  assert(stringsIn(r).includes('ENOSPC'), `${what}: it must carry the answer's code ENOSPC (D12 "with body.code"); got ${show(r)}`);
  let s = sentenceOf(r);
  assert(/unchanged/i.test(s) && /free space/i.test(s) && /writable/i.test(s),
    `${what}: a failed on says the path's state is unchanged, and to check that the data volume has free space and is writable (D12); got ${show(s)}`);
  noBang(r, what);
  const offFailed = { ok: false, code: 'http-500', httpStatus: 500, body: { success: false, error: 'could not turn the path off', code: 'EIO', unlinkCode: 'EACCES' } };
  what = 'switchOutcome(http-500 EIO, false) [ADR 0005 D12]';
  r = outcome(offFailed, false);
  assert(outcomeOf(r, what) === 'failed', `${what}: expected failed; got ${show(r)}`);
  assert(stringsIn(r).includes('EIO'), `${what}: it must carry the answer's code EIO (D12 "with body.code"); got ${show(r)}`);
  s = sentenceOf(r);
  assert(/could not be turned off/i.test(s) && /still on/i.test(s),
    `${what}: a failed off says the path could not be turned off and is still on as before (D12); got ${show(s)}`);
  noBang(r, what);
  const others = [
    { ok: false, code: 'http-400', httpStatus: 400, body: { success: false, error: 'the body must be {"on": true} or {"on": false}' } },
    { ok: false, code: 'http-415', httpStatus: 415, body: { success: false, error: 'the body must be JSON' } },
    { ok: false, code: 'http-404', httpStatus: 404, body: null },
    { ok: false, code: 'http-502', httpStatus: 502, body: null },
  ];
  for (const on of [true, false]) {
    for (const res of others) {
      what = `switchOutcome(${res.code}, ${on}) [ADR 0005 D12]`;
      r = outcome(res, on);
      assert(outcomeOf(r, what) === 'failed', `${what}: expected failed (any other non-2xx); got ${show(r)}`);
    }
  }
});

test('TV82: a failed change whose answer carries no body.code did not come from the switch handler — a body-less 404 (an older backend) or a 502 with no JSON (a proxy), for either target — so its sentence names no data-volume remedy ("free space", "writable"), claims no state ("unchanged", "still on", "as before", is or was on or off), and says the state shown is from the next read; an answer that carries the handler\'s body.code (the 500s, D11) keeps the data-volume remedy for either target [story 5 AC-4 "Refused or failed … the panel shows the reason"; ADR 0005 D11 (every 500 the handler gives carries code), D12 "failed: any other non-2xx, with body.code"; story 5\'s review, round 1, requested 6]', async () => {
  // Review round 1, requested 6. Every 500 handleRealtimeSwitch gives carries an allow-listed code, and its refusals
  // (401, 403, 400, 415) answer before the change is made, so an answer with no body at all never came from the switch
  // and cannot say what the path's state is. The 400 and 415 bodies carry no code either; their sentence is not pinned.
  const outcome = await switchOutcomeFn();
  const noCode = [
    { ok: false, code: 'http-404', httpStatus: 404, body: null },
    { ok: false, code: 'http-502', httpStatus: 502, body: null },
  ];
  // A state named as fact; "whether the path is on or off" asks rather than claims, so it passes.
  const claimsState = new RegExp('\\bunchanged\\b|\\bstill (on|off)\\b|\\bas before\\b'
    + '|\\b(remains|remained|stays|stayed) (on|off)\\b'
    + '|(?<!\\b(?:whether|if)\\b[^.]{0,40})\\b(is|was) (now )?(on|off)\\b', 'i');
  const answer500 = (body) => ({ ok: false, code: 'http-500', httpStatus: 500, body: { success: false, ...body } });
  const handler = [
    answer500({ error: 'could not write the switch: ENOSPC', code: 'ENOSPC' }),
    answer500({ error: 'could not write or remove the switch: EIO, EACCES', code: 'EIO', unlinkCode: 'EACCES' }),
  ];
  const bad = [];
  for (const on of [true, false]) {
    for (const res of noCode) {
      const what = `switchOutcome(${res.code}, no body, ${on})`;
      const r = outcome(res, on);
      if (outcomeOf(r, what) !== 'failed') {
        bad.push(`${what}: expected failed (any other non-2xx); got ${show(r)}`);
        continue;
      }
      const t = sentenceOf(r);
      if (/free space|writable/i.test(t)) {
        bad.push(`${what}: names the data-volume remedy, though the answer never came from the switch; got ${show(t)}`);
      }
      const claim = claimsState.exec(t);
      if (claim) {
        bad.push(`${what}: claims the path's state (${show(claim[0])}), which a code-less answer cannot tell; ` +
          `got ${show(t)}`);
      }
      if (!/\bnext\b[^.]*\bread/i.test(t)) {
        bad.push(`${what}: does not say the state shown is from the next read; got ${show(t)}`);
      }
      noBang(r, what);
    }
    for (const res of handler) {
      const what = `switchOutcome(http-500 ${res.body.code}, ${on})`;
      const r = outcome(res, on);
      if (outcomeOf(r, what) !== 'failed') {
        bad.push(`${what}: expected failed; got ${show(r)}`);
        continue;
      }
      if (!stringsIn(r).includes(res.body.code)) {
        bad.push(`${what}: does not carry the answer's code ${res.body.code}; got ${show(r)}`);
      }
      const t = sentenceOf(r);
      if (!/free space/i.test(t) || !/writable/i.test(t)) {
        bad.push(`${what}: an answer carrying the handler's code keeps the data-volume remedy (free space, ` +
          `writable); got ${show(t)}`);
      }
    }
  }
  assert(bad.length === 0, 'a code-less failure has its own sentence per target (ADR 0005 D12, refined at review round '
    + `1; story 5's review, requested 6):\n      - ${bad.join('\n      - ')}`);
});

// ─── runner ────────────────────────────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- tagging pipeline view model tests (epic tagging-edges, Story 4 — ADR 0004 § UI, T1–T6) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ntagging-pipeline-view: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, skipped: 0, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
