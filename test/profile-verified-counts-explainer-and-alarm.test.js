/**
 * Story profile #36: Verification explainer popover + dynamic Verified-Reporters alarm.
 * ADR 0032. See engineering-team/stories/profile/36-verified-counts-explainer-and-alarm.test-plan.md
 *
 * Three parts (ADR 0032):
 *  - /api/owner-info gains verifiedFollowersCutoff + verifiedReportersCutoff.
 *  - NEW ui/src/hooks/useVerificationInfo.js (owner-info + /api/profiles → cutoffOutOf100 + owner name/avatar).
 *  - NEW ui/src/components/VerificationInfo.jsx — the shared "What does \"verification\" mean?" ⓘ popover,
 *    used on the profile AND /reporters (replacing the old local InfoPopover there).
 *  - BrainstormProfile: dynamic Verified-Reporters alarm — red + icon only when
 *    verifiedReporterCount >= REPORTER_ALARM_BASE(3) + Math.floor(verifiedFollowerCount/REPORTER_ALARM_FREEBIE_PER(750));
 *    below = neutral; no alarm when VF or VR is null (supersedes ADR 0001's red-when->0).
 *
 * Source-regex sentinels (the profile-* precedents). T1–T11 FAIL pre-implementation and PASS post;
 * R1–R4 are regression sentinels (PASS before AND after).
 *
 * FALSE-POSITIVE AVOIDANCE: `verifiedFollowerCount` and `verifiedReporterCount` already appear in
 * BrainstormProfile (the Story-35 derived consts, adjacent), and `bsp-count-value-negative` is already
 * used in the VR >0 branch. So the alarm sentinels anchor on the NEW threshold (`verifiedReporterCount >=
 * … verifiedFollowerCount`), the NEW constants, and `reporterAlarm` — none of which exist pre-implementation.
 */

const fs = require('fs');
const path = require('path');

const OWNERINFO = path.resolve(__dirname, '../src/api/owner/ownerInfo.js');
const HOOK      = path.resolve(__dirname, '../ui/src/hooks/useVerificationInfo.js');
const COMP      = path.resolve(__dirname, '../ui/src/components/VerificationInfo.jsx');
const PROFILE   = path.resolve(__dirname, '../ui/src/pages/BrainstormProfile.jsx');
const REPORTERS = path.resolve(__dirname, '../ui/src/pages/BrainstormReporters.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// AC2 (data) — owner-info exposes the cutoff(s)
test('T1: /api/owner-info returns verifiedFollowersCutoff + verifiedReportersCutoff from config (AC2)', () => {
  const src = safeRead(OWNERINFO);
  assert(src.length > 0, 'ownerInfo.js missing — unexpected.');
  assert(/verifiedFollowersCutoff/.test(src) && /verifiedReportersCutoff/.test(src),
    'handleGetOwnerInfo must add verifiedFollowersCutoff + verifiedReportersCutoff to its response (pre-implementation it returns only ownerPubkey/ownerNpub/domainName).');
  assert(/VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF/.test(src) && /VERIFIED_REPORTERS_INFLUENCE_CUTOFF/.test(src),
    'the cutoffs must be read from VERIFIED_FOLLOWERS/REPORTERS_INFLUENCE_CUTOFF config (not hardcoded).');
});

// AC1/AC2 (data) — the hook fetches owner-info + the owner profile
test('T2: useVerificationInfo.js fetches /api/owner-info and /api/profiles (AC1/AC2)', () => {
  const src = safeRead(HOOK);
  assert(src.length > 0, 'ui/src/hooks/useVerificationInfo.js does not exist yet.');
  assert(/owner-info/.test(src), 'the hook must fetch /api/owner-info (cutoff + owner pubkey).');
  assert(/\/api\/profiles/.test(src), 'the hook must fetch the owner profile via /api/profiles (name + avatar).');
  assert(/fetch\s*\(/.test(src), 'the hook must use fetch (matching the useUserCounts/useGrapevine* convention).');
});

test('T3: useVerificationInfo returns cutoffOutOf100 (round ×100) + owner name/avatar (AC1/AC2)', () => {
  const src = safeRead(HOOK);
  assert(src.length > 0, 'useVerificationInfo.js does not exist yet.');
  assert(/cutoffOutOf100/.test(src) && /Math\.round/.test(src) && /\*\s*100|100\s*\*/.test(src),
    'the hook must expose cutoffOutOf100 = Math.round(cutoff * 100) (0.05 → 5).');
  assert(/picture|avatar/i.test(src) && /\bname\b/.test(src),
    'the hook must surface the owner display name and avatar (from the owner kind-0 profile).');
});

// AC1 — the shared popover component
test('T4: VerificationInfo.jsx exists with the verification title, owner PoV + avatar, and consumes the hook (AC1)', () => {
  const src = safeRead(COMP);
  assert(src.length > 0, 'ui/src/components/VerificationInfo.jsx does not exist yet.');
  assert(/What does/.test(src) && /verification/i.test(src) && /\bmean\b/i.test(src),
    'the popover title must be "What does \\"verification\\" mean?".');
  assert(/point of view/i.test(src),
    'the body must explain verification is from the OWNER\'s point of view.');
  assert(/useVerificationInfo/.test(src), 'VerificationInfo must consume the useVerificationInfo hook (cutoff + owner identity).');
  assert(/picture|avatar|<img/i.test(src), 'the popover must render the owner\'s avatar.');
});

// AC3 — /reporters uses the shared popover; the old one is gone
test('T5: BrainstormReporters uses VerificationInfo and drops the old "About this data" popover copy (AC3)', () => {
  const src = safeRead(REPORTERS);
  assert(src.length > 0, 'BrainstormReporters.jsx missing — unexpected.');
  assert(/VerificationInfo/.test(src), 'BrainstormReporters must use the shared <VerificationInfo> popover.');
  assert(!/About this data/.test(src), 'the old "About this data" popover title/label must be gone.');
  assert(!/computed locally by this Tapestry/.test(src), 'the old "computed locally … not NIP-85" copy must be gone.');
  assert(!/There is no single global number/.test(src), 'the old "There is no single global number" copy must be gone (moved into the verification popover, which no longer carries it).');
});

test('T6: BrainstormReporters no longer defines a local InfoPopover (AC3 cleanup)', () => {
  const src = safeRead(REPORTERS);
  assert(src.length > 0, 'BrainstormReporters.jsx missing — unexpected.');
  assert(!/function InfoPopover/.test(src),
    'the local InfoPopover component must be removed (replaced by the shared VerificationInfo).');
});

// AC3 — profile gets the popover
test('T7: BrainstormProfile renders the shared VerificationInfo popover (AC3)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/VerificationInfo/.test(src),
    'BrainstormProfile must render <VerificationInfo> (the ⓘ near the verified counts).');
});

// AC4 — alarm constants + freebie formula
test('T8: the alarm defines named constants (3 / 750) and a floor-based threshold (AC4)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/REPORTER_ALARM_BASE\s*=\s*3/.test(src), 'must define REPORTER_ALARM_BASE = 3 (named constant).');
  assert(/REPORTER_ALARM_FREEBIE_PER\s*=\s*750/.test(src), 'must define REPORTER_ALARM_FREEBIE_PER = 750 (named constant).');
  assert(/Math\.floor/.test(src), 'the threshold must use Math.floor(verifiedFollowers / 750) for the freebie count.');
});

test('T9: the alarm threshold ties the reporter count to the follower count via >= (the freebie formula) (AC4)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/verifiedReporterCount\s*>=[\s\S]{0,80}verifiedFollowerCount/.test(src),
    'the alarm must fire when verifiedReporterCount >= base + floor(verifiedFollowerCount / 750) — a `>=` comparison tying VR to VF. (Pre-implementation VR only appears with `> 0`, never `>=` against VF.)');
});

// AC5 — no alarm when a count is unavailable
test('T10: the alarm guards against null counts (no alarm when VF or VR is unavailable) (AC5)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/verifiedReporterCount\s*!==?\s*null/.test(src) && /verifiedFollowerCount\s*!==?\s*null/.test(src),
    'the alarm condition must require both counts non-null (e.g. `vr != null && vf != null && …`) so a "—"/uncomputed value shows NO alarm (AC5).');
});

// AC4 + supersedes ADR 0001 — alarm styling (red + icon) gated on the alarm, not on >0
test('T11: the negative color AND an attention icon are applied only when reporterAlarm is true (AC4; supersedes ADR 0001)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/reporterAlarm/.test(src), 'the badge must compute a `reporterAlarm` flag (the threshold result).');
  assert(/reporterAlarm[\s\S]{0,160}bsp-count-value-negative|bsp-count-value-negative[\s\S]{0,160}reporterAlarm/.test(src),
    'the `bsp-count-value-negative` (red) styling must be gated on `reporterAlarm` — NOT on `> 0` (ADR 0001 superseded: a benign count is neutral).');
  assert(/reporterAlarm[\s\S]{0,200}(🚩|⚠️|⚠|🔴|alarm)/.test(src),
    'an attention icon must accompany the alarm state (e.g. 🚩) — drawn only when reporterAlarm.');
});

// ===========================================================================
// REGRESSION SENTINELS (must PASS before AND after implementation)
// ===========================================================================

test('R1: the Verified Reporters count still links to /user/:pubkey/reporters when >0 (AC6)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/\/user\/\$\{pubkey\}\/reporters/.test(src),
    'the Verified Reporters count must still link to /user/${pubkey}/reporters (alarm or not).');
});

test('R2: the Following and Verified Followers counts are intact (AC6 regression)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/userCounts\s*\?\.\s*followingCount/.test(src) && /\/user\/\$\{pubkey\}\/follows/.test(src),
    'Following must remain userCounts.followingCount → /follows.');
  assert(/userCounts\s*\?\.\s*verifiedFollowerCount/.test(src) && /\/user\/\$\{pubkey\}\/followers/.test(src),
    'Verified Followers must remain userCounts.verifiedFollowerCount → /followers.');
});

test('R3: the Reputation grid still uses Meili trustScores (regression)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/\/api\/search\/profiles\/meili\/document/.test(src) && /TRUST_METRICS/.test(src) && /trustScores\s*\[/.test(src),
    'the Reputation section (Meili document fetch + TRUST_METRICS grid) must be untouched.');
});

test('R4: /api/owner-info still returns ownerPubkey (regression — fields added, not replaced)', () => {
  const src = safeRead(OWNERINFO);
  assert(src.length > 0, 'ownerInfo.js missing — unexpected.');
  assert(/ownerPubkey/.test(src), 'owner-info must keep returning ownerPubkey (the cutoffs are added alongside).');
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
