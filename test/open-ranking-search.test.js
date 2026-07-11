/**
 * Story open-ranking #2: ORE-05 /search/pubkeys (global only).
 * ADR open-ranking/0002. See engineering-team/stories/open-ranking/2-search-pubkeys-global.test-plan.md
 *
 * ADR 0002 chose Option A: ORE-05 calls nostr-search-api directly with a
 * `sort=wot_rank_<ownerSuffix>:desc`, mapping profile hits → {pubkey, rank}.
 * To stay hermetic (no live Meili / nostr-search-api), behavior is asserted
 * against the PURE builder with INJECTED deps (the seam from ADR 0001/0002):
 *
 *   buildSearch({ query, algorithm, pov, limit }, deps) -> { httpStatus, headers, body }
 *        deps = { ownerSuffix, searchProfiles(query, limit, suffix) -> Promise<hit[]> }
 *   buildCapabilityDocument()                 (now also advertises /search/pubkeys)
 *   oreJsonErrorHandler(err, req, res, next)  (ORE_PATHS now includes /search/pubkeys)
 *   handleSearchPubkeys (Express wrapper)
 *
 * Story 1 already shipped the module; these assert the Story-2 additions, so the
 * pre-impl failure reads as "search feature absent", not a require crash.
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
const OWNER_SUFFIX = 'aaaaaaaa';                  // 8-char owner-POV suffix (injected)
const RANK_FIELD = `wot_rank_${OWNER_SUFFIX}`;

// A representative nostr-search-api profile hit (the shape buildSearch maps from).
function hit(overrides = {}) {
  return { pubkey: HEX('1'), name: 'someone', [RANK_FIELD]: 42, ...overrides };
}

// Default injected deps; override per-test. searchProfiles is spied.
function makeSearchDeps(overrides = {}) {
  const d = {
    ownerSuffix: OWNER_SUFFIX,
    _searchCalls: [],
    searchProfiles: async function (query, limit, suffix) {
      d._searchCalls.push({ query, limit, suffix });
      return [
        hit({ pubkey: HEX('1'), [RANK_FIELD]: 90 }),
        hit({ pubkey: HEX('2'), [RANK_FIELD]: 30 }),
      ];
    },
  };
  Object.assign(d, overrides);
  return d;
}

async function callBuildSearch(mod, input, deps) {
  assert(mod && typeof mod.buildSearch === 'function',
    'src/api/open-ranking/index.js must export an async `buildSearch(input, deps)` — the ORE-05 search feature is not ' +
    'implemented yet (ADR open-ranking/0002 §Implementation notes / §Testability seam).');
  return mod.buildSearch(input, deps);
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

test('S1: ORE module exports buildSearch + handleSearchPubkeys (ADR 0002 §Impl / testability seam)', () => {
  const mod = loadModule();
  assert(mod !== null, 'src/api/open-ranking/index.js does not load.');
  for (const fn of ['buildSearch', 'handleSearchPubkeys']) {
    assert(typeof mod[fn] === 'function', `open-ranking/index.js must export \`${fn}\` (ADR 0002).`);
  }
});

test('S2: the ORE module registers POST /search/pubkeys (ADR 0002 §Impl)', () => {
  const src = safeRead(MODULE_PATH);
  assert(/['"]\/search\/pubkeys['"]/.test(src),
    "src/api/open-ranking/index.js must register the route '/search/pubkeys'.");
});

// ===========================================================================
// CAPABILITY DOCUMENT (ORE-01 extension)
// ===========================================================================

test('C1: capability doc now advertises /search/pubkeys and keeps /stats/pubkey (AC-1)', () => {
  const mod = loadModule();
  assert(mod && typeof mod.buildCapabilityDocument === 'function', 'buildCapabilityDocument missing — feature absent.');
  const doc = mod.buildCapabilityDocument(); // gate closed (default)
  assert(Array.isArray(doc['/search/pubkeys']) && doc['/search/pubkeys'].length >= 1,
    "capability doc must advertise '/search/pubkeys' as a non-empty array.");
  // '/stats/pubkey' stays advertised; personalized is gated OFF by default now
  // (ADR open-ranking/0005 / W12), so the default doc lists only the global algo.
  assert(Array.isArray(doc['/stats/pubkey']) && doc['/stats/pubkey'].length === 1,
    "'/stats/pubkey' must remain advertised with its global algorithm (personalized gated off by default).");
  assert(mod.buildCapabilityDocument({ personalizedStats: true })['/stats/pubkey'].length === 2,
    "opening the gate must restore '/stats/pubkey' to its two algorithms.");
});

test('C2: /search/pubkeys default is global graperank (pov:false); no personalized search algo in v1 (AC-1)', () => {
  const mod = loadModule();
  const algos = mod.buildCapabilityDocument()['/search/pubkeys'];
  assert(algos[0].id === 'graperank', "the first/default search algorithm must be 'graperank'.");
  assert(algos[0].pov === false || algos[0].pov === undefined, "search 'graperank' must be global (pov:false).");
  assert(!algos.some((a) => a.pov === true), 'no pov:true (personalized) search algorithm in v1 — deferred to Story 3.');
});

// ===========================================================================
// buildSearch BEHAVIOR (ORE-05)
// ===========================================================================

test('B1 (AC: search happy path): non-empty query, no algorithm -> 200 {results,ttl}; searchProfiles(query, 20, ownerSuffix)', async () => {
  const mod = loadModule();
  const deps = makeSearchDeps();
  const { httpStatus, body } = await callBuildSearch(mod, { query: 'jack' }, deps);
  assert(httpStatus === 200, 'expected 200.');
  assert(Array.isArray(body.results), 'body.results must be an array.');
  assert(!('ttl' in body), 'body must not carry ttl (ADR 0004 dropped it).');
  assert(deps._searchCalls.length === 1, 'searchProfiles must be called exactly once.');
  assert(deps._searchCalls[0].query === 'jack', 'query forwarded to searchProfiles.');
  assert(deps._searchCalls[0].limit === 20, 'default limit 20 forwarded.');
  assert(deps._searchCalls[0].suffix === OWNER_SUFFIX, 'owner suffix forwarded.');
});

test('B2 (AC: result mapping): results are {pubkey, rank}; rank from wot_rank_<ownerSuffix>; order preserved', async () => {
  const mod = loadModule();
  const deps = makeSearchDeps({ searchProfiles: async () => [
    hit({ pubkey: HEX('2'), [RANK_FIELD]: 90 }),
    hit({ pubkey: HEX('3'), [RANK_FIELD]: 30 }),
  ] });
  const { body } = await callBuildSearch(mod, { query: 'x' }, deps);
  assert(body.results.length === 2, 'two results.');
  assert(body.results[0].pubkey === HEX('2') && body.results[0].rank === 90, 'first result mapped.');
  assert(body.results[1].pubkey === HEX('3') && body.results[1].rank === 30, 'second result mapped.');
  for (const r of body.results) {
    assert(typeof r.pubkey === 'string' && typeof r.rank === 'number', 'each result has a string pubkey + numeric rank.');
  }
});

test('B3 (AC: rank floor): a hit with no wot_rank_<ownerSuffix> gets rank 0 (ORE no-404 floor)', async () => {
  const mod = loadModule();
  const deps = makeSearchDeps({ searchProfiles: async () => [ { pubkey: HEX('4'), name: 'unscored' } ] });
  const { body } = await callBuildSearch(mod, { query: 'x' }, deps);
  assert(body.results[0].rank === 0, 'unscored profile gets rank 0.');
});

test('B4 (AC: pubkey field): falls back to hit.id when hit.pubkey is absent', async () => {
  const mod = loadModule();
  const deps = makeSearchDeps({ searchProfiles: async () => [ { id: HEX('5'), [RANK_FIELD]: 10 } ] });
  const { body } = await callBuildSearch(mod, { query: 'x' }, deps);
  assert(body.results[0].pubkey === HEX('5'), 'pubkey taken from hit.id when hit.pubkey missing.');
});

test('B5 (AC: limit): an explicit valid limit is forwarded to searchProfiles', async () => {
  const mod = loadModule();
  const deps = makeSearchDeps();
  await callBuildSearch(mod, { query: 'x', limit: 5 }, deps);
  assert(deps._searchCalls[0] && deps._searchCalls[0].limit === 5, 'explicit limit forwarded.');
});

test('B6 (AC: limit validation): non-positive / non-integer / over-max -> 422 + X-Reason, search not called', async () => {
  const mod = loadModule();
  for (const bad of [0, -3, 2.5, 201, 'x']) {
    const deps = makeSearchDeps();
    const { httpStatus, headers } = await callBuildSearch(mod, { query: 'x', limit: bad }, deps);
    assert(httpStatus === 422, `limit ${JSON.stringify(bad)} must yield 422.`);
    assert(hget(headers, 'x-reason'), 'X-Reason present on limit error.');
    assert(deps._searchCalls.length === 0, 'searchProfiles must not be called on an invalid limit.');
  }
});

test('B7 (AC: query validation): missing/empty/whitespace/too-long/non-string -> 422 + X-Reason, search not called', async () => {
  const mod = loadModule();
  const longQ = 'a'.repeat(513);
  for (const bad of [undefined, '', '   ', longQ, 123]) {
    const deps = makeSearchDeps();
    const { httpStatus, headers } = await callBuildSearch(mod, { query: bad }, deps);
    assert(httpStatus === 422, `query ${JSON.stringify(bad)} must yield 422.`);
    assert(hget(headers, 'x-reason'), 'X-Reason present on query error.');
    assert(deps._searchCalls.length === 0, 'searchProfiles must not be called on an invalid query.');
  }
});

test('B8 (AC: conventions): unsupported algorithm -> 422 + X-Reason, search not called', async () => {
  const mod = loadModule();
  const deps = makeSearchDeps();
  const { httpStatus, headers } = await callBuildSearch(mod, { query: 'x', algorithm: 'definitely-not-real' }, deps);
  assert(httpStatus === 422, 'unsupported algorithm -> 422.');
  assert(hget(headers, 'x-reason'), 'X-Reason present.');
  assert(deps._searchCalls.length === 0, 'searchProfiles must not be called for an unsupported algorithm.');
});

test('B9 (AC: conventions): a pov sent to the global search algorithm is ignored -> 200', async () => {
  const mod = loadModule();
  const deps = makeSearchDeps();
  const { httpStatus } = await callBuildSearch(mod, { query: 'x', algorithm: 'graperank', pov: HEX('b') }, deps);
  assert(httpStatus === 200, 'a pov on the global algorithm is ignored, returns 200.');
  assert(deps._searchCalls.length === 1, 'search is still performed.');
});

test('B10 (ORE-00 CORS): both 200 and 422 carry Access-Control-Allow-Origin:* and application/json', async () => {
  const mod = loadModule();
  const ok = await callBuildSearch(mod, { query: 'x' }, makeSearchDeps());
  const bad = await callBuildSearch(mod, { query: '' }, makeSearchDeps());
  for (const t of [ok, bad]) {
    assert(hget(t.headers, 'access-control-allow-origin') === '*', 'ACAO:* present.');
    assert(/application\/json/.test(hget(t.headers, 'content-type') || ''), 'json content-type present.');
  }
});

test('B11 (AC: rank): wot_rank value is rounded to the nearest integer', async () => {
  const mod = loadModule();
  const deps = makeSearchDeps({ searchProfiles: async () => [ { pubkey: HEX('6'), [RANK_FIELD]: 41.6 } ] });
  const { body } = await callBuildSearch(mod, { query: 'x' }, deps);
  assert(body.results[0].rank === 42, 'rank rounded to nearest integer.');
});

test('B12 (AC: no ttl, ADR 0004): the search response carries no ttl', async () => {
  const mod = loadModule();
  const { body } = await callBuildSearch(mod, { query: 'x' }, makeSearchDeps());
  assert(!('ttl' in body), 'search response must not carry ttl (ADR 0004).');
});

test('B13 (AC: profiles only): a hit lacking both pubkey and id is excluded from results', async () => {
  const mod = loadModule();
  const deps = makeSearchDeps({ searchProfiles: async () => [
    { name: 'malformed-no-id', [RANK_FIELD]: 50 },
    hit({ pubkey: HEX('7'), [RANK_FIELD]: 10 }),
  ] });
  const { body } = await callBuildSearch(mod, { query: 'x' }, deps);
  assert(body.results.length === 1, 'the malformed (id-less) hit must be dropped.');
  assert(body.results[0].pubkey === HEX('7'), 'only the valid hit remains.');
  for (const r of body.results) {
    assert(typeof r.pubkey === 'string' && r.pubkey.length > 0, 'every result carries a non-empty pubkey.');
  }
});

// ===========================================================================
// ERROR MIDDLEWARE (shared, now covering the new path)
// ===========================================================================

test('E1: oreJsonErrorHandler maps a body-parse error on /search/pubkeys to 400 + X-Reason + ACAO:* (ORE_PATHS includes the new path)', () => {
  const mod = loadModule();
  assert(mod && typeof mod.oreJsonErrorHandler === 'function', 'oreJsonErrorHandler missing — feature absent.');
  const res = mockRes();
  const err = Object.assign(new SyntaxError('bad'), { type: 'entity.parse.failed', status: 400 });
  let nexted = false;
  mod.oreJsonErrorHandler(err, { path: '/search/pubkeys', method: 'POST' }, res, () => { nexted = true; });
  assert(res.statusCode === 400, 'malformed JSON on /search/pubkeys must yield 400.');
  assert(res.get('x-reason'), 'X-Reason present.');
  assert(res.get('access-control-allow-origin') === '*', 'ACAO:* present.');
  assert(nexted === false, 'handled here; next must not be called.');
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
