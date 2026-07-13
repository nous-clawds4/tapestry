# ADR 0001: Reach + layer-selection ratification — normative homes and edit plan

**Status:** Accepted
**Date:** 2026-07-13
**Story:** `engineering-team/stories/w14-settlement/1-ratify-reach-and-layer-selection.md`

## Context

The book's acceptance frame ([`audits/w14-settlement/book.md`](../../audits/w14-settlement/book.md)) ratifies A (three-term split; Reach permission-shaped, publisher-SHOULD, no reader gate) and B (floor + demand-driven extras; ancestors never required; MUST-expand read contract). The corpus sites: `shared-concepts.md` (§ Terminology, § Declared affiliation, § Aggregated deference, § Clouds), `stamping.md` (write rule items 1–2, read contract, § "Open: which layers to stamp"), `inherit-from.md:53` (verbatim constraint), `worksheet.md` W14. Two placement calls were delegated to this phase.

## Options considered

### Option A — Reach as its own section in Shared Concepts; Stamping's Open section becomes "Layer selection (settled)" (chosen)
Reach sits between § Aggregated deference and § Clouds — the third graph-reading construct, parallel in shape to the deference closure. Stamping's open section is rewritten in place as the settled rule, keeping the two-axis framing as normative context. Pros: respects the primitive/policy split (Reach is a policy reading over `b`, like aggregation); one normative home each; the settled section preserves the framing readers already learned. Cons: none material.

### Option B — Reach defined in Inherit-From beside the deference closure
Rejected: inherit-from is the *primitive* spec (D1 split, `nip-reorg` ADR 0001); Reach is consumed by policy (stamp selection) and never by resolution — placing it in the primitive re-mixes the tiers the epic just separated.

### Option C — Reach defined locally in Stamping
Rejected: Reach is a general `b`-graph construct (discovery walks and future consumers relate); scoping it to one consumer invites a second definition later.

## Decision

**Option A**, with the delegated calls resolved: Reach = new § in Shared Concepts (definition, three-construct table, the two ratified properties); W14 flips via the W11 precedent — Status line → `Resolved → <normative homes> · raised 2026-07-12 · resolved 2026-07-13` plus a short **Resolution** block appended, question body preserved.

## Consequences

- Stamping carries no open sections; W14 closes one day after opening (the reorg's deferral did its job).
- Reach is view-dependent like everything else (computed from events the walker has seen) — stated in-section to keep the observer-relative rule unbroken.
- The floor's **affiliation-anchored** cloud handles are untouched (ratified verbatim); only the extras tier uses Reach.
- **Firmware reinstall required?** No.

## Implementation notes

**1. `protocols/drafts/shared-concepts.md`:**
- New section **"## Reach"** after § Aggregated deference: opens with the three-construct split as a small table — *affiliation* (one-hop declared claim → § Declared affiliation) / *deference closure* (inherit-typed transitive → [Inherit-From] § Resolution; feeds resolution and aggregation) / *reach* (any-type transitive closure from the author's own header; feeds stamp selection). Definition: computed on read, never stored; set semantics, cycles benign; includes edges of both types, the author's own and third parties'. The two ratified properties, stated normatively: (i) **permission-shaped** — a third party's edge can expand an author's reach (enable) but never stamps for them (route); the author selects at write time; (ii) **publisher-side SHOULD, never a reader gate** — a publisher SHOULD stamp only handles within its reach; a reader MUST NOT treat out-of-reach stamps as invalid; spam control is observer-weighted trust, not path validation (no global stamp validity exists). Close with the view-dependence sentence and a consumed-by pointer to Stamping.
- § Terminology: one-line gloss added near the observer-relative paragraph: reach is defined in § Reach (no second definition).
- § Declared affiliation: one sentence — affiliation is the single hop; the transitive candidate set it opens is § Reach.

**2. `protocols/drafts/stamping.md`:**
- Write rule: new item **3. Optionally, within the cap: demand-selected extras** — additional intersections (handles of ancestor set-layers via the derived superset structure × branch layers within the author's **reach**, [Shared Concepts] § Reach), selected by anticipated filter demand. **Ancestors are never required**; extras are a discoverability optimization, not membership. Publisher SHOULD stay within reach (per § Reach; readers don't enforce).
- Read contract: MUST-NOT bullet updated ("ancestor stamps existing" → "ancestor stamps existing — they are the *optional* tier, never guaranteed"); new bullet **"Breadth queries MUST expand"** — "all X including subsets" MUST walk the derived `IS_A_SUPERSET_OF` structure and union `#z` per subset, or knowingly accept the **defined floor**: a non-expanding client sees direct-layer members only (a specified outcome, not a defect); MAY-infer bullet's branch-inference clause cites § Reach.
- § "Open: which layers to stamp (set × branch)" → retitled **"Layer selection (set × branch) — settled"**: keeps the two-axis space and dynamic-ladder facts as normative context; replaces the candidate list with the rule (floor per items 1–2; extras per item 3; the interop-floor statement); drops all "candidate"/"none of this is normative" language; settlement provenance line (2026-07-13 ratification; W14; `w14-settlement` ADR 0001).
- Metadata header: Sources gains the ratification ADR; the header's W14 tracking note updated to resolved.

**3. `protocols/drafts/inherit-from.md`:** append one standalone sentence after the deference-closure paragraph (`:53` byte-identical): "The **any-type** counterpart — *reach*, the closure over both `b` types — is a distinct construct defined in [Shared Concepts](./shared-concepts.md) § Reach; it feeds stamp selection, never resolution."

**4. `protocols/worksheet.md` W14:** Status → `Resolved → [stamping spec] § "Layer selection" + [shared-concepts spec] § Reach · raised 2026-07-12 · resolved 2026-07-13`; append a **Resolution** block (A+B in two sentences, ADR cite); body preserved.

**5. Reviewer verification plan:** `git diff` file set = exactly these 4; inherit-from hunk adds one sentence and touches no existing line; grep stamping's settled section for `candidate|none.*normative|open design question` → 0; "reach" full definition exists once (shared-concepts § Reach) with only gloss/citations elsewhere; the floor items 1–2 byte-identical; W14 Status parses Resolved with history intact; vocabulary gate; links/anchors resolve (new § anchors used by stamping/worksheet must match derivation); harness-lint + `npm test` (11-suite environmental caveat, OPEN.md #27).

## Out of scope

Implementation of any kind; publication moves; tags.md/communities.md (no strictly-required touchpoint — the settled rule changes publisher policy, not the consumer specs' citations); W10/event-tagging.
