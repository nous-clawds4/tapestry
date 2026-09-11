# Story 8: Derived columns for undeclared item fields

**Status:** Approved
**Created:** 2026-09-11
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A approved 2026-09-11 — derived
columns ordered most-common-first with ties by first appearance; control reads "Show all fields" and
derived headers are marked as **derived** (not "assumed"/"implied" — the list does not vouch for
them); `overflow-x: auto` wrapper, no sticky columns in v1; scoped gate
`test/dlist-derived-columns.test.js` + `test/dlist-browse.test.js` + the strfry write-assertion
guard suite; the three exclusions stand)*

## Background
Stories 1 and 4 render items from the **list header's** field declarations, which is right: it
keeps rendering data-driven and stops any item author reshaping a table. But most DLists in the
wild were not authored with good headers, and some headers are simply not on this relay. Those
lists render as rows of author + age + a collapsed "N other fields" toggle — technically honest,
practically unhelpful, and you cannot compare items without opening every row.

The data is already there. The collapsed cell proves it: every undeclared tag is in hand at render
time. What is missing is a way to *see it as a table*. The fix stays general — no per-list special
cases, no bespoke debt — by deriving the extra columns from the items on the page rather than from
any hardcoded knowledge of a particular list.

## User-facing description
As someone reading a Decentralized List whose header declares few or no fields, I want to switch
the table into a mode that shows every field the items actually carry as its own column, so that I
can scan and compare items instead of expanding a dropdown on every row.

## Acceptance criteria
- [ ] AC-1: Given a table of items where at least one item carries a tag the header does not
      declare, a control in the table header offers to show all fields; it is off by default.
- [ ] AC-2: When the control is on, every distinct undeclared tag name across the items **on the
      current page** becomes its own column, placed after the header-declared columns; single-letter
      tag names (`d`, `z`, `e`, `p`, `a`, …) are never promoted.
- [ ] AC-3: Derived columns are visibly distinguished from header-declared ones, so a reader can
      tell what the list itself vouches for from what was inferred from its items.
- [ ] AC-4: When the control is on, the collapsed "other fields" cell is gone — its content is now
      in the columns — and an item lacking a derived field shows an empty cell, never a "missing"
      marker (only declared-required fields can be missing).
- [ ] AC-5: When the control is off, the table renders exactly as it does today (regression).
- [ ] AC-6: Given a table wider than its container, the table scrolls horizontally within its own
      region; the page itself never scrolls sideways, at any viewport width down to ~400px.
- [ ] AC-7: The control appears on both surfaces that mount the shared table — the list page and
      the tag page's Items view — with no per-surface code.
- [ ] AC-8: Given a header that declares every tag the items carry, the control is absent (nothing
      to derive).

## Concepts touched
- None new. Rendering only; no wire format, no published event, no concept-graph change.

## Out of scope
- Persisting the toggle across page loads or sharing it in the URL.
- Sorting or filtering by a derived column.
- Sticky first column while scrolling.
- Deriving columns from items beyond the current page.
- Any change to what the header declares or how declarations are parsed.

## Open questions *(resolved at Gate A, 2026-09-11)*
1. **Column order — decided:** most-common first (count of items
   carrying that tag, descending), ties broken by first appearance — so the fields most items share
   are leftmost and readable without scrolling.
2. **Wording — decided:** **"Show all fields"** for the control, with derived
   column headers marked (e.g. a muted suffix or icon) and a tooltip reading "not declared by this
   list's header — derived from its items". "Derived" is the honest word; "assumed"/"implied"
   overclaim.
3. **Scroll affordance — decided:** an `overflow-x: auto` wrapper around the table only,
   no sticky columns in v1 (AC-6 as written).
4. **Scoped gate — decided:** `test/dlist-derived-columns.test.js` + `test/dlist-browse.test.js` (the shared
   table's existing sentinels) + the strfry write-assertion guard suite.

## Design note *(Light — after Gate A)*
—

## Edge cases & not-covered
—

## AC→handle lines
—

## Linked artifacts
- ADR: none expected (rendering only; no irreversibility trigger)
- Review: `engineering-team/reviews/dlist-item-tagging/8-derived-columns-for-undeclared-fields.md`

Link by path only — never record verdicts or round history in this file.
