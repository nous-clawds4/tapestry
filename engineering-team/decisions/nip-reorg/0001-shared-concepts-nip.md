# ADR 0001: Shared Concepts NIP — structure, migration boundaries, and O2 resolution

**Status:** Accepted
**Date:** 2026-07-12
**Story:** `engineering-team/stories/nip-reorg/1-shared-concepts-nip.md`

## Context

Story nip-reorg #1 requires a new policy NIP (`protocols/drafts/shared-concepts.md`) per handoff D1–D3 ([`docs/NIP_REORG_DESIGN_HANDOFF.md`](../../../docs/NIP_REORG_DESIGN_HANDOFF.md)): the layer that explains how independent authors converge on shared concepts, consuming the `b` primitive without restating it. The policy content today is scattered across four homes with three different vocabularies:

- [`protocols/drafts/inherit-from.md`](../../../protocols/drafts/inherit-from.md) § "Aggregation: who defers to a definition" — deference vs discovery, protocol policy stranded in a primitive spec;
- [`protocols/drafts/tapestry-concepts.md`](../../../protocols/drafts/tapestry-concepts.md) § "Multi-`z` stamping" — the ADR 0033 cloud model, entangled with stamp mechanics that S3 will extract;
- BIBLE §22 + glossary — the "grapevine → firmware → none" precedence, in implementation terms;
- [`protocols/worksheet.md`](../../../protocols/worksheet.md) W1 — the open cross-deployment identity problem.

Constraints: the D2 vocabulary policy (no "canonical"/"consensus" in living-spec normative text); the README boundary rule ("each wire format normative in exactly one place"); story AC6 (S1 touches no `protocols/` file other than the new spec, inherit-from, and the README row); docs-mode (no code, no firmware; Test Design skipped).

## Options considered

### Option A — New policy spec + pointer edit in inherit-from (chosen)
`drafts/shared-concepts.md` becomes the normative home for affiliation/deference/aggregation/cloud/identity policy; inherit-from § Aggregation shrinks to a pointer, keeping only tag-mechanics. Pros: realizes D1 exactly; the primitive spec becomes purely mechanical; one reading path for implementers. Cons: two transient duplications until S3/S4, which must be explicitly tracked (see Decision).

### Option B — Expand inherit-from into a combined primitive+policy spec
Rejected: violates D1's split, mixes stability tiers (ratified mechanics with open policy), and makes eventual separate publication impossible without a later re-split.

### Option C — Grow the policy inside tapestry-concepts
Rejected: wrong layer — tapestry-concepts is the data-model NIP, and the epic's direction (S3) is to *shrink* it by extracting § Multi-`z`, not grow it.

## Decision

**Option A**, with **O2 resolved as "ratified selector in, open problem referenced"**: the spec states normatively the *ratified* precedence (`grapevine-resolved → firmware-blessed → none`, per ADR 0033 / BIBLE §22's trajectory) because the cloud model is incomplete without its selector — but the *unresolved* identity question (how independent deployments agree which header a concept converges on) is stated as open and pointed at W1, which remains the sole tracker.

No fact gets a second normative home *at end of epic*; the two transient duplications are scheduled:

1. cloud prose duplicated with tapestry-concepts § Multi-`z` bullets **until S3** flips that section to a pointer;
2. the selector duplicated with BIBLE §22's implementation framing **until S4** audits §22 for pointer alignment (the §25/§26 precedent).

## Consequences

- Implementers get one policy document; inherit-from becomes strictly mechanics (its § Scope keeps only wire semantics).
- S3 and S4 inherit two explicit cleanup obligations — if the epic stalls after S1, the duplications persist flagged but unresolved.
- The D2 vocabulary lands in living-spec text for the first time; older ADRs/worksheet keep historical wording, which the reviewer must not "fix."
- **Firmware reinstall required?** No (docs-only).

## Implementation notes

**1. Create `protocols/drafts/shared-concepts.md`** — title "Shared Concepts", with this section outline:

- *Repo-metadata header:* Status 📝 pre-NIP; Canonical: not yet published; an Implementation line mirroring inherit-from's (pointer-`b` seeding **implemented** — `community-reference` ADR 0034 / `tag-federation` ADR 0002; the resolver, aggregation, and cloud computation **not implemented** on any deployment); Sources: `community-reference` ADR 0033, inherit-from.md § Aggregation (extraction origin), worksheet W1, `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`, `docs/NIP_REORG_DESIGN_HANDOFF.md`.
- *Intro* — what a shared concept is (a concept whose handle is in conventional use among independent authors); explicit statement: **this NIP defines no new wire format** (everything rides `z` and `b`).
- *Terminology* — the three defined terms: **deference** (what an inherit-typed `b` claims; the aggregable signal), **convergence** (the process by which conventions arise — gradual, measurable in degree, never final), **convention** (the outcome). State the observer-relative rule once, normatively: every aggregate in this spec is *an observer's view*, never a global fact.
- *Relationship to other specs* — DList (base), Tapestry Concepts (data model), Inherit-From (the `b` primitive this spec consumes), class-thread-tags **by its current filename** (S2 renames; S4 sweeps links), Communities/Tags as downstream consumers.
- *Declared affiliation* — pointer-`b` on one's own header as the published affiliation/navigation claim; firmware `communityReference` seeding referenced as the reference deployment's cold-start behavior (one sentence + ADR cite, not a restatement).
- *Deference* — inherit-`b`; trust-coupling handled by pointer to inherit-from § Security considerations (no duplication).
- *Aggregated deference (observer-resolved)* — **migrated** from inherit-from § Aggregation: deference aggregation counts inherit-typed edges only (a bookmark is not agreement — the rationale sentence comes along); discovery walks include both types. Written in D2 vocabulary (the section's old "Consensus (deference)" label becomes deference aggregation).
- *Clouds* — ADR 0033 restated in D2 vocabulary: derived top-k of an observer's aggregated deference; never a published object/manifest; mutual pointer-`b` = navigation, not gate; rotation emergent; bootstrap-from-singleton; the precedence selector; an italic *design-only* callout mirroring tapestry-concepts' ("gated on the resolver and on-wire `b`-tags; cap/formula/cold-start contents deferred").
- *Cross-deployment identity* — the problem in one paragraph, the trajectory (firmware-blessed pointer → registry-as-DList → deference aggregation), and "open, tracked as W1."
- *Security considerations* — seeded/casual correspondence must never masquerade as deference (why pointer-typed edges carry zero aggregation weight).

**2. Edit `protocols/drafts/inherit-from.md`:**
- § "Aggregation: who defers to a definition" → retain the heading, replace the body with: the one-sentence relay-mechanics fact that belongs to the primitive (the type element is non-indexed, so `#b` filters return both types; consumers filter locally) + a pointer to Shared Concepts for the aggregation policy.
- § Scope (v1), one vocabulary alignment: "zero **consensus** weight" → "zero **aggregation** weight" (same meaning, D2-compliant; flagged here since it's outside § Aggregation).
- Nothing else in the file changes (the spec-map sentence and family table are S4's sweep).

**3. Add the README index row** (mirror existing format):
`| Shared Concepts (b-consuming policy) | [drafts/shared-concepts.md](./drafts/shared-concepts.md) | 📝 pre-NIP | **Working copy here** (policy layer over Inherit-From; extraction of its § Aggregation) | nip-reorg #1 ✅ |`

**4. Reviewer verification plan (docs-mode):** grep the new spec for `canonical|consensus` — zero hits outside clearly-cited historical titles; confirm every relative link resolves on disk; confirm the diff touches only the three files above (+ story link-back); `npm test` green.

## Out of scope

Stamp mechanics (personal-`z` requirement, cap, re-stamp — S3's Stamping NIP); the class-thread rename (S2); W1/W11 worksheet re-pointers and the BIBLE §22 pointer audit (S4); settling O1 (subset/ancestor stamping); any resolver/cloud implementation.
