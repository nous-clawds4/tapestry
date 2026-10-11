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

**The Reviewer's half (appended at the book's close, 2026-10-10).** In the same book, reviews 4 and 5 kept two open
weaknesses out of their files and raised them privately. Both became fixed stories (5 and 7) before either was
described in public. The one leak came through the narrower instruction ("live criticals"). The fix should therefore
cover both sides:
- the Reviewer keeps every still-open member of any class out of a review file: describe the class, point at its intake
  entry, and give the specifics privately;
- whoever commits a security review greps it for still-open route paths first.

The book's close applied the second half to its own text (audit § Close screening). Ports to both flows: a Director
commits review files too.

**Pointer:** `engineering-team/reviews/security-auth-exposure/6-task-control-owner-and-admins.md` (round 1, Blocking 1);
`engineering-team/audits/negentropy-sync-access/audit.md` §7 #3.
