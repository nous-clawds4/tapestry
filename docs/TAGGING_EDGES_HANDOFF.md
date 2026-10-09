# Handoff — Tagging edges, stories 2–6 (Tapestry)

**Status:** 🔴 OPEN: stories 1–4 are in production, and stories 5 (the real-time path's switch) and 6 (the pass's run, stop and confirm) are next. Story 4, the tagging pipeline panel (ADR `tagging-edges/0004`), shipped on 2026-10-01 (PRs #791 and #792). Story 3, the real-time path (ADR `tagging-edges/0003` with Amendment A1), shipped on 2026-09-30 (PRs #785 and #786), and the owner turned it on on both hosts that day. Story 2, the gap-filling pass, shipped on 2026-09-28 (PRs #780 and #781). Story 1, the `TAGS` edge contract, on 2026-09-27 (PRs #764 and #765). § 0 lists what is left.

> **Repo metadata. Not part of the handoff text.**
> - **Source.** The kickoff session of 2026-09-25 to 27 mapped the existing FOLLOWS / MUTES / REPORTS ETL read-only: seven area readers, an adversarial fact-check of 115 load-bearing claims (98 confirmed, 15 corrected, 2 unverifiable), and a completeness critique. It then took a read-only census of production, staging and tags.brainstorm.world, and shipped story 1. This file keeps that map, which otherwise lived only in the session.
> - **Line numbers** were read at `origin/staging` `72469bde`; a docs-lane review checked every claim at `bb5db99a` (`engineering-team/reviews/tagging-edges/handoff-doc-2026-09-27.md`). Prefer the function names if lines have drifted.
> - **When the book closes** (stories 2–6 done), flip the Status to ✅ ADDRESSED. `/whats-open` lists this file while it reads 🔴.

---

## 0. Where things stand, and what is next (2026-10-01)

**Shipped and switched on.** Stories 1–3 run on staging and production. On 2026-09-30 the owner ran OPERATIONS
§12.9's steps on both hosts (story 3 § Evidence, "Staging" and "Production"):
- Production's backfill ran (pass `20260930T142438Z-7e3f2a03`, 7,033 added). It was the first run of the new daily
  entry, which starts at once (OPERATIONS §13.2).
- Each host has a daily, enabled `reconcileTaggingEdges` entry, due each day at about 14:24Z (production) and 14:26Z
  (staging). Their first runs at the daily time, on 2026-10-01, found nothing to do (each entry's first run came at
  once when it was added, on 2026-09-30).
- The real-time path is **on** on both hosts, `state: "live"` (`GET /api/tagging-edges/realtime/status`). The pass
  after its first start found every relationship unchanged, and each relay's count of stamped taggings equalled its
  graph's `TAGS` count (at about 14:33Z: 7,026 on staging, 7,033 on production; each is one more after the live
  tagging below).
- A live tagging the owner published (`created_at` 15:20:29Z) reached each graph within 5 s of that time (3.5 s on
  production, 4.5 s on staging), with no pass.

**Story 3's evidence is in** (story 3 § Evidence, open question 14), with one day of organic taggings rather than the
several the question names:
- Story 4's deploys each ran a catch-up on 2026-10-01; each was `done` and reflected nothing.
- On 2026-10-01 the path reflected 32 additions and 3 removals on each host, with no refusal, failed read or database
  refusal.
- That day's runs at the daily time added, changed and removed nothing.

Still to do: another read of `GET /api/tagging-edges/realtime/status` in a few days, for open question 14's "the
following days", unless the owner accepts one day.

**C7: decided and done; shipped with story 4.** The owner accepted the widening of decision 5's crash
corner on 2026-09-30. The Architect reworded ADR `tagging-edges/0003` at story 4's Architecture (`88af7df3`), and its
other places (OPERATIONS §12.9, story 3) were reworded in story 4's implementation (`a2f38940`).

**Carry-forwards C1–C9: done.** All nine were placed under story 4 (`engineering-team/epics/tagging-edges.md`,
item 4, "Carry-forwards from story 3's review"). C2's ledger half is fixed and C8 is done (SL19 passed inside the local
container). The other seven were done on story 4's branch, `feat/tagging-edges-4`, and shipped with it: C1, C3, C5
and C7 in ADR 0003 at story 4's Architecture (`88af7df3`); C1, C3, C4, C5 and C7 in their other places (OPERATIONS
§12.9, story 3, the ledger row, and C5's comment in `realtime/index.js`) at its implementation (`a2f38940`); C6, C9
and C4's test-plan wording at its Test Design (`e6f124ea`).

**Story 4, shipped** (review PASS on 2026-10-01 after two rounds; on staging and production since 2026-10-01, PRs
#791 and #792; `engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.md`, ADR `tagging-edges/0004`): the tagging pipeline panel, Settings › Relays › **Tagging pipeline**, the sub-tab directly
after ⚡ Streaming ETL, seen by the owner and admins. It shows the pass (running or not, the latest and earlier passes,
the held removals, the backstop schedule), the real-time path, and the drift between relay and graph, explained
against the newest finished pass. It changes nothing. It reads story 2's `GET /api/tagging-edges/status` and `/held`,
story 3's `GET /api/tagging-edges/realtime/status`, and `GET /api/scheduled-tasks/list`, all public; and one new
route, `GET /api/tagging-edges/drift-counts`, for a signed-in owner or admin only. Story 4 also carries the
carry-forwards above. Its evidence on both hosts is in the story's § Evidence: an admin's view of the panel, and drift
counts that match direct counts (7,032 on staging, 7,039 on production). It also holds the owner's checks of
2026-10-01: the owner's and an admin's views, Recount pressed on production, and a user who is neither refused
Settings on staging.

**Stories 5 and 6, next.** At story 5's Planning (2026-10-01) the owner split the controls on story 4's panel by
what they act on:
- **Story 5** (`engineering-team/stories/tagging-edges/5-real-time-path-switch.md`, review PASS 2026-10-01 after two rounds; on
  staging since 2026-10-02, PR #805, with its staging evidence complete; not yet on main) is the real-time
  path's switch for the owner or an admin, with a prompt before off and a record of who changed it.
- **Story 6** (the epic's item 6, planned) is the pass's controls: Run and Stop for the owner or an admin, and Confirm
  for the owner only.

Until then the Task Explorer runs a pass, and OPERATIONS §12.8–§12.9's console snippets confirm held removals and
turn the path on and off.

Story 5 also carries story 4's review carry-forwards R2-1 to R2-14 (`reviews/tagging-edges/4-tagging-pipeline-panel.md`
§ "Re-review, round 2"; placed in the epic's item 5 by the owner on 2026-10-01): copy accuracy, docs wording and one
missing test, none of them a change to data.

**Ledger rows story 3 opened:**
- `2026-09-28-pass-relay-read-byte-cap`;
- `2026-09-29-strfry-delete-hides-next-write`;
- `2026-09-29-newest-entry-doc-tests-go-stale`;
- `2026-09-29-test-plan-misses-injected-seams`;
- `2026-09-29-realtime-engine-round-split`.

---

## 1. Read these first

| What | Where |
|---|---|
| The book and its acceptance frame | [`engineering-team/audits/tagging-edges/book.md`](../engineering-team/audits/tagging-edges/book.md) |
| The epic: stories 2–6, guardrails, each story's review carry-forwards (open: story 4's, under item 5) | [`engineering-team/epics/tagging-edges.md`](../engineering-team/epics/tagging-edges.md) |
| The contract every writer must use (binding) | [ADR `tagging-edges/0001`](../engineering-team/decisions/tagging-edges/0001-tagging-edge-contract.md): "Binding for later stories", and clarifications 1–13 |
| The edge as documented | BIBLE §6 "Social Graph Relationships (NostrUser → NostrUser)" |
| The code | `src/lib/tagging-edges/` (`taggingToEdge`, `standingEdge`, `revokeApplies`, `revokeTargets`) and `test/tagging-edge-contract.test.js` |
| Story 1's review items (carried into story 2, which shipped 2026-09-28) | [`engineering-team/reviews/tagging-edges/1-tagging-edge-contract.md`](../engineering-team/reviews/tagging-edges/1-tagging-edge-contract.md) § "Re-review": R2-NB1–3 (acceptance criteria) and doc nits R2-4–10 (story 2 docs tasks), as carried in the epic's item 2 |
| Open review items for story 5 | [`engineering-team/reviews/tagging-edges/4-tagging-pipeline-panel.md`](../engineering-team/reviews/tagging-edges/4-tagging-pipeline-panel.md) § "Re-review, round 2": R2-1–R2-14, as placed in the epic's item 5 (the same R2 numbers as story 1's, from a different review) |
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
- **Settings › Relays › Tagging pipeline** (tagging-edges story 4, ADR `tagging-edges/0004`), the sub-tab directly after ⚡ Streaming ETL: `TaggingPipelinePanel` in `ui/src/pages/settings/taggingPipeline/`, with its logic in `ui/src/utils/taggingPipelineView.js` and `ui/src/utils/taggingPipelineFetch.js`.
  - It shows the tagging pass, the real-time path and the drift between relay and graph, and changes nothing; story 5 adds the real-time path's switch and story 6 the pass's controls.
  - Its reads are the public status, held, realtime-status and scheduled-tasks list routes, plus `GET /api/tagging-edges/drift-counts`, the one read gated to a signed-in owner or admin.
- **Reconcile tasks have no dedicated control UI.** The Tagging pipeline panel above shows the tagging pass but runs nothing until story 6. The React control panel can only schedule them, as entries in the neighbouring **📅 Scheduled Tasks** sub-tab (`ScheduledTasksPanel`, `scheduledTasks/AddOrEditEntryModal.jsx`, `src/api/scheduled-tasks/`). The legacy Task Explorer (`/legacy/task-explorer.html`) can run registry tasks on demand through `POST /api/run-task` (not `reconcileAuthor`, whose `--pubkey` it cannot pass), and the legacy home page still carries Batch Transfer and Reconciliation buttons wired to the routes in § 2.2. Job-level inspection is BullBoard at `/admin/queues`.
- **House idiom for an operator panel:**
  - a `settings-section` / `settings-group` card with a coloured status dot and `btn-small` actions;
  - green/red flash banners;
  - a metrics row;
  - a monospace log box.
  - `RelaySettings.jsx` is a large monolith; its sub-tab is local state, so it isn't deep-linkable.
- **Mutations:** gate every one inside the handler with `if (!isOwner(req) && !req.localTrusted)`, following the `src/api/strfry/wipe.js` pattern.

### 2.4 Task infrastructure (reusable as is)

- **Task registry:** `src/manage/taskQueue/taskRegistry.json` gives one BullMQ queue and worker per task behind `/api/run-task`. Copy the field set of `reconcileRecent`'s entry. The `script` must be a bash entry: `launchChildTask.sh` always runs `bash "$child_script"`, so a Node sweeper needs a `.sh` wrapper, as `reconcile*.sh` are. A new task needs a backend restart before it can be queued.
- **Schedules:** each enabled entry with a valid schedule and a registered task in `/var/lib/brainstorm/scheduled-tasks.json` becomes a BullMQ Job Scheduler (one per entry, `sched:<entryId>`). The Scheduled Tasks modal lists any non-continuous registry task, so an operator can schedule it with no new code. A shipped seed entry (`freshInstallEntries()`) reaches only instances that have no schedule file yet (OPEN.md row 336); staging and production need the operator to add it.
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
  - *(Settled by `tagging-edges/0002`: a Node runner behind a `flock` wrapper, a new strict reader `src/lib/strfryScanStrict.js` rather than `scanLocalStrict`, and a frozen removal limit whose held removals the owner confirms.)*
- **Recommended shape for story 3:** a websocket `REQ` subscriber to local strfry with `{kinds:[39999], "#z":[…]}` plus `{kinds:[5]}`.
  - It sees every write path, including websocket publishes the patch misses, and needs no strfry rebuild.
  - The in-stack precedent, `nostr-search/src/ingest.js`, is thin. It subscribes with `{kinds:[0]}` and keeps no
    high-water mark, sends no `since` and persists nothing: its only state, a `seen` map of `created_at` per pubkey
    for de-duplication, lives in memory. Its reconnect waits a constant 1 s (each new `connect()` resets the doubled
    backoff to 1 s). Its resync re-sends the same `REQ`, which the relay answers with at most 500 stored events
    (strfry's `maxFilterLimit`). So it is no model for catching up after a gap.
  - Run it as its own supervisor program, so stopping taggings never stops follows.
  - *(Settled by `tagging-edges/0003`: a `limit:0` subscription with no `since` as a trigger only, and catch-up by an
    address-keyed id diff over a strict scan, since a `since` replay compares `created_at` and drops back-dated
    history; its own supervisord program, `tagging-edges-realtime`, which ships off.)*
- **Recommended shape for story 4:**
  - a new sub-tab beside ⚡ Streaming ETL, or an extracted, parameterised version of `StreamingETLPanel`;
  - counters the consumer writes explicitly (a Redis hash or a status file), not log scraping;
  - a drift figure: `GET /api/strfry/scan/count` with the `nostr-user-tag` `#z` against the `TAGS` edge count;
  - owner-gated POSTs.
  - *(Settled by `tagging-edges/0004`: a new sub-tab, Settings › Relays › Tagging pipeline, that reads the pass's
    report and the path's status through their routes, and counts drift through a new owner-or-admin route,
    `GET /api/tagging-edges/drift-counts`; story 4 sends only GETs. The POSTs went to the next two stories, split at
    story 5's Planning: the real-time path's switch, for the owner or an admin, is story 5's (`tagging-edges/0005`),
    and the pass's run, stop and confirm are story 6's.)*

## 4. Decisions story 2 will ask the owner

1. **Test data.** The local stack has no taggings and no follows, and there is no SSH to the droplets. Proposed:
   - fixtures for the suite;
   - a local end-to-end run on the public census events, imported into the local relay only (router streams are disabled locally);
   - staging as the first real backfill.

   *Settled by `tagging-edges/0002`:* fixtures for the suite, then a local end-to-end run and the staging backfill as evidence (story 2 Open question 7).
2. **Missing NostrUser ends.** Create them (principle 2: accept every signed event), or link only existing nodes? About 91% of taggings are test fixtures (row `2026-09-27-test-fixture-taggings-on-prod-relays`), so creating ends adds a few thousand fixture NostrUsers on production. *Settled by `tagging-edges/0002`:* created, by a bare keyed `MERGE` in the same transaction as the relationship (D6).
3. **The uniqueness rule on `TAGS.address`.** Adding it to `src/api/status/queries/expectedNeo4jSchema.js` makes the server's constraints check report "not set up" on every existing instance until the rule exists, and nothing re-runs `setup/neo4jConstraintsAndIndexes.sh` on deploy. *(Corrected 2026-09-27, row `2026-09-27-handoff-overstated-constraint-gate`:)* that disables Install Firmware only while firmware is not fully installed, so on staging and production nothing visible flips, and the real risk is a writer running before the rule exists. A third list of expected rules, `ui/src/pages/Dashboard.jsx:223-232`, drives the Dashboard's banner and fix button. It must exist before the first write. **Decided at story 2 Planning:** in place from deploy, with no owner step (story 2 AC-6).
4. **Revokes.** Revokes don't travel between instances today. Accept that the sweep sees only local revokes, or fix the router streams first? *Settled by `tagging-edges/0002`:* the relay wins — the pass follows this instance's relay and no writer reads kind 5 (D2, A7); cross-instance revokes stay out of scope (row `2026-09-27-revokes-do-not-travel`).
5. **Scheduling and locking.** Ship the schedule enabled or disabled? And should the sweep take `neo4j-heavy`? Measure its lock hold time on staging. *Settled by `tagging-edges/0002`:* a disabled daily seed on fresh installs, and the pass takes `neo4j-heavy` (D10); its 30-minute time-out is checked against the measured `durationMs`.
6. **Where the canonical stamp pubkey comes from.** A lazy `require` of `src/api/profile-tags` (precedent: `src/api/assistant/identificationTaggings.js:72`, which reads `NOSTR_USER_TAG_Z_TAG`). That module exports two of the three full z strings (`NOSTR_USER_TAG_Z_TAG`, `TAG_PINNING_Z_TAG`; not `TAG_Z_TAG`) and the runtime `TA_PUBKEY`, but not `LEGACY_Z_TAG_PUBKEY`, and the contract takes bare pubkeys, so the writer either parses the pubkey out of `NOSTR_USER_TAG_Z_TAG` or adds the constant to the exports. Or an ADR 0015 amendment moving the literal into a pure constants module. Never a new literal. *Settled by `tagging-edges/0002`:* the canonical pubkey is parsed from `NOSTR_USER_TAG_Z_TAG`, required lazily inside the runner's getter (runner step 4).

Binding already (ADR 0001, epic): refuse to start without both stamp pubkeys (64-hex per ADR 0001; story 2's ADR adds "lowercase", carry-forward R2-5); lock, re-read and verify the full stored state in the write transaction; the planner is pinned against `standingEdge` with two documented divergences (ADR `tagging-edges/0002` A1); count retirements in the mass-delete guard.

## 5. Environment notes for this machine

- **Measuring the droplets:** no SSH keys here. Production, staging and tags were measured read-only through each host's public `GET /api/strfry/scan/stream` and `/api/strfry/scan/count`. Only write Cypher is owner-gated on `POST /api/neo4j/query` (`src/api/neo4j/queryPost.js:35`); read Cypher is public (`PUBLIC_MUTATIONS` in `src/middleware/auth.js`). So each host's graph can be measured read-only with no session, for example how many taggers and targets already have NostrUser nodes (§ 4 decision 2, which story 1 left open). Send the query signed out: a signed-in non-owner, non-customer session is refused.
- **Node 16 host:** it fails `event-less-create-set`, `honest-publish-reporting` and `setup-alert-polish`, because there is no global `fetch` and no `require` of ES modules. They pass in CI (Node 22). Compare full runs suite by suite against a labelled baseline, and quote `npm run gate:status` lines.
- **zsh trap:** `"$VAR:tag"` applies zsh's `:t` modifier. Write `"${VAR}:tag"`.

## 6. Pending protocol work that could change the input

- **Worksheet W19** (on hold, issue #761): taggings would point their `z` straight at the tag element. If adopted, the contract's stamp rule (step 2) needs the second shape. Keep that rule in one place.
- **The Pins draft** (§ 4, open question 2) proposes unpinning a *pinning* by republishing it with `polarity "0"`, because deletions propagate unreliably. If taggings adopt the same revoke, the contract already stores `"0"` raw, and ADR 0001's reader rule buckets it as neutral.
