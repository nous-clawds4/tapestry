# Story 12: Make shared CSV initialization in personalizedGrapeRank safe under concurrent customer runs

**Status:** Approved
**Created:** 2026-05-19
**Type:** Bug

## Background

The customer-aware GrapeRank pipeline at `src/algos/customers/personalizedGrapeRank/personalizedGrapeRank.sh` takes a `<customer_pubkey> <customer_id> <customer_name>` argument set and produces customer-isolated outputs (logs, preferences, scorecards, Neo4j writes scoped by `observer_pubkey`). The customer-specific outputs are already correctly namespaced.

However, the first phase of the pipeline — raw data CSV initialization (lines 78–146) — writes to **globally shared** paths at `/var/lib/brainstorm/algos/personalizedGrapeRank/tmp/{ratees,follows,mutes,reports}.csv`, with an inline comment on line 78 stating "this step is not customer-specific, i.e. it is the same for all customers." The existence-check guard on line 81 skips the init step entirely when those CSVs are already present, avoiding redundant Neo4j queries.

This shared-cache design is safe under the current single-customer-at-a-time operational reality, enforced by `launchChildTask.sh`'s `pgrep`-based guard. It breaks the moment we start scheduling concurrent per-customer recalculations (planned in story #13). Two failure modes:

1. **Concurrent first-run race.** Two customer recalcs start within the same few seconds, both see no CSVs present, both invoke `initializeRawDataCsv.sh`, both write to the same paths. The CSVs end up interleaved or truncated.
2. **Stale-read race.** Customer A's init is mid-write. Customer B checks file existence, finds the files present (but only partially written), skips initialization, and reads truncated data → invalid scores propagated into Neo4j.

There is also an older sibling script at `src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRank.sh` that takes no arguments, is hardcoded to the host owner, writes to the same shared paths, and `rm -rf`s the tmp directory at the end. Its lifecycle interleaves with the customer-aware version. **It is intentionally separate from the customer-aware pipeline and will remain so**: owner-scope and customer-scope algorithms are stored in different Neo4j node types (a deliberate decoupling that predates customer support), the set of available scores may diverge or converge over time and that question is not yet decided, and the owner's results hold a privileged position because the owner — not customers — gates what nostr events make it into local strfry in the first place. Therefore this story does not retire the owner-scoped script; it folds it into the same shared-cache locking / coordination protocol the customer-aware script will use.

## User-facing description

**As an operator** scheduling concurrent per-customer GrapeRank recalculations, **I want** the pipeline to handle multiple customers running at the same time without corrupting shared intermediate data, **so that** every customer's scores reflect a complete, consistent Neo4j snapshot regardless of how many customers are queued.

## Acceptance criteria

- [ ] Two `calculateCustomerGrapeRank` runs for different customer pubkeys can start within seconds of each other and both complete successfully with correct scores in Neo4j.
- [ ] If two customer runs hit the CSV initialization step concurrently, exactly one initialization runs and the second waits and reads the completed result. (Per-customer private CSV paths were considered at Planning and rejected; shared cache with coordination is the chosen approach — see Background and Open questions.)
- [ ] No customer run reads a partially-written CSV file under any concurrency pattern.
- [ ] The shared-CSV caching optimization (avoid redundant Neo4j fetches when fresh data is already present) is preserved — back-to-back recalculations within a configurable staleness window still skip the Neo4j fetch.
- [ ] The staleness window is defined, configurable, and documented; outside the window, the next run refreshes the CSVs.
- [ ] First run on a clean filesystem (no prior CSVs) succeeds without manual setup.
- [ ] The legacy owner-scoped `calculatePersonalizedGrapeRank.sh` is folded into the same shared-cache locking / coordination protocol as the customer-aware script (it is NOT retired — see Background for the owner-vs-customer separation rationale). It continues to share the global CSV cache and participates in whatever lock or coordination mechanism the Architect chooses.
- [ ] The end-of-run `rm -rf` of the shared tmp directory (in either the owner-scoped or customer-aware script) is cache-aware: it does not delete files an in-flight peer (owner or any customer) is still using.
- [ ] No regression: single-customer single-run flows produce identical outputs to today.
- [ ] Structured event log makes it visible when a run waited for / shared / re-used cached CSVs vs ran a fresh init.

## Concepts touched

To be resolved by the Architect via `/api/concept-graph/summaries`:

- Personalized GrapeRank (per-customer)
- Customer Manager / `customer.directory` convention
- Shared tmp-dir caching optimization
- Neo4j NostrUser / FOLLOWS / MUTES / REPORTS extraction (the CSV source)
- Structured event log

## Out of scope

- **The queue infrastructure itself.** Story #13 introduces BullMQ. This story is about correctness under concurrent execution regardless of the trigger source — the fix must hold whether jobs come from BullMQ, from systemd timers, or from manual triggers fired in parallel.
- **Recomputing or tuning the GrapeRank algorithm.**
- **Per-customer customization of the CSV extraction query.** The Cypher queries remain global.
- **Migration to per-customer Neo4j subgraphs.**
- **Removing the customer-namespaced output paths.** They're already correct.

## Open questions

**Resolved with operator at Planning (2026-05-19):**

- **Should the legacy owner-scoped script be retired?** → No. Keep separate; fold into the same shared-cache locking model. Rationale captured in Background.
- **Per-customer CSV paths vs. shared-with-locking?** → Shared-with-locking. The cached data is a global Neo4j snapshot (genuinely customer-agnostic), so re-extracting it N times per recalc cycle would be wasted work at scale. Architect to design the coordination protocol.

**Deferred to Architect (PO reviews at architecture gate):**

- **What is the right staleness window for the shared cache?** Architect to recommend a default based on Neo4j ingestion cadence and expected recalc frequency, with the value made configurable in the customer / owner preferences config.
- **Audit of other shared tmp paths in the pipeline** (`initializeRawDataCsv.sh`, `interpretRatings.js`, etc.). Architect to walk the full pipeline, not just the entry script, and surface any other shared-state hazards.

## Linked artifacts

- ADR: [0009-graperank-shared-csv-coordination.md](../decisions/0009-graperank-shared-csv-coordination.md)
- Test plan: [12-graperank-shared-csv-race.test-plan.md](12-graperank-shared-csv-race.test-plan.md)
- Review: [../reviews/12-graperank-shared-csv-race.md](../reviews/12-graperank-shared-csv-race.md) — **PASS** end-to-end (code/ADR/scope + cycle-local smoke S1–S8 confirmed).
