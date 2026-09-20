# ADR 0001: Row detail panels on the Active …-tags pages

**Status:** Proposed
**Date:** 2026-09-20
**Story:** `engineering-team/stories/shared-concepts-row-detail/1-row-detail-panels-on-active-tag-pages.md`

## Context

Two pages render a table of rows whose identity is a wire coordinate:

- **Active b-tags** (`ui/src/pages/shared-concepts/ActiveBTags.jsx`) — one row per `b` tag on a
  locally-authored kind-39998 event. Columns: `localName`, **`bTag`**, `sharedName`, `sharedAuthor`
  (`:150–182`). The row click navigates to the b-tag pair page (`:200–203`).
- **Active z-tags** (`ui/src/pages/shared-concepts/ActiveZTags.jsx`) — one row per foreign-authored
  concept header that local events file under. Columns: `name`, **`uuid`** (the z-tag coordinate),
  `author`, `eventCount`, `authorCount` (`:153–171`). **No row click.**

Both render through the shared `ui/src/components/DataTable.jsx` (25 consumers).

**Concept-graph orientation.** `/api/concept-graph/node/39998:<TA>:concept-header` returns the
header's own tag list, which carries `{"type":"description","value":"The origin node of a concept's
class threads."}` alongside `names`, `slug`, `d` and `json`. The description is a **first-class tag on
the event**, not page state and not a Neo4j-only property — so the pages already hold it. `<TA>` is
per-deployment (CLAUDE.md § "Per-deployment TA pubkey"); nothing here may hardcode it, and nothing
here needs to — both pages already resolve it via `useConfig()`.

Facts that constrain the design:

1. **The data is already in hand.** `ActiveBTags` fetches whole events at `:59` and walks
   `ev.tags` at `:64`; `ActiveZTags` fetches every kind-39998 header at `:69` and keeps a
   per-coordinate record at `:79`. Adding `description` is a field on an object that already exists.
   **No new fetch, endpoint, or wire change.** Measured on this dev instance: 8 of 13 b-tag rows
   carry a description.
2. **`DataTable`'s filter is column-derived.** `:28–37` matches only `row[col.key]` over the passed
   `columns`. Deleting the tag column therefore deletes the tag from the filter — the regression the
   story's fifth criterion exists to prevent. The description has never been a column, so the
   story's sixth criterion asks for a value the filter has never seen.
3. **`DataTable` owns `<tbody>`.** A panel row cannot be injected from a caller; either the component
   learns to render one, or the page stops using the component.
4. **`DataTable` is already designed for additive opt-in props.** `pageSize` and `showFilter`
   (`:22`, `:63–70`, `:84`) are documented in its own docblock as "additive/optional; callers that
   omit them get the original behavior."
5. **The expand-in-place pattern already exists in this repo**, hand-rolled:
   `ui/src/pages/lists/DListItems.jsx:549–579` — a trailing chevron cell whose handler calls
   `e.stopPropagation()` so the row's own click survives, then a sibling `<tr><td colSpan=…>`.
6. **`CopyButton` exists** (`ui/src/components/CopyButton.jsx`) and does exactly the required
   `navigator.clipboard.writeText` → 📋/✓ acknowledgement. Its `bsp-copy-btn` class is global
   (`ui/src/styles.css:3861`). Two consumers today.
7. **`ActiveBTags` already skips the `b-tag-deferred` sentinel at row-build time** (`:68`, via
   `SENTINEL` from `utils/bDisposition`), so no sentinel row reaches the table and none can reach a
   panel. `ActiveZTags` reads no `b` tags at all. The story's eighth criterion is satisfied by
   leaving `:68` alone — it is a *regression guard*, not new work.
8. **`.text-muted` is a dead class.** It is used as `className` in 10+ JSX files including all three
   shared-concepts surfaces, but no stylesheet defines a `.text-muted` rule. Verified on the running
   instance: the element's computed `color` is `rgb(230, 237, 243)`, identical to ordinary cell text;
   a scan of every loaded `CSSStyleSheet` finds no matching `selectorText`. The `--text-muted`
   *variable* exists (`styles.css:12`, `#8b949e`) but nothing maps the class onto it. Pre-existing,
   cosmetic, repo-wide, and **not caused by this story** — **brought into scope by the owner at the
   Architecture gate (2026-09-20)**; see §Decision.

   Survey behind that decision: **132 usages across 43 files.** Every one is secondary text — em-dash
   placeholders, `Loading…`, `No description.`, `cannot locate event`, field labels like `Author`.
   None is interactive, and none would read as "disabled" once muted. The app has a **single theme**
   (no `prefers-color-scheme` or `data-theme` rule anywhere in `styles.css`), so one rule covers every
   case. `#8b949e` on the three backgrounds these strings sit against — `--bg` `#0d1117`,
   `--bg-secondary` `#161b22`, `--bg-tertiary` `#21262d` — clears WCAG AA on all three. No selector in
   `styles.css` targets a `span` by colour, so a bare `.text-muted` rule is not out-specified; the
   only nearby precedent, `.empty-row` (`:374–378`), already resolves to the same variable.

**Prior decision that bears directly on this one.** ADR `profile/0026-profile-follows-list.md:88`
faced the same "keep it searchable even when its column is hidden" problem and chose to solve it
*at the page level*: "Add at the page level (keep `DataTable` changes minimal)". The shipped result
is `ui/src/pages/BrainstormFollows.jsx:137–146` — a page-owned search input plus
`showFilter={false}` (`:223`). That ADR is not wrong and is not superseded here; §Decision explains
why this story lands differently.

Project constraints: no new lint/typecheck/build tooling; `ui/` changes require `npm run build`
(Vite → `dist/`) to appear, including locally. **Firmware reinstall: not required** — no concept
definition changes.

## Options considered

### Option A — Teach `DataTable` two additive props: `renderExpanded` and `filterKeys` *(chosen)*

`renderExpanded(row)` → when supplied, the table grows a trailing disclosure cell and renders the
returned node in a sibling row. `filterKeys` → extra row field names folded into the existing
filter predicate. Both default to "absent", and when absent the rendered DOM is byte-identical to
today's.

```jsx
// DataTable, sketch only
const match = (v) => v && String(v).toLowerCase().includes(lower);
return data.filter(row => columns.some(c => match(row[c.key])) || filterKeys.some(k => match(row[k])));
```

- **Pros.** Both pages keep sort, count, pagination, empty-state and the filter box *where it already
  is*. The filter stays one concept in one place. Smallest page-side diff. Consistent with the
  component's own stated extension model (fact 4). Generalizes fact 2 rather than routing around it.
- **Cons.** Touches a component with 25 consumers. `renderExpanded` needs a stable row identity to
  key expansion state on (see Implementation notes).

### Option B — Hand-roll both tables, following `DListItems.jsx`

Drop `DataTable` on these two pages and render `<table>` directly, as `DListItems.jsx:549–579` does.

- **Pros.** Zero blast radius on the shared component. Total control.
- **Cons.** Re-implements sort, text filter, item count and empty state *twice*, and the two pages
  then drift from the other 23 tables. Materially more code and more test surface for a change the
  story frames as display-only. `DListItems` is hand-rolled for reasons of its own (multi-section
  grouped rendering), which these pages do not share.

### Option C — `renderExpanded` on `DataTable`, but filtering page-level via `showFilter={false}`

Take the shared-component change only where it is unavoidable (fact 3), and follow ADR `0026`'s
page-level precedent for the filter: each page renders its own search input and pre-filters `data`.

- **Pros.** Minimum shared-component surface. Direct precedent in shipped code.
- **Cons.** Moves the filter box out of the table's control strip on both pages — a visible layout
  change the story did not ask for, and one that would make these two pages look unlike their five
  siblings under Shared Concepts. Duplicates the match predicate twice. `showFilter` exists to let a
  page *own* filtering when it has page-level concerns (0026 had column-visibility toggles with
  per-user persistence); neither page here has any such concern.

## Decision

We chose **Option A**.

Fact 3 forces a `DataTable` change regardless — Option C concedes this. Given that the component is
being extended anyway, extending it *coherently* beats extending it halfway and then duplicating the
filter predicate across two pages to avoid a second, smaller prop.

On ADR `profile/0026`: its page-level choice was right for its context and remains in force for
`BrainstormFollows.jsx`, which this ADR does not touch. That page's filtering is genuinely
page-level — it is bound to a user-toggleable, `localStorage`-persisted column-visibility model.
What 0026 lacked was any shared hook for the simple case, which is why it added the page-level
workaround *and* the `showFilter` escape hatch that makes it possible. `filterKeys` is that missing
hook. This ADR **extends** 0026's reasoning rather than superseding it: pages with page-level
filtering concerns keep owning their filter; pages that merely need a value matched without a column
now say so declaratively.

**What we trade away:** a shared component used by 25 pages gains two branches. Mitigated by strict
opt-in — omit both props and the output is unchanged — which the test plan should pin directly.

**Scope amendment — `.text-muted` (owner, at this gate).** The draft of this ADR deferred fact 8 to
its own lane and had the panel use the dead class for consistency with its siblings. The owner
directed that the class be fixed here instead. The decision is therefore **define the class once,
globally** — `.text-muted { color: var(--text-muted); }` — rather than correct it locally in the new
panel. Defining it is what makes the panel's fallback correct *and* the other 131 usages correct at
the same time; a local fix would have left the root cause in place and made this panel an exception.

This is a deliberate, owner-ratified appearance change to 43 files that this story does not otherwise
touch. It alters no layout, no copy and no behaviour — only the colour of text that every one of
those call sites already asked to be muted. The Reviewer should read a repo-wide visual diff here as
*intended*, not as leakage from the panel work.

## Consequences

- **Enables.** Both pages scan by name instead of by coordinate; the coordinate is one click away and
  one more click onto the clipboard. Any of the other 23 `DataTable` pages can adopt either prop later
  without further design work.
- **Constrains.** Sorting by the tag column goes away with the column. Accepted: sorting a list by an
  opaque `kind:pubkey:slug` string has no reading a person wants. Not called out in the story; flagged
  here so the Reviewer does not read it as an accidental loss.
- **Row identity becomes load-bearing.** `renderExpanded` keys open/closed state per row, so a caller
  whose rows lack a stable `uuid`/`id`/`pubkey` would see expansion follow a *position* across a
  re-sort. Both pages here supply a stable `uuid` (`ActiveBTags:70`, `ActiveZTags:118`). Documented as
  a precondition of the prop, not solved generally.
- **`.text-muted` becomes live, app-wide.** The panel's "no description" fallback keeps
  `className="text-muted"` exactly as its sibling surfaces do, and the class is given the rule it has
  always lacked. 132 strings across 43 files change colour from `#e6edf3` to `#8b949e` in one commit
  — the appearance their authors intended. No `OPEN.md` row is needed for it any more; the follow-up
  this ADR would otherwise have filed is discharged here instead.
- **This is the widest-reaching part of the change, and the least related to the story's subject.**
  Worth stating plainly so it is not mistaken for scope creep at review: it is an explicit owner
  instruction at the Architecture gate, recorded in §Decision and in the story's criteria.
- **New debt.** `descriptionOf(ev)` will exist in three files (see Implementation notes). Accepted as
  house style — `singularName` is *already* duplicated between `ActiveBTags.jsx:26` and
  `BTagDetail.jsx:18`, and `ActiveZTags.jsx:32` carries a third variant (`bestName`, with a `name`
  fallback). Extracting all of them into a shared tag-reader module is a real cleanup that would touch
  the b-tag detail page, which this story puts out of scope. **Follow-up: an `OPEN.md` row.**
- **`npm run build` in `ui/` is required** for any of this to appear, locally included.
- **Firmware reinstall required?** **No** — no concept definitions change.

## Implementation notes

**`ui/src/styles.css`** *(the scope amendment)*

- Add one rule to the **Reset & Base** section, immediately after the `code` rule at `:30` and before
  the `Layout` banner at `:32`:

  ```css
  .text-muted { color: var(--text-muted); }
  ```

- Place it there, not lower: base-section source order means any later section-specific rule that
  deliberately overrides a muted colour still wins, which is the safe direction for a change this
  wide.
- **Change nothing else.** No call site is edited, no `className` is added or removed, and no inline
  `color: var(--text-muted)` is introduced anywhere — the whole point is that 132 existing call sites
  start working. An Implementer who finds themselves editing a `.jsx` file for this part has
  misread it.

**`ui/src/components/DataTable.jsx`**

- Signature (`:22`) gains `filterKeys = []` and `renderExpanded` (default `undefined`).
- Extract the row-key expression currently inline at `:112` into one helper used by *both* the
  `key=` prop and expansion state, so a row and its panel cannot disagree:
  `const rowKey = (row, i) => row.uuid ?? row.id ?? row.pubkey ?? i;`
- `filtered` (`:28–37`): extend the predicate with `filterKeys.some(k => match(row[k]))`; add
  `filterKeys` to the dependency array.
- Expansion state: `const [expanded, setExpanded] = useState(() => new Set())`; toggle by `rowKey`.
  Do **not** clear it on page/sort change — a row scrolled out of view and back keeps its state.
- `thead` (`:96–104`): when `renderExpanded` is set, append one non-sortable `<th>` with an empty
  label so header and body column counts stay aligned.
- `tbody` (`:106–124`): when `renderExpanded` is set, append a `<td>` holding a `<button>` that
  renders `▾`/`▸`, and **must** call `e.stopPropagation()` before toggling — otherwise `onRowClick`
  fires and `ActiveBTags` navigates away on every expand (the story's seventh criterion). Mirror
  `DListItems.jsx:550–560`. Render the panel as a sibling `<tr>` with
  `<td colSpan={columns.length + 1} style={{ padding: 0, border: 'none' }}>`.
- Empty-state `colSpan` (`:108`) becomes `columns.length + (renderExpanded ? 1 : 0)`.
- Update the component docblock to describe both props as additive/optional, matching how `pageSize`
  and `showFilter` are already described, and state the stable-`uuid` precondition.

**A shared panel body.** Both pages render the same two things (description, then a copyable code
value). Put it in one new small component — suggested `ui/src/components/TagDetailPanel.jsx`,
props `{ description, tagLabel, tagValue }` — rather than duplicating the markup on two pages.
It renders the description or the `text-muted` fallback, then the label, the value in a `<code>`
with `overflowWrap: 'anywhere'` (matching the column style being retired), and `<CopyButton
value={tagValue} />`. **`CopyButton` must receive the full untruncated value** (story criterion 3).

**`ui/src/pages/shared-concepts/ActiveBTags.jsx`**

- Add a local `descriptionOf(ev)` beside `singularName` (`:26`), reading the `description` tag —
  copy the three-liner from `BTagDetail.jsx:24–27`.
- `out.push({…})` (`:69–76`): add `description: descriptionOf(ev)`.
- Delete the `bTag` column object (`:156–160`). Leave `:68`'s sentinel skip untouched.
- `<DataTable>` (`:197–205`): add `filterKeys={['bTag', 'description']}` and
  `renderExpanded={(row) => <TagDetailPanel description={row.description} tagLabel="b-tag"
  tagValue={row.bTag} />}`. Leave `onRowClick` exactly as it is.

**`ui/src/pages/shared-concepts/ActiveZTags.jsx`**

- Add the same local `descriptionOf(ev)` beside `bestName` (`:32`).
- `targets.set(coord, {…})` (`:79`): add `description: descriptionOf(ev)`.
- `out.push({…})` (`:117–125`): carry `description: target.description` through.
- Delete the `uuid` column object (`:159–163`). `uuid` remains the row key — that is `rowKey`'s job,
  not the column's, so removing the column does not affect row identity.
- `<DataTable>` (`:198–202`): add `filterKeys={['uuid', 'description']}` and `renderExpanded` with
  `tagLabel="z-tag"` / `tagValue={row.uuid}`.

Test-file changes belong to Phase 3.

## Out of scope

- Any *other* correction to the 43 files that use `.text-muted` — the class gets its rule and nothing
  else about those files is touched.
- Extracting `singularName`/`bestName`/`descriptionOf` into a shared module. Its own lane.
- Any change to `BrainstormFollows.jsx` or the page-level filtering ADR `profile/0026` chose for it.
- Migrating any of the other 23 `DataTable` callers onto either new prop.
- The b-tag pair page, both pages' scans, counts, ordering and point-of-view handling, and the
  `showSelfFiled` toggle.
