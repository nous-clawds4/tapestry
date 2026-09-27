# Nothing clears `neo4j-heavy` leases at boot, so a heavy task killed by a deploy blocks every heavy task for up to 4 h

**Id:** 2026-09-27-stale-heavy-lease-after-deploy
**Type:** bug
**Opened:** 2026-09-27 (tagging-edges #2 Architecture, ADR `tagging-edges/0002` § Consequences, candidate row 5)
**Status:** OPEN
**Done:** —

The `neo4j-heavy` class is a Redis hash of leases, cap 1, each lease living 4 h (`DEFAULT_LEASE_TTL_MS`,
`src/manage/taskQueue/queue/resourceSemaphore.js:30`). A deploy re-creates the `tapestry` container and kills any
running task, but `tapestry-redis` survives, and nothing at control-panel boot drops leases whose holder is gone
(no reference to the holders key in `bin/control-panel.js` or `src/manage/taskQueue/queue/index.js`). The next heavy
task — scoring, reconciliation, and from tagging-edges #2 the gap-filling pass — waits until the dead lease expires.
OPERATIONS.md § "The `RESOURCE_CLASS_WAIT_TIMEOUT` failure mode" gives the manual clear; nothing does it for you.
Related: the 2026-06-08 intake entry "Owner scoring batch is not deploy-safe" (drain-on-deploy still open).

**Fix shape.** At boot, before workers start, drop every lease whose holder job is not active in BullMQ (or every
lease, since no task survives a container re-creation), and emit a `resource_class_released` event saying why.

**Pointer:** `src/manage/taskQueue/queue/resourceSemaphore.js`; OPERATIONS.md § "The `RESOURCE_CLASS_WAIT_TIMEOUT`
failure mode"; ADR `engineering-team/decisions/tagging-edges/0002-gap-filling-pass.md` § Consequences and D10.
