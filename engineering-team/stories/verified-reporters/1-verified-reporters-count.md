# Story 1: Verified Reporters count on the profile

**Status:** Done
**Created:** 2026-06-07
**Type:** Feature
**Epic:** `verified-reporters` · **Book:** `engineering-team/audits/verified-reporters/book.md`

## Background
A profile already shows positive trust signals (Following, Verified Followers). It shows no credible negative one. The data needed for the negative signal already exists: a per-point-of-view count of verified users who have NIP-56-reported the account is already computed and is shown today as a non-interactive figure on the profile. This story elevates that figure into a first-class, point-of-view-filtered count placed alongside the other counts, marked as a negative signal, and acting as the entry point to a list of *who* reported (built in later stories).

Source: `product-team/prd/verified-reporters.md` §5.1, §5.3, §11. Affects the primary persona (the Vetting Observer, deciding whether to engage a stranger) and the secondary persona (the Cautious Newcomer, who lands on the House fallback).

## User-facing description
As someone viewing a profile, I want to see — at a glance, alongside Following and Verified Followers — how many people inside my web of trust have reported this account, so that I have a credible warning signal before I engage, and a way to go look at who they are.

## Acceptance criteria
Testable from the outside. Each gets at least one test.

- [ ] Given a profile, when it loads, then a count labelled "Verified Reporters" appears in the counts row alongside Following and Verified Followers, computed under the viewer's effective point of view (their personal web of trust if available, otherwise the House default — the same point of view the other counts use).
- [ ] Given the count is greater than zero, then its value is shown as a negative signal (visually distinct from the positive/neutral counts) and the whole count is a link to `/user/:pubkey/reporters`.
- [ ] Given the count is exactly zero, then the value is shown neutrally (not as a warning) and is not a link.
- [ ] Given the count is unavailable or not yet computed, then a placeholder ("—") is shown, not a link, and is visually distinguishable from a real zero.
- [ ] Given the count is still loading, then a dimmed/placeholder value is shown (no bare spinner).
- [ ] Given any state, then the count's accessible name states the number and that it opens the list (for example, "3 verified reporters. View list.").

*(Six criteria, but a single cohesive surface — one count and its display states. Not split, because splitting one component's states across stories would fragment a unit that must be built and tested together.)*

## Concepts touched
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — nostr user (the observed user, the observer, and the reporters are all this concept in different roles).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:web-of-trust` — web of trust (the viewer's point of view that filters the count).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:graperank` — graperank (defines "verified": the same threshold Verified Followers uses).
- NIP-56 report — a nostr-event of kind 1984 (the underlying report behind the count). `nostr-event` / `nostr-kind` handles apply.

## Out of scope
- The list page itself (`/user/:pubkey/reporters`) — that is story 3 of this epic. Until it ships, the link target may be an unbuilt/empty page; that is acceptable within the epic sequence.
- The membership data behind the list (the reporter identities) — story 2.
- Any per-count or counts-row point-of-view indicator (e.g. a "House" marker). Deferred to a cross-cutting Phase 4 session that handles all three counts together (PRD §8.3 / §11 decision 5). The count carries no PoV chrome in this story.
- Splitting the count by NIP-56 report type (Phase 2); pile-on discounting (Phase 3); self-view privacy handling (Phase 4).
- Changing Following or Verified Followers themselves.

## Open questions
- **Placement parity (for the Architect, PRD §11 decision 1 — does not block approval):** the count must match Verified Followers' treatment *as it exists on this branch*. The decision is to match the staging reference (a count-link in the counts row). The Architect should confirm against the actual profile component on `feat/verified-reporters` (off `staging`) whether Verified Followers is currently a count-link or a trust card, and place Verified Reporters to match — elevating Verified Followers itself is out of scope.

## Deviations
- ADR 0001 enumerated four display states (loading / unavailable / zero / >0) as distinct branches. Implemented as a single `verifiedReporterCount > 0 ? <Link…> : <span…>` ternary: the non-link `<span>` covers loading, unavailable, and zero, because `fmtCount(verifiedReporterCount)` already renders `—` for null (loading/unavailable) and `0` for zero, and the `bsp-count-loading` dim is added to that span only when `trustLoading`. Same observable behavior as the ADR's four states, with less branching. ([ui/src/pages/BrainstormProfile.jsx](../../../ui/src/pages/BrainstormProfile.jsx))

## Linked artifacts
- PRD: `product-team/prd/verified-reporters.md` (§5.1, §5.3, §11); design guide `product-team/guides/verified-reporters-design-guide.md`; style guide `product-team/guides/verified-reporters-style-guide.md` (canonical copy — use the count label and accessible-name strings verbatim).
- ADR: `engineering-team/decisions/verified-reporters/0001-verified-reporters-count.md` (Accepted)
- Test plan: `engineering-team/stories/verified-reporters/1-verified-reporters-count.test-plan.md` (suite `test/profile-verified-reporters-count.test.js` + Playwright `tests/brainstorm/profile-verified-reporters-count.spec.js`)
- Review: `engineering-team/reviews/verified-reporters/1-verified-reporters-count.md` — **PASS** (2026-06-07)
