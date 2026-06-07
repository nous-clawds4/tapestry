/**
 * Story verified-reporters #3: Verified Reporters list page.
 * ADR 0003 (verified-reporters). See
 * engineering-team/stories/verified-reporters/3-verified-reporters-list-page.test-plan.md
 *
 * ADR 0003 chose Option A: a new ui/src/pages/BrainstormReporters.jsx mirroring
 * BrainstormFollowers.jsx, at route /user/:pubkey/reporters (App.jsx), consuming the
 * existing useGrapevineReporters hook (Story 2). Deltas the page must carry: the
 * reporters hook, STORAGE_KEY 'bsp-reporters-columns', the style-guide copy (title,
 * description, House PoV line, empty state, error+retry), the extended About-this-data
 * popover, default sort by RANK descending (not verifiedFollowerCount), a skeleton
 * loader (not a text loader), and a backward-compatible `refetch` added to the hook.
 *
 * Tests are source-regex sentinels — the profile-follows-list / profile-followers-list
 * precedent. The page + route do not exist pre-implementation, so T1–T14 FAIL now and
 * PASS once built. R1–R3 are regression sentinels — PASS before AND after (the existing
 * follows/followers routes and the untouched BrainstormFollowers page).
 *
 * FALSE-POSITIVE AVOIDANCE: ui/src/App.jsx and BrainstormFollowers.jsx already contain
 * "reporters"/"Verified Reporters"/"verifiedReporterCount" (the followers page has a
 * "Verified Reporters" COLUMN). Each sentinel targets the NEW reporters page/route
 * specifically — BrainstormReporters, /user/:pubkey/reporters, the reporters hook,
 * 'bsp-reporters-columns', and the reporters-specific copy — none of which exist now.
 */

const fs = require('fs');
const path = require('path');

const PAGE    = path.resolve(__dirname, '../ui/src/pages/BrainstormReporters.jsx');
const APP     = path.resolve(__dirname, '../ui/src/App.jsx');
const STYLES  = path.resolve(__dirname, '../ui/src/styles.css');
const HOOK    = path.resolve(__dirname, '../ui/src/hooks/useGrapevineReporters.js');
const FOLLOWERS_PAGE = path.resolve(__dirname, '../ui/src/pages/BrainstormFollowers.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// AC1 — route registration
test('T1: ui/src/App.jsx registers /user/:pubkey/reporters → BrainstormReporters (AC1)', () => {
  const src = safeRead(APP);
  assert(src.length > 0, 'ui/src/App.jsx missing — unexpected.');
  assert(/\/user\/:pubkey\/reporters/.test(src),
    "App.jsx must declare a route with path '/user/:pubkey/reporters' (the link target Story 1's count points at).");
  assert(/BrainstormReporters/.test(src),
    'App.jsx must import and map the reporters route to the BrainstormReporters page component.');
});

// AC1 — page exists, reads :pubkey, title + back link + description
test('T2: BrainstormReporters.jsx exists, reads :pubkey, shows the title, back link, and description (AC1)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'ui/src/pages/BrainstormReporters.jsx does not exist yet — the Implementer must create the reporters page.');
  assert(/useParams/.test(src), 'BrainstormReporters.jsx must read the :pubkey route param via useParams.');
  assert(/Verified Reporters/.test(src), 'the page title must be "Verified Reporters".');
  assert(/Back to profile/i.test(src) && /\/user\/\$\{pubkey\}(?!\/)/.test(src),
    'the page must have a "Back to profile" link to `/user/${pubkey}` (the profile).');
  assert(/Verified users who have reported this account\./.test(src),
    'the page must show the description "Verified users who have reported this account." (style guide, verbatim).');
});

// AC1/AC4 — sources rows from the Story-2 hook
test('T3: the page sources its rows from the useGrapevineReporters hook (AC1/AC4)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx does not exist yet.');
  assert(/useGrapevineReporters/.test(src),
    'BrainstormReporters.jsx must consume the useGrapevineReporters hook (Story 2 data; House PoV). Its row count is the live count — never the Meili profile badge.');
});

// AC2 — columns + Rank rendered + DataTable reuse
test('T4: columns include Rank (round(influence*100)) and the page reuses DataTable (AC2)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx does not exist yet.');
  assert(/DataTable/.test(src), 'BrainstormReporters.jsx must reuse the DataTable component (mirror of BrainstormFollowers).');
  assert(/\brank\b/.test(src), 'the page must define a `rank` column (default-visible: picture/name/rank).');
  assert(/Math\.round\(\s*[\w.?]+\s*\*\s*100\s*\)/.test(src),
    'rank must be computed as Math.round(influence * 100) — an integer 0–100 (cf. BrainstormFollowers.jsx:127).');
});

// AC2 — DEFAULT SORT is rank descending, NOT verifiedFollowerCount (copy-paste guard)
test('T5: default sort is by RANK descending, not by verifiedFollowerCount (AC2)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx does not exist yet.');
  assert(/\.sort\s*\(/.test(src), 'the page must pre-sort the whole set before render (like BrainstormFollowers).');
  assert(/b\.rank[\s\S]{0,18}a\.rank/.test(src),
    'the default sort must be by RANK descending — a comparator like `(b.rank ?? -1) - (a.rank ?? -1)` (most credible reporters first; ADR 0003).');
  assert(!/b\.verifiedFollowerCount[\s\S]{0,30}a\.verifiedFollowerCount/.test(src),
    'copy-paste guard: the default sort must NOT remain verifiedFollowerCount desc (that is the FOLLOWERS page default). Reporters sort by rank.');
});

// AC3 — row click navigates to the reporter's profile
test('T6: selecting a reporter row navigates to that reporter\'s /user/<pubkey> profile (AC3)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx does not exist yet.');
  assert(/onRowClick/.test(src) && /navigate\(\s*`\/user\/\$\{[^}]*pubkey\}`/.test(src),
    'rows must navigate to /user/<that-pubkey> (e.g. onRowClick={row => navigate(`/user/${row.pubkey}`)}).');
});

// AC5 — House PoV line, verbatim
test('T7: the page shows the Owner point-of-view line (AC5; relabeled by ADR 0031)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx does not exist yet.');
  assert(/Relative to the owner/i.test(src),
    'the page must show the Owner PoV line (e.g. "Relative to the owner\'s web of trust.") — the data is Owner-PoV (Neo4j), so the owner is the honest attribution. ADR 0031 relabeled this from the original "House" wording.');
  assert(!/Relative to the House \(default\) web of trust/.test(src),
    'the old "House (default) web of trust" line must be gone (it mislabeled Owner-PoV data as House).');
});

// AC5 — popover: RETIRED. The "About this data" popover was replaced by the shared
// VerificationInfo ("What does \"verification\" mean?") popover in profile #36 / ADR 0032
// (it no longer carries the local/NIP-85 or "no single global number" copy). The new
// popover is covered by the profile-verified-counts-explainer-and-alarm suite (T4/T5).

// AC6 — empty state, verbatim
test('T9: the empty state uses the style-guide copy (AC6)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx does not exist yet.');
  assert(/No verified reporters\. No one in this web of trust has reported this account\./.test(src),
    'the empty state must read "No verified reporters. No one in this web of trust has reported this account." (style guide, verbatim) — not the followers copy, not a blank, not an error.');
});

// AC7 — skeleton loader (page element + CSS), not a bare text loader
test('T10: loading shows a skeleton placeholder (a .bsp-skeleton-row + shimmer keyframes), not a bare spinner (AC7)', () => {
  const src = safeRead(PAGE);
  const css = safeRead(STYLES);
  assert(src.length > 0, 'BrainstormReporters.jsx does not exist yet.');
  assert(css.length > 0, 'ui/src/styles.css missing — unexpected.');
  assert(/bsp-skeleton-row/.test(src),
    'the loading state must render skeleton placeholder rows (a `bsp-skeleton-row` element) — ADR 0003 / AC7, improving on the followers text loader.');
  const rule = css.match(/\.bsp-skeleton-row\s*\{[^}]*\}/);
  assert(rule, 'styles.css must define a `.bsp-skeleton-row` rule.');
  assert(/@keyframes\s+bsp-shimmer/.test(css),
    'styles.css must define the `@keyframes bsp-shimmer` animation the skeleton uses.');
});

// AC7 — error message (verbatim) + retry control
test('T11: the error state shows the style-guide copy and a "Try again" retry control (AC7)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx does not exist yet.');
  assert(/Couldn't load reporters\. Trust scores may still be computing for this view\./.test(src),
    'the error must show "Couldn\'t load reporters. Trust scores may still be computing for this view. Try again in a moment." (style guide) — never a raw error or "Something went wrong".');
  assert(/Try again/.test(src),
    'the error state must offer a "Try again" retry control (AC7).');
});

// AC7 — the hook gains a backward-compatible refetch the retry calls
test('T12: useGrapevineReporters exposes a refetch/reload, and the page wires the retry to it (AC7)', () => {
  const hook = safeRead(HOOK);
  const page = safeRead(PAGE);
  assert(hook.length > 0, 'useGrapevineReporters.js missing — unexpected (Story 2 created it).');
  assert(/refetch|reload/.test(hook),
    'useGrapevineReporters.js must expose a `refetch` (or `reload`) so the page can retry on error — a backward-compatible addition to the returned object.');
  assert(page.length > 0, 'BrainstormReporters.jsx does not exist yet.');
  assert(/refetch|reload/.test(page),
    'the page must call the hook\'s refetch/reload from the "Try again" button.');
});

// Delta — distinct localStorage key
test('T13: the page uses a distinct localStorage key bsp-reporters-columns (delta)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx does not exist yet.');
  assert(/bsp-reporters-columns/.test(src),
    "the page must use STORAGE_KEY 'bsp-reporters-columns' (distinct from follows/followers so column prefs don't clobber each other).");
});

// Regression guard carried into the new page — /api/profiles batch cap (the #29/#34 staging bug)
test('T14: the page batches /api/profiles at PROFILE_CHUNK ≤ 50 (regression guard inherited)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx does not exist yet.');
  const m = src.match(/PROFILE_CHUNK\s*=\s*(\d+)/);
  assert(m, 'BrainstormReporters.jsx must define PROFILE_CHUNK (the /api/profiles batch size).');
  const chunk = parseInt(m[1], 10);
  assert(chunk >= 1 && chunk <= 50,
    `PROFILE_CHUNK=${chunk} must be 1..50 — /api/profiles 400s for >50 pubkeys (fetchProfiles.js:148; the staging Name-column bug).`);
});

// ===========================================================================
// REGRESSION SENTINELS (must PASS before AND after implementation)
// ===========================================================================

test('R1: App.jsx still registers the follows and followers routes (regression)', () => {
  const src = safeRead(APP);
  assert(src.length > 0, 'ui/src/App.jsx missing — unexpected.');
  assert(/\/user\/:pubkey\/follows/.test(src) && /\/user\/:pubkey\/followers/.test(src),
    'the existing /user/:pubkey/follows and /user/:pubkey/followers routes must remain (the reporters route is added beside them).');
});

test('R2: BrainstormFollowers.jsx is untouched — still uses useGrapevineFollowers + its own storage key (regression)', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx missing — unexpected.');
  assert(/useGrapevineFollowers/.test(src),
    'BrainstormFollowers.jsx must still use the followers hook (ADR 0003 adds a NEW page; it must not edit the followers page).');
  assert(/bsp-followers-columns/.test(src),
    "BrainstormFollowers.jsx must keep its own STORAGE_KEY 'bsp-followers-columns'.");
});

test('R3: BrainstormFollowers default sort remains verifiedFollowerCount desc (the reporters page must not have changed it)', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx missing — unexpected.');
  assert(/verifiedFollowerCount/.test(src) && /\.sort\s*\(/.test(src),
    'BrainstormFollowers.jsx must keep its verifiedFollowerCount default sort (guard against editing the wrong file).');
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
