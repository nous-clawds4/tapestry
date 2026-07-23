# Build Audit: Deploy-Safety Gate

**Book:** `engineering-team/audits/deploy-safety-gate/book.md`
**Date:** 2026-07-19
**Branch / commit range:** `04075e2b..e13acc46` (arming baseline → close; staging merges `d56f9758`, `ffe81855`, `85a769fc` via PRs #384/#385/#386)
**Provenance:** Acceptance-frame (armed Direction-mode pre-registration, run 2)
**Confidence:** high

> As-built record for the book that gave every tapestry instance a machine-readable answer to "is it safe to redeploy you right now?" — and made the promotion procedures ask it before every deploy-triggering merge.

## 1. What shipped

- **Deploy-safety status endpoint** — `GET /api/deploy-safety/status`: unauthenticated, read-only; reports running-now across both task systems, the next scheduled fire (label/timestamp/remaining), and an explicit safe/unsafe verdict with machine-checkable reasons — `stories/deploy-safety-gate/1-deploy-safety-status-endpoint.md`
- **Safe-to-merge gate** — `scripts/check-safe-to-merge.sh` (bounded wait-and-recheck, exit contract 0/1/2/3) + canonical recipe `docs/SAFE_TO_MERGE.md` (branch→instance map incl. `feat/tags`) + pre-merge steps in cycle-staging/cycle-prod, cycle-full inheriting by delegation — `stories/deploy-safety-gate/2-cycle-safe-to-merge-check.md`
- **Scheduled Tasks panel countdown** — "Next Scheduled Task, *name*, starts in X hours and Y minutes", live-ticking, endpoint-sourced (cannot contradict the gate), three-way empty states — `stories/deploy-safety-gate/3-scheduled-tasks-panel-countdown.md`

## 2. Epics & stories rolled up

### Epic: `deploy-safety-gate`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 deploy-safety-status-endpoint | The status endpoint + pure verdict core + legacy in-flight export | Done | `reviews/deploy-safety-gate/1-deploy-safety-status-endpoint.md` (PASS) |
| #2 cycle-safe-to-merge-check | Check script + canonical recipe + three skill integrations + L10 CHANGELOG row | Done | `reviews/deploy-safety-gate/2-cycle-safe-to-merge-check.md` (PASS) |
| #3 scheduled-tasks-panel-countdown | Pure countdown helper + NextScheduledTaskLine in the settings panel | Done | `reviews/deploy-safety-gate/3-scheduled-tasks-panel-countdown.md` (PASS) |

## 3. As-built inventory

Derived from the diff (17 files, +2601/−30; every file story/ADR-attributed — see §4 note on the two baseline-repair files):

- **User-facing:** `GET /api/deploy-safety/status` (new route, registered outside the `TASK_QUEUE_ENABLED` gate; `?bufferMinutes=` override, 400 on invalid); the Scheduled Tasks panel aggregate countdown line (`data-testid="next-task-line"`); the safe-to-merge check step in the cycle-staging/cycle-prod procedures.
- **Domain:** no concept handles touched; no firmware reinstall (verified live at every gate — note the 46↔48 count fluctuation, §7/OPEN.md #62).
- **Data & contracts:** the endpoint payload (ADR 0001 §Response shape) is now a **consumed ops contract** — `scripts/check-safe-to-merge.sh` greps `safeToDeploy`/`reasons`, the panel consumes `schedule.nextFire` + `queue.*`; renames are breaking. New exports: `computeVerdict` (pure), `getInFlightCount` (customer-schedule), `formatTimeToFire`/`deriveNextTaskLine` (ui util). The script's exit contract (0 safe / 1 bound-exhausted / 2 no-usable-answer / 3 usage) is consumed by three skills + the recipe doc.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 6b anticipated "the staging **list API** returning the data that line consumes" | The line consumes `/api/deploy-safety/status` (list API also verified 200) | intentional-change | ADR 0003: endpoint-sourcing makes the no-contradiction AC structural; `/list` collapses queue-disabled/nothing-scheduled | None (strictly better coherence) | — |
| 2 | Original operator proposal: fixed 60-minute look-ahead | 10-minute buffer + bounded wait-and-recheck in the consumer | intentional-change (operator-ratified at intake) | Sub-hourly schedules make a 60-min window unreachable (intake agreed-decision 1) | Gate usable on real schedules | — |
| 3 | — | `?bufferMinutes=` per-request override (validated, ≤1440) | added-beyond-scope (delegated) | ADR 0001 sub-decision 2; ADR 0002 chose NOT to pin it in the recipe (instance owns policy) | Verdict is caller-tunable; recipe journals the echoed value | Story-2 debt note stands |
| 4 | — | `onScheduleChanged`/`scheduleVersion` wiring fixing a pre-existing parent-staleness gap after card toggles | added-beyond-scope (deliberate) | ADR 0003 (named fix; Gate-2 judge verified the gap in code) | Panel data freshens correctly after edits | — |
| 5 | Compound time renderings | Zero-valued units dropped ("1 hour", never "1 hour and 0 minutes") | interpretation | Story-3 §Deviations; within the story's edge-copy delegation | Cosmetic | — |
| 6 | Frame bullet 4 names staging/prod/tags coverage | Sandbox branches (`feat/communities`, `feature-magic-carpet`, `feat/curate`) not covered | deferred (explicit) | Story 2 §Out of scope: outside the frame's coverage list; recipe's table extends with one row each | Uncovered deploy paths remain for sandboxes | Carry-forward |
| 7 | — | Prod/tags instances 404 the endpoint until story #1 promotes there; check exits 2 fail-closed | constraint-discovered | ADR 0002 "Sequencing reality"; recipe documents the transition | First prod promotion requires an explicit recorded operator decision at the stop | Carry-forward |

**Undocumented work:** none. Every diff file traces to a story/ADR or to the two journaled Tester-role baseline repairs (`test/profile-tags-publish.test.js` + OPEN.md rows — pre-existing zombie tests unmasked mid-run; journal 2026-07-18/19, OPEN.md #59/#60).

## 5. Quality state at close

- Test gate at close: `npm test` — **Overall PASS, exit 0** (run at close, 2026-07-19; log in session scratchpad `close-gate.log`). Suites: deploy-safety-status 23/23, safe-to-merge-check 16/16, next-task-countdown 24/24; Playwright story-3 spec 7/7 (last run at Gate 5/close window).
- Known open issues: `get-user-data` 504 on heavy profiles — **shared with untouched prod**, external to this book (OPEN.md #61); OPEN.md #58 summary-display defect (pre-existing, unrelated).
- Debt logged by ADRs, rolled up: legacy customer-schedule in-memory coupling via `getInFlightCount` (0001); unauthenticated exposure of running-task names/schedule metadata — counts and names only, ids/pubkeys excluded (0001); caller-tunable buffer (0001/0002); payload + exit-code contracts hardened by consumers (0002/0003); proceed-after-stop is procedural, not mechanically enforced — CI enforcement named as the escalation path (0002); doc↔script number alignment held by a content test, not a single source (0002); ≤10s disagreement window between the panel's two fetch layers (0003); halted-scheduler/legacy states render as "none upcoming" — a "why" notice is a named follow-up (0003).

## 6. Carry-forward register

- [ ] Drain-on-deploy / graceful shutdown: `closeTaskQueue()` still unwired to SIGTERM (2026-06-08 intake branches; spawned-task chip exists) — the gate reduces exposure but interruption of a task that slips through remains unmitigated.
- [ ] Stale `job.data` on BullMQ stalled recovery (2026-05-25 intake) — untouched by design.
- [ ] Auth-gating the scheduled-tasks **write** endpoints (spawned-task chip exists; the new read endpoint deliberately follows the unauthenticated-read precedent).
- [ ] First prod/tags promotion hits the endpoint-404 fail-closed stop (§4 #7) — operator decision at that moment; consider promoting story #1 to main promptly to close the window.
- [ ] Sandbox-branch coverage (§4 #6) — one recipe-table row each when wanted.
- [ ] CI-side enforcement of the gate (deploy-workflow query or branch protection) — the recipe's named escalation if procedure proves insufficient.
- [ ] Panel "why" notice for halted-scheduler / legacy-only states (ADR 0003 follow-up).
- [ ] `get-user-data` 504 investigation (OPEN.md #61) — outside this book's scope but surfaced twice during its smokes.

## 7. Process findings (harness)

`harness-stats.sh` at retro: 622 phase commits, 121 reviews decided, historical kick-back rate 1%, 17 books closed. This run: 13 blinded per-story spawns (12 APPROVE, 1 void, 0 KICK_BACKs), 3 mechanical Gate-4 passes, 3 Reviewer PASSes, completion audit KICK_BACK→APPROVE. Every disposition below is one of the three terminal states; ratification of proposed harness commits is the operator's, at triage.

| Finding | Source | Terminal state |
|---|---|---|
| Judge blinding breaks on unbounded `book.md` reads; bounded-read spawn prompts (offset/limit) prevented recurrence across 10 subsequent spawns | Journal (Gate-3 void, story #1) | OPEN.md `meta` row **#63** — proposes ratifying the bounded-read convention into the judge-spawn recipe (goalpost-class; operator decision) |
| Zombie-test class: live tests masked by environmental skips surface only on a healthy stack; two found and repaired mid-run | Journal forensics; OPEN.md #59/#60 | OPEN.md `meta` rows **#59/#60** (pre-existing; sibling audit candidate named in #59) |
| Completion-report verdict tallies must be **counted from the journal**, not recalled — the first completion audit caught an inflated tally | Journal (completion KICK_BACK) | OPEN.md `meta` row **#64** — proposes a one-line Stage-3 rule in the direct-feature skill (operator decision) |
| Phase-3 Playwright assertions beyond the first failure point are unreachable pre-implementation; a latent strict-mode defect surfaced only at implementation | Story-3 Implementer flag + Tester re-baseline commit `1c99dae4` | OPEN.md `meta` row **#65** — proposes tester-role guidance: prototype must reach every assertion (operator decision) |
| Concurrent-session commit on the same checkout mid-run (intake append) | Journal 2026-07-19 | **Declined** — existing protocol sufficed: journaled assessment against Stopping rule 6, zero interference; append-shared surfaces are designed for this |
| Cold-reboot state rollback (colima/Meili) as a *diagnostic* — it unmasked latent test debt | Journal forensics | **Declined** as a new row — mechanism and lesson already recorded in #50/#51/#59/#60 |
| Summary-line SKIP misprint can mask fail>0 in older suites | Story-2 Tester | OPEN.md `meta` row **#58** (pre-existing, filed mid-run) |

Ports across flows: the bounded-read convention (#63) and journal-derived tallies (#64) apply to any future Direction run; the zombie-test audit (#59) and prototype-reaches-every-assertion (#65) apply equally to the human-gated flow.
