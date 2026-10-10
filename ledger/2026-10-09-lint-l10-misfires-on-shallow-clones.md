# harness-lint L10 reports a false violation in a shallow clone when the latest harness-definition commit is a shallow boundary

**Id:** 2026-10-09-lint-l10-misfires-on-shallow-clones
**Type:** meta
**Opened:** 2026-10-09 (worksheet W25/W2 session)
**Status:** DONE
**Done:** 2026-10-09 (story `harness-gate-integrity` #3) — a duplicate of OPEN.md row `2026-10-07-shallow-clone-trips-lint-l10`, closed with it: L10 prints INFO for a shallow boundary, as the fix shape here proposed. The `a04f95a` question is answered: yes, the same misfire (a merge commit at a shallow boundary has no visible parents, so `--no-merges` keeps it). Review: `engineering-team/reviews/done/harness-gate-integrity/3-history-checks-honest-in-a-shallow-clone.md`.

Cloud sessions start from a shallow clone (depth 50; `git rev-parse --is-shallow-repository` prints `true`). L10 picks
the latest commit touching a harness-definition path with `git log -1 -- <def-paths>`, then checks
`git show --name-only <commit>` for `engineering-team/CHANGELOG.md`. When that commit is a shallow boundary (listed in
`.git/shallow`, no parents in the clone), git diffs it against the empty tree: every file in the repo looks touched,
including the def-paths, so L10 names it whatever the commit really changed.

Seen at session start on 2026-10-09: `VIOLATION L10 commit:695fac4` ("docs(protocols): add the Opinionated Views
pre-NIP and worksheet W25"). That commit changed only `protocols/` files, and `git rev-list --parents -n1 695fac4`
prints no parent. The "pre-existing L10 violation on commit a04f95a" noted in OPEN.md row
`2026-10-04-llms-txt-egress-403-false-fail` may be the same misfire. Not checked.

**Fix shape.** In `check_L10`, when `git rev-parse --is-shallow-repository` is `true` and the selected commit is listed in
`.git/shallow`, print an INFO line ("shallow boundary; L10 can't tell what it changed — fetch more history") instead
of a violation. Alternatively, deepen until the commit has a parent (`git fetch --deepen`) before checking.

**Pointer:** `scripts/harness-lint.sh` (`check_L10`); `.git/shallow`.
