# ADR 0032: Resolved-definition cache — deployment-side materialization design

**Status:** Accepted
**Date:** 2026-06-13
**Story:** `engineering-team/stories/community-reference/36-resolved-definition-cache-design.md`
**Builds on / supersedes the punt of:** ADR 0028 (Resolved Definition — its "Caching … out of scope" deferral is the thing this ADR fills in); related ADR 0029 (the inherit-typed `b` is the materialization trigger).
**Design source:** [docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md](../../../docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md) (D6, H1, O8) — all three planning-gate items resolved by the protocol author 2026-06-13 (cache architecture only; optional MAY; expand BIBLE §26 in place).
**Citation hygiene:** cite as **community-reference ADR 0032** with the epic-scoped path.

## Context

The resolved definition (ADR 0028) is **computed on read** by a live merge-walk over a node's inherit-typed `b` deferences — never snapshotted into the node, so a child tracks its parents' future edits. That liveness has a cost ADR 0028 named and deferred: a per-read closure walk. The b-tag affiliation design (handoff D6) settled how the "read one event for the resolved definition, no repeated re-resolution" performance goal is met — a **deployment-side materialized cache**, with **zero wire change** — and ADR 0028 already carved the room for it ("Caching is a consumer/performance concern, out of scope here").

This ADR **ratifies that cache as design only**. It is deliberately not implemented: the resolved-definition **resolver itself does not exist** (zero `INHERITS_FROM` in source; ADR 0028 §"Out of scope" defers "any actual merge-walk implementation, Neo4j/query work, materialization, caching" as a future story), and a resolver does meaningful work only once `b`-tags exist on-wire — gated on the seeding code story, gated on the three-branch reconciliation (handoff O7). The architecture is captured now, while the reasoning is fresh; the code lands later, on the resolver, when those gates clear.

Constraints: deployment-side behavior is **BIBLE territory**, not `protocols/` (the wire rule "never snapshotted" already stands in `inherit-from.md`, unchanged); the design must be **honestly framed as target/not-wired** (the §27 / ADR 0030 precedent); **no source files** change. Concept graph: nothing touched; **no firmware reinstall**.

## Options considered

### Option A — deployment-side materialized cache, semantically transparent (chosen)
The instance maintains a materialized resolved definition (Neo4j) for nodes that opt into deference, refreshed as ancestors edit; reads hit the cache instead of walking. The cache is an **optimization over** Option C, never a replacement for its semantics.
*Pros:* meets the read-one performance goal with zero wire change; composes from machinery that already exists; the liveness semantics of ADR 0028 are preserved exactly (the cache is an accelerator, not a new source of truth).
*Cons:* introduces a staleness surface that must be provably transparent (addressed by the invariant + backstop below); designed ahead of the resolver it accelerates.

### Option B — on-wire self-contained snapshot (republish resolved fields into the header)
Publish the resolved definition back into the header event as stated fields, so any reader gets a one-event answer without a walk.
*Cons (fatal — the override-masquerade hazard, handoff H1):* under the resolution rule "own stated fields win," republished inherited fields are indistinguishable from deliberate overrides — they freeze the parent's future edits until the next sync and misrepresent authorial intent to every third-party resolver. This is IMPORT's quadrant (absorb + importer-authoritative), not the wanted "defer; parent stays authoritative." **Deferred** (handoff O8); the safe future path, if a real offline-resilience consumer ever appears, is a stated-vs-synced field marking at `inherit-from.md`'s open payload-binding item ("which parts of a node's `json`-tag payload participate in resolution — not yet formalized"). Not designed here.

### Option C — no cache; always live-walk on read (the ADR 0028 status quo)
*Role:* this is the **semantic floor**, not a rejected rival. Pure on-read resolution is always correct and always valid; the Option-A cache must be **indistinguishable from it**. "No cache" remains a conforming deployment posture — hence Option A is a **MAY**, not a requirement.

## Decision

We chose **Option A**, design-only, with these fixed points:

1. **Semantic-transparency invariant (cardinal).** The cache is a deployment-side performance optimization that **MUST NOT** change what any node's definition resolves to. ADR 0028's on-read live resolution stays authoritative; a cache miss, a stale entry, or a cold cache can never yield a different answer than a fresh walk. Equivalently: a conforming deployment may delete the entire cache at any instant with no observable change but latency (this is Option C, the floor).
2. **Optionality — MAY.** A deployment MAY maintain the cache; it is a transparent performance choice, not a protocol requirement. Nothing on the wire signals whether a deployment caches.
3. **Materialization trigger.** The cache is maintained for nodes carrying an **inherit-typed** `b` (per ADR 0029) — the only nodes whose definition is non-trivially resolved. Pointer-typed `b` tags do **not** trigger materialization (they carry no deference; they derive `REFERENCES`, not `INHERITS_FROM`, and never enter the closure).
4. **Refresh model — event-driven + periodic backstop.** Refresh on observed parent edits (the live path), **plus** a periodic full re-resolve backstop. This is the reconciliation lesson, binding here: per ADRs 0018/0020, the live stream is lossy and *"consistency must re-derive edges, not trust bookkeeping"* — an "id matches ⟹ cache fresh" fast-path is unsound (a parent can carry the correct latest event id yet have produced a resolved value the cache never recomputed). The backstop re-derives; it never trusts a version-id match alone.
5. **On-wire-snapshot boundary (load-bearing safety property).** The materialized definition lives **only deployment-side (Neo4j)**. It is **never** republished into the header event as stated fields — that is Option B / hazard H1. The wire rule "computed on read … never snapshotted into the node" (`inherit-from.md`, unchanged) is what keeps the cache honest: the cache is invisible on the wire, so it cannot leak override-masquerade to other resolvers.
6. **Composes from existing machinery (named, not built).** A future implementation would draw on: the `pass_communityReferences` fetch→publish→materialize sequence (the proven foreign-event→Neo4j path); the strfry-router remote-subscription layer (carrying ancestors' edits in); BullMQ Job Schedulers (the periodic re-resolve backstop, with the neo4j-heavy semaphore); the **owner-consent / on-demand-pull** posture of ADR 0010 (a deliberate "resolve now" action, consent over auto-pull); and ADR 0006's deferred **element/superset materialization stream** (BIBLE §5) as the natural conceptual slot.
7. **Honest target/not-wired framing.** The BIBLE §26 expansion is marked **Target (design — ADR 0032)**: no resolver and no cache exist; implementation is gated on the resolver (unbuilt) and on-wire `b`-tags (gated on the three-branch reconciliation). It is the designated flip site when those land.

## Consequences

- **Completes** the handoff's P1–P4 ratification plan on paper; gives the eventual resolver implementation a settled cache design to build to, with the transparency invariant and the on-wire boundary fixed in advance (the two things easiest to get wrong under deadline).
- **Constrains:** the future resolver story inherits the backstop requirement (no id-match fast-path) and the never-on-wire boundary as hard acceptance criteria; the cache may never become a wire artifact without a separate ADR designing the stated-vs-synced marking (O8).
- **New debt / follow-ups:** the resolver + cache **code** (future, gated); the on-wire synced-snapshot design (O8, deferred behind H1); any eviction/TTL policy is left to the implementation (the invariant makes eviction always-safe, so no protocol-level policy is needed).
- **Firmware reinstall required?** No — documents only.

## Implementation notes

Docs-mode; `npm test` stays green; no source files. Cite **community-reference ADR 0032** (epic-scoped). Sites:

- **`BIBLE.md` §26 (Resolved Definition)** — replace the current bullet *"**Caching** is a consumer/performance concern, out of scope here. See ADR 0028 …"* (≈line 1532) with a **Target (design — ADR 0032)** subsection capturing fixed points 1–6: the cache is an optional (MAY), deployment-side, semantically-transparent materialization for inherit-typed nodes; refresh = event-driven + periodic re-derive backstop (cite the ADRs 0018/0020 "re-derive, don't trust bookkeeping" lesson); the cache is **never** republished on-wire (H1 boundary; the on-wire variant is deferred — O8); names the composing machinery. Keep the deleted bullet's surviving content (the rejected WoT-weighted field resolution stays an ADR 0028 reference). Mark it not-wired (no resolver/cache exist) per the §27 precedent visible at §27 lines ~1540.
- **`docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`** — §5 table: annotate P4 ratified (design-only; `community-reference` ADR 0032 / story #36); §4: note O8 stays deferred (boundary stated, variant not designed). This completes P1–P4; the doc MAY now be considered for the SUPERSEDED flip — but defer that to a deliberate close-out (the gated code stories remain), so leave the header 🔴 OPEN and note "P1–P4 ratified; implementation gated."
- **Checked clean / untouched:** `protocols/` (deployment behavior is BIBLE territory; the wire rule in `inherit-from.md` is unchanged and already correct); `src/` (no code — verify by diff); ADR 0028 and all prior stories/reviews (immutable — ADR 0028's "out of scope" line stays as the historical punt this ADR supersedes by reference, not by editing 0028's body); a header **Amended by** pointer on ADR 0028 noting ADR 0032 fills its caching deferral.

## Out of scope

- **All code** — the resolver (merge-walk), the materialization/refresh implementation, the cache — future engineering stories gated on the resolver and on-wire `b`-tags.
- The **on-wire synced-snapshot** variant + stated-vs-synced field marking (O8 / H1) — deferred; only the boundary is stated.
- Eviction/TTL policy (implementation detail; always-safe under the invariant); W11; engine-config carriage (W8); the gated install-pass seeding code story.
