# A backgrounded `npm test` wrapped in a shell compound reports exit 0 while the gate recorded FAIL

**Id:** 2026-09-20-backgrounded-gate-exit-code-masked
**Type:** meta
**Opened:** 2026-09-20 (book close `shared-concepts-row-detail`, retro finding 4)
**Status:** OPEN
**Done:** —

The gate is designed so its exit code carries the verdict: `test/test.js` says *"exits with the verdict
it recorded"*, and the Reviewer role tells a session to run the gate and quote its result. That
contract is defeated by the ordinary way a long run gets backgrounded.

Observed this session. The command was:

```
npm test > <log> 2>&1; echo "GATE EXIT: $?"
```

The trailing `echo` is the compound's last command, so **the compound's exit status is the echo's —
always 0.** The harness task notification then read:

> Background command "Run the full test gate in background" completed (**exit code 0**)

while the gate itself had recorded:

> `20260920T060602Z-16829-80d9` … — **FAIL, exit 1**, 3371 passed, 5 failed, 59 skipped, 208/208 suites

**Why it is worth a row:** the notification is the only signal a session gets when a long background
run lands, and it is phrased as a verdict. A session that trusts it writes "gate: pass" into a review
and moves on — the exact failure the honest-test-gate book exists to prevent, reintroduced one layer
up, in the *reporting* of the gate rather than the gate itself. It was caught here only because the
run record was read directly afterwards; nothing in the notification suggested it needed checking.

**Direction-mode exposure (worse).** Under human-gated flow a person may notice a suspiciously clean
result. In Direction mode no human reads the notification's phrasing, and a Director could bank a
false PASS into a gate verdict with an auditable journal entry that looks correct.

**Fix shape**, cheapest first:

1. **Convention:** never end a backgrounded gate invocation with another command. Run `npm test > <log>
   2>&1` alone and let the runner's own status propagate. Worth a line wherever the skills tell a
   session to background a long run.
2. **Belt and braces:** after any backgrounded gate run, read the verdict from `npm run gate:status`
   rather than from the exit code or the notification. `engineering-team/README.md` §
   "Running and reading the test gate" already makes the record the source of truth — the gap is that
   nothing says *the notification is not*.
3. If a wrapper is unavoidable, propagate explicitly: `npm test > <log> 2>&1; rc=$?; echo "GATE EXIT:
   $rc"; exit $rc`.

**Pointer:** `test/test.js` (header comment on exit semantics); `engineering-team/README.md` §
"Running and reading the test gate"; `engineering-team/roles/reviewer.md` step 1; audit
`engineering-team/audits/shared-concepts-row-detail/audit.md` §7.

---

**Second instance, 2026-09-20 (`profile-lookup-bounds` book close, retro R1) — wider than the gate,
and wider than a trailing `echo`.** The same defeat happens through a **pipe**, which is the ordinary
way a session trims a long command's output:

```
perl -e 'alarm 500; exec @ARGV' npx vite build 2>&1 | tail -14
```

A pipeline's status is its **last** command's, so this reports `tail`'s 0. The build had failed:
`ui/node_modules` was absent in the worktree and vite exited with `ERR_MODULE_NOT_FOUND`. The task
notification said *"completed (exit code 0)"* and the captured tail showed only npm's "New major
version of npm available!" notice — no error text, because the failure was above the 14-line window.
The Implementer had drafted "UI builds clean" on that basis and caught it only by grepping the log
for `built in`, which was absent.

So the row's fix 1 ("never end a backgrounded invocation with another command") is necessary but not
sufficient — `| tail`, `| grep` and `| head` are the same hazard and are far more common than a
trailing `echo`. The durable form of the rule is: **never read a verdict from the exit status of a
pipeline or compound; read it from the tool's own record** (`npm run gate:status` for the gate) or
assert on a positive success marker in the log (`built in`, `✓`) rather than on the absence of
errors. Note the second instance was a *build*, not the gate, so a fix scoped to gate invocations
alone would not have caught it.

**Pointer (addendum):** audit `engineering-team/audits/profile-lookup-bounds/audit.md` §7 R1.
