# Book of Work: ORE Client Parity

**Slug:** ore-parity
**Status:** Closed
**Opened:** 2026-08-15
**Closed:** 2026-08-16

## Intent anchor

**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed at kickoff (2026-08-15
session): npub.world's provider validation fails against the R&D instances with
`no algorithms registered in the mandatory /rank/pubkeys` while the NosFabrica instances validate
green; bring the R&D instances to validation success and endpoint parity ("1+2": the mandatory
ORE-03, plus ORE-06/07).

### Acceptance frame

- [x] **Mandatory conformance:** `/rank/pubkeys` (ORE-03, global `graperank`) is implemented and
      registered in the capability document; the official `open-ranking` JS SDK's
      `validateCapabilities()` accepts the document, and npub.world's Validate succeeds against
      `staging.brainstorm.world` — and against `tapestry.brainstorm.world` after production
      promotion. *(Story 1; PRs #554/#555; npub.world verified green on both instances
      2026-08-16, in the real Validate dialog.)*
- [x] **Parity:** `/followers` (ORE-06) and `/muters` (ORE-07) are implemented and registered
      (global algorithms), matching the endpoint surface the NosFabrica instances advertise —
      except `pov: true` variants, which stay deliberately gated (worksheet W12, ADR
      open-ranking/0005). *(Story 2; PRs #556/#557; npub.world's Followers row ✓ on both
      instances — the identical checked set NosFabrica reports.)*
- [x] **Honesty preserved:** the capability document never advertises an unimplemented endpoint or
      a gated personalized algorithm (the ORE-01 no-drift rule). *(Registry-driven doc throughout;
      each endpoint registered in the same story that implemented it; SDK conformance pinned in
      the hermetic suites.)*
- [x] **Verified:** locally and on staging; production promotion remains the operator's explicit
      call. *(Both stories: cycle-local with seeded-data proofs + staging smoke; both production
      promotions individually operator-approved.)*

## Epics in this book
- `ore-parity` — ORE-03 `/rank/pubkeys` (mandatory conformance) + ORE-06/07 `/followers`,`/muters`
  (NosFabrica parity), global algorithms only. *(Done, retired 2026-08-16.)*

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high — anchored frame; every bullet verified in-session against the
  live instances *and* in the real npub.world client, with the originating error reproduced under
  test (the SDK conformance check) so it cannot silently return.

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/ore-parity/audit.md`
- Product feedback: `engineering-team/audits/ore-parity/prd-seed.md`
