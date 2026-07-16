# ADR 0003 (protocols-directory): Inherit-from extraction — §25/§26 split, single-spec skeleton

**Status:** Accepted
**Date:** 2026-06-10
**Story:** `engineering-team/stories/protocols-directory/5-inherit-from-extraction.md`

> Thin ADR: inherits the macro pattern from [`protocols-directory` ADR 0001](./0001-tapestry-concepts-extraction.md) (skeleton discipline, pointer-first BIBLE shape, source map, gates) and the security-considerations precedent from [ADR 0002](./0002-class-thread-tags-extraction.md). Only §25/§26-specific decisions here.

## Context

Story 5 extracts BIBLE §25 (The Inherit-From Tag, ~:1500) and §26 (Resolved Definition, ~:1544) into one spec, `protocols/drafts/inherit-from.md`. The two sections are one primitive's write and read halves; the handoff's map binds them to a single file. The story fixes five calls; this ADR settles each plus the skeleton.

## Decision

### (1) Single spec, 9-heading skeleton (fixed)

```
(repo-metadata header: 📝 pre-NIP · sources: BIBLE §25/§26, ADRs 0027/0028 · pattern: protocols-directory ADR 0001)
---
Inherit-From & Resolved Definition (b)
=====
## Relationship to other specs              (rides on the DList/Tapestry-Concepts kinds; sibling of class-thread tags)
## The b tag                                (wire format ["b","<parent-a-tag>","<type>"], type default "inherit",
                                             third element non-indexed positional; kinds 39998 AND 39999)
## Multi-parent semantics                   (multiple b tags; order is load-bearing — resolved below)
## The derived relationship                 (INHERITS_FROM, child→parent, do-NOT-flip contrast; asserted; carries type)
## Resolution: the resolved definition      (live read-time; own-fields-win; first-listed-wins; visited-set;
                                             always-an-answer; observer-independent; the pseudocode)
## Scope (v1)                               (field-level whole-field override; set-valued algebra deferred → W6)
## Security considerations                  (trust-coupling of live deference; overrides + re-publishing as escape hatches)
## Aggregation: who defers to a definition  (incoming INHERITS_FROM as trust-weightable signal → W1)
## Place in the editorial-relationship family (the contrast table + not-defined-here disclaimer)
```

Order: wire format → derivation → resolution → scope → security → uses → family. Resolution lives in one section (the §26 algorithm subsumes §25's resolution sketch — no duplication between the spec's own sections).

### (2) Family table: include, with disclaimer

§25's four-row contrast table (`REFERENCES`/`IMPORT`/`SUPERCEDES`/`b` × posture/liveness/override/implies-superset) moves to the spec essentially verbatim — the contrast *is* part of `b`'s semantics. It is bracketed by an explicit disclaimer: only `b` is defined in this document; the other three are named for contrast, their wire formats are unspecified (`REFERENCES`' open semantics tracked at worksheet W5). The §6-pointer framing from §25's table intro stays in the BIBLE.

### (3) Cypher neutralization

The spec states the closure abstractly: the set of nodes reached by following `b` deference transitively, computed on read and never stored, not guaranteed acyclic (the resolution rule's visited-set handles cycles). BIBLE §26 keeps `MATCH (n)-[:INHERITS_FROM*0..]->(x)` as this codebase's derived-query expression of it.

### (4) Do-NOT-flip contrast

The spec's derived-relationship section states: unlike the [class-thread tags](../../protocols/drafts/class-thread-tags.md) (spec path from the new file: `./class-thread-tags.md`), whose child-claims-parent encoding is flipped into a parent→child derived relationship, `b` does **not** flip — consumers derive `(child)-[INHERITS_FROM]->(parent)` — with §25's two reasons (deference reads child→parent; a parent's *incoming* edges are exactly the "who defers to this definition" query the aggregation section needs). Implementers must not copy the `n`/`s` flip.

### (5) Class-thread repoints + the curator gloss (rides along)

Both `[BIBLE §25](../../BIBLE.md#25-the-inherit-from-tag-b)` links in `protocols/drafts/class-thread-tags.md` → `[Inherit-From & Resolved Definition](./inherit-from.md)`; the "(migration to this directory pending; see the [spec index](../README.md))" parenthetical comes off. **Curator gloss: include** — same file, zero marginal cost: one parenthetical in that spec's Security-considerations intro, "(a *curator* here is the keyholder whose signed events define a graph)" — the formulation story 4's review recorded. Flagged in the source map as a clarifying gloss, not sourced wire behavior.

### (6) Worksheet sweep scope

Full-file grep (`§25`, `§26`, `BIBLE §2[56]`) plus a per-entry read. Expected repoints, each flagged: **W1** (body "(ADR 0027; BIBLE §25)" and refs "§25 (`b` tag)"), **W2** (refs "BIBLE §25 (`b`/`B`)"), **W6** (body "(BIBLE §26)" and refs "§25 (scope note), §26 (Scope v1)" — and W6's "the algebra belongs in the inherit-from spec" becomes literally true: point it at the spec's Scope section). Anything else the grep surfaces gets the same treatment.

### BIBLE rewrite shapes

- **§25** pointer-first; retains: Neo4j edge-property mechanics (no `source` property, the REFERENCES-stub contrast, `type` property mirroring), the Communities first-consumer note (`affiliation` → `b` with type `inherit`), the PoV/GrapeRank re-gating remark, ADR 0027 pointer + deferred-questions note.
- **§26** pointer-first; retains: the Cypher closure, the `effectiveCD` named-instance note, the ADR 0028 pointer and the ADR-0027-deferral history sentence.
- Trust-coupling is **not** restated in the BIBLE (it is the spec's security section); §22's grapevine-resolution linkage stays in §22 untouched.

## Options considered

One-spec vs two-specs was the only structural fork: two files would sever the write/read halves the story declares inseparable and double the cross-reference surface; rejected without ceremony. The remaining calls are splits, not forks, fixed above.

## Consequences

- The `b` primitive becomes independently implementable, including its trust story — the piece W1's registry-exit candidacy needs.
- Two spec files change in one story for the first time (inherit-from new, class-thread repointed) — the Reviewer's reference dimension must cover both directions.
- **Firmware reinstall required?** No.

## Implementation notes

- Files: `protocols/drafts/inherit-from.md` (new); `BIBLE.md` (§25 + §26 only — exactly two hunks); `protocols/drafts/class-thread-tags.md` (two repoints + curator gloss); `protocols/worksheet.md` (sweep results); `protocols/README.md` (row 5 → working copy, story 5 ✅).
- Source map required (spec section → §25/§26 lines / ADR 0027/0028 / class-thread spec for the contrast), flags: curator gloss; each worksheet repoint; the family-table disclaimer.
- Gates: `npm test`; §25/§26 anchors/titles unchanged; exactly two BIBLE hunks; dual-normativity landmark sweep (wire format, pseudocode, first-listed-wins, trust-coupling).

## Out of scope

- Resolving W1/W5/W6; defining `REFERENCES`/`IMPORT`/`SUPERCEDES` wire formats.
- Stories 6–7.
- Publishing.
