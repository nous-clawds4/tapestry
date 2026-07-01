# Story 14: Profile "Tagging Activity" — notes tagged (UI)

**Status:** Approved · **Created:** 2026-06-30 · **Type:** Feature · **Epic:** event-tagging · **Book:** unified-tagging-ui

## Background
A profile's "Tagging Activity" (`AuthoredTaggingSection`) shows only the **profiles** that person tagged. Story 11 built the read (`/api/event-tags/notes-by-author`); this story surfaces it on the profile: the **notes** the person has tagged, alongside the existing profile-tagging section. Additive — the existing section is untouched (no regression); a new section is added.

## User-facing description
As a viewer on someone's profile, I want to see the **notes** they've tagged (with the tags they applied), not just the profiles — the full picture of how this person tags.

## Acceptance criteria
- [ ] **Notes they tagged appear.** Given a person who has tagged notes, their profile shows those notes (rendered as note cards) with the tag(s) they applied.
- [ ] **Profile-tagging section unchanged.** The existing "Tagging Activity" (profiles) renders exactly as before (backward compatible).
- [ ] **Own view.** Consistent with the epic's `mine`/POV model (the endpoint already handles it).
- [ ] **Empty state.** A person who has tagged no notes shows a clear empty/absent state, not an error.

## Concepts touched
- `39998:<TA>:nostr-event-tag`, `39998:<TA>:nostr-event` — the taggings + note targets.

## Out of scope
- The endpoint — Story 11 (consumed). The profiles-side section / migrating authored-by — unchanged.
- Note-pin affordance — Story 12.

## Linked artifacts
- ADR: `engineering-team/decisions/event-tagging/0010-profile-tagging-activity-spans-notes.md` (endpoint; this story is its UI). Book: `engineering-team/audits/unified-tagging-ui/book.md`.
- Test: `test/profile-authored-notes-ui.test.js` (source-contract; render manual). Review: (later).
