# PRD Seed: Managing your Tapestry Assistant

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/assistant-management/audit.md`
**Anchor:** the acceptance frame in `book.md` (the owner's ask, quoted verbatim)
**Confidence:** **high** for what shipped. **Low** for what the product becomes next, because this book built
the scaffold on purpose, and every action behind it is still a placeholder.
**Date:** 2026-09-22

> This is a reverse-engineered baseline in the product-team PRD shape. It is a **strawman for the product team**,
> not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`.
>
> **Read the confidence honestly.** The owner asked for "the bones of this feature", and the bones are what shipped:
> a hub, ten placeholder pages and a reminder that counts all ten. The seed can describe the frame precisely. It
> cannot say what each action should do, what "needs attention" means for it, or whether ten is the right list.
> Those are the next phase's questions.

## 1. Product vision

`[FROM FRAME]` One place, `/assistant`, where a person manages everything their Tapestry Assistant does for them.
The Assistant is the nostr account this instance holds and signs with on the person's behalf. The page covers:
- its **public persona:** its profile, and the tags that tie it to its owner;
- the **trusted content** it publishes: Trusted Assertions, Trusted Lists, Decentralized Lists, bounties, pins and
  tags;
- **how it keeps in touch:** notifications, alerts and preferences.

Each action is a card marked "needs attention" or not. A reminder in the top bar sends people there while something
does.

`[FROM FRAME]` The FAQ gives the reason, in the owner's words: the Assistant exists "primarily to publish these
events on your behalf, in real time", because "you can't be online 24/7". A person may have several Assistants
across WoT Service Providers, and their kind 10040 Treasure Map tells clients which one publishes what.

`[INFERRED]` The page makes the Assistant's work visible and manageable. Before this book the only Assistant surface
was the profile editor. The hub turns "your Assistant" from one profile form into a list of jobs it does, each with
its own state.

## 2. Personas

`[INFERRED]` from the stories and the hub's three viewer states:

- **A signed-in person with an Assistant** (Owner, Admin or Customer): sees ten cards marked "Needs attention", a
  count line, and the pill on every other page once setup is done.
- **A signed-in person without an Assistant:** sees the hub with no marks, and is pointed to `/setup`. An Admin or
  Customer who may create one does so on the Edit Assistant Profile page, reached through "My Assistant's Profile".
  The hub does not link there.
- **A visitor:** sees the hub and the placeholders, and is asked to sign in.
- `[UNKNOWN — product input needed]` **People with several Assistants** across providers, whom the FAQ anticipates.
  The hub manages only this instance's Assistant, and nothing yet shows the others, or the Treasure Map that ties
  them together.

## 3. Scope (as-built)

`[FROM FRAME]` Shipped, and on staging (not production):

- **The hub at `/assistant`:** the heading, the FAQ (closed until opened), and ten cards under three headings.
  Each card is marked "Needs attention" for a viewer with an Assistant, which for now means every card.
- **Ten placeholder pages**, one per card. Each carries the owner's alert criteria and planning notes. Only the
  profile and identification-tags actions have criteria so far.
- **The profile editor**, moved to `/assistant/profile/edit` and titled "Edit Assistant Profile". Every link to it
  followed.
- **The Assistant Alert**, a pill beside every avatar menu, counting the hub's marks. It gives way to the Setup
  Alert, is hidden on `/assistant*`, and cannot be dismissed.

`[FROM FRAME]` Deliberately not built: deciding which actions really need attention, any action page's function,
and the Assistant's DMs (`stories/_intake.md`, entry 2026-09-21).

## 4. Domain model

`[INFERRED]` from the stories, the ADRs and `ui/src/pages/assistant/actions.js`:

- **Action:** key, section, address (`/assistant/<key>`), title, description (with links to NIPs), alert criteria,
  planning notes, and an optional link to the editor. There are ten, in three **sections**.
- **Attention:** for one viewer's own Assistant, which actions need attention. Today one function,
  `assistantAttention(user)`, answers "all ten" for anyone with an Assistant and "none" otherwise. The hub's marks,
  its count line and the pill all read it, so they cannot disagree.
- **Setup status:** the one shared `/api/setup/status` answer (ADR setup-status-and-alert/0001). It decides whether
  the Setup Alert or the Assistant Alert has the top bar.
- `[INFERRED]` The concepts the actions will touch when built: `39998:<TA>:nostr-user` (whose Assistant), the `tag`
  and `nostr-user-tag` concepts (identification tags), `tag-pinning` (pins), and `list` (Decentralized Lists).
  Trusted Assertions and Trusted Lists are event kinds, 3038x and 3039x.
- `[UNKNOWN — product input needed]` Where each action's real state comes from: which events, from which relays, and
  judged from whose point of view.

## 5. Design rules (as-built)

`[INFERRED]` from the shipped UI and the ADRs:

- **The hub is styled like `/setup`,** and shares its classes: cards, badges and the placeholder box.
- **"Needs attention" is personal.** It shows only to a viewer about their own Assistant. Visitors, and people
  without an Assistant, see the page unmarked.
- **One reminder at a time in the top bar, setup first.** The Setup Alert (amber) and the Assistant Alert
  (indigo) have the same shape and size, and never show together. The Assistant Alert waits for the setup answer.
- **Narrow bars lose words, never scroll.** The pill drops its count at ≤ 1023 px and its sentence at ≤ 679 px.
  On phones, while a pill shows, the bars give up their own words: the wordmark, name and badge, and below 360 px the
  About link.
- **Reminders are persistent.** They have no close button (the owner's choice, as for the Setup Alert).
- `[UNKNOWN]` No rule yet for how the hub grows past ten actions ("8 or 9 (and growing)"), or for what an action page
  looks like. Each will have "its own list of Action Cards", as `/setup` does.

## 6. Carry-forward & open questions

Promoted from the build audit's §6:

1. **Real "needs attention" answers,** from each action's alert criteria (audit §6 #1).
2. **The ten action pages,** starting with the profile checklist (audit §6 #2), and the Assistant's DMs (§6 #3).
3. **Production.** Whether the pill should reach production while every action counts. The owner held it at this
   close (audit §6 #4).
4. **The reminder's future.** Whether it stays persistent once its count is real, and how the hub groups more than
   ten actions (audit §6 #5).
5. **Accessibility.** At phone widths, the pill's visible words do not include its name (audit §6 #6).
6. **Creating an Assistant from the hub.** Today it points to `/setup`, whose first step is a placeholder (audit
   §6 #7).
7. **Old links.** On promotion, saved `/assistant` links open the hub, not the editor (audit §6 #8).

## 7. What product must validate

- [ ] **The ten actions and their three sections** as the list to build. Are any missing, merged or out of order?
- [ ] **For each action, what "needs attention" means:** from whose point of view, from which relays, and which alert
      criteria. Eight actions have none yet.
- [ ] **Whether the Assistant Alert should reach production** before any action's state is real. It would show on
      every page to everyone with an Assistant.
- [ ] **Whether the reminder should become dismissible,** or quieter, once counts are real.
- [ ] **Who the hub is for when someone has several Assistants** (the FAQ's "you probably will!"). Should it show,
      or link to, the others and the Treasure Map?
- [ ] **What a viewer without an Assistant should be offered on the hub:** `/setup`, the editor's create button, or
      something new.
- [ ] **The pill's words at phone widths,** given the label-in-name concern.
