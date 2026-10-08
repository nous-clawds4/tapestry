# ADR 0003: Edit mode is a pure edit model beside the card rule, driven by one page-level edit state

**Status:** Accepted
**Date:** 2026-10-08
**Story:** `engineering-team/stories/treasure-map-edit/3-edit-mode-assign-and-preview.md`

## Context

Story 3 adds the blueprint's Edit mode to `/treasure-map`, without Save. Its acceptance criteria, in short:

- **AC-1:** an **Edit** / **Editing** toggle beside the Assistants by category heading, once the Map has been read
  (found or none). Leaving Edit discards unsaved changes. With no Map, the no-Map warning (book decision 14).
- **AC-2:** a picker per card listing the person's Assistants (the My Assistants list): Local first, **Current**, a
  check mark; pending → **Unsaved**, "Will be assigned to *name*", **Undo**, **Change**. It has loading, error, Try again
  and empty states, and only one list is open at a time.
- **AC-3:** **All duties** / **Assign to all**: all three cards and the plain `*` entry pending to one Assistant;
  Undo removes everything; a later card change touches only that card.
- **AC-4:** the save note: "No changes yet", "All duties → *name*", "N unsaved change(s)".
- **AC-5:** what an assignment writes (book decisions 12 and 15). The category's own entries get the new Assistant in
  place, backups stay, the family entry is added when missing, individually assigned duties stay, and everything else
  is kept byte for byte. The story's table has seven rows.
- **AC-6:** the cards preview the edited Map; "View the raw Treasure Map — edited" shows it exactly as Save would sign
  it, with no id or signature; the original raw viewer is unchanged. Nothing signs, publishes or stores.
- **AC-7:** story 2's review non-blocking 1 (a JSDoc) and 3 (H1–H5's names).

**Concept Graph:** the stack wasn't running (AGENTS.md § 2 fallback). No concept changes. **Firmware reinstall: not
required.**

Facts from the code this decision rests on:

- **The page** (`ui/src/pages/treasure-map/Index.jsx`):
  - `ManageTreasureMapPage` (line 245) reads the Map once with `useTreasureMap(viewer, { strict: true })` and derives
    `phase` with `mapPanelPhase`.
  - `CategoryCards` (line 192) computes `categoryAssistants(event)`, looks the names up with `fetchProfilesChunked`
    keyed on the set of Assistants, and shows the cards only once the names are in (manage-treasure-map ADR 0002 W1).
  - `RawViewer` (line 130) has no key (ADR manage-treasure-map/0002 Amendment 2).
  - The signed-out branch replaces the section and the viewer, so signing out unmounts them.
- **The card rule** (`ui/src/pages/treasure-map/manageTreasureMap.js`, ADRs treasure-map-edit/0001–0002):
  - `entryOf(tag)` gives `slot`, `segments`, `concept` and `norm`;
  - `appliesTo(category, entry)` says which category an entry reaches; a `*:…` entry reaches none;
  - both are module-private today. ADR 0001's Consequences left exporting them to this ADR.
- **The person's Assistants:**
  - `/assistants` loads `GET /api/assistant/my-assistants` (`ui/src/pages/assistants/Index.jsx:62–78`), then
    `fetchProfilesChunked` for the rows, then `buildRows({ rows, profiles })` (`myAssistants.js:165`): Local first,
    then by name.
  - `cardFields` (`myAssistants.js:139`) gives `name`, `initial`, `url` (website or `'—'`), `nip05` (or `'—'`) and
    `npubShort`.
  - The answer marks the viewer's own Assistant here `local: true`, from the server's per-user lookup.
- **Relays in Map entries:** the app's Map writers put the person's own Assistant's relay in element 3 from the
  instance's relay settings:
  - `useConfig().aRelays`: `aTrustedListRelays[0]` in `TlOptInCard.jsx:42`, `aDListRelays[0]` in
    `DListCurationPanel.jsx:39`;
  - `''` when unknown, which the draft grammar allows (§ 3).
  - The groups are listed in `ui/src/pages/settings/RelaySettings.jsx:7–19`, including `aTrustedAssertionRelays` for
    kinds 30382–30385.
- **The existing write helpers don't fit:**
  - `upsertGenericTlTag` and `upsertDListEntry` (`ui/src/utils/treasureMap.js:121, 181`) replace every tag of a key,
    which drops its backups, and append the new one;
  - they read keys with `classifyEntry`, which doesn't know `3038x`, `3039x` or `*`.
- **Prototype check:** a scratchpad prototype of sub-decision 2's `editedTags` (not committed) gives exactly the
  story's seven AC-5 rows. It leaves a Map untouched when every own entry already names the chosen Assistant.

## Options considered

### Option A — a pure edit model in its own module, beside the card rule; one edit state in the page (chosen)

`editTreasureMap.js` (new, pure, Node-loadable) holds every rule the story names: which entries a category owns, the
edited tags, the draft, the save note, the pending-change steps and the picker rows. It imports `entryOf` and
`appliesTo`, now exported from `manageTreasureMap.js`. A `useMapEdit` hook in the page holds the edit state, and
`Index.jsx` renders the controls.

- **Pros:**
  - the rules story 3 adds, and story 4's switches after it, are Node-testable without a browser, as the card rule
    is;
  - the card rule and the edit model share one key reader, so a key that counts on a card is the key an edit rewrites;
  - the page stays a renderer.
- **Cons:**
  - `manageTreasureMap.js` gains two exports that are internals of the card rule;
  - the page grows by several components.

### Option B — put the edit model inside `manageTreasureMap.js`

- **Pros:** no new exports; one module for every Treasure Map rule on the page.
- **Cons:** that module already holds the words, the panel phases, the card rule and the cards. Adding the edit
  model, then story 4's switches, makes it the page's everything-file. Its test suites (two, soon three) would keep
  re-loading one growing module.

### Option C — build edits from the existing write helpers in `ui/src/utils/treasureMap.js`

- **Pros:** reuses tested writers already used by the TA Treasure Map page.
- **Cons:**
  - they drop a key's backups, but AC-5 keeps them and only story 4's switch removes them;
  - they read keys with `classifyEntry`, which treats `3038x`, `3039x` and `*` as `other`;
  - they write one key at a time, with no notion of "the category's own entries".

  Teaching them all three would change the TA Treasure Map page's writers.

## Decision

We chose **Option A**. It keeps every rule of the story in one pure module the tests can walk, shares the card rule's
key reader, and leaves the TA Treasure Map page's writers untouched.

Sub-decisions:

1. **`manageTreasureMap.js`:**
   - `entryOf` and `appliesTo` become named exports, unchanged in behaviour;
   - the JSDoc of `categoryAssistants` says a `*:…` entry "that names anything after the `*`" never counts (AC-7);
   - `COPY` gains an `edit` object with every word of story 3's § Copy, exactly. Some are functions of a name or count:
     `assignedTo(name)`, `allDutiesTo(name)`, `unsavedChanges(n)` ("1 unsaved change" / "N unsaved changes").

2. **`ui/src/pages/treasure-map/editTreasureMap.js`** (new, pure; imports only `.js`-suffixed modules):
   - **`entryRole(category, tag)` → `'own'` | `'individual'` | `null`.** Only tags that `entryOf` accepts and that
     `appliesTo(category, …)` reaches have a role; a bare `*` has none, since it's the everything entry, not a
     category's.
     - **Scores:** `own` when the slot is `3038x` or a kind 30380–30389 and the folded `segments` are empty or a single
       word that isn't a system word (`tag`, `pin`, `dlist`, `contexts`). So `30382:rank` and `3038x:rank` are own,
       and `30382:tag:…` is individual.
     - **Lists:** `own` when the slot is `3039x` or a kind 30390–30399 with no segments; anything longer is
       individual.
     - **Concepts:** `own` when `norm` is `39998` (bare, or `39998:dlist-header`) or `39999`; every `39998:<d>` and
       `39999:<d>` is individual.
   - **`FAMILY = { scores: '3038x', lists: '3039x', concepts: '39998' }`.**
   - **`editedTags(tags, pending, relayFor)` → a new array; the input is never changed.** `pending` is
     `{ scores?, lists?, concepts?, everything? }` (lowercase hex pubkeys). Steps:
     1. Copy every tag as it is.
     2. For each category with a pending Assistant B, in the order Scores, Lists, Concepts: for each own key (by
        `norm`), in Map order, take its first valid tag, the Preferred one. If that tag doesn't already name B,
        replace it at the same index with `[tag[0], B, relayFor(B, category), ...tag.slice(3)]`: the key keeps its
        own spelling, and extra elements stay. Later tags of that key (backups) and invalid tags are untouched. If no
        valid tag has the family `norm`, append `[FAMILY[category], B, relayFor(B, category)]`.
     3. If `pending.everything` is B: the first valid tag with `norm` `*` gets B the same way, with relay `''`, or
        `['*', B, '']` is appended.

     Nothing else is touched, so individually assigned duties, other categories, `*:…` entries, invalid tags and
     unread tags keep their bytes and their index (AC-5). Appended entries go at the end, in the order above.
   - **`editedDraft({ event, viewer, pending, relayFor })` → `{ kind: 10040, pubkey: viewer, content, tags }`.**
     `content` is the event's (`''` with no Map), and `tags` is `editedTags(event ? event.tags : [], …)`. There is no
     `id`, `sig` or `created_at`; story 5 stamps and signs.
   - **`makeRelayFor({ localPubkey, aRelays })` → `(pubkey, category) => string`.** For the viewer's own Assistant
     here, the first configured relay of the category's group: `aTrustedAssertionRelays` for Scores,
     `aTrustedListRelays` for Lists, `aDListRelays` for Concepts. Otherwise `''`, and always `''` for `*`. Never
     throws on a missing `aRelays`.
   - **The pending steps, all pure and returning a new object:**
     - `pickCategory(pending, category, pubkey, current)`: removes that category's change when `pubkey === current`,
       else sets it;
     - `undoCategory(pending, category)`: removes that category only;
     - `pickAll(pending, pubkey, currentAll)`: `{}` when `pubkey === currentAll`, else all four set to `pubkey`;
     - `undoAll()`: `{}`.
   - **`saveNote(pending, nameOf)`:**
     - `COPY.edit.noChanges` when nothing is pending;
     - `allDutiesTo(name)` when all four are set to one Assistant;
     - otherwise `unsavedChanges(n)`, with `n` the number set.
   - **`currentOf(card)` / `currentAll(cards)`:**
     - `currentOf` is the card's one person's pubkey when `state === 'single'`, else null;
     - `currentAll` is that pubkey when all three cards are single and name the same one, else null.

     Both come from the cards of the published Map, never the preview.
   - **`pickerRows(rows, { current, selected })`:** the `buildRows` rows in their order, each with `pubkey`, `name`,
     `initial`, `local`, `current: pubkey === current`, `selected: pubkey === (selected || current)`, and `detail`:
     `url` unless `'—'`, else `nip05` unless `'—'`, else `npubShort`.

3. **`useMapEdit({ viewer })`**, a hook in `ui/src/pages/treasure-map/useMapEdit.js`, owned by `ManageTreasureMapPage`
   because both the section and the edited raw viewer read it. It holds:
   - `editing`, `pending` and `openPicker` (`'all'` | a category | null);
   - the Assistants load: `{ phase: 'idle'|'loading'|'ready'|'error', rows, profiles }`.

   Its behaviour:
   - **Turning Edit on** loads the Assistants the first time, the way `/assistants` does: the same endpoint, then
     `fetchProfilesChunked`, then `buildRows`. An answer with `signedIn !== true` counts as an error. Try again
     reloads.
   - **Turning Edit off** clears `pending` and `openPicker`.
   - **When `viewer` changes**, everything resets, Assistants included, so one person's choices never reach another's
     Map (the top-bar edge of ledger `2026-10-07-top-bar-sign-in-while-loading`).

   It reads, signs, publishes and stores nothing else.

4. **The page** (`Index.jsx`):
   - **Header:** the section's header becomes a row with the `h2` and an `EditButton` (`aria-pressed`, "Edit" /
     "Editing"), shown only when the cards are shown: phase `found` or `none` and the names in. It is never shown
     while loading, after an error or signed out (AC-1).
   - **In Edit mode, in order:**
     - the no-Map warning when phase is `none`, as a note (`role="note"`);
     - the **All duties** row;
     - the cards, each with its picker row;
     - the save note.

     The Mixed line stays under the cards, as now.
   - **Preview (AC-6):** in Edit mode the cards are `categoryCards` over
     `categoryAssistants(editedDraft(…))`. Names come from the published Map's lookup (unchanged, still keyed to the
     published Map's Assistants), merged with `useMapEdit`'s row profiles. Every Assistant a preview can add is a
     picker row, so the cards never go back to the loading line while editing.
   - **The picker:**
     - a toggle button (`aria-expanded`, `aria-controls`);
     - a `<ul>` of row buttons (`aria-pressed` true on the selected one), each with the avatar letter, the name, the
       **Local** / **Current** badges, the detail line, and a check icon (`aria-hidden`) when selected;
     - picking calls the step of sub-decision 2 and closes it;
     - its loading, error with Try again, and empty states use `.bsd-ma-status`, as the page's other states do; the
       empty state links to `/assistants`.
   - **A pending card** gets `is-pending` (the blueprint's accent border and tint), the **Unsaved** chip, "Will be
     assigned to *name*" and **Undo**, and its button reads **Change**.
   - **`EditedRawViewer`:**
     - rendered under `RawViewer` only in Edit mode, so it mounts closed each time Edit turns on;
     - a toggle ("View / Hide the raw Treasure Map — edited") with the **Unsaved draft** chip;
     - opened, a `<pre>` of `rawMapText(editedDraft(…))`, focusable and named like the raw box.

     `RawViewer` itself is unchanged and keeps showing the published Map.
   - **Nothing new signs or publishes:** the page imports no signer or publish helper (story 5 adds Save).

5. **Styles:** a `.bsd-tm-edit-*` block after `.bsd-tm-cat-*` in `ui/src/styles.css`, using the variables the page
   already uses (`--accent`, `--text`, `--text-muted`, `--bsd-faint`, `--border`). From the blueprint:
   - **Edit button:** 32 px pill, 13 px/600, accent fill when pressed.
   - **All duties row:** radius 16, `1px dashed #c4b5fd`, `#faf8ff`, padding 14/18.
   - **Pickers' button:** 34 px pill, accent outline (Assign to all filled).
   - **Picker list:** absolute, 300 px wide and `max-width: calc(100vw - 48px)`, radius 14, `0 8px 24px
     rgba(10,14,24,.12)`, rows 10/12 with `#f0f1ee` separators, selected `#faf8ff`, 28 px avatar.
   - **Badges:** 10 px/700 uppercase; Local on `rgba(114,55,255,.10)`.
   - **Unsaved and Unsaved draft chips:** `rgba(114,55,255,.12)` on `#5b21d6`.
   - **Pending card:** `1.5px solid` accent on `#faf8ff`.
   - **Save note:** 13 px, `--bsd-faint`, right-aligned.

   Nothing scrolls sideways at 375 px.

## Consequences

- **Enables:**
  - story 4 adds the switches as more inputs to `editedTags` (removals) and more steps in `useMapEdit`;
  - story 5 signs `editedDraft` after stamping `created_at` (the replaceable-event rule `restamp` already follows).
- **Constrains:**
  - two internals of the card rule are now exports. A change to `entryOf` or `appliesTo` changes both the cards and
    the edit, by design; the two share one reading of a key.
- **Known limits, accepted:**
  - a `relayFor` of `''` for any Assistant other than the one here, as the app's other writers do;
  - family entries that readers outside the draft grammar don't read (book decision 15);
  - the older generators rewriting `30382:*` rows (ledger `2026-10-08-legacy-generators-overwrite-edited-scores`).
- **Firmware reinstall required?** No.

## Implementation notes

- **`ui/src/pages/treasure-map/manageTreasureMap.js`:** sub-decision 1.
- **`ui/src/pages/treasure-map/editTreasureMap.js`** (new): sub-decision 2. Same header style as `manageTreasureMap.js`;
  no React, no `fetch`, no signing or storage.
- **`ui/src/pages/treasure-map/useMapEdit.js`** (new): sub-decision 3. It is the only new file that fetches; reuse
  `fetchProfilesChunked` and `buildRows`.
- **`ui/src/pages/treasure-map/Index.jsx`:** sub-decision 4. New imports: `useConfig` (for `aRelays`), the edit model,
  `useMapEdit`. Never `taPubkey` or a literal key: the Assistant here is `user.assistantPubkey` and the rows' `local`.
- **`ui/src/styles.css`:** sub-decision 5.
- **For the Tester (Phase 3):**
  - **Node, the edit model** (a new suite):
    - `entryRole` over a table of keys per category: own and individual cases, `*`, `*:…`, invalid delegates, folded
      spellings;
    - `editedTags` over every row of AC-5's table. Also: untouched tags equal byte for byte and at the same index; no
      change when the Preferred already names B; backups and invalid tags kept; extra elements kept; append order;
      the input array not mutated; `relayFor` used for own entries and `''` for `*`;
    - `editedDraft`'s shape (no `id`, `sig` or `created_at`; `content` kept; no Map gives `''` and new tags only);
    - `makeRelayFor` (the Assistant here per category, another Assistant, missing `aRelays`);
    - the pending steps (including picking the current one, and a card after Assign to all);
    - `saveNote`'s three forms and singular/plural; `currentOf` / `currentAll`;
    - `pickerRows` (order kept, badges, `detail` fallbacks, `selected`).
  - **Node, words and wiring:**
    - `COPY.edit` holds § Copy exactly;
    - `entryOf` and `appliesTo` are exported;
    - source sentinels: the page and `useMapEdit.js` import no signer or publish helper, and use no `taPubkey` or
      64-hex literal.
  - **Playwright** (a new spec), on the handoff's recipe. Mock `/api/assistant/my-assistants` (rows with `local`),
    `/api/profiles` and the Map read.
    - Edit appears for found and none, never while loading, after an error or signed out. On, then off, discards.
    - The card picker: order, Local and Current, the check, Unsaved, "Will be assigned to", Undo, Change; picking the
      current Assistant clears; one list at a time.
    - All duties: "All duties → *name*"; a later card change gives the count; both Undos.
    - The picker's loading, error and Try again, and empty states.
    - The preview: a card reads the new Assistant; the edited raw viewer starts closed and, opened, shows the
      expected tags. The original raw viewer is unchanged.
    - The no-Map warning.
    - Nothing signed: `window.__signCalls` stays 0, and no publish request.
    - 375 px: no sideways scroll with a list open.
  - **AC-7:** rename H1–H5 in `test/treasure-map-card-rule-edges.test.js` so the names no longer say "covers"; the
    assertions don't change.
  - **Must stay green:** the treasure-map Node suites (page, cards, rule edges, star scopes) and the four browser specs
    (manage-treasure-map ×2, my-assistants ×2). Scope new locators to the Edit controls' own section (ledger
    `2026-10-07-neighbour-suite-duplicate-roles`).

## Out of scope

- The override and backup switches (story 4), and Save, signing and publishing (story 5).
- Changing `classifyEntry`, the TA Treasure Map page's writers, or the older generators.
- Remembering unsaved changes across Edit, reloads or navigation.
