# Review: Story 17 — Make task queue ENABLED-by-default in the brainstorm.conf template

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-21
**Diff:** `git diff origin/main..HEAD` (commit `eea824c6`, 4 commits: `e7f3b9a3` story, `6477994d` ADR, `39e28162` tests, `eea824c6` impl)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` (host) — **PASS**. `entrypoint-template-rendering suite: PASS (11 passed, 0 failed)`, `task-queue-bullmq suite: PASS (18 passed, 0 failed)`, all 12 other suites still PASS, unchanged. Overall: **PASS**.
- [x] `npm test` (live tapestry container, bind-mounted source) — **PASS**. Same 14/14 suites green as host.
- [x] _Playwright not applicable — no UI surface changed._
- [x] _Lint / typecheck / build not configured — skipped per house rules._
- [x] **Cycle-local smoke** — **PASS** (see §Cycle-local smoke verification below).

## Spec adherence (AC walk)

| AC (story §) | Status | Notes |
|---|---|---|
| AC #1 fresh container's `/etc/brainstorm.conf` contains `export TASK_QUEUE_ENABLED=true` | ✓ | R2 source sentinel + T4 fixture map both assert the new value. Plus cycle-local smoke S1 (renderer output) directly confirms. |
| AC #2 post-deploy boot log shows the four-line task-queue stack | smoke-deferred | Source-sentinels can't reach the runtime log. Reviewer cycle-local already observed the four-line stack on staging + prod via supervisorctl restart in earlier work; the deploy chain's natural container restart on the next staging deploy is the authoritative test. |
| AC #3 rollback path (`=false` + restart → legacy direct-spawn) still works | ✓ | No source change on the rollback path. The `TASK_QUEUE_ENABLED=false` branch in [`bin/control-panel.js:274`](../../bin/control-panel.js#L274) (legacy direct-spawn log line) is intact; the `runTask.js` flag-off branch is intact. Story #13's 18-sentinel suite (including T8, T12, T13) still green — those guard the rollback contract. |
| AC #4 R2 sentinel updated; no other regression in 14 npm test suites | ✓ | R2 flipped to assert `=true`. T4 fixture map flipped. **Plus T10 in story #13's `task-queue-bullmq` suite needed updating** — see Findings §Non-blocking #1. The Implementer caught + fixed this via the test gate; covered by the "no other regression" AC. |
| AC #5 post-deploy operator does NOT have to re-run the manual flip recipe | smoke-deferred | Confirmed structurally (template → R2 → /etc/brainstorm.conf contains `=true` → control-panel.js reads it → BullBoard mounts). Behavioral round-trip will be validated on the next staging container restart. |

## ADR adherence

- [x] Files changed match ADR 0015 §Implementation notes:
  - `config/brainstorm.conf.template` (line 100 + comment block 94-99) ✓
  - `test/entrypoint-template-rendering.test.js` (T4 fixture line 291 + R2 sentinel lines 429-440) ✓ — handled in Phase 3 by the Tester
  - `OPERATIONS.md` §10.1 (lines 421-422) ✓
- [x] **No new files. No new modules. No new dependencies.** Confirmed by `git diff --stat`: only 3 source files modified, plus the 3 engineering-team artifacts (story, ADR, test-plan, review) and 2 test files.
- [x] Comment block in template references story #17 / ADR 0015 — future readers can trace the decision back. Format matches ADR's suggested wording.
- [x] OPERATIONS.md §10.1: default annotation moved from `=false` to `=true`; rollback wording now references both template-edit (persistent) and in-container (transient) paths. Cleaner than the pre-story-#16 form.
- [x] Other OPERATIONS.md references (§10.4 line 460, §10.6 line 470, §11 line 546) correctly left untouched per ADR 0015 — they're behavior descriptions or historical narratives, not default declarations.
- [x] **Implementer's bonus fix on T10 in `test/task-queue-bullmq.test.js`** — discussed in Findings.

## Concept-graph integrity

- [x] No concept-graph schema changes (ADR §Consequences confirmed "no firmware reinstall"). No `src/concept-graph/` edits in the diff.
- [x] No concept handles touched.

## Things tests can't catch — hidden-hazard audit

I ran a repo-wide grep for any remaining hardcoded `TASK_QUEUE_ENABLED\s*=\s*false` literals to make sure the Implementer didn't miss a stale reference. Every remaining match is correct in its context:

| Location | Status |
|---|---|
| `OPERATIONS.md:422` — describes `=false` behavior in §10.1 | ✓ Correct: this is the rollback-path description, not a default declaration. The Implementer moved "(default)" annotation off this line. |
| `OPERATIONS.md:460` — §10.4 drain/pause recipe references flipping to `=false` | ✓ Correct: maintenance procedure, not a default. |
| `OPERATIONS.md:546` — §11 historical narrative ("story #13's `TASK_QUEUE_ENABLED=false`...") | ✓ Correct: historical fact about how the trap manifested before story #16 + #17 closed it. |
| `bin/control-panel.js:274` — runtime log line emitted when flag is off | ✓ Correct: behavior description, not a config declaration. The rollback path log message stays. |
| `engineering-team/decisions/0012-...md:214` (ADR 0012) | ✓ Correct per ADR 0015 §Out of scope: "Updating prior ADRs to reflect the new default. ADRs are historical records." |
| `engineering-team/decisions/0013-...md:245` (ADR 0013) | ✓ Same — historical reference. |
| `engineering-team/decisions/0014-...md:233,333,348` (ADR 0014) | ✓ Same — historical references to the value at the time. |
| `engineering-team/stories/13-...test-plan.md`, `16-...test-plan.md` | ✓ Historical test-plan artifacts. Left as-is. |
| `engineering-team/decisions/0015-...md:9,19,26,108,162,170` | ✓ ADR 0015 itself, which discusses both the old `=false` and the new `=true`. Self-consistent. |

Conversely, the new `=true` literals exist exactly where expected: template line 100, R2 + T4 in `test/entrypoint-template-rendering.test.js`, OPERATIONS.md §10.1, and the ADR's narrative. Plus `bin/control-panel.js:268` (the `Task queue initialized (TASK_QUEUE_ENABLED=true)` log line — pre-existing) and `test/task-queue-bullmq.test.js:270` (the Redis-down test error string — pre-existing).

No stale references. The audit confirms the change is fully consistent.

Additional hidden-hazard checks:

| Hazard | Status |
|---|---|
| Implementer added a leftover `console.log` or debug code | ✓ Closed — diff is 3 surgical edits, no log additions. |
| Template comment-block change accidentally breaks the renderer's regex | ✓ Closed — the new comment text is plain Markdown-style prose with no `${...}` references. T4 (which spawns the renderer + asserts pairs) passes. |
| OPERATIONS.md change breaks any other doc's cross-reference | ✓ Closed — the new wording adds "since story #17 / ADR 0015" which is a strict addition; no anchors or section numbers shifted. |
| T10 relaxation in story #13's suite makes the guard too loose | **Acceptable.** T10 now matches `=true OR =false` — i.e., "the knob is present in some valid form." The value-side assertion is fully pinned by R2 in the entrypoint-template-rendering suite. The two sentinels split concerns cleanly (T10 = presence; R2 = current value), which removes a future-drift risk where they would have to be kept in lock-step. |
| Future operator wants to revert to `=false` and forgets to flip R2 too | ✓ Closed by R2's error-message walkthrough. The last paragraph of R2's failure explicitly tells the next maintainer to flip R2 back. |

## Cycle-local smoke verification

The local `tapestry` Docker container has been up for 7+ days with a bind-mount of the repo, so my Implementation-phase edits to `config/brainstorm.conf.template` are live in-container without a rebuild. Drove the smoke against that bind-mount.

### S1 — Render the template, verify `=true` is produced

```bash
docker exec tapestry bash -c '
  source /etc/brainstorm.conf 2>/dev/null
  export OWNER_PUBKEY="${BRAINSTORM_OWNER_PUBKEY}"
  export OWNER_NPUB="${BRAINSTORM_OWNER_NPUB}"
  export ADMIN_PUBKEYS="${BRAINSTORM_ADMIN_PUBKEYS}"
  export DOMAIN_NAME="${STRFRY_DOMAIN}"
  export RELAY_URL="${BRAINSTORM_RELAY_URL}"
  node /usr/local/lib/node_modules/brainstorm/tools/render-conf-template.js \
       /usr/local/lib/node_modules/brainstorm/config/brainstorm.conf.template \
  | grep -E "TASK_QUEUE_ENABLED|# Task queue"
'
```

Output:

```
# Task queue (story #13 / ADR 0012; default flipped from false to true in
export TASK_QUEUE_ENABLED=true
```

Direct evidence the renderer produces the new default. The comment-block update is visible too — future operators inspecting `/etc/brainstorm.conf` will see the story #17 / ADR 0015 reference and can trace the decision.

### S2 — npm test inside the container

```
task-queue-bullmq suite:                         PASS (18 passed, 0 failed)
task-queue-neo4j-resource-class suite:           PASS (14 passed, 0 failed)
entrypoint-template-rendering suite:             PASS (11 passed, 0 failed)
Overall:                                         PASS
```

14/14 inside the container too. The bind-mount picks up the edits without an image rebuild.

### Smoke scenarios NOT performed (acceptable gaps)

- **Cold container boot from scratch.** Would require `docker compose down && docker compose up --build` which interrupts the operator's stack. The deploy chain (cycle-staging next) naturally exercises this on every push.
- **Behavioral round-trip — boot a fresh container and observe the four-line task-queue stack appear WITHOUT operator intervention.** This is AC #5's true test. The deploy chain validates it on the next staging deploy; if the four-line stack appears in the boot log without manual flip ceremony, AC #5 is empirically satisfied.

## House rules check

- [x] Concept Graph API authority respected (no concept change).
- [x] No new lint/typecheck/build tooling.
- [x] No firmware reinstall needed.
- [x] Per-phase commits in order: story → ADR → tests → impl. Clean stack on top of `origin/main` (which already has story #16's merge).

## Findings

### Blocking

_None._

### Non-blocking (recorded, do not gate)

1. **T10 collision wasn't anticipated in ADR 0015.** The ADR §Implementation notes enumerated only R2 + T4 in the entrypoint-template-rendering suite as test touchpoints. Story #13's T10 sentinel in the `task-queue-bullmq` suite carried a parallel `=false` assertion that the test gate caught at impl time. The Implementer correctly extended the fix to T10 (covered by story #17 AC #4 "no other regression in any of the 14 npm test suites"). **Teachable moment for future "default value flip" ADRs:** include a repo-wide grep for the old literal value in §Implementation notes so the Implementer doesn't discover the cross-suite collisions via the gate. Worth folding into the team's Architect role notes if these kinds of value-flips become a recurring pattern. Not a blocker — the gate worked exactly as intended (caught the regression before it could ship).

2. **T10's resolved shape (allow `=true OR =false`) is a deliberate looser guard than its original.** This was the right choice: pinning the value in both T10 (story #13's suite) AND R2 (story #16's suite) would require future maintainers to keep them in lock-step on any subsequent default-flip. Splitting concerns (T10 = presence guard, R2 = current value) removes that drift risk. The Implementer's comment block in T10 explicitly walks the next reader through this rationale.

3. **OPERATIONS.md §10.6 line 470 still reads "Requires `TASK_QUEUE_ENABLED=true` (§10.1)."** This is correct behavior text (story #15's resource-class semaphore does require the queue to be on), and the "(§10.1)" cross-reference still resolves correctly. No edit needed; flagging only to confirm I considered it.

4. **OPERATIONS.md §11 last-paragraph reference to "TASK_QUEUE_ENABLED rollout (see §10.1)"** still resolves correctly — §10.1's content changed but the section identity didn't. ✓

5. **Behavioral round-trip is deferred to cycle-staging.** AC #5 ("operator does NOT have to re-run the manual flip recipe") is technically only fully validated when a fresh container actually boots from the deployed template change without intervention. The staging deploy is the natural place for that validation; if the manual flip recipe is needed, that's a real Implementer bug that we'd catch + fix before promoting to prod. Story #17 is self-validating in that respect — the deploy chain IS the test.

## Verdict

**PASS end-to-end.**

The implementation is mechanically tiny (3 files, +22/-15) and exactly what ADR 0015 specified, plus one cross-suite test fix the gate caught (T10 in story #13's suite). Source-side: 14/14 suites green on both host and container. Behavioral-side: renderer produces `=true` as expected with the new comment-block traceability. The 5 non-blocking observations are documentation polish + a useful teachable moment about cross-suite grep in future "value flip" ADRs — none gate ship.

The story is ready for the deploy chain (`cycle-staging`, then on explicit confirmation `cycle-prod`). The cycle-staging round-trip will empirically validate AC #5: if the next fresh staging container brings up the four-line task-queue stack without operator ceremony, story #17's contract is fully satisfied. If the manual flip recipe is somehow still needed, that's a real bug we'd catch + fix before promoting — but the source-sentinel + smoke evidence collected here strongly suggests it won't be.

The operator path forward post-merge:
- Staging deploy → fresh container reads `=true` from the template → BullBoard + queue come up automatically.
- Prod deploy → same.
- No manual flip recipe needed on either environment after this story lands.
- If a future operational need arises to disable: edit template to `=false`, flip R2 + T10 to match (R2's error message walks through this), commit, deploy.
