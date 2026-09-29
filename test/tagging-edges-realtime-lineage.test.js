'use strict';
/**
 * Tests for Story 3 (epic tagging-edges) — the real-time path's LINEAGE: revokes by event id, and what an empty read
 * keeps (ADR 0003 Amendment A1). Engine level, driven through the T20 seam with every dependency faked.
 *
 * Story: engineering-team/stories/tagging-edges/3-real-time-path.md — AC-2, AC-3 ("What a removal needs": "A deletion
 *        naming a version the path has since seen replaced at that address prompts nothing"), AC-4 and AC-6, as
 *        amended at Architecture on 2026-09-29 by Amendment A1.
 * ADR:   engineering-team/decisions/tagging-edges/0003-real-time-path.md — § Amendment A1: A1-1 (the lineage), A1-2
 *        (learning; a read or scan placed at its capture), A1-3 (an e target resolves only as its address's top), A1-4
 *        (the gate: clause i, clause ii), A1-5 (no discards; at most 8 by-e revokes per entry), A1-6 (absolute v / o
 *        lines, lineage rows, the unfed backlog in pending), A1-7 (older capped at 8), A1-8 (the census), A1-9 (the
 *        catch-up: arrivals learned, rule 2 names tops, found revokes journaled), A1-10 (the first start's catch-up),
 *        A1-12 (parked prompts persist), A1-15, A1-16 (owner decisions 2, 5, 10 and 11), A1-18 (lastReflectedAt), and
 *        A1-20's engine scenarios 1–7, 11, 12, 13, 15 and 16. Owner decision 11 was accepted on 2026-09-29: RL19–RL21
 *        DOCUMENT its three shapes by asserting the accepted removal (were it declined, they would invert into "kept").
 * Fakes: test/helpers/taggingEdgesRealtimeFakes.js — as extended for A1: live-notice faults (relay.holdNotices /
 *        releaseNotices, relay.loseNotice, relay.deleteHidesNextWrite), graph.readDelay (the census's own deadline),
 *        scans that time out cost their timeoutMs of fake time, relay.neverAnswers; fixtures from
 *        test/helpers/taggingEdgesFixtures.js. Every pubkey is a fake: never a deployment's TA, never the ADR 0015 literal.
 *
 * Sources: A1-20's scenarios, ported from the round-2 reproduction scripts (the stale by-e family, revoke-paths-2's
 * modes, the reconnect gap, NEW-1, NEW-2, NEW-4, the put-back and re-look discards, the parked revoke, r2-gap) and the
 * amendment's design and red-team probes (the census, mid-catch-up compaction, the flood caps, decision 11's shapes).
 *
 * Intentionally failing until the implementation realises A1 (red phase): the engine is require()d LAZILY through
 * load() (the fakes call it when a process is spawned), so the suite always loads. Against the round-1 engine
 * RL1–RL17 fail on the pre-A1 behaviour A1 forbids (a removal on a stale by-id deletion, a revoke an empty read or a
 * discard lost, no census, no first-start catch-up, no lineage in record.json …), never on an import error. RL18–RL22
 * pass there too — behaviour A1 keeps: clause (ii)'s intended case (RL18), the removals decision 11 accepts, which the
 * round-1 engine also makes (RL19–RL21), and a revoke gone stale while it waits, discarded there and inert here (RL22).
 *
 * RL23–RL27 come from the validating Tester's mutation pass over the A1 reference (Test Design, 2026-09-29): each pins
 * an A1 rule a mutant broke while every earlier test passed — the gate's copy of the lineage taken before the round's
 * own read is learned (RL23, A1-4), the graph's version joining older beside a round's read and a catch-up's scan
 * (RL24, A1-2), the census joining no older where a restored lineage holds the address (RL25, A1-8), and a catch-up's
 * compaction keeping what was learned after its capture, in older (RL26) and as a whole lineage (RL27, A1-7). Each also
 * fails on the round-1 engine: a discard, relative v lines, S ∪ H resolution, or a record with no lineage rows.
 *
 * Conventions (test/tagging-edges-realtime-engine.test.js): a test spawns a process (deps + createEngine), awaits
 * start(), then drive()s it: advance the fake clock by a step, await tick(), let scheduled callbacks run, repeat.
 * Assertions state only the bounds the criteria state, in simulated time ("within 60 s", "within 5 minutes"), never
 * how many ticks or rounds it took. A hook that must let the engine drain a delivery while one of its calls is in
 * flight waits on the fake clock (waitClock): the driver keeps ticking meanwhile. A restart is a new process over the
 * same store, relay and graph; a crash is a process killed without a signal.
 *
 * Harness rules (run()): process.exit is trapped during each test (T20); an unhandled rejection or a subscription
 * callback that throws fails the test; every process a test spawned is killed when it ends; deps.sleep called inside
 * start() or tick() rejects (T29).
 *
 * Hand-rolled in the project's existing test style — no new framework. Stack-free: no Neo4j, no strfry, no network,
 * no filesystem. Node 16 and 22.
 */

const path = require('path');
const F = require('./helpers/taggingEdgesFixtures');
const H = require('./helpers/taggingEdgesRealtimeFakes');

const REPO = path.resolve(__dirname, '..');
const ENGINE_REL = 'src/pipeline/tagging-edges/realtime/index.js';
const ENGINE = path.join(REPO, ENGINE_REL);

const { CAROL, idOf } = F;
const { NOW_S, drive } = H;

const SEC = 1000;
const MIN = 60 * SEC;
const PASS_RUN = '20260929T120500Z-aaaa0001';

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
function sameSet(actual, expected, label) {
  const a = [...(actual || [])].sort();
  const e = [...expected].sort();
  if (show(a) !== show(e)) throw new Error(`${label}\n        expected (${e.length}): ${preview(e)}\n        actual   (${a.length}): ${preview(a)}`);
}
const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

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
/** A fixture tagging's address (every fixture here has a short, plain first d, or one of at most 255 bytes). */
const addr = (ev) => `39999:${ev.pubkey}:${firstD(ev)}`;

/** A tagging at its own address `39999:<author>:rl-<name>` (Alice tags Bob by default, canonical stamp). */
function tg(name, o = {}) {
  return F.makeTagging(Object.assign({ d: `rl-${name}`, id: idOf(`rl:${name}`), createdAt: NOW_S - 1000 }, o));
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
  return F.makeTagging(Object.assign(fieldsOf(ev), { id: idOf(`rl:${name}`), createdAt: ev.created_at + 10 }, o));
}
/** A kind-5 deletion (Alice's unless `author` is given), created now. */
function del(name, o = {}) {
  return F.makeDeletion(Object.assign({ id: idOf(`rl:del:${name}`), createdAt: NOW_S }, o));
}
/** An address deletion dated long before every version here: strfry removes nothing, but it prompts a look (AC-2). */
function look(name, address) { return del(`look:${name}`, { a: [address], createdAt: NOW_S - 50000 }); }

// ─── observing the world ───────────────────────────────────────────────────────────────────────────────────────
/** The event id the graph's relationship at an address records, or null when the graph holds none there. */
function eventIdAt(w, address) {
  const row = w.graph.rows.get(address);
  const p = row ? H.propOf(row, 'eventId') : null;
  return p && typeof p.text === 'string' ? p.text : null;
}
/** Short names for a scenario's ids, for messages. */
function namer(ids) {
  return (x) => {
    for (const [k, v] of Object.entries(ids)) if (v === x) return k;
    return x === null || x === undefined ? 'nothing' : String(x).slice(0, 8);
  };
}
const absent = (w, address) => !w.graph.rows.has(address);
/** The event ids of the relationships committed removals took away at `address` (after `mark`, a w.nextSeq() value). */
function removedAt(w, address, mark = 0) {
  const out = [];
  for (const x of w.graph.writes) {
    if (x.seq <= mark || x.kind !== 'remove' || !x.result || !Array.isArray(x.result.appliedAddresses)) continue;
    if (!x.result.appliedAddresses.includes(address)) continue;
    const r = (x.rows || []).find((y) => y && y.address === address);
    const snap = r && (r.snapshot || r.row);
    const p = snap && Array.isArray(snap.props) ? snap.props.find((q) => Array.isArray(q) && q[0] === 'eventId') : null;
    out.push(p ? p[2] : null);
  }
  return out;
}
/** Did a committed write (a create, an update or a move) put the relationship for `id` at `address`? */
function wrote(w, address, id) {
  return w.graph.writes.some((x) => x.kind !== 'remove' && x.result && Array.isArray(x.result.appliedAddresses)
    && x.result.appliedAddresses.includes(address)
    && (x.rows || []).some((r) => r && r.address === address && r.desired && r.desired.eventId === id));
}
/** The relay scans that named an address (after `mark`). */
function scansOf(w, address, mark = 0) {
  return w.relay.scans.filter((s) => s.seq > mark && s.filter && H.filterTargets(s.filter, address));
}
/**
 * A successful read of that address taken after `mark` — the moment the relay stopped holding anything there (its
 * caller's), so the read found it empty whether it named the address alone or in a group.
 */
function emptyReadOf(w, address, mark) {
  return scansOf(w, address, mark).find((s) => s.outcome === 'ok') || null;
}
/** A process's stamp scans that completed (a baseline's or a catch-up's). */
function stampScans(w, proc) { return w.relay.scans.filter((s) => s.proc === proc.n && s.kind === 'stamp' && s.outcome === 'ok'); }
/** A process's successful kind-5 candidate scans that found at least one deletion. */
function foundDeletions(w, proc) {
  return w.relay.scans.filter((s) => s.proc === proc.n && s.kind === 'deletion' && s.outcome === 'ok' && s.n >= 1);
}
/** record.json's lineage row at an address — [address, top, older?] (A1-6) — from a record body, or null. */
function lineageRowIn(rec, address) {
  const rows = isPlainObject(rec) && Array.isArray(rec.lineage) ? rec.lineage : [];
  return rows.find((r) => Array.isArray(r) && r[0] === address) || null;
}
/** The entry record.json carries for an address: its pending row's, else its parked row's (A1-6, A1-12), or null. */
function recordEntryAt(rec, address) {
  if (!isPlainObject(rec)) return null;
  for (const key of ['pending', 'parked']) {
    const row = (Array.isArray(rec[key]) ? rec[key] : []).find((x) => isPlainObject(x) && x.a === address);
    if (row && isPlainObject(row.entry)) return { from: key, row, entry: row.entry };
  }
  return null;
}
const revokesOf = (entry) => (isPlainObject(entry) && Array.isArray(entry.revokes) ? entry.revokes.filter(isPlainObject) : []);
/**
 * Keep a JSON copy of every record.json body a process writes (before the store adds its checksum), in order. The
 * store's methods are the process's own deps.store, so wrapping one reaches exactly that engine.
 */
function recordBodies(proc) {
  const bodies = [];
  const api = proc.deps.store;
  const writeRecord = api.writeRecord;
  api.writeRecord = (body) => {
    if (!proc.killed) { try { bodies.push(JSON.parse(JSON.stringify(body))); } catch (_) { bodies.push(null); } }
    return writeRecord(body);
  };
  return bodies;
}

/**
 * Inside a fake's hook (a scan, a write) while the engine's call is in flight: let the driver run ticks until `ms` of
 * simulated time have passed (it advances the clock between them), so live deliveries are drained meanwhile. →
 * whether that much time passed (false: no driver was running).
 */
async function waitClock(w, ms, maxTurns = 40000) {
  const until = w.clock.t + ms;
  for (let i = 0; i < maxTurns && w.clock.t < until; i += 1) await new Promise((r) => setImmediate(r));
  return w.clock.t >= until;
}
/** Spin event-loop turns until `pred` holds (the driver keeps ticking meanwhile). → whether it held. */
async function spinUntil(pred, maxTurns = 40000) {
  for (let i = 0; i < maxTurns; i += 1) { if (pred()) return true; await new Promise((r) => setImmediate(r)); }
  return pred();
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

/** The status as last WRITTEN to status.json. */
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
  const lastWrites = writes.slice(-4).map((x) => `${x.kind}×${x.n}${x.error ? `(${x.error})` : ''}`).join(', ');
  const lastScans = w.relay.scans.slice(-4).map((s) => `${s.kind}:${s.outcome}`).join(', ');
  return [
    `status: state ${show(st && st.state)}, pending ${show(st && st.pending)}, parked ${show(st && st.parked)}, lastError ${show(st && st.lastError)}, catchUp.last ${show(at(st, 'catchUp.last.outcome'))}, removalsNotPrompted ${show(at(st, 'counts.removalsNotPrompted'))}`,
    `graph: ${w.graph.rows.size} TAGS at tagging addresses; ${writes.length} write call(s)${lastWrites ? ` (last: ${lastWrites})` : ''}`,
    `relay: ${w.relay.subCalls.length} subscribe call(s), ${w.relay.openSubs().length} open; ${w.relay.scans.length} scan(s)${lastScans ? ` (last: ${lastScans})` : ''}`,
  ].join('\n        ');
}

/** Drive until `pred` holds; fail naming `what` and the bound if it does not within `ms` of simulated time. */
async function within(proc, ms, pred, what, step = 100) {
  const r = await drive(proc, Math.max(0, ms), { step, until: pred });
  if (!r.done) {
    const ex = r.exit !== undefined ? ` (tick() answered exit ${r.exit} after ${r.elapsed} ms)` : '';
    throw new Error(`${what}: not within ${Math.round(ms / 100) / 10} s of simulated time${ex}\n        ${diag(proc)}`);
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
/** Stop a process: 'signal' (a deploy: SIGTERM) or 'switch' (the owner turns it off); either way exit 0 within 5 s. */
async function stop(w, proc, how) {
  if (how === 'signal') {
    await H.guarded(() => proc.engine.handleSignal('SIGTERM'), "handleSignal('SIGTERM')");
  } else {
    w.store.setSwitch(false);
  }
  const r = await drive(proc, 5 * SEC, 50);
  eq(r.exit, 0, `fixture: after ${how === 'signal' ? 'a SIGTERM' : 'the switch going off'}, tick() answers { exit: 0 } within 5 s (T29, AC-5)\n        ${diag(proc)}`);
  proc.kill();
}
/** Keep an address's relationship at one event id for the whole of `ms`; fail naming the rule the moment it moves. */
async function keeps(proc, ms, address, id, nm, why) {
  const w = proc.world;
  await hold(proc, ms, `the relationship at ${address.slice(0, 24)}…`, 500, () => {
    const now = eventIdAt(w, address);
    if (now !== id) {
      throw new Error(`the relationship recording ${nm(id)} was ${now === null ? 'REMOVED' : `changed to ${nm(now)}`} (${why})\n        removals committed there took away: ${show(removedAt(w, address).map(nm))}\n        ${diag(proc)}`);
    }
  });
}

/* ═══════════════════════ A1-20 (1): the stale by-e family — the newer relationship is KEPT ═══════════════════════ */

test('RL1: a by-id deletion of v1 stored after v2 replaced it (strfry acts on nothing) and drained while the round that writes v2 is still in flight — during its address scan, its element read, or its write — prompts nothing; when v2 then leaves the relay with no event, a later look reads the address empty and the relationship recording v2 is kept (AC-3 "a deletion naming a version the path has since seen replaced at that address prompts nothing"; ADR 0003 A1-3: an e target resolves only while it is its address\'s top; A1-4; A1-5 "nothing discards a revoke prompt" — none is made)', async () => {
  const EL = F.makeElement({ id: idOf('rl1:el'), d: 'rl1-tag' });
  await cases([
    { name: 'drained during the round\'s address scan', at: 'address' },
    { name: 'drained during the round\'s element read (v2 names its tag only by id)', at: 'element' },
    { name: 'drained during the round\'s write', at: 'write' },
  ], async (c) => {
    const w = newWorld();
    put(w, EL);
    const proc = await boot(w);
    const V1 = tg(`rl1-${c.at}`, c.at === 'element' ? { a: null, e: EL.id, createdAt: NOW_S } : { createdAt: NOW_S });
    const A = addr(V1);
    put(w, V1);
    await within(proc, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
    await drive(proc, 2 * SEC, 100);
    const V2 = version(V1, `rl1-${c.at}:v2`, { polarity: '-1' });
    const K1 = del(`rl1-${c.at}-k1`, { e: [V1.id], createdAt: NOW_S + 30 });
    const nm = namer({ v1: V1.id, v2: V2.id });
    let injected = false;
    let drained = false;
    let readsOfA = 0;
    let departed = false;
    let departMark = null;
    const inject = async () => {
      injected = true;
      put(w, K1); // v2 already replaced v1: strfry acts on nothing
      drained = await waitClock(w, 500); // ticks drain the kind-5 while this round is in flight
    };
    const orig = w.relay.scan;
    w.relay.scan = async (filter, opts, p) => {
      if (H.filterTargets(filter, A)) {
        readsOfA += 1;
        // v2 leaves with no event (an operator's delete, an expiry) before the next read of A.
        if (readsOfA >= 2 && !departed) { departed = true; w.relay.remove(V2.id); departMark = w.nextSeq(); }
      }
      const res = await orig(filter, opts, p);
      if (!injected && readsOfA === 1) {
        if (c.at === 'address' && H.filterTargets(filter, A)) await inject();
        else if (c.at === 'element' && H.scanIds(filter).includes(EL.id)) await inject();
      }
      return res;
    };
    if (c.at === 'write') {
      w.graph.beforeApply = async (kind, rows) => { if (!injected && rows.some((r) => r && r.address === A)) await inject(); };
    }
    put(w, V2);
    await within(proc, MIN, () => drained && wrote(w, A, V2.id),
      `fixture: the round that read v2 heard the stale kind-5 while ${c.name.replace(/^drained /, '')} and updated the relationship to v2`, 50);
    if (!departed) put(w, look(`rl1-${c.at}`, A)); // a look reads A again (the deletion itself prompted nothing)
    await keeps(proc, 90 * SEC, A, V2.id, nm, 'a by-id deletion of the replaced v1 prompts nothing: A1-3, AC-3');
    assert(departed && emptyReadOf(w, A, departMark), `fixture: a read of A after v2 left found it empty (reads of A: ${readsOfA})\n        ${diag(proc)}`);
    eq(removedAt(w, A).length, 0, 'removals committed at A');
  });
});

test('RL2: a by-id revoke of v1 that a restart\'s catch-up found, still waiting in its unfed backlog (behind 6,500 arrivals) when Alice re-applies v2, which is heard, written, and then leaves the relay with no event, removes nothing when it is fed: the relationship recording v2 is kept (AC-3 "What a removal needs"; ADR 0003 A1-4: neither clause holds for v2 — v1 is not the top; A1-5 "a catch-up\'s work and backlog … carry prompts unchanged"; A1-9)', async () => {
  const w = newWorld();
  const p1 = await boot(w);
  const V1 = tg('rl2', { createdAt: NOW_S });
  const A = addr(V1);
  put(w, V1);
  await within(p1, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
  await drive(p1, 2 * SEC, 100);
  await stop(w, p1, 'signal');
  // Downtime: 6,500 arrivals from Carol, and Alice's revoke of v1 by id (strfry deletes v1).
  putAll(w, F.manyTaggings(6500, { prefix: 'rl2-bulk', author: CAROL, createdAt: NOW_S - 5000 }));
  put(w, del('rl2-k1', { e: [V1.id], createdAt: NOW_S + 5 }));
  await w.advance(5 * SEC);
  const V2 = version(V1, 'rl2:v2', { polarity: '-1' });
  const nm = namer({ v1: V1.id, v2: V2.id });
  const p2 = w.spawn();
  let phase = 0;
  let departMark = null;
  const orig = w.relay.scan;
  w.relay.scan = async (filter, opts, p) => {
    if (p && p.n === p2.n) {
      // v2 leaves with no event once the path has written it, before the found revoke is fed.
      if (phase === 2 && departMark === null && eventIdAt(w, A) === V2.id) { w.relay.remove(V2.id); departMark = w.nextSeq(); }
      const kind = H.filterKind(filter);
      if (phase === 0 && kind === 'stamp') phase = 1;
      else if (phase === 1 && kind === 'address') {
        phase = 2;
        const res = await orig(filter, opts, p);
        put(w, V2); // a catch-up round is in flight, and A's found revoke waits in the unfed backlog: Alice re-applies at A
        await waitClock(w, 600);
        return res;
      }
    }
    return orig(filter, opts, p);
  };
  await H.startEngine(p2);
  await within(p2, 5 * MIN, () => {
    const st = statusOf(p2);
    return departMark !== null && !!st && st.pending === 0 && at(st, 'catchUp.underway') === false && at(st, 'catchUp.last.outcome') === 'done';
  }, 'fixture: the catch-up completes, and v2 was written and then left the relay', 100);
  assert(foundDeletions(w, p2).length >= 1, `fixture: the start's catch-up found Alice's revoke of v1 (its kind-5 candidate scan)\n        ${diag(p2)}`);
  await keeps(p2, 30 * SEC, A, V2.id, nm, 'the found revoke names v1, which is not the top once v2 was learned: A1-4, AC-3');
  assert(emptyReadOf(w, A, departMark), `fixture: the found revoke's round read A after v2 left, and found it empty\n        ${diag(p2)}`);
  eq(removedAt(w, A).length, 0, 'removals committed at A');
});

test('RL3: a by-id deletion of v1 that arrives after v2 was heard (strfry acts on nothing) prompts nothing — when v2 leaves the relay with no event before its round reads the address, the relationship is kept: the one recording v2 that a pass (whose read saw v2) wrote meanwhile, or, with no pass, the one still recording v1 (AC-3 "What a removal needs"; ADR 0003 A1-3, A1-4; A1-15 "a revoke of an old version authorises removing a newer one only when the path never received the newer store\'s notice")', async () => {
  await cases([
    { name: 'a pass whose read saw v2 writes v2', pass: true },
    { name: 'no pass: the graph still records v1', pass: false },
  ], async (c) => {
    const w = newWorld();
    const p = await boot(w);
    const tag = c.pass ? 'p' : 'n';
    const V1 = tg(`rl3-${tag}`, { createdAt: NOW_S });
    const A = addr(V1);
    put(w, V1);
    await within(p, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
    await drive(p, 2 * SEC, 100);
    const B = tg(`rl3-${tag}-b`, { createdAt: NOW_S });
    const V2 = version(V1, `rl3-${tag}:v2`, { polarity: '-1', createdAt: NOW_S + 20 });
    const K1 = del(`rl3-${tag}-k1`, { e: [V1.id], createdAt: NOW_S + 30 }); // stored after v2: strfry acts on nothing
    const nm = namer({ v1: V1.id, v2: V2.id });
    let done = false;
    let timed = false;
    let departMark = null;
    const orig = w.relay.scan;
    w.relay.scan = async (filter, opts, pr) => {
      const res = await orig(filter, opts, pr);
      if (!done && H.filterTargets(filter, addr(B))) {
        // A round for another address is in flight; A's round waits behind it.
        if (c.pass) w.passStart(PASS_RUN);
        put(w, V2);
        const a = await waitClock(w, 300); // v2 is heard
        put(w, K1);
        const b = await waitClock(w, 300); // the kind-5 is drained
        timed = a && b;
        if (c.pass) w.passWrite(F.contractEdge(V2));
        w.relay.remove(V2.id); // v2 leaves with no event
        departMark = w.nextSeq();
        if (c.pass) w.passEnd(PASS_RUN);
        done = true;
      }
      return res;
    };
    put(w, B);
    await within(p, MIN, () => done, 'fixture: the round for another address runs', 50);
    assert(timed, 'fixture: the driver ran ticks while that round was in flight (v2 and the kind-5 were drained)');
    const want = c.pass ? V2.id : V1.id;
    await keeps(p, 90 * SEC, A, want, nm, 'the deletion names v1 after v2 was heard: A1-3, AC-3');
    assert(emptyReadOf(w, A, departMark), `fixture: A's round read the address empty\n        ${diag(p)}`);
    eq(removedAt(w, A).length, 0, 'removals committed at A');
  });
});

test('RL4: while the path is off, v2 replaces v1 and a by-id deletion names v1 — stale (after v2), revoked first (before v2), or after v2 was heard before the switch-off — the pass writes v2, and v2 leaves with no event: 3 minutes after the switch-on the relationship recording v2 is kept (AC-3; ADR 0003 A1-9: rule 2 names lineage tops only; A1-4: the found by-id revoke of v1 satisfies neither clause for v2; A1-16 decision 2)', async () => {
  await cases([
    { name: 'stale: v2, then the deletion of v1', mode: 'stale' },
    { name: 'revoked first: the deletion of v1 (strfry deletes it), then v2', mode: 'revoked-first' },
    { name: 'heard-v2: v2 heard before the switch-off (its read failed), then the deletion of v1', mode: 'heard-v2' },
  ], async (c) => {
    const w = newWorld();
    const p1 = await boot(w);
    const V1 = tg(`rl4-${c.mode}`, { createdAt: NOW_S - 100 });
    const A = addr(V1);
    put(w, V1);
    await within(p1, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
    await drive(p1, 2 * SEC, 100);
    const V2 = version(V1, `rl4-${c.mode}:v2`, { createdAt: NOW_S - 50, polarity: '-1' });
    const K1 = del(`rl4-${c.mode}-k1`, { e: [V1.id] });
    const nm = namer({ v1: V1.id, v2: V2.id });
    if (c.mode === 'heard-v2') {
      w.relay.scanFail = (filter) => (H.filterTargets(filter, A) ? 'exit' : null);
      put(w, V2);
      await drive(p1, 3 * SEC, 100);
    }
    await stop(w, p1, 'switch');
    w.store.setSwitch(true);
    w.relay.scanFail = null;
    if (c.mode === 'revoked-first') put(w, K1, V2);
    else if (c.mode === 'stale') put(w, V2, K1);
    else put(w, K1);
    w.passWrite(F.contractEdge(V2), { keepRid: true }); // the daily pass reads v2 and updates the relationship
    w.relay.remove(V2.id); // v2 leaves with no event (an expiry, an operator's delete)
    await w.advance(10 * MIN);
    const p2 = await restart(w);
    await keeps(p2, 3 * MIN, A, V2.id, nm, 'no deletion names v2 or the address: A1-4, A1-9, AC-3');
    assert(at(statusOf(p2), 'catchUp.last.outcome') === 'done', `fixture: the switch-on's catch-up completed\n        ${diag(p2)}`);
    eq(removedAt(w, A).length, 0, 'removals committed at A');
  });
});

test('RL22: a by-id revoke that goes stale while it waits is inert — Alice revokes v2 by id (strfry deletes it) and then publishes v3 before the revoke\'s round; v3 leaves the relay with no event: the relationship recording v1 is kept, in-process and across a restart, because clause (ii) needs the revoke\'s target to be the latest version learned, and v3 replaced v2 (AC-3 "What a removal needs"; ADR 0003 A1-5 "A stale by-e prompt is inert under A1-3 and A1-4"; A1-4 clause ii "X is the top of A\'s lineage")', async () => {
  const w = newWorld();
  const p1 = await boot(w);
  const V1 = tg('rl22', { createdAt: NOW_S - 100 });
  const A = addr(V1);
  put(w, V1);
  await within(p1, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
  await drive(p1, 2 * SEC, 100);
  const V2 = version(V1, 'rl22:v2', { polarity: '-1' });
  const V3 = version(V1, 'rl22:v3', { createdAt: V1.created_at + 20 });
  const nm = namer({ v1: V1.id, v2: V2.id, v3: V3.id });
  put(w, V2, del('rl22-k2', { e: [V2.id] }), V3); // v2, its revoke by id (strfry acts), then v3: all heard in store order
  w.relay.remove(V3.id); // v3 leaves with no event before the revoke's round reads the address
  const mark = w.nextSeq();
  await within(p1, 10 * SEC, () => !!emptyReadOf(w, A, mark), 'fixture: the round for v2, its revoke and v3 reads A (empty)', 50);
  await keeps(p1, 90 * SEC, A, V1.id, nm, 'the revoke names v2, and v3 replaced it: clause (ii) needs the top (A1-4); a stale prompt is inert (A1-5)');
  await stop(w, p1, 'signal');
  const p2 = await restart(w);
  await keeps(p2, 3 * MIN, A, V1.id, nm, 'after a restart, the replayed revoke of v2 is still inert (A1-4, A1-5)');
  eq(removedAt(w, A).length, 0, 'removals committed at A');
});

/* ════════════════════════ A1-20 (2)–(5): revokes an empty read or a discard used to lose ════════════════════════ */

test('RL5: v2 is heard while its reads fail, the websocket drops, and Alice revokes v2 by id in the gap; v2\'s retry then reads the address EMPTY before the reconnect\'s (deferred) catch-up — the empty read changes nothing, so the catch-up\'s rule 2 still names v2, finds the revoke, and the relationship recording v1 is removed within 5 minutes of the reconnect (AC-4; ADR 0003 A1-2 "An empty read changes nothing"; A1-9 rule 2; A1-4 clause ii, owner decision 11 accepted)', async () => {
  const w = newWorld();
  const p = await boot(w);
  const V1 = tg('rl5', { createdAt: NOW_S - 1000 });
  const A = addr(V1);
  put(w, V1);
  await within(p, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
  // A safety diff runs now, so the reconnect's catch-up below falls inside its 30 s spacing and is deferred.
  const t9 = w.clock.t + 9 * MIN;
  await within(p, 12 * MIN, () => w.relay.scans.some((s) => s.kind === 'stamp' && s.at >= t9 && s.outcome === 'ok'), 'fixture: the safety diff scans the relay', 1000);
  await drive(p, 3 * SEC, 100);
  const V2 = version(V1, 'rl5:v2');
  const K2 = del('rl5-k2', { e: [V2.id], createdAt: NOW_S + 700 });
  w.relay.scanFail = (filter) => (H.filterTargets(filter, A) ? 'exit' : null); // a strfry hiccup at A
  put(w, V2);
  await drive(p, SEC, 50); // v2 heard; its round's read fails and is retried after 5 s
  const dropAt = w.clock.t;
  w.relay.drop(); // the websocket drops …
  put(w, K2); // … and Alice's revoke of v2 lands in the gap: no subscription delivers it
  const dropMark = w.nextSeq();
  w.relay.scanFail = null;
  await within(p, MIN, () => !!emptyReadOf(w, A, dropMark), 'fixture: v2\'s retry reads A (empty)', 100);
  const empty = emptyReadOf(w, A, dropMark);
  const stamp = w.relay.scans.find((s) => s.seq > dropMark && s.kind === 'stamp');
  assert(!stamp || stamp.seq > empty.seq, 'fixture: the empty read of A came before the reconnect\'s catch-up scanned the relay');
  await within(p, 5 * MIN - (w.clock.t - dropAt), () => absent(w, A),
    'the relationship is removed within 5 minutes of the reconnect (AC-4: "every relationship whose tagging a revoke removed meanwhile is gone")', 200);
});

test('RL6: a read of the address taken after Alice\'s by-id revoke of the heard v2 was stored but before its notice was delivered (strfry\'s change notice lags its store) is empty and teaches nothing; when the notice arrives, v2 is still the top, the revoke resolves, and the relationship recording v1 is removed within 60 s of the revoke (AC-2; ADR 0003 A1-2 "An empty read changes nothing"; A1-3; A1-4 clause ii)', async () => {
  const w = newWorld();
  const p = await boot(w);
  const V1 = tg('rl6', { createdAt: NOW_S - 1000 });
  const A = addr(V1);
  put(w, V1);
  await within(p, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
  await drive(p, 2 * SEC, 100);
  const V2 = version(V1, 'rl6:v2', { polarity: '-1' });
  put(w, V2);
  await drive(p, 100, 50); // v2 is heard: its round is due 250 ms later
  w.relay.holdNotices = (ev) => ev.kind === 5; // the relay's change notice for the kind-5 is not sent yet
  put(w, del('rl6-k', { e: [V2.id] }));
  const storeMark = w.nextSeq();
  const storedAt = w.clock.t;
  assert(!w.relay.atAddress(A), 'fixture: the relay deleted v2 (it holds nothing at A)');
  await within(p, 10 * SEC, () => !!emptyReadOf(w, A, storeMark), 'fixture: v2\'s round reads A after the revoke was stored, before its notice', 50);
  w.relay.holdNotices = null;
  eq(w.relay.releaseNotices(), 1, 'fixture: the held notice of the kind-5 is delivered');
  await within(p, MIN - (w.clock.t - storedAt), () => absent(w, A), 'the relationship is removed within 60 s of the revoke (AC-2)', 100);
});

test('RL7: a version stored while the path was down is found by the restart\'s catch-up as an arrival and learned there; when Alice revokes it by id while its round is still backed off, the revoke resolves and the relationship recording v1 is removed within 60 s of the revoke (AC-2, AC-4; ADR 0003 A1-2 (3) "a catch-up\'s scan (arrivals included)"; A1-9 step 2; A1-4 clause ii)', async () => {
  const w = newWorld();
  const p1 = await boot(w);
  const V1 = tg('rl7', { createdAt: NOW_S - 1000 });
  const A = addr(V1);
  put(w, V1);
  await within(p1, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
  await stop(w, p1, 'signal');
  const V2 = version(V1, 'rl7:v2', { polarity: '-1' });
  put(w, V2); // stored while the path is down: nothing hears it
  await w.advance(20 * SEC);
  w.relay.scanFail = (filter) => (H.filterTargets(filter, A) ? 'exit' : null); // v2's first reads fail (backed off)
  const p2 = await restart(w);
  const failedReadOfA = () => w.relay.scans.some((s) => s.proc === p2.n && s.filter && H.filterTargets(s.filter, A) && s.outcome === 'exit');
  await within(p2, 30 * SEC, () => stampScans(w, p2).length >= 1 && failedReadOfA(), 'fixture: the start\'s catch-up scans the relay, and v2\'s first read fails', 50);
  put(w, del('rl7-k', { e: [V2.id] })); // the relay acts: A is empty; the path hears the kind-5 live
  const storedAt = w.clock.t;
  await drive(p2, SEC, 50);
  w.relay.scanFail = null;
  await within(p2, MIN - (w.clock.t - storedAt), () => absent(w, A), 'the relationship is removed within 60 s of the revoke (AC-2)', 100);
});

test('RL8: put-backs and re-looks carry revoke prompts unchanged — the round holding v2 and Alice\'s by-id revoke of v2 is put back after a failed read under the fresh item an ended pass\'s re-look made (a version prompt for the older v1), with or without a deferred catch-up, and the relationship recording v1 is still removed within 60 s of the revoke; and a revoke kept in a re-look removes the relationship the pass re-created from its older read once the pass ends (AC-2; AC-5 residual 2; ADR 0003 A1-5 "Put-backs, re-looks … carry prompts unchanged"; A1-4)', async () => {
  await cases([
    { name: 'put back under a re-look\'s fresh item', mode: 'putback' },
    { name: 'put back under a re-look\'s fresh item, a reconnect\'s catch-up having just run', mode: 'putback-deferred' },
    { name: 'a re-look keeps the revoke for the pass\'s residual 2', mode: 'relook' },
  ], async (c) => {
    const w = newWorld();
    const p = await boot(w);
    const V1 = tg(`rl8-${c.mode}`, { createdAt: NOW_S });
    const A = addr(V1);
    const V2 = version(V1, `rl8-${c.mode}:v2`, { polarity: '-1', createdAt: NOW_S + 20 });
    const K2 = del(`rl8-${c.mode}-k2`, { e: [V2.id], createdAt: NOW_S + 30 });
    if (c.mode === 'relook') {
      put(w, V1);
      await within(p, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
      await drive(p, 2 * SEC, 100);
      w.passStart(PASS_RUN);
      let n = 0;
      const orig = w.relay.scan;
      w.relay.scan = async (filter, opts, pr) => {
        const res = await orig(filter, opts, pr);
        if (H.filterTargets(filter, A) && (n += 1) === 1) {
          put(w, V2, K2); // during the look's round (it read v1), Alice publishes v2 and revokes it by id
          await waitClock(w, 500);
        }
        return res;
      };
      put(w, look(`rl8-${c.mode}`, A));
      await within(p, MIN, () => n >= 1 && absent(w, A), 'fixture: the revoke of v2 removes the relationship recording v1 while the pass runs');
      w.passWrite(F.contractEdge(V2)); // the pass re-creates from its older read (ADR 0002 residual 2)
      await drive(p, 3 * SEC, 100);
      assert(eventIdAt(w, A) === V2.id, 'fixture: the pass\'s re-creation is in the graph when the pass ends');
      w.passEnd(PASS_RUN);
      await within(p, MIN, () => absent(w, A), 'the re-look removes the relationship the pass re-created within 60 s of the pass ending (A1-5: the re-look carries the revoke)', 100);
      return;
    }
    w.passStart(PASS_RUN); // a pass overlaps the round that creates v1: a re-look {version v1} is kept for it
    put(w, V1);
    await within(p, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created while a pass overlaps');
    await drive(p, 2 * SEC, 100);
    if (c.mode === 'putback-deferred') {
      const mark = w.nextSeq();
      w.relay.drop(); // the websocket drops: the reconnect's catch-up runs now, so the one the pass's end asks for is deferred
      await within(p, MIN, () => w.relay.scans.some((s) => s.seq > mark && s.kind === 'stamp' && s.outcome === 'ok'), 'fixture: the reconnect\'s catch-up', 100);
      await drive(p, 2 * SEC, 100);
    }
    let hit = 0;
    let failOnce = false;
    let waited = false;
    const orig = w.relay.scan;
    w.relay.scan = async (filter, opts, pr) => {
      if (H.filterTargets(filter, A) && (hit += 1) === 1) {
        // The round holding {version v2, revokes [e:v2]} is reading A. The pass ends; the 5 s re-look check runs while
        // this round is in flight and queues the re-look {version v1} as a fresh item. Then this read fails.
        w.passEnd(PASS_RUN);
        waited = await waitClock(w, 6 * SEC, 80000);
        failOnce = true;
      }
      return orig(filter, opts, pr);
    };
    w.relay.scanFail = (filter) => (failOnce && H.filterTargets(filter, A) ? ((failOnce = false), 'exit') : null);
    put(w, V2, K2); // Alice revokes the current version v2 by id: the relay holds nothing at A
    const storedAt = w.clock.t;
    await within(p, MIN, () => absent(w, A), 'the relationship is removed within 60 s of the revoke (AC-2; A1-5: the put-back carries it)', 100);
    assert(hit >= 2 && waited, `fixture: A's first read ran while the pass ended, failed, and was retried (reads of A: ${hit})`);
    assert(w.clock.t - storedAt <= MIN, 'within 60 s of the revoke');
  });
});

/* ════════════════════════════ A1-20 (6), (7), (11): revokes across starts and restarts ════════════════════════════ */

test('RL9: at the first start (the backfill wrote v1), Alice\'s revoke of v1 stored right after the REQ — by id or by address, buffered, delivered on a first connection that drops before the baseline, or stored while the first connection drops during the baseline scan — is reflected within 60 s: the census knows v1 and the first start\'s own catch-up finds the revoke (AC-2, AC-4; ADR 0003 A1-8; A1-10 "Its candidate scan finds a revoke stored after the REQ, or across a pre-record reconnect")', async () => {
  await cases([
    { name: 'by id, stored after the REQ and buffered', by: 'e', mode: 'buffer' },
    { name: 'by address, stored after the REQ and buffered', by: 'a', mode: 'buffer' },
    { name: 'by id, delivered on a first connection that drops before the baseline', by: 'e', mode: 'reconnect' },
    { name: 'by id, the first connection dropping while the baseline scan runs', by: 'e', mode: 'drop-during-baseline' },
  ], async (c) => {
    const w = newWorld();
    const V1 = tg(`rl9-${c.by}-${c.mode}`, { createdAt: NOW_S - 100 });
    const A = addr(V1);
    put(w, V1);
    backfill(w, V1); // the owner-started backfill wrote it before the path was turned on
    const K1 = del(`rl9-${c.by}-${c.mode}`, c.by === 'e' ? { e: [V1.id] } : { a: [A] });
    let subs = 0;
    let storedAt = null;
    w.relay.onSubscribe = () => {
      subs += 1;
      if (subs !== 1) return;
      put(w, K1); // stored after the first REQ: delivered live
      storedAt = w.clock.t;
      if (c.mode === 'reconnect') setImmediate(() => setImmediate(() => w.relay.drop()));
    };
    if (c.mode === 'drop-during-baseline') {
      let n = 0;
      const orig = w.relay.scan;
      w.relay.scan = async (filter, opts, pr) => {
        if (H.filterKind(filter) === 'stamp' && (n += 1) === 1) {
          w.relay.drop();
          await spinUntil(() => w.relay.subCalls.length >= 2); // the path has seen the close and subscribed again
        }
        return orig(filter, opts, pr);
      };
    }
    const proc = w.spawn();
    await H.startEngine(proc);
    await within(proc, 30 * SEC, () => storedAt !== null, 'fixture: the first start subscribes', 50);
    assert(!w.relay.atAddress(A), 'fixture: the relay acted on the revoke');
    await within(proc, MIN - (w.clock.t - storedAt), () => absent(w, A), 'the relationship is removed within 60 s of the revoke (AC-2)', 100);
  });
});

test('RL10: a revoke-gated removal the database keeps refusing is parked with its prompts: record.json\'s parked row carries its entry, so after a compaction, a restart, and the relay losing the kind-5, the parked address is retried with Alice\'s by-id revoke and the relationship is removed within 5 minutes of the restart (AC-3, AC-4; ADR 0003 A1-12 "record.json\'s parked rows are {a, code, attempts, nextAt, entry}"; A1-6; A1-8; A1-4 clause ii)', async () => {
  const w = newWorld();
  const V0 = tg('rl10', { createdAt: NOW_S - 200 });
  const A = addr(V0);
  backfill(w, V0); // the backfill wrote v0
  const V1 = version(V0, 'rl10:v1', { createdAt: NOW_S - 100, polarity: '-1' });
  put(w, V1); // v1 replaced v0 on the relay before the path was turned on
  const nm = namer({ v0: V0.id, v1: V1.id });
  const p1 = await boot(w);
  w.graph.failWrites = (kind, rows) => (kind === 'remove' && rows.some((r) => r && r.address === A)
    ? H.neoError('Neo.DatabaseError.General.UnknownError', 'refused') : null);
  const K1 = del('rl10-k1', { e: [V1.id] });
  put(w, K1);
  await within(p1, 5 * MIN, () => num(statusOf(p1), 'parked') === 1, 'fixture: the removal the revoke prompts is refused twice with one code, and parked', 250);
  const parkedSeq = w.nextSeq();
  await within(p1, 12 * MIN, () => (w.store.recordSeq || 0) > parkedSeq, 'fixture: a safety diff compacts (record.json rewritten)', 1000);
  const got = recordEntryAt(w.store.record, A);
  const revs = revokesOf(got && got.entry);
  assert(got && got.from === 'parked' && revs.some((r) => r.by === 'e' && r.target === V1.id),
    `A1-12: record.json's parked row at A carries its entry, with Alice's revoke of v1 by id; got ${show(got && got.row)}`);
  await stop(w, p1, 'signal');
  w.graph.failWrites = null; // the database accepts the removal again
  w.relay.remove(K1.id); // the relay loses the kind-5: only the parked row still carries the revoke
  const p2 = await restart(w);
  await within(p2, 5 * MIN, () => absent(w, A), `the parked removal is made within 5 minutes of the restart (AC-4); graph at A: ${nm(eventIdAt(w, A))}`, 250);
});

test('RL11: a revoke a catch-up found survives a stop before its round even when the relay then loses the kind-5 — a restart then a wipe (the found revoke\'s d line), and a compaction in the middle of the catch-up, with the revoke still in its unfed backlog behind 9,000 arrivals, then a crash (record.json\'s pending carries the unfed backlog): the relationship is removed within 5 minutes of the next start (AC-4; ADR 0003 A1-9 "It is journaled as a d line … If a compaction happens while the catch-up\'s backlog is unfed, that backlog is written into record.json\'s pending"; A1-6)', async () => {
  await cases([
    { name: 'a stop before the found revoke\'s round, then a wipe', mode: 'wipe' },
    { name: 'a compaction mid-catch-up with the found revoke unfed, a crash, then the kind-5 lost', mode: 'mid-catch-up' },
  ], async (c) => {
    if (c.mode === 'wipe') {
      const w = newWorld();
      const p1 = await boot(w);
      const V1 = tg('rl11-w', { createdAt: NOW_S - 100 });
      const A = addr(V1);
      put(w, V1);
      await within(p1, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
      await drive(p1, 2 * SEC, 100);
      await stop(w, p1, 'signal');
      put(w, del('rl11-w-k1', { e: [V1.id] })); // while down: strfry deletes v1
      await w.advance(10 * SEC);
      w.graph.failReads = (op) => (op === 'readAt' ? H.serviceUnavailable() : null); // the found revoke's round cannot run
      const p2 = await restart(w);
      await within(p2, MIN, () => foundDeletions(w, p2).length >= 1, 'fixture: the start\'s catch-up finds the revoke', 100);
      await drive(p2, 2 * SEC, 100);
      assert(eventIdAt(w, A) === V1.id, 'fixture: the found revoke\'s round has not run');
      await stop(w, p2, 'signal');
      w.graph.failReads = null;
      w.relay.wipe(); // the owner wipes the relay: the kind-5 is gone
      const p3 = await restart(w);
      await within(p3, 5 * MIN, () => absent(w, A), 'the relationship is removed within 5 minutes of the start (AC-4), from the journal alone', 250);
      return;
    }
    const w = newWorld({ lean: true });
    w.graph.keepRows = false;
    w.keepScanFilters = false;
    const Z = tg('rl11-m', { createdAt: NOW_S - 500 });
    const AZ = addr(Z);
    put(w, Z);
    backfill(w, Z);
    const p1 = await boot(w);
    await stop(w, p1, 'signal');
    // While down: 9,000 arrivals at long addresses (d of about 240 bytes, so a journal of completions alone passes 1 MB
    // within about 2,700 of them), then Alice's revoke of Z by id. The catch-up queues it after every arrival, in
    // chunks of 5,000, so it is fed only once 4,001 arrivals were attempted: it is still in the unfed backlog when the
    // journal first passes 1 MB and a round-end compaction runs.
    const LONG = 'L'.repeat(230);
    putAll(w, F.manyTaggings(9000, { prefix: `rl11-${LONG}`, author: CAROL, createdAt: NOW_S - 5000 }));
    const K2 = del('rl11-m-k2', { e: [Z.id] });
    put(w, K2);
    const total = 9001;
    const p2 = w.spawn();
    let killedMid = false;
    let midRecord = null;
    const api = p2.deps.store;
    const writeRecord = api.writeRecord;
    api.writeRecord = (body) => {
      const r = writeRecord(body);
      if (!killedMid && !p2.killed && stampScans(w, p2).length >= 1 && w.graph.rows.size < total - 4000) {
        killedMid = true; // a crash right after the first compaction taken while the catch-up is still feeding its work
        midRecord = w.store.record;
        p2.kill();
      }
      return r;
    };
    await H.startEngine(p2);
    await drive(p2, 5 * MIN, { step: 100, until: () => killedMid || absent(w, AZ) });
    assert(killedMid, `fixture: a compaction ran while the catch-up was still feeding its work (the journal passed 1 MB)\n        ${diag(p2)}`);
    assert(eventIdAt(w, AZ) === Z.id, 'fixture: the found revoke had not been applied when the process died');
    const got = recordEntryAt(midRecord, AZ);
    assert(got && got.from === 'pending' && revokesOf(got.entry).some((r) => r.by === 'e' && r.target === Z.id),
      `A1-9: record.json written mid-catch-up carries the unfed backlog in pending, the found revoke of Z included; got ${show(got && got.row)} (${Array.isArray(midRecord && midRecord.pending) ? midRecord.pending.length : 'no'} pending rows)`);
    w.relay.remove(K2.id); // the relay loses the kind-5 (an operator's delete)
    const p3 = await restart(w);
    await within(p3, 5 * MIN, () => absent(w, AZ), 'the relationship is removed within 5 minutes of the restart (AC-4)', 250);
  });
});

/* ═════════════════════════════════════ A1-20 (12): the census (A1-8) ═════════════════════════════════════════ */

test('RL12: the census records a backfilled version — v1 replaced the backfill\'s v0 before the switch-on: the first start\'s record.json carries v0 under the baseline\'s v1, and Alice\'s by-id revoke of v1, stored before the first catch-up scans the relay, removes the relationship recording v0 within 60 s; when the census fails, nothing records v0, and that removal waits for the pass (AC-2, AC-4; ADR 0003 A1-8, A1-6, A1-10; A1-16 decision 2 "a relationship recording a version the path never learned … The exceptions: … a census recorded the older one")', async () => {
  await cases([
    { name: 'the census answers', census: 'ok' },
    { name: 'the census fails (the graph unavailable for its one key read)', census: 'fails' },
  ], async (c) => {
    const w = newWorld();
    const V0 = tg(`rl12-${c.census}`, { createdAt: NOW_S - 200 });
    const A = addr(V0);
    backfill(w, V0);
    const V1 = version(V0, `rl12-${c.census}:v1`, { createdAt: NOW_S - 100, polarity: '-1' });
    put(w, V1);
    const nm = namer({ v0: V0.id, v1: V1.id });
    if (c.census === 'fails') {
      let failed = false;
      w.graph.failReads = (op) => (op === 'readKeys' && !failed ? ((failed = true), H.serviceUnavailable()) : null);
    }
    // Alice revokes v1 by id just before the start's catch-up scans the relay (its second stamp scan, after the baseline's).
    const K = del(`rl12-${c.census}-k`, { e: [V1.id] });
    let stamps = 0;
    let storedAt = null;
    w.relay.onScan = (filter) => {
      if (H.filterKind(filter) === 'stamp' && (stamps += 1) === 2 && storedAt === null) { put(w, K); storedAt = w.clock.t; }
    };
    const proc = w.spawn();
    const bodies = recordBodies(proc);
    await H.startEngine(proc);
    await within(proc, 30 * SEC, () => !!w.store.started && storedAt !== null, 'A1-10: the first start is followed by one catch-up, which scans the relay', 50);
    const row = lineageRowIn(bodies[0], A);
    if (c.census === 'ok') {
      assert(row && row[1] === V1.id && Array.isArray(row[2]) && row[2].includes(V0.id),
        `A1-8 / A1-6: the first start's record.json has the lineage row [A, v1, [v0]] (the census's v0 under the scan's v1); got ${show(row && [row[0].slice(0, 12), nm(row[1]), (row[2] || []).map(nm)])}`);
      await within(proc, MIN - (w.clock.t - storedAt), () => absent(w, A), 'the relationship recording v0 is removed within 60 s of the revoke of v1 (A1-4 clause ii)', 100);
    } else {
      assert(!row || !Array.isArray(row[2]) || !row[2].includes(V0.id), `fixture: with the census failed, nothing records v0 at A; got ${show(row)}`);
      await keeps(proc, 3 * MIN, A, V0.id, nm, 'with no census, v0 is a version the path never learned there: the removal waits for the pass (A1-16 decision 2)');
      assert((num(statusOf(proc), 'counts.removalsNotPrompted') || 0) >= 1, `the held removal is counted in removalsNotPrompted\n        ${diag(proc)}`);
    }
  });
});

test('RL13: the census is placed under the scan at an address a restored lineage already holds — a lost record\'s re-baseline replays a lineage whose top is X, while another writer\'s G (from an older read) is what the graph records: the census\'s G joins older under the scan\'s X in record.json, and Alice\'s by-id revoke of X, stored before the catch-up scans the relay, removes the relationship recording G within 60 s (AC-2, AC-4; ADR 0003 A1-8 "Wherever the scan places a version X other than the census\'s id G, G joins older under X, including at addresses a restored lineage already holds"; A1-4 clause ii)', async () => {
  const w = newWorld();
  const p1 = await boot(w); // the first start: the relay holds nothing at A
  await stop(w, p1, 'signal');
  const G = tg('rl13', { createdAt: NOW_S - 300 });
  const A = addr(G);
  put(w, G); // stored while the path is down; a pass reads it now and writes it only later
  const X = version(G, 'rl13:x', { createdAt: NOW_S - 200, polarity: '-1' });
  put(w, X); // X replaces G, still while the path is down
  const nm = namer({ G: G.id, X: X.id });
  // The next start's catch-up learns X at A (an arrival), but no round can read the graph, so it never compacts.
  w.graph.failReads = (op) => (op === 'readAt' ? H.serviceUnavailable() : null);
  const p2 = await restart(w);
  await within(p2, MIN, () => stampScans(w, p2).length >= 1, 'fixture: the restart\'s catch-up scans the relay', 100);
  await drive(p2, 2 * SEC, 100);
  await stop(w, p2, 'signal');
  w.graph.failReads = null;
  w.passWrite(F.contractEdge(G)); // the pass writes G from its older read
  w.store.record = null; // record.json is lost; the journal survives: the next start re-baselines, with a census
  const K = del('rl13-k', { e: [X.id] });
  let stamps = 0;
  let storedAt = null;
  w.relay.onScan = (filter, call) => {
    if (call.proc === 3 && H.filterKind(filter) === 'stamp' && (stamps += 1) === 2 && storedAt === null) { put(w, K); storedAt = w.clock.t; }
  };
  const p3 = w.spawn();
  eq(p3.n, 3, 'fixture: the third process');
  const bodies = recordBodies(p3);
  await H.startEngine(p3);
  await within(p3, MIN, () => bodies.length >= 1 && storedAt !== null, 'fixture: the re-baseline writes record.json, then the catch-up scans the relay', 50);
  const row = lineageRowIn(bodies[0], A);
  assert(row && row[1] === X.id && Array.isArray(row[2]) && row[2].includes(G.id),
    `A1-8: the re-baseline's record.json has G under X at A ([A, X, [G]]); got ${show(row && [row[0].slice(0, 12), nm(row[1]), (row[2] || []).map(nm)])}`);
  await within(p3, MIN - (w.clock.t - storedAt), () => absent(w, A), 'the relationship recording G is removed within 60 s of the revoke of X (A1-4 clause ii)', 100);
});

test('RL14: a census whose one key read never answers, or answers after 15 s, holds a first start\'s REQ at most 10 s — the engine enforces its own deadline, the key read is not retried and comes before the REQ — and the start then proceeds: the baseline is taken and a tagging stored afterwards is created within 60 s (AC-4; ADR 0003 A1-8 "one readKeys call, with no retry; a 10 s deadline the engine enforces itself"; A1-10 step 1; A1-16 decision 5\'s fourth corner; T29)', async () => {
  await cases([
    { name: 'the census never answers', delay: Infinity },
    { name: 'the census answers after 15 s', delay: 15 * SEC },
  ], async (c) => {
    const w = newWorld();
    const P = tg(`rl14-${c.delay === Infinity ? 'hang' : 'late'}-p`, { createdAt: NOW_S - 100 });
    put(w, P);
    backfill(w, P);
    w.graph.readDelay = (op, o) => (op === 'readKeys' && o.nth === 1 ? c.delay : null);
    const proc = w.spawn();
    const t0 = w.clock.t;
    await H.startEngine(proc);
    await within(proc, 30 * SEC, () => !!w.store.started, 'the first start writes started.json', 50);
    const req = w.relay.subCalls[0];
    const census = w.graph.calls.filter((x) => x.op === 'readKeys' && x.proc === proc.n && req && x.seq < req.seq);
    eq(census.length, 1, 'A1-8: key reads before the first REQ (the census: one, not retried)');
    assert(req.at - t0 <= 10 * SEC + 500, `A1-8: the REQ is held at most 10 s by the census (the engine's own deadline); it came ${req.at - t0} ms after start()`);
    const N = tg(`rl14-${c.delay === Infinity ? 'hang' : 'late'}-n`, { createdAt: NOW_S });
    put(w, N);
    await within(proc, MIN, () => eventIdAt(w, addr(N)) === N.id, 'a tagging stored after the start is created within 60 s (AC-1)', 100);
    assert(eventIdAt(w, addr(P)) === P.id, 'the backfill\'s relationship is untouched');
  });
});

/* ══════════════════════ A1-20 (13): a read that cannot be placed teaches nothing (A1-2) ══════════════════════ */

test('RL15: a read that cannot be placed teaches nothing — a round\'s read returns v3 while v2\'s late notice is drained after its capture (v3\'s own notice never comes: the connection drops, or strfry\'s delete-hides-next-write loses it); a stale client then deletes v2 by id (strfry acts on nothing) and v3 leaves with no event: the revoke is found (the reconnect\'s catch-up, or on delivery), and the relationship recording v3 is kept (AC-3; ADR 0003 A1-2 "If the path learned anything at A after that capture, the read teaches nothing at A"; A1-15; A1-4)', async () => {
  await cases([
    { name: 'the connection drops before v3\'s notice', mode: 'drop' },
    { name: 'no reconnect: strfry\'s delete-hides-next-write loses v3\'s notice', mode: 'hides' },
  ], async (c) => {
    const w = newWorld();
    const p = await boot(w);
    const V1 = tg(`rl15-${c.mode}`, { createdAt: NOW_S - 1000 });
    const A = addr(V1);
    const V1b = version(V1, `rl15-${c.mode}:v1b`, { createdAt: NOW_S - 995, polarity: '-1' });
    const V2 = version(V1, `rl15-${c.mode}:v2`, { createdAt: NOW_S - 990, polarity: '1' });
    const V3 = version(V1, `rl15-${c.mode}:v3`, { createdAt: NOW_S - 980, polarity: '-1' });
    const K = del(`rl15-${c.mode}-k`, { e: [V2.id] });
    const nm = namer({ v1: V1.id, v1b: V1b.id, v2: V2.id, v3: V3.id });
    put(w, V1);
    await within(p, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
    await drive(p, 2 * SEC, 100);
    let injected = false;
    let released = false;
    let timed = false;
    // The round v1b's prompt starts: v2 and v3 are stored after its capture, just before its scan selects, so it
    // returns v3; their notices lag (held).
    w.relay.onScan = (filter) => {
      if (injected || !H.scanTouches(filter, 'address') || !H.filterTargets(filter, A)) return;
      injected = true;
      if (c.mode === 'drop') {
        w.relay.holdNotices = (ev) => ev.id === V2.id || ev.id === V3.id;
        put(w, V2, V3);
      } else {
        w.relay.holdNotices = (ev) => ev.id === V2.id;
        w.relay.deleteHidesNextWrite = true;
        put(w, V2);
        const spam = F.makeTagging({ d: 'rl15-spam', id: idOf(`rl15:${c.mode}:spam`), author: CAROL, kind: 1, stamps: [], createdAt: NOW_S });
        put(w, spam);
        w.relay.remove(spam.id); // an operator deletes the relay's newest event: strfry loses the next write's notice
        put(w, V3);
        w.relay.deleteHidesNextWrite = false;
      }
    };
    const orig = w.relay.scan;
    w.relay.scan = async (filter, opts, pr) => {
      const res = await orig(filter, opts, pr);
      if (injected && !released && H.filterTargets(filter, A)) {
        released = true;
        w.relay.releaseNotices((ev) => ev.id === V2.id); // v2's notice reaches the path while the round is in flight
        timed = await waitClock(w, 300); // a tick drains it before the round completes
        if (c.mode === 'drop') {
          put(w, K); // a stale client deletes v2 by id: strfry acts on nothing (v3 had replaced it)
          w.relay.remove(V3.id); // v3 leaves with no event
          w.relay.holdNotices = null;
          w.relay.drop(); // the websocket drops: v3's held notice is never delivered
          w.relay.heldNotices = [];
        } else {
          w.relay.holdNotices = null;
          w.relay.remove(V3.id); // v3 leaves with no event …
          put(w, K); // … and the stale deletion of v2 is delivered live
        }
      }
      return res;
    };
    put(w, V1b);
    await within(p, 10 * SEC, () => released && eventIdAt(w, A) === V3.id, 'fixture: the round read v3 and wrote it', 50);
    assert(timed, 'fixture: the driver ran ticks while the round was in flight (v2\'s notice was drained)');
    if (c.mode === 'hides') eq(w.relay.lostNotices.filter((x) => x.id === V3.id && x.why === 'delete-hides-next-write').length, 1, 'fixture: v3\'s notice was lost to strfry\'s defect');
    await keeps(p, 3 * MIN, A, V3.id, nm, 'the read that returned v3 was taken before v2\'s notice was drained, so it taught nothing: A1-2; clause ii cannot name v3');
    if (c.mode === 'drop') {
      assert(foundDeletions(w, p).length >= 1, `A1-2, A1-9: no read changed the lineage (the one that returned v3 taught nothing, the empty ones change nothing), so the reconnect's catch-up names the top v2 (rule 2) and finds the stale deletion of v2 — which the gate then holds; its candidate scans found none\n        ${diag(p)}`);
    } else {
      assert((num(statusOf(p), 'counts.removalsNotPrompted') || 0) >= 1, `fixture: the stale deletion of v2 resolved on delivery, and the gate held the removal it prompted (removalsNotPrompted)\n        ${diag(p)}`);
    }
    eq(removedAt(w, A).length, 0, 'removals committed at A');
  });
});

/* ══════════════════════ A1-20 (15), (16): bounds, and what the status says (A1-5, A1-7, A1-18) ══════════════════════ */

test('RL16: a flooded address stays bounded — 30 versions at one address, each heard, leave every absolute v line at most 8 older ids (the cap reached, never passed) and record.json\'s lineage row too; and 20 versions each revoked by id at an address whose reads never answer leave its entry with at most 8 by-e revokes, the most recently merged (ADR 0003 A1-7 "older never holds more than 8 ids"; A1-5 "An entry keeps at most 8 by-e revokes, the most recently merged"; A1-6 absolute v lines; A1-12)', async () => {
  await cases([
    { name: 'older: 30 versions at one address', mode: 'older' },
    { name: 'entry revokes: 20 versions each revoked by id, reads of the address never answering', mode: 'revokes' },
  ], async (c) => {
    const w = newWorld();
    const p = await boot(w);
    if (c.mode === 'older') {
      const base = tg('rl16-o', { createdAt: NOW_S - 1000 });
      const A = addr(base);
      put(w, base);
      await within(p, MIN, () => eventIdAt(w, A) === base.id, 'fixture: the first version is created');
      const seen = new Map(); // journal line text → parsed, for every v / o line at A the journal held
      const sample = () => {
        for (const e of w.store.journalEntries()) if ((e.t === 'v' || e.t === 'o') && e.a === A) seen.set(JSON.stringify(e), e);
      };
      let last = base;
      for (let i = 1; i <= 30; i += 1) {
        last = version(base, `rl16-o:v${i}`, { createdAt: NOW_S - 1000 + i, polarity: i % 2 ? '-1' : '1' });
        put(w, last);
        await drive(p, 100, 50);
        sample();
      }
      await drive(p, 5 * SEC, 100);
      sample();
      const lines = [...seen.values()];
      const vLines = lines.filter((e) => e.t === 'v');
      assert(vLines.length >= 30, `fixture: every version heard is journaled as a v line (${vLines.length} seen)`);
      const bad = vLines.filter((e) => e.top !== e.id || !Array.isArray(e.older));
      assert(bad.length === 0, `A1-6: every v line is absolute — v {id, a, top, older} with top the delivered id; ${bad.length} are not, e.g. ${show(bad[0])}`);
      const maxOlder = Math.max(...lines.filter((e) => Array.isArray(e.older)).map((e) => e.older.length));
      assert(maxOlder <= 8, `A1-7: no journaled lineage holds more than 8 older ids; the largest held ${maxOlder}`);
      eq(maxOlder, 8, 'the largest older journaled at the flooded address (the cap reached: 30 versions learned)');
      const lastV = vLines.find((e) => e.id === last.id);
      assert(lastV && lastV.older.length === 8 && !lastV.older.includes(last.id), `the last version's v line: top v30 with 8 older ids; got ${show(lastV)}`);
      // A reconnect's catch-up compacts: record.json's lineage row stays within the cap.
      const mark = w.store.recordSeq || 0;
      w.relay.drop();
      await within(p, 2 * MIN, () => (w.store.recordSeq || 0) > mark, 'fixture: the reconnect\'s catch-up compacts', 250);
      const row = lineageRowIn(w.store.record, A);
      assert(row && row[1] === last.id && (!Array.isArray(row[2]) || row[2].length <= 8),
        `A1-6 / A1-7: record.json's lineage row at the flooded address has top v30 and at most 8 older ids; got ${show(row)}`);
      return;
    }
    const V0 = tg('rl16-r', { createdAt: NOW_S - 1000 });
    const A = addr(V0);
    w.relay.neverAnswers = new Set([A]); // every read of A times out: its entry is never completed
    const targets = [];
    for (let i = 0; i < 20; i += 1) {
      const v = version(V0, `rl16-r:v${i}`, { createdAt: NOW_S - 1000 + 2 * i, polarity: i % 2 ? '-1' : '1' });
      put(w, v);
      await drive(p, 50, 50); // drained: v is the top
      put(w, del(`rl16-r-k${i}`, { e: [v.id], createdAt: NOW_S - 1000 + 2 * i + 1 })); // resolves: v is the top
      await drive(p, 100, 50);
      targets.push(v.id);
    }
    const mark = w.store.recordSeq || 0;
    await within(p, 12 * MIN, () => (w.store.recordSeq || 0) > mark, 'fixture: a safety diff compacts (record.json rewritten)', 1000);
    const got = recordEntryAt(w.store.record, A);
    const byE = revokesOf(got && got.entry).filter((r) => r.by === 'e').map((r) => r.target);
    assert(got, `A1-6 / A1-12: record.json carries A's entry (in pending or in a parked row); got none\n        ${diag(p)}`);
    assert(byE.length <= 8, `A1-5: an entry keeps at most 8 by-e revokes; A's holds ${byE.length}`);
    sameSet(byE, targets.slice(-8), 'A1-5: the by-e revokes A\'s entry keeps (the 8 most recently merged; nothing discards one for being stale)');
  });
});

test('RL17: lastReflectedAt is not moved by a decision the gate held — a version prompt, then a relay wipe before its round: the removal is held (removalsNotPrompted), nothing is written, and lastReflectedAt stays where it was (AC-6 "when it last reflected a change"; ADR 0003 A1-18 "lastReflectedAt moves only for a decided, conflict-free address whose write applied, or whose decision needed no write and was not held by the gate")', async () => {
  const w = newWorld();
  const p = await boot(w);
  const V1 = tg('rl17', { createdAt: NOW_S });
  const A = addr(V1);
  put(w, V1);
  await within(p, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
  await drive(p, 5 * SEC, 100);
  const before = at(statusOf(p), 'lastReflectedAt');
  assert(typeof before === 'string', `fixture: lastReflectedAt is set once v1 was created; got ${show(before)}`);
  const writesBefore = w.graph.writes.length;
  const heldBefore = num(statusOf(p), 'counts.removalsNotPrompted') || 0;
  put(w, version(V1, 'rl17:v2', { polarity: '-1' })); // heard: a version prompt at A
  w.relay.wipe(); // the relay is wiped before the round reads A
  await drive(p, 10 * SEC, 100);
  const st = statusOf(p);
  eq(w.graph.writes.length - writesBefore, 0, 'fixture: write calls after the wipe');
  assert((num(st, 'counts.removalsNotPrompted') || 0) > heldBefore, `fixture: the round decided a removal and the gate held it (removalsNotPrompted)\n        ${diag(p)}`);
  eq(at(st, 'lastReflectedAt'), before, 'A1-18: lastReflectedAt after a round whose only decision the gate held');
});

/* ═══════════════════ clause (ii)'s intended case (A1-4; the cases decision 11's "If declined" lists) ═══════════════════ */

test('RL18: clause (ii)\'s intended case — v2 heard at the address whose relationship records v1, then Alice\'s by-id revoke of v2, removes the relationship recording v1: a quick undo within 60 s of the revoke, and one made during a graph outage or while reads of the address fail within 60 s of the graph or the reads answering again (AC-2, AC-3; ADR 0003 A1-4 clause ii; A1-16 decision 11 "If declined … a quick undo, a version heard and then revoked during a graph outage or failing reads … miss AC-2\'s minute")', async () => {
  await cases([
    { name: 'a quick undo', mode: 'undo' },
    { name: 'during a graph outage', mode: 'graph' },
    { name: 'while reads of the address fail', mode: 'reads' },
  ], async (c) => {
    const w = newWorld();
    const p = await boot(w);
    const V1 = tg(`rl18-${c.mode}`, { createdAt: NOW_S - 100 });
    const A = addr(V1);
    put(w, V1);
    await within(p, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
    await drive(p, 2 * SEC, 100);
    if (c.mode === 'graph') w.graph.down = true;
    if (c.mode === 'reads') w.relay.scanFail = (filter) => (H.filterTargets(filter, A) ? 'exit' : null);
    const V2 = version(V1, `rl18-${c.mode}:v2`, { polarity: '-1' });
    put(w, V2);
    await drive(p, 500, 50); // v2 is heard
    put(w, del(`rl18-${c.mode}-k`, { e: [V2.id] }));
    let from = w.clock.t;
    if (c.mode !== 'undo') {
      await drive(p, 40 * SEC, 250);
      assert(eventIdAt(w, A) === V1.id, `fixture: nothing is written ${c.name}`);
      w.graph.down = false;
      w.relay.scanFail = null;
      from = w.clock.t;
    }
    await within(p, MIN - (w.clock.t - from), () => absent(w, A),
      `the relationship recording v1 is removed within 60 s of ${c.mode === 'undo' ? 'the revoke' : 'the graph or the reads answering again'}`, 100);
  });
});

/* ═════════════ owner decision 11 (accepted 2026-09-29): its three shapes, DOCUMENTED — the removal happens ═════════════ */

test('RL19: DOCUMENTATION of owner decision 11 (accepted 2026-09-29), shape (a) — the relationship records Y; X replaces Y and is heard, and Alice revokes X by id; Y itself is then re-sent (an older version, after the id-only revoke), its notice is lost, and it leaves the relay with no event before the path reads the address: the relationship recording Y IS removed within 60 s of the revoke — the removal the path already owed for that deletion (ADR 0003 A1-16 decision 11 (a); A1-4 clause ii; A1-15)', async () => {
  const w = newWorld();
  const p = await boot(w);
  const Y = tg('rl19', { createdAt: NOW_S - 100 });
  const A = addr(Y);
  put(w, Y);
  await within(p, MIN, () => eventIdAt(w, A) === Y.id, 'fixture: Y is created');
  await drive(p, 2 * SEC, 100);
  const X = version(Y, 'rl19:x', { createdAt: NOW_S - 50, polarity: '-1' });
  w.relay.loseNotice = (ev) => ev.id === Y.id;
  put(w, X, del('rl19-k', { e: [X.id] })); // X replaces Y; Alice revokes X by id (strfry deletes it)
  const storedAt = w.clock.t;
  put(w, Y); // Y is re-sent after the id-only revoke; its notice is lost
  assert(w.relay.holds(Y.id), 'fixture: the relay holds the re-sent Y');
  w.relay.remove(Y.id); // … and it leaves with no event (an operator's delete, an expiry)
  eq(w.relay.lostNotices.filter((x) => x.id === Y.id).length, 1, 'fixture: Y\'s notice was lost');
  await within(p, MIN, () => absent(w, A), 'decision 11 (a), accepted: the relationship recording Y is removed within 60 s of the revoke of X', 100);
  assert(w.clock.t - storedAt <= MIN, 'within 60 s');
});

test('RL20: DOCUMENTATION of owner decision 11 (accepted 2026-09-29), shape (b) — X is stored with its notice late, and Y replaces it with its notice lost; a look\'s read shows the path Y and writes it; X\'s late notice then outranks that read, and a stale client\'s by-id deletion of X (strfry acts on nothing) resolves; Y leaves the relay with no event: the relationship recording Y IS removed within 60 s of the deletion (ADR 0003 A1-16 decision 11 (b) "Y is a version a read showed the path while X\'s older notice was still arriving, and Y\'s own notice was then lost"; A1-4 clause ii)', async () => {
  const w = newWorld();
  const p = await boot(w);
  const V1 = tg('rl20', { createdAt: NOW_S - 300 });
  const A = addr(V1);
  put(w, V1);
  await within(p, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
  await drive(p, 2 * SEC, 100);
  const X = version(V1, 'rl20:x', { createdAt: NOW_S - 200, polarity: '-1' });
  const Y = version(V1, 'rl20:y', { createdAt: NOW_S - 100, polarity: '1' });
  w.relay.holdNotices = (ev) => ev.id === X.id; // X's notice is still arriving
  w.relay.loseNotice = (ev) => ev.id === Y.id; // Y's notice is lost
  put(w, X, Y); // Y replaces X on the relay
  put(w, look('rl20', A));
  await within(p, MIN, () => eventIdAt(w, A) === Y.id, 'fixture: the look\'s round reads Y and writes it', 50);
  w.relay.holdNotices = null;
  eq(w.relay.releaseNotices(), 1, 'fixture: X\'s late notice is delivered');
  await drive(p, 100, 50); // X is drained, before its own round is due
  put(w, del('rl20-k', { e: [X.id] })); // a stale client deletes X by id: strfry acts on nothing (Y had replaced it)
  const storedAt = w.clock.t;
  w.relay.remove(Y.id); // Y leaves with no event before any read of A
  await within(p, MIN, () => absent(w, A), 'decision 11 (b), accepted: the relationship recording Y is removed within 60 s of the deletion of X', 100);
  assert(w.clock.t - storedAt <= MIN, 'within 60 s');
});

test('RL21: DOCUMENTATION of owner decision 11 (accepted 2026-09-29), shape (c) — the relationship records G and the path\'s top is X; a third version W replaces X unheard and Alice\'s stale by-id deletion of X acts on nothing: when W was stored during a deploy and expired before the restart, the restart\'s catch-up (rule 2) finds the deletion and the relationship recording G IS removed within 5 minutes of the restart; when W is an unstamped republish the path cannot see, the deletion resolves on delivery and the relationship IS removed within 60 s while the relay still holds W; with no deletion at all, nothing is removed (ADR 0003 A1-16 decision 11 (c); A1-9 rule 2; A1-15)', async () => {
  await cases([
    { name: 'W stored during a deploy, gone before the restart', mode: 'deploy', kind5: true },
    { name: 'W stored during a deploy, gone before the restart, and no deletion (control: kept)', mode: 'deploy', kind5: false },
    { name: 'W an unstamped republish, still on the relay', mode: 'unstamped', kind5: true },
  ], async (c) => {
    const w = newWorld();
    const p = await boot(w);
    const tag = `${c.mode}-${c.kind5 ? 'k' : 'n'}`;
    const G = tg(`rl21-${tag}`, { createdAt: NOW_S - 300 });
    const A = addr(G);
    put(w, G);
    await within(p, MIN, () => eventIdAt(w, A) === G.id, 'fixture: G is created');
    await drive(p, 5 * SEC, 100);
    const nm = namer({ G: G.id });
    // X replaces G and is heard (the top), but its update keeps timing out, so the graph still records G.
    let writesFail = true;
    w.graph.failWrites = (kind) => (writesFail && kind !== 'remove' ? H.neoError('Neo.ClientError.Transaction.TransactionTimedOut', 'tx timed out') : null);
    const X = version(G, `rl21-${tag}:x`, { createdAt: NOW_S - 200, polarity: '-1' });
    put(w, X);
    await drive(p, 3 * SEC, 100);
    const K = del(`rl21-${tag}-k`, { e: [X.id], createdAt: NOW_S - 50 });
    if (c.mode === 'unstamped') {
      const W = version(G, `rl21-${tag}:w`, { createdAt: NOW_S - 100, stamps: [] }); // no nostr-user-tag stamp
      put(w, W); // strfry replaces X with it; the path never learns it
      await drive(p, 2 * SEC, 100);
      writesFail = false;
      put(w, K); // stale: strfry acts on nothing
      const storedAt = w.clock.t;
      await within(p, MIN, () => absent(w, A), 'decision 11 (c), accepted: the relationship recording G is removed within 60 s of the deletion', 100);
      assert(w.relay.holds(W.id), 'the relay still holds the unstamped republish (as the pass would remove G)');
      assert(w.clock.t - storedAt <= MIN, 'within 60 s');
      return;
    }
    await stop(w, p, 'signal'); // a deploy
    writesFail = false;
    const W = version(G, `rl21-${tag}:w`, { createdAt: NOW_S - 100, polarity: '1' });
    put(w, W); // W replaces X while the path is down
    if (c.kind5) put(w, K); // the stale deletion of X acts on nothing
    await w.advance(30 * SEC);
    w.relay.remove(W.id); // W expires before the path scans the relay
    await w.advance(30 * SEC);
    const p2 = await restart(w);
    if (c.kind5) {
      await within(p2, 5 * MIN, () => absent(w, A), 'decision 11 (c), accepted: the relationship recording G is removed within 5 minutes of the restart', 250);
    } else {
      await keeps(p2, 5 * MIN, A, G.id, nm, 'with no deletion at all, nothing is removed (AC-3)');
    }
  });
});

/* ════════════ Found by the validating Tester's mutation pass over the A1 reference (Test Design, 2026-09-29) ════════════ */

/**
 * The lineage at an address as record.json plus the journal carry it (A1-6): the last absolute v or o line there in
 * the journal ("sets L(a) to exactly {top, older}"), else record.json's lineage row → { top, older, from } or null.
 */
function persistedLineageAt(w, address) {
  const lines = w.store.journalEntries().filter((e) => e && (e.t === 'o' || e.t === 'v') && e.a === address);
  if (lines.length) { const e = lines[lines.length - 1]; return { top: e.top, older: Array.isArray(e.older) ? e.older : [], from: `a journal ${e.t} line` }; }
  const row = lineageRowIn(w.store.record, address);
  return row ? { top: row[1], older: Array.isArray(row[2]) ? row[2] : [], from: 'record.json' } : null;
}

test('RL23: the gate judges a by-id revoke against the lineage as it stood before the round\'s own read was learned — the relationship records v1 (a pass wrote it back over the path\'s v2), Alice revokes the latest version v2 by id, and a version the contract refuses then reaches the address unheard (its notice lost): the revoke\'s round reads that refused version, and the relationship recording v1 is removed within 60 s of the revoke, by clause (ii) on the lineage before the read (ADR 0003 A1-4 "The gate reads a copy of the lineage taken when the round decides A … This round\'s own read is not yet learned"; clause ii; A1-2; owner decision 11 accepted; AC-2)', async () => {
  const w = newWorld();
  const p = await boot(w);
  const V1 = tg('rl23', { createdAt: NOW_S - 100 });
  const A = addr(V1);
  put(w, V1);
  await within(p, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
  await drive(p, 2 * SEC, 100);
  const V2 = version(V1, 'rl23:v2', { polarity: '-1' });
  put(w, V2);
  await within(p, MIN, () => eventIdAt(w, A) === V2.id, 'fixture: v2 is heard and the relationship follows it');
  await drive(p, 2 * SEC, 100);
  w.passWrite(F.contractEdge(V1), { keepRid: true }); // a pass from an older read writes v1 back (ADR 0002 residual 1)
  const R = F.makeNonTagging({ address: A, refusal: 'no-target', id: idOf('rl23:r'), createdAt: V1.created_at + 20 });
  w.relay.loseNotice = (ev) => ev.id === R.id;
  const nm = namer({ v1: V1.id, v2: V2.id, R: R.id });
  const mark = w.nextSeq();
  put(w, del('rl23-k', { e: [V2.id] }), R); // strfry deletes v2; the refused version R is stored, its notice lost
  const storedAt = w.clock.t;
  eq(w.relay.lostNotices.filter((x) => x.id === R.id).length, 1, 'fixture: R\'s notice was lost');
  await within(p, MIN, () => absent(w, A), `the relationship recording ${nm(V1.id)} is removed within 60 s of the revoke of v2 — the round's read of R is not yet learned when the gate judges the revoke (A1-4)`, 100);
  assert(w.clock.t - storedAt <= MIN, 'within 60 s');
  const read = scansOf(w, A, mark).find((s) => s.outcome === 'ok');
  assert(read && read.n >= 1, `fixture: the revoke's round read A and found the refused version R there\n        ${diag(p)}`);
});

test('RL24: the graph\'s version joins older under the version a read or a scan placed — so where the path never heard the version the graph records (another writer wrote it), the author\'s by-id revoke of the version the path then read there removes that relationship within 60 s: (a) a round\'s read returning X while the graph records G (the write of X failing once), and (b) a restart\'s catch-up scan finding X while the graph\'s keys record G (the arrival\'s reads failing); record.json and the journal then carry G in older under X (ADR 0003 A1-2 "if the round\'s graph read (or the catch-up\'s key read) found the graph recording G ≠ X at A, G also joins older"; A1-6 "o {a, top, older} … records a read\'s or a scan\'s learning, and a graph version joining older"; A1-16 decision 2 "The exceptions: a read or a scan showed the path the newer version while the graph recorded the older one"; A1-4 clause ii; AC-2)', async () => {
  await cases([
    { name: '(a) a round\'s read', mode: 'round' },
    { name: '(b) a restart\'s catch-up scan', mode: 'catch-up' },
  ], async (c) => {
    const w = newWorld();
    let p = await boot(w);
    const V0 = tg(`rl24-${c.mode}`, { createdAt: NOW_S - 300 });
    const A = addr(V0);
    const G = version(V0, `rl24-${c.mode}:g`, { createdAt: NOW_S - 200, polarity: '-1' });
    const X = version(V0, `rl24-${c.mode}:x`, { createdAt: NOW_S - 100 });
    const nm = namer({ v0: V0.id, G: G.id, X: X.id });
    if (c.mode === 'round') {
      w.relay.loseNotice = (ev) => ev.id === G.id;
      put(w, G); // the path never hears G …
      w.passWrite(F.contractEdge(G)); // … which another writer (a pass) records
      await drive(p, 2 * SEC, 100);
      w.relay.loseNotice = null;
      let failedAt = null;
      w.graph.failWrites = (kind, rows) => (failedAt === null && rows.some((r) => r && r.address === A)
        ? ((failedAt = w.clock.t), H.neoError('Neo.ClientError.Transaction.TransactionTimedOut', 'tx timed out')) : null);
      put(w, X); // heard: X is the top, and the lineage knows nothing of G
      await within(p, MIN, () => failedAt !== null, 'fixture: X\'s round reads X while the graph records G, and its write fails once (transient)', 50);
      await drive(p, SEC, 100);
      assert(eventIdAt(w, A) === G.id, `fixture: the graph still records G; got ${nm(eventIdAt(w, A))}`);
    } else {
      put(w, V0);
      await within(p, MIN, () => eventIdAt(w, A) === V0.id, 'fixture: v0 is created');
      await drive(p, 2 * SEC, 100);
      await stop(w, p, 'signal');
      put(w, G); // while the path is down: G replaces v0 …
      w.passWrite(F.contractEdge(G), { keepRid: true }); // … a pass reads G and writes it …
      put(w, X); // … and X replaces G
      await w.advance(10 * SEC);
      w.relay.scanFail = (filter) => (H.filterTargets(filter, A) ? 'exit' : null); // the arrival's reads fail
      p = await restart(w);
      await within(p, MIN, () => stampScans(w, p).length >= 1 && w.relay.scans.some((s) => s.proc === p.n && s.outcome === 'exit' && H.filterTargets(s.filter, A)),
        'fixture: the restart\'s catch-up scans the relay (X an arrival), and a read of A then fails', 50);
      await drive(p, SEC, 100);
    }
    const kept = persistedLineageAt(w, A);
    assert(kept && kept.top === X.id && kept.older.includes(G.id),
      `A1-2 / A1-6: once the ${c.mode === 'round' ? 'round\'s read' : 'catch-up\'s scan'} of X at A is learned, record.json and the journal carry X on top with G in older; got ${show(kept && { top: nm(kept.top), older: kept.older.map(nm), from: kept.from })}`);
    put(w, del(`rl24-${c.mode}-k`, { e: [X.id] })); // Alice revokes X by id (strfry deletes it)
    const storedAt = w.clock.t;
    w.relay.scanFail = null;
    await within(p, MIN, () => absent(w, A), 'the relationship recording G is removed within 60 s of the revoke of X (clause ii: G joined older when the path read X)', 100);
    assert(w.clock.t - storedAt <= MIN, 'within 60 s');
  });
});

test('RL25: the census joins no older at an address a restored lineage already holds — a lost record\'s re-baseline replays a lineage whose top is X, while the graph records G, a newer version (G replaced X while the path was down, and a pass wrote it) that has since left the relay with no event; Alice\'s by-id deletion of X, stored after G replaced it, acted on nothing: the re-baseline\'s catch-up finds it (rule 2), and the relationship recording G is kept, since nothing placed G under X (ADR 0003 A1-8 "each (address, eventId) at a tagging address the lineage does not hold joins older there"; A1-4; A1-15 "a revoke of an old version authorises removing a newer one only when the path never received the newer store\'s notice"; AC-3)', async () => {
  const w = newWorld();
  const p1 = await boot(w);
  const X = tg('rl25', { createdAt: NOW_S - 300 });
  const A = addr(X);
  put(w, X);
  await within(p1, MIN, () => eventIdAt(w, A) === X.id, 'fixture: X is heard and created (its v line: the lineage\'s top X)');
  await drive(p1, 2 * SEC, 100);
  await stop(w, p1, 'signal');
  const G = version(X, 'rl25:g', { createdAt: NOW_S - 200, polarity: '-1' });
  const nm = namer({ X: X.id, G: G.id });
  put(w, G); // while the path is down: G replaces X …
  put(w, del('rl25-k', { e: [X.id] })); // … Alice's by-id deletion of X is stale: strfry acts on nothing …
  w.passWrite(F.contractEdge(G), { keepRid: true }); // … a pass reads G and writes it …
  w.relay.remove(G.id); // … and G leaves the relay with no event (an operator's delete, an expiry)
  w.store.record = null; // record.json is lost; the journal survives: the next start re-baselines, with a census
  await w.advance(10 * SEC);
  const p2 = w.spawn();
  const bodies = recordBodies(p2);
  await H.startEngine(p2);
  await within(p2, MIN, () => bodies.length >= 1 && foundDeletions(w, p2).length >= 1, 'A1-9: the re-baseline writes record.json, and its catch-up names the restored top X (rule 2: a lineage top the scan no longer finds, where the graph records another id) and finds the deletion of X', 50);
  await keeps(p2, 3 * MIN, A, G.id, nm, 'the deletion names X, which G replaced: nothing placed G under X, so neither clause holds (A1-4, A1-8), AC-3');
  assert(scansOf(w, A).some((s) => s.proc === p2.n && s.outcome === 'ok'), `fixture: the found revoke's round read A (empty)\n        ${diag(p2)}`);
  eq(removedAt(w, A).length, 0, 'removals committed at A');
  const row = lineageRowIn(bodies[0], A);
  assert(row && row[1] === X.id && !(Array.isArray(row[2]) && row[2].includes(G.id)),
    `A1-8: the re-baseline's record.json keeps the restored lineage at A with X on top and G nowhere in it (the census joins older only where the lineage holds nothing, and the scan placed nothing there); got ${show(row && [row[0].slice(0, 12), nm(row[1]), (row[2] || []).map(nm)])}`);
});

test('RL26: a catch-up\'s compaction keeps in older the versions learned after its scan\'s capture — v2 and then v3 are heard while a restart\'s catch-up is still processing its work (a pass writes v2 meanwhile, and Alice revokes v3 by id): the compaction that ends the catch-up keeps v2 under v3 in record.json\'s lineage row, beside the id the graph\'s keys recorded, and the relationship recording v2 is removed within 60 s of the revoke (ADR 0003 A1-7 "Otherwise its older is cut to the id the graph\'s keys recorded there, plus the ids learned there after the scan\'s capture, whether or not work waits there"; A1-6; A1-4 clause ii; AC-2)', async () => {
  const w = newWorld();
  const p1 = await boot(w);
  const V1 = tg('rl26', { createdAt: NOW_S - 300 });
  const A = addr(V1);
  put(w, V1);
  await within(p1, MIN, () => eventIdAt(w, A) === V1.id, 'fixture: v1 is created');
  await drive(p1, 2 * SEC, 100);
  await stop(w, p1, 'signal');
  const B = tg('rl26-b', { author: CAROL, createdAt: NOW_S - 250 });
  put(w, B); // while the path is down: the next start's catch-up has one arrival
  await w.advance(10 * SEC);
  const V2 = version(V1, 'rl26:v2', { createdAt: NOW_S - 200, polarity: '-1' });
  const V3 = version(V1, 'rl26:v3', { createdAt: NOW_S - 100 });
  const nm = namer({ v1: V1.id, v2: V2.id, v3: V3.id });
  const p2 = w.spawn();
  const bodies = recordBodies(p2);
  let revokedAt = null;
  let timed = false;
  const orig = w.relay.scan;
  w.relay.scan = async (filter, opts, pr) => {
    const res = await orig(filter, opts, pr);
    if (revokedAt === null && pr && pr.n === p2.n && H.filterKind(filter) === 'address' && H.filterTargets(filter, addr(B))) {
      // The catch-up's round for its arrival is in flight: its scan's capture is long taken, and its compaction waits
      // for this round to end.
      put(w, V2);
      const a = await waitClock(w, 300); // v2 is heard
      w.passWrite(F.contractEdge(V2), { keepRid: true }); // a pass reads v2 and writes it
      put(w, V3);
      const b = await waitClock(w, 300); // v3 is heard
      put(w, del('rl26-k3', { e: [V3.id] })); // Alice revokes v3 by id (strfry deletes it)
      revokedAt = w.clock.t;
      const d = await waitClock(w, 300); // the kind-5 is drained
      timed = a && b && d;
    }
    return res;
  };
  await H.startEngine(p2);
  await within(p2, MIN, () => revokedAt !== null && bodies.length >= 1, 'fixture: the catch-up\'s round runs, then its compaction writes record.json', 50);
  assert(timed, 'fixture: the driver ran ticks while that round was in flight (v2, v3 and the kind-5 were drained)');
  await within(p2, MIN - (w.clock.t - revokedAt), () => absent(w, A), 'the relationship recording v2 is removed within 60 s of the revoke of v3 (clause ii, v2 kept in older)', 100);
  const row = lineageRowIn(bodies[0], A);
  assert(row && row[1] === V3.id && Array.isArray(row[2]) && row[2].includes(V2.id),
    `A1-7: the compaction ending the catch-up keeps v2 (learned after its scan's capture) in older under v3; got ${show(row && [row[0].slice(0, 12), nm(row[1]), (row[2] || []).map(nm)])}`);
});

test('RL27: a catch-up\'s compaction keeps the lineage of a version learned after its scan\'s capture, though its top is not in the scan, the graph\'s keys did not hold its address and no work waits there — a new tagging V heard while a restart\'s catch-up of 600 arrivals is in its first round, and created in the next, keeps its lineage row through the compaction that ends the catch-up, and Alice\'s by-id revoke of V right after it resolves and removes the relationship within 60 s (ADR 0003 A1-7 "A lineage is dropped when all of these hold: … and nothing was learned there after the scan\'s capture"; A1-3; A1-6; AC-2)', async () => {
  const w = newWorld();
  w.graph.keepRows = false;
  const p1 = await boot(w);
  await stop(w, p1, 'signal');
  putAll(w, F.manyTaggings(600, { prefix: 'rl27-bulk', author: CAROL, createdAt: NOW_S - 5000 })); // two rounds of catch-up work
  await w.advance(10 * SEC);
  const V = tg('rl27', { createdAt: NOW_S });
  const A = addr(V);
  const p2 = w.spawn();
  const bodies = recordBodies(p2);
  let heardAt = null;
  const orig = w.relay.scan;
  w.relay.scan = async (filter, opts, pr) => {
    const res = await orig(filter, opts, pr);
    if (heardAt === null && pr && pr.n === p2.n && H.filterKind(filter) === 'address' && stampScans(w, p2).length >= 1) {
      // The catch-up's first round is in flight (its scan's capture long taken): V is stored and heard now.
      put(w, V);
      if (await waitClock(w, 300)) heardAt = w.clock.t;
    }
    return res;
  };
  await H.startEngine(p2);
  await within(p2, 2 * MIN, () => heardAt !== null && bodies.length >= 1 && at(statusOf(p2), 'catchUp.last.outcome') === 'done',
    'fixture: V is heard during the catch-up\'s first round, and the catch-up then completes and compacts', 100);
  assert(eventIdAt(w, A) === V.id, `fixture: V was created before the compaction that ended the catch-up (no work waits at its address)\n        ${diag(p2)}`);
  const row = lineageRowIn(bodies[0], A);
  assert(row && row[1] === V.id, `A1-7 / A1-6: the compaction ending the catch-up keeps the lineage at V's address (V learned after its scan's capture), with V on top; got ${show(row && [row[0].slice(0, 12), row[1] === V.id ? 'V' : row[1]])}`);
  put(w, del('rl27-k', { e: [V.id] })); // Alice revokes V by id (strfry deletes it)
  const storedAt = w.clock.t;
  await within(p2, MIN, () => absent(w, A), 'the relationship recording V is removed within 60 s of its revoke (the revoke resolves through V, the lineage\'s top: A1-3)', 100);
  assert(w.clock.t - storedAt <= MIN, 'within 60 s');
});

// ─── run ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- tagging-edges real-time lineage tests (epic tagging-edges, Story 3 — ADR 0003 Amendment A1, fake deps) ---');
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
  console.log(`\ntagging-edges-realtime-lineage: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
