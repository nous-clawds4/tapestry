# Epic: assistant-profile-checklist — Your Tapestry Assistant's Profile, as a checklist with one-click fixes

**Status:** Active
**Created:** 2026-10-09
**Book:** `engineering-team/audits/assistant-profile-checklist/book.md` (no PRD — acceptance frame)
**Provenance:** the owner's ask of 2026-10-09, quoted verbatim in the book, with three decisions taken at
Planning. It follows `assistant-identification-tags`, which turned the hub's second action into a real page
with a real "needs attention" answer. It picks up the profile action from the parked intake entry of
2026-09-21 ("The Assistant Management page, the rest of the way").

## Goal

**`/assistant/profile` becomes a real checklist, and the hub's profile card gets a real answer.** Seven
panels, each **Done** or **Needs attention**, about the viewer's own Assistant's published profile: a
personalized avatar, a personalized background image (a placeholder that does not count), a working NIP-05,
the website, name and About, the client tag, and visibility to other nostr apps. Each panel that needs
attention offers a one-click fix. When every counted item is done, the hub's card says **Done**.

## Stories

`stories/assistant-profile-checklist/`. All three are features, so all three take all five phases (Standard).

1. `1-the-profile-check-and-the-hubs-done-mark.md`: the seven items, the server's answer for the viewer's own
   Assistant, and the hub's card, count line and pill reading it, with a **Done** badge on a checked action
   that is done.
2. `2-the-checklist-page-and-its-one-click-fixes.md`: the page, its seven panels, and the one-click fixes for
   NIP-05, website, name and About, client tag and visibility (and "publish the default profile" when there
   is none). Depends on #1.
3. `3-a-personalized-avatar-for-every-assistant.md`: stamping the signed-in person's own picture for their own
   Assistant, for every role, and the avatar panel's fix. Depends on #1 and #2.

## Key facts / guardrails

- **"Whose Assistant?" is this epic's POV question, as it was the hub's.** Every answer is about the viewer's
  own Assistant: `user.assistantPubkey`, the one main→delegate mapping. For the Owner it is the instance TA;
  for anyone else it never is. The TA pubkey is resolved at runtime, never hardcoded.
- **"Done" is about this instance.** The avatar, the NIP-05, the website and the client tag are all "branded
  to / hosted by the local Tapestry instance". Their rules read this instance's own domain at runtime
  (`describeInstance`), never a literal deployment name.
- **One writer.** Every fix publishes through the existing one writer of an Assistant's kind 0
  (`POST /api/assistant/publish-profile`, ADR assistant-profile/0005): the signed-in person, their own
  Assistant, the fields as content; this instance's relay first, then the configured publish relays, each
  relay's answer reported (ADR assistant-profile/0002). The NIP-05 and the client tag stay server-managed.
- **Local-first.** The profile is read from this instance's relay first (ADR assistant-profile/0001); outside
  relays are asked only for what the local relay cannot answer, or for what is about the outside (the
  visibility item, the NIP-05 lookup).
- **The avatar's safety rules stay.** Stamping reads the picture from the person's *own* nostr profile on the
  server, never a URL from the request; stored composites are never deleted on regenerate (ADR ta-avatar/0003
  D2, D3). Opening it to every role changes *who*, not *how*.
- **Open work this epic touches:**
  - **`assistant-management`** (closed) and **`assistant-identification-tags`** (closed): this epic adds the
    second checked action to `CHECKED_ACTIONS` and the hub's Done badge, which the Identification Tags card
    gains too.
  - **Other sessions on the assistant's surfaces.** Re-check the shared line before Implementation and before
    Review (book § Shared lines).

## Deferred / out of scope

- **The personalized background image** itself: the panel is a placeholder, its state is not computed, and it
  does not count (the owner's words).
- The other eight action pages and their real answers (intake 2026-09-21 stays partly open).
- Automatic re-stamping when a person changes their own picture (ta-avatar #3's out-of-scope, unchanged).
- A lightning address item.

## ADRs

`decisions/assistant-profile-checklist/`, created per story at Architecture.
