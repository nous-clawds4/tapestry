# Story 1: The My Assistants page, its menu link, and the list of your Assistants

**Status:** Done
**Created:** 2026-09-30
**Type:** Feature
**Epic:** `my-assistants`
**Book:** `engineering-team/audits/my-assistants/book.md`

## Background

A person can have more than one Assistant: one per WoT Service Provider that holds one for them
(Brainstorm, a Tapestry instance, and others). Today the app shows only one of them, the
Assistant this instance holds for you, on the Assistant Management pages. Nothing shows the whole
set.

The owner has a design for that: a **My Assistants** item in the account menu, leading to a page
that lists every profile you've tagged as one of your Assistants (blueprint: the book's
`blueprint/` folder). The owner's ask and three scope answers are quoted verbatim in the book.

The design's page does four things. This epic builds them in three stories:

- lists your Assistants (this story);
- lets you tag, re-tag and untag them (story 2);
- shows what each one does on your Treasure Map, plus a read-only Duties tab (story 3).

This story builds the page, the menu link, and the list, using the design's words. It reads.
It publishes nothing.

"Your Assistants" means profiles *you* have tagged with one of two tags. One tag exists today:
**My Tapestry Assistant**, whose definition Nous published. You tag your own Assistant with it on
the Identification Tags page, and anyone can apply it to any profile from the tag controls on
profile pages. The other tag, **My Brainstorm Assistant**, doesn't exist yet (story 2 brings it).
Until it does, no one's list will include it. Reading for it now means the list is right on the
day it appears.

## User-facing description

As a signed-in person with Assistants on one or more services, I want a page that lists every
profile I've tagged as my Brainstorm or Tapestry Assistant, with the one hosted here marked, so
I can see all my Assistants in one place.

## Acceptance criteria

- [ ] **AC-1: the menu link.** Given a signed-in person, when they open any of the three avatar
  menus (the Tapestry header's, the Brainstorm top bar's, the search landing page's):
  - there is an item **My Assistants**, directly after **My Treasure Map**;
  - choosing it opens `/assistants`.

  A signed-out visitor's menus don't change.
- [ ] **AC-2: the page.** Given any visitor, when they open `/assistants`:
  - a page renders under the Brainstorm Search top bar, as `/dictionary` and `/setup` do, with the
    kicker, heading and introduction of § Copy;
  - the introduction's **Treasure Map** link opens the page **My Treasure Map** opens
    (`/tapestry/grapevine/treasure-map`).

  Typed into the address bar or refreshed, `/assistants` renders and never shows "Page not
  found". This holds on staging as well as locally. At 375 px wide the page does not scroll
  sideways.
- [ ] **AC-3: whose list, and which taggings count.** Given a signed-in person, the list has one
  row per profile for which that person's latest stance, under a tag named **My Brainstorm
  Assistant** or **My Tapestry Assistant**, is an apply.
  - A tag of that name counts whoever published its definition, as on the Identification Tags page.
  - A tagging the person has disputed or retracted doesn't count.
  - A tagging signed by anyone else doesn't count, even when it tags the same profile.
  - A tagging published elsewhere (a profile page's tag controls, another client) is listed once
    it's on the relays this app reads.
  - A profile tagged with both tags is one row, carrying both chips.
- [ ] **AC-4: each row.** Given a listed profile, its row shows, as in the blueprint:
  - an avatar: the first letter of its name;
  - its name, and under it its npub, shortened;
  - **URL**: the website in its profile;
  - **NIP-05**: the NIP-05 in its profile, as published (not verified);
  - one chip per tag it carries: **My Brainstorm Assistant** or **My Tapestry Assistant**, in
    their two blueprint colours.

  A profile with no name shows its shortened npub as the name. A missing URL or NIP-05 shows as
  **—**. A profile whose metadata can't be found is still listed, with those fallbacks.
- [ ] **AC-5: Local, order and count.** The Local Assistant is the signed-in person's own Assistant
  on this instance, the one the Assistant Management page is about.
  - **Tagged:** its row is first, highlighted as in the blueprint, with a **Local** badge whose
    tooltip is in § Copy. No other row carries the badge.
  - **Not tagged:** it's listed all the same, first, with the Local badge. *This departs from the
    blueprint, by the owner's decision (§ Resolved at the story gate 2).*
    - In place of a tag chip, the row carries a **Not tagged** mark in the amber the blueprint uses
      for that mark.
    - Under the row, the tag prompt of § Copy links to the Identification Tags page
      (`/assistant/identification-tags`), where that tagging is published today.
  - A person with no Assistant on this instance has no Local row.
  - The other rows follow in alphabetical order of the name shown.
  - Above the list, a count reads **N Assistants** (**1 Assistant**). It counts every row,
    including an untagged Local one.
- [ ] **AC-6: the other states.**
  - Signed out: no list, no count, and a line asking the visitor to sign in, with a sign-in button.
  - While sign-in or the list is still loading: a loading line. Never the empty line, never a
    count.
  - Signed in with no rows (no Assistant on this instance, and no taggings): the empty line of
    § Copy, and **0 Assistants**.
  - Signed in, but the taggings can't be read: an error line and a **Try again** button. Never the
    empty line.

  In none of these states does the page publish, sign or store anything.

## Copy

From the blueprint unless marked **new**. Apostrophes follow the rest of the app.

| Element | Text |
|---|---|
| Menu item | My Assistants |
| Kicker | My Assistants |
| Heading | Your **Assistants**. ("Assistants" in the accent colour) |
| Introduction | Every profile you've tagged **My Brainstorm Assistant** or **My Tapestry Assistant**. Open a row to see what that Assistant does according to your [Treasure Map]. |
| Count | N Assistants / 1 Assistant |
| Field labels | URL · NIP-05 |
| Tag chips | My Brainstorm Assistant · My Tapestry Assistant |
| Local badge | Local |
| Local badge tooltip | The Assistant hosted on the instance you're using right now |
| Not-tagged mark (untagged Local row) | Not tagged (the blueprint's word for the mark) |
| Not-tagged mark tooltip | **new**: You haven't tagged this Assistant as yours yet |
| Tag prompt (untagged Local row) | **new**: This is your Assistant on this instance, but you haven't tagged it as yours. · link: Tag it as My Tapestry Assistant → |
| Empty line | You haven't tagged any Assistants yet. Search above to find one. |
| Signed-out line | **new**: Sign in to see your Assistants. |
| Sign-in button | Sign in with nostr (as on `/setup`) |
| Loading line | **new**: Loading your Assistants… |
| Error line | **new**: Couldn't load your Assistants. |
| Retry button | **new**: Try again |

Two of these lines promise story 2: "Open a row…" (rows open in story 2) and "Search above…" (the
search arrives in story 2). They're kept as the blueprint has them because the book ships all
three stories at once (§ Resolved at the story gate 3).

The tag prompt names **My Tapestry Assistant** because the Assistant this instance holds for you is
a Tapestry Assistant, which is what the app calls it everywhere. It's also the tag the
Identification Tags page publishes. **My Brainstorm Assistant** is for an Assistant held by a
Brainstorm service (§ Resolved at the story gate 1).

## Concepts touched

The `39998` handles below carry this machine's TA as their author. Each deployment has its own, so
resolve them at runtime.

- `39998:<TA>:tapestry-assistant` — tapestry assistant ("nostr profiles that correspond to
  tapestry assistants (maybe also including brainstorm assistants)"). The profiles this page lists.
- `39998:<TA>:nostr-user-tag` — nostr user tag. The taggings read: a stance of one person, under
  one tag, on one pubkey.
- `39998:<TA>:tag` — tag. Its two members that matter here:
  - `39999:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:my-tapestry-assistant`
    — **My Tapestry Assistant**, Nous' definition, which exists.
  - **My Brainstorm Assistant** — no definition yet (story 2).
- `39998:<TA>:nostr-user` — nostr user. The tagged profiles and their kind-0 metadata.

## Out of scope

- **Story 2:**
  - searching for a profile;
  - the Tag, change-tag and Remove Tag actions, including a Tag button on the untagged Local row
    if story 2 adds one (here that row only links to Identification Tags);
  - rows that open;
  - the **My Brainstorm Assistant** definition. Nous signs it; story 2 decides whether the app
    helps.
- **Story 3:** anything from the Treasure Map, namely:
  - each Assistant's "On Treasure Map" status and its duties;
  - the "…on your Treasure Map" part of the count;
  - the "On your Treasure Map, but not tagged" section;
  - the Assistants/Duties tab switch and the Duties tab.
- **Not in this book:** verifying NIP-05s; showing other people's Assistants; the design's other
  screens.

## Open questions

None open. The three raised with the draft were answered by the owner on 2026-09-30, below.

## Resolved at the story gate

The owner's answers, 2026-09-30:

1. **My Brainstorm Assistant: Nous authors it, with the meaning proposed.** An Assistant held by a
   Brainstorm service (such as brainstorm.world). "My Tapestry Assistant" is one held by a Tapestry
   instance. Nous signs the definition himself. This one blocks story 2, not this story, which
   reads by the tag's name.
2. **List your own Assistant here even when untagged,** mark it "not tagged", and prompt to tag it.
   This is a change from the design, and AC-5 carries it.
3. **Build all three stories, then ship once.** The blueprint's words stay as they are (§ Copy).

## Deviations

Small judgment calls made in Implementation (2026-09-30):

- **Apostrophes are curly (’).** § Copy says "Apostrophes follow the rest of the app", and the app uses both. I
  followed the design-styled pages: `/dictionary` uses ’, and so does the blueprint. The tests accept either.
- **The route is also documented in `src/api/openapi.yaml`,** beside `/api/assistant/attention`. The ADR didn't
  mention it, but every `/api/assistant/*` read is documented there.
- **The loading line is announced as a status and the error line as an alert** (`role="status"`, `role="alert"`).
  That's for screen readers; nothing on screen changes.
- **`NOSTR_USER_TAG_Z_TAG` needed no export.** It was already exported (the ADR's dated correction).
- **The handler takes a third injectable dependency, `zTag`** (`src/api/assistant/myAssistants.js:40`), beside the
  ADR's `getAssistantPubkeyFor` and `scan`. It returns profile-tags' `NOSTR_USER_TAG_Z_TAG`, lazily like the other
  two, so the module loads without requiring profile-tags up front. Tests don't override it. Noted by review 1
  (non-blocking).
- **After review 1:** a name field counts only when it's non-blank text (`textOf`, which URL and NIP-05 use too), and
  the avatar letter is a whole character (`Array.from`). Both fixes are pinned by C10, C11 and A12.
- **Found in passing:** the existing `/dictionary` browser test D6 is flaky on `staging` itself (7 of 10 runs
  failed without this change). Logged as OPEN.md row `2026-09-30-dictionary-d6-reads-before-request`, not fixed here.

## Linked artifacts
- ADR: `engineering-team/decisions/my-assistants/0001-one-session-read-lists-your-assistants.md`
- Test plan: `engineering-team/stories/my-assistants/1-the-my-assistants-page.test-plan.md`
- Review: `engineering-team/reviews/my-assistants/1-the-my-assistants-page.md`
