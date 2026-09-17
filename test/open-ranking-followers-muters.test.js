/**
 * Story ore-parity #2: ORE-06 /followers + ORE-07 /muters (global).
 * ADR ore-parity/0002. See engineering-team/stories/ore-parity/2-followers-muters.test-plan.md
 *
 * ADR 0002 chose Option A: twin endpoints sharing one pure builder in
 * src/api/open-ranking/inbound.js — `buildFollowers(input, deps)` /
 * `buildMuters(input, deps)` return {httpStatus, headers, body} triples;
 * deps = { fetchVerifiedInbound(endpointPath, pubkey, limit)
 *            -> Promise<{ rows: [{pubkey, influence}], total }> }
 * (the real impl: two bounded parameterized Cypher statements over the
 * verified-inbound line). Hermetic: behavior asserted against the builders
 * with injected deps (the seam from ADR open-ranking/0001).
 *
 * Contract pinned here: results = verified followers/muters ranked by their own
 * global GrapeRank (round(influence*100)), row order trusted from the query but
 * sliced to limit defensively; total independent of truncation; limit default 50,
 * max 1000 (over -> 422, per ORE-06/07 — unlike ORE-03's clamp); unknown target
 * -> 200 { results: [], total: 0 } (the deliberate no-404 posture); no ttl.
 *
 * ALL tests FAIL pre-implementation and must PASS post.
 */

const fs = require('fs');
const path = require('path');

const MODULE_PATH = path.resolve(__dirname, '../src/api/open-ranking/index.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

function loadModule() {
  try { delete require.cache[require.resolve(MODULE_PATH)]; } catch { /* not resolvable yet */ }
  try { return require(MODULE_PATH); } catch { return null; }
}

function hget(headers, name) {
  const k = Object.keys(headers || {}).find((x) => x.toLowerCase() === name.toLowerCase());
  return k ? headers[k] : undefined;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const HEX = (c) => c.repeat(64);

/**
 * Default injected deps; override per-test. fetchVerifiedInbound is spied and
 * returns the given rows/total (rows already query-ordered: influence DESC).
 */
function makeInboundDeps(rows, total, overrides = {}) {
  const d = {
    _calls: [],
    fetchVerifiedInbound: async function (endpointPath, pubkey, limit) {
      d._calls.push({ endpointPath, pubkey, limit });
      return { rows: rows || [], total: total !== undefined ? total : (rows || []).length };
    },
  };
  Object.assign(d, overrides);
  return d;
}

function getBuilder(mod, name) {
  assert(mod && typeof mod[name] === 'function',
    `src/api/open-ranking/index.js must export an async \`${name}(input, deps)\` — the ORE-06/07 inbound feature is not ` +
    'implemented yet (ADR ore-parity/0002 §Implementation notes).');
  return mod[name];
}

function mockRes() {
  return {
    statusCode: 200, _headers: {}, body: undefined, ended: false,
    status(c) { this.statusCode = c; return this; },
    set(k, v) {
      if (k && typeof k === 'object') { for (const kk of Object.keys(k)) this._headers[kk.toLowerCase()] = k[kk]; }
      else { this._headers[String(k).toLowerCase()] = v; }
      return this;
    },
    get(k) { return this._headers[String(k).toLowerCase()]; },
    json(o) { this.body = o; this.ended = true; if (!this._headers['content-type']) this._headers['content-type'] = 'application/json; charset=utf-8'; return this; },
    end() { this.ended = true; return this; },
  };
}

// ===========================================================================
// STRUCTURAL
// ===========================================================================

test('S1: ORE module exports buildFollowers/buildMuters + handleFollowers/handleMuters (ADR ore-parity/0002)', () => {
  const mod = loadModule();
  assert(mod !== null, 'src/api/open-ranking/index.js does not load.');
  for (const fn of ['buildFollowers', 'buildMuters', 'handleFollowers', 'handleMuters']) {
    assert(typeof mod[fn] === 'function', `open-ranking/index.js must export \`${fn}\` (ADR ore-parity/0002).`);
  }
});

test('S2: the ORE module registers POST /followers and POST /muters (ADR ore-parity/0002 §Impl)', () => {
  const src = safeRead(MODULE_PATH);
  assert(/['"]\/followers['"]/.test(src), "src/api/open-ranking/index.js must register the route '/followers'.");
  assert(/['"]\/muters['"]/.test(src), "src/api/open-ranking/index.js must register the route '/muters'.");
});

// ===========================================================================
// CAPABILITY DOCUMENT (ORE-01 extension) — AC-1
// ===========================================================================

test('C1 (AC-1): capability doc advertises /followers and /muters (default = global graperank); existing entries unchanged', () => {
  const mod = loadModule();
  assert(mod && typeof mod.buildCapabilityDocument === 'function', 'buildCapabilityDocument missing — feature absent.');
  const doc = mod.buildCapabilityDocument(); // gate closed (default)
  for (const ep of ['/followers', '/muters']) {
    const algos = doc[ep];
    assert(Array.isArray(algos) && algos.length >= 1, `capability doc must advertise '${ep}' as a non-empty array.`);
    assert(algos[0].id === 'graperank', `the first/default algorithm for '${ep}' must be 'graperank'.`);
    assert(algos[0].pov === false || algos[0].pov === undefined, `'${ep}' graperank must be global (pov:false).`);
    assert(!algos.some((a) => a.pov === true), `no pov:true algorithm on '${ep}' — W12/ADR open-ranking/0005 gate.`);
  }
  // Sibling endpoints unchanged (AC-7 additive).
  assert(doc['/stats/pubkey'].length === 1, "'/stats/pubkey' still advertises only its global algorithm by default.");
  assert(mod.buildCapabilityDocument({ personalizedStats: true })['/stats/pubkey'].length === 2,
    'the personalized-stats gate still restores two stats algorithms.');
  assert(doc['/rank/pubkeys'].length >= 1, "'/rank/pubkeys' must remain advertised.");
  assert(doc['/search/pubkeys'].length >= 1, "'/search/pubkeys' must remain advertised.");
});

test('C2 (AC-1): the REAL open-ranking SDK validateCapabilities() accepts the grown document', async () => {
  const mod = loadModule();
  assert(mod && typeof mod.buildCapabilityDocument === 'function', 'buildCapabilityDocument missing — feature absent.');
  let sdk;
  try {
    sdk = await import('open-ranking');
  } catch (e) {
    throw new Error(
      "the `open-ranking` SDK devDependency is not installed — run `npm install` (exact-pinned 0.1.1, ADR ore-parity/0001 decision 6). " +
      `Import failed: ${e.message}`);
  }
  const endpointKeys = [
    sdk.ENDPOINT_STATS_PUBKEY, sdk.ENDPOINT_RANK_PUBKEYS, sdk.ENDPOINT_RECOMMEND_PUBKEYS,
    sdk.ENDPOINT_SEARCH_PUBKEYS, sdk.ENDPOINT_FOLLOWERS, sdk.ENDPOINT_MUTERS,
    sdk.ENDPOINT_COMPROMISED_PUBKEYS,
  ];
  const doc = mod.buildCapabilityDocument();
  // The doc must register the two new endpoints under the SDK's own path constants.
  assert(Array.isArray(doc[sdk.ENDPOINT_FOLLOWERS]) && doc[sdk.ENDPOINT_FOLLOWERS].length >= 1,
    'capability doc must register the SDK ENDPOINT_FOLLOWERS path (/followers).');
  assert(Array.isArray(doc[sdk.ENDPOINT_MUTERS]) && doc[sdk.ENDPOINT_MUTERS].length >= 1,
    'capability doc must register the SDK ENDPOINT_MUTERS path (/muters).');
  const parsed = {};
  for (const k of endpointKeys) parsed[k] = doc[k] || [];
  try {
    sdk.validateCapabilities(parsed);
  } catch (e) {
    throw new Error(`SDK validateCapabilities rejected the grown capability document: ${e.message}`);
  }
});

// ===========================================================================
// BUILDER BEHAVIOR (shared contract) — AC-2..AC-6
// ===========================================================================

test('B1 (AC-2): followers happy path -> 200 {results, total}; deps called once with (/followers, pubkey, 50); rank = round(influence*100); no ttl', async () => {
  const mod = loadModule();
  const build = getBuilder(mod, 'buildFollowers');
  const target = HEX('a');
  const deps = makeInboundDeps(
    [{ pubkey: HEX('1'), influence: 0.9 }, { pubkey: HEX('2'), influence: 0.416 }], 19470);
  const { httpStatus, body } = await build({ pubkey: target }, deps);
  assert(httpStatus === 200, 'expected 200.');
  assert(deps._calls.length === 1, 'fetchVerifiedInbound called exactly once.');
  assert(deps._calls[0].endpointPath === '/followers', 'endpointPath /followers forwarded.');
  assert(deps._calls[0].pubkey === target, 'target pubkey forwarded.');
  assert(deps._calls[0].limit === 50, 'default limit 50 forwarded (ADR decision 2).');
  assert(Array.isArray(body.results) && body.results.length === 2, 'two results.');
  assert(body.results[0].pubkey === HEX('1') && body.results[0].rank === 90, 'row 1 mapped (0.9 -> 90), query order preserved.');
  assert(body.results[1].pubkey === HEX('2') && body.results[1].rank === 42, 'row 2 mapped (0.416 -> 42, round not floor).');
  assert(body.total === 19470, 'total passed through, independent of the returned rows.');
  assert(!('ttl' in body), 'no ttl (ADR open-ranking/0004).');
});

test('B2 (AC-3): muters happy path — identical contract, deps called with /muters', async () => {
  const mod = loadModule();
  const build = getBuilder(mod, 'buildMuters');
  const deps = makeInboundDeps([{ pubkey: HEX('3'), influence: 1 }], 192);
  const { httpStatus, body } = await build({ pubkey: HEX('b') }, deps);
  assert(httpStatus === 200, 'expected 200.');
  assert(deps._calls[0].endpointPath === '/muters', 'endpointPath /muters forwarded.');
  assert(body.results.length === 1 && body.results[0].rank === 100, 'muter mapped (1 -> 100).');
  assert(body.total === 192, 'total passed through.');
  assert(!('ttl' in body), 'no ttl.');
});

test('B3 (AC-2): explicit valid limit forwarded; rows beyond limit are sliced off defensively', async () => {
  const mod = loadModule();
  const build = getBuilder(mod, 'buildFollowers');
  const deps = makeInboundDeps(
    [{ pubkey: HEX('1'), influence: 0.9 }, { pubkey: HEX('2'), influence: 0.5 }, { pubkey: HEX('3'), influence: 0.1 }], 3);
  const { body } = await build({ pubkey: HEX('a'), limit: 2 }, deps);
  assert(deps._calls[0].limit === 2, 'explicit limit forwarded to the fetch.');
  assert(body.results.length === 2, 'a deps result larger than limit is sliced to limit (builder owns ≤limit).');
  assert(body.results[0].pubkey === HEX('1') && body.results[1].pubkey === HEX('2'), 'top-ranked retained in order.');
  assert(body.total === 3, 'total unaffected by slicing.');
});

test('B4 (AC-3): missing/null influence floors to rank 0; malformed row without pubkey is dropped', async () => {
  const mod = loadModule();
  const build = getBuilder(mod, 'buildFollowers');
  const deps = makeInboundDeps([{ pubkey: HEX('4') }, { influence: 0.7 }], 2);
  const { body } = await build({ pubkey: HEX('a') }, deps);
  assert(body.results.length === 1, 'the pubkey-less row is dropped (every ORE result MUST carry a pubkey).');
  assert(body.results[0].pubkey === HEX('4') && body.results[0].rank === 0, 'influence-less row floors to rank 0.');
});

test('B5 (AC-4): unknown / verified-empty target -> 200 with results [] and total 0 (the no-404 posture)', async () => {
  const mod = loadModule();
  for (const name of ['buildFollowers', 'buildMuters']) {
    const build = getBuilder(mod, name);
    const deps = makeInboundDeps([], 0);
    const { httpStatus, body } = await build({ pubkey: HEX('f') }, deps);
    assert(httpStatus === 200, `${name}: unknown target must be 200, never 404 (story AC / ADR decision 5).`);
    assert(Array.isArray(body.results) && body.results.length === 0, `${name}: empty results.`);
    assert(body.total === 0, `${name}: total 0.`);
  }
});

test('B6 (AC-4): zero / negative / non-integer / non-numeric limit -> 422 + X-Reason, fetch not called', async () => {
  const mod = loadModule();
  const build = getBuilder(mod, 'buildFollowers');
  for (const bad of [0, -3, 2.5, 'x']) {
    const deps = makeInboundDeps();
    const { httpStatus, headers } = await build({ pubkey: HEX('a'), limit: bad }, deps);
    assert(httpStatus === 422, `limit ${JSON.stringify(bad)} must yield 422.`);
    assert(hget(headers, 'x-reason'), 'X-Reason present on limit error.');
    assert(deps._calls.length === 0, 'fetchVerifiedInbound must not be called on an invalid limit.');
  }
});

test('B7 (AC-4, ADR decision 2): limit over the provider max (1000) -> 422 (no ORE-03-style clamp); exactly 1000 is accepted', async () => {
  const mod = loadModule();
  const build = getBuilder(mod, 'buildFollowers');
  const depsOver = makeInboundDeps();
  const over = await build({ pubkey: HEX('a'), limit: 1001 }, depsOver);
  assert(over.httpStatus === 422, 'limit 1001 must yield 422 per the ORE-06/07 error table (not a silent clamp).');
  assert(hget(over.headers, 'x-reason'), 'X-Reason present.');
  assert(depsOver._calls.length === 0, 'fetch not called on over-max limit.');
  const depsMax = makeInboundDeps();
  const atMax = await build({ pubkey: HEX('a'), limit: 1000 }, depsMax);
  assert(atMax.httpStatus === 200 && depsMax._calls[0].limit === 1000, 'limit 1000 is within contract.');
});

test('B8 (AC-6): missing / non-string / invalid-hex / npub / uppercase pubkey -> 422 + X-Reason, fetch not called (both twins)', async () => {
  const mod = loadModule();
  const cases = [undefined, 42, 'zz'.repeat(32), 'npub1' + 'q'.repeat(59), HEX('A')];
  for (const name of ['buildFollowers', 'buildMuters']) {
    const build = getBuilder(mod, name);
    for (const bad of cases) {
      const deps = makeInboundDeps();
      const { httpStatus, headers } = await build({ pubkey: bad }, deps);
      assert(httpStatus === 422, `${name}: pubkey ${JSON.stringify(bad)} must yield 422.`);
      assert(hget(headers, 'x-reason'), 'X-Reason present on pubkey error.');
      assert(deps._calls.length === 0, 'fetch must not be called on invalid pubkey.');
    }
  }
});

test('B9 (AC-6): unsupported algorithm -> 422 naming the endpoint, fetch not called; explicit \'graperank\' -> 200', async () => {
  const mod = loadModule();
  for (const [name, ep] of [['buildFollowers', '/followers'], ['buildMuters', '/muters']]) {
    const build = getBuilder(mod, name);
    const deps = makeInboundDeps();
    const bad = await build({ pubkey: HEX('a'), algorithm: 'definitely-not-real' }, deps);
    assert(bad.httpStatus === 422, `${name}: unsupported algorithm -> 422.`);
    assert(String(hget(bad.headers, 'x-reason') || '').includes(ep), `X-Reason names ${ep}.`);
    assert(deps._calls.length === 0, 'fetch not called for unsupported algorithm.');
    const ok = await build({ pubkey: HEX('a'), algorithm: 'graperank' }, makeInboundDeps());
    assert(ok.httpStatus === 200, `${name}: explicit 'graperank' works.`);
  }
});

test('B10 (AC-6): a pov sent to the global algorithm is ignored -> 200 (ORE-01)', async () => {
  const mod = loadModule();
  const build = getBuilder(mod, 'buildFollowers');
  const deps = makeInboundDeps([{ pubkey: HEX('1'), influence: 0.2 }], 1);
  const { httpStatus } = await build({ pubkey: HEX('a'), pov: HEX('b') }, deps);
  assert(httpStatus === 200, 'pov ignored on the global algorithm.');
  assert(deps._calls.length === 1, 'the query still runs.');
});

test('B11 (AC-6, ORE-00 CORS): 200 and 422 carry Access-Control-Allow-Origin:* and application/json', async () => {
  const mod = loadModule();
  const build = getBuilder(mod, 'buildMuters');
  const ok = await build({ pubkey: HEX('a') }, makeInboundDeps());
  const bad = await build({ pubkey: 'nope' }, makeInboundDeps());
  assert(ok.httpStatus === 200 && bad.httpStatus === 422, 'statuses as expected.');
  for (const t of [ok, bad]) {
    assert(hget(t.headers, 'access-control-allow-origin') === '*', 'ACAO:* present.');
    assert(/application\/json/.test(hget(t.headers, 'content-type') || ''), 'json content-type present.');
  }
});

// ===========================================================================
// ERROR MIDDLEWARE (shared, now covering the new paths)
// ===========================================================================

test('E1 (AC-6): oreJsonErrorHandler maps body-parse errors on /followers and /muters to 400 + X-Reason + ACAO:*', () => {
  const mod = loadModule();
  assert(mod && typeof mod.oreJsonErrorHandler === 'function', 'oreJsonErrorHandler missing — feature absent.');
  for (const p of ['/followers', '/muters']) {
    const res = mockRes();
    const err = Object.assign(new SyntaxError('bad'), { type: 'entity.parse.failed', status: 400 });
    let nexted = false;
    mod.oreJsonErrorHandler(err, { path: p, method: 'POST' }, res, () => { nexted = true; });
    assert(res.statusCode === 400, `malformed JSON on ${p} must yield 400.`);
    assert(res.get('x-reason'), 'X-Reason present.');
    assert(res.get('access-control-allow-origin') === '*', 'ACAO:* present.');
    assert(nexted === false, 'handled here; next must not be called.');
  }
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
