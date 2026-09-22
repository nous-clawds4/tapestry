# A worktree's own inherited test file can silently test a different branch's live server through the shared Docker container, and report a clean, confident PASS that means nothing

**Id:** 2026-09-22-worktree-test-runner-false-positive
**Type:** meta
**Opened:** 2026-09-22 (llms-txt book close, retro §7)
**Status:** OPEN
**Done:** —

While verifying the `llms-txt` cherry-pick on a `feature-magic-carpet` worktree, running that branch's own `node test/test.js` reported `Overall: PASS` — including live `H`-class HTTP checks against `security.txt`/`robots.txt` all passing. That result was **worthless**: this project's local Docker container bind-mounts the *main checkout*, not any worktree (`docker inspect tapestry` confirms it), and that BASE URL default (`http://localhost:7778`) in the test file has no awareness that a worktree even exists. The main checkout happened to be on `staging` at the time — which already had `llms-txt` shipped — so the suite quietly verified a *different, already-known-good branch* and reported success as if it had verified the branch actually under test.

**This is the dangerous sibling of an already-known pattern, not the same one.** `[[worktree-stack-serves-main-checkout]]` (session memory) and the equivalent har­ness knowledge describe live `H`-class tests **FAILing** against a stale/wrong branch — a loud, obvious signal. This is the opposite failure mode: the live tests **PASSed**, because the main checkout happened to already have the feature, for reasons entirely unrelated to the worktree's own state. A FAIL gets investigated. A clean PASS gets trusted — and very nearly was, here, before the mismatch was caught by manually checking the container's mount and the main checkout's branch immediately after the suspiciously-easy result.

**Not caught by any existing guard**, because the guard that exists (`stackPresent()` / per-test SKIP-when-absent, used throughout `test/site-trust-signals.test.js` and `test/llms-txt.test.js`) only asks "does something answer at this URL," never "is what answers actually *this checkout's* code." Both are silent on that question by design — they don't SKIP when the stack is present but wrong, because they have no way to tell.

**Fix shape, three candidates, cheapest first:**
1. **A documented habit**, not a code change: before trusting any live-tier result run from a worktree, check `docker inspect tapestry --format '{{range .Mounts}}...'` and the main checkout's current branch. Already how this was caught; just not written down as a required step anywhere.
2. **A cheap fingerprint check** the H-class/L-class helper functions could add: fetch a small marker (a git SHA embedded in a build artifact, or a distinguishing string the code-under-test doesn't have yet) and assert it matches the worktree's own `HEAD`, SKIPping (not silently passing) on mismatch. Would need a marker to exist first — currently nothing in the served output identifies which commit is live.
3. **A session-start or pre-test warning** when the CWD is under `tapestry-worktrees/` and `BRAINSTORM_BASE_URL` is unset: print the actual mount target and branch before any H-class test runs, so the mismatch is visible even without deliberately checking for it.

**Ports to Direction mode:** yes, and more dangerous there — a Direction-mode agent has no human in the loop to notice a suspiciously-clean result and go check the mount, the way this session did.

**Pointer:** `engineering-team/audits/llms-txt/audit.md` §4 #4, §7; session memory `worktree-stack-serves-main-checkout.md`; `test/site-trust-signals.test.js` / `test/llms-txt.test.js` (`stackPresent()` pattern, both suites).
