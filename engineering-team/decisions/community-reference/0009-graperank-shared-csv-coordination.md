# ADR 0009: Coordinate shared raw-data CSV cache for personalized GrapeRank

**Status:** Proposed
**Date:** 2026-05-20
**Story:** `engineering-team/stories/12-graperank-shared-csv-race.md`

## Context

The customer-aware GrapeRank pipeline at [src/algos/customers/personalizedGrapeRank/personalizedGrapeRank.sh:81-146](src/algos/customers/personalizedGrapeRank/personalizedGrapeRank.sh:81-146) guards its raw-data CSV initialization with a plain `-f` existence check on four globally shared paths:

```
/var/lib/brainstorm/algos/personalizedGrapeRank/tmp/{ratees,follows,mutes,reports}.csv
```

`initializeRawDataCsv.sh` then writes those four files via `cypher-shell … > $TEMP_DIR/<name>.csv` ([initializeRawDataCsv.sh:55-58](src/algos/customers/personalizedGrapeRank/initializeRawDataCsv.sh:55-58)). The same CSVs are written by the owner-scoped sibling at [calculatePersonalizedGrapeRank.sh:51-54](src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRank.sh:51-54).

This is safe today because `launchChildTask.sh`'s `pgrep`-based guard ([launchChildTask.sh:25-67](src/manage/taskQueue/launchChildTask.sh:25-67)) prevents two instances of the same script from coexisting. Story #13 will introduce per-customer scheduling that bypasses that constraint, so the existence-check guard becomes a textbook TOCTOU bug:

- **First-run race:** two recalcs see no CSVs, both call `initializeRawDataCsv.sh`, both `> ratees.csv` truncate then stream — interleaved or truncated output.
- **Stale-read race:** customer A's `cypher-shell > ratees.csv` has truncated the file but not finished streaming. Customer B's `-f` test returns true, B skips init, B reads a partial file.

The redirection (`>`) opens with O_TRUNC; the file exists as a zero-byte file the moment `cypher-shell` starts and stays "existent" for the duration of the write. Existence is not a useful freshness signal.

### Existing isolation (no change needed)

Per-customer outputs are already namespaced under `tmp/<CUSTOMER_NAME>/`:
- [calculateGrapeRank.js:52-53](src/algos/customers/personalizedGrapeRank/calculateGrapeRank.js:52-53), [updateNeo4jWithApoc.js:18](src/algos/customers/personalizedGrapeRank/updateNeo4jWithApoc.js:18), [updateNeo4j.js:28](src/algos/customers/personalizedGrapeRank/updateNeo4j.js:28).
- [updateAllScoresForSingleCustomer.sh:499-502](src/algos/customers/updateAllScoresForSingleCustomer.sh:499-502) already wipes `tmp/${CUSTOMER_DIRECTORY_NAME}` only — that's correctly scoped.

The race surface is exactly the four shared root-level CSVs. They are global Neo4j snapshots (no customer-specific shaping), so the cache shape is correct; only the coordination is missing.

### Bulk wipes that must become cache-aware

- [processAllActiveCustomers.sh:177](src/algos/customers/processAllActiveCustomers.sh:177) — `rm -rf` of the whole shared tmp at end of batch.
- [updateAllScoresForOwner.sh:130-133](src/algos/updateAllScoresForOwner.sh:130-133) — same wipe at end of owner pipeline.
- [calculatePersonalizedGrapeRank.sh:84-87](src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRank.sh:84-87) — owner-scoped script's own wipe.
- [calculatePersonalizedGrapeRankController.sh:34-40](src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRankController.sh:34-40) — `trap EXIT` wipe in the owner controller.

### Constraints
- The deployment runs on Linux (Docker droplets); `flock(1)` from `util-linux` is available.
- The project is JS-without-build per [CLAUDE.md](CLAUDE.md) — no new tooling.
- `structuredLogging.sh` already exposes `emit_task_event` ([src/utils/structuredLogging.sh:149-239](src/utils/structuredLogging.sh:149-239)) — the event-log requirement reuses it.
- Concept-Graph orient (via `/api/concept-graph/summaries`) confirms no firmware concept is touched — this is purely an operational/scripts-layer change.

### Concept-graph impact
None. No firmware reinstall required.

## Options considered

### Option A — `flock(1)` advisory lock + atomic-rename writer + staleness sentinel (chosen)

Introduce one shared helper at [src/algos/personalizedGrapeRank/ensureRawDataCsv.sh](src/algos/personalizedGrapeRank/ensureRawDataCsv.sh) (new). The helper is **sourced** (not exec'd) by the two writer-callers so the lock fd is inherited for the rest of the caller's pipeline.

Lock file: `/var/lib/brainstorm/algos/personalizedGrapeRank/tmp/.csv.lock` (created on first use, never deleted).
Freshness sentinel: `/var/lib/brainstorm/algos/personalizedGrapeRank/tmp/.last_init` — `mtime` records when the four CSVs were last fully published.
Staleness window: `RAW_CSV_STALENESS_SECONDS` in `/etc/graperank.conf` (default `1800`).

Algorithm executed by the helper:

1. `exec 200> .csv.lock` (idempotent open of the lock fd).
2. `flock -s -w 600 200` (shared lock, 10-min wait).
3. Check `.last_init`: if it exists and `(now - mtime) < RAW_CSV_STALENESS_SECONDS` and all four CSVs exist → emit `CSV_CACHE_HIT`, return (caller keeps the shared lock).
4. Otherwise: `flock -u 200` (drop shared), `flock -x -w 600 200` (upgrade to exclusive).
5. **Double-check** freshness inside the exclusive lock. If a peer initialized the cache while we waited, emit `CSV_CACHE_WAIT_END`, downgrade to shared (release + re-acquire shared), return.
6. Run extraction to **partial paths**: `cypher-shell … > tmp/ratees.csv.partial`, etc. Then `mv tmp/ratees.csv.partial tmp/ratees.csv` for each — POSIX `rename(2)` is atomic, so any concurrent reader either sees the old file or the new file, never an interleaved one.
7. `touch tmp/.last_init`. Emit `CSV_CACHE_INIT_END`.
8. Downgrade: `flock -u 200; flock -s -w 60 200`. Return.

Caller convention (both writer-callers):

```bash
# personalizedGrapeRank.sh and calculatePersonalizedGrapeRank.sh
source "${BRAINSTORM_MODULE_ALGOS_DIR}/personalizedGrapeRank/ensureRawDataCsv.sh"
ensure_raw_data_csv     # sources => fd 200 stays open with shared lock
# … rest of the pipeline: interpretRatings.js, initializeScorecards.js, etc.
# Script exits => fd 200 closes => shared lock released
```

The shared lock is held for the **entire downstream consumption** of the CSVs. That is fine because:
- Shared locks do not block other readers (other customer recalcs proceed in parallel).
- The only blocker is the writer, which only runs when the cache is stale.
- Releasing only on script exit is automatic and crash-safe — if a process dies, the kernel drops the `flock`.

Cache-aware bulk eviction (the four bulk-wipe sites become):

```bash
exec 201> /var/lib/brainstorm/algos/personalizedGrapeRank/tmp/.csv.lock
if flock -x -n 201; then
    rm -f /var/lib/brainstorm/algos/personalizedGrapeRank/tmp/{ratees,follows,mutes,reports}.csv \
          /var/lib/brainstorm/algos/personalizedGrapeRank/tmp/.last_init
    flock -u 201
    emit_task_event "PROGRESS" "..." "..." '{"phase":"csv_cache_evicted"}'
else
    emit_task_event "PROGRESS" "..." "..." '{"phase":"csv_cache_evict_skipped","reason":"peer_in_flight"}'
fi
```

`-x -n` is non-blocking exclusive: cleanup either runs (cache truly idle) or skips (peer holds shared lock). It targets **only the four shared root CSVs and the sentinel** — it does not blow away any `tmp/<CUSTOMER_NAME>/` subdir (those are managed by [updateAllScoresForSingleCustomer.sh:499-502](src/algos/customers/updateAllScoresForSingleCustomer.sh:499-502)).

**Pros**
- `flock(1)` is kernel-managed, automatically released on process death — no stale-lock cleanup logic to maintain.
- Shared/exclusive distinction is the textbook fit for "many readers, occasional writer."
- Atomic rename closes the partial-write race deterministically (POSIX `rename` semantics; not a probabilistic mitigation).
- Caller convention (`source` + sourced fd) is a known bash idiom and self-cleaning on exit.
- The owner-scoped script folds in cleanly: it becomes a peer of the customer-aware scripts under the same lock.
- The cache survives across batches by design, which is what the "preserve the caching optimization" criterion asks for.
- Zero new tooling — `flock` ships with `util-linux` on every Linux distro.

**Cons**
- Adds one new helper script (`ensureRawDataCsv.sh`) plus a new config knob (`RAW_CSV_STALENESS_SECONDS`).
- Advisory only: any future writer that bypasses the helper would re-introduce the race. Mitigation: only two writer sites exist, both are within the same module, and the helper is the only path into raw-data extraction.
- `flock(1)` is Linux-only — macOS dev outside the container would need to mock or skip. Acceptable: brainstorm.world deployment is Linux and dev typically runs in the project's Docker stack.

### Option B — Queue-layer serialization (do nothing at the bash layer)

Defer correctness to story #13's BullMQ: a dedicated `csv-init` queue with concurrency=1; per-customer GrapeRank jobs depend on a single CSV-init job.

**Rejected.** Violates the story's explicit acceptance criterion that the fix must hold regardless of trigger source ("whether jobs come from BullMQ, from systemd timers, or from manual triggers fired in parallel"). It also leaves the owner-scoped script (separate scheduling path) outside the protection. Couples correctness to infrastructure that doesn't exist yet.

### Option C — Per-customer CSV paths (no shared cache)

Each customer recalc extracts its own copy under `tmp/<CUSTOMER_NAME>/{ratees,follows,mutes,reports}.csv`.

**Rejected at Planning** (story §"Open questions"): the CSVs are a genuinely customer-agnostic Neo4j snapshot. Re-running the four Cypher queries N times per recalc cycle is wasted Neo4j load at the scale the queue intends to operate. Documented here for completeness.

## Decision

**We chose Option A.**

Reasons:
- It's the only option that satisfies every acceptance criterion (single concurrent-writer guarantee; shared cache preserved; staleness configurable; first-clean-run works; cache-aware cleanup; structured event log; covers owner-scoped script under the same protocol).
- Each component (`flock`, atomic rename, sentinel mtime) is a well-understood UNIX primitive — no novel coordination semantics.
- The blast radius is small: one new helper, four edits to existing scripts to call it, four edits to bulk-wipe sites to gate behind the lock, one new conf knob.

What we are trading away: lockfree elegance (rejected Option D earlier in discussion — symlink-based publish — was simpler in principle but accumulated atomicity edge cases around concurrent initial extraction). We accept that `flock` is advisory, mitigated by the constrained writer surface.

### Staleness window default

Recommendation: **`RAW_CSV_STALENESS_SECONDS=1800`** (30 minutes), set in `/etc/graperank.conf` via `config/graperank.conf.template`.

Rationale:
- Customer recalc takes ~21 min on the reference 2.46M-node/30M-edge graph per the controller's timing notes ([calculatePersonalizedGrapeRankController.sh:14-19](src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRankController.sh:14-19)). 30 min gives a clean recalc cycle re-use of one cache extraction, then refreshes.
- Neo4j ingestion (`syncWoT` ~45 min, `processNpubsUpToMaxNumBlocks` ~90 min per `get_task_expected_duration` in [structuredLogging.sh:400-405](src/utils/structuredLogging.sh:400-405)) operates on a longer cadence than 30 min, so customers will not lag a full ingestion cycle behind.
- Configurable: operators tuning either direction (fresher Neo4j data ↔ less Neo4j load) adjust this single knob.

### Structured events

Reusing `emit_task_event` `PROGRESS` with a `phase` field. New phase values:
- `csv_cache_hit` — files fresh; no wait, no init.
- `csv_cache_wait_begin` — entering `flock` wait (shared or exclusive).
- `csv_cache_wait_end` — lock acquired; if the wait revealed a peer's fresh init, metadata records `outcome:"reused_peer_init"`.
- `csv_cache_init_begin` — about to run Cypher.
- `csv_cache_init_end` — extraction complete; metadata includes `duration_seconds`.
- `csv_cache_evicted` — bulk cleanup succeeded.
- `csv_cache_evict_skipped` — bulk cleanup deferred; metadata records `reason:"peer_in_flight"`.

These flow into the existing `events.jsonl` and into the timeline UI through the existing `taskName+pid` grouping.

## Consequences

**Enabled**
- Story #13's per-customer scheduling can launch concurrent recalcs safely.
- Manual operator-triggered recalcs are also safe (no longer reliant on `pgrep` serialization for correctness).
- The cache is now an explicit, observable resource with a defined refresh policy.

**Constrained / harder**
- Any future code that wants to read or write the four shared CSVs MUST go through `ensureRawDataCsv.sh` or replicate the lock protocol. A grep-able comment in `initializeRawDataCsv.sh` will warn future authors.
- The bulk-wipe sites are no longer guaranteed to run; the cache can survive across batches. Operators who want to force a fresh extraction must either let it age past `RAW_CSV_STALENESS_SECONDS` or manually remove the sentinel under the lock.

**Follow-up debt (out of scope here)**
- Cypher duplication: the owner-scoped `calculatePersonalizedGrapeRank.sh` and the customer-aware `initializeRawDataCsv.sh` both inline the same four `MATCH` queries. The helper introduced here can absorb the extraction in a follow-up; not now — minimal diff first.
- Operator command for forced cache refresh (`evictRawDataCsv.sh` callable via the control panel API). Useful but not required by story #12.

**Firmware reinstall required?** No. No concept-graph or firmware concept changes.

## Implementation notes

The Implementer reads this section verbatim.

### New files

- **`src/algos/personalizedGrapeRank/ensureRawDataCsv.sh`** — sourceable helper. Exports a function `ensure_raw_data_csv` that the caller `source`s + invokes. The function:
  - Sources `/etc/brainstorm.conf` and `/etc/graperank.conf` (the `RAW_CSV_STALENESS_SECONDS` knob lives in the latter).
  - Sources `${BRAINSTORM_MODULE_BASE_DIR}/src/utils/structuredLogging.sh`.
  - Opens fd 200 on `/var/lib/brainstorm/algos/personalizedGrapeRank/tmp/.csv.lock` and acquires a shared lock with a 600 s timeout.
  - Implements the freshness check, exclusive-upgrade-with-double-check, partial-write + atomic rename, sentinel touch, and downgrade described in Option A.
  - Emits the structured events listed above.
  - On non-recoverable failure (lock timeout, Cypher failure), emits `TASK_ERROR` and returns non-zero so the caller can `exit 1`.

### Edited files

- **`src/algos/customers/personalizedGrapeRank/personalizedGrapeRank.sh`** — replace lines 78-146 (the existence-check guard and its skip/init branches) with one `source … ensureRawDataCsv.sh` + `ensure_raw_data_csv || exit 1`. The downstream pipeline (`interpretRatings.js` onwards) remains unchanged; it now reads the CSVs while the caller holds the shared lock on fd 200.

- **`src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRank.sh`** —
  1. Replace lines 16-54 (CYPHER0..3 definitions + TEMP_DIR setup + four `cypher-shell` calls) with `source … ensureRawDataCsv.sh` + `ensure_raw_data_csv || exit 1`. Note `mkdir -p $TEMP_DIR` + `chown -R brainstorm:brainstorm $TEMP_DIR` move into the helper (it owns the tmp tree).
  2. Delete lines 83-87 (the trailing `rm -rf "$TEMP_DIR"`). The cache outlives the script.

- **`src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRankController.sh`** — replace the `cleanup_graperank_tmp()` function (lines 33-40) with the cache-aware variant described above (non-blocking exclusive `flock`, target only shared CSVs + sentinel).

- **`src/algos/updateAllScoresForOwner.sh`** — same cache-aware variant replacing lines 130-133.

- **`src/algos/customers/processAllActiveCustomers.sh`** — same cache-aware variant replacing lines 166-185 (preserve the two `emit_task_event` callsites; the wipe between them changes).

### Config

- **`config/graperank.conf.template`** — append a new section:
  ```bash
  # Shared raw-data CSV cache (ratees/follows/mutes/reports). Re-init only if older
  # than this many seconds. Set in coordination with Neo4j ingestion cadence.
  # See ADR 0009 and engineering-team/stories/12-graperank-shared-csv-race.md.
  export RAW_CSV_STALENESS_SECONDS=1800
  ```
  Deployment templating already installs this file at `/etc/graperank.conf` ([calculatePersonalizedGrapeRank.sh:5](src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRank.sh:5)).

### Concept handle

None. No new concepts.

## Out of scope

- **The queue infrastructure** (story #13).
- **Cypher-query deduplication** between the owner-scoped script and the helper. The helper may shell out to `cypher-shell` itself OR call the existing `initializeRawDataCsv.sh` — Implementer's call. Either way, the duplicated Cypher in `calculatePersonalizedGrapeRank.sh` should be removed since that script no longer extracts directly.
- **An operator-facing eviction endpoint** for forced refresh.
- **Per-customer override of the staleness window.** The cache is global; one fleet-wide value is the right shape.
- **Replacing `flock` with something portable.** Linux is the deployment target.
- **macOS dev parity.** Local development that hits this code path should run inside the project's Docker stack.
