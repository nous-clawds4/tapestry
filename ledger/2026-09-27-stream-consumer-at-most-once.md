# The stream consumer drops any event whose Neo4j write fails, so real-time delivery is at most once

**Id:** 2026-09-27-stream-consumer-at-most-once
**Type:** bug
**Opened:** 2026-09-27 (tagging-edges #1, the book's kickoff orientation of the follows pipeline; epic § Key facts / guardrails; review Blocking 4)
**Status:** OPEN
**Done:** —

**What was seen.** `src/pipeline/stream/redis-consumer.js` takes each event off the queue with
`BLPOP strfry:events` (`:142`), which removes it from Redis before any work is done, and then runs its handler
(`:155`). Each handler is one auto-commit statement through `writeCypher` (`src/lib/neo4j-driver.js:76-91`, a bare
`session.run`, which the driver does not retry). On any throw, the loop logs to stderr, counts an error, sleeps one
second and pops the next event (`:162-167`). The failed event is not put back and is not kept anywhere. So an event
popped while Neo4j is down or restarting, or one that hits a transient error such as a deadlock with a concurrent
reconcile or GrapeRank write, is lost. During an outage the loop drains the queue at about one event per second, each
one into the error count. The shutdown handlers lose the event in flight the same way: SIGTERM and SIGINT call
`process.exit(0)` at once (`:172-182`). Every consumer restart sends one: `scripts/dev-refresh.sh:94`, the panel's
Restart (`src/api/streaming-etl/index.js:106-128`), and a deploy's container recreate.

A lost kind 3 or 10000 leaves that author's FOLLOWS or MUTES set as it was, until their next list event or a
reconcile run that covers them. A lost kind 1984 stays missing until a reconcile run. Nothing records which event was
lost. The error text goes to `stream-consumer-error.log` (`docker/supervisord.conf:48`), which no endpoint reads, and
the panel's error count is scraped from a progress line printed every 1,000 events
(`src/api/streaming-etl/index.js:65-80`; `redis-consumer.js:158-161`). On 2026-09-26 production's panel read 45,000
processed and 12 errors (the kickoff orientation's read of `/api/streaming-etl/status`); how many of the 12 were
dropped writes was not established. `git grep -E 'executeWrite|writeTransaction' -- src` finds no caller of the
driver's retrying transaction functions (neo4j-driver `^5.28.1`).

**Fix shape.** `BLMOVE strfry:events strfry:events:processing LEFT RIGHT` (Redis 7, `docker-compose.yml:44`;
ioredis `^5`), `LREM` after the write succeeds, and on start re-run whatever is in the processing list before popping
anything new. Run the write through `session.executeWrite`, which retries transient errors. While Neo4j is
unavailable, wait and retry the same event instead of moving on. Move an event that fails for a non-transient reason
to a dead-letter list, so that it cannot wedge the queue. Keep redelivery in order and the loop sequential: the kind 3
and 10000 handlers replace the whole set with no `created_at` guard (`:47-57`, `:76-86`), so an older list written
after a newer one rolls the set back. The tagging-edges epic lists this defect among the ones its own real-time path
must not copy (epic § Key facts / guardrails).

**Pointer:** epic `engineering-team/epics/tagging-edges.md` § Key facts / guardrails (the "Known defects in the
follows pipeline" bullet: "at-most-once delivery"); review
`engineering-team/reviews/tagging-edges/1-tagging-edge-contract.md` Blocking 4;
`src/pipeline/stream/redis-consumer.js:139-168`.
