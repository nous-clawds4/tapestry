'use strict';
/**
 * Property suite for Story 3 (epic tagging-edges) — the real-time path's ENGINE under a deterministic property fuzzer,
 * as ADR 0003 Amendment A1-20 ("The fuzzer") registers it.
 *
 * Story: engineering-team/stories/tagging-edges/3-real-time-path.md (AC-1, AC-2, AC-3, AC-5, AC-6; items 7 and 9)
 * ADR:   engineering-team/decisions/tagging-edges/0003-real-time-path.md — Amendment A1: A1-2 (learning), A1-3
 *        (resolution), A1-4 (the gate, clauses (i) and (ii)), A1-5 (no discards; at most 8 by-e revokes per entry),
 *        A1-7 (at most 8 older ids per address), A1-8 (the census), A1-10 (first start), A1-15 (the lineage follows store
 *        order), A1-16 (owner decisions 2, 5, 9, 10 and 11 as amended), A1-20 ("The fuzzer") and A1-21 (what the last
 *        campaign still missed). Binding context: T20 (the engine seam), T25 and T29, and ADR 0002's pass.
 * Fakes: test/helpers/taggingEdgesRealtimeFakes.js — the engine suite's world (relay with strfry 1.1.0's storage and
 *        deletion rules, graph port, store, state, fake clock, drive()); test/helpers/taggingEdgesFixtures.js.
 * Fixtures: test/fixtures/tagging-edges-realtime-property/*.json — the shrunk traces of review rounds 1 and 2 and of
 *        A1's own campaigns, each labelled with the corner or decision it documents and the verdict it must have
 *        under A1 (see FIXTURES below).
 *
 * The fuzzer drives createEngine (T20) through the fakes with seeded random operations — stores, batches, deletions
 * by id and by address (the author's and others'), silent removals, wipes, relay drops and outages, a muted
 * subscription, graph outages, write / read / scan failures, crashes, SIGTERM, switch-off, lost records, the pass
 * (reads at its start, fingerprint-verified writes at its end), latency, interleaving yields, and relay writes
 * injected inside scans — and records every operation concretely, so a trace replays exactly. Eight modes, as the
 * campaigns A1 was measured with: base, ly (latency + yields), iy (injections + yields), lost (lost records + passes
 * + yields + injections), all (passes + latency + yields + injections), pass, healthy (yields + injections, no
 * faults) and healthyp (healthy + passes + yields).
 *
 * What it asserts (only these), after every operation:
 *   I1   no relationship is removed while the relay held an accepted version at its address (at the round's
 *        successful read of the address, or held since before that read and still at the commit);
 *   I2   A1-4 in relay terms: a removal is justified by the relay's version at the read being one the definition
 *        refuses; or by the author's deletion, stored before the read, that strfry acted on — by address with a
 *        created_at no earlier than the recorded createdAt, or by id on the recorded version or on a version stored
 *        at the address after it; or by the author's deletion naming by id the recorded version (clause (i)) or a
 *        version stored at the address no earlier than it and before the deletion (clause (ii), decision 11), even
 *        when strfry acted on nothing. A deletion that acted only on an OLDER version never justifies it (A1-15);
 *   I3   no create for a version held continuously since before the first start (A1-10);
 *   I4   every create, update and move writes the version its read of the address returned, carrying the
 *        contract's properties (and the port's row rules);
 *   AC-5 off within 5 s of a switch-off or SIGTERM (an artifact of fake latency that jumps the clock ≥ 2 s inside
 *        one tick is excused, as the campaigns did);
 *   AC-6 status.json never carries the Neo4j password, a host name, Redis or the relay URL;
 *   bounds: no lineage row of record.json and no `v` / `o` journal line carries more than 8 older ids (A1-7), and no
 *        entry (record.json's pending, rechecks and parked rows; a journal `r` line) more than 8 by-e revokes (A1-5);
 *   healthy modes: the relay's current accepted version at every address is reflected, and every revoke the relay
 *        applied is applied to the graph, within 60 s of simulated time (AC-1, AC-2) — outside the corners owner
 *        decisions 2, 5, 10 and 11 (A1-16) and the story's Out of scope name, which the classifier below recognises.
 * A run that cannot complete (start() or tick() rejects, a callback throws, an unhandled rejection, the engine exits
 * unasked) fails too: it cannot vouch for the invariants. Liveness after quiescence is asserted only by the
 * fixtures, each at the address it documents, as a verdict: reflected, or a miss the classifier names as a corner
 * the fixture allows.
 *
 * The corner classifier (explainRevoke / explainNotReflected) follows A1-16 and A1-20: decision 5's first corner
 * widened (a subscription reconnecting, connected but not delivering, a batch, the relay's change notice); decision
 * 5's fourth corner widened by the census (A1-8: the baseline is what the relay held at the first REQ, which follows
 * the census, so a version stored in that window is pre-existing — never created, and outside AC-1's check); decision
 * 5's second corner (a version stored or learned — delivered but not yet drained, or never delivered — in the last
 * flush interval before a crash, and revoked by id before the restart or unheard after it; or a revoke drained in
 * that interval whose kind-5 then leaves the relay); decision 2's generalised upper-case address deletion (the path
 * could not resolve it when it was delivered: down, or not yet knowing the address); N1 (a relationship recording a
 * version the path never learned, revoked by id through a newer version it did learn, which also covers a failed
 * census); N2 (a stored eventId that is not an id); the lost-record corner widened (a relationship recording a
 * version not on the relay at the re-baseline, revoked by id later); decision 10's new bullet (a deletion drained
 * while the read or scan that first shows its target runs: ≤ 10 min, so only the minute check excuses it). Classes
 * A1 closes (round 1's NEW-1, NEW-2, F4 variant 2 and NEW-4) are notes on a miss, never corners.
 *
 * The world is the engine suite's, unchanged: a scan that times out costs its timeoutMs of fake time (A1-18's
 * settlement, the fakes' default). The pass is modelled as ADR 0002 runs it — reads at its start, fingerprint-verified
 * writes at its end — and writes its report's endedAt 1 ms after its last write (the fakes' writes take no time).
 *
 * Deterministic: a seeded PRNG (mulberry32) and the fake clock only; every scan, delivery and tick is ordered by the
 * fakes. By default the suite replays every fixture and a small fixed seed list across the eight modes (≤ 30 s in
 * all). TAGGING_EDGES_PROPERTY=1 adds the fuller fixed campaign — 8 modes × 20 seeds × 150 steps, a few minutes —
 * which is skipped otherwise, with that reason. A failure prints the seed and mode, so it replays exactly.
 *
 * Intentionally failing until src/pipeline/tagging-edges/realtime/index.js realises A1 (red phase). The engine is
 * require()d LAZILY, through load(), when a process is spawned, so the suite always loads. On the round-1 engine the
 * fixtures of the round-1 findings fail for the reason they document (a wrongful by-id removal, a revoke left to
 * the pass).
 *
 * Stack-free: no Neo4j, no strfry, no network, no filesystem beyond reading the fixtures, no signing. Every pubkey
 * is a fake 64-hex value from the fixtures — never a deployment's TA and never the ADR 0015 literal. Node 16 and 22.
 * Hand-rolled in the project's existing test style (test/tagging-edges-realtime-engine.test.js) — no new framework.
 */

const fs = require('fs');
const path = require('path');
const F = require('./helpers/taggingEdgesFixtures');
const H = require('./helpers/taggingEdgesRealtimeFakes');

const REPO = path.resolve(__dirname, '..');
const ENGINE_REL = 'src/pipeline/tagging-edges/realtime/index.js';
const CONTRACT_REL = 'src/lib/tagging-edges/contract.js';
const SWEEP_REL = 'src/lib/tagging-edges/sweep.js';
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'tagging-edges-realtime-property');
const FIXTURE_REL = 'test/fixtures/tagging-edges-realtime-property';
/** The opt-in switch for the fuller campaign (A1-20: "a fixed seed list, about 8 modes × 20 seeds × 150 steps"). */
const CAMPAIGN_ENV = 'TAGGING_EDGES_PROPERTY';

const SEC = 1000;
const MIN = 60 * SEC;
const { NOW_S } = H;
const IDS = F.IDENTITIES;
/** A1-7 and A1-5: the two caps, 8 older ids per address and 8 by-e revokes per entry. */
const OLDER_MAX = 8;
const ENTRY_E_REVOKES_MAX = 8;

// ─── test harness ──────────────────────────────────────────────────────────────────────────────────────────────
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
/** Count this test skipped, with a note (the opt-in campaign when it is not asked for). */
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
const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
const preview = (xs) => (xs.length > 6 ? `${show(xs.slice(0, 6))} … (+${xs.length - 6} more)` : show(xs));

/** Lazily load the engine with a descriptive red-phase message. */
function load() {
  try { return require(path.join(REPO, ENGINE_REL)); }
  catch (e) { throw new Error(`${ENGINE_REL} not implemented yet (require failed: ${firstLine(e)})`); }
}
/** The contract and the sweep (story 1 and story 2's modules: the oracle's view of what a version gives). */
let libs = null;
function lib() {
  if (libs) return libs;
  const need = (rel) => {
    try { return require(path.join(REPO, rel)); }
    catch (e) { throw new Error(`${rel} not loadable (require failed: ${firstLine(e)}) — the oracle reads versions through it`); }
  };
  libs = { contract: need(CONTRACT_REL), sweep: need(SWEEP_REL) };
  return libs;
}

// ─── the world's vocabulary (the campaigns' exact values: a trace replays only with these) ──────────────────────
const AUTHORS = [F.ALICE, F.CAROL, F.pubkeyOf('fz-dave')];
const TARGETS = [F.BOB, F.CAROL, F.JACK, F.pubkeyOf('fz-erin')];
const DS = ['fz-a', 'fz-b', 'fz-c'];
const STAMPSETS = [[F.STAMP(F.CANONICAL)], [F.STAMP(F.LOCAL)], [F.STAMP(F.CANONICAL), F.STAMP(F.LOCAL)]];
const ELEMENT2 = F.makeElement({ id: F.idOf('fz:element:2'), d: 'musician', createdAt: 600 });
const A_RE = /^(\d+):([0-9a-fA-F]{64}):(.*)$/s;
const HEX64_ANY = /^[0-9a-fA-F]{64}$/;
const HEX64 = /^[0-9a-f]{64}$/;

/** mulberry32: a small seeded PRNG (the campaigns' generator; a seed gives the same run on every machine). */
function mulberry32(a) {
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const turn = () => new Promise((r) => setImmediate(r));
const jcopy = (v) => (v === undefined || v === null ? null : JSON.parse(JSON.stringify(v)));
const short = (x) => (typeof x === 'string' ? x.slice(0, 8) : x);
const addressOf = (pk, d) => `39999:${pk}:${d}`;
const shortAddr = (a) => String(a).replace(/[0-9a-f]{64}/, (m) => m.slice(0, 8));
const arr = (v) => (Array.isArray(v) ? v : []);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function neoError(code) { const e = new Error(`fake ${code}`); e.name = 'Neo4jError'; e.code = code; return e; }

/** The invariant families this suite asserts (a Sim's violation `inv` → its family). */
function family(inv) {
  if (inv.startsWith('I1')) return 'I1';
  if (inv === 'I2') return 'I2';
  if (inv.startsWith('I3')) return 'I3';
  if (inv.startsWith('I4')) return 'I4';
  if (inv.startsWith('AC5')) return 'AC-5';
  if (inv === 'AC6-status-leak') return 'AC-6';
  if (inv.startsWith('bound-')) return 'bounds';
  if (inv === 'AC1-minute' || inv === 'AC2-minute') return 'minute';
  if (inv.startsWith('run-')) return 'run';
  return 'other';
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * One simulated deployment: a world of fakes, the engine processes run on it, and the oracle that watches every
 * relay mutation, scan, delivery and graph write.
 */
class Sim {
  constructor(cfg = {}) {
    lib();
    this.cfg = cfg;
    this.w = H.makeWorld({ loadEngine: load });
    this.mut = 0;
    this.versions = new Map(); // id → { id, ev, address, pk, accepted, stints: [{ from, to, how, by }], delivered: [] }
    this.addrs = new Map(); // address → [{ mut, id }]
    this.kind5 = []; // { id, pk, created_at, eTargets, aNorm, storedMut, acted: [{ id, address, by }], upperPk, ev, delivered }
    this.kind5ById = new Map();
    this.lastOkRead = new Map(); // `${procN}|${address}` → mut of the read
    this.lastSubMut = new Map();
    this.proc = null;
    this.firstStartMut = null;
    this.firstStartProc = null;
    this.firstRecordMut = null;
    this.firstRecordOrd = null;
    this.violations = [];
    this.vkeys = new Set();
    this.wi = 0;
    this.unchecked = [];
    this.injections = [];
    this.yieldScans = false;
    this.yieldGraph = false;
    this.writeFail = { mode: 'none' };
    this.scanFailMode = { mode: 'none' };
    this.readFailMode = { mode: 'none' };
    this.switchOn = true;
    this.pass = null; // { runId, snapRows, relayEvents }
    this.passCount = 0;
    this.step = 0;
    this.exitInfo = [];
    this.crashes = []; // { step, mut, t, proc, persisted, persistedRevokes }
    this.crashedProcs = new Set();
    this.spawns = []; // { n, mut, t }
    this.stats = { ops: 0, ticks: 0, writes: 0, removes: 0, creates: 0, maxOlder: 0, maxEntryRevokes: 0 };
    this.readLog = [];
    this.keysLog = []; // every readKeys answer: { proc, ord, mut, addrs }
    this.ord = 0;
    this.tickLog = [];
    this.mutTime = new Map();
    this.infos = {};
    this.lostRecordAt = [];
    this.lossProc = null;
    this.pendingLoss = null;
    this.maxTickJump = 0;
    this.jOff = 0; // how much of journal.jsonl the bounds check has read
    this.recSeen = null; // the record.json the bounds check last read
    this.fatal = false;
    this.install();
  }

  // ─── bookkeeping ───────────────────────────────────────────────────────────────────────────────────────────
  heldTaggingMap() {
    const out = new Map();
    for (const [id, h] of this.w.relay.held) if (h.ev.kind === 39999 && h.key) out.set(id, h.key);
    return out;
  }

  versionOf(id, ev, address) {
    let v = this.versions.get(id);
    if (!v) {
      let accepted = false;
      try { const r = lib().contract.taggingToEdge(ev, IDS); accepted = !!r && r.ok === true && r.edge.address === address; } catch (_) { accepted = false; }
      v = {
        id, ev: jcopy(ev), address, pk: address.split(':')[1], accepted, stints: [], delivered: [],
        storedWhile: {
          proc: !!this.proc, procN: this.proc ? this.proc.n : null, batch: !!this.w.relay.batch, muted: !!this.w.relay.muted,
          subOpen: this.w.relay.openSubs().length > 0,
        },
        stamped: Array.isArray(ev.tags) && ev.tags.some((t) => Array.isArray(t) && t[0] === 'z' && (t[1] === F.STAMP(F.CANONICAL) || t[1] === F.STAMP(F.LOCAL))),
      };
      this.versions.set(id, v);
    }
    return v;
  }

  install() {
    const r = this.w.relay;
    const sim = this;
    const origStore = r.store;
    r.store = (ev0) => {
      const before = sim.heldTaggingMap();
      const res = origStore(ev0);
      sim.mut += 1;
      sim.mutTime.set(sim.mut, sim.w.clock.t);
      sim.afterMutation(before, { how: 'store', ev: ev0, res });
      return res;
    };
    const origRemove = r.remove;
    r.remove = (id) => {
      const before = sim.heldTaggingMap();
      origRemove(id);
      sim.mut += 1;
      sim.mutTime.set(sim.mut, sim.w.clock.t);
      sim.afterMutation(before, { how: 'silent' });
    };
    const origWipe = r.wipe;
    r.wipe = () => {
      const before = sim.heldTaggingMap();
      origWipe();
      sim.mut += 1;
      sim.mutTime.set(sim.mut, sim.w.clock.t);
      sim.afterMutation(before, { how: 'wipe' });
    };
    const origScan = r.scan;
    r.scan = async (filter, opts, proc) => {
      const kind = H.filterKind(filter);
      const fl = Array.isArray(filter) ? filter : [filter];
      const addrs = kind === 'address' ? fl.map((f) => `39999:${String(f.authors[0]).toLowerCase()}:${f['#d'][0]}`) : [];
      if (sim.yieldScans) await turn();
      const injB = sim.takeInjection(kind, addrs, 'before');
      if (injB) sim.execRelayOpSync(injB.op);
      const m = sim.mut;
      const startOrd = ++sim.ord;
      // What the graph recorded when the relay read began (a round's graph read and a catch-up's key read precede
      // it): pathSaw models A1-2's graph learning from it.
      const graphAt = {};
      if (kind === 'address' || kind === 'stamp') {
        const want = kind === 'address' ? addrs : [...sim.w.graph.rows.keys()];
        for (const a of want) { const row = sim.w.graph.rows.get(a); graphAt[a] = row ? lib().sweep.storedFromRow(row).edge.eventId : null; }
      }
      let res;
      try {
        res = await origScan(filter, opts, proc);
      } catch (e) {
        const injA = sim.takeInjection(kind, addrs, 'after');
        if (injA) sim.execRelayOpSync(injA.op);
        throw e;
      }
      if (proc && !proc.killed) for (const a of addrs) sim.lastOkRead.set(`${proc.n}|${a}`, m);
      if (proc) {
        const baselineScan = kind === 'stamp' && (sim.firstStartMut === null || (sim.lossProc && sim.lossProc.n === proc.n));
        const del = kind === 'deletion' ? { e: (fl[0]['#e'] || []).map((x) => String(x).toLowerCase()), a: fl[0]['#a'] || [], author: String((fl[0].authors || [])[0]).toLowerCase() } : null;
        sim.readLog.push({ proc: proc.n, kind, addrs, mut: m, t: sim.w.clock.t, startOrd, ord: ++sim.ord, del, baseline: baselineScan, graphAt });
      }
      const injA = sim.takeInjection(kind, addrs, 'after');
      if (injA) sim.execRelayOpSync(injA.op);
      return res;
    };
    r.onSubscribe = (sub) => {
      sim.lastSubMut.set(sub.proc.n, sim.mut);
      const orig = sub.onEvent;
      sub.onEvent = (ev) => {
        const id = String(ev && ev.id).toLowerCase();
        const v = sim.versions.get(id);
        if (v) v.delivered.push({ proc: sub.proc.n, mut: sim.mut, t: sim.w.clock.t, ord: ++sim.ord });
        const k = sim.kind5ById.get(id);
        if (k) k.delivered.push({ proc: sub.proc.n, mut: sim.mut, t: sim.w.clock.t, ord: ++sim.ord });
        return typeof orig === 'function' ? orig(ev) : undefined;
      };
    };
    const g = this.w.graph;
    const origPort = g.port;
    g.port = (proc) => {
      const p = origPort(proc);
      return new Proxy({}, {
        get(_, k) {
          const v = p[k];
          if (typeof v !== 'function') return v;
          return async (...args) => {
            if (sim.yieldGraph) await turn();
            const out = await v(...args);
            if (k === 'readKeys' && Array.isArray(out)) {
              sim.keysLog.push({ proc: proc.n, ord: ++sim.ord, mut: sim.mut, addrs: new Set(out.map((x) => x && x.address)) });
            }
            return out;
          };
        },
      });
    };
    g.beforeApply = async (kind, list, rec) => {
      if (sim.yieldGraph) await turn();
      rec.readMut = {};
      for (const row of list) rec.readMut[row.address] = sim.lastOkRead.get(`${rec.proc}|${row.address}`);
      rec.commitMut = sim.mut;
      rec.commitT = sim.w.clock.t;
      rec.ord = ++sim.ord;
    };
    g.failWrites = (kind, rows) => sim.writeFailFor(kind, rows);
    g.failReads = (op) => sim.readFailFor(op);
    r.scanFail = (filter, o, call) => sim.scanFailFor(filter, call);
  }

  afterMutation(before, info) {
    const after = this.heldTaggingMap();
    const touched = new Set();
    for (const [id, a] of after) {
      if (before.has(id)) continue;
      const v = this.versionOf(id, this.w.relay.held.get(id).ev, a);
      v.stints.push({ from: this.mut, to: null, how: null, by: null });
      touched.add(a);
    }
    let k5 = null;
    if (info.how === 'store' && info.res && info.res.stored && info.ev && info.ev.kind === 5) {
      const ev = info.ev;
      const pk = String(ev.pubkey).toLowerCase();
      const eTargets = arr(ev.tags).filter((t) => Array.isArray(t) && t[0] === 'e' && typeof t[1] === 'string' && HEX64_ANY.test(t[1])).map((t) => t[1].toLowerCase());
      const aNorm = [];
      for (const t of arr(ev.tags)) {
        if (!Array.isArray(t) || t[0] !== 'a' || typeof t[1] !== 'string' || Buffer.byteLength(t[1], 'utf8') > 255) continue;
        const m = A_RE.exec(t[1]);
        if (!m) continue;
        aNorm.push(`${Number(m[1])}:${m[2].toLowerCase()}:${m[3]}`);
      }
      k5 = {
        id: String(ev.id).toLowerCase(), pk, created_at: ev.created_at, eTargets, aNorm, storedMut: this.mut, acted: [],
        upperPk: ev.pubkey !== pk, ev: jcopy(ev), delivered: [], t: this.w.clock.t, step: this.step,
        aRaw: arr(ev.tags).filter((t) => Array.isArray(t) && t[0] === 'a').map((t) => t[1]),
      };
      this.kind5.push(k5);
      this.kind5ById.set(k5.id, k5);
    }
    for (const [id, a] of before) {
      if (after.has(id)) continue;
      const v = this.versions.get(id);
      const st = v.stints[v.stints.length - 1];
      st.to = this.mut;
      if (info.how === 'store' && info.ev && info.ev.kind === 5) {
        const byE = k5 && k5.eTargets.includes(id);
        st.how = byE ? 'kind5-e' : 'kind5-a';
        st.by = k5 ? k5.id : null;
        if (k5) k5.acted.push({ id, address: a, by: byE ? 'e' : 'a' });
      } else if (info.how === 'store') {
        st.how = 'replaced';
        st.by = String(info.ev.id).toLowerCase();
      } else {
        st.how = info.how;
      }
      touched.add(a);
    }
    for (const k of this.kind5) if (k.goneMut === undefined && !this.w.relay.held.has(k.id)) k.goneMut = this.mut;
    for (const a of touched) {
      let cur = null;
      for (const [id, aa] of after) if (aa === a) { cur = id; break; }
      if (!this.addrs.has(a)) this.addrs.set(a, []);
      const log = this.addrs.get(a);
      if (log.length === 0 || log[log.length - 1].id !== cur) log.push({ mut: this.mut, id: cur });
    }
  }

  stateAt(a, m) {
    const log = this.addrs.get(a) || [];
    let id = null;
    for (const e of log) { if (e.mut <= m) id = e.id; else break; }
    if (!id) return { id: null, accepted: false };
    const v = this.versions.get(id);
    return { id, accepted: !!v && v.accepted, v };
  }

  heldAt(id, m) {
    const v = this.versions.get(id);
    if (!v) return null;
    return v.stints.find((s) => s.from <= m && (s.to === null || s.to > m)) || null;
  }

  isBaselineHeld(id, atMut) {
    if (this.firstStartMut === null) return false;
    const st = this.heldAt(id, this.firstStartMut);
    return !!st && (st.to === null || st.to > atMut);
  }

  // ─── injections and failure modes ──────────────────────────────────────────────────────────────────────────
  takeInjection(kind, addrs, when) {
    const i = this.injections.findIndex((x) => x.when === when
      && ((x.target === 'stamp' && kind === 'stamp') || (x.target === 'address' && addrs.includes(x.address))));
    if (i < 0) return null;
    return this.injections.splice(i, 1)[0];
  }

  execRelayOpSync(op) {
    if (op.t === 'store') this.w.relay.store(op.ev);
    else if (op.t === 'remove') this.w.relay.remove(op.id);
  }

  writeFailFor(kind, rows) {
    const m = this.writeFail;
    switch (m.mode) {
      case 'unavailable': return neoError('Neo.TransientError.General.DatabaseUnavailable');
      case 'tx': return neoError('Neo.ClientError.Transaction.TransactionTimedOut');
      case 'lockStopped': return neoError('Neo.ClientError.Transaction.LockClientStopped');
      case 'refuseAll': return neoError('Neo.ClientError.Schema.ConstraintValidationFailed');
      case 'refuseAddr':
        return arr(rows).some((r) => r && r.address === m.address) ? neoError('Neo.ClientError.Schema.ConstraintValidationFailed') : null;
      case 'auth': return neoError('Neo.ClientError.Security.Unauthorized');
      default: return null;
    }
  }

  readFailFor(op) {
    const m = this.readFailMode;
    if (m.mode === 'readKeys' && op === 'readKeys') return neoError('ServiceUnavailable');
    if (m.mode === 'readAt' && op === 'readAt') return neoError('Neo.TransientError.General.DatabaseUnavailable');
    if (m.mode === 'schema' && op === 'readSchema') return neoError('ServiceUnavailable');
    return null;
  }

  scanFailFor(filter, call) {
    const m = this.scanFailMode;
    const kind = H.filterKind(filter);
    switch (m.mode) {
      case 'addr': return (kind === 'address' && H.filterTargets(filter, m.address)) ? (m.code || 'timeout') : null;
      case 'all': return m.code || 'exit';
      case 'stamp': return kind === 'stamp' ? 'timeout' : null;
      case 'deletion': return kind === 'deletion' ? 'too-large' : null;
      case 'element': return kind === 'element' ? 'truncated' : null;
      case 'random': return ((call.seq * 2654435761) >>> 0) % 100 < (m.pct || 30) ? 'truncated' : null;
      default: return null;
    }
  }

  // ─── violations ────────────────────────────────────────────────────────────────────────────────────────────
  violation(inv, details, key) {
    const k = `${inv}|${key || ''}`;
    if (this.vkeys.has(k)) return;
    this.vkeys.add(k);
    this.violations.push({ inv, step: this.step, t: this.w.clock.t - H.T0, mut: this.mut, details });
  }
  info(k) { this.infos[k] = (this.infos[k] || 0) + 1; }

  // ─── engine lifecycle ──────────────────────────────────────────────────────────────────────────────────────
  async spawn() {
    const proc = this.w.spawn();
    const st = proc.deps.store;
    const origWR = st.writeRecord;
    const sim = this;
    st.writeRecord = (body) => {
      if (sim.lossProc && !proc.killed) { // the first record written after the loss is the re-baseline's
        const { how, step, lineage } = sim.lossProc;
        sim.lostRecordAt.push({ mut: sim.mut, ord: ++sim.ord, how, step, proc: proc.n, lineage });
        sim.lossProc = null;
      }
      if (sim.firstStartMut === null && !proc.killed) {
        sim.firstRecordMut = sim.mut;
        sim.firstRecordOrd = ++sim.ord;
        sim.firstStartMut = sim.lastSubMut.has(proc.n) ? sim.lastSubMut.get(proc.n) : null;
        sim.firstStartProc = proc.n;
        if (sim.firstStartMut === null) sim.violation('I3-first-start-without-subscribe', { proc: proc.n });
      }
      return origWR(body);
    };
    const origTick = proc.engine.tick;
    proc.engine.tick = (...args) => { sim.tickLog.push({ proc: proc.n, ord: ++sim.ord }); return origTick(...args); };
    this.proc = proc;
    this.spawns.push({ n: proc.n, mut: this.mut, t: this.w.clock.t });
    if (this.pendingLoss) {
      // The re-baseline takes effect when that process writes record.json (after its first EOSE and stamp scan).
      this.lossProc = { n: proc.n, how: this.pendingLoss.how, step: this.step, lineage: this.pendingLoss.lineage };
      this.pendingLoss = null;
    }
    try {
      await H.startEngine(proc);
    } catch (e) {
      this.violation('run-start', { msg: String(e.message).slice(0, 300) });
      this.fatal = true;
    }
    return proc;
  }

  async driveFor(ms, step) {
    if (!this.proc || this.proc.exited) {
      await this.w.advance(ms);
      return;
    }
    let r;
    let prevT = this.w.clock.t;
    this.maxTickJump = 0;
    try {
      r = await H.drive(this.proc, ms, {
        step,
        each: () => {
          this.stats.ticks += 1;
          const j = this.w.clock.t - prevT - step;
          if (j > this.maxTickJump) this.maxTickJump = j;
          prevT = this.w.clock.t;
        },
      });
    } catch (e) {
      this.violation('run-tick', { msg: String(e.message).slice(0, 400) });
      this.fatal = true;
      return;
    }
    if (r.exit !== undefined) {
      this.exitInfo.push({ step: this.step, exit: r.exit, expected: !!this.expectExit });
      if (!this.expectExit) this.violation('run-unexpected-exit', { exit: r.exit });
      this.proc.kill();
      this.proc = null;
    }
  }

  // ─── the pass (ADR 0002's gap-filling pass, modelled: reads at its start, verified writes at its end) ────────
  passStart() {
    if (this.pass) return;
    this.passCount += 1;
    const d = new Date(this.w.clock.t);
    const p = (n) => String(n).padStart(2, '0');
    const runId = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z-${(0xabc00000 + this.passCount).toString(16).slice(-8)}`;
    this.w.passStart(runId);
    const { sweep } = lib();
    const filter = sweep.sweepFilter(IDS);
    const relayEvents = [...this.w.relay.held.values()].map((h) => JSON.parse(JSON.stringify(h.ev))).filter((ev) => sweep.isExpectedScanEvent(ev, filter));
    const snapRows = [...this.w.graph.rows.values(), ...this.w.graph.others].map(jcopy);
    this.pass = { runId, snapRows, relayEvents, startMut: this.mut };
  }

  passFinish(die, prefix) {
    if (!this.pass) return;
    const { runId, snapRows, relayEvents } = this.pass;
    const plan = lib().sweep.planPass({ snapshotRows: snapRows, relayEvents, identities: IDS, confirmedHeld: null });
    const actions = [
      ...plan.creates.map((x) => ['create', x]), ...plan.updates.map((x) => ['update', x]),
      ...plan.moves.map((x) => ['move', x]), ...plan.removals.map((x) => ['remove', x]),
    ];
    const n = die ? Math.min(actions.length, prefix || 0) : actions.length;
    const g = this.w.graph;
    for (const [kind, it] of actions.slice(0, n)) {
      const cur = g.findRow(it.address);
      if (kind === 'create') {
        if (!cur) g.putEdge(it.desired);
        continue;
      }
      if (!cur || H.fingerprint(cur) !== H.fingerprint(it.snapshot)) continue; // lost race: verify failed
      if (kind === 'update') g.putEdge(it.desired, { keepRid: true });
      else if (kind === 'move') g.putEdge(it.desired);
      else g.removeRow(it.address, cur);
    }
    // ADR 0002: a pass writes its report's endedAt AFTER its last write. The model's writes are instantaneous, so the
    // clock moves 1 ms first — else a round whose graph read fell at that very millisecond, before the writes, would see
    // a pass that ended "at" its read (T25's strict boundary) and miss the overlap only because fake time stood still.
    if (die) this.w.passDie(runId); else { this.w.clock.advance(1); this.w.passEnd(runId); }
    this.pass = null;
  }

  // ─── executing one op ──────────────────────────────────────────────────────────────────────────────────────
  async exec(op) {
    this.stats.ops += 1;
    const w = this.w;
    switch (op.t) {
      case 'store': w.relay.store(op.ev); break;
      case 'batch': w.relay.storeBatch(op.evs); break;
      case 'remove': w.relay.remove(op.id); break;
      case 'wipe': w.relay.wipe(); break;
      case 'drop': w.relay.drop(); break;
      case 'relayDown': w.relay.setDown(op.v); break;
      case 'mute': w.relay.muted = op.v; break;
      case 'graphDown': w.graph.down = op.v; break;
      case 'schema': w.graph.schema.tags = op.v; break;
      case 'writeFail': this.writeFail = op.mode; break;
      case 'scanFail': this.scanFailMode = op.mode; break;
      case 'readFail': this.readFailMode = op.mode; break;
      case 'latency': w.relay.latencyMs = op.relay; w.graph.latencyMs = op.graph; break;
      case 'yield': this.yieldScans = op.scans; this.yieldGraph = op.graph; break;
      case 'inject': this.injections.push({ target: op.target, address: op.address, when: op.when, op: op.op }); break;
      case 'crash':
        if (this.proc) {
          const n = this.proc.n;
          this.crashedProcs.add(n);
          this.proc.kill();
          this.crashes.push({ step: this.step, mut: this.mut, t: w.clock.t, proc: n, ...this.persisted() });
          this.proc = null;
        }
        break;
      case 'sigterm':
      case 'switchOff': {
        if (op.t === 'switchOff') { w.store.setSwitch(false); this.switchOn = false; }
        if (!this.proc) break;
        if (op.t === 'sigterm') this.proc.engine.handleSignal('SIGTERM');
        this.expectExit = true;
        const t0 = w.clock.t;
        await this.driveFor(6 * SEC, 50);
        this.expectExit = false;
        if (this.proc && this.maxTickJump >= 2000) {
          this.info('AC5-artifact:atomic-fake-latency');
          this.proc.kill(); this.proc = null;
        } else if (this.proc) {
          this.violation('AC5-no-exit-within-5s', { how: op.t, maxIntraTickClockJumpMs: this.maxTickJump, relayLatency: w.relay.latencyMs, graphLatency: w.graph.latencyMs });
          this.proc.kill(); this.proc = null;
        } else {
          const last = this.exitInfo[this.exitInfo.length - 1];
          if (w.clock.t - t0 > 5 * SEC + 100 && this.maxTickJump < 2000) this.violation('AC5-exit-late', { how: op.t, ms: w.clock.t - t0, last, maxIntraTickClockJumpMs: this.maxTickJump });
        }
        break;
      }
      case 'switchOn': w.store.setSwitch(true); this.switchOn = true; break;
      case 'restart':
        if (!this.proc && this.switchOn) await this.spawn();
        break;
      case 'loseRecord':
        if (!this.proc) {
          if (op.how === 'unreadable') w.store.recordUnreadable = true;
          else if (op.how === 'missing') w.store.record = null;
          else if (op.how === 'journal') w.store.journalUnreadableOpens = 1;
          // Takes effect at the next start (its re-baseline). A lost journal leaves record.json: its lineage survives.
          const rec = op.how === 'journal' && isObj(w.store.record) ? w.store.record : null;
          const lineage = rec ? new Map(arr(rec.lineage).filter(Array.isArray).map((row) => [row[0], [row[1], ...arr(row[2])].filter(Boolean)])) : null;
          this.pendingLoss = { how: op.how, lineage };
        }
        break;
      case 'passStart': this.passStart(); break;
      case 'passEnd': this.passFinish(false); this.lastPassEnd = w.clock.t; break;
      case 'passDie': this.passFinish(true, op.prefix); this.lastPassEnd = w.clock.t; break;
      case 'drive': await this.driveFor(op.ms, op.step); break;
      default: throw new Error(`unknown op ${op.t}`);
    }
    this.check();
  }

  // ─── checks ────────────────────────────────────────────────────────────────────────────────────────────────
  check() {
    const w = this.w;
    for (; this.wi < w.graph.writes.length; this.wi += 1) this.unchecked.push(w.graph.writes[this.wi]);
    const keep = [];
    for (const rec of this.unchecked) {
      if (rec.error) continue;
      if (!rec.result) { keep.push(rec); continue; }
      this.checkRec(rec);
    }
    this.unchecked = keep;
    this.checkMinute();
    this.checkBounds();
    // I4: the port's own row rules (C6: a row for its own address, a snapshot, a desired edge; AC-7's tagging address).
    if (w.graph.violations.length) { this.violation('I4-port-row', w.graph.violations.slice(0, 3)); w.graph.violations.length = 0; }
    if (H.strays.length) { this.violation('run-stray', H.strays.slice(0, 3)); H.strays.length = 0; this.fatal = true; }
    const s = w.store.status;
    if (s && typeof s === 'object') {
      const txt = JSON.stringify(s);
      for (const bad of [H.PASSWORD, 'neo4j.internal', 'redis', 'relay.fake.invalid', 'bolt:']) {
        if (txt.includes(bad)) this.violation('AC6-status-leak', { bad });
      }
    }
  }

  /** A1-7 and A1-5 as persisted: record.json's lineage rows and entries, and every new journal line. */
  checkBounds() {
    const st = this.w.store;
    const older = (where, a, xs) => {
      if (Array.isArray(xs) && xs.length > this.stats.maxOlder) this.stats.maxOlder = xs.length;
      if (Array.isArray(xs) && xs.length > OLDER_MAX) this.violation('bound-older', { where, a: shortAddr(a), older: xs.length }, `${where}|${a}`);
    };
    const revokes = (where, a, entry) => {
      const n = isObj(entry) ? arr(entry.revokes).filter((r) => isObj(r) && r.by === 'e').length : 0;
      if (n > this.stats.maxEntryRevokes) this.stats.maxEntryRevokes = n;
      if (n > ENTRY_E_REVOKES_MAX) this.violation('bound-revokes', { where, a: shortAddr(a), byE: n }, `${where}|${a}`);
    };
    const rec = st.record;
    if (rec && rec !== this.recSeen && isObj(rec)) {
      this.recSeen = rec;
      for (const row of arr(rec.lineage)) if (Array.isArray(row)) older('record.lineage', row[0], row[2]);
      for (const key of ['pending', 'rechecks', 'parked']) for (const x of arr(rec[key])) if (isObj(x)) revokes(`record.${key}`, x.a, x.entry);
    }
    const text = st.journal;
    if (text.length < this.jOff) this.jOff = 0; // truncated or replaced
    const end = text.lastIndexOf('\n') + 1;
    if (end > this.jOff) {
      for (const line of text.slice(this.jOff, end).split('\n')) {
        if (!line) continue;
        let o;
        try { o = JSON.parse(line); } catch (_) { continue; }
        if (!isObj(o)) continue;
        if (o.t === 'v' || o.t === 'o') older(`journal.${o.t}`, o.a, o.older);
        else if (o.t === 'r') revokes('journal.r', o.a, o.p);
      }
      this.jOff = end;
    }
  }

  /** Healthy runs only: the relay's current accepted, non-baseline version at each address is reflected within 60 s. */
  checkMinute() {
    if (!this.cfg.healthy || this.firstStartMut === null || !this.proc) return;
    const { sweep } = lib();
    const now = this.w.clock.t;
    for (const [a, log] of this.addrs) {
      if (!sweep.isTaggingAddress(a) || log.length === 0) continue;
      const lastE = log[log.length - 1];
      const cur = this.stateAt(a, this.mut);
      const since = Math.max(this.mutTime.get(lastE.mut) || 0, this.lastPassEnd || 0);
      if (now - since <= 60 * SEC) continue;
      const row = this.w.graph.rows.get(a) || null;
      const edge = row ? sweep.storedFromRow(row).edge : null;
      if (cur.id && cur.accepted) {
        if (this.isBaselineHeld(cur.id, this.mut)) continue;
        if (!edge || edge.eventId !== cur.id) {
          const why = this.explainNotReflected(a, cur, edge);
          if (!why.corner) this.violation('AC1-minute', { a, relay: short(cur.id), graph: edge ? short(edge.eventId) : null, forMs: now - since, notes: why.notes }, `${a}|${cur.id}`);
          else this.info(`AC1-minute-corner:${why.corner}`);
        }
      } else if (!cur.id && edge) {
        const last = this.lastStintAt(a);
        if (last && (last.s.how === 'kind5-e' || last.s.how === 'kind5-a')) {
          const why = this.explainRevoke(a, last, edge, { minute: true });
          if (!why.corner) this.violation('AC2-minute', { a, graph: short(edge.eventId), last: short(last.v.id), how: last.s.how, forMs: now - since, notes: why.notes }, `${a}|${last.v.id}`);
          else this.info(`AC2-minute-corner:${why.corner}`);
        }
      }
    }
  }

  checkRec(rec) {
    const applied = (rec.result && rec.result.appliedAddresses) || [];
    this.stats.writes += 1;
    for (const a of applied) {
      const row = arr(rec.rows).find((x) => x && x.address === a);
      const m = rec.readMut ? rec.readMut[a] : undefined;
      if (rec.kind === 'remove') { this.stats.removes += 1; this.checkRemove(rec, a, row, m); } else { if (rec.kind === 'create') this.stats.creates += 1; this.checkVersionWrite(rec, a, row, m); }
    }
  }

  checkRemove(rec, a, row, m) {
    const snap = row && (row.snapshot || row.row);
    const stored = snap ? lib().sweep.storedFromRow(snap).edge : null;
    const X = stored ? stored.eventId : null;
    const cx = stored ? stored.createdAt : null;
    const pk = a.split(':')[1];
    if (m === undefined) { this.violation('I1-removal-without-read', { a: shortAddr(a), X: short(X), proc: rec.proc }, `${a}|${X}`); return; }
    const atRead = this.stateAt(a, m);
    if (atRead.id && atRead.accepted) {
      this.violation('I1', { a, X: short(X), relayAtRead: short(atRead.id), readMut: m, commitMut: rec.commitMut, proc: rec.proc }, `${a}|${X}`);
    }
    const atCommit = this.stateAt(a, rec.commitMut);
    if (atCommit.id && atCommit.accepted) {
      const st = this.heldAt(atCommit.id, rec.commitMut);
      if (st && st.from <= m) this.violation('I1-commit', { a, X: short(X), relayAtCommit: short(atCommit.id) }, `${a}|${X}`);
    }
    let just = null;
    let soft = null; // A1-4's clauses (i) and (ii) in relay terms, where strfry acted on nothing (decision 11)
    if (atRead.id && !atRead.accepted) just = 'refused-at-read';
    const lastStart = (id) => {
      const v = this.versions.get(id);
      if (!v || v.address !== a) return null;
      let s0 = null;
      for (const x of v.stints) if (x.from <= m) s0 = x.from;
      return s0;
    };
    const xStart = X ? lastStart(X) : null;
    // A deletion that acted only on a version OLDER than the recorded one never explains the emptiness (A1-15).
    const notOlder = (id) => id === X || xStart === null || (() => { const s0 = lastStart(id); return s0 === null || s0 >= xStart; })();
    for (const k of this.kind5) {
      if (k.pk !== pk || k.storedMut > m) continue;
      if (!just && k.acted.some((x) => x.address === a && x.by === 'e' && notOlder(x.id))) just = `e-acted:${short(k.id)}`;
      if (!just && k.aNorm.includes(a) && typeof cx === 'number' && k.created_at >= cx) just = `a:${short(k.id)}`;
      if (!soft && X && k.eTargets.includes(X)) soft = 'clause-i:e-names-recorded';
      if (!soft) {
        for (const id of k.eTargets) {
          const vs = lastStart(id);
          if (vs !== null && vs <= k.storedMut && (xStart === null || xStart <= vs)) { soft = 'clause-ii:e-names-a-version-stored-here-no-earlier-than-recorded'; break; }
        }
      }
    }
    if (!just && soft) { this.info(`I2-accepted:${soft}`); return; }
    if (!just) {
      const namedE = this.kind5.filter((k) => k.pk === pk && k.storedMut <= m && k.eTargets.some((id) => { const v = this.versions.get(id); return v && v.address === a; }))
        .map((k) => ({ k: short(k.id), names: k.eTargets.map(short), acted: k.acted.map((x) => short(x.id)), mut: k.storedMut }));
      this.violation('I2', {
        a, X: short(X), cx, relayAtRead: short(atRead.id), readMut: m, commitMut: rec.commitMut, kind5NamingVersionsHere: namedE, proc: rec.proc,
      }, `${a}|${X}`);
    }
  }

  checkVersionWrite(rec, a, row, m) {
    const desired = row && row.desired;
    if (!desired) { this.violation('I4-no-desired', { a, kind: rec.kind }); return; }
    const X = desired.eventId;
    if (m === undefined) { this.violation('I4-write-without-read', { a: shortAddr(a), X: short(X), kind: rec.kind, proc: rec.proc }, `${a}|${X}`); return; }
    const atRead = this.stateAt(a, m);
    if (atRead.id !== X) this.violation('I4', { a, kind: rec.kind, wrote: short(X), relayAtRead: short(atRead.id), readMut: m }, `${a}|${X}`);
    if (rec.kind === 'create' && this.isBaselineHeld(X, rec.commitMut)) {
      this.violation('I3', { a, X: short(X), firstStartMut: this.firstStartMut, commitMut: rec.commitMut }, `${a}|${X}`);
    }
    if (rec.kind === 'create' && this.firstStartMut === null) this.violation('I3-create-before-first-start', { a, X: short(X) });
    const v = this.versions.get(X);
    if (v) {
      const r = lib().contract.taggingToEdge(v.ev, IDS);
      if (!r || r.ok !== true) this.violation('I4-wrote-refused', { a, X: short(X) });
      else {
        const exp = r.edge;
        const keys = ['from', 'to', 'address', 'eventId', 'createdAt', 'polarity', 'zCanonical', 'zLocal', 'tagEventId'];
        if (exp.tagAddress !== null) keys.push('tagAddress', 'tagSlug');
        const diff = keys.filter((k) => (desired[k] === undefined ? null : desired[k]) !== (exp[k] === undefined ? null : exp[k]));
        if (diff.length) this.violation('I4-edge', { a, X: short(X), diff }, `${a}|${X}`);
      }
    }
  }

  // ─── liveness (fixture verdicts) ───────────────────────────────────────────────────────────────────────────
  /** The last stint that ended at an address: { v, s }, or null. */
  lastStintAt(a) {
    let last = null;
    for (const v of this.versions.values()) {
      if (v.address !== a) continue;
      for (const s of v.stints) if (s.to !== null && (!last || s.to > last.s.to)) last = { v, s };
    }
    return last;
  }

  liveness() {
    const { sweep, contract } = lib();
    const out = [];
    for (const [a] of this.addrs) {
      if (!sweep.isTaggingAddress(a)) continue;
      const cur = this.stateAt(a, this.mut);
      const row = this.w.graph.rows.get(a) || null;
      const edge = row ? sweep.storedFromRow(row).edge : null;
      if (cur.id && cur.accepted) {
        if (this.isBaselineHeld(cur.id, this.mut)) continue;
        const exp = contract.taggingToEdge(cur.v.ev, IDS).edge;
        const keys = ['from', 'to', 'address', 'eventId', 'createdAt', 'polarity', 'zCanonical', 'zLocal', 'tagEventId'];
        if (exp.tagAddress !== null) keys.push('tagAddress', 'tagSlug');
        const diff = edge ? keys.filter((k) => (edge[k] === undefined ? null : edge[k]) !== (exp[k] === undefined ? null : exp[k])) : ['<absent>'];
        if (diff.length) out.push({ a, kind: 'not-reflected', relay: short(cur.id), graph: edge ? short(edge.eventId) : null, diff, why: this.explainNotReflected(a, cur, edge) });
      } else if (!cur.id) {
        if (!edge) continue;
        const last = this.lastStintAt(a);
        if (last && (last.s.how === 'kind5-e' || last.s.how === 'kind5-a')) {
          out.push({ a, kind: 'revoke-not-reflected', graph: short(edge.eventId), last: short(last.v.id), how: last.s.how, by: short(last.s.by), why: this.explainRevoke(a, last, edge, { minute: false }) });
        }
      }
    }
    return out;
  }

  explainNotReflected(a, cur) {
    const v = cur.v;
    const notes = [];
    let corner = null;
    const firstStint = v.stints[0];
    // Decision 5's third corner: a version held at the first start that left and came back with the same id.
    if (this.firstStartMut !== null && firstStint.from <= this.firstStartMut && v.stints.length > 1) { notes.push('5c:baseline-id-left-and-came-back'); corner = '5c:baseline-id-returned'; }
    if (!v.delivered.length) notes.push('never-delivered');
    const st = v.stints[v.stints.length - 1];
    // Decision 5's sixth corner: a lost record re-baselines; what was stored in the gap waits for the pass.
    if (!corner && this.lostRecordAt.some((x) => x.mut >= st.from)) corner = 'lost-record';
    return { notes, corner };
  }

  /** Did the path ever learn version `id` at `a` (a delivery, a read or scan during its stint, or A1-2's graph learning)? */
  pathSaw(id, a) {
    for (const r of this.readLog) {
      if (r.baseline || !r.graphAt || r.graphAt[a] !== id) continue;
      if (!(r.kind === 'stamp' || (r.kind === 'address' && r.addrs.includes(a)))) continue;
      const at = this.stateAt(a, r.mut);
      if (at.id && at.id !== id) return true;
    }
    const v = this.versions.get(id);
    if (!v || v.address !== a) return false;
    if (v.delivered.length) return true;
    for (const st of v.stints) {
      for (const r of this.readLog) {
        if (r.mut < st.from || (st.to !== null && r.mut >= st.to)) continue;
        if (r.kind === 'stamp' || (r.kind === 'address' && r.addrs.includes(a))) return true;
      }
    }
    return false;
  }

  /** A1-2's graph learning of `id` at `a` by a read or a catch-up's stamp scan taken at or after mutation `mut`. */
  graphLearnedAfter(id, a, mut) {
    return this.readLog.some((r) => r.mut >= mut && !r.baseline && r.graphAt && r.graphAt[a] === id
      && (r.kind === 'stamp' || (r.kind === 'address' && r.addrs.includes(a)))
      && (() => { const at = this.stateAt(a, r.mut); return !!at.id && at.v.stamped && at.id !== id; })());
  }

  /**
   * Did the path know address `a` (A1-3: a lineage, S or the graph's last keys) when it drained a kind-5 first
   * delivered at `kDel`? A version at `a` delivered earlier, a read or a stamp scan that found one there, a key read
   * that held it, or the path's own create there — before the delivery, or, for a first start's buffered delivery,
   * by that start's census and baseline scan (the buffer is drained after them, A1-10).
   */
  pathKnewAddress(a, kDel) {
    const before = (ord) => ord < kDel.ord;
    const firstStartBuffer = kDel.proc === this.firstStartProc && this.firstRecordMut !== null && kDel.mut <= this.firstRecordMut;
    for (const v of this.versions.values()) if (v.address === a && v.delivered.some((d) => before(d.ord))) return true;
    for (const r of this.readLog) {
      const inTime = before(r.ord) || (firstStartBuffer && r.proc === kDel.proc && r.baseline);
      if (!inTime) continue;
      if (r.kind === 'address' && r.addrs.includes(a)) return true;
      if (r.kind === 'stamp' && this.stateAt(a, r.mut).id) return true;
    }
    // The first start's census is its key read before the record (A1-8); a later key read is no help to the buffer.
    for (const x of this.keysLog) if ((before(x.ord) || (firstStartBuffer && x.proc === kDel.proc && x.ord < this.firstRecordOrd)) && x.addrs.has(a)) return true;
    for (const rec of this.w.graph.writes) {
      if (rec.kind === 'create' && typeof rec.ord === 'number' && before(rec.ord) && rec.result && arr(rec.result.appliedAddresses).includes(a)) return true;
    }
    return false;
  }

  /** What survived to disk at a crash: version ids (record.json, `v` / `c` / `o` lines) and revoke kind5Ids. */
  persisted() {
    const ids = new Set();
    const revokes = new Set();
    const entry = (e) => { if (isObj(e)) for (const r of arr(e.revokes)) if (isObj(r) && typeof r.kind5Id === 'string') revokes.add(r.kind5Id.toLowerCase()); };
    const rec = this.w.store.record;
    if (rec) {
      for (const k of ['seen', 'heard']) for (const p of arr(rec[k])) ids.add(p[0]);
      for (const row of arr(rec.lineage)) { if (row[1]) ids.add(row[1]); for (const x of arr(row[2])) ids.add(x); }
      for (const key of ['pending', 'rechecks', 'parked']) for (const x of arr(rec[key])) if (isObj(x)) entry(x.entry);
    }
    for (const line of String(this.w.store.journal).split('\n')) {
      if (!line) continue;
      try {
        const o = JSON.parse(line);
        if ((o.t === 'v' || o.t === 'c') && o.id) ids.add(o.id);
        if (o.t === 'o' || o.t === 'v') { if (o.top) ids.add(o.top); for (const x of arr(o.older)) ids.add(x); }
        if (o.t === 'd' && isObj(o.p) && typeof o.p.kind5Id === 'string') revokes.add(o.p.kind5Id.toLowerCase());
        if (o.t === 'r') entry(o.p);
      } catch (_) { /* torn */ }
    }
    return { persisted: ids, persistedRevokes: revokes };
  }

  /** The first process spawned after process n (a restart), or null. */
  spawnAfter(n) { return this.spawns.find((s) => s.n > n) || null; }

  /**
   * Why a revoke the relay applied is not reflected: → { notes, corner } (corner null: not a corner A1 names). The
   * rules follow A1-16's decisions 2, 5, 10 and 11 and the story's Out of scope; `minute` also admits the corners
   * that are reflected within 10 minutes (T25, decision 10), which only the minute check excuses.
   */
  explainRevoke(a, last, edge, { minute }) {
    const notes = [];
    const k = this.kind5ById.get(last.s.by);
    const L = last.v;
    const graphOther = !!edge && edge.eventId !== L.id;
    const Ldel = L.delivered.length > 0;
    const Kdel = !!k && k.delivered.length > 0 && !k.upperPk; // an upper-case-pubkey kind-5 resolves nothing live (T25)
    if (!Ldel) notes.push('revoked-version-never-delivered');
    if (graphOther) notes.push('graph-records-other-version');
    if (!k) return { notes, corner: null };
    if (k.upperPk) notes.push('kind5-upper-pubkey');
    if (!Kdel) notes.push('kind5-never-delivered');
    const zeroA = k.aRaw.some((x) => /^0/.test(x) || /^\+/.test(x));
    const upperA = k.aRaw.some((x) => { const m = A_RE.exec(x); return m && m[2] !== m[2].toLowerCase(); });
    if (zeroA) notes.push('a-kind-leading-zero');
    if (upperA) notes.push('a-upper-pubkey');
    const aValid = k.aRaw.some((x) => x === a);
    const aApplies = aValid && edge && typeof edge.createdAt === 'number' && k.created_at >= edge.createdAt;
    // A non-baseline stamp scan (a catch-up or safety diff) during L's stint: the path learned L as an arrival.
    const stampSawL = this.readLog.some((r) => r.kind === 'stamp' && !r.baseline && r.mut >= last.s.from && r.mut < last.s.to);
    if (stampSawL) notes.push('catch-up-saw-it');
    // A class A1 closes is noted, and the triage goes on; a miss no corner explains keeps it in its notes.
    const closed = [];
    const pick = (corner) => ({ notes: notes.concat(closed), corner });
    const closes = (c) => { if (!closed.includes(c)) closed.push(c); };

    // Out of scope (story): L carried neither stamp, so the path never hears it or ties a revoke of it to the address.
    if (!L.stamped) return pick('out-of-scope:unstamped-version');
    // Decision 2 (A1-16), N2: a relationship whose stored eventId is missing or not an id, revoked by id.
    if (last.s.how === 'kind5-e' && edge && !(typeof edge.eventId === 'string' && HEX64.test(edge.eventId))) return pick('N2:malformed-event-id');

    // The revoke itself left the relay (a wipe or an operator's delete) before anything could find it.
    if (!this.w.relay.holds(k.id)) {
      notes.push('revoke-no-longer-on-relay');
      const X = edge ? edge.eventId : null;
      const chance = this.readLog.find((r) => r.kind === 'deletion' && r.del && r.mut >= k.storedMut && r.mut < k.goneMut && r.del.author === k.pk
        && ((X && r.del.e.includes(X)) || r.del.e.includes(L.id) || r.del.a.includes(a)));
      if (!chance && !Kdel) return pick('evidence-gone:revoke-wiped-or-removed');
      if (chance) notes.push('candidate-scan-ran-while-revoke-held');
    }
    // T25 (decision 5's corners): a kind-5 whose own pubkey is upper-case hex resolves nothing live; the next catch-up
    // or safety diff (≤ 10 min) finds it.
    if (k.upperPk && minute) return pick('T25:upper-pubkey-kind5(<=10min)');
    // Round 1's NEW-4 (A1-10 closes it): a revoke stored during the very first start.
    if (this.firstStartMut !== null && k.storedMut >= this.firstStartMut && k.storedMut <= this.firstRecordMut && minute) closes('a1-closes:NEW4:first-start-revoke');
    // Decision 2 (A1-16), N1: the graph records a version the path never learned at the address, and the author
    // revoked by id a newer version the path did learn (a failed census included: A1-8).
    if (last.s.how === 'kind5-e' && graphOther && edge && (Ldel || stampSawL || this.pathSaw(L.id, a)) && !this.pathSaw(edge.eventId, a)) {
      notes.push('graph-version-never-seen-by-the-path');
      return pick('N1:graph-version-unseen');
    }
    // Round 1's NEW-2 (A1-2 and A1-9 close it): L reached the path only as a catch-up arrival.
    if (!Ldel && stampSawL && graphOther && !aApplies) closes('a1-closes:NEW2:catch-up-arrival');
    // Round 1's NEW-1 (A1-2 and A1-3 close it): a round read the address after the revoke's store, before its drain.
    if ((Ldel || stampSawL || !graphOther) && Kdel && (!aApplies || last.s.how === 'kind5-a')) {
      const kDel = k.delivered[0];
      const drainedAt = (this.tickLog.find((x) => x.proc === kDel.proc && x.ord > kDel.ord) || { ord: Infinity }).ord;
      if (this.readLog.find((r) => r.kind === 'address' && r.addrs.includes(a) && r.mut >= k.storedMut && r.ord < drainedAt)) {
        notes.push('read-between-revoke-store-and-delivery');
        closes('a1-closes:NEW1:read-before-revoke-delivered');
      }
    }
    // Round 1's F4 variant 2 (A1-2 closes it): a revoke in a subscription gap, and a round read before the catch-up.
    if (Ldel && !Kdel && graphOther && !aApplies) {
      const readAfter = this.readLog.find((r) => r.kind === 'address' && r.addrs.includes(a) && r.mut >= k.storedMut);
      const stampAfter = this.readLog.find((r) => r.kind === 'stamp' && r.mut >= k.storedMut);
      if (readAfter && (!stampAfter || readAfter.ord <= stampAfter.ord)) { notes.push('round-read-before-catch-up'); closes('a1-closes:F4v2:reconnect-gap-read'); }
    }

    // Decision 5's second corner (A1-16): a version stored or learned in the last flush interval before a crash —
    // delivered but not drained, first shown by a read or scan, or stored and never delivered — and revoked by id
    // before the restart, or unheard after it (A1-21: a crash in the flush interval followed by a reconnect gap).
    if (last.s.how === 'kind5-e') {
      const inStint = (m) => L.stints.some((st) => m >= st.from && (st.to === null || m < st.to));
      const sightings = [...L.delivered.map((d) => d.proc),
        ...this.readLog.filter((r) => (r.kind === 'stamp' || (r.kind === 'address' && r.addrs.includes(a))) && inStint(r.mut)).map((r) => r.proc)];
      for (const c of this.crashes) {
        if (c.mut < last.s.from) continue; // a crash during the stint the deletion ended
        const learnedOnlyThere = sightings.length > 0
          ? sightings.every((p) => this.crashedProcs.has(p)) && sightings.includes(c.proc)
          : L.storedWhile.procN === c.proc;
        if (!learnedOnlyThere || c.persisted.has(L.id)) continue;
        const next = this.spawnAfter(c.proc);
        const revokedWhileDown = k.t >= c.t && (!next || k.t <= next.t);
        const unheardAfter = k.t >= c.t && !Kdel;
        if (revokedWhileDown || unheardAfter) {
          notes.push(`5b:crash@step${c.step}`, revokedWhileDown ? 'revoked-while-down' : 'revoked-unheard-after-the-restart');
          return pick('5b:crash-lost-heard');
        }
      }
    }
    // ... or a revoke drained in that interval, when its kind-5 then leaves the relay before the restart.
    if (Kdel && k.goneMut !== undefined && k.delivered.every((d) => this.crashedProcs.has(d.proc))) {
      for (const c of this.crashes) {
        if (c.proc !== k.delivered[0].proc || c.t < k.delivered[0].t || c.persistedRevokes.has(k.id)) continue;
        const next = this.spawnAfter(c.proc);
        if (!next || k.goneMut <= next.mut) { notes.push(`5b:crash@step${c.step}`); return pick('5b:crash-lost-revoke'); }
      }
    }
    // Decision 5's first corner (A1-16): revoked by id before the path's subscription delivered L — the path down, its
    // subscription reconnecting, connected but not delivering, one batch, or the relay's change notice (L stored while
    // subscribed, and the connection ended before the notice went out) — and no catch-up saw it.
    if (!Ldel && !stampSawL && graphOther && !aApplies) {
      const sw = L.storedWhile || {};
      const sub = sw.batch ? 'batch' : (!sw.proc ? 'down' : (sw.muted ? 'muted' : (!sw.subOpen ? 'sub-gap' : 'notice')));
      return pick(`7:revoked-before-announced(${sub})`);
    }
    // Decision 2's cases that wait for the pass (A1-16).
    if (last.s.how === 'kind5-a' && edge && typeof edge.createdAt === 'number' && k.created_at < edge.createdAt) return pick('2:graph-ahead');
    if (last.s.how === 'kind5-a' && !aValid && zeroA) return pick('2:kind-leading-zero');
    if (last.s.how === 'kind5-a' && !aValid && upperA) {
      // "an upper-case pubkey address deletion that the path could not resolve when it was delivered: the path was
      // down, or did not yet know the address" (the catch-up's #a scan finds only lower case).
      if (!Kdel || !this.pathKnewAddress(a, k.delivered[0])) return pick('2:a-upper-unresolved');
      notes.push('a-upper-but-address-known');
    }
    // Decision 5's lost-record corner (A1-16, widened): a re-baseline after L was stored; or one at which the relay no
    // longer held the graph's version, followed by a by-id revoke of a later version.
    if (this.lostRecordAt.some((x) => x.mut >= last.s.from - 1)) return pick('lost-record');
    // "If the re-baseline's census fails, or the surviving record's lineage at an address predates the graph's version
    // there, a relationship recording a version not on the relay at the re-baseline is not removed on a by-id revoke
    // of a later version until the pass." (A census that answered places the graph's version under the scan's there,
    // C3; so a surviving lineage predates it only where the re-baseline's scan found nothing at the address.)
    if (last.s.how === 'kind5-e' && graphOther) {
      const G = edge.eventId;
      for (const x of this.lostRecordAt) {
        if (x.mut > k.storedMut || this.stateAt(a, x.mut).id === G) continue;
        const censusFailed = !this.keysLog.some((e) => e.proc === x.proc && e.ord < x.ord);
        const seenThere = this.stateAt(a, x.mut); // the scan sees only a stamped version (A1-15)
        const lineagePredates = !!x.lineage && x.lineage.has(a) && !x.lineage.get(a).includes(G) && !(seenThere.id && seenThere.v.stamped);
        if ((censusFailed || lineagePredates) && !this.graphLearnedAfter(G, a, x.mut)) {
          notes.push(censusFailed ? 'rebaseline-census-failed' : 'surviving-lineage-predates-graph-version');
          return pick('lost-record:graph-version-unknown-at-rebaseline');
        }
      }
    }
    // Decision 10's new bullet (A1-16): a deletion drained while the read or stamp scan that first showed the path its
    // target was running resolves nothing then; the next safety diff finds it (≤ 10 min).
    if (minute && Kdel && !Ldel) {
      const kd = k.delivered[0];
      const firstSight = this.readLog.find((r) => (r.kind === 'stamp' || (r.kind === 'address' && r.addrs.includes(a)))
        && L.stints.some((st) => r.mut >= st.from && (st.to === null || r.mut < st.to)));
      if (firstSight && firstSight.proc === kd.proc && firstSight.startOrd < kd.ord && firstSight.ord > kd.ord) return pick('10:revoke-drained-during-first-read(<=10min)');
    }
    return pick(null);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Generation: ops are chosen online from the world's state and recorded concretely (the campaigns' generator, as is).
class Gen {
  constructor(seed, cfg) {
    this.seed = seed;
    this.rng = mulberry32(seed >>> 0);
    this.cfg = cfg;
    this.idc = 0;
    this.ts = NOW_S + 10; // created_at clock for new versions (strictly increasing)
    this.scheduled = []; // { at: step, op }
  }
  r() { return this.rng(); }
  chance(p) { return this.rng() < p; }
  int(lo, hi) { return lo + Math.floor(this.rng() * (hi - lo + 1)); }
  pick(xs) { return xs[Math.floor(this.rng() * xs.length)]; }
  nid(tag) { this.idc += 1; return F.idOf(`fz:${this.seed}:${tag}:${this.idc}`); }

  version(pk, d, o = {}) {
    const createdAt = o.createdAt !== undefined ? o.createdAt : (this.ts += this.int(1, 5));
    const id = this.nid('v');
    const kind = o.kind || 'normal';
    if (kind === 'refused') {
      return F.makeNonTagging({ address: addressOf(pk, d), refusal: this.pick(['no-target', 'several-targets', 'bad-target', 'no-tag-reference']), id, createdAt, stamps: this.pick(STAMPSETS) });
    }
    const base = { author: pk, d, id, createdAt, target: this.pick(TARGETS), polarity: this.pick(['1', '-1', '0', null]), stamps: this.pick(STAMPSETS) };
    if (kind === 'unstamped') base.stamps = [F.STAMP(F.OTHER_DEPLOY)];
    if (kind === 'idonly') { base.a = null; base.e = this.pick([F.TAG_V1, ELEMENT2.id, this.nid('el')]); }
    return F.makeTagging(base);
  }

  deletion(pk, { e = [], a = [], createdAt, upperPk = false } = {}) {
    const id = this.nid('k');
    return F.makeDeletion({ author: upperPk ? pk.toUpperCase() : pk, e, a, createdAt: createdAt !== undefined ? createdAt : (this.ts += this.int(1, 3)), id });
  }
}

function initialOps(sim, gen) {
  const ops = [];
  ops.push({ t: 'store', ev: F.makeElement() });
  ops.push({ t: 'store', ev: ELEMENT2 });
  for (const pk of AUTHORS) {
    for (const d of DS) {
      if (!gen.chance(0.6)) continue;
      if (gen.chance(0.25)) ops.push({ t: 'store', ev: gen.version(pk, d, { createdAt: NOW_S - 20000 + gen.int(0, 999) }) });
      const kind = gen.chance(0.08) ? 'refused' : (gen.chance(0.08) ? 'idonly' : 'normal');
      ops.push({ t: 'store', ev: gen.version(pk, d, { createdAt: NOW_S - 10000 + gen.int(0, 999), kind }) });
    }
  }
  return ops;
}

/** The backfill's graph before the first start (applied directly, not an op the engine sees). */
function seedGraph(sim, gen) {
  const { sweep, contract } = lib();
  const w = sim.w;
  for (const [, h] of w.relay.held) {
    if (h.ev.kind !== 39999 || !h.key || !sweep.isTaggingAddress(h.key)) continue;
    const r = contract.taggingToEdge(h.ev, IDS);
    if (!r || r.ok !== true) continue;
    if (gen.chance(0.7)) w.graph.putEdge(r.edge);
  }
  // A relationship whose version left the relay before the first start (drift the pass owns).
  for (const pk of AUTHORS) {
    const d = 'fz-gone';
    if (gen.chance(0.3)) {
      const ev = gen.version(pk, d, { createdAt: NOW_S - 15000 });
      w.graph.putEdge(contract.taggingToEdge(ev, IDS).edge);
      sim.addrs.set(addressOf(pk, d), []);
    }
  }
  // Left-in-place rows (AC-7): never touched by the path.
  const e = contract.taggingToEdge(gen.version(F.ALICE, 'fz-left'), IDS).edge;
  w.graph.putRow(F.storedRow(e, { address: null, rid: '5:fake:left-1' }));
  w.graph.putRow(F.storedRow(e, { nonTaggingAddress: true, rid: '5:fake:left-2' }));
}

/** One random op (plus the drive after it), chosen from the world's state. */
function genOp(sim, gen, step) {
  const { sweep } = lib();
  const w = sim.w;
  const ops = [];
  for (let i = gen.scheduled.length - 1; i >= 0; i -= 1) {
    if (gen.scheduled[i].at <= step) { ops.push(gen.scheduled[i].op); gen.scheduled.splice(i, 1); }
  }
  const held = [...w.relay.held.values()].filter((h) => h.ev.kind === 39999 && h.key && sweep.isTaggingAddress(h.key));
  const pkAddrs = (pk) => DS.map((d) => addressOf(pk, d));
  const cfg = gen.cfg;
  const healthy = !!cfg.healthy;
  const x = gen.r();
  let acc = 0;
  const W = (p) => { acc += p; return x < acc; };
  const sched = (k, op) => gen.scheduled.push({ at: step + k, op });

  if (W(0.30)) {
    const pk = gen.pick(AUTHORS);
    const d = gen.pick(DS);
    const r = gen.r();
    let o = {};
    if (r < 0.10) o = { createdAt: NOW_S - gen.int(1, 30000) };
    else if (r < 0.15) o = { kind: 'refused' };
    else if (r < 0.17) o = { kind: 'unstamped' };
    else if (r < 0.23) o = { kind: 'idonly' };
    const ev = gen.version(pk, d, o);
    if (cfg.inject && gen.chance(0.12)) {
      ops.push({ t: 'inject', target: gen.chance(0.8) ? 'address' : 'stamp', address: addressOf(pk, d), when: gen.chance(0.5) ? 'before' : 'after', op: { t: 'store', ev } });
    } else ops.push({ t: 'store', ev });
  } else if (W(0.10)) {
    // the author's kind-5 by e
    const pk = gen.pick(AUTHORS);
    const r = gen.r();
    let target = null;
    const mine = held.filter((h) => h.ev.pubkey === pk);
    const hist = [...sim.versions.values()].filter((v) => v.pk === pk && v.address.startsWith('39999:'));
    if (r < 0.6 && mine.length) target = gen.pick(mine).ev.id;
    else if (r < 0.85 && hist.length) target = gen.pick(hist).id;
    else target = gen.nid('never');
    const e = [target];
    if (gen.chance(0.15) && hist.length) e.push(gen.pick(hist).id);
    const ev = gen.deletion(pk, { e: gen.chance(0.1) ? e.map((y) => y.toUpperCase()) : e, upperPk: gen.chance(0.04) });
    if (cfg.inject && gen.chance(0.1)) {
      const v = sim.versions.get(target);
      ops.push({ t: 'inject', target: 'address', address: v ? v.address : addressOf(pk, gen.pick(DS)), when: gen.chance(0.5) ? 'before' : 'after', op: { t: 'store', ev } });
    } else ops.push({ t: 'store', ev });
  } else if (W(0.07)) {
    // the author's kind-5 by a
    const pk = gen.pick(AUTHORS);
    const a = gen.pick(pkAddrs(pk).concat([addressOf(pk, 'fz-gone')]));
    const curH = held.find((h) => h.key === a);
    let createdAt;
    if (curH && gen.chance(0.3)) createdAt = curH.ev.created_at - gen.int(1, 50);
    else createdAt = (gen.ts += gen.int(1, 3));
    const r = gen.r();
    const d = a.split(':').slice(2).join(':');
    const spelled = r < 0.05 ? `039999:${pk}:${d}` : (r < 0.10 ? `39999:${pk.toUpperCase()}:${d}` : a);
    const withE = gen.chance(0.15) && curH ? [curH.ev.id] : [];
    ops.push({ t: 'store', ev: gen.deletion(pk, { a: [spelled], e: withE, createdAt, upperPk: gen.chance(0.03) }) });
  } else if (W(0.04)) {
    // another author's kind-5
    const pk = gen.pick(AUTHORS);
    const others = held.filter((h) => h.ev.pubkey !== pk);
    if (others.length && gen.chance(0.6)) ops.push({ t: 'store', ev: gen.deletion(pk, { e: [gen.pick(others).ev.id] }) });
    else if (others.length) ops.push({ t: 'store', ev: gen.deletion(pk, { a: [gen.pick(others).key] }) });
    else ops.push({ t: 'store', ev: gen.deletion(pk, { e: [gen.nid('note')] }) });
  } else if (W(0.05)) {
    if (held.length) ops.push({ t: 'remove', id: gen.pick(held).ev.id });
  } else if (W(0.004)) {
    ops.push({ t: 'wipe' });
  } else if (W(0.025)) {
    const pk = gen.pick(AUTHORS);
    const d = gen.pick(DS);
    const v = gen.version(pk, d);
    if (gen.chance(0.6)) ops.push({ t: 'batch', evs: [v, gen.deletion(pk, { e: [v.id] })] });
    else ops.push({ t: 'batch', evs: [v, gen.version(pk, d)] });
  } else if (W(0.03)) {
    if (!healthy) ops.push({ t: 'drop' });
  } else if (W(0.015)) {
    if (!healthy) { ops.push({ t: 'relayDown', v: true }); sched(gen.int(1, 6), { t: 'relayDown', v: false }); }
  } else if (W(0.005)) {
    if (!healthy) { ops.push({ t: 'mute', v: true }); sched(gen.int(2, 12), { t: 'mute', v: false }); }
  } else if (W(0.02)) {
    if (!healthy) { ops.push({ t: 'graphDown', v: true }); sched(gen.int(1, 8), { t: 'graphDown', v: false }); }
  } else if (W(0.005)) {
    if (!healthy) { ops.push({ t: 'schema', v: 'missing' }); sched(gen.int(1, 6), { t: 'schema', v: 'online' }); }
  } else if (W(0.02)) {
    const modes = ['unavailable', 'tx', 'lockStopped', 'refuseAll', 'refuseAddr', 'auth'];
    const mode = gen.pick(modes);
    const address = gen.pick(held.length ? held.map((h) => h.key) : [addressOf(F.ALICE, 'fz-a')]);
    if (!healthy) { ops.push({ t: 'writeFail', mode: { mode, address } }); sched(gen.int(1, 8), { t: 'writeFail', mode: { mode: 'none' } }); }
  } else if (W(0.02)) {
    const modes = ['addr', 'all', 'stamp', 'deletion', 'element', 'random'];
    const mode = gen.pick(modes);
    const address = gen.pick(held.length ? held.map((h) => h.key) : [addressOf(F.ALICE, 'fz-a')]);
    const code = gen.pick(['timeout', 'exit', 'truncated', 'too-large']);
    const pct = gen.int(10, 60);
    if (!healthy) {
      ops.push({ t: 'scanFail', mode: { mode, address, code, pct } });
      sched(gen.int(1, 8), { t: 'scanFail', mode: { mode: 'none' } });
    }
  } else if (W(0.01)) {
    const mode = gen.pick(['readKeys', 'readAt', 'schema']);
    if (!healthy) { ops.push({ t: 'readFail', mode: { mode } }); sched(gen.int(1, 6), { t: 'readFail', mode: { mode: 'none' } }); }
  } else if (W(cfg.lost ? 0.01 : 0)) {
    if (sim.proc) {
      const how = gen.pick(['unreadable', 'missing', 'journal']);
      const k = gen.int(0, 4);
      if (!healthy) { ops.push({ t: 'crash' }); ops.push({ t: 'loseRecord', how }); sched(k, { t: 'restart' }); }
    }
  } else if (W(0.02)) {
    if (sim.proc) { const k = gen.int(0, 8); if (!healthy) { ops.push({ t: 'crash' }); sched(k, { t: 'restart' }); } }
  } else if (W(0.01)) {
    if (sim.proc) { const k = gen.int(0, 6); if (!healthy) { ops.push({ t: 'sigterm' }); sched(k, { t: 'restart' }); } }
  } else if (W(0.005)) {
    if (sim.proc) {
      const k1 = gen.int(1, 6);
      const k2 = gen.int(7, 8);
      if (!healthy) { ops.push({ t: 'switchOff' }); sched(k1, { t: 'switchOn' }); sched(k2, { t: 'restart' }); }
    }
  } else if (W(cfg.pass ? 0.03 : 0)) {
    if (!sim.pass) {
      ops.push({ t: 'passStart' });
      if (gen.chance(0.8)) sched(gen.int(0, 8), { t: 'passEnd' }); else sched(gen.int(0, 8), { t: 'passDie', prefix: gen.int(0, 4) });
    }
  } else if (W(cfg.latency ? 0.02 : 0)) {
    ops.push({ t: 'latency', relay: gen.pick([0, 0, 20, 100, 400]), graph: gen.pick([0, 0, 5, 50, 300]) });
  } else if (W(cfg.yields ? 0.02 : 0)) {
    ops.push({ t: 'yield', scans: gen.chance(0.6), graph: gen.chance(0.6) });
  }
  // the drive after it
  const r = gen.r();
  let drive;
  if (r < 0.55) drive = { t: 'drive', ms: gen.int(1, 10) * 50, step: 50 };
  else if (r < 0.80) drive = { t: 'drive', ms: gen.int(500, 5000), step: gen.pick([50, 100, 250]) };
  else if (r < 0.94) drive = { t: 'drive', ms: gen.int(5000, 60000), step: gen.pick([250, 500, 1000]) };
  else if (r < 0.99) drive = { t: 'drive', ms: gen.int(60000, 300000), step: 1000 };
  else drive = { t: 'drive', ms: gen.int(600000, 700000), step: 2000 };
  ops.push(drive);
  return ops;
}

function quiesceOps(sim) {
  const ops = [
    { t: 'relayDown', v: false }, { t: 'mute', v: false }, { t: 'graphDown', v: false }, { t: 'schema', v: 'online' },
    { t: 'writeFail', mode: { mode: 'none' } }, { t: 'scanFail', mode: { mode: 'none' } }, { t: 'readFail', mode: { mode: 'none' } },
  ];
  if (sim.pass) ops.push({ t: 'passEnd' });
  if (!sim.switchOn) ops.push({ t: 'switchOn' });
  ops.push({ t: 'restart' });
  return ops;
}

/**
 * One generated run: the seed's initial relay, the backfill's graph, the first start, `steps` random operations, then
 * quiescence (every fault cleared, the switch on, a process running, 13 minutes), all checked after every operation.
 */
async function runGenerated(seed, cfg = {}) {
  const sim = new Sim(cfg);
  const gen = new Gen(seed, cfg);
  const trace = [];
  const exec = async (op) => { trace.push(op); await sim.exec(op); };
  for (const op of initialOps(sim, gen)) await exec(op);
  trace.push({ t: 'seedGraph' });
  seedGraph(sim, gen);
  if (cfg.latency && gen.chance(0.5)) await exec({ t: 'latency', relay: gen.pick([20, 100, 400]), graph: gen.pick([5, 50]) });
  if (cfg.yields && gen.chance(0.5)) await exec({ t: 'yield', scans: true, graph: gen.chance(0.5) });
  await exec({ t: 'restart' });
  const steps = cfg.steps || 150;
  for (let step = 0; step < steps && !sim.fatal; step += 1) {
    sim.step = step;
    for (const op of genOp(sim, gen, step)) {
      await exec(op);
      if (sim.fatal) break;
    }
  }
  if (!sim.fatal) {
    sim.step = 'quiesce';
    for (const op of quiesceOps(sim)) await exec(op);
    for (let t = 0; t < 13 * MIN && !sim.fatal; t += 10 * SEC) {
      await exec({ t: 'drive', ms: 10 * SEC, step: 500 });
      if (!sim.proc && sim.switchOn) await exec({ t: 'restart' });
    }
  }
  await H.killAll();
  return { seed, sim, trace };
}

/** Replay a recorded trace (a fixture): the same ops, the same checks, then the liveness verdicts. */
async function replay(trace, cfg = {}) {
  const sim = new Sim(cfg);
  let i = 0;
  for (const op of trace) {
    sim.step = i;
    i += 1;
    if (op.t === 'seedGraph') {
      for (const [a, row] of op.rows || []) sim.w.graph.rows.set(a, jcopy(row));
      for (const row of op.others || []) sim.w.graph.others.push(jcopy(row));
      for (const row of op.rows || []) {
        const p = H.propOf(row[1], 'address');
        if (p && typeof p.text === 'string' && !sim.addrs.has(p.text)) sim.addrs.set(p.text, []);
      }
      for (const [a] of op.rows || []) if (!sim.addrs.has(a)) sim.addrs.set(a, []);
      for (const a of op.extraAddrs || []) if (!sim.addrs.has(a)) sim.addrs.set(a, []);
      if (typeof op.ridSeq === 'number') sim.w.graph.ridSeq = op.ridSeq;
      for (const [, row] of op.rows || []) { sim.w.graph.merge(row.fromPubkey); sim.w.graph.merge(row.toPubkey); }
      continue;
    }
    await sim.exec(op);
    if (sim.fatal) break;
  }
  const live = sim.fatal ? [] : sim.liveness();
  await H.killAll();
  return { sim, live };
}

// ─── verdicts ──────────────────────────────────────────────────────────────────────────────────────────────────
/** The asserted violations of a run, one line each (every family this suite asserts; see the header). */
function failuresOf(sim) {
  return sim.violations.filter((v) => family(v.inv) !== 'other')
    .map((v) => `${family(v.inv)} ${v.inv} at step ${v.step} (t+${Math.round(v.t / 1000)} s): ${show(v.details).slice(0, 400)}`);
}
/** An address's liveness verdict after a replay: 'reflected', or the corner that names its miss ('no-corner'). */
function verdictAt(live, address) {
  const miss = live.find((l) => l.a === address);
  if (!miss) return { verdict: 'reflected' };
  return { verdict: (miss.why && miss.why.corner) || 'no-corner', miss };
}

/** The eight modes of A1's campaigns (amend/v2/fuzz/runmodes.sh). */
const MODES = [
  { name: 'base', cfg: {} },
  { name: 'ly', cfg: { latency: true, yields: true } },
  { name: 'iy', cfg: { inject: true, yields: true } },
  { name: 'lost', cfg: { lost: true, pass: true, yields: true, inject: true } },
  { name: 'all', cfg: { pass: true, latency: true, yields: true, inject: true } },
  { name: 'pass', cfg: { pass: true } },
  { name: 'healthy', cfg: { healthy: true, yields: true, inject: true } },
  { name: 'healthyp', cfg: { healthy: true, pass: true, yields: true } },
];
const modeFlags = (cfg) => Object.keys(cfg).filter((k) => cfg[k] === true).join('+') || 'none';

/** Run seeds in one mode; → the failing runs, each with its seed and its asserted violations. */
async function campaign(mode, seeds, steps) {
  const failed = [];
  let ops = 0;
  for (const seed of seeds) {
    const { sim } = await runGenerated(seed, Object.assign({ steps }, mode.cfg));
    ops += sim.stats.ops;
    const f = failuresOf(sim);
    if (f.length) failed.push(`seed ${seed} (${mode.name}: ${modeFlags(mode.cfg)}, ${steps} steps): ${f.length} violation(s)\n          ${f.slice(0, 4).join('\n          ')}`);
  }
  return { failed, ops };
}

// ─── the fixtures ──────────────────────────────────────────────────────────────────────────────────────────────
function readFixture(file) {
  const p = path.join(FIXTURE_DIR, file);
  let text;
  try { text = fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`${FIXTURE_REL}/${file} is missing (${firstLine(e)})`); }
  const fx = JSON.parse(text);
  assert(Array.isArray(fx.trace) && fx.trace.length > 0, `${file}: no trace`);
  assert(isObj(fx.expect), `${file}: no expect`);
  return fx;
}

/**
 * Replay one fixture and hold it to its verdict: no asserted violation anywhere in the run, and, at each address
 * the fixture names, the liveness verdict one of those it allows.
 */
async function checkFixture(file) {
  const fx = readFixture(file);
  const { sim, live } = await replay(fx.trace, Object.assign({}, fx.cfg || {}));
  const problems = failuresOf(sim);
  for (const [address, allowed] of Object.entries(fx.expect.liveness || {})) {
    const { verdict, miss } = verdictAt(live, address);
    if (!allowed.includes(verdict)) {
      problems.push(`at ${shortAddr(address)}: ${verdict === 'reflected' ? 'reflected' : `not reflected (${miss.kind}; graph ${miss.graph}, last ${miss.last || miss.relay}, ${miss.how || ''}) — classified ${verdict}; notes ${show(miss.why && miss.why.notes)}`}; A1 allows only ${show(allowed)}`);
    }
  }
  // A stress fixture also shows its bound is not vacuous: the caps are reached (and, above, never exceeded).
  const reach = fx.expect.reaches || {};
  if (typeof reach.older === 'number' && sim.stats.maxOlder < reach.older) {
    problems.push(`the flood never journaled a lineage with ${reach.older} older ids (at most ${sim.stats.maxOlder}): A1-1 / A1-6's absolute v lines carry the lineage, capped at 8 (A1-7)`);
  }
  if (typeof reach.entryRevokes === 'number' && sim.stats.maxEntryRevokes < reach.entryRevokes) {
    problems.push(`no persisted entry held ${reach.entryRevokes} by-e revokes (at most ${sim.stats.maxEntryRevokes}): A1-5 keeps an entry's 8 most recently merged by-e revokes and discards none for being stale`);
  }
  assert(problems.length === 0, `${file} (${fx.origin}):\n        ${problems.join('\n        ')}`);
}

/**
 * Every fixture, with the corner or decision it documents. Each title states the verdict A1 requires of it.
 * `file` is under test/fixtures/tagging-edges-realtime-property/.
 */
const FIXTURES = [
  // Review round 2's wrongful by-id removals: a stale revoke kept in a waiting place removed a newer relationship.
  ['RF2', 'i2-seed3172.json', 'a deletion of the baseline version, stored just after a round reads the address, never removes the newer version heard after it once a wipe takes that one (healthy, injections, yields): I2 holds (A1-3, A1-4, A1-5)'],
  ['RF3', 'i2-seed3474.json', 'a deletion naming, in upper-case hex, only a replaced version and an id never stored there never removes the relationship a pass wrote from its older read of the newer version, gone with no event: I2 holds (A1-3, A1-4)'],
  ['RF4', 'i2-seed3643.json', 'a deletion naming the replaced baseline version never removes the relationship a pass wrote from its older read of the newer version, gone with no event: I2 holds (A1-3: only the lineage top resolves; A1-4)'],
  ['RF5', 'i2-seed4579.json', 'a deletion naming an already-replaced version, stored while the newer one is held, never removes the relationship a pass then writes for the newer one after it left with no event: I2 holds (A1-3, A1-4, A1-5)'],
  ['RF6', 'i2-seed6383.json', 'the same with a pass and no other fault (no latency, yields or injections): the stale deletion kept in the entry never removes the pass’s relationship: I2 holds (A1-4, A1-5)'],
  ['RF7', 'new3-seed1011.json', 'round 1’s NEW-3 — a deletion that acted on an older version never removes the relationship a later batch wrote, once that version leaves with no event: I2 holds (A1-4, A1-15)'],
  // Round 1's revoke-liveness defects that A1 closes.
  ['RF8', 'new1-seed163.json', 'round 1’s NEW-1 — a round reading the address between a revoke’s store and its delivery still applies the revoke: reflected (A1-2, A1-3)'],
  ['RF9', 'new2-seed2008.json', 'round 1’s NEW-2 — a version the path first learns as a catch-up arrival, revoked by id, is removed: reflected (A1-2, A1-9)'],
  ['RF10', 'f4v2-seed22.json', 'round 1’s F4 variant 2 — a revoke in a reconnect gap is not lost to an empty read before the catch-up: reflected, or decision 5’s first corner widened by the census window (A1-8, A1-16 (5))'],
  ['RF11', 'l1-seed4943.json', 'a revoke stored in the first start’s census window and then wiped: reflected, or the evidence-gone corner (A1-8, A1-16 (5))'],
  ['RF12', 'lostrec-n1-seed30204.json', 'a lost record’s re-baseline with its census, then a by-id revoke of a later version: reflected (A1-8, A1-16 (5) lost-record corner)'],
  // The judged design's two named corners (A1-16, the judge's seeds).
  ['RF13', 'l1-iy-60054.json', 'a version stored just before a crash and never drained, revoked by id while down: reflected, or decision 5’s second corner (A1-16 (5))'],
  ['RF14', 'l1-lost-61245.json', 'an address deletion spelling the pubkey in upper case, delivered while the path did not know the address (stored in a reconnect gap, written by the pass): reflected, or decision 2’s generalised case (A1-16 (2))'],
  // A1-21's last campaign (amend/v2): its misses, as the corners A1 names.
  ['RF15', 'v2-ly-140489.json', 'A1-21’s first miss — a version learned in the last flush interval before a crash, then revoked by id while the restarted path reconnects: reflected, or decision 5’s second corner (A1-16 (5), A1-21)'],
  ['RF16', 'v2-pyix-140925.json', 'A1-21’s second miss — a lost journal and a silent departure at an address a restored lineage held: reflected, or the widened lost-record corner (A1-16 (5), A1-21)'],
  ['RF17', 'v2-pyh-141072.json', 'healthy, with a pass — an address deletion spelling the pubkey in upper case, stored in the first start’s census window before the path knew the address, is excused from AC-2’s minute only as decision 2’s generalised case (A1-8, A1-16 (2))'],
  // A1-20's scenario 15 as a property: the bounds, stressed at one address.
  ['RF18', 'flood-one-address.json', 'a flood at one address — twelve versions, each revoked by id while it is the top, with the graph down, then a round under a live pass: the lineage reaches its cap of 8 older ids and the re-look entry 8 by-e revokes, and never more (A1-5, A1-7)'],
];

// ─── the tests ─────────────────────────────────────────────────────────────────────────────────────────────────

test('RF1: the oracle is not vacuous — I1 flags a removal while the relay held an accepted version, I2 a removal only an OLDER version’s deletion explains, and I2 accepts A1-4’s clauses (i) and (ii) in relay terms (A1-4, A1-15, decision 11)', async () => {
  const { sweep, contract } = lib();
  const failed = [];
  // A hand-built history at one address: v1 stored, v2 replaces it, v3 replaces v2; deletions as each case needs.
  const build = (steps) => {
    const sim = new Sim({});
    const pk = F.ALICE;
    const d = 'rf1';
    const a = addressOf(pk, d);
    const ev = (n) => F.makeTagging({ author: pk, d, id: F.idOf(`rf1:v${n}`), createdAt: NOW_S + n, target: F.BOB });
    const byE = (name, ids) => F.makeDeletion({ author: pk, e: ids, id: F.idOf(`rf1:k:${name}`), createdAt: NOW_S + 100 });
    const edgeOf = (e) => contract.taggingToEdge(e, IDS).edge;
    steps({ sim, a, ev, byE });
    return { sim, a, edgeOf };
  };
  const removal = (sim, a, edge, readMut) => {
    const snap = F.storedRow(edge, { rid: '5:fake:rf1' });
    sim.checkRec({ kind: 'remove', rows: [{ address: a, snapshot: snap }], result: { appliedAddresses: [a] }, readMut: { [a]: readMut }, commitMut: readMut, proc: 1 });
    assert(sweep.storedFromRow(snap).edge.eventId === edge.eventId, 'fixture row');
    return sim.violations.map((v) => v.inv);
  };
  const expect = (name, got, want) => { if (show(got.sort()) !== show(want.sort())) failed.push(`[${name}] expected ${show(want)}, got ${show(got)}`); };
  // (a) I1: the relay still holds v1 when the read happened.
  {
    let v1;
    const { sim, a, edgeOf } = build(({ sim: s, ev }) => { v1 = ev(1); s.w.relay.store(v1); });
    expect('I1: the relay held v1 at the read and at the commit', removal(sim, a, edgeOf(v1), sim.mut), ['I1', 'I1-commit', 'I2']);
  }
  // (b) I2: the graph records v2; only v1's deletion (acted on v1, older than v2) and a silent departure of v2.
  {
    let v2;
    const { sim, a, edgeOf } = build(({ sim: s, ev, byE }) => {
      s.w.relay.store(ev(1)); s.w.relay.store(byE('old', [F.idOf('rf1:v1')]));
      v2 = ev(2); s.w.relay.store(v2); s.w.relay.remove(v2.id);
    });
    expect('I2: only an older version’s deletion', removal(sim, a, edgeOf(v2), sim.mut), ['I2']);
  }
  // (c) clause (i): the deletion names the recorded version v2 (strfry acted on it).
  {
    let v2;
    const { sim, a, edgeOf } = build(({ sim: s, ev, byE }) => { s.w.relay.store(ev(1)); v2 = ev(2); s.w.relay.store(v2); s.w.relay.store(byE('i', [v2.id])); });
    expect('clause (i)', removal(sim, a, edgeOf(v2), sim.mut), []);
  }
  // (d) clause (ii), decision 11: the graph records v2; v3 replaced it; v3's deletion stored after v3 left silently.
  {
    let v2;
    const { sim, a, edgeOf } = build(({ sim: s, ev, byE }) => {
      v2 = ev(2); s.w.relay.store(v2); const v3 = ev(3); s.w.relay.store(v3); s.w.relay.remove(v3.id); s.w.relay.store(byE('ii', [v3.id]));
    });
    expect('clause (ii)', removal(sim, a, edgeOf(v2), sim.mut), []);
    assert(sim.infos['I2-accepted:clause-ii:e-names-a-version-stored-here-no-earlier-than-recorded'] === 1, `clause (ii) should be accepted as decision 11's case: ${show(sim.infos)}`);
  }
  await H.killAll();
  assert(failed.length === 0, `${failed.length} oracle case(s) failed:\n        ${failed.join('\n        ')}`);
});

for (const [id, file, title] of FIXTURES) {
  test(`${id}: ${title} [${FIXTURE_REL}/${file}]`, async () => { await checkFixture(file); });
}

test('RF19: every fixture file is replayed by a test, and each names its origin, what it documents and its verdict (A1-20: "replaying the shrunk traces as fixtures")', async () => {
  let files = [];
  try { files = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json')).sort(); } catch (e) { throw new Error(`${FIXTURE_REL} is missing (${firstLine(e)})`); }
  const listed = new Set(FIXTURES.map((x) => x[1]));
  const unlisted = files.filter((f) => !listed.has(f));
  const missing = [...listed].filter((f) => !files.includes(f));
  const bad = [];
  for (const f of files) {
    const fx = readFixture(f);
    for (const k of ['origin', 'documents', 'adr']) if (typeof fx[k] !== 'string' || !fx[k]) bad.push(`${f}: no ${k}`);
    if (!isObj(fx.cfg)) bad.push(`${f}: no cfg`);
  }
  assert(unlisted.length === 0 && missing.length === 0 && bad.length === 0,
    `fixtures out of step: unlisted ${show(unlisted)}, missing ${show(missing)}, ${show(bad)}`);
});

test('RF20: a seed replays exactly — two runs of one seed and mode give the same operations, graph writes, journal and record (T20: the engine takes time and randomness only from its deps; A1-20: "deterministic")', async () => {
  const fingerprintOf = async () => {
    const { sim, trace } = await runGenerated(7, { steps: 40, pass: true, yields: true, inject: true, lost: true });
    return show({
      trace,
      writes: sim.w.graph.writes.map((x) => [x.kind, x.addresses, x.error, x.result && x.result.appliedAddresses]),
      journal: sim.w.store.journal,
      record: sim.w.store.record,
      violations: sim.violations.map((v) => v.inv),
    });
  };
  const a = await fingerprintOf();
  const b = await fingerprintOf();
  if (a !== b) {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i += 1;
    throw new Error(`two runs of seed 7 differ at character ${i}:\n        first:  …${a.slice(Math.max(0, i - 80), i + 120)}\n        second: …${b.slice(Math.max(0, i - 80), i + 120)}`);
  }
});

/** The default seed list: one short run per mode (seeds and steps fixed; the campaign's first seeds). */
const SMOKE_SEEDS = [1, 2, 3];
const SMOKE_STEPS = 150;
MODES.forEach((mode, i) => {
  test(`RF${21 + i}: mode ${mode.name} (${modeFlags(mode.cfg)}) — seeds ${SMOKE_SEEDS.join(', ')} × ${SMOKE_STEPS} steps hold I1–I4, off within 5 s, no status leak and the bounds${mode.cfg.healthy ? ', and every change and revoke reflected within the minute outside A1-16’s corners' : ''} (A1-20)`, async () => {
    const { failed } = await campaign(mode, SMOKE_SEEDS, SMOKE_STEPS);
    assert(failed.length === 0, `${failed.length} run(s) failed:\n        ${failed.join('\n        ')}`);
  });
});

/** The fuller fixed campaign (opt-in): A1-20's "about 8 modes × 20 seeds × 150 steps". */
const CAMPAIGN_SEEDS = Array.from({ length: 20 }, (_, i) => 1001 + i);
const CAMPAIGN_STEPS = 150;
MODES.forEach((mode, i) => {
  test(`RF${29 + i}: campaign, mode ${mode.name} (${modeFlags(mode.cfg)}) — ${CAMPAIGN_SEEDS.length} fixed seeds × ${CAMPAIGN_STEPS} steps hold every asserted property (A1-20; opt-in: ${CAMPAIGN_ENV}=1)`, async () => {
    if (process.env[CAMPAIGN_ENV] !== '1') skip(`the fuller campaign is opt-in: set ${CAMPAIGN_ENV}=1 to run 8 modes × ${CAMPAIGN_SEEDS.length} seeds × ${CAMPAIGN_STEPS} steps (a few minutes)`);
    const { failed } = await campaign(mode, CAMPAIGN_SEEDS, CAMPAIGN_STEPS);
    assert(failed.length === 0, `${failed.length} of ${CAMPAIGN_SEEDS.length} run(s) failed:\n        ${failed.join('\n        ')}`);
  });
});

// ─── run ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- tagging-edges real-time property tests (epic tagging-edges, Story 3 — ADR 0003 A1-20, the fuzzer) ---');
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
  console.log(`\ntagging-edges-realtime-property: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
