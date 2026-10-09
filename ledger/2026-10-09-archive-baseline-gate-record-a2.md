# A git-archive staging baseline always fails gate-result-record A2, which reads like a regression

**Id:** 2026-10-09-archive-baseline-gate-record-a2
**Type:** meta
**Opened:** 2026-10-09 (assistant-trusted-content-status #1, review)
**Status:** OPEN
**Done:** —

The way sessions compare a branch's gate with staging is to export staging with `git archive origin/staging | tar -x`
into a scratch directory and run `npm test` there (the parallel-session memory recommends it, and worktrees can't
`git stash`). That export has no `.git`, so `test/gate-result-record.test.js` A2, which reads HEAD, always fails on
the baseline and passes on the branch. The run record also says "on an unknown commit". A reviewer can misread this as
the branch fixing something, or the baseline breaking.

Fix shape: one line wherever the baseline recipe is written down (engineering-team/README.md § Running and reading the
test gate, or the reviewer role) naming A2 as an expected baseline-only failure. Or let A2 skip, with a reason, when no
`.git` is present.

**Pointer:** `engineering-team/reviews/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md` § Harness friction 3
