# Test Plan: Story verified-muters #2 — Verified Muters profile surface

**Story:** `engineering-team/stories/verified-muters/2-verified-muters-profile-surface.md`
**ADR:** `engineering-team/decisions/verified-muters/0002-verified-muters-profile-surface.md`
**Date:** 2026-06-21

## Approach

This is a **frontend** story (badge + line break in the profile counts row, plus a new
list page and route). The repo's UI tests are **source-sentinel** suites under `test/`
(Node's built-in runner) — Playwright is broken repo-wide and is not used. This plan
mirrors the established sibling suites:

- `test/verified-reporters-list-page.test.js` — the list-page + route + hook structure.
- `test/profile-verified-counts-owner-pov.test.js` / `test/profile-identity-details-popover.test.js`
  — the `BrainstormProfile.jsx` counts-row sentinels (with `sliceFn`-style scoping).

The new suite reads the `.jsx` / `.css` source off disk and asserts structure via regex.
Where a target string already appears elsewhere in a file (false-positive risk), the
assertion is **scoped to a sliced region** — the `.bsp-counts` container for the badge,
or a single new file for the page/hook.

### Why these tests fail now (the right reason)

All five surfaces the ADR specifies are **absent** at this commit (verified by `grep`/`ls`):

- `ui/src/pages/BrainstormMuters.jsx` — does not exist (`safeRead` → `''`).
- `ui/src/hooks/useGrapevineMuters.js` — does not exist.
- `ui/src/App.jsx` — has **no** `/user/:pubkey/muters` route.
- `ui/src/pages/BrainstormProfile.jsx` counts row — has **no** Verified Muters `<Link>`
  and **no** `.bsp-count-break` element. (The `TRUST_METRICS` *Reputation* grid at
  `:48` labels a metric "Muters" and reads `verifiedMuterCount`, but that Meili-backed
  card is **not** the counts-row badge — the badge sentinels are scoped to the
  `.bsp-counts` container to avoid matching it.)
- `ui/src/styles.css` — has **no** `.bsp-count-break` rule.

So the new-surface sentinels fail on missing files / missing markers — not on a typo or
import error. The regression sentinels (R1–R5) pass before AND after.

## Coverage map

Every acceptance criterion maps to ≥1 test. All tests live in
`test/verified-muters-profile-surface.test.js`.

| Criterion | Test name | Level |
|---|---|---|
| AC1 (badge between Hops and Verified Reporters; count from `useUserCounts`) | `T1: the counts row renders a Verified Muters <Link> between Hops and Verified Reporters (AC1)` | source-sentinel |
| AC1 (count source = owner-PoV `useUserCounts.verifiedMuterCount`, the same source the list reads) | `T2: the Verified Muters badge reads its count from userCounts.verifiedMuterCount via fmtCount (AC1)` | source-sentinel |
| AC2 (badge links to its own bookmarkable list-page URL) | `T3: the Verified Muters badge is a Link to /user/:pubkey/muters (AC2)` | source-sentinel |
| AC2 (route parallel to followers/reporters) | `T4: App.jsx registers /user/:pubkey/muters → BrainstormMuters (AC2)` | source-sentinel |
| AC3 (neutral, like Verified Followers — no negative styling, no alarm icon, always a plain link) | `T5: the Verified Muters badge is neutral — no bsp-count-value-negative, no alarm icon, no 0-hides branch (AC3)` | source-sentinel |
| AC4 (visual line break between Hops and Verified Muters — element + CSS) | `T6: a .bsp-count-break element sits between the Hops Link and the Verified Muters Link (AC4)` | source-sentinel |
| AC4 (the break is a full-row flex-basis:100% rule that forces the wrap) | `T7: styles.css defines .bsp-count-break as a zero-height flex-basis:100% row break (AC4)` | source-sentinel |
| AC5 (new list page exists, mirrors Verified Followers — hook, DataTable, row→profile nav) | `T8: BrainstormMuters.jsx exists, reads :pubkey, consumes useGrapevineMuters, reuses DataTable, rows navigate to the profile (AC5)` | source-sentinel |
| AC5 (new hook hits the Story-1 muters endpoint at owner PoV) | `T9: useGrapevineMuters fetches /api/get-grapevine-muters?observee=… at owner PoV (no observer param) (AC5)` | source-sentinel |
| AC5 (same columns + same default sort as Verified Followers; NO report-specific columns) | `T10: the page mirrors the Followers columns and default sort, with NO report-specific columns (AC5)` | source-sentinel |
| AC5 (muters title + normal empty state, not an error) | `T11: the page shows a Verified Muters title and a normal (non-error) empty state for zero muters (AC5)` | source-sentinel |
| AC5 (distinct column-prefs storage key so it does not clobber siblings) | `T12: the page uses a distinct localStorage key bsp-muters-columns (AC5)` | source-sentinel |

## Edge cases (explicit tests)

- **Badge is always a plain link (no 0-hides branch).** Unlike the Verified Reporters
  block — which renders a non-link `<span>` at `0` — the muters badge must be an
  unconditional `<Link>`. Asserted in **T5** (the scoped `.bsp-counts` slice must contain
  exactly one muters reference and it must be inside a `<Link to=…/muters>`, with no
  ternary that drops the link at `0`).
- **Badge is neutral — no alarm treatment.** No `bsp-count-value-negative`, no
  `bsp-count-alarm-icon`, no `🚩` on the muters badge (those are Reporters-only,
  ADR profile/0032; scoped to the muters slice in **T5** so the still-present Reporters
  alarm does not cause a false negative).
- **List page carries NO report-specific columns.** No `reportType` / `report_type` /
  `timestamp` / "Reported" / "Report Type" anywhere in `BrainstormMuters.jsx` (**T10**).
- **Empty state is normal, not an error.** Zero muters renders the followers-style
  `.bsp-empty` "No verified muters found…", not an error/`bsp-trust-unavailable` shell
  (**T11**).
- **Line break forces the wrap unconditionally** (not a "wrap only when crowded"
  heuristic): the `.bsp-count-break` rule is `flex-basis: 100%` with `height: 0` (**T7**).

## Regression sentinels (PASS before AND after)

- **R1:** The four existing counts-row metrics are unchanged — the `.bsp-counts` slice
  still has the Following / Verified Followers / Hops links and the Verified Reporters
  block (their labels, link targets, and the Reporters alarm path) intact.
- **R2:** `App.jsx` still registers the `/follows`, `/followers`, and `/reporters`
  routes (the muters route is added beside them, not in place of one).
- **R3:** `BrainstormFollowers.jsx` is untouched — still uses `useGrapevineFollowers`,
  its own `bsp-followers-columns` key, and the `verifiedFollowerCount`-desc default sort
  (guards against editing the wrong file).
- **R4:** `BrainstormReporters.jsx` is untouched — still uses `useGrapevineReporters`,
  its own `bsp-reporters-columns` key, and the `rank`-desc default sort.
- **R5:** The Reputation `TRUST_METRICS` grid in `BrainstormProfile.jsx` still reads
  `trustScores` (the Meili card is unrelated to the counts-row badge and must not move).

## Test infrastructure

- Test framework: Node built-in runner (`node test/test.js`, i.e. `npm test`).
- **No** running services required — these are static source-regex sentinels (they read
  files off disk; no `localhost:8877`, no Neo4j, no firmware install).
- Registration: ONE added `require(...)` line + the suite's `run()`/print/overall wiring
  in `test/test.js`. No existing test is edited, weakened, or reordered.
- Fixtures: none.

## How to run

```
npm test
```

(Playwright is broken repo-wide and is not used for this story.)

## Verification

The new suite fails with the current code (frontend missing). Confirmed on 2026-06-21 on
branch `staging` (`npm test`). The 12 AC/edge tests (T1–T12) FAIL because the page, hook,
route, badge, and `.bsp-count-break` do not exist; the 5 regression sentinels (R1–R5)
PASS:

```
verified-muters-profile-surface suite:
  ✗ T1: the counts row renders a Verified Muters <Link> between Hops and Verified Reporters (AC1)
      the .bsp-counts row must render a "Verified Muters" metric (the new fifth badge; pre-implementation the counts row has none — only the Reputation grid does).
  ✗ T2: the Verified Muters badge reads its count from userCounts.verifiedMuterCount via fmtCount (AC1)
      the badge value must come from userCounts?.verifiedMuterCount (owner-PoV useUserCounts, ADR profile/0031) — the SAME source the muters list reads, NOT the Meili trustScores grid.
  ✗ T3: the Verified Muters badge is a Link to /user/:pubkey/muters (AC2)
      the Verified Muters metric must be a <Link to={`/user/${pubkey}/muters`}> (its own bookmarkable list-page URL, parallel to /followers and /reporters).
  ✗ T4: App.jsx registers /user/:pubkey/muters → BrainstormMuters (AC2)
      App.jsx must declare a route with path '/user/:pubkey/muters' (the badge's link target).
  ✗ T5: the Verified Muters badge is neutral — no bsp-count-value-negative, no alarm icon, no 0-hides branch (AC3)
      the Verified Muters badge must exist in the counts row first (see T1).
  ✗ T6: a .bsp-count-break element sits between the Hops Link and the Verified Muters Link (AC4)
      the counts row must contain a .bsp-count-break element (the visual line break grouping the bad indicators onto the next line).
  ✗ T7: styles.css defines .bsp-count-break as a zero-height flex-basis:100% row break (AC4)
      styles.css must define a `.bsp-count-break` rule (it does not exist pre-implementation).
  ✗ T8: BrainstormMuters.jsx exists, reads :pubkey, consumes useGrapevineMuters, reuses DataTable, rows navigate to the profile (AC5)
      ui/src/pages/BrainstormMuters.jsx does not exist yet — the Implementer must create the muters list page (mirror of BrainstormFollowers).
  ✗ T9: useGrapevineMuters fetches /api/get-grapevine-muters?observee=… at owner PoV (no observer param) (AC5)
      ui/src/hooks/useGrapevineMuters.js does not exist yet — the Implementer must create it (mirror of useGrapevineFollowers).
  ✗ T10: the page mirrors the Followers columns and default sort, with NO report-specific columns (AC5)
      BrainstormMuters.jsx does not exist yet.
  ✗ T11: the page shows a Verified Muters title and a normal (non-error) empty state for zero muters (AC5)
      BrainstormMuters.jsx does not exist yet.
  ✗ T12: the page uses a distinct localStorage key bsp-muters-columns (AC5)
      BrainstormMuters.jsx does not exist yet.
  ✓ R1: the four existing counts-row metrics are unchanged — Following/Verified Followers/Hops links + the Verified Reporters alarm block remain (AC2)
  ✓ R2: App.jsx still registers the follows, followers, and reporters routes (regression)
  ✓ R3: BrainstormFollowers.jsx is untouched — useGrapevineFollowers + bsp-followers-columns + verifiedFollowerCount default sort (regression)
  ✓ R4: BrainstormReporters.jsx is untouched — useGrapevineReporters + bsp-reporters-columns + rank-desc default sort (regression)
  ✓ R5: the Reputation TRUST_METRICS grid still reads Meili trustScores — only the counts-row badge is new (regression)

verified-muters-profile-surface suite:           FAIL (5 passed, 12 failed)
```

**Failing for the right reason** — each failure is a missing file (`safeRead` → `''`) or a
missing source marker (the `.bsp-counts` row has no Verified Muters badge / no
`.bsp-count-break`; `styles.css` has no `.bsp-count-break` rule), not a typo or import
error. T5's message references T1 because the neutrality check is conditioned on the
badge existing first; it will pass once the badge is present and styled neutrally.

**Only newly-failing suite.** The other FAILs in the run
(`profile-tags*`, `*-publish`, `pin-a-tag-publish`, `tl-publication-*`,
`customize-pin-curation-publish`, `most-pinned-tag-index-publish`, etc.) are the
pre-existing publish-flow / live-stack suites — unrelated to this story and untouched.
Story 1's `verified-muters-read-api` suite (18 passed) and every sibling profile suite
(`profile-followers-list` 27, `verified-reporters-list-page` 16,
`profile-verified-counts-owner-pov` 12, `profile-identity-details-popover` 14) still
PASS — confirming no existing test was edited, weakened, or reordered.
