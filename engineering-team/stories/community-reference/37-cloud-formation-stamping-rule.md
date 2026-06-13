# Story 37: Cloud formation & multi-z stamping rule (W11)

**Status:** Done
**Created:** 2026-06-13
**Type:** Doc (docs-mode — Protocol-Spec workflow; W11, design-only, frame-only)

## Background

`community-reference` ADR 0029 ratified the *position* that deliberately-published list items MAY carry multiple `z` stamps (the personal parent pointer plus stamps naming the shared concepts the item joins), but left the *practice* undesigned — worksheet [W11](../../../protocols/worksheet.md#w11--cloud-formation--multi-z-stamping-rules), and handoff [O11/O12](../../../docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md). Unlike P1–P4 (settled in scoping, then ratified), W11 was genuinely open. This story ratifies the design **settled in a 2026-06-13 scope conversation**.

The motivating constraint is **local-first publication**: most personal headers never reach public relays, so public aggregation cannot depend on them — a published item must be self-contained, which is what the cloud stamps make it.

This story ratifies the **frame as design**, not code, and **defers tuning**. There is no implementation: the cloud is derived from the W1 consensus aggregation, which (like the resolver) does not exist and is gated on on-wire `b`-tags behind the three-branch reconciliation (handoff O7).

## User-facing description

As a **client author stamping a public item, and a consumer querying for community items**, I want a ratified rule for what "the cloud" of headers for a concept is, which handles an author stamps, and how stamps age, so that a published item is discoverable by the community it was published to without depending on any private header, no party governs the cloud, and stale stamps degrade gracefully rather than breaking the index.

## Acceptance criteria

All testable by reading the ratified documents (docs-mode; design-only):

- [ ] An **ADR exists** ratifying the cloud-formation + stamping frame, citing the scope conversation, the handoff (D1 rev 2, O11/O12), and building on ADR 0029 (the consensus aggregation) + the §22 trajectory.
- [ ] **Cloud formation (O11)** is stated: the cloud is the **derived top-k of the W1 grapevine-resolved consensus signal** (incoming inherit-typed edges, GrapeRank-weighted from the observer's PoV) — **never a published object/manifest** (no curator; no-privileged-center). Membership is consensus rank; mutual pointer-`b` edges are the author's **navigation** to the cloud, not a membership gate.
- [ ] **Rotation (O11)** is stated as **emergent**: nobody governs cloud membership; it changes as the signal changes; there is nothing to "detect" — author and consumer recompute. The selector follows the **§22 trajectory** (grapevine-resolved top-k → firmware-blessed cluster (cold-start) → none); **organic clouds bootstrap from singletons** and thicken as deference accumulates.
- [ ] **Write-time anchor** is stated: **affiliation-anchored** — an author stamps the cluster of the community they declared affiliation with (navigating via their own pointer-typed `b`), not the concept's global top-k.
- [ ] **Stamping rule (O12)** is stated: a deliberately-published item carries the **personal `z`** (required — ≥1 per base-NIP Rule 2; may point at a private header) **plus up to a cap of cloud handles**. `z`-tag **order is not load-bearing** (a `#z` filter matches any value); highest-consensus-first is informational convention only — consumers MUST NOT depend on order.
- [ ] **Re-stamp on rotation (O12)** is stated: **lazy author re-emit** (ADR 0022 pattern; republish at the same `d`-address for kind-39999). Accepted lossiness is named (foreign-authored items can't be re-stamped; inactive authors' items fade; kind-9999 can't be re-stamped — a reason to prefer 39999).
- [ ] A **consistency note** confirms this cloud is **only for containment items**; **membership assertions** keep the single shared applied-concept handle (the "tag against it" design) — two separate, non-overlapping mechanisms (no reopening of settled ground).
- [ ] The **deferred tuning** is explicitly named as NOT ratified: the exact cap `k` (~5), the exact ranking formula, the firmware cold-start cluster contents.
- [ ] The design **lands in `tapestry-concepts.md`** (expanding its current position-only multi-`z` carve-out paragraph) — `protocols/` is the home for the read/stamp convention; BIBLE keeps any pointer per the boundary rule.
- [ ] **Worksheet W11 is graduated** (Open → Graduated → tapestry-concepts spec), recording the resolution; **handoff O11/O12 are marked resolved**.
- [ ] The documents are **honestly framed as target/design — not wired** (the cloud's consensus aggregation, the resolver, and on-wire `b`-tags do not exist; implementation is gated on the three-branch reconciliation), per the §27 / ADR 0030 precedent.
- [ ] **No source files are touched** (verifiable by diff); **`npm test` remains green**.

## Concepts touched

None in the live concept graph — documents only; no events emitted, **no firmware reinstall**. (Concept Graph API was unreachable at planning time.)

## Out of scope

- The **deferred tuning** (cap `k`, ranking formula, firmware cold-start cluster contents) — set against real behavior when the implementation gate clears.
- **Any code** — the W1 consensus aggregation, the cloud computation, the stamping/re-stamp emitters, the read-side query — all future engineering stories gated behind the resolver, on-wire `b`-tags, and the three-branch reconciliation.
- **Membership-assertion design** (the single-shared-handle "tag against it" mechanism) — already ratified; only referenced here for the consistency boundary.
- The curator-side projection (Method 2) completeness backstop — already noted in D1 rev 2; not re-specified here.
- Engine-config carriage (W8); the registry-as-DList design; the gated install-pass/seeding/resolver code stories.

## Open questions

None remaining — the design was settled in the 2026-06-13 scope conversation; the two pivotal forks were decided by the protocol author at that gate:

1. **Cloud selector:** derived top-k of W1 consensus, §22 trajectory, never a published manifest (no mutual-link membership gate).
2. **Write-time anchor:** affiliation-anchored (stamp the declared community's cluster, not the concept-global top-k).
3. **Scope depth:** ratify the frame; defer the tuning (cap/formula/cold-start contents).

**Test Design is skipped** (docs-mode rule — no executable behavior; the Reviewer audits accuracy and consistency).

## Linked artifacts

- Design source: [docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md](../../../docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md) (D1 rev 2, O11, O12, the local-first constraint) + the 2026-06-13 scope conversation
- Resolves: [worksheet W11](../../../protocols/worksheet.md#w11--cloud-formation--multi-z-stamping-rules)
- Builds on: [ADR 0029](../../decisions/community-reference/0029-b-type-registry.md) (the `b` type registry / consensus aggregation) and BIBLE §22 (the trajectory)
- ADR: [engineering-team/decisions/community-reference/0033-cloud-formation-stamping-rule.md](../../decisions/community-reference/0033-cloud-formation-stamping-rule.md)
- Test plan: skipped (docs-mode)
- Review: [engineering-team/reviews/community-reference/37-cloud-formation-stamping-rule.md](../../reviews/community-reference/37-cloud-formation-stamping-rule.md) (PASS 2026-06-13, first round)
