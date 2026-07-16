# ADR 0001 (protocols-directory): Tapestry Concepts extraction — spec skeleton and the §5/§8/§9 split

**Status:** Accepted
**Date:** 2026-06-10
**Story:** `engineering-team/stories/protocols-directory/3-tapestry-concepts-extraction.md`

> **Numbering note:** numbered per the per-epic scheme (`engineering-team/README.md` § "Epic-scoped docs" — ADR `<NNNN>` restarts inside each epic folder; cite qualified: "`protocols-directory` ADR 0001"). First ADR of this epic.

## Context

Story 3 moves the Tapestry Concepts wire format out of BIBLE §5 (The Tapestry Protocol, BIBLE.md:190–240), §8 (Word-Wrapper JSON Format, :388–475), and §9 (Core Nodes of a Concept, :477–506) into `protocols/drafts/tapestry-concepts.md`, leaving each BIBLE section as a normative pointer plus implementation detail. The boundary rule is fixed by `protocols/README.md` ("signed events an independent implementation must parse/produce → protocols/; how our stack stores/computes/displays → BIBLE"). What this ADR must decide is the **line-level application** of that rule — the three sections interleave the two registers sentence by sentence — plus the spec's skeleton, the rewritten shape of the BIBLE sections, and the workflow-charter amendment.

Constraints:

- Story AC: §5/§8/§9 keep numbers, titles, and anchors (BIBLE TOC, §22's "ADR 0007, §5" pointer, and `protocols/worksheet.md` refs must survive).
- Story AC: the spec is stranger-readable — no Neo4j/Meili/strfry/UI/CLI/firmware-install machinery; no hardcoded deployment pubkeys; deployment-relative identity points at worksheet W1.
- Story traceability rule: every normative spec statement traces to BIBLE §5/§8/§9, ADR 0007, or the DList base NIP; nothing new is invented.
- Concept Graph API is down; deliberately not needed — the spec must not embed handles (the slugs it names are documented at BIBLE.md:481–490).
- Docs-mode: no code, `npm test` must stay green (no BIBLE-content sentinels exist in the suite).

## Options considered

### Option A — Restructured self-contained spec + per-line split (chosen)

Write the spec as a reader-ordered document (kinds → addressing → linking → payloads → composite structure → resolution → principles), allocating each §5/§8/§9 sentence to exactly one side per the split table below. Implementer produces a **source map** (spec section → BIBLE lines / ADR 0007 / DList NIP section) in the implementation report so the Reviewer's traceability audit is mechanical.

Pros: produces the thing the story actually wants — a spec a stranger could implement from; the split table + source map make review tractable. Cons: most judgment of the three options; mitigated by fixing the split in this ADR rather than during prose-writing.

### Option B — Verbatim block-move

Copy §5/§8/§9 bodies into the spec with minimal glue; BIBLE sections become bare pointers.

Pros: near-perfect traceability, fastest. Cons: violates two story ACs by construction — Neo4j/UI language ("uuid property on Neo4j nodes", Health Audit buttons) and firmware framing would leak into the spec; the result reads as three stitched BIBLE fragments, not a spec. Rejected.

### Option C — Partial extraction (§5 + §8 only; defer §9)

Pros: smallest judgment surface (avoids the firmware-language rewording). Cons: the spec would be incomplete in a load-bearing way — §5's `concept-graph` resolution contract names a core-node address (`…-concept-graph`) whose meaning lives in §9's scheme; core nodes are wire-visible events. The index row would also be half-true. Rejected.

## Decision

We chose **Option A**. The split, the skeleton, and the BIBLE rewrite shapes are fixed below; the Implementer writes prose within them.

### The split table (normative for this story)

**§5 The Tapestry Protocol (BIBLE.md:190–240):**

| Content | Goes to spec | Stays in BIBLE §5 |
|---|---|---|
| Event-kinds table (39998/39999/9998/9999) | ✅ whole table | — (pointer covers it) |
| Kind Unification subsection | ✅ whole | — |
| Addressing: `<kind>:<pubkey>:<d-tag>` stable address | ✅ | "stored as the `uuid` property on Neo4j nodes… primary identifier throughout the system" |
| z-tag definition + JSON example | ✅ (plus the relationship to the DList base NIP's broader z-value forms — Tapestry requires the a-tag form; traceable to :211–215 and the base NIP) | — |
| `concept-graph` tag: format, computed-not-looked-up, **tag-else-compute resolution contract**, deterministic `…-concept-graph` d-tag, off-relay self-resolution rationale, legacy-headers coverage | ✅ | "emitted by `create-concept`" (emission site), the `IS_THE_CONCEPT_GRAPH_FOR` Neo4j-edge contrast, "ADR 0007, hybrid design C; consumer is the deferred element/superset materialization stream" |
| Implicit vs. Explicit Relationships: the principle (most relationships derived from event structure; only editorial/provenance ones are events), the four named editorial types (IMPORT, SUPERCEDES, PROVIDED_THE_TEMPLATE_FOR, ENUMERATES), the two "do not" guidances | ✅ with "Neo4j relationship" reworded to "derived graph relationship" | cross-ref to §6 for how the graph engine materializes derived relationships |
| JSON Data Storage: `json` tag, concept-slug namespacing, multi-concept payloads, `content` = human-readable | ✅ whole | — |

**§8 Word-Wrapper JSON Format (:388–475):** the format definition moves wholly — canonical structure, the `word` block fields (slug/name/title/wordTypes/coreMemberOf), the nine type-specific keys, both worked examples. Stays in §8: the framing sentence that all core nodes **and firmware concepts** use it (firmware is deployment machinery), plus a cross-ref to §7 for schema validation at install.

**§9 Core Nodes of a Concept (:477–506):** moves: the 8-node table and the core-node wire shape (kind 39999; `z` to the deployment's core-node concept; `json` in word-wrapper; wiring expressed via `coreMemberOf` + the deterministic d-tag convention). **Reworded for deployment neutrality:** the "z-tag concept" column's targets become "well-known core-node concept slugs (`superset`, `json-schema`, `primary-property`, `properties-set`, `property-tree-graph`, `concept-graph`, `core-nodes-graph`), published per deployment — see worksheet W1 for the open cross-deployment identity question." No pubkey appears. Stays in §9: the Health Audit subsection in full (UI), and a sentence noting that in this deployment the core-node concept headers are firmware-published (§7).

### Spec skeleton (headings fixed; prose is the Implementer's)

```
(repo-metadata header: 📝 pre-NIP · not published · sources: BIBLE §5/§8/§9, ADR 0007, DList base NIP)
---
Tapestry Concepts
=====
## Relationship to Decentralized Lists     (builds on the base NIP's kinds; what this spec adds)
## Event kinds                              (the four kinds; ListHeader/ListItem)
## Addressing                               (a-tag form)
## The parent pointer (z tag)               (a-tag form required; relation to base NIP's z forms)
## Kind unification                         (position in graph, not kind)
## Data storage (json tag)                  (namespacing; content = human text)
## The word-wrapper format                  (structure; word block; type-specific keys; 2 examples)
## Core nodes of a concept                  (8-node table; core-node wire shape; deterministic d-tags)
## The concept-graph header tag             (format; tag-else-compute resolution contract)
## Derived vs. explicit relationships       (principle; the four editorial types; the two guidances)
## Concept identity across deployments     (deployment-relative; → worksheet W1)
```

### BIBLE rewrite shape (each section)

Uniform pattern, mirroring how `protocols/README.md` describes the boundary: section keeps number + title; first paragraph is the normative pointer ("The wire format is specified in [protocols/drafts/tapestry-concepts.md](…) — normative. This section covers how this codebase implements it."); remainder is the kept implementation content from the split table. No wire table, tag definition, or JSON wire example survives in the BIBLE copy.

### Workflow amendment (`engineering-team/workflows/protocol-spec-workflow.md`)

One new paragraph in "### 3. Ratify" stating: ratified wire-format specs land under `protocols/` (`drafts/` or `nips/` per the status ladder) with the BIBLE section holding a normative pointer + implementation detail; plus the minimal consistent wording touches — the flow table's deliverable cell ("BIBLE sections + ADRs" → "protocols/ specs + BIBLE pointers + ADRs") and the docs-mode Implementer bullet ("writes BIBLE prose" → "authors the spec under protocols/ and the BIBLE pointer section"). Nothing else in the charter changes.

## Consequences

- Enables: a publishable, stranger-readable Tapestry Concepts pre-NIP; BIBLE sections that can evolve implementation detail without touching wire format; the pattern stories 4–6 will reuse (this ADR is their template).
- Constrains: spec headings are fixed by this ADR — Implementer kickbacks come here if a heading proves wrong, not silent restructuring.
- Debt/follow-ups: worksheet W1 gains its first in-spec consumer; the four editorial relationship types are named in the spec without wire formats (their descriptor-event format is BIBLE §6/§23 territory — candidate for a future spec story, noted in Out of scope).
- **Firmware reinstall required?** No. No concept definitions change.

## Implementation notes

- File: `protocols/drafts/tapestry-concepts.md` — new, per skeleton; header-block format follows `protocols/drafts/decentralized-lists-compat.md`.
- File: `BIBLE.md` — rewrite §5 (:190–240), §8 (:388–475), §9 (:477–506) per the split table; TOC untouched (titles unchanged); verify §22's "(implemented — ADR 0007, §5)" sentence still reads true (it does — §5 retains the ADR 0007 implementation note).
- File: `protocols/README.md` — index row 3 → working-copy link, "story 3 ✅", source column → "Working copy here" (BIBLE §5/§8/§9 hold implementation + pointers).
- File: `engineering-team/workflows/protocol-spec-workflow.md` — amendment per Decision.
- Implementation report must include the **source map** table (spec section → BIBLE line ranges / ADR 0007 / DList NIP §) for the Reviewer's traceability audit.
- Gates: `npm test` green; no other BIBLE sections touched; `git diff` scope = these four files.

## Out of scope

- Wire formats for the editorial relationship descriptor events (IMPORT, SUPERCEDES, …) — future story if/when they're spec'd.
- Resolving worksheet W1.
- §22/§23/§25/§26 extractions (stories 4–6) — they reuse this pattern via their own ADRs or cite this one.
- Publishing the pre-NIP.
