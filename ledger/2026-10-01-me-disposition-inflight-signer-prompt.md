# List Headers Me rows: a request in flight at sign-out or account switch can still bring up a signer prompt for a closed panel

**Id:** 2026-10-01-me-disposition-inflight-signer-prompt
**Type:** bug
**Opened:** 2026-10-01 (list-headers-disposition #5, review round 2; the independent adversarial pass)
**Status:** OPEN
**Done:** —

**What was seen.** This is non-blocking: the server refuses the commit, and nothing is saved or broadcast.

ADR 0005 Amendment 1 closes the panel when its row stops being the viewer's. But a `prepareSignCommit` promise that
is already in flight keeps running (`ui/src/utils/meDisposition.js`, `signAsMe`):

- **Signed out during prepare.** The session pubkey is now `null`, so `getActiveSignerOrThrow()` skips its account
  check, and `signEvent` prompts once. The after-sign check then throws a `SignerMismatchError` naming "(unknown)",
  and no commit is sent. The person is asked to sign for a panel that has already closed.
- **Signed in as B, signer on B, during prepare of A's row.** B signs A's template; the browser's check passes
  because the session is now B. The commit goes to A's handle, and the server answers 403 "You can only disposition
  headers you wrote".

Verified by the independent pass, which drove the bundled module with a fake signer and `fetch`. I confirmed the
code path by reading it.

**Fix shape:** in `signAsMe`, refuse unless `getSessionPubkey() === template.pubkey`. Check before calling
`signEvent`, and again after it returns, with a "nothing was saved" sentence. Add a browser case that holds the
prepare answer, signs out, then releases it, and counts `signEvent` calls.

**Pointer:** `engineering-team/reviews/list-headers-disposition/5-disposition-on-me-rows.md` § Re-review, round 2.
