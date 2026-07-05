# Test Plan: Story 7 — session-start-restructure

**Story:** `engineering-team/stories/harness-self-improvement/7-session-start-restructure.md`
**ADR:** `engineering-team/decisions/harness-self-improvement/0007-session-start-restructure.md`
**Date:** 2026-07-04

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-4 budget rule: over-cap → violation quoting count + cap + rule source; **exactly at cap → clean** (gate decision 1: no headroom) | `L11: a file over its line budget is a violation naming the cap; a file exactly at its cap is not` | `test/harness-lint.test.js` | fixture-integration |
| AC-5 missing budgets file degrades to INFO, exit 0 (L10's semantics) | `L11 reports INFO and skips when the budgets data file is missing` | 〃 | fixture-integration |
| AC-4/AC-7 the real repo actually declares both caps and holds them | `the real repo declares budgets for CLAUDE.md and AGENTS.md, and both hold` (reads the budgets rows, recomputes `wc -l` in JS, asserts ≤ cap) | 〃 | repo-integration |
| AC-4 caps hold post-restructure at lint level | existing `the real repo lints clean` (now includes L11 over the real budgets file) | 〃 | repo-integration |
| AC-1 pointer table replaces both CLAUDE.md blocks; invariants + TA rule untouched; ≤191 lines | reviewer inspection (before/after diff) + the real-repo budget test pins the ceiling mechanically | Review + suite | mixed |
| AC-2 AGENTS.md ladder (probe → firmware/*.json → BIBLE §5–§9), scoped don't-load-BIBLE rule, unavailable-list, ~15-line card; story-6 digest pointer resolves | reviewer inspection (the digest's "§1–§2" string checked against the restructured section numbering) | Review | reviewer-run |
| AC-3 onboarding path in README (in place) + `docs/QUICKSTART.md:32` dead checkout removed | reviewer inspection (grep: no `checkout concept-graph` anywhere; README carries the 4-step path) | Review | reviewer-run |
| AC-6 no silent deletion | reviewer audits the before/after accounting in the review file | Review | reviewer-run |
| AC-7 def-paths registration (budgets file) + CHANGELOG + lint clean | reviewer inspection + `harness-lint.sh` (L10 + L11 + self-listing) | Review + lint | mixed |

## Edge cases

- [x] **Exactly-at-cap is clean** — pinned in the violation test's same fixture (AGENTS.md at cap 1): the boundary is `>`, not `>=`. Exact caps with no headroom are the ratified semantics; an off-by-one here would make every future budget-neutral edit a false violation.
- [x] **The shared `cleanFiles()` fixture is untouched** (no budgets file added), so all 25 pre-existing lint tests run unmodified — and every one of them now doubles as the missing-budgets INFO path, exit 0. Zero risk of fixture-coupling regressions.
- [x] **Message contract**: the violation must name the measured count, the cap, and point at `scripts/harness-budgets.txt` (where the R-S4 rule prose lives) — a bare "too long" tells a future session nothing about how to fix it.
- [x] **Real-repo loop closed from two directions**: the budget test recomputes line counts in JS (independent of the lint implementation), and the existing real-repo-clean test runs the lint's own L11 over the same file — a disagreement between the two implicates the parser, not the docs.
- [ ] Waivability of L11 — inherited from the generic `violation()` waiver machinery (already covered by the story-1 waiver tests); not separately fixture-tested.
- [ ] Tab-vs-space tolerance in budgets rows — the format is tab-separated like the waiver file; malformed rows are the implementer's parse-or-skip call, covered by the always-exit-0 discipline rather than a dedicated fixture.

## Test infrastructure

- Extends the existing `test/harness-lint.test.js` (registered in `test/test.js` since story 1 — no registration change). Same fixture machinery (`withClean`, `makeFixture`), no stack, no network.

## How to run

```
npm test
```

Standalone: `node -e "require('./test/harness-lint.test.js').run().then(r=>process.exit(r.fail?1:0))"`

## Verification

The new tests fail with the current code. Confirmed 2026-07-04 at commit `f196d966` (pre-implementation): the two fixture tests fail because the lint has no L11 (runs report `harness-lint: clean (0 violations)` where a violation/INFO line is expected); the real-repo test fails with `ENOENT … scripts/harness-budgets.txt` (the file is the feature). The 25 pre-existing lint tests pass unmodified:

```
  ✗ L11: a file over its line budget is a violation naming the cap; a file exactly at its cap is not
      harness-lint: clean (0 violations)
  ✗ L11 reports INFO and skips when the budgets data file is missing
      harness-lint: clean (0 violations)
  ✗ the real repo declares budgets for CLAUDE.md and AGENTS.md, and both hold
      ENOENT: no such file or directory, open '.../scripts/harness-budgets.txt'
suite: 25 passed, 3 failed
```
