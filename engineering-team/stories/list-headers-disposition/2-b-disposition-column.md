# Story 2: The 🧭 b-disposition column on List Headers

**Status:** Approved
**Created:** 2026-10-01
**Type:** Feature
**Epic:** `list-headers-disposition`
**Book:** `engineering-team/audits/list-headers-disposition/book.md`

## Background

A list header's b-tags say what it is, as far as sharing goes. A b-tag pointing at the header's own address
means it has been submitted as a Shared Concept. A b-tag pointing at someone else's header means it's wired to
that shared concept. The keep-private marker means its author decided it stays private. No b-tag means nobody
has decided yet.

Concept Headers shows this in its 🧭 column. List Headers shows nothing about it, so a person can't tell
which of their headers are already settled. Stories 3 and 4 will let them act on their own headers from this
page. Before that, the page has to show where each header stands.

On this machine on 2026-10-01, the page lists 315 headers:
- 284 are kind 39998. Of those, 7 are self-declared, 11 are wired, 1 is kept private, and 265 have no b-tag.
- 31 are kind 9998, and none of them carries a b-tag. Staging's 4 kind-9998 headers carry none either.

This story is read-only. It adds the column and nothing you can click.

## User-facing description

As anyone looking at List Headers, I want a 🧭 column that shows each header's b-disposition, so that I can
see at a glance which headers are shared, wired, kept private, or not yet decided, whoever wrote them.

## Acceptance criteria

- [ ] Given the List Headers page, signed in or not, when it loads, then a 🧭 column appears right after the
      two name columns, on every row from every author. Its header has a tooltip that names the states it
      shows.
- [ ] Given a kind-39998 header with a b-tag pointing at its own address, its 🧭 cell shows 🤝 (tooltip
      "self-declared shared concept"). Given one with a b-tag pointing at any other header, by address or
      by event id, it shows 🔗 ("wired to an external shared concept"). A header with both shows 🔗 then 🤝.
      These are the chips, order and tooltips Concept Headers' 🧭 column uses.
- [ ] Given a kind-39998 header whose only b value is the keep-private marker, its cell shows 🔒 ("deliberately
      private (no shared affiliation)"). Given a header with the marker *and* a real b-tag, the real b-tag
      wins: its chip shows and 🔒 doesn't.
- [ ] Given a kind-39998 header with no b-tag, or only b values that aren't an address, an event id or the
      marker, its cell shows a muted **○** with the tooltip "not yet decided". It never shows an error and
      never shows "—".
- [ ] Given a kind-9998 header, whatever its tags, its cell shows **—** with a tooltip saying kind 9998
      headers can't be re-published, so they don't take a disposition.
- [ ] Given any row, the 🧭 cell offers no action: there's no button and nothing in it reacts to a click
      differently from today. Clicking the row still opens the list, as it does now.

## Concepts touched

- `39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:list`: **list** (the rows). Handle as
  it reads in this machine's graph; the pubkey part differs per instance.
- The b-tag and its keep-private marker follow the existing rules Concept Headers already applies (the b-tag
  meanings in community-reference ADR 0029; the marker from shared-concepts-adoption ADR 0001). No new
  meaning is introduced.

## Out of scope

- **Any action.** The Disposition panel, its buttons, and a "Disposition…" button in the cell are stories 3
  and 4.
- **Sorting or filtering by disposition.** The Kind and Author selectors are unchanged.
- **Showing what a wired header points at** (its name or address). Concept Headers doesn't either.
- **A kind-9998 header's own b-tags.** Book decision 3 makes every 9998 cell "—". None carries a b-tag on this
  machine or on staging today.
- **Concept Headers.** Its 🧭 column is unchanged.
- **Story 1's count line.** It's unchanged and not part of this story.

## Open questions

None. Two choices were made as defaults when this draft was written, and the owner confirms them by approving
the story:

1. **"Not yet decided" is a muted ○, not "—".** Concept Headers shows "—" for other authors' undecided rows.
   Here "—" is taken by kind 9998 (decision 3). A second meaning for the same mark would make the column lie
   about one of them.
2. **The column sits right after the two name columns**, where Concept Headers puts its own: right after
   Name.

## Linked artifacts
- ADR: `engineering-team/decisions/list-headers-disposition/0002-disposition-column-from-the-events-own-tags.md`
- Test plan: `engineering-team/stories/list-headers-disposition/2-b-disposition-column.test-plan.md`
- Review: (filled in after Review phase)
