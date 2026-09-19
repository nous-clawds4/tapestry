# Review: Story 2 — Count the open meta rows whose text contains a pipe

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-19
**Diff:** `git diff origin/staging...HEAD` on `fix/meta-count-pipes` — `8e36b40a` (story), `5a963767` (failing tests + test plan), `d37354e6` (implementation); base `d37cd575`. Nothing was pushed at review time.
**Lane:** Bug, Standard strictness. There is no ADR: Architecture was skipped as obvious at the Planning gate. The design record checked in its place is `OPEN.md` row 290, ADR `ledger-row-identity/0001` § Consequences (follow-up 1) and § Out of scope, and ADR `harness-self-improvement/0004` § Implementation notes.
**Rounds:** round 1 reviewed `d37354e6` and is everything below except § Round 2; round 2 reviewed the commits made after the verdict, `206915b4..62e7bfa3`, and is § Round 2. Round 1's text is kept as written; where round 2 found it wrong, § Round 2 says so.

The reviewer had none of the implementing session's context. Every statement below was re-derived from a command run during this review; where something could not be checked, it says so.

## Quality gates (run by reviewer, not trusted)

- [ ] `npm test` — **the run is red on this host. Nothing this diff touches is involved.** Node v22.23.2, clean tree, `GATE_LABEL=meta-count-pipes-review`. The `npm run gate:status -- --label meta-count-pipes-review` line:

  > `20260919T193955Z-27026-ef45 [meta-count-pipes-review] started 2026-09-19T19:39:55.233Z on d37354e6 — FAIL, exit 1, 3200 passed, 51 failed, 139 skipped, 206/206 suites; failed: tag-detail, capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, return-the-four-on-every-read-surface, show-the-four-on-the-goal-screens-that-already-exist, recognizable-published-ta-profile, not-yet-shared-filter, concept-count-canonical, summaries-element-count`

  What was found, from the run records in `tmp/gate-runs/`:
  - All 51 failures are live tests (H and L classes) reporting the state of the local instance: a kind-39999 corpus event that is absent, goal fixtures that already exist, the hygiene check red on the live graph, the owner's published name, counts that read as the old `:ListItem` predicate. None reads the ledger, the collector, the digest, the roll-up, the CHANGELOG or the epic and story files.
  - The same 51 test names failed in run `20260913T062330Z-74080-b946` — 2026-09-13, commit `0da8dce9`, an ancestor of `origin/staging`, six days before this branch existed. The set difference is empty both ways. `OPEN.md` row 289 (bug, OPEN) tracks them.
  - Against the two earlier records of this branch — `20260919T191823Z-93037-b1b6` on `5a963767` (FAIL, 3189 passed / 61 failed / 139 skipped, 17 red suites) and `20260919T192940Z-82266-2dda` on `d37354e6` (FAIL, 3200 / 51 / 139, 15 red suites) — 204 of 206 suites are identical across all three records in verdict, counts and failing-test names, and for the 15 red suites the failure messages are identical too (ids and timestamps masked). Two suites differ: `session-start.test.js`, 12 pass / 9 fail before the fix and 22 / 0 after it, which is this story; and `adoption-candidates-queue.test.js`, 18 / 1 in the first record and 19 / 0 in the other two. Its H1 ("not observed within 6s") is a live timing miss in a suite this diff does not touch. The hand-off described the pre-fix record as the same 15 suites; it had 16 besides `session-start`.
  - 56 suites name a file this diff touches in their source (mostly docs tests that read `OPEN.md` or the CHANGELOG): 46 pass, 4 skip, and the 6 that are red are red only in the live tests above.
  - CI's gate is the stack-free run on Ubuntu (`.github/workflows/test.yml`), where these live suites skip. A stack-free run was not made on this host.
- [x] `bash scripts/harness-lint.sh` → `harness-lint: clean (0 violations)`, exit 0.
- [x] Again with this review file and the Status flip in the tree: the lint is still clean with identical output, and on Node v22.23.2 `session-start` is 22 / 0, `harness-stats` 12 / 0 and the `harness-lint` suite 41 / 0 — the counts they had in the gate run.
- [x] `test/session-start.test.js` alone at HEAD: 22 pass / 0 fail on Node v22.23.2 and on Node v16.17.0.
- [x] The same suite at `5a963767` (scratch worktree, removed afterwards): 12 pass / 9 fail on both Node versions, with the same per-test verdicts. Each red test reports the wrong meta state the story describes — `meta inbox: 0 open (clear)` for a lone piped row, `1 open, oldest 0d` for the closed row that names `OPEN.md`, `listed ["2","4"]` past the fused row, `dropped rows: [70, 244]` on the real ledger. None is a load or syntax error: the ten older tests and both guards pass in the same run.
- [ ] `npm run test:playwright` — not applicable; no browser surface.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has a passing test — with one clause of AC-6 outstanding by design (see "Outstanding before merge").
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story (one logged deviation, judged below).

| AC | Evidence |
|---|---|
| AC-1 | Three tests (code span, escaped, three pipes) plus "a date inside the Item text": red at `5a963767`, green at HEAD. A mutant that finds Status by value but reads Opened from `$5` fails five tests, so the age really comes from the cell before the Status. |
| AC-2 | The roll-up test lists `[NNNNd] \| 1 \| meta \|` and its banner counts the row. Re-run by hand in a throwaway `git init` repo: same. |
| AC-3 | The red test (a DONE row whose Item names `OPEN.md` after two pipes) and two guards. A mutant with a substring status test fails the red test. |
| AC-4 | The fused-row fixture has the real row 157's shape: status-like cells at fields 7 (`DONE`) and 12 (`DONE (see above)`), exactly as in the real row (the fixture has 14 fields, the real row 13). Rows 2, 3 and 4 after it are listed. |
| AC-5 | Reproduced with the test plan's recipe, old and new reader side by side, on the `OPEN.md` of `5a963767` and on HEAD's: exactly two added lines, `[60d] \| 70 \|` and `[9d] \| 244 \|` (Opened cells 2026-07-21 and 2026-09-10; today is 2026-09-19), `count=107` → `count=109`, `oldest=79` both times (row 16, 2026-07-02), no intake entries, no unknown ages. Row 290's own line differs between the two ledgers, but identically under both readers, so the reader-against-reader diff is the same on either. The real digest prints "109 open harness lesson(s), oldest 79d". The three older meta tests are untouched: the test file has 0 deleted lines across the branch. |
| AC-6 | Row 290 is OPEN, parses as a well-formed row (9 fields, one status-like cell, empty Done cell), is narrowed to the trim, names the story and the date, and keeps the first defect's record byte for byte (the old Item text, minus its leading bold marker, is a contiguous substring of the new one). **The PR is not named yet** — see "Outstanding before merge". |

An oracle written for this review (Node, whole-row parsing, no shared code with the reader) over the 330 table rows: 149 `meta` rows and no other type containing "meta"; the nine piped rows are 48, 70, 79, 84, 111, 157, 166, 229, 244; every row has exactly one status-like cell except 157, which has two, both starting with DONE; open meta rows are 107 by the old rule and 109 by the new rule, by the whole-line test, and by stripping code spans before a positional read; the difference is rows 70 and 244 and nothing else. Statuses are 235 `OPEN`, 94 `DONE`, 1 `DONE-LOCAL`. The roll-up's ledger section lists 235 rows, 109 of them meta.

### Claims re-derived

| Claim | Result |
|---|---|
| 12 / 9 at `5a963767`, red for the defect; 22 / 0 at HEAD | True, on Node 22 and Node 16. |
| Implementation changed no Tester test | True. `git diff 5a963767 d37354e6 -- test/session-start.test.js` is +13 / −0: one test and its two-line comment, which says it was added at Implementation. |
| CHANGELOG row in the same commit as the `scripts/lib` change | True (`d37354e6` holds both; `scripts/lib` is in `scripts/harness-def-paths.txt`; L10 clean). The row's text matches the code and the measurements; it is a well-formed four-column row appended at the bottom. |
| Scope | True. No `ledger/` directory, no L15, no second source in `collect_meta()`, `scripts/whats-open.sh` unchanged, the `cut -c1-150` expression is an unchanged context line, and row 290 is the only ledger row in the diff. |
| Row 290's added statements | Trims at `collect-meta.sh:40` and `whats-open.sh:50`, and they are the only two `cut -c1-150` in `scripts/` and `.claude/`: true. `cut -c` by byte — BSD under `C` or no locale (`61 c3`), by character under `en_US.UTF-8` (`61 c3 a9`); GNU coreutils 8.32 in the container by byte under `C` and under `C.UTF-8`, the only UTF-8 locale installed there: true for the versions present. With locale variables unset, row 193 is the only listed line that is invalid UTF-8 (158 bytes, last byte `0xe2`), under the old reader and the new, on the Mac and in the container; under `en_US.UTF-8` on the Mac none is: true. Toolchains — bash 3.2.57 with awk 20200816 here, bash 5.1.16 with mawk 1.3.4 20200120 in the container: true. Counts, rows and ages: true. Two statements need a second look — findings 2 and 4. |
| Portability | The reader's whole output on the real ledger (109 lines and the summary) is byte-identical on the Mac and in the container (md5 `736a4570…`). Old against new inside the container gives the same two lines, 107 → 109, oldest 79. The awk program alone gives identical output under BSD awk, mawk and busybox awk 1.37 (md5 `8ca1ab53…`). A fixture set of my own gave identical results in both places. **gawk was not available and was not tested**; the program uses only POSIX awk, and CI's Ubuntu run exercises it through this suite. |

### The deviation (scan from the sixth field)

Accepted as a logged deviation; a kick-back was not needed.

The story's reasoning was tested with a variant of the shipped reader that differs only in starting the loop at field 4. Fixture: two open rows whose Items begin "DONE rows…" and "DONE-LOCAL … `a|b` …", a DONE row whose Item is exactly `OPEN`, and an OPEN row whose Item is exactly `OPEN`. Three rows are open. The old reader finds two (it misses only the piped one). The shipped reader finds the right three with the right ages. The field-4 variant finds two, and the wrong two: it drops both rows that begin with DONE, counts the closed row, and loses the fourth row's age. So the literal wording would have added false negatives, a false positive and a wrong age, none of which the old reader had; the story understates its own case. On the real ledger the two starting points agree on all 330 rows, and no Item begins with DONE or OPEN, as logged.

The rule's wording sits in the story's Open questions, not in an acceptance criterion; no criterion changes; for a row without pipes the reader looks at the cell the old one did; and `roles/implementer.md` step 9 names this case ("an edge case the story didn't name"). It is recorded in the story, the CHANGELOG, row 290 and a code comment.

The added guard test is acceptable. It modifies no Tester test, it is marked in the file, and it earns its place: with the scan moved to field 4 it is the only one of the 22 tests that fails, so without it the suite cannot tell the two readings apart. Its fixture reads 0 open from the fourth field and 2 from the sixth, as the story says.

### The tests themselves

They test behaviour from outside: every fixture test runs `scripts/session-start.sh` or `scripts/whats-open.sh` in a throwaway repo and reads the output. The real-ledger test sources the library and reads `META_LINES`, which the library's header documents as its interface. Nothing asserts on the awk program.

They are hermetic. `rollup()` shadows `gh` with a stub that exits 1, and a fresh `git init` repo has no `origin`, so the script's one `git fetch` fails at once; the fixture has no `scripts/harness-lint.sh`, so the roll-up does not run the lint. The roll-up and the digest contain no other network call (the digest's stack probe is `localhost`, and older than this story). A run takes about a second.

The standing real-ledger test is sound. Its oracle is a whole-line regex in JavaScript; the reader is a field scan in awk. They share one premise — a Status is a cell reading exactly `OPEN` — which matters in finding 6. Ids are compared as multisets, so a duplicated id cannot hide a dropped row (329 is duplicated today, though only one of the two is a meta row). It names no row numbers. Its message leads with the dropped and extra ids and says what each means, including the case where the oracle is the one that is wrong. The oracle is case-sensitive and filters on type, where the roll-up's ledger section uses `grep -i` and no type filter; on today's ledger both give 109.

One guard is weaker than its name — finding 5.

### Attempts to break the reader

All on the Mac and, for the portable set, in the container too. No spaces, wide spaces and tabs around cells, tab plus pipe: handled. Empty Item and Opened cells, a row with no Status, short rows, `|` alone, `||||||||`: no error, same counts as the old reader. Header and separator rows and an indented row: as the old reader. No `OPEN.md`, an empty one, one with no table: count 0. A 400 KB Item with pipes, 60 pipes in one Item, a last line with no newline, CRLF: handled, identically in both places. `$(touch INJECTED)`, `%s`, globs, quotes and backslashes in a cell: printed verbatim, no side effect. Two dates in the Opened cell: the first is used. `set -uo pipefail`, which both callers use: fine.

Where the shipped reader gave a wrong answer, the old reader gave the same wrong answer or a worse one. There are two kinds of exception. The one that matters is finding 6, which comes from the status test being exact. The others are contrived and come from the scan now reading cells to the right of field 6: a row whose Status is neither `OPEN` nor `DONE…` (say `PARKED`) and whose later cell reads exactly `OPEN` is counted, and so is a row of some other table that has "meta" in its second column and such a cell. The roll-up's ledger section lists those rows too, and no such row exists.

## ADR adherence

Checked against the design record named in the header, there being no ADR.

- [x] Files changed match it. Row 290's rule ("exactly `OPEN` or starts with `DONE`, and the cell before it as Opened") and ADR 0004's "status-column == OPEN" are what the code does, read from the sixth field as the deviation explains. ADR 0001 keeps this fix out of story #1 ("its own ledger row, sequenced first"; "Do not touch the table loop in this story"), and the diff contains nothing ADR 0001 assigns to story #1.
- [x] Layering respected: one function in the one shared library; both consumers untouched.
- [x] No new dependencies. The suite needs `bash`, `git`, `awk`, `grep`, as before.

## Concept-graph integrity

Not applicable. No concept, handle or firmware definition is touched, and no reinstall follows.

- [x] Handles — none involved.
- [x] Firmware reinstall — not needed.
- [x] `/summaries` orientation — no domain code.

## Things tests can't catch

- [x] No secrets: no 64-hex literal and no TA pubkey in the added lines.
- [x] No leftover debug logging, `set -x` or `console.log`.
- [x] No commented-out code, no TODO.
- [x] Error paths: a missing or empty `OPEN.md`, a row with no Status, an undated Opened cell ("still count it", ADR 0004) all behave.
- [x] Concurrency: none. The pairing of awk's two lines per row with the two `read`s cannot slip: a cell cannot hold a newline, and `$0` is never rebuilt because the trim works on a copy (`c = $i`).
- [x] Security: ledger text reaches the shell only through `printf '%s'` and `read -r`; the awk program is a constant; the injection fixture had no effect.
- [x] `git diff --check` clean; `bash -n` clean under bash 3.2 and 5.1; no mode changes.

## House rules check

- [x] Concept Graph API authority — not engaged.
- [x] No new lint, typecheck or build tooling.
- [x] No TA pubkey literal; ADR 0015's named constants untouched.

## Product-guide adherence

Not applicable: the story traces to no PRD.

## Findings

### Blocking

None.

### Outstanding before merge (not a defect of the diff)

1. **`OPEN.md`:348 (row 290)** — AC-6 asks the row to record the fix "with the date and the PR". The story and the date are there; the PR is not, because nothing is pushed and no PR exists. The stated plan is a follow-up commit on this branch once the PR is open, as `949b6f29` did for row 330 inside PR #690. That commit has to land before the merge; until it does, AC-6 is met in every clause but this one. Whoever checks it should re-derive what it changes (`roles/reviewer.md` step 10), and it can carry findings 2 and 3.

### Non-blocking

2. **`OPEN.md`:348** — "this row opened with two defects in one function" reads as chronology, and as chronology it is wrong: the row was filed on 2026-09-13 (`d210b5ff`, then numbered 283) with the pipe defect alone, and the trim was added on 2026-09-18 (`77d9437b`). The row says as much further down ("found 2026-09-18"), so nobody is misled for long. Optional: "this row came to hold two defects in one function (the second was added on 2026-09-18)".
3. **`OPEN.md`:348** — the Item cell now holds 23 bold markers outside code spans, where it held 14. The unpaired one is the closer after "the escalation banner.", whose opener the new headline took over. Optional: put a bold marker back in front of `` `scripts/lib/collect-meta.sh:34` splits ``, which also restores the as-filed text exactly. How a renderer shows the stray marker was not checked.
4. **`OPEN.md`:348, story lines 80 and 90, `CHANGELOG.md`:88** — work packet `h-rollup-scanner` cannot be resolved from the repo: the name occurs only in files this branch adds or edits, and the packet board lives outside the repo. The operator's memory note on the board corroborates it (the packet's brief was amended on 2026-09-19 to hand over its pipe defect). The board itself was not read.
5. **`test/session-start.test.js`:237** — the guard named "the first status cell is the row's Status" cannot tell first from last. Its Done cell ends in a fragment that itself starts with DONE (`` DONE` for a day) ``), so a reader that takes the last status-like cell passes all 22 tests (mutation run during this review). The shipped reader does take the first: `… | DONE | 2020-01-02 | OPEN |` reads closed and `… | OPEN | | DONE elsewhere |` reads open. Optional, and Tester-owned: end the quoted fragment on the OPEN cell — with `(the cell read `` `DONE | OPEN |` `` for a day)` the old and the shipped reader read 0 open and a last-wins reader reads 1.
6. **`scripts/lib/collect-meta.sh`:44** — the status test is exact, as row 290, ADR 0004 and the Planning gate asked, and it has a cost nobody wrote down. A Status cell reading `OPEN (blocked)`, `**OPEN**` or `REOPENED` was counted by the old substring test, by accident; now such a row is counted and listed nowhere, because the roll-up's ledger section is exact too, and the standing test shares the premise and cannot notice. No row does this today. It is the same silent class the story set out to close, reached through the Status cell instead of the Item. A lint on the table's Status cells would close it, and story #1's L15 already reads the table. Proposed row A.
7. **Test plan lines 58–61** — the limit is wider than its one example. Any Item text after the Item's second or later pipe that reads exactly `OPEN`, or starts with `DONE`, is taken for the Status: an open row that says `` `OPEN|DONE|DONE-LOCAL` `` reads as closed, and a DONE row that says `` `a|b` … `| OPEN |` `` reads as open. The old reader was wrong on the same rows, and no row does this today. The harmful direction, an open row read as closed, is caught by the standing test by id. Acceptable. Optional: one sentence saying so in the code comment or the test plan.
8. **Latent edges the old reader shares — no action here.** A caller under `set -e` together with `pipefail` dies on an undated row (both readers; no caller uses `-e`). A future Opened date gives a negative age. The Type test is a substring (`metadata` counts), which the story puts out of scope. A row with no Opened cell has its Status at field 5 and is counted by neither reader. A lowercase `open` is listed by the ledger section (`grep -i`) and counted by neither.
9. **Story line 144** — "Review: (filled in after Review phase)" is left as it is. Earlier review commits filled that line (`c6ed2b35`, `47b9cb00`), but the Reviewer's sanctioned writes here are this file and the Status line.

### Harness friction

1. **An acceptance criterion that asks a record to name "the PR" cannot be met when the Reviewer runs.** Per-phase commits put Review before the push. The practice is a follow-up commit after the verdict, which nobody reviews. Proposed row C.
2. **The review template still puts its closing section after the verdict**, where `scripts/lib/review-verdict.awk` reads it as the last token. Known: row 28 (OPEN; row 272 closed as its duplicate). This file places that section above the verdict. No new row.
3. **The full gate is red on this host for every branch** (row 289), so a reviewer can say nothing about it without comparing records suite by suite, and the set moves: the hand-off's "15 before and after" was 16 before. No new row; an amendment to row 289 is proposed below.

### Proposed ledger rows (for the orchestrating session to mint; none was added here)

- **Row A — `meta`.** **A Status cell that decorates `OPEN` hides a row from both read surfaces, silently.** Since `ledger-row-identity` #2 the meta reader takes as Status only a cell reading exactly `OPEN` or starting with `DONE`, as the roll-up's ledger section already did (`scripts/whats-open.sh:31`). A row whose Status reads `OPEN (blocked)`, `**OPEN**` or `REOPENED` is counted and listed nowhere, and the standing real-ledger test shares the premise, so it cannot notice. The old substring test counted such rows by accident. None exists today (330 rows: 235 `OPEN`, 94 `DONE`, 1 `DONE-LOCAL`). Fix shapes: a lint check that every table row has a Status cell reading `OPEN` or starting with `DONE` (row 157 needs the first-cell rule), or one sentence in `OPEN.md` § "How to use this ledger". Opened: 2026-09-19 (`ledger-row-identity` #2 review). Pointer: this review, finding 6; `scripts/lib/collect-meta.sh:44`.
- **Row B — `meta`.** **The guard test named "the first status cell is the row's Status" cannot tell first from last.** `test/session-start.test.js:237`: its fixture's last fragment itself starts with DONE, so a reader taking the last status-like cell passes all 22 tests. The shipped reader takes the first. Fix: end the quoted fragment on the OPEN cell (fixture in this review, finding 5: 0 open under the old and shipped readers, 1 under last-wins). Tester-owned. Opened: 2026-09-19. Pointer: this review, finding 5.
- **Row C — `meta`.** **An acceptance criterion that asks a record to name "the PR" cannot be met when the Reviewer runs.** Review comes before the push, so the PR does not exist; the practice is a follow-up commit on the PR branch (`949b6f29` for PR #690; `ledger-row-identity` #2 AC-6), which lands after the verdict and is reviewed by nobody. Fix shapes: Planning words such criteria as "names the story"; or `workflows/5-review.md` names the PR-number commit as a sanctioned step after the verdict and says who checks it. Opened: 2026-09-19. Pointer: this review, harness friction 1.
- **Amendment to row 289** (a suggested sentence is a claim — check it before writing it): on 2026-09-19 three Node 22.23.2 runs on this host (`20260919T191823Z-93037-b1b6`, `20260919T192940Z-82266-2dda`, `20260919T193955Z-27026-ef45`) failed the same 15 suites and the same 51 test names as run `20260913T062330Z-74080-b946`; in the first of the three, `adoption-candidates-queue` H1 also failed once ("not observed within 6s") and passed in the next two.

## Round 2 — the commits made after the verdict

**Date:** 2026-09-19
**Diff:** `git diff 206915b4..HEAD` — `9562a041` (follow-ups to round 1's findings) and `62e7bfa3` (the PR number) — and the review commit `206915b4` itself. HEAD `62e7bfa3` equals `origin/fix/meta-count-pipes`. PR #691 is open into `staging`, merge state CLEAN.

Round 1's "Outstanding before merge" item asked for this check. Every changed statement was re-derived from a command, wording that round 1 suggested included (`roles/reviewer.md` step 10). Two sentences of round 1 turned out to be wrong, and a third was an overstatement that a new ledger row inherited. R2-2 and R2-3 correct them; round 1's text above is left as written.

### What was run, and what was not

- `bash scripts/harness-lint.sh` at `62e7bfa3` → `harness-lint: clean (0 violations)`, exit 0. The output is identical to round 1's.
- `test/session-start.test.js` at `62e7bfa3`: 22 pass / 0 fail on Node v22.23.2 and on Node v16.17.0. On Node v22.23.2, `harness-stats` is 12 / 0 and the `harness-lint` suite 41 / 0.
- Two mutation runs of that suite in a scratch worktree of `62e7bfa3` (removed afterwards): against a reader that takes the last status-like cell, and against the old reader.
- One-row fixtures of my own through the old reader (`origin/staging`'s), the shipped reader, the roll-up's ledger-section test, and a copy of the standing test's oracle.
- **The full `npm test` was not run again on this host.** Since the round-1 gate run on `d37354e6` the branch changed one fixture string, the test plan, `OPEN.md` (row 290 and the new rows 331 and 332), this review, two lines of the story and one of the epic, and nothing under `scripts/`, `src/`, `ui/` or `firmware/`. A local run would be red again on the live suites of row 289; they were not re-run.
- In its place, CI's run on the same head. This is a line from the CI log, not a `gate:status` line, because CI's run record is not on this host. Workflow Test, run 35467509094, event `pull_request`, head `62e7bfa3`, ubuntu-24.04, Node v22.23.2, conclusion success:

  > `Overall: PASS — 2859 passed, 0 failed, 531 skipped across 206 suites` · `session-start: PASS (22 passed, 0 failed, 0 skipped)`

  It is the stack-free signal round 1 said was missing, and the first run of the new awk program on CI's toolchain. Which awk the runner used was not identified.

### The review commit `206915b4`

The review file is what round 1 wrote: 164 lines, and `git diff 206915b4..HEAD` shows no change to it. The story got its Status flip and its Review link, which closes round 1's finding 9. The epic's line for story 2 now reads Done, matching the story.

### Claims re-derived

1. **The strengthened guard (finding 5) — true.** `git diff 206915b4..HEAD -- test/session-start.test.js` is +3 / −1: the fixture string and a two-line comment. No assertion changed. The fixture, taken from the file at HEAD and not retyped, has status-like cells at field 6 (`DONE`) and field 8 (`OPEN`). It reads 0 open under the old reader, 0 under the shipped reader and 1 under the last-wins reader. The whole suite against the last-wins reader is now 21 / 1, and the one failure is this guard; in round 1 the same mutant passed 22 / 0. Finding 5 is closed.
2. **Row 290 — true, part by part.**
   - Chronology: eight commits touch the row. `d210b5ff` (2026-09-13, the row then numbered 283) has no trim text; `77d9437b` (2026-09-18) is the first whose new side has it.
   - Bold markers outside code spans: 24, even (23 in round 1).
   - `origin/staging`'s whole Item cell, 3861 bytes, is a contiguous substring of the row at HEAD. Against `origin/staging` only the Item and Pointer cells differ.
   - "PR #691" occurs twice, and PR #691 is this branch into `staging`.
   - The row has 9 fields, one status-like cell (field 6, `OPEN`) and an empty Done cell, and one row is numbered 290.
   - With locale variables unset, row 193 is still the only listed line that is invalid UTF-8 — at HEAD, on the Mac and in the container (111 lines; the two outputs are byte-identical, md5 `47785d8b…`).
   - The sentence on where the packet name lives matches what the repo shows. The board itself was still not read.

   AC-6's last clause is met, so round 1's "Outstanding before merge" item is closed.
3. **The test plan — the measured cases are true; one sentence is not (R2-1).** One-row fixtures, counts given as old reader / shipped reader / ledger section, with the true count in brackets:
   - An open row whose Item says `` `OPEN|DONE|DONE-LOCAL` `` [1]: 0 / 0 / 1.
   - An open row whose Item quotes a DONE table row [1]: 0 / 0 / 1.
   - A DONE row with `` `a|b` `` and then a quoted `` `| OPEN |` `` [0]: 1 / 1 / 1.
   - A DONE row whose Item quotes a whole OPEN table row [0]: 0 / 1 / 1. The shipped reader lists it as `[110d]`, the age of the quoted row's date.
   - An open row with `` `a|DONE-LOCAL` `` [1]: 0 / 1 / 1.

   So the coordinator's counter-example is real. A copy of the standing test's oracle, run on the same fixtures, fails with `dropped=[1]` on both open rows read as closed and passes on both DONE rows read as open, as the bullet says. "No row does any of this today" holds on the 332 rows at HEAD: the oracle from round 1 finds one status-like cell in every row except 157, and 111 open meta rows by the shipped rule, by the whole-line test and by stripping code spans first. "After a single pipe the new reader is safe" holds by construction: fields 4 and 5 are never scanned.

   The two new coverage-map lines are true. With the old reader under HEAD's test file the suite is 12 / 10: the nine red tests and the guard added at Implementation, which reports "1 open" — its first row, which has no pipe, is counted, and its second, which has one, is not. The strengthened guard still passes under the old reader.
4. **Rows 331 and 332 — true, with one overstatement that is mine (R2-3).**
   - Row 331's fixtures: `OPEN (blocked)`, `**OPEN**` and `REOPENED` each give 1 / 0 / 0 (old reader / shipped reader / ledger section); a plain `OPEN` gives 1 / 1 / 1.
   - Its distribution on the 330 rows of `d37cd575` is exact: 235 `OPEN`, 91 `DONE`, 3 starting with `DONE (` (rows 37, 120, 251) and 1 `DONE-LOCAL` with a note (row 35).
   - `scripts/lib/collect-meta.sh:44` is the status test, and `scripts/whats-open.sh:31` is the whole-cell test. The description of L15 matches ADR 0001, implementation note 8, parts (a) and (c).
   - Row 332: `949b6f29` did name PR #690 in row 330, the AC-6 quotation is exact, and the per-story workflow files, the README and the Reviewer and Implementer role files say nothing about a commit after the verdict.
   - Both rows have 9 fields, one status-like cell (field 6, `OPEN`), an empty Done cell and a unique id. `origin/staging` is still `d37cd575` with 330 as its highest id, and PR #691 is the only open PR that touches `OPEN.md`, so neither number collides today. The reader lists both as `[0d]`.
   - Nothing on `origin/staging` covers either: thirteen search patterns hit only rows 290 and 330 (for the exact-`OPEN` wording, neither about a decorated Status) and unrelated rows; no intake heading matches. That the coordinator searched first cannot be checked; that there was nothing to find can.
   - Row B was not filed because finding 5 was fixed instead, and row 289 was not amended; both are fine. The suggested sentence for row 289 stays a proposal.
5. **The count — nothing in the repo says the branch reads 109 now.** The digest at HEAD reads "111 open harness lesson(s), oldest 79d": the old reader gives 109 there and the shipped one 111, and the difference is still rows 70 and 244. Every "109" in the files this branch touches is tied to a commit or a measurement: the story's table ("Measured on `origin/staging` `d37cd575`"), AC-5 ("107 → 109 on `d37cd575`"), the test plan's recipe ("before the row 290 edit") and its transcript from `8e36b40a`, the CHANGELOG row (the effect of the change), row 290's fix record (a past measurement) and round 1 of this review (`d37354e6`). The PR description states 111 and why.

### Does the counter-example change the verdict or the calibration?

The verdict, no. The calibration, yes, and round 1 stated it wrongly.

Round 1 treated every wrong answer of the shipped reader as one the old reader shared, apart from finding 6 and two contrived cases. That is false. The old reader read field 6 and nothing else; the shipped one reads from field 6 rightwards to the first status-like cell. Whenever that first cell is a piece of text and not the row's Status, and says the opposite, the shipped reader is wrong — and the old reader was right on the same row whenever field 6 by itself gave the right answer. That is a small family of regressions, not a latent edge the two readers share.

It does not block, for these reasons:

- It is the case the test plan listed as not covered by design before any code was written, under a rule measured on every row and ratified at the Planning gate. The alternatives measured then fail on real rows (48 and 157); this one fails on none of the 332.
- The harmful direction, an open row read as closed, turns the standing test red with the row's id. That holds for the regression cases too (P3 below).
- The direction nothing notices is an over-count: a DONE row listed among 111 open ones, in an inbox whose banner fires at 3.
- The numbered table is frozen when story #1 lands, so the exposure is the rows written until then and later edits to old ones.

What nobody knew at either gate is that the old reader got some of these rows right. The operator should know it when merging; the PR description says so, too narrowly (R2-1).

### Findings (round 2)

#### Blocking

None.

#### Non-blocking

R2-1. **Test plan lines 69–71 — "the one place where the old reader was right and the new one is wrong" is false.** The quoted whole row is one instance of a family. Measured, same notation as above:
   - P1, a DONE row with `` `a|b|c` `` and then a quoted `` `| OPEN |` `` [0]: 0 / 1 / 1. No whole row is quoted; the stray `OPEN` lands on field 7.
   - P2, a DONE row whose Item holds `` `a|b|c|OPEN|d` `` [0]: 0 / 1 / 1.
   - P3, an open row whose Item is `p|q|see OPEN.md|DONE rows were miscounted` [1]: 1 / 0 / 1. The old reader was right by luck, the shipped one is wrong, and it is the harmful direction. The standing test's oracle catches it (`dropped=[1]`).
   - Round 1's two cases outside the Item belong here as well: a Status of `PARKED` with a later cell reading exactly `OPEN`, and a row of another table.

   The dividing line is the field the stray text lands on, not whether a whole row is quoted: on field 6 both readers are wrong (the `` `a|b` `` case); to the right of it only the shipped one is, as long as field 6 does not itself mention `OPEN`. The bold rule at the top of the bullet is complete and correct about the shipped reader; only this comparison with the old reader is too narrow. The PR description repeats it ("One case is new with this change"). It leads nobody to a wrong action, and the old reader stops existing at the merge, so it is held to the bar round 1 applied to findings 2 and 7. It is still a false sentence in the record that the book-close audit will harvest. Ask: reword it on this branch, and the PR description with it. A suggestion, which is a claim to check and not text to paste: "Where the stray `OPEN` lands on the sixth field (`` `a|b` `` and then `` `| OPEN |` ``) the old reader counted the row as well. Where it lands further right — a quoted whole row, or a quoted `` `| OPEN |` `` after three pipes — the old reader was right, by luck: it never looked past the sixth field. The mirror image exists for an open row (field 6 mentions `OPEN.md`, a later piece starts with `DONE`), and the standing test catches that one."
R2-2. **Round 1 of this review — two sentences corrected.** § Attempts to break the reader said "Where the shipped reader gave a wrong answer, the old reader gave the same wrong answer or a worse one", with exceptions that left this family out. Finding 7 said "The old reader was wrong on the same rows"; that is true of its two examples and false of the class. My round-1 fixtures put a quoted DONE row inside an open row and a lone `` `| OPEN |` `` after two pipes, and never a stray `OPEN` to the right of field 6 in a DONE row. The coordinator found it.
R2-3. **`OPEN.md`:394 (row 332) — "Per-phase commits put Review before the push" and "cannot be met when the Reviewer runs" overstate, and the wording is round 1's** (harness friction 1 and proposed Row C). No file orders the push and the Review: the per-story workflow files, the README and the two role files never say when a branch is pushed or a PR opened. What is true is what happened here: the review commit is from 20:22:36Z, the branch first reached `origin` at 20:27:59Z and PR #691 was created at 20:28:22Z (GitHub's activity API). Optional rewording: "Nothing in the per-story workflow says when a branch is pushed or a PR opened; in this story both came after the Review commit, so no PR existed at review time." A third fix shape follows from it: open a draft PR before Review.
R2-4. **Test plan line 73 — "shows in "Meta items" as a row whose own text says DONE"**: in `OPEN.md`, yes; in the list, no. A listed line is cut at 150 bytes, and among the 111 open meta rows the Status cell never starts that early; the nearest is at byte 310. The list would show the row's id, the start of its Item and an age taken from the cell before the stray `OPEN` (`[110d]` for the quoted row's date, `[?d]` in P1). So this direction is quieter than the sentence suggests. For whoever takes row 331: on these fixtures an oracle that strips code spans before reading field 6 gets every backticked case right in both directions, and on today's 332 rows it agrees with the reader; it gets P3 wrong, whose pipes are not in a code span.
R2-5. **Small.** `engineering-team/epics/ledger-row-identity.md`:40 now reads Done and still says "(rows 70 and 244 are missing today)". Row 331 calls a decorated `DONE` "common"; by its own numbers it is 4 of the 95 closed rows. Test plan line 27 calls the Implementation test a guard and says it is red on the old reader, while the plan's opening defines a guard as passing before and after; the line is honest about it.

Any commit that answers R2-1 is again a commit after the verdict, which is row 332's subject. The check is small: the eight one-row fixtures above, through the two readers.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place; `git diff` shows that one line and nothing else in the story file.
- [x] Completion detection performed; the result is reported in the chat, not in this file.

## Verdict

**PASS**

The diff does what the story asks and no more. The reader is correct on every real row and on every fixture that the old reader got right; the two missing rows appear, and nothing else moves. The one deviation is sound and better argued by the evidence than by its own log entry. The gate run is red, and it is red for reasons recorded six days before this branch, in suites and tests this diff does not reach. One clause of AC-6 — the PR number — waits for a PR to exist and must land before the merge.

Round 2, 2026-09-19, on `62e7bfa3`: the verdict stands. The AC-6 clause named above is met by `62e7bfa3`. What round 2 found — one false sentence in the test plan, and two wrong sentences and one overstatement in round 1 of this review — is in § Round 2, and none of it blocks.
