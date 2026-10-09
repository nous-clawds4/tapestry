# Story 2: The Outbox Relays page — your Assistant's outbox relays, adding by hand, suggestions, removing

**Status:** Approved
**Created:** 2026-10-09
**Type:** Feature
**Epic:** `assistant-outbox-relays`
**Book:** `engineering-team/audits/assistant-outbox-relays/book.md`

## Background

Story 1 adds the hub's Outbox Relays card and the instance's answer to "which outbox relays does this
viewer's own Assistant's relay list name". The card leads to `/assistant/outbox-relays`, a placeholder
until this story.

The owner's words for the page: "styled to match the style of the Assistant Management page, the purpose
of which is to add and remove relays from the Outbox. The user will be able to add a relay by hand; in
addition, we will have some suggested relays, which the user can add one at a time or accept all at
once."

Settled at intake (book § Decisions): the suggestions are **where the Assistant already publishes**
(Decision 2), and every edit stays on screen until **one publish button** sends the whole list (Decision
4; the button is story 3). The page manages the outbox only (Decision 3).

## User-facing description

As someone with a Tapestry Assistant on this instance, I want one page where I can see my Assistant's
outbox relays, add relays by hand or from a list of suggestions, and remove ones I don't want, so that I
can get my Assistant's relay list right before it publishes it.

## Acceptance criteria

- [ ] **AC-1: the page and its states.** `/assistant/outbox-relays` replaces its placeholder, styled like
      the hub and the Identification Tags page: the back link to Assistant Management, the title **Outbox
      Relays**, and the card's description with its NIP-65 link.
  - A visitor who is not signed in sees a line asking them to sign in, with the sign-in button; a
    signed-in viewer with no Assistant here sees the hub's no-assistant line and its link to Account
    Setup. Neither sees the list, the suggestions or the field.
  - For a viewer with an Assistant, a panel **Your Assistant's outbox relays** shows story 1's answer:
    **Checking…** while it is on its way; the reason, when the check did not finish; otherwise the outbox
    relays, in the list's order, or a line saying there are none yet. The panel carries the hub's
    **Needs attention** or **Done** mark for this action, the same answer the hub card shows.
  - When the Assistant's relay list also names inbox-only relays, one line says how many, and that this
    page leaves them as they are.
- [ ] **AC-2: an on-screen draft.** The list on screen starts as the outbox relays in story 1's answer and
      is rebuilt from each new answer. Adding and removing change only the list on screen: nothing is
      published, signed or stored until the person presses story 3's button. While the list on screen
      differs from the published one, a line says there are changes not yet published. A reload or a
      navigation discards them. When story 1's check did not finish, the list starts empty and the person
      can still edit it.
- [ ] **AC-3: adding a relay by hand.** A field and an **Add** button add a relay to the end of the list on
      screen and clear the field.
  - Accepted: a `wss://` or `ws://` address with a host. Spaces around it are trimmed.
  - Two addresses are the same relay when they differ only in the host's letter case or one trailing
    slash.
  - Refused, with a line saying why and nothing added: an address that is not a relay address; a relay
    already on the list.
- [ ] **AC-4: suggested relays.** A panel **Suggested relays** lists where the Assistant already publishes:
      this instance's own relay (at its public address, when the instance has one), then the relays in
      Relay Settings' General Purpose, Trusted Assertion, Trusted List, DList and Outbox lists, in that
      order, each relay once, leaving out any already on the list on screen.
  - Each suggestion has its own **Add** button, which adds it to the end of the list on screen and takes
    it out of the suggestions.
  - An **Add all** button adds every suggestion shown, in the order shown.
  - When every suggestion is already on the list, the panel says so; when there are none at all (an
    instance with no public address and empty lists), it says that instead.
  - Editing those Relay Settings lists changes the suggestions at the next page load, with no code change.
- [ ] **AC-5: removing a relay.** Each relay on the list on screen has a **Remove** button, which takes it
      off the list on screen. A removed relay that is a suggestion returns to the suggestions. Each Add and
      Remove button names its relay to a screen reader.

## Copy

- Back link, sign-in button, no-assistant line and link, **Needs attention**: the hub's
  (assistant-management #1 § Copy). **Done**: story 1 § Copy.
- Signed-out line: "Sign in to manage your Assistant's outbox relays."
- Panel heading: **Your Assistant's outbox relays**
- None yet: "Your Assistant has no outbox relays yet."
- Checking: **Checking…**
- Could not check: "Could not read this instance's relay." / "No relay list on this instance's relay, and
  no outside relay is configured to check." / "No relay list on this instance's relay, and no outside
  relay answered." / "Could not check: this instance did not answer."
- Inbox-only line: "Your Assistant's relay list also names 1 inbox relay; this page leaves it as it is." /
  "… names {n} inbox relays; this page leaves them as they are."
- Unpublished line: "You have changes that are not published yet."
- Field label: **Add a relay**; placeholder `wss://relay.example.com`; button **Add**.
- Refusals: "A relay address starts with wss:// (or ws://)." / "That relay is already on the list."
- Suggestions heading: **Suggested relays**; under it: "Relays your Assistant already publishes to, from
  this instance's relay settings."
- Buttons: **Add**, **Add all**, **Remove**. Screen-reader names: "Add {relay}", "Remove {relay}".
- All on the list: "Every suggested relay is on the list." None at all: "This instance has no relays to
  suggest."

## Concepts touched

- `39998:<TA>:nostr-relay` — Nostr relays (the suggestions come from the instance's relay settings, as the
  profile publish's relays do; whether the concept's relay sets are read instead is an Architecture
  question, as it was for assistant-profile #2).

No concept changes; no firmware reinstall.

## Out of scope

- Publishing the list, and the report (story 3).
- Reordering the list.
- Testing whether a relay is reachable before it is added.
- Managing inbox (`read`) relays.
- Saving a draft across reloads.

## Open questions

None.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
