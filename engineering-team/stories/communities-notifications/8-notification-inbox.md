# Story 8: Notification inbox

**Status:** Done
**Created:** 2026-06-06
**Type:** Feature
**Epic:** `communities-notifications` · **Book:** `audits/communities-v2/book.md`
**PRD:** `product-team/prd/communities-v2.md` §5.5 · **Queue:** `product-team/stories-queue.md` Block C, Story 8

## Background
With preferences in place (Story 7, off by default), a person can now learn what happened that involves them — without being pulled. The inbox is a calm list of things that already occurred (someone vouched for you, a reply to you, new posts in your circles), reached from a **quiet marker** in the nav (a small dot, never a numeric count engineered to manufacture urgency — design principle 8). It shows only the occasions the person turned on. This is the awareness surface the sovereignty control gates: in-app only (Q6), nothing pushed, nothing nagging.

Affected: the Belonger and the Convener (learning their circle had activity, or that they were vouched for) on their own terms.

## User-facing description
As a member who has opted into one or more occasions, I want a calm list of things that happened involving me, reached from a quiet marker, so that I stay aware without being pulled or counted at.

## Acceptance criteria
Testable from the outside. Each gets at least one test.

- [ ] Given the person has opted into an occasion and a matching event exists they haven't seen, a quiet new-marker (a dot, not a number) appears in the nav.
- [ ] Opening the inbox shows one plain sentence per item with the actor, the occasion, the circle, and a relative time.
- [ ] Opening the inbox clears the new-marker; each item links to its source (the post/reply/circle).
- [ ] Occasions the person has turned off produce no items and never contribute to the new-marker.
- [ ] An empty inbox shows the designed empty state ("Nothing new. When someone vouches for you or a circle you're in gets active, it shows up here."); a load failure shows an error with retry.
- [ ] The marker is conveyed with a text equivalent for assistive tech (not the dot alone); there is no count badge, nag, or urgency styling.

## Concepts touched
- Notification — a derived awareness that something involving the person happened (vouched-for / replied-to / new-activity), built from existing events; not a stored entity.
- Notification Preference — consumed (from Story 7) to filter which occasions appear and gate the marker.
- The source events: a membership vouch (assertion with the viewer as target), a reply to the viewer's post, a post in a circle the viewer is in.

## Out of scope
- Channels beyond in-app (Q6: in-app only) — no email/push.
- Generating notifications for others / sending anything outbound — this is the viewer's own read surface.
- Per-notification read/unread state beyond the single "new since last opened" marker (v1 uses one last-seen marker, not per-item read receipts).
- Real-time push of new notifications (a load/poll on open is enough; reuse the offered-update posture if a refresh is wanted — no auto-pull).

## Open questions
- "Your circles" for the new-posts occasion: the circles the viewer has joined (local) vs derived membership (the roster is dark in prod). For v1, lean on the locally-joined set so it works without the dark roster. Architecture decides.
- Derivation per occasion (which event query identifies a vouch-for-you, a reply-to-you, a new-post-in-your-circles), de-duplication, and how far back the inbox looks — Architecture.
- Where the last-seen marker is stored (device-local, like preferences) and how "new" is computed against it — Architecture; the observable behavior (marker clears on open, off-occasions never mark) is fixed.

## Linked artifacts
- ADR: `engineering-team/decisions/communities-notifications/0038-notification-inbox.md` (derived 3-occasion inbox; pure buildNotifications + hasNew; app-level useNotifications hook drives the nav marker; fetch only when opted-in; "your circles" = joined)
- Test plan: `engineering-team/stories/communities-notifications/8-notification-inbox.test-plan.md` (new suite `test/notification-inbox.test.js`: real-source buildNotifications/hasNew/notificationSentence T1–T9, hook/fetch/marker/route guards T10–T12)
- Review: `engineering-team/reviews/communities-notifications/8-notification-inbox.md` (CHANGES REQUESTED — 1 blocking: `getJoinedCommunitySummaries` drops `model`/`founder`, so `circleATag` returns null for all joined circles → new-posts occasion never fires and reply rows lose circle name + source link)
