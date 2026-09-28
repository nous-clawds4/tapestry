#!/usr/bin/env node
/**
 * reconcileTaggingEdges — the gap-filling pass (tagging-edges story 2, ADR tagging-edges/0002).
 *
 * Brings the graph's `TAGS` relationships into agreement with this instance's own relay, one tagging
 * at a time. The first run is the backfill; every later run repairs drift. Started only through the
 * task system, by reconcileTaggingEdges.sh, which holds the pass's kernel flock on fd 9 and execs this
 * file (so the lock lives exactly as long as the pass).
 *
 * Sequence (ADR 0002, Implementation notes): lock → runId → pessimistic report → identities → config
 * → schema pre-flight → claim any owner confirmation → READ graph → READ relay (one strict scan,
 * started only after the graph read resolved) → plan (pure) → creates, updates, moves, removals →
 * held file + final report. A refusal or a failed read changes nothing; the report says why.
 *
 * Exit codes: 0 done or done-removals-held (and a start refused because another pass holds the lock);
 * 2 refused; 1 failed.
 */

const {
  TAGS_PROPERTY_KEYS, RUN_ID_RE, checkIdentity, sweepFilter, isExpectedScanEvent, groupSnapshot, planPass, canonicalValue,
  removalKey,
} = require('../../lib/tagging-edges/sweep');
const { schemaStatusFromRows, SCALAR_TYPES, MAX_BATCH } = require('./graph');

const TASK_NAME = 'reconcileTaggingEdges';
const LOCK_FD = 9;
const SCAN_TIMEOUT_MS = 60000;
const GRAPH_READ_TIMEOUT_MS = 120000;
const WRITE_TIMEOUT_MS = 60000;
const SCHEMA_WAIT_MS = 60000;
const SAVE_EVERY_BATCHES = 10;
const PREVIOUS_CAP = 9;
const STRIPPED_KEYS_CAP = 100;
const STOPPED_REASON = 'stopped before it finished (time-out, deploy or restart)';
const CANONICAL_Z_RE = /^39998:(.*):nostr-user-tag$/s;

/** The real dependencies, required lazily so this module loads stack-free. */
function defaultDeps(argv = process.argv.slice(2)) {
  const state = require('./state');
  return {
    now: () => Date.now(),
    randomId: () => require('crypto').randomBytes(4).toString('hex'),
    lock: { busy: argv.includes('--lock-busy'), held: () => state.lockHeld(LOCK_FD) },
    state,
    identities: {
      // The ADR 0015 literal, from its one server home — never copied here (precedent: the assistant identification-tags route's canonicalZ()).
      canonicalZ: () => require('../../api/profile-tags').NOSTR_USER_TAG_Z_TAG,
      getOwnerAssistantPubkey: () => require('../../utils/assistantKeys').getOwnerAssistantPubkey(),
    },
    env: process.env,
    openGraph: (cfg) => require('./graph').openGraph(cfg),
    scan: (filter, opts) => require('../../lib/strfryScanStrict').scanStrict(filter, opts),
    emit: (eventType, metadata) => require('../../utils/structuredEvents').emitTaskEvent(eventType, TASK_NAME, '', metadata),
    // clarification C2: `process` itself; its start time comes from state.processStartTime(pid) (step 3).
    proc: process,
    signals: process,
  };
}

function iso(ms) { return new Date(ms).toISOString(); }

function makeRunId(ms, hex) {
  const d = new Date(ms);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z-${hex}`;
}

function prefix(pk) { return typeof pk === 'string' ? pk.slice(0, 8) : null; }

/**
 * Error text for the report, which a public route serves: bounded, with any URI (it may carry credentials) and
 * any IPv4 host:port replaced, and every 64-hex run cut to 8 characters.
 */
function safeMessage(err) {
  const m = err && err.message ? String(err.message) : String(err);
  return m
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s'"]+/gi, '<uri>')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}:\d+\b/g, '<host>')
    .replace(/[0-9a-fA-F]{64,}/g, (x) => x.slice(0, 8))
    .slice(0, 300);
}

/** A filesystem failure names its code and the state-relative file, never err.message (which carries a path). */
function fsFailure(stage, err, relFile) {
  const code = (err && err.code) || 'error';
  return { stage, code, message: `${code} ${relFile}` };
}

/**
 * Step 4. Both stamp identities, or the refusal naming which one is wrong and where it came from.
 * → { canonicalPubkey, localPubkey } | { refusal: { identity, problem, source } }
 */
function resolveIdentities(deps) {
  const ids = deps.identities || {};
  let z;
  try { z = ids.canonicalZ(); } catch (_) { z = undefined; }
  const m = typeof z === 'string' ? CANONICAL_Z_RE.exec(z) : null;
  const canonical = m ? m[1] : undefined;
  const cp = checkIdentity(canonical);
  if (cp) return { refusal: { identity: 'canonical', problem: cp, source: 'profile-tags' } };

  const env = deps.env || {};
  if (env.TA_PUBKEY !== undefined) {
    const p = checkIdentity(env.TA_PUBKEY);
    if (p) return { refusal: { identity: 'local', problem: p, source: 'env TA_PUBKEY' } };
  }
  if (env.BRAINSTORM_RELAY_PUBKEY !== undefined) {
    const p = checkIdentity(env.BRAINSTORM_RELAY_PUBKEY);
    if (p) return { refusal: { identity: 'local', problem: p, source: 'brainstorm.conf' } };
  }
  let helper;
  try { helper = ids.getOwnerAssistantPubkey(); } catch (_) { helper = null; }
  if (helper === null || helper === undefined) {
    return { refusal: { identity: 'local', problem: 'missing', source: 'brainstorm.conf' } };
  }
  const source = env.TA_PUBKEY !== undefined ? 'env TA_PUBKEY'
    : helper === env.BRAINSTORM_RELAY_PUBKEY ? 'brainstorm.conf' : 'secure-keys file';
  const lp = checkIdentity(helper);
  if (lp) return { refusal: { identity: 'local', problem: lp, source } };
  return { canonicalPubkey: canonical, localPubkey: helper };
}

function emptyRelationships() {
  return {
    atStart: 0,
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
  };
}

/** The first record a pass writes: it already reads "failed — stopped", so a kill leaves it true. */
function pessimisticRecord({ runId, startedAt, pid, startTime }) {
  return {
    runId,
    startedAt,
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
    relationships: emptyRelationships(),
    peopleAdded: 0,
    refused: { total: 0, byReason: {} },
    held: { total: 0, byReason: {}, digest: null },
    limit: { base: 0, leftInPlaceExcluded: 0, baseAfterConfirmed: null, removalsPlanned: 0, floor: 50, fraction: '1/10', exceeded: false },
    identities: { canonical: null, local: null },
    reads: { graph: null, relay: null },
    phases: [],
    anomalies: { sameAddressConflicts: 0, snapshotConflicts: 0 },
    running: true,
    process: { pid, startTime },
  };
}

/** Step 7's check of a claimed confirmation. → the confirmed held list, or { why } */
async function validateClaim(claim, previous, deps, nowMs) {
  if (!claim || typeof claim !== 'object' || claim.unreadable) return { why: 'unreadable' };
  if (claim.version !== 1 || typeof claim.runId !== 'string' || !RUN_ID_RE.test(claim.runId)) return { why: 'malformed' };
  const expires = Date.parse(claim.expiresAt);
  if (!Number.isFinite(expires) || nowMs >= expires) return { why: 'expired' };
  const lastRead = (previous || []).find((r) => r && Array.isArray(r.phases) && r.phases.some((p) => p && p.phase === 'graph-read'));
  if (!lastRead || lastRead.runId !== claim.runId) return { why: 'report-changed' };
  if (lastRead.outcome !== 'done-removals-held') return { why: 'report-not-held' };
  let list;
  try { list = await deps.state.readHeld(claim.runId); } catch (e) { return { why: `held-file-unreadable ${(e && e.code) || 'error'}` }; }
  if (!Array.isArray(list)) return { why: 'held-file-missing' };
  if ((await deps.state.heldDigest(list)) !== claim.heldDigest) return { why: 'digest-mismatch' };
  return { list };
}

function exitCodeFor(result) {
  if (!result) return 1;
  if (result.reportWriteFailed) return 1;
  if (result.outcome === 'done' || result.outcome === 'done-removals-held') return 0;
  if (result.outcome === 'not-started') return result.reasonCode === 'lock-busy' ? 0 : 2;
  if (result.outcome === 'refused') return 2;
  return 1;
}

/** Run one pass; the exit code is left on `deps.proc.exitCode` (clarification C2), never process.exit. */
async function run(depsIn = {}) {
  const result = await runInner(depsIn);
  if (depsIn.proc) depsIn.proc.exitCode = exitCodeFor(result);
  return result;
}

async function runInner(depsIn) {
  const deps = { ...defaultDeps(), ...depsIn };
  const emit = (type, metadata) => { try { deps.emit(type, metadata); } catch (_) { /* best effort */ } };

  // 1. The lock. A start that finds it held, or a hand-run outside the wrapper, touches no file.
  if (deps.lock && deps.lock.busy) {
    const why = 'another pass is running';
    emit('TASK_START', {});
    emit('TASK_ERROR', { outcome: 'not-started', why });
    emit('TASK_END', { outcome: 'not-started', why });
    return { outcome: 'not-started', reasonCode: 'lock-busy', why };
  }
  let lockHeld = false;
  try { lockHeld = !!(deps.lock && deps.lock.held()); } catch (_) { lockHeld = false; }
  if (!lockHeld) {
    const why = 'not started under the pass lock (run it through the task system)';
    emit('TASK_START', {});
    emit('TASK_ERROR', { outcome: 'not-started', reasonCode: 'not-started-under-the-lock', why });
    emit('TASK_END', { outcome: 'not-started', reasonCode: 'not-started-under-the-lock', why });
    return { outcome: 'not-started', reasonCode: 'not-started-under-the-lock', why };
  }

  // 2. The run id.
  const t0 = deps.now();
  let hex = '';
  try { hex = String(deps.randomId()); } catch (_) { hex = ''; }
  if (!/^[0-9a-f]{8}$/.test(hex)) hex = require('crypto').randomBytes(4).toString('hex');
  const runId = makeRunId(t0, hex);
  emit('TASK_START', { runId });

  // 3. The pessimistic record, before any graph contact.
  let prior = null;
  try { prior = await deps.state.readReport(); } catch (_) { prior = null; }
  const previous = [];
  if (prior && prior.latest && typeof prior.latest === 'object') {
    const last = { ...prior.latest };
    if (last.running === true) { last.running = false; last.stoppedDetectedAt = iso(t0); }
    previous.push(last);
  }
  if (prior && Array.isArray(prior.previous)) previous.push(...prior.previous);
  previous.splice(PREVIOUS_CAP);

  // The process start time: from proc when it carries one, else field 22 of /proc/<pid>/stat (`process` has none).
  const proc = deps.proc || {};
  let startTime = null;
  try {
    startTime = typeof proc.startTime === 'function' ? proc.startTime()
      : proc.startTime != null ? proc.startTime
        : deps.state.processStartTime(proc.pid);
  } catch (_) { startTime = null; }
  const latest = pessimisticRecord({ runId, startedAt: iso(t0), pid: proc.pid == null ? null : proc.pid, startTime: startTime == null ? null : startTime });
  const save = () => deps.state.writeReport({ reportVersion: 1, latest, previous });
  try {
    await save();
  } catch (err) {
    emit('TASK_ERROR', { runId, outcome: 'failed', stage: 'report', code: (err && err.code) || 'error' });
    emit('TASK_END', { runId, outcome: 'failed', reasonCode: 'report', confirmed: null, counts: {} });
    return { ...latest, outcome: 'failed', reasonCode: 'report', failure: fsFailure('report', err, 'report.json'), running: false, reportWriteFailed: true };
  }
  // Phase-boundary rewrites are best effort; a port that answers with a promise has its rejection swallowed too.
  const saveQuietly = () => {
    try { const p = save(); if (p && typeof p.then === 'function') p.catch(() => {}); } catch (_) { /* the final write decides */ }
  };

  let graph = null;
  let stopRequested = false;
  const onStop = () => { stopRequested = true; };
  const signals = deps.signals && typeof deps.signals.on === 'function' ? deps.signals : null;
  if (signals) { signals.on('SIGTERM', onStop); signals.on('SIGINT', onStop); }

  let phaseStart = deps.now();
  const phase = (name, extra = {}) => {
    const now = deps.now();
    const entry = { phase: name, ms: now - phaseStart, batches: extra.batches || 0, transientRetries: extra.transientRetries || 0 };
    latest.phases.push(entry);
    phaseStart = now;
    emit('PROGRESS', { runId, ...entry, ...(extra.counts || {}) });
    saveQuietly();
  };

  // The final write: every exit that is not a kill passes here.
  const finish = async (outcome, fields = {}) => {
    const end = deps.now();
    Object.assign(latest, fields, {
      outcome,
      endedAt: iso(end),
      durationMs: end - t0,
      running: false,
    });
    if (!('stopped' in fields)) latest.stopped = false;
    if (signals && typeof signals.removeListener === 'function') {
      signals.removeListener('SIGTERM', onStop);
      signals.removeListener('SIGINT', onStop);
    }
    let writeFailed = false;
    try { await save(); } catch (_) { writeFailed = true; }
    if (!writeFailed) { try { if (typeof deps.state.prune === 'function') await deps.state.prune(); } catch (_) { /* best effort */ } }
    const counts = {
      taggingsRead: latest.taggingsRead,
      added: latest.relationships.added,
      changed: latest.relationships.changed,
      removed: latest.relationships.removed,
      unchanged: latest.relationships.unchanged,
      held: latest.held.total,
      refused: latest.refused.total,
      peopleAdded: latest.peopleAdded,
    };
    if (outcome === 'refused' || outcome === 'failed' || writeFailed) {
      emit('TASK_ERROR', { runId, outcome, reasonCode: latest.reasonCode, failure: latest.failure, reportWriteFailed: writeFailed || undefined });
    }
    emit('TASK_END', { runId, outcome, reasonCode: latest.reasonCode, confirmed: latest.confirmed, counts });
    // Close the driver last (ADR step 12), so a close that stalls cannot keep the final report unwritten.
    if (graph) { try { await graph.close(); } catch (_) { /* closing */ } }
    if (writeFailed) return { ...latest, reportWriteFailed: true };
    return latest;
  };
  const refuse = (reasonCode, failure, reason) => finish('refused', { reasonCode, reason, failure });
  const fail = (reasonCode, failure, reason) => finish('failed', { reasonCode, reason, failure });
  const stopNow = () => finish('failed', {
    reasonCode: 'signal',
    reason: 'stopped by a signal at a batch boundary',
    stopped: true,
    failure: { stage: 'signal', code: 'signal', message: 'SIGTERM or SIGINT' },
  });

  try {
    // 4. Identities.
    const ids = resolveIdentities(deps);
    if (ids.refusal) {
      const { identity, problem, source } = ids.refusal;
      return await refuse('identity',
        { stage: 'identity', identity, problem, source, code: problem, message: `the ${identity} stamp identity (source ${source}) is ${problem}` },
        `the ${identity} stamp identity is ${problem} (source: ${source})`);
    }
    const { canonicalPubkey, localPubkey } = ids;
    latest.identities = { canonical: prefix(canonicalPubkey), local: prefix(localPubkey) };
    phase('identities');

    // 5. Config, and the pass's own driver (never the shared getDriver(), which prints what it reads).
    const env = deps.env || {};
    for (const key of ['NEO4J_URI', 'NEO4J_USER']) {
      if (typeof env[key] !== 'string' || env[key].trim() === '') {
        return await refuse('config', { stage: 'config', code: `missing-${key}`, message: `${key} is not set` }, `${key} is not set`);
      }
    }
    try {
      graph = await deps.openGraph({ uri: env.NEO4J_URI, user: env.NEO4J_USER, password: typeof env.NEO4J_PASSWORD === 'string' ? env.NEO4J_PASSWORD : '' });
    } catch (err) {
      // Fixed text: a driver error repeats NEO4J_URI, credentials included, and the status route is public.
      return await refuse('config', { stage: 'config', code: 'driver', message: 'the Neo4j driver could not be built from NEO4J_URI' }, 'could not open the database driver');
    }

    // 6. Schema pre-flight: the one-per-tagging rule present and ONLINE (created here once if missing); nostrUser_pubkey present.
    let schema;
    try {
      const s = await graph.readSchema();
      schema = schemaStatusFromRows(s.constraints, s.indexes);
      if (!schema.tagsAddress.present || !schema.tagsAddress.online) {
        schema = await graph.ensureTagsConstraint({ timeoutMs: SCHEMA_WAIT_MS });
      }
    } catch (err) {
      return await refuse('schema', { stage: 'schema', code: (err && err.code) || 'no-status', message: safeMessage(err) }, 'the one-per-tagging rule could not be checked or created');
    }
    if (!schema || !schema.tagsAddress || !schema.tagsAddress.present || !schema.tagsAddress.online) {
      const code = schema && schema.tagsAddress && schema.tagsAddress.present ? 'tags_address-not-online' : 'tags_address-missing';
      return await refuse('schema', { stage: 'schema', code, message: 'the uniqueness rule tags_address is not in place' }, 'the one-per-tagging rule is not in place');
    }
    if (!schema.nostrUserPubkey || !schema.nostrUserPubkey.present) {
      return await refuse('schema', { stage: 'schema', code: 'nostrUser_pubkey-missing', message: 'the uniqueness rule nostrUser_pubkey is missing (Dashboard fix)' }, 'the NostrUser pubkey rule is missing');
    }
    phase('schema');

    // 7. Claim any owner confirmation (after every start check, while holding the lock). A stop asked for
    // before this point must not spend the owner's confirmation.
    if (stopRequested) return await stopNow();
    let confirmedHeld = null;
    let claim = null;
    try {
      claim = await deps.state.claimConfirmation(runId);
    } catch (err) {
      latest.confirmation = { found: false, honoured: false, why: `claim failed: ${(err && err.code) || 'error'}` };
    }
    if (claim) {
      const v = await validateClaim(claim, previous, deps, deps.now());
      if (v.list) {
        confirmedHeld = v.list;
        latest.confirmation = { found: true, honoured: true };
        latest.confirmed = { confirmedRunId: claim.runId, heldCount: v.list.length, removalsApplied: 0, heldNoLongerDue: null };
      } else {
        latest.confirmation = { found: true, honoured: false, why: v.why };
      }
      saveQuietly(); // the claim is spent whatever happens next; the stored record says so from now on
    }
    if (stopRequested) return await stopNow();

    // 8. READ the graph (t0).
    let rows;
    const graphStart = deps.now();
    try {
      rows = await graph.readAll({ timeoutMs: GRAPH_READ_TIMEOUT_MS });
      if (!Array.isArray(rows)) throw Object.assign(new Error('the graph read returned no rows list'), { code: 'incomplete' });
      const COLS = ['rid', 'fromPubkey', 'fromPubkeyType', 'fromIsUser', 'toPubkey', 'toPubkeyType', 'toIsUser', 'props'];
      for (const r of rows) {
        if (!r || typeof r !== 'object' || COLS.some((k) => !(k in r)) || !Array.isArray(r.props)) throw Object.assign(new Error('a snapshot row is missing a column'), { code: 'missing-column' });
      }
    } catch (err) {
      return await fail('read', { stage: 'read', read: 'graph', code: (err && err.code) || 'error', message: safeMessage(err) }, 'the graph read failed');
    }
    latest.reads.graph = { rows: rows.length, ms: deps.now() - graphStart };
    const snapshot = groupSnapshot(rows);
    if (snapshot.conflicts.length > 0) {
      let holding = false;
      try {
        const s = await graph.readSchema();
        const st = schemaStatusFromRows(s.constraints, s.indexes);
        holding = st.tagsAddress.present && st.tagsAddress.online;
      } catch (err) {
        return await fail('read', { stage: 'read', read: 'graph', code: (err && err.code) || 'error', message: safeMessage(err) }, 'the schema re-read failed');
      }
      if (!holding) {
        return await fail('read', { stage: 'read', read: 'graph', code: 'uniqueness-not-holding', message: 'the one-per-tagging rule is not holding' }, 'the one-per-tagging rule is not holding');
      }
    }
    latest.anomalies.snapshotConflicts = snapshot.conflicts.length;
    phase('graph-read', { counts: { rows: rows.length } });
    if (stopRequested) return await stopNow();

    // 9. READ the relay (t1 > t0): one strict scan, started only after the graph read resolved.
    const filter = sweepFilter({ canonicalPubkey, localPubkey });
    let scanned;
    const relayStart = deps.now();
    try {
      scanned = await deps.scan(filter, { timeoutMs: SCAN_TIMEOUT_MS, isExpected: (ev) => isExpectedScanEvent(ev, filter) });
      if (!scanned || !Array.isArray(scanned.events)) throw Object.assign(new Error('the relay scan returned no events list'), { code: 'incomplete' });
    } catch (err) {
      const failure = { stage: 'read', read: 'relay', code: (err && err.code) || 'error', message: safeMessage(err) };
      if (err && err.stderrTail) failure.stderrTail = String(err.stderrTail).slice(0, 300);
      return await fail('read', failure, 'the relay read failed');
    }
    latest.reads.relay = { events: scanned.events.length, bytes: scanned.bytes == null ? null : scanned.bytes, ms: deps.now() - relayStart };
    phase('relay-read', { counts: { events: scanned.events.length } });
    if (stopRequested) return await stopNow();

    // 10. Plan (pure).
    let plan;
    try {
      plan = planPass({ snapshotRows: rows, relayEvents: scanned.events, identities: { canonicalPubkey, localPubkey }, confirmedHeld });
    } catch (err) {
      return await fail('plan', { stage: 'plan', code: 'plan-error', message: safeMessage(err) }, 'planning failed');
    }
    const rel = latest.relationships;
    latest.taggingsRead = plan.taggingsRead;
    latest.tagElementsRead = plan.tagElementsRead;
    latest.refused = { total: plan.refused.total, byReason: { ...plan.refused.byReason } };
    rel.atStart = plan.counts.atStart;
    rel.unchanged = plan.counts.unchanged;
    rel.leftInPlace = plan.counts.leftInPlace;
    rel.leftInPlaceBy = { ...plan.counts.leftInPlaceBy };
    latest.limit = { ...plan.limit };
    latest.anomalies = { sameAddressConflicts: plan.anomalies.sameAddressConflicts, snapshotConflicts: plan.anomalies.snapshotConflicts };
    // A confirmed run: the held entries its own read no longer finds due; confirmed removals are counted as they commit.
    const confirmedKeys = confirmedHeld
      ? new Set(confirmedHeld.filter((h) => h && typeof h === 'object').map((h) => removalKey(h.address, h.seenEventId)))
      : null;
    if (confirmedKeys) {
      latest.confirmed.heldNoLongerDue = confirmedHeld.length
        - plan.removalsPlanned.filter((r) => confirmedKeys.has(removalKey(r.address, r.seenEventId))).length;
    }
    phase('plan', { counts: { creates: plan.creates.length, updates: plan.updates.length, moves: plan.moves.length, removals: plan.removals.length, held: plan.held.length } });

    // 11. Apply: creates → updates → moves → removals, each batch after its pre-images.
    let unresolvedApplied = 0;
    let batchesSinceSave = 0;
    // The guard, step 1: a pre-image of every row whose snapshot carries a key outside the nine, appended and
    // fsynced before its transaction opens. Built from the snapshot itself, so it holds for any caller's rows.
    const preimage = async (batch) => {
      const records = [];
      for (const r of batch) {
        const snap = r && (r.snapshot || r.row);
        if (!snap || !Array.isArray(snap.props)) continue;
        const props = snap.props.filter(Array.isArray);
        if (!props.some((p) => !TAGS_PROPERTY_KEYS.includes(String(p[0])))) continue;
        records.push({
          runId,
          address: r.address,
          rid: snap.rid == null ? null : String(snap.rid),
          fromPubkey: typeof snap.fromPubkey === 'string' ? snap.fromPubkey : canonicalValue(snap.fromPubkey),
          toPubkey: typeof snap.toPubkey === 'string' ? snap.toPubkey : canonicalValue(snap.toPubkey),
          props: props.map((p) => [p[0], p[1], SCALAR_TYPES.includes(p[1]) ? p[2] : canonicalValue(p[3])]),
        });
      }
      if (records.length === 0) return;
      let file;
      try {
        file = await deps.state.appendPreimages(runId, records);
      } catch (err) {
        err.taggingEdgesPreimage = true;
        throw err;
      }
      rel.preimagesWritten += records.length;
      rel.preimageFile = file || `preimages/${runId}.jsonl`;
    };
    const noteStripped = (items, appliedAddresses) => {
      const applied = new Set(appliedAddresses || []);
      for (const it of items) {
        if (rel.strippedKeys.length >= STRIPPED_KEYS_CAP) break;
        if (applied.has(it.address) && Array.isArray(it.strippedKeys) && it.strippedKeys.length > 0) {
          rel.strippedKeys.push({ address: it.address, keys: it.strippedKeys.slice() });
        }
      }
    };
    const writeFailure = (err) => {
      if (err && err.taggingEdgesPreimage) return fsFailure('write', err, `preimages/${runId}.jsonl`);
      const f = { stage: 'write', code: (err && err.code) || 'error', message: safeMessage(err) };
      if (err && err.read === 'graph-verify') f.read = err.read;
      return f;
    };
    /** Count what one apply committed (its answer, or a rejection's `partial`) — those rows only (C5). */
    const account = (kind, slice, out) => {
      const appliedSet = new Set((out && out.appliedAddresses) || []);
      const appliedItems = slice.filter((it) => appliedSet.has(it.address));
      const lost = (out && out.lostRace) || 0;
      if (kind === 'create') {
        rel.added += appliedItems.length;
        rel.lostRace.create += lost;
        latest.peopleAdded += (out && out.nodesCreated) || 0;
        unresolvedApplied += appliedItems.filter((c) => c.unresolved).length;
      } else if (kind === 'update' || kind === 'move') {
        rel.changed += appliedItems.length;
        for (const it of appliedItems) rel.changedBy[it.label] = (rel.changedBy[it.label] || 0) + 1;
        rel.lostRace[kind] += lost;
        if (kind === 'move') latest.peopleAdded += (out && out.nodesCreated) || 0;
        unresolvedApplied += appliedItems.filter((c) => c.unresolved).length;
        noteStripped(slice, out && out.appliedAddresses);
      } else {
        rel.removed += appliedItems.length;
        for (const it of appliedItems) {
          rel.removedBy[it.reason] = (rel.removedBy[it.reason] || 0) + 1;
          if (confirmedKeys && confirmedKeys.has(removalKey(it.address, it.seenEventId))) latest.confirmed.removalsApplied += 1;
        }
        rel.lostRace.remove += lost;
        noteStripped(slice, out && out.appliedAddresses);
      }
      rel.unresolved = plan.counts.unresolvedUntouched + plan.counts.unresolvedHeld + unresolvedApplied;
      return { applied: appliedItems.length, lost };
    };

    const writePhases = [
      ['write-creates', 'create', plan.creates],
      ['write-updates', 'update', plan.updates],
      ['write-moves', 'move', plan.moves],
      ['write-removals', 'remove', plan.removals],
    ];
    for (const [phaseName, kind, items] of writePhases) {
      let batches = 0;
      let retries = 0;
      let phaseApplied = 0;
      let phaseLost = 0;
      for (let i = 0; i < items.length; i += MAX_BATCH) {
        if (stopRequested) return await stopNow();
        const slice = items.slice(i, i + MAX_BATCH);
        let out;
        try {
          // The port's rows (clarification C6); the port computes the fingerprint and the written props itself.
          if (kind === 'create') {
            out = await graph.applyCreates(slice.map((c) => ({ address: c.address, desired: c.desired })), { timeoutMs: WRITE_TIMEOUT_MS });
          } else {
            const rowsForWrite = slice.map((it) => (it.desired
              ? { address: it.address, snapshot: it.snapshot, desired: it.desired }
              : { address: it.address, snapshot: it.snapshot }));
            out = await graph.applyLocked(kind, rowsForWrite, { timeoutMs: WRITE_TIMEOUT_MS, preimage });
          }
        } catch (err) {
          if (err && err.partial) account(kind, slice, err.partial);
          return await fail('write', writeFailure(err), 'a write failed; every committed batch stands at one version of each tagging');
        }
        batches += 1;
        retries += (out && out.transientRetries) || 0;
        const done = account(kind, slice, out);
        phaseApplied += done.applied;
        phaseLost += done.lost;
        batchesSinceSave += 1;
        if (batchesSinceSave >= SAVE_EVERY_BATCHES) { batchesSinceSave = 0; saveQuietly(); }
      }
      phase(phaseName, { batches, transientRetries: retries, counts: { applied: phaseApplied, lostRace: phaseLost } });
    }
    rel.unresolved = plan.counts.unresolvedUntouched + plan.counts.unresolvedHeld + unresolvedApplied;

    // 12. The held file, then the final report.
    let digest = null;
    if (plan.held.length > 0) {
      try {
        digest = await deps.state.heldDigest(plan.held);
        await deps.state.writeHeld(runId, plan.held);
      } catch (err) {
        return await fail('report', fsFailure('report', err, `held/${runId}.json`), 'the held list could not be written');
      }
    }
    latest.held = { total: plan.held.length, byReason: { ...plan.counts.heldByReason }, digest };
    if (plan.held.length > 0) {
      return await finish('done-removals-held', {
        reasonCode: 'removals-held',
        reason: `removals held: ${plan.held.length} over the limit (more than ${plan.limit.floor} and more than ${plan.limit.fraction} of ${plan.limit.baseAfterConfirmed == null ? plan.limit.base : plan.limit.baseAfterConfirmed}); the owner can confirm them`,
        failure: null,
      });
    }
    // Lost races and conflicting addresses are left to the next pass (ADR "The guard"); say so rather than "agrees".
    const lostRaces = Object.values(rel.lostRace).reduce((a, b) => a + b, 0);
    const skipped = latest.anomalies.sameAddressConflicts + latest.anomalies.snapshotConflicts;
    const reason = lostRaces + skipped === 0
      ? 'the graph agrees with the relay'
      : `finished; ${lostRaces} lost race(s) and ${skipped} conflicting address(es) are left to the next pass`;
    return await finish('done', { reasonCode: 'done', reason, failure: null });
  } catch (err) {
    return fail('error', { stage: 'unexpected', code: (err && err.code) || 'error', message: safeMessage(err) }, 'an unexpected error ended the pass');
  }
}

module.exports = { run, defaultDeps, resolveIdentities, validateClaim, makeRunId, exitCodeFor, TASK_NAME, STOPPED_REASON };

if (require.main === module) {
  run({ proc: process }).catch((err) => {
    console.error(`[reconcileTaggingEdges] ${safeMessage(err)}`);
    process.exitCode = 1;
  });
}
