# Review: Story 3 — Edit mode: assign Assistants and preview the result

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-08
**Diff:** `git diff 75f77f4c..HEAD` (base `75f77f4c`, book decision 15; head `243483be`; 6 commits, 17 files). The source
change is all in `243483be`: `ui/src/pages/treasure-map/{editTreasureMap.js (new), useMapEdit.js (new), Index.jsx,
manageTreasureMap.js}` and `ui/src/styles.css`. The tests are `709926d` (Phase 3) and `5f46f81` (Amendment 1).

## Quality gates (run by reviewer, not trusted)

- [x] `GATE_LABEL=tme3-review npm test`, read with `npm run -s gate:status -- --label tme3-review`:

  ```
  20261008T021451Z-5442-8438 [tme3-review] started 2026-10-08T02:14:51.197Z on 243483be — PASS, exit 0, 5063 passed, 0 failed, 581 skipped, 274/274 suites
  ```

  - The 581 skips are the live-stack suites; there's no Docker stack here.
  - Per suite: `treasure-map-edit-mode` 47/47 (new), `manage-treasure-map-cards` 31/31, `manage-treasure-map-page`
    22 passed + 2 live skips, `treasure-map-card-rule-edges` 29/29.
  - The cited runs exist in `tmp/gate-runs/`. Phase 3, `20261008T011837Z-21469-ab87`, has 5016 passed and 47 failed.
    Phase 4, `20261008T014143Z-17853-d985`, has 5063 passed and 0 failed. 5016 + 47 = 5063, so no other test moved.
  - A second gate ran **as load** while the browser specs repeated: `20261008T022115Z-4735-50c7 [tme3-review-load] … on
    243483be — FAIL, exit 1, 5062 passed, 1 failed … failed: tagging-edges-realtime-wrapper`.
    - The failure is RW7, a wall-clock backoff check: "the first restart came 0.64 s after the first start; expected
      0.8–3.5 s".
    - This diff touches no wrapper code. The same suite failed once under load on 2026-09-30, with RW15 (Harness
      friction 3).
- [x] Browser: I rebuilt `ui/` (`npm run build`). It produced the same bundle, `assets/index-6ILgIfjj.js`, which holds
  `bsd-tm-edit-list-all`, so the served page is HEAD's source. Served on :7799, the five specs (the new one, manage-treasure-map ×2,
  my-assistants ×2), `--project=chromium`:
  - one run: **73 passed (45.5s)**;
  - `--repeat-each=3` while the second `npm test` ran: **219 passed (2.4m)**.
- [x] `bash scripts/harness-lint.sh` reported `harness-lint: clean (0 violations)` before this file existed.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped. The Vite build was only for the browser runs._

## Spec adherence

Each criterion has passing tests. I also drove the built page with a throwaway Playwright script in the scratchpad (not
committed). It reused the spec's `setup()` mocks and checked layout at 320–1024 px. AC-3 fails at phone widths.

| AC | Tests | Hands-on |
|---|---|---|
| AC-1 Edit on/off | E1, E2, E3, E14; T1/C1 re-aimed | Edit by Enter/Space works and keeps focus. A list open when Edit goes off is gone, and stays closed when Edit comes back. No Map: the warning (`role="note"`) is above All duties, and the cards read "Not assigned yet". |
| AC-2 a picker per card | K1–K3, P1–P2, E4–E8, E16 | Order, Local, Current, check, detail, Unsaved, Change and Undo are right. Long names wrap inside the column at 375 px. Focus goes to `<body>` after a pick (non-blocking 1). |
| AC-3 All duties | P3–P6, N3, E9, E10 | Desktop is right. **At 375–430 px the list hangs off the left edge of the screen** (Blocking 1). |
| AC-4 save note | N1, W2, E1, E5, E6, E9, E15 | Right in every sequence I tried: "3 unsaved changes" after Assign to all then a card's Undo; "No changes yet" after the row's Undo. |
| AC-5 what an assignment changes | R-*, E1–E17, Y1–Y3, spec E11–E13 | Re-derived below. |
| AC-6 preview | D1–D3, E5, E11, E13–E15 | The cards preview the draft. The edited viewer starts closed each time Edit turns on. The published raw viewer is unchanged. No sign call, no write and no socket. |
| AC-7 | W4; H1–H5 renamed | The JSDoc says it. H1–H5's assertions are byte-identical; only the names changed. |

**AC-5 / book decision 12, re-derived.** A scratchpad script imported `editTreasureMap.js` and ran it on a deep-frozen
copy of the input, then compared the output index by index.

- **The Map:** a generator-shaped Map. It has `client`, eleven `30382:<metric>` rows → L, `30392` → L,
  `39998:dlist-header` → L and per-DList `39998:<d>` rows (one with an extra element). It also has `*:tag` and
  `*:tag:x:y:confidence`, a later `30382:rank` → C backup, invalid delegates (`3038x` → `NOT-HEX`, `30392` → `zz`),
  `30382:tag:X:T:rank`, a bare `30383`, a later `30382:rank:` spelling and `* … 'e1'`.
- **Scores → B:** the eleven metric rows and `30383` move in place, and `3038x` → B is appended. Every other index is
  byte-identical, including the backup, the second spelling, the invalid tags, the `*:…` rows and the extra elements.
- **Lists → B:** `30392` moves, the invalid `30392` is kept, and `3039x` is appended.
- **Concepts → B:** `39998:dlist-header` moves in its own spelling, and nothing is appended.
- **All → B:** all of the above, and the existing `*` moves in place with relay `''`, keeping `'e1'`.
- **All → L:** rows already naming L keep their relays; the moved and appended rows get the category's relay.
- **Inputs:** a frozen input never threw, and no output tag aliases an input array. A non-array input gives `[]`
  plus the appended entries.
- **`entryRole` per category** over 29 keys:
  - `30382:<word>` and `3038x:<metric>` are own; `30382:tag|pin|dlist|contexts` are individual;
  - `30382::` folds to the bare kind (own); `30392:<x>` is individual;
  - `39998` and `39998:dlist-header` are own; `39998:` and `39999:x` are individual;
  - every `*` form has no role.

  This matches the draft grammar (§ "segment 2 is a system word — or, for Scores only, a NIP-85 metric") and decision
  12's list. One leftover edge: the reserved word `dlist-header` after a Score kind would count as a metric. The
  grammar forbids that key, so it isn't a finding.

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behaviour added that isn't in the story.
- [ ] Every criterion works for a person. **AC-3 doesn't on a phone** (Blocking 1).

## ADR adherence

- [x] **Files** match the implementation notes: two new files, `Index.jsx`, `manageTreasureMap.js` and `styles.css`.
  Nothing else in `ui/src` changed.
- [x] **Exports and API names** match the ADR: `entryRole`, `FAMILY`, `editedTags`, `editedDraft`, `makeRelayFor`,
  `pickCategory`, `undoCategory`, `pickAll`, `undoAll`, `saveNote`, `currentOf`, `currentAll`, `pickerRows`, and
  `COPY.edit.{noChanges, assignedTo, allDutiesTo, unsavedChanges}`. `entryOf` and `appliesTo` are exported with
  unchanged bodies.
- [x] **Layering:**
  - The model imports only `./manageTreasureMap.js`, with no React and no `fetch`.
  - `useMapEdit.js` is the only new file that fetches. It reuses `fetchProfilesChunked` and `buildRows`, and treats
    `signedIn !== true` as an error.
  - The page imports no signer or publish helper. It takes only `aRelays` from `useConfig()`.
- [x] No new dependencies.
- [x] **The story's three § Deviations** are acceptable under the ADR:
  - The edited box's own name, "Raw Treasure Map — edited", is better for screen readers than reusing the raw box's
    name. Amended S3 still requires a `COPY` name.
  - The list's states inside the list are what the plan pinned.
  - "No Escape or click-outside" is within the ADR, which doesn't ask for either. Non-blocking 2 covers its cost.
- [ ] **Sub-decision 5's 375 px rule** ("Nothing scrolls sideways at 375 px") is met to the letter. It misses what it
  was for: the page's 375 px contract since ADR manage-treasure-map/0002 is "nothing wider than the column" (Blocking
  1).
- One unrecorded gap: sub-decision 4 says the list's states "use `.bsd-ma-status`", but the empty state is a plain
  `<p class="bsd-tm-edit-list-state">` (`Index.jsx:230`). It looks the same (non-blocking 6).

## Concept-graph integrity
- [x] No concept handles are touched; the Map's keys are kind/scope keys, not concept handles.
- [x] No concept definition changed, so no firmware reinstall is needed (ADR 0003 says the same).
- [x] Nothing re-derives domain concepts from BIBLE.md. The stack wasn't running (AGENTS.md § 2 fallback, as the story
  says).

## Things tests can't catch
- [x] No secrets. No `console.*`, `TODO` or `debugger`. No commented-out code. No 64-hex literal and no `taPubkey` in the
  three page files.
- [x] **Only your own Map, never the TA:**
  - the draft's `pubkey` is `user.pubkey`;
  - the relay rule keys on `user.assistantPubkey` only;
  - D2 still bans `useParams`/`useSearchParams`, and nothing reads the URL;
  - nothing signs, publishes or stores (D4, S2 and spec E15; `window.__signCalls` stays 0, with no non-GET request and
    no socket).
- [x] **Races:**
  - A slow My Assistants read while Edit is toggled off and on twice makes one request, and the rows appear when it
    answers.
  - An answer that arrives while Edit is off is shown when Edit comes back.
  - A new viewer bumps `latest`, so a stale answer is dropped, and resets editing, pending, the open list and the
    Assistants.
  - One-render window: the reset runs in an effect, so the first render after a viewer change still holds the old
    picks. That's harmless while nothing signs (non-blocking 9, for story 5).
- [x] **Error paths:**
  - A failed read shows the error and Try again inside the list.
  - Edit off and on doesn't retry by itself; Try again does.
  - `aRelays` arriving late re-derives the draft, because the relay rule is a memo input, not stored.
- [x] **Accessibility, what's right:**
  - The Edit toggle has `aria-pressed`, and the list toggles have `aria-expanded` and `aria-controls`.
  - The rows have `aria-pressed`, and their names leave out the avatar letter (`aria-hidden`).
  - The warning is `role="note"`; the list states are `status` and `alert`.
  - The edited `<pre>` is focusable, `role="region"`, and named.
  - The default focus ring shows on Edit, Assign to all, the toggles and the rows (screenshots in the scratchpad).
- [ ] **Accessibility, what's not:**
  - focus is lost after a pick, Undo or Try again (non-blocking 1);
  - an open list hides the next focused control (non-blocking 2);
  - three identically named toggles and Undos (non-blocking 3).

## House rules check
- [x] Concept Graph API authority respected (no concept work).
- [x] No new lint, typecheck or build tooling.
- [x] The per-deployment TA rule is respected: no literal, and no `taPubkey`.

## Product-guide adherence *(when the story traces to a PRD)*
- [x] No PRD. Against the blueprint, the words are § Copy exactly (W1 checks them by value; curly apostrophes as the plan
  pins). The tokens and sizes match sub-decision 5, apart from Blocking 1.

## Re-aims and Amendment 1

- **The Phase-3 re-aims** each keep their test's intent:
  - **T1/C1:** Edit is now asserted present with `aria-pressed` false, and every other edit control is still absent
    before it's pressed.
  - **D5:** narrowed to Save changes. That's right, because the Edit words moved to `COPY.edit`; T1/C1 now carry "no
    edit controls before Edit".
  - **S2:** still bans `taPubkey`, and allows `useConfig()` only as `const { aRelays } = useConfig()`.
  - **H1–H5:** names only.
- **Amendment 1 (`5f46f81`)** weakens nothing:
  - **S3:** still requires exactly one `<pre>` named `COPY.rawBoxLabel`, and now also requires every `<pre>` to be
    reachable and named.
  - **The two locator fixes are correct.** A `has` locator is resolved inside each candidate, so one rooted at
    `<main>` never matched.
  - **E9:** Ava → Cy follows AC-2's "picking the current one removes the card's change".
  - **E7:** still checks one list at a time, `aria-expanded`, and a toggle closing its own list. It dropped only the
    card-to-card click, which the covering list makes impossible with a mouse.
- **Process:** test edits in Phase 4, self-ratified, are the pattern ledger
  `2026-10-07-neighbour-suite-duplicate-roles` records. The content is sound, so it isn't blocking (Harness friction
  1).
- I found no other neighbour test passing by accident. `treasure-map-star-scopes-ignored` only checks
  `categoryAssistants`' export, and D2/D4 still bind the page.

## Docs written this story

- **Accurate:**
  - the story's ACs, table and § Deviations;
  - the ADR's facts at the time it was written (its line numbers are pre-change);
  - the test plan's Verification and Amendment 1 (16/16 and 73/73 reproduced);
  - book decisions 12–15, which match the code;
  - the ledger "Seen again" paragraph.
- **Two small omissions** (non-blocking 8): the story's § Linked artifacts and the epic's story-3 line leave out
  decision 15, which the story rests on.

## Findings

### Blocking
1. **`ui/src/styles.css:10278`, `ui/src/styles.css:10298`, `ui/src/pages/treasure-map/Index.jsx:373`; test gap at
   `tests/brainstorm/treasure-map-edit.spec.js:509–521`.** On a phone, the All duties list hangs off the left edge of the
   screen, so a person can't read who they're choosing.
   - **Why:** below about 440 px the All duties row wraps. The actions block (`flex-shrink: 0`, content width) then
     sits at the start of its line, so **Assign to all** is on the left (x = 35–152 at 375 px). The list is anchored
     `right: 0` to that button and is 300 px wide.
   - **Measured** at 375, 390, 414 and 430 px:
     - with nothing pending, the list spans x = −148…152 and every name starts at x = −97;
     - with Bea pending, it spans x = −71…229, names start at x = −20, and every avatar is off-screen.

     The screenshot shows only the right halves of the rows ("…AL", "…nefr0", "…24e3c").
   - **Who hits it:** every person on a typical phone (360–430 px) who opens Assign to all. AC-3 promises "the same list
     as AC-2", whose rows "show the avatar letter, the name, and the website".
   - **Why E16 misses it:** E16 passes because it checks only `scrollWidth − clientWidth`, and content pushed off the
     *left* edge never scrolls. Story 1's T12 checked that the `<pre>` "ends inside the viewport"; E16 has no such
     check.
   - **The blueprint has the same CSS,** so this is an inherited layout bug. A fix that keeps the list on screen at
     narrow widths is a Deviation worth recording, not drift.
   - **Asked change:**
     - (a) Keep every open list inside the column at every width down to 375 px. For example, keep the All duties
       actions at the row's end when it wraps, or anchor the list's left edge when there's no room on the right.
     - (b) Tester's lane: a recorded test-plan amendment in its own commit. E16 asserts that each open list's
       bounding box lies within the viewport (`x ≥ 0`, `x + width ≤ 375`), for the card lists and the All duties
       list, both with nothing pending and with a name pending.

### Non-blocking
1. **Focus is lost after a pick, an Undo or Try again.** The refs are `Index.jsx:243`, `:293`, `:366` and `:264`, and
   `useMapEdit.js:59–68`.
   - Each of these removes the focused element, so `document.activeElement` becomes `<body>`.
   - In Chrome the next Tab continues from the removed spot (I measured: after a pick, Tab lands on that card's Undo),
     so sighted keyboard users manage.
   - A screen-reader user hears nothing after picking: no live region says "Will be assigned to Bea", and they lose
     their place.
   - Optional: after a pick or Try again, focus the list's toggle; after Undo, focus the card's toggle (or the row's
     Assign to all).
2. **An open list stays open when focus leaves it** (`Index.jsx:226–285`; story § Deviations 3).
   - Tabbing past the Scores list's last row lands on the Lists card's **Choose an Assistant**, which is hidden under
     the open list (WCAG 2.2 SC 2.4.11, Focus Not Obscured).
   - Escape and a click on the page title don't close it.
   - Optional: close on Escape and when focus leaves the picker.
3. **The toggles and Undos are named alike** (`Index.jsx:279`, `:293`): "Choose an Assistant" / "Change" ×3 and
   "Undo" ×4. A screen-reader user who lists buttons can't tell which card each belongs to. Optional: keep the visible
   words, and add the category through `aria-describedby` (the card title) or an `aria-label`.
4. **A pick can be pending while changing nothing.**
   - On the spec's Map, Concepts is Mixed (Zed Local + Cy), so it has no Current.
   - Picking Zed Local gives "Unsaved", "Will be assigned to Zed Local" and "1 unsaved change", but the draft is
     byte-identical to the published Map: its own entry already names Zed Local, and the family entry exists.
   - That's AC-2's literal rule. For story 5: Save would re-publish an identical Map. Consider comparing the draft
     with the published tags before counting changes or enabling Save.
5. **After Assign to all, a card's Undo can leave the card reading Mixed with no Unsaved marker.**
   - Undoing Scores after Assign to all → Bea, or picking Ava (its Current), leaves Scores reading "Mixed · 2
     Assistants" (Ava, Bea). The card shows no Unsaved chip and its button reads Choose an Assistant.
   - The cause: the pending `*` → Bea reaches Scores, and no bare `3038x` hides it.
   - The preview is honest (AC-6) and the steps are the story's (AC-2, AC-3), but a person may read it as a glitch.
     It's for the owner at story 4–5 planning.
6. **The empty state skips `.bsd-ma-status`** (`Index.jsx:230`), which ADR 0003 sub-decision 4 names. It looks the
   same. Align it, or note it in § Deviations.
7. **`aria-controls` can name a missing element** (`Index.jsx:276`): the list's id exists only while the list is open.
   Browsers tolerate this. Optional: render the list always and use `hidden`.
8. **Two docs leave out decision 15:** the story's § Linked artifacts
   (`engineering-team/stories/done/treasure-map-edit/3-edit-mode-assign-and-preview.md:179`) and the epic's story-3 line
   (`engineering-team/epics/treasure-map-edit.md:28`). The story rests on decision 15 (AC-5 row 7, § Resolved while
   drafting, § Out of scope). Add it.
9. **For story 5:** `useMapEdit` resets on a new viewer in an effect (`useMapEdit.js:41–47`). So for one render after a
   viewer change, the page holds the previous viewer's picks, and `useTreasureMap` still holds the previous Map. It's
   harmless now, since nothing signs and the only path is the narrow top-bar one (ledger
   `2026-10-07-top-bar-sign-in-while-loading`). Save should check the viewer when clicked, or key the edit state by
   viewer.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. **Phase-4 test edits, self-ratified, again** (Amendment 1, `5f46f81`).
   - **Existing row:** `2026-10-07-neighbour-suite-duplicate-roles` covers the neighbour-suite S3 miss, and its "Seen
     again" paragraph names only S3.
   - **Different cause:** the three spec-only faults (two `has` locators, E7's covered toggle, E9's Current pick).
     A brand-new browser spec can't run before its page exists, so its locator bugs surface only in Phase 4.
   - **The gap:** the plan pre-authorized "kicks it back here" but didn't say who ratifies the amendment. No ledger
     row covers that; one is warranted.
2. **A 375 px check that can't see the left edge.** The ADR and plan made "no sideways scroll" the whole 375 px test,
   but `scrollWidth` can't see content pushed off the left edge. Story 1's T12 used element bounds. No ledger row
   covers this; a row is warranted, or a line in `workflows/3-test-design.md` § Common pitfalls.
3. **`tagging-edges-realtime-wrapper` timing flake under load.** RW7 failed in the load run above. RW15 failed on
   2026-09-30, and my-assistants #1's review (Harness friction 2) said "a row is warranted if it recurs". It has
   recurred, and no ledger row exists.
4. **Built-UI provenance:** the existing row `2026-10-07-built-ui-records-no-commit` covers this. I rebuilt and got
   the same hash, so it's nothing new.

## Verdict

**CHANGES_REQUESTED**

The edit model, the hook and the page do what ADR 0003 says. AC-5 holds on real Maps byte for byte. The gate and
the five browser specs are green, once and under load, and nothing signs or reaches beyond the viewer's own Map. One
blocking issue remains: on phone widths the All duties list is half off-screen, so a person can't read the
Assistants they're choosing. E16 can't see it. Fix the layout (Blocking 1a), and have the Tester strengthen E16 in a
recorded amendment (Blocking 1b). Non-blocking 1–3 are cheap to fold into the same round.

## Round 2 (2026-10-08)

**Diff:** `git diff 4733672a..HEAD` (head `18ff6f92`; 2 commits, 7 files), reviewed on a clean tree at `18ff6f92`.
- `e76b66fb` is the Tester's Amendment 2: the spec and the test plan.
- `18ff6f92` is the Implementer's fix: `Index.jsx`, `useMapEdit.js`, `styles.css`, the story's § Deviations and
  § Linked artifacts, and the epic.

### Gate results (run by reviewer, not trusted)

- [x] `GATE_LABEL=tme3-review-r2 npm test`, alone on the machine, read with
  `npm run -s gate:status -- --label tme3-review-r2`:

  ```
  20261008T025945Z-9855-e929 [tme3-review-r2] started 2026-10-08T02:59:45.907Z on 18ff6f92 — PASS, exit 0, 5063 passed, 0 failed, 581 skipped, 274/274 suites
  ```

  - The totals are round 1's, because this round changes only the page and a browser spec.
  - Per suite: `treasure-map-edit-mode` 47/47, `manage-treasure-map-cards` 31/31, `manage-treasure-map-page` 22 passed
    and 2 live skips, `treasure-map-card-rule-edges` 29/29.
  - The Implementer's cited run, `20261008T025403Z-13312-55b9 [tme3-r2-p4]`, exists and ran on `e76b66fb+dirty`, before
    the fix was committed. The run above is the one tied to the commit.
- [x] Build: `npm run build` in `ui/` from the clean tree gave the same bundle, `index-DKaCUHQW.js`, that :7799 serves.
  So the browser runs test `18ff6f92`.
- [x] Browser, the five specs, `--project=chromium`, against :7799, with nothing else running:
  - one run: 77 passed (46.1s);
  - `--repeat-each=3`: 231 passed (2.3m).

  77 is round 1's 73, plus E16's second width and E17–E19.
- [x] `bash scripts/harness-lint.sh` reported `harness-lint: clean (0 violations)` before this section was added.

### Carve-out and Amendment 2

- **The carve-out holds.**
  - `e76b66fb` touches only `tests/brainstorm/treasure-map-edit.spec.js` and the test plan.
  - `18ff6f92` touches no test file.
  - The amendment came first, in the Tester's lane, as Blocking 1b asked. The owner approved its scope ("Proceed."),
    so it isn't self-ratified, unlike Amendment 1.
- **It weakens nothing.**
  - E1–E7 and E9–E15 are byte-identical.
  - E8 gains one line.
  - E16 keeps the old no-sideways-scroll check, now for every list at both widths.
  - `allRow` is a new helper.
- **Its recorded run reproduces.**
  - I built `4733672a`'s `ui/` in a scratch tree. It gave round 1's bundle, `index-6ILgIfjj.js`, which I served on
    :7800.
  - The amended spec there: 6 failed, 14 passed. Each failure is the plan's stated reason:
    - E16 at both widths: "All duties, nothing pending: the list's left edge is on screen", received −147.67;
    - E8: no `.bsd-ma-status` element;
    - E17: "after a card's pick", the button isn't focused;
    - E18: "Escape closes the list", but it stays visible;
    - E19: the Scores button's description is `""`.

### Round-1 findings, re-checked

I drove the built page with a scratch Playwright script (not committed; its fixtures are the spec's, copied verbatim).
Each claim below was measured on `18ff6f92` and, where it says so, on round 1's build.

- **Blocking 1, fixed.**
  - **The fix:** `styles.css:10278–10283` adds `margin-left: auto`, which keeps the All duties actions at the row's end
    when the row wraps. **Assign to all** sits at the right edge, so its right-anchored list opens inside the column.
  - **Measured:** I checked 320, 360, 375, 390, 414, 430, 768 and 1024 px.
    - The states: each of the four lists, with nothing pending, with a name pending through Assign to all, and with a
      card pending.
    - Two name sets: the spec's names, and one 78-character name whose first word is 46 characters with no break.
    - Every list box lies inside the screen, and so do the rows, avatars, names and detail lines inside it.
    - For example, the All duties list spans 40…340 at 375 px and 13…285 at 320 px, the same with a name pending.
  - **Sweep:** 320–800 px in 10 px steps, 882 open lists, and none lies outside the screen. The same sweep on round 1's
    build puts the All duties list at −148…152 from 350 to 440 px, so the sweep can see the bug.
  - **The desktop layout is unchanged.** At 600, 768 and 1024 px, in five states, the boxes match round 1's to the
    pixel: the All duties row and its actions, every toggle and list, the pending lines, the Undos and the save note.
    The section screenshots are byte-identical.
  - **(b), the test:** E16 (`treasure-map-edit.spec.js:523–558`) checks each open list's box against the viewport at
    375 and 430 px. It covers the three card lists and All duties, with nothing pending and with Bea pending.
- **Non-blocking 1 (focus), fixed:** `Index.jsx:258–261` (`andFocus`), `:413` and `:461`. Besides E17, I checked by hand:
  - a mouse pick, Enter and Space on a row, a card's Undo and the All duties Undo by keyboard;
  - Try again by keyboard, after which the list stays open;
  - Escape from a row and from the open list's button.

  Each time, focus is on the list's button. Escape with no list open leaves focus where it was.
- **Non-blocking 2 (closing), fixed:** `Index.jsx:238–257`.
  - **Closes:** Escape; a press on the page heading or on blank page space; Tab past the last row; Shift+Tab from the
    open list's button; Tab from the button while only the loading line shows; focus moved by script. Closing picks
    nothing.
  - **Stays open:** a press on the loading line inside the list, and Shift+Tab from a row to its own button.
  - **No close-before-click race.** A press inside the picker is ignored. A blur closes the list only when the new
    focus target is outside the picker, so a blur with `relatedTarget` null never closes it. I simulated Safari two
    ways: a mousedown that never moves focus, and one that blurs the focused toggle with `relatedTarget` null. Both
    times the click still picked and focus landed on the button.
  - **Other clicks:** with focus on one row, a click on another row picks the one clicked. With focus in the All
    duties list, a click on the Concepts button closes All duties and opens Concepts.
  - **Edit off with a list open is clean,** by mouse, by keyboard, and by a synthetic click (as assistive tech sends,
    with no pointerdown and no focus move). The list goes, nothing reaches the console, and Edit on again starts with
    every list closed.
  - **The document listeners are removed.** I counted the document's `keydown` and `pointerdown` listeners: none with
    every list closed, and one each with a list open. Toggle, pick, Escape, an outside press, focus leaving, Edit off
    (all three ways) and leaving the page each bring the count back to none. Moving from one list to another keeps it
    at one.
- **Non-blocking 3 (which card a button belongs to), fixed:** `Index.jsx:192`, `:316`, `:332–333`, `:412` and `:451`.
  - The names are still the blueprint's: "Choose an Assistant", "Change", "Undo", "Assign to all".
  - The descriptions are "Scores", "Scores Will be assigned to Bea", a card's Undo "Concepts", and the All duties
    Undo "All duties".
  - No duplicate ids and no id reference that names nothing, in four Edit states and with Edit off.
  - The save note is `aria-live="polite"` (`:469`).
- **Non-blocking 6 (status style), fixed:** `Index.jsx:266–272`.
  - The text has the same computed font, colour, margin, padding and box as round 1's `<p>`.
  - A screenshot of the open empty list is byte-identical to round 1's.
- **Non-blocking 7: done differently from the plan, and acceptable.** `aria-controls` is set only while the list
  exists (`Index.jsx:315`).
  - **The stated reason holds.** E5's `scores` is the card's `<li>` (spec `:180–183`). `toContainText` reads
    `textContent`, which includes hidden elements, so a hidden list's "Ava" row would fail E5 at spec `:322`.
  - **It also stands on its own.** `aria-controls` is optional on a disclosure button. The defect was a reference to
    nothing, and none is left (checked above). E18's last loop holds this either way.
- **Non-blocking 8 (decision 15), fixed:** the story's § Linked artifacts (`:191`) and the epic's story-3 line (`:28`).
- **Non-blocking 4, 5 and 9, carried** (`epics/treasure-map-edit.md:31–42`), each true to round 1's finding:
  - 5 is a question for the owner at story 4's planning;
  - 4 and 9 are asks on story 5.
- **The docs:**
  - The story's § Deviations are accurate except for non-blocking 1 below.
  - The test plan's Amendment 2 is accurate (6 failed, 14 passed, reproduced above).
  - The spec's header matches its tests.
- **House rules:**
  - The source diff has no `taPubkey` and no 64-hex literal. `useConfig()` is still only `const { aRelays }`
    (`Index.jsx:522`).
  - Nothing signs or publishes, and there's no new request. E15 still passes: no sign call, no write, no socket.
  - Only the viewer's own Map: nothing that picks the Map or the draft's author changed.
  - The copy is unchanged. `COPY` and `editTreasureMap.js` are untouched, and no visible text was added. The section's
    accessibility snapshot shows the blueprint's names.
  - No new dependency or tooling.

### Findings (round 2)

#### Blocking

None.

#### Non-blocking

1. **Two places where § Deviations says more than the code does, or less than the record needs**
   (`engineering-team/stories/done/treasure-map-edit/3-edit-mode-assign-and-preview.md:176–177`, `:186`).
   - **"The save note is a polite live region, so each change is announced" overstates it.**
     - Changing a card that is already pending (Bea → Cy) leaves the note at "1 unsaved change", so the live region
       says nothing.
     - Focus goes back to the button inside the click handler (`Index.jsx:258–261`), before React re-renders. Measured
       at the focus event, the button's description still reads "Will be assigned to Bea", and it reads Cy only after
       the render.
     - Whether a screen reader speaks the old or the new text depends on its timing. I didn't check with one.
     - Optional: reword it ("so a change to the count is announced"), or move focus after the render.
   - **The `aria-controls` line doesn't say why the planned approach was dropped.** The approved plan said the button
     points at its list even while it's closed. The Deviation records only what was built. One clause would do: the
     specs read the card's text content, and hidden rows would be in it.
2. **Outside this diff: at 320 px the top bar scrolls the page sideways by 24 px.**
   - The top bar's avatar menu (`.bs-usermenu`, from `ui/src/components/BrainstormUserMenu.jsx`) ends at x = 344 when
     the Assistant pill shows.
   - It's the same with Edit off, on `/assistants`, and on round 1's build. This page's own contract is 375 px (ADR
     0003 sub-decision 5), and nothing scrolls at 360 px or wider.
   - `assistant-alert` B9 checks 320 px, but only on `/`, `/tags`, `/about`, `/settings`, `/developers` and
     `/tapestry/`, none of them pages built on this design shell.
   - No ledger row covers it, and a `bug` row is warranted.

#### Harness friction

None new.
- Round 1's three rows exist: `2026-10-08-new-browser-spec-amendments-unratified`,
  `2026-10-08-narrow-width-check-misses-left-overflow` and `2026-10-08-realtime-wrapper-timing-flake-under-load`. The
  last didn't trip this round, because the gate ran alone.
- The Implementer's gate and build came from an uncommitted tree. My clean rebuild matched, so existing row
  `2026-10-07-built-ui-records-no-commit` covers it and adds nothing.

### Verdict

Blocking 1 is fixed at its cause. Every open list stays inside the screen from 320 to 1024 px, in every pending state
and with a long name. The desktop layout is identical to round 1's, and E16 now checks the list boxes. It fails on
round 1's build for the reason given and passes now.

The folded non-blocking findings (1–3 and 6–8) are done, and I checked each by hand as well as by the specs. That
includes the Safari-like click, which still picks, and listeners that come and go with the list. Non-blocking 7's
change of approach is sound.

The committed tree passes the gate (5063 passed, 0 failed) and the five browser specs (77, and 231 over three
repeats). What remains is a Deviation wording point and a top-bar issue that isn't this story's.

**PASS** — the round-1 blocking finding is resolved, and no blocking issue remains.

## Close-out on a pass

- [x] Story `**Status:**` flipped to `Done` in place, in round 2's review commit. Round 2's non-blocking 1 is fixed
  in the story's § Deviations wording and carried to story 4 in the epic. Non-blocking 2 is ledger
  `2026-10-08-top-bar-scrolls-sideways-at-320`.
- [x] Completion detection: run. The book isn't complete, because stories 4 (the override and backup switches) and 5
  (Save) remain. The acceptance frame's "Only the person's own Assistants can be picked" is ticked.
