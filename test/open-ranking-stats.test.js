/**
 * Story open-ranking #1: ORE provider surface + ORE-02 /stats/pubkey (walking skeleton).
 * ADR open-ranking/0001. See engineering-team/stories/open-ranking/1-ore-provider-and-stats.test-plan.md
 *
 * ADR chose Option A: a self-contained module `src/api/open-ranking/` exporting
 * a CAPABILITIES-driven capability document plus the ORE-02 /stats/pubkey logic.
 * To stay hermetic (no live Neo4j), the spec is asserted against PURE response
 * builders that take INJECTED deps (the testability seam ratified into ADR 0001
 * §Implementation notes — mirrors live-feed/0001's `buildFeed({deps})`):
 *
 *   buildCapabilityResponse()            -> { httpStatus, headers, body }
 *   buildStats({ pubkey, algorithm, pov }, deps) -> { httpStatus, headers, body }
 *        deps = { ownerPubkey, fetchProfileScores({pubkey, observerPubkey}), isPovProvisioned(pov) }
 *   oreJsonErrorHandler(err, req, res, next)   (Express 4-arg; ORE-path parse → 400)
 *   isValidHexPubkey(s) -> boolean
 *   registerOpenRankingRoutes(app), handleStatsPubkey, handleCapabilityDoc (Express wrappers)
 *
 * The thin Express handlers wrap the pure builders + apply the deps; the tests
 * exercise the builders directly. If the Implementer hard-wires Neo4j into the
 * handlers and skips the injectable builders, these behavioral assertions fail
 * (they would hit real I/O), which is the correct pressure toward the seam.
 *
 * S* : structural sentinels — module + route registration, so the pre-impl
 *      failure reads as "feature absent", not a require crash.
 * C* : ORE-01 capability document shape + headers.
 * B* : ORE-02 /stats/pubkey behavior — algorithm selection, POV rules, field
 *      mapping, validation, CORS headers.
 * V* / E* : pubkey validation helper + the malformed-JSON error middleware.
 *
 * ALL tests FAIL pre-implementation (module absent) and must PASS post.
 */

const fs = require('fs');
const path = require('path');

const MODULE_PATH = path.resolve(__dirname, '../src/api/open-ranking/index.js');
const API_INDEX = path.resolve(__dirname, '../src/api/index.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

function loadModule() {
  try { delete require.cache[require.resolve(MODULE_PATH)]; } catch { /* not resolvable yet */ }
  try { return require(MODULE_PATH); } catch { return null; }
}

// Case-insensitive header lookup against a plain headers object.
function hget(headers, name) {
  const k = Object.keys(headers || {}).find((x) => x.toLowerCase() === name.toLowerCase());
  return k ? headers[k] : undefined;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const HEX = (c) => c.repeat(64);
const OWNER = HEX('a');       // the instance-owner baseline POV (injected as deps.ownerPubkey)
const TARGET = HEX('1');      // the pubkey being asked about
const PROV_POV = HEX('b');    // a provisioned POV (has a card)
const UNPROV_POV = HEX('9');  // an arbitrary, unprovisioned POV

// A representative get-profile-scores result (the shape buildStats maps from).
function scores(overrides = {}) {
  return {
    pubkey: TARGET,
    npub: '',
    influence: 0.91,
    average: 0.8, confidence: 0.9, input: 50,
    personalizedPageRank: 0.0001, hops: 2,
    followingCount: 320, followerCount: 1400,
    mutingCount: 5, muterCount: 12,
    reporterCount: 3, reportingCount: 0,
    verifiedFollowerCount: 100, verifiedMuterCount: 2, verifiedReporterCount: 1,
    followerInput: 1, muterInput: 1, reporterInput: 1,
    latestContentEventCreatedAt: 1700000000,
    ...overrides,
  };
}

// Default injected deps; any can be overridden per-test. Spies recorded on the object.
function makeDeps(overrides = {}) {
  const d = {
    ownerPubkey: OWNER,
    _provisionedCalls: [],
    _fetchCalls: [],
    isPovProvisioned: async function (pov) { d._provisionedCalls.push(pov); return pov === OWNER || pov === PROV_POV; },
    fetchProfileScores: async function ({ pubkey, observerPubkey }) { d._fetchCalls.push({ pubkey, observerPubkey }); return scores({ pubkey }); },
  };
  Object.assign(d, overrides);
  return d;
}

async function callBuildStats(mod, input, deps) {
  assert(mod && typeof mod.buildStats === 'function',
    'src/api/open-ranking/index.js must export an async `buildStats(input, deps)` — the feature is not implemented yet ' +
    '(ADR open-ranking/0001 §Implementation notes / §Testability seam).');
  return mod.buildStats(input, deps);
}

// A minimal Express-like response double for the error-middleware test.
function mockRes() {
  return {
    statusCode: 200, _headers: {}, body: undefined, ended: false,
    status(c) { this.statusCode = c; return this; },
    set(k, v) {
      if (k && typeof k === 'object') { for (const kk of Object.keys(k)) this._headers[kk.toLowerCase()] = k[kk]; }
      else { this._headers[String(k).toLowerCase()] = v; }
      return this;
    },
    setHeader(k, v) { this._headers[String(k).toLowerCase()] = v; return this; },
    removeHeader(k) { delete this._headers[String(k).toLowerCase()]; return this; },
    get(k) { return this._headers[String(k).toLowerCase()]; },
    json(o) { this.body = o; this.ended = true; if (!this._headers['content-type']) this._headers['content-type'] = 'application/json; charset=utf-8'; return this; },
    end() { this.ended = true; return this; },
  };
}

// ===========================================================================
// STRUCTURAL SENTINELS
// ===========================================================================

test('S1: src/api/open-ranking/index.js exists and exports the builders + Express wrappers (ADR §Decision / §Implementation notes)', () => {
  const mod = loadModule();
  assert(mod !== null,
    'src/api/open-ranking/index.js does not exist / does not load yet — the Implementer must create the ORE provider ' +
    'module (ADR open-ranking/0001 chose Option A: a self-contained module driven by a CAPABILITIES registry).');
  for (const fn of ['registerOpenRankingRoutes', 'buildCapabilityDocument', 'buildCapabilityResponse', 'buildStats', 'handleStatsPubkey', 'handleCapabilityDoc', 'oreJsonErrorHandler', 'isValidHexPubkey']) {
    assert(typeof mod[fn] === 'function', `open-ranking/index.js must export \`${fn}\` (ADR §Implementation notes / §Testability seam).`);
  }
});

test('S2: src/api/index.js wires the ORE module, which registers /.well-known/open-ranking.json and /stats/pubkey (ADR §Implementation notes)', () => {
  // ADR 0001 uses the self-registering module pattern (registerOpenRankingRoutes,
  // like registerNip05Routes), so the route strings live in the ORE module and
  // src/api/index.js carries only the wiring.
  const idx = safeRead(API_INDEX);
  assert(idx.length > 0, 'src/api/index.js missing — unexpected.');
  assert(/registerOpenRankingRoutes|['"]\.\/open-ranking['"]/.test(idx),
    'src/api/index.js must wire the ORE routes via registerOpenRankingRoutes from ./open-ranking.');
  const mod = safeRead(MODULE_PATH);
  assert(/['"]\/\.well-known\/open-ranking\.json['"]/.test(mod),
    "src/api/open-ranking/index.js must register the public route '/.well-known/open-ranking.json'.");
  assert(/['"]\/stats\/pubkey['"]/.test(mod),
    "src/api/open-ranking/index.js must register the public route '/stats/pubkey' (bare path → auto-public).");
});

// ===========================================================================
// ORE-01 — Capability document (AC: capability doc shape + headers)
// ===========================================================================

test('C1: the capability document advertises /stats/pubkey with its two algorithms (AC-1)', () => {
  // Updated by open-ranking #2: the doc now also advertises /search/pubkeys, so
  // this no longer asserts /stats/pubkey is the ONLY endpoint — just that it
  // remains advertised with its two algorithm objects.
  const mod = loadModule();
  assert(mod && typeof mod.buildCapabilityResponse === 'function', 'buildCapabilityResponse missing — feature absent.');
  const { body } = mod.buildCapabilityResponse();
  assert(body && typeof body === 'object', 'capability body must be a JSON object keyed by endpoint path.');
  assert(Array.isArray(body['/stats/pubkey']) && body['/stats/pubkey'].length === 2,
    'the /stats/pubkey value must be an array of exactly two Algorithm Objects (global + personalized).');
});

test('C2: the default (first) algorithm is global "graperank" (pov:false); the second is "graperank-personalized" (pov:true) (AC-1)', () => {
  const mod = loadModule();
  assert(mod && typeof mod.buildCapabilityResponse === 'function', 'buildCapabilityResponse missing — feature absent.');
  const { body } = mod.buildCapabilityResponse();
  const algos = body['/stats/pubkey'];
  assert(algos[0].id === 'graperank',
    `the FIRST element is the default algorithm and must be id 'graperank'; got ${JSON.stringify(algos[0].id)}.`);
  assert(algos[0].pov === false || algos[0].pov === undefined,
    `the default 'graperank' must be global (pov:false / absent) so a no-pov request never 422s; got pov=${JSON.stringify(algos[0].pov)}.`);
  assert(algos[1].id === 'graperank-personalized' && algos[1].pov === true,
    `the second algorithm must be id 'graperank-personalized' with pov===true; got ${JSON.stringify(algos[1])}.`);
});

test('C3: the capability response is 200 with application/json and Access-Control-Allow-Origin: * (ORE-00)', () => {
  const mod = loadModule();
  assert(mod && typeof mod.buildCapabilityResponse === 'function', 'buildCapabilityResponse missing — feature absent.');
  const { httpStatus, headers } = mod.buildCapabilityResponse();
  assert(httpStatus === 200, `capability doc must be served 200; got ${httpStatus}.`);
  assert(hget(headers, 'Access-Control-Allow-Origin') === '*',
    `capability doc must send Access-Control-Allow-Origin: * (ORE-00); got ${JSON.stringify(hget(headers, 'Access-Control-Allow-Origin'))}.`);
  assert(/application\/json/.test(hget(headers, 'Content-Type') || ''),
    `capability doc Content-Type must be application/json; got ${JSON.stringify(hget(headers, 'Content-Type'))}.`);
});

// ===========================================================================
// ORE-02 — /stats/pubkey
// ===========================================================================

test('B1 (AC: global stats): a valid hex pubkey with no algorithm uses the global default, returns 200, rank = round(influence*100), read under the OWNER POV', async () => {
  const mod = loadModule();
  const deps = makeDeps();
  const r = await callBuildStats(mod, { pubkey: TARGET }, deps);
  assert(r && r.httpStatus === 200, `expected 200 for a valid global request; got ${JSON.stringify(r && r.httpStatus)}.`);
  assert(r.body.pubkey === TARGET, `response must echo the pubkey; got ${JSON.stringify(r.body.pubkey)}.`);
  assert(r.body.rank === 91, `rank must be round(influence*100) = round(0.91*100) = 91; got ${JSON.stringify(r.body.rank)}.`);
  assert(deps._fetchCalls.length === 1 && deps._fetchCalls[0].observerPubkey === 'owner',
    `the global algorithm must read scores under the owner baseline (observerPubkey 'owner'); got ${JSON.stringify(deps._fetchCalls)}.`);
});

test('B2 (AC: field mapping, ADR 0003): inbound counts (followers/muters/reporters) are VERIFIED; outbound (follows/mutes) are exact; hops included; reports/first_seen_at omitted; ttl present', async () => {
  const mod = loadModule();
  const r = await callBuildStats(mod, { pubkey: TARGET }, makeDeps());
  assert(r.httpStatus === 200, `expected 200; got ${r.httpStatus}.`);
  const b = r.body;
  // Inbound = VERIFIED (ADR 0003): "total" inbound is unknowable; verified is the well-defined line.
  assert(b.followers === 100, `followers must map from verifiedFollowerCount (100); got ${b.followers}.`);
  assert(b.muters === 2, `muters must map from verifiedMuterCount (2); got ${b.muters}.`);
  assert(b.reporters === 1, `reporters must map from verifiedReporterCount (1); got ${b.reporters}.`);
  // Outbound = exact (the target's own list sizes).
  assert(b.follows === 320, `follows must map from followingCount (320, exact); got ${b.follows}.`);
  assert(b.mutes === 5, `mutes must map from mutingCount (5, exact); got ${b.mutes}.`);
  // hops included (ADR 0003).
  assert(b.hops === 2, `hops must map from the hops field (2); got ${b.hops}.`);
  assert(!('reports' in b), '`reports` is omitted in v1 — it must be absent.');
  assert(!('first_seen_at' in b), '`first_seen_at` is omitted in v1 — it must be absent.');
  assert(b.ttl === 3600, `ttl must be the fixed hint 3600; got ${b.ttl}.`);
});

test('B3 (AC: rank): influence is rounded to the nearest integer ×100 (0.915 -> 92)', async () => {
  const mod = loadModule();
  const deps = makeDeps({ fetchProfileScores: async ({ pubkey }) => scores({ pubkey, influence: 0.915 }) });
  const r = await callBuildStats(mod, { pubkey: TARGET }, deps);
  assert(r.body.rank === 92, `rank must be round(0.915*100) = 92; got ${JSON.stringify(r.body.rank)}.`);
});

test('B4 (AC: personalized provisioned): graperank-personalized with a provisioned pov returns 200 and reads scores under that pov', async () => {
  const mod = loadModule();
  const deps = makeDeps();
  const r = await callBuildStats(mod, { pubkey: TARGET, algorithm: 'graperank-personalized', pov: PROV_POV }, deps);
  assert(r.httpStatus === 200, `a provisioned pov must return 200; got ${r.httpStatus}.`);
  assert(deps._provisionedCalls.includes(PROV_POV), 'isPovProvisioned must be consulted for a pov:true algorithm.');
  assert(deps._fetchCalls.length === 1 && deps._fetchCalls[0].observerPubkey === PROV_POV,
    `the personalized algorithm must read scores under the supplied pov as observerPubkey; got ${JSON.stringify(deps._fetchCalls)}.`);
});

test('B5 (AC: personalized unprovisioned -> 422): an unprovisioned pov returns 422 + X-Reason, with NO house fallback (scores never fetched)', async () => {
  const mod = loadModule();
  const deps = makeDeps();
  const r = await callBuildStats(mod, { pubkey: TARGET, algorithm: 'graperank-personalized', pov: UNPROV_POV }, deps);
  assert(r.httpStatus === 422, `an unprovisioned pov on a pov:true algorithm must return 422; got ${r.httpStatus}.`);
  assert(hget(r.headers, 'X-Reason'), 'a 422 must carry a human-readable X-Reason header (ORE-00).');
  assert(deps._fetchCalls.length === 0,
    'an unprovisioned pov must NOT fall back to the house view — scores must not be fetched (POV invariant).');
});

test('B6 (AC: conventions): graperank-personalized with NO pov returns 422 + X-Reason', async () => {
  const mod = loadModule();
  const deps = makeDeps();
  const r = await callBuildStats(mod, { pubkey: TARGET, algorithm: 'graperank-personalized' }, deps);
  assert(r.httpStatus === 422, `a pov:true algorithm with no pov must return 422; got ${r.httpStatus}.`);
  assert(hget(r.headers, 'X-Reason'), 'the missing-pov 422 must carry an X-Reason header.');
  assert(deps._fetchCalls.length === 0, 'a missing required pov must short-circuit before fetching scores.');
});

test('B7 (AC: conventions): a pov sent to the GLOBAL algorithm is IGNORED — 200, read under owner, provisioning never checked', async () => {
  const mod = loadModule();
  const deps = makeDeps();
  const r = await callBuildStats(mod, { pubkey: TARGET, algorithm: 'graperank', pov: UNPROV_POV }, deps);
  assert(r.httpStatus === 200, `a pov on a global algorithm must be ignored, not rejected; got ${r.httpStatus}.`);
  assert(deps._provisionedCalls.length === 0, 'a global algorithm must never consult isPovProvisioned.');
  assert(deps._fetchCalls[0].observerPubkey === 'owner', `the ignored pov must not change the POV; expected owner, got ${deps._fetchCalls[0].observerPubkey}.`);
});

test('B8 (AC: conventions): an unsupported algorithm id returns 422 + X-Reason', async () => {
  const mod = loadModule();
  const r = await callBuildStats(mod, { pubkey: TARGET, algorithm: 'definitely-not-real' }, makeDeps());
  assert(r.httpStatus === 422, `an algorithm id not advertised for /stats/pubkey must return 422; got ${r.httpStatus}.`);
  assert(hget(r.headers, 'X-Reason'), 'the unsupported-algorithm 422 must carry an X-Reason header.');
});

test('B9 (AC: conventions): an invalid pubkey (npub, wrong length, uppercase) or a missing pubkey returns 422', async () => {
  const mod = loadModule();
  const bad = ['npub1exampleexampleexampleexampleexampleexampleexampleexa', HEX('a').slice(0, 63), HEX('A'), 'xyz', '', undefined];
  for (const pk of bad) {
    const r = await callBuildStats(mod, { pubkey: pk }, makeDeps());
    assert(r.httpStatus === 422, `pubkey ${JSON.stringify(pk)} must be rejected with 422 (ORE-00: 64-hex lowercase, no npub); got ${r.httpStatus}.`);
  }
});

test('B10 (AC: no 404 for unknown pubkey): an unknown pubkey (influence 0) returns 200 with a floor rank of 0', async () => {
  const mod = loadModule();
  const deps = makeDeps({ fetchProfileScores: async ({ pubkey }) => scores({ pubkey, influence: 0, followingCount: 0, followerCount: 0, mutingCount: 0, muterCount: 0, reporterCount: 0 }) });
  const r = await callBuildStats(mod, { pubkey: TARGET }, deps);
  assert(r.httpStatus === 200, `ORE-02 defines no 404 for unknown pubkeys — must return 200 with a floor rank; got ${r.httpStatus}.`);
  assert(r.body.rank === 0, `an unknown pubkey must get a floor rank of 0; got ${r.body.rank}.`);
});

test('B11 (ORE-00 CORS): both 200 and 422 responses carry Access-Control-Allow-Origin: * and application/json', async () => {
  const mod = loadModule();
  const ok = await callBuildStats(mod, { pubkey: TARGET }, makeDeps());
  const err = await callBuildStats(mod, { pubkey: 'not-hex' }, makeDeps());
  for (const [label, r] of [['200', ok], ['422', err]]) {
    assert(hget(r.headers, 'Access-Control-Allow-Origin') === '*',
      `the ${label} response must send Access-Control-Allow-Origin: *; got ${JSON.stringify(hget(r.headers, 'Access-Control-Allow-Origin'))}.`);
    assert(/application\/json/.test(hget(r.headers, 'Content-Type') || ''),
      `the ${label} response Content-Type must be application/json; got ${JSON.stringify(hget(r.headers, 'Content-Type'))}.`);
  }
});

test('B12 (AC: personalized with the owner pubkey): pov === owner is treated as provisioned and read under owner', async () => {
  const mod = loadModule();
  const deps = makeDeps();
  const r = await callBuildStats(mod, { pubkey: TARGET, algorithm: 'graperank-personalized', pov: OWNER }, deps);
  assert(r.httpStatus === 200, `the owner is always a provisioned POV; got ${r.httpStatus}.`);
  assert(deps._fetchCalls[0].observerPubkey === 'owner' || deps._fetchCalls[0].observerPubkey === OWNER,
    `pov===owner must read the owner baseline; got ${deps._fetchCalls[0].observerPubkey}.`);
});

test('B13 (AC: hops, ADR 0003): a missing / non-finite hops maps to the 999 unreachable sentinel', async () => {
  const mod = loadModule();
  const deps = makeDeps({ fetchProfileScores: async ({ pubkey }) => { const s = scores({ pubkey }); delete s.hops; return s; } });
  const r = await callBuildStats(mod, { pubkey: TARGET }, deps);
  assert(r.body.hops === 999, `a missing hops must map to the 999 unreachable sentinel; got ${r.body.hops}.`);
});

// ===========================================================================
// Validation helper + error middleware
// ===========================================================================

test('V1: isValidHexPubkey accepts 64-char lowercase hex and rejects everything else', () => {
  const mod = loadModule();
  assert(mod && typeof mod.isValidHexPubkey === 'function', 'isValidHexPubkey missing — feature absent.');
  assert(mod.isValidHexPubkey(HEX('a')) === true, '64-char lowercase hex must be valid.');
  assert(mod.isValidHexPubkey(HEX('0')) === true, 'all-zero 64-hex must be valid.');
  assert(mod.isValidHexPubkey(HEX('A')) === false, 'uppercase hex must be rejected (ORE-00 requires lowercase).');
  assert(mod.isValidHexPubkey(HEX('a').slice(0, 63)) === false, '63 chars must be rejected.');
  assert(mod.isValidHexPubkey(HEX('a') + 'a') === false, '65 chars must be rejected.');
  assert(mod.isValidHexPubkey('npub1xxx') === false, 'npub must be rejected.');
  assert(mod.isValidHexPubkey('') === false && mod.isValidHexPubkey(undefined) === false, 'empty/undefined must be rejected.');
});

test('E1: oreJsonErrorHandler maps a body-parse error on an ORE path to 400 + X-Reason + ACAO:*', () => {
  const mod = loadModule();
  assert(mod && typeof mod.oreJsonErrorHandler === 'function', 'oreJsonErrorHandler missing — feature absent.');
  const res = mockRes();
  let nexted = false;
  const err = Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed', status: 400 });
  mod.oreJsonErrorHandler(err, { path: '/stats/pubkey', method: 'POST' }, res, () => { nexted = true; });
  assert(res.statusCode === 400, `a malformed JSON body on an ORE path must produce 400; got ${res.statusCode}.`);
  assert(res.get('x-reason'), 'the 400 must carry an X-Reason header (ORE-00).');
  assert(res.get('access-control-allow-origin') === '*', 'even the 400 must carry Access-Control-Allow-Origin: *.');
  assert(nexted === false, 'oreJsonErrorHandler must terminate the ORE-path parse error itself, not call next.');
});

test('E2: oreJsonErrorHandler passes non-ORE-path errors through to next (does not hijack other routes)', () => {
  const mod = loadModule();
  assert(mod && typeof mod.oreJsonErrorHandler === 'function', 'oreJsonErrorHandler missing — feature absent.');
  const res = mockRes();
  let nextedWith;
  const err = Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed', status: 400 });
  mod.oreJsonErrorHandler(err, { path: '/api/something-else', method: 'POST' }, res, (e) => { nextedWith = e || err; });
  assert(nextedWith === err, 'a parse error on a non-ORE path must be forwarded via next(err), not handled here.');
  assert(res.ended !== true, 'the middleware must not write a response for non-ORE paths.');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
