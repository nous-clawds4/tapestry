# The table's freeze is self-declared: a numbered row passes lint if the same commit raises the marker

**Id:** 2026-09-20-freeze-marker-can-be-bumped
**Type:** meta
**Opened:** 2026-09-20 (review of story `ledger-row-identity` #1, non-blocking finding 2)
**Status:** OPEN
**Done:** —

**Nothing holds the freeze marker itself at 343.** `harness-lint` L15(b) reads the bound from the line
`<!-- ledger-table-frozen: highest-number=N -->` in `OPEN.md`, and `test/ledger-row-ids.test.js` (the
"frozen where it stands" test) asserts only that the marker equals the highest number in the table,
whatever the two are. A commit that appends row 344 and edits the marker to 344 therefore satisfies
both.

Measured 2026-09-20 on a scratch copy of `OPEN.md` from `8e624eb5`, with `| 344 | meta | … |` added
after row 343 and the marker raised to 344: `bash scripts/harness-lint.sh` exits 0, `clean (0
violations)`; the test's own comparison gives one marker, marker 344, table maximum 344, 343 rows — it
would pass. With the marker left alone the same row fails by name, as designed.

Why it is worth a row: a session working from an older prompt meets L15(b), and "edit the number until
the lint passes" is the shortcut a session under pressure takes. Integrity still holds — L15(a) names
a duplicated id whichever way it arrives — but the freeze erodes one bump at a time, and with it the
reason the numbered space was closed (ADR `ledger-row-identity/0001` § Consequences: "the numeric id
space is closed").

Fix shape: pin the constant where a session cannot move it in passing. Smallest form: the test asserts
the marker is exactly 343 (the number ADR step 2 fixed at landing), so raising it fails the gate and
has to be argued for in a test diff. Alternative: L15(b) takes `min(marker, 343)`. Settle the number
once the story's PR has merged, in case `staging` gains a row before it lands.

**Pointer:** `scripts/harness-lint.sh` `check_L15` (the `frozen=` line); `test/ledger-row-ids.test.js` (the AC-3 test); review `engineering-team/reviews/ledger-row-identity/1-collision-free-ledger-row-ids.md`, non-blocking finding 2.
