# Story 3: Tapestry Concepts extraction

**Status:** Approved
**Created:** 2026-06-10
**Type:** Doc
**Epic:** protocols-directory — realizes `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` (§4 spec #3, §8 story 3)

## Background

The wire format that makes a Tapestry deployment interoperable — the four event kinds, a-tag addressing, the `z` parent pointer, the `concept-graph` header tag and its resolution contract, `json`-tag data storage, the word-wrapper payload format, and the 8-core-node scheme — lives only inside BIBLE §5, §8, and §9, interleaved sentence-by-sentence with Tapestry implementation detail (Neo4j property names, emission sites, ADR history, UI audit buttons). An independent implementer cannot today be handed one document that defines the Tapestry Concepts protocol, and the BIBLE can't be edited for implementation reasons without risking accidental wire-format drift.

This is the first story that edits the BIBLE. It applies the boundary rule from `protocols/README.md`: the wire format moves to a pre-NIP; the BIBLE keeps a normative pointer plus the implementation detail that was always its real job. It also amends the Protocol-Spec workflow charter, whose ratify phase still names "BIBLE prose" as the deliverable — from this story on, ratified wire formats land in `protocols/` with the BIBLE holding pointers.

## User-facing description

As a protocol author (and as any future implementer of a Tapestry-compatible client or deployment), I want the Tapestry Concepts wire format defined in one self-contained spec that a stranger could implement from without knowing our stack, so that the protocol can be read, evolved, and eventually published independently of how brainstorm.world happens to store and display things.

## Acceptance criteria

- [ ] Given a fresh clone of `staging`, when a reader opens `protocols/drafts/tapestry-concepts.md`, then it is a self-contained spec with a repo-metadata header (status 📝 pre-NIP, not published, sources: BIBLE §5/§8/§9 and ADR 0007) covering at minimum: the four event kinds and their roles; the kind-unification principle; a-tag addressing; the `z` parent pointer; the `concept-graph` tag **with its tag-else-compute resolution contract**; the implicit-vs-explicit relationships principle including the named editorial relationship types; `json`-tag data storage with concept-slug namespacing; the word-wrapper format (structure plus worked examples); and the 8-core-node scheme with the core-node wire shape.
- [ ] Given the new spec, when it describes its relationship to other specs, then it states explicitly that it builds on the Decentralized Lists base NIP (same kinds, extended conventions) and cross-links it.
- [ ] Given the new spec, when read by someone with no Tapestry deployment, then it contains no stack-specific machinery: no Neo4j/Meilisearch/strfry references, no UI pages or buttons, no CLI commands, no firmware-install mechanics. Where concept identity is deployment-relative (e.g. which pubkey publishes the well-known core-node concept headers), the spec says so in deployment-neutral terms and points at worksheet W1 rather than hardcoding any pubkey.
- [ ] Given BIBLE §5, §8, and §9 after the change, when a reader opens each, then: the section number and title are unchanged (all existing anchors and the TOC still resolve); each opens with a short normative pointer to the spec; each retains the Tapestry-specific implementation content (e.g. §5's `uuid`-property-on-Neo4j note and ADR cross-references, §9's Health Audit UI); and no wire-format table, tag definition, or JSON wire example remains normative in both places.
- [ ] Given the rest of the repo, when existing references into §5/§8/§9 are followed (BIBLE TOC, other BIBLE sections such as §22's pointer to §5, `protocols/worksheet.md` refs, AGENTS.md if applicable), then every reference still resolves and none claims content the section no longer carries.
- [ ] Given `protocols/README.md`, when a reader consults the spec index, then the Tapestry Concepts row links to the new file as the working copy (story 3 ✅) and no longer lists BIBLE sections as the content's location.
- [ ] Given `engineering-team/workflows/protocol-spec-workflow.md`, when a reader consults the ratify phase, then a one-paragraph amendment records that ratified wire-format specs now land in `protocols/` (nips/ or drafts/ per status) with the BIBLE holding a pointer + implementation detail — and the docs-mode role descriptions read consistently with that.
- [ ] Given the full change, when `npm test` runs, then it passes unchanged.

**Traceability rule (this story's analog of story 2's fidelity rule):** the spec is a rewrite, not a copy — new connective prose is expected — but **every normative statement must be traceable to BIBLE §5/§8/§9, ADR 0007, or the Decentralized Lists NIP**. Any statement the Implementer believes is true but cannot source must be flagged to the Reviewer (and is a candidate for the worksheet instead). No new protocol behavior is invented in a migration story.

## Concepts touched

None in the concept-graph sense (no events published, no firmware change, no reinstall). The documents *describe* the core-node concept family (`superset`, `json-schema`, `primary-property`, `properties-set`, `property-tree-graph`, `concept-graph`, `core-nodes-graph`) — descriptions move; definitions don't change.

## Out of scope

- Extracting §22 (Communities — story 6), §23 (`n`/`s` — story 4), §25/§26 (`b` / Resolved Definition — story 5).
- BIBLE §6 (Neo4j data model), §7 (Firmware), §10 (Normalization rules) — implementation; they stay, and §10's enforcement posture is untouched even where its rules restate protocol facts.
- Resolving worksheet W1 (cross-deployment concept identity) — the spec may point at it, not answer it.
- Publishing the pre-NIP anywhere.
- Any code change.

## Open questions

- **Architecture phase?** ~~Recommendation: skip~~ **Resolved at the gate: Architecture runs.** This story carries more judgment than stories 1–2 (the per-line §5 split, deployment-neutral rewording of §9's firmware language); the ADR will fix the line-level split and the spec's structure before prose is written. The Review additionally keeps the boundary-discipline audit dimension.
- Spec title: "Tapestry Concepts" per the handoff — confirm, or rename at review if the Implementer surfaces a better fit for eventual publication.

## Linked artifacts

- Design record: `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` §2 (boundary rule), §4 (spec #3)
- ADR: (recommended skipped — see open questions)
- Test plan: skipped (docs-mode)
- Review: (filled in after Review phase)
