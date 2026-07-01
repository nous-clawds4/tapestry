# Story 12: Generalized (target-typed) tag pinning

**Status:** Queued → folded into the UNIFIED-UI/WRITE PASS (operator decision 2026-06-30). Pinning is write+UI (publish a pin + a kind-30003 bookmark set via NIP-07); build it there with its consumer — the note-pin affordance + publish flow — reusing for-tag for the note set + the registry projection (nip51ListKind/targetToListTag). Not a standalone read-core slice.
**Created:** 2026-06-30
**Type:** Feature
**Epic:** event-tagging

## Background

Pinning a tag = taking a **point-in-time snapshot of a tag's curated members into a portable NIP-51 list**. Today that only works for **profile**-tags: pinning produces a list of *pubkeys* (a kind-30000 follow-set / the kind-30392 Trusted List). It's the same concept for **note**-tags — the only difference is the list's element type: a note-tag pin should produce a list of *notes* (a kind-30003 bookmark set, elements `e`), not pubkeys.

Pinning working only for profiles is confusing once notes are taggable. With the unified taggings model (ADR 0009), pinning becomes just another **projection over the normalized tagging stream**, so this generalizes cleanly instead of becoming a third parallel pin stack. See `engineering-team/designs/unified-taggings.md` → "generalized (target-typed) pinning".

> Read/curation-materialization; the tagging protocol/write is unchanged. The list a pin materializes is published under the user's key (its publishing follows the app's normal guard, like the existing profile pin/export).

## User-facing description

As someone curating with tags, I want to **pin a tag whose members are notes** — and get a shareable, point-in-time list of those notes (a NIP-51 bookmark set) — the same way I can pin a profile-tag and get a follow-list of people, so pinning isn't arbitrarily profile-only.

## Acceptance criteria

Testable from the outside (given a tag with note-taggings + a pin action, what list is produced).

- [ ] **Pin a note-tag → a note list.** Given a tag applied to notes, when I pin it, then a NIP-51 list of the curated **notes** is produced (elements reference the notes, e.g. `e` tags), authored under my key — the note analog of the profile Trusted List.
- [ ] **Right list type per target.** A note-tag pin produces a note-list (bookmark-set kind), not a follow-set of pubkeys; a profile-tag pin still produces the people list (unchanged).
- [ ] **Curated snapshot.** The list reflects the curated/POV-filtered members at pin time (a point-in-time snapshot), consistent with how profile pins snapshot their curation.
- [ ] **Profile pinning unchanged.** Existing profile-tag pinning, Trusted Lists, and exports behave exactly as before (backward compatible).
- [ ] **Extensible.** The pin→list projection is driven by the tagging family member (its list kind + element mapping), so a future tagging type gets pinning by registering its projection — no new pin stack.

## Concepts touched

- `39998:<TA>:tag-pinning` — the pin (generalized to be target-type-aware).
- `39998:<TA>:nostr-event-tag` / `nostr-user-tag` — the family members whose targets are snapshotted.
- NIP-51 list kinds — kind-30000 (people) / kind-30003 (notes/bookmarks) as the materialized outputs.

## Out of scope

- **The unified reads** — Stories 9–11 (consumed here).
- **Changing the tagging write/protocol** — unchanged.
- **New curation methods** beyond a sensible per-type default (rank for people; net-endorsed/recency for notes) — richer curation is a follow-up.
- **The unified UI wiring** — pinning UI on the note side lands in the coherent unified-UI pass (per the design's rollout note), not a partial ship.

## Open questions

1. **Pin generalization vs. a parallel note-pin.** Generalize the existing `tag-pinning` + Trusted-List/export plumbing to be target-type-aware (preferred, per ADR 0009's registry), vs. a note-specific pin path. *(Architecture)*
2. **List kind for notes.** kind-30003 (bookmark set) vs another NIP-51 curation kind — confirm the right element/kind for a "list of notes." *(Architecture)*
3. **Default note curation.** What "curated members" means for notes at pin time (net-applied, most-applied, recency). *(Design / PO)*

## Architecture decisions (operator, 2026-07-01) — see ADR 0015
1. **Generalize via the registry (multi-projection)** — per-member `nip51ListKind`/`nip51ElementTag`/`curationMethods`; one pin → one list per target type present (profiles→30000, notes→30003). Not a parallel stack.
2. **Export-time target-type selection** — profiles / notes / both (checkboxes, default both), so you can emit a follow-pack, a bookmark list, or both.
3. **Two note-curation options** — `notes:net-endorsed` (default) or `notes:most-applied`.
4. **Export-only depth for v1** — user-signed kind-30003 from `for-tag`; **no** TA-signed note-TL now → deferred to **GitHub issue #336** (important fast-follow).

## Linked artifacts
- ADR: `engineering-team/decisions/event-tagging/0015-generalized-target-typed-pinning.md` (this story) + 0009 (registry) + design `engineering-team/designs/unified-taggings.md`.
- Deferral: GitHub issue #336 (TA-signed kind-30392 note-TL).
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
