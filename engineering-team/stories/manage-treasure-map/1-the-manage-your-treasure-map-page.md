# Story 1: The Manage your Treasure Map page, its menu links, and the Advanced placeholder

**Status:** Draft
**Created:** 2026-10-07
**Type:** Feature
**Epic:** `manage-treasure-map`
**Book:** `engineering-team/audits/manage-treasure-map/book.md`

## Background

A person's Treasure Map (their kind 10040 event) tells other nostr apps which Assistant publishes each of their
Scores, Lists and Concepts. Today the only page that shows it is the **TA Treasure Map** page on the Tapestry side
(`/tapestry/grapevine/treasure-map`). It's built for the people who run the system. Every avatar menu's **My Treasure
Map** item opens it, including the menus on the Brainstorm side of the app.

The owner has designed a simpler page for everyone else: **Manage your Treasure Map** (blueprint: the book's
`blueprint/` folder). The owner's ask and intake answers are quoted verbatim in the book. This epic builds it
view-only, in two stories:

- the page, its menu links, its FAQ, the raw Treasure Map, and the Advanced management placeholder (this story);
- the **Assistants by category** cards (story 2).

Both ship to staging together. This story reads the signed-in person's Treasure Map. It publishes nothing.

## User-facing description

As a signed-in person on the Brainstorm side of the app, I want **My Treasure Map** to open a plain-language page about
my Treasure Map, with answers to common questions and the Map itself one click away, so I can understand what it is
without opening the system operators' page.

## Acceptance criteria

- [ ] **AC-1: the menu links.** Given a signed-in person:
  - in the search landing page's avatar menu and the Brainstorm top bar's avatar menu, **My Treasure Map** opens
    `/treasure-map`;
  - in the Tapestry header's avatar menu, **My Treasure Map** still opens `/tapestry/grapevine/treasure-map`.

  The item keeps its label, icon and place in all three menus. The Tapestry sidebar's **TA Treasure Map** link is
  unchanged. A signed-out visitor's menus don't change.
- [ ] **AC-2: the page.** Given any visitor, when they open `/treasure-map`:
  - a page renders under the Brainstorm Search top bar, as `/assistants`, `/dictionary` and `/setup` do, with the
    kicker, heading and introduction of § Copy, in the blueprint's styling;
  - there is no **Edit** button and no **Save changes** button (book decision 1).

  Typed into the address bar or refreshed, `/treasure-map` renders and never shows "Page not found". This holds on
  staging as well as locally. At 375 px wide the page does not scroll sideways.
- [ ] **AC-3: the FAQ.** The page has a **Frequently asked questions** button, closed at first. Pressed, it shows the
  four questions of § Copy, in that order, each closed; pressed again, it hides them. Pressing a question shows its
  answer; pressing it again, or another question, closes it. At most one answer is open at a time.
- [ ] **AC-4: the raw Treasure Map.** Given a signed-in person, the page reads their Treasure Map: their own newest
  kind 10040, looked for in the same places the My Assistants page looks. A **View the raw Treasure Map** button
  (closed at first, with a **kind 10040** chip) opens a panel; pressed again, it closes it, and its label reads
  **Hide the raw Treasure Map** while open. The panel shows:
  - **found:** the event as found, as indented JSON: the whole event, including its `id`, `sig`, `created_at` and every
    tag, in the Map's order;
  - **none:** the blueprint's **No Treasure Map found** box and line. Only when at least one relay was actually read
    and none held a Treasure Map;
  - **can't read** (no relay reached, or the read failed): the error line and a **Try again** button, never the
    "none" box;
  - **still reading:** the loading line, never the "none" box.

  The read is the person's own Map. Nobody else's 10040 is shown, whoever else's is on the relays.
- [ ] **AC-5: Advanced management.** Under the raw Treasure Map, the line **Need fine-grained control over every
  entry?** with an **Advanced management** link, shown to every visitor, opens `/treasure-map/advanced`. That page:
  - renders under the same top bar, with the breadcrumb, kicker and heading of § Copy (from the blueprint's Advanced
    screen) and the placeholder line of § Copy;
  - links back to `/treasure-map` from its breadcrumb;
  - typed into the address bar or refreshed, renders and never shows "Page not found".

  It reads nothing and publishes nothing.
- [ ] **AC-6: signed out, and the My Assistants page's links.**
  - Signed out, `/treasure-map` shows the heading, introduction, FAQ and Advanced management line, and, in place of
    the raw Treasure Map, the signed-out line and a sign-in button. It reads no one's Treasure Map.
  - On `/assistants`, the introduction's **Treasure Map** link, each row's **Manage** button, and the Duties tab's
    link open `/treasure-map`.
  - The Tapestry side's other links to the TA Treasure Map page (the TA Treasure Map list's link, the My Curated
    DLists page's two links) still open `/tapestry/grapevine/treasure-map`.

  In no state does either page publish, sign or store anything.

## Copy

From the blueprint unless marked **new**. Apostrophes are curly (’), as in the blueprint and the other design-styled
pages.

| Element | Text |
|---|---|
| Menu item (unchanged) | My Treasure Map |
| Kicker | Treasure Map |
| Heading | Manage your **Treasure Map**. ("Treasure Map" in the accent colour) |
| Introduction | Your Treasure Map tells other apps where to find the insights your Assistant gathers from your trusted community — who to trust, what’s worth your attention, and how your community organizes ideas. Brainstorm keeps it up to date for you. |
| FAQ button | Frequently asked questions |
| Q1 / A1 | What is a Treasure Map? / A public record that points other nostr apps to the insights your Assistant calculates for you, so every app you use can benefit from your trusted community. |
| Q2 / A2 | Do I need to do anything? / Not usually. Brainstorm creates your Treasure Map during setup and keeps it current. You only need to sign again when something important changes. |
| Q3 / A3 | Who can see it? / Anyone. It’s published to relays like any other nostr event, so any app can read it. |
| Q4 / A4 | What’s on the Advanced page? / Every individual entry in your Treasure Map — scores, lists, and concepts — along with which Assistant provides each one. Most people never need it. |
| Raw viewer button | View the raw Treasure Map · Hide the raw Treasure Map |
| Raw viewer chip | kind 10040 |
| None box | **No Treasure Map found** · We couldn’t locate a kind 10040 event for your profile on your relays. |
| Loading line | **new**: Loading your Treasure Map… |
| Error line | **new**: Couldn’t read your Treasure Map. |
| Retry button | **new**: Try again |
| Signed-out line | **new**: Sign in to see your Treasure Map. |
| Sign-in button | Sign in with nostr (as on `/setup` and `/assistants`) |
| Advanced line | Need fine-grained control over every entry? · link: Advanced management → |
| Advanced page breadcrumb | Manage your Treasure Map (link) › Treasure Map · Advanced |
| Advanced page kicker | Treasure Map · Advanced |
| Advanced page heading | Advanced **Treasure Map** management. |
| Advanced page placeholder | **new**: This page is coming soon. It will list every entry on your Treasure Map, and which Assistant provides each one. Until then, the [TA Treasure Map] page shows every entry. (link: `/tapestry/grapevine/treasure-map`) |

## Concepts touched

The stack wasn't running at drafting, so these are named in plain language; the Architect should resolve handles via
the Concept Graph if any are needed.

- **Treasure Map** — a person's kind 10040 event (NIP-85, extended by `protocols/drafts/treasure-maps.md`). Read, not
  written.
- **Tapestry Assistant / "Local" Assistant** — the signed-in person's own Assistant on this instance. Not used by this
  story; story 2's cards mark it.

## Out of scope

- **Story 2:** the **Assistants by category** heading and its Scores, Lists and Concepts cards, and the line "Mixed
  assignments can be reviewed on the Advanced page."
- **A later book (decision 1):** the **Edit** button and everything behind it: the **All duties** row, **Choose an
  Assistant** / **Assign to all** pickers, the override switches, **Unsaved** / **Undo**, **Save changes**, the
  "edited" raw Treasure Map preview, and publishing a new kind 10040. The full Advanced page.
- **Not in this book:** changes to the TA Treasure Map page; the design's other screens; showing someone else's
  Treasure Map.

## Open questions

Raised with the draft, 2026-10-07. Resolve before approving.

1. **Copy that runs ahead of the app.** Two lines describe things the app doesn't do yet: the introduction's
   "Brainstorm keeps it up to date for you" and A2's "Brainstorm creates your Treasure Map during setup and keeps it
   current" (the setup page's Activate step is still a placeholder). A4 describes the Advanced page, which is a
   placeholder in this book. Keep the blueprint's words as they are (drafted that way), or soften those lines?
2. **The Advanced placeholder points to the TA Treasure Map page** for now (§ Copy). Keep that pointer, or show the
   placeholder line alone?
3. **Two stories, shipped together.** This story is the page; story 2 is the category cards (epic file). OK?

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
