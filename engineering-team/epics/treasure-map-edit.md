# Epic: treasure-map-edit — Edit mode on the Manage your Treasure Map page

**Status:** Active
**Created:** 2026-10-07
**Book:** `engineering-team/audits/treasure-map-edit/book.md` (no PRD — acceptance frame)
**Blueprint:** the Claude Design artifact's "Manage your Treasure Map" screen and its Edit mode, kept as it stood at
the previous book's intake in `engineering-team/audits/manage-treasure-map/blueprint/`.
**Builds on:** the closed `manage-treasure-map` epic (`/treasure-map`, view-only), on staging, not yet on main.

## Goal

**A signed-in person changes who looks after their Scores, Lists and Concepts, and signs the new Treasure Map, from
`/treasure-map`.** Edit opens the blueprint's controls: an Assistant per category or one for All duties, override
switches for individually assigned duties, one switch that clears backup Assistants, Undo, a save note, and the edited
raw Treasure Map. Save signs a new kind 10040 with the person's own signer and publishes it.

## Stories

1. **The cards' counting rule, fixed for the draft grammar's three edge cases** (bug; ledger
   `2026-10-07-treasure-map-card-rule-edge-cases`): `1-the-card-rule-edge-cases.md`. Done.
2. **The cards ignore an everything entry that goes beyond `*`** (bug; book decision 11): a `*:…` entry counts for
   no category, `*:` alone is still `*`, and the draft grammar records the open question:
   `2-the-cards-ignore-scoped-star-entries.md`. Done.
Edit mode is three stories (planned 2026-10-08), shipped to staging together with #1–#2:

3. **Edit mode: assign Assistants and preview the result** (feature): the Edit button, the per-card pickers, All
   duties, Undo, the save note, the cards' preview and "View the raw Treasure Map — edited", the no-Map warning (book
   decisions 12, 14, 15). Signs nothing. Depends on #2. Carries story 2's review non-blocking 1 and 3 (the
   `categoryAssistants` JSDoc's "a `*:…` entry never counts" should say "that names anything after the `*`"; H1–H5's
   names in `test/treasure-map-card-rule-edges.test.js` still say "covers").
4. **The override switches and the backup switch** (feature): what each removes, previewed (book decisions 8, 12, 13).
   Depends on #3. A question for the owner at planning, from story 3's review (non-blocking 5): after Assign to all,
   a card's Undo (or picking its current Assistant) can leave the card reading Mixed with no Unsaved marker, because
   the pending `*` entry still reaches it. The preview is honest, but it may read as a glitch.
5. **Save** (feature): Save changes signs the edited Map with the person's own signer and publishes it, "Treasure Map
   updated", the failure states, and a new Map when none was found (book decisions 9, 14). Depends on #4. Carries
   story 3's review non-blocking 4 and 9:
   - A pick can be pending while the edited Map is byte-identical to the published one, for example a Mixed card
     given the Assistant its own entry already names. Compare the draft with the published tags before counting
     changes or enabling Save, so Save never re-publishes an identical Map.
   - `useMapEdit` resets on a new viewer in an effect, one render late. Save checks the viewer when clicked, or the
     edit state is keyed by viewer.

## Key facts / guardrails

- **Only your own Map.** The Map edited is always the session user's own kind 10040, never one named by a URL or a
  parameter, and only their own signer signs it.
- **Keep everything the edit doesn't change.** Every entry not edited stays byte for byte and in its place, including
  entries this page doesn't show (CLAUDE.md principle 4; the same rule as `src/lib/treasureMapMerge.js`). The override
  switches and the backup switch, when on, are the only removals.
- **Only the person's own Assistants can be picked:** the My Assistants page's list (`GET /api/assistant/my-assistants`).
- **"Local" means the viewer's own Assistant on this instance** (`user.assistantPubkey`), never `taPubkey` and never a
  literal (CLAUDE.md, per-deployment TA pubkey).
- **Nothing before the read.** Nothing is claimed or saved before the Map has been read, nor while the read is loading
  or has failed. With no Map found, Edit creates one, after a warning that a Map on a relay that wasn't read would be
  replaced (book decision 9).
- **The backup switch reaches the whole Map** (book decision 8): switched on, Save keeps only each key's first
  Assistant, on every key, including keys this page doesn't show.
- **`*:…` entries are ignored, never removed** (book decision 11): they count for no category and are never an
  individually assigned duty, and an edit keeps them as they are. Only the backup switch can drop their backups.
- **No key on the raw viewer.** Its open state survives sign-in settling (ADR manage-treasure-map/0002 Amendment 2).
- **For Architecture:** the legacy generators (the legacy customer page and the NIP-85 control panel) own the `30382:*`
  rows and replace them as one block when they regenerate (`src/lib/treasureMapMerge.js`). An edit that writes those
  rows would be overwritten by a later regenerate from those pages.
