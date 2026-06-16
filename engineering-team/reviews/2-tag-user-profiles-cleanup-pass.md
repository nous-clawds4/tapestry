# Review 2: Story 1 — Tag user profiles (cleanup pass)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-11
**Diff:** `git diff b6d2fbb8...HEAD` — single commit `2156d662` (`fixup: address review findings — doc drift + dead code + publish-failure UX`).

Scope: this review only audits the fixup commit on top of Review 1's PASS state. The eleven-AC implementation was already validated in `engineering-team/reviews/1-tag-user-profiles.md`; this pass verifies (a) each of Review 1's ten non-blocking findings was actually fixed, (b) the fixes didn't introduce regressions, and (c) no new findings crept in.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (20/20 — 13 contract + 7 publish-flow including search-integration).
- [x] `npm run test:playwright` (focused, chromium) — **PASS** (4/4).
- _Lint not configured — skipped._
- _Typecheck not configured — skipped._
- _Build not configured — skipped (verified `cd ui && npx vite build` still produces clean SPA bundle.)_

## Review 1 findings — resolution audit

| # | Finding (R1) | Resolution verified |
|---|---|---|
| 1 | Story AC-1 wording stale | ✓ AC-1 now reads "inline `TAGS` section visible between the action row and `About`, with `Add` (`+`) affordance and `Manage` link" — matches the implementation. |
| 2 | Story AC-2 wording stale | ✓ AC-2 now reads "click the `Add` (`+`) affordance, when the dialog opens, then I can (a) select an existing tag via typeahead search ... or (b) switch to a 'Create new' tab" — matches the implementation. |
| 3 | Test plan stale test names | ✓ Coverage table now references the current Playwright test names (`profile page renders an inline TAGS section with a Manage link`, `TAGS section exposes an add affordance`, `clicking the add affordance opens an Add tag dialog`, `Manage button opens a Manage dialog`). |
| 4 | Test plan missing AC-11 row | ✓ AC-11 row added with the actual test name `typeahead search returns a profile tagged by a third-party author, with _matchedTags on the hit`. |
| 5 | ADR `applicableTo` drift in §Server API | ✓ `available-tags` return shape no longer claims `applicableTo`. Remaining `applicableTo` mentions are historical (Context section describing past graph state) or explicitly noted as dropped (Follow-ups section, line 139). |
| 6 | `meiliFetchProfilesByPubkey` JSDoc lie | ✓ JSDoc corrected: "Uses per-key GETs … Filter-based bulk fetch is not used because the `id` field is not declared filterable." Accurate. |
| 7 | Orphan doc block above `computeTagMatches` | ✓ Two stacked doc blocks merged into one that properly describes `computeTagMatches`, including both behavior and that it's exposed via `GET /api/profile-tags/match` and consumed by the meili proxy. |
| 8 | `handleTagMatchInternal` wrapper indirection | ✓ Wrapper removed; `src/api/search/profiles/meili/index.js:198` now calls `computeTagMatches(...)` directly. |
| 9 | Unused `authorPk` const in `revoke()` | ✓ Renamed to `pubkey` and used in the event template (`pubkey,` shorthand on line 148). Not dead anymore. |
| 10 | Publish-failure silently swallowed | ✓ New `publishOrThrow(signed)` helper in `useProfileTags.js:26–35` throws when BOTH local and external publishes fail, matching the deleted `RelayTagPanel.jsx` precedent. Section-level `actionError` state added to `ProfileTagsSection` (line 24) and rendered (line 108). Wrap function (line 59–73) sets the error AND re-throws so dialog handlers can keep dialogs open on failure. Chip handlers (lines 78–79) intentionally `.catch(() => {})` because TagChip lacks a local error surface and relies on the section banner — documented inline. Sound separation. |

All ten findings actually resolved at the file:line level. No spec/architecture regressions.

## Spec adherence (re-verified against the now-corrected story)

- [x] All eleven acceptance criteria still have passing tests after the wording refresh.
- [x] AC-1 and AC-2 wording now matches what the tests assert.
- [x] No bonus behavior added in this commit (cleanup only).

## ADR adherence

- [x] ADR §Server API now matches the implementation's four endpoints (including `/match`).
- [x] ADR §UI now describes the four-component layout (`ProfileTagsSection`, `TagChip`, `AddTagDialog`, `ManageTagsDialog`) — what's actually in the tree.
- [x] New ADR §"Search integration (POV-aware, query-time)" documents the proxy fold-in and the POV-bypass-on-no-suffix degradation. Accurate.
- [x] No new deps. No code outside the diff's stated scope.

## Concept-graph integrity

- [x] No firmware or concept changes in this commit; the previous review's verification still holds.
- [x] Handles still in `kind:pubkey:slug` form throughout.

## Things tests can't catch

- [x] No new secrets. No leftover debug logging. No commented-out code.
- [x] `publishOrThrow` correctly distinguishes "local OK, external failed" (silent — strfry-router will redistribute) from "both failed" (throw). Matches the deleted relay-discovery precedent. Right policy for a federated relay model.
- [x] `wrap` re-throws after setting `actionError`. Dialog handlers (`handleSelectExisting`, `handleCreateNew`, `handleRevoke`) propagate the rejection so AddTagDialog and ManageTagsDialog can react. Chip handlers (`handleApply`, `handleDispute`) suppress with `.catch(() => {})` because the chip's caller doesn't render local errors — relies on section banner. Comments inline make the split explicit. Sound.
- [x] No race conditions introduced.
- [x] No security regressions (input validation, no new shell-exec paths, no new query-string flow).

## House rules

- [x] No new lint/typecheck/build tooling.
- [x] Concept Graph API authority still respected.
- [x] No new ADR needed for this cleanup (doc + minor code changes, no architectural decisions).

## Findings

### Blocking
None.

### Non-blocking
None worth flagging. The fixup commit is a clean follow-up: targeted, well-scoped, with clear commit message and a tested green state.

## Verdict

**PASS**.

The cleanup pass resolves all ten findings from Review 1 without introducing regressions. Both quality gates clean, branch is in a shippable state, no remaining drift between story / ADR / test plan / implementation.

Story 1 is ready for PR.
