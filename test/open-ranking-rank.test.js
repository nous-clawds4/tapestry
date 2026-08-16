/**
 * Story ore-parity #1: ORE-03 /rank/pubkeys (global).
 * ADR ore-parity/0001. See engineering-team/stories/ore-parity/1-rank-pubkeys.test-plan.md
 *
 * ADR 0001 chose Option A: a lean batch endpoint in src/api/open-ranking/ —
 * pure `buildRank(input, deps)` returning a {httpStatus, headers, body} triple,
 * deps = { fetchInfluences(pubkeys) -> Promise<[{pubkey, influence}]> } (the real
 * impl is one UNWIND Cypher over NostrUser.influence), registered in the ORE-01
 * capability registry. To stay hermetic (no live Neo4j), behavior is asserted
 * against the PURE builder with INJECTED deps (the seam from ADR open-ranking/0001):
 *
 *   buildRank({ pubkeys, algorithm, pov, limit }, deps) -> { httpStatus, headers, body }
 *   buildCapabilityDocument()                 (now also advertises /rank/pubkeys)
 *   oreJsonErrorHandler(err, req, res, next)  (ORE_PATHS now includes /rank/pubkeys)
 *   handleRankPubkeys (Express wrapper)
 *
 * C2 runs the REAL `open-ranking` SDK validator (exact-pinned devDependency,
 * ADR 0001 decision 6) over our capability document — the exact code path behind
 * npub.world's Validate button, whose rejection ("no algorithms registered in the
 * mandatory /rank/pubkeys") is the defect this story fixes.
 *
 * Stories open-ranking #1/#2 already shipped the module; these assert the
 * ore-parity #1 additions, so the pre-impl failure reads as "rank feature
 * absent", not a require crash. ALL tests FAIL pre-implementation and must PASS post.
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
// Distinct valid lowercase-hex pubkeys for bulk fixtures: 0-padded hex of i.
const pk = (i) => i.toString(16).padStart(64, '0');

/**
 * Default injected deps; override per-test. fetchInfluences is spied and answers
 * from an `influences` map (pubkey -> influence), defaulting to 0 — mirroring the
 * real UNWIND + OPTIONAL MATCH + COALESCE contract (every pubkey gets a row).
 */
function makeRankDeps(influences = {}, overrides = {}) {
  const d = {
    _calls: [],
    fetchInfluences: async function (pubkeys) {
      d._calls.push(pubkeys.slice());
      return pubkeys.map((p) => ({ pubkey: p, influence: influences[p] || 0 }));
    },
  };
  Object.assign(d, overrides);
  return d;
}

async function callBuildRank(mod, input, deps) {
  assert(mod && typeof mod.buildRank === 'function',
    'src/api/open-ranking/index.js must export an async `buildRank(input, deps)` — the ORE-03 rank feature is not ' +
    'implemented yet (ADR ore-parity/0001 §Implementation notes).');
  return mod.buildRank(input, deps);
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

test('S1: ORE module exports buildRank + handleRankPubkeys (ADR ore-parity/0001 §Impl / testability seam)', () => {
  const mod = loadModule();
  assert(mod !== null, 'src/api/open-ranking/index.js does not load.');
  for (const fn of ['buildRank', 'handleRankPubkeys']) {
    assert(typeof mod[fn] === 'function', `open-ranking/index.js must export \`${fn}\` (ADR ore-parity/0001).`);
  }
});

test('S2: the ORE module registers POST /rank/pubkeys (ADR ore-parity/0001 §Impl)', () => {
  const src = safeRead(MODULE_PATH);
  assert(/['"]\/rank\/pubkeys['"]/.test(src),
    "src/api/open-ranking/index.js must register the route '/rank/pubkeys'.");
});

// ===========================================================================
// CAPABILITY DOCUMENT (ORE-01 extension) — AC-1
// ===========================================================================

test('C1 (AC-1): capability doc advertises /rank/pubkeys (default = global graperank); stats/search entries unchanged', () => {
  const mod = loadModule();
  assert(mod && typeof mod.buildCapabilityDocument === 'function', 'buildCapabilityDocument missing — feature absent.');
  const doc = mod.buildCapabilityDocument(); // gate closed (default)
  const algos = doc['/rank/pubkeys'];
  assert(Array.isArray(algos) && algos.length >= 1,
    "capability doc must advertise '/rank/pubkeys' as a non-empty array (the SDK's mandatory-endpoint check).");
  assert(algos[0].id === 'graperank', "the first/default rank algorithm must be 'graperank'.");
  assert(algos[0].pov === false || algos[0].pov === undefined, "rank 'graperank' must be global (pov:false).");
  assert(!algos.some((a) => a.pov === true), 'no pov:true (personalized) rank algorithm — W12/ADR open-ranking/0005 gate.');
  // Sibling endpoints unchanged (AC-7 additive): stats keeps 1 algo gate-off / 2 gate-on; search stays advertised.
  assert(Array.isArray(doc['/stats/pubkey']) && doc['/stats/pubkey'].length === 1,
    "'/stats/pubkey' must remain advertised with only its global algorithm by default.");
  assert(mod.buildCapabilityDocument({ personalizedStats: true })['/stats/pubkey'].length === 2,
    "opening the personalized-stats gate must still restore '/stats/pubkey' to two algorithms.");
  assert(Array.isArray(doc['/search/pubkeys']) && doc['/search/pubkeys'].length >= 1,
    "'/search/pubkeys' must remain advertised.");
});

test('C2 (AC-1): the REAL open-ranking SDK validateCapabilities() accepts our document (npub.world Validate path)', async () => {
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
  // Replay the client's fetch->parse->validate path: parseCapabilities defaults
  // every absent endpoint key to [] (js-sdk index.js ~324-332), then validates.
  const endpointKeys = [
    sdk.ENDPOINT_STATS_PUBKEY, sdk.ENDPOINT_RANK_PUBKEYS, sdk.ENDPOINT_RECOMMEND_PUBKEYS,
    sdk.ENDPOINT_SEARCH_PUBKEYS, sdk.ENDPOINT_FOLLOWERS, sdk.ENDPOINT_MUTERS,
    sdk.ENDPOINT_COMPROMISED_PUBKEYS,
  ];
  for (const opts of [undefined, { personalizedStats: true }]) {
    const doc = mod.buildCapabilityDocument(opts);
    const parsed = {};
    for (const k of endpointKeys) parsed[k] = doc[k] || [];
    try {
      sdk.validateCapabilities(parsed);
    } catch (e) {
      throw new Error(
        `SDK validateCapabilities rejected our capability document (${opts ? 'gate-on' : 'gate-off'}): ${e.message} — ` +
        'this is exactly what npub.world\'s Validate button reports against the R&D instances.');
    }
  }
});

// ===========================================================================
// buildRank BEHAVIOR (ORE-03) — AC-2..AC-6
// ===========================================================================

test('B1 (AC-2/AC-3): batch happy path -> 200, every pubkey ranked once, sorted rank desc, rank = round(influence*100), no ttl', async () => {
  const mod = loadModule();
  const [a, b, c] = [HEX('a'), HEX('b'), HEX('c')];
  const deps = makeRankDeps({ [a]: 0.9, [b]: 0.3 }); // c unknown -> 0
  const { httpStatus, body } = await callBuildRank(mod, { pubkeys: [c, a, b] }, deps);
  assert(httpStatus === 200, 'expected 200.');
  assert(Array.isArray(body.results), 'body.results must be an array.');
  assert(body.results.length === 3, 'every requested pubkey appears (limit defaults to the request count).');
  assert(body.results[0].pubkey === a && body.results[0].rank === 90, 'highest influence first (0.9 -> 90).');
  assert(body.results[1].pubkey === b && body.results[1].rank === 30, 'then 0.3 -> 30.');
  assert(body.results[2].pubkey === c && body.results[2].rank === 0, 'unknown pubkey still ranked, floor 0.');
  assert(!('ttl' in body), 'body must not carry ttl (ADR open-ranking/0004; story AC amended at the Architecture gate).');
  assert(deps._calls.length === 1, 'fetchInfluences called exactly once (one batch).');
  const seen = new Set(body.results.map((r) => r.pubkey));
  assert(seen.size === 3, 'each pubkey exactly once.');
  for (const r of body.results) {
    assert(typeof r.pubkey === 'string' && typeof r.rank === 'number', 'each result has a string pubkey + numeric rank.');
  }
});

test('B2 (AC-3): fractional influence rounds to nearest integer; a pubkey missing from the deps rows still appears with rank 0', async () => {
  const mod = loadModule();
  const [a, b] = [HEX('1'), HEX('2')];
  const deps = makeRankDeps({}, {
    // Deliberately drop b from the returned rows: the builder owns the
    // every-requested-pubkey contract (ORE-03), whatever the deps return.
    fetchInfluences: async (pubkeys) => { deps._calls.push(pubkeys.slice()); return [{ pubkey: a, influence: 0.416 }]; },
  });
  deps._calls = [];
  const { body } = await callBuildRank(mod, { pubkeys: [a, b] }, deps);
  assert(body.results.length === 2, 'both requested pubkeys present even though deps returned one row.');
  assert(body.results[0].pubkey === a && body.results[0].rank === 42, '0.416 -> 42 (round, not floor).');
  assert(body.results[1].pubkey === b && body.results[1].rank === 0, 'row-less pubkey gets floor rank 0.');
});

test('B3 (AC-2, ADR decision 3): ties keep first-occurrence request order (deterministic stable sort)', async () => {
  const mod = loadModule();
  const [x, y, z] = [HEX('3'), HEX('4'), HEX('5')];
  const deps = makeRankDeps({ [x]: 0.5, [y]: 0.5, [z]: 0.9 });
  const { body } = await callBuildRank(mod, { pubkeys: [x, y, z] }, deps);
  assert(body.results[0].pubkey === z, 'highest rank first.');
  assert(body.results[1].pubkey === x && body.results[2].pubkey === y,
    'tied ranks preserve request order (x before y).');
});

test('B4 (AC-2, ADR decision 2): duplicate entries collapse — fetch sees the deduped set; each pubkey once; default limit = deduped count', async () => {
  const mod = loadModule();
  const [a, b] = [HEX('6'), HEX('7')];
  const deps = makeRankDeps({ [a]: 0.2 });
  const { httpStatus, body } = await callBuildRank(mod, { pubkeys: [a, b, a, a] }, deps);
  assert(httpStatus === 200, 'expected 200.');
  assert(deps._calls.length === 1 && deps._calls[0].length === 2, 'fetchInfluences receives the deduplicated set.');
  assert(deps._calls[0][0] === a && deps._calls[0][1] === b, 'dedupe keeps first-occurrence order.');
  assert(body.results.length === 2, 'default limit is the DEDUPED count (2), not the raw entry count (4).');
  assert(new Set(body.results.map((r) => r.pubkey)).size === 2, 'each pubkey exactly once.');
});

test('B5 (AC-4): explicit limit truncates to the top-ranked; a limit above the count silently clamps', async () => {
  const mod = loadModule();
  const [a, b] = [HEX('8'), HEX('9')];
  const deps1 = makeRankDeps({ [a]: 0.1, [b]: 0.8 });
  const one = await callBuildRank(mod, { pubkeys: [a, b], limit: 1 }, deps1);
  assert(one.httpStatus === 200 && one.body.results.length === 1, 'limit 1 -> exactly one result.');
  assert(one.body.results[0].pubkey === b, 'the retained result is the top-ranked one.');
  const big = await callBuildRank(mod, { pubkeys: [a, b], limit: 50 }, makeRankDeps());
  assert(big.httpStatus === 200 && big.body.results.length === 2,
    'limit 50 over a 2-pubkey request silently clamps to 2 (ORE-03), no error.');
});

test('B6 (AC-4): zero / negative / non-integer / non-numeric limit -> 422 + X-Reason, fetch not called', async () => {
  const mod = loadModule();
  for (const bad of [0, -3, 2.5, 'x']) {
    const deps = makeRankDeps();
    const { httpStatus, headers } = await callBuildRank(mod, { pubkeys: [HEX('a')], limit: bad }, deps);
    assert(httpStatus === 422, `limit ${JSON.stringify(bad)} must yield 422.`);
    assert(hget(headers, 'x-reason'), 'X-Reason present on limit error.');
    assert(deps._calls.length === 0, 'fetchInfluences must not be called on an invalid limit.');
  }
});

test('B7 (AC-6): missing / empty / non-array / invalid-entry pubkeys -> 422 + X-Reason, fetch not called (ORE-00 hex MUST)', async () => {
  const mod = loadModule();
  const good = HEX('a');
  const cases = [
    undefined,                                   // missing
    [],                                          // empty
    'not-an-array',                              // wrong type
    [good, 'zz'.repeat(32)],                     // non-hex entry
    [good, 'npub1' + 'q'.repeat(59)],            // bech32 entry (ORE-00 forbids npub)
    [good, HEX('A')],                            // uppercase hex entry
    [good, 42],                                  // non-string entry
  ];
  for (const bad of cases) {
    const deps = makeRankDeps();
    const { httpStatus, headers } = await callBuildRank(mod, { pubkeys: bad }, deps);
    assert(httpStatus === 422, `pubkeys ${JSON.stringify(bad)} must yield 422 (whole-request reject, ADR decision 5).`);
    assert(hget(headers, 'x-reason'), 'X-Reason present on pubkeys error.');
    assert(deps._calls.length === 0, 'fetchInfluences must not be called on invalid pubkeys.');
  }
});

test('B8 (AC-5, ADR decision 4): more than 1000 entries -> 413 (counted pre-dedup); exactly 1000 stays 200', async () => {
  const mod = loadModule();
  const over = Array.from({ length: 1001 }, (_, i) => pk(i + 1));
  const deps1 = makeRankDeps();
  const r1 = await callBuildRank(mod, { pubkeys: over }, deps1);
  assert(r1.httpStatus === 413, '1001 distinct pubkeys must yield 413.');
  assert(hget(r1.headers, 'x-reason'), 'X-Reason present on 413.');
  assert(deps1._calls.length === 0, 'fetchInfluences must not be called on an over-max request.');

  const dupes = Array.from({ length: 1001 }, () => HEX('a'));
  const deps2 = makeRankDeps();
  const r2 = await callBuildRank(mod, { pubkeys: dupes }, deps2);
  assert(r2.httpStatus === 413, 'the cap counts RAW entries (pre-dedup): 1001 duplicates still 413.');

  const atMax = Array.from({ length: 1000 }, (_, i) => pk(i + 1));
  const deps3 = makeRankDeps();
  const r3 = await callBuildRank(mod, { pubkeys: atMax }, deps3);
  assert(r3.httpStatus === 200, 'exactly 1000 pubkeys is within contract -> 200.');
  assert(r3.body.results.length === 1000, 'all 1000 ranked.');
});

test('B9 (AC-6): unsupported algorithm -> 422 + X-Reason, fetch not called; explicit \'graperank\' -> 200', async () => {
  const mod = loadModule();
  const deps = makeRankDeps();
  const bad = await callBuildRank(mod, { pubkeys: [HEX('a')], algorithm: 'definitely-not-real' }, deps);
  assert(bad.httpStatus === 422, 'unsupported algorithm -> 422.');
  assert(hget(bad.headers, 'x-reason'), 'X-Reason present.');
  assert(deps._calls.length === 0, 'fetchInfluences must not be called for an unsupported algorithm.');
  const ok = await callBuildRank(mod, { pubkeys: [HEX('a')], algorithm: 'graperank' }, makeRankDeps());
  assert(ok.httpStatus === 200, "explicitly requesting the default 'graperank' works.");
});

test('B10 (AC-6): a pov sent to the global rank algorithm is ignored -> 200 (ORE-01)', async () => {
  const mod = loadModule();
  const deps = makeRankDeps();
  const { httpStatus } = await callBuildRank(mod, { pubkeys: [HEX('a')], pov: HEX('b') }, deps);
  assert(httpStatus === 200, 'a pov on the global algorithm is ignored, returns 200.');
  assert(deps._calls.length === 1, 'ranking is still performed.');
});

test('B11 (AC-6, ORE-00 CORS): 200, 422, and 413 all carry Access-Control-Allow-Origin:* and application/json', async () => {
  const mod = loadModule();
  const ok = await callBuildRank(mod, { pubkeys: [HEX('a')] }, makeRankDeps());
  const invalid = await callBuildRank(mod, { pubkeys: [] }, makeRankDeps());
  const tooBig = await callBuildRank(mod, { pubkeys: Array.from({ length: 1001 }, (_, i) => pk(i + 1)) }, makeRankDeps());
  assert(ok.httpStatus === 200 && invalid.httpStatus === 422 && tooBig.httpStatus === 413, 'statuses as expected.');
  for (const t of [ok, invalid, tooBig]) {
    assert(hget(t.headers, 'access-control-allow-origin') === '*', 'ACAO:* present.');
    assert(/application\/json/.test(hget(t.headers, 'content-type') || ''), 'json content-type present.');
  }
});

// ===========================================================================
// ERROR MIDDLEWARE (shared, now covering the new path)
// ===========================================================================

test('E1 (AC-6): oreJsonErrorHandler maps a body-parse error on /rank/pubkeys to 400 + X-Reason + ACAO:* (ORE_PATHS includes the new path)', () => {
  const mod = loadModule();
  assert(mod && typeof mod.oreJsonErrorHandler === 'function', 'oreJsonErrorHandler missing — feature absent.');
  const res = mockRes();
  const err = Object.assign(new SyntaxError('bad'), { type: 'entity.parse.failed', status: 400 });
  let nexted = false;
  mod.oreJsonErrorHandler(err, { path: '/rank/pubkeys', method: 'POST' }, res, () => { nexted = true; });
  assert(res.statusCode === 400, 'malformed JSON on /rank/pubkeys must yield 400.');
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
