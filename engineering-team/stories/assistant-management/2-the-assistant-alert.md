# Story 2: The Assistant Alert

**Status:** Approved
**Created:** 2026-09-21
**Type:** Feature
**Epic:** `assistant-management`
**Book:** `engineering-team/audits/assistant-management/book.md`

## Background

The owner wants a persistent reminder, like the Setup Alert, that sends people to `/assistant` while
any of their assistant's actions needs attention. The Setup Alert is setup-status-and-alert #2:
Brainstorm's "Finish setting up your account · N steps left" pill beside the avatar menu. It is
approved but not built yet.

The owner decided at intake (book § Decisions 2) that **only one pill shows at a time, and setup
comes first.** Setting up means having an assistant, a follow list and a Treasure Map, and all of that
comes before managing the assistant. One pill also keeps the top bar uncluttered on a phone.

This story depends on story 1. The pill points at the page, and it counts what the page marks as
needing attention. For now the page marks all ten actions, for every signed-in viewer who has an
assistant (story 1, AC-2). So until the real checks exist, the pill shows for every such viewer
whose setup is out of the way, on every page but `/assistant` and its pages.

## User-facing description

As someone with a Tapestry Assistant, I want a small reminder at the top of every page that tells
me how many of my assistant's actions need attention and takes me to `/assistant`. It should not
compete with the setup reminder: while I still have setup steps left, that one comes first.

## When the pill shows (approved with this story, 2026-09-21)

All of these must hold:

1. **You are signed in and have an assistant on this instance.** This is the same answer that marks
   `/setup`'s first step done, and the same viewer story 1 marks cards for.
2. **At least one action needs attention**, as story 1 counts them. For now that is always ten.
3. **Setup comes first.** The pill waits while your setup status is still being checked. Once the
   check has answered, the pill stays hidden if the Setup Alert would count at least one step.
   Otherwise it shows: that is when the Setup Alert counts nothing, or when the setup check failed
   and so the Setup Alert shows nothing either.
4. **You are not on `/assistant` or any page under it.** That covers the ten action pages and
   `/assistant/profile/edit`.

Until setup-status-and-alert #2 ships, a viewer with a setup step left sees no pill at all. That is
expected: their pill is the Setup Alert, which is not built yet.

## Acceptance criteria

- [ ] **AC-1: where and what.** Given a viewer for whom the pill shows, when they open any page
      outside `/tapestry`, the landing page included, or any page under `/tapestry`:
  - a pill appears in the top bar, beside the avatar menu, in the spot the Setup Alert uses. On
    the developer pages, whose top bar has no avatar menu, it sits where the menu would be;
  - it reads **Manage your Tapestry Assistant · 10 actions need attention** ("· 1 action needs
    attention" when one is counted), with a **Manage Assistant →** button;
  - activating the pill, by clicking it or by tabbing to it and pressing Enter, opens `/assistant`.
- [ ] **AC-2: who sees it.**
  - Given a visitor who is not signed in, no pill appears on any page.
  - Given a signed-in viewer with no assistant on this instance, no pill appears on any page.
- [ ] **AC-3: setup first.** Given a signed-in viewer with an assistant:
  - while their setup status is still being checked, no Assistant pill appears;
  - when the check has answered and counts at least one step, no Assistant pill appears. That
    count is the one the Setup Alert shows ("N steps left"): only steps confidently not done;
  - when the check has answered and counts none, the pill appears. For example, it appears for a
    viewer whose three steps are done. It also appears for one whose first two steps are done and
    whose Treasure Map names another provider, because the Setup Alert does not count that case;
  - when the setup check has failed, the pill appears;
  - at no moment do the Setup pill and the Assistant pill both show.
- [ ] **AC-4: where it hides.**
  - Given any viewer on `/assistant`, on one of its ten action pages, or on
    `/assistant/profile/edit`, no Assistant pill appears there.
  - The pill has no close button.
- [ ] **AC-5: never disagrees with `/assistant`.** Given the same viewer:
  - the pill's N equals the number of cards `/assistant` marks **Needs attention** for them, and
    the page's count line says the same number (10 for now);
  - when the page would mark none, no page shows the pill.
- [ ] **AC-6: every width.**
  - On a wide screen the pill shows its sentence and the count.
  - On narrower screens the count may drop.
  - At 375 px wide only a mark and the **Manage Assistant →** button show. The pill's accessible
    name stays "Manage your Tapestry Assistant".
  - No top bar scrolls horizontally at any of these widths.
- [ ] **AC-7: read-only.** Given any page that shows the pill, or checks whether to show it,
      nothing is published, signed or stored on the viewer's behalf. Deciding whether to show it
      asks the server nothing beyond what sign-in and the shared setup status already ask.

## Copy

New, parallel to the Setup Alert's Brainstorm wording (setup-status-and-alert #2 § Copy).

| Element | Text |
|---|---|
| Sentence | Manage your Tapestry Assistant |
| Count | · N actions need attention (· 1 action needs attention) |
| Button | Manage Assistant → |
| Accessible name of the whole pill | Manage your Tapestry Assistant |
| Mark (all widths; alone with the button at 375 px) | ⚠, as on the Setup Alert |

**Look:** a pill of its own colour, Tapestry's indigo accent, so that it is not mistaken
for the amber Setup Alert. Its shape and size match the Setup Alert's.

## Concepts touched

None changed. Oriented on the same handles as story 1: `39998:<TA>:nostr-user` is whose assistant
the pill is about.

## Out of scope

- **Real "needs attention" answers.** Every action counts for now (story 1, and book § Out of
  scope).
- **The Setup Alert itself** is setup-status-and-alert #2. This story only gives way to it. If this
  story lands first, it leaves the shared spot ready for that pill. If that pill lands first, this
  one fits beside it.
- **Dismissing the pill.** Like the Setup Alert it is persistent. With every action counted for
  now, that means a viewer with an assistant and no setup left sees it on every page but
  `/assistant`. Deciding whether that should reach production before the real checks exist is a
  promotion decision, taken at `/cycle-prod`.
- **Noticing a change made elsewhere** before the next full page load, as with the Setup Alert.
- **Pages without a top bar**, and pages outside the app: the site-wide "Page not found", and the
  legacy dashboard at `/legacy/`.

## Open questions

None open. Resolved when the owner approved this story (2026-09-21), all as proposed:

1. **The words** in § Copy. They follow the Setup Alert's shape: a sentence, a count, a button.
2. **The colour**: indigo rather than amber, because the two pills never show together and a
   different colour tells the viewer it is a different reminder.
3. **When the setup check fails, the pill shows** (§ When the pill shows, rule 3). The setup-first
   rule exists so that two pills never show at once. When the setup check fails the Setup Alert
   shows nothing, so the Assistant pill has nothing to give way to.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
