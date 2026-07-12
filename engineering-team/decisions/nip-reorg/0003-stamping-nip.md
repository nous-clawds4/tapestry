# ADR 0003: Stamping NIP — extraction seam, read contract, and O1's opening

**Status:** Accepted
**Date:** 2026-07-12
**Story:** `engineering-team/stories/nip-reorg/3-stamping-nip.md`

## Context

Story nip-reorg #3 extracts the multi-`z` convention from tapestry-concepts § "Multi-`z` stamping" (lines 53–64 at base `f6f78eca`) into its own publisher-policy NIP, adds the read-side contract, opens O1, and completes ADR 0001's scheduled duplication-#1 cleanup. The ratified source text is verbatim in tapestry-concepts (ADR 0033's six bullets + the local-first premise + the design-only callout). Inbound references to the section: `shared-concepts.md:29` (in scope per AC5) and worksheet W11's "resolving home" ref (resolves via the surviving heading; semantic re-aim is S4); no hard `#anchor` links exist. Constraints: D2 vocabulary; single-normative-home; AC6's five-file diff scope; W14 is the next worksheet number.

## Options considered

### Option A — extract + read-contract + neutral open section + W14 (chosen)
Stamping becomes the sole normative home for stamp mechanics; Shared Concepts keeps the cloud; tapestry-concepts § keeps its heading as a two-way pointer. Pros: completes the layering; O1 gets a citable home without being settled. Cons: none material.

### Option B — settle O1 in this story
Rejected: handoff D6 deliberately sequenced reorg-before-settlement; settling here would skip the dedicated `/discuss` the question needs and bloat a ratification story with new design.

### Option C — new spec references tapestry-concepts' text instead of moving it
Rejected: leaves the duplication ADR 0001 scheduled for cleanup, and leaves publisher policy inside the data-model NIP — the exact misplacement this epic exists to fix.

## Decision

**Option A**, with two delegated calls resolved:

1. **Containment-only boundary lives in Stamping, normatively and solely.** It is a rule about *which items get stamps* — publisher policy. Shared Concepts § Clouds never carried it (verified — S1 deliberately left it out), so no duplication arises; Stamping's statement links to Communities for the membership-assertion side.
2. **The BIBLE §10 citation drops from the extracted normative sentence.** The original "at least one parent pointer per the base NIP / BIBLE §10 Rule 2" cites implementation doc from spec text — backwards under the boundary rule. The extracted sentence cites Decentralized Lists § Item declaration (and tapestry-concepts' a-tag constraint) only. Sanctioned fidelity deviation; flagged for the Reviewer.

## Consequences

- After S3, the epic's remaining duplication obligation is only ADR 0001's #2 (BIBLE §22 selector audit — S4).
- W11's worksheet ref temporarily points at a pointer-section (resolves; reads oddly) — S4's re-aim finishes it.
- **Firmware reinstall required?** No.

## Implementation notes

**1. Create `protocols/drafts/stamping.md`** — title "Stamping: z-tag selection for published list items":
- *Header:* 📝 pre-NIP; Implementation line: the personal+shared two-`z` shape is **partially implemented** for tag events (`tag-federation` ADR 0003 dual-`z` writers; pins still single-`z`); **cloud stamping unimplemented**, gated on the Shared Concepts resolver. Sources: `community-reference` ADR 0033; tapestry-concepts § "Multi-`z` stamping" (extraction origin); `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` (D1 rev 2, local-first constraint); `docs/NIP_REORG_DESIGN_HANDOFF.md`.
- *Intro:* stamping = choosing the `z` set for a deliberately-published containment item; defines no new wire format (`z` per Decentralized Lists/Tapestry Concepts; handles resolved via `b` per Shared Concepts).
- *The write rule:* personal `z` required (≥1; may target a private header — restate the local-first premise, cite decentralized-lists § Item declaration); plus up to a cap of cloud handles, **affiliation-anchored** (the author's declared community via pointer-`b`, per Shared Concepts § Declared affiliation — never a concept-global top-k); `z` order not load-bearing.
- *Re-stamping:* lazy author re-emit at the same `d`-address; named lossiness (foreign-authored; inactive-author; kind-9999 — a stated reason to prefer 39999).
- *Boundary — containment vs membership:* containment-only; membership assertions keep their single applied-concept handle (link Communities/Tags).
- *The read contract:* MAY assume ≥1 `z` present and item self-containment; MUST NOT rely on `z` order, cloud-stamp currency, or ancestor stamps (→ Open section); query strategy: resolve the cloud via Shared Concepts and union `#z` across its handles / discovery-walk correspondents.
- *Design-only callout:* mirror the existing italic block (cap ~5 / formula / cold-start deferred; gated on resolver + on-wire inherit-`b`).
- *"Open: subset/ancestor stamping":* the Widgets / Widgets-for-Carpenters / Widgets-for-Electricians example; candidate shapes (a) read-time `s`-walk expansion (status quo implication), (b) write-time ancestor stamping (single-filter queries vs. staleness-on-re-parent, lazy-heal-only, cap pressure ≈2 slots per chain level), (c) hybrids (e.g. direct + root only) — **neutral, no leaning**; the rule that the landing design must co-state its read contract; tracked as W14.

**2. `protocols/drafts/tapestry-concepts.md`** — replace lines 53–64 under the retained bold lead-in: multi-`z` is permitted by the base NIP and adopted by Tapestry for deliberately-published items; the convention (write rule, re-stamping, read contract, open subset question) is **normative in [Stamping](./stamping.md)**; the cloud model in **[Shared Concepts](./shared-concepts.md) § Clouds**; one provenance line (W11 graduated; ADR 0033; extracted per `nip-reorg` ADR 0003).

**3. `protocols/drafts/shared-concepts.md:29`** — "...is specified in [Stamping](./stamping.md)." (parenthetical dropped).

**4. `protocols/worksheet.md`** — append after W13: `## W14 — Subset/ancestor stamping (z-expansion across class-thread structure)`, Status: Open · raised 2026-07-12; the question in two sentences; the three candidate shapes; Refs: stamping.md § Open, class-thread-relationships.md, handoff O1, this ADR; noted as W11's successor question.

**5. `protocols/README.md`** — index row: `| Stamping: z-tag selection for published list items | drafts/stamping.md | 📝 pre-NIP | **Working copy here** (extraction of tapestry-concepts § Multi-z; open subset question → W14) | nip-reorg #3 ✅ |`

**6. Reviewer verification plan:** fidelity diff of the write rule vs `git show f6f78eca:protocols/drafts/tapestry-concepts.md` lines 53–64 (meaning preserved; D2 vocabulary; the two sanctioned deviations: BIBLE-cite drop, containment sentence relocation); duplication greps — "derived top-k" only in shared-concepts, "lazy author re-emit"/write-rule phrasing only in stamping, containment-only sentence only in stamping; vocabulary grep (`canonical|consensus` — zero in new spec body); W14 anchor + both-way links; all links resolve; diff = exactly 5 files; `npm test` (known 11-suite caveat) + harness-lint.

## Out of scope

Settling O1; W1/W11 re-aims, tags.md/communities.md consumer references, BIBLE §22/§23 audits (S4); publisher implementation (pins).
