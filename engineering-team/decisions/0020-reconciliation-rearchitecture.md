# ADR 0020: Reconciliation re-architecture — three independent tasks, single-query extraction scoped by trust / recency / author

**Status:** Accepted
**Date:** 2026-05-22
**Story:** `engineering-team/stories/23-reconciliation-rearchitecture.md`
**Amends/supersedes:** ADR 0018 (reconciliation incremental mode) — supersedes its single-engine `reconciliation.sh --mode` design and its "`reconcileAll` = every rater" scope. Builds on ADR 0012/0015 (task queue), ADR 0013 (`neo4j-heavy` semaphore), ADR 0019 (the scheduler that drives these tasks).

## Context

Story #23's driver: at prod scale (staging ≈ prod: ~2.5M `NostrUser`, ~32M `FOLLOWS`) `reconcileAll` ran ~6h and died ~62% into the follows phase on Neo4j's `dbms.memory.transaction.total.max` (3.9 GiB), watermark never written (review #22 staging addendum). Two compounding faults in `getCurrentFollowsFromNeo4j.js`: a `getRaters()` query that re-scans the whole graph with eager `DISTINCT … ORDER BY … SKIP/LIMIT` **per batch** (2,195 times), and an N+1 per-author extraction (`getFollowsForRater`, ~2.2M round-trips). The **apply** stage (APOC `apoc.periodic.iterate`) is fine and proven at scale — the `batch/` build uses the same commands.

**Grounded constraint — why a cheap event-id "fast-path" is unsound.** All three graph writers (live stream `stream/wot/`, `batch/`, reconciliation) set `kind3EventId` via the *same* `apocCypherCommand2` — but **separately from, and additively to, the edge edits** (`create_wot`/`delete_wot` MERGE adds; the stream's delete computation is the lossy real-time path that *creates* drift). So an author can carry the **correct latest `kind3EventId` yet have stale edges** (a dropped follow the stream never removed). "id matches ⟹ edges correct" is false for exactly the delete case reconciliation exists to catch. This confirms ADR 0018's deferred-fast-path caution: **full consistency must re-derive edges, not trust bookkeeping.**

**Concept-graph orientation** (staging `/api/concept-graph/`, TA `8e9013…5fb1`): `nostr-user` (`NostrUser`, `nodeLabelRequired`), `web-of-trust` (*"users you follow are implicitly trusted, and their follows extend trust transitively … GrapeRank determines which concept definitions achieve loose consensus"*), `graperank` (the trust scorer). Per BIBLE.md:1436, a **"verified"** user is one whose GrapeRank `influence ≥ VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` (`/etc/graperank.conf`, default `0.05`). **Key implication:** an untrusted account's follow list is inert to the WoT — reconciling it is wasted work. The trusted set is what correctness actually depends on.

Story #23 constraints: three independent, guarantee-specific tasks; `reconcileAll` < 1h within bounded memory; `reconcileRecent` a bounded, overridable recency window (default ~1–6h), built first; legacy mode-less task deprecated; the extract-diff-apply model explicitly re-openable.

## Options considered

### Option A — Event-id drift selection
Compare each author's Neo4j `kind3EventId` against strfry's latest kind-3 id; reconcile only mismatches. **Rejected:** unsound (above) — the stream sets the id additively without computing deletes, so a matching id masks stale edges. Trades correctness for speed.

### Option B — One shared streamed merge-join engine
A single engine: stream both sides as sorted `(rater,ratee)` pairs, external-sort, merge-join → adds/deletes → apply; tasks differ only by an input filter. Correct and scalable. **Rejected** for two reasons surfaced in review: (1) one shared engine cuts against the operator's "stricter separation" intent; (2) `reconcileAll` would still process the *entire* 32M-edge graph including untrusted accounts whose edges don't affect the WoT.

### Option C — Three independent tasks, single WHERE-scoped streamed query (chosen)
Each task is its own implementation. The N+1 and the rater-enumeration both vanish because the Neo4j side is extracted by **one streamed Cypher query** whose `WHERE` clause *is* the task's guarantee:

| Task | Neo4j extraction (one streamed query) | Scope / guarantee |
|---|---|---|
| `reconcileAuthor` | `MATCH (u:NostrUser)-[:FOLLOWS]->(t) WHERE u.pubkey = $pk` | one author |
| `reconcileRecent` | `… WHERE u.pubkey IN $recentAuthors` | authors with events in a bounded, overridable window (default ~1–6h) |
| `reconcileAll` | `… WHERE u.influence >= $cutoff` | the **verified/trusted set** (`influence ≥ 0.05`) |

`RETURN u.pubkey, t.pubkey` with **no `DISTINCT`/`ORDER BY`/`collect`/`SKIP`/`LIMIT`** → no eager operator → the driver streams rows lazily under bounded transaction memory. Diff against the strfry side for the same scope; apply via the existing APOC commands.

**Pros:** kills both failure modes with one query; `reconcileAll` is bounded by the *trusted* set, not 32M edges → < 1h; each task independently tuned (honors "stricter separation"); reuses the proven APOC apply; the `reconcileAll` guarantee becomes WoT-meaningful rather than spending hours on inert accounts; `reconcileRecent` never promotes to a full pass (the bounded window) so the no-surprise-bootstrap hazard disappears; **separate scripts emitting under their own task names fix #22 OBS-1/OBS-2 as a side effect** (run history resolves per task; terminal events per task).

**Cons / tradeoffs:** (1) `reconcileAll`'s guarantee narrows from "every account" to "every *verified* account" — untrusted accounts' edges aren't swept (they're inert to the WoT and get swept the first `reconcileAll` after they cross the cutoff). (2) `influence` is likely unindexed → a 2.5M-node label scan with a property filter (acceptable streamed; add an index if measured slow). (3) stricter separation duplicates some orchestration across three scripts — mitigated by sharing only the invariant APOC `.cypher` apply files and a thin diff/apply helper.

## Decision

**Option C.** Retire `reconciliation.sh --mode` and the legacy `reconciliation` registry key. Build three independent task scripts, each extracting via one `WHERE`-scoped streamed query: `reconcileAuthor` (`pubkey = $pk`), `reconcileRecent` (`pubkey IN <recent>`, bounded overridable window), `reconcileAll` (`influence ≥ cutoff`, the verified set). Reuse the APOC apply unchanged.

**This refines story #23's `reconcileAll` acceptance criterion** (operator-ratified in the Architecture conversation): *"full consistency across the entire graph"* → *"full consistency across the verified/trusted set (`influence ≥ VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF`, default 0.05)."*

**Phasing** (one ADR, per-task build): **(1) `reconcileRecent`** — bounded window, the proving ground for the streamed-query → diff → apply chain; measure runtime. **(2) `reconcileAll`** — verified-scoped, validated against the < 1h budget using #1's learnings. **(3) `reconcileAuthor`** extracted/retained; **legacy removed**.

We trade the literal "every account" sweep (Option B) for a WoT-meaningful, bounded one, and accept three lightly-duplicated scripts in exchange for the independence the operator asked for and a per-task cost profile that fits each guarantee.

## Consequences

**Enabled**
- `reconcileAll` completes < 1h within bounded memory; `reconcileRecent` bounded and bootstrap-free; #21/#22 unblock once validated.
- The no-surprise-bootstrap problem (story #22 AC-10 / OPERATIONS §13.4 runbook) **dissolves** — `reconcileRecent` can't degrade into a full pass.
- #22 **OBS-1** (phantom "running") and **OBS-2** (reconcile last-run blank) are fixed here: each task is its own identity, emitting `TASK_START`/`TASK_END`/`TASK_ERROR` under its own `taskName`.

**Constrained / made harder**
- `reconcileAll` no longer sweeps untrusted accounts (documented; WoT-justified). A user crossing the cutoff is reconciled on the next `reconcileAll`.
- `influence` must be queryable at scale; may warrant a `NostrUser(influence)` index (measure).

**Follow-up debt**
- Optional `NostrUser(influence)` range index. Deprecated `src/pipeline/reconcile/` cleanup. Hardening the live stream. `reconcileAuthor` trigger surfaces (still a separate UI/API story).

**Firmware reinstall required?** No — operational/ETL only; no concept definitions changed.

## Implementation notes

- **Replace `reconciliation.sh --mode`** with three scripts under `src/pipeline/reconciliation/` (e.g. `reconcileRecent.sh`, `reconcileAll.sh`, `reconcileAuthor.sh`), each: scope its strfry dump, run its single `WHERE`-scoped extraction, diff, apply, (recent/all) advance the watermark, emit per-task structured events.
- **Extraction:** one streamed Cypher per task as tabled above; **delete** `getRaters()`/`getRaterCount()`/`getFollowsForRater()` and the per-batch enumeration in `getCurrentFollowsFromNeo4j.js` (+ mutes/reports siblings). Consume the result as a stream (reactive/`fetchSize`), writing `(rater,ratee)` JSONL to disk — never materialize the full set in RAM, never use eager `DISTINCT/ORDER BY/collect`.
- **`reconcileRecent`:** new `RECONCILE_RECENT_MAX_RECENCY_SECONDS` (default `21600` = 6h), overridable per-invocation; lookback = `min(now − watermark, max_recency)`; build the recent-author pubkey list from the strfry `--recent` dump; **no** promotion to full on a missing watermark (use the default window, set the watermark).
- **`reconcileAll`:** read `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` from `/etc/graperank.conf` (default `0.05`); the verified-set diff — sorted merge-join if large, in-memory if small (size it during the `reconcileRecent` phase).
- **Diff:** reuse `calculate<Kind>Updates.js` set-diff logic fed by the single-query output; **Apply:** reuse `apocCypherCommand1_*ToAdd/Delete` + `command2` unchanged.
- **mutes/reports:** same per-task pattern; small scale (~191k/168k) — not at problematic scale, but fix consistently.
- **Registry:** point `reconcileRecent`/`reconcileAll`/`reconcileAuthor` at the new scripts; **remove** the `reconciliation` key; keep `neo4j-heavy` on recent/all, not on author.
- **OPERATIONS.md:** rewrite the reconciliation section for the three independent tasks + scopes/guarantees, the recency cap, the verified cutoff, the deprecation; remove the obsolete seed-first runbook.
- **Failure events (OBS-1):** each task emits `TASK_END`/`TASK_ERROR` on every exit path so a crash never reads as "running."

## Out of scope

- The #22 scheduler (delivered). Turning prod schedules on (operator).
- `reconcileAuthor` trigger surfaces (UI/API) — separate story.
- Replacing strfry/Neo4j or the data model; the APOC apply and converters are reused unchanged.
- Deleting deprecated `src/pipeline/reconcile/` (safe cleanup, tracked separately).
