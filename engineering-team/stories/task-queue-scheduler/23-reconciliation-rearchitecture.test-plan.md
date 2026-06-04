# Test Plan: Story 23 — Reconciliation re-architecture (four guarantee-specific tasks)

**Story:** `engineering-team/stories/23-reconciliation-rearchitecture.md`
**ADR:** `engineering-team/decisions/0020-reconciliation-rearchitecture.md`
**Date:** 2026-05-22

## Approach

Same precedent as #5/#6/#8/#10/#11/#12/#13/#15/#18/#22. The implementation is bash (four new per-task scripts) + Node extraction deltas + a `taskRegistry.json` change + docs — so the `npm test` layer uses **source/structural sentinels** that pin the ADR-required code shape, and the **behavioral heart runs as the cycle-local / staging smoke** against the live strfry + Neo4j stack at prod scale.

The behavioral guarantees are not reproducible at the `npm test` layer: they need real strfry events + a prod-scale Neo4j graph (the whole point — the failure was scale-dependent), and the reconciliation Node scripts `require('yargs/yargs')`/`neo4j-driver` which exist only in the production install. So oracle equivalence, the bounded-memory `reconcileAll` completion (the actual retirement of the #22 prod block), the network-set selection, the stale-edge-delete catch, and the budgets are the **authoritative cycle-local/staging smoke** (Reviewer-required). The regression guards pin the reused machinery at the source level.

- **T1..T11** — FAIL pre-implementation, PASS post. The ADR 0020 new code shape, grouped by build phase.
- **R1..R4** — PASS pre AND post. Regression guards on machinery ADR 0020 reuses **verbatim** (the per-author set diff, the APOC apply, the strfry `--recent` capability, the kind-3 converter). If the Implementer breaks one (e.g. turns the set diff into a count check), these trip.
- **S1..S10** — cycle-local/staging smoke. Correctness oracle, bounded-memory completion at scale, network selection, drift catch, isolation, no-bootstrap, the index precondition, the OBS fixes, and neo4j-heavy serialization.

## Coverage map

| AC (story #23) | Sentinel(s) | Smoke | File |
|---|---|---|---|
| `reconcileAuthor` — single author, no regression | **T1** (own script) + **T8** (`pubkey = $pk`) + **T9** (NOT neo4j-heavy) | **S6** isolation | test/reconciliation-rearchitecture.test.js |
| `reconcileRecent` — bounded, within cadence | **T1** + **T2** (max-recency cap) + **T4** (N+1/enumeration gone) + **T5** (parameterized `IN $`) | **S1** oracle, **S2** runtime/cadence, **S7** no-bootstrap | same |
| recency window **overridable** | **T3** (override flag) | **S2** (override) | same |
| `reconcileNetwork` — parameterized predicate, < 1h | **T1** + **T6** (`influence` cutoff AND `hops`) | **S3** (selects exactly the trusted set; < 1h) | same |
| `reconcileAll` — truly all, bounded memory | **T1** + **T7** (no scope filter + sorted merge-join) | **S4** (bounded-memory completion at 32M scale — the prod-block retirement) | same |
| four tasks **independent** | **T1** (four scripts) + **T9** (four registry keys → own scripts) | — | same |
| legacy `reconciliation` **removed** | **T9** (key absent; no entry points at `reconciliation.sh`) | — | same |
| OPERATIONS.md updated | **T11** | — | OPERATIONS.md |
| (ADR consequence) #22 **OBS-1/OBS-2** fixed | **T10** (own taskName + terminal-on-failure) | **S9** | same |

**Totals:** T1..T11 = **11 failing sentinels** (flip to PASS post-impl, incrementally as each phase lands). R1..R4 = **4 regression guards** (PASS pre AND post). Confirmed `{pass: 4, fail: 11}` pre-implementation.

## Edge cases

- [x] **The eager enumeration is genuinely gone, not just bypassed** — `T4` asserts `getRaters()`/`getRaterCount()`/`getFollowsForRater()` AND the `DISTINCT … ORDER BY … SKIP/LIMIT` query (the exact crasher) are removed dir-wide, so a stray copy can't regress.
- [x] **Parameterized `IN`, not interpolation** — `T5` pins `IN $param` (or the two-stage flag fallback), never an interpolated literal list; the `:NostrUser(pubkey)` index this depends on is a smoke precondition (**S8**).
- [x] **`reconcileAll` ≠ `reconcileNetwork`** — `T7` negatively asserts no `influence`/`hops`/`pubkey` filter in `reconcileAll.sh`, so truly-all isn't quietly narrowed to the trusted subset.
- [x] **`reconcileAuthor` is NOT neo4j-heavy** — `T9` asserts `resourceClass !== 'neo4j-heavy'` so an interactive trigger never queues behind a sweep.
- [x] **Legacy key fully removed** — `T9` asserts `!('reconciliation' in tasks)` and that no task entry still invokes `reconciliation.sh`.
- [x] **OBS fixes baked into the rewrite** — `T10`: each script emits under its own taskName (OBS-2) and a terminal `TASK_END`/`TASK_ERROR` via `trap` on failure (OBS-1).
- [ ] **Real strfry `since` semantics, real Neo4j edge sets, bounded-memory completion at 32M, network-set membership, stale-edge delete, watermark advance/rollback, neo4j-heavy serialization** — not catchable in source; **cycle-local/staging smoke is authoritative**.

## Not covered (deferred to cycle-local/staging smoke — authoritative, Reviewer-required)

Run on the live stack with seeded strfry events; the heavy/scale items run on `staging.brainstorm.world` (prod-scale: ~32M FOLLOWS).

**S1 — `reconcileRecent` oracle equivalence:** seed a known drift state within a window; run `reconcileRecent` (bounded window) and `reconcileAll`; assert the FOLLOWS/MUTES/REPORTS edge sets they produce **for the windowed authors** are identical.

**S2 — `reconcileRecent` runtime + override:** on a synced prod-scale graph, `reconcileRecent` completes **well inside its ~10-min cadence**; an explicit `--recency` override widens/narrows the window as expected; cost stays bounded by the window.

**S3 — `reconcileNetwork` selection + budget:** `reconcileNetwork --network verified` reconciles **exactly** the `influence ≥ cutoff` set (a below-cutoff author is untouched; one crossing the cutoff is picked up); a second definition (`hops < N`) selects the hops set; completes **comfortably < 1h** at prod scale.

**S4 — `reconcileAll` bounded-memory completion (THE prod-block retirement):** `reconcileAll` over the full ~32M-edge staging graph **runs to completion without breaching `transaction.total.max`** and writes its baseline — the exact failure from the #22 staging addendum, now passing. Capture peak memory + wall-time (target < 1h, gate = completes).

**S5 — stale-edge delete still caught (set-diff, not count):** construct an author whose follow *count* is unchanged but membership changed (drop A, add B), and a stale edge the live stream left behind (correct `kind3EventId`, wrong edge); assert the relevant task emits exactly one add + one delete and removes the stale edge — the drift the rejected id-diff fast-path could not see.

**S6 — `reconcileAuthor` isolation:** reconciles only `$pk`'s edges; a different author's edges and the sweep watermark are untouched.

**S7 — `reconcileRecent` never bootstraps:** with no watermark, `reconcileRecent` reconciles **only the default window** (no full pass), then sets the watermark — the no-surprise-bootstrap hazard is gone.

**S8 — `:NostrUser(pubkey)` index precondition:** `SHOW INDEXES` confirms the index exists; `EXPLAIN` of `reconcileRecent`'s `WHERE u.pubkey IN $list` shows a `NodeIndexSeek` (not a label scan).

**S9 — OBS-1/OBS-2:** a deliberately-failed reconcile task surfaces `TASK_ERROR` (and does **not** read "running" forever in `/api/scheduled-tasks/status`); the Scheduled Tasks panel shows a per-task **last run** for each of the four tasks.

**S10 — neo4j-heavy serialization (ADR 0013):** `reconcileRecent`/`reconcileNetwork`/`reconcileAll` serialize against each other and the GrapeRank/PageRank tasks (events.jsonl `resource_class_wait_*`); `reconcileAuthor` does **not** wait on the class.

## Test infrastructure

- Existing hand-rolled Node runner (`npm test` → `test/test.js`); no new deps (house rule).
- Registered: `reconciliationRearchitecture`, last in `test/test.js`'s suite list (after `generalizedTaskScheduler`).
- Asserts only against in-repo files: the four `src/pipeline/reconciliation/reconcile{Recent,Network,All,Author}.sh` (to be created), the reused `calculateFollowsUpdates.js` / `kind3EventsToFollows.js` / `apocCypherCommands/*` / `strfryToKind*Events.sh`, `src/manage/taskQueue/taskRegistry.json`, `OPERATIONS.md`. The dir-wide search (`reconDirSource()`) keeps the "enumeration gone" / "parameterized select present" sentinels layout-agnostic.
- No live API for the sentinel layer. Behavioral layer is strfry + Neo4j + bash — cycle-local/staging smoke; no Playwright (the `reconcileAuthor` UI trigger is a separate follow-up story).

## How to run

```
npm test
```

Targeted: `node -e "require('./test/reconciliation-rearchitecture.test.js').run()"`

## Verification

New tests fail on the pre-implementation tree (atop ADR commit `5dc76304`); all 18 prior suites stay green. Confirmed 2026-05-22:

```
reconciliation-rearchitecture suite:
  ✗ T1: reconciliation is four independent task scripts, not one --mode engine
  ✗ T2: reconcileRecent caps its lookback at a bounded, overridable max-recency window
  ✗ T3: reconcileRecent accepts an explicit recency override
  ✗ T4: the eager rater-enumeration + N+1 that crashed reconcileAll are gone
  ✗ T5: reconcileRecent selects its authors by a parameterized pubkey set, not string interpolation
  ✗ T6: reconcileNetwork scopes by a parameterized network predicate (influence cutoff AND hops)
  ✗ T7: reconcileAll reconciles truly-all via a streamed scan + sorted merge-join
  ✗ T8: reconcileAuthor scopes to a single pubkey
  ✗ T9: taskRegistry has all four reconcile tasks → own scripts, legacy key removed, neo4j-heavy correct
  ✗ T10: each task emits under its OWN taskName + a terminal event on failure (fixes #22 OBS-1/OBS-2)
  ✗ T11: OPERATIONS.md documents the four tasks, recency cap, network selector, deprecation
  ✓ R1: the diff still compares follow sets by membership (Set.has), not by count
  ✓ R2: the APOC apply still MERGEs / DELETEs FOLLOWS relationships
  ✓ R3: all three strfry dumpers still support --recent
  ✓ R4: the kind-3 → follows converter still extracts `p` tags as followed pubkeys

reconciliation-rearchitecture suite:             FAIL (4 passed, 11 failed)
Overall:                                          FAIL
```

All 18 prior suites continue to PASS (no regressions from registering the new suite).
