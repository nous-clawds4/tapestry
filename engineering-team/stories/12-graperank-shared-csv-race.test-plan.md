# Test Plan: Story 12 — Shared CSV initialization safety under concurrent customer runs

**Story:** `engineering-team/stories/12-graperank-shared-csv-race.md`
**ADR:** `engineering-team/decisions/0009-graperank-shared-csv-coordination.md`
**Date:** 2026-05-20

## Approach
Same precedent as #5/#6/#8/#10/#11. Source/structural sentinels in the hand-rolled Node runner pin the ADR-required code shape — helper file existence, lock primitive choice (`flock`), atomic-rename publishing (`.partial` + `mv`), freshness sentinel (`.last_init`) and config knob (`RAW_CSV_STALENESS_SECONDS`), structured-event vocabulary, caller refactors at both writer-callers (customer-aware and owner-scoped), and cache-aware bulk eviction at the three live cleanup callsites.

The **behavioral round-trip** — two concurrent recalcs actually serializing on `flock`, atomic rename actually preventing partial reads under contention, cache-aware eviction actually skipping when a peer holds the shared lock, and the structured event stream actually reflecting hit/wait/init/evict outcomes — is reproducible only against the live Docker stack and is the **authoritative cycle-local smoke** (Reviewer-required). Concurrency proofs are not catchable by Node-runner regex sentinels; the smoke is where they get verified.

## Coverage map

| AC | Test / mechanism | File | Level |
|---|---|---|---|
| AC-1 (two concurrent customer runs both complete) | **T1** (helper exists), **T2** (helper uses `flock`), **T6** (customer-aware driver sources helper; existence-check guard gone). Behavioral S1 = cycle-local | test/graperank-shared-csv-race.test.js | source + smoke |
| AC-2 (exactly one init under contention; second waits + reuses) | **T2** (`flock` primitive present), **T5** (`csv_cache_init_*` event tokens for fresh init), **T6** (TOCTOU guard replaced). Behavioral S2 = cycle-local | test/graperank-shared-csv-race.test.js | source + smoke |
| AC-3 (no partial-read under any concurrency pattern) | **T3** (`.partial` filename + `mv` atomic rename in helper). Behavioral S3 = cycle-local | test/graperank-shared-csv-race.test.js | source + smoke |
| AC-4 (cache preserved within staleness window) | **T4** (`.last_init` sentinel + `RAW_CSV_STALENESS_SECONDS` consumed in helper). Behavioral S4 = cycle-local | test/graperank-shared-csv-race.test.js | source + smoke |
| AC-5 (staleness window defined, configurable, documented) | **T9** (`graperank.conf.template` defines `RAW_CSV_STALENESS_SECONDS=1800`) + **T4** (helper reads it) | test/graperank-shared-csv-race.test.js | source |
| AC-6 (clean filesystem first run works) | **T2** + **T4** indirect — fresh sentinel → stale path → exclusive lock + init. Pre-impl-impossible without the helper; pinned by T1. Behavioral S5 = cycle-local | — | source (via T1+T2+T4) + smoke |
| AC-7 (owner-scoped script folded into same protocol; NOT retired) | **T7** (owner-scoped driver sources helper, drops inline `cypher-shell > $TEMP_DIR/*.csv`, drops trailing `rm -rf "$TEMP_DIR"`). Owner script still exists and still runs — folding ≠ retiring. Behavioral S6 = cycle-local | test/graperank-shared-csv-race.test.js | source + smoke |
| AC-8 (cache-aware end-of-run cleanup) | **T8a** (`processAllActiveCustomers.sh`), **T8b** (`updateAllScoresForOwner.sh`), **T8c** (`calculatePersonalizedGrapeRankController.sh:cleanup_graperank_tmp`) — each asserts the bare bulk `rm -rf .../tmp` is gone AND `flock` appears in the cleanup section. T7 also drops the owner driver's trailing `rm -rf $TEMP_DIR`. Behavioral S7 = cycle-local | test/graperank-shared-csv-race.test.js | source + smoke |
| AC-9 (no regression: single-customer flow identical) | **R1** (customer driver still invokes `interpretRatings.js`, `initializeScorecards.js`, `calculateGrapeRank.js`, `updateNeo4jWithApoc.js` in sequence) + **R2** (per-customer subdir cleanup at `updateAllScoresForSingleCustomer.sh:499-502` preserved) | test/graperank-shared-csv-race.test.js | source (regression sentinel) |
| AC-10 (structured event log distinguishes wait/share/reuse vs fresh init) | **T5** (helper emits `csv_cache_hit`, `csv_cache_init_begin`, `csv_cache_init_end`). Behavioral S8 = cycle-local | test/graperank-shared-csv-race.test.js | source + smoke |

T1..T9 + T8a/T8b/T8c = **FAIL pre-impl, PASS post.** R1, R2 = **PASS pre AND post** (regression guards). Total: 11 failing sentinels + 2 regression sentinels = 13 tests.

## Edge cases
- [x] **Helper-missing cascade.** T2..T5 first check `src !== null` and emit "Helper file missing — T1 must pass first." Avoids confusing "regex didn't match" errors when the helper doesn't exist yet.
- [x] **R2 false-positive on bare-bulk regex.** The bulk-wipe negative pattern (`rm -rf /var/lib/brainstorm/algos/personalizedGrapeRank/tmp\s*$`) is anchored to end-of-line (`$` with `m` flag). The per-customer cleanup at `tmp/${CUSTOMER_DIRECTORY_NAME}` is NOT matched (path continues past the bare directory), so the per-customer cleanup is correctly untouched. R2 explicitly asserts that the per-customer scope is preserved.
- [x] **T6 / T7 negation-vs-positive split.** Each pins both the positive change (sources the helper) AND the absence of the now-forbidden pattern (existence-check guard / inline `cypher-shell` / trailing `rm -rf $TEMP_DIR`). The Implementer can't accidentally leave the old pattern in while adding the new call.
- [x] **T8a/T8b/T8c bare-bulk vs cache-aware.** The negation `rm -rf .../tmp\s*$` only matches the bare wipe; the positive `flock` check requires the locking primitive to be present in the file. Together they prevent a half-finished implementation that adds `flock` but leaves the bare wipe nearby.
- [x] **T9 default value tolerance.** Pinned to `=1800` per ADR §Staleness window default. Implementer deviation from 1800 is a follow-up ADR concern, not a Tester call; the value is part of the ADR's decision.
- [ ] **Cross-process flock semantics, partial-write race under contention, sentinel mtime correctness, cache-aware skip behavior** — not catchable in source; **cycle-local smoke is the authoritative check.**

## Not covered (deferred to cycle-local smoke — authoritative, Reviewer-required)
Run on the local Docker stack (`:8080` / `:7778`), per the cycle-local pattern:

**S1 — AC-1 (two concurrent customer runs both complete):** Start two `personalizedGrapeRank.sh <customer-pubkey-A> ...` and `personalizedGrapeRank.sh <customer-pubkey-B> ...` invocations within 2 seconds of each other on a freshly cleared cache (`rm /var/lib/brainstorm/algos/personalizedGrapeRank/tmp/{ratees,follows,mutes,reports}.csv /var/lib/brainstorm/algos/personalizedGrapeRank/tmp/.last_init`). Assert: both processes exit 0; both produce identical `verifiedFollowerCount`-class scorecards for their respective customer pubkeys in Neo4j.

**S2 — AC-2 (exactly one init under contention; second waits + reuses):** Same starting condition as S1. Grep `events.jsonl` after both complete: assert exactly **one** `csv_cache_init_begin` and exactly **one** `csv_cache_init_end` event between the two PIDs (one customer ran init, the other waited and reused). The second invocation should show `csv_cache_wait_begin` and `csv_cache_wait_end` events with `outcome: "reused_peer_init"` metadata.

**S3 — AC-3 (no partial-read under any concurrency pattern):** Inject a slow `cypher-shell` (LD_PRELOAD shim or a sed-edited script wrapper) that pauses 2 seconds in the middle of streaming follows.csv. Start customer A's recalc (will be stuck mid-write). Start customer B's recalc one second later. Assert: B blocks on the exclusive→shared transition (does NOT read `follows.csv` while it is in the `.partial` state). When A finishes, `mv` makes the new file visible; B's structured event log shows `csv_cache_wait_end`; downstream `interpretRatings.js` reads the complete file. Confirm no `interpretRatings.js` error log of the form "unexpected EOF" or "incomplete row".

**S4 — AC-4 (cache preserved within staleness window):** Run a recalc → record `.last_init` mtime. Run a second recalc within ~30 s. Assert: `csv_cache_hit` event present; no `csv_cache_init_begin`; the second recalc's CSV reads have the same `.last_init` mtime as the first.

**S5 — AC-6 (clean-filesystem first run):** `rm -rf /var/lib/brainstorm/algos/personalizedGrapeRank/tmp` (no helper-managed state at all). Run `personalizedGrapeRank.sh <customer> ...`. Assert: helper recreates the tmp directory, writes all four CSVs via `.partial`+`mv`, touches `.last_init`, the recalc completes successfully. No "directory not found" errors. Permissions on the tmp tree are `brainstorm:brainstorm`.

**S6 — AC-7 (owner-scoped script folded in):** `bash $BRAINSTORM_MODULE_ALGOS_DIR/personalizedGrapeRank/calculatePersonalizedGrapeRank.sh` (legacy owner-scoped entry point). Assert: the owner script invokes the same helper; its events.jsonl entries show the same `csv_cache_*` phase tokens; no inline `cypher-shell > $TEMP_DIR/*.csv` writes appear in process tree (`ps -ef | grep cypher-shell` during the run shows only the helper's invocation, not duplicate writes); after the script exits, the cache files survive (no trailing wipe). Run a customer recalc immediately after — assert `csv_cache_hit` (the cache the owner just produced is reused).

**S7 — AC-8 (cache-aware cleanup):** Start a customer recalc (will hold the shared lock during the downstream pipeline). While it runs, manually invoke `processAllActiveCustomers.sh`'s cleanup block (or simulate by sourcing and calling the cleanup function). Assert: cleanup emits `csv_cache_evict_skipped` with `reason: "peer_in_flight"`; the four shared CSVs and `.last_init` survive; the in-flight customer's downstream pipeline completes successfully. Then with no peer running, invoke cleanup again — assert `csv_cache_evicted` event and the four CSVs + sentinel removed.

**S8 — AC-10 (structured event log surface):** Inspect the `events.jsonl` after S1–S7. Assert each scenario's expected event tokens are present and well-formed (valid JSONL, `taskName + pid` groups correctly so the timeline UI surfaces hit/wait/init/evict for the same recalc).

## Test infrastructure
- Existing hand-rolled Node runner (`npm test` → `test/test.js`); no new deps.
- Registered: `graperankSharedCsvRace`.
- Asserts only against in-repo files: `src/algos/personalizedGrapeRank/ensureRawDataCsv.sh` (helper), `src/algos/customers/personalizedGrapeRank/personalizedGrapeRank.sh` (customer-aware driver), `src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRank.sh` (owner-scoped driver), `src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRankController.sh` (owner controller), `src/algos/updateAllScoresForOwner.sh` (owner orchestrator), `src/algos/customers/processAllActiveCustomers.sh` (customer orchestrator), `src/algos/customers/updateAllScoresForSingleCustomer.sh` (regression target), `config/graperank.conf.template` (conf knob).
- No Playwright (the behavioral concurrency layer is filesystem + flock + Neo4j — smoke territory).

## How to run
```
npm test
```
Targeted: `node -e "require('./test/graperank-shared-csv-race.test.js').run()"`

## Verification
New tests fail on the pre-implementation tree (atop ADR commit `b6b0f9bd`):

```
graperank-shared-csv-race suite:
  ✗ T1: ensureRawDataCsv.sh helper exists at the ADR-specified path (AC-1, AC-2, ADR 0009 §Implementation notes)
      Helper file does not exist at src/algos/personalizedGrapeRank/ensureRawDataCsv.sh (AC-1/AC-2; ADR 0009). Create the sourceable helper that owns the shared raw-data CSV lifecycle for both the customer-aware and owner-scoped pipelines.
  ✗ T2: ensureRawDataCsv.sh uses flock(1) for shared/exclusive coordination (AC-2, AC-3, ADR 0009 §Option A)
      Helper file missing — T1 must pass first.
  ✗ T3: ensureRawDataCsv.sh publishes via .partial + atomic rename to prevent partial reads (AC-3, ADR 0009 §Option A step 6)
      Helper file missing — T1 must pass first.
  ✗ T4: ensureRawDataCsv.sh checks freshness against .last_init and reads RAW_CSV_STALENESS_SECONDS (AC-4, AC-5, ADR 0009 §Option A steps 3, 5)
      Helper file missing — T1 must pass first.
  ✗ T5: ensureRawDataCsv.sh emits the ADR-required structured-event phase tokens (AC-10, ADR 0009 §Structured events)
      Helper file missing — T1 must pass first.
  ✗ T6: customer-aware personalizedGrapeRank.sh sources the helper and drops the non-atomic existence-check guard (AC-1, AC-2, ADR 0009 §Implementation notes)
      src/algos/customers/personalizedGrapeRank/personalizedGrapeRank.sh does not reference the new helper ensureRawDataCsv (AC-1/AC-2; ADR 0009 §Implementation notes). The customer-aware driver must source the helper so the shared lock fd is inherited for the downstream pipeline.
  ✗ T7: owner-scoped calculatePersonalizedGrapeRank.sh sources the helper, drops inline extraction, and drops the trailing `rm -rf $TEMP_DIR` (AC-7, AC-8, ADR 0009 §Implementation notes)
      src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRank.sh does not reference the new helper ensureRawDataCsv (AC-7; ADR 0009 §Implementation notes). The owner-scoped script must fold into the same shared-cache locking protocol by sourcing the helper.
  ✗ T8a: processAllActiveCustomers.sh end-of-batch cleanup is cache-aware (AC-8, ADR 0009 §Decision)
      processAllActiveCustomers.sh still wipes the entire shared tmp directory unconditionally (AC-8; ADR 0009 §Decision). Replace the bare `rm -rf .../tmp` with a non-blocking exclusive `flock -x -n` guarded wipe of only the four shared CSVs + `.last_init`. If the lock cannot be acquired (peer in flight), skip and emit `csv_cache_evict_skipped`.
  ✗ T8b: updateAllScoresForOwner.sh end-of-pipeline cleanup is cache-aware (AC-8, AC-7, ADR 0009 §Decision)
      updateAllScoresForOwner.sh still wipes the entire shared tmp directory unconditionally (AC-8; ADR 0009 §Decision). The owner pipeline shares the cache with concurrent customer recalcs under the new protocol; replace with the same `flock -x -n` cache-aware variant used in processAllActiveCustomers.
  ✗ T8c: calculatePersonalizedGrapeRankController.sh cleanup_graperank_tmp trap is cache-aware (AC-8, AC-7, ADR 0009 §Implementation notes)
      calculatePersonalizedGrapeRankController.sh trap EXIT still bulk-wipes the shared tmp (AC-8; ADR 0009 §Implementation notes). A trap that fires on retry/timeout in this controller can race against an in-flight customer recalc — replace with the cache-aware flock-guarded variant.
  ✗ T9: graperank.conf.template defines RAW_CSV_STALENESS_SECONDS with a numeric default (AC-5, ADR 0009 §Staleness window default)
      config/graperank.conf.template does not define `export RAW_CSV_STALENESS_SECONDS=1800` (AC-5; ADR 0009 §Staleness window default). The knob must be present in the template (deployment installs it at /etc/graperank.conf) with the ADR-recommended 1800-second default.
  ✓ R1: customer-aware downstream pipeline phases are preserved end-to-end (AC-9, regression guard)
  ✓ R2: per-customer subdirectory cleanup in updateAllScoresForSingleCustomer.sh is preserved (AC-8, regression guard)

graperank-shared-csv-race suite:                 FAIL (2 passed, 11 failed)
Overall:                                         FAIL
```

All 9 prior suites continue to PASS (no regressions introduced by the new sentinel registration).
