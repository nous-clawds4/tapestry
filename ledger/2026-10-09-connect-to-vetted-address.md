# A relay or host checked as public is looked up again when the server connects, so the check and the socket can disagree

**Id:** 2026-10-09-connect-to-vetted-address
**Type:** cleanup
**Opened:** 2026-10-09 (book `assistant-outbox-relays`, story 3 review round 3, R3-1)
**Status:** OPEN
**Done:** —

The relay-list publish checks each list relay's addresses (`isPublicRelayHostWithin`, `src/api/assistant/relayListPublish.js`,
c-ares, bounded), then `publishToRelays` (`src/api/assistant/profilePublish.js`) opens the socket by name, so `ws` looks the
name up again with `dns.lookup` on libuv's threadpool. A nameserver that answers the check and then goes silent can hold
one threadpool thread until the system resolver gives up. The same shape is DNS rebinding, already accepted in
ADR assistant-outbox-relays/0003 Amendment 1 and in `src/utils/ssrfGuard.js`'s header. The unauthenticated
`GET /api/nip05/verify` makes uncapped `dns.lookup` calls on user-supplied names already. Fix shape, codebase-wide:
connect to the address the check approved (a pinned lookup for `ws`, a pinned dispatcher for `fetch`), which closes both.

**Pointer:** `engineering-team/reviews/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.md` § Round 3
