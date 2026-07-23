# Review: Story 1 — Deploy-safety status endpoint

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-18
**Diff:** `git diff a570bae2..HEAD` (HEAD = `4baaa05e`, "impl: deploy-safety-status-endpoint"). The Gate-3 commit `a570bae2` (test suite + runner registration) audited as the tests the diff satisfies.
**Story:** `engineering-team/stories/deploy-safety-gate/1-deploy-safety-status-endpoint.md`
**ADR:** `engineering-team/decisions/deploy-safety-gate/0001-deploy-safety-status-endpoint.md`
**Test plan:** `engineering-team/stories/deploy-safety-gate/1-deploy-safety-status-endpoint.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **run three times in full by me.** The story's own suite passed **23/23 in all three runs**. The full gate:
  - **Run 1: `Overall: FAIL`** (exit 1 by `test/test.js:901`). Every *printed* summary line was PASS/SKIP — the failing term was one of the ~18 chain-gating suites that have **no summary line** (event-tagging family et al.; see Harness friction #1). Only a 120-line tail was captured, so the specific suite is unidentified; `deploy-safety-status: 23 passed, 0 failed, 0 skipped` is in the captured tail.
  - **Run 2: exit 1** — sole failure `profile-tags-publish suite: FAIL (6 passed, 1 failed)`: "typeahead search returns a profile tagged by a third-party author" — a live publish→Meili→search round-trip with **zero file overlap** with this diff. Same suite SKIPped in run 1 ("preconditions not met") and in the Director's Gate-4 run. Standalone reruns produced a third distinct outcome (the *overwrite* test failing on propagation) and then the explicit congestion skip: *"Meili task 794649 not indexed within 90s (task queue busy — re-run when the stream-consumer ETL settles)"* — Meili/ETL congestion on the shared local stack, settling over ~30 min. Deploy-safety-status: 23/23.
  - **Run 3 (after the ETL settled, nothing else touching the stack): clean.** Verbatim tail:

    ```
    router-stream-tag-filters suite:                 PASS (21 passed, 0 failed)
    tag-actions-menu-ui suite:                       PASS (30 passed, 0 failed) tagging-raw-event-inspector-ui suite:            PASS (25 passed, 0 failed)
    note-tagging-raw-events-inspector-ui suite:      PASS (32 passed, 0 failed)
    note-tagging-raw-events-inspector-http suite:    PASS (6 passed, 0 failed, 3 skipped)
    deploy-safety-status suite:                      PASS (23 passed, 0 failed)
    Total skipped:                                   50
    Overall:                                         PASS
    NPM_TEST_EXIT:0
    ```

    `Total skipped: 50` matches the Gate-4 baseline. The two `FAIL` strings elsewhere in run-3 output are prose inside test names ("FAILS OPEN", "offering FAIL as a verdict"), not failures.
  - **Judgment:** the runs-1/2 failures are environmental flakes in surfaces this diff does not touch (diff = new read-only module + one export + route registration; no contact with publish, Meili, strfry, or ETL paths), demonstrated by three different failure signatures across reruns and a fully clean run 3 on the identical tree. Not attributable to this story. Recorded as harness friction, not as a gate block.
- [x] `npm run test:playwright` — **N/A**: no UI in this story (test plan §Test infrastructure).
- [x] _Lint/typecheck/build not configured — skipped._

## Spec adherence

- [x] **AC-1 (one read-only unauthenticated GET, complete answer).** H1/H2/S3 pass. Verified myself: plain `curl http://localhost:7778/api/deploy-safety/status` (no credentials) → HTTP 200 with all three facts — running-now (`queue.activeCount`/`activeTasks`, `legacy.inFlightCount`), next fire (`schedule.nextFire` = `{entryId, taskId, label, at, inMs, withinBuffer}` | null), and the verdict in both spellings (`verdict`, `safeToDeploy`), plus `reasons`, `checkedAt`, `bufferMs: 600000`. Unauthenticated by fall-through: no `deploy-safety` entry anywhere in `src/middleware/auth.js` (grep clean), per ADR sub-decision 1. Read-only: 5 consecutive calls → `GET /api/scheduled-tasks/list` byte-identical before/after; handler code path is reads only (`getActive`/`getJobSchedulers`/ping, `readConfig`, Map iteration — `src/api/deploy-safety/index.js:88-176`).
- [x] **AC-2 (both running sources).** (a) U2 + H6 pass — H6 passed **live in all three runs**: `refreshApplicabilityLists` triggered, active window observed, verdict flipped unsafe with `QUEUE_TASK_RUNNING`. (b) U3 + S5 + S2 pass; `getInFlightCount()` iterates the live `customerTimers` Map (`src/api/customer-schedule/index.js:132-138`), whose values carry `taskRunning` (set at trigger `:55`, cleared by PID poll `:76-84`). Live legacy run **not driven** — it requires `processCustomer` (`resourceClass: "neo4j-heavy"`), forbidden for verification by the test plan and the book's autonomy ceiling. Documented coverage limit accepted: the seam coverage plus the in-process-Map property (restart clears it — cannot phantom) carries the criterion.
- [x] **AC-3 (phantom exclusion).** U1 (fabricated orphaned-TASK_START history under three key names — ignored) + S1 (source sentinel: no `events.jsonl`/`EVENTS_PATH`/`getRecentRuns`/`groupEventsIntoSessions` in the module) pass. Confirmed by my own read of `src/api/deploy-safety/index.js`: no history-file code path exists; running-now derives only from BullMQ actives + the in-memory legacy Map. Structural, as the ADR demanded.
- [x] **AC-4 (verdict policy).** U5 (edge `inMs === bufferMs` → unsafe, the `<=` rule), U6 (edge+1 → safe, fire still reported), U7 (none enabled → safe, `nextFire: null`), U8 (min-`at` selection), S4 + H1 (10-minute default pinned: `DEFAULT_BUFFER_MS = 10 * 60 * 1000`, `src/api/deploy-safety/index.js:30`) all pass.
- [x] **AC-5 (queue-disabled ≠ nothing-scheduled).** U10/U11 + H5 pass. Manual verify (test plan Known-limit #1): rather than restarting the shared local container with `TASK_QUEUE_ENABLED=false`, I exercised the real handler host-side (where `/etc/brainstorm.conf` is absent so the flag resolves falsy) → HTTP 200, `queue: {"enabled": false}`, verdict from `legacy.inFlightCount` only, no `QUEUE_STATE_UNAVAILABLE` — distinguishable from the live enabled response (`queue: {enabled: true, stateKnown: true, …, nextFire: null}`) exactly as AC-5 requires. This also proved the module requireable stack-free (no Redis at init). **Residual limit, stated honestly:** the end-to-end HTTP response of a real `TASK_QUEUE_ENABLED=false` *deployment* remains unexercised (the recipe is marked optional in the test plan; a container restart mid-review would have mutated the shared stack and invalidated my own gate runs).
- [x] No criterion silently dropped; no behavior beyond the story (see Scope).

### bufferMinutes validation (ADR sub-decision 2) — my own matrix

```
?bufferMinutes=abc  → 400 {"success":false,"error":"Invalid bufferMinutes 'abc' — must be a number > 0 and <= 1440"}
?bufferMinutes=0    → 400 (same envelope)
?bufferMinutes=-5   → 400 (same envelope)
?bufferMinutes=1441 → 400 (same envelope)
?bufferMinutes=45   → 200, bufferMs: 2700000 echoed
?bufferMinutes=1440 → 200, bufferMs: 86400000 echoed (boundary accepted)
?bufferMinutes=2.5  → 200, bufferMs: 150000 (fractional, un-rounded — logged Deviation 1)
```

Error envelope `{success:false, error}` matches the subsystem convention (`src/api/scheduled-tasks/index.js:360`).

## ADR adherence

- [x] Files match the ADR's implementation notes exactly: new `src/api/deploy-safety/index.js` (pure `computeVerdict` + `handleStatus`); `getInFlightCount()` added to `src/api/customer-schedule/index.js:132-138` with the ADR's grep-able retirement comment at both ends (`:126-129`, `:341`); registration in `src/api/index.js:487-488` — verified **outside** the `TASK_QUEUE_ENABLED` gate at `:513`, adjacent to the Scheduled Tasks block, exactly as prescribed.
- [x] Payload contract matches the ADR's response shape field-for-field (verified live, above). Reason codes limited to the four contract values (U12 + H1 assert; code emits only those four).
- [x] Fail-closed semantics (sub-decision 5): introspection failure or `isQueueAvailable() === false` while enabled → `queueStateKnown: false` → `QUEUE_STATE_UNAVAILABLE`, HTTP 200 (U9; `index.js:139-144, 55-57`). Lazy require of the queue module only inside the handler and only when enabled (`index.js:114-117`) — never at module init.
- [x] events.jsonl prohibition honored structurally (S1 + my read).
- [x] No new dependencies (diff touches no `package.json`); no new tooling.
- [x] Privacy sub-decision 4: `activeTasks` entries built as `{taskName, startedAt}` only (`index.js:121-124`); H6 asserts exactly-two-keys live; no `job.id`, no `job.data`, no customer pubkeys anywhere in the response. Legacy source exposed as a **count** only.

### Implementer Deviations (story §Deviations) — audited individually

1. **Fractional `bufferMinutes` un-rounded** — the ADR's validation rule applied literally; verified live (`2.5 → 150000`); test plan deliberately left rounding unpinned. **Within the ADR's letter.**
2. **`label` fallback to `taskId`** (`index.js:154`) — defensive only; the payload contract requires a string label and H1 asserts it. **Within.**
3. **`stateKnown: false` omits `activeCount`/`activeTasks`/`schedulerHalted`** (`index.js:178-181`) — extends the ADR's "omitted or null" allowance (stated for the disabled case) to the unknown-state case. Correct instinct: those numbers would be fabrications when introspection failed; H5 handles both branches; the only consumer contract story 2 leans on (`safeToDeploy`, `reasons`) is unaffected. **Within the ADR's spirit; no amendment required.**
4. **`schedule.enabledEntryCount` from `readConfig()` regardless of queue state** (`index.js:102-107`) — the ADR's payload contract shows an unconditional `schedule` block; the config file is readable when the queue layer is not. `nextFires` still gathered only when enabled+available, per the ADR. **Within.**

None of the four requires an ADR amendment.

## Concept-graph integrity

- [x] No concept handles appear in the diff; no concept definitions changed (story "Concepts touched: None", re-verified — no `39998`/`39999`/handle strings in the implementation diff).
- [x] Firmware reinstall: **not required** (per ADR §Consequences; nothing to reinstall).
- [x] `/summaries` orientation: performed at Planning/Architecture (46 concepts, none in this domain — recorded in story + ADR); the new code touches no concept surface, so no runtime orientation applies.

## Things tests can't catch

- [x] No secrets: grep of the full diff (and the Gate-3 test commit) for TA-pubkey literals, `npub1`/`nsec`, 64-hex strings, passwords/tokens — clean.
- [x] No leftover debug code. The single `console.warn` (`index.js:141`) is deliberate operational logging on the fail-closed path, consistent with subsystem practice (`src/api/index.js:522`). No commented-out code.
- [x] Security posture of the unauthenticated surface: read-only handler; input validation on the only parameter (400 matrix above); no injection vectors (no query interpolation into shell/db; `bufferMinutes` is `Number()`-coerced); response discloses task names + schedule metadata only — accepted by the ADR as on par with the already-unauthenticated `/api/scheduled-tasks/list`, with job ids/pubkeys excluded (verified).
- [x] Concurrency: the three sources are sampled non-atomically (queue actives, then legacy count) — a task starting between samples can be missed for that one response. Bounded by design: the ADR's conservative-windows section and story 2's wait-and-recheck absorb transients; the verdict is recomputed on every call. Not blocking.
- [x] Error paths: outer catch returns 500 `{success:false, error}` (`index.js:194-196`) — only reachable for truly unexpected failures (queue introspection is already fail-closed inside at 200). A `curl -sf | jq -e` consumer treats a 500 as unsafe, so even this path fails closed. Consistent with the ADR's intent.

## House rules check

- [x] Concept Graph API authority respected (no concept work).
- [x] No new lint/typecheck/build tooling.
- [x] No TA-pubkey literals (grep clean); the ADR's constraint that this surface touches no TA-pubkey plumbing holds — no author filters, no handle composition, no signing.
- [x] POV posture: deliberately not POV-scoped, with the reflex checks answered explicitly in the ADR's POV note (instance-level operational fact, not a perspective-dependent assertion). Correct layer.

## Product-guide adherence

N/A — acceptance-frame book, no PRD, no UI copy in this story.

## Scope

Diff contents: the new module, the one customer-schedule export, the route registration, the story's `## Deviations` section, and the Director's Gate-4 journal entry (harness bookkeeping, appropriate in the phase commit). Nothing else — no drive-by refactors, no unrelated file touches. Test-side: `git diff a570bae2..HEAD -- test/` is empty (Gate-4 verified; re-confirmed by the diff stat) — no test was weakened post-Gate-3.

## Findings

### Blocking

None.

### Non-blocking

1. **src/api/deploy-safety/index.js:60-64** — `computeVerdict` uses `Date.parse(f.at)` without a NaN guard; an unparseable `at` would yield `inMs: NaN`, `withinBuffer: false` (fail-open for that entry). Unreachable in practice — `at` comes from `getNextRun`'s `new Date(Number(mine.next)).toISOString()` (`scheduler.js:131`) — but a one-line `Number.isNaN` skip would make the pure core total. Optional.
2. **src/api/deploy-safety/index.js:123** — `new Date(job.processedOn || job.timestamp).toISOString()` throws if both are absent; the throw lands in the fail-closed catch (unsafe verdict), so the failure direction is correct, but the whole active-scan is then discarded for one malformed job. BullMQ always sets `timestamp`, so theoretical. Optional.

### Harness friction *(→ OPEN.md rows, type `meta` — Reviewer has no Edit; flagged to the Director to ledger)*

1. **~18 chain-gating suites print no summary line, making a failure among them nearly undiagnosable.** Run 1 printed a summary in which *every* line was PASS/SKIP yet `Overall: FAIL` — the failing term (one of `eventTaggingCore…tagApplicabilityPicker`, `test/test.js:838-859`) has no line in the "Test Results" block (verified: no summary print exists for them in `test/test.js`'s summary section), so identifying it requires scrolling the full multi-thousand-line live output. Sibling of OPEN.md #43 (chain/summary drift; #43's proposed self-assertion "every `*Result` in the chain appears in the summary" would catch this too).
2. **Publish-flow suites flake under Meili/ETL congestion and can cost full gate runs.** `profile-tags-publish` produced three different outcomes across four runs on an identical tree (SKIP-all "preconditions not met" / typeahead FAIL / overwrite-propagation FAIL / green-with-honest-SKIP "Meili task not indexed within 90s"). The congestion-detection SKIP exists but only guards one test's wait-gate; congestion manifesting after that gate becomes a hard FAIL of an unrelated story's gate run. Cost this review two full `npm test` cycles.

## Verdict

**PASS**

The diff is mergeable as-is: 23/23 story tests pass (three consecutive full runs), the full gate is clean on the identical tree (run 3, exit 0), every AC is demonstrated live or at its ratified seam, the ADR is followed to the letter including its prohibitions, all four logged deviations are within the ADR, and the two live flakes encountered are demonstrably outside this story's surface.

## On PASS (same change set)

- [x] Story `**Status:**` flipped to `Done` in place (`engineering-team/stories/deploy-safety-gate/1-deploy-safety-status-endpoint.md`); Review link filled in Linked artifacts.
- [x] Completion detection run: book `deploy-safety-gate` **not complete** — acceptance-frame bullets 1–3 are now satisfied by this story, but bullets 4 (cycle-skill safe-to-merge check + shared recipe), 5 (settings-panel countdown), and 6 (staging evidence) are open, owned by the epic's remaining stories. No `/close-book` offer.
