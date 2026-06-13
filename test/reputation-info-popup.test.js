/**
 * Story reputation-info-popup #1: Reputation-section point-of-view explainer popup.
 * ADR 0034. See engineering-team/stories/reputation-info-popup/1-reputation-section-pov-explainer-popup.test-plan.md
 *
 * A new, self-contained, prop-free `ui/src/components/ReputationInfo.jsx` clones the established
 * `VerificationInfo` ⓘ-popup pattern (`bsp-info-btn` trigger + `bsp-confirm-overlay` overlay-click-
 * to-close + `bsp-confirm-box` + `bsp-confirm-ok` "Got it" button) with STATIC Reputation/PoV copy
 * and NO data hook. `BrainstormProfile` imports it and renders it inside the `<h3>Reputation</h3>`
 * heading. The Reputation data path (Meili document fetch + `?pov=` resolution + `TRUST_METRICS`
 * grid) and the shipped verification popover (`VerificationInfo` / `useVerificationInfo` /
 * `BrainstormReporters`) are untouched.
 *
 * Source-regex sentinels (the profile-* precedents). T1–T9 FAIL pre-implementation and PASS post;
 * R1–R6 are regression sentinels (PASS before AND after).
 *
 * FALSE-POSITIVE AVOIDANCE (per ADR 0034): the phrase `point of view` already appears in
 * `VerificationInfo.jsx`. So the reputation copy sentinels anchor on (a) the NEW file
 * `ui/src/components/ReputationInfo.jsx`, which does not exist pre-implementation, and (b) the
 * House + Personalized + Web-of-Trust wording, which is reputation-specific and does not exist in
 * any shipped file. The "imports/renders ReputationInfo" sentinels anchor on the literal
 * identifier `ReputationInfo` in `BrainstormProfile.jsx`, which is absent pre-implementation
 * (the file imports/renders only `VerificationInfo` today).
 *
 * COPY NOTE: the verbatim wording is Director-owned and finalized at Implementation. These
 * sentinels assert the required *concepts/tokens* the story AC and ADR 0034 copy-requirements
 * mandate (House, Personalized, Web of Trust / point of view) — NOT a full verbatim sentence —
 * so they do not over-constrain the Director's word choice.
 */

const fs = require('fs');
const path = require('path');

const REPINFO   = path.resolve(__dirname, '../ui/src/components/ReputationInfo.jsx');
const VERIFINFO = path.resolve(__dirname, '../ui/src/components/VerificationInfo.jsx');
const VERIFHOOK = path.resolve(__dirname, '../ui/src/hooks/useVerificationInfo.js');
const PROFILE   = path.resolve(__dirname, '../ui/src/pages/BrainstormProfile.jsx');
const REPORTERS = path.resolve(__dirname, '../ui/src/pages/BrainstormReporters.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// Slice the <h3>Reputation … </h3> heading out of BrainstormProfile so the "rendered in the
// heading" sentinel matches the control *inside* the Reputation heading, not just anywhere on the
// page. Returns '' if the heading can't be located.
function sliceReputationHeading(src) {
  const start = src.indexOf('<h3>Reputation');
  if (start === -1) return '';
  const end = src.indexOf('</h3>', start);
  if (end === -1) return '';
  return src.slice(start, end + '</h3>'.length);
}

// ===========================================================================
// AC1 — the ⓘ control exists and clones the established info-control pattern
// ===========================================================================

test('T1: ReputationInfo.jsx exists and renders an ⓘ button using the shared bsp-info-btn pattern (AC1)', () => {
  const src = safeRead(REPINFO);
  assert(src.length > 0, 'ui/src/components/ReputationInfo.jsx does not exist yet (the feature is unimplemented).');
  assert(/bsp-info-btn/.test(src),
    'the trigger must reuse the shared `bsp-info-btn` class so the Reputation ⓘ is visually consistent with the Verified ⓘ (AC1).');
  assert(/ⓘ/.test(src),
    'the control must render the circled-i glyph (ⓘ), matching the existing Verified info control.');
  assert(/type="button"/.test(src) && /onClick/.test(src),
    'the ⓘ must be an activatable <button type="button"> with an onClick handler (AC1/AC2).');
});

test('T2: ReputationInfo is a self-contained component with open/close state and NO data hook (AC1)', () => {
  const src = safeRead(REPINFO);
  assert(src.length > 0, 'ReputationInfo.jsx does not exist yet.');
  assert(/useState/.test(src),
    'ReputationInfo must hold its own open/closed state via useState (mirroring VerificationInfo).');
  assert(/export default function ReputationInfo|export default ReputationInfo/.test(src),
    'ReputationInfo must be the default export named ReputationInfo.');
  assert(!/useVerificationInfo/.test(src),
    'ReputationInfo must NOT consume useVerificationInfo — its copy is static, so it fetches nothing (ADR 0034 Option A: prop-free, hook-free).');
});

// ===========================================================================
// AC2 — activating the control opens a dismissible popup
// ===========================================================================

test('T3: activating the ⓘ opens a dismissible popup using the shared overlay/box pattern (AC2)', () => {
  const src = safeRead(REPINFO);
  assert(src.length > 0, 'ReputationInfo.jsx does not exist yet.');
  assert(/bsp-confirm-overlay/.test(src),
    'the popup must render inside `bsp-confirm-overlay` (the shared dismissible-overlay pattern).');
  assert(/bsp-confirm-box/.test(src),
    'the popup body must use the shared `bsp-confirm-box` container.');
});

// ===========================================================================
// AC3 — both dismissal paths: the "Got it" button AND the overlay click
// ===========================================================================

test('T4: the popup closes via its "Got it" acknowledgement button (AC3)', () => {
  const src = safeRead(REPINFO);
  assert(src.length > 0, 'ReputationInfo.jsx does not exist yet.');
  assert(/bsp-confirm-ok/.test(src),
    'the acknowledgement button must use the shared `bsp-confirm-ok` class (matching the Verified popup\'s "Got it").');
  assert(/Got it/.test(src),
    'the acknowledgement button label must be "Got it" (matching the existing info-popup pattern).');
  // The OK button must wire a close handler (setOpen(false)) — the acknowledgement dismissal path.
  assert(/bsp-confirm-ok[\s\S]{0,120}onClick[\s\S]{0,40}setOpen\(\s*false\s*\)/.test(src),
    'the "Got it" / bsp-confirm-ok button must close the popup (onClick → setOpen(false)).');
});

test('T5: the popup closes when the surrounding overlay is dismissed, but not when its inner box is clicked (AC3)', () => {
  const src = safeRead(REPINFO);
  assert(src.length > 0, 'ReputationInfo.jsx does not exist yet.');
  assert(/bsp-confirm-overlay[\s\S]{0,120}onClick[\s\S]{0,40}setOpen\(\s*false\s*\)/.test(src),
    'clicking the bsp-confirm-overlay must close the popup (onClick → setOpen(false)) — the overlay-dismissal path (AC3).');
  assert(/bsp-confirm-box[\s\S]{0,160}stopPropagation/.test(src),
    'clicking inside bsp-confirm-box must NOT bubble to the overlay (onClick → e.stopPropagation()), so the popup stays open while reading it — matching VerificationInfo.');
});

// ===========================================================================
// AC4 — the copy explains the Web-of-Trust House-vs-Personalized PoV (general, not naming active)
// ===========================================================================

test('T6: the popup copy names a Web-of-Trust point of view as the source of the reputation scores (AC4)', () => {
  const src = safeRead(REPINFO);
  assert(src.length > 0, 'ReputationInfo.jsx does not exist yet.');
  assert(/[Ww]eb of [Tt]rust/.test(src),
    'the copy must say the reputation scores reflect a Web-of-Trust point of view (the reputation model the story names) (AC4).');
  assert(/point of view/i.test(src),
    'the copy must frame the scores as a "point of view" (AC4). (Anchored on the NEW ReputationInfo.jsx — the phrase also exists in VerificationInfo.jsx, which this sentinel does not read.)');
});

test('T7: the popup copy names BOTH the House and the Personalized point of view, generally (AC4)', () => {
  const src = safeRead(REPINFO);
  assert(src.length > 0, 'ReputationInfo.jsx does not exist yet.');
  assert(/House/.test(src),
    'the copy must name the **House** point of view (the instance\'s default) (AC4). This token does not exist in any shipped UI file pre-implementation.');
  assert(/[Pp]ersonalized/.test(src),
    'the copy must name the viewer\'s **Personalized** point of view (AC4).');
  // The two must be presented as alternatives ("either … or … depending on which is selected"),
  // not as a single asserted PoV. Anchor on the disjunction + selection language without pinning
  // the verbatim sentence (Director-owned).
  assert(/either|or\b/i.test(src) && /select/i.test(src),
    'the copy must present House vs Personalized as alternatives that depend on which is currently selected (e.g. "either … or … depending on which is selected") — general, not naming the active one (AC4).');
});

// ===========================================================================
// AC5 — the copy is bounded to the Reputation scores; no claim about the top-of-page counts
// ===========================================================================

test('T8: the popup copy is bounded to the Reputation scores and makes NO claim about the Following / Verified Followers / Verified Reporters counts (AC5)', () => {
  const src = safeRead(REPINFO);
  assert(src.length > 0, 'ReputationInfo.jsx does not exist yet.');
  // Per ADR 0033 §27 those top-of-page counts are Owner-PoV (Neo4j), NOT House/Personalized.
  // The reputation popup must not name them, or it would (a) mislabel Owner-PoV data and
  // (b) over-claim its own scope.
  assert(!/Verified Followers/.test(src),
    'the reputation popup must NOT reference "Verified Followers" — that top-of-page count is Owner-PoV, not the House/Personalized scores this popup annotates (AC5; ADR 0033 §27).');
  assert(!/Verified Reporters/.test(src),
    'the reputation popup must NOT reference "Verified Reporters" — out of this popup\'s scope (AC5).');
  assert(!/Following\b/.test(src),
    'the reputation popup must NOT reference the "Following" count — out of this popup\'s scope (AC5).');
});

// ===========================================================================
// AC1 (placement) — BrainstormProfile imports + renders ReputationInfo INSIDE the Reputation heading
// ===========================================================================

test('T9: BrainstormProfile imports ReputationInfo and renders it inside the <h3>Reputation</h3> heading (AC1)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/import\s+ReputationInfo\s+from\s+['"]\.\.\/components\/ReputationInfo['"]/.test(src),
    'BrainstormProfile must import ReputationInfo from ../components/ReputationInfo (beside the VerificationInfo import). Absent pre-implementation.');
  const heading = sliceReputationHeading(src);
  assert(heading.length > 0,
    'the <h3>Reputation …</h3> heading must still exist in BrainstormProfile (the control is rendered inside it).');
  assert(/<ReputationInfo\s*\/?>/.test(heading),
    'the <ReputationInfo /> control must be rendered INSIDE the <h3>Reputation</h3> heading (AC1) — not elsewhere on the page. Pre-implementation the heading is the bare `<h3>Reputation</h3>`.');
});

// ===========================================================================
// REGRESSION SENTINELS (must PASS before AND after implementation) — AC6 boundary
// ===========================================================================

test('R1: the Reputation data path is unchanged — Meili document fetch, TRUST_METRICS, trustScores grid (AC6)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/\/api\/search\/profiles\/meili\/document/.test(src),
    'the Reputation section must still fetch the Meili document — the data path is untouched (AC6).');
  assert(/TRUST_METRICS/.test(src) && /trustScores\s*\[/.test(src),
    'the Reputation grid must still render TRUST_METRICS from trustScores[metric.tag] (AC6).');
});

test('R2: the ?pov= resolution is unchanged — povParam + povSuffix + delegated-pubkey fallback (AC6)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/searchParams\.get\(['"]pov['"]\)/.test(src),
    'the ?pov= query param resolution must be untouched (povParam = searchParams.get("pov")) (AC6).');
  assert(/povSuffix/.test(src) && /delegatedPubkey/.test(src),
    'the PoV-suffix resolution (povSuffix + the delegatedPubkey House fallback) must be untouched — the popup is presentational only and adds no PoV logic (AC6).');
});

test('R3: the trust effect re-runs on [pubkey, povParam] — the scores still track the selected PoV (AC6)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/\[\s*pubkey\s*,\s*povParam\s*\]/.test(src),
    'the trust-scores effect must still depend on [pubkey, povParam], so the displayed scores still shift with the selected PoV (AC6).');
});

test('R4: the shared VerificationInfo popover is unchanged — still consumes useVerificationInfo and renders the verification title (AC6)', () => {
  const src = safeRead(VERIFINFO);
  assert(src.length > 0, 'VerificationInfo.jsx missing — unexpected.');
  assert(/useVerificationInfo/.test(src),
    'VerificationInfo must still consume the useVerificationInfo hook — this story is additive and does NOT touch it (ADR 0034 / ADR 0032).');
  assert(/What does/.test(src) && /verification/i.test(src),
    'VerificationInfo must still carry its "What does \\"verification\\" mean?" title — unchanged.');
});

test('R5: useVerificationInfo still fetches owner-info — the verification data path is untouched (AC6)', () => {
  const src = safeRead(VERIFHOOK);
  assert(src.length > 0, 'useVerificationInfo.js missing — unexpected.');
  assert(/owner-info/.test(src),
    'useVerificationInfo must still fetch /api/owner-info — this story does not modify the verification hook (ADR 0034).');
});

test('R6: BrainstormProfile still renders the shared VerificationInfo popover near the counts (AC6)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/import\s+VerificationInfo\s+from\s+['"]\.\.\/components\/VerificationInfo['"]/.test(src),
    'BrainstormProfile must keep importing VerificationInfo (the new ReputationInfo import is added beside it, not in place of it) (AC6).');
  assert(/<VerificationInfo\s*\/?>/.test(src),
    'BrainstormProfile must keep rendering <VerificationInfo /> (the Verified ⓘ near the counts is untouched) (AC6).');
});

test('R7: BrainstormProfile does NOT label the top-of-page counts with House/Personalized PoV (ADR 0033 §27 boundary; AC5)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  // ADR 0033 §27: the Following / Verified Followers / Verified Reporters counts are Owner-PoV
  // (Neo4j) and must NOT be labeled "House". The House/Personalized wording must live ONLY in
  // ReputationInfo (scoped to the Reputation section). BrainstormProfile.jsx itself must carry no
  // "House (default)" PoV label. (Pre-implementation this holds; this guards the boundary post.)
  assert(!/House \(default\)/.test(src),
    'BrainstormProfile.jsx must not label any count "House (default)" — the House/Personalized wording belongs inside ReputationInfo, scoped to the Reputation scores, never the top-of-page Owner-PoV counts (ADR 0033 §27).');
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
