# Story 14: Speed up reconciliation — incremental mode with periodic full fallback

**Status:** Draft
**Created:** 2026-05-20
**Type:** Feature

## Background

The `reconciliation` task — orchestrated by `src/pipeline/reconciliation/reconciliation.sh` — exists to detect and fix drift between strfry (the canonical nostr event store) and the Neo4j-derived social graph (FOLLOWS, MUTES, REPORTS edges derived from kind 3 / 10000 / 1984 events). On nostr, follows and mutes can be revoked (so Neo4j edges may need to be both added and deleted), reports are append-only (only added).

It currently takes **6–8 hours per run** end-to-end. That cost is high enough that the operator has stopped running it on a schedule. Story #13 captures this directly in its 2026-05-20 operational note: *"reconciliation is unreliable and there's no point recalculating against a possibly-stale Neo4j."* In other words, slow reconciliation is now blocking the operator from confidently scheduling per-customer GrapeRank / PageRank recalculations — without periodic drift detection, there's no trust that the graph is in sync to begin with.

**Investigation findings** (from the conversation that produced this story — included here as informational context for the Architect, not as a prescribed solution):

- *Full strfry rescan on every run.* `strfryToKind3Events.sh` (and the kind-10000 / kind-1984 equivalents) already supports a `--recent <seconds>` flag that sets `"since": $timestamp` on the strfry filter, but the orchestrator `reconciliation.sh` invokes them with no args, so `SINCE_TIMESTAMP=0` and every kind-3 event ever is re-dumped on every run.
- *N+1 Cypher pattern.* `getCurrentFollowsFromNeo4j.js` (and the mutes/reports counterparts) loops over every rater pubkey and opens a fresh Neo4j session per pubkey with a 60s timeout race. With ~12M follow edges across an estimated 100K–250K raters, that's hundreds of thousands of round-trips per run.
- *Three event kinds run sequentially* in the orchestrator (mutes → reports → follows); they share no state.
- *Six sequential `cypher-shell` APOC invocations per kind* (adds, deletes, second pass), all serial.
- *Hundreds of thousands of tiny per-pubkey JSON files* are written then re-read by the diff step.
- *Hot-loop per-rater debug logging* (~6 `fs.appendFileSync` calls per pubkey) — pure overhead.
- *No early-exit pre-check.* A cheap edge-count comparison between strfry and Neo4j could let the task no-op when the graph is already in sync.

**Strategic directions** the Architect may consider (in roughly descending expected impact; informational, not binding):

1. Incremental mode — track a `lastReconciledAt` watermark and only inspect events / pubkeys changed since the prior successful run.
2. Cheap count pre-check — early-exit when strfry and Neo4j edge counts agree within tolerance.
3. Eliminate the N+1 — replace the per-pubkey Cypher loop with a single streamed paged query.
4. Parallelize the three event kinds in the orchestrator (they're independent).
5. Strip the per-rater debug log.
6. (Stretch) Replace per-pubkey JSON file fanout with a sorted JSONL + merge-join diff.

**Correctness constraint.** Incremental mode would miss drift caused by anything that is *not* a recent strfry event — e.g., a prior partial-write to Neo4j, a corrupted relationship from an earlier bug, a botched migration, or any prior incident that left the graph out of sync without leaving a strfry-side trace. The story therefore requires a periodic **full reconciliation fallback** that runs on a slower cadence and recovers from any such accumulated drift. Fast incremental is the routine default; full is the safety net.

**Scope boundary.** The older `src/pipeline/reconcile/` directory's `note.md` says it is "being deprecated in favor of the newer reconciliation module." This story works in `src/pipeline/reconciliation/`, not `reconcile/`. Whether to delete the deprecated directory is out of scope.

## User-facing description

**As the operator,** I want reconciliation to complete in minutes (not 6–8 hours) on a steady-state graph, while still catching any accumulated drift on a periodic basis, **so that** I can confidently schedule routine reconciliation runs and resume scheduled per-customer recalculations against a Neo4j I trust to be in sync with strfry.

## Acceptance criteria

- [ ] On a steady-state graph (strfry and Neo4j already in sync), reconciliation completes in **dramatically less time than the current 6–8 hour baseline** — concretely, in **minutes, not hours**. The exact target (e.g., < 15 minutes) is an open question for the Architect to propose in the ADR and the operator to ratify at the architecture gate.
- [ ] Reconciliation has two modes: a fast **incremental** mode (the routine default) and a **full** mode (current behavior; runs against the entire graph). Full mode is preserved as the correctness baseline and the periodic drift-recovery fallback.
- [ ] Incremental mode persists a watermark (e.g., `lastReconciledAt`, or equivalent state) across runs, so each incremental run only inspects events / pubkeys changed since the prior successful run.
- [ ] After an incremental run completes successfully, a subsequent full reconciliation against the same strfry + Neo4j state produces **identical** Neo4j edge sets (FOLLOWS, MUTES, REPORTS) — i.e., incremental mode is provably correct against the existing full-mode oracle.
- [ ] Reconciliation supports a periodic **full reconciliation** as the drift-recovery fallback. Both the cadence (e.g., weekly) and the first-run-after-deploy behavior (auto-promote to full, vs initialize watermark to deploy time, vs other) are open questions for the Architect to propose in the ADR and the operator to ratify at the architecture gate. Whatever the Architect chooses, the behavior must be documented and observable from logs.
- [ ] The operator can trigger either mode explicitly from the existing reconciliation surface (Task Registry / `/api/run-task`). Naming and parameters are the Architect's call, but the operator must not have to invoke a different shell script or learn a new entry point.
- [ ] When strfry and Neo4j are already in sync, reconciliation completes cheaply and reports "no drift detected" rather than running the full diff machinery. Whether this is a hard early-exit or just an observability log is the Architect's call.
- [ ] Reconciliation logs include: which mode ran, the watermark consumed and emitted, edge counts before and after for each of the three kinds, drift detected (adds/deletes), and per-stage timing. The log surface must be sufficient that the operator can answer "is my reconciliation actually catching drift, and how much?" from `/var/log/brainstorm/reconciliation.log` alone.
- [ ] No regression in detected-drift outcomes: any drift that a **full** reconciliation today would catch and fix, the new pipeline must still catch and fix on a full run.
- [ ] Operator documentation (`OPERATIONS.md` or equivalent) covers: the two modes, the watermark, the default cadence for each, how to force a full run for incident recovery, and how to inspect the watermark state.

## Concepts touched

To be resolved by the Architect via `/api/concept-graph/summaries`:

- Reconciliation pipeline (`src/pipeline/reconciliation/`)
- strfry event store (kinds 3 = contact lists, 10000 = mute lists, 1984 = reports)
- Neo4j social graph (FOLLOWS, MUTES, REPORTS relationships; NostrUser nodes)
- Task Registry entry for reconciliation
- `/api/run-task` (the operator-facing trigger surface — see story #13)

## Out of scope

- **Deleting the deprecated `src/pipeline/reconcile/` directory.** `note.md` says it's being deprecated; cleanup is a separate housekeeping task.
- **Changing the underlying Neo4j data model** (relationship types, NostrUser node shape).
- **Routing reconciliation through the new BullMQ task queue** (story #13). Reconciliation continues to use whatever invocation path it uses today. If story #13 ships first, reconciliation will naturally benefit, but this story does not depend on it and must not be blocked by it.
- **A UI surface for triggering or monitoring reconciliation.** Operator continues to use the existing trigger paths (Task Explorer, direct `/api/run-task`, systemd).
- **Adding new Neo4j indexes or schema constraints** — if the Architect believes one is needed for the streaming paged query to be fast enough, that becomes a sub-decision in the ADR.
- **Reconciling event kinds beyond 3 / 10000 / 1984.** Only the three kinds the current pipeline covers.
- **Pruning or rotating the per-pubkey JSON intermediate files** beyond what the Architect's chosen design naturally requires.

## Open questions

To resolve at the architecture gate (the operator has explicitly deferred these to the Architect):

1. **Steady-state runtime target.** "Minutes" — exact upper bound (e.g., < 5, < 15, < 30 minutes) is the Architect's recommendation; operator ratifies.
2. **Default full-reconciliation cadence.** Weekly automatic? Daily at low-traffic hour? Manual-only? Architect proposes; operator ratifies.
3. **First-run-after-deploy behavior.** Auto-promote to full vs initialize watermark to deploy-time vs other. Architect proposes; operator ratifies.
4. **Cheap-pre-check semantics.** Hard early-exit on count-match, or always log a warning when counts match but still run the diff? Architect proposes.
5. **Story #13 (BullMQ task queue) interaction.** This story does not strictly depend on story #13, but the operator note in #13 (2026-05-20) calls out reconciliation reliability as what's gating their willingness to resume scheduled per-customer recalculations. Captured in Background; no decision required.

## Testability notes

How we'll know it works (informational; the Tester writes the actual test plan in Phase 3):

- **Correctness oracle:** the existing full reconciliation is the oracle. A test fixture that seeds a known-drift state in strfry + Neo4j, runs full reconciliation, snapshots Neo4j, then runs incremental from a fresh watermark against the same fixture — and asserts identical Neo4j state.
- **Drift-detection regression:** a fixture that introduces drift in a way that no *recent* strfry event signals (e.g., directly corrupt a Neo4j FOLLOWS edge without producing a corresponding event). Incremental should miss it; full should catch it. Both are passing behaviors — the test asserts the expected difference, demonstrating why the periodic full fallback is necessary.
- **Runtime measurement:** a benchmarked run on a snapshot of (or the closest staging equivalent to) the production-scale graph demonstrating sub-target steady-state runtime. The headline metric should be a logged measurement in the test plan, not just a unit assertion.
- **First-run-after-deploy:** a fresh-install fixture asserts the first run takes the documented path (full-promotion or watermark-initialization, whichever the Architect picks).
- **Idempotency:** running incremental twice in a row with no intervening events does not double-write, double-delete, or advance the watermark in a way that creates a gap.
- **No-drift no-op:** with strfry and Neo4j perfectly in sync, the cheap-pre-check (if adopted by the Architect) returns in the documented fast-path budget and emits a "no drift detected" log line with edge counts.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
