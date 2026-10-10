# Who may start a negentropy sync, and with which relays, is undecided

**Id:** 2026-10-09-negentropy-sync-access-scope
**Type:** bug
**Opened:** 2026-10-09 (book `assistant-outbox-relays` close; split from row `2026-10-09-negentropy-sync-hotfix-prod`)
**Status:** DONE
**Done:** 2026-10-10 — PR #837 (merge `8fbd68d0`, deploy run 141, production smoke clean; `staging` `dc318717`). Decision 1: the owner and admins (and direct-local callers) run syncs; other signed-in people keep only the POV sync (download one author's kind 30382). Decision 2 (which relays) was not taken; it continues as row `2026-10-10-pov-sync-relay-scope`. Record: book `negentropy-sync-access`, story security-auth-exposure #4, ADR security-auth-exposure/0004.

The negentropy sync routes are among those the auth middleware opens to any authenticated session
(`src/middleware/auth.js`, its `authenticatedEndpoints` list). A sync makes this instance contact the relay the request
names. PR #830 hardened how the routes handle their input; it did not change who may call them or which relays they
may reach. Two decisions for the owner:

1. **Who may start a sync:** any signed-in person, as today, or the owner and admins only, as the relay-router routes are.
2. **Which relays:** any `ws(s)://` address, or public addresses only, checked with `src/utils/ssrfGuard.js` as the
   Outbox Relays publish does (ADR assistant-outbox-relays/0003 Amendments 1–2).

**Pointer:** `engineering-team/audits/assistant-outbox-relays/audit.md` § 4 #11 and § 6 #2; row `2026-10-09-negentropy-sync-hotfix-prod`.
