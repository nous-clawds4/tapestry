# Sessions told to develop directly on `staging` push Phase-3 failing tests to the shared branch

**Id:** 2026-10-07-staging-sessions-push-red-tests
**Type:** meta
**Opened:** 2026-10-07 (manage-treasure-map book close, retro)
**Status:** OPEN
**Done:** —

The harness commits deliberately failing tests at the end of Test Design, and the Implementer turns them green. That
assumes a feature branch. This book's cloud session was told to develop on `staging` itself, and the environment's
stop hook demands every commit be pushed before a turn ends, so both stories' failing tests sat on `origin/staging`
until their implementation landed (about an hour each). `.github/workflows/test.yml` runs the stack-free suite on every
PR to `staging`, so any PR opened or updated in that window would have gone red for reasons outside it. The two PRs open
then were idle, so nothing broke; the same applies to draft stories and proposed ADRs pushed before their gates, which
are harmless but read as decided.

**Fix shape.** Either (a) sessions develop on a feature branch and ship through `/cycle-staging` even when the brief
names `staging` (the brief's branch is then the merge target), or (b) the Test Design workflow says that on a shared
branch the failing tests are committed locally and pushed together with the implementation. (a) also keeps drafts off
the shared line.

**Fix shape (a) in practice, 2026-10-08 (treasure-map-edit).** That book ran on `feat/treasure-map-edit` (its book
decision 7) and shipped through `/cycle-staging` as PR #821. Five stories' failing tests and every draft stayed off
`origin/staging`, and the PR's CI passed on its first run. Nothing in the harness yet tells a session to do this.

**Pointer:** `engineering-team/audits/manage-treasure-map/audit.md` § 7; this book's commits `33977a6` and `ccece6b`.
