# Review: Story 3 — The real-time path

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-29
**Diff:** `git diff 891abe11...HEAD` (HEAD `bbbb6a24`; commits `50681e6b` story, `5ccb7aba` ADR, `cc57f22e` tests,
`3fc9b9ff` ADR Amendment A1, `8209bad7` A1 tests, `bbbb6a24` implementation). 63 files, about 24,700 lines, most of them
tests.

**How this review ran.** The Implementer's gate run was not trusted, so a reviewer ran the gate again. Five reviewers
then worked read-only in parallel, one per dimension: spec, ADR, what tests cannot catch, docs, and scope. Each
non-nit finding went to an independent skeptic told to refute it, and a completeness critic asked what the review
had not checked. 38 findings were raised. Five were harness friction; the other 32 went to skeptics, and all 32
were confirmed, none as blocking. The
verdict below is this Reviewer's: several findings are departures from the owner-ratified contract, and the role
does not let those pass silently.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` (Node 22.23.3, CI parity, committed tree, clean): `20260929T193454Z-32569-e6b9
  [review-tagging-edges-3] started 2026-09-29T19:34:54.919Z on bbbb6a24 — FAIL, exit 1, 4498 passed, 30 failed, 168
  skipped, 242/242 suites`.
  - The failures are the host's known live-stack set: the same 12 suites, 30 failures and failure names as story 2's
    last review run (`20260928T071120Z-87594-381c`), compared suite by suite. No regression.
  - Every difference is this story's: 7 new realtime suites and 4 grown suites, all passing (strfry-scan-strict 40,
    runner 77, state-routes 55, wiring 71). Two router suites came in with the staging base.
  - The run matches the Implementer's run `20260929T174846Z-64011-6363` suite for suite.
- [x] Opt-in property campaign (`TAGGING_EDGES_PROPERTY=1`): 36 passed, 0 failed, 0 skipped (53 s).
- [x] Live suite, read-only against the local Neo4j: 9 passed, 0 failed, 10 skipped.
  - SL17 (`readAt`) and SL18 (`readKeys`: 7,030 rows in 23 ms) pass.
  - SL19, the relay smoke test, skips because the relay answers only inside the container. It stays unverified here;
    both local end-to-end runs used the real subscription instead.
- [ ] `npm run test:playwright`: not applicable (no UI in this story).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has passing tests. The spec reviewer mapped AC-1…AC-7 and items 1–15 to named tests
  in the plan, engine, lineage, resilience, property, routes, wrapper, wiring, runner and state-routes suites.
- [x] No criterion is silently dropped. Two thin spots remain:
  - AC-6's `leftInPlace` count is always 0 for the path by construction, and only a key-presence test covers it
    (non-blocking 6).
  - Item 10's owner switch has never been exercised live along its success path (non-blocking 7).
- [x] No behaviour beyond the story, apart from the deviations listed under the ADR check.

## ADR adherence

- [x] Files match the Implementation notes as amended (A1-18, A1-19).
- [x] Layering holds:
  - the planner is pure (the contract suite's purity and no-64-hex guards);
  - writes go only through `graph.js`'s port, and `decideAddress` is unchanged;
  - there is no pass lock, `neo4j-heavy` lease or `report.json` write (wiring SWR63);
  - no new dependency.
- [ ] **Not every behaviour matches the owner-ratified text.** Blocking 1 lists six departures from the ADR as amended
  and ratified. Five are logged in § Deviations; one is not. Each is reasonable, and none is harmful. But the ADR is
  the contract, and OPERATIONS §12.9 already documents several of them as settled behaviour. So today the code, the
  runbook and the ADR disagree.

## Concept-graph integrity

- [x] No concept definition or firmware JSON changed, so no firmware reinstall is needed (ADR § Consequences). The
  ADR 0015 literal is reached only through its existing server constant (`NOSTR_USER_TAG_Z_TAG`). The TA pubkey is
  resolved at runtime (`getOwnerAssistantPubkey`).
- [x] Not applicable otherwise: the path reads no concept through BIBLE.

## Things tests can't catch

- [x] No secrets committed. A reviewer grepped the diff for keys, nsec, passwords and tokens: none.
- [x] No leftover debug logging or commented-out code. The engine logs through its injected `log()`. The scratch-only
  labels from the prototype were removed (`bbbb6a24`).
- [ ] Error paths: a catch-up step's unexpected error wedges catch-ups (blocking 2).
- [x] Concurrency. Checked:
  - journal, record and epoch ordering, and compaction atomicity;
  - off within 5 s, and a second TERM;
  - the wrapper's flock and fd 8;
  - the one-activity scheduler after the catch-up split.

  Unbounded buffers under a failing disk or a failing baseline are non-blocking 1 and 2.
- [x] Security:
  - the owner-only POST and the public GET (auth matrix, same-host and JSON checks);
  - the public status carries fixed text and allow-listed codes only;
  - strfry is spawned with no shell, and the filter is size-checked before spawn (`filter-too-large`);
  - the switch file is written through `state.writeAtomic`.

  The widened redactor has a quadratic worst case (non-blocking 4).

## House rules check

- [x] Concept Graph API authority respected (the story touches no concept definition).
- [x] No new lint, typecheck or build tooling.

## Findings

### Blocking

1. **Six departures from ADR 0003 as amended and ratified.** For each: conform the code, or have the Architect record
   an A1 clarification for the owner to ratify. Either way, add a test that pins the chosen reading where none does.
   My recommendation follows each item.
   - **(a) `src/pipeline/tagging-edges/realtime/index.js:1838`: the park rule for single time-outs.** A single
     time-out counts toward the time-out park only when the address was marked, or some relay read answered since it
     was queued or last timed out alone. A1-13 says "after three consecutive single time-outs the address is parked",
     and decision 9 says "each is parked after three". The departure fixes a real defect: the literal rule parked a
     lone change during a Redis stall for 5 minutes, breaking clarification 11's bound. No test tells the two readings
     apart. *Recommend: ratify, and amend decision 9's "parked after three" to "while other relay reads answer". Add a
     quiet-stall test: one lone change through a total stall is reflected within clarification 11's bound and is never
     parked.*
   - **(b) `index.js:729`: a live kind-5 lifts a time-out park.** Clarification 12 names only a new version. The
     behaviour is harmless, since a new version already lifts the park. *Recommend: ratify, adding "or its author's
     revoke that resolves there" to clarification 12, with a test.*
   - **(c) `index.js:1823`: an element read alone that times out counts in `failedReads.element`.** Clarification 12
     says each single time-out counts in `failedReads.relay`. OPERATIONS documents the code's choice. *Recommend:
     ratify, as a one-line note to clarification 12.*
   - **(d) `index.js:1155`: the compaction cut widened.** `learnedSince` now starts at the catch-up's key read, not
     at the stamp scan's capture. That follows from splitting the catch-up's reads (A1-11), but the ADR still says
     "learned after the capture" (A1-7). It keeps more `older` ids, so clause (ii) is wider than A1-7 states.
     *Recommend: ratify, as A1-7 read with A1-11: "learned after the catch-up's key read".*
   - **(e) `src/pipeline/tagging-edges/graph.js:228`: a pass-side behaviour change.** `readSchema` gained a 30 s
     default transaction time-out. The pass's pre-flight and `ensureTagsConstraint` call it with no argument, so story
     2's pass now has a schema-read time-out it did not have. ADR 0003 says the pass's behaviour must not change.
     *Recommend: conform. The path passes its own `timeoutMs`, and `readSchema`'s default stays as it was.*
   - **(f) `index.js:1024`: a catch-up lifts every database-refusal park.** This one is not logged in § Deviations. A
     parked version never enters `S`, so it is an arrival at every catch-up, and the safety diff re-queues every
     refused address every 10 minutes. The owner-approved schedule is 5 min, 30 min, then every 6 h, at every start,
     and at once on a new event. With many refused addresses that is a burst of failing writes every safety diff.
     *Recommend: conform. Merge a catch-up's work into a refusal park as `feedCatchUp` already does for time-out
     parks.*

2. **`index.js:1137-1144` and `:2100-2106`: an unexpected error in a catch-up step wedges catch-ups.** `catchUpStep`
   sets `c.step = null` and awaits the step with no try/catch. `runActivities` logs the error and swallows it, and
   `cu.running` stays set. From then on:
   - no catch-up runs again, the safety diff included, and neither does a reconnect, pass-end or backlog catch-up;
   - this lasts until the process restarts;
   - meanwhile the status says `catching-up`, which looks normal.

   The ADR says an uncaught error ends Node after writing the status. The skeptic reproduced the wedge. *Asked change:*
   end the catch-up on an unexpected step error, with `failCatchUp(c, 'unexpected', err)` and its 5→60 s backoff, or
   route it to `crash()`, and add an engine test.

3. **`ledger/2026-09-29-strfry-delete-hides-next-write.md:19-22`, `OPERATIONS.md:842` and ADR 0003 A1-16 (10): the
   strfry defect is described wrongly.** A reviewer read strfry 1.1.0's source in the container (commit `f31a1b9`).
   - A new event takes `get_next_integer_key`, the largest key plus one (`golpe/external/rasgueadb/modify.h.tt`,
     `main.h.tt`). So the mechanism is confirmed, not "likely".
   - Expiry cannot trigger it: the expiry cron skips the most recent event, "because it could cause levId re-use"
     (`src/apps/relay/RelayCron.cpp`).
   - Live monitors skip every event whose id is at or below the last one they sent (`src/ActiveMonitors.h`,
     `process`). So deleting the K newest events hides the next K writes.
   - A wipe hides every write from a live subscription until the ids pass the old largest one, or it re-subscribes.
     That is not one event: a running path stays deaf to live deliveries until it reconnects, and meanwhile only its
     10-minute safety diff reflects changes.

   The Reviewer read these three files in the container's strfry 1.1.0 source.

   *Asked change:*
   - correct the row: the mechanism is confirmed with those cites, expiry is dropped, deleting the K newest events
     hides the next K writes, and a wipe leaves the path deaf;
   - drop "(or an expiry)" from OPERATIONS;
   - add to OPERATIONS: after a relay wipe or a bulk operator delete, restart the path with `supervisorctl restart
     tagging-edges-realtime`;
   - the Architect corrects decision 10's first bullet the same way.

4. **ADR 0001:224-225, and ADR 0003:621 and :811-812: the text says the path "starts, subscribes and waits in
   `waiting-setup`" on a bad setup.** With a bad identity it never subscribes, because its filter needs both
   identities (`index.js:2041-2047`, and the engine suite). *Asked change (Architect wording):* "starts and waits in
   `waiting-setup` without subscribing; what the relay stores meanwhile is found by the catch-up at the next start
   with a usable identity, or counts as pre-existing at a first start".

### Non-blocking

1. **`index.js:411`.** While journal appends keep failing (a full disk), lines pile up in memory with no cap, and
   rounds keep writing to the graph. Document it (§ Failure handling, OPERATIONS §12.9), or cap the buffer and pause
   rounds.
2. **`index.js:742`.** A first start's version buffer is unbounded while the baseline scan keeps failing. The
   20,000-target cap covers kind-5s only. Dropping versions is unsafe (they would count as baseline), so state the
   bound in the ADR, or restart the baseline with a fresh REQ past a cap.
3. **`run.sh:58-66` and § Evidence.** Past the measured heap ceiling (about 245,000 stamped taggings) the path will
   crash-loop, and anyone can publish stamped taggings. Say in OPERATIONS §12.9 what that looks like and what to do:
   turn the switch off, and watch `seen`.
4. **`src/lib/strfryScanStrict.js:76`.** The widened host:port rule is quadratic on long dotted or hyphenated text,
   and callers redact the whole text before cutting it to 300 characters. Cap the input (for example 4 KB) before
   redacting. Note beside the ADR's New debt line that an underscore host name (`tapestry_neo4j_1:7687`) is not
   redacted.
5. **`OPERATIONS.md`, several places.**
   - `statusUnreadable` implies `running` still answers; it reads false while `status.json` is unreadable (:800).
   - The state-file list omits `started.json` (:773).
   - Step 1 points to §12.8 and story 2's Evidence for the staging backfill. Both still say it has not run: it ran on
     2026-09-28, and that evidence waits in the unpushed docs-lane commit `2361dfb0` (:808).
6. **AC-6 `leftInPlace`** is 0 for the path by construction. Say so in OPERATIONS §12.9 (the pass's report carries
   the real figure), or pin the value with a test.
7. **Item 10's switch.** Its success path (a signed-in owner's same-origin POST) first runs live at staging step 3.
   Add to OPERATIONS what a 403 means there.
8. **`src/pipeline/tagging-edges/realtime/subscription.js`.** The only websocket client has no automated test: 0 of
   its lines run in any suite. The two local end-to-end runs exercised it live. Tester follow-up: a suite against an
   in-process `ws` server.
9. **Dead code and duplication.**
   - `subscription.js:43` and `:167`: `reconnectDelayMs`, `DEFAULT_RELAY_URL` and `SUBSCRIPTION_ID` are exported
     but unused, and the engine keeps its own copy of the schedule.
   - `index.js:789`: the subscription's close reason is dropped, so a relay refusing the filters shows only as a
     reconnect loop. Log it; it is already fixed text.
   - `index.js:217`: `mergeEntry` duplicates the planner's copy with one difference.
   - `failCatchUp` repeats `graphDown`'s backoff.
10. **`index.js`'s structure.** `makeEngine` is one 2,071-line closure, and `roundBody` is 455 lines of nested closures
    over shared round state. Not for this merge: a follow-up to split `roundBody` into read, decide, write and settle
    over an explicit state object.
11. **`ledger/2026-09-28-lock-check-accepts-any-flock.md:7`.** Its Done date says 2026-09-28; the fix was committed on
    2026-09-29 (`bbbb6a24`).
12. **`docs/TAGGING_EDGES_HANDOFF.md:3`.** It says story 3 is "in implementation again"; it is in review.
13. **The heap ceiling in § Evidence** (240,000 taggings) is the Implementer's measurement. It was not re-derived here,
    and its harness lives in scratch space. That is acceptable at a 34× margin over today's 7,030. Commit the harness
    only if the owner wants the revisit trigger re-runnable.

### Harness friction *(each becomes a `meta` ledger row)*

1. **Doc tests that pin a Last-updated line's newest entry break at the next story.** Story 2's S2C16 asserts that the
   newest BIBLE entry names tagging-edges #2. Story 3's BIBLE head had to carry "(CF-3 from tagging-edges #2's review)"
   to keep it green, and neither Test Design round re-aimed it. It now steers doc wording. Filed as ledger row
   `2026-09-29-newest-entry-doc-tests-go-stale`.
2. **The test plan maps acceptance criteria to tests, never real modules to tests.** With T20's injected seams every
   suite fakes the real dependencies, so a shipped module can go wholly untested (non-blocking 8) and no row notices.
   Filed as ledger row `2026-09-29-test-plan-misses-injected-seams`.
3. **Dimension reviewers get contradictory instructions.** The reviewer agent's wiring says to commit and flip the
   status, while the brief says read-only. This corroborates OPEN.md row 316 again; no new row.

## Verdict

**CHANGES_REQUESTED**

The story's behaviour is met and well evidenced:
- every acceptance criterion is covered by passing tests;
- the gate shows no regression;
- the property campaign is clean;
- two local end-to-end runs reflected every way in within 0.44–0.78 s.

Four things stop it merging as-is:
- six departures from the owner-ratified ADR text, one of them unlogged and one reaching into story 2's pass
  (blocking 1);
- a wedge that can silently stop the safety diff (blocking 2);
- an operator-facing description of a strfry defect that misses its real consequence, a path left deaf after a wipe
  (blocking 3);
- ADR text that says the path subscribes when it does not (blocking 4).

Each fix is small. Blocking 1 and 4, and decision 10's wording in blocking 3, need the Architect's notes and your
ratification. Blocking 2, the conform items 1(e) and 1(f), and the doc corrections in blocking 3 are the
Implementer's. The non-blocking items are cheap enough to take in the same round.

## On PASS (same commit)

- [ ] Story `**Status:**` flipped to `Done` in place. *Not applicable: CHANGES_REQUESTED.*
- [ ] Completion detection performed; `/close-book` offered if the book looks complete. *Not applicable.*
