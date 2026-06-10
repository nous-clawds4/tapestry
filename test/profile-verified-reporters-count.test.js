/**
 * Story verified-reporters #1: Verified Reporters count on the profile page.
 * ADR 0001 (verified-reporters). See
 * engineering-team/stories/verified-reporters/1-verified-reporters-count.test-plan.md
 *
 * ADR 0001 chose Option A (pure front-end): render the already-fetched,
 * PoV-resolved client-side value `trustScores.verifiedReporterCount` as a THIRD
 * counter in the profile's `bsp-counts` block, beside "Following" and "Verified
 * Followers". Unlike its always-link siblings it renders by state:
 *   >0          → negative-signal value + <Link> to /user/:pubkey/reporters
 *   0           → neutral value, NOT a link
 *   unavailable → "—", NOT a link
 *   loading     → dimmed "—"
 * No backend change.
 *
 * Tests are source-regex sentinels — the profile-verified-followers-count /
 * profile-follows-list precedents (a single-file profile UI change with no React
 * render harness). Browser-level behavior (the 0/unavailable states are not <a>;
 * the >0 link's red color and aria-label; ?pov= reflects the PoV) is covered by the
 * supplementary, live-data Playwright spec
 * tests/brainstorm/profile-verified-reporters-count.spec.js.
 *
 * FALSE-POSITIVE AVOIDANCE: BrainstormProfile.jsx ALREADY contains the strings
 * "verifiedReporterCount" and "Reporters" inside the TRUST_METRICS array (the
 * Reputation grid, rendered as bsp-trust-card-*). Each sentinel below therefore
 * targets the NEW bsp-counts-block counter specifically — a 3rd bsp-count-label
 * span reading "Verified Reporters", a direct `trustScores?.verifiedReporterCount`
 * read, a /user/${pubkey}/reporters link, a `bsp-count-value-negative` class, a
 * 3rd fmtCount(...) call, a `bsp-count-loading` dim, and the exact aria-label —
 * none of which exist pre-implementation.
 *
 * T1–T8 must FAIL pre-implementation and PASS post-implementation.
 * R1–R3 are regression sentinels — they must PASS both before and after (they
 * guard the existing Following + Verified Followers counters and the deliberately
 * retained Reporters trust card).
 */

const fs = require('fs');
const path = require('path');

const PROFILE_PAGE = path.resolve(__dirname, '../ui/src/pages/BrainstormProfile.jsx');
const STYLES       = path.resolve(__dirname, '../ui/src/styles.css');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function countOf(src, re) { return (src.match(re) || []).length; }

// AC1 — a "Verified Reporters" count renders in the bsp-counts block, beside the other two.
test('T1: BrainstormProfile.jsx renders a "Verified Reporters" count in the bsp-counts block (AC1)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(countOf(src, /bsp-count-label/g) >= 3,
    'a THIRD counter must be added to the bsp-counts block (expected >=3 `bsp-count-label` spans; pre-implementation only "Following" and "Verified Followers" have one).');
  assert(/bsp-count-label[^>]*>\s*Verified Reporters/.test(src),
    'the new counter must be labeled "Verified Reporters" via a `bsp-count-label` span. (Pre-implementation the only Reporters string is the TRUST_METRICS label \'Reporters\', rendered as bsp-trust-card-label in the Reputation grid — not the prominent counter, and not the text "Verified Reporters".)');
});

// AC1 — value sourced from the Owner-PoV userCounts (Neo4j), NOT Meili (ADR 0031).
test('T2: the new counter sources its value from userCounts.verifiedReporterCount (Owner PoV, ADR 0031)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/userCounts\s*\??\.\s*verifiedReporterCount/.test(src),
    'the counter must read `verifiedReporterCount` off the Owner-PoV `userCounts` object (e.g. `userCounts?.verifiedReporterCount`) — the same source the /reporters table uses, NOT Meili `trustScores`. ADR 0031 superseded the original Meili source (this ADR 0001 decision).');
});

// AC2 — when >0 the counter links to the reporters list.
test('T3: the counter links to /user/${pubkey}/reporters (AC2)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/\/user\/\$\{pubkey\}\/reporters/.test(src),
    'the >0 state must link to `/user/${pubkey}/reporters` (the reporters list, built in story #3). Pre-implementation this path does not exist in the file.');
  assert(countOf(src, /bsp-count-link/g) >= 3,
    'the >0 state must render as a `bsp-count-link` (expected >=3 `bsp-count-link` occurrences in source: Following → /follows, Verified Followers → /followers, Verified Reporters → /reporters).');
});

// AC2 — the >0 value is a NEGATIVE signal (the --red token via a modifier class).
test('T4: the >0 value uses a negative-signal modifier backed by the --red token (AC2)', () => {
  const src = safeRead(PROFILE_PAGE);
  const css = safeRead(STYLES);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(css.length > 0, 'ui/src/styles.css missing — unexpected.');
  assert(/bsp-count-value-negative/.test(src),
    'the >0 value span must carry the `bsp-count-value-negative` modifier class (ADR 0001) so the count reads as a negative signal, distinct from the neutral/positive counts.');
  const rule = css.match(/\.bsp-count-value-negative\s*\{[^}]*\}/);
  assert(rule, 'styles.css must define a `.bsp-count-value-negative` rule (ADR 0001).');
  assert(/var\(\s*--red\s*\)/.test(rule[0]),
    'the `.bsp-count-value-negative` color must come from the `--red` design token (no hard-coded hex) — the app already encodes "report" as red.');
});

// AC3 — 0 is neutral and NOT a link: the counter branches on the count value.
test('T5: the counter branches on the count so 0 is rendered neutrally, not as a link (AC3)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/verifiedReporterCount[^\n]{0,24}?(>\s*0|===?\s*0)/.test(src),
    'the counter must conditionally render on the reporter count (e.g. `verifiedReporterCount > 0` or `verifiedReporterCount === 0`): only >0 is a link; a genuine 0 is shown neutrally and is NOT a link (AC3). The comparison must be anchored to the count itself — pre-implementation `verifiedReporterCount` is never compared to 0 (the existing `=== 0` checks are on `Object.keys(scores).length`, not the count). (Browser-level "0 is not a link" is asserted in the Playwright spec.)');
});

// AC4 + AC6 — the value is formatted via the existing fmtCount helper (null -> "—", number -> localized).
test('T6: the new counter formats its value via the existing fmtCount helper (AC4 placeholder, AC6 number)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(countOf(src, /fmtCount\s*\(/g) >= 3,
    'the new counter must format its value through the existing `fmtCount` helper (a 3rd `fmtCount(...)` call beside Following and Verified Followers). fmtCount returns "—" for null/undefined (AC4 unavailable) and a localized number otherwise (AC6).');
});

// AC5 — loading shows a dimmed placeholder via a per-count loading modifier (NOT a bare spinner).
test('T7: a per-count loading dim exists for the reporters counter (AC5)', () => {
  const src = safeRead(PROFILE_PAGE);
  const css = safeRead(STYLES);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(css.length > 0, 'ui/src/styles.css missing — unexpected.');
  assert(/bsp-count-loading\b/.test(src),
    'the loading state must apply the `bsp-count-loading` modifier on the reporters counter (ADR 0001) — gated on `trustLoading`, since the value rides trustScores, not userCounts.');
  const rule = css.match(/\.bsp-count-loading\b[^{]*\{[^}]*\}/);
  assert(rule, 'styles.css must define a `.bsp-count-loading` rule (distinct from the existing `.bsp-counts-loading`).');
  assert(/opacity\s*:/.test(rule[0]),
    'the `.bsp-count-loading` rule must dim the value (an `opacity:` — a dimmed placeholder, never a bare spinner, per AC5).');
});

// AC6 — the >0 link's accessible name states the number and that it opens the list.
test('T8: the >0 link carries the canonical accessible name "{n} verified reporters. View list." (AC6)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/aria-label/.test(src),
    'the >0 reporters link must set an aria-label (the value + label alone do not state the destination).');
  assert(/verified reporters\. View list\./.test(src),
    'the accessible name must be the style-guide canonical "{n} verified reporters. View list." (verbatim). Pre-implementation this string is absent.');
});

// ===========================================================================
// REGRESSION SENTINELS (must PASS before AND after implementation)
// ===========================================================================

test('R1: the existing "Following" count is unchanged — useUserCounts + <Link> to /follows (regression)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/useUserCounts/.test(src),
    'BrainstormProfile.jsx must keep using useUserCounts for the Following count.');
  assert(/\/user\/\$\{pubkey\}\/follows/.test(src),
    'the Following count must remain a <Link> to `/user/${pubkey}/follows`.');
  assert(/bsp-count-label[^>]*>\s*Following/.test(src),
    'the "Following" label must remain (the new counter is added beside it, not in place of it).');
});

test('R2: the existing "Verified Followers" count is unchanged — <Link> to /followers (regression)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/\/user\/\$\{pubkey\}\/followers/.test(src),
    'the Verified Followers count must remain a <Link> to `/user/${pubkey}/followers` (the new counter is added beside it).');
  assert(/bsp-count-label[^>]*>\s*Verified Followers/.test(src),
    'the "Verified Followers" label must remain.');
});

test('R3: the existing Reporters trust card is retained in TRUST_METRICS (ADR 0001 deliberate non-change)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/tag:\s*'verifiedReporterCount'/.test(src),
    'the TRUST_METRICS `verifiedReporterCount` entry (the 🚩 "Reporters" trust card) must remain — ADR 0001 leaves it in place, consistent with how Verified Followers appears in both the count row and a trust card. Removing trust cards is out of scope for this story.');
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
