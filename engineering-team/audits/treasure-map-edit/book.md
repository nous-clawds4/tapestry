# Book of Work: Treasure Map Edit mode — assign Assistants on `/treasure-map`, then Save

**Slug:** treasure-map-edit
**Status:** Open
**Opened:** 2026-10-07
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-10-07). Completion is *judged* against the
bullets below.

The ask, verbatim (copied from the session transcript, not retyped):

> Read “docs/TREASURE_MAP_EDIT_HANDOFF.md” and start the Treasure Map Edit mode book.

The handoff (`docs/TREASURE_MAP_EDIT_HANDOFF.md` § 1) records the owner's decisions for Edit mode from the
manage-treasure-map session, the same day. The owner's own words weren't kept there, so they're carried below as
the handoff states them (decisions 1–4).

**The blueprint** is the design's "Manage your Treasure Map" screen with its Edit mode, kept as read at the previous
book's intake (version `1791333324-4c16`) in `engineering-team/audits/manage-treasure-map/blueprint/`: the Edit
button, every `tmbEdit` block of `treasure-map-screen.html.txt`, and `treasure-map-logic.js.txt` lines ~75–125. The
live artifact (https://claude.ai/artifact/SiFE8XoAbC3KH5TQbG4Y8m) may have moved on; it's re-read only if the owner
says it has.

### Acceptance frame

*Proposed 2026-10-07 at intake; confirmed by the owner the same day ("3. Confirmed.", below).*

- [ ] **The cards count the draft grammar's edge cases right** (ledger `2026-10-07-treasure-map-card-rule-edge-cases`):
      a broad entry that a more specific one covers completely doesn't count, a system word counts only for the
      family it belongs to, and two spellings of one key count once. Edit mode's preview is built on this rule.
- [ ] **Edit on `/treasure-map`, per the blueprint.** A signed-in person whose Map has been read presses **Edit**, then
      assigns Scores, Lists or Concepts each to one Assistant, or **All duties** to one Assistant. Each pending change
      reads Unsaved, with Undo. A category with individually assigned duties offers the blueprint's override switch.
      The save note counts the changes, and "View the raw Treasure Map — edited" shows exactly the Map Save would sign.
- [ ] **Only the person's own Assistants can be picked:** the ones on the My Assistants page (`/assistants`).
- [ ] **One backup switch, off by default.** Switched on, Save keeps only the first Assistant of each entry and drops
      every backup. Finer control of backups belongs to the Advanced page, a later book.
- [ ] **Save changes** signs a new Treasure Map with the person's own signer and publishes it. The page says
      "Treasure Map updated", and the cards and the raw viewer show the new Map. If signing or publishing fails, the
      page says so and the edit isn't lost.
- [ ] **Everything the edit doesn't change stays as it was,** in its place, including entries this page doesn't show.
      Only the override switches and the backup switch, when on, remove anything.
- [ ] **Nothing is offered before the Map has been read:** no Save while the read is loading or has failed.
- [ ] **With no Map yet, Edit creates one,** after a warning that the relays read held no Treasure Map, so one kept on
      a relay that wasn't read would be replaced (decision 9).
- [ ] **Shipped to staging.** Production gets this book and the manage-treasure-map book together, only on the owner's
      explicit go.

## Decisions at intake

Carried from the handoff (§ 1), as it records them:

1. **Which Assistants can be picked:** only the ones on the My Assistants page, the list
   `GET /api/assistant/my-assistants` answers for the session's viewer.
2. **Backup Assistants:** in Edit mode, one switch, off by default, that clears out any and every backup Assistant
   assignment in the Map. No finer control of backups on this page; that belongs to the Advanced page, a later book.
   In the draft grammar (`protocols/drafts/treasure-maps.md` § 7) the first entry of a key is its Preferred provider
   and the rest are Alternates, so switched on, Save keeps only the first entry of each key. *Reading to confirm at
   intake: "in the Map" includes keys this page doesn't show.* The switch's words are new (the blueprint has none);
   they're proposed in Edit mode's story for the owner to approve. *Confirmed at intake: the literal reading
   (decision 8).*
3. **Still binding from the manage-treasure-map book:** the blueprint's words stay, even where they run ahead of the
   app (that book's decision 4); the cards' counting rule (its decisions 7–9: "Not assigned yet", broad entries
   count, a broad entry next to a specific one reads Mixed).
4. **Production waits for Edit mode.** Staging isn't promoted to main until Edit mode ships; then both go to main
   together, still only on the owner's explicit go.

At intake, by this session:

5. **Engineering flow, no product discovery.** The blueprint is the design, as in the manage-treasure-map book.
6. **The card rule's edge cases first,** as a small bug story, because Edit mode's preview reuses `categoryAssistants`.
   Edit mode's own Planning decides whether it's one story or more (for example, edit controls and preview, then Save).
7. **A feature branch, `feat/treasure-map-edit`,** shipped to staging through a PR (`/cycle-staging`), so Phase-3
   failing tests and unapproved drafts stay off the shared `staging` branch (ledger
   `2026-10-07-staging-sessions-push-red-tests`, fix shape (a)).

The owner's answers to the three intake questions the same day, verbatim:

> 1. Literal reading.
> 2. Yes, let’s create a new one, but display the relevant warning.
> 3. Confirmed.

The questions they answer: (1) does the backup switch reach every key in the Map, including keys this page doesn't
show; (2) with no Map yet, does Edit offer to create one; (3) the acceptance frame and the order (the card-rule fix,
then Edit mode).

8. **The backup switch reaches the whole Map.** Switched on, Save keeps only the first Assistant of every key in the
   Map, including keys this page doesn't show. Its words must say it reaches beyond the three cards (proposed in Edit
   mode's story).
9. **With no Map yet, Edit creates one, with a warning.** "No Treasure Map found" means only that the relays read held
   none, so a Map kept on a relay that wasn't read would be replaced. The warning's words are proposed in Edit mode's
   story. This changes the handoff's default (no Save for a person with no Map).
10. **The frame and the order are confirmed.** The blueprint is the version kept in
    `engineering-team/audits/manage-treasure-map/blueprint/`; the owner didn't say the live artifact has changed.

## Epics in this book
- `treasure-map-edit` — Edit mode on the Manage your Treasure Map page, and the card-rule fix it builds on.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/treasure-map-edit/audit.md`
- Product feedback: `engineering-team/audits/treasure-map-edit/prd-seed.md`
