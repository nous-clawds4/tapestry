# A session started on a clone 495 commits behind `origin/staging`, and nothing said so until Planning

**Id:** 2026-10-14-session-start-stale-clone-unflagged
**Type:** meta
**Opened:** 2026-10-14 (book `about-this-instance` close, retro)
**Status:** OPEN
**Done:** —

**What was seen.**
- This cloud session's checkout was a snapshot whose `staging` and `origin/staging` both sat at `dcddbe4` (2026-10-05). `git status` read "up to date with 'origin/staging'".
- The SessionStart digest (`scripts/session-start.sh`) makes no network calls by design, so it could not tell.
- The session's first research ran on that 8-day-old code. That research was which endpoints are public, who can see admins and customers, and how the auth layer gates them. Some of what it told the operator was wrong.
- Workflow 1's origin-drift preflight caught it at `/plan-feature`: a fetch showed 495 commits behind. By then the operator had already been answered twice.

**Fix shape.** These keep the digest network-free:
- **Warn from the local ref's age:** the digest prints a hint when the local `origin/<base>` tip's commit date is more than a day or two old ("your view of origin may be stale: run `git fetch origin staging`").
- **Run the existing preflight earlier:** CLAUDE.md's session-start guidance runs the same preflight before any research that reads code, not only at the Planning and Architecture phases.

**Second occurrence (2026-10-14, book `assistant-scores`).** This session also started on the `dcddbe4` snapshot, with
`git status` reading "up to date". Its first research (the `/settings` page, the avatar menu, the task routes and the
auth gating) ran 514 commits behind, and the place the owner chose had been renamed and partly rebuilt in between.
Workflow 1's preflight caught it at `/plan-feature`, after the owner had already picked a location from the stale
read. The choice survived, but only by luck. Pointer: `engineering-team/audits/assistant-scores/audit.md` §7.

**Pointer:** `engineering-team/audits/about-this-instance/audit.md` §7; workflow 1 step 0.
