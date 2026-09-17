# Book of Work: ORE POV Availability

**Slug:** ore-pov-availability
**Status:** Closed
**Opened:** 2026-08-12
**Closed:** 2026-08-13

## Intent anchor

**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed at kickoff (2026-08-12 session): adopt [Open-Ranking/protocol#8](https://github.com/Open-Ranking/protocol/issues/8) "Solution 1" — when personalized scores are requested for a POV the provider cannot serve, return an explicit error; never silently fall back to the global/house view.

### Acceptance frame

- [x] **Never-substitute, informatively:** with the personalized-stats gate ON, a personalized request for a POV this instance cannot serve returns `422` with an `X-Reason` that explains the unavailability and points at a usable alternative; no response ever carries another POV's scores under the caller's label. Gate-OFF (shipped default) behavior is byte-for-byte unchanged (ADR `open-ranking/0005` anti-oracle).
- [x] **Upstream proposal ready:** an in-repo, submission-ready ORE-01 spec change + PR title/description (issue #8 Solution 1: error, `X-Reason`, never substitute; `202`/`Retry-After` cross-referenced for still-computing POVs) that the operator can submit as **wds4** without editing.
- [x] **Documented:** `/developers/open-ranking` states the contract and the client's recovery path.
- [x] **Tracked:** worksheet **W12** records the upstream proposal and its status.
- [x] **Verified:** locally and on staging; production promotion remains the operator's explicit call. NosFabrica adoption is outside this book.

## Epics in this book
- `ore-pov-availability` — error-on-unavailable-POV: upstream proposal + local alignment + docs.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high — anchored frame, every bullet verified in-session (tests + local e2e + staging/prod smoke); staging gate-on demo substitution operator-ratified 2026-08-13

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/ore-pov-availability/audit.md`
- Product feedback: `engineering-team/audits/ore-pov-availability/prd-seed.md`
