# Story 2: Show the instance-computed note list in the Pinned tab (notes/profiles parity)

**Status:** Draft
**Created:** 2026-07-16
**Type:** Feature
**Depends on:** Story 1 (context-scoped pins)

## Background

The Pinned tab is asymmetric between profiles and notes:

| | Displayed in the Pinned tab | Exported for other clients |
|---|---|---|
| Profiles | TA-signed **kind-30392** Trusted List (`useTLDetail`) | client-signed kind-30000 |
| Notes | client-signed **kind-30003** bookmark set (`usePinnedNotes`) | client-signed kind-30003 |

Notes are the outlier: the tab displays the *export artifact itself* (kind-30003) instead of
an instance-computed Trusted List. Two bad consequences follow:

1. **The Notes view only appears after an Export.** The Profiles/Notes toggle is gated on a
   kind-30003 existing, and that list is created only by an explicit, NIP-07-prompted note
   Export. A freshly pinned tag that covers notes shows **no Notes toggle at all** until the
   user exports — which reads as "this pin has no notes."
2. **It blocks cheap freshness.** Because the displayed list is client-signed, keeping it
   current requires re-prompting the signer (see Story 3).

The fix already exists server-side but was never wired to this surface: `runOneNotePin`
publishes a **TA-signed kind-30393** note Trusted List (`metric: pinned-tag-notes`, d-tag
`tl-pin-notes-…`) on every pin refresh (shipped in ADR event-tagging/0016; made
context-aware in Story 1). The stale comment in `publishTagPin.js` — *"there is no TA-signed
note-TL yet (issue #336)"* — predates that work.

## User-facing description

As a user, I want the Pinned tab's Notes view to show the instance-computed list of trusted
notes for my pinned tag — the same kind of list Profiles already shows — so that I can see a
pin's notes without having to Export first, and the Notes toggle appears whenever the pin
covers notes.

## Acceptance criteria

- [ ] Given a pin whose tag has trusted-tagged notes, when the viewer opens the Pinned tab, then the Notes view shows the members of the **TA-signed note Trusted List (kind-30393)** for that pin — not the client-signed kind-30003.
- [ ] Given a pin that covers notes, when the viewer views the Pinned tab, then the **Profiles/Notes toggle appears** based on the pin covering notes (or its note TL having members), independent of whether any client note Export has ever happened.
- [ ] Given a **context** pin, when its Notes view renders, then it reads that pin's **own** context note TL (context-discriminated d-tag), not the neutral pin's.
- [ ] Given the viewer exports notes, then the client-signed **kind-30003 remains the export artifact** (the Export flow is unchanged) — the display switch does not remove or alter export.
- [ ] Given the displayed note TL is behind the live set, when the Notes view is open, then a **drift indicator compares the displayed TA-signed list against the live curated set** (staleness stays visible).
- [ ] Given a note TL that has been **retracted or is partial**, when the Notes view renders, then those states are handled the same way the profile TL detail already handles them (no crash, honest empty/partial messaging).

## Concepts touched

- `39998:<TA>:tag-pinning` — tag pinning (the pin whose note list is displayed)
- kind-30393 TA-signed note Trusted List (`tl-pin-notes-…`, produced by `runOneNotePin`) — now the display source
- kind-30003 client note bookmark set — demoted to *export artifact only*

## Out of scope

- The event-tagging → pin-refresh freshness hook (Story 3) — this story only changes the
  display source; keeping the TA note TL current on new taggings is Story 3.
- Any change to note curation methods (`notes:net-endorsed` / `notes:most-applied`).
- Retiring kind-30003 — it stays as the cross-client export.

## Open questions

- Empty/never-materialized note TL (pin predates note support, or a refresh never ran): show
  an empty state with a refresh affordance, matching the profile side? (Recommended.)

## Linked artifacts

- ADR: `engineering-team/decisions/contextual-pins/0001-context-scoped-pins.md` (Amendment I)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
