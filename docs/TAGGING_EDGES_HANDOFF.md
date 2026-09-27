# Handoff — Tagging edges, stories 2–4 (Tapestry)

**Status:** 🔴 OPEN: stories 2–4 of the `tagging-edges` book are not started. Story 1, the `TAGS` edge contract, has been in production since 2026-09-27 (PRs #764 and #765).

> **Repo metadata. Not part of the handoff text.**
> - **Source.** The kickoff session of 2026-09-25 to 27 mapped the existing FOLLOWS / MUTES / REPORTS ETL read-only: seven area readers, an adversarial fact-check of 115 load-bearing claims (98 confirmed, 15 corrected, 2 unverifiable), and a completeness critique. It then took a read-only census of production, staging and tags.brainstorm.world, and shipped story 1. This file keeps that map, which otherwise lived only in the session.
> - **Line numbers** were read at `origin/staging` `72469bde`; a docs-lane review checked every claim at `bb5db99a` (`engineering-team/reviews/tagging-edges/handoff-doc-2026-09-27.md`). Prefer the function names if lines have drifted.
> - **When the book closes** (stories 2–4 done), flip the Status to ✅ ADDRESSED. `/whats-open` lists this file while it reads 🔴.

---

## 1. Read these first

| What | Where |
|---|---|
| The book and its acceptance frame | [`engineering-team/audits/tagging-edges/book.md`](../engineering-team/audits/tagging-edges/book.md) |
| The epic: stories 2–4, guardrails, **story-2 carry-forwards** | [`engineering-team/epics/tagging-edges.md`](../engineering-team/epics/tagging-edges.md) |
| The contract every writer must use (binding) | [ADR `tagging-edges/0001`](../engineering-team/decisions/tagging-edges/0001-tagging-edge-contract.md): "Binding for later stories", and clarifications 1–13 |
| The edge as documented | BIBLE §6 "Social Graph Relationships (NostrUser → NostrUser)" |
| The code | `src/lib/tagging-edges/` (`taggingToEdge`, `standingEdge`, `revokeApplies`, `revokeTargets`) and `test/tagging-edge-contract.test.js` |
| Open review items for story 2 | [`engineering-team/reviews/tagging-edges/1-tagging-edge-contract.md`](../engineering-team/reviews/tagging-edges/1-tagging-edge-contract.md) § "Re-review": R2-NB1–3 (acceptance criteria) and doc nits R2-4–10 (story 2 docs tasks), as carried in the epic |
| The census numbers | story 1's Background ([`stories/tagging-edges/1-tagging-edge-contract.md`](../engineering-team/stories/tagging-edges/1-tagging-edge-contract.md)) |

## 2. The existing ETL, as it actually works

### 2.1 Real-time leg

```
strfry (C++ patch) → Redis list strfry:events → stream-consumer (supervisor) → Neo4j
```

- **The patch:** `patches/strfry-redis/apply-patches.sh` edits strfry 1.1.0 at image build (`Dockerfile`). It adds an `RPUSH strfry:events` in `WriterPipeline.h`, and only for `REDIS_ALLOW_KINDS = {3, 10000, 1984}`. Adding a kind means editing that set literal. The edit busts the Docker cache at `Dockerfile:19`, so every host's next deploy recompiles strfry and rebuilds every later image layer. OPERATIONS.md §3 puts a cold first build at 5–15 min.
- **What the patch misses:** only `WriterPipeline` users push: `strfry import`, `sync`, `stream` and `router`. The relay's own websocket writer (`RelayWriter.cpp`) calls `writeEvents` directly, so an event a client publishes to `wss://host/relay` never reaches the stream. OPEN.md row `2026-09-27-strfry-redis-misses-websocket-writes`.
- **The consumer:** `src/pipeline/stream/redis-consumer.js` handles one event at a time.
  - It `BLPOP`s the list, then runs one auto-commit Cypher statement per event through `writeCypher` (`src/lib/neo4j-driver.js`), with no retry.
  - Kinds 3 and 10000 replace the author's whole FOLLOWS / MUTES set. Kind 1984 is add-only.
  - Edges carry no properties.
  - There's no `created_at` guard. Ordering comes only from strfry, which reports `Written` only for a newer replaceable version.
  - An event popped while Neo4j fails is lost (row `2026-09-27-stream-consumer-at-most-once`).
- **Supervision and Redis:** the consumer is `[program:stream-consumer]` in `docker/supervisord.conf`. The strfry-side Redis client never reconnects (row `2026-09-27-strfry-redis-never-reconnects`).
- **Kind 5 (NIP-09):** handled nowhere in either leg. strfry itself honours deletions.

### 2.2 Gap-fill leg

- **The four tasks:** `reconcileRecent`, `reconcileNetwork`, `reconcileAll` and `reconcileAuthor`, all in `src/pipeline/reconciliation/` (story `task-queue-scheduler` #23, ADR `task-queue-scheduler/0020`). They are bash + jq + Node + APOC. Per kind, each one follows these steps, except `reconcileAll`'s follows phase (below):
  1. dumps strfry to JSONL (`strfryToKind*Events.sh`);
  2. writes one file per author;
  3. extracts that author set's current edges from Neo4j (`getCurrent*FromNeo4j.js`);
  4. diffs the two sets per author (`calculate*Updates.js`);
  5. applies the result with `apoc.periodic.iterate` + `apoc.load.json` (`apocCypherCommands/`);
  6. stamps each author's NostrUser with `kind<N>EventId` / `kind<N>CreatedAt` from the dump (`apocCypherCommand2_*`). This is bookkeeping only; ADR `task-queue-scheduler/0020` rejects it as an edge-correctness signal.
- **`reconcileAll` diffs FOLLOWS differently.** It runs a global sorted merge-join over the whole edge set: `extractFollowsToTSV.js` + `kind3EventsToFollowsTSV.js` → `sort -u` → `comm` → awk → APOC (`reconcileAll.sh:142-193`). Its mutes and reports phases are full sweeps too, but they run steps 1–6 over every author, with no author filter (`reconcileAll.sh:105-141`). So `reconcileAll` is the only full sweep among the four tasks, and its follows phase is their only diff that isn't per author. Read both before designing story 2's sweep.
- **Selection is by author, never by event.** `reconcileRecent` covers authors with an event inside a window (a watermark in `reconciliationState.sh`, 1 h overlap, 6 h cap).
- **Deletions (FOLLOWS and MUTES only; REPORTS are add-only in both legs) are detected by set-diff only.** No event-id or `created_at` comparison is used, and kind 5 is never read.
- **Each kind is a hand-copied stack.** There is no plug-in point. The reusable parts are the task infrastructure (§ 2.4) and a few patterns (§ 3).
- **Dead, do not copy:**
  - `src/pipeline/reconcile/*`;
  - `batch/processNostrEvents.sh` and `eventsToRelationships.js`;
  - `batch/optimized-processor.js`;
  - `batch/negentropySync.sh`;
  - the systemd-era `stream/addToQueue.mjs`, `processQueue.sh`, `wot/` and `content/`.
- **Superseded but still routed, do not copy or extend:**
  - `reconciliation.sh` (ADR `task-queue-scheduler/0018`'s `--mode recent|all|author` engine). ADR `task-queue-scheduler/0020` removed it from the task registry, but `POST /api/reconciliation` (`src/api/index.js:286`) still runs it from the legacy home page;
  - `batch/transfer.sh`, an add-only kind 3/10000/1984 loader, via `POST /api/batch-transfer` (`src/api/index.js:285`) on the legacy pages, and via the registry tasks `callBatchTransfer` / `callBatchTransferIfNeeded`.
- **How history arrives:** `strfry sync` (negentropy) and the router write straight into strfry. That history keeps its original `created_at`, so `reconcileRecent`'s window never sees it. Only a pass that dumps without `since` does: `reconcileAll`, or `reconcileNetwork` / `reconcileAuthor` for their authors. For kinds 3/10000/1984 the stream sees it too, because `sync` and `router` go through `WriterPipeline`. Taggings have no such push. Taggings reach production through per-instance `#z`-filtered router streams in `router-state.json`, not through `setup/router-presets.json`. **Kind 5 does not travel with them** (row `2026-09-27-revokes-do-not-travel`).

### 2.3 Operator surfaces

- **The only ETL control surface in the React control panel** is Settings › Relays › **⚡ Streaming ETL**: `StreamingETLPanel` in `ui/src/pages/settings/RelaySettings.jsx`, backed by `src/api/streaming-etl/index.js`.
  - It shows status, PID and uptime (parsed from `supervisorctl`), queue depth (`LLEN`), and processed/errors counts **scraped from the stdout log**, polled every 10 s.
  - Its Start/Stop/Restart buttons have no confirm.
  - The control POST is **not owner-gated**: any signed-in session passes. It falls in the class scoped by the open 2026-07-21 intake entry "gate authenticated-non-owner access to admin mutations", whose inventory does not name this route yet.
- **Reconcile tasks have no dedicated UI.** The React control panel can only schedule them, as entries in the neighbouring **📅 Scheduled Tasks** sub-tab (`ScheduledTasksPanel`, `scheduledTasks/AddOrEditEntryModal.jsx`, `src/api/scheduled-tasks/`). The legacy Task Explorer (`/legacy/task-explorer.html`) can run registry tasks on demand through `POST /api/run-task` (not `reconcileAuthor`, whose `--pubkey` it cannot pass), and the legacy home page still carries Batch Transfer and Reconciliation buttons wired to the routes in § 2.2. Job-level inspection is BullBoard at `/admin/queues`.
- **House idiom for an operator panel:**
  - a `settings-section` / `settings-group` card with a coloured status dot and `btn-small` actions;
  - green/red flash banners;
  - a metrics row;
  - a monospace log box.
  - `RelaySettings.jsx` is a large monolith; its sub-tab is local state, so it isn't deep-linkable.
- **Mutations:** gate every one inside the handler with `if (!isOwner(req) && !req.localTrusted)`, following the `src/api/strfry/wipe.js` pattern.

### 2.4 Task infrastructure (reusable as is)

- **Task registry:** `src/manage/taskQueue/taskRegistry.json` gives one BullMQ queue and worker per task behind `/api/run-task`. Copy the field set of `reconcileRecent`'s entry.
- **Schedules:** each enabled entry with a valid schedule and a registered task in `/var/lib/brainstorm/scheduled-tasks.json` becomes a BullMQ Job Scheduler (one per entry, `sched:<entryId>`). The Scheduled Tasks modal lists any non-continuous registry task, so scheduling needs no new code.
- **Lock:** `"resourceClass": "neo4j-heavy"` puts a task behind a Redis counted semaphore (cap 1). Entry-point tagging is load-bearing (BIBLE §24, ADR `task-queue-scheduler/0023`).
- **Events:** structured `TASK_START` / `PROGRESS` / `TASK_END` / `TASK_ERROR` lines. Copy `reconcileRecent.sh`'s trap-based error and per-phase drift payload.

## 3. For taggings: reuse, and do not copy

- **A tagging is not a follow.** One replaceable event per (tagger, target, tag) address, versus one list per author. So:
  - **do not** copy the replace-the-author's-set delete of kinds 3 and 10000; it would delete the tagger's other taggings;
  - **do not** copy `reconcileRecent`'s window diff; it would delete older taggings.
- **Derive every property through `src/lib/tagging-edges/`**, with no inline Cypher shapes. The REPORTS writers already disagree (row `2026-09-27-reports-writers-disagree-on-shape`).
- **The kickoff's recommended shape for story 2**, left to the Architect: a **Node full-sweep reconciler** rather than the bash stack.
  - At about 7,000 taggings a sweep takes seconds.
  - It avoids the shared scratch dirs, the `/var/lib/neo4j/import` file handling, and APOC failures swallowed by `> /dev/null`.
  - Its first run is the backfill.
  - Read strfry with a strict scanner that rejects on a spawn error, a non-zero exit or a timeout (`scanLocalStrict` in `src/api/setup/status.js`), never an exec-with-20-MB-buffer scanner. Its default budget is 5 s (`LOCAL_SCAN_TIMEOUT_MS`), so pass a `{ timeoutMs }` sized for a full sweep.
  - Refuse a mass delete past a threshold. This guard is new work: every existing reconciler counts its deletions before applying them (for example `reconcileAll.sh:114`, `:184`), but only to report drift, and none refuses on the count. The nearest pattern is `reconcileNetwork.sh:76-88`, which refuses an unconstrained author selection (a whole-graph scan), not a delete count; its `fail()` helper (log, `TASK_ERROR`, exit before touching the graph) is the shape to copy. A failed or empty relay read must never mean "everything was revoked" (principle 4, BIBLE §30; row `2026-09-21-failed-strfry-scan-reads-empty`).
- **Recommended shape for story 3:** a websocket `REQ` subscriber to local strfry with `{kinds:[39999], "#z":[…]}` plus `{kinds:[5]}`.
  - It sees every write path, including websocket publishes the patch misses, and needs no strfry rebuild.
  - The in-stack precedent is `nostr-search/src/ingest.js`, a `REQ` subscriber with reconnect and resync.
  - Run it as its own supervisor program, so stopping taggings never stops follows.
- **Recommended shape for story 4:**
  - a new sub-tab beside ⚡ Streaming ETL, or an extracted, parameterised version of `StreamingETLPanel`;
  - counters the consumer writes explicitly (a Redis hash or a status file), not log scraping;
  - a drift figure: `GET /api/strfry/scan/count` with the `nostr-user-tag` `#z` against the `TAGS` edge count;
  - owner-gated POSTs.

## 4. Decisions story 2 will ask the owner

1. **Test data.** The local stack has no taggings and no follows, and there is no SSH to the droplets. Proposed:
   - fixtures for the suite;
   - a local end-to-end run on the public census events, imported into the local relay only (router streams are disabled locally);
   - staging as the first real backfill.
2. **Missing NostrUser ends.** Create them (principle 2: accept every signed event), or link only existing nodes? About 91% of taggings are test fixtures (row `2026-09-27-test-fixture-taggings-on-prod-relays`), so creating ends adds a few thousand fixture NostrUsers on production.
3. **The uniqueness rule on `TAGS.address`.** Adding it to `setup/neo4jConstraintsAndIndexes.sh` and `src/api/status/queries/expectedNeo4jSchema.js` makes every existing instance report "not set up", which disables Install Firmware, until the constraints task re-runs. It needs a rollout step, and it must exist before the first write.
4. **Revokes.** Revokes don't travel between instances today. Accept that the sweep sees only local revokes, or fix the router streams first?
5. **Scheduling and locking.** Ship the schedule enabled or disabled? And should the sweep take `neo4j-heavy`? Measure its lock hold time on staging.
6. **Where the canonical stamp pubkey comes from.** A lazy `require` of `src/api/profile-tags` (precedent: `src/api/assistant/identificationTaggings.js:72`, which reads `NOSTR_USER_TAG_Z_TAG`). That module exports two of the three full z strings (`NOSTR_USER_TAG_Z_TAG`, `TAG_PINNING_Z_TAG`; not `TAG_Z_TAG`) and the runtime `TA_PUBKEY`, but not `LEGACY_Z_TAG_PUBKEY`, and the contract takes bare pubkeys, so the writer either parses the pubkey out of `NOSTR_USER_TAG_Z_TAG` or adds the constant to the exports. Or an ADR 0015 amendment moving the literal into a pure constants module. Never a new literal.

Binding already (ADR 0001, epic): refuse to start without both stamp pubkeys (64-hex per ADR 0001; story 2's ADR adds "lowercase", carry-forward R2-5); make every write and delete conditional on the `eventId` it was decided from, with a Cypher guard pinned by a parity test against `standingEdge`; count retirements in the mass-delete guard.

## 5. Environment notes for this machine

- **Measuring the droplets:** no SSH keys here. Production, staging and tags were measured read-only through each host's public `GET /api/strfry/scan/stream` and `/api/strfry/scan/count`. Only write Cypher is owner-gated on `POST /api/neo4j/query` (`src/api/neo4j/queryPost.js:35`); read Cypher is public (`PUBLIC_MUTATIONS` in `src/middleware/auth.js`). So each host's graph can be measured read-only with no session, for example how many taggers and targets already have NostrUser nodes (§ 4 decision 2, which story 1 left open). Send the query signed out: a signed-in non-owner, non-customer session is refused.
- **Node 16 host:** it fails `event-less-create-set`, `honest-publish-reporting` and `setup-alert-polish`, because there is no global `fetch` and no `require` of ES modules. They pass in CI (Node 22). Compare full runs suite by suite against a labelled baseline, and quote `npm run gate:status` lines.
- **zsh trap:** `"$VAR:tag"` applies zsh's `:t` modifier. Write `"${VAR}:tag"`.

## 6. Pending protocol work that could change the input

- **Worksheet W19** (on hold, issue #761): taggings would point their `z` straight at the tag element. If adopted, the contract's stamp rule (step 2) needs the second shape. Keep that rule in one place.
- **The Pins draft** (§ 4, open question 2) proposes unpinning a *pinning* by republishing it with `polarity "0"`, because deletions propagate unreliably. If taggings adopt the same revoke, the contract already stores `"0"` raw, and ADR 0001's reader rule buckets it as neutral.
