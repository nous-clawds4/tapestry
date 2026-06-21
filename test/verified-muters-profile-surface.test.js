/**
 * Story verified-muters #2: Verified Muters profile surface (badge + line break + list page).
 * ADR 0002 (verified-muters). See
 * engineering-team/stories/verified-muters/2-verified-muters-profile-surface.test-plan.md
 *
 * ADR 0002 chose, all "Option A":
 *   - Badge: a NEW always-on neutral .bsp-count .bsp-count-link <Link> to
 *     /user/:pubkey/muters in BrainstormProfile.jsx's .bsp-counts row, slotted AFTER
 *     Hops (and its break) and BEFORE the Verified Reporters block. Structural twin of
 *     the Verified Followers <Link> — reads userCounts?.verifiedMuterCount, formatted by
 *     fmtCount. NO .bsp-count-value-negative, NO alarm icon, NO 0-hides branch.
 *   - Line break: a NEW zero-size .bsp-count-break element (flex-basis:100%; height:0;)
 *     inserted between the Hops <Link> and the Verified Muters <Link>, forcing the bad
 *     indicators onto the next flex line.
 *   - List page: a NEW isolated ui/src/pages/BrainstormMuters.jsx mirroring
 *     BrainstormFollowers.jsx (same columns, DEFAULT_VISIBLE, default sort, empty state —
 *     NO report-specific columns) consuming a NEW ui/src/hooks/useGrapevineMuters.js
 *     (mirror of useGrapevineFollowers, hitting GET /api/get-grapevine-muters?observee=…),
 *     at a NEW route /user/:pubkey/muters in App.jsx.
 *
 * Tests are source-regex sentinels — the verified-reporters-list-page /
 * profile-verified-counts-owner-pov / profile-identity-details-popover precedent. The
 * page, hook, route, badge, and .bsp-count-break do NOT exist pre-implementation, so
 * T1–T12 FAIL now and PASS once built. R1–R5 are regression sentinels — they PASS before
 * AND after (the four existing metrics, the sibling routes/pages, and the Reputation grid
 * stay untouched).
 *
 * FALSE-POSITIVE AVOIDANCE (these strings already exist in the targeted files):
 *  - BrainstormProfile.jsx's Reputation TRUST_METRICS grid (:48) ALREADY has a "Muters"
 *    label reading `verifiedMuterCount`, and the Reporters counts-row block ALREADY has
 *    `bsp-count-value-negative` + the 🚩 alarm icon. So every BADGE sentinel is scoped to
 *    a SLICE of the .bsp-counts container (sliceCounts) — never the whole file — so the
 *    Reputation grid and the Reporters alarm cannot trigger a false pass/fail.
 *  - BrainstormFollowers.jsx ALREADY has a "Verified Muters" COLUMN and a
 *    `verifiedMuterCount` field — so the list-page sentinels target the NEW
 *    BrainstormMuters.jsx file (which does not exist yet → safeRead == '').
 *  - App.jsx ALREADY has followers/reporters routes — the route sentinel targets the NEW
 *    /user/:pubkey/muters path + BrainstormMuters component specifically.
 */

const fs = require('fs');
const path = require('path');

const PROFILE         = path.resolve(__dirname, '../ui/src/pages/BrainstormProfile.jsx');
const CSS             = path.resolve(__dirname, '../ui/src/styles.css');
const APP             = path.resolve(__dirname, '../ui/src/App.jsx');
const MUTERS_PAGE     = path.resolve(__dirname, '../ui/src/pages/BrainstormMuters.jsx');
const MUTERS_HOOK     = path.resolve(__dirname, '../ui/src/hooks/useGrapevineMuters.js');
const FOLLOWERS_PAGE  = path.resolve(__dirname, '../ui/src/pages/BrainstormFollowers.jsx');
const REPORTERS_PAGE  = path.resolve(__dirname, '../ui/src/pages/BrainstormReporters.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// Slice the .bsp-counts container's JSX out of BrainstormProfile.jsx so the badge
// sentinels never match the Reputation TRUST_METRICS grid (which also has "Muters" /
// verifiedMuterCount). Returns '' if the container can't be located.
function sliceCounts(src) {
  const open = src.indexOf('className={`bsp-counts');
  if (open === -1) return '';
  // The container closes at the </div> that follows the <VerificationInfo /> trigger,
  // which is the last child of .bsp-counts. Anchor on it to bound the slice tightly.
  const vinfo = src.indexOf('<VerificationInfo', open);
  if (vinfo === -1) return '';
  const close = src.indexOf('</div>', vinfo);
  if (close === -1) return src.slice(open); // degrade gracefully rather than throw
  return src.slice(open, close);
}

// ===========================================================================
// BADGE — AC1 / AC2 / AC3 (scoped to the .bsp-counts container)
// ===========================================================================

// AC1 — a Verified Muters metric rendered BETWEEN Hops and Verified Reporters
test('T1: the counts row renders a Verified Muters <Link> between Hops and Verified Reporters (AC1)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  const counts = sliceCounts(src);
  assert(counts.length > 0, 'could not locate the .bsp-counts container in BrainstormProfile.jsx.');
  assert(/Verified Muters/.test(counts),
    'the .bsp-counts row must render a "Verified Muters" metric (the new fifth badge; pre-implementation the counts row has none — only the Reputation grid does).');
  // Ordering: the "Hops" label must appear before "Verified Muters", which must appear
  // before "Verified Reporters" — the AC1 between-Hops-and-Reporters placement.
  const iHops     = counts.indexOf('Hops');
  const iMuters   = counts.indexOf('Verified Muters');
  const iReporter = counts.indexOf('Verified Reporters');
  assert(iHops !== -1 && iMuters !== -1 && iReporter !== -1,
    'the counts row must contain Hops, Verified Muters, and Verified Reporters labels.');
  assert(iHops < iMuters && iMuters < iReporter,
    `Verified Muters must sit AFTER Hops and BEFORE Verified Reporters (got order Hops@${iHops}, Muters@${iMuters}, Reporters@${iReporter}).`);
});

// AC1 — the badge value comes from the owner-PoV useUserCounts source (same source the
// list page reads → badge equals the list's row count under the same PoV), via fmtCount.
test('T2: the Verified Muters badge reads its count from userCounts.verifiedMuterCount via fmtCount (AC1)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/userCounts\s*\?\.\s*verifiedMuterCount/.test(src),
    'the badge value must come from userCounts?.verifiedMuterCount (owner-PoV useUserCounts, ADR profile/0031) — the SAME source the muters list reads, NOT the Meili trustScores grid.');
  const counts = sliceCounts(src);
  assert(/fmtCount\(\s*verifiedMuterCount\s*\)/.test(counts),
    'the badge must format the count with the existing fmtCount(verifiedMuterCount) (so "—" when unavailable, a genuine 0 distinct from "not loaded").');
});

// AC2 — the badge is a Link to its own bookmarkable list-page URL
test('T3: the Verified Muters badge is a Link to /user/:pubkey/muters (AC2)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  const counts = sliceCounts(src);
  assert(counts.length > 0, 'could not locate the .bsp-counts container.');
  assert(/<Link\s+to=\{`\/user\/\$\{pubkey\}\/muters`\}/.test(counts),
    'the Verified Muters metric must be a <Link to={`/user/${pubkey}/muters`}> (its own bookmarkable list-page URL, parallel to /followers and /reporters).');
});

// AC2 — the route is registered, parallel to the followers/reporters sub-pages
test('T4: App.jsx registers /user/:pubkey/muters → BrainstormMuters (AC2)', () => {
  const src = safeRead(APP);
  assert(src.length > 0, 'ui/src/App.jsx missing — unexpected.');
  assert(/\/user\/:pubkey\/muters/.test(src),
    "App.jsx must declare a route with path '/user/:pubkey/muters' (the badge's link target).");
  assert(/BrainstormMuters/.test(src),
    'App.jsx must import and map the muters route to the BrainstormMuters page component.');
});

// AC3 — the badge is NEUTRAL like Verified Followers: no negative styling, no alarm
// icon, and ALWAYS a plain link (no 0-hides ternary). Scoped to the muters portion of
// the .bsp-counts slice so the still-present Reporters alarm path cannot false-fail this.
test('T5: the Verified Muters badge is neutral — no bsp-count-value-negative, no alarm icon, no 0-hides branch (AC3)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  const counts = sliceCounts(src);
  assert(/Verified Muters/.test(counts), 'the Verified Muters badge must exist in the counts row first (see T1).');
  // Isolate the muters badge: from the muters <Link to=…/muters> up to its "Verified
  // Muters" label. Anything in this window is the badge's own markup.
  const linkIdx = counts.search(/<Link\s+to=\{`\/user\/\$\{pubkey\}\/muters`\}/);
  assert(linkIdx !== -1, 'the Verified Muters badge must be a <Link to=…/muters> (see T3) — could not isolate it for the neutrality check.');
  const labelIdx = counts.indexOf('Verified Muters', linkIdx);
  const badge = counts.slice(linkIdx, labelIdx + 'Verified Muters'.length + 16);
  assert(!/bsp-count-value-negative/.test(badge),
    'the Verified Muters badge must NOT use bsp-count-value-negative (neutral, like Verified Followers — the Reporters red treatment is explicitly not ported).');
  assert(!/bsp-count-alarm-icon/.test(badge) && !/🚩/.test(badge),
    'the Verified Muters badge must NOT render an alarm icon (no bsp-count-alarm-icon, no 🚩).');
  assert(!/reporterAlarm/.test(badge),
    'the Verified Muters badge must NOT thread the reporterAlarm flag (that is Reporters-only).');
  // Always a plain link — no "0 → non-link span" ternary like the Reporters block. The
  // muters slice must reference /muters exactly once, and only ever inside a <Link>.
  const muterRefs = (counts.match(/\/user\/\$\{pubkey\}\/muters/g) || []).length;
  assert(muterRefs === 1,
    `the badge must be a single always-on <Link> to /muters — found ${muterRefs} references (a 0-hides ternary would not duplicate the link, but a conditional <span> fallback would change the badge's shape; the muters badge mirrors Verified Followers, which is unconditional).`);
});

// ===========================================================================
// LINE BREAK — AC4 (element placement + the CSS rule that forces the wrap)
// ===========================================================================

test('T6: a .bsp-count-break element sits between the Hops Link and the Verified Muters Link (AC4)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  const counts = sliceCounts(src);
  assert(/bsp-count-break/.test(counts),
    'the counts row must contain a .bsp-count-break element (the visual line break grouping the bad indicators onto the next line).');
  const iHops  = counts.indexOf('Hops');
  const iBreak = counts.indexOf('bsp-count-break');
  const iMuter = counts.indexOf('Verified Muters');
  assert(iHops !== -1 && iBreak !== -1 && iMuter !== -1,
    'the counts row must contain the Hops label, the bsp-count-break element, and the Verified Muters label.');
  assert(iHops < iBreak && iBreak < iMuter,
    `the .bsp-count-break must sit AFTER the Hops Link and BEFORE the Verified Muters Link (got Hops@${iHops}, break@${iBreak}, Muters@${iMuter}).`);
});

test('T7: styles.css defines .bsp-count-break as a zero-height flex-basis:100% row break (AC4)', () => {
  const css = safeRead(CSS);
  assert(css.length > 0, 'ui/src/styles.css missing — unexpected.');
  const rule = css.match(/\.bsp-count-break\s*\{[^}]*\}/);
  assert(rule, 'styles.css must define a `.bsp-count-break` rule (it does not exist pre-implementation).');
  assert(/flex-basis:\s*100%/.test(rule[0]),
    'the .bsp-count-break rule must set `flex-basis: 100%` so it consumes a full flex row and forces every later sibling onto the next line (the same technique as .bs-tag-row-error).');
  assert(/height:\s*0/.test(rule[0]),
    'the .bsp-count-break must be zero-height (`height: 0`) so the break is invisible — a layout-only row boundary, not a visible gap.');
});

// ===========================================================================
// LIST PAGE — AC5 (new page mirroring Verified Followers; no report-specific columns)
// ===========================================================================

test('T8: BrainstormMuters.jsx exists, reads :pubkey, consumes useGrapevineMuters, reuses DataTable, rows navigate to the profile (AC5)', () => {
  const src = safeRead(MUTERS_PAGE);
  assert(src.length > 0, 'ui/src/pages/BrainstormMuters.jsx does not exist yet — the Implementer must create the muters list page (mirror of BrainstormFollowers).');
  assert(/useParams/.test(src), 'BrainstormMuters.jsx must read the :pubkey route param via useParams.');
  assert(/useGrapevineMuters/.test(src),
    'BrainstormMuters.jsx must consume the useGrapevineMuters hook (Story-1 data, owner PoV). Its row count is the live count — the badge equals it under the same PoV.');
  assert(/DataTable/.test(src),
    'BrainstormMuters.jsx must reuse the DataTable component (mirror of BrainstormFollowers).');
  assert(/onRowClick/.test(src) && /navigate\(\s*`\/user\/\$\{[^}]*pubkey\}`/.test(src),
    'selecting a muter row must navigate to that muter\'s /user/<pubkey> profile (onRowClick → navigate(`/user/${row.pubkey}`)).');
});

test('T9: useGrapevineMuters fetches /api/get-grapevine-muters?observee=… at owner PoV (no observer param) (AC5)', () => {
  const src = safeRead(MUTERS_HOOK);
  assert(src.length > 0, 'ui/src/hooks/useGrapevineMuters.js does not exist yet — the Implementer must create it (mirror of useGrapevineFollowers).');
  assert(/\/api\/get-grapevine-muters\?observee=/.test(src),
    'the hook must fetch GET /api/get-grapevine-muters?observee=<pk> (the Story-1 list endpoint).');
  assert(!/observer=/.test(src),
    'the hook must NOT send an observer param — owner/House PoV only in v1 (the endpoint defaults to the owner; a non-owner observer is refused).');
  assert(/return\s*\{\s*data/.test(src),
    'the hook must keep the { data, loading, error } contract (mirror of useGrapevineFollowers).');
});

test('T10: the page mirrors the Followers columns and default sort, with NO report-specific columns (AC5)', () => {
  const src = safeRead(MUTERS_PAGE);
  assert(src.length > 0, 'BrainstormMuters.jsx does not exist yet.');
  // Same columns as Verified Followers: identity + the Rank/credibility metric.
  assert(/\brank\b/.test(src), 'the page must define a `rank` column (default-visible: picture/name/rank), like Verified Followers.');
  assert(/Math\.round\(\s*[\w.?]+\s*\*\s*100\s*\)/.test(src),
    'rank must be Math.round(influence * 100) — the same derivation as the Followers page.');
  // Default sort is the FOLLOWERS sort (verifiedFollowerCount desc), NOT the reporters'
  // rank-desc override (AC5: same default sort as Verified Followers).
  assert(/b\.verifiedFollowerCount[\s\S]{0,40}a\.verifiedFollowerCount/.test(src),
    'the default sort must be verifiedFollowerCount descending — the SAME default sort as Verified Followers (AC5). Do not apply the reporters\' rank-desc override.');
  // NO report-specific columns anywhere on the muters page (AC5 / edge case).
  assert(!/report[_-]?[Tt]ype/.test(src) && !/Report Type/.test(src),
    'the muters list must have NO "Report Type" / reportType / report_type column (the endpoint does not return it; mirrors followers, not reporters).');
  assert(!/Reported/.test(src),
    'the muters list must have NO "Reported" timestamp column (report-specific; reporters-only).');
  assert(!/\btimestamp\b/.test(src),
    'the muters list must carry NO per-edge timestamp field (the muter row has no sub-type/timestamp — mirrors followers).');
});

test('T11: the page shows a Verified Muters title and a normal (non-error) empty state for zero muters (AC5)', () => {
  const src = safeRead(MUTERS_PAGE);
  assert(src.length > 0, 'BrainstormMuters.jsx does not exist yet.');
  assert(/Verified Muters/.test(src),
    'the page title must be "Verified Muters" (the Followers title adapted to muters).');
  assert(/bsp-empty/.test(src) && /No verified muters/.test(src),
    'a profile with zero muters must render a NORMAL .bsp-empty empty state ("No verified muters found…"), the same treatment as Verified Followers — NOT an error.');
});

test('T12: the page uses a distinct localStorage key bsp-muters-columns (AC5)', () => {
  const src = safeRead(MUTERS_PAGE);
  assert(src.length > 0, 'BrainstormMuters.jsx does not exist yet.');
  assert(/bsp-muters-columns/.test(src),
    "the page must use STORAGE_KEY 'bsp-muters-columns' (distinct from follows/followers/reporters so column prefs don't clobber each other).");
});

// ===========================================================================
// REGRESSION SENTINELS (must PASS before AND after implementation)
// ===========================================================================

test('R1: the four existing counts-row metrics are unchanged — Following/Verified Followers/Hops links + the Verified Reporters alarm block remain (AC2)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  const counts = sliceCounts(src);
  assert(counts.length > 0, 'could not locate the .bsp-counts container.');
  assert(/\/user\/\$\{pubkey\}\/follows`/.test(counts) && /Following/.test(counts),
    'the Following metric (link to /follows) must remain in the counts row.');
  assert(/\/user\/\$\{pubkey\}\/followers`/.test(counts) && /Verified Followers/.test(counts),
    'the Verified Followers metric (link to /followers) must remain.');
  assert(/\/user\/\$\{pubkey\}\/follows-hops`/.test(counts) && /Hops/.test(counts),
    'the Hops metric (link to /follows-hops) must remain.');
  assert(/\/user\/\$\{pubkey\}\/reporters`/.test(counts) && /Verified Reporters/.test(counts),
    'the Verified Reporters metric (link to /reporters) must remain.');
  assert(/bsp-count-value-negative/.test(counts) && /reporterAlarm/.test(counts),
    'the Verified Reporters alarm path (bsp-count-value-negative + reporterAlarm) must remain on its OWN block — only the muters badge is neutral (this story must not strip the Reporters alarm).');
});

test('R2: App.jsx still registers the follows, followers, and reporters routes (regression)', () => {
  const src = safeRead(APP);
  assert(src.length > 0, 'ui/src/App.jsx missing — unexpected.');
  assert(/\/user\/:pubkey\/follows/.test(src) && /\/user\/:pubkey\/followers/.test(src) && /\/user\/:pubkey\/reporters/.test(src),
    'the existing /follows, /followers, and /reporters routes must remain (the muters route is added beside them).');
});

test('R3: BrainstormFollowers.jsx is untouched — useGrapevineFollowers + bsp-followers-columns + verifiedFollowerCount default sort (regression)', () => {
  const src = safeRead(FOLLOWERS_PAGE);
  assert(src.length > 0, 'BrainstormFollowers.jsx missing — unexpected.');
  assert(/useGrapevineFollowers/.test(src),
    'BrainstormFollowers.jsx must still use the followers hook (this story adds a NEW page; it must not edit the followers page).');
  assert(/bsp-followers-columns/.test(src),
    "BrainstormFollowers.jsx must keep its own STORAGE_KEY 'bsp-followers-columns'.");
  assert(/b\.verifiedFollowerCount[\s\S]{0,40}a\.verifiedFollowerCount/.test(src),
    'BrainstormFollowers.jsx must keep its verifiedFollowerCount-desc default sort (guard against editing the wrong file).');
});

test('R4: BrainstormReporters.jsx is untouched — useGrapevineReporters + bsp-reporters-columns + rank-desc default sort (regression)', () => {
  const src = safeRead(REPORTERS_PAGE);
  assert(src.length > 0, 'BrainstormReporters.jsx missing — unexpected.');
  assert(/useGrapevineReporters/.test(src),
    'BrainstormReporters.jsx must still use the reporters hook (the muters page is a separate NEW file).');
  assert(/bsp-reporters-columns/.test(src),
    "BrainstormReporters.jsx must keep its own STORAGE_KEY 'bsp-reporters-columns'.");
  assert(/b\.rank[\s\S]{0,18}a\.rank/.test(src),
    'BrainstormReporters.jsx must keep its rank-desc default sort (guard against editing the wrong file).');
});

test('R5: the Reputation TRUST_METRICS grid still reads Meili trustScores — only the counts-row badge is new (regression)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/TRUST_METRICS/.test(src) && /trustScores\s*\[/.test(src),
    'the Reputation grid must still render TRUST_METRICS from trustScores[metric.tag] (the Meili-backed card is unrelated to the counts-row badge and must not move).');
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
