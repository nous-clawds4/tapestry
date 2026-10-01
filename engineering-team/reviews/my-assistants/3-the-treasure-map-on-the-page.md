# Review: Story 3 — What each Assistant does: your Treasure Map on the My Assistants page

**Verdict:** **CHANGES_REQUESTED** (round 1; one blocking finding, test-only. See § Verdict.)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-01
**Diff:** `git diff 2a108aec..29aa28eb` on `feat/my-assistants` (base = ADR 0003's commit). 18 files, 1573 insertions,
64 deletions. Commits:
- `061e037f`, the failing tests, the test plan and the four re-aims (tests only; touches nothing under `ui/` or `src/`);
- `29aa28eb`, the implementation, the story's § Deviations, the book's ticked item and row 314's note, and the
  focus here (touches nothing under `test/` or `tests/`).

The story (`1a0d4504`) and ADR (`2a108aec`) were read as inputs.

**Story:** `engineering-team/stories/my-assistants/3-the-treasure-map-on-the-page.md` (Approved; § Resolved at the story gate; the Implementer's § Deviations)
**ADR:** `engineering-team/decisions/my-assistants/0003-the-pages-treasure-map-is-the-shared-hook-read-strictly.md` (Accepted)
**Test plan:** `engineering-team/stories/my-assistants/3-the-treasure-map-on-the-page.test-plan.md`
**Book:** `engineering-team/audits/my-assistants/book.md` (acceptance frame, no PRD)

**In short:** the code does what ADR 0003 says, sub-decision by sub-decision. The copy matches § Copy byte for byte.
The isolated gate, the three host suites and all 49 browser tests pass (147/147 with `--repeat-each=3`). The real
Treasure Map on this machine gives the four duties the Deviations report. One thing blocks:

- **Nothing tests the open row's panel in the two states AC-7 is about.** The code is right. While the Map loads, an
  open row says "Reading your Treasure Map…", and after a failed read it says "Couldn’t read your Treasure Map.". But
  delete the two lines that do this, and every test still passes. The open row then says "No duties" and "This
  Assistant isn’t listed on your Treasure Map…" while the Map is still loading, and after a read that failed. AC-7
  and AC-1 forbid exactly that (B1).

The rest is non-blocking:
- S2 is weaker than the book's ticked item says (NB1);
- Try again can't recover from a failed relay-list read (NB2);
- "none" can be answered with no relay read, against two records (NB3);
- a dangling `aria-controls`, a brief fallback flash, and a stale merge hash in the book (NB4–NB6).

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`, by the network-isolated CI reproduction** (`ledger/2026-09-30-npm-test-step-leaks-fixtures.md`).
  Nothing ran against `localhost:7778`, and nothing could reach a relay. The steps:
  - a full clone of `feat/my-assistants` at `29aa28eb`, history kept, copied into a Docker named volume with
    `COPYFILE_DISABLE=1 tar --no-xattrs`, and `chown -R root:root` inside it;
  - `npm ci` in `node:22-bookworm`, with network;
  - `GATE_LABEL=review-my-assistants-3 npm test` with `--network none` and `CI=true`. The output went to a file
    outside the copied tree.

  The verdict, read with `npm run -s gate:status -- --label review-my-assistants-3` (exit 0):

  > `20261001T120204Z-21-dc76 [review-my-assistants-3] started 2026-10-01T12:02:04.819Z on 29aa28eb — PASS, exit 0, 4454 passed, 0 failed, 591 skipped, 253/253 suites · /w/repo/tmp/gate-runs/20261001T120204Z-21-dc76.json`

  - **The record:** `node: v22.23.3`, `git: { commit: 29aa28eb…, branch: feat/my-assistants, dirty: false }`.
  - **Per suite:** `my-assistants-map` 14/0/0, `my-assistants-actions` 29/0/0, `my-assistants-page` 50/0/2 (the
    H-class skips with no network), `harness-lint` 76/0/0, `stack-free-npm-test` 6/0/1.
  - **No base run:** nothing failed, so there was nothing to separate. The suite count is higher than review 2's
    because the branch merged staging since (`167c043e`).
  - **Cleanup:** the volume has been removed.
- [x] **The story's suites on the host**, each through its `run()` export (Node v24.18.0). They are the three
  my-assistants suites the brief names. None imports a publisher; the only network use is `my-assistants-page`'s
  H-class, two anonymous GETs to `:7778`.
  - `test/my-assistants-map.test.js`: `{"pass":14,"fail":0,"skipped":0}`.
  - `test/my-assistants-actions.test.js`: `{"pass":29,"fail":0,"skipped":0}`.
  - `test/my-assistants-page.test.js`: `{"pass":52,"fail":0,"skipped":0,"hExecuted":2}`.
- [x] **The red phase, re-checked** in a scratch clone at `061e037f` (tests, no implementation):
  `my-assistants-map` 0 passed / 14 failed, `my-assistants-actions` 27 / 2. That's what the plan's § Verification
  says.
- [x] **Playwright** (chromium), HEAD's `ui/` built into a scratch `outDir` and served by `vite preview` on :4176:
  - `BRAINSTORM_BASE_URL=http://localhost:4176 npx playwright test tests/brainstorm/my-assistants-map.spec.js tests/brainstorm/my-assistants.spec.js tests/brainstorm/my-assistants-actions.spec.js --project=chromium`:
    **49 passed** (12 map, 15 page, 22 actions);
  - the same with `--repeat-each=3`: **147 passed**;
  - before running, I checked the guards: every map test's `setup()` mocks `/api/publish-policy` as
    `allowExternalPublish: false`, mocks `/api/strfry/publish`, and routes every WebSocket to a handler that closes
    and counts it. Every map test asserts zero sockets. The two earlier specs gained the three Treasure Map mocks.
- [x] **Mutants**, in a scratch clone of `29aa28eb`, never in the repo. UI mutants were built separately and served
  on :4177.

  | Mutant | Node | Browser | Reading |
  |---|---|---|---|
  | A: the open row's panel ignores the Map's state (`AssistantRow.jsx:74-75` deleted) | UI only | **49 passed** | **survives:** B1 |
  | B: the page's `withdrawTaggings` takes `relays` and drops it: `({ ids, addresses, relays }) => publishTaggingWithdrawalWithReport({ ids, addresses })` (`Index.jsx:143`) | map 14/0, actions 29/0 | not observable (S2's own comment: with the policy off, the send can't be seen) | **survives:** NB1 |
- [x] **Probes**, a scratch spec reusing the map spec's `setup()` (all guards; sockets 0; nothing pressed but tabs
  and toggles), against HEAD's build unless noted:
  - **P1, an open row while the Map is held:** its panel shows "Reading your Treasure Map…", Manage, Change and
    Remove, and no duty line. Released, it shows "Duties on your Treasure Map", "2 duties", Scores and Concepts.
    Against mutant A, while held: "No duties" and "This Assistant isn’t listed on your Treasure Map…".
  - **P6, an open row after a failed read:** "Couldn’t read your Treasure Map." and Manage. Against mutant A: "No
    duties" and the not-listed line.
  - **P2, the accessibility wiring:** `tablist "View"`, `tab "Assistants" [selected]`, `tab "Duties"`, tabIndex 0 and
    -1, the panel labelled by its tab, the section a `region` named by its `h2`. The disabled **Tag: Brainstorm**
    has `aria-describedby="bsd-ma-maponly-reason-brainstorm"`, which resolves. There are no duplicate ids. The
    Duties tab's `aria-controls` names a panel that isn't in the page (NB4).
  - **P3, Try again after the relay list's Cypher read failed once:** Cypher was asked once, local strfry twice, and
    the error stayed (NB2).
  - **P4, the graph names no general-purpose relay and local strfry misses:** no relay read at all, yet "0 on your
    Treasure Map", three "Not on Treasure Map", and "You haven’t published a Treasure Map yet…" (NB3).
  - **P5, the not-tagged Assistant's profile lookup held:** the section shows its short npub and "— · —", and the
    Duties tab names it by npub, until the lookup answers (NB5).
- [x] **The real Treasure Map, read-only.** `GET :7778/api/strfry/scan` for Nous' kind 10040 (`15f7dafc…`) returned
  one event (2026-09-18, four tags). `treasureMapDuties` on it gives four duties:
  - `30382:rank` and `30382:followers`, both to `4b7ba0a1…`;
  - `39998:nostr-relay` and `39998:cat-breed`, both to `11f23fe4…`, this instance's Local Assistant.

  That matches the Deviations' "two delegates … and four duties". The forced-miss half reads public relays, so I
  didn't re-run it.
- [x] `bash scripts/harness-lint.sh`: clean (0 violations) before writing this file.
- [x] **Hygiene sweeps** on every added line under `ui/`, `src/`, `test/` and `tests/`:
  - no `console.log` outside the test runner's report lines, and no `debugger`, TODO, `nsec` or `82b75e47`;
  - no 64-hex literal under `ui/` or `src/` (S1 checks the two new files too);
  - no raw control bytes in any of the 18 files (perl).
- [ ] _Lint, typecheck and build are not configured, so they were skipped._

## Spec adherence

- [ ] Every acceptance criterion has a passing test. AC-7's "no … duty claims anything" and AC-1's "never claims"
  aren't tested where a duty claim can appear on the Assistants tab, the open row (B1).
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.

| AC | Tests (all pass) | Notes |
|---|---|---|
| AC-1 whose Treasure Map | H1; M1, M2, M3 | The hook's order: local strfry first, then the general-purpose relays, strictly (M2 asserts `strict=1`). "Newest" is per source, as on the Treasure Map page (ADR Option A, by design). The open panel after a failed read is untested (B1). Zero relays: NB3. |
| AC-2 status and count | P1; M1, M2 | The count is rows with at least one duty, an Alternate's included (P1, Bea). Statuses and count only when `found` or `none` (`Index.jsx:100`, `:247`; `AssistantRow.jsx:105`). |
| AC-3 an Assistant's duties | P1, P3, V6; M1, M5, C4 | Every row is a toggle; the panel has the heading and count, the groups with empty ones left out, each duty's name and key, and Manage → `/tapestry/grapevine/treasure-map`. Change and Remove are as before and absent on the untagged Local row. The panel while loading or after an error is untested (B1). |
| AC-4 not tagged | P2, S1; M6, M6b | A region with its `h2`, text, name, URL · NIP-05 and duty count. Tag goes through story 2's `press`: signed, posted once, reported, refreshed into the list, and the section goes. An unpublished tag's button is disabled with its reason as its description. Fallback flash: NB5. |
| AC-5 two tabs | M7 | Assistants by default; click and arrows move the selection and the focus; one panel rendered. NB4. |
| AC-6 the Duties tab | D1, D3–D5, T1, T2; M8, M8b | Order, rank, name, key, level, Preferred, Not tagged, Alternates; opened, Preferred then Alternate (numbered with two or more), "First listed is preferred" / "Only provider", the sentence, the raw entries and the link. Nothing edits. |
| AC-7 honest states | D2, D6; M2, M3, M4, M8 | Rows, count and Duties tab: covered in all four states. The open panel: not (B1). Entries the app can't place are left out (D2; M8's `99999`). |
| Also: the withdrawal's send | O9, S2 | O9 bites (red at `061e037f`). S2 is weaker than the book says (NB1). |

**Copy:** I compared 41 strings, every § Copy row and its singular/plural/zero forms, byte for byte against `COPY`
(`ui/src/pages/assistants/myAssistants.js:54-85`) and its functions. There are no mismatches, the apostrophes are
curly, and the ellipsis is U+2026. The six longest strings were also matched against the story file itself. The
kinds' names and "what"s match § Copy's second table, including the curly double quotes in "a “followers” score"
(D5). The one string § Copy doesn't list, the Not tagged tooltip "On your Treasure Map, but not tagged as one of
your Assistants", is the blueprint's (`blueprint/my-assistants-screen.html.txt:152`).

## ADR adherence

- [x] The files changed match § Implementation notes: the hook, the view-model, `AssistantRow.jsx`, the two new
  files, `Index.jsx`, `assistantActions.js` and `styles.css`. Nothing under `src/`, and no new route.
- [x] Layering is respected. The duties functions are pure and Node-loaded (the map suite imports the view-model as
  ESM). The page holds the state, and the orchestration still takes its publishers as `deps`.
- [x] No new dependencies. Every CSS variable the new rules use is defined in `styles.css`.

**Each sub-decision, against the code:**
1. **The hook** (`ui/src/hooks/useTreasureMap.js`): `useTreasureMap(pubkey, { strict = false } = {})` (`:36`).
   `&strict=1` is added only when strict (`:85`). `success: false` is `error` (`:89-91`), and a success with no
   event is `none` (`:96-98`). `strict` is in the effect's deps (`:104`), and the local step is unchanged. The other
   two callers still pass nothing (`MyCuratedDLists.jsx:28`, `CuratedDListDetail.jsx:46`; H1), and nothing under
   `ui/src/pages/grapevine/` changed. One path the ADR didn't consider answers `none` with no relay read: NB3.
2. **What counts as a duty** (`myAssistants.js:259`, `:305-326`): one duty per `classifyEntry(tag).raw`, only for
   `ta`, `tl`, `dlist` and `designation` with a delegate. Assistants are kept in Map order without repeats, and
   every entry is kept. `ta` is Scores, `tl` Lists, `dlist` and `designation` Concepts. Scope is a bare
   `ta`/`tl` or `designation`, and Exact is the rest (`describeEntry`, `:275-300`). The order is level, then group,
   then the first entry's position (`:323-325`). A catch-all `*` or a family wildcard doesn't match `classifyEntry`'s
   grammar, so it's `other` and not a duty.
3. **Names and sentences:** as § Copy's table. The subjects come from the kind's last digit, with "items" otherwise
   (`:264-272`). It handles the ADR's two uncovered cases: a named List is "the Trusted List “<name>” of <things>.",
   and a Curated DList is named by its `d` tag. `dutySentence` (`:361-366`) joins Alternates with ", then ".
4. **The functions:** `treasureMapDuties`, `dutiesOf` (`:329`), `mapOnlyAssistants` (`:340`), `dutySentence` and
   `dutyRows` (`:374`), with the plan's seams. `rowActions` gives the untagged Local row `{ change: null, remove:
   null }` (`:226`). Additive beyond the ADR's shapes: `at` and `seenAt` on a duty (logged), and `group` and
   `assistants` on a Duties row.
5. **The page** (`Index.jsx`):
   - the tablist above the search card (`:195-213`);
   - the status and count only when `found` or `none` (`:100`, `:247`);
   - the error line with Try again under the count (`:249-254`) and on the Duties tab (`DutiesTab.jsx:82-89`);
   - every row a toggle, with Manage as a link (`AssistantRow.jsx:108`, `:116`);
   - the section through the same `press` (`:163-164`, `:280`), its profiles from `fetchProfilesChunked`
     (`:105-112`), and names from the union of rows and section (`:119-124`).
6. **The withdrawal's send:** `withdraw` computes `relays` first and hands it to `deps.withdrawTaggings`
   (`assistantActions.js:55-56`). The page forwards it (`Index.jsx:143`) and no longer names a constant there.
   `WITHDRAW_RELAYS` is handed in as `withdrawRelays` (`:48`, `:141`). O9 pins the first half; S2 only partly pins
   the second (NB1).

## The Implementer's deviations, judged

- **"Not tagged" also marks your untagged Assistant here on the Duties tab.** Reasonable: the row itself says Not
  tagged, so the tab agrees with it. On this machine it applies to real data: `11f23fe4…` holds two duties.
- **An open duty marks each untagged Assistant:** the blueprint does the same (`my-assistants-screen.html.txt:174`).
- **The open row's panel follows the Map's state.** This isn't a judgment call. AC-7 forbids any duty claim while the
  Map is read, and AC-1 forbids "Not on Treasure Map" from a failed read. The panel's no-duties line is that claim
  in words, so this behaviour is the only compliant one. That's why it needs a test (B1).
- **The Duties tab's intro shows once the Map has been read, with the none line under it; the count, heads and rows
  only when found:** fine, and AC-7's "None published: the Duties tab's empty line" holds (M2).
- **`at` and `seenAt`:** additive, and they give `mapOnlyAssistants` the ADR's "first-appearance order" (P2).
- **Left as the blueprint has them, or left out:**
  - the tab switch's name "View" is the blueprint's (`:11`);
  - Tag: Brainstorm filled and Tag: Tapestry outlined, as in the blueprint;
  - Change stays story 2's button;
  - the coloured dot per kind of duty is left out, a small visual omission, logged.
- **The smoke test:** its local half is confirmed above.

None of these changes an ADR decision.

## Honest states, by surface

| The Map | Row status | Count | Open row's panel | Not-tagged section | Duties tab |
|---|---|---|---|---|---|
| loading | none (M4) | none (M4) | loading line (P1) — **untested**, B1 | none (no duties yet) | loading line (M4) |
| found | On / Not on (M1) | M (M1) | duties (M1) | shown (M6) | rows (M8) |
| none | Not on (M2) | 0 (M2) | no-duties line (M5 shows it with a found Map) | none | intro and none line (M2) |
| error | none (M3) | none (M3) | error line (P6) — **untested**, B1 | none | error and Try again (M3) |

## Accessibility

- [x] **The tabs:** `role="tablist"` named "View", two `role="tab"` buttons with `aria-selected` and a roving
  `tabIndex` (0 / -1). ArrowLeft and ArrowRight move both the selection and the focus. The panel is a
  `role="tabpanel"` labelled by its tab. One stray `aria-controls`: NB4.
- [x] **The toggles:** every row, and every duty, is a native `<button aria-expanded>`. Panels are siblings, and there
  are no nested interactives. Manage is a link.
- [x] **Disabled buttons:** the section's unavailable Tag buttons are natively `disabled`, and `aria-describedby`
  points at the reason line above the list, which resolves (M6b's accessible description, P2). Story 2's Change
  keeps its own.
- [x] **Errors:** the map's error line is `role="alert"`. Only one tab's copy is in the page at a time.

## Security and POV

- **No new signing path.** The section's Tag is story 2's `tagProfile`, through the guarded apply publisher. Nothing
  new is signed.
- **POV-first:** the Map read is the viewer's own kind 10040, by `authors: [viewer]`. Duties are derived at view
  time and nothing is stored.
- **Permissionless:** any delegate the viewer names counts, tagged or not. That's the not-tagged section's point.
- **Local-first (principle 4):** nothing writes to or removes graph state. The only graph touch is the hook's
  existing read-only Cypher.
- **The TA-pubkey rule:** no TA pubkey is used, and no 64-hex literal was added under `ui/` or `src/`. The Local row
  comes from the server, as before. The tests take Nous' key from `REQUIRED_TAGGINGS`.

## Test quality

- **Coverage:** see the table. Every AC has tests; the gap is the panel (B1).
- **The re-aims are legitimate:**
  - V6 and C4 follow sub-decision 4;
  - C16 waits for the map count before counting status regions;
  - A11 now counts a read-only Cypher POST as a read. Its `WRITE_KEYWORDS` is a copy of
    `src/api/neo4j/queryPost.js:17`, character for character today, not an import. If the server's guard changes,
    the copy won't follow. The hook's Cypher (`IS_A_SUPERSET_OF`) doesn't trip it, because `SET` sits inside a word.
- **The sentinels:** H1 pins the signature and the other callers. S1 pins no hex in the new files. S2 is weaker than
  claimed (NB1).
- **The plan's mutant claims:** I re-ran the red phase (above). Mutant A is a new survivor that the plan's
  "statuses shown while the map loads" doesn't cover, because that one changes the row line, not the panel.

## Scope

Nothing beyond the story. No editing of duties, no Make preferred or Reset, no catch-all or wildcard grammar, no
adopted-provider selector, no Fallback group, no header-name lookup (sub-decision 3), and no server change.

## Concept-graph integrity

- [x] No concept, handle or definition is added or changed. The Treasure Map has no concept node (ADR § Context).
  The only Cypher is the hook's existing read of the general-purpose relays.
- [x] Firmware reinstall: not needed (ADR § Consequences).
- [x] Orientation: nothing re-derives concepts.

## Things tests can't catch

- [x] **Secrets:** none (sweep).
- [x] **Debug code:** none.
- [x] **Commented-out code:** none.
- [ ] **Edge cases:** NB2 (a retry that can't retry), NB3 (no relays), NB5 (fallbacks).
- [x] **Concurrency:**
  - the hook's `cancelled` flags drop stale reads;
  - the profile lookup for the section is cancelled when its key set changes;
  - one press at a time and disabled buttons cover the section's Tag (C8's mechanism).
- [x] **Input at boundaries:** `classifyEntry` is the one parse, and it never throws. `treasureMapDuties` takes
  anything (D6). A delegate must be 64-hex, and it is lowercased.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence

No PRD. The copy matches § Copy (above). The tab switch, the row status with its dot (green filled for On, hollow
for Not on), the panel, the section and the Duties table follow the blueprint's markup and measurements, with the
logged omissions. M9 checks 375 px with the section and with an open duty.

## Findings

### Blocking

1. **B1: the open row's panel is the one place on the Assistants tab where a duty claim can show while the Map loads
   or after it fails, and nothing tests it.**
   `ui/src/pages/assistants/AssistantRow.jsx:72-75`; `tests/brainstorm/my-assistants-map.spec.js:189-222` (M3, M4);
   `engineering-team/stories/my-assistants/3-the-treasure-map-on-the-page.test-plan.md:50` and `:162-183`.
   - **The code is right:** P1 and P6 above.
   - **What the story asks:**
     - AC-7: "While the Treasure Map is being read: no status, count or duty claims anything";
     - AC-1: "It never claims 'Not on Treasure Map' from a read that failed".

     The panel's no-duties line, "This Assistant isn’t listed on your Treasure Map, so clients won’t ask it for
     anything.", is that claim in words.
   - **What survives:** mutant A deletes the two guard lines. Every Node test and all 49 browser tests pass. An open
     row then says "No duties" and that line while the Map loads (P1) and after a failed read (P6).
   - **When a user meets it:**
     - a row opened during the relay read, when the Map isn't in local strfry. That read can take up to 8 s
       (`FETCH_TIMEOUT_MS`, `src/api/relay/fetchEvents.js:28`);
     - a row left open while Try again re-reads.
   - **Why it blocks:** the honest states are the heart of this story. A two-line regression would put the forbidden
     claim back with every gate green. This is the shape of review 2's Blocking 2: a guard in the code, an AC clause
     that covers it, no test, and a mutant that passes everything.
   - **Asked change** (the Tester's files, Phase 3; no implementation change):
     - in M4, open a row while the hold is on, and assert its panel shows "Reading your Treasure Map…" with no "No
       duties", no not-listed line and no group label;
     - in M3, open a row before Try again, and assert the error line and never the not-listed line;
     - show that mutant A fails both;
     - add the panel to the plan's AC-7 coverage row and to its mutant table.

     Then move the Deviation's panel bullet out of the judgment calls: it's what AC-7 requires.

### Non-blocking

1. **NB1: S2 doesn't pin that the page forwards the relays, and the book says it does.**
   `test/my-assistants-map.test.js:235-239`; `ui/src/pages/assistants/Index.jsx:143`;
   `engineering-team/audits/my-assistants/book.md:98-101`.
   - S2 accepts any `withdrawTaggings:` line that mentions the word `relays` and names no `*_RELAYS` constant.
   - Mutant B takes `relays` in its parameters and drops it in the call. It passes S2 and O9. It sends the
     withdrawal to `publishEverywhere`'s default list, which has no dcosl, while the report still lists dcosl. That
     is review 2 round 2's M3 in another form.
   - The code is right, and sub-decision 6's own pins (O9 and C13) are met. The book's ticked line, "S2 … pins that
     the page forwards that list to the publisher", says more than S2 does.
   - **Suggested:** have S2 require `relays` inside the object passed to `publishTaggingWithdrawalWithReport`, or
     accept a plain pass-through of the whole argument. Or reword the book's line to "S2 pins the shape of the
     page's forwarding". It can ride along with B1's Tester pass.
2. **NB2: Try again can't recover from a failed relay-list read.**
   `ui/src/hooks/useTreasureMap.js:37-40`, `:78-80`; `ui/src/pages/assistants/Index.jsx:252`;
   `ui/src/pages/assistants/DutiesTab.jsx:86`; test plan `:70-71`.
   - The hook's `refresh` re-runs the local scan only. The relay list comes from `useCypher`, which is read once,
     and its `refetch` is never called.
   - So after one failed `POST /api/neo4j/query`, each Try again repeats "Couldn’t read your Treasure Map." until the
     page is reloaded. In P3, Cypher was asked once and local strfry twice, and the error stayed.
   - The defect is in the shared hook, but this page is the first to offer Try again on its error. The other two
     callers offer none. The plan's "not covered, by choice" names a failed relay list, but reasons only about the
     error state, not the retry.
   - **Suggested:** have `refresh` also refetch the relay list when it errored. That's a small, additive hook change
     and harmless to the other callers; add a browser case with it. Or file an OPEN.md row and leave it.
3. **NB3: "none" doesn't always mean a relay was read, and two records say it does.**
   `ui/src/hooks/useTreasureMap.js:82` against its docstring `:26-28`; OPEN.md row 314's "Update 2026-09-30" note
   (`OPEN.md:346`); ADR 0003 sub-decision 1 (`:110`).
   - **No relays:** when the graph names no general-purpose relay and local strfry misses, the hook answers `none`
     without reading any relay. The page then says "0 on your Treasure Map", "Not on Treasure Map" on every row, and
     "You haven’t published a Treasure Map yet…" (P4). The docstring says that with `strict`, "`none` means at least
     one relay was read and held nothing".
   - **Partly reachable:** by the ADR's design, strict answers success when at least one relay was read. So a Map
     held only by an unreachable relay reads as `none` when another relay answers empty. The ADR says so, but row
     314's note ("an unreadable Treasure Map reads as an error there, never as 'none'") doesn't.
   - Not reachable on this machine, which has four general-purpose relays.
   - **Suggested:** correct the docstring and the row 314 note to say what `none` means: local strfry missed, and
     every relay that answered held nothing, or there was no relay to ask. Ask the Architect whether strict with no
     relays should be `none` or `error`.
4. **NB4: the Duties tab's `aria-controls` names a panel that isn't in the page.** `ui/src/pages/assistants/Index.jsx:204`.
   Only the selected panel renders, as the test plan's markup contract asks, so the other tab's `aria-controls` is
   an unresolved ID reference (P2: `controlsExists: false`). Screen readers ignore it, and some checkers flag it.
   **Suggested:** set `aria-controls` on the selected tab only.
5. **NB5: the not-tagged section and the Duties tab show fallbacks until the section's profiles arrive.**
   `ui/src/pages/assistants/Index.jsx:104-118`. While the lookup for the not-tagged pubkeys is pending, the section
   shows the short npub and "— · —", and the Duties tab names that Assistant by npub (P5). Then both fill in. It's
   honest, since those are the fallbacks, and nothing reorders, so it's cosmetic. Story 1 held its rows until the
   profiles settled; this section doesn't. Optional.
6. **NB6: book decision 12 cites a merge that isn't on the branch.** `engineering-team/audits/my-assistants/book.md:79-80`
   cites merge `7c83fdcb`. That commit isn't an ancestor of HEAD. The branch's merge of staging is `167c043e`, with
   the same parents (`4962c335`, `43e78fd8`) and an identical tree, so the merge was made again. This was written in
   the story commit `1a0d4504`, not in this diff. **Suggested:** change the hash to `167c043e`.

### Harness friction

1. **Test Design pinned the honest states per state, not per surface.** AC-7 forbids a claim in a state, and the
   claim can appear on four surfaces: the row line, the open panel, the not-tagged section and the Duties tab. The
   plan pinned the row line (its mutant "statuses shown while the map loads"), the count and the Duties tab, but not
   the open panel. The Implementer then logged the panel's compliance as a "deviation", and nothing caught the gap
   until review.
   - **Candidate `meta` row:** for each AC that forbids a claim in a state, the test plan lists every surface that
     can render the claim and pins each one with its own mutant. Same family as the test-design note that a "never
     shows X while loading" check needs a mutant that keeps X.
2. **The Reviewer wiring says commit and flip the status; this brief said neither.** OPEN.md row 316 already records
   this. Nothing new.

## Close-out

Not applicable this round. The story stays `Approved`: no status change, and no completion detection. Per the
caller's brief, this file isn't committed (row 316).

## Verdict
**CHANGES_REQUESTED**

There is one blocking issue:
- **B1:** nothing tests the open row's panel while the Map loads or after it fails. That's the only place on the
  Assistants tab where AC-7's forbidden duty claim, and AC-1's "Not on Treasure Map" from a failed read, could
  appear. A two-line mutant puts the claim back and passes every suite. The fix is test-only:
  `ui/src/pages/assistants/AssistantRow.jsx:72-75`, `tests/brainstorm/my-assistants-map.spec.js:189-222`.

Everything else (NB1–NB6) can ride along with that pass or be filed.
