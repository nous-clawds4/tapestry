# PRD Seed: Your Tapestry Assistant's Profile — a checklist with one-click fixes

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/assistant-profile-checklist/audit.md`
**Anchor:** the acceptance frame in `book.md`: the owner's ask, quoted verbatim, three decisions taken at Planning, and two
open questions settled at story approval. There was no Discovery conversation.
**Confidence:** **high** for what shipped and why; **medium** for how it reads to a person. It is on staging and in
production, and its anonymous surfaces were checked on both, but nobody has yet used it signed in on a live instance.
**Date:** 2026-10-10

> This is a reverse-engineered baseline in the product-team PRD shape. It is a **strawman for the product team**, not a
> ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`.
>
> **Read the confidence honestly.** The frame came from one paragraph and three planning questions, not a Discovery
> conversation. Several product questions were answered by engineering defaults that a person has not yet tried: what
> "personalized" and "working" mean, what a dev box should show, and what a refused fix should say.

## 1. Product vision

`[FROM FRAME]` A Tapestry Assistant publishes on its person's behalf, and its nostr profile is how every other app
recognizes it. The "Your Tapestry Assistant's Profile" page is a checklist of what makes that profile right for this
instance: a personalized avatar branded to the instance, a NIP-05 hosted by it, its website, and (added at Planning) the
client tag, a name and About text, and a copy outside this instance's relay. Each item is **Done** or **Needs
attention**, and the hub's card says **Done** when every counted item is.

`[FROM FRAME]` The owner's earlier words for this page: "effectively a checklist of features that need to be done
correctly", not the profile editor. At Planning the owner chose a **one-click fix on each panel** rather than a link to
the editor.

`[INFERRED]` With Identification Tags and Outbox Relays, this completes "how the outside world recognizes and finds your
Assistant": who it is (kind 0), whose it is (the identification taggings) and where its events are (kind 10002).

`[UNKNOWN — product input needed]` Whether the checklist should also cover the profile's *quality* (a real picture of the
person rather than the standard image; About text the person wrote rather than the default), or only its correctness.

## 2. Personas

`[FROM FRAME]` / `[INFERRED]` from the stories and the page's states:

- **A signed-in person with an Assistant on this instance** (the Owner, an Admin or a Customer):
  - sees the hub card marked until every counted item is done;
  - reads seven panels, each with a plain-words reason;
  - presses one fix per panel and reads each relay's answer;
  - stamps their own nostr picture with the Tapestry mark, previews it, and publishes it as their Assistant's picture.
- **The Owner of a dev box** (no public address): the avatar, NIP-05, website and client tag can never be done there, and
  the panels say why.
- **A signed-in person without an Assistant:** the hub's line and its link to Account Setup.
- **A visitor:** "Sign in to see your Assistant's profile." with the sign-in button.
- `[INFERRED]` **Other nostr clients and apps**, which show the Assistant's name, picture, NIP-05 check mark and website,
  and the client tag naming this instance. Nothing Tapestry-specific is on the wire.

## 3. Scope (as-built)

`[FROM FRAME]` On `staging` and in production (2026-10-09, PR #829):

- **Seven panels:** a personalized avatar; a personalized background image (**Coming soon**, not counted); a working
  NIP-05 on this instance's domain; the website set to this instance's URL; a name and About text; the client tag naming
  this instance; and the latest profile on at least one outside relay.
- **One answer for the hub and the page,** about the viewer's own Assistant only, read from this instance's relay first.
  The card reads Done when every counted item is done; the pill counts it only when a finished check found something
  missing.
- **One-click fixes:** register the NIP-05, set the website, fill in the default name / About text, republish with the
  client tag, publish to outside relays; **Publish the default profile** when there is none. Each changes only its own
  field, publishes through the one profile writer, shows each relay's answer and re-checks. One at a time.
- **Never overwrite by accident** (added at review): a fix publishes only when it has just read this instance's own copy
  of the profile; otherwise nothing is published and the panel says so.
- **A personalized avatar for everyone:** the person's own nostr picture, fetched by this instance (never a URL the
  browser sends), stamped with the Tapestry mark, previewed, stored on this instance and published. The Edit Assistant
  Profile page offers the same to everyone.
- `[FROM FRAME]` **Not in scope:** the background-image feature; any other action page; changing the kind 0 format; a
  "fix everything" button; changing the editor beyond the avatar section.

## 4. Domain model

`[INFERRED]` from the ADRs and stored shapes:

- **The Assistant's profile** (kind 0, replaceable, one per author): seven content fields this instance writes (`name`,
  `display_name`, `about`, `picture`, `banner`, `website`, `lud16`), plus the NIP-05 and the `client` tag, which the
  server sets. Any other field is dropped by every publish from this instance.
- **Profile item:** `{ key, counts, finished, done, reason, …detail }`, seven of them, in a fixed order, from one shared
  list both the server and the page read. The background image is listed and does not count.
- **The Assistant** (`39998:<TA>:nostr-user`): the signed-in person's own delegate, from the one main→delegate mapping (for
  the Owner, the instance TA). The session decides whose; the request never names one.
- **The instance:** its domain, URL and whether it has a public address, read at runtime. "Branded to / hosted by the
  local instance" means *this* instance's domain.
- **Composite avatar:** a PNG on this instance's volume, named by its content hash, never deleted, at most 20 new per
  person per day.
- **The attention answer:** re-derived on every request and never stored (principle 3).

## 5. Design rules (as-built)

`[INFERRED]` from the shipped page and the reviews:

- **The hub and the page read one answer,** so the card, the panels, the count line and the Assistant Alert cannot
  disagree.
- **Marked until proven done:** a panel whose check did not finish says "Could not check: …" and counts as needing
  attention; the pill counts only a finished check that found something missing.
- **A fix changes only its own field** and republishes the rest exactly as published; it stops rather than guess when it
  cannot read this instance's copy.
- **Preview before publish** for anything a person would see as their Assistant's face.
- **The page wears the Identification Tags page's cards** (`bs-idtags-*`). No design-guide rule was recorded for action
  pages beyond "styled like the hub".

## 6. Carry-forward & open questions

Promoted from audit §6:

- **Use it signed in** on staging and production: the panels for a real Assistant, one fix, a stamped avatar.
- **The background image,** the same idea for the banner.
- **Fields beyond the seven are dropped** by every publish from this instance, so a profile edited in another nostr app
  can lose them on a fix.
- **More checks:** a lightning address; whether the picture actually loads for a stranger.
- **Re-stamping** when a person changes their own picture.
- **Small edges and debt:** a few wording and display edges, the editor not refreshing the hub after a publish, and
  pre-existing timeouts on two outbound fetches (ledger rows named in the audit).

## 7. What product must validate

- [ ] **What "personalized" means.** Today: a composite this instance stamped from the person's own nostr picture. A
  person whose picture is on plain http, or who has none, cannot complete the item. Is that the bar? `[INFERRED]`
- [ ] **A dev box can never read Done** (story 1, settled at approval). Is the permanent "Needs attention" on the hub and
  pill acceptable for operators who run Tapestry privately? `[FROM FRAME]`
- [ ] **"Visible" means one outside relay** holds the latest copy (settled at approval). Enough, or should it name a
  minimum? `[FROM FRAME]`
- [ ] **A refused fix says "This instance did not answer; nothing was published."** That reuses existing words; when the
  instance did answer but from an outside copy, a more specific sentence may serve better. `[INFERRED]`
- [ ] **Dropping unknown kind 0 fields** on every publish (§ 6). Keep them, or warn? `[UNKNOWN]`
- [ ] **The pill and the profile card:** most Assistants created before this book have no stamped avatar, so the card
  needs attention for almost everyone after deploy. Is that the nudge wanted? `[UNKNOWN]`
- [ ] **Quality vs correctness** (vision § 1): should "name and About" accept the defaults as done? `[UNKNOWN]`
