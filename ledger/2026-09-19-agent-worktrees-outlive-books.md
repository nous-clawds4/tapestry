# Agent worktrees outlive their books and nothing reaps them

**Id:** 2026-09-19-agent-worktrees-outlive-books
**Type:** meta
**Opened:** 2026-09-19 (session close; worktree sweep)
**Status:** OPEN
**Done:** —

*Moved here on 2026-09-20, text unchanged, from the `OPEN.md` table, where it was the second of two
rows numbered 329: PR #686 landed the first at 07:18Z on 2026-09-19, and PR #687 landed this one at
07:36Z, on top of it. "Row 329" means the other one, the undeclared-identifier cleanup. ADR
`ledger-row-identity/0001`, step 1.*

**Agent worktrees outlive their books and nothing reaps them — four had accumulated to 213 MB before a session noticed.** Every Architect/Tester/Implementer subagent that runs with `isolation: worktree` leaves `.claude/worktrees/agent-*` behind with a full `node_modules`; `engineering-team/workflows/6-book-close.md` has thirteen steps and mentions worktrees in none of them, so the close leaves them in place. Removed by hand 2026-09-19: three from `curated-dlist-update` (stories 5 and 6's Implementers and the epic-retirement chore, all merged into `origin/staging`, each holding only an untracked `node_modules`) and one detached at a May commit preserved on `origin/feat/communities`. The desktop app's own worktree cleanup does **not** cover these — it manages only the worktrees it created, and reported zero session-held bytes for this repo — so nothing automatic will ever collect them. Fix candidate: a close-book step that lists the book's agent worktrees, checks each HEAD is an ancestor of `origin/staging` and each tree holds nothing but untracked build output, then removes them and their auto-generated `worktree-agent-*` branches. Related to row 306 (a `cd` into one pins the session) and row 199 (`/cycle-local` step 1 fails inside a fresh one), neither of which is about their lifetime.

**Pointer:** `engineering-team/workflows/6-book-close.md`; rows 199, 306.
