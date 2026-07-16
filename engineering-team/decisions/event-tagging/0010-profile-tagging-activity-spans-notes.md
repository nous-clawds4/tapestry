# ADR 0010: Profile tagging-activity spans notes — author's note-taggings read

**Status:** Accepted
**Date:** 2026-06-30
**Story:** `engineering-team/stories/event-tagging/11-profile-tagging-activity-spans-notes.md`
**Builds on:** ADR 0009 (unified taggings normalization). Model is settled there; this pins the Story-11 specifics.

## Context

A profile's "Tagging Activity" (`AuthoredTaggingSection` → `/api/profile-tags/authored-by`, scan `{kinds:[39999], '#z':[nostr-user-tag], authors:[X]}`) shows only the **profiles** X has tagged. Story 11 adds the **notes** X has tagged, as an **asserter-filtered view over the normalized stream** (ADR 0009). Phase 1: the live `authored-by` stays untouched; we add a new read.

## Decision

A new read `GET /api/event-tags/notes-by-author?authorPubkey=<hex>[&viewerPubkey=][&authorities=][&wotPov=&userPubkey=]` and a thin pure-core convenience `taggingsByAsserter(taggings, asserterPubkey)` (the ADR-0009 asserter view).

- **Core:** `taggingsByAsserter(taggings, asserter)` → the taggings authored by that pubkey (a documented view over `normalizeTaggings`). Pure.
- **Server (`handleNotesByAuthor` in event-tags):** scan `{ kinds:[39999], authors:[authorPubkey], '#z':[…event-tag member concept-z under honored authorities…] }`; resolve headers; `normalizeTaggings` → `taggingsByAsserter` (defensive) → keep the `event`-target taggings; group by target note; fetch + `enrichNotes` the notes (reuse the for-tag local-first + relay path + the `NOTES_CAP` bound + cache); return `{ notes:[ enriched + { taggedWith:[{tag,slug,name,stance}] } ], total, truncated, limit }`, most-recently-tagged first.
- The profiles side is already served by the live `authored-by` (unchanged); the UI later shows both (unified-UI pass). No wire/write change; read-only.

## Consequences

- Enables the note half of a person's tagging activity; a future target type joins via its registry member.
- Reuses the Story-8/for-tag enrichment (bounded + cached) — same relay-fetch caveats (external note bodies), same `NOTES_CAP`.
- Live `authored-by` and all other endpoints untouched (Phase 1). Firmware reinstall? No.

## Out of scope

- The `AuthoredTaggingSection` UI wiring — the unified-UI pass (held).
- Migrating `authored-by` onto the normalizer — deferred Phase-2 cleanup.
- Peer-counts / sort parity with the rich profile `authored-by` — v1 shows the author's note-taggings; richer parity is a follow-up.
