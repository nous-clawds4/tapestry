# Review: Story 4 — Edit mode: the override switches and the backup switch

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-08
**Diff:** `git diff 7376989b..HEAD` (base `7376989b`, the approved story; head `778e0875`; 4 commits, 14 files). Reviewed
on a clean tree at `778e0875`.
- `442b0879` and `1479550c` are the ADR: 0004 drafted, then accepted, with ADR 0003's supersession note and the story's
  ADR link.
- `0ae38c9f` is the Tester's: the two new suites, the registry line, the two re-aims (P3, E9), the test plan and the
  story's test-plan link.
- `778e0875` is the Implementer's: `ui/src/pages/treasure-map/{editTreasureMap.js, manageTreasureMap.js, useMapEdit.js,
  Index.jsx}` and `ui/src/styles.css`.

## Quality gates (run by reviewer, not trusted)

- [x] `GATE_LABEL=tme4-review npm test`, alone on the machine, read with
  `npm run -s gate:status -- --label tme4-review`:

  ```
  20261008T165446Z-4836-1763 [tme4-review] started 2026-10-08T16:54:46.338Z on 778e0875 — PASS, exit 0, 5097 passed, 0 failed, 581 skipped, 275/275 suites
  ```

  - The 581 skips are the live-stack suites; there's no Docker stack here.
  - Per suite: `treasure-map-switches` 34/34 (new), `treasure-map-edit-mode` 47/47, `manage-treasure-map-cards` 31/31,
    `manage-treasure-map-page` 22 passed and 2 live skips, `treasure-map-card-rule-edges` 29/29,
    `treasure-map-star-scopes-ignored` 17/17.
  - The cited runs exist in `tmp/gate-runs/`:
    - Phase 3, `20261008T162453Z-12470-7fe3 [tme4-phase3]` on `1479550c+dirty`: FAIL, 5063 passed, 34 failed, in
      `treasure-map-edit-mode` and `treasure-map-switches`.
    - Phase 4, `20261008T164717Z-7976-97fe [tme4-phase4]` on `0ae38c9f+dirty`: PASS, 5097 passed.
    - 5063 + 34 = 5097, and 5097 is story 3's 5063 plus the 34 new tests, so no other test moved.
- [x] **Build tied to the commit.** `cd ui && npm run build` from the clean tree at `778e0875` gave the same bundle,
  `assets/index-B6UEV-n6.js`, that `dist/index.html` names and :7799 serves. It holds `bsd-tm-edit-override-all`. The
  tree was still clean afterwards.
- [x] **Browser,** the six specs, `--project=chromium`, against :7799, with no gate running:
  - one run: **90 passed (51.9s)**;
  - `--repeat-each=3`: **270 passed (2.7m)**.
- [x] **The Phase-3 browser claim reproduces.** I extracted `1479550c`'s `ui/` and `src/` into the scratchpad and built
  them. The build gave the plan's bundle, `index-DKaCUHQW.js`, which I served on :7800. The new spec and story 3's spec
  against it gave **14 failed, 19 passed**, as the plan says. Each failure is at the point the plan names:
  - V1, V3, V4, V6 and V8: "element(s) not found" for the switch's name;
  - V2, V7 and V12: clicking a switch that isn't there;
  - V5: the All duties row still names Bea;
  - V9: no `role="switch"`;
  - V10: focus arrives before the button reads "Change";
  - V11: "Expected 5, Received 0" at both widths;
  - E9: no "2 unsaved changes".
- [x] `bash scripts/harness-lint.sh` reported `harness-lint: clean (0 violations)` before this file existed.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped. The Vite build was only for the browser runs._

## Spec adherence

Every criterion has passing tests. I also drove the built page with a scratch Playwright spec (not committed). It reuses
the new spec's `setup()` mocks and Maps verbatim, and adds its own (H1–H12 below). I ran the model through a scratch
Node script on deep-frozen inputs.

| AC | Tests | Hands-on |
|---|---|---|
| AC-1 a card's switch | I1–I4, O1–O6, T2, T3, V1–V3 | Shown only with a pending card and duties naming someone else. A changed pick keeps the switch and recounts. When N becomes 0 the switch goes and removes nothing; picking back shows it on again. Undo and the current Assistant turn it off. The save note doesn't move. |
| AC-2 the All duties switch | A1, T1, T4, T5, V4 | The sum is right on the spec's Map and on mine. A card's own switch turns the All switch off; turning on the last card with duties turns it on (H2). Space and Enter on the All switch turn all three card switches (H2). |
| AC-3 a card's Undo after Assign to all | T2, T3, P3 (re-aimed), V5, E9 (re-aimed) | Both by Undo and by the current Assistant: the row names no one and has no Undo; the card reads as before Edit (Ava, not Mixed, no Unsaved); "2 unsaved changes"; no `*` in the draft. |
| AC-4 the backup switch | B1–B8, Q2, Q3, T1, T4, T5, N1, V6–V8 | Each table row below. On by itself is "1 unsaved change". It survives the All duties Undo and resets when Edit turns off. It hides and stops counting when an override removes the last backup, and it comes back still on when the override goes off (H10, as ADR 0004's Consequences say). |
| AC-5 the preview | Q1–Q5, V1, V4, V6, V12 | The cards and the edited viewer follow every switch. The raw viewer still shows the published tags. No sign call, no write and no socket. |
| AC-6 keyboard and screen reader | V1, V4, V6, V9–V11; story 3's E17–E19 | Every switch is a `<button type="button" role="switch">` with `aria-checked`. Its name is the label and its description the note (H1). Space and Enter turn it and focus stays. Every switch lies inside the screen from 320 to 1280 px (H7). Focus lands after the render (H4–H6). |

V10's title says "after a pick, an Undo or Try again", but its body has no Try again step. Story 3's E17 checks focus
after Try again, and H4 checks its timing. The coverage map's AC-6 row describes V10 correctly (non-blocking 4).

**AC-4's table, row by row.** Each row was run through `planEdit` in the scratch script and checked against the story.

| Row | Story says | Got | Test |
|---|---|---|---|
| 1 | `3038x` → B; `3038x:tag:<X>` removed; Scores reads B | `[["3038x",B]]`; `categoryAssistants` gives Scores `[B]` | O1; V1 (the card on the spec's Map) |
| 2 | "Override 1 individually assigned duty" (the one naming C) | duties.lists = `["30396:tag:X:T"]`; `COPY.edit.override(1)` | I2 and W1 (no test uses this exact Map; the probe does) |
| 3 | `30392` → B, `…:Y:<T>` → B kept, `3039x` → B added; `…:X:<T>` removed | exactly that, in that order | O2 |
| 4 | `39998` → B; both `39998:<d>` removed | `[["39998",B]]` | O3 |
| 5 | `*:tag` → D kept, `3038x` → B added; `3038x:tag:<X>` removed | `[["*:tag",D],["3038x",B]]` | O4 |
| 6 | "Remove 2 backup Assistants"; `30382:rank` → A, `*:tag` → D | count 2, `COPY.edit.backups(2)`; those two tags | B5, B6, W1 |
| 7 | `30382:rank` → B, `3038x` → B added | `[["30382:rank",B],["3038x",B]]` | B7 |
| 8 | `39998:dlist-header` → A | `[["39998:dlist-header",A]]` | B8 |

**The owner's five defaults:**
1. **An override removes a duty whole.** A key naming B then C goes entirely (I1 `30383:pin:P`, O3, V4); a key naming
   only B stays (V1, V4).
2. **Overrides don't count in the note.** Covered by N1, V1 and H8.
3. **The backup count is taken on the edited Map,** after assignments and overrides. `planEdit` counts on
   `editedTags(tags, pending without backups)`, which runs the override pass (Q2, V7 4 → 3, V8 1 → hidden).
4. **With the backup switch on, the note counts.** N1 gives "5 unsaved changes" for all duties to Bea plus backups,
   and V7 shows it.
5. **The All duties Undo leaves the backup switch.** `undoAll` keeps only `backups` (T5, V7).

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behaviour added that isn't in the story.

## ADR adherence

- [x] **Files** match the implementation notes: the four page files and `styles.css`. ADR 0003's supersession note is
  in the ADR commit (`1479550c`). Nothing else in `ui/src` changed.
- [x] **Sub-decision 1, the pending value and its steps** (`editTreasureMap.js:206–270`).
  - `withOverride` deletes an emptied `override`, `setBackups(…, false)` deletes the key, and `pickAll` and `undoAll`
    go through `onlyBackups`. So no step leaves an empty `override` or a `false` flag.
  - Every step copies before it changes. I ran the 12 steps on 5 deep-frozen starting values: 60 runs, none threw,
    none returned its input, none left a `false` or an empty `override`.
  - `pickCategory` with another Assistant keeps the override. With the current one it delegates to `undoCategory`,
    which drops the card, its override and `everything`. `pickAll` drops `override` and keeps `backups`; picking
    `currentAll` keeps only `backups`. `undoAll()` with no argument is `{}`.
  - `PENDING_KEYS` is still the four assignment keys (`:22`).
- [x] **Sub-decision 2, `planEdit`'s effective pending** (`:167–177`). Duties are counted per pending card against its
  own Assistant, on the input tags. Backups are counted on `editedTags` without `backups`. `pending` drops `backups`
  only when that count is 0. The draft is `editedDraft` with the effective pending. The page feeds `plan.pending` to
  `saveNote` (`Index.jsx:542`) and `plan.draft` to the cards and the edited viewer.
- [x] **`GRAMMAR_SLOT`** is the ADR's regex, private (`:27`), and tested on `entryOf(tag).slot` only through
  `grammarEntry` (`:119–122`). It matches the draft grammar's `kind-slot` (`protocols/drafts/treasure-maps.md` § 4.7).
- [x] **`editedTags`' two passes** (`:86–97`) come after story 3's moves and additions. Duties are counted on `source`.
  The drop set holds source indices, and `out` keeps source indices for `i < source.length` because moves are in
  place and additions are appended. So an appended family or `*` entry can never be dropped by an override. Then
  `dropBackups` runs when `backups` is set.
- [x] **`overrideAllState`, `saveNote` and `COPY.edit`** match sub-decision 2 word for word, with curly apostrophes in
  `backupsOff` (`manageTreasureMap.js:76–83`; W1, W2).
- [x] **Sub-decision 3, the hook:** three `setPending` actions through the steps (`useMapEdit.js:76–78`); the viewer
  reset and Edit off still clear `pending`, and with it every switch.
- [x] **Sub-decision 4, the Switch markup** (`Index.jsx:340–358`): `<button type="button" role="switch"
  aria-checked>`, `aria-labelledby` its label span, `aria-describedby` its note span, and an `aria-hidden` track with
  its knob. Each switch is rendered unconditionally while shown, so turning it never remounts it.
  - The card switch sits under the picker row inside the card (`:518–526`).
  - The All switch sits inside the All duties row on its own line (`:478–486`).
  - The backup switch sits between the cards and the note (`:531–541`), in a `.bsd-tm-edit-backups` wrapper the ADR
    doesn't name. That's a layout detail, not drift.
- [x] **Sub-decision 4, focus after the render.** `Picker` keeps `focusNext` (`:238–244`), set by a pick, Try again
  (`andFocus`, `:267–270`) and Escape (`:251`). `CategoryCards` keeps `focusAfter` (`:394–401`), set by both Undos.
  Each ref is read and cleared by an effect with no dependency list, so it runs after every render. The ADR describes
  one ref; two refs, one per component, is the same design. The synchronous `focus()` calls are gone.
- [x] **Sub-decision 5, styles** (`styles.css:10338–10360`): the radius, border, padding, gap, hover, label and note
  sizes, wrapping, track and knob are the ADR's. It adds a `:focus-visible` outline (2 px accent, offset 2 px), which
  helps.
- [x] No new dependencies. The model's imports stay `.js`-suffixed (`editTreasureMap.js:16`).

## The carve-out and the re-aims

- [x] **`0ae38c9f` touches only** `test/treasure-map-switches.test.js`, `test/registry.js` (one line, after
  `treasure-map-edit-mode`), `test/treasure-map-edit-mode.test.js`, `tests/brainstorm/treasure-map-switches.spec.js`,
  `tests/brainstorm/treasure-map-edit.spec.js`, the test plan, and one link line in the story.
- [x] **`778e0875` touches no test file.**
- [x] **P3** (`treasure-map-edit-mode.test.js:304–312`) follows book decision 16. It now expects `{ scores, concepts }`
  without `everything`. Its input check is stronger: it covers `everything` as well as `lists`.
- [x] **E9** (`treasure-map-edit.spec.js:403–433`) follows book decision 16, and everything above the card's Undo is
  byte-identical. After the card's Undo it expects "2 unsaved changes", Concepts still Bea, and a row with no name
  and no Undo. **It still tests the row's Undo:** a fresh Assign to all, then the row's Undo, gives "No changes yet"
  and no Unsaved chip.
  - What it no longer covers in the browser is the row's Undo after a card was changed following Assign to all. P5
    covers that in Node, and H8 checks it by hand (non-blocking 4).
- [x] No other test was weakened. The neighbour suites are byte-identical apart from those two tests.

## Concept-graph integrity
- [x] No concept handles are touched. The Map's keys are kind/scope keys, not concept handles.
- [x] No concept definition changed, so no firmware reinstall is needed (ADR 0004 says the same).
- [x] Nothing re-derives domain concepts from BIBLE.md. The stack wasn't running (the story says so).

## Things tests can't catch
- [x] No secrets. No `console.*`, `debugger`, `TODO` or commented-out code in the source diff.
- [x] **Model probes** (scratch Node script, on frozen inputs where it matters):
  - **An override kept across a pick to an Assistant with no duties:** N is 0, so the switch hides and removes nothing.
    The raw flag stays, as AC-1 says.
  - **The backup switch after an override removes keys:** the removed key's backups aren't counted (1, not 2), and
    the draft keeps the moved entry and the family entry.
  - **An `everything` change with backups:** with `*:`, `*` and `*::` in the Map, the first (`*:`) moves to B in its
    own spelling and the other two are dropped as backups (count 2). The note reads "5 unsaved changes" with the
    switch on, and "All duties → Bea" with it off.
  - **`pickAll` with overrides set** drops them and keeps `backups`. Picking `currentAll` gives `{}` or
    `{ backups: true }`.
  - **No Map, or an event with garbage `tags`:** no duties, no backups, and `backups` drops from the effective pending.
    The draft holds only what the assignments add.
  - **Garbage tags** (`null`, a string, a number, `[]`, `["3038x"]`, `[null, hex]`, a non-hex delegate, `{}`, an
    upper-case delegate): nothing throws. Every non-entry stays in place. The upper-case delegate is an entry, so it's
    a duty or a backup like any other.
  - **Tags with extra elements:** a moved entry keeps its extras and kept tags keep theirs byte for byte. A backup
    with extras is dropped whole.
  - **Removal never touches a tag it didn't count.** It drops only tags whose role in that category is `individual`
    with a counted `norm`. The categories split by kind (30380–9, 30390–9, 39998/9), so one category's override can't
    reach another's moved own entry.
  - **Index alignment:** a source with `null` and `'junk'` between entries, all four keys pending and the Lists
    override on, drops exactly the counted duty's two tags. The appended `3038x`, `3039x`, `39998` and `*` stay.
  - **Could `dropBackups` drop an appended entry?** No. A family entry is appended only when no valid tag has its
    `norm`, and `*` only when no `*`-normed entry exists. So an appended entry is always the first of its key. A tag
    with that key and an invalid delegate isn't a grammar entry, so it neither blocks the append nor counts as a key
    (`["3038x","NOTHEX"]` stays beside the appended `3038x`).
- [x] **Hands-on in the browser** (scratch spec, built UI on :7799, every `/api` mocked):
  - **H1, names:** each switch's role, `aria-checked`, name and description are right. There are no duplicate ids and
    no `aria-labelledby`, `aria-describedby` or `aria-controls` that names nothing. The three card switches share one
    name (non-blocking 1).
  - **H2, Tab order:** All duties Undo → Assign to all → All switch → per card (Change → Undo → switch) → backup
    switch → Advanced page.
  - **H3, focus ring:** a keyboard-focused switch shows a 2 px accent outline (`:focus-visible`); a mouse click shows
    none.
  - **H4, focus timing** (a `focusin` log of the button's text and description at the moment focus arrives):
    - a keyboard pick: "Change", "Scores Will be assigned to Bea";
    - a second pick: "… to Cy";
    - Undo: "Choose an Assistant", "Scores";
    - All duties pick and Undo: "Assign to all";
    - Try again in an already-open list: focus on the button while the list stays open and loads, still there when
      the rows arrive;
    - Escape from a row and from the open list's button: the list closes and focus is on its button;
    - Escape with no list open leaves focus on a switch.
  - **H5, stale focus:** none found.
    - I tried Escape twice, a press outside and an Escape dispatched in one task, and two Escapes dispatched
      synchronously. After each, I moved focus to a switch and turned it twice. Focus stayed on the switch each time.
    - A stale `focusNext` would need an Escape, pick or Try again that causes no render. Each of them changes state
      with a new object or a new value. The document listener exists only while the list is open, and it goes in the
      same commit that closes the list.
    - One synthetic case does differ: a row clicked and focus moved by script in the same task ends on the button. A
      person can't act between the click and the render, so this isn't a finding.
  - **H6, an open list and another control:** with Lists open, a mouse Undo on Scores closes Lists and focuses Scores'
    button. Clicking Scores' switch with Lists open closes Lists and leaves focus on the switch. Tab past the last row
    closes the list and lands on the card's Undo.
  - **H7, widths:** at 320, 360, 375, 390, 414, 430, 768 and 1280 px, with all five switches on:
    - every switch and every span inside it lies inside the screen and inside its container, and no text is clipped;
    - the labels wrap at phone widths (the All switch is 104 px tall at 320);
    - the All duties list stays inside the screen (13…285 at 320, 40…340 at 375);
    - nothing scrolls sideways from 360 px up. At 320 the page scrolls 24 px, which is the top bar's known overflow
      (ledger `2026-10-08-top-bar-scrolls-sideways-at-320`); the switches end at x = 304.

    Screenshots are in the scratchpad.
  - **H8–H12:**
    - H8: the row's Undo after a card changed following Assign to all, with an override on, gives "No changes yet".
    - H9: the All switch sets a card's hidden override (non-blocking 2).
    - H10: the backup switch hides, then comes back still on.
    - H11: with no Map found, there are no switches, the note reads "All duties → Bea", and nothing reaches the
      console.
    - H12: a Map with garbage tags renders, and the switches count and remove what the model says.
  - **Story 3's behaviour is unchanged:** E1–E19 pass, including E17 (focus returns), E18 (Escape, focus leaving, a
    press outside) and E19 (which card a button belongs to).
- [x] **Races:** the switches are pure `setPending` updates with no I/O. Edit off and a viewer change reset them with
  `pending`, as before.

## House rules check
- [x] Concept Graph API authority respected (no concept work).
- [x] No new lint, typecheck or build tooling.
- [x] **No `taPubkey` and no 64-hex literal** in the source diff (grepped; S2 also guards `Index.jsx`).
  `useConfig()` is still only `const { aRelays }` (`Index.jsx:595`).
- [x] **Nothing signs, publishes or stores.** No new request, signer or storage call is in the diff. V12 passes: no
  sign call, no write and no socket, with every switch on.
- [x] **Only the viewer's own Map.** `planEdit` takes `viewer = user.pubkey` and the event `useTreasureMap(viewer)`
  read. Nothing that picks the Map or the draft's author changed.
- [x] **CLAUDE.md principle 4.** With both switches off, `editedTags` returns story 3's `out` unchanged (`drop` is empty
  and `backups` unset). Story 3's R-class and Y-class tests are untouched and pass. With switches on, only counted
  duties and backups leave the Map. Every kept tag keeps its bytes and its relative place (O6, B4, V6's exact draft,
  and the probes).

## Product-guide adherence *(when the story traces to a PRD)*
- [x] No PRD. The words are § Copy exactly: the blueprint's override words and the owner's backup words, plus the
  approved singular "Remove 1 backup Assistant" (W1, W2). The switch's look follows the blueprint's `c.ovToggle` and
  `tmbAllOvToggle` (36×20 track, 16 px knob, 12 px radius row).

## Findings

### Blocking

None.

### Non-blocking
1. **The three card switches have the same name and nothing says which card each belongs to**
   (`ui/src/pages/treasure-map/Index.jsx:518–526`).
   - All three read "Override 1 individually assigned duty", with the note as the description (H1).
   - In Tab order the switch follows "Undo, Scores", so a person tabbing through keeps their place. In a screen
     reader's list of form controls the three can't be told apart.
   - Story 3 fixed the same thing for its buttons by adding the card title to `aria-describedby` (its round 1,
     non-blocking 3). AC-6 pins the description to the note, so the same fix here needs the owner's nod. One
     option: `aria-describedby="<title id> <note id>"`.
   - Optional; it could ride with story 5.
2. **The All duties switch turns on the override of a card that has no duties, so a later pick shows that card's
   switch already on** (`ui/src/pages/treasure-map/editTreasureMap.js:260–262`; seen in H9).
   - The Map: Scores has a duty naming Cy, and Concepts has `39998:d1` → Bea.
   - Assign to all → Bea shows "Override 1 … across all categories". Turning it on also sets Concepts' hidden
     override.
   - Then Concepts → Cy shows Concepts' switch already on, and `39998:d1` leaves the draft at once.
   - This follows the approved rules: AC-2 turns all three cards' switches, as the blueprint's `tmbAllOvToggle` does,
     and AC-1 keeps a switch through a pick. ADR 0004's Consequences accept that a switch's raw state can outlive its
     visibility. The switch is visible and says "These will be removed", so the preview is honest.
   - No change asked. It's for the owner if setting only the cards that have duties would read better.
3. **`editedTags`' JSDoc predates story 4** (`ui/src/pages/treasure-map/editTreasureMap.js:49–57`).
   - It still says "Every other tag is copied as it is", and its `@param pending` lists only the four assignment keys.
   - With an override or the backup switch on, tags are removed. The inline comment at `:86` and the module header
     (`:11–13`) say so, but the function's own contract doesn't.
   - Optional: one sentence and the two keys in the type.
4. **Two small test-accuracy points.**
   - **V10's title** (`tests/brainstorm/treasure-map-switches.spec.js:449`) says "after a pick, an Undo or Try again",
     but the test has no Try again step. Story 3's E17 carries that check, and H4 checks its timing. Optional: drop
     "or Try again" from the title, or add the step.
   - **E9's re-aim** (`tests/brainstorm/treasure-map-edit.spec.js:429–431`) runs the row's Undo from a fresh Assign to
     all. The browser no longer covers the row's Undo after a card was changed following Assign to all. P5 covers it
     in Node and H8 by hand. Optional: pick Cy on Scores before the row's Undo.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

None new.
- The Implementer's gate and build again came from an uncommitted tree (`0ae38c9f+dirty`; `dist/` built at 16:45:41,
  committed at 16:51:33). My clean rebuild matched the hash, so the existing row
  `2026-10-07-built-ui-records-no-commit` covers it and adds nothing.
- The timing-flake row `2026-10-08-realtime-wrapper-timing-flake-under-load` didn't trip, because the gate and the
  browser runs each ran alone, as asked.
- I wrote the final heading as "Close-out on a pass", so the open row `2026-10-07-on-pass-heading-reads-as-verdict`
  didn't bite.

## Verdict

**PASS**

The diff does what story 4 asks and what ADR 0004 decided:
- The override switches count and remove exactly the individually assigned duties that name someone other than the
  pending Assistant, whole.
- The All duties switch sums and turns them.
- A card's Undo after Assign to all cancels the everything change (book decision 16).
- The backup switch keeps only the first entry of every draft-grammar key across the whole Map, counted after the
  assignments and overrides, and as one change.
- Focus now lands after the render, so the button already reads its new words.

Every row of AC-4's table and every one of the owner's five defaults holds, in the tests and in my probes. The carve-out
is clean, and the two re-aims follow book decision 16 without weakening anything else. The committed tree passes the
gate (5097 passed, 0 failed) and the six browser specs (90, and 270 over three repeats), and the Phase-3 failures
reproduce for the stated reasons.

By hand, keyboard, focus rings, names, focus timing and widths from 320 to 1280 px all hold. I found no stale focus
steal. Nothing signs, publishes or stores, and every tag the edit doesn't change keeps its bytes and its place. The
four non-blocking points are an accessible-name gap that needs the owner's nod, one rule interplay recorded for the
owner, a JSDoc line and two small test details.

## Close-out on a pass

- [x] Story Status flipped to Done, in the review commit. Non-blocking 1–4 are carried to story 5 in the epic
  (`engineering-team/epics/treasure-map-edit.md`, story 5); non-blocking 1 and 2 are for the owner there.
- [x] Completion detection: run. The book isn't complete, because story 5 (Save) remains. The acceptance frame's "Edit
  on `/treasure-map`, per the blueprint" is ticked (stories 3–4).
