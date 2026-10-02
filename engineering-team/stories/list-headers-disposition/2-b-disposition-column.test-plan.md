# Test Plan: Story 2 — The 🧭 b-disposition column on List Headers

**Story:** `engineering-team/stories/list-headers-disposition/2-b-disposition-column.md`
**ADR:** `engineering-team/decisions/list-headers-disposition/0002-disposition-column-from-the-events-own-tags.md`
**Date:** 2026-10-01

Two files:

- **`test/list-headers-disposition-column.test.js`** (Node runner, registered in `test/registry.js`). D1–D12
  cover the pure classifier in `ui/src/utils/listHeaderDisposition.js`, run over hand-built header events.
  D9 is the drift guard against Concept Headers' chip words. Stack-free: no network, no publish.
- **`tests/brainstorm/list-headers-disposition-column.spec.js`** (Playwright, network-mocked, hermetic like
  story 1's spec). C1–C7 cover what a viewer sees on `/tapestry/lists`.

Story 1's spec, `tests/brainstorm/list-headers-author-options.spec.js`, is the regression check for the
page. Its 10 tests must keep passing with the new column in place.

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC 1: a 🧭 column right after the two name columns, on every row from every author, signed in or not; its tooltip names the states | D8; **C1** (signed out *and* signed in) | both | unit + browser |
| AC 2: 🤝 self-declared; 🔗 wired by address or by event id; 🔗 then 🤝 for both; Concept Headers' chips, order and tooltips | D2, D3, D4, D9, D10; **C2** | both | unit + browser |
| AC 3: the marker alone shows 🔒; beside a real b-tag the real chip wins | D5; **C3** | both | unit + browser |
| AC 4: no b-tag, or only unreadable b values, shows a muted ○ "not yet decided", never an error and never "—" | D6; **C4** | both | unit + browser |
| AC 5: kind 9998, whatever its tags, shows "—" with the can't-be-re-published tooltip | D7; **C5** (one 9998 with a b-tag, one without) | both | unit + browser |
| AC 6: no action in the cell; clicking it opens the list as the row does | **C6** | spec | browser |
| ADR 0002: the column's value is a state word | D11; **C7** (the table's own search box) | both | unit + browser |
| ADR 0002: a 39998 with no `d` tag can't be self-declared | D12 | suite | unit |

## Edge cases

- [x] Both chips, in either tag order (D4).
- [x] The marker beside a self-pointing b, and beside a wiring (D5, C3).
- [x] A b-tag with no value; an empty value; a near-miss address with a short pubkey (D6).
- [x] The b-tag's type (`pointer`, `inherit`, none) doesn't matter (D10).
- [x] A kind-9998 header carrying the marker, a wiring, or an event id (D7, C5).
- [x] The muted mark really is muted (`text-muted`, C4).
- [ ] Not covered, on purpose: a sort order. ADR 0002 says DataTable's header sort comes with the table and
      isn't built here.

## Test infrastructure

- **Node runner for D1–D12.** To run one suite by itself, call its exported `run()`. Don't run the full
  `npm test` on this machine without asking.
- **D9 reads `ui/src/pages/concepts/ConceptList.jsx`.** When Concept Headers' chips change on purpose (the
  deferred Concept Headers fix), change both files.
- **Playwright** uses the same mocks as story 1's spec: a catch-all first, the instance config answered
  before the rows, and the rows from `GET /api/strfry/scan`. There are ten fixture headers, one per case,
  each with a unique name:
  - self-declared;
  - wired by address;
  - wired by event id;
  - both;
  - the marker alone;
  - the marker plus a wiring;
  - undecided;
  - unreadable;
  - a plain 9998;
  - a 9998 with a b-tag.
- **Markup contracts the spec relies on:**
  - the 🧭 column is found by its header text, not its position, except in C1, which checks the position;
  - each mark is an element with a `title`;
  - the table's search box is `input.table-filter` (DataTable's own).
- No Concept Graph API calls and no firmware state.

## How to run

```
node -e "const m=require('./test/list-headers-disposition-column.test.js'); Promise.resolve(m.run()).then(r=>process.exit(r.fail?1:0))"
BRAINSTORM_BASE_URL=<a vite preview of a build, or :7778 after /cycle-local> npx playwright test tests/brainstorm/list-headers-disposition-column.spec.js tests/brainstorm/list-headers-author-options.spec.js --project=chromium
```

## Verification

### The new tests fail with the current code

Confirmed 2026-10-01 at `204e6c73`, plus these tests.

- **Node suite:** 0 passed, 12 failed. Every test fails with
  `ui/src/utils/listHeaderDisposition.js must exist as a pure ESM module Node can import … Cannot find module`.
- **Playwright,** on a build of `204e6c73`: the 8 new tests fail, with these messages:
  - C1 (both sign-in states): `story AC 1: Name (singular), Name (plural), then 🧭, then Kind`;
  - C2–C6: `story AC 1: the table has a 🧭 column`;
  - C7: `ADR 0002: the column's value is a state word…`.

  Story 1's 10 tests pass on the same build.

### The tests can pass, and they catch the defects they're meant to catch

A throwaway build that does exactly what ADR 0002 describes was made outside the repo: the new module plus
the page's new column. It isn't committed.

- **Node:** 12 of 12 pass.
- **Playwright:** 18 of 18 pass (this spec plus story 1's), and 40 of 40 for this spec with
  `--repeat-each=5`.

Each mutant below changes one rule of that build. Every mutant fails at least one test:

| Mutant | Fails |
|---|---|
| m1: "not yet decided" shows "—", the way Concept Headers shows other authors' rows | C4 (`"undecided list" shows ○`) |
| m2: a button inside the cell (story 3 leaking in early) | C6 (`nothing in a 🧭 cell is a button…`) |
| m3: the column's key holds the whole result object, not a word | C7 |
| n1: kind 9998 is classified like 39998 | D7, D11 |
| n2: 🤝 before 🔗 | D4, D11 |
| n3: the marker shows even beside a real b-tag | D5 |
| n4: a chip's tooltip drifts from Concept Headers' | D3, D9 |
