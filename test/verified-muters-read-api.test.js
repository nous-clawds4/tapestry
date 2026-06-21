/**
 * Story verified-muters #1: Verified Muters read API (count + list).
 * ADR 0001 (verified-muters). See
 * engineering-team/stories/verified-muters/1-verified-muters-read-api.test-plan.md
 *
 * ADR 0001 chose Option A: a NEW isolated endpoint
 *   GET /api/get-grapevine-muters?observee=<pk>[&observer=owner]
 * backed by a new src/api/grapevineInteractions/queries/mutersWithMetrics.js
 * (handleGetGrapevineMuters), registered in src/api/index.js. It mirrors
 * VERIFIED FOLLOWERS (not reporters): the inbound :MUTES edge filtered by
 * influence > VERIFIED_MUTERS_INFLUENCE_CUTOFF, returning the SAME six-column row
 * shape as the Verified Followers list — {pubkey, influence, hops,
 * verifiedFollowerCount, verifiedMuterCount, verifiedReporterCount} — with NO
 * report-specific fields (no report_type, no timestamp). It is the literal inverse
 * of the verified-muter count (calculateVerifiedMuterCounts.sh): same edge + same
 * cutoff ⇒ count = list length at owner PoV; the response's own `count` is
 * `data.length`. Owner/House PoV only in v1 (a non-owner observer → 400).
 *
 * The count gap (AC1) is closed inside the EXISTING handleGetUserCounts
 * (src/api/export/users/queries/userdata.js): a third verifiedMuterCount branch
 * beside verifiedFollowerCount / verifiedReporterCount — node property first, with a
 * count-only [:MUTES] live fallback bounded by NEO4J_QUERY_TIMEOUT_MS, and the field
 * added to the response payload.
 *
 * Tests are source-regex sentinels — the established precedent of the two sibling
 * backend suites this ADR mirrors: test/verified-reporters-membership-data.test.js
 * (the LIST endpoint) and test/profile-verified-counts-owner-pov.test.js (the COUNT
 * handler slice). The new file + the new count branch do not exist pre-implementation,
 * so T1–T14 FAIL now and PASS once built. R1–R4 are regression sentinels — they PASS
 * before AND after (they guard the untouched follows/reporters endpoints, the existing
 * follower/reporter count branches, and the shared get-grapevine-interaction route).
 *
 * FALSE-POSITIVE AVOIDANCE: "verifiedMuterCount" and "VERIFIED_MUTERS_INFLUENCE_CUTOFF"
 * already appear elsewhere — every *WithMetrics.js sibling RETURNs the muter COUNT per
 * row, and handleGetUserData (the OTHER handler in userdata.js) already reads the muter
 * property. So the LIST sentinels target the NEW mutersWithMetrics.js file specifically
 * (handleGetGrapevineMuters, /api/get-grapevine-muters, the [:MUTES] edge + muter cutoff
 * in that file), and the COUNT sentinels are scoped to the SLICED handleGetUserCounts
 * function body — never to its siblings.
 */

const fs = require('fs');
const path = require('path');

const HANDLER     = path.resolve(__dirname, '../src/api/grapevineInteractions/queries/mutersWithMetrics.js');
const API_INDEX   = path.resolve(__dirname, '../src/api/index.js');
const USERDATA    = path.resolve(__dirname, '../src/api/export/users/queries/userdata.js');
const FOLLOWS_HANDLER   = path.resolve(__dirname, '../src/api/grapevineInteractions/queries/followsWithMetrics.js');
const REPORTERS_HANDLER = path.resolve(__dirname, '../src/api/grapevineInteractions/queries/reportersWithMetrics.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// Slice a single top-level function body out, so the COUNT asserts match the
// handleGetUserCounts body and NOT the other handler in the same file
// (handleGetUserData), which already reads the muter property. Mirrors the
// sliceFn helper in test/profile-verified-counts-owner-pov.test.js.
function sliceFn(src, name) {
  const start = src.indexOf(`function ${name}`);
  if (start === -1) return '';
  const after = src.slice(start + `function ${name}`.length);
  const nextFn = after.indexOf('\nfunction ');
  const nextExp = after.indexOf('\nmodule.exports');
  let end = after.length;
  if (nextFn !== -1) end = Math.min(end, nextFn);
  if (nextExp !== -1) end = Math.min(end, nextExp);
  return after.slice(0, end);
}

// ===========================================================================
// LIST — new endpoint GET /api/get-grapevine-muters (owner/House PoV)
// ===========================================================================

test('T1: mutersWithMetrics.js exists and exports handleGetGrapevineMuters (ADR 0001 §Impl)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0,
    'src/api/grapevineInteractions/queries/mutersWithMetrics.js does not exist yet — the Implementer must create the new endpoint handler (ADR 0001 Option A: a new standalone module mirroring followersWithMetrics.js).');
  assert(/handleGetGrapevineMuters/.test(src),
    'mutersWithMetrics.js must define handleGetGrapevineMuters.');
  assert(/module\.exports\s*=\s*\{[\s\S]*handleGetGrapevineMuters/.test(src),
    'mutersWithMetrics.js must export handleGetGrapevineMuters so src/api/index.js can register it.');
});

test('T2: handler requires + 64-hex-validates `observee`, returning 400 otherwise (AC4)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'mutersWithMetrics.js does not exist yet.');
  assert(/req\.query\.observee/.test(src),
    'handler must read the `observee` query param (req.query.observee).');
  assert(/\.status\(\s*400\s*\)/.test(src),
    'handler must return HTTP 400 for a missing/invalid observee (AC4: a malformed/missing account id is rejected — not a crash, not a silent empty success).');
  assert(/\[0-9a-f\]\{64\}|isValidHexPubkey|npubEncode/i.test(src),
    'handler must validate the pubkey shape (64-hex, e.g. /^[0-9a-f]{64}$/i, isValidHexPubkey, or a nip19.npubEncode round-trip — cf. followersWithMetrics.js).');
});

test('T3: handler Cypher traverses the inbound :MUTES edge with a verified-influence filter (AC2)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'mutersWithMetrics.js does not exist yet.');
  assert(/\[\s*(?:[A-Za-z_]\w*\s*)?:MUTES\s*\]/.test(src),
    'handler Cypher must traverse the :MUTES edge from each muter to the muted account (e.g. (muter:NostrUser)-[:MUTES]->(observee)). This is the same edge the count algo uses (calculateVerifiedMuterCounts.sh).');
  assert(/influence\s*>/.test(src),
    'handler must filter muters by influence above the verified cutoff (e.g. `muter.influence > $cutoff`) — only VERIFIED muters are returned (AC2; users who do not clear the bar are excluded).');
});

test('T4: the verified filter uses VERIFIED_MUTERS_INFLUENCE_CUTOFF (not the follower/reporter cutoff) and the response count is data.length (AC3)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'mutersWithMetrics.js does not exist yet.');
  assert(/VERIFIED_MUTERS_INFLUENCE_CUTOFF/.test(src),
    'the verified cutoff MUST be VERIFIED_MUTERS_INFLUENCE_CUTOFF — the SAME config var the count algo (calculateVerifiedMuterCounts.sh) uses. This is what makes count = list length hold (AC3).');
  assert(!/VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF/.test(src),
    'copy-paste guard: do NOT use VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF here (it would silently break count = list length). Use the muters cutoff.');
  assert(!/VERIFIED_REPORTERS_INFLUENCE_CUTOFF/.test(src),
    'copy-paste guard: do NOT use VERIFIED_REPORTERS_INFLUENCE_CUTOFF here. Use the muters cutoff.');
  assert(/getConfigFromFile/.test(src),
    'the cutoff must be read via getConfigFromFile (cf. followersWithMetrics.js / reportersWithMetrics.js).');
  assert(/count\s*:\s*data\.length/.test(src),
    'the response `count` must be `data.length` so count === list length within the read path (AC3).');
});

test('T5: success rows carry the SAME six columns as the Verified Followers list (identity + Rank/credibility metric) (AC2)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'mutersWithMetrics.js does not exist yet.');
  for (const field of ['pubkey', 'influence', 'hops', 'verifiedFollowerCount', 'verifiedMuterCount', 'verifiedReporterCount']) {
    assert(new RegExp('\\b' + field + '\\b').test(src),
      `each returned muter must surface \`${field}\` (AC2: identity + the Rank/credibility metric; the column set is the Verified Followers list's six columns).`);
  }
});

test('T6: a non-owner `observer` is rejected with 400 — owner/House PoV only in v1 (AC5)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'mutersWithMetrics.js does not exist yet.');
  assert(/observer/.test(src),
    'handler must look at the `observer` param to reject non-owner values in v1.');
  assert(/\.status\(\s*400\s*\)[\s\S]{0,260}(customer|owner[\s-]?only|not\s*(yet\s*)?support)/i.test(src) ||
         /(customer|owner[\s-]?only|not\s*(yet\s*)?support)[\s\S]{0,260}\.status\(\s*400\s*\)/i.test(src),
    'a non-owner `observer` must return 400 stating customer/personalized observers are not yet supported (v1 is owner/House PoV only — AC5, the same restriction the follower/reporter list read paths enforce).');
});

test("T7: success response shape is {success, observer:'owner', observee, count, data}; an empty muter set is a normal 200 (AC4)", () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'mutersWithMetrics.js does not exist yet.');
  for (const key of ['success', 'observer', 'observee', 'count', 'data']) {
    assert(new RegExp('\\b' + key + '\\b').test(src),
      `the success response must include \`${key}\` (ADR 0001: { success:true, observer:'owner', observee, count, data:[…] }).`);
  }
  assert(/observer\s*:\s*['"]owner['"]/.test(src),
    "the response must report observer:'owner' (v1 House/owner PoV).");
  // AC4: an empty result is a normal success — `data` is built by mapping records, so
  // zero verified muters yields data:[] / count:0 with a 200, not an error path.
  assert(/result\.records/.test(src) && /\.map\s*\(/.test(src),
    'data must be built from result.records via .map (so an account with no verified muters yields data:[] count:0 as a normal 200 success — AC4 — not an error).');
});

test('T8: handler enforces the Neo4j deadline (NEO4J_QUERY_TIMEOUT_MS) with a 504 {success:false} branch (ADR §Impl, mirrors followers)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'mutersWithMetrics.js does not exist yet.');
  assert(/NEO4J_QUERY_TIMEOUT_MS/.test(src),
    'handler must read NEO4J_QUERY_TIMEOUT_MS (same deadline pattern as followersWithMetrics.js).');
  assert(/timeout\s*:/.test(src),
    'handler must pass a driver-layer { timeout: ... } to session.run so a runaway query fails fast (followersWithMetrics.js).');
  const win = src.match(/\.status\(\s*504\s*\)\s*\.json\(\s*\{[\s\S]{0,400}?\}/);
  assert(win, 'handler must return HTTP 504 with a JSON object body on query timeout (no `.status(504).json({...})` found).');
  assert(/success\s*:\s*false/.test(win[0]),
    'the 504 JSON body must include `success: false` (the siblings\' error discipline AC4 inherits).');
});

test('T9: GET /api/get-grapevine-muters is registered in src/api/index.js → handleGetGrapevineMuters (endpoint reachable)', () => {
  const src = safeRead(API_INDEX);
  assert(src.length > 0, 'src/api/index.js missing — unexpected.');
  assert(/['"]\/api\/get-grapevine-muters['"]/.test(src),
    "src/api/index.js must register the route '/api/get-grapevine-muters' (alongside the follows/followers/reporters routes).");
  assert(/handleGetGrapevineMuters/.test(src),
    'src/api/index.js must wire the route to handleGetGrapevineMuters (import + app.get).');
});

test('T10: the muters row carries NO report-specific fields — it mirrors Verified Followers, not Verified Reporters (AC2)', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0, 'mutersWithMetrics.js does not exist yet.');
  assert(!/report_type/i.test(src),
    'a :MUTES edge has no report sub-type — the muters handler must NOT surface `report_type`/`reportType` (AC2 + story Out-of-scope: the row shape is the Verified Followers list\'s, which has none).');
  assert(!/\breportType\b/.test(src),
    'the muters handler must NOT carry a `reportType` field (that is reporter-only).');
  assert(!/\btimestamp\b/i.test(src),
    'the muters handler must NOT carry a `timestamp` / "Reported" field (that is reporter-only; muters mirror followers, which have no per-edge timestamp).');
});

// ===========================================================================
// COUNT — handleGetUserCounts gains a third verified-muter branch (AC1)
// ===========================================================================

test('T11: handleGetUserCounts returns verifiedMuterCount beside verifiedFollowerCount + verifiedReporterCount (AC1)', () => {
  const fn = sliceFn(safeRead(USERDATA), 'handleGetUserCounts');
  assert(fn.length > 0, 'handleGetUserCounts not found in userdata.js — unexpected.');
  assert(/verifiedMuterCount/.test(fn),
    'handleGetUserCounts must compute + return verifiedMuterCount (pre-implementation it returns only followingCount + verifiedFollowerCount + verifiedReporterCount — the muter count is omitted).');
  assert(/verifiedFollowerCount/.test(fn) && /verifiedReporterCount/.test(fn),
    'verifiedMuterCount must travel ALONGSIDE the two existing sibling counts (AC1: all three travel together in the same read path).');
});

test('T12: the verified-muter count is read from the Neo4j NostrUser node, not Meili (AC1)', () => {
  const fn = sliceFn(safeRead(USERDATA), 'handleGetUserCounts');
  assert(fn.length > 0, 'handleGetUserCounts not found.');
  assert(/verifiedMuterCount/.test(fn) && /NostrUser/.test(fn),
    'the muter count must come from the Owner-PoV NostrUser node property (e.g. u.verifiedMuterCount) — the same source the siblings use, computed under the muter verification bar (AC1).');
});

test('T13: the muter count has a count-only [:MUTES] live fallback under VERIFIED_MUTERS_INFLUENCE_CUTOFF, deadline-bounded (AC1)', () => {
  const fn = sliceFn(safeRead(USERDATA), 'handleGetUserCounts');
  assert(fn.length > 0, 'handleGetUserCounts not found.');
  assert(/\[:MUTES\]/.test(fn),
    'the count-only live fallback (used when the node property is null) must traverse the :MUTES edge — mirroring the [:FOLLOWS]/[:REPORTS] fallbacks already present for the siblings.');
  assert(/VERIFIED_MUTERS_INFLUENCE_CUTOFF/.test(fn),
    'the muter fallback must filter by VERIFIED_MUTERS_INFLUENCE_CUTOFF — the SAME cutoff the count algo uses (so badge ≡ list definition); NOT the follower/reporter cutoff.');
  assert(/count\s*\(/.test(fn),
    'the muter fallback must be a count-only query (RETURN count(...)), not a full membership fetch.');
  assert(/NEO4J_QUERY_TIMEOUT_MS/.test(fn),
    'the muter fallback must be bounded by NEO4J_QUERY_TIMEOUT_MS so a dense account degrades to "—" rather than hanging the profile (mirrors the sibling fallbacks).');
});

test('T14: verifiedMuterCount is included in the handleGetUserCounts response payload (AC1)', () => {
  const fn = sliceFn(safeRead(USERDATA), 'handleGetUserCounts');
  assert(fn.length > 0, 'handleGetUserCounts not found.');
  // The response object lists the returned fields; the muter count must be one of them
  // (pre-implementation the payload is { pubkey, followingCount, verifiedFollowerCount,
  // verifiedReporterCount } — no verifiedMuterCount).
  assert(/data\s*:\s*\{[\s\S]*verifiedMuterCount[\s\S]*\}/.test(fn),
    'the response `data` object must include verifiedMuterCount (e.g. data: { pubkey, followingCount, verifiedFollowerCount, verifiedMuterCount, verifiedReporterCount }) so it reaches the profile counts row alongside its siblings (AC1).');
});

// ===========================================================================
// REGRESSION SENTINELS (must PASS before AND after implementation)
// ===========================================================================

test('R1: the follows endpoint is untouched — followsWithMetrics.js still exports handleGetGrapevineFollows over :FOLLOWS (regression)', () => {
  const src = safeRead(FOLLOWS_HANDLER);
  assert(src.length > 0, 'followsWithMetrics.js missing — unexpected.');
  assert(/handleGetGrapevineFollows/.test(src),
    'followsWithMetrics.js must still export handleGetGrapevineFollows (ADR 0001 adds a NEW endpoint; it must not edit the follows handler).');
  assert(/:FOLLOWS\s*\]\s*->/.test(src),
    'the follows handler must still traverse (observee)-[:FOLLOWS]->(f) — unchanged.');
});

test('R2: the reporters endpoint is untouched — reportersWithMetrics.js still exports handleGetGrapevineReporters over :REPORTS (regression)', () => {
  const src = safeRead(REPORTERS_HANDLER);
  assert(src.length > 0, 'reportersWithMetrics.js missing — unexpected.');
  assert(/handleGetGrapevineReporters/.test(src),
    'reportersWithMetrics.js must still export handleGetGrapevineReporters (ADR 0001 leaves the reporters endpoint untouched).');
  assert(/:REPORTS/.test(src),
    'the reporters handler must still traverse the :REPORTS edge — unchanged.');
});

test('R3: handleGetUserCounts still returns followingCount (strfry) + the two existing verified counts — the muter branch is ADDED beside them (regression)', () => {
  const fn = sliceFn(safeRead(USERDATA), 'handleGetUserCounts');
  assert(fn.length > 0, 'handleGetUserCounts not found.');
  assert(/followingCount/.test(fn),
    'handleGetUserCounts must still return followingCount (the Following count is unchanged).');
  assert(/\[:FOLLOWS\]/.test(fn) && /\[:REPORTS\]/.test(fn),
    'the existing [:FOLLOWS] (verified followers) and [:REPORTS] (verified reporters) fallbacks must remain — the muter branch is added beside them, not in place of them.');
});

test('R4: the existing grapevine routes remain registered — the shared get-grapevine-interaction route is untouched (regression)', () => {
  const src = safeRead(API_INDEX);
  assert(src.length > 0, 'src/api/index.js missing — unexpected.');
  assert(/['"]\/api\/get-grapevine-interaction['"]/.test(src),
    'the shared /api/get-grapevine-interaction route must remain registered (ADR 0001 leaves the cypherQueries.js verifiedMuters registry path + its route untouched).');
  assert(/['"]\/api\/get-grapevine-followers['"]/.test(src),
    'the existing /api/get-grapevine-followers registration must remain (the live Verified Followers list depends on it).');
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
