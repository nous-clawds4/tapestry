# ADR 0004: The override and backup switches are part of the one pending edit, planned by one pure function

**Status:** Accepted
**Date:** 2026-10-08
**Story:** `engineering-team/stories/treasure-map-edit/4-override-and-backup-switches.md`
**Approved:** by the owner, 2026-10-08, verbatim: "Ready for test design."
**Builds on:** ADR 0003 (the pure edit model, `useMapEdit`, the page). It supersedes ADR 0003 sub-decision 2's
`undoCategory` and `pickCategory` in part (book decision 16).

## Context

Story 3 built Edit mode as a pure edit model (`ui/src/pages/treasure-map/editTreasureMap.js`). The page holds one
`pending` value, `{ scores?, lists?, concepts?, everything? }`, in `useMapEdit`. Each step function returns a new one,
and `editedTags(tags, pending, relayFor)` turns it into the Map Save would sign:
- each category's own entries move to its new Assistant, in place;
- the family entry is added when the Map has none;
- every other tag keeps its bytes and its place.

The model reads keys with the card rule's own reader, `entryOf` and `appliesTo`. `entryRole(category, tag)` already
sorts a category's entries into `'own'` and `'individual'`. A `*` or `*:…` entry has no role.

Story 4 adds three switches and one change of behaviour:
- **A card's override switch (AC-1):** shown when the card is pending and its category has individually assigned
  duties naming anyone other than the pending Assistant. On, those duties leave the Map whole.
- **The All duties override switch (AC-2):** the sum over the three cards, and it turns all three on or off.
  Picking in Assign to all, and the All duties Undo, turn every override off.
- **Decision 16 (AC-3):** after Assign to all, a card's Undo, or picking its current Assistant, also cancels the
  everything entry's change.
- **The backup switch (AC-4):** counted on the Map as the assignments and overrides leave it. On, every draft-grammar
  key keeps only its first entry, across the whole Map. It counts as one change, and while it's on the save note
  counts. The All duties Undo leaves it as it is.

Also:
- **The preview (AC-5)** follows every switch.
- **AC-6:** focus after a pick, an Undo or Try again lands once the button already reads its new words (story 3
  review round 2, non-blocking 1).

**Facts the design rests on:**
- **What an entry is.** The draft grammar's entry is `["<key>", "<assistant pubkey>", "<relay>"]`
  (`protocols/drafts/treasure-maps.md` § 3). Its kind slot is `5DIGIT / "3038x" / "3039x" / "*"` (§ 4.7).
- **Order within a key.** Several entries may share one key; the first is Preferred and the rest are Alternates (§ 7).
  The backup switch removes the Alternates.
- **What `entryOf` accepts.** It parses any tag with a string key and a 64-hex second element
  (`manageTreasureMap.js:144–161`), including tags that aren't Treasure Map entries, such as a `p` tag. So the switch
  must check the kind slot itself, or it would treat a second `p` tag as a backup.
- **How the card rule folds keys.** `norm` folds spellings: `39998:dlist-header` is `39998`, and trailing empty
  segments drop. The card rule already treats two spellings as one key, and the story says the switch does too.
- **What must stay untouched.** CLAUDE.md principle 4 and the epic's guardrail: everything an edit doesn't change keeps
  its bytes and its place. The override switches and the backup switch are the only removals.

No concept definitions change. The stack wasn't running, so no handles were checked; none are cited.

## Options considered

### Option A — the switches are part of the one `pending` value, and one pure `planEdit` derives everything (chosen)

`pending` gains two optional keys: `override` (`{ scores?: true, lists?: true, concepts?: true }`) and `backups`
(`true`). The step functions own every interaction:
- an Undo, or picking a card's current Assistant, turns that card's override off and cancels the everything entry's
  change;
- Assign to all and its Undo turn every override off and keep `backups`.

A new pure `planEdit({ event, viewer, pending, relayFor })` returns, in one pass:
- the duties each card's switch counts;
- the backups the backup switch would remove;
- the `pending` that takes effect;
- the draft.

The page renders from that.
- **Pros:**
  - Every rule is in one Node-testable module, as ADR 0003 chose.
  - Leaving Edit mode or changing viewer already clears everything, because both reset `pending`.
  - Story 5 signs `planEdit(…).draft`, so preview and Save can't drift.
- **Cons:**
  - `pending` is no longer a flat map of pubkeys, so the step functions and `saveNote` must ignore or carry the two
    new keys.
  - One test of story 3 (P3) asserts the behaviour decision 16 changes.

### Option B — the switches as separate hook state beside `pending`

`useMapEdit` holds `override` and `backups` beside `pending`, and the page filters the draft.
- **Pros:** `pending`'s shape is unchanged.
- **Cons:**
  - The couplings would live in the hook, out of reach of the Node suite: an Undo turning its override off, Assign to
    all resetting overrides, its Undo leaving `backups`.
  - Three values must be reset together on Edit off and on a viewer change.
  - Save would need to gather them again.

### Option C — apply the switches as a post-pass in the page

The page filters `editedDraft`'s tags in `Index.jsx`.
- **Pros:** the smallest diff.
- **Cons:**
  - Removal rules would be in JSX, untested in Node.
  - Counting would be separate from removal, so a switch's N could disagree with what it removes.

## Decision

We chose **Option A**, because it keeps every rule in the pure model ADR 0003 set up, keeps one value to reset, and
gives preview and Save one function.

1. **The pending value** (`editTreasureMap.js`). The shape is
   `{ scores?, lists?, concepts?, everything?, override?, backups? }`:
   - The four assignment keys are lowercase hex pubkeys, as now.
   - `override` is `{ scores?: true, … }`.
   - `backups` is `true`.

   Rules for every step:
   - It returns a new value and never changes its input.
   - It never leaves an empty `override` object or a `false` flag behind; it deletes the key instead. So a value with
     no switches set is exactly story 3's shape.

   The steps:
   - **`pickCategory(p, category, pubkey, current)`:**
     - Another Assistant sets `p[category]`, keeping its override as it was.
     - The current one deletes `p[category]`, `p.everything` and `override[category]` (decision 16).
   - **`undoCategory(p, category)`:** deletes `p[category]`, `p.everything` and `override[category]` (decision 16).
   - **`pickAll(p, pubkey, currentAll)`:** sets the three cards and `everything` to `pubkey`, drops `override`, and
     keeps `backups`. Picking `currentAll` keeps only `backups`.
   - **`undoAll(p)`:** keeps only `backups`. With no argument it returns `{}`, as now.
   - **`setOverride(p, category, on)`.**
   - **`setOverrideAll(p, on)`:** all three categories on or off, as the blueprint's All switch does.
   - **`setBackups(p, on)`.**
2. **The rules for the switches** (`editTreasureMap.js`, pure):
   - **`individualDuties(tags, category, pubkey)`:** the `norm`s, in first-seen order and each once, of the category's
     individual entries (`entryRole === 'individual'`) that have some valid tag naming a pubkey other than `pubkey`.
     These are what a card's switch counts (N) and removes. `*` and `*:…` entries have no role, so they are never
     counted (book decision 11).
   - **`dropBackups(tags)`:** keeps, for each `norm`, the first tag that `entryOf` parses *and* whose kind slot is
     5 digits, `3038x`, `3039x` or `*` (draft grammar § 4.7). Every later such tag is removed. Every other tag stays,
     including ones `entryOf` rejects and non-grammar keys such as `p`. Order is kept.
   - **`backupCount(tags)`:** how many tags `dropBackups` removes. A second entry naming the same Assistant counts:
     "every entry keeps only its first Assistant".
   - **`editedTags(tags, pending, relayFor)`** gains two passes after story 3's moves and additions, and the input is
     still never changed:
     1. For each category with `pending[category]` and `pending.override?.[category]`, every tag that is one of that
        category's individual entries, with its `norm` in `individualDuties(tags, category, pending[category])`, is
        removed. Duties are counted on the input tags, which the assignments don't touch.
     2. If `pending.backups`, `dropBackups`.
   - **`planEdit({ event, viewer, pending, relayFor })`** returns `{ duties, backups, pending, draft }`:
     - `duties`: for each category, `individualDuties(...)` against its pending Assistant, or `[]` when not pending.
     - `backups`: `backupCount(editedTags(tags, { ...pending, backups: undefined }, relayFor))`. These are the
       backups left after the assignments and overrides.
     - `pending`: the input without `backups` when `backups` is 0. A backup switch with nothing to remove changes
       nothing and isn't counted.
     - `draft`: `editedDraft` with that effective `pending`.
   - **`overrideAllState(duties, pending)`:** `{ count, on }`. `count` is the sum of the duties of every pending
     category. `on` is true when every category with duties has its override on. The page shows the All switch when
     `pending.everything` and `count > 0`.
   - **`saveNote(pending, nameOf)`** counts the pending cards, the everything entry, and `backups` as one change.
     "All duties → *name*" only when `backups` isn't set (story 4 default 4). Overrides never count (default 2).
     The page passes the effective `pending`.
   - **`COPY.edit` gains:**
     - `override(n)`: "Override N individually assigned duty" or "duties".
     - `overrideAll(n)`: the same, plus " across all categories".
     - `overrideOff`: "Kept as they are; they take priority over this assignment."
     - `overrideOn`: "These will be removed from your Treasure Map."
     - `backups(n)`: "Remove N backup Assistants", or "Remove 1 backup Assistant".
     - `backupsOff`: "Kept as they are. Apps use a backup when an entry’s first Assistant can’t be reached."
     - `backupsOn`: "Every entry keeps only its first Assistant, including entries not shown on this page."

     All are the blueprint's or the owner's words, with curly apostrophes as elsewhere in `COPY`.
3. **The hook** (`useMapEdit.js`) gains three actions, `setOverride(category, on)`, `setOverrideAll(on)` and
   `setBackups(on)`, each a `setPending` through its step. Nothing else changes: Edit off and a viewer change already
   reset `pending`, and with it every switch.
4. **The page** (`Index.jsx`):
   - **Computing.** `ManageTreasureMapPage` computes `plan = planEdit(...)` once, in place of `editedDraft`.
     `plan.draft` feeds the cards' preview and `EditedRawViewer`. `plan.pending` feeds the save note. `plan.duties`
     and `plan.backups` drive the switches.
   - **`Switch({ id, label, note, on, onToggle })`:**
     - a `<button type="button" role="switch" aria-checked>` with `aria-labelledby` its label span and
       `aria-describedby` its note span, so its name is the label and its description the note (AC-6);
     - a track and knob (`aria-hidden`) as the blueprint draws them;
     - it stays mounted while shown, so focus stays on it when it turns, and Space and Enter work as a button's do.
   - **A card's switch:** under its picker row inside the card, when `pending[key]` and `plan.duties[key].length > 0`.
   - **The All duties switch:** inside the All duties row, on its own line (`flex: 1 1 100%`), when
     `pending.everything` and `overrideAllState(...).count > 0`.
   - **The backup switch:** between the cards and the save note, when `plan.backups > 0`.
   - **Focus after the render (AC-6):** a pick, Try again and Escape (in `Picker`) and an Undo (in `CategoryCards`)
     record which button wants focus in a ref. An effect that runs after every render then focuses that button and
     clears the ref. Each of these actions updates state, so a render always follows, and by then the button reads
     its new words and description. This replaces story 3's synchronous `focus()` calls.
5. **Styles:** `.bsd-tm-edit-switch` in the `.bsd-tm-edit-*` block, from the blueprint:
   - a full-width row: radius 12, `1px solid #e8eae7`, white, padding 10/12, gap 12, `#fafaf9` on hover;
   - 13 px/600 label and 12 px muted note, both wrapping (`min-width: 0`, `overflow-wrap: anywhere`);
   - a 36×20 track, `#d6d9db` off and `--accent` on, with a 16 px white knob.

   Every switch lies inside the screen at 375 and 430 px.

## Consequences

- **What this enables.**
  - Story 5 signs `planEdit(…).draft`, exactly what the preview shows.
  - Story 5's "a pick that leaves the Map byte-identical" check can compare `plan.draft.tags` with the published tags.
- **Story 3's behaviour changes in one place (book decision 16).** After Assign to all, a card's Undo or a pick of its
  current Assistant also cancels the everything change. Story 3's AC-3 sentence "Its Undo removes only that card's
  change" no longer holds while Assign to all is pending. ADR 0003 gets a supersession note (Implementation notes).
- **The backup switch reaches keys this page never shows,** including `*:…` entries (book decisions 8 and 11). It
  reaches only draft-grammar keys, so it never touches a non-entry tag.
- **Removals can drop entries the legacy generators would write back.** Like story 3's moves, an override or a dropped
  backup on a `30382:*` row can be undone by a later regenerate from the legacy pages (ledger
  `2026-10-08-legacy-generators-overwrite-edited-scores`). Nothing new to record.
- **A switch's raw state can outlive its visibility.** The backup switch, on, that hides when N becomes 0 shows again,
  still on, if an override is turned off and backups return. A card's override stays set across a change of pick.
  Both follow the story ("keeps the switch as it was"). Neither has any effect while hidden.
- **Firmware reinstall required?** No.

## Implementation notes

- **`ui/src/pages/treasure-map/editTreasureMap.js`:**
  - Add `individualDuties`, `dropBackups`, `backupCount`, `planEdit`, `overrideAllState`, `setOverride`,
    `setOverrideAll` and `setBackups`.
  - Extend `editedTags`, `pickCategory`, `undoCategory`, `pickAll`, `undoAll` and `saveNote` as sub-decisions 1–2
    say. `PENDING_KEYS` stays the four assignment keys.
  - A private `GRAMMAR_SLOT = /^(\d{5}|3038x|3039x|\*)$/` tests the kind slot (`entryOf(tag).slot`).
  - Keep the module's import list `.js`-suffixed.
- **`ui/src/pages/treasure-map/manageTreasureMap.js`:** the `COPY.edit` additions of sub-decision 2. Nothing else
  changes there.
- **`ui/src/pages/treasure-map/useMapEdit.js`:** the three actions.
- **`ui/src/pages/treasure-map/Index.jsx`:**
  - `planEdit` in place of `editedDraft`;
  - `Switch`, and the three switches;
  - the focus-after-render ref and effect, replacing the synchronous `focus()` calls in `Picker`'s `andFocus` and
    the Undo handlers.
- **`ui/src/styles.css`:** `.bsd-tm-edit-switch` and its parts.
- **`engineering-team/decisions/treasure-map-edit/0003-…md`:** a supersession note under its Status. It says that
  sub-decision 2's `undoCategory`, and `pickCategory` picking the current Assistant, now also cancel the everything
  entry's change (book decision 16, this ADR).
- **Test re-aims for Phase 3** (the Tester's lane, before any code):
  - `test/treasure-map-edit-mode.test.js` P3 asserts `undoCategory` keeps `everything`.
  - `tests/brainstorm/treasure-map-edit.spec.js` E9 expects "3 unsaved changes" and the All duties **Undo** after a
    card's Undo following Assign to all.

  Both follow decision 16. The Tester should also grep the neighbour suites for anything that pins:
  - `pending`'s flat shape;
  - the save note's "All duties →" form;
  - one `<button>` per card row;
  - a page-wide `role="switch"` query.
- **For the tests (Tester's choice):**
  - AC-6's "words at focus time" can be observed with a `focusin` listener, added by `page.evaluate`, that records
    the focused button's text and `aria-describedby` text when focus arrives.
  - AC-4's whole-Map reach needs a fixture with a backup on a `*:…` key and on a key this page doesn't read (for
    example `30385:foo`), plus a non-grammar tag with a hex second element (for example `["p", <hex>]`, twice). That
    tag must survive the switch untouched.

## Out of scope

- **Save** and its checks (story 5).
- **Reordering or choosing backups** (the Advanced page, a later book).
- **Any change to the card rule** (`categoryAssistants`) or to the draft grammar.
- **Removing individually assigned duties** without a pending assignment.
