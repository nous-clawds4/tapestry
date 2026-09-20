# Test Plan: Story 1 — the roll-up's scanners report what is there

**Story:** `engineering-team/stories/rollup-scanner-fidelity/1-scanners-report-what-is-there.md`
**ADR:** `engineering-team/decisions/rollup-scanner-fidelity/0001-shared-scanner-libs-and-marker-grammar.md`
**Date:** 2026-09-20

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 | `a cut that lands inside a multi-byte character yields valid UTF-8, not a half character` | `test/rollup-scanners.test.js` | unit |
| AC-1 | `the answer is the same with no locale set, under LC_ALL=C, and under a UTF-8 locale` | same | unit |
| AC-1 | `a 4-byte character is never half-emitted, at any offset into it` | same | unit |
| AC-2 | `on this repo's real OPEN.md, no line of META_LINES is invalid UTF-8` | same | integration (real file) |
| AC-3 | `a cut that lands exactly on a character boundary keeps that whole character` | same | unit |
| AC-3 | `a string within the budget comes back whole, and an empty string is empty` | same | unit |
| AC-4 | `an open book prints its opened date and a real age, on a date that rejects -d` | same | integration (fixture repo) |
| AC-5 | `an open book whose Opened line holds no date is still listed, without an age` | same | integration |
| AC-6 | `a — Meta: entry marked **NOT PICKED UP** is counted by the digest` | same | integration |
| AC-6 | `on this repo's real _intake.md: nothing whose marker starts **NOT is retired` | same | integration (real file) |
| AC-6/7/8/9 | 13 table-driven `marker … classifies the entry as …` cases | same | unit |
| AC-7 | `the real entry that says "Part B still OPEN" is listed as partly picked up` | same | integration (real file) |
| AC-7 | `a partly picked up entry is listed by /whats-open, under its own heading` | same | integration |
| AC-8 | `the word "partial" in prose after the marker does not make the entry partial` | same | unit |
| AC-10 | `a retired entry that still carries ### sub-headings is named in a warning, with them` | same | integration |
| AC-11 | `a retired entry with no ### blocks, and an open entry with them, raise no warning` | same | integration |
| AC-12 | `the section lists at most WHATS_OPEN_CARRY_BOOKS books and says what it suppressed` | same | integration |
| AC-12 | `a book closed outside the recency window is suppressed, and the window is named` | same | integration |
| AC-12 | `a book whose close date cannot be read is listed, never suppressed` | same | integration |
| AC-12 | `WHATS_OPEN_CARRY_DAYS and WHATS_OPEN_CARRY_BOOKS widen the section beyond its defaults` | same | integration |
| AC-13 | `6-book-close.md tells a closer to tick a §6 item when it is resolved elsewhere` | same | static |
| AC-14 | — no test; the ledger's state is checked at Review | — | — |

The marker table is the grammar itself, case by case: eight real spellings from `_intake.md`
(including the two the readers cannot see today, `**DONE**` and `**REASSIGNED**`, and the
`**NOT PICKED UP**` form that must never read as a marker) and four qualified pick-ups.

## Edge cases

- [x] Empty string and a string inside the budget — the trim must not shorten either.
- [x] A cut landing *exactly* on a character boundary — a walk-back that fires unconditionally
      eats a whole character. This is a mistake made while designing the fix, so it is pinned.
- [x] A book that cannot be dated — listed, never suppressed. The section must not hide what it
      failed to read.
- [x] A qualifier word appearing in prose rather than in the marker's parenthetical
      (`_intake.md:1847`), which a naive keyword sniff misclassifies.
- [x] An OPEN entry carrying `###` blocks — no warning, because the entry itself is listed.
- [ ] An `_intake.md` with no entries at all: covered indirectly (every fixture repo that omits
      `intake` runs the scanner against a missing file and must still exit 0).

## Test infrastructure

- Test framework: the repo's gate (`npm test` → `test/registry.js` → `test/helpers/gateRunner.js`).
  Read a run with `npm run gate:status`.
- No live stack needed: every test here runs `scripts/whats-open.sh` or
  `scripts/session-start.sh` in a throwaway git repo, offline (a `gh` stub that exits 1 shadows
  the real one; a fixture has no `origin`, so `git fetch` fails as fast). Nothing leaves the machine.
- Three tests read this repo's own `OPEN.md` and `_intake.md` — they are the oracles for the two
  defects that are live rather than latent, and each carries a message saying what to do if the
  real file has legitimately moved on.
- Fixtures: `test/helpers/rollupFixtures.js` — `makeRepo({ open, intake, books, ledger })` plus
  the runners and section extractors. `test/session-start.test.js` now imports its `rollup` and
  `digest` from there instead of keeping its own copies: two copies of a rule is the mechanism
  ADR 0001 is about, and the test tree should not model the thing the story is fixing.
- Registered at `test/registry.js:156`, after `ledger-row-ids.test.js`.

## How to run

```
npm test
```

One suite on its own, through its `run()` export:

```
node -e "require('./test/rollup-scanners.test.js').run().then(r=>console.log(JSON.stringify(r)))"
```

## Verification

The new tests fail with the current code. Confirmed on 2026-09-20 at `b42a18b2`:

```
RED BASELINE: {"pass":3,"fail":30}
  ✗ AC-1 a cut that lands inside a multi-byte character yields valid UTF-8, not a half character
      scripts/lib/utf8-trim.sh did not load or utf8_trim failed: No such file or directory
  ✗ AC-2 on this repo's real OPEN.md, no line of META_LINES is invalid UTF-8 (row 193 …)
      1 line(s) of the meta list are invalid UTF-8
  ✗ AC-4 an open book prints its opened date and a real age, on a `date` that rejects -d
      got: ["  ancient-book"]
  ✗ AC-6 … a `— Meta:` entry marked **NOT PICKED UP** is counted by the digest
      got "meta inbox: 0 open (clear)"
  ✗ AC-12 the section lists at most WHATS_OPEN_CARRY_BOOKS books and says what it suppressed
      it listed 12
  … 25 more
```

The three that pass before implementation are all negative assertions — "an undated book is not
suppressed", "a clean entry raises no warning", "no age is invented" — which hold vacuously while
the behaviour they guard does not exist yet. They are kept because they will not hold vacuously
after the change; the env-override test was rewritten mid-plan for exactly this reason, so that it
compares a default run against a widened one rather than asserting a count an uncapped section
also satisfies.

`test/session-start.test.js` was re-run after its runners moved: 32 pass, 0 fail.
