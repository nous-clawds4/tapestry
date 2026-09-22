# PRD Seed: Identification Tags — the handshake between a person and their Tapestry Assistant

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/assistant-identification-tags/audit.md`
**Anchor:** the acceptance frame in `book.md` (the owner's ask, quoted verbatim) and the nine Discovery decisions in
`product-team/discoveries/assistant-identification-tags.md`
**Confidence:** **high** for what shipped and why; **medium** for how it will read to a user, because nothing has
been deployed and the four canonical definitions are not published yet.
**Date:** 2026-09-22

> This is a reverse-engineered baseline in the product-team PRD shape. It is a **strawman for the product team**,
> not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`.
>
> **Read the confidence honestly.** This book had a Discovery conversation, so the frame is unusually well
> grounded: nine decisions were taken with the owner before a story was written. What the record cannot show is
> the page in use. On every instance today each of the four rows reads "Tag not found", because the definitions
> are the owner's to publish and they have not been; the first real use is still ahead.

## 1. Product vision

`[FROM FRAME]` Part of an Assistant's identity is its relationship to its person. Four taggings broadcast that
relationship to outside clients, applications and services, in both directions: the person tags their Assistant
"My Tapestry Assistant" and "My Agent"; the Assistant tags the person "My Tapestry Owner" and "My Human". The
Identification Tags page shows which of the four are in place and lets the person put the missing ones in place:
their own with their nostr extension, the Assistant's through this instance, which holds the Assistant's key.

`[FROM FRAME]` The Treasure Map (kind 10040) tells apps what an Assistant publishes for its person; these tags are
"simply an additional mechanism to associate you and your Assistant" (the owner's sentence, on the page).

`[INFERRED]` The page is the first of the Assistant Management hub's ten actions to carry a real "needs attention"
answer, and the pattern the other nine will follow: one server answer per viewer, read by the hub, the Assistant
Alert and the action page alike, with the action's own page doing the fixing.

## 2. Personas

`[FROM FRAME]` / `[INFERRED]` from the stories and the page's states:

- **A signed-in person with an Assistant on this instance** (Owner, Admin or Customer): sees the page's two cards
  with each tagging's state, the hub's card marked while one is missing, and the Assistant pill counting it once
  the check has finished. They publish their own two taggings with their extension and have the Assistant publish
  its two.
- **A signed-in person without an Assistant:** the hub's line and link, nothing to check.
- **A visitor:** "Sign in to see your identification tags." with the sign-in button.
- `[INFERRED]` **Outside clients, applications and services** that read the taggings from the relays to learn whose
  Assistant a pubkey is. They read by name, whoever authored the tag definition; the canonical addresses under the
  owner's key are a convention for them, not yet written down outside the code.
- `[INFERRED]` **The instance operator,** whose relay configuration decides whether a check can finish: with no
  tag-federation relay, a missing tagging never finishes (the hub marks, the pill does not count).

## 3. Scope (as-built)

`[FROM FRAME]` Shipped on `feat/assistant-identification-tags`, not yet on staging:

- **The required list**, the same on every instance, shipped with the app: four entries, each with a name, a slug,
  a signer, a target and a canonical address under the owner's key. Adding a tagging is adding an entry (and
  publishing its definition).
- **One answer** for the signed-in viewer's own Assistant: which of the four are present, which are missing, and
  whether the check finished. This instance's relay first, the tag-federation relays only on a miss; the required
  signer's newest stance decides; a third party's dispute changes nothing; the signer's own dispute or retraction
  makes a tagging missing.
- **The hub, the count line and the Assistant Alert** read it for this action; the other nine still count as
  placeholders.
- **The page:** the owner's description, the Treasure Map sentence, two cards by signer, five row states, a
  checkbox per missing tagging (checked by default; leaving one out is "not this time", nothing is stored), one
  button per card naming the signer, per-relay results after each publish.
- **Your two taggings** signed by your extension and sent to this instance's relay and the outside relays.
- **Your Assistant's two taggings** signed by this instance with your own Assistant's key, local-first then the
  configured relays, through one narrow route; nothing at Assistant creation.

`[FROM FRAME]` Explicitly out: the other nine actions, the Assistant's DMs, any change to the tagging wire format, a
stored opt-out or an optional tagging, publishing at creation, disputing or retracting from this page, the kind-0
`p`-tag form of the handshake.

## 4. Domain model

`[INFERRED]` from the library, the ADRs and the stored shapes:

- **Person** — the signed-in viewer's main pubkey.
- **Assistant** — the nostr account this instance holds for the person (`user.assistantPubkey`, one main→delegate
  mapping; the Owner's is the instance TA). The instance signs with its key on the person's request.
- **Tag definition** — a kind 39999 element, addressed `39999:<author>:<slug>`. The four **canonical** definitions
  are the owner's own (`39999:e5272de9…:my-tapestry-assistant | my-agent | my-tapestry-owner | my-human`). A
  same-named definition by any other author counts for *reading*; only the canonical one is used for *publishing*.
- **Tagging** — a kind 39999 `nostr-user-tag` assertion by a signer about a target: replaceable by
  `d = profile-tag-<slug>-<target[0:8]>-<signer[0:8]>`, with `p` (target), `a` (the definition), `e`, two `z`
  stamps, and a `polarity` (apply ≥ 0.5, dispute ≤ −0.5). A kind 5 retracts it. The newest stance is the stance.
- **Required tagging** — one of the four entries: which tag, who signs (`person` | `assistant`), whom it is about.
- **Attention answer** — per action: finished, done, pending; per required tagging: present, finished, a reason when
  unfinished (`local-relay-failed` · `no-outside-relay` · `outside-relays-silent`), and whether the canonical
  definition was found.
- **Publish report** — per tagging, per relay: accepted · rejected (reason) · unreachable (reason) · timed out ·
  skipped (local-only publish mode); for the Assistant's, a local stage that stops everything when it fails.

Relationships: a Person owns an Assistant; a Person signs taggings about the Assistant; the Assistant signs taggings
about the Person; the instance reads the person's answer from its own relay first and the tag-federation relays
second, and publishes the person's taggings from the browser and the Assistant's from the server.

## 5. Design rules (as-built)

`[FROM FRAME]` / `[INFERRED]`:

- **Two cards, one per signer.** "Taggings you put on your Assistant" and "Taggings your Assistant puts on you".
- **Buttons name the signer:** "Publish with your nostr extension" · "Have your Assistant publish". A card whose
  taggings are all present keeps its button, disabled, under a "Done" badge; a card with nothing checked has a
  disabled button too.
- **Row states in plain words:** Present · Missing · Checking… · "Tag not found: the tag "{name}" has not been
  published yet, so this tagging can't be made here." · three "Could not check" sentences that say which relay did
  not answer. A row that could not be checked has no checkbox.
- **Checked by default.** Opting out is per press; nothing remembers it, and the tagging still counts as missing.
- **Results in the profile publish's words,** one summary sentence per tagging and one line per relay, with the
  editor's status marks (✅ ⚠️ ℹ️ ❌) beside them; the results region is `aria-live`.
- **Refusals in approved words,** the server's for the Assistant's publish ("You don't have a Tapestry Assistant on
  this instance yet." · "That is not one of the taggings your Assistant publishes."), and "This instance did not
  answer; nothing was published." when it never answers.
- **The hub may show doubt; the pill does not.** An unfinished check marks the card; only a finished, missing check
  counts in the pill, which hides while the check runs.
- **Nothing is published without a press,** and nothing is stored about a press.
- **Phone width:** the cards and rows reflow at 480 px; the page is styled like `/setup`'s cards.
- `[UNKNOWN]` No rule was recorded for how the page should read once the list grows past four, or for a fifth state
  such as "present here, not yet on any outside relay".

## 6. Carry-forward & open questions

Promoted from the build audit §6:

1. The owner publishes the four canonical definitions (names, slugs and proposed descriptions in story 2 § Copy).
2. Ship the branch to staging, then see the page with the definitions in place.
3. Whether "present" should mean "broadcast" (reached an outside relay), and whether a Present row can be re-sent.
4. What to offer when the check cannot settle: "publish anyway", a hint to configure a tag-federation relay, or a
   check that finishes without outside relays.
5. The hub/page corner where a same-named tag by another author is present but the canonical definition is not found.
6. The reading convention for outside clients, written down in `protocols/` (docs-lane; the owner approves).
7. Publishing the Assistant's taggings at creation, and on which creation paths.
8. The other nine actions and the DMs; the kind-0 `p`-tag form of the handshake.

## 7. What product must validate

- [ ] The four descriptions as the owner will publish them (story 2 § Copy proposed them; the owner edits).
- [ ] Whether the two hub readings (mark on doubt, count on certainty) are the rule for the other nine actions.
- [ ] Whether the pill should hide during each page load's check, or keep its last count.
- [ ] Whether "present on this instance's relay" is enough, or whether the page owes a "broadcast" state.
- [ ] Whether a row the check could not settle should still be publishable.
- [ ] Whether the Assistant's taggings should also be published at creation, and on which paths.
- [ ] Whether the four names are final ("My Owner" became "My Human" at Discovery) and whether more are coming.
- [ ] Whether outside clients should read by name or by canonical address, once the `protocols/` note exists.
- [ ] Whether the person can dispute or retract a tagging from this page, or only from the profile's tag surfaces.
