# ADR 0003: Scheduled Tasks panel aggregate countdown — endpoint-sourced line with a local tick

**Status:** Proposed
**Date:** 2026-07-18
**Story:** `engineering-team/stories/deploy-safety-gate/3-scheduled-tasks-panel-countdown.md`

## Context

The epic's machine side is done: `GET /api/deploy-safety/status` (story #1 / ADR 0001) and the cycle-skill safe-to-merge check (story #2 / ADR 0002). Story #3 is the human side — one aggregate line on the settings Scheduled Tasks panel. Its acceptance criteria, quoted for the record:

- **AC-1 (the aggregate line, in the operator's phrasing):** "Given the settings page's Scheduled Tasks panel is open and at least one enabled scheduled entry has an upcoming fire, when the panel renders, then exactly one aggregate line appears alongside the existing per-entry rows — which remain present and unchanged — communicating, in the operator's requested form 'Next Scheduled Task, \<name of task\>, starts in __ hours and __ minutes': the name of a scheduled task and the time remaining until it fires, at hours-and-minutes granularity."
- **AC-2 (soonest fire among all enabled entries — and only enabled entries):** "…the task it names is the one with the soonest upcoming fire among the **enabled** entries… A disabled entry never appears as the next scheduled task… when the enabled set or its ordering changes (an entry is toggled, or the current soonest fire passes), the line comes to reflect the new soonest…"
- **AC-3 (it visibly counts down):** "…the displayed time remaining decreases observably — the operator can watch the countdown tick down without reloading the page — and the display is never frozen at a stale value and never counts into negative time; once the displayed fire time is reached, the line moves on to the then-current state…"
- **AC-4 (sensible empty states — nothing-scheduled and queue-disabled, not conflated):** "…the aggregate line states plainly that no scheduled task is upcoming — never a blank, a stale task name, or a nonsense countdown. Given instead the instance's task-queue layer is disabled, then the panel states that in plain language, distinguishably from 'nothing scheduled'…"
- **AC-5 (never contradicts the deploy-safety answer):** "…the aggregate line names the same task and shows a time remaining consistent with the same fire time — any difference explained by hours-and-minutes rounding and the moments elapsed between the two observations… the empty states of AC-4 mirror the answer's own queue-disabled / nothing-scheduled distinction."

The story delegates four things to this ADR: refresh/tick mechanics, edge-case copy, placement, and the AC-5 consistency mechanism.

### Concept Graph orientation

`GET http://localhost:7778/api/concept-graph/summaries` (46 concepts, checked 2026-07-18): no handle covers scheduled tasks, task queues, settings surfaces, or instance operations — confirming the story's "Concepts touched: None." No `/neighbors` or `/node` calls warranted. **No concept definitions change in this ADR.** Origin-drift preflight: 0 behind `origin/staging`.

### Verified facts (panel + endpoint re-checked against source)

- **The panel.** `ScheduledTasksPanel` (`ui/src/pages/settings/RelaySettings.jsx:1795-1958`) fetches `GET /api/scheduled-tasks/list` **once on mount** (`fetchList`, `:1801-1810`, re-run after modal saves `:1953` and deletes `:1899`) and renders one `ScheduledEntryCard` per entry. The aggregate line's natural insertion point is between the hint paragraph (`:1920-1923`) and the "+ Add Scheduled Entry" button block (`:1925-1930`).
- **Per-entry toggles bypass the parent.** `ScheduledEntryCard.handleSave` (`:1560-1588`) POSTs `/api/scheduled-tasks/update` and updates only the card's local `timer` state — the parent's `entries` (including `entry.enabled`) go stale after a toggle and are never refreshed. Any parent-event-only refresh strategy would miss the AC-2 toggle case.
- **The endpoint's payload is designed for this line.** ADR 0001's Consequences: story 3's aggregate line "is exactly `schedule.nextFire`." As built (`src/api/deploy-safety/index.js:180-190`): `schedule.nextFire` = `{ entryId, taskId, label, at, inMs, withinBuffer }` or `null`; selection is min-`at` over **enabled** entries inside the same `computeVerdict()` the merge gate consumes (`:57-65`); `queue.enabled: false` vs `queue: { enabled: true, stateKnown: false }` vs `nextFire: null` gives the AC-4/AC-5 state distinctions ready-made. `label` is `entry.label || entry.taskId` (`:145`).
- **`/list` cannot make the AC-4 distinction.** `handleList` (`src/api/scheduled-tasks/index.js:290-308`) returns per-entry `timer.nextRunAt` via `nextRunSafe` (`:219-222`), which swallows every failure to `null` — queue disabled, Redis down, and genuinely-nothing-scheduled all render identically as `timer.active: false`. It also reads run history per entry (`getRecentRuns`, events.jsonl) on every call, so it is the *heavier* thing to poll.
- **In-file polling precedent.** `StreamingETLPanel` polls its status every 10 s with `setInterval` + cleanup on unmount (`RelaySettings.jsx:1356-1361`). Panels unmount on tab switch (`:2015-2017`), so polling stops when the operator navigates away.
- **Pure-helper test precedent.** Node's test harness can't parse JSX; pure UI logic goes in a plain `.js` util under `ui/src/utils/` and is dynamic-imported by the unit suite — `test/pov-notice-text.test.js` → `ui/src/utils/povNoticeText.js` is the named precedent. Structural sentinels on JSX files follow `test/admin-tools-dashboard-panel.test.js`. Unit suites register explicitly in `test/test.js` (runner is `npm test`).
- **Display titles.** The per-entry rows don't show raw `entry.label` — they show `computeDisplayTitle(entry)` (`RelaySettings.jsx:1847-1858`: legacy overrides, operator labels, live customer-name suffixes). A line that printed the endpoint's bare `label` next to a row titled "processCustomer — Alice" would name the same task two ways inside one panel.

### Constraints

- Ratified product decisions (story §Product decisions): operator's phrasing; all-enabled-entries selection; queue-disabled ≠ nothing-scheduled. Not relitigated here.
- No new backend (story scope note — and none is needed; verified above).
- No new dependencies, no new lint/build tooling (house rules). Plain React JS, no TS.
- No TA-pubkey surface anywhere in this story (no author filters, handles, or signing).
- Adjacent ADRs checked for conflict: **deploy-safety-gate 0001** (payload contract — this ADR makes the panel its second consumer, changing nothing); **deploy-safety-gate 0002** (the check script branches only on `safeToDeploy` — the panel reads `schedule`/`queue`, no overlap); **task-queue-scheduler 0021** (the panel's per-entry design — untouched; the line is additive and the only card change is an optional callback prop). No supersessions.
- Staging evidence constraint (frame bullet 6b): the deployed settings page sits behind NIP-07 owner sign-in; rendered-panel evidence is gathered on the local stack.

### POV note (reflex check answered explicitly)

Like ADR 0001, this surface is deliberately **not POV-scoped**: "which task fires next on this instance" is an objective operational fact about the deployment, identical for every viewer. No WoT signal applies; adding one would be cargo-culting.

## Options considered

### Option A — Endpoint-sourced line: poll `/api/deploy-safety/status`, tick locally off `nextFire.at` (chosen)

A new isolated component, `NextScheduledTaskLine`, rendered by `ScheduledTasksPanel` between the hint and the Add button. It fetches `GET /api/deploy-safety/status` (no `bufferMinutes` param) and derives its display state from `queue.enabled` / `queue.stateKnown` / `schedule.nextFire`. The countdown ticks **client-side** every 1 s off the cached absolute `nextFire.at`; re-fetches happen on a 10 s poll (the in-file precedent), on parent schedule-mutation events, and once when the countdown crosses zero. Pure formatting/state helpers live in `ui/src/utils/nextTaskCountdown.js`. The task name is enriched to the panel's own `computeDisplayTitle` keyed by `nextFire.entryId` (fallback: the endpoint's `label`), so the line and the row beneath it name the task identically while the *identity* remains the endpoint's.

Pros: AC-5 is **structural** — the line's task identity and fire time are the very `schedule.nextFire` the merge gate's verdict is computed from; no second implementation of "soonest among enabled" exists to drift. AC-4's three-way distinction (`queue disabled` / `state unknown` / `nothing upcoming`) is read off fields that already exist; `/list` provably cannot supply it. The polled endpoint is cheap (Redis reads; no events.jsonl). Ticking off an absolute timestamp means the countdown stays accurate between polls and never freezes. Cons: one more HTTP round-trip per 10 s while the tab is open (bounded: component unmounts on tab switch); the panel now depends on ADR 0001's payload shape (accepted — that contract is already consumed by story #2's ops tooling and was designed for this line).

### Option B — Client-side min over the `/list` data the panel already fetches

Compute `min(timer.nextRunAt)` over `entries.filter(e => e.enabled)` in `ScheduledTasksPanel`; no second fetch.

Pros: zero new requests on mount; data already in hand. Cons, decisive: (a) **AC-4 fails structurally** — `nextRunSafe` collapses queue-disabled, Redis-down, and nothing-scheduled into the same `nextRunAt: null`, so the line would tell the operator "nothing scheduled" when scheduling is simply switched off, the exact conflation AC-4 forbids; (b) **AC-5 becomes empirical, not structural** — a second, client-side re-implementation of the soonest-fire selection (enabled filter, null handling, label choice) that must be kept bit-compatible with `computeVerdict()` forever, with tests as the only guard against drift; (c) refreshing it means re-polling `/list`, which reads events.jsonl run history per entry on every call — the heavier poll. Rejected: saves one fetch at the cost of the two ACs the story exists for.

### Option C — Hybrid: endpoint for the empty-state distinction, `/list` min for the countdown

Pros: none over A. Cons: two clocks behind one line — the AC-4 states come from one source while the named task and time come from another, so the line can name a task the endpoint's answer would not (AC-5 violated in the seam). Rejected: worst of both.

### Sub-alternatives considered and rejected

- **Tick by re-fetching every second** instead of a local tick: hammers an endpoint that does per-queue Redis reads, for zero display gain at minutes granularity. Rejected.
- **Tick state in `ScheduledTasksPanel` itself** instead of an isolated component: a 1 s `setState` in the parent re-renders every `ScheduledEntryCard` each second. Rejected; the isolated component confines the tick re-render to one line.
- **Formatting/state helpers inline in `RelaySettings.jsx`**: unreachable by the node unit harness (can't parse JSX — the `povNoticeText` precedent names exactly this). Rejected; helpers go in a plain `.js` util.
- **Poll-only refresh (no mutation-event bumps):** satisfies AC-2's "comes to reflect" within ≤10 s, but leaves toggle reflection sluggish and makes the Playwright AC-2 test wait on the poll (flake surface). Rejected in favor of poll **plus** cheap event bumps; the poll remains the correctness backstop.
- **Print the endpoint's `label` verbatim** instead of the `computeDisplayTitle` enrichment: avoids one prop, but shows two names for one task inside one panel (line: "processCustomer"; row: "processCustomer — Alice"). Rejected; identity stays endpoint-owned (`entryId`), display matches the rows.

## Sub-decisions (delegated to this ADR by the story)

1. **Data source & naming:** `schedule.nextFire` from `GET /api/deploy-safety/status` is the sole source of *which* task is next and *when* it fires. Display name = `resolveTitle(nextFire.entryId, nextFire.label)`: the panel's `computeDisplayTitle` for the matching local entry, else the endpoint's `label` (entry not in the local list yet — list stale or mid-refresh). AC-5's "names the same task" is identity by `entryId`, carried through to the DOM as `data-entry-id` for the consistency test.
2. **Cadences:**
   - **Tick:** `setInterval` 1 s inside `NextScheduledTaskLine`, recomputing `remaining = Date.parse(nextFire.at) − Date.now()`. Display changes at most once a minute, but the 1 s tick guarantees the minute boundary lands within a second and costs one line's re-render.
   - **Poll:** re-fetch the status every **10 s** (the `StreamingETLPanel` precedent, `RelaySettings.jsx:1356-1361`), interval cleared on unmount. This is the correctness backstop for out-of-band changes (another session's edits, kill-switch flips, a fire passing).
   - **Event bumps:** the parent bumps a `scheduleVersion` counter whenever it refetches `/list` (mount, modal save, delete), and `ScheduledEntryCard` gains an optional `onScheduleChanged` prop (called on successful save/toggle) wired to the parent's `fetchList` — so toggles refresh both the parent's stale `entries` and, via the version bump, the line. The line re-fetches on `scheduleVersion` change.
   - **Zero-crossing:** when `remaining ≤ 0`, re-fetch immediately, at most once per distinct `at` value (loop guard); the 10 s poll bounds the rate if the endpoint keeps returning a past `at`.
3. **Formatting (pure, `formatTimeToFire(remainingMs)`):** total minutes `T = ceil(remainingMs / 60000)` — **ceiling** rounding, so the display never claims a fire is later than it is by more than the granularity, never shows "0 minutes" while time remains, and the "0 hours and 0 minutes" moment is unreachable. Decompose `T` into days/hours/minutes; render (singular/plural throughout):
   - ≥ 24 h: `starts in 2 days, 3 hours and 12 minutes`
   - 1–24 h: `starts in 1 hour and 5 minutes` (the operator's reference form)
   - < 1 h: `starts in 23 minutes` (natural adaptation per scope note; "0 hours and" dropped)
   - `remainingMs ≤ 0`: returns `null` — the component shows the transitional copy and re-fetches (AC-3's "moves on").
4. **Display states & reference copy** (state machine pinned by `deriveNextTaskLine(statusJson)`; exact wording Implementer-tunable within AC-1/AC-4 bounds, the four states are not):
   - `countdown`: `Next Scheduled Task, <name>, starts in <formatted>.`
   - `starting` (zero crossed, fresh data pending): `Next Scheduled Task, <name>, starting now…`
   - `none-upcoming` (`queue.enabled && queue.stateKnown && !schedule.nextFire`): `No scheduled task is upcoming — no enabled entry has a next fire.`
   - `queue-disabled` (`queue.enabled === false`): `Task scheduling is disabled on this instance — scheduled entries will not fire.`
   - `unknown` (fetch failed, `success !== true`, or `queue.stateKnown === false`): `Schedule status is currently unavailable.` — never "nothing scheduled" when the truth is unknown (AC-4's honesty requirement extended to the endpoint's own fail-closed state).
5. **AC-5 tolerance, concretely:** with no schedule mutation between the two observations, the line and the endpoint observed Δt apart must (a) carry the same `entryId`, and (b) differ in time remaining by ≤ **60 s (ceiling rounding) + Δt**. After a mutation or a fire passes, the line converges within one refresh (event bump: immediate; worst case one poll: ≤ 10 s). Empty states map 1:1 (`queue-disabled` ↔ `queue.enabled:false`; `none-upcoming` ↔ `nextFire:null`), so neither surface can claim "nothing scheduled" while the other names a task, beyond that same refresh window.
6. **Placement:** rendered by `ScheduledTasksPanel` directly after the hint paragraph (`RelaySettings.jsx:1923`) and before the Add-button block (`:1925`) — one line, visually distinct (slightly stronger than `settings-hint`), above the rows it summarizes, which remain untouched (AC-1).

## Decision

We chose **Option A** — an isolated `NextScheduledTaskLine` component sourced from `GET /api/deploy-safety/status`, ticking locally off `schedule.nextFire.at` every second, re-fetching on a 10 s poll plus schedule-mutation bumps plus zero-crossing, with pure formatting/state helpers in `ui/src/utils/nextTaskCountdown.js`. It is the only option under which AC-4's three-way distinction and AC-5's no-contradiction guarantee hold *structurally* — the panel and the merge gate literally read the same `nextFire` selection from the same `computeVerdict()` — and it polls the cheaper endpoint rather than the events.jsonl-reading `/list`.

## Consequences

- **Enables:** the operator's at-a-glance answer, completing the book's acceptance-frame bullet 5; the epic's three consumers (script, skill, panel) now all speak from one schedule source.
- **Constrains:** the panel becomes the **second consumer** of ADR 0001's payload contract — specifically `queue.enabled`, `queue.stateKnown`, and `schedule.nextFire.{entryId, label, at}`. Renaming those fields now breaks the UI as well as the ops tooling.
- **Documented inherited behaviors (accepted, consistent with the endpoint):** ADR 0019's scheduler kill-switch (`schedulerHalted`) yields no next fires, so the line reads "no scheduled task is upcoming" — accurate (nothing will fire) and exactly what the endpoint reports, but it does not say *why*; a halted-scheduler notice would be new scope (the story's out-of-scope verdict-surface line). Likewise the legacy per-customer timers are absent from the line by ratified scope — a legacy-only instance shows "none upcoming."
- **Side effect, intentional:** the `onScheduleChanged` → `fetchList` wiring fixes a pre-existing staleness — today the parent's `entries` (and its enabled/orphan cross-checks) go stale after a card toggle until remount. Additive prop, default no-op; the card's own UI is unchanged (ADR 0021 undisturbed).
- **New debt / follow-ups:**
  - Two fetch layers now know the schedule (per-entry `/list`, aggregate deploy-safety) with different refresh moments; between an out-of-band change and the next poll (≤ 10 s) the line and a card can briefly disagree with each other (never with the endpoint beyond §5's window). Accepted; noted for any future panel-wide state refactor.
  - If the deploy-safety endpoint is ever auth-gated or its payload versioned, `NextScheduledTaskLine` must move with it (grep-able comment at both ends).
- **Firmware reinstall required?** **No** — no concept definitions are added or changed (verified against the live Concept Graph, 46 concepts, none in this domain).
- **New dependencies:** none. **New lint/build tooling:** none.

## Implementation notes

- **File: `ui/src/utils/nextTaskCountdown.js` (new, plain ESM `.js` — no JSX, no React import**, so the node harness can `await import(pathToFileURL(...))` it, the `povNoticeText.js` precedent**):**
  - `formatTimeToFire(remainingMs)` → string per sub-decision 3, or `null` when `remainingMs ≤ 0`.
  - `deriveNextTaskLine(statusJson)` → `{ state: 'countdown'|'none-upcoming'|'queue-disabled'|'unknown', entryId?, taskId?, label?, at? }` per sub-decision 4's mapping (`countdown` carries the `nextFire` fields; malformed/absent payload → `unknown`).
- **File: `ui/src/pages/settings/RelaySettings.jsx`:**
  - New `function NextScheduledTaskLine({ resolveTitle, scheduleVersion })` declared above `ScheduledTasksPanel` (~`:1795`). State: `status` (last successful payload), `nowTick`. Effects: fetch on mount + on `scheduleVersion` change; `setInterval` 10 s poll and 1 s tick, both cleared on unmount (mirror `StreamingETLPanel`, `:1356-1361`); zero-crossing re-fetch guarded once per `at`. On fetch error keep the last payload (the tick keeps the countdown honest); if none exists, state `unknown`. Root element carries `data-testid="next-task-line"`, `data-state="<state>"`, and (countdown/starting) `data-entry-id="<entryId>"` — the Playwright seams.
  - `ScheduledTasksPanel`: add `scheduleVersion` state, incremented in `fetchList` on success; render `<NextScheduledTaskLine resolveTitle={...} scheduleVersion={scheduleVersion} />` between `:1923` and `:1925`; `resolveTitle(entryId, fallback)` finds the entry in `entries` and returns `computeDisplayTitle(entry)`, else `fallback`. Pass `onScheduleChanged={fetchList}` to each `ScheduledEntryCard`.
  - `ScheduledEntryCard`: new optional prop `onScheduleChanged` (default no-op), invoked in `handleSave`'s success branch after `setTimer` (`:1582`). No other card changes.
- **No backend changes.** `src/api/deploy-safety/index.js` and `src/api/scheduled-tasks/index.js` are consumed as-is.
- **Test lanes** (seams for the Tester — test authoring and `test/test.js` runner registration are Phase 3's, never Phase 4's):
  - **Unit (`npm test`, node):** dynamic-import `ui/src/utils/nextTaskCountdown.js` — `formatTimeToFire` cases (multi-day, exact-hour, under-an-hour, singular/plural, ceiling at 60 001 ms → "2 minutes", 1 ms → "1 minute", 0/negative → `null`) and `deriveNextTaskLine` state mapping (all four states, malformed payload). Structural sentinels on `RelaySettings.jsx` (component exists, rendered between hint and Add button, 10 s poll + 1 s tick present, `data-` seams) per the `admin-tools-dashboard-panel.test.js` precedent.
  - **Playwright (`tests/brainstorm/*.spec.js`, local stack):** render (AC-1 alongside intact rows), AC-2 toggle reflection, AC-3 tick (seed an entry firing ~90 s out; observe the displayed minutes decrease across a boundary and the post-fire move-on), AC-4 states, AC-5 by fetching `/api/deploy-safety/status` in-test and comparing `data-entry-id` + remaining time within sub-decision 5's tolerance.
  - **Live HTTP:** already covered by story #1's endpoint tests; nothing new server-side. Staging evidence is data-level only (frame bullet 6b — NIP-07 gate).

## Out of scope

- Any backend change; any change to ADR 0001's payload or verdict, or ADR 0002's script.
- Verdict/buffer/"running now"/halted-scheduler surfaces on the panel (story §Out of scope; noted above as follow-up candidates).
- Legacy per-customer timers in the line (ratified out of scope).
- Changes to the per-entry rows beyond the additive `onScheduleChanged` prop.
