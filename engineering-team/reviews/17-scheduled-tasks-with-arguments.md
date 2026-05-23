# Review: Story 17 — Per-task arguments in the Scheduled Tasks panel

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-23
**Diff:** `git diff staging~4..staging` — commits `af483eee` (story), `b6888587` (ADR), `9b66bc69` (failing tests), `c3cac6c3` (implementation)
**Branch:** local `staging`, **76 commits behind `origin/staging`** at HEAD `c3cac6c3`. This branch-staleness is the central finding of the review (see §Blocking #1).

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` (host) — **PASS**. `scheduled-tasks-with-arguments suite: PASS (28 passed, 0 failed)`. All 14 sibling suites continue to PASS — including `scheduled-search-and-house-scores-refresh suite: PASS (12/12)`, which guards story #4's banner / title literals / `status(400)+taskId` / `req.query.taskId` / `Minimum interval is 1 hour` / `initScheduler forEach(taskId)` regex patterns. Overall: **PASS**.
- [x] `npx vite build` (UI) — **PASS** (3579 modules transformed, 18s, no errors). Confirms the four new/edited JSX files are syntactically valid and imports resolve.
- [x] `npm test` against the live tapestry container — **NOT RUN.** See §Blocking #1: the live container at `localhost:7778` is serving `origin/staging` code (76 commits ahead of this branch), not the implementation under review. End-to-end verification against the live stack is impossible from this branch without first reconciling with `origin/staging`.
- [x] _Playwright not applicable._
- [x] _Lint / typecheck / build not configured at repo level — skipped per house rules._
- [ ] **Cycle-local smoke** — **NOT FEASIBLE on this branch.** Behavioral round-trip items the test plan lists as Reviewer-driven (multi-entry firing, deleted-customer auto-disable, browser-visible Save disablement, per-entry timestamp independence, `handleDelete` force-flag at HTTP level) cannot be validated against the running stack because the running stack is `origin/staging` code (ADR 0019 generalized scheduler), not this branch's code. Probing the live API at `http://localhost:7778/api/scheduled-tasks/registry-tasks` returns **404** (the endpoint this branch adds doesn't exist there); `/api/scheduled-tasks/list` returns a different shape (`{tasks:[…]}` per ADR 0019, not `{entries:[…]}` per ADR 0015). See §Blocking #1.

## Spec adherence (AC walk against story #17)

The implementation **internally** satisfies every AC against the story + ADR as written. The wall is external — the story + ADR were drafted against a stale view of the codebase.

| AC | Status (on this branch) | Test coverage |
|---|---|---|
| AC-1: Every parameterized task schedulable | ✓ | T18 + T19 + T24 |
| AC-2: Registry as single source of truth for arg form | ✓ | T18 + T23 + T21 |
| AC-3: Argument-form parity with legacy Task Explorer | ✓ source + smoke-deferred | T23 + T22 |
| AC-4: Multiple entries per task | ✓ | T2 + T13 + T17 + T24 |
| AC-5: Recognizable label exposing args | ✓ | T2 + T25 |
| AC-6: Required arguments block save | ✓ | T9 + T10 + T26 |
| AC-7: Fired task receives configured args | ✓ source; smoke deferred | T15 |
| AC-8: Optional args respect declared defaults | ✓ | T15 (propagation) + modal pre-fill (AddOrEditEntryModal.jsx:46-58) |
| AC-9: Customer picker shares legacy explorer's source | ✓ | T22 |
| AC-10: Deleted-customer warning + auto-disable | ✓ source; smoke deferred | T16 (CUSTOMER_NOT_FOUND + persistDisable wired) |
| AC-11: Existing entries survive upgrade | ✓ | T2 (bit-for-bit preserve) + T12 (no-args legacy accepted) + T14 (readConfig calls migrator) + R1 (banner kept) + R2 (initScheduler kept) |
| AC-12: Persistence across restarts | ✓ | T3+T4+T5 round-trip + T14 + R2 |
| AC-13: Per-entry last-run / next-run | ✓ source; smoke deferred | T13 (timer state keyed by entryId) |

## ADR adherence (against ADR 0015 as drafted on this branch)

- [x] Files changed match ADR 0015 §Implementation notes precisely:
  - New `src/api/scheduled-tasks/migration.js` ✓ — pure module, exports `migrateConfigIfNeeded`. Idempotent (line 40-42), deterministic legacy IDs (line 52), bit-for-bit schedule preservation (line 59-61).
  - New `src/api/scheduled-tasks/validation.js` ✓ — exports `validateEntry`, returns `{ok, errors[{field,code,message}]}`. UNKNOWN_TASK / NOT_SCHEDULABLE / CUSTOMER_REQUIRED / INVALID_CUSTOMER_PUBKEY / INVALID_BOOLEAN / INVALID_INT error codes per ADR.
  - Edited `src/api/scheduled-tasks/index.js` ✓ — timer state `Map<entryId, …>` (line 47); `readConfig` calls `migrateConfigIfNeeded` (line 87); `makeTriggerTask` builds query string from `entry.args` with customer triple expansion (line 112-131); CUSTOMER_NOT_FOUND auto-disables (line 211-222); `persistDisable` records lastError (line 144-153); `resolveEntryId` resolves bare `taskId` → `legacy:<taskId>` (line 361-370); `initScheduler` iterates entries with `forEach…taskId` for story-#4 regex continuity (line 296-311).
  - Edited `src/api/index.js` ✓ — adds `/list`, `/create`, `/delete`, `/registry-tasks` (line 439-447) per ADR.
  - New `ui/src/pages/settings/scheduledTasks/argFieldRenderer.jsx` ✓ — switch over customer / boolean / optional with text-input fallback + console.warn (line 67-83).
  - New `ui/src/pages/settings/scheduledTasks/CustomerPicker.jsx` ✓ — fetches `/api/get-customers` (line 19), filters by name and pubkey substring (line 32-37).
  - New `ui/src/pages/settings/scheduledTasks/AddOrEditEntryModal.jsx` ✓ — fetches `/api/scheduled-tasks/registry-tasks` (line 32), posts to `create`/`update` (line 95), Save disabled while required args missing (line 62-77).
  - Edited `ui/src/pages/settings/RelaySettings.jsx` ✓ — renames `ScheduledTaskCard → ScheduledEntryCard` (line 1394), list-driven `ScheduledTasksPanel` fetching `/api/scheduled-tasks/list` (line 1650), `LEGACY_TITLE_OVERRIDES` for story-#4 title continuity (line 1638-1641), `HousePovUnconfiguredBanner` wired via `renderBannerFor` (line 1664-1667).
- [x] Layering / module boundaries respected — pure modules are `require()`-able and tested in isolation.
- [x] **No new dependencies** introduced. `crypto.randomUUID()` is Node built-in.
- [x] Backward-compat shim resolves bare `taskId` → `legacy:<taskId>` on every handler that previously took a `taskId` query/body param.
- [-] **OPERATIONS.md docs note (ADR §Implementation Notes "Documentation")** not added — `OPERATIONS.md` doesn't exist on this branch (added on `origin/staging` after this branch's base point). Implementer flagged this in the commit message; non-blocking for this branch's review since the file isn't present, but **must be addressed when reconciling with `origin/staging`** (see Blocking #1).

## Concept-graph integrity

- [x] No concept-graph schema changes (ADR explicitly says "no firmware reinstall"). Confirmed via diff — no `src/concept-graph/` edits, no firmware JSON touched.
- [x] No concept handles in source code or tests. The ADR references `graperank` and `nostr-user` handles informationally; no code consumes them.
- [x] Concept Graph API at `localhost:7778` (per AGENTS.md) — used by the PO and Architect for orientation; not consumed by runtime code.
- [x] Firmware reinstall not required.

## Things tests can't catch — hidden-hazard audit

Per-file hazards I looked for; status against this branch:

| Hazard | Status (on this branch only) |
|---|---|
| `readConfig`'s try/catch swallows malformed JSON and returns empty `{version:2, entries:[]}`, silently losing operator schedule. | **Pre-existing behavior** from story #4 (the old `readConfig` also fell back to `DEFAULTS` on parse error). Same posture. Non-blocking. |
| Concurrent writes to `scheduled-tasks.json` from two HTTP requests racing → lost update. | **Pre-existing** — story #4 had the same race. Non-blocking; not introduced. |
| `persistDisable` racing with an in-flight operator update → either the auto-disable wins or the operator's save wins (no merge). | Acceptable: both paths read-modify-write the full config; lost update is bounded to the in-progress change, and the operator can re-save. Same posture as the existing scheduler. Non-blocking. |
| `triggerTask`'s `state.taskRunning` not reset on certain error paths. | Covered: all branches set `taskRunning = false` (lines 185-187, 198-199, 220-221, 236-237, 264, 268). ✓ |
| `buildQueryString` URL-encodes all values via `encodeURIComponent`. | ✓ — no injection vector. |
| The `fetch('http://127.0.0.1:7778/...')` is localhost-only. | ✓ |
| No secrets in committed files. | ✓ |
| No leftover `console.log` debug — all logs are intentional `[scheduled-tasks]`-tagged operational logs matching the existing pattern. | ✓ |
| No commented-out code. | ✓ |
| ScheduledEntryCard's `loading` spinner blocks the entire card on `fetchHistory`. | Pre-existing UX from story #4. Non-blocking (see Non-blocking #1). |
| Customer picker doesn't refetch on parent remount. | The modal mounts the picker fresh each open; stale customer state would only be visible if the operator deleted a customer in another tab while the modal was open. Non-blocking. |
| `window.confirm` / `window.alert` in `handleDelete` differs from the inline flash pattern used elsewhere in the panel. | Style inconsistency. Non-blocking. |
| BullMQ jobId dedup constraint for non-customer parameterized entries (`processAllTasks` with different `warmStart`). | ADR §Consequences documents this as accepted. Non-blocking. |

## Findings

### Blocking

1. **Branch is 76 commits behind `origin/staging`, and the implementation collides with shipped work on `origin/staging`.** This is the central issue. The story, ADR, tests, and implementation were all drafted and exercised against a snapshot of the repo that does not reflect what's been merged to mainline. Specifically:

   - **ADR number collision.** `engineering-team/decisions/0015-scheduled-tasks-with-arguments.md` (this branch) collides with `engineering-team/decisions/0015-task-queue-on-by-default.md` on `origin/staging`. ADRs 0016, 0017, 0018, 0019, 0020 also exist on `origin/staging`. **Asked change:** renumber this ADR (suggested: **0021** or whatever the next-free number is when rebasing onto `origin/staging`).
   - **Story number collision.** `engineering-team/stories/17-scheduled-tasks-with-arguments.md` (this branch) collides with `engineering-team/stories/17-task-queue-on-by-default.md` on `origin/staging`. Stories 18–23 also exist there. **Asked change:** renumber this story (suggested: **24** or whatever the next-free number is).
   - **Design-level collision (the heavier issue).** `origin/staging` has shipped **ADR 0019: Generalized task scheduler via BullMQ Job Schedulers** (Status: Accepted, 2026-05-22, story #22). ADR 0019 explicitly:
     - Retires the in-process `setInterval` scheduler that this branch's ADR 0015 builds on. `src/api/scheduled-tasks/index.js` on `origin/staging` is rewritten — `makeTriggerTask`, `startScheduler`, `stopScheduler`, the `setInterval` machinery, and the `timerState` map are all gone, replaced by a Redis-backed BullMQ Job Scheduler reconciliation layer.
     - Generalizes the panel to **any** registry task (the same goal this story's AC-1 set), but with a **one-entry-per-task** model — the data shape `origin/staging`'s `/api/scheduled-tasks/list` returns is `{success:true, tasks:[{taskId, enabled, schedule:{intervalDays,intervalHours,intervalMinutes,cron}}]}`, NOT this branch's `{entries:[{id, taskId, args, label, …}]}`.
     - Adds **cron + sub-hour intervals** and **durability** (survives control-panel restarts via Redis AOF) — capabilities this branch's ADR 0015 does NOT have.
     - Does **not** add the multi-entry-per-task + per-entry args support that motivated this story. **The operator's underlying need (schedule `processCustomer` per customer on independent cadences) is genuinely unmet by ADR 0019.**

   The consequence: **this implementation cannot rebase onto `origin/staging`.** The fundamental data model (`entries[]` vs `tasks[]`), the execution mechanism (`setInterval` vs BullMQ Job Schedulers), and the API shape are incompatible. A rebase would require either re-implementing the multi-entry+args concept on top of ADR 0019's BullMQ Job Scheduler pattern, or explicitly superseding ADR 0019 (which has been Accepted and shipped).

   **Asked change:** kick back to the Architect to amend ADR 0015 (or write a successor) that reconciles the multi-entry+args concept with ADR 0019's BullMQ Job Scheduler foundation. The likely shape:
   - Each scheduled entry remains identified by `entryId` (this branch's contribution) but enqueues via `Queue.upsertJobScheduler(`sched:${entryId}`, …)` on the *task's* BullMQ queue rather than via an in-process `setInterval`.
   - The job's `data` payload carries the resolved customer triple + warmStart/limit (computed at upsert time or at fire time via a custom processor wrapper).
   - The `scheduled-tasks.json` schema becomes the union: `{ version: 3, entries: [{ id, taskId, args, label, enabled, intervalDays, intervalHours, intervalMinutes, cron, lastError? }] }` — ADR 0019's per-task schedule fields plus this branch's per-entry args + label + UUID.
   - Migration: ADR 0019's `{ <taskId>: { enabled, intervalDays, intervalHours, intervalMinutes, cron } }` → v3 entries with `legacy:<taskId>` IDs, args `{}`. (My current migration.js targets the v1 shape — needs to be retargeted at ADR 0019's v2 / current shape.)
   - The UI's `ScheduledEntryCard` + `AddOrEditEntryModal` work largely re-usable; the backend handlers need to be rewritten to upsert/remove Job Schedulers rather than start/stop `setInterval` timers.
   - The reconciliation invariant from ADR 0019 must be preserved (file→Redis is authoritative; orphan schedulers removed at boot).

   This is genuinely a re-architecture, not a small fix. It almost certainly requires a new ADR (e.g., **0021 — per-entry args on top of the generalized scheduler**) that builds on ADR 0019 rather than ignoring it.

2. **Implementer was not able to verify the work against the live stack** — and the test plan's Reviewer-driven cycle-local smoke items cannot be exercised either, for the same reason. The local Docker container at `localhost:7778` runs `origin/staging` code; the new endpoints (`/api/scheduled-tasks/registry-tasks`) return 404 because they don't exist on `origin/staging`. The `vite build` succeeded on this branch's code, which is structural validation only. **Asked change:** once the Architect amends ADR 0015 and the Implementer reconciles with `origin/staging`, the cycle-local smoke needs to actually run against a container rebuilt with the reconciled code.

### Non-blocking

These are observations to flag for future iteration; none of them are merge-blockers on their own merit. They become irrelevant if Blocking #1 forces a substantial re-architecture (most of this code may be rewritten).

1. **`ScheduledEntryCard` blocks the entire card on `fetchHistory`** ([RelaySettings.jsx:1476](ui/src/pages/settings/RelaySettings.jsx:1476)). The schedule controls (toggle, days, hours, Save) could render immediately from the `entry` prop; only the Recent Runs table needs the async history. Pre-existing UX from story #4; non-blocking. Optional improvement: render the card immediately and show "Loading history…" only in the runs section.

2. **`window.confirm` / `window.alert` in `handleDelete`** ([RelaySettings.jsx:1674,1685,1688](ui/src/pages/settings/RelaySettings.jsx:1674)) breaks the panel's inline-flash pattern used elsewhere. Non-blocking style point; if the panel ever gets accessibility hardening (focus management, screen-reader behavior) the `confirm`/`alert` dialogs become low-hanging fruit.

3. **`CustomerPicker` doesn't refetch `/api/get-customers` on mount-cycle reuse.** Stale only if the operator deletes a customer in another tab while the modal is open. Mounting the modal fresh each open mitigates; non-blocking.

4. **Test plan's "BullMQ jobId dedup constraint for non-customer parameterized entries" is documented in ADR §Consequences as accepted** but has no automated test. Acceptable per the ADR; if Blocking #1 leads to reconciling with the BullMQ scheduler from ADR 0019, this constraint may evaporate or change shape and the test plan should be updated then.

5. **`OPERATIONS.md` docs note from ADR 0015** not added (file doesn't exist on this branch). Will need to be added when reconciling with `origin/staging`, where `OPERATIONS.md` exists.

## House rules check

- [x] Concept Graph API authority respected — no BIBLE.md / firmware JSON read for graphed concepts; no new concept-handle construction outside the established `kind:pubkey:slug` pattern.
- [x] No new lint / typecheck / build tooling introduced.
- [x] Per-phase commits — story (af483eee), ADR (b6888587), tests (9b66bc69), impl (c3cac6c3). ✓

## Verdict

**CHANGES_REQUESTED.**

The implementation, the ADR, the tests, and the story are **internally consistent and well-executed** — `npm test` is fully green, the UI builds, story #4's regression guards hold, and every AC has a corresponding passing test. The code itself is in good shape: the two pure modules (`migration.js`, `validation.js`) are tight and well-tested, the scheduler refactor preserves the story-#4 regex sentinels via deliberate comment placement, and the frontend components match the ADR plan.

**The blocker is environmental, not internal.** The story/ADR/test plan/implementation were all built against a local branch that was 76 commits behind `origin/staging`, and `origin/staging` has shipped a generalized task scheduler (ADR 0019 / story #22) that takes a fundamentally different architectural approach to the same problem space: one-entry-per-task + cron + BullMQ Job Schedulers + durability, instead of multi-entry-per-task + args + in-process `setInterval`. The two designs are incompatible at the data-model, execution-mechanism, and API-shape levels. The implementation cannot rebase onto `origin/staging` without re-architecting.

The operator's underlying need — schedule `processCustomer` for a specific customer on a recurring cadence, AND for multiple customers on independent cadences — is **genuinely unmet by ADR 0019**, so the work this story sets out to do remains valuable. But it needs to be redesigned on top of ADR 0019's BullMQ Job Scheduler foundation, not by superseding it.

**The single ask is for the Architect:** amend ADR 0015 (or write a successor numbered correctly against `origin/staging` — likely 0021) that reconciles the multi-entry-per-task + per-entry-args concept with ADR 0019's BullMQ Job Scheduler execution mechanism. Renumber the story too (likely **24**) to avoid collision with `origin/staging`'s shipped story #17 (task-queue-on-by-default).

Once that amendment lands and is approved, the Implementer can rebase onto `origin/staging`, retarget `migration.js` at ADR 0019's current on-disk shape (rather than story #4's), rewrite the scheduler handlers to upsert/remove BullMQ Job Schedulers (rather than start/stop `setInterval` timers), preserve the modal + customer picker + arg-field renderer (largely re-usable), and re-run the cycle-local smoke against a container rebuilt with the reconciled code.

Kick back to `/design-architecture`.
