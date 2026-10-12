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

---

# Round 2

**Reviewer:** Claude (acting as Reviewer), again with an independent second reader of the code, who wrote nothing and
ran no gate. Every finding below was reproduced by the lead Reviewer.
**Date:** 2026-10-12
**Diff:** `git diff fe80e27e..7e4cae43`, attributed commit by commit:
- `50489762`: ADR 0001 Amendment 2, two ledger rows, and the story's ADR link. Docs only.
- `c5d4032f`: the Tester's round-2 tests, the plan's round-2 record, and Amendment 2 item 3's reworded rationale. It
  touches no `src/` or `ui/`.
- `7e4cae43`: the fix, in `selfMap.js`, `customer-schedule/index.js`, `openapi.yaml`, `src/lib/self-map/index.js` and
  `assistantTreasureMapCopy.js`, plus an occurrence on the RW7 flake row. It touches no `test/` or `tests/`.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`** on `7e4cae43`, clean tree, label `self-map-round2-review`. `npm run gate:status`:

  > `20261012T200901Z-5763-d03d [self-map-round2-review] started 2026-10-12T20:09:01.929Z on 7e4cae43 — PASS, exit 0, 5820 passed, 0 failed, 582 skipped, 306/306 suites`

  `assistant-self-map-check` 56 / 0 / 0 and `assistant-self-map-page` 11 / 0 / 0. These match the Implementer's run on
  the same commit, `20261012T195520Z-29834-25f1`.
- [x] **Playwright, chromium.** I rebuilt `ui/` at `7e4cae43` and served it on :4183. `assistant-self-map` (B0–B13),
  `assistant-management-page`, `assistant-attention`, `assistant-alert`, `assistant-coming-soon` and
  `assistant-duty-menu`: **76 passed, 0 failed** (4.9 m). I stopped the server afterwards.
- [x] `bash scripts/harness-lint.sh`: **clean**. `openapi.yaml` parses.
- [ ] **Shared lines: `origin/staging` moved, and the book's watch item fired.** `git fetch origin staging` moved it
  from `00341d7e` to `7ab2c955`. `git merge-tree --write-tree HEAD origin/staging` is clean, and staging changed no
  code. But it changed the spec and decisions:
  - `duty-menus-and-self-maps` #4 (the key grammar) is implemented and passed review, and **ADR 0004 is Accepted**.
  - `protocols/drafts/treasure-maps.md` changed in §§ 4.4, 4.5, 4.6, 6 and 9.2.
  - That book's story 5 (the rules that keep a self-Map true) is approved, as a docs story.
  - A new ledger row, `2026-10-12-treasure-map-concept-key-readers`, lists shipped readers that take Concept keys
    otherwise than the accepted grammar. It says "No other reader was checked"; this library is one more.

  The book's § Shared lines pre-registered this case: "If 0004 is accepted, the Implementer drops those entries from
  the duties, and the Reviewer checks it." See R2-B1.

## Round 1's findings, each re-derived as a fresh claim

| Finding | Re-derived by | Result |
|---|---|---|
| **B1**, a claimed not-offered part | Round 1's own reproduction run again: staging's shape plus a found `["3038x", TA, R]` | The `3038x` not-offered line now has `falseClaim: true`, and `current` is false. **Fixed** (`index.js:411`). |
| **B2**, the queue flag | `scheduleIntervals` with the setting absent, `"true"`, `"True"`, `"1"`, `" true "` and `"false"` | Only `"true"` counts the entry (12 h); every other value gives null. That is `getConfigFromFile(…) === 'true'`, as `bin/control-panel.js:333` reads it. **Fixed.** |
| **N1**, the cron interval | `0 3 * * 1-5` read on a Thursday 04:00 and a Monday 02:00; `0 */6 * * *`; monthly; every minute; an unparseable expression | 24 h, 24 h, 6 h, 672 h, 1 min and null. **Fixed.** |
| **N5**, the per-customer timer | `scheduleIntervals` for a customer with and without a timer, with the flag off and the systemd timer at 6 h; for the Owner; with a throwing lookup. The getter read in `customer-schedule/index.js`. | The customer's 24 h timer is used (the systemd timer stays the fallback). With no timer, 6 h. The Owner gets 6 h, never the customer's timer. A throw falls back to 6 h. The getter answers null for a trigger-only state, and the state is restarted by `handleUpdate` and deleted by `stopCustomerTimer`. **Fixed.** |
| **N2**, `otherEntries` | L6, and a probe with a `p` tag and an unparseable key | Counts 1. **Fixed**, but see R2-B1 for `39998:`/`39999:` entries naming other keys. |
| **N3**, null category | U38, and the page's fallback: `categories[null]`, then `categoryOf('30023')` gives null | No category is shown. **Fixed.** |
| **N4**, no date | P5 | No line. **Fixed.** |
| **N6, N7** | `ledger/2026-10-12-stopped-timer-counts-as-upkeep.md`, `ledger/2026-10-12-live-unclaimed-when-unclaimable.md` | Both rows exist, **OPEN**, as Amendment 2 item 9 says. |

**ADR adherence, Amendment 2:** items 1–7 match the code, and item 8's recorded drift is what was built.

## Findings

### Blocking

1. **R2-B1 — `src/lib/self-map/index.js:173` (`mapGroups`), `:284` (`buildShouldSay`), `:330` (`readSelfEntries`):
   Concept non-keys still give duties, and that turns a true self-Map false.**
   - **The rules, now accepted.** § 4.5 says a Concept kind and a colon alone (`39998:`, `39999:`) "is not a key …
     Readers MUST ignore a Map entry keyed so, a self-entry included, as if it were absent". § 4.6 says
     `39999:dlist-header` and `39999:duty-menu` name no Concept and ask for nothing. The `duty-menu` rule was already
     in the spec at intake; round 1 missed it.
   - **What the code does.** ADR 0001 (line 196, "`39998:` and `39999:` are unchecked") and the library keep such
     entries as duties.
   - **Reproduced.** Take staging's Owner shape, `["39998", TA, R]`, `["3038x", TA, R]` and `["39999", TA, R]`, with
     Scores live and headers present, and a found self-Map of `30382` and `39998` at R, which the spec makes exactly
     right. Adding any one of `["39999:duty-menu", TA, R]`, `["39999:dlist-header", TA, R]`, `["39998:", TA, R]` or
     `["39999:", TA, R]`:
     - `shouldSay` drops the true `39998` claim, to `["30382"]` only, because the phantom duty blocks it;
     - `current` becomes false, so the card is marked "Needs attention" and the status line says "out of date";
     - a line is marked `falseClaim: true`, so the page tells the owner that a true self-entry "claims this, but it
       isn't live".
     - With `39999:`, `compareKeys('39999:', '39999')` is 0, the only tie between distinct keys, though § 9.2 Ties now
       says none arise.
   - **Also.** Without the found self-Map, such an entry shows a duty line (`unchecked` or `not-published-here`), or an
     `elsewhere` line when it names another key. And `readSelfEntries` counts `39998:`/`39999:` entries naming other
     keys in `otherEntries`, so with three of them the Owner's line says "Its 3 other entries".
   - **Why this blocks.** Nothing false is claimed on the wire: every case claims less. But the page and the hub say
     something false about a correct self-Map. Story 3, which keeps the self-Map true by itself, would remove a true
     self-entry. The spec's MUST, and the book's pre-registered watch item, both now apply.
   - **Ask.**
     - **Architect:** Amendment 3, superseding sub-decision K1's "`39998:` and `39999:` are unchecked" (line 196):
       - an entry keyed `39998:` or `39999:` is dropped as if absent, from the viewer's Map and from a self-Map, and
         counts in neither `selfEntries` nor `otherEntries`;
       - `39999:dlist-header` and `39999:duty-menu` name no Concept: an entry keyed so gives no duty, matches no
         insight and blocks nothing. The Architect decides whether it still counts as an "other entry".
     - **Tester:** tests for the four Maps above: `shouldSay` keeps `39998`, `current` is true, no line is a false
       claim, and no item or `elsewhere` line comes from the non-key. Plus `otherEntries` with these entries naming
       other keys.
     - **Implementer:** drop them in `mapGroups` and `readSelfEntries`.

### Non-blocking

1. **R2-N1 — `index.js:392` and `:411`, with `:341`: a self-entry with an empty element 3 is flagged as a false
   claim.** § 9.2 (Meaning; Its relay) says such a self-entry "claims nothing". It still wins in § 6 among the
   self-entries, but it confirms nothing.
   - Reproduced: a found `["3038x", TA, ""]` marks both the `30382` line and the `3038x` not-offered line
     `falseClaim: true`.
   - `current` rightly stays false, because it differs from what the self-Map should say. Only the false-claim
     sentence is wrong.
   - `readSelfEntries` also turns an unparseable relay into `''`, so the fix has to tell the two apart. An
     unparseable relay is a claim at an unusable relay; an empty one is no claim.
   - **Recommendation:** fold this into Amendment 3, since it touches the same lines.
2. **R2-N2 — `index.js:365` (`dutyLines`, the meet's line key): § 4.4's Profiles category changes how some tag-key
   lines read.**
   - A family entry `3039x:tag::⟨X⟩` shows a line keyed `30392:tag::⟨X⟩`. Under the accepted § 4.4, that spelling
     names only the Profiles category. Duty Menus § 6.2 step 4 says such a meet "has no key".
   - A more specific `30392:tag:⟨D⟩:⟨X⟩` naming another key shows no `elsewhere` line.
   - These keys are `unchecked`, so they are never claimed. The issue is display only.
   - **Recommendation:** a ledger row, `ledger/2026-10-12-self-map-profiles-category-lines.md`, written with this
     review.
3. **Notes, not findings.**
   - `relayFor` refuses a bare `39998` unless `39998` and `39999` share a relay. That is stricter than § 9.2 Ties'
     example, but `buildOffer` always gives both the same relay.
   - The `anyHeader` scan would count a header whose `d` is empty or `dlist-header`, which §§ 4.5 and 4.6 say no key
     reaches. No producer of such a header was found.

### Harness friction

None new. The book's shared-lines recheck, run again before this round, is what caught R2-B1, as it was meant to.

## Verdict
**CHANGES_REQUESTED**

All of round 1's findings are fixed and re-verified. R2-B1 is new: ADR 0004's acceptance, during this round, made the
book's pre-registered watch item apply. One non-key in a Map turns a true self-Map into a reported false one.

Round 3's order:
1. ADR Amendment 3: R2-B1, and R2-N1 if the owner folds it in.
2. The Tester's failing tests.
3. The Implementer's fix.
4. Review round 3, with the shared-lines recheck again.

The story stays **Approved** until a later round passes.

---

# Round 3

**Reviewer:** Claude (acting as Reviewer). Every claim below was re-derived from commands.
**Date:** 2026-10-12
**Diff:** `git diff 74814e0e..6bfeefba`, attributed commit by commit:
- `6316cb4d`: ADR 0001 Amendment 3 and the story's ADR link. Docs only.
- `a0351d81`: the Tester's round-3 tests, the plan's round-3 record, and RW7 occurrences on its flake row. It touches
  no `src/` or `ui/`.
- `6bfeefba`: the fix, in `src/lib/self-map/index.js` only (+27 / −10). It touches no `test/` or `tests/`.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`** on `6bfeefba`, clean tree, label `self-map-round3-review`. `npm run gate:status`:

  > `20261012T210356Z-5740-46af [self-map-round3-review] started 2026-10-12T21:03:56.968Z on 6bfeefba — PASS, exit 0, 5825 passed, 0 failed, 582 skipped, 306/306 suites`

  `assistant-self-map-check` 61 / 0 / 0 and `assistant-self-map-page` 11 / 0 / 0. These match the Implementer's run on
  the same commit, `20261012T204954Z-3970-9388`.
- [x] **Playwright, chromium.** `ui/` is unchanged since `7e4cae43` (`git diff 7e4cae43 HEAD -- ui` is empty), so I
  served round 2's build of it on :4184. `assistant-self-map` (B0–B13), `assistant-management-page`,
  `assistant-attention`, `assistant-alert`, `assistant-coming-soon` and `assistant-duty-menu`: **76 passed, 0 failed**
  (4.9 m). I stopped the server afterwards.
- [x] `bash scripts/harness-lint.sh`: **clean**.
- [x] **Shared lines.** `git fetch origin staging` leaves `origin/staging` at `7ab2c955`, as at round 2.
  `git merge-tree --write-tree HEAD origin/staging` is clean. Nothing in `protocols/`, `src/` or `ui/` changed since
  round 2's recheck. ADR `duty-menus-and-self-maps/0004` stays Accepted, and the library now follows its §§ 4.5–4.6.

## Round 2's findings, each re-derived as a fresh claim

| Finding | Re-derived by | Result |
|---|---|---|
| **R2-B1**, the four non-keys | Round 2's own reproduction, run again: staging's Owner shape, Scores live, the right self-Map (`30382`, `39998` at R), plus each of `39999:duty-menu`, `39999:dlist-header`, `39998:` and `39999:` | Every case: `shouldSay` is `39998` and `30382`, `current` is true, and there are no false claims. Each spelling alone gives no duty. With another key named under `39998:` or `39999:dlist-header` beside `["39998", TA]`, there is no `elsewhere` line. `otherEntries` for three non-keys naming other keys is 0. **Fixed** (`index.js`: `NAMELESS_KEYS`, checked in `parseKey`). |
| **R2-B1**, what must still parse | `parseKey('39998::')`, `parseKey('39998:dlist-header')`; a Map naming the TA under `39998::` | `d` = `:` at rank 3; the bare `39998`; a `not-landed` line for the `:` header. **Unchanged, as § 4.5 wants.** |
| **R2-N1**, empty relays | Found `["3038x", TA, ""]`; found `["30382", TA, ""]` with `["39998", TA, R]`; the right self-Map plus `["30382:rank", TA, ""]`; found `["30382", TA, "not a url"]` | No false claim, on the offered and the not-offered lines alike. The `30382` line is `live-unclaimed`, and the self-Map is out of date. With the extra empty-relay entry for a part that isn't the TA's duty, `30382` stays active and `current` is false. The unparseable relay is still a false claim. **Fixed**, as Amendment 3 item 2 says. |
| **R2-N2** | `ledger/2026-10-12-self-map-profiles-category-lines.md` | The row exists, **OPEN**. |

**ADR adherence, Amendment 3:**
- Item 1: `parseKey` returns null for the four after `normalizeMenuKey`, and every reader drops a null key. The
  unreachable branch that kept `39998:` as `unchecked` is gone.
- Item 2: `selfEntryRelay` keeps the three cases apart, and both `falseClaim` rules skip a winning empty-relay claim.
- Item 3: only `src/lib/self-map/index.js` changed. The docs did not need to.

## Findings

### Blocking

None.

### Non-blocking

1. **R3-N1 — `src/lib/self-map/index.js` (the comment above the not-offered `falseClaim`): it says "any found
   self-entry winning one is a false claim".** Since Amendment 3, that excludes one with an empty relay, as the next
   line of code does. Optional: reword the comment in the next push that touches this file.
2. **R3-N2 — `src/api/assistant/selfMap.js` (`mapHints`): relay hints are still read from every viewer Map entry
   naming the Assistant, a `39998:` entry included.** It only adds a relay, guarded and within the cap, to the
   self-Map lookup, and it changes no reading. § 4.5's "as if absent" would leave it out. Optional: filter `mapHints`
   through `parseKey` in story 2, which reads the same hints.

### Harness friction

None new. RW7's repeated 0.77 s failures in round 3's Test Design gates are on their own row,
`2026-10-08-realtime-wrapper-timing-flake-under-load`. This round's gates passed.

## Verdict
**PASS**

Every blocking finding from rounds 1 and 2 is fixed and re-verified from commands:
- round 1's B1 (a claimed not-offered part) and B2 (the queue flag);
- round 2's R2-B1 (Concept non-keys, under the now-accepted §§ 4.5–4.6).

The non-blocking items folded into Amendments 2 and 3 are fixed too. Those deferred are ledger rows: N6, N7 and
R2-N2. Every acceptance criterion has a passing test, and the code matches ADR 0001 as amended three times. The gate
passes (5825 / 0), and the browser specs pass on Chromium (76 / 0).

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed. The result is in the chat. The book is not complete: stories 2–5 and their frame
  bullets remain.
