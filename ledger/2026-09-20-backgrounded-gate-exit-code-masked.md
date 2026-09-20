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
