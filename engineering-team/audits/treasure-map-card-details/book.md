# Book of Work: Treasure Map — the cards say what needs attention, and show their details

**Slug:** treasure-map-card-details
**Status:** Closed
**Opened:** 2026-10-08
**Closed:** 2026-10-08
**Strictness:** Light (trial) — workflows/light-profile.md *(chosen by the owner at intake, 2026-10-08; two
Feature-lane stories, page-only, no irreversibility trigger)*

## Intent anchor

**Acceptance frame (no PRD)** — the owner's ask, restated and confirmed at intake (2026-10-08 session). The page is
`/treasure-map` (Manage your Treasure Map), with its three category cards: Scores, Lists, Concepts.

### Acceptance frame

- [x] **Needs attention:** a category card with no Assistant assigned shows a "Needs attention" pill styled like the
      one on `/assistant`, adapted to this page's light design. In Edit mode it hides while a pick is pending for that
      card, and Undo brings it back.
- [x] **Show details:** each card has a toggle that opens a details panel below its content, listing the
      assignments behind it: one row per Map entry, with its key as written, its Assistant (avatar and name) and relay;
      later Assistants on the same key marked Backup; narrower duties marked Individually assigned.
- [x] **Edit mode:** the details describe the edited draft and follow every change as it's made.
- [x] **Nothing else moves:** the cards' Assistant lines, Edit mode, Save, and the `/assistant` page and its top-bar
      alert behave as before.

## Epics in this book
- `treasure-map-card-details` — the Needs attention pill and the per-card details panel on `/treasure-map`. *(Done,
  retired 2026-10-08; it reaches `staging` in the same PR as its code.)*

## Owner's decisions at intake (2026-10-08), verbatim choices from the intake questions

1. **Path:** "Light: 2 stops each (Recommended)".
2. **The pill in Edit mode:** "Hide while a pick is pending (Recommended)".
3. **What the details list:** "Each entry, with its Assistants (Recommended)" — the preview the owner selected showed
   rows `30382:rank ◉ Ava wss://ta.example` / `◉ Cy Backup` / `3038x:tag:X1 ◉ Cy Individually assigned`.
4. **The details in Edit mode:** "The edited draft" (the session had recommended the published Map; the owner chose
   the draft).

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high — every frame bullet is a PASS story with browser tests (audit §1–§4).
- **Rides with:** the Concepts `39998`+`39999` hotfix (commits `b84484c8`, `2447d98a`; ledger row
  `2026-10-08-concepts-assignment-adds-39999`), on the same branch, so all three changes reach staging together. The
  hotfix is not part of this book's frame.

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/treasure-map-card-details/audit.md`
- Product feedback: `engineering-team/audits/treasure-map-card-details/prd-seed.md`
