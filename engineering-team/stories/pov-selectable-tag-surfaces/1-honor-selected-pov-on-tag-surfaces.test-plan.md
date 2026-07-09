# Test Plan: pov-selectable-tag-surfaces Story 1 — tag surfaces honor the selected POV

**Story:** `engineering-team/stories/pov-selectable-tag-surfaces/1-honor-selected-pov-on-tag-surfaces.md`
**ADR:** `engineering-team/decisions/pov-selectable-tag-surfaces/0001-shared-selected-pov-resolver-for-tag-surfaces.md`
**Date:** 2026-07-09
**Test file:** `test/pov-selectable-tag-surfaces.test.js`

## Test strategy

The change is entirely client-side (ESM under `ui/`, `"type":"module"`). The Node CJS runner can't
`require()` ESM and has no JSX transpile, so — as with the sibling UI suites — coverage is two-tiered,
plus a manual browser pass for the true runtime behavior:

- **BEHAVIORAL-UNIT (the crux).** The ADR names `resolvePovReadParams` (`ui/src/utils/povReadParams.js`)
  the test seam. It is a **dependency-free pure ESM util**, so the tests **dynamic-`import()`** it (verified
  the harness supports this) and assert its branch table directly — real coverage of the resolution rule
  that makes "one selection governs everything" correct.
- **SOURCE-CONTRACT.** The convergence + anti-regression wiring: a single `PovContext` holds the selection;
  every one of the six tag surfaces consumes `usePov().povParams`; the **login-binary literal is gone** from
  the five surfaces that had it; `useEventTags` (which sent *no* POV) now threads it; search converges onto
  the same value + util; the provider is mounted at the app root.
- **MANUAL browser checklist.** The observable end-to-end (switch POV → tag surfaces reflect it; logged-in +
  house-selection ≠ own-selection — the anti-login-binary proof) — runtime the source can't prove; run via
  `cycle-local`.

**Honest-limit note (from the ADR):** on this deployment `nosfabrica` aliases `house` in the server
`resolvePov`, so the *distinct* observable axis is **own vs house/named**. The util test encodes exactly
that (named → house), and the manual proof is "logged-in own-selection ≠ logged-in house-selection."

## Coverage map

| Criterion | Test(s) | Level |
|---|---|---|
| **AC-1** explicit selection honored, not login-binary | `B2` (named→house while a user key is present, own suppressed); `S3` (login-binary literal removed); manual `M2` | behavioral + source + manual |
| **AC-2** my-own POV when selected | `B1` (user+hex → `wotPov:user`) | behavioral |
| **AC-3** house / logged-out default | `B3` (house→house), `B4` (user w/o key→house) | behavioral |
| **AC-4** consistency across all five surfaces | `S2a–S2f` (every surface consumes `povParams`) | source |
| **AC-5** one selection governs search + tags | `S1` (single `PovContext` source), `S5` (search consumes same context+util), `S6` (provider at root) | source |
| **AC-6** switching updates the view | `S1` (reactive context exposes `setSelectedPov`+`povParams`); manual `M1` | source + manual |
| guard: invalid viewer key can't force `user` | `B5` | behavioral |
| guard: house/named never leak a `userPubkey` | `B6` | behavioral |

## Behavioral-unit tests (dynamic-import the pure util)

`import('ui/src/utils/povReadParams.js')` → `resolvePovReadParams({ pov, userPubkey })`:
- **B1 — own.** `{pov:'user', userPubkey:<64hex>}` → `{wotPov:'user', userPubkey:<64hex>}`.
- **B2 — named suppressed to house (the AC-1 core).** `{pov:'nosfabrica', userPubkey:<64hex>}` →
  `{wotPov:'house'}` — a *named* selection resolves to house even with a viewer key present (own is NOT
  substituted), which is exactly why selecting nosfabrica while logged in no longer shows "own."
- **B3 — house.** `{pov:'house', userPubkey:<64hex>}` → `{wotPov:'house'}`.
- **B4 — own impossible without a key.** `{pov:'user'}` (no userPubkey) → `{wotPov:'house'}`.
- **B5 — invalid key guarded.** `{pov:'user', userPubkey:'not-hex'}` → `{wotPov:'house'}`.
- **B6 — no viewer-key leak.** For B2/B3/B4/B5 the result has **no** `userPubkey` property (house never
  carries a viewer key).

## Source-contract tests (convergence + anti-regression)

- **S1 — single source of the selection.** `ui/src/context/PovContext.jsx` exists; exports `PovProvider`
  **and** `usePov`; derives `povParams` via `resolvePovReadParams` (imports the util).
- **S2a–S2f — every tag surface consumes the shared params.** Each of `useEventTags.js`, `useTagIndex.js`,
  `useTagDetail.js`, `useAuthoredTagging.js`, `useProfileTags.js`, `TagPageSearch.jsx` imports `usePov`
  and references `povParams`.
- **S3 — login-binary removed (anti-regression, AC-1).** The five surfaces that had it (`useTagIndex`,
  `useTagDetail`, `useAuthoredTagging`, `useProfileTags`, `TagPageSearch`) **no longer contain** the
  `'wotPov','user'` selection literal (the POV value now comes from `povParams`, not a `user?.pubkey`
  check). *Fails now — the literal is present in all five.*
- **S4 — the util exists + exports the symbol** (backstop for the behavioral seam).
- **S5 — search converges (AC-5).** `BrainstormSearch.jsx` references `usePov` **and**
  `resolvePovReadParams`, and no longer holds its own `useState('nosfabrica')` for the pov value.
- **S6 — provider mounted at root (AC-4/AC-5).** `ui/src/main.jsx` references `PovProvider`
  (so every route — search and tag pages — shares one selection).

## Manual browser checklist (runtime-only; `cycle-local` on `localhost:7778`)

- **M1 — switching updates tag surfaces.** Log in; on search, switch POV; navigate to a tag page / open a
  note's tags → counts reflect the selected POV (re-check after switching back).
- **M2 — the anti-login-binary proof (AC-1).** Logged in, select "my own" then a non-own POV on the same
  tag surface → the taggings/counts **differ** between the two selections (today they're identical because
  logged-in is forced to "own" regardless of the menu). Because nosfabrica≡house on this instance, the two
  distinguishable selections are own vs house.

## Edge cases covered
- [x] Logged out → house (B4 path: no userPubkey).
- [x] Named POV with a viewer key present must NOT fall through to own (B2).
- [x] Malformed viewer key can't force `user` (B5).
- [x] House/named never carry a `userPubkey` (B6).
- [ ] *(manual)* live POV switch reflected across surfaces (M1/M2).

## Test infrastructure
- Node built-in runner via the harness. Behavioral tests **dynamic-`import()`** the pure ESM util (no
  React/JSX, dependency-free — verified importable). Source-contract tests read the `.js`/`.jsx` files as
  text. **No live API, no strfry, no browser** dependency.
- Firmware/POV data: none (read-time param threading only; no schema change).

## How to run
```
node test/pov-selectable-tag-surfaces.test.js
```
(or the full suite via `npm test`).

## Verification
Confirmed 2026-07-09: **0 passed, 17 failed** — every failure for the right reason (the util/context
don't exist yet; surfaces don't consume `povParams`; the login-binary literal is still present; search
hasn't converged; the provider isn't mounted), not typos/import-mechanism errors (dynamic `import()`
verified working; the B failures are `ERR_MODULE_NOT_FOUND` for the not-yet-created util).

```
--- pov-selectable-tag-surfaces tests (Story 1) ---
  FAIL  B1..B6  Cannot find module ui/src/utils/povReadParams.js   (util not created yet — the crux seam)
  FAIL  S1      ui/src/context/PovContext.jsx must exist
  FAIL  S4      ui/src/utils/povReadParams.js must exist
  FAIL  S2 (useEventTags/useTagIndex/useTagDetail/useAuthoredTagging/useProfileTags/TagPageSearch)
              must consume the shared selection via a usePov() call
  FAIL  S3      login-binary wotPov='user' literal still present (anti-regression)
  FAIL  S5      BrainstormSearch must source the selection from a usePov() call
  FAIL  S6      ui/src/main.jsx must mount <PovProvider>

pov-selectable-tag-surfaces: 0 passed, 17 failed
```

Note the earlier false-positive that the first run caught: `/usePov/` matched the substring inside
`HousePovLabel` — tightened to a word-boundaried `\busePov\s*\(` hook-call form.
