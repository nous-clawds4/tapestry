# The relay router's four mutation endpoints had no owner check, so any signed-in session could reach them

**Id:** 2026-09-28-router-endpoints-owner-gate
**Type:** bug
**Opened:** 2026-09-28 (fix outside the cycle, branch `fix/router-owner-check`; one instance of the 2026-07-21 intake entry "gate authenticated-non-owner access to admin mutations")
**Status:** DONE
**Done:** 2026-09-28 — commit `7b71405a` on `fix/router-owner-check`

**What was seen.** `POST /api/strfry/router-config`, `router-toggle`, `router-restart` and `router-restore-defaults`
(`src/api/strfry/routerConfig.js`) had neither a route-level owner guard nor an in-handler `isOwner` check.
Default-deny (security-auth-exposure story 2) refuses them to a caller with no session, but a signed-in guest or
customer session fell through to the handlers. `strfry/wipe` had the same gap and was closed on 2026-07-21 with the
in-handler gate. ADR second-brain/0001 (`:88`) names the router-toggle gap as tracked separately; this row is that
record.

**What shipped.** The strfry/wipe shape: each of the four handlers checks `isOwner(req) || req.localTrusted` first and
answers 403 before any state is written or the router restarts, and the four paths join `ownerOnlyEndpoints` in
`src/middleware/auth.js`. Owner and admin sessions, and loopback callers (`localTrusted`), work as before. The router
GETs stay public. Suite: `test/strfry-router-owner-gate.test.js` (10 tests; 1 of 10 passes on staging `88e8659`, 10 of
10 with the fix).

**Residuals, left on purpose.**
- The rest of the 2026-07-21 class (admin mutations reachable by a signed-in non-owner) is still that intake entry's
  scope. Its preference for route-level guards over per-handler checks stands; these four copy the wipe gate so the
  fix stays small.
- No UI change was needed. The router controls live on the Relays tab of the Settings page, which already renders
  only for an owner or admin (`ui/src/pages/settings/Index.jsx:35`, `:121`), the same set the server now admits.

**Pointer:** commit `7b71405a`; `src/api/strfry/routerConfig.js` (`requireOwnerOrLocal`); `src/api/strfry/wipe.js`
(the template); `engineering-team/stories/_intake.md` § 2026-07-21.
