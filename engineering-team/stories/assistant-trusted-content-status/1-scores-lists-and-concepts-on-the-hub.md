# Story 1: Scores, Lists and Concepts on the hub — renamed to the Treasure Map's categories, each Done when your Map gives it to your Tapestry Assistant

**Status:** Approved
**Created:** 2026-10-08
**Type:** Feature
**Epic:** `assistant-trusted-content-status`
**Book:** `engineering-team/audits/assistant-trusted-content-status/book.md`

## Background

The hub at `/assistant` (assistant-management #1) opens its *Publication of Trusted Content* section with three
cards: **Trusted Assertions**, **Trusted Lists** and **Decentralized Lists**. All three are placeholders, so for
everyone with an Assistant they are always marked **Needs attention**, and the Assistant Alert in the top bar
counts them, whatever the person has actually set up.

The Treasure Map page at `/treasure-map` (manage-treasure-map #2) groups the same three kinds of content into
three categories: **Scores** (trust scores, kinds 30380–30389), **Lists** (curated lists, kinds 30390–30399) and
**Concepts** (structured datasets, kinds 39998 and 39999). It names which of the person's Assistants their
Treasure Map (kind 10040) gives each category to.

The owner asked for the hub's three cards to take the Treasure Map's names, and for each card to show truthfully
whether it is completed or needs attention. At intake the owner chose what "completed" means (book, Decision 1):
**the person's Treasure Map gives that category to their Tapestry Assistant on this instance**, alone or alongside
other Assistants.

This differs from `/treasure-map`'s own **Needs attention** pill (treasure-map-card-details #1), which marks a
category with *no* Assistant at all. The hub is about what your Tapestry Assistant does, so a category held only by
another provider's Assistant (Brainstorm's, say) is fine on `/treasure-map` and needs attention on `/assistant`.
This difference is intended.

Two books opened the same day change the same hub answer. `assistant-profile-checklist` #1 (AC-6) gives the hub a
**Done** badge for any checked action that is done, and `assistant-outbox-relays` #1 adds an eleventh action
(book § Shared lines). This story's three cards use that Done badge; whichever story is built first adds it, and
the others reuse it.

## User-facing description

As someone with a Tapestry Assistant on this instance, I want the hub's Scores, Lists and Concepts cards to say
**Done** once my Treasure Map gives each of them to my Tapestry Assistant, and **Needs attention** until then. That
way the hub's marks, its count and the reminder in the top bar tell the truth about what my Assistant publishes for
me, using the same names as my Treasure Map.

## Acceptance criteria

- [ ] **AC-1: the names.** On `/assistant`, the first three cards under *Publication of Trusted Content* read
      **Scores**, **Lists** and **Concepts**, in that order, still before Bounties, Pins and Tags. Each card keeps its
      description, its NIP link and its address (`/assistant/trusted-assertions`, `/assistant/trusted-lists`,
      `/assistant/dlists`). The page behind each card carries the new name as its heading, and its *Alert criteria*
      gives the rule in plain words (§ Copy) instead of "Not yet defined." Each of the three pages also carries one
      link, **Manage your Treasure Map →**, to `/treasure-map` (Open question 1). Nothing else on those pages changes.
- [ ] **AC-2: one answer, about the viewer's own Map and Assistant, read-only.**
  - Given a signed-in viewer who has an Assistant on this instance (the same answer that marks `/setup`'s first
    step done: for the Owner the instance TA, for anyone else their own), when the instance is asked, it answers
    for each of Scores, Lists and Concepts whether it is **done** or **needs attention**, whether the check
    **finished**, and a reason when it is not done.
  - The Map is the viewer's own newest Treasure Map (kind 10040 signed by the viewer), found where `/treasure-map`
    finds it: this instance's relay first, then the general-purpose relays.
  - The answer follows the session. No parameter changes whose Map is read or which Assistant is looked for.
  - Given a visitor who is not signed in, or a signed-in viewer with no Assistant here, the answer has nothing for
    these three (as for Identification Tags today).
  - Nothing is published, signed or stored by the check. The answer comes with the other actions' answers, in the
    same single request the hub already makes.
- [ ] **AC-3: the rule.** A category is **done** when the viewer's Assistant on this instance is among the
      Assistants the Map gives that category to, read exactly as `/treasure-map`'s cards read it. The same entries
      count for the same category, including an all-duties `*` entry, and the same entries are ignored. Otherwise
      it **needs attention**, with one of these reasons: **no Map** (no Treasure Map was found), **not assigned**
      (the Map gives the category to no Assistant), **other Assistants only** (the Map gives it only to Assistants
      other than the viewer's here). For example:

      | The Map gives Scores to… | Scores on `/assistant` |
      |---|---|
      | the viewer's Assistant here, only | Done |
      | the viewer's Assistant here and another Assistant ("Mixed") | Done |
      | everything (`*`) to the viewer's Assistant here, and nothing else | Done |
      | only another Assistant | Needs attention: other Assistants only |
      | nobody | Needs attention: not assigned |
      | *(no Map found)* | Needs attention: no Map |
- [ ] **AC-4: finished, as `/setup` means it.** The check **finished** when the Map was found, or when this
      instance's relay held none and at least one general-purpose relay answered. It did **not** finish when this
      instance's relay could not be read, or when it held none and no general-purpose relay answered or none is
      configured. An unfinished category is neither done nor needing attention, and says why.
- [ ] **AC-5: the hub reads it.**
  - Each of the three cards is marked **Needs attention** unless its check finished and says done. While the check
    is running, or when it did not finish, the card stays marked, as `/setup` shows a step as not done until it
    knows.
  - Given a category is done, its card shows the hub's **Done** look instead: a green ✓ marker, a green **Done**
    badge, and the screen-reader prefix **Done:** before the title. This is the same Done look as
    assistant-profile-checklist #1 AC-6. The same applies to any checked action that is done, so the Identification
    Tags card shows it too when its check is done. A placeholder action never shows Done.
  - The hub's count line counts the three cards the same way they are marked.
  - The Assistant Alert counts a category only when its check finished and found it needing attention (the
    confident reading, as for Identification Tags).
  - The other actions are marked and counted exactly as before. Visitors and viewers without an Assistant see no
    marks and no pill, as today.
- [ ] **AC-6: it catches up after a Map save.** After the person saves their Treasure Map in this app (Edit → Save
      changes on `/treasure-map`), the hub's marks, its count line and the Assistant Alert reflect the saved Map
      without a full page reload. There is no polling: a Map changed in another app or tab shows on the next full
      page load.

## Copy

- Card and page titles: **Scores**, **Lists**, **Concepts**.
- The hub's Done badge: **Done**, with the screen-reader prefix **Done: ** before the card's title (shared with
  assistant-profile-checklist #1 § Copy).
- *Alert criteria* on each card's page:
  - Scores: "Needs attention until your Treasure Map gives Scores to your Tapestry Assistant on this instance, on
    its own or alongside other Assistants."
  - Lists: "Needs attention until your Treasure Map gives Lists to your Tapestry Assistant on this instance, on its
    own or alongside other Assistants."
  - Concepts: "Needs attention until your Treasure Map gives Concepts to your Tapestry Assistant on this instance,
    on its own or alongside other Assistants."
- The link on each of the three pages: **Manage your Treasure Map →**, to `/treasure-map`.
- The count line is unchanged: "{n} actions need attention" / "1 action needs attention".
- The reasons (AC-3, AC-4) are in the answer, for a later page; no reader sees them in this story.

## Concepts touched

- `39998:<TA>:nostr-user` — nostr user (whose Map, and whose Assistant: the viewer's own).

The Treasure Map is a kind 10040 event, not a concept-graph node. No concept changes; no firmware reinstall.

## Out of scope

- Showing each category's status, or its reason, on the page behind its card, and any one-click fix there (such as
  "assign this to my Tapestry Assistant"), beyond the one link to `/treasure-map`. Changing the Map stays the
  Treasure Map page's job.
- Renaming the cards' addresses, their descriptions or NIP links, or the FAQ's words (which still say "Trusted
  Assertions", "Trusted Lists" and "Decentralized Lists").
- Whether the Assistant actually publishes Scores, Lists or Concepts events. The check reads only where the Map
  points.
- `/treasure-map`'s own Needs attention pill, which keeps its rule (a category with no Assistant).
- Bounties, Pins, Tags and the other actions' answers.
- Caching, polling, or a server-sent refresh.

## Open questions

1. **Should the page behind each card link to `/treasure-map`?** The three pages stay placeholders, so a person who
   follows a **Needs attention** card finds the rule but no way to act on it. One line, "Manage your Treasure Map
   →", on each of the three pages would give them the path. *Recommended: yes, that one link and nothing more.*
   *Settled 2026-10-08 at approval: yes, that one link and nothing more.*

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
