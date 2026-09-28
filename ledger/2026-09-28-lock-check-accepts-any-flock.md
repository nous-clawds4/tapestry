# The gap-filling pass's lock check accepts an exclusive flock on any file held on fd 9, not only on its own `pass.lock`

**Id:** 2026-09-28-lock-check-accepts-any-flock
**Type:** bug
**Opened:** 2026-09-28 (tagging-edges #2 review, Nit 1)
**Status:** OPEN
**Done:** —

**What was seen.** The runner refuses a start that does not hold the pass's kernel lock (ADR `tagging-edges/0002`
step 1: `/proc/self/fdinfo/9` must show a `FLOCK … WRITE` lock). `lockHeld(9)` (`src/pipeline/tagging-edges/state.js`,
used by the runner's `defaultDeps().lock.held`) checks only that fd 9 carries an exclusive flock, not that the file is
`pass.lock`. In the container, `exec 9</etc/hostname; flock -x -n 9; node …/reconcileTaggingEdges.js` gives
`lockHeld(9): true`, so a hand-run that locks some other file passes the check and could run beside a real pass.

No script in the repo uses fd 9 except the wrapper (`reconcileTaggingEdges.sh`), and root in the container is out of
the threat model, so the review rated it a nit. The code does what the ADR's text specifies; the gap is against the
intent of D11-C (never two passes at once) and the refusal's message.

**Fix shape.** A C20 clarification to ADR `tagging-edges/0002`: compare fdinfo's `ino:` with
`fs.statSync(<stateDir>/pass.lock, { bigint: true }).ino`, as strings. Do not use the lock line's pid, which reads 0
inside the container's pid namespace. Add `test/tagging-edges-state-routes.test.js` ST19 cases for a foreign inode and
for a missing `pass.lock`.

**Pointer:** `engineering-team/reviews/tagging-edges/2-gap-filling-pass-and-backfill.md` § Nits, item 1;
`src/pipeline/tagging-edges/state.js` (`lockHeld`); `src/pipeline/tagging-edges/reconcileTaggingEdges.js`
(`defaultDeps`, step 1).
