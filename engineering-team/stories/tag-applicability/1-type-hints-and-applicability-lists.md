# Story 1: Emit tag-type z-hints and publish the two applicability Trusted Lists

**Status:** Approved
**Created:** 2026-07-06
**Type:** Feature

## Background
The team ratified: *topic is the identity of the Tag; target-type is a property of the
Tagging; applicability is a derived, per-POV view* (see `TAG-IDENTITY-MEMO--for-david.md`).
Today a tag-element carries one z joining the deployment's `tag` concept, and nothing records
whether a tag is "for events" or "for pubkeys" — the picker can't be type-aware, and users are
pressured to re-mint per-type duplicates.

This story lays the **data substrate** for applicability (steps 1+2 of the ask):

1. New tag-elements emit an **additive** human-readable z-hint recording their creation context.
2. A derivation publishes two **Trusted Lists** — "Tags for Nostr Pubkeys" and "Tags for
   Nostr Events" — whose membership is **HINT ∪ USAGE**. These lists are the *operative* source
   the later picker (Story 2) trusts; the hint is one voice that also feeds the union and gives
   brand-new (usage-less) tags a day-one signal.

Affected: anyone creating a tag on `tags.brainstorm.world`; the TA (as publisher); the later
picker as consumer.

## User-facing description
As the tagging system, I want each newly-created tag to record whether it was born in a
pubkey-tagging or event-tagging flow, and I want two maintained Trusted Lists of "tags used for
pubkeys" and "tags used for events" (by hint **or** by observed usage), so that pickers can
show type-relevant tags first without hiding or duplicating the shared tag vocabulary.

## Acceptance criteria
Testable from the outside. "Tag-element" = the tag-defining event (the tag itself), **not** a
tagging/assertion. The two z strings are exactly `tag-for-nostr-pubkey` and `tag-for-nostr-event`.

- [ ] **Additive hint on pubkey-flow creation.** Given a user creates a **new** tag while
  tagging a **pubkey**, when the tag-element is published, then it carries
  `["z","tag-for-nostr-pubkey"]` **in addition to** the existing z that joins the deployment's
  `tag` concept — the existing z is still present and unchanged.

- [ ] **Additive hint on event-flow creation.** Given a user creates a **new** tag while
  tagging an **event**, when the tag-element is published, then it carries
  `["z","tag-for-nostr-event"]` in addition to the existing tag-concept z.

- [ ] **Hints carry no pubkey and come from one definition.** The two z values are exactly the
  two fixed strings above, contain **no pubkey**, and are identical everywhere they are emitted
  or read (a single shared definition — verifiable by a test importing the one constant source).

- [ ] **Hints are inert to every existing reader (regression).** Given a tag-element that
  carries the extra z, when it flows through the existing pipeline, then it classifies
  **identically** to the same tag-element without the extra z — no change to
  `classifyEventTaggings` output, profile-tags reads, or `/api/tags/index` membership/counts.

- [ ] **Derived membership is HINT ∪ USAGE.** Given the derivation runs, then a tag appears in
  the **pubkey** list iff it carries the `tag-for-nostr-pubkey` z **OR** is referenced by at
  least one `nostr-user-tag` tagging; and in the **event** list iff it carries the
  `tag-for-nostr-event` z **OR** is referenced by at least one `nostr-event-tag` tagging.
  (Concretely: hint-only-no-usage → appears; usage-only-no-hint → appears; used on both → both
  lists.) The derivation builds on the unified tag index's usage data, not a fresh scan.

- [ ] **Published as TA-signed Trusted Lists, tags referenced by a-coordinate.** Given the
  derivation completes, then each list is published as a **Trusted List signed by the TA** (TA
  pubkey resolved at runtime, via the guarded publish path), and each entry references its tag
  by **a-coordinate** (`39999:<author>:<slug>`) — stable across edits.

- [ ] **Additive & no new concepts.** The lists are published as Trusted Lists (derived views);
  **no** new tag-concept DList/header is created, and **no** existing tag-element or tagging is
  modified. Removing this story's additions leaves the tag/tagging graph as before.

## Concepts touched
- `39998:<TA>:tag` — the shared tag vocabulary (the tag-elements that gain the z-hint / populate the lists).
- `39998:<TA>:nostr-user-tag` — pubkey taggings (USAGE source for the pubkey list).
- `39998:<TA>:nostr-event-tag` — event taggings (USAGE source for the event list).

> TA resolved at runtime (`getOwnerAssistantPubkey`); handles use the local TA `82b75e47…973833`
> for reference only.

## Out of scope
- The type-aware **picker** and the **scheduled** regeneration — Story 2 (this story publishes
  the lists on demand / via a manual trigger; the schedule is Story 2's step 4).
- The same-slug cross-type warning — Story 3.
- Per-type tag-concept DLists; re-stamping existing tags; facet letters; third-party
  membership assertions; firmware seeding of the z strings; graduating the z's to a-tag handles.
- Any push/deploy without operator approval.

## Open questions
- **TL kind/shape (Architecture-gate decision).** Pick the closest existing Trusted List shape
  (`src/api/trustedList/`, `refreshPinnedTags.js`); if nothing fits cleanly, that's an explicit
  operator decision at the Architecture gate. Whether per-type **usage counts** ride in the TL
  metadata (nice for picker ranking) is Architecture's call — a bare ordered list is acceptable
  for today.
- One list per target type (two lists total) — confirmed, not per-type concept DLists.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
