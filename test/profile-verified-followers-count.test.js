/**
 * Story #33: Verified-followers count on the profile page.
 * ADR 0029. See engineering-team/stories/profile/33-profile-verified-followers-count.test-plan.md
 *
 * ADR 0029 chose Option A (pure front-end): render the already-fetched,
 * PoV-aware client-side value `trustScores.verifiedFollowerCount` (fallback
 * `.followers`) as a PLAIN (non-link) "Verified Followers" counter in the
 * profile's `bsp-counts` block, beside the existing "Following" <Link>.
 * No backend change.
 *
 * Tests are source-regex sentinels — the #29 profile-follows-list precedent
 * (a single-file profile UI change with no React render harness; #30's pure
 * helper was justified only because its logic was shared across two files).
 * Browser-level behavior (the element is not an <a>; ?pov= reflects the PoV)
 * is covered by the supplementary, live-data Playwright spec
 * tests/brainstorm/profile-verified-followers-count.spec.js.
 *
 * FALSE-POSITIVE AVOIDANCE: BrainstormProfile.jsx ALREADY contains the strings
 * "Verified Followers", "verifiedFollowerCount" and "followers" inside the
 * TRUST_METRICS array (the Reputation grid, rendered as bsp-trust-card-*).
 * Each sentinel below therefore targets the NEW bsp-counts-block counter
 * specifically — a 2nd bsp-count-* span, a direct trustScores.verifiedFollowerCount
 * read, a 2nd fmtCount(...) call — none of which exist pre-implementation.
 *
 * T1–T5 must FAIL pre-implementation and PASS post-implementation.
 * R1 is a regression sentinel — it must PASS both before and after (it guards
 * the existing "Following" count, which is added-beside, not replaced).
 */

const fs = require('fs');
const path = require('path');

const PROFILE_PAGE = path.resolve(__dirname, '../ui/src/pages/BrainstormProfile.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function countOf(src, re) { return (src.match(re) || []).length; }

// AC1 — a "Verified Followers" count renders in the bsp-counts block, beside Following.
test('T1: BrainstormProfile.jsx renders a "Verified Followers" count in the bsp-counts block (AC1)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(countOf(src, /bsp-count-label/g) >= 2,
    'a SECOND counter must be added to the bsp-counts block (expected >=2 `bsp-count-label` spans; only the existing "Following" counter has one pre-implementation).');
  assert(/bsp-count-label[^>]*>\s*Verified Followers/.test(src),
    'the new counter must be labeled "Verified Followers" via a `bsp-count-label` span. (The existing "Verified Followers" strings are TRUST_METRICS labels rendered as bsp-trust-card-label in the Reputation grid, not the prominent counter.)');
});

// AC2 (+ AC3/AC4 at source level) — value from the verified score on the PoV-resolved trustScores.
test('T2: the new counter sources its value from trustScores.verifiedFollowerCount (verified score, PoV-resolved) (AC2; AC3/AC4 source)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/trustScores\s*\??\.\s*verifiedFollowerCount/.test(src),
    'the counter must read `verifiedFollowerCount` directly off the PoV-resolved `trustScores` object (e.g. `trustScores?.verifiedFollowerCount`). Pre-implementation trustScores is only read as `trustScores[metric.tag]` in the Reputation grid. Reading trustScores ties the count to the existing House-default / ?pov= resolution (AC3/AC4) and to the VERIFIED score, not the raw follower total (AC2).');
});

// AC6 + zero-preservation — nullish-coalescing fallback so a genuine 0 shows "0".
test('T3: the verifiedFollowerCount->followers fallback uses ?? (not ||) so a real 0 is preserved (AC6)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/verifiedFollowerCount\s*\?\?/.test(src),
    'the count must fall back with nullish-coalescing: `trustScores?.verifiedFollowerCount ?? trustScores?.followers`. (Pre-implementation `verifiedFollowerCount` only appears as a TRUST_METRICS tag string, never followed by `??`.)');
  assert(!/verifiedFollowerCount\s*\|\|/.test(src),
    'do NOT use `||` for the fallback — `verifiedFollowerCount || followers` treats a genuine 0 as falsy and drops it (showing the followers value or "—" instead of "0"). Use `??`.');
});

// AC5/AC6 display — the value is formatted through the existing fmtCount helper (null -> "—", 0 -> "0").
test('T4: the new counter formats its value via the existing fmtCount helper (AC5 placeholder, AC6 zero)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(countOf(src, /fmtCount\s*\(/g) >= 2,
    'the new counter must format its value through the existing `fmtCount` helper (a 2nd `fmtCount(...)` call beside the Following one). fmtCount returns "—" for null/undefined (AC5) and "0" for 0 (AC6).');
});

// AC7 — UPDATED by story #34. #33 shipped this counter PLAIN ("plain until the followers
// table ships"); story #34 ships that table (/user/:pubkey/followers), so the counter becomes
// a same-tab <Link>. This assertion now tracks the current intended behavior — it fails until
// #34's count→link lands, then passes. (See engineering-team/stories/profile/34-*.)
test('T5: the "Verified Followers" counter links to /user/${pubkey}/followers (updated by story #34; was plain in #33)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(countOf(src, /bsp-count-value/g) >= 2,
    'the Verified Followers counter must still exist beside Following (>=2 `bsp-count-value` spans).');
  assert(/\/user\/\$\{pubkey\}\/followers/.test(src),
    'story #34: the Verified Followers counter must link to `/user/${pubkey}/followers` (the followers table). It shipped plain in #33; #34 makes it a <Link>.');
  assert(countOf(src, /bsp-count-link/g) >= 2,
    'both prominent counters are now links: Following → /follows and Verified Followers → /followers (expected >=2 `bsp-count-link`).');
});

// Regression — the existing "Following" count is untouched (added beside, not replaced).
test('R1: the existing "Following" count is unchanged — useUserCounts + <Link> to /follows (regression)', () => {
  const src = safeRead(PROFILE_PAGE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/useUserCounts/.test(src),
    'BrainstormProfile.jsx must keep using useUserCounts for the Following count.');
  assert(/\/user\/\$\{pubkey\}\/follows/.test(src) && /bsp-count-link/.test(src),
    'the Following count must remain a <Link> (bsp-count-link) to `/user/${pubkey}/follows`.');
  assert(/bsp-count-label[^>]*>\s*Following/.test(src),
    'the "Following" label must remain (the new counter is added beside it, not in place of it).');
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
