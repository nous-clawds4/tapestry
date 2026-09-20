# Book of Work: Ledger row ids that cannot collide

**Slug:** ledger-row-identity
**Status:** Closed
**Opened:** 2026-09-19 — eagerly, at intake, before the story is approved.
**Closed:** 2026-09-20 — both stories Done and live on `staging` (PR #691; PR #697, deploy run 35487312546); all six acceptance-frame bullets verified at close; operator-ratified close. Audit + PRD seed under this dir. Not promoted to `main` (the operator's decision, 2026-09-20).
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

- [x] Two sessions that cannot see each other's work can each add a ledger row, and the two rows
      never end up with the same id.
- [x] No merge ever has to change an id that was already written down, so a citation always means
      the row its author meant.
- [x] Every row id and every citation that exists today keeps resolving to the same row, without
      anyone editing the citation.
- [x] `/whats-open`, the session-start digest and the meta escalation report the same open items
      after the change as before it.
- [x] A duplicate id is caught by `harness-lint`, not by a late review round.
- [x] `OPEN.md` rows 151, 207 and 307 are flipped DONE, and the 2026-07-28 intake entry is marked.

*Ticked at close, 2026-09-20, each against a command (audit §4 lists what was run). Bullets 1 and 2
hold as ADR 0001 reads them: an id is fixed once it is on `staging`, and two branches that mint the
same id are stopped by git at the merge, where the one that has not landed renames its file — audit
§4, deviation 1.*

## Epics in this book

- `ledger-row-identity` (`epics/ledger-row-identity.md`) — how a ledger row gets its id, and what
  that id promises. New epic opened for this book.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** high — the frame was opened eagerly at intake (`9a318fb0`), never edited, and each bullet was re-derived from a command at close. What is thin is field time, not evidence: no two branches had yet minted rows in parallel on `staging` when the book closed (audit §5).

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/ledger-row-identity/audit.md`
- Product feedback: `engineering-team/audits/ledger-row-identity/prd-seed.md`
