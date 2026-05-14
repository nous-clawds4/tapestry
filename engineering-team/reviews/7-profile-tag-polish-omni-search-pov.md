# Review: Story 7 — Profile-tag polish bundle (omni-search popup + POV correctness)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-14
**Diff:** `git diff 7b2e5c16^...HEAD` (commits `7b2e5c16` story, `98f6a6d9` ADR, `d103765a` + `348ca583` ADR amendments, `041b862c` failing tests, `c2ffb24d` impl)
**Story:** `engineering-team/stories/done/7-profile-tag-polish-omni-search-pov.md`
**ADR:** `engineering-team/decisions/0006-profile-tag-polish-omni-search-pov.md`
**Test plan:** `engineering-team/stories/done/7-profile-tag-polish-omni-search-pov.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. 14 suites, 95+ tests passed; 24 publish-flow tests SKIP (sandbox precondition: `/var/lib/brainstorm/settings.json` not writable from the test process). All Story 1–5 + main-side suites continue to pass — no regression from the Story-7 changes.
  ```
  profile-tag-polish suite:                        PASS (11 passed, 0 failed)
  profile-tag-polish-publish suite:                SKIP (8 tests; preconditions not met)
  …
  Overall:                                         PASS
  ```
- [x] `npm run test:playwright` — _not run in this environment (Playwright not installed; same caveat as Stories 1–6)._ Implementer / CI envs run it.
- [x] _Lint not configured — skipped (project rule)._
- [x] _Typecheck not configured — skipped (project rule)._
- [x] _Build not configured — skipped (project rule)._ UI bundle was manually rebuilt inside the container during implementation; end-to-end verified by user via browser ("looks good!").

## Spec adherence

- [x] Every acceptance criterion has a passing test or is covered transitively per the test plan's mapping:
  - **Omni-search: tag substring → tag row in popup** — covered by `search proxy: q=<unique-substring> returns tagHits including the fixture tags` (publish-flow) + verified end-to-end in browser by user.
  - **Tag-row click → tag-detail** — deterministic URL: `TagResultRow.jsx:18` (`<Link to={\`/tag/\${slug}/\${eventId}\`}>`). Route established by Story 2.
  - **Tag rows visually distinguishable** — `bs-tag-result-row` CSS namespace (`ui/src/styles.css:5186-5266`); badge + name + description + "tag" type-marker.
  - **"Show more tags →" affordance** — `BrainstormSearch.jsx:991-1003`, conditional on `popupTagHitsHasMore`; routes via `doSearch()` (matches Enter-submit).
  - **Tags on Enter-results page** — `BrainstormSearch.jsx:1237-1245` renders `resultsTagHits` above the profile list using the same `<TagResultRow variant="results">`.
  - **`tagLimit` query param** — covered by `accepts tagLimit query param` + `clamps tagLimit to server-side max (<= 50)` (contract) + `tagLimit=10 returns all 7 fixture matches` (publish-flow).
  - **Placeholder mentions "tag"** — verified in code at `BrainstormSearch.jsx:973` (landing-view). Story 6 AC-5 satisfied.
  - **POV-scoped chip counts** — covered by `tags-for-profile WITH wotPov=house filters out below-WoT-rank assertion authors` (publish-flow) + 4 contract tests verifying the param contract.
  - **POV: no-POV degrades cleanly** — covered by `tags-for-profile WITHOUT POV params returns all 3 fixture assertions (no WoT filter)`.
  - **POV: re-fetch on POV change** — `useProfileTags.js:33,67` adds `authLoading` and `user?.pubkey` to effect deps; mirrors Story 2/4/5 hook pattern.
  - **POV sweep: `wot-tags`** — covered by `wot-tags accepts wotPov=house` + `wot-tags WITH wotPov=house filters assertion authors by WoT rank`.
  - **Avatar-menu POV selector** — explicitly DROPPED per ADR-0006 (pre-verification gate fails; cross-page POV invalidation files as a follow-up).
  - **Story 6 AC-4 verification** — verified at `ui/src/styles.css:3881-3890` (`.ptc-asserters { max-height: 12rem; overflow-y: auto; }` with explicit Story-6-AC-4 comment).
  - **Story 6 retire to done/** — performed in this review commit (see "On-PASS close-out" below).
- [x] No criterion silently dropped.
- [x] No behavior added that isn't authorized by the ADR. The mid-Architecture scope expansion (tag-results on the Enter-results page) is documented in the ADR amendment commit `348ca583` and the story's "Out of scope" was annotated accordingly.

## ADR adherence

- [x] Files changed match the ADR's implementation notes exactly:
  - **Server:** `src/api/profile-tags/index.js` extends `handleTagsForProfile` + `handleWotTags` with standard `resolvePov` + author-WoT predicate; exports `findTagsByNameSubstring`. `src/api/search/profiles/meili/index.js` adds parallel `tagHitsPromise`, `tagLimit` query-param handling, `tagHits`/`tagHitsHasMore` response fields.
  - **Client:** `ui/src/hooks/useProfileTags.js` threads POV via `useAuth` + auth-bootstrap gating. `ui/src/components/TagResultRow.jsx` is the new shared row component. `ui/src/pages/BrainstormSearch.jsx` adds the three state slots, the `tagLimit` opt on `buildSearchUrl`, popup render block with "Show more tags →", and the Enter-results render block.
  - **CSS:** `ui/src/styles.css` adds the `bs-tag-result-*` namespace.
- [x] Layering / module boundaries respected. Server endpoint pattern (resolvePov → strfryScan → meiliFetch → predicate → response with POV echo) mirrors `handleProfilesTagged` / `handleTagIndex` / `handleAuthoredBy`. UI hook pattern (useAuth + authLoading gate) mirrors `useTagDetail` / `useTagIndex` / `useAuthoredTagging`.
- [x] No new dependencies. No new lint/typecheck/build tooling.
- [x] **Avatar-menu POV selector AC dropped** per ADR Decision section; follow-up filed in `engineering-team/follow-ups.md` ("Cross-page POV invalidation — propagate POV changes to mounted hooks").

## Concept-graph integrity

- [x] **No concept-graph changes.** The handle constants `NOSTR_USER_TAG_Z_TAG` and `TAG_HANDLE` are constructed deterministically as `39998:${TA_PUBKEY}:<slug>` — same form as the existing endpoints. No new concept definitions.
- [x] No `BIBLE.md` reads, no firmware-JSON reads, no `/subgraph` calls. The endpoints read strfry + Meili exclusively.
- [x] **Firmware reinstall not required.** Confirmed by the ADR; verified by reading the diff (no firmware files changed).

## Things tests can't catch

- [x] No secrets committed. Test fixtures generate ephemeral keypairs per run.
- [x] No leftover debug logging in production code. Only `console.error` calls in the proxy degraded-path handlers (intentional error reporting; matches existing patterns).
- [x] No commented-out code, no TODOs, no FIXMEs introduced.
- [x] Error paths handled:
  - `handleTagsForProfile` / `handleWotTags` return 500 with `err.message` on any internal throw; preserve the existing 400-on-malformed-pubkey for `handleTagsForProfile`.
  - Search-proxy `tagHitsPromise` has `.catch(...) => []` so a `findTagsByNameSubstring` failure doesn't poison the response — falls back to empty `tagHits` + `tagHitsHasMore: false`.
  - `useProfileTags` preserves the existing cancellation guard and error setter.
  - `BrainstormSearch.jsx` defensively reads `data.tagHits || []` and `!!data.tagHitsHasMore` (handles absence from the empty-q / pubkeyLookup early-return paths in the proxy).
- [x] Concurrency / race: the React hook uses a `cancelled` flag; `buildSearchUrl` is stateless; the `Promise.all` in the search proxy waits for all four promises before composing the response (no race within a single request).
- [x] Security: `tagLimit` is clamped to `[1, 50]` via `parseInt + Math.min`; an absurd input doesn't blow up the scan. POV params validated by the existing `resolvePov` helper.

## House rules check

- [x] Concept Graph API authority respected — no BIBLE.md or firmware JSON reads.
- [x] No new lint/typecheck/build tooling. Project remains JS-without-build.
- [x] Concept changes that would require firmware reinstall: none.

## Findings

### Blocking

None.

### Non-blocking — observations (no action required)

1. **`ui/src/pages/BrainstormSearch.jsx:1147`** — the results-view search input still uses `placeholder="Search profiles…"` — narrower than the landing-view placeholder which now mentions "tag" (per Story 6 AC-5). Story 6 AC-5 only required the home/search-page placeholder; Story 7 now surfaces tag results on the results page too, so a future-polish refresh of this placeholder ("Search profiles, tags, NIP-05…" or equivalent) would close the loop. 1-line edit; not in either story's explicit AC. Candidate for the tail-end fix-PR Story 8 already absorbs (POV-selector loading state).
2. **`src/api/search/profiles/meili/index.js:78` and `:91`** — the empty-q early-return and the `pubkeyLookup` early-return don't emit `tagHits` / `tagHitsHasMore`. Clients tolerate absence (`data.tagHits || []`, `!!data.tagHitsHasMore`), so this is functionally fine, but the response contract is technically inconsistent across paths. Adding `tagHits: [], tagHitsHasMore: false` to both early-return objects would tighten the contract. Optional cleanup; non-blocking.
3. **`src/api/profile-tags/index.js:204`** — `handleWotTags` is now a POV-aware endpoint but has no current consumers (verified by grep during ADR-0006 authoring). The ADR documents this as "for symmetry with the rest of the read stack." No functional issue today; flagged so the next reader doesn't waste time looking for callers.
4. **`ui/src/pages/BrainstormSearch.jsx:836-839`** — the `loadingMore` path (`offset > 0`) leaves `resultsTagHits` unchanged across pagination clicks. The explicit code comment captures the intent ("tag-results don't paginate"). Correct under the current `tagLimit=25` cap, but if a future iteration pushes `tagLimit` to higher values and adds pagination, this branch will need attention. Captured by the comment; no action needed.

## House rules check (revisited for completeness)

All four follow-ups from `engineering-team/follow-ups.md` that this story interacted with are intact:
- ✅ Agree/disagree framing UX normalization — punted, still in follow-ups.
- ✅ Tags-as-result in root app search — addressed by this story (popup + Enter-results page).
- ✅ WoT-author filter on profile TAGS chips — addressed by this story (POV-aware `handleTagsForProfile`).
- ✅ `e` vs `a` wire-shape decision — punted, still in follow-ups.
- ✅ Local dev-loop polish — punted, still in follow-ups.
- ✅ Cross-page POV invalidation — NEW follow-up filed by ADR-0006 (the dropped avatar-menu AC's unblocker).

## Verdict

**PASS**

Spec satisfied (all explicit ACs covered or explicitly out-of-scope per ADR), gate clean, ADR honored on both server and client, no concept-graph changes, no debug code, no security issues. The mid-Architecture scope expansion (tag-results on the Enter-results page) is documented in the ADR amendment. The publish-flow suite SKIPs in sandbox but its fixture design is verified by inspection and follows established Story 4/5 patterns. End-to-end verified in the browser by the user.

Story 6 is also retired in this review commit per the ADR-0006 close-out commitment.
