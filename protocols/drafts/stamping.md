> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Implementation (reference deployment):** the personal+shared two-`z` shape is **partially implemented** for tag events (`tag-federation` ADR 0003 dual-`z` writers; pin events still carry a single shared `z`). **Cloud stamping is unimplemented** — it is gated on the [Shared Concepts](./shared-concepts.md) resolver, which exists on no deployment.
> **Sources:** `community-reference` ADR 0033 (the ratified convention; graduated worksheet W11); [tapestry-concepts.md](./tapestry-concepts.md) § "Multi-`z` stamping" (extraction origin, per `nip-reorg` ADR 0003); `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` (D1 rev 2 — the local-first constraint); `docs/NIP_REORG_DESIGN_HANDOFF.md`; `w14-settlement` ADR 0001 (layer-selection settlement + Reach).

---

Stamping: z-tag selection for published list items
=====

**Stamping** is the act of choosing the set of `z` tags a deliberately-published list item carries — its personal parent pointer plus the shared-concept handles that make it discoverable by others. This NIP specifies the write rule, the re-stamping behavior, and the contract a reader may rely on. It defines **no new wire format**: the `z` tag and its a-tag value form belong to [Decentralized Lists](../nips/decentralized-lists.md) and [Tapestry Concepts](./tapestry-concepts.md); the shared handles a stamp names are resolved through the `b`-graph per [Shared Concepts](./shared-concepts.md); subset/superset structure rides `s` (and membership `n`) per [Class Thread Relationships](./class-thread-relationships.md).

The base NIP permits multi-`z` items while recommending one `z` per event as default practice. This convention deliberately takes the multi-stamp path for items published for community visibility, because read-side derivation cannot reach items whose personal headers are unpublished — **local-first publication**: most personal headers never leave their author's local relay, so a published item must be self-contained to be discoverable.

This convention addresses items their author intends to be public and discoverable. An author with narrower disclosure intent adjusts or omits shared stamps accordingly — nothing here obliges publication.

## The write rule

A deliberately-published item carries:

1. **Its personal `z` — required, at least one.** The author's own parent pointer per the base NIP ([Decentralized Lists](../nips/decentralized-lists.md) § Item declaration). It MAY point at a header the author keeps private; the stamp is still required, because the item — not the header — is what must be self-contained.
2. **Plus up to a cap of shared handles — the author's cloud, affiliation-anchored.** The additional stamps name headers in the cloud of the community the author **declared** affiliation with (reached via the author's own pointer-`b` — [Shared Concepts](./shared-concepts.md) § Declared affiliation), **never** a concept-global top-k: an item carries its author's declared associations and is not silently routed into a community they never chose. The cloud itself — what it is, how an observer resolves it, how it rotates — is specified in [Shared Concepts](./shared-concepts.md) § Clouds and not restated here.

3. **Optionally, within the cap: demand-selected extras.** Additional intersections — handles of ancestor set-layers (reached by walking the derived superset structure, [Class Thread Relationships](./class-thread-relationships.md)) × branch layers within the author's **reach** ([Shared Concepts](./shared-concepts.md) § Reach) — selected by **anticipated filter demand**: stamp the layers other users and clients will plausibly filter against. **Ancestors are never required**; extras are a discoverability optimization, not membership. A publisher SHOULD stamp only handles within its reach; readers do not enforce this (see the read contract).

**`z` order is not load-bearing.** A `#z` filter matches any value regardless of position; listing highest-deference-rank-first is informational only, and consumers MUST NOT depend on order.

*Design-only status: the cloud-stamping half of this rule is ratified design (`community-reference` ADR 0033), not yet wired — it reads the observer-resolved deference signal, whose resolver exists on no deployment; implementation is gated on on-wire inherit-typed `b` tags. The exact cap (~5), the ranking formula, and the firmware cold-start cluster contents are deliberately deferred to that implementation.*

## Re-stamping

When the author's cloud has rotated far enough that the author cares, they republish the item at its same `d`-address (kind `39999`) with fresh stamps — **lazy author re-emit**. Nobody detects rotation on the author's behalf — rotation is emergent and observer-recomputed ([Shared Concepts](./shared-concepts.md) § Clouds).

Accepted lossiness, named: **foreign-authored items** cannot be re-stamped (only the author can re-sign); an **inactive author's** items fade from discoverability as the cloud rotates away from their stamps; **kind-`9999`** (non-addressable) items cannot be re-stamped at all — a stated reason to prefer kind `39999` for stamped items.

## Boundary: containment vs. membership

This convention is for **containment items** — an item joining a concept's list. A **membership assertion** (asserting that a pubkey belongs to a community) keeps its **single shared applied-concept handle** — the "tag against it" design consumed by [Communities](./communities.md) via [Tags & Taggings](./tags.md). The two mechanisms do not overlap: an assertion's reference to the concept it applies is never cloud-expanded.

## The read contract

What a conforming reader MAY assume, and must not:

- **MAY assume:** every deliberately-published item carries at least one `z`, and is self-contained — its stamps are sufficient to place it without fetching its author's (possibly private) headers.
- **MUST NOT rely on:** `z` order (above); stamps reflecting the author's *current* cloud (staleness is designed in — re-stamping is lazy); **ancestor stamps existing** — they are the *optional* tier of the write rule (item 3), never guaranteed; or any single shared handle's `#z` index being complete — different authors affiliate with different clouds, and clouds are an observer's view ([Shared Concepts](./shared-concepts.md) § Terminology).
- **MAY infer (capability-dependent):** a reader able to expand queries MAY recover omitted stamps — inferring set layers by walking derived `IS_A_SUPERSET_OF` structure ([Class Thread Relationships](./class-thread-relationships.md), under its security gates: authorship-gated, from the reader's own observer position) and branch handles by walking the `b` graph — the author's reach ([Shared Concepts](./shared-concepts.md) § Reach). A reader MUST NOT assume *other* consumers perform inference — plain `#z` filtering is the interop floor.
- **Breadth queries MUST expand:** a reader wanting "all X including subsets" MUST walk the derived `IS_A_SUPERSET_OF` structure ([Class Thread Relationships](./class-thread-relationships.md)) and union `#z` queries per subset — or knowingly accept the **defined floor**: a non-expanding client sees the direct layer's members only. That floor is a specified outcome of this contract, not a defect.
- **Query strategy that follows:** to gather a shared concept's items, resolve the concept's cloud from your own observer position ([Shared Concepts](./shared-concepts.md) § Clouds) and union `#z` queries across those handles; for exhaustive discovery, additionally walk the correspondence graph (pointer- and inherit-typed `b`, [Shared Concepts](./shared-concepts.md) § Aggregated deference) and union the corresponding headers' `#z` indexes too.

## Layer selection (set × branch) — settled

*Settled 2026-07-13 (protocol-spec ratification; worksheet [W14](../worksheet.md#w14--subsetancestor-stamping-z-expansion-across-class-thread-structure) resolved; `w14-settlement` ADR 0001). The framing below is normative context for the write rule's optional tier.*

**The valid-`z` space has two axes.** Every possible stamp sits at the intersection of a **set layer** — the ladder of derived superset structure (`s` tags, fine-grained → coarse-grained; the ladder is **dynamic**: rungs appear over time, so no write-time selection stays complete) — and a **branch layer** — the shared headers within the author's reach at that layer, ordered proximal → distal ([Shared Concepts](./shared-concepts.md) § Reach).

**The rule.** The required floor is write-rule items 1–2 (personal `z` + the joined concept's cloud handles). Item 3 permits demand-selected extras from ancestor layers × reached branches, within the cap. **Ancestors are never required** — the dynamic ladder makes write-time completeness unachievable in principle, cap pressure is real (~2 slots per chain level before any cloud redundancy), and staleness heals only by lazy re-emit.

**The stakes it settles: smart clients recover omissions; non-expanding clients see the defined floor.** Stamps and read-time inference are two recovery paths for the same information; which one a client uses depends on its capability. The write-time selection sets the interop floor for non-expanding clients — a plain `#z` filter sees exactly what was stamped — and the read contract makes that floor explicit: breadth requires expansion.
