# Story 1: Author the Shared Concepts NIP

**Status:** Done
**Created:** 2026-07-12
**Type:** Doc

## Background

The 2026-07-12 protocol-spec scoping session (captured in [`docs/NIP_REORG_DESIGN_HANDOFF.md`](../../../docs/NIP_REORG_DESIGN_HANDOFF.md), merged via PR #344) settled a reorganization of the shared-concept protocol surface into a primitive/policy split (handoff D1–D8). Today the policy layer — how independent authors converge on shared concepts — is scattered across `protocols/drafts/inherit-from.md` § Aggregation, `protocols/drafts/tapestry-concepts.md` § Multi-`z`, `community-reference` ADR 0033, worksheet W1, and BIBLE §22. An implementer has no single document to read, and the scattered text still uses vocabulary ("consensus") the design rejects (handoff D2). This story delivers the centerpiece new document; the epic's S2–S4 handle the class-thread rename, the Stamping extraction, and the cross-reference sweep.

## User-facing description

As an implementer of an independent deployment (or a future ratifying session), I want one policy NIP that explains how shared concepts work — affiliation, deference, aggregation, clouds, identity — so that I can interoperate without reverse-engineering policy from a primitive spec, ADR history, and worksheet entries.

## Acceptance criteria

- [ ] **AC1 — the spec exists.** `protocols/drafts/shared-concepts.md` is present with the standard repo-metadata header (Status: 📝 pre-NIP; Canonical: not yet published; Sources naming at minimum: `community-reference` ADR 0033, `inherit-from.md` § Aggregation as origin of migrated text, worksheet W1, `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`, `docs/NIP_REORG_DESIGN_HANDOFF.md`).
- [ ] **AC2 — required content.** The spec covers, as identifiable sections: what a shared concept is (handoff D2 vocabulary: convention as outcome); declared affiliation (pointer-`b`); deference (inherit-`b`); aggregated deference, observer-resolved — including the deference-aggregation vs discovery-walk distinction migrated from inherit-from; the cloud model per ADR 0033 (derived top-k, never a published manifest, mutual pointer-`b` as navigation not gate, emergent rotation, bootstrap-from-singleton, firmware-blessed cold-start precedence); the cross-deployment identity trajectory with W1 explicitly named as the open tracker; and an explicit statement that this NIP defines **no new wire format**.
- [ ] **AC3 — vocabulary policy holds.** Grep of the new spec finds zero occurrences of "canonical" or "consensus" in normative text (permitted only inside clearly-marked historical citations such as ADR titles); every description of the aggregated-deference signal carries the observer-relative qualifier.
- [ ] **AC4 — single normative home.** `inherit-from.md` § "Aggregation: who defers to a definition" is reduced to a short cross-reference pointing at the new spec; the migrated distinctions are normative in exactly one place.
- [ ] **AC5 — discoverable.** `protocols/README.md` gains a minimal index row for the new draft (📝 pre-NIP). *(Gate decision 2026-07-12: row lands here to preserve the index-every-spec invariant; S4 remains the full re-pointer sweep.)*
- [ ] **AC6 — nothing else moves.** No other `protocols/` file changes in this story (`tapestry-concepts.md` § Multi-`z` untouched — that's S3); `npm test` stays green.

## Concepts touched

None mutated (docs-mode; no concept-graph or firmware change). Referenced machinery: the `b` tag ([inherit-from](../../../protocols/drafts/inherit-from.md)), the `z` parent pointer ([decentralized-lists](../../../protocols/nips/decentralized-lists.md) / [tapestry-concepts](../../../protocols/drafts/tapestry-concepts.md)). The tag concepts (`39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag` family) may appear as *examples* only.

## Out of scope

- The Stamping NIP and the tapestry-concepts § Multi-`z` extraction (S3); the class-thread rename (S2); worksheet W1/W11 re-pointers, downstream `tags.md`/`communities.md` cross-refs, BIBLE pointer consistency (S4).
- Settling O1 (subset/ancestor stamping) — deferred by design (handoff D6).
- Any implementation: the resolver and cloud computation remain unbuilt; the spec must state its design-only status as tapestry-concepts does today.

## Open questions

- **O2** (how much W1 restates inside vs. references) — delegated to Architecture with two guardrails: W1 stays the open-problem tracker, and no fact gets a second normative home.
- Test Design is skipped per docs-mode (protocol-spec workflow §3); the Reviewer's audit is accuracy/consistency + cross-reference resolution + `npm test` regression.

## Linked artifacts

- ADR: [`engineering-team/decisions/nip-reorg/0001-shared-concepts-nip.md`](../../decisions/nip-reorg/0001-shared-concepts-nip.md) (O2 resolved: ratified selector in, open problem referenced via W1)
- Test plan: skipped — docs-mode
- Review: [`engineering-team/reviews/nip-reorg/1-shared-concepts-nip.md`](../../reviews/nip-reorg/1-shared-concepts-nip.md) — PASS (2026-07-12; 4 non-blocking findings routed to S4)
