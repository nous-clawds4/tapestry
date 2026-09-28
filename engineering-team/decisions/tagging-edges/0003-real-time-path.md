# ADR 0003: The real-time path — hear every write, decide from strict reads, remove only on a revoke

**Status:** Accepted
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
  - H: heard but not yet completed tagging id → address;
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
  can name only their own known taggings, so a flood of kind-5s from anyone costs one set lookup per target.
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
  refusal's `address`. The address becomes a **version prompt** `{id}`, and the id enters H (journal `v`). Events
  with no address are dropped.
- **A kind 5 is resolved on receipt, in memory, and never queued as such.** From `revokeTargets(ev)`:
  - each lower-cased `e` target found in S ∪ H gives its address;
  - each `a` target that is a tagging address of at most 255 UTF-8 bytes (strfry acts on no longer value) gives its
    address, but only when the path knows it: S ∪ H records an id there (an address → ids index kept with the maps),
    or the address was among the graph's at the last `readKeys` (refreshed at every catch-up and safety diff, and
    extended by the path's own creates);
  - a target whose address's pubkey segment is not the kind-5's pubkey is dropped. strfry does not act on another
    author's deletion, so it is no revoke.

  Each remaining address gets a **revoke prompt** `{kind5Id, created_at, by: 'e' | 'a', target}`. That is the only
  part of the event kept, O(1) per address (journal `d`). A kind-5 none of whose targets resolved is counted once in
  `deletionsMatchedNothing` and forgotten.
- **Why S ∪ H is enough.** The relay acts only on a version it holds, and S ∪ H covers every stamped version on the
  relay: the baseline, everything heard since, and every catch-up arrival. So a revoke the relay acts on always
  resolves. A kind-5 naming a recorded version that has already left the relay is found, if its author made it, by
  the next catch-up's candidate scan (D3 step 3).
- **An author's bulk revoke** naming thousands of their own recorded taggings becomes that many address prompts. It
  is a burst of that many changes, bounded like any other (AC-1; owner decision 9). A target the path does not know
  costs one set lookup and queues nothing, so junk addresses under a fresh key cannot fill the queue.

**Lanes and rounds.** A round's addresses are taken in this order:

1. while catch-up work is pending, its share comes first: up to 100 addresses and up to one fifth of the round's kept
   budget (3.2 MiB), read before any live or re-look address;
2. live version prompts and live revoke prompts (the live lane);
3. re-looks;
4. further catch-up work.

So neither a live stream nor padded live events can starve a catch-up. Under a sustained live load a catch-up
proceeds at 100 or more addresses per round (owner decision 9).

A round starts 250 ms after the first prompt queued while idle, or as soon as the running round ends, whichever is
later. That 250 ms is a cap, not a reset: later prompts never postpone it.

**The safety diff.** Every 10 minutes the path runs the full D3 diff (arrivals, look-only prompts and deletion
candidates) and compacts when the queue is empty. This catches a subscription that stays connected but stops
delivering, revokes included, within about 10 minutes. That stall is a residual for the owner (owner decision 10); no
known strfry defect behaves this way.

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
| `journal.jsonl` | one line per fact (below) | flushed and fsynced by a 250 ms timer whenever lines are buffered, in every state including the waiting ones; also at round end, on switch-off and on SIGTERM. `b` lines are fsynced at once. |
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
     Each becomes a version prompt, back-dated history included. `created_at` is never used.
   - **Look-only prompts** come from comparing the scan with the graph keys:
     - (i) a scanned version at an address the graph records with a different event id;
     - (ii) a scanned version at an address the graph does not hold, whose id is in S but not in B;
     - except an `(id, address)` in `refusedSeen`.

     A look-only prompt lets its round create, update or move. It never enables a removal.
3. **Deletion candidates.**
   - Graph-recorded event ids that the scan no longer finds.
   - Ids in S ∪ H that the scan no longer finds, at an address the graph holds with another event id. This covers a
     heard version revoked while its prompt was dropped or its round had not run.

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
   catch-up, and only that author's own kind-5 volume can cause it.
4. **Restore.** Pending entries, H, parked addresses, re-looks and `deadSeenAt` come back from `record.json` plus the
   journal.
5. **Process** the queue in rounds (below). Arrivals are processed in chunks of 5,000 addresses. The catch-up is done
   once every address it queued has had one attempt, whether decided, parked or failed. A failed address stays pending
   with its backoff, but does not hold the catch-up open. The status records the outcome, duration and counts.
6. **Compact.**
   - S becomes (S ∩ scanned) ∪ completed.
   - H drops ids completed, or neither scanned nor candidates.
   - B becomes B ∩ scanned, and `refusedSeen` becomes `refusedSeen` ∩ scanned.

**A catch-up read fails** (the stamp scan or `readKeys`): that catch-up is aborted without compaction. The status gets
`catchUp.last {outcome: 'failed', stage, startedAt, endedAt}`, the failure is counted in `failedReads.catchUp`, and
the catch-up is retried with 5→60 s backoff. It therefore completes within AC-4's bound once the read succeeds.

**The stamp scan** has no byte cap, because memory is bounded by the id count, not bytes. It has its own time-out of
10 minutes. Owner decision 9 names the ceiling this puts on AC-4.

**First start.** None of `started.json`, `record.json` or `status.json`'s `firstStartedAt` exists. Then:

1. Once the identities resolve and the relay answers, subscribe and wait for EOSE. No graph contact and no schema check
   happen first, so a Neo4j outage cannot delay the baseline.
2. Take the stamp scan. Buffer every id delivered on the subscription since the REQ, from before or after the scan.
3. S = the scanned `(id, address)` pairs, and B = the scanned ids minus every buffered id. A live delivery has a levId
   after the REQ's snapshot, so it was stored after the first start began.
4. Write `record.json`, then `started.json`, then the status. Then process the buffer.

It takes no action on the baseline versions and runs no candidate scan. If the subscription reconnects before
`record.json` is written, the first start restarts from step 1: that reconnect's gap was delivered to no subscription.

**Lost record.** A first-start marker exists, but one of these holds:

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
  flight starts a fresh pending entry;
- compaction intersects them with a complete scan.

So a re-sent older version after an id-only revoke (AC-2, AC-4) is an arrival at the next catch-up, and is created.

### What it decides and writes (D4-A, binding 1)

**Bounds.** Every scan in a round is streamed through `onEvent`, and keeps only events that answer the round:

- from an address scan, events whose identity `d` gives a requested address;
- from the element read, events whose lower-cased id was requested.

Every round scan has `maxBytes` 8 MiB. That is well above `maxEventSize`, so any single legitimate address fits, and a
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
  - it names by `e` a version the relay held at that address (an id S or H recorded there when the kind-5 arrived,
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
  - That scan's addresses are deferred and bisected, so the others proceed.
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
  - Switch-off and SIGTERM flush the journal first, so an off or a deploy never opens that window.
- **A bad setup** writes nothing. The subscription and the queue stay, and the status names the problem:
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
4. flushes the journal and writes the status;
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
- `pending`, `parked`, `seen` (the size of S), `heard` (the size of H), `journal {bytes, skippedLines}`;
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
- **A3, "refuse to start".** Note: "The real-time path, a long-running process, starts, subscribes and waits in
  `waiting-setup`, writing nothing, which meets this rule's purpose."
- **A8 / step 5, "any error counts as absent"** (:376, :480-481). Note: "This covers the element's content. A failed
  element read is not an absent element: the real-time path defers, and the pass fails the run."

**ADR 0002**

- **Owner decision 2.** Note beside it, with the same text as A7's note.
- **Binding 2, refined.**
  - A kind-5 prompts a look only from its own author, and only at addresses it names that the path knows: by `e`,
    through the path's seen and heard maps; by `a`, a tagging address of at most 255 bytes where the path's maps or the
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

## How each acceptance criterion is met

| AC | Met by |
|---|---|
| **AC-1** | D1's live subscription hears every writer, back-dated events included, within about 1–2 s. Rounds read graph-first, then relay-strict, de-duplicate, and `decideAddress` follows the relay's current version: create (people by bare keyed `MERGE`), update or move. Id-only resolution goes through the element read and the same-version rule. Lanes put live work first, with a reserved share for catch-up. Burst: about 145 s per 10,000, pessimistic. Except owner decisions 5, 9 and 10. |
| **AC-2** | A kind-5 is resolved in memory to its author's addresses (S ∪ H by `e`; `a` directly). The revoke prompt (by id, or by address with `revokeApplies`) lets the removal through when the relay read finds nothing. Another accepted version is followed, and another author's or a non-revoke kind-5 changes nothing. No count limit. Except owner decisions 2, 3, 9 and 10. |
| **AC-3** | Failure handling, per class. The gate: a `not-on-relay` removal needs a revoke; version and look-only prompts cannot remove on an empty read. Bounded scans, kept bytes and backlog. Bad setup is `waiting-setup`, with no writes and no DDL, resuming within 15 s of a rule. Except owner decision 5's crash corners. |
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
  - The widened redactor may cut benign `word:NN` text from error messages (diagnostic loss only).
  - A new ledger row for the pass's shared 256 MiB scan cap: a publisher can make the pass's full read fail `too-large`
    with about 2,000 websocket-size (≤ 131,072-byte) stamped taggings; organic growth reaches it at roughly 300k.
- **Firmware reinstall required?** No. No concept definition or firmware JSON changes, and no schema change.

## Owner decisions needed at this gate

Accepting items 2, 3, 5, 9 and 10 qualifies story 3's criteria (the Planning amendment above). Declining any kicks that
part back to Planning.

1. **AC-7's residuals.**
   - (i) A scoring statement fails only in a deadlock forming within the first ~100 rows of one of its 10k-row inner
     transactions and crossing a real-time transaction: about 4×10⁻⁶ per path transaction overlapping a scoring run.
   - (ii) The follows consumer drops an event when a small list write crosses the same two people as a path write
     within the same milliseconds (row `2026-09-27-stream-consumer-at-most-once`).
2. **What counts as a revoke of the recorded version.** A `not-on-relay` removal needs the author's deletion naming a
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
5. **Corners that wait for the pass.**
   - A version stored and revoked by id before the relay announced it (story item 7, unchanged).
   - A version heard in the last ≤ 250 ms before a crash, and revoked by id before the restart.
   - A version held at the first start that left the relay and came back with the same id, with no read of its
     address by the path in between, at an address the graph does not hold.
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
9. **Scale ceilings.**
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
10. **Residuals beyond the minute.**
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
    - A version and its id-only revoke heard in one round (the revoke resolves through H and removes).
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
    - A version heard after a round's scan spawned, then revoked by id: it stays in H and the revoke removes.
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

**T3 — The maps.** `newMaps()` → `{ S: Map, H: Map, B: Set, R: Map }`:
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

**T6 — `resolveDeletion(ev, maps, graphAddresses)`** → `{ prompts: [{ address, prompt }], matchedNothing, foreign }`.
- `graphAddresses` is a `Set`. `prompt` is `{ type: 'revoke', kind5Id, created_at, by: 'e' | 'a', target }`.
- An `e` target resolves through `maps.S` then `maps.H`.
- An `a` target resolves only when it is a tagging address of ≤ 255 UTF-8 bytes and is known: an `S` or `H` entry has
  that address, or `graphAddresses` has it.
- A resolved target whose address's pubkey segment is not `ev.pubkey` (lower-cased) adds 1 to `foreign` and no prompt.
- Prompts are de-duplicated by `(address, by, target)`.
- `matchedNothing` is `prompts.length === 0 && foreign === 0`.
- A non-deletion (not `isEvent`-shaped, or not kind 5) gives `{ prompts: [], matchedNothing: true, foreign: 0 }`.

**T7 — `shrinkOnRead(maps, address, returnedId, captureSeq)`** → `{ dropped: [ids] }`. It deletes from `S`, `H`
and `R` every entry with `.a === address`, `.seq <= captureSeq` and `id !== returnedId`, and deletes those ids from
`B`. `returnedId` is `null` for an empty read.

**T8 — `compact(maps, scannedIds, candidateIds, captureSeq)`.** Entries with `seq > captureSeq` are kept (recorded
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

**T10 — `deletionCandidates(graphKeys, scannedIds, maps)`** → `[{ address, id }]`, de-duplicated, tagging addresses
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

**T15 — Prompts and entries.**
- A prompt is `{ type: 'version', id }`, `{ type: 'revoke', … }` (T6) or `{ type: 'look' }`.
- An entry is `{ version: { id } | null, revokes: [revoke prompts], look: boolean }`.
- `mergePrompt(entry | null, prompt)` → a new entry:
  - `version` becomes the latest version prompt;
  - `revokes` are de-duplicated by `(by, target)`, keeping the greatest `created_at`;
  - `look` ORs.
- `discardSupersededRevokes(entry, knownVersionId)` → an entry without the `by: 'e'` revokes whose target differs from
  `knownVersionId`. `by: 'a'` revokes are kept.

**T16 — `gateAction(decision, { address, storedRow, relayVersionId, entry, baseline })`.** `decision` is
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

**T19 — The journal.** Each line is compact JSON with a `t` field:

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

**T20 — The engine seam.** `src/pipeline/tagging-edges/realtime/index.js` exports `{ createEngine, run,
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

**T25 — Planner details.**
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
- **`passOverlaps` boundaries are strict:** `startedAt < commitAt`, and `endedAt > graphReadAt`.
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

**T29 — Engine details.**
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

**T33 — What the blind reference implementation found.** An implementation written from this ADR alone, without the
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
