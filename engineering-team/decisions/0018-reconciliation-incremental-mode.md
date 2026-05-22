# ADR 0018: Reconciliation — author-restricted extraction with `recent` / `all` / `author` modes

**Status:** Accepted
**Date:** 2026-05-21
**Story:** `engineering-team/stories/21-reconciliation-incremental-mode.md`
**Builds on:** ADR 0013 (neo4j-heavy resource-class semaphore), ADR 0012 / ADR 0015 (task queue behind `/api/run-task`, on by default)

## Context

`reconciliation` (orchestrated by `src/pipeline/reconciliation/reconciliation.sh`, 591 lines) repairs drift between strfry (canonical nostr event store) and the Neo4j social graph — FOLLOWS / MUTES / REPORTS edges derived from kind 3 / 10000 / 1984 events. It runs three phases sequentially: A=mutes ([reconciliation.sh:154](src/pipeline/reconciliation/reconciliation.sh:154)), C=reports ([:283](src/pipeline/reconciliation/reconciliation.sh:283)), B=follows ([:413](src/pipeline/reconciliation/reconciliation.sh:413)). Each phase: extract current state from Neo4j → dump+convert strfry events → diff → apply via APOC. It currently takes **6–8 hours** because every run does a **full** strfry rescan and a **full** Neo4j scan with an N+1 query pattern.

Drift exists in the first place because the live ingest path — `src/pipeline/stream/updateNostrRelationships.sh` (the redis-consumer stream) — applies relationship updates in real time but can lag or miss events. Reconciliation is the periodic **sweep** that reconverges Neo4j to strfry truth. That framing matters: it tells us the *steady-state* delta between runs is small (only what the stream missed plus genuinely new activity), which is exactly what an author-restricted design exploits.

### Grounded facts from the source (these make the design cheap)

1. **All three strfry dumpers already support a `--recent <seconds>` flag** that sets `"since": <ts>` on the scan filter — [strfryToKind3Events.sh:5-11](src/pipeline/reconciliation/strfryToKind3Events.sh:5), and identical in `strfryToKind10000Events.sh` / `strfryToKind1984Events.sh`. The orchestrator currently calls them with **no args** ([reconciliation.sh:210](src/pipeline/reconciliation/reconciliation.sh:210), [:340](src/pipeline/reconciliation/reconciliation.sh:340), [:470](src/pipeline/reconciliation/reconciliation.sh:470)), so `SINCE_TIMESTAMP=0` → full history every run.

2. **The diff is a per-author set-membership comparison, driven by the union of per-pubkey files** in `currentRelationshipsFromStrfry/<kind>/` and `currentRelationshipsFromNeo4j/<kind>/`. In [calculateFollowsUpdates.js](src/pipeline/reconciliation/calculateFollowsUpdates.js) the comparison is a `Set` diff of followed pubkeys ([:181-201](src/pipeline/reconciliation/calculateFollowsUpdates.js:181)): STEP 1 emits *adds* by walking the strfry dir (a rater present in strfry but absent in Neo4j → **all** their edges added, [:130](src/pipeline/reconciliation/calculateFollowsUpdates.js:130)); STEP 2 emits *deletes* by walking the Neo4j dir (a rater present in Neo4j but absent in strfry → **all** their edges deleted, [:276](src/pipeline/reconciliation/calculateFollowsUpdates.js:276)). It is **not** a follow-*count* comparison — equal counts can hide compensating changes (unfollow A + follow B keeps the count fixed but needs two edge fixes). **This logic is reusable verbatim** provided both directories are populated with the *same* author set.

3. **Neo4j already stores a per-user last-event watermark.** `apocCypherCommand2_follows` does `SET z.kind3CreatedAt = event.created_at, z.kind3EventId = event.id`; mutes/reports counterparts set `kind10000CreatedAt` / `kind1984CreatedAt`. So every apply already maintains a per-user "latest event seen" timestamp + id.

4. **The N+1 pattern** lives in all three extractors: `getRaters()` returns *every* rater ([getCurrentFollowsFromNeo4j.js:151](src/pipeline/reconciliation/getCurrentFollowsFromNeo4j.js:151)), then a per-pubkey session query in a loop ([getFollowsForRater():187](src/pipeline/reconciliation/getCurrentFollowsFromNeo4j.js:187), loop at [:308](src/pipeline/reconciliation/getCurrentFollowsFromNeo4j.js:308)) — hundreds of thousands of round-trips at full-graph scale.

5. **`cleanup()` wipes the per-pubkey dirs at the start of every run** ([reconciliation.sh:114-130](src/pipeline/reconciliation/reconciliation.sh:114)), so each run begins from empty directories — no stale-file contamination between runs.

6. **The APOC apply is already batched** via `apoc.periodic.iterate` (batchSize 100–1000) — not a bottleneck; left untouched.

7. **reconciliation is a registered task** ([taskRegistry.json:317](src/manage/taskQueue/taskRegistry.json:317)) and now flows through the BullMQ queue (on by default, ADR 0015). ADR 0013 introduced a Redis-backed `neo4j-heavy` counted semaphore that serializes Neo4j-heavy tasks — the bulk sweeps are textbook members of that class.

8. **State-dir convention** is `/var/lib/brainstorm/pipeline/<area>/` (e.g. [processReconciliationQueue.js:25](src/pipeline/reconcile/processReconciliationQueue.js:25), `src/pipeline/stream/.../queue/`).

9. **Per-rater debug logging** in [getCurrentFollowsFromNeo4j.js:299-335](src/pipeline/reconciliation/getCurrentFollowsFromNeo4j.js:299) does ~6 `fs.appendFileSync` calls per pubkey to `reconciliation_currentRaterBatch.log` — pure overhead.

10. **The deprecated `src/pipeline/reconcile/` directory** (`note.md`: "being deprecated in favor of the newer reconciliation module") was an earlier attempt at exactly the single-author case — a per-pubkey queue ([createReconciliationQueue.js](src/pipeline/reconcile/createReconciliationQueue.js), [processReconciliationQueue.js](src/pipeline/reconcile/processReconciliationQueue.js)). The `author` mode below delivers that intent inside the live module.

### Concept-graph impact

None. Reconciliation/strfry/Neo4j relationships are operational/ETL plumbing, not domain concepts in the graph. **Firmware reinstall: no.**

## Options considered

### Option A — Author-restricted extraction with three modes (chosen)

All three modes are the *same operation* — reconcile Neo4j against strfry — differing only in **which authors** they cover:

| Task (registry key) | Mode | Authors covered | Cadence | `neo4j-heavy`? |
|---|---|---|---|---|
| `reconcileRecent` | `--mode recent` | authors with an event since the watermark | scheduled ~10 min | yes |
| `reconcileAll` | `--mode all` | every author (today's behavior) | scheduled weekly | yes |
| `reconcileAuthor` | `--mode author --pubkey <pk>` | one author | on-demand | **no** (point write; stays responsive) |

`reconcileRecent` mechanism, per phase:
1. Read a persisted watermark `T` (last successful `recent`/`all` run start, minus a safety overlap).
2. Run the strfry dumper with `--recent (now − T)` → `allKind<K>EventsStripped.json` holds only the latest replaceable event for **changed** authors. Convert to per-pubkey files (existing converter, unchanged) → `currentRelationshipsFromStrfry/<kind>/` holds only changed authors.
3. Extract Neo4j current state **only for those same authors** (read the pubkey set from the strfry dir; skip `getRaters()`/`getRaterCount()`).
4. Run the existing diff (`calculate<Kind>Updates.js`, unchanged) — now over the small, symmetric author set.
5. Apply via the existing APOC commands (unchanged).
6. On success, advance the watermark.

`reconcileAll` is exactly today's pipeline (no `--recent`, all raters). `reconcileAuthor` is the same machinery with the author set fixed to `{pubkey}`, no watermark, no `since` filter — fetch that author's latest events, diff against their Neo4j edges, apply.

**The correctness invariant (recent + author modes):** both directories must be restricted to the *identical* author set. If Neo4j were extracted fully while strfry were extracted for a subset, STEP 2 of the diff would treat every uncovered rater (Neo4j file present, no strfry file) as "delete all their edges" — a catastrophic graph wipe. Restricting both sides to the covered set makes the existing diff correct: a covered author appears in both dirs (→ true set-diff), or strfry-only (→ new rater, all adds), or — for an author who cleared their list — strfry file present but empty (→ all deletes). Uncovered authors appear in neither dir and are correctly left alone.

**Pros**
- Reuses the diff and apply stages **verbatim**; converters unchanged. The only code changes are the orchestrator's mode/watermark logic and a restricted-author path in the three extractors.
- `reconcileRecent` work is proportional to *recent activity*, not graph size → minutes (or a sub-minute no-op), not hours.
- The N+1 loop becomes a non-issue for `recent`/`author` (they iterate a small set), so we don't need to rewrite it now.
- The bulk sweeps plug into the `neo4j-heavy` semaphore (ADR 0013) — a one-line registry tag — addressing the original "reconciliation crashes Neo4j / contends with GrapeRank" motivation. `reconcileAuthor` stays *off* that class so an interactive "reconcile my profile" trigger never queues behind an 8-hour sweep.
- `reconcileAll` is untouched, so we retain a provably-correct oracle to validate `reconcileRecent` against (the story's testability hinge).

**Cons**
- `recent` relies on strfry's `since` filter, which keys on event `created_at` (client-set, can be back-dated). A back-dated or late-arriving event whose `created_at < T` is missed by that run. Mitigated — by design — by the periodic `reconcileAll`, which is exactly why the story mandates it.
- Adds a watermark state file and mode branching → more orchestrator logic to reason about.
- Three code paths (recent/all/author) to keep behaviorally consistent (all share the same diff+apply, which limits divergence risk).

### Option B — Optimize the *full* run only (no recent mode, no watermark)

Leave reconciliation single-mode but make the full run fast: replace the N+1 with a single streamed paged Cypher query (`MATCH (u)-[:FOLLOWS]->(t) RETURN u.pubkey, collect(t.pubkey)`), batch the apply with `UNWIND`, parallelize the three kinds.

**Pros:** one code path; no watermark; no drift-miss window; conceptually simplest.
**Cons:** even fully optimized, a full strfry dump + full Neo4j scan + full diff is inherently O(graph) every run. On a 12M-edge / 100K–250K-rater graph this lands in tens of minutes to low hours, not "minutes," and still hammers Neo4j every run. Does not meet the headline bar. Rejected as primary, but its ideas are the right *future* optimization for `reconcileAll` (see Out of scope).

### Option C — Lean entirely on the live event stream (eliminate the batch sweep)

Push all reconciliation into `src/pipeline/stream/updateNostrRelationships.sh` so Neo4j is updated per-event in real time, removing the periodic batch.

**Pros:** near-zero steady-state drift; no batch job at all.
**Cons:** the live stream is precisely the component whose lag/misses *create* the drift this task repairs — it cannot also be the thing that guarantees convergence. No oracle/sweep to catch what the stream dropped, no repair path for drift already in the graph, correctness hard to reason about. Rejected as a primary strategy; a more reliable stream is a complementary, separate effort.

## Decision

**We chose Option A.** One engine (`reconciliation.sh`), three author-scoped modes exposed as three task-registry keys: `reconcileRecent` (incremental sweep), `reconcileAll` (full sweep — today's behavior, the oracle and weekly fallback), and `reconcileAuthor` (single author). `recent` and `author` restrict **both** the strfry dump and the Neo4j extraction to the same covered author set, reusing the existing diff and APOC apply unchanged. The bulk sweeps are tagged `neo4j-heavy`; `reconcileAuthor` is not.

**Cadence lives in the scheduler, not the script.** `reconcileRecent` and `reconcileAll` are two independent scheduled tasks (~10 min and weekly). This is cleaner than a single self-promoting task: each task has a predictable runtime profile (the 10-min task never silently turns into an 8-hour run), and the `neo4j-heavy` semaphore already guarantees they never execute concurrently (a running `reconcileAll` holds the slot; queued `reconcileRecent` triggers harmlessly dedup behind it). The **only** in-script auto-promotion is the first-run bootstrap: `reconcileRecent` with no watermark performs one full pass to establish a baseline, then writes the watermark.

We are trading away single-path simplicity (Option B) and accepting a bounded `recent`-mode drift-miss window, in exchange for the only design that reliably reaches minutes-scale steady-state runs. The miss window is closed by the weekly `reconcileAll`. We are explicitly **not** optimizing `reconcileAll`'s N+1 in this story — it stays slow but correct, runs weekly, and remains the oracle; its optimization is a clean follow-up (Option B's techniques) once `reconcileRecent` is proven.

## Consequences

**Enabled**
- `reconcileRecent` in minutes (sub-minute when nothing changed), unblocking the operator from scheduling reconciliation routinely — and, per story #13's note, from trusting Neo4j enough to resume scheduled per-customer recalculations.
- `reconcileAuthor` gives an interactive, targeted repair primitive (the future profile-page "reconcile me" button, customer-scoped scheduling) without the cost or contention of a sweep.
- Bulk sweeps serialize with `calculateOwner{Hops,PageRank,GrapeRank}` via the existing `neo4j-heavy` semaphore — no more reconciliation-vs-recalculation Neo4j contention.
- A persisted watermark + per-run drift counts give the operator real drift observability for the first time.

**Constrained / made harder**
- `recent` can miss drift not reflected in a recent strfry event (back-dated/late events; non-event corruption). Bounded by the weekly `reconcileAll`; documented as expected behavior.
- Three modes to keep consistent. The test plan must pin `recent`-vs-`all` equivalence (oracle test) to prevent silent divergence.
- The watermark file becomes operational state: if deleted/corrupted, the next `reconcileRecent` safely bootstraps with a full pass (covered below).

**Follow-up debt (out of scope here)**
- Optimize `reconcileAll` (Option B techniques: single streamed Cypher query to kill the N+1, `UNWIND` apply, parallelize the three kinds). Biggest lever for the weekly run's cost.
- The `reconcileAuthor` **trigger surfaces** — profile-page button, API endpoint, customer-scoped scheduling — are a separate story (UI/API), this ADR only builds the engine mode.
- Replace per-pubkey JSON file fanout with sorted JSONL + merge-join.
- **Event-id fast-path for `reconcileRecent`** (deferred optimization — deliberately *not* the default). Neo4j stores `kind3EventId` / `kind10000EventId` / `kind1984EventId`, and a nostr event id is a SHA-256 over the event's tags, so an author whose stored id equals strfry's latest id has a provably-identical relationship set → an O(1) skip of the per-author set diff. We intentionally do **not** enable this: the set diff re-derives ground truth from the actual edges, whereas the event-id check trusts recorded bookkeeping as a proxy. A partial-write bug that advanced the id but left one or more FOLLOWS/MUTES/REPORTS edges wrong would be **invisible** to the fast-path (caught only by the weekly `reconcileAll`), whereas the set diff catches it on the next `reconcileRecent` that covers the author. Since the per-author set diff is microseconds (never the bottleneck), the honest comparison wins. Revisit only if profiling shows the per-author Neo4j extraction is a real cost — and if enabled, document this correctness tradeoff at the call site.
- Harden the live stream (`updateNostrRelationships.sh`) to reduce the drift the sweeps must repair.

**Firmware reinstall required?** No.

## Implementation notes

The Implementer reads this section verbatim. Default behavior change: the routine reconciliation task (`reconcileRecent`) becomes author-restricted, bootstrapping with a full pass on first run.

### 1. Watermark state (new)

- File: `/var/lib/brainstorm/pipeline/reconciliation/state.json`. Shape:
  ```json
  {
    "lastRunStartedAt": 1716300000,
    "lastRunCompletedAt": 1716300420,
    "lastRunMode": "recent",
    "lastFullRunCompletedAt": 1715700000,
    "edgeCounts": { "follows": 11900000, "mutes": 240000, "reports": 38000 }
  }
  ```
- New helper (bash + `jq`, consistent with the rest of the pipeline) to read/write atomically (`write tmp + mv`). Suggested: `src/pipeline/reconciliation/reconciliationState.sh` exposing `read_state`, `write_state`, `get_watermark`.
- Missing/unparseable file ⇒ "no watermark" ⇒ `reconcileRecent` bootstraps with a full pass.
- `reconcileAuthor` does **not** read or advance this watermark — it is targeted and orthogonal to the sweep cadence.

### 2. Orchestrator changes — `reconciliation.sh`

- Accept `--mode recent|all|author` (default `recent`) and `--pubkey <hex>` (required for `author`).
- **`recent`:** read watermark `T = lastRunStartedAt_previous − RECONCILIATION_OVERLAP_SECONDS` (overlap re-scans a safety window; re-scanning already-reconciled authors is idempotent — the diff finds no change). If no watermark exists, run as `all` this once (bootstrap), then write the watermark.
- **`all`:** today's behavior — no `--recent`, all raters. Sets `lastFullRunCompletedAt` on success.
- **`author`:** restrict to `{--pubkey}`; no watermark; fetch that author's latest kind 3/10000/1984 events (e.g. `strfry scan` with an `authors` filter), diff against their Neo4j edges, apply. Does not touch `state.json`.
- **Reorder per phase in `recent`/`author`:** run the strfry dump+convert *first* (so the covered-author set exists), then the Neo4j extraction restricted to that set, then diff, then apply. `all` keeps today's order.
- Pass `--recent $(( now - T ))` to each `strfryToKind<K>Events.sh` in `recent`; pass nothing (full history) in `all`.
- **No-op fast-path (`recent` only, optional):** before extraction, `strfry scan --count` for kinds `[3,10000,1984]` since `T`. If total is `0`, emit `phase=no_drift` (see §6), advance the watermark, `exit 0`. (An empty window already no-ops naturally; this just skips spinning up the Node stages — keep if cheap, drop if it complicates.)
- **Drift signal (observability, not a gate):** the precise per-run drift is the diff's own add/delete counts — log those per kind. Optionally also log Neo4j relationship counts (`MATCH ()-[r:FOLLOWS]->() RETURN count(r)`, cheap via count store) next to strfry's per-kind **author** count (`strfry scan --count {kinds:[K]}` = authors with that kind, *not* an edge total) as a coarse rater-count trend. Persist edge counts in `state.json`.
- On success, write `state.json` (set `lastFullRunCompletedAt` only when mode was `all` or a bootstrap full pass).
- Keep `set -e`/`set -o pipefail`. On failure, do **not** advance the watermark (next `reconcileRecent` re-covers the window). Existing `emit_function_error` / `TASK_ERROR` handling stays.
- `cleanup()` ([:88](src/pipeline/reconciliation/reconciliation.sh:88)) unchanged, runs at start/end.
- Step 6B `projectFollowsGraphIntoMemory.sh` ([:558](src/pipeline/reconciliation/reconciliation.sh:558)) runs after follows in `recent`/`all` (cheap relative to the rest; leave as-is). For `author`, skip it (a single-author change doesn't warrant a full GDS reprojection) — or defer to a batched reprojection; Implementer's call, note it.

### 3. Restricted-author path — `getCurrentFollowsFromNeo4j.js`, `getCurrentMutesFromNeo4j.js`, `getCurrentReportsFromNeo4j.js`

- Add option `--authorsFromDir <path>` (the matching `currentRelationshipsFromStrfry/<kind>/` dir). When present:
  - Skip `getRaterCount()` and `getRaters()`.
  - Build the rater list from `fs.readdirSync(dir)` filtered to `*.json` (excluding `_summary.json`), stripping `.json` to recover pubkeys.
  - Run the **existing** per-author loop (`getFollowsForRater` etc.) over just that set. No change to the per-author query or file-writing.
- When absent, behavior is exactly as today (`all` mode).
- Uniform across all three extractors (mutes/reports mirror follows at the same line offsets).

### 4. Remove per-rater debug log

- Delete the `reconciliation_currentRaterBatch.log` `fs.appendFileSync` calls in [getCurrentFollowsFromNeo4j.js:299-335](src/pipeline/reconciliation/getCurrentFollowsFromNeo4j.js:299) (and equivalents in mutes/reports if present). Keep the real `log()` lines to `reconciliation.log`.

### 5. Task registry + config

- `taskRegistry.json` ([:317](src/manage/taskQueue/taskRegistry.json:317)): replace the single `reconciliation` entry with three, all pointing at the **same** `reconciliation.sh`:
  - `reconcileRecent` → `--mode recent`, `"resourceClass": "neo4j-heavy"`.
  - `reconcileAll` → `--mode all`, `"resourceClass": "neo4j-heavy"`.
  - `reconcileAuthor` → `--mode author` (+ a `pubkey` argument; follow the existing customer/pubkey-arg convention used by `calculateCustomer*`), **no** `resourceClass`.
  - Keep a `reconciliation` alias mapping to `reconcileAll` if anything external still references the old key, or update those callers. Implementer verifies no systemd/scheduler entry references the bare key without being updated.
- Ensure `neo4j-heavy` is present in `resourceClassCaps` in `/etc/brainstorm-task-queue.json` (ADR 0013 establishes `"neo4j-heavy": 1`).
- New `brainstorm.conf` setting (default baked into the orchestrator so a missing value is safe): `RECONCILIATION_OVERLAP_SECONDS` (default `3600` = 1 hour). (No full-interval setting — cadence is the scheduler's job now.)
- Scheduling (operator-configured, documented, not hard-coded in the script): `reconcileRecent` ~every 10 min; `reconcileAll` weekly. `reconcileAuthor` is on-demand (its trigger surfaces are a follow-up story).

### 6. Structured logging vocabulary

Extend the existing bash `emit_task_event` usage (sourced at [reconciliation.sh:12](src/pipeline/reconciliation/reconciliation.sh:12)):
- `TASK_START` metadata gains `"mode": "recent"|"all"|"author"`, `"watermark": <ts>` (recent/all), `"pubkey": <hex>` (author), and `"bootstrap": true` when `recent` promoted to a full pass.
- New `PROGRESS` tokens: `"phase":"no_drift"` (early-exit); on completion `"drift": {"<kind>": {"added": N, "deleted": N}}` plus optional `"edge_counts_before"/"edge_counts_after"`.
- `TASK_END` metadata gains `"mode"`, `"watermark_advanced_to": <ts>` (recent/all), and per-kind drift totals.

### 7. Documentation — `OPERATIONS.md`

New subsection covering: the three tasks (`reconcileRecent` / `reconcileAll` / `reconcileAuthor`) and `--mode`/`--pubkey`; the recommended schedule (10-min recent, weekly all); the watermark file and how to inspect/reset it; `RECONCILIATION_OVERLAP_SECONDS`; how to force a full run for incident recovery (`reconcileAll`); which tasks are `neo4j-heavy` and why `reconcileAuthor` is not; the new structured-event tokens.

### Tests (for the Tester, Phase 3)

- **Oracle equivalence:** seed a known strfry+Neo4j state with drift; run `reconcileAll`, snapshot Neo4j edge sets; reset Neo4j to a pre-state; run `reconcileRecent` from a fresh watermark over the same window; assert identical FOLLOWS/MUTES/REPORTS edge sets.
- **No spurious deletes (the invariant):** with both dirs restricted to the covered set, assert an uncovered rater present in Neo4j but *not* in the covered set is never emitted to `*ToDeleteFromNeo4j.json`.
- **Set-diff not count:** an author whose follow *count* is unchanged but whose membership changed (drop A, add B) yields exactly one add and one delete.
- **Drift-detection regression:** inject a bogus FOLLOWS edge directly (no corresponding event); assert `reconcileRecent` does **not** repair it but `reconcileAll` does. Both are passing behaviors.
- **First-run bootstrap:** absent watermark ⇒ `reconcileRecent` runs a full pass and writes the watermark.
- **No-op:** zero events since watermark ⇒ early-exit, watermark advanced, no diff files written.
- **`reconcileAuthor`:** given a pubkey, reconciles only that author's edges, touches no other author, does not read/advance `state.json`.
- **Idempotency:** two `reconcileRecent` runs back-to-back with no new events ⇒ no adds/deletes on the second.
- **Failure leaves watermark intact:** a forced mid-run failure does not advance `lastRunStartedAt`.
- **Source-sentinel/regression:** `strfryToKind*` invoked with `--recent` in `recent` mode; extractors honor `--authorsFromDir`; registry has `reconcileRecent`/`reconcileAll` tagged `neo4j-heavy` and `reconcileAuthor` untagged; per-rater debug log gone.

## Out of scope

- **Optimizing `reconcileAll`'s N+1 / parallelizing the three kinds** (Option B techniques). Separate follow-up ADR.
- **`reconcileAuthor` trigger surfaces** — profile-page button, API endpoint, customer-scoped scheduling. Separate follow-up story (UI/API); this ADR delivers only the engine mode.
- **Replacing per-pubkey file fanout with sorted JSONL + merge-join.**
- **Hardening the live event stream** (`src/pipeline/stream/updateNostrRelationships.sh`).
- **Deleting the deprecated `src/pipeline/reconcile/` directory.** Housekeeping; now functionally superseded by `reconcileAuthor`, so it becomes a safe cleanup target — tracked separately.
- **Changing the Neo4j data model, the APOC apply commands, or the converters.** Reused unchanged.
