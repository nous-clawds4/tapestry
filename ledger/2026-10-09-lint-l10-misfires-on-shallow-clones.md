# harness-lint L10 reports a false violation when much of the chosen commit's file list follows the CHANGELOG line, as at a shallow clone's boundary

**Id:** 2026-10-09-lint-l10-misfires-on-shallow-clones
**Type:** meta
**Opened:** 2026-10-09 (worksheet W25/W2 session; diagnosis corrected 2026-10-10 after review)
**Status:** OPEN
**Done:** —

`check_L10` (`scripts/harness-lint.sh:264-267`) picks the latest commit touching a harness-definition path, then pipes
`git show --name-only --format= <commit>` into `grep -qx engineering-team/CHANGELOG.md`. The script runs under
`set -uo pipefail` (line 52). `grep -q` exits at its first match; when more than about a pipe buffer (64 KiB) of the
list follows the CHANGELOG line, `git` can still be writing, dies of SIGPIPE, and the pipeline returns 141. That takes
the `|| violation` branch, so L10 reports a missing CHANGELOG row even when the commit's file list contains it.

Seen at session start on 2026-10-09: `VIOLATION L10 commit:695fac4` ("docs(protocols): add the Opinionated Views
pre-NIP and worksheet W25"). Cloud sessions start from a shallow clone (depth 50), and 695fac4 is a shallow boundary
(listed in `.git/shallow`; `git rev-list --parents -n1 695fac4` prints no parent). git therefore diffs it against the
empty tree, so every file in the repo looks touched: 3,816 paths, 209,255 bytes, with `engineering-team/CHANGELOG.md`
on line 172 and about 204 KB after it. Reproduced 2026-10-09, three runs out of three: with `set -o pipefail`, the pipeline exits 141 with
`grep -qx` and 0 with `grep -x … >/dev/null`.

Two consequences:

- **Not specific to shallow clones.** Any real harness-definition commit with more than about 64 KiB of its file
  list after the CHANGELOG line (a mass rename, say) can misfire the same way; near that size it depends on timing.
  A long list whose CHANGELOG entry sorts near the end does not.
- **A boundary commit says nothing about L10.** Its real change is unknown. If only the SIGPIPE is fixed, a boundary
  commit will falsely *pass* L10 instead of falsely failing.

The "pre-existing L10 violation on commit a04f95a" noted in OPEN.md row `2026-10-04-llms-txt-egress-403-false-fail`
may be the same misfire. Not checked.

**Fix shape.** Both halves:

1. Remove the early-exit pipe: test whether `git show --name-only --format= "$latest" -- "$CHANGELOG"` prints
   anything, or drop `-q` and send grep's output to `/dev/null`.
2. When `git rev-parse --is-shallow-repository` is `true` and the chosen commit is listed in `.git/shallow`, print an
   INFO line ("shallow boundary; L10 can't tell what it changed — fetch more history") instead of a verdict.
   Alternatively, deepen until the commit has a parent (`git fetch --deepen`) before checking.

**Pointer:** `scripts/harness-lint.sh` (`check_L10`, and `set -uo pipefail` at line 52); `.git/shallow`.
