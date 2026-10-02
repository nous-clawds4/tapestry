# Story 3: The real-time path

**Status:** Done
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
- a newer version revoked by its id at once (in one import or sync), while the path was not running (a deploy
  included), or while its connection to the relay was interrupted;
- a relationship another writer recorded from a version the path never saw, when a newer version is revoked by its
  id;
- whatever reached the relay while the path was down, if the path has lost its record of where it left off.

*(Amended at Architecture, 2026-09-29: ADR `tagging-edges/0003` Amendment A1, owner decisions 2 and 5.)*

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

  *(Amended at Architecture, 2026-09-29, ADR `tagging-edges/0003` Amendment A1, owner decisions 2, 10 and 11: a
  revoke by id counts when it names the version the relationship records, or the latest version the path has learned
  at the address when the relationship records one it learned there before; a deletion drained while the read that
  first shows the path its target is running is reflected at the next safety diff; and decision 11's lost-notice
  removal.)*
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
    - or a deletion from the tagging's author naming its address, or naming the event id its relationship records,
      or naming the event id of the latest version the path has seen at that address when the relationship records a
      version the path saw there before it (ADR `tagging-edges/0003` owner decisions 2 and 11).

    A deletion naming a version the path has since seen replaced at that address prompts nothing. It then removes only
    when a successful read of the relay at that address, taken after the event, finds no
    accepted version there. A failed or incomplete read never leads to a removal, and neither does a read that no
    such event prompted: a read of everything that comes back empty (after a relay wipe, say) removes nothing. A
    tagging that leaves the relay with no such event keeps its relationship until the next pass, whose limit
    applies (story 2 AC-5), or until an event about that tagging arrives.

  *(Amended at Architecture, 2026-09-28, owner decision 5 of ADR `tagging-edges/0003` § "Owner decisions needed at this gate": the crash corners of about 250 ms and before
  the first record is written.)*

  *(Amended at Architecture, 2026-09-29, ADR `tagging-edges/0003` Amendment A1, owner decisions 2, 5 and 11: "What a
  removal needs" admits the latest version the path saw at the address; decision 5's corners are widened to a
  subscription that was reconnecting or not delivering, and to a version learned in the last flush interval before a
  crash; and decision 11's lost-notice removal, where the relay's newest store left with no event and the pass would
  make the same removal.)*
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
    *(Amended at story 5's Architecture, 2026-10-01, from story 5's Planning (the owner, 2026-10-01).
    - **Who may switch.** The owner or an admin turns the path on and off, enforced by the server, and the last
      change wins. A session that is neither the owner's nor an admin's is refused and changes nothing.
    - **The record.** Each change records who (owner or admin, and an 8-character key) and when. Only a signed-in
      owner or admin may read who.
    - **Off still means off.** An off that cannot be recorded still takes effect, and its answer says so.

    See story 5 and ADR `tagging-edges/0005`. Two places keep the wording story 3 shipped: the definition of "on"
    before the acceptance criteria, and Open question 5, the owner's decision 5 ("It ships turned off").)*
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
    was not running, while the running path's subscription was reconnecting or had stopped delivering, or when the version and its revoke reach the relay in one write batch (a single import or sync
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
     waits for the next pass. That happens while the path was not running, while the running path's subscription was
     reconnecting or had stopped delivering, or when the version and its revoke reach
     the relay in one import or sync batch or within the relay's ~100 ms change notice. The deletion names only an id
     the relay no longer holds and the graph never recorded, so nothing ties it to the address. The older
     relationship stays until the next pass (AC-1, AC-4, Out of scope).
   - **A lost record.** If the path finds its record of where it left off missing or unreadable, its status says the
     catch-up could not be established. Whatever the relay stored during that gap waits for the next pass (AC-4).

   On staging and production, the next pass is an owner-started one until a schedule entry is added; on fresh
   installs, it is one until the owner enables the seeded entry.

   *(Amended at Architecture, 2026-09-28: owner decision 5 of ADR `tagging-edges/0003` § "Owner decisions needed at this gate" lists every corner that waits for the pass.)*

   *(Amended at Architecture, 2026-09-29: ADR `tagging-edges/0003` Amendment A1 widens this exception to a running
   path whose subscription was reconnecting or had stopped delivering; the owner re-confirms it with A1's decision 5.)*

   *(Amended at story 4's Architecture, 2026-09-30, from story 3's review, round 3, carry-forward C7: the owner
   accepted the widening on 2026-09-30. While journal appends keep failing (a full data volume), a crash, a switch-off
   or a SIGTERM loses every journal line not yet written, not only the last flush interval's, and what the restart's
   catch-up cannot find again waits for the pass: decision 5's second corner covers the whole spell, and its third
   corner a version held at the first start whose `b` line was lost. Once the volume is out of space the status
   cannot be written either, so it goes `stale` instead of naming the error. The lost lines also add occasions for
   decision 11's lost-notice removal; it is not a new kind of removal, and the next pass would make the same one. ADR
   `tagging-edges/0003` § Failure handling, "Journal appends that keep failing".)*
8. **Decision 3, every start.** The no-backfill rule holds at every start, not only the first. No catch-up creates a
   relationship for a version the relay has held since before the first start.
9. **Decision 4, what may prompt a removal.** A removal answers one of two events: a new version stored at the
   address, or a deletion from the tagging's author naming its address, or naming the event id its relationship
   records, or naming the event id of the latest version the path has seen at that address when the relationship
   records a version the path saw there before it. A deletion naming a version the path has since seen replaced at
   that address prompts nothing. It also needs a successful read of the relay at that address, taken after the event, that finds no accepted version
   there (AC-3). So a wipe, a failed read, a read that no such event prompted (even one that comes back empty), or
   another author's kind-5 removes nothing in real time.

   This reaches one case beyond decision 4's wording. AC-3 also lets the path remove a relationship in real time when
   the new version at the address is one the definition refuses: for example, one that carries neither stamp, names
   no person or several people, or names no tag. The story does not require that removal; the next pass makes it
   (Out of scope). When the path does make it, there is no count limit. Confirm that, or bound it.

   *(Amended at Architecture, 2026-09-29: ADR `tagging-edges/0003` Amendment A1, owner decisions 2 and 11.)*

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

## Evidence

### The local end-to-end run (open question 14)

Two runs on the local stack: strfry 1.1.0 holding the 7,030 stamped census taggings, and Neo4j holding their 7,030
`TAGS`.

How the runs were set up:
- **The program** was installed with `docker cp docker/supervisord.conf` plus `supervisorctl update`, and the backend
  was restarted for the routes.
- **The switch** was written inside the container through the store's own `writeSwitch`, the writer the owner route
  calls. The route's owner check is covered by the routes suite; an unauthenticated `POST` answered 401.
- **The test taggings** were signed by two throwaway keys (tagger `ed2a466b…`, target `01e6b509…`) and name an existing
  tag element.
- **Timing.** A harness inside the container stored each event, then polled Neo4j every 50 ms. Store time is the
  relay's `OK`, the route's 200, or `strfry import`'s exit.

**Run 2: 2026-09-29, 17:39–17:43Z, on the implementation with Amendment A1.**

| Check | Result |
|---|---|
| Start over run 1's record (written before A1: no epoch, no lineage) | accepted; the start catch-up re-learned 7,030 tops in 181 ms |
| Tagging, then a by-id revoke, through a websocket `EVENT` | 731 ms, then 436 ms |
| Tagging, then an address revoke, through `POST /api/strfry/publish` | 662 ms, then 666 ms |
| Tagging, then a by-id revoke, through `strfry import` | 683 ms, then 679 ms |
| A tagging back-dated 5 years, then an address revoke | 721 ms, then 655 ms |
| A new version (780 ms), then the author's by-id revoke of the replaced version | the relationship still records the new version 90 s later (A1-3) |
| A new version, then at once its own by-id revoke (a quick undo) | removed in 570 ms (clause ii) |
| Stopped; meanwhile two taggings (one back-dated 3 years) and a revoke stored; started | catch-up 649 ms (2 added, 1 removed), all reflected ~50 ms after `supervisorctl start` returned |
| Neo4j stopped; a tagging and a revoke stored | `waiting-graph`, 2 pending; both reflected 10 s after Neo4j answered |
| Another author's kind-5, by id and by address | nothing removed; `deletionsForeign` counted (strfry refuses the cross-author address one) |
| A tagging deleted from the relay with no event (`strfry delete`, not the newest event) | kept; the author's by-id revoke then removed it in 645 ms |
| Switch off | Node gone ~1.2 s after the write; status `off`, `subscription.connected: false` |

At the end: `removalsNotPrompted` 0, every test relationship removed, `TAGS` 7,030 as before. The two throwaway people
stay in the graph as local dev data.

**Run 1: 2026-09-28, 23:46–23:59Z, on the implementation before A1.**
- The first start took about 1 s; `seen` 7,030 became the baseline, and nothing was backfilled.
- The three ways in, back-dated included, took 642–703 ms per tagging or revoke.
- Catch-up after a stop: 494 ms. After Neo4j came back: about 4 s.
- An unauthenticated switch `POST` got 401. Off came within 1.4 s.
- It found a strfry defect, now ledger row `2026-09-29-strfry-delete-hides-next-write`:
  - After `strfry delete` removed the relay's newest event, the next stored event, the author's by-id revoke, was
    never delivered live. The path's next safety diff removed the relationship, 9 minutes after the revoke was stored
    (owner decision 10).
  - Reproduced without the path: a plain `limit:0` subscription got A and C, never B.
  - The mechanism, read in strfry 1.1.0's source at review rounds 1 and 2 (A1 clarification 24, rewritten at round
    2, and corrected at story 4 from round 3's carry-forwards C1, C3 and C4): after an operator deletes the
    relay's newest events, or wipes it, the next writes re-use their ids, at least one per newest event deleted and
    more where earlier deletions left gaps. strfry keeps its skip marks per filter and index-key value, not per
    subscription alone. A live subscription misses a write that re-uses an id at or below the last event sent to it,
    the relay's newest event when it subscribed, or the last event its monitor visited that carries the write's own
    index-key value. For the path, a stamped tagging is also hidden by the last event of any kind carrying its stamp,
    and a kind-5 only by the other two. strfry runs three monitor threads. A write stored after the delete but before
    its thread next wakes (a database change wakes all three about 100 ms after the first change, which may precede
    the delete) is missed by every live subscription on that thread. A REQ (at its EOSE), a CLOSE or a closed
    connection wakes only its own thread, and helps only when it falls between the delete and the write. After a
    wipe, a subscription misses writes until the ids pass the point its monitor had reached, or until it
    re-subscribes. Kind-5s, replaced versions and expiry never lower the largest id, so they never trigger it.

### Decision 9's heap ceiling (A1-16 (9), A1 clarification 19)

The setup:
- Node 22, `--max-old-space-size=384` as the wrapper runs it;
- the real `store.js` on disk, with a synthetic relay and graph that hold nothing per event;
- the steps measured: a first start (census, baseline, record), its catch-up and compaction, a restart with a journal
  at a quarter of the record, and the restart's catch-up and compaction.

| Taggings | `record.json` | Every step |
|---|---|---|
| 100,000 | 37 MB | passes (peak 238 MB, the restart's catch-up) |
| 200,000 | 74 MB | passes (peak 358 MB) |
| 240,000 | 89 MB | passes, 4 runs of 4 (peak 382–387 MB) |
| 245,000–250,000 | 91–93 MB | the restart's catch-up runs out of heap |

- **The whole path's ceiling is 240,000 taggings.** A first start alone reaches about 350,000.
- **The worst case,** every address holding a different graph id so every one is an arrival, caps at 200,000.
- **What fills the heap:** the long-lived maps (`S`, `B`, the lineage and their indexes) take about 0.9 KB per tagging,
  about 60% of the peak. A catch-up's transients take the rest.
- **The margin:** the revisit trigger of 100,000 `seen` (today 7,030) leaves 2.4× below the ceiling.

### SL19, the relay smoke test (review C8)

SL19 had only skipped from the host, because the relay answers only on the container's loopback. It was run once
inside the local `tapestry` container on 2026-09-30 at 05:04:33Z, at `origin/staging` `58abd891`, under Node v22.23.2,
through the suite's `run()` export
(`docker exec tapestry sh -c 'cd /usr/local/lib/node_modules/brainstorm && node -e "require(\"./test/tagging-edges-live.test.js\").run()"'`).
SL19 passed: the path's two `limit:0` filters were answered with EOSE, with no CLOSED and no stored event before it,
and nothing was published. The suite reported 1 passed, 0 failed, 18 skipped. The nine Neo4j read checks (SL1–SL7,
SL17, SL18) skip unless `NEO4J_URI`, `NEO4J_USER` and `NEO4J_PASSWORD` name a reachable local stack, and that shell had
no `NEO4J_URI` or `NEO4J_USER`. The nine write-sandbox tests (SL8–SL16) skip unless `TAGGING_EDGES_LIVE_WRITE_TESTS=1`,
which was not set.

### Staging

Everything below was read from staging's public routes (`GET /api/tagging-edges/status`,
`/api/tagging-edges/realtime/status`, `/api/scheduled-tasks/status`, `/api/strfry/scan/count`) and read-only Cypher.
The owner ran the steps on 2026-09-30 (OPERATIONS §12.9, "The order on staging and production"), after the backfill of
2026-09-28 (story 2 § Evidence).

- **The daily entry** (`reconcileTaggingEdges`, every day, enabled) was added at about 14:26:18Z. Its first run
  started at once: pass `20260930T142619Z-4db0d448`, `done` in 5,104 ms, added 3 (taggings stored since the
  backfill), 7,023 unchanged, nothing held. The next run is due 2026-10-01 at 14:26Z.
- **Switched on** at 14:26:35Z. First start 14:26:36Z, subscribed 14:26:36Z (0.8 s later). Its first catch-up was
  `done` in 388 ms, reflecting nothing (read from `catchUp.last` at 14:32:40Z, before the 10-minute safety diff
  replaced it). `state` `live`, no `setupProblem`, no `lastError`, `seen` 7,026.
- **One more pass** after the first start: `20260930T142646Z-a7f04da9`, `done` in 1,259 ms. 7,026 unchanged, nothing
  added, changed or removed, nothing held, no anomalies.
- **Relay against graph** at about 14:33Z: 7,026 taggings carrying either stamp on the relay, and 7,026 `TAGS` at
  7,026 distinct addresses.
- **A live tagging.** The owner tagged a person `physician` from production's page. The tagging (`7854da66…`,
  `created_at` 15:20:29Z) carries the canonical stamp beside production's local one, and staging's path matched it on
  the canonical stamp (`zCanonical` true, `zLocal` false). It most likely reached staging's relay through the
  `nostrUserTag` router stream from the DCoSL relays, the only enabled inbound stream on staging whose filter matches
  it (`GET /api/strfry/router-status`); that delivery was not observed directly. The path heard it at 15:20:32.962Z
  and reflected it at 15:20:33.465Z, in a 233 ms round of one address: `counts.added` 1, with no refusal, failed read
  or error. The graph holds one relationship at its address with that event id.
- **A deploy's catch-up** (2026-10-01; story 4's deploy, run `36802662544`). The restarted process
  (`runningSince` 01:47:47Z) ran its catch-up at once: `catchUp.last` `done`, 01:47:47.592Z to 01:48:16.185Z
  (28,593 ms), reflecting nothing. Afterwards `state` was `live`, with no `setupProblem`, no `lastError` and no failed
  reads. It was read at about 01:55Z, before the 10-minute safety diff replaced it at 01:57:47Z. The first catch-ups
  of 2026-09-30 took under 0.5 s; why this one took longer was not examined.

Open question 14's remaining staging items, organic taggings with no failures and a later pass that reports nothing
untraceable, are in "The first runs at the daily time, and a day of taggings" below.

### Production

The owner ran the same steps on production on 2026-09-30, 101 s before staging. No backfill had been run when the
daily entry was added, so the entry's first run, which starts at once, was the backfill. It ended 0.7 s before the
switch came on, so it finished before step 3, as step 2 asks; its figures were checked afterwards, at 14:32Z.

- **The backfill:** pass `20260930T142438Z-7e3f2a03`, started by the new daily entry at 14:24:38Z, `done` in 14,503
  ms. Added 7,033 = `taggingsRead` 7,033 − `refused.total` 0, `peopleAdded` 5,846, `unresolved` 6, nothing held.
  Durations and margins are in OPERATIONS §12.8, "Measured durations". The next scheduled run is due 2026-10-01 at
  14:24Z.
- **Switched on** at 14:24:54Z. First start 14:24:54Z, subscribed 14:24:55Z (1.0 s later). Its first catch-up was
  `done` in 468 ms, reflecting nothing (read from `catchUp.last` at 14:32:40Z). `state` `live`, no `setupProblem`, no
  `lastError`, `seen` 7,033.
- **One more pass:** `20260930T142511Z-3469ad38`, `done` in 2,050 ms. 7,033 unchanged, nothing added, changed or
  removed, nothing held.
- **Relay against graph** at about 14:33Z: 7,033 and 7,033, at 7,033 distinct addresses.
- **The same live tagging**, published on production: heard at 15:20:31.941Z, reflected at 15:20:32.527Z, in a
  315 ms round of one address. `counts.added` 1.
- **A deploy's catch-up** (2026-10-01; story 4's promotion, run `36803802426`). The restarted process (`runningSince`
  02:02:21Z) ran its catch-up at once: `catchUp.last` `done`, 02:02:21.869Z to 02:02:57.647Z (35,778 ms), reflecting
  nothing. Afterwards `state` was `live`, with no `setupProblem`, no `lastError` and no failed reads. It was read at
  about 02:03Z, before the 10-minute safety diff replaced it at 02:12:21Z. The first catch-up of 2026-09-30 took
  468 ms; why this one took longer was not examined.
- **Against the stamp-scan ceiling** (OPERATIONS §12.9, "Ceilings": revisit the design when a stamp scan takes over
  20 s). The status shows no stamp-scan time of its own, and a catch-up's `durationMs` is only an upper bound on one.
  The two deploy catch-ups, 28.6 s and 35.8 s, do not separate the scan from the rest of the catch-up. Each process's
  first 10-minute safety diff, which also scans, took 2,214 ms on staging (from 01:57:47.781Z) and 3,304 ms on
  production (from 02:12:21.981Z). So none of these shows a stamp scan over 20 s.

### The first runs at the daily time, and a day of taggings (2026-10-01)

Read from both hosts' public routes and read-only Cypher at about 19:20–19:31Z on 2026-10-01.
- **The first runs at the daily time.** Each daily entry's second run, its first at the due time, started on time
  (each entry's first run came at once when it was added, on 2026-09-30). Neither pass added, changed or removed anything; both
  held nothing, refused nothing, met no conflicts and reported "the graph agrees with the relay". So open question 14's
  "a later pass" has nothing to trace.
  - Production: `20261001T142438Z-79016d8d`, `done` in 7,210 ms, all 7,040 taggings read unchanged.
  - Staging: `20261001T142619Z-de346fcb`, `done` in 2,562 ms, all 7,033 taggings read unchanged.
- **A day of taggings.** On each host the path's counts, which run from its first start, read: added 38, removed 3
  (all three "not on relay"), with 6 people added. Production also shows changed 1 (newer), which it already showed
  at 02:03Z. Overnight both read added 6 and removed 0 (staging at 02:24Z, production at 02:03Z), so 32 additions
  and 3 removals came during the day.
  The last was reflected at 19:04:57.895Z on staging and 19:04:58.040Z on production.
  - Both read no refusals, nothing left in place, no failed reads (relay, graph, element, catch-up) and no database
    refusals.
  - Both read no removals it was not prompted to make, no deletion that matched nothing or was foreign, and no lost
    races.
  - Nothing was parked or pending, and `state` was `live`.
- **Relay against graph** at 19:21Z: 7,061 and 7,061 on staging, 7,068 and 7,068 on production.
- **Deploys in between.** Both processes restarted between the overnight reads and these.
  - Production was redeployed by PR #794's promotion: deploy run `36806060638` ended at 02:30:50Z, and
    `runningSince` reads 02:30:53.337Z. Its counts read the same at 02:31Z as at 02:03Z: added 6, changed 1,
    removed 0.
  - Staging was redeployed by another change: PR #795's deploy run `36874849010` ended at 14:16:43Z, and
    `runningSince` reads 14:16:44.722Z.
  - The counts carried across both restarts, and staging's scheduled pass ten minutes after its deploy found nothing
    to do.

That covers open question 14's staging items except the length of the organic-tagging record: one day, where the
question asks for "the following days". Another read of the status in a few days is due, unless the owner accepts one
day.

## Deviations

Judgement calls that stand in the implementation (implementer role, step 9). Round 1's calls that Amendment A1
superseded, or that ADR `tagging-edges/0003` and its clarifications now state, are left out: review round 1's four
ratified calls are A1 clarifications 20 (single time-outs count toward the park only while other relay reads
answer), 21 (a live revoke lifts a time-out park), 22 (an element single time-out counts in `failedReads.element`)
and 23 (a catch-up's compaction keeps the `older` ids learned since its key read).

*The pass's port and runner:*
- `readAt` defaults to a 60 s time-out and `readKeys` to 120 s (as `applyLocked` and `readAll`): the ADR sets no
  defaults. `readSchema` takes an optional `timeoutMs` and keeps no default, so the pass's pre-flight and
  `ensureTagsConstraint` read the schema as story 2 shipped them; the path passes its own 30 s (review round 1,
  conform item 1(e)).
- `readKeys` returns each value as stored, `null` only when absent, like `readAll`; the path ignores a non-string
  address, which is not a tagging address.
- `lockHeld(fd, { file: null })` gives the pre-C20 answer, as a missing `file` does (T24 names only a missing one).
- A pre-image record puts `writer` right after `runId`, and `preimageRecords` does not check its value: the ADR fixes
  neither.
- The runner's header and step-1 comment (CF-4) state C20's inode check instead of the old "any flock on fd 9"
  caveat, which C20 makes false.

*The wrapper (`run.sh`):*
- Two stderr lines the ADR does not name (another instance holds `daemon.lock`; each backoff), so the supervisor log
  shows something; neither carries a secret or an address.
- The switch poll's sleeps also run in the background, each with fd 8 closed: a TERM to an idle wrapper exits at
  once, and a sleep left behind never holds `daemon.lock`.
- The TERM/INT trap ignores a second signal before forwarding TERM, so the wrapper forwards exactly one. Under
  supervisord, `stopasgroup` also signals Node directly (a non-interactive bash has no job control, so Node is in the
  wrapper's group); the engine ignores the second TERM.
- No `set -e` / `-u`: the loop must outlive every failure of what it runs, and the conf is sourced as a plain `. conf`.
- If `realtime/` or `daemon.lock` cannot be made or opened, `flock -n 8` fails and the wrapper takes the ADR's `sleep
  30; exit 75` branch, which supervisord restarts indefinitely.

*The subscription (`subscription.js`):*
- Reconnecting, with its 1→15 s backoff, is the engine's, and the engine's `reconnectDelay` is the schedule's one
  copy; the module is one connection and exports `subscribe` alone (review round 1 dropped `reconnectDelayMs`,
  `DEFAULT_RELAY_URL` and `SUBSCRIPTION_ID`, which nothing read): the engine suite's fake is one-shot and counts
  re-subscribes, and a reconnect inside the module could open two sockets. The engine logs each close with its fixed
  reason and close code, so a relay refusing the filters shows in the log, not only as a reconnect loop.
- `onClose` reasons are fixed text (`connection refused`, `connection dropped`, `filter refused (CLOSED)`, `filter
  refused (NOTICE)`, `no pong`): the relay's own text can name a host and port (AC-6).
- Filters are copied with `limit: 0` forced, never changed in place. A CLOSED ends the connection only when it names
  the path's subscription id; unparseable frames, unknown message types and other subscriptions' events are ignored.
- A 10 s handshake time-out, which the ADR does not name, so a hung upgrade does not wait on the OS's TCP time-out.
- `close()` sends `CLOSE`, then a 1000 close frame, and drops the socket after a 2 s grace; `perMessageDeflate` is off
  (the relay is on the loopback); every timer is unref'd.
- Callbacks are not wrapped in try/catch, so an engine callback's throw reaches the engine's crash path instead of
  being swallowed.
- Test seams: optional `pingIntervalMs`, `pongTimeoutMs` and `handshakeTimeoutMs` keys on `subscribe`'s options.

*The planner (`src/lib/tagging-edges/realtime.js`):*
- The address index (address → ids) and the top index (top id → address) sit on the maps as non-enumerable
  properties, so `newMaps()` shows exactly `{ S, B, R, L }` while an `a` or `e` target costs one lookup.
- `compact`, `pruneLineage` and `deletionCandidates` throw a `TypeError` unless `scannedIds` is a Set: a failed scan
  must never read as an empty relay (principle 4).
- `replayJournal` also skips and counts a known line type that lacks its fields or has the wrong types (beyond
  clarification 5's `v` and `o` rule), and restores only `deadSeenAt` keys matching `RUN_ID_RE` (which also keeps out
  `__proto__`).
- `passOverlaps` counts a run that is still alive as overlapping, even when its `endedAt` is at or before the graph
  read (§ Coexisting with the pass, read literally): at worst one extra re-look.
- Shapes the ADR leaves open: `recordId` returns the entry it set, `compact` returns `{ dropped: [ids] }`, and
  `pruneLineage`'s `droppedAddresses` is a count (A1 clarification 1 allows a count or a list).
- `addressScanFilters` and `deletionScanFilters` skip non-tagging addresses and de-duplicate; `deletionCandidates`
  keeps only 64-hex ids (nothing else can go in an `#e` filter); `dedupeById` passes items with no string id through.

*The strict scanner (`strfryScanStrict.js`):*
- A filter `JSON.stringify` cannot write is refused as `ScanError` `spawn` before the spawn, as before story 3.
- An `onEvent` that throws rejects the scan with the handler's own error, after SIGKILLing the child (SS40's first
  choice); with `onEvent` the result keeps `events: []`; an `onEvent` that is not a function counts as absent (the fake
  port's rules).
- The redactor's bracketed-IPv6 rule also takes a zone id and an IPv4-mapped tail; IPv4 and IPv6 ports are `\d+`
  (only the name rule has the 2–5-digit bound); names match case-insensitively.
- The redactor cuts its input to 4 KB before any rule runs, back to the last whitespace within it, so the name rule,
  quadratic on long dotted or hyphenated text, never runs on long input, and no URI, path, host:port or hex run is
  split into a part the rules no longer recognise; input with no whitespace in its first 4 KB comes out empty (review
  round 1, Non-blocking 4). The callers still bound what they keep. The cut also changes story 2's pass report, whose
  error `message` passes the same redactor before its 300-character cut: an error text over 4 KB now keeps only what
  its first 4 KB, cut back to whitespace, redacts to, and one with no whitespace in its first 4 KB is reported empty,
  where before it gave its first 300 redacted characters. The report's `stderrTail` is unchanged: its line comes from
  at most 4,096 characters of stderr. SS41 pins the cut.
- The redactor's name rule does not take a host name with an underscore, such as a Compose-style container name
  (`tapestry_neo4j_1:7687`): an error naming one keeps it, in the path's log and in the pass's report. Widening the
  rule is left as debt: ADR 0003's New debt line on the redactor names it, with host names that start with a digit
  and credentials written without a scheme (added at review round 2, R2-NB3).
- The size check stringifies a filter twice (at most 100 KB), so the scanner and the planner share one escape (T1).

*State and routes (`store.js`, `src/api/tagging-edges/realtime.js`):*
- `store.js` exports `parseSwitch`, so the status route applies T26's one switch rule instead of a copy of it.
- `readStarted()` and `readStatus()` return `{ unreadable: true }` for a file present but unreadable, and a
  `status.json` that parses to a non-object counts as unreadable: a damaged marker never reads as a first start
  (AC-4).
- `writeSwitch` refuses an `on` that is not a boolean (`EBADSWITCH`), so the wrapper always finds a literal
  `"on":true` or `"on":false`.
- `record.json` stays one JSON object with T26's sha256, laid out one member and one row per line, so it is written,
  hashed and read back as a stream (A1-18 fixes the streaming, not the layout); a file laid out otherwise is parsed
  whole and checked by the same rule. `started.json` and `status.json` are pretty-printed; every file ends with one
  newline.
- An off-write that fails, followed by an unlink that succeeds, answers 200 `{ success: true, on: false,
  takesEffectWithinSeconds: 5 }` with no `changedAt`: no file is left to carry one.
- With the switch on and no state in `status.json`, the route's `state` is `null`: T27 fixes only `off`, and the route
  makes none up.
- `lastError.code` is re-checked against the allow-list only when present.
- `appendJournal` adds a missing trailing newline, accepts a single string, and cuts a failed append back off (as
  `state.appendPreimages` does); `truncateJournal` creates an empty journal when there is none, and then fsyncs the
  directory, as an append that creates it does.
- `store.js` keeps its own `ensureDir` and `fsyncDir` (mode 0700): `state.js` exports neither.

*The engine (`src/pipeline/tagging-edges/realtime/index.js`):*
- Element reads run right after each address chunk, not as one step after every address read, so a steady stream of
  large events cannot keep an early id-only address deferred round after round; element bytes still count against
  the round's budget and the share.
- The round's budget counts every event a successful scan streamed, not only those kept; kept events drop `content`
  and `sig`, which the contract never reads.
- `relayAtAddress` gets only the elements its address's own taggings name: the same result, without work of the order
  of addresses × elements per round.
- `defaultDeps` adds `killScans()`, which tracks strfry children through `scanStrict`'s `spawnImpl`, for the off step
  that SIGKILLs a running read; the engine calls it only when present (the fakes have none).
- `run()` sleeps 25 ms, not 250 ms, while an activity is in flight, and a tick starts up to 16 activities that each
  settle within one event-loop turn, so rounds follow each other closely (still ≤ 250 ms, T20).
- An unreadable `status.json` counts as a first-start marker, so that start takes the lost-record path and is never a
  first start; the first start opens the journal once, to cut a torn tail before its first append.
- A catch-up's arrivals and look-only prompts are not journaled (its found revokes are, A1-9): the next catch-up finds
  them again, and a compaction writes the unfed backlog into `pending`. Every catch-up, the safety diff included, is
  done and compacts once each address it queued has had one attempt.
- A catch-up retried after a failed read uses its own 5→60 s backoff and not the 30 s spacing, which applies to
  connect, pass-end, backlog and safety-diff requests. The graph coming back ends the wait at once; only a catch-up
  that completes resets the failure count (review round 2, R2-2), so every failure path, a failure after the stamp
  scan answered included, backs off 5, 10, 20, 40, then 60 s.
- An unexpected error in a catch-up's own work, in one of its reads' steps or in feeding its backlog after a round,
  ends that catch-up as `failed` with stage `unexpected` and the same 5→60 s backoff (review round 1, Blocking 2). It
  is the status's `lastError` under stage `unexpected`, not `catch-up`, and is not counted in `failedReads.catchUp`:
  no read failed. `failCatchUp` and `graphDown` share one graph backoff (`waitForGraph`).
- Any failed graph read (`readAt`, `readSchema`, or opening the driver) puts the path in `waiting-graph`, probing
  5→15 s for `ServiceUnavailable`, `SessionExpired` and `TransientError`, and 5→60 s otherwise; a `readSchema` failure
  counts in `failedReads.graph`.
- A write that fails because its pre-image append failed (a local file-system error) is transient: it backs off, and
  is never bisected or parked.
- A re-park with the same code is not counted again in `dbRefused`.
- The engine keeps its own copy of the planner's `mergeEntry`, which T2's exports do not list; each names the other,
  and they apply the same rules (review round 1 aligned the planner's to the engine's: a version without a string id,
  and a revoke that is not a plain object, carry nothing, so a damaged `record.json` row prompts nothing). The runs to
  watch for overlap are rebuilt at start from the persisted re-looks, so a pass that ends after a restart still gets
  its catch-up.
- `crash(err)`, not part of T20's API, records `lastError` with stage `unexpected`, flushes the journal, writes the
  status and ends the loop with code 1; `run()` registers it for `uncaughtException` when handed the process. The ADR
  says Node exits on an uncaught error after writing the status, and the engine did not.
- At a first start a buffered kind-5's foreign `a` targets are dropped, so they are not counted in `deletionsForeign`;
  a kind-5 past the 20,000-target cap counts once in `droppedOverBacklog` (per kind-5, not per target).
- A stop between a lost record's re-baseline and its first catch-up attempt shows `not-established` once (the status
  written at the re-baseline) and does not carry it to the next start's catch-up.
- The journal epoch is `max(now, last epoch + 1)`, the last epoch covering the record's and every `e` line replay
  passed, so a new epoch is never one already in the file (A1 clarification 4 allows any value).
- A catch-up's compaction adds the addresses learned after its capture to `keep` as well as passing `learnedAfter`
  (A1 clarification 1 allows either).
- For A1-7's pass exception, a run whose `endedAt` is null ended when the path first saw it dead (`deadSeenAt`), and a
  run that ended (or was first seen dead) in the key read's own millisecond counts as ending after it, as A1
  clarification 13 settles the graph read's ties.
- A1-11's "between a catch-up's reads": each read is its own activity — the key read with its report read, the stamp
  scan, then each author's candidate scan, and each half of a failed one (the bisection no longer runs inside one
  read) — and a due round and the catch-up's next read strictly take turns, so neither starves the other.
- A pass's re-look at an address parked for time-outs merges into the parked entry (and keeps its run, so the `rc`
  line follows the address's completion) instead of queueing the address beside its park; at an address parked for a
  database refusal, it lifts the park and is queued, as a new event there would be. (A catch-up lifts a refusal park
  only for a version or revoke the parked entry does not hold, A1 clarification 26.) `park()` merges any entry already
  parked at the address (the higher level and the read-alone mark kept), and a parked address keeps the re-looks its
  item carried.
- A1 clarification 26's "a version id or a revoke the parked entry does not already hold" is read as one
  `mergePrompt` would put in the entry: a version id other than the entry's, or a revoke with no kept revoke for its
  `(by, target)` or a later `created_at` than the kept one. A revoke the entry keeps for that pair with a `created_at`
  at least as late counts as held, whichever kind-5 it came from, since merging it changes nothing.
- A start whose record names a journal generation that a journal read whole never opens (a stop between a
  compaction's record write and its `e` line) puts that `e` line first in its journal, so what it journals is
  replayed next time. Nothing of that generation was durable, so the start does not demote its restored tops.
- A start with a marker carries `lastError` (its code re-checked, its text re-derived from its stage), `lastReflectedAt`
  and `lastRound` over from `status.json`, as it does the counts, until newer ones replace them.
- A census that fails, or that the engine gives up on at 10 s, counts in `failedReads.graph` like any failed graph
  read.
- The compaction cadence (A1-6) is also checked after the tick's journal flush, between activities, once a baseline
  exists: during a graph outage no round reaches its end, and deliveries keep journaling.
- `mergePrompt` refreshes a by-e revoke's recency only when the one merged has a newer `created_at` (clarification 6):
  merging the same revoke again leaves its place.
- Replay also skips and counts a `v` or `o` line whose `older` holds a member that is not a string.

*Docs:*
- BIBLE's Last-updated head also names "CF-3 from tagging-edges #2's review", since §11's redaction wording changed.
  (S2C16 no longer asks for story 2 at the head: review round 1 re-aimed it, ledger row
  `2026-09-29-newest-entry-doc-tests-go-stale`.)
- Ledger row `2026-09-27-strfry-redis-misses-websocket-writes` cites BIBLE's §13 diagram at `:946`, not the story's
  `:936`, which this story's own BIBLE additions moved; its drifted epic cite is corrected too.
- C20's knock-ons beyond the listed places: BIBLE §11's pass paragraph and OPERATIONS §12.8 "Running it" drop the
  closed lock-check caveat and state the inode check (with its Linux 5.14 floor in OPERATIONS).
- OPERATIONS §12.8 "Scheduling it" gains a line pointing to §12.9: a scheduled pass is the path's backstop.
- The epic's guardrail adds that the real-time path waits in `waiting-setup` rather than refusing to start (ADR 0001
  A3 note); without it, "the writer refuses" would be wrong for story 3.
- The handoff's §3 gets a "Settled by `tagging-edges/0003`" sub-bullet; "persists nothing" keeps its qualifier (an
  in-memory `seen` map), and "at most 500" is attributed to strfry's `maxFilterLimit`.
- CF-3 keeps "no config value or credential" in every place, since the owner widened the redactor (decision 6); the
  redactor's own descriptions name the widened host rule.
- CF-6 keeps the review's words, "(0 events, 0 rows)", unchecked against the local stack.
- OPERATIONS §12.9 "What waits for a pass" names a republish carrying neither stamp, not refused versions in general:
  the path can remove a stamped refused version on its version prompt.
- OPERATIONS §12.9 gives decision 9's stamp-scan trigger with `catchUp.last.durationMs` as its upper bound, since the
  status shows no stamp-scan time of its own.
- The ledger row `2026-09-29-strfry-delete-hides-next-write` keeps round 1's local figure (9 minutes to the safety
  diff), labelled as measured on the code before A1; § Evidence records both runs. Review round 2 (R2-1) rewrote its
  title, mechanism, impact and fix shape to A1 clarification 24 as rewritten at that round, each statement re-read in
  strfry 1.1.0's source with line cites. Beyond the clarification's text, the row cites `cmd_delete.cpp` (a delete
  takes the newest event too) and the change watcher's debounce, and says that a REQ or a CLOSE waking the relay's
  monitor between the delete and a write lowers that monitor's cursor, so the debounce race misses the write on
  every live subscription only when nothing else woke the monitor (corrected at story 4's Architecture, from story 3's
  review, round 3, C3: a wake spares only its own thread's subscriptions, and a closed connection wakes one too).
  Round 1's row also said "as many harmless writes"; it now says the harmless writes needed are the old largest id
  minus the new one, gaps included.
- The staging-backfill pointer (OPERATIONS §12.8's "Staging backfill: not yet run" line, and §12.9's step 1, which
  points to it and to story 2's Evidence) still reads as not run: the staging backfill ran on 2026-09-28, and its
  evidence is the docs-lane commit `2361dfb0` (branch `docs/tagging-edges-2-staging-backfill-evidence`, merged
  into staging on 2026-09-30, after this story). Both places read right from then on (review round 2, R2-NB4).
- Review round 1's Non-blocking 1 and 2 are documented, not bounded in code: OPERATIONS §12.9 says what the operator
  sees and does while journal appends keep failing (the unwritten lines kept in memory, rounds still writing) and
  while a first start's baseline scan keeps failing (its version buffer bounded only by that scan's duration). A
  journal cap would have to pause rounds; a buffer cap would drop versions, which would then count as held since
  before the first start, or restart the baseline, which the operator's off already does. ADR 0003 § Failure handling
  now states both (review round 2, R2-NB5).
  §12.9 also gains Non-blocking 3, 5, 6, 7 and 9's operator text: the heap ceiling's crash loop, `statusUnreadable`
  and `running`, `started.json`, `leftInPlace` at 0, a 403 from the switch, a catch-up failed at stage `unexpected`,
  and the logged subscription closes.

## Linked artifacts

- ADR: `engineering-team/decisions/tagging-edges/0003-real-time-path.md` (with Amendment A1, 2026-09-29: revokes by event id and the lineage, after the
  Implementation kick-back)
- Test plan: `engineering-team/stories/tagging-edges/3-real-time-path.test-plan.md`
- Review: `engineering-team/reviews/tagging-edges/3-real-time-path.md`
