# Review: Story 1 — The Assistant Duties tab

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-12
**Diff:** `git diff 85434cb68..9a7735a04` (HEAD `9a7735a04`, equal to `origin/staging`), commit by commit:
- `d6dcda0b8`: ADR accepted. Docs only.
- `e05f033d7`: Phase 3, the failing tests and the test plan. Touches only `test/`, `tests/` and the story/test plan.
- `273d44410`: Phase 4, the implementation. Touches `src/`, `ui/`, `BIBLE.md`, the spec, two earlier ADRs, the ledger and the story's Deviations. It touches **no** test file.
- `9a7735a04`: two test edits (U24, A2), disclosed in the story's Deviations. Judged below.

**Story:** `engineering-team/stories/assistant-duties-settings/1-the-assistant-duties-tab.md`
**ADR:** `engineering-team/decisions/assistant-duties-settings/0001-the-offered-duties-live-in-the-instance-settings.md` (Accepted)
**Test plan:** `engineering-team/stories/assistant-duties-settings/1-the-assistant-duties-tab.test-plan.md`
**Book:** `engineering-team/audits/assistant-duties-settings/book.md`

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`** on `9a7735a04`, clean tree, label `reviewer-ads1`. `npm run gate:status -- --label reviewer-ads1`:

  > `20261012T223406Z-8942-87a0 [reviewer-ads1] started 2026-10-12T22:34:06.293Z on 9a7735a0 — PASS, exit 0, 5863 passed, 0 failed, 582 skipped, 307/307 suites`

  - The total is the Phase-3 run's 5807 passed + 56 failed, so every test that failed at Phase 3 now passes and none were dropped.
  - From the run record, the suites this story owns or re-aims: `assistant-duties-settings` 34/0/0, `assistant-duty-menu-check` 65/0/0, `assistant-duty-menu-publish` 36/0/0, `assistant-self-map-check` 64/0/0, `assistant-duty-menu-page` 15/0/0, `admin-action-sweep` 9/0/0. These match the test plan's Phase-3 pass + fail counts suite by suite.
- [x] **Playwright, chromium.** I built `ui/` at `9a7735a04` (`vite build` into `tmp/rv-dist`), served it with `vite preview` on :4177, and ran `tests/brainstorm/assistant-duties-settings.spec.js` and `tests/brainstorm/assistant-duty-menu.spec.js`: **29 passed** (B0–B11 and B0–B16). Afterwards I stopped the server and removed `tmp/rv-dist`, `test-results` and `playwright-report`. The tree is clean.
- [x] `bash scripts/harness-lint.sh`: clean (0 violations), before and after this review.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._ The UI's `vite build` succeeds.

## The two test edits in `9a7735a04`: genuine defect fixes, not a weaker judge

- **U24 (`test/assistant-duty-menu-check.test.js:894`).** The "a row more" variant appended a second `30382` to the offer.
  - Now that the six include `30382`, readers merge that row away as a duplicate (§ 5.3, `readMenuRows`). So the variant described a current menu and could only fail against correct code.
  - `30383` keeps the variant's intent, a key the offer lacks. The other five variants and the control are untouched.
- **A2 (`test/assistant-duties-settings.test.js:477`).** I re-ran the file's `codeOnly` against every sentinel target.
  - It blanks **188 code lines** of `src/api/index.js`. The `/*` inside `'/api/settings/*'` (`:345`) opens a pseudo-comment, which swallows the new registrations at `:349–351`.
  - It blanks **0** lines of the other targets: `src/lib/duty-menu/index.js`, `dutyMenu.js`, `Index.jsx`, `App.jsx` and `AssistantDuties.jsx`. So S1, O4 and T4–T6 are not passing vacuously.
  - The raw read keeps the same regex, which still requires `requireOwner` as the first middleware. The one loss is that a commented-out registration would also match (non-blocking note 5).
- **Process.** Both edits were made in the Phase-4 session. The ADR template says test edits belong to Phase 3. They sit in their own commit, are disclosed in Deviations, and I verified both independently. Non-blocking note 4.

## Spec adherence

| AC | Covered by | Verdict |
|---|---|---|
| AC-1: tab, URL, who may use it | A1, A2, T4, T5, R6; B1, B2; admin-action-sweep | Met. Routes `src/api/index.js:349–351` behind `requireOwner`. Table `src/middleware/routeAccess.js:394–396`. The generic PUT is no backdoor (`settingsApi.js:136–142` validates before `updateOverrides`). |
| AC-2: list, six defaults, Owner's offer unchanged | D1, R1, U5, L9–L11; B1, B11 | Met. `src/config/defaults.json` has the six in order. |
| AC-3: add, normalized key, four refusals | L2–L6, R2, R3; B3, B4 | Met. I probed `validateDutyList`/`isPublicRelayUrl` with decimal/hex IPv4 (`2130706433`, `0x7f.1`), `[::1]`, `[::ffff:127.0.0.1]`, `[fd00::1]`, 100.64/10, 169.254.169.254, `.local`/`.internal`/`.localhost`, bare labels, userinfo, `''`, non-string relays, `__proto__`, and 512/513-char keys. All are refused or accepted as the ADR says. |
| AC-4: remove, relay, reorder (drag + keyboard), reset, saving | T2, T3, T6, R4; B5–B10 | Met. Non-blocking notes 1 and 2 cover two UI rough edges. |
| AC-5: kept on the server, no restart | D2, O2, O4, S1, L1, U11 | Met. `OFFER_KEYS` is gone, `readAssistantDuties` re-reads `getSettings()` at each check, and arrays replace whole. |
| AC-6: every Duty Menu follows the list | L8, L9, O1, O3, U6–U8, U23, U24, W14, E1, E2, W13, AD1–AD3, T7, P1; B5, B10 | **Not met for one class of key.** "Your Assistant's Treasure Map page keeps working with any list. A listed duty this instance does not publish is shown there as offered but not live." That fails for any listed key other than a bare five-digit kind. See Blocking 1. Every other AC-6 bullet is met. |

- [x] Every acceptance criterion has a passing test.
- [ ] No criterion is silently dropped. AC-6's "with any list" holds only for bare five-digit keys; no test lists any other kind of key (Blocking 1).
- [x] No behavior added that isn't in the story.
- Copy: I checked the tab's words (`ui/src/pages/settings/assistantDutiesCopy.js:15–42`) and the two Duty Menu sentences (`ui/src/pages/assistant/dutyMenuCopy.js:22–23`) against story § Copy and the ADR's additions. They match word for word. "Loading…" and the load-failed line are disclosed in Deviations.

## ADR adherence

- [x] **Files.** The changed files match the Implementation notes, sub-decision by sub-decision.
  - Sub-decision 1: `defaults.json`, after `trustedLists`.
  - Sub-decision 2: `keptKey`, `dutyKeyOf`, `isPublicRelayUrl`, `validateDutyList`, `readDutyList`, `MAX_DUTIES`, `MAX_KEY_LENGTH`; `readMenuRows` on `keptKey`; `OFFER_KEYS` deleted.
  - Sub-decision 3: `instanceRelayFor`, `buildOffer({ ownRelay, dlistRelay, duties })`, `resolveOfferInputs` with `readAssistantDuties`, the ADR's warn line, `getCustomer` removed.
  - Sub-decision 4: the routes module with injectable deps, `POST …/reset`, the generic-PUT branch.
  - Sub-decision 5: `sameRows` compares in order.
  - Sub-decision 6: the `30382` guard in `readUpkeep`, `src/api/assistant/selfMap.js:165–168`.
  - Sub-decision 7: the copy module, the component, the `TABS` entry right after `assistant`, and the route child before `*`.
  - Sub-decision 8: the two sentences and the header pointer.
  - Sub-decision 9: BIBLE §11 (the attention row and three new rows), §15 (the top-level keys and the hand-edit line), the two ADR notes, `duty-menus.md:5`, and the ledger row `2026-10-12-settings-json-written-in-place`.
- [x] **One deviation in form, not substance.** The Implementation notes say `isPlainlyPrivateRelay` becomes `!isPublicRelayUrl(url)`. Instead, the helper is deleted and `isPublicRelayUrl(url)` is called inline (`dutyMenu.js:99`). The behavior is the same.
- [x] Layering is respected. The rule is pure CommonJS in `src/lib/duty-menu`. The routes take settings functions as deps. The UI copy module is import-free ESM.
- [x] No new dependencies.
- [ ] **The ADR's analysis has a gap.** Sub-decision 6 says the self-Map library is unchanged ("Lists and other kinds need nothing"). It never considers an offer row whose key is not a bare kind. The code follows the ADR faithfully; the defect is in the design (Blocking 1).

## Concept-graph integrity

- [x] Nous' Duty Menu header `39998:<NOUS>:duty-menu` is unchanged (`src/lib/duty-menu/index.js:29`). No concept handle was added or changed.
- [x] No concept definition changed, so no firmware reinstall is needed.
- [x] New code reads no concept data. The live Concept Graph was not reachable in this session (stack absent), as at planning and design.

## Things tests can't catch

- [x] No secrets, and no 64-hex literal added in `src/` or `ui/`. No TA pubkey is hardcoded.
- [x] No leftover debug output. The two new `console.*` calls are the ADR's warn (`dutyMenu.js:103`) and the routes' 500-path error (`assistantDutiesApi.js:37`).
- [x] No commented-out code.
- [ ] Error paths and edge cases: Blocking 1, and non-blocking notes 1–2.
- [x] **Concurrency.** Last write wins, as the ADR accepts. The tab shows the server's answer after each save. The non-atomic `settings.json` write is filed (ledger row).
- [x] **Security.**
  - The three routes are `requireOwner` (Owner or Admin) and `OWNER_READ`/`OWNER_ACTION` in the table.
  - The PUT refuses before writing.
  - The generic `PUT /api/settings` runs the same rule.
  - `DELETE /api/settings/assistantDuties.<n>` can only punch a `null` into the array, which the lenient reader drops.
  - React escapes every key and relay it renders.
  - Typed relays are dialed without the DNS guard (non-blocking note 6).
- [x] **Architecture invariants.**
  - The list is this instance's own configuration. It gates no one's published events (principle 2) and claims no POV-independent truth about anyone (principle 1).
  - The offer is re-derived from settings on every check (principle 3).
  - No neo4j or graph state is touched (principle 4).

## House rules check

- [x] Concept Graph API authority respected (nothing concept-shaped).
- [x] No new lint/typecheck/build tooling.

## Product-guide adherence *(when the story traces to a PRD)*

N/A, because the book has no PRD (acceptance frame). The copy was checked against story § Copy above.

## Findings

### Blocking

1. **`src/lib/self-map/index.js:451–454`, `src/api/assistant/selfMap.js:161` (with `src/lib/duty-menu/index.js:32`, `:98–103`, `:194–215`).** Your Assistant's Treasure Map breaks for any listed key that is not a bare five-digit kind. This violates AC-6: "keeps working with any list", and a listed duty the instance doesn't publish is "shown there as offered but not live".
   - **The mismatch.** The tab accepts every key readers keep (`KIND_SLOT = /^(\d{5}|3038x|3039x|\*)$/` plus any segments), for example `30382:rank`, `30383:foo`, `3038x` and `*`. Book Decision 1 asks for exactly this. The Duty Menu then offers those rows. But the self-Map builds its offer map only from rows matching `/^\d{5}$/` (`index.js:453`), and `readUpkeep` finds the Scores and Concepts relays by exact key (`selfMap.js:161`). Any other row is invisible to the self-Map.
   - **Verified with `evaluateSelfMap`.** Map entries `30383:foo` and `30382:rank` naming the Assistant:
     - The list holds `30383` and `30382`: `offered / not-published-here` and `offered / live-unclaimed`. This is correct.
     - The list holds `30383:foo` and `30382:rank`, or `*`: both lines are **`not-offered`**, while the Duty Menu page says both are offered. ADR § Sub-options rejected an option precisely because "the Duty Menu would then say 'offered' while the self-Map said 'not offered'".
     - **Worse case.** The Owner narrows `30382` to `30382:rank` (the form `/treasure-map` itself shows) while Scores are live and the Assistant's published self-Map truthfully claims `30382:rank`. The self-Map then stops reading Scores, answers `shouldSay: []`, sets `current: false`, and flags the truthful entry **`falseClaim: true`**. So the hub marks it Needs attention and steers the person to retract a true claim.
   - **The test gap.** AD1–AD3 list only bare kinds (`30382`, `30383`). No test lists a compound, range or wildcard key.
   - **Asked change.** This is a design gap, so it goes back through the phases rather than to the Implementer alone:
     - **Architecture.** Amend sub-decision 6 (and its "library unchanged" line) to say how the self-Map reads an offer row keyed `<kind>:<scope…>`, `3038x`/`3039x` or `*`. The rule must be such that:
       - (a) every key the list accepts is shown "offered", and is live only where this instance has actually published what that key covers;
       - (b) a duty this instance publishes, and the Assistant truthfully claims, is never flagged a false claim or dropped from `shouldSay` merely because the list names it by a narrower or broader key;
       - (c) a narrower offer such as `30382:rank` never makes a different scope, such as another metric, count as offered.
     - **If the owner prefers** to narrow what the tab accepts instead, that relaxes book Decision 1. It is a story/book change the owner ratifies, not an Implementer call.
     - **Then Test Design.** Add AD tests for `30382:rank` replacing `30382` (live, claimed, current, no false claim), for an unbuilt compound key (`30383:foo`: offered, `not-published-here`, never active), and for `3038x`/`*` per the amendment.
     - **Then Implementation.**

### Non-blocking

1. **`ui/src/pages/settings/AssistantDuties.jsx:63`, `:125`, `:182–192`.** The open Change relay panel is tied to a row *index*, and Move up, Move down and Remove stay enabled while it is open. After such a save, the panel reappears under whichever duty now has that index, still prefilled with the first duty's relay. Save then writes that relay to the other duty. Optional improvement: clear `editing` on every successful `save()`, or key it by `duty.key`.
2. **`ui/src/pages/settings/assistantDutiesCopy.js:83` with `AssistantDuties.jsx:124`.** Change relay with **Another relay** chosen and the field empty saves as This instance's relay and says "Saved". Add, given the same input, is refused (`bad-relay`). AC-4 changes relays "under AC-3's relay rules". Optional improvement: send the empty string through, so the server refuses it as Add does.
3. **`src/api/settings/assistantDutiesApi.js:32–34`.** The GET and reset answers drop hand-edited bad entries silently. ADR sub-decision 2 says "callers log the drops once per call", and only the offer path (`dutyMenu.js:103`) does. Optional improvement: log the drops there too.
4. **`9a7735a04` (process).** The two test fixes are correct (see above) but were made in the Phase-4 session. The ADR template puts test edits in Phase 3. For the round Blocking 1 opens, route test edits through the Tester.
5. **`test/assistant-duties-settings.test.js:90–96`, `:477`.** A2 now reads raw source, so a commented-out registration would satisfy it. `codeOnly` still mistakes `/*` inside a string for a comment, and that will bite again. Optional improvement: a string-aware stripper.
6. **Typed relays and the DNS guard.** Typed relays are connected to without the DNS guard: publish sends to owner-set row relays, and the self-Map reads a typed `39998` relay through `readWithinBudget`. Admins as well as the Owner can set them. This follows ADR § Sub-options, and it is stricter than `aRelays`, which an Admin can already set with only a `ws(s)://` check. Recorded, not blocking.
7. **`AssistantDuties.jsx:177`.** The drag handle is a `<span>` with `aria-label` and no role, so assistive tech may not announce it. The keyboard path is the Move up / Move down buttons, which satisfy AC-4.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

1. None.

## Verdict

**CHANGES_REQUESTED**

The diff is clean and closely conforms to the ADR:
- the gate is PASS (`20261012T223406Z-8942-87a0`) and 29/29 browser specs pass;
- the owner routes are sound and the generic PUT is no backdoor;
- the docs are accurate;
- the two Phase-4 test edits are genuine defect fixes.

But one acceptance criterion fails, and I verified it. The story explicitly makes keeping Your Assistant's Treasure Map working "with any list" part of AC-6. The tab accepts keys the self-Map cannot see. With such a key on the list, that page says "not offered" for duties the Duty Menu offers. In the `30382:rank` case it brands a truthful Scores claim false and asks for a republish. The gap is in ADR sub-decision 6, so the fix goes back to the Architect (or to the owner, if they would rather narrow book Decision 1), then to the Tester and the Implementer (Blocking 1).

## On PASS (same commit)

- [ ] Story `**Status:**` flipped to `Done` in place. *Not applicable: CHANGES_REQUESTED. The story stays `Approved`. Only its `- Review:` link is filled in.*
- [ ] Completion detection: not performed. The book cannot be complete while story 1 is not Done.
