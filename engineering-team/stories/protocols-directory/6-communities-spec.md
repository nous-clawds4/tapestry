# Story 6: Communities pre-NIP (synthesis)

**Status:** Approved
**Created:** 2026-06-10
**Type:** Doc
**Epic:** protocols-directory — realizes `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` (§4 spec #6, §8 story 6)

## Background

This is the epic's first **synthesis** story: the Communities wire format has no single home to extract from. Four source families exist, of different authority and freshness:

1. **`docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md`** (🔴 OPEN, 2026-06-05) — the Communities Protocol capture doc. Its design is **settled** (§1–§6: no-privileged-center tenet, Resolved Definition as foundation, identity = concept identity, membership = consume the pubkey-tag); its one open item is **§7 delivery: the three-branch reconciliation**, an org decision for the project owner + Avi + Vinney. This is the design authority. Notably, it already declared its general piece (Resolved Definition) ready to extract — which story 5 has since done.
2. **`feat/communities` branch specs** (read via `git show`, never merged): `COMMUNITY_RECORDS_DLIST.md` (the personal community-record layer — per-user `brainstorm-communities` index, record items with engine config) and `COMMUNITY_ENDORSEMENTS_DLIST.md` (the global signal layer — endorsement/veto items). Mature wire-format documents, already written against the reconciled DList base NIP conventions.
3. **The branch's communities ADR line** (12 ADRs: declaration shape 0029, membership-from-tags 0030, roster topology 0031, degraded posting 0032, threading/reactions/live-updates/signs-of-life 0033–0036, notifications 0037–0038, foothold invite/accept 0039–0040).
4. **BIBLE §22** (Community-Reference Model) — the resolution model (`grapevine-resolved → firmware-blessed → none`), Flaw A and its registry exit, and the Phase A/B implementation record.

The synthesis must produce one spec ratifying the settled design without deciding what is genuinely undecided, and without absorbing implementation material that belongs in the BIBLE or the branch.

## User-facing description

As the protocol's designers (and any implementer of a Brainstorm-Communities-compatible client or mirror), I want the settled Communities wire format in one self-contained pre-NIP — the personal-projection model, the record and endorsement event shapes, the membership signal, and the resolution model — so that the design that today lives across an OPEN handoff doc, an unmerged branch, and a BIBLE section can be read, evolved, and eventually published as one document, while the genuinely open questions stay visibly open.

## Acceptance criteria

- [ ] Given a fresh clone of `staging`, when a reader opens `protocols/drafts/communities.md`, then it is a self-contained pre-NIP with a repo-metadata header (status 📝 pre-NIP; the **in-flight-feature note** per `protocols/README.md` — the feature lives on `feat/communities`, unmerged; sources: the four families above) covering, at minimum, the wire formats and models the ADR's inventory marks **settled**: the personal-projection model (records are personal; the community is the convergent overlap), the community-record layer (index header + record item shapes), the global endorsement layer (header addressing forms + endorsement/veto item shape), the membership model (consuming the pubkey-tagging signal), the declaration/affiliation usage of the `b` tag, and the resolution model kernel.
- [ ] Given the spec, when it touches anything the sources leave genuinely open, then it marks it openly rather than deciding it — **explicitly including** the three-branch reconciliation (capture doc §7, an org decision this story must not make) and the cross-deployment canonical-pubkey question (→ worksheet W1, which the endorsements spec's "well-known pubkey" addressing touches directly).
- [ ] Given that membership consumes the pubkey-tagging wire format (story 7's territory, tags branch unmerged), when the spec references it, then it uses the established pending-migration pattern: point at the signal's current best source with an explicit "specified by the Tags & Taggings pre-NIP (story 7, pending)" marker, to be repointed by story 7.
- [ ] Given the spec, when read by a stranger with the prior five specs, then it contains no stack machinery (no Neo4j/endpoints/UI/firmware-install mechanics/GrapeRank pipeline internals; deployment-relative pubkeys handled neutrally per W1 precedent) — and every load-bearing term is defined in the spec or its prerequisite chain (**term-coverage is a first-class review dimension this time**, per the lesson of stories 3 and 5).
- [ ] Given BIBLE §22 after the change, then its treatment follows the ADR's explicit decision (the central scoping question: §22's community-*reference* machinery overlaps but is not identical to the Communities feature; whatever kernel the spec absorbs becomes pointer-first in §22, whatever stays stays — no dual normativity either way), with §22's number/title/anchor unchanged.
- [ ] Given `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` after the change, then its status line reflects reality: the design portion (§1–§6) ratified into the spec, §7 (reconciliation) still open — without closing or rewriting a document whose audience includes Avi and Vinney beyond that status-line truth.
- [ ] Given `protocols/worksheet.md` after the proactive sweep, then no entry claims content that moved, and any new open questions the synthesis surfaces (candidates: the endorsements list's canonical-pubkey addressing vs W1; convergence parameters) are recorded as worksheet entries rather than silently dropped.
- [ ] Given `protocols/README.md`, then the Communities row links the working copy (story 6 ✅) and the branch files are no longer named as the content's location.
- [ ] Given the full change, when `npm test` runs, then it passes unchanged; and no BIBLE section other than §22 is modified.

**Traceability rule (extended for synthesis):** every normative statement traces to one of the four source families, with the capture doc authoritative where sources disagree (it is the latest, reconciliation-aware design); disagreements between sources are themselves findings — surfaced in the source map, not silently resolved. Honest gaps marked explicitly.

## Concepts touched

None in the concept-graph sense (no events published, no firmware change, no reinstall). The spec *describes* community records, endorsements, and membership signals riding on kinds already specified upstream.

## Out of scope

- Deciding the three-branch reconciliation (capture doc §7) or anything else the sources leave open.
- Story 7 (Tags & Taggings) — except the pending-marker cross-reference.
- Resolving W1; changing any code or branch content; publishing.
- The notification/inbox ADRs (0037–0038) and roster-read/degraded-posting ADRs (0031–0032) are *presumed* implementation-side — the ADR's inventory confirms or corrects this presumption.

## Open questions

- **Architecture phase?** **Runs full, not thin** — the wire-format inventory across four source families (which of the 12 branch ADRs carry wire format vs implementation; what §22 contributes; where the sources disagree) is precisely an Architect's reconciliation job, and fixing it before prose is what makes the synthesis reviewable.
- Spec title: "Communities" per the handoff (the branch specs say "Brainstorm Communities") — the ADR proposes; review confirms.

## Linked artifacts

- Design record: `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` §4/§8; design authority: `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` (§1–§6 settled); pattern: `protocols-directory` ADRs 0001–0003
- ADR: (pending — full run)
- Test plan: skipped (docs-mode)
- Review: (filled in after Review phase)
