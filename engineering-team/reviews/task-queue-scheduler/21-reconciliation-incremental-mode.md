# Review: Story 21 — Speed up reconciliation (recent / all / author modes)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-21
**Diff:** `git diff origin/staging...HEAD` (impl commit `c83ccc2a`; story `b2e8bc62`, ADR `5ac95656`, tests `c92f47aa`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. `reconciliation-incremental-mode` 15/15 (T1–T10 flipped to PASS, R1–R5 hold). All 16 prior suites green, including `task-queue-bullmq` 18/18 and `task-queue-neo4j-resource-class` 14/14 (confirms the processor.js/runTask.js edits did not regress story #13/#15). Overall: PASS.
- [ ] `npm run test:playwright` — n/a (no frontend in this story; the `reconcileAuthor` UI is a separate follow-up).
- [x] _Lint / typecheck / build — not configured; skipped per project rules._
- [x] Bash `bash -n` + `node --check` + `jq empty` clean on all modified scripts/JSON.

## Spec adherence

Source/sentinel level — verified now:
- [x] AC-2 (modes) → `reconciliation.sh` parses `--mode recent|all|author` + `--pubkey`; three registry keys (T2, T8).
- [x] AC-3 (watermark) → `reconciliationState.sh` + `state.json`, `--recent` from `lastRunStartedAt − overlap` (T1, T3).
- [x] AC-5 (full fallback + first-run) → `reconcileAll`; first-run bootstrap (T5, T8).
- [x] AC-6 (same script, existing surface) → three keys → one `reconciliation.sh` (T2, T8).
- [x] AC-7 (no-drift cheap) → `no_drift` early-exit via `strfry scan --count` (T4).
- [x] AC-8 (logging) → `mode`/`watermark`/per-kind `added`/`deleted`/`edge_counts_before`/`edge_counts_after`/`duration` (T9).
- [x] AC-10 (docs) → OPERATIONS.md §12 (T10).

Behavioral level — **NOT yet verified** (see Verdict condition): AC-1 (runtime < 15 min), AC-4 (incremental output == full output, the oracle), AC-7 (real sub-minute no-op), AC-9 (full-run drift detection) are validated only by cycle-local smoke **S1–S10**, which require a live strfry + Neo4j stack and the production-only node deps. They are unrunnable in this dev checkout and remain the authoritative gate.

## ADR adherence

- [x] Author-restricted extraction reuses the diff + APOC apply + converters **verbatim** (R1–R5 green; `reconciliation.sh` calls the unchanged `calculate*Updates.js` / `apocCypherCommand*` / `kind*EventsTo*.js`).
- [x] The correctness invariant is implemented: in `recent`/`author`, `extract_and_dump` (reconciliation.sh) dumps strfry **first**, then runs the Neo4j extractor with `--authorsFromDir` pointing at the **same** `currentRelationshipsFromStrfry/<label>/` dir — both sides restricted to the identical covered author set. `cleanup()` wipes the dirs each run (R4), so no stale-file leakage.
- [x] `neo4j-heavy` tagging matches ADR: `reconcileRecent`/`reconcileAll` tagged, `reconcileAuthor` not.
- [x] Cadence in the scheduler (no in-script cadence); first-run bootstrap is the only in-script auto-promotion.
- [x] No new external dependencies. No lint/typecheck/build tooling added.
- [⚠] **One disclosed deviation beyond the ADR's file list** — see Finding NB-1.

## Concept-graph integrity
- [x] N/A — operational/ETL plumbing, no domain concepts touched. No firmware reinstall (ADR 0018 §Concept-graph impact confirms). No BIBLE.md re-derivation.

## Things tests can't catch
- [x] No secrets committed. No leftover debug logging — the per-rater `currentRaterBatch` log is gone from the follows extractor (T7); the remaining `console.log` at `getCurrentFollowsFromNeo4j.js:98` is the pre-existing `log()` helper (console+file), consistent with the mutes/reports extractors.
- [x] No commented-out code; the rewrite removed the old `COMMENT_BLOCK` heredoc and dead Step-5B block.
- [x] Concurrency: with the queue on (ADR 0015), reconcileRecent runs at per-task concurrency 1 with jobId dedup, so overlapping scheduled triggers don't spawn concurrent runs; the `neo4j-heavy` semaphore serializes the sweeps against owner recalcs.
- [x] Error path: `set -e`/`pipefail` retained; on failure the watermark is **not** advanced (write_state only runs after the phases), so a failed run re-covers its window. The `no_drift_since` parser returns "uncertain" (proceed) rather than early-exiting on an unparseable count — fail-safe.
- [⚠] Timeout sizing — see Finding NB-2.

## Findings

### Blocking
_None._

### Non-blocking

1. **NB-1 — `staticArgs` mechanism added beyond the ADR's file list.** `src/manage/taskQueue/queue/processor.js:21` (`buildChildArgs`) and `src/api/manage/commands/runTask.js:80` (`buildTaskCommand`) gained a `taskDef.staticArgs` channel (word-split, prepended to args). ADR 0018 §Impl 5 said the registry entries invoke `reconciliation.sh --mode X` but did not specify the arg-passing mechanism — neither runner had one (only `customer`/`limit`/`warmStart`), and `launchChildTask` validates the script path as a file so args can't be smuggled into it. The addition is the minimal way to realize the ADR's explicit design: additive, gated on `taskDef.staticArgs` presence (no behavior change for existing tasks), correct on the read-through (`processor.js` joins → launchChildTask.sh:344 `bash "$child_script" $child_args` word-splits), and the 32 task-queue tests stay green. **Accepted.** Recommend the Architect add a one-line note to ADR 0018 §Impl 5 recording the `staticArgs` channel so the contract matches reality.

2. **NB-2 — `reconcileRecent` timeout (30 min) is smaller than a first-run bootstrap (full pass, hours).** `taskRegistry.json` sets `reconcileRecent` timeout to 1,800,000 ms, but the ADR-mandated first-run bootstrap performs a `--mode all` pass that can take 6–8 h. This is **not** a correctness break: the registry timeout uses `forceKill: false`, and `launchChildTask.sh:403–412` only `kill -9`s when `forceKill == true` — so a timed-out bootstrap is marked "timeout" (exit 124) for reporting but keeps running to completion and writes the watermark; with the queue on, concurrency-1 + dedup prevent an overlapping trigger from interrupting it. The artifact is a **misleading "timeout" status** on the first-deploy bootstrap run. Recommend either (a) size `reconcileRecent`'s timeout to accommodate a bootstrap (e.g. match `reconcileAll`), or (b) document in OPERATIONS.md §12.1 that a fresh deploy should run `reconcileAll` once to seed the watermark (its 8 h timeout fits), after which `reconcileRecent` runs incrementally. Either is a small change; flagging for the Implementer/operator to pick.

3. **NB-3 — legacy `reconciliation` key is not `neo4j-heavy`.** Kept unchanged for back-compat (`processAllTasks.sh:152` calls it; now defaults to `recent`). Within `processAllTasks` it runs sequentially so there's no contention, but a *manual* trigger of the legacy key during an owner recalc would not serialize. Minor hardening opportunity: tag it `neo4j-heavy` too, or point `processAllTasks` at `reconcileRecent`. Non-blocking.

4. **NB-4 (pre-existing, out of scope) — reports converter append semantics.** `kind1984EventsToReports.js` (reused verbatim) `appendFileSync`s one object per event; kind 1984 is not replaceable, so an author with multiple reports yields multiple newline-separated objects in one per-pubkey file, which `calculateReportsUpdates.js`'s `JSON.parse(readFileSync(...))` may not handle. This behavior is unchanged by story #21 (converters reused), so `recent` mode is no worse than today's `all` mode for reports. Noting only so a future story can verify reports reconciliation independently.

## House rules check
- [x] Concept Graph API authority respected (N/A — no concepts).
- [x] No new lint/typecheck/build tooling.
- [x] Per-phase commits followed; commit messages reference story #21 + ADR 0018.

## Verdict

**PASS** (source/design audit), with one mandatory pre-production condition.

The diff faithfully implements ADR 0018: author-restricted incremental reconciliation with the correctness invariant intact, the diff/apply/converters reused verbatim, correct `neo4j-heavy` tagging, and clean quality gates. The single ADR deviation (NB-1) is minimal, necessary, correct, and disclosed. NB-2/3/4 are non-blocking.

**Mandatory before promoting to production:** run the cycle-local smoke **S1–S10** from the test plan against a live stack (via `cycle-local`, then validated again on staging via `cycle-staging`) — these are the authoritative behavioral gate that `npm test` cannot cover. The headline checks are **S1 (incremental output == full output, the oracle)**, **S4 (recent misses non-event drift, all catches)**, and **S6 (first-run bootstrap)** — the last of which will also surface the NB-2 timeout-status behavior in practice.

Mergeable to `staging` as-is; **not** to be promoted to `main` until S1–S10 pass on the live stack.
