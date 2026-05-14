# Review: Story 1 — Tag user profiles

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-11
**Diff:** `git diff 79fb8a81...HEAD` (current HEAD `b6d2fbb8`)

Reviewed commits, in branch order:
- `ba810894` chore: Playwright NixOS infra
- `4603d2c5` test: focused-run docs
- `b2810e81` impl: WIP functional baseline
- `2de8be9c` impl: profile-tag UX iteration (inline section + popover)
- `7b9659a0` docs: CLAUDE.md architecture invariants
- `b6d2fbb8` impl: tag-aware search

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (13/13 profile-tags + 7/7 publish-flow = 20/20)
- [x] `npm run test:playwright` (focused, chromium) — **PASS** (4/4)
- [x] Both gates run from a clean shell; no `--reuse` of prior in-flight state.
- _Lint not configured — skipped._
- _Typecheck not configured — skipped._
- _Build not configured — skipped (but `cd ui && npx vite build` produces a clean SPA bundle into `dist/`)._ 

## Spec adherence

**Acceptance criteria coverage:**

| AC | Behavior | Test verifying it | Status |
|---|---|---|---|
| AC-1 | Tag affordance on profile | Playwright `profile page renders an inline TAGS section with a Manage link` | ✔ |
| AC-2 | Select-existing or create-new with name/desc | Playwright `clicking the add affordance opens an Add tag dialog with a search input` + `available-tags lists a kind-39999 tag-element after it is published` | ✔ |
| AC-3 | Apply publishes assertion w/ polarity=1 | `apply (polarity=1) appears under applications` | ✔ |
| AC-4 | Dispute publishes w/ polarity=-1 | `dispute (polarity=-1) appears under disputes` | ✔ |
| AC-5 | Omitted polarity defaults to apply | `event without a polarity tag defaults to applied` | ✔ |
| AC-6 | Chip shows counts + asserters | Asserter rows verified via API contract; chip-popover render verified via Playwright | ✔ (minimal; pubkey-as-handle, not full profile lookup — acceptable) |
| AC-7 | Manage list+revoke | Playwright `Manage button opens a Manage dialog` + `publishing a kind-5 deletion removes the asserted entry` | ✔ |
| AC-8 | Revoke updates count | `publishing a kind-5 deletion removes the asserted entry` | ✔ |
| AC-9 | `tag` enriched + `nostr-user-tag` exists | 5 firmware/graph tests in `test/profile-tags.test.js` | ✔ |
| AC-10 | Events conform to firmware list pattern | concept-graph `/summaries` + schema-shape tests | ✔ |
| AC-11 (new) | Search returns POV-WoT-tagged profiles ranked below name matches, with matched-tag chip | `typeahead search returns a profile tagged by a third-party author, with _matchedTags on the hit` | ✔ (basic path; the ranked-below-name-matches ordering is structural in the proxy merge — tag-only hits are appended after Meili's hits — but not explicitly asserted with mixed-source data) |

- [x] Every acceptance criterion has at least one passing test.
- [x] No criterion silently dropped.
- [x] No bonus behavior outside the story (CLAUDE.md docs + Playwright/Redis infra are scoped to separate chore-style commits).

## ADR adherence

- [x] Firmware files at the location the ADR specifies (`firmware/versions/v1.0.0/concepts/`), including the in-place amendment that moved them from `versions-grapevine/`.
- [x] Server API namespace and routes match (`/api/profile-tags/*`).
- [x] UI hook + section + dialogs match the layering sketched in the ADR.
- [x] Wire shape matches Option A (kind 39999, `d` / `p` / `e` / `z` / `polarity` / `json` event-tags; polarity as event-tag, not schema field).
- [x] Polarity defaulting (1) and bucketing (`>= 0.5` / `<= -0.5`) match ADR's read-side rules.
- [x] No new dependencies the ADR didn't authorize (`@playwright/test` added but as devDep, scoped to the chore commit explicitly framed as infra adjacent to existing test:playwright usage).

**ADR over-specification noted (non-blocking):**
- ADR §"Server API" line says `applicableTo` is returned in `available-tags`. Implementation drops the field (consistent with the in-place ADR amendment up top). ADR `Implementation notes` text not updated to match the amendment. Doc drift only.
- ADR line says `tags-for-profile` queries "local strfry plus default external relays" via SimplePool. Implementation queries local strfry only — strfry router brings external relay events into local strfry, so the external SimplePool call is redundant. Simpler. Acceptable divergence.
- ADR mentions `runCypher` / `SimplePool` / `importAddressableToNeo4j` as scaffolding. None used. Implementation took simpler paths via direct strfry scan + Meili HTTP. Acceptable.

## Concept-graph integrity

- [x] Handles in `kind:pubkey:slug` form (e.g. `39998:82b75e47…:nostr-user-tag`).
- [x] Firmware reinstall performed (`POST /api/firmware/install`) after concept changes; graph now reflects new concepts (verified via the concept-graph tests).
- [x] New code orients via strfry filters (`#z`, `#p`, `#e`) and the concept handles — does not read BIBLE.md or firmware JSON.
- [x] No `/api/concept-graph/subgraph` depth > 1 usage.

## Things tests can't catch

- [x] No secrets in committed files. `TA_PUBKEY` is a hex public key constant, not sensitive.
- [x] No leftover `console.log` in production paths. `console.error` is used in the proxy tag-match catch — informational only.
- [x] No commented-out code.
- [x] Error paths handled at boundaries: 400 on bad pubkey, 500 on internal errors. Tag-match proxy failure degrades to "name match only" rather than blowing up search.
- [x] Concurrency: replaceable-event dedupe is defensive (`dedupeReplaceable`), `cancelled` flag in `useProfileTags` prevents state-after-unmount writes.
- [x] Security: input validation at boundaries (`isHexPubkey`), `q` parameter never enters a shell command (only used for in-memory substring match), `strfryScan` filter built from validated server-side inputs only.

## House rules check

- [x] Concept Graph API authority respected (firmware install ran; concepts visible in `/summaries`).
- [x] No new lint/typecheck/build tooling. (`@playwright/test` is a devDep formalizing an existing repo pattern — was previously assumed-present by `test:playwright` script and the existing spec files.)
- [x] Per-phase commit hygiene: story commit, ADR commit, failing-tests commit, two implementation commits (WIP + UX iteration + search), each well-scoped.

## Findings

### Blocking
None.

### Non-blocking — documentation drift (clean up before merge if you care, no quality-gate impact)

1. **Story file `engineering-team/stories/done/1-tag-user-profiles.md:19`** — AC-1 still reads "a `Tag` action button is visible alongside `Follow`, `Mute`, and `Report`." The user-approved UX iteration removed that button in favor of an inline `TAGS` section. The intent is preserved (a discoverable tag affordance on the profile) but the wording is now stale. Suggest a one-line edit to match the new UX.

2. **Story file `:20`** — AC-2 references "click `Tag` on a profile, when the tagging interface opens"; the actual flow is "click the `+` chip in the inline TAGS row → AddTagDialog opens." Same drift as AC-1.

3. **Test plan `engineering-team/stories/done/1-tag-user-profiles.test-plan.md:13–22`** — coverage table references Playwright test names that no longer exist (e.g. `profile page exposes a Tag action button alongside Follow / Mute / Report`, `tag panel exposes inline new-tag creation`). The Playwright spec was rewritten in commit `2de8be9c`; the plan wasn't updated. Replace the test names with the current ones.

4. **Test plan** — no row for the new search-integration AC (AC-11). Add one referencing the test `typeahead search returns a profile tagged by a third-party author, with _matchedTags on the hit`.

5. **ADR `engineering-team/decisions/0001-profile-tag-architecture.md:164`** — implementation notes still say `available-tags` returns `applicableTo`. Either update to match the dropped field, or note the drop inline at this bullet (it's already noted in the `Consequences > Follow-ups / debt` section).

### Non-blocking — code observations

6. **`src/api/profile-tags/index.js:225–230`** — JSDoc for `meiliFetchProfilesByPubkey` claims it uses `POST /indexes/profiles/documents/fetch` with filter syntax, but the implementation uses per-key GETs. Doc lies. One-line correction.

7. **`src/api/profile-tags/index.js:259–269`** — orphaned doc block describing `GET /api/profile-tags/match` sits immediately above `computeTagMatches`'s own doc block. Two doc comments stacked with no function between them. Merge or move to `handleMatch`.

8. **`src/api/search/profiles/meili/index.js:18–22`** — `handleTagMatchInternal` is a one-line wrapper that just calls `computeTagMatches`. Indirection without value. Could call `computeTagMatches` directly at the call site. Cosmetic.

9. **`ui/src/hooks/useProfileTags.js:128`** — `const authorPk = await nip07Pubkey();` in `revoke()` is assigned but never used. The call is a precondition check (throws if NIP-07 missing); the assignment is dead. Drop the `const authorPk =`.

10. **`ui/src/hooks/useProfileTags.js:78–79`** — `publishEverywhere(signed)` is awaited but its result is discarded. If publishing fails on *every* relay (local + all external), the call returns `{ local: { success: false }, external: { successes: [], failures: [...] } }` without throwing. The hook then calls `refetch()` blindly and the user sees no error. The deleted `RelayTagPanel.jsx` precedent (visible via `git show 08743b7e^:...`) checked `result.local.success` and threw if both layers failed. Worth restoring a similar check; UX regression vs. precedent. Non-blocking because Story 1 doesn't have an AC for publish-failure feedback, but you'll trip over this the first time strfry is down.

## Verdict

**PASS**.

The implementation matches the user-approved intent end-to-end. Both quality gates are green. Concept-graph and security boundaries are clean. The findings above are documentation drift and code-hygiene observations, not spec or architecture violations. None of them prevent a merge.

If you want a tighter close-out before opening a PR: items 1–4 (story + test plan refresh) are the highest-value cleanup since they shape what the next contributor sees first when they read Story 1.
