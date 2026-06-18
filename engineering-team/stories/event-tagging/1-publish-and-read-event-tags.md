# Story 1: Publish & read nostr-event-tags on kind-1 notes (stack-complete slice)

**Status:** Approved
**Created:** 2026-06-18
**Type:** Feature
**Epic:** event-tagging (book 1 of the epic)

## Background

Today, Tapestry can tag **people** — anyone may assert that a pubkey belongs to a community-creatable tag ("Avi is a Podcaster"), and those assertions are aggregated and ranked per point-of-view. But the knowledge graph's subjects are richer than people: **notes, and eventually any nostr event or URL, deserve to be taggable too.** The protocol already reserves a slot for this — `protocols/drafts/tags.md` names a *taggings family* in which `nostr-user-tag` (pubkeys) is the deployed member and `nostr-event-tag` (events) is the planned next member, with its wire format explicitly unspecified.

This story fills that slot with the first concrete target type — **kind-1 short text notes** — as a *stack-complete vertical slice*: protocol ratification, relay/firmware handling, client write, client read, and federation, so the feature can be validated live end-to-end rather than shipped write-only. Kind 1 is only the *first* target; nothing in the wire format may be kind-1-specific.

This lands alongside two surfaces a teammate (David) is building where kind-1 notes render: a **Feed on each Profile page** and an **event-ID search**. Those surfaces are where users will act on notes, so they are where the tag affordances and the inline view of existing tags belong.

Who is affected: any logged-in user who reads notes and wants to classify them; and every POV consuming the graph, which gains note-level tag signal.

## User-facing description

As a logged-in user reading a kind-1 note (on a profile's feed or via event-ID search), I want to apply or dispute a community tag on that note and see the tags people in my web of trust have already applied to it, so that notes — not only people — become first-class, collectively-classifiable subjects in the knowledge graph, viewed from my perspective.

## Acceptance criteria

Testable from the outside (input → expected behavior). "WoT-filtered / per-POV" means counted only when the asserting pubkey is in the active point-of-view's web of trust, computed at read time.

- [ ] **Apply on the feed.** Given a kind-1 note rendered on a Profile page's feed and a logged-in user, when the user applies an existing tag to that note, then a signed assertion is published that references *that note* and *that tag*, and after refresh the tag appears on that note as an applied chip.
- [ ] **Apply on event-ID search.** Given a kind-1 note surfaced by event-ID search, when the user applies a tag, then the same publish-and-appears behavior holds as on the feed (the two surfaces share one write path).
- [ ] **Dispute.** Given a tag shown on a note, when the user disputes it, then a dispute assertion is published and the note's view reflects the dispute (apply vs. dispute are distinguishable in the counts shown).
- [ ] **One live stance per (user, note, tag-element).** Given a user who applies a tag to a note and then disputes the same tag on the same note (or vice-versa), when the note is re-read, then only the latest stance is counted for that user — not both. Identity here is the *tag-element* (author + slug), not the slug alone: applying two same-slug tags from different authors to the same note yields two independent stances, not a collision.
- [ ] **Encrypted-variant events are ignored cleanly.** Given an event that carries the reserved encryption marker (an event the reader cannot or should not decrypt), when a public reader/aggregator processes it, then it is skipped silently — never counted, never treated as malformed, never throwing. (Forward-compatibility guard; no encryption is built in this story.)
- [ ] **Read is WoT-filtered per POV.** Given a note that has been tagged, when a viewer loads it, then the tags shown and their application/dispute counts include only assertions whose authors are in the *active POV's* web of trust; switching POV can change what is shown without any re-index or migration.
- [ ] **Out-of-WoT assertions are not counted.** Given an assertion authored by a pubkey outside the active POV's web of trust, when a viewer loads the note, then that assertion does not appear in the note's tag counts.
- [ ] **No write-time gating.** Given *any* signed assertion from *any* pubkey (not a designated/approved author), when it is published, then it is accepted and becomes eligible for per-POV aggregation — acceptance never depends on who authored it.
- [ ] **Read endpoint.** Given an event id, the read surface returns the WoT-filtered applied/disputed tags for that event, drawing from federation (local relay ∪ configured DList relays), with replaceable-event semantics applied (latest stance per author wins).
- [ ] **Target-type-generic wire format.** Given the assertion's on-the-wire shape and stored payload, then nothing about it is specific to kind-1; the recorded payload identifies its target through a generic, target-type-discriminated structure such that a future non-note target (e.g. another event kind, or a URL) could reuse the same payload schema unchanged.
- [ ] **Federatable identity.** Given two deployments that both recognize the canonical concept identity, when one publishes an event-tag assertion, then the other can recognize it as a member of the same concept (shared canonical handle), while each instance also lands it in its own local concept list.
- [ ] **Stack-complete orientation.** Given the concept-graph orientation endpoint after this ships, then the new assertion concept is present (firmware installed), the protocol spec's event-tagging section is ratified (no longer a placeholder), and the live write→read→refresh loop is demonstrable on at least one of David's surfaces.

## Concepts touched

Handles resolved via `/api/concept-graph/summaries` (TA pubkey shown is the local-dev value; the canonical/runtime split is an Architecture concern — see Design constraints).

- `39998:<TA>:tag` — **tag** (the community-creatable categories). **Reused unchanged** — a tag is a tag regardless of what it's applied to; this story creates no new category concept.
- `39998:<TA>:nostr-user-tag` — **nostr-user-tag** (pubkey assertions). **Sibling / reference pattern** — the new concept mirrors its publish/read/aggregate/federate shape, retargeted from pubkey to event.
- `39998:<TA>:nostr-event-tag` — **nostr-event-tag** (event assertions). **NEW** — the only new concept in this story.
- `39998:<TA>:tag-pinning` — **tag-pinning** (personal curation of tags). **Reused, untouched** — pins target a tag-element, not the tagged thing; event-specific pin curation is explicitly out of scope for this book.

## Design constraints (locked upstream with the protocol author — for the Architect)

These were ratified in discussion before planning; recording them so the Architect designs *within* them rather than re-opening them. The *how* (files, modules, function names, exact JSON keys) remains the Architect's to specify.

**Working wire shape (both halves) — the reference the discussion converged on.** Not yet ratified into `protocols/drafts/tags.md`; the Architect/ADR pins the final form. Shown so the constraints below are concrete:

```jsonc
{
  "kind": 39999,
  "tags": [
    ["d", "event-tag-<tagAuthor[0:8]>-<tagSlug>-<targetEventId[0:8]>-<asserter[0:8]>"],
    ["e", "<targetEventId>"],                  // target note — sole top-level event ref
    ["a", "39999:<tagAuthorPubkey>:<slug>"],   // tag-element — stable identity (queryable)
    ["p", "<noteAuthorPubkey>"],               // optional: who wrote the tagged note
    ["z", "<canonical nostr-event-tag handle>"],     // ADR-0015 literal — federation identity
    ["z", "<runtime-local nostr-event-tag handle>"], // this instance's TA
    ["polarity", "1"]                          // "1" apply / "-1" dispute (absent = apply)
  ],
  // plaintext mirror WHEN NOT ENCRYPTED (see constraint 6); generic target-keyed envelope:
  "content": "{\"target\":{\"type\":\"nostr-event\",\"id\":\"<targetEventId>\",\"author\":\"<noteAuthorPubkey>\"},\"tag\":{\"address\":\"39999:<tagAuthorPubkey>:<slug>\",\"version\":\"<tagEventId>\"}}"
}
```

1. **Assertion references.** The target note is referenced as the assertion's sole top-level event reference; the tag-element is referenced by its **stable address** (queryable). Tag-element *version provenance* is deliberately **demoted out of a top-level reference and into the stored content payload** — kept for audit/display, not for filtering. Rationale: the user/pubkey-tag hybrid `e`+`a` exists because tag-elements are editable (stable `a` follows edits; `e` records the applied version); event-tagging keeps that *information* but reshapes *where* it lives so the single event-reference slot can mean "the target note" unambiguously, avoiding the legacy double-reference collision (worksheet W4). Because this concept is greenfield, there is **no legacy backfill** to honor.
2. **Generic content envelope.** The stored payload is keyed by a generic `target` (not a note-specific key), discriminated by target type, so the *same payload schema* serves future family members (e.g. URL tagging). Starting the payload deliberately now, while small, is intended.
3. **Canonical concept identity.** `nostr-event-tag`'s concept handle reuses the existing **canonical literal** pubkey for the shared identity (so deployments agree / it federates), plus a runtime-local handle — a deliberate extension of ADR-0015's named-literal exception. **This requires its own ADR** documenting the extension; a reviewer must reject an un-ADR'd literal.
4. **POV / decentralization invariants.** Anyone may tag any event (no write-time gating); aggregation is per-POV WoT over asserters, filtered at query time; no per-POV denormalized storage. Identical to pubkey-tagging.
5. **Polarity & replaceability.** Apply/dispute carried by polarity; one deterministic live stance per (asserter, note, tag-element), latest-wins. **Refinement vs. pubkey-tag (Architect to resolve):** the deployed pubkey `d` tag keys on `slug` alone, so two same-slug tag-elements from different authors collide for one asserter+target. The spec treats same-slug-different-author as *distinct* elements, so the `d` tag here must key on the **tag-element identity (author + slug)**, not the slug. This is a latent bug in the pubkey shape; event-tag is the clean place to get it right (candidate fix-forward for pubkey-tag later, not in this story).

6. **Forward-compatibility: encryption.** Encryption is **out of scope to build** in v1 (all public taggings), but the wire format and reader contract must not preclude future self-encryption, ring/shared-group-key, or for-a-recipient (gift-wrap) variants. Concretely, with nothing encrypted built now:
   - **Reserve an explicit encryption discriminator** — a top-level marker (e.g. `["encrypted", "<scheme>"]`); its *absence* means plaintext/public. Define the semantics; build no encryption.
   - **Tolerant reader contract.** `content` is the plaintext mirror *only when not encrypted*; readers MUST tolerate opaque/ciphertext content and missing top-level refs, and "cannot read it" MUST mean *skip*, never *reject/throw*. (This is the testable guard in the acceptance criteria.)
   - **Counted fields stay top-level.** The public aggregator must never depend on anything that lives *only* in `content` (provenance-in-content is fine — nobody aggregates on it). This keeps encrypted variants gracefully *opting out* of cross-author aggregation rather than breaking it. An encrypted tagging is, in our model, simply one visible only from the POV of whoever holds the key; a future ring variant may expose a dedicated filterable ring handle (non-breaking addition) so key-holders can scan + decrypt client-side. Key distribution is a separate, orthogonal problem (MLS-over-nostr work, etc.) the format does not solve.

7. **Family-wide target disambiguation (Architect to resolve / flag to protocol author).** "Target by `e`, tag-element by `a`" is clean for kind-1, but the *envisioned* `dlist-tag` targets addressable events (kinds 39998/39999) whose natural reference is also `a` — colliding with the tag-element `a`. Since the wire format must not be kind-1-specific, decide the disambiguation rule now even though only kind-1 is built: e.g. role/markers on reference tags, and/or treating the content `target` envelope as authoritative (top-level tags as filter hints) — the latter is consistent with constraint 2 and dovetails with the tolerant-reader contract. **Prior art to evaluate (adopt / align / diverge):** NIP-32 (Labeling) solves almost exactly this — labeling events/pubkeys/addressable-events/URLs/topics via `e`/`p`/`a`/`r`/`t`. Aligning at least the target-reference vocabulary would make the family interoperable. (This is the protocol author's call; the team is reviewing it in parallel.)

## Out of scope (deferred to later books in the event-tagging epic)

- **/tag pages showing tagged events.** The `/tag/:slug` pages continue to show only profiles; adding event rows, the events-tagged aggregation, sorts, and filters is a later book.
- **Pin curation for events** (event-specific use of `tag-pinning`, curated/Trusted-List exports for event sets).
- **Target types beyond kind-1** — DList headers/items (kinds 39998/39999, the envisioned `dlist-tag`), other event kinds, and URLs. The wire format must *not preclude* them, but no other target type is built here.
- **Renaming the family** (`nostr-user-tag` → `nostr-user-tagging`, etc.) — worksheet W10; out of scope.
- **Encryption (all modes).** Self-encryption, ring/shared-group-key, and for-a-recipient (gift-wrap) taggings are not built here. v1 is public taggings only. The format merely *reserves room* for them per design constraint 6 — building any of them, and the group key-distribution mechanism, is later/separate work.

## Open questions

- **Tag picker on the note surfaces.** Applying a tag requires choosing an existing tag (and possibly creating one inline). Is reusing the existing tag-selection affordance from the pubkey-tag surfaces sufficient for v1, or is a note-specific picker needed? (Architecture/Experience detail; default: reuse.)
- **Provenance capture timing.** The demoted version-provenance records the tag-element version "at apply time." Confirm there's no requirement to *update* it when the tag is later edited (expected: no — it is a point-in-time record). Architect to confirm against the pubkey-tag precedent.

## Linked artifacts
- ADR: (filled in after Architecture phase) — note: an ADR extending ADR-0015's literal exception to `nostr-event-tag` is required.
- Protocol spec: `protocols/drafts/tags.md` § "Event tagging" — to be ratified from placeholder to normative (docs-mode companion).
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
