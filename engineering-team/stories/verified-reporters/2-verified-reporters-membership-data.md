# Story 2: Verified reporters membership data

**Status:** Approved
**Created:** 2026-06-07
**Type:** Feature
**Epic:** `verified-reporters` · **Book:** `engineering-team/audits/verified-reporters/book.md`

## Background
Story 1 shipped the Verified Reporters *count* on the profile, reusing a per-point-of-view count that already exists in the data layer. But the *membership* behind that count — *which* verified users reported the account — does not exist yet. Without it, the list page (Story 3) has nothing to render, and there is no way to prove the count equals what a viewer would actually see.

This story provides that membership: given an account and a viewer's point of view, the set of verified users who have filed a NIP-56 report against that account. It is the net-new data need identified in the PRD (§7): the count exists; the identities do not.

Source: `product-team/prd/verified-reporters.md` §5.2, §6, §7; `product-team/stories-queue.md` (Story 2). Serves the Vetting Observer (who needs to weigh *who* reported). Unblocks Story 3 (the list page).

## User-facing description
As someone inspecting an account's verified reporters, I want the list of *which* trusted users reported it — each with enough identity to judge their credibility — so that the count I saw on the profile becomes an inspectable, weighable list rather than a bare number.

## Acceptance criteria
Testable from the outside (input → expected behavior).

- [ ] Given an account and a point of view, the capability returns the set of users who have filed a NIP-56 report against that account **and** are verified within that point of view; users who are not verified within that point of view (unverified / sybil reporters) are excluded.
- [ ] Each returned reporter includes enough identity to display and weigh them: a stable identifier and the reporter's credibility (Rank) metric.
- [ ] The size of the returned set equals the verified-reporter count shown for that account under the **same** point of view (the list length and the count agree).
- [ ] When the viewer has no calculated point of view, the set is resolved under the House (default) point of view.
- [ ] When the account has no verified reporters under the point of view, the result is an empty set — a normal, successful empty result, not an error.
- [ ] A missing or malformed account identifier is rejected with a clear error response, not a crash and not a silent empty success.

## Concepts touched
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — nostr user (the reported account and each reporter).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:web-of-trust` — web of trust (the point of view that filters reporters to "verified").
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:graperank` — graperank (defines "verified" and supplies the Rank/credibility metric).
- NIP-56 report — a `nostr-event` of kind 1984 (the report linking a reporter to the reported account). The Architect resolves how reports are read.

## Out of scope
- The list page UI and route (`/user/:pubkey/reporters`) — that is Story 3.
- The profile count surface — shipped in Story 1.
- Splitting or filtering by NIP-56 report type — all types counted/listed together (Phase 2).
- Pile-on detection / discounting of pile-on-prone reporters (Phase 3).
- Arbitrary third-party observer selection beyond the viewer's own point of view or the House fallback (mirrors the follows v1 deferral).

## Open questions
- **Count = list-length invariant (for the Architect):** the membership must be derived from the **same** "verified within this point of view" definition that already produces the verified-reporter *count* shown in Story 1, so the two cannot disagree. The Architect should confirm the membership query and the existing count come from one source of truth (same threshold, same point-of-view resolution), and call out if they cannot, since AC3 depends on it.

## Linked artifacts
- PRD: `product-team/prd/verified-reporters.md` (§5.2, §6, §7)
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
