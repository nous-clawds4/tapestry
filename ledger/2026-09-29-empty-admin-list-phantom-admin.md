# `BRAINSTORM_ADMIN_PUBKEYS=""` reads as the two characters `""`, so the owner's roster lists a phantom admin

**Id:** 2026-09-29-empty-admin-list-phantom-admin
**Type:** bug
**Opened:** 2026-09-29 (Dictionary › Concepts rows fix, PR #782, while checking what Active b-tags' "Showing" selector offers)
**Status:** OPEN
**Done:** —

**What was seen.** The Mac Studio's `/etc/brainstorm.conf` has `export BRAINSTORM_ADMIN_PUBKEYS=""`. Running
`listInstanceAssistants({ includeAdmins: true })` in the container returns three rows: the owner, one customer, and
an admin whose `accountPubkey` is the literal two-character string `""`, with `displayName` empty and
`assistantPubkey` null.

**Why.** `getConfigFromFile` (`src/utils/config.js:26–39`) first tries the quoted form, `VAR=["'](.*?)["']`. For
`""` the capture is the empty string, which fails the `if (match && match[1])` test at line 29. The unquoted form,
`VAR=([^\s]+)`, then captures `""` itself, and the log says `Found BRAINSTORM_ADMIN_PUBKEYS="" (unquoted)`.
`getAdminPubkeys` (`src/utils/config.js:99–111`) splits that into `['""']`, and `filter(Boolean)` keeps it.

**Where it shows.**
- `GET /api/assistant/roster` for an owner session includes the phantom admin, so on Active b-tags the owner's
  **Showing** list has an option labelled `""…` between "Mine" and the customers.
- Admin checks compare real pubkeys against `""`, which never matches, so nothing is granted.
- Any other setting written as `VAR=""` reads as `""` in the same way. This was not audited.

**Fix shape.** In `getConfigFromFile`, accept an empty quoted value as empty: test `match[1] !== undefined` at line
29, not truthiness. `getAdminPubkeys` then sees `''` and returns `[]`. A regression test should cover `VAR=""` and
`VAR=''`. Audit other `getConfigFromFile` callers that treat `""` as a value.

**Pointer:** `src/utils/config.js`; `src/utils/assistantKeys.js` `listInstanceAssistants`;
`ui/src/pages/shared-concepts/ActiveBTags.jsx` (`personLabel`'s short-pubkey fallback is what prints `""…`).
