> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Implementation (reference deployment):** the personal+shared two-`z` shape is **partially implemented** for tag events (`tag-federation` ADR 0003 dual-`z` writers; pin events still carry a single shared `z`). **Cloud stamping is unimplemented** — it is gated on the [Shared Concepts](./shared-concepts.md) resolver, which exists on no deployment.
> **Sources:** `community-reference` ADR 0033 (the ratified convention; graduated worksheet W11); [tapestry-concepts.md](./tapestry-concepts.md) § "Multi-`z` stamping" (extraction origin, per `nip-reorg` ADR 0003); `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` (D1 rev 2 — the local-first constraint); `docs/NIP_REORG_DESIGN_HANDOFF.md`.

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
- **MUST NOT rely on:** `z` order (above); stamps reflecting the author's *current* cloud (staleness is designed in — re-stamping is lazy); **ancestor stamps existing** — whether an item joining a subset also stamps its superset chain is an open question (§ "Open: which layers to stamp"); or any single shared handle's `#z` index being complete — different authors affiliate with different clouds, and clouds are an observer's view ([Shared Concepts](./shared-concepts.md) § Terminology).
- **MAY infer (capability-dependent):** a reader able to expand queries MAY recover omitted stamps — inferring set layers by walking derived `IS_A_SUPERSET_OF` structure ([Class Thread Relationships](./class-thread-relationships.md), under its security gates: authorship-gated, from the reader's own observer position) and branch handles by walking the `b` graph ([Shared Concepts](./shared-concepts.md)). A reader MUST NOT assume *other* consumers perform inference — plain `#z` filtering is the interop floor.
- **Query strategy that follows:** to gather a shared concept's items, resolve the concept's cloud from your own observer position ([Shared Concepts](./shared-concepts.md) § Clouds) and union `#z` queries across those handles; for exhaustive discovery, additionally walk the correspondence graph (pointer- and inherit-typed `b`, [Shared Concepts](./shared-concepts.md) § Aggregated deference) and union the corresponding headers' `#z` indexes too.

## Open: which layers to stamp (set × branch)

*This section states an open design question; nothing in it is normative. Tracked as worksheet [W14](../worksheet.md#w14--subsetancestor-stamping-z-expansion-across-class-thread-structure). Framing refined 2026-07-12 from the protocol author's scoping notes.*

**The valid-`z` space has two axes.** For an item joining a concept, every candidate stamp sits at the intersection of:

- **A set layer** — climbing the ladder of derived superset structure (`s` tags, [Class Thread Relationships](./class-thread-relationships.md)): *dogs ⊂ vertebrates ⊂ animals ⊂ organisms ⊂ things*. Along a chain, layers order **fine-grained → coarse-grained**. (Incomparable layers — neither a subset of the other — exist and are permitted; ignored here.) **The ladder is dynamic**: rungs appear (a *vertebrates* division absent today may exist tomorrow; *dogs* may sprout *sheep dogs*), so no write-time selection stays complete.
- **A branch layer** — for each set layer, the shared headers reachable through the author's own `b` graph, **directly or indirectly**: the author's personal header (most **proximal**), through intermediate correspondents, out to widely-shared community headers (most **distal**). Reach is **affiliation-backed, never free-floating**: a handle with no `b`-path from the author's own header is not a candidate stamp. (The precise reach semantics — which `b` types carry affiliation transitively, i.e. whether a *correspondence closure* mirrors [Inherit-From](./inherit-from.md)'s inherit-typed deference closure — are themselves unspecified, and part of this question.)

**Worked example.** Alice publishes an item into *Widgets for Carpenters* (⊂ *Widgets*). Under the write rule above she stamps her personal `z` plus Widgets-for-Carpenters branch handles. Open: does the item also stamp *Widgets*-layer handles — and which branches of them?

**Candidate selection principles**, none normative:

- **(a) Anticipated filter demand — set axis.** Stamp the layers other users and clients will plausibly filter against: if you expect one client to compile *sheep dogs* and another *vertebrates*, and want the item on both lists, stamp both. Cost: demand is speculative and time-varying, and the dynamic ladder means today's selection can't anticipate tomorrow's rungs.
- **(b) Proximal + distal endpoints — branch axis.** For each selected set layer, stamp the most proximal and most distal branch layers. At the joined layer this reproduces the shape the ratified write rule already fixes: personal `z` (proximal) + affiliation-anchored cloud handles (distal).
- **(c) Anticipated filter demand — branch axis.** Stamp the shared handle a particular community's tooling is known to filter against (e.g. a widely-used Spanish-language shared DList header) — valid only where the author's `b` graph reaches that header, per the reach rule above.
- **(d) Read-time inference as the complement.** A capable reader recovers any omitted intersection by walking `s` and `b` (see the read contract). Stamps and inference are two recovery paths for the same information; which one a client uses depends on its capability — "which is the source of truth" is the wrong question.

**The stakes, precisely: smart clients recover omissions; dumb clients don't.** The write-time selection sets the **interop floor for non-expanding clients** — a plain `#z` filter sees exactly what was stamped, nothing more. Pulling against exhaustive stamping: the dynamic ladder (write-time completeness is unachievable in principle), cap pressure (~2 slots per chain level before any cloud redundancy), and lazy-heal-only staleness. Pulling toward more stamping: every omitted layer is invisible at the floor.

Whichever selection rule lands MUST co-state its read contract — what non-expanding readers may assume stamped — because the write rule and the read assumption are two halves of one interoperability contract.
