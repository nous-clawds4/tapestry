# Book of Work: ORE Client Parity

**Slug:** ore-parity
**Status:** Open
**Opened:** 2026-08-15
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed at kickoff (2026-08-15
session): npub.world's provider validation fails against the R&D instances with
`no algorithms registered in the mandatory /rank/pubkeys` while the NosFabrica instances validate
green; bring the R&D instances to validation success and endpoint parity ("1+2": the mandatory
ORE-03, plus ORE-06/07).

### Acceptance frame

- [ ] **Mandatory conformance:** `/rank/pubkeys` (ORE-03, global `graperank`) is implemented and
      registered in the capability document; the official `open-ranking` JS SDK's
      `validateCapabilities()` accepts the document, and npub.world's Validate succeeds against
      `staging.brainstorm.world` — and against `tapestry.brainstorm.world` after production
      promotion.
- [ ] **Parity:** `/followers` (ORE-06) and `/muters` (ORE-07) are implemented and registered
      (global algorithms), matching the endpoint surface the NosFabrica instances advertise —
      except `pov: true` variants, which stay deliberately gated (worksheet W12, ADR
      open-ranking/0005).
- [ ] **Honesty preserved:** the capability document never advertises an unimplemented endpoint or
      a gated personalized algorithm (the ORE-01 no-drift rule).
- [ ] **Verified:** locally and on staging; production promotion remains the operator's explicit
      call.

## Epics in this book
- `ore-parity` — ORE-03 `/rank/pubkeys` (mandatory conformance) + ORE-06/07 `/followers`,`/muters`
  (NosFabrica parity), global algorithms only.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/ore-parity/audit.md`
- Product feedback: `engineering-team/audits/ore-parity/prd-addendum.md` | `prd-seed.md`
