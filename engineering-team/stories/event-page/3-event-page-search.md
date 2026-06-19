# Story 3: `/event` page — the no-parameter search fallback

**Status:** Done
**Created:** 2026-06-18
**Type:** Feature

## Background
When `/event` is opened with **no valid supported parameter**, there's nothing to resolve. This story adds a **search field** that lets a person paste one of the six supported identifiers and resolve it — exactly as if it had been the URL parameter (`event-page` #2's render path). It is shown **only** when no valid parameter is present.

Affected: anyone who opens a bare `/event` (or one whose only parameters are invalid/unsupported). Front-end; reuses #2's resolution + #1's read path.

## User-facing description
As someone who lands on `/event` with no usable identifier, I want a clearly-labelled field where I can paste an `nevent`, `id`, `naddr`, `pubkey`, `npub`, or `nprofile` and press Enter to see the event — and if what I typed isn't one of those formats, I want to be told that rather than left guessing.

## Acceptance criteria
Testable from the outside.

- [ ] **Shown only when no valid parameter.** Given `/event` with **no valid** supported parameter (none supplied, or every supplied supported parameter is malformed, and any other names are unsupported), the page shows a **search field** prompting for one of the six formats (`nevent`, `id`, `naddr`, `pubkey`, `npub`, `nprofile`). Given a **valid** parameter **is** present, the search field is **not** shown.

- [ ] **Submit a valid identifier → resolves.** When a string in **one of the six formats** is entered and submitted (Enter button / Enter key), the page resolves and renders it with **the same outcomes as the equivalent URL parameter** (`event-page` #2) — a rendered kind-1, an "unsupported kind", a "does not validate", a "not found", or an author's latest note / "no note".

- [ ] **Submit a non-matching string → notice.** When a string matching **none** of the six formats is submitted, the page shows a **"not a recognized format"** notice and renders no event (the search field remains so the person can retry).

> Canonical wording is operator-delegated; punctuation non-binding. Whether a successful submit also updates the URL (so the result is shareable) is an Architecture/UX detail, not a product requirement.

## Concepts touched
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-kind` — kind-1 (the eventual render target).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — the looked-up author / event author.

## Out of scope
- The read/fetch logic (`event-page` #1) and the parameter-driven render path (`event-page` #2) — this story reuses both.
- Autocomplete / search history / resolving anything other than the six exact formats (e.g. NIP-05 addresses, free-text search).
- Any write/publish; changes to the feed, profiles, ranking, or firmware.

## Open questions
None — the trigger condition (no valid parameter), the six accepted formats, the resolve-as-parameter behavior, and the not-recognized notice were operator-resolved at Planning.

## Linked artifacts
- ADR: `engineering-team/decisions/event-page/0002-event-page-ui.md`
- Test plan: `engineering-team/stories/event-page/3-event-page-search.test-plan.md`
- Review: `engineering-team/reviews/event-page/1-event-page-implementation.md` (PASS — 2026-06-18)
