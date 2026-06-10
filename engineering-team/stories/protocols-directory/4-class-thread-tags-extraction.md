# Story 4: Class-Thread Membership Tags (`n`, `s`) extraction

**Status:** Approved
**Created:** 2026-06-10
**Type:** Doc
**Epic:** protocols-directory — realizes `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` (§4 spec #4, §8 story 4)

## Background

The `n` and `s` tags — the canonical single-char, child-claims-parent encodings of class-thread membership and superset structure, established by ADR 0011 — are wire format in the fullest sense: they are relay-indexed by design, they exist precisely so independent curators' graphs can be traversed by tag filters, and the Communities work consumes them across deployment boundaries. Today their only normative home is BIBLE §23, interleaved with Tapestry's emission sites, back-compat dual-emit policy, and our puller's mechanics. Story 3 (Tapestry Concepts, `protocols-directory` ADR 0001) established the extraction pattern; this story applies it to §23.

Three boundary calls distinguish this section from story 3's, and the story names them so they're decided deliberately rather than incidentally:

1. **The consumer trust constraints.** §23 carries three *binding* constraints on consuming foreign curators' `n`/`s` tags (authorship gate; local-graph isolation; class-thread-only edges). Some of this is protocol-level security guidance any independent consumer needs to be safe (the cross-instance-election attack is not Tapestry-specific); some is wired to Tapestry's own anchor mechanics. The split must be explicit.
2. **The dual-emit policy** (emission sites, descriptor-event back-compat cycle, future cutover) — Tapestry migration mechanics, not protocol.
3. **The relationship vocabulary.** §23's table maps tags to "Neo4j edges." The *logical relationship names* (`HAS_ELEMENT`, `IS_A_SUPERSET_OF`) are protocol vocabulary — they're the semantic content of the tags and appear in word-wrapper `relationshipTypes` payloads — but Neo4j-as-the-store is implementation. The spec speaks of derived graph relationships; the BIBLE keeps the store.

## User-facing description

As a protocol author (and any implementer of a client or service that traverses class threads across curators), I want the `n`/`s` tag wire format and its consumer safety rules in one self-contained spec, so that an independent implementation can publish and consume class-thread structure — and refuse the known abuse patterns — without reading our codebase's documentation.

## Acceptance criteria

- [ ] Given a fresh clone of `staging`, when a reader opens `protocols/drafts/class-thread-tags.md`, then it is a self-contained spec with a repo-metadata header (status 📝 pre-NIP, sources: BIBLE §23 + ADR 0011, pattern: `protocols-directory` ADR 0001) covering at minimum: the `n` and `s` tag definitions with child-claims-parent direction; the single-char/relay-indexed rationale; the tag-value format (parent's a-tag form); multi-parent semantics; the mapping from each tag to the logical relationship a consumer derives (including the direction flip from on-wire child-claims-parent to derived parent→child); the protocol-level consumer security considerations; the direction principle (lowercase = child-claims-parent; uppercase reserved for inverses, explicitly not to be assigned speculatively); and the future-candidate letter discipline with a cross-reference to worksheet W2.
- [ ] Given the new spec, when read by someone with no Tapestry deployment (but who has the DList base NIP and the Tapestry Concepts pre-NIP), then it contains no stack machinery: no Neo4j-as-store, no emission-site function names, no Tapestry story/PR numbers, no endpoint paths. Logical relationship names are retained as protocol vocabulary.
- [ ] Given the spec's treatment of the inherit-from (`b`) tag, when it references it (the direction principle and the family contrast make some reference likely), then it points at the b tag's current normative home (BIBLE §25, until story 5 migrates it) without duplicating its definition.
- [ ] Given BIBLE §23 after the change, then: number, title, and anchor unchanged; pointer-first shape per the ADR 0001 pattern; retains the Tapestry-side material (dual-emit emission sites and back-compat cycle, the puller-anchor specifics, whatever portion of the trust constraints is implementation-bound); and no tag definition, value format, or constraint is normative in both places.
- [ ] Given the rest of the repo, when references into §23 are followed (§22's `n`/`s` mentions, §25's citations of §23's convention, worksheet W2/W5 claims), then every reference still resolves and none claims content §23 no longer carries.
- [ ] Given `protocols/README.md`, when a reader consults the spec index, then the Class-Thread Membership Tags row links to the new file as the working copy (story 4 ✅).
- [ ] Given the full change, when `npm test` runs, then it passes unchanged; and no BIBLE section other than §23 is modified.

**Traceability rule (carried from story 3):** every normative statement in the spec must trace to BIBLE §23, ADR 0011, or — for the `b`-tag direction contrast, if included — BIBLE §25 / ADR 0027. Anything unsourceable is flagged to the Reviewer; honest gaps are marked explicitly in the spec text rather than papered over.

## Concepts touched

None in the concept-graph sense (no events, no firmware, no reinstall). The spec *describes* how class-thread structure rides on kind-39999 events already specified in the Tapestry Concepts pre-NIP.

## Out of scope

- §25/§26 extraction (story 5 — inherit-from and Resolved Definition).
- Resolving worksheet W2 (the single-char registry) or assigning any candidate letters.
- Any change to the dual-emit behavior itself, or to code.
- Publishing the pre-NIP.

## Open questions

- **Architecture phase?** **Resolved at the gate: runs, thin.** ADR 0001 already fixes the macro pattern (skeleton discipline, pointer-first BIBLE shape, source-map requirement), so the ADR here is small — but the trust-constraint split and the `b`-tag cross-reference form are genuine design calls this story should not leave to prose-writing time. Confirm at the gate.
- Spec title: "Class-Thread Membership Tags" per the handoff — confirm or revise at review.

## Linked artifacts

- Design record: `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` §2/§4; pattern: `engineering-team/decisions/protocols-directory/0001-tapestry-concepts-extraction.md`
- ADR: (pending — see open questions)
- Test plan: skipped (docs-mode)
- Review: (filled in after Review phase)
