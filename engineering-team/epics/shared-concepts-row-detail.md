# Epic: Shared Concepts Row Detail

**Status:** Active
**Provenance:** Owner request in session 2026-09-20 (no intake entry — the request went straight into a story, per workflow 0-intake step 1). Book anchor at `engineering-team/audits/shared-concepts-row-detail/book.md` (acceptance-frame book, opened 2026-09-20).

## What this is

The two "Active …-tags" pages under Shared Concepts each lead with a raw wire identifier. On
Active b-tags the `b-tag` column carries a full a-tag coordinate — a kind, a 64-character pubkey
and a slug — in every row; on Active z-tags the `z-tag` column carries the same shape. The column
is the widest on the page and the least readable thing on it, and it is there because the value
has to be *available*, not because it has to be *read*.

Meanwhile the one piece of prose that would tell a reader what a row actually is — the DList
Header's description — is not shown at all, though it is already carried on the events these
pages read.

This epic trades the two: the wire identifier moves into a per-row panel that is closed by
default and can be copied in one action when it is opened, and the space it vacated goes to the
human-readable columns. Nothing is fetched that was not already fetched, and nothing leaves the
page — the identifier stays reachable, and stays findable through the filter box.

Like `shared-concepts-legibility` before it, the work is display and vocabulary, not new
capability.

## Stories
`stories/shared-concepts-row-detail/`:
1. **row-detail-panels-on-active-tag-pages** — the per-row disclosure panel on both Active b-tags
   and Active z-tags: description + copyable tag value, tag column retired from both tables,
   both tag values still matched by the filter box. *(this story)*

## Concepts touched
- `39998:<TA>:concept-header` — concept header (the kind-39998 event behind every row on both
  pages; the source of both the description and, on Active z-tags, the row's identity).
- `39998:<TA>:shared-concept` — shared concept (what a b-tag points at, and what a z-tag files
  under; the subject matter of both pages).

The `<TA>` segment is **per-deployment** and resolved at runtime — see CLAUDE.md § "Per-deployment
TA pubkey". On this dev instance it reads `11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767`;
that value is not portable and must not be written into code.

## Out of scope (epic-level)
- Any change to which rows either page shows, how they are counted, ordered, or filtered by point
  of view.
- Any change to the b-tag detail (pair) page.
- Any new fetch, endpoint, or wire-format change.
- Extending the panel to other tables in the app.
