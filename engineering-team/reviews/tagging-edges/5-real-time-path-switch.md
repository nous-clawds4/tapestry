# Review: Story 5 — The real-time path's switch, on the panel

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-01
**Diff:** `git diff c557177f..ad473772` on `feat/tagging-edges-5`:
- the ADR, `8a082b75`, with its in-place amendments to ADRs 0002, 0003 and 0004 and to story 3;
- the failing tests, `b6726818`;
- the implementation, `5d14cc16`;
- the gate evidence, `ad473772`.

**How it was reviewed.**
- Five reviewers, read-only, each took one dimension: the server, security and privacy, the panel and its copy, the
  spec and its tests, and the docs and ADR amendments.
- A sixth agent ran the gates independently.
- Every finding then went to skeptics who tried to refute it: three for a blocking finding, one for any other.
- Of 23 findings, 22 stood and 1 was refuted. Two of the 22 concern code outside this story and are handled privately.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`, run by the Reviewer:** `20261002T015414Z-31270-e1b3 [story5-review] … on ad473772 — FAIL, exit 1,
  4954 passed, 31 failed, 168 skipped, 255/255 suites`.
  - **Story suites:** all pass.
  - **12 failing suites** are this host's standing live-stack set: the same 12 as story 3's review records, such as
    `20260930T004706Z-57038-50d9`.
  - **The 13th, `gate-result-record`, fails because of this story.** See blocking 1.
- [x] **Story suites, run independently** through `run()` on Node 22.23.3 and on host Node 16.17.0, with the same
  result: 15 suites, 720 passed, 0 failed.
  - On a `git archive` of `b6726818`, the red set matches the test plan's Verification table exactly.
  - `git diff b6726818..ad473772 -- test tests` is empty.
- [x] **`npm run test:playwright`:** `tests/brainstorm/tagging-pipeline-panel.spec.js` passes 85 of 85, twice, with no
  flake. It ran against the UI built inside the container from the committed tree.
- [x] **`scripts/harness-lint.sh`:** exit 0.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] **Every acceptance criterion has a passing test** (the test plan's coverage map, checked against the tests):
  - AC-1, the control and the 15 s limit;
  - AC-2, the prompt and its variants;
  - AC-3, the starting window;
  - AC-4, who may;
  - AC-5, the record and who may read it;
  - AC-6, nothing else moves.
- [x] **No criterion is silently dropped.**
  - Both accepted residuals are pinned (SR23, SR27).
  - So are the Product Owner's ratified proposals: 10 entries, a short key, who readable only by the owner or an
    admin, the warning, the 60 s window, the 15 s limit.
- [x] **No behaviour beyond the story.**
  - The admin widening reaches only the switch. The confirm route keeps its owner-only check, and admin management
    stays owner-only.
  - Story 4's copy carry-forwards R2-1 to R2-6 are in.
  - R2-2, R2-4 and R2-5 are copy that no test pins. This is accepted, as the test plan intends.
- [ ] **Evidence is not yet accurate.** § Evidence calls `gate-result-record` a standing failure. See blocking 2.
- [ ] **The ratified staging evidence is not yet recorded.** It comes after the merge. See requested change 13.

## ADR adherence

- [x] **Files match ADR 0005's implementation notes.** The engine (`realtime/index.js`) and `run.sh` are unchanged.
  The store only gains methods and keys.
- [x] **D1–D11 hold on a line-by-line walk:**
  - D2's order and its failure matrix;
  - D3's states, including the unrecorded-off row kept through later folds;
  - D4's `onSince`;
  - D6's read order;
  - D7's boundaries (59 999 ms in the window, 60 000 ms out);
  - D9's chain: a throwing step answers 500, and the next request succeeds;
  - D11's answers.

  The departures are the ones logged in story 5 § Deviations.
- [x] **D12–D14** (the panel) hold. The 15 s rule clears the control at once on an unknown answer.
- [x] **No new dependencies.**

## Concept-graph integrity

- [x] **No concept or schema change,** so no firmware reinstall. No handle is constructed.

## Things tests can't catch

- [x] **No secrets in committed files.**
- [x] **No leftover debug logging.** No handler logs who (SR46).
- [x] **No commented-out code.**
- [x] **Error paths are handled.** Every admitted request is answered once, and nothing escapes to Express.
- [x] **Concurrency.** The single promise chain serialises changes in admission order, and refusals never join it. The
  control panel runs as one process.
- [x] **Security.**
  - Both switch-path routes sit behind `requireOwnerOrAdmin`, plus the handler's re-check (`ownerOrAdmin`, including
    `sameHost`).
  - A loopback request without a session gets 401.
  - The body takes only a boolean `on`.
  - Who never reaches a public answer.
  - History entries are rebuilt to `{on, at, role, key}`, so no full pubkey is served.

## House rules check

- [x] **Concept Graph API authority respected** (not touched).
- [x] **No new lint, typecheck or build tooling.**

## Findings

### Blocking

1. **`test/tagging-edges-switch-record.test.js:1350` (SR34, from `b6726818`).**
   - **The problem.** It derives its expected status with `c.want1.success ? 200 : 500`. `gate-result-record`'s
     static guard C9 refuses that pattern in every test file (row 263), so that suite goes from PASS 34/0 to FAIL
     33/1.
   - **Why it blocks.** C9 needs no stack, so CI's required `stack-free` job would fail the PR to staging.
   - **Asked change, for the Tester.**
     - Give each SR34 case row its own expected status (`status1: 200` or `status1: 500`), and assert against it.
     - Do not derive the status from `want1.success` in any spelling: a rewrite that dodges the regex would defeat row
       263's intent.
     - Leave SR34's assertions and C9 unchanged.
     - Run `gate-result-record` (34/0) and `tagging-edges-switch-record` through `run()`.
2. **`engineering-team/stories/tagging-edges/5-real-time-path-switch.md:272-273` (§ Evidence, the gate).**
   - **The problem.** It says the 13 suites failing in both runs are "this host's standing live-stack set". They are
     not: the standing set is 12. `gate-result-record` was red in both runs because the baseline was taken at
     `b6726818`, which already held SR34. The test plan's Verification ("No regressions") makes the same omission.
   - **Asked change.** After the fix, re-run the full gate on the committed tree, then correct § Evidence and the test
     plan:
     - Compare the non-story suites against a baseline from before the story, `c557177f`.
     - Name the 12 standing suites, and say that `gate-result-record` went red at `b6726818` and green after the fix.
     - Quote the per-suite numbers inline, because the run records are local files. The `b6726818` baseline record was
       kept in the session scratchpad.

### Requested in this round (non-blocking: accuracy fixes on an operator panel and in docs)

Each is small. They are asked now, while the story goes back for blocking 1 and 2.

1. **`ui/src/utils/taggingPipelineView.js:215` (R2-1, `no-status`).**
   - **The problem.** The sentence opens with "Every error the Neo4j driver raises carries a code". That is false:
     the driver throws code-less `TypeError` and `Error` from its own checks of what it is passed (ADR 0004
     T12, amended).
   - **Asked change.** Keep the conclusion and state the premise truly, in plain words, re-derived from
     `neo4j-driver-core/lib/error.js` and `internal/util.js`. Optionally, have PC55 refuse the old claim.
2. **`ui/src/pages/settings/taggingPipeline/PassSection.jsx:85-87` and `taggingPipelineView.js:232` (R2-6).**
   - **The problem.** "The relay command's last output" labels `stderrTail`. That is the last `strfry error:` line, or
     else `exit code N`.
   - **Asked change.**
     - Relabel it, for example "The relay command's last error line, or its exit code".
     - Make `failureCode.exit` say the output "may say why".
     - Reword `process-error`, so it does not promise output that is usually missing.
3. **`taggingPipelineView.js:195` and `:226` (R2-1, `N/A`).**
   - **The problem.** "NEO4J_URI or its TLS setting in /etc/brainstorm.conf" names a setting that does not exist.
     TLS is chosen by `NEO4J_URI`'s scheme.
   - **Asked change.** Name only `NEO4J_URI`, and its scheme (`bolt://` against `bolt+s://` or `neo4j+s://`). Keep the
     literal `NEO4J_URI` so that PC51 still passes.
4. **`taggingPipelineView.js:494-501`.**
   - **The problem.** The refused and failed outcome sentences stay under the control, but speak in the present tense
     ("it is still on as before"), and can sit beside a later, contradicting state.
   - **Asked change.** Put them in the past tense, tied to the attempt ("it was still on", "its state was unchanged"),
     and correct the § Deviations line. Leave `unknown` as it is.
5. **`ui/src/pages/settings/taggingPipeline/TaggingPipelinePanel.jsx:178` and `ScheduleSection.jsx:22-24`.**
   - **The problem.** The off prompt says the schedule list "could not be read" while its first read is still loading.
   - **Asked change.**
     - Pass a pending flag through, so a loading read says the backstop is still being checked.
     - Keep "could not be read" for a failed read, and fix the JSDoc at `:18-19`.
     - Add a one-line note to ADR 0005 D13, matching D14's "none while loading".
     - Optionally, add a browser case beside B57.
6. **`taggingPipelineView.js:498-501` and `:524-527`.**
   - **The problem.** A failed change with no `body.code` (a proxy 502, or a 404 from an older backend) gets the
     data-volume remedy and claims the state is unchanged. But that answer never came from the switch.
   - **Asked change.**
     - Give a code-less failure its own sentence, per target. It should not claim the state, should say the state shown
       is from the next read, and should point at the fetchCode http family's remedy.
     - Note this as a D12 refinement in ADR 0005.
     - Extend TV81 with a body-less 404 and 502.
7. **`OPERATIONS.md:788`, and story 5 § Deviations, "The 403 text".**
   - **The problem.** The admin list the server checks is `adminPubkeys` in `/var/lib/brainstorm/settings.json` when
     that list is non-empty (the one `POST /api/admin/add|remove` writes), and only otherwise `BRAINSTORM_ADMIN_PUBKEYS`
     (`src/utils/config.js:99-112`).
   - **Asked change.** Say that in both places. Keep "re-read on every request".
8. **`OPERATIONS.md:788`.**
   - **The problem.** "as a quick off then on does" overstates the wait. `run.sh` waits only when the run that the off
     ended was shorter than 60 s.
   - **Asked change.** Drop the example, as BIBLE §11 does, or describe the case that actually waits.
9. **`OPERATIONS.md:790` and `BIBLE.md:671`.**
   - **The problem.** They describe `latest` as `{ on, at, role, key }`, but it is null for `never-switched` and
     `switch-unreadable`.
   - **Asked change.** Say so, and tell readers to branch on `state` first.
10. **ADR 0005 D6 and `BIBLE.md:671`.**
    - **The problem.** "no foreign page can read who" states more than the code enforces.
    - **Asked change.** State the rule as written: refused, like the POST, when `Origin` names a hostname other than
      `Host` (`sameHost`).
11. **Line references that drifted.**
    - **ADR 0004's story-5 amendment notes** (`:255`, `:345`, `:834`, `:835`) cite code lines this story then moved.
      Cite them by function or construct, with the line at the new tip.
    - **Story 3's amendment note** (`3-real-time-path.md:261`) cites `:444`, which its own insert moved to `:452`. Cite
      it by name.
12. **`test/tagging-edges-switch-record.test.js:600-617` (SR4), for the Tester.**
    - **The problem.** Two `switchEntry` readings logged in § Deviations are unpinned: a version 1 record with
      `role: null`, and a version 2 off with no `onSince`, both read as not recorded.
    - **Asked change.** Add a row for each, expecting `{on, at: null, role: null, key: null}`.
13. **Story 5 § Evidence.**
    - **Dates.** Date the gate heading as the other sections are (2026-10-01, with the UTC run ids kept).
    - **The baseline.** Say what made the baseline worktree dirty: an untracked `node_modules` symlink.
    - **Staging.** Add an "After the merge to staging" marker that lists the ratified staging evidence:
      - the owner and an admin each turn the path off through the prompt, and on, and the history shows both;
      - a direct request from someone who is neither is refused, and gets no who;
      - the path catches up;
      - production's path is not switched.

      A Staging section holding these must exist before staging is promoted to main.

### Non-blocking (follow-ups, not asked in this round)

1. **`PathSwitch.jsx:113-115`.**
   - **The problem.** Focus moves to Cancel when the prompt opens, but nothing returns it when the prompt closes.
   - **The fix, when made.** After Cancel, return focus to the control. After a self-close, do not focus "Turn on",
     which sends without a prompt.
   - It is optional in this round, and otherwise goes to story 6.
2. **R2-4's rendering guard** (`DriftSection.jsx:88`) has no browser pin. An extension to B43 would cover it.
3. **Two pre-existing hardening items in shared request handling,** outside this diff. They are recorded privately for
   the owner, not here.

### Harness friction

1. **The full-gate baseline was taken at the failing-tests commit,** so a regression the story's own tests introduced
   showed in both runs and was called standing. It is filed as ledger row
   `2026-10-02-gate-baseline-hides-story-regressions` (meta).

## Verdict

**CHANGES_REQUESTED**

The implementation matches the story and ADR 0005, and every story test passes. Two things block the merge:
- **SR34.** One test line in the new suite breaks a stack-free source guard. The PR cannot pass CI's required check
  until it is fixed (blocking 1, for the Tester).
- **The evidence.** The story's evidence mislabels that failure as a standing one (blocking 2).

Requested changes 1–13 are accuracy fixes, asked in the same round. Back to `/implement-feature`:
- the Tester for blocking 1 and requested change 12;
- the Architect for the ADR notes in requested changes 5, 6, 10 and 11;
- the Implementer for the rest.


## Re-review, round 2 (2026-10-01)

**Diff:** `git diff ee170bf0..442c9dec`:
- the ADR notes, `e7b488ed`;
- the tests, `43dfbb78`;
- the implementation, `c7ceb404`;
- the test plan, `078aa6c3`;
- the evidence, `442c9dec`.

**How it was reviewed.**
- Three checkers re-derived every review-1 item from commands and code, as reviewer rule 10 asks; no adopted wording
  was taken on trust.
- A fourth hunted for new problems in the fix round.
- A fifth ran the gates independently.
- Every finding went to a skeptic.
- Of 16 findings, 15 stood, all non-blocking, and 1 was refuted. After deduplication they are the 10 carry-forwards
  below.

### Quality gates (run by reviewer, not trusted)

- [x] **`npm test`, run by the Reviewer:** `20261002T032541Z-14421-8456 [story5-review2] … on 442c9dec — FAIL, exit
  1, 4956 passed, 30 failed, 168 skipped, 255/255 suites`, on a clean tree.
  - **Matches the fix round's run.** It is identical, suite by suite, to `20261002T030856Z-37748-d97b` on
    `078aa6c3`.
  - **Only the standing set fails.** The 12 standing live-stack suites fail, with the same counts as the pre-story
    baseline `20261002T023413Z-26270-9616` on `c557177f`.
  - **`gate-result-record` passes,** 34 of 34.
- [x] **Story suites, run independently** through `run()` on Node 22.23.3: 13 suites, 644 passed, 0 failed.
  - Host Node 16.17.0 gives the same, except that `stack-free-npm-test` skips G2 (carry-forward 1).
  - `git diff 43dfbb78..442c9dec -- test tests` is empty.
- [x] **`npm run test:playwright`:** `tests/brainstorm/tagging-pipeline-panel.spec.js` passes 86 of 86, twice, with
  no retries, against the UI built inside the container from the committed tree at `442c9dec`. B82, the round's new
  case, passes.
- [x] **`scripts/harness-lint.sh`:** exit 0.

### Review 1's asks

| Item | Now |
|---|---|
| Blocking 1, SR34 against C9 | Fixed. No file C9 scans matches its pattern. SR34's rows carry literal statuses and assert exactly what they did. A failed on answering 200 still fails SR34. |
| Blocking 2, the evidence | Fixed. Every number, run id and suite name in § Evidence "The gate" matches the run records, and the 12 standing suites match story 3's record `20260930T004706Z-57038-50d9`. |
| Requested 1–6, the panel copy | Fixed. Each new sentence was re-derived from the code it explains; none is false. PC55, TV82 and B82 fail on the old copy. |
| Requested 7–11, the docs and ADR notes | Fixed. Every re-pointed ADR 0004 citation lands on its named construct at `442c9dec`. |
| Requested 12, the SR4 pins | Fixed. Each row fails under its own mutation, and only there. |
| Requested 13, the evidence markers | Fixed. The dirty explanation was reproduced: a fresh worktree made the same way shows exactly `?? node_modules`. |

### Carry-forwards (non-blocking; for the owner to place)

1. **The test plan's "the same results on both" Node versions** (`5-real-time-path-switch.test-plan.md:286`, `:294`)
   is not true of `stack-free-npm-test`: on Node 16 it skips G2. Say so.
2. **C9 is described more broadly than its regex**
   (`test/tagging-edges-switch-record.test.js:71-72`, `:1362-1363`; test plan `:262-266`).
   - C9 refuses the `? 200 : 500` spelling in the files it scans. The row's literal status, not C9, is what keeps SR34
     from deriving its status in another spelling. Say that.
   - The "When." bullet should read "no file C9 scans", since C9's own file matched at both commits.
3. **The test plan's PC55 reading** is narrower than the regex's real exemption (`test/tagging-pipeline-codes.test.js:930`).
   State the exemption as the code has it.
4. **The pending-schedule flag counts only the first read**
   (`ui/src/pages/settings/taggingPipeline/TaggingPipelinePanel.jsx:214`).
   - During a Retry after a failed read, the Schedule section shows loading while an open off prompt still says the
     backstop could not be checked.
   - Count any read that is loading as pending, or word ADR 0005 D13's note to match. D14 shows nothing during any
     loading, so the note's analogy does not hold as built.
5. **Story 5 § Deviations still gives the failed-on remedy as "free space and is writable"** (`:411-412`, also `:397`).
   OPERATIONS §12.9, the panel and D12 now say "read or written … readable and writable".
6. **The `no-status` premise could be tightened** (`ui/src/utils/taggingPipelineView.js:215`):
   - it reads, at first, as "failures that Neo4j answers with a code";
   - it leaves out the driver's own internal-invariant throws, which are driver bugs.

   Optional: name "a fault in the driver itself" beside "another library", and match ADR 0004 T12.
7. **ADR 0005 D5's "a removed admin is refused on their next request"** (`:332-333`) lacks §12.9's caveat. A removal
   that empties settings.json's `adminPubkeys` falls back to `BRAINSTORM_ADMIN_PUBKEYS`, which may still name that
   admin. Add a dated note.
8. **The 403 explanation gives only the mismatched-hostname branch** of `sameHost` (`BIBLE.md:671`,
   `OPERATIONS.md:788`, ADR 0005 D6's note). `sameHost` also refuses an `Origin` that does not parse, such as
   `Origin: null`. In `ownerOrAdmin` it is the last check, so "goes on to the other checks" is slightly off. Word it
   as the code is.
9. **The round-1 notes carry two dates.** The six ADR notes say 2026-10-02 (UTC). The test plan and story 5 say
   2026-10-01 (local), the convention requested change 13 chose. Use one.
10. **§ Evidence's browser line** (`5-real-time-path-switch.md:301-302`) names no commit. This re-review's own run on
    `442c9dec` (86 of 86, twice) can be cited.

### Harness friction

1. None new this round. Round 1's is filed as ledger row `2026-10-02-gate-baseline-hides-story-regressions`.

## Verdict (round 2)

**PASS**

Every blocking item and every requested change from round 1 is fixed. Each was confirmed against the code and the run
records, not taken from the fix round's account. The story's suites pass, the browser spec passes 86 of 86, and the
full gate shows only the 12 standing live-stack failures, the same as before the story. The 10 carry-forwards are
wording, date and one minor UI corner, none a change to data or to who may act. The ratified staging evidence (story 5
§ Evidence, "After the merge to staging") must exist before staging is promoted to main.
