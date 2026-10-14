# The harness-lint suite's large-commit fixture races git's background maintenance on CI's git 2.55, and fails with ENOTEMPTY

**Id:** 2026-10-14-harness-lint-fixture-maintenance-race
**Type:** meta
**Opened:** 2026-10-14 (PR #862, the promotion of `assistant-self-map` #4)
**Status:** DONE
**Done:** 2026-10-14 — PR #862. `stack-free` passed on git 2.55 with the fix (run 38504998775, head `58864ef9`); merged as `a01fa93d`.

**What was seen.** `stack-free` failed twice on PR #862: the first run and one re-run. Each time it was one test in
`test/harness-lint.test.js`, "L10: a large harness commit that touched the CHANGELOG is satisfied", with
`ENOTEMPTY: directory not empty, rmdir '/tmp/harness-lint-…/.git'` from the test's `fs.rmSync` cleanup. The verdict
itself was fine. The owner read the line from the job log. The session's log tools return only the last 5,000 lines,
and the raw-log host is outside its network policy. PR #861 passed the same check two hours earlier, on the same git
2.55.

**Cause.** That test commits about 2,000 files into a fixture repo, lints it, and removes it. CI's git (2.55) starts
automatic maintenance, detached, after a commit that large. That maintenance is still packing inside `.git` when the
test removes the directory. The session's git (2.43) doesn't start it at the default thresholds. With `gc.auto=50`
forced on here, a 2,000-file commit does get packed in the background, which shows the mechanism. So the test passed
85/0 here on the exact merge commit and failed only in CI, with timing deciding (#861 won the race).

**Fix.** Each fixture repo the suite creates sets `gc.auto 0` and `maintenance.auto false` right after `git init`
(`NO_AUTO_MAINTENANCE` in `makeFixture`, `commitAt` and `shallowCopyOfRepo`). Both settings exist in git 2.43 and
2.55. The suite passes 85/0 here, both at the defaults and with background gc forced on. It closes when a CI run on
git 2.55 passes with the fix.

**Pointer:** PR #862's comments; `test/harness-lint.test.js` (`NO_AUTO_MAINTENANCE`).
