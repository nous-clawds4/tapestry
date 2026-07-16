# Review: Story 9 — Unified tag index (notes + profiles)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-30
**Diff:** `git diff ea99e861..67d81a8c` (impl `67d81a8c`, tests `ea99e861`)
**Story:** `engineering-team/stories/event-tagging/9-unified-tag-index-notes-and-profiles.md`
**ADR:** `engineering-team/decisions/event-tagging/0009-unified-taggings-normalization.md`

**Scope note:** this reviews the **server/core** (the tested, shippable unit). The `Tags.jsx` UI wiring is **held** for the coherent unified-UI pass (design rollout decision) — out of scope here, by design.

## Quality gates (run by reviewer)

- [x] `node test/unified-tag-index.test.js` — **14 passed, 0 failed** (core normalization/index + registry + source-contract + live HTTP smoke).
- [x] `node test/event-tagging-core.test.js` — **15 passed, 0 failed**, incl. the purity guard scanning the new `taggings.js` → pure/dependency-free.
- [x] No regression across the touched/adjacent suites (for-tag 15, viewer-stance 12, read-api 11, core 15, note-affordance 15, tag-detail 8).
- [x] Live end-to-end: `GET /api/tags/index?q=drivechain` returns the note-only tag `drivechain` with `byType.event` + `mine` — the exact gap the story targets.
- [ ] _Lint/typecheck — not configured._

## Spec adherence (ACs → tests, all green)

- [x] **A note-only tag appears** (AC-1) — `index AC-1` + live `drivechain`.
- [x] **A shared tag merges into one row reflecting both** (AC-2) — `index AC-2` (`byType.profile` + `byType.event`).
- [x] **Counts POV-filtered for notes too** (AC-3) — `index AC-3`.
- [x] **Sorting accounts for note usage** (AC-4) — `index AC-4` (combined `applications` drives order).
- [x] **Profile-only tags unchanged** (AC-5), **no phantom rows** — `index AC-5` + the `filter` in `indexByTag`.
- [x] **Note usage discernible** (AC-legibility) — `byType` breakdown per row.
- [x] **`mine`** — the viewer's own note-tagging surfaces on the tag even off-POV.

## ADR-0009 adherence

- [x] **Read-time normalization core + registry** (`src/lib/event-tagging/taggings.js`): `taggingMembers` (nostr-user-tag + nostr-event-tag), `normalizeTaggings`, `indexByTag` — the exact seam ADR 0009 specified.
- [x] **No protocol/wire/write change** — the core only *reads* existing assertions; no builder/signer/publish touched; no fixture publishes.
- [x] **SDK-inherited** — the normalizer/registry/aggregator are in the dependency-free core (purity guard passes).
- [x] **Opinionated local aggregation** — no new published format; nothing constrains other publishers.
- [x] **Coordinate-keyed identity** (`authorPubkey:slug`) — the merge key, as ratified.
- [x] **Extensibility proven** — a third registry member (`nostr-thing-tag`) normalizes + counts with no core change (`extensibility` test).
- [x] **Phase 1 — live endpoints untouched**: the diff adds `handleTagIndex` + the `/api/tags/index` route + the core; it changes **no** existing read handler (`handleForEvent`/`handleForTag`/`handleHeadersForTag` and all `/api/profile-tags/*` are byte-unchanged). Verified in the diff.
- [x] **Firmware reinstall?** No.

## Things tests can't catch

- [x] No secrets, no debug logging, no commented-out code; no hardcoded pubkeys in the pure core (authorities come from `resolveAuthorities` at the handler boundary).
- [x] The unified scan correctly picks up both families: profile-taggings carry `39998:<canonical>:nostr-user-tag` and the canonical authority is in the honored set, so both members' concept-`z`s are scanned (confirmed live).
- [x] Purity: the pure core has no I/O; the handler's I/O (strfry scan, Meili POV) lives at the boundary, injected/reused from the existing event-tags helpers.

## Findings

### Blocking
_None._

### Non-blocking
1. **`handleTagIndex` scan is unbounded** — it scans all member concept-`z` assertions (like the existing profile index). ADR 0009 already flags bounding as a consequence; rows are paginated but the scan isn't. Fine for parity; a scan cap/streaming is the logged perf follow-up.
2. **No response cache + an extra tag-elements scan per request** (for name enrichment). The directory could reuse a short-TTL cache like `for-tag`. Non-blocking; a perf follow-up for the unified-UI pass.
3. **Curation depth** — the index returns raw apply/dispute + `byType`; richer curation/sort modes (endorsed/divisive/most-pinned) aren't in the unified endpoint yet. That's deliberately part of the held UI-wiring decision (pins/sort), not a defect here.

## Verdict

**PASS**

The server/core is a faithful, minimal realization of ADR 0009: a pure normalization core + registry + `indexByTag`, plus a thin additive `/api/tags/index` handler — proving the unified tag universe end-to-end (a note-only tag now appears; shared tags merge; POV + `mine` hold; a future member drops in). No existing endpoint or wire/write path is touched. The `Tags.jsx` wiring is correctly deferred to the coherent unified-UI pass. Non-blocking items are perf follow-ups already anticipated by the ADR.
