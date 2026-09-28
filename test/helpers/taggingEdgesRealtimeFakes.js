'use strict';
/**
 * Fakes for the real-time path's ENGINE suite (epic tagging-edges, story 3).
 *
 * Story: engineering-team/stories/tagging-edges/3-real-time-path.md
 * ADR:   engineering-team/decisions/tagging-edges/0003-real-time-path.md — clarifications T20 (the engine seam and its
 *        deps), T21 (the store) and the § Decision subsections the fakes stand in for. Binding context: ADR 0002's
 *        graph port (src/pipeline/tagging-edges/graph.js, clarification C6 rows) and ADR 0001's contract.
 * Suite: test/tagging-edges-realtime-engine.test.js
 *
 * One world per scenario: a fake RELAY (strfry 1.1.0's storage and deletion rules, live delivery to subscribers, and
 * `scan` with scanStrict's contract), a fake GRAPH port (graph.js's surface, create-if-absent and fingerprint-verified
 * locked writes), an in-memory STORE (T21), a fake STATE (T20: readReport / isAlive / appendPreimages), a fake CLOCK,
 * and `spawn()`, which builds one process's deps (T20's table) and calls the engine's createEngine(deps). A process can
 * be killed (a crash): from then on every async dep it calls never settles and every store write is dropped, so a dead
 * engine's leftover promises can never touch the world.
 *
 * Nothing under src/ is required at load time. sweep.js (fingerprint, storedFromRow), graph.js (schemaStatusFromRows)
 * and strfryScanStrict.js (ScanError) are required lazily, and the engine itself only through the `loadEngine`
 * function the suite passes in, so a suite that loads this file always loads, red phase included.
 *
 * Every pubkey is a fake from test/helpers/taggingEdgesFixtures.js: never a deployment's TA, never the ADR 0015 literal.
 * No filesystem, network, Neo4j or strfry: the store is in memory (T21's surface, JSON round-trips like a file).
 *
 * What the ADR's clarifications fix, and the fakes follow:
 *   - T29: subscribe's callbacks are called asynchronously, as onEvent(event), onEose() and onClose({ code, reason }),
 *     each from a later macrotask (setImmediate), never from inside subscribe() itself. close() from the client fires
 *     no onClose.
 *   - T29: tick() never awaits deps.sleep; run() owns every sleep. A deps.sleep() called while start() or tick() is in
 *     flight (startEngine / tickOnce) rejects at once, naming T29, so that mistake fails fast instead of hanging.
 *     deps.sleep(ms) called by run() settles when the fake clock reaches its deadline (or advances it: sleepAdvances).
 *   - T26 / T29: the store's and the state's methods are synchronous; the engine awaits them (awaiting works).
 *   - T30: readKeys() answers plain { address, eventId } rows, either value null when the property is absent, rows at
 *     addresses that are not tagging addresses included (the engine ignores those).
 *   - T31: a scan that fails after it began streaming has already handed its events to onEvent (strfry printed them,
 *     then exited non-zero or was cut short), and still rejects.
 *
 * Relay controls beyond strfry's storage rules: muted (the subscription stays connected but stops forwarding: ADR "a
 * subscription that stays connected but stops delivering", owner decision 10) and storeBatch(events) (one import or
 * sync batch: a version the batch itself deleted or replaced is never announced, only what the relay still holds is —
 * story "What can be observed", item 7). A lean world (makeWorld({ lean: true })) keeps each held event's large strings
 * shared with the fixture and serialises on demand, and hands the journal out as a stream, so a child process with a
 * small heap measures the engine, not the fakes.
 */

const crypto = require('crypto');
const path = require('path');
const F = require('./taggingEdgesFixtures');

const REPO = path.resolve(__dirname, '..', '..');
const SWEEP_FILE = path.join(REPO, 'src/lib/tagging-edges/sweep.js');
const GRAPH_FILE = path.join(REPO, 'src/pipeline/tagging-edges/graph.js');
const SCAN_STRICT_FILE = path.join(REPO, 'src/lib/strfryScanStrict.js');

// ─── constants ─────────────────────────────────────────────────────────────────────────────────────────────────
/** The fake clock's start: 2026-09-28T12:00:00Z. */
const T0 = Date.UTC(2026, 8, 28, 12, 0, 0);
/** T0 in seconds, for created_at values. */
const NOW_S = Math.floor(T0 / 1000);
const DAY_S = 86400;
const PASSWORD = 'fake-neo4j-password-7c1e';
const NEO4J_URI = 'bolt://neo4j.internal:7687';
/** TAGGING_EDGES_REALTIME_RELAY_URL (ADR § What it hears): the override the engine must use, and never show. */
const RELAY_URL = 'ws://relay.fake.invalid:7777';
const RANDOM_ID = '0a1b2c3d';
/** ADR 0002's one run-id grammar; the path's session id uses it (ADR 0003, "The pre-image line shape"). */
const RUN_ID_RE = /^\d{8}T\d{6}Z-[0-9a-f]{8}$/;
/** scanStrict's argv check (ADR 0003 step 2 and "New files"): over 100,000 bytes → ScanError 'filter-too-large'. */
const ARGV_FILTER_BYTES = 100000;
const DEFAULT_MAX_BYTES = 256 * 1024 * 1024;
/** strfry's stderr always names the follows Redis (ADR § Status: never in status.json). */
const STDERR_TAIL = 'strfry error: could not connect to redis:6379 (reading /etc/strfry.conf)';
/** How long one start() / tick() may take in REAL time before drive() calls it hung. */
const TICK_GUARD_MS = 20000;
/** ADR 0003 T2 LIMITS: roundKeptBytes, roundScanMaxBytes (and candidateScanMaxBytes). */
const ROUND_KEPT_BYTES = 16777216;
const ROUND_SCAN_MAX_BYTES = 8388608;
const DEFAULT_ENV = Object.freeze({
  NEO4J_URI,
  NEO4J_USER: 'neo4j',
  NEO4J_PASSWORD: PASSWORD,
  TAGGING_EDGES_REALTIME_RELAY_URL: RELAY_URL,
});
const SIG = 'f'.repeat(128);
const HEX64_ANY = /^[0-9a-fA-F]{64}$/;
const A_TARGET_RE = /^(\d+):([0-9a-fA-F]{64}):(.*)$/s;
const TAGGING_ADDRESS_RE = /^39999:[0-9a-f]{64}:(.+)$/s;
const MAX_TAG_VALUE_BYTES = 255;

// ─── small utilities ───────────────────────────────────────────────────────────────────────────────────────────
const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
const iso = (ms) => new Date(ms).toISOString();
/** A deep copy through JSON, as a file would hold it (a BigInt throws, as it would in the real store). */
const jcopy = (v) => (v === undefined || v === null ? null : JSON.parse(JSON.stringify(v)));
/** A deep copy for logs: BigInts become text, so logging never throws. */
const logcopy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? `${x}n` : x))));
const bytesOf = (s) => Buffer.byteLength(s, 'utf8');
const hang = () => new Promise(() => {});

/** Errors from the engine's callbacks (subscription) and unhandled rejections; the suite fails a test that left any. */
const strays = [];
/** Every world made since the last killAll(), so the suite can stop every engine after each test. */
const worlds = [];

function lazy(file, what) {
  try { return require(file); } catch (e) { throw new Error(`${what} not loadable (require failed: ${firstLine(e)})`); }
}
const sweep = () => lazy(SWEEP_FILE, 'src/lib/tagging-edges/sweep.js');

/** sweep.fingerprint — the port's verify compares these (ADR 0002, the guard, step 4). */
function fingerprint(row) { return sweep().fingerprint(row); }

/** Exactly the addresses the contract can produce: `39999:<64 lower-case hex>:<d of 1–255 UTF-8 bytes>`. */
function isTaggingAddress(a) {
  if (typeof a !== 'string') return false;
  const m = TAGGING_ADDRESS_RE.exec(a);
  if (!m) return false;
  const n = bytesOf(m[1]);
  return n >= 1 && n <= MAX_TAG_VALUE_BYTES;
}

/** One READ_ALL-shaped row's stored property, as [type, text, raw], or null. */
function propOf(row, key) {
  const p = row && Array.isArray(row.props) ? row.props.find((x) => Array.isArray(x) && x[0] === key) : null;
  return p ? { type: p[1], text: p[2], raw: p[3] } : null;
}
function propAddress(row) {
  const p = propOf(row, 'address');
  return p && typeof p.text === 'string' ? p.text : null;
}

function neoError(code, message) {
  const e = new Error(message);
  e.name = 'Neo4jError';
  e.code = code;
  return e;
}
const serviceUnavailable = () => neoError('ServiceUnavailable',
  `Could not perform discovery. No routing servers available. Known routing table: ${NEO4J_URI} (neo4j.internal:7687, [::1]:7687)`);
function invariant(message) {
  const e = new Error(message);
  e.code = 'invariant';
  return e;
}

/** A ScanError as scanStrict rejects with — an instance of the exported class when strfryScanStrict.js loads. */
function scanError(code, stderrTail = STDERR_TAIL) {
  let Cls = null;
  try { const m = require(SCAN_STRICT_FILE); if (typeof m.ScanError === 'function') Cls = m.ScanError; } catch (_) { /* not loadable */ }
  const message = `strfry scan failed (${code}) — ${STDERR_TAIL}`;
  if (Cls) return new Cls(code, message, stderrTail);
  return Object.assign(new Error(message), { name: 'ScanError', code, stderrTail });
}

// ─── filters (strfry's matching, as far as the engine's filters need) ─────────────────────────────────────────
function tagValues(ev, name) {
  return Array.isArray(ev.tags) ? ev.tags.filter((t) => Array.isArray(t) && t[0] === name && typeof t[1] === 'string').map((t) => t[1]) : [];
}
const hexEq = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

/**
 * Does `ev` match one NIP-01 filter? `ids`, `authors`, `#e` and `#p` compare hex case-insensitively; every other `#x`
 * compares raw; `#d` matches ANY d tag (strfry 1.1.0). `since` / `until` apply; `limit` does not (a scan and live
 * matching both ignore it).
 */
function matchFilter(ev, f) {
  if (!ev || !f || typeof f !== 'object' || Array.isArray(f)) return false;
  if (Array.isArray(f.ids) && !f.ids.some((x) => hexEq(x, ev.id))) return false;
  if (Array.isArray(f.authors) && !f.authors.some((x) => hexEq(x, ev.pubkey))) return false;
  if (Array.isArray(f.kinds) && !f.kinds.includes(ev.kind)) return false;
  if (typeof f.since === 'number' && ev.created_at < f.since) return false;
  if (typeof f.until === 'number' && ev.created_at > f.until) return false;
  for (const k of Object.keys(f)) {
    if (k.length !== 2 || k[0] !== '#') continue;
    const want = f[k];
    if (!Array.isArray(want)) return false;
    const hexy = k === '#e' || k === '#p';
    const have = tagValues(ev, k[1]);
    if (!have.some((v) => want.some((x) => (hexy ? hexEq(v, x) : v === x)))) return false;
  }
  return true;
}
const filtersOf = (filter) => (Array.isArray(filter) ? filter : [filter]);

/** Which kind of read a scan filter (or filter array) is: any member that is a `kind` counts. */
function filterKindOf(f) {
  if (!f || typeof f !== 'object') return 'other';
  if (Array.isArray(f['#z'])) return 'stamp';
  if (Array.isArray(f.ids)) return 'element';
  if (Array.isArray(f.kinds) && f.kinds.includes(5)) return 'deletion';
  if (Array.isArray(f['#d'])) return 'address';
  return 'other';
}
function scanTouches(filter, kind) { return filtersOf(filter).some((f) => filterKindOf(f) === kind); }
function filterKind(filter) { const f = filtersOf(filter)[0]; return filterKindOf(f); }
/** Does a scan filter (or array) ask for this tagging address (authors ∋ its pubkey and #d ∋ its d)? */
function filterTargets(filter, address) {
  const m = /^39999:([0-9a-f]{64}):(.+)$/s.exec(address);
  if (!m) return false;
  return filtersOf(filter).some((f) => f && Array.isArray(f.authors) && Array.isArray(f['#d'])
    && f.authors.some((a) => hexEq(a, m[1])) && f['#d'].includes(m[2]));
}
/** scanStrict's argv text (ADR T1: JSON with every `/` written `\/`). */
function argvText(filter) { return JSON.stringify(filter).replace(/\//g, '\\/'); }

// ─── the clock ─────────────────────────────────────────────────────────────────────────────────────────────────
function makeClock(t0) {
  const c = { t: t0, sleepers: [] };
  c.now = () => c.t;
  c.advance = (ms) => {
    c.t += ms;
    if (c.sleepers.length === 0) return;
    const due = c.sleepers.filter((s) => s.at <= c.t);
    if (due.length === 0) return;
    c.sleepers = c.sleepers.filter((s) => s.at > c.t);
    for (const s of due) s.resolve();
  };
  c.sleep = (ms) => new Promise((resolve) => { c.sleepers.push({ at: c.t + Math.max(0, Number(ms) || 0), resolve }); });
  return c;
}

/** Let callbacks already scheduled run: `n` macrotask turns (each drains the microtask queue first). */
async function flush(n = 2) {
  for (let i = 0; i < n; i += 1) await new Promise((r) => setImmediate(r));
}
function later(fn) {
  setImmediate(() => {
    try { fn(); } catch (e) { strays.push(`a subscription callback threw: ${firstLine(e)}`); }
  });
}

// ─── the relay ─────────────────────────────────────────────────────────────────────────────────────────────────
const isParamReplaceable = (k) => Number.isInteger(k) && k >= 30000 && k < 40000;
/** strfry files a parameterized-replaceable version under its first `d` of ≤ 255 bytes ('' when none). */
function indexedD(ev) {
  const t = ev.tags.find((x) => Array.isArray(x) && x[0] === 'd' && typeof x[1] === 'string' && bytesOf(x[1]) <= MAX_TAG_VALUE_BYTES);
  return t ? t[1] : '';
}
function shapeOk(ev) {
  return !!ev && typeof ev === 'object' && typeof ev.id === 'string' && HEX64_ANY.test(ev.id)
    && typeof ev.pubkey === 'string' && HEX64_ANY.test(ev.pubkey)
    && Number.isInteger(ev.created_at) && ev.created_at >= 0 && Number.isInteger(ev.kind) && Array.isArray(ev.tags);
}

/**
 * strfry 1.1.0's storage rules, in memory.
 *   store(ev)   one version per (kind, pubkey, first d): a newer one replaces, an older or equal one is refused. A
 *               kind 5 by `e` deletes that id when the author matches and blocks (id, the kind-5's author) from then on;
 *               by `a` deletes the author's versions at that address with created_at ≤ its own and refuses later ones
 *               dated ≤ it. Another author's `e` is stored and does nothing; another author's `a` refuses the kind 5.
 *               Every store notifies the live subscribers whose filters match (no `since` → back-dated ones too).
 *   remove(id), wipe()   an operator's delete or an expiry, and the owner's wipe: silent, no event, no notice.
 *   scan(filter, opts)   scanStrict's contract (see the header).
 *   storeBatch(evs)  one import or sync batch: each is stored as store() does, and only then announced — a version
 *               the batch itself deleted or replaced is never announced (the relay announces what it still holds, and
 *               every kind 5): story "What can be observed" and item 7.
 *   subscribe(o)  REQ; limit:0 → EOSE at once, then live; any other limit replays ≤ 500 stored matches first.
 *   drop()        the connection closes (onClose); setDown(true) also refuses new connections and fails every scan.
 *   muted         true: the subscriptions stay open and connected, but nothing stored is forwarded (a subscription that
 *                 stops delivering; ADR § What it hears "the safety diff", owner decision 10).
 * Hooks: onScan(filter, call), onSubscribe(sub), scanFail(filter, opts, call) → a ScanError code or null.
 * latencyMs     opt-in, 0 by default: each scan advances the fake clock by this many ms before it answers (the time a
 *               strfry process takes), so simulated time passes inside a round. Only a test that sets it sees that.
 * Each scan call records { seq, at, proc, kind, filter, outcome, n, bytes (streamed), maxBytes (as passed) }; `at` is
 * when the scan was called, before any latency.
 */
function makeRelay(w) {
  const r = {
    held: new Map(), byKey: new Map(), dIndex: new Map(), k5: new Map(), eTomb: new Set(), aTomb: new Map(), seq: 0,
    subs: [], subCalls: [], scans: [], refusals: [],
    down: false, muted: false, batch: null, scanFail: null, onScan: null, onSubscribe: null, latencyMs: 0,
  };

  /** What the relay keeps of a stored event: a JSON copy, or, in a lean world, a copy sharing the fixture's strings. */
  function keep(ev0) {
    if (!w.lean) return jcopy(ev0);
    if (!ev0 || typeof ev0 !== 'object') return ev0;
    const c = Object.assign({}, ev0);
    if (Array.isArray(ev0.tags)) c.tags = ev0.tags.map((t) => (Array.isArray(t) ? t.slice() : t));
    return c;
  }
  /** A fresh copy of a held event, as a scan or a delivery hands it over (parsed from its JSON line). */
  function copyOut(h) { return JSON.parse(h.json !== null ? h.json : JSON.stringify(h.ev)); }

  function insert(ev) {
    const id = ev.id.toLowerCase();
    const pk = ev.pubkey.toLowerCase();
    const json = JSON.stringify(ev);
    const entry = { ev, seq: ++r.seq, key: null, json: w.lean ? null : json, bytes: bytesOf(json) + 1 };
    if (isParamReplaceable(ev.kind)) {
      entry.key = `${ev.kind}:${pk}:${indexedD(ev)}`;
      r.byKey.set(entry.key, id);
    }
    for (const d of tagValues(ev, 'd')) {
      const k = `${pk}\n${d}`;
      if (!r.dIndex.has(k)) r.dIndex.set(k, new Set());
      r.dIndex.get(k).add(id);
    }
    if (ev.kind === 5) {
      if (!r.k5.has(pk)) r.k5.set(pk, new Set());
      r.k5.get(pk).add(id);
    }
    r.held.set(id, entry);
    return entry;
  }
  function drop(id) {
    const h = r.held.get(id);
    if (!h) return;
    r.held.delete(id);
    const pk = h.ev.pubkey.toLowerCase();
    if (h.key && r.byKey.get(h.key) === id) r.byKey.delete(h.key);
    for (const d of tagValues(h.ev, 'd')) { const s = r.dIndex.get(`${pk}\n${d}`); if (s) s.delete(id); }
    if (h.ev.kind === 5 && r.k5.has(pk)) r.k5.get(pk).delete(id);
  }
  function deliver(sub, h) {
    later(() => {
      if (!sub.open || sub.proc.killed || typeof sub.onEvent !== 'function') return;
      sub.delivered += 1;
      sub.onEvent(copyOut(h));
    });
  }
  function notify(h) {
    if (r.batch) { r.batch.push(h); return; }
    if (r.muted) return;
    for (const sub of r.subs) {
      if (!sub.open || sub.proc.killed) continue;
      if (sub.filters.some((f) => matchFilter(h.ev, f))) deliver(sub, h);
    }
  }
  const refuse = (ev, reason) => { r.refusals.push({ id: ev && ev.id, reason }); return { stored: false, reason }; };

  r.store = (ev0) => {
    const ev = keep(ev0);
    if (!shapeOk(ev)) return refuse(ev, 'invalid');
    const id = ev.id.toLowerCase();
    const pk = ev.pubkey.toLowerCase();
    if (r.held.has(id)) return refuse(ev, 'duplicate');
    if (r.eTomb.has(`${id}:${pk}`)) return refuse(ev, 'blocked: deleted by id');
    if (ev.kind === 5) {
      const aTargets = [];
      for (const v of tagValues(ev, 'a')) {
        if (bytesOf(v) > MAX_TAG_VALUE_BYTES) continue; // strfry acts on no longer value
        const m = A_TARGET_RE.exec(v);
        if (!m) continue;
        if (m[2].toLowerCase() !== pk) return refuse(ev, 'blocked: an address deletion naming another author');
        aTargets.push(`${Number(m[1])}:${pk}:${m[3]}`);
      }
      for (const v of tagValues(ev, 'e')) {
        if (!HEX64_ANY.test(v)) continue;
        const t = v.toLowerCase();
        r.eTomb.add(`${t}:${pk}`);
        const h = r.held.get(t);
        if (h && h.ev.pubkey.toLowerCase() === pk && h.ev.kind !== 5) drop(t);
      }
      for (const key of aTargets) {
        r.aTomb.set(key, Math.max(r.aTomb.has(key) ? r.aTomb.get(key) : -Infinity, ev.created_at));
        const hid = r.byKey.get(key);
        const h = hid ? r.held.get(hid) : null;
        if (h && h.ev.created_at <= ev.created_at) drop(hid);
      }
    } else if (isParamReplaceable(ev.kind)) {
      const key = `${ev.kind}:${pk}:${indexedD(ev)}`;
      if (r.aTomb.has(key) && ev.created_at <= r.aTomb.get(key)) return refuse(ev, 'blocked: deleted by address');
      const hid = r.byKey.get(key);
      if (hid) {
        const h = r.held.get(hid);
        if (ev.created_at <= h.ev.created_at) return refuse(ev, 'replaced: holds a newer or equal version');
        drop(hid);
      }
    }
    notify(insert(ev));
    return { stored: true };
  };
  r.storeBatch = (evs) => {
    const announced = [];
    r.batch = announced;
    let out;
    try { out = evs.map((ev) => r.store(ev)); } finally { r.batch = null; }
    for (const h of announced) if (h.ev.kind === 5 || r.held.get(h.ev.id.toLowerCase()) === h) notify(h);
    return out;
  };
  r.remove = (id) => { drop(String(id).toLowerCase()); };
  r.wipe = () => {
    r.held.clear(); r.byKey.clear(); r.dIndex.clear(); r.k5.clear(); r.eTomb.clear(); r.aTomb.clear();
  };
  r.holds = (id) => r.held.has(String(id).toLowerCase());
  /** The version the relay holds at a tagging address (a copy), or null. */
  r.atAddress = (address) => {
    const m = /^(\d+):([0-9a-fA-F]{64}):(.*)$/s.exec(String(address));
    if (!m) return null;
    const id = r.byKey.get(`${Number(m[1])}:${m[2].toLowerCase()}:${m[3]}`);
    const h = id ? r.held.get(id) : null;
    return h ? copyOut(h) : null;
  };

  function candidates(f) {
    if (!f || typeof f !== 'object') return [];
    if (Array.isArray(f.ids)) return f.ids.map((x) => r.held.get(String(x).toLowerCase())).filter(Boolean);
    if (Array.isArray(f.authors) && Array.isArray(f['#d'])) {
      const ids = new Set();
      for (const a of f.authors) for (const d of f['#d']) for (const id of r.dIndex.get(`${String(a).toLowerCase()}\n${d}`) || []) ids.add(id);
      return [...ids].map((id) => r.held.get(id)).filter(Boolean);
    }
    if (Array.isArray(f.authors) && Array.isArray(f.kinds) && f.kinds.length === 1 && f.kinds[0] === 5) {
      const ids = new Set();
      for (const a of f.authors) for (const id of r.k5.get(String(a).toLowerCase()) || []) ids.add(id);
      return [...ids].map((id) => r.held.get(id)).filter(Boolean);
    }
    return [...r.held.values()];
  }
  function select(filter) {
    const seen = new Set();
    const out = [];
    for (const f of filtersOf(filter)) {
      for (const h of candidates(f)) {
        if (seen.has(h.ev.id)) continue;
        if (matchFilter(h.ev, f)) { seen.add(h.ev.id); out.push(h); }
      }
    }
    out.sort((a, b) => a.seq - b.seq);
    return out;
  }

  /** scanStrict's contract: → { events, lines, bytes, elapsedMs } or a ScanError; `onEvent` streams (events not kept). */
  r.scan = async (filter, opts, proc) => {
    const call = {
      seq: w.nextSeq(), at: w.clock.t, proc: proc ? proc.n : null, kind: filterKind(filter), filter: w.keepScanFilters ? logcopy(filter) : null,
      outcome: 'pending', n: 0, bytes: 0, maxBytes: opts && typeof opts === 'object' && typeof opts.maxBytes === 'number' ? opts.maxBytes : null,
    };
    r.scans.push(call);
    await null;
    const o = opts && typeof opts === 'object' ? opts : {};
    if (typeof o.isExpected !== 'function') {
      call.outcome = 'no-isExpected';
      throw new TypeError('scanStrict: opts.isExpected must be a function (a strict read checks every event)');
    }
    if (bytesOf(argvText(filter)) > ARGV_FILTER_BYTES) { call.outcome = 'filter-too-large'; throw scanError('filter-too-large'); }
    if (r.latencyMs > 0) w.clock.advance(r.latencyMs);
    if (r.onScan) r.onScan(filter, call);
    const injected = r.down ? 'exit' : (typeof r.scanFail === 'function' ? r.scanFail(filter, o, call) : null);
    const out = r.down ? [] : select(filter);
    const maxBytes = typeof o.maxBytes === 'number' ? o.maxBytes : DEFAULT_MAX_BYTES;
    let bytes = 0;
    const events = [];
    for (const h of out) {
      bytes += h.bytes;
      call.bytes = bytes;
      if (bytes > maxBytes) { call.outcome = 'too-large'; throw scanError('too-large'); }
      const ev = copyOut(h);
      let ok = false;
      try { ok = !!o.isExpected(ev); } catch (_) { ok = false; }
      if (!ok) { call.outcome = 'off-filter'; throw scanError('off-filter'); }
      if (typeof o.onEvent === 'function') o.onEvent(ev); else events.push(ev);
    }
    if (injected) { call.outcome = injected; throw scanError(injected); }
    call.outcome = 'ok';
    call.n = out.length;
    return { events, lines: out.length, bytes, elapsedMs: 1 };
  };

  r.subscribe = (o, proc) => {
    const raw = o && o.filters;
    const sub = {
      n: r.subCalls.length + 1, proc, at: w.clock.t, seq: w.nextSeq(), url: o && o.url,
      filters: logcopy(Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? [raw] : [])),
      onEvent: o && o.onEvent, onEose: o && o.onEose, onClose: o && o.onClose, open: true, delivered: 0,
    };
    r.subCalls.push(sub);
    if (r.down) {
      sub.open = false;
      later(() => { if (!proc.killed && typeof sub.onClose === 'function') sub.onClose({ code: 1006, reason: 'connection refused' }); });
      return { close() { sub.open = false; } };
    }
    r.subs = r.subs.filter((s) => s.open);
    r.subs.push(sub);
    if (r.onSubscribe) r.onSubscribe(sub);
    for (const f of sub.filters) {
      if (f && f.limit === 0) continue;
      const n = Math.min(f && typeof f.limit === 'number' ? f.limit : 500, 500);
      const replay = [...r.held.values()].filter((h) => matchFilter(h.ev, f))
        .sort((a, b) => b.ev.created_at - a.ev.created_at).slice(0, n);
      for (const h of replay) deliver(sub, h);
    }
    later(() => { if (sub.open && !proc.killed && typeof sub.onEose === 'function') sub.onEose(); });
    return { close() { sub.open = false; sub.closedByClient = true; } };
  };
  r.openSubs = () => r.subs.filter((s) => s.open && !s.proc.killed);
  r.drop = () => {
    for (const s of r.subs) {
      if (!s.open) continue;
      s.open = false;
      later(() => { if (!s.proc.killed && typeof s.onClose === 'function') s.onClose({ code: 1006, reason: 'connection dropped' }); });
    }
  };
  r.setDown = (down) => { r.down = !!down; if (down) r.drop(); };
  return r;
}

// ─── the graph ─────────────────────────────────────────────────────────────────────────────────────────────────
/** SHOW CONSTRAINTS / SHOW INDEXES rows (Neo4j 5 columns) for a schema state (as test/tagging-edges-runner.test.js). */
function schemaRows(s) {
  const constraints = [];
  const indexes = [];
  let id = 1;
  const unique = (name, entityType, label, prop, type, state) => {
    constraints.push({ id: id++, name, type, entityType, labelsOrTypes: [label], properties: [prop], ownedIndex: name, propertyType: null });
    indexes.push({ id: id++, name, state, populationPercent: state === 'ONLINE' ? 100 : 40, type: 'RANGE', entityType, labelsOrTypes: [label], properties: [prop], indexProvider: 'range-1.0', owningConstraint: name, lastRead: null, readCount: 0 });
  };
  unique('nostrEvent_id', 'NODE', 'NostrEvent', 'id', 'UNIQUENESS', 'ONLINE');
  if (s.nostrUser) unique('nostrUser_pubkey', 'NODE', 'NostrUser', 'pubkey', 'UNIQUENESS', 'ONLINE');
  if (s.tags !== 'missing') unique('tags_address', 'RELATIONSHIP', 'TAGS', 'address', 'RELATIONSHIP_UNIQUENESS', s.tags === 'online' ? 'ONLINE' : 'POPULATING');
  indexes.push({ id: id++, name: 'nostrUser_hops', state: 'ONLINE', populationPercent: 100, type: 'RANGE', entityType: 'NODE', labelsOrTypes: ['NostrUser'], properties: ['hops'], indexProvider: 'range-1.0', owningConstraint: null, lastRead: null, readCount: 0 });
  return { constraints, indexes };
}
/** readSchema()'s answer: the SHOW rows, plus graph.js's schemaStatusFromRows view spread in (as the runner suite's fake). */
function schemaView(s) {
  const { constraints, indexes } = schemaRows(s);
  let status = {};
  try {
    const g = require(GRAPH_FILE);
    if (typeof g.schemaStatusFromRows === 'function') status = g.schemaStatusFromRows(jcopy(constraints), jcopy(indexes)) || {};
  } catch (_) { /* graph.js not loadable: the rows only */ }
  return Object.assign({}, status, { constraints, indexes });
}

/** A READ_ALL row for an edge as graph.js stores it: the nine properties only (nulls absent), both ends NostrUser. */
function rowFromEdge(edge, rid, rowOpts = {}) {
  const e = { type: 'TAGS', from: edge.from, to: edge.to };
  for (const k of F.PROPERTY_KEYS) {
    let v = edge[k] === undefined ? null : edge[k];
    if (typeof v === 'bigint') v = Number(v);
    e[k] = v;
  }
  return F.storedRow(e, Object.assign({}, rowOpts, { rid }));
}

/**
 * graph.js's port over an in-memory graph. `rows` holds the TAGS relationships at tagging addresses (one per address:
 * tags_address), `others` those left in place (address missing or not a tagging address), `people` the NostrUser
 * nodes. Every port call is logged in `calls`; every write call (applyCreates / applyLocked) in `writes`, with the
 * rows it was given, when it started (seq) and, if it committed, its result and commitSeq.
 * Controls: down (every call → ServiceUnavailable), schema { tags: 'online'|'missing'|'populating', nostrUser },
 * failReads(op) → an error or null, failWrites(kind, rows, rec) → an error or null (the whole call fails, nothing
 * commits), beforeApply(kind, rows, rec) (awaited just before the transaction acts: another writer's move), latencyMs
 * (opt-in, 0 by default: each port call advances the fake clock by this many ms once it is logged, the time a
 * transaction takes; only a test that sets it sees simulated time pass inside a round).
 */
function makeGraph(w) {
  const g = {
    rows: new Map(), others: [], people: new Map(), ridSeq: 0,
    down: false, schema: { tags: 'online', nostrUser: true },
    failReads: null, failWrites: null, beforeApply: null, keepRows: true, latencyMs: 0,
    calls: [], writes: [], violations: [], unknownAccess: [], ddl: [],
  };
  g.nextRid = () => `5:fake:${String(++g.ridSeq).padStart(7, '0')}`;
  g.merge = (pk) => {
    if (typeof pk !== 'string' || g.people.has(pk)) return 0;
    g.people.set(pk, { pubkey: pk });
    return 1;
  };
  /** Seed (or overwrite, as another writer would) the relationship for a contract edge. rowOpts go to F.storedRow. */
  g.putEdge = (edge, { rid, keepRid = false, rowOpts } = {}) => {
    const cur = g.rows.get(edge.address);
    const useRid = rid || (keepRid && cur ? cur.rid : g.nextRid());
    g.merge(edge.from); g.merge(edge.to);
    const row = rowFromEdge(edge, useRid, rowOpts || {});
    g.rows.set(edge.address, row);
    return row;
  };
  /** Seed a raw READ_ALL row (a left-in-place row goes to `others`). */
  g.putRow = (row) => {
    const a = propAddress(row);
    if (isTaggingAddress(a)) g.rows.set(a, row); else g.others.push(row);
    if (typeof row.fromPubkey === 'string') g.merge(row.fromPubkey);
    if (typeof row.toPubkey === 'string') g.merge(row.toPubkey);
  };
  g.findRow = (address) => g.rows.get(address) || g.others.find((r) => propAddress(r) === address) || null;
  g.removeRow = (address, row) => {
    if (g.rows.get(address) === row) { g.rows.delete(address); return; }
    const i = g.others.indexOf(row);
    if (i >= 0) g.others.splice(i, 1);
  };
  /** The stored edge at an address ({ type, from, to, …nine }), read as sweep.storedFromRow reads it, or null. */
  g.edgeAt = (address) => {
    const row = g.rows.get(address);
    return row ? sweep().storedFromRow(row).edge : null;
  };

  function note(op, proc, extra) {
    const e = Object.assign({ op, seq: w.nextSeq(), at: w.clock.t, proc: proc ? proc.n : null }, extra || {});
    g.calls.push(e);
    if (g.latencyMs > 0) w.clock.advance(g.latencyMs);
    return e;
  }
  function checkRead(op) {
    if (g.down) throw serviceUnavailable();
    const e = typeof g.failReads === 'function' ? g.failReads(op) : null;
    if (e) throw e;
  }
  function logWrite(kind, rows, proc) {
    const list = Array.isArray(rows) ? rows : [];
    const addresses = list.map((r) => (r && typeof r.address === 'string' ? r.address : null));
    const rec = {
      seq: w.nextSeq(), at: w.clock.t, proc: proc ? proc.n : null, kind, n: Array.isArray(rows) ? rows.length : null, addresses,
      rows: g.keepRows ? logcopy(list) : null,
      relayAt: g.keepRows ? Object.fromEntries(addresses.filter(Boolean).map((a) => [a, w.relay.atAddress(a)])) : null,
      result: null, error: null, commitSeq: null,
    };
    g.writes.push(rec);
    return rec;
  }
  /** clarification C6's rows, checked as graph.js's toPortRow checks them. */
  function validate(kind, rows, rec) {
    if (!Array.isArray(rows)) { g.violations.push(`${kind}: rows is not an array (${typeof rows})`); return []; }
    const out = [];
    for (const r of rows) {
      if (!r || typeof r !== 'object' || typeof r.address !== 'string') {
        g.violations.push(`${kind}: a row has no address`);
        rec.error = 'invariant';
        throw invariant(`a ${kind} row has no address`);
      }
      if (!isTaggingAddress(r.address)) g.violations.push(`${kind} row names ${JSON.stringify(r.address)}, which is not a tagging address (AC-7)`);
      const row = Object.assign({}, r);
      if (kind !== 'create') {
        const snap = r.snapshot !== undefined ? r.snapshot : r.row;
        if (!snap || typeof snap !== 'object' || !Array.isArray(snap.props)) {
          g.violations.push(`${kind} row ${r.address} has no snapshot`);
          rec.error = 'invariant';
          throw invariant(`${kind} row ${r.address} has no snapshot`);
        }
        row.snapshot = snap;
      }
      if (kind !== 'remove') {
        const d = r.desired;
        if (!d || typeof d !== 'object' || d.address !== r.address || typeof d.from !== 'string' || typeof d.to !== 'string') {
          g.violations.push(`${kind} row ${r.address} does not carry an edge for its own address`);
          rec.error = 'invariant';
          throw invariant(`${kind} row ${r.address} does not carry an edge for its own address`);
        }
      }
      out.push(row);
    }
    return out;
  }
  function checkWrite(kind, rows, rec) {
    if (g.down) { rec.error = 'ServiceUnavailable'; throw serviceUnavailable(); }
    const e = typeof g.failWrites === 'function' ? g.failWrites(kind, rows, rec) : null;
    if (e) { rec.error = e.code || 'error'; throw e; }
  }

  g.port = (proc) => {
    const dead = () => proc.killed;
    const methods = {
      async readSchema() {
        if (dead()) return hang();
        note('readSchema', proc);
        await null;
        checkRead('readSchema');
        return schemaView(g.schema);
      },
      async readAt(addresses, opts) {
        if (dead()) return hang();
        note('readAt', proc, {
          n: Array.isArray(addresses) ? addresses.length : null, timeoutMs: opts && opts.timeoutMs,
          addresses: g.keepRows && Array.isArray(addresses) ? addresses.slice() : null,
        });
        await null;
        checkRead('readAt');
        if (!Array.isArray(addresses)) throw invariant('readAt takes an array of addresses');
        const out = [];
        for (const a of addresses) {
          const row = g.rows.get(a);
          if (row) out.push(jcopy(row));
          for (const o of g.others) if (propAddress(o) === a) out.push(jcopy(o));
        }
        return out;
      },
      async readKeys(opts) {
        if (dead()) return hang();
        note('readKeys', proc, { timeoutMs: opts && opts.timeoutMs });
        await null;
        checkRead('readKeys');
        return [...g.rows.values(), ...g.others].map((row) => {
          const e = propOf(row, 'eventId');
          return { address: propAddress(row), eventId: e && typeof e.text === 'string' ? e.text : null };
        });
      },
      async applyCreates(rows, opts) {
        if (dead()) return hang();
        const rec = logWrite('create', rows, proc);
        note('applyCreates', proc, { n: rec.n, timeoutMs: opts && opts.timeoutMs });
        await null;
        const list = validate('create', rows, rec);
        checkWrite('create', list, rec);
        if (g.beforeApply) await g.beforeApply('create', list, rec);
        const res = { applied: 0, lostRace: 0, nodesCreated: 0, transientRetries: 0, appliedAddresses: [] };
        for (const r of list) {
          if (g.findRow(r.address)) { res.lostRace += 1; continue; }
          res.nodesCreated += g.merge(r.desired.from) + g.merge(r.desired.to);
          g.rows.set(r.address, rowFromEdge(r.desired, g.nextRid()));
          res.applied += 1;
          res.appliedAddresses.push(r.address);
        }
        rec.result = logcopy(res);
        rec.commitSeq = w.nextSeq();
        return res;
      },
      async applyLocked(kind, rows, opts) {
        if (dead()) return hang();
        const rec = logWrite(String(kind), rows, proc);
        note('applyLocked', proc, { kind, n: rec.n, timeoutMs: opts && opts.timeoutMs });
        await null;
        if (!opts || typeof opts.preimage !== 'function') {
          g.violations.push(`applyLocked(${kind}) without a preimage recorder`);
          rec.error = 'invariant';
          throw invariant('applyLocked needs a preimage recorder');
        }
        if (!['update', 'move', 'remove'].includes(kind)) {
          g.violations.push(`applyLocked with unknown kind ${JSON.stringify(kind)}`);
          rec.error = 'invariant';
          throw invariant(`unknown locked write ${kind}`);
        }
        const list = validate(kind, rows, rec).map((r) => Object.assign(r, { row: r.snapshot, fingerprint: fingerprint(r.snapshot) }));
        rec.preimageSeq = w.nextSeq();
        await opts.preimage(list);
        checkWrite(kind, list, rec);
        if (g.beforeApply) await g.beforeApply(kind, list, rec);
        const res = { applied: 0, lostRace: 0, nodesCreated: 0, transientRetries: 0, appliedAddresses: [] };
        for (const r of list) {
          const cur = g.findRow(r.address);
          if (!cur || fingerprint(cur) !== r.fingerprint) { res.lostRace += 1; continue; }
          if (kind === 'update') {
            // UPDATE sets the properties and keeps the relationship (its element id and ends).
            g.removeRow(r.address, cur);
            g.rows.set(r.address, rowFromEdge(Object.assign({}, r.desired, { from: cur.fromPubkey, to: cur.toPubkey }), cur.rid));
          } else if (kind === 'move') {
            g.removeRow(r.address, cur);
            res.nodesCreated += g.merge(r.desired.from) + g.merge(r.desired.to);
            g.rows.set(r.address, rowFromEdge(r.desired, g.nextRid()));
          } else {
            g.removeRow(r.address, cur);
          }
          res.applied += 1;
          res.appliedAddresses.push(r.address);
        }
        rec.result = logcopy(res);
        rec.commitSeq = w.nextSeq();
        return res;
      },
      async ensureTagsConstraint(opts) {
        if (dead()) return hang();
        g.ddl.push({ seq: w.nextSeq(), op: 'ensureTagsConstraint', opts: logcopy(opts) });
        note('ensureTagsConstraint', proc);
        await null;
        checkRead('ensureTagsConstraint');
        return schemaView(g.schema);
      },
      async readAll(opts) {
        if (dead()) return hang();
        note('readAll', proc, { timeoutMs: opts && opts.timeoutMs });
        await null;
        checkRead('readAll');
        return [...g.rows.values(), ...g.others].map(jcopy);
      },
      async close() { if (!dead()) note('close', proc); },
    };
    return new Proxy(methods, {
      get(t, k) {
        if (typeof k === 'symbol' || k === 'then' || k === 'toJSON' || k === 'inspect' || k === 'constructor') return undefined;
        if (Object.prototype.hasOwnProperty.call(t, k)) return t[k];
        g.unknownAccess.push(String(k));
        return undefined;
      },
    });
  };
  /** The successful write calls (committed), and all write calls including rejected ones. */
  g.committed = () => g.writes.filter((r) => r.result);
  return g;
}

// ─── the store (T21, in memory) ────────────────────────────────────────────────────────────────────────────────
/**
 * T21's store over plain fields, its methods synchronous (T26). Test controls: `switch` (the parsed switch.json, null
 * when missing, or { unreadable: true }), `setSwitch(on)`, `record` (null when missing), `recordUnreadable`, `journal`
 * (the file's text), `journalUnreadableOpens` (the next n openJournal() calls answer unreadable), `started`, `status`.
 * openJournal() answers { lines } as T21 / T26 give it: the lines without their newlines and no empty item after the
 * last one — an array, or in a lean world a one-pass iterator over the text (T21: "Iterable<string>"; the ADR's
 * "Replay is streamed line by line"), so a replay that holds the whole journal is the engine's cost, not the fake's.
 */
function makeStore(w) {
  const s = {
    switch: { on: true, changedAt: iso(T0 - 60000), changedBy: 'b0b0b0b0' },
    started: null, startedSeq: null, record: null, recordSeq: null, recordUnreadable: false,
    journalUnreadableOpens: 0, status: null, statusWriteTimes: [], switchWrites: [],
  };
  // The journal's text, with its byte size kept alongside (a test may also assign the text directly).
  let journalText = '';
  let journalSize = 0;
  Object.defineProperty(s, 'journal', {
    enumerable: true,
    get() { return journalText; },
    set(v) { journalText = String(v); journalSize = bytesOf(journalText); },
  });
  const appendText = (t) => { journalText += t; journalSize += bytesOf(t); };
  s.setSwitch = (on) => { s.switch = { on: !!on, changedAt: iso(w.clock.t), changedBy: 'b0b0b0b0' }; };
  s.api = (proc) => {
    const dead = () => proc.killed;
    return {
      readSwitch() { return jcopy(s.switch); },
      writeSwitch(rec) { s.switchWrites.push({ proc: proc.n, rec: logcopy(rec) }); if (!dead()) s.switch = jcopy(rec); },
      unlinkSwitch() { s.switchWrites.push({ proc: proc.n, rec: 'unlink' }); if (!dead()) s.switch = null; },
      readStarted() { return jcopy(s.started); },
      writeStarted(obj) { if (dead()) return; s.started = jcopy(obj); s.startedSeq = w.nextSeq(); },
      readRecord() {
        if (s.recordUnreadable) return { unreadable: true, reason: 'record-unreadable' };
        return jcopy(s.record);
      },
      writeRecord(body) {
        if (dead()) return;
        const b = JSON.parse(JSON.stringify(body));
        delete b.sha256;
        const sha256 = crypto.createHash('sha256').update(JSON.stringify(b), 'utf8').digest('hex');
        s.record = Object.assign(b, { sha256 });
        s.recordSeq = w.nextSeq();
        s.recordUnreadable = false;
      },
      openJournal() {
        if (s.journalUnreadableOpens > 0) { s.journalUnreadableOpens -= 1; return { unreadable: true }; }
        const cut = s.journal.lastIndexOf('\n');
        if (!dead() && cut + 1 !== s.journal.length) s.journal = s.journal.slice(0, cut + 1);
        const text = s.journal;
        if (!w.lean) return { lines: text.split('\n').filter((l) => l.length > 0) };
        function* lines() {
          let i = 0;
          while (i < text.length) {
            const j = text.indexOf('\n', i);
            const end = j < 0 ? text.length : j;
            if (end > i) yield text.slice(i, end);
            i = end + 1;
          }
        }
        return { lines: lines() };
      },
      appendJournal(lines) {
        if (dead()) return;
        appendText(Array.isArray(lines) ? lines.join('') : String(lines));
      },
      truncateJournal() { if (!dead()) s.journal = ''; },
      journalBytes() { return journalSize; },
      readStatus() { return jcopy(s.status); },
      writeStatus(obj) {
        if (dead()) return;
        s.status = JSON.parse(JSON.stringify(obj));
        if (s.statusWriteTimes.length < 20000) s.statusWriteTimes.push(w.clock.t);
      },
    };
  };
  return s;
}

// ─── the state port (T20: readReport, isAlive, appendPreimages) ───────────────────────────────────────────────
/**
 * T20's `state`. isAlive(record) is true while the test says that pass runs (by runId, or by process pid). Any other
 * member the engine reads is recorded in world.stateAccess (the pass's report writer, held files, confirmations and
 * lock have no business here: ADR 0003 D6, binding 4). lockHeld is answered (true) and recorded, in case the engine
 * checks its own daemon lock through it.
 */
function stateFor(w, proc) {
  const base = {
    readReport() { w.reportReads += 1; return jcopy(w.report); },
    isAlive(rec) {
      if (!rec || typeof rec !== 'object') return false;
      if (typeof rec.runId === 'string') return w.alivePasses.has(rec.runId);
      const pid = rec.process && typeof rec.process === 'object' ? rec.process.pid : rec.pid;
      return [...w.alivePasses.values()].some((p) => p.pid === pid);
    },
    appendPreimages(runId, records) {
      if (proc.killed) return null;
      const list = Array.isArray(records) ? records : [];
      w.preimages.push({ seq: w.nextSeq(), at: w.clock.t, proc: proc.n, runId, records: logcopy(list) });
      return list.length ? `preimages/${runId}.jsonl` : null;
    },
    lockHeld(fd, opts) { w.lockChecks.push({ proc: proc.n, fd, file: opts && opts.file }); return true; },
  };
  return new Proxy(base, {
    get(t, k) {
      if (typeof k === 'symbol' || k === 'then' || k === 'toJSON' || k === 'inspect' || k === 'constructor') return undefined;
      if (Object.prototype.hasOwnProperty.call(t, k)) return t[k];
      w.stateAccess.push(String(k));
      return undefined;
    },
  });
}

// ─── the world ─────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * A fresh world. Options: loadEngine (a function returning the engine module — the suite's lazy load()), env (merged
 * over DEFAULT_ENV), t0, lean (the relay keeps each event's large strings shared with the fixture and serialises on
 * demand, and the store hands the journal out as a stream: for large-event and memory scenarios).
 */
function makeWorld(o = {}) {
  let seq = 0;
  const w = {
    clock: makeClock(o.t0 === undefined ? T0 : o.t0),
    nextSeq: () => { seq += 1; return seq; },
    procs: [], report: null, alivePasses: new Map(), passSeq: 0, reportReads: 0,
    preimages: [], stateAccess: [], lockChecks: [], logs: [], sleeps: [], openGraphCalls: [],
    keepScanFilters: true, loadEngine: o.loadEngine, lean: !!o.lean,
  };
  w.env = Object.assign({}, DEFAULT_ENV, o.env || {});
  /** The identities every process reads unless spawn() is given others (T20: ADR 0002 C1's getters). */
  w.identities = { canonicalZ: () => F.STAMP(F.CANONICAL), getOwnerAssistantPubkey: () => F.LOCAL };
  w.relay = makeRelay(w);
  w.graph = makeGraph(w);
  w.store = makeStore(w);

  /** One process's deps (T20's table), without creating an engine. Options: identities, env, sleepAdvances, onSleep. */
  w.makeDeps = (so = {}) => {
    const n = w.procs.length + 1;
    const proc = { n, world: w, killed: false, exited: null, engine: null, inCall: null };
    const ids = so.identities || w.identities;
    proc.deps = {
      now: () => w.clock.t,
      sleep: (ms) => {
        w.sleeps.push({ proc: n, ms, at: w.clock.t, inCall: proc.inCall });
        if (proc.killed) return hang();
        if (proc.inCall) {
          return Promise.reject(new Error(`deps.sleep(${ms}) was called inside ${proc.inCall} (ADR 0003 T29: tick() never awaits deps.sleep; run() owns every sleep)`));
        }
        if (so.sleepAdvances) {
          w.clock.advance(Math.max(0, Number(ms) || 0));
          if (so.onSleep) so.onSleep(ms);
          return new Promise((r) => setImmediate(r));
        }
        return w.clock.sleep(ms);
      },
      env: Object.assign({}, w.env, so.env || {}),
      identities: {
        canonicalZ: () => ids.canonicalZ(),
        getOwnerAssistantPubkey: () => ids.getOwnerAssistantPubkey(),
      },
      openGraph: (cfg) => {
        w.openGraphCalls.push({ proc: n, uri: cfg && cfg.uri, user: cfg && cfg.user, passwordMatches: !!cfg && cfg.password === w.env.NEO4J_PASSWORD });
        return w.graph.port(proc);
      },
      scan: (filter, opts) => (proc.killed ? hang() : w.relay.scan(filter, opts, proc)),
      subscribe: (opts) => (proc.killed ? { close() {} } : w.relay.subscribe(opts, proc)),
      store: w.store.api(proc),
      state: stateFor(w, proc),
      proc: { pid: 4200 + n, startTime: String(900000 + n), exitCode: undefined },
      randomId: () => RANDOM_ID,
      log: (line) => { if (!proc.killed && w.logs.length < 5000) w.logs.push(String(line)); },
    };
    proc.kill = () => {
      proc.killed = true;
      for (const s of w.relay.subs) if (s.proc === proc) s.open = false;
    };
    w.procs.push(proc);
    return proc;
  };
  /** A process running the engine: makeDeps(so), then createEngine(deps). */
  w.spawn = (so = {}) => {
    if (typeof w.loadEngine !== 'function') throw new Error('makeWorld: no loadEngine given');
    const mod = w.loadEngine();
    if (!mod || typeof mod.createEngine !== 'function') {
      throw new Error(`the engine module must export createEngine(deps) (ADR 0003 T20); it exports ${JSON.stringify(Object.keys(mod || {}))}`);
    }
    const proc = w.makeDeps(so);
    proc.engine = mod.createEngine(proc.deps);
    return proc;
  };
  /** Time passing with no engine running (downtime). */
  w.advance = async (ms) => { w.clock.advance(ms); await flush(); };

  // The pass's report (ADR 0002 "The report"): the engine reads it; only the test writes it.
  const findRun = (runId) => {
    const all = w.report ? [w.report.latest, ...(w.report.previous || [])] : [];
    return all.find((x) => x && x.runId === runId) || null;
  };
  /** A pass starts: its pessimistic record becomes `latest` (endedAt null), and it is alive. */
  w.passStart = (runId) => {
    w.passSeq += 1;
    const run = {
      runId, startedAt: iso(w.clock.t), endedAt: null, durationMs: null, outcome: 'failed', reasonCode: 'stopped',
      stopped: true, running: true, process: { pid: 7000 + w.passSeq, startTime: String(5550 + w.passSeq) },
    };
    const prev = w.report && w.report.latest ? [w.report.latest, ...(w.report.previous || [])].slice(0, 9) : [];
    w.report = { reportVersion: 1, latest: run, previous: prev };
    w.alivePasses.set(runId, run.process);
    return run;
  };
  /** The pass ends: endedAt is written after its last write, and it is no longer alive. */
  w.passEnd = (runId) => {
    const run = findRun(runId);
    if (!run) throw new Error(`passEnd: no run ${runId} in the report`);
    run.endedAt = iso(w.clock.t);
    run.durationMs = Date.parse(run.endedAt) - Date.parse(run.startedAt);
    run.outcome = 'done'; run.reasonCode = 'done'; run.stopped = false; run.running = false;
    w.alivePasses.delete(runId);
  };
  /** The pass is killed mid-run: endedAt stays null (ADR 0002: a killed pass keeps endedAt null). */
  w.passDie = (runId) => { w.alivePasses.delete(runId); };
  /** The pass writes an edge (an UPDATE keeps the relationship's element id; a CREATE gets a new one). */
  w.passWrite = (edge, { keepRid = false, rowOpts } = {}) => w.graph.putEdge(edge, { keepRid, rowOpts });

  worlds.push(w);
  return w;
}

/** Kill every engine of every world made so far (after each test), and forget them. */
async function killAll() {
  for (const w of worlds.splice(0)) {
    for (const p of w.procs) p.kill();
    w.relay.subs = [];
  }
  await flush(3);
}

// ─── driving an engine ─────────────────────────────────────────────────────────────────────────────────────────
const HUNG = Symbol('hung');
async function guarded(fn, what) {
  let timer;
  const hung = new Promise((r) => { timer = setTimeout(() => r(HUNG), TICK_GUARD_MS); });
  try {
    const out = await Promise.race([Promise.resolve().then(fn).then((value) => ({ value }), (error) => ({ error })), hung]);
    if (out === HUNG) {
      throw new Error(`${what} did not settle within ${TICK_GUARD_MS / 1000} s of real time: the engine must not wait on deps.sleep or a real timer inside ${what} (ADR 0003 T20, T29: tests drive time through tick(); run() owns every sleep)`);
    }
    if (out.error) {
      throw new Error(`${what} rejected: ${firstLine(out.error)} — T20: ${what} resolves; the engine waits out a dependency failure, it never throws it`);
    }
    return out.value;
  } finally {
    clearTimeout(timer);
  }
}

/** Run one engine call guarded, with deps.sleep refused while it is in flight (T29). */
async function inCall(proc, fn, what) {
  proc.inCall = what;
  try { return await guarded(fn, what); } finally { proc.inCall = null; }
}

/** await engine.start() (guarded), then let the callbacks it scheduled run. */
async function startEngine(proc) {
  await inCall(proc, () => proc.engine.start(), 'start()');
  await flush();
}

/** One tick() (guarded). */
async function tickOnce(proc) {
  if (proc.exited) return { exit: proc.exited.code };
  return inCall(proc, () => proc.engine.tick(), 'tick()');
}

/**
 * drive(proc, ms, step = 50 | { step, until, each }): advance the fake clock by `step`, tick(), let callbacks run;
 * repeat until `ms` of simulated time have passed, until() holds (checked before each step), or tick() answers an
 * exit. → { done, exit, at, elapsed } (elapsed: simulated ms since the call).
 */
async function drive(proc, ms, opts = 50) {
  const o = typeof opts === 'number' ? { step: opts } : (opts || {});
  const step = o.step || 50;
  const w = proc.world;
  const t0 = w.clock.t;
  const end = t0 + ms;
  for (;;) {
    if (o.until && o.until()) return { done: true, exit: undefined, at: w.clock.t, elapsed: w.clock.t - t0 };
    if (w.clock.t >= end) return { done: false, exit: undefined, at: w.clock.t, elapsed: w.clock.t - t0 };
    w.clock.advance(Math.min(step, end - w.clock.t));
    const out = await tickOnce(proc);
    await flush();
    if (o.each) o.each();
    if (out && typeof out === 'object' && out.exit !== undefined && out.exit !== null) {
      if (!proc.exited) proc.exited = { code: out.exit, at: w.clock.t, seq: w.nextSeq() };
      return { done: !!(o.until && o.until()), exit: out.exit, at: w.clock.t, elapsed: w.clock.t - t0 };
    }
  }
}

module.exports = {
  // constants
  T0, NOW_S, DAY_S, PASSWORD, NEO4J_URI, RELAY_URL, RANDOM_ID, RUN_ID_RE, STDERR_TAIL, ARGV_FILTER_BYTES, TICK_GUARD_MS,
  DEFAULT_ENV, SIG, ROUND_KEPT_BYTES, ROUND_SCAN_MAX_BYTES,
  // the world and its parts
  makeWorld, makeClock, makeRelay, makeGraph, makeStore, stateFor, killAll, strays,
  // driving
  flush, startEngine, tickOnce, drive, guarded,
  // helpers
  matchFilter, filterKind, scanTouches, filterTargets, argvText, isTaggingAddress, propAddress, propOf, fingerprint,
  rowFromEdge, neoError, scanError, serviceUnavailable, iso, jcopy,
};
