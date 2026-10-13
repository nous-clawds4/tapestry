# Book of Work: Scores — see when your Grapevine was last published, and recalculate it

**Slug:** assistant-scores
**Status:** Open
**Opened:** 2026-10-13
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-10-13) and settled through three questions
there. Completion is *judged* against the bullets below.

The ask, verbatim:

> Is there any page on staging.brainstorm.world where the logged-in user, whether owner, admin or regular customer, can 1) see when my Grapevine was last calculated and published (several ways to determine this; easiest would be to see what is the most recent Trusted Assertion published by my local Assistant), and 2) trigger a recalculation and republication of my scores? If not, let's first select a suitable place to add this feature, and then let's add it. Maybe in the avatar dropdown menu, or maybe in settings at https://staging.brainstorm.world/settings . And let's try not to overengineer it.

### What exists today (found at intake, 2026-10-13)

- **No page does both, for everyone.** `/settings` ("Web of Trust Pipeline") shows "Trusted Assertions (latest: …)",
  but for whichever provider the viewer's Treasure Map names for `30382:rank`, which may not be their Assistant here,
  and only once that Map is on this instance's relay. Its Re-sync and Re-load buttons copy and index scores that
  already exist; they don't recalculate.
- **Recalculation is operator-only.** The task tools that start a run (`POST /api/run-task`,
  `POST /api/customer-schedule/trigger`) are owner/admin routes. A Customer has no way to start their own.
- **The hub's Scores card** (`/assistant/trusted-assertions`) is still a placeholder page.

### Decisions taken at intake (2026-10-13)

1. **Placement: the hub's Scores page.** Build the page behind Assistant Management › Scores
   (`/assistant/trusted-assertions`). *(Chosen from: that page / a new card on `/settings` / the avatar dropdown.)*
2. **Admins who aren't Customers, and guests: status only, say why.** Their Grapevine isn't calculated on this
   instance. The page shows what their Assistant has published, if anything, says in one line why there's no
   button, and offers none. *(Chosen from: status only / extend the calculation to Admins, a separate story.)*
3. **One run at a time, no cooldown.** While a run is queued or running, the button is off and the page says so.
   *(Chosen from: one at a time / one at a time plus a per-Customer cooldown.)*

Path: Standard, all five phases. The Light profile trial doesn't fit: who may start a run is an auth default, one of
its irreversibility triggers.

### Acceptance frame

- [ ] **See it.** On `/assistant/trusted-assertions`, any signed-in person sees when their own Assistant on this
      instance last published Trusted Assertions (kind 30382), and how many it has published.
- [ ] **Recalculate it.** The Owner and active Customers get one button that recalculates their own scores and has
      their Assistant republish them, with the run shown as queued or running until it ends.
- [ ] **Only your own, one at a time.** Nobody can start a run for someone else, and pressing twice doesn't start
      two runs.
- [ ] **Honest for everyone else.** Admins who aren't Customers, and guests, see the status and a plain reason
      instead of a button.
- [ ] **On staging**, at staging.brainstorm.world/assistant/trusted-assertions.
- [ ] **Nothing else changes.** The hub's Scores mark, `/settings`, and the other hub pages are unchanged.

## Epics in this book

- `assistant-scores`: the Scores page (one story).

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/assistant-scores/audit.md`
- Product feedback: `engineering-team/audits/assistant-scores/prd-seed.md`
