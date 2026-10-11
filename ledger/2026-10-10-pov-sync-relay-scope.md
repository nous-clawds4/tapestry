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

Two related points from story 4's review (non-blocking 1 and 2): the POV sync uses the one sync slot
(`src/api/strfry/negentropySync.js`, `activeSync`) for up to 10 minutes, so a signed-in person repeating it can hold off
scheduled presets and other syncs; and its answer returns strfry's output and the command, which with a free relay tells
the caller whether an internal host answers. A public-relays rule would settle the second; the first needs its own
limit (per-person rate or a separate slot).

**Pointer:** `engineering-team/audits/negentropy-sync-access/book.md` decision 5; ADR security-auth-exposure/0004 § Consequences.
