/**
 * Story 1 (epic: relationship-primitives) — Strfry-free relationship
 * add/delete primitives.
 *
 * Story: engineering-team/stories/relationship-primitives/1-relationship-add-delete-primitives.md
 * ADR:   engineering-team/decisions/relationship-primitives/0001-strfry-free-relationship-primitives.md
 *
 * Three test classes (ADR §6, on the established split):
 *
 *   U-class (stack-free, always gates CI) — a stub for src/lib/neo4j-driver
 *     is injected into require.cache BEFORE src/api/normalize/relationships.js
 *     loads (the pre-require pattern from test/strfry-wipe-owner-gate.test.js),
 *     then the exported handlers are driven with mock req/res. Covers the
 *     owner gate (403 before any Cypher, both operations, for both the
 *     unauthenticated-shaped and the authenticated-non-owner caller), the
 *     localTrusted pass, 400 for missing fields / unknown / non-whitelisted
 *     relType, 404 discrimination naming the missing uuid, and the
 *     created / already-existed / deleted / not-found discrimination from
 *     scripted stub rows (the row contract is pinned by the ADR's
 *     Implementation notes). Every handler invocation is wrapped in
 *     child_process call counting — the delta must be zero.
 *
 *   S-class (source assertions, stack-free) — the structural no-strfry
 *     guarantee: relationships.js's require list is exactly
 *     {../../lib/neo4j-driver, ./firmware, ../../middleware/auth}; none of
 *     child_process / nostr-tools / assistantKeys / publishToStrfry /
 *     signAndFinalize appear; the whitelist resolves through
 *     firmware.relAlias(...) with no whitelisted Neo4j alias as a raw string
 *     literal; both routes are registered in registerNormalizeRoutes; the
 *     firmware-install overwrite hazard is documented in the module header.
 *
 *   H-class (live local stack, per-test SKIP when unreachable — the
 *     test/deploy-safety-status.test.js pattern) — the functional floor via
 *     container loopback (`docker exec tapestry curl`, the
 *     test/customize-pin-curation-publish.test.js precedent), because a
 *     host->:7778 call is remote by design (ADR security-auth-exposure/0001).
 *     Fixtures are two throwaway :NostrEvent nodes with test-prefixed uuids,
 *     created and torn down via POST /api/neo4j/query over the same loopback;
 *     firmware and 39998:<TA>:shared-concept structure are never touched.
 *     Matrix (ordered): add-new -> add-idempotent -> delete-existing (decoy
 *     edges survive) -> delete-missing -> nonexistent-node 404 -> rejected
 *     relType 400 -> host-side unauthenticated 401 -> no-strfry-write
 *     (GET /api/strfry/scan/count equality bracketing a full add+delete
 *     cycle).
 *
 * ALL U/S tests and (stack-present) H tests FAIL until the feature lands —
 * src/api/normalize/relationships.js does not exist yet. That is the point.
 * (One deliberate exception: H7's host-side 401 is already satisfied by the
 * default-deny middleware, which fires before route matching — it is a
 * regression guard on the ratified auth layering, not a feature signal.)
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');
const REL_MODULE = path.join(ROOT, 'src/api/normalize/relationships.js');
const NORMALIZE_INDEX = path.join(ROOT, 'src/api/normalize/index.js');
const DRIVER_PATH = path.join(ROOT, 'src/lib/neo4j-driver.js');

const HOST_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

// The ratified initial whitelist (ADR decision 2): the two class-thread
// membership types. These literals belong to the TEST's expectations only —
// the module under test must build them via firmware.relAlias (S2 enforces
// that it carries no such literals itself).
const ALLOWED_ALIASES = ['HAS_ELEMENT', 'IS_A_SUPERSET_OF'];

const ADD_ROUTE = '/api/normalize/add-relationship';
const DELETE_ROUTE = '/api/normalize/delete-relationship';

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return null; }
}

function short(x, n = 200) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}

/* ── U-class plumbing ──────────────────────────────────────────────────── */

// Scripted Neo4j driver stub. Handlers may use runCypher OR writeCypher —
// the spec pins "Neo4j access via runCypher/writeCypher", not which; both
// feed the same call log and script queue so the tests don't over-constrain.
const driverCalls = [];
let driverScript = [];
async function scripted(cypher, params) {
  driverCalls.push({ cypher, params: params || {} });
  if (driverScript.length > 0) return driverScript.shift();
  return [];
}
const driverStub = {
  runCypher: scripted,
  writeCypher: scripted,
  getDriver() { throw new Error('U-class tests must never open a real Neo4j driver'); },
  closeDriver: async () => {},
  toJS: (v) => v,
};

function installDriverStub() {
  const resolved = require.resolve(DRIVER_PATH);
  const m = new Module(resolved, null);
  m.filename = resolved;
  m.loaded = true;
  m.exports = driverStub;
  require.cache[resolved] = m;
}

/**
 * Require the feature module with the driver stub pre-installed. Throws a
 * feature-missing error (not an opaque MODULE_NOT_FOUND) while the module has
 * not been implemented, so every pre-implementation failure reads as "the
 * feature is missing".
 */
let _handlers = null;
function requireRelationships() {
  if (_handlers) return _handlers;
  if (!fs.existsSync(REL_MODULE)) {
    throw new Error(
      'src/api/normalize/relationships.js does not exist yet — the strfry-free ' +
      'relationship add/delete module (ADR relationship-primitives/0001 Option A) ' +
      'is not implemented.'
    );
  }
  installDriverStub(); // BEFORE require: the module destructures at load time
  delete require.cache[require.resolve(REL_MODULE)];
  const mod = require(REL_MODULE);
  assert(typeof mod.handleAddRelationship === 'function',
    'relationships.js must export handleAddRelationship (ADR Implementation notes).');
  assert(typeof mod.handleDeleteRelationship === 'function',
    'relationships.js must export handleDeleteRelationship (ADR Implementation notes).');
  _handlers = mod;
  return mod;
}

// child_process call counting — wrap-and-delegate so nothing else in the
// runner process breaks; active only around a handler invocation. AC-5: the
// primitives must never shell out (no strfry, no exec of any kind).
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

const VALID_BODY = { fromUuid: 'u-from', toUuid: 'u-to', relType: 'HAS_ELEMENT' };

// A handler invocation with mock req/res + scripted driver rows. Returns the
// res plus the Cypher-call and child_process-call deltas for this invocation.
async function invoke(handlerName, reqOverrides = {}, script = []) {
  const mod = requireRelationships();
  driverScript = script.slice();
  const before = driverCalls.length;
  const res = mkRes();
  const req = { session: {}, localTrusted: false, body: {}, ...reqOverrides };
  const cpCount = await countCpCalls(() => mod[handlerName](req, res));
  const calls = driverCalls.slice(before);
  return {
    res,
    cypherCalls: calls.length,
    cypherText: calls.map((c) => c.cypher).join('\n'),
    cpCalls: cpCount,
  };
}

// The pinned happy rows (ADR Implementation notes: single write query
// returning alreadyExisted/fromLabels/toLabels for add, deletedCount/
// fromLabels/toLabels for delete; zero rows ⇒ diagnostic uuid lookup).
function addRow(alreadyExisted) {
  return [{ alreadyExisted, fromLabels: ['NostrEvent'], toLabels: ['NostrEvent'] }];
}
function deleteRow(deletedCount) {
  return [{ deletedCount, fromLabels: ['NostrEvent'], toLabels: ['NostrEvent'] }];
}
// Diagnostic rows cover both plausible RETURN key spellings so the test pins
// the CONTRACT (name the missing uuid) rather than a Cypher alias choice.
function diagRow(presentUuids) {
  return presentUuids.map((u) => ({ uuid: u, 'n.uuid': u }));
}

/* ── H-class plumbing ──────────────────────────────────────────────────── */

function dockerCurl(args) {
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], {
    encoding: 'utf8',
    timeout: 60000,
  });
}

// POST via container loopback — the genuine local-operator path (host->:7778
// is remote by design; ADR security-auth-exposure/0001).
function loopbackPost(pathname, body) {
  const out = dockerCurl([
    '-s', '-m', '30', '-X', 'POST', `${CONTAINER_BASE}${pathname}`,
    '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(body),
    '-w', '\n__STATUS__%{http_code}',
  ]);
  const idx = out.lastIndexOf('\n__STATUS__');
  const status = idx === -1 ? 0 : parseInt(out.slice(idx + 11), 10);
  const raw = idx === -1 ? out : out.slice(0, idx);
  let json = null;
  try { json = JSON.parse(raw); } catch {}
  return { status, json, raw };
}

// Fixture Cypher rides the same loopback through the already-gated
// POST /api/neo4j/query (localTrusted passes its write gate).
function loopbackCypher(cypher, params = {}) {
  const { status, json, raw } = loopbackPost('/api/neo4j/query', { cypher, params });
  if (status !== 200 || !json || json.success !== true) {
    throw new Error(`fixture Cypher via loopback /api/neo4j/query failed: status=${status} body=${short(json || raw)}`);
  }
  return json.data || [];
}

// Count edges of one FIXED alias (never caller input) between two uuids.
function edgeCount(alias, fromUuid, toUuid) {
  assert(ALLOWED_ALIASES.includes(alias), `test bug: edgeCount alias ${alias} not in the fixed set`);
  const rows = loopbackCypher(
    `MATCH (a {uuid: $fromUuid})-[r:${alias}]->(b {uuid: $toUuid}) RETURN count(r) AS c`,
    { fromUuid, toUuid }
  );
  return rows[0] ? rows[0].c : 0;
}

async function hostPostJson(pathname, body) {
  const r = await fetch(`${HOST_BASE}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

async function strfryEventCount() {
  const r = await fetch(`${HOST_BASE}/api/strfry/scan/count?filter=${encodeURIComponent('{}')}`, {
    signal: AbortSignal.timeout(60000),
  });
  const j = await r.json().catch(() => null);
  if (!j || j.success !== true || typeof j.count !== 'number') {
    throw new Error(`GET /api/strfry/scan/count did not answer a count (got ${short(j)})`);
  }
  return j.count;
}

// The stack is "available" for H-class only when BOTH paths answer: the host
// HTTP path (H7/H8 read it) and the container loopback (everything else).
let reachable = null;
async function stackAvailable() {
  if (reachable !== null) return reachable;
  let host = false;
  try {
    const r = await fetch(`${HOST_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    host = r.ok;
  } catch { host = false; }
  let loopback = false;
  try {
    const out = dockerCurl(['-s', '-m', '3', `${CONTAINER_BASE}/api/auth/user-classification`]);
    loopback = /"success"\s*:\s*true/.test(out);
  } catch { loopback = false; }
  reachable = host && loopback;
  return reachable;
}

// Self-cleaning fixtures: two throwaway :NostrEvent nodes with test-prefixed
// uuids. Torn down (DETACH DELETE, filtered to these exact uuids) in run()'s
// finally — the graph is left as found. Never touches firmware structure.
let fixtures = null;
function ensureFixtures() {
  if (fixtures) return fixtures;
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const uuidA = `test-relprim-${stamp}-a`;
  const uuidB = `test-relprim-${stamp}-b`;
  loopbackCypher(
    'CREATE (:NostrEvent {uuid: $ua, name: $na}), (:NostrEvent {uuid: $ub, name: $nb})',
    { ua: uuidA, ub: uuidB, na: `relprim fixture A ${stamp}`, nb: `relprim fixture B ${stamp}` }
  );
  fixtures = { uuidA, uuidB, missingUuid: `test-relprim-${stamp}-missing` };
  return fixtures;
}

function teardownFixtures() {
  if (!fixtures) return;
  const uuids = [fixtures.uuidA, fixtures.uuidB];
  try {
    loopbackCypher('MATCH (n) WHERE n.uuid IN $uuids DETACH DELETE n', { uuids });
    const left = loopbackCypher('MATCH (n) WHERE n.uuid IN $uuids RETURN count(n) AS c', { uuids });
    if (left[0] && left[0].c !== 0) {
      console.log(`  WARN  fixture cleanup left ${left[0].c} node(s); remove manually: MATCH (n) WHERE n.uuid IN ${JSON.stringify(uuids)} DETACH DELETE n`);
    }
  } catch (e) {
    console.log(`  WARN  fixture cleanup failed (${e.message}); uuids: ${uuids.join(', ')}`);
  }
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ══════════════ U-class — handler units on the stubbed driver ══════════════ */

t('U1 (AC-4): unauthenticated-shaped caller (empty session, not localTrusted) gets 403 from ADD before any Cypher and with zero child_process calls', async () => {
  const { res, cypherCalls, cpCalls } = await invoke('handleAddRelationship',
    { session: {}, localTrusted: false, body: { ...VALID_BODY } });
  assert(res.statusCode === 403,
    `the in-handler owner gate (wipe.js pattern: !isOwner && !localTrusted) must answer 403 (got ${res.statusCode}).`);
  assert(res.body && res.body.success === false, `the 403 body must carry success:false (got ${short(res.body)}).`);
  assert(cypherCalls === 0, `the gate must fire BEFORE any Cypher; ${cypherCalls} driver call(s) ran.`);
  assert(cpCalls === 0, `the primitives must never shell out; ${cpCalls} child_process call(s) ran (AC-5).`);
});

t('U2 (AC-4): unauthenticated-shaped caller gets 403 from DELETE before any Cypher and with zero child_process calls', async () => {
  const { res, cypherCalls, cpCalls } = await invoke('handleDeleteRelationship',
    { session: {}, localTrusted: false, body: { ...VALID_BODY } });
  assert(res.statusCode === 403, `expected 403 from the delete gate (got ${res.statusCode}).`);
  assert(cypherCalls === 0, `the gate must fire BEFORE any Cypher; ${cypherCalls} driver call(s) ran.`);
  assert(cpCalls === 0, `zero child_process calls expected; got ${cpCalls} (AC-5).`);
});

t('U3 (AC-4): an authenticated NON-owner session gets 403 from BOTH operations before any Cypher', async () => {
  const nonOwner = { session: { authenticated: true, pubkey: 'f'.repeat(64) }, localTrusted: false };
  for (const handler of ['handleAddRelationship', 'handleDeleteRelationship']) {
    const { res, cypherCalls } = await invoke(handler, { ...nonOwner, body: { ...VALID_BODY } });
    assert(res.statusCode === 403,
      `${handler}: an authenticated non-owner must get 403 — default-deny alone only blocks the ` +
      `unauthenticated case (story AC-4); got ${res.statusCode}.`);
    assert(cypherCalls === 0, `${handler}: the gate must fire BEFORE any Cypher; ${cypherCalls} call(s) ran.`);
  }
});

t('U4 (AC-4): a trusted local caller (req.localTrusted) passes the gate on both operations', async () => {
  const add = await invoke('handleAddRelationship',
    { session: {}, localTrusted: true, body: { ...VALID_BODY } }, [addRow(false)]);
  assert(add.res.statusCode !== 403 && add.res.statusCode !== 401,
    `a localTrusted ADD must be allowed through the gate; got ${add.res.statusCode}.`);
  assert(add.res.statusCode === 200 && add.res.body && add.res.body.success === true,
    `a valid localTrusted ADD must complete 200 {success:true} (got ${add.res.statusCode}, ${short(add.res.body)}).`);
  const del = await invoke('handleDeleteRelationship',
    { session: {}, localTrusted: true, body: { ...VALID_BODY } }, [deleteRow(0)]);
  assert(del.res.statusCode !== 403 && del.res.statusCode !== 401,
    `a localTrusted DELETE must be allowed through the gate; got ${del.res.statusCode}.`);
});

t('U5 (AC-3): missing or empty body fields are rejected 400 naming the field, with no Cypher run', async () => {
  const cases = [
    [{}, /fromUuid|toUuid|relType/],
    [{ fromUuid: 'u-a', toUuid: 'u-b' }, /relType/],
    [{ fromUuid: '', toUuid: 'u-b', relType: 'HAS_ELEMENT' }, /fromUuid/],
  ];
  for (const [body, namePattern] of cases) {
    const { res, cypherCalls } = await invoke('handleAddRelationship',
      { session: {}, localTrusted: true, body });
    assert(res.statusCode === 400,
      `body ${short(body)} must be rejected 400 (preconditions fail loudly, never silently no-op — AC-3); got ${res.statusCode}.`);
    assert(res.body && res.body.success === false && typeof res.body.error === 'string' && namePattern.test(res.body.error),
      `the 400 error must NAME the failed precondition (${namePattern}); got ${short(res.body)}.`);
    assert(cypherCalls === 0, `nothing must change on a failed precondition; ${cypherCalls} Cypher call(s) ran.`);
  }
});

t('U6 (AC-3): an unknown relType — including the story-named net-new HAS_SUBGOAL — is rejected 400 with the allowed list, no Cypher', async () => {
  for (const bad of ['TOTALLY_BOGUS_REL', 'HAS_SUBGOAL']) {
    const { res, cypherCalls } = await invoke('handleAddRelationship',
      { session: {}, localTrusted: true, body: { fromUuid: 'u-a', toUuid: 'u-b', relType: bad } });
    assert(res.statusCode === 400,
      `relType ${bad} must be rejected 400 (net-new custom types are out of scope — story AC-3); got ${res.statusCode}.`);
    assert(res.body && res.body.success === false, `the 400 body must carry success:false (got ${short(res.body)}).`);
    assert(Array.isArray(res.body.allowed) && ALLOWED_ALIASES.every((a) => res.body.allowed.includes(a)),
      `the rejection must list the allowed types ${JSON.stringify(ALLOWED_ALIASES)} (ADR decision 5); got ${short(res.body.allowed)}.`);
    assert(cypherCalls === 0, `a rejected relType must run no Cypher; ${cypherCalls} call(s) ran.`);
  }
});

t('U7 (AC-3): a firmware-aliased but NON-whitelisted relType (IS_THE_CONCEPT_FOR / CLASS_THREAD_INITIATION) is rejected 400 from both operations', async () => {
  // Both spellings of the same non-whitelisted firmware type: the Neo4j alias
  // and the canonical slug. Admitting either would let a primitive with no
  // cardinality validation corrupt a class thread (ADR decision 2).
  const cases = [
    ['handleAddRelationship', 'IS_THE_CONCEPT_FOR'],
    ['handleDeleteRelationship', 'CLASS_THREAD_INITIATION'],
  ];
  for (const [handler, relType] of cases) {
    const { res, cypherCalls } = await invoke(handler,
      { session: {}, localTrusted: true, body: { fromUuid: 'u-a', toUuid: 'u-b', relType } });
    assert(res.statusCode === 400,
      `${handler}: firmware type ${relType} is NOT in the initial whitelist and must be rejected 400; got ${res.statusCode}.`);
    assert(res.body && Array.isArray(res.body.allowed),
      `${handler}: the rejection must carry the allowed list; got ${short(res.body)}.`);
    assert(cypherCalls === 0, `${handler}: no Cypher on a whitelist miss; ${cypherCalls} call(s) ran.`);
  }
});

t('U8 (AC-3): the whitelist resolves through the firmware alias layer — canonical slug CLASS_THREAD_TERMINATION is accepted, and only the resolved alias reaches the Cypher text', async () => {
  const { res, cypherText } = await invoke('handleAddRelationship',
    { session: {}, localTrusted: true, body: { fromUuid: 'u-a', toUuid: 'u-b', relType: 'CLASS_THREAD_TERMINATION' } },
    [addRow(false)]);
  assert(res.statusCode === 200 && res.body && res.body.success === true,
    `the canonical slug CLASS_THREAD_TERMINATION must resolve through firmware.relAlias and be accepted ` +
    `(story AC-3: names resolve through the alias layer); got ${res.statusCode}, ${short(res.body)}.`);
  assert(res.body.relType === 'HAS_ELEMENT',
    `the response must report the resolved Neo4j alias HAS_ELEMENT (got ${short(res.body.relType)}).`);
  assert(/HAS_ELEMENT/.test(cypherText),
    'the resolved alias HAS_ELEMENT must be what reaches the Cypher text.');
  assert(!/CLASS_THREAD_TERMINATION/.test(cypherText),
    'the caller\'s raw relType string must NEVER be interpolated into Cypher text — the whitelist is the injection boundary (ADR).');
});

t('U9 (AC-1): ADD discriminates created vs already-existed — HTTP 200 both times, hazard note only on the graph-changing outcome', async () => {
  const created = await invoke('handleAddRelationship',
    { session: {}, localTrusted: true, body: { ...VALID_BODY } }, [addRow(false)]);
  assert(created.res.statusCode === 200, `add-new must answer 200 (got ${created.res.statusCode}).`);
  const cb = created.res.body;
  assert(cb && cb.success === true && cb.operation === 'add' && cb.result === 'created',
    `add-new must report {operation:'add', result:'created'} (ADR decision 5); got ${short(cb)}.`);
  assert(cb.from && cb.from.uuid === VALID_BODY.fromUuid && cb.to && cb.to.uuid === VALID_BODY.toUuid,
    `the response must echo from/to uuids (got ${short(cb)}).`);
  assert(Array.isArray(cb.from.labels) && Array.isArray(cb.to.labels),
    `both endpoints' labels must be echoed for operator visibility (ADR decision 4); got ${short(cb)}.`);
  assert(typeof cb.note === 'string' && /install/i.test(cb.note),
    `a 'created' response must carry the one-line firmware-install hazard note (AC-5 documentation); got ${short(cb.note)}.`);

  const repeat = await invoke('handleAddRelationship',
    { session: {}, localTrusted: true, body: { ...VALID_BODY } }, [addRow(true)]);
  assert(repeat.res.statusCode === 200,
    `repeat-add must answer 200 — already-existed is an ACHIEVED END STATE, not a failure (got ${repeat.res.statusCode}).`);
  const rb = repeat.res.body;
  assert(rb && rb.success === true && rb.result === 'already-existed',
    `repeat-add must report result:'already-existed' (got ${short(rb)}).`);
  assert(rb.note === undefined,
    `no hazard note on 'already-existed' — the graph did not change (ADR decision 5 table); got ${short(rb.note)}.`);
});

t('U10 (AC-2): DELETE discriminates deleted vs not-found — HTTP 200 both times, deletedCount reported', async () => {
  const deleted = await invoke('handleDeleteRelationship',
    { session: {}, localTrusted: true, body: { ...VALID_BODY } }, [deleteRow(1)]);
  assert(deleted.res.statusCode === 200, `delete-existing must answer 200 (got ${deleted.res.statusCode}).`);
  const db = deleted.res.body;
  assert(db && db.success === true && db.operation === 'delete' && db.result === 'deleted' && db.deletedCount === 1,
    `delete-existing must report {operation:'delete', result:'deleted', deletedCount:1} (got ${short(db)}).`);
  assert(typeof db.note === 'string' && /install/i.test(db.note),
    `a 'deleted' response must carry the firmware-install hazard note (AC-5 documentation); got ${short(db.note)}.`);

  const missing = await invoke('handleDeleteRelationship',
    { session: {}, localTrusted: true, body: { ...VALID_BODY } }, [deleteRow(0)]);
  assert(missing.res.statusCode === 200,
    `delete-missing must answer 200 — not-found is an achieved end state; a 404 here would make ` +
    `idempotent retry scripts read success as failure (ADR decision 5); got ${missing.res.statusCode}.`);
  const mb = missing.res.body;
  assert(mb && mb.success === true && mb.result === 'not-found' && mb.deletedCount === 0,
    `delete-missing must report {result:'not-found', deletedCount:0} (got ${short(mb)}).`);
  assert(mb.note === undefined,
    `no hazard note on 'not-found' — the graph did not change (ADR decision 5 table); got ${short(mb.note)}.`);
});

t('U11 (AC-3): a uuid matching no node yields 404 naming exactly the missing uuid(s), never a silent no-op', async () => {
  // Main query returns zero rows; the diagnostic finds only fromUuid.
  const one = await invoke('handleAddRelationship',
    { session: {}, localTrusted: true, body: { ...VALID_BODY } },
    [[], diagRow([VALID_BODY.fromUuid])]);
  assert(one.res.statusCode === 404,
    `a nonexistent endpoint node must answer 404 (reserved for the node-precondition — ADR decision 5); got ${one.res.statusCode}.`);
  const ob = one.res.body;
  assert(ob && ob.success === false && Array.isArray(ob.missing),
    `the 404 body must carry success:false and a missing[] array (got ${short(ob)}).`);
  assert(ob.missing.includes(VALID_BODY.toUuid) && !ob.missing.includes(VALID_BODY.fromUuid),
    `missing[] must name EXACTLY the absent uuid(s) — expected [${VALID_BODY.toUuid}]; got ${short(ob.missing)}.`);
  assert(typeof ob.error === 'string' && ob.error.includes(VALID_BODY.toUuid),
    `the error text must name the missing uuid (fail loudly — AC-3); got ${short(ob.error)}.`);

  // Neither node exists — both uuids named. Same contract on DELETE.
  const both = await invoke('handleDeleteRelationship',
    { session: {}, localTrusted: true, body: { ...VALID_BODY } },
    [[], diagRow([])]);
  assert(both.res.statusCode === 404, `delete with both nodes absent must answer 404 (got ${both.res.statusCode}).`);
  const bb = both.res.body;
  assert(bb && Array.isArray(bb.missing) && bb.missing.includes(VALID_BODY.fromUuid) && bb.missing.includes(VALID_BODY.toUuid),
    `missing[] must name both absent uuids; got ${short(bb && bb.missing)}.`);
});

/* ══════════════ S-class — structural no-strfry + registration ══════════════ */

t('S1 (AC-5): relationships.js\'s import surface is exactly neo4j-driver + ./firmware + middleware/auth — structurally incapable of touching strfry', () => {
  const src = readSafe(REL_MODULE);
  assert(src !== null,
    'src/api/normalize/relationships.js does not exist yet — the strfry-free relationship ' +
    'module (ADR relationship-primitives/0001 Option A) is not implemented.');
  const specifiers = [];
  const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) specifiers.push(m[1]);
  const expected = ['../../lib/neo4j-driver', '../../middleware/auth', './firmware'];
  assert(JSON.stringify(specifiers.slice().sort()) === JSON.stringify(expected),
    `relationships.js must require EXACTLY ${JSON.stringify(expected)} — the import boundary IS the ` +
    `no-strfry guarantee (ADR Option A); got ${JSON.stringify(specifiers.sort())}.`);
  for (const forbidden of ['child_process', 'nostr-tools', 'assistantKeys', 'publishToStrfry', 'signAndFinalize']) {
    assert(!specifiers.some((s) => s.includes(forbidden)),
      `relationships.js must never require anything matching "${forbidden}" (AC-5: strfry-free).`);
  }
  assert(!/publishToStrfry|signAndFinalize/.test(src),
    'relationships.js must not reference publishToStrfry/signAndFinalize at all — no event is ever signed or published (AC-5).');
});

t('S2 (AC-3): the whitelist is built via firmware.relAlias(...) and no whitelisted Neo4j alias appears as a raw string literal', () => {
  const src = readSafe(REL_MODULE);
  assert(src !== null,
    'src/api/normalize/relationships.js does not exist yet — cannot verify the alias-layer whitelist.');
  assert(/relAlias\s*\(/.test(src),
    'the whitelist must resolve through firmware.relAlias(…) — an alias change must not silently orphan it (story AC-3).');
  for (const alias of ALLOWED_ALIASES) {
    assert(!(new RegExp(`['"\`]${alias}['"\`]`).test(src)),
      `the Neo4j alias ${alias} must NOT appear as a raw string literal in relationships.js — ` +
      'aliases come from the firmware layer, never hardcoded (story AC-3 / ADR decision 2).');
  }
});

t('S3 (AC-4): both routes are registered as POSTs on the fixed /api/normalize mount in normalize/index.js', () => {
  const src = readSafe(NORMALIZE_INDEX);
  assert(src !== null, 'src/api/normalize/index.js missing — re-baseline this sentinel.');
  assert(/require\(\s*['"]\.\/relationships['"]\s*\)/.test(src),
    'normalize/index.js must require ./relationships (the two-line registration — ADR Option A).');
  assert(/app\.post\(\s*['"]\/api\/normalize\/add-relationship['"]/.test(src),
    `POST ${ADD_ROUTE} is not registered — the add primitive is not reachable (ADR decision 1).`);
  assert(/app\.post\(\s*['"]\/api\/normalize\/delete-relationship['"]/.test(src),
    `POST ${DELETE_ROUTE} is not registered — the delete primitive is not reachable (ADR decision 1).`);
});

t('S4 (AC-5): the firmware-install overwrite hazard is documented in the module header', () => {
  const src = readSafe(REL_MODULE);
  assert(src !== null,
    'src/api/normalize/relationships.js does not exist yet — cannot verify the hazard documentation.');
  assert(/firmware\/install/.test(src),
    'the module header must cite the firmware install path (src/firmware/install.js) whose pass ' +
    'can re-add a deleted edge and prune an added one (AC-5: the hazard is documented where the ' +
    'operator meets it; operator decision 2026-07-18).');
  assert(/overwrite|re-add|re-adds|prune|hazard/i.test(src),
    'the module header must explain the overwrite hazard (an install can re-add a deleted edge and delete an added one).');
});

/* ══════════════ H-class — live functional matrix (SKIP when stack absent) ══════════════ */
// Ordered: H1→H8 share the fixture pair and build on one another's edge state.

t('H1 (AC-1): ADD creates the relationship — 200 result:created, labels echoed, and exactly one HAS_ELEMENT edge exists in Neo4j', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const { uuidA, uuidB } = ensureFixtures();
  const r = loopbackPost(ADD_ROUTE, { fromUuid: uuidA, toUuid: uuidB, relType: 'HAS_ELEMENT' });
  assert(r.status === 200 && r.json && r.json.success === true,
    `POST ${ADD_ROUTE} (container loopback) must answer 200 {success:true} — got status=${r.status}, ` +
    `body=${short(r.json || r.raw, 120)} — the add primitive is not implemented.`);
  assert(r.json.result === 'created',
    `first add between fresh nodes must report result:'created' (got ${short(r.json.result)}).`);
  assert(r.json.from && r.json.from.uuid === uuidA && Array.isArray(r.json.from.labels) && r.json.from.labels.includes('NostrEvent'),
    `the response must echo the from node's uuid and labels (got ${short(r.json.from)}).`);
  assert(typeof r.json.note === 'string' && /install/i.test(r.json.note),
    `the graph-changing success must carry the firmware-install hazard note (got ${short(r.json.note)}).`);
  assert(edgeCount('HAS_ELEMENT', uuidA, uuidB) === 1,
    'exactly one HAS_ELEMENT edge must exist in Neo4j after the add.');
});

t('H2 (AC-1): repeating the identical ADD is idempotent — 200 result:already-existed and still exactly one edge', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const { uuidA, uuidB } = ensureFixtures();
  const r = loopbackPost(ADD_ROUTE, { fromUuid: uuidA, toUuid: uuidB, relType: 'HAS_ELEMENT' });
  assert(r.status === 200 && r.json && r.json.success === true,
    `repeat POST ${ADD_ROUTE} must answer 200 {success:true} — got status=${r.status}, ` +
    `body=${short(r.json || r.raw, 120)} — the add primitive is not implemented.`);
  assert(r.json.result === 'already-existed',
    `the identical repeated add must report result:'already-existed' (AC-1); got ${short(r.json.result)}.`);
  assert(edgeCount('HAS_ELEMENT', uuidA, uuidB) === 1,
    'the repeat add must not create a second edge — exactly one HAS_ELEMENT edge must remain.');
});

t('H3 (AC-2): DELETE removes ONLY the named type+direction between the pair — decoy edges (reverse direction, other type) survive', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const { uuidA, uuidB } = ensureFixtures();
  // Decoys via raw fixture Cypher (fixed aliases, test-owned nodes only):
  // the SAME type in the REVERSE direction, and the OTHER whitelisted type in
  // the same direction. A targeted delete must touch neither.
  loopbackCypher(
    'MATCH (a {uuid: $ua}), (b {uuid: $ub}) MERGE (b)-[:HAS_ELEMENT]->(a) MERGE (a)-[:IS_A_SUPERSET_OF]->(b)',
    { ua: uuidA, ub: uuidB }
  );
  const r = loopbackPost(DELETE_ROUTE, { fromUuid: uuidA, toUuid: uuidB, relType: 'HAS_ELEMENT' });
  assert(r.status === 200 && r.json && r.json.success === true,
    `POST ${DELETE_ROUTE} (container loopback) must answer 200 {success:true} — got status=${r.status}, ` +
    `body=${short(r.json || r.raw, 120)} — the delete primitive is not implemented.`);
  assert(r.json.result === 'deleted' && r.json.deletedCount === 1,
    `delete-existing must report {result:'deleted', deletedCount:1} (got ${short(r.json)}).`);
  assert(typeof r.json.note === 'string' && /install/i.test(r.json.note),
    `the graph-changing success must carry the firmware-install hazard note (got ${short(r.json.note)}).`);
  assert(edgeCount('HAS_ELEMENT', uuidA, uuidB) === 0,
    'the named HAS_ELEMENT edge a->b must be gone after the delete.');
  assert(edgeCount('HAS_ELEMENT', uuidB, uuidA) === 1,
    'the REVERSE-direction HAS_ELEMENT decoy must survive — delete is targeted, never a sweep (AC-2).');
  assert(edgeCount('IS_A_SUPERSET_OF', uuidA, uuidB) === 1,
    'the other-type IS_A_SUPERSET_OF decoy must survive — delete is targeted, never a sweep (AC-2).');
});

t('H4 (AC-2): repeating the DELETE — the relationship no longer exists — reports not-found and removes nothing', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const { uuidA, uuidB } = ensureFixtures();
  const r = loopbackPost(DELETE_ROUTE, { fromUuid: uuidA, toUuid: uuidB, relType: 'HAS_ELEMENT' });
  assert(r.status === 200 && r.json && r.json.success === true,
    `repeat POST ${DELETE_ROUTE} must answer 200 {success:true} — got status=${r.status}, ` +
    `body=${short(r.json || r.raw, 120)} — the delete primitive is not implemented.`);
  assert(r.json.result === 'not-found' && r.json.deletedCount === 0,
    `repeat delete must report {result:'not-found', deletedCount:0} — an achieved end state, not an error (AC-2); got ${short(r.json)}.`);
  assert(edgeCount('HAS_ELEMENT', uuidB, uuidA) === 1,
    'the not-found path must remove NOTHING — the reverse-direction decoy must still exist.');
});

t('H5 (AC-3): a nonexistent endpoint node yields 404 naming the missing uuid, and no edge is created', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const { uuidA, missingUuid } = ensureFixtures();
  const r = loopbackPost(ADD_ROUTE, { fromUuid: uuidA, toUuid: missingUuid, relType: 'HAS_ELEMENT' });
  assert(r.json !== null,
    `POST ${ADD_ROUTE} answered no JSON (status=${r.status}, body=${short(r.raw, 80)}) — the route is not implemented.`);
  assert(r.status === 404,
    `an add against a uuid absent from Neo4j must answer 404 — got status=${r.status}, ` +
    `body=${short(r.json, 120)} — the existence check is not implemented.`);
  assert(r.json && r.json.success === false && Array.isArray(r.json.missing)
      && r.json.missing.includes(missingUuid) && !r.json.missing.includes(uuidA),
    `the 404 must name exactly the missing uuid ${missingUuid} (got ${short(r.json)}).`);
});

t('H6 (AC-3): a non-whitelisted relType is rejected 400 with the allowed list, from BOTH operations', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const { uuidA, uuidB } = ensureFixtures();
  const cases = [[ADD_ROUTE, 'HAS_SUBGOAL'], [DELETE_ROUTE, 'IS_THE_CONCEPT_FOR']];
  for (const [route, relType] of cases) {
    const r = loopbackPost(route, { fromUuid: uuidA, toUuid: uuidB, relType });
    assert(r.status === 400,
      `POST ${route} with relType ${relType} must answer 400 — got status=${r.status}, ` +
      `body=${short(r.json || r.raw, 120)} — the whitelist is not implemented.`);
    assert(r.json && r.json.success === false && Array.isArray(r.json.allowed)
        && ALLOWED_ALIASES.every((a) => r.json.allowed.includes(a)),
      `the 400 body must list the allowed types ${JSON.stringify(ALLOWED_ALIASES)} (got ${short(r.json)}).`);
  }
});

t('H7 (AC-4): a host-side unauthenticated remote POST is denied with 401 (default-deny, before the handler)', async () => {
  // NOTE: this test PASSES pre-implementation — default-deny (ADR
  // security-auth-exposure/0002) 401s method-based before route matching. It
  // is the ratified auth layering's regression guard, and the host path IS
  // the unauthenticated-remote case (host->:7778 peers as the Docker bridge
  // gateway, not loopback).
  if (!(await stackAvailable())) return 'SKIP';
  for (const route of [ADD_ROUTE, DELETE_ROUTE]) {
    const r = await hostPostJson(route, { fromUuid: 'x', toUuid: 'y', relType: 'HAS_ELEMENT' });
    assert(r.status === 401,
      `an unauthenticated host-side POST ${route} must be denied 401 by default-deny (got ${r.status}).`);
  }
});

t('H8 (AC-5): a full add+delete cycle writes NO event to strfry — scan counts bracket equal', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  const { uuidA, uuidB } = ensureFixtures();
  // Tight bracket around one full cycle of both operations (H4 left a->b with
  // no HAS_ELEMENT edge) — minimizes the concurrent-publish race window while
  // still covering every mutation path.
  const before = await strfryEventCount();
  const add = loopbackPost(ADD_ROUTE, { fromUuid: uuidA, toUuid: uuidB, relType: 'HAS_ELEMENT' });
  assert(add.status === 200 && add.json && add.json.result === 'created',
    `bracketed add must succeed with result:'created' — got status=${add.status}, ` +
    `body=${short(add.json || add.raw, 120)} — the add primitive is not implemented.`);
  const del = loopbackPost(DELETE_ROUTE, { fromUuid: uuidA, toUuid: uuidB, relType: 'HAS_ELEMENT' });
  assert(del.status === 200 && del.json && del.json.result === 'deleted',
    `bracketed delete must succeed with result:'deleted' — got status=${del.status}, body=${short(del.json || del.raw, 120)}.`);
  const after = await strfryEventCount();
  assert(before === after,
    `NEITHER operation may write any event to strfry (AC-5): scan count went ${before} -> ${after}. ` +
    'If a concurrent publisher (scheduled task / sync) is suspected, quiesce it and re-run.');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- relationship-primitives tests (epic relationship-primitives, Story 1) ---');
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
    teardownFixtures();
  }
  console.log(`\nrelationship-primitives: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
