# Story 3: Dual-z writer — new tags/taggings carry both canonical and local z (W11)

**Epic:** tag-federation (Half 2 — Part B)
**Status:** Draft
**Created:** 2026-06-17
**Type:** Feature

## Background

This is **Part B of Half 2 — and the piece that has been deferred repeatedly.** The deferral was legitimate until now: the dual-z model needs a canonical-header *map* for the local z to root against, and that map (the b-tag primitive + per-concept seeds) didn't exist until Story 38 + Story 2. **Those land first; after them, this is no longer blocked — it is the next thing built, not a future bullet.**

Today, a newly created tag element or tagging assertion carries **one** `z` tag — the **canonical** z (`39998:82b75e47…:<slug>`, ADR-0015). That makes it network-visible (Half 1 federates it) but means it never appears in the *local* instance's own concept list: the local list is keyed on the **local** z (`39998:<thisInstanceTA>:<slug>`), which new events don't carry. So an instance's local `nostr-user-tag` list stays empty even as its users tag people.

This story makes the tag/tagging **writer** stamp **both** z tags on new events: the canonical z (unchanged, for network visibility) **and** the local z (new, so the event joins this instance's own concept list). This is David's "the new Tags and Taggings need to have two z-tags in them, not just one."

**W11 — the multi-z "cloud formation" stamping practice — is undesigned.** Designing it is this story's Architecture deliverable: which coordinates, the ordering of the two z tags, and how the second z composes with the **ADR-0022 hybrid e+a `a`-tag** the writer already stamps. Existing single-z events are **not** migrated.

## User-facing description

As a **user tagging people on my instance**, I want the tags and taggings I create to show up **both** across the network **and** in my own instance's concept lists — so my instance's local view of "who's been tagged what" reflects the activity happening on it, not just an empty list while the tags are only visible network-wide.

## Acceptance criteria

- [ ] **AC-1 (tag element dual-z):** When a new tag element is created, the published event carries **two** `z` tags: the canonical `39998:82b75e47…:<slug>` **and** the local `39998:<thisInstanceTA>:<slug>`.
- [ ] **AC-2 (tagging dual-z):** When a new tagging assertion is published, the event carries the same two `z` tags (canonical + local) for its concept.
- [ ] **AC-3 (composes with hybrid e+a):** The dual-z event still carries the ADR-0022 hybrid `e`+`a` reference shape unchanged — no regression to that wire format; the second z is additive.
- [ ] **AC-4 (local list populates):** Given a user publishes a new tagging on instance X, when instance X's local concept list (`39998:<X's TA>:nostr-user-tag`) is loaded, then that tagging appears in it — and (per Half 1) it remains visible network-wide as well.
- [ ] **AC-5 (no migration / no regression to old events):** Existing single-z events are not rewritten; they stay canonical-z-only and remain network-visible. No backfill.
- [ ] **AC-6 (runtime local TA pubkey):** The local z's `<thisInstanceTA>` is resolved at runtime (never hardcoded) — correct per-deployment on every instance.
- [ ] **AC-7 (David verification breadcrumb):** The PR carries the explicit "one pointer-`b` per header / two z per event" note to David + the reversal breadcrumb (consistent with Story 2).

## Concepts touched

- `tag` / `nostr-user-tag` (canonical `39998:82b75e47…:<slug>` + the new local `39998:<thisInstanceTA>:<slug>`).
- Writer surfaces: `ui/src/utils/publishProfileTag.js` (the tagging writer — already stamps the ADR-0022 hybrid e+a) and the tag-element creation path.

## Out of scope

- Migrating/backfilling existing single-z events.
- The b-tag map itself (Story 2 / Story 38).
- The resolved-definition read primitive (ADRs 0028/0032) — pointer-typed, doesn't resolve.

## Open questions (the W11 design — for the Architect)

1. **z-tag ordering & multiplicity:** does order between canonical and local z matter to any reader? (z is NIP-01-indexed, multi-value — confirm readers union across z values and aren't order-sensitive.)
2. **Composition with hybrid e+a:** the writer already stamps `['a', '39999:<authorPubkey>:<slug>']` (ADR-0022). Confirm the second z and the a-tag don't collide and that the local z uses the instance TA while the a-coordinate keeps its author semantics.
3. **Writer surface scope:** is it only the client writer (`publishProfileTag.js` + element creation), or are there server-side publish paths that also need the second z?
4. **Local header existence:** the local z `39998:<thisInstanceTA>:<slug>` assumes the local header exists (firmware install creates it). Confirm — and confirm Story 2's seeded `b` doesn't change this dependency.

## Linked artifacts

- Epic: `engineering-team/epics/tag-federation.md`. Handoff: `docs/B_TAG_HALF_2_HANDOFF.md` (§4 Story 3, Part 1 — W11). Worksheet: `protocols/worksheet.md` (W11).
- Depends on: `engineering-team/stories/tag-federation/2-per-concept-b-tag-seeds.md` and `…/community-reference/38-…` (Done).
- ADR: (filled in after Architecture phase — **the W11 stamping design**)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
