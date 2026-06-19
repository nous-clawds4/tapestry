# Story 2: `/event` page — resolve a URL parameter and render the event (or the precise outcome)

**Status:** Done
**Created:** 2026-06-18
**Type:** Feature

## Background
The `/event` page is a placeholder today. This story makes it render a **kind-1** event identified by a **supported URL parameter**, reusing the read path (`event-page` #1) and the shared note card. The **search-field fallback** for when no valid parameter is present is a sibling story (`event-page` #3); this story covers the **parameter-driven** path and explicitly defers the no-parameter surface to #3.

Six parameters are supported, in precedence **`nevent` › `id` › `naddr` › `pubkey` › `npub` › `nprofile`**. `naddr` is decoded locally to its kind (always addressable, never kind-1) and reported as not-yet-supported without a fetch.

Affected: anyone opening `/event?…`. Front-end; consumes #1.

## User-facing description
As someone opening an `/event` link, I want the page to read the identifier from the URL, pick the right one when several are present, and show me the note (rendered like the feed) — or a clear, specific message when it can't (wrong kind, doesn't verify, not found, the author has no note, or my identifier was malformed).

## Acceptance criteria
Testable from the outside.

- [ ] **Precedence.** Given a URL with **more than one valid** supported parameter, the page resolves using the **first valid** in the order `nevent` › `id` › `naddr` › `pubkey` › `npub` › `nprofile`.

- [ ] **Invalid vs unsupported.** A **supported** parameter whose value is **malformed** (e.g. `?nevent=garbage`) is reported on-page as **invalid** (identifying which parameter). Parameter **names outside the six** are **silently ignored**.

- [ ] **Event reference → render or outcome.** Given a valid `nevent`/`id`, the page shows: the note **rendered like the `/feed` page** (shared note card) when the read path returns a found kind-1; **"kind ‹N› not yet supported"** when it returns another kind; **"this event does not validate"** when verification fails; **"event not found"** when no such event. (Exactly one, matching the read path's outcome.)

- [ ] **`naddr` → unsupported kind.** Given a valid `naddr`, the page shows **"kind ‹N› not yet supported"** (N taken from the naddr coordinate) — no fetch, since addressable events are never kind-1.

- [ ] **Author → latest note or none.** Given a valid `pubkey`/`npub`/`nprofile`, the page shows that author's **most-recent kind-1 rendered like the feed**, or **"no kind-1 note found for this author."**

- [ ] **Public, additive, no overflow.** `/event` is reachable with no login (HTTP 200, never a login wall), the change is additive (with the new view removed the app is unchanged), and at a 1280px-wide viewport the page produces **no horizontal overflow**.

> Canonical outcome wording is operator-delegated; exact punctuation is non-binding so long as each message conveys its meaning. When a valid parameter is present, the search field (`event-page` #3) is **not** shown.

## Concepts touched
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-kind` — kind-1 (rendered), other kinds (gated as "not yet supported").
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — the event author / looked-up author.

## Out of scope
- The read/fetch/verify/relay logic (that is `event-page` #1).
- The **no-parameter search field** + its format validation (`event-page` #3).
- Rendering any non-kind-1 event; threads/replies/reactions; any write/publish.
- Changing existing note `nostr:` link targets, the feed, profiles, ranking, or firmware.

## Open questions
None — the six parameters, precedence, invalid-vs-unsupported handling, naddr-as-unsupported-kind, and the kind-1 render were operator-resolved at Planning.

## Linked artifacts
- ADR: `engineering-team/decisions/event-page/0002-event-page-ui.md`
- Test plan: `engineering-team/stories/event-page/2-event-page-param-render.test-plan.md`
- Review: `engineering-team/reviews/event-page/1-event-page-implementation.md` (PASS — 2026-06-18)
