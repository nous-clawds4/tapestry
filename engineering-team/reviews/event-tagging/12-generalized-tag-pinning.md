# Review — Story 12: Generalized (target-typed) tag pinning

**Reviewer:** Reviewer (Phase 5)
**Date:** 2026-07-01
**Verdict:** ✅ **PASS** (with non-blocking observations; one tracked deferral being folded in next)
**Story:** `engineering-team/stories/event-tagging/12-generalized-tag-pinning.md`
**ADR:** `engineering-team/decisions/event-tagging/0015-generalized-target-typed-pinning.md`
**Test plan:** `engineering-team/stories/event-tagging/12-generalized-tag-pinning.test-plan.md`
**Diff:** working tree — `src/lib/event-tagging/taggings.js`, `ui/src/utils/publishTagPin.js`, `ui/src/pages/Tag.jsx`, `ui/src/components/CurationMethodDialog.jsx`.

## Acceptance criteria

| AC | Verdict | Evidence |
|---|---|---|
| **Pin a note-tag → a note list** (kind-30003 `e`, under viewer key) | ✅ | `publishNoteBookmarkSetForPin` (`publishTagPin.js:328`) builds kind-30003 with `e` elements; **live-verified** — pinning `networking` landed `notes-pin-791dde3e-791dde3e-networking` with 1 `e`. |
| **Right list type per target** (note→note-list; profile→people-list unchanged) | ✅ | Element tag is registry-driven via `projectionFor` (`taggings.js`); orchestration (`Tag.jsx:148–166`) runs the profile kind-30000 path AND the note kind-30003 path per selected type. |
| **Curated snapshot** (POV-filtered at pin time) | ✅ | `curateNotes(for-tag notes, method)` — point-in-time, POV=viewer via the `for-tag` viewerPubkey. |
| **Profile pinning unchanged** | ✅ | Profile export path intact (now gated on `targetTypes.includes('profile')`, default includes it); `refresh-pinned-tag` await preserved. **Pin regression suite green** (`pin-a-tag`, `customize-pin-curation-publish`, `nip51-list-export-from-pins`). |
| **Extensible** (projection driven by the family member) | ✅ | Per-member `projections`; `projectionFor` scans them → a new member gets pinning by declaring one. Covered by the "registry-driven" functional test. |

## ADR conformance

Matches ADR 0015 on all four operator decisions: registry multi-projection (`projections` + `projectionFor`), export-time target-type selection (dialog checkboxes → `targetTypes`), two note-curation options (`curateNotes`), and export-only depth (client kind-30003 from `for-tag`, no TA-signed note-TL). The `d`-tag is target-type-qualified (`notes-pin-…` vs `tl-pin-…`) and the empty-guard mirrors the follow-set guard — both per the ADR's "Open (Test Design)" notes.

## Tests

Functional core **12/12 green** (`generalized-tag-pinning.test.js`): `projectionFor` (profile/event/address/unknown + registry-driven) and `curateNotes` (net-endorsed / most-applied / default / purity). Source-contract markers (target-type-aware export, note default, target-type selection) satisfied. Pin regression + `event-tagging-core` green → backward-compat holds.

## Non-blocking observations

1. **most-applied over a recency-capped set.** `publishNoteBookmarkSetForPin` fetches `for-tag` without a `sort`, so it gets the 50 most-recently-tagged notes (`NOTES_CAP`) and then `curateNotes` re-ranks. For `notes:most-applied` on a tag with >50 notes, the top-applied older notes can be missed. This is the documented `NOTES_CAP` v1 limitation (ADR: lifted by the deferred TA-TL, #336). *Cheap improvement:* pass `sort=applied` when `noteMethod==='notes:most-applied'` so the capped 50 aligns with the curation. Not required for v1.
2. **`refresh-pinned-tag` is not gated by `targetTypes`.** The TA-signed kind-30392 profile TL is always refreshed (instance-maintained), even for a "notes only" selection — only the *user-signed* exports honor the checkboxes. Semantically defensible (TL = instance curation; exports = user choice), but worth a one-line note if "notes only" is meant to fully suppress the profile TL later.
3. **`.pcd-note-method` has no CSS** (`styles.css`) — the note-curation select renders unstyled (functional, minor visual).
4. **Dialog intro copy is profile-only** (`CurationMethodDialog.jsx:195` — "listing the profiles that the tag applies to") — now stale since notes are supported; update the copy to mention both list types.
5. **No automated test for the note-list *build*/orchestration** — the d-tag/z/`e`-element/empty-guard and the Tag.jsx wiring are manual-verified (per the test plan's stated strategy); I confirmed the kind-30003 landed correctly in local strfry. Acceptable; a source-contract or (better) a pure `buildNoteBookmarkUnsigned` unit would harden it.

## Tracked deferral (not a blocker for this review)

- **Pinned-tab note display.** The story's manual-verification mentions the Pinned tab reflecting the note list; that in-app rendering is **not** implemented — it's tied to the TA-signed note-TL follow-up (**issue #336**) and is being **folded in next as item #3** before ship. The *published* kind-30003 is correct and discoverable in external clients today. Because every testable-from-outside AC (what list is produced) is met, this does not block PASS — but Story 12 should not be considered visibly complete until #3 lands.

## Verdict

**PASS.** All ACs met, ADR-conformant, functional tests green, profile pinning unregressed, and the note-pin path live-verified end-to-end. The five observations are minor/non-blocking; the Pinned-tab display is explicitly the next item. Recommend addressing #3 (Pinned-tab note view) + #4 (signer-guard rollout) before pushing this branch's env.
