# Review — Story 15: Notes-tab View Options parity (+ operator refinements)

**Reviewer:** Reviewer (Phase 5)
**Date:** 2026-07-01
**Verdict:** ✅ **PASS** (after re-review — see "Re-review" at bottom; original verdict was CHANGES REQUESTED)
**Story:** `engineering-team/stories/event-tagging/15-notes-tab-view-options-parity.md`
**ADR:** `engineering-team/decisions/event-tagging/0013-notes-tab-view-options-parity.md`
**Book:** `engineering-team/audits/unified-tagging-ui/book.md`
**Base:** `e186bd94` (Story 14 committed). Story-15 work is uncommitted working tree.

## Scope reviewed
Server: `src/api/event-tags/index.js` (`handleForTag` sort). UI: `useNotesForTag.js`, `TagViewControls.jsx`, `TagNotesView.jsx`, `TagChip.jsx`, `NoteCard.jsx`, `NoteTags.jsx`, `Tag.jsx`, `styles.css`. Docs: ADR 0013, story, book.

## Acceptance criteria — code

| AC | Verdict | Notes |
|---|---|---|
| Same control, same place, same look | ✅ | Notes tab renders the shared `TagViewControls` (`TagNotesView.jsx:61`), not a bespoke control; bespoke `.bs-tag-notes-*` control + CSS retired. |
| Curated default vs expanded | ✅ | `TagNotesView.jsx` `shown`: collapsed = net-endorsed (`applications>disputes`) OR `mine`; expanded = all. Matches Story-8/Profiles intent (the `|| mine` is story-sanctioned note durability). |
| Full sort parity (recent/applied/disputed/divisive) | ✅ | Server-side via `for-tag?sort=` (`index.js:218,265–279`); ranked over the FULL set before `NOTES_CAP`, resolved page re-sorted to match. `most-backed` intentionally omitted (≈ applied for notes) per operator decision. |
| Text filter present, behaves like Profiles | ✅ | `noteMatchesFilter` on content + author name; filter-aware empty state. |
| Profiles tab unchanged | ✅ | `TagViewControls` new props all default to the prior Profiles behavior; `Tag.jsx:305` caller untouched (still shows "Tag someone", 3 sorts). |
| Refinement: Pinned-tab label → "Taggings" | ✅ | `Tag.jsx:249`. |
| Refinement: chip net/applied/disputed trio when expanded | ✅ | Opt-in `NoteCard.showTagScores → NoteTags.showScores → TagChip.showScores` (default off → 11 other NoteCard callers unaffected); popover still anchored to `.ptc` (no regression); net sized `0.98rem` > counts `0.72rem` mirroring Profiles. |

**Server sort logic is correct.** Ranking uses `countByTarget` (trusted counts, available pre-cap); mine-only notes → 0/0 → sink under metric sorts but stay visible via recency; `recent` default preserves prior ordering. Cache key includes `sort`; response echoes it.

## Quality gate — tests (the blocker)

Ran the tag/event/pin/note suite with changes vs. stashed baseline (HEAD = Story 14):
- **Baseline:** 7 failing files. **With Story 15:** 9 failing files → **2 newly-failing**, of which **1 is a real deterministic regression**, 1 is flaky.

### 🔴 F1 — BLOCKING (Story 15 regression): AC-5 UI static test broken
`test/tag-detail-curated-view-and-pin-polish.test.js` → *"AC-5 (UI): TagViewControls.jsx renders a text-filter input with a 'filter'-mentioning placeholder"* now FAILS.
- Cause: generalizing `TagViewControls` changed `placeholder="Filter this list…"` (inline literal) → `placeholder={filterPlaceholder}` (prop; the literal now lives in the default `filterPlaceholder = 'Filter this list…'`). The static regex `/<input[^>]*type="text"[^>]*placeholder="[^"]*[Ff]ilter[^"]*"/` (test line 168) no longer matches.
- **Runtime behavior is preserved** — Profiles still renders the same placeholder via the default prop. This is a stale/over-brittle static assertion, not a behavior break.
- **Ask:** update AC-5's assertion to accept the parameterized form (e.g. assert the input uses `placeholder={` **and** a default/passed value containing "Filter"). Legitimate refactor (ADR 0013 explicitly parameterizes this control) → the test moves with it.

### 🔴 F2 — BLOCKING for the book (Story 14 leftover, surfaced here): stale test for a deleted component
`test/profile-authored-notes-ui.test.js` asserts `AuthoredNotesSection.jsx` exists + is rendered in `BrainstormProfile` (lines 9, 23–33). Story 14's rework **deleted** that component and folded notes into `AuthoredTaggingSection`. This test was committed failing in `e186bd94` (present in the baseline too).
- **Ask:** retire or rework this test to the intermixed approach (assert `AuthoredTaggingSection` fetches `notes-by-author` + renders note rows via `NoteCard`), so the Story-14 rework has honest green coverage before the book ships. Tracked here because it belongs to this book and cannot be left broken at close.

### Not my regressions (context, non-blocking for Story 15)
- **Flaky:** *"overwriting the same d-tag with flipped polarity…"* fails only in the big batch; `event-tagging-write-path.test.js` **passes in isolation** (shared-strfry test-ordering artifact).
- **Pre-existing baseline failures (6, unrelated to this book):** community-reference scope-guard (×2), pin `cutoff=1` TL, `pinnedCount`/`most-pinned`/union-widening/`viewerPinned`/kind-5-deletion, TL-membership/TL-tag-set/TL-content. All in pins/TL/community-reference surfaces untouched by Story 15. Flag for the pins epic; out of scope here.

### Passing (relevant)
`event-tagging-for-tag.test.js` (15) + `event-tagging-read-api.test.js` (11) **green** — the `for-tag` sort change did not regress the endpoint contract. `pin-detail-into-tag-pinned-tab.test.js` AC-18 (Tag.jsx still wires TagViewControls) green.

## Verdict

**CHANGES REQUESTED.** The implementation meets every Story-15 acceptance criterion and both operator refinements; the block is test maintenance:
1. **F1** — update the AC-5 static test to the parameterized `TagViewControls` (Story 15).
2. **F2** — retire/rework `profile-authored-notes-ui.test.js` for the Story-14 intermixed section.

No source-behavior changes required. Re-run the tag/event suite to green (modulo the documented pre-existing/flaky failures), then this is a PASS.

## Re-review (2026-07-01) — ✅ PASS

Both asks addressed (Implementer kickback, test-only — no source-behavior change):

- **F1 fixed** — `test/tag-detail-curated-view-and-pin-polish.test.js` AC-5 now accepts the parameterized placeholder (inline literal **or** `{filterPlaceholder}`) and separately asserts the default copy still mentions "filter". **PASS.**
- **F2 fixed** — `test/profile-authored-notes-ui.test.js` reworked to the intermixed contract: asserts `AuthoredTaggingSection` folds notes in via `useNotesByAuthor` + `NoteCard` + `taggedWith`, and that the separate `AuthoredNotesSection` is deleted/un-referenced. 4/4 **PASS.**

Verification (isolation, deterministic):
- Green: `event-tagging-for-tag` (15), `event-tagging-read-api` (11), `tag-detail-curated-view-and-pin-polish`, `profile-authored-notes-ui` (4), `event-tag-note-affordance-ui`, `event-tagging-notes-by-author`, `pin-detail-into-tag-pinned-tab`.
- The remaining batch-only failures are **not regressions**: `most-pinned-tag-index`, `unified-tags-directory`, `tl-publication-from-pins` each **pass in isolation** (shared-strfry test-ordering flakiness); the community-reference failures are pre-existing/known (project memory) on surfaces this book does not touch.

Implementation (already `/cycle-local`-verified and deployed) unchanged. **Story 15 PASS** — ready to commit and proceed to Story 16.
