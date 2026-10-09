# Remove the treasure-map-card-details branches and worktree once the work is on `main`

**Id:** 2026-10-09-treasure-map-card-details-branch-cleanup
**Type:** cleanup
**Opened:** 2026-10-08 (treasure-map-card-details book close, step 11)
**Status:** OPEN
**Done:** —

The book, the Concepts `39998`+`39999` hotfix and the close all live on `feat/treasure-map-card-details`. That branch
is in the worktree `tapestry-worktrees/fix-concepts-family-39999`, which keeps its first branch's name, and it ships to
`staging` in one PR. A second local branch, `fix/concepts-family-39999`, points at the hotfix's second commit
(`2447d98a`), which `feat/treasure-map-card-details` contains. It was never pushed.

Once the work is on `main` (the owner decides when, and approves each promotion), and with the owner's yes, since
deletion is the irreversible step:
- delete `feat/treasure-map-card-details` locally and on `origin`, and `fix/concepts-family-39999` locally;
- remove the worktree (`git worktree remove …/fix-concepts-family-39999`; its `node_modules` and `ui/node_modules` are
  symlinks into the main checkout, so removing it deletes nothing shared).

**Pointer:** `engineering-team/audits/treasure-map-card-details/audit.md` (header).
