# Test Plan: Event-driven applicability republish (tag-applicability #4)

**Story:** `engineering-team/stories/tag-applicability/4-event-driven-applicability-republish.md`
**ADR:** `engineering-team/decisions/tag-applicability/0003-event-driven-applicability-republish.md`
**Suite:** `test/applicability-republish.test.js` (registered in `test/test.js`)

## Strategy

Two behaviors are executed hermetically (no live strfry/TA key), the transport/wiring is covered by
source sentinels:

- **Diff-guard** — `refreshApplicabilityLists({deps})` with an injected `scanStrfry` that answers both
  the `#z` hint scans AND the `#d` current-list scan (returning a fabricated kind-30394 event with a
  chosen member set), plus a capturing `publishTL`. The tests assert on which lists actually publish.
- **Scheduler** — `createApplicabilityScheduler({refresh, windowMs})` with a spy `refresh` and a tiny
  window; real `setTimeout` + short `await sleep()` verify coalescing and the trailing run.
- **Endpoint / client / backstop** — source sentinels (the endpoint's auth + scheduler wiring; the
  client util + its call sites; the `freshInstallEntries` seed).

## Coverage — AC → test

| Acceptance criterion | Test(s) |
|---|---|
| Republish on a membership-changing mutation | DG2, DG3 (publish path); EP1 + CL1 (the trigger that drives it) |
| No churn when membership unchanged (diff-guard) | **DG1** (set equal ⇒ 0 publishes) |
| Coalesced (debounced) | **SC1** (3 calls ⇒ 1 refresh) |
| Best-effort / non-blocking | CL1 (util swallows errors; called un-awaited) |
| Slow backstop convergence | **BK1** (seed: refreshApplicabilityLists, disabled, hours) |
| Additive — read path + other TLs unchanged | not-modified (no assertions touch the picker / 30392 / 30393 / 30003 paths); regression suites stay green |

## Test list

**Diff-guard (executes `refreshApplicabilityLists`):**
- **DG1** — both lists' computed set == currently-published set ⇒ **no** kind-30394 publish.
- **DG2** — one list's set changed ⇒ exactly that list republishes; the unchanged one is skipped.
- **DG3** — no currently-published list (first run) ⇒ publishes (diff-guard only skips on a real match).

**Scheduler (executes `createApplicabilityScheduler`):**
- **SC1** — three rapid `schedule()` within the window ⇒ `refresh` runs exactly once (coalesce).
- **SC2** — a `schedule()` during an in-flight refresh ⇒ no concurrent run, then exactly one trailing run.

**Sentinels:**
- **EP1** — `POST /api/trusted-list/notify-applicability` registered, `requireAuth` (not loopback),
  constructs the scheduler singleton and calls `.schedule()`.
- **CL1** — `ui/src/utils/notifyTagApplicability.js` exists (POSTs the notify route, swallows errors);
  called from `useProfileTags` and `useEventTagging`.
- **BK1** — `freshInstallEntries` seeds a `refreshApplicabilityLists` entry with `enabled:false` and an
  `intervalHours` cadence (slow), alongside the existing `refreshPinnedTagTLs` seed.

## Out of scope (not tested here)
- Instant freshness for external taggings (backstop is eventual — no timing assertion on it).
- The live end-to-end publish + `requireAuth` session plumbing (covered by cycle-local smoke, not units).
- The picker read path / HINT ∪ USAGE computation (unchanged; guarded by the tag-applicability suites).

## Status
DG1, DG2, SC1, SC2, EP1, CL1, BK1 **fail** pre-implementation (diff-guard/scheduler/endpoint/util/seed
absent); DG3 passes against current always-publish behavior and stays green once the guard lands.
