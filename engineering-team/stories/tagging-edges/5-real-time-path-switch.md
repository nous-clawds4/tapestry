# Story 5: The real-time path's switch, on the panel

**Status:** Approved
**Created:** 2026-10-01
**Type:** Feature

## Background

Stories 1–4 are in production. The gap-filling pass (story 2) and the real-time path (story 3) keep one `TAGS`
relationship per tagging. Story 4's panel (Settings › Relays › Tagging pipeline) shows how both are doing to the owner
and admins, and changes nothing.

The book's acceptance frame asks that the owner, and since story 4's Planning also admins, can manage the pipeline
from the control panel (`audits/tagging-edges/book.md`, "Front-end controls"). At this story's Planning (2026-10-01)
the owner split the controls by what they act on:
- **Story 5, this one: the real-time path's switch.** Turning the path on and off from the panel, for the owner or an
  admin, with a record of who did it.
- **Story 6: the pass's controls.** Running a pass now, stopping one, and confirming held removals
  (`epics/tagging-edges.md` item 6).

Today:
- **Only the owner can switch the path, and only from a console snippet** (OPERATIONS §12.9). The server refuses
  admins.
- **Nothing shows who switched it, or when it went off.**
  - The status reports when the path was switched on. The panel prints that only while the path is on and its process
    is running.
  - The switch keeps a "changed by", but nothing shows it. It always names the owner, which is true today only because
    no one else can switch.
  - Nothing shows when the path went off.
- **After turning on, the panel can show a false alarm.** The path takes a few seconds to start, and up to about 30
  seconds when its process has recently ended within a minute of starting. Until it runs, the panel shows the red "on,
  but its process is not running".

Story 5 also carries story 4's review carry-forwards, R2-1 to R2-14 (below). They touch story 4's panel copy, docs,
ADR and tests, not the switch. The owner placed them here (2026-10-01); they do not gate this story's criteria.

## User-facing description

As the owner or an admin of a Tapestry instance, I want to turn the real-time path on and off from the Tagging
pipeline panel:
- with a prompt before I turn it off that tells me what that means;
- seeing it start without a false alarm;
- seeing who last turned it on or off, and when, with the recent history.

Then nobody needs a console snippet. When the path is off, the panel shows who turned it off, if that was recorded.

## Acceptance criteria

The terms are story 4's: "the panel", "the path", "the pass", "the report", "owner", "admin" and "finished pass". "On"
and "off" are the path's switch, and "running" means the path's process is alive (story 3 AC-5). A "change" is a
request to turn the switch on or off that the server accepts. A "first start" is as story 3 defines it: the path's
first start on this instance, which reflects only what arrives afterwards.

- [ ] **AC-1. The control.**
  - **What it shows.** In the panel's real-time path section, the owner and admins see one control:
    - "Turn off" while the path is on;
    - "Turn on" while it is off. An unreadable switch counts as off, as in story 4.
  - **While a change is under way,** the control is disabled and says so. If the server has not answered within 15
    seconds, the control is enabled again and the panel says the outcome is unknown. It then shows the state from its
    next read.
  - **A warning beside "Turn on"** shows when the report holds no finished pass. It says that taggings already on the
    relay wait for a pass. When the report cannot be read, the warning says it could not check.
- [ ] **AC-2. Turning off asks first.** Pressing "Turn off" opens a prompt before anything changes.
  - **Normally, the prompt says:**
    - that the path stops reflecting changes within seconds;
    - that what it was holding is kept, and changes stored meanwhile are caught up when it is turned back on, apart
      from the few cases story 3 leaves to the next pass;
    - what keeps the graph in step meanwhile. This is described as story 4's backstop section describes each of its
      schedule states. When the schedule cannot be read, it says the backstop could not be checked.
  - **Before the path has completed its first start,** the prompt says instead:
    - that what it has gathered so far is dropped;
    - that the next "Turn on" is a first start again;
    - that whatever the relay holds then waits for a pass, so one should run after the path shows live (OPERATIONS
      §12.9's order).
  - **Cancelling** sends nothing and changes nothing.
  - **Confirming** turns the path off, and within 10 seconds the panel shows it off.
- [ ] **AC-3. Turning on, without a false alarm.** Pressing "Turn on" asks nothing. Within 10 seconds the panel shows
  the path on.
  - **The starting window** counts from the time the server recorded the switch last going from off to on, whoever
    made the change and however. Every viewer sees it, and it survives a reload.
  - **Within the window,** for up to 60 seconds, the panel says the path is starting, never that it has failed. A
    process that started before that "on" does not count as running, so a quick off-then-on shows "starting", not
    "running" and then red.
  - **Past 60 seconds** without the process running, it shows story 4's "on, but its process is not running" warning,
    as today.
  - **An "on" while the path is already on** does not restart the window.
- [ ] **AC-4. Who may.**
  - **The server decides.** It accepts a change only from a signed-in owner or admin.
  - **It refuses everyone else, and changes and records nothing:** a signed-out request, a signed-in user who is
    neither owner nor admin, and a request from another site.
  - **Last change wins,** whoever made it: an admin may turn back on what the owner turned off, and the other way
    round.
  - **Refused or failed.** When the server refuses the panel's request, or cannot make the change, the panel shows the
    reason and the path's state unchanged. A refusal can come from a lapsed session, or from a viewer who is no longer
    owner or admin. Turning on fails, for example, when the server cannot write the switch.
  - **An off still takes effect** when the server cannot record it, as story 3 defines ("off means off"); AC-5 says
    what is shown.
- [ ] **AC-5. Who did it.**
  - **What is recorded.** Every change records who made it (owner or admin, and a shortened key) and when. That holds
    whether the change came from the panel or another way, such as the console snippet.
  - **The one exception** is an off that the server could not record (AC-4). Its answer says the change could not be
    recorded. The panel then shows the path off with no "who" or "when" for that change, and never an earlier "Turned
    on by …" as the latest change. The history recorded before it survives.
  - **What the panel shows:**
    - the latest change, for example "Turned off by an admin (ab12cd34…) at 14:02";
    - the last 10 changes, newest first.
  - **When no change is recorded,** for example on an instance never switched (the path ships off), the panel says no
    change has been recorded and the history is empty.
  - **The change made before story 5,** where one is stored, shows as the owner's, with its stored time and key. Only
    the owner could make one then.
  - **It lasts.** The record survives restarts and deploys.
  - **Who may read it.** Only a signed-in owner or admin may read who made a change, for the latest change and the
    history alike, and the server enforces it. A signed-out reader, or a signed-in user who is neither, gets no "who"
    from any route. The public status may still say when.
- [ ] **AC-6. Nothing else moves.**
  - Turning the path on or off does not start, stop or queue a pass, and does not change any schedule.
  - The path stops and starts as story 3 defines: it is off within 5 seconds, and catches up when it starts.
  - The panel's reads still change nothing. Nothing else on the panel or in Settings changes, apart from three things:
    - this story's control, prompt, starting state and record;
    - the copy and fields that carry-forwards R2-1 to R2-6 change;
    - the references to story 5 that the docs tasks point at story 6.
  - Follows, mutes and reports are untouched.

### Docs tasks

- **OPERATIONS §12.9.**
  - The panel's control is the way to switch, for the owner or an admin. The console snippet still works, for both,
    and is recorded the same way.
  - Correct "On starts the path within a few seconds": it can take up to about 30 seconds after short runs.
  - Correct "it backs off 1→30 s between failed runs". The wait also follows a clean exit within a minute of starting,
    a switch-off included, and a minute of running resets it (ADR 0003's wrapper and `run.sh`).
- **BIBLE.**
  - §11: the switch row and the section's intro give who may switch (owner or admin, enforced by the server, last
    change wins) and the record of who and when. The status row changes too, if the record is served there, as does
    any route added to read it.
  - §6's status paragraph and §4's services row stop saying only the owner switches.
  - A §16 entry and the Last-updated line.
- **ADR `tagging-edges/0003` (the Architect).** Amend who may switch (owner → owner or admin) and the record of who
  did it. At Architecture, as story 4's C7 note was, add an amendment note to story 3 AC-5 ("any session that is not
  the owner's is refused") pointing at story 5 and the ADR.
- **Point run, stop and confirm at story 6.** The places that still give the pass's controls to story 5 are:
  - OPERATIONS §12.8;
  - BIBLE §16;
  - ADR 0002:550;
  - ADR 0004:347 and :812-813;
  - the panel's own comments, in `HeldSection.jsx` and `TaggingPipelinePanel.jsx`.

  The handoff and the epic were pointed at story 6 at this Planning.
- **The handoff § 0 and the epic** follow at the ship.

### Test tasks

- **Server cases for AC-4:**
  - owner and admin, each turning the path on and off;
  - each refused caller;
  - a failed on: the write fails, the answer is an error, and nothing changes.
- **Server cases for AC-5:**
  - the record and the history;
  - the pre-story-5 change, and the empty state;
  - an off that could not be recorded: the path is off, the answer says not recorded, and the earlier history is
    intact;
  - refused readers of "who": signed out, and signed in as neither owner nor admin.
- **Browser cases** on the rebuilt UI:
  - AC-1: on, off and under way; no answer within 15 seconds; the no-finished-pass warning, and the
    report-cannot-be-read version of it.
  - AC-2: the prompt for each of story 4's schedule states and for an unreadable schedule; the first-start version of
    the prompt; cancelling.
  - AC-3:
    - starting, up to and past 60 seconds;
    - a viewer who did not press;
    - a reload during the window;
    - an "on" while the previous process is still stopping;
    - an "on" while already on.
  - AC-4: a refused request and a failed change.
  - AC-5: the latest change and the history, the empty state, and an unrecorded off.
  - R2-6 (added by the Product Owner; the review asked for no test): the two redacted fields under "Where it failed",
    and remedies that no longer point at "the task log" or `strfry-error.log`.
- **Story 4's GET-only pins are revised, not deleted:**
  - PS13 and the browser spec's non-GET log allow exactly this control's request.
  - PS14's allow-list of paths adds the switch route, plus any read route the Architecture adds for AC-5's record, and
    nothing else.
  - TF1 stays as it is, so every read still sends GET.

### Carry-forwards from story 4's review (R2-1 to R2-14)

Placed by the owner on 2026-10-01 (`reviews/tagging-edges/4-tagging-pipeline-panel.md` § "Re-review, round 2"; the
epic's item 5 holds each one's ask). All 14 still stand on staging (read at `5e20d462`; story 4's code is unchanged
since `77ae0da4`). Who does each:
- **Implementer (copy and docs):** R2-1's copy, R2-2, R2-3's copy, R2-4, R2-5, R2-6, R2-7's OPERATIONS half, R2-8's
  handoff half, and R2-14.
  - R2-2 also covers the read-stage and plan-stage `failureCode` sentences that say "changed nothing", `plan-error`
    included. The schema step that may create the rule runs before both.
  - R2-8 since the split: ADR 0002 decision 14, :550 and :1237 ("any control-panel page or button (story 4)") point at
    story 6. The handoff's "Recommended shape for story 4" block points at stories 5 and 6.
- **Architect (ADR):** R2-1's T12 half, R2-7's ADR 0004 half, R2-8's ADR halves, R2-9, and R2-11's ratification.
  R2-11 is either ratified, or the `ERR_` exclusion and the `Security.Forbidden` reading are reverted, at this
  story's Architecture.
- **Tester (tests and test plan):** R2-3's browser case, R2-10 (B50), R2-11's pins, R2-12 and R2-13. R2-12's TV48
  title is in `test/tagging-pipeline-view.test.js`, not the test plan.

## Concepts touched

None directly. The path it switches reflects taggings of
`39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag` (and this deployment's own
stamp, TA resolved at runtime) into relationships between `39998:<TA>:nostr-user` ends, as in story 4.

## Out of scope

- **The pass's controls: story 6.** These are:
  - running a pass now;
  - stopping one;
  - confirming held removals;
  - showing a waiting pass;
  - closing the general run-task route for this pass;
  - ledger row `2026-09-28-confirm-route-joins-finishing-job`.

  The owner's decisions for them are in the epic's item 6.
- **How fast the path starts and stops.** Story 3's behaviour stands. The panel only stops calling a normal start a
  failure.
- **Refusing an off that cannot be recorded.** That would change story 3 AC-5's "off means off"; it was not proposed.
- **Who may change schedules, and the other open routes:** the 2026-07-21 intake sweep, as in story 4.
- **Streaming ETL's controls:** unchanged.
- **Why a deploy's catch-up takes about 30 seconds** (story 3 § Evidence): not examined here.
- **An owner's "off" that only the owner can lift:** declined at Planning.

## Open questions

None, once the owner ratifies the Product Owner's proposals below by approving this story.

**Decided at Planning (2026-10-01, the owner):**
- **The split.** Story 5 is the path's switch; story 6 is the pass's controls.
- **Who may switch.** The owner or an admin, enforced by the server (from story 4's Planning). Last change wins.
- **The prompt.** One comes before turning the path off; turning it on asks nothing (from story 4's Planning).
- **Who did it.** It is recorded and shown: the latest change, and a short history.
- **Carry-forwards.** R2-1 to R2-14 go here.

**Proposed by the Product Owner, ratified with this story:**
- the history keeps the last 10 changes;
- "who" shows as owner or admin plus a shortened key;
- only a signed-in owner or admin may read "who"; the public status may still say when;
- the warning beside "Turn on" when the report holds no finished pass;
- the 60-second "starting" window, counted from the recorded "on";
- the 15-second limit before a request with no answer reads "outcome unknown";
- **evidence:**
  - a browser test on the rebuilt UI;
  - on staging, the owner and an admin each turn the path off (through the prompt) and on, and the history shows
    both;
  - a direct request from a user who is neither owner nor admin is refused, and gets no "who";
  - the path catches up after. Production's path is not switched for evidence.

**Accepted at Architecture (2026-10-01, the owner):** ADR `tagging-edges/0005`'s two residuals, each needing a failing
data volume. In them, AC-5's "The history recorded before it survives" and the test task "the earlier history is
intact" do not hold (ADR 0005 § Consequences):
- **(a)** an off fallback after a failed pre-fold;
- **(b)** a history file that gives a read error.

## Evidence

### The local stack (2026-10-01)

The backend was restarted at 01:39:06Z on 2026-10-02 (`scripts/dev-refresh.sh`), and the UI was rebuilt
(`index-BccDuG5m.js`). Read through the real routes, signed in as the local owner, whose key stayed in memory:
- **Signed out,** `GET` and `POST /api/tagging-edges/realtime/switch` answered 401. The public status's members are
  story 3's plus `inStartWindow`.
- **Before any story-5 change,** the record read `recorded`, with the latest change being the owner's off of
  2026-09-29 (`f0178122`): the version 1 record, read as the owner's.
- **A foreign `Origin`** got 403 `cross-site request refused`.
- **Turning on.** It answered 200 `recorded: true`. The next status read showed `on`, `inStartWindow: true`, not
  running.
  - The process started 0.6 s after the change, so the next read showed it running and `live`, with `inStartWindow`
    false. It stayed so for 60 s of reads.
  - The record then held the on, with the earlier off folded in below it. The public status never carried the key.
- **Turning off from the panel,** rendered headless.
  - "Turn off" opened the inline prompt. Its normal variant said, correctly for this instance, that no enabled entry
    runs the pass.
  - Its "Turn off" sent exactly one `POST {"on":false}`.
  - The panel then read "The path is off", "The path was turned off", and "Turned off by the owner (f0178122…)", with
    three changes in the history. The console showed no errors.
- **The path was left off,** as it was before.

## Deviations

Small judgement calls made at Implementation (2026-10-01), too small for an ADR amendment.

- **Server.**
  - **An unexpected throw.** A throw inside the serialised change outside the cases D2 and D11 name (for example the
    clock) answers 500 `could not change the switch: <code>`, with an allow-listed `code`.
  - **The read-error 500** for an on whose switch cannot be read also carries an allow-listed `code`, like D11's other
    500s (SR24 allows it).
  - **A reader that throws** inside the step, instead of returning `readError`, is mapped as the store maps it. This
    is a safeguard only: the store's readers never throw.
  - **"ISO time"** means `YYYY-MM-DDTHH:MM:SS[.fraction]Z` that `Date.parse` accepts, the form `toISOString` writes. It
    is one rule for the status's `onSince`, `switchEntry` and history-entry validity.
  - **`switchEntry` follows D3 literally.** A version 1 record needs `role` absent to read as the owner's, so `role:
    null` reads as not recorded. An off counts as recorded only when its `onSince` is exactly null.
  - **History entries are served reduced** to `{on, at, role, key}`, so extra members in a hand-edited file never
    reach the GET.
  - **`ownerOrAdmin` calls both lookups before deciding,** as the drift gate did. The owner still wins the role.
  - **The record GET's 500** carries only its sentence, with no separate `code`, as the status route does.
  - **"Base differs from the stored valid entries"** compares `(on, at, role, key)` in order. So a stored history
    with repeats, or over 10 entries, gets one pre-fold that rewrites it deduplicated and capped.
  - **`canonicalSwitch`** checks only what D1 names for version 2: a boolean `on`, and a role of owner or admin.
- **Panel.**
  - **The control and record** live in a new `taggingPipeline/PathSwitch.jsx`: the control, the off prompt, the
    warning beside "Turn on", the outcome line and the record. `BackstopVerdict` is a named export of
    `ScheduleSection.jsx`, which renders it where `:44-67` stood.
  - **Copy.**
    - The starting line: "The path was switched on at … and is starting, which can take up to about 30 seconds."
    - While pending: "Turning the path on…" or "…off…", disabled, with `aria-busy="true"`.
    - The prompt's heading is an `h4`, "Turn the real-time path off?", in a `settings-group` with a token warn
      border.
  - **The first-start prompt** keeps the shared line "The path stops reflecting changes within a few seconds", which
    is true in both variants. It drops only the normal variant's kept, caught-up and backstop lines.
  - **A failed change with no `body.code`** (a 404, or a 502 HTML page) shows `readSection`'s own `http-<status>` as
    its code.
  - **The last change's outcome sentence** stays under the control until the next change or a close, and is in the
    past tense ("The path was turned off.").
  - **`switchRecordView`** reads loading while the path status has no body. A ready record whose state is not one of
    D3's four reads as failed, with `bad-json`, as `ScheduleSection.jsx` does.
  - **The record's layout.** A "Latest change:" label appears only for the recorded and unrecorded-off states. The
    list is headed "Recent changes, newest first:".
  - **R2-1.** `N/A` and `ProtocolError` get countCode entries worded for counts and the path, and failureCode entries
    worded for any graph stage. The failureCode ones add that batches written before a write failure stand.
    `no-status` asks for a bug report.
  - **R2-2** also covers every read-stage and plan-stage failureCode sentence. The identity and config sentences keep
    "changed nothing", because those checks run before the schema step.
  - **R2-4.** The path line's "The explained part does not include them" shows only where an explained part is shown.
    So it is also dropped when a count is unknown.
  - **R2-5.** `passReason.stopped` leads with the report write and the data volume. It says the `TASK_ERROR` line
    carries `reportWriteFailed`, and may itself be missing on a full disk.
  - **R2-6.** "Where it failed" is followed by "Its error message: …" and, for a relay read, "The relay command's last
    output: …". The countCode pointers to `strfry-error.log` stay: they explain the drift count and the path's last
    error, not a pass.
  - **The panel's hint** reads "Apart from the real-time path's switch, it changes nothing."
- **Docs.**
  - **OPERATIONS §12.9's opening** now says "Once the owner or an admin turns it on", a line the ADR's list left out.
  - **§12.9's state-file list** names `switch-history.json` beside `switch.json`.
  - **§12.9 gains a "Who changed it" paragraph** after the switch's answer: the record, the unrecorded off, the version
    1 reading, the gated GET, and ADR 0005's residuals.
  - **`inStartWindow`** is its own table row after `running`, `runningSince`.
  - **The 403 text** also names `BRAINSTORM_ADMIN_PUBKEYS` (OPERATIONS §10.2's list), and says both lists are re-read
    on every request.
  - **§12.9 gives a failed on's remedy:** a 500 with a `code`; check that the data volume has free space and is
    writable.
  - **BIBLE §16's story-3 entry** keeps "Owner-only switch", with "(owner or admin since story 5, below)". Story 4's
    "sends only GETs" stands as built.
  - **The new §16 entry** is dated 2026-10-01, the implementation date, as story 4's was.
  - **The handoff's "Recommended shape for story 4" block** keeps its bullets and gains a "Settled by
    `tagging-edges/0004`" note, the form the story 2 and story 3 blocks use.

## Linked artifacts

- ADR: `engineering-team/decisions/tagging-edges/0005-real-time-path-switch.md`
- Test plan: `engineering-team/stories/tagging-edges/5-real-time-path-switch.test-plan.md`
- Review: (filled in after Review phase)
