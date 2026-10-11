# Book of Work: Duty Menu and Your Assistant's Treasure Map — two placeholder cards on the hub

**Slug:** assistant-duty-cards
**Status:** Open
**Opened:** 2026-10-11
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-10-11) and settled through
three questions there. Completion is *judged* against the bullets below.

The ask, verbatim (copied from the session transcript, not retyped):

> In a different session, I am in the process of developing a new protocol for my Assistant to communicate which duties it is capable of supporting and which duties are being actively managed. The Assistant does these by publishing a Duty Menu, which is an item on the DList of Duty Menus, and publishing its own Treasure Map, where it acts as its own assistant. You might be able to see this protocol already in staging (or it may not be complete yet; another session is working on it actively). While we wait for the full protocol, let's go ahead and update the Assistant Management page at https://staging.brainstorm.world/assistant with two new cards under the Your Assistant's Public Persona section, one for Duty Menu and one for My Assistant's Treasure Map. For now, we can make them placeholder pages. Does this make sense?

### Decisions taken at intake (2026-10-11)

1. **The second card's title is "Your Assistant's Treasure Map"**, in the hub's second-person voice ("Your
   Tapestry Assistant's Profile"), not "My Assistant's Treasure Map". *(Chosen from: "Your…" / "My…".)*
2. **Marked like the other placeholders.** Both cards are always marked **Needs attention**. The hub's
   count line and the Assistant Alert each count them, so both read two higher. *(Chosen from: follow the
   placeholder rule / a new unmarked "coming soon" state.)*
3. **Path: Standard, all five phases.** *(Chosen from: the full harness / a quicker path.)*

The card descriptions were proposed at intake and approved with these decisions.

### Acceptance frame

*Confirmed 2026-10-11, when the owner approved the intake decisions.*

- [ ] **Two persona cards.** The "Your Assistant's Public Persona" section on `/assistant` ends with
      **Duty Menu** and then **Your Assistant's Treasure Map**, after Outbox Relays.
- [ ] **Placeholder pages.** Each card leads to a placeholder page that says what the action is for.
- [ ] **Marked like the other placeholders.** On the hub, in its count line and in the Assistant Alert.
- [ ] **On staging**, at staging.brainstorm.world/assistant.
- [ ] **Nothing else changes.** No publishing, no check, no protocol change; the other actions are as they
      were.

## Epics in this book

- `assistant-duty-cards`: one story. The two placeholder cards (#1).

## Path

**Standard, all five phases** (Decision 3).

## Shared lines

Book `duty-menus-and-self-maps` (open, docs only) ratifies the protocol these cards point at. It touches
`protocols/` and its own `engineering-team/` folders, none of this book's lines. The later code book that
publishes menus and self-Maps will replace these two placeholders with real pages. The lines this book
touches: the hub's actions (`ui/src/pages/assistant/actions.js`), and the hub's tests. Before
Implementation and again before Review, run `git fetch` and then `git merge-tree --write-tree HEAD
origin/staging` (ledger `2026-09-22-parallel-books-no-shared-line-recheck`).

## Provenance

- **Mode:** Acceptance-frame
