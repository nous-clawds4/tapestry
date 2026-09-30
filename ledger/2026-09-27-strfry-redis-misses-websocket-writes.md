# Follows, mutes and reports published straight to the relay's websocket never reach the real-time queue

**Id:** 2026-09-27-strfry-redis-misses-websocket-writes
**Type:** bug
**Opened:** 2026-09-27 (tagging-edges #1, the book's kickoff orientation of the follows pipeline; epic § Key facts / guardrails; review Blocking 4)
**Status:** OPEN
**Done:** —

**What was seen.** The strfry patch adds its `RPUSH` to `strfry:events` in one place only: `WriterPipeline.h`, after
the writer thread commits a batch (`patches/strfry-redis/apply-patches.sh:68-100`; in the container's patched strfry
1.1.0 source, `/usr/local/src/strfry/src/WriterPipeline.h:163-172`, and `redis_rpush` has no other caller). Four
strfry subcommands use `WriterPipeline`: `import` (`src/apps/dbutils/cmd_import.cpp:53`), `sync`
(`src/apps/mesh/cmd_sync.cpp:116`), `stream` (`cmd_stream.cpp:36`) and `router` (`cmd_router.cpp:226`). The relay
does not. Its websocket writer, `src/apps/relay/RelayWriter.cpp:61-66`, calls `writeEvents` and commits on its own,
and nothing after that pushes. The public route `wss://<host>/relay` ends there: nginx proxies `/relay` to the NIP-50
proxy on :7780 (`docker/nginx.conf:51-54`), which forwards every `EVENT` to the strfry relay on :7777
(`nip50-proxy/src/session.js:118-120`; `STRFRY_URL` at `nip50-proxy/src/index.js:20`).

So a kind 3, 10000 or 1984 that a client publishes directly to this instance's relay is stored but never queued. The
stream consumer never sees it, and Neo4j reflects it only when a reconcile run
(`src/pipeline/reconciliation/reconcile{Recent,Network,All,Author}.sh`) next covers that author. What does reach the
queue: router streams, the UI's own publishes (`POST /api/strfry/publish` runs `strfry import`,
`src/api/strfry/commands/publishEvent.js:102-111`) and negentropy syncs (`strfry sync`). The docs describe the push as
following every write: BIBLE §13 draws `strfry (LMDB write) → redis_rpush("strfry:events")` (`BIBLE.md:946`), BIBLE §4
says strfry pushes these kinds "after writing events to LMDB" (`BIBLE.md:158`), and the Streaming ETL panel says it
processes them "as they arrive" (`ui/src/pages/settings/RelaySettings.jsx:1376`). How many events production receives
this way was not measured.

**Fix shape.** Either (a) a second patch hook in `RelayWriter.cpp`'s post-commit loop, which already branches on
`EventWriteStatus::Written` for each event (`:92`), with the same allow-list. That is a strfry recompile and image
rebuild on every host (`Dockerfile:26-33`), and it inherits the no-reconnect defect in OPEN.md row
`2026-09-27-strfry-redis-never-reconnects`. Or (b) retire the patch for a websocket subscription to
`ws://127.0.0.1:7777`: strfry's `RelayReqMonitor` watches `data.mdb` (`src/apps/relay/RelayReqMonitor.cpp:8`), so a
live subscription sees writes from every strfry process, websocket writes included. Events stored while it is
disconnected reach no subscription, so it needs a recovery read after every reconnect, and a `since` replay is not
one: `since` compares `created_at`, not arrival, so it drops back-dated history (a sync or import can store old
events today). Recovery needs a re-read that does not filter by `created_at`; the tagging real-time path diffs a
strict scan by event id (ADR `tagging-edges/0003` D3). `nostr-search/src/ingest.js` is no precedent for it: it keeps
no high-water mark, sends no `since` and persists nothing; its reconnect waits a constant 1 s; and its resync returns
at most 500 events. *(Corrected 2026-09-28, tagging-edges #3: this recommended a durable high-water mark and a
`since` replay, with `ingest.js` as the in-stack precedent.)* Correct the three passages above either way. The
tagging-edges epic's real-time path (story 3), "from every way an event can reach the relay", covers taggings only
(`engineering-team/epics/tagging-edges.md:40-41`); it does not cover these three kinds.

**Pointer:** epic `engineering-team/epics/tagging-edges.md` § Key facts / guardrails (the "Known defects in the
follows pipeline" bullet: "the relay-websocket gap in the strfry patch"); review
`engineering-team/reviews/tagging-edges/1-tagging-edge-contract.md` Blocking 4; related OPEN.md row
`2026-09-27-strfry-redis-never-reconnects`.
