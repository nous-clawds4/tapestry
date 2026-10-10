# The point-of-view sync open to signed-in people may still name any relay

**Id:** 2026-10-10-pov-sync-relay-scope
**Type:** bug
**Opened:** 2026-10-10 (book `negentropy-sync-access`; split from row `2026-10-09-negentropy-sync-access-scope`)
**Status:** OPEN
**Done:** —

Since PR #837 only the owner and admins (and direct-local callers) run negentropy syncs. Any other signed-in person may
run one narrow sync through `POST /api/strfry/negentropy-sync`: download one author's kind 30382 Trusted Assertions
(`src/api/strfry/negentropyAccess.js`, `isPovSync`). That request still names its relay freely: any `ws(s)://`
address, including private or local-network ones. Sign-in is open to any nostr key.

The decision left open: keep it, or refuse relays that are plainly not on the public internet for this narrow sync
(the syntactic rule the Outbox Relays page and publish already use, `src/utils/ssrfGuard.js` /
`isPlainlyPrivateHost`, ADR assistant-outbox-relays/0003 Amendment 1), optionally with a send-time lookup. The owner
and admins stay trusted with any relay, as with the relay router.

**Pointer:** `engineering-team/audits/negentropy-sync-access/book.md` decision 5; ADR security-auth-exposure/0004 § Consequences.
