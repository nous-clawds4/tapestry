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

**Consequence seen 2026-10-09 (book `assistant-outbox-relays` close).** Book `assistant-profile-checklist`'s Phase-3
tests (six suites, intentionally failing) sit on `origin/staging` while its implementation is pending. The `staging` →
`main` promotion PR #829 needs the `stack-free` check, which they turn red, so a finished book (`assistant-outbox-relays`)
and a security hotfix (`95876ca`, ledger `2026-10-09-negentropy-sync-hotfix-prod`) cannot reach production through the
normal path. The hotfix reached production the same day through its own `hotfix/negentropy-sync-input` PR (#830, merge
`14e140b`); the book still waits on PR #829.

**How it ended, 2026-10-09 (book `assistant-profile-checklist` close).** That book's Phase-3 tests were pushed at Test
Design (04:19–04:37 UTC) and its implementation at 19:48, about 15 hours later. The owner had chosen to hold the
implementation locally until Review passed, to keep unreviewed code off `staging`. Two review rounds sent it back, so
the hold, made for a good reason, lengthened the red window, because the failing tests were already on the shared
line. PR #829 went green on the implementation's push and merged at 20:13 (`cfcd83c4`). Fix shape (a) above would have
avoided both: the failing tests and the held implementation would have lived on one feature branch.


**Another session, 2026-10-11 (`assistant-duty-cards` #1).** Told to develop on `staging`, this session held its
Phase-3 failing-tests commit locally rather than push red to the shared line. The stop hook then asked for a push at
each of three turn ends. The tests and the implementation went up together once the gate was green, which kept the
red off `staging`. The cost was the agreed order: the implementation reached `staging` (and the staging deploy) before
Review, because the hook kept asking and the owner had not answered which to prefer. Fix shape (a), a feature branch,
would have avoided both.

**Pointer:** `engineering-team/audits/manage-treasure-map/audit.md` § 7; this book's commits `33977a6` and `ccece6b`.

**Recurrence, 2026-10-11 (assistant-duty-menu #1).** The same pattern recurred, in both directions:
- This book's Phase-3 failing tests sat on `origin/staging` from `2d67d055` until `b2477a93`, about 40 minutes.
- Its reviewer found the tip red again from the parallel book `assistant-shared-categories`'s failing tests at
  `57fbb432`, unrelated to this story (review, harness friction 2).

**Recurred 2026-10-11 (book `assistant-shared-categories` close), with a second consequence.**
- The session was again told to develop on `staging`, under the same stop hook. Its failing tests (`57fbb43`) sat on
  `origin/staging` for about 12 minutes before the implementation (`397d236`).
- Under the Light profile the human stop is Gate B, after implementation. So the implementation was deployed to
  staging.brainstorm.world before the owner's Gate B verdict, and the verdict's two fixes followed as a second deploy
  (`14455d4`).
- Nothing broke, and the owner could see the change live. But a book that wants "no unreviewed code on staging"
  cannot have it on this setup.
- Fix shape (a) above, a feature branch shipped through `/cycle-staging` after Gate B, covers both.
