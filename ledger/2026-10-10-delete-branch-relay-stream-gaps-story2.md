# The merged branch `relay-stream-gaps-story2` is still on origin, because the session's git proxy refused to delete it

**Id:** 2026-10-10-delete-branch-relay-stream-gaps-story2
**Type:** cleanup
**Opened:** 2026-10-10 (book `relay-stream-gaps` close)
**Status:** OPEN
**Done:** —

`git ls-remote --heads origin` on 2026-10-10 lists `relay-stream-gaps-story2` at `6447ef9a`, the story 2 review commit.
Everything on it is in `staging` (`git log origin/staging..origin/relay-stream-gaps-story2` is empty). The book's other
branches (`relay-stream-gaps`, `relay-stream-gaps-3`, `relay-stream-gaps-closeout`) are already gone from origin. The
cloud session's git proxy refuses remote branch deletion, so the owner was asked to delete it on GitHub.

Close this row when `git ls-remote --heads origin relay-stream-gaps-story2` prints nothing. Local branches are pruned
separately, on an explicit yes (book-close step 13.4); none of these is in `scripts/long-lived-branches.txt`.

**Pointer:** `engineering-team/audits/relay-stream-gaps/audit.md` §6.
