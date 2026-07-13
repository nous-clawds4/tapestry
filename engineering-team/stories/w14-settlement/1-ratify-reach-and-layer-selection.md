# Story 1: Ratify Reach and the layer-selection rule (settle W14)

**Status:** Approved
**Created:** 2026-07-13
**Type:** Doc

## Background

The nip-reorg epic deliberately shipped Stamping with its layer-selection question open (W14) rather than settling it mid-reorganization. The settling `/discuss` ran 2026-07-13 and the protocol author ratified both halves: **(A)** the correspondence-closure question resolves by a three-term split — *affiliation* (the one-hop declared claim), the *deference closure* (inherit-typed, unchanged), and **Reach** (the any-type transitive `b` closure) — with Reach permission-shaped (third-party edges expand an author's candidate set but never act for them) and enforced nowhere (publisher-side SHOULD; readers filter by observer-weighted trust, never by graph-path validity); **(B)** layer selection resolves as floor-plus-extras — the already-ratified floor (personal `z` + joined-concept cloud handles), optional demand-driven intersections within the cap drawn from reach, ancestors never required — with the co-stated read contract making breadth queries expand via the `s`-walk or knowingly accept the defined non-expanding-client floor. This story writes the ratification into the specs. It is this book's sole story; the book's acceptance frame is the ratification itself (eager anchor).

## User-facing description

As an implementer of a publisher or reader client, I want the stamp-selection rule and its read contract to be normative rather than open, so that I can build against a settled interoperability contract — knowing exactly which stamps I may emit, which I may assume, and what a non-expanding client is defined to see.

## Acceptance criteria

- [ ] **AC1 — Reach is defined, once.** Shared Concepts defines **Reach** normatively: the set of headers connected to the author's own header through `b` edges of *either* type, transitively. The three-term split is explicit (affiliation / deference closure / reach) with cross-references to Inherit-From for the deference closure. The two ratified properties are stated: third-party edges **expand the candidate set** (permission-shaped — they enable, never route; the author still selects at write time), and reach is a **publisher-side SHOULD** for stamp selection, never a reader-side validity gate (readers rank by observer-weighted trust; no global stamp validity exists). D2 vocabulary and the observer-relative rule hold throughout.
- [ ] **AC2 — the write rule extends.** Stamping's write rule keeps its required floor verbatim (personal `z` + joined-concept cloud handles) and adds the ratified optional tier: additional intersections (ancestor set-layers × reached branch handles) selected by anticipated filter demand, within the cap, drawn only from the author's reach; **ancestors are never required**. The former "affiliation-backed" reach phrasing adopts the Reach term.
- [ ] **AC3 — the read contract completes.** Breadth queries ("all X including subsets") **MUST expand** via the derived superset walk or knowingly accept floor-level recall; the non-expanding-client floor is *defined* as direct-layer members only (a specified outcome, not a defect); the existing MUST-NOT-assume-ancestor-stamps and MAY-infer bullets are made consistent with Reach.
- [ ] **AC4 — the question closes.** Stamping's § "Open: which layers to stamp" is replaced by (or reduced to a short settled-note pointing at) the now-normative rule — no "candidate"/"none normative" language survives in the settled parts; worksheet **W14 flips to Resolved/graduated** with pointers to the normative homes, its history preserved.
- [ ] **AC5 — Inherit-From stays intact.** One clarifying cross-reference near the deference-closure passage noting the any-type counterpart (Reach) is defined in Shared Concepts; the ratified sentence at `inherit-from.md:53` itself remains verbatim.
- [ ] **AC6 — gates and scope guard.** Reach normative in exactly one place; vocabulary policy holds; all links/anchors resolve; historical records untouched; harness-lint clean; `npm test` stack-free green (the known 11-suite environmental caveat, OPEN.md #27, stands); diff limited to the ADR-enumerated files.

## Concepts touched

None mutated (docs-mode; no wire-format change — Reach is a definitional/read-side construct over existing `b` edges).

## Out of scope

- Any implementation (resolver, cloud computation, stamp-writer changes, pins dual-`z`).
- Publication-ladder moves; target-typed tag definitions (W10 lineage); event-tagging rollout.
- `tags.md`/`communities.md` edits unless the Architect finds a strictly-required touchpoint (expected: none).

## Open questions

- None blocking. Reach's exact placement in Shared Concepts and the W14 flip format are Architect calls.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: skipped — docs-mode
- Review: (filled in after Review phase)
