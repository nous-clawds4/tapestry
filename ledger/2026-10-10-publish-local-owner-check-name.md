# The publish handler's owner-only check reuses the name of the owner-or-admin alias

**Id:** 2026-10-10-publish-local-owner-check-name
**Type:** cleanup
**Opened:** 2026-10-10 (story security-auth-exposure #8 review, non-blocking 1)
**Status:** OPEN
**Done:** —

`src/api/strfry/commands/publishEvent.js` defines a module-local `isOwner` that checks the owner pubkey only, while
`src/middleware/auth.js` exports `isOwner` as an alias of `isOwnerOrAdmin`. The local one is correct and commented, but
the shared name invites a mistake. Rename it (e.g. `isTheOwner`), re-aim `test/create-tapestry.test.js`, which pins the
literal gate line, and fix the dead stub and stale comment in `test/one-writer-assistant-profile.test.js`.

**Pointer:** review `engineering-team/reviews/security-auth-exposure/8-admin-action-sweep.md`, non-blocking 1.
