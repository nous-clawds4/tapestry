# A cloud session pinned to `staging` cannot commit failing tests the way the repo does without turning every open PR's CI red

**Id:** 2026-10-13-staging-pinned-session-vs-failing-tests
**Type:** meta
**Opened:** 2026-10-13 (book `about-this-instance`, story 1's Test Design and Implementation)
**Status:** DONE
**Done:** 2026-10-14. Owner-requested harness commit, fix shape 1 (write the convention down) plus a standing permission. `workflows/3-test-design.md` § Per-phase commits now puts failing tests on `feat/<book-slug>`, never on `staging` or `main`, with implementation and review following on that branch and reaching `staging` by PR after Review. It gives a session pinned to `staging` the owner's standing permission to create and push that branch without asking. `workflows/4-implementation.md` and `.claude/commands/design-tests.md` point there, and the CHANGELOG row is dated 2026-10-14. Fix shape 2 (per-book designated branches for cloud sessions) is an operator setting outside the repo and is no longer needed to remove the conflict. Fix shape 3 was not taken because it weakens the gate.

**What was seen.** This session's instructions named `staging` as its only branch, and it was not allowed to push to any other branch without permission.

The harness asks for a per-phase commit of intentionally failing tests (workflow 3). On `staging` that commit would make `npm test` fail, and `.github/workflows/test.yml` runs the full gate on every pull request into `staging`. So every other open PR would have gone red until this story's implementation landed.

The repo's own practice avoids that. Recent books commit their failing tests on a feature branch and reach `staging` by PR after Review: `feat/assistant-self-map`'s `test: failing tests …` commits are not on `staging`'s first-parent line.

**What happened.**
- The session asked the operator to allow `feat/about-this-instance`. The question went unanswered across several turns.
- The stop hook kept asking for a push.
- In the end the failing-test commit stayed local and was pushed together with the implementation once the gate was green.
- CI stayed green, but the implementation reached the staging deploy before its Review.

**Recurred the same day.** Book `assistant-scores`, in another session, pushed its intentionally failing tests (`11d5c626`) straight to `staging` (deploy run 717), so `npm test` on `staging` failed until its implementation landed. That is the outcome this session held its commit back to avoid.

**And it reached this book's close.** `assistant-scores`' failing suites came into `about-this-instance`'s tree with a rebase, so that book's close-time gate (`20261014T002831Z-7922-1ae2`) failed on another book's work. Every book that lands on `staging` while it is red inherits the same failure (`audits/about-this-instance/audit.md` §5).

**Fix shape.** Any of these would remove the conflict:
- **Write the convention down:** a line in workflow 3 or in `engineering-team/README.md` saying failing-test commits go on a feature branch, never on `staging` or `main`.
- **Configure sessions to match:** cloud sessions for this repo get a per-book feature branch instead of `staging` as their designated branch.
- **Make CI tolerate it:** the gate learns a "failing on purpose, pending story X" state. Riskier, because it weakens the gate.

**Pointer:** `engineering-team/reviews/about-this-instance/1-owner-admins-customer-count.md` § Harness friction.
