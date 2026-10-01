# Story 2: Tag, re-tag and untag your Assistants from the My Assistants page

**Status:** Approved
**Created:** 2026-09-30
**Type:** Feature
**Epic:** `my-assistants`
**Book:** `engineering-team/audits/my-assistants/book.md`

## Background

Story 1 built `/assistants`: a list of every profile you've tagged **My Brainstorm Assistant** or **My Tapestry
Assistant**, with your Assistant on this instance first. The list can only be changed elsewhere: on a profile page's
tag controls, or, for your own Assistant, on the Identification Tags page. Two of story 1's lines already promise more:
"Open a row…" and "Search above to find one."

This story makes the page the place to manage the list, as the blueprint shows (book decision 3):

- **Find a profile and tag it**, as either kind of Assistant.
- **Open a row** to change which tag it carries, or remove the tag.

Every tagging is signed by you, with your nostr extension, like every other tagging in the app. The page reports what
the relays did, and the list re-reads so it shows the result.

**The My Brainstorm Assistant definition.** Story 1's list reads the tag by its name, so it doesn't need the
definition. Tagging a profile with it does: a new tagging points at the definition (book decision 4).
- Nous authors it, as he authored My Tapestry Assistant.
- The tag UI turns the name "My Brainstorm Assistant" into the slug `my-brainstorm-assistant`, the slug story 1 reads
  by (ADR my-assistants/0001 sub-decision 3). So Nous can create it the way he created My Tapestry Assistant on
  2026-09-22: through the tag UI on tapestry.brainstorm.world. No code is needed for that.
- Until the definition can be found, the page doesn't offer the Brainstorm tag (AC-6).

The blueprint for everything here is the book's `blueprint/` folder: the search box, its results and their two Tag
buttons, and the open row with Change and Remove. The row's Treasure Map duties, its "Manage on Treasure Map" button,
and the Tag buttons in "On your Treasure Map, but not tagged" are story 3's.

## User-facing description

As a signed-in person, I want to find a profile and tag it as my Brainstorm or Tapestry Assistant, switch which tag
an Assistant carries, and stop calling a profile my Assistant, all from the My Assistants page, so the list says what
I mean without my going anywhere else.

## Acceptance criteria

- [ ] **AC-1: find a profile.** Given a signed-in person on `/assistants`:
  - above the count there's a search box headed **Find a profile to tag as an Assistant** (§ Copy);
  - typing at least 2 characters shows up to 10 matching profiles, each with its avatar letter, name, NIP-05 and URL,
    and a line counting them (§ Copy);
  - matching is by name, NIP-05, URL or npub, as the app's profile search does;
  - **pasting an npub, or a 64-character hex key,** offers that exact profile even when the search doesn't find it.
    A new Assistant may not rank yet;
  - profiles already in your list aren't offered (the blueprint's "untagged profiles");
  - no match shows **No untagged profile matches.**;
  - fewer than 2 characters shows no results and no count.

  Signed out, there's no search box.
- [ ] **AC-2: tag a found profile.** Given a search result:
  - it has two buttons, **Tag: My Brainstorm Assistant** and **Tag: My Tapestry Assistant**;
  - pressing one asks your nostr extension to sign that tagging of that profile, and publishes it;
  - when at least one relay took it, the result disappears from the search, and the profile appears in the list with
    that tag's chip, in its sorted place;
  - the count goes up by one.
- [ ] **AC-3: open a row.** Given a row in the list:
  - clicking it, or Enter or Space on it from the keyboard, opens it, and doing so again closes it;
  - one row is open at a time; opening another closes the first;
  - a screen reader announces whether it's open;
  - an open row shows its actions (AC-4, AC-5), and closed rows show none.
- [ ] **AC-4: change the tag.** Given an open row carrying one tag:
  - it offers **Change to My Tapestry Assistant** (or **Change to My Brainstorm Assistant**);
  - pressing it tags the profile with the other tag and withdraws the first, signing both;
  - afterwards the row carries only the other chip.

  A row carrying both tags offers no Change.
- [ ] **AC-5: remove the tag.** Given an open row:
  - it offers **Remove Tag**;
  - pressing it withdraws your tagging of that profile, every one of the two tags it carries;
  - afterwards the profile leaves the list and the count goes down by one;
  - the exception is your Assistant here, which stays first, marked **Not tagged**, with its prompt (story 1 AC-5).

  "Withdraw" means the tagging no longer counts anywhere this app reads your stance, as if you had never tagged it. It
  does not mean "this is *not* my Assistant" (§ Resolved at the story gate 1).
- [ ] **AC-6: when the Brainstorm tag can't be used yet.** Given that the My Brainstorm Assistant definition (Nous',
  at slug `my-brainstorm-assistant`) can't be found on the relays this app reads:
  - every **Tag: My Brainstorm Assistant** and **Change to My Brainstorm Assistant** button is shown disabled;
  - beside the first, it says why (§ Copy);
  - everything else works.

  Once the definition is found, they work without a code change.
- [ ] **AC-7: what you're told, and what's never lost.** For every tag, change and remove:
  - while it's signing and publishing, the pressed button says so and can't be pressed again;
  - **no nostr extension**, or one signed in as a different key from the session: nothing is published, and the
    page says why, in the words the app already uses;
  - **at least one relay took it:** the list re-reads, and a short line says what happened, in the words the
    Identification Tags page uses for each relay's answer;
  - **no relay took it:** the list doesn't change, an error line says so, and the button can be pressed again;
  - **a change whose first half publishes and second half fails:** the line says exactly that, and the list shows
    what the relays now say (both chips, if that's the truth).

  Nothing is stored except the signed events.

## Copy

From the blueprint unless marked **new**. Apostrophes as on the rest of the page (curly).

| Element | Text |
|---|---|
| Search heading | Find a profile to tag as an Assistant |
| Search placeholder | Search by name, NIP-05, URL or npub |
| Result count | 1 untagged profile / N untagged profiles |
| No match | No untagged profile matches. |
| Result buttons | Tag: My Brainstorm Assistant · Tag: My Tapestry Assistant |
| Change button | Change to My Tapestry Assistant · Change to My Brainstorm Assistant |
| Remove button | Remove Tag |
| Brainstorm unavailable | **new**: The My Brainstorm Assistant tag hasn't been published yet, so it can't be applied. |
| While publishing | **new**: Tagging… · Changing… · Removing… (on the pressed button) |
| Result line | the Identification Tags page's per-relay words (`ui/src/utils/taggingPublishReport.js`) |

## Concepts touched

The `39998` handles carry this machine's TA as their author. Resolve them at runtime.

- `39998:<TA>:nostr-user-tag` — nostr user tag. The taggings this story publishes and withdraws.
- `39998:<TA>:tag` — tag. Two of its members:
  - `39999:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:my-tapestry-assistant` — My Tapestry
    Assistant (exists);
  - `39999:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:my-brainstorm-assistant` — My Brainstorm
    Assistant (Nous publishes it; until then AC-6).
- `39998:<TA>:tapestry-assistant` — tapestry assistant. The profiles the list holds.
- `39998:<TA>:nostr-user` — nostr user. The profiles search finds.

## Out of scope

- **Story 3:**
  - the row's Treasure Map duties, its "Manage on Treasure Map" button, and the on-map status;
  - "On your Treasure Map, but not tagged" with its Tag buttons;
  - the Duties tab.
- **Publishing the My Brainstorm Assistant definition.** Nous does it, outside the build, before the book ships
  (§ Resolved at the story gate 2; book § Before shipping).
- **Tagging your own Assistant here from its row.** The untagged Local row keeps story 1's link to Identification
  Tags (§ Resolved at the story gate 3).
- **Disputing** ("not my Assistant"), a confirmation dialog before Remove, undo, and bulk actions.

## Open questions

None open. The three raised with the draft were answered by the owner on 2026-09-30, below.

## Resolved at the story gate

The owner's answers, 2026-09-30:

1. **Remove Tag withdraws.** Your tagging is retracted, as if you'd never tagged the profile. It's not a dispute
   (AC-5).
2. **Nous publishes My Brainstorm Assistant before the book ships,** through the tag UI on tapestry.brainstorm.world.
   It's a step on the book's pre-ship checklist. AC-6's disabled state is only a guard.
3. **Your own Assistant's untagged row keeps story 1's link to Identification Tags.** That page does both directions
   of the handshake. There's no one-press Tag button on the row.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
