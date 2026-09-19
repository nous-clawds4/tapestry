# Book of Work: Ledger row ids that cannot collide

**Slug:** ledger-row-identity
**Status:** Open
**Opened:** 2026-09-19 — eagerly, at intake, before the story is approved.
**Closed:** —
**Mode:** Human-gated. The operator holds every phase gate.

## Intent anchor

**Acceptance frame (no PRD).** The ask is work packet `h-ledger-identity` from the operator's
2026-09-13 `/whats-open` triage: *stop ledger row numbers from colliding — design first.* Its
sources are `OPEN.md` rows 151, 207 and 307 and the queued proposal in
`engineering-team/stories/_intake.md` (2026-07-28, "OPEN.md file-per-row migration"). The packet
splits the work in two: a first session delivers Planning and Architecture and stops for the
operator; implementation is a later packet against the approved ADR. The operator confirmed the
frame below at the Planning gate on 2026-09-19.

### Acceptance frame

- [ ] Two sessions that cannot see each other's work can each add a ledger row, and the two rows
      never end up with the same id.
- [ ] No merge ever has to change an id that was already written down, so a citation always means
      the row its author meant.
- [ ] Every row id and every citation that exists today keeps resolving to the same row, without
      anyone editing the citation.
- [ ] `/whats-open`, the session-start digest and the meta escalation report the same open items
      after the change as before it.
- [ ] A duplicate id is caught by `harness-lint`, not by a late review round.
- [ ] `OPEN.md` rows 151, 207 and 307 are flipped DONE, and the 2026-07-28 intake entry is marked.

## Epics in this book

- `ledger-row-identity` (`epics/ledger-row-identity.md`) — how a ledger row gets its id, and what
  that id promises. New epic opened for this book.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/ledger-row-identity/audit.md`
- Product feedback: `engineering-team/audits/ledger-row-identity/prd-seed.md`
