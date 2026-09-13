# Story 1: A gate run's result tells the truth, however it was run

**Status:** Approved
**Created:** 2026-09-12
**Type:** Feature

## Background

The test gate (`npm test`) is the evidence the whole harness stands on: the Tester's red, the
Implementer's green, the Reviewer's independent run, Director Gate 4, and the book-close
certification. Today the gate's report of its own run can be wrong in five observed ways, each
recorded in OPEN.md:

1. **A failing run can be recorded as a pass.** The full live run takes ~24–32 minutes, more than
   the session shell's 10-minute foreground limit, so it is routinely launched in the background —
   and the background-completion notice has reported exit code 0 for runs that ended
   `Overall: FAIL` at least ten times (rows 103, 105, 111). The documented workaround, reading a
   pipe-status variable, silently yields nothing in zsh, this machine's shell (row 111); piping the
   run through `tail` replaces its exit code and discards the failing line (row 157, five
   sightings). Whoever trusts either records a green gate that was red.
2. **One unexpected error erases the whole verdict.** If any single suite throws — for example, a
   request to a service the host doesn't run — the runner prints `Test runner crashed` and exits.
   Every later suite goes unrun and no `Overall:` line is printed at all (row 192).
3. **A stopped run has no honest ending.** An interrupted run (Ctrl-C, a tool timeout, a deliberate
   stop to avoid racing another session) can end its log on a fabricated server error — "got 500,
   expected 200" — when the real cause is an empty response from the interrupted call (row 263). A
   run killed outright leaves nothing of its own behind at all.
4. **The totals don't add up, and skips can hide.** Of the 196 registered suites, 36 are missing
   from the skipped total and 4 are counted two or three times (row 235; measured 2026-09-12). Many
   per-suite lines print only passed and failed counts, so a suite whose live tests all skipped
   reads PASS — indistinguishable from one whose live tests ran (rows 104, 106).
5. **A slow run looks like a hung one.** Launched through `npm test` with its output going to a
   file, a run has shown zero bytes for 20 minutes while progressing normally; it was killed as
   presumed-hung, discarding the work it had done (row 227).

**Who is affected:** everyone who runs or reads a gate — Tester, Implementer, Reviewer, Director,
the book close — and the operator who approves on that evidence. The re-runs are the visible cost;
the larger one is that a gate whose report can be wrong trains everyone to discount it, and then a
true red is indistinguishable from noise.

This is story 1 of the `honest-test-gate` book. It covers the runner's report of its own run.
Fitting the gate inside a session, environment-aware skips, and the assertion sweep are later
stories in the same book.

## User-facing description

As anyone who runs the test gate — a person, a role in a session, or a background job — I want a
run's verdict, exit status and progress to be true, and readable afterwards, no matter how the run
was started or how it ended, so that "the gate passed" is a fact I can act on rather than a claim I
have to re-verify.

## Acceptance criteria

- [ ] **AC-1 — The result can be read back, however the run was launched.** Given the gate is
      launched in the foreground, piped into another command, or in the background — from bash or
      from zsh — when the run ends, then one documented place holds its verdict and exit status,
      matching what the runner itself decided (a failing run: FAIL and a non-zero status; a passing
      run: PASS and zero). The record says which run it belongs to — when it started, on which
      commit, and whether the tree had uncommitted changes — so a leftover record from an earlier
      run can't be mistaken for this one. Two runs overlapping on the same checkout each leave their
      own readable record, and no run leaves anything for `git status` to report.
- [ ] **AC-2 — A run that doesn't finish says so.** Given a run is stopped before it completes —
      interrupted from the keyboard, terminated, or killed by a tool's time limit — then its record
      never reads PASS: it reads INTERRUPTED with how many suites had finished, if the run could
      still say so, or shows the run as started and unfinished if it was killed outright. It never
      shows the previous run's result instead, and any exit status it returns is non-zero.
- [ ] **AC-3 — Nothing erases or invents a result.** Given one suite throws an unexpected error (for
      example, a request to a service the host doesn't run), then that suite is reported FAIL with
      its error, every remaining suite still runs and reports, and the final verdict and exit status
      are still produced. Given a live test gets no response at all from the stack, its failure says
      there was no response; it never reports an HTTP status the stack didn't send.
- [ ] **AC-4 — The numbers add up, and skips are visible.** Given any run, the printed totals of
      tests passed, failed and skipped equal the sums of the per-suite counts — no suite left out,
      none counted twice; every per-suite line shows its passed, failed and skipped counts; and the
      final verdict line states the skipped total, so a green run in which live tests were skipped
      is visibly different from one in which they ran.
- [ ] **AC-5 — Progress is visible while it runs.** Given the gate is started through `npm test` or
      directly, with its output going to a terminal, a file or a pipe, when a suite finishes, then
      that suite's result line is in the output within 5 seconds — so a watcher can tell a slow run
      from a hung one.
- [ ] **AC-6 — Everyone reads it the same way, and nothing regressed.** Given every doc, role,
      agent definition, template or skill in the repo that tells someone to run or read the gate,
      then each points to reading the result from the AC-1 record, and none tells anyone to trust a
      background-completion notice or a piped exit status. A full run of this change is Overall
      PASS with every registered suite still feeding the verdict, and the CI stack-free job stays
      green. OPEN.md rows 103, 105, 111, 157, 227, 235 and 263 are flipped DONE; rows 104, 106 and
      192 record that their runner half shipped (their remaining half is story 3).

## Concepts touched

None. Test and harness infrastructure only — no concept-graph handle is read, defined or changed.

## Out of scope

- **Fitting the gate inside a session** — the 24–32-minute runtime and a story-scoped gate that
  actually scopes (rows 83, 181, 271). Story 2.
- **Deciding when a suite should skip** because its environment is missing — the trusted-lists
  publish guard, Meilisearch, the live-stack probe (rows 104/106, 191, 192). Story 3. This story
  only guarantees that a suite's unexpected error can't erase the run.
- **Fixing individual assertions that report the wrong result** (rows 59, 60, 108, 109, 126) —
  `test-suite-hermeticity` #2, in the same book.
- **The background-completion notice itself.** It belongs to the session tool, not this repo; this
  story makes it irrelevant rather than fixing it.
- **Playwright** (`npm run test:playwright`) — a separate runner; its "zero tests ran, exit 0" edge
  (row 114) is not covered here.
- **Changing which suites CI runs.** CI must keep passing; its composition is not this story's.
- **Rows 75 and 141.** They describe the brackets `test-suite-hermeticity` #1 already fixed (row
  150); flipping them is housekeeping, not delivery.

## Open questions

- **Overlapping runs — resolved at the planning gate (2026-09-12): allowed.** A second run on the
  same checkout proceeds, and each run keeps its own record (AC-1), because co-tenant sessions and
  independent Reviewer runs are routine here. Refusing a second run with a message naming the one in
  progress was considered and not chosen.
- Where the record lives, its format, and how a run killed outright is recognised are the
  Architect's calls, constrained by AC-1 and AC-2.

## Linked artifacts
- Book: `engineering-team/audits/honest-test-gate/book.md`
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
