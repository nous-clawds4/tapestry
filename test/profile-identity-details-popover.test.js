/**
 * Story profile #37: Profile identity details popover.
 * ADR profile/0033. See engineering-team/stories/profile/37-identity-details-popover.test-plan.md
 *
 * What ships (ADR 0033):
 *  - NEW ui/src/components/CopyButton.jsx — the existing copy-to-clipboard button, extracted
 *    from BrainstormProfile (default export; 📋 → ✓ feedback; navigator.clipboard.writeText).
 *  - NEW ui/src/components/IdentityDetails.jsx — a self-contained "more details" drawer: a
 *    .bsp-info-btn trigger bearing the neutral ⋯ glyph (NOT a key, NOT the ⓘ) with an aria-label,
 *    opening a .bsp-confirm-overlay / .bsp-confirm-box popover that shows the hex pubkey + npub
 *    (each labelled, each with a CopyButton for the FULL value). Mirrors VerificationInfo.
 *  - BrainstormProfile.jsx — renders <IdentityDetails pubkey npub/> inside a new .bsp-name-row
 *    next to .bsp-name; DROPS the inline pubkey/npub Identity rows + its local CopyButton; gates
 *    the Identity .bsp-section on (website || lud16) so it never renders an empty shell. Website +
 *    Lightning stay. npub derivation (nip19.npubEncode) unchanged — purely presentational.
 *  - styles.css — one layout rule: .bsp-name-row (the flex wrapper; .bsp-info-btn margin-left:auto
 *    floats the trigger right).
 *
 * Source-regex sentinels (the profile-* precedent). T1–T11 FAIL pre-implementation and PASS post;
 * R1–R3 are regression sentinels (PASS before AND after).
 *
 * FALSE-POSITIVE AVOIDANCE:
 *  - `navigator.clipboard.writeText`, `📋`/`✓`, `bsp-info-btn`, `bsp-confirm-overlay`, `bsp-id-row`
 *    all already exist elsewhere pre-implementation (BrainstormProfile / VerificationInfo). The
 *    new-component sentinels therefore assert them in the NEW files (CopyButton.jsx /
 *    IdentityDetails.jsx), which do not exist yet → safeRead() == '' → those tests fail on the
 *    file-existence assertion, for the right reason.
 *  - The page-removal sentinels (T9) rely on the OLD inline code still being present pre-impl
 *    (`function CopyButton`, `<CopyButton value={pubkey}>`, the "Pubkey (hex)" row) — so the
 *    negations fail now and pass only once the Implementer moves them out.
 */

const fs = require('fs');
const path = require('path');

const COPY    = path.resolve(__dirname, '../ui/src/components/CopyButton.jsx');
const IDENT   = path.resolve(__dirname, '../ui/src/components/IdentityDetails.jsx');
const PROFILE = path.resolve(__dirname, '../ui/src/pages/BrainstormProfile.jsx');
const CSS     = path.resolve(__dirname, '../ui/src/styles.css');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// AC5 — the copy control is extracted to a shared component
test('T1: CopyButton.jsx is extracted as a standalone component (default export, clipboard write, 📋→✓ feedback) (AC5)', () => {
  const src = safeRead(COPY);
  assert(src.length > 0, 'ui/src/components/CopyButton.jsx does not exist yet.');
  assert(/export\s+default/.test(src), 'CopyButton.jsx must default-export the component.');
  assert(/navigator\.clipboard\.writeText/.test(src), 'CopyButton must copy via navigator.clipboard.writeText (behavior unchanged).');
  assert(/✓/.test(src) && /📋/.test(src), 'CopyButton must keep the 📋 → ✓ on-copy feedback.');
});

// AC1 — the trigger: neutral "more details" glyph, reusing the bsp-info-btn look
test('T2: IdentityDetails renders a bsp-info-btn trigger with the neutral ⋯ glyph (not a key, not ⓘ) (AC1)', () => {
  const src = safeRead(IDENT);
  assert(src.length > 0, 'ui/src/components/IdentityDetails.jsx does not exist yet.');
  assert(/bsp-info-btn/.test(src), 'the trigger must reuse the bsp-info-btn class (stylistically consistent with the ⓘ popovers).');
  assert(/⋯/.test(src), 'the trigger glyph must be the neutral ellipsis ⋯ (a "more details" affordance), per ADR 0033.');
  assert(!/🔑/.test(src), 'the trigger must NOT be a key glyph — this is a general details drawer, not "keys".');
  assert(!/ⓘ/.test(src), 'the trigger must NOT reuse the ⓘ glyph (it means "explain this concept" elsewhere on the page).');
});

// AC2 — accessibility label
test('T3: the IdentityDetails trigger carries an aria-label (AC2)', () => {
  const src = safeRead(IDENT);
  assert(src.length > 0, 'IdentityDetails.jsx does not exist yet.');
  assert(/aria-label/.test(src), 'the trigger button must have an aria-label describing its purpose (assistive tech).');
});

// AC3 — tap-to-open popover, same machinery as the existing info popovers
test('T4: IdentityDetails opens a bsp-confirm-overlay/bsp-confirm-box popover with its own open state (AC3)', () => {
  const src = safeRead(IDENT);
  assert(src.length > 0, 'IdentityDetails.jsx does not exist yet.');
  assert(/bsp-confirm-overlay/.test(src) && /bsp-confirm-box/.test(src),
    'the popover must reuse the bsp-confirm-overlay/bsp-confirm-box pattern (same as VerificationInfo/ReputationInfo).');
  assert(/useState/.test(src) && /setOpen|open\s*&&/.test(src),
    'the component must own its open/close state (tap-to-open/dismiss), like the existing info popovers.');
});

// AC4 — the popover shows both identifiers, each labelled, in the bsp-id row structure
test('T5: the popover labels and shows both the hex pubkey and the npub, reusing the bsp-id rows (AC4)', () => {
  const src = safeRead(IDENT);
  assert(src.length > 0, 'IdentityDetails.jsx does not exist yet.');
  assert(/Pubkey \(hex\)/.test(src), 'the popover must label the hex pubkey row "Pubkey (hex)".');
  assert(/npub/.test(src), 'the popover must show/label the npub.');
  assert(/bsp-id-row/.test(src) && /bsp-id-label/.test(src),
    'the rows must reuse the bsp-id-row/bsp-id-label structure (consistent with the Identity section they came from).');
});

// AC5 — a copy control per identifier, copying the FULL value
test('T6: IdentityDetails imports CopyButton and renders one for BOTH pubkey and npub with the full values (AC5)', () => {
  const src = safeRead(IDENT);
  assert(src.length > 0, 'IdentityDetails.jsx does not exist yet.');
  assert(/import\s+CopyButton/.test(src), 'IdentityDetails must import the shared CopyButton.');
  assert(/CopyButton[^>]*value=\{pubkey\}/.test(src), 'a CopyButton must copy the FULL pubkey (value={pubkey}).');
  assert(/CopyButton[^>]*value=\{npub\}/.test(src), 'a CopyButton must copy the FULL npub (value={npub}).');
});

// AC1 — placement: the trigger sits to the right of the name, inside the .bsp-name-row
test('T7: BrainstormProfile renders <IdentityDetails> inside a .bsp-name-row next to the display name (AC1)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/import\s+IdentityDetails/.test(src), 'BrainstormProfile must import IdentityDetails.');
  assert(/bsp-name-row[\s\S]{0,220}bsp-name[\s\S]{0,220}IdentityDetails/.test(src),
    'IdentityDetails must sit inside a .bsp-name-row right after the .bsp-name heading (trigger to the right of the name).');
});

// AC1 — the float mechanism: a layout rule for .bsp-name-row
test('T8: styles.css defines .bsp-name-row (the flex wrapper that floats the trigger right) (AC1)', () => {
  const src = safeRead(CSS);
  assert(src.length > 0, 'ui/src/styles.css missing — unexpected.');
  assert(/\.bsp-name-row\s*\{/.test(src),
    'styles.css must define .bsp-name-row (display:flex … so the reused .bsp-info-btn margin-left:auto floats the trigger right).');
});

// AC6 — the identifiers are no longer inline in the page body
test('T9: BrainstormProfile no longer renders the identifiers inline (no local CopyButton, no Pubkey(hex) row) (AC6)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(!/function CopyButton/.test(src),
    'the local CopyButton definition must move to ui/src/components/CopyButton.jsx (no longer defined in the page).');
  assert(!/CopyButton\s+value=\{pubkey\}/.test(src),
    'the page body must no longer render <CopyButton value={pubkey}> (it moved into the popover).');
  assert(!/CopyButton\s+value=\{npub\}/.test(src),
    'the page body must no longer render <CopyButton value={npub}> (it moved into the popover).');
  assert(!/Pubkey \(hex\)/.test(src),
    'the "Pubkey (hex)" Identity row must move out of the page body into the popover.');
});

// AC8 — the Identity section never renders as an empty shell
test('T10: the Identity section is gated on (website || lud16) so it never renders empty (AC8)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/website[\s\S]{0,30}\|\|[\s\S]{0,30}lud16|lud16[\s\S]{0,30}\|\|[\s\S]{0,30}website/.test(src),
    'after pubkey/npub move out, the Identity .bsp-section must render only when (profile?.website || profile?.lud16) — otherwise it is an empty shell (AC8). Pre-impl website and lud16 are guarded separately, never combined with ||.');
});

// AC9 — the new component is presentational (no new data path)
test('T11: IdentityDetails is presentational — no data fetch (values come from props) (AC9)', () => {
  const src = safeRead(IDENT);
  assert(src.length > 0, 'IdentityDetails.jsx does not exist yet.');
  assert(!/fetch\s*\(/.test(src),
    'IdentityDetails must be presentational (props in, no fetch) — the values are derived upstream; the change is not a new data path.');
});

// ===========================================================================
// REGRESSION SENTINELS (must PASS before AND after implementation)
// ===========================================================================

test('R1: Website remains in the Identity section (regression) (AC7)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/profile\??\.website/.test(src) && /toExternalUrl\(/.test(src) && /bsp-id-link/.test(src),
    'the Website row (profile.website → toExternalUrl, bsp-id-link) must remain in the Identity section.');
});

test('R2: Lightning (lud16) remains in the Identity section (regression) (AC7)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/profile\??\.lud16/.test(src) && /⚡/.test(src),
    'the Lightning row (profile.lud16, ⚡) must remain in the Identity section.');
});

test('R3: npub is still derived via nip19.npubEncode (purely presentational; derivation unchanged) (AC9)', () => {
  const src = safeRead(PROFILE);
  assert(src.length > 0, 'BrainstormProfile.jsx missing — unexpected.');
  assert(/nip19\.npubEncode\(/.test(src),
    'npub must still be derived client-side via nip19.npubEncode(pubkey) — presentational change, not a new data path.');
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
