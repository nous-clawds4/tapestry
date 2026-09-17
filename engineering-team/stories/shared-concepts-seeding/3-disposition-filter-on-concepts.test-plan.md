# Test Plan: Story 3 — Find, in bulk, which of my concepts I haven't shared

**Story:** `engineering-team/stories/shared-concepts-seeding/3-disposition-filter-on-concepts.md`
**ADR:** `engineering-team/decisions/shared-concepts-seeding/0001-not-yet-shared-filter-joins-the-bulk-sharing-answer.md`
**Date:** 2026-08-10

## One refinement to the ADR, needed to make this testable

ADR 0001's implementation notes say *"All changes are in one file plus its tests."* As written, the
filter predicate would live inside a React component and could only be checked by source grep — and
a grep cannot tell a correct predicate from a plausible-but-wrong one. That is precisely the failure
mode this story exists to avoid, so the plan requires one addition:

> **`ui/src/utils/conceptStateFilter.js`** — a **dependency-free** module exporting `STATES` and
> `matchesState(row, state, ctx)`. No React, no `fetch`, no app imports.

This is not a new pattern. `ui/src/utils/bDisposition.js` is already exactly this shape (pure
classification logic lifted out of the pages that use it), `ui/package.json` declares
`"type": "module"`, and `test/firmware-concept-elements-sets.test.js:58-66` already carries the
`loadEsm` helper for importing such a module under plain node — the "pure core" split ADR
firmware-explorer/0001 established. The predicate becomes directly executable, and the page becomes
a renderer of it.

**This is a deviation from the ADR's one-file note and needs ratification at this gate.** The
alternative is source-grep-only coverage of AC-2/3/4, which would let the story ship green while
answering the wrong question.

## Coverage map

| Criterion | Test | Level |
|---|---|---|
| AC-1 (composes) | `U8` (state passes all through; author filtering is a separate stage) + **V1** rendered check | unit + manual |
| AC-2 (pages agree) | `U2`, `U6` (exact set), `S1` (single source, no re-derivation) | unit + source |
| AC-3 (unconfirmed ≠ not-shared) | `U3`, `S3` (no silent swallow) | unit + source |
| AC-4 (local declaration ≠ shared) | **`U1`** — the discriminating test | unit |
| AC-5 (controls aren't synonyms) | `U7` (different sets), `U9` (states named once), `S2` (one selector) | unit + source |
| Ratified exclusions (🔒 / 🔗) | `U4` | unit |
| Design assumptions | `H1` (response shape), `H2` (join key is real) | live stack |
| No collateral damage | `S4` (`nextUndispositioned` / "Save & next" survive) | source |

### U1 is the test that matters

Every other test can be satisfied by an implementation that reads the disposition chip. `U1` cannot:
its fixture is a concept with `selfDeclared: true` **and** `published: false` — declared locally,
absent from the relay. A chip-reading filter calls it shared and drops it; a correct filter lists it.
If `U1` is ever deleted or weakened, the story's central guarantee is gone.

**A live instance of exactly this case already exists** and needs no fabrication — `/api/shared-by-me`
on this machine reports `b-coverage fixture` (`…:b-coverage-fixture-s1b`) as `published: false`
while `dog`, `dog breed`, and `tapestry` are `true`. That is the fixture for the rendered check below.

## Edge cases covered

- [x] Declared-but-unpublished (`U1`) — the discriminating case.
- [x] Relay unreachable → every declared concept `published: null` (`U3`), *and* never-declared
      concepts still correctly listed, because the local read alone settles them (ADR failure tier 2).
- [x] Another author's concepts never appear under "(mine)" (`U5`).
- [x] Ratified exclusions: wired and deliberately-private (`U4`).
- [x] The two look-alike states select different sets (`U7`).
- [x] Endpoint contract drift — `H1` fails if `relayOk` or tri-state `published` ever changes shape.
- [x] The join key claim — `H2` fails if `coord` and the concept-header `uuid` stop matching.
- [x] Stack absent → H-class per-test `SKIP`; U and S still run and gate.

### Deliberately not automated

- **The rendered page.** Asserting DOM output would need Playwright, which row 13 defers for its
  dependency and relay-state cost. It is **V1** below instead, run at Review — and it is not
  optional: this book has twice shipped a wrong *name* past a green suite, and only a person looking
  at the page caught it.
- **A forced relay outage.** `U3` covers the logic; inducing a real outage means blocking the relay
  host, which is invasive and would prove nothing `U3` doesn't.

## Test infrastructure

- Framework: the repo's own runner — `node test/test.js`, suites exporting `run()`. No new tooling.
- Registered in `test/test.js` at four sites (require ~line 242, invocation ~602, skip-aware summary
  ~1076, overall-pass conjunction ~1284).
- U-class loads `ui/src/utils/conceptStateFilter.js` by dynamic `import()` of a `pathToFileURL` —
  works because `ui/package.json` is `"type": "module"`. **The module must import nothing**, or the
  load fails and every U test reports that as the reason.
- H-class: `http://localhost:7778` — `/api/shared-by-me` and `/api/neo4j/query`.
- Firmware state: no precondition. No concept definitions change; no reinstall.
- Fixtures: six fabricated rows in-suite, one per distinguishable situation. Nothing is written
  anywhere — this suite is read-only against the stack.

## How to run

```bash
node test/not-yet-shared-filter.test.js
```

Full gate:

```bash
npm test
```

## Verification

The U and S tests fail against current code; the H-class contract checks and the two pre-satisfied
S guards pass, as designed. Confirmed 2026-08-10 at commit `ce5b2e56`:

```
  FAIL  U1 … ui/src/utils/conceptStateFilter.js does not exist yet — the pure state predicate
        (ADR shared-concepts-seeding/0001, Implementation notes) is not implemented.
  FAIL  U2 … U9   (same reason)
  FAIL  S1 … ConceptList.jsx must read publication from /api/shared-by-me …
  FAIL  S2 … the Coverage checkbox must be replaced by a single-select state filter … Found 1 checkbox input(s).
  PASS  S3 (no silent swallow — currently exactly one, the pre-existing health fetch)
  PASS  S4 (nextUndispositioned / _undispositionedMine present)
  PASS  H1 (/api/shared-by-me shape: relayOk + tri-state published per coord)
  PASS  H2 (join key real — a coord matches a concept-header uuid)

not-yet-shared-filter: 4 passed, 11 failed, 0 skipped
```

`S3`, `S4`, `H1`, `H2` are **pre-satisfied guards**, documented as such in the suite header. `S3`
holds today because the page has exactly one silent `.catch(() => {})` (the health fetch); it turns
red if the Implementer adds a second, which is the regression it exists to catch. `H1`/`H2` pin the
two facts ADR 0001 leans on — if either fails, the design is wrong rather than the code.

## Verification protocol V1 (AC-1, and the rendered truth) — run at Review

Automated coverage stops at the predicate. This runs the real page:

1. Open `http://localhost:7778/tapestry/concepts` (62 concepts on this instance).
2. Select state **Not yet shared (mine)**. Confirm **`b-coverage fixture` IS listed** and
   **`dog`, `dog breed`, `tapestry` are NOT** — the live AC-4/AC-2 pair.
3. Add author **🤖 Tapestry Assistant**; confirm the two controls narrow *together* (AC-1), and that
   selecting a different author empties or reduces the list rather than replacing the state filter.
4. Switch to **Undispositioned (mine)**; confirm the row set **differs** from step 2 by
   `b-coverage fixture` (AC-5 on screen, not just in the predicate).
5. Read the control labels as a stranger would and confirm each says what it selects.
6. Capture a screenshot into the review.
