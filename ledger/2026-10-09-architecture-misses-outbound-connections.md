# The Architecture phase never asks whether the server connects to an address a user supplies

**Id:** 2026-10-09-architecture-misses-outbound-connections
**Type:** meta
**Opened:** 2026-10-09 (book `assistant-outbox-relays`, story 3 review round 1)
**Status:** OPEN
**Done:** —

ADR assistant-outbox-relays/0003 reviewed what its route signs and never where it connects, so its publish fan-out would
have opened sockets to any relay a request named — private addresses included — until review round 1 caught it
(fixed by its Amendment 1 with `src/utils/ssrfGuard.js`). `engineering-team/workflows/2-architecture.md`,
`roles/architect.md` and `templates/adr.md` have no prompt for this. Proposed: one checklist line — "Does the server
connect to an address the request, or a stored user-authored value, names? Then route it through
`src/utils/ssrfGuard.js`."

**Extended 2026-10-09 (the same book's close, from review round 2).** The remedy needed bounds of its own. Amendment 1's
send-time check resolved each list relay with `ssrfGuard.isPublicHostname` (`dns.lookup`, libuv's four-thread pool, no
timeout) before the 8 s publish budget started, so one request naming 50 slow-to-resolve relays could hold the pool for a
minute or more and outlast nginx's 60 s (round 2 R2-1; fixed by Amendment 2, a 3 s budget on a c-ares resolver). The
checklist line should therefore ask two things: route user-named addresses through `src/utils/ssrfGuard.js`, **and** say
how long every lookup and connection may take, and how many may run at once.

**Pointer:** `engineering-team/reviews/done/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.md` § Harness friction
