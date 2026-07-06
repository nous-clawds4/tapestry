# Test Plan: Story 2 — `npm test` is honest without the stack

**Story:** `engineering-team/stories/test-hermeticity-ci/2-stack-free-npm-test.md`
**ADR:** — (Architecture skipped per the ratified book plan; the design precedent is the in-repo `*-publish` guard: `test/most-pinned-tag-index-publish.test.js:48–53`)
**Date:** 2026-07-06

## Coverage map

New suite `test/stack-free-npm-test.test.js` (registered at test.js's four anchors), house style. These are tests *about* test infrastructure, so levels were chosen deliberately:

- **Behavioral, via child processes:** every target suite already reads `process.env.BRAINSTORM_BASE_URL` (default `:7778`), so spawning it with the env pointed at a dead port (`127.0.0.1:9`, instant refusal) simulates stack absence *even on machines where the real stack is up* — no mutation of the shared local stack, no new plumbing.
- **Source contracts on `test/test.js`** for summary/exit shape — running the full aggregator from inside itself would recurse.

| Criterion | Test | Level | Fails now because |
|---|---|---|---|
| AC-1 (exit 0, visible counted skips) | `G1` — all 12 suites spawned dead-port: `fail===0`, `skipped>=1`, a visible SKIP line; + the full-run procedural check below | behavioral (child) | all 12 fail 2–11 tests each with `fetch failed` |
| AC-2 (no coverage lost when stack present) | `G2` — tag-detail spawned against the live panel must *run* (`pass+fail>=1`, no `skipped`); self-skips honestly when no stack. The other 11 are covered by the Reviewer's diff audit (guard-only changes) | behavioral (child) + review | **passes pre-impl by design** — regression guard against over-guarding |
| AC-3 (SKIP not PASS per suite; aggregate total) | `G3` — each of the 12 result vars' `.skipped` consulted in its summary line; a `Total skipped:` aggregate line exists (the pinned output token) | source contract | none of the 12 lines consult `.skipped`; no aggregate line |
| AC-4 (bounded probe, no stalls) | `G1`'s 20s per-suite wall-clock budget + `G4` — each of the 12 carries `AbortSignal.timeout(≤5000)` and a reachability-guard function | behavioral + source | no probe exists in any of the 12 |
| AC-5 (skips never mask failures) | `G5` — all 12 `.fail === 0` terms present in the `overallOk` chain; the chain never consults `.skipped`; `process.exit(overallOk ? 0 : 1)` intact | source contract | **passes pre-impl by design** — standing regression guard |

## Edge cases

- [x] **Half-alive stack:** out of scope by story — the guard distinguishes absent from present only; G2 asserts the present side, G1 the absent side. Nothing asserts (or hides) behavior between.
- [x] **Self-referential honesty:** G2 itself uses the same probe pattern and skips visibly when the stack is down — so this suite is CI-safe (stack-free CI: G2 skips, G1/G3/G4/G5 run).
- [x] **No recursion:** children require suite modules directly, never `test/test.js`.
- [x] **`tl-publication-from-pins`'s `docker exec` path** ignores the env override, but post-implementation the guard skips the suite before any exec runs; pre-implementation it exercises the local container exactly as `npm test` already does.

## Test infrastructure

- Framework: existing Node runner; suite-local `spawnSync` children with a `___SUITE_RESULT___` marker line, per-test `skip()` (story-1 pattern).
- Registered in `test/test.js`: require + run + summary line (mixed-suite style, `, N skipped` when G2 self-skips) + `overallOk` term.
- Stack: **not required** (G2 self-skips without it; everything else is dead-port or source-level). With the stack up, G2 additionally verifies live coverage retention.
- The dead-port simulation is also the **full-run procedural check** (below) — usable even on machines where the stack is up.

## How to run

```
node -e "require('./test/stack-free-npm-test.test.js').run().then(r=>console.log(JSON.stringify(r)))"   # this suite alone
npm test                                                                                                 # full aggregate
```

**AC-1 full-run procedural verification (run at Implementation and again at Review — works with the local stack up):**

```
BRAINSTORM_BASE_URL=http://127.0.0.1:9 npm test; echo "exit: $?"
```

Expected **post-implementation**: exit 0; the 12 target suites and the 12 `*-publish` suites all render `SKIP (…)` lines in the summary; a `Total skipped:` line carries the aggregate; no `fetch failed` anywhere. (G2 self-skips inside that run — by design. The three known harness-suite failures — BSD-date ×2, hook file — are story 3's scope and on macOS will keep this exit at 1 until story 3 lands; on that machine class, assert instead: zero `fetch failed`, all 24 live suites SKIP, and the only FAIL lines are the three story-3 suites.)

## Verification

The new tests fail with the current code, for the right reasons (itemized offender lists, no import errors). Confirmed 2026-07-06 at commit `b916d35e`, suite alone: `{"pass":2,"fail":3}`:

```
✗ G1 — offenders: all 12, e.g. "profile-tags: 8 test failure(s) against an unreachable panel — must
      whole-suite SKIP, not fail with 'fetch failed'" (per-suite failure counts 2–11)
✓ G2 — tag-detail ran live against the reachable panel (regression guard, green by design)
✗ G3 — offenders: all 12 summary lines never consult <var>.skipped + "no aggregate `Total skipped:` line"
✗ G4 — offenders: all 12 "no AbortSignal.timeout(...) bounded probe found"
✓ G5 — exit-strictness chain intact (regression guard, green by design)
```
