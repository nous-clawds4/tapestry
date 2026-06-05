# Review: Story 28 — Kill timeout-orphans by default so they stop suppressing subsequent scheduled fires

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-25
**Diff:** `git diff 872303d6...HEAD` (commit `5f8134c5`)
**Branch:** `fix/kill-timeout-orphans-by-default`
**Story:** [`engineering-team/stories/28-kill-timeout-orphans-by-default.md`](../stories/28-kill-timeout-orphans-by-default.md)
**ADR:** [`engineering-team/decisions/0025-kill-timeout-orphans-by-default.md`](../decisions/0025-kill-timeout-orphans-by-default.md)
**Test plan:** [`engineering-team/stories/28-kill-timeout-orphans-by-default.test-plan.md`](../stories/28-kill-timeout-orphans-by-default.test-plan.md)

## Quality gates (run independently by reviewer, not trusted)

- [x] `npm test` — **PASS** (23 suites, 240 individual tests; `kill-timeout-orphans-by-default suite: PASS (9 passed, 0 failed)`; all 22 prior suites also PASS; Overall: PASS).
- [x] **Cycle-local empirical probe** (`test/probe-kill-timeout-orphans.js`) — **not run** in Review. Deferred to cycle-local at deploy time per story #27 precedent. Probe ships correctly per P0/P1 sentinels; the Implementer or operator runs it via `docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/probe-kill-timeout-orphans.js`. Reasoning: the structural sentinels + regression guards cover the implementation surface comprehensively, and the probe's role is empirical end-to-end against the installed wrapper script + jq — not a Review-gating concern given the diff is 2 small data/code changes that the sentinels exhaustively pin.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence (story #28's 5 acceptance criteria)

| AC | Coverage | Verified |
|---|---|---|
| **AC #1** Timeout produces a kill (no surviving orphan PID) | S1 (registry default = true) + S2 (processor.js omits per-invocation forceKill) + R1 (wrapper kill machinery preserved). Behavioral: probe Path 1's `kill -0 $childPid` post-wrapper-exit assertion. | ✅ structurally; probe deferred to cycle-local |
| **AC #2** Next scheduled fire runs (no `TASK_LAUNCH_PREVENTED`) | Consequence of AC #1 — no orphan means no `check_task_already_running` match. Behavioral: probe Path 2 verifies absence of `TASK_LAUNCH_PREVENTED` + presence of `CHILD_TASK_START` for the re-invocation. | ✅ structurally; probe deferred to cycle-local |
| **AC #3** Operator visibility via existing `CHILD_TASK_ERROR` events | R2 (regression guard: `launchChildTask.sh` still emits `CHILD_TASK_ERROR` with `error_type="timeout"`). Behavioral: probe Path 1 transitively confirms the event lands. | ✅ |
| **AC #4** Uniform across all wrapper invocation paths | S1's registry-default change reaches all paths through the wrapper's hierarchical merge (`launchChildTask.sh:200-211`). S2's processor.js change covers the BullMQ-mediated path specifically by stopping per-invocation `forceKill` assertion. R3 (queue/index.js wrap preserved) + R1 (wrapper kill machinery preserved) together hold the invariant. | ✅ |
| **AC #5** No-downtime deploy / no manual cleanup | Process-level invariant. Pure registry-data + tiny JS literal change — no Redis migration, no scheduler pause, no schema change. In-flight wrapper invocations at deploy time use their pre-deploy resolved_options. Verified at cycle-staging / cycle-prod time. | ✅ structurally; cycle-local pending |

- [x] Every acceptance criterion has a passing test or documented behavioral verification.
- [x] No criterion silently dropped.
- [x] No behavior added that isn't in the story.

## ADR adherence (ADR 0025)

- [x] **Files changed match ADR 0025 §"Implementation notes / Files to edit" exactly.** Two source files: `src/manage/taskQueue/taskRegistry.json` (one-line value flip at line 41) + `src/manage/taskQueue/queue/processor.js` (forceKill removed from per-invocation JSON at line 122). Plus the intake append. Diff size matches the ADR's "minimal blast radius" claim: 3 files, +39/-2 net.
- [x] **Layering matches Architect's Option A.** Both layers flipped, not Option B (registry only — would be a no-op) or Option C (processor only — would miss non-BullMQ paths).
- [x] **Implementer chose `omit` over `flip-to-true`** for processor.js. Correct — the ADR's Option A explicitly says "remove the hardcoded forceKill: false from the per-invocation JSON" and the Cons of the alternative (pinning per-invocation true) are flagged in S2's failure message. Implementer respected this.
- [x] **The 11 per-task `forceKill: false` overrides are preserved as-is.** R4 sentinel guards this. Verified at all 11 specified line locations (110, 231, 262, 291, 342, 373, 403, 435, 1431, 1460, 1489) via JSON-parse + property check. Architect's Option A vs D decision honored cleanly.
- [x] **No edits to "Files NOT to edit" list** — `launchChildTask.sh`, `scheduler.js`, `resourceSemaphore.js`, `queue/index.js`, `taskTimeout.js` all unchanged. Confirmed via diff stat (those paths are not in the diff).
- [x] **Intake filed verbatim** per the ADR's "Implementer copy-to-file at commit time" instruction. The blockquote `> ` prefixes from the ADR are correctly stripped (intake file convention is unindented markdown). Header matches the I1 sentinel exactly.
- [x] **No new dependencies, no new infrastructure.** No `package.json` change; no new env vars; no new config files.
- [x] **No firmware reinstall** — story explicitly notes no concept-graph footprint; ADR reconfirms.

## Concept-graph integrity

- [x] **No concept handles touched.** Story #28 + ADR 0025 + ADR 0013 / 0021 / 0024 all confirm the task-queue / wrapper-script subsystem has no concept-graph footprint. **Firmware reinstall: not required.**

## Things tests can't catch

- [x] **No secrets in committed files.** Diff is data + Markdown + a 2-line JS edit. Clean.
- [x] **No leftover debug logging.** None added.
- [x] **No commented-out code.** None.
- [x] **Error paths.** Registry-loading code unchanged. processor.js's optionsJson still goes through `JSON.stringify` — output shape is now `{"completion":{"failure":{"timeout":{"duration":N}}}}` which is a strict subset of the pre-fix shape, so any downstream consumer that handled the old shape will handle the new one. The wrapper's force_kill block is unchanged and already handled `force_kill="true"` via `kill -9 "$child_pid"` correctly.
- [x] **Concurrency.** No new shared state; no new race conditions. The semaphore primitive (`resourceSemaphore.js`) is unchanged. The Worker callback wrap (`queue/index.js`) is unchanged. ADR 0013's cap=1 contract holds across timeout boundaries post-fix because the kill makes the semaphore release match the actual end of work (when the bash subprocess dies).
- [x] **Security.** No new endpoints, no new input validation surface, no new auth surface. The change is internal to the task-queue subsystem.
- [x] **Deploy hazards.** Pure registry data + 2-line JS change. In-flight wrapper invocations at deploy time finish with their pre-deploy resolved_options (which carry the old forceKill: false). New invocations post-deploy resolve forceKill from the new defaults. Pre-existing orphans from past timeouts (if any) continue running until natural completion or operator action — the deploy itself doesn't kill them. Matches ADR 0025 §"Deployment dry-run" exactly.
- [x] **Probe ships but isn't run.** The empirical probe at [`test/probe-kill-timeout-orphans.js`](../../test/probe-kill-timeout-orphans.js) is shipped + correctly shaped per P0/P1 sentinels but not yet executed against the installed container. This is the expected pattern from story #27 (probe runs at cycle-local, not at Review). Cycle-local must run the probe before cycle-staging signs off.

## House rules check

- [x] **Concept Graph API authority respected.** No graph reads/writes (correctly — none needed).
- [x] **No new lint/typecheck/build tooling.** Zero infrastructure added.
- [x] **JS-without-build preserved.** Diff is pure JSON + Markdown + JS literal edit.

## Process integrity (this story specifically)

- The five-phase flow ran cleanly: story → ADR → test plan + failing tests → impl. Each phase produced its expected commit on the same feature branch. No re-opens, no phase escalations.
- The Architect's audit of the 11 per-task overrides during Phase 2 (which surfaced the 9-safe / 2-unsafe split and the syncWoT/syncProfiles 60s mis-sizing bug) is exactly the kind of upstream audit that turns a "flip a default" task into a properly-scoped story. The follow-up intake captures the deferred work cleanly — same pattern ADR 0023 / ADR 0024 used for their Implementer-copy-to-file intakes.
- The Tester shipped the probe alongside the sentinels (P0/P1 PASS pre-impl) — de-risked the Implementer's commit by establishing the probe file before it was needed. Same pattern story #27 used.
- The Implementer's diff is exactly the ADR's Implementation notes, no scope creep. R4's "preserve 11 per-task overrides" sentinel was not just decorative — it actively constrained the Implementer's hand.

## Findings

### Blocking

_None._

### Non-blocking

1. **[`src/manage/taskQueue/launchChildTask.sh:403`](../../src/manage/taskQueue/launchChildTask.sh:403)** — `local force_kill=$(echo "$resolved_options" | jq -r '.failure.timeout.forceKill // false')`. The `// false` jq fallback at the bash level is now misaligned with the new global default (`true`). In practice this fallback only engages if the entire `options_default.completion` block is missing from the registry — which would be a much deeper corruption issue — but a future cleanup intake could flip `// false` → `// true` for consistency. ADR 0025 §"Files NOT to edit" explicitly excludes this file from story #28's scope, so the Implementer correctly did not touch it. Worth filing a separate hygiene intake; not blocking this story.

2. **Probe runtime deferred to cycle-local.** AC #1 and AC #2's behavioral claims have structural coverage (S1, S2, R1, R3) but the empirical end-to-end check via `test/probe-kill-timeout-orphans.js` has not been run in Review. This matches story #27's precedent (probe runs at cycle-local, not at Review) and the structural coverage is comprehensive for a 2-file fix. The probe MUST be run during the next `cycle-local` step before staging signs off — that's the empirical confirmation that the wrapper actually kills the orphan when the resolved forceKill is true. If the probe FAILs at cycle-local, re-open ADR 0025 with the probe output attached. Not blocking the Review verdict because the deployment chain's own gates (cycle-local → cycle-staging → cycle-prod) cover this empirically.

3. **Cycle-staging is the AC #5 final gate.** No-downtime deploy + no-manual-cleanup is a process-level invariant that's only verifiable at deploy time. The structural diff supports the claim (pure data + tiny JS edit; no in-flight-state migration needed); cycle-staging will confirm operationally.

## Verdict

**PASS.**

Implementation matches ADR 0025 exactly. Both layers (registry default + processor.js literal) are flipped per Architect's Option A; the 11 per-task `forceKill: false` overrides are preserved unchanged per the Architect's explicit non-change decision; the follow-up intake is filed verbatim from the ADR's "Implementer copy-to-file at commit time" block. All 9 new sentinels pass; no regressions across the other 22 suites (240 individual tests total).

The fix's mechanism — flip the registry global default + remove processor.js's per-invocation hardcode — correctly addresses both layers ADR 0025 §Context identified as necessary. Without Layer 2, Layer 1 would be a no-op for the BullMQ-mediated path (which is most scheduled fires); the Implementer correctly fixed both.

Three non-blocking observations recorded above (wrapper jq fallback misalignment, probe runtime deferred, cycle-staging is AC #5's final gate). None affect correctness or deploy safety.

Ready for the standard deploy chain: `cycle-local` first (runs the probe + verifies the wrapper behavior end-to-end), then `cycle-staging`, then `cycle-prod` on user approval. AC #1, #2, #4 (full kill behavior across paths) and AC #5 (no-downtime deploy) get their final behavioral verification during those cycles.
