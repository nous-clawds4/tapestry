# Book of Work: Your Tapestry Assistant's Profile — the checklist at `/assistant/profile`

**Slug:** assistant-profile-checklist
**Status:** Open
**Opened:** 2026-10-09
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-10-09) and settled through three
questions at Planning. Completion is *judged* against the bullets below.

The ask, verbatim (copied from the session transcript, not retyped):

> I would like to work on the Your Tapestry Assistant's Profile page, at https://staging.brainstorm.world/assistant/profile. It should show a series of items that need to be addressed, each its own panel styled similarly to the Assistant Management page at https://staging.brainstorm.world/assistant . Each item will be in one of two states: complete or Needs attention. When each of these items is complete, then the "Your Tapestry Assistant's Profile" panel will indicate completion.
>
> Each of these items will include a feature The series of items will include:
>
> * a personalized avatar, branded to the local Tapestry instance
> * a personalized background image, branded to the local Tapestry instance. (This feature , which will function similarly to the personalized avatar feature, has not yet been built. For now, it will be a placeholder item. Its state -- completed vs needs attention -- will not be calculated for now and will not yet count towards the determination of whether the full Profile item is completed or not.)
> * working NIP-05, hosted by the local Tapestry instance
> * the website field, which should be the URL of the Tapestry instance
>
> Plus any others you can think of that I am neglecting.

The owner's earlier words for this page (book `assistant-management`, 2026-09-21):

> Alert criteria: If any of the Tapestry Assistant profile criteria are not met (create avatar, working NIP-05, client tag, URL, etc) Note: this page will not be the same as the Edit Assistant Profile page. It will be effectively a checklist of features that need to be done correctly. If any are done incorrectly, it may direct to the Edit Assistant Profile page, depending on which thing is done incorrectly.

### Decisions taken at Planning (2026-10-09)

1. **Three more items**, beyond the four in the ask: the **client tag** (the owner's 2026-09-21 criteria),
   **visible to other nostr apps** (the latest profile is on an outside relay), and **name and About**.
2. **Each panel that needs attention carries a one-click fix** on the panel itself, which republishes the
   Assistant's profile from this page. Not just a link to the editor.
3. **The personalized avatar opens to everyone.** Today only the Owner can stamp an avatar (the server reads
   the Owner's picture). Every person with an Assistant here will be able to stamp their *own* picture for
   their *own* Assistant.

### Acceptance frame

*Confirmed 2026-10-09, when the owner approved stories 1–3 with the recommended answers to their open questions.*

- [ ] **The page** at `/assistant/profile` replaces its placeholder with seven panels, styled like the cards
      on `/assistant`: a personalized avatar, a personalized background image (a placeholder), a working
      NIP-05, the website, name and About, the client tag, and visible to other nostr apps. Each panel is
      **Done** or **Needs attention**, and says why in plain words. The background image is neither: it says
      it is coming, and it does not count.
- [ ] **One real answer.** For a signed-in viewer with an Assistant on this instance, the instance says which
      items are done for that viewer's own Assistant, and only theirs.
- [ ] **The hub tells the truth for this action.** The "Your Tapestry Assistant's Profile" card on
      `/assistant` shows **Done** once every counted item is done, and **Needs attention** otherwise. The
      hub's count line and the Assistant Alert count it the same way. The background image never counts.
- [ ] **One-click fixes.** Each panel that needs attention offers its own fix (where one is possible on this
      instance), which republishes the Assistant's profile changing only what that item is about. Each
      relay's answer is shown, and the checklist re-checks afterwards.
- [ ] **A personalized avatar for every Assistant.** The Owner, an Admin or a Customer can stamp their own
      nostr picture with the Tapestry mark, see a preview, and publish it as their own Assistant's picture,
      hosted by this instance.
- [ ] **Nothing else changes:** the background-image feature is not built, the kind 0 wire format is not
      changed, and no other action page is touched.

## Epics in this book

- `assistant-profile-checklist`: three stories. The profile check and the hub's Done mark (#1); the checklist
  page and its one-click fixes (#2); a personalized avatar for every Assistant (#3).

## Path

**Standard, all five phases for each story.** All three are features.

## Shared lines

Other sessions work on the assistant's surfaces (`manage-treasure-map` landed on staging this week). Before
Implementation and again before Review: `git fetch` and `git merge-tree --write-tree HEAD origin/staging`
(ledger `2026-09-22-parallel-books-no-shared-line-recheck`). The lines this book touches: the hub's attention
answer (`ui/src/pages/assistant/actions.js`, `src/api/assistant/attention.js`), the routes in `ui/src/App.jsx`,
the assistant API (`src/api/assistant/`), the profile editor, and the top-bar pill's count.

## Provenance

- **Mode:** Acceptance-frame

## Close artifacts *(filled by `/close-book`)*

- Build audit: —
- Product feedback: —
