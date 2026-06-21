# Story 1: Verified Muters read API

**Status:** Done
**Created:** 2026-06-21
**Type:** Feature
**Epic:** `verified-muters` · **Book:** `engineering-team/audits/verified-muters/book.md`

## Background
The profile already surfaces a count of *verified* users who follow an account and a count of *verified* users who have reported it, each with a backing read path that lists exactly who they are. There is no equivalent for *muting*: nothing serves the count of verified users who have muted an account, and nothing serves the list of who they are. Without that backend, the planned Verified Muters profile surface (Story 2 — the badge, the list page, the line break) has no data to render.

This story provides that backend, and only the backend. It mirrors **Verified Followers** (not Verified Reporters): the same verification bar, and the same row shape — no report-specific fields. The count is served through the same profile-counts read path that already serves the verified-follower and verified-reporter counts, so all three travel together. The list read path is the muter analogue of the existing verified-follower / verified-reporter list read paths, and — like them — is owner/House point-of-view only in v1.

Source: the intake entry "2026-06-21 — Feature: Verified Muters profile metric (mirror of Verified Followers)" in `engineering-team/stories/_intake.md`, and the acceptance frame in `engineering-team/audits/verified-muters/book.md`.

## User-facing description
As someone building the Verified Muters profile surface, I want a backend that reports how many verified users have muted an account and which ones they are — served the same way and judged by the same verification bar as the existing verified-follower and verified-reporter data — so that the badge and list page (Story 2) have a count and a roster to render, and the badge number provably equals the list length.

## Acceptance criteria
Testable from the outside (input → expected behavior). Each gets at least one test.

- [ ] Given an account, when the profile-counts read path is requested for it, then the response includes a verified-muter count alongside the existing verified-follower and verified-reporter counts (it is no longer omitted), computed under the same verification bar — the GrapeRank cutoff for muters — that defines "verified" for the sibling counts.
- [ ] Given an account, when the verified-muters list read path is requested for it, then it returns the set of users who have muted that account **and** clear the verification bar; users who do not clear it are excluded, and each returned muter carries the **same row shape as the Verified Followers list** (identity plus the Rank/credibility metric) with **no** report-specific fields.
- [ ] Given an account, the size of the verified-muters list equals the verified-muter count served for that account under the same point of view (the list length and the count agree).
- [ ] Given an account with no verified muters, when the list read path is requested, then it returns a normal, successful empty result (not an error); and given a missing or malformed account identifier, the request is rejected with a clear error response (not a crash and not a silent empty success).
- [ ] Given a request from a non-owner / non-House observer, the verified-muters list read path is refused — the same owner/House-point-of-view-only restriction the existing verified-follower and verified-reporter list read paths enforce.

## Concepts touched
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — nostr user (the muted account and each muter).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:web-of-trust` — web of trust (the point of view that filters muters to "verified"; House/owner only in v1).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:graperank` — graperank (defines "verified" and supplies the Rank/credibility metric; the muter cutoff is the same mechanism Verified Followers/Reporters use).
- Mute list — a `nostr-event` of kind 10000 (the mute linking a muter to the muted account; the muter analogue of the kind-1984 report). The Architect resolves how mutes are read.

## Out of scope
- All frontend — the profile counts-row badge, the list page and its route, and the visual line break. That is Story 2.
- Per-point-of-view / customer muter counts. Owner/House point-of-view only in v1, matching the verified-follower and verified-reporter siblings; per-POV is the same deferred direction those detail read paths already document.
- Any muter alarm threshold or red-flag styling — the count and list are neutral, like Verified Followers (this is a backend story, so no styling at all here; flagged to keep the sibling-of-Followers framing intact).
- Report-specific columns on the muters list (no Report Type, no Reported timestamp) — the row shape is the Verified Followers list's, which has none.
- Any change to the existing Following / Verified Followers / Hops / Verified Reporters counts or their list read paths.
- Any change to mute ingestion, the `:MUTES` projection, the `verifiedMuterCount` precompute, or graperank config — all of that already exists and is consumed as-is.

## Open questions
- None blocking. The count = list-length invariant follows the verified-reporters precedent (the list is the literal inverse of the count computation, so they agree within the read path); as with the siblings, this is not a hard real-time guarantee against any separately-precomputed value, and tests should not assert real-time equality across distinct data sources.

## Linked artifacts
- ADR: `engineering-team/decisions/verified-muters/0001-verified-muters-read-api.md`
- Test plan: `engineering-team/stories/verified-muters/1-verified-muters-read-api.test-plan.md`
- Review: `engineering-team/reviews/verified-muters/1-verified-muters-read-api.md` — **PASS** (2026-06-21)
