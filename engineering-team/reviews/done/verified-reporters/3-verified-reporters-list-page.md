# Review: Story verified-reporters #3 — Verified Reporters list page

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-07
**Diff:** `git diff staging...HEAD` — implementation commit `37c9cf78` (ui/src/pages/BrainstormReporters.jsx [new], ui/src/hooks/useGrapevineReporters.js, ui/src/styles.css, ui/src/App.jsx)
**Story:** `engineering-team/stories/verified-reporters/3-verified-reporters-list-page.md`
**ADR:** `engineering-team/decisions/verified-reporters/0003-verified-reporters-list-page.md`
**Test plan:** `engineering-team/stories/verified-reporters/3-verified-reporters-list-page.test-plan.md`

## Quality gates (run by reviewer, not trusted)
- [x] `npm test` — **PASS.** `verified-reporters-list-page` suite: PASS (17 passed, 0 failed) — T1–T14 (ACs + deltas) green, R1–R3 (follows/followers intact) green. Overall runner: **PASS** (no other suite regressed).
- [x] Vite build — `ui/` compiles, confirmed at implementation.
- [x] `npm run test:playwright` — not run in review (supplementary, live-data; staging smoke). The deterministic gate is the node suite.
- [x] _Lint / typecheck / build gates not configured — skipped._

## Spec adherence
- [x] AC1 — route `/user/:pubkey/reporters` → `BrainstormReporters` (`App.jsx`); page title "Verified Reporters", back link to `/user/${pubkey}`, description "Verified users who have reported this account." (`BrainstormReporters.jsx` header + `bsp-follows-subtitle`). T1–T3.
- [x] AC2 — columns picture/name/Rank default; `rank = Math.round(influence*100)`; **default sort Rank desc** `(b.rank ?? -1) - (a.rank ?? -1)` (not verifiedFollowerCount). T4/T5.
- [x] AC3 — `onRowClick={row => navigate(\`/user/${row.pubkey}\`)}`. T6.
- [x] AC4 — rows come from `useGrapevineReporters`; the page's count is its own live `rows.length`, never the Meili profile badge (per ADR 0002/0003). T3.
- [x] AC5 — House PoV line `Relative to the House (default) web of trust. …` (honest: v1 membership is House-only); "About this data" popover extended with "There is no single global number." T7/T8.
- [x] AC6 — empty state "No verified reporters. No one in this web of trust has reported this account." T9.
- [x] AC7 — loading renders a skeleton (`bsp-skeleton-row` ×4 with `aria-label="Loading reporters"`, `@keyframes bsp-shimmer`), not a bare spinner; error shows the style-guide copy + a "Try again" button wired to the hook's new `refetch`. T10–T12.
- [x] No criterion dropped; no behavior beyond the story.

## ADR adherence
- [x] Option A — new `BrainstormReporters.jsx` mirroring `BrainstormFollowers.jsx`; reuses `DataTable`, `InfoPopover`, `bsp-*` classes, client sort/search/pagination, localStorage prefs (distinct key `bsp-reporters-columns`), `/api/profiles` batching at `PROFILE_CHUNK = 50`. T13/T14.
- [x] `refetch` added to `useGrapevineReporters` as a **backward-compatible** change: still returns `{data, loading, error}` plus `refetch`; `reloadNonce` added to the effect deps (verified in the hook diff). No other consumer exists yet, so no breakage.
- [x] Skeleton + subtitle/pov CSS added to `styles.css` (token/rem/opacity conventions consistent with the file); no hardcoded hex.
- [x] **Deliberate non-changes honored:** `BrainstormFollowers.jsx` and `BrainstormFollows.jsx` are untouched by the entire branch (confirmed via `git diff --name-only`); R1 (follows/followers routes intact), R2/R3 (followers page + its verifiedFollowerCount sort intact) all green.
- [x] No new dependencies. House/owner PoV only (v1); personalized PoV + the DRY refactor deferred per the ADR.

## Concept-graph integrity
- [x] N/A — front-end page over the Story-2 endpoint; no concept/schema change, no firmware reinstall.

## Things tests can't catch
- [x] State branches are mutually exclusive and correctly ordered (loading → skeleton; error&&!loading → error; !loading&&!error&&empty → empty; else → table). No double-render.
- [x] A11y: the skeleton carries `aria-label="Loading reporters"` (not a contentless spinner); the ⓘ button has an aria-label; the back link and rows are keyboard-navigable (inherited).
- [x] Security: `pubkey` comes from `useParams`; the endpoint validates `observee`; no new injection surface. No secrets, no `console.log`, no commented-out code.
- [x] count=list-length is the page's own live `rows.length` — not coupled to the precomputed Meili badge (transient divergence acceptable, ADR 0002/0030).
- [x] Scope: exactly the 4 files; nothing else touched.

## House rules check
- [x] Concept Graph API authority respected (no concept work).
- [x] No new lint/typecheck/build tooling.
- [x] Style-guide copy used verbatim (title, description, PoV line, empty, error, popover); no banned phrases; glyphs (🔒 ⓘ) are inherited iconography.

## Findings

### Blocking
None.

### Non-blocking
1. **`BrainstormReporters.jsx` — the "Try again" button reuses `className="bsp-follows-colbtn"`** (the Columns-toggle button style) rather than a dedicated retry class. Harmless visual reuse with zero new CSS; an optional future polish (a `.bsp-retry-btn`), not required.
2. **Initial-mount empty-state flash (inherited pattern).** Before the hook's effect sets `loading=true`, there is a render with `loading=false / reporters=null`; React batches the effect so it should not visibly flash, and this is identical to the shipped `BrainstormFollowers`/`BrainstormFollows` pages — not introduced here. Noted for awareness; belongs to the eventual shared-`<GrapevineList>` refactor if ever addressed.

## Verdict
**PASS** — the diff satisfies all seven acceptance criteria, conforms to ADR 0003 (mirror, Rank-desc sort, verbatim copy, skeleton, error+retry via a backward-compatible `refetch`, House-PoV honesty, own-live-count), keeps the follows/followers pages untouched, and the gate is green (17/17). The two non-blocking notes are a harmless class reuse and an inherited pattern. This completes the verified-reporters MVP end to end.
