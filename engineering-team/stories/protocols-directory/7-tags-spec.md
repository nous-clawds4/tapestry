# Story 7: Tags & Taggings pre-NIP (synthesis — epic finale)

**Status:** Approved
**Created:** 2026-06-10
**Type:** Doc
**Epic:** protocols-directory — realizes `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` (§4 spec #7, §6, §8 story 7)

## Background

The Tags feature (live at tags.brainstorm.world, built on the unmerged `feat/pubkey-tagging-target` branch) ships three wire formats, all kind-39999 DList items distinguished by which concept their `z` tag references: **tag definitions** ("Podcaster is a tag"), **taggings** ("Avi is a Podcaster", with apply/dispute polarity), and **pins** ("I pin Podcaster into my curated set", with curation parameters), plus NIP-09 kind-5 unpinning. Their normative sources are the tags branch's ADRs 0001 (profile-tag architecture) and 0009 (pin-a-tag) and the firmware concepts `tag`/`nostr-user-tag`/`tag-pinning` — surveyed in full at this epic's outset. The tagging primitive is now **load-bearing beyond its home feature**: Communities membership consumes it (story 6), and two pending markers in the communities spec await this story.

This story carries inherited obligations from the epic:

1. **The D4 reconciliation** (`protocols-directory` ADR 0004): three assertion-shape variants exist — the tags branch's deployed `e`-primary shape (ADR 0001), the capture doc's sketch, and `feat/communities` ADR 0030's **`a`-primary / `e`-provenance correction** (2026-06-05, load-bearing for community roster reads, and itself marked "pending Vinney's one-line confirm"). The spec reconciles with the correction as the latest word — **honestly**: the normative shape is a-primary, with the variant history and the pending-confirmation status recorded, not silently resolved.
2. **Repoint the communities spec's two pending markers** to this spec, retiring "story 7, pending".
3. **The legacy z-tag pubkey exception stays out** (tags-branch ADR 0015 / BIBLE territory): all `z` handles deployment-neutral, with the canonical-identity question pointed at worksheet W1.
4. **W3 (polarity valence arc) and W4 (`e` vs. `a` references)** are this spec's pre-assigned open questions — it points at them rather than resolving them.
5. **Event-tagging is planned, not specified**: targets of kinds 39998/39999 are next per the epic handoff §6 — the spec carries an explicitly-planned section, not invented wire format.

## User-facing description

As the protocol's designers (and any implementer of tagging — including the Communities consumers that now depend on it), I want the tag/tagging/pin wire formats in one self-contained pre-NIP with the assertion-shape reconciliation stated honestly, so that the primitive Vinney built, the correction the communities work needs, and the curation layer all read as one document — completing the protocols/ migration with no wire format left homeless.

## Acceptance criteria

- [ ] Given a fresh clone of `staging`, when a reader opens `protocols/drafts/tags.md`, then it is a self-contained pre-NIP with a repo-metadata header (📝 pre-NIP; in-flight note naming `feat/pubkey-tagging-target` and the live deployment; sources: tags-branch ADRs 0001/0009, the firmware concept definitions, `feat/communities` ADR 0030 for the reconciliation, epic handoff §6) covering at minimum: the tag-definition wire format; the tagging (assertion) wire format **reconciled per D4** with the variant history and pending-confirmation status visible; polarity semantics (apply/dispute values, the v1 bucketing, the reserved middle interval → worksheet W3); the pin wire format including curation-parameter semantics and its dual `e`+`a` reference; kind-5 unpinning; the deterministic d-tag conventions for assertions and pins; and a **planned** event-tagging section (kinds 39998/39999 targets first) explicitly marked as not yet specified.
- [ ] Given the spec, when read by a stranger with the prior six specs, then it contains no stack machinery (no UI tabs, no Trusted-List publication pipeline, no Meili/PoV internals, no endpoint paths) and **no deployment pubkeys** — every `z` type-handle deployment-neutral with the W1 pointer; the legacy-literal exception is not mentioned (it is BIBLE/ADR history).
- [ ] Given `protocols/drafts/communities.md`, when its two former story-7 pending markers are followed, then both point at the new spec with the pending parentheticals retired, and the assertion shape quoted there remains consistent with the new spec's normative shape.
- [ ] Given `protocols/worksheet.md` after the proactive sweep, then W3 and W4 cite the new spec as the owning context (refs updated), no entry claims content that moved, and any new open questions the synthesis surfaces are recorded as entries.
- [ ] Given `protocols/README.md`, then the Tags & Taggings row links the working copy (story 7 ✅), and — all seven rows now done — the index preamble's migration-in-progress framing is updated to the completed state (small allowed edit, flagged).
- [ ] Given the full change, when `npm test` runs, then it passes unchanged; and `BIBLE.md` has zero diff (tags content never lived there; the ADR 0015 exception stays untouched on its branch).
- [ ] Term coverage is a first-class review dimension (carried from story 6); every load-bearing term is defined in the spec or its prerequisite chain.

**Traceability rule (synthesis):** every normative statement traces to tags-branch ADRs 0001/0009, the firmware concept definitions, `feat/communities` ADR 0030 (for the reconciled shape), or the epic handoff §6; the D4 variant disagreement is surfaced in the spec text itself (it is wire-status information an implementer needs), not just the source map. Honest gaps marked explicitly.

## Concepts touched

None modified (no events, no firmware change, no reinstall). The spec *describes* the `tag`/`nostr-user-tag`/`tag-pinning` concept family; their firmware definitions on the tags branch are sources, not targets.

## Out of scope

- Resolving W1, W3, W4, or the D4 pending-confirmation (Vinney's call).
- Specifying event-tagging wire format (planned section only).
- The Trusted-List (kind 30392) publication pipeline and all feature behavior (BIBLE/branch territory).
- Any code, branch, or firmware change; publishing.

## Open questions

- **Naming — resolved at the gate: (c), delegated to the ADR, with the owner's directional guidance recorded verbatim:** *"we will have a parent concept of taggings, with nostr-user-tag (should we change it to nostr-user-tagging?) and nostr-event-tag as sibling concepts; maybe even dlist-tag as a subset of nostr-event-tag, with dlist-tag being something we would very much like to start using."* The ADR frames the family accordingly; it must not invent wire format for the unbuilt siblings, and it must treat any concept-slug *rename* as wire-impactful (slugs are embedded in `z` handles on signed history) — a migration decision to mark open, not a docs decision to make.
- **Architecture phase?** Runs full — the D4 two-branch reconciliation and the family framing are real design calls.

## Linked artifacts

- Design record: `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` §4/§6/§8; inherited instruction: `protocols-directory` ADR 0004 finding D4; pattern: ADRs 0001–0004
- ADR: (pending — full run)
- Test plan: skipped (docs-mode)
- Review: (filled in after Review phase)
