/**
 * Story #34 / ADR 0030 — followers list on the primary profile page (v1: verified
 * followers, owner POV). The inbound mirror of the follows list (#29 / ADR 0026).
 * See engineering-team/stories/profile/34-profile-followers-list.test-plan.md
 *
 * ADR 0030 chose Option A (MIRROR, not generalize): a NEW isolated endpoint
 * GET /api/get-grapevine-followers (reverse direction + verified filter) + a NEW
 * page BrainstormFollowers.jsx + a NEW hook useGrapevineFollowers.js + route
 * /user/:pubkey/followers — leaving the live follows feature untouched — and the
 * #33 "Verified Followers" count becomes a <Link> to the new page. v1: verified
 * followers only (WHERE follower.influence > VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF),
 * owner/House POV, whole-set fetch + client-side 50-row pagination (#29 parity).
 *
 * Source-regex sentinels (the #29 profile-follows-list precedent — no React render
 * harness in this repo). Browser behavior is in the supplementary Playwright spec
 * tests/brainstorm/profile-followers-list.spec.js.
 *
 * Direction note: "follows"/"following" = OUTBOUND (observee)-[:FOLLOWS]->(x);
 * "followers" = INBOUND (x)-[:FOLLOWS]->(observee). The substrings differ
 * (`follows` vs `followers`), so route/endpoint regexes don't cross-match.
 *
 * T* must FAIL pre-implementation and PASS post-implementation.
 * R* are regression sentinels — PASS before AND after (they guard the live #29
 * follows feature, which ADR 0030 chose NOT to touch).
 */

const fs = require('fs');
const path = require('path');

const FOLLOWERS_HANDLER = path.resolve(__dirname, '../src/api/grapevineInteractions/queries/followersWithMetrics.js');
const FOLLOWS_HANDLER   = path.resolve(__dirname, '../src/api/grapevineInteractions/queries/followsWithMetrics.js');
const API_INDEX         = path.resolve(__dirname, '../src/api/index.js');
const APP_JSX           = path.resolve(__dirname, '../ui/src/App.jsx');
const FOLLOWERS_PAGE    = path.resolve(__dirname, '../ui/src/pages/BrainstormFollowers.jsx');
const FOLLOWS_PAGE      = path.resolve(__dirname, '../ui/src/pages/BrainstormFollows.jsx');
const FOLLOWERS_HOOK    = path.resolve(__dirname, '../ui/src/hooks/useGrapevineFollowers.js');
const PROFILE_PAGE      = path.resolve(__dirname, '../ui/src/pages/BrainstormProfile.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function countOf(src, re) { return (src.match(re) || []).length; }

// ===========================================================================
// BACKEND — new endpoint GET /api/get-grapevine-followers (owner POV, verified)
// ===========================================================================

test('T1: followersWithMetrics.js exists and exports handleGetGrapevineFollowers (ADR 0030 §Impl)', () => {
  const src = safeRead(FOLLOWERS_HANDLER);
  assert(src.length > 0,
    'src/api/grapevineInteractions/queries/followersWithMetrics.js does not exist yet — ADR 0030 (Option A) calls for a NEW endpoint handler mirroring followsWithMetrics.js.');
  assert(/handleGetGrapevineFollowers/.test(src), 'followersWithMetrics.js must define handleGetGrapevineFollowers.');
  assert(/module\.exports\s*=\s*\{[\s\S]*handleGetGrapevineFollowers/.test(src),
    'followersWithMetrics.js must export handleGetGrapevineFollowers so src/api/index.js can register it.');
});

test('T2: handler requires + 64-hex-validates `observee`, returning 400 otherwise (AC: Direct load / input validation)', () => {
  const src = safeRead(FOLLOWERS_HANDLER);
  assert(src.length > 0, 'followersWithMetrics.js does not exist yet.');
  assert(/req\.query\.observee/.test(src), 'handler must read the `observee` query param.');
  assert(/\.status\(\s*400\s*\)/.test(src), 'handler must return HTTP 400 for a missing/invalid observee.');
  assert(/[0-9a-f]\{64\}|\{\s*64\s*\}|npubEncode/i.test(src),
    'handler must validate the pubkey shape (64-hex or nip19.npubEncode round-trip, like followsWithMetrics.js).');
});

test('T3: Cypher is INBOUND (follower)-[:FOLLOWS]->(observee), VERIFIED-filtered (influence > cutoff), returns all six fields (AC: Listing / Verified scope / Owner POV)', () => {
  const src = safeRead(FOLLOWERS_HANDLER);
  assert(src.length > 0, 'followersWithMetrics.js does not exist yet.');
  // Inbound direction: the FOLLOWS edge must point TO observee (vs follows, which points to a followee).
  assert(/:FOLLOWS\s*\]\s*->\s*\(\s*observee/.test(src),
    'handler Cypher must traverse INBOUND: (follower)-[:FOLLOWS]->(observee). (Outbound (observee)-[:FOLLOWS]->(f) would be the follows query.)');
  // Verified-only filter reusing the existing cutoff parameter.
  assert(/influence\s*>/.test(src),
    'handler must filter verified followers with a WHERE influence > cutoff clause (v1 lists only verified followers).');
  assert(/VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF/.test(src),
    'the verified cutoff must reuse VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF (getConfigFromFile) — do not invent a new constant (ADR 0030).');
  for (const field of ['pubkey', 'influence', 'hops', 'verifiedFollowerCount', 'verifiedMuterCount', 'verifiedReporterCount']) {
    assert(new RegExp('\\b' + field + '\\b').test(src),
      `handler must surface \`${field}\` per row (same six fields as the follows endpoint, read from the follower's NostrUser node for owner POV).`);
  }
});

test('T4: handler enforces the Neo4j deadline (NEO4J_QUERY_TIMEOUT_MS) with a 504 {success:false} branch (AC: graceful at scale; ADR §Impl)', () => {
  const src = safeRead(FOLLOWERS_HANDLER);
  assert(src.length > 0, 'followersWithMetrics.js does not exist yet.');
  assert(/NEO4J_QUERY_TIMEOUT_MS/.test(src), 'handler must read NEO4J_QUERY_TIMEOUT_MS (same deadline pattern as followsWithMetrics.js).');
  assert(/session\.(run|executeRead|readTransaction)\s*\([\s\S]{0,400}\btimeout\s*:/.test(src),
    'handler must pass a driver-layer { timeout: ... } so the heavy inbound traversal fails fast.');
  const win = src.match(/\.status\(\s*504\s*\)\s*\.json\(\s*\{[\s\S]{0,400}?\}/);
  assert(win, 'handler must return HTTP 504 with a JSON body on timeout (mega-account watch-out, ADR 0030).');
  assert(/success\s*:\s*false/.test(win[0]), 'the 504 JSON body must include success:false.');
});

test('T5: a non-owner `observer` is rejected with 400 (owner-only v1; customer POV deferred — story §Deferred)', () => {
  const src = safeRead(FOLLOWERS_HANDLER);
  assert(src.length > 0, 'followersWithMetrics.js does not exist yet.');
  assert(/observer/.test(src), 'handler must look at the `observer` param to reject non-owner values in v1.');
  assert(/\.status\(\s*400\s*\)[\s\S]{0,260}(customer|owner[\s-]?only|not\s*(yet\s*)?support)/i.test(src) ||
         /(customer|owner[\s-]?only|not\s*(yet\s*)?support)[\s\S]{0,260}\.status\(\s*400\s*\)/i.test(src),
    'a non-owner `observer` must return 400 (customer observers deferred, exactly like followsWithMetrics.js).');
});

test('T6: GET /api/get-grapevine-followers is registered in src/api/index.js → handleGetGrapevineFollowers (AC: Direct load)', () => {
  const src = safeRead(API_INDEX);
  assert(src.length > 0, 'src/api/index.js missing — unexpected.');
  assert(/['"]\/api\/get-grapevine-followers['"]/.test(src),
    "src/api/index.js must register '/api/get-grapevine-followers' (next to get-grapevine-follows).");
  assert(/handleGetGrapevineFollowers/.test(src), 'src/api/index.js must wire the route to handleGetGrapevineFollowers.');
});

test('T7: success response carries success:true, observer, observee, count, data[] (ADR §Impl response shape)', () => {
  const src = safeRead(FOLLOWERS_HANDLER);
  assert(src.length > 0, 'followersWithMetrics.js does not exist yet.');
  for (const key of ['success', 'observer', 'observee', 'count', 'data']) {
    assert(new RegExp('\\b' + key + '\\b').test(src),
      `the success response must include \`${key}\` (same shape as get-grapevine-follows).`);
  }
});

// ===========================================================================
// FRONTEND — route, page, hook, the count→link, and #29 table parity
// ===========================================================================

test('T8: ui/src/App.jsx registers the /user/:pubkey/followers route → BrainstormFollowers (AC: Direct load)', () => {
  const src = safeRead(APP_JSX);
  assert(src.length > 0, 'ui/src/App.jsx missing — unexpected.');
  assert(/\/user\/:pubkey\/followers/.test(src), "App.jsx must declare a route with path '/user/:pubkey/followers'.");
  assert(/BrainstormFollowers/.test(src), 'App.jsx must map the followers route to the BrainstormFollowers page.');
});

test('T9: ui/src/pages/BrainstormFollowers.jsx exists, reads :pubkey, loads followers, has an empty state (AC: Listing)', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx does not exist yet — the Implementer must create the followers page (mirror BrainstormFollows.jsx).');
  assert(/useParams/.test(src), 'BrainstormFollowers.jsx must read the :pubkey route param via useParams.');
  assert(/useGrapevineFollowers|get-grapevine-followers/.test(src),
    'BrainstormFollowers.jsx must source rows from the followers endpoint (via useGrapevineFollowers or a direct fetch).');
  assert(/empty|no verified followers|no followers|0 followers/i.test(src),
    'BrainstormFollowers.jsx must render an empty-state message when N = 0 (AC: Listing).');
});

test('T10: ui/src/hooks/useGrapevineFollowers.js fetches /api/get-grapevine-followers (AC: Listing)', () => {
  const src = safeRead(FOLLOWERS_HOOK);
  assert(src.length > 0, 'useGrapevineFollowers.js does not exist yet — mirror useGrapevineFollows.js.');
  assert(/get-grapevine-followers/.test(src), 'useGrapevineFollowers.js must call /api/get-grapevine-followers.');
  assert(/fetch\s*\(/.test(src), 'useGrapevineFollowers.js must use fetch (useUserCounts/useGrapevineFollows convention).');
});

test('T11: the profile "Verified Followers" count links to /user/:pubkey/followers in the same tab (AC: Entry point; reverses #33)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/\/user\/\$\{pubkey\}\/followers/.test(src),
    'BrainstormProfile.jsx must link the Verified Followers count to `/user/${pubkey}/followers` (it shipped plain in #33; #34 makes it a <Link>).');
  // Both prominent counters are now links → Following (/follows) + Verified Followers (/followers).
  assert(countOf(src, /bsp-count-link/g) >= 2,
    'the Verified Followers counter must become a <Link className="...bsp-count-link"> (expected >=2 bsp-count-link: Following + Verified Followers).');
});

test('T12: the followers page has a "Back to profile" link to /user/:pubkey (AC: Return)', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx does not exist yet.');
  assert(/back to profile/i.test(src), 'BrainstormFollowers.jsx must render a "Back to profile" control.');
  assert(/\/user\/\$\{pubkey\}(?!\/follow)/.test(src) || /to=\{`\/user\/\$\{pubkey\}`\}/.test(src),
    'the back control must navigate to `/user/${pubkey}` (the profile, not the followers/follows page).');
});

test('T13: each row navigates to that account\'s own /user/<pubkey> profile (AC: Row navigation)', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx does not exist yet.');
  assert(/onRowClick|navigate\s*\(|to=\{`\/user\//.test(src) && /\/user\//.test(src),
    'BrainstormFollowers.jsx rows must navigate to /user/<that-pubkey> (e.g. onRowClick → navigate(`/user/${row.pubkey}`)).');
});

test('T14: the page defines all columns incl. default visibility (pic/name/rank shown; npub/hops/verified* hidden) (AC: Default visibility)', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx does not exist yet.');
  for (const key of ['name', 'rank', 'npub', 'hops', 'verifiedFollowerCount', 'verifiedMuterCount', 'verifiedReporterCount']) {
    assert(new RegExp('\\b' + key + '\\b').test(src), `BrainstormFollowers.jsx must define the \`${key}\` column.`);
  }
  assert(/pic|picture|avatar/i.test(src), 'BrainstormFollowers.jsx must define the picture/avatar column.');
  assert(/default/i.test(src) && /(hidden|visible|show|hide)/i.test(src),
    'BrainstormFollowers.jsx must encode default column visibility (pic/name/rank shown; npub/hops/verified* hidden).');
});

test('T15: rank is round(influence*100) with a "—" fallback when influence is null (AC: Rank)', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx does not exist yet.');
  assert(/Math\.round\(\s*[\w.?]+\s*\*\s*100\s*\)/.test(src), 'rank must be Math.round(influence * 100) — an integer 0–100.');
  assert(/—/.test(src), 'rank must fall back to "—" when influence is null/absent.');
});

test('T16: the name column falls back display_name → name → shortened npub (AC: Name fallback)', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx does not exist yet.');
  assert(/display_name\s*\|\|\s*[\w.?[\]'"()]*\bname\b/.test(src),
    'the name cell must use the fallback chain display_name || name || <shortened npub>.');
});

test('T17: npub is derived via nip19.npubEncode (AC: Name fallback / npub column)', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx does not exist yet.');
  assert(/npubEncode/.test(src), 'BrainstormFollowers.jsx must derive npub via nip19.npubEncode(pubkey).');
});

test('T18: the page reuses DataTable for sort + search/filter (AC: Re-sort, Search)', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx does not exist yet.');
  assert(/DataTable/.test(src), 'BrainstormFollowers.jsx must reuse ui/src/components/DataTable.jsx (ADR §Impl).');
});

test('T19: the page implements pagination (AC: Pagination)', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx does not exist yet.');
  assert(/page\s*size|pagesize|currentPage|setPage|pageIndex|\bpaginat/i.test(src),
    'BrainstormFollowers.jsx must paginate results client-side (50-row blocks, like Follows).');
});

test('T20: default sort is verifiedFollowerCount descending across the whole set (AC: Default sort)', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx does not exist yet.');
  assert(/verifiedFollowerCount/.test(src) && /sort\s*\(/.test(src),
    'BrainstormFollowers.jsx must pre-sort the full data set by verifiedFollowerCount (descending) before render.');
});

test('T21: column show/hide choices persist via localStorage with a reset, under a followers-specific key (AC: Persistence)', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx does not exist yet.');
  assert(/localStorage/.test(src), 'column visibility prefs must persist via localStorage (AC: Persistence).');
  assert(/reset/i.test(src), 'the page must offer a "reset to defaults" control.');
  assert(/followers/i.test(src) && !/['"`][^'"`]*bsp-follows-columns[^'"`]*['"`]/.test(src),
    'use a FOLLOWERS-specific localStorage key (e.g. bsp-followers-columns) — must NOT reuse the follows key `bsp-follows-columns`, or the two pages would clobber each other.');
});

test('T22: the local-data ⓘ disclosure states data is computed locally and NOT via NIP-85, and opens on tap (AC: Local-data disclosure)', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx does not exist yet.');
  assert(/NIP-?85/i.test(src), 'the disclosure must mention NIP-85 (data is NOT imported via NIP-85).');
  assert(/comput(e|ed)\s+locally|locally by this|this Tapestry instance/i.test(src),
    'the disclosure must state the data is computed locally by this Tapestry instance.');
  assert(/onClick/.test(src), 'the ⓘ affordance must open on tap/click (mobile-friendly), not hover-only.');
});

test('T23: the /api/profiles batch size respects the server cap (PROFILE_CHUNK ≤ 50) — the #29 Name-column regression guard', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx does not exist yet.');
  const m = src.match(/PROFILE_CHUNK\s*=\s*(\d+)/);
  assert(m, 'BrainstormFollowers.jsx must define `PROFILE_CHUNK` (the /api/profiles batch size) — at followers scale this matters even more.');
  const chunk = parseInt(m[1], 10);
  assert(chunk >= 1 && chunk <= 50, `PROFILE_CHUNK=${chunk} must be 1..50 — /api/profiles 400s for >50 pubkeys (fetchProfiles.js).`);
});

// ===========================================================================
// REGRESSION SENTINELS — guard the live #29 follows feature (ADR 0030 = mirror, not generalize)
// ===========================================================================

test('R1: the live follows endpoint (followsWithMetrics.js) is UNCHANGED — still OUTBOUND, still unfiltered (ADR chose mirror, not generalize)', () => {
  const src = safeRead(FOLLOWS_HANDLER);
  assert(src.length > 0, 'followsWithMetrics.js missing — unexpected.');
  assert(/:FOLLOWS\s*\]\s*->\s*\(\s*f\b/.test(src),
    'the follows endpoint must still traverse OUTBOUND (observee)-[:FOLLOWS]->(f). If this fails, the Implementer generalized it instead of adding a separate followers endpoint (Option B), regressing live Follows.');
  assert(!/influence\s*>/.test(src),
    'the follows endpoint must NOT gain a verified `influence > cutoff` filter — follows lists ALL follows; only the new followers endpoint filters to verified.');
});

test('R2: the live follows page (BrainstormFollows.jsx) is UNCHANGED — still uses the useGrapevineFollows hook', () => {
  const src = safeRead(FOLLOWS_PAGE);
  assert(src.length > 0, 'BrainstormFollows.jsx missing — unexpected.');
  assert(/useGrapevineFollows\b/.test(src),
    'BrainstormFollows.jsx must remain the follows page using the `useGrapevineFollows` hook — followers is a NEW parallel page (ADR 0030 = mirror, not generalize), so this page must not be repurposed to useGrapevineFollowers.');
});

test('R3: the existing /api/get-grapevine-follows route remains registered (live follows endpoint unregressed)', () => {
  const src = safeRead(API_INDEX);
  assert(src.length > 0, 'src/api/index.js missing — unexpected.');
  assert(/['"]\/api\/get-grapevine-follows['"]/.test(src),
    'the existing /api/get-grapevine-follows registration must remain.');
});

test('R4: BrainstormProfile still shows the Following count via useUserCounts + a <Link> to /follows (count area unregressed)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/useUserCounts/.test(src), 'BrainstormProfile.jsx must keep useUserCounts for the Following count.');
  assert(/\/user\/\$\{pubkey\}\/follows/.test(src) && /bsp-count-label[^>]*>\s*Following/.test(src),
    'the Following count must remain a <Link> to /user/${pubkey}/follows with its "Following" label (Verified Followers is added beside it, not replacing it).');
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
