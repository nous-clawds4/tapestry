# The ledger's rule never says to search before filing, and nine rows were closed as duplicates

**Id:** 2026-09-20-ledger-rule-omits-search-before-filing
**Type:** meta
**Opened:** 2026-09-20 (`ledger-row-identity` book close, retro finding F1)
**Status:** OPEN
**Done:** —

**`OPEN.md` § "How to use this ledger" says how to mint, cite and close a row, and nothing about looking
for the row that already exists.** The `ledger-row-identity` book paid for that inside its own design
session: row 330 (the pipe-in-a-cell misparse) was filed on 2026-09-19 for a defect row 290 had
recorded seven days earlier, ADR `ledger-row-identity/0001` cited the new number, and a separate PR
(#690) had to close 330, move its measurements into 290 and re-point the ADR. Row 330's Done cell says
it plainly: "Filed by the `ledger-row-identity` design session without searching the ledger first."

Measured on `origin/staging` `d79a0dab`, 2026-09-20: nine of the table's 342 rows are closed as a
duplicate of another row — 106 (of 104), 127, 168 and 223 (all of 44), 226 (of 198), 232 (of 213),
272 (of 28), 317 (of 29) and 330 (of 290). The rule section holds none of the words "search",
"duplicate" or "already" at that commit or at the book's base (`86b2d9e7`); neither does
`engineering-team/templates/open-row.md`, and no workflow, role, command or skill file says it either.
The instruction exists only in briefs that individual sessions happen to write.

The new home makes it slightly worse and the fix much cheaper. Rows minted since 2026-09-20 are one
file each under `ledger/`, so a would-be duplicate no longer sits a few lines above the place where
the new row is typed. But one command now covers both homes, and a date+slug id makes any later
citation sweep exact:

```
git grep -n -i -e '<a word from the finding>' -- OPEN.md ledger/
```

Fix shape: one bullet in `OPEN.md` § "How to use this ledger", first in the list — search both homes
before adding a row; if the finding is already there, amend that row (a dated sentence) and do not
mint a second one — and the same line in the comment block of `templates/open-row.md`, which is what a
session has open when it mints. The template is a harness-definition path, so that edit owes a
CHANGELOG row. For a word boundary use `-w` or `-P`, never `\b` under `-E` (OPEN.md row
`2026-09-20-git-grep-word-boundary-vacuous`), and under zsh do not pass several paths through one
unquoted variable (row 342).

Does it port to the other flow? Yes, unchanged: product roles write ledger rows under the same rule.

**Pointer:** `OPEN.md` § "How to use this ledger"; `engineering-team/templates/open-row.md`; rows 290 and 330; PR #690; the `ledger-row-identity` book's audit, §7 (F1).
