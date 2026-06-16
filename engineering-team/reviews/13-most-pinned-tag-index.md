# Review: Story 13 — "Most pinned" sort, per-row counts, and own-pin indicator on the tag index

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-20
**Diff:** `git diff HEAD~1` (commit `cbc2b8f0`)
**Story:** `engineering-team/stories/done/13-most-pinned-tag-index.md`
**ADR:** `engineering-team/decisions/0012-most-pinned-tag-index.md`
**Test plan:** `engineering-team/stories/done/13-most-pinned-tag-index.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (overall). Story-13 suites:
  `most-pinned-tag-index`: **8/8 passed**;
  `most-pinned-tag-index-publish`: **7/7 passed, 1 skipped** (POV-required
  AC; settings.json not writable from this process).
  All 17 other suites stay green.
- [ ] `npm run test:playwright` — not executed on this NixOS-style host
  (Playwright bundled chromium needs Linux .so deps unavailable here).
  `tests/brainstorm/most-pinned-tag-index.spec.js` parses correctly and
  lists 7 tests under `npx playwright test --list`. Same disposition as
  Stories 10–12.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] UI build clean (`npm --prefix ui run build`) — one expected
  chunk-size warning, no errors.

## Spec adherence

- [x] **AC-1** (per-row pin-count badge) — server: every row gets
  `pinnedCount` (default 0) via `enriched` builder at
  `src/api/profile-tags/index.js:923–944`. UI: `<span class="bs-tagindex-count-pinned">📌{row.pinnedCount}</span>`
  at `ui/src/pages/Tags.jsx:151–153`, rendered unconditionally so
  zero-pinned rows still show "📌0". Contract test
  `every row in the response carries pinnedCount` passes; publish-flow
  test `AC-1: published pins increment pinnedCount on the tag rows`
  passes.
- [x] **AC-2** (sort by `most-pinned` desc, ties on tagEventId asc) —
  `TAG_INDEX_SORTERS['most-pinned']` at
  `src/api/profile-tags/index.js:805–808` matches the spec exactly.
  Publish-flow test `AC-2: sort=most-pinned orders rows by
  pinnedCount desc; ties on tagEventId asc` passes.
- [x] **AC-3** (sort toggle exposes `most-pinned`) — added to
  `TAG_INDEX_VALID_SORTS` at line 792 and `SORT_LABELS` at
  `ui/src/pages/Tags.jsx:24–29`. Contract test `sort=most-pinned
  returns 200 and echoes sort='most-pinned'` passes.
- [x] **AC-4** (POV change refetches) — already handled by the
  existing `useTagIndex` effect deps including `user?.pubkey`;
  switching POV invalidates the fetch. The hook also now reacts to
  `pinnedByMe` and `mineOnly` (lines 100–101). No new code needed.
- [x] **AC-5** (own-pin indicator on viewer's tags) — server:
  `viewerPinned` field on every row at `src/api/profile-tags/index.js:944`
  via `viewerPinnedSet.has(tagEventId)` from `aggregateTagPins`. UI:
  `<span class="bs-tagindex-own-pin" title="You have pinned this tag" aria-label="you pinned this tag">📌</span>`
  at `ui/src/pages/Tags.jsx:140–146`, rendered only when both `user`
  AND `row.viewerPinned`. Publish-flow test `AC-5: viewer's own pin
  sets viewerPinned=true on that tag's row (and on no others)` passes.
- [x] **AC-6** (filter toggle + refetch) — UI toggle at
  `ui/src/pages/Tags.jsx:85–94` (logged-in only); hook state +
  param threading at `ui/src/hooks/useTagIndex.js:21, 45–48, 79–82`;
  server-side filter at `src/api/profile-tags/index.js:967–969`.
  Publish-flow test `AC-6: pinnedByMe=true narrows rows to the
  viewer's pinned set; total reflects the filter` passes. AC-6
  second clause (indicator stays visible when filter on) is honored
  by the unconditional render at lines 140–146 (no filter check).
- [x] **AC-7** (logged-out parity) — UI: filter toggle is gated on
  `user` at line 85; own-pin indicator is gated on `user &&
  row.viewerPinned` at line 141. Pin-count badge and `most-pinned`
  sort option render unconditionally (POV-scoped, not viewer-scoped).
  Server: `viewerPubkey` and `pinnedByMe` query params silently
  treated as absent when invalid/missing (lines 851–855); rows still
  carry `pinnedCount`. Contract test `no viewerPubkey passed: rows
  still carry pinnedCount; viewerPinned is false everywhere` passes.
- [x] **AC-8** (kind-5 deletion excluded) — `dedupeReplaceable` at
  `src/api/profile-tags/index.js:81–85` is what the existing assertion
  pipeline already uses; strfry's index honors kind-5 deletions so
  the deleted events don't appear in the scan. `aggregateTagPins`
  inherits this behavior automatically. Publish-flow test
  `AC-8: kind-5 deletion of a pin event removes it from pinnedCount`
  passes.
- [x] **AC-9** (replaceable dedupe — same author counted as 1) —
  `dedupeReplaceable` collapses pin events by `(author, d-tag)`. A
  single author's two pin events for the same tag share the same
  `d`-tag (`tag-pin-<slug>-<tagAuthor8>-<viewer8>`) → one survivor →
  count = 1. Publish-flow test `AC-9: same author publishing two
  pins for the same tag is counted as 1 (replaceable dedupe)`
  passes.
- [x] **AC-10** (server-side pagination correctness) — the
  `pinnedByMe` filter applies BEFORE the sort and slice at
  `src/api/profile-tags/index.js:967–971`; `total` reflects the
  filtered count, NOT the unfiltered count. Publish-flow test
  asserts both.
- [x] **Union widening** (tags with pins-but-no-assertions appear) —
  union step at `src/api/profile-tags/index.js:903–910` merges
  `pinCountByTagEventId.keys()` into `byTag`. Publish-flow test
  `Union widening: tagB (pins-but-no-assertions) appears in the
  listing` passes.

## ADR adherence

- [x] **Option A implemented exactly** — extend `handleTagIndex`
  additively; new helper `aggregateTagPins`; union the tag set
  across assertions + pins; new sort + filter + per-row fields;
  no new endpoint.
- [x] **`aggregateTagPins` shape** — matches ADR §Option-A pseudo-code
  (`src/api/profile-tags/index.js:524–579`). Returns
  `{ pinCountByTagEventId, viewerPinnedSet }`. WoT-author filter
  mirrors `aggregateProfilesTagged`. The viewer's own-pin tracking
  runs BEFORE the WoT filter so it's per-viewer, not per-POV.
- [x] **Sort comparator** — matches ADR's documented form
  (`pinnedCount desc, then tagEventId asc`). Defensive `|| 0`
  coalesce on `pinnedCount` per ADR.
- [x] **Query param shape** — `viewerPubkey` (64-char hex, silently
  ignored if malformed); `pinnedByMe='true'` (only honored when
  `viewerPubkey` is valid). Matches the existing `authoredBy`
  pattern (validate-or-ignore).
- [x] **No new endpoint** — extension lives on `/api/profile-tags/index`.
  No new routes registered.
- [x] **Helper exported** — `aggregateTagPins` is in the module's
  `module.exports` so future surfaces can reuse it (e.g., a future
  Story-14 tag-detail pin-count or a "most-pinned" sidebar).
- [x] **No firmware reinstall** — confirmed; no concept-graph
  changes.

## Concept-graph integrity

- [x] **No new concepts** — pure read-side aggregation; same handles
  as Stories 1, 4, 10.
- [x] **Handles in `kind:pubkey:slug` form** — `TAG_PINNING_Z_TAG`
  reused from the existing module-level constant. (Note: that
  constant currently hardcodes the dev TA pubkey per CLAUDE.md's
  "Known violations" list. Story 16 will fix it everywhere — Story
  13 deliberately doesn't touch it to avoid the same partial-fix
  trap that produced the d3a2640a incident.)
- [x] **No BIBLE.md / firmware JSON reads** — only existing helpers
  (`aggregateProfilesTagged`, `meiliFetchProfilesByPubkey`,
  `parsePinTagEventId`).

## Things tests can't catch

- [x] **No secrets in committed files** — diff inspected.
- [x] **No leftover `console.log`** — every new line is functional
  code or structured response data.
- [x] **No commented-out code** in the diff.
- [x] **Error paths handled** — `aggregateTagPins` is wrapped by the
  existing try/catch in `handleTagIndex`; a strfry-scan failure
  cleanly produces a 500 with `{success: false, error}`. The
  client's `useTagIndex` hook also catches fetch errors at
  `ui/src/hooks/useTagIndex.js:97`.
- [x] **Concurrency / race conditions** — `useTagIndex` already
  uses the `liveSeqRef` last-write-wins guard from Story 4; the new
  `pinnedByMe` state participates in the existing dep array, so
  stale completions can't stomp.
- [x] **Security: input validation at boundaries** — `viewerPubkey`
  regex-validated (line 852); `pinnedByMe` accepted only as the
  literal string `'true'` (line 855). Both follow the existing
  authoredBy convention.
- [x] **Backward-compatible response shape** — every existing field
  is preserved; only additive new fields (`pinnedCount`,
  `viewerPinned` on rows; `viewerPubkey`, `pinnedByMe` on envelope).
  Story-4 tests pass unchanged; Story-3/4/9 read-paths unaffected.

## House rules check

- [x] **Concept Graph API authority** — respected (no BIBLE.md /
  firmware-JSON reads).
- [x] **No new lint/typecheck/build tooling** — diff adds none.
- [x] **Firmware reinstall** — N/A; no concept definitions changed.
- [x] **Per-deployment TA pubkey invariant** — Story 13 deliberately
  does NOT touch the hardcoded `TA_PUBKEY` constant in
  `src/api/profile-tags/index.js`. The Implementer correctly
  recognized that fixing it here would repeat the d3a2640a partial-fix
  incident. Story 16 owns the full migration.

## Findings

### Blocking

_None._

### Non-blocking

1. **`src/api/profile-tags/index.js:548–550`** —
   `aggregateTagPins`'s WoT-author filter block is a near-duplicate
   of the same block in `aggregateProfilesTagged` (lines 489–501). A
   small `applyWoTFilter({deduped, povSuffix, minRank})` helper
   would DRY both call sites. Not blocking — the duplication is small
   (10 lines) and very symmetric; future cleanup if a third call site
   needs the same pattern.

2. **`ui/src/pages/Tags.jsx:151–153`** — the pin-count badge always
   renders the 📌 glyph + numeric value, even when 0. AC-1 explicitly
   requires this ("Rows with zero WoT-trusted pinners show 0 — not
   hidden"). UX-wise, a sea of `📌0` badges may feel cluttered on a
   long index. Acceptable per the AC; could be a future polish
   ("dim 0-count badges"). Not blocking.

3. **POV-required test skips locally** —
   `most-pinned-tag-index-publish.test.js`'s WoT-scope test requires
   `/var/lib/brainstorm/settings.json` to be writable. Same skip
   path as Stories 11 + 12. CI will exercise it.

4. **Playwright suite (7 tests) parses but doesn't execute on this
   host** — same NixOS-style limitation as prior stories. Tests are
   well-formed and cover every UI AC; will run in CI / a standard
   Linux env.

5. **Two duplicated `aggregateTagPins` and `aggregateProfilesTagged`
   author-filter blocks both pull from
   `meiliFetchProfilesByPubkey`** — if both helpers ever run in the
   same request (which they do for every `/tags` index render), they
   call Meili twice for overlapping pubkey sets. At v1 scale
   (handfuls of pin authors), negligible; flag if profiled. The
   ADR's "Cons" section already noted this.

6. **`TA_PUBKEY` hardcode** at `src/api/profile-tags/index.js:27`
   remains in violation of the CLAUDE.md invariant. Out of scope
   here — Story 16 owns the migration. Documented in the CLAUDE.md
   "Known violations" list.

## Verdict

**PASS**

Every acceptance criterion has a verified implementation; ADR design
honored line-by-line; test gate green with 8/8 contract + 7/7
publish-flow + 0 regressions in 17 other suites. Six non-blocking
findings recorded, none of them block merging. The Implementer
correctly recognized the in-flight Story-16 migration constraint
and avoided touching the hardcoded `TA_PUBKEY` literal here —
preserving the matching-pair invariant until Story 16 ships the
proper cross-cutting fix.
