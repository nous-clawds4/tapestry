# Test Plan: Story 1 — harness-lint

**Story:** `engineering-team/stories/harness-self-improvement/1-harness-lint.md`
**ADR:** `engineering-team/decisions/harness-self-improvement/0001-harness-lint.md`
**Date:** 2026-07-02

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 L1 (status-flip) | `L1: a PASS-final review whose story is not Done is a violation` (+ the two last-verdict-wins tests) | `test/harness-lint.test.js` | fixture-integration |
| AC-1 L2 (epic-retirement) | `L2: a Closed book listing an epic that is not Done is a violation` | 〃 | 〃 |
| AC-1 L3 (epic-umbrella) | `L3: an active story folder without an epic umbrella file is a violation` | 〃 | 〃 |
| AC-1 L4 (review-has-story) | `L4: a numbered review with no matching story is a violation (and not double-reported as L1)` + `a non-numbered review is INFO…` | 〃 | 〃 |
| AC-1 L5 (no-hardcoded-port) | `L5: a hardcoded localhost port…` + `L5 catches any literal port…` (clean fixture proves `$TAPESTRY_PORT` unflagged) | 〃 | 〃 |
| AC-1 L6 (no-machine-paths) | `L6: a machine-local absolute path in a wiring file is a violation` | 〃 | 〃 |
| AC-1 L7 (verdict-enum) | `L7: a verdict-bearing file offering FAIL as a verdict is a violation` | 〃 | 〃 |
| AC-1 L8 (dead-links) | `L8: a dead relative link in an orientation/wiring file is a violation` | 〃 | 〃 |
| AC-1 L9 (stale-headers) | `L9: a Last-updated header more than 14 days behind git history is a violation` + `L9 is skipped silently when the tree has no git history` | 〃 | 〃 |
| AC-2 (exit codes + clean summary) | `a fully consistent tree lints clean…` (asserted implicitly in every violation test via exit 1) | 〃 | 〃 |
| AC-3 (waivers) | `a waiver suppresses its violation visibly…` + `a waiver that matches nothing is flagged STALE-WAIVER…` | 〃 | 〃 |
| AC-4 (whats-open wiring) | verified at Review by running `bash scripts/whats-open.sh` and checking the "Harness invariants" section — a report-shape assertion, deliberately not unit-tested (whats-open has no suite; precedent) | manual/Review | reviewer-run |
| AC-5 (npm test integration) | suite registered in `test/test.js` (require + banner + summary + overall conjunction) — proven by the run below | `test/test.js` | integration |
| AC-6 (no network/stack/deps) | `the script needs no network or stack: it succeeds with no env beyond PATH/HOME` (spawned with a stripped env) | `test/harness-lint.test.js` | fixture-integration |
| Repo is lint-clean at close | `the real repo lints clean (violations fixed or waived with citations)` | 〃 | repo-integration |

## Edge cases

- [x] Verdict ordering both directions (PASS→CHANGES_REQUESTED final = no L1; CHANGES_REQUESTED→PASS final = L1) — the operator-ratified last-verdict-wins rule.
- [x] L4/L1 interplay: a missing story fires L4 only, never both.
- [x] Non-numbered reviews: INFO, exit-neutral (two such files exist in the real repo).
- [x] Fixture without git history: L9 skips silently (ADR fixture-tolerance requirement).
- [x] Missing waiver file: tolerated (clean fixture has none).
- [x] Stale waiver: visible, non-fatal.
- [ ] Concept Graph API unavailable — n/a by design: the script never touches the network or stack (AC-6 asserts this).
- [ ] Concurrent runs — n/a: read-only over the tree; no locks, no writes.

## Test infrastructure

- Node built-in runner via the repo's `test/test.js` harness (suite exports `run() → {pass, fail}`, registered in the require block, run block, summary block, and overall conjunction — the established convention).
- Fixtures: per-test temp trees under `os.tmpdir()`, seeded from a minimal all-invariants-satisfied base (`cleanFiles()`), each `git init`-ed and committed so L9 can consult history. No shared state between tests.
- Concept Graph API: **not required** (port per AGENTS.md §1 — this suite is stack-free by story AC-6).
- Firmware state: none.

## How to run

```
npm test
```

Standalone (faster while iterating):
```
node -e "require('./test/harness-lint.test.js').run().then(r=>process.exit(r.fail?1:0))"
```

## Verification

The new tests fail with the current code. Confirmed 2026-07-02 at commit `f82fbbf0` (pre-implementation): all 19 tests fail because `scripts/harness-lint.sh` does not exist — the feature itself — not from a typo or import error:

```
  ✗ a fully consistent tree lints clean: exit 0 and a clean summary line
      bash: /home/user/tapestry/scripts/harness-lint.sh: No such file or directory
  ✗ L1: a PASS-final review whose story is not Done is a violation
      bash: /home/user/tapestry/scripts/harness-lint.sh: No such file or directory
  … (same for L1×2 more, L2, L3, L4, INFO, L5×2, L6, L7, L8, L9×2, waiver×2, no-env)
  ✗ the real repo lints clean (violations fixed or waived with citations)
      real repo not lint-clean:
harness-lint suite: FAIL (0 passed, 19 failed)
```
