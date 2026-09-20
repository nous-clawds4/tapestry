# Book of Work: Profile lookups that scale with the page

**Slug:** profile-lookup-bounds
**Status:** Open
**Opened:** 2026-09-08
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD).** The ask, restated and confirmed at kickoff 2026-09-08.
Re-confirmed against current `staging` on 2026-09-20 after a twelve-day gap; the frame is
unchanged, the measurements behind it have moved (see the story's Background).

### Acceptance frame

- [ ] On a control-panel page with many distinct authors, **every** author cell shows a real
      display name where the author has a published profile — not a truncated pubkey.
      Confirmed against `/tapestry/lists/items`, which shows 288 truncated cells today
      (226 on 2026-09-07).
- [ ] The lookup keeps working as the number of distinct authors grows, rather than working
      up to a threshold and then silently degrading.
- [ ] When a lookup genuinely fails, the page says so — including when the failure carries no
      readable body. A degraded view is never presented as a complete one.
- [ ] The lookup endpoint still refuses an abusive single request, and does so in a way the
      caller can interpret and act on.
- [ ] Pages that work today keep working, with the same names they show today.

## Epics in this book
- `profile-lookup-bounds` — the shared profile lookup and the endpoint's refusal contract.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high
