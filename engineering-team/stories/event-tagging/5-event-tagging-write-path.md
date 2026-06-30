# Story 5: Event-tagging write path

**Status:** Draft
**Created:** 2026-06-30
**Type:** Feature
**Epic:** event-tagging

## Background

Stories 1–4 produced the protocol core, the publish guard, the seeded concepts, and the read API. This story adds the **client publish logic** that actually creates event-taggings — the layer Story 6's UI will call. It builds on the Story-1 core builders (`buildTagElement`, `buildTaggingHeader`, `buildEventTaggingAssertion`) and publishes through the existing guarded publish path (Story 2), so everything stays on the local relay during the build.

The defining complexity is that, unlike pubkey-tagging (always one publish), event-tagging needs **one, two, or three publishes** depending on what already exists.

**Important property — the references are addressable coordinates, not event ids.** Each later event references the earlier ones by their *coordinate* (`kind:pubkey:slug`, e.g. the header's `a` = the tag-element coordinate, the assertion's descriptor `z` = the header coordinate). Those coordinates are derivable from the author pubkey + slug **up front** — they do **not** depend on the earlier event's signed `id`. Consequently all needed events can be **built and signed before any are published** (a clean abort: cancelling any signer prompt publishes nothing). The dependency is therefore on **publish order**, not signed ids:

- **(a) Apply/dispute an existing event-tag** (its per-tag tagging header already exists) → **1 publish**: the kind-39999 assertion (polarity +1 apply / −1 dispute).
- **(b) Apply a tag that exists but has no tagging header yet** → **2 publishes**: create the tagging header (references the tag-element), then the assertion (references the header).
- **(c) Apply a brand-new tag** (doesn't exist at all) → **3 publishes**: create the tag-element, then the tagging header (references the tag-element), then the assertion (references the header).

Which sequence is needed is **discovered, not assumed** — via the Story-4 read (`headers-for-tag`, and the existing available-tags). This mirrors the pubkey write path (`ui/src/utils/publishProfileTag.js`, `useProfileTags.js` `createTag`): NIP-07 signing, `publishOrThrow` semantics, and dual-z federation (`[canonical, local]` supplied by the app, never hardcoded in the generic core).

This story is the **publish logic/hook layer only** — no rendering, no affordance, no note-surface wiring (Story 6 consumes it).

## User-facing description

As a logged-in user, I want to apply or dispute a tag on a note — whether the tag already exists, already has a tagging header, or is brand new — and have the system create whatever intermediate objects are needed, in the correct order, publishing them to my relay, so that my tagging is discoverable without me having to understand the underlying object graph.

## Acceptance criteria

Testable from the outside by observing the sequence of signed/published events for a given starting state.

- [ ] **1-publish (existing header).** Given a tag whose tagging header already exists, when I apply it to a note, then exactly **one** kind-39999 assertion is published — `e`=note id (or `a`=coordinate for an addressable target), the descriptor `z` = the existing header's coordinate, the concept `z`(s) for `nostr-event-tag`, `polarity` "1", and the deterministic `d`. Disputing publishes the same with `polarity` "−1".
- [ ] **2-publish (tag exists, no header).** Given a tag with no tagging header, when I apply it, then **two** events publish **in order**: the tagging header (referencing the tag-element's coordinate) first, then the assertion referencing that just-created header. The assertion is never published before its header.
- [ ] **3-publish (brand-new tag).** Given a tag that doesn't exist, when I apply it, then **three** events publish **in order**: the tag-element, then the tagging header (referencing the tag-element), then the assertion (referencing the header). Each references the prior.
- [ ] **The sequence is chosen by discovery.** Which of (a)/(b)/(c) runs is decided by checking whether the tag exists and whether a tagging header exists (using the Story-4 reads), not by an assumption the caller passes blindly.
- [ ] **Ordered publish, stop on failure → only harmless partial states.** Publishes happen in dependency order (tag → header → assertion); if any publish fails, the dependents are **not** attempted and the failure is surfaced. The only reachable partial states are *reusable* objects — an orphan tag-element, or a tag + header with no assertion — never an assertion referencing a header that was never published (the would-be "unverifiable" state). A retry re-does only the missing tail (addressable + replaceable, so no duplicates).
- [ ] **Local-only (build invariant).** Every publish in every sequence routes through the guarded publish path, so with the guard on, no event reaches an external relay.
- [ ] **NIP-07 signing.** Events are signed via the browser signer; if no signer is available, a clear error is raised and **nothing** is published.
- [ ] **Dual-z federation.** The tag-element, tagging header, and assertion each carry **both** the canonical and the local concept `z` for their concept (the app supplies `[canonical, local]`); the generic core is not asked to embed any literal.
- [ ] **Replaceability / flip.** Re-applying, or flipping apply↔dispute, republishes at the **same deterministic `d`** (latest-wins) rather than creating a duplicate assertion.
- [ ] **Malformed input is refused, not published.** A malformed pubkey/coordinate causes the build to throw (the core's guards) **before** any publish — no orphan events.

## Concepts touched

- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag` — the tag-element created/referenced.
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tagging-with-specific-tag` — the tagging header's concept.
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-event-tag` — the assertion's concept.
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-event` — the target.

> Architect: the `[canonical, local]` z-namespace list is supplied by the app (the canonical literal is an app constant, ADR-0015 lineage; the local is the runtime TA) and passed to the Story-1 core's `taPubkeys` parameter — the generic core stays literal-free.

## Out of scope

- **UI / rendering / the affordance / note-surface wiring** — Story 6 (this is the publish-logic layer it calls).
- **The read API** — Story 4 (consumed here).
- **Revoke / NIP-09 deletion** of a tagging — apply↔dispute via polarity flip covers "change my stance"; a hard delete is a later concern, note it.
- **External publishing** — the guard keeps everything local during the build; flipping to external is the operator's separate release decision.

## Open questions

1. **Framework boundary + sign timing.** Lean: the *orchestration* (the 3-sequence decision + ordered, stop-on-failure publish) should be as framework-agnostic as practical — signing and transport **injected** — so the sequence logic is portable/testable, with a thin React hook as the adapter (epic SDK ethos). Sub-decision: **sign-all-then-publish** (clean all-or-nothing abort, enabled by the addressable-coordinate property above) vs sign-publish-each. Lean: sign-all-first. Architect decides the split + timing. *(Architecture)*
2. **Which header to reference when one exists (possibly several).** Because the per-tag header embeds its author, multiple authors may have created headers for the same tag. When applying, the writer references *an* existing honored header rather than minting a duplicate — which one (deterministic pick) is the Architect's call. *(Architecture)*
3. **Partial-failure surfacing.** If the header publishes but the assertion fails, the header is harmless/reusable and left in place; confirm the caller is told what succeeded vs failed (so Story 6 can show the right state). *(Architecture / PO)*

## Linked artifacts
- ADR: `engineering-team/decisions/event-tagging/0005-event-tagging-write-path.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
