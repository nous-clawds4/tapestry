# The negentropy-sync-access reviews left small test gaps and polish open: tests that can pass vacuously, an untyped relay, an undocumented task-control rule

**Id:** 2026-10-10-negentropy-access-review-polish
**Type:** cleanup
**Opened:** 2026-10-10 (book `negentropy-sync-access` close, audit §4 #8 and §6 #4)
**Status:** OPEN
**Done:** —

The open non-blocking notes from the `security-auth-exposure` story 4–7 reviews. None blocks anything: the
fixes work as shipped, and the reviewers checked these gaps by hand or by reading the code.

- **H5 can pass vacuously (review 7, round 1, non-blocking 1).** `test/auth-head-requests.test.js` slices
  `authMiddleware`'s source from an `indexOf`. If the function header is reformatted, the index is -1, the slice is
  empty and H5 passes. It also matches only `req.method === 'GET'` in single quotes. Assert `start >= 0`, and that at
  least one method test was found.
- **P5 counts `req.path` only (review 5, non-blocking 2).** A future comparison on `req.url` or `req.originalUrl` would
  get past it. Also untested under capitals: the direct-local branch, the customer-or-owner list, the
  `authenticatedEndpoints` early pass, and a trailing slash.
- **The POV-sync tests (review 4, round 1, non-blocking 5).**
  - A2 has no `__proto__` or `constructor` filter key and no non-string author. Both were checked by hand and are
    refused.
  - A8 checks the three pages' source shape, not runtime values.
  - No test covers the order body parser → session → auth middleware → route guard; review 4 read it from
    `bin/control-panel.js`.
- **`relay` is not required to be a string (review 4, round 1, non-blocking 3).** `src/api/strfry/negentropySync.js`
  lets an array pass the `ws(s)://` regex by coercion; Node joins it into one argv element, so it is not exploitable.
  Add `typeof relay === 'string'`, as the legacy handler's `relayArg` does
  (`src/api/pipeline/batch/commands/negentropySync.js`).
- **OpenAPI.** `/api/run-task` does not say it is for the owner, admins and direct-local callers (story 6). The saved
  presets list has no entry.
- **Wording.** Story 7's test plan says H3 runs "GET on the same paths", but it uses two of H1's four (review 7, round
  1, non-blocking 3).

Accepted, not to do: the owner and admin pass is not exercised against the real middleware (story 6 AC-3, story 7
AC-3), because `isOwner` reads `/etc/brainstorm.conf`.

**Pointer:** `engineering-team/reviews/security-auth-exposure/4-negentropy-sync-owner-and-admins.md` (round 1,
non-blocking 3, 5); `5-paths-judged-case-insensitively.md` (non-blocking 2); `7-head-judged-as-get.md` (round 1,
non-blocking 1, 3); `engineering-team/audits/negentropy-sync-access/audit.md` §6 #4.
