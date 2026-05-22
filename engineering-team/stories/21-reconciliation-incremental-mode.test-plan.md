# Test Plan: Story 21 — Speed up reconciliation (recent / all / author modes)

**Story:** `engineering-team/stories/21-reconciliation-incremental-mode.md`
**ADR:** `engineering-team/decisions/0018-reconciliation-incremental-mode.md`
**Date:** 2026-05-21

## Approach

Same precedent as #5/#6/#8/#10/#11/#12/#13/#15. The implementation is bash (`reconciliation.sh`) plus small Node deltas (the three extractors gain `--authorsFromDir`) and a `taskRegistry.json` change — so the `npm test` layer uses **source/structural sentinels** that pin the ADR-required code shape, and the **behavioral heart runs as cycle-local smoke** against the live strfry + Neo4j Docker stack.

The behavioral round-trips are not reproducible at the `npm test` layer for two reasons: (1) they need real strfry events + a real Neo4j graph; (2) the reconciliation Node scripts `require('yargs/yargs')` and friends, which exist only in the production install (`/usr/local/lib/node_modules/brainstorm`), **not** in this dev checkout (`yargs` is neither a declared dep nor in `node_modules`). So even a hermetic subprocess invocation of `calculateFollowsUpdates.js` fails at `npm test` with `MODULE_NOT_FOUND`. The set-diff behavior (and everything else behavioral) is therefore the **authoritative cycle-local smoke** (Reviewer-required). `R1` pins the set-based shape at the source level as the npm-test guard.

- **T1..T10** — FAIL pre-implementation, PASS post. The ADR-required new code shape.
- **R1..R5** — PASS pre AND post. Regression guards on the machinery ADR 0018 reuses **verbatim**: the per-author set diff, the converters, the APOC apply, `cleanup()`, and the strfry `--recent` capability. If the Implementer "optimizes" any of these (e.g. turns the set diff into a count check), these trip.
- **S1..S10** — cycle-local smoke. The correctness oracle, the runtime target, drift detection, isolation, idempotency, and the neo4j-heavy serialization.

## Coverage map

| AC | Test / mechanism | File | Level |
|---|---|---|---|
| AC-1 (minutes not hours; target < 15 min) | **T3** (recent passes `--recent` from watermark+overlap) + **T6** (author-restricted Neo4j extraction kills the N+1) + **R5** (strfry `--recent` capability preserved). **S2** = runtime measurement | test/reconciliation-incremental-mode.test.js | source + smoke |
| AC-2 (modes: recent default, all fallback — landed as 3) | **T2** (`reconciliation.sh --mode recent\|all\|author`) + **T8** (three registry keys) | same | source |
| AC-3 (incremental persists a watermark) | **T1** (state.json + watermark field) + **T3** (overlap window) | same | source |
| AC-4 (incremental output == full output; oracle) | **R1** (set-diff shape) + **T6** (same-author-set restriction). **S1** = oracle equivalence (authoritative) | same | source + smoke |
| AC-5 (periodic full fallback; first-run; cadence) | **T5** (first-run bootstrap) + **T8** (`reconcileAll`) + **T10** (docs cadence). Cadence lives in scheduler → **S6** | same | source + smoke |
| AC-6 (trigger either mode from existing surface; same script) | **T2** + **T8** (one `reconciliation.sh`, three registry keys, `--mode`) | same | source |
| AC-7 (no-drift → cheap, "no drift detected") | **T4** (`no_drift` early-exit + `strfry scan --count` gate). **S3** = no-op smoke | same | source + smoke |
| AC-8 (logs: mode, watermark, edge counts, drift adds/deletes, timing) | **T9** (mode / watermark / added / deleted vocabulary). **S1/S3** confirm real log content | same | source + smoke |
| AC-9 (no regression in full-run drift detection) | **R1**–**R5** + full `npm test` green. **S4** = drift regression (recent misses non-event drift, all catches) | same + full gate | source + smoke |
| AC-10 (OPERATIONS.md documents modes/watermark/cadence/force-full) | **T10** | OPERATIONS.md | source |

**Totals:** T1..T10 = **10 failing sentinels** (flip to PASS post-impl). R1..R5 = **5 regression guards** (PASS pre AND post). Confirmed `{pass: 5, fail: 10}` pre-implementation.

## Edge cases

- [x] **Set diff, not count** — the correctness property the operator specifically probed. `R1` pins `new Set(...)` + `.has(...)` at the source level; **S10** exercises same-count-different-membership (→ exactly one add + one delete) against the live diff.
- [x] **The no-spurious-deletes invariant** — a rater present in Neo4j but absent from the covered strfry set means "delete all their follows." That is correct ONLY because recent mode restricts the Neo4j extraction to the same covered set (**T6**). **S1/S5** verify uncovered authors are never touched.
- [x] **`reconcileAuthor` is NOT neo4j-heavy** — `T8` asserts `entry.resourceClass !== 'neo4j-heavy'` so an interactive trigger never queues behind an 8-hour sweep.
- [x] **First-run / lost-watermark bootstrap** — `T5` (source) + **S6** (end-to-end fresh deploy → full pass + watermark written).
- [x] **Debug-log removal scoped to follows only** — `T7` targets `getCurrentFollowsFromNeo4j.js`; the mutes/reports extractors never had the per-rater log (verified: 0 occurrences).
- [x] **Defensive reads** — `readSafe`/`readJsonSafe` return null on missing/malformed files; sentinels emit a "re-baseline" message rather than a parse crash.
- [ ] **Real strfry `since` semantics, real Neo4j edge counts, real APOC apply, real watermark advance/rollback, neo4j-heavy serialization under contention** — not catchable in source; **cycle-local smoke is authoritative**.

## Not covered (deferred to cycle-local smoke — authoritative, Reviewer-required)

Run on the live Docker stack (`http://localhost:8080`) with seeded strfry events + a populated Neo4j graph:

**S1 — AC-4 oracle equivalence (the headline test):** Seed a known drift state. Run `reconcileAll`; snapshot the FOLLOWS/MUTES/REPORTS edge sets. Reset Neo4j to the pre-state. Run `reconcileRecent` from a fresh watermark covering the same window. Assert the resulting edge sets are **identical** to the `reconcileAll` snapshot.

**S2 — AC-1 runtime:** On a staging-scale (or closest available) graph already in sync, `reconcileRecent` completes in **minutes (target < 15)**, vs the 6–8 h `reconcileAll` baseline. Capture the logged per-stage timing.

**S3 — AC-7 no-drift no-op:** With strfry and Neo4j in sync (no events since the watermark), `reconcileRecent` exits in the sub-minute fast-path, emits a `no_drift` event + a "no drift detected" log line, and advances the watermark without writing diff files.

**S4 — AC-9 / ADR constraint, drift regression:** Inject drift with NO corresponding recent event (e.g. directly delete a FOLLOWS edge in Neo4j whose author has published nothing since the watermark). Assert `reconcileRecent` does **not** repair it (the author isn't in the covered set) but `reconcileAll` does. Both are passing behaviors — this demonstrates *why* the weekly full run exists.

**S5 — `reconcileAuthor` isolation:** `reconcileAuthor --pubkey <X>` reconciles only X's edges; assert a different author Y's edges are untouched and `state.json` (the sweep watermark) is unchanged.

**S6 — AC-5 first-run bootstrap:** With no `state.json` (fresh deploy), `reconcileRecent` performs a full pass, then writes the watermark. The subsequent run is genuinely incremental.

**S7 — idempotency:** Two `reconcileRecent` runs back-to-back with no intervening events → the second produces zero adds/deletes and does not create a watermark gap.

**S8 — failure leaves watermark intact:** Kill `reconcileRecent` mid-run (or force a stage failure). Assert `state.json`'s `lastRunStartedAt` is NOT advanced, so the next run re-covers the same window.

**S9 — AC-5 neo4j-heavy serialization (ADR 0013 interaction):** Trigger `reconcileAll` and `calculateOwnerGrapeRank` back-to-back with the queue on; assert they serialize (events.jsonl `resource_class_wait_*`). Trigger `reconcileAuthor` concurrently with a sweep; assert it does **not** wait on the `neo4j-heavy` class.

**S10 — set diff not count (behavioral):** Construct a fixture where an author's follow *count* is unchanged but membership changed (drop A, add B). Assert the live diff emits exactly one add (B) and one delete (A). (This is the test that cannot run at the `npm test` layer due to the `yargs` dep; it runs here against the production install.)

## Test infrastructure

- Existing hand-rolled Node runner (`npm test` → `test/test.js`); no new deps (house rule).
- Registered: `reconciliationIncrementalMode`, last in `test/test.js`'s suite list (after `adminToolsDashboardPanel`).
- Asserts only against in-repo files: `src/pipeline/reconciliation/{reconciliation.sh, reconciliationState.sh, getCurrent*FromNeo4j.js, calculateFollowsUpdates.js, kind3EventsToFollows.js, apocCypherCommands/*, strfryToKind*Events.sh}`, `src/manage/taskQueue/taskRegistry.json`, `OPERATIONS.md`.
- No live API needed for the sentinel layer (concept-graph at `localhost:8877` not required). The behavioral layer is strfry + Neo4j + bash — cycle-local smoke territory; no Playwright (nothing pure-frontend in this story; the `reconcileAuthor` UI is a separate follow-up story).

## How to run

```
npm test
```

Targeted: `node -e "require('./test/reconciliation-incremental-mode.test.js').run()"`

## Verification

New tests fail on the pre-implementation tree (atop ADR commit `5ac95656`); all 16 prior suites stay green. Confirmed 2026-05-21:

```
reconciliation-incremental-mode suite:
  ✗ T1: reconciliation persists a watermark in state.json across runs (AC-3)
  ✗ T2: reconciliation.sh accepts --mode recent|all|author (+ --pubkey) (AC-2, AC-6)
  ✗ T3: reconcileRecent passes --recent from watermark+overlap to strfry dumpers (AC-1, AC-3)
  ✗ T4: reconcileRecent has a cheap no-drift early-exit (AC-7)
  ✗ T5: reconcileRecent bootstraps with a full pass when no watermark exists (AC-5)
  ✗ T6: the three Neo4j extractors honor --authorsFromDir (AC-1, AC-4)
  ✗ T7: per-rater debug log removed from the follows extractor (AC-1)
  ✗ T8: registry has reconcileRecent + reconcileAll (neo4j-heavy) and reconcileAuthor (not) (AC-2, AC-5, AC-6)
  ✗ T9: reconciliation.sh emits mode/watermark/per-kind drift vocabulary (AC-8)
  ✗ T10: OPERATIONS.md documents the three tasks/watermark/overlap/neo4j-heavy (AC-10)
  ✓ R1: the diff still compares follow sets by membership (Set.has), not count
  ✓ R2: the kind-3 → follows converter still maps events to per-pubkey files
  ✓ R3: the APOC apply still MERGEs / DELETEs FOLLOWS relationships
  ✓ R4: reconciliation.sh cleanup() still wipes the per-pubkey dirs at run start
  ✓ R5: all three strfry dumpers still support --recent

reconciliation-incremental-mode suite:           FAIL (5 passed, 10 failed)
Overall:                                          FAIL
```

All 16 prior suites continue to PASS (no regressions from registering the new suite):
`treasure-maps`, `scheduled-search`, `strfry-router-first-boot`, `per-query-neo4j-timeout`, `nip05-checkmark`, `publish-export`, `community-reference-stub`, `header-conceptgraph-tag`, `community-reference-superset-link`, `graperank-shared-csv-race`, `community-class-thread-pull`, `task-queue-bullmq`, `task-queue-neo4j-resource-class`, `entrypoint-template-rendering`, `bullboard-admin-access`, `admin-tools-dashboard-panel`.
