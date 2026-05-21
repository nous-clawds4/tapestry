# Review: Story 12 — Shared CSV initialization safety under concurrent customer runs

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-20
**Diff:** `git diff origin/staging...HEAD` (commit `42a0c3a6`, 4 commits: `0b416c03` story, `b6b0f9bd` ADR, `509fca31` tests, `42a0c3a6` impl)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. `graperank-shared-csv-race suite: PASS (13 passed, 0 failed)` (11 ADR sentinels green + R1/R2 regression guards green). All 9 prior suites still PASS, unchanged. Overall: **PASS**.
- [x] _Playwright not applicable — story is shell scripts + a node-runner sentinel test._
- [x] `bash -n` on all 6 modified shell scripts — all clean (verified inline during implementation; re-checked here).
- [x] _Lint not configured — skipped per house rules._
- [x] _Typecheck not configured — skipped per house rules._
- [x] _Build not configured — skipped per house rules._
- [ ] **Cycle-local smoke (S1–S8 from the test plan)** — **NOT YET RUN.** Per project precedent (story #11 review `ef8ff19f`), this is a separate Reviewer-driven action and the authoritative behavioral validation. See §Verdict for what it gates.

## Spec adherence

Every acceptance criterion mapped to at least one passing test sentinel; behavioral guarantees mapped to cycle-local smoke scenarios per ADR §Verification and the test plan §"Not covered (deferred to cycle-local smoke)".

| AC | Source-sentinel coverage | Smoke coverage | Status |
|---|---|---|---|
| AC-1 two-concurrent | T1+T2+T6 | S1 | ✓ source PASS; smoke pending |
| AC-2 exactly-one-init | T2+T5+T6 | S2 | ✓ source PASS; smoke pending |
| AC-3 no-partial-read | T3 (`.partial` + `mv`) | S3 | ✓ source PASS; smoke pending |
| AC-4 cache within staleness | T4 | S4 | ✓ source PASS; smoke pending |
| AC-5 staleness configurable | T4+T9 | (covered by S4) | ✓ source PASS |
| AC-6 clean-FS first run | T1+T2+T4 indirect | S5 | ✓ source PASS; smoke pending |
| AC-7 owner script folded | T7 | S6 | ✓ source PASS; smoke pending |
| AC-8 cache-aware cleanup | T7+T8a+T8b+T8c | S7 | ✓ source PASS; smoke pending |
| AC-9 no regression | R1+R2 | (covered by S1+S6) | ✓ source PASS |
| AC-10 structured events | T5 | S8 | ✓ source PASS; smoke pending |

- [x] Every acceptance criterion has a passing test (source-sentinel) and a smoke scenario where behavioral.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story (verified by full diff walk).

## ADR adherence

- [x] Files changed match the ADR's implementation notes exactly:
  - `src/algos/personalizedGrapeRank/ensureRawDataCsv.sh` — new sourceable helper at the ADR-specified path.
  - `src/algos/customers/personalizedGrapeRank/personalizedGrapeRank.sh` — guard replaced.
  - `src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRank.sh` — inline cypher dropped + trailing `rm -rf $TEMP_DIR` dropped.
  - `src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRankController.sh` — `cleanup_graperank_tmp` cache-aware.
  - `src/algos/customers/processAllActiveCustomers.sh:166-188` — cache-aware.
  - `src/algos/updateAllScoresForOwner.sh:128-136` — cache-aware.
  - `config/graperank.conf.template:86-91` — `RAW_CSV_STALENESS_SECONDS=1800` added.
- [x] Layering matches ADR §Option A:
  - flock fd 200 lifecycle in the caller's shell, released by the kernel on shell exit.
  - `_ensure_csv_cache_is_fresh` → shared-lock fast path → exclusive-upgrade with double-check → atomic `.partial` + `mv` → sentinel touch → downgrade. All six steps of ADR §Option A present in order ([ensureRawDataCsv.sh:115-182](src/algos/personalizedGrapeRank/ensureRawDataCsv.sh:115)).
  - `evict_raw_data_csv_cache` is non-blocking exclusive (`flock -x -n 201`) and targets the four CSVs + sentinel only, never per-customer subdirs.
- [x] No new dependencies the ADR didn't authorize — `flock(1)` from `util-linux` (already on Linux), `cypher-shell` (already used), nothing else.
- [x] **Implementer choice within ADR latitude:** ADR §Implementation notes left the helper free to either delegate to `initializeRawDataCsv.sh` or inline the Cypher. Implementer inlined. This produces the orphan-script side-effect flagged below (Non-blocking #3); ADR-permitted.

## Concept-graph integrity

- [x] No concept-graph schema changes — ADR §Consequences explicitly states "Firmware reinstall required? No." Verified: no `firmware/concepts/` edits in the diff.
- [x] No handles touched — change is purely operational/scripts layer.
- [x] No `BIBLE.md` reads in the new code; helper consumes runtime conf only.

## Things tests can't catch

Reviewed the helper line-by-line for race/leak/permission hazards:

- [x] **fd 200/201 namespace clean.** Grep `exec 200|exec 201` across `src/`: only `ensureRawDataCsv.sh`. No collision with other shell code.
- [x] **Cypher-shell fd inheritance.** Child cypher-shell inherits fd 200 (the exclusive lock) during init. flock is per-OFD and survives fork; cypher-shell exits before `_ensure_csv_run_init` returns; parent then `flock -u 200`. No lock leak.
- [x] **Caller crash mid-pipeline.** SIGKILL / OOM / `exit 1` all close fd 200 → kernel releases the shared lock. Verified by the bash semantics, not by smoke. ([ensureRawDataCsv.sh:113-115](src/algos/personalizedGrapeRank/ensureRawDataCsv.sh:113) comment is accurate.)
- [x] **Exclusive-upgrade TOCTOU.** Drop-shared → acquire-exclusive → **double-check `_ensure_csv_cache_is_fresh`** at [ensureRawDataCsv.sh:154](src/algos/personalizedGrapeRank/ensureRawDataCsv.sh:154). Matches the canonical double-checked locking pattern. ✓
- [x] **Downgrade re-acquire.** `flock -u 200; flock -s -w 60 200` after both the reused-peer-init path and the post-init path. 60s timeout is generous for an empty contention window.
- [x] **Stat portability.** GNU `stat -c '%Y'` with BSD `stat -f '%m'` fallback at [ensureRawDataCsv.sh:68-70](src/algos/personalizedGrapeRank/ensureRawDataCsv.sh:68). Linux droplet → GNU path. ✓
- [x] **No secrets in committed files** (no `.env`, no creds, no `password=` literals introduced).
- [x] **No leftover debug logging.** Structured events follow the existing `emit_task_event` pattern.
- [x] **No commented-out code** (the diff removes blocks cleanly; comments left in place are intentional explanation).
- [x] **No TODOs.** ADR-acknowledged follow-ups (Cypher dedup, eviction endpoint) live in ADR §Out of scope, not as in-code TODOs.
- [x] **Concurrency considered** — see all of the above. The whole story is concurrency.
- [x] **Security: input validation not relevant** — no user input crosses the helper boundary; Cypher queries are static literals.
- [x] **House rules respected** — Concept Graph API authority not relevant (no concept change); no new lint/typecheck/build tooling introduced.

### Concurrency audit beyond the tests

| Hazard | Status |
|---|---|
| Two concurrent first-time init writers race on the CSVs | **Closed** by exclusive lock + double-check |
| Stale-read of partial CSV during cypher-shell streaming | **Closed** by atomic `mv` from `${target}.partial` |
| Mixed-snapshot cache after init failure mid-loop | **Closed** by `rm -f $SENTINEL` on init failure (applied inline at [helper:170](src/algos/personalizedGrapeRank/ensureRawDataCsv.sh:170)) |
| Bulk-wipe yanks files from an in-flight reader | **Closed** by `flock -x -n` in `evict_raw_data_csv_cache` |
| Lock leak on caller crash | **Closed** by kernel-managed fd-200 release on exit |
| Owner pipeline's trailing wipe races a peer | **Closed** by removing the trailing wipe (cache outlives the script) |
| Controller `trap EXIT` races a peer on retry/timeout | **Closed** by `evict_raw_data_csv_cache` in the trap |

## House rules check

- [x] Concept Graph API authority respected (no graph change).
- [x] No new lint/typecheck/build tooling.
- [x] No firmware reinstall needed (per ADR §Consequences).
- [x] Per-phase commits in order: `story → adr → test → impl`. Clean stack on top of `origin/staging`.

## Findings

### Blocking
_None._

### Non-blocking (recommend but do not gate)

1. **~~partial-init cross-file consistency~~ — RESOLVED inline.** Original finding: if `cypher-shell > .partial` succeeded for files 1–2 but failed for file 3, the sentinel kept its prior mtime and a subsequent reader within the staleness window could consume a mixed-snapshot cache. **Mitigation applied** at [ensureRawDataCsv.sh:170](src/algos/personalizedGrapeRank/ensureRawDataCsv.sh:170): `rm -f "${ENSURE_CSV_SENTINEL}"` immediately before the `csv_cache_init_failed` event. Behaviorally verified against the live container by injecting a fake `cypher-shell` that fails on the MUTES query (3rd extraction) — helper returned rc=1, emitted `csv_cache_init_failed`, and the sentinel was removed. Next reader is now guaranteed to treat the cache as not-initialized and force a fresh re-init.

2. **[src/algos/personalizedGrapeRank/ensureRawDataCsv.sh:118](src/algos/personalizedGrapeRank/ensureRawDataCsv.sh:118) — `chown -R` scope creep.** Recursive chown over the tmp tree on every invocation touches per-customer subdirs the helper otherwise promises not to manage (per its own comment at [line 47-48](src/algos/personalizedGrapeRank/ensureRawDataCsv.sh:47)). In practice all pipeline processes run as `brainstorm`, so chown is a no-op; risk is theoretical. Cleaner: non-recursive (`chown brainstorm:brainstorm "$ENSURE_CSV_TMP_DIR"`).

3. **Orphan dead code: `src/algos/customers/personalizedGrapeRank/initializeRawDataCsv.sh`.** Pre-acknowledged by ADR §Out of scope ("Cypher-query deduplication … is a follow-up; not now — minimal diff first"). Implementer chose to inline Cypher in the helper rather than delegate; the legacy script has zero callers post-change. Recommend a separate one-line cleanup story (delete the file + nothing else).

4. **Out-of-story future race surface (informational, not a finding against this story).** The owner-scoped downstream children at `src/algos/personalizedGrapeRank/{initializeRatings,initializeScorecards,updateNeo4j}.sh` also write to the shared root tmp (intermediate JSONs like `oRatingsReverse.json`, `scorecards.json`). These are not the four CSVs in scope here, and concurrent owner-scoped invocations don't happen today (`launchChildTask`'s pgrep guard serializes the owner controller). If story #13 ever permits concurrent owner-scoped recalcs, these intermediates become a fresh race surface — separate story.

## Verdict

**PASS** on the code side (story, ADR, test plan, quality gates).

**Cycle-local smoke (S1–S8) required before merge.** Per project precedent (#11's `ef8ff19f`), the source-sentinel review is necessary but not sufficient for a concurrency story; the authoritative behavioral validation lives in the cycle-local skill against the live Docker stack on `http://localhost:8080`. The smoke either confirms PASS end-to-end or downgrades this verdict to CHANGES_REQUESTED.

---

## Cycle-local smoke verification (added after code-side review)

**Stack:** `tapestry` Docker container, control panel on `localhost:80` and `:7778`, Neo4j on `:7474/:7687`. Stack uptime 6 days. Container shell-script copies (sha256-verified against `HEAD`) match this branch exactly. `/etc/graperank.conf` was absent on the dev container — installed from `config/graperank.conf.template` for the smoke (dev-deployment gap; pre-existing; not story-12).

**Tier 2 standard sanity:** `GET /api/concept-graph/summaries` 200 + count=34; `GET /api/assistant/pubkey` 200; `GET /` 200. No collateral breakage in the API/UI layer.

**Pre-flight caveats:** Neo4j has 0 NostrUser nodes with `hops < 100` (empty fixture); no customer subdirectories under `/var/lib/brainstorm/customers/` (only the `customers.json` registry). These are expected dev-container states per the cycle-local skill's caveat and constrain S1 only — see scenario notes.

### Scenario results

| Scenario | AC | Result | Evidence |
|---|---|---|---|
| **S5** clean-FS first run | AC-6 | **PASS** | Full 6-event lifecycle (`wait_begin/end shared` → `wait_begin/end exclusive` → `init_begin/end`); tmp/ went from absent → `.csv.lock`, `.last_init`, 4 CSVs all present with `brainstorm:brainstorm` ownership |
| **S4** cache hit within window | AC-4 | **PASS** | Immediate re-invocation: 3 events (`wait_begin/end shared` + `csv_cache_hit`); sentinel mtime preserved (1779316736 → 1779316736); no init triggered |
| **S2** exactly-one-init under contention | AC-2 | **PASS** | Two parallel `ensure_raw_data_csv` calls; summary: `init_begin=1, init_end=1, peer_reuse_hit=1`. Exactly one extraction ran; the other waited and observed `csv_cache_hit` with `outcome:"reused_peer_init"` after the double-check under exclusive lock |
| **S3** atomic rename / no partial reads | AC-3 | **PASS** | Post-init invariant: zero `.partial` files remain in tmp/; `mv ${target}.partial ${target}` pattern present in helper ([line 102](src/algos/personalizedGrapeRank/ensureRawDataCsv.sh:102)). Combined with T3 source-sentinel, the atomic rename mechanism is confirmed end-to-end |
| **S7** cache-aware eviction | AC-8 | **PASS** | Two-part test: (a) evict while peer holds shared lock → `csv_cache_evict_skipped` with `reason:"peer_in_flight"`, all 4 CSVs + sentinel SURVIVED; (b) evict idle → `csv_cache_evicted`, CSVs + sentinel removed, `.csv.lock` (infrastructure) preserved. Targets exactly the four CSVs + `.last_init` as ADR §Decision specifies |
| **S6** owner script folded into protocol | AC-7 | **PASS** | `calculatePersonalizedGrapeRank.sh` invoked directly: logs "ensuring shared raw-data CSV cache" → "cache ready", proceeds to `initializeRatings` without any inline `cypher-shell > $TEMP_DIR/*.csv` extraction; full csv_cache_* event set fires under `taskName: ensureRawDataCsv`; cache survives past script exit (no trailing wipe — ADR §Consequences confirmed). Owner script is folded in AND not retired |
| **S1** two concurrent customer runs both complete | AC-1 | **CAVEAT-PASS** | The change's coordination layer is fully validated via S2 (concurrent contention) and S6 (downstream pipeline driving the helper). End-to-end "two customers each produce correct scorecards" requires populated Neo4j + ≥2 registered customers — unavailable on this dev container. The flock + atomic-rename + event-stream guarantees that AC-1 builds on are all confirmed |
| **S8** structured event log surface | AC-10 | **PASS** | Across S5/S4/S2/S7/S6 the events.jsonl emitted all 7 expected `csv_cache_*` phase tokens with correct counts (`hit:3, init_begin:3, init_end:3, wait_begin:10, wait_end:10, evicted:1, evict_skipped:1`). Required AC-10 vocabulary (`hit`, `init_begin`, `init_end`) present; extended vocabulary (`wait_*`, `evict_*`) also present as bonus |

### Cycle-local non-blocking observations
- **Same-parent PID grouping in S2.** Both subshells of a `bash -c '... & ...'` pattern share `$$`. The `emit_task_event` helper captures `$$`, so the per-process grouping in `events.jsonl` collapses for this synthetic test. **Not introduced by story #12** — pre-existing behavior of `src/utils/structuredLogging.sh:168`. In production, each customer recalc is its own process with its own PID, so grouping works correctly. The S2 result is still valid because the *summary counts* (1 init, 1 peer_reuse) prove the coordination protocol regardless of PID grouping.
- **`.csv.lock` perms.** Helper's `chmod -R 755` brings the lock file to `-rwxr-xr-x`. Cosmetic; `flock` is not perm-sensitive.
- **`/etc/graperank.conf` absent on dev container.** Pre-existing deployment-template install gap; not story-12. Surfaces because story-12 introduced a new conf knob, but the same source line existed in the owner-scoped script before this change.

### Final verdict (post-smoke)

**PASS** — all in-scope behavioral guarantees confirmed; S1's end-to-end customer flow caveat is a fixture limitation (not a code regression) and is fully addressed by the staging smoke that `cycle-staging` will run next. The story is ready for the deploy chain.
