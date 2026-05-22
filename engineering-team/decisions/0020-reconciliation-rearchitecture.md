# ADR 0020: Reconciliation re-architecture — four independent tasks, single-query extraction scoped by author / recency / network / all

**Status:** Accepted
**Date:** 2026-05-22
**Story:** `engineering-team/stories/23-reconciliation-rearchitecture.md`
**Amends/supersedes:** ADR 0018 (reconciliation incremental mode) — supersedes its single-engine `reconciliation.sh --mode` design and its crashing per-rater extraction (the eager `getRaters` enumeration + the N+1). `reconcileAll`'s "truly all" scope is **retained** and finally made feasible; the bounded *routine* sweep moves to a new `reconcileNetwork` task. Builds on ADR 0012/0015 (task queue), ADR 0013 (`neo4j-heavy` semaphore), ADR 0019 (the scheduler that drives these tasks).

## Context

Story #23's driver: at prod scale (staging ≈ prod: ~2.5M `NostrUser`, ~32M `FOLLOWS`) `reconcileAll` ran ~6h and died ~62% into the follows phase on Neo4j's `dbms.memory.transaction.total.max` (3.9 GiB), watermark never written (review #22 staging addendum). Two compounding faults in `getCurrentFollowsFromNeo4j.js`: a `getRaters()` query that re-scans the whole graph with eager `DISTINCT … ORDER BY … SKIP/LIMIT` **per batch** (2,195 times), and an N+1 per-author extraction (`getFollowsForRater`, ~2.2M round-trips). The **apply** stage (APOC `apoc.periodic.iterate`) is fine and proven at scale — the `batch/` build uses the same commands.

**Grounded constraint — why a cheap event-id "fast-path" is unsound.** All three graph writers (live stream `stream/wot/`, `batch/`, reconciliation) set `kind3EventId` via the *same* `apocCypherCommand2` — but **separately from, and additively to, the edge edits** (`create_wot`/`delete_wot` MERGE adds; the stream's delete computation is the lossy real-time path that *creates* drift). So an author can carry the **correct latest `kind3EventId` yet have stale edges** (a dropped follow the stream never removed). "id matches ⟹ edges correct" is false for exactly the delete case reconciliation exists to catch. Confirms ADR 0018's deferred-fast-path caution: **consistency must re-derive edges, not trust bookkeeping.**

**Concept-graph orientation** (staging `/api/concept-graph/`, TA `8e9013…5fb1`): `nostr-user` (`NostrUser`, `nodeLabelRequired`), `web-of-trust` (*"users you follow are implicitly trusted, and their follows extend trust transitively … GrapeRank determines which concept definitions achieve loose consensus"*), `graperank`. Per BIBLE.md:1436, a **"verified"** user has GrapeRank `influence ≥ VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` (`/etc/graperank.conf`, default `0.05`); `hops` (distance from the owner) is another per-user trust property. **Key implication:** an untrusted account's follow list is inert to the WoT, so the *routine* sweep should prioritize a trusted "network" (→ `reconcileNetwork`), while a complete sweep of every rater (`reconcileAll`) keeps value as an infrequent oracle / incident-recovery now that it's feasible.

**Story #23 constraints (as refined in the Architecture conversation):** **four** independent, guarantee-specific tasks; `reconcileNetwork` comfortably **< 1h** for sensible networks; `reconcileAll` (truly all) must **complete within bounded memory** (< 1h a *target*, not a gate); `reconcileRecent` a bounded, overridable recency window (default ~1–6h), built first; legacy mode-less task deprecated; the extract-diff-apply model explicitly re-openable.

## Options considered

### Option A — Event-id drift selection
Compare each author's Neo4j `kind3EventId` against strfry's latest kind-3 id; reconcile only mismatches. **Rejected:** unsound (above) — the stream sets the id additively without computing deletes, so a matching id masks stale edges. Trades correctness for speed.

### Option B — One shared streamed merge-join engine
A single engine for all tasks: stream both sides as sorted `(rater,ratee)` pairs, external-sort, merge-join → adds/deletes → apply; tasks differ only by an input filter. Correct and scalable. **Rejected** as the *overall* shape: it forces one shared engine across all four tasks, against the operator's "stricter separation" intent. Its merge-join *technique*, however, is exactly the right tool for `reconcileAll` (the only truly-full-graph task) and is **adopted there** within Option C.

### Option C — Four independent tasks, single WHERE-scoped streamed query (chosen)
Each task is its own implementation. The N+1 and the rater-enumeration both vanish because the Neo4j side is extracted by **one streamed Cypher query** whose `WHERE` clause *is* the task's guarantee:

| Task | Neo4j extraction (one streamed query) | Scope / guarantee | Budget |
|---|---|---|---|
| `reconcileAuthor` | `… WHERE u.pubkey = $pk` | one author | seconds, on-demand; **not** `neo4j-heavy` |
| `reconcileRecent` | `… WHERE u.pubkey IN $recentAuthors` | authors with events in a bounded, overridable window (default ~1–6h) | well within its ~10-min cadence |
| `reconcileNetwork` | `… WHERE <predicate>` — `u.influence >= $cutoff` (default 0.05) or `u.hops < $maxHops`; **parameterized, extensible** | a configurable trusted network | comfortably **< 1h** |
| `reconcileAll` | `… ` no filter — every rater | **truly all** (~32M edges) | **complete within bounded memory**; < 1h a target |

`RETURN u.pubkey, t.pubkey` with **no `DISTINCT`/`ORDER BY`/`collect`/`SKIP`/`LIMIT`** → no eager operator → the driver streams rows lazily under bounded transaction memory. Diff against the strfry side for the same scope; apply via the existing APOC commands. The diff sizes to the scope: bounded sets (author/recent) diff in memory; larger sets (network, all) use a **sorted merge-join** (external sort on disk, bounded memory — Option B's technique).

**Pros:** kills both failure modes with one query; `reconcileNetwork`/`reconcileAll` are bounded by their scope, not by an eager enumeration → fit their budgets; each task independently tuned (honors "stricter separation"); reuses the proven APOC apply; `reconcileAll` keeps the *complete* guarantee while `reconcileNetwork` gives a fast, WoT-meaningful routine sweep; `reconcileRecent` never promotes to a full pass (bounded window) so the no-surprise-bootstrap hazard disappears; **separate scripts emitting under their own task names fix #22 OBS-1/OBS-2 as a side effect**.

**Cons / tradeoffs:** (1) `reconcileNetwork` reconciles only its defined network; users outside it aren't swept by it (but are by the periodic `reconcileAll`, and join the network when they cross the predicate). (2) `influence`/`hops` are likely unindexed → `reconcileNetwork` does a 2.5M-node label scan with a property filter (acceptable streamed; index if measured slow). (3) `reconcileRecent`'s `IN $list` and the apply both depend on a **`:NostrUser(pubkey)` index** (almost certainly present; confirm via `SHOW INDEXES`). (4) four lightly-duplicated scripts — mitigated by sharing only the invariant APOC `.cypher` apply files + a thin diff/apply helper.

## Decision

**Option C.** Retire `reconciliation.sh --mode` and the legacy `reconciliation` registry key. Build **four** independent task scripts, each extracting via one `WHERE`-scoped streamed query:
- `reconcileAuthor` — `pubkey = $pk` (one author).
- `reconcileRecent` — `pubkey IN $recent` over a bounded, overridable window; pass the pubkeys as a **query parameter** (not interpolated), relying on the `:NostrUser(pubkey)` index. (If a large override window ever makes the set unwieldy, the fallback is a two-stage `SET u.reconcile=true … WHERE u.reconcile=true` with guaranteed cleanup + a flag index — not needed at normal scale.)
- `reconcileNetwork` — a **parameterized** predicate (`influence >= cutoff` reading `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF`, or `hops < N`, extensible) over a single inline `WHERE` (no list, no flag).
- `reconcileAll` — no filter, **truly all**; streamed scan + sorted merge-join diff.

Reuse the APOC apply unchanged. **Budgets:** `reconcileNetwork` is the routine scheduled sweep and must be comfortably < 1h; `reconcileAll` is the infrequent complete oracle / incident-recovery and must **complete within bounded memory** (< 1h a target, not a gate). This restores ADR 0018's "reconcileAll = weekly oracle" framing — now actually feasible.

**Phasing** (one ADR, per-task build): **(1) `reconcileRecent`** — bounded window, the proving ground for the streamed-query → diff → apply chain; measure runtime. **(2) `reconcileNetwork`** — adds the parameterized predicate + the merge-join for larger scopes, the routine sweep. **(3) `reconcileAll`** — truly all, validated for bounded-memory completion. **(4) `reconcileAuthor`** extracted to its own script; **legacy removed**.

## Consequences

**Enabled**
- `reconcileNetwork` is a fast routine sweep; `reconcileAll` completes within bounded memory (the crash is fixed); `reconcileRecent` bounded and bootstrap-free; #21/#22 unblock once validated.
- The no-surprise-bootstrap problem (#22 AC-10 / OPERATIONS §13.4 runbook) **dissolves**.
- #22 **OBS-1** (phantom "running") and **OBS-2** (reconcile last-run blank) are fixed — each task is its own identity, emitting `TASK_START`/`TASK_END`/`TASK_ERROR` under its own `taskName`.
- `reconcileNetwork`'s definition is operator-tunable (verified today; hops-based and others later) without new code per definition.

**Constrained / made harder**
- `reconcileNetwork` only sweeps its network; completeness relies on the periodic `reconcileAll`.
- `influence`/`hops`/`pubkey` must be queryable at scale; may warrant indexes (measure; `pubkey` index is a hard dependency for `reconcileRecent`).
- Four scripts to keep behaviorally consistent (shared apply + helper limit drift).

**Follow-up debt**
- Optional `NostrUser(influence)`/`(hops)` indexes. Deprecated `src/pipeline/reconcile/` cleanup. Live-stream hardening. `reconcileAuthor` trigger surfaces (separate UI/API story). The two-stage-flag path for very large recent windows (only if needed).

**Firmware reinstall required?** No — operational/ETL only; no concept definitions changed.

## Implementation notes

- **Replace `reconciliation.sh --mode`** with four scripts under `src/pipeline/reconciliation/` (e.g. `reconcileRecent.sh`, `reconcileNetwork.sh`, `reconcileAll.sh`, `reconcileAuthor.sh`), each: scope its strfry dump, run its single `WHERE`-scoped extraction, diff, apply, (recent) advance the watermark, emit per-task structured events on **every** exit path (OBS-1).
- **Extraction:** one streamed Cypher per task as tabled; **delete** `getRaters()`/`getRaterCount()`/`getFollowsForRater()` and the per-batch enumeration in `getCurrentFollowsFromNeo4j.js` (+ mutes/reports siblings). Consume the result as a stream (reactive/`fetchSize`), writing `(rater,ratee)` JSONL — never materialize the full set, never use eager `DISTINCT/ORDER BY/collect`.
- **`reconcileRecent`:** new `RECONCILE_RECENT_MAX_RECENCY_SECONDS` (default `21600` = 6h), overridable per-invocation; lookback = `min(now − watermark, max_recency)`; recent-author list from the strfry `--recent` dump → pass as the `$pubkeys` **parameter** to `WHERE u.pubkey IN $pubkeys`; **no** promotion to full on a missing watermark.
- **`reconcileNetwork`:** a `--network <name>` selector mapping to a predicate (`verified` → `u.influence >= cutoff` from `/etc/graperank.conf`; `hops3` → `u.hops < 3`); design for adding definitions without code changes per definition where practical.
- **`reconcileAll`:** no filter; streamed scan + **sorted merge-join** (external `sort` on disk) against the full strfry dump → adds/deletes.
- **`reconcileAuthor`:** `WHERE u.pubkey = $pk`; single author; no watermark.
- **Diff:** reuse `calculate<Kind>Updates.js` set-diff logic fed by the single-query output; in-memory for bounded scopes, merge-join for network/all. **Apply:** reuse `apocCypherCommand1_*ToAdd/Delete` + `command2` unchanged.
- **Index dependency:** confirm `:NostrUser(pubkey)` index exists (`SHOW INDEXES`) — `reconcileRecent`'s `IN` and the apply's `MATCH {pubkey}` both depend on it.
- **mutes/reports:** same per-task pattern; small scale (~191k/168k).
- **Registry:** point `reconcileRecent`/`reconcileNetwork`/`reconcileAll`/`reconcileAuthor` at the new scripts; **remove** `reconciliation`; `neo4j-heavy` on recent/network/all, not author.
- **OPERATIONS.md:** rewrite for the four tasks + scopes/guarantees/budgets, the recency cap, the network selector + verified cutoff, the deprecation; remove the obsolete seed-first runbook.

## Out of scope

- The #22 scheduler (delivered). Turning prod schedules on (operator).
- `reconcileAuthor` trigger surfaces (UI/API) — separate story.
- New index *creation* strategy beyond confirming the `pubkey` index (optional `influence`/`hops` indexes are a measured follow-up).
- Replacing strfry/Neo4j or the data model; the APOC apply and converters are reused unchanged.
- Deleting deprecated `src/pipeline/reconcile/` (safe cleanup, tracked separately).
