# Story 1: The outbox check — which outbox relays your Assistant's relay list names — and the hub's Outbox Relays card

**Status:** Approved
**Created:** 2026-10-09
**Type:** Feature
**Epic:** `assistant-outbox-relays`
**Book:** `engineering-team/audits/assistant-outbox-relays/book.md`

## Background

The Assistant Management hub at `/assistant` has ten actions under three headings (assistant-management
#1). Its "Your Assistant's Public Persona" section holds two: the Assistant's profile and Identification
Tags. Only checked actions get a real "needs attention" answer, from one server answer that the hub, its
count line and the Assistant Alert all read (assistant-identification-tags #1); every other action is
always marked.

The owner asked for a third persona card, **Outbox Relays**, which "will be completed once there is at
least one outbox relay as specified in a kind 10002 event NIP-65". A Tapestry Assistant publishes on its
person's behalf around the clock; its NIP-65 relay list is how other nostr clients learn where to find
what it publishes. Today no Assistant has one: nothing in Tapestry publishes a kind 10002 for an
Assistant (`assistant-profile` deferred it).

In a NIP-65 relay list (kind 10002, replaceable), each `r` tag names a relay and may carry a marker:
`write`, `read`, or none, which means both. An **outbox relay** is one with no marker or `write`; an
inbox-only relay is one marked `read`.

This story adds the card and gives the instance one answer to "which outbox relays does this viewer's own
Assistant's relay list name". The page itself is story 2; publishing the list is story 3.

## User-facing description

As someone with a Tapestry Assistant on this instance, I want the hub to tell me whether my Assistant has
published where its events can be found, and to say it is done once it has, so that other clients can
find what my Assistant publishes for me, and the hub's marks, its count and the reminder in the top bar
tell the truth for this action.

## Acceptance criteria

- [ ] **AC-1: the card.** The hub's "Your Assistant's Public Persona" section has a third card, **Outbox
      Relays**, after Identification Tags, with the description in § Copy and its NIP-65 link (opening in a
      new tab, as the other NIP links do). A click anywhere on the card opens `/assistant/outbox-relays`.
      The hub now lists eleven actions; the other ten keep their order, words and pages.
- [ ] **AC-2: the answer is about the viewer's own Assistant, and only theirs.**
  - Given a signed-in viewer who has an Assistant on this instance (the same answer that marks `/setup`'s
    first step done: for the Owner the instance TA, for anyone else their own), when the instance is
    asked, it answers for this action: the **outbox relays** the Assistant's newest relay list names, in
    the list's order; how many **inbox-only** relays it also names; whether the check **finished**; and a
    reason when it did not.
  - There is no way to ask about another person or another Assistant: the answer follows the session, and
    no parameter changes whose it is.
  - Given a visitor who is not signed in, or a signed-in viewer with no Assistant here, the answer has
    nothing for this action (as for Identification Tags today).
- [ ] **AC-3: which relay list.** The relay list read is the Assistant's newest kind 10002 (newest
      `created_at`; NIP-01's rule on a tie), found on this instance's relay first; only when that holds
      none are the relays a relay list is always published to asked (story 3 AC-4: the relays this
      instance publishes Assistant profiles to), and then the newest found counts.
  - **Finished**, as `/setup` means it: this instance's relay held one, or held none and at least one
    outside relay answered. Reasons when not finished: this instance's relay could not be read; nothing
    here and no outside relay is configured; nothing here and no outside relay answered.
  - Given a relay list that names a relay more than once, it counts once. An `r` tag whose value is not a
    `ws://` or `wss://` address is ignored.
- [ ] **AC-4: the hub reads it.**
  - The card is **done** when the check finished and the list names at least one outbox relay. It is
    marked **Needs attention** otherwise, including while the check is running and when it did not finish,
    as `/setup` shows a step as not done until it knows. A relay list with only inbox-only relays, or no
    relay list at all, needs attention.
  - Given the card is done, it shows a **Done** badge instead of the mark: the hub's Done badge for checked
    actions (assistant-profile-checklist #1 AC-6), styled like the Done badge on the Identification Tags
    page's cards. Whichever of the two stories is built first adds the badge to the hub.
  - The hub's count line counts the card the same way it is marked.
  - The Assistant Alert counts the action only when the check finished and found no outbox relay (the
    confident reading, as for Identification Tags).
  - The other actions are marked and counted exactly as today. Visitors and viewers without an Assistant
    see no marks and no pill, as today.
- [ ] **AC-5: read-only, one request.** Nothing is published, signed or stored by the check. The answer
      comes with the other actions' answers, in the one request the hub already makes once per full page
      load for a signed-in viewer with an Assistant, and again on demand after a publish (story 3). No
      polling.

## Copy

- Card title: **Outbox Relays**
- Card description: "Let other clients and apps know where to find the events your Assistant publishes.
  Your Assistant lists its outbox relays in a relay list (kind 10002), according to **NIP-65**." — the
  last two words a link to `https://github.com/nostr-protocol/nips/blob/master/65.md`.
- The Done badge: **Done**, with the screen-reader prefix **Done: ** before the card's title (as
  assistant-profile-checklist #1 § Copy).
- The count line is unchanged: "{n} actions need attention" / "1 action needs attention".
- Until story 2 replaces it, the page behind the card is the hub's placeholder, with alert criteria "If
  your Assistant's relay list (kind 10002) names no outbox relay." and no planning notes.

## Concepts touched

- `39998:<TA>:nostr-user` — nostr user (whose Assistant; the viewer's own).
- `39998:<TA>:nostr-relay` — Nostr relays (the relays named in the list; the relay settings it is read
  from).

The relay list is a kind 10002 event, not a concept-graph node. No concept changes; no firmware
reinstall.

## Out of scope

- The page at `/assistant/outbox-relays` and publishing (stories 2 and 3).
- Whether the named relays are reachable, or hold the Assistant's other events.
- The inbox side of the list beyond counting it.
- Caching, polling, or a server-sent refresh.
- The other actions' answers.

## Open questions

None.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
