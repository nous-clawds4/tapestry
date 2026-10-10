# Test Plan: Story 3 — The lint's history checks tell the truth in a shallow clone

**Story:** `engineering-team/stories/harness-gate-integrity/3-history-checks-honest-in-a-shallow-clone.md`
**ADR:** none. Under Standard strictness, a bug with an obvious fix skips Architecture. The checks extend
`harness-self-improvement/0001`'s invariant set.
**Date:** 2026-10-09

## Coverage map
Every test is in `test/harness-lint.test.js`, section "shallow clones (harness-gate-integrity #3)". Each one runs
`scripts/harness-lint.sh` against a git fixture in a temp dir, a shallow clone of one, or a shallow clone of this
repo, and reads the printed lines and exit status. All tests are at the integration level.

| Criterion | Test name | Red before the fix? |
|---|---|---|
| AC1 | `L10 in a shallow clone: a boundary commit is not read as a harness change — no violation, and an INFO line names L10, the commit, the shallow history and \`git fetch --unshallow\`` | yes: no INFO line |
| AC1 | `L10 in a shallow clone deeper than one commit: the boundary below HEAD is not read as a harness change either` | yes: no INFO line |
| AC1 | `L10 in a linked worktree of a shallow clone: the boundary is still recognised (the shallow list lives in the shared git dir)` | no (guard; added at Review for finding N4, red when the shallow file is read as a literal `.git/shallow`) |
| AC2 | `L10 in a shallow clone still catches a real violation: a harness change inside the fetched history without a CHANGELOG row is reported, naming that commit` | no (guard) |
| AC2 | existing `L10: the latest commit touching a def path without touching the CHANGELOG is a violation` and `L10 is quiet when the same commit touches both the def path and the CHANGELOG` (full clone, unchanged) | no (regression) |
| AC3 | `L10: a large harness commit that touched the CHANGELOG is satisfied — the check reads the whole file list, not just up to the first match` | yes: false `VIOLATION L10` |
| AC4 | `L9 in a shallow clone: a header checked against the boundary commit is not called stale — INFO says it could not be checked` | yes: false `VIOLATION L9` (2472d) |
| AC4 | `L9 in a shallow clone still catches a stale header when the file's last change is inside the fetched history` | no (guard) |
| AC4 | existing `L9: a Last-updated header more than 14 days behind git history is a violation` (full clone, unchanged) | no (regression) |
| AC5 | `the real repo lints clean from a shallow clone, 50 commits deep and 1 commit deep (the cloud-session case)` | yes: false `VIOLATION L10 commit:36e2596` at depth 1 |

Why the two AC1 tests fail only on the missing INFO line: in a small fixture, the boundary's file list is short.
The boundary appears to add every file, the CHANGELOG included, so today's check passes it by accident. In the real
repo the list runs to ~3,800 names, and the AC3 failure (the check stops reading at the first match, and the script's
strict pipe settings count that as a failure) turns the same accident into the false violation the ledger row records.
AC5 covers that end-to-end case. Its depth-1 red names `36e2596`, this story's own Planning commit, which *did* touch
the CHANGELOG. That shows why adding a CHANGELOG row never fixes a shallow clone.

## Edge cases
- [x] **Narrow skip, not a blanket one.** A shallow clone does not excuse a commit whose parent it holds (the AC2 guard
      test for L10 and the second AC4 test for L9). An implementation that skips L9/L10 whenever the repo is shallow
      fails both.
- [x] **Shallow means shallow.** `L10 never says "shallow" about a full clone`: a full clone's first commit has no
      parents either, but its history is complete. An implementation that tests "has no parents" instead of "is a
      shallow boundary" would say something false. (Guard, green before the fix.)
- [x] **The boundary below HEAD.** The depth-2 AC1 test makes the boundary differ from HEAD, the depth-50 cloud case.
- [x] **Depth 1 at a merge commit.** In CI, the AC5 test's HEAD is the PR's merge commit. Once it is the boundary it has
      no visible parents, so `--no-merges` keeps it. AC5's depth-1 view covers this when CI runs the suite.
- [ ] Not covered: other git-history readers (`/whats-open`, `scripts/harness-stats.sh`), which the story leaves out
      of scope.

## Test infrastructure
- Test framework: Node built-in runner via `test/harness-lint.test.js`'s own `run()`, registered in the gate as
  suite `harness-lint`. A run's result is read per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
- Concept Graph API: not used. No stack, no network: every clone is `file://` from a local path.
- Firmware state: none.
- Fixtures: temp dirs under `os.tmpdir()`.
  - New helpers in the section: `commitAt` (a dated commit; L9 compares author dates), `shallowClone`
    (`git clone --depth N file://…`, because a plain local path ignores `--depth`), `infoLine`, `headSha` and
    `shallowCopyOfRepo` (`git fetch --depth=50 file://<git-common-dir> <HEAD>`, so it works from a worktree too).
  - The AC5 test gets its depth-1 view by rewriting `.git/shallow` to list only HEAD. That is the file git reads to
    find boundary commits, so one fetch serves both depths. It removes its clone afterwards, and the AC3 test removes its ~16 MB fixture (review finding N5); the small fixtures follow
    the file's existing convention and are left in the temp dir.
  - Needs git ≥ 2.31 (`rev-parse --path-format=absolute`).
- Cost: the section adds ~15 s to the suite, almost all in AC5 (two full-tree lint runs at ~4 s each, plus one fetch
  and checkout). The AC3 fixture commits 2,000 files (~1.7 s); the worktree guard adds ~0.7 s.

## How to run

```
node -e "require('./test/harness-lint.test.js').run().then(r => console.log(r))"
```

or the whole gate (`npm test`, then `npm run gate:status`).

## Verification
The new tests fail with the current code. Confirmed on 2026-10-09 at commit `36e25963` (macOS; `bash` on PATH is
`/bin/bash` 3.2.57; git 2.50.1), suite run directly:

```
  ✗ L10 in a shallow clone: a boundary commit is not read as a harness change — no violation, and an INFO line names L10, the commit, the shallow history and `git fetch --unshallow`
      expected an INFO line naming L10 — the lint must say it could not judge, not stay silent
  ✗ L10 in a shallow clone deeper than one commit: the boundary below HEAD is not read as a harness change either
      expected an INFO line naming L10 and the boundary 82836e7 (HEAD is not the boundary here)
  ✗ L10: a large harness commit that touched the CHANGELOG is satisfied — the check reads the whole file list, not just up to the first match
      VIOLATION L10 commit:e7123a5 — latest harness-definition commit (large harness change with changelog row…) did not touch engineering-team/CHANGELOG.md
  ✗ L9 in a shallow clone: a header checked against the boundary commit is not called stale — INFO says it could not be checked
      VIOLATION L9 BIBLE.md — 'Last updated: 2020-01-01' lags the last git change (2026-10-09) by 2472d (>14)
  ✗ the real repo lints clean from a shallow clone, 50 commits deep and 1 commit deep (the cloud-session case)
      real repo not lint-clean from a depth-1 clone:
      VIOLATION L10 commit:36e2596 — latest harness-definition commit (story: history-checks-honest-in-a-shallow-clone (harness-gat…) did not touch engineering-team/CHANGELOG.md
{"pass":79,"fail":5}
```

The 79 passes are the 76 tests that were there before, plus the three new guards (L10 still catches a real violation
in a shallow clone, L10 never says "shallow" about a full clone, and L9 still catches a stale header inside the
fetched history).
