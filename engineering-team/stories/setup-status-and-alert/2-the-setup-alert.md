# Story 2: The Setup Alert

**Status:** Approved
**Created:** 2026-09-21
**Type:** Feature
**Epic:** `setup-status-and-alert`
**Book:** `engineering-team/audits/setup-status-and-alert/book.md`

## Background

Brainstorm keeps one persistent reminder in its header until setup is done: the "Finish setting up
your account" pill (`FinishSetupBanner.tsx`, summarized in the epic). The owner wants the same on
Tapestry. Today nothing sends people to `/setup` except the avatar menus' "Account Setup" link.

The alert depends on story 1. It counts the same answers `/setup` shows, but only the confident
ones. That is Brainstorm's "two kinds of not done": nobody is nagged about a follow list or a
Treasure Map that simply hasn't loaded yet.

## User-facing description

As someone signed in to a Tapestry instance who hasn't finished setting up, I want a small reminder
at the top of every page that tells me how many setup steps are left and takes me to `/setup`, so
that I finish without having to remember where. I don't want it to nag me about a step I've done, or
about one it is still checking.

## What the alert counts (ratified at planning, 2026-09-21)

A step counts only when it is *confidently* not done, by story 1's rules:

- **Step 1** counts when sign-in says this instance holds no assistant for you. If the instance
  could not answer, step 1 is not counted.
- **Step 2** counts when its check has finished and step 2 is not done.
- **Step 3** counts when its check has finished and step 3 is not done, unless your Map names
  another provider. `/setup` still shows that case as not done.

**When a check has finished.**
- A check has finished when:
  - it found the event, on this instance's relay or outside; or
  - it found none on this instance's relay, and none on the outside relays after at least one of
    them answered.
- A check has not finished while it is still running, when this instance's relay could not be
  read, or when no outside relay could be reached.

## Acceptance criteria

- [ ] **AC-1 — where and what.** Given a signed-in viewer with at least one step counted, when they
      open any page outside `/tapestry`, the landing page included, or any page under `/tapestry`:
  - an amber pill appears in the top bar, beside the avatar menu. On the developer pages, whose
    top bar has no avatar menu, it sits where the menu would be;
  - it reads "Finish setting up your account · N steps left" ("· 1 step left" when one is counted),
    with a "Finish setup →" button;
  - activating the pill, by clicking it or by tabbing to it and pressing Enter, opens `/setup`.
- [ ] **AC-2 — confident steps only.**
  - Given a step whose check is still running or has not finished, the pill does not count it.
  - Given no step counted, no pill appears.

  In particular:
  - a viewer whose follow list and Map are still loading is never shown a pill for those steps;
  - a viewer whose steps 1 and 2 are done, and whose Map names another provider, sees no pill.
- [ ] **AC-3 — when it hides.**
  - Given a visitor who is not signed in, no pill appears on any page.
  - Given any viewer on `/setup` or on one of its three step pages, no pill appears there.
  - The pill has no close button.
- [ ] **AC-4 — never disagrees with `/setup`.** Given the same viewer:
  - every step the pill counts is shown as not done on `/setup`, so N never exceeds the number of
    steps `/setup` shows as not done;
  - when nothing is left to count, no page shows the pill.
- [ ] **AC-5 — every width.**
  - On a wide screen the pill shows its sentence and the count.
  - On narrower screens the count may drop.
  - At 375 px wide only the ⚠ mark and the "Finish setup →" button show. The pill's accessible name
    stays "Finish setting up your account".
  - No top bar scrolls horizontally at any of these widths.
- [ ] **AC-6 — read-only.** Given any page showing the pill, or checking whether to show it, nothing
      is published, signed or stored on the viewer's behalf.

## Copy

All from Brainstorm (`FinishSetupBanner.tsx` at upstream `cde8f438`), approved at planning.

| Element | Text |
|---|---|
| Sentence | Finish setting up your account |
| Count | · N steps left (· 1 step left) |
| Button | Finish setup → |
| Accessible name of the whole pill | Finish setting up your account |

## Concepts touched

None changed. Same orientation handles as story 1: `39998:<TA>:tapestry-assistant`,
`39998:<TA>:nostr-user`, `39998:<TA>:nostr-relay`.

## Out of scope

- **Noticing a step you completed elsewhere** (in another app or another tab) before your next full
  page load.
- **Pages without a top bar**, and pages outside the app:
  - the site-wide "Page not found" (the one under `/tapestry` does get the pill);
  - the legacy dashboard at `/legacy/`, which is served outside the app.
- **Dismissing the pill.** It is persistent, by the owner's choice.
- **Brainstorm's purple "Trusted Lists update" pill.**
- **Other surfaces:** changing the avatar menus' "Account Setup" link, the Dashboard's
  Getting-Started checklist, the step pages, and `/assistant`.

## Open questions

None. The owner answered them at planning (2026-09-21), recorded in book § Decisions 2, 3, 5 and 7–9.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
