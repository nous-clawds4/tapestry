# Story 3: Verified Reporters list page

**Status:** Approved
**Created:** 2026-06-07
**Type:** Feature
**Epic:** `verified-reporters` · **Book:** `engineering-team/audits/verified-reporters/book.md`

## Background
Story 1 shipped the Verified Reporters count on the profile (a link when > 0). Story 2 shipped the data — the verified users who reported an account, under the House point of view. This story is the surface that ties them together: a dedicated page that lists *who* those reporters are, so the observer can weigh them. It is the link target of the count and the consumer of the membership data. With it, the feature is complete end to end.

Source: `product-team/prd/verified-reporters.md` §5.2, §5.3; `product-team/stories-queue.md` (Story 3). Serves the Vetting Observer (inspect and weigh the reporters) and the Cautious Newcomer (the point-of-view attribution lives here). It is a deliberate mirror of the existing Followers list.

## User-facing description
As someone who saw that trusted people reported an account, I want a page that shows exactly which verified users reported it — most credible first, each clickable through to their profile — and that tells me plainly whose web of trust the list reflects, so I can judge how much weight the warning deserves.

## Acceptance criteria
Testable from the outside (input → expected behavior).

- [ ] Visiting `/user/:pubkey/reporters` shows a page titled "Verified Reporters", a back link to the profile (`/user/:pubkey`), and the description "Verified users who have reported this account."
- [ ] The page lists the verified reporters of that account, defaulting to the columns picture, name, and Rank, sorted by Rank descending (most credible first).
- [ ] Selecting a reporter navigates to that reporter's own profile.
- [ ] The number of rows equals the verified-reporter count for that account under the same (House) point of view.
- [ ] The page states whose point of view is in effect — "Relative to your web of trust." (personal) or the House line — and an "About this data" control explains the data is computed locally by this instance and that counts are personal, with no single global number.
- [ ] When the account has no verified reporters, the page shows the empty state "No verified reporters. No one in this web of trust has reported this account." — not a blank screen and not an error.
- [ ] While loading, a skeleton placeholder is shown (no bare spinner); on failure, a helpful message with a retry control is shown (never "Something went wrong").

## Concepts touched
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — nostr user (the reported account and each reporter row).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:web-of-trust` — web of trust (the point of view the list and its attribution reflect).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:graperank` — graperank (the Rank/credibility shown per reporter).

## Out of scope
- The profile count and its link (Story 1, done) and the membership data/endpoint (Story 2, done) — this story consumes them; it does not re-build them.
- Personalized / customer point-of-view (deferred, consistent with ADR 0002 and the follows/followers precedent). v1 is House/owner point of view; the personal point-of-view line is shown when applicable but personalized membership is not computed here.
- Splitting the list by NIP-56 report type (Phase 2); pile-on discounting (Phase 3).
- Any change to the profile count, the Following/Verified Followers counts, or the follows/followers pages.

## Open questions
- **count = list length, restated (resolved by ADR 0002):** the page's row count should equal the count the membership endpoint reports (which equals `data.length`). It is *not* a hard real-time guarantee against the precomputed Meili count shown on the profile badge — so the page should present its own (live) count as the header and copy/tests must not assert real-time equality with the profile badge. The Architect carries this into the page design.

## Linked artifacts
- PRD: `product-team/prd/verified-reporters.md` (§5.2, §5.3); design guide `product-team/guides/verified-reporters-design-guide.md`; style guide `product-team/guides/verified-reporters-style-guide.md` (use the title, description, point-of-view lines, empty-state, error, and "About this data" copy verbatim).
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
