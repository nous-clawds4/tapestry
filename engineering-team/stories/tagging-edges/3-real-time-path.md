# Story 3: The real-time path

**Status:** Approved
**Created:** 2026-09-28
**Type:** Feature

## Background

Story 2's gap-filling pass has been on production since 2026-09-28 (PRs #780 and #781). Run on demand or on a
schedule, it brings the graph's `TAGS` relationships into agreement with this instance's relay. Staging's backfill
ran at 13:09Z that day: 7,023 added, equal to the 7,023 taggings it read with none refused, and its relay and graph
both held 7,023 at 13:29Z. Production had not run its backfill at 13:29Z; its relay holds 7,030. Between passes,
nothing writes `TAGS`: a tagging made now waits for the next pass. Staging and production have no schedule entry
for the pass, and fresh installs seed one that ships disabled. This story makes a tagging change show up in the
graph within a minute of the relay storing it. The pass stays the backstop for what real time cannot see.

**Why the follows pipeline's real-time leg cannot carry taggings.** Its feed is a hook compiled into the relay
software. The hook pushes only kinds 3, 10000 and 1984, and only from some of the relay's write paths: a client
publishing straight to the relay's websocket is stored but never queued (ledger row
`2026-09-27-strfry-redis-misses-websocket-writes`). The leg also loses any event whose Neo4j write fails (row
`2026-09-27-stream-consumer-at-most-once`). Extending it would rebuild the relay on every host and inherit both
defects. The owner's acceptance frame asks for every way an event can reach the relay.

**How taggings reach this instance's relay** (read-only orientation, 2026-09-28):

| Way in | Who uses it |
|---|---|
| A client publishing to the relay's websocket (`wss://<host>/relay`) | other nostr clients; remote relays syncing or routing up to this one |
| The instance's own publishes | the UI's tagging and revoke (which also go to five outside relays); the Assistant's identification taggings |
| Router streams | production, staging and tags pull taggings from the dcosl relays (`nostrUserTag`, both directions, `#z`-filtered; on tags an unfiltered `dcosl` stream carries them too). They are live only: whatever is published upstream while a router is down, which includes every deploy, never arrives this way |
| Negentropy sync, import | operator-run; brings history with its original, possibly old, `created_at` |

Whatever the way in, the relay applies the same version and deletion rules; only its acceptance checks, such as the
time window, differ a little. The newest version at an address stands. A kind-5 from the tagging's own author
removes it, by event id or by address (for versions no newer than the kind-5). It also blocks that id, or those
versions at that address, from being stored again. So an id-only revoke lets an older version with another id be
stored again. A kind-5 from anyone else removes nothing.

**What can be observed, and what cannot:**

- A new or replacing version arrives as a new event on the relay.
- A revoke is observable only as its kind-5 event; the removal it causes emits nothing. The UI's revoke names the
  tagging by event id only (row `2026-09-27-ui-revoke-names-id-only`), so once the relay has acted on it, nothing
  on the relay names the address any more.
- A version and its revoke that reach the relay together (one import or sync batch, or within the relay's ~100 ms
  change notice) are never announced as a version: the relay announces only the kind-5.
- Some ways a tagging leaves the relay emit nothing at all: the owner's relay wipe, an operator's delete, a NIP-40
  expiry.
- Kind-5 events that are not tagging revokes look alike: unpins, an assistant's curated-list copies, ordinary
  deletions. Production holds 9,341 kind-5 events. None of them carries the content "revoked", a `k 39999`, a
  `39999:` address, or an `e` naming a tagging the relay holds; 755 of them carry the UI revoke's single `e`.
- `created_at` is not arrival time: a sync can store years-old history today.

**Volumes** (2026-09-28, by `created_at`):

- **Taggings on production:** 7,030 in all, 6,435 of them test fixtures. Real taggings are dated about five a day (157
  in 30 days).
- **Bursts, nearly all fixtures:** the busiest day had 739 taggings (2026-07-18, 738 of them fixtures), the busiest
  hour 164, the busiest minute 36.
- **Kind 5 on production:** 9,341 in all, 0 in the last 7 days.
- **Revokes:** among the public hosts, tagging revokes have been seen only on tags.brainstorm.world: 27, all in the
  UI's shape, none in the last 30 days.

**What the owner will see.** The path ships turned off on every instance. Once the owner turns it on, a tagging
change that reaches this instance's relay, by any way in, shows up in the graph within a minute. After a deploy or
an outage, the path catches up within 5 minutes on whatever the relay stored meanwhile (up to 10,000 changes; a
larger backlog takes longer, item 6). It cannot catch what never
reached the relay: the router brings nothing that was published upstream while it was down, which includes every
deploy, and a revoke made on another instance does not travel here.

**The order on each host:**

1. Run the backfill.
2. Turn the path on.
3. Run one more pass.

The path reflects only what changes after its first start (AC-4), so that last pass settles anything that changed
between the backfill and the switch. A tagging that leaves the relay with no event about it still waits for a
pass, so also add and enable the pass's daily schedule entry (OPERATIONS §12.8).

## User-facing description

As the owner of a Tapestry instance, once I turn it on I want every tagging change that reaches my relay to show
up in my graph within a minute, whichever way it arrived: a new tagging, a flipped stance, a tagging moved to
another person, a revoke. It should catch up by itself after a deploy or an outage, without my running anything.
Then "Alice tagged Bob as a Podcaster" is in my graph within a minute of reaching my relay, not at the next pass.

A few cases wait for the next pass:

- a removal the relay makes with no event, such as a wipe or an expiry;
- a newer version revoked by its id at once (in one import or sync), or while the path was not running, a deploy
  included;
- whatever reached the relay while the path was down, if the path has lost its record of where it left off.

## Acceptance criteria

"The path" is the real-time path this story adds; "on" means the owner has turned it on (AC-5). "The relay", "the
definition" (story 1's contract, ADR `tagging-edges/0001`) and "a pass" (story 2's gap-filling pass) are as in
story 2. The other terms:

- **Stores.** The relay "stores" a tagging when it writes it and holds it as the current version at its address.
- **Deletion and revoke.** A "deletion" is any kind-5 (NIP-09) event; a "revoke" is a deletion from the tagging's
  own author that the relay acts on.
- **Removal.** A "removal" is the path removing a relationship at a tagging address and writing none in its place;
  a move (AC-1) is a change, not a removal. A tagging the relay drops "leaves the relay".
- **Accepted version.** An "accepted version" is one the relay holds and the definition accepts (story 2 AC-3).

Each criterion holds for taggings from any author: test fixtures, self-taggings, disputes, a neutral "0" and an
absent stance included, carrying the canonical stamp, this deployment's own, or both.

- [ ] **AC-1: a tagging the relay stores shows up within a minute, whichever way it reached the relay.**
  - **Given** the path is on and the graph and the relay are available, whether or not a pass is running,
  - **when** the relay stores a tagging, whatever its `created_at` (history included) and by any way in: a
    client's websocket publish, the instance's own publish, a router stream, a negentropy sync or an import,
  - **then**, within 1 minute, the relationship at its address equals what the definition gives for the relay's
    current version there. It is:
    - **created** if absent, adding any missing person once (keyed by pubkey, with no other property; story 2
      AC-1);
    - **updated** when the relay's version differs from the recorded one, such as a flipped stance or a new version
      whose tag now resolves;
    - **moved** when the tagged person changed, leaving no relationship at the old person.

  **A tag named only by id.** A tagging that names its tag only by event id takes the tag's address and slug when
  the relay then holds a usable tag element with that id. Otherwise it is written unresolved, unless the
  relationship already holds a resolution for that same version, which is kept (ADR 0002's same-version rule). The
  first pass after the element arrives resolves it (story 2 AC-1).

  **The relay's version decides.** The relationship follows the relay's current version at the address, never
  merely the event that arrived. If the relay removes that version again with nothing the path can tie to its
  address, AC-3's rule applies instead (Out of scope, "Removals with no event the path can tie to the tagging").

  **Bursts.** A burst of up to 10,000 changes (taggings and deletions together, all stored within one minute, as
  one import or one sync can bring) is reflected in full within 5 minutes of the last one stored, and none is lost.
  For a change in such a burst, this bound replaces the minute of AC-1 and AC-2. A larger burst is still reflected
  in full, with nothing lost, but not within the 5 minutes (item 12).

  *(Amended at Architecture, 2026-09-28, owner decisions 5, 9 and 10 of ADR `tagging-edges/0003` § "Owner decisions needed at this gate": the corners that wait for the
  pass, the scale ceilings and the backlog cap, and a stalled subscription or an unresponsive Redis.)*
- [ ] **AC-2: a revoke shows up within a minute; the relay decides, and a deletion only prompts a look.**
  - **Given** the graph holds a relationship at an address a deletion names, directly or through the event id the
    relationship records,
  - **when** the relay acts on that deletion (a revoke, by any way in),
  - **then**, within 1 minute, the relationship is removed. If the relay then holds another accepted version at
    that address (an older version re-sent after an id-only revoke), the relationship follows that version instead
    (story 2 AC-2).

  **A look, never a verdict.** What the relay holds at the address after the look decides. A relationship stays
  while the relay holds an accepted version there, and follows that version. These remove nothing (a look one of
  them prompts can still bring a relationship up to the relay's accepted version there, as above):
  - a kind-5 from another author, even when the relay no longer holds the tagging for some other reason (that
    removal waits for the pass, AC-3);
  - a kind-5 that names neither an address the graph holds nor an event id a relationship records;
  - a kind-5 that is no tagging revoke: an unpin, a curated-list copy's deletion, an ordinary note deletion.

  **No count limit** (owner decision): a burst of legitimate revokes goes through, within AC-1's burst bound.

  *(Amended at Architecture, 2026-09-28, owner decisions 2, 3, 9 and 10 of ADR `tagging-edges/0003` § "Owner decisions needed at this gate": a revoke is the tagging's
  author's deletion under strfry's rule applied to the recorded version; only the author's kind-5 prompts a look; a
  bulk revoke of N of one's own taggings counts as N changes; and the residuals beyond the minute.)*
- [ ] **AC-3: a failed read, an unavailable graph, a bad setup or a crash loses nothing and removes nothing
      wrongly.**
  - **Failed or incomplete read.** Given a read the path depends on fails or comes back incomplete (an error, no
    answer in time, an answer cut short or unreadable), then the path changes nothing for that tagging, and other
    changes proceed meanwhile. The change is reflected within 5 minutes of the relay answering that read in full
    again.
  - **Unavailable graph.** Given the graph is unavailable (a restart, an outage, a transient error), then pending
    changes wait and are applied once it is back (within AC-4's bound). None is dropped.
  - **A change the database keeps refusing.** Given the database refuses one change with the same non-transient
    error every time, then that change is counted by reason (AC-6), and every other change is still reflected
    within AC-1's minute.
  - **Concurrent writer.** A relationship another writer changed between the path's read and its write is not
    overwritten, and that tagging is reflected per AC-1 within 1 minute of the race.
  - **Bad setup.** The setup is bad when either stamp identity (the canonical `nostr-user-tag` stamp's pubkey or
    this deployment's own) is missing, empty, not 64 hex characters or has an upper-case letter, from whatever
    source the path reads it. It is also bad when the one-per-tagging rule `tags_address` is not present and
    online, or `nostrUser_pubkey` is not present. Then:
    - the path writes no relationship and adds no person;
    - its status says which one is wrong;
    - pending changes wait as they do while the graph is unavailable.

    Once a database rule is in place, the path resumes by itself with no restart, within AC-4's bound. A corrected
    identity takes effect at the latest after a restart, and AC-4's bound then runs from that start.
  - **What a removal needs.** The path removes a relationship only in answer to an event about that tagging:
    - a new version stored at its address;
    - or a deletion from the tagging's author naming its address or the event id its relationship records.

    It then removes only when a successful read of the relay at that address, taken after the event, finds no
    accepted version there. A failed or incomplete read never leads to a removal, and neither does a read that no
    such event prompted: a read of everything that comes back empty (after a relay wipe, say) removes nothing. A
    tagging that leaves the relay with no such event keeps its relationship until the next pass, whose limit
    applies (story 2 AC-5), or until an event about that tagging arrives.

  *(Amended at Architecture, 2026-09-28, owner decision 5 of ADR `tagging-edges/0003` § "Owner decisions needed at this gate": the crash corners of about 250 ms and before
  the first record is written.)*
- [ ] **AC-4: after downtime it catches up by itself within 5 minutes; no start ever backfills.**
  - **Given** the path has run on this instance before,
  - **when** it runs again after any downtime (a deploy, a restart, a crash of the path, the graph or the relay
    being unavailable, a bad setup (AC-3), or the owner turning it off and on),
  - **then**, with no operator action or pass, within 5 minutes of the latest of these:
    - the path's crash;
    - the instance starting;
    - the owner turning it back on;
    - the graph and the relay both being available again;
    - a database rule the path was waiting on (AC-3's bad setup) being in place;

    the graph reflects the downtime:
    - every tagging the relay stored meanwhile has its relationship per AC-1, history with an old `created_at`
      included;
    - every relationship whose tagging a revoke removed meanwhile is gone per AC-2.

    Two exceptions wait for the next pass (item 7): a lost record (below), and a version the graph never recorded,
    stored and revoked by id while the path was not running (Out of scope).

  **Size of the backlog.** The 5 minutes covers up to one burst's worth stored meanwhile (10,000 taggings and
  deletions); a larger backlog is still reflected in full, with nothing lost (item 6).

  **A lost record.** If, after its first start, the path finds its record of where it left off missing or
  unreadable, it does not treat the start as a first start. Its status says the catch-up could not be
  established, and what the relay stored during the gap waits for the next pass.

  **Given** the owner turns the path on for the first time on an instance, **then** it acts on what the relay
  stores from then on (new, replacing or re-sent versions) and on revokes. The path never creates a relationship
  for a version the relay has held continuously since before that first start, at that start or any later one.
  That holds even when a deletion or a catch-up leads the path to read its address: creating it is the
  owner-started pass's job (the backfill; item 8). A relationship the graph already holds at such an address still
  follows the relay's version when a look is prompted (AC-2). Anything the relay stores after the first start, a
  re-sent older version included, is reflected per AC-1.

  *(Amended at Architecture, 2026-09-28, owner decisions 5, 9 and 10 of ADR `tagging-edges/0003` § "Owner decisions needed at this gate": the corners that wait for the
  pass, including changed identities; the catch-up's scale ceilings; and an unresponsive Redis.)*
- [ ] **AC-5: it runs on its own, and alongside the pass.**
  - **Off by default; owner switch.** The path ships turned off on every instance, fresh installs included. The
    owner turns it on and off per instance from the instance itself, without a shell; any session that is not the
    owner's is refused and changes nothing. The choice survives restarts and deploys.
  - **Off means off.** Within a few seconds of the owner turning it off (the ADR states the bound):
    - the path writes nothing more (a transaction already committing may finish);
    - any catch-up under way stops;
    - its status says off.

    Turning it on again catches up (AC-4).
  - **Recovers alone.** While on, the path starts with the instance and recovers from a crash by itself within
    AC-4's bound, however long the graph or the relay takes to come back. Repeated failed starts never leave it
    stopped.
  - **Independent of follows.** Turning it off, or its failing, never stops or delays follows / mutes / reports
    streaming, and theirs never stops it.
  - **Alongside the pass.** A pass started while the path runs is never refused or skipped because of it, and a
    pass never stops the path. When both act on the same tagging, the graph at that address never goes back to an
    older read of the relay than one already reflected there. The exceptions are the two interleavings ADR 0002
    accepts (a tagging changed and revoked inside one pass's read-to-write window), which the next pass repairs.

  *(Amended at Architecture, 2026-09-28, owner decisions 9 and 10 of ADR `tagging-edges/0003` § "Owner decisions needed at this gate": past the heap ceiling the path
  cannot keep up, and a Redis that accepts no connection stalls every relay read. The path itself repairs both
  interleavings within about a minute of the pass ending.)*
- [ ] **AC-6: the owner can read its status.**
  - **Where.** The owner reads it on the instance, without a shell or logs, and it survives restarts and deploys.
    When the owner reads it, every figure covers the path's work up to at most 1 minute earlier.
  - **What it shows:**
    - whether the path is on and running, and since when;
    - when it last read the relay successfully;
    - whether a catch-up is under way, and how the last one ended (when, how long, how much it reflected), or that
      one could not be established (AC-4);
    - when it last reflected a change;
    - counts since it was first turned on:
      - relationships added, changed (moves included), removed and unchanged;
      - people added;
      - versions the definition refused, by reason;
      - relationships left in place (AC-7: a `TAGS` relationship whose `address` is missing or not a tagging
        address);
      - deletions that matched no relationship;
      - failed reads;
      - lost races (a change another writer made first; AC-3);
      - changes the database kept refusing, by reason;
    - the setup problem it is waiting on, if any (AC-3);
    - its last error.
  - **What it never shows:** a credential, or the address the database or the relay is reached at (a URI, a host
    name, an IP address or a port), error text included.
  - **Separate from the pass's report.** The status sits beside the pass's report without changing it; story 4's
    page reads both.
- [ ] **AC-7: nothing else moves.**
  - **Other graph data.** Given the path runs, every node and relationship other than `TAGS` relationships and the
    people it adds is identical before and after: FOLLOWS, MUTES, REPORTS and every existing person's properties,
    scores included.
  - **What it writes.** Every relationship the path writes carries exactly the properties the definition gives
    (the nine; ADR 0001 as amended by ADR 0002 A2), and no bookkeeping value. Never a trust score, count, rank,
    tag name, bucketed stance or "applied" flag, and nothing named `timestamp`.
  - **What it removes.** It never removes a person, or any relationship except a `TAGS` relationship at a tagging
    address. A `TAGS` relationship whose `address` is missing or is not a tagging address is left in place
    (story 2 AC-3).
  - **Other systems.** These are unchanged:
    - the follows / mutes / reports stream (its relay-side hook, queue and consumer);
    - the pass's report, held lists and confirmations.

    A scoring run, or a follows / mutes / reports write, does not fail because of a real-time write, apart from any
    residual the owner accepts at the Architecture gate.

### Docs tasks

The Reviewer checks these against the diff, not with tests. Story 2's review carry-forwards
(`reviews/tagging-edges/2-gap-filling-pass-and-backfill.md` § "Carry-forwards", placed here at the owner's direction)
are CF-1 to CF-6; the orientation sweep of 2026-09-28 found the extra places each one names.

- [ ] **BIBLE.**
  - §6's `TAGS` status line names the real-time path and drops "the real-time path … is not built yet" (:320).
  - §6's Revokes bullet says the path follows the same rule (a deletion prompts a look at the relay, never a
    removal by itself), and that removals the path cannot tie to an event (Out of scope, "Removals with no event the
    path can tie to the tagging") wait for the next pass.
  - §4's services and supervisord rows, if the path adds a process.
  - §11: its routes.
  - A §16 entry.
  - The Last-updated line.
- [ ] **OPERATIONS.md:**
  - how to turn the path on and off per instance;
  - what its status says;
  - what a deploy does to it;
  - the order on staging and production:
    1. run and check the backfill (story 2 § Evidence);
    2. add the daily `reconcileTaggingEdges` entry in Scheduled Tasks and enable it (the fresh-install seed ships
       disabled, and existing hosts have none);
    3. turn the path on;
    4. run one more pass;
  - that a tagging leaving the relay with no event (a wipe, an operator's delete, an expiry) waits for the next pass,
    so a scheduled pass is the backstop once the owner has added and enabled one.
- [ ] **The epic** (`engineering-team/epics/tagging-edges.md`): the stamp-pubkey guardrail's "its mass-delete guard
      counts every removal per run" says the limit is the pass's (owner decision 4), matching the ADR's amendment of
      ADR 0001's R2-NB3 bullet.
- [ ] **The handoff** (`docs/TAGGING_EDGES_HANDOFF.md`):
  - its Status line: story 2 shipped 2026-09-28; story 3 in progress.
  - §3's story-3 paragraph says what its precedent, `nostr-search/src/ingest.js`, actually does: it keeps no
    high-water mark, sends no `since` and persists nothing; its reconnect waits a constant 1 s; and its resync returns
    at most 500 events.
  - Ledger row `2026-09-27-strfry-redis-misses-websocket-writes`, fix shape (b), gets the same correction. It also
    recommends a `since` replay: a `since` replay compares `created_at`, so it drops back-dated history, and
    recovery needs a re-read that does not filter by `created_at`. Update its drifted BIBLE cite too (§13's diagram
    is now at :936).
- [ ] **CF-1:** "no config value, absolute path or credential", unqualified, appears in:
  - `src/api/index.js:516-517`;
  - the story-2 test plan's coverage row :91;
  - three test titles: `test/strfry-scan-strict.test.js:670` (SS28), and `test/tagging-edges-runner.test.js:1607`
    (SR63) and :1673 (SR65);
  - the story-2 test plan :113 ("no absolute path").

  Qualify "absolute path" as ADR 0002 now does ("no absolute path that starts a word"), and settle "config value"
  per CF-3 in the same edit.
- [ ] **CF-2:** ADR 0002 :470-471, "A refused start never reaches the claim and changes nothing (AC-4)": a `schema`
      refusal can leave the pass's own `tags_address` in place, as OPERATIONS :731 says.
- [ ] **CF-3:** "No config value" is broader than the redactor: `neo4j.internal:7687` and `[::1]:7687` pass it
      unchanged when the error code is outside the two connection codes, though no current source emits either.
      Qualify the ten places, or widen the rule with a test:
  - BIBLE.md:657;
  - ADR 0002 :546-547 and :774;
  - `src/api/index.js:516`;
  - `src/api/tagging-edges/index.js:13`;
  - the story-2 test plan :91;
  - the titles of SS28 (`test/strfry-scan-strict.test.js:670`), and of SR63, SR64 and SR65
    (`test/tagging-edges-runner.test.js:1607`, `:1641`, `:1673`).

  AC-6 holds this story's status to its rule as written; the "qualify" option applies only to story 2's places.
- [ ] **CF-4:** the hand-run wording lacks the lock-file qualifier (story 2's review item R2-9) in:
  - ADR 0002 :857 ("cannot write");
  - the runner header :8 (round 3 fixed only BIBLE and OPERATIONS);
  - the runner comment :221;
  - story 2 :332.
- [ ] **CF-5:** story 2's round-1 Deviation note (:330-332) restates the old wording in the present tense; fix the
      odd wrap at :326-328.
- [ ] **CF-6:** story 2's Evidence and OPERATIONS §12.8's local-run line mention the local empty pass
      `20260928T032350Z-fa59e6da` (0 events, 0 rows) that ran before the backfill.

## Concepts touched

- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag`: nostr user tag, canonical
  stamp (the ADR 0015 literal). Its elements are the taggings this path reflects.
- `39998:<TA>:nostr-user-tag`: nostr user tag, this deployment's own stamp (TA resolved at runtime; locally
  `39998:8387ec0e9a1796d628688633c759ee5e3fb86587630beb03166e4e333a9a294f:nostr-user-tag`).
- `39998:<TA>:tag`: tag, the tag elements an id-only tagging names. The canonical stamp
  `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag` sits alongside.
- `39998:<TA>:nostr-user`: nostr user, the relationship's two ends; the path adds any that are missing.
- NIP-09 deletions (kind 5): not a concept in the graph. They are read only as prompts to look at the relay.

## Out of scope

- **The backfill.** Versions the relay held when the path was first turned on are the owner-started pass's (AC-4).
- **Removals with no event the path can tie to the tagging.** These all wait for the next pass (AC-3):
  - a relay wipe, an operator's delete, an expiry;
  - a newer version that the relay deleted by id before announcing it to subscribers. That happens while the path
    was not running, or when the version and its revoke reach the relay in one write batch (a single import or sync
    run can carry both) or within the relay's ~100 ms change notice. The relay then announces only the kind-5, which
    names an id no relationship records, and nothing on the relay names the address.
- **A version at a tagging's address that the definition refuses** (for example a republish carrying neither stamp)
  is removed by the next pass (story 2 AC-3). The path need not reflect it; if it does, it follows the definition
  and AC-3's removal rule.
- **An id-only tagging whose tag element arrives later.** The first pass after the element arrives resolves it
  (story 2 AC-1).
- **Relationships removed from the graph by other means** (the owner's "delete all relationships" action, a restored
  backup): the next pass rebuilds them. The path reflects only what reaches the relay.
- **Revokes between instances** (row `2026-09-27-revokes-do-not-travel`), and **router streams' gaps** across deploys
  and outages. The path reflects what this relay stores; getting events onto the relay is the router's and sync's
  business. Also out: the UI revoke naming the address (row `2026-09-27-ui-revoke-names-id-only`).
- **tags.brainstorm.world:** it deploys from its own branch and has neither story 2 nor this path.
- **The control-panel page (story 4):** status display, drift figure, a pass on demand. This story supplies the
  on/off control and the status the page will use (items 10 and 11).
- **The follows / mutes / reports real-time defects** (the websocket gap, at-most-once delivery, the Redis client
  that never reconnects): rows `2026-09-27-strfry-redis-misses-websocket-writes`,
  `2026-09-27-stream-consumer-at-most-once` and `2026-09-27-strfry-redis-never-reconnects`.
- **The pass's own open rows** (`2026-09-28-lock-check-accepts-any-flock`,
  `2026-09-28-confirm-route-joins-finishing-job`, `2026-09-27-stale-heavy-lease-after-deploy`), unless the design
  touches what they describe (For the Architect).
- **Other deferred items**, as in story 2:
  - cleaning test-fixture taggings off the shared relays;
  - who may start a task;
  - a provenance marker;
  - importing taggings or tag elements as event nodes (OPEN.md row 136 stage 2);
  - checking event signatures: that is the relay's job; the unverified import path is OPEN.md row 276 (F3), which this
    story does not widen;
  - any change to a reader of taggings.

## Open questions

Settled by the owner at Planning (2026-09-28):

1. **Within 1 minute** for a single change while the graph and relay are available (AC-1, AC-2).
2. **The path catches up by itself** after downtime, within 5 minutes, without waiting for a pass (AC-4).
3. **Its first start never backfills.** The existing taggings wait for the owner-started pass (AC-4).
4. **No count limit on real-time removals.** Each one answers a deletion and follows a successful read at that
   address (AC-2, AC-3).
5. **It ships turned off** on every instance; the owner turns it on per instance (AC-5).

Clarifications of those decisions (items 6–9) and proposals (items 10–15), confirmed by the owner as written at
approval (2026-09-28):

6. **Decision 2, size.** The 5 minutes covers up to one burst's worth stored during the downtime (10,000 taggings and
   deletions). A larger backlog is still reflected in full, with nothing lost, but not within the 5 minutes. If a
   bound is wanted for more, name it (for example 5 minutes per 10,000).
7. **Decisions 1 and 2, two exceptions.**
   - **A version deleted before it is announced.** A newer version that the relay deletes by id before announcing it
     waits for the next pass. That happens while the path was not running, or when the version and its revoke reach
     the relay in one import or sync batch or within the relay's ~100 ms change notice. The deletion names only an id
     the relay no longer holds and the graph never recorded, so nothing ties it to the address. The older
     relationship stays until the next pass (AC-1, AC-4, Out of scope).
   - **A lost record.** If the path finds its record of where it left off missing or unreadable, its status says the
     catch-up could not be established. Whatever the relay stored during that gap waits for the next pass (AC-4).

   On staging and production, the next pass is an owner-started one until a schedule entry is added; on fresh
   installs, it is one until the owner enables the seeded entry.

   *(Amended at Architecture, 2026-09-28: owner decision 5 of ADR `tagging-edges/0003` § "Owner decisions needed at this gate" lists every corner that waits for the pass.)*
8. **Decision 3, every start.** The no-backfill rule holds at every start, not only the first. No catch-up creates a
   relationship for a version the relay has held since before the first start.
9. **Decision 4, what may prompt a removal.** A removal answers one of two events: a new version stored at the
   address, or a deletion from the tagging's author naming its address or the event id its relationship records. It
   also needs a successful read of the relay at that address, taken after the event, that finds no accepted version
   there (AC-3). So a wipe, a failed read, a read that no such event prompted (even one that comes back empty), or
   another author's kind-5 removes nothing in real time.

   This reaches one case beyond decision 4's wording. AC-3 also lets the path remove a relationship in real time when
   the new version at the address is one the definition refuses: for example, one that carries neither stamp, names
   no person or several people, or names no tag. The story does not require that removal; the next pass makes it
   (Out of scope). When the path does make it, there is no count limit. Confirm that, or bound it.

10. **An owner-only on/off control, with no page, is part of this story.** Otherwise, with the path shipping off,
    turning it on (and the staging evidence) would need a shell until story 4.
    - Until then, the owner uses it signed in, from a browser on the instance, the way story 2's held-removal
      confirmation is made (OPERATIONS §12.8); the ADR picks the form.
    - On approval, the Planning commit updates the epic, as story 2's did: story 3's entry names this file and takes
      the on/off control, and story 4's entry drops start / stop.
11. **The status is a public read**, like story 2's (the house convention for status GETs).
    It carries what AC-6 lists (the path's on/off and running state, times, counts, the setup problem it waits on,
    and error text), with nothing AC-6 excludes.
12. **A burst bound:** up to 10,000 taggings and deletions stored within one minute, reflected in full within 5
    minutes (AC-1, AC-2). A larger burst is still reflected in full, with nothing lost, but not within the 5
    minutes; if a bound is wanted for more, name it (as in item 6).
13. **The relay software stays as shipped** (no strfry patch or rebuild). The Background's reasons: a rebuild on
    every host, and the follows hook's two defects. The acceptance frame requires only that follows / mutes /
    reports ingestion be unchanged, so this is the owner's call.
14. **Evidence:**
    - the suite's fixtures;
    - a local end-to-end run:
      - a tagging and a revoke through each local way in: a websocket publish to the relay, `POST
        /api/strfry/publish` called directly (never the UI's tag or revoke buttons, which also publish to five
        outside relays), and an import (the router and sync write through the same writer, though import skips the
        relay's time window);
      - a back-dated tagging, within 6 years so it also stands for the router and sync;
      - catch-up after a stop, and after Neo4j is down;
      - the time from store to relationship, measured for each;
    - staging, after its backfill (done 2026-09-28 at 13:09Z):
      - the owner turns the path on, then runs one more pass, which may add, change or remove relationships for
        whatever changed between the backfill and the switch;
      - over the following days, organic taggings show up, the next deploy shows a catch-up in the status, and the
        status shows no failures;
      - a later pass reports no addition, change or removal that a before-and-after read of the graph cannot trace
        to an Out-of-scope case;
      - AC-2, AC-3 and the one-minute timing are evidenced by the local run.
15. **One story, not split.** Seven criteria is past the planning guide's ~5. They stay together because a real-time
    writer without its failure rules (AC-3) and catch-up (AC-4) would repeat the follows leg's lost events, and one
    without its switch and status (AC-5, AC-6) could not be turned on or checked. There is no clean seam: AC-3's
    reporting and the staging evidence both rely on AC-6's status.

For the Architect (the ADR must settle these; if one would change a criterion, kick back to Planning):

- **Bindings.** ADR `tagging-edges/0002` § "Binding for story 3":
  - write `TAGS` only through `src/pipeline/tagging-edges/graph.js` (pre-image; lock, re-read, verify, act;
    create-if-absent; a uniqueness refusal is a lost race);
  - read the graph first, then strictly re-read the relay at the address, filtered to the identity `d`; for an
    id-only tagging, also read the element it names; the same-version rule keeps an existing resolution when the
    element is gone;
  - decide with `decideAddress` and never order versions;
  - a websocket REQ result is a trigger, never state;
  - a kind-5 is a trigger to re-read what `revokeTargets` names, plus the addresses of relationships whose
    `eventId` it names;
  - do not write `report.json` (the status goes beside it); never take the pass's lock exclusively.

  ADR 0001's "Binding for later stories" (as amended by 0002) names the real-time path too: both stamp pubkeys must
  be lowercase 64-hex (AC-3's bad setup). Any `tags_eventId` index rolls out through the same boot hook and both
  expected-rule lists; the static audit of `graph.js` (SWR14) rejects a `CREATE INDEX` among its statements.
- **The removal limit.** ADR 0001's R2-NB3 bullet ("subject to the mass-removal limit") and the epic's guardrail are
  worded for every writer. Owner decision 4 gives the path's removals no count limit, so the ADR amends R2-NB3 to
  say the limit is the pass's (the epic line is a docs task). "Decide with `decideAddress`" lets the path hold back
  an action it returns: a removal AC-3 does not allow, or a create AC-4 leaves to the backfill. It never takes a
  different action.
- **What the relay does and does not tell a client** (orientation, 2026-09-28; strfry 1.1.0 source in the container):
  - **Live delivery.** A live subscription sees new events from every writer, the other processes' included,
    within about 1–2 s of the event reaching a writer. That figure comes from the source, not a measurement: the
    import, sync and router writers wait up to 1 s before committing, the websocket writer does not, and the
    relay's watcher adds about 100 ms. Within one connection, a subscription's stored replay and its live part leave
    no gap; gaps arise only across reconnects.
  - **Removals and replacements** emit nothing.
  - **No arrival-order cursor.** `since` compares `created_at`, so a `since` resume silently drops back-dated
    history, and a live subscription opened with `since` never delivers it either. NIP-77 negentropy is enabled
    (`maxSyncEvents` 10,000,000; a `NEG-OPEN` filter is not capped at 500, `RelayIngester.cpp:283`), so a client
    holding its own id set can learn which ids it lacks, back-dated ones included.
  - **Limits.** A subscription's stored replay is capped at 500 per filter; at most 200 filters per request, 3 tag
    keys per filter and 131,072-byte frames.
  - **Where it listens.** The relay listens only inside the container (`127.0.0.1:7777`); the public `/relay` path
    drops a silent connection after 60 s.
  - **Deploys.** A deploy re-creates the container: relay, router and every process restart.
  - **The consequence for AC-4:** it has to be met without an arrival cursor, and without any start becoming a
    backfill.
- **Deletion shapes:**
  - **UI revokes and unpins.** The UI's revoke is kind-5 with one `e` and content "revoked"; unpins carry the same
    tags with content "unpinned".
  - **Curated-list copies.** A curated-list copy's deletion carries one `a` (`39999:<assistant>:copy-<hash>`), an
    `e` per version and `k 39999`. It is signed by the curating user's assistant: this instance's TA when the owner
    curates, another key otherwise (`src/api/dlist-curation/update.js:360`, `updateEvents.js:79-100`). Ordinary
    deletions name events by `e` or `a` too.
  - **Shape and author tell nothing.** Neither a kind-5's shape nor its author says whether it names a tagging;
    only a read of the relay or the graph does.
  - **Another author's kind-5.** A cross-author `e` kind-5 is stored but not honoured; a cross-author `a` kind-5 is
    refused.
  - **An id the graph never recorded.** A kind-5 can name an id the graph never recorded, and after the relay acts,
    the relay no longer holds it either.
- **The in-stack precedent is thin.** `nostr-search/src/ingest.js` keeps nothing durable (docs task above).
  tag-applicability ADR 0003 rejected a server-side subscription, for a different goal.
- **What the pass's port lacks for a second caller:**
  - no per-address read method (`READ_AT` runs only inside the locked write);
  - no lookup by `eventId`, and no index for one;
  - the pre-image recorder is a closure inside the pass's runner, and `appendPreimages` accepts only the pass's
    run-id grammar;
  - within a write call, rows are ordered by `planPass`, not by the port (C16).
- **Throughput.** Locally a strict per-address scan took about 35 ms and an element read about 26 ms, each one
  `strfry scan` process. Staging's backfill scanned the whole relay in 3,024 ms, against 67 ms for the local
  backfill's, so a host may be slower. The ADR shows how AC-1's burst bound and AC-4's catch-up bound are met.
- **Scoring and the follows consumer.** ADR 0002 D10 put the pass under `neo4j-heavy` because its writes lock the
  NostrUser end nodes that scoring rewrites, in 10,000-row statements with no `ON ERROR`. Its Risk 7 accepts that the
  follows consumer (auto-commit, no retry) drops an event whose write loses a deadlock. The path cannot wait on that
  lease and still meet AC-1. The ADR says how real-time writes avoid failing a scoring statement or a consumer write,
  or names the residual and how rare it is, for the owner to accept at the Architecture gate (AC-7).
- **Process and credentials:**
  - A program started by the supervisor inherits `NEO4J_PASSWORD` but not `NEO4J_URI` / `NEO4J_USER`.
  - The shared config reader logs the values it reads (row `2026-09-27-config-reader-logs-values`), so credentials
    must not go through it.
  - Supervisor logs are not on a volume and vanish at each deploy, so the status is written explicitly, never
    scraped from a log.
  - The supervisor configuration is baked into the image, so a new program reaches a host only by a rebuild.
  - Supervisord gives up on a program after a few quick failed starts (AC-5).
- **The task system:**
  - The task queue lives only in the control-panel process.
  - An enqueue can join a job that is already finishing (row `2026-09-28-confirm-route-joins-finishing-job`).
  - The pass waits up to 4 h for `neo4j-heavy`, and after a deploy it can wait behind a stale lease (row
    `2026-09-27-stale-heavy-lease-after-deploy`). A catch-up that relies on a pass cannot promise AC-4's 5 minutes.
- **The lock.**
  - **The minute holds during a pass.** AC-1's minute holds while a pass runs. The pass's wrapper holds its lock for
    the whole run, reads included (staging's backfill took 11.1 s; the time-out is 30 min). A design that makes
    real-time writes wait on that lock must still meet the minute, or kick back to Planning.
  - **The flock row.** If the design holds the pass's lock file shared (ADR 0002 binding 4's option), fold in the
    fix for row `2026-09-28-lock-check-accepts-any-flock`.
  - **A second gate.** Besides the wrapper's non-blocking flock, the task launcher skips a new pass while any
    process's command line contains the pass's registry path (`pipeline/tagging-edges/reconcileTaggingEdges`, a
    `pgrep -f` guard). So no process of the path may match it (AC-5).
- **ADR 0002's two residuals.** Say whether story 3 closes them (binding 4's shared-lock option is one way) or keeps
  them. If it keeps them, say how long one lasts on an instance with no enabled pass schedule: staging and
  production today, and fresh installs until the owner enables the seed.
- **The status.**
  - `GET /api/tagging-edges/status` has no slot for a second component today; AC-6's status either joins it or sits
    beside it.
  - Story 2's redactor passes a host name with a port unchanged (CF-3), so this status needs more than that
    redactor, such as fixed text or a wider rule, pinned by a test.
- **No bookkeeping value.** A bookkeeping value on `TAGS` (a per-edge write counter, say) would reopen ADR 0002's
  owner decision 11, and the pass strips any key outside the nine and reports that relationship changed. It changes
  a criterion (AC-7): kick back to Planning.

For Test Design:

- **Each local way in:**
  - a websocket publish to the relay inside the container;
  - `POST /api/strfry/publish`, called directly;
  - an import, which stands for the router and sync: back-date within 6 years, since import skips the time window;
  - a back-dated tagging;
  - a burst of taggings and deletions.
- **Deletions:**
  - by `e` and by `a`;
  - cross-author, both forms, including one naming a relationship whose tagging a wipe already removed (no removal);
  - an unpin, a curated-list copy's deletion and an ordinary deletion (no change);
  - a revoke followed by an older version re-sent;
  - a version and its id-only revoke imported in one batch (the older relationship stays until a pass);
  - a wipe while the path runs (no removal).

  The local relay already holds one kind-5 in the UI revoke's shape (2026-09-22) whose target it no longer holds.
- **Failures:**
  - a relay read that fails, times out or is cut short;
  - Neo4j down during a change;
  - a crash mid-write;
  - a lost race with a pass;
  - catch-up after a stop, with back-dated arrivals and revokes in the gap;
  - a first start that adds nothing for existing taggings, and a later catch-up that adds nothing for them either;
  - a lost record of where the path left off;
  - bad setup: one identity missing, upper-case or mixed-case; the rule missing at start and then created while the
    path runs.
- **The switch and status:**
  - the on/off choice and the status survive a restart;
  - off takes effect within the ADR's bound;
  - a non-owner session is refused;
  - the status shows no credential and no database or relay address, including for error text naming
    `neo4j.internal:7687` and `[::1]:7687` under an error code other than the two connection codes.
- **Bypass probing** (row `2026-09-22-rule-stories-need-bypass-probing`) for AC-3's removal rule, AC-3's bad setup
  and AC-5's switch.
- **Live tests:**
  - never wipe the local graph's 7,030 dev `TAGS`;
  - a republish reads the current version first and publishes a strictly newer one (OPEN.md row 144);
  - nothing is published to an outside relay, directly or through a router stream.

## Linked artifacts

- ADR: `engineering-team/decisions/tagging-edges/0003-real-time-path.md`
- Test plan: `engineering-team/stories/tagging-edges/3-real-time-path.test-plan.md`
- Review: (filled in after Review phase)
