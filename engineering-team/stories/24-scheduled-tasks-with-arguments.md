# Story 24: Per-task arguments in the Scheduled Tasks panel

> **Renumbered from #17 → #24 at sync time (2026-05-23):** story #17 on `origin/staging` was already taken by `task-queue-on-by-default`; #24 is the next free slot. The companion ADR was renumbered 0015 → 0021 for the same reason. Review verdict on the original story #17 / ADR 0015 was **CHANGES_REQUESTED** — see the linked review for the asks against the Architect (the in-process scheduler this ADR builds on was superseded by ADR 0019's BullMQ Job Schedulers between the time this work was drafted on a stale branch and the time the Reviewer caught it).

**Status:** Approved (needs ADR amendment per review)
**Created:** 2026-05-23
**Type:** Feature

## Background

The Tapestry Scheduled Tasks panel (Home > Settings > Relays > Scheduled Tasks tab, built in story #4) lets an operator toggle a task on/off and set a recurring cadence (every N hours/days). It does **not** let the operator enter any **arguments** for the scheduled task. Today's panel has exactly two entries (`updateAllScoresForOwner` and `refreshSearchIndex`), both of which happen to take no arguments, so this gap hasn't surfaced.

The gap is real for any task that *requires* arguments. The most common case is the family of customer-scoped tasks — `processCustomer`, `calculateCustomerGrapeRank`, `loadCustomerScoresIntoMeilisearch`, etc. — which require a `customer` pubkey to do anything meaningful. There are ~14 such tasks in `src/manage/taskQueue/taskRegistry.json` today. There are also a handful of non-customer parameterized tasks (`processAllTasks` with `warmStart`, `exportOwnerKind30382` with `limit`, etc.). Roughly 18 tasks in the registry have non-empty `arguments` blocks; none of them can be meaningfully scheduled today.

The argument metadata is **not missing** from the system — `taskRegistry.json` already declares each task's argument shape (e.g., `processCustomer.arguments.customer: true`, `processCustomer.arguments.warmStart: { type: "boolean", … }`). The legacy Task Explorer page (`/legacy/task-explorer.html`) already reads this metadata to prompt the operator for arguments on a one-shot run — so a customer-aware run modal already exists in the codebase. What's missing is (a) any UI in the Scheduled Tasks panel to enter those arguments, and (b) any field in the scheduled-tasks backend config to *store* them, so that when the timer fires the task receives them.

A second, related gap: the scheduled-tasks config today is keyed **per-task** — one entry per task ID. That data shape collapses the natural operator use case for parameterized tasks. An operator with multiple customers will routinely want to schedule `processCustomer` for *each* customer, each on its own cadence (e.g., a high-value customer refreshes every 6h while a low-priority one refreshes every 24h). With one-entry-per-task, the operator cannot express that. This story therefore changes the data model from "one entry per task" to "any number of entries per task, each with its own arguments and cadence."

This story closes both gaps in one cohesive feature. A separate, later story will add scheduling support to the legacy Task Explorer / Bull Board surface; that work is **out of scope here.**

## User-facing description

**As an operator** of a Brainstorm node, **I want** to schedule any task that takes arguments — including running `processCustomer` for one or more specific customers on independent cadences — directly from the Scheduled Tasks panel, **so that** I don't have to manually trigger per-customer (or otherwise arg-driven) tasks each time, and so that I can keep multiple customers fresh on schedules tuned to each customer's needs without operator ceremony.

## Acceptance criteria

- [ ] **Every parameterized task is schedulable.** The Scheduled Tasks panel offers, as an addable scheduled entry, every task in `taskRegistry.json` whose `arguments` block is a non-empty object. Today: ~18 tasks, including all 14 `customer: true` tasks, `processAllTasks` (warmStart), `processAllActiveCustomers`, `exportOwnerKind30382` (limit), and the others identified at planning. Tasks with `arguments: false` or `arguments: {}` continue to behave as they do today.
- [ ] **Registry is the single source of truth for the argument form.** When the operator adds a scheduled entry for a task that has arguments, the panel renders a form whose fields are derived from the registry's declared shape — `customer: true` → customer picker; `warmStart: { type: "boolean", label, default }` → labeled checkbox with the default pre-selected; `limit: "optional"` → optional number field. Adding a new argument to a task's registry block makes it appear in the panel's form on the next deploy with no panel-side code change.
- [ ] **Argument-form parity with the legacy Task Explorer.** For any given task, the form fields shown by the Scheduled Tasks panel are functionally equivalent to the prompts shown by the legacy Task Explorer for the same task (same customer picker behavior, same warmStart toggle semantics, same limit field) — an operator who has used the legacy explorer for that task recognizes the form.
- [ ] **Multiple scheduled entries per task.** The operator can create N independent scheduled entries for the same task. Worked example: one entry "processCustomer — Alice every 6h", a second entry "processCustomer — Bob every 24h", a third entry "processCustomer — Carol disabled, every 12h saved-but-paused". Each entry has its own enable/disable toggle, its own schedule, and its own argument set.
- [ ] **Each entry has a recognizable label that exposes its arguments.** The listing distinguishes entries that share a task ID — the operator sees "Process Customer — Alice" and "Process Customer — Bob" (or an equivalent disambiguating label), not two indistinguishable "Process Customer" rows. The label is informative enough to identify which entry to edit/delete.
- [ ] **Required arguments block save.** An entry whose required arguments are unset cannot be saved (or, if saving partial drafts is allowed, cannot be set to enabled). The form blocks the action with the offending field highlighted and a clear error message naming the missing argument (e.g., "Customer is required for processCustomer"). The operator never reaches a state where an enabled entry is missing a required argument.
- [ ] **The fired task receives its configured arguments.** When a scheduled entry fires, the task runs with its configured arguments — the resulting execution is observably equivalent (same script invocation, same effects) to what would happen if the operator had triggered the same task from the legacy Task Explorer with the same arguments. Logs and run-history show the arguments that were used.
- [ ] **Optional arguments respect their declared defaults.** Optional arguments left unset by the operator use the task's registry-declared default value (or are omitted when no default is declared), matching the legacy Task Explorer's behavior for that same task.
- [ ] **Customer picker shares the legacy explorer's source.** The customer picker offered by the new form uses the same set of customers (and the same search behavior) as the legacy Task Explorer's customer modal. The operator does not need a separate customer-management UI for scheduled entries.
- [ ] **Deleted-customer warning.** If a customer referenced by a scheduled entry is later deleted, the entry is visibly flagged in the listing with a clear warning (e.g., "Customer no longer exists"). The exact runtime behavior of a flagged entry (auto-pause vs. fire-and-fail) is an open question for Architect/Tester; whichever path is chosen, the operator sees the problem in the panel rather than only in logs.
- [ ] **Existing entries survive the upgrade.** The two scheduled entries that exist on staging/prod today (`updateAllScoresForOwner` and `refreshSearchIndex`) — both no-arg — continue to work unchanged after the upgrade: same enabled state, same schedules, same run history. No operator action is required on existing deployments for the existing entries to keep running. (Operators wanting to add *new* arg-driven entries opt in by creating them in the panel.)
- [ ] **Persistence across restarts.** The full configuration of every scheduled entry — task ID, arguments, schedule, enabled state, and any human-readable label — persists across container restarts.
- [ ] **Per-entry last-run / next-run visibility.** The panel surfaces last-run and next-run timestamps for each entry independently (so the two `processCustomer` entries above show separate last-run times). Matches the visibility pattern story #4 established for the existing entries.

## Concepts touched

The PO oriented via `GET http://localhost:7778/api/concept-graph/summaries` (34 concepts). Most subsystems this story touches — Scheduled Tasks, Task Registry, Task Explorer, "customer-as-an-operator-concept" — are not currently formal nodes in the concept graph. They're named in plain language below. The Architect should re-check at orientation time in case the graph has gained new nodes between planning and architecture.

- **Scheduled Tasks subsystem** (existing — added by story #4; backed by `src/api/scheduled-tasks/`). Not a formal concept-graph node.
- **Task Registry** (`src/manage/taskQueue/taskRegistry.json`) — the manifest of tasks and their argument schemas. Source of truth for the argument-form metadata. Not a formal concept-graph node.
- **Legacy Task Explorer** (`public/pages/manage/task-explorer.html`) — the existing surface that already reads the registry and renders argument prompts. Reference point, not the target of changes in this story. Not a formal concept-graph node.
- **Customer pubkey** — the most common argument across the 14 customer-scoped tasks. Closest formal concept: `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` (a Nostr user identified by a public key). "Customer" is a Tapestry-implementation specialization that isn't graphed today.
- **Task argument shape** — the `arguments` block in each registry entry. Today's observed shapes: `customer: true`, `warmStart: { type: "boolean", … }`, `limit: "optional"`. Not a formal concept-graph node.
- **GrapeRank** — `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:graperank`. Directly relevant: several of the parameterized customer-scoped tasks compute GrapeRank scores (`calculateCustomerGrapeRank`, `updateAllScoresForSingleCustomer`, `processCustomer` which chains into them). Per-customer scheduling of these tasks is one of the primary operator motivations for this story.
- **Web of Trust** — `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:web-of-trust`. Broader context: the customer-scoped tasks are largely WoT maintenance (GrapeRank, follower/muter/reporter counts, hops). Keeping these fresh per-customer on independent cadences is the operator value this story unlocks.

## Out of scope

- **Adding scheduling support to the legacy Task Explorer (Bull Board path).** The operator explicitly sequenced this as Phase 2, a separate story to be planned after this one ships to staging and is verified.
- **Cron-style scheduling expressions.** The existing panel uses days/hours intervals; this story keeps that pattern. Cron syntax can be a future story if operator need surfaces.
- **Per-entry priority, dependencies, chaining, or run-on-startup.** Each entry is independent; the existing scheduler semantics carry forward.
- **A "schedule this task for ALL customers" bulk-create UI.** If the operator wants that, they create N entries one at a time. A future story can revisit bulk creation if it becomes painful.
- **Notifications/alerts** (email, Slack, Nostr DM) on entry failure. The existing run-history surface remains the only feedback channel.
- **Argument types not yet present in the registry** (enums, datetimes, multi-select, file-upload). Today's registry has booleans, customer-pubkey strings, and one optional number. New arg types added to the registry later get rendered as a basic text input until a follow-up story adds a typed renderer; the Architect notes this in the ADR.
- **Customer-management workflows** — creating, editing, or deleting customers. The form *consumes* the existing customer list; it does not modify it.
- **Argument-form refactor of the legacy Task Explorer** to share code with the new panel. The two surfaces may converge later; this story does not require it. The Architect may choose to share an implementation if it's clearly cheaper, but the AC bar is functional parity, not shared code.
- **Reconciliation of the scheduled-tasks panel with the legacy Task Explorer's run-history view.** The two surfaces continue to maintain their own histories.

## Open questions

**Deferred to Architect:**

- **Data-model migration.** Today the scheduled-tasks config keys entries by `taskId` (one entry per task). Supporting multiple entries per task requires a new key shape (e.g., per-entry UUID). The Architect picks the on-disk schema and the migration path that lets the two existing prod entries (`updateAllScoresForOwner`, `refreshSearchIndex`) survive the upgrade without operator action. ADR should call out whether old configs are auto-migrated on read, rewritten on first save, or both.
- **Runtime behavior of a "deleted customer" entry.** Spec requires that the panel visibly flag entries referencing a deleted customer. Architect/Tester decide: does the entry auto-disable (failsafe — won't fire), or does it stay enabled and surface a per-fire failure (loud — operator sees errors in run history)? Either is acceptable to the operator; whichever choice is made, the test plan asserts it.
- **Server-side re-validation at fire time.** If a registry change makes an argument newly required *after* an entry was saved (e.g., a task gained a new required field in a later release), should the runner re-validate at fire time? Architect's call; either "yes, fail loudly and surface in run history" or "no, trust the saved config" is acceptable as long as it's chosen explicitly and tested.
- **Entry label format and editability.** The AC requires entries to display a recognizable disambiguating label. Concrete format (e.g., `"Process Customer — Alice"` vs. `"Process Customer (npub1abc…xyz)"` vs. operator-editable nickname) is a UX detail for the Architect to pick and the Tester to validate. The operator confirms the choice at the test-design gate.
- **Default argument shape on first add.** When the operator adds a new entry, does the form pre-fill optional defaults from the registry, or start empty? Architect's call; consistency with the legacy Task Explorer's behavior is the tiebreaker.

**Resolved at planning (2026-05-23):**

- **Task scope** → **all parameterized tasks** (all ~18 with non-empty `arguments`), not just `processCustomer`. The plumbing is the same and a piecewise rollout would just re-do it. Registry-driven form-rendering is the natural seam.
- **Multi-instance per task** → **yes**. Per-customer scheduling is a primary use case; one entry per task collapses it.
- **Missing-required-args UX** → **refuse to save / enable**. Form-level validation; no silent or runtime-only failures for missing required args.
- **Phase 2 sequencing** → legacy Task Explorer scheduling + Bull Board is **a separate, later story** to be planned after this one ships to staging.

## Linked artifacts

- ADR: [engineering-team/decisions/0021-scheduled-tasks-with-arguments.md](../decisions/0021-scheduled-tasks-with-arguments.md) — renumbered from 0015 at sync time; **needs Architect amendment** to reconcile with `origin/staging`'s ADR 0019 (BullMQ Job Schedulers).
- Test plan: [engineering-team/stories/24-scheduled-tasks-with-arguments.test-plan.md](24-scheduled-tasks-with-arguments.test-plan.md)
- Review: [engineering-team/reviews/24-scheduled-tasks-with-arguments.md](../reviews/24-scheduled-tasks-with-arguments.md) — **CHANGES_REQUESTED** (architecture conflict with shipped ADR 0019).
