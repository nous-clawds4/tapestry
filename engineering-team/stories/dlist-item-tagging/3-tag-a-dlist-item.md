# Story 3: Tag a DList item

**Status:** Draft
**Created:** 2026-09-09
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A pending; depends on story 2)*

## Background
Story 1 renders a list's items; story 2 makes `a`-target assertions safe. This story puts the
existing note-tagging affordance on each item row: the same tag menu, the same apply/dispute
stances, the same per-POV reading — the only difference is the target, an `a` coordinate
(`39999:<author>:<d>`) instead of an event id. The read API already accepts `address=`
(`GET /api/event-tags/for-event`), the core builders and filters already branch on
`{ address }`; the UI hook and component today take only an event id.

## User-facing description
As a signed-in user viewing a Decentralized List, I want to apply or dispute a tag on any item
and see which tags my point of view already applies to it, so that I can curate the list's
items — starting with tagging GitHub accounts as, e.g., "white hat hacker".

## Acceptance criteria
- [ ] AC-1: Given a list item row and a signed-in viewer, the row carries the tag affordance;
      applying a tag publishes an event-tagging assertion whose target is the item's `a`
      coordinate (never its event id), through the existing publish gate (local strfry only
      during the build).
- [ ] AC-2: Given taggings exist for an item, the row shows the tags that count under the active
      POV, with the viewer's own stance (apply / dispute) distinguished, exactly as on a note.
- [ ] AC-3: Disputing, and re-applying after a dispute, work as on notes; the item's stance
      updates without a page reload.
- [ ] AC-4: Given a signed-out viewer, tags remain visible read-only and the write affordance is
      absent.
- [ ] AC-5: Given the "+ Tag a Note" style entry (paste an identifier), pasting an item's
      `naddr` or `kind:pubkey:d` coordinate resolves to the item and tags it as an `a` target.
- [ ] AC-6: Note tagging is unchanged (regression sentinel on the note surfaces).
- [ ] AC-7: The app's user-facing navigation links to `/lists` (closes story 1 review
      follow-up N-7).

## Concepts touched
- `39998:<TA>:nostr-event-tag`, `39998:<TA>:tagging-with-specific-tag`, `39998:<TA>:tag`.

## Out of scope
- The tag page's Items view (story 4). Pins / Trusted Lists (story 5). Votes (out of the book).

## Open questions *(resolve at Gate A)*
1. Where the tags render: inline in the row's `renderExtra` slot (recommendation — story 1
   left it for exactly this) vs. an item detail page. Recommendation: inline now; a detail page
   only if story 4 needs one.
2. Scoped gate: `test/dlist-item-tagging.test.js` + the strfry write-assertion guard suite.

## Design note *(Light — after Gate A)*
—

## Edge cases & not-covered
—

## AC→handle lines
—

## Linked artifacts
- ADR: none expected (story 2 carries the wire change)
- Review: `engineering-team/reviews/dlist-item-tagging/3-tag-a-dlist-item.md`

Link by path only — never record verdicts or round history in this file.
