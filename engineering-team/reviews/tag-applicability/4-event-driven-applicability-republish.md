# Review: Event-driven applicability republish (tag-applicability #4)

**Date:** 2026-07-06
**Reviewer phase.** Story `engineering-team/stories/tag-applicability/4-event-driven-applicability-republish.md`;
ADR `engineering-team/decisions/tag-applicability/0003-event-driven-applicability-republish.md`; test plan
`…/4-…test-plan.md`. Diff: `cd379860`.

## Verdict: **PASS**

Implements ADR 0003 Option A exactly, all ACs met, 8/8 new tests + full regression green, and the two
tricky pieces (scheduler concurrency, diff-guard) were traced *and* live-smoked. Minor non-blocking notes.

## Acceptance criteria

| AC | Verdict | Evidence |
|---|---|---|
| Republish on a membership-changing mutation | ✅ | client `notifyTagApplicability()` in `useProfileTags` (create/apply) + `useEventTagging` (apply); → `notify-applicability` → `schedule()` → `refreshApplicabilityLists` |
| No churn when membership unchanged (diff-guard) | ✅ | `refreshApplicabilityLists.js` `currentMemberSet`+`sameSet`; test DG1; **live smoke**: double-run both `skipped`, TL event id byte-identical |
| Coalesced (debounced) | ✅ | `applicabilityScheduler.js`; test SC1 (3 calls → 1 refresh) |
| Best-effort / non-blocking | ✅ | `notifyTagApplicability.js` never awaited, `.catch(()=>{})`; test CL1 |
| Slow backstop convergence | ✅ | `freshInstallEntries` seeds `refreshApplicabilityLists` (`enabled:false, intervalHours:1`); test BK1 |
| Additive — read path + other TLs unchanged | ✅ | picker/30392/30393/30003 untouched; regression suites green |

## ADR adherence

Faithful to Option A: diff-guard on the member **SET** (not ordered list — usage-reorder doesn't churn,
as specified); in-process `createApplicabilityScheduler({refresh,windowMs})` singleton; user-authed
`POST /api/trusted-list/notify-applicability` (mirrors `refresh-pinned-tag`); client best-effort notify
from both mutation hooks; hourly disabled backstop seed. No deviations.

## Risk areas audited

1. **Scheduler concurrency (`applicabilityScheduler.js`).** Traced: `schedule()` coalesces within a
   window (`if (timer) return`) and folds mid-run calls into a single trailing run (`if (running)
   {pending=true}`); `runNow()` re-guards `running` and re-schedules on `pending` in `finally`. No
   overlap is possible — Node's single-threaded loop means nothing interleaves between `timer=null`
   and `running=true`. A thrown `refresh()` still clears `running` and honors `pending` (finally).
   `timer.unref()` prevents holding the process open. Tests SC1/SC2 exercise both paths. **Correct.**
2. **Diff-guard (`refreshApplicabilityLists.js`).** `currentMemberSet` reads the latest kind-30394
   event at the d-tag; `sameSet` compares sorted a-values (order-independent). Empty-vs-empty → skip;
   no-current → publish; set-change → publish. Legacy-30393 retraction is on a different kind, so no
   interaction. **Live-verified churn-free.**
3. **Endpoint auth (`index.js`).** Module-level singleton created once at load; `handleNotifyApplicability`
   → `requireAuth` → `schedule()` → `202`. **Live smoke: 401 unauthenticated.** Shares the exact auth
   model as `refresh-pinned-tag`, so it works wherever that already works.
4. **Client contract.** `useEventTagging.applyTag` now `await`s `run()`, fires notify, returns the same
   result — caller contract unchanged; on throw, notify is skipped (no membership committed).
   `useProfileTags` apply/create fire after their existing `refetch()`. No behavior change to the tagging UX.
5. **`freshInstallEntries` 1→2 entries.** No test asserts its cardinality (only this story's BK1 reads
   it); the existing `refreshPinnedTagTLs` seed is preserved verbatim; scheduled-tasks suites green.

## Test coverage

New `test/applicability-republish.test.js` — 8 tests: DG1–3 (diff-guard, executed), SC1–2 (scheduler
coalesce + trailing, executed), EP1/CL1/BK1 (endpoint/client/backstop sentinels). Independent reviewer
run: **all green** across the new suite + tag-applicability(+picker), note-trusted-list, unified-tag-index,
event-tagging core/for-tag/read-api, profile-tags, generalized-tag-pinning, and 3 scheduled-tasks suites.

## Minor findings (non-blocking)

1. **Event-driven path needs a signature-authenticated session** (`requireAuth` wants `session.authenticated
   === true`, not just a supplied pubkey). This is correct and identical to `refresh-pinned-tag`; if a
   session is only pubkey-set (no signed challenge), notify 401s and the **backstop** reconciles. Worth an
   operator note only — not a defect.
2. **Backstop seed is fresh-install only** (existing convention) — on tags.b.w the operator enables the
   hourly backstop manually in the control panel. Already documented in the ADR/story.
3. **Notify has no client-side throttle** — every apply fires one small fetch; the server debounce +
   diff-guard make client throttling unnecessary. Fine as-is.

## Deploy note
Live-smoked locally (server restarted, UI dist copied). On tags.b.w the event-driven notify works once
deployed; the hourly backstop needs manual enablement (fresh-install seed only).
