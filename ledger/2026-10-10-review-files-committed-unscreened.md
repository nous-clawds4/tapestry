# A review file naming still-open routes was committed to the public repo without a disclosure check

**Id:** 2026-10-10-review-files-committed-unscreened
**Type:** meta
**Opened:** 2026-10-10 (book `negentropy-sync-access`)
**Status:** OPEN
**Done:** —

The coordinator committed the Reviewer's story 6 round-1 review in `deca5b15` without reading it for open
vulnerabilities. It named, with file and line, admin routes still reachable by any signed-in session on production; the
repository is public, so the commit disclosed them. The Reviewer had been told to keep live criticals out of review
files, but a pre-existing, non-critical member of a known class was not covered by that instruction, and nothing in the
coordinator's flow screens a review before it is committed. A screening step for security reviews (grep the new text for
route paths that are still open, before committing) would have caught it. The owner, told, kept the sweep-first plan.

**Pointer:** `engineering-team/reviews/security-auth-exposure/6-task-control-owner-and-admins.md` (round 1, Blocking 1).
