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

**The fix candidate's merge test is wrong, and structurally so (added 2026-09-20, measured on
`origin/main` `4f004e57` and `origin/staging` `8ca781db`).** "Each HEAD is an ancestor of
`origin/staging`" fails for exactly the worktree you most want to reap: one parked at `origin/main`
just after a promotion.

    git merge-base --is-ancestor origin/main origin/main      -> yes
    git merge-base --is-ancestor origin/main origin/staging   -> NO

`main` holds 27 commits that `staging` does not, and **all 27 are merge commits** from
`staging → main` promotion PRs — a promotion merge exists only on `main` by construction, so `main`
is never an ancestor of `staging` and the gap grows by one per promotion. This is not a transient
race that clears when staging catches up. A reaper on that test reads a just-closed book's worktree
as unmerged and silently collects nothing, which is the failure mode that looks like the reaper
working. Use `origin/main`, or "an ancestor of either `origin/main` or `origin/staging`" — the second
is the safer reading, since a worktree may legitimately be parked on either line.

Raised by the `profile-lookup-bounds` session, which hit it on a real worktree
(`.claude/worktrees/vibrant-darwin-c136d3`, 276 MB, book closed, every commit on `main`, holding only
build output) and could not remove it from inside it — so the close-book step also needs to handle
the case where the session *is* the worktree, and hand that one reap to the next session. Re-derived
and confirmed here independently before recording.

**Pointer:** `engineering-team/workflows/6-book-close.md`; rows 199, 306.
