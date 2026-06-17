# Story 2: Seed the pointer-`b` map on the tag concepts (apply the primitive)

**Epic:** tag-federation (Half 2 — Part A)
**Status:** Approved
**Created:** 2026-06-17
**Type:** Feature

## Background

Story 38 (epic `community-reference`) built the generic b-tag primitive: firmware can now publish a pointer-`b` on a TA-authored concept header and derive the `REFERENCES {source:'b-tag'}` edge from it, and the legacy `firmware-community` stub is retired for `b`-carrying headers. It was proven on the throwaway `nostr-relay` dev ground with **no manifest edits** (the stub trap).

This story applies that primitive to the **real tag concepts** — `tag`, `nostr-user-tag`, `tag-pinning` — by adding their `communityReference` manifest entries (now safe, because the emitter exists). After reinstall, each instance's **local** TA header for these concepts gains a pointer-`b` to the **canonical** header (`39998:82b75e47…:<slug>`), and the graph derives the lineage edge. This makes each instance's local concept **traceable to the one canonical definition** — the "map" half of the dual-z model.

This is David's "flesh out `headerATag` for Tags and Taggings, probably one at a time" — now unblocked. It is **Part A** of Half 2: it establishes the header→canonical *map*. It does **not** populate the local concept *list* with new activity — that needs the dual-z writer (Story 3, Part B), which is purely additive on this.

The canonical header event ids (the `knownGoodEventId` pins) were verified live on **dcosl** (NOT tags.bw — tags.bw carries per-user tag *content*, not the `82b75e47…` canonical headers):
- `tag` → `6f38f7b7748cbece9f75d131f0c79392cc01fc24cac8a7bdd11a9fc9f24e6fd0`
- `nostr-user-tag` → `7df925f78f7f416429b52d558712f1a33d018170a3558706024140199dfe7893`
- `tag-pinning` → `69d36397d92c086b5c184840f5af91ad89ab2f7718fcc674418a0b80074c1eef`

## User-facing description

As an **operator running any `*.brainstorm.world` instance**, I want my instance's local `tag` / `nostr-user-tag` / `tag-pinning` concepts to carry an explicit, on-wire pointer to the one canonical definition of each — so the concept graph shows where my local concept came from, consistently across every deployment, instead of an orphaned local header with no lineage.

## Acceptance criteria

- [ ] **AC-1 (manifest seeds):** `firmware/active/manifest.json` carries a `communityReference { headerATag, relayHints:["wss://dcosl.brainstorm.world"], knownGoodEventId }` for each of `tag`, `nostr-user-tag`, `tag-pinning`, with the three verified `knownGoodEventId`s above and `headerATag = "39998:82b75e47…:<slug>"`.
- [ ] **AC-2 (pointer-`b` seeded):** After firmware reinstall, each concept's local TA header (`39998:<thisInstanceTA>:<slug>`) carries exactly one `["b", "39998:82b75e47…:<slug>", "pointer"]` tag.
- [ ] **AC-3 (lineage edge derived):** For each concept, a `(localHeader)-[:REFERENCES {source:'b-tag'}]->(canonicalHeader)` edge exists in Neo4j after install.
- [ ] **AC-4 (no stub):** No `REFERENCES {source:'firmware-community'}` stub edge is freshly MERGEd for these three headers (the edge derives from the published `b`, per Story 38).
- [ ] **AC-5 (idempotent / never-clobber):** Reinstalling does not duplicate the `b` or the edge; an operator who has manually re-pointed a header's `b` is not clobbered (inherited from the Story-38 primitive).
- [ ] **AC-6 (pin-verify is graceful, seed still happens):** Given the fetched canonical header's id does **not** match the `knownGoodEventId`, when install runs, then the foreign-header materialization is logged-and-skipped but the local pointer-`b` is **still** seeded from the manifest `headerATag` literal (per ADR 0034 OQ-1 — the pointer carries zero consensus weight).
- [ ] **AC-7 (David verification breadcrumb):** The PR description carries a prominent, explicit note to David that this ships **one** pointer-`b` per local header (our ratified design), flags his "two b-tags" phrasing as the open question, and gives a concrete breadcrumb of exactly what he'd change to alter the shape (which manifest field, which `buildImportCypher` branch, which emitter line).

## Concepts touched

- `39998:82b75e47…:tag` / `…:nostr-user-tag` / `…:tag-pinning` — the canonical headers (pin targets, read-only here).
- The local TA headers for the same three slugs — gain the pointer-`b` + derived lineage edge.

## Out of scope

- **The dual-z writer (W11)** and the local concept *list* populating with new activity — **Story 3 (Part B)**.
- Migrating existing single-z tag events.
- Any change to the b-tag primitive itself (Story 38, done) or to `nostr-relay`.

## Open questions

1. **For the Architect — pin freshness.** The three `knownGoodEventId`s were captured 2026-06-17. If a canonical header is re-published before this ships, the pin would mismatch and (per AC-6) the seed still happens but foreign-materialization skips. Confirm whether to re-capture at implementation time or accept the graceful-skip.
2. **For the Architect — `tag-pinning` parent shape.** Confirm `tag-pinning`'s canonical header is the right pin target (it's the third ADR-0015 legacy-coordinate concept; verify its local header is TA-authored like the other two).

## Linked artifacts

- Epic: `engineering-team/epics/tag-federation.md`. Handoff: `docs/B_TAG_HALF_2_HANDOFF.md` (§4 Story 3, Part 2). Prereq: `engineering-team/stories/community-reference/38-b-tag-primitive-emitter-derivation.md` (Done).
- ADR: `engineering-team/decisions/tag-federation/0002-per-concept-b-tag-seeds.md`
- Test plan: `engineering-team/stories/tag-federation/2-per-concept-b-tag-seeds.test-plan.md`
- Review: (filled in after Review phase)
