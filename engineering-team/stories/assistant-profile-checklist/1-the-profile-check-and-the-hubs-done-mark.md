# Story 1: The profile check — which items of your Assistant's profile need attention — and the hub's Done mark

**Status:** Done
**Created:** 2026-10-09
**Type:** Feature
**Epic:** `assistant-profile-checklist`
**Book:** `engineering-team/audits/assistant-profile-checklist/book.md`

## Background

The hub at `/assistant` marks its "Your Tapestry Assistant's Profile" card **Needs attention** for everyone
with an Assistant, because nothing about the profile is checked yet (assistant-management #1). Only one action
has a real answer today, Identification Tags (assistant-identification-tags #1), which comes from
`GET /api/assistant/attention`. The hub, its count line and the Assistant Alert all read that answer.

The owner's alert criteria for the profile action: "If any of the Tapestry Assistant profile criteria are not
met (create avatar, working NIP-05, client tag, URL, etc)". The owner listed the items on 2026-10-09, and
three more were agreed at Planning (book, Decisions 1). Seven items, in this order:

| # | Item | Done when… | Counts? |
|---|---|---|---|
| 1 | A personalized avatar | the profile's picture is a personalized avatar this instance stamped and still serves, at this instance's own address | yes |
| 2 | A personalized background image | — not checked yet (placeholder) | **no** |
| 3 | A working NIP-05 | the profile's NIP-05 is on this instance's domain, and that domain lists it for the Assistant | yes |
| 4 | Website | the profile's website is this instance's address | yes |
| 5 | Name and About | the profile has a name and an About text | yes |
| 6 | Client tag | the profile event carries this instance's client tag | yes |
| 7 | Visible to other nostr apps | the Assistant's latest profile is on at least one outside relay this instance publishes to | yes |

This story gives the instance one answer to "which of these items are done for this viewer's own Assistant",
and makes the hub's profile card, its count line and the Assistant Alert read it. It also gives the hub a
**Done** badge for any checked action that is done, which is how the hub's profile card "will indicate
completion" (the owner's words). The page itself and its fixes are stories 2 and 3.

## User-facing description

As someone with a Tapestry Assistant on this instance, I want the hub to tell me whether my Assistant's
profile is complete — and to say **Done** once it is — so that the hub's marks, its count and the reminder in
the top bar tell the truth for the profile.

## Acceptance criteria

- [ ] **AC-1: the item list.** The app holds one list of profile items, the same on every instance and shipped
      with the app: the seven in the table above, in that order. Each entry names the item and whether it
      counts. The background image is listed and does not count. Adding an item later is one entry.
- [ ] **AC-2: the answer is about the viewer's own Assistant, and only theirs.**
  - Given a signed-in viewer who has an Assistant on this instance (the same answer that marks `/setup`'s
    first step done: for the Owner the instance TA, for anyone else their own), when the instance is asked,
    it answers for each item: **done** or **needs attention**, whether the check **finished**, and a reason
    when it is not done. The background image's answer is **not checked**.
  - There is no way to ask about another person or another Assistant: the answer follows the session, and no
    parameter changes whose it is.
  - Given a visitor who is not signed in, or a signed-in viewer with no Assistant here, the answer has no
    profile items (as for Identification Tags today).
- [ ] **AC-3: which profile.** The profile checked is the Assistant's newest kind 0, found the way every setup
      surface finds it today: this instance's relay first, then the relays this instance publishes Assistant
      profiles to (ADR assistant-profile/0001). Given the Assistant has no profile anywhere, every counted
      item needs attention with the reason **no profile**.
- [ ] **AC-4: each item's rule.**
  - **Avatar:** done when the picture is a personalized avatar this instance stamped (the composite of
    ta-avatar #3) and this instance still holds it, at this instance's own public address. The instance's
    standard branded image is *not* personalized; it needs attention with its own reason, as does any other
    picture, or none.
  - **NIP-05:** done when the NIP-05 is `<name>@<this instance's domain>` and fetching that domain's
    `/.well-known/nostr.json?name=<name>`, the way any nostr client would, lists the Assistant's pubkey for
    that name. Reasons: none set; on another domain; not listed for the Assistant; the domain did not answer.
  - **Website:** done when the website is this instance's address (`https://<domain>`; a trailing slash and
    the host's letter case do not matter). Reasons: none set; something else.
  - **Name and About:** done when the name (or the display name) and the About text are each non-empty once
    spaces are trimmed. The reason names which is missing.
  - **Client tag:** done when the profile event carries `["client", <this instance's domain>]`. Reason: no
    client tag for this instance.
  - **Visible to other nostr apps:** done when at least one of the relays this instance publishes Assistant
    profiles to holds the Assistant's profile at least as new as the one in AC-3. Reasons: only on this
    instance; this instance is set to publish locally only; no outside relay is configured; no outside relay
    answered.
  - **On an instance with no public web address** (a dev box), the avatar, NIP-05, website and client tag
    cannot be done; each needs attention with the reason **no public address** (Open question 1).
- [ ] **AC-5: finished, as `/setup` means it.** An item that reads only the profile (avatar, website, name and
      About, client tag) finishes whenever the profile was read. The NIP-05 item finishes when the domain
      answered; the visibility item finishes when at least one outside relay answered, or when there is
      nothing to ask (local-only, or no relay configured). An unfinished item is neither done nor needing
      attention, and says why.
- [ ] **AC-6: the hub reads it.**
  - The profile card is marked **Needs attention** unless the check finished and every counted item is done.
    While the check is running, or when it did not finish, the card stays marked, as `/setup` shows a step as
    not done until it knows.
  - Given every counted item is done, the profile card shows a **Done** badge instead, styled like the Done
    badge on the Identification Tags page's cards. The same applies to any checked action that is done, so the
    Identification Tags card gains the badge too. A placeholder action never shows Done.
  - The hub's count line counts the profile card the same way it is marked.
  - The Assistant Alert counts the profile action only when the check finished for at least one counted item
    and found it needing attention (the confident reading, as for Identification Tags).
  - The background image never affects the card, the count or the pill.
  - The other actions are marked and counted exactly as today. Visitors and viewers without an Assistant see
    no marks and no pill, as today.
- [ ] **AC-7: read-only, one request.** Nothing is published, signed or stored by the check (beyond the
      existing copy-home of a profile found only on a publish relay, ADR assistant-profile/0001). The answer is
      fetched with the Identification Tags answer, once per full page load for a signed-in viewer with an
      Assistant, and again on demand after a fix (story 2). No polling.

## Copy

- The hub's Done badge: **Done** (the word the Identification Tags page's cards use), with the screen-reader
  prefix **Done: ** before the card's title.
- The count line is unchanged: "{n} actions need attention" / "1 action needs attention".
- The item names and reasons, as a reader sees them, are story 2's § Copy. The placeholder page behind the
  action is unchanged until story 2 replaces it.

## Concepts touched

- `39998:<TA>:nostr-user` — nostr user (whose Assistant; the viewer's own).

The profile is a kind 0, the NIP-05 a `.well-known` listing and the avatar a file on this instance's volume
(ADR ta-avatar/0003); none is a concept-graph node. No concept changes; no firmware reinstall.

## Out of scope

- The page at `/assistant/profile` and every fix (stories 2 and 3).
- Computing the background image's state.
- The other eight actions' answers.
- Caching, polling, or a server-sent refresh.
- A check on the lightning address, or on whether the Assistant's picture actually loads in a stranger's
  browser (beyond this instance still holding the file).

## Open questions

1. **A dev box: needs attention, or not applicable?** On an instance with no public web address, the avatar,
   NIP-05, website and client tag can never be done. This draft marks them **needs attention**, with the
   reason "this instance has no public web address" (and story 2 offers no fix), so the hub never calls a dev
   box's profile complete. The alternative is to drop them from the count there, so a dev box can reach Done.
   *Recommended: needs attention, as drafted — the profile really is not reachable by strangers.*
   *Settled 2026-10-09 at approval: needs attention, as drafted.*
2. **Does "visible" need every outside relay, or one?** This draft says one is enough, and the panel says how
   many have it (story 2). *Recommended: one.* *Settled 2026-10-09 at approval: one.*

## Deviations

*The Implementer's log (Phase 4, 2026-10-09): judgment calls too small for an ADR amendment, for the book-close audit.*

1. **`hasProfile` is `null` when this instance's relay could not be read** (`profile-unreadable`): neither "has a profile"
   nor "has none", so the page never offers "Publish the default profile" on a read failure.
2. **A NIP-05 lookup that answers `malformed` reads as `other-domain`.** The host is checked first, so it can only happen
   for an identifier the lookup itself refuses; the panel then says the address is not on this instance's domain.
3. **One Tester-lane correction after the first run against the implementation**, committed on its own as `test:`
   (eea477f): S2 sliced the OpenAPI entry from a line-start pattern that swallowed the blank line before it, so it read
   an empty entry; it now anchors on the route's own line.

## Linked artifacts

- ADR: `engineering-team/decisions/assistant-profile-checklist/0001-the-profile-check-joins-the-one-attention-answer.md`
- Test plan: `engineering-team/stories/assistant-profile-checklist/1-the-profile-check-and-the-hubs-done-mark.test-plan.md`
- Review: `engineering-team/reviews/assistant-profile-checklist/1-the-profile-check-and-the-hubs-done-mark.md`
