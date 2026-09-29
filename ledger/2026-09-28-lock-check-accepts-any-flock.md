# The gap-filling pass's lock check accepts an exclusive flock on any file held on fd 9, not only on its own `pass.lock`

**Id:** 2026-09-28-lock-check-accepts-any-flock
**Type:** bug
**Opened:** 2026-09-28 (tagging-edges #2 review, Nit 1)
**Status:** DONE
**Done:** 2026-09-28 (tagging-edges #3 on `feat/tagging-edges-3`; PR to follow) — ADR `tagging-edges/0003` C20: `lockHeld(fd, { file })` compares inodes, and both callers pass their lock file.

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

**Resolution.** Story 3 folds the fix, as the fix shape above says, through clarification C20 (made by ADR
`tagging-edges/0003`, recorded in ADR `tagging-edges/0002`). `state.lockHeld(fd, { file })` is true only when
`/proc/self/fdinfo/<fd>` shows a `FLOCK … WRITE` line and its `ino:` equals `fs.statSync(file, { bigint: true }).ino`
(compared as strings); a missing file, a foreign inode or no `ino:` line reads as not held. The runner passes
`<stateDir>/pass.lock`, and the real-time path passes its own `realtime/daemon.lock`. Tests: ST19 (re-aimed: its
true cases pass a matching `file`) and ST23 (a foreign inode, a missing file, no `ino:` line) in
`test/tagging-edges-state-routes.test.js`; SWR68 in `test/tagging-edges-wiring.test.js` pins that both callers pass
their lock file.

**Pointer:** `engineering-team/reviews/tagging-edges/2-gap-filling-pass-and-backfill.md` § Nits, item 1;
`src/pipeline/tagging-edges/state.js` (`lockHeld`); `src/pipeline/tagging-edges/reconcileTaggingEdges.js`
(`defaultDeps`, step 1); ADR `tagging-edges/0003` § "ADR 0002 clarification C20".
