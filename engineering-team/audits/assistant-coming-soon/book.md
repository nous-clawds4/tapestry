# Book of Work: Coming soon — the hub's unbuilt cards stop asking for attention

**Slug:** assistant-coming-soon
**Status:** Closed
**Opened:** 2026-10-12
**Closed:** 2026-10-12 (on staging since `72c4b7b`, deploy run 657; the owner's Gate B verdict in `f61b7ff`;
in production 2026-10-12 via PR #854, merged as `ccb9b3b`, deploy run 151; audit §6 #1)
**Strictness:** Light (trial) — workflows/light-profile.md *(chosen by the owner at intake, 2026-10-12; one
Feature-lane story)*

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-10-12) and confirmed there. Completion is
*judged* against the bullets below.

The ask, verbatim (copied from the session transcript, not retyped):

> The Assistant Management page at https://staging.brainstorm.world/assistant contains several sections that are not yet supported, and currently show "Needs attention" and count towards the total number of actions that need attention. I would prefer that they follow the example of the "A personalized background image" card on https://staging.brainstorm.world/assistant/profile, which is to label the card's functionality as "Coming soon", and not have it count towards the total number of actions that need attention.
>
> Which cards? I would label Bounties, Pins, Tags,  Notifications and Alerts, and Preferences as Coming soon. The "Your Assistant's Treasure Map" is technically not yet supported, but it will be soon, so let's just not do anything to that card in this session. Does that make sense?

What was true at intake (`origin/staging` `762d350`): every hub action without a real check is a placeholder, and a
placeholder is always marked **Needs attention** and always counted, by the hub's count line and by the top-bar
**Manage your Tapestry Assistant** pill (`assistantAttention` in `ui/src/pages/assistant/actions.js`). Six cards were
placeholders: the five above and Your Assistant's Treasure Map. So a person whose every real check passes still read
"6 actions need attention".

### Decisions taken at intake (2026-10-12)

1. **The five cards, and only those.** Bounties, Pins, Tags, Notifications and Alerts, and Preferences become
   *Coming soon*. Your Assistant's Treasure Map card is left exactly as it is.
2. **Coming soon is not counted anywhere.** Neither the hub's count line nor the top-bar pill counts the five, since
   both count the same answer. *(Proposed at intake; the owner: "go ahead".)*
3. **Their pages say so too.** The bold first line of each of the five pages, "Placeholder page.", becomes "Coming
   soon." *(Proposed at intake; the owner: "change the page line too".)*
4. **Path: the Light profile trial.** *(Chosen from: Standard, all five phases / the Light profile trial.)*

### Acceptance frame

*Proposed at intake and confirmed by the owner (2026-10-12: "go ahead, Light process, change the page line too").
All four met at the close (audit §1; story AC-1–AC-4, each Met in the Gate B review).*

- [x] **The five cards say Coming soon.** On `/assistant`, Bounties, Pins, Tags, Notifications and Alerts, and
      Preferences each show a muted **Coming soon** pill, as the background image panel on `/assistant/profile` does,
      with no "!" marker and no **Needs attention**.
- [x] **They are not counted.** The hub's "N actions need attention" line and the top-bar pill leave them out. With
      every real check passing, both say 1 (the Treasure Map card) where they said 6.
- [x] **Their pages say Coming soon.** Each card still opens its own page, whose bold first line reads "Coming soon."
      in place of "Placeholder page."; the notes on that page are unchanged.
- [x] **Nothing else moves.** Your Assistant's Treasure Map card is still marked and counted, and the other cards
      behave as before.

## Epics in this book

- `assistant-coming-soon`: one story. The five unbuilt cards on the hub say Coming soon and stop counting (#1).

## Path

**Light (trial), Feature lane:** Gate A (human) → J1 design → J2 test plan → J3 post-implementation → Gate B (human
review). See `workflows/light-profile.md`.

## Shared lines

This book touches `ui/src/pages/assistant/actions.js`, `ui/src/pages/assistant/Index.jsx`,
`ui/src/pages/assistant/ActionPage.jsx`, and the hub's suites and fixtures. Checked at intake on `762d350`: no open
book edits them (duty-menus-and-self-maps is docs-mode; duty-menu-public-relay touches server files only). Before
Implementation and again before Gate B: `git fetch` and `git merge-tree --write-tree HEAD origin/staging` (ledger
`2026-09-22-parallel-books-no-shared-line-recheck`).

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** high for the code and its tests; medium-high for the experience, raised to high the same day.
  The owner saw the built hub and the ring comparison at Gate B, and checked the hub signed in on production after the
  release (audit header, §6 #4)

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/assistant-coming-soon/audit.md`
- Product feedback: `engineering-team/audits/assistant-coming-soon/prd-seed.md`
