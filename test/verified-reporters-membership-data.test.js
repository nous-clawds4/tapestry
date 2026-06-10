/**
 * Story verified-reporters #2: Verified reporters membership data.
 * ADR 0002 (verified-reporters). See
 * engineering-team/stories/verified-reporters/2-verified-reporters-membership-data.test-plan.md
 *
 * ADR 0002 chose Option A: a new isolated endpoint
 *   GET /api/get-grapevine-reporters?observee=<pk>
 * backed by a new src/api/grapevineInteractions/queries/reportersWithMetrics.js
 * (handleGetGrapevineReporters), registered in src/api/index.js, consumed by a new
 * ui/src/hooks/useGrapevineReporters.js. It is the LITERAL INVERSE of the verified-
 * reporter count query (src/algos/follows-mutes-reports/calculateVerifiedReporterCounts.sh):
 *   MATCH (observee:NostrUser {pubkey:$observee})<-[:REPORTS]-(reporter:NostrUser)
 *   WHERE reporter.influence > $cutoff   // $cutoff = VERIFIED_REPORTERS_INFLUENCE_CUTOFF
 * returning reporter {pubkey, influence, hops, verified*Count}. Same edge + same
 * cutoff as the count algo ⇒ count = list length at House PoV; the response's own
 * `count` is `data.length`. House/owner PoV only for v1 (personalized PoV deferred,
 * mirroring follows ADR 0026 / followers ADR 0030).
 *
 * Tests are source-regex sentinels — the test/profile-follows-list.test.js precedent
 * (a new endpoint pinned at source without prescribing the exact wiring). The handler,
 * route, and hook do not exist pre-implementation, so T1–T10 FAIL now and PASS once
 * built. R1–R2 are regression sentinels — they PASS before AND after (they guard the
 * untouched follows endpoint + route).
 *
 * FALSE-POSITIVE AVOIDANCE: src/api/index.js + followsWithMetrics.js already contain
 * the strings "REPORTS"/"verifiedReporterCount" (the follows RETURN surfaces the
 * reporter COUNT per row). Each sentinel below targets the NEW reporters handler/route/
 * hook specifically — `handleGetGrapevineReporters`, `/api/get-grapevine-reporters`,
 * the `[:REPORTS]` edge + `VERIFIED_REPORTERS_INFLUENCE_CUTOFF` filter in the new file —
 * none of which exist pre-implementation.
 */

const fs = require('fs');
const path = require('path');

const HANDLER   = path.resolve(__dirname, '../src/api/grapevineInteractions/queries/reportersWithMetrics.js');
const API_INDEX = path.resolve(__dirname, '../src/api/index.js');
const HOOK      = path.resolve(__dirname, '../ui/src/hooks/useGrapevineReporters.js');
const FOLLOWS_HANDLER = path.resolve(__dirname, '../src/api/grapevineInteractions/queries/followsWithMetrics.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// ===========================================================================
// BACKEND — new endpoint GET /api/get-grapevine-reporters (owner/House POV)
// ===========================================================================

test('T1: reportersWithMetrics.js exists and exports handleGetGrapevineReporters (ADR 0002 §Impl)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0,
    'src/api/grapevineInteractions/queries/reportersWithMetrics.js does not exist yet — the Implementer must create the new endpoint handler (ADR 0002 Option A: a new endpoint).');
  assert(/handleGetGrapevineReporters/.test(src),
    'reportersWithMetrics.js must define handleGetGrapevineReporters.');
  assert(/module\.exports\s*=\s*\{[\s\S]*handleGetGrapevineReporters/.test(src),
    'reportersWithMetrics.js must export handleGetGrapevineReporters so src/api/index.js can register it.');
});

test('T2: handler requires + 64-hex-validates `observee`, returning 400 otherwise (AC6)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'reportersWithMetrics.js does not exist yet.');
  assert(/req\.query\.observee/.test(src),
    'handler must read the `observee` query param (req.query.observee).');
  assert(/\.status\(\s*400\s*\)/.test(src),
    'handler must return HTTP 400 for a missing/invalid observee (AC6: a bad account id is rejected, not a crash or silent empty success).');
  assert(/[0-9a-f]\{64\}|isValidHexPubkey|npubEncode/i.test(src),
    'handler must validate the pubkey shape (64-hex, e.g. /^[0-9a-f]{64}$/i, isValidHexPubkey, or a nip19.npubEncode round-trip — cf. followsWithMetrics.js:36-60).');
});

test('T3: handler Cypher traverses the inbound :REPORTS edge with a verified-influence filter (AC1)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'reportersWithMetrics.js does not exist yet.');
  assert(/\[\s*:REPORTS\s*\]/.test(src),
    'handler Cypher must traverse the :REPORTS edge between the reported account and its reporters (e.g. (observee)<-[:REPORTS]-(reporter:NostrUser)). This is the same edge the count algo uses (calculateVerifiedReporterCounts.sh).');
  assert(/influence\s*>/.test(src),
    'handler must filter reporters by influence above the verified cutoff (e.g. `reporter.influence > $cutoff`) — only VERIFIED reporters are returned (AC1; unverified/sybil reporters excluded).');
});

test('T4: the verified filter uses VERIFIED_REPORTERS_INFLUENCE_CUTOFF (not the followers cutoff) and the response count is data.length (AC3)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'reportersWithMetrics.js does not exist yet.');
  assert(/VERIFIED_REPORTERS_INFLUENCE_CUTOFF/.test(src),
    'the verified cutoff MUST be VERIFIED_REPORTERS_INFLUENCE_CUTOFF — the SAME config var the count algo (calculateVerifiedReporterCounts.sh) uses. This is what makes count = list length hold (AC3).');
  assert(!/VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF/.test(src),
    'copy-paste guard: do NOT use VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF here (it would silently break count = list length). Use the reporters cutoff.');
  assert(/getConfigFromFile/.test(src),
    'the cutoff must be read via getConfigFromFile (cf. followsWithMetrics.js:19,64,76).');
  assert(/count\s*:\s*data\.length/.test(src),
    'the response `count` must be `data.length` so count === list length within the capability (AC3).');
});

test('T5: success rows carry identity + credibility metric per reporter (AC2)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'reportersWithMetrics.js does not exist yet.');
  for (const field of ['pubkey', 'influence', 'hops', 'verifiedFollowerCount', 'verifiedMuterCount', 'verifiedReporterCount']) {
    assert(new RegExp('\\b' + field + '\\b').test(src),
      `each returned reporter must surface \`${field}\` (AC2: an identifier + the Rank/credibility metric; the full column set mirrors followers for Story 3 parity).`);
  }
});

test('T6: a non-owner `observer` is rejected with 400 — owner/House POV only in v1 (AC1/AC4; personalized POV deferred)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'reportersWithMetrics.js does not exist yet.');
  assert(/observer/.test(src),
    'handler must look at the `observer` param to reject non-owner values in v1.');
  assert(/\.status\(\s*400\s*\)[\s\S]{0,260}(customer|owner[\s-]?only|not\s*(yet\s*)?support)/i.test(src) ||
         /(customer|owner[\s-]?only|not\s*(yet\s*)?support)[\s\S]{0,260}\.status\(\s*400\s*\)/i.test(src),
    'a non-owner `observer` must return 400 stating customer/personalized observers are not yet supported (v1 is owner/House POV only — ADR 0002, mirrors ADR 0026/0030). AC4 (House fallback) is the v1 default path.');
});

test('T7: success response shape is {success, observer:\'owner\', observee, count, data} (AC3/AC5)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'reportersWithMetrics.js does not exist yet.');
  for (const key of ['success', 'observer', 'observee', 'count', 'data']) {
    assert(new RegExp('\\b' + key + '\\b').test(src),
      `the success response must include \`${key}\` (ADR 0002: { success:true, observer:'owner', observee, count, data:[…] }).`);
  }
  assert(/observer\s*:\s*['"]owner['"]/.test(src),
    "the response must report observer:'owner' (v1 House/owner POV).");
  // AC5: an empty result is a normal success — `data` is built by mapping records, so
  // zero verified reporters yields data:[] / count:0 with a 200, not an error path.
  assert(/result\.records/.test(src) && /\.map\s*\(/.test(src),
    'data must be built from result.records via .map (so a zero-reporter account yields data:[] count:0 as a normal 200 success — AC5 — not an error).');
});

test('T8: handler enforces the Neo4j deadline (NEO4J_QUERY_TIMEOUT_MS) with a 504 {success:false} branch (ADR §Impl, mirrors follows)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'reportersWithMetrics.js does not exist yet.');
  assert(/NEO4J_QUERY_TIMEOUT_MS/.test(src),
    'handler must read NEO4J_QUERY_TIMEOUT_MS (same deadline pattern as followsWithMetrics.js:76).');
  assert(/timeout\s*:/.test(src),
    'handler must pass a driver-layer { timeout: ... } to session.run so a runaway query fails fast (followsWithMetrics.js:96).');
  const win = src.match(/\.status\(\s*504\s*\)\s*\.json\(\s*\{[\s\S]{0,400}?\}/);
  assert(win, 'handler must return HTTP 504 with a JSON object body on query timeout (no `.status(504).json({...})` found).');
  assert(/success\s*:\s*false/.test(win[0]),
    'the 504 JSON body must include `success: false` (followsWithMetrics.js:123-126).');
});

test('T9: GET /api/get-grapevine-reporters is registered in src/api/index.js → handleGetGrapevineReporters (AC: endpoint reachable)', () => {
  const src = safeRead(API_INDEX);
  assert(src.length > 0, 'src/api/index.js missing — unexpected.');
  assert(/['"]\/api\/get-grapevine-reporters['"]/.test(src),
    "src/api/index.js must register the route '/api/get-grapevine-reporters' (alongside the follows/followers routes).");
  assert(/handleGetGrapevineReporters/.test(src),
    'src/api/index.js must wire the route to handleGetGrapevineReporters (import + app.get).');
});

// ===========================================================================
// FRONTEND — the data hook (the page that consumes it is Story 3, not here)
// ===========================================================================

test('T10: ui/src/hooks/useGrapevineReporters.js fetches /api/get-grapevine-reporters (ADR §Impl)', () => {
  const src = safeRead(HOOK);
  assert(src.length > 0,
    'useGrapevineReporters.js does not exist yet — the Implementer must create the data hook (mirror useGrapevineFollows.js).');
  assert(/get-grapevine-reporters/.test(src),
    'useGrapevineReporters.js must call the /api/get-grapevine-reporters endpoint.');
  assert(/fetch\s*\(/.test(src),
    'useGrapevineReporters.js must use fetch (matching the useGrapevineFollows.js convention).');
});

// ===========================================================================
// REGRESSION SENTINELS (must PASS before AND after implementation)
// ===========================================================================

test('R1: the follows endpoint is untouched — followsWithMetrics.js still exports handleGetGrapevineFollows over the :FOLLOWS edge (regression)', () => {
  const src = safeRead(FOLLOWS_HANDLER);
  assert(src.length > 0, 'followsWithMetrics.js missing — unexpected.');
  assert(/handleGetGrapevineFollows/.test(src),
    'followsWithMetrics.js must still export handleGetGrapevineFollows (ADR 0002 adds a NEW endpoint; it must not edit the follows handler).');
  assert(/:FOLLOWS\s*\]\s*->/.test(src),
    'the follows handler must still traverse (observee)-[:FOLLOWS]->(f) — unchanged.');
});

test('R2: the existing /api/get-grapevine-follows route remains registered (regression)', () => {
  const src = safeRead(API_INDEX);
  assert(src.length > 0, 'src/api/index.js missing — unexpected.');
  assert(/['"]\/api\/get-grapevine-follows['"]/.test(src),
    'the existing /api/get-grapevine-follows registration must remain (the live Follows feature depends on it).');
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
