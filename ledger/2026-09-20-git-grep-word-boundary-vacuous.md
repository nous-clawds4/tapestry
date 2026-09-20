# `git grep -E` with `\b` matches nothing on this Mac, so a negative search made with it is vacuous

**Id:** 2026-09-20-git-grep-word-boundary-vacuous
**Type:** meta
**Opened:** 2026-09-20 (review of story `ledger-row-identity` #1, harness friction 1)
**Status:** OPEN
**Done:** —

**A second way to get the vacuous negative OPEN.md row 342 describes: the search runs, finds nothing,
and exits 1, exactly as a true "no match" does.** Measured 2026-09-20 on this machine (macOS 26.6.2,
git 2.55.0), against a file that holds the text `(OPEN.md row 329)`:

| Command, run on `engineering-team/audits/user-data-error-path/prd-seed.md` | Result |
|---|---|
| `git grep -c -E 'row \b329\b'` | no output, exit 1 |
| `git grep -c -w -E 'row 329'` | `:1`, exit 0 |
| `git grep -c -P 'row \b329\b'` | `:1`, exit 0 |
| `git grep -c -E 'row [[:<:]]329[[:>:]]'` | `:1`, exit 0 |
| `git grep -c -G 'row \b329\b'` | `:1`, exit 0 |
| the first line again, under git 2.34.1 on Ubuntu 22.04 (the local `tapestry` image) | `:1`, exit 0 |

So the same command answers differently on the host and on Linux, and only the extended-regex form is
affected here.

It happened twice in the review that files this row. The first sweep for citations of row 329 used
`-E` with `\b` and returned nothing; it was caught only because the story under review names two files
that cite that row, so the empty result contradicted a known fact. A later check ("does any test depend
on rows 151, 207 or 307?") used the same form, and its "no" was right only by luck; it was redone with
`-w`. Negative searches carry weight in this ledger and in reviews (row 342 says the same), and this
review's brief sent the Reviewer to `git grep` for exhaustive searches without this caveat.

Fix shape: where a brief or a role file prescribes a negative `git grep`, say to write word boundaries
as `-w` or with `-P`, never as `\b` under `-E`; and keep the control row 342's lesson already implies:
run the search once on a string known to exist before trusting an empty result. No harness script is
affected today: `git grep -c -F '\b'` over `scripts`, `.claude/commands`, `.claude/skills`,
`.claude/agents` and `engineering-team/{workflows,roles,templates}` finds no line (exit 1), and the
same form finds two lines in `OPEN.md`, which is the control.

**Pointer:** OPEN.md row 342 (the zsh form of the same trap); review `engineering-team/reviews/ledger-row-identity/1-collision-free-ledger-row-ids.md` § Harness friction.
