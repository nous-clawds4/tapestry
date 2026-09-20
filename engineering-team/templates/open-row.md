# <One sentence that says what was seen — it stands in for a table row's bold lead>

**Id:** <YYYY-MM-DD-slug — this file's name without `.md`>
**Type:** <bug | feature | protocol | docs | cleanup | meta>
**Opened:** <YYYY-MM-DD> (<the session, book or PR that raised it>)
**Status:** OPEN
**Done:** —

<What was seen, the evidence, the fix shape. Ordinary markdown, as long as it needs to be.>

**Pointer:** <where the detail lives>

<!--
A ledger row. Copy this file to ledger/<id>.md at the repo root, fill it in, delete this comment.

  id      `date -u +%F`, a hyphen, then two to six lowercase words ([a-z0-9], hyphen-joined) that
          say what the row is about; 64 characters at most. Nothing is fetched or counted to get
          one, and it never changes once it is on staging.
  cite    "OPEN.md row `<id>`" — the id, never the path.
  close   **Status:** DONE, and fill **Done:** with the date and the PR. Never delete the file.

The readers take the first word of Type and of Status, and the first ISO date in Opened, so a note
after any of them is fine. The rule is written once, in OPEN.md § "How to use this ledger";
`bash scripts/harness-lint.sh` (L15) checks the filename and these header fields.
-->
