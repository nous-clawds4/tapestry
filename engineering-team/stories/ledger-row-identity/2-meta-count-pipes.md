# Story 2: Count the open meta rows whose text contains a pipe

**Status:** Done
**Created:** 2026-09-19
**Type:** Bug

## Background

Open `meta` rows in `OPEN.md` are the harness's lesson inbox. Every session starts with a digest
that counts them and reports the oldest; at three open, or one older than 30 days, it prints the
META ESCALATION banner. `/whats-open` prints the same banner and lists each row with its age under
"Meta items". One reader feeds both.

That reader finds a row's Type, Opened and Status cells by position, counting pipes from the left.
A literal pipe inside the Item cell — in a code span, or escaped — moves every later cell one place
along, and the reader tests a fragment of the Item text where it expects the Status. Nine rows carry
such a pipe (48, 70, 79, 84, 111, 157, 166, 229, 244). Two of them are open meta rows, and both are
invisible: counted nowhere, listed nowhere, their ages never considered.

Measured on `origin/staging` `d37cd575`, 2026-09-19:

| Fact | Value |
|---|---|
| Open meta rows the digest reports | 107 |
| Open meta rows in the table, reading each row's Status by its value | 109 |
| Rows dropped | 70 (opened 2026-07-21) and 244 (opened 2026-09-10) |
| Un-marked intake "Meta:" entries, the counter's other source | 0 |
| Oldest open meta row | row 16, 2026-07-02. Older than both dropped rows, so the banner's age is right today by luck |

Two probes on a scratch ledger show what the defect can do beyond an undercount:

- A ledger whose only open meta row is years old and has a pipe in its Item reads
  `meta inbox: 0 open (clear)`. The age trigger never sees the row, so no banner fires at all.
- The Status test is a substring match. A **closed** meta row with two pipes in its Item, followed
  by a mention of `OPEN.md`, reads `meta inbox: 1 open`. No closed row is counted this way today,
  but the ledger names that file constantly.

Rows 111 and 157 were dropped the same way until they were closed (row 290). The failure is silent
in both directions, and nothing about writing a row warns its author.

**Why now.** ADR `ledger-row-identity/0001` (§ Consequences, follow-up 1) wants this fixed before
story #1 is implemented. Story #1's AC-5 requires the read surfaces to report the same open items
before and after its change, and that comparison only means something if the "before" is already
correct. This story changes the count on purpose, so that story #1 never has to.

Who is affected: every session, since the digest opens each one; the operator at triage, who is
told 107 where the ledger holds 109; and the authors of rows 70 and 244, whose lessons escalate
nowhere.

## User-facing description

As the operator triaging harness lessons — and as any session reading its start-up digest — I want
every open meta row counted, listed and aged whatever characters its text contains, so that the
escalation count matches the ledger and a lesson cannot drop out of sight because of how it was
worded.

## Acceptance criteria

- [ ] **AC-1 — A pipe in the Item cell does not hide an open row.** Given a ledger whose only open
      meta row was opened more than 30 days ago and carries a literal pipe inside its Item cell,
      when the session-start digest runs, then the escalation banner fires, reports one open lesson
      and carries that row's real age. This holds for a pipe inside a code span, for an escaped
      pipe (`\|`), and for more than one pipe in the cell.
- [ ] **AC-2 — The row is listed with its age.** Given the same ledger, when `/whats-open` runs,
      then its "Meta items" section lists that row with its age in days.
- [ ] **AC-3 — A closed row stays out, whatever its text says.** Given a DONE meta row whose Item
      cell contains pipes and mentions `OPEN.md` by name, when the digest runs, then the row is
      neither counted nor listed.
- [ ] **AC-4 — A malformed row does not stop the reader.** Given a DONE row shaped like today's row
      157 — the tail of a second row fused onto it, so two Opened cells and two DONE cells — then it
      is not counted, and the open meta rows after it are still counted.
- [ ] **AC-5 — On the real ledger, exactly the two missing rows appear.** Comparing the tree just
      before this change with the tree just after it: the count the digest reports rises by two
      (107 → 109 on `d37cd575`); `/whats-open`'s "Meta items" list gains a line for row 70 and a
      line for row 244, each with the age its Opened date gives; no other line of that list
      changes; and the banner's oldest age is unchanged. The three existing meta tests in
      `test/session-start.test.js` pass unmodified.
- [ ] **AC-6 — Row 290 is narrowed, not closed.** Row 290 stays OPEN. It records that its pipe
      defect is fixed by this story, with the date and the PR, and that what remains is its second
      defect, the 150-byte trim, which belongs to work packet `h-rollup-scanner`.

## Concepts touched

None. The ledger and its readers are harness infrastructure; no concept-graph handle is involved
and no firmware reinstall follows.

## Out of scope

- **The 150-byte trim** — row 290's second defect, in the same function, and its sibling in
  `scripts/whats-open.sh`. Work packet `h-rollup-scanner` owns both, and it edits the same file, so
  the two must not run at once. Rows 70 and 244 will be trimmed like every other listed row.
- **Everything ADR 0001 assigns to story #1:** the `ledger/` directory, lint L15, and a second
  source for the collector.
- **The ledger section of `/whats-open`.** It matches whole lines and has no false positives today.
- **Editing the nine rows.** The reader adapts to what people write, not the other way round. No
  pipe is escaped, moved or removed, and no "no pipes in a cell" rule is introduced.
- **Tidying row 157.** It is DONE and never counts. AC-4 asks only that the reader survives it.
- **The Type test.** It is a substring match too, but the Type cell sits before the Item, so no
  pipe can shift it, and all 149 meta rows carry exactly `meta`. Left as it is, so that this story
  changes one thing.
- **The count's other source**, the un-marked intake "Meta:" entries. Unaffected; none today.

## Open questions

None open. Three choices made at Planning, all ratified by the operator at the Planning gate on
2026-09-19:

1. **This story joins the open book `ledger-row-identity` as story #2, and the book's acceptance
   frame does not change.** ADR 0001 names this fix as a prerequisite of story #1. The frame's
   fourth bullet ("the same open items after the change as before it") is about story #1's change;
   it holds as written, provided story #1 takes its baseline after this story has merged.
2. **Architecture is skipped as obvious** (Bug lane, Standard strictness). The fix shape was
   measured against all 330 rows and is recorded in row 290: find the Status cell by its value —
   the first cell after Type that is exactly `OPEN` or starts with `DONE` — and take the cell
   before it as Opened. Two alternatives were measured and rejected there: reading from the right
   (unsafe on rows 48 and 157) and stripping code spans before splitting (fails on row 157). No new
   design decision is needed. ADR `harness-self-improvement/0004` already specifies the collector
   as "status-column == OPEN"; this makes the code do what it says.
3. **Six acceptance criteria stay in one story.** That is one more than the usual ceiling; they are
   small and all concern one reader.

## Deviations

- **The scan for the Status cell starts at the sixth field, not directly after Type.** Row 290 and
  Open question 2 word the rule as "the first cell after Type that is exactly `OPEN` or starts with
  `DONE`". Type is the third field, and an Item cell and an Opened cell always sit between it and
  the Status, so the sixth field is the earliest place a Status can be. Starting earlier would let
  an Item that begins with the word DONE ("DONE rows are…", "DONE-LOCAL is…") read as a closed row.
  The old reader did not have that false negative, since it only ever looked at the sixth field;
  the fix must not introduce it. For a row without pipes the new reader looks at exactly the cell
  the old one did. Measured on `d37cd575`: both starting points give the same Status on all 330
  rows, and no Item begins with DONE or OPEN, so the choice only affects future rows. One guard
  test was added at Implementation for this (its fixture reads as 0 open when scanned from the
  fourth field and 2 open from the sixth); it is marked as such in the test file. The eleven
  Tester-designed tests are unchanged.

## Linked artifacts

- ADR: none — Architecture skipped as obvious. Design record: `OPEN.md` row 290; ADR
  `engineering-team/decisions/ledger-row-identity/0001-date-slug-ids-and-row-files.md`
  § Consequences, follow-up 1; the collector's spec is ADR
  `engineering-team/decisions/harness-self-improvement/0004-meta-escalation.md` § Implementation notes.
- Test plan: `engineering-team/stories/ledger-row-identity/2-meta-count-pipes.test-plan.md`
- Review: `engineering-team/reviews/ledger-row-identity/2-meta-count-pipes.md`
