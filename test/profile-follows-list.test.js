/**
 * Story #29: Follows list on the primary profile page (v1 — owner POV only).
 * ADR 0026. See engineering-team/stories/29-profile-follows-list.test-plan.md
 *
 * v1 ships a standalone /user/:pubkey/follows React page backed by a NEW
 * endpoint GET /api/get-grapevine-follows that lists who <observee> follows
 * with owner-POV metrics (rank from influence, hops, and the three verified
 * counts) read straight from the NostrUser node. Customer observers (the
 * NostrUserWotMetricsCard branch, POV selector, ?observer=<customer>) are
 * DEFERRED and intentionally NOT tested here.
 *
 * Tests are intentionally source-regex (matching the per-query-neo4j-timeout
 * and admin-tools-dashboard-panel precedents) so the spec is pinned without
 * prescribing the exact wiring the Implementer chooses. Browser-level behavior
 * (clicking, persistence across reload, popover tap) is covered by the
 * Playwright spec tests/brainstorm/profile-follows-list.spec.js.
 *
 * T* tests must FAIL pre-implementation and PASS post-implementation.
 * R* sentinels must PASS both before and after (they guard existing behavior
 * and the ADR's Option-A decision); if an R* flips to FAIL, something regressed.
 */

const fs = require('fs');
const path = require('path');

const FOLLOWS_HANDLER = path.resolve(__dirname, '../src/api/grapevineInteractions/queries/followsWithMetrics.js');
const API_INDEX       = path.resolve(__dirname, '../src/api/index.js');
const CYPHER          = path.resolve(__dirname, '../src/api/grapevineInteractions/queries/cypherQueries.js');
const APP_JSX         = path.resolve(__dirname, '../ui/src/App.jsx');
const FOLLOWS_PAGE    = path.resolve(__dirname, '../ui/src/pages/BrainstormFollows.jsx');
const FOLLOWS_HOOK    = path.resolve(__dirname, '../ui/src/hooks/useGrapevineFollows.js');
const PROFILE_PAGE    = path.resolve(__dirname, '../ui/src/pages/BrainstormProfile.jsx');
const STYLES          = path.resolve(__dirname, '../ui/src/styles.css');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// ===========================================================================
// BACKEND — new endpoint GET /api/get-grapevine-follows (owner POV)
// ===========================================================================

test('T1: src/api/grapevineInteractions/queries/followsWithMetrics.js exists and exports handleGetGrapevineFollows (ADR 0026 §Impl)', () => {
  const src = safeRead(FOLLOWS_HANDLER);
  assert(src.length > 0,
    'followsWithMetrics.js does not exist yet — the Implementer must create the new endpoint handler (ADR 0026 chose Option A: a new endpoint).');
  assert(/handleGetGrapevineFollows/.test(src),
    'followsWithMetrics.js must define handleGetGrapevineFollows.');
  assert(/module\.exports\s*=\s*\{[\s\S]*handleGetGrapevineFollows/.test(src),
    'followsWithMetrics.js must export handleGetGrapevineFollows so src/api/index.js can register it.');
});

test('T2: handler requires + 64-hex-validates `observee`, returning 400 otherwise (AC: Listing / input validation)', () => {
  const src = safeRead(FOLLOWS_HANDLER);
  assert(src.length > 0, 'followsWithMetrics.js does not exist yet.');
  assert(/req\.query\.observee/.test(src),
    'handler must read the `observee` query param (req.query.observee).');
  assert(/\.status\(\s*400\s*\)/.test(src),
    'handler must return HTTP 400 for a missing/invalid observee.');
  assert(/[0-9a-f]\{64\}|\{\s*64\s*\}|npubEncode/i.test(src),
    'handler must validate the pubkey shape (64-hex, e.g. /^[0-9a-f]{64}$/i, or a nip19.npubEncode round-trip like userdata.js:30-35).');
});

test('T3: owner-POV Cypher traverses (observee)-[:FOLLOWS]->(followee) and RETURNs all six per-row fields from the node (AC: Owner point of view)', () => {
  const src = safeRead(FOLLOWS_HANDLER);
  assert(src.length > 0, 'followsWithMetrics.js does not exist yet.');
  assert(/:FOLLOWS\s*\]\s*->/.test(src),
    'handler Cypher must traverse the FOLLOWS edge: (observee)-[:FOLLOWS]->(followee).');
  for (const field of ['pubkey', 'influence', 'hops', 'verifiedFollowerCount', 'verifiedMuterCount', 'verifiedReporterCount']) {
    assert(new RegExp('\\b' + field + '\\b').test(src),
      `handler must surface \`${field}\` per row (AC: rank derives from influence; hops; the three verified counts — all read from the NostrUser node for owner POV).`);
  }
});

test('T4: handler enforces the Neo4j query deadline (NEO4J_QUERY_TIMEOUT_MS) and has a 504 {success:false} branch (AC: 504 on timeout; ADR §Impl, mirrors userdata.js)', () => {
  const src = safeRead(FOLLOWS_HANDLER);
  assert(src.length > 0, 'followsWithMetrics.js does not exist yet.');
  assert(/NEO4J_QUERY_TIMEOUT_MS/.test(src),
    'handler must read NEO4J_QUERY_TIMEOUT_MS (same deadline pattern as userdata.js:60).');
  assert(/session\.(run|executeRead|readTransaction)\s*\([\s\S]{0,400}\btimeout\s*:/.test(src),
    'handler must pass a driver-layer { timeout: ... } to session.run/executeRead so a runaway query fails fast (userdata.js:176).');
  const win = src.match(/\.status\(\s*504\s*\)\s*\.json\(\s*\{[\s\S]{0,400}?\}/);
  assert(win, 'handler must return HTTP 504 with a JSON object body when the query times out (no `.status(504).json({...})` found).');
  assert(/success\s*:\s*false/.test(win[0]),
    'the 504 JSON body must include `success: false` (userdata.js:276-279).');
});

test('T5: a non-owner `observer` is rejected with 400 (customer observers deferred — story §Deferred, ADR §Impl)', () => {
  const src = safeRead(FOLLOWS_HANDLER);
  assert(src.length > 0, 'followsWithMetrics.js does not exist yet.');
  assert(/observer/.test(src),
    'handler must look at the `observer` param to reject non-owner values in v1.');
  assert(/\.status\(\s*400\s*\)[\s\S]{0,260}(customer|owner[\s-]?only|not\s*(yet\s*)?support)/i.test(src) ||
         /(customer|owner[\s-]?only|not\s*(yet\s*)?support)[\s\S]{0,260}\.status\(\s*400\s*\)/i.test(src),
    'a non-owner `observer` must return 400 with a message that customer observers are not yet supported (v1 is owner-only). ' +
    'This encodes the deferred-scope contract so the Implementer does not silently coerce to owner.');
});

test('T6: GET /api/get-grapevine-follows is registered in src/api/index.js → handleGetGrapevineFollows (AC: Direct load)', () => {
  const src = safeRead(API_INDEX);
  assert(src.length > 0, 'src/api/index.js missing — unexpected.');
  assert(/['"]\/api\/get-grapevine-follows['"]/.test(src),
    "src/api/index.js must register the route '/api/get-grapevine-follows' (alongside get-grapevine-interaction near line 317).");
  assert(/handleGetGrapevineFollows/.test(src),
    'src/api/index.js must wire the route to handleGetGrapevineFollows.');
});

test('T7: success response carries success:true, observer, observee, count, data[] (ADR §Impl response shape)', () => {
  const src = safeRead(FOLLOWS_HANDLER);
  assert(src.length > 0, 'followsWithMetrics.js does not exist yet.');
  for (const key of ['success', 'observer', 'observee', 'count', 'data']) {
    assert(new RegExp('\\b' + key + '\\b').test(src),
      `the success response must include \`${key}\` (ADR: { success:true, observer:'owner', observee, count, data:[…] }).`);
  }
});

// ===========================================================================
// FRONTEND — route, page, hook, and the profile "Following" link
// (spec-bearing source pins; browser behavior is in the Playwright spec)
// ===========================================================================

test('T8: ui/src/App.jsx registers the /user/:pubkey/follows route → BrainstormFollows (AC: Direct load)', () => {
  const src = safeRead(APP_JSX);
  assert(src.length > 0, 'ui/src/App.jsx missing — unexpected.');
  assert(/\/user\/:pubkey\/follows/.test(src),
    "App.jsx must declare a route with path '/user/:pubkey/follows'.");
  assert(/BrainstormFollows/.test(src),
    'App.jsx must map the follows route to the BrainstormFollows page component.');
});

test('T9: ui/src/pages/BrainstormFollows.jsx exists, reads :pubkey, and loads the follows data (AC: Listing)', () => {
  const src = safeRead(FOLLOWS_PAGE);
  assert(src.length > 0,
    'BrainstormFollows.jsx does not exist yet — the Implementer must create the follows page.');
  assert(/useParams/.test(src),
    'BrainstormFollows.jsx must read the :pubkey route param via useParams.');
  assert(/useGrapevineFollows|get-grapevine-follows/.test(src),
    'BrainstormFollows.jsx must source rows from the follows endpoint (via the useGrapevineFollows hook or a direct fetch).');
  assert(/empty|no follows|follows nobody|0 follows/i.test(src),
    'BrainstormFollows.jsx must render an empty-state message when the user follows no one (AC: Listing, N=0).');
});

test('T10: ui/src/hooks/useGrapevineFollows.js fetches /api/get-grapevine-follows (AC: Listing)', () => {
  const src = safeRead(FOLLOWS_HOOK);
  assert(src.length > 0,
    'useGrapevineFollows.js does not exist yet — the Implementer must create the data hook (ADR §Impl).');
  assert(/get-grapevine-follows/.test(src),
    'useGrapevineFollows.js must call the /api/get-grapevine-follows endpoint.');
  assert(/fetch\s*\(/.test(src),
    'useGrapevineFollows.js must use fetch (matching the useUserCounts.js convention).');
});

test('T11: the profile "Following" count links to /user/:pubkey/follows in the same tab (AC: Entry point)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/\/user\/\$\{pubkey\}\/follows/.test(src),
    'BrainstormProfile.jsx must link the Following count to `/user/${pubkey}/follows`.');
  assert(/\bLink\b/.test(src) && /react-router-dom/.test(src),
    'BrainstormProfile.jsx must use react-router-dom <Link> (same-tab client navigation, not target=_blank).');
});

test('T12: the follows page has a "Back to profile" link to /user/:pubkey (AC: Return)', () => {
  const src = safeRead(FOLLOWS_PAGE);
  assert(src.length > 0, 'BrainstormFollows.jsx does not exist yet.');
  assert(/back to profile/i.test(src),
    'BrainstormFollows.jsx must render a "Back to profile" control.');
  assert(/\/user\/\$\{pubkey\}(?!\/follows)/.test(src) || /to=\{`\/user\/\$\{pubkey\}`\}/.test(src),
    'the back control must navigate to `/user/${pubkey}` (the profile, not the follows page).');
});

test('T13: each row navigates to that account\'s own /user/<pubkey> profile (AC: Row navigation)', () => {
  const src = safeRead(FOLLOWS_PAGE);
  assert(src.length > 0, 'BrainstormFollows.jsx does not exist yet.');
  assert(/onRowClick|navigate\s*\(|to=\{`\/user\//.test(src),
    'BrainstormFollows.jsx must make rows navigate to /user/<that-pubkey> (e.g. DataTable onRowClick → navigate(`/user/${row.pubkey}`)).');
  assert(/\/user\//.test(src),
    'row navigation target must be a /user/<pubkey> profile route.');
});

test('T14: the page defines all eight columns incl. default visibility (pic/name/rank shown; npub/hops/verified* hidden) (AC: Default visibility)', () => {
  const src = safeRead(FOLLOWS_PAGE);
  assert(src.length > 0, 'BrainstormFollows.jsx does not exist yet.');
  for (const key of ['name', 'rank', 'npub', 'hops', 'verifiedFollowerCount', 'verifiedMuterCount', 'verifiedReporterCount']) {
    assert(new RegExp('\\b' + key + '\\b').test(src),
      `BrainstormFollows.jsx must define the \`${key}\` column.`);
  }
  assert(/pic|picture|avatar/i.test(src),
    'BrainstormFollows.jsx must define the picture/avatar column.');
  assert(/default/i.test(src) && /(hidden|visible|show|hide)/i.test(src),
    'BrainstormFollows.jsx must encode default column visibility (pic/name/rank shown; npub/hops/verified* hidden).');
});

test('T15: rank is rendered as round(influence*100) with a "—" fallback when influence is null (AC: Rank)', () => {
  const src = safeRead(FOLLOWS_PAGE);
  assert(src.length > 0, 'BrainstormFollows.jsx does not exist yet.');
  assert(/Math\.round\(\s*[\w.?]+\s*\*\s*100\s*\)/.test(src),
    'rank must be computed as Math.round(influence * 100) — an integer 0–100, not a raw decimal.');
  assert(/[—–-]|null|== *null|=== *null/.test(src) && /—/.test(src),
    'rank must fall back to "—" when influence is null/absent.');
});

test('T16: the name column falls back display_name → name → shortened npub (AC: Name fallback)', () => {
  const src = safeRead(FOLLOWS_PAGE);
  assert(src.length > 0, 'BrainstormFollows.jsx does not exist yet.');
  assert(/display_name\s*\|\|\s*[\w.?[\]'"()]*\bname\b/.test(src),
    'the name cell must use the fallback chain display_name || name || <shortened npub>.');
});

test('T17: npub is derived via nip19.npubEncode (AC: Name fallback / npub column)', () => {
  const src = safeRead(FOLLOWS_PAGE);
  assert(src.length > 0, 'BrainstormFollows.jsx does not exist yet.');
  assert(/npubEncode/.test(src),
    'BrainstormFollows.jsx must derive npub via nip19.npubEncode(pubkey) (cf. BrainstormProfile:99).');
});

test('T18: the page reuses DataTable for sort + search/filter (AC: Re-sort, Search)', () => {
  const src = safeRead(FOLLOWS_PAGE);
  assert(src.length > 0, 'BrainstormFollows.jsx does not exist yet.');
  assert(/DataTable/.test(src),
    'BrainstormFollows.jsx must reuse ui/src/components/DataTable.jsx (header-click sort + cross-column filter), per ADR §Impl.');
});

test('T19: the page implements pagination (AC: Pagination)', () => {
  const src = safeRead(FOLLOWS_PAGE);
  assert(src.length > 0, 'BrainstormFollows.jsx does not exist yet.');
  assert(/page\s*size|pagesize|currentPage|setPage|pageIndex|\bpaginat/i.test(src),
    'BrainstormFollows.jsx must paginate results (DataTable has no pagination — add it at the page level).');
});

test('T20: default sort is verifiedFollowerCount descending across the whole set (AC: Default sort)', () => {
  const src = safeRead(FOLLOWS_PAGE);
  assert(src.length > 0, 'BrainstormFollows.jsx does not exist yet.');
  // ADR: pre-sort the data array by verifiedFollowerCount desc before handing to DataTable.
  assert(/verifiedFollowerCount/.test(src) && /sort\s*\(/.test(src),
    'BrainstormFollows.jsx must sort the full data set by verifiedFollowerCount (descending) before render — the default order is not just a visible page.');
});

test('T21: column show/hide choices persist via localStorage with a reset-to-defaults (AC: Persistence)', () => {
  const src = safeRead(FOLLOWS_PAGE);
  assert(src.length > 0, 'BrainstormFollows.jsx does not exist yet.');
  assert(/localStorage/.test(src),
    'column visibility prefs must persist across reloads/sessions via localStorage (AC: Persistence).');
  assert(/reset/i.test(src),
    'the page must offer a "reset to defaults" control for column visibility (AC: Persistence).');
});

test('T22: the local-data ⓘ disclosure states data is computed locally and NOT imported via NIP-85, and opens on tap (AC: Local-data disclosure)', () => {
  const src = safeRead(FOLLOWS_PAGE);
  assert(src.length > 0, 'BrainstormFollows.jsx does not exist yet.');
  assert(/NIP-?85/i.test(src),
    'the disclosure must mention NIP-85 (that the data is NOT imported via NIP-85).');
  assert(/comput(e|ed)\s+locally|locally by this|this Tapestry instance/i.test(src),
    'the disclosure must state the data is computed locally by this Tapestry instance.');
  assert(/onClick/.test(src),
    'the ⓘ affordance must open on tap/click (mobile-friendly), not hover-only — expect an onClick handler.');
});

test('T23: the /api/profiles batch size respects the server cap (PROFILE_CHUNK ≤ 50) — regression guard for the staging Name-column bug', () => {
  const src = safeRead(FOLLOWS_PAGE);
  assert(src.length > 0, 'BrainstormFollows.jsx does not exist yet.');
  // /api/profiles returns 400 for >50 pubkeys (src/api/profiles/fetchProfiles.js:148). The page must
  // batch profile lookups at <= 50, or the Name column silently falls back to npub for every row
  // (caught on staging: PROFILE_CHUNK was 100, every /api/profiles chunk 400'd, names never resolved).
  const m = src.match(/PROFILE_CHUNK\s*=\s*(\d+)/);
  assert(m, 'BrainstormFollows.jsx must define `PROFILE_CHUNK` (the /api/profiles batch size) so this invariant is guarded.');
  const chunk = parseInt(m[1], 10);
  assert(chunk >= 1 && chunk <= 50,
    `the /api/profiles batch size (PROFILE_CHUNK=${chunk}) must be 1..50 — /api/profiles 400s for >50 pubkeys (fetchProfiles.js:148).`);
});

test('T24: the follows search input must not use a fixed-length flex-basis (mobile column layout turns it into a giant height) — regression guard', () => {
  const css = safeRead(STYLES);
  assert(css.length > 0, 'ui/src/styles.css missing — unexpected.');
  const block = css.match(/\.bsp-follows-search\s*\{[^}]*\}/);
  assert(block, 'styles.css must define a `.bsp-follows-search` rule.');
  // The controls container becomes `flex-direction: column` under @media (max-width: 600px), so a
  // fixed-length flex-basis on the search input governs its HEIGHT, not width (caught on smartphone
  // portrait: input ~10x too tall; fine in landscape where the media query is off).
  assert(!/flex\s*:\s*\d+(\.\d+)?\s+\d+(\.\d+)?\s+\d+(\.\d+)?\s*(rem|px|em|vh|vw)\b/.test(block[0]),
    'the .bsp-follows-search `flex` shorthand must not use a fixed-length flex-basis (e.g. `flex: 1 1 16rem`) — in the mobile column layout that becomes the input height. Use `flex: 1 1 auto` + `min-width`.');
});

// ===========================================================================
// REGRESSION SENTINELS (must PASS before AND after implementation)
// ===========================================================================

test('R1: the shared `follows` Cypher in cypherQueries.js is UNCHANGED — ADR chose a new endpoint, not B-lite (no edit to get-grapevine-interaction)', () => {
  const src = safeRead(CYPHER);
  assert(src.length > 0, 'cypherQueries.js missing — unexpected.');
  assert(/interactionType:\s*'follows'[\s\S]{0,400}RETURN\s+followee\.pubkey AS pubkey,\s*followee\.hops AS hops,\s*followee\.influence AS influence/.test(src),
    "the existing `follows` query must still RETURN exactly {pubkey, hops, influence}. ADR 0026 chose Option A (a NEW endpoint); if this sentinel fails the Implementer modified the shared get-grapevine-interaction query (Option B-lite) instead.");
});

test('R2: BrainstormProfile.jsx still shows the Following count value + label via useUserCounts (we wrap it in a link, not remove it)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/useUserCounts/.test(src),
    'BrainstormProfile.jsx must keep using useUserCounts for the Following count.');
  assert(/bsp-count-value/.test(src) && /Following/.test(src),
    'BrainstormProfile.jsx must still render the Following count value and "Following" label (the link wraps the existing count; it is not replaced).');
});

test('R3: the existing /api/get-grapevine-interaction route remains registered (legacy page unregressed)', () => {
  const src = safeRead(API_INDEX);
  assert(src.length > 0, 'src/api/index.js missing — unexpected.');
  assert(/['"]\/api\/get-grapevine-interaction['"]/.test(src),
    'the existing /api/get-grapevine-interaction registration must remain (the legacy grapevine-analysis page depends on it).');
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
