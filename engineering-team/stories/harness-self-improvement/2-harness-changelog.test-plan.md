# Test Plan: Story 2 — harness-changelog

**Story:** `engineering-team/stories/harness-self-improvement/2-harness-changelog.md`
**ADR:** `engineering-team/decisions/harness-self-improvement/0002-harness-changelog.md`
**Date:** 2026-07-02

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-4 L10 fires (def-path commit w/o CHANGELOG) | `L10: the latest commit touching a def path without touching the CHANGELOG is a violation` | `test/harness-lint.test.js` | fixture-integration |
| AC-4 L10 quiet (same commit touches both) | `L10 is quiet when the same commit touches both the def path and the CHANGELOG` *(regression sentinel — passes pre-impl by quiet-when-absent; guards the behavior post-impl)* | 〃 | 〃 |
| AC-4 L10 waiverable | `L10 waiver: a commit:<sha> waiver suppresses the violation visibly` | 〃 | 〃 |
| CHANGELOG can't be silenced by deletion (ADR) | `L10: a missing CHANGELOG.md (while def paths exist) is itself a violation` | 〃 | 〃 |
| Fixture tolerance (ADR) | `L10 is skipped silently when the tree has no git history` *(sentinel, as above)* | 〃 | 〃 |
| Def-path file is the single source (ADR) | `L10 reports INFO and skips when the def-paths data file is missing` | 〃 | 〃 |
| AC-4 "existing 19 tests stay green" | the story-1 suite re-run against the updated fixture base (CHANGELOG + def-paths added to `cleanFiles()` per ADR) | 〃 | 〃 |
| AC-1 CHANGELOG exists, documented format | inspected at Review (artifact content, not behavior) + the real-repo lint-clean test exercises its presence via L10 | Review + suite | reviewer-run |
| AC-2 retroactive seed (rows + origins + commit pointers) | reviewer audits the seeded rows against `git log` and the review/MIGRATION/journal origins | Review | reviewer-run |
| AC-3 README convention paragraph | reviewer audits § "Tuning the team" | Review | reviewer-run |
| AC-5 whats-open divergence section | reviewer runs `bash scripts/whats-open.sh` on this branch (which *does* diverge from origin/staging with harness commits) and checks the section lists them; and checks the "(none)" wording by reading the code path — whats-open has no unit suite (established precedent, story 1) | manual/Review | reviewer-run |
| AC-6 real repo passes lint incl. L10 at close | `the real repo lints clean (violations fixed or waived with citations)` — now implicitly covering L10, since this story's commits touch def paths | `test/harness-lint.test.js` | repo-integration |

## Edge cases

- [x] Latest-commit-only semantics (the ratified v1 scope): the violation fixture's *first* commit satisfies L10, the *second* violates — proving the check keys on the latest def-path-touching commit.
- [x] Waiver path shape `commit:<short-sha>` matched by glob (`commit:*` in the fixture waiver).
- [x] CHANGELOG deleted → still a violation (can't silence the check by removing the ledger).
- [x] Def-paths data file missing → visible INFO, check skipped, exit unaffected (a tree that hasn't adopted the convention isn't failed retroactively — the real repo ships the file).
- [x] No git history → silent skip (same rule as L9).
- [ ] Merge commits: L10 uses `--no-merges` (ADR) — not separately fixture-tested; the real-repo run covers it (this branch's history contains merges).

## Test infrastructure

- Same as story 1: Node built-in runner, per-test git-inited temp fixtures, no stack, no network. New helper `addCommit()` creates the second commit L10's latest-commit semantics need.
- Fixture base change (ADR-specified): `cleanFiles()` now includes `engineering-team/CHANGELOG.md` and `scripts/harness-def-paths.txt`, so every story-1 fixture satisfies L10 by construction. Story-1 assertions untouched.

## How to run

```
npm test
```

Standalone: `node -e "require('./test/harness-lint.test.js').run().then(r=>process.exit(r.fail?1:0))"`

## Verification

The new feature tests fail with the current code. Confirmed 2026-07-02 at commit `e2d0176a` (pre-implementation): the 4 L10 feature tests fail because `check_L10` does not exist (no `VIOLATION L10`/`WAIVED L10`/`INFO` output is produced); the 2 sentinels pass by quiet-when-absent semantics (documented above, precedent: the verified-muters R-sentinels); all 19 story-1 tests remain green against the updated fixture base:

```
  ✗ L10: the latest commit touching a def path without touching the CHANGELOG is a violation
  ✓ L10 is quiet when the same commit touches both the def path and the CHANGELOG
  ✗ L10: a missing CHANGELOG.md (while def paths exist) is itself a violation
  ✗ L10 waiver: a commit:<sha> waiver suppresses the violation visibly
  ✓ L10 is skipped silently when the tree has no git history
  ✗ L10 reports INFO and skips when the def-paths data file is missing
suite: 21 passed, 4 failed
```
