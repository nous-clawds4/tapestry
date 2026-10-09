# Story 2: The checklist page at `/assistant/profile`, and its one-click fixes

**Status:** Approved
**Created:** 2026-10-09
**Type:** Feature
**Epic:** `assistant-profile-checklist`
**Book:** `engineering-team/audits/assistant-profile-checklist/book.md`

## Background

`/assistant/profile` is a placeholder today (assistant-management #1): it shows the action's description,
the owner's alert criteria and planning notes, and a link to the Edit Assistant Profile page at
`/assistant/profile/edit`. Story 1 gives the instance one answer to which of seven profile items are done for
the viewer's own Assistant. This story replaces the placeholder with the checklist the owner asked for: one
panel per item, styled like the cards on `/assistant`, each **Done** or **Needs attention**.

The owner chose one-click fixes on the panels themselves (book, Decision 2). Every fix is a republish of the
Assistant's profile through the one writer that exists today (`POST /api/assistant/publish-profile`, ADR
assistant-profile/0005), changing only what its item is about. That writer already sets the NIP-05 and the
client tag on every publish from a public instance, and sends the profile to this instance's relay first and
then to the configured publish relays, reporting each (ADR assistant-profile/0002). The avatar's fix is story 3.

## User-facing description

As someone with a Tapestry Assistant on this instance, I want one page that shows what is still missing from
my Assistant's profile, says why in plain words, and fixes each thing with one press, so that my Assistant
looks right in every nostr app without my having to know which field to edit.

## Acceptance criteria

- [ ] **AC-1: the page.** `/assistant/profile` shows a back link to the hub, the action's title and
      description, a summary line, the seven panels in story 1's order, and a link to the Edit Assistant
      Profile page for any other change. Each panel carries the hub card's marks: the "!" marker and a
      **Needs attention** badge, or a ✓ marker and a **Done** badge, with the same screen-reader prefixes. The
      placeholder page no longer appears at this address.
- [ ] **AC-2: who sees what.** A signed-out visitor sees the panels with no states and a sign-in line; a
      signed-in viewer with no Assistant here sees them with no states and the hub's line pointing to Account
      Setup. Neither is offered a fix. Only a signed-in viewer with an Assistant sees states and fixes, and they
      are always about that viewer's own Assistant.
- [ ] **AC-3: each panel's state and words**, from story 1's answer:
  - **Done** — the panel's done line (§ Copy).
  - **Needs attention** — the panel's line for that reason (§ Copy).
  - **Checking…** — while the answer is on its way. The panel is marked, as the hub is.
  - **Could not check** — the item's check did not finish; the line says why. The panel is marked.
  - The background image panel always reads **Coming soon**, with no marker and no fix, and says it does not
    count yet.
  - The summary line reads "Your Assistant's profile is complete." when every counted item is done, and
    "{n} items need attention" / "1 item needs attention" otherwise (the background image never counts).
- [ ] **AC-4: one-click fixes.** A panel that needs attention offers its fix (§ Copy); pressing it republishes
      the Assistant's profile once, through the one writer, with every field as it is published now except:
  - **NIP-05**, **Client tag** and **Visible to other nostr apps**: nothing changes in the fields; the
    republish itself sets the NIP-05 and the client tag, and sends the profile to the outside relays.
  - **Website**: the website becomes this instance's address.
  - **Name and About**: each of the name, the display name and the About text that is empty gets its default
    (the one default profile, ADR assistant-profile/0003); any that is filled in stays as it is.
  - **No profile at all**: one notice above the panels, "Your Assistant has no profile yet.", offers
    **Publish the default profile**, which publishes the one default (the same content the editor's "Reset to
    defaults" fills in).
  A fix never changes a field its item is not about. A fix is not offered where it cannot work: on an
  instance with no public web address (NIP-05, website, client tag), or where nothing would go outward
  (visibility, when this instance publishes locally only or has no outside relay configured) — the panel
  says why instead.
- [ ] **AC-5: honest results.** After a fix, its panel shows what happened in the editor's words: the
      outcome, then one line per relay (accepted, rejected, unreachable, timed out, skipped). A refusal or a
      failed local write says so and nothing reads as success. While one fix is publishing, every fix button
      on the page is disabled, so two republishes never race.
- [ ] **AC-6: re-checked.** After every fix, whatever its result, the answer is asked for again, so the panels,
      the summary line, the hub's card, its count line and the Assistant Alert all update without a reload.

## Copy

**Page**

| Where | Words |
|---|---|
| Back link | ← Back to Assistant Management *(the hub's, unchanged)* |
| Title | Your Tapestry Assistant's Profile *(the action's, unchanged)* |
| Description | Customize the profile of your Assistant including its name and avatar. *(the action's, unchanged)* |
| Summary, all done | Your Assistant's profile is complete. |
| Summary, some left | 1 item needs attention / {n} items need attention |
| No profile notice | Your Assistant has no profile yet. |
| No profile fix | Publish the default profile |
| Editor link | Edit your Assistant's profile → *(the action's editLink, unchanged)* |
| Signed out | Sign in to see your Assistant's profile. |
| No public address | This instance has no public web address, so this can't be done here. |
| Checking | Checking… |
| Publishing | Publishing… |
| Background badge | Coming soon |

**Panels** (`{domain}` and `{url}` are this instance's, read at runtime; `{address}`, `{value}` the profile's)

| Item | Title | Description | Done line | Needs-attention lines | Fix |
|---|---|---|---|---|---|
| 1 | A personalized avatar | Your own picture, stamped with the Tapestry mark and hosted by this instance, so every nostr app shows whose Assistant this is. | Your Assistant's picture is your personalized avatar, hosted by {domain}. | *standard image:* Your Assistant is using the standard Tapestry image, not a personalized one. · *other:* Your Assistant's picture is not a personalized avatar from {domain}. · *none:* Your Assistant has no picture. · *missing file:* Your Assistant's picture points at an avatar {domain} no longer has. | *story 3* |
| 2 | A personalized background image | A banner for your Assistant's profile, branded to this instance. | — | Not checked yet; it doesn't count toward your profile being complete. | — |
| 3 | A working NIP-05 | A NIP-05 address on this instance's domain lets nostr apps verify your Assistant. {domain} hosts it. | {address} is verified: {domain} lists it for your Assistant. | *none:* Your Assistant's profile has no NIP-05 address. · *other domain:* {address} is not on this instance's domain, {domain}. · *not listed:* {domain} does not list {address} for your Assistant. · *could not check:* Could not check: {domain} did not answer. | Republish to register my NIP-05 |
| 4 | Website | Your Assistant's website is this instance's address, so people can see where it lives. | Your Assistant's website is {url}. | *none:* Your Assistant's profile has no website. · *other:* Your Assistant's website is {value}, not {url}. | Set website to {url} |
| 5 | Name and About | A name and an About text tell people whose Assistant this is and what it does. | Your Assistant has a name and an About text. | Your Assistant's profile has no name. · …has no About text. · …has no name and no About text. | Fill in the default name / About text / name and About text |
| 6 | Client tag | Your Assistant's profile carries this instance's client tag, so apps can see where it was published from. | Your Assistant's profile carries the client tag {domain}. | Your Assistant's profile has no client tag for {domain}. | Republish from {domain} |
| 7 | Visible to other nostr apps | Your Assistant's latest profile is on the relays this instance publishes to, so other nostr apps can find it. | Your Assistant's latest profile is on {n} of {m} outside relays. | *local only:* Your Assistant's latest profile is only on this instance's relay. · *local-only mode:* This instance is set to publish locally only, so your Assistant's profile is not sent to outside relays. · *no relays:* This instance has no outside relays to publish to. · *could not check:* Could not check: no outside relay answered. | Publish to outside relays |

## Concepts touched

- `39998:<TA>:nostr-user` — nostr user (whose Assistant; the viewer's own).

No concept changes; no firmware reinstall.

## Out of scope

- The avatar panel's fix (story 3). Until story 3 lands, the avatar panel links to the Edit Assistant Profile
  page instead, where the Owner can already stamp one.
- The background image feature, and any fix for it.
- A "fix everything" button. (Any republish from a public instance already repairs the NIP-05, the client tag
  and the visibility at once; the panels re-check after each.)
- Keeping kind 0 fields the editor does not know (anything beyond name, display name, About, picture, banner,
  website, lightning address). The one writer drops them today, and a fix does the same; changing that is the
  one writer's story, not this one.
- Changing the Edit Assistant Profile page.

## Open questions

None beyond story 1's.

## Deviations

*The Implementer's log (Phase 4, 2026-10-09): judgment calls too small for an ADR amendment, for the book-close audit.*

1. **The panels reuse the Identification Tags page's `.bs-idtags-card*` classes as they are** (ADR 0002 sub-decision 7
   left generalize-or-copy to the smaller diff; reuse is smaller than either). New `.bs-profile-check-*` rules cover only
   what that page has no need of: the description and line, the preview, the neutral "Coming soon" badge.
2. **The screen-reader prefix ("Needs attention: " / "Done: ") sits beside each panel's heading, not inside it**, so
   each panel's region is named by its title alone (the browser suite finds panels that way).
3. **The NIP-05 panel's description fills `{domain}` with "This instance"** until the answer names the domain (a visitor,
   or while checking).
4. **`summaryText(action, phase)` also takes the provider's phase**, so a failed fetch reads "Could not check: this
   instance did not answer." rather than "Checking…". The one-argument calls the suite makes are unchanged.
5. **Tester-lane re-aims the Phase 3 list missed**, committed on their own as `test:` (ef81af6): one-writer W5 now
   allows the checklist page as the one writer's second caller — ADR 0002's Option A, which keeps the server's one
   writer and adds a caller.

## Linked artifacts

- ADR: `engineering-team/decisions/assistant-profile-checklist/0002-the-checklist-page-fixes-through-the-one-writer.md`
- Test plan: `engineering-team/stories/assistant-profile-checklist/2-the-checklist-page-and-its-one-click-fixes.test-plan.md`
- Review: `engineering-team/reviews/assistant-profile-checklist/2-the-checklist-page-and-its-one-click-fixes.md`
