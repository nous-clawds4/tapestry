# Story 2: The gap-filling pass and backfill

**Status:** Approved
**Created:** 2026-09-27
**Type:** Feature

## Background

Story 1 defined the `TAGS` relationship — one per tagging, from the tagger's NostrUser to the tagged person's —
as a tested contract, and documented it in BIBLE §6. Nothing writes it yet: every host holds 0 `TAGS` edges. This
story is the first writer. It is a pass that brings the graph into agreement with this instance's own relay, one
tagging at a time; its first run is the backfill, and every later run repairs whatever drifted — a changed stance,
a tagging moved to a different person, a revoke, a tagging the relay no longer holds, history that arrived late.
The real-time path (story 3) will make changes show up within minutes; this pass is the backstop that catches
whatever any real-time path misses, and it is what fills the graph the first time.

The owner's acceptance frame asks that this repair never mass-delete on a failed or empty relay read (book
`tagging-edges`, "Retroactive fill"). The follows pipeline is the cautionary example: its reconcilers count their
deletions but none refuses on the count, and a failed relay scan elsewhere in the stack reads as empty (ledger
row `2026-09-21-failed-strfry-scan-reads-empty`).

**What the relays and graphs hold (read-only census, 2026-09-27; figures move daily as test fixtures arrive):**

| | production | staging | tags |
|---|---|---|---|
| taggings (kind 39999, `nostr-user-tag` stamp) | ≈7,030 | ≈7,020 | ≈7,040 |
| — test fixtures / real (fixture = slug carries a ms timestamp; real is an upper bound) | 6,435 / 595 | 6,428 / 595 | 6,445 / 593 |
| — also carrying that deployment's own stamp (all carry the canonical one; none only their own) | 5 | 4 | 201 |
| distinct people named (taggers ∪ targets) | 6,197 | 6,188 | 6,206 |
| — already a NostrUser: fixture people / real people | 0 of 5,834 / 351 of 363 | 0 of 5,825 / 351 of 363 | 0 of 5,843 / 351 of 363 |
| NostrUser nodes / `TAGS` edges today | ≈3.06 M / 0 | ≈3.05 M / 0 | ≈3.01 M / 0 |
| taggings naming their tag only by id, whose tag element the relay doesn't hold (all real; 4 elements) | 6 | 6 | 6 |
| taggings held here that a revoke held only on another instance names | 2 | 2 | 0 |

**What the owner will see.** After the backfill the Dashboard's Relationships total rises by about the number of
taggings, most of them test fixtures, and its Users total rises by about 5,850 per host. Both are expected. The
owner's existing "delete all relationships" action removes `TAGS` too; the next pass rebuilds them.

## User-facing description

As the owner of a Tapestry instance, I want a pass that brings the graph's tagging relationships into agreement
with my relay — filling them in the first time, repairing them afterwards, and holding back rather than wiping
them when a read looks wrong — so that "Alice tagged Bob as a Podcaster" is a relationship in my graph I can
trust to match what my relay says, without the pass ever destroying data on a bad day.

## Acceptance criteria

"The relay" is this instance's own relay; "the definition" is story 1's contract (ADR `tagging-edges/0001`);
"a pass" is one run of the gap-filling pass; "tagging relationships" are `TAGS` relationships. Each criterion holds
for taggings from any author — test fixtures, self-taggings, disputes, a neutral "0" and an absent stance included —
carrying the canonical stamp, this deployment's own, or both.

- [ ] **AC-1 — the first run fills in every tagging, and later runs pick up late arrivals.** Given the relay holds
      taggings and the graph holds none of their relationships, when a pass runs, then the graph holds exactly one
      relationship per tagging address, from the tagger's NostrUser to the tagged person's, whose recorded values
      equal what the definition gives for the relay's current version. A tagger or tagged person with no NostrUser
      is added once, keyed by pubkey and carrying nothing else. A tagging that reaches the relay after a pass —
      whatever its `created_at`, including history older than that pass (relay sync, router backfill) — has its
      relationship after the next pass. A tagging that names its tag by address takes that address and slug
      whether or not the relay holds the tag element. One that names its tag only by event id is written
      unresolved (no tag address or slug) while the relay holds no usable tag element with that id, and is resolved
      on the first pass after one arrives. A tag element resolves under its identity `d`, read the way the
      definition reads a tagging's own (the first `d` of 255 bytes or fewer), never an over-long first `d`; this
      story changes the definition to do so, with a test (R2-NB2).
- [ ] **AC-2 — the relationship follows the relay's current version.** Given a relationship recorded from one
      version of a tagging, and the relay now holds a different accepted version at that address — a newer one (a
      flipped stance, a different tagged person, a tag that can now be resolved), or an older one (the recorded
      version was revoked by its id and the older one re-sent) — when a pass runs, then the relationship matches
      the relay's version, and when the person changed no relationship for that tagging remains at the old person.
      This holds when the stored relationship's recorded time is missing or malformed (R2-NB1). A pass never
      overwrites a relationship another writer changed or created between the pass's read and its write; the next
      pass settles that tagging. Given a relay and a graph that already agree, a pass changes nothing and reports
      nothing added, changed or removed.
- [ ] **AC-3 — a relationship whose tagging is gone is removed, and nothing else is.** Given a relationship whose
      tagging the relay no longer holds (revoked, or deleted by any route the relay honours), or whose address the
      relay now holds at a version the definition does not accept (a non-tagging — one filed at that address
      because its over-long first `d` is skipped included — or an event outside NIP-01's lower-case form), when a
      pass runs, then that relationship is removed (R2-NB3), but only while it still holds the version the pass
      decided from. A tagging the relay still holds keeps its relationship, even when a deletion the relay did not
      act on names it. A pass only ever removes tagging relationships, each for one named tagging; a `TAGS`
      relationship whose `address` is missing or is not a tagging address (`39999:<64 lower-case hex>:<d>`) is
      left in place and counted in the report (BIBLE §30: state a rebuild cannot reproduce is precious), while one
      at a tagging address is the pass's to repair or remove like any other. A pass never removes a person — one it
      added included — or any other relationship or node.
- [ ] **AC-4 — a bad read or a bad setup changes nothing.** Given any read the pass depends on fails or comes back
      incomplete — the taggings, the tag elements they name, the deletions if it reads them, or the graph's current
      relationships; an error, no answer in time, or an answer cut short or unreadable — when a pass runs, then no
      relationship or person is added, changed or removed, and the run ends as failed and says which read failed
      and why. Given either stamp identity — the canonical `nostr-user-tag` stamp's pubkey or this deployment's own
      — is missing, empty, not 64 hex characters, or has any upper-case letter, from whatever source the instance
      reads it, when a pass is started, then it changes nothing, ends as refused, and says which identity is wrong.
- [ ] **AC-5 — large removals are held, not applied.** The limit is more than 10% of the tagging relationships the
      graph holds when the pass starts *and* more than 50. Every removal AC-3 describes counts toward it; a tagging
      moved to a different person is an update (AC-2), not a removal, and moves even while removals are held.
      Given a read that succeeds but would have a pass remove more than the limit — an empty relay under a graph
      of more than 50 tagging relationships included — when the pass runs, then it applies every addition and
      update, removes none of those relationships, ends with an outcome that says removals were held (distinct
      from a clean finish), and reports how many it held, by reason. At or below the limit removals apply
      normally, so a graph of 50 or fewer tagging relationships has no hold. Each pass judges its own removals
      against its own limit: a removal an earlier pass held is not remembered, and applies on a later unconfirmed
      pass whose removals are at or below that pass's limit. Removals over the limit go through only on a run the
      owner confirms: a confirmation from any session that is not the owner's — through the task system, a
      schedule entry or otherwise — is refused and changes nothing; a confirmation covers one run and is never
      saved into a schedule; a confirmed run removes only relationships that the report the owner confirmed held
      and that its own read still finds due for removal, and judges any other removal it finds against the limit
      as an unconfirmed run would; its report says it was confirmed. The limit never loosens by default.
- [ ] **AC-6 — the database keeps one relationship per tagging, before the first write, with no owner step.** Given
      an instance running this change, when anything tries to store a second relationship for the same tagging
      address, then the database refuses it. The rule is in place from the time the instance runs this change,
      before any pass and without an owner action; a pass that nonetheless finds it missing puts it in place
      before its first write, or ends as refused and writes nothing. The instance's two checks of expected database
      rules — the Dashboard's constraints check, and the server's constraints check that gates Settings ›
      Firmware's Install button while firmware is not fully installed — both know the rule and agree about whether
      it is present, and the Dashboard offers the owner the fix when it is missing.
- [ ] **AC-7 — each run leaves a report, and runs as a task.** When a pass ends — done, done with removals held,
      refused or failed — the owner can read its report on the instance itself, without a shell or logs, and the
      latest report survives a restart: when it ran, how long it took, its outcome and why; whether it was a
      confirmed run; taggings read; relationships added, changed, removed, unchanged, unresolved, and left in
      place under AC-3; people added; events refused, by reason; and removals held by the limit, by reason. The
      pass starts only through the instance's existing task system — on demand, or on a schedule; on a fresh
      install Scheduled Tasks lists it as a disabled daily entry. Two passes never run at once: one started while
      another runs waits or is refused. A pass stopped partway (time-out, deploy, restart) leaves every
      relationship equal to what the definition gives for one version of its tagging, its report reads as failed
      and says it was stopped, and the next pass ends in the state a completed run would have reached.
- [ ] **AC-8 — nothing else moves.** Given a pass runs, then every node and relationship other than tagging
      relationships and the people it adds is identical before and after — the FOLLOWS, MUTES and REPORTS
      relationships and every existing person's properties, scores included, among them — and every relationship
      it writes carries only the values the definition gives plus any bookkeeping values the ADR names: no trust,
      score, count, rank, tag name, bucketed stance or "applied" flag, and nothing named `timestamp`.

### Docs tasks

Checked by the Reviewer against the diff, not by tests — except the BIBLE task, whose status line story 1's test
already checks. Story 1's review carry-forwards (owner-ratified 2026-09-27, `reviews/tagging-edges/1-tagging-edge-contract.md`
§ "Re-review"): R2-4–R2-9 below; R2-NB1, R2-NB2 and R2-NB3 are carried by AC-2, AC-1 and AC-3; R2-10 is under
Test Design.

- [ ] **BIBLE.** §6's `TAGS` status line says what writes `TAGS` and how it runs; §6's Revokes bullet says the
      relationship follows the relay: it is removed when the relay no longer holds the tagging, by any route the
      relay honours, and stays while the relay holds it, even when a deletion the relay did not act on names it
      (AC-3; review F3 (a)–(c)); a §16 entry and the Last-updated line record it; story 1's check that "no pipeline
      writes `TAGS` yet" is updated in the same change.
- [ ] **OPERATIONS.md** says how the one-per-tagging rule reaches an existing instance and how to confirm it is
      there — the first schema addition since the constraints check began comparing by name.
- [ ] **R2-4:** ADR 0001's strfry bullet records strfry's remaining address-deletion divergences: addresses over
      255 bytes, a kind written with a leading `0`, `+` or space, and strfry matching the raw address where the
      definition lower-cases its pubkey.
- [ ] **R2-5:** the epic's stamp-pubkey guardrail says the writer refuses if *either* identity is missing or
      malformed, and story 2's ADR says "lowercase 64-hex".
- [ ] **R2-6:** clarification 9's `events.cpp` cite (`:57-60`) reads `:59-62`; ADR 0001's step 1 says strfry
      rejects a non-string `d` value; story 1's test plan says four clarifications.
- [ ] **R2-7:** ADR 0001's stance-bucketing paragraph matches BIBLE's qualified wording (`"NaN"`, `"-Infinity"`).
- [ ] **R2-8:** ADR 0001's step 5 matches clarification 11 (the element must be the event the tagging names; any
      error reading it counts as absent) and AC-1's identity-`d` rule.
- [ ] **R2-9:** story 1's test plan has no trailing blank line.

## Concepts touched

- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag` — nostr user tag,
  canonical stamp (the ADR 0015 literal). The concept whose elements are the taggings this pass reads.
- `39998:<TA>:nostr-user-tag` — nostr user tag, this deployment's own stamp (TA resolved at runtime via
  `GET /api/assistant/pubkey`).
- `39998:<TA>:tag` — tag (the tag elements a tagging names, read to resolve id-only taggings); canonical stamp
  `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag` alongside.
- `39998:<TA>:nostr-user` — nostr user (the relationship's two ends; this pass adds any that are missing).

## Out of scope

- **Carrying revokes between instances.** On an instance a revoke never reached, the tagging's relationship stands,
  because that relay still holds the tagging — 2 such taggings on production and staging today, which get
  relationships at the backfill. Tracked by ledger row `2026-09-27-revokes-do-not-travel`; fixing it is a router
  change per instance and needs nothing from this story.
- **The UI revoke naming the address** (row `2026-09-27-ui-revoke-names-id-only`). After an id-only revoke, an older
  version re-sent to the relay stands again, and so does its relationship (AC-2); the pass keeps no tombstone.
- **Cleaning test-fixture taggings off the shared relays** (row `2026-09-27-test-fixture-taggings-on-prod-relays`).
  They get relationships like any signed event (principle 2); read-time trust filtering is what excludes them. A
  later cleanup will trip AC-5's limit and go through on an owner-confirmed run.
- **Who may start a task.** Any signed-in session can start a registered task today (intake entry 2026-07-21,
  "gate authenticated-non-owner access to admin mutations"). This story adds no new way to start an ordinary pass;
  its one new control — confirming a run that applies held removals (AC-5) — is owner-only.
- **Adding the schedule to existing instances' schedule files.** Staging and production keep their files; the owner
  adds the entry there. Until story 3, relationships are as fresh as the last pass.
- **The production backfill as a criterion** (it follows the normal promotion to production and is recorded as the
  book's evidence), and **tags.brainstorm.world** (it deploys from its own branch).
- The real-time path (story 3) and any control-panel page (story 4).
- Importing taggings or tag elements as event nodes — the general letter ingest, OPEN.md row 136 stage 2.
- A provenance marker on the relationship — the system-wide provenance design (BIBLE §30) is still open.
- Registering `TAGS` as a relationship type, BIBLE §6's older naming drift, and documenting FOLLOWS / MUTES / REPORTS
  properties — ledger rows `2026-09-27-register-social-relationship-types`, `2026-09-27-bible-s6-relationship-name-drift`
  and `2026-09-27-social-edge-properties-undocumented`.
- Any change to follows / mutes / reports ingestion, or to any reader of taggings.
- Checking event signatures: the pass relies on the relay's verification, as the definition does. The path that
  imports other people's events without verifying them is OPEN.md row 276 (F3); this story does not widen it.

## Open questions

Settled by the owner at Planning (2026-09-27):

1. **Missing people are added.** A tagging whose tagger or tagged person has no NostrUser gets one, keyed by pubkey
   (principle 2; the follows pipeline does the same). About 5,850 per host at the backfill, nearly all fixture keys;
   the pass never removes them.
2. **Over the limit, removals are held and everything else applies** (AC-5). The limit is more than 10% of the
   tagging relationships and more than 50; a large legitimate removal goes through on a run the owner confirms.
3. **The graph agrees with this instance's own relay.** Cross-instance revokes are out of scope.

Proposed at Planning, to confirm at approval:

4. **The one-per-tagging rule is in place from deploy, with no owner step** (AC-6), so no instance shows it missing.
5. **Each run leaves a readable report** (AC-7) — the status shape story 4 builds on.
6. **The schedule ships as a disabled daily entry on fresh installs only;** on staging and production the owner adds
   the entry and turns it on.
7. **Evidence:** the suite's fixtures; a local end-to-end run on the public taggings, pulled down into the local relay
   only (its router streams are off; nothing is uploaded); then the staging backfill, started by the owner after the
   staging deploy — its report reads done, relationships added equal taggings read minus events refused, and a
   second pass straight after reports nothing added, changed or removed; the relay's tagging count is recorded
   beside it.
8. **Refinements that follow from 2 and 3:** a tagging moved to a different person is an update, not a removal
   (ADR 0001's guard counts retirements); a confirmed run removes only relationships the report the owner
   confirmed held, and only those still due for removal; each pass judges its removals against its own limit, so a
   hold is not remembered from one pass to the next; when the relay keeps a tagging that a deletion names, the
   relay wins (AC-3) — the census found no such case.
9. **One story, not split.** Eight criteria is past the planning guide's ~5, and they reach the database's rules,
   the task system and the Dashboard. They stay together because no pass may write before the one-per-tagging rule
   exists (AC-6, placed in this story at story 1's approval) or without its refusals, limit and report (AC-4, AC-5,
   AC-7). If the owner prefers a split, the seam is AC-6's status-check half, moved to a story ordered before 3.

For the Architect (the ADR must settle these; if one would change a criterion, kick back to Planning):

- **ADR 0001's binding stands:** every `TAGS` property is derived through story 1's module; nothing else composes
  those properties, and the pass adds no event-derived property the module does not produce (the REPORTS lesson,
  row `2026-09-27-reports-writers-disagree-on-shape`). Bookkeeping values: camelCase, never a contract property's
  name, never `timestamp`.
- **Every write and removal is conditional on the version it was decided from** (ADR 0001 binding), pinned by a parity
  test against `standingEdge`. That binding also re-checks the version order inside each write, and ADR 0001's
  retirement note says a writer fed from the local relay never sees an older version after a newer one; AC-2's
  revoke-then-re-send case breaks that assumption, so the ADR must say how the pass reaches AC-2's outcome.
- **R2-NB1:** guard the contract against a recorded time that can't be compared (qualifying clarification 10, with
  tests that also pin `null` and numeric strings), or bind the pass to hand it only values read straight from the
  database and re-derive a malformed one — pin whichever with a test (epic).
- **R2-NB3** becomes binding in the ADR, beside the limit: a relationship is removed when the relay holds nothing at
  its address, or holds a version there the definition refuses (AC-3).
- **Deletions:** ADR 0001 binds the pass to read kind-5 events from the same sources as taggings. With the relay
  winning where it ignores a deletion the definition honours (proposed 8; review F3 (a), (c)), the ADR says whether
  the pass still needs them and amends that consequence if not, and records that story 3 follows the same rule,
  so the real-time path never removes a relationship the next pass would restore.
- **The canonical stamp pubkey** comes without a new copy of the ADR 0015 literal: a lazy require inside the entry
  point, recorded as such (precedent `src/api/assistant/identificationTaggings.js:72`), or an ADR 0015 amendment
  moving the literal into a pure constants module (ADR 0001 Consequences).
- Whether the pass takes the shared `neo4j-heavy` lock (it would wait behind scoring runs, and they would wait to
  start while it runs), and its time-out — set from a local run at census scale, and checked against the staging
  backfill's reported duration.
- The two checks of expected database rules disagree today (the Dashboard lists 4 constraints and 1 index; the
  server check 7 and 18). AC-6 needs both to know the new rule, and any index the ADR adds (ADR 0001 hands "the
  uniqueness constraint and index on `TAGS.address` / `TAGS.eventId`" to this story).

For Test Design:

- R2-10: a retire-path case for clarification 9 (a newer non-tagging version whose over-long first `d` is followed by
  the tagging's `d` retires the relationship).
- The parity test above, over story 1's standing-rule truth table.
- Probe the refusals' bypasses (row `2026-09-22-rule-stories-need-bypass-probing`): one identity missing, upper-case
  or mixed-case, a malformed value from the environment, a time-out, a failed exit, a truncated answer, a failed
  tag-element read, a failed deletion read, removals counted toward the limit, a non-owner session or a schedule
  entry trying to confirm, and a confirmed run whose new read would remove relationships the confirmed report did
  not hold (an empty read included).
- Keep the canonical and local identities different, and cover taggings carrying each stamp alone and both.
- A live test that republishes at one address reads the current version first and publishes a strictly newer one
  (OPEN.md row 144); no live test publishes taggings through a relay whose router streams carry them outward.

## Deviations

- The graph port normalises every row itself (`toPortRow`, C6): it refuses before any transaction a row without an
  address, without the `snapshot` (or `row`) an update/move/removal needs or the `desired` a create/update/move needs,
  or whose `desired` is not for its own address; the caller's other keys are kept and reach `preimage`.
- The runner sends C6 rows (`{ address, snapshot, desired }` / `{ address, desired }`) and builds each pre-image from
  the snapshot row (any key outside the nine), not from a planner-only annotation, so any C6 caller gets one.
- planPass items carry `snapshot` and `strippedKeys` but no `row`, `rid` or `fingerprint` (the port computes the
  fingerprint); `limit` has no `confirmedApplied` key (the ADR's shape; `confirmed.removalsApplied` counts commits).
- A rejected apply carries `err.partial` (`{ applied, lostRace, nodesCreated, transientRetries, appliedAddresses }`
  of what committed before it), which the runner counts before `failed` / `write` (ADR step 11, "partial counts").
- `schemaStatusFromRows` also returns `nameTaken` in each rule's status, beyond C9's shape (a rule with another
  definition holds the name, so `CREATE … IF NOT EXISTS` would do nothing); `ensureTagsConstraint` and the boot hook
  read it. `graph.js` also exports `MAX_BATCH` (250, the runner's batch size), which the ADR's export list omits.
- `openGraph` takes only `{ uri, user, password }` (no injected driver, so `close()` never closes a shared one).
- When a rule with another definition holds the name `tags_address`, `ensureTagsConstraint` answers at once (no
  CREATE, no wait) and the boot hook logs `not created: name-taken (…)`; after its CREATE the hook re-reads SHOW and
  logs `not created: no-change (…)` unless the rule is now listed. Each line carries its code, then the reason in
  parentheses (review round 1, Blocking 2: the first version logged the reason alone).
- `planPass` throws on a non-array `snapshotRows` / `relayEvents` or a bad stamp identity, and `sweepFilter` on a bad
  identity (the runner turns a planner throw into `failed` / `plan`); `decideAddress` throws on a `relayAt` that is
  not a contract edge, a refusal, a conflict marker or nothing.
- `relationships.unresolved` also counts an unresolved stored relationship left at a relay-conflict address (plan
  count renamed `unresolvedUntouched`).
- `sweep.js` also exports `canonicalValue` (the pre-image's value serialisation, guard step 1) and `removalKey` (the
  one `(address, seenEventId)` key judgeRemovals, planPass and the runner share); neither is in the ADR's list.
- A confirmed run fills `confirmed` when the claim is honoured (`removalsApplied` counted as removals commit,
  `heldNoLongerDue` once the plan is made) and saves the record right after any claim, so a run that fails or stops
  partway still says it was confirmed. A stop asked for before step 7 ends the run without claiming.
- The driver-build refusal carries fixed text (`code: 'driver'`), and the report's error text replaces any URI and
  IPv4 `host:port` (the status route is public). Review round 1 (Blocking 1, Non-blocking 4): a Neo4j connection
  error (`ServiceUnavailable`, `SessionExpired`) also carries fixed text, keyed by `err.code` through a `Map` (so an
  inherited property name never matches), because the driver's text names the host; and every other error text,
  strfry's `stderrTail` included, passes one redactor, `redactPublicText`, which adds an absolute-path rule (a `/`
  that starts a word) after the URI rule. A relative module name (`'../../lib/x'`) is kept: the round-2 tests flag
  only absolute paths, and a stricter no-`/` rule would also cut ordinary text. No `name:port` rule, which would eat
  times.
- A `done` report's `reason` names lost races and conflicting addresses left to the next pass when there are any;
  each write phase's `PROGRESS` also carries `applied` and `lostRace`; the driver is closed after `TASK_END`.
- `defaultDeps().proc` is `process` and the entry calls `run({ proc: process })` (C2); the start time then comes
  from `state.processStartTime(pid)`. The `ownerAssistantPubkey` alias is gone (C1 names only
  `getOwnerAssistantPubkey`). The runner awaits `writeReport` (pessimistic and final), `appendPreimages`,
  `heldDigest`, `writeHeld` and `prune`; phase-boundary rewrites stay best effort.
- state.js writes with `writeFileSync` (which loops until every byte is written, and throws on an error such as
  ENOSPC), cuts a torn pre-image tail back off on failure,
  fsyncs the parent when it makes a directory, and `claimConfirmation` refuses a run id outside `RUN_ID_RE` and
  claims under a nonce only when it is 32 lower-case hex (C13).
- Status: an unreadable `confirmation.json` shows as `confirmationPending: { unreadable: <code> }` rather than a
  500 that hides the report; both handlers await `isAlive`, which also takes an async `readFile` (C11).
- Confirm: a failed `writeConfirmation` answers 500 naming the write; a withdraw that throws answers 500
  `withdraw-failed` saying the started pass may honour the record (the ADR's 409 assumes the withdraw worked).
- `scanStrict` rejects when `isExpected` is not a function (the ADR lists it as a completeness condition), when
  spawn gives no child (`spawn`), when the child had no stdout or its stdout errors (`process-error`); stderr errors
  are ignored. It exports `scanStrict`, `ScanError` and, since review round 1, `redactPublicText`: the one redactor
  lives in the lower layer, which the runner already depends on, rather than in a new file; the runner also passes a
  scan port's `stderrTail` through it at the report, so a port other than `scanStrict` is covered. Invalid UTF-8
  still decodes as U+FFFD (ADR D2's `setEncoding`); the header says so.
- The fresh-install seed is laid out one field per line like its neighbours (the ADR showed it on one line).
- Review round 1 (2026-09-28): the runner's header comment is qualified the same way as BIBLE §16 and §11 (a failed
  read of the graph snapshot or the relay changes nothing; a failed verify re-read leaves committed batches standing;
  a hand-run of the Node file is refused), beyond the review's list of places.
- Review round 1, Nit 6: the revokes ledger row's method parenthetical follows the Planning census's own request logs:
  the kind-5 reads ran at about 17:07Z on 2026-09-27, and "taggers" is the union across the three hosts (2,402) of the
  authors of the `nostr-user-tag`-stamped taggings the contract accepts, not each host's own.

## Evidence

- **Local end-to-end run** (story Open question 7), 2026-09-28, on the local instance, taken at the code of commit
  `64885ce7` before that commit was made; the one later implementation commit, `da787035`, changes only a comment.
  Figures from `GET /api/tagging-edges/status`:
  - Backfill `20260928T032430Z-08965d1d`: `done` in 2,595 ms. Phases (ms): identities 30, schema 98, graph-read 7,
    relay-read 72 (10,405 events, 8,227,479 bytes), plan 47, write-creates 2,330 over 29 batches. Added 7,030 =
    `taggingsRead` 7,030 − `refused.total` 0; `peopleAdded` 6,196; `unresolved` 6, as the census found on each host.
  - Second pass `20260928T032501Z-472c2596`: `done` in 524 ms, 7,030 unchanged; nothing added, changed or removed.
- **Graph snapshot around the backfill** (read-only Cypher), before → after: `FOLLOWS` / `MUTES` / `REPORTS` / `TAGS`
  0/0/0/0 → 0/0/0/7,030; relationships 4,989 → 12,019; nodes 4,467 → 10,663; `NostrUser` 3 → 6,199, none with a
  key other than `pubkey`, so the 3 pre-existing people are unchanged. After: no two `TAGS` share an address, every
  `TAGS` joins two `NostrUser` nodes and carries no key outside the nine (the 6 unresolved ones carry eight: a null
  `tagAddress` / `tagSlug` is not stored), and every `createdAt` is INTEGER.
- **What it does not show.** The local graph had no `FOLLOWS`, `MUTES` or `REPORTS`, so the run cannot evidence
  AC-8's clause that social relationships and scores do not move. The live sandbox's SL15 covers it: a scored fixture
  person with a `FOLLOWS` keeps its labels, properties and `FOLLOWS` after creates and moves that `planPass` plans and
  the pass's own port writes to the real Neo4j (green at review, test plan § Verification).
- **Staging backfill:** not yet run; OPERATIONS §12.8 "Measured durations" holds its line.

## Linked artifacts

- ADR: `engineering-team/decisions/tagging-edges/0002-gap-filling-pass.md`
- Test plan: `engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.test-plan.md`
- Review: `engineering-team/reviews/tagging-edges/2-gap-filling-pass-and-backfill.md`
