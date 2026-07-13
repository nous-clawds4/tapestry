# Epic: nip-reorg

**Created:** 2026-07-12
**Status:** Active

## Goal

Reorganize the shared-concept protocol surface into the four-NIP layered organization settled in [`docs/NIP_REORG_DESIGN_HANDOFF.md`](../../docs/NIP_REORG_DESIGN_HANDOFF.md) (D1–D8): the `b` primitive stays in inherit-from; a new **Shared Concepts** policy NIP; **Class Thread Relationships** (rename of class-thread-tags); a new **Stamping** NIP holding the multi-`z` convention and the open subset question. Every wire fact normative in exactly one place; the D2 vocabulary policy (retire "canonical" and "consensus"; deference / convergence / convention) applied throughout the living specs.

This is docs-mode work (protocol-spec workflow §3): deliverables are `protocols/` prose + pointer edits, no code, Test Design skipped per story.

## Stories (per handoff §5)

1. `stories/nip-reorg/1-shared-concepts-nip.md` — **S1: Shared Concepts** — new `protocols/drafts/shared-concepts.md`; absorbs inherit-from § Aggregation; minimal README index row (gate decision 2026-07-12).
2. `stories/nip-reorg/2-class-thread-relationships-rename.md` — **S2: Class Thread Relationships** — rename + title sweep of `class-thread-tags.md`.
3. `stories/nip-reorg/3-stamping-nip.md` — **S3: Stamping** — new `protocols/drafts/stamping.md`; tapestry-concepts § Multi-`z` → pointer; the O1 open section; worksheet W14.
4. `stories/nip-reorg/4-index-crossref-sweep.md` — **S4: Index & cross-ref sweep** — W1/W11/W14 re-pointers; `tags.md`/`communities.md` reference Stamping; BIBLE §22 pointer + §23 rename; review-nit polish. (No README rows remained — S1–S3 maintained theirs.)

S1–S3 order-independent in substance; S4 last.

## Not on this epic's path

Settling O1 (subset/ancestor stamping — gets its own `/discuss`); target-typed tag *definitions* (tags/W10 lineage); the pins dual-`z` implementation lag (eng-team story candidate); any resolver/cloud implementation.
