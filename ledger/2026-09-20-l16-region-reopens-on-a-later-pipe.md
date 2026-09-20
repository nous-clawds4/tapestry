# L16's table region reopens on any later pipe line, and L15's never closes at all

**Id:** 2026-09-20-l16-region-reopens-on-a-later-pipe
**Type:** meta
**Opened:** 2026-09-20 (round-4 review of `harness-lint` L16, non-blocking; proposed by the Reviewer, filed by the caller under the row-80 sweep)
**Status:** OPEN
**Done:** —

`check_L16` holds the table's region open until the freeze marker, and decides that a non-row line
was *inside* the table as soon as any later line starts with `|`. That rule is what keeps the
closing prose out of scope, and it is right for today's file, but it has no other upper bound. Four
shapes follow, none of them reachable on `OPEN.md` as it stands, all measured by the reviewer:

- **A fenced block containing a pipe, in the closing prose** below the last row: the fence's pipe
  line reopens the region, and L16 fires on lines that are not in the table.
- **No freeze marker, plus any later table** in the file: the same, with nothing to stop it.
- **CRLF**: the marker pattern ends `-->[ \t]*$`, which a trailing `\r` defeats, so the `stop` rule
  silently does nothing and the file is clean only by luck. A genuine CRLF break is still caught.
  Related, other surface: `2026-09-20-crlf-row-file-invisible-to-readers`.
- **A row indented by one to three spaces** is a valid table row on GitHub (verified through
  `POST /markdown`) but L16 flags it, with advice that does not fit — it says to move the line below
  the table when the fix is to unindent it. Worth flagging, since every `^\|` reader skips such a
  row, but for the opposite reason. Four-space indentation genuinely breaks the table and is caught
  correctly.

**L15 has the wider version of the same gap**, found while gating L16's boundary: it reads ids from
every `|` line after the `| # |` header with no stop at all, so a table quoted inside a note below
the marker is read as ledger rows. Today's notes quote only fragments, so nothing fires. A fixture
had to be written around this.

**Fix shape:** give both checks one shared notion of where the table ends — the freeze marker
(matched tolerantly), else the first `## ` heading after the header, else the last row — and make
L16's advice depend on why the line is not a row (indented row: unindent; anything else: move it
below the table).

**Pointer:** `engineering-team/reviews/harness-self-improvement/open-md-one-table-2026-09-20.md`
§ round 4; `scripts/harness-lint.sh` `check_L15` / `check_L16`;
`ledger/2026-09-20-nothing-guards-table-contiguity.md` (the row L16 closed).
