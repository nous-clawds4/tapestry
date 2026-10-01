# ADR 0002: The 🧭 column is computed from each header's own tags, through the existing `dispositionOf`

**Status:** Accepted
**Date:** 2026-10-01
**Story:** `engineering-team/stories/list-headers-disposition/2-b-disposition-column.md`

## Context

Story 2 adds a read-only 🧭 column to List Headers:
- 🤝 self-declared, 🔗 wired, 🔒 kept private, with Concept Headers' chips, order and tooltips;
- a muted **○** for "not yet decided";
- **—** for every kind-9998 header (book decision 3).

**What already exists:**

- **The rule.** `dispositionOf(bValues, selfCoord)` in `ui/src/utils/bDisposition.js:30-46` returns
  `{ wired, selfDeclared, deferred }`. It is the UI mirror of `src/lib/bValueForms.js`.
  - An a-tag or event-id value equal to `selfCoord` sets `selfDeclared`; any other one sets `wired`.
  - The `b-tag-deferred` marker counts only when it stands alone ("a real b always beats a stale
    sentinel").
  - Malformed values are skipped.

  Concept Headers (`ui/src/pages/concepts/ConceptList.jsx:164`), Shared by Me, Active b-tags and the Treasure
  Map already classify through it. `test/b-coverage-audit-and-disposition.test.js:396-405` pins it as the
  one UI home for that rule.
- **The data.** The List Headers page already holds every header's raw event from
  `queryRelay({ kinds: [9998, 39998] })` (`ui/src/pages/lists/Index.jsx`). It already builds each 39998's
  own address, `39998:<pubkey>:<d>`, as `parentRef` in its `rows` memo. The b values are simply the event's
  `['b', value, …]` tags. No second read is needed.
- **Concept Headers' chips** (`ConceptList.jsx:250-252`):
  - 🔗 `wired to an external shared concept`;
  - 🤝 `self-declared shared concept`;
  - 🔒 `deliberately private (no shared affiliation)`;
  - in that order, inline `<span title>`s. Its column header is a `<span title>` icon
    (`'b-disposition (wired / self-declared / private)'`, `ConceptList.jsx:271`).
- **DataTable gives every column two behaviours from its raw value**, `row[col.key]`
  (`ui/src/components/DataTable.jsx:47-79, 128-131`):
  - clicking a header sorts by it (`String(...).localeCompare`);
  - the table's text filter matches it.

  So whatever the 🧭 column's key holds becomes a sort key and a search term. An object would sort as
  `"[object Object]"` and match a search for "object".
- **The mark.** `.text-muted` is defined (`ui/src/styles.css:38`).

**Constraints:**
- The book's frame says Concept Headers is unchanged.
- Principle 3 (filter at view time) favours computing from the events the page already has, not storing or
  fetching a disposition.
- The b-tag's type (`pointer` / `inherit`) doesn't affect disposition. `dispositionOf` ignores it, and so
  does this column.

**Concepts.** Only `39998:<TA>:list` is involved, and it's read. No concept, schema or firmware change.

## Options considered

### Option A — a pure per-header classifier over `dispositionOf`, computed in the `rows` memo

A new pure module takes one header event and returns its marks and a plain state word:
- a kind-9998 event is "not applicable";
- otherwise it collects the b values, builds the event's own address, calls `dispositionOf`, and maps the
  three flags to the chips in Concept Headers' order;
- no flags means "not yet decided".

The page stores the state word under the column's key and renders the marks. The chip words are copied from
Concept Headers. A test guards the copy against drift by checking the three tooltips still appear verbatim in
`ConceptList.jsx`.

*Pros:*
- The rule stays in its one home.
- Concept Headers isn't touched.
- The classifier is pure, so every AC case (self, wired by address, wired by event id, both, marker alone,
  marker plus a real b, malformed only, none, kind 9998) is a Node test.
- The column's raw value is a word, so the header sort groups states and the text filter finds "wired"
  instead of "[object Object]".

*Cons:*
- The three chip strings now live in two files. The drift guard turns that into a test failure, not a silent
  divergence.

### Option B — extract a shared `<DispositionChips>` component and chip table, used by both pages

*Pros:* the chips live once.

*Cons:*
- It edits `ConceptList.jsx`. The book's frame fences Concept Headers off for this book, and the deferred
  Concept Headers fix (OPEN.md row `2026-10-01-concept-headers-disposition-owner-signer`) will rework that
  page anyway.
- Only the three chips would be shared. The empty states differ by design: there it's a button or "—", here
  it's ○ or "—". Story 2's AC 4 exists because "—" can't mean two things on this page.

The extraction belongs with the Concept Headers fix.

### Option C — read b values from Neo4j (Concept Headers' Cypher) or a new endpoint

*Cons:*
- It's a second read of data the page already holds.
- Neo4j can lag strfry, so a header just re-published by stories 3 and 4 could show its old state.
- It puts work on the server for a pure view computation, which principle 3 argues against.

Rejected.

## Decision

We chose **Option A**. It reuses the one classification rule, needs no new read, and leaves Concept Headers
alone as the book promises. The duplicated chip words are guarded by a test, not trusted.

## Consequences

- **Enables** stories 3 and 4. A row's state ("not yet decided") is what they'll check before offering
  Disposition, and they'll get it from this classifier rather than recomputing it.
- **Sorting and the text filter come with DataTable; they aren't built here.** Clicking 🧭 groups rows
  alphabetically by state word, and typing "wired" in the table filter finds wired rows. The story leaves
  *new* sorting or filtering controls out of scope. These are DataTable's standing behaviour for every
  column, made sensible by a word-valued key. Tests shouldn't pin a sort order.
- **A 39998 with no `d` tag** gets the address `39998:<pubkey>:`. Its own b-tag can't match that, because
  `A_TAG_RE` needs at least one character after the last colon. So such a header can only show as wired,
  private or undecided, never self-declared. None exists on this machine.
- **The column shows the relay's current version** of each replaceable header, which is the version the
  page lists. When stories 3 and 4 re-publish a header, the column changes on the next load.
- **Debt.** The chip words are duplicated, guarded by a test. They fold into one place when the Concept
  Headers fix extracts a shared component.
- **Firmware reinstall required?** No.

## Implementation notes

- **New file `ui/src/utils/listHeaderDisposition.js`.** Pure ESM, with no React, no fetch, no module state.
  - Import it as `import { dispositionOf } from './bDisposition.js'`, **with the `.js` extension** (as
    `ui/src/utils/treasureMap.js:11` does). Node's ESM loader needs it when the test suite `import()`s
    this module.
  - `export const MARKS`, each a frozen `{ glyph, title, state }`:
    - `wired`: `'🔗'`, `'wired to an external shared concept'`, `'wired'`
    - `selfDeclared`: `'🤝'`, `'self-declared shared concept'`, `'self-declared'`
    - `deferred`: `'🔒'`, `'deliberately private (no shared affiliation)'`, `'private'`
    - `undecided`: `'○'`, `'not yet decided'`, `'undecided'`
    - `notApplicable`: `'—'`, `"Kind 9998 headers can't be re-published, so they don't take a disposition"`,
      `'not applicable'`
  - `export const COLUMN_TITLE = 'b-disposition (wired / self-declared / private / not yet decided)'`.
  - `export function listHeaderDisposition(event)` returns `{ state, marks }`:
    - If `event.kind !== 39998`: `marks = [MARKS.notApplicable]`, whatever the tags.
    - Otherwise:
      - `d` is the first `d` tag's value, or `''`;
      - `selfCoord` is `` `39998:${event.pubkey}:${d}` ``;
      - `bValues` is every `t[1]` where `t[0] === 'b'`;
      - `{ wired, selfDeclared, deferred } = dispositionOf(bValues, selfCoord)`;
      - `marks` is `wired`, then `selfDeclared`, then `deferred`, each included only when its flag is set;
      - if `marks` is empty, it becomes `[MARKS.undecided]`.
    - `state` is `marks.map(m => m.state).join(' + ')`. So `'wired + self-declared'` is a possible value.
- **`ui/src/pages/lists/Index.jsx`:**
  - Import `listHeaderDisposition`, `MARKS`, `COLUMN_TITLE`.
  - In the `rows` memo, compute `const disp = listHeaderDisposition(ev)` and add `disposition: disp.state`
    and `_dispositionMarks: disp.marks` to the row. The memo's dependencies are unchanged.
  - Insert one column right after `{ key: 'plural', … }`:
    `{ key: 'disposition', label: <span title={COLUMN_TITLE} style={{ cursor: 'help' }}>🧭</span>, render: (_v, row) => … }`.
    The render is an inline-flex `<span>` (gap `0.2rem`, as `ConceptList.jsx:266`) of one
    `<span title={m.title}>{m.glyph}</span>` per mark. The undecided mark also gets `className="text-muted"`.
  - No `onClick` and no button in the cell. Clicks fall through to the row's existing `onRowClick`.
  - Nothing else on the page changes.
- **Seams for the Tester** (Phase 3 decides the suites):
  - The classifier is pure: every AC case is a Node test over hand-built events.
  - A drift guard: each of the three chips' `title`s appears verbatim in `ConceptList.jsx`.
  - In the browser, the existing List Headers mocks plus b-tags on fixture headers. Story 1's spec
    (`tests/brainstorm/list-headers-author-options.spec.js`) already mocks the page hermetically.

## Out of scope

- Any action in the cell (stories 3 and 4).
- New sort or filter controls.
- Showing what a wired header points at.
- Extracting shared chips with Concept Headers (deferred to its fix).
