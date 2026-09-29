'use strict';
/**
 * Tests for Story 3 (epic tagging-edges) — the real-time path's ENGINE, driven through its seam with every dependency
 * faked.
 *
 * Story: engineering-team/stories/tagging-edges/3-real-time-path.md (AC-1 … AC-7, confirmed items 6–15, "For Test Design")
 * ADR:   engineering-team/decisions/tagging-edges/0003-real-time-path.md — § Decision (What it hears, Where it runs,
 *        Knowing what changed while it was away, What it decides and writes, Failure handling, Coexisting with the pass,
 *        Status and switch, Throughput and ceilings) and § Clarifications (Test Design) T15, T16, T19, T20, T21, and
 *        the settled T25 (a round completes every address it decided; the upper-case kind-5 corner), T26 (the store),
 *        T29 (engine details: callbacks, no sleeping in tick(), status.json's fields, SIGTERM within 5 s, row order,
 *        parking, the "no row succeeds" rule) and T30 (readKeys rows). Binding context: ADR tagging-edges/0002 (the
 *        graph port, C6's rows, the report) and 0001 (the contract, via test/helpers/taggingEdgesFixtures.js).
 * Fakes: test/helpers/taggingEdgesRealtimeFakes.js — a relay with strfry 1.1.0's storage and deletion rules, live delivery
 *        and scanStrict's scan contract; graph.js's port over an in-memory graph (create-if-absent, fingerprint-verified
 *        locked writes); T21's store in memory; T20's state; a fake clock; drive().
 *
 * Intentionally failing until src/pipeline/tagging-edges/realtime/index.js lands (red phase). The engine is require()d
 * LAZILY, through load() inside each test (the fakes call it when a process is spawned), so the suite always loads and
 * every test fails with "… not implemented yet" until then.
 *
 * The seam (T20): createEngine(deps) → { start(), tick(), handleSignal(name), status() }. A test spawns a process
 * (deps + createEngine), awaits start(), then drive()s it: advance the fake clock by a step, await tick(), let the
 * callbacks already scheduled run, repeat. Assertions state only the bounds the criteria state, in simulated time —
 * "within 60 s", "within 5 minutes", "off within 5 s" — never how many ticks or rounds it took. status() is the object
 * last written to status.json. A restart is a new process over the same store, relay and graph; a crash is a process
 * killed without a signal (its deps never answer again).
 *
 * Stack-free: no Neo4j, no strfry, no network, no filesystem (T21's store is in memory), no signing. Every pubkey is a
 * fake 64-hex value from the fixtures — never a deployment's TA and never the ADR 0015 literal. Node 16 and 22.
 *
 * Harness rules (run()): process.exit is trapped during each test (T20: the engine never calls it); an unhandled
 * rejection or a subscription callback that throws during a test fails that test; every process a test spawned is
 * killed when it ends; deps.sleep called inside start() or tick() rejects (T29), so that fails the test at once.
 *
 * RE62–RE79 (and RE29's odd-moment fix) come from a mutation pass over a blind reference implementation: each pins a
 * rule of the ADR that a mutant broke while every earlier test still passed — the 30 s catch-up spacing, the backlog
 * cap's lanes and catch-up, the kept budget's element read and catch-up share, re-looks and dead passes (T17, T19),
 * the 2 s stop grace, the journal flushes, parking's "same code", lost races and seen / heard. RE71 is the one test
 * that makes simulated time pass inside a round (the fakes' opt-in latencyMs).
 *
 * Amendment A1 (ADR 0003 § Amendment A1, owner-accepted 2026-09-29 with decision 11; A1-20 "The engine suite") re-aims
 * RE7 (A1-8: the census is a first start's only graph contact before started.json, and its own 10 s deadline, through
 * the fakes' graph.readDelay), RE8 (A1-10: the first start's own catch-up brings a relationship the backfill left
 * behind up to the relay's version), RE38 (A1-18: the final status's subscription is not connected), RE54 and RE67 (A1-14:
 * the catch-up share's scans run under what is left of its fifth), RE58 (A1-6: its hand-written journal line takes the
 * absolute v shape) and RE79 (A1-1: heard counts addresses), and retitles RE18 and RE19 (A1-3, A1-4, A1-5: H and
 * discardSupersededRevokes are gone). A1-20's new scenarios live in their own suites, not here. RE80 comes from the
 * validating Tester's mutation pass over the A1 reference: A1-14 bounds the share's element reads as well as its
 * address scans, which RE67's by-address arrivals never exercise.
 *
 * RE81 comes from story 3's review, round 1 (2026-09-29), conform item 1(e): the path passes its own time-out to
 * readSchema, so graph.js's readSchema keeps no default for the pass (the wiring suite's SWR72 pins the port's side).
 * It is red until the Implementer's round-1 fix. The fakes' readSchema logs the timeoutMs it is given for it.
 *
 * Bounded memory (RE58) runs this same file in a CHILD Node process with --max-old-space-size=160
 * (`node test/tagging-edges-realtime-engine.test.js --re58-child <scenario>`), over lean fakes; it prints one
 * `RE58-RESULT {json}` line. The test is counted skipped, with a note, only when a node process cannot be spawned.
 *
 * Hand-rolled in the project's existing test style (test/tagging-edges-runner.test.js) — no new framework.
 */

const path = require('path');
const childProcess = require('child_process');
const F = require('./helpers/taggingEdgesFixtures');
const H = require('./helpers/taggingEdgesRealtimeFakes');

const REPO = path.resolve(__dirname, '..');
const ENGINE_REL = 'src/pipeline/tagging-edges/realtime/index.js';
const ENGINE = path.join(REPO, ENGINE_REL);

const { ALICE, BOB, CAROL, JACK, CANONICAL, LOCAL, OTHER_DEPLOY, STAMP, idOf, pubkeyOf } = F;
const { NOW_S, DAY_S, drive } = H;

const SEC = 1000;
const MIN = 60 * SEC;
/** A 64-hex value with upper-case letters. */
const UPPER_HEX = 'ABCDEF01'.repeat(8);
const PASS_RUN = '20260928T120500Z-aaaa0001';
const PASS_RUN_2 = '20260928T121000Z-bbbb0002';
const MiB = 1024 * 1024;
/** Content padding that makes a tagging about 130 KB of JSON (shared by every fixture that uses it). */
const PAD_130K = 'x'.repeat(130 * 1024);

// ─── test harness ──────────────────────────────────────────────────────────────────────────────────────────────
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
/** Count this test skipped, with a note (only for an environment that cannot run it at all). */
function skip(note) { throw Object.assign(new Error(note), { skip: true }); }
const show = (v) => {
  try {
    return JSON.stringify(v, (k, x) => {
      if (typeof x === 'bigint') return `${x}n`;
      if (x instanceof Map) return { '<Map>': [...x.entries()] };
      if (x instanceof Set) return { '<Set>': [...x] };
      return x;
    });
  } catch (_) { return String(v); }
};
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
function same(actual, expected, label) {
  const a = show(sortKeys(actual));
  const e = show(sortKeys(expected));
  if (a !== e) throw new Error(`${label}\n        expected: ${e}\n        actual:   ${a}`);
}
const preview = (xs) => (xs.length > 6 ? `${show(xs.slice(0, 6))} … (+${xs.length - 6} more)` : show(xs));
function sameSet(actual, expected, label) {
  const a = [...(actual || [])].sort();
  const e = [...expected].sort();
  if (show(a) !== show(e)) throw new Error(`${label}\n        expected (${e.length}): ${preview(e)}\n        actual   (${a.length}): ${preview(a)}`);
}
const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => isPlainObject(o) && Object.prototype.hasOwnProperty.call(o, k);

/** Run several cases; report every failing one, not only the first. */
async function cases(list, fn) {
  const failed = [];
  for (const c of list) {
    try { await fn(c); } catch (e) { failed.push(`[${c.name}] ${e.message}`); }
    await H.killAll();
  }
  assert(failed.length === 0, `${failed.length} of ${list.length} case(s) failed:\n        ${failed.join('\n        ')}`);
}

/** Lazily load the engine with a descriptive red-phase message. */
function load() {
  try { return require(ENGINE); }
  catch (e) { throw new Error(`${ENGINE_REL} not implemented yet (require failed: ${firstLine(e)})`); }
}

// ─── fixtures ──────────────────────────────────────────────────────────────────────────────────────────────────
const firstD = (ev) => { const t = ev.tags.find((x) => Array.isArray(x) && x[0] === 'd'); return t ? t[1] : null; };
/** A fixture tagging's address (every fixture here has a short, plain first d). */
const addr = (ev) => `39999:${ev.pubkey}:${firstD(ev)}`;

/** A tagging at its own address `39999:<author>:re-<name>` (Alice tags Bob by default, canonical stamp, a day old). */
function tg(name, o = {}) {
  return F.makeTagging(Object.assign({ d: `re-${name}`, id: idOf(`re:${name}`), createdAt: NOW_S - 1000 }, o));
}
/** The fields of a fixture tagging, so a new version keeps them unless told otherwise. */
function fieldsOf(ev) {
  const val = (n) => { const t = ev.tags.find((x) => Array.isArray(x) && x[0] === n); return t ? t[1] : null; };
  return {
    author: ev.pubkey, d: val('d'), target: val('p'), a: val('a'), e: val('e'), polarity: val('polarity'),
    stamps: ev.tags.filter((t) => Array.isArray(t) && t[0] === 'z').map((t) => t[1]), createdAt: ev.created_at,
  };
}
/** A newer version at the same address (created_at + 10 unless given). */
function version(ev, name, o = {}) {
  return F.makeTagging(Object.assign(fieldsOf(ev), { id: idOf(`re:${name}`), createdAt: ev.created_at + 10 }, o));
}
/** A kind-5 deletion (Alice's unless `author` is given), created now. */
function del(name, o = {}) {
  return F.makeDeletion(Object.assign({ id: idOf(`re:del:${name}`), createdAt: NOW_S }, o));
}
function note(name, author = ALICE) {
  return { id: idOf(`re:note:${name}`), pubkey: author, created_at: NOW_S - 50, kind: 1, tags: [], content: 'a note', sig: H.SIG };
}

/** The contract edge for an event, resolving an id-only tag from `elements` (story 1's contract). */
function expectEdge(ev, elements = []) {
  return F.contractEdge(ev, Object.assign({}, F.IDENTITIES, { tagElementsById: new Map(elements.map((e) => [e.id, e])) }));
}
const EDGE_FIELDS = F.EDGE_KEYS.filter((k) => k !== 'type');
function edgeText(e) {
  if (!e) return 'none';
  return show(EDGE_FIELDS.map((k) => {
    const v = e[k] === undefined ? null : e[k];
    return typeof v === 'bigint' ? Number(v) : v;
  }));
}
/** The graph holds, at the event's address, exactly the relationship the contract gives for it. */
function reflects(w, ev, elements) {
  const got = w.graph.edgeAt(addr(ev));
  return !!got && edgeText(got) === edgeText(expectEdge(ev, elements));
}
const absent = (w, address) => !w.graph.rows.has(address);
/** A cheap check for bulk scenarios: the graph's relationship at the event's address records the event's id. */
function holdsId(w, ev) {
  const row = w.graph.rows.get(addr(ev));
  const p = row ? H.propOf(row, 'eventId') : null;
  return !!p && p.text === ev.id;
}
/** A tagging padded to about 130 KB of JSON (strfry's websocket-size events). */
const padded = (ev) => Object.assign(ev, { content: PAD_130K });
/** The graph reads (readAt) that named an address — every round begins with one (ADR § What it decides, step 1). */
function roundsReading(w, address, procN) {
  return w.graph.calls.filter((x) => x.op === 'readAt' && (procN === undefined || x.proc === procN)
    && Array.isArray(x.addresses) && x.addresses.includes(address));
}
/** Did the write for this address commit before the graph read that followed the first read naming it (its round)? */
function landedInFirstRound(w, address) {
  const first = roundsReading(w, address)[0];
  if (!first) return false;
  const next = w.graph.calls.find((x) => x.op === 'readAt' && x.seq > first.seq);
  const limit = next ? next.seq : Infinity;
  return w.graph.writes.some((x) => x.result && x.commitSeq > first.seq && x.commitSeq < limit
    && Array.isArray(x.result.appliedAddresses) && x.result.appliedAddresses.includes(address));
}
/** The graph port calls of one op made after `mark` (a w.nextSeq() value). */
function callsAfter(w, op, mark) { return w.graph.calls.filter((x) => x.op === op && x.seq > mark); }
/** The write calls (applyCreates / applyLocked) that carried a row for this address, made after `mark`. */
function writesAfter(w, address, mark) { return w.graph.writes.filter((x) => x.seq > mark && x.addresses.includes(address)); }
/** journal.jsonl as written so far, one object per line (a line that does not parse is left out). */
function journalLines(w) {
  const out = [];
  for (const line of String(w.store.journal).split('\n')) {
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch (_) { /* not a fact */ }
  }
  return out;
}
/**
 * The deadSeenAt a restart would restore for a run (T19): record.json's `deadSeenAt` when the last compaction wrote one
 * for it, else the journal's first `k` line for it; undefined when neither records it.
 */
function deadSeenPersisted(w, runId) {
  const rec = w.store.record && w.store.record.deadSeenAt;
  if (rec && typeof rec[runId] === 'number') return rec[runId];
  const k = journalLines(w).find((o) => o.t === 'k' && o.runId === runId);
  return k ? k.at : undefined;
}

// ─── scenario helpers ──────────────────────────────────────────────────────────────────────────────────────────
function newWorld(o = {}) { return H.makeWorld(Object.assign({ loadEngine: load }, o)); }
function put(w, ...evs) { putAll(w, evs); }
function putAll(w, evs) {
  for (const ev of evs) {
    const r = w.relay.store(ev);
    assert(r.stored, `fixture: the fake relay refused ${ev.kind === 5 ? 'a kind-5' : `a kind-${ev.kind}`} ${String(ev.id).slice(0, 8)}… (${r.reason})`);
  }
}
/** The owner-started backfill wrote these (the relationship each tagging gives). */
function backfill(w, ...evs) { for (const ev of evs) w.graph.putEdge(F.contractEdge(ev)); }

/**
 * The status as last WRITTEN to status.json (T21 writeStatus, JSON round-tripped) — what the route serves (AC-6). Read
 * from the store, not from status(), so a live in-memory object can never stand in for what was written; RE43 checks
 * that status() answers the same (T20).
 */
function statusOf(proc) {
  const s = proc.world.store.status;
  return isPlainObject(s) ? s : null;
}
/** A dotted path into the status, or undefined. */
function at(obj, dotted) {
  let v = obj;
  for (const k of dotted.split('.')) { if (!v || typeof v !== 'object') return undefined; v = v[k]; }
  return v;
}
function num(obj, dotted) { const v = at(obj, dotted); return typeof v === 'number' ? v : undefined; }

function diag(proc) {
  const w = proc.world;
  const st = statusOf(proc);
  const writes = w.graph.writes;
  const committed = writes.filter((x) => x.result).length;
  const rejected = writes.filter((x) => x.error).length;
  const lastWrites = writes.slice(-4).map((x) => `${x.kind}×${x.n}${x.error ? `(${x.error})` : ''}`).join(', ');
  const lastScans = w.relay.scans.slice(-4).map((s) => `${s.kind}:${s.outcome}`).join(', ');
  return [
    `status: state ${show(st && st.state)}, setupProblem ${show(st && st.setupProblem)}, lastError ${show(st && st.lastError)}, catchUp.last ${show(at(st, 'catchUp.last'))}`,
    `graph: ${w.graph.rows.size} TAGS at tagging addresses; ${writes.length} write call(s), ${committed} committed, ${rejected} rejected${lastWrites ? ` (last: ${lastWrites})` : ''}`,
    `relay: ${w.relay.subCalls.length} subscribe call(s), ${w.relay.openSubs().length} open; ${w.relay.scans.length} scan(s)${lastScans ? ` (last: ${lastScans})` : ''}`,
  ].join('\n        ');
}

/** Drive until `pred` holds; fail naming `what` and the bound if it does not within `ms` of simulated time. */
async function within(proc, ms, pred, what, step = 100) {
  const r = await drive(proc, ms, { step, until: pred });
  if (!r.done) {
    const ex = r.exit !== undefined ? ` (tick() answered exit ${r.exit} after ${r.elapsed} ms)` : '';
    throw new Error(`${what}: not within ${ms / 1000} s of simulated time${ex}\n        ${diag(proc)}`);
  }
  return r.elapsed;
}
/** Drive until `pending()` (a list of what is still missing) is empty; a failure names what is still pending. */
async function withinAll(proc, ms, pending, what, step = 100) {
  const r = await drive(proc, ms, { step, until: () => pending().length === 0 });
  if (!r.done) {
    const ex = r.exit !== undefined ? ` (tick() answered exit ${r.exit} after ${r.elapsed} ms)` : '';
    throw new Error(`${what}: not within ${ms / 1000} s of simulated time${ex}; still pending: ${preview(pending())}\n        ${diag(proc)}`);
  }
  return r.elapsed;
}
/** Drive the whole of `ms` (a claim that something does NOT happen); `each` runs after every tick. The path must not exit. */
async function hold(proc, ms, what, step = 500, each) {
  const r = await drive(proc, ms, { step, each });
  if (r.exit !== undefined) {
    throw new Error(`${what}: tick() answered exit ${r.exit} after ${r.elapsed} ms of simulated time; the path exits only for the switch or a signal (ADR 0003 § Where it runs)\n        ${diag(proc)}`);
  }
}
/** A process that has taken its first start (baseline written) and settled for a second. */
async function boot(w, so = {}) {
  const proc = w.spawn(so);
  await H.startEngine(proc);
  await within(proc, 30 * SEC, () => !!w.store.started, 'the first start takes its baseline and writes started.json (ADR 0003 § First start)', 50);
  await drive(proc, SEC, 50);
  return proc;
}
/** A later start over the same store (not a first start). */
async function restart(w, so = {}) {
  const proc = w.spawn(so);
  await H.startEngine(proc);
  return proc;
}
/** Stop a process: 'signal' (a deploy: SIGTERM), 'switch' (the owner turns it off), or 'crash' (killed, no cleanup). */
async function stop(w, proc, how) {
  if (how === 'crash') { proc.kill(); return; }
  if (how === 'signal') {
    await H.guarded(() => proc.engine.handleSignal('SIGTERM'), "handleSignal('SIGTERM')");
    const r = await drive(proc, 5 * SEC, 50);
    eq(r.exit, 0, `after handleSignal('SIGTERM'), tick() answers { exit: 0 } within 5 s (T29; inside supervisord's stopwaitsecs of 10 s, ADR § Where it runs)\n        ${diag(proc)}`);
  } else {
    w.store.setSwitch(false);
    const r = await drive(proc, 5 * SEC, 50);
    eq(r.exit, 0, `after the owner turns the switch off, tick() answers { exit: 0 } within 5 s (AC-5; ADR "Off means off within 5 s")\n        ${diag(proc)}`);
  }
  proc.kill();
}

// ─── write-call checks (AC-7) ──────────────────────────────────────────────────────────────────────────────────
function rowEnds(row, which) {
  if (which === 'desired') return row && row.desired ? [row.desired.from, row.desired.to] : null;
  const s = row && (row.snapshot || row.row);
  return s ? [s.fromPubkey, s.toPubkey] : null;
}
function sortedBy(rows, which) {
  const ends = rows.map((r) => rowEnds(r, which));
  if (ends.some((e) => !e)) return false;
  for (let i = 1; i < ends.length; i++) {
    const [a, b] = [ends[i - 1], ends[i]];
    if (a[0] > b[0] || (a[0] === b[0] && String(a[1]) > String(b[1]))) return false;
  }
  return true;
}
/** Sorted by (from, to) (T29): creates, updates and moves by the desired edge's ends; removals by the snapshot's. */
function sortedByEnds(kind, rows) {
  return sortedBy(rows, kind === 'remove' ? 'snapshot' : 'desired');
}

/* ═════════════════════════════════════ the seam, run(), the switch at start ═════════════════════════════════════ */

test('RE1: the engine module exports createEngine, run and defaultDeps, and createEngine(deps) returns start, tick, handleSignal and status (ADR 0003 T20)', async () => {
  const m = load();
  for (const fn of ['createEngine', 'run', 'defaultDeps']) {
    assert(typeof m[fn] === 'function', `${ENGINE_REL} must export ${fn}() (T20); it exports ${show(Object.keys(m))}`);
  }
  const w = newWorld();
  const proc = w.spawn();
  for (const fn of ['start', 'tick', 'handleSignal', 'status']) {
    assert(proc.engine && typeof proc.engine[fn] === 'function', `createEngine(deps) must return ${fn}() (T20); it returned ${show(Object.keys(proc.engine || {}))}`);
  }
});

test('RE2: run(deps) with the switch off leaves exit code 0 on deps.proc.exitCode, waits only through deps.sleep in steps of at most 250 ms, never calls process.exit, and subscribes, scans and touches the graph not at all (AC-5 "ships turned off"; T20)', async () => {
  const m = load();
  const w = newWorld();
  w.store.switch = null; // switch.json missing: the shipped state
  put(w, tg('re2-p'));
  const proc = w.makeDeps({ sleepAdvances: true });
  const t0 = w.clock.t;
  await H.guarded(() => m.run(proc.deps), 'run(deps)');
  eq(proc.deps.proc.exitCode, 0, 'run(deps) leaves the exit code on deps.proc.exitCode (T20): 0 for the switch');
  assert(w.clock.t - t0 <= 5 * SEC, `run(deps) should end within 5 s of simulated time with the switch off; it took ${w.clock.t - t0} ms`);
  const long = w.sleeps.filter((s) => s.ms > 250);
  assert(long.length === 0, `run(deps) sleeps through deps.sleep(ms) with ms ≤ 250 (T20); it asked for ${preview(long.map((s) => s.ms))}`);
  eq(w.relay.subCalls.length, 0, 'subscribe calls with the switch off');
  eq(w.relay.scans.length, 0, 'relay scans with the switch off');
  eq(w.graph.calls.length, 0, 'graph port calls with the switch off');
});

test('RE3: run(deps) with the switch on runs the path; when the owner turns it off at about 10.5 s, run resolves with deps.proc.exitCode 0 within 5 s of the off (AC-5 "off means off"; ADR "Off means off within 5 s"; T20)', async () => {
  const m = load();
  const w = newWorld();
  let offAt = null;
  const proc = w.makeDeps({
    sleepAdvances: true,
    onSleep: () => { if (offAt === null && w.clock.t >= H.T0 + 10500) { w.store.setSwitch(false); offAt = w.clock.t; } },
  });
  await H.guarded(() => m.run(proc.deps), 'run(deps)');
  assert(offAt !== null, `run(deps) ended before the switch was turned off (at ${w.clock.t - H.T0} ms), with exit code ${show(proc.deps.proc.exitCode)}; with the switch on it runs until off or a signal\n        subscribe calls: ${w.relay.subCalls.length}`);
  eq(proc.deps.proc.exitCode, 0, 'deps.proc.exitCode after the switch is turned off (T20)');
  assert(w.clock.t - offAt <= 5 * SEC + 250, `run(deps) should end within 5 s of the switch going off (AC-5); it ended ${w.clock.t - offAt} ms after`);
  assert(w.relay.subCalls.length >= 1, 'with the switch on, run(deps) subscribes to the relay');
});

test('RE4: with the switch missing, unreadable or off at start, tick() answers { exit: 0 } within 5 s and nothing happens — no subscription, no relay scan, no graph call, no started.json or record.json (AC-5 "ships turned off"; ADR § Status and switch "a missing or unreadable switch.json reads as off"; T20)', async () => {
  await cases([
    { name: 'switch.json missing (the shipped state)', sw: null },
    { name: 'switch.json unreadable', sw: { unreadable: true } },
    { name: 'switch.json says off', sw: { on: false, changedAt: H.iso(H.T0 - MIN), changedBy: 'b0b0b0b0' } },
  ], async (c) => {
    const w = newWorld();
    w.store.switch = c.sw;
    put(w, tg('re4-p'));
    const proc = w.spawn();
    await H.startEngine(proc);
    const r = await drive(proc, 5 * SEC, 50);
    eq(r.exit, 0, `tick() should answer { exit: 0 } within 5 s\n        ${diag(proc)}`);
    eq(w.relay.subCalls.length, 0, 'subscribe calls');
    eq(w.relay.scans.length, 0, 'relay scans');
    eq(w.graph.calls.length, 0, 'graph port calls');
    eq(w.store.started, null, 'started.json (no first start while off)');
    eq(w.store.record, null, 'record.json (no baseline while off)');
  });
});

test('RE60: start() and tick() never call deps.sleep — through a first start, a burst, a graph outage, failing relay reads and idle minutes, every wait belongs to run() (T29 "No sleeping in tick()": run() owns every sleep; T20)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  let n = 0;
  const trickle = (name) => () => { n += 1; if (n % 6 === 0) put(w, tg(`re60-${name}${n}`, { createdAt: NOW_S + n })); };
  put(w, tg('re60-a', { createdAt: NOW_S }));
  await drive(proc, 5 * SEC, 100);
  w.graph.down = true;
  await drive(proc, MIN, { step: 250, each: trickle('g') });
  w.graph.down = false;
  w.relay.scanFail = () => 'timeout';
  await drive(proc, MIN, { step: 250, each: trickle('r') });
  w.relay.scanFail = null;
  await hold(proc, 2 * MIN, 'idle', 1000);
  const calls = w.sleeps.filter((x) => x.proc === proc.n);
  eq(calls.length, 0, `deps.sleep calls made by start() or tick() (only run() sleeps): ${show(calls.slice(0, 3))}`);
});

/* ════════════════════════════════════════════════ the first start ══════════════════════════════════════════════ */

test('RE5: a first start subscribes once to the relay the environment names, with exactly the two filters (both nostr-user-tag stamps, and kind 5), limit 0 and no since; takes its baseline (record.json, started.json, firstStartedAt); and creates nothing for the taggings the relay already held, over 3 minutes (AC-4 "never backfills"; ADR D1, § First start; T4, T20)', async () => {
  const w = newWorld();
  const P1 = tg('re5-p1');
  const P2 = tg('re5-p2', { target: CAROL, stamps: [STAMP(LOCAL)] });
  const P3 = tg('re5-p3', { author: CAROL });
  const Q = tg('re5-q');
  put(w, P1, P2, P3, Q);
  backfill(w, Q); // one the backfill already wrote
  const proc = await boot(w);
  eq(w.relay.subCalls.length, 1, `subscribe calls at the first start\n        ${diag(proc)}`);
  const sub = w.relay.subCalls[0];
  eq(sub.url, H.RELAY_URL, 'the subscription URL (TAGGING_EDGES_REALTIME_RELAY_URL overrides the address; ADR § What it hears)');
  const fs = sub.filters;
  eq(fs.length, 2, `one REQ with two filters (T4); got ${show(fs)}`);
  const tagging = fs.find((f) => isPlainObject(f) && show(f.kinds) === '[39999]');
  const dels = fs.find((f) => isPlainObject(f) && show(f.kinds) === '[5]');
  assert(tagging, `a filter { kinds: [39999], '#z': [both nostr-user-tag stamps], limit: 0 } (T4); got ${show(fs)}`);
  assert(dels, `a filter { kinds: [5], limit: 0 } (T4); got ${show(fs)}`);
  sameSet(tagging['#z'], [STAMP(CANONICAL), STAMP(LOCAL)], "the taggings filter's #z (T4)");
  eq(tagging.limit, 0, "the taggings filter's limit (EOSE at once, then live)");
  eq(dels.limit, 0, "the deletions filter's limit");
  for (const [what, f] of [['taggings', tagging], ['deletions', dels]]) {
    assert(!has(f, 'since') && !has(f, 'until'), `the ${what} filter must carry no since/until (a since drops back-dated history; ADR D3-C); got ${show(f)}`);
    const extra = Object.keys(f).filter((k) => !['kinds', '#z', 'limit'].includes(k));
    assert(extra.length === 0, `the ${what} filter carries only what T4 gives; extra keys ${show(extra)}`);
  }
  assert(w.store.record && w.store.record.version === 1, `record.json is written at the first start with version 1 (ADR § Knowing what changed); got ${show(w.store.record && Object.keys(w.store.record))}`);
  const st = statusOf(proc);
  assert(st && st.firstStartedAt, `the status carries firstStartedAt after the first start (ADR § Status); got ${show(st && st.firstStartedAt)}`);
  await hold(proc, 3 * MIN, 'three minutes after the first start', 1000);
  const creates = w.graph.writes.filter((x) => x.kind === 'create');
  assert(creates.length === 0, `no start creates a relationship for a version the relay held before it (AC-4, story item 8); create calls: ${show(creates.map((x) => x.addresses))}`);
  for (const ev of [P1, P2, P3]) assert(absent(w, addr(ev)), `the pre-existing ${addr(ev)} was created`);
  assert(reflects(w, Q), 'the relationship the backfill wrote stays as it was');
});

test('RE6: a tagging stored after the subscription opened — before the baseline scan, or while it runs — is live-delivered and created within 60 s; the pre-existing one is not (AC-4 "acts on what the relay stores from then on"; ADR § First start steps 2–3)', async () => {
  await cases([
    { name: 'stored during the baseline scan (in the scan and delivered live)', hook: 'scan' },
    { name: 'stored after the REQ, before the scan', hook: 'subscribe' },
  ], async (c) => {
    const w = newWorld();
    const P = tg('re6-p');
    put(w, P);
    const X = tg('re6-x', { createdAt: NOW_S });
    let fired = false;
    if (c.hook === 'scan') {
      w.relay.onScan = (filter) => { if (!fired && H.scanTouches(filter, 'stamp')) { fired = true; put(w, X); } };
    } else {
      w.relay.onSubscribe = () => { if (!fired) { fired = true; put(w, X); } };
    }
    const proc = w.spawn();
    await H.startEngine(proc);
    await within(proc, 30 * SEC, () => !!w.store.started, 'the first start writes started.json', 50);
    assert(fired, `fixture: the ${c.hook} hook never fired (no ${c.hook === 'scan' ? 'stamp scan' : 'subscription'} at the first start)\n        ${diag(proc)}`);
    await within(proc, MIN, () => reflects(w, X), 'the tagging stored after the REQ is created within 60 s (a live delivery is never baseline)');
    await hold(proc, MIN, 'a minute later', 1000);
    assert(absent(w, addr(P)), `the pre-existing ${addr(P)} must not be created (AC-4)`);
  });
});

test('RE7: a first start\'s only graph contact before started.json is the census — one key read, with no retry and no schema check, before the REQ — and the census holds the REQ at most 10 s: with the graph unavailable, with that key read never answering (the engine\'s own deadline) or answering only after 15 s (a late answer is ignored: still one REQ), the baseline and started.json follow, and a tagging stored after the start is created within 60 s (A1-8 "one readKeys call, with no retry", "a 10 s deadline the engine enforces itself: a late answer is ignored", "A census that fails or is late records nothing, and the start proceeds"; A1-10 step 1; A1-17 T20, T29; AC-4)', async () => {
  await cases([
    { name: 'the graph unavailable (every port call fails at once)', down: true },
    { name: 'the census\'s key read never answers (a hung connection)', delay: Infinity },
    { name: 'the census\'s key read answers after 15 s (late)', delay: 15 * SEC },
  ], async (c) => {
    const w = newWorld();
    if (c.down) w.graph.down = true;
    // nth 1 of readKeys in this process is the census (the fakes' readDelay: A1-8's hung or late census).
    if (c.delay) w.graph.readDelay = (op, { nth }) => (op === 'readKeys' && nth === 1 ? c.delay : null);
    put(w, tg('re7-p'));
    const proc = w.spawn();
    await H.startEngine(proc);
    await within(proc, 30 * SEC, () => !!w.store.started, 'the first start writes started.json (A1-8: the start proceeds)', 50);
    const early = w.graph.calls.filter((x) => x.seq < w.store.startedSeq);
    same(early.map((x) => x.op), ['readKeys'], 'graph port calls before started.json: only the census\'s one key read, with no retry and no schema check (A1-8; A1-10 step 1)');
    const census = early[0];
    const sub = w.relay.subCalls[0];
    assert(sub && census.seq < sub.seq, `the census comes before the REQ (A1-8: "reads the graph's keys once, before its REQ"); census at seq ${census.seq}, REQ ${sub ? `at seq ${sub.seq}` : 'never made'}`);
    assert(sub.at - census.at <= 10 * SEC + 500, `the census holds the REQ at most 10 s (A1-8: "a 10 s deadline the engine enforces itself"; 0.5 s allowed for the tick); the REQ came ${sub.at - census.at} ms after the census's key read`);
    w.graph.down = false;
    await drive(proc, 10 * SEC, 250); // past a late census's answer (15 s after its key read)
    eq(w.relay.subCalls.length, 1, `subscribe calls at the first start (A1-8: a late census answer is ignored, so it opens no second REQ)\n        ${diag(proc)}`);
    const N = tg('re7-n', { createdAt: NOW_S + 60 });
    put(w, N);
    await within(proc, MIN, () => reflects(w, N), 'the start proceeded: a tagging stored after it is created within 60 s');
  });
});

test('RE8: the first start\'s catch-up brings a relationship the backfill left behind the relay up to the relay\'s version within 60 s, and creates nothing where the graph holds nothing (the backfill owns it); a deletion that later prompts a look at those pre-existing addresses still creates nothing there, and brings a relationship the graph holds at an older version up to the relay\'s again (AC-4: "never creates … even when a deletion … leads the path to read its address" and "a relationship the graph already holds … still follows the relay\'s version"; A1-10 "Its look-only prompts bring a relationship the backfill left behind the relay up to the relay\'s version within seconds, instead of at the first safety diff"; ADR gateAction; T16)', async () => {
  const w = newWorld();
  const P4 = tg('re8-p4', { createdAt: NOW_S - 500 });
  const P5old = tg('re8-p5', { id: idOf('re8:p5:old'), createdAt: NOW_S - 900, polarity: '1' });
  const P5 = version(P5old, 're8:p5:new', { createdAt: NOW_S - 500, polarity: '-1' });
  put(w, P4, P5); // the relay holds P4 and P5 since before the first start
  backfill(w, P5old); // the graph is behind at P5's address, and lacks P4's
  const proc = w.spawn();
  await H.startEngine(proc);
  await within(proc, MIN, () => !!w.store.started && reflects(w, P5),
    'the first start, then its catch-up (A1-10 step 4: trigger start), bring the relationship at P5\'s address up to the relay\'s version within 60 s of the start, with no deletion or safety diff', 100);
  assert(absent(w, addr(P4)), `the first start's catch-up must not create the pre-existing ${addr(P4)} (AC-4; A1-10 "no catch-up creates a version in B")`);
  // Another writer (a backfill re-run from an older read) puts the older version back: the graph is behind again.
  backfill(w, P5old);
  assert(reflects(w, P5old), 'fixture: the graph records the older version at P5\'s address again');
  // Alice's address deletion is older than both versions: the relay removes neither, but it names both addresses.
  put(w, del('re8-look', { a: [addr(P4), addr(P5)], createdAt: NOW_S - 700 }));
  assert(w.relay.holds(P4.id) && w.relay.holds(P5.id), 'fixture: the older address deletion removes nothing on the relay');
  await within(proc, MIN, () => reflects(w, P5), 'the relationship at P5\'s address follows the relay\'s version within 60 s of the look');
  await hold(proc, 2 * MIN, 'two minutes later', 1000);
  assert(absent(w, addr(P4)), `a look at a pre-existing address the graph lacks must not create it (AC-4); the graph now holds ${edgeText(w.graph.edgeAt(addr(P4)))}`);
  const tried = w.graph.writes.filter((x) => x.kind === 'create' && x.addresses.includes(addr(P4)));
  eq(tried.length, 0, 'create calls naming the pre-existing address');
});

/* ═════════════════════════════════════════════════════ AC-1 ═════════════════════════════════════════════════════ */

test('RE9: a tagging the relay stores is created within 60 s, the relationship exactly the contract\'s and its people added — back-dated years, either stamp or both, a self-tagging, a dispute, a neutral "0", no stance, another author, and one stored while a pass runs (AC-1; "each criterion holds for taggings from any author …")', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const list = [
    ['a fresh tagging', tg('re9-fresh', { createdAt: NOW_S })],
    ['history five years old', tg('re9-old', { createdAt: NOW_S - 5 * 365 * DAY_S })],
    ["this deployment's stamp only", tg('re9-local', { stamps: [STAMP(LOCAL)] })],
    ['both stamps', tg('re9-both', { stamps: [STAMP(CANONICAL), STAMP(LOCAL)] })],
    ['a self-tagging', tg('re9-self', { target: ALICE })],
    ['a dispute', tg('re9-dispute', { polarity: '-1' })],
    ['a neutral "0"', tg('re9-neutral', { polarity: '0' })],
    ['no stance', tg('re9-nostance', { polarity: null })],
    ['another author', tg('re9-carol', { author: CAROL, target: pubkeyOf('re9:new-person') })],
  ];
  putAll(w, list.map((x) => x[1]));
  await withinAll(proc, MIN, () => list.filter(([, ev]) => !reflects(w, ev))
    .map(([n, ev]) => `${n}: expected ${edgeText(expectEdge(ev))}, graph ${edgeText(w.graph.edgeAt(addr(ev)))}`),
  'every one is created, exactly as the contract gives it, within 60 s');
  for (const pk of [ALICE, BOB, CAROL, pubkeyOf('re9:new-person')]) assert(w.graph.people.has(pk), `person ${pk.slice(0, 8)}… is added once (story 2 AC-1)`);
  w.passStart(PASS_RUN);
  const during = tg('re9-during-pass', { createdAt: NOW_S + 60 });
  put(w, during);
  await within(proc, MIN, () => reflects(w, during), 'a tagging stored while a pass runs is created within 60 s (AC-1 "whether or not a pass is running")');
});

test('RE10: a flipped stance on a relationship the backfill wrote is updated within 60 s (AC-1 "updated when the relay\'s version differs")', async () => {
  const w = newWorld();
  const P = tg('re10-p', { polarity: '1' });
  put(w, P);
  backfill(w, P);
  const proc = await boot(w);
  const P2 = version(P, 're10-p:v2', { polarity: '-1' });
  put(w, P2);
  await within(proc, MIN, () => reflects(w, P2), 'the relationship takes the new stance within 60 s');
});

test('RE11: a new version naming another person moves the relationship within 60 s, leaving none at the old person (AC-1 "moved")', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const X1 = tg('re11-x', { createdAt: NOW_S, target: BOB });
  put(w, X1);
  await within(proc, MIN, () => reflects(w, X1), 'the first version is created');
  const X2 = version(X1, 're11-x:v2', { target: CAROL });
  put(w, X2);
  await within(proc, MIN, () => reflects(w, X2), 'the relationship moves to Carol within 60 s');
  const e = w.graph.edgeAt(addr(X1));
  eq(e.to, CAROL, 'the relationship at the address now ends at Carol');
  const atBob = [...w.graph.rows.values(), ...w.graph.others].filter((r) => r.toPubkey === BOB && H.propAddress(r) === addr(X1));
  eq(atBob.length, 0, 'relationships left at the old person for that address');
});

test('RE12: a tagging naming its tag only by id takes the tag\'s address and slug from the relay\'s tag element within 60 s; with no such element it is written unresolved; and a look after the element leaves keeps the resolution of the same version (AC-1 "a tag named only by id"; ADR 0002 same-version rule)', async () => {
  const w = newWorld();
  const EL = F.makeElement({ id: idOf('re12:el'), d: 're12-tag' });
  put(w, EL);
  const proc = await boot(w);
  const X = tg('re12-x', { a: null, e: EL.id, createdAt: NOW_S });
  const Y = tg('re12-y', { a: null, e: idOf('re12:no-such-element'), createdAt: NOW_S });
  put(w, X, Y);
  await within(proc, MIN, () => reflects(w, X, [EL]) && reflects(w, Y), 'both are written within 60 s');
  const ex = w.graph.edgeAt(addr(X));
  same({ tagAddress: ex.tagAddress, tagSlug: ex.tagSlug }, { tagAddress: `39999:${JACK}:re12-tag`, tagSlug: 're12-tag' }, 'the id-only tagging resolved through the element');
  eq(w.graph.edgeAt(addr(Y)).tagAddress, null, 'with no usable element the relationship is written unresolved');
  // The element leaves; an older address deletion by Alice prompts a look at X's address and removes nothing.
  w.relay.remove(EL.id);
  put(w, del('re12-look', { a: [addr(X)], createdAt: X.created_at - 5 }));
  await hold(proc, MIN, 'a minute after the look', 500);
  assert(reflects(w, X, [EL]), `the stored resolution of the same version is kept (AC-1; ADR 0002 same-version rule); graph now ${edgeText(w.graph.edgeAt(addr(X)))}`);
});

test('RE13: a burst of 10,000 changes stored at once — 9,000 new taggings from 40 authors and 1,000 of Alice\'s taggings revoked by id in ten kind-5s — is reflected in full within 5 minutes of the last one stored, none lost (AC-1 "bursts"; AC-2 "no count limit"; owner decision 9: a kind-5 counts as the addresses it names)', async () => {
  const w = newWorld();
  w.graph.keepRows = false;
  w.keepScanFilters = false;
  const proc = await boot(w);
  const OLD = F.manyTaggings(1000, { prefix: 're13-old', over: (i) => ({ target: i % 2 ? BOB : CAROL, createdAt: NOW_S }) });
  putAll(w, OLD);
  await within(proc, 5 * MIN, () => w.graph.rows.size >= 1000, 'fixture: the 1,000 taggings to be revoked are created first', 250);
  const NEW = F.manyTaggings(9000, { prefix: 're13-new', over: (i) => ({ author: pubkeyOf(`re13:${i % 40}`), target: i % 3 ? BOB : CAROL, createdAt: NOW_S + 100 - (i % 5000) }) });
  const K = [];
  for (let k = 0; k < 10; k++) K.push(del(`re13-k${k}`, { e: OLD.slice(k * 100, k * 100 + 100).map((x) => x.id), createdAt: NOW_S + 200 }));
  putAll(w, NEW);
  putAll(w, K);
  const oldLeft = () => OLD.filter((ev) => !absent(w, addr(ev))).length;
  await within(proc, 5 * MIN, () => w.graph.rows.size === 9000 && oldLeft() === 0,
    'all 9,000 created and all 1,000 revoked relationships removed within 5 minutes of the burst', 250);
  const wrong = NEW.filter((ev) => { const e = w.graph.edgeAt(addr(ev)); return !e || e.eventId !== ev.id; });
  assert(wrong.length === 0, `${wrong.length} of the 9,000 are missing or wrong, e.g. ${preview(wrong.slice(0, 3).map(addr))}`);
});

test('RE54: a round keeps at most 16 MiB of events — facing 500 taggings of about 130 KB each at once, no round reads them all: every round\'s successful address and element reads stay within the 16 MiB budget plus one 8 MiB scan, every round scan — all live ones, as no catch-up runs meanwhile — passes maxBytes 8 MiB, and all 500 are still reflected within 5 minutes of the burst (AC-1 "bursts"; AC-3 bounded; ADR § What it decides "Bounds"; T2 LIMITS roundKeptBytes, roundScanMaxBytes; A1-14: a catch-up share\'s scans run under what is left of its fifth instead)', async () => {
  const w = newWorld({ lean: true });
  w.graph.keepRows = false;
  const proc = await boot(w);
  const BIG = F.manyTaggings(500, { prefix: 're54', over: (i) => ({ author: pubkeyOf(`re54:${i % 50}`), target: i % 2 ? BOB : CAROL, createdAt: NOW_S }) }).map(padded);
  const mark = w.nextSeq();
  putAll(w, BIG);
  await withinAll(proc, 5 * MIN, () => BIG.filter((ev) => !holdsId(w, ev)).map(addr), 'all 500 are reflected within 5 minutes of the burst', 250);
  const wrong = BIG.filter((ev) => !reflects(w, ev));
  assert(wrong.length === 0, `${wrong.length} relationship(s) differ from the contract's, e.g. ${preview(wrong.slice(0, 3).map(addr))}`);
  // Every round begins with its graph read; a round's relay reads are the address and element scans that follow it.
  const reads = w.graph.calls.filter((x) => x.seq > mark && x.op === 'readAt').map((x) => x.seq);
  const roundScans = w.relay.scans.filter((x) => x.seq > mark && (x.kind === 'address' || x.kind === 'element'));
  const perRound = reads.map((from, i) => {
    const to = i + 1 < reads.length ? reads[i + 1] : Infinity;
    return roundScans.filter((x) => x.seq > from && x.seq < to && x.outcome === 'ok').reduce((n, x) => n + x.bytes, 0);
  });
  const worst = Math.max(0, ...perRound);
  assert(worst <= H.ROUND_KEPT_BYTES + H.ROUND_SCAN_MAX_BYTES, `a round read ${(worst / MiB).toFixed(1)} MiB of events; the kept budget is 16 MiB, and once it is reached the round adds no more addresses (so at most one 8 MiB scan past it)`);
  const reading = perRound.filter((n) => n > 0).length;
  assert(reading >= 3, `the 500 taggings (about ${Math.round((500 * PAD_130K.length) / MiB)} MiB) were read in ${reading} round(s); a 16 MiB budget needs at least 3`);
  eq(callsAfter(w, 'readKeys', mark).length, 0, 'fixture: catch-ups begun during the burst (every catch-up begins with readKeys); none is due, so every round scan is a live one');
  same([...new Set(roundScans.map((x) => x.maxBytes))], [H.ROUND_SCAN_MAX_BYTES], 'maxBytes passed on every live round scan (T2 LIMITS.roundScanMaxBytes: 8 MiB)');
});

test('RE66: the element read stays within the round\'s kept budget — 60 taggings naming their tag only by id, whose tag elements are about 500 KB each (30 MiB in all), stored at once: no round reads more than the 16 MiB budget plus one 8 MiB scan of address and element events, the id-only addresses past the budget wait for later rounds, and all 60 are written resolved within 2 minutes (AC-1 "bursts", "a tag named only by id"; AC-3 bounded; ADR § What it decides "Bounds": "a round\'s kept events, the element read\'s included", "its remaining id-only addresses are deferred to the next round", step 3 "within the kept budget")', async () => {
  const w = newWorld();
  const ELS = [];
  for (let i = 0; i < 60; i++) ELS.push(Object.assign(F.makeElement({ id: idOf(`re66:el:${i}`), d: `re66-tag-${i}` }), { content: 'e'.repeat(500 * 1024) }));
  putAll(w, ELS);
  const proc = await boot(w);
  const TG = ELS.map((el, i) => tg(`re66-${i}`, { a: null, e: el.id, createdAt: NOW_S }));
  const mark = w.nextSeq();
  putAll(w, TG);
  await withinAll(proc, 2 * MIN, () => TG.filter((ev) => !reflects(w, ev, ELS)).map(addr), 'all 60 are written, each tag resolved from its element, within 2 minutes', 250);
  // Every round begins with its graph read; a round's relay reads are the address and element scans that follow it.
  const reads = w.graph.calls.filter((x) => x.seq > mark && x.op === 'readAt').map((x) => x.seq);
  const roundScans = w.relay.scans.filter((x) => x.seq > mark && (x.kind === 'address' || x.kind === 'element'));
  const perRound = reads.map((from, i) => {
    const to = i + 1 < reads.length ? reads[i + 1] : Infinity;
    return roundScans.filter((x) => x.seq > from && x.seq < to && x.outcome === 'ok').reduce((n, x) => n + x.bytes, 0);
  });
  assert(roundScans.some((x) => x.kind === 'element' && x.outcome === 'ok'), 'fixture: the rounds read tag elements');
  const worst = Math.max(0, ...perRound);
  assert(worst <= H.ROUND_KEPT_BYTES + H.ROUND_SCAN_MAX_BYTES, `a round read ${(worst / MiB).toFixed(1)} MiB of address and element events; the element read counts against the 16 MiB kept budget, and once it is reached the rest are deferred (so at most one 8 MiB scan past it)`);
});

/* ═════════════════════════════════════════════════════ AC-2 ═════════════════════════════════════════════════════ */

test('RE14: the author\'s revoke by event id removes the relationship within 60 s — one the backfill wrote and one the path created (AC-2)', async () => {
  const w = newWorld();
  const P = tg('re14-p');
  put(w, P);
  backfill(w, P);
  const proc = await boot(w);
  const L = tg('re14-l', { createdAt: NOW_S });
  put(w, L);
  await within(proc, MIN, () => reflects(w, L), 'fixture: the path creates L');
  put(w, del('re14-kp', { e: [P.id] }), del('re14-kl', { e: [L.id] }));
  await within(proc, MIN, () => absent(w, addr(P)) && absent(w, addr(L)), 'both relationships are removed within 60 s of the revokes');
});

test('RE15: the author\'s revoke by address (dated no earlier than the version) removes the relationship within 60 s (AC-2; ADR gateAction "names the address by a … revokeApplies")', async () => {
  const w = newWorld();
  const P = tg('re15-p');
  put(w, P);
  backfill(w, P);
  const proc = await boot(w);
  const L = tg('re15-l', { createdAt: NOW_S - 10 });
  put(w, L);
  await within(proc, MIN, () => reflects(w, L), 'fixture: the path creates L');
  put(w, del('re15-kp', { a: [addr(P)], createdAt: NOW_S }), del('re15-kl', { a: [addr(L)], createdAt: NOW_S }));
  assert(!w.relay.holds(P.id) && !w.relay.holds(L.id), 'fixture: the relay acted on both address deletions');
  await within(proc, MIN, () => absent(w, addr(P)) && absent(w, addr(L)), 'both relationships are removed within 60 s');
});

test('RE49: an address deletion from the author dated before the recorded version is no revoke of it — when the tagging has already left the relay with no event, the look it prompts removes nothing, and the relationship waits for the pass (AC-2 as amended by owner decision 2: "a revoke is the tagging\'s author\'s deletion under strfry\'s rule applied to the recorded version"; AC-3; ADR "Why revokeApplies for address deletions"; T16)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const X = tg('re49-x', { createdAt: NOW_S });
  put(w, X);
  await within(proc, MIN, () => reflects(w, X), 'fixture: X is created');
  w.relay.remove(X.id); // an operator's delete: X leaves the relay with no event
  put(w, del('re49-old', { a: [addr(X)], createdAt: X.created_at - 100 })); // strfry would not have removed X with this
  await hold(proc, 2 * MIN, 'two minutes after an older address deletion', 500);
  assert(reflects(w, X), `the relationship stays until the next pass; graph now ${edgeText(w.graph.edgeAt(addr(X)))}`);
  const removes = w.graph.writes.filter((x) => x.kind === 'remove' && x.addresses.includes(addr(X)));
  eq(removes.length, 0, 'removal calls at the address');
});

test('RE16: another author\'s kind-5 changes nothing — by id (stored, not honoured) or by address (refused) — even when the relay no longer holds the tagging for another reason; it is counted as foreign (AC-2 "a look, never a verdict"; owner decision 3; ADR § Status deletionsForeign)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const X = tg('re16-x', { createdAt: NOW_S });
  const Y = tg('re16-y', { createdAt: NOW_S });
  put(w, X, Y);
  await within(proc, MIN, () => reflects(w, X) && reflects(w, Y), 'fixture: both are created');
  put(w, del('re16-bob-e', { author: BOB, e: [X.id] }));
  const refused = w.relay.store(del('re16-carol-a', { author: CAROL, a: [addr(X)] }));
  assert(!refused.stored, 'fixture: the relay refuses another author\'s address deletion');
  w.relay.remove(Y.id); // Y leaves the relay with no event (an operator's delete)
  put(w, del('re16-bob-e2', { author: BOB, e: [Y.id] }));
  await hold(proc, 2 * MIN, 'two minutes after other authors\' deletions', 500);
  assert(reflects(w, X), `X is unchanged; graph ${edgeText(w.graph.edgeAt(addr(X)))}`);
  assert(reflects(w, Y), `Y keeps its relationship until the next pass (AC-2, AC-3); graph ${edgeText(w.graph.edgeAt(addr(Y)))}`);
  const st = statusOf(proc);
  assert((num(st, 'counts.deletionsForeign') || 0) >= 1, `counts.deletionsForeign counts targets another author named (ADR § Status); got ${show(at(st, 'counts.deletionsForeign'))}`);
});

test('RE17: a kind-5 that is no tagging revoke — an unpin, a curated-list copy\'s deletion, an ordinary note deletion, one naming nothing held — changes nothing, and each is counted in deletionsMatchedNothing (AC-2; AC-6)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const X = tg('re17-x', { createdAt: NOW_S });
  const NOTE = note('re17');
  put(w, X, NOTE);
  await within(proc, MIN, () => reflects(w, X), 'fixture: X is created');
  const before = H.fingerprint(w.graph.rows.get(addr(X)));
  const writesBefore = w.graph.writes.length;
  const ASSIST = pubkeyOf('re17:assistant');
  const unpin = Object.assign(del('re17-unpin', { e: [idOf('re17:pin-event')] }), { content: 'unpinned' });
  const copyDeletion = {
    id: idOf('re:del:re17-copy'), pubkey: ASSIST, created_at: NOW_S, kind: 5, content: '', sig: H.SIG,
    tags: [['a', `39999:${ASSIST}:copy-3f2a9c`], ['e', idOf('re17:copy:v1')], ['e', idOf('re17:copy:v2')], ['k', '39999']],
  };
  const noteDeletion = del('re17-note', { e: [NOTE.id] });
  const nothing = del('re17-nothing', { author: CAROL, e: [idOf('re17:never-held')] });
  put(w, unpin, copyDeletion, noteDeletion, nothing);
  await hold(proc, 2 * MIN, 'two minutes after four deletions that name no tagging', 500);
  eq(H.fingerprint(w.graph.rows.get(addr(X))), before, 'X\'s relationship is untouched');
  const writes = w.graph.writes.slice(writesBefore);
  eq(writes.length, 0, `write calls after deletions that name no tagging (got ${show(writes.map((x) => x.kind))})`);
  const st = statusOf(proc);
  assert((num(st, 'counts.deletionsMatchedNothing') || 0) >= 4, `counts.deletionsMatchedNothing counts each of the four (AC-6 "deletions that matched no relationship"); got ${show(at(st, 'counts.deletionsMatchedNothing'))}`);
});

test('RE18: a revoke by id of the older version, arriving with a newer version, removes nothing: the newer version is its address\'s top when the kind-5 is drained, so the kind-5 resolves nothing, and the relationship follows the relay\'s version (AC-2 "the relay decides"; A1-3 "resolves only while X is the top of its address\'s lineage"; A1-5: no discard, a stale by-e prompt is inert)', async () => {
  const w = newWorld();
  const V1 = tg('re18-v');
  put(w, V1);
  backfill(w, V1);
  const proc = await boot(w);
  const V2 = version(V1, 're18-v:v2', { polarity: '-1' });
  put(w, V2, del('re18-k', { e: [V1.id] }));
  await within(proc, MIN, () => reflects(w, V2), 'the relationship follows the newer version within 60 s');
  await hold(proc, MIN, 'a minute later', 500);
  assert(reflects(w, V2), 'the relationship still follows the relay\'s version');
  const removes = w.graph.writes.filter((x) => x.kind === 'remove' && x.addresses.includes(addr(V1)));
  eq(removes.length, 0, 'removal calls at the address');
});

test('RE19: a version heard but not yet written, then revoked by id at once, is removed within 60 s — the kind-5 names its address\'s top, and the relationship records the version learned there before it (AC-2 as amended by owner decision 2; A1-3; A1-4 clause (ii), owner decision 11)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const V1 = tg('re19-v', { createdAt: NOW_S });
  put(w, V1);
  await within(proc, MIN, () => reflects(w, V1), 'fixture: V1 is created');
  const V2 = version(V1, 're19-v:v2', { polarity: '-1' });
  put(w, V2, del('re19-k', { e: [V2.id] })); // V2 replaces V1 on the relay, then Alice revokes V2: nothing left there
  assert(!w.relay.atAddress(addr(V1)), 'fixture: the relay holds nothing at the address');
  await within(proc, MIN, () => absent(w, addr(V1)), 'the relationship is removed within 60 s');
});

test('RE20: after an id-only revoke, the older version re-sent is created within 60 s of reaching the relay (AC-2 "an older version re-sent after an id-only revoke"; ADR shrink rule)', async () => {
  const w = newWorld();
  const Q1 = tg('re20-q', { createdAt: NOW_S - 900 });
  put(w, Q1);
  backfill(w, Q1);
  const proc = await boot(w);
  const Q2 = version(Q1, 're20-q:v2', { polarity: '-1' });
  put(w, Q2);
  await within(proc, MIN, () => reflects(w, Q2), 'fixture: the newer version is written');
  put(w, del('re20-k', { e: [Q2.id] }));
  await within(proc, MIN, () => absent(w, addr(Q1)), 'the id-only revoke removes the relationship');
  put(w, Q1); // the relay accepts the older version again: only Q2's id is blocked
  await within(proc, MIN, () => reflects(w, Q1), 'the re-sent older version is created within 60 s');
});

test('RE52: the author\'s kind-5 written with its own pubkey in upper-case hex resolves nothing live (it is not isEvent-shaped), but strfry acts on it, so the next safety diff\'s author-scoped candidate scan finds it and removes the relationship within 10 minutes of its being stored, plus a round (AC-2 as qualified by owner decision 5; T25 "A kind-5 whose own pubkey is written in upper-case hex")', async () => {
  const w = newWorld();
  const AU = pubkeyOf('re52:author');
  assert(/[a-f]/.test(AU), 'fixture: the author\'s pubkey has hex letters');
  const proc = await boot(w);
  const X = tg('re52-x', { author: AU, createdAt: NOW_S });
  put(w, X);
  await within(proc, MIN, () => reflects(w, X), 'fixture: X is created');
  const matchedBefore = num(statusOf(proc), 'counts.deletionsMatchedNothing') || 0;
  put(w, del('re52-k', { author: AU.toUpperCase(), e: [X.id] }));
  assert(!w.relay.holds(X.id), 'fixture: the relay acted on the deletion (strfry compares pubkeys as hex)');
  const storedAt = w.clock.t;
  await hold(proc, 2 * MIN, 'two minutes after the upper-case kind-5', 500);
  assert(reflects(w, X), `T25: a kind-5 whose own pubkey is upper-case hex resolves nothing live, so the relationship waits for the next catch-up or safety diff; graph now ${edgeText(w.graph.edgeAt(addr(X)))}`);
  const matched = num(statusOf(proc), 'counts.deletionsMatchedNothing') || 0;
  assert(matched >= matchedBefore + 1, `the kind-5 is counted in deletionsMatchedNothing (T6: not isEvent-shaped, so matchedNothing); it went from ${matchedBefore} to ${matched}`);
  await within(proc, 10 * MIN + 30 * SEC - (w.clock.t - storedAt), () => absent(w, addr(X)),
    'the next safety diff removes the relationship within 10 minutes of the kind-5 being stored, plus a round', 1000);
});

test('RE61: the author\'s live revoke naming the tagging\'s id in upper-case hex, or its address with the pubkey in upper-case hex, still removes the relationship within 60 s — the targets are normalised (lower-cased) before they are resolved (AC-2; T6; T25 "A by: \'a\' prompt\'s target is revokeTargets\' normalised address")', async () => {
  const w = newWorld();
  const AU = pubkeyOf('re61:author');
  assert(/[a-f]/.test(AU), 'fixture: the author\'s pubkey has hex letters');
  const proc = await boot(w);
  const X = tg('re61-x', { author: AU, createdAt: NOW_S });
  const Y = tg('re61-y', { author: AU, createdAt: NOW_S });
  put(w, X, Y);
  await within(proc, MIN, () => reflects(w, X) && reflects(w, Y), 'fixture: X and Y are created');
  assert(/[a-f]/.test(X.id), 'fixture: X\'s id has hex letters');
  put(w, del('re61-ke', { author: AU, e: [X.id.toUpperCase()] }), del('re61-ka', { author: AU, a: [`39999:${AU.toUpperCase()}:${firstD(Y)}`], createdAt: NOW_S + 10 }));
  assert(!w.relay.holds(X.id) && !w.relay.holds(Y.id), 'fixture: the relay acted on both (strfry compares ids and pubkeys as hex)');
  await within(proc, MIN, () => absent(w, addr(X)) && absent(w, addr(Y)), 'both relationships are removed within 60 s of the revokes');
});

test('RE59: a newer version and its id-only revoke stored in one batch are never announced as a version — the relay announces only the kind-5, which names an id nobody recorded — so the older relationship stays, across a safety diff and a restart\'s catch-up, until a pass (story item 7 "a version deleted before it is announced"; owner decision 5; AC-3: a removal needs a revoke of what the graph records)', async () => {
  const w = newWorld();
  const V1 = tg('re59-v', { createdAt: NOW_S - 900 });
  put(w, V1);
  backfill(w, V1);
  const proc = await boot(w);
  const V2 = version(V1, 're59-v:v2', { polarity: '-1' });
  const out = w.relay.storeBatch([V2, del('re59-k', { e: [V2.id] })]);
  assert(out.every((x) => x.stored) && !w.relay.atAddress(addr(V1)), 'fixture: the batch replaced V1 with V2 and deleted V2, so the relay holds nothing at the address');
  const unchanged = (p) => () => {
    if (!reflects(w, V1)) throw new Error(`the older relationship changed (graph now ${edgeText(w.graph.edgeAt(addr(V1)))}); nothing on the relay ties the batch's kind-5 to the address, so it waits for a pass (story item 7)\n        ${diag(p)}`);
  };
  await hold(proc, 11 * MIN, 'across a safety diff', 1000, unchanged(proc));
  assert((num(statusOf(proc), 'counts.deletionsMatchedNothing') || 0) >= 1, `the batch's kind-5 matched nothing (its version was never announced); got ${show(at(statusOf(proc), 'counts.deletionsMatchedNothing'))}`);
  await stop(w, proc, 'signal');
  const p2 = await restart(w);
  await hold(p2, 5 * MIN, 'through a restart\'s catch-up', 1000, unchanged(p2));
  eq(w.graph.writes.filter((x) => x.addresses.includes(addr(V1))).length, 0, 'write calls naming the address');
});

/* ═════════════════════════════════════════════════════ AC-3 ═════════════════════════════════════════════════════ */

test('RE21: a relay wipe removes nothing — not with a version prompt queued at the wipe, not across the 10-minute safety diff, and not when a restart\'s catch-up reads everything empty (AC-3 "what a removal needs"; ADR gateAction, safety diff)', async () => {
  const w = newWorld();
  const P = tg('re21-p');
  put(w, P);
  backfill(w, P);
  const proc = await boot(w);
  const X = tg('re21-x', { createdAt: NOW_S });
  const Y = tg('re21-y', { createdAt: NOW_S });
  put(w, X, Y);
  await within(proc, MIN, () => reflects(w, X) && reflects(w, Y), 'fixture: X and Y are created');
  const addresses = [addr(P), addr(X), addr(Y)];
  put(w, version(Y, 're21-y:v2', { polarity: '-1' })); // a version prompt is queued …
  w.relay.wipe(); // … and the owner wipes the relay (no event)
  const gone = () => addresses.filter((a) => absent(w, a));
  await hold(proc, 11 * MIN, 'after a relay wipe, through a safety diff', 1000, () => {
    const g = gone();
    if (g.length) throw new Error(`a wipe removed ${show(g)} (AC-3: a removal needs a revoke and a read after it)\n        ${diag(proc)}`);
  });
  const st = statusOf(proc);
  assert((num(st, 'counts.removalsNotPrompted') || 0) >= 1, `the removal the empty read called for is held and counted (ADR gateAction: removalsNotPrompted); got ${show(at(st, 'counts.removalsNotPrompted'))}`);
  await stop(w, proc, 'signal');
  const p2 = await restart(w);
  await hold(p2, 5 * MIN, 'a restart after the wipe (the catch-up reads everything empty)', 1000, () => {
    const g = gone();
    if (g.length) throw new Error(`the catch-up after a wipe removed ${show(g)} (AC-3: "a read of everything that comes back empty … removes nothing")\n        ${diag(p2)}`);
  });
});

test('RE22: a relay read that fails — exits non-zero, times out, or is cut short after streaming its events — changes nothing for that tagging and removes nothing; failures are counted; once the relay answers in full again, the change is reflected within 5 minutes (AC-3 "failed or incomplete read")', async () => {
  await cases([
    { name: 'every relay read exits non-zero', code: 'exit' },
    { name: 'every relay read times out', code: 'timeout' },
    { name: 'every relay read is cut short', code: 'truncated' },
  ], async (c) => {
    const w = newWorld();
    const proc = await boot(w);
    const R = tg('re22-r', { createdAt: NOW_S });
    put(w, R);
    await within(proc, MIN, () => reflects(w, R), 'fixture: R is created');
    w.relay.scanFail = () => c.code;
    const X = tg('re22-x', { createdAt: NOW_S + 5 });
    put(w, X, del('re22-k', { e: [R.id] }));
    await hold(proc, 2 * MIN, `while ${c.name}`, 500, () => {
      if (!reflects(w, R)) throw new Error(`R's relationship changed while reads failed (AC-3: a failed read never leads to a removal)\n        ${diag(proc)}`);
      if (!absent(w, addr(X))) throw new Error(`X was written from a failed read (AC-3: the path changes nothing for that tagging)\n        ${diag(proc)}`);
    });
    const st = statusOf(proc);
    assert((num(st, 'counts.failedReads.relay') || 0) >= 1, `counts.failedReads.relay counts the failures (AC-6 "failed reads"); got ${show(at(st, 'counts.failedReads'))}`);
    w.relay.scanFail = null;
    await within(proc, 5 * MIN, () => reflects(w, X) && absent(w, addr(R)), 'both changes are reflected within 5 minutes of the relay answering in full', 250);
  });
  // One address's reads failing does not hold up the others.
  const w = newWorld();
  const proc = await boot(w);
  const X = tg('re22b-x', { createdAt: NOW_S });
  const Y = tg('re22b-y', { createdAt: NOW_S, author: CAROL });
  const Z = tg('re22b-z', { createdAt: NOW_S, author: pubkeyOf('re22:z') });
  w.relay.scanFail = (filter) => (H.filterTargets(filter, addr(X)) ? 'exit' : null);
  put(w, X, Y, Z);
  await within(proc, MIN, () => reflects(w, Y) && reflects(w, Z), 'with one address\'s reads failing, the other changes proceed within 60 s (AC-3 "other changes proceed meanwhile")');
  await hold(proc, MIN, 'while X\'s reads fail', 500);
  assert(absent(w, addr(X)), 'X is not written while its reads fail');
  w.relay.scanFail = null;
  await within(proc, 5 * MIN, () => reflects(w, X), 'X is reflected within 5 minutes of its reads succeeding', 250);
});

test('RE23: while the tag-element read fails, an id-only tagging is written neither resolved nor unresolved; once the read succeeds it is written resolved within 5 minutes (AC-3; ADR § Failure handling "an element read fails"; ADR 0001 A8 amendment)', async () => {
  const w = newWorld();
  const EL = F.makeElement({ id: idOf('re23:el'), d: 're23-tag' });
  put(w, EL);
  const proc = await boot(w);
  w.relay.scanFail = (filter) => (H.scanTouches(filter, 'element') ? 'exit' : null);
  const X = tg('re23-x', { a: null, e: EL.id, createdAt: NOW_S });
  put(w, X);
  await hold(proc, MIN, 'while the element read fails', 500);
  const touched = w.graph.writes.filter((x) => x.addresses.includes(addr(X)));
  eq(touched.length, 0, 'write calls for the id-only tagging while its element read fails');
  w.relay.scanFail = null;
  await within(proc, 5 * MIN, () => reflects(w, X, [EL]), 'the tagging is written resolved within 5 minutes of the element read succeeding', 250);
});

test('RE24: with the graph unavailable nothing is lost — the status says waiting-graph, and a create, an update and a revoke made meanwhile are all applied within 5 minutes of the graph returning (AC-3 "unavailable graph"; AC-4)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const R1 = tg('re24-r1', { createdAt: NOW_S });
  const R2 = tg('re24-r2', { createdAt: NOW_S });
  put(w, R1, R2);
  await within(proc, MIN, () => reflects(w, R1) && reflects(w, R2), 'fixture: R1 and R2 are created');
  w.graph.down = true;
  const X = tg('re24-x', { createdAt: NOW_S + 10 });
  const R1v2 = version(R1, 're24-r1:v2', { polarity: '0' });
  put(w, X, R1v2, del('re24-k', { e: [R2.id] }));
  await hold(proc, 2 * MIN, 'while the graph is unavailable', 500);
  eq(at(statusOf(proc), 'state'), 'waiting-graph', `the status says it waits for the graph (ADR § Status state)\n        ${diag(proc)}`);
  w.graph.down = false;
  await within(proc, 5 * MIN, () => reflects(w, X) && reflects(w, R1v2) && absent(w, addr(R2)), 'every pending change is applied within 5 minutes of the graph returning', 250);
});

test('RE25: a transaction time-out is transient — writes failing with TransactionTimedOut for 2 minutes are applied within 5 minutes after, and nothing is parked or counted as refused (AC-3; ADR § Failure handling)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  w.graph.failWrites = () => H.neoError('Neo.ClientError.Transaction.TransactionTimedOut', `The transaction has been terminated (${H.NEO4J_URI})`);
  const X = tg('re25-x', { createdAt: NOW_S });
  const Y = tg('re25-y', { createdAt: NOW_S, author: CAROL });
  put(w, X, Y);
  await hold(proc, 2 * MIN, 'while every write times out', 500);
  w.graph.failWrites = null;
  await within(proc, 5 * MIN, () => reflects(w, X) && reflects(w, Y), 'both are applied within 5 minutes of the time-outs ending', 250);
  await drive(proc, 15 * SEC, 500);
  const st = statusOf(proc);
  eq(num(st, 'counts.dbRefused.total') || 0, 0, 'counts.dbRefused.total (a time-out is never a refusal)');
  eq(num(st, 'parked') || 0, 0, 'parked (a time-out is never parked)');
});

test('RE26: a change the database refuses with the same non-transient error every time is parked after exactly two rounds that each read its address and failed it with that code (a bisection inside one round is one attempt), counted once by reason and not retried in the next 30 s; every good row of its burst lands in the round that first read it (AC-3 "a change the database keeps refusing"; AC-6; ADR § Failure handling; T29 "Parking" and "the no-row-succeeds rule")', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const CODE = 'Neo.ClientError.Statement.TypeError';
  const BAD = tg('re26-bad', { createdAt: NOW_S });
  const OK = [0, 1, 2, 3, 4].map((i) => tg(`re26-ok${i}`, { createdAt: NOW_S, author: pubkeyOf(`re26:${i}`) }));
  w.graph.failWrites = (kind, rows) => (rows.some((r) => r.address === addr(BAD))
    ? H.neoError(CODE, `Property values can only be of primitive types (at ${H.NEO4J_URI})`) : null);
  put(w, BAD, ...OK);
  await within(proc, MIN, () => OK.every((ev) => reflects(w, ev)), 'every other change is reflected within 60 s');
  const late = OK.filter((ev) => !landedInFirstRound(w, addr(ev)));
  assert(late.length === 0, `T29: "a good row in a batch with one bad row still lands in the same round" — ${late.length} good row(s) landed after a later round's graph read: ${preview(late.map(addr))}`);
  await within(proc, 2 * MIN, () => (num(statusOf(proc), 'counts.dbRefused.total') || 0) >= 1, 'the refused change is counted in counts.dbRefused', 250);
  await drive(proc, 30 * SEC, 500);
  const st = statusOf(proc);
  eq(num(st, 'counts.dbRefused.total'), 1, 'counts.dbRefused.total (one change, counted once)');
  eq((at(st, 'counts.dbRefused.byReason') || {})[CODE], 1, `counts.dbRefused.byReason['${CODE}']`);
  eq(num(st, 'parked'), 1, 'status.parked (T29: a number, the parked addresses)');
  // Every round begins with its graph read, so the rounds that attempted the address are the reads that named it. The
  // "no row succeeds" rule needs rows for two or more addresses (ADR § Failure handling), so this lone row is parked in
  // its second round; with no other write succeeding after that, its next retry is at 5 minutes, not within 30 s.
  const rounds = roundsReading(w, addr(BAD));
  eq(rounds.length, 2, 'rounds that read the refused address (T29: "a row is parked after two rounds that each read its address and failed it with the same code"; a bisection inside one round is one attempt; then no retry for 5 minutes)');
  assert(absent(w, addr(BAD)), 'the refused change was not written');
});

test('RE76: a change the database refuses with a different non-transient code at every attempt is never parked — parking needs the same code twice — so over 40 s of attempts nothing is parked or counted in dbRefused (AC-3 "a change the database keeps refusing"; AC-6; ADR § Failure handling: "parked only when it fails with the same non-transient code on two attempts at least one round apart"; T29 "Parking")', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const X = tg('re76-x', { createdAt: NOW_S });
  // A code no earlier attempt used, every time (letters only, so each passes the allow-list as itself).
  const letter = (k) => String.fromCharCode(65 + (k % 26));
  const codes = [];
  w.graph.failWrites = (kind, rows) => {
    if (!rows.some((r) => r.address === addr(X))) return null;
    const code = `Neo.ClientError.Statement.RefusedAgain${letter(Math.floor(codes.length / 26))}${letter(codes.length)}`;
    codes.push(code);
    return H.neoError(code, `refused near ${H.NEO4J_URI}`);
  };
  put(w, X);
  await drive(proc, 40 * SEC, 250);
  assert(codes.length >= 2, `fixture: the write was attempted ${codes.length} time(s) in 40 s, each refused with a new code (two attempts are what parking needs)`);
  const st = statusOf(proc);
  eq(num(st, 'counts.dbRefused.total'), 0, `counts.dbRefused.total after ${codes.length} attempts, no code repeated (never parked)`);
  eq(num(st, 'parked'), 0, 'status.parked');
  assert(absent(w, addr(X)), 'the refused change was not written');
});

test('RE50: when every single-row attempt in a round fails with one non-transient code and no row succeeds, the rows are re-queued with a 5→60 s backoff — never parked, never counted as refused — and land within the backoff cap of the database accepting them again (AC-3 "a change the database keeps refusing"; ADR § Failure handling "no row in the round succeeds"; T29 "the no-row-succeeds rule applies after bisection")', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const CODE = 'Neo.DatabaseError.Statement.ExecutionFailed';
  let refusing = true;
  w.graph.failWrites = () => (refusing ? H.neoError(CODE, `Execution failed near ${H.NEO4J_URI}`) : null);
  const X = tg('re50-x', { createdAt: NOW_S });
  const Y = tg('re50-y', { createdAt: NOW_S, author: CAROL });
  put(w, X, Y);
  await hold(proc, 3 * MIN, 'while every write is refused with one code', 500);
  const st = statusOf(proc);
  eq(num(st, 'parked'), 0, 'status.parked while no row succeeds (T29: re-queued with backoff instead of parked)');
  eq(num(st, 'counts.dbRefused.total') || 0, 0, 'counts.dbRefused.total while no row succeeds (nothing is parked, so nothing is counted refused)');
  eq(at(st, 'lastError.code'), CODE, 'the status records the code as its last error');
  const rounds = roundsReading(w, addr(X)).length;
  assert(rounds >= 3, `the rows are retried: ${rounds} round(s) read the address in 3 minutes (a 5→60 s backoff gives about 6)`);
  assert(rounds <= 15, `the rows are retried with a 5→60 s backoff, not in a loop: ${rounds} round(s) read the address in 3 minutes`);
  refusing = false;
  await within(proc, 75 * SEC, () => reflects(w, X) && reflects(w, Y), 'both land within the 60 s backoff cap, plus a round, of the database accepting them', 250);
  eq(num(statusOf(proc), 'counts.dbRefused.total') || 0, 0, 'counts.dbRefused.total after they land');
});

test('RE27: a relationship another writer changed between the path\'s read and its write is not overwritten, and the relay\'s version stands within 60 s of the race; the lost race is counted (AC-3 "concurrent writer"; AC-6 "lost races")', async () => {
  await cases([
    { name: 'a create lost to another writer\'s create', kind: 'create' },
    { name: 'an update lost to another writer\'s rewrite', kind: 'update' },
  ], async (c) => {
    const w = newWorld();
    const proc = await boot(w);
    const X1 = tg('re27-x', { createdAt: NOW_S });
    let target = X1;
    if (c.kind === 'update') {
      put(w, X1);
      await within(proc, MIN, () => reflects(w, X1), 'fixture: X1 is created');
      target = version(X1, 're27-x:v2', { polarity: '-1' });
    }
    let raceAt = null;
    w.graph.beforeApply = async (kind, rows) => {
      if (raceAt !== null || kind !== c.kind || !rows.some((r) => r.address === addr(X1))) return;
      raceAt = w.clock.t;
      if (c.kind === 'create') {
        // another writer creates an older read of the address first
        w.passWrite(F.contractEdge(version(X1, 're27-x:older', { createdAt: X1.created_at - 10, polarity: '0' })));
      } else {
        // another writer rewrites the relationship (a key outside the nine, as an old writer might): the fingerprint changes
        w.passWrite(F.contractEdge(X1), { keepRid: true, rowOpts: { extra: { legacy: 1 } } });
      }
    };
    put(w, target);
    await within(proc, MIN, () => raceAt !== null, `fixture: the path attempts the ${c.kind}`);
    await within(proc, MIN, () => reflects(w, target), 'the relay\'s version stands within 60 s of the race');
    await within(proc, MIN, () => (num(statusOf(proc), `counts.lostRaces.${c.kind}`) || 0) >= 1, `counts.lostRaces.${c.kind} counts the lost race (AC-6)`, 250);
  });
});

/**
 * RE77 / RE78's fixture: X1 is created, then a new version X2 is stored; the first `lose` attempts to update the
 * address each lose a race (another writer rewrites the relationship just before the transaction acts, so its
 * fingerprint changes). → { X1, X2, attempts } with attempts the update write calls, as { at, seq }.
 */
async function losingUpdates(w, proc, name, lose) {
  const X1 = tg(name, { createdAt: NOW_S });
  put(w, X1);
  await within(proc, MIN, () => reflects(w, X1), 'fixture: X1 is created');
  const X2 = version(X1, `${name}:v2`, { polarity: '-1' });
  const attempts = [];
  w.graph.beforeApply = async (kind, rows, rec) => {
    if (kind !== 'update' || !rows.some((r) => r.address === addr(X1))) return;
    attempts.push({ at: w.clock.t, seq: rec.seq });
    if (attempts.length <= lose) w.passWrite(F.contractEdge(X1), { keepRid: true, rowOpts: { extra: { legacy: attempts.length } } });
  };
  put(w, X2);
  return { X1, X2, attempts };
}

test('RE77: a lost race is retried at once — the next write for the address comes within 1 s of simulated time of the one that lost, and the relay\'s version then stands (AC-3 "concurrent writer"; AC-1\'s minute; ADR § Failure handling: "a lost race … is re-queued at once with its prompts")', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const { X1, X2, attempts } = await losingUpdates(w, proc, 're77-x', 1);
  await within(proc, MIN, () => attempts.length >= 1, 'fixture: the update is attempted and loses its race');
  const lost = attempts[0];
  await within(proc, MIN, () => writesAfter(w, addr(X1), lost.seq).length > 0, 'the address is written again after the lost race', 50);
  const gap = writesAfter(w, addr(X1), lost.seq)[0].at - lost.at;
  assert(gap <= SEC, `the retry came ${gap} ms after the lost race (re-queued at once, with no backoff: within 1 s)`);
  await within(proc, MIN, () => reflects(w, X2), 'the relay\'s version stands after the retry');
});

test('RE78: after five consecutive lost races at one address the next attempt waits 10 s — the gap between the 5th and 6th attempts is at least 10 s (9.5 s allowed for the tick), while the first five follow at once; the relay\'s version then stands (AC-3 "concurrent writer"; ADR § Failure handling: "after 5 consecutive losses it backs off 10 s")', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const { X2, attempts } = await losingUpdates(w, proc, 're78-x', 6);
  await within(proc, 2 * MIN, () => attempts.length >= 6, 'fixture: six update attempts', 100);
  const gaps = attempts.slice(1).map((x, i) => x.at - attempts[i].at);
  assert(gaps[4] >= 9500, `gap between the 5th and 6th attempts: ${gaps[4]} ms (a 10 s backoff after 5 consecutive losses); gaps ${show(gaps)}`);
  assert(gaps.slice(0, 4).every((g) => g <= SEC), `the first five attempts follow each other at once (each lost race re-queued at once); gaps ${show(gaps)}`);
  await within(proc, MIN, () => reflects(w, X2), 'the relay\'s version stands once a race is won');
});

test('RE28: a bad identity — either stamp missing, empty, not 64 hex, upper-case or mixed-case — means no subscription, no relay scan and no graph write; the status says waiting-setup and names the identity and the problem; the path does not exit (AC-3 "bad setup"; ADR 0001 A3 note; ADR § Failure handling)', async () => {
  await cases([
    { name: 'canonical stamp missing', canonicalZ: () => undefined, identity: 'canonical', problem: 'missing' },
    { name: 'canonical stamp upper-case', canonicalZ: () => STAMP(UPPER_HEX), identity: 'canonical', problem: 'upper-case' },
    { name: 'local identity missing', local: null, identity: 'local', problem: 'missing' },
    { name: 'local identity empty', local: '', identity: 'local', problem: 'empty' },
    { name: 'local identity not 64 hex', local: 'abc123', identity: 'local', problem: 'not-64-hex' },
    { name: 'local identity mixed-case', local: 'aB'.repeat(32), identity: 'local', problem: 'upper-case' },
  ], async (c) => {
    const w = newWorld();
    put(w, tg('re28-p'));
    const proc = w.spawn({
      identities: {
        canonicalZ: c.canonicalZ || (() => STAMP(CANONICAL)),
        getOwnerAssistantPubkey: () => (has(c, 'local') ? c.local : LOCAL),
      },
    });
    await H.startEngine(proc);
    put(w, tg('re28-x', { createdAt: NOW_S }));
    await hold(proc, MIN, 'with a bad identity', 500);
    eq(w.relay.subCalls.length, 0, 'subscribe calls with a bad identity (T20: it subscribes only when the identities are good)');
    eq(w.relay.scans.length, 0, 'relay scans with a bad identity');
    eq(w.graph.writes.length, 0, 'graph write calls with a bad identity');
    const st = statusOf(proc);
    eq(at(st, 'state'), 'waiting-setup', `the status state\n        ${diag(proc)}`);
    same({ kind: at(st, 'setupProblem.kind'), identity: at(st, 'setupProblem.identity'), problem: at(st, 'setupProblem.problem') },
      { kind: 'identity', identity: c.identity, problem: c.problem }, 'the status names the setup problem (AC-3: "its status says which one is wrong")');
  });
});

test('RE29: while a database rule is missing — tags_address absent or not ONLINE, or nostrUser_pubkey absent — the path writes nothing and its status names the rule; once the rule is in place, at an odd moment of the wait (67 s in, on no 15, 30 or 60 s beat), it writes within 15 s, with no restart (AC-3 "bad setup … resumes by itself"; ADR § Failure handling, schema: "every 15 s while waiting. It resumes within 15 s of the rule appearing")', async () => {
  await cases([
    { name: 'tags_address missing', schema: { tags: 'missing' }, rule: 'tags_address' },
    { name: 'tags_address present but not ONLINE', schema: { tags: 'populating' }, rule: 'tags_address' },
    { name: 'nostrUser_pubkey missing', schema: { nostrUser: false }, rule: 'nostrUser_pubkey' },
  ], async (c) => {
    const w = newWorld();
    Object.assign(w.graph.schema, c.schema);
    const proc = await boot(w);
    const X = tg('re29-x', { createdAt: NOW_S });
    put(w, X);
    // 67 s, not a whole minute: a re-check every 30 or 60 s would line up with a fix made on a 60 s beat and still
    // resume "within 15 s" by phase alone.
    await hold(proc, 67 * SEC, 'while the rule is missing', 250);
    eq(w.graph.writes.length, 0, 'graph write calls while a rule is missing (AC-3: no relationship written, no person added)');
    const st = statusOf(proc);
    eq(at(st, 'state'), 'waiting-setup', `the status state\n        ${diag(proc)}`);
    same({ kind: at(st, 'setupProblem.kind'), rule: at(st, 'setupProblem.rule') }, { kind: 'schema', rule: c.rule }, 'the status names the missing rule');
    eq(w.graph.ddl.length, 0, 'DDL calls (the path never issues DDL; the boot hook and the pass do)');
    w.graph.schema = { tags: 'online', nostrUser: true };
    await within(proc, 16 * SEC, () => reflects(w, X), 'writes resume within 15 s of the rule appearing (1 s allowed for the round)');
    eq(w.procs.length, 1, 'processes started (no restart)');
    await drive(proc, 11 * SEC, 500);
    eq(at(statusOf(proc), 'setupProblem'), null, 'the setup problem clears once the rule is in place');
  });
});

test('RE81: the path\'s schema check passes a transaction time-out of its own — every readSchema call it makes, while a rule is missing (the 15 s re-checks) and once it is in place (the round\'s check), carries a finite, positive timeoutMs, so it never leans on a default in graph.js\'s readSchema, which keeps none for the pass (review round 1, Blocking 1(e): "The path passes its own timeoutMs, and readSchema\'s default stays as it was"; ADR 0003: the pass\'s behaviour does not change; ADR § Failure handling, schema; test/tagging-edges-wiring.test.js SWR72 pins the port\'s side)', async () => {
  const w = newWorld();
  w.graph.schema.tags = 'missing';
  const proc = await boot(w);
  const X = tg('re81-x', { createdAt: NOW_S });
  put(w, X);
  await hold(proc, 40 * SEC, 'while tags_address is missing', 250);
  eq(w.graph.writes.length, 0, 'fixture: graph write calls while the rule is missing');
  w.graph.schema = { tags: 'online', nostrUser: true };
  await within(proc, 16 * SEC, () => reflects(w, X), 'fixture: writes resume within 15 s of the rule appearing (RE29)');
  const calls = w.graph.calls.filter((x) => x.proc === proc.n && x.op === 'readSchema');
  assert(calls.length >= 3, `fixture: the path read the schema while waiting and again before its write (${calls.length} readSchema call(s))`);
  const without = calls.filter((x) => !(typeof x.timeoutMs === 'number' && Number.isFinite(x.timeoutMs) && x.timeoutMs > 0));
  assert(without.length === 0,
    `review round 1, Blocking 1(e): the path passes its own time-out to readSchema — ${without.length} of its ${calls.length} readSchema call(s) passed none (timeoutMs ${preview(without.map((x) => (x.timeoutMs === undefined ? 'undefined' : x.timeoutMs)))}), leaning on graph.js's default — the one the pass's calls share, which stays as story 2 shipped it: none`);
});

test('RE30: a bad identity after the first start waits and writes nothing; after a restart with it corrected, the path catches up on what the relay stored meanwhile within 5 minutes (AC-3 "a corrected identity takes effect at the latest after a restart, and AC-4\'s bound then runs from that start")', async () => {
  const w = newWorld();
  const p1 = await boot(w);
  await stop(w, p1, 'signal');
  const p2 = await restart(w, { identities: { canonicalZ: () => STAMP(CANONICAL), getOwnerAssistantPubkey: () => UPPER_HEX } });
  const X = tg('re30-x', { createdAt: NOW_S + 60 });
  put(w, X);
  await hold(p2, 2 * MIN, 'with a bad identity after the first start', 500);
  eq(w.graph.writes.length, 0, 'graph write calls while the identity is bad');
  eq(at(statusOf(p2), 'state'), 'waiting-setup', 'the status state');
  await stop(w, p2, 'signal');
  const p3 = await restart(w);
  await within(p3, 5 * MIN, () => reflects(w, X), 'the tagging stored meanwhile is created within 5 minutes of the corrected start', 250);
});

test('RE58: memory stays bounded — in a child Node process capped at --max-old-space-size=160, over lean fakes: (a) 200 stamped taggings of about 130 KB in one burst are all reflected; (b) one author\'s 200 multi-d events of about 130 KB that all name one address are reflected at their own addresses, while the flooded address\'s read passes 8 MiB, fails and changes nothing; (c) a journal holding 300 lines as long as a max-size kind-5 is replayed — each skipped and counted — and an absolute version-heard line after them (A1-6: v {id, a, top, older}) still drives its removal; each without running out of memory (AC-3; ADR § What it decides "Bounds", § Knowing what changed "Journal rules"; A1-6 "Replay applies each line as it is read and never buffers the journal"; owner decision 9)', async () => {
  const probe = childProcess.spawnSync(process.execPath, ['-e', 'process.stdout.write("ok")'], { encoding: 'utf8', timeout: 30000 });
  if (probe.error || probe.stdout !== 'ok') {
    skip(`a node child process cannot be spawned here (${probe.error ? probe.error.code || firstLine(probe.error) : `status ${probe.status}`}), so the ${CHILD_HEAP_MB} MB heap runs are not possible`);
  }
  await cases([
    { name: '(a) a burst of 200 taggings of 130 KB', scenario: 'burst' },
    { name: '(b) 200 multi-d events of 130 KB naming one address', scenario: 'multi-d' },
    { name: '(c) a journal of 300 max-size lines', scenario: 'journal' },
  ], async (c) => { runChild(c.scenario); });
});

/* ═════════════════════════════════════════════════════ AC-4 ═════════════════════════════════════════════════════ */

test('RE31: after downtime — a deploy (SIGTERM), a crash, or the owner turning it off and on — a new start catches up within 5 minutes: new taggings (back-dated history included), a stance flip, a move, a revoke by address and a revoke by id made meanwhile; the one pre-existing tagging the graph lacks is still never created; the catch-up reports done (AC-4; ADR § The catch-up)', async () => {
  await cases([
    { name: 'a deploy (SIGTERM)', how: 'signal' },
    { name: 'a crash of the path', how: 'crash' },
    { name: 'the owner turning it off and on', how: 'switch' },
  ], async (c) => {
    const w = newWorld();
    const P1 = tg('re31-p1');
    const P2 = tg('re31-p2');
    const P3 = tg('re31-p3');
    const P4 = tg('re31-p4', { target: CAROL });
    put(w, P1, P2, P3, P4);
    backfill(w, P1, P2, P3);
    const p1 = await boot(w);
    const L1 = tg('re31-l1', { createdAt: NOW_S });
    put(w, L1);
    await within(p1, MIN, () => reflects(w, L1), 'fixture: a live tagging is created before the downtime');
    await stop(w, p1, c.how);
    await w.advance(10 * MIN);
    const P1v2 = version(P1, 're31-p1:v2', { polarity: '-1' });
    const P2v2 = version(P2, 're31-p2:v2', { target: CAROL });
    const N1 = tg('re31-n1', { createdAt: NOW_S + 600 });
    const N2 = tg('re31-n2', { createdAt: NOW_S - 5 * 365 * DAY_S });
    put(w, P1v2, P2v2, N1, N2, del('re31-k3', { a: [addr(P3)], createdAt: NOW_S + 600 }), del('re31-k1', { e: [L1.id] }));
    if (c.how === 'switch') w.store.setSwitch(true);
    const p2 = await restart(w);
    const pending = () => [
      ['the new tagging', reflects(w, N1)], ['the back-dated tagging', reflects(w, N2)], ['the stance flip', reflects(w, P1v2)],
      ['the move', reflects(w, P2v2)], ['the revoke by address', absent(w, addr(P3))], ['the revoke by id', absent(w, addr(L1))],
    ].filter((x) => !x[1]).map((x) => x[0]);
    await withinAll(p2, 5 * MIN, pending, 'the catch-up reflects the downtime', 250);
    await drive(p2, 15 * SEC, 500);
    assert(absent(w, addr(P4)), `the pre-existing tagging the graph lacked must not be created by a catch-up (AC-4: "no start ever backfills")`);
    eq(at(statusOf(p2), 'catchUp.last.outcome'), 'done', `the status says how the catch-up ended (AC-6)\n        ${diag(p2)}`);
  });
});

test('RE32: after an id-only revoke, an older version re-sent while the path was down is created at the next start — the read that saw the newer version dropped the older one from the baseline (AC-2, AC-4; ADR "S, H, B and refusedSeen shrink")', async () => {
  const w = newWorld();
  const Q1 = tg('re32-q', { createdAt: NOW_S - 900 });
  put(w, Q1);
  backfill(w, Q1); // Q1 is held at the first start (baseline) and in the graph
  const p1 = await boot(w);
  const Q2 = version(Q1, 're32-q:v2', { polarity: '-1' });
  put(w, Q2);
  await within(p1, MIN, () => reflects(w, Q2), 'fixture: the newer version is written');
  put(w, del('re32-k', { e: [Q2.id] }));
  await within(p1, MIN, () => absent(w, addr(Q1)), 'fixture: the id-only revoke removes the relationship');
  await stop(w, p1, 'signal');
  await w.advance(5 * MIN);
  put(w, Q1); // re-sent while the path is down
  const p2 = await restart(w);
  await within(p2, 5 * MIN, () => reflects(w, Q1), 'the re-sent older version is created within 5 minutes of the start', 250);
});

test('RE33: a version heard while the graph was unavailable, then revoked by id while the path was off, is removed after it comes back — the switch-off flushed what it heard (AC-4; ADR § Knowing what changed: journal, "switch-off and SIGTERM flush the journal first")', async () => {
  const w = newWorld();
  const V1 = tg('re33-v', { createdAt: NOW_S - 900 });
  put(w, V1);
  backfill(w, V1);
  const p1 = await boot(w);
  w.graph.down = true;
  const V2 = version(V1, 're33-v:v2', { polarity: '-1' });
  put(w, V2);
  await drive(p1, 150, 50); // heard, but no round can write it
  await stop(w, p1, 'switch');
  put(w, del('re33-k', { e: [V2.id] })); // revoked by id while the path is off: the relay now holds nothing there
  assert(!w.relay.atAddress(addr(V1)), 'fixture: the relay holds nothing at the address');
  w.graph.down = false;
  await w.advance(2 * MIN);
  w.store.setSwitch(true);
  const p2 = await restart(w);
  await within(p2, 5 * MIN, () => absent(w, addr(V1)), 'the relationship is removed within 5 minutes of the start', 250);
});

test('RE74: while the path waits for the graph — no round can run, so no round ends — a version heard meanwhile reaches journal.jsonl as its v line within 1 s: the 250 ms flush timer runs in every state, the waiting ones included (AC-4; ADR § Knowing what changed: journal.jsonl is "flushed and fsynced by a 250 ms timer whenever lines are buffered, in every state including the waiting ones"; T19 the v line)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  w.graph.down = true;
  put(w, tg('re74-w', { createdAt: NOW_S }));
  await within(proc, 11 * SEC, () => at(statusOf(proc), 'state') === 'waiting-graph', 'fixture: the path is waiting for the graph (a round found it unavailable)');
  const X = tg('re74-x', { createdAt: NOW_S + 1 });
  put(w, X);
  await within(proc, SEC, () => journalLines(w).some((o) => o.t === 'v' && o.id === X.id), 'the v line for the version heard while waiting is in journal.jsonl within 1 s', 50);
  eq(at(statusOf(proc), 'state'), 'waiting-graph', 'fixture: still waiting for the graph when the line was flushed');
});

test('RE75: a version the relay delivers in the same tick as a SIGTERM is in journal.jsonl when the path exits — SIGTERM flushes what was heard first, so a deploy never opens the window in which a heard version is lost (AC-4; ADR § Failure handling "A crash or OOM": "Switch-off and SIGTERM flush the journal first, so an off or a deploy never opens that window"; T29 SIGTERM leads to { exit: 0 } within 5 s)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  w.graph.down = true; // no round can end, so only the stop can flush the line
  await drive(proc, 2 * SEC, 100);
  const X = tg('re75-x', { createdAt: NOW_S });
  put(w, X);
  await H.flush(); // the subscription has delivered X; no tick() has run since
  await H.guarded(() => proc.engine.handleSignal('SIGTERM'), "handleSignal('SIGTERM')");
  const r = await drive(proc, 5 * SEC, 50);
  eq(r.exit, 0, `after handleSignal('SIGTERM'), tick() answers { exit: 0 } within 5 s (T29)\n        ${diag(proc)}`);
  assert(journalLines(w).some((o) => o.t === 'v' && o.id === X.id), `the v line for the version delivered with the SIGTERM is in journal.jsonl at exit; journal tail: ${show(String(w.store.journal).slice(-300))}`);
});

test('RE34: a tagging stored while the subscription was dropped is reflected by the reconnect\'s catch-up within 5 minutes, and live delivery resumes (AC-4; ADR D1 "every connect is followed … by a catch-up")', async () => {
  const w = newWorld();
  const proc = await boot(w);
  w.relay.drop();
  const X = tg('re34-x', { createdAt: NOW_S });
  put(w, X); // no subscription is open: nothing delivers it
  await within(proc, 5 * MIN, () => reflects(w, X), 'the tagging stored across the gap is reflected within 5 minutes', 250);
  assert(w.relay.subCalls.length >= 2, `the path reconnected (subscribe calls: ${w.relay.subCalls.length})`);
  const Y = tg('re34-y', { createdAt: NOW_S + 60 });
  put(w, Y);
  await within(proc, MIN, () => reflects(w, Y), 'after the reconnect, a live tagging is created within 60 s');
});

test('RE62: a second reconnect within 30 s of the last catch-up still gets its catch-up — deferred to the 30 s mark, never skipped: a tagging stored across the second gap is reflected within 2 minutes, long before the 10-minute safety diff (AC-4; ADR § What it hears "Keeping it alive": "a later connect\'s catch-up is deferred to the 30 s mark, never skipped")', async () => {
  const w = newWorld();
  const proc = await boot(w);
  await drive(proc, 30 * SEC, 500); // so no catch-up before the first drop is within 30 s of it
  const mark = w.nextSeq();
  w.relay.drop();
  const X = tg('re62-x', { createdAt: NOW_S });
  put(w, X); // no subscription is open: only a catch-up finds it
  await within(proc, MIN, () => reflects(w, X), 'fixture: the first reconnect\'s catch-up reflects the tagging stored across its gap', 250);
  await drive(proc, 3 * SEC, 250);
  const first = callsAfter(w, 'readKeys', mark); // every catch-up begins with readKeys (ADR § The catch-up, step 1)
  assert(first.length >= 1 && w.clock.t - first[0].at < 30 * SEC, `fixture: the second drop comes within 30 s of the first reconnect's catch-up (its readKeys at ${show(first.map((x) => x.at - w.clock.t))} ms from now)`);
  w.relay.drop();
  const Y = tg('re62-y', { createdAt: NOW_S + 10 });
  put(w, Y);
  await within(proc, 2 * MIN, () => reflects(w, Y), 'the second reconnect\'s catch-up, deferred to the 30 s mark, reflects the tagging stored across its gap within 2 minutes', 250);
});

test('RE63: reconnects 3 s apart start at most one catch-up per 30 s — three drops within 6 s give one catch-up in the 30 s from the first (AC-4; ADR § What it hears "Keeping it alive": "at most one per 30 s")', async () => {
  const w = newWorld();
  const proc = await boot(w);
  await drive(proc, 30 * SEC, 500); // so no catch-up before the first drop is within 30 s of it
  const subsBefore = w.relay.subCalls.length;
  const mark = w.nextSeq();
  for (let i = 0; i < 3; i++) { w.relay.drop(); await drive(proc, 3 * SEC, 100); }
  await drive(proc, 20 * SEC, 250);
  assert(w.relay.subCalls.length - subsBefore >= 3, `fixture: the path reconnected after each of the three drops (subscribe calls since: ${w.relay.subCalls.length - subsBefore})`);
  const starts = callsAfter(w, 'readKeys', mark).map((x) => x.at); // every catch-up begins with readKeys (ADR § The catch-up, step 1)
  assert(starts.length >= 1, 'fixture: a reconnect\'s catch-up ran');
  const inWindow = starts.filter((t) => t < starts[0] + 30 * SEC);
  eq(inWindow.length, 1, `catch-ups started within 30 s of the first (readKeys at ${show(starts.map((t) => t - starts[0]))} ms from it)`);
});

test('RE35: with the relay unavailable for 3 minutes (connections refused, every scan failing), the taggings stored meanwhile are reflected within 5 minutes of it answering again (AC-4 "the graph and the relay both being available again")', async () => {
  const w = newWorld();
  const proc = await boot(w);
  w.relay.setDown(true);
  const X = tg('re35-x', { createdAt: NOW_S });
  const Y = tg('re35-y', { createdAt: NOW_S - 400 * DAY_S });
  put(w, X, Y); // an import writes while the websocket is down
  await hold(proc, 3 * MIN, 'while the relay is unavailable', 500);
  assert(absent(w, addr(X)) && absent(w, addr(Y)), 'nothing is written while the relay cannot be read');
  w.relay.setDown(false);
  await within(proc, 5 * MIN, () => reflects(w, X) && reflects(w, Y), 'both are reflected within 5 minutes of the relay returning', 250);
});

test('RE36: a lost record — record.json missing or unreadable, the journal unreadable, or the identities changed — is not a first start: the status reports the catch-up not established with the reason, started.json and firstStartedAt are kept, the versions the relay holds now are not created, and later live taggings are created within 60 s (AC-4 "a lost record"; owner decision 5)', async () => {
  await cases([
    { name: 'record.json missing', reason: 'record-missing', spoil: (w) => { w.store.record = null; } },
    { name: 'record.json unreadable', reason: 'record-unreadable', spoil: (w) => { w.store.recordUnreadable = true; } },
    { name: 'the journal unreadable', reason: 'journal-unreadable', spoil: (w) => { w.store.journalUnreadableOpens = 1e6; } },
    { name: 'the identities changed', reason: 'identity-changed', so: { identities: { canonicalZ: () => STAMP(CANONICAL), getOwnerAssistantPubkey: () => OTHER_DEPLOY } } },
  ], async (c) => {
    const w = newWorld();
    const P = tg('re36-p');
    put(w, P);
    const p1 = await boot(w);
    const startedBefore = H.jcopy(w.store.started);
    const firstStartedAt = at(statusOf(p1), 'firstStartedAt');
    await stop(w, p1, 'signal');
    await w.advance(5 * MIN);
    const G = tg('re36-gap', { createdAt: NOW_S + 300 });
    put(w, G);
    if (c.spoil) c.spoil(w);
    const p2 = await restart(w, c.so || {});
    await within(p2, 5 * MIN, () => at(statusOf(p2), 'catchUp.last.outcome') === 'not-established',
      'the status reports the catch-up could not be established (AC-4, AC-6)', 250);
    w.store.journalUnreadableOpens = 0; // readable again from here on (it was unreadable for the whole start)
    eq(at(statusOf(p2), 'catchUp.last.reason'), c.reason, 'catchUp.last.reason');
    same(w.store.started, startedBefore, 'started.json is kept (the start is not a first start)');
    if (firstStartedAt !== undefined) eq(at(statusOf(p2), 'firstStartedAt'), firstStartedAt, 'firstStartedAt is kept');
    await hold(p2, 2 * MIN, 'after the not-established start', 1000);
    assert(absent(w, addr(G)), 'the tagging stored during the gap waits for the next pass (owner decision 5), and a re-baseline never creates it');
    assert(absent(w, addr(P)), 'the pre-existing tagging is not created');
    const N = tg('re36-new', { createdAt: NOW_S + 900 });
    put(w, N);
    await within(p2, MIN, () => reflects(w, N), 'a tagging stored after the start is created within 60 s');
  });
});

test('RE37: past the backlog cap, live prompts are dropped and counted, and nothing is lost: 20,100 taggings stored while the graph is unavailable are all reflected once it returns (AC-4 "size of the backlog … reflected in full, with nothing lost"; owner decision 9; ADR § What it decides: the 20,000-address cap; 20 minutes is this test\'s budget, not a criterion)', async () => {
  const w = newWorld();
  w.graph.keepRows = false;
  w.keepScanFilters = false;
  const proc = await boot(w);
  w.graph.down = true;
  const N = 20100;
  const evs = F.manyTaggings(N, { prefix: 're37', over: (i) => ({ author: pubkeyOf(`re37:${i % 100}`), target: i % 2 ? BOB : CAROL, createdAt: NOW_S + (i % 60) }) });
  putAll(w, evs);
  await hold(proc, 30 * SEC, 'while the graph is unavailable', 250);
  const st = statusOf(proc);
  assert((num(st, 'counts.droppedOverBacklog') || 0) >= 1, `live prompts past the 20,000-address cap are dropped and counted (ADR: droppedOverBacklog); got ${show(at(st, 'counts.droppedOverBacklog'))}`);
  w.graph.down = false;
  await within(proc, 20 * MIN, () => w.graph.rows.size >= N, `all ${N} are reflected once the graph returns`, 500);
  const wrong = evs.filter((ev) => { const e = w.graph.edgeAt(addr(ev)); return !e || e.eventId !== ev.id; });
  assert(wrong.length === 0, `${wrong.length} missing or wrong, e.g. ${preview(wrong.slice(0, 3).map(addr))}`);
});

test('RE64: at the backlog cap a re-look is still queued, never dropped — with exactly 20,000 live prompts waiting on an unavailable graph, the re-look an overlapping pass left for another address is queued when the pass ends, and droppedOverBacklog stays 0: it counts dropped live prompts only (AC-4; AC-5; AC-6; ADR § What it decides "Bounds": "past the cap, new live prompts are dropped (never re-looks)"; § Coexisting with the pass "What happens after an overlap")', async () => {
  const w = newWorld();
  w.graph.keepRows = false;
  w.keepScanFilters = false;
  const proc = await boot(w);
  w.passStart(PASS_RUN);
  await drive(proc, SEC, 100);
  const X = tg('re64-x', { createdAt: NOW_S });
  put(w, X);
  await within(proc, MIN, () => holdsId(w, X), 'fixture: X is created while the pass runs (its round overlaps the pass, so a re-look is kept for X)');
  await drive(proc, 2 * SEC, 100);
  w.graph.down = true;
  putAll(w, F.manyTaggings(20000, { prefix: 're64', over: (i) => ({ author: pubkeyOf(`re64:${i % 40}`), createdAt: NOW_S + 1 }) }));
  await drive(proc, 11 * SEC, 250);
  eq(num(statusOf(proc), 'counts.droppedOverBacklog') || 0, 0, 'fixture: exactly 20,000 live prompts fill the 20,000-address cap without a drop');
  w.passEnd(PASS_RUN); // the next 5 s re-look check queues X's re-look: the 20,001st address
  await drive(proc, 16 * SEC, 250);
  eq(num(statusOf(proc), 'counts.droppedOverBacklog'), 0, 'counts.droppedOverBacklog once the re-look is queued past the cap (never re-looks)');
});

test('RE65: a burst of 20,100 taggings with the graph available — past the 20,000-address cap — is reflected in full within 5 minutes: the live prompts the cap drops are recovered by the catch-up it schedules, not left for the 10-minute safety diff (AC-1 "bursts"; AC-4 "reflected in full, with nothing lost"; owner decision 9; ADR § What it decides "Bounds": "past the cap, new live prompts are dropped … and a coalesced catch-up is scheduled")', async () => {
  const w = newWorld({ lean: true });
  w.graph.keepRows = false;
  w.keepScanFilters = false;
  const proc = await boot(w);
  const N = 20100;
  putAll(w, F.manyTaggings(N, { prefix: 're65', over: (i) => ({ author: pubkeyOf(`re65:${i % 40}`), createdAt: NOW_S + 1 }) }));
  await within(proc, 5 * MIN, () => w.graph.rows.size >= N, `all ${N} are reflected within 5 minutes of the burst`, 250);
  await drive(proc, 11 * SEC, 1000);
  assert((num(statusOf(proc), 'counts.droppedOverBacklog') || 0) >= 1, `fixture: live prompts past the cap were dropped, so only a catch-up could reflect them; droppedOverBacklog ${show(at(statusOf(proc), 'counts.droppedOverBacklog'))}`);
});

test('RE51: a round completes every address it decided, a refused version included — its id enters the seen map and refusedSeen — so the next start\'s catch-up reads it neither as an arrival nor as a look, and counts it refused only once (AC-4; AC-6; ADR § Knowing what changed "except an (id, address) in refusedSeen"; T25 "A round completes every address it decided")', async () => {
  const w = newWorld();
  const p1 = await boot(w);
  const RF = F.makeNonTagging({ address: `39999:${ALICE}:re51-refused`, refusal: 'no-target', id: idOf('re51:refused'), createdAt: NOW_S });
  const U = tg('re51-u', { createdAt: NOW_S });
  put(w, RF, U);
  await within(p1, MIN, () => reflects(w, U) && (num(statusOf(p1), 'counts.refused.total') || 0) >= 1, 'fixture: the round reads the refused version and counts it, and creates the other');
  await drive(p1, 5 * SEC, 500);
  eq(num(statusOf(p1), 'counts.refused.total'), 1, 'counts.refused.total before the restart');
  await stop(w, p1, 'signal');
  await w.advance(2 * MIN);
  const X = tg('re51-x', { createdAt: NOW_S + 60 });
  put(w, X); // stored while the path was down: the restart's catch-up has work to do
  const p2 = await restart(w);
  await within(p2, 5 * MIN, () => reflects(w, X) && at(statusOf(p2), 'catchUp.last.outcome') === 'done', 'fixture: the restart\'s catch-up completes and reflects the tagging stored meanwhile', 250);
  await drive(p2, 15 * SEC, 500);
  const reads = roundsReading(w, addr(RF), p2.n);
  const scans = w.relay.scans.filter((x) => x.proc === p2.n && x.filter && H.filterTargets(x.filter, addr(RF)));
  assert(reads.length === 0 && scans.length === 0, `the second process read the refused version's address ${reads.length} time(s) from the graph and ${scans.length} time(s) from the relay; T25: a refused id a round completed is in S and refusedSeen, so a catch-up offers it neither as an arrival nor as a look`);
  eq(num(statusOf(p2), 'counts.refused.total'), 1, 'counts.refused.total after the catch-up (the refused version is not read again)');
  eq(roundsReading(w, addr(U), p2.n).length, 0, 'rounds of the second process that read the created tagging\'s address (completed, and recorded by the graph)');
});

test('RE55: under a sustained live stream that alone fills every round — new versions every tick at 200 addresses of about 130 KB (more than the 16 MiB kept budget, in full 200-address scans), or at 520 small ones (more than a round\'s 500 addresses) — a restart\'s catch-up of 1,000 arrivals still completes and reflects them within 5 minutes of the start while the stream is still running, and the stream\'s last versions follow within 60 s of it stopping (AC-1; AC-4; ADR § What it hears "Lanes and rounds": the catch-up\'s reserved share of 100 addresses and 3.2 MiB, "neither a live stream nor padded live events can starve a catch-up"; owner decision 9)', async () => {
  await cases([
    { name: 'a padded stream: 200 addresses of about 130 KB every tick', stream: 200, pad: true },
    { name: 'a wide stream: 520 small addresses every tick', stream: 520, pad: false },
  ], async (c) => {
    const w = newWorld({ lean: true });
    w.graph.keepRows = false;
    w.keepScanFilters = false;
    const p1 = await boot(w);
    await stop(w, p1, 'signal');
    await w.advance(MIN);
    const ARR = F.manyTaggings(1000, { prefix: 're55-arr', over: (i) => ({ author: pubkeyOf(`re55:a${i % 100}`), target: i % 2 ? BOB : CAROL, createdAt: NOW_S + 100 - i }) });
    putAll(w, ARR); // stored while the path was down: the next start's catch-up arrivals
    let k = 0;
    let latest = [];
    const streamTick = () => {
      k += 1;
      latest = [];
      for (let i = 0; i < c.stream; i++) {
        const ev = F.makeTagging({ author: pubkeyOf(`re55:s${i}`), d: 're55-stream', target: BOB, id: idOf(`re55:s${i}:${k}`), createdAt: NOW_S + k });
        latest.push(c.pad ? padded(ev) : ev);
      }
      putAll(w, latest);
    };
    const p2 = await restart(w);
    const startAt = w.clock.t;
    streamTick();
    const left = () => ARR.filter((ev) => !holdsId(w, ev)).length;
    const done = () => { const l = at(statusOf(p2), 'catchUp.last'); return !!l && l.outcome === 'done' && Date.parse(l.startedAt) >= startAt; };
    const r = await drive(p2, 5 * MIN, { step: 5000, until: () => left() === 0 && done(), each: streamTick });
    assert(r.done, `with the live stream running, the catch-up should complete and reflect its 1,000 arrivals within 5 minutes of the start; after ${r.elapsed / 1000} s, ${left()} arrival(s) are not reflected and catchUp.last is ${show(at(statusOf(p2), 'catchUp.last'))} (a live lane that fills every round starves a catch-up that has no reserved share)\n        ${diag(p2)}`);
    const wrong = ARR.filter((ev) => !reflects(w, ev));
    assert(wrong.length === 0, `${wrong.length} arrival(s) differ from the contract's edge, e.g. ${preview(wrong.slice(0, 3).map(addr))}`);
    const last = latest; // the stream stops here
    await within(p2, MIN, () => last.every((ev) => holdsId(w, ev)), 'the stream\'s last versions are reflected within 60 s of the stream stopping', 250);
  });
});

test('RE67: a catch-up\'s reserved share is bounded by bytes as well as by addresses — with 150 arrivals and 50 live versions of about 130 KB each after a restart, no round keeps more than one fifth of the kept budget (3.2 MiB) of catch-up addresses before its first live address, each of those share scans passing maxBytes no more than what is left of that fifth; all 200 are reflected within 5 minutes (AC-1; AC-4; A1-14 "The share\'s scans run with maxBytes equal to what is left of its fifth of the round\'s kept budget (3.2 MiB) … So the share never keeps more than its fifth"; ADR § What it hears "Lanes and rounds": the share is "read before any live or re-look address"; T18 "The kept-bytes share is the engine\'s")', async () => {
  const w = newWorld({ lean: true });
  w.graph.keepRows = false;
  const p1 = await boot(w);
  await stop(w, p1, 'signal');
  const ARR = F.manyTaggings(150, { prefix: 're67-arr', over: (i) => ({ author: pubkeyOf(`re67:a${i % 30}`), createdAt: NOW_S + 100 - i }) }).map(padded);
  putAll(w, ARR); // stored while the path was down: the next start's catch-up arrivals
  const p2 = await restart(w);
  const LIVE = [];
  for (let i = 0; i < 50; i++) LIVE.push(padded(F.makeTagging({ author: pubkeyOf(`re67:s${i}`), d: 're67-live', id: idOf(`re67:s${i}`), createdAt: NOW_S + 500 })));
  putAll(w, LIVE);
  const liveAddr = new Set(LIVE.map(addr));
  const mark = w.nextSeq();
  await withinAll(p2, 5 * MIN, () => ARR.concat(LIVE).filter((ev) => !holdsId(w, ev)).map(addr), 'all 200 are reflected within 5 minutes of the start', 500);
  // Per round (graph read to graph read): the address and element scans before the first scan naming a live address are
  // the catch-up's share (no pass runs, so there are no re-looks; nothing times out, so there are no marked singles).
  const FIFTH = H.ROUND_KEPT_BYTES / 5;
  const reads = w.graph.calls.filter((x) => x.seq > mark && x.op === 'readAt').map((x) => x.seq);
  const namesLive = (s) => (Array.isArray(s.filter) ? s.filter : [s.filter])
    .some((f) => f && Array.isArray(f.authors) && Array.isArray(f['#d']) && f.authors.some((a) => f['#d'].some((d) => liveAddr.has(`39999:${String(a).toLowerCase()}:${d}`))));
  const before = [];
  const overCap = [];
  reads.forEach((from, i) => {
    const to = i + 1 < reads.length ? reads[i + 1] : Infinity;
    const scans = w.relay.scans.filter((x) => x.seq > from && x.seq < to && (x.kind === 'address' || x.kind === 'element'));
    const firstLive = scans.findIndex((s) => s.kind === 'address' && namesLive(s));
    if (firstLive < 0) return; // a round with no live address: no share to bound
    let kept = 0;
    for (const s of scans.slice(0, firstLive)) {
      if (!(typeof s.maxBytes === 'number' && s.maxBytes <= FIFTH - kept)) {
        overCap.push(`a share ${s.kind} scan (${H.scanAddresses(s.filter).length} address(es), ${H.scanIds(s.filter).length} id(s)) passed maxBytes ${show(s.maxBytes)} with ${kept} bytes of the share already kept`);
      }
      if (s.outcome === 'ok') kept += s.bytes;
    }
    before.push(kept);
  });
  assert(before.some((n) => n > 0), `fixture: a round read catch-up addresses before its live ones (bytes kept before the first live address, per round that read one: ${show(before)})`);
  assert(overCap.length === 0, `A1-14: "The share's scans run with maxBytes equal to what is left of its fifth" (${FIFTH} bytes less what the share kept): ${preview(overCap)}`);
  const worst = Math.max(...before);
  assert(worst <= FIFTH, `a round kept ${(worst / MiB).toFixed(2)} MiB of catch-up addresses before its first live address; A1-14: "the share never keeps more than its fifth" (3.2 MiB, with no scan past it)`);
});

// Found by the validating Tester's mutation pass over the A1 reference (Test Design, 2026-09-29): RE67's arrivals name
// their tags by address, so its share never reads a tag element; a share whose element reads kept the 8 MiB cap passed.
test('RE80: the catch-up share\'s element reads are bounded by the share\'s bytes too — with 150 arrivals naming their tags only by id (tag elements of about 40 KB each, 4 MB for a share\'s 100) and 50 live versions of about 130 KB each after a restart, every element read the share makes before a round\'s first live address passes maxBytes no more than what is left of its fifth, no round keeps more than 3.2 MiB of catch-up events before that address, and all 200 are reflected within 5 minutes, each tag resolved from its element (AC-1; AC-4; A1-14 "The share\'s scans run with maxBytes equal to what is left of its fifth of the round\'s kept budget (3.2 MiB), address scans and element reads alike", "An element of a share address already read that no longer fits the share is read there too" — in lane 4)', async () => {
  const w = newWorld({ lean: true });
  w.graph.keepRows = false;
  const ELS = [];
  for (let i = 0; i < 150; i++) ELS.push(Object.assign(F.makeElement({ id: idOf(`re80:el:${i}`), d: `re80-tag-${i}` }), { content: 'e'.repeat(40 * 1024) }));
  putAll(w, ELS);
  const p1 = await boot(w);
  await stop(w, p1, 'signal');
  const ARR = ELS.map((el, i) => tg(`re80-arr-${i}`, { author: pubkeyOf(`re80:a${i % 30}`), a: null, e: el.id, createdAt: NOW_S + 100 - i }));
  putAll(w, ARR); // stored while the path was down: the next start's catch-up arrivals, each naming its tag only by id
  const p2 = await restart(w);
  const LIVE = [];
  for (let i = 0; i < 50; i++) LIVE.push(padded(F.makeTagging({ author: pubkeyOf(`re80:s${i}`), d: 're80-live', id: idOf(`re80:s${i}`), createdAt: NOW_S + 500 })));
  putAll(w, LIVE);
  const liveAddr = new Set(LIVE.map(addr));
  const mark = w.nextSeq();
  await withinAll(p2, 5 * MIN, () => ARR.filter((ev) => !reflects(w, ev, ELS)).concat(LIVE.filter((ev) => !holdsId(w, ev))).map(addr),
    'all 200 are reflected within 5 minutes of the start, each tag resolved from its element', 500);
  const FIFTH = H.ROUND_KEPT_BYTES / 5;
  const reads = w.graph.calls.filter((x) => x.seq > mark && x.op === 'readAt').map((x) => x.seq);
  const namesLive = (s) => H.scanAddresses(s.filter).some((a) => liveAddr.has(a));
  const before = [];
  const overCap = [];
  let shareElementReads = 0;
  reads.forEach((from, i) => {
    const to = i + 1 < reads.length ? reads[i + 1] : Infinity;
    const scans = w.relay.scans.filter((x) => x.seq > from && x.seq < to && x.proc === p2.n && (x.kind === 'address' || x.kind === 'element'));
    const firstLive = scans.findIndex((s) => s.kind === 'address' && namesLive(s));
    if (firstLive < 0) return; // a round with no live address: no share to bound
    let kept = 0;
    for (const s of scans.slice(0, firstLive)) {
      if (s.kind === 'element') shareElementReads += 1;
      if (!(typeof s.maxBytes === 'number' && s.maxBytes <= FIFTH - kept)) {
        overCap.push(`a share ${s.kind} scan (${H.scanAddresses(s.filter).length} address(es), ${H.scanIds(s.filter).length} id(s)) passed maxBytes ${show(s.maxBytes)} with ${kept} bytes of the share already kept`);
      }
      if (s.outcome === 'ok') kept += s.bytes;
    }
    before.push(kept);
  });
  assert(shareElementReads >= 1, `fixture: a round's share read tag elements before its first live address (bytes kept before it, per round that read one: ${show(before)})`);
  assert(overCap.length === 0, `A1-14: "The share's scans run with maxBytes equal to what is left of its fifth … address scans and element reads alike" (${FIFTH} bytes less what the share kept): ${preview(overCap)}`);
  const worst = Math.max(...before);
  assert(worst <= FIFTH, `a round kept ${(worst / MiB).toFixed(2)} MiB of catch-up events before its first live address; A1-14: "the share never keeps more than its fifth" (3.2 MiB)`);
});

test('RE56: a subscription that stays connected but stops delivering — a tagging, a revoke by id and a revoke by address stored meanwhile — is caught by the safety diff: all three are reflected within 10 minutes of their being stored, plus a round, with no reconnect (AC-1, AC-2 as qualified by owner decision 10; ADR § What it hears "The safety diff")', async () => {
  const w = newWorld();
  const P = tg('re56-p');
  put(w, P);
  backfill(w, P);
  const proc = await boot(w);
  const L = tg('re56-l', { createdAt: NOW_S });
  put(w, L);
  await within(proc, MIN, () => reflects(w, L), 'fixture: live delivery works before the stall');
  w.relay.muted = true; // still connected, delivering nothing
  const storedAt = w.clock.t;
  const Y = tg('re56-y', { createdAt: NOW_S + 30 });
  put(w, Y, del('re56-kl', { e: [L.id] }), del('re56-kp', { a: [addr(P)], createdAt: NOW_S + 30 }));
  assert(!w.relay.holds(L.id) && !w.relay.holds(P.id), 'fixture: the relay acted on both revokes');
  await within(proc, 10 * MIN + 30 * SEC - (w.clock.t - storedAt), () => reflects(w, Y) && absent(w, addr(L)) && absent(w, addr(P)),
    'the safety diff reflects the tagging and both revokes within 10 minutes of their being stored, plus a round', 1000);
  eq(w.relay.subCalls.length, 1, 'subscribe calls (the subscription stayed connected: the safety diff, not a reconnect, found them)');
});

test('RE57: a 10,000-change backlog stored while the path was stopped — 9,000 new taggings, back-dated years among them, and 1,000 of the backfill\'s relationships revoked by id in ten kind-5s — is caught up in full within 5 minutes of the start (AC-4 "within 5 minutes"; story item 6: up to one burst\'s worth, 10,000; ADR § Throughput and ceilings)', async () => {
  const w = newWorld();
  w.graph.keepRows = false;
  w.keepScanFilters = false;
  const OLD = F.manyTaggings(1000, { prefix: 're57-old', over: (i) => ({ target: i % 2 ? BOB : CAROL, createdAt: NOW_S - 2000 }) });
  putAll(w, OLD);
  backfill(w, ...OLD);
  const p1 = await boot(w);
  await stop(w, p1, 'signal');
  await w.advance(10 * MIN);
  const NEW = F.manyTaggings(9000, { prefix: 're57-new', over: (i) => ({ author: pubkeyOf(`re57:${i % 40}`), target: i % 3 ? BOB : CAROL, createdAt: NOW_S + 100 - (i % 5000) * 30000 }) });
  const K = [];
  for (let k = 0; k < 10; k++) K.push(del(`re57-k${k}`, { e: OLD.slice(k * 100, k * 100 + 100).map((x) => x.id), createdAt: NOW_S + 200 }));
  putAll(w, NEW);
  putAll(w, K);
  const p2 = await restart(w);
  const oldLeft = () => OLD.filter((ev) => !absent(w, addr(ev))).length;
  await within(p2, 5 * MIN, () => w.graph.rows.size === 9000 && oldLeft() === 0, 'the whole backlog (9,000 created, 1,000 removed) is reflected within 5 minutes of the start', 250);
  const wrong = NEW.filter((ev) => !holdsId(w, ev));
  assert(wrong.length === 0, `${wrong.length} of the 9,000 are missing or record another version, e.g. ${preview(wrong.slice(0, 3).map(addr))}`);
  await drive(p2, 15 * SEC, 500);
  eq(at(statusOf(p2), 'catchUp.last.outcome'), 'done', `the status says the catch-up is done (AC-6)\n        ${diag(p2)}`);
});

/* ═════════════════════════════════════════════════════ AC-5 ═════════════════════════════════════════════════════ */

test('RE38: while busy, the switch going off — or becoming unreadable, or missing — or a SIGTERM makes tick() answer { exit: 0 } within 5 s; no write starts after that, and the status says off or stopped, its subscription no longer connected (AC-5 "off means off"; ADR "Off means off within 5 s", "a missing or unreadable switch.json reads as off"; T29 "handleSignal(\'SIGTERM\') leads to { exit: 0 } within 5 s"; A1-18 "After a stop, the final status says subscription.connected: false")', async () => {
  await cases([
    { name: 'turned off', set: (w) => w.store.setSwitch(false) },
    { name: 'switch.json unreadable', set: (w) => { w.store.switch = { unreadable: true }; } },
    { name: 'switch.json removed', set: (w) => { w.store.switch = null; } },
    { name: 'a SIGTERM (a deploy)', set: (w, proc) => H.guarded(() => proc.engine.handleSignal('SIGTERM'), "handleSignal('SIGTERM')") },
  ], async (c) => {
    const w = newWorld();
    const proc = await boot(w);
    putAll(w, F.manyTaggings(300, { prefix: 're38', over: (i) => ({ author: pubkeyOf(`re38:${i % 30}`), createdAt: NOW_S }) }));
    await drive(proc, 300, 50); // rounds under way
    const offAt = w.clock.t;
    await c.set(w, proc);
    const r = await drive(proc, 5 * SEC, 50);
    eq(r.exit, 0, `tick() answers { exit: 0 } within 5 s\n        ${diag(proc)}`);
    const exitSeq = proc.exited.seq;
    assert(w.clock.t - offAt <= 5 * SEC, `exit ${w.clock.t - offAt} ms after the off`);
    await H.flush(30);
    w.clock.advance(10 * SEC);
    await H.flush(30);
    const late = w.graph.writes.filter((x) => x.seq > exitSeq);
    eq(late.length, 0, `write calls started after the exit (AC-5: "the path writes nothing more"): ${show(late.map((x) => `${x.kind}×${x.n}`))}`);
    const state = at(statusOf(proc), 'state');
    assert(state === 'off' || state === 'stopped', `the status says off (AC-5 "its status says off"; ADR state off | stopped); got ${show(state)}`);
    eq(at(statusOf(proc), 'subscription.connected'), false, 'the final status\'s subscription.connected (A1-18: "After a stop, the final status says subscription.connected: false")');
  });
});

test('RE73: with a port call hung in flight — a write that never settles — the owner turning the switch off still makes tick() answer { exit: 0 } within 5 s: an in-flight port call gets up to 2 s, not more (AC-5 "off means off"; ADR "Off means off within 5 s": "gives an in-flight port call up to 2 s")', async () => {
  const w = newWorld();
  const proc = await boot(w);
  let hung = false;
  w.graph.beforeApply = () => { hung = true; return new Promise(() => {}); };
  put(w, tg('re73-x', { createdAt: NOW_S }));
  await within(proc, MIN, () => hung, 'fixture: a write is in flight and never settles', 100);
  w.store.setSwitch(false);
  const r = await drive(proc, 5 * SEC, 500);
  eq(r.exit, 0, `tick() answers { exit: 0 } within 5 s of the switch going off, a write hung in flight\n        ${diag(proc)}`);
});

test('RE39: ADR 0002 residual 1 ("in place") — the relay goes v1 → v2 → v2 revoked by id → v1 re-sent while a pass runs, the path rewrites the relationship back to exactly v1, the pass\'s verify therefore passes and it writes its v2 read — is repaired within 60 s of the pass ending (AC-5 "alongside the pass"; ADR 0003 D6 "a post-pass re-look")', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const V1 = tg('re39-v', { createdAt: NOW_S });
  put(w, V1);
  await within(proc, MIN, () => reflects(w, V1), 'fixture: v1 is created');
  w.passStart(PASS_RUN); // the pass reads the graph: v1
  await drive(proc, 2 * SEC, 100);
  const V2 = version(V1, 're39-v:v2', { polarity: '-1' });
  put(w, V2);
  await within(proc, MIN, () => reflects(w, V2), 'the path writes v2 while the pass runs (AC-1: the minute holds during a pass)');
  // … the pass reads the relay: v2 …
  put(w, del('re39-k', { e: [V2.id] }));
  put(w, V1); // v1 re-sent: only v2's id is blocked
  await within(proc, MIN, () => reflects(w, V1), 'the path follows the relay back to v1 (an update in place)');
  // … the pass's verify matches what it read, so it writes v2 in place.
  w.passWrite(F.contractEdge(V2), { keepRid: true });
  await drive(proc, 2 * SEC, 100);
  w.passEnd(PASS_RUN);
  await within(proc, MIN, () => reflects(w, V1), 'within 60 s of the pass ending the graph again holds the relay\'s version (v1)');
});

test('RE40: ADR 0002 residual 2 ("create after delete") — a pass that read nothing at an address creates v1 there after the path created it and then removed it on the author\'s address revoke — sees it removed again within 60 s of the pass ending (AC-5; ADR 0003 D6: the revoke prompt is kept for the re-look)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  w.passStart(PASS_RUN); // the pass reads the graph: nothing at A
  await drive(proc, 2 * SEC, 100);
  const X = tg('re40-x', { createdAt: NOW_S });
  put(w, X); // … and then the relay: v1
  await within(proc, MIN, () => reflects(w, X), 'the path creates v1 while the pass runs');
  put(w, del('re40-k', { a: [addr(X)], createdAt: NOW_S + 5 }));
  await within(proc, MIN, () => absent(w, addr(X)), 'the address revoke is reflected while the pass runs');
  await drive(proc, 2 * SEC, 100);
  w.passWrite(F.contractEdge(X)); // the pass's create-if-absent finds nothing and creates v1
  await drive(proc, 2 * SEC, 100);
  w.passEnd(PASS_RUN);
  await within(proc, MIN, () => absent(w, addr(X)), 'within 60 s of the pass ending the relationship is gone again');
});

/** RE68–RE70's fixture: a pass runs, and X is created by a round that overlaps it. → X */
async function createdDuringPass(w, proc, name) {
  w.passStart(PASS_RUN);
  await drive(proc, SEC, 100);
  const X = tg(name, { createdAt: NOW_S });
  put(w, X);
  await within(proc, MIN, () => reflects(w, X), 'fixture: X is created while the pass runs');
  return X;
}

test('RE68: a round that overlaps a live pass journals a re-look (r) for the address it looked at, under the pass\'s run id, and the status counts it in counts.relooks (AC-5; AC-6; ADR § Coexisting with the pass "What happens after an overlap": "the path journals a re-look (r) for every address the round looked at, whether or not it wrote"; § Status counts.relooks; T19 the r line)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const X = await createdDuringPass(w, proc, 're68-x');
  await within(proc, SEC, () => journalLines(w).some((o) => o.t === 'r' && o.a === addr(X) && o.runId === PASS_RUN),
    `the round's re-look line {t:'r', a, runId} for X is in journal.jsonl within 1 s; journal tail: ${show(String(w.store.journal).slice(-300))}`, 50);
  w.passEnd(PASS_RUN);
  await drive(proc, 16 * SEC, 250); // the 5 s re-look check, its round, and a status write
  assert((num(statusOf(proc), 'counts.relooks') || 0) >= 1, `counts.relooks after a round overlapped a pass and its re-look ran: ${show(at(statusOf(proc), 'counts.relooks'))}`);
});

test('RE69: within 6 s of an overlapping pass ending, a re-look round reads again the address the overlapping round looked at — the 5 s re-look check, then a round (AC-5 "alongside the pass"; ADR § Coexisting with the pass: "every 5 s, re-looks whose pass is no longer alive are re-queued"; § Lanes and rounds: a round starts 250 ms after its first prompt)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const X = await createdDuringPass(w, proc, 're69-x');
  await drive(proc, 2 * SEC, 100);
  w.passEnd(PASS_RUN);
  const mark = w.nextSeq();
  await within(proc, 6 * SEC, () => roundsReading(w, addr(X)).some((x) => x.seq > mark), 'a re-look round reads X\'s address within 6 s of the pass ending', 100);
});

test('RE70: when a pass that overlapped a round ends, a catch-up runs within 45 s — the catch-up whose candidate scan finds a revoke of a version the pass wrote — long before the 10-minute safety diff (AC-4; AC-5; ADR § Coexisting with the pass: "when an overlapping pass ends, or is first seen dead, one coalesced catch-up is scheduled"; § The catch-up runs "when a pass that overlapped a round ends"; at most one per 30 s)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  await createdDuringPass(w, proc, 're70-x');
  await drive(proc, 2 * SEC, 100);
  const mark = w.nextSeq();
  w.passEnd(PASS_RUN);
  await within(proc, 45 * SEC, () => callsAfter(w, 'readKeys', mark).length > 0, 'a catch-up reads the graph\'s keys (its step 1) within 45 s of the pass ending', 250);
});

test('RE41: a pass that dies with endedAt null causes no endless re-look loop — once its re-looks and catch-up are done, the path reads neither the graph nor the relay while nothing changes (ADR D6 "a dead pass\'s window ends when the path first sees it dead"; T17)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  w.passStart(PASS_RUN);
  await drive(proc, SEC, 100);
  const X = tg('re41-x', { createdAt: NOW_S });
  put(w, X);
  await within(proc, MIN, () => reflects(w, X), 'X is created while the pass runs');
  w.passDie(PASS_RUN); // killed mid-run: endedAt stays null
  const Y = tg('re41-y', { createdAt: NOW_S + 30 });
  put(w, Y);
  await within(proc, MIN, () => reflects(w, Y), 'Y is created after the pass died');
  await drive(proc, 90 * SEC, 500);
  const mark = w.nextSeq();
  await hold(proc, 2 * MIN, 'two quiet minutes', 500);
  const reads = w.graph.calls.filter((x) => x.seq > mark && (x.op === 'readAt' || x.op === 'readKeys'));
  const scans = w.relay.scans.filter((x) => x.seq > mark);
  assert(reads.length === 0 && scans.length === 0, `with nothing changing, the path should go quiet; in two minutes it made ${reads.length} graph read(s) and ${scans.length} relay scan(s) — a re-look loop on the dead pass?\n        ${diag(proc)}`);
});

test('RE71: RE41 with time passing inside every round (each relay scan takes 20 ms, each graph call 5 ms): a pass that dies with endedAt null still causes no endless re-look loop — deadSeenAt stays the first time the path saw it dead, so the rounds that read the graph after it no longer overlap the pass and the path goes quiet (ADR § Coexisting with the pass: "deadSeenAt[runId] is the first time this path saw the run not alive", "a round that reads the graph after deadSeenAt cannot be overwritten by it"; T17)', async () => {
  const w = newWorld();
  w.relay.latencyMs = 20;
  w.graph.latencyMs = 5;
  const proc = await boot(w);
  w.passStart(PASS_RUN);
  await drive(proc, SEC, 100);
  const X = tg('re71-x', { createdAt: NOW_S });
  put(w, X);
  await within(proc, MIN, () => reflects(w, X), 'X is created while the pass runs');
  w.passDie(PASS_RUN); // killed mid-run: endedAt stays null
  const Y = tg('re71-y', { createdAt: NOW_S + 30 });
  put(w, Y);
  await within(proc, MIN, () => reflects(w, Y), 'Y is created after the pass died');
  await drive(proc, 90 * SEC, 500);
  const mark = w.nextSeq();
  await hold(proc, 2 * MIN, 'two quiet minutes', 500);
  const reads = w.graph.calls.filter((x) => x.seq > mark && (x.op === 'readAt' || x.op === 'readKeys'));
  const scans = w.relay.scans.filter((x) => x.seq > mark);
  assert(reads.length === 0 && scans.length === 0, `with nothing changing, the path should go quiet; in two minutes it made ${reads.length} graph read(s) and ${scans.length} relay scan(s) — deadSeenAt moved with every round, so each round overlapped the dead pass again?\n        ${diag(proc)}`);
});

test('RE72: a pass already dead with endedAt null when a process starts is recorded as seen dead at that start — the deadSeenAt a restart would restore (the journal\'s k line, or record.json once compacted) is the time of the start\'s report read (ADR § Coexisting with the pass: "for a run already dead at Node start, it is the time of that start\'s report read"; T19 the k line; T20 "start() reads … the report (for deadSeenAt)")', async () => {
  const w = newWorld();
  const p1 = await boot(w);
  await stop(w, p1, 'signal');
  w.passStart(PASS_RUN);
  w.passDie(PASS_RUN); // killed while the path was down: endedAt stays null
  await w.advance(5 * SEC);
  const startAt = w.clock.t;
  const p2 = await restart(w);
  await drive(p2, SEC, 50); // the 250 ms journal flush (or the start's catch-up compacting it into record.json)
  eq(deadSeenPersisted(w, PASS_RUN), startAt, `the dead run's recorded deadSeenAt (journal k line or record.json); journal tail: ${show(String(w.store.journal).slice(-300))}`);
});

test('RE42: across a pass overlapping rounds, ending, and another dying, the engine never touches the pass\'s report writer, held lists, confirmations or lock, and never writes switch.json (AC-5; AC-7 "the pass\'s report, held lists and confirmations"; ADR D6 "the path never touches the pass\'s machinery"; binding 4)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  w.passStart(PASS_RUN);
  const X = tg('re42-x', { createdAt: NOW_S });
  put(w, X);
  await within(proc, MIN, () => reflects(w, X), 'X is created while a pass runs');
  put(w, del('re42-k', { e: [X.id] }));
  await within(proc, MIN, () => absent(w, addr(X)), 'X is revoked while a pass runs');
  w.passEnd(PASS_RUN);
  await drive(proc, 30 * SEC, 250);
  w.passStart(PASS_RUN_2);
  const Y = tg('re42-y', { createdAt: NOW_S + 60 });
  put(w, Y);
  await within(proc, MIN, () => reflects(w, Y), 'Y is created while the second pass runs');
  w.passDie(PASS_RUN_2);
  await drive(proc, MIN, 500);
  const forbidden = /report|held|confirm|prune|lock|lease|heavy/i;
  const touched = w.stateAccess.filter((k) => forbidden.test(k) && k !== 'readReport');
  eq(touched.length, 0, `state members the engine reached for (only readReport, isAlive and appendPreimages are its): ${show([...new Set(w.stateAccess)])}`);
  const passLock = w.lockChecks.filter((x) => x.fd === 9 || /pass\.lock$/.test(String(x.file || '')));
  eq(passLock.length, 0, `checks of the pass's lock: ${show(passLock)}`);
  eq(w.store.switchWrites.length, 0, 'switch.json writes by the engine (only the owner route writes it)');
});

/* ═════════════════════════════════════════════════════ AC-6 ═════════════════════════════════════════════════════ */

const STATUS_KEYS = ['state', 'firstStartedAt', 'relay', 'subscription', 'lastReflectedAt', 'lastRound', 'catchUp', 'counts', 'pending', 'parked', 'seen', 'heard', 'journal', 'setupProblem', 'lastError', 'preimageFile', 'process', 'updatedAt'];
const COUNT_KEYS = ['added', 'changed', 'changedBy', 'removed', 'removedBy', 'unchanged', 'peopleAdded', 'refused', 'leftInPlace', 'deletionsMatchedNothing', 'deletionsForeign', 'failedReads', 'lostRaces', 'dbRefused', 'heldPreExisting', 'removalsNotPrompted', 'relooks', 'conflicts', 'droppedOverBacklog'];
const STATES = ['off', 'starting', 'waiting-setup', 'waiting-graph', 'waiting-relay', 'catching-up', 'live', 'stopped'];

test('RE43: the status carries every field the ADR lists — state, times, the relay and subscription, the catch-up, every count by its keys, the setup problem and the last error — and within 60 s its counts reflect an addition, a change, a removal, an unchanged look, a refused version, a person added and a deletion that matched nothing (AC-6; ADR § Status and switch)', async () => {
  const w = newWorld();
  const P = tg('re43-p');
  put(w, P);
  backfill(w, P);
  const proc = await boot(w);
  const NEWP = pubkeyOf('re43:new-person');
  const X = tg('re43-x', { target: NEWP, createdAt: NOW_S });
  const Pv2 = version(P, 're43-p:v2', { polarity: '-1' });
  const U = tg('re43-u', { createdAt: NOW_S });
  const RF = F.makeNonTagging({ address: `39999:${ALICE}:re43-refused`, refusal: 'no-target', id: idOf('re43:refused'), createdAt: NOW_S });
  put(w, X, Pv2, U, RF, del('re43-nothing', { e: [idOf('re43:never-held')] }));
  backfill(w, U); // the pass wrote U first: the path's look finds it unchanged
  await within(proc, MIN, () => reflects(w, X) && reflects(w, Pv2), 'fixture: the addition and the change are written');
  const L = tg('re43-l', { createdAt: NOW_S + 10 });
  put(w, L);
  await within(proc, MIN, () => reflects(w, L), 'fixture: L is created');
  put(w, del('re43-revoke', { e: [L.id] }));
  await within(proc, MIN, () => absent(w, addr(L)), 'fixture: L is revoked');
  const want = {
    'counts.added': 2, 'counts.changed': 1, 'counts.removed': 1, 'counts.unchanged': 1, 'counts.peopleAdded': 1,
    'counts.refused.total': 1, 'counts.deletionsMatchedNothing': 1,
  };
  const short = () => { const s = statusOf(proc); return Object.keys(want).filter((k) => !((num(s, k) || 0) >= want[k])).map((k) => `${k} ≥ ${want[k]} (is ${show(at(s, k))})`); };
  await withinAll(proc, MIN, short, 'the counts reflect the work within 60 s', 250);
  const st = statusOf(proc);
  assert(((at(st, 'counts.refused.byReason') || {})['no-target'] || 0) >= 1, `counts.refused.byReason names the reason; got ${show(at(st, 'counts.refused'))}`);
  const missing = STATUS_KEYS.filter((k) => !has(st, k));
  assert(missing.length === 0, `status.json lacks ${show(missing)} (ADR § Status); it has ${show(Object.keys(st))}`);
  const notNumbers = ['pending', 'parked', 'seen', 'heard'].filter((k) => typeof st[k] !== 'number');
  assert(notNumbers.length === 0, `status.json's pending, parked, seen and heard are numbers (T29); got ${show(notNumbers.map((k) => [k, st[k]]))}`);
  const missingCounts = COUNT_KEYS.filter((k) => !has(st.counts, k));
  assert(missingCounts.length === 0, `status.counts lacks ${show(missingCounts)} (AC-6; ADR § Status); it has ${show(Object.keys(st.counts || {}))}`);
  const nested = [
    ['relay', ['lastReadOkAt']], ['subscription', ['connected', 'since', 'lastEventAt']], ['catchUp', ['underway', 'last']],
    ['journal', ['bytes', 'skippedLines']], ['process', ['pid', 'startTime', 'startedAt']],
    ['counts.changedBy', ['newer', 'older', 'moved', 'refreshed', 'repaired']], ['counts.refused', ['total', 'byReason']],
    ['counts.leftInPlace', ['total', 'byReason']], ['counts.failedReads', ['relay', 'graph', 'element', 'catchUp']],
    ['counts.lostRaces', ['create', 'update', 'move', 'remove']], ['counts.dbRefused', ['total', 'byReason']],
  ];
  const holes = [];
  for (const [p, keys] of nested) for (const k of keys) if (!has(at(st, p), k)) holes.push(`${p}.${k}`);
  assert(holes.length === 0, `status lacks ${show(holes)} (ADR § Status)`);
  assert(STATES.includes(st.state), `status.state is one of ${show(STATES)}; got ${show(st.state)}`);
  assert(st.relay.lastReadOkAt !== null && st.lastReflectedAt !== null, `after reading the relay and reflecting changes, relay.lastReadOkAt and lastReflectedAt are set; got ${show({ lastReadOkAt: st.relay.lastReadOkAt, lastReflectedAt: st.lastReflectedAt })}`);
  eq(st.setupProblem, null, 'setupProblem with a good setup');
  same({ pid: st.process.pid, startTime: st.process.startTime }, { pid: proc.deps.proc.pid, startTime: proc.deps.proc.startTime }, 'status.process names this process (deps.proc)');
  assert(typeof st.process.startedAt === 'string' && Number.isFinite(Date.parse(st.process.startedAt)), `status.process.startedAt is an ISO time (T32); got ${show(st.process.startedAt)}`);
  let fromEngine;
  try { fromEngine = proc.engine.status(); } catch (e) { throw new Error(`status() threw: ${firstLine(e)}`); }
  same(H.jcopy(fromEngine), w.store.status, 'status() returns the object last written to status.json (T20)');
});

test('RE44: while running, the status is rewritten at least every 30 s — updatedAt is never more than 30 s old over two idle minutes (AC-6 "every figure covers the path\'s work up to at most 1 minute earlier"; ADR "a 30 s heartbeat while running")', async () => {
  const w = newWorld();
  const proc = await boot(w);
  let worst = 0;
  const bad = [];
  await hold(proc, 150 * SEC, 'idle', 1000, () => {
    const s = statusOf(proc);
    const t = s && typeof s.updatedAt === 'string' ? Date.parse(s.updatedAt) : NaN;
    if (!Number.isFinite(t) || new Date(t).toISOString() !== s.updatedAt) { if (bad.length < 3) bad.push(show(s && s.updatedAt)); return; }
    worst = Math.max(worst, w.clock.t - t);
  });
  assert(bad.length === 0, `status.updatedAt must be an ISO time (T29: "updatedAt (ISO)"; T22 reads Date.parse(status.updatedAt)); got ${bad.join(', ')}`);
  assert(worst <= 31 * SEC, `status.updatedAt was ${worst} ms old at worst (at most 30 s, sampled every second)`);
});

test('RE45: the status never shows a credential or where the database or the relay is reached — for a relay failure whose stderr names redis:6379 and a config path, a graph error whose message carries a URI with a password, host:port, [::1]:port and a path, and a refused write naming the URI — its last error is fixed text and its code passes the allow-list (\'error\' otherwise) (AC-6 "what it never shows"; ADR "all text is fixed"; story CF-3 cases)', async () => {
  const w = newWorld();
  const proc = await boot(w);
  const FORBIDDEN = [H.NEO4J_URI, 'bolt://', 'neo4j.internal', ':7687', '[::1]', '/var/lib', 'debug.log', H.PASSWORD, 'hunter2',
    H.RELAY_URL, 'relay.fake.invalid', ':7777', 'redis:6379', '/etc/strfry', 'ECONNREFUSED', 'Could not perform discovery'];
  const seen = new Set();
  // Every string in the status (keys included), so a number that happens to read 7687 is never mistaken for a port.
  const stringsOf = (v, out = []) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => stringsOf(x, out));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); stringsOf(x, out); }
    return out;
  };
  const sample = () => {
    for (const s of stringsOf(statusOf(proc))) for (const f of FORBIDDEN) if (s.includes(f)) seen.add(f);
  };
  // 1. a relay read failing, its stderr naming the follows Redis and a config path
  w.relay.scanFail = () => 'exit';
  put(w, tg('re45-a', { createdAt: NOW_S }));
  await within(proc, MIN, () => { sample(); return !!at(statusOf(proc), 'lastError'); }, 'a relay failure sets lastError', 250);
  eq(at(statusOf(proc), 'lastError.code'), 'exit', "a ScanError code passes the allow-list (ADR: 'the ScanError codes')");
  w.relay.scanFail = null;
  // 2. a graph read failing with a code outside the allow-list and a message full of addresses
  const leaky = `connect ECONNREFUSED ${H.NEO4J_URI.replace('bolt://', 'bolt://neo4j:hunter2@')} via neo4j.internal:7687 and [::1]:7687; see /var/lib/neo4j/logs/debug.log (password ${H.PASSWORD})`;
  w.graph.failReads = (op) => (op === 'readAt' ? H.neoError('neo4j.internal', leaky) : null);
  put(w, tg('re45-b', { createdAt: NOW_S + 1 }));
  await within(proc, MIN, () => { sample(); return at(statusOf(proc), 'lastError.code') === 'error'; },
    "a code outside the allow-list is shown as 'error' (ADR: allowErrorCode; the routes' test pins err.code = 'neo4j.internal')", 250);
  w.graph.failReads = null;
  // 3. a write refused with an allow-listed code, its message naming the URI
  const CODE = 'Neo.ClientError.Statement.SyntaxError';
  w.graph.failWrites = () => H.neoError(CODE, `Invalid input near ${H.NEO4J_URI} (neo4j.internal:7687)`);
  put(w, tg('re45-c', { createdAt: NOW_S + 2 }));
  await within(proc, MIN, () => { sample(); return at(statusOf(proc), 'lastError.code') === CODE; }, 'an allow-listed Neo4j code is shown as itself', 250);
  w.graph.failWrites = null;
  await drive(proc, 30 * SEC, { step: 500, each: sample });
  const le = at(statusOf(proc), 'lastError');
  assert(!le || typeof le.text === 'string', `lastError.text is text; got ${show(le)}`);
  eq([...seen].length, 0, `the status showed ${show([...seen])} at some point (AC-6: no credential, URI, host name, IP or port, error text included)`);
});

test('RE46: the status\'s counts survive a restart — the next process continues from them, with the same firstStartedAt (AC-6 "it survives restarts and deploys"; ADR "counts since firstStartedAt")', async () => {
  const w = newWorld();
  const p1 = await boot(w);
  const A = [0, 1, 2].map((i) => tg(`re46-a${i}`, { createdAt: NOW_S, author: pubkeyOf(`re46:${i}`) }));
  putAll(w, A);
  await within(p1, MIN, () => (num(statusOf(p1), 'counts.added') || 0) >= 3, 'the first process counts three additions');
  const firstStartedAt = at(statusOf(p1), 'firstStartedAt');
  await stop(w, p1, 'signal');
  const p2 = await restart(w);
  const B = tg('re46-b', { createdAt: NOW_S + 100 });
  put(w, B);
  await within(p2, 5 * MIN, () => reflects(w, B) && (num(statusOf(p2), 'counts.added') || 0) >= 4,
    'the next process counts on from the first (≥ 4 additions)', 250);
  eq(at(statusOf(p2), 'firstStartedAt'), firstStartedAt, 'firstStartedAt after the restart');
  assert(!at(statusOf(p2), 'counts.countsReset'), 'countsReset is set only when status.json was lost');
});

test('RE79: the status\'s seen is the size of S, and heard counts the addresses whose latest learned version is not in S — three taggings in the first start\'s baseline, and two addresses heard while the graph is unavailable (so not yet completed), one of them in two versions, give seen 3 and heard 2 (AC-6; A1-1 "heard becomes the number of addresses whose top is not in S, kept as a counter"; ADR § Status "seen (the size of S)"; T29 numbers)', async () => {
  const w = newWorld();
  put(w, tg('re79-a'), tg('re79-b'), tg('re79-c'));
  const proc = await boot(w);
  w.graph.down = true;
  const N1 = tg('re79-n1', { createdAt: NOW_S });
  put(w, N1, tg('re79-n2', { createdAt: NOW_S }));
  await drive(proc, SEC, 250);
  put(w, version(N1, 're79-n1:v2', { polarity: '-1' })); // a second version at the first address: still one address
  await drive(proc, 11 * SEC, 250); // status.json is rewritten within 10 s of any change
  const st = statusOf(proc);
  same({ seen: num(st, 'seen'), heard: num(st, 'heard') }, { seen: 3, heard: 2 }, 'status seen = |S| (the three baseline ids) and heard = the addresses whose top is not in S (two addresses, three versions heard; A1-1)');
});

/* ═════════════════════════════════════════════════════ AC-7 ═════════════════════════════════════════════════════ */

test('RE47: every write goes through the port\'s applyCreates / applyLocked in calls of at most 25 rows sorted by (from, to) — creates, updates and moves by the desired edge\'s ends, removals by the snapshot\'s (T29); each row\'s edge is exactly the contract\'s (nothing outside its keys); every row names a tagging address; relationships left in place are untouched; no DDL and no other port member (AC-7; ADR § What it decides step 6; ADR 0002 C16)', async () => {
  const w = newWorld();
  const EL = F.makeElement({ id: idOf('re47:el'), d: 're47-tag' });
  put(w, EL);
  const leftMissing = F.storedRow(F.contractEdge(tg('re47-left-missing')), { address: null, rid: '5:left:missing' });
  const leftNonTagging = F.storedRow(F.contractEdge(tg('re47-left-nontag')), { nonTaggingAddress: true, rid: '5:left:nontag' });
  w.graph.putRow(leftMissing);
  w.graph.putRow(leftNonTagging);
  const leftBefore = w.graph.others.map((r) => H.fingerprint(r));
  const proc = await boot(w);
  const C = [];
  for (let i = 0; i < 30; i++) C.push(tg(`re47-c${i}`, { author: pubkeyOf(`re47:a${(i * 7) % 11}`), target: [BOB, CAROL, ALICE][i % 3], createdAt: NOW_S + i }));
  C.push(tg('re47-idonly', { a: null, e: EL.id, createdAt: NOW_S }));
  // Two taggings by one author whose moves reverse their order: by the snapshot's ends A < B, by the desired edge's B < A.
  const MOVER = pubkeyOf('re47:mover');
  const PEOPLE = [0, 1, 2, 3].map((i) => pubkeyOf(`re47:mover-target${i}`)).sort();
  const MV = [tg('re47-mva', { author: MOVER, target: PEOPLE[0], createdAt: NOW_S }), tg('re47-mvb', { author: MOVER, target: PEOPLE[1], createdAt: NOW_S })];
  C.push(...MV);
  putAll(w, C);
  await within(proc, MIN, () => C.every((ev) => reflects(w, ev, [EL])), 'phase 1: 31 creates are reflected');
  const U = C.slice(0, 10).map((ev, i) => version(ev, `re47-c${i}:v2`, { polarity: '-1' }));
  const M = C.slice(10, 15).map((ev, i) => version(ev, `re47-c${10 + i}:v2`, { target: pubkeyOf(`re47:moved${i}`) }));
  const revoked = C.slice(15, 25);
  const byAuthor = new Map();
  for (const ev of revoked) byAuthor.set(ev.pubkey, (byAuthor.get(ev.pubkey) || []).concat([ev.id]));
  const K = [...byAuthor.entries()].map(([author, ids], i) => del(`re47-k${i}`, { author, e: ids }));
  M.push(version(MV[0], 're47-mva:v2', { target: PEOPLE[3] }), version(MV[1], 're47-mvb:v2', { target: PEOPLE[2] }));
  const nonTagAddress = H.propAddress(leftNonTagging);
  putAll(w, U.concat(M, K, [del('re47-nontag', { a: [nonTagAddress] })]));
  await within(proc, MIN, () => U.every((ev) => reflects(w, ev)) && M.every((ev) => reflects(w, ev)) && revoked.every((ev) => absent(w, addr(ev))),
    'phase 2: 10 updates, 7 moves and 10 revokes are reflected');
  await drive(proc, 10 * SEC, 500);
  const problems = [];
  for (const rec of w.graph.writes) {
    const rows = Array.isArray(rec.rows) ? rec.rows : [];
    if (rows.length > 25) problems.push(`a ${rec.kind} call carried ${rows.length} rows (at most 25)`);
    if (rows.length > 1 && !sortedByEnds(rec.kind, rows)) problems.push(`a ${rec.kind} call's rows are not sorted by (from, to): ${preview(rows.map((r) => (rowEnds(r, 'desired') || rowEnds(r, 'snapshot') || []).map((x) => String(x).slice(0, 6)).join('>')))}`);
    for (const row of rows) {
      if (!H.isTaggingAddress(row.address)) problems.push(`a ${rec.kind} row names ${show(row.address)}, not a tagging address`);
      if (rec.kind === 'remove') continue;
      const extra = Object.keys(row.desired || {}).filter((k) => !F.EDGE_KEYS.includes(k));
      if (extra.length) problems.push(`a ${rec.kind} row's edge carries keys outside the contract's: ${show(extra)} (AC-7: no bookkeeping value)`);
      const held = rec.relayAt && rec.relayAt[row.address];
      if (held && edgeText(row.desired) !== edgeText(expectEdge(held, [EL]))) {
        problems.push(`a ${rec.kind} row for ${row.address.slice(0, 20)}… is not the contract's edge for the relay's version:\n          expected ${edgeText(expectEdge(held, [EL]))}\n          got      ${edgeText(row.desired)}`);
      }
    }
  }
  if (w.graph.violations.length) problems.push(`port violations: ${preview(w.graph.violations)}`);
  if (w.graph.ddl.length) problems.push(`DDL calls: ${show(w.graph.ddl.map((x) => x.op))} (the path never issues DDL)`);
  if (w.graph.unknownAccess.length) problems.push(`port members outside graph.js's surface were reached for: ${show([...new Set(w.graph.unknownAccess)])}`);
  const leftAfter = w.graph.others.map((r) => H.fingerprint(r));
  if (show(leftAfter) !== show(leftBefore)) problems.push('a relationship whose address is missing or not a tagging address changed (AC-7: left in place)');
  assert(problems.length === 0, problems.join('\n        '));
  assert(w.graph.writes.some((x) => x.kind === 'create' && x.n > 1), 'fixture: the burst produced a multi-row create call');
  assert(w.graph.writes.some((x) => x.kind === 'move' && x.addresses.includes(addr(MV[0])) && x.addresses.includes(addr(MV[1]))),
    'fixture: the two moves by one author went in one call, so the order of their rows was checked');
});

test('RE48: before a write drops a key outside the nine, the relationship\'s pre-image is appended under the path\'s session id (run-id grammar) with writer \'realtime\'; the rewritten relationship carries only the nine (AC-7; ADR 0002 "the pre-image line shape" as amended; ADR § What it decides step 6)', async () => {
  const w = newWorld();
  const P = tg('re48-p');
  put(w, P);
  w.graph.putEdge(F.contractEdge(P), { rowOpts: { extra: { score: 7, applied: true } } });
  const proc = await boot(w);
  const P2 = version(P, 're48-p:v2', { polarity: '-1' });
  put(w, P2);
  await within(proc, MIN, () => reflects(w, P2), 'the new version is written');
  const write = w.graph.writes.find((x) => x.result && x.addresses.includes(addr(P)));
  const pre = w.preimages.filter((p) => (p.records || []).some((r) => r && r.address === addr(P)));
  assert(pre.length >= 1, `a pre-image naming ${addr(P).slice(0, 20)}… is appended (state.appendPreimages); calls: ${show(w.preimages.map((p) => ({ runId: p.runId, n: p.records.length })))}`);
  assert(pre[0].seq < write.commitSeq, 'the pre-image is appended before the write commits');
  assert(H.RUN_ID_RE.test(pre[0].runId) && pre[0].runId.endsWith(`-${H.RANDOM_ID}`), `the session id is makeRunId's (RUN_ID_RE, deps.randomId); got ${show(pre[0].runId)}`);
  const rec = pre[0].records.find((r) => r.address === addr(P));
  eq(rec.writer, 'realtime', 'the pre-image record\'s writer');
  const keys = w.graph.rows.get(addr(P)).props.map((p) => p[0]);
  const extra = keys.filter((k) => !F.PROPERTY_KEYS.includes(k));
  eq(extra.length, 0, `keys outside the nine after the write: ${show(extra)}`);
});

test('RE53: the catch-up reads the graph\'s keys as plain { address, eventId } rows and ignores those whose address is missing or not a tagging address — even when the author has revoked the version they record, no scan, graph read or write names them, and they stay untouched (AC-7 "left in place"; T30)', async () => {
  const w = newWorld();
  const NT = tg('re53-nontag');
  const MS = tg('re53-missing');
  const leftNonTagging = F.storedRow(F.contractEdge(NT), { nonTaggingAddress: true, rid: '5:left:nontag' });
  const leftMissing = F.storedRow(F.contractEdge(MS), { address: null, rid: '5:left:missing' });
  w.graph.putRow(leftNonTagging);
  w.graph.putRow(leftMissing);
  const nonTagAddress = H.propAddress(leftNonTagging);
  const before = w.graph.others.map((r) => H.fingerprint(r));
  const p1 = await boot(w);
  await stop(w, p1, 'signal');
  // While the path is down, the author revokes both recorded versions by id (the relay never held them).
  const Z = tg('re53-z', { createdAt: NOW_S + 60 });
  put(w, del('re53-k', { e: [NT.id, MS.id] }), Z);
  const p2 = await restart(w);
  await within(p2, 5 * MIN, () => reflects(w, Z) && at(statusOf(p2), 'catchUp.last.outcome') === 'done', 'fixture: the restart\'s catch-up completes', 250);
  await drive(p2, 30 * SEC, 500);
  assert(w.graph.calls.some((x) => x.proc === p2.n && x.op === 'readKeys'), 'fixture: the catch-up read the graph\'s keys');
  const names = (v) => { const t = JSON.stringify(v === undefined ? null : v); return t.includes(nonTagAddress) || t.includes(NT.id) || t.includes(MS.id); };
  const scans = w.relay.scans.filter((x) => x.proc === p2.n && names(x.filter));
  const reads = w.graph.calls.filter((x) => x.proc === p2.n && x.op === 'readAt' && Array.isArray(x.addresses) && x.addresses.some((a) => !H.isTaggingAddress(a)));
  const writes = w.graph.writes.filter((x) => x.addresses.some((a) => !H.isTaggingAddress(a)));
  same({ scans: scans.length, reads: reads.length, writes: writes.length, violations: w.graph.violations },
    { scans: 0, reads: 0, writes: 0, violations: [] }, 'what named a row whose address is missing or not a tagging address (T30: the engine ignores those rows)');
  eq(show(w.graph.others.map((r) => H.fingerprint(r))), show(before), 'the relationships left in place are untouched');
});

// ─── bounded memory: RE58's child process ──────────────────────────────────────────────────────────────────────
const CHILD_FLAG = '--re58-child';
const CHILD_HEAP_MB = 160;
const CHILD_TIMEOUT_MS = 180000;

/** A kind-5 of about 131,000 bytes of JSON (strfry's websocket event size), naming 1,815 ids. */
function maxSizeKind5Json(i) {
  const tags = [];
  for (let j = 0; j < 1815; j++) tags.push(['e', (i * 100000 + j).toString(16).padStart(64, '0')]);
  return JSON.stringify({ id: idOf(`re58j:k5:${i}`), pubkey: ALICE, created_at: NOW_S, kind: 5, tags, content: 'revoked', sig: H.SIG });
}

/** The scenarios RE58 runs in a child process (lean fakes; ~130 KB events share one padding string). */
const CHILD = {
  async burst() {
    const w = newWorld({ lean: true });
    w.graph.keepRows = false;
    w.keepScanFilters = false;
    const proc = await boot(w);
    const evs = F.manyTaggings(200, { prefix: 're58-burst', over: (i) => ({ author: pubkeyOf(`re58:b${i % 20}`), target: i % 2 ? BOB : CAROL, createdAt: NOW_S }) }).map(padded);
    putAll(w, evs);
    await withinAll(proc, 5 * MIN, () => evs.filter((ev) => !holdsId(w, ev)).map(addr), 'all 200 are reflected within 5 minutes', 250);
    const wrong = evs.filter((ev) => !reflects(w, ev));
    assert(wrong.length === 0, `${wrong.length} relationship(s) differ from the contract's, e.g. ${preview(wrong.slice(0, 3).map(addr))}`);
    return { reflected: evs.length };
  },
  async 'multi-d'() {
    const w = newWorld({ lean: true });
    w.graph.keepRows = false;
    w.keepScanFilters = false;
    const AU = pubkeyOf('re58:flooder');
    const T = tg('re58-target', { author: AU, createdAt: NOW_S - 100 });
    put(w, T);
    backfill(w, T);
    const proc = await boot(w);
    // Each flood event is a tagging at its own address (first d) that also carries the target's d: '#d' matches any d.
    const FLOOD = [];
    for (let i = 0; i < 200; i++) {
      FLOOD.push(padded(F.makeTagging({ author: AU, d: `re58-md-${i}`, extraDTags: [firstD(T)], target: CAROL, id: idOf(`re58:md:${i}`), createdAt: NOW_S + i })));
    }
    const T2 = version(T, 're58-target:v2', { polarity: '-1', createdAt: NOW_S + 300 });
    const Y = tg('re58-y', { author: CAROL, createdAt: NOW_S });
    putAll(w, FLOOD.concat([T2, Y]));
    await withinAll(proc, 5 * MIN, () => FLOOD.concat([Y]).filter((ev) => !holdsId(w, ev)).map(addr),
      'each multi-d event is reflected at its own address, and another author\'s tagging too, within 5 minutes', 250);
    await drive(proc, MIN, 500);
    assert(reflects(w, T), `the flooded address keeps its relationship: its read passes 8 MiB, fails (too-large) and changes nothing (AC-3); graph now ${edgeText(w.graph.edgeAt(addr(T)))}`);
    assert((num(statusOf(proc), 'counts.failedReads.relay') || 0) >= 1, `the failed read of the flooded address is counted; got ${show(at(statusOf(proc), 'counts.failedReads'))}`);
    return { reflected: FLOOD.length + 1 };
  },
  async journal() {
    const w = newWorld({ lean: true });
    const V1 = tg('re58j-v', { createdAt: NOW_S - 900 });
    put(w, V1);
    backfill(w, V1);
    const p1 = await boot(w);
    await stop(w, p1, 'signal');
    const V2 = version(V1, 're58j-v:v2', { polarity: '-1' });
    put(w, V2, del('re58j-k', { e: [V2.id] })); // V2 replaces V1, then Alice revokes V2: the relay holds nothing there
    // After what the first process journaled: 300 lines as long as a max-size kind-5 (a raw event, which no journal
    // line type carries: an unknown t), then A1-6's absolute v line for V2 heard at the address: the lineage it sets is
    // exactly {top V2, older [V1]}, as the first process would have journaled it (its baseline scan made V1 the top).
    // Only that line ties V2 to the address.
    const lines = [];
    for (let i = 0; i < 300; i++) lines.push(maxSizeKind5Json(i));
    lines.push(JSON.stringify({ t: 'v', id: V2.id, a: addr(V1), top: V2.id, older: [V1.id] }));
    w.store.journal = `${w.store.journal}${lines.join('\n')}\n`;
    lines.length = 0;
    const p2 = await restart(w);
    let skipped = 0;
    const sample = () => { skipped = Math.max(skipped, num(statusOf(p2), 'journal.skippedLines') || 0); };
    await within(p2, 5 * MIN, () => { sample(); return absent(w, addr(V1)); },
      'the absolute v line after the 300 long lines (A1-6) lets the catch-up find the revoke of its top and remove the relationship recording the older V1 (A1-9 step 3; A1-4 clause (ii)) within 5 minutes of the start', 250);
    await drive(p2, 5 * SEC, { step: 500, each: sample });
    eq(skipped, 300, 'status journal.skippedLines (T19: a line with an unknown t is skipped and counted)');
    return { skippedLines: skipped };
  },
};

/** Run one RE58 scenario in a child Node process with a 160 MB heap; throws what went wrong. */
function runChild(scenario) {
  const r = childProcess.spawnSync(process.execPath, [`--max-old-space-size=${CHILD_HEAP_MB}`, __filename, CHILD_FLAG, scenario], {
    encoding: 'utf8', timeout: CHILD_TIMEOUT_MS, maxBuffer: 16 * MiB, env: process.env,
  });
  const out = String(r.stdout || '');
  const err = String(r.stderr || '');
  const tail = err.split('\n').filter(Boolean).slice(-4).join(' | ');
  if (r.error && r.error.code === 'ETIMEDOUT') throw new Error(`the child did not finish within ${CHILD_TIMEOUT_MS / 1000} s of real time`);
  if (/heap out of memory|Allocation failed/i.test(err)) {
    throw new Error(`the child ran out of memory with --max-old-space-size=${CHILD_HEAP_MB} (status ${r.status}, signal ${r.signal}): ${tail}`);
  }
  const line = out.split('\n').reverse().find((l) => l.startsWith('RE58-RESULT '));
  if (!line) throw new Error(`the child ended (status ${r.status}, signal ${r.signal}) without a result line; stderr: ${tail || '(empty)'}`);
  const res = JSON.parse(line.slice('RE58-RESULT '.length));
  if (!res.ok) throw new Error(`in the child (peak heap ${res.peakHeapMB} MB): ${res.error}`);
  return res;
}

/** The child side: run one scenario, print one RE58-RESULT line, exit 0 (ok) or 1. */
async function childMain(scenario) {
  const onUnhandled = (reason) => { H.strays.push(`unhandled rejection: ${firstLine(reason)}`); };
  process.on('unhandledRejection', onUnhandled);
  let peak = 0;
  const sampler = setInterval(() => { peak = Math.max(peak, process.memoryUsage().heapUsed); }, 25);
  let res;
  try {
    const fn = CHILD[scenario];
    if (typeof fn !== 'function') throw new Error(`no RE58 scenario ${JSON.stringify(scenario)}`);
    const out = await fn();
    if (H.strays.length) throw new Error(`the engine left ${H.strays.length} unhandled error(s): ${preview(H.strays)}`);
    res = Object.assign({ ok: true }, out);
  } catch (e) {
    res = { ok: false, error: e.message };
  }
  clearInterval(sampler);
  await H.killAll();
  res.peakHeapMB = Math.round(Math.max(peak, process.memoryUsage().heapUsed) / MiB);
  process.stdout.write(`RE58-RESULT ${JSON.stringify(res)}\n`, () => process.exit(res.ok ? 0 : 1));
}

// ─── run ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- tagging-edges real-time engine tests (epic tagging-edges, Story 3 — the real-time path, fake deps) ---');
  let pass = 0;
  let fail = 0;
  let skipped = 0;
  const failures = [];
  const onUnhandled = (reason) => { H.strays.push(`unhandled rejection: ${firstLine(reason)}`); };
  process.on('unhandledRejection', onUnhandled);
  const realExit = process.exit;
  try {
    for (const [name, fn] of tests) {
      H.strays.length = 0;
      let exitCalled;
      process.exit = (code) => {
        exitCalled = code;
        throw new Error(`the engine called process.exit(${code}); T20: it leaves the code on tick()'s answer and deps.proc.exitCode`);
      };
      let err = null;
      try { await fn(); } catch (e) { err = e; }
      finally {
        process.exit = realExit;
        await H.killAll();
      }
      if (!err && exitCalled !== undefined) err = new Error(`process.exit(${exitCalled}) was called during the test (T20: never)`);
      if (!err && H.strays.length) err = new Error(`the engine left ${H.strays.length} unhandled error(s): ${preview(H.strays)}`);
      if (err && err.skip) {
        console.log(`  SKIP  ${name}\n        ${err.message}`);
        skipped++;
      } else if (err) {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      } else {
        console.log(`  PASS  ${name}`);
        pass++;
      }
    }
  } finally {
    process.removeListener('unhandledRejection', onUnhandled);
    process.exit = realExit;
  }
  console.log(`\ntagging-edges-realtime-engine: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

if (require.main === module) {
  if (process.argv[2] === CHILD_FLAG) {
    childMain(process.argv[3]);
  } else {
    run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
  }
}

module.exports = { run };
