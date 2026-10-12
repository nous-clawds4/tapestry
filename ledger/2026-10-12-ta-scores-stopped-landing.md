# No Tapestry-Assistant-signed kind-30382 Score has reached staging's relay since 2026-06-07, or production's since 2026-05-25

**Id:** 2026-10-12-ta-scores-stopped-landing
**Type:** bug
**Opened:** 2026-10-12 (book `assistant-self-map`, intake)
**Status:** OPEN
**Done:** —

**What was seen** (read from the relays with plain `REQ`s, 2026-10-12, about 03:40 UTC):
- **Staging.** The TA is `8e901369…5fb1`, from `/api/assistant/pubkey`.
  - The newest TA-signed `30382` at `wss://staging.brainstorm.world/relay` is from 2026-06-07 21:40 UTC.
  - With `since` 2026-06-08 there are none, at that relay or at `wss://nip85.brainstorm.world`.
  - `GET /api/neo4j-health/task-timeline?hours=720` reports `totalExecutions: 0` for the last 30 days.
- **Production.** The TA is `919ba08a…e2ff`. The newest TA-signed `30382` at `wss://tapestry.brainstorm.world/relay`
  is from 2026-05-25 23:04 UTC.
- **Other kinds are newer** at staging's relay: TA-signed `30394` from 2026-10-10, `39998` from 2026-10-03, and the
  Duty Menu from 2026-10-12.

**Where Scores come from.** The Owner's Scores come from `processAllTasks.sh` → `exportOwnerKind30382` →
`src/algos/nip85/publishNip85.sh` → `publish_kind30382.js`. That is `strfry import` into local strfry, which is the
relay staging serves at `/relay`. So either the scheduled pipeline isn't running there, or it runs and doesn't reach
the export.

**Not diagnosed.** This was not checked inside the container, and the empty timeline may also mean the timeline's log
isn't written there. Ledger row `2026-09-27-processalltasks-calls-removed-reconciliation` is a known orchestrator
defect that may or may not be related.

**Likely cause, from the code** (ADR `assistant-self-map/0001` § Context, 2026-10-12; still to be confirmed in the
container):
- Docker deployments run no scheduler for the Score pipelines. `processAllTasks` runs from a systemd timer only on bare
  metal (`systemd/processAllTasks.timer`).
- The BullMQ fresh-install seeds include no Score task (`src/api/scheduled-tasks/index.js:41-86`).
- So on staging and production, the Owner's and customers' Scores refresh only if the operator has added a schedule
  entry for one of:
  - `processAllTasks`, `updateAllScoresForOwner`, `exportOwnerKind30382`;
  - `processAllActiveCustomers` or a per-customer task.

**Why it matters now:**
- The TA's Duty Menu offers `30382` at the staging relay. That is an offer, and § 10 of `duty-menus.md` keeps it apart
  from what is active.
- A self-Map must not claim Scores that aren't kept up to date. § 9.2 has readers count an insight at a self-entry's
  relay as maintained "whatever its age", so book `assistant-self-map` leaves Scores out of a self-Map while they
  aren't landing.
- The Owner's own Scores-based features on staging read four-month-old values.

**Fix shape.** Diagnose inside the `tapestry` container on each droplet:
- `docker exec tapestry supervisorctl status`;
- the task-queue log, `events.jsonl`;
- `publishNip85.log`;
- whether `processAllTasks` is scheduled.

Then restore the Owner's export. This is an operations fix, outside book `assistant-self-map`.

**Pointer:** `engineering-team/audits/assistant-self-map/book.md` § Facts found at intake.
