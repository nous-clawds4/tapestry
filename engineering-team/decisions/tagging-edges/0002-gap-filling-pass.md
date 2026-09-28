# ADR 0002: The gap-filling pass — follow the relay, guard removals, report every run

**Status:** Accepted
**Date:** 2026-09-27
**Story:** `engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.md`
**Amends:** `tagging-edges/0001` (see "Amendments to ADR 0001")

## Context

Story `tagging-edges` #2 asks for the first writer of the `TAGS` relationship: a pass that brings the graph into
agreement with this instance's own relay, one tagging at a time. Its first run is the backfill; every later run
repairs drift. The acceptance criteria, restated (the story holds the exact wording):

- **AC-1** — one relationship per tagging address, from the tagger's NostrUser to the tagged person's, with the values
  the definition gives for the relay's current version. A missing person is added once, keyed by pubkey and
  carrying nothing else. Late arrivals of any `created_at` are picked up by the next pass. An id-only tagging stays
  unresolved until a usable tag element arrives, then resolves. A tag element resolves under its identity `d`
  (R2-NB2).
- **AC-2** — the relationship follows the relay's current version, newer *or older* (an id-only revoke followed by a
  re-send), moving to a new person when the target changes, even when the stored `createdAt` is missing or
  malformed (R2-NB1). A pass never overwrites a relationship another writer changed or created between its read and
  its write. When relay and graph agree, a pass changes and reports nothing.
- **AC-3** — a relationship is removed when the relay holds nothing at its address or holds a version there the
  definition refuses (R2-NB3), and only while it still holds the version the pass decided from. The relay wins over
  a deletion it did not act on. A `TAGS` relationship whose `address` is missing or not a tagging address is left in
  place and counted. People and other relationships are never removed.
- **AC-4** — a failed or incomplete read (taggings, tag elements, deletions if read, the graph) changes nothing and
  the run ends failed, naming the read. A missing, empty, non-64-hex or upper-case stamp identity refuses the run and
  names the identity.
- **AC-5** — more than 10% of the relationships at start *and* more than 50 removals are held; everything else
  applies; the outcome says removals were held, by reason. Each pass judges only its own removals. Held removals go
  through only on a run the owner confirms; a confirmation from any other session, a task argument or a schedule
  entry is refused; it covers one run; a confirmed run removes only what the confirmed report held and its own read
  still finds due, and judges everything else as an unconfirmed run would.
- **AC-6** — the database refuses a second relationship at one address, from deploy and without an owner step; a
  pass that finds the rule missing creates it or refuses. Both expected-rule checks know the rule and agree; the
  Dashboard offers the fix.
- **AC-7** — every run leaves a report the owner can read on the instance, surviving a restart, with the listed
  fields. The pass runs only through the task system (on demand, or a schedule; a disabled daily seed on fresh
  installs). Two passes never run at once. A stopped pass leaves each relationship at one version, reads as failed
  and stopped, and the next pass finishes the job.
- **AC-8** — nothing else moves; a written relationship carries only the definition's values plus any bookkeeping
  value this ADR names.

**Concepts (Concept Graph, local, 2026-09-27).** `GET /api/concept-graph/node/39998:<TA>:nostr-user-tag`,
`…:tag` and `…:nostr-user` all resolve on the local stack (TA `8387ec0e…`, resolved at runtime through
`/api/assistant/pubkey`). The pass reads elements of the first two concepts by their `z` stamps and writes edges
between NostrUser nodes; it defines no concept and changes none. The canonical stamps are
`39998:82b75e47…:nostr-user-tag` and `39998:82b75e47…:tag` (the ADR 0015 literal, which this ADR does not copy).

**What the code offers, and where it would hurt a pass (all read at `feat/tagging-edges-2`).**

- *The contract.* `src/lib/tagging-edges/contract.js` exports `TAGS_RELATIONSHIP`, `REFUSAL`, `taggingToEdge`,
  `standingEdge`, `revokeApplies` and `revokeTargets` (:279-286). `identityD` (:63-69) and `stamp` (:72-74) are
  private. `resolveTagElement` still reads the element's *first* `d` (:99-101), which is R2-NB2. `standsOver`
  compares `createdAt` with `>` / `<` and falls to the id on anything it cannot order (:191-195), which is R2-NB1.
  `standingEdge` keeps a stored version over an older incoming one, reason `older-ignored` (:232-236; tests
  `test/tagging-edge-contract.test.js:360-374`, :598-605), and keeps a resolution once made (:218-230; test :394-407).
  The folder's purity and no-64-hex guards (`test/tagging-edge-contract.test.js:721-736`, :737-743) bind any sibling
  file; the surface test checks only that four functions exist (:115-121), and `REFUSAL` must stay exactly ten
  values (:123-131).
- *The shared Neo4j helper.* `getDriver()` reads credentials through `getConfigFromFile` (`src/lib/neo4j-driver.js:29-41`),
  which prints every value it finds, the password included (`src/utils/config.js:22`, :30). `writeCypher` takes no
  timeout (`src/lib/neo4j-driver.js:76`); neither helper retries. `toJS` leaves Integers inside maps and
  relationship properties unconverted (:120-127). A plain JS number parameter is stored as FLOAT; `neo4j.int()` or a
  BigInt pins INTEGER (precedent `src/api/open-ranking/inbound.js:46-48`).
- *The relay readers.* `scanLocalStrict` rejects a failed spawn, a non-zero exit or a time-out
  (`src/api/setup/status.js:57-95`), but decodes each pipe chunk on its own (`out += chunk`, :80), drops lines it
  cannot parse (:91; pinned by X1, `test/setup-status.test.js:552-566`), discards strfry's stderr reason, and
  defaults to 5 s (:36). `strfryScanStream` decodes correctly (`setEncoding('utf8')`,
  `src/api/concept/bDisposition.js:76`) but has no time-out and also skips bad lines. A websocket `REQ` is capped at
  500 results per filter (container `/etc/strfry.conf:111`); only `strfry scan` is uncapped, and one scan reads one
  LMDB snapshot (container `strfry/src/apps/dbutils/cmd_scan.cpp:29-45`).
- *The task system.* `launchChildTask.sh` runs `bash "$child_script"` (:344, :349), sends its output to a `/tmp`
  file it deletes (:493), and on time-out sends `kill -9` to that bash process only (:407). Its double-run guard
  matches `script_relative_path` in process command lines (:32-67). Only `buildChildArgs` reaches argv
  (`src/manage/taskQueue/queue/processor.js:21-39`); a schedule entry forwards only `warmStart` and `limit`
  (`src/manage/taskQueue/queue/entryResolver.js:107-116`). A non-customer job's id is the task name
  (`src/manage/taskQueue/queue/index.js:64-69`), so a second on-demand request joins a waiting or active job
  (:190-200). The `neo4j-heavy` wrap engages only inside the BullMQ Worker (:118-131; BIBLE.md:1659); its lease lasts
  4 h and is never renewed (`src/manage/taskQueue/queue/resourceSemaphore.js:30-32`). A task's time-out block
  carries a `forceKill` flag (`src/utils/taskTimeout.js:47`, passed on by `src/api/manage/commands/runTask.js:164`),
  but `launchChildTask.sh:403` reads it with jq's `// true`, which treats `false` as absent, so a time-out always
  sends `kill -9` (a false flag reads as true). supervisord's `[program:brainstorm]` sets no `stopasgroup` /
  `killasgroup` (`docker/supervisord.conf:55-65`) and the control panel's SIGTERM handler exits only itself
  (`bin/control-panel.js:392`), so a backend-only restart orphans a running task rather than stopping it.
- *Who can reach what.* `/api/run-task` and schedule create / update / delete are open to any signed-in session (no
  entry for them in `src/middleware/auth.js:388-424`). A direct loopback request is `localTrusted` and skips every
  middleware check (:361-364), and tasks do call the control panel that way (`src/algos/refreshPinnedTagTLs.sh:25`).
  `isOwner()` admits admins (:276-293). `requireOwnerOnly` requires a session whose pubkey is the owner's, and
  answers 401 without one (`src/api/admin/index.js:97-106`); a session pubkey is only ever set together with
  `authenticated = true` (`src/middleware/auth.js:53-54`). The one route that refuses cross-site requests does so
  with its own Origin check (`sameHost`, `src/api/dlist-curation/update.js:107-115`, ADR `curated-dlist-update/0006`).
- *Schema checks.* The server list is `src/api/status/queries/expectedNeo4jSchema.js:10-18`; the Dashboard list is
  `ui/src/pages/Dashboard.jsx:223-232`, compared by name (:262-266), with a fix button that runs the setup script
  (:279-297). The setup script runs under `set -e` (`setup/neo4jConstraintsAndIndexes.sh:2`) with one unguarded
  `cypher-shell` over the statement block (:43-78, :92). Nothing runs a Neo4j statement at control-panel boot
  (`bin/control-panel.js:304-339`), and supervisord starts the backend before Neo4j accepts Bolt connections.
- *Durable state.* `/var/lib/brainstorm` is the named `tapestry-data` volume (`docker-compose.yml:30-34`) and
  survives restarts and container re-creation. Redis `/data` has no named volume. `events.jsonl` rotates and keeps
  phantom `TASK_START`s after a kill, and the Scheduled Tasks panel reads a `rec.failure` field nothing writes
  (`src/api/scheduled-tasks/index.js:195`).
- *Identities.* `NOSTR_USER_TAG_Z_TAG` is exported from `src/api/profile-tags/index.js:60` (export at :1865);
  `LEGACY_Z_TAG_PUBKEY` (:49) is not. The lazy-require precedent is `canonicalZ()`
  (`src/api/assistant/identificationTaggings.js:71-73`). `getOwnerAssistantPubkey()` returns env `TA_PUBKEY`
  unvalidated and caches it (`src/utils/assistantKeys.js:53-56`); a malformed `BRAINSTORM_RELAY_PUBKEY` conf value is
  skipped (:59-63) and the helper falls through to the SecureKeyStorage file's `pubkey`, also returned unvalidated
  (:65-79), and only then to `null`. That file exists on every instance (created at first start), and
  `/etc/brainstorm.conf` exports the conf value (`setup/create_nostr_identity.sh:36-37`).

**The tension with ADR 0001.** Its binding makes every write "re-check AC-3's order inside the same statement"
(ADR 0001:191-194), and its retirement note assumes a relay-fed writer never sees an older version after a newer one
(:234-237). AC-2's revoke-then-re-send case breaks that assumption: after an id-only revoke, strfry accepts an older
version at the address, and `standingEdge(stored, thatVersion)` answers `older-ignored`. A writer that orders
versions cannot reach AC-2.

**Constraints.** JS without a build step, CommonJS, no new dependencies, no new lint tooling. CLAUDE.md principles
1–3: the relationship is a raw assertion, accepted from any signed author and filtered per POV at read time.
Principle 4 / BIBLE §30: a failed or empty read is never "everything was revoked", deletes are scoped to one `TAGS`
relationship, and state a rebuild cannot reproduce is precious. The TA pubkey is never hard-coded (ADR 0015).
BIBLE §24: every task entry point goes through the task system.

## Options considered

Each decision below names its options; the chosen one is marked.

### D1 — What kind of process the pass is

- **A. A Node runner behind a bash registry wrapper that `exec`s node (chosen).** The contract, the pure planner and
  the per-row outcomes live in one process. Because of `exec`, the time-out's `kill -9` lands on the process that
  writes, and a lock file descriptor opened by the wrapper lives exactly as long as the pass. The kickoff recommended
  this shape (`docs/TAGGING_EDGES_HANDOFF.md` §3). *Cons:* needs a wrapper.
- **B. bash + jq + APOC, like `reconcile*.sh`.** Precedent, but the contract would still need a Node step, APOC
  failures are discarded, `apoc.lock.*` / `apoc.refactor.*` are not allowlisted (container
  `/etc/neo4j/neo4j.conf:353`), and set-difference semantics are wrong for taggings (handoff §3).
- **C. Inside the control panel (a timer, or a task that curls a loopback route).** No spawn, but a time-out kills
  only the curl while the pass keeps running, a backend restart kills the pass mid-run, and a loopback route is a
  start path outside the task system (AC-7, BIBLE §24).

### D2 — Reading the relay

- *Reader.* **(a)** `scanLocalStrict` with a larger budget: rejected — per-chunk decoding turns a multi-byte
  character split across chunks into U+FFFD while the line still parses (a reader reproduced 18 altered lines in
  2,000; 1,082 of 3,375 production tag elements are non-ASCII), and silent line drops are pinned by X1. **(b)** A
  strict mode inside it: rejected — it grows another book's module (pinned by `test/assistant-attention.test.js`
  S3). **(c) A new small streaming reader, `src/lib/strfryScanStrict.js` (chosen)** — it can be tested with a fake
  strfry on the PATH, and ledger row `2026-09-21-failed-strfry-scan-reads-empty` can converge onto it later.
- *Shape.* **(i) One scan over four `#z` stamps (chosen):** `{kinds:[39999], '#z':[canonical:nostr-user-tag,
  local:nostr-user-tag, canonical:tag, local:tag]}`, built only from the two validated identities. One LMDB snapshot
  holds the taggings and the elements they name; about 10.4k events / 8.2 MB on production, parsed in about 40 ms.
  `resolveTagElement` accepts only elements carrying a `:tag` stamp (`contract.js:102-104`), so the stamp read covers
  every element that can resolve. **(ii)** Tag elements by `ids`: rejected — `spawn` throws E2BIG above about 1,955
  ids (production needs about 1,505 today), one non-hex id fails the whole scan, and it is a second snapshot.
  **(iii)** Two `#z` scans: two snapshots for no gain.
- *Kind 5.* **Read deletions: rejected. Read none (chosen).** Under AC-3 the relay wins: a deletion the relay
  honoured has already removed the tagging, so the pass removes the edge as "not on relay"; a deletion the relay did
  not honour must remove nothing. A kind-5 read could only add removals the relay itself refused, and it would add an
  AC-4 failure surface (13.5 MB and argv-limit traps on production). This amends ADR 0001:269-272.

### D3 — How the pass decides what an address should hold

- **A. Order versions with `standingEdge` (ADR 0001's binding as written).** Cannot reach AC-2's revoke-then-re-send
  outcome: the relay's older current version is `older-ignored`.
- **B. Order, but special-case the re-send as remove-then-create.** The pass still has to know the relay wins; the
  update becomes a removal that counts toward AC-5.
- **C. Follow the relay's current version (chosen).** strfry keeps exactly one current version per address, chosen by
  NIP-01, and applies every deletion it honours. The pass reads only that version, so it never orders versions: it
  asks "does the graph hold what the definition gives for the relay's current version here?", not "is the relay's
  version newer?". The race safety that the order check was meant to buy comes instead from the read order and the
  guard (D4).

### D4 — The write guard

- **A. Compare-and-set on `eventId` (+ `tagAddress`) in Cypher, lock-first by `SET r.eventId = r.eventId`.** Close to
  ADR 0001's wording and small. *Cons:* it misses any other change to the same version (a flag, a repair of the ends,
  a hand edit), which AC-2's "never overwrites a relationship another writer changed" covers; `r.eventId = $seen` is
  never true for a missing `eventId`; and `SET r.eventId = r.eventId` on a missing value becomes a property removal.
- **B. A full fingerprint computed in Cypher (`reduce` over `valueType` / `toStringOrNull`) inside one statement,
  matched by `elementId`.** One statement per batch. *Cons:* the fingerprint expression must be pinned against its JS
  twin; `toString` rejects lists (a type error; it accepts temporal and point values), so lists need their own Cypher
  branch; and the expression
  is hard to read.
- **C. Lock, re-read, verify in JS, then act — inside one write transaction (chosen).** The transaction first takes
  each relationship's write lock with `SET r.address = r.address`, re-reads it with the same projection the snapshot
  used, compares the two fingerprints in JS, and acts only on the rows that match. The kernel takes the exclusive
  relationship lock before reading the old value, and checks uniqueness and writes only when the value is absent or
  changed (`Operations.relationshipSetProperty`, Neo4j 5.26.10 kernel, offsets 2, 72 and 191; javap evidence kept in
  the Architecture scratch notes), so the statement locks without writing. The address is always a non-null string
  on an edge the pass acts on. Both fingerprints come from one JS function over one projection, so no Cypher/JS
  parity is needed for the guard; non-scalar values travel raw and are serialised in JS. A create needs no lock: it
  proceeds only while no `TAGS` relationship holds the address, and the uniqueness rule makes that atomic.

### D5 — R2-NB1 (a stored `createdAt` that cannot be ordered)

- **A. Guard the contract:** an `orderable` check in `standsOver` so a well-formed version beats a malformed one in
  both orders. Protects any future caller that orders stored edges. *Cons:* changes pinned behaviour for a caller
  that does not exist; story 2 would not use it.
- **B. Bind the pass (chosen).** Under D3 the pass never orders a stored `createdAt` to decide a write. A stored edge
  whose `createdAt` is not `INTEGER NOT NULL` and ≥ 0 — missing, `null`, `'1000'`, `'abc'`, NaN, FLOAT, boolean, a
  list — is simply a value that differs from the definition, so it is repaired to the relay's integer. Ordering is
  used only for the report's newer/older label, and only on a well-formed stored edge. Any future writer that orders
  stored edges must add guard A first (recorded as binding).

### D6 — Adding people

- **A. A separate people phase of bare `MERGE`s before the edges** (the reconcile nodes-first precedent,
  `apocCypherCommand1_followsToAddToNeo4j`). *Cons:* a person can land without the relationship that needed it (a
  stop or a lost race), and "people added" then counts people behind no relationship.
- **B. A bare keyed `MERGE (x:NostrUser {pubkey: …})` inside the create and move statements (chosen).** A person is
  added only by a committed transaction that also commits their relationship; a lost race rolls the person back too.
  The only clause that touches a node is that `MERGE`: no `ON CREATE`, no `ON MATCH`, no node `SET`. With the
  `nostrUser_pubkey` constraint it is a locking unique-index seek and never changes an existing node (reader EXPLAIN).
- **C. Link only to existing people.** Settled against by the owner (story Open question 1).

### D7 — Moves under the uniqueness rule

- **A. `DELETE` the old relationship, then `MERGE` the ends and `CREATE` the new one, in one statement inside the
  locked, verified transaction (chosen).** Relationship uniqueness is checked when the property is set, against
  transaction state, so delete-then-create passes and a stop leaves exactly one version:
  `Operations.relationshipSetProperty` (offset 116) calls `checkRelationshipUniquenessConstraints` →
  `validateNoExistingRelWithExactValues`, which seeks through `KernelRead.relationshipIndexSeekWithFreshIndexReader`
  with a cursor initialised with the transaction's state (`DefaultRelationshipValueIndexCursor.initState(Read,
  TxStateHolder, …)`), so the transaction's own delete is excluded (Neo4j 5.26.10 kernel, javap). The plan's EXPLAIN
  shows the order only: Delete, Eager, then Merge, Create and the property set.
- **B. Create, then delete:** fails at once on the uniqueness rule. **C. Two transactions:** a stop between them
  leaves no relationship. **D. `apoc.refactor.to`:** not allowlisted.

### D8 — The owner's confirmation

- **A. A task argument or query flag (`confirm=1`).** Rejected: any signed-in session can start a task and set it,
  and `limit` shows how raw arguments reach argv (`processor.js:32-34`).
- **B. A schedule-entry argument.** Rejected: schedule CRUD is open to any signed-in session, and a confirmation must
  never ride a schedule.
- **C. BullMQ job data from an owner route.** Rejected: BullBoard (owner *or admin*) can add jobs and patch job data,
  and a stalled job re-runs with its original data after a deploy.
- **D. A single-use record written only by an owner-only route and claimed by the pass (chosen).** The route is
  gated by `requireOwnerOnly` plus a handler re-check, refuses cross-site requests, and binds the record to the held
  report's run id and the digest of its held list; the pass claims it by an atomic rename. Stored as a file beside
  the report (Redis has no named volume).

### D9 — The run report, and a stop that cannot write

- *Store.* `events.jsonl`, the deleted `/tmp` task log and Redis are rejected (above). **A JSON file on the
  `tapestry-data` volume, written atomically, is chosen.**
- *A killed run.* **(a)** Write the result only at the end: a kill leaves the previous run's report. **(b)** A
  heartbeat and an age threshold: shows a dead run as running for the threshold and can misread a busy event loop.
  **(c) Pessimistic-first plus process liveness (chosen):** the first thing a pass writes is a record that already
  reads "failed — stopped before it finished", carrying its pid and process start time; the final write replaces it.
  A reader shows the run as running only while that exact process is alive (`/proc/<pid>/stat` start time matches,
  and it is not a zombie), so after a `kill -9` or a container restart or re-creation the stored report already
  reads failed and stopped.

### D10 — The shared `neo4j-heavy` lock

- **A. Take it (chosen).** Scoring tasks rewrite properties on every NostrUser in 10,000-row transactions
  (`src/algos/calculateHops.sh:13`, :15) and, with no `ON ERROR` clause, a deadlock that picks the scoring side as
  its victim fails that whole statement. The pass's creates and moves lock end nodes, so running beside scoring can
  fail another pipeline's run. The reconcile tasks, which also write social edges and create NostrUsers, take the
  same class (`taskRegistry.json:334`). *Cons:* the pass waits behind scoring (fine for a daily backstop); scoring
  waits for the pass (seconds to about a minute); a deploy that kills any heavy job leaves a lease that blocks heavy
  tasks for up to 4 h (pre-existing; runbook OPERATIONS.md:580); `deploy-safety` reads unsafe while the job is active.
- **B. No class.** No waits, and the compare-and-set carries correctness. *Cons:* the deadlock risk to scoring runs
  above, measurable only after the fact.
- **C. A new class with cap 1.** The kernel lock (D11) already gives mutual exclusion; a new class adds nothing.

### D11 — Never two passes at once

- **A. Queue concurrency and job-id dedup only.** Misses the legacy path, `concurrencyByTask`, a time-out orphan, a
  `supervisorctl restart brainstorm` orphan plus BullMQ's stalled re-run, and a hand `docker exec`.
- **B. A Redis lock with a TTL.** A paused holder keeps writing after its lease expires unless every write carries a
  fencing token; a crashed holder blocks until the TTL runs out.
- **C. A kernel `flock` taken by the wrapper and held across `exec` (chosen)**, on top of the queue and the pgrep
  guard. The kernel releases it exactly when the pass dies, SIGKILL included (precedent
  `src/algos/personalizedGrapeRank/ensureRawDataCsv.sh:124-129`). A start that finds it held is refused.

### D12 — The one-per-tagging rule from deploy (AC-6)

- **A. A non-blocking control-panel boot hook that creates the rule, retrying until Neo4j answers and accepts the
  configured password (chosen)**, backed by the pass's own pre-flight, the setup script and both expected-rule
  lists. It runs on every deploy (the container is re-created) and every backend restart, needs no image rebuild,
  and can be tested with an injected runner.
- **B. The entrypoint's Neo4j loop** (`docker/entrypoint.sh:297-327`): needs an image rebuild, throws errors away,
  and its window may be shorter than a 3M-node Neo4j start.
- **C. The pass only, or the Dashboard fix only:** AC-6 asks for the rule before any pass and without an owner step.

## Decision

We chose **D1-A, D2-(c)(i) with no kind-5 read, D3-C, D4-C, D5-B, D6-B, D7-A, D8-D, D9-(c), D10-A, D11-C and D12-A**.
Together: a registered `neo4j-heavy` task, `reconcileTaggingEdges`, whose bash wrapper takes a kernel lock and
`exec`s one Node runner. The runner records a pessimistic report, checks both stamp identities, its config and the
database rules, then claims any owner confirmation, reads **the graph first and the relay second**, plans every
per-address action with a pure planner, and applies the plan in small locked-and-verified transactions, removals last
and only within the limit. The relay's current version decides; the definition derives every value; the report tells
the owner what happened.

```
task reconcileTaggingEdges (neo4j-heavy, arguments:false, forceKill:true)
  └─ bash src/pipeline/tagging-edges/reconcileTaggingEdges.sh
        exec 9>>state/pass.lock; flock -n 9 → exec node reconcileTaggingEdges.js   (else: … --lock-busy)
          node: lock held? ─► runId, TASK_START ─► pessimistic report ─► identities ─► config, driver
                ─► schema pre-flight (tags_address, nostrUser_pubkey) ─► claim confirmation
                ─► READ graph TAGS snapshot (t0) ─► READ relay, one strict scan (t1 > t0)
                ─► planPass (pure, src/lib/tagging-edges/sweep.js)
                ─► creates → updates → moves → removals
                   (≤250 rows / transaction; pre-image, lock, re-read, verify, act)
                ─► final report (atomic) + TASK_END
GET  /api/tagging-edges/status          public read
GET  /api/tagging-edges/held            public read, paged, the latest report's held list only
POST /api/tagging-edges/confirm-held-removals {runId}   owner only → confirmation record → enqueue
control-panel boot: ensureTagsConstraintOnBoot() — never awaited, never throws
```

### The rule for one address

`decideAddress(stored, relayAt)` in `src/lib/tagging-edges/sweep.js` is pure. `stored` is the snapshot row at a
tagging address, or none. `relayAt` is what the relay's scan gives there: an accepted edge `E` (from
`taggingToEdge`), a refusal that carries this address (a non-tagging version), or nothing.

A **tagging address** is a string matching `/^39999:[0-9a-f]{64}:(.+)$/s` whose captured `d` is 1–255 UTF-8 bytes:
exactly the addresses the contract can produce. **Desired** is `E`'s nine properties (`const { type, from, to,
...props } = E`, so the key list comes from the contract) with its ends `E.from → E.to`, except for one rule taken from
the definition's same-version merge: when the stored `eventId` equals `E.eventId`, the stored `tagEventId` equals
`E.tagEventId`, `E.tagAddress` is `null`, and the stored `tagAddress` is itself a well-formed tag address whose
`tagSlug` is its suffix, the desired `tagAddress` and `tagSlug` are the stored ones (so a resolution is never paired
with an element id it was not resolved from; `standingEdge` keeps the stored `tagEventId` with its resolution, `contract.js:221-227`).
Resolution only moves from null to a value (ADR 0001:230-231), because a resolution taken from an element that has
since been replaced cannot be re-derived from the relay (BIBLE §30: precious).

| Graph at the address | Relay at the address | Action | Reported as |
|---|---|---|---|
| a `TAGS` relationship whose `address` is missing, not a string, or not a tagging address | (not consulted) | **leave** | `leftInPlace`, by reason `missing-address` / `not-a-tagging-address` |
| none | edge `E` | **create** `E` | `added` |
| none | a refusal, or nothing | none | the refusal counted under `refused.byReason` |
| a relationship | nothing | **remove** | `removedBy['not-on-relay']` (or held) |
| a relationship | a refusal carrying this address | **remove** | `removedBy['non-tagging']` (or held) |
| a relationship exactly equal to desired: key set, every value and type (`createdAt` `INTEGER NOT NULL`), ends are NostrUser nodes with pubkeys `from` / `to` | edge `E` | none | `unchanged` |
| a relationship whose ends are right but anything else differs (any `eventId`, older or newer; any malformed value; an extra key) | edge `E` | **update** (`SET r = desired`) | `changed`, by `newer` / `older` / `refreshed` / `repaired` |
| a relationship whose ends are not NostrUser `from` → NostrUser `to` | edge `E` | **move** | `changed`, by `moved` |

- "Nothing at the address" covers every route strfry honours — a revoke, any deletion, a wipe — and also a current
  version the `#z` scan cannot see (it lost every stamp) or one outside NIP-01's lower-case form (ADR 0001
  clarification 13). AC-3 removes the edge in each case; only the reason label is coarser.
- The `newer` / `older` label comes from `standingEdge(storedEdge, E).reason` on a well-formed stored edge only;
  a malformed stored edge is `repaired`. The label never drives a write.
- More than one scanned version at a tagging address, accepted or refused, cannot come from strfry. If the scan
  yields it, the pass takes no action at that address and counts `anomalies.sameAddressConflicts`.
- An `update` replaces the whole property map, and a move or removal deletes the relationship, so an extra key on an
  edge at a tagging address does not survive (AC-3 makes that edge the pass's to repair; AC-8 limits what it
  carries). Its value is not lost: the pass records the edge's pre-image before the transaction that changes it (the
  guard, step 1), because a key the definition does not produce cannot be re-derived from the relay (BIBLE.md:1864,
  interim rule: precious by default). The report lists the dropped key names, never their values, for at most 100
  edges (`strippedKeys`), and counts the pre-images written.

### The guard, and why reading the graph first makes it race-safe

Every update, move and removal runs in one `executeWrite` transaction per batch of at most 250 addresses:

1. **Pre-image**, before the transaction opens: for each row whose snapshot carries a key outside the nine, append
   one line `{ runId, address, rid, fromPubkey, toPubkey, props: [[key, type, value], …] }` to
   `<stateDir>/preimages/<runId>.jsonl` (`value`: the snapshot's text for a scalar, its canonical serialisation
   otherwise) and fsync it before the transaction starts. If the append fails, the run fails with `stage: 'write'`
   before that batch. The file is served by no route, never capped, and pruned only by owner action; a lost race
   leaves a harmless pre-image of an edge the pass did not change.
2. **Lock:** `UNWIND $addresses AS a MATCH ()-[r:TAGS {address: a}]->() SET r.address = r.address`.
3. **Re-read** the same rows with the snapshot's projection, in the same transaction.
4. **Verify in JS:** `fingerprint(reRead) === fingerprint(snapshotRow)`. The fingerprint covers the element id, both
   ends (pubkey, its type, NostrUser or not) and every property as `[key, type, text, raw]`, sorted: `text` is
   Cypher's `toString` for the four scalar types, and `raw` carries any other value (a list, a temporal or point
   value) as it is, serialised canonically in JS — strings JSON-quoted, arrays element by element, anything else (a
   number, a driver Integer, a temporal or point value) as `String(v)`. The pass's driver keeps integers lossless, so
   a driver Integer prints exactly. A missing row or a mismatch is a **lost race**: skipped, counted, left to the next
   pass.
5. **Act** on the verified rows only. Each act statement returns its row count, read through `toCount`; a count that
   differs from the rows sent throws, rolls the transaction back and fails the run as a broken invariant.

LOCK's own count is not an invariant: a relationship another transaction deletes between LOCK's `MATCH` and its lock
is skipped silently (Cypher's `setProperty` swallows `EntityNotFoundException`,
`TransactionBoundQueryContext$RelationshipWriteOperations.setProperty`, neo4j-cypher-interpreted-runtime 5.26.10), and
the re-read's missing row is what records that lost race.

The lock is held to commit, so nothing changes a verified relationship before the pass's write lands. Creates run
`OPTIONAL MATCH … WHERE x IS NULL` before `CREATE`; a concurrent uncommitted create at the same address makes the
batch fail with `Neo.ClientError.Schema.ConstraintValidationFailed` (a client error, not retried), and the pass
re-runs that batch one row per transaction, counting the failing row as a lost race.

*Why the order of reads matters.* Assume every `TAGS` writer (the pass, and story 3 below) (i) reads the graph at an
address, then (ii) reads the relay's current state there, then (iii) writes only if the graph still holds what (i)
read. Take two successful writes at one address, by X and then Y, where Y replaces what X wrote (an update, move or
removal). Y's verify matched the state X wrote, so Y read the graph after X's write, which came after X's relay read;
Y read the relay after its own graph read. So successive writes that replace an existing relationship come from
strictly later relay reads: through them the graph at an address equals the relay there as of some moment, and that
moment only moves forward. A create verifies only absence, which carries no version, so the argument does not reach
it (residual 2). Reading the relay first breaks even the replacing case — a pass that reads version 1 from the relay,
then finds version 2 in the graph (written meanwhile by story 3), would verify against version 2 and write version 1
back. The Tester pins the order with a call-order test: the graph read resolves before the scan starts.

**Residuals, accepted.** Each needs a tagging changed and revoked inside one pass's read-to-write window; the next
pass corrects it, and a removal it makes counts toward that pass's limit.

1. *In place.* The relay goes v1 → v2 → (v2 revoked by id) → v1 re-sent, and story 3 rewrites the relationship in
   place to exactly v1's state: the pass's verify passes and it writes v2.
2. *Create after delete.* t0: the pass reads the graph (nothing at A); v1 reaches the relay. t1: the pass scans the
   relay (v1). t2: story 3 (graph read, then relay) creates v1's relationship. t3: the tagger revokes v1 by address,
   so the relay holds nothing at A. t4: story 3 removes A's relationship (the relay wins). t5: the pass's
   create-if-absent finds nothing at A and creates v1. The graph holds a revoked tagging until the next pass, and its
   moment has moved back from t3 to t1.

A per-edge write counter (a bookkeeping value) would close the first only, since a deleted edge's counter is gone;
the second needs a tombstone, which the story excludes (Out of scope, story :173-174). This ADR names neither (owner
decision 11). Story 3 may close both another way (binding 4).

### The removal rule and the limit (R2-NB3, AC-5)

**Binding (R2-NB3):** a relationship at a tagging address is removed when the relay holds nothing at its address, or
holds a version there the definition refuses — only while it still holds the version the decision was made from,
and subject to the limit. A relationship stays while the relay holds an accepted version at its address, even when a
deletion names it.

The planner computes every action before anything is applied. `base` is the number of start-snapshot relationships
at tagging addresses — the ones a pass may remove; those left in place under AC-3 are not counted, and the report
gives their number as `limit.leftInPlaceExcluded` (owner decision 4). `R` is the number of removals the plan makes;
moves and updates never count. The limit is exceeded iff `R > 50 && 10 * R > base`, in integer arithmetic, from two
frozen constants in `sweep.js` that nothing configures. Over the limit, every create, update and move still applies,
no removal applies, the outcome is `done-removals-held`, and the report gives `held.total`, `held.byReason` and
`held.digest`; the held list `{address, seenEventId, reason}` is written to `held/<runId>.json`. Nothing carries
between passes.

A **confirmed** run splits its planned removals into `C`, those whose `(address, seenEventId)` is in the confirmed
held list (still due at the version the owner saw; `null` equals `null`), and `O`, the rest. `C` applies. `O` is
judged as an unconfirmed run would judge it on the graph that remains once `C` applies: held iff `|O| > 50 && 10 *
|O| > base − |C|`, same frozen constants, integer arithmetic. `judgeRemovals` computes `base − |C|` itself and the
report gives it as `limit.baseAfterConfirmed` (owner decision 5). An empty relay read during a confirmed run
therefore removes the confirmed entries still due, and holds every other removal unless there are 50 or fewer or
they are at most a tenth of what remains. Removals are applied last, so a stop leaves the cautious side undone.

### The owner's confirmation

`POST /api/tagging-edges/confirm-held-removals`, body `{ "runId": "…" }`, registered as
`app.post(path, adminApi.requireOwnerOnly, taggingEdges.handleConfirmHeldRemovals)`:

- No session → 401, a loopback call included (`localTrusted` skips the middleware, but `requireOwnerOnly` needs a
  session pubkey). Any session that is not the owner's → 403, admins included. The handler re-checks
  `session.authenticated === true` and `session.pubkey === BRAINSTORM_OWNER_PUBKEY` (lowercase 64-hex) itself, in case
  of a mount mistake. This deliberately departs from the `isOwner(req) || req.localTrusted` template the handoff
  (§2.3) recommends for mutations: that template admits admins and every process in the container.
- A cross-site request is refused: an `Origin` header whose host is not the request's own (the `sameHost` rule of
  `src/api/dlist-curation/update.js:107-115`), or a body that is not `application/json` → 403 / 415.
- 400, before any filesystem call, unless the posted `runId` is a string (not an array) that fully matches `RUN_ID_RE`
  (`/^\d{8}T\d{6}Z-[0-9a-f]{8}$/`, the one grammar the runner generates).
- 409, writing nothing, unless: the latest report's `runId` equals the posted one, checked before any file other than
  `report.json` is touched; its outcome is `done-removals-held` with `held.total > 0`; it is not running; the held
  file for `latest.runId` (read through `readHeld`, below) exists and its sha256 equals `held.digest`.
- Then it writes `confirmation.json` atomically: `{ version: 1, runId, heldDigest, heldCount, nonce, mintedAt,
  expiresAt: mintedAt + 24 h, mintedBy: <owner pubkey, 8-character prefix> }`. At most one is pending; a newer one
  replaces it. 24 h outlasts the 4 h `neo4j-heavy` wait.
- It re-reads the latest report. If a pass started in the meantime, it withdraws the record by renaming it away: if
  the rename finds nothing, that pass has already claimed it and will honour it (answer 200, `claimedBy: <runId>`);
  otherwise answer 409 (a pass that has started but not yet claimed runs unconfirmed: fail-safe).
- It enqueues through the task system — `isQueueAvailable()`, then `runViaQueueAsync({ taskName:
  'reconcileTaggingEdges', timeoutMs: resolveTaskTimeout(task, registry).timeoutMs })` with no `queryParams` — and
  answers `{ confirmed: true, enqueued, jobId?, expiresAt }`. If the queue is disabled or down, the record stays and
  the answer says `enqueued: false`: the next pass to get past its start checks within 24 h uses it (the owner starts
  one from the legacy Task Explorer). An enqueue that joins a waiting job is fine: that job has not started, so it
  will claim the record.

The pass **claims** the record at runner step 7 — after its identity, config and schema checks, while holding its
lock — by `rename(confirmation.json → claimed/<runId>-<nonce>.json)`, atomic, so one claimant. It honours the claim
only if the most recent earlier report whose `phases` include `graph-read` has that `runId` and is `done-removals-held`,
the held file still hashes to `heldDigest`, and the record has not expired. Otherwise it runs unconfirmed and records
`confirmation: { found: true, honoured: false, why }`. A refused start never reaches the claim and changes nothing
(AC-4), so it neither spends nor invalidates a pending confirmation. A claim is spent whatever happens after it: a
run that then fails or is stopped has used it, and the owner confirms the next held report (owner decision 7). A
BullMQ stalled re-run after a deploy finds no record and holds again (fail-safe).

No other channel exists. The registry entry declares `"arguments": false` and `"staticArgs": ""`, so
`buildChildArgs` returns `[]`; the pass reads no confirmation from argv, env, job data or schedule args. A
`/api/run-task` call or a schedule entry carrying anything confirm-shaped starts an ordinary unconfirmed pass —
which any session may start (story Out of scope, "Who may start a task") — and that pass removes nothing over the
limit. The confirmation is applied by the next pass that gets past its start checks, whatever started it, bounded to
entries the owner saw held and that are still due. Root access inside the container is out of scope: it can already
run `cypher-shell`.

### The report

`/var/lib/brainstorm/tagging-edges/report.json` (`TAGGING_EDGES_STATE_DIR` overrides the directory for tests,
following `SCHEDULED_TASKS_CONFIG_PATH`, `src/api/scheduled-tasks/index.js:31-33`) holds
`{ reportVersion: 1, latest, previous: [≤ 9] }`. Every write goes to a temp file, is fsynced and renamed
(`src/utils/customerManager.js:756-771`). `latest` carries every AC-7 field:

```
runId, startedAt, endedAt, durationMs                      when it ran, how long
outcome: done | done-removals-held | refused | failed      outcome
reasonCode, reason, stopped, failure {stage, read?, code, message, stderrTail?}   why; which read failed
                                                           (read: graph | relay | graph-verify)
confirmed: null | {confirmedRunId, heldCount, removalsApplied, heldNoLongerDue}; confirmation {found, honoured, why?}
taggingsRead, tagElementsRead
relationships {atStart, added, changed, changedBy{newer, older, moved, refreshed, repaired}, removed, removedBy,
               unchanged, unresolved, leftInPlace, leftInPlaceBy, lostRace{create, update, move, remove},
               strippedKeys[≤100], preimagesWritten, preimageFile}
peopleAdded
refused {total, byReason}                                  events refused, by REFUSAL reason
held {total, byReason, digest}
limit {base, leftInPlaceExcluded, baseAfterConfirmed, removalsPlanned, floor: 50, fraction: "1/10", exceeded}
identities {canonical, local} (8-character prefixes), reads {graph{rows, ms}, relay{events, bytes, ms}},
phases [{phase, ms, batches, transientRetries}], anomalies {sameAddressConflicts, snapshotConflicts},
running, process {pid, startTime}
```

`unresolved` counts relationships at tagging addresses whose resulting state has `tagAddress` null. `taggingsRead`
counts scanned events carrying either `nostr-user-tag` stamp; on a first run, `added = taggingsRead − refused.total`.
`preimageFile` is the name relative to the state directory (`preimages/<runId>.jsonl`), `null` when none was written.

**Stopped runs.** Once the lock is held, the first write is `latest` = `{ outcome: 'failed', stopped: true,
reasonCode: 'stopped', reason: 'stopped before it finished (time-out, deploy or restart)', running: true,
process: { pid, startTime } }`, moving the prior latest into `previous`. No graph contact happens unless that write
succeeded. The record is updated at each phase boundary and every 10 write batches, and replaced by the final
report. `startTime` is field 22 of `/proc/self/stat` (parsed after the last `)`). `isAlive(record)` is true only
while `/proc/<pid>/stat` exists with that start time and a state (field 3) that is neither `Z` nor `X`: after the
time-out's `kill -9` the process stays a zombie with the same stat line until PID 1 (supervisord) reaps it, because
`launchChildTask.sh` does not wait on it on the time-out branch (:407; compare :439). `computeStatus` sets
`latest.running` from liveness and never passes the stored value through (the pessimistic record stores `running:
true`); a run that is not alive shows its stored text. After a `kill -9`, or a container restart or re-creation (new
pid namespace), the report therefore already reads failed and stopped, and the next pass moves it into `previous`. A
backend-only restart leaves the pass running (Context, the task system): its report goes from running to final, and
the stalled BullMQ re-run is refused by the pgrep guard or the lock. The Tester does not pin "restart → stopped". On
SIGTERM or SIGINT the pass stops at the next batch boundary and writes `failed`, `stopped: true`, `reasonCode:
'signal'` (story 4's Stop can use this).

**Who reads it.** `GET /api/tagging-edges/status` returns `{ reportVersion, running, latest, previous,
confirmationPending }` (the pending record without its nonce); `GET /api/tagging-edges/held?runId=&offset=&limit≤1000`
pages **the latest report's** held list and no other. Both are public reads, following the house convention for
status GETs (`deploy-safety`, `status/neo4j-constraints`, `scheduled-tasks/list`): every value is relay-derived or a
count, identities appear only as 8-character prefixes, and no config value, absolute path or credential appears:
for a filesystem error, `failure.message` carries `err.code` and the state-relative file name, never `err.message`.

The held route never builds a path from request input. Express URL-decodes query values and every unauthenticated
GET reaches the handler (`src/middleware/auth.js:505`), so: `runId` is optional; when given, it must be a string (not an
array) that fully matches `RUN_ID_RE` (else 400, before any filesystem call) and equal `latest.runId` from `report.json` (else 404, before the
held file is touched), which lets a client paging across a new run's start learn that the list changed. The file read
is the one for `latest.runId` as stored. `readHeld(runId)` itself rejects a run id that fails `RUN_ID_RE`, resolves
the path, and asserts it starts with `path.resolve(stateDir(), 'held') + path.sep` before reading.

The display logic is a pure `computeStatus({ report, alive, confirmation, now })` behind a thin handler, the split of
`computeVerdict` (`src/api/deploy-safety/index.js:47`). Story 4's page reads these routes; until then the owner reads
the JSON in a browser on the instance.

### Lock class, time-outs, sizes

`neo4j-heavy` (D10). Task time-out **30 min** (`1800000`) with an explicit `forceKill: true` in the task's own block,
kept as a declared-intent sentinel (`launchChildTask.sh:403` kills on time-out whatever the flag says); 30 min is
below the 4 h lease. Relay scan 60 s; graph snapshot 120 s; each write transaction 60 s (`executeWrite`, driver
retries for transient errors); schema ONLINE wait 60 s. At most 250 rows per write transaction, sorted by
`(from, to)`; `CALL {} IN TRANSACTIONS` is rejected (auto-commit only, no per-row outcome). Estimated first run at
census scale: about 7,030 creates in about 29 transactions and about 5,850 new people — under a minute; a
steady-state pass takes seconds. The local end-to-end run (story Open question 7) and the staging backfill record
`durationMs` and per-phase times; if a measured `durationMs` exceeds a fifth of the time-out, the time-out is raised
in the same change as the measurement, and the read time-outs are checked the same way against their reported ms
(10× margin or more).

### Binding for story 3

1. Story 3 writes `TAGS` only through the port this ADR adds (`src/pipeline/tagging-edges/graph.js`): the same
   pre-image, lock–re-read–verify–act transaction and the same create-if-absent statement. A uniqueness refusal is a
   lost race.
2. **The relay wins.** Story 3 never removes a relationship while the relay holds an accepted version at its address.
   A kind-5 it receives is a trigger to re-read the addresses `revokeTargets` names (plus those of edges whose
   `eventId` it names), never a verdict by itself; so the real-time path never removes a relationship the next pass
   would restore.
3. For each address it touches, story 3 reads the graph, then strictly scans the relay at that address
   (`{kinds:[39999], authors:[pk], '#d':[d]}` through `scanStrict`, filtered to the identity `d`). For an id-only
   tagging it also reads the element its `e` names by a strict scan `{kinds:[39999], ids:[e]}` and passes it as
   `tagElementsById` (`contract.js:96`, :155; the writer fetches elements, ADR 0001:261-263); the same-version rule
   keeps an existing resolution when the element is gone. A websocket `REQ` result is a trigger, never state
   (500-result cap). Story 3 decides with `decideAddress` and never orders versions (A1).
4. Story 3 does not write `report.json` (it adds its own status beside it) and never takes the pass's lock
   exclusively. One option, not a binding: holding the lock file shared (`flock -s`) around each of its write
   transactions keeps real-time writes out of a running pass's window and so closes both race residuals, at the cost
   of real-time writes waiting out a pass; story 3 would then also revisit the wrapper's non-blocking start, which
   would refuse a pass that starts during a real-time write. Any hold on real-time removals is story 3's to design.
   If it needs an index on `TAGS.eventId`, it adds `tags_eventId` through the same boot-hook rollout and both
   expected-rule lists.

## Amendments to ADR 0001

Each goes into ADR 0001 in the same commit as this ADR, with an "Amended by `tagging-edges/0002`" note beside it.

- **Header.** Add an "**Amended (2026-09-27):** by `tagging-edges/0002`" line naming what A1–A11 change; R2-4 to
  R2-7 land with the implementation.
- **A1. Binding bullet 3 (:191-194) is replaced by:** "Every write and delete is conditional on the graph state its
  decision was made from. The writer takes the relationship's write lock, re-reads it in the same transaction and
  proceeds only if it still equals what was read — every property with its type, both ends, and its element id; a
  create proceeds only while no `TAGS` relationship holds the address, which the uniqueness rule `tags_address` makes
  atomic. The decision is made from a relay read taken after that graph read, and follows the relay's current
  version at the address, older or newer: strfry has already applied the version order and every deletion it
  honours, so no write re-checks AC-3's order. Story 2 pins its decision against `standingEdge` over the standing-rule
  truth table, with exactly two documented divergences (`older-ignored` → the relay's version; `no-incoming` → a
  removal) (`tagging-edges/0002`)."
- **A2. Binding bullet 4 (:195-196), settled:** "Story 2 decided: none. A `TAGS` relationship carries exactly the
  nine properties below."
- **A3. Binding bullet 5 (:197-199), R2-5:** "A writer must refuse to start unless both stamp pubkeys are
  **lowercase** 64-hex; either one missing, empty, not 64 hex characters or containing an upper-case letter refuses
  the run and names that identity. … Story 2's mass-delete guard counts every AC-3 removal per run
  (`tagging-edges/0002`)."
- **A4. New binding bullet (R2-NB3):** "A relationship at a tagging address is removed when the relay holds nothing
  at its address, or holds a version there the definition refuses, and only while it still holds the version the
  decision was made from, subject to the mass-removal limit. It stays while the relay holds an accepted version at
  its address, even when a deletion names it (`tagging-edges/0002`)."
- **A5. "No tombstone" (:234-237), append:** "An id-only revoke is the exception: strfry then accepts an older version
  re-sent at the address, and writers follow it, because they follow the relay's current version
  (`tagging-edges/0002`). Order-independence remains a property of `standingEdge`."
- **A6. Consequences, id-only resolution (:261-263), append:** "Story 2 reads tag elements by the two `:tag` stamps in
  the same relay scan as the taggings."
- **A7. Consequences, revokes (:269-272):** replace "Story 2 must read kind-5 events from the same sources it reads
  taggings from" with "Writers read no kind-5 events to decide removals: the relay's current state reflects every
  deletion strfry honours, and a deletion strfry did not honour removes nothing (story 2 AC-3). Story 3 follows the
  same rule — a kind-5 prompts a re-read of the relay, never a removal by itself (`tagging-edges/0002`)." The pointer to
  row `2026-09-27-revokes-do-not-travel` stays.
- **A8. Step 5 (:336-342), R2-8 and R2-NB2:** "The element is usable only if it passes the step-1 event check, its
  `id` is the `e` the tagging names, it is kind 39999, it has an identity `d` — the first `d` of 255 bytes or fewer,
  read as step 1 reads a tagging's own; a missing, empty or non-string one makes it unusable — and it carries
  `39998:<canonical>:tag` or `39998:<local>:tag`. Any error while looking it up or reading it counts as absent."
- **A9. Clarification 10 (:438-440), R2-NB1, append:** "…for numeric types. A `createdAt` that is missing, `null`, a
  string, NaN, a float or a boolean is not ordered safely: JS and Cypher compare such values differently. The
  gap-filling pass never orders a stored `createdAt` to decide a write and repairs any that is not an integer
  (`tagging-edges/0002`); any writer that orders stored edges must first guard `standsOver` against such values."
- **A10. Clarification 13 (:445-447), append:** "…removes the edge instead, reported as `not-on-relay`."
- **A11. Out of scope (:451-458):** mark as settled by `tagging-edges/0002`: the `tags_address` constraint (and no
  `TAGS.eventId` index; story 3 adds one if it needs it); the guard and its parity test; writer-set properties (none);
  ends created on write (bare keyed `MERGE`); tag elements fetched by `:tag` stamp in one scan; kind 5 not fetched.

**Carried documentation nits (implementation tasks, checked by the Reviewer):**

- **R2-4:** beside the strfry bullets (ADR 0001:100-101), record strfry's remaining address-deletion divergences:
  addresses over 255 bytes, a kind written with a leading `0`, `+` or space, and strfry matching the raw address
  where the definition lower-cases its pubkey.
- **R2-5:** the epic's guardrail (`engineering-team/epics/tagging-edges.md:69-71`) says the writer refuses if
  *either* identity is missing or malformed, and that the form is lowercase 64-hex (A3).
- **R2-6:** clarification 9's `events.cpp` cite (ADR 0001:436, `:57-60`) reads `:59-62`; step 1 (:316-318) says
  strfry rejects an event whose `d` value is not a string, and files one with a missing or empty `d` under `''`;
  story 1's test plan (`engineering-team/stories/tagging-edges/1-tagging-edge-contract.test-plan.md:205`) says four
  clarifications.
- **R2-7:** the stance-bucketing paragraph (ADR 0001:222-225) takes BIBLE's qualified wording (BIBLE.md:315:
  `""`, `"NaN"`, `"-Infinity"` can bucket differently in Cypher and JS).
- **R2-8:** step 5, as A8 — applied to ADR 0001 in this ADR's commit.
- **R2-9:** story 1's test plan ends without a trailing blank line.

## How each acceptance criterion is met

| AC | Met by |
|---|---|
| **AC-1** | A full relay scan with no `since`, so a tagging of any `created_at` is read by the next pass (D2). `create` for every accepted edge with no relationship (rule table). People added by a bare keyed `MERGE` in the same statement (D6). An `a`-named tag takes its address from the contract; an id-only tag resolves against the elements in the same snapshot, stays unresolved until one arrives, and is filled on the first pass after (same-version rule). `resolveTagElement` uses `identityD` (R2-NB2, A8). |
| **AC-2** | Desired is always the relay's current version, older or newer (D3); target change → move, delete-then-create in one transaction (D7); a malformed stored `createdAt` is repaired, never ordered (D5). Graph read before relay read, plus lock–re-read–verify for changes and create-if-absent under the uniqueness rule (D4) — a lost race is left to the next pass. Exact equality (key set, types, ends) means agreement writes nothing and reports nothing added, changed or removed. |
| **AC-3** | `not-on-relay` and `non-tagging` removals, each only after its verify passes (D4, R2-NB3 binding). No kind-5 read, so the relay wins (D2). The leave row for missing or non-tagging addresses, counted by reason. The only `DELETE` is of one `r:TAGS` matched by address; no node is ever deleted (the statement audit of `graph.js`, Seams for Test Design → Static sentinels). |
| **AC-4** | Every read the plan is made from (graph snapshot, relay scan) precedes every write (runner steps 8–9 before 11). The verify re-read belongs to its write transaction: its failure rolls back that batch only, earlier committed batches stand with each tagging at one version, and the run ends failed with `failure {stage: 'write', read: 'graph-verify'}` — AC-7's stopped-partway case (owner decision 8). The strict scan's completeness rule (D2), the graph read's time-out and completeness checks. Identities, config and schema are checked before any graph read, relay read or claim (steps 4–6, before the claim at step 7); an identity failure names the identity and its source. `failure.stage` / `failure.read` in the report. |
| **AC-5** | Plan-then-apply with the frozen limit over the base of relationships at tagging addresses; moves are updates; outcome `done-removals-held` with counts by reason; no memory between passes. Owner-only, cross-site-refusing route; a single-use record bound to run id and held digest, claimed by rename after the start checks; a confirmed run removes only held-and-still-due entries (`C`) and judges the rest against `base − \|C\|`. No argument, env, job-data or schedule channel. |
| **AC-6** | `tags_address` created by the boot hook on every deploy and restart; the pass's pre-flight creates it or refuses before any write; the setup script's last statement powers the Dashboard fix; both name-based lists carry the name, so they agree. |
| **AC-7** | `report.json` on the data volume, with every listed field, read through `GET /api/tagging-edges/status`. A registry task with a disabled daily seed; the confirm route enqueues through the queue. Queue dedup, the pgrep guard and the kernel lock; a start that finds the lock held is refused. Pessimistic-first report plus liveness gives "failed — stopped" after a kill or a container restart; each committed transaction leaves every tagging it touched at one version; the next pass converges. A confirmed run stopped before its removals finish has spent its confirmation (AC-5: one run): the next pass reaches the state a completed unconfirmed run reaches — over-limit removals held again — and the owner confirms that report (owner decision 7). |
| **AC-8** | The only node clause is a bare keyed `MERGE`; `SET r = props` with exactly the nine contract keys; a key outside the nine is dropped only after its pre-image is recorded (the guard, step 1); no bookkeeping value, so nothing named `timestamp`. Static audit of every statement, and the before/after snapshot in the local end-to-end run. |

## Consequences

- **Enables:** the graph holds every tagging this relay holds, as the contract defines it, and repairs itself on a
  schedule. Story 3 inherits a writer, a strict relay reader and a race-safe guard, and must follow the relay the
  same way. Story 4 inherits the status and held routes and a report shape (`reportVersion: 1`, additive keys).
- **Owner-visible:** after the backfill, the Dashboard's Relationships total rises by about the number of taggings and
  Users by about 5,850 per host; the local Users page gets heavy after the local end-to-end run (it fetches every
  pubkey, `ui/src/pages/users/Index.jsx:36`). The pass waits behind scoring and holds scoring for its run;
  `deploy-safety` reads unsafe while its job is active.
- **Constrains:** every `TAGS` writer reads the graph before the relay and writes through the verified transaction,
  recording the pre-image of an edge that carries keys outside the nine before changing or removing it. No `TAGS`
  relationship carries a bookkeeping value. The contract folder stays pure: I/O, time, crypto and the
  canonical-pubkey lookup live outside it.
- **Departures recorded:** the confirm route does not use the handoff's `isOwner || localTrusted` template (§2.3). The
  pass builds its own Neo4j driver from the environment rather than `getDriver()`, so its output never carries the
  password. A second copy of the `sameHost` Origin rule is added until row 326 (the house-wide cross-origin posture)
  centralises it.
- **Risks:**
  1. Community permits relationship uniqueness (`StandardConstraintSemantics.createUniquenessConstraintRule` has no
     Enterprise guard, unlike the existence, type, key and endpoint rules); creation additionally requires each
     database's kernel version to be at least `VERSION_REL_UNIQUE_CONSTRAINTS_INTRODUCED`
     (`Operations.uniquePropertyConstraintCreate`). Each host's database has its own store history, so this is
     confirmed per host after deploy — the boot hook's log line, or `SHOW CONSTRAINTS YIELD name, entityType WHERE
     name = 'tags_address'` — before that host's backfill; a version refusal (a status-less `UnsupportedOperationException`
     asking for `dbms.upgrade()`) is an error the boot hook logs and stops on, and the pass reports as `refused` /
     `schema`. If the rule cannot be created, AC-6 cannot be met as written
     and the story returns to Planning.
  2. The lock-first idiom rests on the kernel bytecode and a query plan; the opt-in live test (below) proves it by
     blocking on an uncommitted change.
  3. A stale `neo4j-heavy` lease after a deploy can hold the pass and scoring for up to 4 h (pre-existing); a pass
     that never starts leaves the previous report as latest.
  4. A silent under-read (LMDB damage with exit 0) within the limit would apply up to 10% removals; the limit caps it.
  5. People already stored under upper-case or non-hex pubkeys (the stream consumer merges raw `p` values,
     `src/pipeline/stream/redis-consumer.js:47-51`) stay separate from the pass's lower-case nodes.
  6. The two race residuals above (in place, and create after delete); each needs a tagging changed and revoked
     inside one pass's read-to-write window, and the next pass corrects it.
  7. The stream consumer does not retry, so a deadlock it loses to a pass transaction drops its event (row
     `2026-09-27-stream-consumer-at-most-once`); small sorted batches keep this rare.
- **Candidate ledger rows** (search `OPEN.md`, `ledger/`, the board and `origin/staging` before filing; security rows
  pointer-level):
  1. The shared config reader prints every value it reads, a credential included, and the control panel's supervisor
     log already holds such lines (`src/utils/config.js`; `src/lib/neo4j-driver.js:29-41`). Security.
  2. `scanLocalStrict` decodes per chunk and drops unparseable lines (`src/api/setup/status.js:80`, :91); its tagging
     readers can adopt `src/lib/strfryScanStrict.js`. Relates to row `2026-09-21-failed-strfry-scan-reads-empty`.
  3. `launchChildTask.sh:460` greps `${BRAINSTORM_LOG_DIR}/events.jsonl` rather than `taskQueue/events.jsonl`, and a
     time-out or uncaught failure returns 0 (:496-523), so a BullMQ job's success flag means nothing.
  4. The Scheduled Tasks panel reads `rec.failure`, which no emitter writes (`src/api/scheduled-tasks/index.js:195`),
     so every `TASK_END` reads as success.
  5. Nothing clears the `neo4j-heavy` holders hash at boot, so a deploy-killed heavy job blocks heavy tasks for up to
     4 h.
  6. Row 326's text says no CORS middleware is installed under `src/`; the posture it asks to decide is set in
     `bin/control-panel.js`. Update that row rather than filing a new one (security, pointer-level).
  Already tracked, not to file: `closeTaskQueue` unwired to SIGTERM (`engineering-team/stories/_intake.md:696`).
- **Firmware reinstall required?** No. No concept definition changes.

## Owner decisions needed at this gate

1. **Amend ADR 0001's write binding** (A1, A5): writers follow the relay's current version, older or newer, guarded
   by lock–re-read–verify on the full stored state rather than an `eventId` match with an order re-check. This is what
   makes AC-2's revoke-then-re-send outcome reachable, at the cost of one re-read per write batch.
2. **Amend ADR 0001's kind-5 consequence** (A7) and bind story 3 to it: no writer reads kind 5 to decide a removal;
   a kind-5 only triggers a relay re-read. The cost: a deletion the relay did not honour removes nothing (AC-3).
3. **R2-NB1 by binding the pass, not by guarding the contract** (D5): the pass never orders a stored `createdAt` and
   repairs a malformed one. The cost: `standsOver` stays unguarded, so a future writer that orders stored edges adds
   the guard first.
4. **The limit's base is the `TAGS` relationships at tagging addresses:** AC-5's "tagging relationships" is read as
   the ones a pass may remove, so rows left in place are not counted (`limit.leftInPlaceExcluded`). Identical to the
   literal reading today (0 `TAGS` rows) and stricter whenever left-in-place rows exist; the limit never loosens.
5. **A confirmed run judges the removals it was not confirmed for against what remains after the confirmed ones**
   (`base − |C|`, reported as `limit.baseAfterConfirmed`), stricter than the start count. The cost: a confirmed
   cleanup that meets other due removals may need a second confirmation.
6. **The confirmation is applied by the next pass that gets past its start checks within 24 h**, whatever started
   it, bounded to entries the owner saw held and that are still due; a refused start neither spends nor invalidates
   it. The cost: an ordinary scheduled or on-demand pass can be the one that applies it; and a refused start after a
   held report becomes the latest report, so until a later pass holds again that held list is neither served nor
   confirmable (both routes read only `latest`), though a confirmation minted before it is still honoured.
7. **AC-5's one-run rule takes precedence over AC-7's last clause for confirmed runs:** a confirmed run stopped before
   its removals finish has spent its confirmation, and the next pass holds the over-limit removals again for the owner
   to confirm. The alternative is to let a pass re-honour, within the 24 h expiry, a claimed record whose claimant's
   report reads failed and stopped with removals unfinished, validated the same way.
8. **AC-4's zero-change guarantee covers the reads the plan is made from** (graph snapshot, relay scan); a read
   failure while applying (the verify re-read inside a write transaction) is AC-7's partial stop. The cost: batches
   committed before it stand, each tagging at one version.
9. **Keys outside the nine on a relationship at a tagging address are dropped** (AC-3, AC-8); their values are kept
   in the pre-image file (BIBLE §30 interim rule), which no route serves and only the owner prunes. The cost: zero
   rows today (0 `TAGS` edges), and a run that cannot write a pre-image fails before that batch.
10. **Resolution is kept once made** for the same version (same `eventId` and `tagEventId`), even after its tag
    element is replaced, and for a malformed stored edge whose stored resolution is itself well-formed; everything
    else on such an edge is re-derived. The cost: such a resolution cannot be re-checked against the relay.
11. **No bookkeeping value on `TAGS`,** accepting both race residuals, each corrected by the next pass. A per-edge
    write counter, which AC-8 would allow if this ADR named it, would close the in-place case only; the
    create-after-delete case needs a tombstone, which the story excludes.
12. **The pass takes `neo4j-heavy`** (D10), with its costs: it waits behind scoring, scoring waits for it, a stale
    lease after a deploy can hold it for up to 4 h, and `deploy-safety` reads unsafe while its job is active.
13. **Three new routes:** `GET /api/tagging-edges/status` and `GET /api/tagging-edges/held` as public reads of
    relay-derived data and counts (the held route serves only the latest report's list and builds no path from the
    request), and `POST /api/tagging-edges/confirm-held-removals` as owner-only (no admins, no loopback), a deliberate
    departure from the handoff's mutation template.
14. **Until story 4:** AC-7's "read its report on the instance" is met by the JSON status URL, and AC-5's
    confirmation is a signed-in `fetch` from the owner's browser (OPERATIONS carries the snippet). The alternative is
    a minimal button on a legacy page (about 40 lines).
15. **A start refused because another pass holds the lock writes no report**; it emits `TASK_ERROR` / `TASK_END`
    (`not-started`) and the running pass's report stays latest.

## Implementation notes

Test-file changes named here belong to Phase 3 (the Tester's lane); the Implementer does not edit `test/`.

**New files.**

- `src/lib/tagging-edges/sweep.js` — **pure** sibling (passes the purity and no-64-hex guards; `Buffer` and `BigInt`
  allowed). Exports:
  - `TAGS_PROPERTY_KEYS` (the nine; a test pins it to `EDGE_KEYS` minus `type` / `from` / `to`), `LIMIT = Object.freeze({
    floor: 50, fraction: 10 })`, `REMOVAL_REASON`, `LEFT_REASON`, `CHANGE_KIND`, and `RUN_ID_RE` (the one run-id
    grammar, The owner's confirmation), which the runner generates and every route and `readHeld` accept.
  - `checkIdentity(value)` → `null` | `'missing'` | `'empty'` | `'not-64-hex'` | `'upper-case'` (`undefined` / `null` /
    non-string → missing; `''` → empty; 64 hex with any `[A-F]` → upper-case; otherwise not matching
    `/^[0-9a-f]{64}$/` → not-64-hex).
  - `isTaggingAddress(a)`; `sweepFilter({ canonicalPubkey, localPubkey })` (four stamps via the contract's `stamp`,
    de-duplicated when the two are equal); `isExpectedScanEvent(ev, filter)`.
  - `readRelay(events, identities)` → `{ byAddress, taggingsRead, tagElementsRead, refused, anomalies }`: every
    scanned event goes into the `tagElementsById` map (the contract applies its own checks); events carrying a
    `nostr-user-tag` stamp are run through `taggingToEdge`; an address with more than one result, accepted or
    refused, is marked as a conflict — never left absent, which would read as "nothing on the relay" and remove —
    and counted in `anomalies.sameAddressConflicts`; `planPass` leaves that address alone.
  - `storedFromRow(row)` → `{ wellFormed, edge, problems, strippedKeys }`; `fingerprint(row)` (the guard's canonical
    serialisation, step 4); `desiredFor(stored, relayEdge)`; `decideAddress(stored, relayAt)` → `{ action, desired,
    reason, label }`.
  - `judgeRemovals({ removals, base, confirmedHeld })` → `{ apply, held, limit }`, splitting `C` from `O` and computing
    `base − |C|` itself; `planPass({ snapshotRows, relayEvents, identities, confirmedHeld })` → `{ creates, updates,
    moves, removals, held, counts, … }`, with `base` counted over tagging addresses only; `groupSnapshot(rows)` →
    `{ byAddress, conflicts }` finds the snapshot conflicts runner step 8 counts, and `planPass` leaves those addresses
    alone.
  - `heldLines(held)` → the canonical text the digest is taken over (`address\tseenEventId\treason\n`, sorted);
    hashing happens outside the folder.
- `src/lib/strfryScanStrict.js` — `scanStrict(filter, { timeoutMs = 60000, isExpected, maxBytes = 256 MiB,
  spawnImpl })` → `Promise<{ events, lines, bytes, elapsedMs }>`, rejecting with `ScanError { code, message,
  stderrTail }`. A read is complete only when all hold: `spawn` did not throw and no `'error'` fired (`spawn`,
  `process-error`); `close` arrived before `timeoutMs` (else SIGKILL, `timeout`) with `code === 0` (`exit`) and
  `signal === null` (`signal`); stdout was decoded with `setEncoding('utf8')` and split as it arrives; stdout is empty
  or ends in `\n` (`truncated`); every non-empty line parses to an object whose `id` is 64-hex in either case
  (`unparseable`, `not-an-event-line`); no id repeats, compared lower-cased (`duplicate`); every event passes
  `isExpected` — kind 39999 and a `z` among the requested stamps (`off-filter`); total bytes ≤ `maxBytes`
  (`too-large`). It keeps a 4 KiB stderr tail; the report takes only the last `strfry error:` line or the exit code,
  at most 300 characters, with any 64-hex run cut to 8 characters. No count is taken (a separate process is a
  separate snapshot). Skeleton: the settle-once / SIGKILL time-out of `status.js:57-86` with the line loop of
  `bDisposition.js:70-100` and the stderr tail of `dlist-curation/update.js:238-243`.
- `src/pipeline/tagging-edges/reconcileTaggingEdges.sh` — the wrapper:

  ```bash
  #!/bin/bash
  # tagging-edges story 2 / ADR tagging-edges/0002. Takes the pass's kernel lock and execs node, so the lock lives as
  # long as the pass and the task time-out's kill -9 reaches it (launchChildTask.sh:407). No secret on any argv.
  set -euo pipefail
  source /etc/brainstorm.conf
  DIR="${BRAINSTORM_MODULE_SRC_DIR}/pipeline/tagging-edges"
  STATE_DIR="${TAGGING_EDGES_STATE_DIR:-/var/lib/brainstorm/tagging-edges}"
  mkdir -p "$STATE_DIR" && chmod 700 "$STATE_DIR"
  exec 9>>"$STATE_DIR/pass.lock"
  if flock -n 9; then exec node "$DIR/reconcileTaggingEdges.js"; fi
  exec node "$DIR/reconcileTaggingEdges.js" --lock-busy
  ```

- `src/pipeline/tagging-edges/reconcileTaggingEdges.js` — `run(deps)` → final report; `defaultDeps()` (lazy requires,
  including `require('../../api/profile-tags').NOSTR_USER_TAG_Z_TAG` inside the canonical getter, following
  `identificationTaggings.js:71-73`); a `require.main === module` entry that sets `process.exitCode` (0 done or held,
  2 refused, 1 failed; `--lock-busy` exits 0). `deps = { now, randomId, lock, state, identities, env, openGraph, scan,
  emit, proc, signals }`. Sequence:
  1. `--lock-busy`: emit `TASK_START`, `TASK_ERROR` and `TASK_END` `{ outcome: 'not-started', why: 'another pass is
     running' }`; touch no file; exit 0. Otherwise verify `/proc/self/fdinfo/9` shows a `FLOCK … WRITE` lock, else
     refuse `not-started-under-the-lock` the same way (so a hand-run `node reconcileTaggingEdges.js` cannot write).
  2. `runId` = the UTC start time as `YYYYMMDDTHHMMSSZ`, `-`, and 8 lower-case hex characters from
     `crypto.randomBytes(4)` — exactly `RUN_ID_RE`; `TASK_START { runId }`.
  3. Read `report.json`; if its `latest.running` is true, that owner is dead (the lock is ours): set `running: false`,
     `stoppedDetectedAt`. Write the pessimistic record as `latest`, pushing the prior latest into `previous` (cap 9).
     If this write fails, emit `TASK_ERROR` / `TASK_END` and exit 1 with no graph contact.
  4. Identities. Canonical: parsed from `NOSTR_USER_TAG_Z_TAG` with `/^39998:(.*):nostr-user-tag$/s` (source
     `profile-tags`). Local: `checkIdentity` on every local source that is present — `process.env.TA_PUBKEY` if set
     (source `env TA_PUBKEY`); `process.env.BRAINSTORM_RELAY_PUBKEY` if set (source `brainstorm.conf`, which the
     wrapper sources and exports); and the helper's result (source `env TA_PUBKEY` when that is set, `brainstorm.conf`
     when it equals the conf value, otherwise `secure-keys file`); when no source yields a value the problem is
     `missing`, source `brainstorm.conf`, where setup writes it. The pass uses the helper's result. Any problem →
     `refused`, `reasonCode: 'identity'`, `identity: 'canonical' | 'local'`, `problem`, `source`. Getters are injected
     (the helper caches its value).
  5. Config: `NEO4J_URI` and `NEO4J_USER` non-empty in `process.env` (exported by `/etc/brainstorm.conf`,
     `config/brainstorm.conf.template:70-72`, sourced by `launchChildTask.sh:14-15` and the wrapper) → else `refused`,
     `config`. Build the pass's own driver (`maxConnectionPoolSize: 4`,
     `connectionAcquisitionTimeout: 30000`, `maxTransactionRetryTime: 30000`) and close it on every exit path; never
     `getDriver()`. Integers stay lossless; every count `graph.js` compares goes through `toCount`.
  6. Schema pre-flight: `tags_address` present by definition and ONLINE, else create it once and wait up to 60 s,
     else `refused`, `schema`, with the Neo4j code; `nostrUser_pubkey` present by definition, else `refused` (the pass
     never creates it — that is a 3M-node index and the owner's Dashboard fix).
  7. Claim and validate any confirmation (above). No earlier step touches `confirmation.json`.
  8. Graph snapshot (step t0) → `failed`, `read: 'graph'` on any error, time-out, or a row missing a column. A
     repeated element id or two rows at one address is a concurrent write (a move committed during the stream, under
     read-committed isolation): no action at that address, counted in `anomalies.snapshotConflicts`. If there is any,
     the runner re-reads the schema, and the run fails ("the one-per-tagging rule is not holding") only if
     `tags_address` is no longer listed ONLINE.
  9. Relay scan, starting only after step 8 resolved → `failed`, `read: 'relay'` on any `ScanError`.
  10. `planPass` → `failed`, `plan` on a thrown error.
  11. Apply creates, updates, moves, then the removals `judgeRemovals` allows, each locked batch after its pre-images
      (the guard, step 1); check the stop flag between batches; any error after the driver's retries → `failed`,
      `write` (`read: 'graph-verify'` when the verify re-read failed), with the partial counts (every committed batch
      stands at one version).
  12. Write the held file if anything is held, the final report, `TASK_END` (with `TASK_ERROR` first when refused or
      failed), close the driver, exit.
- `src/pipeline/tagging-edges/graph.js` — the Neo4j port story 3 reuses (lazy `require('neo4j-driver')`, so it loads
  stack-free). Exports `CYPHER` (all statement texts), `SCALAR_TYPES`, `toWriteProps(edge)` (the nine keys, nulls
  omitted, `createdAt` as `BigInt`), `schemaStatusFromRows(constraints, indexes)` (pure: present by definition —
  `entityType` RELATIONSHIP, `labelsOrTypes` `['TAGS']`, `properties` `['address']`, `type` ending in `UNIQUENESS`,
  owned index ONLINE — and by name, reporting "present under another name"), `toCount(v)` (`neo4j.isInt(v) ?
  v.toNumber() : v`, through which every count graph.js compares passes), `openGraph({ uri, user, password })` → `{
  readSchema, ensureTagsConstraint, readAll({ timeoutMs }), applyLocked(kind, rows, { timeoutMs, preimage }),
  applyCreates(rows, { timeoutMs }), close }` (`applyLocked`
  awaits the injected `preimage(rows)` before opening each transaction and refuses to run without one; each apply → `{
  applied, lostRace, nodesCreated, transientRetries }`, counters from committed attempts only), and
  `ensureTagsConstraintOnBoot({ runWrite, runRead, log, sleep })`. Statements:

  ```cypher
  -- READ_ALL (executeRead, timeout 120 s); READ_AT is the same projection over UNWIND $addresses
  MATCH (s)-[r:TAGS]->(t)
  RETURN elementId(r) AS rid,
         s.pubkey AS fromPubkey, valueType(s.pubkey) AS fromPubkeyType, s:NostrUser AS fromIsUser,
         t.pubkey AS toPubkey,   valueType(t.pubkey) AS toPubkeyType,   t:NostrUser AS toIsUser,
         [k IN keys(r) | [k, valueType(r[k]),
            CASE WHEN valueType(r[k]) IN $scalarTypes THEN toString(r[k]) END,
            CASE WHEN NOT valueType(r[k]) IN $scalarTypes THEN r[k] END]] AS props

  -- LOCK (first statement of a locked batch)
  UNWIND $addresses AS a MATCH ()-[r:TAGS {address: a}]->() SET r.address = r.address RETURN count(r) AS locked

  -- UPDATE (verified rows only)
  UNWIND $rows AS row MATCH ()-[r:TAGS {address: row.address}]->() SET r = row.props RETURN count(r) AS n

  -- MOVE (verified rows only; DELETE before CREATE)
  UNWIND $rows AS row MATCH ()-[r:TAGS {address: row.address}]->() DELETE r
  WITH row MERGE (a:NostrUser {pubkey: row.from}) MERGE (b:NostrUser {pubkey: row.to})
  CREATE (a)-[n:TAGS]->(b) SET n = row.props RETURN count(n) AS n

  -- REMOVE (verified addresses only)
  UNWIND $addresses AS a MATCH ()-[r:TAGS {address: a}]->() DELETE r RETURN count(*) AS n

  -- CREATE_IF_ABSENT (own transaction per batch; one row per transaction after ConstraintValidationFailed)
  UNWIND $rows AS row
  OPTIONAL MATCH ()-[x:TAGS {address: row.address}]->()
  WITH row, x WHERE x IS NULL
  MERGE (a:NostrUser {pubkey: row.from}) MERGE (b:NostrUser {pubkey: row.to})
  CREATE (a)-[n:TAGS]->(b) SET n = row.props
  RETURN row.address AS address

  -- CREATE_TAGS_CONSTRAINT (auto-commit, its own transaction)
  CREATE CONSTRAINT tags_address IF NOT EXISTS FOR ()-[r:TAGS]-() REQUIRE r.address IS UNIQUE
  ```

  `$scalarTypes` is `['INTEGER NOT NULL', 'FLOAT NOT NULL', 'STRING NOT NULL', 'BOOLEAN NOT NULL']`. No statement
  contains `DETACH`, `REMOVE`, `ON CREATE`, `ON MATCH`, a `SET` on a node variable, or `timestamp`. No separate index on
  `TAGS.address` (a plain index created first would block the constraint).
- `src/pipeline/tagging-edges/state.js` — `stateDir()`, `readReport()`, `writeReport(report)` (tmp, fsync, rename,
  directory fsync), `writeHeld` / `readHeld(runId)` (rejects a run id failing `RUN_ID_RE`, asserts the resolved path
  is inside `held/`) / `heldDigest` (sha256 over `heldLines`), `appendPreimages(runId, records)` (append, fsync the
  file, and the directory when it creates the file), `writeConfirmation`, `claimConfirmation(runId)`,
  `withdrawConfirmation()`, `readPendingConfirmation()`, `prune()` (last 5 held files, plus any a pending or claimed
  record names; last 20 claimed records; never `preimages/`), `processStartTime(pid, { readFile })`, `isAlive(record,
  { readFile })` (start time matches and state not `Z` / `X`), `lockHeld(fd, { readFile })`.
- `src/api/tagging-edges/index.js` — `computeStatus` (pure; sets `running` from `alive`) and `validateConfirmation`
  (pure; `RUN_ID_RE`, then equality with `latest.runId`, before any held-file access), `handleStatus`, `handleHeld`,
  `handleConfirmHeldRemovals` (dependencies injected, `readFile` included; the Origin rule copied from
  `dlist-curation/update.js:107-115` with a comment pointing to row 326).

**Changed files.**

- `src/lib/tagging-edges/contract.js`: R2-NB2 — `resolveTagElement` takes `identityD(el)` instead of
  `firstTag(el, 'd')[1]` (:99-101); export `stamp`. Nothing else; `REFUSAL` keeps its ten values.
- `src/lib/tagging-edges/index.js`: re-export `./sweep`.
- `src/manage/taskQueue/taskRegistry.json`: the entry below, beside `reconcileRecent` (:317-346), with no `parent`.

  ```json
  "reconcileTaggingEdges": {
    "name": "Reconcile tagging relationships",
    "categories": ["network"],
    "description": "Brings the graph's TAGS relationships into agreement with this instance's relay (tagging-edges #2). The first run is the backfill; later runs repair drift. Holds large removals for owner confirmation. Report: GET /api/tagging-edges/status.",
    "scripts": ["$BRAINSTORM_MODULE_SRC_DIR/pipeline/tagging-edges/reconcileTaggingEdges.sh"],
    "script": "$BRAINSTORM_MODULE_SRC_DIR/pipeline/tagging-edges/reconcileTaggingEdges.sh",
    "script_relative_path": "pipeline/tagging-edges/reconcileTaggingEdges",
    "staticArgs": "",
    "arguments": false,
    "scope": "system",
    "priority": "medium",
    "frequency": "daily",
    "status": "active",
    "structuredLogging": true,
    "resourceClass": "neo4j-heavy",
    "options": { "completion": { "failure": { "timeout": {
      "comments": "1800000 = 30 minutes; first run under a minute at census scale (re-check against the staging backfill's durationMs); below the 4h neo4j-heavy lease",
      "duration": 1800000, "forceKill": true } } } },
    "notes": "ADR tagging-edges/0002. The wrapper takes a kernel flock and execs node; script_relative_path matches both. Takes no arguments: the owner's confirmation is a server-side record, never a task argument."
  }
  ```

- `src/api/scheduled-tasks/index.js`: a third seed in `freshInstallEntries` (:41-71), after
  `refreshApplicabilityLists`, with at most a one-line comment — `{ id: 'seed:reconcileTaggingEdges', taskId:
  'reconcileTaggingEdges', label: labelOf('reconcileTaggingEdges'), args: {}, enabled: false, intervalDays: 1,
  intervalHours: 0, intervalMinutes: 0, cron: '' }`. BK1's window (`test/applicability-republish.test.js:177`) matches
  1,095 characters today, leaving about 700.
- `src/api/index.js`: the three routes, registered after `adminApi` is required (:508-512). None of the paths contains
  an `ownerOnlyEndpoints` substring.
- `bin/control-panel.js`: after `await api.register(app)` (:325-326), call
  `require('../src/pipeline/tagging-edges/graph').ensureTagsConstraintOnBoot({ … })` **without `await`**. It uses the
  shared `writeCypher` / `runCypher`; checks by definition; creates if missing, in its own auto-commit statement;
  retries transient, connection and authentication errors (`Neo.TransientError.*`, `ServiceUnavailable`,
  `SessionExpired`, `Neo.ClientError.Security.Unauthorized`, `Neo.ClientError.Security.AuthenticationRateLimit`,
  `Neo.ClientError.Security.CredentialsExpired`) with backoff from 5 s to 60 s for up to 30 min — the entrypoint
  changes a volume-persisted database's default password in the background after Neo4j starts, in parallel with the
  backend (`docker/entrypoint.sh:297-327`), so the configured password can fail for the first minutes of a boot;
  stops at the first error outside that list (a schema client error such as duplicates or a blocking index, or an
  error with no Neo4j status such as the kernel-version refusal) and logs one line
  (`[tagging-edges] uniqueness rule tags_address not created: <code>`); logs "present under another name" when that is
  the case and never drops anything; catches everything, so no unhandled rejection reaches Node 22. It uses the shared
  `writeCypher`, whose first call logs the config values it reads (Consequences, candidate ledger row 1); the hook makes that
  happen at every boot rather than at the first query, and adds no new exposure.
- `setup/neo4jConstraintsAndIndexes.sh`: the same `CREATE CONSTRAINT` as the **last** statement of the block (:43-78),
  so under `set -e` a failure there cannot skip earlier statements.
- `src/api/status/queries/expectedNeo4jSchema.js:10-18`: add `'tags_address'` to `EXPECTED_CONSTRAINTS`.
  `ui/src/pages/Dashboard.jsx:223-228`: add `{ name: 'tags_address', label: 'TAGS.address', property: 'address',
  entity: 'TAGS' }`. Nothing is added to either index list (the constraint's owned index carries its name). The
  Dashboard change reaches instances through the image build.
- **BIBLE.md:**
  - §6 status line (:320): what writes `TAGS` — the gap-filling pass, task `reconcileTaggingEdges`
    (`src/pipeline/tagging-edges/`, ADR `tagging-edges/0002`), on demand or on a schedule (a disabled daily entry on
    fresh installs), `neo4j-heavy`, holding large removals for owner confirmation, reporting at
    `GET /api/tagging-edges/status`; the real-time path (story 3) is not built yet.
  - §6 Revokes bullet (:317): the relationship follows the relay — removed when the relay no longer holds the tagging,
    by any route the relay honours (including the tagger's kind-5, NIP-09), and kept while the relay holds it, even
    when a deletion the relay did not act on names it. Keep "kind-5", "NIP-09", "tagger" and "moves the relationship
    to" in the subsection (`test/tagging-edge-contract.test.js:798-799`).
  - §6 "One version stands" (:316): writers follow the relay's current version, including an older one re-sent after
    an id-only revoke. One sentence on `tags_address`.
  - §6 §30 class (:318): a resolution kept after its tag element is replaced cannot be re-derived, so writers keep it.
  - §11 (:456): rows for the three routes. §16 (:1378): an entry. A new `Last updated:` line. Wording trap: never "the
    canonical definitions" (`test/assistant-attention.test.js:681-688`).
- **OPERATIONS.md:** a new §12.8 "`reconcileTaggingEdges` — the tagging gap-filling pass" after §12.7 (:709): how to run
  it (Task Explorer or `POST /api/run-task?taskName=reconcileTaggingEdges`; locally restart `brainstorm` first, and
  build the UI for the Dashboard change); adding the daily schedule by hand on staging and production; reading the
  status URL; confirming held removals (the `fetch` snippet); what each outcome means; the lease runbook (:580); the
  measured durations. And a subsection on the first schema addition since the constraints check went name-based: the
  boot hook creates `tags_address` on every deploy; confirm it by the absent Dashboard banner,
  `GET /api/status/neo4j-constraints` reading `set up`, or `SHOW CONSTRAINTS YIELD name WHERE name = 'tags_address'`;
  a per-host step, before that host's backfill, confirming the rule was created there (the boot hook's log line, or
  `SHOW CONSTRAINTS YIELD name, entityType WHERE name = 'tags_address'` reading RELATIONSHIP; Risk 1); the fallbacks
  (Dashboard fix, setup script); and that the pass refuses without it.
- ADR 0001 (the amendments above), the epic (R2-5), story 1's test plan (R2-6, R2-9), the handoff's §3 / §4 notes
  ("settled by `tagging-edges/0002`"; Status stays open), and story 2's Linked artifacts.

**Structured events** through `src/utils/structuredEvents.js` `emitTaskEvent` (synchronous, `:81-104`; with `exec`,
one pid is one session): `TASK_START { runId }`; one `PROGRESS` per phase (`identities`, `schema`, `graph-read`,
`relay-read`, `plan`, `write-creates`, `write-updates`, `write-moves`, `write-removals`) with counts and ms; `TASK_END
{ runId, outcome, reasonCode, confirmed, counts }` on every exit that is not a kill, preceded by `TASK_ERROR` when
refused or failed. The report, not the job result, is authoritative.

**Seams for Test Design** (the Tester owns the tables and files; registration in `test/registry.js`):

- *Contract suite:* R2-NB2 (an element whose first `d` is 256+ bytes followed by a valid `d` resolves under the valid
  one); R2-10 (a newer non-tagging whose over-long first `d` is followed by the tagging's `d` retires the edge); the
  `stamp` export; the status-line test (:805-807) re-aimed at the new BIBLE line.
- *Planner, stack-free:* **parity against `standingEdge`** over story 1's standing-rule truth table (the fixtures at
  `test/tagging-edge-contract.test.js:45-95`) — `current` as a stored row, `incoming` as the relay's state; resulting
  state equal for reasons `new`, `newer`, `same-version`, `retired-by-non-tagging`; exactly two documented divergences
  (`older-ignored` → the relay's state; `no-incoming` → removal), asserted as a closed set; `address-mismatch`
  unreachable; the fixed point (`decideAddress(written, sameRelay)` is `unchanged`). The **R2-NB1 table**: stored
  `createdAt` missing, `null`, `'abc'`, `'1000'`, NaN, FLOAT, `true`, a list, crossed with a relay version at the
  same id, a newer id and an older id — always an update or move to the relay's integer, never "keep stored". The full
  rule table, leave reasons, the tagging-address table (255 vs 256 bytes, empty `d`, upper-case hex, `:` and `\n` in
  `d`), resolution kept when an element vanishes and not kept when the stored `tagEventId` differs from `E`'s, moves
  never counted as removals, limit boundaries (base 500 with 50 and 51; 510 with 51; 600 with 60 and 61; 40 with 40),
  held vs applied; the base: 60 tagging-address rows plus 600 missing-address rows with an empty relay → 60 held;
  confirmed runs: base 7,030 / confirmed 6,435 / empty relay → 6,435 removed and 595 held; base 1,000 / confirmed 100
  / 60 others → applied (600 ≤ 900); base 1,000 / confirmed 100 / 91 others → held (910 > 900); an accepted edge plus
  a refusal at one scanned address, and two refusals → no action, counted; a stored list-valued key changed between
  the snapshot and the re-read → lost race; taggings with each stamp alone and both, the two identities different.
- *Identities:* each identity missing, empty, non-string, 63 / 65 characters, non-hex, upper-case, mixed-case; an
  upper-case env `TA_PUBKEY` → refused, source `env TA_PUBKEY`; a malformed conf value with a valid key-file pubkey →
  refused, source `brainstorm.conf`; conf absent with a valid key-file pubkey → proceeds; conf absent with an
  upper-case key-file pubkey → refused, source `secure-keys file`; no value anywhere → `missing`, source
  `brainstorm.conf`; a malformed canonical z string.
- *Strict reader:* the fake strfry on the PATH (`test/setup-status.test.js:520-549`) extended with modes `ok`,
  `fail` (exit 1 after printing events), `hang`, `truncated`, `logline`, `dup-id`, `off-filter`, `not-object`,
  `split-utf8` (a multi-byte `d` across two writes; output byte-exact), `signal`, `stderr-error` (captured and
  redacted), `too-large`, and strfry absent.
- *Runner with fake ports:* for each refusal and failure (identity, config, schema, graph read, relay read, plan, a
  report-write failure) **zero** write calls; the pessimistic record exists before the first write call; the graph read
  resolves before the scan is called; exactly one relay scan and no kind-5 scan; the generated `runId` matches
  `RUN_ID_RE`; an identity, config or schema refusal while a confirmation is pending leaves `confirmation.json`
  unclaimed, and the next pass honours it; a stale running record becomes previous; `--lock-busy` and a missing lock
  touch no file; snapshot conflicts with `tags_address` ONLINE → no action there, counted; with it gone → failed; a
  failed pre-image append → failed, `write`, with no write call for that batch; a verify re-read failure after
  committed batches → failed, `write`, `graph-verify`; a stop signal between batches → failed / stopped; held and
  confirmed flows (valid, expired, digest mismatch, report changed, absent); counters from committed attempts only.
- *Graph port, stack-free:* a fake session returning `neo4j.int(n)` counts, and the apply still succeeds;
  `applyLocked` awaits `preimage` before opening the transaction and refuses to run without one.
- *State:* atomic writes (a crash between temp and rename keeps the old file); of two concurrent claims exactly one
  wins; pruning, which never touches `preimages/`; pre-image appends fsynced; `readHeld` refuses a path outside
  `held/`; the digest's canonical form; `/proc/<pid>/stat` parsing with a process name containing spaces and
  parentheses, and a matching start time in state `Z` or `X` read as dead; the fdinfo lock line.
- *Routes:* no session → 401 (a `localTrusted` request included); admin → 403; non-owner → 403; foreign `Origin` →
  403; non-JSON → 415; on both the held and the confirm route, a `runId` that is a `../` traversal, the same with `/`
  encoded as `%2F`, an absolute path, or one with an embedded NUL → 400 with the injected `readFile` never called, and
  a well-formed `runId` that is not `latest.runId` → 404 (held) / 409 (confirm) with no held-file read; each 409
  writes nothing; the owner → record written and `runViaQueueAsync` called once with no `queryParams`; the withdraw
  race; `computeStatus` for alive, dead and absent, and a stored `running: true` with a dead process reads not
  running.
- *Channels:* `buildChildArgs(entry, …, { confirm: '1', limit: '0' })` → `[]`; `buildQueryParamsFromArgs({ confirm:
  true })` → `{}`; a `/api/run-task` start yields `confirmed: null` and removes nothing held.
- *Static sentinels:* registry fields (`arguments: false`, `staticArgs: ""`, `neo4j-heavy`, explicit `forceKill: true`,
  a `.sh` script, `script_relative_path` a substring of both entry paths); the seed disabled and daily, BK1 green;
  `tags_address` in both lists and last in the setup script; the boot hook called without `await`; the statement
  audit of `graph.js` (above) and `toWriteProps` keys ⊆ the nine with a `bigint` `createdAt`; the boot hook, given an
  injected runner, retries transient errors and `Security.Unauthorized` / `AuthenticationRateLimit` /
  `CredentialsExpired` within the window, stops on a schema client error and on a status-less error, and never
  rejects.
- *Live, local stack only:* read-only checks (`valueType` of a BigInt parameter is INTEGER and of a number is FLOAT;
  a `count()` read through `openGraph` and `toCount` is a JS number, and a stored list holding 2^53+1 reaches the
  fingerprint exactly; no Eager in `READ_ALL`'s plan; `schemaStatusFromRows`
  against real `SHOW` output). An **opt-in** write sandbox
  (`TAGGING_EDGES_LIVE_WRITE_TESTS=1`, skipped by default) on per-run fake pubkeys checked absent first, touching only
  its own fixtures and deleting only them: a second create at one address fails; the lock-first proof (an uncommitted
  change in another session makes `applyLocked` block, then report a lost race after commit); a move under the
  constraint; a FLOAT `createdAt` repaired to INTEGER; an existing fixture person's properties and `FOLLOWS` untouched
  after creates and moves (AC-8). No live test runs a full pass against the shared graph, and none publishes a tagging.
- *Evidence, not tests:* the owner-directed local end-to-end run on public taggings pulled into the local relay only
  (router streams off), with before/after FOLLOWS / MUTES / REPORTS counts and the existing end-people's
  `properties()`, and a second pass reporting nothing added, changed or removed; then the staging backfill, whose
  report reads `done` with `added = taggingsRead − refused.total`, followed by a clean second pass.

## Clarifications (Test Design, 2026-09-27)

Test Design validated the suites against a blind reference implementation and mutation testing (test plan
`engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.test-plan.md` § "Validation of the suite
itself"). That work found interface details this ADR left open. They are settled here so the Implementer and the
tests agree. Ratified by the owner at the Test Design gate (2026-09-27), including C2, C9 (`nostrUser_pubkey` need
only be present), C12 and C13 as written:

- **C1.** `deps.identities` is `{ canonicalZ(), getOwnerAssistantPubkey() }`; the second returns the result of
  `src/utils/assistantKeys.js`'s helper. The runner reads the env and conf sources itself, from `deps.env`. (The test
  uses the helper's own name, which the ADR names at :105.)
- **C2.** `run(deps)` resolves to the final report and leaves the exit code on `deps.proc.exitCode`:
  - 0 for done or held;
  - 2 for refused;
  - 1 for failed;
  - 0 for `--lock-busy`.

  It never calls `process.exit`. The `require.main` entry passes `process` as `proc`.
- **C3.** A start outside the lock emits TASK_START, TASK_ERROR and then TASK_END `{ outcome: 'not-started',
  reasonCode: 'not-started-under-the-lock', why }`, and touches no file.
- **C4.** `ensureTagsConstraint({ timeoutMs })`:
  - sends `CREATE_TAGS_CONSTRAINT` in its own auto-commit statement, and only when the rule is not present;
  - then re-reads the SHOW rows until the owned index is ONLINE or `timeoutMs` passes;
  - resolves to `schemaStatusFromRows`' answer from its last read;
  - rejects with the Neo4j error when the CREATE fails.

  The runner refuses `schema` unless `tagsAddress` is present and online.
- **C5.** Each apply resolves `{ applied, lostRace, nodesCreated, transientRetries, appliedAddresses }`, with
  `applied === appliedAddresses.length`. The report attributes `added`, `changedBy`, `removedBy`, `unresolved`,
  `strippedKeys` and `confirmed.removalsApplied` to those rows only.
- **C6.** Port row shapes:
  - `applyLocked(kind, rows)` takes rows `{ address, snapshot, desired }`; a removal has no `desired`.
  - `applyCreates` takes `{ address, desired }`.
  - The port computes `fingerprint(snapshot)` and `toWriteProps(desired)` itself.
  - `planPass` items are these rows; extra keys are ignored.
- **C7.** A failed verify re-read rejects `applyLocked` with `err.read === 'graph-verify'`; the runner copies it to
  `failure.read`.
- **C8.** Runner step 8 checks every snapshot row for the eight READ_ALL columns itself (`props` an array), whatever
  port supplied the rows.
- **C9.** `schemaStatusFromRows` returns `{ tagsAddress, nostrUserPubkey }`, each `{ present, online, name,
  underAnotherName }`.
  - `present` means the definition is listed.
  - `online` means its owned index is ONLINE.
  - The pass needs `tags_address` present and online, and `nostrUser_pubkey` present.
- **C10.** `handleConfirmHeldRemovals` reads the owner through an injected `getOwnerPubkey()`, defaulting to the
  configured `BRAINSTORM_OWNER_PUBKEY`.
- **C11.** The handlers make every read through the injected `readFile` (`readFileSync`-shaped; awaiting it works):
  `report.json`, `confirmation.json`, the held file and `/proc/<pid>/stat`. They pass it on to `isAlive(record,
  { readFile })`.
- **C12.** `confirmationPending` carries every field of the record except `nonce`, and may add derived keys such as
  `expired`. The nonce appears nowhere in the answer.
- **C13.** The confirm route mints `nonce` as 32 lower-case hex characters (`crypto.randomBytes(16)`). The name
  `claimed/<runId>-<nonce>.json` is then built only from checked grammars.
- **C14.** Each PROGRESS event names its phase as `metadata.phase`, using the report's `phases[].phase` names, with its
  `ms`. The events come in the ADR's nine-phase order.
- **C15.** Every rewrite of the record before the final report keeps `outcome: 'failed'`, `stopped: true`,
  `reasonCode: 'stopped'`, `running: true` and the run's `runId`. That covers each phase boundary and at least every
  10 write batches.
- **C16.** Within each write call, rows are ordered by the desired edge's `(from, to)`. The order is pinned only within
  a batch.
- **C17.** `readSchema()` and `readAll()`:
  - `readSchema()` returns `{ constraints, indexes }`, the SHOW rows as plain objects, and writes nothing.
  - `readAll({ timeoutMs })` runs READ_ALL in one `executeRead` with `{ timeout: timeoutMs }`.
  - It resolves to a plain array of rows keyed by the eight columns, with driver values untouched, so Integers stay
    lossless.
- **C18.** `strippedKeys` holds one entry per edge that lost a key, names only, for the first 100 such edges.
- **C19.** A start outside the lock (`not-started-under-the-lock`, runner step 1) exits **2** (refused), unlike
  `--lock-busy`, which exits 0: a hand run should say it did nothing.

## Out of scope

- The real-time path (story 3) and any control-panel page or button (story 4), except the bindings for story 3 above.
- Carrying revokes between instances (row `2026-09-27-revokes-do-not-travel`) and the UI revoke naming the address (row
  `2026-09-27-ui-revoke-names-id-only`).
- Cleaning test-fixture taggings off the relays; it will trip the limit and go through on a confirmed run.
- Who may start a task, and gating non-owner access to other admin mutations (intake 2026-07-21).
- Adding the schedule to existing instances' schedule files; the owner does that.
- A provenance marker or any other bookkeeping value on `TAGS`; a `TAGS.eventId` index.
- Converging the other strfry readers onto `scanStrict`, fixing the shared config reader's logging, and centralising
  the cross-origin posture (candidate rows above).
- Consolidating ADR 0015's server copies of the canonical literal, or moving it into a constants module.
- Any change to follows / mutes / reports ingestion, to any reader of taggings, to firmware, or to `protocols/`.
