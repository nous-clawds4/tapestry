# Story 4: The tagging pipeline panel

**Status:** Done
**Created:** 2026-09-30
**Type:** Feature

## Background

Stories 1–3 put one `TAGS` relationship per tagging into the graph and keep it current: the gap-filling pass
(story 2) repairs drift and was the backfill, and the real-time path (story 3) reflects changes within a minute. Both
run on staging and production, switched on by the owner on 2026-09-30.

The owner can watch neither from the control panel. Today they open raw JSON status routes in a browser and paste
console snippets (OPERATIONS §12.8–§12.9). Nothing shows how far the graph is from the relay. The book's acceptance
frame (`audits/tagging-edges/book.md`) asks that the owner "can see and manage the tagging pipeline from the control
panel — its status, counts, the drift between relay and graph, start / stop, and a gap-fill run on demand — in the
style of the existing Streaming ETL controls".

At Planning (2026-09-30) the owner split that into two stories:

- **Story 4, this one: the panel.** Everything you can see: the pass, the real-time path, the drift, the held
  removals, the backstop schedule. It changes nothing.
- **Story 5: the controls.** Turning the path on and off, running a pass, stopping a pass, confirming held removals,
  and who may do each (`epics/tagging-edges.md` item 5).

Story 4 also carries the open carry-forwards from story 3's review (C1, C3–C7, C9, and C2's ADR half). They touch
story 3's engine and docs, not the panel. The owner chose to carry them here rather than open a separate docs story
(2026-09-30); they do not gate the panel's criteria.

## User-facing description

As the owner or an admin of a Tapestry instance, I want a page beside Streaming ETL that shows me the tagging
pipeline at a glance:
- whether a pass is running and how the last ones went;
- whether the real-time path is on and keeping up;
- how far my graph is from my relay, and why;
- whether any removals are waiting for the owner;
- whether a pass is scheduled as the backstop.

Then, without reading JSON, I can tell whether a pass or the path has failed, stalled or fallen behind, and what
needs attention.

The page changes nothing. The controls come with story 5.

## Acceptance criteria

"The panel" is the page this story adds. The other terms come from stories 2 and 3:
- **The pass and the path.** "The pass" is story 2's gap-filling pass, and "the path" is story 3's real-time path.
  "On" means the owner's switch is on; "running" means the path's process is alive (story 3 AC-5).
- **Story 2's terms.** "Held removals", "run id", "left in place" and an owner's pending confirmation are as in
  story 2.
- **Story 3's terms.** "Catch-up", "parked", "failed reads" and "database refusals" are as in story 3.
- **Owner and admin.** "Owner" and "admin" are the control panel's sign-in classifications, the two Settings already
  admits.
- **The report.** "The report" is the pass report the instance serves: the latest pass and up to nine before it.
- **Finished pass.** A "finished pass" is one whose outcome is `done` or `done-removals-held`. A pass whose outcome
  is `refused` or `failed`, or one still running, is not finished.
- **Refused taggings.** "Refused taggings" are taggings the definition does not accept (story 2 AC-3), which a pass
  or the path therefore does not write. A pass whose *outcome* is `refused` is a different thing: the panel shows it
  as an outcome, never as a count of refused taggings.
- **Relay taggings.** "Relay taggings" are the kind-39999 events on this instance's relay that carry either
  `nostr-user-tag` stamp (the canonical one or this deployment's own), each counted once. It is one count over both
  stamps, never two counts added: on staging on 2026-09-30 the canonical stamp counted 7,027, the local one 4, and
  both together 7,027. The relay keeps one event per tagging address, so this is also the number of tagging
  addresses, the figure a pass reports as taggings read.
- **Graph relationships.** "Graph relationships" are the graph's `TAGS` relationships.
- **Explanations.** Each outcome, reason code, path state and setup-problem code the status can carry today is shown
  as the code plus a sentence explaining it, where the sentence is not the code itself. A code the panel does not
  know is shown as it is, with "not recognised" beside it: never blank, never hidden.

- [ ] **AC-1: where it is, who sees it, and that it changes nothing.**
  - **Given** a signed-in owner or admin, **when** they open Settings › Relays, **then** a sub-tab directly after
    ⚡ Streaming ETL, labelled "Tagging pipeline", opens the panel.
  - **Given** a signed-in user who is neither owner nor admin, or a visitor who is not signed in, **then** the panel
    is not shown, as for the rest of Settings. The routes it reads that are public today stay public: hiding the
    panel is presentation, not access control.
  - **It changes nothing.** **Given** no pass is queued or running and the path is off, **when** a viewer opens the
    panel, leaves it open for a minute, asks for a recount twice and closes it, **then** these are the same as
    before: the relay taggings, the graph relationships, the report, the path's switch and status, the held list,
    and the schedule list.
- [ ] **AC-2: the gap-filling pass.**
  - **Running now.** **Given** a pass is running, whose stored record reads outcome `failed` with reason code
    `stopped` (the record a kill would leave behind), **when** the panel is open, **then** it shows the pass as
    running and shows no result for it. Whether a pass is running is judged by whether it is alive, never by the
    stored outcome.
  - **The latest pass.** **Given** the report holds passes, **then** the panel shows:
    - the latest pass: its outcome and reason (with explanations), when it started and ended, and how long it took;
    - what it did: taggings read, added, changed, removed, unchanged, refused taggings, held, left in place, people
      added;
    - the earlier passes the report keeps (up to nine), newest first, each with its outcome, time and what it did.
  - **No pass yet.** **Given** the report holds no pass, **then** the panel says that no pass has run yet, and names
    the ways one starts: an enabled Scheduled Tasks entry, or the Task Explorer (until story 5).
  - **Held removals.** **Given** the latest pass held removals, **when** the viewer pages through the held list,
    **then** every held removal is reachable, the count matches the report, and the panel shows why each was held.
    - **Confirmation.** The panel says whether an owner's confirmation is pending and until when. An expired one is
      shown as expired: it stays until the next pass, which does not honour it. One that cannot be read is shown as
      unreadable.
    - The panel offers no way to confirm; that is story 5.
  - **The backstop schedule.** The panel counts the **enabled** Scheduled Tasks entries that run the pass (listed
    as "Reconcile tagging relationships"). Disabled entries are not counted, but are mentioned.
    - **None enabled.** A warning that the path has no backstop, pointing to the Scheduled Tasks sub-tab, and saying
      so when a disabled entry exists.
    - **One.** Its interval and when it runs next. If it has no next run, a warning that it is enabled but not
      scheduled. If it runs less often than daily, a warning that the backstop is weaker than daily.
    - **More than one.** A warning naming how many.

    The panel does not create, enable or edit a schedule.
- [ ] **AC-3: the real-time path.**
  - **On and running.** **Given** the panel is open, **then** it shows whether the path is on and whether it is
    running, judged by whether its process is alive, as for the pass in AC-2.
    - **On but not running.** The panel says so, and does not show the last stored state (which may still read
      `live`) as current.
    - **Running.** The panel shows its state, with explanations: off, starting, waiting on a setup problem, waiting
      for the graph, waiting for the relay, catching up, live, stopped.
  - **Warnings.** The panel warns when:
    - the path's status is stale (not rewritten for over a minute while it runs);
    - the status cannot be read;
    - the on/off record cannot be read (the path then counts as off).
  - **What it has done.** The panel shows when the path first started and when it last reflected a change, and its
    counts:
    - added, changed, removed, unchanged and people added;
    - refused taggings, failed reads and database refusals;
    - the removals it was not prompted to make, which are left to the next pass, and the changes dropped over the
      backlog, which a catch-up picks up. *(Corrected at the review, round 1, 2026-10-01: dropped changes are not left
      to a pass, ADR 0003 § The in-memory backlog.)*

    The counts run from the first start. When they were reset because the path's status was lost, the panel says
    so, and that they run from the reset.
  - **As it stands now:** the addresses parked and the work pending.
  - **Its last catch-up:** its outcome, when it ran, and how long it took.
  - **Problems:** any setup problem or last error, with explanations.
  - **Values not yet produced.** A value the path has never produced (before its first start) reads "not yet
    available", never 0. While the path is off, the figures it produced before are still shown, labelled as its last
    figures, with the time they were written.
- [ ] **AC-4: drift between the relay and the graph, explained.**
  - **When it counts.** **Given** the panel is open, **when** it opens, and again whenever the viewer asks for a
    recount, **then** it counts the relay taggings and the graph relationships.
  - **What it shows:**
    - both counts, and when they were taken;
    - the difference: relay taggings minus graph relationships;
    - the explained part, taken from the newest finished pass in the report and labelled with its run id and time.
      It is its refused taggings, minus the removals it held, minus the relationships it left in place;
    - the remainder, the difference minus the explained part, shown as "unexplained".
  - **What it names beside the remainder:**
    - the addresses that pass left to the next one (lost races and conflicting addresses);
    - when the path is on, the path's refused taggings and parked addresses, which the explained part does not
      include;
    - when the path is off, that changes since that pass wait for the next pass.
  - **No finished pass.** When the report holds no finished pass, the panel shows no explained part, labels the whole
    difference "unexplained", and says why. When the latest pass is not finished, the panel says which finished pass
    it used instead.
  - **Example.** **Given** a fixture whose relay holds 5 refused taggings, and whose graph holds 1 held removal and
    1 relationship left in place, with no other difference, **then** the difference reads 5 − 2 = 3, the explained
    part 5 − 1 − 1 = 3, and "unexplained" 0.
  - **A clean pass.** **Given** the newest finished pass ended `done` with the reason "the graph agrees with the
    relay", and nothing on the relay or in the graph changed after it ended, **then** "unexplained" reads 0.
  - **Unknown, never 0.** A count that fails, or takes longer than 10 seconds, reads "unknown", never 0. No
    difference is shown from an unknown count.
  - **Who may count.** Only a signed-in owner or admin can ask for a count. Any other request is refused by the
    server and counts nothing.
  - **Reads only.** Counting reads the relay and the graph only: it writes nothing, and it never starts a pass.
- [ ] **AC-5: it stays current, and every state has its own text.**
  - **Refresh.** While the panel is open, it re-reads the pass and path status at least every 10 seconds without
    reloading. So a change shows within 10 seconds of the status routes showing it: the pass rewrites its report at
    each phase and every ten write batches, and the path rewrites its status within 2 seconds of a change. Drift is
    counted only on opening and on request (AC-4).
  - **States.** While loading, each section says what it is loading. When a read fails, that section:
    - names the read: the pass report, the held list, the path status, the schedule list, or the relay or graph
      count;
    - shows the error's code, and offers to try again.

    The other sections keep what they loaded. The panel never shows a blank area, a raw JSON body or a stack trace.
  - **Colours and copy.** Colours come from the app's existing design tokens: the panel's source holds no colour
    literal (hex, rgb/rgba, hsl or a named colour), and it follows `product-team/guardrails/design.md`. The new copy
    follows `product-team/guardrails/language.md`: no emoji, no exclamation marks.
- [ ] **AC-6: nothing else moves.**
  - **The tab bar.** The five existing Relays sub-tabs keep their labels, order and content. The only change to the
    tab bar is the new sub-tab, directly after ⚡ Streaming ETL. Opening each existing sub-tab sends the same
    requests as before, and their existing tests pass unchanged.
  - **Ingestion.** Follows, mutes and reports ingestion is unchanged.
  - **The pass and the path.** They and their routes behave as before. The panel adds reads, never a new way to
    change them.
  - **The relationships.** Nothing new is stored on them: no trust, point-of-view or count (book, "Nothing else
    moves").

### Docs tasks

The Reviewer checks these against the diff, not with tests.
- [ ] **OPERATIONS §12.8–§12.9.** Say where the panel is. The JSON routes stay the reference.
- [ ] **BIBLE.** §11 gets any route the panel adds, and §16 an entry.
- [ ] **The handoff.** `docs/TAGGING_EDGES_HANDOFF.md` § 0 and §2.3 name the panel.

**Carried forward from story 3's review.** These are the open items of C1–C9: `reviews/tagging-edges/3-real-time-path.md`
§ "Re-review, round 3", placed here by the owner on 2026-09-30. `epics/tagging-edges.md` item 4 gives each one's
places in full, re-checked at `origin/staging` `58abd891`.
- [ ] **C1.** strfry's skip mark is per index-key value, not per subscription.
- [ ] **C3.** The debounce race's exact condition, and all three other wakes. This also brings ADR 0003
  clarification 24's debounce bullet into line with C2's ledger fix.
- [ ] **C4.** "Per *newest* event deleted", and the test plan's wipe wording.
- [ ] **C5 (Architect).** Clarification 26 adopts `bringsNew`'s effect reading, and "costs no write" is bounded to
  one write attempt per park episode. *(That bound has two exceptions, found at story 4's Architecture; the true
  bound is in ADR 0004 § Amendments to ADR 0003, C5.)*
- [ ] **C7 (Architect).** The widening the owner accepted on 2026-09-30:
  - the loss window while journal writes keep failing;
  - an off or a SIGTERM during that window;
  - the stale status;
  - the added occasions for decision 11's lost-notice removal.

### Test tasks

- [ ] **C6 (Tester).** Pin clarification 26's two unpinned halves (RX29 / RX30 after RX28).
- [ ] **C9 (Tester).** Add `src/lib/strfryScanStrict.js` to the routes suite's `FORGET` list.

C2's ledger half (the row's debounce reason) and C8 (SL19 in the container) were done on 2026-09-30. C2's ADR half
goes with C3.

## Concepts touched

- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag`: nostr user tag, the
  canonical stamp (the ADR 0015 literal). Its elements are the relay taggings counted in AC-4.
- `39998:<TA>:nostr-user-tag`: nostr user tag, this deployment's own stamp (TA resolved at runtime; locally
  `39998:8387ec0e9a1796d628688633c759ee5e3fb86587630beb03166e4e333a9a294f:nostr-user-tag`).
- `39998:<TA>:nostr-user`: nostr user, the relationships' two ends. The panel counts, and never writes.

## Out of scope

- **Every control: story 5.** Everything that changes something is story 5's:
  - turning the path on and off;
  - running a pass;
  - stopping a queued or running pass;
  - confirming held removals;
  - the confirm prompts;
  - the access change: owner or admin for the first three, owner only for confirming.

  Until story 5, the Task Explorer runs a pass, and the console snippets in OPERATIONS §12.8–§12.9 confirm held
  removals and turn the path on and off.
- **A link of its own.** The Relays sub-tabs have no address of their own, so the panel is reached by clicking
  through, as Streaming ETL is. The owner chose the sub-tab knowing this.
- **Streaming ETL's own gaps.** Its control route accepts any signed-in session, and its counts are scraped from a
  log. The first is added to the 2026-07-21 intake entry's list, where it is tracked, and so are Scheduled Tasks'
  create, update and delete routes, which are open the same way. The second is unchanged.
- **Scheduling from the panel.** It reports the schedule (AC-2); the Scheduled Tasks sub-tab stays the place to
  change it.
- **Drift between instances.** Revokes do not travel between instances (ledger `2026-09-27-revokes-do-not-travel`).
  The panel compares this instance's relay with this instance's graph only.
- **Rankings, top lists or trust-filtered figures.** The panel shows the pipeline's raw figures. Which taggings count
  for a point of view stays a read-time question (principles 1–3).
- **These ledger rows:** `2026-09-28-pass-relay-read-byte-cap`, `2026-09-27-stale-heavy-lease-after-deploy`,
  `2026-09-29-realtime-engine-round-split`, `2026-09-27-expected-schema-lists-disagree`, and
  `2026-09-28-confirm-route-joins-finishing-job` (story 5 has the confirm control).
- **The 2026-07-21 sweep** that gates every admin mutation.

## Open questions

None. The Product Owner's four proposals were ratified by the owner at Planning and are listed below.

**Decided at Planning (2026-09-30, the owner):**
- **Placement.** One panel, as a Relays sub-tab beside Streaming ETL, seen by the owner and admins, with no address
  of its own.
- **The split.** Story 4 is what you see, and story 5 is what you do.
- **Drift.** It is the explained difference, counted when the panel opens and on request. A count that fails reads
  "unknown", never 0.
- **Story 5.** On/off, run and stop (queued or running) are for the owner or an admin. Confirming held removals is
  for the owner only. A confirm prompt comes before turning the path off, stopping a pass, and confirming.
- **Streaming ETL's gap.** Its ungated control route is tracked in the 2026-07-21 intake entry, not folded here.
- **Carry-forwards.** Story 3's carry-forwards go here.
- **The label.** The sub-tab is "Tagging pipeline", with no emoji, following the language guardrail though its
  neighbours carry one (AC-1).
- **Who may count.** Only a signed-in owner or admin may ask for a drift count, enforced by the server (AC-4). The
  pass and path status reads stay public, and the relay and graph can already be counted through other public reads,
  so this protects no data. It keeps a page for owners and admins from giving everyone a new way to make the
  instance count.
- **The count's time limit.** A count that takes longer than 10 seconds reads "unknown" (AC-4). Staging counts in
  about 0.2 s today.
- **Evidence.** It has three parts:
  - a browser-level test of the panel on the rebuilt UI, against fixtures for each state AC-2 to AC-5 name (OPEN.md
    rows 113 / 114);
  - the owner and an admin viewing the panel on staging after the merge;
  - a drift count taken there, compared with the relay and graph counts read directly.

## Evidence

### The gate (Implementation, 2026-09-30)

Node 22.23.3, full `npm test`, read from the run records (`gate:status`). Suite by suite against the baseline:

| Run | Tree | Passed | Failed | Skipped | Suites |
|---|---|---|---|---|---|
| Baseline | `88af7df3` | 4,533 | 33 | 177 | 244 |
| Red | the failing tests (`e6f124ea`'s tree) | 4,558 | 201 | 177 | 250 |
| Green | the implementation | 4,726 | 33 | 177 | 250 |

- **All six new suites pass in full:** strfry-count-strict 23, tagging-edges-drift-route 27, tagging-pipeline-view 58,
  tagging-pipeline-codes 39, tagging-pipeline-fetch 19 and tagging-pipeline-panel-source 25.
- **tagging-edges-realtime-resilience** passes 30, RX29 and RX30 included.
- **No other suite changed.** The 13 failing suites are the same live-stack suites in all three runs.
- **The browser spec** passes 44 of 44 (B0–B40, B36a–d) against the panel built inside the container into the
  gitignored `tmp/`, served on the host, with Node 22 and Chromium.

### The local stack (2026-09-30)

The backend was restarted at 22:17:11Z (`scripts/dev-refresh.sh`) and the UI rebuilt.

- **`GET /api/tagging-edges/drift-counts`.**
  - Signed out, it answered 401 `Not authenticated`.
  - Signed in as the local owner, it answered 200: relay 7,030 (37 ms), graph 7,030 (6 ms), `stamps` `82b75e47` /
    `8387ec0e`. Those match `GET /api/strfry/scan/count` over both stamps (7,030) and a read-only
    `MATCH ()-[r:TAGS]->() RETURN count(r)` (7,030).
  - With a foreign `Origin` it answered 403 `cross-site request refused`; with its own origin, 200.
  - Two concurrent requests joined one count: the same `takenAt`.
- **The panel**, opened in the built-in browser with the signed-in-UI stub (no key in the pane).
  - The sub-tab "Tagging pipeline" sits directly after ⚡ Streaming ETL.
  - The five sections drew from the local stack's real status, path and schedule reads:
    - the latest pass `done` and two earlier ones;
    - no held removals;
    - the "no backstop" warning, since this instance has only the disabled seed entry;
    - the path off, with its last figures, counts, gauges, last catch-up and last error, each explained.
  - Drift showed `http-401` and "unknown", because the pane has no session. Fed the owner's answer above, it read 7,030
    and 7,030, difference 0, explained 0 by pass `20260928T032501Z-472c2596`, and unexplained 0.

### Staging (2026-10-01)

PR #791 merged to staging at 01:46:05Z (`fbd37968`), 11 s after `scripts/check-safe-to-merge.sh` exited 0. Deploy run
`36802662544` succeeded in 98 s. The smoke test (`docs/SMOKE_TEST.md`) was clean apart from `get-user-data`'s 504 on
the heavy test pubkey, which production shows too (OPEN.md row 61).

- **The bundle.** The served `index-BBm0F9EO.js` carries "Tagging pipeline", `drift-counts` and `tp-drift`.
- **`GET /api/tagging-edges/drift-counts`.**
  - Signed out, it answered 401.
  - Signed in as an admin (Virgil; `user-classification` `admin`), it answered 200: relay 7,032, graph 7,032. Those
    match `GET /api/strfry/scan/count` over both stamps (7,032) and a read-only `MATCH ()-[r:TAGS]->() RETURN count(r)`
    (7,032).
  - With a foreign `Origin` it answered 403; two concurrent requests joined one count (the same `takenAt`).
- **The panel, as an admin.** It was rendered headless (Playwright 1.56.1, Chromium) with the admin's session; the key
  stayed in memory.
  - The sub-tab "Tagging pipeline" sits between ⚡ Streaming ETL and 📅 Scheduled Tasks.
  - Its four reads answered 200 (`status`, `realtime/status`, `scheduled-tasks/list`, `drift-counts`), and the console
    showed no errors.
  - The five sections drew from staging's real state:
    - the latest pass `done` (`20260930T142646Z-a7f04da9`) and two earlier ones;
    - no held removals;
    - one enabled entry, every 1 day, next at 2026-10-01 14:26:18Z;
    - the path on, running and `live`, with the deploy's catch-up `done` in 29 s;
    - drift 7,032 and 7,032, difference 0, explained 0 by that pass, and unexplained 0. The pass read 7,026 and the
      path has added 6 since.
- **No pass queued (AC-1).** BullBoard's read route (`GET /admin/queues/api/queues`, as the admin) was read at
  02:15:19Z and 02:15:34Z, before and after a panel view whose only requests were the panel's four GETs. Both times
  the `reconcileTaggingEdges` queue held no waiting or active job, 0 failed and 1 completed, and one delayed job, the
  same both times: the backstop's next run (`repeat:sched:entry-c2a4d900…`, due 14:26:18Z). See § Deviations, "At the
  live evidence".
- **The owner's view:** see "The owner's checks" below.

### Production (2026-10-01)

Promotion PR #792 (bundle: #791 alone) merged to main at 02:00:40Z (`9a97de8f`), once the required checks were green,
3 min 33 s after `scripts/check-safe-to-merge.sh` exited 0. Deploy run `36803802426` succeeded in 96 s. The smoke test
was clean apart from the same `get-user-data` 504 (OPEN.md row 61); no 502 window showed.

- **The bundle.** The served `index-BBm0F9EO.js`, the same build as staging's, carries the three strings.
- **`GET /api/tagging-edges/drift-counts`.** Signed out 401. As an admin (Virgil), 200: relay 7,039 (142 ms), graph
  7,039 (58 ms), `stamps` `82b75e47` / `919ba08a`; the direct counts read 7,039 and 7,039. A foreign `Origin` got 403;
  two concurrent requests joined one count.
- **The panel, as an admin,** rendered the same way: its four reads answered 200, and the console showed no errors.
  - The latest pass `done` (`20260930T142511Z-3469ad38`), and the backfill before it.
  - No held removals.
  - One enabled entry, every 1 day, next at 2026-10-01 14:24:37Z.
  - The path on, running and `live`, with the deploy's catch-up `done` in 36 s.
  - Drift 7,039 and 7,039, difference 0, explained 0, unexplained 0. The pass read 7,033 and the path has added 6
    since.
- **No pass queued (AC-1),** read the same way at 02:15:35Z and 02:15:49Z. Both times there was no waiting or active
  job, 0 failed and 1 completed, and the same one delayed job: the backstop's next run
  (`repeat:sched:entry-9c44f402…`, due 14:24:37Z).
- **The owner's view:** see "The owner's checks" below.

### The owner's checks (2026-10-01)

The owner ran these by hand on 2026-10-01 and reported them.
- **As the owner (straycat) and as an admin (Nous).** The owner saw the Tagging pipeline sub-tab in Settings, with a
  little over 7,000 taggings, on staging and on a second host. They named that host tags.brainstorm.world. tags does
  not serve the panel: at 19:19Z its bundle `index-D8gNJNSr.js` had no "Tagging pipeline", and the three tagging-edges
  routes answered 404. Production is the only other host that does, so the second host was production.
- **As a signed-in user who is neither owner nor admin, on staging.** Settings said they were signed in as a customer
  and refused access. The gate (`ui/src/pages/settings/Index.jsx:35`) shows only its lock and returns before the
  sub-tab bar is drawn, so no sub-tab is offered.
- **Recount, as an admin on production.** Pressing it changed both "counted at" times.

Read here alongside them (19:20Z, headless, signed out): on both hosts, Settings showed only its lock ("Settings are
only available to the owner"). It offered no sub-tab, and the panel made no request.

## Deviations

Small judgement calls made at Implementation (2026-09-30), too small for an ADR amendment.

- **View module (`ui/src/utils/taggingPipelineView.js`).**
  - **Where the tones sit.** A `tone` (`ok` | `warn` | `bad` | `neutral`) is on `passView`, its `confirmation`,
    `pathView`, `scheduleView` and `driftView`. None is on `explain` or the gauges.
  - **How each tone is chosen:**
    - the pass: `done` is ok, `done-removals-held` is warn, `refused` and `failed` are bad;
    - the path: bad when on but not running, when its status is unreadable, or when stopped; warn when stale or
      waiting; ok when live;
    - the schedule: ok only for one scheduled entry that runs at least daily;
    - drift: ok only when unexplained is 0.
  - **A setup problem of an unknown kind** is keyed `<kind>:<problem>`, and shown as not recognised rather than hidden.
  - **Malformed values.** A non-object `confirmationPending` reads as unreadable. A count marked known with no finite
    number reads as unknown, never 0. A missing figure on a started path is `null` (not yet available).
  - **Plain names and remedies.** Sentences name the database rules in plain words ("the one-per-tagging rule"). Their
    remedies come from OPERATIONS §12.8–§12.9.
- **`readSection`** also takes no options, or `null` options.
- **`countStrict`.**
  - It rejects `unparseable` once stdout passes 64 characters (no well-formed count is longer than 17), so a runaway
    stdout is never held in memory.
  - Its messages say `strfry scan --count`.
- **The drift route.**
  - A throw as a count starts answers 500 with an allow-listed code. A throw while a count settles becomes an unknown
    count. Either way the request never hangs.
  - To give the canonical prefix after a local refusal (T11), it wraps the identity getters without calling any of
    them twice. It repeats `identities.js`'s private `CANONICAL_Z_RE`, which is worth exporting in a later clean-up
    (ledger row `2026-10-01-drift-copies-canonical-z-pattern`).
- **The panel.**
  - **Files.** Seven files in `taggingPipeline/`: the panel, shared `parts.jsx`, and one per section.
  - **Layout.** Earlier passes and held entries are table rows. Each distinct code's explanation is given once below
    its table.
  - **What the latest pass also shows:** its own `reason` text, its failure stage and read, and what became of the
    owner's confirmation. The path also shows the catch-up under way and the pre-image file.
  - **Explaining odd values.**
    - An unreadable confirmation's code is explained under `countCode`.
    - A held list naming a newer run that the status re-read does not confirm is a failure, with code `bad-json`, and
      is not retried forever.
    - A schedule answer with no list is a failed read, with code `bad-json`.
  - **The held section with no pass report.** While there is no good pass report, it stays `loading`, and says so when
    that report failed.
  - **Drift** waits until the status and path reads have each answered once.
  - **When the path is on but not running,** its last stored state is not shown at all.
  - **Figures** sit in plain tables with the browser's default styling, which avoids a long stacked list without
    adding a class or a length.
- **Docs.**
  - The panel and drift-counts paragraphs sit in OPERATIONS §12.8, and §12.9 points back to them.
  - BIBLE §11's drift-counts row sits in the gap-filling pass's table.
  - The handoff's Status line and a "Story 5, after it" paragraph were updated so they do not contradict § 0.
  - The ledger row's § Impact took the C1 and C3 corrections too.

### After the review, round 1 (2026-10-01)

- **Log paths.** Remedies name each log by its path in the `tapestry` container, taken from `docker/supervisord.conf`.
  The relay's is `strfry-error.log`, since strfry runs there and has no container of its own. Neo4j's is `neo4j.log`.
  Sentences that spoke of "the relay and database containers" now say the `tapestry` container.
- **The schema reason** names its codes inside one sentence, with each remedy, rather than leaving every schema code to
  its own line.
- **One sentence where two producers share a `failureCode` (T12).**
  - `signal` covers both the pass's own stop and a relay read ended by a signal: the stage shown beside it tells which.
  - `timeout` names the relay read, the only producer of a bare `timeout` for a pass.
  - `missing-column` covers both the graph read and a write's re-read.
- **`tags_address-missing`** names its one known cause: another rule holds the name.
- **The `failureCode` families** repeat the `countCode` regex literals instead of sharing constants.
- **The `E…` family** excludes Node's own `ERR_…` codes, and a Neo4j Security code reads as credentials or permission.
  Both follow T12 as refined.

### At the live evidence (2026-10-01)

- **BullBoard's delayed job.** The test plan asks that BullBoard show the `reconcileTaggingEdges` queue with "no
  waiting, delayed or active job before and after" (§ Test infrastructure, "Live evidence"). While a host's daily
  backstop entry is enabled, the entry's next run is always one delayed job in that queue, so that wording cannot hold
  on either host. The check recorded instead no waiting or active job, and the same single delayed job before and after
  a panel view. A pass the panel had queued would have been a new job, waiting or active.

## Linked artifacts

- ADR: `engineering-team/decisions/tagging-edges/0004-tagging-pipeline-panel.md` (also amends ADR 0003 for C1, C2's ADR
  half, C3, C5 and C7)
- Test plan: `engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.test-plan.md`
- Review: `engineering-team/reviews/tagging-edges/4-tagging-pipeline-panel.md`
