# Story 1: Tag user profiles (positive and negative assertions)

**Status:** Approved
**Created:** 2026-05-06
**Type:** Feature

## Background
Brainstorm users want to apply categorical tags to other users' pubkeys (e.g. "Verified Human", "Bitcoiner", "Podcaster", "Reply Guy Bot") and to *dispute* tags they consider inaccurate. Tags are decentralized and user-generated; the same user can be tagged differently by different members of a WoT network.

This is foundational work for a later WoT-scored layer over profile attributes. The prior design memo on valence/tag-interpretation explicitly defers per-user scoring and polarity-weighted GrapeRank — so v1 is **valence-naive**: we record applications and disputes as raw, signed assertions and surface counts, but do not compute aggregate trust scores yet.

The `tag` and `nostr-relay-tag` concepts already exist in firmware. `nostr-relay-tag` is the precedent: each element links a target event id to a tag event id. This story extends the same pattern to profile targets.

## User-facing description
As a Brainstorm user viewing another user's profile, I want to apply or dispute categorical tags on that pubkey — choosing from tags already in use by my WoT network or creating a new one — so that my network builds a decentralized, observable categorization layer over Nostr identities.

## Acceptance criteria

- [ ] Given I am viewing another user's profile, when the page loads, then a `Tag` action button is visible alongside `Follow`, `Mute`, and `Report`.
- [ ] Given I click `Tag` on a profile, when the tagging interface opens, then I can (a) select from a list of tags already applied within my WoT network, or (b) create a new tag inline with a required name and optional description.
- [ ] Given I am applying a tag, when I confirm, then a signed assertion is published with explicit polarity `+` (positive: "this tag applies to this pubkey").
- [ ] Given I am disputing a tag, when I confirm, then a signed assertion is published with explicit polarity `-` (negative: "this tag does NOT apply to this pubkey").
- [ ] Given polarity is omitted from a published assertion, when consumers read it, then it is interpreted as `+` (default positive). Negative assertions must be explicit.
- [ ] Given a profile has tags applied or disputed by my WoT network, when I view the profile, then each tag chip displays the WoT count of applications and disputes (e.g. "Applied by 5", "Disputed by 1") and the names/avatars of asserters.
- [ ] Given I have applied or disputed tags on others, when I open a `Manage` view from any tagged profile, then I can see and revoke my own assertions (minimal v1: list + revoke; no filter, search, or bulk operations).
- [ ] Given I revoke an assertion, when I confirm, then a deletion or replaceable-overwrite is published per Nostr conventions and the chip count updates.
- [ ] Given the firmware `tag` concept currently scopes its applicability to nostr-relays, when this feature ships, then a sibling concept exists in firmware for `nostr-user-tag` (or equivalent) that mirrors the `nostr-relay-tag` pattern, and `tag` itself is generalized so it can be referenced from a `nostr-user-tag` element.
- [ ] Given tag and profile-tag events conform to firmware list patterns, when published, then they are indexable by existing list-header/list-element infrastructure without bespoke parsing.

## Concepts touched
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag` — Tag (existing; may need scope generalization)
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user` — Nostr User (existing; tagged target)
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-relay-tag` — pattern precedent
- New: `nostr-user-tag` (working name) — sibling of `nostr-relay-tag`, links a `nostr-user` element to a `tag` element with polarity

## Out of scope
- GrapeRank or any aggregate trust scoring of profile-tags (deferred to the valence/interpretation arc).
- Per-user tag-valence overrides (deferred — see prior design memo).
- Sorting/ranking tag chips on a profile by trust or popularity (display order is unspecified for v1).
- Tag editing or renaming after creation; tag merging; alias resolution.
- Tag moderation or admin tooling.
- Tagging anything other than user pubkeys (relays already covered; notes/events not in scope here).
- Richer `Manage` view (filter/search/bulk) — minimal list + revoke only in v1.

## Open questions
- Persistence shape for the polarity field: nostr event-tag, JSON-content field, or two parallel concepts (apply vs. dispute)? **Architect to decide.**
- Whether profile-tag elements reference Tags by event id (precedent: `nostr-relay-tag`) or carry inline tag-name strings. **Architect to decide.** PO recommendation: reference, per precedent.
- Tag identity / dedup: canonicalize by slug, by id, or allow free-form duplicates? **Architect to decide.**
- Source of "tags used by my WoT network": existing index query or new aggregation endpoint? **Architect to decide.**
- Whether revocation is implemented as Nostr deletion (kind 5) or replaceable-overwrite. **Architect to decide.**

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
