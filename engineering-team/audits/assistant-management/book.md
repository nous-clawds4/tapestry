# Book of Work: The Assistant Management page — `/assistant`, as a scaffold, with its alert

**Slug:** assistant-management
**Status:** Closed
**Opened:** 2026-09-21
**Closed:** 2026-09-22 (on staging, PR #742; the owner held production at the close)

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-09-21). Completion is
*judged* against the bullets below.

The ask, verbatim (copied from the session transcript, not retyped):

> We are going to create a page, analogous to the staging.brainstorm.world/setup page, but one that is dedicated to management of the Tapestry Assistant, at: staging.brainstorm.world/assistant. In this session, we will create the bones of this feature, including the basic UX for the /assistant page and placeholders for 8 or 9 sub-pages (/assistant/*), but we will save the actual functionality for later sessions.
> The /assistant page will be styled similarly to the /setup page, although it will have more on it. Instead of showing “Finish Setting up Your Account" at the top, the user will see: “Manage the Profile and Capabilities of your Tapestry Assistant”. Rather than having only 3 Action Cards like on the /setup page, it will have 8 or 9 (and growing), as outlined below.
> The /assistant page will also have a FAQ, something we do not see on the /setup page.
> # FAQ
> The FAQ section will be one that can be toggled open and closed. Default will be closed. The content of the FAQ will be as follows:
>
> What is a Tapestry Assistant?
> A Tapestry Assistant is a personalized nostr account, designed to serve you, whose nsec lives on our servers. Your Assistant’s account is created when you sign up to our service.
>
> Why do I need an Assistant?
> The purpose of our service is to enable your trusted community to curate information for you. Ratings, Tags, articles, and other categories of content and signals of social proof are processed to determine who is the most trustworthy, and in what context, to curate your content, facts and information. Scores that indicate user trustworthiness and identify content worthy of your attention are published as nostr events and made available to other clients. This needs to happen in real time. You can’t be online 24/7, which means you can’t be expected to publish these events with your personal account. Your Assistant exists primarily to publish these events on your behalf, in real time, so the data is always available, no matter which app or client you may be visiting at any given time.
>
> What tasks can my Tapestry Assistant perform on my behalf?
> Your Assistant publishes Trusted Assertions (kind 3038x events), Trusted Lists (kind 3039x events), and maintains generic Decentralized Lists (kinds 39998 and 39999 events). Your Assistant also publishes its own profile (kind 0), follows (kind 1), and manages a handful of Tags (e.g. it will Tag itself as an Assistant and Tag you as its Owner). Coming soon: your Assistant will be able to communicate with you via DMs for alerts, notifications, to manage preferences, etc.
>
> Can I have more than one Assistant?
> Yes you can, and you probably will! Any service that maintains an Assistant on your behalf is called a WoT Service Provider. Examples of WoT Service Providers include Brainstorm (brainstorm.world) and Tapestry (tapestry.brainstorm.world), Relatr, and more.
>
> If I can have multiple Assistants spread across multiple WoT Service Providers, how do I keep track of which Assistant does what?
> This is the function of a kind 10040 event, what we call your Treasure Map. Its purpose is to let other clients and apps know how to find the trust metrics and other categories of content that are published by your Assistants. It can record, for example, that your Brainstorm Assistant publishes rank and followers scores for nostr accounts, your WoT SP2 Assistant publishes Trusted Lists for Tags, your Oxford Assistant publishes Trusted Lists relevant to your academic interests, and your Tapestry Assistant maintains Tapestry Firmware in the shape of Decentralized Lists.
>
> # Action Cards
>
> Each of the 8 or 9 Actions gets its own Card on the /assistant page, similar in styling to the three Cards on the /setup page.
>
> When one or more of the 8 or 9 Actions requires attention, an Alert panel will appear at the top of the page to direct the user to the Tapestry Assistant Management page at /assistant, similar to the Setup Alert that directs the user to the /setup page. For this session, we will create the Alert panel. For now, we will assume that ALL of the Actions require attention. In future sessions, we will do the complex process of actually deciding which Actions require attention and which do not.
>
> Unlike the /setup page, which has only 3 Action Cards, the Action Cards on the /assistant page will be organized using these headers:
>
> * Your Assistant’s Public Persona
>
> * Publication of Trusted Content
> * Notifications, Alerts, and Preferences
>
>
> Alert Criteria: We will follow in the footsteps of the /setup page in that each Action Card is in one of two states: needs attention (or not). The Alert Criteria are used to determine the state for each card.
>
> Each individual Management Action page will likewise have its own list of Action Cards, each of which will be in one of two states: needs attention (or not). However, in this session, we will not be concerning ourselves with the complex functionality of each of the Action pages. They will, for the most part, simply be stubs. (Maybe Alert Criteria and other relevant notes will be recorded as part of each stub, to guide our thinking when we focus our attention on building out those pages one at a time?)
>
> Following the example of the /setup pageoage, each Action Card, described below, has a URL, a title, and content that goes inside the Card. Some of them have Alert criteria (below) that, for now, we will put as text inside the placeholder pages, which will help guide us when we build out the functionality of those pages (in a later session, not this one).
> Your Assistant’s Public Persona
>
> /assistant/profile
> “Your Tapestry Assistant’s Profile”
> Customize the profile of your Assistant including its name and avatar.
> Alert criteria: If any of the Tapestry Assistant profile criteria are not met (create avatar, working NIP-05, client tag, URL, etc) Note: this page will not be the same as the Edit Assistant Profile page. It will be effectively a checklist of features that need to be done correctly. If any are done incorrectly, it may direct to the Edit Assistant Profile page, depending on which thing is done incorrectly.
>
> /assistant/identification-tags
> Title: “Identification Tags”
> Description: Part of the Assistant’s identity is its relationship to you. A handful of Tags will be used to broadcast this relationship between you and your Tapestry Assistant to outside clients, applications and services.
> Alert Criteria: if any of the required Taggings are missing. Taggings that you will use on your Assistant include: “My Tapestry Assistant”, “My Agent”; Taggings that your Assistant will use on you: “My Tapestry Owner” and “My Owner”. More may be added later when we flesh this out in detail.
> Publication of Trusted Content
> /assistant/trusted-assertions
> “Trusted Assertions”
> Enable Tapestry to broadcast trust scores using NIP-85 Trusted Assertions (link to the Custom NIP: https://github.com/nostr-protocol/nips/blob/master/85.md, curated by your trusted and extended community. This includes trust scores for pubkeys as well as for other categories of content. From a technical standpoint, this means your Assistant will publish kinds 3038x events on your behalf.
>
> /assistant/trusted-lists
> “Trusted Lists”
> Enable Tapestry to broadcast lists, curated by your trusted and extended community. This includes Trusted Lists of pubkeys as well as Trusted Lists of other categories of content. From a technical standpoint, this means your Assistant will publish kinds 3039x events on your behalf, according to the Trusted Lists NIP (link to https://nostrhub.io/naddr1qvzqqqrcvypzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqxhgun4wd6x2epdd35hxarn9c5yqp).
>
> /assistant/dlists
> “Decentralized Lists”
> Enable your Tapestry Assistant to manage Decentralized Lists in a way that is more detailed than Trusted Lists. From a technical standpoint, this means your Assistant will publish kinds 39998 and 39999 events on your behalf according to the Decentralized Lists NIP (link to: https://nostrhub.io/naddr1qvzqqqrcvypzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqfkgetrv4h8gunpd35h5ety94kxjum5wvzg04gg).
>
> /assistant/bounties
> “Bounties”
> Incentivise your trusted community with a sats reward to answer questions, to research topics, and to submit information that is of special interest to you.
>
> /assistant/pins
> “Pins”
> Manage your preferences via the Pin system. This means your Assistant will process data from your trusted community and publish Pins on your behalf.
>
> /assistant/tags
> “Tags”
> Manage Tags on your behalf. This means your Assistant will process data from your trusted community and publish Tags on your behalf.
> Placeholder page notes: Unclear at the moment how this feature might work. Might require an LLM.
> Notifications, Alerts, and Preferences
> /assistant/notifications-and-alerts
> “Notifications and Alerts”
> Enable your Assistant to send you notifications and alert you with updated findings and discoveries from your trusted community.
>
> /assistant/preferences
> “Preferences”
> Manage various preferences, such as Trust Determination Methods for Trusted Lists and Decentralized Lists management. These preferences are stored as nostr events, which may be signed by you but in some cases will be signed by your Assistant.
> Placeholder page notes: Why would your Assistant sign a Preferences event rather than you personally? Because you might wish to update your preferences based on advice from your trusted community, and you may want your Assistant to do this for you even when you’re offline.

(Trailing spaces are trimmed from the quote. Everything else is as typed, including "follows (kind 1)",
"pageoage" and the unclosed parenthesis in the Trusted Assertions card. Story 1 § Copy says how each
reaches the page.)

### Decisions taken at intake (2026-09-21)

The owner answered three questions:

1. **The profile editor moves to `/assistant/profile/edit`.** Today `/assistant` is the My Assistant
   page, the one place anyone edits their assistant's profile (assistant-profile #4, ADR
   assistant-profile/0004, live on production since PR #731). The hub takes `/assistant`. The editor
   moves under the profile page, which will link to it. Every link that leads to the editor moves with
   it: "My Assistant's Profile" in both avatar menus, the Dashboard prompt, the profile-page banner and
   both Settings links. "Assistant Management" in the avatar menus stays on `/assistant`.
   *(Chosen from: `/assistant/profile/edit` / `/assistant/edit-profile`.)*
2. **One alert at a time, setup first.** The Setup Alert (setup-status-and-alert #2: approved, not
   yet built) will be an amber pill beside the avatar menu. The Assistant Alert shows only when the
   Setup Alert has nothing to count. *(Chosen from: one at a time, setup first / both at once, side by
   side / a banner below the top bar.)*
3. **Standard path, all five phases.** The two stories travel through each phase together.
   *(Chosen from: Standard / the Light profile trial / Abbreviated: story, code, review.)*

**Counted at intake:** the ask lists **ten** actions, not "8 or 9": two under Public Persona, six under
Trusted Content, two under Notifications. All ten are built.

### Acceptance frame

*Confirmed 2026-09-21, when the owner approved stories 1 and 2.*

- [x] `https://staging.brainstorm.world/assistant` is the Assistant Management page. It is styled
      like `/setup` and headed "Manage the Profile and Capabilities of your Tapestry Assistant". It
      lists the ten actions as cards under the three headings, and has a FAQ that stays closed until
      it is opened.
- [x] Every action shows as needing attention for a signed-in viewer who has an assistant. Nothing
      is actually checked yet.
- [x] Each card leads to its own placeholder page under `/assistant/…`. The page says it is a
      placeholder and carries the owner's alert criteria and notes for that action.
- [x] The profile editor that lived at `/assistant` now lives at `/assistant/profile/edit`, and
      every link to it leads there. "Assistant Management" in the avatar menus leads to the new page.
- [x] An Assistant Alert, modelled on the Setup Alert, sends signed-in viewers with an assistant to
      `/assistant` from the other pages of both halves of the app. It gives way to the Setup Alert
      and hides on `/assistant` and its pages.
- [x] Nothing is checked, published or stored on anyone's behalf. The work saved for later is
      written down where a later session will find it (`engineering-team/stories/_intake.md`, entry
      dated 2026-09-21): deciding which actions really need attention, and building the action
      pages.

## Epics in this book

- `assistant-management`: two stories. The `/assistant` page, its FAQ and ten placeholder pages,
  with the editor's move (#1). The Assistant Alert (#2).

## Path

**Standard, all five phases for each story**, chosen by the owner at intake (2026-09-21). Both are
features.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** high. Every frame bullet was observed on `staging.brainstorm.world` after PR #742's
  deploy (audit §5); both stories passed review.

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/assistant-management/audit.md`
- Product feedback: `engineering-team/audits/assistant-management/prd-seed.md`
