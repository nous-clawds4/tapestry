# Test Plan: Story 17 — Make task queue ENABLED-by-default in the brainstorm.conf template

**Story:** `engineering-team/stories/17-task-queue-on-by-default.md`
**ADR:** `engineering-team/decisions/0015-task-queue-on-by-default.md`
**Date:** 2026-05-21

## Test posture

This is a default-behavior change with a one-line implementation. The ADR's design space is unusually narrow — flip the value in the template, ride story #16's source-of-truth contract into every fresh container. The Tester's job is correspondingly narrow: **flip two existing test spots in story #16's `test/entrypoint-template-rendering.test.js` so they fail right-reason against the still-`=false` template, then the Implementer's template flip makes them pass.**

No new test files. No new test suite. No new sentinels. The ADR explicitly closes that scope: "The existing R2 + T4 cover the new default; the existing T2 (heredoc variable list) still passes because TASK_QUEUE_ENABLED is still in the template, just with a different value."

The behavioral round-trip — boot a fresh container after the template change is deployed and observe the four-line task-queue stack in the boot log without operator ceremony — is the **authoritative cycle-local + cycle-staging smoke**, executed by the Reviewer and the operator respectively. This matches story #16's posture.

## Coverage map

| Criterion (story §) | Test name | Test file | Level |
|---|---|---|---|
| AC #1: fresh container's `/etc/brainstorm.conf` contains `export TASK_QUEUE_ENABLED=true` | `R2: config/brainstorm.conf.template carries TASK_QUEUE_ENABLED=true (story #17 / ADR 0015 default; story #13 contract preserved with the flag still present)` | `test/entrypoint-template-rendering.test.js` (line 429-440, flipped from pre-story-#17 form) | source sentinel |
| AC #1: same, but at the rendered-output level (not just template-text) | `T4: rendering the template via render-conf-template.js with a fixture env produces the expected VAR=VALUE pairs` — specifically the `TASK_QUEUE_ENABLED: 'true'` entry in the expected map (line 291) | `test/entrypoint-template-rendering.test.js` | integration (spawns the renderer with fixture env) |
| AC #2: post-deploy boot log shows the four-line task-queue stack | **Smoke (Reviewer cycle-local + cycle-staging)** — source-sentinels can't reach this; verified by inspecting `/var/log/supervisor/brainstorm.log` after `supervisorctl restart brainstorm` on a freshly-deployed container | — | smoke |
| AC #3: rollback path (`=false` + restart → legacy direct-spawn) still works | **Implicit** — no code on the rollback path changes; the `=false` branch in `runTask.js` + `control-panel.js` is unchanged from story #13/#16. Source-sentinels would over-fit; the rollback path is covered by story #13's existing test suite (18 sentinels, all still green) | — | regression (covered by other suites) |
| AC #4: R2 sentinel updated to assert the new default | The R2 sentinel itself **is** the AC. The test flip is the deliverable. | `test/entrypoint-template-rendering.test.js` (line 429-440) | source sentinel |
| AC #4: no regression in any of the 14 npm test suites | `npm test` overall PASS post-impl. All 13 sibling suites pass; entrypoint-template-rendering suite returns 11/11. | (full suite) | gate |
| AC #5: post-deploy operator does NOT need to re-run the manual flip recipe | **Smoke (Reviewer cycle-local + cycle-staging + cycle-prod)** — observed by deploying the template change to staging and verifying the operator does not need to intervene before BullBoard appears at `/admin/queues/`. The Reviewer's role-specific smoke confirms; the deploy chain confirms in the wild. | — | smoke |

### Why only two test changes

Per the ADR §Tests: T4 and R2 are the only sentinels that pin the *value* of `TASK_QUEUE_ENABLED` in the template. T2 (heredoc variable list, including `TASK_QUEUE_ENABLED` as a present variable name) passes whether the value is `true` or `false`. T3 (literal-placeholder substitution discipline) doesn't touch `TASK_QUEUE_ENABLED` (it's a literal value, not a `${VAR}` reference). T1, T5–T8, R1, R3 all unrelated.

### What this test plan deliberately does NOT add

- **A separate test for the comment-block rewrite in the template** (the parenthetical "default in phase 1" wording). Cosmetic. Reviewer eyeballs during the diff walk.
- **A separate test for the OPERATIONS.md §10.1 wording flip.** Documentation prose is brittle to sentinel; Reviewer eyeballs.
- **A separate "rollback path still works" sentinel.** Story #13's existing 18-sentinel suite already pins the rollback path (R3 in `test/task-queue-bullmq.test.js` asserts the `TASK_QUEUE_ENABLED` + `QUEUE_UNAVAILABLE` branch in `runTask.js`). Adding a story-#17-specific rollback test would over-fit and duplicate that guard.
- **A separate sentinel for "the new comment block mentions story #17 / ADR 0015".** Comments aren't a behavioral contract.

## Edge cases

| Case | Status |
|---|---|
| Operator runs the inverse manual flip recipe in an already-deployed container | **Covered by AC #3 + implicit regression.** The `=false` branch is unchanged source-wise; no code regression possible from a config-default flip. |
| Operator wants persistent rollback via repo edit | **Documented in OPERATIONS.md §11.** Edit template to `=false`, commit, deploy. The R2 sentinel's error message walks them through the bidirectional rollback (lines 434-440 of the test file post-flip). |
| Fresh container restart on an environment that was previously running `=true` (manual flip, e.g., staging + prod today) | **Covered by AC #5 smoke.** The template renders `=true`; the rendered conf matches what the operator manually flipped to; no observable change. |
| Bare-metal install (not Docker) | Out of scope per story #16 / ADR 0014 (entrypoint changes don't apply to bare-metal). The `setup/install-control-panel.sh` path reads the template directly; bare-metal installs will also get `=true` by default. Acceptable — same posture as story #16. |
| Future change re-flips default to `=false` intentionally | **Covered by R2's error message.** Last paragraph of the error message tells the next maintainer to flip R2 back to assert `=false` as part of that change. |

## Test infrastructure

- **Framework:** Node built-in runner via `npm test` (entry: `test/test.js`).
- **Test changes:** **TWO surgical edits to one existing file**, no new test files registered.
- **No new test infrastructure.** Same suite registered in `test/test.js` as story #16.
- **Concept Graph API:** not required for this story.
- **Firmware reinstall:** no.

## How to run

```
npm test
```

The `entrypoint-template-rendering suite:` line in the report shows the suite's pass/fail. Post-implementation expected: `PASS (11 passed, 0 failed)`.

For Reviewer cycle-local smoke (behavioral round-trip):

```bash
# Inside the tapestry container (or any environment with the deployed template):
docker exec tapestry bash -c '
  source /etc/brainstorm.conf 2>/dev/null
  export OWNER_PUBKEY="${BRAINSTORM_OWNER_PUBKEY}"
  export OWNER_NPUB="${BRAINSTORM_OWNER_NPUB}"
  export ADMIN_PUBKEYS="${BRAINSTORM_ADMIN_PUBKEYS}"
  export DOMAIN_NAME="${STRFRY_DOMAIN}"
  export RELAY_URL="${BRAINSTORM_RELAY_URL}"
  node /usr/local/lib/node_modules/brainstorm/tools/render-conf-template.js \
       /usr/local/lib/node_modules/brainstorm/config/brainstorm.conf.template \
  | grep TASK_QUEUE_ENABLED
'
# Expected output:
#   export TASK_QUEUE_ENABLED=true
```

For Reviewer cycle-staging smoke:

```bash
# After deploy-staging.yml completes, on the staging droplet:
docker exec tapestry cat /var/log/supervisor/brainstorm.log | grep -E "task-queue|bull-board|TASK_QUEUE_ENABLED" | tail -10
# Expected (the four-line stack, automatically, no manual flip needed):
#   Found TASK_QUEUE_ENABLED=true (unquoted)
#   [task-queue] Initialized 51 queues + workers (defaultConcurrency=1, resourceClasses=neo4j-heavy)
#   Task queue initialized (TASK_QUEUE_ENABLED=true)
#   [bull-board] Mounted at /admin/queues (owner-only)
```

If the four-line stack appears in the boot log without the operator running the manual flip recipe, AC #5 is satisfied — the deploy chain itself becomes the test.

## Verification

The flipped tests fail with the current (still-`=false`) template. Confirmed on 2026-05-21 at commit `6477994d`:

```
entrypoint-template-rendering suite:
  ✓ T1: tools/render-conf-template.js exists, is parseable Node, performs ${VAR_NAME} substitution against process.env (ADR 0014 §Implementation Step 2)
  ✓ T2: config/brainstorm.conf.template contains every variable the heredoc writes (Step 1 byte-equivalence; ADR 0014 §Implementation Step 1)
  ✓ T3: template replaces literal placeholder values with ${VAR} references for env-var-dependent variables (Step 1 byte-equivalence; ADR 0014 §Implementation Step 1)
  ✗ T4: rendering the template via render-conf-template.js with a fixture env produces the expected VAR=VALUE pairs (Step 1 byte-equivalence; ADR 0014 §Byte-equivalence verification)
      Rendered template diverges from heredoc output for 1 variable(s):
        TASK_QUEUE_ENABLED = "false" (expected "true")
  ✓ T5: config/brainstorm-task-queue.json.template exists, parses as JSON, has resourceClassCaps.neo4j-heavy=1 (AC; ADR 0014 §Implementation Step 2)
  ✓ T6: docker/entrypoint.sh invokes render-conf-template.js, installs brainstorm-task-queue.json from template, logs the rendering (AC; ADR 0014 §Implementation Step 2)
  ✓ T7: docker/entrypoint.sh contains NO <<CONFEOF heredoc writing to /etc/brainstorm.conf (drift sentinel; ADR 0014 §Drift sentinel)
  ✓ T8: docker/entrypoint.sh contains EXACTLY ONE invocation of render-conf-template.js (drift sentinel; ADR 0014 §Drift sentinel)
  ✓ R1: docker/entrypoint.sh still installs the other conf templates (graperank/whitelist/blacklist/nip56)
  ✗ R2: config/brainstorm.conf.template carries TASK_QUEUE_ENABLED=true (story #17 / ADR 0015 default; story #13 contract preserved with the flag still present)
      R2: config/brainstorm.conf.template no longer carries TASK_QUEUE_ENABLED=true (story #17 / ADR 0015 regression). Story #17 flipped the default from `false` to `true` ... [full message in the test source].
  ✓ R3: docker/entrypoint.sh still chmods /etc/brainstorm.conf to 664 after rendering (file-permissions preserved)

Test Results
-------------
entrypoint-template-rendering suite:             FAIL (9 passed, 2 failed)
Overall:                                         FAIL
```

The 13 sibling suites continue to PASS — no collateral damage from the test flip. Each of the 2 failures carries a right-reason message:

- **T4** identifies the exact value mismatch (`"false" (expected "true")`) — the Implementer reads this and knows immediately to flip the template to `=true`.
- **R2** carries the full bidirectional rollback story — the Implementer flips the template, R2 passes; if a future maintainer wants to roll back the default to `=false`, R2's own error message tells them to flip R2 too.

Post-implementation expected: `entrypoint-template-rendering suite: PASS (11 passed, 0 failed)`. Total suite count green: 14/14.
