# strfry's Redis client never reconnects, so after a Redis restart the router's pushes are dropped silently until the router restarts

**Id:** 2026-09-27-strfry-redis-never-reconnects
**Type:** bug
**Opened:** 2026-09-27 (tagging-edges #1, the book's kickoff orientation of the follows pipeline; epic § Key facts / guardrails; review Blocking 4)
**Status:** OPEN
**Done:** —

**What was seen.** `patches/strfry-redis/redis.cpp` keeps one static hiredis context per strfry process (`:5`).
`redis_init` connects once, right after the config loads, in every strfry subcommand (the container's patched
`golpe/main.cpp.tt:103-104`). If that connect fails, it logs "streaming ETL disabled", leaves the context null, and
`redis_rpush` returns without doing anything for the rest of the process's life (`redis.cpp:7-21`, `:24`).
`redis_rpush` (`:23-36`) sends a blocking `RPUSH`, frees the reply if there is one, and never looks at `redis->err` or
calls `redisReconnect` (declared by the container's hiredis 0.14.1 at `/usr/include/hiredis/hiredis.h:161`). Once a
hiredis context has seen an I/O error, `redisBufferRead` and `redisBufferWrite` return at once (hiredis v0.14.1
`hiredis.c`: "Return early when the context has seen an error"), so every later push fails without touching the
socket. Nothing logs the failure.

The process this matters for is `strfry router` (supervisor program `strfry-router`, `docker/supervisord.conf:33-41`).
The relay never pushes (OPEN.md row `2026-09-27-strfry-redis-misses-websocket-writes`), and `strfry import` and
`strfry sync` start a fresh process for each call, so they connect anew. After `docker restart tapestry-redis`, which
OPERATIONS.md §10.5 (`:510`) presents as safe for queued jobs, or when Redis is unreachable as the router starts,
every kind 3, 10000 and 1984 the router writes is stored in strfry and never queued. That lasts until the router
restarts: the app restarts it on a router-config change (`src/api/strfry/routerConfig.js:177`, `:314`), and a deploy
recreates the container. Neo4j catches up only when a reconcile run covers those authors.

The Streaming ETL panel keeps looking healthy. The consumer's own ioredis client reconnects
(`src/pipeline/stream/redis-consumer.js:123-132`), so `supervisorctl status` says running, and `LLEN strfry:events` is
0 because nothing arrives (`src/api/streaming-etl/index.js:21-59`, `:85-100`). BIBLE §13 says "The patch is
non-blocking" and that events are dropped "If Redis is down" (`BIBLE.md:936`). In fact the push is a synchronous
round-trip in the router's writer thread, on a connection opened with no timeout (`redis.cpp:8`, `:26-31`), and the
loss does not end when Redis comes back.

**Fix shape.** In `redis_rpush`, on a null reply or a set `err`, call `redisReconnect` and retry the push once. When
the startup connect failed, retry `redis_init` lazily (rate-limited) instead of giving up for the process's life.
Connect with a timeout and set a command timeout (`redisConnectWithTimeout`, `redisSetTimeout`), so that a stalled
Redis cannot hold the writer thread. Log or count every dropped push, so that the loss is visible; a last-push time
kept in Redis would let the panel show a silent producer. It is a C++ change, so it means a strfry recompile and image
rebuild on every host (`Dockerfile:19`, `:26-33`). Correct `BIBLE.md:936` in the same change. If OPEN.md row
`2026-09-27-strfry-redis-misses-websocket-writes` is fixed by retiring the patch for a websocket subscriber, this row
goes with it.

**Update 2026-10-09 (relay-stream-gaps #1, ADR relay-stream-gaps/0001):** one of the two recoveries above is
gone. A router-config change no longer restarts the router: toggles, saves and Restore Defaults rewrite the config in
place and strfry reloads it, and they restart the router only as a fallback (router not running, no reload logged
within 3 s, or a rejected change's rollback not confirmed). After `docker restart tapestry-redis`, press **Restart** on the Router Management tab
(`/tapestry/settings/relays`), or deploy, to give the router a fresh Redis connection. The fix shape above is unchanged.

**Pointer:** epic `engineering-team/epics/tagging-edges.md` § Key facts / guardrails (the "Known defects in the
follows pipeline" bullet: "the Redis client that never reconnects"); review
`engineering-team/reviews/tagging-edges/1-tagging-edge-contract.md` Blocking 4; `patches/strfry-redis/redis.cpp`.
