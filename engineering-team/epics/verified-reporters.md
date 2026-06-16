# Epic: Verified Reporters

**Status:** Active
**Book:** `engineering-team/audits/verified-reporters/book.md` (PRD-backed)
**Source PRD:** `product-team/prd/verified-reporters.md`
**Guides:** `product-team/guides/verified-reporters-design-guide.md`, `verified-reporters-style-guide.md` (+ `verified-reporters-wireframes.html`)

## What this is
The credible negative trust signal on the profile: a point-of-view-filtered count of the *verified* users (inside the viewer's web of trust) who have NIP-56-reported the observed account, plus a list of exactly who they are. The mirror of Verified Followers, swapping the follow relationship for the report relationship. Point of view is intrinsic: the number differs per viewer, with a House (default) fallback when the viewer has no calculated web of trust.

## Stories
`stories/verified-reporters/` — dependency-ordered (see `product-team/stories-queue.md`):

1. **verified-reporters-count** — elevate the existing per-PoV count into a clickable, negative-signal count in the profile counts row, linking to the list. *(done)*
2. **verified-reporters-membership-data** — the net-new data capability: the identities of the verified reporters under the viewer's PoV (so the list and count agree). *(done)*
3. **verified-reporters-list-page** — the `/user/:pubkey/reporters` page, mirroring the follows list, sorted by Rank desc, with PoV attribution. *(done)*
4. **reporters-report-type-and-timestamp-columns** — add **Report Type** + **Reported** (timestamp) columns to the reporters table, sourced from the `REPORTS` edge's `report_type`/`timestamp`; default columns → Picture/Report Type/Rank; Reported displays "ago" text but sorts by the raw unix integer; "N reporters, M reports" summary; report-centric (one row per edge, no de-dup). *(done — 2026-06-15, prod; ADR 0004)*

## ADRs
`decisions/verified-reporters/` — 0001 (count), 0002 (membership data), 0003 (list page), 0004 (report-type + timestamp columns).

## Related
- The `profile` epic (story 29, `profile-follows-list`) established the follows list + `DataTable` + "About this data" pattern this epic mirrors for the reporters list.

## Deferred (later phases, not this epic)
Report-type breakdown (Phase 2) — **partially shipped in #4**: each report's type + timestamp now surface per row; per-type filtering/grouping/breakdown UI is still deferred. Pile-on resistance (Phase 3); self-view privacy controls, web-of-trust education, and the shared counts-row PoV indicator (Phase 4); moderator / transaction-vetting surfaces (Phase 5).
