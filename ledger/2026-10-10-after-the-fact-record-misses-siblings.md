# A record written after a hotfix described only the routes the diff touched

**Id:** 2026-10-10-after-the-fact-record-misses-siblings
**Type:** meta
**Opened:** 2026-10-10 (book `negentropy-sync-access`, story security-auth-exposure #4 review round 1)
**Status:** OPEN
**Done:** —

Story 4 shipped as an owner-approved hotfix and its story, test plan and ADR were written afterwards from the shipped
diff. They said "eight routes start a sync" and ticked "only the POV sync", while the task-control routes could still
start the registered sync tasks (fixed as story 6). Nothing in the hotfix path asks for a repo-wide search for other
ways to reach the same effect before the record claims completeness; the Reviewer's audit found it. A lighter version
of the Architect's survey step for hotfix records ("what else reaches this effect?") would have caught it.

It recurred twice in the same book: story 6's first record said a stranger "cannot … publish signed exports or start
syncs" while other admin actions could still do so, and story 7's first record said "no other method slips past" the
owner-only list while one owner-only path is served by a GET that acts. Both caught by the Reviewer.

**Pointer:** `engineering-team/reviews/security-auth-exposure/4-negentropy-sync-owner-and-admins.md` Blocking 1.
