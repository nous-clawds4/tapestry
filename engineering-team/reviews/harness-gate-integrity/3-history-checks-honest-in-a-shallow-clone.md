# Review: Story 3 — The lint's history checks tell the truth in a shallow clone

**Reviewer:** Claude (acting as Reviewer; an independent fresh-context spawn that did not write the story, the tests or the implementation)
**Date:** 2026-10-09
**Diff:** `git diff origin/staging...HEAD` at HEAD `2e0a6597`. The merge base is `17243cdf`, which equals `origin/staging` and is the merge's second parent, so the two-dot and three-dot diffs are identical (8 files, +408/−11). Story commits (first-parent): `36e25963` Planning, `ed4c56f8` Test Design, `ec9d732b` Implementation.
**Story:** `engineering-team/stories/harness-gate-integrity/3-history-checks-honest-in-a-shallow-clone.md`
**ADR:** none. Under Standard strictness, a bug with an obvious fix skips Architecture. The change extends the invariant set of `engineering-team/decisions/harness-self-improvement/0001-harness-lint.md`.
**Test plan:** `engineering-team/stories/harness-gate-integrity/3-history-checks-honest-in-a-shallow-clone.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`, the full gate, run detached on the clean tree with `GATE_LABEL=hgi3-review` and read with `npm run gate:status -- --label hgi3-review`:
  > `20261010T011408Z-64539-d28b [hgi3-review] started 2026-10-10T01:14:08.885Z on 2e0a6597 — FAIL, exit 1, 5689 passed, 76 failed, 319 skipped, 290/290 suites; failed: profile-tags, profile-tags-publish, tag-detail, tag-detail-publish, tag-detail-write-publish, unified-tag-index, event-tagging-notes-by-author, unified-tags-directory, deploy-safety-status, router-stream-limit-on-connect, event-less-create-set, tapestry-per-concept-detail-views, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, teach-it-what-matters, return-the-four-on-every-read-surface, show-the-four-on-the-goal-screens-that-already-exist, brain-first-tapestry-authoring, b-coverage-audit-and-disposition, adoption-candidates-queue, inverse-queue-publish-candidates, concept-count-canonical, summaries-element-count, list-headers-me-disposition`

  The run record shows the tree clean at start (`dirty: false`). All 26 failures are environmental. The local stack is partial and is not this branch: `tapestry` and `tapestry-redis` are up but bind-mount the main checkout, not this worktree (`docker inspect tapestry`); its graph holds 9 concepts; and no `nostr-search-*` containers are running, so the failures read `fetch failed`, `got null`, `The operation was aborted due to timeout`, a missing firmware superset, "expected many concepts; got 9", or a live-graph hygiene check. These are the same class as the Implementer's runs `20261009T200958Z-82558-f240` and `20261009T212241Z-71396-0c3e`, with the usual run-to-run variance in which stack suites fail. The diff has no `src/` or `ui/` changes and cannot reach them. Only two suites invoke `scripts/harness-lint.sh`: `test/harness-lint.test.js` and `test/ledger-row-ids.test.js` (grep of `test/`). From the run record: `harness-lint.test.js` PASS 84/0, `ledger-row-ids.test.js` PASS 6/0, `session-start.test.js` PASS 32/0, `harness-stats.test.js` PASS 12/0. The Implementer's baseline run (`…f240`) lists `harness-lint` among its failures, and this run does not.
- [x] The `harness-lint` suite run alone in this worktree (full history) gives `{"pass":84,"fail":0}`. It also passes 84/0 when run *inside* a real depth-1 shallow clone of HEAD, inside a real depth-50 shallow clone, and inside a linked worktree (`git worktree add`) of the depth-1 clone. That last case is the cloud-session-plus-worktree configuration.
- [x] `bash scripts/harness-lint.sh` on this worktree exits 0 with `harness-lint: clean (0 violations)`. Its output is byte-identical to `origin/staging`'s script run on the same tree, so full-clone output is unchanged.
- [x] `npm run test:playwright`: not applicable (no browser or UI surface).
- [x] _Lint, typecheck and build are not configured, so they were skipped._

## Spec adherence

### Reproduction: the original misfire, before and after

Each clone was made with `git init` + `git fetch --depth=N file://<git-common-dir> <sha>` + `checkout FETCH_HEAD`, then linted by `origin/staging`'s script (extracted with `git show`, with its `lib/` alongside) and by this branch's script.

| Shallow clone | `origin/staging` script | this branch's script |
|---|---|---|
| depth 1 at `695fac4` (the commit the owner was asked to add a row for) | `VIOLATION L10 commit:695fac4`, exit 1 | `INFO L10 commit:695fac4 is this shallow clone's boundary …`, clean, exit 0 |
| depth 1 at `a04f95a` (a merge, PR #747) | `VIOLATION L10 commit:a04f95a`, exit 1 | `INFO L10 commit:a04f95a …`, clean, exit 0 |
| depth 50 at `695fac4` (9 boundaries) | `VIOLATION L10 commit:9a9230a` (a merge, PR #740), exit 1 | `INFO L10 commit:9a9230a …`, clean, exit 0 |
| depth 1 at HEAD `2e0a659` (a merge) | `VIOLATION L10 commit:2e0a659`, exit 1 | `INFO L10 commit:2e0a659 …`, clean, exit 0 |
| depth 50 at HEAD (27 boundaries) | clean | clean, with no INFO, because the newest def-path commit `ec9d732b` lies inside the fetched history |
| linked worktree of the depth-1 clone at `695fac4` | `VIOLATION L10 commit:695fac4`, exit 1 | `INFO L10 …`, clean, exit 0 |

**The touch-test mechanism holds.** In the depth-1 clone at `695fac4`, `git show --name-only --format= HEAD` lists 3,816 names (209,255 bytes) and the CHANGELOG is at line 172. Under `set -o pipefail`, `… | grep -qx engineering-team/CHANGELOG.md` returns 141: grep exits at its match and git dies of SIGPIPE. The story's Background and the CHANGELOG row describe this correctly.

**The occurrence claims hold.** `aa9b373`, `f932e16` and `695fac4`, plus `a04f95a` and `9a9230a`, each change zero harness-definition paths relative to their first parent. Each was checked against its own revision of `scripts/harness-def-paths.txt`.

**`a04f95a` (ledger row `2026-10-04-llms-txt-egress-403-false-fail`, line 13) is the same class.** It is a merge (parents `4ff93dd4 fb5b220c`), so `--no-merges` can never select it in full history. Full-history L10 at `a04f95a` lands on `e8911345`, which touched the CHANGELOG. Only a shallow boundary, which has no visible parents, can make L10 name it, and the depth-1 clone above reproduces exactly that.

### Acceptance criteria

- [x] **AC1 (the boundary is not a harness change).** Tests at `test/harness-lint.test.js:434` (depth 1) and `:450` (depth 2, where the boundary is below HEAD) are green. The INFO line at `scripts/harness-lint.sh:289` names L10, the commit, "shallow" and `git fetch --unshallow`, and the lint exits 0. The real-clone reproductions above confirm the behaviour outside fixtures.
- [x] **AC2 (real L10 violations are still caught).** The shallow guard at `test/harness-lint.test.js:464` and the existing full-clone L10 tests are green, and full-clone output is byte-identical to staging. I also checked a merge topology the tests don't cover: a side-branch boundary dated *newer* than a real harness commit without a CHANGELOG row. The full clone and a depth-3 clone both still report the real commit, because git's default history simplification follows the merge parent that is TREESAME on the def paths, so the side branch's boundary is never visited.
- [x] **AC3 (a large commit that touched the CHANGELOG).** The test at `test/harness-lint.test.js:483` is green, and the new pathspec touch test is at `scripts/harness-lint.sh:295`.
- [x] **AC4 (L9 does not misread the boundary).** Tests at `test/harness-lint.test.js:502` and `:521`, and the existing full-clone L9 test, are green. The implementation narrows the INFO to the would-be-violation case; see non-blocking N1.
- [x] **AC5 (the repo lints clean from a shallow clone).** The test at `test/harness-lint.test.js:544` is green. I verified independently with a *real* depth-1 fetch rather than the test's `.git/shallow` rewrite, at depth 50, and from a linked worktree. The suite's "the real repo lints clean" test also passes when the suite runs inside those clones, which is AC5's second clause and is not exercised by the test itself.
- [x] No criterion is silently dropped. Nothing beyond the story was added (see the scope check below).

### Mutation check: does a test go red for each wrong fix?

Each mutation was applied to the script in a scratch clone, and then the whole suite was run.

| Mutation | Suite | What caught it |
|---|---|---|
| M1: skip whenever the repo is shallow (`is_shallow_boundary` = `[ -n "$SHALLOW_FILE" ]`) | 82/2 | the L10 inside-history guard (`:464`) and the L9 inside-history guard (`:521`) |
| M2: treat any parentless commit as a boundary | 82/2 | `L10 never says "shallow" about a full clone` (`:477`) and the existing full-clone L9 test |
| M3: revert the touch test to `git show --name-only … \| grep -qx` | 83/1 | AC3 (`:483`) |
| M4: drop the L9 boundary branch | 83/1 | AC4 (`:502`) |
| M5: drop the L10 boundary branch | 82/2 | both AC1 tests |
| M6: L10 INFO without `git fetch --unshallow` | 83/1 | AC1 (`:434`) |
| M8: look up the boundary by short sha | 82/2 | both AC1 tests |
| M9: literal `.git/shallow` in place of `git rev-parse --git-path shallow` | **84/0** | nothing; see N4 |

## ADR adherence

- [x] There is no story ADR. The change stays inside `harness-self-improvement/0001`'s mechanism: one shared helper and two existing check functions in `scripts/harness-lint.sh`, and the invariant header gains one note (`:25–26`). The script still needs only bash, git and coreutils.
- [x] Layering is respected and there are no new dependencies or tooling.

## Concept-graph integrity

- [x] Not applicable. The diff touches no concept handles, firmware or runtime code, so no reinstall is needed and there is no `/summaries` orientation to check.

## Things tests can't catch

- [x] **bash 3.2 safety.** The change adds only here-strings (`read -r … <<<"$last"`), `local`, and `[ -n "$(…)" ]`. It adds no arrays and no `${!…}`. Every run above used `/bin/bash` 3.2.57, the `bash` on PATH that the suite's `lint()` spawns.
- [x] **The relative path is safe.** `--git-path shallow` yields `.git/shallow` relative to the toplevel. The script `cd`s there once (`:56`) before computing it (`:236`), and there is no later top-level `cd`. In a linked worktree it resolves to the common dir's `shallow`, which I verified.
- [x] `is_shallow_boundary` greps a file rather than a pipe, so it carries no SIGPIPE hazard, and a hex sha contains no regex metacharacters. In a non-shallow repo `SHALLOW_FILE` is empty, so the helper is false.
- [x] No secrets, no debug output and no commented-out code. The only `console.log` in the diff is in the test plan's how-to-run snippet.
- [x] **Scope.** All 8 files are phase-accounted. Planning added the story, the epic reactivation, the book listing, the run-scoped L2 waiver and its CHANGELOG row. Test Design added the test plan and the 8 tests (76 → 84, which matches the test plan's arithmetic). Implementation changed the script and added its CHANGELOG row. The impl commit has no `test/` changes. `test/` is not a def path, so the Tester's commit owed no CHANGELOG row.
- [x] **The waiver is well formed.** `scripts/harness-lint-waivers.txt:13` parses and prints `WAIVED L2` (twice, once per closed book naming the epic). Its citations exist: row 129 (DONE) is the original reopen blind spot and row 322 (OPEN) carries it forward. The 2026-08-04 precedent is `engineering-team/CHANGELOG.md:65`.

## House rules check

- [x] Concept Graph API authority: not engaged.
- [x] No new lint, typecheck or build tooling. This extends an existing check script and adds no new checker.

## Findings

### Blocking

None.

### Non-blocking

1. **`scripts/harness-lint.sh:252–262` vs story AC4 (`3-history-checks-honest-in-a-shallow-clone.md:60–64`).** AC4 says that when a file's only visible change is the boundary, the lint "prints an INFO line saying its header could not be checked". The code prints that INFO only when the check would otherwise be a violation (`days > 14`). When the header is within 14 days of the boundary date it passes silently, reasoning that a pass against the boundary's date is a real pass. I confirmed this in the real repo: in the depth-1 clone at HEAD, `OPERATIONS.md`'s only visible change is the boundary (header 2026-09-29, boundary 2026-10-09) and no `INFO L9` is printed. The narrowing fits the story's user-facing intent ("say plainly when the history is too short to judge"), and it is documented in the code comment, the impl commit body and the CHANGELOG row. But it is a reading of an AC that the Implementer did not log under `## Deviations` in the story (`roles/implementer.md` step 9), and no test pins the pass sub-case either way. Optional: add one `## Deviations` line to the story recording the reading, so a later "fix to match AC4" doesn't add a false "can't be checked" line.
2. **`scripts/harness-lint.sh:256` and `engineering-team/CHANGELOG.md:95` say a boundary's date "is never earlier than the file's real last change".** L9 compares author dates, and author dates can invert under rebase or cherry-pick: 31 of this repo's 5,695 commits carry an author date earlier than their first parent's. The consequence is bounded: in a shallow clone L9 could pass a header that full history would flag, and the full-history gate in CI still catches it. Optional: soften "never" to "in practice not", or name the author-date caveat.
3. **`engineering-team/CHANGELOG.md:95`: "Full-clone behaviour is unchanged."** That is not quite true. The touch-test fix changes the full-clone outcome for a large commit that touched the CHANGELOG (AC3's fixture is itself a full clone, red before the fix). Optional: "Full-clone outcomes are unchanged apart from that fix."
4. **`scripts/harness-lint.sh:236`: the `git rev-parse --git-path shallow` choice is untested.** Mutation M9 (a literal `.git/shallow`) keeps the suite at 84/0. In a linked worktree of a shallow clone, that mutation loses the AC1 INFO line (L10 goes silent, because the boundary "touches" the CHANGELOG via the new pathspec test) and would restore the false L9. The shipped code is correct there: I verified the lint and the suite in that configuration. Optional: one test that lints from `git worktree add` of a shallow fixture.
5. **`test/harness-lint.test.js:483–500` leaves its fixture behind, and the test plan calls the left-behind fixtures "small" (test plan `:55`).** The AC3 fixture (2,000 files plus their git objects) leaves about 16 MB in `$TMPDIR` on every suite run, and 17 such directories were already present on this host. Leaving fixtures follows the file's existing convention, but this one is not small. Optional: remove it in a `finally`, as the AC5 test does with its clone.
6. **`ledger/2026-10-09-lint-l10-misfires-on-shallow-clones.md` is the same defect as the row this story closes, but neither the story (`:36`, `:91`) nor the CHANGELOG row names it.** It was filed independently and arrived with the staging merge after Planning. Its open question ("`a04f95a` … may be the same misfire. Not checked.") is now answered: yes, see the Reproduction section. It should be closed alongside `2026-10-07-shallow-clone-trips-lint-l10` (bookkeeping, listed below).

### Harness friction

1. **The L10 waiver key depends on the clone.** The waiver shape is `commit:<short-sha>`, built from `%h`, whose length follows the repo's object count: `695fac48` in this full repo but `695fac4` in a shallow clone. An L10 waiver written in a cloud session would therefore not match in a full clone, and vice versa. Had the "silence it" path been taken with a waiver instead of a CHANGELOG row, it would have broken this way. This is pre-existing and out of this story's scope; it is worth a `meta` ledger row.
2. **The same defect was filed twice in the ledger** (2026-10-07 and 2026-10-09), the second without finding the first. Meanwhile three reviews and one promotion status recorded the misfire as a real "pre-existing L10 violation" (ledger rows `2026-10-07-…` occurrence note and `2026-10-04-llms-txt-egress-403-false-fail`:13). This fix removes the cause. The dedupe miss is recorded here for the ledger owner.

## Verdict
**PASS**

## On PASS (same commit)

The reviewer did not edit these; the orchestrating session applies them.

- [x] Story `**Status:**` flipped to `Done` in place. Until it is, `harness-lint` reports `VIOLATION L1` for this review, which is PASS-final while the story is still `Approved`. Also fill the story's `Review:` link with this file's path.
- [x] Optional (N1): a `## Deviations` line in the story recording the AC4 reading (INFO only when the check would otherwise be a violation).
- [x] Ledger: close `ledger/2026-10-07-shallow-clone-trips-lint-l10.md` and its duplicate `ledger/2026-10-09-lint-l10-misfires-on-shallow-clones.md` (Status DONE, Done date, pointer to this story and review). Optionally annotate `ledger/2026-10-04-llms-txt-egress-403-false-fail.md:13`: the `a04f95a` L10 was this shallow-clone misfire, not a real violation.
- [x] Completion detection: performed and reported in chat, not in this file.
- [ ] At epic re-retirement (when this ships), three steps:
  - Set `epics/harness-gate-integrity.md` back to Done.
  - Move story #3's two files into the **existing** `stories/done/harness-gate-integrity/`, and this review into the existing `reviews/done/harness-gate-integrity/`. Those folders already exist, so a directory-level `git mv` would nest them; move the files.
  - Remove the run-scoped waiver `scripts/harness-lint-waivers.txt:13`, with a CHANGELOG row for its removal (the waivers file is a def path, so L10 requires one).

## Applied after the verdict (orchestrating session, same commit)

The findings were non-blocking. These changes touch only comments, docs and tests; the checks' behaviour is unchanged.

- N1: a `## Deviations` line in the story records the AC4 reading.
- N2: the comment at `scripts/harness-lint.sh` (L9) and the CHANGELOG row now say "normally no earlier", and name the
  author-date caveat and that CI's full history still judges those cases.
- N3: the CHANGELOG row says "Full-clone outcomes are unchanged apart from that touch-test fix".
- N4: a new guard test, `L10 in a linked worktree of a shallow clone: the boundary is still recognised (the shallow list
  lives in the shared git dir)`. It goes red under the literal-`.git/shallow` mutation and green on the shipped code.
- N5: the AC3 test removes its ~16 MB fixture in a `finally`; the test plan no longer calls it small.
- N6: the story and the CHANGELOG row name the duplicate row, and both rows are closed. `ledger/2026-10-04-llms-txt-egress-403-false-fail.md`
  carries a dated note that its `a04f95a` violation was this misfire.
- Harness friction 1 is filed as OPEN.md row `2026-10-09-l10-waiver-key-varies-by-clone`.

After these changes, `bash scripts/harness-lint.sh` reports clean (0 violations), and the `harness-lint` suite run
alone reports 85 passed, 0 failed.
