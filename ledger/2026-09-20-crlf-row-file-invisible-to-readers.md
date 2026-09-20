# A row file with CRLF line endings lints clean and is invisible to both read surfaces

**Id:** 2026-09-20-crlf-row-file-invisible-to-readers
**Type:** meta
**Opened:** 2026-09-20 (review of story `ledger-row-identity` #1, non-blocking finding 1)
**Status:** OPEN
**Done:** —

**The lint and the reader disagree about a carriage return, and the disagreement hides a row silently.**
`scripts/harness-lint.sh` L15(c) strips a trailing `\r` before it looks at a header field (`value()`,
`sub(/[ \t\r]+$/, "", v)`), so `**Status:** OPEN\r` reads as `OPEN` and passes. The reader does not:
`first_word()` in `scripts/lib/collect-ledger.sh` cuts a field at the first space or tab only, so the
same line gives the status `OPEN\r`, and both consumers compare it with `== "OPEN"`
(`scripts/whats-open.sh`, the ledger section; `scripts/lib/collect-meta.sh`, the file-row loop). The
row is then listed nowhere and counted nowhere, and the lint says clean.

Measured 2026-09-20 on `8e624eb5`, macOS awk 20200816, on a fixture of a frozen one-row `OPEN.md` and
two open `meta` row files that differ only in their line endings:

- `bash scripts/harness-lint.sh` — exit 0, `harness-lint: clean (0 violations)`.
- `ledger_file_rows` — the CRLF file's line reads `…\tmeta^M\t2020-01-01\tOPEN^M\tA CRLF lesson^M`
  under `cat -v`; the LF file's line is clean.
- `/whats-open` — the ledger section and "Meta items" list the LF row only.
- The digest — `1 open harness lesson(s)`, where two are open.
- The same fixture under mawk 1.3.4 and bash 5.1.16 (Ubuntu 22.04, the local `tapestry` image): the
  lint is clean and `ledger_file_rows` prints the same `OPEN^M`, so it does not depend on the awk.

Only a bare `OPEN` is affected, which is what the template ships. Measured on a third file: a Status
of `OPEN — waiting on the operator\r` is cut at the space, reads `OPEN`, and the row is listed and
counted — with `meta^M` and a title ending `^M` carried into its roll-up lines. A bare Type survives
either way, because `meta\r` still matches `/meta/`.

It is latent, not live: on the same day `git ls-files --eol -- '*.md'` shows 0 of 1,418 tracked
markdown files with CRLF or mixed endings, the repo has no `.gitattributes`, and `core.autocrlf` is
unset on this machine. Every writer today is a macOS or Linux session. It is the row-file form of the
silent class OPEN.md row 331 records for the table (a Status that is not exactly `OPEN` hides a row
from both surfaces), and it falsifies one sentence: the header comment of `collect-ledger.sh` says
L15(c) "checks the same header fields, so a row this reader would misread fails the lint first".

Fix shape: make the two agree, and prefer the reader. `first_word()` cuts at `[ \t\r]`, and the title
drops a trailing `\r`; or, the other way round, `value()` stops stripping `\r`, so that a CRLF row file
fails L15(c) by name. Either way add the CRLF fixture to `test/session-start.test.js` (the reader)
or `test/harness-lint.test.js` (the lint), and correct the comment. Worth taking with row 331, which
is the same decision for the table.

**Pointer:** `scripts/lib/collect-ledger.sh` (`first_word`, the header comment); `scripts/harness-lint.sh` `check_L15` (`value`); review `engineering-team/reviews/ledger-row-identity/1-collision-free-ledger-row-ids.md`, non-blocking finding 1; OPEN.md row 331.
