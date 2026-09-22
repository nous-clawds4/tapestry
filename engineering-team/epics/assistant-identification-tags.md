# Epic: assistant-identification-tags — the Identification Tags page, and the hub's first real answer

**Status:** Active
**Created:** 2026-09-22
**Book:** `engineering-team/audits/assistant-identification-tags/book.md` (no PRD — acceptance frame)
**Provenance:** the owner's ask for this action page (quoted in the book), settled through a Discovery
conversation on 2026-09-22 (`product-team/discoveries/assistant-identification-tags.md`). It follows two
patterns: `setup-status-and-alert` (one server answer read by a page and its alert) and
`assistant-profile` (a narrow server publish for the signed-in person's own assistant, with a per-relay
report). It picks up two parked intake entries: the rest of the Assistant Management page (2026-09-21,
this action only) and the TA ↔ owner two-way handshake (2026-08-09, in its tagging form).

## Goal

**`/assistant/identification-tags` becomes a real page, and the hub's Identification Tags card gets a
real "needs attention" answer.** Four taggings make a two-way handshake between a person and their
Tapestry Assistant: two the person signs about the Assistant ("My Tapestry Assistant", "My Agent") and
two the Assistant signs about the person ("My Tapestry Owner", "My Human"). The page shows which are
present, and lets the person publish the missing ones: their own with their extension, the Assistant's
through this instance, which holds the Assistant's key.

## Stories

`stories/assistant-identification-tags/`. All three are features, so all three take all five phases
(Standard).

1. `1-the-one-answer-and-the-hubs-first-real-mark.md`: the required list, the server's answer for the
   viewer's own Assistant, and the hub's card, count line and pill reading it for this action.
2. `2-the-page-and-your-two-taggings.md`: the page with its two cards, checkboxes and states, and the
   person's publish with their extension. Depends on #1.
3. `3-your-assistants-two-taggings.md`: the narrow server action that signs the Assistant's two taggings
   for the signed-in person's own Assistant, and the second card's publish. Depends on #1 and #2.

## Key facts / guardrails

- **"Whose Assistant?" is this epic's POV question, as it was the hub's.** Every answer is about the
  viewer's own Assistant: `user.assistantPubkey`, the one main→delegate mapping. For the Owner it is the
  instance TA; for anyone else it never is. The TA pubkey is resolved at runtime, never hardcoded.
- **Publication stays permissionless; trust is filtered at read time.** Anyone may tag anyone; the
  server gates nothing at write time except what it will *sign with keys it holds*. The check counts a
  tagging by its name, signer and target, whoever authored the tag definition it points at. No WoT rank
  filter applies to a person's own claims.
- **The canonical tags are the owner's, not the instance's.** The four definitions are published once by
  the project owner's key. The app names them by canonical address for publishing, and by name for
  reading. This is a protocol-level constant in the spirit of a well-known list address, not a
  per-deployment TA pubkey; it belongs in one module and in the protocols directory as a convention.
  (Confirm the key at story approval.)
- **The tagging wire format is unchanged.** The four taggings are ordinary `nostr-user-tag` assertions
  (the deployed shape, with the ADR 0015 legacy z alongside the runtime local z). A change to the
  protocol is out of scope; a convention note naming the four tags is not a wire change.
- **Local-first, honest reporting.** An Assistant's tagging is written to this instance's relay first;
  if that fails nothing goes outward. Every relay's answer is reported, in the profile publish's words.
- **Nothing is published without a press.** No creation-time hook, no retry, no stored opt-out.
- **Open work this epic touches:**
  - **setup-status-and-alert** (open book): another session is building the `/setup` step pages. The
    Setup Alert and the Assistant Alert share the top bar; this epic changes only what the Assistant
    Alert counts, not where it sits.
  - **unified-tagging-ui** (open book, on `feat/tags`, not on staging): touches the `/tags` directory and
    the profile's tagging surfaces. This epic adds no tag surface there and does not change the tagging
    publisher's shape.
  - **Other sessions on the assistant's surfaces.** Re-check the shared line before Implementation and
    before Review (book § Shared lines).

## Deferred / out of scope

- The other nine action pages and their real answers (intake 2026-09-21 stays partly open).
- The Assistant's DMs.
- Publishing the Assistant's taggings at creation (Decision 3: later, on top of story 3's action).
- A stored opt-out or an "optional" tagging (Decision 2).
- The kind-0 `p`-tag form of the handshake from the 2026-08-09 intake entry (the tagging form is built
  here; the profile claim is not).
- Any change to the tagging wire format, the tag-federation relays, or the browser publish relay list.

## ADRs

`decisions/assistant-identification-tags/`, created per story at Architecture.
