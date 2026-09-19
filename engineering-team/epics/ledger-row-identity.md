# Epic: ledger-row-identity

**Created:** 2026-09-19
**Status:** Active
**Book:** `engineering-team/audits/ledger-row-identity/book.md`
**Provenance:** work packet `h-ledger-identity` (operator's 2026-09-13 `/whats-open` triage);
`OPEN.md` rows 151, 207, 307; `engineering-team/stories/_intake.md` 2026-07-28 — "OPEN.md
file-per-row migration (kill the last flat counter)".

## Goal

A ledger row's id can be minted by any session without asking anyone, and never changes once it is
written down — so merges stop renumbering and a citation always means the row its author meant.

## Why it matters

`OPEN.md` row ids are the repo's last flat global counter. Stories and ADRs left that scheme on
2026-06-04, when numbering became per-epic after three collisions. The ledger stayed, and with many
sessions running in parallel it now collides routinely: `origin/staging` records eleven separate
renumbering or de-duplication events between 2026-08-07 and 2026-09-18, ten of them after row 151
wrote down the "fetch before you mint" rule. Each one spends a merge or a review round, and a
renumber can leave a citation that still resolves — to the wrong row (row 207).

## Why a new epic

The 2026-07-28 intake proposal suggested reactivating `harness-self-improvement`. That epic is
`Done` under a Closed book, so reactivating it trips harness-lint L2's reopen blind spot (rows 129
and 322) and needs a run-scoped waiver, a CHANGELOG row and a removal at close. A new epic costs
this file. Same choice as `honest-test-gate` (2026-09-12).

## Stories

`stories/ledger-row-identity/`:

1. **collision-free-ledger-row-ids** — ids that need no coordination to mint and never change;
   existing ids and citations keep resolving; duplicates caught by lint. Rows 151, 207, 307.
   **Approved.** Design: ADR 0001 (date+slug ids; new rows are files under `ledger/`; the numbered
   table frozen in place), accepted 2026-09-19. Implementation is a later packet.
2. **meta-count-pipes** — open meta rows whose text contains a pipe are counted, listed and aged
   like any other (rows 70 and 244 are missing today). Bug; the first half of row 290. **Done.**
   Lands before #1 is implemented, so that #1's before-and-after check starts from a correct count
   (ADR 0001 § Consequences, follow-up 1).

## Out of scope (whole epic)

- Merge conflicts at the tail of `engineering-team/CHANGELOG.md` and `_intake.md`. Neither file has
  ids, so they share the ledger's append conflict but not its collision problem.
- Working through the open rows themselves, or the meta backlog.
- Story and ADR numbering, which is already per-epic.

## Related

- `engineering-team/CHANGELOG.md` 2026-06-04 — the epic-folders migration, the precedent for
  retiring a flat counter.
- `OPEN.md` § "How to use this ledger" and the four numbering notes inside the table
  (2026-07-15, 2026-07-18, 2026-07-22, 2026-07-24).
