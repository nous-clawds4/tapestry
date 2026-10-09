# Book of Work: Manage your Treasure Map — `/treasure-map`, built to the Claude Design blueprint

**Slug:** manage-treasure-map
**Status:** Closed
**Opened:** 2026-10-07
**Closed:** 2026-10-07

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-10-07). Completion is *judged* against the
bullets below.

The ask, verbatim (copied from the session transcript, not retyped):

> i just now used Claude Design to build a simple version of the Manage your Treasure Map page. I would like to use this page as the template for a page on Tapestry. We will include the link to the Advanced management page, but for now, that page will be only a placeholder page. When I am on the main landing page, the My Treasure Map page will take me to this page. When I am on the /tapestry page, I will continue to be taken to the old TA Treasure Map page. For starters: are you able to access this Claude Design template? If so, do you have any questions before we begin?

The owner's answers to the three intake questions the same day, verbatim:

> 1. View-only first, as you suggest.
> 2. Agreed.
> 3. Agree with your suggestions.

The questions they answer: (1) view-only first, or edit-and-publish too; (2) the page at `/treasure-map`, its
placeholder at `/treasure-map/advanced`; (3) the My Assistants page's Treasure Map links move to the new page, while
the Tapestry side's links stay on the TA Treasure Map page.

**The blueprint** is the design's "Manage your Treasure Map" screen, in the artifact the my-assistants book also built
from (https://claude.ai/artifact/SiFE8XoAbC3KH5TQbG4Y8m). The artifact can change, so the version read at intake
(`1791333324-4c16`) is kept in `blueprint/` (see its README).

### Acceptance frame

*Proposed 2026-10-07 with story 1; confirmed when the owner approved story 1 the same day.*

- [x] **My Treasure Map** in the search landing page's and the Brainstorm top bar's avatar menus opens
      `/treasure-map`. In the Tapestry header's menu it still opens the TA Treasure Map page.
- [x] `/treasure-map` is in the Brainstorm design's styling and follows the blueprint, view-only: heading,
      introduction, FAQ, which Assistant the person's Treasure Map names for Scores, Lists and Concepts, the raw
      Treasure Map, and the "No Treasure Map found" state.
- [x] **Advanced management** opens a placeholder page at `/treasure-map/advanced`.
- [x] The My Assistants page's Treasure Map links open `/treasure-map`.
- [x] Nothing in the book signs or publishes. Editing is a later book.
- [x] The book is shipped to staging. Production only on the owner's explicit go.

## Decisions at intake

1. **View-only first.** The design's Edit mode (assign Assistants by category or to everything, override individual
   duties, Save → a newly signed kind 10040) is a later book. So is the full Advanced page.
2. **Addresses:** the page at `/treasure-map`, the placeholder at `/treasure-map/advanced`, beside `/assistants`,
   `/dictionary` and `/setup`.
3. **Brainstorm-side links move; Tapestry-side links stay.** The My Assistants page's three Treasure Map links (the
   introduction's, each row's **Manage**, the Duties tab's) open the new page. The Tapestry sidebar's **TA Treasure
   Map** and the My Curated DLists page's links keep opening the TA Treasure Map page.

At story 1's gate, the same day (approved as drafted, "Ready for architecture."):

4. **The blueprint's words stay**, including the lines that run ahead of the app (the introduction's "Brainstorm keeps
   it up to date for you"; the FAQ's setup and Advanced-page answers).
5. **The Advanced placeholder points to the TA Treasure Map page** until the Advanced page is built.
6. **Two stories, then ship once:** the page (story 1), then the Assistants by category cards (story 2).

At story 1's review gate, the same day, verbatim:

> If my Map doesn’t cover a category, it should indicate that category has not yet been assigned.
>
> Yes, let’s count broad entries.
>
> Proceed.

7. **A category the Map doesn't cover says it hasn't been assigned yet.** The design shows your own Assistant there
   instead; story 2 departs from it.
8. **Broad entries count.** `*` (everything) and the family wildcards `3038x` / `3039x` (all Scores / all Lists, from
   the draft Treasure Maps grammar) cover a category that has nothing more specific, as the design does.

At story 2's gate, the same day, verbatim:

> If the Map gives rank to Assistant A and all Scores to Assistant B, then it is mixed.

9. **A card lists every Assistant the Map would ask for some insight in the category.** A broad entry counts alongside
   the category's own entries unless a more specific entry covers it completely (story 2 AC-2). This refines decision
   8, which followed the design's "only when nothing more specific".

## Epics in this book
- `manage-treasure-map` — the Manage your Treasure Map page and its Advanced placeholder.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high (every capability traces to an approved story, ADR and reviewed diff; the owner's
  decisions are quoted). Production promotion awaits the owner's go.

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/manage-treasure-map/audit.md`
- Product feedback: `engineering-team/audits/manage-treasure-map/prd-seed.md`
