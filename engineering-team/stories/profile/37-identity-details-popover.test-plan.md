# Test Plan: Story profile #37 — Profile identity details popover

**Story:** `engineering-team/stories/profile/37-identity-details-popover.md`
**ADR:** `engineering-team/decisions/profile/0033-identity-details-popover.md`
**Date:** 2026-06-16
**Suite:** `test/profile-identity-details-popover.test.js` (source-regex sentinels, the established `profile-*` pattern; Node runner via `npm test`, **not** Playwright). Wired into `test/test.js`.

## Approach

This is a frontend-only React presentational change with no runtime/data surface, so it is covered by **source-regex sentinels** — the same technique used by `profile-verified-counts-explainer-and-alarm` and the other `profile-*` suites. `T1–T11` are the spec (FAIL before implementation, PASS after); `R1–R3` are regression sentinels (PASS before **and** after) guarding what must not change.

## Coverage map

| Criterion | Test(s) | What it asserts | Level |
|---|---|---|---|
| AC1 — control to the right of the name, floated right, neutral non-key glyph | `T2`, `T7`, `T8` | `IdentityDetails` trigger uses `.bsp-info-btn` + the `⋯` glyph (not `🔑`, not `ⓘ`); the page renders `<IdentityDetails>` inside a `.bsp-name-row` right after `.bsp-name`; `styles.css` defines `.bsp-name-row` | source-sentinel |
| AC2 — accessibility label on the control | `T3` | the trigger button has an `aria-label` | source-sentinel |
| AC3 — tap-to-open/dismiss popover, consistent with existing info popovers | `T4` | reuses `.bsp-confirm-overlay`/`.bsp-confirm-box` + owns `useState` open/close (the VerificationInfo pattern) | source-sentinel |
| AC4 — popover shows npub + hex pubkey, each labelled | `T5` | labels `Pubkey (hex)` + `npub`, reusing `.bsp-id-row`/`.bsp-id-label` | source-sentinel |
| AC5 — each copy-to-clipboard, full value, same feedback | `T1`, `T6` | `CopyButton.jsx` extracted (default export, `navigator.clipboard.writeText`, `📋→✓`); `IdentityDetails` imports it and renders one for **both** `value={pubkey}` and `value={npub}` | source-sentinel |
| AC6 — identifiers no longer inline in the page body | `T9` | the page no longer defines a local `CopyButton`, no longer renders `<CopyButton value={pubkey/npub}>`, and the `Pubkey (hex)` row is gone | source-sentinel |
| AC7 — Website + Lightning remain in the Identity section | `R1`, `R2` | `profile.website`→`toExternalUrl`/`bsp-id-link` and `profile.lud16`/`⚡` rows persist | regression |
| AC8 — Identity section not an empty shell when no website & no lightning | `T10` | the Identity `.bsp-section` is gated on `website \|\| lud16` (a combination absent pre-impl) | source-sentinel |
| AC9 — purely presentational (same values, same derivation) | `T11`, `R3` | `IdentityDetails` does no `fetch` (props-only); npub still derived via `nip19.npubEncode` | source-sentinel + regression |

Every acceptance criterion maps to at least one test.

## Edge cases

- [x] **Empty Identity section** (no website, no lud16) → `T10` (section must collapse, not render a bare heading).
- [x] **Wrong glyph** — `T2` explicitly rejects `🔑` (key) and `ⓘ` (the "explain" glyph) so a regression to either is caught, not just the presence of *a* glyph.
- [x] **Full vs truncated copy** — `T6` pins the copy value to `{pubkey}`/`{npub}` (the full props), not the truncated display string.
- [x] **False positives from pre-existing strings** — `navigator.clipboard.writeText`, `bsp-info-btn`, `bsp-confirm-*`, `bsp-id-row` all already exist elsewhere, so the new-component sentinels assert them inside the **new** files (absent pre-impl → fail on the existence assertion). The removal sentinels (`T9`) rely on the **old** inline code still being present now, so they fail until it is actually moved.
- [ ] **npub `null` guard** — `npub` can be `null` if `nip19.npubEncode` throws; the ADR keeps the existing `{npub && …}` guard inside the popover. Not separately sentineled (low value as a source regex); noted for the Implementer/Reviewer.

## Test infrastructure

- Runner: Node built-in via `npm test` (`node test/test.js`). The new suite is registered in `test/test.js` (require + `run()` + results row + `overallOk`).
- No Concept Graph / firmware / fixtures required (pure source inspection).
- No new test framework (house rule).

## How to run

```
npm test
```

## Verification

Baseline `npm test` was **green (Overall: PASS)** before adding the suite. With the failing suite added (working tree on top of commit `ff3c754f`), on 2026-06-16:

```
profile-identity-details-popover suite:
  ✗ T1: CopyButton.jsx is extracted as a standalone component …   ui/src/components/CopyButton.jsx does not exist yet.
  ✗ T2: IdentityDetails renders a bsp-info-btn trigger with the neutral ⋯ glyph …   ui/src/components/IdentityDetails.jsx does not exist yet.
  ✗ T3: the IdentityDetails trigger carries an aria-label …   IdentityDetails.jsx does not exist yet.
  ✗ T4: IdentityDetails opens a bsp-confirm-overlay/bsp-confirm-box popover …   IdentityDetails.jsx does not exist yet.
  ✗ T5: the popover labels and shows both the hex pubkey and the npub …   IdentityDetails.jsx does not exist yet.
  ✗ T6: IdentityDetails imports CopyButton and renders one for BOTH pubkey and npub …   IdentityDetails.jsx does not exist yet.
  ✗ T7: BrainstormProfile renders <IdentityDetails> inside a .bsp-name-row …   BrainstormProfile must import IdentityDetails.
  ✗ T8: styles.css defines .bsp-name-row …   styles.css must define .bsp-name-row …
  ✗ T9: BrainstormProfile no longer renders the identifiers inline …   the local CopyButton definition must move …
  ✗ T10: the Identity section is gated on (website || lud16) …   … must render only when (profile?.website || profile?.lud16) …
  ✗ T11: IdentityDetails is presentational — no data fetch …   IdentityDetails.jsx does not exist yet.
  ✓ R1: Website remains in the Identity section (regression) (AC7)
  ✓ R2: Lightning (lud16) remains in the Identity section (regression) (AC7)
  ✓ R3: npub is still derived via nip19.npubEncode … (AC9)

profile-identity-details-popover suite:          FAIL (3 passed, 11 failed)
Overall:                                         FAIL
```

All 11 spec tests fail for the right reason (feature not implemented); all 3 regression sentinels pass; **no other suite is affected** (only this suite shows FAIL). The Implementer is done when this suite reads `PASS (14 passed, 0 failed)` and Overall returns to PASS.
