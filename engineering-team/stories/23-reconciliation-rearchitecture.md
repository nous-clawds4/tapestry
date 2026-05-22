# Story 23: Reconciliation re-architecture — independent, guarantee-specific tasks

**Status:** Approved
**Created:** 2026-05-22
**Type:** Refactor (re-architecture), driven by a prod-blocking Bug in `reconcileAll`. All phases apply (behavior changes; the model is re-opened).

## Background

Story #21 / ADR 0018 delivered reconciliation as **one** script (`reconciliation.sh`) parametrized by `--mode recent|all|author`, all sharing a single extract-current-state-from-Neo4j → diff-against-strfry → apply pipeline.

Staging — which is **prod-scale** (~2.5M `NostrUser`, ~300k with `FOLLOWS`, ~32M `FOLLOWS`) — proved the shared model doesn't hold:
- **`reconcileAll`** ran ~6h, died ~62% through the follows phase against Neo4j's transaction-memory ceiling, and never wrote a watermark (review #22 staging addendum).
- **`reconcileRecent`** is implemented but untested, and suspected unacceptably slow at scale.
- **`reconcileAuthor`** works.

The realization: the three modes encode **three genuinely different consistency guarantees**, but are forced through **one implementation** that was not built for prod scale. The operator's decision (2026-05-22): stop treating reconciliation as one parametrized task — treat it as **three independent tasks, each implemented and tuned for its own guarantee** — and deprecate the legacy mode-less `reconciliation` task. The full-state-extraction **model is open to redesign** (broadest scope).

This work is the **gate for #21 and #22's production promotion**; both remain blocked until reconciliation is viable at scale.

**Operator decisions captured at Planning (2026-05-22):**
- **Four independent tasks, four guarantees.** Reconciliation is not one parametrized task. `reconcileAuthor` = single-author (works); `reconcileRecent` = recent-window (exists, untested, suspected slow); `reconcileNetwork` = a configurable trusted network (`influence ≥ 0.05`, or `hops < N`, extensible); `reconcileAll` = truly all (breaks today, made feasible here). Each is rebuilt independently because each guarantees something different.
- **Deprecate the legacy `reconciliation` task** (the mode-less shared entry).
- **Broadest scope — the model is on the table.** Whether to keep extracting full current state from Neo4j and diffing against strfry is itself open for redesign.
- **`reconcileRecent` has a bounded recency window.** It reconciles within an **overridable maximum lookback** (default on the order of 1–6 hours), not an unbounded since-watermark window — so its cost is predictable and it can never accidentally degrade into a full pass. Drift *older* than the window is `reconcileAll`'s domain (or an explicit override).
- **Budget split.** `reconcileNetwork` (the routine scheduled sweep) must be comfortably **< 1h** at prod scale; `reconcileAll` (truly all, the infrequent complete oracle / incident-recovery) must **complete within bounded memory** — < 1h is a target, not a gate.
- **Single story, Architect phases it — `reconcileRecent` first.** One ADR (model + the four tasks), then per-task implementation in this order: **(1) `reconcileRecent`** (bounded proving ground), **(2) `reconcileNetwork`** (parameterized predicate, the routine sweep), **(3) `reconcileAll`** (truly all, bounded-memory completion), **(4) `reconcileAuthor`** extracted + legacy removed.
- **#21 and #22 stay blocked from prod** until this lands.

## User-facing description

**As the operator,** I want reconciliation expressed as **independent tasks, each delivering a clearly-defined consistency guarantee that holds at production scale within bounded time and memory**, **so that** each can run on its own cadence without inheriting the others' cost — and so the full-graph case stops being an unbounded multi-hour memory bomb that can't even seed a baseline.

## Acceptance criteria

- [ ] **`reconcileAuthor` — single-author consistency.** Given one author, its relationships in Neo4j are made to match strfry; completes in seconds; **no regression** from today's working behavior.
- [ ] **`reconcileRecent` — recent-window consistency.** Reconciles relationships changed within a **bounded recency window** — an **overridable maximum lookback** with a sensible default (on the order of 1–6 hours) so its cost is predictable and it can never degrade into a full pass — completing **well within its intended cadence** (story #21 envisioned ~every 10 minutes) so successive fires don't overlap. Validated by measurement at prod scale; rebuilt if it overflows that budget.
- [ ] **The recency window is overridable.** Given an explicit recency override on a `reconcileRecent` invocation, the lookback uses that value instead of the default.
- [ ] **`reconcileNetwork` — consistency across a configurable trusted network.** Reconciles every user matching a **parameterized** network predicate (e.g. GrapeRank `influence ≥ VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF`, default 0.05; or `hops < N`; selectable and extensible), completing **comfortably under ~1 hour** at prod scale. The routine bounded sweep.
- [ ] **`reconcileAll` — full consistency across the entire graph (truly all).** Establishes Neo4j↔strfry consistency for **every** rater (~32M edges) **to completion within bounded memory** (no transaction-memory ceiling breach), persisting its baseline. The infrequent complete oracle / incident-recovery sweep; <1h is a target, not a gate.
- [ ] **The four tasks are independent.** Each has its own documented guarantee and implementation; the cost or failure of one does not entangle the others (notably, `reconcileRecent`/`reconcileNetwork` must not inherit `reconcileAll`'s full-graph cost).
- [ ] **The legacy mode-less `reconciliation` task is deprecated/removed** once the three independent tasks exist — no shared `--mode` entry remains as the supported path.
- [ ] **`OPERATIONS.md` updated:** the three tasks, their guarantees, expected runtimes, the seeding/baseline model, and the deprecation.

## Concepts touched

Operational/infra (Architect resolves any handles via the Concept Graph API; #21/#22 found none in the domain graph):
- Reconciliation tasks: `reconcileAuthor` / `reconcileRecent` / `reconcileAll`
- The WoT graph — `NostrUser` nodes; `FOLLOWS` (and mutes/reports) relationships; strfry as source of truth; Neo4j as the graph store
- Task registry + task queue (#13/#15) and the durable scheduler (#22) — downstream consumers

## Out of scope

- The scheduler mechanism itself (#22, delivered) — this story changes *what* is scheduled, not *how*.
- Turning reconciliation schedules **on in prod** — operator action, gated by the prod-promotion decision.
- The #22 panel-observability gaps (OBS-1 phantom "running"; OBS-2 reconcile last-run blank) — tracked against #22, unless the Architect chooses to fold the terminal-event-on-failure fix in here.
- `reconcileAuthor` trigger surfaces (profile button / API) — still the separate follow-up from #22.

## Open questions

To resolve at the Architecture gate (Architect proposes; operator ratifies):
1. **The model (broadest-scope rethink):** should reconciliation keep extracting full current state from Neo4j and diffing against strfry, or establish/maintain consistency another way (e.g., derive from the primary ingest path)? This is the central Architecture decision and likely the only way to hit the <1h `reconcileAll` budget.
2. **Seeding/baseline + the coverage gap:** given full-pass fragility, how is the initial watermark/baseline established? And since `reconcileRecent` now only covers a bounded window, what covers drift *older* than that window (periodic `reconcileAll`? an override? something else)? Does #22's "seed via `reconcileAll` first" runbook (AC-10) change? These three are linked.
3. **Legacy timer:** does deprecating the host `reconcile.timer` + legacy `reconciliation` registry key (deferred in #22) land here or stay a follow-up?

_Resolved at Planning:_ structure (single story, Architect phases per task, **`reconcileRecent` first then `reconcileAll`**); `reconcileAll` budget (<~1h); `reconcileRecent` = **bounded, overridable recency window (default ~1–6h)**, completing well within its ~10-min cadence (measured).

_Resolved by ADR 0020:_ **Q1 model** = **four** independent task scripts, each a single `WHERE`-scoped streamed query (extract-diff-apply retained but de-N+1'd); the verified/trusted scope becomes the new `reconcileNetwork` task, `reconcileAll` stays truly-all. **Q2 seeding** dissolves — bounded `reconcileRecent` never bootstraps; older-than-window drift is covered by the periodic `reconcileNetwork`/`reconcileAll`. **Q3** — the legacy `reconciliation` registry key is removed here; the host `reconcile.timer` deprecation stays a follow-up.

## Linked artifacts

- Driven by: review #22 staging addendum; ADR 0018 (reconciliation — superseded in part); story #21; story #22 (blocked on this).
- ADR: [0020-reconciliation-rearchitecture.md](../decisions/0020-reconciliation-rearchitecture.md) — **Accepted** (2026-05-22): four independent tasks (author / recent / network / all); single `WHERE`-scoped streamed query per task; `reconcileNetwork` = configurable trusted network, `reconcileAll` = truly all; fixes #22 OBS-1/OBS-2 as a side effect.
- Test plan / Review: (filled in later phases)
