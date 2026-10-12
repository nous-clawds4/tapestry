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

---

## Round 2 (2026-10-12)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-12
**Diff:** `git diff 72dba9e9a..36e200fcd` (HEAD `36e200fcd`, equal to `origin/staging`). This story's commits:
- `80625ae4c`, `a6d6e3f88`: ADR 0001 Amendment 1, proposed then accepted. Also the story's Background, AC-3 and AC-4,
  and the book's Decision 8 and first frame bullet. Docs only.
- `b11302628`: round 2's failing tests and the test plan's `## Round 2`. Touches only `test/`, `tests/` and the plan.
- `903c10e98`: the R3 re-aim, one test case. Judged below.
- `5ee2ae92f`: the implementation. Touches `src/lib/duty-menu/index.js`, `src/api/settings/assistantDutiesApi.js`,
  `AssistantDuties.jsx`, `assistantDutiesCopy.js`, BIBLE §11 and §15, and the story's Deviations. It touches no test
  file.
- `36e200fcd`: the Deviations now cite `903c10e98` (they cited its pre-rebase hash). Docs only.

The range also holds another session's four docs commits for `duty-menus-and-self-maps` #5: `ec8013697`, `984c7cc80`,
`8287d951b` and `930c54543`. They touch `protocols/`, `ledger/`, `docs/`, and that epic's own story and ADR.
- They touch nothing under `src/`, `ui/`, `test/` or `tests/`, nor `BIBLE.md`, nor this epic's folders.
- Their one edit near this story's records is in `protocols/drafts/duty-menus.md`: its Sources line (`:6`) and § 5.2's
  wording. Line 5, the implementation line this story wrote in round 1, is unchanged.

### Quality gates (run by reviewer, not trusted)

- [x] **`npm test`** on `36e200fcd`, clean tree (the record's `git.dirty` is `false`), label `reviewer-ads1-r2`.
  `npm run gate:status -- --label reviewer-ads1-r2`:

  > `20261012T233931Z-5898-8ddb [reviewer-ads1-r2] started 2026-10-12T23:39:31.533Z on 36e200fc — PASS, exit 0, 5866 passed, 0 failed, 582 skipped, 307/307 suites`

  - 5866 is round 1's 5863 plus the three new tests: L10, R7 and AD4.
  - From the run record:
    - `assistant-duties-settings` 36/0/0 and `assistant-self-map-check` 65/0/0. These are the test plan's round-2
      pass + fail counts (25 + 11 and 64 + 1).
    - `assistant-duty-menu-check` 65/0/0, `assistant-duty-menu-publish` 36/0/0, `assistant-duty-menu-page` 15/0/0 and
      `admin-action-sweep` 9/0/0, unchanged from round 1.
- [x] **Playwright, chromium.** I built `ui/` at `36e200fcd` into `tmp/rv-dist` and served it with `vite preview` on
  :4177. I ran `tests/brainstorm/assistant-duties-settings.spec.js` and `tests/brainstorm/assistant-duty-menu.spec.js`:
  **31 passed, 0 failed** (B0–B13 and B0–B16). Afterwards I stopped the server and removed `tmp/rv-dist`,
  `test-results` and `playwright-report`. The tree is clean.
- [x] `bash scripts/harness-lint.sh`: clean (0 violations), before and after this review.
- [x] **On staging.**
  - `deploy-staging.yml` ran green for `5ee2ae92f` and `36e200fcd` (23:28Z).
  - `https://staging.brainstorm.world/tapestry/settings/assistant-duties` answers 200.
  - An unauthenticated `GET /api/settings/assistant-duties` answers 401 with the owner/admin refusal.
  - I could not sign in as the Owner, so I have not seen the tab live.
- [ ] _Lint, typecheck and build not configured, so skipped._ The UI's `vite build` succeeds.

### Blocking 1, re-derived from commands

The owner chose to narrow the list (book Decision 8), the second of the two routes round 1 left open. Amendment 1
makes a duty a whole kind and leaves the self-Map unchanged. I re-derived the fix from commands, not from the tests.

- **The rule.** `dutyKeyOf` (`src/lib/duty-menu/index.js:154–158`) trims its input and accepts only `/^\d{5}$/`
  (`:44`). `checkEntry`, `validateDutyList` and `readDutyList` call it and are byte-identical to `72dba9e9a`.
- **The tab's PUT** (`createAssistantDutiesHandlers().put`):
  - **Refused**, each with 400 `bad-key` and nothing written:
    - narrower, family and Concept keys: `30382:rank`, `3038x`, `3039x`, `*`, `39999:my-list`, `39998:dlist-header`;
    - trailing colons: `30382:` and `30382::`;
    - lookalikes: fullwidth `３０３８３`, and `30383` followed by U+200B;
    - wrong lengths and number forms: `303830`, `3038`, `+3038`, `3.0e4`, `0x7d2`;
    - `"30383\n:rank"`;
    - non-strings: a number, an array, an object with `toString`, and `null`;
    - and `''`.
  - **Accepted:** `' 30383 '`, `'\t30383\n'` and `30383` followed by a no-break space are each stored as `30383`.
- **The generic PUT** (`settingsApi.handleUpdateSettings`). I ran it with the real settings module on a scratch
  `TAPESTRY_SETTINGS_PATH`.
  - `30382:rank` and `*` answer 400 `bad-key`. `null` and an index-keyed object answer 400 `bad-list`. The file stays
    `{}` after each.
  - A `{"__proto__": {"assistantDuties": […]}}` body answers 200 and persists nothing.
  - `DELETE /api/settings/<keyPath>` only removes, so it cannot make a key.
- **A hand-edited `settings.json`** with eleven entries: `30382:rank`, `3038x`, `*`, `39999:my-list`, `' 30392 '`,
  `39998:dlist-header`, fullwidth, zero-width, `30382`, the number `30393` and `30382::`.
  - The GET answers `[30392, 30382]` and logs `[settings/assistant-duties] ignored 9 assistantDuties entries`.
  - The offer gives `[30392, 30382]` and logs `[assistant/duty-menu] ignored 9 …`. I built it through the real
    `resolveOfferInputs` with the real `readAssistantDuties`, then `buildOffer`.
  - Reset empties the override and answers the six.
- **Every reader goes through `readDutyList`.** `assistantDuties` has only two readers:
  - the offer, `src/api/assistant/dutyMenu.js:77` and `:102`, which the Duty Menu check, the publish route
    (`dutyMenuPublish.js:108`) and the self-Map (`selfMap.js:265–266`) all build from;
  - the routes' `currentDuties` (`assistantDutiesApi.js:32–36`).

  So no path puts a non-bare key on an offer.
- **Round 1's `evaluateSelfMap` scenario, now through the real handler.** I drove `handleAssistantAttention` with the
  self-Map suite's own world (its `fakes`, `realDutyMenu: true`), so the offer came from `resolveOfferInputs` →
  `buildOffer`.

  | Case | Duty Menu offer | Your Assistant's Treasure Map | `falseClaim` |
  |---|---|---|---|
  | P0: the six; Scores live; the self-Map claims `30382:rank` | the six | `30382:rank` active; current | false |
  | P2: hand-edited `*`, `3038x`, `39999:my-list`, `3039x:tag`, `30382`; Map entries `30382:rank`, `30383:foo` | `[30382]` | `30382:rank` offered / live-unclaimed; `30383:foo` not-offered | false |
  | P3: `30382` and `30383` listed; Map entry `30383:foo` | `[30382, 30383]` | `30383:foo` offered / not-published-here | false |
  | P1: hand-edited `30382:rank` in place of `30382`; Scores live; the self-Map claims `30382:rank` | the five, no Scores | `30382:rank` not-offered; not current | true |
  | P1b: `30382` removed through the tab; otherwise as P1 | the five, no Scores | `30382:rank` not-offered; not current | true |

  - **The two pages agree in every case.**
  - **P1 is round 1's worse case.** The tab and both PUTs now refuse `30382:rank`, so P1 can only come from a hand edit
    outside BIBLE §15's documented shape.
  - **P1 now behaves exactly as removing Scores does (P1b).** Neither page offers Scores. The published claim is then
    a claim on a part that isn't offered, which `assistant-self-map` ADR 0001 A2 item 4 (owner-ratified) defines as a
    false claim. The drop is logged at every check.
  - **The disagreement round 1 found is gone.** What remains is the self-Map's documented behaviour for a removed
    kind. Blocking 1 is resolved. Non-blocking 1 below concerns AD4's wording.
- **Readers of other instances' menus are unchanged.**
  - `keptKey`, `readMenuRows`, `normalizeMenuKey`, `sameRows`, `isDutyMenu` and `KIND_SLOT` are byte-identical to
    `72dba9e9a`. So is every other library function except `dutyKeyOf`.
  - Another instance's menu still reads as its rows: `30382:rank`, `3038x`, `*`, `39999:my-list`, `not-offered 30385`,
    and `39998:dlist-header` as `39998`.
  - The range has no diff in `src/lib/self-map/` or `src/api/assistant/`.
- **Whole kinds are kept as themselves.** I checked all 100,000 five-digit strings `k`:
  - `dutyKeyOf(k) === keptKey(k) === k`;
  - `readMenuRows` of a row keyed `k` keeps it as `k`.

  There were 0 mismatches. So every key the list accepts reaches readers unchanged, and the self-Map's `/^\d{5}$/`
  (`src/lib/self-map/index.js:453`) sees every offer row.

### Round 1's findings, each re-derived

| Finding | Now | Evidence |
|---|---|---|
| Blocking 1: non-bare keys; the two pages disagree | Resolved by Amendment 1 (book Decision 8) | Above. |
| NB1: the relay panel is tied to a row index | Fixed | `AssistantDuties.jsx:64`: `editing` holds the duty's `key`. `:127–128`: `saveRelay` finds the duty by key, and closes if it is gone. `:93`: a save whose answer lacks the duty closes the panel. Also `:171`, `:193`, `:204`. Reset still clears `editing` (`:105`). Keys are unique on the list (`validateDutyList` refuses duplicates; `readDutyList` keeps the first), so a key names one row. B12 passes. With `39999`'s panel open, `30393` is removed and `30382` moved; Save writes the typed relay to `39999` only. Removing its own duty closes the panel. With the index-keyed code, the first removal (index 5 → 4) would have taken the panel off `39999`. |
| NB2: an empty Another relay saved as This instance's relay | Fixed | `setRelay` (`assistantDutiesCopy.js:80–86`) drops the relay only for `null` or `undefined`. `saveRelay` sends `editing.relay` as it is (`AssistantDuties.jsx:130`). The server refuses `''` with `bad-relay` (L6 "an empty relay", and my PUT probe). T3 pins the helper. B13 pins the request sent and the words "A relay must start with wss:// or ws://." |
| NB3: the routes drop entries silently | Fixed | `assistantDutiesApi.js:32–36` logs `[settings/assistant-duties] ignored N assistantDuties entries` for GET and reset, as Amendment 1 item 5 words it. R7, and my hand-edited probe: 9 dropped, one line. A clean list logs nothing. |
| NB4: test edits made in the Phase-4 session | Happened once more | `903c10e98`; see below and non-blocking 2. |
| NB5: `codeOnly`, and A2's raw read | Open, unchanged | Outside Amendment 1's scope. |
| NB6: typed relays are dialed without the DNS guard | Open, unchanged | Recorded per ADR § Sub-options, as in round 1. |
| NB7: the drag handle is a `<span>` with no role | Open, unchanged | The keyboard path (Move up / Move down) still meets AC-4. |

### The R3 re-aim (`903c10e98`): a genuine fix, not a weaker judge

- **Why the old case was wrong.** Round 2's test design kept R3's duplicate case as
  `[{ key: '30382' }, { key: '30382::' }]` → `duplicate-key` at index 1.
  - Under amended AC-3, `30382::` is "anything that is not five digits". Correct code answers `bad-key` at index 1
    (`validateDutyList` on it: `{"ok":false,"code":"bad-key","index":1}`).
  - So the case could pass only against code that broke AC-3.
  - At `a6d6e3f88` it did pass. The test still failed on its other, new cases, which hid this one in the Tester's red
    run.
- **The replacement keeps the case's intent.** `' 30382 '` is a duplicate after the one normalization left: trimming,
  as in AC-3's "Spaces around the kind are ignored". The assertion is as strong as before: `duplicate-key` at index 1,
  which is what the code now answers. L2 still pins the trailing-colon forms as refused (`30382:rank::`, `3038x:tag:`,
  `*:`).
- **Process.** The edit is logged in Deviations under "Implementation round 2" and was committed 2½ minutes before the
  implementation. So a test was again edited in the Phase-4 session, as round 1's NB4 noted. It has its own commit and
  is disclosed, and I verified it myself. Non-blocking 2.

### Spec adherence (round 2)

| AC | Covered by | Result |
|---|---|---|
| AC-1 | A1, A2, T4–T6, R6; B1, B2; admin-action-sweep | Met; unchanged since round 1. |
| AC-2 | D1, R1, L9; B1, and B11 (re-aimed to `30383`) | Met. |
| AC-3 as amended | L2, L3, L5, L6, L10, R2, R3, R6; B3 (re-aimed to `30395`), B4 | Met. Whole kinds only, trimmed; every refusal holds by the probes above. |
| AC-4 as amended | T2, T3, T6, R4; B5–B10, B12, B13 | Met. An empty Another relay is refused, and the relay saved is always that duty's own. |
| AC-5 | D2, O2, O4, S1, L1, L7, R1, R7 | Met. |
| AC-6 | L9, O1–O3, U6–U8, U23, U24, W13, W14 (re-aimed), E1, E2, AD1–AD4, T7, P1; B5, B10 | Met. Your Assistant's Treasure Map works with every list the tab or either PUT accepts, and a hand-edited list is cleaned before either page reads it (O2, AD4, P0–P3). A listed kind this instance does not publish is offered and never live (AD2, P3). |

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped. Round 1's AC-6 gap is closed by narrowing AC-3, which the owner ratified in
  book Decision 8.
- [x] No behavior added that isn't in the story.
- Copy is unchanged. The refusal for a narrower key stays "That isn't a Treasure Map key.", as Amendment 1 item 2
  keeps it (non-blocking 4).

### ADR adherence (Amendment 1)

- [x] **Item 1.** `dutyKeyOf` trims the input and answers a five-digit kind through `keptKey` (`index.js:154–158`).
  `keptKey` and `readMenuRows` are unchanged. `MAX_KEY_LENGTH` is gone from both the constants and the exports.
- [x] **Item 2.** `validateDutyList` refuses with `bad-key`. `readDutyList` drops the entry, and its callers log the
  drops. `instanceRelayFor` is unchanged.
- [x] **Item 3.** `editing` holds the key, `saveRelay` finds the duty by key, and the panel closes when its duty goes.
- [x] **Item 4.** `setRelay` keeps `''`, the tab sends it, and the server refuses it.
- [x] **Item 5.** The routes' warn line matches word for word.
- [x] **Item 6.** Both BIBLE edits match the probes.
  - BIBLE §15 (`BIBLE.md:1384`) gives the shape `{ "key": "<kind>" }`, a whole kind of five digits, and says a refused
    entry is skipped and logged.
  - BIBLE §11's PUT row (`BIBLE.md:568`) says `bad-key` is anything but a five-digit kind. The GET and reset rows are
    unchanged and still true.
- [x] **The self-Map library stays unchanged.** The range has no diff in `src/lib/self-map/` or `src/api/assistant/`.
- [x] No new dependency. Layering is as in round 1.

### Concept-graph integrity, things tests can't catch, house rules

- [x] No concept handle or definition changed, so no firmware reinstall is needed.
- [x] No secrets, no 64-hex literal added, and no TA pubkey.
- [x] The one new `console.warn` is Amendment 1 item 5's line. There is no debug output and no commented-out code.
- [x] Concurrency is as in round 1: last write wins, as the ADR accepts.
- [x] Security: the narrowed rule is stricter than round 1's, and I probed every write and read path above.
- [x] Architecture invariants are as in round 1. The list is this instance's own configuration and gates no one's
  events.
- [x] No new lint, typecheck or build tooling.

### Findings (round 2)

#### Blocking

None.

#### Non-blocking

1. **`test/assistant-self-map-check.test.js:1220`.** AD4's title overstates what the test judges.
   - The title says "no true claim is flagged false". But AD4's world publishes no self-Map, so `falseClaim` is false
     whatever the code does.
   - With a published self-Map claiming `30382:rank` (P1 above), the line is `not-offered` with `falseClaim: true`.
     That matches removing `30382` (P1b) and is correct under `assistant-self-map` ADR 0001 A2 item 4.
   - Optional: reword the title, or add the published-claim variant, pinning that a dropped key reads as a removed
     kind.
2. **`903c10e98` (process).** The R3 re-aim is a genuine fix (see above). But it was made in the Phase-4 session
   again (round 1's NB4).
   - It is disclosed and in its own commit.
   - Optional: the Tester's red run could check each case, not only each test. The duplicate case passed at
     `a6d6e3f88` inside a test that failed on its other cases.
3. **`test/helpers/assistantDutiesFixtures.js:41`, `:93`.** `MAX_KEY_LENGTH = 512` is still defined and exported, and
   nothing uses it. Optional: drop it in the Tester's next pass.
4. **`ui/src/pages/settings/assistantDutiesCopy.js:21`, `:36`.** The copy says "Treasure Map key", but only whole
   kinds are accepted.
   - The field's label is "Treasure Map key".
   - `30382:rank` is refused with "That isn't a Treasure Map key.", though it is one.
   - The owner kept these words when accepting Amendment 1 (item 2), so this is recorded for the owner, not asked.
5. **Staging data (a deploy note).** Round 1's code, which accepted any key readers keep, has been on `staging` since
   `273d44410`.
   - A narrower or family key that an Owner or Admin saved there meanwhile is now dropped on every read, with no
     migration (Amendment 1 item 2).
   - Each drop is logged under `[settings/assistant-duties]` and `[assistant/duty-menu]`.
   - Optional: look at staging's `assistantDuties` once, or grep its logs for those two prefixes.

#### Harness friction

1. None.

### On PASS (same commit)

- [x] Story `**Status:**` flipped from `Approved` to `Done` in place
  (`engineering-team/stories/assistant-duties-settings/1-the-assistant-duties-tab.md:3`).
- [x] **Completion detection: left to the orchestrator, as instructed.** The acceptance frame looks satisfied. Its
  first four bullets map to AC-1 and AC-3–AC-4, AC-2, AC-5 and AC-6, all met. "On staging" holds as recorded under
  Quality gates, though I have not seen the tab signed in.

### Verdict (round 2)

Blocking 1 is resolved and verified from commands, not only from the tests:
- the list holds whole kinds only;
- every write path refuses anything else;
- every read path drops anything else, logged;
- round 1's self-Map scenario, driven through the real `resolveOfferInputs` → `buildOffer` path, shows the two pages
  agreeing.

Round 1's non-blocking 1–3 are fixed. Every acceptance criterion as amended has a passing test. The code matches ADR
0001 Amendment 1, and the R3 re-aim is a genuine fix. The gate passes (`20261012T233931Z-5898-8ddb`), and so do the
browser specs (31/31). The five non-blocking notes need no change before merge.

**PASS**
