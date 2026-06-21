# Review: Story 2 — Verified Muters profile surface

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-21
**Diff:** `git show 8d9d8fa1` (commit `8d9d8fa175a5abd4f37f75dd7b24da78c50a720c`)
**Story:** `engineering-team/stories/verified-muters/2-verified-muters-profile-surface.md`
**ADR:** `engineering-team/decisions/verified-muters/0002-verified-muters-profile-surface.md`
**Test plan:** `engineering-team/stories/verified-muters/2-verified-muters-profile-surface.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **`verified-muters-profile-surface suite: PASS (17 passed, 0 failed)`** (T1–T12 + R1–R5). Run by me, completed exit 0.
- [x] No previously-green suite regressed. All profile/grapevine siblings still green:
  `verified-muters-read-api` PASS (18), `profile-follows-list` PASS (27), `profile-followers-list` PASS (27),
  `verified-reporters-list-page` PASS (16), `profile-verified-counts-owner-pov` PASS (12),
  `profile-verified-reporters-count` PASS (11), `profile-identity-details-popover` PASS (14),
  `profile-verified-counts-explainer-and-alarm` PASS (15).
- [x] The run's `Overall: FAIL` is driven **only** by the pre-existing publish / live-stack suites
  (`profile-tags`, `profile-tag-polish`, `*-publish`, `pin-a-tag-publish`, `tl-publication-*`,
  `customize-pin-curation-publish`, `most-pinned-tag-index-publish`, `tag-index-publish`,
  `tag-detail-publish`, `tag-detail-curated-view-and-pin-polish-publish`). These require a live
  strfry/Neo4j stack (FATAL strfry-router + no POV) and are documented as unrelated/pre-existing in
  the test plan §Verification. None touch the five files in this diff.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [x] _Build (Vite) not run by reviewer; ADR notes `npm run build` to reflect. No new tooling added._

## Spec adherence (5/5 ACs)

- [x] **AC1 — badge between Hops and Verified Reporters, count from `useUserCounts`.**
  `BrainstormProfile.jsx:282-285` renders the Verified Muters `<Link>` after the Hops link (`:271-274`)
  and its break element (`:277`), and before the Reporters block (`:286-305`). Count is
  `fmtCount(verifiedMuterCount)` where `verifiedMuterCount = userCounts?.verifiedMuterCount ?? null`
  (`:93`) — the owner-PoV `useUserCounts` source, NOT the Meili `trustScores` grid. (T1, T2)
- [x] **AC2 — clickable link to a bookmarkable page; existing metrics/pages unchanged.**
  `<Link to={`/user/${pubkey}/muters`}>` (`BrainstormProfile.jsx:282`); route registered in
  `App.jsx:129-132`. The four existing metrics + the follows/followers/reporters routes/pages are
  untouched (R1–R4). (T3, T4)
- [x] **AC3 — neutral, like Verified Followers.** The muters badge (`:282-285`) is a structural twin of
  the Verified Followers `<Link>` (`:264-267`): always a plain `<Link>`, no `bsp-count-value-negative`,
  no `bsp-count-alarm-icon`/🚩, no `reporterAlarm`, no 0-hides ternary. (T5)
- [x] **AC4 — visual line break between Hops and Verified Muters.**
  `<span className="bsp-count-break" aria-hidden="true" />` (`BrainstormProfile.jsx:277`) between Hops
  and the muters link; `styles.css:3489-3492` defines `.bsp-count-break { flex-basis: 100%; height: 0;
  margin: 0; }` — the unconditional full-row wrap technique (same as `.bs-tag-row-error`). (T6, T7)
- [x] **AC5 — list page mirrors Verified Followers columns + default sort; NO report-specific columns;
  empty-state-not-error.** `BrainstormMuters.jsx` carries the same `ALL_COLUMNS` / `DEFAULT_VISIBLE`
  (`:25-43`), the same default sort `verifiedFollowerCount` desc (`:135`), reuses `DataTable`, and
  navigates rows to the profile (`:225`). No `reportType`/`Report Type`/`Reported`/`timestamp` anywhere.
  Empty state is the normal `.bsp-empty` "No verified muters found for this account." (`:215`), not an
  error shell. (T8–T12)

No criterion silently dropped; no behavior added beyond the story.

## ADR adherence (ADR 0002)

- [x] **Line break — Option A:** one zero-size `flex-basis:100%` break element, `.bsp-count-break`, 3-line
  token-free CSS, in the single existing `.bsp-counts` container. Matches `styles.css:3489-3492`.
- [x] **List page — Option A:** new isolated `BrainstormMuters.jsx` + new `useGrapevineMuters.js` + new
  route. Diff against the followers originals is mechanical: only the four ADR-specified deltas —
  hook (`useGrapevineMuters`), `STORAGE_KEY = 'bsp-muters-columns'` (`:18`), title `Verified Muters`
  (`:185`), empty/loading copy (`:207`, `:215`). Default sort UNCHANGED from followers; columns
  UNCHANGED; NO reporters-only deltas (no skeleton, retry, description, PoV, summary).
- [x] **Badge — Option A:** new always-on neutral `.bsp-count .bsp-count-link` `<Link>` reading
  `userCounts?.verifiedMuterCount ?? null` via `fmtCount`, slotted after Hops+break, before Reporters.
- [x] **Hook contract:** `useGrapevineMuters.js` is a verbatim mirror of `useGrapevineFollowers.js` —
  same `{ data, loading, error }`, same `AbortController`, owner-PoV (no `observer` param), only the
  fetch URL changed to `/api/get-grapevine-muters?observee=${observee}` (`:36`). No `refetch`/`reload`
  reporters-only delta added.
- No deviation from the ADR. No new dependencies. No backend touched (Story 1 owns the endpoints).

## Concept-graph integrity

- [x] No concept definitions or schemas changed — pure frontend over existing Story-1 runtime reads.
  ADR §Concept Graph orientation confirms the named concepts are abstract class-threads, not runtime
  data. No handle changes.
- [x] **Firmware reinstall not required** (ADR §Consequences confirms). Correctly not performed.

## Things tests can't catch

- [x] No secrets in committed files. No hardcoded TA pubkey (grep for `82b75e47…` / `e00ed09087…` in the
  five files = clean; the badge reads the runtime `useUserCounts` source).
- [x] No leftover debug logging / `console.log` (grep clean).
- [x] No commented-out code; the only comments are explanatory and ADR-referenced.
- [x] No `dangerouslySetInnerHTML` and no unescaped rendering. `name`/`npub`/`rank` render as plain text
  via React; `picture` is an `<img src>` with an `onError` hide fallback (mirrors followers).
- [x] Badge truly avoids the alarm treatment — verified by reading `BrainstormProfile.jsx:282-285` in
  context against the untouched Reporters block at `:286-305` (alarm path preserved on Reporters only).
- [x] The Reputation `trustScores` `TRUST_METRICS` grid (R5), the four existing counts-row metrics (R1),
  and the followers/reporters pages (R3/R4) are untouched.
- [x] Error/empty paths handled: `loading` → "Loading muters…"; `error` → `.bsp-trust-unavailable`;
  empty → `.bsp-empty` (mirrors followers exactly). Owner-PoV refusal of non-owner observers is the
  Story-1 endpoint's job; the hook correctly never sends `observer`.

## House rules check

- [x] Concept Graph API authority respected — no concept/schema change.
- [x] No new lint/typecheck/build tooling. No new dependencies (`nostr-tools`, `react-router-dom`,
  `DataTable`, `BrainstormUserMenu`, `AuthContext` are all pre-existing).
- [x] Per-deployment TA pubkey rule respected (no literal; runtime `useUserCounts`).

## Scope-creep

- [x] Exactly the five files in the commit: `App.jsx`, `useGrapevineMuters.js`, `BrainstormMuters.jsx`,
  `BrainstormProfile.jsx`, `styles.css`. `git status` clean apart from a pre-existing unrelated
  untracked draft (`protocols/drafts/event-taggings.md`). Nothing else touched.

## Findings

### Blocking
None.

### Non-blocking
1. **`BrainstormMuters.jsx`** (whole file) — fourth near-duplicate list page (follows/followers/reporters/
   muters). The standing DRY `<GrapevineList>` refactor is the right follow-up; deferred here exactly as
   the ADR §Consequences and the three siblings defer it. Not blocking.

## Verdict
**PASS**
