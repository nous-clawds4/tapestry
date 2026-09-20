# Book of Work: Profile lookups that scale with the page

**Slug:** profile-lookup-bounds
**Status:** Closed
**Opened:** 2026-09-08
**Closed:** 2026-09-20

## Intent anchor

**Acceptance frame (no PRD).** The ask, restated and confirmed at kickoff 2026-09-08.
Re-confirmed against current `staging` on 2026-09-20 after a twelve-day gap; the frame is
unchanged, the measurements behind it have moved (see the story's Background).

### Acceptance frame

- [x] On a control-panel page with many distinct authors, **every** author cell shows a real
      display name where the author has a published profile — not a truncated pubkey.
      *Met, but NOT confirmable on the surface this bullet named: on staging those authors have no
      published profile at all, so the page's cells stay truncated — correctly. Verified instead by
      sampling authors that do have one: 5/5 resolved in 0.8 s. See audit §4 #1.*
- [x] The lookup keeps working as the number of distinct authors grows, rather than working
      up to a threshold and then silently degrading.
- [x] When a lookup genuinely fails, the page says so — including when the failure carries no
      readable body. A degraded view is never presented as a complete one.
- [x] The lookup endpoint still refuses an abusive single request, and does so in a way the
      caller can interpret and act on.
- [x] Pages that work today keep working, with the same names they show today.

## Epics in this book
- `profile-lookup-bounds` — the shared profile lookup and the endpoint's refusal contract.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high

## Close artifacts
- Build audit: `engineering-team/audits/profile-lookup-bounds/audit.md`
- Product feedback: `engineering-team/audits/profile-lookup-bounds/prd-seed.md`
