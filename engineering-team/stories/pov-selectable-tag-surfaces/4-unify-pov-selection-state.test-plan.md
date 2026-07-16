# Test Plan: pov-selectable-tag-surfaces Story 4 — unify POV selection state

**Story:** `engineering-team/stories/pov-selectable-tag-surfaces/4-unify-pov-selection-state.md`
**Date:** 2026-07-09
**Test file:** `test/pov-state-unification.test.js`

## Strategy
The bug is React effect/state behavior (a mount-time persist clobber + three uncoordinated writers),
which the Node harness can't render. So the automated coverage is **source-contract** on the
load-bearing structure, and the true end-to-end (the saved POV surviving a hard refresh and driving
the tag reads) is the **manual browser proof** — the exact scenario the operator hit.

## Coverage map
| Criterion | Test | Level |
|---|---|---|
| clobber fix — default not written on mount | `S1` (persist guarded by a hydration ref) | source |
| single writer — settings/menu don't own pov state | `S2` | source |
| settings drives the shared selection | `S3` | source |
| global menu is a switcher (writes the selection) | `S4` | source |
| no search regression | `S5` | source |
| saved POV survives refresh + drives reads | `M1`, `M2` | manual |

## Source-contract tests
- **S1** — `PovContext` uses a `useRef` hydration guard and the persist effect early-returns until
  hydrated (so the default `nosfabrica` is never PUT over a saved `pov:user` on mount).
- **S2** — neither `BrainstormSettings` nor `BrainstormUserMenu` owns a local `useState('nosfabrica')`
  pov (they delegate — one writer).
- **S3** — `BrainstormSettings` consumes `usePov()`.
- **S4** — `BrainstormUserMenu` consumes `usePov()` **and** calls `setSelectedPov` (it's a switcher now).
- **S5** — `BrainstormSearch` still consumes `usePov()` (Story-1 convergence preserved).

## Manual browser checklist (`cycle-local`, the operator's repro)
- **M1 — saved POV survives a hard refresh.** As a logged-in user with `pov:user` saved, hard-refresh
  a tag page → the honest-state banner reflects **My WoT** (filtered when provisioned), NOT the
  "no point of view configured" house read. (Pre-fix: non-deterministically showed house.)
- **M2 — switch from the top bar.** Open the avatar menu on any tag page → toggle House ⇄ My WoT →
  the tag surface reflects the new POV on next load, from a non-search page.
- **M3 — consistency.** Setting My WoT in Settings and in the menu agree (one selection); "My WoT" is
  offered in the menu only when a delegate is configured.

## How to run
```
node test/pov-state-unification.test.js
```

## Verification
Pre-fix: **1 passed, 4 failed** (S5 already true; S1–S4 fail — no guard, settings/menu own local pov
state). Post-fix: **5/5**, with the four sibling POV suites unregressed (17/21/8/7). ui build clean;
deployed to `:7778` for the manual proof.
