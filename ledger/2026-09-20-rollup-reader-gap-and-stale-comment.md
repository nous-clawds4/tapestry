# Two findings of the `ledger-row-identity` #1 review were left unfiled: a reader gap in `/whats-open`, and a stale test comment

**Id:** 2026-09-20-rollup-reader-gap-and-stale-comment
**Type:** cleanup
**Opened:** 2026-09-20 (`ledger-row-identity` book close; the review of story #1, non-blocking findings 3 and 4)
**Status:** OPEN
**Done:** —

The review of story `ledger-row-identity` #1 filed two of its four non-blocking findings as rows and
marked the other two "not filed". Both are small, both are real, and neither has another home. They are
one row because one short change closes both.

**1. `/whats-open` reads the ledger's row files only when `OPEN.md` exists; the meta collector reads
them regardless.** In `scripts/whats-open.sh` the call to `ledger_file_rows` sits inside
`if [ -f OPEN.md ]`, and the other branch prints "(OPEN.md not found)". In
`scripts/lib/collect-meta.sh` the table loop is inside the same test and the row-file loop is outside
it. Reproduced at the book's close on a scratch tree holding `scripts/` from `d79a0dab`, one open
`meta` row file dated 2020-01-01 and no `OPEN.md`: the ledger section prints "(OPEN.md not found)" and
lists nothing, while "Meta items" lists `[2453d] 2020-01-01-probe-file-lesson — …` and the digest
prints the escalation banner for one open lesson. So the two read surfaces disagree about the same
file. Latent: `OPEN.md` exists in this repo and always will (the frozen table lives in it), so only a
fixture tree or a fork that adopts `ledger/` without the table can meet it. Fix shape: move the
row-file lines of `whats-open.sh` out of the `OPEN.md` test, keep "(OPEN.md not found)" for the table
alone, and add the no-`OPEN.md` fixture to `test/session-start.test.js`.

**2. The header comment of `test/session-start.test.js` still gives the product roles' old write
scope.** Lines 11–12 read "Write/Edit scoped to product-team/** + OPEN.md". Story #1 added
`ledger/**` to the six agents, and the test below the comment asserts the new scope and passes; only
the comment is behind. Fix shape: "product-team/** + OPEN.md + ledger/**".

Worth taking with OPEN.md row `2026-09-20-crlf-row-file-invisible-to-readers` (same reader, same test
file) and row 331, since all three are places where the ledger's readers and its lint disagree at an
edge. `scripts/whats-open.sh` is a harness-definition path, so the change owes a CHANGELOG row.

**Pointer:** `scripts/whats-open.sh` (the ledger section); `scripts/lib/collect-meta.sh` (`collect_meta`, the row-file loop); `test/session-start.test.js` lines 11–12; the review of story `ledger-row-identity` #1, non-blocking findings 3 and 4.
