# ssrfGuard treats two non-public IPv6 ranges as public: fec0::/10 and 100::/64

**Id:** 2026-10-09-ssrfguard-ipv6-ranges
**Type:** bug
**Opened:** 2026-10-09 (book `assistant-outbox-relays`, story 3 review round 2, R2-6)
**Status:** OPEN
**Done:** —

`isPublicIpv6` in `src/utils/ssrfGuard.js` rejects `::`, `::1`, `fe80::/10`, `fc00::/7`, `ff00::/8` and `2001:db8::/32`, but not
the deprecated site-local `fec0::/10` or the discard-only `100::/64`. Add both, and keep the browser's copy of the rule in
`src/lib/relay-list` in step: the drift test `test/assistant-relay-list-publish.test.js` A1 compares the two, so it fails
until both change.

**Pointer:** `engineering-team/reviews/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.md` § Round 2
