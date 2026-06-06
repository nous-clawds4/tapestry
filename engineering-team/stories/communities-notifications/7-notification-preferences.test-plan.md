# Test Plan: Story 7 — Notification preferences (the sovereignty control)

**Story:** `engineering-team/stories/communities-notifications/7-notification-preferences.md`
**ADR:** `engineering-team/decisions/communities-notifications/0037-notification-preferences.md`
**Date:** 2026-06-06

## Approach
New suite `test/notification-preferences.test.js`, registered in `test/test.js`. The **off-by-default guarantee** is a pure function (`defaultPreferences`/`mergePreferences`) — tested against real source via extract-and-eval (loaded inside tests to tolerate the new module). The toggle UI, the no-master-switch rule, revert-on-failure, and the route/menu wiring are source-guards (the I/O wrappers `loadPreferences`/`savePreference` touch `localStorage`, so they aren't unit-tested in Node — their behavior is guarded at the call sites).

## Coverage map
| Criterion | Test | Level |
|---|---|---|
| AC1 independent toggle per occasion | T6 (renders per OCCASIONS) | source guard |
| AC2 off by default | T1 (defaults all off), T2 (no stored → off), T4/T5 (unknown/non-bool → off) | pure (real) |
| AC3 save immediately + quiet "Saved" | T6 (savePreference on change), T8 ("Saved") | source guard |
| AC4 no master "turn on everything" | T7 (per-occasion render; master-switch copy absent) | source guard |
| AC5 state by position + text label, not color | T6 (On/Off label present) | source guard |
| AC6 failed save reverts + inline retry | T8 (checks save `ok`, revert + Retry) | source guard |

## Tests
- **T1** — `defaultPreferences()` → `{ vouched:false, 'new-posts':false, replies:false }` (all off). *(fails now)*
- **T2** — `mergePreferences(null)` and `mergePreferences({})` → all off (no stored value → silent). *(fails now)*
- **T3** — `mergePreferences({ vouched:true })` → vouched true, others false (independent). *(fails now)*
- **T4** — `mergePreferences({ bogus:true })` → unknown key ignored; all known off. *(fails now)*
- **T5** — `mergePreferences({ vouched:'yes' })` → non-boolean ignored → vouched false. *(fails now)*
- **T6** — source guard: `NotificationSettings` renders a toggle per `OCCASIONS`, shows an On/Off text label, and calls `savePreference` on change. *(fails now)*
- **T7** — source guard: no master switch — the page renders per-occasion (`OCCASIONS.map`) and contains no "turn on everything / enable all / all notifications" control. *(fails now)*
- **T8** — source guard: the change handler checks the save result and reverts + shows a retry on failure ("Saved" on ok; "Retry"/"Couldn't save" on fail). *(fails now)*
- **T9** — source guard: a `/settings` route maps to `NotificationSettings` (App.jsx) and the signed-in account menu links to it (Header.jsx → "Notification settings" / `/settings`). *(fails now)*

## Edge cases
- [x] No stored prefs → all off (T2) — the core safety property.
- [x] Unknown / non-boolean stored values ignored (T4/T5).
- [x] Independent occasions (T3).
- [x] Save failure path (T8).

## Test infrastructure
- Runner: `node test/test.js`. New suite exports `{ run }`, registered. Real-source layer extract-and-evals `defaultPreferences`/`mergePreferences`, loaded inside tests to tolerate the new module. `localStorage` I/O is not unit-tested in Node (source-guarded at call sites).

## How to run
```
node test/test.js
# or: node -e "require('./test/notification-preferences.test.js').run().then(r=>console.log(r))"
```

## Verification
Pure tests fail (no `lib/notificationPrefs.js`); source guards fail (no page/route/menu). Failing output pasted at the gate.
