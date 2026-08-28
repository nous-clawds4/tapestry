# Story 1: Treasure-Map TL-advertisement convention

**Status:** Done
**Created:** 2026-08-27
**Type:** Doc *(wire-format irreversibility trigger → full ADR + Standard docs-mode phases; see
workflows/light-profile.md)*

## Background
Kind-10040 Treasure Maps (NIP-85) delegate Trusted Assertions per kind+metric:
`["30382:rank", <pubkey>, <relay>]`. Tapestry's Trusted List family
(`protocols/drafts/trusted-lists.md`; kinds 30392–30395) has no Treasure-Map advertisement
convention — a consumer cannot learn from a Map which pubkey publishes the owner's TLs, and the
Tapestry UI (stories 2–3 of this book) has nothing ratified to write. The operator's model: one
pubkey publishes **all** of an owner's pubkey Trusted Lists, so the entry names the kind alone —
no per-list enumeration.

## User-facing description
As a consumer of a user's Treasure Map (the Tapestry app itself, a federating instance, or any
NIP-85-aware client), I want a ratified convention for how a kind-10040 event advertises the
publisher of the owner's Trusted Lists, so that readers and writers across repos agree on one
wire shape.

## Acceptance criteria
- [x] AC-1: `protocols/drafts/trusted-lists.md` gains a "Treasure-Map advertisement" section
      defining the generic entry `["<TL-kind>", <pubkey>, <relay>]` — first element the decimal
      kind as a string, no `:name` suffix — stated for the family, exercised in this book for
      `30392` (pubkey TLs).
- [x] AC-2: The section defines writer semantics: at most one generic entry per TL kind; an
      opt-in switch **replaces** the existing generic entry for that kind; all other tags are
      preserved verbatim; readers take the first occurrence when duplicates appear in the wild.
- [x] AC-3: The section defines the relay hint — a relay where the advertised publisher's TLs
      can be found — and names the concrete Tapestry source for it (pinned by ADR 0001).
- [x] AC-4: Named entries (`"<kind>:<name>"`) are documented as a reserved future override —
      recognized, inert today.
- [x] AC-5: ADR 0001 (full form: Options considered, Consequences) is Accepted at
      `engineering-team/decisions/tl-treasure-map/0001-treasure-map-tl-advertisement-convention.md`.
- [x] AC-6: `protocols/README.md`'s Trusted Lists row still points at the draft as the working
      copy (phrasing updated only if needed).

## Concepts touched
None — protocol prose + ADR only; no concept-graph changes, no firmware reinstall.

## Out of scope
- Any UI or publish-path code (stories 2–3).
- Named-entry override semantics beyond the reservation note.
- Advertisement UI for the non-pubkey TL kinds (30393/30394/30395 — defined by the convention,
  not exercised here).
- Ensuring TLs actually propagate to the hinted relay (existing TL-publication pipeline's
  concern).

## Open questions
None — replace-vs-append and publish destinations were settled at the book's Gate A
(2026-08-27); the relay-hint source is the ADR's decision point.

## Linked artifacts
- ADR: `engineering-team/decisions/tl-treasure-map/0001-treasure-map-tl-advertisement-convention.md`
- Test plan: — (docs-mode; Test Design skipped per the protocol-spec variant)
- Review: `engineering-team/reviews/tl-treasure-map/1-treasure-map-tl-advertisement-convention.md`

Link by path only — never record verdicts or round history in this file.
