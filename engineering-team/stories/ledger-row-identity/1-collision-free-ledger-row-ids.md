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

## Deviations

Judgment calls made at Implementation, none of which changes the ADR's design.

- **"The table" is the `|` lines after the `| # |` header, minus its `|---|` line.** ADR step 8
  says "the `OPEN.md` table" and "the text between the first two pipes". `OPEN.md` has a second
  table in its preamble ("Kind of open work") and numbering notes between chunks of rows, so taking
  every `|` line would report `---` as a duplicate and the preamble's cells as rows above the
  freeze. Only the first cell is ever read, as the ADR asks.
- **The freeze marker counts only as a whole line.** A row or note that quotes the marker inside
  its text cannot set, or lower, the frozen maximum.
- **L15(b) has a second message, for an id that is not a number.** The ADR gives one message ("row
  <id> is above the frozen table … move it to `ledger/<date>-<slug>.md`"). For a date+slug id
  pasted into the table, "above" reads wrongly and the remedy is simpler — the id is already the
  filename — so that case says "is not a number, and the table is frozen … move it to
  `ledger/<id>.md`". A numbered row gets the ADR's message word for word.
- **L15(c) enforces the 64-character cap.** Step 8(c) names only the pattern; the rule states the
  cap in the same bullet, and an id cannot be changed once it is cited. Raised in the test plan and
  approved at the Test Design gate. L15(c) also reports a row file that is empty, which no header
  check would otherwise see.
- **With no `OPEN.md` at all, L15(a) and (b) skip without a word.** The INFO line is printed when
  `OPEN.md` exists and carries no marker, which is the case ADR step 8 names. The lint suite's
  older fixture trees (about forty) have no ledger at all, and an INFO line on each would be noise.
- **The id pattern is spelled without `{n,m}` in awk.** Interval expressions are not portable
  across awk implementations (older mawk builds lack them), and the awk code already in these
  scripts spells its digits out the same way (`scripts/whats-open.sh`:97). `(-[a-z0-9]+)` once and
  then four times optional is the same language as `{1,5}`. This machine's awk does take intervals,
  so the choice is untested caution, not a measured need.
- **`.claude/commands/close-book.md`:33 is retired along with `workflows/6-book-close.md` step
  13.2.** ADR step 10 names only the workflow; the command file taught the same "allocated off
  `origin`" rationale (found by the packet, confirmed by step 10's own grep).
- **Both close-commit lines now read `git add … OPEN.md ledger`** (`close-book.md`:31,
  `6-book-close.md`:51). Not in step 10's list, but a consequence of the decision: a close that
  files its loose ends under the new rule would otherwise leave them out of the close commit.
- **In `OPEN.md` § "How to use this ledger" the rule replaces two bullets, not one.** The old
  "Flip Status to DONE" bullet is the rule's "Close a row" bullet now. One bullet was added that
  the ADR's rule text does not have: that `harness-lint` L15 holds the rule.
- **The moved row's file keeps the whole Item text.** Its title is the ADR's example title (the
  first clause of the row's bold lead sentence). Its body is the Item cell byte for byte, under one
  italic line saying where it came from and that "row 329" means the other row. `**Opened:**` and
  `**Pointer:**` are the row's own cells.
- **Landing order for step 1, as measured.** `38a1488f` (the merge of PR #686, cleanup row) is an
  ancestor of `86b2d9e7` (the merge of PR #687, meta row); `OPEN.md` at the first holds one row 329
  and at the second two. `2a99d58d` is also an ancestor of `dab6ce5b`: the later row was minted on
  top of the one it duplicates. The sweep by text found nothing to repoint: the two citations of
  "OPEN.md row 329" (`audits/user-data-error-path/audit.md`:53 and `prd-seed.md`:36) both mean the
  cleanup row, which keeps the number.

## Linked artifacts

- ADR: `engineering-team/decisions/ledger-row-identity/0001-date-slug-ids-and-row-files.md`
- Test plan: `engineering-team/stories/ledger-row-identity/1-collision-free-ledger-row-ids.test-plan.md`
- Review: (filled in after Review phase)
