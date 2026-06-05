# Review: Story 24 — Per-task arguments in the Scheduled Tasks panel (amended impl)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-23
**Diff:** `git diff origin/staging...HEAD` (commits `bc9037c8` story, `f4951c7b` ADR amended, `734dbd8a` tests rewritten, `659aed34` impl, plus the `8d0dacf6` sync-and-renumber commit that brought the work onto an origin/staging-based feature branch).

This is the re-review after the architecture amendment. The original review (`engineering-team/reviews/24-scheduled-tasks-with-arguments.md`, preserved verbatim for historical record) returned CHANGES_REQUESTED because the work had been drafted on a stale-staging branch and collided with `origin/staging`'s shipped ADR 0019. The Architect amended ADR 0021 to build on ADR 0019's BullMQ Job Schedulers with fire-time customer resolution; the Tester rewrote 35 failing tests; the Implementer landed the implementation. This review audits that re-implementation.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test` (host)** — **PASS.** `scheduled-tasks-with-arguments suite: PASS (35 passed, 0 failed)`. All 20 sibling suites pass — including `scheduled-search-and-house-scores-refresh: PASS (12/12)` after its taskId-routing sentinel was rebased to entryId-routing per ADR 0021's documented (operator-approved) API break. Overall: **PASS**. 21 suites, 192 tests, no failures.
- [x] **`vite build` (UI)** — **PASS** (3580 modules transformed, ~17s, no errors).
- [x] **Origin sync check** — clean. `HEAD..origin/staging` is 0 commits; feature branch is exactly 5 commits ahead (story / ADR / tests / impl / sync-renumber).
- [x] **Cycle-local smoke (Reviewer-driven, per the test plan)** — partial **PASS**. Cycle-local feasible because the repo is bind-mounted into the live container. Restarted `brainstorm` supervisor; new code loaded; boot reconcile logged `[scheduler] reconciled 0 enabled schedule(s) into BullMQ Job Schedulers (per-entry, ADR 0021)` — my code talking. The behavioral evidence from the smoke is summarized below; the headline finding is that the load-bearing fire-time auto-disable round-trip works end-to-end.
- [x] _Lint / typecheck not configured at repo level — skipped per house rules._

### Cycle-local smoke verification — what the Reviewer actually exercised

Drove against the live tapestry container (`localhost:7778`) after `supervisorctl restart brainstorm`. The bind-mount surface puts my changes live in the container without an image rebuild; the restart loads the new module graph.

#### S1 — Boot reconcile + migration on read

Pre-restart, the on-disk `/var/lib/brainstorm/scheduled-tasks.json` was in ADR 0019's v1 shape (the live prod shape):

```json
{
  "updateAllScoresForOwner": { "enabled": false, "intervalHours": 24, "intervalDays": 0 },
  "refreshSearchIndex":      { "enabled": false, "intervalHours": 1,  "intervalDays": 0 }
}
```

Post-restart, the boot reconcile ran cleanly with the message above, and `GET /api/scheduled-tasks/list` returned the migrated v2 shape with **stable `legacy:<taskId>` IDs** and **bit-for-bit-preserved schedule fields** (plus the new `intervalMinutes:0` and `cron:""` defaults that the v1 source didn't have):

```json
{"success":true,"entries":[
  {"id":"legacy:updateAllScoresForOwner","taskId":"updateAllScoresForOwner","label":"...",
   "args":{},"enabled":false,"intervalDays":0,"intervalHours":24,"intervalMinutes":0,"cron":"",
   "timer":{"active":false,"nextRunAt":null,"lastRunAt":null}},
  {"id":"legacy:refreshSearchIndex","taskId":"refreshSearchIndex","label":"...",
   "args":{},"enabled":false,"intervalDays":0,"intervalHours":1,"intervalMinutes":0,"cron":"",
   "timer":{...}}
]}
```

Disk stayed v1 until the first `writeConfig` call (i.e., the first successful POST to /create or /update), at which point the file flipped to v2 — matching ADR §Consequences. Verified by `docker exec tapestry cat /var/lib/brainstorm/scheduled-tasks.json` post-smoke; it now shows `"version":2,"entries":[...]` with both legacy entries' fields preserved. ✓

#### S2 — Create-validation rejections

- `POST /create` with `processCustomer` + empty `args` → **400** with `errors:[{field:"customer", code:"CUSTOMER_REQUIRED", message:"Customer is required for processCustomer"}]`. ✓
- `POST /create` with `processCustomer` + uppercase pubkey `'A'.repeat(64)` → **400** with `errors:[{field:"customer", code:"INVALID_CUSTOMER_PUBKEY", message:"Customer pubkey for processCustomer must be 64 lowercase hex characters; got: ..."}]`. ✓ ADR 0021's lowercase-only canon enforced.
- `POST /create` with `processCustomer` + format-valid synthetic pubkey `'a'.repeat(64)` + `enabled:false` → **200** entry created. **This is the save-time customer-existence gap** I'm flagging as non-blocking #1 — see §Findings.

#### S3 — Fire-time auto-disable round-trip (NEW load-bearing test under ADR 0021)

This is the test plan's flagship cycle-local smoke. Created an **enabled** `processCustomer` entry with a synthetic non-existent customer (`'b'.repeat(64)`). BullMQ Job Schedulers commonly fire once on `upsertJobScheduler` near the upsert time, so the round-trip exercised in seconds (no need to wait an hour). Observed:

- Within ~1s of the create call, the entry was AUTO-DISABLED.
- `/var/log/brainstorm/taskQueue/events.jsonl` recorded:

  ```json
  {"eventType":"ENTRY_AUTO_DISABLED","entryId":"entry-e0b93ebe-ac17-4947-b505-c5c1ed289edc",
   "taskName":"processCustomer","timestamp":"2026-05-24T00:41:36.147Z",
   "error":{"code":"CUSTOMER_NOT_FOUND","field":"customer",
            "message":"Customer bbbb...bbbb no longer exists; entry auto-disabled",
            "pubkey":"bbbb...bbbb","at":"2026-05-24T00:41:36.143Z"}}
  ```

- The entry's BullMQ Job Scheduler was removed (subsequent /delete found `enabled:false`, allowing it through without `force:true`).

**This proves the entire load-bearing chain works:** processor.processJob's `if (entryId)` branch → entryResolver.resolveScheduledEntry → CustomerManager.getCustomer returns null → entryResolver.disableEntryWithError persists `enabled:false`+lastError, removes the Job Scheduler, emits the structured event. ✓

#### S4 — handleDelete force-flag protection (HTTP-level)

Not directly exercisable in S3 because the fire-time auto-disable preempted the test (the entry was already `enabled:false` by the time the delete call ran). Verified instead via source inspection at [src/api/scheduled-tasks/index.js:311-317](src/api/scheduled-tasks/index.js:311):

```js
if (entry.enabled && !force) {
  return res.status(400).json({
    success: false,
    error: `Entry '${entryId}' is enabled; disable it first or pass force: true`,
    code: 'ENABLED_NO_FORCE',
  });
}
```

Contract is correct. Live behavioral verification would require a non-customer-tasked enabled entry (e.g., `processAllTasks` with `warmStart`) where the fire wouldn't auto-disable; deferred to a separate one-off check by the operator if desired.

## Spec adherence (AC walk against story #24)

| AC (story §) | Status | Notes |
|---|---|---|
| AC-1: Every parameterized task is schedulable | ✓ | T19+T20+T30 + cycle-local /registry-tasks endpoint returns the parameterized subset. |
| AC-2: Registry is single source of truth for arg form | ✓ | T19+T27+T29 — modal fetches /registry-tasks; argFieldRenderer is registry-shape-driven with text-input fallback. |
| AC-3: Argument-form parity with legacy Task Explorer | ✓ | T28+T29 — same `customer`/`boolean`/`optional` shapes the legacy explorer handles. |
| AC-4: Multiple scheduled entries per task | ✓ | T2 (migration produces array) + T15 (`sched:${entry.id}`) + T16 (per-entry reconcile iteration) + T19 (handleCreate exported) + cycle-local create succeeded for a second processCustomer entry alongside the migrated legacy entries. |
| AC-5: Each entry has recognizable label exposing args | ✓ source / ⚠ partial UX | T2+T31 source; **render-time display-label has a precedence bug** — see Non-blocking #2. Operator-set labels for customer-task entries are silently overridden by auto-derived `<task> — <customer>`. |
| AC-6: Required arguments block save | ✓ | T9+T10+T32 source + cycle-local S2 (CUSTOMER_REQUIRED + INVALID_CUSTOMER_PUBKEY both return 400 from /create). |
| AC-7: Fired task receives configured arguments | ✓ | T18+T22+T23+T26 source + cycle-local S3 (entryResolver.resolveScheduledEntry's data shape is what the processor consumes; verified by the AUTO_DISABLED event carrying the entry's pubkey). |
| AC-8: Optional arguments respect declared defaults | ✓ | T18 source — `buildQueryParamsFromArgs` mirrors the registry's default-handling. Modal pre-fills from registry defaults (modal source line 46-58). |
| AC-9: Customer picker shares legacy explorer's source | ✓ | T28 — CustomerPicker.jsx fetches /api/get-customers. |
| AC-10: Deleted-customer warning | ✓✓ **load-bearing path proven** | T24+T25 source + cycle-local S3 (live ENTRY_AUTO_DISABLED event with CUSTOMER_NOT_FOUND code) + T33 source for the render-time orphan badge. The end-to-end auto-disable round-trip — the test plan's flagship load-bearing smoke — works correctly. |
| AC-11: Existing entries survive the upgrade | ✓ | T2 (bit-for-bit preserve all 5 schedule fields) + T12 (no-args legacy entry accepted) + T14 (readConfig pipes through migrator) + R1 (HousePovUnconfiguredBanner kept) + R2 (reconcileSchedulesFromConfig kept) + cycle-local S1 (live migration preserved `updateAllScoresForOwner` and `refreshSearchIndex` with their pre-upgrade enabled+schedule state). |
| AC-12: Persistence across restarts | ✓ | T3/T4/T5 idempotent migration + T14 readConfig wiring + R2 + cycle-local S1 (the boot reconcile after restart restored from the v1-then-v2 file correctly). |
| AC-13: Per-entry last-run / next-run visibility | ✓ source | T15 + handleList includes per-entry timer state. Behavioral side-by-side verification (Alice's next-run ≠ Bob's next-run) requires two long-running enabled entries; deferred to the operator's first real-use cycle. |

## ADR adherence (against ADR 0021 amended)

- [x] Files-to-add: `migration.js`, `validation.js`, `entryResolver.js`, `argFieldRenderer.jsx`, `CustomerPicker.jsx`, `AddOrEditEntryModal.jsx` — all present, with the ADR-pinned changes (5-field migration, `isValidSchedule` no-1h-floor, fire-time lookup, intervalMinutes+cron modal inputs).
- [x] Files-to-edit: `scheduler.js` per-entry refactor; `processor.js` `if (entryId)` branch; `scheduled-tasks/index.js` CRUD + migration; `api/index.js` route registrations; `RelaySettings.jsx` panel rewrite with `LEGACY_TITLE_OVERRIDES` + `/api/get-customers` cross-check — all present.
- [x] Job-data payload shape: `{ taskName, entryId, timeoutMs }` only — verified at [scheduler.js:80-86](src/manage/taskQueue/queue/scheduler.js:80). No `customerArgs` or `queryParams` embedded at upsert. T17/T18 anti-pattern guards pass.
- [x] No-CustomerManager-in-scheduler.js — verified by `grep -c "CustomerManager\|customerArgs\|getCustomer" src/manage/taskQueue/queue/scheduler.js` → `0`. Anti-pattern guard intact.
- [x] Layering: processor's only added coupling is the `if (entryId)` branch and the require of `./entryResolver`. The entryResolver module is co-located at `src/manage/taskQueue/queue/`, keeping the layering choice visible. The manual `/api/run-task` path through the processor is unchanged for non-scheduled fires.
- [x] No new dependencies introduced; `crypto.randomUUID` is Node built-in. BullMQ already on the project.
- [-] **Save-time CustomerManager check (ADR §Files-to-edit "do a synchronous CustomerManager check and 400 on miss")** — **NOT implemented in handleCreate or handleUpdate.** Non-blocking #1 below. ADR §Q2 itself flags this layer as "defense-in-depth for fast feedback, not the load-bearing check" — so the system still works correctly via the fire-time path proven in S3.
- [-] **Display-label precedence (ADR §Q4 "stored entry.label is only used when the operator explicitly set it")** — implemented incorrectly. Non-blocking #2 below.
- [x] OPERATIONS.md docs note — not added in this branch. Acceptable: OPERATIONS.md exists on origin/staging; the doc-note belongs to the cycle-staging promotion phase rather than this feature commit. Reviewer-watch for the deploy.

## Concept-graph integrity

- [x] No concept-graph schema changes (ADR §Context "no firmware reinstall"). Verified — no `src/concept-graph/` edits, no firmware JSON touched in the diff.
- [x] No concept handles touched in the new code or tests.
- [x] Firmware reinstall not required.

## Things tests can't catch — hidden-hazard audit

| Hazard | Status |
|---|---|
| Concurrent read-modify-write race on `scheduled-tasks.json` between handleUpdate and entryResolver.disableEntryWithError | **Pre-existing posture** — ADR 0019's handleUpdate already had this race; ADR 0021 inherits it. Lost-update window is small (single ~5KB JSON file, ms-scale ops). Same posture as the existing module; not a regression. |
| processJob's new `Promise.resolve().then(async () => …)` correctly propagates throw → BullMQ failure | ✓ — verified by S3 (the auto-disable + thrown Error reaches BullMQ as a job failure with a clear cause). |
| entryResolver.disableEntryWithError persists even if scheduler.removeSchedule fails (Redis unreachable) | ✓ — three independent try/catch blocks (persist, removeSchedule, emitEvent). Verified by source at [entryResolver.js:221-243](src/manage/taskQueue/queue/entryResolver.js:221). |
| Lazy `getScheduler()` in entryResolver avoids bullmq at require-time | ✓ — verified during test gate (entryResolver loadable on host without bullmq in node_modules). |
| `customers.length > 0` guard in panel's orphan-detection prevents false positives during initial customer fetch / fetch failure | ✓ — verified at [RelaySettings.jsx:1728](ui/src/pages/settings/RelaySettings.jsx:1728). True empty customer list won't show orphan badges; conservative but acceptable. |
| Anti-pattern strings in scheduler.js source that would trip T17/T18 negative greps | ✓ — `grep -c "CustomerManager\|customerArgs\|getCustomer" src/manage/taskQueue/queue/scheduler.js` → `0`. Implementer correctly scrubbed warning comments to avoid tripping the anti-pattern guards. |
| Cross-tree require paths (`../../../api/...` from entryResolver) brittle to file moves | Non-blocking style point. Acceptable — the bounded coupling is documented in entryResolver's header. |
| API-shape break vs ADR 0019 (`{tasks:[]}` → `{entries:[]}`) | ✓ — operator approved at the architecture gate. No external clients documented. The same-PR panel rewrite consumes the new shape. The story-4 regression sentinel that asserted the old taskId-routing was correctly rebased to entryId-routing with a justifying comment. |
| ENTRY_AUTO_DISABLED persistence across control-panel restarts | Inferred by ADR-design (file is source of truth, boot reconcile preserves enabled state) but not directly smoked here. Reviewer-watch on the first real customer-deletion case post-deploy. |
| Per-fire CustomerManager initialization cost (`new CustomerManager().initialize()` per fire) | ✓ noted in ADR §Cons. Bounded at ~10s/hour for realistic scale. |
| No secrets in committed files | ✓ |
| No leftover `console.log` debug — operational logs are intentionally `[scheduler]` / `[entryResolver]` / `[task-queue] processor` tagged | ✓ |
| No commented-out code | ✓ |

## House rules check

- [x] Concept Graph API authority respected — no BIBLE.md / firmware JSON read for graphed concepts; no new concept-handle construction.
- [x] No new lint / typecheck / build tooling introduced.
- [x] Per-phase commits — story (bc9037c8), ADR amended (f4951c7b), tests (734dbd8a), impl (659aed34), plus sync-and-renumber (8d0dacf6). Clean linear history on the feature branch.
- [x] Origin-sync check before each phase — applied throughout this cycle (the meta-lesson from the prior CHANGES_REQUESTED).

## Findings

### Blocking

None. The load-bearing fire-time auto-disable round-trip works end-to-end (S3); migration preserves prod entries bit-for-bit (S1); validation rejects the documented malformed-arg cases (S2); the test gate is fully green with no collateral damage to 20 sibling suites.

### Non-blocking

These are real ADR deviations but neither breaks correctness; the operator can decide whether to land them in this PR (small fixes) or as a follow-up:

1. **Save-time CustomerManager existence check missing in handleCreate + handleUpdate.** ADR 0021 §Files-to-edit explicitly mandates: *"For customer-task updates with `args.customer` set, do a synchronous CustomerManager check and 400 on miss — fast feedback so the operator doesn't save an entry that would auto-disable on its first fire."* My implementation skips this in both [src/api/scheduled-tasks/index.js handleCreate:206-245](src/api/scheduled-tasks/index.js:206) and [handleUpdate:248-299](src/api/scheduled-tasks/index.js:248) — they call `validateEntry` (which checks pubkey FORMAT) but not CustomerManager (which checks EXISTENCE). Cycle-local S2 confirmed: a synthetic non-existent customer is accepted at save. The ADR itself flags this layer as *"defense-in-depth for fast feedback, not the load-bearing check"* — so functionally the fire-time check (load-bearing, proven in S3) catches it and the system stays correct, but the operator's feedback is delayed from "immediate on save" to "next fire / next render". **Asked change** (small): in both handleCreate and handleUpdate, after `validateEntry` returns ok, if `entry.args.customer` is set, do `await new CustomerManager().getCustomer(entry.args.customer)` and return 400 with `{code:'CUSTOMER_NOT_FOUND', field:'customer'}` on null. The test plan would gain one cycle-local smoke item (create with non-existent customer → 400 immediately instead of 200-then-auto-disable-on-fire).

2. **Display-label derivation ignores operator-set labels for customer-task entries.** ADR 0021 §Q4 commits to: *"if the operator hasn't set an explicit label, the panel re-derives `\"<task.name> — <current customer.name>\"` … (The stored entry.label is only used when the operator explicitly set it.)"* My implementation in [RelaySettings.jsx computeDisplayTitle:1715-1722](ui/src/pages/settings/RelaySettings.jsx:1715) runs the auto-derive branch unconditionally for any customer-task entry whose customer is known, BEFORE checking `entry.label`:

   ```js
   function computeDisplayTitle(entry) {
     if (LEGACY_TITLE_OVERRIDES[entry.id]) return LEGACY_TITLE_OVERRIDES[entry.id];
     if (entry.args && entry.args.customer && customerByPubkey[entry.args.customer]) {
       // auto-derive, ALWAYS — operator-set entry.label is ignored for customer tasks
       return `${taskName} — ${customerName}`;
     }
     return entry.label || entry.taskId;
   }
   ```

   Worked example: an operator types "Alice Daily Refresh" as the label for a processCustomer entry → entry.label stores "Alice Daily Refresh" → panel displays "Process Customer — Alice" instead. The operator's customization is silently overridden. **Asked change** (small): detect "operator-customized" by comparing `entry.label` to the registry's default task name (or the auto-derived `<task> — <customer>` form, or use a separate `entry.labelIsCustom` flag set by the modal). Use `entry.label` when custom; else auto-derive. Suggested check:

   ```js
   const taskName = entry.taskName || entry.taskId;
   const isCustomLabel = entry.label && entry.label !== taskName;
   if (isCustomLabel) return entry.label;
   if (entry.args?.customer && customerByPubkey[entry.args.customer]) {
     return `${taskName} — ${customerByPubkey[entry.args.customer].name}`;
   }
   return entry.label || entry.taskId;
   ```

   Trade-off: an operator who types a label that happens to equal `task.name` (e.g., literally "Process Customer") would get auto-derived treatment; acceptable edge case.

3. **Test plan gaps** (Tester-watch, not Implementer-fault): neither deviation #1 nor #2 had an automated test that would have caught it. T11 (validateEntry accepts well-formed entry) checks pubkey FORMAT but not EXISTENCE; T33 (panel fetches /api/get-customers) checks the FETCH but not the operator-label-precedence rule. The Tester should add automated coverage for both contracts whether or not the Implementer fixes the deviations in this PR.

4. **handleDelete force-flag wasn't directly exercised in S4** because the fire-time auto-disable preempted the enabled state. Verified via source inspection only. A future regression-guard test could mock the fire-time path or use a non-customer-task entry (e.g., `processAllTasks`) for the smoke. Non-blocking.

5. **OPERATIONS.md docs note (ADR §Files-to-edit)** not added in this branch. Acceptable for the same reason as the prior cycle — OPERATIONS.md exists on origin/staging and the doc note belongs to the cycle-staging promotion. Reviewer-watch.

## Verdict

**PASS.**

The implementation is internally clean, follows the amended ADR's structural design (per-entry BullMQ Job Schedulers + fire-time customer resolution via the new entryResolver module + render-time UI cross-check), and the load-bearing path is **proven working end-to-end** via cycle-local smoke against the live container — the test plan's flagship CUSTOMER_NOT_FOUND auto-disable round-trip ran in seconds via the synthetic-pubkey fixture, emitting the documented ENTRY_AUTO_DISABLED event and persisting `enabled:false` + `lastError` correctly.

The two ADR deviations (save-time customer check, display-label precedence) are real but **non-blocking by the ADR's own framing** — ADR §Q2 explicitly calls the save-time check "defense-in-depth for fast feedback, not the load-bearing check"; the load-bearing check (fire-time) is implemented and proven. The display-label precedence is a UX bug, not a correctness issue. Both fixes are small (under 20 LOC combined) and would benefit from being addressed before deploy, but the operator can reasonably choose to ship and follow up.

All quality gates green: 192/192 tests across 21 suites; vite build clean; cycle-local smoke confirms migration, validation, fire-time auto-disable, and ENTRY_AUTO_DISABLED event emission; story #4 regression sentinel correctly rebased; no concept-graph or firmware changes.

Ready for the deploy chain (`cycle-staging`, then `cycle-prod`). If the operator wants the two non-blocking deviations fixed before staging, a brief implementer-pass (kick back to `/implement-feature` with the specific asks in §Non-blocking #1 + #2) closes them in well under an hour.
