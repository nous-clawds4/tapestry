# Review: Contextual-pins increment (stories 1–3, ADR 0001 + Amendment I)

**Date:** 2026-07-16
**Reviewer phase** · Branch `feat/tags`
**Scope:** batch commits `fe2ae5cf` (story), `29a0367a` (ADR), `e2a3264e` (tests), `6c0a9b2b` (story-1 core), `43dcb66e` (management UX + note-TL parity + freshness + fixes). Diffed `29a0367a..HEAD` on feat/tags (NOT against main — this is a feat/tags-local review; nothing here targets main).
**Stories:** `1-pin-a-tag-within-a-community-context`, `2-display-ta-signed-note-tl-in-pinned-tab`, `3-refresh-viewer-pins-on-event-tagging`
**ADR:** `engineering-team/decisions/contextual-pins/0001-context-scoped-pins.md` (incl. Amendment I)

## Verdict: **PASS**

All acceptance criteria across the three stories are met, the ADR contract — including both reviewer-reject-sensitive invariants — is honored, correctness is verified against the code, and the test suite is green. Findings below are non-blocking cleanups/notes.

## Reviewer-reject-sensitive invariants — both intact

1. **LEGACY / per-deployment-TA (CLAUDE.md, ADR 0015).** The base tag-pinning `z` is still composed from `TAG_PINNING_HANDLE` (= `LEGACY_TA_PUBKEY`); the context `z` uses `contextHandle(taPubkey, slug)` with the **runtime** TA (`ui/src/utils/publishTagPin.js` `pinTag`), guarded by `if (context && !taPubkey) throw`. The two ADR-0015 guard tests were relaxed **and strengthened** to assert the base-z-legacy composition directly and to forbid `taPubkey` on a neutral pin (`test/restore-historical-data-and-fix-tl-author-filter.test.js`) — approved amendment, recorded in ADR Consequences. `LEGACY_TA_PUBKEY` / `TAG_PINNING_HANDLE` unchanged.
2. **Set-based retraction.** `retractStaleTLs` (`src/api/trustedList/refreshPinnedTags.js`) is unchanged — still diffs on `new Set(currentDTags)` over full d-tags. No `(obs, author, slug)` collapse was introduced. `enumeratePinnedTags` dedupe key unchanged.

## Acceptance criteria — verified

- **Story 1:** contexts are firmware-seeded kind-39998 concepts (`lfo`, `tapestry-web-of-trust`; no event IDs in client code; verified live in the graph). `pinVariantKey` threaded through all five d-tag schemes (pin, profile TL, note TL, note bookmark, export resolver) — bare pins byte-identical (empty discriminator; existing pin suites green). Context recovered from the `z` stamp via `contextSlugOfPin`, disambiguated by known-slug match (never parses the d-tag). Coexistence + first-class parity delivered (plural `viewerPins`, per-pin TL/export/detail). Portable `contextPinsToTags` is pure (dedupe + injected trustFilter; no I/O).
- **Story 2:** `usePinnedNotes` reads the TA-signed kind-30393 (`authors=[taPubkey]`, `computeNoteTLDTag`), not the client kind-30003; retracted TLs treated as absent. Toggle gated on the note TL existing (pin covers notes), not on a client export. kind-30003 demoted to export artifact; stale issue-#336 comment retired.
- **Story 3:** `useEventTagging` fires a **debounced** (`1500ms`, per-viewer) `refresh-pinned-tags-for-viewer` on **both** apply and dispute — server-side, no NIP-07 prompt; the for-viewer vehicle fans out across all coexisting pins; no-ops when the viewer has no pins.
- **Note-cutoff fix (Amendment I §D-equivalent):** `curateNotes(notes, method, cutoff)` mirrors the profile rule (`apps >= cutoff && apps > disputes`), threaded through `runOneNotePin` (server) and `usePinnedNotes` (client drift). Default `0` preserves back-compat (regression suites green).
- **Bug fixes:** `refreshOnePinnedTagById` now recomputes **both** profile and note TLs (was profiles-only — the cause of the stuck "1 removed" drift). `/pins` groups by tag (one row per tag + context badges). Empty-note state distinguishes curation-empty ("No notes meet this pin's curation yet.") from relay-unreachable.

## Tests

- Batch suite `test/context-scoped-pins.test.js`: **32 pass** — pure SDK (`pinVariantKey`, `contextHandle`, `contextSlugOfPin` incl. legacy-vs-runtime disambiguation, `contextPinsToTags`, `KNOWN_CONTEXTS`, `curateNotes` cutoff) + source-contract markers for the client/server surfaces + the both-TL-refresh guard.
- Regressions green: `restore-historical-data…` (22), `generalized-tag-pinning` (12), `event-tagging-core` (15), `pin-a-tag` (7), `nip51-list-export-from-pins` (8), `profile-tags` (13), `tag-detail` (8).
- `tl-publication-from-pins` / `note-trusted-list` time out on live-stack ops — **verified they time out identically on the pre-batch base**, so not regressions.

## Findings (non-blocking)

1. **Dead code — `ui/src/pages/Pins.jsx:49` `renderStatusLine` and `:81` `renderExportStatusLine`** are now unused (the group-by-tag refactor removed their call sites). ~50 lines. **Recommend removal** before deploy.
2. **UX behavior change — confirm intended:** the `/pins` index no longer surfaces per-pin TL/export status lines; they were replaced by context badges. Per-pin status is now reachable only on the tag's Pinned tab. Reasonable (the index is a navigation list), but a deliberate loss of at-a-glance export status — flag for product confirmation.
3. **Scalability watch (documented in ADR §C — accept for v1):** Story 3 recomputes *all* of a viewer's pins on every event-tagging. Debounced, but O(pins) per tagging. Fine now; a future targeted "refresh pins of tag T" endpoint would bound it.
4. **Test posture:** management-UX behavior (picker modal, pin switcher, coexistence navigation, ordering) is covered by source-contract markers + pure `pins.js` unit tests + manual browser verification, not behavioral UI tests (repo has no jsdom/RTL). Consistent with the project's established posture; noted, not a blocker.

## Recommendation

PASS. Suggest a quick follow-up to remove the dead `render*` functions (finding 1) and a product nod on finding 2; neither blocks the increment. Ready for the deploy chain (`cycle-staging`).
