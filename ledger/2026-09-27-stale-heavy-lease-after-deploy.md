# Nothing clears `neo4j-heavy` leases at boot, so a heavy task killed by a deploy, or orphaned by a backend-only restart, blocks every heavy task for up to 4 h

**Id:** 2026-09-27-stale-heavy-lease-after-deploy
**Type:** bug
**Opened:** 2026-09-27 (tagging-edges #2 Architecture, ADR `tagging-edges/0002` § Consequences, candidate row 5)
**Status:** OPEN
**Done:** —

The `neo4j-heavy` class is a Redis hash of leases, cap 1, each lease living 4 h (`DEFAULT_LEASE_TTL_MS`,
`src/manage/taskQueue/queue/resourceSemaphore.js:30`). A deploy re-creates the `tapestry` container and kills any
running task, but `tapestry-redis` survives, and nothing at control-panel boot drops leases whose holder is gone
(no reference to the holders key in `bin/control-panel.js` or `src/manage/taskQueue/queue/index.js`). A
backend-only restart (`supervisorctl restart brainstorm`) re-runs control-panel boot too, but a running heavy task
survives it, orphaned: supervisord signals only the node process (`[program:brainstorm]` in
`docker/supervisord.conf` sets no `stopasgroup` or `killasgroup`), `launchChildTask.sh` backgrounds the child (:344,
:349), and the control panel's SIGTERM handler exits (`bin/control-panel.js:401`) before the Worker's
`finally { await release(); }` runs, so that task's lease also stays until its TTL, while the task may still be
running. The next heavy task — scoring, reconciliation, and from tagging-edges #2 the gap-filling pass — waits until
the dead lease expires.
OPERATIONS.md § "The `RESOURCE_CLASS_WAIT_TIMEOUT` failure mode" gives the manual clear; nothing does it for you.
Related: the 2026-06-08 intake entry "Owner scoring batch is not deploy-safe" (drain-on-deploy still open).

**Fix shape.** At boot, before workers start, drop only a lease whose holder is known to be gone, and emit a
`resource_class_released` event saying why. Today that cannot be told: a lease records only `leaseId → expiry`
(`ACQUIRE_LUA`'s `HSET`, a random UUID), with no job id or holder process, and boot cannot tell a container
re-creation (every task gone) from a backend-only restart (an orphaned heavy task may still run). So neither "drop
every lease" nor "drop leases whose job is not active in BullMQ" is safe as it stands: after a backend-only restart
either could free the slot while the orphan runs and let a second heavy task start beside it. A fix first records the
holder in the lease (its job id, and the child's pid and process start time) and drops at boot only a lease whose
holder process is gone. *(Amended in tagging-edges #2 review round 3, 2026-09-28: this offered "every lease, since no
task survives a container re-creation", and named deploys only.)*

**Pointer:** `src/manage/taskQueue/queue/resourceSemaphore.js`; OPERATIONS.md § "The `RESOURCE_CLASS_WAIT_TIMEOUT`
failure mode"; ADR `engineering-team/decisions/tagging-edges/0002-gap-filling-pass.md` § Consequences and D10.
