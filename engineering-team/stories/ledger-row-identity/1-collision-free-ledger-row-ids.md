# Story 1: Ledger row ids that cannot collide

**Status:** Approved
**Created:** 2026-09-19
**Type:** Feature

## Background

`OPEN.md` gives each row the next whole number. To mint one, a session has to know the highest
number anywhere — a fact no session can have while others are working in parallel. Two sessions
each take "highest plus one", both are right when they look, and the merge finds two rows with one
number.

The cost is not the duplicate itself but what fixing it does. One row is renumbered, and every
citation of it has to be found and repointed. Miss one and nothing fails: the stale citation still
resolves, to a different, real, plausible row (row 207).

Measured on `origin/staging` `38a1488f`, 2026-09-19:

| Fact | Value |
|---|---|
| Rows in the ledger | 328 (ids 1–329; 257 is a gap left by an earlier renumber) |
| Separate renumbering or de-duplication events, 2026-08-07 → 2026-09-18 | 11 |
| …of those, after row 151 wrote down "fetch `origin/staging` before you mint" | 10 |
| Shortest recorded window between a correct look and a collision | 19 minutes (row 307, fourth occurrence) |
| Citations that name the ledger outright ("OPEN.md row N", "OPEN.md #N") | 1,638 in 529 files |
| Bare "row N" citations (sampled: mostly the ledger) | about 1,080 |
| `#N` tokens in tracked markdown — PRs, stories and ledger rows share the form | about 6,600 |
| Commit-message lines that cite a row (cannot be edited) | 562 |
| Citations outside the repo | PR bodies; the operator's Loose Threads board (47 packets) |

The events: `4b32b53f` (148→150, inside a promotion merge — row 151), `b1b1a429` (183→184),
`fc555bc8` (192–195→198–201), `0d46668c` (181/182/184, with the missed citation repaired by
`043160d0` — row 207), merges `1c03909b`, `a9840c14`, `22fe7f28` and `0da8dce9` (each "OPEN.md rows
renumbered"), `e9fc3f99` (a whole book's rows), `da759e57` (74–77→317–320) and `b2e71921` (323→325,
found in a review round). Earlier ones, from July, survive only as notes. The table now carries
fifteen prose notes about its own numbering: renumber records, a reservation that went stale, and
eight "origin stood at N when I looked" attestations. Row 307 records four occurrences with four
different causes.

Two things follow. The interim rule cannot work: the window that matters is the life of a branch,
not the age of a fetch. And renumbering cannot be made safe: no sweep can tell a ledger `#230` from
PR #230, and hundreds of citations sit where no sweep reaches.

Who is affected: every session that files a loose end, every reviewer who spends a round checking
for collisions, and the operator, who resolves them during merges and promotions.

## User-facing description

As the operator running many sessions in parallel — and as any session that files a loose end — I
want a ledger row's id to be something I can mint without asking anyone and that never changes once
it is written down, so that merges stop renumbering rows and a citation always means the row its
author meant.

## Acceptance criteria

- [ ] **AC-1 — Minting needs no coordination.** Given two checkouts that share a base and have
      exchanged nothing since, when each adds a ledger row for a different finding by following the
      documented procedure, with the network unavailable, then the two rows carry different ids.
- [ ] **AC-2 — Keeping both sides is always enough.** Given two branches that each added rows under
      the new rule, when they merge in either order and any conflict in the ledger is resolved by
      keeping both sides, then the ledger is valid as it stands: no id appears twice, no id had to
      change, and `bash scripts/harness-lint.sh` is clean.
- [ ] **AC-3 — Existing ids and citations hold.** For every row on `origin/staging` when the change
      lands, following a citation of its existing number by the documented lookup finds a row whose
      Item text is unchanged. The change edits no existing citation anywhere in the repo.
- [ ] **AC-4 — A duplicate id is a lint violation.** Given a ledger in which two rows carry the same
      id, when `bash scripts/harness-lint.sh` runs, then it exits nonzero and names the id. Given
      the ledger as the change leaves it, it reports none.
- [ ] **AC-5 — The read surfaces agree with themselves.** The ledger section of `/whats-open`, the
      session-start digest's meta line and the meta-escalation count list the same open items, with
      the same ages, immediately before and after the change.
- [ ] **AC-6 — One rule, written once; the interim rules retire.** `OPEN.md` § "How to use this
      ledger" says how to mint an id and how to cite one. The "fetch first, expect to renumber"
      guidance is gone from where it lives today (row 151's interim rule; the rationale in
      `engineering-team/workflows/6-book-close.md` step 13). Rows 151, 207 and 307 are flipped DONE,
      and the 2026-07-28 intake entry carries a closing marker.

## Concepts touched

None. The ledger is harness infrastructure; no concept-graph handle is involved and no firmware
reinstall follows.

## Out of scope

- **Removing textual merge conflicts altogether.** AC-2 asks only that keeping both sides is always
  correct. Whether to go further — so that adding rows never conflicts at all — is a design option
  for the ADR to price, not a requirement.
- **`engineering-team/CHANGELOG.md` and `_intake.md`.** They share the ledger's append conflict but
  have no ids, so nothing in them collides or gets renumbered.
- **Rewriting history.** Commit messages, PR bodies and the Loose Threads board keep citing the
  numbers they cite.
- **The rows themselves.** Triage, closure and re-typing of open rows, and the meta backlog.
- **Story and ADR numbering**, per-epic since 2026-06-04.
- **The pipe-in-a-cell misparse.** Nine rows carry a literal `|` inside a cell, and
  `scripts/lib/collect-meta.sh` reads cells by position, so open meta rows 70 and 244 are missing
  from the escalation count today. That is a reader bug, filed separately. The ADR still has to
  respect it: anything that moves or parses rows must not corrupt those nine.

## Open questions

None open. Two choices made at Planning, both ratified by the operator at the Planning gate on
2026-09-19:

1. **A new epic rather than reactivating `harness-self-improvement`**, which the intake proposal
   suggested. Reasons in `engineering-team/epics/ledger-row-identity.md` § "Why a new epic".
2. **Row 307 joins rows 151 and 207.** The packet named two rows; 307 is the same defect, and its
   four occurrences are the best evidence here.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
