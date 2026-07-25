# Test Plan: Story 1 — Gate-integrity & lint robustness

**Story:** `engineering-team/stories/harness-gate-integrity/1-gate-integrity-and-lint-robustness.md`
**ADR:** `engineering-team/decisions/harness-gate-integrity/0001-gate-integrity-and-lint-robustness.md`
**Date:** 2026-07-25

## Coverage map

| Criterion | Test name | Test file | Level | State now |
|---|---|---|---|---|
| AC1 (gate re-attach, #43) | `G6 (…AC1): the exit gate fails on ANY suite failure — evaluating test.js's real overallOk expression with one suite failed yields false, for a re-attached AND a never-wired suite` | `test/stack-free-npm-test.test.js` | source-behavioral | **RED** |
| AC2 (anti-recurrence, #43) | `G5 (…AC-5 + …AC2): … every registered suite gates — each result has \`.fail === 0\` INSIDE the overallOk expression (chain[1], not the whole file) …` | `test/stack-free-npm-test.test.js` | source-contract | **RED** |
| AC3 (summary honesty, #58) | `G7 (…AC3): no per-suite summary line masks a real failure — every summary ternary guards on (pass+fail)===0, never on \`.skipped\` alone` | `test/stack-free-npm-test.test.js` | source-contract | **RED** |
| AC4 (ADR-`Consequences` invariant, #46) | `L13: an active ADR missing the template-required ## Consequences section is a violation` | `test/harness-lint.test.js` | fixture (synthetic tree) | **RED** |
| AC4 scope (active-only) | `L13 scope A (active-only): an active ADR WITH ## Consequences is clean, and a retired ADR under decisions/done/ WITHOUT it does NOT fire` | `test/harness-lint.test.js` | fixture | boundary guard (green pre- & post-) |
| AC5 (CI-ordering robustness, #22) | `W5b (#22): the ci-before-test ordering is scoped to the steps: region — a comment above steps: does not false-fail, and a genuine gate-before-install still fails` | `test/ci-test-job.test.js` | unit (helper) | **GREEN — co-authored (see note)** |
| AC6 (empty-tree robustness, #21) | `L8/#21: check_L8 does not crash on a tree with zero wiring/link-doc files under bash 3.2` | `test/harness-lint.test.js` | fixture (bash 3.2) | **RED** |
| AC7 (no regression, cadence) | full-harness run at Review (Overall PASS / exit 0) + this plan's Verification | `node test/test.js` | integration | at Review |

**AC1 mechanism (no recursion).** `test.js` cannot run itself (the aggregator would recurse — see this suite's header). G6 instead reads `test.js` source, extracts the **real** `overallOk` expression, and evaluates it with a synthetic result set (all suites pass except a planted one) via `new Function`. It proves both a **re-attached** suite (`harnessLintResult`) and a **never-wired** suite (`noteTrustedListResult`) flip `overallOk` to `false`. No 24-minute run, no recursion; it exercises the actual expression, not a copy.

**AC5/#22 is the ADR's co-authored exception.** The artifact under repair *is* a test-suite assertion, so there is no separate production surface for the Implementer. The fix (extract `ciBeforeTest()`, scope the ordering `indexOf` to the `steps:` region) and its proof (W5b) are authored together here and land **GREEN**. That the guard is real (not vacuous) is demonstrated in Verification: the old whole-file logic false-fails on a pre-`steps:` comment; the scoped logic does not, and still catches a genuine gate-before-install mis-ordering.

## The chain-extraction subtlety (found during test design — informs the Implementer)

The `overallOk` chain contains `//` comments carrying a literal `;` (e.g. `// (LIVE chain — before the terminator; the block below is severed …)` at ~`test.js:1017`). A naive `/const overallOk =([\s\S]*?);/` truncates at that comment's semicolon, not the code terminator — which would make G5 report 27 false-orphans and G6's `new Function` throw on a dangling `&&`. G5/G6 therefore strip `//` comments **before** capturing (`overallOkExpr()` helper). With that, G5 reports exactly the **9** real orphans (7 dead-block + 2 never-wired), matching the investigation. *Implementer note:* when you change the stray `;` (~`test.js:1066`) to ` &&`, the now-stale "…before the severed terminator…" comments should be corrected/removed, but the tests do not depend on that.

## Edge cases

- [x] A **never-wired** suite (not just a dead-block one) — G5 + G6 both plant `noteTrustedListResult`/`applicabilityRepublishResult`, the two the `;`→`&&` fix alone cannot recover.
- [x] The **bare `configOk` term** (line 896, not a `*Result`) — G6 binds every free identifier, so the evaluator doesn't ReferenceError.
- [x] A **purely-skipped** suite must still print SKIP — the good-form the AC3 contract requires (14 sibling lines already prove the shape; G7 only forbids the bad head).
- [x] `done/`-tree ADRs must **not** fire L13 (scope A) — the L13-scope test seeds a `decisions/done/…` ADR without `## Consequences` and asserts no violation.
- [x] The **real repo stays lint-clean** post-change — `harness-lint.test.js`'s existing real-repo test guards it; the L13 offender backfill (Implementer) is what keeps it green once L13 lands.
- [x] **bash ≥ 4.4** (Linux CI): the #21 crash cannot reproduce, so L8/#21 skips-with-note (vacuous pass) rather than false-negative.

## Test infrastructure

- Runner: Node built-in (`node test/test.js`), suites are plain modules exporting `run()`. No new framework (JS-without-build honored).
- No stack / no network required for the new assertions (source-contract + synthetic fixtures). `stack-free-npm-test.test.js` G1/G2 still exercise the live panel when present; unrelated to this story.
- `L8/#21` shells `/bin/bash` (system bash 3.2.57 on macOS reproduces the crash; guarded off on bash ≥ 4.4).
- Fixtures: synthetic trees via `makeFixture`/`withClean` in `harness-lint.test.js`; inline workflow strings in `ci-test-job.test.js`.
- Firmware state: none.

## How to run

```
node test/test.js
```

Per-suite (used for RED verification — the three target suites are themselves orphaned by #43, so `npm test` Overall does not flip until the Implementer re-attaches them):

```
node -e "require('./test/stack-free-npm-test.test.js').run().then(r=>console.log(JSON.stringify(r)))"
node -e "require('./test/harness-lint.test.js').run().then(r=>console.log(JSON.stringify(r)))"
node -e "require('./test/ci-test-job.test.js').run().then(r=>console.log(JSON.stringify(r)))"
```

## Verification

Confirmed RED for the right reasons on 2026-07-25, `feat/harness-gate-integrity` (post-ADR commit `8576fb74`):

```
stack-free-npm-test:  G5 ✗ (9 orphans: noteTrustedList, applicabilityRepublish, harnessLint, harnessStats,
                          sessionStart, stackFreeNpmTest, ciTestJob, syncPanelTagFilters, routerStreamTagFilters)
                      G6 ✗ (harnessLintResult / noteTrustedListResult failing do NOT flip overallOk)
                      G7 ✗ (24 of 38 summary lines branch on .skipped alone)   => {"pass":4,"fail":3}
harness-lint:         L13 ✗ (no ## Consequences rule yet — synthetic offender not flagged)
                      L8/#21 ✗ (check_L8 crashed under bash 3.2.57: `files[@]: unbound variable`)
                      "real repo lints clean" ✓ (unchanged)                     => {"pass":30,"fail":2}
ci-test-job:          all ✓ incl W5 + W5b (#22 co-authored)                      => {"pass":14,"fail":0}
```

Post-fix satisfiability confirmed by simulating the Implementer's #43 (`;`→` &&` + insert the 2 never-wired terms) and #58 (rewrite the 24 heads) in-memory: **G5 orphans → 0 (GREEN); G6 all-pass=true, planted-fail=false (GREEN); G7 bad-form → 0 (GREEN)**. L13 goes green once `check_L13` flags the offender; L8/#21 once the length-guard lands.
