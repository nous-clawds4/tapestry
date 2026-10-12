# Review: Story 1 — The self-Map page and its check

**Reviewer:** Claude (acting as Reviewer), with a second, independent reader of the code (a Reviewer subagent that
wrote nothing and ran no gate). Every finding below was reproduced by the lead Reviewer before it was recorded.
**Date:** 2026-10-12
**Diff:** `git diff 00341d7e..476f8b17` on `feat/assistant-self-map` (`00341d7e` is `origin/staging` and the merge base),
attributed commit by commit:
- Tests: `d5b9b7b1` (Phase 3) and `f3ce6c50` (the plan's approval and ADR Amendment 1). Neither touches `src/` or `ui/`.
- Code and docs: `476f8b17` (the implementation, `openapi.yaml`, BIBLE §11, the story's § Deviations and the book's
  recheck note). It touches no file under `test/` or `tests/`.

**Story:** `engineering-team/stories/assistant-self-map/1-the-self-map-page-and-its-check.md` (§ Copy and § Deviations
as amended)
**ADR:** `engineering-team/decisions/assistant-self-map/0001-a-self-map-check-from-what-has-landed.md` (Accepted;
Amendment 1)
**Test plan:** `engineering-team/stories/assistant-self-map/1-the-self-map-page-and-its-check.test-plan.md`
**Spec:** `protocols/drafts/treasure-maps.md` § 3, § 5, § 6, § 8, § 9, § 9.2; `protocols/drafts/duty-menus.md` § 6.2, § 10

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`** on `476f8b17`, clean tree, label `assistant-self-map-1-review`. `npm run gate:status`:

  > `20261012T165621Z-5801-9e9e [assistant-self-map-1-review] started 2026-10-12T16:56:21.117Z on 476f8b17 — PASS, exit 0, 5811 passed, 0 failed, 582 skipped, 306/306 suites`

  This matches the Implementer's run on the same commit, `20261012T164357Z-8901-b156`. The suites this story owns or
  re-aims:
  - `assistant-self-map-check` 48 / 0 / 0, `assistant-self-map-page` 10 / 0 / 0;
  - `assistant-duty-cards` 12 / 0, `assistant-coming-soon` 12 / 0, `assistant-management-page` 23 / 0 / 1;
  - `assistant-duty-menu-check` 65 / 0, `assistant-duty-menu-page` 15 / 0, `assistant-attention` 38 / 0 / 1;
  - `assistant-identification-tags-page` 16 / 0, `assistant-outbox-check` 29 / 0, `assistant-profile-check` 33 / 0;
  - `assistant-shared-categories` 21 / 0, `assistant-trusted-content` 30 / 0.

  The two skips are live H-class tests (no stack here).
- [x] **Playwright, chromium.** I rebuilt `ui/` at `476f8b17` (`vite build`) and served it with `vite preview` on :4180
  (`/opt/pw-browsers`). `assistant-self-map`, `assistant-management-page`, `assistant-attention`, `assistant-alert`,
  `assistant-coming-soon` and `assistant-duty-menu`: **75 passed, 0 skipped, 0 failed** (3.6 m). The Implementer's
  wider run over every `assistant-*`, `setup-alert*` and `my-assistant*` spec, on Chromium and Mobile Chrome, was 647
  passed and 10 skipped. Firefox and WebKit are not installed here. I stopped the server afterwards.
- [x] `bash scripts/harness-lint.sh`: **clean (0 violations)**. ESLint on the four UI files is clean.
- [x] `src/api/openapi.yaml` parses (`js-yaml`). Its attention block names `treasure-map` and carries `duties`,
  `shouldSay`, `published.selfEntries`, `published.otherEntries`, `mapFound` and `instanceMap`.
- [x] **Shared lines** (ADR § Implementation notes 9). `git fetch origin staging` left `origin/staging` at `00341d7e`,
  this branch's base. `git merge-tree --write-tree HEAD origin/staging` is clean. `protocols/` is unchanged since this
  book's intake read of § 9.2 and § 6. ADR `duty-menus-and-self-maps/0004` is still Proposed (revision 2), so the book's
  watch item stands: `39998:`/`39999:` duty entries remain `unchecked` lines, as ADR 0001 says. The book records it.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._ The UI's `vite build` succeeds.

## Spec adherence

- [ ] Every acceptance criterion has a passing test, **but AC-6 is not fully met in the code** (B1).
  - **AC-1, whose Assistant.** `attention.js` passes the session's `{ viewer, assistantPubkey }` to `checkSelfMap`.
    `selfMap.js` never reads the request (S1); U4 sends a nosy query, params and body that change nothing. Visitors and
    viewers with no Assistant here get nothing (U1, U2).
  - **AC-2, the duties and live.** The duties come from the viewer's Map through `mapGroups` and § 6 precedence. The
    offer is the Duty Menu's own (`resolveOfferInputs` + `buildOffer`, `selfMap.js:237-238`). Live is read from what
    has landed (`readUpkeep`, `selfMap.js:134-177`). **The upkeep reading counts schedules the instance never runs
    when `TASK_QUEUE_ENABLED` is absent or not exactly `true` (B2).**
  - **AC-3, what it should say.** In every case either reader tried, `shouldSay` never held a part that wasn't live
    or offered. That covers the staging worked example, the metric trap, the template Map, `*`, a `tag` key, Concepts
    by § 9.2 Ties, and relays on both Docker and bare metal.
  - **AC-4, which self-Map.** `lookupSelfMap` (`selfMap.js:190-219`) is ADR sub-decision 5 line for line: local first;
    otherwise one outside round over the Map's hints and the Assistant's write relays (capped at 50, each through the
    DNS guard) plus the offer's relays; the newest counts. `readSelfEntries` ignores `39998:`/`39999:` self-entries.
  - **AC-5, true, the mark and the count line.** `current = sameSelfEntries(...)`, `done = finished && current`
    (`index.js:444-446`). `treasure-map` sits in `CHECKED_ACTIONS` after `duty-menu`, and `attentionCountText(0)`
    reads "Nothing needs attention" (C1–C4, B1, B2).
  - **AC-6, the page.** The states, the three panels, one status line only when finished, both links through their
    constants, the Owner's line only with `instanceMap` and a published self-Map, and the public line are all there
    (P1–P4, D1–D6, B3–B11). **But a part the found self-Map claims that is not offered is not said to be claimed
    (B1).**
  - **AC-7, read-only, one request.** The page reads only `useAssistantAttention()` (D4; B12 sees one GET, no
    parameters, nothing but GETs). The check only scans strfry, reads relays and reads the schedule file (S1).
- [x] No criterion is silently dropped. The three implementation judgment calls are in § Deviations.
- [x] No behaviour beyond the story.

**§ Copy, word for word.** The strings in `ui/src/pages/assistant/assistantTreasureMapCopy.js:15-61` match § Copy as
amended, including the three reasons added at Architecture. One phrase is not in § Copy (N4).

## ADR adherence

- [x] **Files match § Implementation notes 1–7.** The library exports the list in note 1, plus `categoryOfKind` and
  `mapGroups`. `selfMap.js` reuses `scanLocalStrict`, `lookupNewest`, `treasureMapRelays`, `outsideOnly`,
  `readWithinBudget`, `newest`, `resolveOfferInputs`, `assistantWriteRelays`, `buildOffer` and
  `isPublicRelayHostWithin`, as note 2 lists. `schedulerSwitch.js` holds the kill switch, and `scheduler.js`
  re-exports it. The attention wiring and the docs match notes 5 and 7.
- [x] **Amendment 1, items 1–9:** each matches the code. Both readers checked them.
- [x] **Layering.** The rules are pure in `src/lib/self-map`. I/O sits in `selfMap.js` behind injectable deps, and
  the page only reads the shared answer.
- [x] **Dependencies.** `cron-parser` is `4.9.0` exact in `package.json` and the lockfile (S4), as open question 3
  approved. Nothing else was added.
- [ ] **One deviation from sub-decision 7** (B1), and **one place where sub-decision 6's own wording is wrong against
  the code it describes** (B2). B2 needs an ADR amendment, not only a code change.
- Trivial drift, no action needed beyond a line in the next amendment: `evaluateSelfMap` takes
  `{ mapEvent, scores, record, lookup }`, and an unfinished Map lookup is mapped to its reason in `checkSelfMap`
  (`selfMap.js:242`) instead of the pure function. Behaviour is the same.

## Concept-graph integrity

- [x] No concept handles are created or changed. No firmware reinstall is needed (story § Concepts touched).
- [x] No per-deployment TA pubkey is hardcoded. The Assistant comes from the session's answer, and the Owner from
  `BRAINSTORM_OWNER_PUBKEY`; a grep for the local-dev literal finds nothing in the new files.
- [x] Nothing re-derives concepts from BIBLE.md.

## Things tests can't catch

- [x] No secrets committed. No leftover debug logging, commented-out code or TODOs. The one `console.error` is the
  attention handler's isolated-failure log, as the other checks have.
- [x] **Read-only, so merge-preserve holds.** Nothing signs, publishes, imports into strfry or writes a file. The TA's
  10040, which is also the instance's own Map, is only read.
- [x] **Network safety.** The 50-relay cap is applied before the DNS guard, and the guard runs on every event-named
  relay. Every outside read goes through `readWithinBudget`. Nothing from the request reaches a relay.
- [x] **Failure isolation.** A throw becomes `SELF_MAP_CHECK_FAILED` with all ten fields (U31). `no-relay-answered`
  and `instance-unanswered` are used as the ADR says.
- [ ] **Truthfulness of "live"** (the book's first constraint: self-entries claim only what is truly live). B2.

## House rules check

- [x] Concept Graph API authority respected (no concept reads or writes).
- [x] No new lint/typecheck/build tooling.
- [x] The new route needed no `routeAccess.js` entry: the answer rides `GET /api/assistant/attention`, still
  `PUBLIC_READ` (S6).

## Product-guide adherence *(when the story traces to a PRD)*

Not applicable: no PRD. The book is anchored by an acceptance frame.

## Findings

### Blocking

1. **B1 — `src/lib/self-map/index.js:406-409`: a claim on a part that is not offered is never marked.** The
   not-offered line is always pushed with `falseClaim: false`.
   - **Why this blocks.** AC-6 says: "A part that the found self-Map claims but that is not live, or not offered, says
     that too." ADR sub-decision 7 says `falseClaim` is true "when a found self-entry wins one of the line's duty
     probes that isn't live at that self-entry's relay". A part that is not offered is never live, so the ADR's rule
     covers this line too.
   - **Reproduced.** Take staging's Owner Map shape, with Scores live: `["3038x", TA, R]`, `["39998", TA, R]`, and
     `["30382:rank", OTHER, …]`. Add a found self-Map holding `["3038x", TA, R]`.
     - `current` is false, so the status line reads "out of date".
     - The `3038x` not-offered line has `falseClaim: false`, though the self-entry claims 30383–30389, which this
       instance doesn't offer. The `30382` line reads `offered`, `live-unclaimed`.
     - So no line on the page says why it is out of date. The test plan does not cover this case.
   - **Ask.**
     - **Tester:** add a failing check test with this scenario. The not-offered line should carry
       `falseClaim: true`, and a browser assertion should show the false-claim sentence on that line.
     - **Implementer:** set the not-offered line's `falseClaim` to whether any found self-entry wins one of
       `unoffered`'s duty probes. Use the same `winnerOf(claims, probe, …)` the offered lines use.
2. **B2 — `src/api/assistant/selfMap.js:106-107` (and ADR sub-decision 6, line 313): schedules count when the
   instance never runs them.**
   - **The problem.** The check counts BullMQ schedule entries unless `TASK_QUEUE_ENABLED` is `'false'`, and it
     defaults the flag to `'true'`. The instance does the opposite: it starts the queue and the scheduler only when
     the flag is exactly `'true'`, defaulting to `'false'`. See `bin/control-panel.js:333`, `src/api/index.js:555`,
     `src/api/manage/commands/runTask.js:417` and `src/api/deploy-safety/index.js:100`. ADR sub-decision 6 says "when
     `TASK_QUEUE_ENABLED` isn't `false`", so the code follows the ADR and the ADR is wrong.
   - **Reproduced.** With the setting absent, or set to `'1'` or `'True'`, `scheduleIntervals` still returns 12 h from
     an enabled `processAllTasks` entry that will never run.
   - **The consequence.** A `brainstorm.conf` without the line and a leftover enabled entry, after a manual run that
     landed Scores, give Scores `live` for up to two intervals. `shouldSay` then claims `30382` though nothing will
     keep it up to date. That breaks the book's first constraint, and story 3 will publish what `shouldSay` says.
   - **Ask.**
     - **Architect:** Amendment 2 to sub-decision 6: BullMQ entries count only when
       `getConfigFromFile('TASK_QUEUE_ENABLED', 'false') === 'true'`, as the control panel reads it.
     - **Tester:** add failing tests with the setting absent, and with `'True'` and `'1'`. None of them counts a BullMQ
       entry. The systemd timer still counts.
     - **Implementer:** change line 106 and the doc comment at line 100.

### Non-blocking

1. **N1 — `selfMap.js:84-93`: a cron entry's allowance depends on when it is read.** The interval is the gap between
   the next two fires. For `0 3 * * 1-5`, that is 72 h when read on a Thursday morning, so a 5-day-old landing reads
   as live. On a Monday before 03:00 it is 24 h, so Friday's landing reads as stopped. The first error claims more
   than is live. This conforms to the ADR. Recommendation: fold into Amendment 2 and take the shortest gap over the
   next several fires. That errs toward claiming less.
2. **N2 — `src/lib/self-map/index.js:336`: `otherEntries` over-counts.** It counts every tag whose element 2 is a
   64-hex key other than the author's, including `["p", X]` and keys that don't parse. A probe gave 3 where there was
   1 real entry, so the Owner's line would overstate N. Recommendation: count only tags whose key parses, as
   `mapGroups` does. This can ride the fix push.
3. **N3 — `index.js:44-48`: `categoryOfKind` falls back to `'concepts'`.** Any kind outside the two families gets
   it, so a Map entry `30023` naming the Assistant shows as "Concepts · 30023 · Not offered". Recommendation: return
   null, and the page shows no category. This can ride the fix push.
4. **N4 — `ui/src/pages/assistant/assistantTreasureMapCopy.js:94`: a phrase that isn't in § Copy.** "…last landed an
   unknown date." can't be reached in practice, because `upkeep-stopped` always carries the 30382's `created_at`.
   Recommendation: drop it (return `null`), or record it in § Deviations. This can ride the fix push.
5. **N5 — `selfMap.js:103-122`: the per-customer scheduler is not read.** `src/api/customer-schedule/index.js` runs
   `processCustomer` per customer on an in-process timer, set in `/var/lib/brainstorm/customers/<name>/schedule.json`
   and started at `src/api/index.js:511`. It doesn't depend on BullMQ or the flag, and ADR § Context's survey missed
   it.
   - A customer whose Scores are kept this way reads `not-scheduled`, and the page says "no upkeep is scheduled on
     this instance".
   - That claims less than is live, so it is safe, but the reason is false.
   - **Owner's choice:** fold it into Amendment 2, or open a ledger row.
6. **N6 — `selfMap.js:118`: a stopped systemd timer still counts.** The timer counts whenever its unit file exists,
   and the control panel can `systemctl stop` it (`setup/configure-control-panel-sudo.sh:64`). The ADR chose "the
   unit exists", so this is a follow-up: a ledger row, or an `is-active` read in a later amendment.
7. **N7 — `index.js:395-399`: `live-unclaimed` where nothing can be claimed.** A line whose parts are all live reads
   "Live, but your Assistant's self-Map doesn't say so yet." even when `shouldSay` cannot claim it. The page can then
   contradict "up to date".
   - **Reproduced.** The Map gives the TA `39998` and `39998:foo`. The `foo` header hasn't landed, other headers have,
     and no self-Map exists. `current` is true, yet the `39998` line says "Live, but…".
   - A self-entry at another relay than the live one also shows "Live, but…" beside "…claims this, but it isn't live."
   - Staging's Map has no named Concept keys, so it doesn't hit this today. The fix needs a copy decision, so this is
     a follow-up for the owner.

### Harness friction

1. **The ADR described a feature flag without citing the code that reads it.** Sub-decision 6 says "isn't `false`",
   while every reader in the code compares `=== 'true'` with a default of `'false'`. The fixtures' `DOCKER_CONFIG`
   sets the flag to `'true'`, so no test could notice. This is the same family as ledger row
   `2026-10-12-test-configs-not-from-deployments`. New `meta` row:
   `ledger/2026-10-12-adr-flag-reading-not-cited.md`.

## Verdict
**CHANGES_REQUESTED**

B1 is a criterion (AC-6) that the code does not meet, and that the ADR's own false-claim rule covers. B2 reads the
evidence of upkeep the opposite way from how the instance decides to run its schedules. Both fixes are small. B2 also
needs a one-line ADR amendment.

Round 2's order, as in `assistant-outbox-relays` #3:
1. The Architect writes ADR Amendment 2: B2, plus whichever of N1 and N5 the owner folds in.
2. The Tester writes the failing tests and records round 2 in the plan.
3. The Implementer fixes B1 and B2. N2–N4 can ride the same push.
4. Then this review runs again.

The story stays **Approved** until a later round passes.
