# A lint verdict read from its stdout instead of its exit code, and row 157's remedy does not reach the lint

**Id:** 2026-09-20-lint-verdict-taken-from-stdout
**Type:** meta
**Opened:** 2026-09-20 (round-5 review of `harness-lint` L16, non-blocking; proposed by the Reviewer, filed by the caller under the row-80 sweep)
**Status:** OPEN
**Done:** —

On 2026-09-20 a commit landed on `docs/open-md-one-table` while `harness-lint` was **red**, and was
pushed. The command was `bash scripts/harness-lint.sh | grep -E 'VIOLATION|harness-lint:' && git add
… && git commit …`: `grep` found the violation line, exited 0, and the `&&` chain read that as
success. The lint's own exit code — 1 — was discarded by the pipe. CI caught it one push later (run
35514430338, `harness-lint: FAIL (74 passed, 2 failed)`), and the fix took a second commit.

**This is the genus of `OPEN.md` row 157** (a full-gate run piped through `tail`, the exit status
taken from `tail`), which is **DONE** — but its remedy does not cover this case. Row 157's fix is
`engineering-team/README.md` § "Running and reading the test gate", and that section is built on
`npm test`'s run record and `npm run gate:status`. **`harness-lint` has no run record**: its verdict
exists only as an exit code and a last line of stdout, so the one gate a session runs most often,
and runs before every commit, is the one the remedy never names. Fourth sighting of the genus.

**Fix shapes, any of which would have caught it:**

- Name the lint in that README section: its verdict is `$?`, never its output; if you must filter
  the output, capture to a file first and test the exit code separately.
- Have `scripts/harness-lint.sh` print its own summary to stderr as well, so a stdout pipe cannot
  hide the verdict.
- A `--quiet` mode that prints nothing and returns only the code, removing the reason to pipe it.
- Cheapest and narrowest: a line in the workflows' per-phase commit steps — the lint runs *before*
  `git add`, on its own, and its exit code gates the commit.

**Pointer:** `engineering-team/reviews/harness-self-improvement/open-md-one-table-2026-09-20.md`
§ round 5; `OPEN.md` row 157 and rows 103, 105, 111 (the same family, none covering the lint);
commits `723239e7` (the red one) and `c175ba47` (the fix); CI runs 35514430338 and 35514602167.
