# Book: nip-reorg

**Status:** Open
**Opened:** 2026-07-12 (eager)
**Type:** Bounded ask (no PRD)
**Epics:** `nip-reorg` (sole epic; planned stories 1–4)

**Intent anchor:** [`docs/NIP_REORG_DESIGN_HANDOFF.md`](../../../docs/NIP_REORG_DESIGN_HANDOFF.md) (merged PR #344, 2026-07-12) — the scoping capture whose §5 ratification plan this book realizes. Anchor provenance: **acceptance-frame (eager)**; confidence: **high**.

## Acceptance frame (the ask, restated and confirmed at kickoff)

Reorganize the shared-concept protocol surface into NIPs per the handoff's settled decisions D1–D8, without settling the deliberately-deferred subset/ancestor-stamping design (O1):

1. **Shared Concepts** (`protocols/drafts/shared-concepts.md`) exists — the b-consuming policy NIP (affiliation, deference, observer-resolved aggregation, clouds, W1 identity trajectory), written under the D2 vocabulary policy; inherit-from § Aggregation reduced to a pointer.
2. **Class Thread Relationships** — `class-thread-tags.md` renamed, substance unchanged, inbound links fixed.
3. **Stamping** (`protocols/drafts/stamping.md`) exists — the multi-`z` convention moved out of tapestry-concepts (which keeps a pointer), the read-side contract stated, and O1 present as an explicit open section with a new worksheet entry.
4. **Index & cross-refs coherent** — `protocols/README.md` rows per the status ladder; W1/W11 re-pointers; `tags.md`/`communities.md` reference Stamping rather than restating dual-`z`; BIBLE pointers consistent.

Throughout: each wire fact normative in exactly one place; no "canonical"/"consensus" in living-spec normative text; ADRs and worksheet history unrewritten.

**Done looks like:** all four stories PASS and shipped to staging; the handoff doc flips to ✅ SUPERSEDED.

## Close

_(open)_
