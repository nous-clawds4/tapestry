# Story 4: Tagged items on the tag page

**Status:** Approved
**Created:** 2026-09-10
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A approved 2026-09-10 — extend
`for-tag` with an `items` group (one call, one POV filter); group by list header; Design note, not
ADR; scoped gate `test/dlist-tagged-items.test.js` + `test/event-tagging-for-tag.test.js` + the
strfry write-assertion guard suite; depends on story 3)*

## Background
After story 3, users can tag DList items, but nothing shows the reverse direction: "which items
carry this tag?" The tag page (`/tag/…`) today switches between **Profiles** and **Notes**; its
notes read (`GET /api/event-tags/for-tag`) aggregates by `target.id` and **silently drops**
`a`-target taggings (`src/api/event-tags/index.js` § `aggregateNotesTagged`, "resolve target note
ids (`e`-targets)"). The book's frame requires that a tagged GitHub account be findable from the
tag and rendered as a GitHub account — with its list's fields — not as a bare coordinate.

## User-facing description
As a user on a tag's page, I want an **Items** view listing the Decentralized-List items tagged
with it under my point of view, each rendered with its list's declared fields and linking back to
its list, so that a tag like "white hat hacker" reads as a curated set of GitHub accounts.

## Acceptance criteria
- [ ] AC-1: Given taggings with `a` targets exist for a tag, when the tag page's read for that
      tag runs, then those targets are returned as a distinct **items** group (coordinate, counted
      applications/disputes under the POV, the viewer's own stance), not dropped and not mixed
      into notes.
- [ ] AC-2: Given the tag page, a third content switch **Items** appears beside Profiles and
      Notes, showing a count; selecting it lists the tagged items.
- [ ] AC-3: Each listed item is rendered by its list header's field declarations (the story-1
      table, one row per item, header-driven columns) with the tag affordance from story 3 on the
      row; items from different lists are grouped under their list's name, each group linking to
      `/list/<coord>`.
- [ ] AC-4: Given an item whose list header is not on local strfry, the item still appears with
      its coordinate and author, marked "list not on this relay", and does not crash the view.
- [ ] AC-5: The view honors the same sort/recency controls and POV disclosure the Notes view
      uses; disputes bucket as on notes.
- [ ] AC-6: Notes and Profiles views are unchanged (regression sentinels).

## Concepts touched
- `39998:<TA>:nostr-event-tag`, `39998:<TA>:tagging-with-specific-tag`, `39998:<TA>:list`.

## Out of scope
- Pins / Trusted Lists for items (story 5). Any change to the wire shape. Pagination beyond what
  the Notes view already does.

## Open questions *(resolved at Gate A, 2026-09-10)*
1. **Read API shape — decided:** extend `for-tag` with an `items` group alongside `notes` (one call, one POV filter); a
   separate `for-tag-items` endpoint was rejected. Server change, read-only; no
   irreversibility trigger (no wire/event shape, no routing-order change) — confirm at Gate A.
2. **Grouping — decided:** by list header (not a flat table with a "List" column).
3. **Scoped gate — decided:** `test/dlist-tagged-items.test.js` + the strfry write-assertion guard suite;
   plus `test/event-tagging-for-tag.test.js` since the API changes.

## Design note *(Light — after Gate A)*
—

## Edge cases & not-covered
—

## AC→handle lines
—

## Linked artifacts
- ADR: none expected
- Review: `engineering-team/reviews/dlist-item-tagging/4-tagged-items-on-the-tag-page.md`

Link by path only — never record verdicts or round history in this file.
