# Story 2: Verified Muters profile surface

**Status:** Draft
**Created:** 2026-06-21
**Type:** Feature
**Epic:** `verified-muters` · **Book:** `engineering-team/audits/verified-muters/book.md`

## Background
The user profile already shows a row of point-of-view-filtered metrics — Following, Verified Followers, Hops, Verified Reporters — and each metric links through to its own page listing the underlying users. Story 1 (Done) added the backend: the profile-counts read path now reports a verified-muter count alongside the verified-follower and verified-reporter counts, and a verified-muters list read path serves exactly who those muters are (mirroring Verified Followers — same verification bar, same row shape, no report-specific fields, owner/House point-of-view only). Nothing yet renders that data.

This story is the frontend surface that consumes it: a fifth counts-row metric, **Verified Muters**, positioned after Hops and before Verified Reporters, linking to its own list page. Verified Muters is a "bad" indicator like Verified Reporters, but the operator chose to convey that *only* through positioning — a visual line break separating the good indicators (Following, Verified Followers, Hops) from the bad ones (Verified Muters, Verified Reporters) — and to style the badge **neutrally, like Verified Followers**: always a plain link, no red alarm icon, no negative styling. The list page mirrors the Verified Followers list page in every delegated detail (title and empty-state copy, default-visible columns and default sort, and the URL path segment), so a viewer sees the same shape they already know from Verified Followers, just for the mute relationship.

Source: the acceptance frame in `engineering-team/audits/verified-muters/acceptance-frame.md`, and the frontend section of the intake entry "2026-06-21 — Feature: Verified Muters profile metric (mirror of Verified Followers)" in `engineering-team/stories/_intake.md`.

## User-facing description
As someone viewing a user's profile, I want to see how many *verified* users have muted that account — presented neutrally and grouped with the other negative signal — and to click through to a list of exactly who they are, so that I can read a profile's negative reputation signals the same familiar way I already read its verified followers.

## Acceptance criteria
Testable from the outside (observable UI behavior). Each gets at least one test.

- [ ] Given a profile with at least one verified muter, when its profile page is viewed, then the counts row shows a **Verified Muters** metric rendered **between the Hops metric and the Verified Reporters metric**, displaying a count equal to the number of rows on its linked list page.
- [ ] Given the profile page, the **Verified Muters** metric is a clickable link to a list page at its own bookmarkable URL — parallel to the existing Verified Followers and Verified Reporters profile sub-pages — and the existing Following / Verified Followers / Hops / Verified Reporters metrics, their links, and their pages are unchanged.
- [ ] Given the **Verified Muters** metric, when it is rendered, then it appears **neutrally, like Verified Followers** — always a plain clickable link, with no red alarm icon and no negative/red styling (it does not adopt any Verified Reporters alarm treatment).
- [ ] Given a desktop viewport width at which all five metrics would otherwise fit on one line, when the profile page is viewed, then a **visual line break** sits between Hops and Verified Muters, so that Following / Verified Followers / Hops render on one line and Verified Muters / Verified Reporters wrap to the line below.
- [ ] Given the Verified Muters list page for a profile, when it is viewed, then it shows the **same columns (and the same default sort) as the Verified Followers list page** — with **no** report-specific columns (no "Report Type", no "Reported" timestamp) — and a profile with no verified muters renders a normal empty list page (the same empty-state treatment as Verified Followers), not an error.

## Concepts touched
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — nostr user (the observed account and each muter shown on the list page).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:web-of-trust` — web of trust (the point of view that filters muters to "verified"; House/owner only in v1).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:graperank` — graperank (supplies the Rank/credibility metric shown in the shared follower-shaped columns).

## Delegated micro-decisions (resolved: mirror Verified Followers)
The book delegates these small choices to be resolved by **mirroring the Verified Followers list page** — treat that as the decided answer, not an open question:
- **List page title and empty-state copy:** the Verified Followers list page's, adapted to "muters".
- **Default-visible columns and default sort:** identical to the Verified Followers list page (identity plus the Rank/credibility metric; no report-specific columns).
- **URL path segment:** the muter analogue of the Verified Followers list page's path segment, following the same scheme.

## Out of scope
- The backend — the profile-counts read path and the verified-muters list read path. Done in Story 1; this story only consumes them.
- Per-point-of-view / customer muter counts. Owner/House point-of-view only in v1, matching the verified-follower and verified-reporter siblings; the `?pov=` param does not alter these counts in this book.
- Any muter alarm threshold or red-flag styling — the badge is neutral, like Verified Followers; the Verified Reporters red-alarm treatment is explicitly not ported.
- Report-specific columns on the muters list (no Report Type, no Reported timestamp).
- Any change to the existing Following / Verified Followers / Hops / Verified Reporters metrics, their links, or their list pages.
- Staging deployment and Tier-4 rendered-UI evidence (acceptance-frame bullet 8) — that is the **book's** final cross-story verification at deploy, not a per-story unit-test criterion for this story.

## Open questions
- None. The frame and intake settle the product intent; the delegated copy/columns/sort/path choices are resolved by mirroring the Verified Followers page (see above).

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
