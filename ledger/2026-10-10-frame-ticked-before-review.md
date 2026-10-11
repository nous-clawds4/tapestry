# A book's acceptance frame was ticked before its first independent review

**Id:** 2026-10-10-frame-ticked-before-review
**Type:** meta
**Opened:** 2026-10-10 (book `negentropy-sync-access`, story security-auth-exposure #4 review round 1)
**Status:** OPEN
**Done:** —

The `negentropy-sync-access` frame bullets were written `[x]` when the hotfix shipped, before the Reviewer had read the
record, and one of them ("only the POV sync") was not yet true. The frame is the book's definition of done; ticking it
should follow the review, or the bullet should say "shipped, review pending".

**More occurrences in the same book (appended at its close, 2026-10-10):**
- Bullets 6–7 were ticked in `0f028254`, the commit that opened this row, before stories 5 and 6 had been reviewed
  (review 4, round 2, § Harness friction).
- Bullet 7 was still ticked when story 6's round 1 found its record overclaiming (review 6, round 1, § Harness
  friction).
- Bullet 8 was ticked in `deca5b15`, before story 7's first review (review 7, round 1, § Harness friction).

Every bullet turned out true except bullet 2 when it was first ticked. At the close, all eight are backed by a PASS
review. The fix shape stays as above: tick in the review's commit, or write "shipped, review pending" until then.
Ports to both flows: a Director ticks the frame too.

**Pointer:** `engineering-team/audits/negentropy-sync-access/book.md`; review `security-auth-exposure/4`;
`engineering-team/audits/negentropy-sync-access/audit.md` §7 #2.
