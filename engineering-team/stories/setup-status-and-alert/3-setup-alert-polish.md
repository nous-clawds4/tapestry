# Story 3: The Setup Alert — readable, announced as it reads, and current

**Status:** Approved
**Created:** 2026-09-21
**Type:** Bug
**Epic:** `setup-status-and-alert`
**Book:** `engineering-team/audits/setup-status-and-alert/book.md`

## Background

Story 2 shipped the Setup Alert to staging (PR #737). Its review passed with four non-blocking
findings (`engineering-team/reviews/setup-status-and-alert/2-the-setup-alert.md`, Non-blocking 1–4).
In each one the code did what the approved story or ADR said. The owner chose to fix all four in
this story (2026-09-21):

1. **The button is hard to read.** "Finish setup →" is white text on bright amber, a contrast of
   2.52:1, where the accessibility guideline (WCAG AA) asks for 4.5:1. On phones it is the pill's
   only text, and the pill shows on every page to every new user.
2. **What a screen reader or voice control hears doesn't match what is shown.** The pill is
   announced as "Finish setting up your account" at every width. Screen-reader users never hear how
   many steps are left. On phones the only words shown are "Finish setup", which the announced name
   doesn't contain, so a voice-control user can't activate it by saying what they see (WCAG 2.5.3).
3. **The pill falls behind in the same tab.** Following someone from a profile page, or saving your
   Treasure Map, publishes from inside the app. The pill and `/setup` keep counting that step until
   the next full page load. Story 2's description promises "I don't want it to nag me about a step
   I've done", and its out-of-scope line covered only other apps and other tabs.
4. **`/SETUP` shows the pill on the setup page.** The pages load whatever the letter case of the
   address, but the pill hides only on the lower-case spelling.

## The owner's answers (planning, 2026-09-21)

- **Chip text:** "Dark text on amber (Recommended)". The chip stays bright amber, and its text turns
  dark.
- **Spoken name:** "Whatever is on screen (Recommended)". The pill is announced exactly as it reads
  at each width. This replaces story 2's fixed name.
- **Same tab:** "Yes, after any in-app save (Recommended)". Wherever the app publishes the viewer's
  follow list or Treasure Map, the pill and `/setup` check again afterwards.

## User-facing description

As someone signed in who hasn't finished setting up, I want the setup reminder to be easy to read,
to be announced by my screen reader or voice control exactly as it appears, and to catch up as soon
as I finish a step in the app, so that I can act on it and it never nags me about a step I've just
done.

## Acceptance criteria

- [ ] **AC-1 — the button reads clearly.** Given the pill showing, at any width, the "Finish setup
      →" text contrasts with its chip by at least 4.5:1. The chip stays amber and its text is dark.
      The pill's other text keeps at least 4.5:1 against the pill.
- [ ] **AC-2 — it is announced as it reads.** Given the pill showing:
  - at 1280 px its accessible name is its visible words: "Finish setting up your account · N steps
    left Finish setup" ("· 1 step left" when one is counted);
  - at 800 px, where the count is hidden, it is "Finish setting up your account Finish setup";
  - at 375 px it is "Finish setup";
  - the ⚠ mark and the arrow are decorative and are not announced;
  - it is still one link to `/setup` that can be reached with Tab and activated with Enter.

  This replaces story 2's "The pill's accessible name stays 'Finish setting up your account'"
  (AC-5) and its § Copy row "Accessible name of the whole pill". The visible words are unchanged.
- [ ] **AC-3 — it catches up after an in-app save.** Given a signed-in viewer, when the app publishes
      their follow list or their Treasure Map, from any page that does so, then without a page
      reload, within a few seconds of the publish succeeding:
  - the pill's count and `/setup` show the new answer. A step that became done stops being counted,
    and one that became not done is counted again;
  - while the new check runs, neither shows the old answer as current. Story 2's "two kinds of not
    done" hold: the pill counts only a finished check.
- [ ] **AC-4 — hidden on the setup pages whatever the case.** Given a viewer with steps left, on
      `/setup` or one of its three step pages spelled in any letter case (for example `/SETUP` or
      `/Setup/Follow`), no pill appears.
- [ ] **AC-5 — nothing else changes.** Everything else in story 2's acceptance criteria still holds:
      where the pill appears, what it counts, when it hides, the three widths, no top bar scrolling
      sideways, and nothing published, signed or stored by the pill or its checks.

## Copy

No new words. The sentence, the count and "Finish setup →" are story 2's, unchanged. Only the
announced name changes (AC-2).

## Concepts touched

None changed. The orientation handles are story 1's: `39998:<TA>:tapestry-assistant`,
`39998:<TA>:nostr-user`, `39998:<TA>:nostr-relay`.

## Out of scope

- **Publishes made outside this app, or in another tab.** They still show on the next full page
  load.
- **Any other change to the pill's look.** Its amber pill, sizes and breakpoints stay as story 2
  shipped them.
- **The step pages, `/assistant`, the Dashboard's Getting-Started checklist, and the avatar menus.**
- **An accessibility audit of the rest of the app.** The harness gap that let finding 1 through is
  ledger row `2026-09-21-no-accessibility-baseline-without-prd`.

## Open questions

None. The owner answered the three at planning (2026-09-21), recorded above.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
