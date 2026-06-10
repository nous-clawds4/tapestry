# Story 5: Inherit-From (`b`) & Resolved Definition extraction

**Status:** Approved
**Created:** 2026-06-10
**Type:** Doc
**Epic:** protocols-directory — realizes `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` (§4 spec #5, §8 story 5)

## Background

The `b` tag (BIBLE §25, ADR 0027) and its read-side, Resolved Definition (§26, ADR 0028), form one protocol primitive in two halves: the *write* primitive ("my definition defers to this parent's, unless I state otherwise") and the *read* primitive (the live, deterministic merge that computes what a node's definition actually resolves to). They are wire format and resolution algorithm in the boundary rule's fullest sense — and the worksheet's W1 names the `b`-edge aggregation a candidate mechanism for the registry exit, so independent implementations have a concrete reason to want this spec. Today both halves live only in the BIBLE, interleaved with Neo4j edge-property detail, a Cypher closure expression, Communities-consumer notes, and PoV re-gating remarks.

This story extracts both sections into **one** spec (the handoff's map already binds them to a single file: the read primitive is meaningless without the write primitive and vice versa). Five calls distinguish it:

1. **The editorial-relationship family table.** §25 situates `b` against `REFERENCES`, `IMPORT`, and `SUPERCEDES` (posture/liveness/override/superset-implication). The contrast is part of `b`'s semantics — but the other three have no spec of their own. The treatment must include the contrast without implying those relationships are defined here.
2. **The Cypher closure.** §26 expresses the deference closure as a Neo4j query (`MATCH (n)-[:INHERITS_FROM*0..]->(x)`). The closure concept and the resolution pseudocode are protocol; the Cypher is implementation.
3. **The do-NOT-flip contrast.** §25's edge-direction warning explicitly contrasts with the `n`/`s` flip — which now lives in the class-thread spec, not §23. The contrast cross-references the spec.
4. **The cross-spec repoint coming due.** The class-thread spec carries two links to BIBLE §25 marked "(migration to this directory pending)". This story performs that migration, so those links repoint to the new spec and the pending-parentheticals come off.
5. **The proactive worksheet sweep** (mandated by story 4's review, which caught the third stale-ref casualty of this epic). Before review, the Implementer sweeps the whole worksheet — W1 and W6 cite §25/§26 directly — and anything else referencing the moved content.

## User-facing description

As a protocol author (and any implementer of definitional inheritance over DList objects), I want the `b` tag's wire format and the Resolved Definition algorithm in one self-contained spec, so that an independent implementation can publish deference claims, resolve effective definitions deterministically (same answer for every observer), and understand the trust consequences of live deference — without reading our codebase's documentation.

## Acceptance criteria

- [ ] Given a fresh clone of `staging`, when a reader opens `protocols/drafts/inherit-from.md`, then it is a self-contained spec with a repo-metadata header (status 📝 pre-NIP; sources: BIBLE §25/§26, ADRs 0027/0028; pattern: `protocols-directory` ADR 0001) covering at minimum: the `b` tag wire format (`["b", "<parent-a-tag>", "<type>"]`, type defaulting to `inherit`, the third element non-indexed positional); the kinds it is defined for (39998 **and** 39999 — broader than `n`/`s`); multi-parent semantics with first-listed-wins resolution; the derived relationship (`(child)-[INHERITS_FROM]->(parent)`) with the explicit do-NOT-flip warning contrasted against the class-thread tags (cross-referencing that spec); live read-time resolution (never snapshotted; tracks ancestors' future edits); the Resolved Definition algorithm (own-stated-fields win; first-listed `b` wins for unstated conflicts; visited-set cycle guard; always terminates with an answer; observer-independent) including the pseudocode; the trust-coupling security consideration (inheriting a parent means inheriting its future edits and trust trajectory; overrides and re-publishing as the escape hatches); the v1 scope (field-level whole-field override; set-valued override algebra explicitly deferred, cross-referencing worksheet W6); the aggregation rationale (a parent's incoming deference edges as a trust-weightable "who defers to this definition" signal, cross-referencing worksheet W1); and the editorial-relationship family contrast with an explicit disclaimer that `REFERENCES`/`IMPORT`/`SUPERCEDES` wire formats are not defined in this document.
- [ ] Given the new spec, when read by a stranger who has the DList base NIP, Tapestry Concepts, and the class-thread tags spec, then it contains no stack machinery: no Neo4j/Cypher/MERGE, no Communities feature mechanics or `effectiveCD` naming, no PoV/GrapeRank machinery, no ADR citations below the metadata separator, no deployment pubkeys.
- [ ] Given BIBLE §25 and §26 after the change, then: numbers, titles, and anchors unchanged; each pointer-first per the ADR 0001 pattern; §25 retains the Neo4j edge-property specifics, the Communities first-consumer note, the PoV/GrapeRank re-gating remark, and ADR cross-refs; §26 retains the Cypher closure expression and the `effectiveCD` naming note; and no wire format, algorithm step, or resolution rule is normative in both places.
- [ ] Given `protocols/drafts/class-thread-tags.md`, when its inherit-from references are followed, then both former BIBLE-§25 links point at the new spec and no "migration pending" parenthetical remains.
- [ ] Given `protocols/worksheet.md` after the mandated proactive sweep, then no entry claims content §25/§26 no longer carry (W1's and W6's refs at minimum), and each repoint is individually flagged for the Reviewer.
- [ ] Given the rest of the repo, when references into §25/§26 are followed (BIBLE §22's `b`-edge and grapevine-resolution mentions, §23's rewritten pointer to §25, the Glossary if applicable), then every reference still resolves and none claims content the sections no longer carry.
- [ ] Given `protocols/README.md`, when a reader consults the spec index, then the Inherit-From & Resolved Definition row links to the new file as the working copy (story 5 ✅).
- [ ] Given the full change, when `npm test` runs, then it passes unchanged; and no BIBLE sections other than §25 and §26 are modified.

**Traceability rule (carried forward):** every normative statement traces to BIBLE §25/§26, ADRs 0027/0028, or — for the direction contrast — the class-thread tags spec. Unsourceable statements are flagged; honest gaps are marked explicitly in the spec text.

## Concepts touched

None in the concept-graph sense (no events, no firmware, no reinstall). The spec *describes* the `b` tag riding on kinds 39998/39999 already specified upstream.

## Out of scope

- Resolving worksheet W6 (set-valued override algebra) or W1 (concept identity) — the spec points at both.
- Defining wire formats for `REFERENCES`/`IMPORT`/`SUPERCEDES`.
- Story 6 (Communities) and story 7 (Tags & Taggings).
- Publishing the pre-NIP.
- The optional one-line "curator" definition noted in story 4's review — defer unless the Architect folds it into the class-thread repoint touch at zero marginal cost.

## Open questions

- **Architecture phase?** **Resolved at the gate: runs, thin (ADR 0003)** — the family-table treatment, the Cypher neutralization, and the single-spec structure for two BIBLE sections are genuine calls, and the thin-ADR pattern has now paid for itself twice. Confirm at the gate.
- Spec title: "Inherit-From & Resolved Definition" per the handoff — confirm or revise at review.

## Linked artifacts

- Design record: `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` §2/§4; pattern: `protocols-directory` ADR 0001; predecessor: ADR 0002
- ADR: `engineering-team/decisions/protocols-directory/0003-inherit-from-extraction.md` (`protocols-directory` ADR 0003, thin) — Accepted
- Test plan: skipped (docs-mode)
- Review: (filled in after Review phase)
