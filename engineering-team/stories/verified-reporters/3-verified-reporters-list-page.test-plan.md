# Test Plan: Story verified-reporters #3 — Verified Reporters list page

**Story:** `engineering-team/stories/verified-reporters/3-verified-reporters-list-page.md`
**ADR:** `engineering-team/decisions/verified-reporters/0003-verified-reporters-list-page.md`
**Date:** 2026-06-07

## Approach
Two tiers, matching the follows/followers precedent:

1. **Deterministic source-regex node suite** — `test/verified-reporters-list-page.test.js`, run by `npm test`, wired into `test/test.js`. The page (`BrainstormReporters.jsx`) and its route do not exist pre-implementation, so **T1–T14 are the failing tests**; **R1–R3** are regression sentinels (the follows/followers routes and the untouched followers page) that pass before and after.
2. **Supplementary Playwright spec** — `tests/brainstorm/profile-verified-reporters-list.spec.js`. Live-data dependent, **not run pre-implementation** — exercised at the staging smoke. It covers the page shell, the empty state (most accounts have 0 verified reporters), and the PoV line; the populated path (Rank-desc rows, row→profile, count parity) is a documented manual/fixture check.

**False-positive trap handled:** `App.jsx` and `BrainstormFollowers.jsx` already contain `reporters` / `Verified Reporters` / `verifiedReporterCount` (the followers page has a "Verified Reporters" *column*). Every sentinel targets the NEW page/route/key/copy — `BrainstormReporters`, `/user/:pubkey/reporters`, `bsp-reporters-columns`, the reporters-specific strings.

## Coverage map
| Criterion | Test(s) | Level |
|---|---|---|
| AC1 — route + title + back link + description | T1 (route), T2 (page, title, back, description), T3 (hook) | source-regex |
| AC2 — columns picture/name/Rank, sorted Rank desc | T4 (Rank col + DataTable), T5 (rank-desc sort, not verifiedFollowerCount) | source-regex |
| AC3 — row → reporter profile | T6 (`onRowClick → navigate('/user/'+pubkey)`) | source-regex |
| AC4 — row count == count under same PoV | T3 (rows from the hook; page count is live `rows.length`, not the Meili badge); endpoint count=data.length is Story 2 | source-regex |
| AC5 — PoV line + "About this data" popover | T7 (House PoV line), T8 (local/NIP-85 + "no single global number") | source-regex |
| AC6 — empty state, verbatim | T9 | source-regex |
| AC7 — skeleton loader; error + retry | T10 (`bsp-skeleton-row` + `@keyframes bsp-shimmer`), T11 (error copy + "Try again"), T12 (hook `refetch` + page wires it) | source-regex |
| Delta — distinct storage key | T13 (`bsp-reporters-columns`) | source-regex |
| Regression guard inherited — /api/profiles cap | T14 (`PROFILE_CHUNK ≤ 50`) | source-regex |
| Regression — follows/followers routes intact | R1 | source-regex |
| Regression — followers page untouched | R2 (hook + storage key), R3 (verifiedFollowerCount sort) | source-regex |

## Edge cases
- [x] Empty (0 verified reporters) → designed empty state, not blank/error — T9 (+ Playwright on a real 0-account).
- [x] Loading → skeleton, not a text loader / bare spinner — T10.
- [x] Error → style-guide copy + retry (not a raw error / "Something went wrong") — T11; retry needs the hook `refetch` — T12.
- [x] Copy-paste-from-followers mistakes: wrong default sort (T5 guards), wrong storage key (T13), editing the followers file instead (R2/R3).
- [x] Honest PoV: v1 membership is House-only, so the House PoV line is asserted (T7) — not the personal line.
- [ ] Populated path (Rank-desc rows, row click, count parity) live — Playwright manual/fixture + staging smoke (needs an account with verified reporters).

## Test infrastructure
- Framework: Node built-in runner (`node test/test.js`) for the deterministic suite (wired in `test/test.js`); Playwright (`npm run test:playwright`) for the supplementary spec.
- Concept Graph API: not required (no concept/graph change).
- Live stack: only the Playwright spec needs a running instance with the UI **built** (`npm run build` in `ui/`) and the reporters endpoint live. Base URL `BRAINSTORM_BASE_URL` or `http://localhost:7778`.
- Fixtures: Playwright uses Jack Dorsey (`82341f88…be6a2`) as a scores-loaded, 0-verified-reporters account for the empty-state path.

## How to run
```
npm test                       # deterministic node suites (incl. this one)
npm run test:playwright        # supplementary browser spec (needs a built, running instance)
```

## Verification
The new node suite fails with the current code (T1–T14 fail — page/route/skeleton/refetch absent; R1–R3 pass — follows/followers intact). Confirmed via `npm test` on 2026-06-07:

```
verified-reporters-list-page suite:
  ✗ T1: ui/src/App.jsx registers /user/:pubkey/reporters → BrainstormReporters (AC1)
  ✗ T2: BrainstormReporters.jsx exists, reads :pubkey, shows the title, back link, and description (AC1)
  ✗ T3: the page sources its rows from the useGrapevineReporters hook (AC1/AC4)
  ✗ T4: columns include Rank (round(influence*100)) and the page reuses DataTable (AC2)
  ✗ T5: default sort is by RANK descending, not by verifiedFollowerCount (AC2)
  ✗ T6: selecting a reporter row navigates to that reporter's /user/<pubkey> profile (AC3)
  ✗ T7: the page shows the House point-of-view line (AC5)
  ✗ T8: the "About this data" popover states local computation AND the no-global-view sentence (AC5)
  ✗ T9: the empty state uses the style-guide copy (AC6)
  ✗ T10: loading shows a skeleton placeholder (a .bsp-skeleton-row + shimmer keyframes), not a bare spinner (AC7)
  ✗ T11: the error state shows the style-guide copy and a "Try again" retry control (AC7)
  ✗ T12: useGrapevineReporters exposes a refetch/reload, and the page wires the retry to it (AC7)
  ✗ T13: the page uses a distinct localStorage key bsp-reporters-columns (delta)
  ✗ T14: the page batches /api/profiles at PROFILE_CHUNK ≤ 50 (regression guard inherited)
  ✓ R1: App.jsx still registers the follows and followers routes (regression)
  ✓ R2: BrainstormFollowers.jsx is untouched — still uses useGrapevineFollowers + its own storage key (regression)
  ✓ R3: BrainstormFollowers default sort remains verifiedFollowerCount desc (the reporters page must not have changed it)

verified-reporters-list-page suite:              FAIL (3 passed, 14 failed)
```

Each `✗` fails because the feature is unimplemented (the new page/route/skeleton CSS/hook refetch are absent), not from a typo or import error. All other suites remain PASS.
