# The hermetic B-class specs have no recipe for signing in, so a provider's sign-in and sign-out lifecycle went untested and a stale-answer bug reached review

**Id:** 2026-09-21-b-class-no-signin-recipe
**Type:** meta
**Opened:** 2026-09-21 (setup-status-and-alert #1 review, harness friction 3)
**Status:** OPEN
**Done:** —

The B-class Playwright specs mock `/api/auth/status` and `/api/auth/user-classification` to set who
is signed in at page load. They have no way to sign in or out during a test. Memory
`verifying-signed-in-ui` records that the automated browser has no NIP-07 signer.

So in setup-status-and-alert #1, the new `SetupStatusProvider`'s lifecycle got only source-token
sentinels:
- fetch lazily;
- fetch again when the account changes;
- reset on sign-out.

The Reviewer found the bug those sentinels could not see. Sign out, then sign back in as the same
account without a reload, and the page shows the answer from before the sign-out as current while
the new check runs. That is the review's Blocking 1.

**What works in Playwright 1.56.1** (the reviewer's check, run against the built UI with every
`/api` route mocked in the browser):
- a fake `window.nostr` set through `page.addInitScript`, with `getPublicKey` and `signEvent`;
- stateful mocks for `/api/auth/verify-user`, `/api/auth/login-user` and `/api/auth/logout`, so
  `/api/auth/status` answers per the current mock session.

Together these drive a real `login()` and `logout()` through `AuthContext`, including account
switches and re-sign-ins.

**Fix shape:** write the recipe into the B-class precedent. Story 1's fix round adds such a test to
`tests/brainstorm/setup-status.spec.js`, and story 2's pill needs the same.

**Pointer:** `engineering-team/reviews/setup-status-and-alert/1-setup-shows-where-you-stand.md`
§ Blocking 1 and § Harness friction 3.
