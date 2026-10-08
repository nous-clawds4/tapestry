# Story 2: The Assistants by category cards — who looks after your Scores, Lists and Concepts

**Status:** Done
**Created:** 2026-10-07
**Type:** Feature
**Epic:** `manage-treasure-map`
**Book:** `engineering-team/audits/manage-treasure-map/book.md`

## Background

Story 1 built `/treasure-map`: the heading, the FAQ, the raw Treasure Map and the Advanced management placeholder. The
blueprint's centre of the page is still missing: **Assistants by category**, three cards that say which Assistant your
Treasure Map names for your **Scores**, your **Lists** and your **Concepts**. Without them, the only way to see that is
to read the raw event.

This story adds the cards, view-only, as the blueprint draws them outside Edit mode (blueprint `treasure-map-screen
.html.txt`, the `tmbCats` cards; `treasure-map-logic.js.txt`, `tmbCats` and `TMB_CAT_KEYS`). It changes the design in
two places, by the owner's decisions: a category the Map doesn't cover says it **hasn't been assigned yet**, where the
design would show your own Assistant (book decision 7); and a broad entry (**everything**, **all Scores**, **all
Lists**) counts alongside a category's own entries wherever it still reaches part of the category, where the design
looks at broad entries only when the category has nothing of its own (book decisions 8–9).

It also folds in three small fixes from story 1's review (non-blocking 1, 2 and 4), all on the same page.

Nothing here signs or publishes. Editing remains a later book (decision 1).

## User-facing description

As a signed-in person with a Treasure Map, I want to see at a glance which Assistant looks after my Scores, my Lists
and my Concepts, and which of those aren't assigned to anyone yet, so I know what other apps will find for me without
reading the raw event.

## Acceptance criteria

- [ ] **AC-1: the section.** Given a signed-in person, on `/treasure-map`, between the FAQ and the raw Treasure Map:
  - the heading **Assistants by category**, and under it three cards in this order: **Scores**, **Lists**,
    **Concepts**, each with its description from § Copy and, on the right, who it's assigned to (AC-3);
  - under the cards, the line **Mixed assignments can be reviewed on the Advanced page.**, whose **Advanced page**
    opens `/treasure-map/advanced`.

  There is still no **Edit**, no **Choose an Assistant**, no **Assign to all**, no **All duties** row and no **Save
  changes**. Signed out, the section isn't shown at all; the page is as story 1 left it.
- [ ] **AC-2: which Assistants a card counts.** A card lists **every Assistant your Map would ask for some insight in
  that category** (book decision 9). An entry counts only when it names a valid Assistant (a 64-hex pubkey), as on the
  My Assistants page's Duties tab.
  - **Entries that apply to a category:**
    - **its own entries.** Scores: any entry for a Score kind, 30380–30389, bare or named (`30382`, `30382:rank`,
      `30386:…`). Lists: any entry for a List kind, 30390–30399 (`30392`, `30396:…`). Concepts: any entry for kind
      39998 or 39999 (`39998`, `39998:dlist-header`, `39998:<d-tag>`, `39999:<d-tag>`);
    - **its family-wide entries** (the draft Treasure Maps grammar, `protocols/drafts/treasure-maps.md`): `3038x` and
      `3038x:…` for Scores; `3039x` and `3039x:…` for Lists. Concepts have none;
    - **everything:** `*` for all three; `*:…` for Scores and Lists only (the draft: `*:tag` and `*:dlist` never
      match a Concept).
  - **A broad entry that a more specific entry covers completely doesn't count**, because no insight in the category
    would ever reach it: `*` doesn't count for Scores when the Map has `3038x`, for Lists when it has `3039x`, or for
    Concepts when it has `39998` or `39998:dlist-header`; `*:<system>` doesn't count for Scores when the Map has
    `3038x` or `3038x:<same system>` (likewise `3039x…` for Lists). Every other applicable entry counts, however many
    more specific entries the category also has.
  - **Per entry key, only the first-listed Assistant counts.** A key's later Assistants are alternates, as in the
    design. The card's Assistants are in the order the Map first names them, without repeats.
  - Entries of any other kind (for example `99999`, or a bare `30000`) count for no category.

  Examples, for the Scores card unless noted (A, B, C, D are Assistants):

  | Map entries | Card |
  |---|---|
  | `30382:rank` → A | A |
  | `30382:rank` → A, `3038x` → B | Mixed · 2 Assistants (A, B) |
  | `30382:rank` → A, `*` → C | Mixed · 2 Assistants (A, C) |
  | `30382:rank` → A, `3038x` → B, `*` → C | Mixed · 2 Assistants (A, B); `*` reaches no Score |
  | `3038x:tag` → B, `*` → C | Mixed · 2 Assistants (B, C); `*` still covers Scores that aren't tag-based |
  | `30382:rank` → A, then `30382:rank` → B | A (B is an alternate) |
  | `30382:rank` → A, `30382:followers` → A, `3038x` → A | A |
  | `*` → C | C, on all three cards |
  | `*:tag` → D, nothing else | D on Scores and Lists; **Not assigned yet** on Concepts |
  | Concepts: `39998:dog-breed` → A, `39998:dlist-header` → B, `*` → C | Mixed · 2 Assistants (A, B) |
  | nothing that applies | **Not assigned yet** |
- [ ] **AC-3: what a card says.**
  - **One Assistant:** "Assigned to", its avatar (the first letter of its name) and its name.
  - **Several:** "Assigned to", up to three overlapping avatars, then **Mixed** and **· N Assistants**, where N counts
    them all.
  - **None** (no level has an entry for the category): **Not assigned yet**, with no avatar.

  An Assistant's name is its profile's display name, else its name; with neither, or if its profile can't be found,
  its shortened npub. The signed-in person's own Assistant on this instance (the one `/assistants` marks Local) has
  the blueprint's purple avatar; every other Assistant has the navy one. A long name wraps or is cut short without
  pushing the page sideways at 375 px.
- [ ] **AC-4: the section's other states.** The cards claim nothing until the Map has been read:
  - **still reading:** the loading line of § Copy in place of the cards; never "Not assigned yet";
  - **can't read** (as story 1 AC-4 defines it): the error line and **Try again** in place of the cards; never "Not
    assigned yet". Try again reads the Map again, as the raw viewer's does;
  - **no Treasure Map** (the strict "none" of story 1 AC-4): all three cards say **Not assigned yet**.
- [ ] **AC-5: story 1's review findings.**
  - **The raw viewer starts closed for each viewer.** Signing out and back in, or signing in as someone else, without
    leaving the page, shows the raw Treasure Map closed. *(review non-blocking 1)*
  - **Hiding the FAQ closes its open answer.** Showing it again lists the four questions, each closed. *(review
    non-blocking 2; AC-3 of story 1, read strictly)*
  - **The raw Treasure Map can be scrolled from the keyboard.** The JSON box takes keyboard focus, has an accessible
    name, and scrolls sideways with the arrow keys. *(review non-blocking 4)*

  In no state does the page publish, sign or store anything.

## Copy

From the blueprint unless marked **new**. Curly apostrophes, as in story 1.

| Element | Text |
|---|---|
| Section heading | Assistants by category |
| Scores card | **Scores** · Trust scores for profiles and content, one at a time. |
| Lists card | **Lists** · Curated lists of profiles and content. |
| Concepts card | **Concepts** · Structured datasets your community organizes together. |
| Assigned label | Assigned to |
| Mixed | Mixed · N Assistants (N ≥ 2) |
| Not assigned | **new**: Not assigned yet |
| Mixed line | Mixed assignments can be reviewed on the [Advanced page]. |
| Loading line (cards) | Loading your Treasure Map… (story 1's) |
| Error line (cards) | Couldn’t read your Treasure Map. · Try again (story 1's) |
| Raw JSON box's accessible name | **new**: Raw Treasure Map |

## Concepts touched

The stack wasn't running at drafting, so these are named in plain language; the Architect should resolve handles if
any are needed.

- **Treasure Map** — the person's kind 10040, read as story 1 reads it. Its entries' grammar follows NIP-85, extended
  by the draft `protocols/drafts/treasure-maps.md` (the family wildcards and `*`).
- **Tapestry Assistant / "Local" Assistant** — the person's own Assistant on this instance, which gets the purple
  avatar.
- **nostr user** — each named Assistant's kind 0 profile, for its name.

## Out of scope

- **A later book (decision 1):** everything behind **Edit**: the **All duties** row, the pickers, the override
  switches, **Unsaved** / **Undo**, **Save changes**, the "edited" raw preview, publishing a kind 10040; and the full
  Advanced page the Mixed line points to.
- **Not here:** marking which listed Assistants are tagged as yours (the My Assistants page does that); verifying an
  Assistant's NIP-05; the Try again bug in the shared Map read (`ledger/2026-10-01-treasure-map-retry-skips-relay-list
  .md`, its own fix); listing individual duties (the Duties tab on `/assistants`, and later the Advanced page).

## Open questions

None open. The one raised with the draft was answered by the owner, below.

## Resolved at the story gate

The owner's answer, 2026-10-07, verbatim:

> If the Map gives rank to Assistant A and all Scores to Assistant B, then it is mixed.

So a broad entry's Assistant counts alongside the category's own entries, wherever the broad entry still reaches some
insight in the category (AC-2; book decision 9). This departs from the design, which looks at broad entries only when
the category has nothing of its own.

## Deviations

Small judgment calls made in Implementation (2026-10-07):

- **Four of story 1's browser tests were narrowed to the raw viewer before any code changed** (T5, T5b, T6, T13 in
  `tests/brainstorm/manage-treasure-map.spec.js`; commit `f393b21`, logged in the test plan's Amendment). The section
  now shows the same loading and error lines, and its own Try again, as the raw viewer, so page-wide queries matched
  twice. Their assertions are unchanged; the section's lines are covered by C6, C7 and C13.
- **The section heading is an `h2`, and the section is labelled by it.** The blueprint draws it as a styled label; a
  heading gives the page a usable outline. It looks the same.
- **The mixed card's name list reuses the app's global `.bs-sr-only` class**, and the card is `position: relative` so
  that hidden list stays inside it.
- **The name lookup has a `.catch` that falls back to npubs,** although `fetchProfilesChunked` never rejects today.
  The ADR says a failed lookup must never fail the section.

After review 1 (2026-10-07):

- **The raw viewer has no key** (ADR 0002 Amendment 2, after round 2; Amendment 1's switch counter is gone). It starts
  closed for each viewer because signing out unmounts it, and on this page the viewer can't otherwise change, except on
  one narrow top-bar path found in review round 3 (ADR 0002 Amendment 2's correction; a ledger row). A
  viewer opened while sign-in settles, after page load (C14) or after someone else signed out (C15), stays open.
- **A mixed card's assignee row is a `div`, not a `span`,** so the hidden name list inside it is valid HTML (review 1,
  non-blocking 5).

## Linked artifacts
- ADR: `engineering-team/decisions/done/manage-treasure-map/0002-the-cards-count-with-their-own-rule-over-the-same-read.md`
- Test plan: `engineering-team/stories/done/manage-treasure-map/2-the-assistants-by-category-cards.test-plan.md`
- Review: `engineering-team/reviews/done/manage-treasure-map/2-the-assistants-by-category-cards.md`
