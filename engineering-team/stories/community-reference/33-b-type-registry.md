# Story 33: `b`-tag type registry and type-gated semantics

**Status:** Done
**Created:** 2026-06-12
**Type:** Doc (docs-mode — Protocol-Spec workflow; P1 of the b-tag affiliation design)

## Background

The b-tag affiliation design session (2026-06-12) settled a revision of the `b` tag's semantics, captured in [docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md](../../../docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md) (🔴 OPEN — decisions D2, D3, and the D1-revision-2 carve-out). Today's ratified text (ADR 0027, [protocols/drafts/inherit-from.md](../../../protocols/drafts/inherit-from.md), BIBLE §25) makes every `b` tag mean live definitional inheritance by default and walks every `b` tag during resolution. The settled design inverts that: **by default a `b` tag is a pointer (`"reference"`); live deference (`"inherit"`) is opt-in and explicit** — because the protocol must never *assume* deference (founding tenet), because firmware seeding must not manufacture consensus (handoff hazard H2), and because the pointer default is what keeps transitive affiliation safe and cheap.

Zero `b` tags exist on any wire and zero resolver/emitter code exists anywhere, so this is a documentation-only change with no migration. Without this story, the spec as written instructs implementers to inherit definitions through mere pointers, and the firmware-seeding plan (P2) is blocked on a tenet violation.

## User-facing description

As a **protocol author / independent spec implementer**, I want the `b` tag's type element ratified as a two-value registry with all type-dependent semantics (resolution, edge derivation, aggregation, transitivity) explicitly gated by type, so that any implementation reading an arbitrary `b` tag knows exactly what it does and does not imply — and so that a deployment can point at a community's definition without being silently subscribed to it.

## Acceptance criteria

All testable by reading the ratified documents (docs-mode; no executable behavior):

- [ ] The inherit-from spec defines the **type registry**: `"pointer"` (correspondence/locator; no resolution semantics, no deference) and `"inherit"` (live definitional deference, current semantics), including the one-question decision rubric ("when they edit their list, should the meaning of yours change?"). The value `"pointer"` was chosen over the handoff's working name `"reference"` at the planning gate, to avoid colliding with the legacy REFERENCES relationship/edge vocabulary; the spec should note the lineage (it is W5's option (a) realized).
- [ ] The spec states the **fail-safe default**: an absent type element reads as `"pointer"` (least-commitment), superseding "default `inherit`".
- [ ] The **resolution rule and pseudocode walk only inherit-typed `b` tags**, with first-listed-wins defined over the inherit-typed subset; the deference-closure definition is gated the same way.
- [ ] **Edge derivation is type-gated**: `"inherit"` → `INHERITS_FROM`; the pointer type → the documented reference-edge decision honoring BIBLE §22's `source`/collision contract.
- [ ] The **aggregation section** scopes the deference/consensus signal (W1 candidate) to inherit-typed edges (pointer weight zero in v1) and distinguishes **discovery walks** (both types count).
- [ ] The spec states the **type-split transitivity rule**: affiliation-for-aggregation = the target header appears in the inherit-only deference closure; a pointer-typed link breaks the chain and affiliates only its own author; closure membership is order-independent.
- [ ] The **query-shape consequence** is documented: the type element is non-indexed, so `#b` results are fetch-then-filter by type.
- [ ] The **multi-z carve-out** is recorded: the Tapestry-layer position on multiple `z` tags for deliberately-published items (handoff D1 rev 2) versus the base NIP's one-`z`-per-event recommendation, in whatever document the Architect designates as its normative home.
- [ ] An **amending ADR** exists in this epic recording the decision and rationale, superseding ADR 0027's default-`inherit` text and ADR 0028's ungated walk/closure text, citing the handoff doc as design source.
- [ ] **BIBLE §6 / §21 / §25 / §26** restatements are consistent with the above — no surviving "default `inherit`" or ungated-walk text anywhere in the corpus.
- [ ] **communities.md** describes the CD's `b` deference with the inherit type explicit (no reliance on the old default).
- [ ] **Worksheet updated:** W5 records closure via option (a) (the consumer-owned tag, riding `b`'s type element); W1/W2 entries reflect the registry; W6 notes the reduced-pressure status (inherit now opt-in).
- [ ] `npm test` remains green (docs-mode quality gate — no regression from a docs-only change).

## Concepts touched

None in the live concept graph — this story changes protocol documents only; no events are emitted, no firmware reinstall is required (same posture as ADRs 0027/0028). The Concept Graph API was unreachable at planning time; the Architect does not need to resolve handles for this story.

## Out of scope

- P2 (communityReference v2: seed-not-stub, firmware widening), P3 (dual-author headers + kind-10040 TA discovery), P4 (deployment-side resolved-definition cache).
- The cloud formation/rotation design and the stamping rule (handoff O11/O12) — the carve-out criterion records the *position*, not the full multi-z practice spec.
- The election surface / `dlist-tag` design (W10), the W6 set-valued override algebra, the on-wire synced-snapshot marking (H1).
- Any resolver, emitter, or firmware code; republishing any spec to NostrHub.

## Open questions

None remaining — the four gate flags carried from the handoff were resolved by the protocol author at the planning gate (2026-06-12):

1. **Type-value name:** `"pointer"` (renamed from the handoff's working name `"reference"` to avoid the legacy REFERENCES vocabulary collision).
2. **Type-split transitivity rule:** confirmed as specified.
3. **Fail-safe default:** confirmed — absent type element reads as `"pointer"`.
4. **Multi-z carve-out:** ratify the position in this story; the full cloud/stamping practice (O11/O12) remains a later story.

**Test Design is skipped** (docs-mode rule — no executable behavior; the Reviewer audits accuracy and consistency instead).

## Linked artifacts

- Design source: [docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md](../../../docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md) (D2, D3, D1 rev 2, H2, §3 worksheet ledger, §5 P1)
- ADR: [engineering-team/decisions/community-reference/0029-b-type-registry.md](../../decisions/community-reference/0029-b-type-registry.md)
- Test plan: skipped (docs-mode)
- Review: [engineering-team/reviews/community-reference/33-b-type-registry.md](../../reviews/community-reference/33-b-type-registry.md) (PASS 2026-06-13, after one CHANGES-REQUESTED round — rubric added to the spec)
