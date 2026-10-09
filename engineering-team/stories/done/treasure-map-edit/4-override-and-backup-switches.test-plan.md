# Test Plan: Story 4 — Edit mode: the override switches and the backup switch

**Story:** `engineering-team/stories/done/treasure-map-edit/4-override-and-backup-switches.md`
**ADR:** `engineering-team/decisions/done/treasure-map-edit/0004-switches-are-part-of-the-one-pending-edit.md`
**Date:** 2026-10-08

## Coverage map

Two new suites, plus two re-aims (§ Re-aimed tests).

- **Node:** `test/treasure-map-switches.test.js`, registered in `test/registry.js` after
  `treasure-map-edit-mode.test.js`. It holds the switch rules, the steps, the words and the wiring.
- **Browser:** `tests/brainstorm/treasure-map-switches.spec.js`, on the same stack-free recipe as story 3. It covers
  what a viewer sees and does. Its mocks and helpers are copied from `tests/brainstorm/treasure-map-edit.spec.js`,
  with story 4's Maps and words added.

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC-1 a card's override switch | I1–I4 (`individualDuties`: what counts, each key once, never `*`/`*:…`, never a duty naming only the pending Assistant); O1–O6 (`editedTags` with an override: the story's table rows 1–5; no removal without a pending card or with the switch off; every other tag kept byte for byte); T2–T3 (a change of pick keeps it; the current Assistant and Undo turn it off); V1 (when it shows, its words, off/on, the preview), V2 (recount on a new pick; Undo and the current Assistant turn it off), V3 (no switch when nothing is pending, no duties, or duties naming only the pending one) | Node, spec | unit, browser |
| AC-2 the All duties switch | A1 (`overrideAllState`: the sum, and on only when every card with duties is on); T1 (`setOverrideAll`), T4–T5 (Assign to all and its Undo turn every override off); V4 (its words, turning every card's switch, a card's own switch turning it off, the resets) | Node, spec | unit, browser |
| AC-3 a card's Undo after Assign to all | T2–T3 (decision 16 in the steps); P3 re-aimed; V5 (the row names no one and has no Undo; the card reads as before, never Mixed; "2 unsaved changes"; no `*` added), both by Undo and by picking the current Assistant; E9 re-aimed | Node, spec | unit, browser |
| AC-4 the backup switch | B1–B8 (`dropBackups`, `backupCount`: first entry per key; two spellings one key; whole-Map reach, `*:…` and unread keys included; non-grammar tags untouched; table rows 6–8); Q2–Q3 (counted after assignments and overrides; dropped from the effective pending when none are left); T1 (`setBackups`), T4–T5 (kept through Assign to all and its Undo); N1 (one change; the note counts while it's on; overrides never count); V6 (place, words, the exact draft, one change, the raw viewer unchanged), V7 (with assignments and overrides; the All duties Undo leaves it; Edit off resets it), V8 (absent without backups; singular; hidden and uncounted once an override removes the last backup) | Node, spec | unit, browser |
| AC-5 the preview | Q1–Q5 (`planEdit`: duties, backups, effective pending, the draft as `editedTags` makes it, no Map); V1 (the card reads Bea once Cy's duty is overridden), V4, V6 (the edited viewer's tags), V12 (nothing signed, published or opened) | Node, spec | unit, browser |
| AC-6 keyboards and screen readers | V1, V4, V6 (each switch's accessible name is its label and its description its note); V9 (role switch; Space and Enter turn it; focus stays); V10 (after a pick, a second pick and an Undo, the focused button already reads "Change" / "Choose an Assistant" with "Scores Will be assigned to *name*" / "Scores" when focus arrives); V11 (375 and 430 px: every switch inside the screen, no sideways scroll) | spec | browser |
| § Copy | W1 (`override`, `overrideAll`, `backups`, singular and plural), W2 (the four notes, curly apostrophes) | Node | unit |
| Wiring (ADR 0004 sub-decisions 3–4) | S1 (the hook offers `setOverride`, `setOverrideAll`, `setBackups` from the edit model), S2 (the page calls `planEdit`; its switches carry `role="switch"` and `aria-checked`; no `taPubkey`, no 64-hex literal) | Node | static |

**The API both suites name** is ADR 0004's:
- `individualDuties`, `dropBackups`, `backupCount`, `planEdit`, `overrideAllState`;
- `setOverride`, `setOverrideAll`, `setBackups`;
- the extended `editedTags`, `pickCategory`, `undoCategory`, `pickAll`, `undoAll` and `saveNote`;
- `COPY.edit.override`, `overrideAll`, `backups` (functions of N), `overrideOff`, `overrideOn`, `backupsOff`,
  `backupsOn`.

**Readings this plan pins** (the Implementer may challenge any; a change is an amendment here):
- **A duty's key, for counting and removal, is its `norm`.** Repeats of one key count once (I1), and an override
  removes every tag of a counted key, including a tag naming the pending Assistant (O3; story 4 default 1).
- **A repeat of the same Assistant on one key is a backup** (B1): "every entry keeps only its first Assistant".
- **"A draft-grammar entry" means `entryOf` parses the tag and its kind slot is 5 digits, `3038x`, `3039x` or `*`**
  (B4). So `p`, `alt`, a 6-digit slot and a non-hex Assistant are all left alone.
- **The switches are found by role.** A card's switch is the `role="switch"` inside the card. The All duties switch
  is the one inside the All duties row. The backup switch is the one named "Remove N backup Assistant(s)". Names and
  descriptions are read through `aria-labelledby` and `aria-describedby`, so the label is the name and the note is
  the description (ADR 0004 sub-decision 4).
- **The backup switch sits between the cards and the save note** (V6 checks the boxes).

## Re-aimed tests

Book decision 16 changes one behaviour story 3 tested: after Assign to all, a card's Undo used to leave the
everything entry's change pending. Two tests said so. Each is re-aimed to the new rule and is otherwise unchanged:

| Suite | Test | Was | Now |
|---|---|---|---|
| `test/treasure-map-edit-mode.test.js` | P3 | `undoCategory` removes the card's change and keeps `everything` | it removes the card's change **and** `everything`; the other cards keep theirs; the input isn't changed |
| `tests/brainstorm/treasure-map-edit.spec.js` | E9 | after Assign to all → Bea and Scores → Cy, Lists' Undo leaves "3 unsaved changes", then the row's Undo clears everything | Lists' Undo leaves "2 unsaved changes" (Scores → Cy, Concepts → Bea), the row names no one and has no Undo; a fresh Assign to all, then the row's Undo, clears everything |

**What the neighbour suites pin, checked before writing** (ledger `2026-10-07-neighbour-suite-duplicate-roles`,
"Seen again": structure as well as words):
- **Page-wide `role="switch"` queries:** none in the treasure-map suites.
- **Save-note counts:** story 3's spec uses a Map with no backups (`MAIN`), so the backup switch never shows there,
  and no count moves.
- **`editedDraft`:** the D class still calls it, and ADR 0004 keeps it (`planEdit` builds on it).
- **Button counts:** E1 counts three "Choose an Assistant" buttons by name, and the switches aren't buttons by role.
- **Tab order:** E18's runs with nothing pending, so no switch sits in it.
- **Bounds:** E16's 375/430 px bounds check lists, not switches; V11 adds the switches.

## Edge cases

- [x] **A duty that names the pending Assistant and someone else** is counted and removed whole (I1 `30383:pin:P`; O3).
- [x] **Two spellings of one key** are one key for backups (B2, B8).
- [x] **Non-grammar tags with a 64-hex second element** (`p`, `alt`, a 6-digit slot) are never backups (B4; V6's two
      `p` tags).
- [x] **The backup switch on, with nothing left to remove:** it isn't counted, and its flag drops from the effective
      pending (Q3, V8).
- [x] **An override on a card that isn't pending** removes nothing (O5).
- [x] **No Map:** no duties, no backups, and a draft with only what the assignments add (Q5).
- [x] **Garbage tags** (null, strings, short arrays) never throw (I3–I4, B4–B5).
- [x] **Inputs are never changed** (every O, B, Q and T test checks it).

## Test infrastructure

- **Node:** the built-in runner via `test/registry.js`, as story 3. The edit model is loaded as ESM from
  `ui/src/pages/treasure-map/editTreasureMap.js`, and `COPY` from `manageTreasureMap.js`.
- **Browser:** Playwright against the built UI (`cd ui && npm run build` writes `dist/`), served on :7799 by the
  handoff's static SPA server. Every `/api/*` call is mocked.
- **Maps** (in the spec):
  - **`SW_MAP`** has four backups:
    - Scores: rank → Ava with Cy as backup; `3038x:tag:X1` → Cy; `30382:tag:X2` → Bea.
    - Lists: yours, and `30396:tag:X1:T1` → Dee.
    - Concepts: yours, and `39998:restaurants` → Cy, then Bea.
    - `*:tag` and `31234:foo`, each with a backup.
    - Two `p` tags.
  - **`CURRENT_MAP`:** Scores reads Ava alone, with a duty of her own.
  - **`ONE_BACKUP_MAP`:** one backup, on a duty an override removes.
  - Story 3's `MAIN` stands for "no backups, no Scores duties".
- **No stack, no concept graph, no firmware.**

## How to run

```
npm test
npm run -s gate:status
node -e "require('./test/treasure-map-switches.test.js').run()"
```

Browser (built UI served on :7799):
```
BRAINSTORM_BASE_URL=http://localhost:7799 npx playwright test tests/brainstorm/treasure-map-switches.spec.js tests/brainstorm/treasure-map-edit.spec.js tests/brainstorm/manage-treasure-map.spec.js tests/brainstorm/manage-treasure-map-cards.spec.js tests/brainstorm/my-assistants.spec.js tests/brainstorm/my-assistants-map.spec.js --project=chromium
```

## Verification

The new tests fail with the current code (story 3's, last changed at `18ff6f92`). Confirmed on 2026-10-08 at commit
`1479550c` plus this phase's uncommitted test changes:

```
20261008T162453Z-12470-7fe3 [tme4-phase3] started 2026-10-08T16:24:53.555Z on 1479550c+dirty — FAIL, exit 1, 5063 passed, 34 failed, 581 skipped, 275/275 suites; failed: treasure-map-edit-mode, treasure-map-switches
```

- **The 34 failures:**
  - **33 in the new Node suite.** Each names what is missing:
    - "does not export individualDuties() / dropBackups() / backupCount() / planEdit() / overrideAllState() /
      setOverride() …";
    - `editedTags` ignoring `override` and `backups` (O1–O4, O6, B6–B8);
    - `undoCategory` keeping `everything` (T3);
    - `pickAll` dropping the backup switch (T4);
    - `saveNote` not counting it (N1);
    - `COPY.edit.override` "not a function";
    - the hook and page lacking the actions, `planEdit` and `role="switch"` (S1, S2).
  - **One in story 3's suite:** the re-aimed P3, where `undoCategory` still keeps `everything`.
- **One new test passes now:** O5, which checks an override removes nothing when its card isn't pending or the switch
  is off. Story 3's code removes nothing anywhere, so it passes as a guard.
- **Everything else passes.** 5063 passed is the previous total, less P3, plus O5. Nothing else moved.

**Browser, against the build of story 3's code** (`index-DKaCUHQW.js`, from `18ff6f92`): the new spec and story 3's
gives **14 failed, 19 passed**.
- **The 14:** the 13 new browser tests (V1–V12, with V11 at two widths) and the re-aimed E9. Each fails at the first
  thing story 4 adds:
  - V1, V3, V4, V6 and V8: the switch's accessible name, "element(s) not found";
  - V2, V7 and V12: clicking a switch that isn't there;
  - V5: the All duties row still names Bea after the card's Undo;
  - V9: no `role="switch"`;
  - V10: focus arrives while the button still reads "Choose an Assistant" with description "Scores";
  - V11: "Expected 5, Received 0" switches;
  - E9: no "2 unsaved changes".
- **The 19:** story 3's E1–E8 and E10–E19.

The neighbour specs (manage-treasure-map, its cards, my-assistants and my-assistants-map) aren't touched by this
plan. They pass on this build (story 3's review round 2: 77/77 with story 3's spec), and Phase 4 reruns all six.
