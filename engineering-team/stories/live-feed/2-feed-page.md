# Story 2: Live Feed page (`/feed`)

**Status:** Draft
**Created:** 2026-06-15
**Type:** Feature

## Background
The Live Feed epic's read path (`live-feed` #1, **Done**) produces — for a resolved
source identity — an ordered, bounded, profile-enriched set of recent kind-1 notes, plus
the three defined edge outcomes (no source identity / follow list not in local strfry /
follow list present but no notes). That output has no surface a person can look at.

This story adds the **public, login-free `/feed` page** that renders that output: a
heading, the notes (author display name + avatar + timestamp + text, newest first), a
recent-window indicator, and a clear on-page message for each of the three edge outcomes.
It is the visible host surface the epic exists to stand up — the later, separate tagging
book will hang off it.

The page is **front-end only**. It consumes `live-feed` #1's output and adds no new read
logic: it does not resolve the source identity, read follows, fetch notes, choose the relay
set, or enrich profiles — all of that already happened in #1. This story is about *what a
person sees* when they open `/feed`.

Affected: anonymous visitors and logged-in users alike — anyone who opens `/feed`.

## User-facing description
As anyone visiting the instance (logged in or not), I want a plain, bookmarkable `/feed`
page that shows the most recent notes from the accounts the active source identity follows —
newest first, each with the author's name, avatar, timestamp, and text — so that I can read
the live feed without logging in, and so that when there's nothing to show I'm told why
rather than seeing a blank page or an error.

## Acceptance criteria
Testable from the outside. Each criterion gets at least one test.

- [ ] **Public, no-login reachability + no overflow.** Given no logged-in user, when an
  anonymous client requests `GET /feed`, then the response is HTTP 200 and renders the feed
  surface (the populated feed or one of the three defined empty states below) — never a
  login wall or error — and at a 1280px-wide viewport the rendered page produces **no
  horizontal overflow** (no content extends beyond 1280px / no horizontal scrollbar).

- [ ] **Populated feed: content, order, heading, window indicator.** Given the read path
  yields one or more notes for the resolved source identity, when `/feed` renders, then the
  page shows the heading **"Live Feed"**, the indicator **"Showing the most recent 50
  notes."**, and one entry per note — each entry showing that note's author **display name**,
  author **avatar**, **timestamp**, and **text** — with entries ordered **newest first**
  (each entry's timestamp is the same as or older than the entry above it).

- [ ] **Empty state 6a — no source identity.** Given the read path reports no source
  identity (no logged-in user and no House point-of-view), when `/feed` renders, then the
  page shows the on-page message **"No House point-of-view is selected — there's no feed to
  show yet."** and shows no note entries.

- [ ] **Empty state 6b — follow list not available locally.** Given the read path reports
  the source identity's follow list is not in local strfry, when `/feed` renders, then the
  page shows the on-page message **"This identity's follow list isn't available locally
  yet."** and shows no note entries.

- [ ] **Empty state 6c — follow list present but no notes.** Given the read path reports a
  follow list with no recent kind-1 notes, when `/feed` renders, then the page shows the
  on-page message **"No recent notes from the accounts this identity follows."** and shows
  no note entries.

> Canonical copy above is the operator-delegated wording; punctuation is non-binding so long
> as each message conveys its frame meaning. Exactly one of the four states (populated /
> 6a / 6b / 6c) renders for a given request, matching whichever outcome the read path
> reports.

## Concepts touched
This page renders the read path's already-resolved output; it references no Concept-Graph
concept directly. (The underlying data — kind-1 notes, kind-0 profiles, the source identity,
the relay set — is owned by `live-feed` #1 and the concepts it lists.)

## Out of scope
- **Any read/resolution logic.** Resolving the source identity, reading the kind-3 follow
  list, fetching kind-1 notes, choosing the relay set / fallback, the 50-cap, and profile
  enrichment all live in `live-feed` #1 — this page only renders #1's output.
- A source-identity selector / PoV picker on the page (the source is resolved, not chosen).
- Tagging feed items with existing Tags (the later, separate book this surface hosts).
- Reposts (kind 6), reactions (kind 7), threading/replies, pagination beyond the
  recent-window cap, infinite scroll, full history.
- Any write/publish action, and any change to the search page, profile pages,
  ranking/scoring, or firmware. The change is **additive**: it adds the `/feed` route/page;
  with `/feed` removed, the rest of the app behaves exactly as before.

## Open questions
None — product intent (scope, acceptance frame, and all on-page copy) was operator-resolved
at intake.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
