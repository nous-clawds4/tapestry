# Epic: assistant-self-map — Your Assistant's Treasure Map, built and kept true

**Created:** 2026-10-12
**Status:** Active
**Book:** `engineering-team/audits/assistant-self-map/book.md` (no PRD — acceptance frame)
**Provenance:** the owner's ask of 2026-10-12, quoted in the book and settled through four questions at intake (book
§ Decisions).

## Goal

**Replace the hub's Your Assistant's Treasure Map placeholder (assistant-duty-cards #1) with a real page, and give
every Assistant this instance runs a self-Map that stays true.** A self-Map is the Assistant's own kind 10040, naming
itself for the duties it is publishing now (`protocols/drafts/treasure-maps.md` § 9.2). The person turns it on once,
and the instance keeps it true. The Duty Menu says what is offered, the self-Map says what is active, and the person's
own Map (`/treasure-map`) says what they asked for.

## Stories

`stories/assistant-self-map/`. Story 1 is Done (`1-the-self-map-page-and-its-check.md`, approved and passed review in round 3, 2026-10-12).
Story 2 is Done (`2-turning-the-self-map-on-and-off.md`, 2026-10-13, on staging). Story 3 is the owner's wording ask of
2026-10-13 (`3-one-name-for-your-assistants-treasure-map.md`). The rest are a first cut, to be revised at
`/plan-feature`; the upkeep story, called "story 3" until 2026-10-13, is now story 4:

1. The self-Map check and page, read-only. What this instance can truly claim for the viewer's Assistant, the
   self-Map found now, the hub's real mark, and the page with its cross-links.
2. Turning it on and off. The signing route, and a merge that keeps every entry the self-Map doesn't own.
   As planned: a remembered on/off choice per Assistant, with Turn on, Update now and Turn off. It reaches staging
   after its Review, and production together with story 4.
3. One name for your Assistant's Treasure Map. The words people see say "Treasure Map", never "self-Map"; nothing
   under the hood changes.
4. Keeping it true. Adding after the first full set lands, and narrowing or removing before upkeep stops.
5. Readers. The Counting Maps rule in this instance's counters, and the hub's self-entry reading.
6. `/treasure-map`'s Active and Standby-ready badges.

## Key facts / guardrails

- **"Whose Assistant?"** is the viewer's own, from the session, as on the rest of the hub: the Owner's TA, or the
  customer's Assistant key (`src/utils/assistantKeys.js`).
- **Honest content.** A self-entry claims only what is truly live. It covers duties the person's Map gives this
  Assistant, that this instance publishes at the relay its Duty Menu names, and that have landed and are kept up to
  date. Customers' Lists are not claimed until they are built.
- **Merge, never regenerate.** The TA's kind 10040 is also the instance's own Map. The writer owns only self-entries
  and keeps every other tag byte-for-byte (CLAUDE.md principle 4).
- **Shared line.** § 9.2 may still move under book `duty-menus-and-self-maps` (stories 3 and 4). Re-read it before
  Implementation and before Review (book § Shared lines).
