/**
 * Story 1 (epic: node-primitives) — Create a set with no event behind it
 * (strfry-free create-set, served as POST /api/normalize/add-subset).
 *
 * Story: engineering-team/stories/node-primitives/1-event-less-create-set.md
 * ADR:   engineering-team/decisions/node-primitives/0001-event-less-add-subset-primitive.md
 *
 * Three test classes (the ADR's "For the Tester" notes, on the established split):
 *
 *   U-class (stack-free, always gates CI) — stubs for src/lib/neo4j-driver and
 *     src/api/normalize/firmware.js sit in require.cache only while
 *     src/api/normalize/nodes.js loads; the real entries are then put back, so
 *     no other suite in the runner inherits them. U covers exactly what the
 *     ADR pins before the graph is consulted: the owner gate, body validation,
 *     the firmware preconditions, the pure buildSubsetTags helper, and the
 *     probe handler. It does NOT script rows for the graph-dependent outcomes
 *     (404, parent labels, duplicates, 409, created): the ADR fixes the order
 *     of the checks but not the shape of each lookup, so scripted rows would
 *     pin implementation details (roles/tester.md). Those outcomes are H-class,
 *     against real Neo4j.
 *
 *   S-class (source assertions, stack-free) — the structural event-less
 *     guarantee: nodes.js requires exactly {crypto, lib/neo4j-driver,
 *     ./firmware, middleware/auth, lib/dtag} and names no signing or strfry
 *     function; the probe module has zero requires; both routes are registered
 *     in registerNormalizeRoutes and every advertised operation is a
 *     registered POST; the module header carries the event-less contract.
 *
 *   H-class (live, per-test SKIP) — EVERY request rides container loopback on
 *     $TAPESTRY_CONTAINER (default `tapestry`), the TA-pubkey lookup and the
 *     strfry count included, so the suite can target an ephemeral scratch
 *     container that publishes no ports. (The host's :7778 is the SHARED stack;
 *     a host-side call would silently test the wrong instance.) The class SKIPs
 *     — never fails — unless that container serves
 *     GET /api/normalize/node-primitives: the shared stack is in use by another
 *     session running other code (book event-less-sets, known constraints).
 *     Fixtures are throwaway nodes with test-prefixed uuids, removed in run()'s
 *     finally. The firmware-reinstall test (criterion 5) runs only with
 *     NODE_PRIMITIVES_REINSTALL=1 against an explicitly named container other
 *     than `tapestry`.
 *
 * Pre-implementation: every U and S test FAILS as "the feature is missing"
 * (nodes.js and nodePrimitivesProbe.js do not exist; no route is registered),
 * and every H test SKIPs because no container serves the probe. That is the
 * point.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const Module = require('module');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const NODES_MODULE = path.join(ROOT, 'src/api/normalize/nodes.js');
const PROBE_MODULE = path.join(ROOT, 'src/api/normalize/nodePrimitivesProbe.js');
const NORMALIZE_INDEX = path.join(ROOT, 'src/api/normalize/index.js');
const DRIVER_PATH = path.join(ROOT, 'src/lib/neo4j-driver.js');
const FIRMWARE_PATH = path.join(ROOT, 'src/api/normalize/firmware.js');
const AUTH_PATH = path.join(ROOT, 'src/middleware/auth.js');
const DTAG_PATH = path.join(ROOT, 'src/lib/dtag.js');
const CONCEPT_DAG = path.join(ROOT, 'ui/src/pages/concepts/ConceptDag.jsx');
const SET_DETAIL = path.join(ROOT, 'ui/src/pages/concepts/SetDetail.jsx');
const COUNTS = path.join(ROOT, 'ui/src/utils/conceptCounts.js');
const EXPORT_SET = path.join(ROOT, 'src/api/concept/exportSet.js');

const HOST_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const CONTAINER_EXPLICIT = Boolean(process.env.TAPESTRY_CONTAINER);
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;
const REINSTALL_OPT_IN = process.env.NODE_PRIMITIVES_REINSTALL === '1';

const ROUTE = '/api/normalize/add-subset';
const PROBE_ROUTE = '/api/normalize/node-primitives';
const ADD_REL_ROUTE = '/api/normalize/add-relationship';

// The probe's exact static evidence body (ADR decision 1). Duplicated here on
// purpose, so the suite pins the ratified contract rather than whatever the
// module happens to export.
const EXPECTED_PROBE = { success: true, surface: 'node-primitives', operations: ['add-subset'] };

// nodes.js's whole import surface (ADR Implementation notes), sorted.
const EXPECTED_REQUIRES = ['../../lib/dtag', '../../lib/neo4j-driver', '../../middleware/auth', './firmware', 'crypto'];
const FORBIDDEN = ['child_process', 'nostr-tools', 'assistantKeys', 'publishToStrfry', 'signAndFinalize', 'strfry'];

const NODES_MISSING =
  'src/api/normalize/nodes.js does not exist yet — the event-less add-subset primitive ' +
  '(ADR node-primitives/0001 Option A) is not implemented.';
const PROBE_MISSING =
  'src/api/normalize/nodePrimitivesProbe.js does not exist yet — the node-primitives deployment ' +
  'probe (ADR node-primitives/0001 decision 1) is not implemented.';

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return null; }
}

function short(x, n = 200) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}

// Key-order-insensitive deep equality (the probe body).
function stable(x) {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
  if (x && typeof x === 'object') {
    return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${stable(x[k])}`).join(',')}}`;
  }
  return JSON.stringify(x);
}
function sameBody(a, b) { return stable(a) === stable(b); }

// The would-be tags of a set at `uuid`, in handleCreateSet's order
// (d, name, z, s, then description when given), each with the tag-node uuid
// importEventDirect derives: sha256("<node uuid>:<tag.join(',')>:<index>")
// (src/api/normalize/index.js:165). A letter minted later for the same
// address therefore reproduces exactly these tag nodes (ADR decision 8).
function expectedTags(uuid, name, parentUuid, setConceptUuid, description) {
  const pairs = [
    ['d', uuid.split(':').slice(2).join(':')],
    ['name', name],
    ['z', setConceptUuid],
    ['s', parentUuid],
  ];
  if (description !== undefined) pairs.push(['description', description]);
  return pairs.map(([type, value], i) => ({
    type,
    value,
    uuid: crypto.createHash('sha256').update(`${uuid}:${[type, value].join(',')}:${i}`).digest('hex'),
  }));
}

/* ── U-class plumbing ──────────────────────────────────────────────────── */

// Every read and write answers no rows: U-class never scripts graph state
// (see the file header). The call log lets tests prove "no Cypher ran" and
// "no write statement ran".
const driverCalls = [];
async function noRows(cypher, params) {
  driverCalls.push({ cypher: String(cypher), params: params || {} });
  return [];
}
const driverStub = {
  runCypher: noRows,
  writeCypher: noRows,
  getDriver() { throw new Error('U-class tests must never open a real Neo4j driver'); },
  closeDriver: async () => {},
  toJS: (v) => v,
};

// A syntactically valid pubkey that is no deployment's TA — built at runtime
// so no 64-hex literal lives in this file (CLAUDE.md: never hardcode the TA).
const FAKE_TA = 'ab'.repeat(32);
const firmwareState = { ta: FAKE_TA, setConcept: true };
const REL_ALIASES = {
  CLASS_THREAD_INITIATION: 'IS_THE_CONCEPT_FOR',
  CLASS_THREAD_PROPAGATION: 'IS_A_SUPERSET_OF',
  CLASS_THREAD_TERMINATION: 'HAS_ELEMENT',
  IS_THE_CONCEPT_FOR: 'IS_THE_CONCEPT_FOR',
  IS_A_SUPERSET_OF: 'IS_A_SUPERSET_OF',
  HAS_ELEMENT: 'HAS_ELEMENT',
};
const firmwareStub = {
  getTAPubkey: () => firmwareState.ta,
  conceptUuid: (slug) => (slug === 'set' && firmwareState.setConcept && firmwareState.ta
    ? `39998:${firmwareState.ta}:set` : null),
  conceptSlugFromUuid: (u) => (typeof u === 'string' && /:set$/.test(u) ? 'set' : null),
  relAlias: (x) => {
    if (REL_ALIASES[x]) return REL_ALIASES[x];
    throw new Error(`unknown relationship type ${x}`);
  },
  getManifest: () => ({ concepts: [{ slug: 'set' }] }),
  clearCache: () => {},
};

// Put `exportsObj` in require.cache for `p`; returns a function restoring
// whatever was cached before (or nothing).
function stubModule(p, exportsObj) {
  const resolved = require.resolve(p);
  const saved = require.cache[resolved];
  const m = new Module(resolved, null);
  m.filename = resolved;
  m.loaded = true;
  m.exports = exportsObj;
  require.cache[resolved] = m;
  return () => {
    if (saved) require.cache[resolved] = saved;
    else delete require.cache[resolved];
  };
}

/**
 * Load a FRESH nodes.js with the firmware stub answering `state`, then put
 * the real driver/firmware cache entries back. Fresh per test, so the suite
 * holds whether the module resolves the TA pubkey at load or per request.
 * The real auth and dtag modules are loaded first, so they never capture a
 * stub. Throws a feature-missing error (not an opaque MODULE_NOT_FOUND) while
 * the module has not been implemented.
 */
function loadNodes(state = {}) {
  if (!fs.existsSync(NODES_MODULE)) throw new Error(NODES_MISSING);
  Object.assign(firmwareState, { ta: FAKE_TA, setConcept: true }, state);
  require(AUTH_PATH);
  require(DTAG_PATH);
  const restoreDriver = stubModule(DRIVER_PATH, driverStub);
  const restoreFirmware = stubModule(FIRMWARE_PATH, firmwareStub);
  const resolved = require.resolve(NODES_MODULE);
  try {
    delete require.cache[resolved];
    const mod = require(NODES_MODULE);
    assert(typeof mod.handleAddSubset === 'function',
      'nodes.js must export handleAddSubset (ADR Implementation notes).');
    assert(typeof mod.buildSubsetTags === 'function',
      'nodes.js must export the pure buildSubsetTags helper (ADR Implementation notes).');
    return mod;
  } finally {
    delete require.cache[resolved];
    restoreFirmware();
    restoreDriver();
  }
}

// child_process call counting — wrap-and-delegate, active only around one
// handler invocation. The primitive must never shell out (no strfry import).
const CP_FNS = ['exec', 'execFile', 'spawn', 'fork', 'execSync', 'execFileSync', 'spawnSync'];
async function countCpCalls(fn) {
  let count = 0;
  const originals = {};
  for (const k of CP_FNS) {
    originals[k] = cp[k];
    cp[k] = function (...args) { count++; return originals[k].apply(cp, args); };
  }
  try { await fn(); }
  finally { for (const k of CP_FNS) cp[k] = originals[k]; }
  return count;
}

function mkRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(o) { if (this.statusCode === null) this.statusCode = 200; this.body = o; return this; },
  };
}

const VALID_BODY = { parentUuid: 'u-parent', name: 'A subset', description: 'why it exists' };
const WRITE_RE = /\b(MERGE|CREATE|DELETE|SET)\b/;

async function invoke(mod, reqOverrides = {}) {
  const before = driverCalls.length;
  const res = mkRes();
  const req = { session: {}, localTrusted: false, body: {}, ...reqOverrides };
  const cpCalls = await countCpCalls(() => mod.handleAddSubset(req, res));
  const calls = driverCalls.slice(before);
  return {
    res,
    cypherCalls: calls.length,
    writeCalls: calls.filter((c) => WRITE_RE.test(c.cypher)).length,
    cpCalls,
  };
}

function requireProbe() {
  if (!fs.existsSync(PROBE_MODULE)) throw new Error(PROBE_MISSING);
  delete require.cache[require.resolve(PROBE_MODULE)];
  const mod = require(PROBE_MODULE);
  assert(typeof mod.handleNodePrimitivesProbe === 'function',
    'nodePrimitivesProbe.js must export handleNodePrimitivesProbe (ADR Implementation notes).');
  return mod;
}

/* ── H-class plumbing (container loopback only) ────────────────────────── */

function dockerCurl(args, timeoutMs) {
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], {
    encoding: 'utf8',
    timeout: timeoutMs,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// One request over container loopback — the local-operator path
// (req.localTrusted). Answers { status, json, raw }.
function loopbackRequest(method, pathname, body, { maxSeconds = 60 } = {}) {
  const args = ['-s', '-m', String(maxSeconds), '-X', method, `${CONTAINER_BASE}${pathname}`,
    '-w', '\n__STATUS__%{http_code}'];
  if (body !== undefined) args.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(body));
  const out = dockerCurl(args, (maxSeconds + 30) * 1000);
  const idx = out.lastIndexOf('\n__STATUS__');
  const status = idx === -1 ? 0 : parseInt(out.slice(idx + 11), 10);
  const raw = idx === -1 ? out : out.slice(0, idx);
  let json = null;
  try { json = JSON.parse(raw); } catch {}
  return { status, json, raw };
}

// Fixture and read-back Cypher through POST /api/neo4j/query on the same
// loopback (localTrusted passes its write gate).
function loopbackCypher(cypher, params = {}) {
  const { status, json, raw } = loopbackRequest('POST', '/api/neo4j/query', { cypher, params });
  if (status !== 200 || !json || json.success !== true) {
    throw new Error(`Cypher via loopback /api/neo4j/query failed: status=${status} body=${short(json || raw)}`);
  }
  return json.data || [];
}

// This deployment's TA pubkey, resolved at runtime over loopback — it differs
// on every deployment (CLAUDE.md), and on a scratch container it is that
// container's own.
let taPubkey = null;
function resolveTaPubkey() {
  if (taPubkey) return taPubkey;
  const { json } = loopbackRequest('GET', '/api/assistant/pubkey');
  if (!json || !/^[0-9a-f]{64}$/.test(json.pubkey || '')) {
    throw new Error(
      `GET /api/assistant/pubkey on '${CONTAINER}' did not answer a TA pubkey (got ${short(json)}). The ` +
      'no-event bracket counts only TA-authored events and must not fall back to a whole-corpus count, ' +
      'which live strfry-router ingest races (ADR test-suite-hermeticity/0001).');
  }
  taPubkey = json.pubkey;
  return taPubkey;
}

// Counts ONLY events this instance could author — the one axis router ingest
// cannot move (ADR test-suite-hermeticity/0001).
function strfryTaCount(ta) {
  const filter = encodeURIComponent(JSON.stringify({ authors: [ta] }));
  const { json } = loopbackRequest('GET', `/api/strfry/scan/count?filter=${filter}`);
  if (!json || json.success !== true || typeof json.count !== 'number') {
    throw new Error(`GET /api/strfry/scan/count did not answer a count (got ${short(json)})`);
  }
  return json.count;
}

// The live class runs only against a container that is reachable over
// loopback AND serves this feature's probe. Anything else SKIPs, with one
// note saying why and how to run it.
let ready = null;
let noted = false;
function liveReady() {
  if (ready) return ready;
  try {
    const cls = loopbackRequest('GET', '/api/auth/user-classification', undefined, { maxSeconds: 5 });
    if (cls.status !== 200) {
      ready = { ok: false, reason: `container '${CONTAINER}' did not answer over loopback (status ${cls.status})` };
      return ready;
    }
    const probe = loopbackRequest('GET', PROBE_ROUTE, undefined, { maxSeconds: 5 });
    if (probe.status !== 200 || !probe.json || probe.json.surface !== 'node-primitives') {
      ready = {
        ok: false,
        reason: `container '${CONTAINER}' does not serve GET ${PROBE_ROUTE} (status ${probe.status}) — ` +
          'it runs code without this feature',
      };
      return ready;
    }
    ready = { ok: true, reason: '' };
  } catch (e) {
    ready = { ok: false, reason: `container '${CONTAINER}' is unreachable via docker exec (${String(e.message).split('\n')[0]})` };
  }
  return ready;
}
function skipUnlessLive() {
  const r = liveReady();
  if (!r.ok && !noted) {
    noted = true;
    console.log(`  NOTE  live matrix skipped: ${r.reason}. To run it against a throwaway instance: ` +
      'TAPESTRY_CONTAINER=$(bash scripts/scratch-stack.sh up)');
  }
  return r.ok;
}

function addressFor(ta, name, parentUuid) {
  const { childDTag } = require(DTAG_PATH);
  return `39999:${ta}:${childDTag(name, parentUuid)}`;
}

function setSupersetFor(ta) {
  const rows = loopbackCypher(
    'MATCH (:NostrEvent {uuid: $h})-[:IS_THE_CONCEPT_FOR]->(s:Superset) RETURN s.uuid AS uuid',
    { h: `39998:${ta}:set` });
  assert(rows[0] && rows[0].uuid,
    `the \`set\` concept's superset is missing on '${CONTAINER}' — run firmware install there first.`);
  return rows[0].uuid;
}

function nodeState(uuid) {
  const rows = loopbackCypher(
    'MATCH (n:NostrEvent {uuid: $u}) RETURN n.id AS id, labels(n) AS labels, n.name AS name, n.pubkey AS pubkey',
    { u: uuid });
  if (rows.length === 0) return { exists: false, count: 0 };
  const r = rows[0];
  return {
    exists: true,
    count: rows.length,
    id: r.id,
    hasId: r.id !== null && r.id !== undefined,
    labels: r.labels || [],
    name: r.name,
    pubkey: r.pubkey,
  };
}

function tagsOf(uuid) {
  return loopbackCypher(
    'MATCH (:NostrEvent {uuid: $u})-[:HAS_TAG]->(t:NostrEventTag) RETURN t.uuid AS uuid, t.type AS type, t.value AS value',
    { u: uuid });
}

// Count edges of one FIXED alias (never caller input) between two uuids.
function edgeCount(alias, fromUuid, toUuid) {
  assert(['HAS_ELEMENT', 'IS_A_SUPERSET_OF'].includes(alias), `test bug: alias ${alias} not in the fixed set`);
  const rows = loopbackCypher(
    `MATCH (:NostrEvent {uuid: $a})-[r:${alias}]->(:NostrEvent {uuid: $b}) RETURN count(r) AS c`,
    { a: fromUuid, b: toUuid });
  return rows[0] ? Number(rows[0].c) : 0;
}

// The Cypher template literal around `marker` in a source file, so read-path
// tests run the query the page or route actually runs, not a copy.
function templateAround(file, marker) {
  const src = readSafe(file);
  assert(src !== null, `${path.relative(ROOT, file)} is missing — re-baseline this test.`);
  const i = src.indexOf(marker);
  assert(i !== -1, `${path.relative(ROOT, file)} no longer contains "${marker}" — re-baseline this test.`);
  const start = src.lastIndexOf('`', i);
  const end = src.indexOf('`', i);
  assert(start !== -1 && end !== -1, `could not isolate the query around "${marker}" in ${path.relative(ROOT, file)}.`);
  return src.slice(start + 1, end);
}

// Throwaway fixture graph (test-prefixed uuids): a concept header H with its
// superset S; members m1, m2 (direct elements of S) and m3 (not yet placed);
// a LETTERED set fixture under S (it carries an event id, as a set made by
// create-set does); and a node already holding the address a subset named
// heldName would get under S, deliberately NOT linked to S. Every lettered
// fixture node carries pubkey = TA and an id, so the publish traversal has
// something to return besides the event-less set.
let fx = null;
const createdSetUuids = new Set();
function ensureFixtures() {
  if (fx) return fx;
  const ta = resolveTaPubkey();
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const p = `test-nodeprim-${stamp}`;
  const f = {
    ta,
    stamp,
    header: `${p}-header`,
    sup: `${p}-sup`,
    m1: `${p}-m1`,
    m2: `${p}-m2`,
    m3: `${p}-m3`,
    lettered: `${p}-lettered`,
    letteredName: `Nodeprim Lettered ${stamp}`,
    missing: `${p}-missing`,
    alphaName: `Nodeprim Alpha ${stamp}`,
    heldName: `Nodeprim Held ${stamp}`,
  };
  f.alpha = addressFor(ta, f.alphaName, f.sup);
  f.held = addressFor(ta, f.heldName, f.sup);
  loopbackCypher(`
    CREATE (h:NostrEvent:ListHeader {uuid: $header, name: 'nodeprim fixture concept', pubkey: $ta, id: $hid, kind: 39998})
    CREATE (s:NostrEvent:ListItem:Superset {uuid: $sup, name: 'nodeprim fixture superset', pubkey: $ta, id: $sid, kind: 39999})
    CREATE (h)-[:IS_THE_CONCEPT_FOR]->(s)
    CREATE (m1:NostrEvent:ListItem {uuid: $m1, name: 'nodeprim member 1', pubkey: $ta, id: $m1id, kind: 39999})
    CREATE (m2:NostrEvent:ListItem {uuid: $m2, name: 'nodeprim member 2', pubkey: $ta, id: $m2id, kind: 39999})
    CREATE (:NostrEvent:ListItem {uuid: $m3, name: 'nodeprim member 3', pubkey: $ta, id: $m3id, kind: 39999})
    CREATE (s)-[:HAS_ELEMENT]->(m1)
    CREATE (s)-[:HAS_ELEMENT]->(m2)
    CREATE (l:NostrEvent:ListItem:Set {uuid: $lettered, name: $lname, pubkey: $ta, id: $lid, kind: 39999})
    CREATE (s)-[:IS_A_SUPERSET_OF]->(l)
    CREATE (:NostrEvent:ListItem {uuid: $held, name: $heldName, pubkey: $ta, id: $heldId, kind: 39999})
  `, {
    ta,
    header: f.header, hid: `${p}-id-h`,
    sup: f.sup, sid: `${p}-id-s`,
    m1: f.m1, m1id: `${p}-id-m1`,
    m2: f.m2, m2id: `${p}-id-m2`,
    m3: f.m3, m3id: `${p}-id-m3`,
    lettered: f.lettered, lname: f.letteredName, lid: `${p}-id-l`,
    held: f.held, heldName: f.heldName, heldId: `${p}-id-held`,
  });
  fx = f;
  return fx;
}

function teardownFixtures() {
  const uuids = [...createdSetUuids];
  if (fx) uuids.push(fx.header, fx.sup, fx.m1, fx.m2, fx.m3, fx.lettered, fx.held);
  if (uuids.length === 0) return;
  try {
    loopbackCypher(
      'MATCH (n:NostrEvent) WHERE n.uuid IN $uuids OPTIONAL MATCH (n)-[:HAS_TAG]->(t:NostrEventTag) DETACH DELETE t, n',
      { uuids });
    const left = loopbackCypher('MATCH (n:NostrEvent) WHERE n.uuid IN $uuids RETURN count(n) AS c', { uuids });
    if (left[0] && Number(left[0].c) !== 0) {
      console.log(`  WARN  fixture cleanup left ${left[0].c} node(s) on '${CONTAINER}'; remove with: ` +
        `MATCH (n:NostrEvent) WHERE n.uuid IN ${JSON.stringify(uuids)} DETACH DELETE n`);
    }
  } catch (e) {
    console.log(`  WARN  fixture cleanup failed on '${CONTAINER}' (${e.message}); uuids: ${uuids.join(', ')}`);
  }
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ══════════════ U-class — the handler on stubbed dependencies ══════════════ */

t('U1 (AC-3): an authenticated NON-owner session gets 403 before any Cypher runs, with zero child_process calls', async () => {
  const mod = loadNodes();
  const { res, cypherCalls, cpCalls } = await invoke(mod, {
    session: { authenticated: true, pubkey: 'f'.repeat(64) }, localTrusted: false, body: { ...VALID_BODY },
  });
  assert(res.statusCode === 403,
    `an authenticated non-owner must get 403 from the in-handler gate (isOwner || localTrusted — ADR decision 3); got ${res.statusCode}.`);
  assert(res.body && res.body.success === false, `the 403 body must carry success:false (got ${short(res.body)}).`);
  assert(cypherCalls === 0, `the gate must fire BEFORE any Cypher (ADR decision 3); ${cypherCalls} driver call(s) ran.`);
  assert(cpCalls === 0, `the primitive must never shell out; ${cpCalls} child_process call(s) ran.`);
});

t('U2 (AC-3): an unauthenticated-shaped caller (empty session, not localTrusted) gets 403 before any Cypher runs', async () => {
  const mod = loadNodes();
  const { res, cypherCalls, cpCalls } = await invoke(mod, { session: {}, localTrusted: false, body: { ...VALID_BODY } });
  assert(res.statusCode === 403, `expected 403 from the gate (got ${res.statusCode}).`);
  assert(cypherCalls === 0, `the gate must fire BEFORE any Cypher; ${cypherCalls} driver call(s) ran.`);
  assert(cpCalls === 0, `zero child_process calls expected; got ${cpCalls}.`);
});

t('U3 (AC-3): a trusted local operator (req.localTrusted) passes the gate and reaches the graph checks', async () => {
  const mod = loadNodes();
  const { res, cypherCalls, cpCalls } = await invoke(mod, { session: {}, localTrusted: true, body: { ...VALID_BODY } });
  assert(res.statusCode !== 403 && res.statusCode !== 401,
    `a localTrusted caller must pass the gate — the container-loopback operator path (ADR decision 3); got ${res.statusCode}.`);
  assert(cypherCalls >= 1,
    `past the gate and field checks the primitive must consult the graph; no Cypher ran (answer ${res.statusCode}, ${short(res.body)}).`);
  assert(cpCalls === 0, `zero child_process calls expected; got ${cpCalls}.`);
});

t('U4 (AC-3): a missing or malformed body field is rejected 400 naming the field, with no Cypher run', async () => {
  const mod = loadNodes();
  const cases = [
    [{}, /parentUuid|name/],
    [{ name: 'x' }, /parentUuid/],
    [{ parentUuid: 7, name: 'x' }, /parentUuid/],
    [{ parentUuid: 'p' }, /name/],
    [{ parentUuid: 'p', name: '   ' }, /name/],
    [{ parentUuid: 'p', name: 42 }, /name/],
    [{ parentUuid: 'p', name: 'x', description: 42 }, /description/],
  ];
  for (const [body, namePattern] of cases) {
    const { res, cypherCalls } = await invoke(mod, { session: {}, localTrusted: true, body });
    assert(res.statusCode === 400,
      `body ${short(body)} must be rejected 400 — a blank name creates nothing (story criterion 3); got ${res.statusCode}.`);
    assert(res.body && res.body.success === false && typeof res.body.error === 'string' && namePattern.test(res.body.error),
      `the 400 error must NAME the bad field (${namePattern}); got ${short(res.body)}.`);
    assert(cypherCalls === 0, `nothing may be consulted or written on a bad body; ${cypherCalls} Cypher call(s) ran.`);
  }
});

t('U5 (AC-1): with no TA pubkey available the answer is 500 naming it, and nothing is written', async () => {
  const mod = loadNodes({ ta: null });
  const { res, writeCalls, cpCalls } = await invoke(mod, { session: {}, localTrusted: true, body: { ...VALID_BODY } });
  assert(res.statusCode === 500,
    `without a TA pubkey the set has no address and no author — expected 500 naming the missing piece (ADR decision 3); got ${res.statusCode}.`);
  assert(res.body && res.body.success === false && /pubkey|assistant|\bTA\b/i.test(res.body.error || ''),
    `the 500 must name the missing TA pubkey; got ${short(res.body)}.`);
  assert(writeCalls === 0, `nothing may be written without a TA pubkey; ${writeCalls} write statement(s) ran.`);
  assert(cpCalls === 0, `zero child_process calls expected; got ${cpCalls}.`);
});

t('U6 (AC-1): with the `set` concept unresolvable the answer is 500 naming it (run firmware install), and nothing is written', async () => {
  const mod = loadNodes({ setConcept: false });
  const { res, writeCalls } = await invoke(mod, { session: {}, localTrusted: true, body: { ...VALID_BODY } });
  assert(res.statusCode === 500,
    `without the \`set\` concept the new set cannot be registered as a set (story criterion 1) — expected 500; got ${res.statusCode}.`);
  assert(res.body && /\bset\b/i.test(res.body.error || '') && /firmware|install|concept/i.test(res.body.error || ''),
    `the 500 must name the \`set\` concept and point at firmware install (ADR decision 3); got ${short(res.body)}.`);
  assert(writeCalls === 0, `nothing may be written without the \`set\` concept; ${writeCalls} write statement(s) ran.`);
});

t('U7 (AC-1): when the `set` concept\'s superset is absent from Neo4j (every lookup answers no rows) the answer is 500 naming it, before the parent lookup, and nothing is written', async () => {
  const mod = loadNodes();
  const { res, writeCalls } = await invoke(mod, { session: {}, localTrusted: true, body: { ...VALID_BODY } });
  assert(res.statusCode === 500,
    'ADR decision 3 resolves the `set` concept\'s superset BEFORE the parent lookup (decision 4) — with no rows ' +
    `anywhere the answer must be that 500, not a 404 for the parent; got ${res.statusCode} ${short(res.body)}.`);
  assert(res.body && /\bset\b/i.test(res.body.error || ''),
    `the 500 must name the missing \`set\` concept superset; got ${short(res.body)}.`);
  assert(writeCalls === 0, `nothing may be written when a precondition fails; ${writeCalls} write statement(s) ran.`);
});

t('U8 (AC-1): buildSubsetTags yields the would-be tags d, name, z, s in create-set\'s order, each with importEventDirect\'s tag-node uuid', () => {
  const mod = loadNodes();
  const uuid = `39999:${FAKE_TA}:a-subset-1a2b3c4d`;
  const setConcept = `39998:${FAKE_TA}:set`;
  const got = mod.buildSubsetTags(uuid, 'A subset', 'u-parent', setConcept);
  const want = expectedTags(uuid, 'A subset', 'u-parent', setConcept);
  assert(Array.isArray(got) && got.length === 4,
    `without a description there are exactly four would-be tags (d, name, z, s — ADR decision 8); got ${short(got)}.`);
  want.forEach((w, i) => {
    const g = got[i] || {};
    assert(g.type === w.type && g.value === w.value,
      `tag ${i} must be ${w.type}=${short(w.value, 80)} (create-set's order: d, name, z, s); got ${short(g)}.`);
    assert(g.uuid === w.uuid,
      `tag ${i}'s uuid must be sha256("<uuid>:<type>,<value>:<index>") — importEventDirect's formula ` +
      `(index.js:165), so a later letter lands on identical tag nodes; expected ${w.uuid.slice(0, 16)}…, got ${short(g.uuid)}.`);
  });
});

t('U9 (AC-1): a description becomes the fifth would-be tag, after s', () => {
  const mod = loadNodes();
  const uuid = `39999:${FAKE_TA}:a-subset-1a2b3c4d`;
  const setConcept = `39998:${FAKE_TA}:set`;
  const got = mod.buildSubsetTags(uuid, 'A subset', 'u-parent', setConcept, 'why it exists');
  const want = expectedTags(uuid, 'A subset', 'u-parent', setConcept, 'why it exists');
  assert(Array.isArray(got) && got.length === 5, `with a description there are five would-be tags; got ${short(got)}.`);
  const g = got[4] || {};
  assert(g.type === 'description' && g.value === 'why it exists' && g.uuid === want[4].uuid,
    `the fifth tag must be description='why it exists' with importEventDirect's uuid for index 4; got ${short(g)}.`);
});

t('U10 (book frame "shipped"): the probe handler answers 200 with the exact static evidence body, byte-identical on repeat', async () => {
  const mod = requireProbe();
  const a = mkRes();
  const b = mkRes();
  await mod.handleNodePrimitivesProbe({}, a);
  await mod.handleNodePrimitivesProbe({}, b);
  assert(a.statusCode === 200 && sameBody(a.body, EXPECTED_PROBE),
    `the probe must answer 200 ${JSON.stringify(EXPECTED_PROBE)} to a bare request (ADR decision 1); got ${a.statusCode} ${short(a.body)}.`);
  assert(JSON.stringify(a.body) === JSON.stringify(b.body),
    'repeated probes must be byte-identical — a static literal, nothing computed (ADR relationship-primitives/0002 contract).');
});

/* ══════════════ S-class — structural event-less guarantee + registration ══════════════ */

t('S1 (AC-1): nodes.js requires exactly crypto, neo4j-driver, ./firmware, middleware/auth and lib/dtag — structurally unable to sign or touch strfry', () => {
  const src = readSafe(NODES_MODULE);
  assert(src !== null, NODES_MISSING);
  const specifiers = [];
  const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) specifiers.push(m[1].replace(/^node:/, ''));
  const got = [...new Set(specifiers)].sort();
  assert(JSON.stringify(got) === JSON.stringify(EXPECTED_REQUIRES),
    `nodes.js must require EXACTLY ${JSON.stringify(EXPECTED_REQUIRES)} — the import boundary IS the ` +
    `no-event guarantee (ADR Option A); got ${JSON.stringify(got)}.`);
  for (const bad of FORBIDDEN) {
    assert(!specifiers.some((s) => s.includes(bad)),
      `nodes.js must never require anything matching "${bad}" — no event is signed or stored (story criterion 1).`);
  }
  assert(!/publishToStrfry|signAndFinalize|finalizeEvent/.test(src),
    'nodes.js must not reference publishToStrfry, signAndFinalize or finalizeEvent at all.');
});

t('S2 (book frame "shipped"): nodePrimitivesProbe.js has ZERO requires or imports — the empty import surface is its zero-side-effect guarantee', () => {
  const src = readSafe(PROBE_MODULE);
  assert(src !== null, PROBE_MISSING);
  assert(!/require\s*\(/.test(src), 'nodePrimitivesProbe.js must contain no require calls (ADR decision 1).');
  assert(!/^\s*import\b/m.test(src) && !/\bimport\s*\(/.test(src),
    'nodePrimitivesProbe.js must not use import statements or dynamic import() either.');
});

t('S3 (AC-1, AC-3): POST /api/normalize/add-subset and GET /api/normalize/node-primitives are registered in registerNormalizeRoutes, and every advertised operation is a registered POST', () => {
  const src = readSafe(NORMALIZE_INDEX);
  assert(src !== null, 'src/api/normalize/index.js missing — re-baseline this sentinel.');
  const fnStart = src.indexOf('function registerNormalizeRoutes');
  const fnEnd = src.indexOf('module.exports = { registerNormalizeRoutes }');
  assert(fnStart !== -1 && fnEnd !== -1 && fnStart < fnEnd,
    'could not locate registerNormalizeRoutes in normalize/index.js — re-baseline this sentinel.');
  const block = src.slice(fnStart, fnEnd);
  assert(/require\(\s*['"]\.\/nodes['"]\s*\)/.test(block),
    'registerNormalizeRoutes must require ./nodes inline (ADR Implementation notes).');
  assert(/require\(\s*['"]\.\/nodePrimitivesProbe['"]\s*\)/.test(block),
    'registerNormalizeRoutes must require ./nodePrimitivesProbe inline (ADR Implementation notes).');
  assert(/app\.post\(\s*['"]\/api\/normalize\/add-subset['"]/.test(block),
    `POST ${ROUTE} is not registered — the primitive is not reachable (ADR decision 1).`);
  assert(/app\.get\(\s*['"]\/api\/normalize\/node-primitives['"]/.test(block),
    `GET ${PROBE_ROUTE} is not registered — staging and production would have no deployment evidence (ADR decision 1).`);
  for (const op of EXPECTED_PROBE.operations) {
    assert(new RegExp(`app\\.post\\(\\s*['"]/api/normalize/${op}['"]`).test(src),
      `the probe advertises "${op}" but POST /api/normalize/${op} is not registered — the evidence would lie.`);
  }
});

t('S4 (AC-1): the nodes.js header documents the event-less contract and its durability note', () => {
  const src = readSafe(NODES_MODULE);
  assert(src !== null, NODES_MISSING);
  const header = (src.match(/^\s*\/\*\*?[\s\S]*?\*\//) || [''])[0];
  assert(/event-less|eventless|no event/i.test(header),
    'the module header must state the event-less contract: no event is signed or stored (ADR Implementation notes).');
  assert(/backup/i.test(header) && /§30|BIBLE/.test(header),
    'the module header must carry the durability fact — only a Neo4j backup preserves an event-less set (BIBLE §30).');
});

/* ══════════════ H-class — live matrix over container loopback ══════════════ */
// Ordered: H1 creates the set that H2-H9 build on.

t('H0 (book frame "shipped"): the probe answers the exact static evidence body over loopback', async () => {
  if (!skipUnlessLive()) return 'SKIP';
  const r = loopbackRequest('GET', PROBE_ROUTE);
  assert(r.status === 200 && r.json && sameBody(r.json, EXPECTED_PROBE),
    `GET ${PROBE_ROUTE} must answer 200 ${JSON.stringify(EXPECTED_PROBE)}; got ${r.status} ${short(r.json || r.raw)}.`);
});

t('H1 (AC-1): add-subset creates the set under its parent — 200 created at the lettered address, registered under `set`, the durability note, no event id, would-be tags stored, and NO TA-authored event in strfry', async () => {
  if (!skipUnlessLive()) return 'SKIP';
  const f = ensureFixtures();
  const setSup = setSupersetFor(f.ta);
  const description = 'nodeprim fixture description';
  const before = strfryTaCount(f.ta);
  createdSetUuids.add(f.alpha);
  const r = loopbackRequest('POST', ROUTE, { parentUuid: f.sup, name: f.alphaName, description });
  const after = strfryTaCount(f.ta);
  assert(r.status === 200 && r.json && r.json.success === true,
    `POST ${ROUTE} must answer 200 {success:true}; got ${r.status} ${short(r.json || r.raw)}.`);
  const b = r.json;
  assert(b.operation === 'add' && b.result === 'created',
    `a fresh set must report {operation:'add', result:'created'} (ADR decision 9); got ${short(b)}.`);
  assert(b.set && b.set.uuid === f.alpha,
    `the set must sit at 39999:<TA>:<childDTag(name, parent)> — the address create-set would give it (ADR decision 5); ` +
    `expected ${f.alpha}, got ${short(b.set)}.`);
  assert(b.set.name === f.alphaName, `the answer must name the new set (story criterion 1); got ${short(b.set)}.`);
  assert(b.parent && b.parent.uuid === f.sup, `the answer must echo the parent; got ${short(b.parent)}.`);
  assert(b.registeredUnder === setSup,
    `the answer must name the \`set\` concept superset it registered under (${setSup}); got ${short(b.registeredUnder)}.`);
  assert(typeof b.note === 'string' && /neo4j/i.test(b.note) && /backup/i.test(b.note),
    `a 'created' answer must carry the durability note — only a Neo4j backup preserves it (ADR decision 9); got ${short(b.note)}.`);
  assert(before === after,
    `creating an event-less set must store NO event (story criterion 1): TA-authored strfry count went ${before} -> ${after}. ` +
    'The count is scoped to this instance\'s own TA, so it is not router traffic — either add-subset wrote an event, or ' +
    'another process published as this TA while the bracket was open. Check which before dismissing it.');
  const n = nodeState(f.alpha);
  assert(n.exists, `no node exists at ${f.alpha} after a 'created' answer.`);
  assert(!n.hasId, `an event-less set must carry no event id; found id ${short(n.id)}.`);
  for (const l of ['NostrEvent', 'ListItem', 'Set']) {
    assert(n.labels.includes(l), `the set must carry the ${l} label, as a lettered set does (ADR decision 7); got ${short(n.labels)}.`);
  }
  assert(n.name === f.alphaName && n.pubkey === f.ta,
    `the node's name and pubkey must be the set's name and this instance's TA; got name=${short(n.name)} pubkey=${short(n.pubkey, 16)}.`);
  assert(edgeCount('IS_A_SUPERSET_OF', f.sup, f.alpha) === 1, 'exactly one IS_A_SUPERSET_OF edge must link the parent to the set.');
  assert(edgeCount('HAS_ELEMENT', setSup, f.alpha) === 1,
    'the set must be an element of the `set` concept — exactly one HAS_ELEMENT from its superset (story criterion 1).');
  const want = expectedTags(f.alpha, f.alphaName, f.sup, `39998:${f.ta}:set`, description);
  const got = tagsOf(f.alpha);
  assert(got.length === want.length,
    `the set must hold exactly its ${want.length} would-be tags (ADR decision 8); found ${got.length}: ${short(got)}.`);
  for (const w of want) {
    assert(got.some((g) => g.uuid === w.uuid && g.type === w.type && g.value === w.value),
      `missing the would-be tag ${w.type}=${short(w.value, 60)} with importEventDirect's uuid ${w.uuid.slice(0, 12)}….`);
  }
});

t('H2 (AC-2): repeating the identical create is idempotent — already-existed, hasEvent:false, no note, and still one set, one parent edge, five tags', async () => {
  if (!skipUnlessLive()) return 'SKIP';
  const f = ensureFixtures();
  assert(nodeState(f.alpha).exists, 'H2 needs the set H1 created — H1 failed.');
  const r = loopbackRequest('POST', ROUTE, { parentUuid: f.sup, name: f.alphaName, description: 'nodeprim fixture description' });
  assert(r.status === 200 && r.json && r.json.success === true && r.json.result === 'already-existed',
    `the identical repeat must answer 200 result:'already-existed' (story criterion 2); got ${r.status} ${short(r.json || r.raw)}.`);
  assert(r.json.set && r.json.set.uuid === f.alpha && r.json.set.hasEvent === false,
    `the answer must name the existing event-less set with hasEvent:false (ADR decision 6a); got ${short(r.json.set)}.`);
  assert(r.json.note === undefined, `no durability note when nothing changed; got ${short(r.json.note)}.`);
  assert(nodeState(f.alpha).count === 1, 'still exactly one node at the address.');
  assert(edgeCount('IS_A_SUPERSET_OF', f.sup, f.alpha) === 1, 'still exactly one parent edge.');
  assert(tagsOf(f.alpha).length === 5, 'the repeat must not add tag nodes — still five.');
});

t('H3 (AC-2): the same name in another case and with padding is the same set — already-existed, no second set', async () => {
  if (!skipUnlessLive()) return 'SKIP';
  const f = ensureFixtures();
  const variant = `   ${f.alphaName.toUpperCase()}  `;
  const r = loopbackRequest('POST', ROUTE, { parentUuid: f.sup, name: variant });
  assert(r.status === 200 && r.json && r.json.result === 'already-existed' && r.json.set && r.json.set.uuid === f.alpha,
    `"${variant}" must match "${f.alphaName}" (trimmed, case-insensitive — ADR decision 6a); got ${r.status} ${short(r.json || r.raw)}.`);
  const rows = loopbackCypher(
    'MATCH (:NostrEvent {uuid: $sup})-[:IS_A_SUPERSET_OF]->(s:Set) WHERE toLower(trim(s.name)) = toLower($n) RETURN count(s) AS c',
    { sup: f.sup, n: f.alphaName });
  assert(rows[0] && Number(rows[0].c) === 1, `exactly one set of that name may sit under the parent; found ${short(rows)}.`);
});

t('H4 (AC-2): a LETTERED set of the same name under the same parent is reported as already existing — hasEvent:true, nothing created', async () => {
  if (!skipUnlessLive()) return 'SKIP';
  const f = ensureFixtures();
  const name = f.letteredName.toLowerCase();
  const would = addressFor(f.ta, name, f.sup);
  createdSetUuids.add(would);
  const r = loopbackRequest('POST', ROUTE, { parentUuid: f.sup, name });
  assert(r.status === 200 && r.json && r.json.result === 'already-existed',
    `a lettered set named "${f.letteredName}" already sits under the parent — expected already-existed (story criterion 2); ` +
    `got ${r.status} ${short(r.json || r.raw)}.`);
  assert(r.json.set && r.json.set.uuid === f.lettered && r.json.set.hasEvent === true,
    `the answer must name the lettered set itself (${f.lettered}) with hasEvent:true; got ${short(r.json.set)}.`);
  assert(!nodeState(would).exists, `no event-less twin may appear at ${would}.`);
});

t('H5 (ADR 6b): a name whose address is already held by a node not placed under the parent answers 409 naming it, and links nothing', async () => {
  if (!skipUnlessLive()) return 'SKIP';
  const f = ensureFixtures();
  const r = loopbackRequest('POST', ROUTE, { parentUuid: f.sup, name: f.heldName });
  assert(r.status === 409,
    `the address ${f.held} is taken by an unplaced node — expected a loud 409, never a silent re-link (ADR decision 6b); ` +
    `got ${r.status} ${short(r.json || r.raw)}.`);
  assert(r.json && r.json.success === false && String(r.json.error || '').includes(f.held),
    `the 409 must name the held address; got ${short(r.json)}.`);
  assert(edgeCount('IS_A_SUPERSET_OF', f.sup, f.held) === 0, 'the 409 path must not link the holder under the parent.');
  const held = nodeState(f.held);
  assert(held.exists && !held.labels.includes('Set') && tagsOf(f.held).length === 0,
    `the holder must be untouched (no Set label, no tags); got ${short(held)}.`);
});

t('H6 (AC-3): a missing parent answers 404 naming it, a blank name 400, and a parent that is neither Superset nor Set 400 — each creating nothing', async () => {
  if (!skipUnlessLive()) return 'SKIP';
  const f = ensureFixtures();
  const orphan = `Nodeprim Orphan ${f.stamp}`;
  const r404 = loopbackRequest('POST', ROUTE, { parentUuid: f.missing, name: orphan });
  assert(r404.status === 404 && r404.json && Array.isArray(r404.json.missing) && r404.json.missing.includes(f.missing),
    `a parent absent from Neo4j must answer 404 with missing:[${f.missing}] (story criterion 3); got ${r404.status} ${short(r404.json || r404.raw)}.`);
  assert(!nodeState(addressFor(f.ta, orphan, f.missing)).exists, 'the 404 path must create nothing.');

  const r400 = loopbackRequest('POST', ROUTE, { parentUuid: f.sup, name: '   ' });
  assert(r400.status === 400 && r400.json && /name/.test(String(r400.json.error || '')),
    `a blank name must answer 400 naming it (story criterion 3); got ${r400.status} ${short(r400.json || r400.raw)}.`);

  const underHeader = `Nodeprim Misplaced ${f.stamp}`;
  const rLbl = loopbackRequest('POST', ROUTE, { parentUuid: f.header, name: underHeader });
  assert(rLbl.status === 400 && rLbl.json && /Superset|Set/.test(String(rLbl.json.error || '')),
    `a parent that is neither a Superset nor a Set must answer 400 naming the rule (ADR decision 4); got ${rLbl.status} ${short(rLbl.json || rLbl.raw)}.`);
  assert(!nodeState(addressFor(f.ta, underHeader, f.header)).exists, 'the label-rejection path must create nothing.');
});

t('H7 (AC-3): an unauthenticated host-side POST is denied 401 (default-deny, before the handler)', async () => {
  // Runs only when the target is the default container: host :7778 maps to it
  // and to nothing else. PASSES pre-implementation too — it guards the ratified
  // auth layering (ADR security-auth-exposure/0002), not the feature.
  if (!skipUnlessLive()) return 'SKIP';
  if (CONTAINER !== 'tapestry') return 'SKIP';
  const r = await fetch(`${HOST_BASE}${ROUTE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentUuid: 'x', name: 'y' }),
    signal: AbortSignal.timeout(8000),
  });
  assert(r.status === 401, `an unauthenticated host-side POST ${ROUTE} must be denied 401 by default-deny; got ${r.status}.`);
});

t('H8 (AC-4): with members wired by add-relationship, Organization (Sets) lists the set with its direct and total counts, the canonical count includes a set-only member, and the publish traversal leaves the set out', async () => {
  if (!skipUnlessLive()) return 'SKIP';
  const f = ensureFixtures();
  assert(nodeState(f.alpha).exists, 'H8 needs the set H1 created — H1 failed.');
  for (const m of [f.m1, f.m2, f.m3]) {
    const r = loopbackRequest('POST', ADD_REL_ROUTE, { fromUuid: f.alpha, toUuid: m, relType: 'HAS_ELEMENT' });
    assert(r.status === 200 && r.json && r.json.success === true,
      `wiring ${m} into the set with add-relationship failed: ${r.status} ${short(r.json || r.raw)}.`);
  }

  // (i) The Organization (Sets) view's own query (ConceptDag.jsx).
  const dag = templateAround(CONCEPT_DAG, '-[:IS_THE_CONCEPT_FOR]->(sup:Superset)').split('${uuid}').join(f.header);
  assert(!/\$\{/.test(dag), 'ConceptDag.jsx\'s query gained another interpolation — re-baseline this test.');
  const rows = loopbackCypher(dag);
  const row = rows.find((x) => x.uuid === f.alpha);
  assert(row, `Organization (Sets) must list the event-less set (story criterion 4); rows: ${short(rows, 400)}.`);
  assert(row.name === f.alphaName && Number(row.depth) === 1,
    `the set must be listed by name, one level under the superset; got ${short(row)}.`);
  assert(Number(row.directCount) === 3 && Number(row.totalCount) === 3,
    `the set's direct and total counts must both be 3 (m1, m2, m3); got direct=${row.directCount} total=${row.totalCount}.`);
  const supRow = rows.find((x) => x.uuid === f.sup);
  assert(supRow && Number(supRow.totalCount) === 3,
    `the superset's total must include m3, which is reachable only through the set; got ${short(supRow)}.`);

  // (ii) The canonical count the concept page shows (conceptCounts.js).
  const counts = await import(pathToFileURL(COUNTS).href);
  const c = loopbackCypher(counts.conceptCountsCypher(), { conceptUuid: f.header });
  assert(c[0] && Number(c[0].elementCount) === 3,
    `the concept's element count must include members held only by the event-less set — expected 3; got ${short(c)}.`);

  // (iii) What "Publish concept to community" would send (exportSet.js's traversal).
  const ex = templateAround(EXPORT_SET, 'MATCH (h:ListHeader {uuid: $handle})');
  const exported = loopbackCypher(ex, { handle: f.header, taPubkey: f.ta }).map((x) => x.uuid);
  assert(exported.includes(f.header) && exported.includes(f.lettered),
    `sanity: the traversal must return the fixture's lettered nodes (header, lettered set); got ${short(exported, 400)}.`);
  assert(!exported.includes(f.alpha),
    `publishing the concept must send nothing for the event-less set (story criterion 4); the traversal returned ${f.alpha}.`);
});

t('H9 (edge — ADR Option A rationale): Set Detail\'s own lookup finds the event-less set, with the TA as its author', async () => {
  if (!skipUnlessLive()) return 'SKIP';
  const f = ensureFixtures();
  const q = templateAround(SET_DETAIL, 'RETURN s.uuid AS uuid, s.name AS name, s.pubkey AS author')
    .split('${decodedSetUuid}').join(f.alpha);
  assert(!/\$\{/.test(q), 'SetDetail.jsx\'s set query gained another interpolation — re-baseline this test.');
  const rows = loopbackCypher(q);
  assert(rows[0] && rows[0].uuid === f.alpha && rows[0].name === f.alphaName && rows[0].author === f.ta,
    `Set Detail matches (s:NostrEvent {uuid}) — an event-less set must keep that label to open there; got ${short(rows)}.`);
});

t('H10 (AC-5): after a firmware reinstall the set, its parent link, its membership in `set` and its member links are all still there (scratch container only, opt-in)', async () => {
  if (!REINSTALL_OPT_IN || !CONTAINER_EXPLICIT || CONTAINER === 'tapestry') {
    console.log('  NOTE  H10 runs only with NODE_PRIMITIVES_REINSTALL=1 and TAPESTRY_CONTAINER naming a scratch ' +
      'container (never `tapestry`): a firmware reinstall must not touch the shared stack.');
    return 'SKIP';
  }
  if (!skipUnlessLive()) return 'SKIP';
  const ta = resolveTaPubkey();
  const setSup = setSupersetFor(ta);
  // A MANIFEST concept's superset — the path install's pass 1e prunes on.
  const sup = loopbackCypher(
    'MATCH (:NostrEvent {uuid: $h})-[:IS_THE_CONCEPT_FOR]->(s:Superset) RETURN s.uuid AS uuid',
    { h: `39998:${ta}:nostr-kind` });
  assert(sup[0] && sup[0].uuid, `the nostr-kind concept's superset is missing on '${CONTAINER}' — was firmware installed?`);
  const supUuid = sup[0].uuid;
  // Two throwaway members, placed as direct elements of the manifest superset
  // so the reinstall's prune pass has something to act on. A fresh instance
  // has no nostr-kind elements of its own (they arrive by relay ingestion), so
  // the test brings its own. Teardown removes every uuid in createdSetUuids.
  const stamp = Date.now().toString(36);
  const members = [`test-nodeprim-reinstall-${stamp}-m1`, `test-nodeprim-reinstall-${stamp}-m2`];
  members.forEach((m) => createdSetUuids.add(m));
  loopbackCypher(
    `MATCH (s:NostrEvent {uuid: $sup})
     UNWIND $members AS m
     CREATE (e:NostrEvent:ListItem {uuid: m, name: m, pubkey: $ta, kind: 39999})
     CREATE (s)-[:HAS_ELEMENT]->(e)`,
    { sup: supUuid, members, ta });
  const name = `Nodeprim Reinstall ${Date.now().toString(36)}`;
  const addr = addressFor(ta, name, supUuid);
  createdSetUuids.add(addr);
  const r = loopbackRequest('POST', ROUTE, { parentUuid: supUuid, name });
  assert(r.status === 200 && r.json && r.json.result === 'created',
    `creating the set under nostr-kind failed: ${r.status} ${short(r.json || r.raw)}.`);
  for (const m of members) {
    const w = loopbackRequest('POST', ADD_REL_ROUTE, { fromUuid: addr, toUuid: m, relType: 'HAS_ELEMENT' });
    assert(w.status === 200 && w.json && w.json.success === true, `wiring ${m} failed: ${w.status} ${short(w.json || w.raw)}.`);
  }
  const install = loopbackRequest('POST', '/api/firmware/install', {}, { maxSeconds: 900 });
  assert(install.status === 200 && install.json && install.json.success !== false,
    `firmware install on '${CONTAINER}' did not complete: ${install.status} ${short(install.json || install.raw)}.`);
  const n = nodeState(addr);
  assert(n.exists && !n.hasId, `the event-less set must survive the reinstall, still with no event id; got ${short(n)}.`);
  assert(edgeCount('IS_A_SUPERSET_OF', supUuid, addr) === 1, 'the set\'s link to its parent must survive the reinstall.');
  assert(edgeCount('HAS_ELEMENT', setSup, addr) === 1, 'the set\'s membership in `set` must survive the reinstall.');
  for (const m of members) {
    assert(edgeCount('HAS_ELEMENT', addr, m) === 1, `the set's link to member ${m} must survive the reinstall.`);
  }
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- event-less-create-set tests (epic node-primitives, Story 1) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  try {
    for (const [name, fn] of tests) {
      try {
        const r = await fn();
        if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
        else { console.log(`  PASS  ${name}`); pass++; }
      } catch (err) {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      }
    }
  } finally {
    if (fx || createdSetUuids.size > 0) teardownFixtures();
  }
  console.log(`\nevent-less-create-set: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
