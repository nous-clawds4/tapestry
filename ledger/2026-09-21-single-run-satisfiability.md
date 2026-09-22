# Test Design proves a browser test satisfiable with one run, which can miss a test that races or cannot fail

**Id:** 2026-09-21-single-run-satisfiability
**Type:** meta
**Opened:** 2026-09-21 (setup-status-and-alert #3, review round 2, harness friction 2)
**Status:** OPEN
**Done:** —

**What happened.** Story 3's round-2 P3 import test (`tests/brainstorm/setup-alert-polish.spec.js`) was
declared satisfiable after one run each:
- the Tester's run on a throwaway implementation;
- the Implementer's runs;
- the round-2 reviewer's first run.

**What only the reviewer's later checks found:**
- `--repeat-each` showed a race: it failed 3 of 30 runs on correct code. The pill it waits to see gone is also
  hidden during the re-check, so the read count was checked too early.
- A stale final answer in the mock still passed 6 of 20 runs, so its last check did not bite.

The Map-editor test beside it, which checks the read count first, caught the stale answer 20 of 20.

**Fix shape.** When a browser test waits for a state that can also appear while the behaviour is still running (here,
the pill hidden during `checking`), do two things before calling it satisfiable:
- run it with `--repeat-each` (20 or more) on the oracle build;
- mutate the mock's final answer to the stale one, and confirm the test fails.

This could go in `engineering-team/roles/tester.md`, or as a line in the test-plan template's verification section.

**Two more clauses (setup-status-and-alert #3, review round 3).** The two steps above catch a check that passes
too early. They do not catch a check for a state that the code under test never produces.
- **A "never shows X" check needs a code mutant that keeps showing X.** Story 3's P3 Follow checks that the pill
  never shows the old count during the re-check. Its recorder logs only changes, so a provider that simply keeps
  the old answer leaves no entry and the check passes. A stale answer from the mock cannot exercise this: it is
  still an answer, and the clause is about the time before any answer arrives. Only a two-line provider mutant
  showed the check was vacuous. That mutant passed all 86 browser tests of stories 1–3.
- **Serve the stale answer late as well as at once.** Served at once, story 3's stale answer was caught 300 of 300
  times. Served 300 ms late, it passed 90 of 90, because the pill is hidden while the check runs, and a "no pill"
  check passes then.

**Pointer:** `engineering-team/reviews/setup-status-and-alert/3-setup-alert-polish.md` § Round 2, Blocking 1 and
Harness friction 2.
