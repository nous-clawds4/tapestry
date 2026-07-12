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

## The write rule

A deliberately-published item carries:

1. **Its personal `z` — required, at least one.** The author's own parent pointer per the base NIP ([Decentralized Lists](../nips/decentralized-lists.md) § Item declaration). It MAY point at a header the author keeps private; the stamp is still required, because the item — not the header — is what must be self-contained.
2. **Plus up to a cap of shared handles — the author's cloud, affiliation-anchored.** The additional stamps name headers in the cloud of the community the author **declared** affiliation with (reached via the author's own pointer-`b` — [Shared Concepts](./shared-concepts.md) § Declared affiliation), **never** a concept-global top-k: an item carries its author's declared associations and is not silently routed into a community they never chose. The cloud itself — what it is, how an observer resolves it, how it rotates — is specified in [Shared Concepts](./shared-concepts.md) § Clouds and not restated here.

**`z` order is not load-bearing.** A `#z` filter matches any value regardless of position; listing highest-deference-rank-first is informational only, and consumers MUST NOT depend on order.

*Design-only status: the cloud-stamping half of this rule is ratified design (`community-reference` ADR 0033), not yet wired — it reads the observer-resolved deference signal, whose resolver exists on no deployment; implementation is gated on on-wire inherit-typed `b` tags. The exact cap (~5), the ranking formula, and the firmware cold-start cluster contents are deliberately deferred to that implementation.*

## Re-stamping

When the author's cloud has rotated far enough that the author cares, they republish the item at its same `d`-address (kind `39999`) with fresh stamps — **lazy author re-emit**. Nobody detects rotation on the author's behalf; the author (at write time) and any consumer (at read time) each simply recompute.

Accepted lossiness, named: **foreign-authored items** cannot be re-stamped (only the author can re-sign); an **inactive author's** items fade from discoverability as the cloud rotates away from their stamps; **kind-`9999`** (non-addressable) items cannot be re-stamped at all — a stated reason to prefer kind `39999` for stamped items.

## Boundary: containment vs. membership

This convention is for **containment items** — an item joining a concept's list. A **membership assertion** (asserting that a pubkey belongs to a community) keeps its **single shared applied-concept handle** — the "tag against it" design consumed by [Communities](./communities.md) via [Tags & Taggings](./tags.md). The two mechanisms do not overlap: an assertion's reference to the concept it applies is never cloud-expanded.

## The read contract

What a conforming reader MAY assume, and must not:

- **MAY assume:** every deliberately-published item carries at least one `z`, and is self-contained — its stamps are sufficient to place it without fetching its author's (possibly private) headers.
- **MUST NOT rely on:** `z` order (above); stamps reflecting the author's *current* cloud (staleness is designed in — re-stamping is lazy); **ancestor stamps existing** — whether an item joining a subset also stamps its superset chain is an open question (§ "Open: subset/ancestor stamping"); or any single shared handle's `#z` index being complete — different authors affiliate with different clouds, and clouds are an observer's view ([Shared Concepts](./shared-concepts.md) § Terminology).
- **Query strategy that follows:** to gather a shared concept's items, resolve the concept's cloud from your own observer position ([Shared Concepts](./shared-concepts.md) § Clouds) and union `#z` queries across those handles; for exhaustive discovery, additionally walk the correspondence graph (pointer- and inherit-typed `b`, [Shared Concepts](./shared-concepts.md) § Aggregated deference) and union the corresponding headers' `#z` indexes too.

## Open: subset/ancestor stamping

*This section states an open design question; nothing in it is normative. Tracked as worksheet [W14](../worksheet.md#w14--subsetancestor-stamping-z-expansion-across-class-thread-structure).*

Concepts form subset structure via `s` tags ([Class Thread Relationships](./class-thread-relationships.md)): *Widgets* is a superset of *Widgets for Carpenters* and *Widgets for Electricians*. Alice publishes an item into *Widgets for Carpenters*. Under the write rule above she stamps her personal `z` plus Widgets-for-Carpenters cloud handles. **Does the item also stamp *Widgets*?** Candidate shapes:

- **(a) Read-time expansion (stamp the joined concept only).** Readers wanting "all Widgets" walk the derived `IS_A_SUPERSET_OF` structure and union `#z` queries per subset. Honest to the *live* hierarchy — a re-parented subset is immediately reflected — but relays cannot do transitive queries, so breadth costs one query per subset.
- **(b) Write-time ancestor stamping.** The item carries the ancestor chain's handles too (Alice's example: 4+ `z` tags), so a single `#z` filter finds all Widgets. The costs: hierarchy is denormalized into signed history — re-parenting strands stale stamps, healing is lazy-re-emit-only (foreign-authored and inactive authors' items never heal), and cap pressure is real (roughly two slots per chain level before any cloud redundancy).
- **(c) Hybrids.** E.g. stamp the joined concept plus the root superset only; or cap-aware truncation preferring nearest ancestors.

Whichever shape lands MUST co-state its read contract — whether readers may assume ancestor stamps exist, or must expand queries — because the write rule and the read assumption are two halves of one interoperability contract.
