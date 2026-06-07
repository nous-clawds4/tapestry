/**
 * Story profile #35: Profile Verified Followers/Reporters counts from Neo4j (Owner PoV).
 * ADR 0031. See engineering-team/stories/profile/35-profile-verified-counts-owner-pov.test-plan.md
 *
 * ADR 0031 (activating ADR 0029's pre-authorized contingency) moves the profile's
 * Verified Followers + Verified Reporters COUNT badges off Meili (`trustScores`) and
 * onto the Owner-PoV Neo4j source via an extended `/api/get-user-counts`:
 *   - handleGetUserCounts stays strfry for followingCount and ADDS verifiedFollowerCount
 *     + verifiedReporterCount from the NostrUser node property, with a count-only live
 *     fallback ([:FOLLOWS] / [:REPORTS], influence > VERIFIED_*_INFLUENCE_CUTOFF),
 *     deadline-bounded (NEO4J_QUERY_TIMEOUT_MS) → null/"—" on timeout, NEVER raw followers.
 *   - BrainstormProfile badges read userCounts.* (not trustScores); the `?? trustScores.followers`
 *     raw fallback is removed.
 *   - BrainstormReporters PoV line: "House" → "Owner".
 *   - useUserCounts already passes json.data through, so no hook change is required (R4).
 *
 * Tests are source-regex sentinels (the profile-* precedents). T1–T7 FAIL pre-implementation
 * and PASS post; R1–R4 are regression sentinels (Following stays strfry; the Reputation grid
 * stays on Meili; the hook passthrough is intact) — PASS before AND after.
 *
 * FALSE-POSITIVE AVOIDANCE: the target strings exist elsewhere — `handleGetUserData` (same
 * file) already has verifiedFollowerCount / [:FOLLOWS] / NEO4J_QUERY_TIMEOUT_MS, and the
 * Reputation grid keeps `trustScores`. Backend asserts are scoped to the sliced
 * `handleGetUserCounts` function body; frontend asserts target the badge sourcing / the
 * removed raw fallback specifically.
 */

const fs = require('fs');
const path = require('path');

const USERDATA  = path.resolve(__dirname, '../src/api/export/users/queries/userdata.js');
const HOOK      = path.resolve(__dirname, '../ui/src/hooks/useUserCounts.js');
const PROFILE   = path.resolve(__dirname, '../ui/src/pages/BrainstormProfile.jsx');
const REPORTERS = path.resolve(__dirname, '../ui/src/pages/BrainstormReporters.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// Slice a single top-level function body out (so backend asserts don't match the OTHER
// handler in the same file, handleGetUserData).
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
// BACKEND — handleGetUserCounts becomes the Owner-PoV hybrid
// ===========================================================================

test('T1: handleGetUserCounts returns verifiedFollowerCount + verifiedReporterCount (AC1)', () => {
  const fn = sliceFn(safeRead(USERDATA), 'handleGetUserCounts');
  assert(fn.length > 0, 'handleGetUserCounts not found in userdata.js — unexpected.');
  assert(/verifiedFollowerCount/.test(fn) && /verifiedReporterCount/.test(fn),
    'handleGetUserCounts must return verifiedFollowerCount AND verifiedReporterCount (pre-implementation it returns only followingCount).');
});

test('T2: handleGetUserCounts reads the verified counts from Neo4j (NostrUser), not Meili (AC1)', () => {
  const fn = sliceFn(safeRead(USERDATA), 'handleGetUserCounts');
  assert(fn.length > 0, 'handleGetUserCounts not found.');
  assert(/NostrUser/.test(fn),
    'the verified counts must come from the NostrUser node (Owner PoV) — expected a Neo4j MATCH on NostrUser inside handleGetUserCounts.');
  assert(/session\.run|neo4j\.driver|executeRead/.test(fn),
    'handleGetUserCounts must run a Neo4j query for the verified counts (pre-implementation it is strfry-only via exec).');
});

test('T3: the live fallback uses the [:FOLLOWS]/[:REPORTS] edges and the correct per-metric cutoffs (AC3)', () => {
  const fn = sliceFn(safeRead(USERDATA), 'handleGetUserCounts');
  assert(fn.length > 0, 'handleGetUserCounts not found.');
  assert(/\[:FOLLOWS\]/.test(fn) && /\[:REPORTS\]/.test(fn),
    'the count-only live fallback must traverse the FOLLOWS edge (verified followers) and the REPORTS edge (verified reporters).');
  assert(/VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF/.test(fn) && /VERIFIED_REPORTERS_INFLUENCE_CUTOFF/.test(fn),
    'the fallback must filter by the SAME per-metric cutoffs the tables use — VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF and VERIFIED_REPORTERS_INFLUENCE_CUTOFF (so badge ≡ table definition).');
});

test('T4: the live fallback is count-only and deadline-bounded (AC2/AC3)', () => {
  const fn = sliceFn(safeRead(USERDATA), 'handleGetUserCounts');
  assert(fn.length > 0, 'handleGetUserCounts not found.');
  assert(/count\s*\(/.test(fn),
    'the fallback must be a count-only query (RETURN count(...)), not a full membership fetch.');
  assert(/NEO4J_QUERY_TIMEOUT_MS/.test(fn),
    'the live fallback must be bounded by NEO4J_QUERY_TIMEOUT_MS so a dense node degrades to "—" rather than hanging the profile (ADR 0031).');
});

// ===========================================================================
// FRONTEND — badges source from userCounts; the raw fallback is gone
// ===========================================================================

test('T5: the profile VF + VR badges source their value from userCounts (AC1)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/userCounts\s*\?\.\s*verifiedFollowerCount/.test(src),
    'the Verified Followers badge must read userCounts?.verifiedFollowerCount (Owner-PoV, via useUserCounts) — not trustScores.');
  assert(/userCounts\s*\?\.\s*verifiedReporterCount/.test(src),
    'the Verified Reporters badge must read userCounts?.verifiedReporterCount — not trustScores.');
});

test('T6: the badge values no longer come from Meili trustScores, and the raw-followers fallback is removed (AC2)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(!/\?\?\s*trustScores\s*\?\.\s*followers/.test(src),
    'the broken `?? trustScores?.followers` raw-followers fallback MUST be removed (it showed Jack 26,711 raw followers as "Verified Followers"). A missing value shows "—", never raw followers.');
  assert(!/trustScores\s*\?\.\s*verifiedFollowerCount/.test(src),
    'the Verified Followers badge value must no longer read trustScores?.verifiedFollowerCount (it moved to userCounts). (The Reputation grid uses trustScores[metric.tag] — bracket access — and is untouched.)');
  assert(!/trustScores\s*\?\.\s*verifiedReporterCount/.test(src),
    'the Verified Reporters badge value must no longer read trustScores?.verifiedReporterCount (it moved to userCounts).');
});

test('T7: the /reporters PoV line is relabeled from "House" to Owner (AC5)', () => {
  const src = safeRead(REPORTERS);
  assert(src.length > 0, 'BrainstormReporters.jsx missing — unexpected.');
  assert(/Relative to the owner/i.test(src),
    'the PoV line must state the Owner point of view (e.g. "Relative to the owner\'s web of trust.") — the data is Owner-PoV, not House.');
  assert(!/Relative to the House \(default\) web of trust/.test(src),
    'the old "Relative to the House (default) web of trust…" line must be removed (it mislabeled Owner-PoV data as House).');
});

// ===========================================================================
// REGRESSION SENTINELS (must PASS before AND after implementation)
// ===========================================================================

test('R1: handleGetUserCounts still computes followingCount from strfry (kind 3) — Following unchanged (AC4)', () => {
  const fn = sliceFn(safeRead(USERDATA), 'handleGetUserCounts');
  assert(fn.length > 0, 'handleGetUserCounts not found.');
  assert(/followingCount/.test(fn), 'handleGetUserCounts must still return followingCount.');
  assert(/strfry|kinds:\s*\[3\]|kind 3|\[3\]/.test(fn),
    'followingCount must still be derived from the strfry kind-3 scan (the kind 3 event is the source of truth; not moved to Neo4j).');
});

test('R2: the profile Following count still reads userCounts.followingCount and links to /follows (AC4)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/userCounts\s*\?\.\s*followingCount/.test(src), 'Following must still read userCounts?.followingCount.');
  assert(/\/user\/\$\{pubkey\}\/follows/.test(src), 'the Following count must still link to /user/${pubkey}/follows.');
});

test('R3: the Reputation grid still uses Meili trustScores — only the badges moved (regression)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/\/api\/search\/profiles\/meili\/document/.test(src),
    'the Reputation section must still fetch the Meili document (trustScores) — this story moves only the two count badges off Meili.');
  assert(/TRUST_METRICS/.test(src) && /trustScores\s*\[/.test(src),
    'the Reputation grid must still render TRUST_METRICS from trustScores[metric.tag].');
});

test('R4: useUserCounts still passes json.data through unchanged, so the new fields reach the page without a hook change (regression)', () => {
  const src = safeRead(HOOK);
  assert(src.length > 0, 'useUserCounts.js missing — unexpected.');
  assert(/setData\(\s*json\.data\s*\)/.test(src),
    'useUserCounts must keep setting data = json.data wholesale (so verifiedFollowerCount/verifiedReporterCount flow through without a hook change).');
  assert(/return\s*\{\s*data/.test(src), 'useUserCounts must keep returning { data, ... }.');
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
