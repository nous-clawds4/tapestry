# Story 3: Pinned-note-aware profile "Content" card

**Status:** Done
**Created:** 2026-07-03
**Type:** Feature

## Background
The profile page (`/user/:pubkey`) ends with a "Content" section showing the viewed
user's **single most-recent kind-1 note** (`note-surfaces` #2). Two problems with
"most recent" as the selection rule:

1. If the user's latest activity is a reply, the card shows a conversation fragment
   with no context — a poor one-card summary of who they are.
2. nostr has a first-class answer to "which one note represents me": the **pin list**
   (NIP-51, kind-10001), which several clients already honor. If a user has pinned a
   note, that is the note they want leading their profile.

This story upgrades the card's selection order: **pinned note first, else latest
top-level (non-reply) note, else an explicit empty state.** The card still renders
exactly one note; only *which* note changes.

Affected: anyone viewing a user profile.

## User-facing description
As someone viewing a user's profile, I want the "Content" card to show the note that
user has pinned — or, if they haven't pinned one, their latest actual post rather than
a stray reply — so the card gives a fair one-note picture of the person.

## Acceptance criteria
Testable from the outside. "Reply" and "top-level" carry story 1's definitions; a
"pin list" is the viewed user's most recent kind-10001 event, its entries referencing
notes per NIP-51.

- [ ] **Pinned note wins.** Given the viewed user has a pin list referencing at least
  one resolvable note, when the profile page renders, then the "Content" card shows a
  pinned note and visibly labels it as pinned (so a reader knows this is a chosen
  note, not necessarily the latest).

- [ ] **One pinned note when several are pinned.** Given the pin list references more
  than one resolvable note, then the card shows exactly **one** of them, chosen by a
  deterministic rule (the Architect specifies the rule, favoring the entry the list's
  convention treats as most recently pinned).

- [ ] **Unresolvable pins fall through.** Given the viewed user has a pin list but
  none of its referenced notes can be resolved, when the page renders, then the card
  falls back to the non-pinned selection below — never an error or a permanently
  loading card.

- [ ] **No pin → latest top-level note.** Given the viewed user has no pin list (or
  an empty one) and has authored at least one top-level note, when the page renders,
  then the card shows their most recent **top-level** note — even when they have
  replies newer than it — without a "pinned" label.

- [ ] **Only replies, no pin → explicit empty state.** Given the viewed user has no
  usable pin and every locatable note of theirs is a reply, when the page renders,
  then the section shows an explicit message that the user has no top-level notes to
  feature, and the existing link to `/user/:pubkey/notes` remains available (where
  "Notes + Replies" shows their activity).

- [ ] **Existing empty state preserved.** Given the viewed user has no usable pin and
  no locatable kind-1 notes at all, then the section's pre-existing empty-state
  behavior still shows as before.

## Concepts touched
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-kind`
  — kind-10001 (pin list, read as a selector only), kind-1 (the shown note), kind-0
  (author display).
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user`
  — the viewed user (pin-list author and note author).
- `39999:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:the-set-of-general-purpose-relays`
  — where the pin list and pinned note are fetched from (Architect confirms sourcing).

> Resolve the TA pubkey at runtime per house rules; the handles above are this local
> instance's.

## Out of scope
- Rendering multiple pinned notes, a pin carousel, or a "Pinned" section separate from
  "Content".
- Pin management (creating/editing kind-10001) — read-only.
- Honoring pins anywhere other than the profile "Content" card (the feed pages and
  the notes page are untouched by this story).
- Any toggle on the card — the selection order is fixed, not user-switchable.
- Any write/publish; any change to search, ranking, tagging, or firmware.

## Open questions
None outstanding. One PO decision to confirm at approval: for a **reply-only, no-pin**
user, the card shows the empty-state message rather than falling back to their latest
reply (rationale: a context-free reply fragment misrepresents the user more than an
honest empty state; their activity remains one click away on the notes page).

## Linked artifacts
- ADR: `engineering-team/decisions/feed-usability/0003-profile-content-card.md`
- Test plan: `engineering-team/stories/feed-usability/3-profile-content-card.test-plan.md`
- Review: `engineering-team/reviews/feed-usability/3-profile-content-card.md` (PASS — 2026-07-03)
