# Review: Story 29 — follows search input mobile-height fix

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-29
**Diff:** `git show 1a5b6779` (branch `fix/follows-search-mobile-height`, 1 commit over `origin/staging` `101ff518`)
**Scope:** Follow-up to `29-profile-follows-list.md` (PASS) and `29-profile-follows-list-fix.md` (PASS). Covers **only** this responsive-CSS fix.

## Defect (caught on staging, smartphone portrait)
The follows page "Search by name or npub…" input rendered ~10× too tall in portrait; fine on desktop/landscape. Root cause: `.bsp-follows-search` used a fixed-length flex-basis (`flex: 1 1 16rem`); the `@media (max-width:600px)` rule flips `.bsp-follows-controls` to `flex-direction: column`, where flex-basis governs the **main axis (height)** → 16rem became the input height. Landscape width >600px drops the media query → row layout → basis is width again (why rotating "fixed" it).

## Quality gates (run by reviewer)
- [x] **node suite — 27/27** (new T24 green; the prior 23 T-tests + 3 sentinels still green, incl. R1).
- [x] **`npm --prefix ui run build` — clean** (~18s).
- [n/a] lint/typecheck/server build — not configured.

## Audit (`1a5b6779`, 2 files)

`ui/src/styles.css` — `.bsp-follows-search`:
- [x] **Root cause addressed:** `flex: 1 1 16rem` → `flex: 1 1 auto` + `min-width: 12rem`. With basis `auto`, the mobile column layout no longer derives a height from the basis (height is content-based); `min-width` carries the row-layout "don't get too narrow" intent on the cross axis without affecting height.
- [x] **No row-layout regression:** `flex-grow: 1` + `auto` basis still fills the row; `min-width: 12rem` (192px) floors it. On phones (≥320px) the 12rem min-width can't cause horizontal overflow in the column/stretch layout.
- [x] Clear explanatory comment added; no other CSS rules touched.

`test/profile-follows-list.test.js`:
- [x] **Guard T24** matches the `.bsp-follows-search { … }` block and asserts its `flex` shorthand has no fixed-length basis (`flex: <n> <n> <n>(rem|px|em|vh|vw)`). Verified red→green across the fix. **No false-positive risk:** `min-width: 12rem` is a separate declaration, not part of the `flex:` value, and the regex is anchored to `flex\s*:`; the explanatory comment contains no `flex: n n n<unit>` pattern. Added a `STYLES` path const.

## Spec / ADR / scope
- [x] No ADR change (responsive styling only). Shared `follows` Cypher untouched (R1 green). Only the 2 files changed; other story-29 ACs undisturbed (suite green).
- [x] No secrets / debug / dead code.

## Findings
### Blocking
_None._

### Non-blocking
1. The T24 source guard prevents *this specific* regression (fixed-length flex-basis) but can't prove the rendered height is correct — appropriate, since pixel-accurate responsive assertions are brittle. Real proof is the **visual mobile re-verify** at the re-cycle-staging smoke (Chrome at phone-portrait width). Recorded as the verification step, not a gap in the code.

## Verdict
**PASS** — minimal, correct fix of the confirmed root cause; row-layout behavior preserved; meaningful non-brittle regression guard; gates green; no scope creep. Re-deploy to staging and **visually re-verify the search input at a phone-portrait width** before prod.
