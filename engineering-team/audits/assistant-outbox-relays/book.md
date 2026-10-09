# Book of Work: Outbox Relays — your Assistant's relay list, and the hub's third persona card

**Slug:** assistant-outbox-relays
**Status:** Closed
**Opened:** 2026-10-09
**Closed:** 2026-10-09 (on `staging`, deployed to staging.brainstorm.world; production pending, PR #829)

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-10-09) and settled through four
questions there. Completion is *judged* against the bullets below.

The ask, verbatim (copied from the session transcript, not retyped):

> On the Assistant Management page at  https://staging.brainstorm.world/assistant, I would like to add a third panel at the end of the "Your Assistant's Public Persona" section, entitled: Outbox Relays. This will be completed once there is at least one outbox relay as specified in a kind 10002 event NIP-65. This panel will direct the user to a new page, styled to match the style of the Assistant Management page, the purpose of which is to add and remove relays from the Outbox. The user will be able to add a relay by hand; in addition, we will have some suggested relays, which the user can add one at a time or accept all at once.

It picks up one item the `assistant-profile` epic deferred ("A kind 10002 relay list for assistants",
`epics/assistant-profile.md` § Deferred), and adds an eleventh action to the hub that book
`assistant-management` built.

### Decisions taken at intake (2026-10-09)

1. **Whose list.** The relay list is the viewer's own **Assistant's** kind 10002, signed by this instance
   with the Assistant's key, as the Identification Tags page's second card is (ADR
   assistant-identification-tags/0003). Not the person's own kind 10002. *(Stated at intake; not
   contested.)*
2. **Suggested relays: where the Assistant already publishes.** This instance's own relay, plus the Relay
   Settings lists the Assistant writes its content to: General Purpose, Trusted Assertion, Trusted List
   and DList relays, and the Outbox Relays setting when it is filled in. The suggestions follow Relay
   Settings with no code change. *(Chosen from: where it already publishes / popular relays only / a
   fixed list.)*
3. **Outbox only.** A relay added on the page is marked `write`. Entries already in the list that are
   inbox-only (`read`) are kept as they are; inbox relays can get their own page later, for when the
   Assistant handles DMs. *(Chosen from: outbox only / both inbox and outbox.)*
4. **One publish button.** Adding, removing and "add all" edit the list on screen; one "Have your
   Assistant publish" button signs and sends the whole list, one replaceable event per save. *(Chosen
   from: one button / publish on every change.)*
5. **Path:** straight to the story; no Discovery conversation. *(Chosen from: straight to the story /
   product discovery first.)*

Decided when the owner approved stories 1–3 (2026-10-09):

6. **Remove means gone.** Removing a relay that the list marks as both inbox and outbox (no marker) drops
   it entirely, inbox role included. *(Chosen from: drop it entirely / keep it as inbox-only.)*
7. **An empty outbox may be published,** with no confirmation step; the card then needs attention again.
   *(Chosen from: allow it / block it.)*

### Acceptance frame

*Confirmed 2026-10-09, when the owner approved stories 1–3.*

- [x] **A third persona card.** The "Your Assistant's Public Persona" section on `/assistant` ends with an
      **Outbox Relays** card, after Identification Tags. It leads to a new page at
      `/assistant/outbox-relays`.
- [x] **One real answer.** For a signed-in viewer with an Assistant on this instance, the instance says
      which outbox relays that viewer's own Assistant's newest kind 10002 names, read from this instance's
      relay first and then the outside relays a relay list is published to.
- [x] **The hub tells the truth for this action.** The card shows **Needs attention** until the
      Assistant's relay list names at least one outbox relay, and is complete once it does. The hub's
      count line and the Assistant Alert count it the same way.
- [x] **The page**, styled like the Assistant Management page, shows the Assistant's outbox relays and
      lets the person remove any of them, add one by hand, and add suggested relays one at a time or all
      at once. The suggestions are where the Assistant already publishes (Decision 2).
- [x] **One publish.** One button has this instance sign the whole list as the person's own Assistant, a
      NIP-65 kind 10002 with the relays it adds marked `write`, keeping inbox-only entries the person did
      not remove. It is
      written to this instance's relay first, then sent out, each relay's answer shown; the page and the
      hub re-check afterwards.
- [x] **Nothing else changes:** no relay list is published at Assistant creation, nothing else gains the
      power to sign as an Assistant, the inbox side of the list is not managed, and no other action page
      changes.

## Epics in this book

- `assistant-outbox-relays`: three stories, travelling through each phase together. The outbox check and
  the hub's Outbox Relays card (#1); the page — your Assistant's outbox relays, adding by hand,
  suggestions, removing (#2); your Assistant publishes its relay list (#3).

## Path

**Standard, all five phases for each story.** All three are features. The three stories travel through
each phase together, one gate per phase for all three (the `assistant-management` precedent).

## Shared lines

Book `assistant-profile-checklist` (opened 2026-10-09, the same day, at Planning) touches the same hub
lines and gives the hub a **Done** badge for any checked action that is done (its story 1 AC-6). This
book's card uses that badge; whichever story is built first adds it to the hub, and the other reuses it.
Before Implementation and again before Review: `git fetch` and `git merge-tree --write-tree HEAD
origin/staging` (ledger `2026-09-22-parallel-books-no-shared-line-recheck`). The lines this book touches:
the hub's actions and attention answer (`ui/src/pages/assistant/actions.js`,
`src/api/assistant/attention.js`), the routes in `ui/src/App.jsx`, the assistant API
(`src/api/assistant/`), and the top-bar pill's count.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** high for what the code does (every frame bullet traces to a story; all three passed
  review, story 3 in round 3); medium for the frame as a person meets it (deployed to staging and checked there
  anonymously, but the signed-in publish has not been exercised on any live instance, and production is pending).

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/assistant-outbox-relays/audit.md`
- Product feedback: `engineering-team/audits/assistant-outbox-relays/prd-seed.md`
