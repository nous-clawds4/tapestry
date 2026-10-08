# Test Plan: Story 3 — Edit mode: assign Assistants and preview the result

**Story:** `engineering-team/stories/done/treasure-map-edit/3-edit-mode-assign-and-preview.md`
**ADR:** `engineering-team/decisions/done/treasure-map-edit/0003-a-pure-edit-model-beside-the-card-rule.md`
**Date:** 2026-10-08

## Coverage map

Two new suites, plus re-aims in four existing ones (§ Re-aimed tests).

- **Node** — `test/treasure-map-edit-mode.test.js`, registered in `test/registry.js` after
  `treasure-map-star-scopes-ignored.test.js`. It holds the edit model's exact contract, the words and the wiring.
- **Browser** — `tests/brainstorm/treasure-map-edit.spec.js`, on the handoff's stack-free recipe. It covers what a
  viewer sees and does.

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC-1 Edit on/off | E1 (on: "Editing", pressed, the controls; off: gone and discarded), E2 (no Edit while loading, after an error, signed out), E3 (no Map: Edit works, the warning at the top; found: no warning), E14 (Edit again starts fresh) | spec | browser |
| AC-2 a picker per card | K1–K3 (rows: order, Local, Current, selected, detail); P1–P2 (pick, pick the current); E4 (the list), E5 (pick, Unsaved, "Will be assigned to", Undo, Change; pick the current clears), E6 (a card's Undo), E7 (one list at a time), E8 (loading, error + Try again, empty + link), E16 (375 px) | Node, spec | unit, browser |
| AC-3 All duties | P3–P6 (pickAll, undoAll, undoCategory, a card after Assign to all), N3 (currentAll); E9 (all pending, "All duties → Bea", a card after, both Undos), E10 (Current only when all three name one; picking it changes nothing) | Node, spec | unit, browser |
| AC-4 the save note | N1 (the three forms, singular and plural), W2 (the word functions); E1, E5, E6, E9 (the note as it changes), E15 (no Save changes) | Node, spec | unit, browser |
| AC-5 what an assignment changes | R-scores, R-lists, R-concepts, R-invalid, R-family (entryRole); E1–E7 (the story's table, row by row); E8–E17 (a real Map byte for byte, no-op, case, invalid, spelling and extras kept, two spellings, the everything entry, duties only, nothing pending, bare `*`); Y1–Y3 (makeRelayFor); spec E11–E13 (the drafts in the page) | Node, spec | unit, browser |
| AC-6 the preview | D1–D3 (editedDraft: no id, sig or created_at); E5 (the card previews Bea), E11 (the edited viewer: closed at first, "Unsaved draft", the draft exactly; the raw viewer still the published Map), E13 (no Map), E14, E15 (nothing signed, published or opened) | Node, spec | unit, browser |
| AC-7 story 2's review | W4 (the JSDoc says "that names anything after the `*`"); H1–H5 renamed (no "covers") | Node | static, rename |
| Wiring (ADR 0003) | W1 (§ Copy exactly), W3 (entryOf and appliesTo exported, unchanged), S1 (the edit model is pure), S2 (the edit state reads /api/assistant/my-assistants as /assistants does; signs, publishes, stores nothing; no taPubkey or literal key), S3 (the page imports the edit model and state; `const { aRelays } = useConfig()`; no taPubkey) | Node | static |

Both suites name the ADR's API, which is the contract story 4 and story 5 build on:
- `entryRole`, `FAMILY`, `editedTags`, `editedDraft`, `makeRelayFor`;
- `pickCategory`, `undoCategory`, `pickAll`, `undoAll`;
- `saveNote`, `currentOf`, `currentAll`, `pickerRows`;
- `COPY.edit.noChanges`, `assignedTo`, `allDutiesTo`, `unsavedChanges`.

W1 checks the words by value, not by key name, so the Implementer names the other keys.

**Two readings this plan pins** (the Implementer may challenge either; a change is an amendment here):
- **Apostrophes are curly** ("didn’t", "couldn’t", "Couldn’t"), as every other word on the page
  (`manageTreasureMap.js`' header). The story's § Copy and book decision 14 typed them straight; the words are
  otherwise identical.
- **The list's states render inside the list,** the element the toggle's `aria-controls` names (ADR 0003 sub-decision 4:
  the picker is a toggle with `aria-controls`; the states are the list's). The browser tests find the rows and the
  states there.

## Re-aimed tests

This story makes the Edit button exist and lets the page read the relay settings. Four existing tests said otherwise.
Each is re-aimed to keep what it still protects, and none is weakened beyond the change the story makes. Checked
before writing anything: every neighbour suite's assertions on Edit, Save changes, `useConfig` and signing (ledger
`2026-10-07-neighbour-suite-duplicate-roles`).

| Suite | Test | Was | Now |
|---|---|---|---|
| `tests/brainstorm/manage-treasure-map.spec.js` | T1 | no Edit, Save changes, Assign to all or Choose an Assistant button | **Edit** offered, `aria-pressed` false; no Editing, Save changes, Assign to all or Choose an Assistant before it's pressed |
| `tests/brainstorm/manage-treasure-map-cards.spec.js` | C1 | the same, plus no Change and no "All duties" | the same as T1, plus no Change; "All duties" still absent before Edit |
| `test/manage-treasure-map-page.test.js` | D5 | the page's own text has no Edit, Editing, Save changes, Assign to all or Choose an Assistant | no **Save changes** (story 5). The Edit words live in `COPY.edit` (ADR 0003), so the old check would have passed while saying the opposite of the page |
| `test/manage-treasure-map-cards.test.js` | S2 | no `taPubkey` and no `useConfig` in the page | no `taPubkey`; `useConfig()` only as `const { aRelays } = useConfig()`. The relay an edited entry names comes from the instance's settings (ADR 0003 sub-decision 2) |

D5 and S2 pass now (the page has neither). T1 and C1 fail now (there's no Edit button) and pass once Edit exists.

**AC-7's renames** (`test/treasure-map-card-rule-edges.test.js`): H1–H5 now read "… and `*:…` → D, which is ignored"
instead of "covers". The assertions are unchanged, and the suite header notes the rename.

## Edge cases

- [x] Folded spellings: `3038x:` own, `30382:rank:` own, `*:` as the everything entry (R, E13, E14).
- [x] An empty system slot, `30382::rank`, is individual, not own (R-scores).
- [x] The legacy `30392:<name>`, `39999:dlist-header` and a d tag with colons are individual (R-lists, R-concepts).
- [x] Invalid delegates: no role, kept as is, never a family entry (R-invalid, E11).
- [x] A Preferred already naming B, in upper case too: untouched, relay included (E9, E10).
- [x] Extra elements after the relay, and the key's own spelling, survive a move (E12).
- [x] The input is never mutated (every E row; D1; P1, P3).
- [x] No relay settings yet, an empty group, no Assistant here (Y3).
- [x] A Mixed card has no Current (N2, spec E4).
- [x] The person's Assistants load only when Edit is first used (spec E8, the request count).

## Test infrastructure

- **Test framework:** the Node built-in runner (`npm test`; registry `test/registry.js`); read the result with
  `npm run -s gate:status`. Playwright for the spec.
- **Concept Graph API:** not used. The stack isn't running in this session; no live suite is added.
- **Firmware state:** none.
- **Node fixtures:**
  - fixture pubkeys (`c1…` A, `c2…` B, `c3…` C, `d1…` D, `a2…` the Assistant here, `a1…` the viewer);
  - a `relayFor` stub that echoes who and which category it was asked for, so E rows show the relay rule;
  - `buildRows` from `/assistants`' view-model for real rows;
  - `categoryCards` for real cards.
- **Browser fixtures:**
  - a Map whose Scores are Ava's (single), Lists your own Assistant's (single), and Concepts Mixed (yours, plus Cy
    curating one list), with an ignored `*:tag` → Dee that must stay untouched;
  - an all-Ava Map (`*` → Ava);
  - no Map;
  - the person's Assistants in shuffled order;
  - relay settings for the three groups;
  - holds and failures for the Assistants read.
- **Browser recipe:** build `ui/` into `dist/`, serve it on :7799 with the handoff's static server, run
  `BRAINSTORM_BASE_URL=http://localhost:7799 npx playwright test <spec> --project=chromium`. Every `/api/*` is
  mocked; WebSockets are blocked and counted; `window.nostr.signEvent` counts calls.

## How to run

```
npm test
npm run -s gate:status
node -e "require('./test/treasure-map-edit-mode.test.js').run()"
```

Browser (built UI served on :7799):
```
BRAINSTORM_BASE_URL=http://localhost:7799 npx playwright test tests/brainstorm/treasure-map-edit.spec.js tests/brainstorm/manage-treasure-map.spec.js tests/brainstorm/manage-treasure-map-cards.spec.js tests/brainstorm/my-assistants.spec.js tests/brainstorm/my-assistants-map.spec.js --project=chromium
```

## Verification

The new tests fail with the current code. Confirmed on 2026-10-08 at commit `9366316` (plus this phase's uncommitted
test changes), full git history:

```
20261008T011837Z-21469-ab87 [tme3-phase3] started 2026-10-08T01:18:37.632Z on 93663168+dirty — FAIL, exit 1, 5016 passed, 47 failed, 581 skipped, 274/274 suites; failed: treasure-map-edit-mode
```

- **The 47 failures** are the whole new Node suite. Each names what is missing:
  - "`ui/src/pages/treasure-map/editTreasureMap.js` does not exist";
  - "COPY has no edit object";
  - "exports: entryOf undefined, appliesTo undefined";
  - the JSDoc without "that names anything after the `*`";
  - "`useMapEdit.js` does not exist";
  - the page not importing the edit model, the edit state or `aRelays`.
- **Everything else passed,** including the re-aimed D5 and S2 and the renamed H1–H5. 5016 passed is the previous
  total: nothing else moved.

**Browser, against the UI built from `c8dbd10`** (story 2's code; `ui/src` hasn't changed since), the new spec plus the
four neighbours: **18 failed, 55 passed**.
- **The 18:** the 16 new tests, and the re-aimed T1 and C1. All fail at the first look for the **Edit** button
  ("element(s) not found").
- **The 55:** every other test in the four neighbour specs.

**The pure contract can all pass:** against a scratchpad prototype of ADR 0003 sub-decisions 1–2 (`editTreasureMap.js`
and `COPY.edit`, not committed), the Node suite passes 45 of 47. The two left are S2 and S3, which need the real hook
file and page wiring. The browser spec can't be checked before there is a page. If a locator proves wrong against a
correct page, the Implementer kicks it back here and the plan records the amendment.

## Amendment 1 — Phase 4, 2026-10-08 (made in the Tester's role, in its own commit)

Running the new spec against the first build of the page, and the gate against the new page source, showed four faults
in the tests. None was in the page. Each fix keeps the test's intent; no assertion is weakened.

| Test | Fault | Fix |
|---|---|---|
| `test/manage-treasure-map-cards.test.js` S3 | It required exactly one `<pre>` in the page. ADR 0003 sub-decision 4 adds a second, the edited viewer's box, so it failed: "want one <pre> … got 2". A neighbour-suite assertion the Phase-3 grep missed, because it searched for words, not structure (ledger `2026-10-07-neighbour-suite-duplicate-roles`, "Seen again"). | The raw box is the `<pre>` named by `COPY.rawBoxLabel`, exactly once. Every `<pre>` on the page has `tabIndex` 0, role region and a name from `COPY`. |
| spec helpers `editedPre`, and E9's `allRow` | Their `has` filters used locators that start from `<main>` (`editedButton(page)`, `assignAll(page)`). Playwright looks for a `has` locator inside each candidate, so these looked for a `<main>` inside the candidates and never matched. E9 and E11–E15 failed with "element(s) not found". | The inner locators start from the page (`page.getByRole(…)`), as `editCard` already did. |
| spec E7 | It opened the Lists list while the Scores list was open. The Scores list drops down over the Lists card's button (absolute, as the blueprint draws it), so the click never landed. | Each second toggle is one the open list doesn't cover: Scores, then Assign to all (above the cards); Lists closed by its own button; Concepts, then Assign to all. The same three behaviours are checked: one list at a time, `aria-expanded`, and the button closing its own list. |
| spec E9 | After Assign to all → Bea it picked **Ava** for Scores and expected "Will be assigned to Ava". Ava is Scores' current Assistant, and AC-2 says picking the current one removes the card's change. | It picks **Cy**. "Will be assigned to Cy", then "4 unsaved changes", as before. |

After the amendment, against the build of the implementation: the new spec passes 16/16, and with the four neighbour
specs, 73/73.

## Amendment 2 — Review round 1, 2026-10-08 (made in the Tester's role, in its own commit)

Story 3's review (round 1, `engineering-team/reviews/done/treasure-map-edit/3-edit-mode-assign-and-preview.md`) found the
All duties list hanging off the left edge of the screen at phone widths (Blocking 1), and E16 couldn't see it. It also
listed non-blocking findings 1–3, 6 and 7, which the owner approved folding into the fix round ("Proceed.", 2026-10-08,
after the round-1 summary). The tests change in this commit, before any code:

| Test | Change | Why |
|---|---|---|
| E16 | Now one test per width, 375 and 430 px. At each width it opens every list (Scores, Lists, Concepts, All duties), once with nothing pending and once with Bea pending (via Assign to all). Each open list's box must lie inside the screen (`x ≥ 0`, `x + width ≤` the viewport), and the page must not scroll sideways. | Review Blocking 1b. Content pushed off the *left* edge adds no scroll width, so "no sideways scroll" alone passed with the list at x = −148 (ledger `2026-10-08-narrow-width-check-misses-left-overflow`). 430 px is the widest width the review measured the wrapped row at. |
| E8 | Adds one check: the empty state sits in a `.bsd-ma-status` element, as the loading and error states do. | Non-blocking 6: ADR 0003 sub-decision 4 names the page's status style for the lists' states. |
| E17 (new) | After a card's pick, the card's Undo, Assign to all's pick, the All duties Undo, and Try again, the list's own button has focus. After Try again the list stays open. | Non-blocking 1: each of these removes the focused element, and focus fell to `<body>`. |
| E18 (new) | Escape closes an open list and puts focus back on its button. Shift+Tab from the first row to the button keeps it open. Tabbing past the last row closes it, so focus lands on the next card's button, no longer covered. A click outside (the page heading) closes it, and closing picks nothing. A closed list's button has no `aria-controls`, or one that names an element on the page. | Non-blocking 2 (WCAG 2.2 SC 2.4.11, Focus Not Obscured) and 7. This replaces the story's Deviation 3, which had left closing on Escape or a click outside out. |
| E19 (new) | Each card's button has the card's title as its accessible description, plus "Will be assigned to *name*" while the card is pending. A card's Undo is described by the card's title, and the All duties Undo by "All duties". The save note is `aria-live="polite"`. | Non-blocking 3. The visible words, and so the buttons' names, stay the blueprint's (book decision 3). The card goes in the description, so the existing tests' exact-name locators still hold. The live note tells a screen-reader user what a pick did. |

No assertion is weakened, and E1–E7 and E9–E15 are unchanged.

**Verification.** Run against the build of story 3's reviewed code (`243483b`, bundle `index-6ILgIfjj.js`), the
amended spec gives **6 failed, 14 passed**. Each failure is the reason above:
- **E16, both widths:** "All duties, nothing pending: the list's left edge is on screen", received −147.67.
- **E8:** no `.bsd-ma-status` element around the empty state.
- **E17:** "after a card's pick", the Scores button isn't focused.
- **E18:** "Escape closes the list", but it stays visible.
- **E19:** the Scores button's description is `""`.

The 14 that pass are E1–E7 and E9–E15.
