# Story 3: Author the Stamping NIP

**Status:** Approved
**Created:** 2026-07-12
**Type:** Doc

## Background

Handoff D5–D6 ([`docs/NIP_REORG_DESIGN_HANDOFF.md`](../../../docs/NIP_REORG_DESIGN_HANDOFF.md)): the multi-`z` stamping convention — which `z` tags a deliberately-published list item carries — is publisher-policy that today lives as a subsection of the tapestry-concepts data-model NIP, entangled with the cloud model that S1 moved to Shared Concepts (ADR 0001's scheduled transient duplication #1). It is also the layer with the epic's one deliberately-unsettled design question: subset/ancestor stamping (O1), which has no written home at all. This story gives the convention its own NIP, states the read-side contract next to the write rule, opens O1 in its proper place, and completes the extraction seam in tapestry-concepts.

## User-facing description

As an implementer publishing or consuming DList items (ours or an independent deployment's), I want one document that says exactly which `z` stamps a published item carries and what a reader may assume about them, so that publishers and readers interoperate against the same contract — and so the open subset question has a visible home instead of living in conversation.

## Acceptance criteria

- [ ] **AC1 — the spec exists and is indexed.** `protocols/drafts/stamping.md` is present with the standard metadata header (📝 pre-NIP; Sources naming at minimum `community-reference` ADR 0033, tapestry-concepts § "Multi-`z` stamping" as extraction origin, `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` D1 rev 2, `docs/NIP_REORG_DESIGN_HANDOFF.md`; a design-only implementation note), and `protocols/README.md` gains its index row (per the S1 gate precedent).
- [ ] **AC2 — the ratified write rule, D2 vocabulary.** The spec states the full convention: personal `z` required (≥1, may target a private header — the local-first premise); up to a cap of cloud handles, **affiliation-anchored** (the author's declared community via their own pointer-`b`, never a concept-global top-k); `z` order not load-bearing; re-stamping by lazy author re-emit with the named lossiness (foreign-authored, inactive-author, kind-9999 items); the containment-only boundary (membership assertions keep their single applied-concept handle). Framed as consuming `b` (Shared Concepts / Inherit-From) and `s`/`n` (Class Thread Relationships, by its new name).
- [ ] **AC3 — the read-side contract, same page.** An explicit consumer-facing section: what a reader MAY assume (personal `z` present), what it MUST NOT rely on (`z` order; cloud stamps being current; ancestor stamps existing — pending O1), and what that implies for query strategy.
- [ ] **AC4 — O1 opened properly.** An "Open: subset/ancestor stamping" section presents the Widgets / Widgets-for-Carpenters / Widgets-for-Electricians example, the candidate shapes (read-time `s`-walk expansion; write-time ancestor stamping; hybrids) with their tradeoffs stated neutrally (no leaning — settling it is a future `/discuss`), and the rule that whichever design lands must co-state its read contract. A new worksheet entry **W14** (successor to graduated W11) tracks it, cross-linked both ways.
- [ ] **AC5 — extraction seam complete.** tapestry-concepts § "Multi-`z` stamping" keeps its heading and becomes a short pointer (stamp mechanics → Stamping; cloud model → Shared Concepts), resolving ADR 0001's transient duplication #1: after this story, stamp mechanics are normative only in `stamping.md` and cloud properties only in `shared-concepts.md`. The stale forward-reference at `shared-concepts.md:29` ("planned to graduate — S3") is updated to point at the landed spec.
- [ ] **AC6 — gates and scope guard.** Vocabulary grep of the new spec: zero "canonical"/"consensus" in normative text; all links resolve; harness-lint clean; `npm test` stack-free portion green (the 11 stale-local-stack suite failures remain the known caveat); no `protocols/` file changes beyond `stamping.md`, `tapestry-concepts.md`, `shared-concepts.md` (one line), `worksheet.md`, `README.md`.

## Concepts touched

None mutated (docs-mode). The spec governs items joining any concept; tag-family handles may appear as examples only.

## Out of scope

- **Settling O1** — deliberately deferred (handoff D6); this story opens it, a future `/discuss` closes it.
- W1/W11 semantic re-aims, `tags.md`/`communities.md` referencing Stamping, BIBLE §22/§23 audits, and the S1/S2 routed review nits — all S4.
- Any publisher implementation change (the pins single-`z` lag stays an eng-team story candidate).

## Open questions

- None blocking. Whether the containment-only boundary sentence lives in Stamping, Shared Concepts, or both-with-one-normative-home is an Architect call at the extraction seam.

## Linked artifacts

- ADR: [`engineering-team/decisions/nip-reorg/0003-stamping-nip.md`](../../decisions/nip-reorg/0003-stamping-nip.md) (containment-only boundary → Stamping solely; BIBLE §10 cite dropped from extracted sentence — sanctioned deviations)
- Test plan: skipped — docs-mode
- Review: (filled in after Review phase)
