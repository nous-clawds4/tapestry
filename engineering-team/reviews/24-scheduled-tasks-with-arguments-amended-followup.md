# Review (follow-up): Story 24 — Per-task arguments — non-blocking fixes

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-23
**Diff:** Single commit `698ae65c` — 73 lines added to `src/api/scheduled-tasks/index.js` and 13 lines tweaked in `ui/src/pages/settings/RelaySettings.jsx`.

This is a brief re-review of just the delta that addresses the two non-blocking findings flagged by `engineering-team/reviews/24-scheduled-tasks-with-arguments-amended.md`. The prior review was PASS; the operator elected to close the non-blocking gaps before promoting to staging.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test` (host)** — **PASS.** 192/192 across 21 suites; `scheduled-tasks-with-arguments` still 35/35; no sibling regression.
- [x] **`vite build`** — confirmed clean by the Implementer (re-run not required for a 13-line UI tweak; would've been instant anyway).
- [x] **Origin sync check** — 0 commits behind `origin/staging`. Feature branch is 7 commits ahead (the cycle through this follow-up).
- [x] **Cycle-local smoke for fix #1** — **PASS, performed by the Implementer.** Restarted brainstorm in the live container; the same `/create` call that previously slipped through now returns the documented 400. Captured verbatim in the impl commit message; reproducible by the operator.

## Delta walk

### Fix #1 — Save-time CustomerManager existence check

**New helper** `verifyCustomerExists(entry, registry)` at [src/api/scheduled-tasks/index.js:159-205](src/api/scheduled-tasks/index.js:159):

- Scoped correctly: only fires when `task.arguments.customer === true` AND `entry.args.customer` is truthy. Lets `validateEntry` continue to own the "required-missing" case.
- Lazy require of CustomerManager (`require('../../utils/customerManager')` inside the function body) — matches the existing pattern from `entryResolver.js` for the same dependency. No new top-level imports.
- Error fidelity: distinguishes `CUSTOMER_NOT_FOUND` (customer exists in CustomerManager API but `getCustomer` returns null) from `CUSTOMER_LOOKUP_ERROR` (the lookup itself threw). Both return 400 with the same response envelope as `validateEntry`'s errors, so the UI doesn't need a separate handler.
- Header doc explicitly cites the ADR §Q2 framing ("defense-in-depth for fast feedback, not the load-bearing check") so a future maintainer can't accidentally promote it to a load-bearing check.

**Call sites:**
- `handleCreate` at [:281-284](src/api/scheduled-tasks/index.js:281): unconditional after `validateEntry` returns ok. Always runs for customer-task creates.
- `handleUpdate` at [:330-336](src/api/scheduled-tasks/index.js:330): gated on `args !== undefined`. The accompanying comment explains why: an operator toggling enabled/schedule on an entry whose customer existed at create-time but has since been deleted shouldn't bounce on save — the fire-time path is the load-bearing check and will handle the deleted-customer case from there.

This `args !== undefined` gate is a thoughtful asymmetry that I want to note explicitly: it's not in the ADR's explicit wording, but it aligns with ADR §Q2's framing of save-time as "fast feedback, not load-bearing" — and it preserves the operator's ability to disable a now-orphaned entry without first picking a new customer. Defensible. If a future Architect decides the symmetric "check on every update" is preferable, dropping the gate is one line.

### Fix #2 — `computeDisplayTitle` precedence

**Edit** at [ui/src/pages/settings/RelaySettings.jsx:1710-1730](ui/src/pages/settings/RelaySettings.jsx:1710):

```js
function computeDisplayTitle(entry) {
  if (LEGACY_TITLE_OVERRIDES[entry.id]) return LEGACY_TITLE_OVERRIDES[entry.id];
  const taskName = entry.taskName || entry.taskId;
  const isCustomLabel = entry.label && entry.label !== taskName;
  if (isCustomLabel) return entry.label;
  if (entry.args && entry.args.customer && customerByPubkey[entry.args.customer]) {
    return `${taskName} — ${customerByPubkey[entry.args.customer].name}`;
  }
  return entry.label || entry.taskId;
}
```

- Operator-customized labels now correctly win over the auto-derive (ADR §Q4 "the stored entry.label is only used when the operator explicitly set it"). ✓
- Auto-derive for default-labeled customer-task entries preserved (rename freshness still works). ✓
- Edge case the Implementer flagged ("operator types literally `task.name` as the label") is acknowledged in their commit message and accepted as a non-issue. ✓
- The comment-block prologue is updated to document the new precedence order — a future reader gets the full reasoning inline.

## Spec adherence — both prior findings closed

| Prior non-blocking finding | Status |
|---|---|
| **#1: Save-time CustomerManager check missing** | **CLOSED.** verifyCustomerExists added; called from both handlers; cycle-local smoke confirms the same input that previously slipped through is now rejected at create with the documented 400 + CUSTOMER_NOT_FOUND envelope. |
| **#2: computeDisplayTitle ignores operator-set labels** | **CLOSED.** isCustomLabel branch runs before the auto-derive branch; operator-customized labels now take precedence. |
| **#3: Test plan gaps** (Tester-watch, not Implementer-fault) | Still open as Tester-watch. No new automated tests were added for either contract bullet — these closures happened at the impl layer, not the test layer. A future Tester pass (or a small follow-up) could add a sentinel that handleCreate calls `verifyCustomerExists` after `validateEntry`, and a UI test that confirms the display-label precedence. Non-blocking. |

## ADR adherence

- [x] §Files-to-edit handleCreate / handleUpdate "do a synchronous CustomerManager check and 400 on miss" — **implemented**, with the documented response envelope.
- [x] §Q2 three-layer defense (save-time + fire-time + render-time) — **all three layers now implemented**. The fire-time layer was already proven load-bearing in the prior smoke; this commit completes the save-time layer.
- [x] §Q4 "stored entry.label is only used when the operator explicitly set it" — **implemented** via `isCustomLabel = entry.label && entry.label !== taskName`.
- [x] No new dependencies introduced.
- [x] No new lint / typecheck / build tooling.

## Things tests can't catch (audit of just the delta)

| Hazard | Status |
|---|---|
| `verifyCustomerExists` adds one CustomerManager.initialize() + getCustomer() per save | ✓ acceptable. Per-save (not per-fire) cost; bounded to operator's save cadence. |
| handleUpdate's `args !== undefined` gate creates an asymmetry vs handleCreate (always-on) | Documented inline. Defensible per ADR §Q2 layering. Non-blocking; if the Architect later wants symmetric, dropping the gate is one line. |
| Edge case: operator types `entry.label` exactly equal to `task.name` | Acknowledged in the Implementer's commit message as accepted. Non-blocking pathological case. |
| Race condition: handleCreate reads + appends + writes config; entryResolver.disableEntryWithError reads + modifies + writes the same file concurrently | Pre-existing pattern from ADR 0019; not introduced by this commit. Same posture. |
| Error envelope shape match | ✓ verifyCustomerExists returns `{field, code, message, pubkey?}` matching validateEntry's `{field, code, message}` — caller wraps in `errors: [error]` so the UI's existing error-renderer handles it without changes. |

## Findings

### Blocking

None.

### Non-blocking

1. **Test plan gaps remain** (Tester-watch, carried over from the prior review). The two contract bullets that this commit closed have no automated sentinel in the test suite. If a future Implementer regresses the precedence in `computeDisplayTitle` or removes the `verifyCustomerExists` call site, the test gate won't catch it. A future Tester pass could add:
   - **Source sentinel:** `handleCreate` and `handleUpdate` call `verifyCustomerExists` after `validateEntry`.
   - **Behavioral source sentinel:** `computeDisplayTitle` has an `isCustomLabel` check before the customer-auto-derive branch.

   Both are small additions; not blocking for this PR but worth filing as a Tester-watch item or quick follow-up.

## Verdict

**PASS.**

Both prior non-blocking findings are closed cleanly with minimum-viable changes. Fix #1's cycle-local smoke proves the save-time path now rejects what previously slipped through; fix #2's source change is small, well-commented, and matches ADR §Q4's intent exactly. The test gate stays at 192/192; no sibling regression; no new dependencies.

The story is ready for the deploy chain. Promote with `/cycle-staging` to `staging.brainstorm.world`; on successful staging smoke, promote to production with `/cycle-prod`.
