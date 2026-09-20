# Book of Work: Shared Concepts Row Detail

**Slug:** shared-concepts-row-detail
**Status:** Open
**Opened:** 2026-09-20
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)** — the owner's ask of 2026-09-20, restated and confirmed at kickoff.

### Acceptance frame

- [ ] On the Active b-tags page, each row has a sub-panel that toggles open and closed, closed by default.
- [ ] An open panel shows the description from the DList Header — the **local** event, not the shared one — and the b-tag itself.
- [ ] The b-tag in the panel can be copied to the clipboard readily.
- [ ] The b-tag column is gone from the table itself, and b-tags are still findable through the filter box.
- [ ] The description is findable through the filter box too (added by the owner at the planning gate, 2026-09-20).
- [ ] The same treatment on the Active z-tags page.

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
- **Confidence at close:** *(set at close)*

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/shared-concepts-row-detail/audit.md`
- Product feedback: `engineering-team/audits/shared-concepts-row-detail/prd-seed.md`
