# Review: Story 8 — Derived columns for undeclared item fields

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-11
**Branch:** `feat/dlist-item-tagging`
**Diff:** `b86f0295` (tests + AC→handle plan) and `c44026e0` (implementation) — `git diff 3bcd8006..c44026e0`
**Profile:** Light (trial) — `workflows/light-profile.md` § Gate B
**Story:** `engineering-team/stories/dlist-item-tagging/8-derived-columns-for-undeclared-fields.md`
**ADR:** none (Design note lane) — ratified below
**Book:** `engineering-team/audits/dlist-item-tagging/book.md` (acceptance frame, lines 23–46)

## Quality gates (run by reviewer, not trusted)

Scoped gate per Gate A, run individually in the foreground via `direnv exec .` from the repo root.
No full `npm test` (operator constraint).

| Suite | Expected | Actual | Exit |
|---|---|---|---|
| `test/dlist-derived-columns.test.js` | 17 | **17 pass, 0 fail, 0 skipped** | 0 |
| `test/dlist-browse.test.js` | 25 | **25 pass, 0 fail, 0 skipped** | 0 |
| `test/strfry-write-assertion-bracket.test.js` | 6 | **6 pass, 0 fail, 0 skipped** | 0 |

- [x] Scoped gate green.
- [ ] `npm test` — not run (operator constraint; remains the book-close / promotion gate).
- [ ] `npm run test:playwright` — not applicable (no Playwright spec in the blast radius).
- [x] _Lint / typecheck / build not configured — skipped._

**Gate-run caveat (environment, not the diff).** On the first guard-suite run H1/H2 failed with
*"could not resolve the runtime TA pubkey via GET /api/assistant/pubkey"*. Cause: host `:7778` on
this machine is occupied by `infra-strfry2-1` (it answers 200 with strfry's HTML, so the suite's
`stackAvailable()` probe reads as reachable), while the `tapestry` control panel is published on
host `:8778`. Re-run with `BRAINSTORM_BASE_URL=http://localhost:8778` → **6/6 green**. The guard
suite file is byte-identical to `52f01425` (`git diff b86f0295~1..c44026e0 -- <guard>` is empty), so
the carve-out held: Phase 4 did not touch it. `test/dlist-browse.test.js` is likewise untouched —
its off-state sentinels (the literal `Other fields` header, the `details/summary` cell) still pass
unmodified, which is the real AC-5 evidence.

## Gate-A classification — ratified

**Design note (no ADR) is correct.** Walked every irreversibility trigger: no wire format or event
shape (nothing is published), no auth/trust default, no schema or firmware change (no concept
definitions touched → no reinstall owed), no new dependency (`useMemo`/`useState` are already in
use), no cross-repo contract, no request routing / middleware / headers, and no value duplicated
across repos. The change is confined to four files under `ui/src/`. Verified independently that
nothing under `src/` imports `dlistFields` (`grep -rn dlistFields src/` → empty).

## AC verdict table

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 — control offered, off by default | **MET** | `DListItemsTable.jsx:20` `useState(false)`; toolbar rendered only under `derived.length > 0` (`:32`); S1 green. |
| AC-2 — undeclared names on the current page become columns after the declared ones; single letters never promoted | **MET** | `dlistFields.js:147–158` builds from `undeclaredFields`, which already drops `t[0].length <= 1`, empty values and declared names (`:129–134`); `columns = showAll ? [...fieldDecls, ...derived] : fieldDecls` (`DListItemsTable.jsx:22`). U1, U2, S2 green. |
| AC-3 — derived columns visibly distinguished | **MET** | `requirement: 'derived'` → `is-derived` th class (`DListItemsTable.jsx:41`) + `title` override (`:42`); `styles.css:8471–8472` italic/muted + a `· derived` marker. S3 green. See NB-3. |
| AC-4 — other-fields cell gone; empty cell, never "missing" | **MET** | `showOther` gates `<th>` (`:47`) and `<td>` (`DListItemRow.jsx:66`) together; `fieldCellModel` only sets `missing` for `requirement === 'required'` (`dlistFields.js:121`), so `'derived'` can never trip it — no change to `fieldCellModel`, as designed. U7, S2 green. |
| AC-5 — off state renders as today | **MET (ratified — see NB-1, NB-2)** | Off path is `columns === fieldDecls`, `showOther === true`, `DListItemRow`'s new prop defaults `true`. R1 + the untouched `dlist-browse` sentinels green. Two off-state deltas exist and are judged compliant below. |
| AC-6 — table scrolls in its own region; page never scrolls sideways to ~400px | **MET in source; browser confirmation is the operator's** | `styles.css:8445–8446`. S4 is a source sentinel only; the viewport behaviour is a Gate-B browser step. Reasoning in NB-1. |
| AC-7 — both surfaces, no per-surface code | **MET** | All behaviour is inside the shared table; the three mount sites (`pages/List.jsx:164`, `components/TagItemsView.jsx:203`, `components/TagANoteModal.jsx:270`) are byte-unchanged in the diff. R2 green. |
| AC-8 — nothing to derive → no control | **MET** | Same `derived.length > 0` guard. U9, S1 green. |

## Probes (adversarial, beyond the plan)

**P1 — the extra `.bs-dlist-table-region` wrapper vs AC-5 (my call, carried forward from J3): COMPLIANT.**
The wrapper is layout-neutral by construction: a plain block `<div>` whose only declaration is
`min-width: 0` (`styles.css:8467`). It adds no margin, padding, display or border. Critically it
*preserves* the prior flex/grid semantics rather than changing them — before this diff the flex item
was `.bs-dlist-table-wrap`, whose `overflow-x: auto` gives it an automatic minimum size of zero;
now the region is the item, and the explicit `min-width: 0` reproduces exactly that. I grepped every
`table-wrap` selector in `styles.css` (lines 301, 1690, 2451 are unrelated `data-table`/`result-table`
rules; 8445 and 8470 are the dlist ones) — no descendant, child, `:first-child` or sibling selector
depends on `.bs-dlist-table-wrap`'s former parentage, so nothing is re-targeted. Off-state vertical
rhythm is preserved too: `margin-top: 1rem` stays on the wrap, and the `.bs-dlist-table-toolbar +
.bs-dlist-table-wrap { margin-top: 0.5rem }` override only fires when a toolbar is actually present.
AC-5 governs rendered output, not DOM shape; the rendered output is unchanged. Ratified.

**P2 — `width: max-content; min-width: 100%` inside `overflow-x: auto`. Both directions check out.**
*Wide:* `max-content` sizes the table to its unwrapped content, so it overflows the wrap and the
wrap (not the page) scrolls — which is precisely the gap the Design note named, since the old
`width: 100%` made auto table layout squeeze columns toward min-content instead of overflowing.
*Narrow:* `min-width: 100%` resolves against the wrap's content box (a definite width inherited
from its block parent), so a table with few short columns still fills the container exactly as
before — no narrow-content regression. *Page-never-sideways:* `max-width: 100%; min-width: 0` on the
wrap plus `min-width: 0` on the region neutralise the flex/grid-item "forced wide" failure mode in
both axes. The one real consequence is NB-1.

**P3 — `derivedFieldDecls` ordering: confirmed by reading, not by the tests alone.**
`dlistFields.js:148–153`: the outer loop is over *items*, and the inner loop walks
`new Set(undeclaredFields(item, fieldDecls).map(f => f.name))` — the `Set` collapses repeats within
one item, so `count` is items-carrying, not tag occurrences (E1). `first: order++` increments only
on first sight of a name, giving a dense, unique first-appearance rank. The comparator
`b.count - a.count || a.first - b.first` therefore has no ties left to resolve, so the result does
**not** depend on `Array.prototype.sort` stability — deterministic for a given input. Feeding the
same items in a different array order changes `first` and so can change tie order; that is the
correct reading of "ties broken by first appearance", not nondeterminism.

**P4 — collateral.** The three mount sites are untouched and each always passes an array for
`fieldDecls` (`List.jsx:119` `useMemo(… : [])`, `TagItemsView.jsx:189` `… : []`,
`TagANoteModal.jsx:42/61/71/77/78/91` initialised `[]`), so the new `[...fieldDecls]` spread cannot
throw on a null header (E5). `DListItemRow`'s `showOther = true` default keeps any other caller
unaffected. `pages/lists/DListItems.jsx` and `pages/events/DListItemsList.jsx` remain non-consumers
(R3). Nothing under `src/` imports `dlistFields`.

**P5 — per-table independence (story 4's groups).** `TagItemsView.jsx:187–206` renders one
`<DListItemsTable>` per group inside `groups.map`, each with its own `fieldDecls` computed at
`:189`. Component-local `useState`/`useMemo` therefore give each group an independent toggle and an
independently-derived column set — which is what the per-table control requires. Keys are
`group.listCoord`, so toggle state follows its group across re-renders.

**P6 — header/body column alignment under both states.** thead: `Added by`, `Age`, `columns…`,
`[Other fields]`, `Votes`, `[extra]`; row: author, age, `columns…`, `[other]`, votes, `[extra]`.
Both `Other fields` and the `renderExtra` slot are gated by the same conditions on both sides. No
stray `<th>`/`<td>` in either state.

## Concept-graph integrity
- [x] No concept definitions touched — no firmware reinstall owed.
- [x] No handles constructed; no `kind:pubkey:slug` string built.
- [x] No 64-hex literal anywhere in the added lines (grepped the whole commit); the per-deployment
      TA rule is not engaged — this story publishes nothing and signs nothing.

## Things tests can't catch
- [x] No secrets, no `console.*`, no `debugger`, no `TODO`/`FIXME`, no commented-out code in the
      added lines (grepped `git show c44026e0` for `^\+`).
- [x] No async or shared state — `derivedFieldDecls` is pure and synchronous; no race surface.
- [x] No input reaches a boundary: every input is a prop or local state; nothing is fetched,
      published, or interpolated into a query.
- [x] Degenerate inputs (`null` items, `null` fieldDecls, junk tags) return `[]` without throwing
      (U9) — verified by reading `Array.isArray(items) ? items : []` and `(fieldDecls || [])`.

## House rules check
- [x] Concept Graph API authority respected (nothing concept-shaped changed).
- [x] No new lint/typecheck/build tooling; no new dependency; no new test infrastructure (the story
      explicitly declines jsdom/RTL and says so).
- [x] Scope: the diff is exactly the declared blast radius — four files, no more.

## Findings

### Blocking
None.

### Non-blocking

1. **`ui/src/styles.css:8446`** — `width: max-content` changes the *off* state too, for long cell
   values. Under the old `width: 100%` a long value (a description, a long URL) wrapped and the
   table stayed inside the container; `max-content` ignores soft wrap opportunities, so such a table
   now overflows and scrolls horizontally where it previously wrapped. `.bs-dlist-table td` carries
   no `max-width`, so nothing bounds it. This is the ratified intent of AC-6 (which is unconditional
   — "given a table wider than its container", not "when the toggle is on"), and AC-5's own handles
   (R1, S2) target the column set and the Other-fields cell rather than column widths, so I read
   AC-6 as governing where the two touch. Not blocking. **But it is the thing most likely to look
   wrong at 400px**: please eyeball an *existing* declared list with a long text field in the
   **off** state, not just a derived-column list. If it reads badly, a follow-up
   `.bs-dlist-table td { max-width: 28rem }` is the one-line mitigation — out of scope here.
2. **`ui/src/components/dlist/DListItemsTable.jsx:28`** — the new `.bs-dlist-table-region` wrapper is
   an off-state DOM delta. Ratified compliant in P1; recorded here so the audit has the trail.
3. **`ui/src/styles.css:8472`** — the word "derived" is user-visible text living in CSS
   (`::after { content: ' · derived' }`). Three consequences, none blocking here: generated content
   is generally not selectable or copyable, so a reader copying the header row gets the bare field
   name; screen-reader support for announcing `::after` is real but inconsistent across NVDA / JAWS /
   VoiceOver settings; and the string is unreachable by any future i18n pass. The mitigations that
   make this non-blocking are that the semantic information is *also* in the DOM as the `title`
   attribute (`DListItemsTable.jsx:42`, the full "not declared by this list's header — derived from
   its items"), that the repo has no i18n layer to violate, and that AC-3 asks only for a visible
   distinction. Preferred shape for a follow-up: render `<span className="bs-derived-marker">
   derived</span>` inside the `<th>` and style the span — same look, real text. Worth a one-line
   `_intake.md` row rather than a re-spin. Note that S3 pins the class and the title but not the
   marker word, so the word is not test-protected.
4. **`ui/src/components/dlist/DListItemsTable.jsx:23` vs `:56`** — the Implementer's own flagged
   redundancy: `const showOther = !showAll` gates the `<th>`, while the row receives the literal
   `showOther={!showAll}`. Two expressions of one truth, four lines apart. Drift risk is low but
   non-zero and the fix is free: pass `showOther={showOther}`. Not blocking — S2 asserts the pair
   moves together, so a drift would go red.
5. **`ui/src/components/dlist/DListItemRow.jsx:51`** — `others` is computed unconditionally even
   when `showOther` is false, where it is guaranteed `[]` (the row receives `columns`, which already
   contains every derived name). Harmless dead work on a small array; noted only so a future reader
   doesn't mistake it for a missing guard.
6. **Test-shape observation, not a defect** — S1–S4 are regex-over-source sentinels, so the React
   wiring is pinned structurally rather than behaviourally. The story names this and the reason (no
   jsdom/RTL, house rule against new test infra), and it is why E3 (derived name colliding with a
   built-in heading) and E4 (paging with the toggle on) are explicitly Gate-B browser checks.

### Deferred to the operator's Gate-B browser pass (I did not attempt these)
A signed-in browser check is required and is not mine to run:
- **~400px viewport**, both toggle states, on a list with many derived columns *and* on a
  declared list with long values (NB-1) — AC-6 and the off-state regression.
- **E3** — a derived name colliding with `Added by` / `Age` / `Votes` / `Other fields`: duplicate
  header text is accepted as cosmetic; confirm it reads acceptably.
- **E4** — press "Next page" on `/list/:ref` with the toggle on: columns may appear or reorder under
  the reader while the toggle stays on. Accepted by the story; confirm it is not disorienting.
- **E7** — the toggle appearing inside `TagANoteModal`'s single-item table.

### Harness friction
1. The scoped guard suite `test/strfry-write-assertion-bracket.test.js` reports a **false negative**
   on this machine because its default `HOST_BASE` (`http://localhost:7778`) is squatted by
   `infra-strfry2-1`, which answers 200 to the `stackAvailable()` probe with strfry's HTML index —
   so the suite believes the stack is up, then fails to parse the TA pubkey and reports two hard
   failures rather than skipping. The control panel is on host `:8778` here. Two defects worth an
   `OPEN.md` `meta` row: (a) the reachability probe should validate the *response shape*
   (`"success": true`) on the host leg as it already does on the container leg, not just `r.ok`;
   (b) the local default port is wrong for this machine's layout, and every Light story that names
   this suite in its scoped gate will hit it. Workaround until then:
   `BRAINSTORM_BASE_URL=http://localhost:8778`.

## Verdict
**PASS**

Seventeen, twenty-five and six — the full scoped gate green, the guard suites byte-identical and
green on their own terms, and all eight ACs met. The implementation is the Design note built exactly
as specified: one pure export, all behaviour inside the shared table, zero edits at three mount
sites. The two judgement calls it left for me both come down the same way. The extra
`.bs-dlist-table-region` wrapper is layout-neutral — a block div whose sole declaration reproduces
the flex-item minimum-size behaviour the old wrapper got for free from `overflow-x: auto` — and no
selector in the stylesheet depends on the former parentage, so AC-5's "renders exactly as today"
survives, because AC-5 is about rendered output and not DOM shape. The `max-content` / `min-width:
100%` pair is right in both directions: wide tables overflow into their own scroll region instead of
squeezing, and narrow ones still fill the container. Its one honest cost is that long cell values no
longer wrap, in the off state as well as the on state — ratified because AC-6 is unconditional, but
flagged as NB-1 because it is exactly what will look wrong first at 400px, and the check that
catches it is an *existing* declared list, not a derived-column one. `derivedFieldDecls` reads
clean: counted per item via a `Set`, first-appearance rank dense and unique, comparator with no
residual ties and so no dependence on sort stability. The rest is polish — the "derived" marker
should be DOM text rather than CSS generated content, and the duplicated `showOther` expression
should use its own const. Neither is worth a re-spin. The browser pass and its four accepted edge
cases are the operator's.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [ ] Completion detection: the book's acceptance frame (`book.md:29–46`) is **not** complete —
      the pin/TL bullet and the publish-discipline bullet remain open, and story 8 is a rendering
      refinement on top of the header-driven-rendering bullet. `/close-book` **not** offered.
