# Test Plan: Story 1 — Row detail panels on the Active …-tags pages

**Story:** `engineering-team/stories/shared-concepts-row-detail/1-row-detail-panels-on-active-tag-pages.md`
**ADR:** `engineering-team/decisions/shared-concepts-row-detail/0001-row-detail-panels-on-active-tag-pages.md`
**Date:** 2026-09-20

## Levels, and why the work is split across two suites

The three surfaces this story changes are `.jsx` and cannot be imported without a transform, so the
Node gate cannot exercise them behaviourally. The split is therefore deliberate:

- **Playwright** (`tests/brainstorm/shared-concepts-row-detail.spec.js`) carries the behaviour —
  opening and closing a panel, panel independence, what actually lands on the clipboard, what the
  filter box actually matches, the muted colour as a browser computes it, and the surviving row
  click. These are the acceptance criteria as written, tested as a person would experience them.
- **The Node gate suite** (`test/shared-concepts-row-detail.test.js`) carries what Playwright
  *cannot* see: that `DataTable`'s new branches are strictly opt-in for the other 23 callers, that
  the app-wide `.text-muted` fix edited CSS and nothing else, and four sentinels pinning what this
  story must not disturb. Registered in `test/registry.js`.

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 panels closed by default; tag column gone | `E1`, `E10` | `tests/brainstorm/…row-detail.spec.js` | e2e |
| AC-2 toggle opens/closes; rows independent | `E2`, `E3`, `E10` | same | e2e |
| AC-3 full value to clipboard + acknowledgement | `E4` | same | e2e |
| AC-3 (guard) value passed untruncated | `S13` | `test/shared-concepts-row-detail.test.js` | structure |
| AC-4 absent description says so | `E5` | spec | e2e |
| AC-5 tag still filterable | `E6`, `E11` | spec | e2e |
| AC-6 description filterable, panel closed | `E7`, `E11` | spec | e2e |
| AC-5/AC-6 (mechanism) filter consults `filterKeys` | `S2`, `S3`, `S10`, `S11` | node | structure |
| AC-7 row click still navigates | `E8` | spec | e2e |
| AC-7 (mechanism) `stopPropagation` on the control | `S5` | node | structure |
| AC-8 description is the LOCAL event's | `E2` | spec | e2e |
| AC-9 sentinel reaches no row and no panel | `E9`, `R2` | spec + node | e2e + structure |
| AC-10 muted text renders muted | `E12` | spec | e2e |
| AC-10 (mechanism) one global CSS rule | `S14`, `S15` | node | structure |
| ADR: opt-in for the other 23 callers | `S1`, `S6`–`S9` | node | structure |
| ADR: shared panel component, not duplicated | `S12` | node | structure |
| ADR: row identity is stable | `S4` | node | structure |
| ADR: scope amendment recorded | `D1`, `D2` | node | docs |

## Edge cases covered

- [x] A DList Header with **no** `description` tag (`E5`, and the `bare one` fixture).
- [x] The reserved `b-tag-deferred` sentinel — no row, and no panel (`E9`).
- [x] The **community relay is unreachable** during every spec run (it is a websocket and is
      deliberately left unmocked). The panels must still render from local data — this is what makes
      AC-8's "local, not shared" claim load-bearing rather than incidental.
- [x] Filtering on text that is **not visible** — the description lives inside a closed panel (`E7`).
- [x] The empty table (`S7` — the "no data" cell must widen with the disclosure column).

## Deliberately NOT covered, and why

- **The other 23 `DataTable` callers are not re-tested.** `S1` and `S9` pin the opt-in guards
  structurally instead. A per-caller visual sweep is the Reviewer's judgement call, not a test.
- **The 43 files that use `.text-muted` are not individually asserted.** `E12` proves the rule
  resolves in a browser; `S14` proves it is defined once and globally. Asserting 132 call sites would
  pin formatting, not behaviour.
- **Sorting** — removed with the column, by ADR §Consequences. No test asserts its absence.

## Test infrastructure

- Node built-in runner via `npm test`; the suite is registered in `test/registry.js`. Read a run's
  verdict with `npm run gate:status`.
- Playwright via `npm run test:playwright`; `baseURL` defaults to `http://localhost:7778`.
- **The spec mocks the whole HTTP stack** (`/api/assistant/pubkey`, `/api/strfry/scan`, profiles,
  auth, status), so it needs **no** particular graph state and **no** firmware install. It does need
  the UI built into `dist/` — `npm run build` in `ui/` — because the control panel serves the build,
  not the source.
- First run on a machine needs `npx playwright install chromium`. Done on this machine 2026-09-20
  (the cached builds had drifted from Playwright 1.56.1's expected `chromium_headless_shell-1194`).
- Fixtures are inline in the spec: three local kind-39998 headers (described / bare / sentinel-bearing)
  and, for the z-tags page, one foreign header plus one local z-carrier.

## How to run

```bash
npm test
```

```bash
npx playwright test tests/brainstorm/shared-concepts-row-detail.spec.js --project=chromium
```

## Verification

Both suites confirmed failing for the right reasons on 2026-09-20, at commit `c7f663fb`.

**Node gate suite — 15 failed, 6 passed.** The six passing are the two docs tests and the four
sentinels, exactly as designed; a sentinel that failed would mean the change went further than asked.

```
  ❌ S1: DataTable accepts filterKeys (default []) and renderExpanded
      Got: {columns, data, onRowClick, emptyMessage = 'No data', pageSize, showFilter = true}
  ❌ S7: the empty-row colSpan accounts for the disclosure column
      Got: colSpan={columns.length}
  ❌ S9: every new branch is strictly opt-in … Found 0 guard(s) in <tbody>
  ❌ S14: .text-muted is defined once, globally, resolving to the palette variable
  ✅ R2: Active b-tags still skips the b-tag-deferred sentinel at row-build time
  ✅ R3: neither page gained a fetch — the panels use data already on the row
shared-concepts-row-detail: 6 passed, 15 failed
```

**Playwright — 10 failed, 2 passed.** E6 and E8 pass today by design: the b-tag is filterable now
only because it is still a column, and the row click already works. Both are regression guards that
must still pass after the change.

```
  Error: AC-1: the b-tag column must be gone from the table
    Expected pattern: not /b-tag/
    Received string:  "name (local)|b-tag|name (shared)|author (shared)"

  Error: AC-10: muted text must resolve to the palette muted colour
    Expected: "rgb(139, 148, 158)"
    Received: "rgb(230, 237, 243)"

  10 failed, 2 passed (35.7s)
```

The remaining eight fail by timing out on a disclosure control that does not exist yet — the correct
reason, and the mocks are confirmed sound because the fixture rows themselves render.
