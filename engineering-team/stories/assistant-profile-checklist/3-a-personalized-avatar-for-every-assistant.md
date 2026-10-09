# Story 3: A personalized avatar for every Assistant, and the avatar panel's fix

**Status:** Approved
**Created:** 2026-10-09
**Type:** Feature
**Epic:** `assistant-profile-checklist`
**Book:** `engineering-team/audits/assistant-profile-checklist/book.md`

## Background

ta-avatar #3 built the stamped avatar: the owner's own picture with the brain-and-lightning mark off to one
side, made in the browser, previewed, stored on this instance's volume and published as the Tapestry
Assistant's picture, so every nostr client shows it. It is the Owner's only. The server reads the *Owner's*
picture to stamp, and only the Owner may store one, so the editor hides the button from everyone else
(assistant-profile #4, AC4: "an Admin's assistant would wear the Owner's face, and a Customer is refused").

The checklist's first item is "a personalized avatar, branded to the local Tapestry instance" (story 1), and
the owner chose to open it to everyone (book, Decision 3). Without this story, an Admin's or a Customer's
profile could never be complete. This story makes stamping about the signed-in person and their own Assistant,
for every role, and gives the avatar panel its fix.

## User-facing description

As someone with a Tapestry Assistant on this instance — the Owner, an Admin or a Customer — I want to stamp my
own nostr picture with the Tapestry mark and publish it as my Assistant's picture with one press, so that my
Assistant is recognisably mine and recognisably this instance's in every nostr app.

## Acceptance criteria

- [ ] **AC-1: your own picture, for your own Assistant.** Given a signed-in person with an Assistant on this
      instance, whatever their role, when they ask to make their personalized avatar, the picture stamped is
      the one on *their own* nostr profile: read by the server from their newest kind 0 on this instance's
      relay, or, when it holds none, the relays this instance reads profiles from. No request can name a
      picture, a URL or another person. The Owner's flow is the same as today (the Owner's own picture, for
      the instance TA).
- [ ] **AC-2: preview first.** Nothing is stored or published until the person has seen the stamped picture
      and accepted it, on the avatar panel and on the Edit Assistant Profile page alike.
- [ ] **AC-3: the panel's fix publishes it.** On the avatar panel (story 2), **Make my personalized avatar**
      shows the preview; **Publish this avatar** stores it on this instance and republishes the person's own
      Assistant's profile through the one writer, with the picture set to the stored avatar's address and every
      other field as it is published now. Each relay's answer is shown (story 2 AC-5) and the checklist
      re-checks (story 2 AC-6), so the avatar panel reads **Done**.
- [ ] **AC-4: the editor offers it to everyone.** The Edit Assistant Profile page's stamped-avatar section is
      shown to every person with an Assistant here, not only the Owner, and behaves as it does today for the
      Owner: preview, then "use" fills the picture field, and the person publishes.
- [ ] **AC-5: no picture, or none that can be stamped.** Given the person's own profile has no picture, or it
      cannot be fetched, or it is not an image this instance can stamp, the panel says so in plain words and
      offers no publish. The editor still offers the standard branded image, as today; on the checklist that
      image is not personalized, so the panel stays **Needs attention** (story 1 AC-4).
- [ ] **AC-6: the same safety rules, for more people.**
  - A visitor who is not signed in, or a signed-in person with no Assistant here, is refused before anything
    is fetched or stored.
  - What is stored is checked to be a PNG of bounded size, by its bytes; storing a new avatar never deletes an
    older one; stored avatars survive a redeploy (ADR ta-avatar/0003, unchanged).
  - On an instance with no public web address, the avatar can be previewed but not published, and the panel
    says why (story 2 § Copy, "No public address").

## Copy

| Where | Words |
|---|---|
| Panel fix | Make my personalized avatar |
| Preview, accept | Publish this avatar |
| Preview, discard | Not now |
| Making | Stamping your picture… |
| No picture | Your nostr profile has no picture to stamp yet. Add one in your nostr app, then come back. |
| Can't fetch | Your nostr profile's picture could not be fetched, so it can't be stamped. |
| Not stampable | Your nostr profile's picture isn't an image this instance can stamp. |

The editor's words are unchanged, except that the section is no longer the Owner's only. Its "no picture"
line becomes the same as the panel's.

## Concepts touched

None. Composites are files on this instance's volume, not concept-graph nodes (confirmed for ta-avatar #3,
ADR ta-avatar/0003). No firmware reinstall.

## Out of scope

- The background image (the same idea for the banner; the owner's later feature).
- Automatic re-stamping when a person changes their own picture.
- Hosting avatars anywhere other than this instance.
- Any quota or clean-up of stored avatars beyond today's (each is tens of kilobytes; Open question 1).

## Open questions

1. **Storage by more people.** Opening the store to every role means Customers and Admins can write into a
   directory the world can read. The bytes are checked to be a PNG of at most 2 MB and are named by their
   content, so re-storing the same picture is free. The server cannot tell a stamped PNG from any other PNG,
   though: a signed-in person could store any PNG up to 2 MB, as the Owner can today. *Recommended: no
   per-person quota in this story; the Architect weighs a simple rate limit and records it in the ADR.*
   *Settled 2026-10-09 at approval: as recommended.*

## Linked artifacts

- ADR: `engineering-team/decisions/assistant-profile-checklist/0003-the-stamped-avatar-for-the-signed-in-persons-own-assistant.md`
- Test plan: `engineering-team/stories/assistant-profile-checklist/3-a-personalized-avatar-for-every-assistant.test-plan.md`
- Review: (filled in after Review phase)
