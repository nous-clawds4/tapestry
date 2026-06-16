# Story 36: Resolved-definition cache — deployment-side materialization design

**Status:** Done
**Created:** 2026-06-13
**Type:** Doc (docs-mode — Protocol-Spec workflow; P4 of the b-tag affiliation design — design-only)

## Background

The b-tag affiliation design ([docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md](../../../docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md), D6) settled how the "read one event for the resolved definition, no repeated re-resolution" performance goal is met: a **deployment-side materialized cache** of resolved definitions, with **zero wire change**. The wire/semantics rule — "computed on read … never snapshotted into the node" ([inherit-from.md](../../../protocols/drafts/inherit-from.md), ADR 0028) — stays; caching is the deployment-side carve-out ADR 0028 named three times and BIBLE §26 currently punts as "out of scope here."

This story **ratifies the cache architecture as design** (an ADR + a BIBLE §26 expansion), not code. There is deliberately no implementation: the resolved-definition **resolver itself does not exist** (zero `INHERITS_FROM` in source; ADR 0028 defers "any actual merge-walk implementation, Neo4j/query work, materialization, caching" as a future story), and a resolver only does meaningful work once `b`-tags exist on-wire — gated on the seeding code story, gated on the three-branch reconciliation (handoff O7). The design is captured now, while the reasoning is fresh; the code lands later, on top of the resolver, when those gates clear.

Without this story, the handoff's P4 is unrecorded and BIBLE §26 leaves the cache as an unowned "out of scope" punt rather than a designed-but-deferred mechanism.

## User-facing description

As an **implementer who will eventually build the resolved-definition resolver**, I want the deployment-side cache architecture ratified — what is materialized, how it refreshes, the reconciliation backstop, and the hard boundary against on-wire snapshots — so that when the resolver and on-wire `b`-tags exist, the cache can be built to a settled design that is provably semantically transparent and cannot leak the override-masquerade hazard onto the wire.

## Acceptance criteria

All testable by reading the ratified documents (docs-mode; design-only):

- [ ] An **ADR exists** in this epic ratifying the deployment-side resolved-definition cache architecture, citing the handoff (D6, H1) and building on ADR 0028 (whose "caching out of scope" punt it supersedes).
- [ ] The **semantic-transparency invariant** is stated: the cache is a deployment-side performance optimization that MUST NOT change what any node's definition resolves to; the on-read live-resolution semantics of ADR 0028 remain authoritative; a cache miss/stale entry can never produce a different answer than a fresh walk.
- [ ] The **materialization trigger** is stated: opting a header into `"inherit"` (an inherit-typed `b`, per ADR 0029) is the signal for the instance to maintain a materialized resolved definition; pointer-typed `b` tags do not trigger it (they carry no deference to resolve).
- [ ] The **refresh model** is stated: event-driven refresh on parent edits **plus** a periodic full re-resolve backstop (the reconciliation lesson — ADRs 0018/0020: never trust an id-match fast-path; re-derive, don't trust bookkeeping).
- [ ] The **on-wire-snapshot boundary** is stated as the design's load-bearing safety property: the materialized definition lives **only deployment-side (Neo4j)**, is **never republished into the header event as stated fields** — doing so would be the override-masquerade hazard (H1), freezing the parent's future edits and misrepresenting authorial intent. The on-wire synced-snapshot variant stays deferred (handoff O8), with its safe future path noted (the stated-vs-synced field marking at inherit-from.md's open payload-binding item).
- [ ] The **existing machinery** the future implementation would compose from is named (the `pass_communityReferences` fetch-publish-materialize sequence, strfry-router remote-subscription, BullMQ periodic refresh, ADR 0010 owner-consent/on-demand-pull, ADR 0006's deferred element/superset materialization stream).
- [ ] The **design lands in the BIBLE Resolved-Definition area (§26)**, replacing/expanding the current "caching out of scope" bullet, and is **honestly framed as target/design — not wired** (no resolver, no cache exist), following the §27 / ADR 0030 precedent.
- [ ] The documents make clear this is **design-only, gated**: implementation depends on the resolver (unbuilt) and on-wire `b`-tags (gated on the three-branch reconciliation); no code ships here.
- [ ] **No source files are touched** (verifiable by diff) — this is an ADR + BIBLE-section change only.
- [ ] **`npm test` remains green.**

## Concepts touched

None in the live concept graph — documents only; no events emitted, **no firmware reinstall**. (Concept Graph API was unreachable at planning time.)

## Out of scope

- **Any code** — the resolver (merge-walk), the materialization/refresh implementation, the cache itself — all future engineering stories gated on the resolver and on-wire `b`-tags.
- The **on-wire synced-snapshot** variant and its stated-vs-synced field marking (handoff O8 / H1) — deferred; the design only states the boundary that defers it.
- `protocols/` wire-format changes — the cache is deployment behavior (BIBLE territory per the boundary rule); the wire rule "never snapshotted" already stands in inherit-from.md and is unchanged.
- W11 (cloud/stamping); the registry-as-DList design; engine-config carriage (W8); the gated install-pass seeding code story.

## Open questions

None remaining — the three gate items were resolved by the protocol author at the planning gate (2026-06-13):

1. **Design scope:** cache architecture only (materialization + refresh + reconciliation + deployment-side-only boundary); the on-wire synced-snapshot variant (O8) stays deferred.
2. **Optionality:** the cache is an optional deployment optimization a deployment **MAY** maintain — a transparent performance choice, not a protocol requirement; on-read live resolution stays authoritative.
3. **BIBLE placement:** expand §26 (Resolved Definition) in place, superseding its "caching out of scope" bullet.

**Test Design is skipped** (docs-mode rule — no executable behavior; the Reviewer audits accuracy and consistency).

## Linked artifacts

- Design source: [docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md](../../../docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md) (D6, H1, O8, §5 P4)
- Builds on / supersedes the punt of: [ADR 0028](../../decisions/community-reference/0028-resolved-definition.md) (resolved definition — "caching … out of scope"); related [ADR 0029](../../decisions/community-reference/0029-b-type-registry.md) (the inherit-typed trigger)
- ADR: [engineering-team/decisions/community-reference/0032-resolved-definition-cache-design.md](../../decisions/community-reference/0032-resolved-definition-cache-design.md)
- Test plan: skipped (docs-mode)
- Review: [engineering-team/reviews/community-reference/36-resolved-definition-cache-design.md](../../reviews/community-reference/36-resolved-definition-cache-design.md) (PASS 2026-06-13, first round)
