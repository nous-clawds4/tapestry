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
2. **Edit mode** (feature). Its Planning decides whether it's one story or more (for example, edit controls and
   preview, then Save). Depends on #1.

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
- **No key on the raw viewer.** Its open state survives sign-in settling (ADR manage-treasure-map/0002 Amendment 2).
- **For Architecture:** the legacy generators (the legacy customer page and the NIP-85 control panel) own the `30382:*`
  rows and replace them as one block when they regenerate (`src/lib/treasureMapMerge.js`). An edit that writes those
  rows would be overwritten by a later regenerate from those pages.
