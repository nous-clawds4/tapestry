# Story 1: The Assistant Management page, its FAQ and ten placeholder action pages

**Status:** Approved
**Created:** 2026-09-21
**Type:** Feature
**Epic:** `assistant-management`
**Book:** `engineering-team/audits/assistant-management/book.md`

## Background

Every Owner, Admin and Customer on a Tapestry instance can have a Tapestry Assistant: a nostr
identity the instance holds for them, which signs and publishes on their behalf. Today the only
part of it a person can manage is its kind 0 profile. That happens on the My Assistant page at
`/assistant` (assistant-profile #4).

The owner wants `/assistant` to become the hub for everything the assistant does. It is styled like
`/setup`, with one card per action under three headings, and a FAQ. Each card leads to a page of
its own.

This story builds only the shape:

- the hub, with every action shown as needing attention;
- one placeholder page per action, carrying what the owner has said so far about it (its alert
  criteria and notes) for the sessions that will build it.

Deciding which actions really need attention, and building the actions, are saved for later (Out of
scope). The owner's ask is quoted verbatim in the book.

The hub takes `/assistant`, so the profile editor there today moves to `/assistant/profile/edit`,
and every link to the editor moves with it (book § Decisions 1).

## User-facing description

As someone with a Tapestry Assistant, I want one page that lists everything my assistant can do for
me, grouped by purpose, each part leading to a page of its own, with a short FAQ that explains what
an assistant is and why I have one. That way I can see what managing my assistant involves and where
each part will happen. For now the page checks nothing, and every action shows as needing attention.

## Acceptance criteria

- [ ] **AC-1: the page.** Given any visitor, when they open `/assistant`:
  - a page renders under the Brainstorm Search top bar, as `/setup` does, with the kicker and
    heading from § Copy;
  - it has three section headings in this order: **Your Assistant's Public Persona**, **Publication
    of Trusted Content**, **Notifications, Alerts, and Preferences**;
  - under them are the ten action cards of § Copy, in the order and sections given there, each with
    its title and description.
- [ ] **AC-2: needs attention, for the viewer it is about.**
  - Given a signed-in viewer who has an assistant on this instance (the same answer that marks
    `/setup`'s first step done), every card is marked **Needs attention**, and a line above the
    sections reads **10 actions need attention**.
  - Given a visitor who is not signed in, the cards carry no marks and there is no count. A line
    asks them to sign in, with a sign-in button.
  - Given a signed-in viewer with no assistant on this instance, the cards carry no marks and there
    is no count. A line says they have no Tapestry Assistant here yet, and links to `/setup`.
  - While sign-in is still resolving, the cards carry no marks and neither line shows.
- [ ] **AC-3: every card is a link.**
  - Given a card on `/assistant`, when it is clicked, or reached with Tab and opened with Enter, its
    page opens (§ Copy lists each address). Each card is a real link, so it can open in a new tab.
  - The NIP names in three cards' descriptions (Trusted Assertions, Trusted Lists, Decentralized
    Lists) link to their NIPs, § Copy. They open in a new tab. Following one does not also open the
    card's page.
- [ ] **AC-4: the FAQ.** Given `/assistant`:
  - a **Frequently asked questions** section shows below the heading and above the first section,
    closed: only its toggle shows;
  - activating the toggle, by clicking it or with Enter or Space from the keyboard, shows the five
    questions and answers of § Copy in order, and activating it again hides them;
  - a screen reader announces whether it is open or closed;
  - it is closed again on every fresh load of the page.
- [ ] **AC-5: ten placeholder pages.** Given any of the ten action addresses, when it renders:
  - it shows the same top bar and the action's title as its heading;
  - it shows the words **Placeholder page.** and the action's description, with its NIP link where
    it has one;
  - it shows the action's **Alert criteria** and **Planning notes** from § Copy: "Not yet defined."
    where the owner gave no alert criteria, and no notes section where the owner gave no notes;
  - it has the back link **← Back to Assistant Management** to `/assistant`;
  - `/assistant/profile` also links to the profile editor at `/assistant/profile/edit`.
- [ ] **AC-6: the profile editor moves to `/assistant/profile/edit`.**
  - Given `/assistant/profile/edit`, then the editor that `/assistant` shows today renders there
    under the heading from § Copy. It behaves as today for every role: the sign-in prompt, the
    no-assistant explanation, creating a key, and editing and publishing, with each relay's result.
    The page adds the back link **← Back to Your Tapestry Assistant's Profile** to
    `/assistant/profile`.
  - Every link that leads to the editor today leads to `/assistant/profile/edit` instead:
    - "My Assistant's Profile" in both avatar menus;
    - the Dashboard's "Give your Assistant a profile" prompt and its checklist item;
    - the "Edit Assistant profile" button on the assistant's own profile page;
    - the Tapestry Settings "Assistant Profile" tab, and the old `/tapestry/settings/assistant`
      address;
    - the card on the Brainstorm `/settings` page;
    - the read-only assistant panels on the legacy NIP-85 and customer pages;
    - the messages that refuse a profile publish (from the profile endpoint and from the generic
      publish endpoint), which name the page and its address.

    The last two were added by assistant-profile #5, which merged on 2026-09-21 while this story was
    at Architecture. They were added to this list then, with ADR 0001, and approved with it
    (2026-09-21).
  - "Assistant Management" in both avatar menus still opens `/assistant`, which is now the hub.
- [ ] **AC-7: direct loads, phone width, read-only.**
  - Given any of the twelve addresses (`/assistant`, the ten action pages,
    `/assistant/profile/edit`), typed into the address bar or refreshed, the page renders and never
    shows "Page not found". This holds on staging as well as locally.
  - At 375 px wide, none of them scrolls horizontally.
  - The hub and the ten action pages make no request of their own beyond what the shared top bar
    makes on every Brainstorm Search page. They publish, sign and store nothing. The editor keeps
    the requests it makes today.

## Copy

New unless marked **owner** (the ask, in the book). The owner's words are kept as typed, with these
display fixes:

- straight apostrophes, as elsewhere in the app;
- the first letter of a sentence capitalized;
- "(link to …)" turned into the link it asks for;
- one correction, approved with the story (§ Open questions 1): the kind number for follows.

**`/assistant`**

| Element | Text | Source |
|---|---|---|
| Kicker | Assistant Management | new: the avatar menus' name for this page |
| Heading | Manage the Profile and Capabilities of your Tapestry Assistant | **owner** |
| Count line (signed in, has an assistant) | 10 actions need attention (1 action needs attention) | new |
| Signed-out line | Sign in to manage your Tapestry Assistant. | new |
| Sign-in button | Sign in with nostr | as on `/setup` |
| No-assistant line | You don't have a Tapestry Assistant on this instance yet. Setting one up is the first step of Account Setup. | new |
| No-assistant link | Go to Account Setup → (`/setup`) | new |
| Card mark | Needs attention | new |
| Screen-reader prefix on a marked card | Needs attention: | new, like `/setup`'s "Not done: " |
| FAQ toggle | Frequently asked questions | new |

**The ten actions**: cards on `/assistant`, and the placeholder page behind each.

| # | Section | Address | Title (**owner**) | Description (**owner**) |
|---|---|---|---|---|
| 1 | Your Assistant's Public Persona | `/assistant/profile` | Your Tapestry Assistant's Profile | Customize the profile of your Assistant including its name and avatar. |
| 2 | Your Assistant's Public Persona | `/assistant/identification-tags` | Identification Tags | Part of the Assistant's identity is its relationship to you. A handful of Tags will be used to broadcast this relationship between you and your Tapestry Assistant to outside clients, applications and services. |
| 3 | Publication of Trusted Content | `/assistant/trusted-assertions` | Trusted Assertions | Enable Tapestry to broadcast trust scores using [NIP-85 Trusted Assertions]¹, curated by your trusted and extended community. This includes trust scores for pubkeys as well as for other categories of content. From a technical standpoint, this means your Assistant will publish kinds 3038x events on your behalf. |
| 4 | Publication of Trusted Content | `/assistant/trusted-lists` | Trusted Lists | Enable Tapestry to broadcast lists, curated by your trusted and extended community. This includes Trusted Lists of pubkeys as well as Trusted Lists of other categories of content. From a technical standpoint, this means your Assistant will publish kinds 3039x events on your behalf, according to the [Trusted Lists NIP]². |
| 5 | Publication of Trusted Content | `/assistant/dlists` | Decentralized Lists | Enable your Tapestry Assistant to manage Decentralized Lists in a way that is more detailed than Trusted Lists. From a technical standpoint, this means your Assistant will publish kinds 39998 and 39999 events on your behalf according to the [Decentralized Lists NIP]³. |
| 6 | Publication of Trusted Content | `/assistant/bounties` | Bounties | Incentivise your trusted community with a sats reward to answer questions, to research topics, and to submit information that is of special interest to you. |
| 7 | Publication of Trusted Content | `/assistant/pins` | Pins | Manage your preferences via the Pin system. This means your Assistant will process data from your trusted community and publish Pins on your behalf. |
| 8 | Publication of Trusted Content | `/assistant/tags` | Tags | Manage Tags on your behalf. This means your Assistant will process data from your trusted community and publish Tags on your behalf. |
| 9 | Notifications, Alerts, and Preferences | `/assistant/notifications-and-alerts` | Notifications and Alerts | Enable your Assistant to send you notifications and alert you with updated findings and discoveries from your trusted community. |
| 10 | Notifications, Alerts, and Preferences | `/assistant/preferences` | Preferences | Manage various preferences, such as Trust Determination Methods for Trusted Lists and Decentralized Lists management. These preferences are stored as nostr events, which may be signed by you but in some cases will be signed by your Assistant. |

The bracketed words are the link text. Each link opens in a new tab:

1. https://github.com/nostr-protocol/nips/blob/master/85.md
2. https://nostrhub.io/naddr1qvzqqqrcvypzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqxhgun4wd6x2epdd35hxarn9c5yqp
   (decoded at planning: kind 30817, d `trusted-lists`)
3. https://nostrhub.io/naddr1qvzqqqrcvypzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqfkgetrv4h8gunpd35h5ety94kxjum5wvzg04gg
   (decoded at planning: kind 30817, d `decentralized-lists`; same author as 2)

**The placeholder pages.** Each shows its heading (the title), **Placeholder page.**, the
description, an **Alert criteria** section, a **Planning notes** section where there are notes, and
**← Back to Assistant Management**. All the words below are the **owner**'s.

| Address | Alert criteria | Planning notes |
|---|---|---|
| `/assistant/profile` | If any of the Tapestry Assistant profile criteria are not met (create avatar, working NIP-05, client tag, URL, etc.). | This page will not be the same as the Edit Assistant Profile page. It will be effectively a checklist of features that need to be done correctly. If any are done incorrectly, it may direct to the Edit Assistant Profile page, depending on which thing is done incorrectly. |
| `/assistant/identification-tags` | If any of the required Taggings are missing. Taggings that you will use on your Assistant include: "My Tapestry Assistant", "My Agent"; Taggings that your Assistant will use on you: "My Tapestry Owner" and "My Owner". More may be added later when we flesh this out in detail. | — |
| `/assistant/tags` | Not yet defined. | Unclear at the moment how this feature might work. Might require an LLM. |
| `/assistant/preferences` | Not yet defined. | Why would your Assistant sign a Preferences event rather than you personally? Because you might wish to update your preferences based on advice from your trusted community, and you may want your Assistant to do this for you even when you're offline. |
| the other six | Not yet defined. | — |

`/assistant/profile` also shows the link **Edit your Assistant's profile →**
(`/assistant/profile/edit`, new copy).

**The profile editor, at `/assistant/profile/edit`**

| Element | Text | Source |
|---|---|---|
| Heading | Edit Assistant Profile (was "🤖 My Assistant") | **owner**'s name for the page ("the Edit Assistant Profile page") |
| Back link | ← Back to Your Tapestry Assistant's Profile (`/assistant/profile`) | new |
| Brainstorm `/settings` card text | See your assistant, and edit and publish its profile, on the Edit Assistant Profile page. (was "… on the My Assistant page.") | follows the heading |
| Brainstorm `/settings` card button | 🤖 Edit Assistant Profile (was "🤖 Open My Assistant") | follows the heading |

Every other label at the editor's entry points stays as it is ("My Assistant's Profile", "✏️ Edit
Assistant profile →", "🤖 Assistant Profile", and the Dashboard's words).

Outside the app, where the words say "the My Assistant page" they become "the Edit Assistant Profile
page", and each "(/assistant)" becomes "(/assistant/profile/edit)". This covers the legacy panels'
sentence and link ("🤖 Edit and publish its profile on the Edit Assistant Profile page →") and the three
refusal messages, whose other words stay as they are. ADR 0001 sub-decision 6 quotes each in full.

**The FAQ**: five questions, in this order, all **owner** words. Each answer is one paragraph.

1. **What is a Tapestry Assistant?** A Tapestry Assistant is a personalized nostr account, designed
   to serve you, whose nsec lives on our servers. Your Assistant's account is created when you sign
   up to our service.
2. **Why do I need an Assistant?** The purpose of our service is to enable your trusted community to
   curate information for you. Ratings, Tags, articles, and other categories of content and signals
   of social proof are processed to determine who is the most trustworthy, and in what context, to
   curate your content, facts and information. Scores that indicate user trustworthiness and
   identify content worthy of your attention are published as nostr events and made available to
   other clients. This needs to happen in real time. You can't be online 24/7, which means you can't
   be expected to publish these events with your personal account. Your Assistant exists primarily
   to publish these events on your behalf, in real time, so the data is always available, no matter
   which app or client you may be visiting at any given time.
3. **What tasks can my Tapestry Assistant perform on my behalf?** Your Assistant publishes Trusted
   Assertions (kind 3038x events), Trusted Lists (kind 3039x events), and maintains generic
   Decentralized Lists (kinds 39998 and 39999 events). Your Assistant also publishes its own profile
   (kind 0), follows (kind 3), and manages a handful of Tags (e.g. it will Tag itself as an
   Assistant and Tag you as its Owner). Coming soon: your Assistant will be able to communicate with
   you via DMs for alerts, notifications, to manage preferences, etc.
4. **Can I have more than one Assistant?** Yes you can, and you probably will! Any service that
   maintains an Assistant on your behalf is called a WoT Service Provider. Examples of WoT Service
   Providers include Brainstorm (brainstorm.world) and Tapestry (tapestry.brainstorm.world), Relatr,
   and more.
5. **If I can have multiple Assistants spread across multiple WoT Service Providers, how do I keep
   track of which Assistant does what?** This is the function of a kind 10040 event, what we call
   your Treasure Map. Its purpose is to let other clients and apps know how to find the trust metrics
   and other categories of content that are published by your Assistants. It can record, for
   example, that your Brainstorm Assistant publishes rank and followers scores for nostr accounts,
   your WoT SP2 Assistant publishes Trusted Lists for Tags, your Oxford Assistant publishes Trusted
   Lists relevant to your academic interests, and your Tapestry Assistant maintains Tapestry Firmware
   in the shape of Decentralized Lists.

## Where this departs from `/setup`, on purpose

- **Sections.** The cards sit under three headings. `/setup` has one list.
- **"Needs attention", not "done".** A card has two states, needs attention or not, in the owner's
  words. There is no progress bar, because nothing here is a sequence to complete. The count line
  says how many actions need attention.
- **No numbered steps.** The actions are not an order to follow, so a card's marker shows no step
  number.
- **A FAQ.** `/setup` has none.

## Concepts touched

None wired: this story is navigation and presentation. The concepts below are named for orientation
only. `<TA>` is this instance's TA pubkey (AGENTS.md §1). Each one answers on the local graph
(2026-09-21).

- `39998:<TA>:nostr-user`: whose assistant the page is about
- `39998:<TA>:tag`, `39998:<TA>:nostr-user-tag`: what the Identification Tags and Tags actions will
  publish
- `39998:<TA>:tag-pinning`: what the Pins action will publish
- `39998:<TA>:list`: the Decentralized Lists action's subject

## Out of scope

- **Saved for a future session by the owner**, and recorded in `stories/_intake.md` (entry dated
  2026-09-21):
  - deciding which actions really need attention, from each action's alert criteria;
  - building any action page, including the profile checklist at `/assistant/profile`;
  - the assistant's DMs.
- **The Assistant Alert** is story 2.
- **Changing the editor itself.** Its fields, defaults, publish path and messages stay as they are.
  Only its address, its heading and its back link change. assistant-profile #5 (one writer) is still
  to come in its own book.
- **Showing the viewer's assistant on the hub** (its name, picture or npub). The ask does not
  mention it.
- **Server routing or nginx changes.** None: the app already serves any path it does not otherwise
  know (confirmed at Architecture). The one server change is wording: the refusal messages name the
  editor's new address (AC-6).

## Open questions

None open. Resolved when the owner approved this story (2026-09-21), all as proposed:

1. **Follows are kind 3.** The FAQ's third answer says "follows (kind 1)". Kind 1 is a text note,
   and the follow list is kind 3 (NIP-02), so § Copy says kind 3. The `/setup` scaffold made the
   same correction.
2. **The editor's heading becomes "Edit Assistant Profile"**, your name for it. That avoids a second
   page called "My Assistant" beside the new hub. The Brainstorm `/settings` card's words follow
   (§ Copy). The other entry-point labels stay as they are.
3. **The FAQ sits above the cards**, just under the heading, so a first-time visitor sees "What is a
   Tapestry Assistant?" before ten cards. The alternative is the bottom of the page.
4. **Signed-out visitors, and people with no assistant, still see the page**, with no marks and no
   count, as on `/setup` (AC-2). "Needs attention" is about the viewer's own assistant, so it is
   shown only to someone who has one.
5. **The notes are shown on the placeholder pages**, as the ask proposes, under "Alert criteria" and
   "Planning notes". An action with no criteria yet says "Not yet defined."

## Linked artifacts
- ADR: `engineering-team/decisions/assistant-management/0001-the-hub-takes-assistant-and-the-editor-moves-under-it.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
