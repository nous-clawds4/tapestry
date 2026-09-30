# ADR 0003: The real-time path — hear every write, decide from strict reads, remove only on a revoke

**Status:** Accepted; amended by A1 (2026-09-29)
**Date:** 2026-09-28
**Story:** `engineering-team/stories/tagging-edges/3-real-time-path.md`

## Context

Story 2's gap-filling pass (ADR `tagging-edges/0002`) writes `TAGS` only when it runs: on demand, or from a schedule
entry that no public host has. Story 3 makes a tagging change that reaches this instance's relay, by any way in,
show up within a minute, catch up by itself after downtime, and ship turned off behind an owner-only switch. The
story's seven criteria, and its settled and confirmed items 1–15, are the requirements. In short:

- **AC-1** — a stored tagging is reflected within 1 minute, whatever way it came in and whatever its `created_at`.
  A burst of up to 10,000 changes stored within a minute is reflected within 5 minutes.
- **AC-2** — a revoke is reflected within 1 minute. A kind-5 only prompts a look; the relay decides. There is no
  count limit.
- **AC-3** — failures lose nothing and remove nothing wrongly. A removal needs an event about that tagging and a
  successful read of the relay at that address taken after the event. A bad setup writes nothing.
- **AC-4** — after any downtime the path catches up within 5 minutes, back-dated history included. No start ever
  creates a relationship for a version held since before the first start. A lost record is never treated as a
  first start.
- **AC-5** — it ships off. The owner-only switch survives deploys, and off means off. It recovers alone, is
  independent of follows, and never refuses or blocks a pass. The graph never goes back to an older relay read,
  except in ADR 0002's two accepted interleavings.
- **AC-6** — a status, readable without a shell, at most a minute stale, that never shows a credential or a
  database or relay address.
- **AC-7** — exactly the nine contract properties, nothing else in the graph moves, and scoring and the follows
  consumer do not fail because of a real-time write, apart from a residual the owner accepts at this gate.

**Binding inputs.**

- ADR `tagging-edges/0002` § "Binding for story 3" (items 1–4), its guard and read-order argument, its two accepted
  residuals, D10, owner decisions 2 and 11, and clarifications C1–C19.
- ADR `tagging-edges/0001` § "Binding for later stories", as amended by 0002 (A1–A11), which names the real-time
  path. In particular: both stamp pubkeys lowercase 64-hex (A3), the R2-NB3 removal rule (A4), and kind 5 as a
  trigger only (A7).

**Concepts.** Oriented via the local Concept Graph (`/api/concept-graph/node/39998:8387ec0e…:nostr-user-tag` and its
neighbors). The path reads elements of `nostr-user-tag` (both stamps) and of `tag` (tag elements named by id) and
writes story 1's `TAGS` relationship. No concept definition changes, so **no firmware reinstall**.

**Facts this design rests on.** These come from the orientation of 2026-09-28, the design panel's read-only probes
and the ADR review's probes. The strfry facts come from the 1.1.0 source in the container.

- **What the relay tells a live subscriber.**
  - A REQ with `limit:0` answers EOSE at once (`DBQuery.h:311`). The monitor replays from the REQ's snapshot levId
    (`QueryScheduler.h:21`, `RelayReqMonitor.cpp:30-45`) and delivers every later-stored match, from every writer
    process (an inotify watch on `data.mdb`, 100 ms debounce).
  - Live matching applies `since`/`until`, never `limit`, so back-dated events are delivered when the filter has no
    `since`.
  - Within one connection there is no gap. Across a reconnect, events stored in between are delivered by no
    subscription.
  - Removals and replacements emit nothing. There is no arrival-order cursor.
- **How strfry stores and deletes.**
  - One version is kept per (kind, pubkey, first `d`); a newer one deletes the older.
  - An `e` deletion blocks only that id plus its author (`events.cpp:274`), so after an id-only revoke an older
    version with another id can be stored again.
  - An `a` deletion deletes that author's versions with `created_at` ≤ its own. strfry acts only on tag values of
    255 bytes or fewer (`events.cpp:48`, `constants.h:5`), and parses the kind with `stoull` (leading zeros and `+`
    accepted).
  - `#e`, `#p`, `ids` and `authors` are matched by hex (upper case accepted), but events are printed as published.
    `#d` matches any `d` tag.
  - `strfry scan` de-duplicates within one run only.
  - In this patched build, every strfry command, `scan` included, first makes a blocking connect to Redis
    (`redis:6379`, no time-out) and carries on without it if that fails.
- **Local timings** (7,030 taggings). One `strfry scan` costs about 22–24 ms, almost all of it process start.
  Measured scans:

  | Scan | Time | Output |
  |---|---|---|
  | a filter array of 200 one-address filters | 28–29 ms | exactly 200 events |
  | 1,000 ids | 30 ms | |
  | the full two-stamp scan | 45–50 ms | 6.09 MB |

  Staging's full relay read in its backfill took 3,024 ms against 67 ms locally (45×, about 2 MB/s).
- **Limits.** `MAX_ARG_STRLEN` in the container is 131,072 bytes (per argv string). The relay's
  `maxWebsocketPayloadSize` is 131,072 (about 1,790 `e` tags per websocket kind-5), `maxEventSize` 1,048,576, and
  `maxNumTags` 8,000 (import can reach it).
- **Neo4j at 7,030 `TAGS`.**
  - `READ_AT` over 500 addresses: 56–67 ms.
  - `WHERE r.eventId IN $ids` with 500 ids: 46–155 ms (a relationship-type scan; no `TAGS.eventId` index exists).
  - All 7,030 `(address, eventId)` pairs: 14–33 ms.
  - Forseti (5.26.10, `ForsetiClient.shouldAbort`) makes the transaction holding fewer active locks the deadlock
    victim; on a tie, the younger one.
  - `TransactionTimedOut`, `TransactionTimedOutClientConfiguration` and `LockClientStopped` are ClientErrors, which
    the driver does not retry.
  - Scoring runs `CALL { … } IN TRANSACTIONS OF 10000 ROWS` with no `ON ERROR` (`src/algos/calculateHops.sh:13-15`).
- **Heap.** Node holds about 330 bytes of heap per tagging id in the id sets; parsed events take about 5.8× their
  JSON size.
- **Deploys and supervision.**
  - `docker/supervisord.conf` is baked into the image (`Dockerfile:106`, after `COPY .` at `:92`), and every deploy
    runs `docker compose up -d --build`. Locally only the repo is bind-mounted.
  - A program that exits within `startsecs` `startretries` times goes FATAL.
  - A supervisord child inherits `NEO4J_PASSWORD` but not `NEO4J_URI` / `NEO4J_USER`.
- **The launcher's pgrep guard.** It skips a new pass while any process's command line contains
  `pipeline/tagging-edges/reconcileTaggingEdges` (`src/manage/taskQueue/launchChildTask.sh:32-43`, `:295-311`). A
  `strfry scan` child's argv carries the filter, including publisher-controlled `#d` values.
- **Kind 5 is permissionless.** Production holds 9,341 kind-5 events (13.5 MB). None of them is a tagging revoke,
  and they average about 1.4 KB. The relay has no write-policy plugin.
- **The pass's report.**
  - It is written pessimistically before the pass's graph read, and `endedAt` is written after its last write.
  - A pass killed mid-run keeps `endedAt: null` (`reconcileTaggingEdges.js:160`, `:253`), and `previous` keeps 9
    runs.

## Options considered

### D1 — What hears a change

- **A. A live-only websocket subscription as a trigger.** Filters `{kinds:[39999], '#z':[both nostr-user-tag
  stamps], limit:0}` and `{kinds:[5], limit:0}` to `ws://127.0.0.1:7777`. A catch-up runs after every connect, and
  a full safety diff every 10 minutes.
  - It hears every writer within about 1–2 s and costs nothing while idle.
  - Results are triggers only; strict scans decide.
- **B. Polling.** A full strict stamp scan every 15–30 s, diffed by id.
  - It keeps strfry busy about 10–20% of the time on staging, and that grows with the relay.
  - It still needs a revoke mechanism.
- **C. The follows pipeline's Redis hook, or a strfry write-policy plugin.**
  - Both need a relay change on every host (confirmed item 13 says no).
  - The hook misses websocket writes and delivers at most once; the plugin misses import.

### D2 — Where it runs

- **A. Its own supervisord program.** A bash wrapper idles while the switch is off (no Node process) and backs off
  between failed runs, so it never exits and never goes FATAL. A Node child runs while the switch is on.
- **B. Inside the control-panel process**, started at boot like `ensureTagsConstraintOnBoot`.
  - No image change, and an instant off.
  - But a flood's JSON work or a defect stalls every API route, every backend restart interrupts the path, and its
    SIGTERM path exits with no cleanup.
- **C. A scheduled task.** The queue can wait up to 4 h for `neo4j-heavy` and can join a finishing job, so it cannot
  promise the minute.

### D3 — Knowing what changed while it was away (no arrival cursor exists)

- **A. An address-keyed id diff.** The path keeps three maps:
  - S: completed or baseline tagging id → address;
  - H: heard but not yet completed tagging id → address; *(Amended by A1-1: the lineage replaces H.)*
  - B ⊆ S: the first-start baseline.

  At each catch-up and safety diff, one streamed strict stamp scan finds arrivals (ids not in S, back-dated ones and
  still-pending heard ones included), plus look-only prompts where the scan and the graph disagree. Deletion
  candidates are recorded or seen ids the scan no longer finds, checked by author-scoped kind-5 scans. A successful
  read at an address drops the ids that address no longer holds, so a version that leaves and comes back is seen
  again.
- **B. The same diff, but reading the whole kind-5 corpus.** Simpler, but its cost grows with anyone's deletions, and
  a flood blocks every catch-up.
- **C. A `created_at` (`since`) watermark.** It drops back-dated history, so AC-1 and AC-4 fail.
- **D. A NIP-77 negentropy client.** The same diff with more code than a local scan.

### D4 — Which removals may apply

- **A. A pure gate that only holds `decideAddress`'s actions back.**
  - A `not-on-relay` removal needs a revoke: a deletion from the address's author naming a version the relay held
    there (by id, through S or H), or the address itself, with `revokeApplies` holding against the recorded version.
  - A `non-tagging` removal needs a version stored at that address, or such a revoke.
  - A create is held while the relay's version is in B.
- **B. Also let a version prompt allow a `not-on-relay` removal.** A wipe landing between the prompt and the look
  (a queue behind a burst, a Neo4j outage, a re-look) would remove with no limit, which AC-3 and story item 9
  forbid.
- **C. Let every `decideAddress` removal apply.** A wipe removes with no limit (AC-3 fails).

### D5 — Turning a deletion into addresses

- **A. In memory, from the path's own maps; the author's deletions only.**
  - A kind-5's `e` targets resolve through S ∪ H (id → address).
  - Its `a` targets count only at addresses the path knows (S ∪ H, or the graph's keys).
  - A target whose address's author is not the kind-5's author is dropped at once.

  A revoke the relay acts on always names a version it holds, and S ∪ H covers every stamped version on the relay,
  so nothing is missed. There is no graph read, no index, no deletion queue and no cross-author fan-out: an author
  can name only their own known taggings, so a flood of kind-5s from anyone costs one set lookup per target. *(Amended by A1-3 and A1-15: an `e` target resolves only
  as its address's latest learned version.)*
- **B. A graph lookup by event id** (`WHERE r.eventId IN $ids`, with a `tags_eventId` index later), plus looks
  prompted by other authors' deletions.
  - A type scan per 500 ids.
  - An unbounded queue of summaries awaiting lookup.
  - Anyone's kind-5 can fan out to 500 looks.
  - It needs a byte budget, a target budget and a schema rollout to stay bounded.

### D6 — Coexisting with the pass

- **A. No lock, and a post-pass re-look.** Every address a round looked at while a pass overlapped it is looked at
  again once that pass ends. Both residuals are repaired within about a minute, with or without a schedule. A dead
  pass's window ends when the path first sees it dead.
- **B. Hold `pass.lock` shared around each real-time write** (binding 4's option).
  - Real-time writes would wait out whole passes (up to the 30-minute time-out).
  - The wrapper's non-blocking start would refuse a pass started during a write.
  - Shared holders can starve the exclusive pass.
- **C. Keep the residuals until the next pass.** On staging and production that means indefinitely.

### D7 — Coexisting with scoring and the follows consumer

- **A. Small ordered transactions, and a named residual.** At most 25 rows (typically 1), sorted by `(from, to)`,
  through `executeWrite`. Forseti makes the smaller transaction the victim, and the path retries.
- **B. Take `neo4j-heavy`.** Writes would wait behind scoring and stale leases for up to 4 h (AC-1 fails).
- **C. Pause while Redis shows a heavy holder.** AC-1 fails during every scoring run, and the path gets coupled to
  the queue's keys.

### D8 — Status and switch

- **A. Files in `<stateDir>/realtime/`, and two new routes.** A public `GET …/realtime/status` and an owner-only
  `POST …/realtime/switch`. The Node process polls the switch file. Error text is fixed text only.
- **B. A `realtime` key in `GET /api/tagging-edges/status`.** It changes story 2's pinned response.
- **C. The route signals the process by pid.** That risks pid reuse and cross-process coupling, to gain about 3 s.

## Decision

We chose **D1-A, D2-A, D3-A, D4-A, D5-A, D6-A, D7-A and D8-A**. Together: a supervised, usually idle program that
hears every write through a live subscription and decides each touched address from strict reads, taken
graph-first. It writes only through the pass's port and removes only on a revoke. It never creates what the backfill
owns, catches up by an address-keyed id diff, repairs the pass's two residuals after each pass, and bounds its memory
and work whatever anyone publishes.

```
supervisord [program:tagging-edges-realtime]
  └─ bash src/pipeline/tagging-edges/realtime/run.sh     (flock -n 8 on realtime/daemon.lock; never exits; idles while
       │                                                  switch.json is not "on":true; backs off 1→30 s between runs)
       └─ ( . /etc/brainstorm.conf && exec node --max-old-space-size=384 src/pipeline/tagging-edges/realtime/index.js )
            identities ─► subscribe (limit:0) ─► EOSE ─► first start: baseline │ else: catch-up ─► live rounds
            (graph and schema checked per write round; the subscription never waits for them)
            round: ready prompts (T18 order) ─► graph readAt (t0) ─► strict relay scans at those addresses
                   (t1 > t0) ─► element scan ─► de-duplicate by id ─► decideAddress ─► gateAction
                   ─► writes through graph.js (≤ 25 rows / tx) ─► journal ─► post-pass re-look check
            every 1 s: switch poll (off ⇒ flush, exit within 5 s) · every 10 min: safety diff · ≤ 30 s: status.json
GET  /api/tagging-edges/realtime/status          public
POST /api/tagging-edges/realtime/switch {on}     owner only → switch.json
```

### What it hears (D1-A, D5-A)

**The subscription.** One websocket to the in-container relay, `ws://127.0.0.1:7777`. It does not go through
`/relay`, so it avoids nginx's 60 s idle drop and the NIP-50 proxy. `TAGGING_EDGES_REALTIME_RELAY_URL` overrides the
address for tests; the status never shows it. One REQ (subscription id `tagging-edges-realtime`) carries two
filters, both with `limit:0` and no `since`:

- `{kinds:[39999], '#z':[39998:<canonical>:nostr-user-tag, 39998:<local>:nostr-user-tag]}`;
- `{kinds:[5]}`.

**Keeping it alive.** The client pings every 30 s; no pong within 10 s means reconnect. Any close, `CLOSED` or
`NOTICE` also reconnects, with backoff 1→15 s. Every connect is followed, after EOSE, by a catch-up (D3):

- at most one per 30 s: a later connect's catch-up is deferred to the 30 s mark, never skipped;
- a connect during a running catch-up schedules one more after it.

**A result is a trigger, never state (binding 3).** Every decision reads the relay again.

- **A stamped kind 39999.** The path keeps its id and address, from `taggingToEdge`'s `edge.address` or its
  refusal's `address`. The address becomes a **version prompt** `{id}`, and the id enters H (journal `v`) *(amended by A1-2: it becomes its address's lineage top)*. Events
  with no address are dropped.
- **A kind 5 is resolved on receipt, in memory, and never queued as such.** From `revokeTargets(ev)`:
  - each lower-cased `e` target found in S ∪ H gives its address *(amended by A1-3: only the lineage's top)*;
  - each `a` target that is a tagging address of at most 255 UTF-8 bytes (strfry acts on no longer value) gives its
    address, but only when the path knows it: S ∪ H records an id there (an address → ids index kept with the maps),
    or the address was among the graph's at the last `readKeys` (refreshed at every catch-up and safety diff, and
    extended by the path's own creates);
  - a target whose address's pubkey segment is not the kind-5's pubkey is dropped. strfry does not act on another
    author's deletion, so it is no revoke.

  Each remaining address gets a **revoke prompt** `{kind5Id, created_at, by: 'e' | 'a', target}`. That is the only
  part of the event kept, O(1) per address (journal `d`). A kind-5 none of whose targets resolved is counted once in
  `deletionsMatchedNothing` and forgotten.
- **Why S ∪ H is enough.** *(Replaced by A1-3 and A1-15.)* The relay acts only on a version it holds, and S ∪ H covers every stamped version on the
  relay: the baseline, everything heard since, and every catch-up arrival. So a revoke the relay acts on always
  resolves. A kind-5 naming a recorded version that has already left the relay is found, if its author made it, by
  the next catch-up's candidate scan (D3 step 3).
- **An author's bulk revoke** naming thousands of their own recorded taggings becomes that many address prompts. It
  is a burst of that many changes, bounded like any other (AC-1; owner decision 9). A target the path does not know
  costs one set lookup and queues nothing, so junk addresses under a fresh key cannot fill the queue.

**Lanes and rounds.** A round's addresses are taken in this order:

1. while catch-up work is pending, its share comes first: up to 100 addresses and up to one fifth of the round's kept
   budget (3.2 MiB), read before any live or re-look address *(amended by A1-14)*;
2. live version prompts and live revoke prompts (the live lane);
3. re-looks;
4. further catch-up work.

So neither a live stream nor padded live events can starve a catch-up. Under a sustained live load a catch-up
proceeds at 100 or more addresses per round (owner decision 9).

A round starts 250 ms after the first prompt queued while idle, or as soon as the running round ends, whichever is
later. That 250 ms is a cap, not a reset: later prompts never postpone it.

**The safety diff.** Every 10 minutes the path runs the full D3 diff (arrivals, look-only prompts and deletion
candidates) and compacts when the queue is empty. This catches a subscription that stays connected but stops
delivering, revokes included, within about 10 minutes, except a version both stored and revoked by id while nothing
was delivered, which waits for the pass (decision 5's first corner). Ledger row
`2026-09-29-strfry-delete-hides-next-write` records a strfry trigger (owner decision 10). *(Amended by A1-16 and A1
clarification 24.)*

### Where it runs (D2-A)

**The program** in `docker/supervisord.conf`:

```
[program:tagging-edges-realtime]
command=/bin/bash /usr/local/lib/node_modules/brainstorm/src/pipeline/tagging-edges/realtime/run.sh
user=root
autostart=true
autorestart=true
startsecs=2
startretries=100
stopasgroup=true
killasgroup=true
stopwaitsecs=10
priority=35
stdout_logfile=/var/log/supervisor/tagging-edges-realtime.log
stdout_logfile_maxbytes=5MB
stdout_logfile_backups=2
stderr_logfile=/var/log/supervisor/tagging-edges-realtime-error.log
stderr_logfile_maxbytes=5MB
stderr_logfile_backups=2
```

The name matches none of the words T9 forbids (`queue|worker|bull|taskqueue`).

**The wrapper `run.sh`.**

- It makes `<stateDir>/realtime` (mode 0700), then runs `exec 8>>"$DIR/daemon.lock"; flock -n 8 || { sleep 30; exit
  75; }`. A second instance idles and exits; it never runs Node.
- It does not source `/etc/brainstorm.conf` itself. Each Node start sources it in a subshell,
  `( . /etc/brainstorm.conf && exec node --max-old-space-size=384 …/realtime/index.js ) & child=$!; wait "$child"`,
  so the file is re-read at every Node start. The file's lines are `export …`; a failed source exits non-zero into
  the backoff.
- Its loop reads `switch.json` every 2 s with a pure-bash match of the canonical `"on":true` (no spawn), and starts
  Node only while on.
- A TERM or INT trap sends TERM to the child, waits for it, and exits 0. A background job in a non-interactive bash
  starts with SIGINT ignored, so TERM is what is forwarded.
- A non-zero exit, or any exit within 60 s of start, backs off 1→2→4…30 s (reset after 60 s of healthy running). It
  never exits by itself, so supervisord never marks it FATAL (AC-5).

**Node refuses a hand run.** It refuses unless `/proc/self/fdinfo/8` shows a `FLOCK … WRITE` lock whose `ino` equals
`daemon.lock`'s. This is `state.lockHeld(fd, { file })`, now comparing inodes (C20 below).

**Node never exits on a dependency failure.** It waits out the graph, the relay and a bad setup in-process with
capped backoff. It exits only on the switch (0), a signal, or an uncaught error (after writing the status). A first
start subscribes and takes its baseline without any graph contact (§ First start).

**No command line of the path matches the pass's pgrep pattern.** Its files live under
`src/pipeline/tagging-edges/realtime/`, and `scanStrict` writes `/` as `\/` in the filter it puts on argv. That is
JSON-equivalent, and strfry parses it. So a strfry child carrying a publisher's `#d` can never match the guard
(AC-5: a pass is never skipped because of the path).

**Cost.** While off (the shipped state), a bash loop of about 3 MB. While on, one Node process of about 60 MB. Its own
driver comes from the environment through `graph.openGraph`, never the shared `getDriver()`, which logs what it reads.

**Locally**, the program exists only after `docker compose up -d --build` from the repo root (`COMPOSE_FILE` comes from
`.env`; the named volumes and the 7,030 dev `TAGS` stay). For quick iteration without a rebuild:

```
docker cp docker/supervisord.conf tapestry:/etc/supervisor/conf.d/tapestry.conf \
  && docker exec tapestry supervisorctl reread \
  && docker exec tapestry supervisorctl update
```

That adds the new program, restarts no unchanged one, and is lost at the next container re-creation. `/cycle-local`
alone does not install it.

### Knowing what changed while it was away (D3-A)

**State** lives in `<stateDir>/realtime/`, on the `tapestry-data` volume, beside `report.json`. The pass's `prune()`
never touches it.

| File | Shape | Written |
|---|---|---|
| `switch.json` | `{"version":1,"on":true,"changedAt":ISO,"changedBy":"<8-char prefix>"}`, canonical compact form | by the owner route only |
| `started.json` | `{version:1, firstStartedAt}` | once, after `record.json` |
| `record.json` | `{version:1, firstStartedAt, identities:{canonical, local}, compactedAt, seen:[[id, address]], heard:[[id, address]], baseline:[ids ⊆ seen], refusedSeen:[[id, address]], pending:[{address, lane, prompts, attempts, notBefore}], rechecks:[{address, runId, prompts}], deadSeenAt:{runId: at}, parked:[…], sha256}` | at compaction, atomically |
| `journal.jsonl` | one line per fact (below) | flushed and fsynced by a 250 ms timer whenever lines are buffered, in every state including the waiting ones; also at round end, on switch-off and on SIGTERM. `b` lines are fsynced at once. While appends keep failing (a full data volume), lines, `b` lines included, wait in memory: § Failure handling, "Journal appends that keep failing". |
| `status.json` | § Status | by the path |
| `daemon.lock` | the single-instance flock file | by the wrapper |

Journal line types:

| Line | Fact |
|---|---|
| `v {id, a}` | version heard (into H) |
| `d {a, kind5Id, created_at, by, target}` | revoke prompt at an address |
| `c {id, a}` | completed (H to S) |
| `x {a, dropped:[ids]}` | address read; the ids the S / H / B / refusedSeen drop rule removed |
| `b {id}` | baseline drop |
| `f {id, a}` | refused id seen |
| `r {a, runId}` / `rc` | re-look scheduled / done |
| `p {a, code}` | parked |
| `k {runId, at}` | dead pass seen |

**Prompts are O(1) per address.** An entry keeps:

- at most the latest version prompt `{id}`;
- the revoke prompts that name a version or the address, de-duplicated by `(by, target)`, keeping the latest
  `created_at`;
- a look-only flag.

Re-looks are de-duplicated by `(address, runId)`, merging their prompts. `record.json` therefore scales with addresses,
not with events. `identities` holds full pubkeys; they are never served. Whole-file writes use `state.writeAtomic`.

**Journal rules.**

- At open, before the first append, the journal is cut back to just after its last newline and fsynced.
- Replay is streamed line by line. A line that fails to parse is skipped and counted (`journal.skippedLines`); each
  line is one fact, and a skipped `c` or `b` errs on the conservative side.
- A journal that cannot be opened or read at all is a lost record (`reason: 'journal-unreadable'`).

**Compaction** runs at the end of every catch-up, after a round once `journal.jsonl` passes 1 MB, and at a safety diff
when the queue is empty. It snapshots the state, writes `record.json` and truncates the journal in one synchronous
step, with no `await` in between.

**The catch-up** runs at every start that is not a first start, at every (deferred) reconnect, when the backlog cap
schedules one, and when a pass that overlapped a round ends or is first seen dead:

1. **Graph keys.** `readKeys()`: `MATCH ()-[r:TAGS]->() RETURN r.address, r.eventId` (about 7k rows, 14–33 ms).
2. **Arrivals and look-only prompts.** One strict stamp scan (the two `nostr-user-tag` stamps), streamed through
   `scanStrict`'s new `onEvent`; it keeps `(id, address)` pairs.
   - **Arrivals** are scanned ids not in S. That includes heard ids still pending, and those whose prompt was dropped.
     Each becomes a version prompt, back-dated history included. `created_at` is never used. *(Amended by A1-9:
     every scanned pair is also learned, A1-2.)*
   - **Look-only prompts** come from comparing the scan with the graph keys:
     - (i) a scanned version at an address the graph records with a different event id;
     - (ii) a scanned version at an address the graph does not hold, whose id is in S but not in B;
     - except an `(id, address)` in `refusedSeen`.

     A look-only prompt lets its round create, update or move. It never enables a removal.
3. **Deletion candidates.**
   - Graph-recorded event ids that the scan no longer finds.
   - Ids in S ∪ H that the scan no longer finds, at an address the graph holds with another event id. This covers a
     heard version revoked while its prompt was dropped or its round had not run. *(Amended by A1-9: lineage tops.)*

   They are grouped by their address's pubkey. Each author's ids, and separately its addresses, are split into filters
   sized to the argv budget after `escapeFilterArgv`, about 1,400 ids per filter, as `addressScanFilters` does. They are
   checked with strict, author-scoped scans streamed through `onEvent`, each with `maxBytes` 8 MiB and a 60 s
   time-out:
   - `{kinds:[5], authors:[pk], '#e':[pk's candidate ids]}`, predicate: kind 5, the requested pubkey (lower-cased),
     and some lower-cased `e` requested;
   - `{kinds:[5], authors:[pk], '#a':[pk's lower-case candidate addresses ≤ 255 bytes]}`, predicate: kind 5, the
     requested pubkey, and some raw `a` requested.

   Each kind-5 kept is cut to the targets it names, and becomes a revoke prompt at that address. A failed scan
   (`filter-too-large`, `too-large`, a time-out) is bisected down to one id or one address. Only a single-target scan
   that still fails is a contained failure (counted, backed off, retried at the next diff). It never aborts the
   catch-up, and only that author's own kind-5 volume can cause it. *(Amended by A1-9: a found revoke is journaled.)*
4. **Restore.** Pending entries, H, parked addresses, re-looks and `deadSeenAt` come back from `record.json` plus the
   journal. *(Amended by A1-9 and A1-12.)*
5. **Process** the queue in rounds (below). Arrivals are processed in chunks of 5,000 addresses. The catch-up is done
   once every address it queued has had one attempt, whether decided, parked or failed. A failed address stays pending
   with its backoff, but does not hold the catch-up open. The status records the outcome, duration and counts.
6. **Compact.**
   - S becomes (S ∩ scanned) ∪ completed.
   - H drops ids completed, or neither scanned nor candidates. *(Amended by A1-7.)*
   - B becomes B ∩ scanned, and `refusedSeen` becomes `refusedSeen` ∩ scanned.

**A catch-up read fails** (the stamp scan or `readKeys`): that catch-up is aborted without compaction. The status gets
`catchUp.last {outcome: 'failed', stage, startedAt, endedAt}`, the failure is counted in `failedReads.catchUp`, and
the catch-up is retried with 5→60 s backoff. It therefore completes within AC-4's bound once the read succeeds.

**The stamp scan** has no byte cap, because memory is bounded by the id count, not bytes. It has its own time-out of
10 minutes. Owner decision 9 names the ceiling this puts on AC-4.

**First start.** None of `started.json`, `record.json` or `status.json`'s `firstStartedAt` exists. Then:

1. Once the identities resolve and the relay answers, subscribe and wait for EOSE. No graph contact and no schema check
   happen first, so a Neo4j outage cannot delay the baseline. *(Amended by A1-8: the census comes first, at most 10 s.)*
2. Take the stamp scan. Buffer every id delivered on the subscription since the REQ, from before or after the scan.
3. S = the scanned `(id, address)` pairs, and B = the scanned ids minus every buffered id. A live delivery has a levId
   after the REQ's snapshot, so it was stored after the first start began.
4. Write `record.json`, then `started.json`, then the status. Then process the buffer.

It takes no action on the baseline versions and runs no candidate scan *(amended by A1-10: it then requests one
catch-up)*. If the subscription reconnects before
`record.json` is written, the first start restarts from step 1: that reconnect's gap was delivered to no subscription.

**Lost record.** *(Amended by A1-8: a census before its REQ.)* A first-start marker exists, but one of these holds:

- `record.json` is missing, or fails parse, version or checksum;
- the journal cannot be read;
- the resolved identities differ from `record.identities`.

The start is then not a first start (AC-4). The re-baseline follows the first-start rule: B is the scan minus live
deliveries since the REQ. It is conservative, since whatever is held now counts as held since before. Journal prompts
that can be read are kept, the candidate scan still runs, and the status reports `catchUp.last = {outcome:
'not-established', reason: 'record-missing' | 'record-unreadable' | 'journal-unreadable' | 'identity-changed',
startedAt, endedAt}`. What the relay stored during the gap waits for the next pass (owner decision 5).

**S, H, B and `refusedSeen` shrink**, and B only ever shrinks:

- a live delivery of an id in B drops it from B, since it was just re-stored (journal `b`, fsynced at once);
- a successful, conflict-free strict read at an address A drops, from S, H, B and `refusedSeen`, the ids recorded at
  A before that read began, other than the one the read returned. Every map entry carries the sequence number at which
  it was recorded, and the path captures the counter immediately before spawning the scan that reads A. An id heard
  after that capture may be stored after the scan's snapshot, so it is kept. The drop is journaled explicitly as
  `x {a, dropped:[ids]}`, so a replay never drops a later `v`. strfry keeps one version per (kind, pubkey, first
  `d`), so a dropped id has left the relay, and its return is a new store. This runs at round step 8, after the gate:
  the gate reads the maps as they were before the round's read. A prompt heard for an address whose round is in
  flight starts a fresh pending entry *(amended by A1-2: H is gone, and a read never shrinks a lineage)*;
- compaction intersects them with a complete scan.

So a re-sent older version after an id-only revoke (AC-2, AC-4) is an arrival at the next catch-up, and is created.

### What it decides and writes (D4-A, binding 1)

**Bounds.** Every scan in a round is streamed through `onEvent`, and keeps only events that answer the round:

- from an address scan, events whose identity `d` gives a requested address;
- from the element read, events whose lower-cased id was requested.

Every round scan has `maxBytes` 8 MiB (the catch-up share's scans: A1-14). That is well above `maxEventSize`, so any single legitimate address fits, and a
scan over it is bisected like any `ScanError`.

A round's kept events, the element read's included, are counted against a 16 MiB budget of JSON. Once the budget is
reached, the round adds no more addresses. Its remaining id-only addresses are deferred to the next round: re-queued at
once, with no backoff and no attempt counted. An element is at most 1 MiB, so every round makes progress, and kept
memory stays below about (16 + 8) MiB × 5.8 ≈ 140 MB.

The in-memory backlog is capped at 20,000 addresses. Past the cap, new live prompts are dropped (never re-looks) and
counted in `droppedOverBacklog`, and a coalesced catch-up is scheduled. A dropped version's id is still recorded in H
(journal `v`), so the catch-up finds it as an arrival while it is on the relay, or as a candidate once revoked (D3
steps 2 and 3).

**A round** takes up to 500 ready addresses, in the lane order above, and runs:

1. **Graph read (t0).** `readAt(addresses)` runs `READ_AT` in one `executeRead`.
2. **Relay read (t1 > t0), strict.** Filter arrays of one `{kinds:[39999], authors:[pk], '#d':[d]}` per address, at
   most 200 per `strfry scan` (binding 3, batched).
   - The predicate accepts kind 39999 whose lower-cased pubkey is the requested one and that carries any `d` tag of 255
     bytes or fewer equal to the requested `d`. `#d` matches any `d`, so a second `d` must not fail the scan.
   - The byte size of the final argv text (after `\/` escaping) is checked inside `scanStrict` before spawning. Over
     100,000 bytes it refuses with the `ScanError` code `filter-too-large`, which the planner bisects. The planner
     sizes filters with the same escape.
3. **Element read.** Strict `{kinds:[39999], ids:[≤ 1,000]}` for the round's id-only taggings, within the kept budget.
   Predicate: kind 39999 and a requested lower-cased id.
4. **De-duplicate and decide.**
   - All the round's kept events (every address scan and the element read) are merged and de-duplicated by
     lower-cased id.
   - `relayAtAddress(addressEvents, elementEvents, address, identities)` keeps the address events whose identity `d`
     gives the address, adds the element events (unfiltered, so a tag element at another address still reaches
     `tagElementsById`), calls `readRelay`, and reads `byAddress.get(address)`. Refusal counts come from that entry
     only.
   - `decideAddress(stored, relayAt)` runs unchanged. It never orders versions.
   - A `conflict` completes nothing: its ids are not journaled `c`, so a later diff offers them again, and the address
     is left to the pass, as the pass leaves it (counted in `conflicts`).
5. **Gate.** `gateAction(decision, ctx)` (pure, below) holds actions back; it never substitutes one.
6. **Write.** Through `graph.applyCreates` / `graph.applyLocked` in calls of ≤ 25 rows, sorted by `(from, to)`. That is
   one transaction per call, and 1 row in steady state (ADR 0002 C16: the caller orders rows). The pre-image recorder
   is `preimageRecords` (extracted, below), appended under the path's session id.
7. **Journal.** Record `c` for completed addresses and `f` for refused ids.
8. **Shrink and check the pass.** Apply the read shrink rule (`x`), update the counts, and run the post-pass check (D6).
   The round's end is its `commitAt`, whether or not it wrote anything.

**`gateAction(decision, {address, storedRow, relayVersionId, prompts, baseline})`** holds actions back:

- **A `create` is held** while `relayVersionId ∈ B` (`heldPreExisting`; the backfill owns it). This is checked at every
  look at every start, whatever prompted it. Updates and moves are never held, so a relationship the graph already
  holds follows the relay (story item 8, AC-4's last sentence).
- **A revoke prompt** was built only from the address's author's kind-5 (D5-A). It satisfies the gate when:
  - *(Replaced by A1-4 and A1-15.)* it names by `e` a version the relay held at that address (an id S or H recorded there when the kind-5 arrived,
    the stored `eventId` included), and no newer version has since been known at that address. A by-`e` prompt is
    discarded, in the entry and in any re-look, as soon as another version is heard at the address, found there by a
    catch-up scan, or returned there by a read. An empty read keeps it. So a revoke of an old version can never
    authorise removing a newer one that later leaves with no event; or
  - it names the address by `a`, and, when `storedFromRow(storedRow).wellFormed`, `revokeApplies({...recordedEdge,
    from: author}, deletion)` holds. On a malformed stored edge an address revoke is not enough (owner decision 2).
- **A `not-on-relay` removal is held** (`removalsNotPrompted`, left to the pass) unless a revoke prompt is present.
- **A `non-tagging` removal is held** unless a version prompt at this exact address or a revoke prompt is present.
  This round's read found a refused version there.
- **Look-only prompts never enable a removal.** The relay read must be this round's, and the graph read must come after
  the prompt. A catch-up scan yields prompts, never a removal of its own, and a version prompt cannot remove on an
  empty read, so a wipe, an operator's delete or an expiry removes nothing in real time, whenever it lands.

There is no count limit on removals that pass the gate (story 3's settled decision 4).

**Why `revokeApplies` for address deletions.**

- A revoke is a deletion "the relay acts on". strfry deletes an author's versions with `created_at` no newer than the
  deletion's, so an address deletion older than the recorded version could not have removed it.
- Without the check, an old address deletion found at a restart, plus a later wipe, would remove a relationship that
  AC-3 says stays.
- `revokeApplies` applies strfry's rule to the version the graph records, for `a` targets written `39999:…` of at most
  255 bytes.
- The cases where it differs from what the relay did all wait for the pass (owner decision 2).

**No lookup by event id and no index.** An `e` target resolves in memory (D5-A), so there is no `READ_BY_EVENT_ID` and
no `tags_eventId` index. The graph is read only by address (`readAt`) and, at a catch-up, as keys (`readKeys`).

### Failure handling (AC-3)

Each failure is contained to what it touches:

- **A relay read fails.** Any `ScanError` code counts: `spawn`, `process-error`, `timeout` (20 s per round scan),
  `exit`, `signal`, `truncated`, `unparseable`, `not-an-event-line`, `duplicate`, `off-filter`, `too-large` or
  `filter-too-large`.
  - That scan's addresses are deferred and bisected, so the others proceed. *(Time-outs: A1-13.)*
  - A single address backs off 5→10→20→40→60 s, and is reflected within 60 s plus one round of the relay answering in
    full again.
  - It is counted in `failedReads.relay`.

  Each strfry process first connects to Redis. A refused connection fails fast; a Redis that does not answer holds
  each scan until its time-out, which is a contained `timeout` that is retried.
- **An element read fails.** The round's id-only taggings are deferred and never written unresolved on an I/O
  failure. ADR 0001's "any error … counts as absent" covers the element's content only (amendment below).
- **The graph is unavailable** (`ServiceUnavailable`, `SessionExpired`, or transient errors after the driver's 30 s
  retries):
  - the state becomes `waiting-graph`, it probes every 5→15 s, and the queue waits;
  - `Unauthorized`, `AuthenticationRateLimit` and `CredentialsExpired` back off 5→60 s, so the path never feeds
    Neo4j's auth lockout while the entrypoint changes the password;
  - a catch-up runs when the graph is back.
- **A transaction time-out or a stopped lock client** (`TransactionTimedOut`, `TransactionTimedOutClientConfiguration`,
  `LockClientStopped`) is transient here. It backs off 5→60 s, is recorded as `lastError`, and is never bisected or
  parked.
- **A change the database keeps refusing.**
  - A row is parked only when it fails with the same non-transient code on two attempts at least one round apart. It
    is counted once in `dbRefused.byReason`, and retried at 5 min, 30 min, then every 6 h, at every start, and at once
    on a new event at that address.
  - When rows for two or more addresses fail with one code and no row in the round succeeds, they are re-queued with
    5→60 s backoff instead of being bisected to parks.
  - Parked addresses are retried at once after the next successful write.
  - A parked address is not added to S, and every other row goes ahead.
- **A lost race** (the port's verify fails, or create-if-absent finds a row) is re-queued at once with its prompts and
  reflected within AC-1's minute. After 5 consecutive losses it backs off 10 s.
- **A crash or OOM.** The wrapper backs off ≤ 30 s, then the journal restores pending entries, and the catch-up runs.
  - A version heard in the last flush interval before a crash, and revoked by id before the restart, leaves nothing to
    find. It waits for the pass (owner decision 5).
  - Switch-off and SIGTERM flush the journal first, so while journal appends succeed an off or a deploy never opens
    that window. While they keep failing, that flush fails too and the path exits anyway (next bullet). *(Qualified at
    story 4's Architecture, 2026-09-30, from story 3's review, round 3, carry-forward C7.)*
- **Journal appends that keep failing** (a full data volume, say). Lines wait in memory, unbounded, and rounds keep
  writing to the graph. A flush appends every waiting line or none (a failed append is cut back off; should the
  cut-back itself fail, the next start drops the torn tail or skips the damaged line), so the spell ends at the first
  append, or the first compaction, that succeeds. While the journal is past the compaction cadence, a compaction is
  retried at every round end and idle tick, and each failure is the status's `record` error. The operator frees space
  on the volume, which keeps every line.
  - A crash, a switch-off or a SIGTERM (a restart or a deploy) during the spell loses every line not yet written, not
    only the last flush interval's. The next start restores the state as of the last append or compaction that
    succeeded, and its catch-up finds again what the relay still holds. What it cannot find waits for the pass: owner
    decision 5's second corner covers the whole spell. The lost lines also add occasions for decision 11's lost-notice
    removal (a lineage learning lost); it is not a new kind of removal, and the next pass would make the same one
    (A1-16 (5) and (11)). An off still takes effect within 5 s.
  - A version held at the first start that came back with the same id and was heard during the spell, at an address
    the graph does not hold, and not yet written to the graph when the path ended, counts as held again at the next
    start (its `b` line was lost) and waits for the pass. This widens decision 5's third corner: the path may have read
    the address in between. At an address the graph holds, the restarted path still writes the update or move.
  - `lastError` names the stage that last failed (`journal`; `record` after a failed compaction; `status` after a
    failed status write) only while `status.json` can still be written. Once the volume is out of space it cannot,
    and the route shows the status `stale` once its last write is over 60 s old while the process that last wrote it
    runs, then `running` false once that process has ended, even while a restarted path runs.
  *(Added at story 3's review, round 2. Widened at story 4's Architecture, 2026-09-30, from story 3's review, round 3,
  carry-forward C7; the owner accepted the widening on 2026-09-30.)*
- **A first start whose baseline keeps failing.** Every stamped version delivered since the REQ waits in its buffer,
  bounded only by how long the baseline takes; the 20,000-target cap covers kind-5s only. Versions cannot be dropped,
  since a dropped one would count as held since before the first start. Turning the switch off ends it, and the next
  start is again a first start. *(Added at story 3's review, round 2.)*
- **A bad setup** writes nothing. The subscription and the queue stay (with a bad identity there is no
  subscription: A1 clarification 25), and the status names the problem:
  - **Identity.** `resolveIdentities` refuses (either stamp missing, empty, not 64 hex, or has an upper-case letter).
    The state is `waiting-setup`. A corrected identity takes effect on the next Node start: a restart, or the switch
    off and on, since `brainstorm.conf` is re-read at every start.
  - **Schema.** `tags_address` is not present and ONLINE, or `nostrUser_pubkey` is not present. The path checks before
    each write round (cached ≤ 5 s during bursts) and every 15 s while waiting. It resumes within 15 s of the rule
    appearing, with no restart. It never issues DDL: the boot hook, the pass's pre-flight and the Dashboard fix do.
- **Logs.** The supervisor log carries `err.code` plus the widened `redactPublicText(message)`. The status carries fixed
  text only.

### Coexisting with the pass (D6-A, binding 4 settled)

- **The path never touches the pass's machinery.** It never opens `pass.lock`, exclusively or shared, takes no
  `neo4j-heavy` lease, never enqueues a task, and never writes `report.json`, `held/` or confirmation files. Races are
  handled by the port's guard: lock, re-read, verify; create-if-absent under `tags_address`.
- **Reading the report.** The path reads `report.json` once at Node start, before its first round, and fresh after every
  round (`state.readReport`, about 10 KB; no mtime cache).
- **When a run overlaps a round.** For each round the path records `graphReadAt` and `commitAt` (the round's end). A run
  in `latest` or `previous` overlaps the round when it started before `commitAt` and one of these holds:
  - it ended (`endedAt`) after `graphReadAt`;
  - it is still alive (`state.isAlive`);
  - it is dead with `endedAt` null, and `graphReadAt` is earlier than `deadSeenAt[runId]`.
- **`deadSeenAt[runId]`** is the first time this path saw the run not alive (journal `k`). For a run already dead at
  Node start, it is the time of that start's report read. Every `deadSeenAt` therefore falls at or after the run's
  death, and all of a dead run's writes precede its death, so a round that reads the graph after `deadSeenAt` cannot
  be overwritten by it.
- **What happens after an overlap.**
  - The path journals a re-look (`r`) for every address the round looked at, whether or not it wrote, keeping the
    original prompts (de-duplicated by `(address, runId)`).
  - Every 5 s, re-looks whose pass is no longer alive are re-queued. A re-look round reads the graph after its pass
    ended or died, so it never schedules another re-look for that pass, and the queue drains.
  - When an overlapping pass ends, or is first seen dead, one coalesced catch-up is scheduled. Its candidate scan finds
    the author's revoke of any version the pass wrote that is no longer on the relay.
- **The result.**
  - Residual 1 (the pass writes v2 over the path's v1) is repaired by an update, which needs no prompt.
  - Residual 2 (the pass re-creates what the path removed) is repaired because the revoke prompt is kept.
  - Both are repaired within about a minute of the pass ending, with or without a schedule. Anything else the pass
    wrote from an older read is repaired within the catch-up's bound.
- **Consequences for AC-5 and AC-1.** The pass wrapper is unchanged, and no path process matches its pgrep guard, so a
  pass is never refused or skipped because of the path. The path never waits on the pass, so AC-1's minute holds
  during a pass of any length.

### Coexisting with scoring and the follows consumer (D7-A; AC-7's residual, for the owner at this gate)

- **Transactions.** Real-time write transactions carry at most 25 rows (typically 1), sorted by `(from, to)`, with a
  30 s transaction time-out. `executeWrite` retries `Neo.TransientError.Transaction.DeadlockDetected` within the
  driver's 30 s. No lease is taken and nothing waits for scoring.
- **Victim choice.** Forseti aborts the transaction holding fewer active locks. A path transaction holds about 5–8
  locks at 1 row and about 100 at 25 rows; a scoring inner transaction holds thousands. So the path is the victim in
  practically every deadlock, and it retries cheaply.
- **Residual (i), scoring.** A scoring statement fails only if a deadlock forms while its inner transaction still holds
  fewer locks than the path's, which means both crossed people fall in the first ~100 rows of a chunk. That is about
  (k·100/N)² ≈ 4×10⁻⁶ per path transaction overlapping a scoring run (k ≤ 50, N ≈ 2.5 M NostrUsers). A
  400-transaction burst landing on a scoring run is about 1.6×10⁻³.
- **Residual (ii), the follows consumer.** Its writes auto-commit with no retry. A kind-3/10000/1984 statement with
  fewer locks than the path's transaction, crossing the same two people in reverse order within the same
  milliseconds, loses and drops that event. That is the existing row `2026-09-27-stream-consumer-at-most-once`, and at
  about five real taggings a day it practically never happens.

### Status and switch (D8-A)

A new module `src/api/tagging-edges/realtime.js` holds both routes, registered in `src/api/index.js` after the pass's
three. Neither path contains an `ownerOnlyEndpoints` substring.

**`POST /api/tagging-edges/realtime/switch`**, body `{"on": true|false}`, registered as
`app.post(path, adminApi.requireOwnerOnly, taggingEdgesRealtime.handleRealtimeSwitch)`:

- No session → 401, loopback included. A non-owner, or an admin → 403.
- The handler re-checks `session.authenticated === true` and that the pubkey equals the configured lowercase 64-hex
  owner (the confirm route's pattern, `src/api/tagging-edges/index.js:230-242`).
- A cross-site `Origin` → 403 (`sameHost`). A body that is not `application/json` → 415 (`isJson`). `on` not a boolean →
  400, before any file access.
- It writes the canonical `switch.json` atomically and answers `{success, on, changedAt, takesEffectWithinSeconds: 5}`.
  It sends no signal and enqueues nothing.
- If the atomic write for `{on:false}` fails (for example ENOSPC), it unlinks `switch.json`, which needs no free
  space and reads as off, and answers accordingly.

**Off means off within 5 s.** Node checks `switch.json` every 1 s and at every round boundary. On off it:

1. stops scheduling;
2. SIGKILLs its own strfry child (a read);
3. gives an in-flight port call up to 2 s;
4. flushes the journal and writes the status (while the data volume is full, either may fail, and the exit goes ahead:
   § Failure handling, "Journal appends that keep failing");
5. calls `process.exit(0)`.

Neo4j rolls back any uncommitted transaction; a commit already sent may finish. The wrapper does not restart Node
while the switch is off, and turning it back on catches up (AC-4). A missing or unreadable `switch.json` reads as off
(fail-safe), and the status shows `switchUnreadable`.

**`GET /api/tagging-edges/realtime/status`** is a public read. A thin handler reads `switch.json`, `status.json` and
`/proc` through an injected `readFile` (story 2's C11 pattern), and a pure
`computeRealtimeStatus({status, switchRecord, alive, now})` builds the answer. `running` comes only from
`state.isAlive(process)`. It returns:

- `statusVersion`; `on` and `onSince` (from `switch.json`, so the answer says off at once); `running` and
  `runningSince`;
- `state`: `off | starting | waiting-setup | waiting-graph | waiting-relay | catching-up | live | stopped`;
- `firstStartedAt`;
- `relay {lastReadOkAt}`, `subscription {connected, since, lastEventAt}`, `lastReflectedAt`, `lastRound {ms,
  addresses}`;
- `catchUp`:
  - `underway`;
  - `current {startedAt, trigger, arrivals, lookOnly, deletionsFound, remaining}`;
  - `last {outcome: done | not-established | stopped | failed, reason?, stage?, startedAt, endedAt, durationMs,
    reflected {added, changed, removed, unchanged}}`;
- `counts` since `firstStartedAt`:
  - `added`, `changed` (moves included), `changedBy {newer, older, moved, refreshed, repaired}`, `removed`,
    `removedBy`, `unchanged`, `peopleAdded`;
  - `refused {total, byReason}`, `leftInPlace {total, byReason}`;
  - `deletionsMatchedNothing` (per deletion), `deletionsForeign` (targets another author named);
  - `failedReads {relay, graph, element, catchUp}`, `lostRaces {create, update, move, remove}`, `dbRefused {total,
    byReason}`;
  - `heldPreExisting`, `removalsNotPrompted`, `relooks`, `conflicts`, `droppedOverBacklog`;
  - `countsReset?`, set when `status.json` was lost;
- `pending`, `parked`, `seen` (the size of S), `heard` (the size of H; *amended by A1-1*: addresses whose top is not in S), `journal {bytes, skippedLines}`;
- `switchUnreadable`: true when `switch.json` is present but unreadable (read as off);
- `setupProblem`: `null`, `{kind:'identity', identity, problem, source}` or `{kind:'schema', rule, problem}`;
- `lastError {at, stage, code, text}`, `preimageFile`, `process {pid, startTime, startedAt}`, `updatedAt`;
- `stale`: true when `updatedAt` is older than 60 s while the process is alive (AC-6's minute, made visible).

**All text is fixed.** It is chosen by stage or code. Error codes (`lastError.code`, `dbRefused.byReason` keys) pass an
allow-list, else `'error'`:

- `^E[A-Z0-9_]+$`;
- `^Neo\.(ClientError|TransientError|DatabaseError)\.[A-Za-z]+\.[A-Za-z]+$`;
- `ServiceUnavailable`, `SessionExpired`;
- the `ScanError` codes.

No `err.message`, strfry stderr (which always names `redis:6379`), URI, host, IP or port ever enters `status.json`. The
path writes it atomically within 10 s of any change, and as a 30 s heartbeat while running.

### Throughput and ceilings (AC-1's burst bound, AC-4's catch-up bound)

**Sequential by design.** Rounds run one strfry process and one Neo4j transaction at a time. That caps the path's load
on a small droplet at about one strfry scan plus one small transaction.

**Pessimistic arithmetic.** This applies staging's 45× full-scan factor to every scan, including scans dominated by
process start, so it errs high. For a 500-address round:

| Step | Pessimistic time |
|---|---|
| `readAt` | 0.3 s |
| relay scans (3 × 28 ms × 45) | 3.8 s |
| element scan (30 ms × 45) | 1.4 s |
| 20 write transactions × ~80 ms | 1.6 s |
| **Total** | **≈ 7.1 s** |

Deletions cost a map lookup per target.

- **A 10,000-change burst** is 20 rounds, about 145 s after the last store, against 300 s. Locally it is about 10 s.
  A change is a stored tagging or an address a revoke names. An author can name only their own taggings, so a kind-5
  counts as the number of that author's addresses it names.
- **A single change**: ≤ 2 s delivery + ≤ 250 ms + one round (≈ 0.1 s locally, ≤ 7 s pessimistic).
- **A catch-up**, at worst ≈ 240 s against 300 s:
  - an availability probe (≤ 15 s), crash backoff (≤ 30 s) or auth backoff (≤ 60 s);
  - `readKeys` 0.5 s and the stamp scan 3 s;
  - candidate scans: 0 normally, tens of seconds after a wipe;
  - the backlog, ≤ 145 s.
- **Ceilings** (owner decision 9):
  - AC-4's 5 minutes holds while the stamped taggings on the relay scan within the catch-up's slack. At staging's
    measured ~2 MB/s that is on the order of 150 MB of stamped taggings (today 6 MB), and any publisher can grow it.
  - The maps hold about 330 B per tagging, so the 384 MB heap caps the path at roughly 0.8–1 M taggings (today 7,030).
  - Revisit both when the status's `seen` passes 250,000, or when a staging round exceeds 12 s. The local end-to-end
    run and the staging evidence record per-round times from the status (`lastRound`).

### ADR 0002 clarification C20 (made by this ADR; folds row `2026-09-28-lock-check-accepts-any-flock`)

`state.lockHeld(fd, { file })` now also requires the `ino:` in `/proc/self/fdinfo/<fd>` to equal
`fs.statSync(file, { bigint: true }).ino` (compared as strings; the lock line's pid reads 0 in the container's pid
namespace). A missing file, or a foreign inode, reads as not held. Callers:

- the pass runner passes `<stateDir>/pass.lock`, amending ADR 0002's runner step 1;
- the path passes `<stateDir>/realtime/daemon.lock`.

ST19's existing true cases pass a `file` whose inode matches. The row closes with this story.

## Amendments to earlier ADRs

Each design amendment below lands in the same commit as this ADR, with an "Amended by `tagging-edges/0003`" note
beside it. The CF-2/3/4 wording lands with the implementation, as story 3 docs tasks.

**ADR 0001**

- **R2-NB3 bullet (A4).** Replace "subject to the mass-removal limit" with "subject to the gap-filling pass's
  mass-removal limit. The real-time path's removals have no count limit (story 3's settled decision 4); each answers a
  revoke by the tagging's author (or, for a refused version, a version stored at the address) and a later successful
  relay read (`tagging-edges/0003`)".
- **Consequences, revokes (A7).** Note: "The real-time path reads kind-5 events (live, and by author-scoped `#e`/`#a`
  scans at catch-up) only as prompts, and as a condition without which a removal is held back (story 3 AC-3). A kind-5
  never causes a removal that the path's own later relay read at that address does not also call for."
- **A3, "refuse to start".** Note: "The real-time path, a long-running process, starts and waits in
  `waiting-setup`, writing nothing, which meets this rule's purpose. With a bad identity it does not subscribe, since
  its filter needs both identities." *(Corrected by A1 clarification 25.)*
- **A8 / step 5, "any error counts as absent"** (:376, :480-481). Note: "This covers the element's content. A failed
  element read is not an absent element: the real-time path defers, and the pass fails the run."

**ADR 0002**

- **Owner decision 2.** Note beside it, with the same text as A7's note.
- **Binding 2, refined.**
  - A kind-5 prompts a look only from its own author, and only at addresses it names that the path knows: by `e`,
    through the path's seen and heard maps *(amended by A1-3: only the latest version learned at the address)*; by `a`, a tagging address of at most 255 bytes where the path's maps or the
    graph's keys record a version.
  - Another author's kind-5 prompts nothing, since the relay does not act on it (owner decision 3).
  - A removal it prompts also needs the gate's revoke rule.
  - That is a restriction, never enough on its own: the relay read still decides (A7).
- **Binding 3, batched shape.**
  - The strict relay read may be batched as a filter array of one `{kinds:[39999], authors:[pk], '#d':[d]}` per address
    (≤ 200 per scan), narrowed to the identity `d`.
  - The element read may be batched as `{kinds:[39999], ids:[≤ 1,000]}`.
  - A round's events are de-duplicated by id before `readRelay`.
  - Each address's graph read precedes its batch.
- **Binding 4, settled.** Story 3 holds no pass lock of any kind, takes no `neo4j-heavy` lease and writes no
  `report.json`. It reads `report.json` only to schedule post-pass re-looks and catch-ups.
- **R2-NB3 restatement** ("The removal rule and the limit"). Same note as ADR 0001's A4.
- **"Residuals, accepted".** Append: "Story 3 re-looks every address it looked at during an overlapping pass once that
  pass ends, and runs one catch-up then. Both interleavings are repaired within about a minute of the pass ending,
  with or without a schedule. They remain as transient windows (story 3 AC-5)."
- **C16.** The real-time path sorts its own rows by `(from, to)` and calls the port with ≤ 25 rows per call.
- **D5-B / A9 applied.** The real-time gate calls `revokeApplies`' address branch, which orders `createdAt`, only on a
  well-formed stored edge.
- **The pre-image line shape.** It gains `writer` (`'pass'` or `'realtime'`). The real-time path writes under a
  per-process session id in `RUN_ID_RE`'s grammar.
- **"New files" (`src/lib/strfryScanStrict.js`).**
  - An additive `onEvent` streaming option.
  - The filter may be an array.
  - The argv text writes `/` as `\/` for every caller, and is size-checked before spawn (`filter-too-large`).
  - The off-filter rule becomes "an event the caller's `isExpected` refuses".
  - `redactPublicText` is widened (CF-3).
- **C20** (above).
- **Wording (story 3 docs tasks CF-2, CF-3, CF-4):**
  - :470-471: a `schema` refusal can leave `tags_address` in place;
  - :546-547 and :774: the redaction wording matches the widened rule;
  - :857: the lock-file qualifier.

**The story (a Planning amendment in the ADR's commit).** Accepting owner decisions 2, 3, 5, 9 and 10 qualifies these
criteria, and the story says so beside each:

- AC-1: decisions 5, 9 and 10;
- AC-2: decisions 2, 3, 9 and 10;
- AC-3: decision 5's crash corners;
- AC-4: decisions 5, 9 and 10;
- AC-5: decisions 9 and 10;
- item 7 and Out of scope: decision 5's corners.

Amendment A1 (2026-09-29) adds decision 11 and qualifies: AC-2 (decisions 2, 3, 9, 10 and 11); AC-3 (decisions 2, 5
and 11); AC-4 (decisions 5, 9 and 10); item 7 and Out of scope (decision 5's corners, widened); item 9 (decisions 2
and 11).

## How each acceptance criterion is met

| AC | Met by |
|---|---|
| **AC-1** | D1's live subscription hears every writer, back-dated events included, within about 1–2 s. Rounds read graph-first, then relay-strict, de-duplicate, and `decideAddress` follows the relay's current version: create (people by bare keyed `MERGE`), update or move. Id-only resolution goes through the element read and the same-version rule. Lanes put live work first, with a reserved share for catch-up. Burst: about 145 s per 10,000, pessimistic. Except owner decisions 5, 9 and 10. |
| **AC-2** | A kind-5 is resolved in memory to its author's addresses (by `e`, the address's latest learned version; `a` directly; A1-3). The revoke prompt (by id, or by address with `revokeApplies`) lets the removal through when the relay read finds nothing. Another accepted version is followed, and another author's or a non-revoke kind-5 changes nothing. No count limit. Except owner decisions 2, 3, 9, 10 and 11. |
| **AC-3** | Failure handling, per class. The gate: a `not-on-relay` removal needs a revoke; version and look-only prompts cannot remove on an empty read. Bounded scans, kept bytes and backlog. Bad setup is `waiting-setup`, with no writes and no DDL, resuming within 15 s of a rule. Except owner decisions 2, 5 and 11 (A1-4, A1-16). |
| **AC-4** | Catch-up at every connect and start (deferred, never skipped), and after an overlapping pass: stamp-scan arrivals by id, look-only prompts against the graph, author-scoped deletion candidates, and journal restore, done when every queued address had one attempt, ≈ 240 s pessimistic. The first-start baseline minus live deliveries. B checked at every look, and shrunk by reads at an address. Lost record and identity-changed re-baseline with `not-established`. The full safety diff every 10 min. Except owner decisions 5, 9 and 10. |
| **AC-5** | The switch file on the data volume; off within 5 s by exit. The bash wrapper never exits, so there is no FATAL, and the conf is re-read per start. A separate program from follows (it never reads the follows queue). No pass lock, and no pgrep match. The post-pass re-look and catch-up, with bounded dead-pass windows. Except owner decisions 9 and 10. |
| **AC-6** | `status.json` (≤ 30 s heartbeat, `stale` flag) through a public route. Every listed field. Fixed text and allow-listed codes only. |
| **AC-7** | Writes only through `graph.js`: the nine properties, a pre-image before a key is dropped, and removals only of `TAGS` at tagging addresses. The follows stream and the pass's files are untouched. Residuals (i) and (ii) are named for the owner. |

## Consequences

- **Enables.**
  - Real-time `TAGS` on every host once the owner turns it on, with no strfry change and no schema change.
  - Story 4's page reads two public routes and posts to one owner route.
  - The pass's two race residuals shrink from "until the next pass" to about a minute after each pass.
- **Constrains.**
  - The path depends on the pass's port and pure modules staying the single place for `TAGS` Cypher and decisions.
  - `graph.js` gains two reads, and the runner loses two inline pieces, `resolveIdentities` and the pre-image builder,
    to shared modules. Its behaviour must not change (the runner suites are the regression check).
  - A new supervisord program reaches a host only with a deploy, and locally only with an image rebuild or the
    `docker cp` + `supervisorctl update` step.
- **New debt.**
  - The ceilings of owner decision 9, and the residuals of owner decision 10.
  - The corners of owner decision 5.
  - The widened redactor may cut benign `word:NN` text from error messages (diagnostic loss only). It cuts its input
    to 4 KB first. Some forms still pass it: host names containing an underscore (`tapestry_neo4j_1:7687`) or
    starting with a digit, and credentials written without a scheme. No current source emits them. *(Added at story
    3's review, round 2.)*
  - A new ledger row for the pass's shared 256 MiB scan cap: a publisher can make the pass's full read fail `too-large`
    with about 2,000 websocket-size (≤ 131,072-byte) stamped taggings; organic growth reaches it at roughly 300k.
- **Firmware reinstall required?** No. No concept definition or firmware JSON changes, and no schema change.

## Owner decisions needed at this gate

Accepting items 2, 3, 5, 9 and 10 qualifies story 3's criteria (the Planning amendment above). Declining any kicks that
part back to Planning.

*Amendment A1-16 (2026-09-29) rewords decisions 2, 5, 9 and 10 and adds decision 11, for approval at the amendment's
gate.*

1. **AC-7's residuals.**
   - (i) A scoring statement fails only in a deadlock forming within the first ~100 rows of one of its 10k-row inner
     transactions and crossing a real-time transaction: about 4×10⁻⁶ per path transaction overlapping a scoring run.
   - (ii) The follows consumer drops an event when a small list write crosses the same two people as a path write
     within the same milliseconds (row `2026-09-27-stream-consumer-at-most-once`).
2. **What counts as a revoke of the recorded version.** *(Reworded by A1-16.)* A `not-on-relay` removal needs the author's deletion naming a
   version the relay held there by id, or the address with `revokeApplies` (strfry's rule applied to the recorded
   version). These cases wait for the pass:
   - a relationship whose stored `createdAt` is malformed (only an out-of-band write makes one; the pass repairs it),
     revoked by address;
   - the graph ahead of the relay: the recorded version left with no event and an older one was re-sent, and an address
     deletion dated between the two removed the older one on the relay;
   - an address deletion whose kind is spelled with leading zeros or `+`;
   - during downtime only, an address deletion spelling the pubkey in upper-case hex (the catch-up's `#a` scan finds
     only lower case).
3. **Only the tagging's author's kind-5 prompts a look.** strfry does not act on another author's deletion, so it
   changes nothing on the relay, and any stale relationship it might have led the path to notice is found by the next
   arrival, look-only prompt or safety diff. This keeps a flood of other people's kind-5s to one map lookup per target.
   The story allows either reading ("a look one of them prompts can still …").
4. **Off within 5 s** (a 1 s poll, then up to a 2 s grace for an in-flight transaction, a journal flush, then exit).
5. **Corners that wait for the pass.** *(Reworded by A1-16. Its second and third corners widened at story 4's
   Architecture: § Failure handling, "Journal appends that keep failing".)*
   - A version stored and revoked by id before the relay announced it (story item 7, unchanged).
   - A version heard in the last ≤ 250 ms before a crash, and revoked by id before the restart; while journal appends
     keep failing, the whole spell since the last append or compaction that succeeded, ended by a crash, a switch-off
     or a SIGTERM (§ Failure handling).
   - A version held at the first start that left the relay and came back with the same id, with no read of its
     address by the path in between, at an address the graph does not hold; or one heard during a spell of failing
     journal appends whose `b` line was lost (§ Failure handling).
   - Taggings stored between the owner's first switch-on and the first subscription's snapshot. Normally that is
     seconds; it lasts as long as an identity stays bad or the relay is unavailable at the very first start. They
     count as pre-existing. OPERATIONS runs the extra pass after the status shows `firstStartedAt`.
   - Events stored in the few seconds before the very first start's record is written, if the process crashes then.
   - A lost record, an unreadable journal, or changed identities: re-baselined as `not-established`, with the gap left
     to the pass. Changed identities are the case AC-4 does not list; re-baselining avoids a backfill under a new
     stamp.
6. **CF-3: widen the shared redactor.** Cover single-label and dotted `host:port` and `[ipv6]:port`, with a test. The
   alternative is only qualifying story 2's ten places. The real-time status is fixed text either way.
7. **A new supervisord program** (a bash wrapper idle while off, plus a Node child while on), rather than running inside
   the control panel.
8. **Fold row `2026-09-28-lock-check-accepts-any-flock`** (C20).
9. **Scale ceilings.** *(Reworded by A1-16.)*
   - AC-4's 5 minutes holds while the stamped taggings on the relay scan within the catch-up's slack: on the order of
     150 MB at staging's ~2 MB/s, against 6 MB today.
   - The 384 MB heap caps the path at roughly 0.8–1 M taggings.
   - Beyond the 20,000-address backlog cap, dropped live prompts (revokes included) are reflected by a catch-up rather
     than within the minute.
   - Counting: a kind-5 counts as the number of the author's known taggings it names, so a bulk revoke of N of one's
     own taggings is N changes of AC-1's 10,000. The story counts events.
   - Under a sustained live load a catch-up proceeds at 100 or more addresses per round, so AC-4's 5 minutes for a
     10,000 backlog holds only while rounds stay under about 2.3 s; the status's `lastRound` shows it.
   - The staging evidence records per-round times. Revisit at 250,000 `seen`, or a staging round above 12 s.
10. **Residuals beyond the minute.** *(Reworded by A1-16; decision 11 is new there.)*
    - A subscription that stays connected but stops delivering: what it misses, revokes included, is reflected at the
      next safety diff (≤ 10 min).
    - A follows Redis that accepts no connection: every strfry command connects to it first, so every relay read (the
      pass's too) stalls until its time-out while Redis is unresponsive, and nothing is reflected until Redis answers or
      is gone. A refused connection is harmless.

## Implementation notes

The Implementer reads this section. Test-file changes are Phase 3's (the Tester): the suites named at the end.

**New files**

- `src/lib/tagging-edges/realtime.js` (**pure**; the folder's purity and no-64-hex guards cover it; re-exported from
  `src/lib/tagging-edges/index.js`): the exports, signatures and shapes are fixed by T1–T19 and T25 (Clarifications,
  below). They supersede the working names an earlier draft of this list used.
- `src/pipeline/tagging-edges/realtime/run.sh`: the wrapper (§ Where it runs).
- `src/pipeline/tagging-edges/realtime/index.js`: the engine.
  - `run(deps)` with injectable `{now, env, identities, openGraph, scan, subscribe, store, state, readReport, isAlive,
    proc, sleep}`, as the pass runner's `defaultDeps`.
  - The `require.main` entry passes real dependencies.
  - It owns the loop, first start, catch-up, rounds, switch poll, re-looks, dead-pass tracking and status writes.
- `src/pipeline/tagging-edges/realtime/subscription.js`: the `ws` client (`ws` ^8.18.1 is already a dependency): REQ
  with `limit:0`, EOSE, ping and pong, reconnect with backoff, and an `onEvent` / `onEose` / `onClose` surface. No
  state.
- `src/pipeline/tagging-edges/realtime/store.js`: `switch.json` (read, and unlink on a failed off-write),
  `started.json`, `record.json` (sha256 over the canonical body), `journal.jsonl` (cut to the last newline at open,
  append plus fsync, streamed replay) and `status.json`, through `state.writeAtomic`.
- `src/pipeline/tagging-edges/identities.js`: `resolveIdentities` moved from the runner. The runner re-exports it,
  unchanged.
- `src/pipeline/tagging-edges/preimage.js`: `preimageRecords(runId, batch, { writer })`, the body of the runner's
  pre-image closure plus `writer`. The path calls `state.appendPreimages(sessionId, preimageRecords(sessionId, batch,
  { writer: 'realtime' }))`, with `sessionId` minted per Node start by the runner's `makeRunId`.
- `src/api/tagging-edges/realtime.js`: `computeRealtimeStatus`, `validateSwitch`, `handleRealtimeStatus` and
  `handleRealtimeSwitch`, with injected deps like `index.js`'s `withDeps`.

**Changed files**

- `src/pipeline/tagging-edges/graph.js`.
  - `openGraph` also returns `readAt(addresses, {timeoutMs})` (running the existing `READ_AT`) and
    `readKeys({timeoutMs})`, each an `executeRead` returning raw rows like `readAll`.
  - `CYPHER` gains one read: `READ_KEYS`: `MATCH ()-[r:TAGS]->() RETURN r.address AS address, r.eventId AS eventId`.
  - No write statement changes (binding 1).
- `src/pipeline/tagging-edges/reconcileTaggingEdges.js`: use `identities.js` and `preimage.js` (records gain `writer:
  'pass'`), re-export `resolveIdentities`, and pass `{ file: <stateDir>/pass.lock }` to `lockHeld` (C20). Plus the CF-4
  wording at :8 and :221. Behaviour is otherwise unchanged.
- `src/pipeline/tagging-edges/state.js`: `lockHeld(fd, { file, readFile })` compares inodes (C20).
- `src/lib/strfryScanStrict.js`:
  - the `onEvent(ev)` streaming option (events not kept; every completeness rule unchanged);
  - the filter may be an array;
  - an exported `escapeFilterArgv(filter)` writes `/` as `\/`;
  - the argv size check (`filter-too-large`);
  - `redactPublicText` also replaces `<name>:<2-5 digits>` (a letter-led single-label or dotted name) and `[<ipv6>]:<port>`
    with `<host>` (CF-3);
  - the off-filter text becomes "refused by the caller's isExpected".
- `src/api/tagging-edges/index.js`: export `isJson` (`sameHost` is already exported); the CF-1 / CF-3 header wording.
- `src/api/index.js`: two routes after :523, and the CF-1 / CF-3 comment at :516-517.
  ```js
  const taggingEdgesRealtime = require('./tagging-edges/realtime');
  app.get('/api/tagging-edges/realtime/status', taggingEdgesRealtime.handleRealtimeStatus);
  app.post('/api/tagging-edges/realtime/switch', adminApi.requireOwnerOnly, taggingEdgesRealtime.handleRealtimeSwitch);
  ```
- `docker/supervisord.conf`: the program block (§ Where it runs).

**Docs (story docs tasks, plus these)**

- **BIBLE:**
  - §4 services and supervisord rows gain `tagging-edges-realtime`;
  - §6 status line and Revokes bullet;
  - §11 two routes;
  - §16 entry;
  - the Last-updated line.
- **OPERATIONS:** a new §12.9 covering:
  - the switch snippet: a signed-in `fetch` from the owner's browser;
  - the status fields;
  - deploy behaviour;
  - the order: backfill → add and enable the daily schedule → turn on → one more pass;
  - the removals that wait for a pass;
  - the local install step above;
  - that enabling strfry's `filterValidation.requireAuthorOrTag` refuses both subscription filters;
  - that scan stderr names `redis:6379`;
  - the debug commands (`supervisorctl status tagging-edges-realtime`, the log tail).
- **Ledger:**
  - a new row: the pass's shared 256 MiB scan cap;
  - row `2026-09-28-lock-check-accepts-any-flock` flipped to DONE;
  - row `2026-09-27-strfry-redis-misses-websocket-writes`, fix shape b.
- **Also:**
  - the ADR amendments above;
  - the story's amendment notes (owner decisions 2, 3, 5, 9, 10);
  - the epic guardrail;
  - the handoff Status line and §3;
  - CF-1 to CF-6.

**Tests the Tester owns (Phase 3), for orientation**

- `test/tagging-edge-contract.test.js`:
  - re-aim S2C9's "the real-time path … is not built yet" check at the new BIBLE line;
  - the purity and no-64-hex guards cover `realtime.js`.
- `test/tagging-edges-wiring.test.js`:
  - SWR13 gains `READ_KEYS`; SWR14/15 still hold;
  - new sentinels: the program block (the `stdout_logfile_maxbytes` names); a wrapper that never exits and re-sources
    per start; no path file or argv matching the pass's pgrep pattern; no `pass.lock` / `neo4j-heavy` / `writeReport`
    in realtime code; the two routes, with owner-only on the POST.
- `test/strfry-scan-strict.test.js`:
  - `onEvent`, array filters, `\/` escaping, `filter-too-large`;
  - the widened redactor (`neo4j.internal:7687`, `neo4j:7687`, `[::1]:7687`, `localhost:7687`);
  - the SS28 title.
- `test/tagging-edges-runner.test.js`: unchanged behaviour after the extractions (pre-image lines gain `writer`); the
  SR63, SR64 and SR65 titles.
- `test/tagging-edges-state-routes.test.js`: ST19 C20 cases (a foreign inode, a missing file; the existing true cases
  pass `file`).
- New suites:
  - **The pure planner.**
    - Upper-case `e` and pubkey.
    - A version and its id-only revoke heard in one round (the revoke resolves through the lineage's top and removes; A1-3).
    - A tagging stored during the first-start scan is created.
    - A re-sent older version after an id-only revoke is created after downtime.
    - A queued version prompt plus a wipe removes nothing.
    - Another author's kind-5 prompts nothing.
    - A dropped-over-cap version then revoked is found by the catch-up's candidates.
    - A dead pass with `endedAt` null re-looks once.
    - Element and address scans returning the same event.
    - An `a` target over 255 bytes.
    - `refusedSeen` shrinking.
    - A by-id revoke, then a re-apply at the same address during an overlapping pass, then a wipe: the re-look
      removes nothing.
    - A version heard after a round's scan spawned, then revoked by id: the lineage keeps it through that read, and the revoke removes (A1-2).
    - One author with 1,600 revoked ids and 1,600 addresses yields candidate scans that each fit the argv budget.
    - A kind-5 whose `a` targets hold nothing queues nothing.
  - **The engine.**
    - A fake `ws` server, a fake strfry on PATH, a fake port, a fake clock and a switch.
    - Floods under the 384 MB cap: 500 stamped taggings of 130 KB; one author with 500 multi-`d` events at one
      address; 500 id-only taggings naming 131 KB elements; an expired tagging plus 1,000 max-size kind-5s naming it
      (candidate scans stay bounded); a kind-5 stream from others during `waiting-graph`; a padded live stream plus
      1,000 catch-up arrivals, where the catch-up completes.
    - Journal torn-tail recovery.
    - The 250 ms flush timer in a waiting state.
  - **The routes.** The auth matrix (loopback 401, admin 403, cross-site 403, non-JSON 415), the unlink on a failed
    off-write, and the error-code allow-list (`err.code = 'neo4j.internal'` → `'error'`).
- An opt-in live suite: read-only checks of `readAt` and `readKeys`, and a `limit:0` websocket smoke test against the
  local relay.
- `test/registry.js` registrations.

## Clarifications (Test Design, 2026-09-28)

Test Design fixes the interfaces the suites call, where the sections above name a function but not its exact shape.
These are for the owner to ratify at the Test Design gate. Ids are lower-case 64-hex. Addresses are tagging addresses as
`taggingToEdge` gives them (pubkey lower-cased). Times are milliseconds since the epoch unless a field says ISO.

**T1 — Where `escapeFilterArgv` lives.** The purity guard lets `src/lib/tagging-edges/*.js` require only siblings, so
`escapeFilterArgv(filter)` and `filterArgvBytes(filter)` live in `src/lib/tagging-edges/realtime.js`.
- `escapeFilterArgv(filter)` is `JSON.stringify(filter)` with every `/` written `\/`.
- `filterArgvBytes(filter)` is its UTF-8 byte length.
- `src/lib/strfryScanStrict.js` requires them from `./tagging-edges/realtime` and re-exports `escapeFilterArgv`, so
  `scanStrict` and the planner size filters with the one escape.

**T2 — `realtime.js` exports** (pure; plain objects, `Map` and `Set` only):

```
LIMITS, escapeFilterArgv, filterArgvBytes, subscriptionFilters, promptFromVersion, newMaps, recordId,
resolveDeletion, shrinkOnRead, compact, arrivalsAndLookOnly, deletionCandidates, deletionScanFilters,
isExpectedDeletion, addressScanFilters, isExpectedAddressEvent, elementScanFilters, isExpectedElementEvent,
dedupeById, relayAtAddress, mergePrompt, discardSupersededRevokes, gateAction, passOverlaps, roundOrder,
journalLine, replayJournal, allowErrorCode
```

`LIMITS` holds exactly these keys: `roundAddresses` 500, `roundCatchUpShare` 100, `filtersPerScan` 200, `writeRows` 25,
`elementIds` 1000, `backlogAddresses` 20000, `catchUpChunk` 5000, `roundKeptBytes`, `roundScanMaxBytes`,
`candidateScanMaxBytes`, `argvFilterBytes` 100000, `aTargetMaxBytes` 255, `journalCompactBytes` and `journalFlushMs` 250.
Its byte values are numbers: `roundKeptBytes`
16777216, `roundScanMaxBytes` and `candidateScanMaxBytes` 8388608, `journalCompactBytes` 1048576.

**T3 — The maps.** *(Amended by A1-1 and A1-17.)* `newMaps()` → `{ S: Map, H: Map, B: Set, R: Map }`:
- `S` holds seen ids;
- `H` holds heard ids not yet completed;
- `R` holds `refusedSeen`;
- `B` is a Set of ids.

Each `S`, `H` and `R` value is `{ a, seq }`. `recordId(maps, which, id, address, seq)` sets one entry
(`which` is `'S' | 'H' | 'R'`). Moving an id from `H` to `S` is `recordId(maps, 'S', …)` plus `maps.H.delete(id)`.
Functions that take `maps` mutate it and return a result object. Entries restored from `record.json` get `seq` 0.

**T4 — `subscriptionFilters({ canonicalPubkey, localPubkey })`** →
`[{ kinds: [39999], '#z': [39998:<c>:nostr-user-tag, 39998:<l>:nostr-user-tag] (distinct), limit: 0 }, { kinds:
[5], limit: 0 }]`. It throws on an identity `checkIdentity` refuses.

**T5 — `promptFromVersion(ev, identities)`** → `{ address, id }` or `null`.
- It is `null` unless `ev` is kind 39999 and carries a `nostr-user-tag` stamp (either identity).
- `address` is `taggingToEdge`'s `edge.address`, or its refusal's `address`; `null` when neither exists.
- `id` is lower-cased.

**T6 — `resolveDeletion(ev, maps, graphAddresses)`** *(Amended by A1-17.)* → `{ prompts: [{ address, prompt }], matchedNothing, foreign }`.
- `graphAddresses` is a `Set`. `prompt` is `{ type: 'revoke', kind5Id, created_at, by: 'e' | 'a', target }`.
- An `e` target resolves through `maps.S` then `maps.H`.
- An `a` target resolves only when it is a tagging address of ≤ 255 UTF-8 bytes and is known: an `S` or `H` entry has
  that address, or `graphAddresses` has it.
- A resolved target whose address's pubkey segment is not `ev.pubkey` (lower-cased) adds 1 to `foreign` and no prompt.
- Prompts are de-duplicated by `(address, by, target)`.
- `matchedNothing` is `prompts.length === 0 && foreign === 0`.
- A non-deletion (not `isEvent`-shaped, or not kind 5) gives `{ prompts: [], matchedNothing: true, foreign: 0 }`.

**T7 — `shrinkOnRead(maps, address, returnedId, captureSeq)`** *(Amended by A1-17.)* → `{ dropped: [ids] }`. It deletes from `S`, `H`
and `R` every entry with `.a === address`, `.seq <= captureSeq` and `id !== returnedId`, and deletes those ids from
`B`. `returnedId` is `null` for an empty read.

**T8 — `compact(maps, scannedIds, candidateIds, captureSeq)`.** *(Amended by A1-17.)* Entries with `seq > captureSeq` are kept (recorded
after the scan began). Of the others:
- `S` and `R` keep only ids in `scannedIds`;
- `H` keeps ids in `scannedIds` or `candidateIds` that are not in `S`;
- `B` becomes `B ∩ scannedIds`.

**T9 — `arrivalsAndLookOnly(scanPairs, maps, graphKeys)`** → `{ arrivals: [{ address, id }], lookOnly:
[address] }`. `scanPairs` is `[[id, address]]`, and `graphKeys` is a `Map` from address to eventId.
- Arrivals are pairs whose id is not in `S`.
- `lookOnly` lists addresses, not already arrivals, where:
  - (i) `graphKeys` holds another eventId; or
  - (ii) `graphKeys` has no entry and the id is in `S` but not in `B`.

  An `(id, address)` in `R` is excluded.

**T10 — `deletionCandidates(graphKeys, scannedIds, maps)`** *(Amended by A1-17.)* → `[{ address, id }]`, de-duplicated, tagging addresses
only:
- every `graphKeys` entry whose eventId is not in `scannedIds`;
- every `S` or `H` id not in `scannedIds` whose address `graphKeys` holds with another eventId.

**T11 — Deletion scans.** `deletionScanFilters(candidates)` → `[{ pubkey, by: 'e' | 'a', targets, filter }]`:
- grouped by the address's pubkey segment;
- `filter` is `{ kinds: [5], authors: [pubkey], '#e': ids }` or `{ kinds: [5], authors: [pubkey], '#a': addresses }`;
- `a` targets only when ≤ 255 bytes;
- each filter's `filterArgvBytes` is ≤ `LIMITS.argvFilterBytes`.

`isExpectedDeletion(ev, { pubkey, by, targets })` is kind 5, a lower-cased pubkey equal to `pubkey`, and a tag of
type `by` whose value is in `targets` (an `e` compared lower-cased, an `a` raw).

**T12 — Address and element scans.**
- `addressScanFilters(addresses)` → `[[filter]]`: chunks of ≤ 200 one-address filters `{ kinds: [39999],
  authors: [pk], '#d': [d] }` whose `filterArgvBytes(chunk)` is ≤ the budget.
- `isExpectedAddressEvent(ev, addresses)`: kind 39999, and some requested address whose pubkey equals `ev.pubkey`
  lower-cased and whose `d` equals a `d` tag value of ≤ 255 bytes on `ev`.
- `elementScanFilters(ids)` → `[{ kinds: [39999], ids: [≤ 1,000] }]`, each within the budget.
- `isExpectedElementEvent(ev, ids)`: kind 39999 and a lower-cased id in `ids`.

**T13 — `dedupeById(events)`** keeps the first event per lower-cased id.

**T14 — `relayAtAddress(addressEvents, elementEvents, address, identities)`.** It keeps the address events whose
`promptFromVersion(ev, identities).address === address`, adds `elementEvents`, de-duplicates by id, runs `readRelay`,
and returns `byAddress.get(address) || null`: an edge, a refusal, `{ conflict: true, count }` or `null`.

**T15 — Prompts and entries.** *(Amended by A1-5 and A1-17.)*
- A prompt is `{ type: 'version', id }`, `{ type: 'revoke', … }` (T6) or `{ type: 'look' }`.
- An entry is `{ version: { id } | null, revokes: [revoke prompts], look: boolean }`.
- `mergePrompt(entry | null, prompt)` → a new entry:
  - `version` becomes the latest version prompt;
  - `revokes` are de-duplicated by `(by, target)`, keeping the greatest `created_at`;
  - `look` ORs.
- `discardSupersededRevokes(entry, knownVersionId)` → an entry without the `by: 'e'` revokes whose target differs from
  `knownVersionId`. `by: 'a'` revokes are kept.

**T16 — `gateAction(decision, { address, storedRow, relayVersionId, entry, baseline })`.** *(Amended by A1-17.)* `decision` is
`decideAddress`'s answer. The result is `{ act: true }`, or `{ act: false, held: 'pre-existing' |
'removal-not-prompted' }`.
- A `create` is held (`'pre-existing'`) when `baseline.has(relayVersionId)`.
- For a `remove`, a revoke is valid when either:
  - it is `by: 'e'`; or
  - it is `by: 'a'`, `storedFromRow(storedRow).wellFormed`, and `revokeApplies({ ...edge, from: author },
    { id: kind5Id, kind: 5, pubkey: author, created_at, tags: [['a', address]] }).applies`, where `author` is the
    address's pubkey segment.
- A `not-on-relay` removal acts only with a valid revoke. A `non-tagging` removal acts with a valid revoke or
  `entry.version`.
- `look` never enables a removal.
- Every other action acts.

**T17 — `passOverlaps({ graphReadAt, commitAt }, runs, isAlive, deadSeenAt)`** → `[runId]`.
- `runs` are report entries: `startedAt` and `endedAt` are ISO strings or null, plus `process`.
- `isAlive(run)` is a boolean.
- `deadSeenAt` maps a runId to milliseconds.
- The rule is § Coexisting with the pass: a run not alive with `endedAt` null and no `deadSeenAt` entry does not
  overlap. The caller records `deadSeenAt` first.

**T18 — `roundOrder(queue)`.** `queue` is `[{ address, lane: 'live' | 'relook' | 'catchup', seq }]`. It returns
addresses in round order, at most `LIMITS.roundAddresses`:
1. up to `roundCatchUpShare` catch-up entries by `seq`;
2. live entries by `seq`;
3. re-looks by `seq`;
4. the remaining catch-up entries.

The kept-bytes share is the engine's.

**T19 — The journal.** *(Amended by A1-6 and A1-17.)* Each line is compact JSON with a `t` field:

| Line | Fields |
|---|---|
| `{"t":"v","id","a"}` | a version heard |
| `{"t":"d","a","p"}` | a revoke prompt `p` (T6) |
| `{"t":"c","id","a"}` | completed |
| `{"t":"x","a","dropped"}` | a read's shrink |
| `{"t":"b","id"}` | a baseline drop |
| `{"t":"f","id","a"}` | a refused id seen |
| `{"t":"r","a","runId","p"}` | a re-look, `p` the entry (T15) |
| `{"t":"rc","a","runId"}` | a re-look done |
| `{"t":"p","a","code"}` | parked |
| `{"t":"k","runId","at"}` | a dead pass seen |

`journalLine(obj)` → the line (with its `\n`). `replayJournal(lines, record)` applies lines in order to the state
restored from `record` (`null` for none). It returns `{ maps, pending: Map<address, entry>, rechecks: [{ a, runId,
entry }], deadSeenAt, parked: Map<address, code>, skippedLines }`:
- a line that does not parse, or has an unknown `t`, is skipped and counted;
- `v` adds to `H` and merges a version prompt;
- `c` moves the id to `S` and clears the entry's version when it matches;
- `x` deletes the listed ids from every map;
- `b` deletes from `B`.

**T20 — The engine seam.** *(Amended by A1-17.)* `src/pipeline/tagging-edges/realtime/index.js` exports `{ createEngine, run,
defaultDeps }`. `createEngine(deps)` returns `{ start(), tick(), handleSignal(name), status() }`:
- `await start()` reads the switch, record, journal and report (for `deadSeenAt`), resolves identities, and, when the
  switch is on and the identities are good, subscribes.
- `await tick()` does whatever is due at `deps.now()` and resolves `{}`, or `{ exit: code }` once it must stop:
  0 for switch-off, and also for a signal handled through `handleSignal`.
- `status()` returns the object last written to `status.json`.
- `run(deps)` is `start()`, then `tick()` in a loop with `deps.sleep(ms)` (≤ 250 ms) until an exit. It leaves the
  code on `deps.proc.exitCode` and never calls `process.exit`.

`deps`:

| Dep | Shape |
|---|---|
| `now()` | the clock |
| `sleep(ms)` | a wait |
| `env` | the environment |
| `identities` | `{ canonicalZ(), getOwnerAssistantPubkey() }` (ADR 0002 C1) |
| `openGraph(cfg)` | graph.js's port with `readSchema`, `readAt`, `readKeys`, `applyCreates`, `applyLocked`, `close` |
| `scan(filter, { timeoutMs, isExpected, maxBytes, onEvent })` | `scanStrict`'s contract |
| `subscribe({ url, filters, onEvent, onEose, onClose })` | → `{ close() }` |
| `store` | T21 |
| `state` | `{ readReport(), isAlive(record), appendPreimages(runId, records) }` |
| `proc` | `{ pid, startTime, exitCode }` |
| `randomId()` | 8 hex characters, for the session id |
| `log(line)` | a log line |

Subscription callbacks only buffer. `tick()` processes what they buffered. Tests drive time in small steps and assert
only the bounds the criteria state (a change reflected within 1 minute of simulated time, off within 5 s, and so on),
never the number of ticks.

**T21 — The store.** `src/pipeline/tagging-edges/realtime/store.js` exports `createStore({ dir })`.
- `dir` defaults to `path.join(state.stateDir(), 'realtime')`.
- It returns:
  - `readSwitch()` → `{ on, changedAt, changedBy }`, `null` when missing, or `{ unreadable: true }`;
  - `writeSwitch(record)` writes it atomically, in the canonical compact form;
  - `unlinkSwitch()`;
  - `readStarted()` / `writeStarted(obj)`;
  - `readRecord()` → the record, `null`, or `{ unreadable: true, reason: 'record-unreadable' }` (a sha256 or version
    mismatch counts);
  - `writeRecord(body)` adds `sha256` over the canonical body;
  - `openJournal()` cuts `journal.jsonl` back to its last newline and fsyncs, then returns `{ lines: Iterable<string> }`
    or `{ unreadable: true }`;
  - `appendJournal(lines)` appends and fsyncs;
  - `truncateJournal()`;
  - `journalBytes()`;
  - `readStatus()` / `writeStatus(obj)`.
- Whole-file writes go through `state.writeAtomic`.

**T22 — The routes module.** `src/api/tagging-edges/realtime.js` exports `{ computeRealtimeStatus, validateSwitch,
handleRealtimeStatus, handleRealtimeSwitch }`.
- `validateSwitch(body)` → `{ ok: true, on }` or `{ ok: false, status: 400, error }`.
- The handlers take `(req, res, deps)`. `deps` defaults like `index.js`'s `withDeps`:

  ```
  { readFile, stateDir, isAlive, now, ownerPubkey | getOwnerPubkey, writeSwitch(record), unlinkSwitch() }
  ```
- The status handler reads `realtime/switch.json` and `realtime/status.json` under `stateDir()` through `readFile`.
- `computeRealtimeStatus` returns the fields in § Status. `on` and `onSince` come from `switchRecord`, `running` from
  `alive`, and `stale` is `alive && now - Date.parse(status.updatedAt) > 60000`.

**T23 — The wrapper's test seams.** `run.sh` honours:
- `TAGGING_EDGES_STATE_DIR` (as the pass does);
- `BRAINSTORM_CONF` (default `/etc/brainstorm.conf`);
- `TAGGING_EDGES_REALTIME_POLL_SECONDS` (default 2).

It resolves `node` through `PATH`, so a test can run it with a stub `node`.

**T24 — `lockHeld(fd, { file, readFile })`** (C20) reads `/proc/self/fdinfo/<fd>` through `readFile`. It stats `file`
with `fs.statSync(file, { bigint: true })`. It is true only when a `FLOCK … WRITE` lock line is present and `ino:`
equals the file's inode. A missing `file` argument keeps the old behaviour, so an old caller is not broken silently:
the wiring test pins that both callers pass `file`.


The suite writers' questions are settled here (T25–T31). They refine T1–T24 where those left a choice open.

**T25 — Planner details.** *(Amended by A1-17.)*
- **Container types.** `scannedIds` and `candidateIds` are `Set`s. `targets`, `addresses` and `ids` are arrays.
  `deadSeenAt` is a plain object from runId to milliseconds.
- **`promptFromVersion`** returns `null` whenever there is no address (T5's "id is lower-cased" is moot: the contract
  refuses upper-case hex at step 1, with no address).
- **A `by: 'a'` prompt's `target`** is `revokeTargets`' normalised address (pubkey lower-cased).
- **A kind-5 whose own pubkey is written in upper-case hex** is not `isEvent`-shaped, so it resolves nothing live.
  strfry does act on it, and the next catch-up's author-scoped candidate scan finds it (`authors` matches by hex).
  This adds to owner decision 5's corners: such a revoke is reflected at the next catch-up or safety diff (≤ 10 min).
  No known client writes one.
- **A round completes every address it decided,** whatever the action (`none`, `refused`, `create`, and so on),
  except a conflict or a failure. It journals `c` for the relay's returned id, which enters S. A refused id also
  enters R. So a refused version is not an arrival at the next catch-up.
- **`gateAction`** treats a `null` `ctx.entry` as an empty entry.
- **`mergePrompt`** keeps, for one `(by, target)`, the revoke with the greatest `created_at` and that revoke's
  `kind5Id`.
- **`passOverlaps` boundaries are strict:** `startedAt < commitAt`, and `endedAt > graphReadAt`. *(Amended by A1
  clarification 13: ties at `endedAt` and `deadSeenAt` overlap.)*
- **`roundOrder`** places an address queued in more than one lane once, at its earliest position.
- **Record shapes:**
  - `pending: [{ a, entry, lane, attempts, notBefore }]`;
  - `rechecks: [{ a, runId, entry }]`;
  - `parked: [{ a, code, attempts, nextAt }]`.
- **Replay.** `replayJournal` deletes a pending entry that `c` leaves with no version, no revokes and no look.
  Empty lines are ignored, not counted. Two `r` lines for one `(a, runId)` merge by `mergePrompt` rules.

**T26 — Store details.**
- **Methods** are synchronous (awaiting works).
- **`switch.json`'s canonical form** is compact JSON with the keys in the order `version, on, changedAt, changedBy`.
- **`readSwitch`** gives `{ unreadable: true }` unless the file parses to an object whose `on` is a boolean.
- **The record's `sha256`** is taken over `JSON.stringify` of the record without `sha256`, with object keys sorted
  recursively.
- **`readStarted()` and `readStatus()`** give `null` for a missing file.
- **`openJournal()`** gives `{ lines: [] }` for a missing `journal.jsonl` (not unreadable). Its lines exclude the
  trailing newline, with no empty item after the last one.

**T27 — Route details.**
- **A failed off-write.** A `{on:false}` whose write fails unlinks `switch.json` and answers 200 `{ success: true, on:
  false }` when the unlink succeeds, 500 otherwise.
- **A failed on-write** answers 500, never `success: true`, and does not unlink.
- **`computeRealtimeStatus`:**
  - `state` is `'off'` whenever the switch is off, `runningSince` is `null` when not alive, and `onSince` is `null`
    when off;
  - `stale` is true when alive and `updatedAt` is missing, unparseable or older than 60 s;
  - it re-applies `allowErrorCode` to `lastError.code` and to the `dbRefused.byReason` keys.
- **Read errors.** A `status.json` that cannot be read, or does not parse, answers 200 with the switch fields,
  `running`, and `statusUnreadable: true`.
- **`session.authenticated !== true`** with the owner's pubkey answers 403.
- **The default `writeSwitch`** is the store's, at `<stateDir>/realtime`.
- **The routes module** imports `allowErrorCode` from `src/lib/tagging-edges/realtime.js`.

**T28 — Wrapper details.**
- **PATH lookups.** `run.sh` calls `flock` and `sleep` through `PATH` (bare names), as it does `node`.
- **Finding the engine.** It finds `index.js` beside itself: `"$(cd "$(dirname "$0")" && pwd)/index.js"`.
- **Sourcing.** The per-start subshell is `( . "$BRAINSTORM_CONF" && exec node … )`. The Decision diagram's `;` is
  corrected to `&&`.
- **Signals.** It runs its backoff sleeps in the background and `wait`s, so a TERM during a backoff exits within 1 s.
- **Compatibility.** It stays bash-3.2-compatible.

**T29 — Engine details.** *(Amended by A1-17.)*
- **Subscription callbacks.** `subscribe`'s callbacks are called asynchronously, never inside `subscribe()`:
  `onEvent(event)`, `onEose()` and `onClose({ code, reason })`. A client-side `close()` fires no `onClose`.
- **Sync or async.** Store and state methods may be synchronous; the engine awaits them.
- **No sleeping in `tick()`.** `tick()` never awaits `deps.sleep`; `run()` owns every sleep.
- **What `status.json` carries.** It holds every § Status field that the route does not derive:
  - `state`, `firstStartedAt`;
  - `relay`, `subscription`, `lastReflectedAt`, `lastRound`;
  - `catchUp`, `counts`;
  - `pending`, `parked`, `seen` and `heard` (numbers), `journal`;
  - `setupProblem`, `lastError`, `preimageFile`;
  - `process`, `updatedAt` (ISO).

  The route derives `statusVersion`, `on`, `onSince`, `running`, `runningSince`, `switchUnreadable` and `stale`.
- **`handleSignal('SIGTERM')`** leads to `{ exit: 0 }` within 5 s.
- **Row order.** Creates, updates and moves are sorted by the desired edge's `(from, to)`; removals by the snapshot's
  ends.
- **Parking.** A row is parked after two rounds that each read its address and failed it with the same code. A
  bisection inside one round is one attempt.
- **The "no row succeeds" rule** applies after bisection: only when every single-row attempt in a round fails with one
  code are those rows re-queued with backoff instead of parked. A good row in a batch with one bad row still lands in
  the same round.

**T30 — readKeys rows** are plain `{ address, eventId }` objects. Either value is `null` when the property is absent.
The engine ignores rows whose address is not a tagging address.

**T31 — Scan-strict details.**
- **Streaming.** `onEvent` delivers each event as it is parsed, so events before a later failure have already been
  delivered. The scan still rejects.
- **`filter-too-large`** makes story 2's SS9 (the real `spawn` E2BIG on a 3.3 MB filter) unreachable. SS9 is re-aimed
  to `filter-too-large`, and SS8 still pins `spawn` for a spawn that throws.
- **Redaction.** The widened redactor may cut a tagging address whose `d` starts with 2–5 digits (the ADR's New debt).
  Suites pin only letter-led `d` values.
- **`lockHeld`** reads no `ino:` line as not held.

**T32 — The last open choices.**
- **`roundOrder`** de-duplicates first, then caps at 500, so a repeat takes none of the round's places.
- **`mergePrompt`**, on a `created_at` tie for one `(by, target)`, keeps the revoke it already holds.
- **A kind-5 a catch-up candidate scan keeps** becomes a revoke prompt `{ type: 'revoke', kind5Id: <its id,
  lower-cased>, created_at, by, target }`. `by` and `target` come from the candidate it matched, so an upper-case
  pubkey or id in the event does not stop it (T25).
- **`status.json`'s `process`** is `{ pid, startTime, startedAt }`, with `startedAt` an ISO time. The route's
  `runningSince` is `process.startedAt` while alive.
- **Allow-listed keys.** When `dbRefused.byReason` keys collapse to `'error'` under `allowErrorCode`, their counts
  are summed.
- **A missing `status.json`** is not `statusUnreadable`. The route's `switchUnreadable` follows T26's `readSwitch`
  rule.
- **The default `writeSwitch`** writes under the handler's `deps.stateDir()`.
- **T29's "no row succeeds" rule** applies to rows for two or more addresses. A lone row that fails with the same
  non-transient code in two rounds is parked.
- **The subscription buffer.** The engine drains it at every tick (≤ 250 ms apart), keeping only ids, addresses and
  resolved prompts. What the relay delivers between two ticks is the one buffer outside the round's kept budget.

**T33 — What the blind reference implementation found.** *(Amended by A1-5 and A1-17.)* An implementation written from this ADR alone, without the
tests, disagreed with the suites in one place (`status.process.startedAt`, T32; the test was corrected). Its authors
flagged these readings, which are now fixed:
- **Restored pending work.** `replayJournal`'s `pending` holds entries only (T15). A restart restores every pending
  entry as catch-up work, with `attempts` 0 and due at once. `record.json` keeps `lane`, `attempts` and `notBefore`
  for diagnostics only.
- **Replaying a `v` line** also applies `discardSupersededRevokes` at that address, to the pending entry and its
  re-looks, as the live path does. So a revoke discarded before a crash does not come back.
- **`discardSupersededRevokes(entry, null)`** keeps every revoke, since an empty read keeps them (the gate rule). A
  `null` entry is returned as is.
- **Times.** Every time field in `status.json` and in the status answer is an ISO string.
- **`statusUnreadable`** is present, as `true`, only when `status.json` cannot be read.

**T34 — The wrapper's healthy-run seam.** `run.sh` honours `TAGGING_EDGES_REALTIME_HEALTHY_SECONDS` (default 60). It is
used for both of the wrapper's 60 s rules:
- an exit within that many seconds of start counts as a quick exit and backs off;
- that many seconds of healthy running resets the backoff.

## Amendment A1 — revokes by event id, and what an empty read keeps (Implementation kick-back, 2026-09-29)

**Why.** Implementation built the path to T1–T34, and every suite passed. Two conformance rounds against that code
then confirmed that this ADR's rules for revokes by event id could not keep its own promise, "a revoke of an old
version can never authorise removing a newer one that later leaves with no event" (§ gateAction):
- **Wrongful removals.** The discards that were to keep the promise are event-driven. They cannot order versions, and
  a prompt waits in many places: pending, in flight, parked, re-looks, a catch-up's backlog, the journal. A stale
  by-id revoke survived in one of them, and removed a newer relationship once that version left with no event.
- **Lost revokes.** An empty read's shrink (T7) dropped the heard ids that a late or gap-crossing revoke needs to
  resolve, so those revokes waited for a pass.

The owner sent the story back to Architecture. Every passage above that this amendment supersedes carries an
"(Amended by A1-n.)" marker. Where any sentence above conflicts with A1, A1 governs.

**How it was settled.** Three independent designs were each prototyped on the built code. Each was measured against:
- the ten story suites;
- the 132 reproduction scripts of both review rounds;
- a property fuzzer over the suites' fakes, 8,000–16,000 seed-runs per design, in eight modes (healthy; latency with
  interleaving; relay writes injected inside scans; passes; lost records; crashes and restarts).

A judge chose one design on the evidence and grafted ideas from the other two. The result ran 16,000 fresh seed-runs
(7.7 M operations) with no safety violation. Two red-teamers then attacked it. Their fixes were prototyped and
re-measured, and a second pair of red-teamers attacked those. Its fixes are folded in too; A1-21 says which of them
were prototyped and which Test Design pins first.

What the fuzzer checked on every step:
- no removal while the relay held an accepted version at the address;
- no removal without an author's deletion that A1-4 accepts, or a refused version at the read;
- no create for a baseline version;
- every write carries the contract's properties;
- off within 5 s, and no leak in the status;
- bounded state;
- in healthy runs, every change and revoke reflected within the minute, outside the corners below.

**What stays.**
- The bindings: `decideAddress` is unchanged, and versions are never ordered by content or `created_at`. A graph read
  comes before a strict relay read. A delivery or a kind-5 only prompts.
- No schema change and no strfry change.
- Owner decisions 1, 3, 4, 6, 7 and 8, and the Planning decisions: the 1-minute bound, the 5-minute catch-up, no count
  limit, no backfill, and it ships off.

**The idea.** strfry keeps one version per address and tells a live subscriber about stores in store order. So the
order in which the path *learns* versions at an address follows the relay's store order, without reading a
`created_at`. The path learns from deliveries, and from reads placed at the moment they were taken.

The path keeps, per address, the latest version it learned (the **top**) and a few versions it learned there before
it (**older**):
- A by-id deletion resolves only when it names the top. A deletion naming anything else was stored after a newer
  version had replaced it, so strfry acted on nothing.
- A resolved deletion authorises removing the relationship only when that relationship records the named version, or
  a version learned there before it.

Nothing is discarded anywhere, so no waiting place can keep a stale revoke that matters.

### The rules

**A1-1 — The lineage replaces H.** For each tagging address A the path keeps a lineage `L(A) = {top, older}`:
- `top` is the latest version the path has learned at A, or `null` for an address only the census recorded (A1-8);
- `older` is the set of versions it learned at A before `top` that the graph may still record. It is usually empty,
  is allocated lazily, and never holds more than 8 ids (A1-7);
- an index maps each top id to its address.

`S` (completed and baseline ids), `B` and `R` (`refusedSeen`) keep every other role: arrivals, look-only prompts,
held creates and refused versions. They also keep their read shrink (T7) and their compaction (T8). `H` is removed.
The status's `heard` becomes the number of addresses whose top is not in `S`, kept as a counter.

*(Supersedes: T3's map list and its H-to-S move; D3-A's map list, "H: heard but not yet completed" (:137); the
record.json row's `heard` (:365); § Status's `heard`, "the size of H" (:731).)*

**A1-2 — Learning.** The path learns version X at address A in three ways:
1. A delivery of X is drained.
2. A successful, conflict-free strict read of A returns X, as an edge or as a refusal. This holds even when the
   graph's rows at A conflict, though nothing is decided there, and even when the round's element read for A then
   fails or is deferred. A round learns every such read before its element checks.
3. A stamp scan finds X at A: a catch-up's scan (arrivals included), a first start's baseline, or a lost record's
   re-baseline.

A delivery makes X the top, and the previous top joins `older`.

A read or a scan is placed at its **capture**: a counter taken just before its strfry process is spawned, unique to it.
- If the path learned anything at A after that capture, the read teaches nothing at A: neither X nor the graph's
  version. Their order is unknown.
- Otherwise X becomes the top, the previous top joins `older`, and X leaves `older`.
- In that case, if the round's graph read (or the catch-up's key read) found the graph recording G ≠ X at A, G also
  joins `older`. G was written from a relay read taken before that graph read, so X's current stay began after G was
  held.

Nothing else changes a lineage. An empty read changes nothing. Only the cap and compaction prune (A1-7). No
`created_at` is read.

*(Supersedes: § What it hears, "the id enters H (journal `v`)" (:246-248); § The catch-up step 2, "Each becomes a
version prompt" (:411-412); § "S, H, B and refusedSeen shrink", bullet 2, as it applies to H (:481-488); T7 for H.)*

**A1-3 — Resolution.**
- A kind-5's lower-cased `e` target X resolves only while X is the top of its address's lineage, and then gives that
  address. Any other `e` target resolves nothing.
- An `a` target resolves at a tagging address of at most 255 UTF-8 bytes that a lineage holds, that `S` records an id
  at, or that the graph's last keys hold.
- The author check, the foreign count and de-duplication are unchanged.

Why this is enough:
- When a deletion is drained, every version stored at A before it on this connection has already been learned. So
  if X is not the top, a later version had replaced X when the deletion was stored, and strfry acted on nothing.
- A deletion stored across a reconnect, a restart or a first start's REQ-to-scan window is found by the catch-up
  that follows (A1-9, A1-10).
- The exceptions are decision 5's first corner (a version stored and revoked by id before any delivery of it reached
  the path) and decision 10's new bullet (a deletion drained while the read that first shows the path its target is
  still running).

*(Supersedes: § What it hears, the `e` bullet and the `a` bullet's "S ∪ H records an id there" (:250-254); "Why
S ∪ H is enough" (:261-264); D5-A's "A kind-5's e targets resolve through S ∪ H" and "S ∪ H covers every stamped
version on the relay" (:165-170); T6's resolution bullets; "Binding 2, refined" (:815-818).)*

**A1-4 — The gate.** A by-e revoke naming X satisfies the gate for removing the relationship at A that records G only
when:
- **(i)** X = G; or
- **(ii)** X is the top of A's lineage, and G is in its `older`.

Clause (ii) stands only if the owner accepts decision 11. If decision 11 is declined, clause (ii) is deleted.

Further rules:
- The gate reads a copy of the lineage taken when the round decides A. Versions heard while the round was in flight
  count. This round's own read is not yet learned.
- A relationship whose `eventId` is missing or not a string satisfies neither clause.
- By-a revokes are unchanged: `revokeApplies` on a well-formed stored edge.
- A not-on-relay removal still needs a revoke that satisfies the gate. A non-tagging removal needs such a revoke or a
  version prompt at A. A look never removes.

*(Supersedes: § gateAction's by-e bullet, from "it names by `e` a version the relay held at that address" through the
closing sentence (:549-553), including "A by-e prompt is discarded … An empty read keeps it"; T16's "it is `by:
'e'`".)*

**A1-5 — No discards; bounded prompts.**
- Nothing discards a revoke prompt for being stale. A stale by-e prompt is inert under A1-3 and A1-4.
- Put-backs, re-looks, parked entries, restored work, a catch-up's work and backlog, and journal replay all carry
  prompts unchanged.
- `mergePrompt` still de-duplicates by `(by, target)`.
- An entry keeps at most **8** by-e revokes, the most recently merged. Dropping one only withholds a removal.
- Replaying `c` answers only the version prompt it names; an entry left with no version, no revokes and no look is
  deleted.

*(Supersedes: T15's `discardSupersededRevokes`; T33's two discard sentences; every discard site the implementation
added in review round 1.)*

**A1-6 — Record and journal.**

`record.json`:
- `heard` is replaced by `lineage: [[address, top | null, [older…]]]`, one row per lineage. The third element is
  omitted when empty.
- `epoch` names the journal generation the record goes with (below).
- Parked rows gain `entry` (A1-12).
- `pending` also carries a running catch-up's unfed backlog (A1-9).

Journal lines. **Every line that changes a lineage is absolute and self-contained:**
- `v {id, a, top, older}` sets `L(a)` to exactly `{top, older}`, and adds a version prompt for `id`. A first start's
  buffered delivery that the scan's version outranks is one such line, carrying the final lineage.
- `o {a, top, older}` sets `L(a)` exactly. It records a read's or a scan's learning, and a graph version joining
  `older`.
- `d` is also written for a catch-up's found revokes (A1-9).
- `x` drops the ids it lists from `S`, `R` and `B` only.
- `c`, `f`, `b`, `r`, `rc`, `p` and `k` are unchanged.
- **The epoch.** Every compaction writes `record.json` with a new `epoch`, then truncates the journal and starts it
  with `e {epoch}`. Replay applies only lines after the `e` line matching the record's epoch. So a truncation that
  failed after a re-baseline cannot replay the older generation's lines over the new record.

**Replay.**
- Replay applies each line as it is read and never buffers the journal. If the streamed read fails part-way, the
  state built so far stands, and the start reports `journal-unreadable`.
- An absolute line never splits one change across two lines, so a torn append cannot invert a lineage by itself.
- A replayed journal that lost lines can still leave a lineage behind the store order: the last flush interval
  before a crash, the lines a spell of failing appends still held when a crash, a switch-off or a SIGTERM ended the
  path (§ Failure handling), a torn or damaged line, or a read that failed part-way. A stale top can then let clause
  (ii) act on a stale deletion (decision 11's journal-fault triggers).
- A start whose journal was not read whole (`journal-unreadable`) therefore demotes every restored top into its
  `older`. The start catch-up's stamp scan re-learns the tops of addresses still on the relay within seconds. Lines
  never written leave the journal whole (a failed append is cut back off), so they cause no demotion. *(The spell
  and this sentence added at story 4's Architecture, 2026-09-30, from story 3's review, round 3, carry-forward C7.)*

**Compaction cadence.** A round-end compaction runs once the journal passes the larger of 1 MB and a quarter of
`record.json`'s size. Absolute lines are larger (up to about 0.8 KB with eight older ids), and this bounds how often
a flood at one address rewrites the whole record.

*(Supersedes: the state table's record.json row (:365); the journal table's `v` and `x` rows (:374, :377); T19's line
table and its replay rules; T25's record shapes; § Journal rules as they applied to a read failing part-way.)*

**A1-7 — Compaction and bounds.**
- **The cap.** `older` never holds more than 8 ids. Learning a ninth drops the oldest-learned. Dropping an id only
  withholds clause (ii).
- **At a catch-up's compaction** (a safety diff included), `S`, `R` and `B` shrink as in T8, without H:
  `compact(maps, scannedIds, captureSeq)`.
- **A lineage is dropped** when all of these hold: its top is not in the stamp scan; the graph's keys did not hold its
  address; no work waits there (pending, in flight, parked or a re-look); and nothing was learned there after the
  scan's capture.
- **Otherwise its `older` is cut** to the id the graph's keys recorded there, plus the ids learned there after the
  scan's capture, whether or not work waits there.
- **The pass exception.** While a pass may still write from an older read, no lineage is dropped and `older` is not
  cut; only the cap applies. That means a run that overlapped one of the path's rounds and has not been seen to end, a
  run alive at a report read taken with the catch-up's key read, or a run that ended after that key read.
- **Other compactions** (a 1 MB journal) snapshot the lineage without pruning it.
- **Bounds.** After a catch-up's compaction there is one lineage per address the relay or the graph holds, and `older`
  holds at most the graph's recorded id plus what was learned since the capture. Between catch-ups, and during a
  pass, `older` is capped at 8 ids per address, and an entry at 8 by-e revokes.

*(Supersedes: § The catch-up step 6, "H drops ids completed, or neither scanned nor candidates" (:444); T8's H rule
and its `candidateIds` parameter.)*

**A1-8 — The census.** A start that takes a baseline (the first start, or a lost record's re-baseline) reads the
graph's keys once, before its REQ:
- one `readKeys` call, with no retry;
- a 10 s deadline the engine enforces itself: a late answer is ignored. `readKeys`' `timeoutMs` bounds a transaction,
  not a hung connection or the driver's retries;
- each `(address, eventId)` at a tagging address the lineage does not hold joins `older` there, with no top;
- the census is the graph read for the baseline scan's placement (A1-2). Wherever the scan places a version X other
  than the census's id G, G joins `older` under X, including at addresses a restored lineage already holds.

Why this is sound: every relationship the census reads was written from a relay read taken before the census.
Everything the path learns afterwards was on the relay after it, whether a delivery on the REQ that follows or a
version a later read or scan finds.

A census that fails or is late records nothing, and the start proceeds (decision 5). Its entries reach `record.json`
in the baseline's own snapshot, which follows at once; a crash before that snapshot repeats the whole start. Other
starts take no census: their lineage is restored, and A1-2's graph learning places a graph version the path never saw
wherever the relay holds another.

*(Supersedes: § First start step 1, "No graph contact and no schema check happen first" (:456-457): a Neo4j outage now
delays the baseline by at most 10 s. § Lost record (:466-476) gains the census.)*

**A1-9 — The catch-up.**
- **Step 2.** The stamp scan's pairs are learned at its capture (A1-2), arrivals included, with graph learning from
  step 1's keys. They are journaled as `o` lines.
- **Step 3, deletion candidates.**
  - each graph event id the scan no longer finds (unchanged);
  - each lineage top the scan no longer finds, at an address the graph holds with another event id. No other id could
    pass the gate.
- **Found revokes.** A kind-5 that a candidate scan keeps becomes a revoke prompt (T32). It is journaled as a `d` line
  when the catch-up builds its work. If a compaction happens while the catch-up's backlog is unfed, that backlog is
  written into `record.json`'s `pending`. So a found revoke survives a stop before its round, even if the relay later
  loses the kind-5.
- **Step 4.** Parked addresses come back with their prompts (A1-12).
- **Step 6.** Compaction as in A1-7.

*(Supersedes: § The catch-up step 2 (:411-412), step 3's second bullet (:421-422), "Each kind-5 kept … becomes a
revoke prompt" (:433), step 4 (:437-438) and step 6 (:442-445); T10's second bullet; T32's candidate-scan prompt, which
gains the `d` line.)*

**A1-10 — First start.**
1. The census (A1-8).
2. Subscribe and wait for EOSE; take the stamp scan (steps 1–2, unchanged).
3. `S` and `B` as before. The lineage learns the buffered deliveries in drain order, then places the scan's versions
   (A1-2).
4. Write `record.json`, `started.json` and the status. Process the buffer. Then request one catch-up (trigger
   `start`).

The first start itself still acts on no baseline version, and no catch-up creates a version in `B`.

That catch-up does two things:
- Its candidate scan finds a revoke stored after the REQ, or across a pre-record reconnect, when the revoked version
  is the graph's recorded id or a lineage top. A revoke naming a version the path never learned waits for a pass
  (decision 5).
- Its look-only prompts bring a relationship the backfill left behind the relay up to the relay's version within
  seconds, instead of at the first safety diff (decision 5, the owner's note).

Review round 1's backlog-only catch-up folds into it. The buffer's 20,000-target cap stays.

*(Supersedes: § First start step 4, and "It takes no action on the baseline versions and runs no candidate scan"
(:461-463).)*

**A1-11 — No start hold.** No round waits for a catch-up to finish. Restored work and live prompts run between a
catch-up's reads, and while it fails or backs off (5→60 s), as AC-3's "other changes proceed meanwhile" requires.

This is safe because a read never shrinks a lineage, and rule 2 names the top. A round that reads a restored address
first still leaves the catch-up its candidate.

Rounds and a catch-up's reads still take turns, one at a time (Throughput: "Sequential by design"). So while one of
its reads runs, a round waits for it: normally under a second (0.5 s locally at 7,030 taggings), and at decision 9's
scale ceiling about the stamp scan's duration.

The state is `catching-up` only while a catch-up or a baseline runs.

*(Supersedes: review round 1's start hold, and OPERATIONS §12.9's "the path applies nothing, new changes included".)*

**A1-12 — Parked prompts persist.**
- `record.json`'s parked rows are `{a, code, attempts, nextAt, entry}`.
- Replay merges each row's `entry` into `pending` at its address. `parked` stays `Map<address, code>`, and the `p` line
  is unchanged.
- A start re-queues each parked address as catch-up work, carrying its prompts.

*(Supersedes: T25's parked shape; § The catch-up step 4 (:437-438) and § Failure handling's "retried … at every
start" (:605-606), which now carry the prompts.)*

**A1-13 — Time-outs.**
- **A group that times out.** A round scan of two or more addresses, or an element scan of two or more ids, that
  fails with `timeout` is not bisected in its round. Its addresses are deferred, with no attempt counted (for an
  element scan, the addresses that need those ids).
- **Is it a stall?** If another scan in the same round answered, the relay is up, and the group's members are marked
  to be read alone. If nothing else in the round answered, the next round first re-reads them as one group. Only if
  that group times out too are they marked. So after a Redis stall the addresses come back in their usual groups.
- **Read-alone marks.** A marked address is read alone: one address per scan, one element id per scan. The mark stays
  until its own read succeeds. A lane's marked singles are read right after that lane's usual groups, so live and
  re-look singles come before the catch-up's heavy reads and lane 4.
- **A single that times out** is that address's own failure (5→60 s). A round reads no further marked single after
  one has timed out; the rest wait for the next round, with no attempt counted. After three consecutive single
  time-outs the address is parked like a refused write (5 min, 30 min, then every 6 h).
- **The stall guard.** Two group time-outs in a round before any scan answers mean the relay is not answering. The
  round then starts no more reads and defers the rest.
- **Everything else.** Every other failure is bisected in the round, as now.

So an address whose scans never answer delays the addresses read with it:
- by two time-outs plus a round when another read in its first round answered first: about 41 s locally, 61 s at
  100 ms per strfry process, 100 s at 300 ms;
- by three when its group was that round's only read: about 61 s locally, 80 s at 100 ms, 120 s at 300 ms and 320 s
  at 1.3 s (decision 9).

However many such addresses there are, each round spends at most one single time-out on them, and each is parked after
three. *(Figures per case: A1 clarification 11.)*

*(Supersedes: § Failure handling, "That scan's addresses are deferred and bisected, so the others proceed" (:585), for
time-outs; review round 1's stall guard.)*

**A1-14 — The catch-up share.**
- **The share's budget.** The share's scans run with `maxBytes` equal to what is left of its fifth of the round's kept
  budget (3.2 MiB), address scans and element reads alike. So the share never keeps more than its fifth.
- **No bisection under the share.** A share scan that fails `too-large` is not bisected. If the share has read nothing
  yet this round, its first address (or id) is read alone under the remainder, so the share still advances whenever
  one address fits. Then the share ends for the round: its remaining addresses and ids go to lane 4, unbisected.
- **Lane 4** reads them after the live and re-look lanes (and their marked singles), under what the round has left,
  with the usual 8 MiB single-scan cap. An element of a share address already read that no longer fits the share is
  read there too, so no read address is left without its element.
- **What that guarantees.** Live and re-look reads always keep at least 12.8 MiB, and the share costs at most two extra
  strfry processes per round. A catch-up address heavier than the share waits for a round whose live and re-look reads
  leave room. Kept memory stays below (16 + 8) MiB × 5.8.

*(Supersedes: § Lanes and rounds item 1 (:271-272) for element reads; § Bounds' 8 MiB round-scan cap (:500) for share
scans; review round 1's element-read change.)*

**A1-15 — Why the lineage follows store order** (a new paragraph for § gateAction).

What strfry guarantees: it keeps one version per address, tells a live subscriber about stores in store order, and
tells nothing across a reconnect.

What the lineage records:
- A delivery is learned when it is drained. A read or a scan is learned at its capture.
- A read teaches nothing at an address where anything was learned after its capture.
- The graph's version joins `older` only below a version a read placed. The census's versions join only below
  everything learned after the census.

So a top is the latest store the path has seen at its address, and every id in `older` was stored or held there
before it.

When a by-id deletion of the top X is drained, nothing stored at A after X reached the path first. So strfry either
held X when it stored the deletion, and deleted it, or X had already left with no event. Either way the author deleted
the latest version stored at A, and an empty read after that follows from it, for a relationship recording X (clause
i) or recording a version X replaced (clause ii).

A version stored after the deletion is learned when it arrives, and becomes the top. After that, the deletion enables
only clause (i). A version the path never learned is never in `older`.

The lineage sees only stamped versions the contract can give an address. A republish at the same address without the
stamp, or in a form the contract refuses at step 1, is a newer store the path never learns.

So a revoke of an old version authorises removing a newer one only when the path never received the newer store's
notice (decision 11).

*(Supersedes: § gateAction's closing justification (:552-553), which discards enforced; it is now argued. Also
D5-A's coverage claim, together with A1-3.)*

**A1-16 — Owner decisions** (they replace decisions 2, 5, 9 and 10, and add decision 11). Accepted by the owner on
2026-09-29, decision 11 included, as written.

**(2) What counts as a revoke of the recorded version.** A not-on-relay removal needs the tagging's author's deletion
naming one of these:
- the address, with `revokeApplies`;
- by id, the version the relationship records;
- by id, the latest version the path has learned at that address, when the relationship records a version the path
  learned there before it (clause ii; decision 11).

These wait for the pass:
- the four existing cases (a malformed stored `createdAt`, revoked by address; the graph ahead of the relay; an
  address deletion whose kind is spelled with leading zeros or `+`; an upper-case pubkey address deletion, now read as
  "that the path could not resolve when it was delivered: the path was down, or did not yet know the address");
- a relationship whose stored `eventId` is missing or not an id (only an out-of-band write makes one), revoked by id;
- a relationship recording a version the path never learned at that address, when its author revokes by id a newer
  version the path did learn. Such a version was written by the pass or another writer from a relay read the path did
  not share. The exceptions: a read or a scan showed the path the newer version while the graph recorded the older
  one, or a census recorded the older one.

**(5) Corners that wait for the pass.**
- **The first corner becomes:** "A version stored and revoked by id before the path's subscription delivered it:
  while the path was not running (a deploy included), while its subscription was reconnecting (backoff 1→15 s, longer
  while the relay refuses connections) or connected but not delivering, or within one import or sync batch or the
  relay's ~100 ms change notice (story item 7)."
- **The second corner becomes:** "A version stored or learned in the last flush interval (≤ 250 ms) before a crash,
  and revoked by id before the restart; or a revoke drained in that interval, when its kind-5 then leaves the relay
  before the restart." A lineage learning lost in that interval can also end in a decision-11 removal. While journal
  appends keep failing (a full data volume), the interval runs from the last append or compaction that succeeded,
  and a switch-off or a SIGTERM (a restart or a deploy) ends it as a crash does. *(Widened at story 4's
  Architecture, 2026-09-30, from story 3's review, round 3, carry-forward C7; the owner accepted it on 2026-09-30.)*
- **The fourth corner adds:** "At a first start the census can hold the REQ back by up to 10 s (normally tens of
  milliseconds), which widens this window by as much."
- **The first start adds:** "A revoke stored between the first REQ and the baseline scan, naming a version the path
  never learned (the graph behind the relay at the switch-on). The extra pass after `firstStartedAt` settles it."
- **The lost-record corner adds:** "If the re-baseline's census fails, or the surviving record's lineage at an address
  predates the graph's version there, a relationship recording a version not on the relay at the re-baseline is not
  removed on a by-id revoke of a later version until the pass."

**(9) Ceilings.**
- **Heap.** Measured on Node 22 at 200,000 taggings, `S` with its index takes 546 B per tagging. The lineage adds
  about 113 B where an address keeps one version, and about 345 B where compaction keeps the graph's older id beside
  it.
- **The whole path.** Its peak is a compaction. With the whole body serialised and hashed at once, the reference
  realisation's first start ran at 225,000 taggings and ran out of heap at 250,000, and a restart ran out at 235,000,
  in the 384 MB heap. So `record.json` is written and hashed as a stream of
  rows (A1-18), and the Implementer records the whole path's measured ceiling in the story's Evidence: a first start
  with its census, a catch-up and a compaction.
- **The revisit trigger** moves to 100,000 `seen` (from 250,000; today 7,030), a staging round above 12 s, or a stamp
  scan above 20 s.
- **Live work waits for a catch-up's reads** (A1-11): normally under a second, and at the scale ceiling about the
  stamp scan's duration, at every safety diff.
- **A never-answering address** delays the addresses read with it by two time-outs plus a round (about 41 s locally,
  61 s at 100 ms per strfry process, 100 s at 300 ms), or by three when its group was its round's only read (about
  61 s, 80 s, 120 s, and 320 s at the pessimistic 1.3 s). Each round spends at most one single time-out on such
  addresses, and each is parked after three (A1-13).
- **Journal cadence.** Under a flood at one address the journal grows by up to about 0.8 KB per version, and a
  round-end compaction runs once it passes the larger of 1 MB and a quarter of the record (A1-6).
- **A catch-up heavier than the share** waits for rounds whose live and re-look reads leave room (A1-14).

**(10) Residuals beyond the minute.**
- **The first bullet becomes:** "A subscription that stays connected but stops delivering: what it misses, revokes
  included, is reflected at the next safety diff (≤ 10 min), except a version both stored and revoked by id while
  nothing was delivered, which waits for the pass (decision 5's first corner). Ledger row
  `2026-09-29-strfry-delete-hides-next-write` records one strfry trigger: after an operator deletes the relay's
  newest events, or wipes it, writes that re-use the deleted ids are missed by the subscriptions that had passed
  them." *(Corrected by A1 clarification 24.)*
- **A new bullet:** "A deletion drained while the read or stamp scan that first shows the path its target is still
  running (the target was stored while the path was not hearing it) resolves nothing then. The next safety diff finds
  it (≤ 10 min)."
- **The Redis bullet** stands.

**(11, new) A lost-notice removal: for the owner to accept or decline.**

The case: the relationship records Y, and the path believes a later version X replaced Y. But the relay's last store
at the address was newer than the path knows, and its notice never reached the path. That newest store then leaves
the relay with no event (an operator's delete, an expiry or a wipe) before the path reads the address again or scans
the relay. The author's by-id deletion of X then removes the relationship recording Y.

It comes in three shapes:
- **(a)** Y itself was stored again, as an older version re-sent, after the author's deletion of X. The removal is
  one the path already owed for that deletion.
- **(b)** Y is a version a read showed the path while X's older notice was still arriving, and Y's own notice was then
  lost.
- **(c)** A third version W, stored unheard, replaced the top X. The author's stale deletion of X acted on nothing,
  and W left with no event before the path learned it. The deletion is found by the next catch-up's rule 2 or, if it
  arrives while X is still the top, on delivery, and clause (ii) removes the relationship recording the older version.
  A republish the path cannot see (unstamped, or refused at the contract's first step) counts as W and need not leave:
  the removal then happens while the relay still holds it, as the pass's would.

How notices are lost:
- across a reconnect (the reconnect's catch-up is deferred up to 30 s, and longer while reads of that address fail);
- while the path is not running;
- within the relay's ~100 ms change notice around a read;
- through strfry's delete-hides-next-write defect;
- through a journal fault: a delivery drained but its journal line lost (the last flush interval before a crash; the
  lines a spell of failing journal appends still held when a crash, a switch-off or a SIGTERM ended the path; a torn
  or damaged line; a journal read failing part-way), so the restart restores a lineage behind the store order. A
  start that reports `journal-unreadable` demotes its restored tops (A1-6), so only a crash's last flush interval, a
  failing spell's unwritten lines and a damaged line remain. The spell adds occasions, not a new kind of removal.
  *(The spell added at story 4's Architecture, 2026-09-30, from story 3's review, round 3, carry-forward C7; the
  owner accepted it on 2026-09-30.)*

In every shape, the relay then holds nothing the path or the pass can read at the address, and the next pass makes the
same removal. These are
single-address removals that need the author's own deletion, never a mass one.

**If declined,** clause (ii) is deleted. Every by-id revoke of a version the graph does not yet record then waits for
the pass: a quick undo, a version heard and then revoked during a graph outage or failing reads, and a revoke across a
reconnect gap. All of those then miss AC-2's minute. **The Architect recommends accepting.**

**The safety-diff paragraph** (§ What it hears) takes decision 10's first bullet in place of "no known strfry defect
behaves this way". The § Owner decisions preamble counts decision 11 among the decisions that qualify story criteria.

**A1-17 — Interfaces for Test Design** (T-item changes).

- **T2.** The exports drop `discardSupersededRevokes`, and add `learnVersion`, `learnOlder`, `lineageAt`,
  `lineageValue`, `setLineage` and `pruneLineage`. `LIMITS` is unchanged. The two caps (8 older ids; 8 by-e revokes
  per entry) are module constants.
- **T3.**
  - `newMaps()` → `{S, B, R, L}`, with `L: Map<address, {top: string | null, older: Set | null}>`. `recordId`'s
    `which` is `'S' | 'R'`.
  - `learnVersion(maps, address, id, {under})` returns whether the lineage changed. With `under` (a capture that a
    later learning at the address outranks), it teaches nothing.
  - `learnOlder(maps, address, id)` returns whether the lineage changed. Both respect the cap.
  - `lineageAt(maps, address)` and `lineageValue(maps, address)` → `{top, older: []}`.
  - `setLineage(maps, address, value | null)`.
  - `pruneLineage(maps, {scannedIds, graphKeys, keep, keepOlder, learnedAfter})` → `{droppedAddresses}`.
- **T6.** An `e` target resolves through the lineage's top. An `a` target resolves through a lineage, `S` or
  `graphAddresses`.
- **T7.** `S`, `R` and `B` only.
- **T8.** `compact(maps, scannedIds, captureSeq)`.
- **T10.** Rule 2 uses lineage tops.
- **T15.** No `discardSupersededRevokes`. `mergePrompt` keeps at most 8 by-e revokes, the most recently merged.
- **T16.** `ctx.lineage`, and A1-4.
- **T19.**
  - `v {id, a, top, older}` and `o {a, top, older}` are absolute;
  - `x` covers `S`, `R` and `B`;
  - `c` keeps revokes;
  - parked rows' entries are merged into `pending`;
  - the record has one lineage row per lineage, and an `epoch`;
  - `e {epoch}` opens each journal generation, and replay applies only the record's generation;
  - replay applies lines as it reads them, and a `journal-unreadable` start demotes restored tops.
- **T20.** `start()` subscribes only when no baseline is due. At a baseline start, the census activity subscribes
  when it ends.
- **T25.** The record has lineage rows, parked rows with `entry`, and `pending` with the unfed backlog.
- **T29.** The status's `heard` is a counter of addresses whose top is not in `S`. The engine enforces the census
  deadline.
- **T33.** The `v`-line discard sentences are removed.

**A1-18 — Implementation settlements** (not rules; the Implementer's to do).
- **Remove round 1's discard machinery:** `supersede`, `supersedeByRead`, `revokeSeqs` and `promptSeq`, `roundHeard`
  and `current()`, putBack's fresh-version discard, the catch-up's scan discard, `complete()`'s re-journalling of `d`
  after `c`, the start hold, and `discardSupersededRevokes`.
- **Round 2's code defects.** Catch-up arrivals are learned (A1-2 and A1-9), which closes fuzzer-3. The item's
  read-alone mark survives put-backs. A fake scan that times out must advance the fake clock by its `timeoutMs`.
- **Status.**
  - `lastReflectedAt` moves only for a decided, conflict-free address whose write applied, or whose decision needed
    no write and was not held by the gate (review round 2, fix-verifier-9).
  - `heard` is a counter.
- **After a stop,** the final status says `subscription.connected: false` (seen in the local end-to-end run).
- **`record.json`** is written and hashed as a stream of canonical rows, with no whole-body deep copy. Start reads it
  the same way.
- **The reference realisation** of A1 lives in the session scratchpad (`amend/d2/wt`). It is uncommitted and on no
  branch, and it is not durable. The Implementer works from this text and the tests.

**A1-19 — Docs and story changes.**

*The story (a Planning amendment in this commit):*
- **AC-3's "What a removal needs"** admits a deletion naming the latest version the path saw at the address, when the
  relationship records a version it saw there before. A deletion naming a version since seen replaced prompts nothing.
- **Item 9** takes the same two sentences.
- **Item 7 and Out of scope** add "or while the running path's subscription was reconnecting or had stopped
  delivering". The owner re-confirms item 7.
- **The user-facing list** gains "a relationship another writer recorded from a version the path never saw, when a
  newer version is revoked by its id".
- **The amendment notes** beside AC-2 (decisions 2, 3, 9, 10 and 11), AC-3 (decisions 2, 5 and 11), AC-4 (decisions
  5, 9 and 10) and item 9 (decisions 2 and 11).

*This ADR (in this commit):*
- the "(Amended by A1-n.)" markers;
- the safety-diff paragraph;
- the Planning-amendment list;
- the AC-2 and AC-3 rows of "How each acceptance criterion is met";
- the Implementation notes' planner test lines about H.

*With the implementation (the Implementer's docs):*
- **BIBLE §6 Revokes.** By id: "the version the relationship records, or the latest version the path has seen at that
  address when the relationship records one it saw there before". The wait-for-pass parenthesis adds "or while the
  path's connection to the relay was interrupted".
- **OPERATIONS §12.9.**
  - Delete the start-hold sentence.
  - Say that a first start and a lost record's start read the graph's keys once, for at most 10 s.
  - "What waits for a pass" takes decision 2's and decision 5's new cases.
  - "Things to know" takes decision 10's stall exception and a line on decision 11.
- **Ledger row `2026-09-29-strfry-delete-hides-next-write`.** Its real-time bullet takes decision 10's exception and
  decision 11.
- **ADR 0002's binding 2 note** (0002:603-605): "by e, only the latest version the path has learned at that address
  (ADR 0003 A1-3)".
- **The handoff Status line** records the kick-back and this amendment.

**A1-20 — Test impact** (Phase 3's).

*The planner suite:* about 29 re-aims and 3 deletions.
- Mechanical re-aims:
  - RP2 and RP3 (exports; `LIMITS` keys);
  - RP8 (`newMaps`);
  - RP15, RP26, RP62–RP64, RP69, RP78 and RP79 (build the lineage with `learnVersion`, not H);
  - RP59 (absolute `v`/`o`);
  - RP60 (`x` leaves the lineage alone);
  - RP75 (parked entries).
- Semantic re-aims:
  - RP14, RP16, RP19, RP20, RP22 and RP72: an `e` target resolves only as its address's top. RP19's foreign count
    covers only targets that resolve;
  - RP23 and RP24: an empty read leaves the lineage alone;
  - RP25: `compact` without H;
  - RP30 and RP70: rule 2 names tops;
  - RP61: `c` keeps revokes;
  - RP67 and RP68: the gate's clauses;
  - RP71: the control flips, so a kept `e:v1` cannot remove a pass-written v2.
- Deletions: RP47, RP76 and RP77.
- New planner cases:
  - the lineage functions and the cap;
  - a read placed under a later learning teaches nothing;
  - `pruneLineage`'s pass exception.

*The engine suite:*
- RE7's re-aim: the first start's only graph contact before `started.json` is the census's one key read. A hung
  census gives up at 10 s, and the start proceeds.
- RE58's re-aim: its hand-written journal line takes the absolute `v` shape (`top`, `older`).
- Retitles: RE18, RE19, RE54 and RE79.

*New engine tests, one per scenario:*
1. The stale by-e family, where the newer version is kept:
   - a revoke drained during a round's scan, element read or write;
   - one merged into the catch-up's unfed backlog;
   - one arriving after the newer version was heard, with and without a pass writing it;
   - review round 2's revoke-paths-2 modes.
2. A reconnect gap with an empty read before the catch-up: removed within AC-4.
3. A read between a revoke's store and its delivery: removed within the minute.
4. A catch-up arrival revoked before its round: removed.
5. Put-back and re-look carry.
6. First-start revokes, buffered and across a reconnect: removed within 60 s.
7. Parked revoke-gated removals across compaction and restart.
8. A failing start catch-up beside a live change: reflected within 60 s.
9. Time-outs:
   - one never-answering address among 200 (the bound in A1-13);
   - three or more never-answering singles: other authors' changes keep the minute, and each is parked after three;
   - a Redis-style stall at ordinary traffic, after which addresses are re-read in their groups;
   - a marked live single is read before lane 4.
10. A padded share beside a live change: live keeps at least 12.8 MiB, the share costs at most two extra strfry
    processes, and the share advances.
11. A found revoke, then a restart, then a wipe: removed. The same with a compaction mid-catch-up.
12. The census:
    - it records a backfilled version;
    - it is placed under the scan at a held address;
    - a hung census.
13. A read that cannot be placed teaches nothing.
14. Journal faults:
    - prefix and torn-append replay never invert a lineage;
    - a `journal-unreadable` start demotes restored tops;
    - a failed truncation after a re-baseline replays none of the older generation (the epoch).
15. A flooded address: `older` and entry revokes stay at 8 or fewer.
16. `lastReflectedAt` is not moved by a held decision.
17. Replay exactness as a property.

Decision 11's probes stay documentation, not pass/fail tests. If decision 11 is declined, they invert into "kept"
tests.

*The fuzzer.* Register it as an opt-in, deterministic suite outside the default gate
(`test/tagging-edges-realtime-property.test.js`):
- a fixed seed list, about 8 modes × 20 seeds × 150 steps, in a few minutes;
- asserting the safety invariants, off within 5 s, no leak, bounds, and the healthy-mode minute checks with the
  corners;
- replaying the shrunk traces as fixtures.

Its corner classifier is updated to decisions 2, 5, 10 and 11 as amended. The Tester decides the details.

**A1-21 — How A1 was verified.** The scratch prototypes, probes and fuzz campaigns lived in the session scratchpad
and are not durable; the rules above are the record.

- **Three designs, measured.**
  - One persisted a learn record: 8,000 seed-runs, no violation.
  - One kept a lineage per address: 12,000 seed-runs, no violation.
  - The minimal one re-used the entries' sequence numbers. It was not viable: re-recording a completed version above a
    newer read removed the newer relationship, and `S` grew without bound.
  - The judge took the lineage, and grafted the learn record's placement rule, its census, its parked persistence and
    its element time-outs.
- **The judged design.**
  - 16,000 fresh seed-runs (7.7 M operations), with no violation of the safety invariants, off within 5 s, or no-leak.
  - Every confirmed finding of review rounds 1 and 2 is closed, except those this amendment turns into corners or
    decision 11, whose probes document them.
  - The story suites fail only the intended re-aims of A1-20.
- **The first red-team pass (15 findings, 2 blocking), fixed and prototyped.** The blocking two were an unbounded
  `older` and a replay that could invert a lineage. The fixes, and what they measured, on 8,000 more seed-runs (3.8 M
  operations, no safety violation):
  - `older` ≤ 8 per address (178,290 ids at one flooded address before);
  - an entry's by-e revokes ≤ 8 (3,000 before);
  - journal-prefix inversions 0 (91 before);
  - a torn append, an EIO part-way and a failed truncation keep the newer relationship (removed before);
  - a 450 MB journal starts in 12 MB of heap (out of memory before);
  - the first start's drain writes 1.6 MB (268 MB before);
  - the share keeps 2.69 MiB before the live read (10.07 MiB before);
  - the idle tick at 200,000 taggings takes 0.14 ms (8.88 ms before);
  - replay exactness holds across 77,877 checks, with 0 mismatches.
- **The second red-team pass (14 findings, 1 blocking), folded in above.** The blocking one was the share cap's
  bisection storm. Two of its fixes were validated in a scratch copy of the engine: no bisection under the share
  (A1-14), and live and re-look singles read after their own lanes (A1-13). The rest are specified here but not
  prototyped, and Test Design pins them first:
  - the stall-or-slow test and the regroup (A1-13);
  - one single time-out per round, with parking after three (A1-13);
  - the journal epoch, the demotion at `journal-unreadable`, and the compaction cadence (A1-6);
  - the pass rule judged from a report read taken with the catch-up's key read (A1-7).
- **What the last campaign still missed.** Two liveness misses, both pre-existing (identical on the code before A1)
  and both corners as reworded:
  - a crash inside the flush interval followed by a reconnect gap (decision 5's second corner);
  - a lost journal plus a silent departure at an address a restored lineage held (the widened lost-record corner).
- **Throughout:** no schema change, no strfry change, and no write outside `graph.js`'s port.

### A1 clarifications (Test Design, 2026-09-29)

The A1 suites pin these readings of A1 where its text left a choice. A scratch reference realisation of A1 and a
mutation pass raised them. Items 11, 12 and 13 are behaviour choices; the rest are readings. The owner ratified all nineteen at the
Test Design gate on 2026-09-29.

1. **Interfaces.**
   - `lineageAt(maps, address)` returns the live lineage or `null`; its `older` may be a Set or `null`.
   - `lineageValue(maps, address)` returns a copy, `{top, older: [ids in learn order]}`.
   - `learnVersion`'s options may be omitted (`under` false).
   - `pruneLineage(maps, {scannedIds: Set, graphKeys: Map<address, eventId>, keep: Set<address>, keepOlder: boolean,
     learnedAfter: Map<address, Set<id>>})` → `{droppedAddresses}`, a count or a list.
   - `learnedAfter` also guards a drop (A1-7's fourth condition), whether or not the engine adds those addresses to
     `keep` too.
2. **The cap's order.** A re-learned id leaves `older` before the previous top joins it. So re-learning never drops an
   id to make room for one that is leaving.
3. **A malformed stored `eventId`** (missing, not a string, or not 64 lower-case hex characters) satisfies neither gate
   clause. Decision 2's "not an id" governs A1-4's "not a string".
4. **The epoch.**
   - Any value, compared by equality. The reference used `max(now, last epoch + 1)`, so a new epoch is never one
     already in the file.
   - Each generation's first line is its `e` line. It may wait in the buffer until the next flush.
   - With a record epoch and no matching `e` line, no journal line applies.
   - Other generations' lines are not counted in `skippedLines`.
   - A record without an epoch (none at all, or one written before A1) applies every line.
5. **Journal lines.** An `o` line adds no prompt. A `v` line lacking `top` or `older`, and an `o` line with a malformed
   `top` or `older`, are skipped and counted.
6. **"Most recently merged"** (A1-5). Recency is the order in which the path received each `(by, target)` revoke. It is
   refreshed when one with a newer `created_at` arrives for the same pair. A put-back never makes a round's revokes more
   recent than a fresh item's.
7. **A catch-up's work order.** Arrivals come first, then look-only prompts, then found revokes.
8. **The census deadline** is an upper bound: an engine may give up sooner. "A late answer is ignored" cannot be seen
   through the fakes, because the start's own catch-up re-learns the same ids at once.
9. **Status.**
   - The status written at a stop says `subscription.connected: false` (A1-18's settlement, pinned).
   - `heard` counts addresses, not ids.
   - The first start's catch-up (A1-10) brings a relationship the backfill left behind the relay up to the relay's
     version within the minute.
10. **The share** (A1-14).
    - Each share scan's `maxBytes` is at most the share's remainder. Equal is the intended value; the suites pin "at
      most".
    - "Has read nothing yet" means no share scan has answered this round. A scan that answered with 0 bytes counts as
      read.
    - A share whose remainder reaches 0 ends, and its rest goes to lane 4. It is not deferred to the next round.
11. **Time-outs** (A1-13).
    - **The stall-or-slow test** counts only answers received before the group's own time-out.
    - **Regroups** are read after their lane's usual groups. "First re-reads" means before marking, not first in the
      round, since two regroups read first would trip the guard every round.
    - **A guard trip caused by first-time groups** marks nothing: it is a stall. Regroups that trip it are marked.
    - **An element group's time-out** always marks.
    - **"No further single after one single time-out in a round"** counts any one-address or one-id scan that times
      out.
    - **Marked singles** are read in ascending order of their own consecutive time-outs, so newly marked co-members
      go before a repeatedly slow single. Ties go by queue order.
    - **The bounds are per case,** as A1-13 and decision 9 now state.
    - **After a Redis stall,** taggings stored during it are reflected within 60 s plus a round of the relay answering
      in full (§ Failure handling).
    - **A known limit, for decision 9.** A1-13 cannot tell a Redis stall from a new never-answering address landing in
      every round's usual group. Then the guard trips every round: measured with a fresh never-answering address
      every 40 s, 21 of 300 other taggings were reflected in 15 minutes. It needs an address whose scans never answer,
      which no known strfry behaviour produces for one address.
12. **Time-out parks.**
    - They are not counted in `dbRefused`. Each single time-out counts in `failedReads.relay`, and the park shows in
      `parked`.
    - A catch-up does not lift a time-out park. Its arrivals, looks and found revokes at the address merge into the
      parked entry, and wait for the park's timer (5 min, 30 min, then every 6 h), a start, or a live delivery of a
      new version at the address.
    - A live delivery of a new version, while the round that parks the address holds it, lifts the park at once. The
      fresh item keeps the read-alone mark and the park's level.
    - A refused write's "retried at once after the next successful write" does not apply to time-out parks.
13. **Pass-overlap ties overlap.** `endedAt >= graphReadAt` and `graphReadAt <= deadSeenAt`; `startedAt < commitAt`
    stays strict. A same-millisecond tie costs one re-look; missing it could leave a relationship the pass wrote from
    an older read. *(Amends T25's "passOverlaps boundaries are strict"; RP53 is re-aimed.)*
14. **Flush, then compact.** A round's journal lines reach the journal before a round-end compaction snapshots.
15. **The pass rule for A1-7** is judged from the latest report read: the one taken with the catch-up's key read, and
    any later round-end or re-look read. A run that ends after the last read before the compaction is missed, which
    only withholds clause (ii).
16. **The corners, as the property suite's classifier reads them.**
    - Decision 5's first corner includes a notice cut off by a dropped connection, the relay going down, or a SIGTERM.
    - Its second corner combines with the first: a crash in the flush interval, followed by a reconnect gap.
    - A spell of failing journal appends is outside the suite's model; its widening (§ Failure handling) is pinned, if
      at all, by an engine test. *(Added at story 4's Architecture, 2026-09-30, from story 3's review, round 3,
      carry-forward C7.)*
    - The widened lost-record corner applies where the re-baseline's scan found nothing at the address.
    - Decision 2's upper-case case is judged when a first start's buffered deletion is drained.
17. **The property suite** is registered in the default gate for its fast part: the fixtures plus a few seeds per mode,
    about 8 s. The full fixed campaign runs with `TAGGING_EDGES_PROPERTY=1`. *(Refines A1-20's "outside the default
    gate".)*
18. **Decision 11's shape (a)** is indistinguishable, to the path, from clause (ii)'s quick undo. Its test documents the
    accepted behaviour, and could not be inverted on its own if decision 11 were ever declined.
19. **`record.json`'s streamed write** repeats `state.writeAtomic`'s steps (temporary file, fsync, rename, directory
    fsync) row by row. The start reads it as a stream and hashes it as it goes; the parsed record may be held whole. The
    whole path's measured ceiling stays the Implementer's Evidence item (decision 9).

**Clarifications 20–25** were raised by story 3's review, round 1. The owner ratified 20–23 on 2026-09-29. Items 24
and 25 correct statements of fact.

20. **Single time-outs and the park** (A1-13, decision 9).
    - A one-address or one-id scan that times out counts toward the three that park an address only when either
      holds:
      - the address is marked to be read alone; or
      - some relay read has answered since the address was queued, or since it last timed out alone.
    - Otherwise the relay was not answering. The address backs off 5→60 s like any failed read, and its run of
      time-outs stands.
    - So a lone change through a Redis stall is never parked. It is reflected within clarification 11's bound once the
      relay answers.
    - While no relay read answers at all, a never-answering address is never parked. It backs off 5→60 s, then
      retries once a minute, and each retry costs a 20 s time-out.
    - Decision 9's "each is parked after three" reads "after three while other relay reads answer".
21. **A live revoke lifts a time-out park.** A live kind-5 from the address's author that resolves at an address
    parked for time-outs lifts the park, as a new version does. The lift costs at most one more single read. *(Amends
    clarification 12's list.)*
22. **The counter for element singles.** A one-id element scan that times out counts in `failedReads.element`, as
    every element-read failure does. It still counts toward the park under clarification 20. *(Amends clarification
    12's "each single time-out counts in `failedReads.relay`" for element reads.)*
23. **The compaction cut with interleaved rounds** (A1-7 with A1-11).
    - Rounds run between a catch-up's reads, so a round may learn and write between the catch-up's key read and its
      stamp scan's capture.
    - A catch-up's compaction therefore keeps in `older` the ids learned at an address since its key read, not only
      since the capture. The scan's own placement is the exception.
    - This widens clause (ii) only by the versions the path learned in that window.
24. **strfry's id re-use after an operator delete** (decision 10; ledger row
    `2026-09-29-strfry-delete-hides-next-write`). Read in strfry 1.1.0's source, commit `f31a1b9`.
    - **Ids.** Each new event takes the largest stored id plus one (`golpe/external/rasgueadb/main.h.tt`,
      `modify.h.tt`).
    - **What never lowers the largest id.** strfry writes a new event before it deletes what that event replaces or
      revokes (`src/events.cpp`), and its expiry cron never deletes the newest event (`src/apps/relay/RelayCron.cpp`).
      So kind-5s, replaced versions and expiry never lower it.
    - **What does.** An operator's `strfry delete` or a wipe can. The next writes then re-use ids: at least one per
      newest event deleted, and more where earlier deletions left gaps below them.
    - **Who misses a re-used-id write.** strfry runs three monitor threads (`reqMonitor = 3`,
      `setup/strfry.conf.template`). Each lowers its cursor to the largest id present when it next wakes
      (`src/apps/relay/RelayReqMonitor.cpp`), so a thread that wakes after the delete and before the write still visits
      a write that re-uses an id (the debounce race below covers a thread that does not). But strfry keeps its skip
      marks per filter and index-key value, not per subscription alone (`src/ActiveMonitors.h`). A filter is indexed by its ids,
      else its authors, else its tags, else its kinds, with one mark for each value, and a write is checked only under
      the values it carries itself. A subscription skips a write whose id is at or below the last event sent to it,
      the relay's newest event when it subscribed, or the last event visited that carries the write's own index-key
      value, sent or not (a write carrying several such values is skipped this way only when each has been passed). So
      such a write is missed by the subscriptions that had passed its id, and delivered to the others. The path's
      filters are indexed by the stamps' `z` values and by kind 5 (`subscriptionFilters`): a stamped tagging is also
      hidden by the last event of any kind carrying its stamp, and a kind-5 only by the other two.
    - **The debounce race.** A thread lowers its cursor at every wake, whatever woke it, but only to the largest id
      present then. A database change wakes all three threads about 100 ms after the first change since the last
      change notice, and that first change may precede the delete
      (`golpe/external/hoytech-cpp/hoytech/file_change_monitor.h`); a busy thread wakes later. Three other messages
      each wake only the thread serving their connection (`src/ThreadPool.h`): a REQ, at its EOSE
      (`src/apps/relay/RelayReqWorker.cpp`), a CLOSE, and a closed connection. A write that re-uses a freed id and is
      stored after the delete but before its thread next wakes is seen with the delete: at that wake the largest id
      already includes the write, so the thread's visit starts above it, and every live subscription on that thread
      misses it. A wake helps only when it falls between the delete and the write, and only for the subscriptions on
      the thread it woke.
    - **After a wipe,** a subscription misses writes until the ids pass the point its own monitor had reached, at most
      the old largest id. A new REQ starts from the relay as it is, so re-subscribing ends it.
    - **For the path,** what it misses is reflected at the next safety diff (≤ 10 min), except a version both stored
      and revoked by id while missed (decision 5's first corner). OPERATIONS tells the operator to restart the path
      after a relay wipe or a bulk delete.
    - *(Rewritten at story 3's review, round 2. Round 1's version overstated it to every subscription and to exactly
      K writes. The "Who misses" and debounce bullets corrected at story 4's Architecture, 2026-09-30, from story 3's
      review, round 3, carry-forwards C1–C3: the marks are per index-key value, and a wake spares only the
      subscriptions on the thread it woke.)*
25. **A bad identity: no subscription.**
    - With a bad identity the path starts and waits in `waiting-setup` without subscribing, since its filter needs
      both identities.
    - What the relay stores meanwhile is found by the catch-up at the next start with a usable identity, or counts as
      pre-existing at a first start (decision 5).
    - A bad schema rule keeps the subscription.
    - *(Corrects § Failure handling's "The subscription and the queue stay", ADR 0001's A3 note, and this ADR's copy
      of that note.)*
26. **A catch-up at a refusal park.**
    - A catch-up's work at an address parked for a database refusal lifts the park when it carries a version id or a
      revoke the parked entry does not already hold. That is a new event at the address (§ Failure handling, "at once
      on a new event at that address").
    - "Does not already hold" is read by effect, as `mergePrompt` would merge it (`bringsNew`; story 3 § Deviations):
      a version id other than the entry's, or a revoke for a (by, target) the entry keeps none for, or keeps one for
      with an earlier `created_at`. A revoke for a (by, target) the entry keeps one for at least as late is held,
      whichever kind-5 it came from. So a second kind-5 with a `created_at` no later, found by a catch-up, waits for
      what else lifts the park (its timer, a start, the next successful write, a pass's re-look, or a live event
      there), though live it
      lifts the park at once (every live revoke that prompts at the address does).
    - Work that brings nothing new merges into the parked entry, which keeps its schedule.
    - A parked version never enters `S`, so every catch-up, the safety diff included, finds the refused version again.
      When the parked entry holds its id, that costs no write. When it does not (the park came from a revoke, a look,
      or another version's prompt), the first catch-up that finds it lifts the park, and the address is retried as any
      lifted park is. If the database refuses it with the park's own code, and T29's systemic case does not hold (two
      or more refused rows, one code, none landed), the address is parked again at once, one level higher (the 6 h
      level stays at 6 h) and not counted again, and its entry now holds the id, so later catch-ups merge. A row that
      lands in the same round lifts that park at once, as the next successful write lifts every refusal park (§ Failure
      handling); that retry is the write's, not the catch-up's. A refusal with another code is retried after 5 s and
      parks, counted, on the second. Where T29's systemic case holds, the addresses back off 5→60 s instead, until a
      round in which it no longer holds. So a catch-up that finds the refused version again costs one write attempt
      per park; T29's systemic case retries until it no longer holds.
    - A time-out park merges either way (clarification 12). A live revoke still lifts it (clarification 21).
    - *(A reading of the approved text, made at story 3's review, round 2. The effect reading and the one-attempt
      bound adopted at story 4's Architecture, 2026-09-30, from story 3's review, round 3, carry-forward C5.)*

## Out of scope

- Carrying revokes between instances, router gaps, and the UI revoke naming the address (story Out of scope).
- Any change to strfry, the follows pipeline, the pass's decisions, `report.json`'s shape, or the task system.
- A `tags_eventId` index (not needed: D5-A), a provenance marker, and any bookkeeping value on `TAGS` (AC-7; ADR 0002
  owner decision 11).
- Story 4's page, and any drift figure.
- Converging the other strfry readers onto `scanStrict`, and the shared config reader's value logging (row
  `2026-09-27-config-reader-logs-values`). The path reads no credential through that reader. It reaches it only
  through `getOwnerAssistantPubkey()` (via `resolveIdentities` and profile-tags' module load), which logs the TA
  pubkey, a public value.
