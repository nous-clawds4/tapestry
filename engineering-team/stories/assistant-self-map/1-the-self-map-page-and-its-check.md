# Story 1: The self-Map page and its check

**Status:** Approved
**Created:** 2026-10-12
**Type:** Feature
**Epic:** `assistant-self-map`
**Book:** `engineering-team/audits/assistant-self-map/book.md`

## Background

The Assistant Management hub's **Your Assistant's Treasure Map** card leads to a placeholder page, and it is always
marked **Needs attention** (assistant-duty-cards #1). The protocol behind it is now ratified:
`protocols/drafts/treasure-maps.md` § 9.2, Self-Maps (`duty-menus-and-self-maps` #3, Done 2026-10-12).

A **self-Map** is an Assistant key's own kind 10040, read for its **self-entries**: entries whose element 2 is that
key itself. Each self-entry reports that the key is publishing, at the relay it names, and keeping up to date, the
insights it wins (§ 9.2, Meaning).
- **Not a duty.** It creates no duty. Duties come only from the person's own Map (§ 9).
- **Never more than is true.** It may claim only what is truly live. A self-entry is added only after the first full
  set has landed at its relay, and it is narrowed or removed before upkeep stops.
- **Readers believe it.** A reader counts an insight found at a self-entry's relay as maintained, whatever its age
  (§ 9.2, Maintained). So a false claim misleads every reader.

The Duty Menu (`/assistant/duty-menu`, book `assistant-duty-menu`) says what an Assistant **offers**; the self-Map says
what is **active** (`duty-menus.md` § 10). Together they let anyone switching a duty between Assistants see whether
the new one is already live.

The owner chose at intake (book Decisions 1–4):
- **On once, then kept true.** The person turns the self-Map on once, and the instance keeps it true by itself.
- **Done means on and true.** The card is Done when the self-Map found says exactly what this instance can truly
  claim now. Duties it can't claim don't hold the card back.
- **Three pages, cross-linked.** The Duty Menu is what's offered, this page is what's active, and `/treasure-map` is
  what the person asked for.
- **Every Assistant here.** The Owner's Tapestry Assistant (TA) and each customer's Assistant.

This story is the reading half, after the Duty Menu's split:
- what the self-Map *should* say;
- the self-Map found now;
- whether the two match, and the hub's real mark;
- the page that shows all of it.

Story 2 adds turning it on and off, and story 3 keeps it true by itself (epic § Stories).

**What the self-Map can truly say, found at intake on staging** (book § Facts found at intake; the Architect confirms
it):
- **Scores.** The Owner's Map gives the TA `3038x`, with `30382:rank` and `30382:followers` going to another key. The
  TA's menu offers only `30382` under it, at the staging relay. No TA-signed `30382` has landed there since
  2026-06-07 (ledger row `2026-10-12-ta-scores-stopped-landing`). So Scores are offered but not live.
- **Lists.** The Owner's Map gives Lists to another key. They are not the TA's duties, though the TA publishes Lists.
- **Concepts.** The Owner's Map gives the TA `39998` and `39999`. The TA's curated Concepts are at the staging relay,
  so Concepts can be claimed if they're kept up to date.

So the TA's self-Map on staging today would claim Concepts only. No "every duty my Map gives it" rule could be met.

Who is affected: everyone with a Tapestry Assistant on this instance. Later, the people and clients who read that
Assistant's self-Map before moving a duty to it.

## User-facing description

As someone with a Tapestry Assistant on this instance, I want to see which of the duties my Treasure Map gives my
Assistant are really live, what my Assistant's self-Map should therefore say, and what it says now, so that I know
whether anyone switching a duty to my Assistant can trust it.

## Acceptance criteria

- [ ] **AC-1: the answer is about the viewer's own Assistant, and only theirs.** Given a signed-in viewer who has an
      Assistant on this instance (the same answer the hub's other checks use: for the Owner the instance's TA, for
      anyone else their own Assistant), when the instance is asked, it answers for this action with:
  - **the duties**, and which are live (AC-2);
  - **what the self-Map should say** (AC-3);
  - **the self-Map found** now, or none, with whether the check finished and a reason when it did not (AC-4);
  - **true or not**: whether the two match (AC-5).

  The answer follows the session, and nothing in the request can change whose Assistant it is about. A visitor who is
  not signed in, or a signed-in viewer with no Assistant here, gets nothing for this action.
- [ ] **AC-2: the duties, and which are live.** The duties are read from the viewer's own Treasure Map (their kind
      10040), from each entry whose element 2 is that Assistant, with one item per part of the entry:
  - **Its parts.**
    - A part is offered at a relay, or not offered, as the Assistant's offer says. The offer is the one the Duty Menu
      check computes, so the two pages never disagree.
    - A part that a more specific entry of the viewer's Map gives to another key is not this Assistant's duty, and is
      shown as given elsewhere (`treasure-maps.md` § 6).
  - **Live.** An offered part is live only when all three hold:
    - this instance publishes those insights for that Assistant, at the relay the offer names;
    - the first full set has landed there;
    - upkeep is current.
  - **Upkeep is current.**
    - For Scores and Lists, refreshed on a schedule: the last scheduled upkeep for that Assistant and family finished
      and landed within about two of its scheduled intervals. One missed or failed run is a brief gap and keeps the
      part live; two in a row is a stop (open question 1).
    - For Concepts, which are published when the person curates: live when every Concept the person has curated
      through that Assistant has landed at the relay.
  - **A reason for every offered part that isn't live**, one of:
    - this instance doesn't publish it for this Assistant yet (customers' Lists, `_intake.md` 2026-10-11);
    - there is nothing to publish yet (for example, no Concept curated);
    - the first full set hasn't landed;
    - upkeep has stopped, with the date it last landed.
- [ ] **AC-3: what the self-Map should say.** It is a list of self-entries, each `[key, Assistant, relay]`, built only
      from live parts, conforming to `treasure-maps.md` § 9.2:
  - **Its key.**
    - Each self-entry uses the viewer's entry key verbatim where every insight that key would win, and speak for, is
      live at one relay.
    - Otherwise it uses narrower keys, so that it never wins a part that is not live, not offered, or published at
      another relay ("Its key", "More than one relay", "A part A does not publish").
    - Concept keys follow § 9.2 "Ties" and § 4.5 as the spec reads at Implementation (book § Shared lines; story 4 of
      `duty-menus-and-self-maps` may settle the `39998`/`39999` order first).
  - **Its relay.** The relay is the one the Assistant's offer gives that key, never empty ("Its relay").
  - **What it never has.**
    - a key that is a Concept kind and a colon alone;
    - two self-entries with the same key;
    - the viewer's Preferred and Alternate order, or entries naming other keys;
    - a self-entry that speaks for no live insight.
  - **Nothing live, nothing claimed.** Given an Assistant with no live part, including one whose viewer's Map gives it
    nothing, the self-Map should say nothing.
  - **Example**, the staging facts above: Scores not live, Concepts live at the staging relay. Then it holds only
    Concept self-entries at the staging relay: no `3038x`, no `30382`, and no Lists.
- [ ] **AC-4: which self-Map is "found".** The self-Map is looked up as `treasure-maps.md` § 9.2, "Finding a self-Map",
      says, with this instance's own relay asked too. It is the latest version among the answers: the latest
      `created_at`, and on a tie the lowest id.
  - **Its self-entries** are its entries whose element 2 is its author. Entries naming other keys are not part of it.
    For the Owner's TA they are this instance's own Treasure Map. Self-entries keyed by a Concept kind and a colon
    alone are ignored, as readers ignore them.
  - **Finished**: at least one relay asked, this instance's own relay included, answered. A relay that doesn't answer
    in time is skipped.
  - **Reasons when it did not finish:** no relay answered; the instance itself did not answer.
- [ ] **AC-5: true, the hub's mark, and the count line.**
  - **True** means the found self-entries are the same as what the self-Map should say. They are compared by key, as
    Treasure Maps reads keys, and by relay, in any order. Both empty is true: nothing to claim.
  - **The card.** It is **Done** when the check finished and the self-Map is true, and it shows the hub's **Done**
    badge. Otherwise it is marked **Needs attention**, including while the check is running and when it did not
    finish.
  - **The count line** counts the card the same way it is marked. At zero it reads **Nothing needs attention**
    (open question 2). The top-bar pill already hides at zero, and stays as it is.
  - **The Assistant Alert** counts the action only on the confident reading: the check finished, and the self-Map
    found is not true.
  - **Everything else is unchanged.** The other actions are marked and counted as today. Visitors and viewers without
    an Assistant see no marks and no pill.
- [ ] **AC-6: the page.** `/assistant/treasure-map` replaces its placeholder, styled like the hub's other built
      pages. It has the back link to Assistant Management, the title **Your Assistant's Treasure Map** and the card's
      description.
  - **Signed out, or no Assistant here.** As on the Duty Menu page: the sign-in line and button, or the hub's
    no-assistant line and its link to Account Setup. Neither sees the panels.
  - **Your Assistant's duties.** One line per part (AC-2), each showing its category (Scores, Lists or Concepts, as
    `/treasure-map` names them), its key, and one of these:
    - **Active**, with its relay: live, and the found self-Map claims it at that relay;
    - **Offered but not active**, with the reason: live but the self-Map doesn't claim it yet, or one of AC-2's
      reasons;
    - **Not offered**: the Assistant's offer has no relay for it.

    A part given elsewhere says so. A part that the found self-Map claims but that is not live, or not offered, says
    that too. When the viewer's Map gives the Assistant nothing, the panel says so, with a link to `/treasure-map`.
  - **What your Assistant's self-Map should say**: the self-entries of AC-3, each with its key and relay, or a line
    saying there is nothing to claim yet.
  - **Your Assistant's published self-Map**: **Checking…** while the answer is on its way, then the reason when the
    check did not finish, a line saying none was found, or the found self-entries, shown like the panel above. It
    carries the hub's **Needs attention** or **Done** mark for this action.
  - **One status line**, from AC-5: up to date, not published yet, or out of date.
  - **The three pages, linked.** One line links to the Duty Menu, for what the Assistant offers. Another links to
    `/treasure-map`, for the duties the viewer gives.
  - **For the Owner only:** a line saying that this Assistant's Treasure Map is also this instance's own, with how
    many other entries it holds. Those entries are not part of the self-Map, and this page never changes them.
  - **One line saying that the self-Map is public.**
- [ ] **AC-7: read-only, one request.** Nothing is published, signed or stored by this story, and the page has no
      button.
  - The answer comes with the other actions' answers, in the one request the hub already makes once per full page
    load for a signed-in viewer with an Assistant.
  - There is no polling.

## Copy

- **From the card and the hub:**
  - the page title and description are the card's (`actions.js`);
  - the back link, sign-in button, no-assistant line and link, and **Needs attention** come from assistant-management
    #1 § Copy;
  - the **Done** badge, with the screen-reader prefix **Done: **, comes from assistant-profile-checklist #1 § Copy.
- **The card's criteria line** (today none): "If your Assistant's self-Map is missing, or says anything other than
  the duties that are live now."
- **Signed out:** "Sign in to see your Assistant's Treasure Map."
- **Duties panel:** heading **Your Assistant's duties**.
  - Under it: "The duties your Treasure Map gives your Assistant, and which of them are live now."
  - Statuses: **Active**, **Offered but not active**, **Not offered**.
  - Reasons:
    - "Live, but your Assistant's self-Map doesn't say so yet."
    - "This instance doesn't publish these for your Assistant yet."
    - "Nothing to publish yet."
    - "Not published yet."
    - "Not kept up to date: last landed <date>."
    - *Added at Architecture, 2026-10-12 (ADR 0001 § Story deviations; owner-approved):*
      - "This instance publishes these in an older form that Treasure Map readers can't find yet."
      - "Not kept up to date: no upkeep is scheduled on this instance."
      - "This instance can't check this key yet, so it isn't claimed."
  - Given elsewhere: "Your Treasure Map gives this to another Assistant."
  - A false claim: "Your Assistant's self-Map claims this, but it isn't live."
  - Empty: "Your Treasure Map gives your Assistant no duties." plus a link to **your Treasure Map**.
- **Should-say panel:** heading **What your Assistant's self-Map should say**.
  - Under it: "Only the duties that are live now, each at the relay where it is published."
  - Empty: "Nothing to claim yet."
- **Published panel:** heading **Your Assistant's published self-Map**.
  - Checking: **Checking…**
  - None: "No self-Map was found for your Assistant."
  - Could not check: "No relay answered, so your Assistant's self-Map could not be checked." / "Could not check: this
    instance did not answer."
- **Status lines:**
  - "Your Assistant's self-Map is up to date."
  - "Your Assistant has not published a self-Map yet."
  - "Your Assistant's self-Map is out of date: it differs from the duties that are live now."
- **Links:**
  - "What your Assistant offers: **Duty Menu**"
  - "The duties you give your Assistants: **your Treasure Map**"
- **Owner line:** "Your Assistant's Treasure Map is also this instance's own Treasure Map. Its <N> other entries are
  this instance's choices, not part of the self-Map, and this page never changes them."
- **Public line:** "Your Assistant's self-Map is public. Anyone can read which duties it reports as live."
- **Count line at zero:** "Nothing needs attention".
- **Category names:** **Scores**, **Lists**, **Concepts** (`/treasure-map`'s).

## Concepts touched

- `39998:<TA>:nostr-user`: nostr user. Whose Assistant: the viewer's own.
- `39998:<TA>:nostr-relay`: Nostr relays. The self-entries' relays are the offer's.

No concept changes and no firmware reinstall. The Architect resolves handles if needed (no live stack here).

## Out of scope

- **Later stories in this book:**
  - turning the self-Map on and off, and the merge that keeps the event's other entries (story 2);
  - keeping it true by itself (story 3);
  - the Counting Maps rule and the hub's self-entry reading (story 4);
  - `/treasure-map`'s Active and Standby-ready badges (story 5).
- **Changing what this instance publishes, or where.** That includes why Scores stopped landing (ledger row
  `2026-10-12-ta-scores-stopped-landing`), customers' Lists (`_intake.md` 2026-10-11), and the Map-vs-menu relay
  (ledger row `2026-10-11-nip85-home-relay-without-copy`).
- **Changing the Duty Menu or its offer.** This story reads the offer as the Duty Menu check computes it.
- **Other Assistants' self-Maps**, the read-time fallback (§ 3), and `/treasure-map`'s fill and "Make preferred".
- **Private duties** in a Map's `.content` (§ 9.2, Private duties): this story reads public entries only.
- **Any change under `protocols/`.** If § 9.2 changes before Review, this story follows it (book § Shared lines).

## Open questions

**Answered by the owner, 2026-10-12, at planning.** The owner approved the story as drafted the same day ("Ready for
Architecture"), with seven ACs kept as one story.

1. **The brief gap.** How long can scheduled upkeep fail before a duty stops counting as live?
   - (a) One missed run is a gap: live while the last run finished and landed within about two scheduled intervals.
     Two in a row is a stop.
   - (b) A fixed 24 hours.
   - (c) A fixed 7 days.

   **Recommended: (a).** *Owner: (a).*
2. **The count line at zero.** Once this card has a real check, a fully set-up viewer's hub would read "0 actions need
   attention" (carry-forward `assistant-coming-soon` §6 #3).
   - (a) "Nothing needs attention".
   - (b) Hide the line at zero.
   - (c) Keep the wording.

   **Recommended: (a).** *Owner: (a).*

## Deviations

- **AC-2's reasons gain three** (Architecture, 2026-10-12, ADR 0001 § Story deviations, approved by the owner at
  its gate): `older-form` for the TA's Lists, whose `d` tags no Treasure Maps key reaches (§ 5.1); `not-scheduled`
  when no enabled schedule re-signs the family; `unchecked` for key shapes the check doesn't reason over yet. Their
  words are in § Copy.
- **No List is claimed on this instance** until its Lists take Treasure Maps `d` tags (ADR 0001 open question 2,
  owner: (a); ledger row `2026-10-12-list-d-tags-not-treasure-maps`). This follows AC-2's "live" rule; it is listed
  here because it means no List line is ever **Active** yet.
- **Implementation judgment calls** (Implementation, 2026-10-12; no word of § Copy changed):
  - "Not kept up to date: last landed <date>." shows the date as the month written out, the day and the year, in UTC
    (e.g. "June 7, 2026"), so every viewer reads the same day.
  - When the check did not finish, the duties and should-say panels show only their explainers: the published panel's
    reason is the one line, as on the Duty Menu page. Part-read duties could otherwise read as "no duties".
  - Self-entries (should-say and published) show their category too, read from the key as the Duty Menu page reads it,
    so they line up with the duties panel.

## Linked artifacts

- ADR: `engineering-team/decisions/assistant-self-map/0001-a-self-map-check-from-what-has-landed.md` (Amendment 1 at Test Design; Amendment 2 from review round 1)
- Test plan: `engineering-team/stories/assistant-self-map/1-the-self-map-page-and-its-check.test-plan.md`
- Review: `engineering-team/reviews/assistant-self-map/1-the-self-map-page-and-its-check.md` (round 1, 2026-10-12)
