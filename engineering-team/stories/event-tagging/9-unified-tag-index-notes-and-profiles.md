# Story 9: Unified tag index — /tags counts notes, not just profiles

**Status:** Approved
**Created:** 2026-06-30
**Type:** Feature
**Epic:** event-tagging

## Background

The `/tags` directory page is the app's answer to "what tags exist and how are they used." Today it is **profiles-only**: it lists and ranks tags purely by how they've been applied to **profiles** (pubkey-tagging), and shows nothing about how they've been used on **notes** (event-tagging). The confusing result, found in Story-8 testing: a tag applied only to notes (e.g. `drivechain`) **never appears on `/tags` at all**, and a tag used on both shows only its profile counts — so `/tags` silently means "tags used on profiles," which reads as a bug.

Now that notes can be tagged (Stories 1–8), the tag directory should reflect the **whole** picture: a tag is a tag whether it's been applied to a person or a note. The tag-*element* is already shared between both features (same `tag` concept), so the two usages can be unified on that shared identity.

> **Build invariant (epic):** read-and-display only; no publishing. The event-tagging reads stay local-only per the epic.

## User-facing description

As someone browsing the tag directory, I want `/tags` to include tags used on **notes** as well as profiles — so that a tag applied only to notes still shows up, a tag used on both reflects both, and the directory stops silently meaning "profile tags only."

## Acceptance criteria

Testable from the outside (given published taggings + a POV, what `/tags` returns).

- [ ] **A note-only tag appears.** Given a tag that has been applied to one or more notes but to **no** profiles (within the POV's WoT), when I view `/tags`, then that tag appears in the index (today it is absent).
- [ ] **A shared tag reflects both.** Given a tag applied to both profiles and notes, when I view `/tags`, then its row reflects its **note** usage as well as its profile usage — the note-taggings are visible, not hidden.
- [ ] **Counts are POV-filtered for notes too.** The note-tagging counts obey the same point-of-view trust filtering as profile-tagging counts (only trusted asserters count), consistent with the rest of the epic.
- [ ] **Sorting accounts for note usage.** The directory's sort (e.g. most-used / most-endorsed) reflects combined usage, so a heavily-note-tagged tag ranks accordingly rather than being invisible.
- [ ] **Profile-only tags are unchanged.** A tag used only on profiles still appears with its profile counts exactly as before (backward compatible).
- [ ] **A tag with no taggings in the POV does not appear** (unchanged behavior; no empty/phantom rows).
- [ ] **The distinction is legible.** A viewer can tell, for a given tag, that it's used on notes (whether via a combined total with a breakdown, or separate profile/note figures — the exact presentation is a design choice, but note usage must be discernible, not silently folded away).

## Concepts touched

- `39998:<TA>:tag` — the shared tag-element (the unifying identity across both features).
- `39998:<TA>:nostr-user-tag` — profile-taggings (already counted today).
- `39998:<TA>:nostr-event-tag` — event-taggings (to be counted).
- `39998:<TA>:tagging-with-specific-tag` — the per-tag header that resolves an event-tagging to its tag.

> Handles use the **local** TA pubkey as a placeholder; the Architect resolves against the runtime TA (never hardcode).

## Out of scope

- **The tag detail page** — already at parity (Profiles | Notes tabs, Story 8).
- **The profile "Tagging Activity" section** — Story 10.
- **Tag search / autocomplete parity** (`match`) — Story 11 (may be folded in at architecture time).
- **Pins / Trusted Lists** — inherently a profile feature (a TL is a list of profiles); not part of this.
- **Changing how tags are written** — read/index only.

## Open questions

1. **Presentation.** A single combined "used" count with a profile/note breakdown, or separate columns/figures? Mirror the existing `/tags` row layout unless there's reason to diverge. *(Design)*
2. **Where the merge lives.** Extend the existing profile-tags index reader to also aggregate event-taggings, or a new merged reader that the page calls — and how event-taggings resolve onto the shared tag-element identity (via the header → tag-element coordinate ↔ tag-element eventId). *(Architecture)*
3. **Own-stance / mine.** Whether the index should also reflect the viewer's own note-taggings (the `mine` principle) so a tag the viewer used on a note appears even when the POV doesn't count them — consistent with Stories 7–8. *(Architecture / PO)*

## Linked artifacts
- ADR: `engineering-team/decisions/event-tagging/0009-unified-taggings-normalization.md` (this story is its **first consumer** — the unified `taggings` normalization core + registry + `indexByTag`, then `/tags` on top). Design: `engineering-team/designs/unified-taggings.md`.
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
- **Source:** parity audit (two Explore agents), 2026-06-30, prompted by Story-8 testing.
