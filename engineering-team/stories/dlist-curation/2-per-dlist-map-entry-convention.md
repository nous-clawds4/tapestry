# Story 2: Per-DList curation entries on the Treasure Map — wire convention

**Status:** Approved
**Created:** 2026-09-10
**Type:** Doc *(wire-format irreversibility trigger → full ADR + Standard docs-mode phases; Test
Design skipped per workflows/protocol-spec-workflow.md)*

## Background
The Treasure Map (kind 10040, NIP-85) delegates Trusted Assertions per kind+metric and, per ADR
`tl-treasure-map/0001`, Trusted Lists per bare kind. `protocols/drafts/assistant-designation.md`
(`community-reference` ADR 0031) claims the `39998:*` family with one blanket entry,
`["39998:dlist-header", <TA>, <relay>]`, and explicitly left room for "finer-grained `39998:<…>`
keys within this family". This book's DList Curation panel needs exactly that: a per-DList entry by
which a user empowers their Tapestry Assistant to curate one community DList, recorded on their
Map and backed by an assistant-authored header in the assistant's namespace that points at the
community header. Nothing is ratified for it yet — the endpoint, the panel, and the Map Entries
class (stories 4–6) have nothing agreed to write or read until this convention exists in
`protocols/`.

The design was settled in the 2026-09-09/10 kickoff session; the decisions are recorded in
`engineering-team/epics/dlist-curation.md` § "Settled at kickoff". This story ratifies them into
the spec, one ADR, and the BIBLE pointer, and captures them in the standing design handoff so the
living design doc stays the single capture surface.

## User-facing description
As a reader or writer of a user's Treasure Map — the Tapestry app on any instance, a federating
instance, or any NIP-85-aware client — I want one ratified convention for how a kind-10040 event
says "my Tapestry Assistant curates this DList on my behalf" and how to find the assistant's
header from that entry, so that every implementation composes, reconstructs, and revokes the
same way.

## Acceptance criteria
- [ ] **AC-1 (the entry).** `protocols/drafts/assistant-designation.md` gains a section defining
      the per-DList curation entry `["<kind>:<d-tag>", <assistant pubkey>, <relay>]`, kind
      `39998` or `39999`, and the reconstruction rule: the curated header's address is
      `<kind>:<assistant pubkey>:<d-tag>`. Meaning: the Map's owner empowers the assistant to
      author and maintain that header on their behalf; the header is the owner's curation of the
      community DList it points to.
- [ ] **AC-2 (the header contract).** The section states what the addressed header is: authored
      by the assistant; `d` equal to the community header's d-tag; carrying a `b` tag whose
      target is the community header's a-tag, typed per the inherit-from registry (the
      item-inheritance facet this deployment uses is ratified separately, story 3); names,
      description, and schema copied from the community header at creation. Writer ordering: the
      header exists before the Map entry is published; an existing header carrying a different
      `b` is surfaced, never silently re-pointed.
- [ ] **AC-3 (reader rules).** The first element is split at the **first** colon only (d-tags may
      contain colons); `dlist-header` is reserved — a per-DList entry MUST NOT use it and readers
      MUST read `39998:dlist-header` as the blanket designation; any number of per-DList entries
      may coexist, at most one per (kind, d-tag); on duplicates the first occurrence wins;
      readers unaware of the convention ignore the entries (NIP-85 compatibility, as today).
- [ ] **AC-4 (writer rules).** Adding a DList appends the entry, or replaces the existing entry
      for that (kind, d-tag) in place; every other tag is preserved verbatim; fresh `created_at`
      per replaceable-event semantics — the rules ADR `tl-treasure-map/0001` ratified for the
      generic TL entry, restated for this family.
- [ ] **AC-5 (relay hint).** A relay where the assistant-authored header and its items can be
      fetched. When a Tapestry instance writes the entry, the hint is the first entry of
      `settings.aRelays.aDListRelays` (runtime-resolved), the empty string when unconfigured,
      three-element shape preserved.
- [ ] **AC-6 (revocation).** Removing the entry from the Map (republishing without it) revokes
      the empowerment; the header and its `b` remain on relays. Readers needing *authorization*
      consult the Map; readers needing *composition* consult the header. No expiry field.
- [ ] **AC-7 (precedence untouched).** The section states that the dual-author precedence rule
      is unchanged: a personally-signed `<kind>:<owner>:<d-tag>` still governs over the
      assistant's; the per-DList entry names which assistant header stands in when the owner has
      none.
- [ ] **AC-8 (ADR).** ADR 0002 (full form: Options considered, Consequences) is Accepted at
      `engineering-team/decisions/dlist-curation/0002-<slug>.md`, recording at least the rejected
      `["39999:<a-tag of the header>", …]` shape, blanket-only vs per-DList, and the consequence
      that the NIP-85 export generator's rebuild-from-config clobbers these entries (ledger-linked).
- [ ] **AC-9 (pointers, all consistent).** BIBLE § Assistant Keys' "TA designation on kind
      10040" paragraph mentions per-DList entries and their status; `protocols/README.md`'s
      assistant-designation row's scope phrase covers them (status stays 📝 pre-NIP);
      `protocols/drafts/trusted-lists.md`'s Treasure-Map parse-rule bullet cross-references the new
      section so "two segments" no longer reads as the whole grammar;
      `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` gains a D9 capturing the decision (status stays
      🔴 OPEN); `tapestry-concepts.md`'s pointer paragraph unchanged unless it becomes inaccurate.

## Concepts touched
None — protocol prose, ADR, and pointers. No concept-graph change, no firmware reinstall.

## Out of scope
- The `inherit-items` facet and the item algebra (story 3). This story references the registry;
  it names no facet.
- Code: the assistant header endpoint (4), the DList Curation panel (5), the Map Entries class
  (6), the merge-preserve fix (7).
- Wiring the blanket `39998:dlist-header` entry (still specified-not-wired; unchanged here).
- Any semantics for 39999-declared headers beyond the reconstruction rule (the DList NIP's own
  open direction).
- An upstream NIP-85 proposal.

## Open questions
None — every point above was settled at kickoff (epic § "Settled at kickoff"). Two placements
are the Architect's to confirm in the ADR: that the section's home is the assistant-designation
draft (owner of the 39998 family on the Map) rather than the trusted-lists draft (owner of the
parse rule), and where in BIBLE § Assistant Keys the status sentence lands.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: — (docs-mode; Test Design skipped per the protocol-spec variant)
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
