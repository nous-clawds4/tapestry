# Review: Story 3 — The real-time path

**Verdict:** **PASS** (after re-review; see "Re-review, round 3" at the bottom. Rounds 1 and 2 asked for changes;
every blocking item is fixed, and ten non-blocking points are carried forward.)

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

## Re-review, round 2 (2026-09-29)

**Diff:** `git diff bbbb6a24..3e3d9870`, without the review's own commits. It covers:
- `d9d0ccf8`: ADR 0003 A1 clarifications 20–25, with 20–23 ratified by the owner, and ADR 0001's A3 note corrected;
- `a5273b05`: the tests (RX20–RX25, RL28, SWR72, RE81, the new subscription suite RSUB1–8, S2C16 re-aimed);
- `3e3d9870`: the fixes and docs.

As round 1, the Reviewer's gate ran independently, reviewers worked read-only, and each finding had a skeptic. Every
round-1 ask was re-derived as a fresh claim (reviewer.md step 10). That includes wording round 1 itself suggested and
the Architect adopted, and it was checked against strfry 1.1.0's source in the container (commit `f31a1b9`).

### Quality gates

- [x] `npm test` (Node 22.23.3, clean committed tree): `20260929T230728Z-59268-f5cc [review2-tagging-edges-3]
  started 2026-09-29T23:07:28.416Z on 3e3d9870 — FAIL, exit 1, 4515 passed, 30 failed, 168 skipped, 243/243 suites`.
  - The 12 failing suites and 30 failures are identical to round 1's run, compared suite by suite.
  - All 5 differences are this round's tests, all passing: wiring 72, engine 81, lineage 28, resilience 25, and the
    new subscription suite at 8. That is +17 passes and no regression.
- [x] Opt-in property campaign: 36 passed, 0 failed, 0 skipped.
- [x] Live suite, read-only: 9 passed, 0 failed, 10 skipped, as round 1. SL19 is still unverified from the host.

### Round 1's asks

| Round 1 item | Status | Evidence |
|---|---|---|
| Blocking 1(a)–(d) | **Fixed** | Clarifications 20–23 match the code. RX20–RX23 and RL28 pin them. Each was checked against a mutant: `slow = true`, `slow = item.single`, merging instead of lifting, relay counting, and capture-only. |
| Blocking 1(e) | **Fixed** | `readSchema()` with no argument is byte-identical to the base (`graph.js:233-242`). The path passes 30 s. SWR72 and RE81 were red at `a5273b05`. |
| Blocking 1(f) | **Went too far**: new Blocking R2-3 | Merging a re-found version into a refusal park is right. Merging a *new* version or revoke delays it up to 6 h. |
| Blocking 2 | **Partly fixed**: new Blocking R2-2 | The wedge is gone. But after the stamp scan the backoff never grows. |
| Blocking 3 | **Partly fixed**: new Blocking R2-1 | Expiry is dropped, the restart advice is added, and the cites are right. The mechanism wording is wrong, and it was round 1's own suggestion. |
| Blocking 4 | **Fixed** | ADR 0001's A3 note, ADR 0003:621 and :811 now match `index.js` (no subscription with a bad identity). |
| Non-blocking 1, 2 | **Partly fixed** | OPERATIONS documents both correctly. The ADR's § Failure handling has neither (R2-NB5). |
| Non-blocking 3, 6, 7, 8, 9, 10, 11, 12 | **Fixed** | Checked in the diff and by the new tests (RSUB1–8 cover the real client). |
| Non-blocking 4 | **Partly fixed** | The 4 KB cap works: 4 ms on 1 MB, where uncapped text takes 3.6 s on 64 KB. But no test pins it, and the underscore note is not beside the ADR's New debt line, though § Deviations says it is (R2-NB3). |
| Non-blocking 5 | **Partly fixed** | `statusUnreadable` and `started.json` are fixed. The staging-backfill pointer (OPERATIONS:754, :808) waits on docs-lane commit `2361dfb0`, and § Deviations does not say so (R2-NB4). |
| Non-blocking 13 | n/a | Nothing was asked unless the owner wants the harness. |
| Harness friction 1, 2 | **Filed** | Ledger rows `2026-09-29-newest-entry-doc-tests-go-stale` and `2026-09-29-test-plan-misses-injected-seams`. The first row's text is stale now that S2C16 is re-aimed (R2-NB8). |

### Findings

#### Blocking

1. **R2-1: clarification 24 (ADR 0003:2272-2278), decision 10's corrected bullet (ADR 0003:1902-1903), the ledger row
   `2026-09-29-strfry-delete-hides-next-write` (title, :21-29, :39, :48-50, and the fix shape at :55), OPERATIONS.md:843
   and story :714-715 misstate strfry's mechanism.** This is round 1's suggested wording, adopted verbatim and labelled
   "confirmed in strfry's source". The Reviewer re-read the source this round:
   - **The largest id.** A new event takes the largest id plus one (`golpe/external/rasgueadb/main.h.tt:156-158`,
     `modify.h.tt:155`). strfry writes a new event before it deletes what that event replaces or revokes
     (`src/events.cpp:380`), and the expiry cron skips the newest event (`src/apps/relay/RelayCron.cpp:31`). So only an
     operator's `strfry delete` or a wipe can lower the largest id.
   - **Who misses a write.** The monitor thread lowers its cursor to the new largest id (`RelayReqMonitor.cpp:26-27`),
     so a write that re-uses an id is still visited. Each subscription's monitor then skips any event at or below the
     highest id it has passed (`ActiveMonitors.h:93-98`). That is the last event sent to it, the last event carrying
     its filter's index key (for the path, a stamp `z` tag or kind 5, `ActiveMonitors.h:167-195`), or the newest event
     when it subscribed (`RelayReqMonitor.cpp:41-43`). So "hides the next K writes from live subscriptions" is too broad:
     it depends on the subscription.
   - **The count.** The count is not K. At least K ids are re-used, and more where earlier deletes left gaps below the
     newest event.
   - **The debounce race.** If a write lands within the 100 ms change debounce of the delete (`RelayReqMonitor.cpp:10`),
     the thread never lowers its cursor and never visits the re-used id (`:56`). Then *every* live subscription misses
     it.
   - **A wipe.** A subscription misses writes until the ids pass the point its own monitor had reached, which is at
     most the old largest.

   Correct and to keep: expiry, kind-5s and replaced versions never trigger it; the restart-after-a-wipe-or-bulk-delete
   advice; the safety-diff backstop.

   *Asked change:* the Architect rewords clarification 24 and decision 10's bullet to these facts. The Implementer
   carries the same wording into the ledger row (title, mechanism, impact and fix shape: "as many harmless writes" is
   not enough when there are gaps), OPERATIONS:843 and § Evidence. **Re-check the new wording against the cites
   before adopting it; this list is a claim too.**
2. **R2-2: `src/pipeline/tagging-edges/realtime/index.js:1253-1254` and `:1031-1033`: an unexpected error after the
   stamp scan retries every 5 s, forever.** `cu.failures` and `cu.retrying` are reset as soon as the stamp scan
   succeeds, so `failCatchUp` computes the first backoff every time. That is a full key read plus a full stamp scan
   every 5 s: 121 of each in 10 minutes in the skeptic's reproduction. For comparison, an error in the key-read step
   backs off 5, 10, 20, 40, 60 s. § Deviations (:866), OPERATIONS:794 and the comment at `:1099` all claim 5→60 s.
   RX25 injects only in the key-read step and accepts any gap from 5 to 60 s, so it cannot see this. *Asked change:*
   reset the failure count when a catch-up completes, not when its stamp scan succeeds. Pin it with a test that
   injects after the stamp scan and asserts growing gaps.
3. **R2-3: `index.js:1046-1055`: a catch-up merges a *new* version or revoke into a database-refusal park, so it waits
   for the park's timer (up to 6 h).** ADR 0003 § Failure handling (:609-611) retries a refusal park "at once on a new
   event at that address". That is also what round 1 asked to keep. Round 1's concern was the same parked version being
   found again at every safety diff.
   - The skeptic reproduced it: an acceptable v2 whose notice was lost is reflected after 350.2 min at `3e3d9870`,
     against 5.0 min at `bbbb6a24`.
   - RX24 pins the wait while citing the ADR's "at once on a new event", so its own citation contradicts it.

   *Asked change:* a catch-up entry carrying a version id or a revoke the parked entry does not already hold lifts the
   refusal park. One that holds nothing new merges. Re-aim RX24 into both cases. The Architect records this reading as
   a clarification.

#### Non-blocking

1. **R2-NB1.** Clarification 20 and OPERATIONS:841 say a never-answering address in a total stall "retries at most once
   a minute". It backs off 5→60 s first, then retries once a minute.
2. **R2-NB2.** Two parts of round 1's Blocking 2 fix have no test: the `feedCatchUp` branch through `attempted()`, and
   the rule that an `unexpected` failure is not counted in `failedReads.catchUp`.
3. **R2-NB3.** Several gaps around the redactor:
   - no test pins the 4 KB cap (`strfryScanStrict.js:74`), and it also changes story 2's pass report, which the
     Deviation does not say;
   - "too much is cut, never too little" (:69) holds only for the name rule;
   - the redactor's known gaps are not beside the ADR's New debt line (ADR 0003:896), though § Deviations says they
     are: underscore host names, host names that start with a digit, and credentials written without a scheme.
4. **R2-NB4.** § Deviations should say that the staging-backfill pointer (OPERATIONS:754, :808) waits on the docs-lane
   commit `2361dfb0`.
5. **R2-NB5.** ADR 0003 § Failure handling (:583-640) has no line for journal appends that keep failing, and none for
   the first start's version-buffer bound. OPERATIONS covers both. The Architect adds one line each.
6. **R2-NB6.** OPERATIONS:847 gives "about 240,000" as the heap ceiling. § Evidence gives 200,000 when every address is
   an arrival.
7. **R2-NB7.** The planner's `mergeEntry` became stricter (`realtime.js:618`): a damaged record row now replays to no
   prompt. No test pins it.
8. **R2-NB8.** Stale texts:
   - the compaction comment at `index.js:1061-1062` still says "after the capture";
   - the subscription suite's header (:35) and test plan :143 name exports that `3e3d9870` removed;
   - the ledger row `2026-09-29-newest-entry-doc-tests-go-stale` still says S2C16 was not re-aimed.
9. **R2-NB9 (optional).** No test covers the new close logging (`index.js:846`). AC-6 holds anyway: the text is fixed
   and redacted, and it goes only to the supervisor log.

### Verdict (round 2)

**CHANGES_REQUESTED.** Round 1's six ADR departures are settled, and the wedge is gone. But the round introduced two
defects (R2-2 and R2-3) and carried a false mechanism statement into the ADR and the upstream-bound ledger row
(R2-1). R2-1 is round 1's own suggestion, which is exactly what reviewer.md step 10 exists to catch. All three fixes
are small.

## Re-review, round 3 (2026-09-30)

**Diff:** `git diff 3e3d9870..38131061`, without the review's own commit `ea227cec`. It covers:
- `799bd9f6` and `747752b8`: ADR 0003 clarification 24 rewritten, clarification 26 added, clarification 20's wording,
  two § Failure handling bullets, and the redactor's gaps beside New debt;
- `00523448`: tests (RX24 split, RX26–RX28, RE82, RP97, SS41, stale texts);
- `38131061`: fixes and docs.

The method was round 2's. Every round-2 fix was re-derived as a fresh claim, including the wording round 2 itself
suggested. Every universal, count and citation in the strfry text was checked against strfry 1.1.0's source in the
container (commit `f31a1b9`).

### Quality gates

- [x] `npm test` (Node 22.23.3, clean committed tree): `20260930T004706Z-57038-50d9 [review3-tagging-edges-3]
  started 2026-09-30T00:47:06.426Z on 38131061 — FAIL, exit 1, 4521 passed, 30 failed, 168 skipped, 243/243 suites`.
  - The 12 failing suites and 30 failures are identical by name to rounds 1 and 2.
  - The four suite differences are this round's six new tests: strfry-scan-strict 41, plan 94, engine 82,
    resilience 28. No regression.
- [x] Opt-in property campaign: 36 passed, 0 failed, 0 skipped.
- [x] Live suite, read-only: 9 passed, 0 failed, 10 skipped, as before.

### Round 2's asks

| Round 2 item | Status | Evidence |
|---|---|---|
| R2-1 (strfry mechanism) | **Fixed in substance** | The three errors round 2 blocked on are gone: "every subscription", "exactly K", and "a wipe deafens until reconnect". Every cite checks out: `main.h.tt:156-158`, `modify.h.tt:155`, `events.cpp:368-387`, `RelayCron.cpp:22,31`, `cmd_delete.cpp:45-76`, `RelayReqMonitor.cpp:10,21-27,41-43,50-58`, `ActiveMonitors.h:93-98,167-195`, and the debounce in `file_change_monitor.h:108`. Four precision points remain (C1–C4). |
| R2-2 (backoff) | **Fixed** | The failure count resets only at a completed catch-up. RX26 was red at `00523448` (a flat 5.0 s) and passes now with 5, 10, 20, 40, 60, 60 s. The reviewers' own mutants are caught. |
| R2-3 (refusal parks) | **Fixed** | `bringsNew` lifts a refusal park for a new version or revoke. RX24(b) and RX28 were red at `00523448` and pass now; RX24(a) (merge) passes. Two readings remain for the owner's record (C5), and two halves are unpinned (C6). |
| R2-NB1–NB4, NB6–NB9 | **Fixed** | Clarification 20's wording; RX27 for the `attempted()` branch and the `unexpected` accounting; SS41 for the 4 KB cut; the redactor's gaps beside New debt; the staging-backfill pointer in § Deviations; the heap range; RP97; the stale texts; RE82. |
| R2-NB5 (§ Failure handling) | **Partly fixed** | Both bullets were added. The first-start bullet checks out. The journal bullet is not accurate (C7). |

### Carry-forwards (non-blocking; for the owner to place in story 4's docs tasks or a ledger row)

1. **C1: strfry's mark is per index key, not per subscription.** This concerns clarification 24's "Who misses" bullet
   (ADR 0003:2292), the ledger row (:36-40, :54-56), OPERATIONS:843 and § Evidence. strfry keeps the mark per
   (filter, index-key value) and checks only the keys the write itself carries (`ActiveMonitors.h:93-98, :167-195`).
   So a write is skipped at or below the last event sent to that subscription, the last event with *the same*
   index key as the write, or the relay's newest event when it subscribed.
2. **C2: `ledger/2026-09-29-strfry-delete-hides-next-write.md:44`.** The clause "the thread never sees the largest id
   fall" is false when a delete freed more ids than the writes before the next wake re-use. The real reason: the
   thread lowers its cursor only to the largest id present when it wakes, which already includes the write.
3. **C3: the debounce condition.** Clarification 24's debounce bullet and § Evidence :718-719 say "within 100 ms".
   The exact condition is the ledger's "stored after the delete and before the monitor thread next wakes (normally
   within about 100 ms of the first change)". All three wakes (a REQ, a CLOSE, a closed connection) should be listed,
   and a wake spares only the subscriptions on that thread.
4. **C4: "at least one per event deleted"** in OPERATIONS:843 and § Evidence :715-716 should say "per *newest* event
   deleted", as the ADR and the ledger do. Test plan :143 should take clarification 24's wipe wording.
5. **C5: clarification 26's readings.**
   - `bringsNew` (`index.js:250`) reads "a revoke the parked entry does not already hold" by effect: a revoke for the
     same (by, target) with a created_at no later is held. So a second, back-dated kind-5 found by a catch-up waits
     for the timer, though live it would lift the park at once. The Architect should state the effect reading in
     clarification 26.
   - "The same refused version, found again … costs no write" (ADR:2317; OPERATIONS:842; the comment at
     `index.js:1074-1076`) fails when the parked entry lacks that version's id. The cost is bounded: one extra retry
     per park episode. Record the refused id on the park, or reword the three places.
6. **C6: two halves of clarification 26 are unpinned.** A refused removal's kind-5, found again at a safety diff,
   should merge. A version arriving at a park for a refused removal should lift it. The Tester adds both.
7. **C7: the § Failure handling journal bullet (ADR 0003:622), for the owner.** It says the status shows `lastError`
   `journal`, but on a full disk `status.json` cannot be written either; OPERATIONS:845 correctly says the status goes
   stale. It files the loss under decision 5's second corner, which the owner ratified as ≤ 250 ms before a crash, yet
   the loss window here is the whole failing spell. And an off meanwhile also loses the unwritten lines. **This widens
   an owner-ratified corner without ratification**, so the owner should acknowledge the widening or ask for a bound.
   The Architect then rewords the bullet. *(Owner decision 2026-09-30: the widening is accepted. The rewording is a
   docs task of story 4.)*
8. **C8: SL19 has never run.** The relay smoke test skips from the host, because the relay answers only inside the
   container. Both local end-to-end runs used the real subscription and filters against the real relay (EOSE and
   deliveries), which is evidence for the same claim. Run SL19 once inside the container, or retire it in favour of
   the end-to-end evidence. *(Done 2026-09-30: SL19 passed inside the local container; story 3 § Evidence, "SL19,
   the relay smoke test".)*
9. **C9: harness friction.** In one Node process, SS36 fails after the routes suite has loaded, because its
   `forget()` list lacks `src/lib/strfryScanStrict.js` (first seen at Implementation). The registry's order avoids it
   in the real gate. The Tester adds the file to the routes suite's FORGET list.

**Placement (the owner, 2026-09-30).** All nine are placed under story 4: `epics/tagging-edges.md` item 4,
"Carry-forwards from story 3's review". C2's ledger half was fixed at once and C8 is done; the other seven are story
4's docs or test tasks.

### Verdict (round 3)

**PASS**

Every blocking item from rounds 1 and 2 is fixed and pinned by tests that were red before their fix. The gate shows
no regression across three runs. The carry-forwards are precision points in prose, two unpinned halves of a
clarification, and one owner acknowledgement (C7). None changes what the path does to the graph beyond what the
ratified ADR allows, and none is a data-loss or security risk.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection: book `tagging-edges` is not complete. Its acceptance frame still needs story 4, the
  front end to manage the pipeline. No `/close-book` offer.

