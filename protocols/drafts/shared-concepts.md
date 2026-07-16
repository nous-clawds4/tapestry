> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Implementation (reference deployment):** the **pointer-`b` affiliation seed** is **implemented** (firmware emitter — `community-reference` ADR 0034, applied to the tag concepts via `tag-federation` ADR 0002). The **resolver, deference aggregation, and cloud computation** (§ "Aggregated deference", § "Clouds") are **not implemented** on any deployment; the cloud model is ratified design (`community-reference` ADR 0033), gated on on-wire inherit-typed `b` tags.
> **Sources:** `community-reference` ADR 0033 (cloud formation; graduated worksheet W11); [inherit-from.md](./inherit-from.md) § "Aggregation" (origin of the migrated aggregation text, per `nip-reorg` ADR 0001); worksheet [W1](../worksheet.md#w1--cross-deployment-concept-identity); `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`; `docs/NIP_REORG_DESIGN_HANDOFF.md`.

---

Shared Concepts
=====

This NIP defines the **policy layer** by which independent authors converge on **shared concepts** — concepts whose handles are in conventional use beyond their original author. It specifies **no new wire format**: everything here rides the `z` parent pointer ([Decentralized Lists](../nips/decentralized-lists.md), [Tapestry Concepts](./tapestry-concepts.md)) and the typed `b` tag ([Inherit-From & Resolved Definition](./inherit-from.md)). What this NIP adds is the *reading*: how affiliation is declared, how deference is aggregated, and how an observer resolves which headers a shared concept has converged on.

## Terminology

Three terms, one per referent — signal, process, outcome:

- **Deference** — the claim carried by an inherit-typed `b` tag: "my definition is this parent's, unless I state otherwise." Deference is the **aggregable signal**: it is explicit, signed, revocable, and costly in the sense that it subscribes its author to the parent's future edits (see [Inherit-From](./inherit-from.md) § Security considerations).
- **Convergence** — the **process** by which shared conventions arise: gradual, measurable in degree, and never final. Convergence increases as independent authors defer to (or affiliate with) the same definition, and it can shift.
- **Convention** — the **outcome**: a handle is *in conventional use* when independent authors affiliate with it and defer to it. A **shared concept** is a concept whose handle is in conventional use.

(A fourth, graph-shaped term — **reach**, the any-type transitive `b` closure — is defined in § "Reach".)

**The observer-relative rule (normative).** Every aggregate defined in this specification is **an observer's view** — computed from the events that observer has seen, weighted from that observer's point of view. Nothing in this NIP defines, and no conforming implementation may present, a global fact about *the* community's definition. Two observers MAY legitimately resolve different clouds for the same concept, and both are correct.

## Relationship to other specs

- [Decentralized Lists](../nips/decentralized-lists.md) supplies the kinds and the `z` parent pointer; [Tapestry Concepts](./tapestry-concepts.md) constrains `z` to the a-tag form and defines concept anatomy. This NIP treats "concept" in their sense.
- [Inherit-From & Resolved Definition](./inherit-from.md) supplies the **primitive** this NIP consumes: the typed `b` tag and its resolution semantics. This NIP defines no `b` semantics of its own — only the aggregate reading of `b`-derived edges.
- [Class-thread membership tags](./class-thread-relationships.md) (`n`, `s`) express structure *within* a curator's graph; they are orthogonal to this NIP's cross-author policy and appear here only in discovery-walk examples.
- Downstream consumers: [Tags & Taggings](./tags.md) and [Communities](./communities.md) apply shared concepts to specific domains; the multi-`z` stamping convention for published items is specified in [Stamping](./stamping.md).

## Declared affiliation

An author affiliates their own header with a shared definition by carrying a **pointer-typed `b` tag** on it, naming the shared header's a-tag — wire format specified once, in [Inherit-From](./inherit-from.md) § "The `b` tag".

Affiliation is **navigation, not agreement**: it says "my concept corresponds to that one," names the community the author has chosen, and gives consumers a path to walk — while carrying no deference, no trust-coupling, and **zero aggregation weight** (v1 — § "Aggregated deference"). Affiliation is the author's own declaration; no third party can affiliate a header the author didn't sign. Affiliation is the **single hop**; the transitive candidate set it opens is defined in § "Reach".

In the reference deployment, a cold-start affiliation is **seeded** at firmware install — a pointer-typed `b` published on the deployment's own header, targeting the concept named by the firmware manifest (`community-reference` ADR 0034; applied to the tag concepts by `tag-federation` ADR 0002). A seed is an affiliation like any other: pointer-typed, never deference.

## Deference

An author defers to a shared definition by carrying an **inherit-typed `b` tag** — live definitional deference, with the override and resolution semantics specified in [Inherit-From](./inherit-from.md). Deference is the strong claim: it couples the child to the parent's future edits, which is exactly why it is the signal worth aggregating and why it must be explicit (an absent type reads as `"pointer"`, never as deference).

This NIP adds nothing to the per-node semantics; it defines only what the *aggregate* of many authors' deference means to an observer.

## Aggregated deference (observer-resolved)

Because `b`-derived relationships point child→target, a target's **incoming** edges enumerate its relationships — but the two `b` types feed **different questions**:

- **Deference aggregation** counts **inherit-typed edges only**: a target's incoming `INHERITS_FROM` edges enumerate exactly "everyone who defers to this definition" — a signal the observer weighs (in the reference deployment, by each deferring author's GrapeRank influence from the observer's point of view) and ranks. Pointer-typed edges carry **zero weight** (v1): a bookmark is not agreement, and counting it would let seeded or casual correspondence masquerade as deference.
- **Discovery walks** include **both types**: "enumerate the headers that point at this definition" (e.g. to union their items' `#z` indexes) wants every correspondence claim, pointer and inherit alike.

Relay-side mechanics (the `#b` filter returns both types; consumers filter locally) are specified with the primitive — [Inherit-From](./inherit-from.md) § "Aggregation".

## Reach

Three constructs read the `b` graph, one per relation:

| Construct | Edges | Transitive? | Feeds |
|---|---|---|---|
| **Affiliation** | the author's own pointer-typed `b` (§ "Declared affiliation") | no — one declared hop | navigation; cloud anchoring |
| **Deference closure** | inherit-typed only ([Inherit-From](./inherit-from.md) § "Resolution: the resolved definition") | yes — pointer breaks the chain | resolution; deference aggregation |
| **Reach** | **both** types | yes | stamp selection ([Stamping](./stamping.md)) |

An author's **reach** is the set of headers connected to the author's own header through `b` edges of *either* type, followed transitively — the author's own edges and third parties' alike. Like the other closures it is computed on read, never stored; membership is a set (cycles are benign; order carries no meaning).

Two properties are normative:

- **Reach is permission-shaped, never action-shaped.** A third party's edge can *expand* an author's reach — opening a handle as a candidate stamp — but nothing in reach acts on the author's behalf: the author selects which reached handles to stamp, at write time, on their own signed item. Growth of the graph enables; it never routes.
- **Reach binds publishers, not readers.** A publisher SHOULD stamp only handles within its reach — that is what keeps every stamp traceable to published `b` edges. A reader MUST NOT treat an out-of-reach stamp as invalid: there is no global stamp validity to check, path existence is view-dependent, and spam control belongs to observer-weighted trust (§ "Aggregated deference"), not to path validation.

Reach, like every construct in this specification, is **an observer's view**: it is computed from the `b` events the walker has seen, so two walkers MAY compute different reach for the same author, and both are correct. Reach is consumed by [Stamping](./stamping.md) § "The write rule".

## Clouds

The **cloud** of headers for a shared concept is the **derived top-k of an observer's aggregated deference** for that concept. Properties, all ratified (`community-reference` ADR 0033):

- **Never a published object.** There is no signed "cloud" event, no manifest, no curator — a published membership list would reintroduce a privileged center. The cloud exists only as a computation an observer (or an author, at write time) performs.
- **Membership is deference rank.** Mutual pointer-typed `b` edges among a concept's authors are the author's **navigation** to the cloud — follow your header's `b` to the community it points at — **not** a membership gate.
- **Rotation is emergent.** Nobody governs membership; it changes as the signal changes, and there is nothing to "detect" — an author (at write time) and a consumer (at read time) each simply recompute.
- **Selector precedence:** *deference-resolved top-k* (the observer's trust-weighted aggregate — "grapevine-resolved" in the reference deployment) → *firmware-blessed cluster* (cold start) → *none*.
- **Bootstrap from a singleton.** An organic concept's cloud begins as its founder's header alone and thickens as deference accumulates.

*Design-only status: the resolver and cloud computation exist on no deployment; implementation is gated on on-wire inherit-typed `b` tags. The exact cap (~5), the ranking formula, and the firmware cold-start cluster contents are deliberately deferred to implementation (`community-reference` ADR 0033).*

## Cross-deployment identity

Concept handles embed their publisher's pubkey (`39998:<pubkey>:<slug>`), so every event that joins a concept via `z` bakes that pubkey into signed history — and a universal spec cannot hardcode one deployment's key. **How independent deployments and implementations agree on which header a shared concept converges on is an open protocol problem**, tracked as worksheet [W1](../worksheet.md#w1--cross-deployment-concept-identity). The trajectory:

1. **Firmware-blessed pointer** — a centralized editorial cold start, accepted temporarily (the seed of § "Declared affiliation").
2. **Registry-as-DList** — the per-concept pointer becomes a community-curated, observer-ranked DList.
3. **Deference aggregation** — this NIP's clouds: "which definition the authors my web of trust ranks actually defer to." Candidate end state.

This specification defines the aggregate machinery; it does not resolve W1.

## Security considerations

**Correspondence must never masquerade as deference.** Affiliation is cheap by design — seedable by firmware, publishable in bulk, revocable without cost — so any aggregate that counted pointer-typed edges would let a deployment or a spammer manufacture apparent convergence out of bookmarks. Hence the hard rule inherited from the primitive: only explicitly **inherit-typed** edges enter deference aggregation; absent or pointer types carry zero weight (v1).

**Observer weighting is the second gate.** Deference aggregation ranks the *deferring authors* from the observer's point of view: convergence among authors the observer's web of trust ranks at zero contributes nothing to that observer's cloud. A sybil flock deferring to its own header converges only for observers who trust the flock.
