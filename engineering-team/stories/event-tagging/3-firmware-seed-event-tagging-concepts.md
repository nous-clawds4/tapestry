# Story 3: Seed the event-tagging DList concepts in firmware

**Status:** Draft
**Created:** 2026-06-26
**Type:** Feature
**Epic:** event-tagging

## Background

The event-taggings protocol (`protocols/drafts/event-taggings.md`, ratified in Story 1) is built on two **firmware-seeded DList concepts** authored by the deployment's Tapestry Assistant (TA):

- **`nostr-event-tag`** — the list of *event taggings*. Every event-tagging assertion `z`-joins this concept; it is what makes "this event was tagged" a thing the concept graph knows about.
- **`tagging-with-specific-tag`** — the *type* whose members are the per-tag "tagging headers" (`39999:<author>:tagging:<slug>-tagging`). Each member points at the tag-element it applies, via an `a` tag (preferred) or `e` tag — the spec encodes that as a `recommended: a` / `allowed: e` rule on this header.

Neither concept is seeded yet (confirmed: the concept graph exposes `tag` and `nostr-user-tag` but neither new handle). Until they are, event-tagging assertions and per-tag headers reference concepts that don't exist, so nothing aggregates into the graph and the read API (Story 4) has nothing to read. This story seeds them — the first concept-definition change in the epic, so it **requires a firmware reinstall** (AGENTS.md §6).

These mirror the existing TA-authored DList concepts (`tag`, `nostr-user-tag`, `tag-pinning` under `firmware/versions/v1.0.0/concepts/`) in shape.

## User-facing description

As a Tapestry deployment, I want the two event-tagging DList concepts established in my concept graph under my own Tapestry Assistant, so that event taggings and per-tag tagging headers published by anyone aggregate into the graph and become discoverable — the foundation the event-tagging read path and UI build on.

## Acceptance criteria

Testable from the outside. `<TA>` is the deployment's runtime Tapestry-Assistant pubkey.

- [ ] **`nostr-event-tag` is in the graph.** After a firmware reinstall, the concept graph resolves the handle `39998:<TA>:nostr-event-tag` (e.g. it appears in `/api/concept-graph/summaries` and `/api/concept-graph/node/<handle>` returns it), with a description identifying it as the list of nostr **event** taggings (an event that applies a specific Tag to a specific event, referenced by `e` or `a`).
- [ ] **`tagging-with-specific-tag` is in the graph.** After reinstall, the concept graph resolves `39998:<TA>:tagging-with-specific-tag`, described as the type whose members are per-tag tagging headers, each pointing at a specific Tag.
- [ ] **The member-reference rule is on the wire (spec fidelity).** The published `tagging-with-specific-tag` kind-39998 header event carries literal `["recommended","a"]` and `["allowed","e"]` tags — exactly as the spec's example shows — so any third-party implementation reads the rule straight off the event, not from Tapestry-stack-internal metadata. (Asserted against the actual published event.)
- [ ] **Authored by the deployment's own TA.** Both handles resolve under the **runtime** TA pubkey of whatever deployment installed the firmware — not a hardcoded identity. On a fresh deployment with a different TA, the handles are composed from that deployment's TA.
- [ ] **A fresh install includes them.** The firmware manifest lists both new concepts, so installing firmware from scratch (not just an incremental reinstall) establishes them.
- [ ] **The concepts federate (added 2026-06-26).** Each new concept is registered with a `communityReference` pointing at the canonical authority (mirroring `nostr-user-tag`), so a non-canonical deployment's local concept bridges to the shared canonical one — event-taggings aggregate around the same authority as pubkey-tags, rather than forming a per-deployment island. (The wire half — dual-z on published events — is the amended ADR 0001.)
- [ ] **Existing concepts are unaffected.** After the reinstall, `tag`, `nostr-user-tag`, `tag-pinning`, and the other existing concepts still resolve unchanged (regression).
- [ ] **The names/slugs match the protocol.** The seeded concepts use the slugs `nostr-event-tag` and `tagging-with-specific-tag` exactly (these slugs are embedded in published `z` handles by the wire protocol and the Story-1 core), with human names matching the spec ("nostr event tagging(s)", "tagging with specific tag(s)").

## Concepts touched

- **NEW** `39998:<TA>:nostr-event-tag` — list of event taggings (seeded here).
- **NEW** `39998:<TA>:tagging-with-specific-tag` — per-tag tagging-header type, with the recommended-`a`/allowed-`e` member rule (seeded here).
- `39998:<TA>:tag` — referenced: `tagging-with-specific-tag` members point at tag-elements; unchanged here.
- `39998:<TA>:nostr-user-tag` — the sibling concept whose firmware shape these mirror; unchanged here.

> Handles use the local TA pubkey for illustration; the Architect composes them from the runtime TA (CLAUDE.md "Per-deployment TA pubkey — NEVER hardcode"). The seed authoring (TA-signed kind-39998 headers) follows the existing firmware mechanism.

## Out of scope

- The **read API** that queries these concepts and the taggings on them (Story 4).
- The **write path** and **UI** (Stories 5–6).
- Any change to the `tag` / `nostr-user-tag` / `tag-pinning` concepts or their schemas.
- The `dlist-tag` family member (envisioned in `tags.md`, not part of this epic).
- Re-parenting concepts under a non-literal pubkey (ADR 0015 territory) — not applicable; these are brand-new concepts seeded under the runtime TA.

## Open questions

1. **Firmware version/track.** Do the two concepts go into the existing `firmware/versions/v1.0.0/` (and/or `firmware/versions-grapevine/…`), or a new firmware version? Which track(s) the TA-authored DList concepts belong to is the Architect's call. *(Architecture)*
2. **Expressing `recommended: a` / `allowed: e`.** How the firmware concept format carries the member-reference rule (a schema field, an `x-tapestry` block, header-event tags rendered at publish time) — Architect. The *requirement* is that the rule is recorded on the seeded concept.
3. **json-schema per concept.** Existing concepts ship a `json-schema.json`; confirm whether these two need one and what it constrains. *(Architecture)*

## Linked artifacts
- ADR: `engineering-team/decisions/event-tagging/0003-firmware-seed-event-tagging-concepts.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
