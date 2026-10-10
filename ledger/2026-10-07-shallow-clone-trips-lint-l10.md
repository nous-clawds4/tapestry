# In a shallow clone, harness-lint L10 reads the boundary commit as a harness change, so the gate goes red

**Id:** 2026-10-07-shallow-clone-trips-lint-l10
**Type:** meta
**Opened:** 2026-10-07 (treasure-map-edit #1, Test Design)
**Status:** DONE
**Done:** 2026-10-09 (story `harness-gate-integrity` #3) — L10 and L9 print INFO instead of judging a shallow clone's boundary commit, and L10's touch test no longer fails a large commit under pipefail. Review: `engineering-team/reviews/done/harness-gate-integrity/3-history-checks-honest-in-a-shallow-clone.md`.

Cloud sessions clone the repo shallow (50 commits). `scripts/harness-lint.sh` L10 asks
`git log -1 --no-merges -- <harness-definition paths>` for the latest harness change. At the clone's boundary, git
treats the cut-off commit as parentless, so it isn't a merge to `--no-merges` and it appears to add every file. L10 then
names it, here the merge of PR #782 (`aa9b373`, 2026-09-29), as a harness change without a CHANGELOG row. So:

- the SessionStart digest reports `VIOLATION L10 commit:aa9b373` and "harness-lint: 1 violation(s)";
- `npm test` goes FAIL in the `harness-lint` suite ("the real repo lints clean"), so a stack-free gate run reads red
  for a reason outside the work.

After `git fetch --unshallow origin`, the same tree lints clean (0 violations) and the suite passes.

**Fix shape.** L10 (and any other git-history check) skips, with an INFO line, when
`git rev-parse --is-shallow-repository` is true or when the commit it finds is listed in `.git/shallow`; or
`scripts/session-start.sh` unshallows (or deepens until the latest harness commit has its parents) before linting. The
first is cheaper and needs no network.

**Occurrence 2026-10-09 (book `assistant-outbox-relays`).** L10 named `commit:f932e16`, again the clone's boundary
(listed in `.git/shallow`). All three of the book's reviews recorded it as "a pre-existing L10 violation (another
session's docs commit)", and that reading travelled into the promotion status ("PR #829 blocked by … the pre-existing
harness-lint L10"). At the book close, `git fetch --unshallow origin` made `bash scripts/harness-lint.sh` report
"clean (0 violations)". CI checks out with `fetch-depth: 0`, so it should not see it. The fix shape above would have kept
a reviewer from misdiagnosing it.

**Pointer:** this session's gate run `20261007T141651Z-14068-c873` (`tme1-phase3`): FAIL in `harness-lint` and the new
suite; after unshallowing, `bash scripts/harness-lint.sh` reports clean.
