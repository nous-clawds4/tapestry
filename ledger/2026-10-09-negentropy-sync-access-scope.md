# Who may start a negentropy sync, and with which relays, is undecided

**Id:** 2026-10-09-negentropy-sync-access-scope
**Type:** bug
**Opened:** 2026-10-09 (book `assistant-outbox-relays` close; split from row `2026-10-09-negentropy-sync-hotfix-prod`)
**Status:** OPEN
**Done:** —

The negentropy sync routes are among those the auth middleware opens to any authenticated session
(`src/middleware/auth.js`, its `authenticatedEndpoints` list). A sync makes this instance contact the relay the request
names. PR #830 hardened how the routes handle their input; it did not change who may call them or which relays they
may reach. Two decisions for the owner:

1. **Who may start a sync:** any signed-in person, as today, or the owner and admins only, as the relay-router routes are.
2. **Which relays:** any `ws(s)://` address, or public addresses only, checked with `src/utils/ssrfGuard.js` as the
   Outbox Relays publish does (ADR assistant-outbox-relays/0003 Amendments 1–2).

**Pointer:** `engineering-team/audits/assistant-outbox-relays/audit.md` § 4 #11 and § 6 #2; row `2026-10-09-negentropy-sync-hotfix-prod`.
