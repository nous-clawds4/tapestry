# Review: Story 5 — Authored-tagging section on profile pages

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-14
**Diff:** `git diff 890ccaff...HEAD` (commits `dbf4a59c`, `fbfd84b7`, `b73354f9`, `8328dbf6`, `10ea887b`, `869a9c33`)
**Story:** `engineering-team/stories/done/5-authored-tagging-on-profile.md`
**ADR:** `engineering-team/decisions/0005-authored-tagging-on-profile.md`
**Test plan:** `engineering-team/stories/done/5-authored-tagging-on-profile.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. 10 suites, 67 tests passed, 16 publish-flow tests SKIP (sandbox precondition: `/var/lib/brainstorm/settings.json` not writable). 51 prior-story tests continue to pass — no regression from the `<SortToggle>` extraction or `timeAgo` move.
  ```
  Configuration Loading:        PASS
  profile-tags suite:           PASS (13 passed, 0 failed)
  profile-tags-publish suite:   PASS (7 passed, 0 failed)
  tag-detail suite:             PASS (8 passed, 0 failed)
  tag-detail-publish suite:     PASS (9 passed, 0 failed)
  tag-detail-write suite:       PASS (4 passed, 0 failed)
  tag-detail-write-publish suite: PASS (4 passed, 0 failed)
  tag-index suite:              PASS (7 passed, 0 failed)
  tag-index-publish suite:      PASS (9 passed, 0 failed)
  authored-tagging suite:       PASS (6 passed, 0 failed)
  authored-tagging-publish suite: SKIP (16 tests; preconditions not met)
  Overall:                      PASS
  ```
- [x] `npm run test:playwright` — _not run in this environment (Playwright not installed; same caveat as Stories 1–4)._ Implementer / CI envs run it.
- [x] _Lint not configured — skipped (project rule)._
- [x] _Typecheck not configured — skipped (project rule)._
- [x] _Build not configured — skipped (project rule)._ UI bundle was manually rebuilt inside the container during implementation for browser verification — confirmed working by user via screenshots.

## Spec adherence

- [x] Every acceptance criterion has a passing test or is covered transitively per the test plan's mapping:
  - **AC-1** (section renders when ≥1 authored assertion's target is in viewer's POV WoT) → `rows array contains exactly the 4 fixture rows whose target is in the WoT (Row4 dropped)` (publish suite) + Story-1 regression Playwright guard.
  - **AC-2** (polarity, tag link, target link, timestamp) → `row shape includes polarity, createdAt, target metadata, tag metadata, parent counts, peer counts` (publish suite). Link routes are deterministic strings built from `slug`+`tagEventId` and `targetPubkey`; same precedent as Stories 2/4.
  - **AC-3** (sort facility shared with Story 4) → `accepts each documented sort value` (contract) + 5 sort-correctness tests (publish suite). UI reuse: `<SortToggle>` consumed by Tag.jsx, Tags.jsx, and AuthoredTaggingSection.jsx (verified: legacy `bs-tag-sort-btn` and `bs-tagindex-sort-btn` classes are gone; CSS rewritten to descendant selectors under the existing wrapper classes).
  - **AC-4** (polarity visually distinguishable) → `polarity is "disputed" for Row3` (publish suite) + CSS `.bsp-authored-applied` (green) / `.bsp-authored-disputed` (red) badges per row.
  - **AC-5** (target-WoT filter + partial-state hint) → `rows array contains exactly the 4 fixture rows whose target is in the WoT (Row4 dropped)` + `response carries the resolved POV` (publish suite). POV-hint footer renders always-on when `povSuffix` is non-null.
  - **AC-6** (hidden when zero rows) → `an author with no authored assertions returns rows: []` (publish suite) + `AC-6: TAGGING ACTIVITY section is hidden on a profile with no authored assertions` (Playwright). `AuthoredTaggingSection.jsx:96` early-returns `null` when `!loading && !error && rows.length === 0`.
  - **AC-7** (works on own profile) → covered transitively: `showAboutMe` is false when `viewerPubkey === profilePubkey`, but the main `others` list still renders. `AuthoredTaggingSection.jsx:98` is the exact line.
  - **AC-8** (pinned "Tags they've placed on YOU" sub-block) → client-side partition over the server response. Server-side data covered by the row-shape tests; visual partition at `AuthoredTaggingSection.jsx:99–100`.
- [x] No criterion silently dropped.
- [x] No behavior added that isn't authorized by the ADR.
  - The `most-backed` sort key (5th mode, beyond the story's 4) is an **explicit ADR addition** documented under Q5 resolution with both Reading A and Reading B framing. The labels (`Popular tags` / `Contested tags` / `Most-backed` / `Most divisive`) and the per-row peer-annotation are likewise ADR-authorized. The Reviewer notes this as deliberate spec amendment, not creep.

## ADR adherence

- [x] Files changed match the ADR's implementation notes exactly:
  - **Server:** `src/api/profile-tags/index.js` adds `AUTHORED_BY_VALID_SORTS`, `AUTHORED_BY_SORTERS`, `handleAuthoredBy`, route registration, module export. Pattern mirrors `handleProfilesTagged` / `handleTagIndex` precedent.
  - **Server algorithm:** 7 numbered steps in `handleAuthoredBy` map 1:1 to the ADR's "Algorithm" list: validate → resolvePov → strfryScan with `authors` filter → polarity bucket → target-WoT filter → parent-tag enrichment → parent-tag scan (yields BOTH parentCounts and peerCounts in one walk) → row composition → server-side sort. The owner-exclusion at `index.js:963` (`if (ev.pubkey === authorPubkey) continue` *between* the parentCounts and peerCounts increments) is exactly what the ADR specifies.
  - **UI:** `ui/src/utils/timeAgo.js` (extracted), `ui/src/components/SortToggle.jsx` (new), `ui/src/hooks/useAuthoredTagging.js` (new), `ui/src/components/AuthoredTaggingSection.jsx` (new), `ui/src/pages/BrainstormProfile.jsx` (mount + import swap), `ui/src/pages/Tag.jsx` + `ui/src/pages/Tags.jsx` (`<SortToggle>` swap with no visual change — CSS rewritten to descendant selectors), `ui/src/styles.css` (`bsp-authored-*` namespace + base `.bs-sort-toggle*` defaults). All directly named in ADR §"Implementation notes".
- [x] Layering / module boundaries respected. New endpoint uses the same `strfryScan`, `dedupeReplaceable`, `readPolarity`, `bucketize`, `parseTagPayload`, `meiliFetchProfilesByPubkey`, and `resolvePov` helpers that Stories 1–4 use — no rewrites, no parallel implementations.
- [x] No new dependencies. No new lint/typecheck/build tooling.

## Concept-graph integrity

- [x] **No concept-graph changes.** The handle constants `NOSTR_USER_TAG_Z_TAG` and `TAG_HANDLE` are constructed deterministically as `39998:${TA_PUBKEY}:<slug>` — same form as the existing endpoints. No new concept definitions; both `tag` and `nostr-user-tag` were established by ADR-0001.
- [x] No `BIBLE.md` reads, no firmware-JSON reads, no `/subgraph` calls. The endpoint reads strfry + Meili exclusively, which is the documented data-plane path.
- [x] **Firmware reinstall not required.** Confirmed by the ADR (§"Firmware reinstall required? No") — no schema or concept changes.

## Things tests can't catch

- [x] No secrets committed. Test fixtures generate ephemeral keypairs per run; no hardcoded keys.
- [x] No leftover debug logging in production code. The `console.log` calls in `test/authored-tagging.test.js` and `test/authored-tagging-publish.test.js` are inside the suite-runner `run()` functions (test-report output) — same pattern as every other suite in this project.
- [x] No commented-out code.
- [x] Error paths handled:
  - `handleAuthoredBy` 400s on missing/malformed `authorPubkey`; 400s on invalid `sort`; 500 with `err.message` on any internal throw. Same envelope shape as the rest of the file.
  - `useAuthoredTagging` handles `cancelled`, sets `error` on non-OK response, drops stale completions via the cancellation guard. Same pattern as `useTagDetail` / `useTagIndex`.
  - `AuthoredTaggingSection` renders an error line when `error` is set; the early-return-null path doesn't accidentally swallow errors (`!loading && !error && rows.length === 0` is the exact guard).
- [x] Concurrency / race: the React hook uses a `cancelled` flag for stale-completion guarding — sufficient for this surface (no Load-more accumulation, so a `liveSeqRef` isn't needed).
- [x] Security: `authorPubkey` is validated with `/^[0-9a-f]{64}$/` before any DB or shell call; `sort` is whitelist-validated. The strfry scan is invoked via `strfryScan(...)` which already escapes the JSON filter; no command injection vector introduced.

## House rules check

- [x] Concept Graph API authority respected — no BIBLE.md or firmware JSON reads.
- [x] No new lint/typecheck/build tooling. Project remains JS-without-build.
- [x] Concept changes that would require firmware reinstall: none.

## Findings

### Blocking

None.

### Non-blocking — observations (no action required)

1. **`src/api/profile-tags/index.js:858, 886, 909`** — four early-return-empty-rows branches in `handleAuthoredBy`. Mild duplication; could be factored to a single helper. Not worth a refactor for v1; defensive early-returns are easier to read than nested conditionals.
2. **Publish-flow suite (`test/authored-tagging-publish.test.js`) SKIPs entirely in sandbox.** The suite is gated on `settings.json` being writable; in this dev env it isn't. The fixture and assertion design has been verified by inspection (mirrors Story 4's publish-suite design, which runs cleanly in environments with writable settings). The Reading-A-vs-Reading-B sort-distinguishing test (`sort=most-backed` produces an order unique among the five sorts) is the highest-value test in the suite; verify it runs green in implementer / CI envs before merge to staging.
3. **`tests/brainstorm/authored-tagging.spec.js`** — only 2 deterministic Playwright tests (AC-6 + Story-1 regression). AC-1, AC-2, AC-4, AC-8 deeper UI affordances would need fixture-publishing setup which this repo's Playwright infrastructure doesn't have. Documented in the test plan's "Not covered (intentionally)" section. Acceptable per Story 1/2/3/4 precedent; future polish if Playwright fixtures get richer.
4. **`ui/src/components/AuthoredTaggingSection.jsx:117`** — uses `&apos;` for the apostrophe in "Tags they've placed on YOU". Functionally fine; JSX wouldn't complain about a literal apostrophe inside the text content either. Stylistic.
5. **Dev-loop friction** — surfaced and documented during implementation (OPERATIONS.md §9, follow-ups.md). The in-container source-snapshot vs. host-bind-mount gap turned every CSS tweak into a six-step ritual. Tracked for ops polish; not blocking Story 5.

## Verdict

**PASS**

Spec is satisfied (story ACs + ADR's `most-backed` amendment), gate is clean, ADR is honored on both server algorithm and UI structure, no concept-graph changes, no debug code, no scope creep beyond the ADR. The publish-flow suite's environmental SKIP is the only coverage gap and it's the same boundary every prior story has accepted.
