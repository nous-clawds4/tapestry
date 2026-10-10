# Book of Work: Scores, Lists and Concepts on the Assistant Management page — renamed, and each told true

**Slug:** assistant-trusted-content-status
**Status:** Open
**Opened:** 2026-10-08
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-10-08) and settled through two
questions there. Completion is *judged* against the bullets below.

The ask, verbatim (copied from the session transcript, not retyped):

> I would like to update the Assistant Management page at https://staging.brainstorm.world/assistant so that the first three items under Publication of Trusted Content -- Trusted Assertions, Trusted Lists, and Decentralized Lists -- are renamed Scores, Lists, and Concepts, to mirror the three categories in the Treasure Map page at https://staging.brainstorm.world/treasure-map .  And I would like for the styling of each of these three items to reflect correctly its status as completed or Needs Attention. Can you help me to make these changes?

### Decisions taken at intake (2026-10-08)

1. **What "completed" means.** A category is completed when the person's Treasure Map gives it to their
   Tapestry Assistant on this instance, **alone or alongside other Assistants** ("Mixed"). It needs
   attention when the category is unassigned, or held only by other Assistants. *(Chosen from: your
   Tapestry Assistant assigned / any Assistant assigned / only your Tapestry Assistant.)*
2. **Path:** Standard, all five phases. *(Chosen from: Standard / Light trial.)*

### Acceptance frame

*Confirmed 2026-10-08, at intake.*

- [ ] **The names.** On `/assistant`, under *Publication of Trusted Content*, the first three items read
      **Scores**, **Lists** and **Concepts**, in that order, mirroring the Treasure Map page's three
      categories. Their descriptions, NIP links and page addresses are unchanged.
- [ ] **One real answer.** For a signed-in person with an Assistant here, each of the three is **completed**
      when their Treasure Map gives that category to their Tapestry Assistant on this instance (alone or
      among several), read the same way the Treasure Map page's cards read the Map, and **Needs attention**
      otherwise: unassigned, only other Assistants, or no Map found.
- [ ] **A completed item looks completed:** the `/setup` page's done look, a green ✓ marker and a green
      "Done" badge. This applies to any completed item on the page, so Identification Tags gains it too.
- [ ] **The count agrees.** The "N actions need attention" line and the Assistant Alert pill agree with the
      marks.
- [ ] **Unknown is not done.** While the Map is still being read, or cannot be read, the item stays marked on
      the page but is not counted by the alert pill (Identification Tags' existing behaviour).
- [ ] **It catches up.** After the person saves their Treasure Map in the app, the Assistant page reflects it
      without a reload.

## Epics in this book

- `assistant-trusted-content-status`: one story. Scores, Lists and Concepts on the hub — renamed, and each
  Done when the person's Treasure Map gives it to their Tapestry Assistant (#1).

## Path

**Standard, all five phases.** A feature.

## Shared lines

Two books opened the same day touch the same hub lines: `assistant-profile-checklist` (its story 1 AC-6 gives
the hub a **Done** badge for any checked action that is done) and `assistant-outbox-relays` (its story 1 adds an
eleventh action and joins the same attention answer). This book's three cards use that Done badge; whichever
story is built first adds it to the hub, and the others reuse it. Before Implementation and again before Review:
`git fetch` and `git merge-tree --write-tree HEAD origin/staging` (ledger
`2026-09-22-parallel-books-no-shared-line-recheck`). The lines this book touches: the hub's actions and attention
answer (`ui/src/pages/assistant/actions.js`, `src/api/assistant/attention.js`), the Treasure Map page's category
rule (`ui/src/pages/treasure-map/manageTreasureMap.js`, read, not changed), and the top-bar pill's count.

## Provenance

- **Mode:** Acceptance-frame

## Close artifacts *(filled by `/close-book`)*

- Build audit: —
- Product feedback: —
