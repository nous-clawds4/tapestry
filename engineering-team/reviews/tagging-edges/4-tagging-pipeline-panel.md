# Review: Story 4 — The tagging pipeline panel

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-01
**Diff:** `git diff 66d60cb5..a2f38940`: the story (`66d60cb5`), ADR 0004 with ADR 0003's amendments (`88af7df3`), the
failing tests and T1–T11 (`e6f124ea`), and the implementation (`a2f38940`). The two docs-lane commits below the story on
this branch (`4c5f31ed`, `a852f707`) were read for staleness only.

**Method.** Seven lenses walked the diff: the story, the ADR, the server, the UI, the copy, the docs and hygiene. Each
of their 30 findings then went to its own skeptic, who defaulted to refuting it.
- **Refuted:** 4.
- **Stand:** 26: 1 blocking, 17 non-blocking and 8 friction. The friction items are re-sorted below.
- **Checked and found correct:** 95 items, kept in the session scratchpad (`rev/checkedok.txt`).

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`**, run on a worktree at `a2f38940` under Node 22.23.3:
  `20261001T001049Z-59461-ddb6 [te4-review-a2f38940] on a2f38940 — FAIL, exit 1, 4729 passed, 30 failed, 177 skipped,
  250/250 suites`.
  - Suite by suite, it differs from the baseline at `88af7df3` (`20260930T195708Z-12825-9302`: 4,533 / 33 / 177 / 244)
    only in these:
    - **The six new suites, all green:** strfry-count-strict 23, tagging-edges-drift-route 27, tagging-pipeline-view 58,
      tagging-pipeline-codes 39, tagging-pipeline-fetch 19 and tagging-pipeline-panel-source 25.
    - **tagging-edges-realtime-resilience:** 28 → 30, with RX29 and RX30.
    - **dictionary-concepts:** 22/3 → 25/0. That is not this story's change. The local backend had run code from
      2026-09-29 until it was restarted at 22:17Z for the local check, so the route merged in #789 had not loaded
      (ledger `2026-09-20-live-tier-fails-on-stale-stack`).
  - The 12 remaining failing suites are the baseline's live-stack suites, failing identically.
  - `git diff e6f124ea..a2f38940 -- test tests` is empty: Phase 4 touched no test.
- [x] **The browser spec**, run by the reviewer on a fresh container build of `a2f38940` (served from the gitignored
  `tmp/`, Node 22, Chromium): 44 passed, 0 failed. B0's bundle guard passed, and the served bundle's fetches confirm the
  run used that build.
- [x] _Lint not configured: skipped._ `scripts/harness-lint.sh` exits 0.
- [x] _Typecheck not configured: skipped._
- [x] _Build not configured: skipped._

## Spec adherence

- [x] **Every acceptance criterion has a passing test** (test plan § Coverage map, re-checked clause by clause).
- [x] **No criterion is silently dropped.**
- [x] **No behaviour added that the story does not hold.**
  - The extra lines on the latest pass (its own reason text, failure stage and read, and the confirmation's fate) are
    logged in § Deviations.
  - Two of those lines carry the copy defects below.

## ADR adherence

- [x] **Files match § Implementation notes.** `RelaySettings.jsx` changed by exactly the three additions
  (`git diff 66d60cb5..a2f38940 -- ui/src/pages/settings/RelaySettings.jsx`).
- [x] **Layering respected.**
  - The view and fetch modules are plain ESM.
  - `drift.js` follows the `realtime.js` shape, with a two-layer gate.
  - `countStrict` leaves `scanStrict`'s body unchanged.
- [x] **No new dependency.**
- **Deviations from the ADR text**, both logged in the story:
  - a 500 for a throw as a count starts (the ADR says a failed count is never a 500, and a failed count still is not);
  - a 64-character stdout cap in `countStrict`.

  Both are judgement calls that keep the contract.

## Concept-graph integrity
- [x] No concept, schema or firmware change, so no reinstall.
- [x] The canonical stamp is reached only through `NOSTR_USER_TAG_Z_TAG` (the ADR 0015 path).
- [x] The local TA pubkey is resolved at runtime. Nothing is hardcoded.

## Things tests can't catch
- [x] No secrets, debug logging, commented-out code, or `tmp/` / `dist/` artefacts.
- [x] **Security.**
  - The gate is checked twice: `requireOwnerOrAdmin`, then a handler re-check with `authenticated === true`, owner or
    admin, and `sameHost`.
  - A refused request spawns nothing, runs no Cypher and resolves no identity.
  - The filter reaches strfry as one escaped argv element, never through a shell.
  - Answers carry fixed text and allow-listed codes only.
- [x] **Concurrency.**
  - Single flight with `finally` clean-up.
  - Every timer is cleared.
  - An answer to an older poll is dropped.
- [ ] **Error paths:** see blocking 1, and non-blocking 1–3.

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence
- [x] **Design and language guardrails.**
  - Tokens only, with no colour literal, length or new class.
  - A static skeleton when loading.
  - No emoji or `!`.
- [ ] **Copy accuracy:** several explanation sentences are not true to their producer (below).

## Findings

### Blocking

1. **`ui/src/utils/taggingPipelineView.js:43`: `passReason.schema` sends the owner to the wrong fix.**
   - **What the sentence says:** a uniqueness rule is not in place, so run the constraints fix on the Dashboard.
   - **What actually reaches it.** The schema step is the pass's first contact with Neo4j (the driver is built lazily,
     `reconcileTaggingEdges.js:333-335`). So every `readSchema` error is refused as `schema` (`:348-349`), and that
     includes Neo4j being unreachable (`ServiceUnavailable`) and a refused password (`Neo.ClientError.Security.*`). A
     probe confirmed both.
   - **Why the remedy fails.** The panel shows neither `failure.code` nor `failure.message`, so the owner cannot tell
     these cases apart. With Neo4j down, the Dashboard's own check fails too.
   - **Wrong for two rule cases as well:**
     - `tags_address-not-online`: the rule is still being built, so the remedy is to wait;
     - `tags_address-missing` after the pass's own create: the Dashboard fix runs the same `IF NOT EXISTS` statement,
       and OPERATIONS §12.8 says to raise it with the owner.
   - **Why it matters on real hosts.** The control panel creates `tags_address` at every boot, so there a `schema`
     refusal most likely means Neo4j itself.
   - **Asked change:**
     - Rewrite the sentence so it is true for all four producers (`reconcileTaggingEdges.js:341-356`), each with its
       remedy:
       - Neo4j down or refusing the password: fix that first;
       - the one-per-tagging rule still being built: wait, then run the pass again;
       - that rule could not be created: raise it with the owner;
       - the NostrUser pubkey rule missing: run the Dashboard constraints fix.
     - Say "changed no relationship or person", not "changed nothing".
     - Show `failure.code` under "Where it failed" in `PassSection.jsx:39-44`, through `explain('countCode', …)`, so the
       Neo4j cases explain themselves. Non-blocking 2 asks for the same.

### Non-blocking

Asked in this round. Each is small, and together they make the panel's copy true.

1. **`ui/src/pages/settings/taggingPipeline/DriftSection.jsx:48-52`: while a pass runs, drift says the latest pass
   "did not finish".**
   - **Why.** `usedInsteadOfLatest` (`taggingPipelineView.js:518`) is also true while running, and B31 covers only the
     failed case.
   - **Ask.** When `view.passRunning`, say a pass is running and that the newest finished one explains the difference.
     The Tester pins it (`driftView(DRIFT.EXAMPLE, STATUS.RUNNING, …)`).
2. **`PassSection.jsx:39-44`: a failed pass's `failure.code` is never shown,** although the `write` sentence (`:46`)
   says "If the code is ENOSPC". Read and write failures cannot be told apart either (a full disk, or Neo4j down).
   - **Ask.** Show the code, explained as a `countCode`.
   - **Test.** The Tester adds a test that renders a write failure with `ENOSPC` and finds the code.
3. **`taggingPipelineView.js:462-521` with `TaggingPipelinePanel.jsx:76-80`: drift can explain stale counts with a newer
   pass.**
   - **Why.** Counts are taken on opening and on Recount, but the status re-polls every 5 s. If a pass finishes after
     the counts were taken, the explained part switches to the new pass while the counts predate it.
   - **The result.** The panel shows a large "Unexplained" figure in the warn tone after the graph has caught up
     (reproduced with the local status and crafted counts).
   - **Ask:**
     - **Architect:** a T5 clarification adding `countsPredatePass`, true when the earlier `takenAt` is before
       `explainedBy.endedAt`;
     - **Implementer:** the flag, plus a note that asks for a Recount instead of presenting the figure as unexplained;
     - **Tester:** a test for it.
4. **`HeldSection.jsx:16`: "The next pass honours it." is unconditional.**
   - **Why.** Only a pass that passes its start checks before `expiresAt` claims it, and the claim can fail (OPERATIONS
     §12.8).
   - **Ask.** Use conditional copy, or drop the sentence (AC-2 asks only for "pending and until when").
5. **`PassSection.jsx:45-47`: "It applied removals the owner had confirmed" shows on passes that applied none.**
   - **Why.** `confirmation.honoured` is set at claim time (`reconcileTaggingEdges.js:372-375`). A run that fails
     afterwards keeps it, with `confirmed.removalsApplied` 0 (pinned by runner SR67).
   - **Ask.** Build the sentence from `latest.confirmed`.
6. **`PathSection.jsx:68`: "Changes dropped over the backlog, left to the next pass" is wrong.**
   - **Why.** A dropped change triggers a catch-up, which finds it (`realtime/index.js:737-740`; ADR 0003 § The in-memory
     backlog).
   - **Ask.** Relabel it "picked up by a catch-up", and make the same split in story 4 AC-3's list and ADR 0004 T3's
     prose. That last edit is the Architect's.
7. **`taggingPipelineView.js:120`, `:152`: catch-ups are described as reading "what the relay stored while it was
   away".**
   - **Why.** Most catch-ups run on a live path: the 10-minute safety diff, a backlog, a pass ending, the graph coming
     back.
   - **Ask.** Reword both. Add OPERATIONS §12.9's exception: during a lost record's re-read, live changes wait for that
     read.
8. **`taggingPipelineView.js:49`: `passReason.stopped` names only kill causes.**
   - **Why.** It also shows when the pass ran to the end but its final report write failed (OPERATIONS §12.8).
   - **Ask.** Add that case, and the data-volume remedy.
9. **`taggingPipelineView.js:145`: `lastErrorStage.journal` says unrecorded changes "wait for the next pass".**
   - **Why.** During a spell of failing appends the path keeps the lines in memory and keeps writing to the graph.
     Nothing waits unless it stops (OPERATIONS §12.9).
   - **Ask.** Reword it to match.
10. **`taggingPipelineView.js:172-187`: `EBADJSON` gets the E-family sentence.**
    - **Why.** That sentence speaks of an operating-system error, and of the relay and database containers. But
      `EBADJSON` is the route's own code for a damaged file (`src/api/tagging-edges/index.js:65-78`).
    - **Ask.** Give it an exact `countCode` entry: the file is damaged, and the owner can confirm again.
11. **`taggingPipelineView.js:35`, `:100` and `PathSection.jsx:92`: three sentences leave out part of what the producer
    does.**
    - **`done-removals-held` (`:35`)** reads as if only the excess was held. The pass holds all planned removals, or
      all unconfirmed ones on a confirmed run (`sweep.js:473-487`). **Ask.** Match `passReason.removals-held` at `:51`.
    - **`refreshed` (`:100`)** also covers a same-version row that loses properties outside the nine
      (`sweep.js:304-313`). **Ask.** Say so.
    - **`PathSection.jsx:92`** labels `catchUp.last.reason` "Why:" on a failed or stopped catch-up too, where it carries
      a not-established reason still to report (`realtime/index.js:1033-1038`). **Ask.** Use "Why:" only when the
      outcome is `not-established`.
12. **`PathSection.jsx:129`: "Pre-image file of removed relationships" is wrong and uses jargon.**
    - **Why.** The file holds safety copies of any update, move or removal whose row carried keys outside the nine
      (`graph.js:314`, `preimage.js:13-18`).
    - **Ask.** Relabel it in the panel's own words ("safety copies …").
13. **Remedies name logs without their location:** `taggingPipelineView.js:148`, `:176`, `:180`, `:186`, `:192`,
    `:203`.
    - **Ask:**
      - Name each log where it is: the path's is `/var/log/supervisor/tagging-edges-realtime.log`, and the control
        panel's is `/var/log/supervisor/brainstorm.log`, both in the `tapestry` container (OPERATIONS §12.8 and §12.9).
      - Split the Neo4j family sentence (`:207`), so a security code is told apart from an outage.
14. **`src/api/tagging-edges/drift.js:15-16`: the module comment promises "one count runs at a time".**
    - **Why.** After a lost race the abandoned work runs on while a new count may start. ADR 0004 accepts this.
    - **Ask.** State only what the code guarantees, as ADR 0004 § Server "Single flight" does.
15. **ADR 0004 (Debt, § Server "Single flight") claims too firm a bound.**
    - **What it says:** a lost-race Cypher's session is bounded at 10 s, or 30 s.
    - **What holds.** `{ timeout }` is sent to the server as `tx_timeout`. A Neo4j that accepts the connection and stops
      answering has no client-side bound (neo4j-driver 5.28.1).
    - **Ask (Architect, wording only).** Say so.
16. **`OPERATIONS.md:727` and ADR 0004 § Server: "a no-cors request from another site can start at most one count"
    reads as a total limit.**
    - **Ask.** Reword: at most one count runs at a time, and repeats can start one after another.
17. **The handoff and the epic are stale.**
    - **`docs/TAGGING_EDGES_HANDOFF.md:1`, `:8`, `:69` still say "stories 2–4".** `:8` is the rule that flips the
      handoff to ✅ when the book closes, and the book now ends at story 5.
    - **The handoff's § 0 (`:33-39`) and the epic's item-4 block** still list C1, C3–C7 and C9 as open, though this
      branch did them.
    - **Ask.** Correct both.
    - **ADR 0003:917 and ADR 0002:549** still give story 4 work that is now story 5's. **Ask (Architect):** add a dated
      note to each.
18. **`BIBLE.md:660`: the drift-counts row omits the `identity` field of an identity refusal.**
    - **Ask.** Add it. OPERATIONS:727 already has it.

### Harness friction *(each becomes a ledger row, type `meta` unless noted)*

1. **The test plan claimed polling coverage that no test gives.**
   - **The claim.** § Edge cases says a late poll is dropped and a tick is skipped while one is in flight (B38).
   - **What is untested:** none of the ADR's three polling rules is pinned, nor a failed re-poll keeping its figures
     under its read time. A regression in the stale-answer guard would pass the gate.
   - **Ask (Tester).** Add browser cases beside B35/B36 for all three, using `page.clock`. Correct the plan.
2. **A deferred clean-up has no ledger row:** story 4 § Deviations says `drift.js:29`'s copy of `CANONICAL_Z_RE` "is
   worth exporting in a later clean-up". **Ask.** File a `cleanup` row, after searching the ledger on this branch and on
   `origin/staging`.
3. **The held list can stay on "Loading" after a restart.** It happens when the status read that would replace it is
   overtaken by a poll tick that then fails (`TaggingPipelinePanel.jsx:117-120`). This is a code issue, not harness
   friction. **Ask (non-blocking).** Have `useRead`'s `run` report whether its answer was kept, and fall through to the
   error branch when it was not.

## Verdict

**CHANGES_REQUESTED**

One blocking defect: `passReason.schema` (blocking 1) gives the owner a remedy that cannot work in the case most likely
on a real host, and the panel hides the code that would correct it. Everything else conforms. The gate is green against
the baseline, the browser spec passes in full, and the server's gate and counts are sound. The non-blocking items are
copy and docs accuracy and should land in the same round.

**Kick-back, in order:**
- **Architect:** non-blocking 3's T5 clarification, the wording in non-blocking 6, 15 and 16, and the notes in ADR
  0003:917 and 0002:549.
- **Tester:**
  - the tests asked in non-blocking 1–3;
  - friction 1's polling cases, and the plan's correction.
- **Implementer:** blocking 1 and non-blocking 1–14, 17 and 18, plus the ledger row in friction 2.
