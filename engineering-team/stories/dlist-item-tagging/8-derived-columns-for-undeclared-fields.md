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
- **One new pure export, `derivedFieldDecls(items, fieldDecls)` in `ui/src/utils/dlistFields.js`.** It walks each item through the existing `undeclaredFields(item, fieldDecls)` (grep-confirmed: that helper already drops single-letter tag names, empty values and already-declared names — AC-2's exclusion is inherited, not re-derived), counts **items** carrying each name (once per item, not once per tag), records first appearance, and returns the same shape `parseFieldDecls` returns, sorted by count desc then first-appearance asc: `{ name, requirement: 'derived', type: 'text', description: null, derived: true }`. The marker is `requirement: 'derived'` — chosen because two ACs then fall out for free: `fieldCellModel` only sets `missing` when `requirement === 'required'`, so a derived column can never show the "missing" marker (AC-4) with **no change to `fieldCellModel`**, and `DListItemsTable`'s existing `` `is-${decl.requirement}` `` header class becomes `is-derived`, the hook AC-3 styles. The redundant `derived: true` flag is for explicit reads in tests and future consumers.
- **All behaviour lands in the shared table, none in the pages.** `ui/src/components/dlist/DListItemsTable.jsx` gains a local `useState(false)` `showAll`, a `useMemo` over `derivedFieldDecls(items, fieldDecls)`, and renders `columns = showAll ? [...fieldDecls, ...derived] : fieldDecls` in `<thead>` and (via the unchanged `fieldDecls` prop name) in `DListItemRow`. The toggle is a checkbox labelled **"Show all fields"** in a new `<div className="bs-dlist-table-toolbar">` that sits *above* the existing `.bs-dlist-table-wrap`, inside a new `.bs-dlist-table-region` root — outside the scroll wrapper, so it never scrolls away sideways. It renders only when `derived.length > 0` (AC-1 off-by-default; AC-8 absent when there is nothing to derive).
- **The "Other fields" column is suppressed by an explicit prop, not by coincidence.** `DListItemsTable` passes `showOther={!showAll}` to `ui/src/components/dlist/DListItemRow.jsx` and skips the `is-other` `<th>` under the same condition, so `<th>` and `<td>` counts stay aligned. (With `showAll` on, `undeclaredFields(item, columns)` returns `[]` anyway, but relying on that leaves a stray empty `<td>` and `<th>` — the prop keeps header and body in lockstep.) Nothing else in the row changes, so AC-5's off-state is a literal no-op path.
- **The toggle is per-table instance, deliberately.** Component-local state means `ui/src/components/TagItemsView.jsx` gets one independent toggle per list group — correct, because each group has its own `fieldDecls` and its own derived set, and it matches "a control in the table header". A view-level toggle would have to be lifted into both pages, which is exactly the per-surface code AC-7 forbids.
- **Rejected: derive the columns in the pages and pass a merged `fieldDecls` down.** Real reason: it breaks AC-7 at three call sites (`ui/src/pages/List.jsx`, `ui/src/components/TagItemsView.jsx`, and `ui/src/components/TagANoteModal.jsx` — the third mount site the story does not name), and once merged upstream the derived decls are indistinguishable from declared ones inside the table, so AC-3's header marking and AC-4's missing-suppression would each need a parallel flag threaded through anyway. Keeping derivation inside the table is strictly less wiring for strictly more correctness.
- **AC-6 reuses what already exists.** Grep-verified: `.bs-dlist-table-wrap` at `ui/src/styles.css:8445` is already `overflow-x: auto` — no new wrapper is invented. The gaps are that `.bs-dlist-table` is `width: 100%` (squeezes instead of overflowing) and that the wrap can be forced wide by a flex/grid parent. Fix in `ui/src/styles.css`, appended to the existing `bs-dlist-*` block, tokens only so both themes follow: `.bs-dlist-table { width: max-content; min-width: 100%; }`, `.bs-dlist-table-wrap { max-width: 100%; min-width: 0; }`, plus new `.bs-dlist-table-region`, `.bs-dlist-table-toolbar`, and `.bs-dlist-table th.is-derived` (muted weight, a visible **derived** marker, and `title="not declared by this list's header — derived from its items"`). No sticky columns in v1.
- **Blast radius.** Touched: `ui/src/utils/dlistFields.js`, `ui/src/components/dlist/DListItemsTable.jsx`, `ui/src/components/dlist/DListItemRow.jsx`, `ui/src/styles.css`. Consumers that inherit the behaviour with zero edits: `ui/src/pages/List.jsx`, `ui/src/components/TagItemsView.jsx`, `ui/src/components/TagANoteModal.jsx`. Grep-verified **non**-consumers, untouched and unaffected: `ui/src/pages/lists/DListItems.jsx` and `ui/src/pages/events/DListItemsList.jsx` (operator browsers with their own `data-table` markup; neither imports `DListItemsTable` nor `dlistFields`). No file under `src/` imports `dlistFields`; this story publishes nothing and touches no server route, so the strfry write-assertion guard suite stays green unchanged.

## Edge cases & not-covered
- **E1 — same undeclared tag twice on one item:** counts once toward that column's frequency (items carrying it, not tag occurrences); the cell shows the first value plus the existing `+N more` from `fieldCellModel.extra`.
- **E2 — whitespace-only value:** `undeclaredFields` rejects `''` but not `'   '`, so such a tag *does* promote a column that renders visually blank. Accepted as-is; do not add a trim rule in this story — it would change the off-state "other fields" cell too and break AC-5. *Not derivable from any AC.*
- **E3 — a derived name collides with a built-in heading (`Added by`, `Age`, `Votes`, `Other fields`):** declared and built-in columns always win position; duplicate header text is cosmetic only, and React keys stay unique because the static `<th>`s are keyless literals. No de-duplication logic. *Not derivable from any AC.*
- **E4 — "Next page" pressed while the toggle is on:** `items` changes, `derivedFieldDecls` recomputes, so columns may appear or reorder under the reader; the toggle itself stays on (state lives on the component instance, not on `items`). Accepted — AC-2 scopes derivation to the current page. *Not derivable from any AC.*
- **E5 — header absent or declaring nothing** (list not on this relay; `TagItemsView`'s "not here" group): `fieldDecls` is `[]`, every non-single-letter tag derives, the toggle appears. The off-state stays exactly as today.
- **E6 — an item with dozens of undeclared tags:** no cap on derived column count in v1; the `overflow-x` region is the only mitigation.
- **E7 — single-item table (`TagANoteModal`):** the toggle appears there too whenever that one item carries undeclared tags. Harmless and intentional — it is the same shared component, and AC-7's "no per-surface code" cuts both ways.
- **E8 — `TagItemsView` items whose event body never resolved:** they carry no `tags`, contribute nothing to derivation, and render empty cells under every derived column (never "missing", per AC-4).
- **Not covered:** persisting or URL-sharing the toggle; sorting or filtering by a derived column; a sticky first column; deriving from items beyond the current page; any change to header parsing or to what counts as a declaration; any cap on, or POV/trust-weighted selection of, which derived fields surface.

## AC→handle lines
—

## Linked artifacts
- ADR: none expected (rendering only; no irreversibility trigger)
- Review: `engineering-team/reviews/dlist-item-tagging/8-derived-columns-for-undeclared-fields.md`

Link by path only — never record verdicts or round history in this file.
