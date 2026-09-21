# Book of Work: The /setup page — Brainstorm's setup checklist, as a scaffold

**Slug:** setup-page-scaffold
**Status:** Open
**Opened:** 2026-09-20
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)** — the owner's ask, restated at intake (2026-09-20). Completion is
*judged* against the bullets below.

The ask, verbatim (copied from the session transcript, not retyped):

> I would like for Tapestry (https://staging.brainstorm.world) to emulate the Brainstorm (github.com/nosfabrica/Brainstorm-UI) feature of having a setup page, which can be seen here: https://brainstorm.world/setup. And just like at Brainstorm, we will have a Setup Alert at the top of the page to prompt the user to complete these actions if there are any that are not yet completed.
>
> Once completed, with respect to this feature, Tapestry should support the same actions as Brainstorm, including the three actions:
>
> * Create your account (which effectively means to set up your Tapestry Assistant)
> * Create your follow list (your kind 1 nostr event with at least one follow who is not you),
> * Activate your Brainstorm Account (which for us will mean to setup your Treasure Map so that the rank and followers scores are managed by the local Assistant).
>
> But for now, let’s not implement the full functionality. Let’s only do these things:
>
> * Make the /setup page (https://staging.brainstorm.world/setup), which will support each of the three actions.
> * For now, the page will display as if NONE of these three actions have been completed successfully; clicking on any one of the three llinks will take the user to the page that is dedicated to that particular action. But for now, each of these three pages will be simply placeholder pages. We will diverge slightly from the Brainstorm codebase in our choices of each of the three URLs. Our three URLs will be:
>    * /setup/create-account
>    * /setup/follow
>    * /setup/activate
>
> Let’s NOT do these things yet, because we will save them for a future session:
>
> * Check individually whether each one of these three actions has actually been taken, and prompt accordingly on the /setup page.
> * Show the Setup Alert at the top of the page that will direct the user to the /setup page.
> * Build out the UX or the functionality of any of the action-specific pages. For now, they will just be placeholder pages.

("kind 1" is the owner's typing: a follow list is a kind 3 event (NIP-02), and the story's copy
says kind 3. "llinks" and "setup your Treasure Map" are left as typed.)

### Acceptance frame

*Confirmed 2026-09-20, when the owner approved story 1.*

- [ ] `https://staging.brainstorm.world/setup` shows a setup page modelled on Brainstorm's
      (`brainstorm.world/setup`) that lists the three actions — Create your account, Create your
      follow list, Activate your Brainstorm account — in that order.
- [ ] The page shows all three as not yet completed, for every viewer. Nothing checks whether an
      action has really been taken.
- [ ] Each action leads to its own page — `/setup/create-account`, `/setup/follow`,
      `/setup/activate` — and each of those is a placeholder that says so.
- [ ] The three things saved for a future session are written down where that session will find
      them (`engineering-team/stories/_intake.md`, entry dated 2026-09-20), and none of them is
      built: checking each action's real state, the Setup Alert, and the UX or function of the
      three action pages.

## Epics in this book

- `setup-page-scaffold` — one story: the `/setup` page and its three placeholder action pages.

## Path

**Abbreviated — Story + Implementer + Reviewer**, chosen by the owner at intake (2026-09-20). It is
the same path `navigation-scaffolding` used for its placeholder pages. No ADR and no test plan: the
story records the only design choices (routes and copy), and `ui/` has no component test harness.
The story is committed before implementation starts, so spec and code land in separate commits (the
fix shape OPEN.md row 212 proposes for this path).

## Changes from outside this book

- **2026-09-21 — `/setup` now has a way in.** The avatar menus link to it as "Account Setup",
  added at the owner's request outside this book (review:
  `engineering-team/reviews/done/navigation-scaffolding/avatar-menu-account-section.md`). Story 1's
  out-of-scope line, that people reach `/setup` only by typing its address, no longer holds.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/setup-page-scaffold/audit.md`
- Product feedback: `engineering-team/audits/setup-page-scaffold/prd-seed.md`
