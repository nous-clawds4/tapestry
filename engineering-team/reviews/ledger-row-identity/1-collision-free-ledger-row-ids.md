# Review: Story 1 — Ledger row ids that cannot collide

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-20
**Diff:** `git diff 17e8c9c0...HEAD` on `feat/ledger-row-ids` — `64f2d787` (failing tests + test plan), `8e624eb5` (implementation). Base: `git merge-base origin/staging HEAD` = `17e8c9c0`. `origin/staging` moved to `f4fefd5f` during the review (PR #694, merged 2026-09-20T02:08:39Z: row 337 to DONE, one line); the review is against the merge base, and the moved tip was trial-merged (below). Nothing was pushed at review time: `git ls-remote --heads origin feat/ledger-row-ids` is empty, so no CI run exists for this branch.
**Lane:** Feature, Standard strictness. Story `engineering-team/stories/ledger-row-identity/1-collision-free-ledger-row-ids.md`; ADR `engineering-team/decisions/ledger-row-identity/0001-date-slug-ids-and-row-files.md` (Accepted, Option C — not reopened here); test plan beside the story.

The reviewer had none of the implementing session's context. Every statement below was re-derived from a command run during this review; where something could not be checked, § "Not verified" says so. Scratch worktrees and clones lived outside the repo and were removed.

## Quality gates (run by reviewer, not trusted)

- [ ] `npm test` — **the run is red on this host. It is red in the same way before and after this diff.** Node v22.23.2, clean tree at `8e624eb5`, `GATE_LABEL=ledger-ids-phase5-review`. `npm run gate:status -- --label ledger-ids-phase5-review` exits 1 and prints:

  > `20260920T022517Z-81298-958d [ledger-ids-phase5-review] started 2026-09-20T02:25:17.280Z on 8e624eb5 — FAIL, exit 1, 3238 passed, 51 failed, 139 skipped, 207/207 suites; failed: tag-detail, capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, return-the-four-on-every-read-surface, show-the-four-on-the-goal-screens-that-already-exist, recognizable-published-ta-profile, not-yet-shared-filter, concept-count-canonical, summaries-element-count`

  What the run records in `tmp/gate-runs/` show:
  - This is the first gate run on the committed implementation. The Implementer's "after" record, `20260920T015220Z-67631-026e`, is stamped `64f2d787+dirty`: it ran on the uncommitted tree. Mine is stamped `8e624eb5`, `dirty: false`, and is identical to it suite for suite (verdict, pass, fail, skipped, all 207).
  - Against the labelled baseline taken before Implementation, `20260920T012653Z-35676-848f` on `17e8c9c0+dirty` (FAIL, 3202 / 87 / 139): exactly three suites differ, and they are this story's — `harness-lint` 42/21 to 63/0, `session-start` 23/9 to 32/0, `ledger-row-ids` 0/6 to 6/0. The other 204 are identical.
  - The 15 red suites are red in the baseline with the same counts and the same 51 failing test names (set difference empty both ways, per suite). They are live-stack suites reporting the state of this local instance; `OPEN.md` row 289 (bug, OPEN) tracks them. The diff touches no file under `src/`, `ui/`, `bin/`, `setup/` or `public/`.
  - The three suites the ADR names as reading rows out of the real table pass, and their files are not in the diff: `operational-direction` 86/0, `curated-dlist-update-update-preview` 34/0, `curated-dlist-update-publish` 69/0.
  - CI's gate is the stack-free run on `ubuntu-latest` (`.github/workflows/test.yml`), where the live suites skip. It has not run: the branch is not pushed.
- [x] The three story suites through their `run()` exports, Node v22.23.2, at `8e624eb5`: `ledger-row-ids` 6/0, `harness-lint` 63/0, `session-start` 32/0.
- [x] The same three at `64f2d787` (scratch worktree, removed): 0/6, 42/21, 23/9 — the red-first counts the test plan and the commit message claim.
- [x] **The same three on Linux with mawk** — Ubuntu 22.04, mawk 1.3.4, bash 5.1.16, Node v22.23.2, in a throwaway container from the local `tapestry` image with the repo mounted read-only: 6/0, 63/0, 32/0. This host has BSD awk 20200816 and bash 3.2.57, and the story's Deviations call the interval-free id pattern "untested caution"; it is tested now, on the awk family CI's runner uses.
- [x] `bash scripts/harness-lint.sh` at `8e624eb5` → `harness-lint: clean (0 violations)`, exit 0.
- [x] Again with this review, the three new row files and the close-out edits in the tree: lint clean; on Node v22.23.2 `ledger-row-ids` 6/0, `harness-lint` 63/0, `session-start` 32/0, `harness-stats` 12/0; on Node v16.17.0 the first three give the same counts.
- [ ] `npm run test:playwright` — not applicable; no browser surface.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.

| AC | Tests | What I re-derived myself |
|---|---|---|
| AC-1, AC-2 | `test/ledger-row-ids.test.js` (both-ways merge; same-id add/add) | Two `git clone --local` copies of **this** repository at `8e624eb5`, `origin` removed. Each minted a row by copying `engineering-team/templates/open-row.md` to `ledger/$(date -u +%F)-<slug>.md` and filling the header. Each merged the other's commit: exit 0, `git status --porcelain` empty, two parents, `HEAD^{tree}` equal (`82a525f9`) in both. `harness-lint` clean in both; the digest reads 120 in both (119 plus the one probe typed `meta`; the `cleanup` probe is listed and not counted). |
| AC-3 | freeze-marker test; three table-reading suites unmodified | The test plan's id-to-line map, base worktree against `8e624eb5`: 343 lines to 342, **one line differs — the second row 329**. 342 distinct ids either side; the only id seen twice before is 329, none after. Highest id 343 = the marker; one whole-line marker; the only gap in 1–343 is 257. The documented lookup (`^\| N \|`) finds exactly one row for each of the 342 ids. |
| AC-4 | 22 L15 tests (21 red first, one guard); "the real repo lints clean", unmodified | On scratch copies of the **real** `OPEN.md` (never the working tree): a duplicated row 230 and a duplicated row 70 (one of the nine piped rows) each exit 1 and name the id; row 344 added after row 343, and again at the end of the file below the marker, exits 1 with the ADR's message word for word; a date+slug id in the table exits 1 with the second message; a row that quotes the marker with `highest-number=1` inside its text changes nothing (exit 0). All six reproduce under mawk. |
| AC-5 | 10 reader tests; the 21 older `session-start` tests unmodified | Done **before** any row was flipped: the two roll-ups inside 15 s (02:14Z), the two digests within the next minute. Ledger section: 248 rows either side; the moved row's table line goes, its file-row line comes after the table's rows. "Meta items": 119 either side; same swap, same age (`[0d]`). Banner and digest line byte-identical: 119 open, oldest 79d. `diff -a` of the two whole roll-ups shows those four lines and nothing else. |
| AC-6 | three tests in `test/ledger-row-ids.test.js` | Read the rule in `OPEN.md` against the ADR's six bullets: all present, template linked, header cell reworded. Swept the definition paths for `highest`, `renumber`, `row number`, `next number`, `allocated off`, `plus one`: what is left is per-epic story and ADR numbering (out of scope) and L15's own text. Rows 151, 207 and 307 and the 2026-07-28 intake marker are closed by this commit, as ADR step 10 assigns. |

### The step-1 claims (the duplicate 329)

- `git merge-base --is-ancestor 38a1488f 86b2d9e7` exits 0; the reverse exits 1. `gh pr view` gives #686 merged 2026-09-19T07:18:54Z as `38a1488f` and #687 merged 07:36:11Z as `86b2d9e7` — the numbering note's "07:18Z" and "07:36Z".
- `OPEN.md` holds one row 329 (`cleanup`) at `38a1488f` and two (`meta`, `cleanup`) at `86b2d9e7`. `git log -S` gives `2a99d58d` as the commit that added the cleanup row and `dab6ce5b` as the one that added the meta row; `2a99d58d` is an ancestor of `dab6ce5b`, and `dab6ce5b` is not in `38a1488f`. So the cleanup row landed first and keeps the number, as step 1 requires.
- The moved row's Item cell (1,312 bytes) equals line 14 of `ledger/2026-09-19-agent-worktrees-outlive-books.md` byte for byte; Opened, Status and Pointer are the row's own cells. Its id carries its Opened date, as step 1 says.
- **No citation was edited.** I read every non-test hunk. By number: every tracked mention of 329 as a row either means the cleanup row (`audits/user-data-error-path/audit.md`:53, `prd-seed.md`:36) or describes the duplicate as an event (the ADR, row 307, three earlier reviews, the CHANGELOG row). By text (`worktrees outlive`, `nothing reaps`): only the row file, the note, the ADR's example and test fixtures.

### The Deviations — each accepted, and why

1. *"The table" is the lines after the `| # |` header.* Accept. On the real file the control copy is clean: the preamble table and the sixteen notes are not read as rows.
2. *The marker counts only as a whole line.* Accept. Measured: a row quoting the marker with a lower number does not lower the bound.
3. *A second L15(b) message for a non-numeric id.* Accept. A numbered row gets the ADR's sentence verbatim; the variant is clearer for the case it covers.
4. *L15(c) enforces the 64-character cap, and reports an empty file.* Accept. The cap is in the rule's own bullet and an id cannot change once cited. Measured: an empty row file is named.
5. *No `OPEN.md`: (a) and (b) skip without a word.* Accept. Measured: no INFO line, and (c) still runs.
6. *The id pattern without `{n,m}`.* Accept. The awk pattern and the ADR's pattern give the same verdict on 15,638 distinct strings (734 matches), on BSD awk and on mawk.
7. *`.claude/commands/close-book.md` retired along with workflow step 13.2.* Accept. It taught the same rationale; the AC-6 test pins both files.
8. *Both close-commit lines now `git add … OPEN.md ledger`.* Accept. `ledger/` can no longer be absent in this repo (rows are never deleted), so the pathspec cannot fail.
9. *The rule replaces two bullets and adds one naming L15.* Accept.
10. *The moved row's file keeps the whole Item text.* Accept; verified byte for byte.
11. *Landing order, as measured.* Accept; re-measured above.

### The tests themselves

`8e624eb5` touches no file under `test/`. `64f2d787` adds 591 lines under `test/` and removes one: the name of the six-agents test, which gains two rules (the plan declares it). The merge test mints the documented way, from the real template, so template, lint and reader cannot drift apart unnoticed. The exact summary line is pinned. New suites leave their temp directories behind, as `harness-lint.test.js` and `session-start.test.js` already do.

## ADR adherence

- [x] Files changed match the ADR's implementation notes.
- [x] Layering / module boundaries respected.
- [x] No new dependencies the ADR didn't authorize.

Steps 1–11, each checked against the diff: (1) above. (2) Prose line and marker directly after the last row; N = 343 = the highest number on `origin/staging` at `f4fefd5f` too. (3) Rule, template link, header cell; the fifteen earlier notes are untouched and step 1 adds a sixteenth in their style. (4) Template: title, `Id`, `Type`, `Opened`, `Status`, `Done`, `Pointer`. (5) `ledger_file_rows` prints the five tab-separated columns; no directory, or an empty one, prints nothing and returns 0. (6) The table grep pipeline is unchanged; only its `||` fallback became a flag. Summary line as specified. (7) New loop after the table loop and before the intake loop; the table loop's only change is `label` in the `local` line. (8) Header list, run order after L14, `violation L15 <path> <msg>`; (a), (b), (c) as specified, INFO-and-skip without a marker. (9) Six agents, found with the ADR's own `git grep`; `CLAUDE.md` stays at its 190-line cap; `product-team/README.md` :34 and :86. No other statement of that write scope exists in the definition paths. (10) Above. (11) One CHANGELOG row, four cells, in the implementation commit; Origin as specified.

**Trial merge with the moved base.** In a scratch clone, `f4fefd5f` merges into the branch automatically (`OPEN.md`: one line, row 337); the marker still reads 343 and the lint is clean on the merge result, which is what CI lints. Of the four open PRs (#583, #567, #232, #32; `gh pr list`, 02:25Z), none touches `OPEN.md` or `ledger/`.

## Concept-graph integrity

- [x] Handles are in `kind:pubkey:slug` form. — None touched; the ledger is harness infrastructure.
- [x] Firmware reinstall called out (or performed) if concept definitions changed. — None changed; the ADR says none is required.
- [x] New code orients via `/api/concept-graph/summaries` rather than re-reading BIBLE.md. — Not applicable: no domain code.

## Things tests can't catch

- [x] No secrets in committed files. No TA pubkey literal.
- [x] No leftover debug logging or `console.log` — the only hits are the suite runner's reporter (house pattern) and the test plan's how-to-run lines.
- [x] No commented-out code.
- [x] Error paths and edge cases handled where it matters — with the two exceptions under Non-blocking.
- [x] Concurrency / race conditions considered. The design's subject; the both-ways merge and the same-id conflict were reproduced by hand.
- [x] Security: nothing takes external input. Filenames reach awk as arguments through a quoted array; an awk `name=value` argument cannot arise, because every path starts `ledger/`.

Also checked: `collect-meta.sh` now sources a new sibling unconditionally. Its two consumers resolve it through `BASH_SOURCE`, and no test fixture copies a `scripts/lib` file on its own, so no caller can find one library without the other. New files are mode 100644, like the sourced libraries beside them.

## House rules check

- [x] Concept Graph API authority respected — not involved.
- [x] No new lint/typecheck/build tooling without an ADR — L15 is a check inside the existing `harness-lint.sh`, authorised by ADR 0001 step 8 and shaped per ADR `harness-self-improvement/0001`.
- [x] `CLAUDE.md` and `AGENTS.md` line budgets held (190 and 102).

## Product-guide adherence

Not applicable: the story traces to an acceptance frame, not a PRD.

## Findings

### Blocking

None.

### Outstanding at merge (not a defect of the diff)

- The three Done cells below read "PR pending (branch `feat/ledger-row-ids`)"; the orchestrating session fills in the number once the PR exists.
- ADR follow-up 2 is outside the repo: the Loose Threads board's packet preamble still teaches "highest number plus one". The draft PR body carries it as an operator item; it is owed when this merges.
- If a numbered row reaches `staging` before this lands, the marker and the header cell's "rows 1–343" move together, by a rebase this review has not seen.

### Non-blocking

1. **`scripts/lib/collect-ledger.sh`:28 against `scripts/harness-lint.sh`:394** — the lint strips a trailing `\r` before reading a header field and the reader does not, so a row file with CRLF endings and a bare `**Status:** OPEN` lints clean and is listed and counted nowhere. Measured on a two-file fixture (lint exit 0; `OPEN^M` from `ledger_file_rows`; the digest says 1 where 2 are open), on BSD awk and on mawk. Latent: 0 of 1,418 tracked markdown files carry CRLF today. It falsifies the sentence at `collect-ledger.sh`:8–9 ("a row this reader would misread fails the lint first"). Same silent class as `OPEN.md` row 331, on the row-file side. Filed: OPEN.md row `2026-09-20-crlf-row-file-invisible-to-readers`.
2. **`scripts/harness-lint.sh`:373 and `test/ledger-row-ids.test.js`:142** — the freeze is self-declared. Measured: row 344 added and the marker raised to 344 in one edit lints clean, and the test's comparison (marker equals the table's maximum) holds. L15(a) still names any duplicate, so integrity is not at risk; the freeze is. Optional improvement: pin 343 in the test. Filed: OPEN.md row `2026-09-20-freeze-marker-can-be-bumped`.
3. **`scripts/whats-open.sh`:30–41 against `scripts/lib/collect-meta.sh`:54–62** — the roll-up reads row files only when `OPEN.md` exists; `collect_meta()` reads them regardless. In a tree with `ledger/` and no `OPEN.md`, "Meta items" would list a row the ledger section does not. No such tree exists; not filed.
4. **`test/session-start.test.js`:12** — the file's header comment still says the product roles are scoped to "product-team/** + OPEN.md". The test below it is right. Not filed.

### Harness friction

1. **`git grep -E` with `\b` matches nothing on this Mac** (git 2.55.0): no output, exit 1, for a string that is there; `-w`, `-P` and Linux git 2.34.1 all find it. My first sweep for citations of row 329 used it and came back empty. It was caught only because the story names two files that cite that row. A later negative ("does any test depend on rows 151, 207 or 307?") was redone with `-w`. Filed: OPEN.md row `2026-09-20-git-grep-word-boundary-vacuous` (the sibling of row 342).
2. A throwaway container could not see the session scratch directory: `/private/tmp` is not shared into the Colima VM, so a `-v` mount of it is an empty directory, and the lint runs there printed `clean` over nothing. Seen in the `cp` errors, discarded, and redone by streaming the fixtures in over stdin. A session-local trap, recorded here only; not filed.

## Not verified

- **CI.** The branch is not pushed; no `ubuntu-latest` run exists. The mawk container run covers three suites, not the stack-free gate, and I did not check which `awk` the runner image resolves to.
- **The Implementer's own two-clone run and its scratch-copy lint run.** The clones were deleted. I repeated both independently and got the same outcomes; theirs cannot be re-observed.
- **The operator's approvals at the Test Design and Implementation gates.** Asserted by the orchestrating session and the `64f2d787` commit message; nothing in the repo records them.
- **Citations outside the repo** (PR bodies, the Loose Threads board). Not read. The design leaves every number resolving, so none should need an edit.
- **"Before the intake entries".** The file row is the last "Meta items" line and no intake `Meta:` entry is open today, so the position claim rests on the code's loop order, not on an observation.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place; its six AC boxes ticked; its Review link filled.
- [x] `OPEN.md` rows 151, 207 and 307: Status `DONE` and the Done cell, nothing else — three changed lines; for each, `cut -d'|' -f1-5` and the Pointer cell are byte-identical to the base. The id-to-line map against the base now differs by the moved row 329 and these three.
- [x] `engineering-team/stories/_intake.md`, 2026-07-28 entry: the marker line directly under the heading now starts `**RESOLVED**`.
- [x] `engineering-team/epics/ledger-row-identity.md`: story 1's line reads **Done.**
- [x] Three rows filed under the new rule, as files in `ledger/` (ids above); no line was added to the `OPEN.md` table. The read surfaces as this commit leaves them: 248 rows in the ledger section, four of them files; 119 "Meta items"; banner and digest 119 open, oldest 79d — three closed, three filed.
- [x] Completion detection performed; its result is reported in the chat, not here.

## Verdict

**PASS**
