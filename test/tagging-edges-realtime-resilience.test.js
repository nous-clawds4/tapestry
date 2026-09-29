'use strict';
/**
 * Tests for Story 3 (epic tagging-edges) — the real-time path's RESILIENCE under Amendment A1: time-outs and stalls,
 * the catch-up share, journal faults, replay exactness, the compaction cadence, the pass rule and the final status.
 * The engine is driven through its seam with every dependency faked, as in test/tagging-edges-realtime-engine.test.js.
 *
 * Story: engineering-team/stories/tagging-edges/3-real-time-path.md (AC-1 … AC-4, AC-6)
 * ADR:   engineering-team/decisions/tagging-edges/0003-real-time-path.md — § Amendment A1: A1-6 (record and journal: the
 *        epoch, streamed replay, the demotion at journal-unreadable, the compaction cadence), A1-7 (the pass
 *        exception), A1-11 (no start hold), A1-13 (time-outs), A1-14 (the catch-up share), A1-17 (interfaces), A1-18
 *        (settlements: the final status), and A1-20's new engine scenarios 8, 9, 10, 14 and 17. Body context: § Failure
 *        handling ("timeout (20 s per round scan)"), § Lanes and rounds, § Knowing what changed, T19, T20, T29.
 * Fakes: test/helpers/taggingEdgesRealtimeFakes.js — including its "Added for Amendment A1" controls: relay.scanWaits,
 *        relay.neverAnswers, relay.stallUntil, relay.latencyMs as the per-strfry-process cost, time-outs that cost their
 *        timeoutMs of fake time, and the journal faults (tearAppend, journalReadFailsAfter, truncateFails).
 *
 * The tests, by A1-20 scenario: RX1 (8, no start hold); RX2–RX5 (9, time-outs: one never-answering address among
 * 200, three never-answering singles, a Redis-style stall, a marked live single before lane 4); RX6 (10, the padded
 * share); RX7–RX10 (14, journal faults: prefix and torn-append replay, the demotion at journal-unreadable, a read failing
 * part-way, the epoch); RX11 (17, replay exactness over fixed seeds); then RX12 (A1-6's compaction cadence), RX13
 * (A1-7's pass exception) and RX14 (A1-18's final status). RX15 comes from the validating Tester's mutation pass over
 * the A1 reference: the read-alone mark lasts through put-backs under fresh items and through parks and unparks (A1-13,
 * A1-18) — it also found the reference losing the mark when a park left a fresh item pending. RX16–RX19 pin the ADR's
 * A1 clarifications 11 and 12 on time-out parks and singles: a catch-up does not lift a time-out park (RX16); a
 * time-out park is not counted in dbRefused (RX17); a round's marked singles are read fewest own time-outs first
 * (RX18); a live new version during the parking round lifts the park at once, keeping the mark and the park's level
 * (RX19). Clarification 11's one-single-time-out limit and per-case bounds are RX2's and RX3's; clarification 13 (the
 * pass-overlap ties) is the planner's RP53.
 *
 * Intentionally failing until A1 lands (red phase). The engine and the planner module are require()d LAZILY, through
 * load() / loadLib() inside each test, so the suite always loads and each test fails for its own reason. Against the
 * round-1 working tree (T1–T34 without A1) the failures name the A1 rule the pre-A1 behaviour breaks: a start hold, a
 * timed-out group bisected in its round, a share read with the 8 MiB cap, a record with no lineage or epoch, a replay
 * that drops the lines read before a failure, a final status that still says connected.
 *
 * Conventions, as the engine suite's: a test spawns a process (deps + createEngine), awaits start(), then drive()s it in
 * simulated time; it asserts only the bounds the ADR states, in simulated time, never how many ticks or rounds it took.
 * A round is observed from outside as the relay scans between one of its process's graph reads (readAt) and the next:
 * every round begins with one (ADR § What it decides, step 1; binding "a graph read comes before a strict relay read").
 * Time-out tests set relay.scanWaits, so a scan's cost is waited on the fake clock while ticks run and live deliveries
 * are drained, as on a host (the fakes' instant timing would run a stall's rounds back to back inside one tick).
 * Where a test stores events between ticks, it lets the deliveries reach the engine (H.flush) before the next tick, so
 * no read overtakes a notice (decision 11's delivery-after-read transient is out of these tests' scope).
 *
 * Stack-free: no Neo4j, no strfry, no network, no filesystem, no signing. Every pubkey is a fake 64-hex value from the
 * fixtures — never a deployment's TA and never the ADR 0015 literal. Node 16 and 22.
 *
 * Harness rules (run()), as the engine suite's: process.exit is trapped during each test; an unhandled rejection or a
 * subscription callback that throws fails that test; every process a test spawned is killed when it ends.
 *
 * Hand-rolled in the project's existing test style — no new framework.
 */

const path = require('path');
const F = require('./helpers/taggingEdgesFixtures');
const H = require('./helpers/taggingEdgesRealtimeFakes');

const REPO = path.resolve(__dirname, '..');
const ENGINE_REL = 'src/pipeline/tagging-edges/realtime/index.js';
const ENGINE = path.join(REPO, ENGINE_REL);
const LIB_REL = 'src/lib/tagging-edges/realtime.js';
const LIB = path.join(REPO, LIB_REL);

const { ALICE, BOB, CAROL, STAMP, CANONICAL, LOCAL, idOf, pubkeyOf } = F;
const { NOW_S, drive } = H;

const SEC = 1000;
const MIN = 60 * SEC;
const MiB = 1024 * 1024;
/** ADR § Failure handling: "timeout (20 s per round scan)". A1-13's bounds are counted in these. */
const ROUND_SCAN_TIMEOUT_MS = 20 * SEC;
/** A1-14: the catch-up share's budget, one fifth of the round's kept budget (3.2 MiB). */
const SHARE_BYTES = H.ROUND_KEPT_BYTES / 5;
/** T2 LIMITS.journalCompactBytes (1 MB); A1-6's cadence is the larger of it and a quarter of record.json. */
const JOURNAL_COMPACT_BYTES = 1048576;
/** Content padding that makes a tagging about 100 KB of JSON (within strfry's websocket event size). */
const PAD_100K = 'p'.repeat(100 * 1024);
/** Content padding that makes a tagging about 50 KB of JSON. */
const PAD_50K = 'q'.repeat(50 * 1024);
const PASS_RUN = '20260929T101500Z-cafe0001';

// ─── test harness ──────────────────────────────────────────────────────────────────────────────────────────────
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
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
function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
const preview = (xs) => (xs.length > 6 ? `${show(xs.slice(0, 6))} … (+${xs.length - 6} more)` : show(xs));
const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const short = (id) => (typeof id === 'string' ? id.slice(0, 8) : show(id));

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
/** Lazily load the planner module (T19's replayJournal, the replay a start applies). */
function loadLib() {
  let m;
  try { m = require(LIB); }
  catch (e) { throw new Error(`${LIB_REL} not implemented yet (require failed: ${firstLine(e)})`); }
  assert(typeof m.replayJournal === 'function', `${LIB_REL} must export replayJournal(lines, record) (T2, T19)`);
  return m;
}

/** A deterministic PRNG (xorshift32) for the fixed-seed property tests. */
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ─── fixtures ──────────────────────────────────────────────────────────────────────────────────────────────────
const firstD = (ev) => { const t = ev.tags.find((x) => Array.isArray(x) && x[0] === 'd'); return t ? t[1] : null; };
/** A fixture tagging's address (every fixture here has a plain first d). */
const addr = (ev) => `39999:${ev.pubkey}:${firstD(ev)}`;

/** A tagging at its own address `39999:<author>:rx-<name>` (Alice tags Bob by default, canonical stamp). */
function tg(name, o = {}) {
  return F.makeTagging(Object.assign({ d: `rx-${name}`, id: idOf(`rx:${name}`), createdAt: NOW_S - 1000 }, o));
}
/** A tagging by a fresh author (its own pubkey from `name`) at its own address. */
function fresh(name, o = {}) { return tg(name, Object.assign({ author: pubkeyOf(`rx:${name}`), createdAt: NOW_S }, o)); }
function fieldsOf(ev) {
  const val = (n) => { const t = ev.tags.find((x) => Array.isArray(x) && x[0] === n); return t ? t[1] : null; };
  return {
    author: ev.pubkey, d: val('d'), target: val('p'), a: val('a'), e: val('e'), polarity: val('polarity'),
    stamps: ev.tags.filter((t) => Array.isArray(t) && t[0] === 'z').map((t) => t[1]), createdAt: ev.created_at,
  };
}
/** A newer version at the same address (created_at + 10 unless given). */
function version(ev, name, o = {}) {
  return F.makeTagging(Object.assign(fieldsOf(ev), { id: idOf(`rx:${name}`), createdAt: ev.created_at + 10 }, o));
}
/** A kind-5 deletion (Alice's unless `author` is given), created now. */
function del(name, o = {}) {
  return F.makeDeletion(Object.assign({ id: idOf(`rx:del:${name}`), createdAt: NOW_S }, o));
}
const padded = (ev) => Object.assign(ev, { content: PAD_100K });

const EDGE_FIELDS = F.EDGE_KEYS.filter((k) => k !== 'type');
function edgeText(e) {
  if (!e) return 'none';
  return show(EDGE_FIELDS.map((k) => {
    const v = e[k] === undefined ? null : e[k];
    return typeof v === 'bigint' ? Number(v) : v;
  }));
}
/** The graph holds, at the event's address, exactly the relationship the contract gives for it. */
function reflects(w, ev) {
  const got = w.graph.edgeAt(addr(ev));
  return !!got && edgeText(got) === edgeText(F.contractEdge(ev));
}
const absent = (w, address) => !w.graph.rows.has(address);
/** The event id the graph's relationship at `address` records, or null. */
function eventIdAt(w, address) {
  const row = w.graph.rows.get(address);
  const p = row ? H.propOf(row, 'eventId') : null;
  return p && typeof p.text === 'string' ? p.text : null;
}
/** A cheap check for bulk scenarios: the graph's relationship at the event's address records the event's id. */
const holdsId = (w, ev) => eventIdAt(w, addr(ev)) === ev.id;

// ─── scenario helpers ──────────────────────────────────────────────────────────────────────────────────────────
function newWorld(o = {}) { return H.makeWorld(Object.assign({ loadEngine: load }, o)); }
function put(w, ...evs) { putAll(w, evs); }
function putAll(w, evs) {
  for (const ev of evs) {
    const r = w.relay.store(ev);
    assert(r.stored, `fixture: the fake relay refused ${ev.kind === 5 ? 'a kind-5' : `a kind-${ev.kind}`} ${short(ev.id)}… (${r.reason})`);
  }
}
/** Store, then let the live notices reach the engine's buffer before its next tick (no read overtakes a notice). */
async function putNow(w, ...evs) { putAll(w, evs); await H.flush(3); }
/** The owner-started backfill wrote these (the relationship each tagging gives). */
function backfill(w, ...evs) { for (const ev of evs) w.graph.putEdge(F.contractEdge(ev)); }

/** The status as last written to status.json (what the route serves). */
function statusOf(proc) {
  const s = proc.world.store.status;
  return isPlainObject(s) ? s : null;
}
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
  const lastScans = w.relay.scans.slice(-4).map((s) => `${s.kind}:${s.outcome}`).join(', ');
  return [
    `status: state ${show(st && st.state)}, lastError ${show(st && st.lastError)}, catchUp.last ${show(at(st, 'catchUp.last'))}`,
    `graph: ${w.graph.rows.size} TAGS at tagging addresses; ${writes.length} write call(s)`,
    `relay: ${w.relay.subCalls.length} subscribe call(s); ${w.relay.scans.length} scan(s)${lastScans ? ` (last: ${lastScans})` : ''}`,
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
/** Drive until `pending()` (a list of what is still missing) is empty. */
async function withinAll(proc, ms, pending, what, step = 100) {
  const r = await drive(proc, ms, { step, until: () => pending().length === 0 });
  if (!r.done) {
    const ex = r.exit !== undefined ? ` (tick() answered exit ${r.exit} after ${r.elapsed} ms)` : '';
    throw new Error(`${what}: not within ${ms / 1000} s of simulated time${ex}; still pending: ${preview(pending())}\n        ${diag(proc)}`);
  }
  return r.elapsed;
}
/** Drive the whole of `ms` (a claim that something does NOT happen); `each` runs after every tick. */
async function hold(proc, ms, what, step = 500, each) {
  const r = await drive(proc, ms, { step, each });
  if (r.exit !== undefined) throw new Error(`${what}: tick() answered exit ${r.exit} after ${r.elapsed} ms of simulated time\n        ${diag(proc)}`);
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
/** Stop a process: 'signal' (a deploy: SIGTERM) or 'switch' (the owner turns it off). */
async function stop(w, proc, how) {
  if (how === 'signal') {
    await H.guarded(() => proc.engine.handleSignal('SIGTERM'), "handleSignal('SIGTERM')");
  } else {
    w.store.setSwitch(false);
  }
  const r = await drive(proc, 5 * SEC, 50);
  eq(r.exit, 0, `after ${how === 'signal' ? "handleSignal('SIGTERM')" : 'the owner turns the switch off'}, tick() answers { exit: 0 } within 5 s (T29; AC-5)\n        ${diag(proc)}`);
  proc.kill();
}
const TIMED_OUT = () => H.neoError('Neo.ClientError.Transaction.TransactionTimedOut', 'The transaction has been terminated');

// ─── observing rounds and scans ────────────────────────────────────────────────────────────────────────────────
/** The seq of every graph read (readAt) a process made: each begins a round. */
function roundStarts(w, procN) { return w.graph.calls.filter((x) => x.op === 'readAt' && x.proc === procN).map((x) => x.seq); }
/** The relay scans of a process grouped by round (the scans called between one of its readAt calls and the next). */
function scansByRound(w, procN, { from = 0 } = {}) {
  const starts = roundStarts(w, procN).filter((s) => s > from);
  const mine = w.relay.scans.filter((x) => x.proc === procN);
  return starts.map((s, i) => {
    const to = i + 1 < starts.length ? starts[i + 1] : Infinity;
    return { start: s, scans: mine.filter((x) => x.seq > s && x.seq < to) };
  });
}
const isRoundRead = (x) => x.kind === 'address' || x.kind === 'element';
/** A scan of exactly one address, or of exactly one element id (A1-13's "read alone"). */
function isSingle(x) {
  if (!x.filter) return false;
  if (x.kind === 'address') return H.scanAddresses(x.filter).length === 1;
  if (x.kind === 'element') return H.scanIds(x.filter).length === 1;
  return false;
}
const scanNames = (x, address) => !!x.filter && H.filterTargets(x.filter, address);

// ─── record.json and journal.jsonl through T19's replay ────────────────────────────────────────────────────────
/** journal.jsonl's lines as openJournal hands them over: cut back to the last newline, no empty items (T21, T26). */
function journalAsOpened(text) {
  const s = String(text || '');
  const cut = s.lastIndexOf('\n');
  return s.slice(0, cut + 1).split('\n').filter((l) => l.length > 0);
}
/** The lineage rows record.json holds (A1-6: `lineage: [[address, top | null, [older…]]]`), or null when it has none. */
function recordLineage(record) {
  return record && Array.isArray(record.lineage) ? record.lineage : null;
}
function lineageRow(record, address) {
  const rows = recordLineage(record);
  return rows ? rows.find((r) => Array.isArray(r) && r[0] === address) || null : null;
}
/** A lineage value as { top, older: [sorted] } (A1-17 T3: L: Map<address, { top, older: Set | null }>). */
function linValue(lin) {
  if (!lin) return null;
  const older = lin.older instanceof Set ? [...lin.older] : Array.isArray(lin.older) ? lin.older.slice() : [];
  return { top: lin.top === undefined ? null : lin.top, older: older.sort() };
}
/** replayJournal(lines, record) → its maps, requiring A1's lineage (A1-17 T3). */
function replayMaps(lib, lines, record, what) {
  const r = lib.replayJournal(lines, record);
  assert(r && r.maps, `${what}: replayJournal(lines, record) returned no maps (T19)`);
  assert(r.maps.L instanceof Map, `${what}: replayJournal's maps carry no lineage L — A1-17 T3: newMaps() → { S, B, R, L }, L a Map<address, { top, older }> (A1-1 replaces H); got the keys ${show(Object.keys(r.maps))}`);
  return r;
}
/** The maps as comparable plain data: S and R as id → address, B sorted, L as address → { top, older sorted }. */
function mapsView(maps) {
  const pairs = (m) => [...m].map(([id, e]) => [id, e && e.a]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const L = [...maps.L].map(([a, lin]) => [a, linValue(lin)]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return { S: pairs(maps.S), R: pairs(maps.R), B: [...maps.B].sort(), L };
}
/** Addresses whose lineage top is not in S (A1-1: the status's `heard`). */
function heardCount(maps) {
  let n = 0;
  for (const lin of maps.L.values()) if (lin && typeof lin.top === 'string' && !maps.S.has(lin.top)) n += 1;
  return n;
}
/** The first difference between two mapsView()s, or null. */
function firstDiff(a, b) {
  for (const k of ['S', 'R', 'B']) {
    const x = show(a[k]);
    const y = show(b[k]);
    if (x !== y) {
      const xs = new Set(a[k].map(show));
      const ys = new Set(b[k].map(show));
      return `${k}: only in the replay ${preview([...xs].filter((v) => !ys.has(v)))}; only in memory ${preview([...ys].filter((v) => !xs.has(v)))}`;
    }
  }
  const la = new Map(a.L);
  const lb = new Map(b.L);
  for (const addrKey of new Set([...la.keys(), ...lb.keys()])) {
    const x = show(la.get(addrKey) || null);
    const y = show(lb.get(addrKey) || null);
    if (x !== y) return `L at ${addrKey.slice(0, 20)}…${addrKey.slice(-14)}: the replay gives ${x}, memory holds ${y}`;
  }
  return null;
}

/** Wrap every process's store so each writeRecord (a compaction) is captured with what was on disk just before it. */
function captureRecords(w) {
  const log = [];
  const api0 = w.store.api;
  w.store.api = (proc) => {
    const a = api0(proc);
    const wr = a.writeRecord;
    a.writeRecord = (body) => {
      if (!proc.killed) {
        log.push({ proc: proc.n, seq: w.nextSeq(), at: w.clock.t, prev: H.jcopy(w.store.record), journal: w.store.journal, journalBytes: Buffer.byteLength(w.store.journal, 'utf8'), body: H.jcopy(body) });
      }
      return wr(body);
    };
    return a;
  };
  return log;
}
/** Was the capture a catch-up's (or a census's) compaction: did its process read the graph's keys since its last one? */
function afterKeyRead(w, log, i) {
  const c = log[i];
  let prevSeq = 0;
  for (let j = i - 1; j >= 0; j -= 1) if (log[j].proc === c.proc) { prevSeq = log[j].seq; break; }
  return w.graph.calls.some((x) => x.op === 'readKeys' && x.proc === c.proc && x.seq > prevSeq && x.seq < c.seq);
}

/** Wrap the relay's store so every stored kind 39999 is logged in store order: address → id → [store seqs]. */
function storeOrder(w) {
  const hist = new Map();
  let n = 0;
  const store0 = w.relay.store;
  w.relay.store = (ev) => {
    const r = store0(ev);
    if (r.stored && ev.kind === 39999) {
      const a = `39999:${String(ev.pubkey).toLowerCase()}:${firstD(ev)}`;
      if (!hist.has(a)) hist.set(a, new Map());
      const at = hist.get(a);
      const id = String(ev.id).toLowerCase();
      if (!at.has(id)) at.set(id, []);
      at.get(id).push(++n);
    }
    return r;
  };
  return hist;
}
/** Lineages whose `older` holds an id first stored at the address after the top's latest store (A1-15). */
function inversions(maps, hist) {
  const out = [];
  for (const [a, lin] of maps.L) {
    const v = linValue(lin);
    if (!v || typeof v.top !== 'string') continue;
    const byId = hist.get(a);
    const tops = byId && byId.get(v.top);
    if (!tops) continue;
    const last = Math.max(...tops);
    for (const o of v.older) {
      const os = byId.get(o);
      if (os && Math.min(...os) > last) out.push({ a, top: short(v.top), older: short(o) });
    }
  }
  return out;
}

/* ═══════════════════════════════════ scenario 8: no start hold (A1-11) ═══════════════════════════════════ */

test('RX1: with the start catch-up failing and backing off — its stamp scan exiting non-zero, or its key read timing out, every try — a live change and the restored work are each reflected within 60 s: no round waits for a catch-up to finish (A1-11 "No start hold"; A1-20 scenario 8; AC-3 "other changes proceed meanwhile")', async () => {
  await cases([
    { name: 'the stamp scan exits non-zero', fail: (w) => { w.relay.scanFail = (f) => (H.scanTouches(f, 'stamp') ? 'exit' : null); } },
    { name: 'the catch-up\'s key read times out', fail: (w) => { w.graph.failReads = (op) => (op === 'readKeys' ? TIMED_OUT() : null); } },
  ], async (c) => {
    const w = newWorld();
    const P = tg('rx1-p');
    put(w, P);
    backfill(w, P);
    const p1 = await boot(w);
    // Restored work: a newer version heard while the graph was unavailable (journaled, not yet written).
    w.graph.down = true;
    const P2 = version(P, 'rx1-p:v2', { polarity: '-1' });
    await putNow(w, P2);
    await drive(p1, 2 * SEC, 100);
    await stop(w, p1, 'signal');
    w.graph.down = false;
    c.fail(w);
    const p2 = await restart(w);
    await within(p2, MIN, () => reflects(w, P2),
      `while ${c.name} at every try, the restored newer version is reflected within 60 s of the start (A1-11: "Restored work and live prompts run between a catch-up's reads, and while it fails or backs off"; round 1's start hold is removed)`);
    await within(p2, 30 * SEC, () => (num(statusOf(p2), 'counts.failedReads.catchUp') || 0) >= 1,
      `fixture: the start catch-up fails (counts.failedReads.catchUp ${show(at(statusOf(p2), 'counts.failedReads'))})`);
    const L = fresh('rx1-live', { createdAt: NOW_S + 10 });
    await putNow(w, L);
    await within(p2, MIN, () => reflects(w, L),
      `a live tagging stored while the start catch-up fails and backs off (${c.name}) is reflected within 60 s (A1-11; AC-1)`);
    assert(at(statusOf(p2), 'catchUp.last.outcome') !== 'done', `fixture: the start catch-up never completed (catchUp.last ${show(at(statusOf(p2), 'catchUp.last'))})`);
  });
});

/* ═══════════════════════════════════ scenario 9: time-outs (A1-13) ═══════════════════════════════════ */

test('RX2: one never-answering address among 200 live taggings delays the others read with it by at most A1-13\'s bound — three round-scan time-outs plus a round when their group was its round\'s only read, two plus a round when another scan of that round answered first — whether it comes first or last in the group; it is never written (A1-13 "So an address whose scans never answer delays …"; decision 9; A1-20 scenario 9)', async () => {
  await cases([
    { name: 'the group of 200 was its round\'s only read; the never-answering address stored first', only: true, slowFirst: true, timeouts: 3 },
    { name: 'the group of 200 was its round\'s only read; the never-answering address stored last', only: true, slowFirst: false, timeouts: 3 },
    { name: 'another group of 200 answered first in its round; the never-answering address stored first', only: false, slowFirst: true, timeouts: 2 },
    { name: 'another group of 200 answered first in its round; the never-answering address stored last', only: false, slowFirst: false, timeouts: 2 },
  ], async (c) => {
    const w = newWorld();
    w.graph.keepRows = false;
    const proc = await boot(w);
    w.relay.scanWaits = true;
    const SLOW = fresh('rx2-slow');
    w.relay.neverAnswers.add(addr(SLOW));
    const CO = [];
    for (let i = 0; i < 199; i++) CO.push(fresh(`rx2-co${i}`));
    const FIRST = [];
    if (!c.only) for (let i = 0; i < 200; i++) FIRST.push(fresh(`rx2-first${i}`));
    const t0 = w.clock.t;
    await putNow(w, ...FIRST, ...(c.slowFirst ? [SLOW, ...CO] : [...CO, SLOW]));
    const bound = c.timeouts * ROUND_SCAN_TIMEOUT_MS + 5 * SEC;
    await withinAll(proc, bound, () => CO.concat(FIRST).filter((ev) => !holdsId(w, ev)).map(addr),
      `the addresses read with the never-answering one are reflected within ${c.timeouts} round-scan time-outs (${c.timeouts} × 20 s) plus a round of their store (A1-13; decision 9: "about 41 s locally" for two)`);
    assert(!holdsId(w, SLOW), 'the never-answering address is never written (its reads never answer)');
    const timedOut = w.relay.scans.filter((x) => x.proc === proc.n && x.seq > 0 && x.at >= t0 && x.outcome === 'timeout' && scanNames(x, addr(SLOW)));
    assert(timedOut.length >= 1, `fixture: a scan naming the never-answering address timed out (${w.relay.scans.filter((x) => x.at >= t0).length} scans since the store)`);
  });
});

test('RX3: with three never-answering addresses, other authors\' taggings stored every 3 s over 6 minutes are each reflected within 60 s; no round has more than one timed-out single (one-address or one-id) scan; and each never-answering address is parked after its third single time-out — no scan names it for the next 5 minutes, and the status counts all three parked (A1-13 "A single that times out", "After three consecutive single time-outs the address is parked like a refused write (5 min, …)"; decision 9; A1-20 scenario 9; AC-1)', async () => {
  const w = newWorld();
  w.graph.keepRows = false;
  const proc = await boot(w);
  w.relay.scanWaits = true;
  const SLOW = [0, 1, 2].map((i) => fresh(`rx3-slow${i}`));
  for (const ev of SLOW) w.relay.neverAnswers.add(addr(ev));
  const mark = w.nextSeq();
  await putNow(w, ...SLOW);
  const t0 = w.clock.t;
  const others = [];
  const seenAt = new Map();
  let n = 0;
  let next = t0 + SEC;
  let parkedMax = 0;
  await hold(proc, 11 * MIN, 'eleven minutes with three never-answering addresses', 100, () => {
    while (w.clock.t >= next && next < t0 + 6 * MIN) {
      const ev = fresh(`rx3-other${n}`, { createdAt: NOW_S + n });
      n += 1;
      next += 3 * SEC;
      put(w, ev);
      others.push({ ev, at: w.clock.t });
    }
    for (const o of others) if (!seenAt.has(o.ev.id) && holdsId(w, o.ev)) seenAt.set(o.ev.id, w.clock.t);
    parkedMax = Math.max(parkedMax, num(statusOf(proc), 'parked') || 0);
  });
  const late = others.filter((o) => !seenAt.has(o.ev.id) || seenAt.get(o.ev.id) - o.at > MIN)
    .map((o) => `${short(o.ev.id)} ${seenAt.has(o.ev.id) ? `${((seenAt.get(o.ev.id) - o.at) / SEC).toFixed(1)} s` : 'never'}`);
  assert(late.length === 0, `${late.length} of ${others.length} other authors' taggings were not reflected within 60 s of their store (A1-13: "However many such addresses there are, each round spends at most one single time-out on them"; AC-1): ${preview(late)}`);
  const rounds = scansByRound(w, proc.n, { from: mark });
  const over = rounds.map((r) => r.scans.filter((x) => isRoundRead(x) && isSingle(x) && x.outcome === 'timeout').length)
    .map((k, i) => [i, k]).filter(([, k]) => k > 1);
  assert(over.length === 0, `A1-13: "A round reads no further marked single after one has timed out" — ${over.length} round(s) had more than one timed-out single scan: ${preview(over.map(([i, k]) => `round ${i + 1}: ${k}`))}`);
  const problems = [];
  for (const ev of SLOW) {
    const a = addr(ev);
    const singles = w.relay.scans.filter((x) => x.proc === proc.n && x.seq > mark && isRoundRead(x) && isSingle(x) && scanNames(x, a));
    const touts = singles.filter((x) => x.outcome === 'timeout');
    if (touts.length < 3) { problems.push(`${a.slice(-12)}: ${touts.length} single time-out(s) in 11 minutes (A1-13 reads a marked address alone)`); continue; }
    const third = touts[2];
    const nextScan = w.relay.scans.find((x) => x.proc === proc.n && x.seq > third.seq && scanNames(x, a));
    const end = third.at + third.cost;
    if (nextScan && nextScan.at - end < 5 * MIN - 5 * SEC) {
      problems.push(`${a.slice(-12)}: read again ${((nextScan.at - end) / SEC).toFixed(1)} s after its third single time-out (parked: 5 min)`);
    } else if (!nextScan && w.clock.t - end < 5 * MIN - 5 * SEC) {
      problems.push(`${a.slice(-12)}: fixture: its third single time-out ended only ${((w.clock.t - end) / SEC).toFixed(0)} s before the drive's end`);
    }
  }
  assert(problems.length === 0, `each never-answering address is parked after three consecutive single time-outs, for 5 minutes (A1-13): ${problems.join('; ')}`);
  assert(parkedMax >= 3, `the status's parked counts the three parked addresses (A1-13 "parked like a refused write"; § Status parked); the most it showed was ${parkedMax}`);
});

test('RX4: a Redis-style stall of 2 minutes at ordinary traffic (a tagging every 2 s) — every scan waiting until the relay answers or its 20 s time-out — never bisects a timed-out group in its round; once the relay answers, the taggings stored meanwhile are re-read in their groups, not one strfry process each, and reflected within 60 s plus a round, and later ones within 60 s (A1-13 "A group that times out", "Is it a stall?": "So after a Redis stall the addresses come back in their usual groups", "The stall guard"; § Failure handling; A1-20 scenario 9)', async () => {
  const w = newWorld();
  w.graph.keepRows = false;
  const proc = await boot(w);
  w.relay.scanWaits = true;
  const t0 = w.clock.t;
  const stallAt = t0 + MIN;
  const stallEnd = stallAt + 2 * MIN;
  const stored = [];
  const seenAt = new Map();
  let n = 0;
  let next = t0 + SEC;
  let stalled = false;
  await hold(proc, 5 * MIN, 'a stall at ordinary traffic', 100, () => {
    if (!stalled && w.clock.t >= stallAt) { stalled = true; w.relay.stallUntil = stallEnd; }
    while (w.clock.t >= next && next < stallEnd + MIN) {
      const ev = fresh(`rx4-t${n}`, { createdAt: NOW_S + n });
      n += 1;
      next += 2 * SEC;
      put(w, ev);
      stored.push({ ev, at: w.clock.t });
    }
    for (const s of stored) if (!seenAt.has(s.ev.id) && holdsId(w, s.ev)) seenAt.set(s.ev.id, w.clock.t);
  });
  const during = stored.filter((s) => s.at >= stallAt && s.at < stallEnd);
  const after = stored.filter((s) => s.at >= stallEnd);
  assert(during.length >= 40, `fixture: ${during.length} taggings stored during the stall`);
  const stallTimeouts = w.relay.scans.filter((x) => x.proc === proc.n && x.hang === 'stall');
  assert(stallTimeouts.length >= 2, `fixture: the stall timed scans out (${stallTimeouts.length} stall time-outs)`);
  // Not bisected in its round: after a group's time-out, no later scan of the same round names any of its addresses.
  const bisected = [];
  for (const r of scansByRound(w, proc.n)) {
    r.scans.forEach((x, i) => {
      if (x.kind !== 'address' || x.outcome !== 'timeout' || !x.filter) return;
      const as = H.scanAddresses(x.filter);
      if (as.length < 2) return;
      const again = r.scans.slice(i + 1).filter((y) => y.kind === 'address' && y.filter && H.scanAddresses(y.filter).some((a) => as.includes(a)));
      if (again.length) bisected.push(`a group of ${as.length} re-read in its round as ${again.map((y) => H.scanAddresses(y.filter).length).join('+')}`);
    });
  }
  assert(bisected.length === 0, `A1-13: "A round scan of two or more addresses … that fails with timeout is not bisected in its round. Its addresses are deferred" — ${bisected.length} were: ${preview(bisected)}`);
  const lateDuring = during.filter((s) => !seenAt.has(s.ev.id) || seenAt.get(s.ev.id) - stallEnd > MIN + 15 * SEC)
    .map((s) => `${short(s.ev.id)} ${seenAt.has(s.ev.id) ? `${((seenAt.get(s.ev.id) - stallEnd) / SEC).toFixed(1)} s` : 'never'}`);
  assert(lateDuring.length === 0, `${lateDuring.length} of the ${during.length} taggings stored during the stall were not reflected within 60 s plus a round of the relay answering (§ Failure handling): ${preview(lateDuring)}`);
  const lateAfter = after.filter((s) => !seenAt.has(s.ev.id) || seenAt.get(s.ev.id) - s.at > MIN).map((s) => short(s.ev.id));
  assert(lateAfter.length === 0, `${lateAfter.length} of the ${after.length} taggings stored after the relay answered took more than 60 s (AC-1): ${preview(lateAfter)}`);
  // In their groups: the scan that finally read each tagging stored during the stall (the first that answered) read it
  // with others, not alone — one strfry process each is what marking every address the stall touched would cost.
  const reads = new Set();
  let alone = 0;
  for (const s of during) {
    const x = w.relay.scans.find((y) => y.proc === proc.n && y.at >= s.at && y.kind === 'address' && y.outcome === 'ok' && scanNames(y, addr(s.ev)));
    if (!x) continue;
    reads.add(x);
    if (isSingle(x)) alone += 1;
  }
  assert(timedOutBefore(w, proc, during) >= during.length / 2, `fixture: most taggings stored during the stall had a read time out before one answered (${timedOutBefore(w, proc, during)} of ${during.length})`);
  assert(alone <= 3, `A1-13: "after a Redis stall the addresses come back in their usual groups" — ${alone} of the ${during.length} taggings stored during the stall were finally read alone, one strfry process each`);
  assert(reads.size <= Math.ceil(during.length / 5), `${reads.size} scans finally read the ${during.length} taggings stored during the stall; in their groups that is a few scans, not one per address (A1-13)`);
});

/** How many of these stored taggings had a scan naming them time out before any scan naming them answered. */
function timedOutBefore(w, proc, list) {
  let n = 0;
  for (const s of list) {
    const named = w.relay.scans.filter((y) => y.proc === proc.n && y.at >= s.at && y.kind === 'address' && scanNames(y, addr(s.ev)));
    const firstOk = named.findIndex((y) => y.outcome === 'ok');
    if (named.slice(0, firstOk < 0 ? named.length : firstOk).some((y) => y.outcome === 'timeout')) n += 1;
  }
  return n;
}

test('RX5: a live group that times out once while its round\'s catch-up share answered is not bisected in its round; its addresses are marked and read alone — one address per scan — before the round\'s lane-4 catch-up reads, so with 300 padded catch-up addresses behind them they are reflected within 60 s (A1-13 "Read-alone marks": "A lane\'s marked singles are read right after that lane\'s usual groups, so live and re-look singles come before the catch-up\'s heavy reads and lane 4"; A1-14; A1-20 scenario 9)', async () => {
  const w = newWorld({ lean: true });
  w.graph.keepRows = false;
  const p1 = await boot(w);
  await stop(w, p1, 'signal');
  const HEAVY = pubkeyOf('rx5:heavy');
  const heavy = [];
  for (let i = 0; i < 300; i++) heavy.push(padded(tg(`rx5-h${i}`, { author: HEAVY, createdAt: NOW_S - 50 })));
  putAll(w, heavy); // stored while the path was down: the start catch-up's arrivals, heavier than the share
  const heavyAddr = new Set(heavy.map(addr));
  const p2 = w.spawn();
  w.relay.scanWaits = true;
  w.relay.latencyMs = 100;
  await H.startEngine(p2);
  await within(p2, 30 * SEC, () => w.relay.scans.some((x) => x.proc === p2.n && x.kind === 'stamp' && x.outcome === 'ok'), 'fixture: the start catch-up takes its stamp scan', 50);
  const VICTIMS = [];
  for (let i = 0; i < 20; i++) VICTIMS.push(fresh(`rx5-v${i}`));
  const victimAddr = new Set(VICTIMS.map(addr));
  let hiccup = null;
  w.relay.scanFail = (filter, o, call) => {
    if (hiccup || call.proc !== p2.n || call.kind !== 'address') return null;
    const as = H.scanAddresses(filter);
    if (as.length >= 2 && as.some((a) => victimAddr.has(a))) { hiccup = call; return 'timeout'; }
    return null;
  };
  const t0 = w.clock.t;
  await putNow(w, ...VICTIMS);
  await withinAll(p2, MIN, () => VICTIMS.filter((ev) => !holdsId(w, ev)).map(addr),
    'the live taggings whose group timed out once are reflected within 60 s of their store, ahead of the catch-up\'s lane-4 reads (A1-13; AC-1)');
  assert(hiccup, `fixture: the victims' group scan timed out once (${w.relay.scans.filter((x) => x.at >= t0).length} scans since they were stored)`);
  const round = scansByRound(w, p2.n).find((r) => r.scans.includes(hiccup));
  assert(round, 'fixture: the timed-out group scan belongs to a round (after a graph read)');
  const idx = round.scans.indexOf(hiccup);
  assert(round.scans.slice(0, idx).some((x) => isRoundRead(x) && x.outcome === 'ok'), `fixture: another scan of the round (the catch-up's share) answered before the group timed out; its scans before it: ${show(round.scans.slice(0, idx).map((x) => `${x.kind}:${x.outcome}`))}`);
  const reRead = round.scans.slice(idx + 1).filter((x) => x.kind === 'address' && x.filter && H.scanAddresses(x.filter).some((a) => victimAddr.has(a)));
  assert(reRead.length === 0, `A1-13: a group that times out "is not bisected in its round. Its addresses are deferred" — its round read them again in ${reRead.length} scan(s) of ${reRead.map((x) => H.scanAddresses(x.filter).length).join(', ')} address(es)`);
  // Read alone afterwards, and ahead of lane 4.
  const problems = [];
  for (const ev of VICTIMS) {
    const a = addr(ev);
    const read = w.relay.scans.find((x) => x.proc === p2.n && x.seq > hiccup.seq && x.kind === 'address' && x.outcome === 'ok' && scanNames(x, a));
    if (!read) { problems.push(`${a.slice(-10)}: never read after the time-out`); continue; }
    if (!isSingle(read)) { problems.push(`${a.slice(-10)}: read in a scan of ${H.scanAddresses(read.filter).length} addresses, not alone`); continue; }
    const r = scansByRound(w, p2.n).find((x) => x.scans.includes(read));
    const before = r ? r.scans.slice(0, r.scans.indexOf(read)) : [];
    const catchUpBytes = before.filter((x) => x.outcome === 'ok' && x.kind === 'address' && x.filter && H.scanAddresses(x.filter).some((b) => heavyAddr.has(b)))
      .reduce((s, x) => s + x.bytes, 0);
    if (catchUpBytes > SHARE_BYTES) problems.push(`${a.slice(-10)}: read alone after ${(catchUpBytes / MiB).toFixed(1)} MiB of catch-up reads in its round (the share is 3.2 MiB; the rest is lane 4)`);
  }
  assert(problems.length === 0, `A1-13: a marked live address is read alone, right after the live lane's usual groups and before lane 4 — ${problems.length} of ${VICTIMS.length} were not: ${preview(problems)}`);
});

/* ═══════════════════════════════════ scenario 10: the catch-up share (A1-14) ═══════════════════════════════════ */

test('RX6: beside a restart\'s catch-up of 2,400 padded addresses (about 50 KB each, 120 MB in all: a share\'s 100 addresses weigh more than its 3.2 MiB, less than one 8 MiB scan) and a live tagging every 3 s, with each strfry process taking 300 ms: every round keeps at most 3.2 MiB of catch-up events before its first live read (live keeps at least 12.8 MiB), spends at most two extra strfry processes on the share, and the share advances — the catch-up is reflected within 5 minutes and every live tagging within 60 s (A1-14 "The catch-up share": "What that guarantees"; § Lanes and rounds; A1-20 scenario 10; AC-1; AC-4)', async () => {
  const w = newWorld({ lean: true });
  w.graph.keepRows = false;
  const p1 = await boot(w);
  await stop(w, p1, 'signal');
  const HEAVY = pubkeyOf('rx6:heavy');
  const heavy = [];
  for (let i = 0; i < 2400; i++) heavy.push(Object.assign(tg(`rx6-h${i}`, { author: HEAVY, createdAt: NOW_S - 50 }), { content: PAD_50K }));
  putAll(w, heavy);
  const heavyAddr = new Set(heavy.map(addr));
  w.relay.scanWaits = true;
  w.relay.latencyMs = 300;
  const p2 = await restart(w);
  const startAt = w.clock.t;
  const live = [];
  const liveAddr = new Set();
  const seenAt = new Map();
  let n = 0;
  let next = startAt + 2 * SEC;
  let heavyDoneAt = null;
  await hold(p2, 8 * MIN, 'a padded catch-up beside live traffic', 100, () => {
    while (w.clock.t >= next && next < startAt + 6 * MIN) {
      const ev = fresh(`rx6-live${n}`, { createdAt: NOW_S + n });
      n += 1;
      next += 3 * SEC;
      put(w, ev);
      live.push({ ev, at: w.clock.t });
      liveAddr.add(addr(ev));
    }
    for (const s of live) if (!seenAt.has(s.ev.id) && holdsId(w, s.ev)) seenAt.set(s.ev.id, w.clock.t);
    if (heavyDoneAt === null && heavy.every((ev) => holdsId(w, ev))) heavyDoneAt = w.clock.t;
  });
  assert(heavyDoneAt !== null && heavyDoneAt - startAt <= 5 * MIN, `the share advances: the 2,400 padded catch-up addresses are reflected within 5 minutes of the start (A1-14 "the share still advances whenever one address fits"; AC-4); ${heavy.filter((ev) => holdsId(w, ev)).length} of 2,400 were${heavyDoneAt === null ? ' after 8 minutes' : ` at ${((heavyDoneAt - startAt) / SEC).toFixed(0)} s`}`);
  const late = live.filter((s) => !seenAt.has(s.ev.id) || seenAt.get(s.ev.id) - s.at > MIN)
    .map((s) => `${short(s.ev.id)} ${seenAt.has(s.ev.id) ? `${((seenAt.get(s.ev.id) - s.at) / SEC).toFixed(1)} s` : 'never'}`);
  assert(late.length === 0, `${late.length} of ${live.length} live taggings took more than 60 s beside the padded catch-up (AC-1; A1-14): ${preview(late)}`);
  const namesAny = (x, set) => !!x.filter && H.scanAddresses(x.filter).some((a) => set.has(a));
  const overBytes = [];
  const overProcs = [];
  let roundsWithShare = 0;
  scansByRound(w, p2.n).forEach((r, i) => {
    const reads = r.scans.filter(isRoundRead);
    const firstLive = reads.findIndex((x) => x.kind === 'address' && namesAny(x, liveAddr));
    if (firstLive < 0) return;
    const share = reads.slice(0, firstLive).filter((x) => x.kind === 'element' || namesAny(x, heavyAddr));
    if (share.length === 0) return;
    roundsWithShare += 1;
    const kept = share.filter((x) => x.outcome === 'ok').reduce((s, x) => s + x.bytes, 0);
    if (kept > SHARE_BYTES) overBytes.push(`round ${i + 1}: ${(kept / MiB).toFixed(2)} MiB`);
    if (share.length > 3) overProcs.push(`round ${i + 1}: ${share.length} scans (${share.map((x) => x.outcome).join(',')})`);
  });
  assert(roundsWithShare >= 3, `fixture: ${roundsWithShare} round(s) read catch-up addresses before a live one`);
  assert(overBytes.length === 0, `A1-14: "the share never keeps more than its fifth" (3.2 MiB), so live and re-look reads keep at least 12.8 MiB — ${overBytes.length} round(s) kept more before their first live read: ${preview(overBytes)}`);
  assert(overProcs.length === 0, `A1-14: "the share costs at most two extra strfry processes per round" (no bisection under the share) — ${overProcs.length} round(s) spent more before their first live read: ${preview(overProcs)}`);
});

/* ═══════════════════════════════════ scenario 14: journal faults (A1-6) ═══════════════════════════════════ */

test('RX7: prefix and torn-append replay never invert a lineage — (a) a first start whose buffered delivery Y the baseline scan\'s X outranks, torn in the append that carries Y\'s line (that line cut, or kept whole and the next one cut), replays X over Y, and a stale by-id deletion of Y never removes X\'s relationship once X leaves with no event; (b) over fixed seeds of random stores, deletions, silent departures, pass writes and torn-append crashes, every prefix of every journal replayed over its record keeps every lineage in the relay\'s store order (A1-6 "An absolute line never splits one change across two lines, so a torn append cannot invert a lineage by itself"; A1-15; A1-21 "journal-prefix inversions 0"; A1-20 scenario 14)', async () => {
  const lib = loadLib();
  // (a) The first start's buffered delivery, torn.
  await cases([
    { name: '(a) Y\'s line cut part-way', keep: 0 },
    { name: '(a) Y\'s line kept whole, the next line cut', keep: 1 },
  ], async (c) => {
    const w = newWorld();
    const hist = storeOrder(w);
    const Y = tg('rx7a-y');
    const A = addr(Y);
    const X = version(Y, 'rx7a-x', { polarity: '-1' });
    const K = del('rx7a-k', { e: [Y.id] }); // stored after X replaced Y: strfry acts on nothing
    const Y2 = tg('rx7a-y2', { author: CAROL }); // a second buffered delivery, so the append carries two lines
    let subscribed = false;
    w.relay.onSubscribe = () => { if (!subscribed) { subscribed = true; put(w, Y, Y2); } };
    let scanned = false;
    w.relay.onScan = (filter) => { if (!scanned && H.scanTouches(filter, 'stamp')) { scanned = true; put(w, X, K); } };
    w.store.tearAppend = { keepLines: c.keep, when: (lines) => lines.some((l) => l.includes(Y.id)) && lines.some((l) => l.includes(Y2.id)) };
    const p1 = w.spawn();
    await H.startEngine(p1);
    const r = await drive(p1, 60 * SEC, 50);
    assert(r.killed, `fixture: an append carrying the lines of both buffered deliveries tore (the fault log: ${show(w.store.faultLog)})\n        ${diag(p1)}`);
    const torn = w.store.faultLog.find((f) => f.fault === 'torn-append');
    assert(torn && torn.kept.length === c.keep, `fixture: the torn append kept ${torn ? torn.kept.length : '?'} whole line(s), expected ${c.keep}`);
    if (c.keep === 1) assert(torn.kept[0].includes(Y.id), `fixture: the whole line kept is Y's (${torn.kept[0].slice(0, 80)})`);
    assert(subscribed && scanned, 'fixture: Y was stored after the REQ and X during the baseline scan');
    const rec = w.store.record;
    const lines = journalAsOpened(w.store.journal);
    const rep = replayMaps(lib, lines, rec, 'the torn first start');
    const lin = linValue(rep.maps.L.get(A));
    assert(lin, `A1-10 step 3 and A1-6: the first start's record.json and journal place the scan's X over the buffered delivery Y at A — the replay holds no lineage there (record lineage rows: ${show(recordLineage(rec) && recordLineage(rec).length)})`);
    eq(lin.top, X.id, `the replayed lineage's top at A (X, the relay's latest store; Y ${short(Y.id)}, X ${short(X.id)})`);
    const inv = inversions(rep.maps, hist);
    assert(inv.length === 0, `a torn append inverted a lineage (A1-6): ${show(inv)}`);
    // The pass writes X; X leaves with no event; the stale kind-5 naming Y must never remove it.
    w.passWrite(F.contractEdge(X));
    w.relay.remove(X.id);
    await w.advance(5 * SEC);
    const p2 = await restart(w);
    await hold(p2, 2 * MIN, 'two minutes after the restart', 500, () => {
      if (!holdsId(w, X)) throw new Error(`X's relationship was removed on a deletion naming only Y, which strfry acted on nothing for (A1-4, A1-15)\n        ${diag(p2)}`);
    });
  });
  // (b) Every prefix, over fixed seeds.
  let checked = 0;
  let withOlder = 0;
  const found = [];
  for (const seed of [11, 23, 37, 41]) {
    const rand = rng(seed * 7919);
    const pick = (xs) => xs[Math.floor(rand() * xs.length)];
    const w = newWorld();
    w.graph.keepRows = false;
    const hist = storeOrder(w);
    const ds = ['pa', 'pb', 'pc'].map((d) => `rx7b-${seed}-${d}`);
    let vn = 0;
    const make = (d) => { vn += 1; return F.makeTagging({ d, id: idOf(`rx7b:${seed}:${vn}`), createdAt: NOW_S - 5000 + vn, polarity: vn % 2 ? '1' : '-1' }); };
    const current = (d) => w.relay.atAddress(`39999:${ALICE}:${d}`);
    let proc = await boot(w);
    const snaps = [];
    const capture = () => snaps.push({ record: H.jcopy(w.store.record), journal: String(w.store.journal) });
    for (let step = 0; step < 40; step += 1) {
      const r = rand();
      if (r < 0.45) {
        const d = pick(ds);
        const k = 1 + Math.floor(rand() * 3);
        const evs = [];
        for (let j = 0; j < k; j += 1) evs.push(make(d));
        await putNow(w, ...evs);
      } else if (r < 0.55) {
        const ev = current(pick(ds));
        if (ev) await putNow(w, F.makeDeletion({ id: idOf(`rx7b:del:${seed}:${step}`), author: ALICE, e: [ev.id], createdAt: NOW_S + step }));
      } else if (r < 0.62) {
        const ev = current(pick(ds));
        if (ev) w.relay.remove(ev.id);
      } else if (r < 0.70) {
        const ev = current(pick(ds));
        if (ev) w.passWrite(F.contractEdge(ev));
      } else if (r < 0.80) {
        w.store.tearAppend = { keepLines: Math.floor(rand() * 3), when: (ls, { proc: n }) => n === proc.n };
      }
      const out = await drive(proc, 300 + Math.floor(rand() * 3000), 50);
      capture();
      if (out.killed || proc.killed) {
        w.store.tearAppend = null;
        await w.advance(2 * SEC);
        proc = await restart(w);
        await drive(proc, SEC, 50);
        capture();
      }
    }
    w.store.tearAppend = null;
    const seen = new Set();
    for (const s of snaps) {
      if (!s.record) continue;
      const key = `${s.journal}|${show(s.record.lineage)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const lines = journalAsOpened(s.journal);
      for (let k = 0; k <= lines.length; k += 1) {
        const rep = replayMaps(lib, lines.slice(0, k), s.record, `seed ${seed}, a prefix of ${k} line(s)`);
        checked += 1;
        for (const lin of rep.maps.L.values()) { const v = linValue(lin); if (v && v.top && v.older.length) { withOlder += 1; break; } }
        const inv = inversions(rep.maps, hist);
        if (inv.length && found.length < 6) found.push({ seed, prefix: k, of: lines.length, next: lines[k] ? JSON.parse(lines[k]).t : 'end', inv });
      }
    }
    await H.killAll();
  }
  assert(withOlder > 0, `fixture: no replayed state held a lineage with an older id (${checked} prefixes checked): the scenario must exercise A1-1's older`);
  assert(found.length === 0, `A1-6: a prefix of the journal replayed over its record inverted a lineage (an id in older stored after the top's latest store; A1-15) — ${show(found)}`);
});

test('RX8: a start whose journal cannot be read demotes every restored top into its older — so after a version Z the path had heard leaves with no event, the author\'s stale by-id deletion of the older X (stored after Z replaced X, which strfry acted on nothing for) never removes the relationship recording G; the start reports journal-unreadable (A1-6 "A start whose journal was not read whole (journal-unreadable) therefore demotes every restored top into its older"; decision 11\'s journal-fault triggers; A1-20 scenario 14)', async () => {
  const w = newWorld();
  const recs = captureRecords(w);
  const p1 = await boot(w);
  const G = tg('rx8-g', { createdAt: NOW_S - 500 });
  const A = addr(G);
  await putNow(w, G);
  await within(p1, MIN, () => holdsId(w, G), 'fixture: G is created');
  await drive(p1, 5 * SEC, 100);
  w.graph.failWrites = (kind) => (kind !== 'create' ? TIMED_OUT() : null); // the graph keeps G while the path retries
  const X = version(G, 'rx8-x', { createdAt: NOW_S - 400, polarity: '-1' });
  await putNow(w, X);
  await drive(p1, 30 * SEC, 250);
  w.relay.drop(); // the reconnect's catch-up compacts: record.json then holds A's lineage with top X
  await within(p1, 3 * MIN, () => { const row = lineageRow(w.store.record, A); return !!row && row[1] === X.id; },
    'A1-6: a catch-up\'s compaction writes record.json with A\'s lineage row, top X over G (A1-1: X was heard after G, and the graph still records G)', 250);
  const Z = version(G, 'rx8-z', { createdAt: NOW_S - 300, polarity: '1' });
  await putNow(w, Z);
  await drive(p1, 3 * SEC, 100);
  await putNow(w, del('rx8-k', { e: [X.id], createdAt: NOW_S - 200 })); // stale: X was replaced, strfry acts on nothing
  await drive(p1, 3 * SEC, 100);
  assert(String(w.store.journal).includes(Z.id), 'fixture: the journal records Z, the version the path heard last');
  await stop(w, p1, 'signal');
  w.relay.remove(Z.id); // Z leaves with no event while the path is down
  w.graph.failWrites = null;
  await w.advance(30 * SEC);
  w.store.journalUnreadableOpens = 1;
  const p2 = await restart(w);
  await within(p2, 5 * MIN, () => at(statusOf(p2), 'catchUp.last.outcome') === 'not-established',
    'the start reports that its catch-up could not be established (AC-4; AC-6)', 250);
  eq(at(statusOf(p2), 'catchUp.last.reason'), 'journal-unreadable', 'catchUp.last.reason');
  const first = recs.find((x) => x.proc === p2.n);
  assert(first, 'fixture: the second process wrote record.json (its re-baseline)');
  const row = lineageRow(first.body, A);
  assert(row, `the re-baseline's record.json keeps A's lineage (the graph still records G there): no lineage row for A in ${show((recordLineage(first.body) || []).length)} row(s)`);
  assert(row[1] !== X.id && Array.isArray(row[2]) && row[2].includes(X.id), `A1-6: the restored top X is demoted into A's older (it resolves no by-id deletion until learned again); the re-baseline's lineage at A is ${show([short(row[1]), (row[2] || []).map(short)])} (G ${short(G.id)}, X ${short(X.id)}, Z ${short(Z.id)})`);
  await hold(p2, 3 * MIN, 'three minutes after the start', 500, () => {
    if (!holdsId(w, G)) throw new Error(`G's relationship was removed on the stale deletion naming X — a restored top the unread journal had moved on (A1-6; decision 11)\n        ${diag(p2)}`);
  });
});

test('RX9: a journal read that fails part-way keeps the state built so far — a revoke prompt whose line was read before the failure still removes its relationship within 5 minutes after its kind-5 left the relay, while one whose line was not read waits for the pass — and the start reports journal-unreadable (A1-6 "Replay applies each line as it is read … If the streamed read fails part-way, the state built so far stands, and the start reports journal-unreadable"; A1-9; A1-20 scenario 14)', async () => {
  const w = newWorld();
  const V1 = tg('rx9-v1');
  const V2 = tg('rx9-v2');
  put(w, V1, V2);
  backfill(w, V1, V2);
  const p1 = await boot(w);
  w.graph.down = true; // no round can act, so the revoke prompts stay pending in the journal
  const K1 = del('rx9-k1', { e: [V1.id] });
  await putNow(w, K1);
  await drive(p1, 2 * SEC, 100);
  const K2 = del('rx9-k2', { e: [V2.id] });
  await putNow(w, K2);
  await drive(p1, 2 * SEC, 100);
  await stop(w, p1, 'signal');
  const lines = w.store.journalLines();
  const names = (l, a) => { try { const o = JSON.parse(l); return o.t === 'd' && o.a === a; } catch (_) { return false; } };
  const i1 = lines.findIndex((l) => names(l, addr(V1)));
  const i2 = lines.findIndex((l) => names(l, addr(V2)));
  assert(i1 >= 0 && i2 > i1, `fixture: the journal holds V1's revoke prompt (d) before V2's (lines ${i1}, ${i2} of ${lines.length})`);
  // Both kind-5s leave the relay with no event: only the journal still knows the revokes.
  w.relay.remove(K1.id);
  w.relay.remove(K2.id);
  w.graph.down = false;
  w.store.journalReadFailsAfter = i1 + 1; // the read hands over V1's d line, then fails (EIO)
  const p2 = await restart(w);
  assert(w.store.faultLog.some((f) => f.fault === 'journal-read'), `fixture: the journal read failed part-way (${show(w.store.faultLog)})`);
  await within(p2, 5 * MIN, () => absent(w, addr(V1)),
    'the revoke prompt read before the failure is kept, and removes its relationship within 5 minutes (A1-6: "the state built so far stands")', 250);
  await within(p2, 5 * MIN, () => at(statusOf(p2), 'catchUp.last.outcome') === 'not-established', 'the start reports its catch-up not established (AC-4)', 250);
  eq(at(statusOf(p2), 'catchUp.last.reason'), 'journal-unreadable', 'catchUp.last.reason (A1-6: a read failing part-way reports journal-unreadable)');
  await hold(p2, 2 * MIN, 'two minutes later', 500);
  assert(!absent(w, addr(V2)), 'the revoke whose line was not read waits for the pass (its kind-5 left the relay: nothing else can find it)');
});

test('RX10: a truncation that fails after a lost record\'s re-baseline replays none of the older generation — whether the process dies at the failed truncation or later, before its next compaction — so the next start keeps the re-baseline\'s lineage (Z over G and X), and the author\'s stale by-id deletion of X never removes the relationship recording G; record.json carries its epoch (A1-6 "The epoch": "So a truncation that failed after a re-baseline cannot replay the older generation\'s lines over the new record"; A1-20 scenario 14)', async () => {
  await cases([
    { name: 'the process dies at the failed truncation', crashAtTruncate: true },
    { name: 'the truncation fails and the process dies later, before its next compaction', crashAtTruncate: false },
  ], async (c) => {
    const w = newWorld();
    const p1 = await boot(w);
    const G = tg('rx10-g', { createdAt: NOW_S - 500 });
    const A = addr(G);
    await putNow(w, G);
    await within(p1, MIN, () => holdsId(w, G), 'fixture: G is created');
    await drive(p1, 5 * SEC, 100);
    w.graph.failWrites = (kind) => (kind !== 'create' ? TIMED_OUT() : null);
    const X = version(G, 'rx10-x', { createdAt: NOW_S - 400, polarity: '-1' });
    await putNow(w, X);
    await drive(p1, 5 * SEC, 100);
    await stop(w, p1, 'signal');
    assert(String(w.store.journal).includes(X.id), 'fixture: the first process\'s journal records X');
    const Z = version(G, 'rx10-z', { createdAt: NOW_S - 300, polarity: '1' });
    put(w, Z); // Z replaces X while the path is down
    w.store.record = null; // record.json is lost: the next start re-baselines
    w.store.truncateFails = 1;
    w.store.crashOnTruncateFail = c.crashAtTruncate;
    const p2 = w.spawn();
    // Its catch-up's key read (the census is its first) never answers: no compaction follows the re-baseline's.
    w.graph.readDelay = (op, { proc, nth }) => (proc === p2.n && op === 'readKeys' && nth >= 2 ? Infinity : null);
    await H.startEngine(p2);
    await drive(p2, 30 * SEC, { step: 50, until: () => p2.killed || w.store.faultLog.some((f) => f.fault === 'truncate') });
    assert(w.store.faultLog.some((f) => f.fault === 'truncate' && f.proc === p2.n), `fixture: the re-baseline's compaction tried to truncate the journal and failed (${show(w.store.faultLog)})\n        ${diag(p2)}`);
    const rec = H.jcopy(w.store.record);
    assert(rec && (typeof rec.epoch === 'number' || typeof rec.epoch === 'string'), `A1-6: every compaction writes record.json with an epoch naming its journal generation; the re-baseline's record has ${show(rec && rec.epoch)}`);
    const row = lineageRow(rec, A);
    assert(row && row[1] === Z.id, `fixture: the re-baseline placed Z at A (A1-2, A1-8); its lineage at A is ${show(row && [short(row[1]), (row[2] || []).map(short)])}`);
    if (!p2.killed) await drive(p2, 3 * SEC, 100);
    p2.kill();
    // While the path is down: the author's stale by-id deletion of X (Z holds A: strfry acts on nothing), then Z leaves.
    put(w, del('rx10-k', { e: [X.id], createdAt: NOW_S - 200 }));
    w.relay.remove(Z.id);
    w.graph.failWrites = null;
    w.graph.readDelay = null;
    w.store.crashOnTruncateFail = false;
    await w.advance(30 * SEC);
    const p3 = await restart(w);
    await hold(p3, 3 * MIN, 'three minutes after the next start', 500, () => {
      if (!holdsId(w, G)) throw new Error(`G's relationship was removed: the older generation's line for X was replayed over the re-baseline's record, so the stale deletion of X passed clause (ii) (A1-6 "The epoch")\n        ${diag(p3)}`);
    });
    eq(at(statusOf(p3), 'catchUp.last.outcome'), 'done', 'the next start is established and its catch-up completes');
  });
});

/* ═══════════════════════════════════ scenario 17: replay exactness (A1-6) ═══════════════════════════════════ */

test('RX11: replay exactness as a property — over fixed seeds of random floods at one address, new addresses, deletions by id and address, silent departures, re-sent versions, refused versions, baseline re-deliveries, pass writes, transient write failures and restarts: at every round-end compaction, record.json plus the journal on disk replay (T19) to exactly the lineage, S, R and B the compaction snapshots from memory; and at every stop, they replay to the seen and heard the final status reports, which the next start reports again (A1-6 "Replay"; A1-1; A1-17 T19; A1-20 scenario 17)', async () => {
  const lib = loadLib();
  let compared = 0;
  let stops = 0;
  const failures = [];
  for (const seed of [101, 202, 303]) {
    const rand = rng(seed * 104729);
    const pick = (xs) => xs[Math.floor(rand() * xs.length)];
    const w = newWorld();
    w.graph.keepRows = false;
    w.keepScanFilters = false;
    const recs = captureRecords(w);
    const PRE = [0, 1, 2].map((i) => tg(`rx11-${seed}-pre${i}`, { createdAt: NOW_S - 5000 }));
    put(w, ...PRE);
    backfill(w, PRE[0], PRE[1]);
    const ds = [0, 1, 2, 3].map((i) => `rx11-${seed}-f${i}`);
    const history = new Map(ds.map((d) => [d, []]));
    let vn = 0;
    const make = (d) => {
      vn += 1;
      const ev = F.makeTagging({ d, id: idOf(`rx11:${seed}:${vn}`), createdAt: NOW_S - 100000 + vn, polarity: vn % 3 === 0 ? '-1' : '1', stamps: vn % 5 === 0 ? [STAMP(LOCAL)] : [STAMP(CANONICAL)] });
      history.get(d).push(ev);
      return ev;
    };
    const tryPut = (ev) => w.relay.store(ev).stored;
    let proc = await boot(w);
    await drive(proc, 30 * SEC, 250);
    const checkStop = async () => {
      await stop(w, proc, 'signal');
      stops += 1;
      const st = statusOf(proc);
      const rep = replayMaps(lib, journalAsOpened(w.store.journal), w.store.record, `seed ${seed}, at a stop`);
      const got = { seen: rep.maps.S.size, heard: heardCount(rep.maps) };
      const want = { seen: num(st, 'seen'), heard: num(st, 'heard') };
      if (show(got) !== show(want)) failures.push(`seed ${seed}: at a stop, record.json + journal replay to ${show(got)}, the final status says ${show(want)}`);
      proc = await restart(w);
      const st2 = statusOf(proc);
      const again = { seen: num(st2, 'seen'), heard: num(st2, 'heard') };
      if (show(again) !== show(want)) failures.push(`seed ${seed}: the next start reports ${show(again)} after a stop that reported ${show(want)}`);
    };
    const fromLog = recs.length;
    for (let step = 0; step < 160; step += 1) {
      if (step === 80) { w.graph.failWrites = null; await checkStop(); }
      const r = rand();
      if (r < 0.5) {
        const d = pick(ds);
        const k = 40 + Math.floor(rand() * 60);
        for (let j = 0; j < k; j += 1) tryPut(make(d));
        await H.flush(3);
      } else if (r < 0.52) {
        await putNow(w, fresh(`rx11-${seed}-new${step}`, { author: pick([ALICE, CAROL, BOB]), createdAt: NOW_S + step }));
      } else if (r < 0.58) {
        const ev = w.relay.atAddress(`39999:${ALICE}:${pick(ds)}`);
        if (ev) await putNow(w, F.makeDeletion({ id: idOf(`rx11:del:${seed}:${step}`), author: ALICE, e: [ev.id], createdAt: NOW_S + step }));
      } else if (r < 0.61) {
        await putNow(w, F.makeDeletion({ id: idOf(`rx11:dela:${seed}:${step}`), author: ALICE, a: [`39999:${ALICE}:${pick(ds)}`], createdAt: NOW_S - 100000 + vn - Math.floor(rand() * 5) }));
      } else if (r < 0.65) {
        const ev = w.relay.atAddress(`39999:${ALICE}:${pick(ds)}`);
        if (ev) w.relay.remove(ev.id);
      } else if (r < 0.69) {
        const h = history.get(pick(ds));
        if (h.length > 1) { tryPut(h[Math.floor(rand() * (h.length - 1))]); await H.flush(3); }
      } else if (r < 0.72) {
        await putNow(w, F.makeNonTagging({ address: `39999:${ALICE}:rx11-${seed}-refused${step}`, refusal: 'no-target', id: idOf(`rx11:ref:${seed}:${step}`), createdAt: NOW_S + step }));
      } else if (r < 0.75) {
        const ev = pick(PRE);
        if (w.relay.holds(ev.id)) { w.relay.remove(ev.id); tryPut(ev); await H.flush(3); }
      } else if (r < 0.80) {
        const ev = w.relay.atAddress(`39999:${ALICE}:${pick(ds)}`);
        if (ev) w.passWrite(F.contractEdge(ev));
      } else if (r < 0.84) {
        w.graph.failWrites = w.graph.failWrites ? null : (kind) => (kind !== 'create' ? TIMED_OUT() : null);
      }
      await drive(proc, 200 + Math.floor(rand() * 2500), 100);
    }
    w.graph.failWrites = null;
    await drive(proc, 20 * SEC, 250);
    await checkStop();
    for (let i = fromLog; i < recs.length; i += 1) {
      const c = recs[i];
      if (afterKeyRead(w, recs, i) || !c.prev) continue; // a catch-up's (or a baseline's) compaction prunes by design
      compared += 1;
      const disk = replayMaps(lib, journalAsOpened(c.journal), c.prev, `seed ${seed}, a round-end compaction`);
      const memory = replayMaps(lib, [], c.body, `seed ${seed}, the snapshot`);
      const diff = firstDiff(mapsView(disk.maps), mapsView(memory.maps));
      if (diff && failures.length < 8) failures.push(`seed ${seed}: at a round-end compaction (${(c.journalBytes / MiB).toFixed(2)} MiB of journal) — ${diff}`);
    }
    await H.killAll();
  }
  assert(compared >= 3, `fixture: ${compared} round-end compaction(s) were compared (the floods must pass the 1 MB cadence; A1-6)`);
  assert(stops >= 3, `fixture: ${stops} stop(s) were checked`);
  assert(failures.length === 0, `A1-6: record.json plus the journal must replay to exactly the state the path holds — ${failures.length} mismatch(es):\n        ${failures.join('\n        ')}`);
});

test('RX12: the compaction cadence — a round-end compaction runs once the journal passes the larger of 1 MB and a quarter of record.json, not before: with a small record at about 1 MB, and with a record of about 10 MB (12,000 baseline taggings at long addresses) only past a quarter of it (A1-6 "Compaction cadence"; decision 9 "Journal cadence")', async () => {
  await cases([
    { name: 'a small record', baseline: 0 },
    { name: 'a record of about 10 MB', baseline: 12000 },
  ], async (c) => {
    const w = newWorld({ lean: true });
    w.graph.keepRows = false;
    w.keepScanFilters = false;
    const recs = captureRecords(w);
    if (c.baseline) {
      const long = 'l'.repeat(236);
      putAll(w, F.manyTaggings(c.baseline, { prefix: `rx12-${long}`, over: (i) => ({ author: pubkeyOf(`rx12:${i % 50}`), createdAt: NOW_S - 9000 }) }));
    }
    const proc = await boot(w);
    await drive(proc, 30 * SEC, 250);
    const d = `rx12-flood-${'f'.repeat(200)}`;
    let vn = 0;
    let maxJournal = 0;
    let maxThreshold = 0;
    let sized = { seq: null, bytes: 0 };
    const recordBytes = () => {
      if (sized.seq !== w.store.recordSeq) sized = { seq: w.store.recordSeq, bytes: w.store.record ? Buffer.byteLength(JSON.stringify(w.store.record), 'utf8') : 0 };
      return sized.bytes;
    };
    const fromLog = recs.length;
    await drive(proc, 4 * MIN, {
      step: 200,
      until: () => recs.slice(fromLog).filter((x, i) => !afterKeyRead(w, recs, fromLog + i)).length >= 2,
      each: () => {
        for (let j = 0; j < 12; j += 1) {
          vn += 1;
          w.relay.store(F.makeTagging({ d, id: idOf(`rx12:flood:${vn}`), createdAt: NOW_S - 100000 + vn, polarity: vn % 2 ? '1' : '-1' }));
        }
        const threshold = Math.max(JOURNAL_COMPACT_BYTES, recordBytes() / 4);
        const jb = Buffer.byteLength(w.store.journal, 'utf8');
        if (jb > maxJournal) { maxJournal = jb; maxThreshold = threshold; }
      },
    });
    const roundEnd = [];
    for (let i = fromLog; i < recs.length; i += 1) if (!afterKeyRead(w, recs, i)) roundEnd.push(recs[i]);
    assert(roundEnd.length >= 1, `a round-end compaction ran within 4 minutes of a flood of ${vn} versions at one address (A1-6); the journal reached ${(maxJournal / MiB).toFixed(2)} MiB against a threshold of ${(maxThreshold / MiB).toFixed(2)} MiB\n        ${diag(proc)}`);
    const early = [];
    for (const x of roundEnd) {
      const prevBytes = x.prev ? Buffer.byteLength(JSON.stringify(x.prev), 'utf8') : 0;
      const threshold = Math.max(JOURNAL_COMPACT_BYTES, prevBytes / 4);
      if (x.journalBytes < threshold * 0.97) early.push(`at ${(x.journalBytes / MiB).toFixed(2)} MiB of journal with a ${(prevBytes / MiB).toFixed(2)} MiB record.json (threshold ${(threshold / MiB).toFixed(2)} MiB)`);
    }
    assert(early.length === 0, `A1-6: "A round-end compaction runs once the journal passes the larger of 1 MB and a quarter of record.json's size" — ${early.length} ran before: ${preview(early)}`);
    assert(maxJournal <= maxThreshold + 512 * 1024, `the journal grew to ${(maxJournal / MiB).toFixed(2)} MiB against a threshold of ${(maxThreshold / MiB).toFixed(2)} MiB without a compaction (the cadence compacts at the round's end once it passes)`);
    if (c.baseline) {
      const first = roundEnd[0];
      const prevBytes = Buffer.byteLength(JSON.stringify(first.prev), 'utf8');
      assert(prevBytes / 4 > JOURNAL_COMPACT_BYTES * 1.1, `fixture: record.json is ${(prevBytes / MiB).toFixed(2)} MiB, so a quarter of it (${(prevBytes / 4 / MiB).toFixed(2)} MiB) must exceed 1 MB for this case`);
    }
  });
});

/* ═══════════════════════════════════ A1-7: the pass exception ═══════════════════════════════════ */

test('RX13: the pass exception is judged from a report read taken with each catch-up\'s key read — a lineage whose version left the relay and the graph is kept by the start catch-up while a pass is alive at its key read, and dropped by the next catch-up (the 10-minute safety diff) once that pass has ended; with no pass, the start catch-up drops it (A1-7 "The pass exception": "a run alive at a report read taken with the catch-up\'s key read, or a run that ended after that key read"; "A lineage is dropped when …")', async () => {
  await cases([
    { name: 'a pass alive at the start catch-up\'s key read, ended after it', pass: true },
    { name: 'no pass', pass: false },
  ], async (c) => {
    const w = newWorld();
    const p1 = await boot(w);
    const V = tg('rx13-v', { createdAt: NOW_S - 500 });
    const A = addr(V);
    await putNow(w, V);
    await within(p1, MIN, () => holdsId(w, V), 'fixture: V is created');
    await drive(p1, 5 * SEC, 100);
    await stop(w, p1, 'signal');
    w.relay.remove(V.id); // V leaves with no event, and the pass removed its relationship: neither holds A
    w.graph.rows.delete(A);
    if (c.pass) w.passStart(PASS_RUN);
    const p2 = await restart(w);
    const startAt = w.clock.t;
    await within(p2, 2 * MIN, () => { const l = at(statusOf(p2), 'catchUp.last'); return !!l && l.outcome === 'done' && Date.parse(l.startedAt) >= startAt; },
      'fixture: the start catch-up completes', 250);
    const rows = recordLineage(w.store.record);
    assert(rows, `A1-6: record.json carries lineage rows after a catch-up's compaction; its keys are ${show(Object.keys(w.store.record || {}))}`);
    if (c.pass) {
      assert(lineageRow(w.store.record, A), `A1-7: while a pass may still write from an older read (alive at the report read taken with the catch-up's key read), no lineage is dropped — A's lineage is gone from record.json after the start catch-up`);
      w.passEnd(PASS_RUN);
      await within(p2, 11 * MIN, () => !lineageRow(w.store.record, A),
        'A1-7: once the pass has ended before a catch-up\'s key read, that catch-up (the 10-minute safety diff) drops the lineage whose top it did not scan, at an address the graph does not hold, with no work waiting', 1000);
    } else {
      assert(!lineageRow(w.store.record, A), `A1-7: with no pass, the start catch-up drops A's lineage (its top ${short(V.id)} is not in the stamp scan, the graph's keys do not hold A, no work waits there); record.json still holds ${show(lineageRow(w.store.record, A))}`);
    }
  });
});

/* ═══════════════════════════════════ A1-18: the final status ═══════════════════════════════════ */

test('RX14: after a stop — a deploy\'s SIGTERM or the owner turning it off — the final status says subscription.connected false (A1-18 "After a stop, the final status says subscription.connected: false"; AC-6)', async () => {
  await cases([
    { name: 'a SIGTERM', how: 'signal' },
    { name: 'the switch turned off', how: 'switch' },
  ], async (c) => {
    const w = newWorld();
    const proc = await boot(w);
    const L = fresh('rx14-live');
    await putNow(w, L);
    await within(proc, MIN, () => holdsId(w, L), 'fixture: a live tagging is created');
    await drive(proc, 11 * SEC, 500);
    eq(at(statusOf(proc), 'subscription.connected'), true, 'fixture: the status says connected while running');
    await stop(w, proc, c.how);
    eq(at(statusOf(proc), 'subscription.connected'), false, `after ${c.name}, the final status.json's subscription.connected (A1-18)`);
  });
});

/* ═══════ Found by the validating Tester's mutation pass over the A1 reference (Test Design, 2026-09-29) ═══════ */

test('RX15: the read-alone mark lasts until the address\'s own read succeeds — a never-answering address that keeps receiving new versions (one every 4 s), beside other authors\' taggings stored every 3 s, is marked when its group times out after another scan of its round answered, and from then on every scan naming it names it alone: through the put-backs under the fresh items its deliveries make while its read is in flight, and through its parks and the unparks its deliveries cause; the others are each reflected within 60 s (A1-13 "Read-alone marks … The mark stays until its own read succeeds", "parked like a refused write"; A1-18 "The item\'s read-alone mark survives put-backs"; § Failure handling: parked addresses are retried "at once on a new event at that address"; AC-1)', async () => {
  const w = newWorld();
  w.graph.keepRows = false;
  const proc = await boot(w);
  w.relay.scanWaits = true;
  const X = fresh('rx15-x');
  const AX = addr(X);
  w.relay.neverAnswers.add(AX);
  const FIRST = [];
  for (let i = 0; i < 200; i++) FIRST.push(fresh(`rx15-first${i}`));
  const CO = [];
  for (let i = 0; i < 5; i++) CO.push(fresh(`rx15-co${i}`));
  const mark = w.nextSeq();
  // One round: the first 200 answer in their own scan, then X's group (X and five others) times out, so it is marked.
  await putNow(w, ...FIRST, X, ...CO);
  const t0 = w.clock.t;
  const others = [];
  const seenAt = new Map();
  let n = 0;
  let k = 0;
  let nextOther = t0 + SEC;
  let nextX = t0 + 2 * SEC;
  let parkedMax = 0;
  const xStoredAt = [];
  await hold(proc, 6 * MIN, 'six minutes with a flooded never-answering address', 100, () => {
    while (w.clock.t >= nextOther && nextOther < t0 + 5 * MIN) {
      const ev = fresh(`rx15-other${n}`, { createdAt: NOW_S + n });
      n += 1;
      nextOther += 3 * SEC;
      put(w, ev);
      others.push({ ev, at: w.clock.t });
    }
    while (w.clock.t >= nextX && nextX < t0 + 5 * MIN) {
      k += 1;
      nextX += 4 * SEC;
      put(w, version(X, `rx15-x:v${k}`, { createdAt: X.created_at + k })); // a new version at X: its notice is delivered
      xStoredAt.push(w.clock.t);
    }
    for (const o of others) if (!seenAt.has(o.ev.id) && holdsId(w, o.ev)) seenAt.set(o.ev.id, w.clock.t);
    parkedMax = Math.max(parkedMax, num(statusOf(proc), 'parked') || 0);
  });
  const named = w.relay.scans.filter((x) => x.proc === proc.n && x.seq > mark && isRoundRead(x) && scanNames(x, AX));
  const marking = named.find((x) => x.outcome === 'timeout' && H.scanAddresses(x.filter).length >= 2);
  assert(marking, `fixture: X's group scan timed out (${named.length} scans named X: ${show(named.slice(0, 4).map((x) => `${H.scanAddresses(x.filter).length}:${x.outcome}`))})`);
  const round = scansByRound(w, proc.n, { from: mark }).find((r) => r.scans.includes(marking));
  assert(round && round.scans.slice(0, round.scans.indexOf(marking)).some((x) => isRoundRead(x) && x.outcome === 'ok'),
    'fixture: another scan of that round answered before X\'s group timed out (A1-13: the group is then marked at once)');
  const after = named.filter((x) => x.seq > marking.seq);
  const inGroups = after.filter((x) => !isSingle(x));
  assert(inGroups.length === 0, `A1-13 / A1-18: once marked, X is read alone until its own read succeeds (it never does) — ${inGroups.length} of the ${after.length} later scans naming X named others too: ${preview(inGroups.map((x) => `${H.scanAddresses(x.filter).length} addresses, ${x.outcome}, at +${((x.at - t0) / SEC).toFixed(0)} s`))}`);
  const late = others.filter((o) => !seenAt.has(o.ev.id) || seenAt.get(o.ev.id) - o.at > MIN)
    .map((o) => `${short(o.ev.id)} ${seenAt.has(o.ev.id) ? `${((seenAt.get(o.ev.id) - o.at) / SEC).toFixed(1)} s` : 'never'}`);
  assert(late.length === 0, `${late.length} of ${others.length} other authors' taggings were not reflected within 60 s of their store (AC-1; A1-13 "each round spends at most one single time-out on them"): ${preview(late)}`);
  const singleTimeouts = after.filter((x) => isSingle(x) && x.outcome === 'timeout');
  assert(singleTimeouts.length >= 4, `fixture: X's reads alone timed out ${singleTimeouts.length} time(s): parked after three, then retried on a new version (A1-13; § Failure handling)`);
  const inFlight = singleTimeouts.filter((x) => xStoredAt.some((t) => t >= x.at && t < x.at + x.cost)).length;
  assert(inFlight >= 1, `fixture: new versions at X were stored while a read of X alone was in flight (so a fresh item waited for its put-back); ${inFlight} of ${singleTimeouts.length} such reads saw one`);
  assert(parkedMax >= 1, `fixture: the status showed X parked (A1-13 "parked like a refused write"); the most it showed was ${parkedMax}`);
});

/* ═══════ A1 clarifications 11 and 12 (Test Design, 2026-09-29): time-out parks and the order of a round's singles ═══════ */

/** The round reads (address or element scans) of a process that name `address`, called after the world counter `from`. */
function readsNaming(w, proc, address, from = 0) {
  return w.relay.scans.filter((x) => x.proc === proc.n && x.seq > from && isRoundRead(x) && scanNames(x, address));
}
/** When a scan ended: called at `at`, it took `cost` of fake time (a time-out costs its timeoutMs). */
const endOf = (x) => x.at + x.cost;
/** record.json's parked row for `address` (A1-12: { a, code, attempts, nextAt, entry }), or null. */
function parkedRowAt(record, address) {
  const rows = isPlainObject(record) && Array.isArray(record.parked) ? record.parked : [];
  return rows.find((r) => isPlainObject(r) && r.a === address) || null;
}
/** An entry's version prompt names `id` (T15: `version` is the prompt, { id, … }). */
const versionIs = (entry, id) => isPlainObject(entry) && (entry.version === id || (isPlainObject(entry.version) && entry.version.id === id));
/**
 * Store a never-answering address X so that it is marked to be read alone (A1-13): 200 fresh taggings answer in their
 * own scan, then X's group — three others stored just before it, and X — times out in the same round, so all four are
 * marked; the next round reads the three others alone (they answer) and then X alone (it times out). → { X, AX, mark }
 */
async function storeMarkedNeverAnswering(w, name) {
  const X = fresh(name);
  const AX = addr(X);
  w.relay.neverAnswers.add(AX);
  const first = [];
  for (let i = 0; i < 200; i++) first.push(fresh(`${name}-first${i}`));
  const co = [0, 1, 2].map((i) => fresh(`${name}-co${i}`));
  const mark = w.nextSeq();
  await putNow(w, ...first, ...co, X);
  return { X, AX, mark };
}

test('RX16: a catch-up does not lift a time-out park — a never-answering address parked after its third single time-out costs no time-out at the next safety diff: the catch-up takes its version, and a newer one stored with its notice lost, as arrivals that merge into the parked entry (record.json\'s parked row then names the newer version), no scan names the address while it is parked, and it is read alone again at the park\'s timer, 5 minutes after the park (A1 clarification 12: a catch-up arrival, look or found revoke at an address parked for time-outs merges into its parked entry and waits for the park\'s timer, a start, or a live delivery of a new version there; A1-13 "parked like a refused write (5 min, …)"; A1-12; decision 9)', async () => {
  const w = newWorld();
  w.graph.keepRows = false;
  const proc = await boot(w);
  w.relay.scanWaits = true;
  // The safety diff comes 10 minutes after the last catch-up began (the first start's own, A1-10; or the baseline):
  // park X a few minutes before it.
  const last = at(statusOf(proc), 'catchUp.last');
  const cuAt = isPlainObject(last) && typeof last.startedAt === 'string' ? Date.parse(last.startedAt) : w.clock.t;
  await drive(proc, Math.max(0, cuAt + 7 * MIN - w.clock.t), 1000);
  const { X, AX, mark } = await storeMarkedNeverAnswering(w, 'rx16-x');
  const singleTimeouts = () => readsNaming(w, proc, AX, mark).filter((x) => isSingle(x) && x.outcome === 'timeout');
  await within(proc, 4 * MIN, () => singleTimeouts().length >= 3, 'fixture: X is marked, and its reads alone time out three times', 250);
  const third = singleTimeouts()[2];
  const parkedAt = endOf(third);
  await within(proc, 10 * SEC, () => num(statusOf(proc), 'parked') === 1, 'fixture: the status shows X parked after its third single time-out (A1-13)', 250);
  const failedAtPark = num(statusOf(proc), 'counts.failedReads.relay');
  // A newer version at X whose live notice is lost: only a catch-up learns it, as an arrival.
  const X2 = version(X, 'rx16-x:v2');
  w.relay.loseNotice = (ev) => ev.id === X2.id;
  put(w, X2);
  const diffDone = () => {
    const l = at(statusOf(proc), 'catchUp.last');
    return isPlainObject(l) && l.outcome === 'done' && Date.parse(l.startedAt) > parkedAt;
  };
  await within(proc, 5 * MIN, diffDone, 'fixture: a catch-up (the 10-minute safety diff) runs and completes while X is parked', 250);
  const diff = at(statusOf(proc), 'catchUp.last');
  assert(Date.parse(diff.endedAt) < parkedAt + 5 * MIN - 5 * SEC,
    `fixture: the safety diff ended before X's park timer (it ended ${((Date.parse(diff.endedAt) - parkedAt) / SEC).toFixed(0)} s after the park)`);
  const row = parkedRowAt(w.store.record, AX);
  assert(row && versionIs(row.entry, X2.id),
    `A1 clarification 12; A1-12: the catch-up's arrival at X merges into its parked entry — record.json's parked row at X names the newer version ${short(X2.id)}…; got ${show(row)}`);
  await drive(proc, Math.max(0, parkedAt + 5 * MIN + 30 * SEC - w.clock.t), 500);
  const since = readsNaming(w, proc, AX, third.seq);
  const early = since.filter((x) => x.at < parkedAt + 5 * MIN - 5 * SEC);
  assert(early.length === 0,
    `A1 clarification 12: the safety diff's catch-up does not lift X's time-out park — ${early.length} scan(s) named X while it was parked: ${preview(early.map((x) => `${H.scanAddresses(x.filter).length} address(es), ${x.outcome}, +${((x.at - parkedAt) / SEC).toFixed(1)} s after the park`))}`);
  eq(num(statusOf(proc), 'counts.failedReads.relay') >= (failedAtPark || 0), true, 'fixture: counts.failedReads.relay never goes down');
  const retry = since[0];
  assert(retry && retry.at <= parkedAt + 5 * MIN + 15 * SEC,
    `A1 clarification 12 / A1-13: X is retried at its park's timer, 5 minutes after the park; ${retry ? `its next read came ${((retry.at - parkedAt) / SEC).toFixed(1)} s after the park` : 'no scan named it within 5.5 minutes'}`);
  assert(isSingle(retry), `A1-13: X keeps its read-alone mark through the park — its read at the timer named ${H.scanAddresses(retry.filter).length} addresses`);
});

test('RX17: a time-out park is not a database refusal — a never-answering address parked after three single time-outs leaves counts.dbRefused at zero, with no byReason entry; each of its single time-outs counts in counts.failedReads.relay; and the status\'s parked shows the park (A1 clarification 12: time-out parks are not counted in dbRefused, each single time-out counts in failedReads.relay, and the park shows in parked; A1-13 "parked like a refused write"; § Status counts; AC-6)', async () => {
  const w = newWorld();
  w.graph.keepRows = false;
  const proc = await boot(w);
  w.relay.scanWaits = true;
  const before = num(statusOf(proc), 'counts.failedReads.relay') || 0;
  eq(num(statusOf(proc), 'counts.dbRefused.total'), 0, 'fixture: counts.dbRefused.total before X is stored');
  const { AX, mark } = await storeMarkedNeverAnswering(w, 'rx17-x');
  const singleTimeouts = () => readsNaming(w, proc, AX, mark).filter((x) => isSingle(x) && x.outcome === 'timeout');
  await within(proc, 4 * MIN, () => singleTimeouts().length >= 3, 'fixture: X is marked, and its reads alone time out three times', 250);
  await drive(proc, 5 * SEC, 250); // the status catches up (a change reaches status.json within seconds)
  const st = statusOf(proc);
  eq(singleTimeouts().length, 3, 'fixture: X\'s single time-outs before its park (5 minutes)');
  eq(num(st, 'parked'), 1, 'A1 clarification 12: the status\'s parked shows the time-out park');
  eq(num(st, 'counts.dbRefused.total'), 0, 'A1 clarification 12: counts.dbRefused.total — a time-out park is no database refusal');
  const br = at(st, 'counts.dbRefused.byReason');
  const reasons = isPlainObject(br) ? Object.keys(br).filter((k) => br[k]) : [];
  assert(reasons.length === 0, `A1 clarification 12: counts.dbRefused.byReason names no reason for a time-out park; got ${show(br)}`);
  const relay = num(st, 'counts.failedReads.relay') || 0;
  assert(relay - before >= 3, `A1 clarification 12: each of X's three single time-outs counts in counts.failedReads.relay; it went from ${before} to ${relay}`);
});

test('RX18: a round reads its marked singles fewest own consecutive time-outs first, ties by queue order — a never-answering single X is due again after its first time-out when a group of seven co-members and a second never-answering address Z (stored last) times out beside an answering scan; in the next round the co-members are read alone first, in queue order, then Z, and X is not read before them, so the co-members are reflected within A1-13\'s two round-scan time-outs plus a round of their store — with X read first they would wait a third (A1 clarification 11: marked singles in ascending order of their own consecutive time-outs, newly marked co-members before a repeatedly slow single, ties by queue order, and the per-case bounds; A1-13 "So an address whose scans never answer delays …"; decision 9; AC-1)', async () => {
  const w = newWorld();
  w.graph.keepRows = false;
  const proc = await boot(w);
  w.relay.scanWaits = true;
  const { AX, mark } = await storeMarkedNeverAnswering(w, 'rx18-x');
  const xSingleTimeouts = () => readsNaming(w, proc, AX, mark).filter((x) => isSingle(x) && x.outcome === 'timeout');
  await within(proc, 2 * MIN, () => xSingleTimeouts().length >= 1, 'fixture: X is marked, and its first read alone times out', 100);
  const firstX = xSingleTimeouts()[0];
  // Right after X's first single time-out (X is due again 5 s later, A1-13 "5→60 s"): 200 fresh taggings, then seven
  // co-members and Z, so Z's group is read after an answering scan in the next round.
  const Z = fresh('rx18-z');
  const AZ = addr(Z);
  w.relay.neverAnswers.add(AZ);
  const first = [];
  for (let i = 0; i < 200; i++) first.push(fresh(`rx18-first${i}`));
  const CO = [];
  for (let i = 0; i < 7; i++) CO.push(fresh(`rx18-co${i}`));
  const mark2 = w.nextSeq();
  const t0 = w.clock.t;
  await putNow(w, ...first, ...CO, Z);
  const bound = 2 * ROUND_SCAN_TIMEOUT_MS + 5 * SEC;
  await withinAll(proc, bound, () => CO.filter((ev) => !holdsId(w, ev)).map(addr),
    `A1 clarification 11: the co-members of the never-answering Z are reflected within two round-scan time-outs (2 × 20 s) plus a round of their store (A1-13; decision 9), though the slow single X is due beside them`);
  const group = readsNaming(w, proc, AZ, mark2).find((x) => x.outcome === 'timeout' && !isSingle(x));
  assert(group, 'fixture: Z\'s group scan timed out');
  const round = scansByRound(w, proc.n, { from: mark2 }).find((r) => r.scans.includes(group));
  assert(round && round.scans.slice(0, round.scans.indexOf(group)).some((x) => isRoundRead(x) && x.outcome === 'ok'),
    'fixture: another scan of that round answered before Z\'s group timed out (so its members were marked at once)');
  const coAddr = new Set([AZ, ...CO.map(addr)]);
  const firstCo = w.relay.scans.find((x) => x.proc === proc.n && x.seq > group.seq && isRoundRead(x) && isSingle(x) && H.scanAddresses(x.filter).some((a) => coAddr.has(a)));
  assert(firstCo, 'fixture: the newly marked members were read alone after their group\'s time-out');
  assert(endOf(firstX) + 5 * SEC <= firstCo.at, `fixture: X was due again (5 s after its first single time-out) when the newly marked members were first read alone (${((firstCo.at - endOf(firstX)) / SEC).toFixed(1)} s after it)`);
  const xBefore = readsNaming(w, proc, AX, group.seq).filter((x) => x.seq < firstCo.seq);
  assert(xBefore.length === 0, `A1 clarification 11: the newly marked members (no time-out of their own) are read alone before X (one) — X was read ${xBefore.length} time(s) first (${preview(xBefore.map((x) => x.outcome))})`);
  const coRound = scansByRound(w, proc.n, { from: mark2 }).find((rr) => rr.scans.includes(firstCo));
  const order = coRound.scans.filter((x) => isRoundRead(x) && isSingle(x) && x.seq >= firstCo.seq).map((x) => H.scanAddresses(x.filter)[0]);
  const want = CO.map(addr).concat([AZ]);
  assert(show(order.slice(0, want.length)) === show(want),
    `A1 clarification 11, ties by queue order: that round reads the seven co-members alone in their queue order, then Z; it read ${preview(order.map((a) => a.slice(-12)))}`);
});

test('RX19: a live delivery of a new version at an address while the round that parks it holds it lifts the park at once — a never-answering address X, marked and reading alone, receives a new version while its third single read is in flight, beside three other taggings: X is read again within a round of that read\'s time-out, and alone (the fresh item keeps the read-alone mark), while the three others are read together; its next single time-out re-parks it at the next level, so no scan names X for 30 minutes (the safety diffs meanwhile lift nothing), and then it is read alone again (A1 clarification 12: the fresh item keeps the read-alone mark and the park\'s level, so its next single time-out re-parks at the next level, and a catch-up does not lift a time-out park; A1-13 "parked like a refused write (5 min, 30 min, then every 6 h)"; § Failure handling: retried "at once on a new event at that address")', async () => {
  const w = newWorld();
  w.graph.keepRows = false;
  const proc = await boot(w);
  w.relay.scanWaits = true;
  const { X, AX, mark } = await storeMarkedNeverAnswering(w, 'rx19-x');
  const singles = () => readsNaming(w, proc, AX, mark).filter(isSingle);
  const X2 = version(X, 'rx19-x:v2');
  const OTH = [0, 1, 2].map((i) => fresh(`rx19-o${i}`));
  let third = null;
  const r = await drive(proc, 4 * MIN, {
    step: 100,
    until: () => third !== null,
    each: () => {
      const s = singles();
      if (s.length >= 3 && s[2].outcome === 'pending' && w.clock.t >= s[2].at + 5 * SEC) {
        third = s[2];
        put(w, X2, ...OTH); // their notices are delivered while X's third read alone is in flight
      }
    },
  });
  assert(r.done, `fixture: X's third read alone was in flight within 4 minutes (${singles().length} single read(s) of X: ${show(singles().map((x) => x.outcome))})`);
  assert(singles().slice(0, 2).every((x) => x.outcome === 'timeout'), 'fixture: X\'s first two reads alone timed out');
  await within(proc, 30 * SEC, () => third.outcome === 'timeout', 'fixture: X\'s third read alone times out (its third consecutive: the round parks X)', 100);
  const parkedAt = endOf(third);
  await within(proc, 30 * SEC, () => readsNaming(w, proc, AX, third.seq).length > 0,
    'A1 clarification 12: the live delivery of a new version at X lifts the park the round makes at once — X is read again', 100);
  const again = readsNaming(w, proc, AX, third.seq)[0];
  assert(again.at - parkedAt <= 5 * SEC, `A1 clarification 12: X is read again within a round of the park (at once), not at the park's timer; it came ${((again.at - parkedAt) / SEC).toFixed(1)} s after`);
  assert(isSingle(again), `A1 clarification 12 / A1-13: the fresh item keeps the read-alone mark — X's next read named ${H.scanAddresses(again.filter).length} addresses`);
  const othAddr = new Set(OTH.map(addr));
  const othRead = w.relay.scans.find((x) => x.proc === proc.n && x.seq > third.seq && x.kind === 'address' && x.outcome === 'ok' && H.scanAddresses(x.filter).some((a) => othAddr.has(a)));
  assert(othRead && H.scanAddresses(othRead.filter).length >= 2, `fixture: the three others stored with X's new version were read together (an unmarked X would have joined them); ${othRead ? `their read named ${H.scanAddresses(othRead.filter).length}` : 'they were not read'}`);
  await within(proc, 30 * SEC, () => again.outcome === 'timeout', 'fixture: X\'s next read alone times out', 100);
  const reparkedAt = endOf(again);
  await drive(proc, Math.max(0, reparkedAt + 30 * MIN + 30 * SEC - w.clock.t), 1000);
  const later = readsNaming(w, proc, AX, again.seq);
  const early = later.filter((x) => x.at < reparkedAt + 30 * MIN - 5 * SEC);
  assert(early.length === 0,
    `A1 clarification 12: X's next single time-out re-parks it at the park's next level (30 minutes; no safety diff lifts it, A1 clarification 12) — ${early.length} scan(s) named X within 30 minutes: ${preview(early.map((x) => `${x.outcome} +${((x.at - reparkedAt) / SEC).toFixed(0)} s`))}`);
  const retry = later[0];
  assert(retry && retry.at <= reparkedAt + 30 * MIN + 20 * SEC,
    `A1-13: X is retried at the 30-minute timer; ${retry ? `its next read came ${((retry.at - reparkedAt) / SEC).toFixed(0)} s after the re-park` : 'no scan named it within 30.5 minutes'}`);
  assert(isSingle(retry), `A1-13: X is still read alone at the timer; that read named ${H.scanAddresses(retry.filter).length} addresses`);
});

// ─── run ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- tagging-edges real-time resilience tests (epic tagging-edges, Story 3 — Amendment A1, fake deps) ---');
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
  console.log(`\ntagging-edges-realtime-resilience: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}
