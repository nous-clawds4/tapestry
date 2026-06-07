# Test Plan: Story 8 — Notification inbox

**Story:** `engineering-team/stories/communities-notifications/8-notification-inbox.md`
**ADR:** `engineering-team/decisions/communities-notifications/0038-notification-inbox.md`
**Date:** 2026-06-06

## Approach
New suite `test/notification-inbox.test.js`, registered in `test/test.js`. The sovereignty- and correctness-critical logic is pure — tested against **real source** via extract-and-eval (loaded inside tests to tolerate the new module): `buildNotifications` (occasion gating, exclude-own, dedup, sort), `hasNew` (the marker), and `notificationSentence` (the plain line). The fetchers, the `useNotifications` hook, the nav marker, and the route/inbox wiring are source-guards (relay I/O + React effects aren't unit-tested in Node).

## Coverage map
| Criterion | Test | Level |
|---|---|---|
| AC1 marker when something new + unseen, pref-gated | T8 (hasNew), T1 (gated build) | pure (real) |
| AC2 one plain sentence (actor/occasion/circle/time) | T9 (sentence) | pure (real) |
| AC3 opening clears marker; items link to source | T12 (markSeen on mount + sourceSlug link) | source guard |
| AC4 off occasions produce no items + never mark | T2 (off → none), T8 (no items → no new) | pure (real) |
| AC5 empty + error states | T12 (inbox empty/error) | source guard |
| AC6 dot not count + text equiv; no nag | T11 (Header dot, no badge, sr text) | source guard |

## Tests (pure core — real source)
- **T1** — a vouch for the viewer with `prefs.vouched` on → one `vouched` item (actor correct, circle null). *(fails now)*
- **T2** — same vouch with `prefs.vouched` off → no items (the gate). *(fails now)*
- **T3** — a vouch whose actor is the viewer → excluded (no self-notifications). *(fails now)*
- **T4** — a reply with `prefs.replies` on → `reply` item with circle name + sourceSlug from the circle index. *(fails now)*
- **T5** — a circle post with `prefs['new-posts']` on → `new-post` item. *(fails now)*
- **T6** — same event id present as both reply and circle-post (both prefs on) → one item, occasion `reply` (priority dedup). *(fails now)*
- **T7** — items sorted newest-first. *(fails now)*
- **T8** — `hasNew`: true when an item is newer than last-seen; false when all ≤ last-seen; false for empty. *(fails now)*
- **T9** — `notificationSentence`: vouched → "… vouched for you" (no circle); reply → "… replied to you in {circle}"; new-post → "New posts in {circle}". *(fails now)*

## Tests (source guards)
- **T10** — `lib/notifications.js` exposes `fetchNotificationSources` querying kind-39999 `#p`, kind-1111 `#p`, and kind-1111 `#A`. *(fails now)*
- **T11** — `useNotifications` gates on preferences (no fetch / no marker when signed-out or all off) and uses `buildNotifications` + last-seen; Header shows a quiet dot (no numeric badge) with a screen-reader text equivalent. *(fails now)*
- **T12** — `/notifications` route → `NotificationInbox`; the inbox calls `markNotificationsSeen` on mount, links items to their circle, and has empty + error states. *(fails now)*

## Edge cases
- [x] Off occasion never appears AND never marks (T2 + T8).
- [x] Own events excluded (T3).
- [x] Reply-in-your-circle counted once (T6).
- [x] No items → no marker (T8 empty).

## Test infrastructure
- Runner: `node test/test.js`. New suite exports `{ run }`, registered. Real-source layer extract-and-evals the pure functions, loaded inside tests to tolerate the new module. Relay I/O + the hook are source-guarded only.

## How to run
```
node test/test.js
# or: node -e "require('./test/notification-inbox.test.js').run().then(r=>console.log(r))"
```

## Verification
Pure tests fail (no `lib/notifications.js`); source guards fail (no hook/route/inbox/marker). Failing output pasted at the gate.
