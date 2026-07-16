# Review: Story 11 — Profile tagging-activity spans notes (server/core)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-30
**Diff:** impl `eae1285f`, tests/ADR `e0e6cd2d`
**Story/ADR:** `stories/event-tagging/11-…` / `decisions/event-tagging/0010-…` (+ 0009 model)

**Scope:** server/core (the `AuthoredTaggingSection` UI wiring is held for the unified-UI pass).

## Gates (run by reviewer)
- [x] `event-tagging-notes-by-author` — **4 passed, 0 failed** (core `taggingsByAsserter` + source-contract + live HTTP smoke).
- [x] `event-tagging-core` — **15/0** (purity scans the extended `taggings.js`, still pure).
- [x] No regression: unified-tag-index 14/0, for-tag 15/0, read-api 11/0, core 15/0.
- [x] Live end-to-end: `notes-by-author?authorPubkey=791dde3e…` returns the 2 notes that author tagged, each with its tags (`bird`+`networking`, `drivechain`).

## Spec / ADR adherence
- [x] **Author's note-taggings shown** (AC-1): `handleNotesByAuthor` scans `{kinds:[39999], authors:[X], '#z':[event-tag member z]}`, normalizes, keeps `event` targets, groups by note, enriches.
- [x] **Asserter-filtered view over the normalized stream** (ADR 0010/0009): pure `taggingsByAsserter`; the handler consumes `normalizeTaggings` + it.
- [x] **Distinguishable / POV** — each note carries `taggedWith:[{authorPubkey,slug,stance}]`; POV predicate available via the shared helpers; `mine` principle inherited from the normalizer.
- [x] **Profiles side unchanged** (AC-2 / Phase 1): live `/api/profile-tags/authored-by` byte-untouched; this is a new additive endpoint.
- [x] Reuses the for-tag note-read (local-first + relay + `NOTES_CAP` bound). No wire/write change; read-only. No firmware change.

## Things tests can't catch
- [x] No secrets/debug/commented-out code; pure core has no I/O; I/O (scan/relay/enrich) at the handler boundary via the existing shared helpers.
- [x] Correct family scan: uses `conceptNostrEventTag` under honored authorities → only the note member's assertions.

## Findings
### Blocking — none.
### Non-blocking
1. Same relay-fetch caveats as for-tag (external note bodies; `NOTES_CAP`; no dedicated cache here). Fine for v1; a per-author cache is a perf follow-up.
2. v1 shows the author's note-taggings without the rich peer-counts/sort parity of the profile `authored-by`; richer parity is the logged follow-up (out of scope, ADR 0010).

## Verdict
**PASS** — a thin, faithful asserter view over the unified stream + an additive endpoint, live-verified; nothing existing touched; UI held for the coherent pass.
