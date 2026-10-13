# The book-close commit line leaves out the epic file that step 9 of the same workflow edits

**Id:** 2026-09-20-close-commit-line-omits-epic-file
**Type:** meta
**Opened:** 2026-09-20 (`ledger-row-identity` book close, retro finding F9)
**Status:** OPEN
**Done:** —

**`workflows/6-book-close.md` § "Per-phase commit" and `.claude/commands/close-book.md` give the close
commit as `git add engineering-team/audits/<book-slug> OPEN.md ledger && git commit …`. Step 9 of the
same workflow flips `engineering-team/epics/<epic>.md` to Done, and that file is in none of the three
paths.** Run as written, the command commits the audit, the manifest, the ledger rows and — because
`git mv` stages its own renames — the three folder moves, and leaves the epic's Status flip behind as
an unstaged change. The commit then holds a Closed book that lists an Active epic, which is exactly
what `harness-lint` L2 forbids.

How it came about, from `git log` on the workflow file: step 9 was added on 2026-07-28 (`da57cc6d`,
from OPEN.md row 121), and the commit line in that same version already read `git add
engineering-team/audits/<book-slug> OPEN.md`. Nobody widened it. Story `ledger-row-identity` #1 edited
the line on 2026-09-19 to add `ledger` (`8e624eb5`) and had no reason to look further.

It is loud, not silent: the close PR's CI fails on "the real repo lints clean", and the next session's
digest shows the L2 line. And practice has covered for the text — three recent close commits
sampled (`2a99d58d`, `02f1a951`, `cb066702`) all carry their epic file, added by hand beyond what the
line says. Seen at the `ledger-row-identity` close on 2026-09-20, where the close was left uncommitted
for the operator: `git status --short` shows the seven renames staged and
`engineering-team/epics/ledger-row-identity.md` modified and unstaged.

Fix shape: name the epic file in both copies of the line —
`git add engineering-team/audits/<book-slug> engineering-team/epics OPEN.md ledger` — and say in one
clause that the step-9 moves are already staged by `git mv`. Both files are harness-definition paths,
so the edit owes a CHANGELOG row. Better still, keep the command in the workflow only and have the
command file point at it: two copies of one line is how story #1 came to edit both.

Does it port to the other flow? Yes: a Direction-mode close runs the same workflow.

**Pointer:** `engineering-team/workflows/6-book-close.md` § "Per-phase commit" and step 9; `.claude/commands/close-book.md` ("Per-phase commit"); `scripts/harness-lint.sh` `check_L2`; row 121; the `ledger-row-identity` book's audit, §7 (F9).

**Note, 2026-10-13 (book close `duty-menus-and-self-maps`, audit §7 P21).** The line misses more than the epic file:
it misses every file the close edits outside `audits/<book-slug>`, `OPEN.md` and `ledger/`. Step 5 ticks §6 items
in other books' audits, and repointing the pointers that step 9's move breaks (row
`2026-09-20-done-move-breaks-inbound-refs`) edits whatever files hold them. This close ticked one item in
`audits/treasure-map-card-details/audit.md`, which the line plus the epic file left unstaged (three independent
checkers found it), and its repointing edited `docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`. Close `04f4eba4`
(`assistant-coming-soon`) added four other audits by hand, with the source and test files whose pointers it
repointed. The fix shape widens to match: after the named paths, stage what `git status --short` still shows as
the close's, or name those paths in the line.
