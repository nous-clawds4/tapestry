# ADR 0038: Notification inbox — derived, pref-gated, app-level marker

**Status:** Proposed
**Date:** 2026-06-06
**Story:** `engineering-team/stories/communities-notifications/8-notification-inbox.md`
**Builds on:** ADR-0037 (preferences, off by default).

## Context
Story 8 surfaces three occasions a person opted into: someone **vouched for you**, a **reply to you**, **new posts in your circles**. Notifications are *derived* from existing events (no stored entity). A quiet nav marker (a dot, never a count) appears when there's something new and unseen, gated by preferences; opening the inbox clears it. In-app only (Q6). The roster is dark in prod, so "your circles" must not depend on it.

Event shapes available:
- A vouch-for-you = kind-39999 with `#p = viewer`, `polarity = 1`, `z = …:nostr-user-tag`, author ≠ viewer (`events/assertion.js`).
- A reply-to-you = kind-1111 with `#p = viewer` **and an `e` tag** (replies set lowercase `e`+`p`=parent author; a top-level post has no `e`), author ≠ viewer.
- A new post in a circle = kind-1111 with `#A = <circle coord>`, author ≠ viewer.
- `getJoinedCommunitySummaries(slugs, viewer)` resolves the viewer's joined circles → coordinates + names. `circleATag` (ADR-0036) builds coordinates. AppShell exposes an `Outlet context`.

The marker is **app-global** (nav), so it can't live only on the inbox page.

## Options considered

### Option A — Pure builder + thin fetchers + an app-level notifications hook
A pure `buildNotifications(...)` turns projected event arrays + preferences + viewer + a circle index into a filtered, deduped, sorted item list; a pure `hasNew(items, lastSeen)` drives the marker. Thin relay fetchers project the three sources. A `useNotifications` hook at AppShell runs the fetch **only when signed-in AND at least one preference is on** (default-off ⇒ no fetch, no marker), exposes `{ items, hasNew, markSeen }` via context; Header shows the dot, the inbox page renders items and calls `markSeen()` on open. Last-seen is device-local (mirrors prefs).
- **Pros:** the gating, dedup, and "new" logic are a pure, unit-testable core; opting in is what turns on the (bounded, ~3-query) fetch, so opted-out users cost nothing; one fetch site feeds both the marker and the list; no dependency on the dark roster ("your circles" = joined).
- **Cons:** adds a hook + context plumbing at the shell; the marker reflects fetch-on-load (not real-time) — acceptable (no auto-pull is on-thesis).

### Option B — Inbox-page-only, poll for the marker separately
Marker computed by its own lightweight poll; inbox fetches independently.
- **Cons:** two fetch/derive sites to keep consistent; duplicated gating logic; more places for the off-occasion rule to drift. Rejected.

## Decision
We chose **Option A**. The sovereignty rules (off-occasions never mark; dot-not-count) live in one pure function, tested directly; the fetch only runs for opted-in users; and "your circles" = the locally-joined set, so the inbox works with the roster dark. The marker is fetch-on-load, consistent with the no-auto-pull posture (Story 5).

## Consequences
- **Enables:** a calm, pref-gated inbox + nav marker with a pure tested core; zero cost for the default opted-out state.
- **Constrains:** not real-time (load-on-open / on app load); vouch items have no circle (a vouch is tag-scoped, not circle-scoped) so their sentence omits the circle; links target the circle page (no per-post permalink exists).
- **v1 scope:** "your circles" = joined (local); lookback bounded by query `limit`; one last-seen marker (no per-item read state).
- **New debt:** none beyond the documented v1 simplifications; per-viewer-roster "your circles" and real-time are future ADRs.
- **Firmware reinstall required?** No.

## Implementation notes
- **`ui-communities/src/lib/notifications.js`** (new):
  - **Pure** `buildNotifications({ vouches, replies, circlePosts, viewer, prefs, circleIndex })` → `Notification[]`:
    - vouched (only if `prefs.vouched`): from `vouches` where `target === viewer && actor !== viewer` → `{ id, occasion:'vouched', actor, circle:null, sourceSlug:null, createdAt }`.
    - replies (only if `prefs.replies`): from `replies` where `actor !== viewer` → `{ id, occasion:'reply', actor, circle: circleIndex.get(aTag)?.name ?? null, sourceSlug: circleIndex.get(aTag)?.slug ?? null, createdAt }`.
    - new-posts (only if `prefs['new-posts']`): from `circlePosts` where `actor !== viewer` → occasion `'new-post'`, circle/slug from `circleIndex`.
    - **Dedup by event id** with occasion priority `reply > new-post` (a reply to you in your circle counts once, as a reply). Sort newest-first. Cap to a sane N (e.g. 50).
  - **Pure** `hasNew(items, lastSeen)` → `items.some(i => i.createdAt > (lastSeen || 0))`.
  - **Pure** `notificationSentence(item, displayName)` → one plain line ("{name} vouched for you" / "{name} replied to you in {circle}" / "New posts in {circle}"), circle omitted when null. (Keep it pure/testable; the component passes a resolved display name.)
  - I/O: `getLastSeen(pubkey)` / `markSeen(pubkey)` via `localStorage` (mirror `notificationPrefs` key style); `fetchNotificationSources({ viewer, joinedATags })` → `{ vouches, replies, circlePosts }` via relay collect: `{kinds:[39999], '#p':[viewer], limit:100}` filtered to `z` nostr-user-tag + `polarity==='1'`; `{kinds:[1111], '#p':[viewer], limit:100}` filtered to has-`e`; `{kinds:[1111], '#A':joinedATags, limit:200}`. Project each to the arrays above (id, actor=pubkey, target/parent from `p`, aTag from `A`, createdAt).
- **`ui-communities/src/hooks/useNotifications.js`** (new): given `{ viewer, signedIn }`, read prefs (`loadPreferences`); if `!signedIn` or all prefs off → `{ items:[], hasNew:false, markSeen(){} }` with **no fetch**. Else resolve joined circles (`getJoinedCommunitySummaries`) → `circleIndex` + `joinedATags`, `fetchNotificationSources`, `buildNotifications`, compute `hasNew` against `getLastSeen`. `markSeen()` writes now + flips `hasNew` false. Guard against set-after-unmount.
- **`ui-communities/src/App.jsx`** — call `useNotifications` in AppShell; add `{ notifications: items, notificationsHasNew: hasNew, markNotificationsSeen: markSeen }` to the outlet `ctx`; pass `hasNew` to `<Header>`.
- **`ui-communities/src/components/Header.jsx`** — when signed-in and `hasNew`, render a quiet `--accent` dot on the "Notifications" account-menu entry (or a small nav affordance) with an accessible text equivalent ("new updates"); **no numeric badge**. The entry navigates to `/notifications`.
- **`ui-communities/src/pages/NotificationInbox.jsx`** (new, route `/notifications`): renders `ctx.notifications` as one sentence per item (actor display name via the existing profile/`npubShort` helpers, relative time via `lib/format`), each linking to its `sourceSlug` circle when set; calls `markNotificationsSeen()` on mount; designed empty state ("Nothing new. When someone vouches for you or a circle you're in gets active, it shows up here.") and an error+retry state. Signed-out → sign-in prompt.
- **CSS** — token-based; the marker dot is `--accent`, paired with screen-reader text.

## Out of scope
- Real-time push; per-item read state; email/push channels; per-viewer-roster "your circles" (uses joined for v1); per-post permalinks.
