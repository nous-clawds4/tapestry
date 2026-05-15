/**
 * Story #8: GR-Community scoring + Communities REST API (Slice 2).
 *
 * Two test surfaces:
 *  - Algorithm correctness: import the pure function and feed it
 *    synthetic graphs with known steady-state scores.
 *  - REST contract: source-regex assertions against the handler /
 *    data-source / openapi files.
 *
 * Live behavior against real strfry/Neo4j deferred to staging smoke
 * per ADR §"Verification on real data".
 *
 * See engineering-team/stories/8-gr-community-scoring-and-api.test-plan.md
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const ALGO_DIR = path.join(ROOT, 'src/algos/grCommunity');
const API_DIR = path.join(ROOT, 'src/api/communities');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

/* ────────────────────────────────────────────────────────────
 * Algorithm correctness (T1–T13)
 * ──────────────────────────────────────────────────────────── */

function loadAlgo() {
  delete require.cache[require.resolve(path.join(ALGO_DIR, 'index.js'))];
  return require(path.join(ALGO_DIR, 'index.js'));
}

test('T1: seeds appear in the result map with score 1.0 regardless of how the rest of the graph votes', () => {
  const { computeGrCommunityScores } = loadAlgo();
  const { scores } = computeGrCommunityScores({
    seeds: ['A', 'B'],
    endorsements: [{ rater: 'C', target: 'A' }],
    vetoes: [{ rater: 'D', target: 'A' }],
    baselineGr: { A: 0.8, B: 0.8, C: 0.5, D: 0.5 },
  });
  assert.strictEqual(scores.get('A'), 1, 'seed A must score 1');
  assert.strictEqual(scores.get('B'), 1, 'seed B must score 1');
});

test('T2: endorsement from a rater with baselineGr=0 contributes zero weight (gate 1 fails)', () => {
  const { computeGrCommunityScores } = loadAlgo();
  // Only a baseline-0 bot endorses target T. Without seed lift, T should not become a member.
  const { scores } = computeGrCommunityScores({
    seeds: ['A'],
    endorsements: [{ rater: 'BOT', target: 'T' }],
    vetoes: [],
    baselineGr: { A: 0.9, BOT: 0.0, T: 0.1 },
  });
  const tScore = scores.get('T') || 0;
  assert(tScore < 0.5,
    `bot-only endorsement must not lift target above threshold; got T score ${tScore}`);
});

test('T3: endorsement from a rater whose community_gr converges to 0 contributes zero weight (gate 2 fails)', () => {
  const { computeGrCommunityScores } = loadAlgo();
  // OUTSIDER has high baseline but no seed endorsement → community_gr → 0.
  // OUTSIDER alone endorses T; T should not lift.
  const { scores } = computeGrCommunityScores({
    seeds: ['A'],
    endorsements: [{ rater: 'OUTSIDER', target: 'T' }],
    vetoes: [],
    baselineGr: { A: 0.9, OUTSIDER: 0.95, T: 0.5 },
  });
  const tScore = scores.get('T') || 0;
  assert(tScore < 0.5,
    `outsider-only endorsement must not lift target above threshold; got T score ${tScore}`);
});

test('T4: equal-weight endorse + veto on the same target yields score below threshold', () => {
  const { computeGrCommunityScores } = loadAlgo();
  // Seed S endorses M (member). Then M endorses T and M' vetoes T with equal weights.
  // Set up so that M and M' both reach the same community_gr.
  const { scores } = computeGrCommunityScores({
    seeds: ['S'],
    endorsements: [
      { rater: 'S', target: 'M' },
      { rater: 'S', target: 'N' },
      { rater: 'M', target: 'T' },
    ],
    vetoes: [
      { rater: 'N', target: 'T' },
    ],
    baselineGr: { S: 0.9, M: 0.7, N: 0.7, T: 0.5 },
  });
  const tScore = scores.get('T') || 0;
  assert(tScore < 0.5,
    `balanced endorse+veto must leave target below threshold; got T score ${tScore}`);
});

test('T5: calling the function twice with the same input returns equal Map results', () => {
  const { computeGrCommunityScores } = loadAlgo();
  const input = {
    seeds: ['A', 'B'],
    endorsements: [
      { rater: 'A', target: 'C' },
      { rater: 'B', target: 'C' },
      { rater: 'C', target: 'D' },
    ],
    vetoes: [],
    baselineGr: { A: 0.9, B: 0.8, C: 0.5, D: 0.5 },
  };
  const r1 = computeGrCommunityScores(input);
  const r2 = computeGrCommunityScores(input);
  for (const [key, val] of r1.scores) {
    assert(Math.abs(val - (r2.scores.get(key) || 0)) < 1e-9,
      `purity violation: score for ${key} differs between calls (${val} vs ${r2.scores.get(key)})`);
  }
  assert.strictEqual(r1.scores.size, r2.scores.size,
    'purity violation: result Maps have different sizes');
});

test('T6: function converges within maxIterations on a 50-node synthetic graph', () => {
  const { computeGrCommunityScores } = loadAlgo();
  // Build a small densely-connected graph: 5 seeds, 45 non-seeds, each non-seed
  // endorsed by 3 seeds + 3 non-seeds.
  const seeds = Array.from({ length: 5 }, (_, i) => `seed-${i}`);
  const nonSeeds = Array.from({ length: 45 }, (_, i) => `m-${i}`);
  const baselineGr = {};
  for (const s of seeds) baselineGr[s] = 0.9;
  for (const m of nonSeeds) baselineGr[m] = 0.6;
  const endorsements = [];
  for (let i = 0; i < nonSeeds.length; i++) {
    const target = nonSeeds[i];
    endorsements.push({ rater: seeds[i % seeds.length], target });
    endorsements.push({ rater: seeds[(i + 1) % seeds.length], target });
    endorsements.push({ rater: seeds[(i + 2) % seeds.length], target });
    endorsements.push({ rater: nonSeeds[(i + 1) % nonSeeds.length], target });
    endorsements.push({ rater: nonSeeds[(i + 5) % nonSeeds.length], target });
    endorsements.push({ rater: nonSeeds[(i + 10) % nonSeeds.length], target });
  }
  const { iterations } = computeGrCommunityScores({
    seeds, endorsements, vetoes: [], baselineGr,
    options: { maxIterations: 60, convergenceThreshold: 0.001 },
  });
  assert(iterations < 60,
    `function should converge before maxIterations on a well-shaped graph; ran ${iterations} iterations`);
});

test('T7: function throws when options.weightingModel is not "gr-community-default-v1"', () => {
  const { computeGrCommunityScores } = loadAlgo();
  let threw = false;
  try {
    computeGrCommunityScores({
      seeds: ['A'], endorsements: [], vetoes: [], baselineGr: {},
      options: { weightingModel: 'something-else' },
    });
  } catch {
    threw = true;
  }
  assert(threw, 'function must throw on unknown weightingModel');
});

test('T8: self-endorsement (rater === target) does not contribute to score', () => {
  const { computeGrCommunityScores } = loadAlgo();
  // T endorses themselves only. Should not lift.
  const { scores } = computeGrCommunityScores({
    seeds: ['A'],
    endorsements: [{ rater: 'T', target: 'T' }],
    vetoes: [],
    baselineGr: { A: 0.9, T: 0.9 },
  });
  const tScore = scores.get('T') || 0;
  assert(tScore < 0.5,
    `self-endorsement must not lift target; got T score ${tScore}`);
});

test('T9: 200-member synthetic graph with 800 signals computes in under 50ms', () => {
  const { computeGrCommunityScores } = loadAlgo();
  const seeds = Array.from({ length: 5 }, (_, i) => `s-${i}`);
  const members = Array.from({ length: 195 }, (_, i) => `m-${i}`);
  const baselineGr = {};
  for (const s of seeds) baselineGr[s] = 0.9;
  for (const m of members) baselineGr[m] = 0.5 + (parseInt(m.slice(2), 10) % 5) * 0.1;
  // 800 signals: each member endorsed by ~4 random others.
  const endorsements = [];
  for (let i = 0; i < 800; i++) {
    const target = members[i % members.length];
    const raterPool = i % 3 === 0 ? seeds : members;
    const rater = raterPool[(i * 7) % raterPool.length];
    if (rater !== target) endorsements.push({ rater, target });
  }
  const t0 = process.hrtime.bigint();
  computeGrCommunityScores({ seeds, endorsements, vetoes: [], baselineGr });
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
  assert(elapsedMs < 50,
    `performance ceiling: 200 members + 800 signals must finish in <50ms; took ${elapsedMs.toFixed(1)}ms`);
});

test('T10: pubkeys absent from seeds and signals are not in the result map', () => {
  const { computeGrCommunityScores } = loadAlgo();
  const { scores } = computeGrCommunityScores({
    seeds: ['A'],
    endorsements: [{ rater: 'A', target: 'B' }],
    vetoes: [],
    baselineGr: { A: 0.9, B: 0.5, C: 0.5, D: 0.5 },
  });
  assert(!scores.has('C'),
    'pubkey C is in baselineGr but not seeds/signals — must not appear in result');
  assert(!scores.has('D'),
    'pubkey D is in baselineGr but not seeds/signals — must not appear in result');
});

test('T11: module exports WEIGHTING_MODEL_ID === "gr-community-default-v1"', () => {
  const { WEIGHTING_MODEL_ID } = loadAlgo();
  assert.strictEqual(WEIGHTING_MODEL_ID, 'gr-community-default-v1',
    `WEIGHTING_MODEL_ID must be "gr-community-default-v1"; got "${WEIGHTING_MODEL_ID}"`);
});

test('T12: isMember(score, threshold) returns score >= threshold', () => {
  const { isMember } = loadAlgo();
  assert.strictEqual(isMember(0.6, 0.5), true);
  assert.strictEqual(isMember(0.5, 0.5), true);
  assert.strictEqual(isMember(0.49, 0.5), false);
  assert.strictEqual(isMember(0.6), true, 'default threshold should be 0.5');
});

test('T13: partitionMembers returns { members, nonMembers } with seeds in members and lists sorted by score desc', () => {
  const { partitionMembers } = loadAlgo();
  const scoresMap = new Map([
    ['A', 0.9],
    ['B', 0.7],
    ['C', 0.3],
    ['D', 0.6],
  ]);
  const { members, nonMembers } = partitionMembers(scoresMap, 0.5);
  assert.deepStrictEqual(members, ['A', 'B', 'D'],
    `members must be score-desc above threshold; got ${JSON.stringify(members)}`);
  assert.deepStrictEqual(nonMembers, ['C'],
    `nonMembers must be score-desc below threshold; got ${JSON.stringify(nonMembers)}`);
});

/* ────────────────────────────────────────────────────────────
 * REST contract (T14–T22)
 * ──────────────────────────────────────────────────────────── */

test('T14: src/api/index.js registers GET /api/communities + /:slug + /:slug/members', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/api/index.js'), 'utf8');
  assert(/app\.get\(['"]\/api\/communities['"]/.test(src),
    'src/api/index.js must register GET /api/communities');
  assert(/app\.get\(['"]\/api\/communities\/:slug['"]/.test(src),
    'src/api/index.js must register GET /api/communities/:slug');
  assert(/app\.get\(['"]\/api\/communities\/:slug\/members['"]/.test(src),
    'src/api/index.js must register GET /api/communities/:slug/members');
});

test('T15: src/api/communities/index.js exports handleList, handleDetail, handleMembers', () => {
  const src = fs.readFileSync(path.join(API_DIR, 'index.js'), 'utf8');
  for (const name of ['handleList', 'handleDetail', 'handleMembers']) {
    assert(new RegExp(`\\b${name}\\b`).test(src),
      `src/api/communities/index.js must export ${name}`);
  }
  // It must be a module.exports object referencing those names.
  assert(/module\.exports\s*=/.test(src),
    'index.js must use module.exports');
});

test('T16: each handler falls back to getOwnerAssistantPubkey() when req.query.viewer is absent', () => {
  for (const handlerFile of ['list.js', 'detail.js', 'members.js']) {
    const src = fs.readFileSync(path.join(API_DIR, handlerFile), 'utf8');
    assert(/getOwnerAssistantPubkey/.test(src),
      `${handlerFile} must reference getOwnerAssistantPubkey for viewer fallback`);
    assert(/req\.query\.viewer/.test(src),
      `${handlerFile} must read req.query.viewer`);
  }
});

test('T17: dataSources.js exports the 4 functions, each wrapped in try/catch', () => {
  const src = fs.readFileSync(path.join(API_DIR, 'dataSources.js'), 'utf8');
  for (const fn of ['loadCommunityRecord', 'loadCommunitiesForViewer', 'loadEndorsementSignals', 'loadBaselineGrScores']) {
    assert(new RegExp(`(?:async\\s+)?function\\s+${fn}|\\b${fn}\\s*[:=]\\s*async`).test(src),
      `dataSources.js must define ${fn}`);
  }
  // At least 4 try/catch blocks expected — one per function.
  const tryCount = (src.match(/\btry\s*\{/g) || []).length;
  assert(tryCount >= 4,
    `dataSources.js must wrap each query in try/catch; found ${tryCount} try blocks`);
});

test('T18: pure-function module has zero I/O imports', () => {
  const src = fs.readFileSync(path.join(ALGO_DIR, 'computeScores.js'), 'utf8');
  const forbidden = [
    "require\\(['\"]fs['\"]\\)",
    "require\\(['\"]neo4j-driver['\"]\\)",
    "require\\(['\"]nostr-tools['\"]\\)",
    "require\\(['\"]child_process['\"]\\)",
    "require\\(['\"]ws['\"]\\)",
    "require\\(['\"]https?['\"]\\)",
  ];
  for (const re of forbidden) {
    assert(!new RegExp(re).test(src),
      `computeScores.js must not import I/O module (matched ${re})`);
  }
});

test('T19: each handler emits { success: true, ... } envelope', () => {
  for (const handlerFile of ['list.js', 'detail.js', 'members.js']) {
    const src = fs.readFileSync(path.join(API_DIR, handlerFile), 'utf8');
    assert(/success:\s*true/.test(src),
      `${handlerFile} must emit { success: true } on the success path`);
  }
  // Detail handler additionally has a 404 with success: false.
  const detailSrc = fs.readFileSync(path.join(API_DIR, 'detail.js'), 'utf8');
  assert(/success:\s*false/.test(detailSrc),
    'detail.js must emit { success: false } on the 404 path');
  assert(/status\(404\)|\.status\(\s*404\s*\)/.test(detailSrc),
    'detail.js must return HTTP 404 when the slug is not found');
});

test('T20: src/api/openapi.yaml documents the four new endpoints', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/api/openapi.yaml'), 'utf8');
  for (const route of ['/api/communities', '/api/communities/{slug}', '/api/communities/{slug}/members']) {
    assert(src.includes(route),
      `openapi.yaml must contain entry for ${route}`);
  }
});

test('T21: data-source functions return null / [] / {} from the catch branch, never re-throw', () => {
  const src = fs.readFileSync(path.join(API_DIR, 'dataSources.js'), 'utf8');
  // Heuristic: catch blocks should not contain `throw`. The function instead returns the empty value.
  // Look for `} catch (...) { ... return ... }` and verify no `throw` appears between `catch` and `}`.
  const catchBlocks = src.match(/catch\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/g) || [];
  assert(catchBlocks.length >= 4,
    `dataSources.js must have at least 4 catch blocks (one per function); found ${catchBlocks.length}`);
  for (const block of catchBlocks) {
    assert(!/\bthrow\b/.test(block),
      `dataSources.js catch block must not re-throw — return the empty equivalent instead. Offending block:\n${block.slice(0, 200)}`);
    assert(/\breturn\b/.test(block),
      'each catch block must return a value (null / [] / {})');
  }
});

test('T22: src/api/communities/cache.js exports getOrCompute with a default 60000ms TTL', () => {
  const src = fs.readFileSync(path.join(API_DIR, 'cache.js'), 'utf8');
  assert(/getOrCompute/.test(src),
    'cache.js must export getOrCompute');
  assert(/60000|60_000|60\s*\*\s*1000/.test(src),
    'cache.js must reference a 60000ms (60 second) default TTL');
});

/* ────────────────────────────────────────────────────────────
 * Functional handler tests (T23–T25)
 *
 * These swap the data-source module via require.cache so the handler
 * runs against deterministic stubs without touching strfry/Neo4j.
 * ──────────────────────────────────────────────────────────── */

function stubDataSources(stubs) {
  // Clear cache so the handler picks up the new stub.
  const dsPath = require.resolve(path.join(API_DIR, 'dataSources.js'));
  const apiPath = require.resolve(path.join(API_DIR, 'index.js'));
  delete require.cache[dsPath];
  delete require.cache[apiPath];
  delete require.cache[require.resolve(path.join(API_DIR, 'list.js'))];
  delete require.cache[require.resolve(path.join(API_DIR, 'detail.js'))];
  delete require.cache[require.resolve(path.join(API_DIR, 'members.js'))];
  delete require.cache[require.resolve(path.join(API_DIR, 'cache.js'))];
  require.cache[dsPath] = {
    id: dsPath,
    filename: dsPath,
    loaded: true,
    exports: stubs,
  };
  return require(apiPath);
}

function fakeRes() {
  let _status = 200;
  let _json = null;
  return {
    status(code) { _status = code; return this; },
    json(body) { _json = body; return this; },
    get _status() { return _status; },
    get _json() { return _json; },
  };
}

test('T23: handleList returns { success: true, communities: [] } when dataSources.loadCommunitiesForViewer returns []', async () => {
  // Skipping when the handlers don't exist yet — the source-regex tests above already pin module existence.
  if (!fs.existsSync(path.join(API_DIR, 'index.js'))) {
    throw new Error('src/api/communities/index.js does not yet exist');
  }
  const api = stubDataSources({
    loadCommunityRecord: async () => null,
    loadCommunitiesForViewer: async () => [],
    loadEndorsementSignals: async () => [],
    loadBaselineGrScores: async () => ({}),
  });
  const res = fakeRes();
  await api.handleList({ query: {} }, res);
  assert.strictEqual(res._status, 200, `handleList must return 200 on empty data; got ${res._status}`);
  assert.deepStrictEqual(res._json, { success: true, communities: [] });
});

test('T24: handleDetail returns 404 with { success: false } when loadCommunityRecord returns null', async () => {
  if (!fs.existsSync(path.join(API_DIR, 'index.js'))) {
    throw new Error('src/api/communities/index.js does not yet exist');
  }
  const api = stubDataSources({
    loadCommunityRecord: async () => null,
    loadCommunitiesForViewer: async () => [],
    loadEndorsementSignals: async () => [],
    loadBaselineGrScores: async () => ({}),
  });
  const res = fakeRes();
  await api.handleDetail({ query: {}, params: { slug: 'nope' } }, res);
  assert.strictEqual(res._status, 404, `handleDetail must return 404 on missing slug; got ${res._status}`);
  assert.strictEqual(res._json && res._json.success, false,
    'handleDetail must return { success: false } on 404');
});

test('T25: handleMembers computes scores and returns members sorted by score desc', async () => {
  if (!fs.existsSync(path.join(API_DIR, 'index.js'))) {
    throw new Error('src/api/communities/index.js does not yet exist');
  }
  // Build a stub community: 2 seeds + 3 candidate members with varying endorsement counts.
  const community = {
    slug: 'test',
    aTag: '39999:fake/test',
    seedMembers: ['S1', 'S2'],
    name: 'Test', description: '', tags: [], image: null, language: null,
    accent: '#ba20ba', founder: 'S1',
    relays: [], weightingModel: 'gr-community-default-v1',
    endorsementThreshold: 0.5,
  };
  const endorsements = [
    { rater: 'S1', target: 'A' },
    { rater: 'S2', target: 'A' },
    { rater: 'S1', target: 'B' },
    { rater: 'A', target: 'C' },
  ];
  const api = stubDataSources({
    loadCommunityRecord: async () => community,
    loadCommunitiesForViewer: async () => [community],
    loadEndorsementSignals: async () => endorsements,
    loadBaselineGrScores: async () => ({
      S1: 0.9, S2: 0.9, A: 0.7, B: 0.7, C: 0.6,
    }),
  });
  const res = fakeRes();
  await api.handleMembers({ query: {}, params: { slug: 'test' } }, res);
  assert.strictEqual(res._status, 200);
  assert(res._json && Array.isArray(res._json.members),
    'handleMembers must return { success: true, members: [...] }');
  const members = res._json.members;
  // Seeds always score 1, so they should be at the top.
  assert(members.length >= 2);
  for (let i = 1; i < members.length; i++) {
    assert(members[i - 1].score >= members[i].score,
      `members must be sorted by score desc; ${members[i - 1].pubkey}(${members[i - 1].score}) < ${members[i].pubkey}(${members[i].score})`);
  }
});

/* ────────────────────────────────────────────────────────────
 * Runner
 * ──────────────────────────────────────────────────────────── */

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message.split('\n')[0]}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
