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

