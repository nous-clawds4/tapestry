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

**Pointer:** `engineering-team/reviews/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.md` § Harness friction
