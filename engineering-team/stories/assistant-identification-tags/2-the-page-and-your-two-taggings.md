# Story 2: The Identification Tags page, and your two taggings of your Assistant

**Status:** Approved
**Created:** 2026-09-22
**Type:** Feature
**Epic:** `assistant-identification-tags`
**Book:** `engineering-team/audits/assistant-identification-tags/book.md`

## Background

`/assistant/identification-tags` is a placeholder page today, carrying the owner's description and
alert criteria (assistant-management #1). Story 1 gives the instance one answer to which of the four
required taggings are present for the viewer's own Assistant.

This story replaces the placeholder with the real page (Discovery decisions 1, 2, 6, 8): the owner's
description, one sentence about the Treasure Map, and two cards, one per signer. Each card lists its
two taggings with their state, a checkbox per missing tagging (checked by default), and one publish
button. This story builds both cards and wires the first card's publish, which signs with the
viewer's own nostr extension, the way every tagging is signed today. The second card's publish, which
needs the Assistant's key, is story 3.

Every tagging is an ordinary tagging of the tagging protocol; nothing about the wire format changes.

## User-facing description

As someone with a Tapestry Assistant on this instance, I want a page that shows which of the four
identification taggings between me and my Assistant exist, and lets me publish the ones I sign
myself, choosing which, so that outside apps can tell that this Assistant is mine.

## Acceptance criteria

- [ ] **AC-1: the page.** Given any visitor, when they open `/assistant/identification-tags`:
  - a page renders under the Brainstorm Search top bar, as the hub does, with the back link **← Back
    to Assistant Management**, the heading **Identification Tags**, the owner's description, and the
    Treasure Map sentence, all from § Copy;
  - two cards follow, in order: **Taggings you put on your Assistant** (My Tapestry Assistant, My
    Agent) and **Taggings your Assistant puts on you** (My Tapestry Owner, My Human). Each tagging is a
    row showing its name.
  - Given a visitor who is not signed in: the rows carry no state, and a line asks them to sign in,
    with a sign-in button. Given a signed-in viewer with no Assistant here: the rows carry no state,
    and the hub's no-Assistant line and link show. While sign-in is still resolving, neither line
    shows.
- [ ] **AC-2: each row's state,** for a signed-in viewer with an Assistant here, from story 1's answer:
  - **Present** when the tagging is present;
  - **Missing** when the check finished and it is not;
  - **Tag not found** when its canonical definition was not found (§ Copy has the sentence), whatever
    the check found;
  - **Checking…** while the answer is on its way;
  - a **could-not-check** sentence when the check did not finish, saying why in the words of § Copy.
  - A card is marked **Needs attention** while any of its rows is Missing, Tag not found, or not
    finished, and carries a **Done** badge when both its rows are Present. The card's mark agrees with
    the hub's card for this action (story 1 AC-5) once the check has finished.
- [ ] **AC-3: the checkboxes.** Each **Missing** row has a checkbox labelled with the tagging's name,
      checked by default. A **Present** row has no checkbox. A **Tag not found** row's checkbox is
      disabled and unchecked. A card's publish button is disabled while none of its checkboxes is
      checked. Unchecking stores nothing: on the next load every Missing row is checked again, and an
      unchecked tagging still counts as missing on the page, the hub and the pill.
- [ ] **AC-4: your publish (the first card).** Given the first card with at least one checked row, when
      the viewer presses its publish button:
  - one tagging per checked row is signed with the viewer's nostr extension, in turn: an ordinary
    tagging of that row's canonical tag, tagging the viewer's own Assistant, as an apply;
  - each signed tagging is published to this instance's relay and the outside relays every tagging is
    published to today, and the card shows, per tagging, the summary and each relay's answer in the
    words of § Copy (accepted, rejected, unreachable, timed out, skipped in local-only publish mode);
  - if the extension is missing, refuses, or a signature fails, the card says so for that tagging and
    that tagging is not published; taggings already signed and published in the same press keep
    their results;
  - after the press the rows re-check, and the hub's answer refreshes, so the hub's count and the pill
    change without a reload.
- [ ] **AC-5: the second card, before story 3.** The second card shows its rows, states and checkboxes
      exactly as the first. Its publish button is story 3's.
- [ ] **AC-6: direct loads, phone width.** Given `/assistant/identification-tags`, typed into the address
      bar or refreshed, the page renders and never shows "Page not found", locally and on staging. At
      375 px wide it does not scroll horizontally. The hub's Identification Tags card still leads here.
      The other nine placeholder pages are unchanged.
- [ ] **AC-7: nothing without a press.** The page makes no request beyond story 1's answer and what the
      top bar makes on every page. Nothing is signed, published or stored until a publish button is
      pressed.

## Copy

New unless marked **owner**. The owner's words are kept as typed (straight apostrophes, as elsewhere in
the app).

**The page**

| Element | Text | Source |
|---|---|---|
| Back link | ← Back to Assistant Management | as on every action page |
| Heading | Identification Tags | **owner** |
| Description | Part of the Assistant's identity is its relationship to you. A handful of Tags will be used to broadcast this relationship between you and your Tapestry Assistant to outside clients, applications and services. | **owner** |
| Treasure Map sentence | Your Treasure Map tells apps what your Assistant publishes for you; these tags are simply an additional mechanism to associate you and your Assistant. | **owner** (Discovery decision 8) |
| First card title | Taggings you put on your Assistant | new, from the owner's "Taggings that you will use on your Assistant" |
| Second card title | Taggings your Assistant puts on you | new, from the owner's "Taggings that your Assistant will use on you" |
| Row names | My Tapestry Assistant · My Agent · My Tapestry Owner · My Human | **owner** (My Human: decision 6) |
| Card mark | Needs attention | as on the hub |
| Card done badge | Done | as on `/setup` |
| Row state, present | Present | new |
| Row state, missing | Missing | new |
| Row state, tag not found | Tag not found: the tag "{name}" has not been published yet, so this tagging can't be made here. | new |
| Row state, checking | Checking… | new |
| Could not check, this instance's relay | Could not read this instance's relay. | new |
| Could not check, no outside relay configured | Not found on this instance's relay, and no outside relay is configured to check. | new |
| Could not check, outside relays silent | Not found on this instance's relay, and no outside relay answered. | new |
| Checkbox label | the tagging's name | new |
| First card's button | Publish with your nostr extension | new |
| Signed-out line | Sign in to see your identification tags. | new |
| Sign-in button | Sign in with nostr | as on the hub |
| No-Assistant line and link | the hub's | as on the hub |

**Publish results,** per tagging, in the profile publish's words:

| Element | Text |
|---|---|
| Summary, published | "{name}" was saved on this instance's relay and accepted by {a} of {n} relays. |
| Summary, partly | … {n − a} did not accept it; see below. |
| Summary, none | "{name}" was saved on this instance's relay, but none of the {n} relays accepted it; see below. |
| Summary, kept local | "{name}" was saved on this instance's relay only: local-only publish mode is on, so it was not sent to any other relay. |
| Local write failed | "{name}" could not be saved on this instance's relay ({reason}), so it was not sent to any other relay. |
| Per relay | {relay} — accepted · — rejected: {reason} · — unreachable: {reason} · — timed out · — skipped (local-only publish mode) |
| Signature refused | "{name}" was not published: your nostr extension did not sign it ({reason}). |
| No extension | No nostr extension was found. Install one to publish taggings. |

**The four canonical tags** (published by the owner with their own key, not by the app; the app names
them by slug and by the owner's key):

| Name | Slug | Description (proposed; the owner edits) |
|---|---|---|
| My Tapestry Assistant | my-tapestry-assistant | A Tapestry Assistant I own: a nostr account a Tapestry instance holds for me, which signs and publishes on my behalf. |
| My Agent | my-agent | An account operated by an AI agent that works for me. |
| My Tapestry Owner | my-tapestry-owner | The person this Tapestry Assistant belongs to. |
| My Human | my-human | The person this agent works for. |

## Concepts touched

- `39998:<TA>:nostr-user-tag` — nostr user tag (what the first card publishes).
- `39998:<TA>:tag` — tag (the canonical definitions the rows point at).
- `39998:<TA>:nostr-user` — nostr user (the viewer and their Assistant).

No concept changes; no firmware reinstall.

## Out of scope

- The second card's publish (story 3).
- Disputing or retracting a tagging from this page.
- A stored opt-out, or making any of the four optional.
- Changing where taggings are published (the browser's relay list) or read from (the tag-federation
  relays).
- Creating tag definitions from this page. The four are the owner's (book § Prerequisite).
- The other nine action pages.

## Open questions

1. **Present rows and republishing.** A Present row has no checkbox, so a tagging that exists on this
   instance's relay but never reached an outside relay cannot be re-sent from here. Recommended for
   now: leave it; the publish result shows how far a tagging went, and story 1's open question 2
   covers a later "broadcast" reading.
2. **The button's words** — *settled 2026-09-22 at approval:* the buttons name the signer. "Publish with
   your nostr extension" on the first card; "Have your Assistant publish" on the second (story 3).

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
