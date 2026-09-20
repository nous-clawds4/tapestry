# Book of Work: Shared Concepts Row Detail

**Slug:** shared-concepts-row-detail
**Status:** Closed
**Opened:** 2026-09-20
**Closed:** 2026-09-20

## Intent anchor

**Acceptance frame (no PRD)** — the owner's ask of 2026-09-20, restated and confirmed at kickoff.

### Acceptance frame

- [x] On the Active b-tags page, each row has a sub-panel that toggles open and closed, closed by default.
- [x] An open panel shows the description from the DList Header — the **local** event, not the shared one — and the b-tag itself.
- [x] The b-tag in the panel can be copied to the clipboard readily.
- [x] The b-tag column is gone from the table itself, and b-tags are still findable through the filter box.
- [x] The description is findable through the filter box too (added by the owner at the planning gate, 2026-09-20).
- [x] The same treatment on the Active z-tags page.
- [x] Muted text actually renders muted (added by the owner at the Architecture gate, 2026-09-20 —
      the class is used app-wide and defined nowhere).

### Frame notes (confirmed in-session)

- **"Local, not shared" resolves differently on the two pages.** Active b-tags builds each row
  from a locally-authored DList Header that carries the b-tag, so "the local event's description"
  is a real choice against a real alternative. Active z-tags builds each row from a
  *foreign-authored* header that local events point at — there is no local event behind the row,
  so the only description available is that header's own. Noted and accepted at kickoff rather
  than treated as a contradiction of the frame.
- **The row click on Active b-tags already has a destination** (the b-tag pair page). The
  disclosure control is additive; it does not take the row click over.

## Epics in this book
- `shared-concepts-row-detail` — the per-row disclosure panel on the two Active …-tags pages.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** **high** — the anchor was eager (written at intake, before code), confirmed with the owner in-session, and both amendments were recorded in this file at the moment they were made. All seven bullets verified in production at `440600b3`.

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/shared-concepts-row-detail/audit.md`
- Product feedback: `engineering-team/audits/shared-concepts-row-detail/prd-seed.md`
