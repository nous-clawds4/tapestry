# ADR 0002 (protocols-directory): Class-thread tags extraction — §23 split and skeleton

**Status:** Accepted
**Date:** 2026-06-10
**Story:** `engineering-team/stories/protocols-directory/4-class-thread-tags-extraction.md`

> Thin ADR: inherits the macro pattern from [`protocols-directory` ADR 0001](./0001-tapestry-concepts-extraction.md) — fixed skeleton discipline, pointer-first BIBLE rewrite shape, Implementer source-map requirement, and the gates (npm test green, bounded diff scope, anchors/TOC intact). Only the §23-specific decisions are made here.

## Context

Story 4 extracts BIBLE §23 (Class-Thread Membership Tags, BIBLE.md ~:1605–1636) into `protocols/drafts/class-thread-tags.md`. The story names three boundary calls: the consumer trust constraints, the dual-emit policy, and the relationship vocabulary. A fourth surfaced during orientation: §23's value-format example embeds a real partial pubkey (`'39999:919ba08a…:the-set-of-paid-nostr-relays'`) — the spec must use placeholders, consistent with the epic's no-deployment-pubkeys rule.

## Options considered (the trust-constraint split — the one real fork)

### Option A — Generalized security considerations in the spec; concrete wiring in the BIBLE (chosen)

The spec carries a "Security considerations" section stating the deployment-neutral kernel of each constraint; the BIBLE keeps Tapestry's concrete enforcement (the community-anchor TA, the story-#11 `IS_A_SUPERSET_OF` anchor, the Phase-B walk rules).

### Option B — Constraints stay wholly in the BIBLE

Rejected: an independent consumer implementing from the spec alone would be open to the cross-instance-election attack — exactly what the story exists to prevent ("refuse the known abuse patterns without reading our codebase's documentation").

### Option C — Copy the constraints verbatim

Rejected: verbatim text is welded to Tapestry mechanics (`curatorPk`, "#11 anchor", "local TA's sub-graph", MERGE) and fails stranger-readability by construction.

## Decision

**Option A**, with the split fixed as follows:

| §23 constraint | Spec gets (deployment-neutral kernel) | BIBLE keeps |
|---|---|---|
| 1. Authorship gate | Consumers attributing `n`/`s` structure to a curator MUST derive relationships only from events **signed by that curator**; a tag naming some graph's node, published by anyone else, derives nothing in that graph. Names the attack: anyone can publish `["n", "<your-superset-address>"]`; without the gate a consumer grafts strangers into a trusted graph (cross-instance election). | The concrete gate: `pubkey === curatorPk`, where curatorPk is the TA anchored by the community-reference superset link (§22). |
| 2. Local-graph isolation | Relationships derived from a foreign curator's tags MUST stay within that curator's graph; bridging two curators' graphs is an explicit consumer-side act, never derived from a foreign event's tags. **Flag for Reviewer:** this is a generalization of §23's Tapestry-specific wording — scrutinize under the traceability rule. | The #11 anchor as the single allowed cross-pubkey edge; "Phase B's tag walk never MERGEs an edge whose parent endpoint is in the local TA's sub-graph." |
| 3. Class-thread only | From `n`/`s` a consumer derives **only** `HAS_ELEMENT` and `IS_A_SUPERSET_OF`; no editorial relationship is inferable from these tags (the editorial inherit-from relationship has its own tag, `b` — cross-ref). | The MERGE phrasing and §6 edge-materialization context. |

**The other calls:**

- **Relationship vocabulary:** the spec's table column reads "Derived relationship (in the consumer's graph)" with `(parent)-[HAS_ELEMENT]->(child)` notation; the words Neo4j/MERGE do not appear in the spec. Logical relationship names are retained as protocol vocabulary (they also appear in word-wrapper `relationshipTypes` payloads).
- **`b`-tag cross-reference form:** the spec references the inherit-from tag where the direction principle and constraint 3 require it, linking its **current normative home** — `../../BIBLE.md#25-the-inherit-from-tag-b` — with the parenthetical "(migration to this directory pending; see the [spec index](../README.md))". No duplication of `b`'s definition.
- **Example hygiene:** all a-tag examples use `<pubkey>`/`<d-tag>` placeholders; the `919ba08a…` example is reworded, flagged as a mechanical-fidelity deviation in the source map.
- **Direction principle:** moves to the spec in full (lowercase = child-claims-parent; uppercase reserved, `B` explicitly; assignment only for a concrete consumer need that a derived aggregate query — e.g. the `#n=X` relay filter — cannot satisfy). The future-candidate letters paragraph moves as a short "Candidate letters" note pointing at worksheet W2 (which owns the registry problem); per-candidate detail (e.g. REFERENCES' open publishing semantics) stays summarized with a W5 pointer, not restated.

### Spec skeleton (fixed)

```
(repo-metadata header: 📝 pre-NIP · sources: BIBLE §23, ADR 0011 · pattern: protocols-directory ADR 0001)
---
Class-Thread Membership Tags (n, s)
=====
## Relationship to Tapestry Concepts      (rides on kind-39999; mirrors z's child-claims-parent; why single-char/relay-indexed)
## The tags                               (table: n, s → derived relationship incl. the direction flip)
## Tag value format                       (parent's a-tag form; placeholder example)
## Multi-parent semantics
## Retrieval                              (#n/#s filters; children-of-X is a relay query, not a parent-maintained list)
## Security considerations                (the three kernels per the split table)
## Direction principle and reserved letters (lowercase/uppercase; B reserved via b; no speculative assignment; candidates → worksheet W2)
```

### BIBLE §23 rewrite shape

Pointer-first paragraph (per ADR 0001), then the retained implementation content: the dual-emit policy in full (emission sites, one-release-cycle descriptor back-compat, pending cutover ADR); Tapestry's concrete trust-gate wiring (curatorPk/community-anchor, #11 anchor, Phase-B walk rules; cross-ref §22); the Neo4j materialization note (cross-ref §6); the historical "established by ADR 0011" note; pointer to §25 for `b`.

## Consequences

- An independent `n`/`s` consumer can implement safely from the spec alone; the attack surface is documented at protocol level.
- The constraint-2 generalization is the one passage where spec prose abstracts beyond §23's literal wording — explicitly flagged for the Reviewer's traceability audit.
- Worksheet W2/W5 remain the owners of the registry/REFERENCES problems; the spec points, doesn't restate. After this story, W2/W5's refs to §23 must still hold (story AC) — the direction principle they cite now lives in the spec, so their ref text may need the Implementer's attention (allowed: updating worksheet refs to cite the spec; flag in source map).
- **Firmware reinstall required?** No.

## Implementation notes

- Files: `protocols/drafts/class-thread-tags.md` (new, per skeleton); `BIBLE.md` (§23 only); `protocols/README.md` (row 4 → working copy, story 4 ✅); `protocols/worksheet.md` **only if** W2/W5 ref-text updates prove necessary (flag each).
- Source map required in the implementation report (spec section → §23 lines / ADR 0011 / §25 for the b contrast), including the two flagged items: the constraint-2 generalization and the example-pubkey placeholder swap.
- Gates: `npm test`; §23 anchor/title unchanged; no other BIBLE section touched; landmark sweep for dual normativity.

## Out of scope

- Resolving W2 (registry) or W5 (REFERENCES semantics); assigning candidate letters.
- §25/§26 extraction (story 5).
- Any dual-emit behavior change.
