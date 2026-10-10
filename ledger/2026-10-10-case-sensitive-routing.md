# Express still matches routes case-insensitively; the auth middleware now copes, but routing is not a second safeguard

**Id:** 2026-10-10-case-sensitive-routing
**Type:** cleanup
**Opened:** 2026-10-10 (book `negentropy-sync-access`, story security-auth-exposure #5)
**Status:** OPEN
**Done:** —

Story 5 (PR #839) made `authMiddleware` judge every path on a lowercased copy, because Express 4 routes
case-insensitively by default (`/API/x` reaches the handler at `/api/x`). The owner chose the middleware fix only.
Turning on `app.set('case sensitive routing', true)` in `bin/control-panel.js` would make capitalized variants 404 as a
second safeguard, but some registered paths contain capitals (e.g. `/api/get-strfry-filteredContent`,
`/api/toggle-strfry-filteredContent`), so every caller's spelling must be checked first, and routers created with
`express.Router()` carry their own `caseSensitive` option.

Related cleanup: the middleware's `authenticatedEndpoints` entries for the negentropy routes are redundant since story 4
(the routes' own guard decides) and match by substring; removing them would not widen access.

**Pointer:** `engineering-team/stories/security-auth-exposure/5-paths-judged-case-insensitively.md` § Out of scope;
review `security-auth-exposure/4` non-blocking 6.
