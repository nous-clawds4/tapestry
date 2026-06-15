# Story 4: Report Type and Timestamp columns on the Verified Reporters list

**Status:** Approved
**Created:** 2026-06-15
**Type:** Feature
**Epic:** `verified-reporters` · **Book:** `engineering-team/audits/verified-reporters/book.md`

## Background
The Verified Reporters list page (`/user/:pubkey/reporters`, Story 3) shows *who* reported an account, sorted by Rank. Unlike follows or mutes, a NIP-56 report carries two facts the table currently throws away: **what kind** of report it is (`report_type`) and **when** it was filed (`timestamp`). Both already live on the neo4j `REPORTS` relationship between reporter and reported account; the list query just doesn't surface them. Exposing them lets an observer weigh a warning by its nature ("spam" vs "impersonation") and its recency. This is the epic's deferred Phase-2 "report-type breakdown," scoped here to *surfacing type and time per row* (not filtering/grouping).

This story makes the list **report-centric**: one row per report rather than one per distinct reporter (the user's explicit choice). A reporter who filed more than one report against the account therefore appears once per report. This relaxes Story 3's "rows = verified-reporter count" expectation by design. To keep that distinction legible rather than confusing, the page shows a summary line — e.g. **"8 reporters, 10 reports"** — so an observer who notices the row count differs from the profile's Verified Reporters count understands why. The profile count badge itself is not changed by this story.

**Decision — no client-side de-duplication.** The table faithfully renders one row per `REPORTS` edge returned by the query; it does not merge or de-duplicate rows. Eliminating genuine duplicates (e.g. two identical "Alice reports Bob of impersonation" edges) is neo4j's responsibility. If duplicates leak through today — or multi-report support isn't fully in place yet — surfacing them here is *intended*: the table becomes a faithful 1:1 mirror of the graph, which makes any such bug visible rather than hiding it.

## User-facing description
As someone weighing a report-based warning on an account, I want to see what type each report is and how long ago it was filed — and to sort by recency — so that I can judge the nature and freshness of the signal, not just who raised it. I also want the page to tell me how many distinct reporters versus how many reports it represents, so a count that differs from the profile badge isn't confusing.

## Acceptance criteria
Testable from the outside (input → expected behavior).

- [ ] Given a first-time visitor with no saved column preference, when the reporters page loads, the **default visible columns are Picture, Report Type, and Rank** (Name is no longer visible by default); **Name, Reported, and the previously-available columns remain selectable** in the column chooser, and toggling persists as before.
- [ ] Given a row whose report has a `report_type`, the **Report Type** cell shows a humanized label (e.g. `spam` → "Spam", `impersonation` → "Impersonation", `other` → "Other").
- [ ] Given the time column (header **"Reported"**) and a row whose report has a `timestamp`, the cell shows the elapsed time as a relative "time ago" string in years/days/hours/minutes, e.g. `3d, 4h, 12m ago`.
- [ ] Given the table sorted by the **Reported** column, rows are ordered by the **raw unix timestamp integer** (numeric), not by the displayed "ago" text — newest-first and oldest-first both order correctly.
- [ ] Given a row whose report has **no `report_type`**, the Report Type cell renders **empty** (no "undefined", no error). Given a row with **no `timestamp`**, the Reported cell renders empty, and such rows **sort below all rows that have a timestamp, in both ascending and descending order**.
- [ ] Given a reporter who has filed more than one report against the account, the table shows **one row per report** (each with its own type and timestamp). The table performs **no client-side de-duplication or merging** — it renders one row per `REPORTS` edge the query returns.
- [ ] Given a non-empty list, the page shows a **summary of distinct reporters and total reports**, e.g. **"8 reporters, 10 reports"** (distinct reporter pubkeys vs. total report rows), with correct singular/plural; when every reporter has exactly one report the two numbers are equal.
- [ ] The Follows and Followers list pages still default to Picture / Name / Rank — they are unaffected.

## Concepts touched
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:nostr-user` — nostr user (the reported account and each reporter row).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:web-of-trust` — web of trust (the point of view the list reflects).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:graperank` — graperank (the Rank shown per row).
- *(not modeled as a named concept)* the `REPORTS` relationship and its `report_type` / `timestamp` properties — Architect to resolve against the neo4j data model.

## Out of scope
- Changing the profile **Verified Reporters count badge** or its semantics (Story 1). The badge counts distinct reporters under PoV; this report-centric list may show more rows. The summary line explains the difference; the badge is not reconciled or altered here.
- Filtering, grouping, or a breakdown UI by report type (later); pile-on discounting (Phase 3).
- The Follows / Followers pages and any shared count behavior beyond leaving them unchanged.
- Personalized / customer point of view — list stays House/owner, consistent with the epic.
- Absolute-time tooltips, seconds granularity, or localized date formatting — relative years/days/hours/minutes only.
- Client-side de-duplication of report rows (see Background decision).

## Open questions
- None blocking. (Cardinality of `REPORTS` edges is intentionally not gated on — the table mirrors whatever the graph returns. Membership-endpoint behavior confirmed: binding the relationship to return its properties adds per-report fields without changing which reporters appear.)

## Linked artifacts
- ADR: `engineering-team/decisions/verified-reporters/0004-reporters-report-type-and-timestamp-columns.md` (Accepted)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
