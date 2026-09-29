#!/usr/bin/env node
/**
 * The real-time path's engine (tagging-edges story 3, ADR tagging-edges/0003 and its amendment A1; the seam is
 * clarification T20).
 *
 * Hears every write to this instance's relay through one live subscription and keeps the graph's `TAGS` following
 * the relay, one address at a time, from strict reads taken graph-first. A delivery is a trigger, never state
 * (ADR 0002 binding 3): every decision reads the relay again. Writes go only through graph.js's port, at most 25 rows
 * per call sorted by (from, to); removals only on the author's revoke (D4-A, gateAction; for a refused version, also on
 * a version stored at the address). It never creates what the backfill owns (the first-start baseline B), catches up
 * by an address-keyed id diff after any downtime (D3-A), re-looks after an overlapping pass (D6-A), and bounds its
 * memory and work whatever anyone publishes.
 *
 * The lineage (A1-1, A1-2): the engine feeds the planner's per-address lineage in the relay's store order, without
 * reading a created_at. A delivery is learned when it is drained; a strict read or a stamp scan at its capture, a
 * counter taken just before its strfry process is spawned, and it teaches nothing at an address where anything was
 * learned after that capture. A version the graph records below a version a read placed joins `older`, and so does
 * each id a baseline start's census reads first (A1-8). A round gates each removal on its copy of the lineage taken
 * when it decides the address, before its own read is learned (A1-4). Nothing discards a revoke prompt (A1-5).
 *
 * The journal (A1-6): every line that changes a lineage is absolute (`v`, `o`); each compaction writes record.json
 * with a new epoch and opens the journal's next generation with `e {epoch}`, so a truncation that failed never
 * replays an older generation over the record. A start whose journal was not read whole demotes every restored top.
 *
 * The pure decisions live in src/lib/tagging-edges/realtime.js (the planner) and sweep.js (decideAddress); this file
 * owns the loop, first start and census, catch-up, rounds and their time-out handling (A1-13) and catch-up share
 * (A1-14), switch poll, re-looks, dead-pass tracking, journal flushing and status writes. It holds no lock of the
 * pass's, takes no scoring lease and never writes the pass's report (binding 4).
 *
 *   createEngine(deps) → { start(), tick(), handleSignal(name), status() }      (T20)
 *   run(deps)          start(), then tick() in a loop with deps.sleep(≤ 250 ms) until an exit; the code is left on
 *                      deps.proc.exitCode (never process.exit)
 *
 * Subscription callbacks only buffer; tick() drains them. tick() never sleeps (T29): it starts at most one activity at
 * a time (a census, a baseline, one of a catch-up's reads, or a round) and returns once that settles or one event-loop
 * turn passes, so the switch poll, the journal flush and the status keep their cadence while a strfry read or a
 * transaction is slow. No round waits for a catch-up to finish, and a due round runs between two of its reads (A1-11).
 * Started by run.sh under supervisord, which holds realtime/daemon.lock on fd 8; a hand run is refused.
 */

const path = require('path');
const {
  LIMITS, subscriptionFilters, promptFromVersion, newMaps, recordId, resolveDeletion, shrinkOnRead, compact,
  arrivalsAndLookOnly, deletionCandidates, deletionScanFilters, isExpectedDeletion, addressScanFilters,
  isExpectedAddressEvent, elementScanFilters, isExpectedElementEvent, relayAtAddress, mergePrompt,
  gateAction, passOverlaps, roundOrder, journalLine, replayJournal, allowErrorCode,
  learnVersion, learnOlder, lineageAt, lineageValue, setLineage, pruneLineage,
} = require('../../../lib/tagging-edges/realtime');
const {
  RUN_ID_RE, isExpectedScanEvent, isTaggingAddress, decideAddress, groupSnapshot, storedFromRow,
} = require('../../../lib/tagging-edges/sweep');
const { taggingToEdge, revokeTargets } = require('../../../lib/tagging-edges/contract');
const { redactPublicText } = require('../../../lib/strfryScanStrict');
const { schemaStatusFromRows } = require('../graph');
const { resolveIdentities } = require('../identities');
const { preimageRecords } = require('../preimage');
const { makeRunId } = require('../reconcileTaggingEdges');

const LOCK_FD = 8;
const SEC = 1000;
const MIN = 60 * SEC;
const TICK_MS = 250; // run()'s wait between ticks while idle (T20: ≤ 250 ms)
const BUSY_TICK_MS = 25; // … and while an activity is in flight, so the next round follows it closely
const SWITCH_POLL_MS = SEC;
const STOP_GRACE_MS = 2 * SEC; // an in-flight port call gets this long after an off or a signal
const RELOOK_CHECK_MS = 5 * SEC;
const ROUND_DELAY_MS = 250; // a round starts 250 ms after the first prompt queued while idle (a cap, not a reset)
const CATCH_UP_SPACING_MS = 30 * SEC;
const SAFETY_DIFF_MS = 10 * MIN;
const STATUS_CHANGE_MS = 2 * SEC; // a change reaches status.json within this (the ADR allows 10 s)
const STATUS_HEARTBEAT_MS = 30 * SEC;
const SCHEMA_CACHE_MS = 5 * SEC;
const SCHEMA_WAIT_MS = 15 * SEC;
const SCHEMA_READ_TIMEOUT_MS = 30 * SEC; // the path's own bound: graph.js's readSchema keeps none, as the pass reads it
const ROUND_SCAN_TIMEOUT_MS = 20 * SEC;
const CANDIDATE_SCAN_TIMEOUT_MS = 60 * SEC;
const CENSUS_TIMEOUT_MS = 10 * SEC; // A1-8: the census's one best-effort key read; the REQ waits at most this long
const LATE = Symbol('late'); // what a census past its deadline resolves to
const STAMP_SCAN_TIMEOUT_MS = 10 * MIN;
const GRAPH_READ_TIMEOUT_MS = 60 * SEC;
const KEYS_TIMEOUT_MS = 120 * SEC;
const WRITE_TIMEOUT_MS = 30 * SEC;
const LOST_RACE_LIMIT = 5;
const LOST_RACE_BACKOFF_MS = 10 * SEC;
const PARK_RETRY_MS = Object.freeze([5 * MIN, 30 * MIN, 6 * 60 * MIN]);
const TIMEOUT_PARK = 'timeout'; // A1-13: the code of a park for an address's own reads timing out
const SINGLE_TIMEOUTS_TO_PARK = 3; // A1-13: consecutive time-outs of its own reads before an address is parked
const MAX_ACTIVITIES_PER_TICK = 16;
const SHARE_BYTES = Math.floor(LIMITS.roundKeptBytes / 5); // the catch-up's reserved share of a round's kept budget
const LANE_RANK = Object.freeze({ live: 0, relook: 1, catchup: 2 });
const AUTH_CODES = Object.freeze([
  'Neo.ClientError.Security.Unauthorized',
  'Neo.ClientError.Security.AuthenticationRateLimit',
  'Neo.ClientError.Security.CredentialsExpired',
]);
const TX_TRANSIENT_RE = /\.(TransactionTimedOut|TransactionTimedOutClientConfiguration|LockClientStopped)$/;
const LOST_REASONS = Object.freeze(['record-missing', 'record-unreadable', 'journal-unreadable', 'identity-changed']);

/** The status carries fixed text only, chosen by stage (ADR § Status: "All text is fixed"). */
const STAGE_TEXT = Object.freeze({
  'relay-read': 'a relay read failed',
  'element-read': 'a tag element read failed',
  'graph-read': 'the graph could not be read',
  'graph-write': 'a write to the graph failed',
  schema: 'the database rules could not be checked',
  config: 'the database driver could not be opened',
  'catch-up': 'a catch-up read failed',
  baseline: 'the first-start relay read failed',
  journal: 'the journal could not be written',
  record: 'record.json could not be written',
  status: 'status.json could not be written',
  unexpected: 'an unexpected error',
});

/** The real dependencies, required lazily so this module loads stack-free. */
function defaultDeps() {
  const state = require('../state');
  const children = new Set();
  // strfry scan children, so an off can SIGKILL a read still running (ADR "Off means off within 5 s", step 2).
  const spawnImpl = (...args) => {
    const child = require('child_process').spawn(...args);
    if (child && typeof child.on === 'function') {
      children.add(child);
      child.on('close', () => children.delete(child));
    }
    return child;
  };
  let startTime = null;
  try { startTime = state.processStartTime(process.pid); } catch (_) { startTime = null; }
  return {
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    env: process.env,
    identities: {
      // The ADR 0015 literal, from its one server home — never copied here (as the pass runner does).
      canonicalZ: () => require('../../../api/profile-tags').NOSTR_USER_TAG_Z_TAG,
      getOwnerAssistantPubkey: () => require('../../../utils/assistantKeys').getOwnerAssistantPubkey(),
    },
    openGraph: (cfg) => require('../graph').openGraph(cfg),
    scan: (filter, opts) => require('../../../lib/strfryScanStrict').scanStrict(filter, { ...opts, spawnImpl }),
    killScans: () => { for (const c of children) { try { c.kill('SIGKILL'); } catch (_) { /* gone */ } } },
    subscribe: (opts) => require('./subscription').subscribe(opts),
    store: require('./store').createStore(),
    state: {
      readReport: () => state.readReport(),
      isAlive: (record) => state.isAlive(record),
      appendPreimages: (runId, records) => state.appendPreimages(runId, records),
    },
    proc: { pid: process.pid, startTime, exitCode: undefined },
    randomId: () => require('crypto').randomBytes(4).toString('hex'),
    log: (line) => console.log(line),
  };
}

function iso(ms) { return new Date(ms).toISOString(); }
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const errCode = (err) => (err && typeof err.code === 'string' ? err.code : '');
/** 5 s, doubling, capped: the n-th consecutive failure's wait (n from 1). */
const backoff = (n, from, cap) => Math.min(cap, from * 2 ** Math.max(0, n - 1));
/**
 * The wait before the n-th consecutive reconnect (n from 0): 1 s, doubling, at most 15 s (ADR "Keeping it alive"). The
 * one copy of the schedule: subscription.js never reconnects by itself.
 */
const reconnectDelay = (n) => Math.min(15 * SEC, SEC * 2 ** Math.min(Math.max(0, n), 4));
const turn = () => new Promise((resolve) => setImmediate(resolve));

/**
 * What the log says of a closed subscription: subscription.js's fixed reason (a relay refusing the filters shows as
 * 'filter refused (…)', not only as a reconnect loop) and the socket's close code; any other text is redacted.
 */
function closeText(info) {
  const reason = isPlainObject(info) && typeof info.reason === 'string' && info.reason !== ''
    ? redactPublicText(info.reason).slice(0, 80) : 'no reason given';
  return isPlainObject(info) && Number.isInteger(info.code) ? `${reason}, code ${info.code}` : reason;
}

/**
 * How a failure is handled (ADR § Failure handling): 'unavailable' (the graph is gone: wait and probe), 'auth'
 * (back off, never feed the lockout), 'tx' (a time-out or stopped lock client: transient, backed off, never bisected
 * or parked), 'local' (a pre-image append that failed: backed off) or 'refused' (the database keeps refusing a row).
 */
function errorClass(err) {
  if (err && err.taggingEdgesPreimage) return 'local';
  const code = errCode(err);
  if (TX_TRANSIENT_RE.test(code)) return 'tx';
  if (code === 'ServiceUnavailable' || code === 'SessionExpired' || code.startsWith('Neo.TransientError.')) return 'unavailable';
  if (AUTH_CODES.includes(code)) return 'auth';
  return 'refused';
}

function emptyCounts() {
  return {
    added: 0,
    changed: 0,
    changedBy: { newer: 0, older: 0, moved: 0, refreshed: 0, repaired: 0 },
    removed: 0,
    removedBy: { 'not-on-relay': 0, 'non-tagging': 0 },
    unchanged: 0,
    peopleAdded: 0,
    refused: { total: 0, byReason: {} },
    leftInPlace: { total: 0, byReason: {} },
    deletionsMatchedNothing: 0,
    deletionsForeign: 0,
    failedReads: { relay: 0, graph: 0, element: 0, catchUp: 0 },
    lostRaces: { create: 0, update: 0, move: 0, remove: 0 },
    dbRefused: { total: 0, byReason: {} },
    heldPreExisting: 0,
    removalsNotPrompted: 0,
    relooks: 0,
    conflicts: 0,
    droppedOverBacklog: 0,
  };
}

/** The counts status.json held, laid over fresh ones: numbers only, so a damaged file cannot poison them. */
function restoreCounts(prev) {
  const out = emptyCounts();
  const lay = (into, from) => {
    for (const [k, v] of Object.entries(from)) {
      if (typeof v === 'number' && Number.isFinite(v) && (into[k] === undefined || typeof into[k] === 'number')) into[k] = v;
      else if (isPlainObject(v) && isPlainObject(into[k])) lay(into[k], v);
    }
  };
  lay(out, prev);
  if (prev.countsReset === true) out.countsReset = true;
  return out;
}

/**
 * Merge a whole entry into another by mergePrompt's rules (restored work, re-looks, a round's entry put back). The
 * planner's mergeEntry (src/lib/tagging-edges/realtime.js), which the journal's replay uses, is the same function: T2's
 * exports do not list it, so each module keeps a copy, and a change to one is made to both.
 */
function mergeEntry(entry, more) {
  let e = mergePrompt(entry || null, null);
  if (!isPlainObject(more)) return e;
  if (isPlainObject(more.version) && typeof more.version.id === 'string') e = mergePrompt(e, { type: 'version', id: more.version.id });
  for (const p of Array.isArray(more.revokes) ? more.revokes : []) if (isPlainObject(p)) e = mergePrompt(e, { ...p, type: 'revoke' });
  if (more.look === true) e = mergePrompt(e, { type: 'look' });
  return e;
}

/** The event id a snapshot row records (its eventId property as a string), or null. */
function storedEventIdOf(row) {
  const s = storedFromRow(row);
  return typeof s.edge.eventId === 'string' ? s.edge.eventId : null;
}

/** The id of the version a relay read returned at an address (an edge's or a refusal's), or null. */
function relayVersionId(relayAt) {
  return relayAt && relayAt.conflict !== true && typeof relayAt.eventId === 'string' ? relayAt.eventId : null;
}

/** An event as a round keeps it: the contract never reads content or sig, so a padded event costs its tags only. */
function slim(ev) {
  const { content, sig, ...rest } = ev;
  return rest;
}
const eventBytes = (ev) => Buffer.byteLength(JSON.stringify(ev), 'utf8') + 1;

/**
 * About how many bytes record.json takes for `body`, row by row (never the whole body as one string): the compaction
 * cadence's measure when the store's writeRecord does not report the size it wrote (A1-6).
 */
function recordSize(body) {
  if (!isPlainObject(body)) return 0;
  let n = 2;
  for (const [k, v] of Object.entries(body)) {
    n += Buffer.byteLength(k, 'utf8') + 4;
    if (Array.isArray(v)) {
      for (const row of v) n += Buffer.byteLength(JSON.stringify(row === undefined ? null : row), 'utf8') + 2;
    } else if (v !== undefined) {
      n += Buffer.byteLength(JSON.stringify(v) || '', 'utf8');
    }
  }
  return n;
}

/** The address one `{ kinds: [39999], authors: [pk], '#d': [d] }` filter reads. */
const addressOfFilter = (f) => `39999:${f.authors[0]}:${f['#d'][0]}`;


/** Order write rows by (from, to) (ADR 0002 C16; T29): creates, updates and moves by the desired edge, removals by the snapshot. */
function byEnds(kind) {
  const ends = (w) => (kind === 'remove'
    ? [String(w.row.fromPubkey), String(w.row.toPubkey)]
    : [String(w.desired.from), String(w.desired.to)]);
  return (a, b) => {
    const ka = [...ends(a), a.address];
    const kb = [...ends(b), b.address];
    for (let i = 0; i < 3; i += 1) {
      if (ka[i] < kb[i]) return -1;
      if (ka[i] > kb[i]) return 1;
    }
    return 0;
  };
}

// ─── the engine ──────────────────────────────────────────────────────────────────────────────────────────────

function makeEngine(deps) {
  const store = deps.store;
  const st = deps.state;
  const env = deps.env || {};
  const now = () => deps.now();
  const log = (line) => { try { deps.log(`[tagging-edges-realtime] ${line}`); } catch (_) { /* logging is best effort */ } };

  // The process.
  let startedAtMs = null;
  let sessionId = null;
  let identities = null; // { canonicalPubkey, localPubkey } once they resolve
  let stampFilter = null;
  let subFilters = null;
  let setupProblem = null;
  let firstStartedAt = null;
  let counts = emptyCounts();

  // The maps (T3) and the work.
  let maps = newMaps();
  let seq = 0; // the maps' recording counter (T7's captureSeq)
  let queueSeq = 0; // queue order within a lane (T18)
  const pending = new Map(); // address → item
  const inFlight = new Map(); // address → the item a running round holds
  const rechecks = new Map(); // address → Map<runId, entry>: re-looks waiting for their pass (de-duplicated by both)
  const parked = new Map(); // address → { code, entry, level, nextAt, single }
  const learnSeq = new Map(); // address → the counter at the last version the path learned there (in memory; A1-2)
  // A1-7: while a catch-up runs, the ids learned at each address after its key read (a delivery, a read, a scan, or the
  // graph's version beside one), its stamp scan's own placement aside: its compaction keeps these in `older`. { from
  // (a counter taken at the key read), capture (the stamp scan's, once taken), ids: Map<address, Set<id>> }, trimmed
  // to the lineage's own ids; in memory only, and gone when that catch-up ends.
  let learnedSince = null;
  let heardN = 0; // A1-1: addresses whose top is not in S (the status's heard), kept as a counter, not walked per tick
  let lastRuns = []; // the report's runs at the last read, with alive flags (A1-7's pass exception)
  let deadSeenAt = {};
  const watchedRuns = new Set(); // runs that overlapped a round: their end schedules one catch-up
  let graphAddresses = new Set(); // the graph's tagging addresses at the last readKeys, plus the path's own creates
  let skippedLines = 0;
  let baselineDropped = false; // a `b` line waits for the drain's one fsync
  // A1-6: the journal's generations. Each compaction writes record.json with a new epoch, greater than every epoch this
  // process knows of (the record's, and every `e` line its replay passed), then starts the journal with `e {epoch}`.
  let lastEpoch = 0;
  // A1-6, the compaction cadence: record.json's size at its last write (or read), so a round-end compaction waits until
  // the journal passes the larger of 1 MB and a quarter of it.
  let recordBytes = 0;
  let regroupSeq = 0; // A1-13: tokens naming a timed-out group to be re-read as one group

  // The first start (or a lost record's re-baseline): { mode: 'first' | 'rebaseline', buffer, liveIds }.
  let baseline = null;
  let baselineRetryAt = 0;
  let baselineFailures = 0;
  let baselineDone = false;
  let notEstablished = null; // a lost record's reason, reported by the catch-up that follows the re-baseline
  // A1-8: a start that takes a baseline (a first start, a lost record's re-baseline) reads the graph's keys once
  // before its REQ (the census). `census` is null (none due or it has ended) or { state: 'due' | 'running', deadline,
  // giveUp }; `censusAt` keeps what it read until the baseline places the scan over it.
  let census = null;
  let censusAt = null; // address → the graph's event id there, or its ids when the graph's rows conflict

  // The subscription.
  let subGen = 0;
  let sub = null; // { gen, handle, eose }
  let everConnected = false;
  let reconnectAt = 0;
  let reconnectAttempts = 0;
  const inbox = [];
  const subscription = { connected: false, since: null, lastEventAt: null };

  // The catch-up (D3-A) and the safety diff.
  const cu = { requested: null, again: null, retryAt: 0, failures: 0, retrying: false, lastStartAt: null, running: null, last: null };
  let nextSafetyAt = Infinity;

  // The graph.
  let graph = null;
  let graphWaiting = false;
  let graphFailures = 0;
  let graphRetryAt = 0;
  let schemaOkAt = null;
  let schemaCheckedAt = -Infinity;

  // Timers, the journal, the status, the stop.
  let nextSwitchPollAt = 0;
  let nextRelookAt = 0;
  let lines = [];
  let lastFlushAt = -Infinity;
  let lastStatus = null;
  let lastStatusBody = null;
  let statusWrittenAt = -Infinity;
  let lastError = null;
  let lastReadOkAt = null;
  let relayAnswers = 0; // relay reads that answered, counted: a single's stall-or-slow test (A1-13; clarification 11)
  let lastReflectedAt = null;
  let lastRound = null;
  let preimageFile = null;
  let activity = null;
  let stopping = null; // 'off' | 'signal'
  let stopStartedAt = null;
  let exited = false;
  let offAtStart = false;
  let crashed = false; // an error escaped start() or tick(), or was uncaught: Node exits after the status says so

  // ─── errors and status text ──────────────────────────────────────────────────────────────────────────────

  /** A relay read answered in full: the status's relay.lastReadOkAt, and the count a single's time-out is judged by. */
  function relayAnswered() {
    lastReadOkAt = iso(now());
    relayAnswers += 1;
  }

  function noteError(stage, err) {
    const code = allowErrorCode(errCode(err) || 'error');
    lastError = { at: iso(now()), stage, code, text: STAGE_TEXT[stage] || STAGE_TEXT.unexpected };
    const message = err && err.message ? redactPublicText(String(err.message)).slice(0, 300) : '';
    log(`${stage} failed: ${errCode(err) ? redactPublicText(errCode(err)).slice(0, 80) : 'error'}${message ? ` — ${message}` : ''}`);
  }

  // ─── the journal ─────────────────────────────────────────────────────────────────────────────────────────

  function addLine(obj) { lines.push(journalLine(obj)); }

  function flushJournal() {
    if (exited || lines.length === 0) return;
    const out = lines;
    lines = [];
    lastFlushAt = now();
    try {
      store.appendJournal(out);
    } catch (err) {
      lines = out.concat(lines); // kept for the next flush (the store cuts a failed append back off)
      noteError('journal', err);
    }
  }

  /** A1-9: a running catch-up's work not yet fed to the queue (its found revokes included), as catch-up rows. */
  function unfedWork() {
    const c = cu.running;
    if (!c || !c.backlog) return [];
    const out = [];
    for (let i = c.next; i < c.backlog.length; i += 1) {
      const x = c.backlog[i];
      if (x) out.push({ a: x[0], entry: x[1], lane: 'catchup', attempts: 0, notBefore: 0 });
    }
    return out;
  }

  /**
   * record.json from the whole state, then a new journal generation: one synchronous step (ADR "Compaction"; A1-6).
   * The record carries a new epoch; the journal is truncated and started with `e {epoch}`, so replay applies only what
   * follows. A truncation that fails leaves the older generation's lines before that `e` line, and replay skips them.
   */
  function snapshot() {
    if (exited) return;
    const itemRecord = (it) => ({ a: it.address, entry: it.entry, lane: it.lane, attempts: it.failures, notBefore: it.notBefore });
    const epoch = Math.max(now(), lastEpoch + 1);
    const body = {
      version: 1,
      epoch,
      firstStartedAt,
      identities: { canonical: identities.canonicalPubkey, local: identities.localPubkey },
      compactedAt: iso(now()),
      seen: [...maps.S].map(([id, e]) => [id, e.a]),
      baseline: [...maps.B],
      refusedSeen: [...maps.R].map(([id, e]) => [id, e.a]),
      lineage: [...maps.L].map(([a, lin]) => (lin.older === null ? [a, lin.top] : [a, lin.top, [...lin.older]])),
      pending: [...inFlight.values(), ...pending.values()].map(itemRecord).concat(unfedWork()),
      rechecks: [...rechecks].flatMap(([a, byRun]) => [...byRun].map(([runId, entry]) => ({ a, runId, entry }))),
      deadSeenAt: { ...deadSeenAt },
      parked: [...parked].map(([a, p]) => ({ a, code: p.code, attempts: p.level, nextAt: p.nextAt, entry: p.entry })),
    };
    let written;
    try {
      written = store.writeRecord(body);
    } catch (err) {
      noteError('record', err); // the journal keeps its generation and its buffered lines
      return;
    }
    lastEpoch = epoch;
    recordBytes = typeof written === 'number' && Number.isFinite(written) ? written : recordSize(body);
    try {
      store.truncateJournal();
    } catch (err) {
      noteError('journal', err);
    }
    // What was buffered is in the record. The new generation starts with its `e` line, appended at once (a failed
    // append keeps it first in the buffer for the next flush: A1 clarification 4).
    lines = [journalLine({ t: 'e', epoch })];
    flushJournal();
  }

  // ─── the status ──────────────────────────────────────────────────────────────────────────────────────────

  /**
   * The status's `heard`: addresses whose latest learned version the path has not completed (A1-1). Kept as a counter,
   * adjusted where a top changes or an id enters or leaves S, and counted afresh only where the maps are rebuilt or
   * compacted wholesale anyway (a start's replay, a baseline, a catch-up's compaction).
   */
  const heardAt = (a) => {
    const lin = typeof a === 'string' ? maps.L.get(a) : null;
    return lin && lin.top !== null && !maps.S.has(lin.top) ? 1 : 0;
  };
  function recountHeard() {
    let n = 0;
    for (const lin of maps.L.values()) if (lin.top !== null && !maps.S.has(lin.top)) n += 1;
    heardN = n;
  }
  /** Run `fn`, which changes tops or S only at `addresses`, keeping heardN in step. → fn's result */
  function keepingHeard(addresses, fn) {
    const at = [...new Set(addresses.filter((a) => typeof a === 'string'))];
    let before = 0;
    for (const a of at) before += heardAt(a);
    const r = fn();
    let after = 0;
    for (const a of at) after += heardAt(a);
    heardN += after - before;
    return r;
  }
  /** The address where `id` is the lineage's top, if any (the planner's top index). */
  const topAddressOf = (id) => (maps.tops instanceof Map ? maps.tops.get(id) : undefined);

  function currentState() {
    if (crashed) return 'stopped';
    if (exited || stopping) return stopping === 'signal' ? 'stopped' : 'off';
    if (setupProblem) return 'waiting-setup';
    if (graphWaiting) return 'waiting-graph';
    if (!subscription.connected) return everConnected || reconnectAttempts > 0 ? 'waiting-relay' : 'starting';
    if (baseline && baseline.mode === 'first') return 'starting';
    if (cu.running || baseline) return 'catching-up';
    return 'live';
  }

  function catchUpStatus() {
    const c = cu.running;
    return {
      underway: !!c,
      current: c ? {
        startedAt: iso(c.startedAt),
        trigger: c.trigger,
        arrivals: c.arrivals,
        lookOnly: c.lookOnly,
        deletionsFound: c.deletionsFound,
        remaining: c.outstanding ? c.outstanding.size + (c.backlog ? c.backlog.length - c.next : 0) : null,
      } : null,
      last: cu.last,
    };
  }

  function statusObject(t) {
    let bytes = null;
    try { bytes = store.journalBytes(); } catch (_) { bytes = null; }
    return {
      state: currentState(),
      firstStartedAt,
      relay: { lastReadOkAt },
      subscription: { ...subscription },
      lastReflectedAt,
      lastRound,
      catchUp: catchUpStatus(),
      counts,
      pending: pending.size + inFlight.size,
      parked: parked.size,
      seen: maps.S.size,
      heard: heardN,
      journal: { bytes: typeof bytes === 'number' ? bytes : null, skippedLines },
      setupProblem,
      lastError,
      preimageFile,
      process: { pid: deps.proc ? deps.proc.pid : null, startTime: deps.proc ? deps.proc.startTime : null, startedAt: iso(startedAtMs) },
      updatedAt: iso(t),
    };
  }

  /** Write status.json within STATUS_CHANGE_MS of a change, and as a 30 s heartbeat; `force` writes now. */
  function writeStatus(force) {
    if (exited) return;
    const t = now();
    const obj = JSON.parse(JSON.stringify(statusObject(t)));
    const body = JSON.stringify({ ...obj, updatedAt: null });
    const due = force
      || (body !== lastStatusBody && t - statusWrittenAt >= STATUS_CHANGE_MS)
      || t - statusWrittenAt >= STATUS_HEARTBEAT_MS;
    if (!due) return;
    statusWrittenAt = t; // a failed write is retried at the change interval, not every tick
    try {
      store.writeStatus(obj);
      lastStatus = obj;
      lastStatusBody = body;
    } catch (err) {
      noteError('status', err);
    }
  }

  /**
   * AC-6: the status survives restarts and deploys. A start carries on from status.json the last error (its code
   * re-checked and its fixed text re-derived from its stage, never copied), when the path last reflected a change, and
   * its last round, until newer ones replace them; a field that does not check out stays empty.
   */
  function restoreStatusFields(prev) {
    const isoAt = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v))
      && new Date(Date.parse(v)).toISOString() === v;
    const e = prev.lastError;
    if (isPlainObject(e) && isoAt(e.at)) {
      const stage = typeof e.stage === 'string' && has(STAGE_TEXT, e.stage) ? e.stage : 'unexpected';
      lastError = { at: e.at, stage, code: allowErrorCode(e.code), text: STAGE_TEXT[stage] };
    }
    if (isoAt(prev.lastReflectedAt)) lastReflectedAt = prev.lastReflectedAt;
    const r = prev.lastRound;
    if (isPlainObject(r) && Number.isFinite(r.ms) && Number.isFinite(r.addresses)) {
      lastRound = { ms: r.ms, addresses: r.addresses };
    }
  }

  // ─── the queue ───────────────────────────────────────────────────────────────────────────────────────────

  function newItem(address, lane) {
    return {
      address, lane, entry: mergePrompt(null, null), seq: ++queueSeq, notBefore: 0, due: Infinity,
      failures: 0, losses: 0, lastCode: null, parkedCode: null, parkLevel: 0, relookRuns: null,
      single: false, regroup: null, timeoutsAlone: 0, // A1-13: read alone; re-read as one group; own time-outs in a row
      answersAt: relayAnswers, // the relay's answer count when it was queued, then at its last single time-out
    };
  }

  /**
   * Queue a prompt or a whole entry at a tagging address. A live prompt for an address not yet queued is dropped past
   * the backlog cap (never a re-look, catch-up work or a forced retry). → the item, or null when dropped.
   */
  function enqueue(address, lane, { prompt = null, entry = null, runId = null, force = false } = {}) {
    if (!isTaggingAddress(address)) return null;
    let item = pending.get(address);
    if (!item) {
      if (lane === 'live' && !force && pending.size >= LIMITS.backlogAddresses) return null;
      item = newItem(address, lane);
      pending.set(address, item);
    } else if (LANE_RANK[lane] < LANE_RANK[item.lane]) {
      item.lane = lane;
    }
    if (prompt) item.entry = mergePrompt(item.entry, prompt);
    if (entry) item.entry = mergeEntry(item.entry, entry);
    if (runId) (item.relookRuns || (item.relookRuns = new Set())).add(runId);
    item.due = Math.min(item.due, Math.max(item.notBefore, now() + ROUND_DELAY_MS));
    return item;
  }

  /** Put a round's item back: merged under any fresh item a delivery made meanwhile, due at `notBefore`. */
  function putBack(item, notBefore) {
    const fresh = pending.get(item.address);
    if (fresh) {
      item.entry = mergeEntry(item.entry, fresh.entry);
      if (LANE_RANK[fresh.lane] < LANE_RANK[item.lane]) item.lane = fresh.lane;
      if (fresh.relookRuns) for (const r of fresh.relookRuns) (item.relookRuns || (item.relookRuns = new Set())).add(r);
    }
    item.notBefore = notBefore;
    item.due = notBefore;
    pending.set(item.address, item);
  }

  /**
   * The path learned a version at an address (A1-2), journaled as an absolute `o` line when it changed the lineage
   * (`journal`; a delivery's own `v` line carries it instead). A delivery (`delivered`) becomes the top. A read or a
   * scan is learned at its capture (`at`): when something was learned at the address after that capture (`under`),
   * their order is unknown and it teaches nothing there, neither its version nor the graph's; otherwise its version
   * becomes the top, the previous top joins `older`, and so does the version the graph recorded there (`graphId`) when
   * it differs. → whether the lineage changed
   */
  function learned(address, id, { under = false, graphId = null, journal = true, at = null, delivered = false } = {}) {
    if (!delivered && under) return false;
    const n = at === null ? ++seq : at;
    // The graph's version(s) beside it: a round's graph row, a catch-up's key, or a baseline's census rows (A1-8).
    const graphIds = delivered ? [] : (Array.isArray(graphId) ? graphId : [graphId]).filter((g) => typeof g === 'string' && g !== id);
    let changed = keepingHeard([address, topAddressOf(id)], () => learnVersion(maps, address, id));
    for (const g of graphIds) changed = learnOlder(maps, address, g) || changed;
    learnSeq.set(address, Math.max(learnSeq.get(address) || 0, n));
    if (learnedSince && n > learnedSince.from && n !== learnedSince.capture) noteLearned(address, [id, ...graphIds]);
    if (changed && journal) addLine({ t: 'o', a: address, ...lineageValue(maps, address) });
    return changed;
  }

  /** A1-7: ids learned at `address` after the running catch-up's capture; ids its lineage no longer holds go. */
  function noteLearned(address, ids) {
    const at = learnedSince.ids;
    let m = at.get(address);
    if (!m) { m = new Set(); at.set(address, m); }
    for (const x of ids) m.add(x);
    const lin = maps.L.get(address);
    for (const x of [...m]) if (!lin || (lin.top !== x && !(lin.older !== null && lin.older.has(x)))) m.delete(x);
    if (m.size === 0) at.delete(address);
  }

  /** Keep a re-look of `address` for pass `runId`, merged with any held (T19's r line). → whether it is new */
  function keepRecheck(address, runId, entry) {
    let byRun = rechecks.get(address);
    if (!byRun) { byRun = new Map(); rechecks.set(address, byRun); }
    const prev = byRun.get(runId);
    const merged = mergeEntry(prev || null, entry);
    byRun.set(runId, merged);
    return { isNew: !prev, merged };
  }

  /** A parked address back in the queue (a new event there, a successful write, its timer, or a start). */
  function unpark(address, lane) {
    const p = parked.get(address);
    if (!p) return;
    parked.delete(address);
    const item = enqueue(address, lane, { entry: p.entry, force: true });
    if (!item) return;
    item.parkedCode = p.code;
    item.parkLevel = p.level;
    if (p.single) item.single = true; // A1-13: the mark stays until its own read succeeds
    if (p.relookRuns) for (const r of p.relookRuns) (item.relookRuns || (item.relookRuns = new Set())).add(r);
    item.notBefore = 0;
    item.due = Math.min(item.due, now());
  }

  function droppedLive() {
    counts.droppedOverBacklog += 1;
    requestCatchUp('backlog');
  }

  // ─── what it hears ───────────────────────────────────────────────────────────────────────────────────────

  /**
   * A version delivered and drained (A1-2): the top at its address, and a version prompt, journaled as one absolute
   * `v {id, a, top, older}` line (A1-6). A first start's buffered versions were already learned, in drain order, with
   * its baseline scan (`learnNow` false): each `v` line then carries the lineage as the baseline left it — the scan's
   * version on top where it outranked the delivery — with no separate `o` line (A1-10).
   */
  function heard(id, address, { learnNow = true } = {}) {
    if (maps.B.has(id)) {
      // Just re-stored, so it is no longer held since before the first start (journal b, fsynced at once: at the end
      // of the drain that heard it, before anything can act on it).
      maps.B.delete(id);
      addLine({ t: 'b', id });
      baselineDropped = true;
    }
    if (learnNow || !maps.L.has(address)) learned(address, id, { journal: false, delivered: true });
    addLine({ t: 'v', id, a: address, ...lineageValue(maps, address) });
    if (parked.has(address)) unpark(address, 'live');
    if (!enqueue(address, 'live', { prompt: { type: 'version', id } })) droppedLive();
  }

  function deletion(ev) {
    const res = resolveDeletion(ev, maps, graphAddresses);
    counts.deletionsForeign += res.foreign;
    if (res.matchedNothing) counts.deletionsMatchedNothing += 1;
    for (const { address, prompt } of res.prompts) {
      addLine({ t: 'd', a: address, p: prompt });
      if (parked.has(address)) unpark(address, 'live');
      if (!enqueue(address, 'live', { prompt })) droppedLive();
    }
  }

  function takeEvent(ev) {
    subscription.lastEventAt = iso(now());
    if (!isPlainObject(ev)) return;
    if (ev.kind === 39999) {
      const p = promptFromVersion(ev, identities);
      if (!p) return;
      if (baseline && baseline.mode === 'first') {
        // Drained into the buffer: learned at this counter, with the baseline scan (A1-2, A1-10).
        baseline.buffer.versions.push({ ...p, seq: ++seq });
        baseline.buffer.ids.add(p.id);
        return;
      }
      if (baseline && baseline.liveIds) baseline.liveIds.add(p.id);
      heard(p.id, p.address);
    } else if (ev.kind === 5) {
      if (baseline && baseline.mode === 'first') { bufferDeletion(ev, baseline.buffer); return; }
      deletion(ev);
    }
  }

  /**
   * A first start's kind-5, kept until the baseline as only what could resolve (T32): its lower-case ids, and its
   * tagging addresses of ≤ 255 bytes under its own pubkey. None → matched nothing. Past the backlog cap of targets it
   * is dropped and counted, and a catch-up follows the baseline (its candidate scan finds the revoke again).
   */
  function bufferDeletion(ev, buffer) {
    const named = revokeTargets(ev);
    const addresses = named.addresses.filter((a) => isTaggingAddress(a)
      && Buffer.byteLength(a, 'utf8') <= LIMITS.aTargetMaxBytes && a.split(':')[1] === ev.pubkey);
    const n = named.eventIds.length + addresses.length;
    if (n === 0) { counts.deletionsMatchedNothing += 1; return; }
    if (buffer.targets + n > LIMITS.backlogAddresses) { droppedLive(); return; }
    buffer.targets += n;
    buffer.deletions.push({
      id: ev.id, pubkey: ev.pubkey, created_at: ev.created_at, kind: 5,
      tags: [...named.eventIds.map((id) => ['e', id]), ...addresses.map((a) => ['a', a])],
    });
  }

  function openSubscription() {
    subGen += 1;
    const gen = subGen;
    sub = { gen, handle: null, eose: false };
    if (baseline) {
      // A reconnect before the baseline is written restarts it from step 1: that gap reached no subscription.
      if (baseline.mode === 'first') baseline.buffer = { versions: [], deletions: [], ids: new Set(), targets: 0 };
      else baseline.liveIds = new Set();
    }
    const push = (m) => { if (gen === subGen) inbox.push(m); };
    try {
      sub.handle = deps.subscribe({
        url: env.TAGGING_EDGES_REALTIME_RELAY_URL || undefined,
        filters: subFilters,
        onEvent: (ev) => push({ gen, ev }),
        onEose: () => push({ gen, eose: true }),
        onClose: (info) => push({ gen, close: true, info }),
      });
    } catch (_) {
      sub = null;
      reconnectAt = now() + reconnectDelay(reconnectAttempts);
      reconnectAttempts += 1;
    }
  }

  function closeSubscription() {
    if (sub && sub.handle && typeof sub.handle.close === 'function') { try { sub.handle.close(); } catch (_) { /* closing */ } }
    sub = null;
    subGen += 1;
  }

  function drain() {
    if (inbox.length === 0) return;
    const batch = inbox.splice(0);
    for (const m of batch) {
      if (m.gen !== subGen || !sub) continue;
      if (m.ev) {
        takeEvent(m.ev);
      } else if (m.eose) {
        if (sub.eose) continue;
        sub.eose = true;
        const first = !everConnected;
        everConnected = true;
        subscription.connected = true;
        subscription.since = iso(now());
        reconnectAttempts = 0;
        // Every connect is followed, after EOSE, by a catch-up (the first start's is its baseline).
        if (!baseline) requestCatchUp(first ? 'start' : 'reconnect');
      } else if (m.close) {
        subscription.connected = false;
        sub = null;
        subGen += 1;
        const wait = reconnectDelay(reconnectAttempts);
        reconnectAt = now() + wait;
        reconnectAttempts += 1;
        log(`the subscription closed (${closeText(m.info)}); reconnecting in ${wait / SEC} s`);
      }
    }
    if (baselineDropped) { baselineDropped = false; flushJournal(); }
  }

  // ─── the graph ───────────────────────────────────────────────────────────────────────────────────────────

  async function ensureGraph() {
    if (graph) return graph;
    try {
      graph = await deps.openGraph({
        uri: env.NEO4J_URI, user: env.NEO4J_USER, password: typeof env.NEO4J_PASSWORD === 'string' ? env.NEO4J_PASSWORD : '',
      });
    } catch (err) {
      graph = null;
      graphDown('config', err, false);
      return null;
    }
    return graph;
  }

  /** The graph is unavailable (or refuses us): wait, probing 5→15 s (5→60 s for auth and other codes). */
  function graphDown(stage, err, countRead) {
    if (countRead) counts.failedReads.graph += 1;
    noteError(stage, err);
    waitForGraph(err);
  }

  /** The state becomes waiting-graph, probed again after 5→15 s for an outage, 5→60 s for auth and other codes. */
  function waitForGraph(err) {
    graphFailures += 1;
    graphWaiting = true;
    graphRetryAt = now() + backoff(graphFailures, 5 * SEC, errorClass(err) === 'unavailable' ? 15 * SEC : 60 * SEC);
  }

  function graphUp() {
    if (!graphWaiting) return;
    graphWaiting = false;
    graphFailures = 0;
    graphRetryAt = 0;
    cu.retryAt = 0;
    // A catch-up runs when the graph is back.
    if (!cu.running) requestCatchUp('graph-back');
  }

  /** The two rules present and ONLINE (ADR § Failure handling, schema): cached 5 s, re-checked every 15 s while waiting. */
  async function schemaReady(g) {
    const t = now();
    if (schemaOkAt !== null && t - schemaOkAt <= SCHEMA_CACHE_MS) return true;
    schemaCheckedAt = t;
    let s;
    try {
      s = await g.readSchema({ timeoutMs: SCHEMA_READ_TIMEOUT_MS });
    } catch (err) {
      graphDown('schema', err, true);
      return false;
    }
    const status = schemaStatusFromRows(s && s.constraints, s && s.indexes);
    let problem = null;
    if (!status.tagsAddress.present) problem = { kind: 'schema', rule: 'tags_address', problem: 'missing' };
    else if (!status.tagsAddress.online) problem = { kind: 'schema', rule: 'tags_address', problem: 'not-online' };
    else if (!status.nostrUserPubkey.present) problem = { kind: 'schema', rule: 'nostrUser_pubkey', problem: 'missing' };
    if (problem) {
      if (!setupProblem) log(`waiting for the database rule ${problem.rule} (${problem.problem})`);
      setupProblem = problem;
      schemaOkAt = null;
      return false;
    }
    if (setupProblem && setupProblem.kind === 'schema') { setupProblem = null; log('the database rules are in place'); }
    schemaOkAt = t;
    return true;
  }

  // ─── the pass's report ───────────────────────────────────────────────────────────────────────────────────

  async function readRuns() {
    let rep = null;
    try { rep = await st.readReport(); } catch (_) { rep = null; }
    if (!isPlainObject(rep)) return [];
    const all = [rep.latest, ...(Array.isArray(rep.previous) ? rep.previous : [])];
    return all.filter((r) => isPlainObject(r) && typeof r.runId === 'string');
  }

  /** Which runs with endedAt null are still alive; a run not alive is recorded as seen dead now, once (journal k). */
  async function aliveRuns(runs, t) {
    const alive = new Map();
    lastRuns = runs.map((r) => ({ runId: r.runId, startedAt: r.startedAt, endedAt: r.endedAt, alive: false }));
    for (const r of runs) {
      if (r.endedAt != null) continue;
      let a = false;
      try { a = (await st.isAlive(r)) === true; } catch (_) { a = false; }
      alive.set(r.runId, a);
      const lr = lastRuns.find((x) => x.runId === r.runId);
      if (lr) lr.alive = a;
      if (!a && !has(deadSeenAt, r.runId) && RUN_ID_RE.test(r.runId)) {
        deadSeenAt[r.runId] = t;
        addLine({ t: 'k', runId: r.runId, at: t });
      }
    }
    return alive;
  }

  /** Every 5 s: re-looks whose pass is no longer alive are queued, and an overlapping pass's end schedules a catch-up. */
  async function relookCheck() {
    if (rechecks.size === 0 && watchedRuns.size === 0) return;
    const t = now();
    const runs = await readRuns();
    const alive = await aliveRuns(runs, t);
    for (const [address, byRun] of [...rechecks]) {
      for (const [runId, entry] of [...byRun]) {
        if (alive.get(runId) === true) continue;
        byRun.delete(runId);
        const p = parked.get(address);
        if (p && p.code === TIMEOUT_PARK) {
          // A re-look does not lift a time-out park (A1 clarification 12 names what does): its prompts merge into the
          // parked entry, carried unchanged (A1-5), and its run's `rc` follows the address's completion.
          p.entry = mergeEntry(p.entry, entry);
          (p.relookRuns || (p.relookRuns = new Set())).add(runId);
          continue;
        }
        if (p) unpark(address, 'relook'); // a refused park is retried with the re-look, never left parked and pending
        enqueue(address, 'relook', { entry, runId });
      }
      if (byRun.size === 0) rechecks.delete(address);
    }
    for (const runId of [...watchedRuns]) {
      if (alive.get(runId) === true) continue;
      watchedRuns.delete(runId);
      requestCatchUp('pass-ended');
    }
  }

  // ─── the catch-up ────────────────────────────────────────────────────────────────────────────────────────

  function requestCatchUp(trigger) {
    if (cu.running) { if (!cu.again) cu.again = trigger; return; }
    if (!cu.requested) cu.requested = trigger;
  }

  function catchUpDue(t) {
    if (!cu.requested || cu.running || baseline || !identities) return false;
    if (graphWaiting && t < graphRetryAt) return false;
    if (t < cu.retryAt) return false;
    if (!cu.retrying && cu.lastStartAt !== null && t < cu.lastStartAt + CATCH_UP_SPACING_MS) return false;
    return true;
  }

  function reflectedSince(c) {
    return {
      added: counts.added - c.startCounts.added,
      changed: counts.changed - c.startCounts.changed,
      removed: counts.removed - c.startCounts.removed,
      unchanged: counts.unchanged - c.startCounts.unchanged,
    };
  }

  function endCatchUp(c, outcome, extra = {}) {
    if (cu.running === c) { cu.running = null; learnedSince = null; }
    const t = now();
    const last = { outcome, startedAt: iso(c.startedAt), endedAt: iso(t), durationMs: t - c.startedAt, reflected: reflectedSince(c), ...extra };
    if (outcome !== 'failed' && outcome !== 'stopped' && c.notEstablished) {
      last.outcome = 'not-established';
      last.reason = c.notEstablished;
      if (notEstablished === c.notEstablished) notEstablished = null;
    } else if (c.notEstablished) {
      last.reason = c.notEstablished; // still to be reported: the next start takes it up from status.json
    }
    cu.last = last;
    if (cu.again) { if (!cu.requested) cu.requested = cu.again; cu.again = null; }
  }

  /**
   * A catch-up that failed: aborted without compaction, its outcome and stage in the status, and retried with 5→60 s
   * backoff (ADR § The catch-up). A read that failed counts in failedReads.catchUp; an unexpected error in one of its
   * steps (stage 'unexpected') is no failed read, and is the status's lastError under its own stage.
   */
  function failCatchUp(c, stage, err) {
    if (stage === 'unexpected') {
      noteError('unexpected', err);
    } else {
      counts.failedReads.catchUp += 1;
      noteError('catch-up', err);
    }
    if (stage === 'graph-keys' && ['unavailable', 'auth'].includes(errorClass(err))) waitForGraph(err);
    cu.failures += 1;
    cu.retrying = true;
    cu.retryAt = now() + backoff(cu.failures, 5 * SEC, 60 * SEC);
    endCatchUp(c, 'failed', { stage });
    if (!cu.requested) cu.requested = c.trigger;
  }

  /** Queue catch-up work in chunks of LIMITS.catchUpChunk addresses; end the catch-up once each has had one attempt. */
  function feedCatchUp() {
    const c = cu.running;
    if (!c || !c.backlog) return;
    while (c.next < c.backlog.length && c.outstanding.size < LIMITS.catchUpChunk) {
      const [address, entry] = c.backlog[c.next];
      c.backlog[c.next] = null;
      c.next += 1;
      const p = parked.get(address);
      if (p) {
        // A catch-up lifts no park. Its arrival, look or found revoke merges into the parked entry, which keeps its
        // schedule: for a time-out park, its timer, a start, or a live event there (A1 clarifications 12 and 21); for a
        // database refusal, 5 min, 30 min, then every 6 h, a start, a new event there, or the next successful write
        // (§ Failure handling). A parked version never enters S, so every catch-up, the safety diff included, finds it
        // again: lifting the park here would retry each refused address every 10 minutes.
        p.entry = mergeEntry(p.entry, entry);
        continue;
      }
      c.outstanding.add(address);
      enqueue(address, 'catchup', { entry });
    }
    if (c.next >= c.backlog.length && c.outstanding.size === 0) {
      compact(maps, c.scannedIds, c.captureSeq);
      // A1-7: a lineage is kept where a gate may still need it; at every address kept, `older` is cut to the graph's
      // recorded id plus the ids learned there after the capture, work waiting or not; while a pass may still write
      // from an older read, nothing is pruned (the cap still holds).
      const keep = new Set([...pending.keys(), ...inFlight.keys(), ...parked.keys(), ...rechecks.keys()]);
      for (const [a, n] of learnSeq) if (n > c.captureSeq) keep.add(a);
      const learnedAfter = learnedSince && learnedSince.capture === c.captureSeq ? learnedSince.ids : new Map();
      // A1-7, the pass exception: a pass may still write from an older read while a run that overlapped one of the
      // path's rounds has not been seen to end, a run was alive at the report read taken with this catch-up's key read,
      // or a run ended after that key read (one dead with endedAt null counts from when it was first seen dead). The
      // runs are judged from the latest report read (A1 clarification 15). A same-millisecond tie counts as after, as
      // clarification 13 settles the graph read's ties: missing it could cut what a pass may still write from.
      const keysAt = c.keysAt;
      const endedAfterKeys = (r) => (r.endedAt != null
        ? Date.parse(r.endedAt) >= keysAt
        : r.alive !== true && has(deadSeenAt, r.runId) && deadSeenAt[r.runId] >= keysAt);
      const passNear = watchedRuns.size > 0 || c.passAtKeys === true || lastRuns.some(endedAfterKeys);
      pruneLineage(maps, { scannedIds: c.scannedIds, graphKeys: c.graphKeys, keep, keepOlder: passNear, learnedAfter });
      learnSeq.clear(); // no read is in flight at a compaction, so no later capture can precede these
      recountHeard();
      flushJournal();
      snapshot();
      endCatchUp(c, 'done');
      log(`catch-up done (${c.trigger}): ${c.arrivals} arrival(s), ${c.lookOnly} look(s), ${c.deletionsFound} revoke(s) found`);
    }
  }

  function attempted(address) {
    const c = cu.running;
    if (!c || !c.outstanding || !c.outstanding.delete(address)) return;
    try {
      feedCatchUp();
    } catch (err) {
      catchUpBroke(c, err);
    }
  }

  /**
   * An unexpected error in the running catch-up's own work (a step, or feeding its backlog after a round) ends that
   * catch-up as failed, backed off 5→60 s, so a later catch-up runs: one left running would hold off every catch-up,
   * the safety diff included, until a restart, while the status said catching-up.
   */
  function catchUpBroke(c, err) {
    if (cu.running === c) failCatchUp(c, 'unexpected', err);
    else noteError('unexpected', err);
  }

  /**
   * One author-scoped kind-5 scan for deletion candidates (ADR step 3). One that fails is bisected down to one target;
   * its halves are further reads of the catch-up (A1-11), so a round waits for one of them, never for the bisection.
   */
  async function candidateScan(c, { pubkey, by, targets }) {
    if (stopping || targets.length === 0) return;
    const filter = { kinds: [5], authors: [pubkey], [`#${by}`]: targets };
    const want = new Set(targets);
    const kept = [];
    try {
      await deps.scan(filter, {
        timeoutMs: CANDIDATE_SCAN_TIMEOUT_MS,
        maxBytes: LIMITS.candidateScanMaxBytes,
        isExpected: (ev) => isExpectedDeletion(ev, { pubkey, by, targets }),
        onEvent: (ev) => {
          // Cut each kind-5 to the targets it names: a revoke prompt per candidate, the event itself not kept.
          const named = new Set();
          for (const tag of ev.tags) {
            if (Array.isArray(tag) && tag[0] === by && typeof tag[1] === 'string') {
              const v = by === 'e' ? tag[1].toLowerCase() : tag[1];
              if (want.has(v)) named.add(v);
            }
          }
          for (const target of named) {
            kept.push({
              address: by === 'e' ? c.idAddress.get(target) : target,
              prompt: { type: 'revoke', kind5Id: String(ev.id).toLowerCase(), created_at: ev.created_at, by, target },
            });
          }
        },
      });
    } catch (err) {
      kept.length = 0; // what the failed scan streamed is not held through its halves
      if (stopping) return; // a read the stop killed is not a failed read (the caller records 'stopped')
      if (targets.length > 1) {
        // Depth-first, as a recursion would read them: the first half next (the top of the stack), then the second.
        const h = Math.ceil(targets.length / 2);
        c.split.push({ pubkey, by, targets: targets.slice(h) }, { pubkey, by, targets: targets.slice(0, h) });
        return;
      }
      // A single-target failure is contained: counted, and retried at the next diff.
      counts.failedReads.catchUp += 1;
      noteError('catch-up', err);
      return;
    }
    relayAnswered();
    for (const k of kept) {
      if (typeof k.address !== 'string') continue;
      c.found.set(k.address, mergePrompt(c.found.get(k.address) || null, k.prompt));
    }
  }

  /**
   * A catch-up (ADR § The catch-up, steps 1–3): its reads, one per activity, then its work queued; the rounds process
   * it. A1-11: rounds and a catch-up's reads take turns, one at a time — the key read (with its report read), the stamp
   * scan, then each candidate scan — so a due round runs between two of them and waits for one read, never for all.
   * This activity takes the key read; nextActivity starts each later read (catchUpStep).
   */
  async function runCatchUp() {
    const trigger = cu.requested;
    cu.requested = null;
    const t = now();
    const c = {
      trigger, startedAt: t, arrivals: 0, lookOnly: 0, deletionsFound: 0, outstanding: null, backlog: null, next: 0,
      scannedIds: null, captureSeq: 0, graphKeys: null, keysAt: null, passAtKeys: false, notEstablished,
      startCounts: { added: counts.added, changed: counts.changed, removed: counts.removed, unchanged: counts.unchanged },
      // Held across its reads: the next read (null once they are all in), whether a due round goes before it, and what
      // the reads found so far.
      step: catchUpKeys, roundTurn: false, work: null, idAddress: null, found: null, specs: null, specAt: 0, split: [],
    };
    cu.running = c;
    cu.lastStartAt = t;
    nextSafetyAt = t + SAFETY_DIFF_MS;
    await catchUpStep();
  }

  /** The running catch-up's next read (A1-11); a due round may run before the one after it. */
  async function catchUpStep() {
    const c = cu.running;
    if (!c || !c.step) return;
    const step = c.step;
    c.step = null;
    try {
      await step(c);
    } catch (err) {
      catchUpBroke(c, err);
      return;
    }
    if (cu.running === c && c.step) c.roundTurn = true;
  }

  /** 1. Graph keys, and the pass's report read taken with them (A1-7). */
  async function catchUpKeys(c) {
    const g = await ensureGraph();
    if (!g) { failCatchUp(c, 'graph-keys', null); return; }
    let rows;
    c.keysAt = now();
    // A1-7 with A1-11: a round may read and write between this key read and the stamp scan's capture, so the graph's
    // keys can predate what the graph records by the compaction. What the path learns from here on (the scan's own
    // placement aside) is noted as learned after the capture is, and the compaction keeps it the same way.
    learnedSince = { from: ++seq, capture: null, ids: new Map() };
    try {
      rows = await g.readKeys({ timeoutMs: KEYS_TIMEOUT_MS });
      if (!Array.isArray(rows)) throw Object.assign(new Error('the key read returned no rows list'), { code: 'incomplete' });
    } catch (err) {
      if (stopping) { endCatchUp(c, 'stopped'); return; }
      failCatchUp(c, 'graph-keys', err);
      return;
    }
    graphUp();
    // A1-7: the pass rule for this catch-up's compaction is judged from a report read taken with its key read (right
    // after it, so a run alive at the key read is either alive here or has ended after it).
    const runsAtKeys = await readRuns();
    const aliveAtKeys = await aliveRuns(runsAtKeys, now());
    c.passAtKeys = runsAtKeys.some((r) => aliveAtKeys.get(r.runId) === true);
    const graphKeys = new Map();
    for (const r of rows) {
      if (isPlainObject(r) && isTaggingAddress(r.address)) graphKeys.set(r.address, typeof r.eventId === 'string' ? r.eventId : null);
    }
    rows = null;
    graphAddresses = new Set(graphKeys.keys());
    c.graphKeys = graphKeys;
    if (stopping) { endCatchUp(c, 'stopped'); return; }
    c.step = catchUpStamp;
  }

  /** 2. The stamp scan: (id, address) pairs only, streamed; no byte cap (memory is bounded by the ids). */
  async function catchUpStamp(c) {
    // A read or scan is learned at its capture (A1-2): a counter bumped just before the spawn, so it is unique.
    const captureSeq = ++seq;
    if (learnedSince) learnedSince.capture = captureSeq; // the scan's own placement is not "learned after" (A1-7)
    let pairs = [];
    try {
      await deps.scan(stampFilter, {
        timeoutMs: STAMP_SCAN_TIMEOUT_MS,
        maxBytes: Infinity,
        isExpected: (ev) => isExpectedScanEvent(ev, stampFilter),
        onEvent: (ev) => { const p = promptFromVersion(ev, identities); if (p) pairs.push([p.id, p.address]); },
      });
    } catch (err) {
      // A stop SIGKILLs the scan it finds running: that read was not a failure.
      if (stopping) { endCatchUp(c, 'stopped'); return; }
      failCatchUp(c, 'stamp-scan', err);
      return;
    }
    relayAnswered();
    cu.failures = 0;
    cu.retrying = false;
    if (stopping) { endCatchUp(c, 'stopped'); return; }
    const graphKeys = c.graphKeys;
    const scannedIds = new Set(pairs.map((p) => p[0]));
    const { arrivals, lookOnly } = arrivalsAndLookOnly(pairs, maps, graphKeys);
    // A1-2, A1-9: what the scan found is learned — arrivals included — at the scan's capture, journaled as `o` lines;
    // a version the graph records beside another on the relay is older than it.
    for (const [id, address] of pairs) {
      learned(address, id, { under: (learnSeq.get(address) || 0) > captureSeq, graphId: graphKeys.get(address), at: captureSeq });
    }
    pairs = null;
    const candidates = deletionCandidates(graphKeys, scannedIds, maps);
    c.scannedIds = scannedIds;
    c.captureSeq = captureSeq;
    c.work = { arrivals, lookOnly };
    // 3. Deletion candidates, author-scoped: one scan per read.
    c.idAddress = new Map(candidates.map((x) => [x.id, x.address]));
    c.found = new Map();
    c.specs = deletionScanFilters(candidates);
    c.specAt = 0;
    if (c.specs.length > 0) c.step = catchUpCandidate;
    else queueCatchUpWork(c);
  }

  /** 3. One candidate scan (or one half of a failed one); after the last, the catch-up's work is queued. */
  async function catchUpCandidate(c) {
    const spec = c.split.length > 0 ? c.split.pop() : c.specs[c.specAt++];
    if (spec) await candidateScan(c, spec);
    if (stopping) { endCatchUp(c, 'stopped'); return; }
    if (c.split.length > 0 || c.specAt < c.specs.length) { c.step = catchUpCandidate; return; }
    queueCatchUpWork(c);
  }

  /**
   * The catch-up's reads are in: its work, in order — arrivals, then look-only prompts, then found revokes (A1
   * clarification 7) — then fed to the queue in chunks.
   */
  function queueCatchUpWork(c) {
    const { arrivals, lookOnly } = c.work;
    const found = c.found;
    const work = new Map();
    for (const { address, id } of arrivals) work.set(address, mergePrompt(work.get(address) || null, { type: 'version', id }));
    for (const address of lookOnly) work.set(address, mergePrompt(work.get(address) || null, { type: 'look' }));
    for (const [address, entry] of found) {
      work.set(address, mergeEntry(work.get(address) || null, entry));
      // A1-9: a found revoke is a fact the relay may lose (a wipe): journaled like a live one, so a restart keeps it.
      for (const p of entry.revokes) addLine({ t: 'd', a: address, p });
    }
    c.arrivals = arrivals.length;
    c.lookOnly = lookOnly.length;
    c.deletionsFound = [...found.values()].reduce((n, e) => n + e.revokes.length, 0);
    c.work = null;
    c.idAddress = null;
    c.found = null;
    c.specs = null;
    c.backlog = [...work];
    c.outstanding = new Set();
    feedCatchUp();
  }

  // ─── the first start, and a lost record's re-baseline ────────────────────────────────────────────────────

  /**
   * A1-8: each graph (address, eventId) at an address the lineage does not hold joins `older` there, with no top (every
   * row at such an address, so a graph conflict's two rows both join).
   */
  function applyCensus(rows) {
    for (const [address, ids] of rows) {
      if (maps.L.has(address)) continue;
      for (const eventId of [].concat(ids)) learnOlder(maps, address, eventId);
    }
  }

  /**
   * A1-8, the census: one best-effort read of the graph's keys before a baseline start's REQ. Each recorded id at
   * an address the lineage does not hold joins `older` there: it was written from a relay read taken before the census,
   * and every version the path learns afterwards is on the relay after it (a delivery on the REQ that follows, or the
   * version a later read or scan returns). No retry: a graph that has not answered by the engine's own 10 s deadline
   * leaves the start as it was (a late answer is ignored), and the REQ follows at once.
   */
  async function takeCensus() {
    const c = census;
    let giveUp = null;
    const gaveUp = new Promise((resolve) => { giveUp = resolve; });
    c.state = 'running';
    c.deadline = now() + CENSUS_TIMEOUT_MS;
    c.giveUp = () => giveUp(LATE);
    // A census that fails, or is given up on, is a failed graph read like any other (counted, and the last error).
    const censusFailed = (err) => { counts.failedReads.graph += 1; noteError('graph-read', err); };
    try {
      const g = await Promise.race([ensureGraph(), gaveUp]);
      if (g === LATE) { censusFailed({ code: 'timeout' }); return; }
      if (!g || stopping) return;
      const read = Promise.resolve().then(() => g.readKeys({ timeoutMs: CENSUS_TIMEOUT_MS }));
      read.catch(() => {}); // a census given up on: its late answer, or failure, is nobody's
      const rows = await Promise.race([read, gaveUp]);
      if (rows === LATE) { censusFailed({ code: 'timeout' }); return; }
      if (!Array.isArray(rows) || stopping) return;
      const rowsAt = new Map();
      for (const r of rows) {
        if (!isPlainObject(r) || !isTaggingAddress(r.address) || typeof r.eventId !== 'string') continue;
        const prev = rowsAt.get(r.address);
        rowsAt.set(r.address, prev === undefined ? r.eventId : [].concat(prev, r.eventId));
      }
      censusAt = rowsAt;
      applyCensus(rowsAt);
    } catch (err) {
      censusFailed(err);
    } finally {
      if (census === c) census = null;
      if (!stopping && !sub) openSubscription();
    }
  }

  function baselineDue(t) {
    return !!baseline && !!sub && sub.eose && t >= baselineRetryAt;
  }

  /**
   * The baseline (ADR § First start; A1-10): S = the stamp scan's pairs, B = its ids minus every id delivered since the
   * REQ. The lineage learns the census, then a first start's buffered deliveries in drain order, then places the scan's
   * versions at its capture. A first start touches the graph only through its census; it writes record.json, then
   * started.json, then the status, then processes what the subscription buffered. A re-baseline keeps what the journal
   * held. Either is followed by a catch-up.
   */
  async function takeBaseline() {
    const gen = subGen;
    const pairs = [];
    const captureSeq = ++seq; // A1-2: the scan's versions are learned at this capture
    try {
      await deps.scan(stampFilter, {
        timeoutMs: STAMP_SCAN_TIMEOUT_MS,
        maxBytes: Infinity,
        isExpected: (ev) => isExpectedScanEvent(ev, stampFilter),
        onEvent: (ev) => { const p = promptFromVersion(ev, identities); if (p) pairs.push([p.id, p.address]); },
      });
    } catch (err) {
      if (stopping) return; // killed by the stop, not failed
      baselineFailures += 1;
      baselineRetryAt = now() + backoff(baselineFailures, 5 * SEC, 60 * SEC);
      noteError('baseline', err);
      return;
    }
    // A reconnect since the REQ restarts it from step 1 (that gap reached no subscription).
    if (stopping || gen !== subGen || !sub || !sub.eose || !baseline) return;
    relayAnswered();
    baselineFailures = 0;
    const b = baseline;
    const live = b.mode === 'first' ? b.buffer.ids : b.liveIds;
    if (b.mode === 'first') {
      maps = newMaps();
      learnSeq.clear();
      if (censusAt) applyCensus(censusAt); // A1-8: the census precedes everything this baseline learns
      // The buffered deliveries, in store order, at the counter they were drained at (A1-2): the scan's version at an
      // address then becomes the top only when no buffered version there was drained after the scan's capture.
      for (const p of b.buffer.versions) learned(p.address, p.id, { journal: false, at: p.seq, delivered: true });
    }
    // A1-8: the census is the graph read for the scan's placement: wherever the scan places a version other than the
    // census's id there, that id joins older — at an address a restored lineage already holds too. (Both ids of a graph
    // conflict join.)
    const censusRows = censusAt || new Map();
    const scanned = new Set();
    for (const [id, address] of pairs) {
      scanned.add(id);
      recordId(maps, 'S', id, address, ++seq);
      learned(address, id, {
        journal: false,
        under: (learnSeq.get(address) || 0) > captureSeq,
        at: captureSeq,
        graphId: censusRows.get(address) || null,
      });
    }
    for (const id of [...maps.S.keys()]) if (!scanned.has(id)) maps.S.delete(id);
    maps.B.clear();
    for (const id of scanned) if (!live.has(id)) maps.B.add(id);
    recountHeard();
    baseline = null;
    baselineDone = true;
    censusAt = null;
    nextSafetyAt = now() + SAFETY_DIFF_MS;
    if (b.mode === 'first') {
      firstStartedAt = firstStartedAt || iso(startedAtMs);
      snapshot();
      try {
        await store.writeStarted({ version: 1, firstStartedAt });
      } catch (err) {
        noteError('record', err);
      }
      writeStatus(true);
      log(`first start: baseline of ${maps.B.size} version(s) held since before it`);
      for (const p of b.buffer.versions) heard(p.id, p.address, { learnNow: false });
      for (const ev of b.buffer.deletions) deletion(ev);
      // A1-10: like every start, the first one is followed by one catch-up (trigger 'start'). Its candidate scan finds
      // a revoke stored between the REQ and the baseline scan (or in a reconnect gap before record.json), which no map
      // can resolve. A catch-up the buffer's cap requested meanwhile is this same one.
      cu.requested = 'start';
    } else {
      // An unreadable marker may have been the only one: then firstStartedAt and started.json start here, once.
      const needStarted = !firstStartedAt;
      if (needStarted) firstStartedAt = iso(startedAtMs);
      snapshot();
      if (needStarted) {
        try {
          await store.writeStarted({ version: 1, firstStartedAt });
        } catch (err) {
          noteError('record', err);
        }
      }
      // Reported at once, and again by the catch-up that follows; one that fails or is stopped first carries the
      // reason on, across a restart too (endCatchUp, start()), until a catch-up completes.
      const t = now();
      cu.last = {
        outcome: 'not-established', reason: notEstablished, startedAt: iso(startedAtMs), endedAt: iso(t),
        durationMs: t - startedAtMs, reflected: { added: 0, changed: 0, removed: 0, unchanged: 0 },
      };
      writeStatus(true);
      log(`record not established (${notEstablished}): re-baselined ${maps.B.size} version(s)`);
      requestCatchUp('start');
    }
  }

  // ─── a round ─────────────────────────────────────────────────────────────────────────────────────────────

  function roundDue(t) {
    if (baseline || !identities) return false;
    if (graphWaiting && t < graphRetryAt) return false;
    if (setupProblem && setupProblem.kind === 'schema' && t < schemaCheckedAt + SCHEMA_WAIT_MS) return false;
    for (const item of pending.values()) if (item.due <= t) return true;
    return false;
  }

  async function runRound() {
    const g = await ensureGraph();
    if (!g) return;
    if (!(await schemaReady(g))) return;
    const t0 = now();
    const ready = [];
    for (const item of pending.values()) if (item.notBefore <= t0) ready.push({ address: item.address, lane: item.lane, seq: item.seq });
    const order = roundOrder(ready);
    if (order.length === 0) return;
    const items = new Map();
    for (const a of order) {
      const it = pending.get(a);
      pending.delete(a);
      inFlight.set(a, it);
      items.set(a, it);
    }
    const done = new Set(); // addresses whose item this round has settled
    const tried = []; // settled addresses that had their attempt (for the catch-up's count)
    let finished = false;
    try {
      await roundBody(g, t0, order, items, done, tried);
      finished = true;
    } finally {
      // Anything the round did not settle goes back as it was: at once after a stop, when the graph is back after an
      // outage, and after 5 s when something unexpected ended the round (never a hot loop).
      const later = graphWaiting ? graphRetryAt : (finished || stopping ? now() : now() + 5 * SEC);
      for (const [a, it] of items) {
        inFlight.delete(a);
        if (!done.has(a)) putBack(it, Math.max(it.notBefore, later));
      }
      for (const a of tried) attempted(a);
    }
  }

  async function roundBody(g, t0, order, items, done, tried) {
    // 1. The graph read (t0).
    const graphReadAt = now();
    let rows;
    try {
      rows = await g.readAt(order, { timeoutMs: GRAPH_READ_TIMEOUT_MS });
      if (!Array.isArray(rows)) throw Object.assign(new Error('the graph read returned no rows list'), { code: 'incomplete' });
    } catch (err) {
      graphDown('graph-read', err, true);
      return;
    }
    graphUp();
    if (stopping) return;
    const snap = groupSnapshot(rows);
    const conflicts = new Set(snap.conflicts);

    // 2. The relay read (t1 > t0), strict, batched; the catch-up's share first, bounded by bytes.
    const budget = { kept: 0, share: 0 };
    const events = new Map(); // address → [kept event]
    const capture = new Map(); // address → the counter captured before the scan that read it
    const deferred = new Set();
    // address → { stage, err, group: whether it failed with others (the guard left it whole), answers: for a single's
    // time-out, the relay's answer count when it timed out }
    const failed = new Map();
    const readOk = new Set();
    // A1-13, time-outs. A scan of two or more addresses (or element ids) that times out is not bisected in its round:
    // its addresses are deferred with no attempt counted, and the round's end decides whether that was the relay
    // stalling or a slow address (the stall-or-slow test). Two such group time-outs before any scan of the round
    // answers are the stall guard: the relay is not answering, so the round starts no more reads and defers the rest.
    // A scan of one address, or of one element id, that times out is that address's own failure (5→60 s); after one,
    // the round reads no further marked single.
    const relay = { answered: false, groupTimeouts: 0 };
    const stalled = () => !relay.answered && relay.groupTimeouts >= 2;
    // Address groups that timed out this round: [{ addresses, regroup (its second time-out), answeredBefore (a scan of
    // this round had answered before it timed out) }].
    const timedOutGroups = [];
    let singleTimedOut = false;
    // A1-14: the catch-up share. Its scans run with maxBytes = what is left of its fifth; one that fails too-large is
    // not bisected: while the share has read nothing this round its first address (or id) is read alone under the
    // remainder, then the share ends and its remaining addresses and ids go to lane 4, unbisected.
    const heavy = { addresses: [], ids: new Set() };
    let shareRead = false;
    let shareEnded = false;

    const scanAddresses = async (filters, shareCap, kind) => {
      const addrs = filters.map(addressOfFilter);
      if (shareCap && shareEnded) { for (const a of addrs) heavy.addresses.push(a); return; }
      if (kind === 'single' && singleTimedOut) { for (const a of addrs) deferred.add(a); return; } // no attempt counted
      const room = shareCap ? shareCap - budget.share : LIMITS.roundScanMaxBytes;
      if (stopping || stalled() || budget.kept >= LIMITS.roundKeptBytes) {
        for (const a of addrs) deferred.add(a);
        return;
      }
      if (shareCap && room <= 0) { shareEnded = true; for (const a of addrs) heavy.addresses.push(a); return; }
      const want = new Set(addrs);
      const kept = [];
      let bytes = 0;
      const before = ++seq; // the capture (T7; A1-2), unique per scan
      try {
        await deps.scan(filters, {
          timeoutMs: ROUND_SCAN_TIMEOUT_MS,
          maxBytes: room,
          isExpected: (ev) => isExpectedAddressEvent(ev, addrs),
          onEvent: (ev) => { bytes += eventBytes(ev); kept.push(slim(ev)); },
        });
      } catch (err) {
        kept.length = 0; // what the failed scan streamed is not held through its halves
        const code = errCode(err);
        if (code === 'timeout') {
          if (filters.length > 1) {
            relay.groupTimeouts += 1;
            for (const a of addrs) deferred.add(a);
            timedOutGroups.push({ addresses: addrs, regroup: kind === 'regroup', answeredBefore: relay.answered });
            return;
          }
          singleTimedOut = true;
          failed.set(addrs[0], { stage: 'relay-read', err, group: false, answers: relayAnswers });
          return;
        }
        if (shareCap && code === 'too-large') {
          let left = addrs;
          if (filters.length > 1 && !shareRead && !shareEnded) {
            await scanAddresses(filters.slice(0, 1), shareCap, kind); // the first alone, under the remainder
            left = addrs.slice(1);
          }
          shareEnded = true;
          for (const a of left) heavy.addresses.push(a);
          return;
        }
        if (filters.length > 1 && !stalled()) {
          const h = Math.ceil(filters.length / 2);
          await scanAddresses(filters.slice(0, h), shareCap, kind);
          await scanAddresses(filters.slice(h), shareCap, kind);
          return;
        }
        for (const a of addrs) failed.set(a, { stage: 'relay-read', err, group: addrs.length > 1 });
        return;
      }
      relay.answered = true;
      if (shareCap) shareRead = true;
      relayAnswered();
      budget.kept += bytes;
      if (shareCap) budget.share += bytes;
      for (const a of addrs) { readOk.add(a); capture.set(a, before); }
      for (const ev of kept) {
        const p = promptFromVersion(ev, identities);
        if (!p || !want.has(p.address)) continue;
        if (!events.has(p.address)) events.set(p.address, []);
        events.get(p.address).push(ev);
      }
    };

    // 3. The element read, within the kept budget: tag elements named only by id. Each address chunk's elements are
    // read right after it, so the budget never leaves an early id-only address waiting behind later addresses' bytes.
    // A share chunk's element reads run under the share's remaining bytes too; an element that does not fit is read in
    // lane 4, so no read address is left without its element (A1-14).
    const needs = new Map(); // address → [element id]
    const elements = new Map(); // id → event
    const elementRead = new Set(); // ids a successful element scan covered (found or absent); the rest are unread
    const elementFailed = new Map(); // id → { err, group }
    const elementTimedOut = new Set(); // A1-13: ids whose group scan timed out: the addresses needing them are marked
    const scanElements = async (ids, shareCap, kind) => {
      if (shareCap && shareEnded) { for (const id of ids) heavy.ids.add(id); return; }
      if (kind === 'single' && singleTimedOut) return; // unread: the address waits, no attempt counted
      if (stopping || stalled() || budget.kept >= LIMITS.roundKeptBytes) return;
      const room = shareCap ? shareCap - budget.share : LIMITS.roundScanMaxBytes;
      if (room <= 0) { shareEnded = true; for (const id of ids) heavy.ids.add(id); return; }
      const kept = [];
      let bytes = 0;
      try {
        await deps.scan({ kinds: [39999], ids }, {
          timeoutMs: ROUND_SCAN_TIMEOUT_MS,
          maxBytes: room,
          isExpected: (ev) => isExpectedElementEvent(ev, ids),
          onEvent: (ev) => { bytes += eventBytes(ev); kept.push(slim(ev)); },
        });
      } catch (err) {
        kept.length = 0;
        const code = errCode(err);
        if (code === 'timeout') {
          if (ids.length > 1) { relay.groupTimeouts += 1; for (const id of ids) elementTimedOut.add(id); return; }
          singleTimedOut = true;
          elementFailed.set(ids[0], { err, group: false, answers: relayAnswers });
          return;
        }
        if (shareCap && code === 'too-large') {
          let left = ids;
          if (ids.length > 1 && !shareRead && !shareEnded) {
            await scanElements(ids.slice(0, 1), shareCap, kind); // the first alone, under the remainder
            left = ids.slice(1);
          }
          shareEnded = true;
          for (const id of left) heavy.ids.add(id);
          return;
        }
        if (ids.length > 1 && !stalled()) {
          const h = Math.ceil(ids.length / 2);
          await scanElements(ids.slice(0, h), shareCap, kind);
          await scanElements(ids.slice(h), shareCap, kind);
          return;
        }
        for (const id of ids) elementFailed.set(id, { err, group: ids.length > 1 });
        return;
      }
      relay.answered = true;
      if (shareCap) shareRead = true;
      relayAnswered();
      budget.kept += bytes;
      if (shareCap) budget.share += bytes;
      for (const id of ids) elementRead.add(id);
      for (const ev of kept) elements.set(String(ev.id).toLowerCase(), ev);
    };
    const unreadIds = (ids) => [...ids].filter((id) => !elementRead.has(id) && !elementFailed.has(id));
    const readChunk = async (filters, shareCap, kind) => {
      await scanAddresses(filters, shareCap, kind);
      const ids = new Set();
      for (const a of filters.map(addressOfFilter)) {
        if (!readOk.has(a)) continue;
        for (const ev of events.get(a) || []) {
          const r = taggingToEdge(ev, identities);
          if (r && r.ok === true && r.edge.tagAddress === null && typeof r.edge.tagEventId === 'string') {
            if (!needs.has(a)) needs.set(a, []);
            needs.get(a).push(r.edge.tagEventId);
            if (!elementRead.has(r.edge.tagEventId) && !elementFailed.has(r.edge.tagEventId)) ids.add(r.edge.tagEventId);
          }
        }
      }
      // A1-13: an address read alone reads its element ids one per scan, and stops once a single has timed out.
      if (kind === 'single') {
        for (const id of ids) { if (singleTimedOut) break; await scanElements([id], shareCap, 'single'); }
        return;
      }
      for (const f of elementScanFilters([...ids])) await scanElements(f.ids, shareCap, kind);
    };

    // The lanes (§ Lanes and rounds, A1-13, A1-14): the catch-up's share; live and re-looks, then their marked singles;
    // lane 4 (what did not fit the share, then the rest of the catch-up); then the catch-up's marked singles. In each,
    // a group that timed out in an earlier round with nothing else answering is re-read as one group (before it is
    // ever marked), after that lane's usual groups: so fresh reads get their chance to answer first, and two such
    // groups cannot trip the stall guard ahead of every other read, round after round.
    let share = 0;
    while (share < order.length && share < LIMITS.roundCatchUpShare && items.get(order[share]).lane === 'catchup') share += 1;
    const readSection = async (addresses, shareCap) => {
      const regroups = new Map(); // token → [address]
      const usual = [];
      for (const a of addresses) {
        const it = items.get(a);
        if (!it || it.single) continue;
        if (it.regroup) {
          if (!regroups.has(it.regroup)) regroups.set(it.regroup, []);
          regroups.get(it.regroup).push(a);
        } else {
          usual.push(a);
        }
      }
      for (const chunk of addressScanFilters(usual)) await readChunk(chunk, shareCap, 'usual');
      for (const members of regroups.values()) for (const chunk of addressScanFilters(members)) await readChunk(chunk, shareCap, 'regroup');
    };
    // Marked singles, one address per scan: those with fewer time-outs of their own first (then in round order), so a
    // never-answering address costs the round at most its one single time-out after the others have been read.
    const readSingles = async (addresses) => {
      const marked = addresses.filter((a) => items.get(a) && items.get(a).single);
      marked.sort((x, y) => (items.get(x).timeoutsAlone || 0) - (items.get(y).timeoutsAlone || 0));
      for (const a of marked) for (const chunk of addressScanFilters([a])) await readChunk(chunk, 0, 'single');
    };
    const shareAddresses = order.slice(0, share);
    const rest = order.slice(share);
    const liveAndRelooks = rest.filter((a) => items.get(a).lane !== 'catchup');
    const laneFour = rest.filter((a) => items.get(a).lane === 'catchup');
    await readSection(shareAddresses, SHARE_BYTES);
    await readSection(liveAndRelooks, 0);
    await readSingles(liveAndRelooks);
    for (const f of elementScanFilters(unreadIds(heavy.ids))) await scanElements(f.ids, 0, 'usual');
    await readSection(heavy.addresses, 0);
    await readSection(laneFour, 0);
    await readSingles(shareAddresses.concat(laneFour));
    if (stopping) return;

    // A1-13, the stall-or-slow test, at the round's end. A group that timed out after another scan of this round had
    // answered (the relay was up) is marked: its addresses are read alone from the next round on, until each one's own
    // read succeeds. When nothing had answered, the next round first re-reads it as one group, and only a second
    // time-out of that group marks them. (An answer only after its time-out is the relay coming back — the end of a
    // stall — not evidence of a slow address.) When the stall guard tripped on a group timing out for the first time,
    // the relay was not answering: nothing is marked, and every group comes back as it was, so after a Redis stall the
    // addresses are read in their usual groups. A guard tripped by re-read groups alone is their second time-out: they
    // are marked. An element group's time-out always follows its addresses' own answered read, so it marks.
    const stallTripped = stalled() && timedOutGroups.some((g) => !g.regroup);
    const markAlone = new Set();
    const regroupAt = new Map(); // address → token
    for (const g of timedOutGroups) {
      if (!stallTripped && (g.answeredBefore || g.regroup)) {
        for (const a of g.addresses) markAlone.add(a);
      } else {
        regroupSeq += 1;
        for (const a of g.addresses) regroupAt.set(a, regroupSeq);
      }
    }

    // A1-2: every successful, conflict-free address read is learned before the element checks — whether or not the
    // element read then succeeds — with the graph's row beside it (unless the graph's rows conflict there). The gate's
    // copy of the lineage is taken first: this round's own read is not yet learned when the gate judges (A1-4).
    const gateCopy = new Map();
    const relayAtOf = new Map();
    for (const a of order) {
      if (!readOk.has(a)) continue;
      const lineage = lineageAt(maps, a);
      gateCopy.set(a, lineage ? { top: lineage.top, older: new Set(lineage.older || []) } : null);
      const els = (needs.get(a) || []).map((id) => elements.get(id)).filter(Boolean);
      const relayAt = relayAtAddress(events.get(a) || [], els, a, identities);
      relayAtOf.set(a, relayAt);
      const heldThere = relayVersionId(relayAt);
      if (!heldThere) continue;
      const row = conflicts.has(a) ? null : snap.byAddress.get(a) || null;
      learned(a, heldThere, {
        under: (learnSeq.get(a) || 0) > capture.get(a), graphId: row ? storedEventIdOf(row) : null, at: capture.get(a),
      });
    }

    // 4–5. De-duplicate, decide, gate.
    const writes = [];
    const decided = new Map(); // address → { relayAt, entry }
    for (const a of order) {
      if (!readOk.has(a)) continue;
      const ids = needs.get(a) || [];
      const bad = ids.find((id) => !elementRead.has(id) && elementFailed.has(id));
      if (bad) { failed.set(a, { stage: 'element-read', ...elementFailed.get(bad) }); continue; }
      if (ids.some((id) => !elementRead.has(id))) {
        deferred.add(a);
        // A1-13: its element group timed out after its own address read answered: read alone from the next round.
        if (!stallTripped && ids.some((id) => elementTimedOut.has(id))) markAlone.add(a);
        continue;
      }
      const item = items.get(a);
      if (conflicts.has(a)) {
        counts.conflicts += 1;
        decided.set(a, { relayAt: null, entry: item.entry, conflict: true });
        // Nothing is decided or written here, as the pass leaves it (the read was learned above).
        continue;
      }
      const row = snap.byAddress.get(a) || null;
      const relayAt = relayAtOf.get(a); // every element it names was read: the same read the learning above placed
      if (relayAt && relayAt.ok === false) {
        counts.refused.total += 1;
        const reason = relayAt.reason || 'refused';
        counts.refused.byReason[reason] = (counts.refused.byReason[reason] || 0) + 1;
      }
      const relayId = relayVersionId(relayAt);
      const entry = item.entry;
      const d = decideAddress(row, relayAt);
      const info = { relayAt, entry, conflict: false };
      decided.set(a, info);
      // A1-4: the gate judges revokes against the lineage as it stood before this round's read was learned.
      const gateLineage = gateCopy.get(a) || null;
      if (d.action === 'leave') {
        counts.leftInPlace.total += 1;
        counts.leftInPlace.byReason[d.reason] = (counts.leftInPlace.byReason[d.reason] || 0) + 1;
        continue;
      }
      if (d.action === 'none') {
        if (d.reason === 'unchanged') counts.unchanged += 1;
        else if (d.reason === 'conflict') { counts.conflicts += 1; info.conflict = true; }
        continue;
      }
      const gate = gateAction(d, { address: a, storedRow: row, relayVersionId: relayId, entry, baseline: maps.B, lineage: gateLineage });
      if (!gate.act) {
        info.held = true; // a held decision reflects nothing: lastReflectedAt stays (A1-18)
        if (gate.held === 'pre-existing') counts.heldPreExisting += 1;
        else counts.removalsNotPrompted += 1;
        continue;
      }
      writes.push({ kind: d.action, address: a, row, desired: d.desired, label: d.label, reason: d.reason, result: null });
    }

    // 6. Write, through the port only.
    const out = { applied: 0, abort: false };
    for (const kind of ['create', 'update', 'move', 'remove']) {
      const list = writes.filter((w) => w.kind === kind).sort(byEnds(kind));
      for (let i = 0; i < list.length && !out.abort; i += LIMITS.writeRows) await applyBatch(g, kind, list.slice(i, i + LIMITS.writeRows), out);
    }

    // The failed rows: parked only on the same non-transient code in two rounds; when every single-row attempt
    // failed with one code, for two or more addresses, and no row succeeded, they back off instead (T29).
    const refusedRows = writes.filter((w) => w.result && w.result.refused);
    const oneCode = new Set(refusedRows.map((w) => w.result.refused)).size === 1;
    const noneLanded = out.applied === 0 && refusedRows.length >= 2 && oneCode;

    // 7–8. Settle every address: complete, re-queue or park; journal; shrink.
    const t = now();
    const writeAt = new Map(writes.map((w) => [w.address, w]));
    const settle = (a, attempt = true) => { done.add(a); inFlight.delete(a); if (attempt) tried.push(a); };
    const readFailures = new Map(); // stage → one error, noted once per round
    let reflected = false; // an address completed: what the relay holds there is now what the graph holds
    for (const a of order) {
      const item = items.get(a);
      if (failed.has(a)) {
        const { stage, err, group, answers } = failed.get(a);
        if (stage === 'relay-read') counts.failedReads.relay += 1; else counts.failedReads.element += 1;
        readFailures.set(stage, err);
        // A single address backs off 5→60 s. A group the stall guard left unbisected waits the first step only, so
        // one address's growing wait never holds back the others read with it.
        if (!group) item.failures += 1;
        settle(a);
        item.regroup = null;
        // A1-13: a scan of this address alone (or of one element id it needs) that timed out is its own failure. After
        // three consecutive ones it is parked like a refused write (5 min, 30 min, then every 6 h); once parked for
        // time-outs, the next one parks it again at the next step. The stall-or-slow test applies to a single too (A1
        // clarification 11's bound after a Redis stall): a time-out counts toward the park only for an address marked
        // to be read alone, or when some relay read answered since the address was queued or last timed out alone (in
        // this round before it, or in another round). Otherwise nothing was answering — a lone change in a stall — so
        // it backs off 5→60 s like any failed read, and its count stands.
        if (!group && errCode(err) === 'timeout') {
          const slow = item.single || (typeof answers === 'number' && answers > item.answersAt);
          if (typeof answers === 'number') item.answersAt = answers;
          if (slow) {
            item.timeoutsAlone = (item.timeoutsAlone || 0) + 1;
            if (item.timeoutsAlone >= SINGLE_TIMEOUTS_TO_PARK || item.parkedCode === TIMEOUT_PARK) {
              park(item, TIMEOUT_PARK, t);
              continue;
            }
          }
        } else if (!group) {
          item.timeoutsAlone = 0; // another outcome ends the run of consecutive time-outs
        }
        putBack(item, t + backoff(Math.max(1, item.failures), 5 * SEC, 60 * SEC));
        continue;
      }
      // A deferred address is re-queued at once, with no backoff and no attempt counted (A1-13): one of a group that
      // timed out is marked to be read alone, or re-read with its group first; a marked single the round did not read
      // keeps its mark; one whose read answered but waits for its element is no longer due a regroup.
      if (deferred.has(a)) {
        settle(a, false);
        if (markAlone.has(a)) { item.single = true; item.regroup = null; }
        else if (regroupAt.has(a)) { if (!item.single) item.regroup = regroupAt.get(a); }
        else if (readOk.has(a)) item.regroup = null;
        putBack(item, t);
        continue;
      }
      const info = decided.get(a);
      if (!info) continue;
      item.single = false; // A1-13: a read-alone mark lasts until the address's own read succeeds
      item.regroup = null;
      item.timeoutsAlone = 0;
      const w = writeAt.get(a);
      if (w && !w.result) continue; // not attempted (a graph outage or a stop): the finally puts it back
      if (w && w.result.lost) {
        // Re-queued at once with its prompts; after 5 consecutive losses, 10 s.
        item.losses += 1;
        item.entry = info.entry;
        settle(a);
        putBack(item, item.losses >= LOST_RACE_LIMIT ? t + LOST_RACE_BACKOFF_MS : t);
        continue;
      }
      if (w && (w.result.transient || w.result.refused)) {
        item.entry = info.entry;
        const code = w.result.transient || w.result.refused;
        settle(a);
        if (w.result.refused && !noneLanded) {
          if (item.lastCode === code || item.parkedCode === code) { park(item, code, t); continue; }
          item.lastCode = code;
        }
        item.failures += 1;
        putBack(item, t + backoff(item.failures, 5 * SEC, 60 * SEC));
        continue;
      }
      // Decided: completed, whatever the action, except a conflict (left to the pass, as the pass leaves it).
      if (!info.conflict) { complete(a, info.relayAt, capture.get(a)); if (!info.held) reflected = true; }
      if (item.relookRuns) for (const runId of item.relookRuns) addLine({ t: 'rc', a, runId });
      settle(a);
    }
    for (const [stage, err] of readFailures) noteError(stage, err);
    if (reflected) lastReflectedAt = iso(t);

    // A successful write retries every parked address at once — except one parked for its reads timing out, which a
    // write says nothing about (A1-13): it waits for its timer, a start, or a new event at its address.
    if (out.applied > 0) for (const [a, p] of [...parked]) if (p.code !== TIMEOUT_PARK) unpark(a, 'catchup');

    // 8. The pass: re-looks for every address looked at while a pass overlapped (D6-A).
    const commitAt = now();
    const looked = order.filter((a) => decided.has(a));
    if (looked.length > 0) {
      const runs = await readRuns();
      const alive = await aliveRuns(runs, commitAt);
      const overlapping = passOverlaps({ graphReadAt, commitAt }, runs, (r) => alive.get(r.runId) === true, deadSeenAt);
      for (const runId of overlapping) {
        watchedRuns.add(runId);
        for (const a of looked) {
          const { isNew, merged } = keepRecheck(a, runId, decided.get(a).entry);
          if (isNew) counts.relooks += 1;
          addLine({ t: 'r', a, runId, p: merged });
        }
      }
    }
    lastRound = { ms: commitAt - t0, addresses: order.length };
    flushJournal();
    if (journalPastCadence()) snapshot();
  }

  /**
   * A1-6, the cadence: a compaction once the journal passes the larger of 1 MB and a quarter of record.json (absolute
   * lines are larger, and this bounds how often a flood at one address rewrites the whole record).
   */
  function journalPastCadence() {
    let bytes = 0;
    try { bytes = store.journalBytes(); } catch (_) { bytes = 0; }
    return bytes > Math.max(LIMITS.journalCompactBytes, recordBytes / 4);
  }

  /** Mark an address completed at the version its read returned (journal c; a refused one also f), then shrink. */
  function complete(address, relayAt, captureSeq) {
    const id = relayVersionId(relayAt);
    // S changes only at this address (an id's address is its event's), so the heard counter moves only here (A1-1).
    keepingHeard([address, id === null ? null : topAddressOf(id)], () => {
      if (id !== null) {
        addLine({ t: 'c', id, a: address });
        recordId(maps, 'S', id, address, ++seq);
        if (relayAt.ok === false) {
          addLine({ t: 'f', id, a: address });
          recordId(maps, 'R', id, address, ++seq);
        }
      }
      // A successful, conflict-free read drops the ids recorded here before it began, other than the one it returned.
      if (typeof captureSeq === 'number') {
        const { dropped } = shrinkOnRead(maps, address, id, captureSeq);
        if (dropped.length > 0) addLine({ t: 'x', a: address, dropped });
      }
    });
  }

  /**
   * Park an address (§ Failure handling; A1-13): a database refusal is counted once in dbRefused by its code; an
   * address parked for its reads timing out (TIMEOUT_PARK) is a relay failure, already counted in failedReads.
   */
  function park(item, code, t) {
    const counted = item.parkedCode === code;
    if (!counted && code !== TIMEOUT_PARK) {
      counts.dbRefused.total += 1;
      const key = allowErrorCode(code);
      counts.dbRefused.byReason[key] = (counts.dbRefused.byReason[key] || 0) + 1;
    }
    let level = item.parkedCode === code ? Math.min(item.parkLevel + 1, PARK_RETRY_MS.length - 1) : 0;
    // A1-5: nothing discards a prompt. An entry already parked at the address is merged under this one, never replaced
    // (the higher level and the read-alone mark kept), and the re-looks the item carries stay with it.
    const prev = parked.get(item.address);
    let entry = item.entry;
    let single = item.single === true;
    const relookRuns = new Set(item.relookRuns || []);
    if (prev) {
      entry = mergeEntry(prev.entry, item.entry);
      if (prev.code === code) level = Math.max(level, prev.level);
      single = single || prev.single === true;
      for (const r of prev.relookRuns || []) relookRuns.add(r);
    }
    parked.set(item.address, {
      code, entry, level, nextAt: t + PARK_RETRY_MS[level], single, relookRuns: relookRuns.size > 0 ? relookRuns : null,
    });
    addLine({ t: 'p', a: item.address, code });
    // A1 clarification 12: a new event reached the address while this round held it (a fresh item waits). It is
    // retried at once, as any new event at a parked address is (§ Failure handling), carrying the park's level and the
    // read-alone mark (A1-13: the mark stays until its own read succeeds), never as an unmarked fresh item. (A catch-up
    // feeds its backlog only between activities, never while a round holds an address, so no fresh item here is a
    // catch-up's: the clarification's catch-up rule is feedCatchUp's.)
    if (pending.has(item.address)) unpark(item.address, pending.get(item.address).lane);
  }

  /** One port call of ≤ 25 rows; a refused call is bisected to single rows, a transient one backed off whole. */
  async function applyBatch(g, kind, batch, out) {
    if (stopping || out.abort) { out.abort = true; return; }
    let res;
    try {
      if (kind === 'create') {
        res = await g.applyCreates(batch.map((w) => ({ address: w.address, desired: w.desired })), { timeoutMs: WRITE_TIMEOUT_MS });
      } else {
        const rows = batch.map((w) => (w.desired
          ? { address: w.address, snapshot: w.row, desired: w.desired }
          : { address: w.address, snapshot: w.row }));
        res = await g.applyLocked(kind, rows, { timeoutMs: WRITE_TIMEOUT_MS, preimage });
      }
    } catch (err) {
      if (err && err.partial) account(kind, batch.filter((w) => err.partial.appliedAddresses.includes(w.address)), err.partial, out);
      const rest = batch.filter((w) => !w.result);
      const cls = errorClass(err);
      if (cls === 'unavailable' || cls === 'auth') { graphDown('graph-write', err, false); out.abort = true; return; }
      if (cls === 'tx' || cls === 'local') {
        noteError('graph-write', err);
        for (const w of rest) w.result = { transient: allowErrorCode(errCode(err) || 'error') };
        return;
      }
      if (rest.length > 1) {
        const h = Math.ceil(rest.length / 2);
        await applyBatch(g, kind, rest.slice(0, h), out);
        await applyBatch(g, kind, rest.slice(h), out);
        return;
      }
      noteError('graph-write', err);
      for (const w of rest) w.result = { refused: errCode(err) || 'error' };
      return;
    }
    graphUp();
    account(kind, batch, res, out);
  }

  function account(kind, batch, res, out) {
    const applied = new Set(res && Array.isArray(res.appliedAddresses) ? res.appliedAddresses : []);
    counts.peopleAdded += (res && res.nodesCreated) || 0;
    for (const w of batch) {
      if (!applied.has(w.address)) {
        w.result = { lost: true };
        counts.lostRaces[kind] += 1;
        continue;
      }
      w.result = { applied: true };
      out.applied += 1;
      if (kind === 'create') {
        counts.added += 1;
        graphAddresses.add(w.address);
      } else if (kind === 'remove') {
        counts.removed += 1;
        counts.removedBy[w.reason] = (counts.removedBy[w.reason] || 0) + 1;
      } else {
        counts.changed += 1;
        if (w.label) counts.changedBy[w.label] = (counts.changedBy[w.label] || 0) + 1;
      }
    }
  }

  /** The guard's step 1: a pre-image of every row carrying a key outside the nine, appended before its transaction. */
  async function preimage(batch) {
    const records = preimageRecords(sessionId, batch, { writer: 'realtime' });
    if (records.length === 0) return;
    try {
      const file = await st.appendPreimages(sessionId, records);
      preimageFile = file || `preimages/${sessionId}.jsonl`;
    } catch (err) {
      if (err && typeof err === 'object') err.taggingEdgesPreimage = true;
      throw err;
    }
  }

  // ─── the loop ────────────────────────────────────────────────────────────────────────────────────────────

  function nextActivity(t) {
    if (census && census.state === 'due') return takeCensus; // A1-8: before the baseline start's REQ
    if (baselineDue(t)) return takeBaseline;
    const c = cu.running;
    if (c && c.step) {
      // A1-11: a catch-up's reads and the rounds take turns, one at a time: a due round goes between two of its reads.
      if (c.roundTurn) {
        c.roundTurn = false;
        if (roundDue(t)) return runRound;
      }
      return catchUpStep;
    }
    if (catchUpDue(t)) return runCatchUp;
    if (roundDue(t)) return runRound;
    return null;
  }

  /** Wait for the activity to settle, or one event-loop turn: never a timer, never deps.sleep (T29). → settled */
  async function settleOrTurn(p) {
    return Promise.race([p.then(() => true), turn().then(() => false)]);
  }

  async function runActivities() {
    for (let i = 0; i < MAX_ACTIVITIES_PER_TICK; i += 1) {
      if (activity) {
        const settled = await settleOrTurn(activity);
        if (!settled) return;
        // A round boundary: the switch is read again before anything else starts (ADR "Off means off within 5 s").
        if (!stopping && !(await pollSwitch())) stopping = 'off';
      }
      if (stopping) return;
      const fn = nextActivity(now());
      if (!fn) return;
      const tracked = fn().catch((err) => { noteError('unexpected', err); }).then(() => { if (activity === tracked) activity = null; });
      activity = tracked;
    }
  }

  async function pollSwitch() {
    let sw = null;
    try { sw = await store.readSwitch(); } catch (_) { sw = { unreadable: true }; }
    return isPlainObject(sw) && sw.on === true;
  }

  async function stopStep() {
    const t = now();
    if (stopStartedAt === null) {
      stopStartedAt = t;
      log(stopping === 'signal' ? 'stopping on a signal' : 'the switch is off: stopping');
      try { if (typeof deps.killScans === 'function') deps.killScans(); } catch (_) { /* best effort */ }
    }
    if (activity && t - stopStartedAt < STOP_GRACE_MS) {
      const settled = await settleOrTurn(activity);
      if (!settled) { flushJournal(); return {}; }
    }
    flushJournal();
    if (cu.running) endCatchUp(cu.running, 'stopped');
    // A1-18: the final status says the subscription is closed (it is, the moment the process exits).
    closeSubscription();
    subscription.connected = false;
    writeStatus(true);
    exited = true;
    if (graph) { try { Promise.resolve(graph.close()).catch(() => {}); } catch (_) { /* closing */ } }
    return { exit: 0 };
  }

  // ─── the seam (T20) ──────────────────────────────────────────────────────────────────────────────────────

  async function start() {
    const t = now();
    startedAtMs = t;
    let hex = '';
    try { hex = String(deps.randomId()); } catch (_) { hex = ''; }
    if (!/^[0-9a-f]{8}$/.test(hex)) hex = require('crypto').randomBytes(4).toString('hex');
    sessionId = makeRunId(t, hex);
    nextSwitchPollAt = t + SWITCH_POLL_MS;
    nextRelookAt = t;

    // The switch first: off (or missing, or unreadable) means nothing happens at all.
    if (!(await pollSwitch())) { offAtStart = true; stopping = 'off'; return; }

    let started = null;
    let prevStatus = null;
    try { started = await store.readStarted(); } catch (_) { started = { unreadable: true }; }
    try { prevStatus = await store.readStatus(); } catch (_) { prevStatus = { unreadable: true }; }
    const statusFirst = isPlainObject(prevStatus) && typeof prevStatus.firstStartedAt === 'string' ? prevStatus.firstStartedAt : null;
    // A marker present but unreadable is never taken for a first start (AC-4: a lost record is not a first start).
    const statusMarker = statusFirst !== null || (isPlainObject(prevStatus) && prevStatus.unreadable === true);
    if (isPlainObject(started) && typeof started.firstStartedAt === 'string') firstStartedAt = started.firstStartedAt;

    const ids = resolveIdentities(deps);
    let record = null;
    let journal = { lines: [] };
    if (!ids.refusal) {
      try { record = await store.readRecord(); } catch (_) { record = { unreadable: true, reason: 'record-unreadable' }; }
    }
    const marker = started !== null || record !== null || statusMarker;
    if (!firstStartedAt && isPlainObject(record) && typeof record.firstStartedAt === 'string') firstStartedAt = record.firstStartedAt;
    if (!firstStartedAt) firstStartedAt = statusFirst;
    if (marker) {
      if (isPlainObject(prevStatus) && isPlainObject(prevStatus.counts)) counts = restoreCounts(prevStatus.counts);
      else counts = { ...emptyCounts(), countsReset: true }; // status.json was lost: the counts start again
      const prevCatchUp = isPlainObject(prevStatus) && isPlainObject(prevStatus.catchUp) ? prevStatus.catchUp : null;
      if (prevCatchUp && isPlainObject(prevCatchUp.last)) cu.last = prevCatchUp.last;
      if (isPlainObject(prevStatus)) restoreStatusFields(prevStatus);
    }

    if (ids.refusal) {
      // A bad setup writes nothing: no subscription, no scan, no graph; the status names the problem (A3 note).
      const { identity, problem, source } = ids.refusal;
      setupProblem = { kind: 'identity', identity, problem, source };
      log(`waiting for a usable ${identity} stamp identity (${problem}, source ${source})`);
      writeStatus(true);
      return;
    }
    identities = { canonicalPubkey: ids.canonicalPubkey, localPubkey: ids.localPubkey };
    subFilters = subscriptionFilters(identities);
    stampFilter = { kinds: [39999], '#z': subFilters[0]['#z'].slice() };

    if (!marker) {
      // Opened only to cut a torn tail before the first append; with no record, its lines carry nothing to restore.
      try { await store.openJournal(); } catch (_) { /* the baseline's compaction empties it */ }
      baseline = { mode: 'first', buffer: { versions: [], deletions: [], ids: new Set(), targets: 0 }, liveIds: null };
    } else {
      try { journal = await store.openJournal(); } catch (_) { journal = { unreadable: true }; }
      const recordOk = isPlainObject(record) && !record.unreadable;
      const sameIds = recordOk && isPlainObject(record.identities)
        && record.identities.canonical === identities.canonicalPubkey && record.identities.local === identities.localPubkey;
      let lost = null;
      if (record === null) lost = 'record-missing';
      else if (!recordOk) lost = 'record-unreadable';
      else if (!isPlainObject(journal) || journal.unreadable) lost = 'journal-unreadable';
      else if (!sameIds) lost = 'identity-changed';
      const lineSource = isPlainObject(journal) && !journal.unreadable && journal.lines ? journal.lines : [];
      let replay;
      // A1-6: replay applies each line as it is read and never buffers the journal. A read that fails part-way ends
      // the replay there: the state built so far stands (every line that changes a lineage is absolute, so that is an
      // earlier state), and the start is still not established (journal-unreadable).
      let readFailed = false;
      // A1-6: the next compaction's epoch passes every epoch the record and the journal name (any generation), so it
      // is never one already in the file (A1 clarification 4).
      const passEpoch = (epoch) => {
        if (typeof epoch === 'number' && Number.isFinite(epoch)) lastEpoch = Math.max(lastEpoch, epoch);
      };
      // The generation the record names, when replay takes the record; and whether the journal opens it.
      const recordEpoch = recordOk && sameIds && (typeof record.epoch === 'number' || typeof record.epoch === 'string')
        ? record.epoch : null;
      let sawGeneration = false;
      const noteEpoch = (line) => {
        if (typeof line !== 'string' || !line.startsWith('{"t":"e"')) return;
        let o;
        try { o = JSON.parse(line); } catch (_) { return; } // skipped by the replay
        passEpoch(o.epoch);
        if (recordEpoch !== null && o.epoch === recordEpoch) sawGeneration = true;
      };
      const guarded = {
        [Symbol.iterator]() {
          let it = null;
          return {
            next() {
              if (readFailed) return { done: true, value: undefined };
              try {
                if (it === null) it = lineSource[Symbol.iterator]();
                const r = it.next();
                if (r && !r.done) noteEpoch(r.value);
                return r;
              } catch (_) {
                readFailed = true;
                return { done: true, value: undefined };
              }
            },
          };
        },
      };
      if (isPlainObject(record)) passEpoch(record.epoch);
      if (recordOk) recordBytes = recordSize(record);
      try {
        replay = replayJournal(guarded, recordOk && sameIds ? record : null);
      } catch (_) {
        readFailed = true; // the replay itself threw: nothing of the journal is taken, as with an unreadable one
        replay = replayJournal([], recordOk && sameIds ? record : null);
      }
      if (readFailed && !lost) lost = 'journal-unreadable';
      maps = replay.maps;
      // A1-6: a journal not read whole may have lost the lines that moved a top on, so a restored top may be behind the
      // relay's store order and clause (ii) could act on a stale deletion. Every restored top is demoted into its
      // `older` (it resolves no by-id deletion until learned again); the start's stamp scan re-learns the tops of the
      // addresses still on the relay within seconds.
      const journalWhole = isPlainObject(journal) && !journal.unreadable && !readFailed;
      if (!journalWhole) {
        for (const [address, lin] of [...maps.L]) {
          if (lin.top !== null) setLineage(maps, address, { top: null, older: [...(lin.older || []), lin.top] });
        }
      }
      // A1-6: a record whose generation the journal never opened (a stop between a compaction's record write and its
      // `e` line: a crash, or a truncation and an append that both failed) gets that line first, before anything this
      // process journals — otherwise every later line sits outside the record's generation and the next start skips it.
      if (recordEpoch !== null && journalWhole && !sawGeneration) {
        lines = [journalLine({ t: 'e', epoch: recordEpoch })].concat(lines);
      }
      recountHeard();
      skippedLines = replay.skippedLines;
      deadSeenAt = { ...replay.deadSeenAt };
      // A re-look kept for a pass also means that pass overlapped a round: its end still schedules a catch-up.
      for (const r of replay.rechecks) { keepRecheck(r.a, r.runId, r.entry); watchedRuns.add(r.runId); }
      // Restored work is catch-up work, due at once with no attempt counted (T33); parked ones retried at every start.
      for (const [address, entry] of replay.pending) enqueue(address, 'catchup', { entry });
      // A parked row's prompts came back in replay.pending (A1-12), so the retry carries them.
      for (const [address, code] of replay.parked) {
        const item = enqueue(address, 'catchup', {});
        if (item) item.parkedCode = code;
      }
      for (const item of pending.values()) { item.notBefore = 0; item.due = t; }
      if (lost) {
        notEstablished = lost;
        baseline = { mode: 'rebaseline', buffer: null, liveIds: new Set() };
        log(`the record is not established (${lost}): re-baselining`);
      } else {
        baselineDone = true;
        // A lost record's catch-up that failed or was stopped before it completed: this start's catch-up reports it.
        const prev = cu.last;
        const unreported = isPlainObject(prev) && (prev.outcome === 'failed' || prev.outcome === 'stopped');
        if (unreported && LOST_REASONS.includes(prev.reason)) notEstablished = prev.reason;
      }
    }

    // The pass's report: a run already dead at this start is seen dead now (deadSeenAt, journal k).
    await aliveRuns(await readRuns(), t);
    // A1-8: a start that takes a baseline first runs its census (an activity); the REQ follows it.
    if (baseline) census = { state: 'due', deadline: Infinity, giveUp: null };
    else openSubscription();
    flushJournal();
    writeStatus(true);
  }

  async function tick() {
    if (exited) return { exit: 0 };
    if (offAtStart) { exited = true; return { exit: 0 }; }
    try {
      const t = now();
      drain();
      if (!stopping && t >= nextSwitchPollAt) {
        nextSwitchPollAt = t + SWITCH_POLL_MS;
        if (!(await pollSwitch())) stopping = 'off';
      }
      if (stopping) return await stopStep();
      if (identities) {
        if (census && census.state === 'running' && t >= census.deadline) census.giveUp(); // A1-8: ≤ 10 s
        if (!sub && !census && t >= reconnectAt) openSubscription();
        if (t >= nextRelookAt) { nextRelookAt = t + RELOOK_CHECK_MS; await relookCheck(); }
        for (const [address, p] of [...parked]) if (p.nextAt <= t) unpark(address, 'catchup');
        if (baselineDone && !baseline && !cu.running && !cu.requested && t >= nextSafetyAt) requestCatchUp('safety-diff');
        await runActivities();
      }
      if (lines.length > 0 && now() - lastFlushAt >= LIMITS.journalFlushMs) {
        flushJournal();
        // The cadence also holds while no round reaches its end (the graph unreachable, a database rule missing) and
        // deliveries keep journaling: between activities, once a record exists (never before a baseline is written).
        if (!activity && baselineDone && !baseline && journalPastCadence()) snapshot();
      }
      writeStatus(false);
    } catch (err) {
      noteError('unexpected', err);
    }
    return {};
  }

  function handleSignal(name) {
    if ((name === 'SIGTERM' || name === 'SIGINT') && !stopping) stopping = 'signal';
  }

  function status() { return lastStatus; }

  /** Node exits on an uncaught error only after writing the status (ADR § Where it runs): stopped, lastError 'unexpected'. */
  function crash(err) {
    if (crashed) return;
    crashed = true;
    noteError('unexpected', err);
    try { flushJournal(); } catch (_) { /* the status still says so */ }
    subscription.connected = false; // Node exits next: the subscription goes with it (A1-18)
    writeStatus(true);
  }

  return {
    api: { start, tick, handleSignal, status },
    busy: () => !!activity,
    crash,
  };
}

/** The engine over its dependencies (T20). */
function createEngine(deps) {
  return makeEngine(deps).api;
}

/**
 * start(), then tick() until an exit, sleeping through deps.sleep (≤ 250 ms). The exit code is left on
 * deps.proc.exitCode; this never calls process.exit (T20). `deps.signals` (the process, from the entry) forwards
 * SIGTERM and SIGINT to handleSignal, and an uncaught error to the engine, which writes the status before the loop
 * ends with 1 (ADR § Where it runs: "an uncaught error (after writing the status)"); an error that escapes start()
 * or tick() is written the same way.
 */
async function run(depsIn = {}) {
  const deps = { ...defaultDeps(), ...depsIn };
  const engine = makeEngine(deps);
  const signals = deps.signals && typeof deps.signals.on === 'function' ? deps.signals : null;
  const onTerm = () => engine.api.handleSignal('SIGTERM');
  const onInt = () => engine.api.handleSignal('SIGINT');
  let uncaught = null;
  const onUncaught = (err) => {
    if (uncaught !== null) return;
    uncaught = err || new Error('error');
    try { engine.crash(uncaught); } catch (_) { /* the loop still ends */ }
  };
  if (signals) { signals.on('SIGTERM', onTerm); signals.on('SIGINT', onInt); signals.on('uncaughtException', onUncaught); }
  let code = 1;
  try {
    await engine.api.start();
    for (;;) {
      if (uncaught !== null) throw uncaught;
      const r = await engine.api.tick();
      if (r && r.exit !== undefined && r.exit !== null) { code = r.exit; break; }
      await deps.sleep(engine.busy() ? BUSY_TICK_MS : TICK_MS);
    }
  } catch (err) {
    try { engine.crash(err); } catch (_) { /* the status is best effort here */ }
    const what = redactPublicText(errCode(err) || (err && err.message) || 'error').slice(0, 300);
    try { deps.log(`[tagging-edges-realtime] stopped by an unexpected error: ${what}`); } catch (_) { /* logging */ }
    code = 1;
  } finally {
    if (signals && typeof signals.removeListener === 'function') {
      signals.removeListener('SIGTERM', onTerm);
      signals.removeListener('SIGINT', onInt);
      signals.removeListener('uncaughtException', onUncaught);
    }
  }
  if (deps.proc) deps.proc.exitCode = code;
  return code;
}

module.exports = { createEngine, run, defaultDeps };

if (require.main === module) {
  // Only under the wrapper: fd 8 must hold the exclusive flock on realtime/daemon.lock itself (C20).
  const state = require('../state');
  if (!state.lockHeld(LOCK_FD, { file: path.join(state.stateDir(), 'realtime', 'daemon.lock') })) {
    console.error('[tagging-edges-realtime] refused: not started under the wrapper\'s lock (supervisord runs run.sh)');
    process.exitCode = 2;
  } else {
    const deps = { ...defaultDeps(), signals: process };
    run(deps).then(
      () => process.exit(deps.proc.exitCode == null ? 1 : deps.proc.exitCode),
      (err) => {
        console.error(`[tagging-edges-realtime] ${redactPublicText(errCode(err) || 'error')}`);
        process.exit(1);
      },
    );
  }
}
