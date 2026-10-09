# Story 3: Your Assistant publishes its relay list

**Status:** Approved
**Created:** 2026-10-09
**Type:** Feature
**Epic:** `assistant-outbox-relays`
**Book:** `engineering-team/audits/assistant-outbox-relays/book.md`

## Background

Story 2 gives the Outbox Relays page an on-screen list the person edits. This story publishes it: one
button, which has this instance sign the whole list as the person's own Assistant (book Decisions 1 and
4). Only this instance holds the Assistant's key, as for the Identification Tags page's second card,
whose narrow, session-bound publish (assistant-identification-tags #3) is the pattern here: the
signed-in person's own Assistant only, this instance's relay first, then outside relays, each relay's
answer reported in the profile publish's words (assistant-profile #2).

The event is a NIP-65 relay list (kind 10002, replaceable): one `r` tag per relay, each with an optional
`read` or `write` marker, none meaning both. The page manages the outbox only (Decision 3): relays it adds
are marked `write`, and inbox-only (`read`) entries are kept as they are.

## User-facing description

As someone with a Tapestry Assistant on this instance, I want to press one button and have my Assistant
publish the outbox relays I chose, and see which relays took it, so that other clients can find what my
Assistant publishes, and I know when they can't.

## Acceptance criteria

- [ ] **AC-1: the button and its report.** The page has one button, **Have your Assistant publish**, for a
      viewer with an Assistant. It is enabled while the list on screen differs from the published one (when
      story 1's check did not finish, while the list on screen has at least one relay), and shows
      **Publishing…** (disabled) while a publish is under way.
  - When it answers, the page shows one summary line and one line per relay — accepted, refused (with the
    relay's own reason), unreachable or timed out, or kept local by configuration — in the words and
    styles of the Identification Tags page's report. A whole-request refusal, or a request that never
    answers, is one line saying nothing was published.
  - Then the instance's answer is asked for again, so the page's list and mark, the hub card, the count
    line and the Assistant Alert all reflect the new list. The report stays until the next press or a
    navigation.
- [ ] **AC-2: whose key, and nothing else.** The request names relays only; whose Assistant signs comes
      from the session (the one main→delegate mapping: for the Owner the instance TA, for anyone else their
      own). Refusals come first, before any key is read: not signed in; a request that is not a list of
      relay addresses (story 2 AC-3's rule, at most 50 relays, no relay twice); no Assistant on this
      instance. The action signs a kind 10002 and nothing else, and no other route gains the power to sign
      as an Assistant. Nothing publishes a relay list at Assistant creation.
- [ ] **AC-3: the event.** A kind 10002 signed by the person's own Assistant, with empty content and one
      `r` tag per relay, in this order:
  - the relays on the list on screen, in its order. A relay that was already in the Assistant's newest
    relay list keeps its marker (none stays none; `write` stays `write`); every other relay is marked
    `write`;
  - then every inbox-only (`read`) entry of the newest relay list, unchanged — unless the same relay is on
    the list on screen, where it appears once, with no marker (both);
  - a relay removed on the page is not in the event at all, whatever its marker was: one that had no
    marker (inbox and outbox) loses its inbox role too (book Decision 6).
  - "The newest relay list" is the one the instance finds at publish time, by story 1's lookup (this
    instance's relay first). When it finds none, there is nothing to keep.
- [ ] **AC-4: where it goes.** The relay list is written to this instance's relay first. If that write
      fails, nothing is sent anywhere else, and the person is told so.
  - Then it goes, each relay once, to: every relay the new list names; every relay the previous list named
    (so no relay keeps an older list); and the relays this instance publishes Assistant profiles to
    (assistant-profile #2: the General Purpose, Profile and WoT lists), which story 1 reads it back from.
  - In local-only publish mode, it is kept on this instance's relay and the report says so.
  - A relay counts as reached only when it accepted the event. Slow, down or broken relays cost their own
    line and nothing else; the person gets the report within a bounded time.
- [ ] **AC-5: an empty outbox.** Publishing a list with no outbox relays is allowed, with no confirmation
      step (book Decision 7). The report says so, and the hub card then needs attention.

## Copy

- Button: **Have your Assistant publish**; while publishing: **Publishing…** (the Identification Tags
  page's words).
- Summary, with the subject **Your Assistant's relay list**, in the profile publish's sentence shapes:
  - "Your Assistant's relay list was saved on this instance's relay and accepted by {a} of {n} relays."
    (+ " {n − a} did not accept it; see below." when some did not)
  - "Your Assistant's relay list was saved on this instance's relay, but none of the {n} relays accepted
    it; see below."
  - "Your Assistant's relay list was saved on this instance's relay only: local-only publish mode is on,
    so it was not sent to any other relay."
  - "Your Assistant's relay list could not be saved on this instance's relay ({reason}), so it was not
    sent to any other relay."
- Empty outbox, after the summary: "Your Assistant now has no outbox relays."
- Refusals: "Sign in to have your Assistant publish its relay list." / "You don't have a Tapestry
  Assistant on this instance yet." / "That is not a list of relay addresses." / and, for a request that
  fails or never answers: "This instance did not answer; nothing was published."
- Per-relay lines: the Identification Tags page's (`relayLine`).

## Concepts touched

- `39998:<TA>:nostr-user` — nostr user (whose Assistant signs; the viewer's own).
- `39998:<TA>:nostr-relay` — Nostr relays (where the list goes).

No concept changes; no firmware reinstall.

## Out of scope

- Publishing a relay list at Assistant creation, or republishing when Relay Settings change.
- Retrying failed relays later.
- Managing inbox relays, beyond keeping the inbox-only ones (AC-3).
- Making the Assistant's other publishers (trusted assertions, trusted lists, DLists) send to the relays
  the list names (epic § Deferred).
- The person's own kind 10002.

## Open questions

None. Resolved at approval (2026-10-09):

1. **Removing a relay that is both inbox and outbox** (no marker): it is dropped entirely, as "Remove"
   suggests, not kept as inbox-only (book Decision 6). Such an entry can only exist if a relay list was
   published for the Assistant some other way, since this page marks what it adds `write`.
2. **Publishing an empty outbox:** allowed, with no confirmation step; the report and the card's mark say
   what happened (book Decision 7).

## Linked artifacts

- ADR: `engineering-team/decisions/assistant-outbox-relays/0003-the-assistant-signs-its-relay-list-through-one-narrow-route.md`
- Test plan: `engineering-team/stories/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.test-plan.md`
- Review: (filled in after Review phase)
