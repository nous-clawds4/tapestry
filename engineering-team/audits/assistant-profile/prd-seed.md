# PRD Seed: Your Tapestry Assistant's profile

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/assistant-profile/audit.md`
**Anchor:** acceptance frame in `book.md` (the owner's ask, quoted verbatim)
**Confidence:** **high** for what shipped; **medium** for what the product should become next
**Date:** 2026-09-21

> This is a reverse-engineered baseline in the product-team PRD shape. It is a **strawman for the
> product team**, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or
> `[UNKNOWN — product input needed]`.
>
> **Read the confidence honestly.** Unlike a scaffold book, this one finished what it set out to do: the owner's four
> asks are all observable (stories 1–4 in production, story 5 on staging). What this seed cannot tell the product team is
> what the assistant's profile is *for* beyond looking right — the ask was about consolidation and truthfulness, not about
> what people do with the profile once it exists.

## 1. Product vision

`[FROM FRAME]` Every signed-in person who has a Tapestry Assistant — the nostr identity this instance holds for them and
signs with on their behalf — can see and manage that assistant's public profile (its kind 0) in **one place**, starting
from **one default**, with an **honest** answer to "does my assistant need setting up?" and an **honest** account of where
each publish went.

`[INFERRED]` The underlying problem was trust in the instance's own words: before this book the dashboard told people their
assistant "doesn't have a face yet" while its profile sat on five relays, four surfaces could rewrite the profile with three
different defaults, and a publish reported success even when no relay accepted it. The fix is less a feature than a promise:
*what the app says about your assistant is true, and only you change it*.

## 2. Personas

`[INFERRED]` from the stories' "As an Owner, Admin or Customer" lines and epic decision 4:

- **The Owner** — their assistant is the instance's Tapestry Assistant (TA), which also signs firmware and concept-graph
  events. They manage its profile like anyone else's: from `/assistant`, for their own assistant only.
- **An Admin** — has their own assistant (created on `/assistant` if they have none). They no longer have any route to the
  TA's profile — a deliberate change (epic decision 4).
- **A Customer** — has an assistant created at sign-up (or on `/assistant`). Before this book the only in-app editor they could
  reach was on `/settings`; now every entry point leads to `/assistant`.
- **A signed-in guest** — no assistant and no way to create one; the menu item is disabled and the page explains why.
- **A visitor** — asked to sign in; sees no one's assistant controls.
- `[UNKNOWN — product input needed]` **The people who *read* these profiles** — other nostr users seeing an assistant's
  name, picture, about and NIP-05 in their clients. Nobody has asked what they need to see.

## 3. Scope (as-built)

`[FROM FRAME]` Shipped:

- **The My Assistant page** at `/assistant` (Brainstorm look): the assistant's pubkey, whether its profile is published, its
  NIP-05 (public instances only), a link to its public profile, the seven editable fields (name, display name, about,
  picture, banner, website, lightning address), "Reset to defaults", the per-relay publish result, and — for the Owner
  only — the badged-avatar generator.
- **Every entry point leads there**: both avatar menus (two items), the dashboard's prompt and checklist item, the
  assistant's profile-page banner, the Tapestry Settings tab and its old URL, and the `/settings` card.
- **One default profile** for every role (the owner's table, quoted in story 3): "‹name›'s Tapestry Assistant", a fixed
  two-paragraph about, the branded avatar; website, NIP-05 and a `client` tag only on a public instance.
- **An honest setup prompt**: shown only when the viewer's own assistant has no profile on this instance's relay or on the
  publish relays; never to a visitor, never for someone with no assistant, never on an error.
- **Publishing** to the relays the operator configured (general-purpose, profile and WoT), or only locally in local-only
  mode, with each relay's own answer shown.
- **One writer**: nothing but the page's publish can change an assistant's profile; the old dashboard button and the legacy
  pages' publish buttons are gone.

`[FROM FRAME]` **Not built, deliberately:** changing anyone's existing profile (no backfill — profiles change when their
person republishes); validating what people type; a visual redesign.

## 4. Domain model

`[INFERRED]` — no knowledge-graph concept was touched; this is the model the code embodies:

- **Assistant** — a nostr keypair this instance holds for one person (Owner → the TA; Admin, Customer → their own). One per
  person per instance.
- **Assistant profile** — the assistant's kind 0 event: the seven fields plus a server-managed NIP-05 and a
  `["client", ‹domain›]` tag on a public instance. Replaceable: the newest wins.
- **The default profile** — a pure function of the person (their name, else their npub) and the instance (public or not).
  It is *offered*, never published by itself.
- **Public instance** — a syntactic property of the configured domain: not loopback, private-network, `.local`,
  `.internal`, `.home.arpa` or a bare hostname. It decides the website, NIP-05, client tag and the picture's host.
- **Setup state** — per person: set up · needs setup · no assistant · unknown. "Set up" means any kind 0 exists, on this
  instance's relay first, then on the publish relays (a copy found there is brought home).
- **Publish set** — the operator's general-purpose ∪ profile ∪ WoT relay settings; empty in local-only mode.
- **Publish result** — per relay: accepted · refused · unreachable · timed out · skipped, with the relay's reason; overall:
  published · kept local · not delivered.

## 5. Design rules (as-built)

`[INFERRED]` from the shipped behaviour and the ADRs:

- **Whose assistant is always the viewer's own.** No surface shows or edits the instance TA to anyone but the Owner.
- **An error is never "no profile".** A failed check shows nothing rather than a false prompt.
- **Local first.** The profile is saved on this instance's relay before anything goes outward; if that fails, nothing does.
- **Never overclaim.** "Saved" and "published" are different words; a partial publish is not shown as success.
- **Degrade honestly.** The app never publishes a loopback, private-network or relative URL, and says why when it withholds
  something (no NIP-05, no badged avatar).
- **Offer only what can succeed** for the viewer's role (the generator for the Owner; "Create my assistant" for Admins and
  Customers).
- `[UNKNOWN]` No visual design rules exist for the page itself; it reuses the control panel's editor inside a Brainstorm
  page.

## 6. Carry-forward & open questions

Promoted from the build audit §6:

- **Who can see who holds an assistant?** The status endpoint tells anyone which pubkeys hold a key on this instance (an
  admin roster leak) — queued as its own story.
- **Stale published profiles.** Existing profiles keep older defaults until their person republishes; production's customer
  assistant carries a NIP-05 that stopped verifying at the domain cutover. Nothing flags either ("needs attention").
- **What the Admin role may do with the instance TA** beyond its profile (OPEN.md #269), and the key lifecycle (Admin
  provisioning and deprovisioning, restoring a lost TA key).
- **Badged avatars for everyone**, not just the Owner.
- **The legacy pages**: remove them, or keep them read-only?
- **The about text's kind 10040 sentence** can be false for someone with assistants on several instances.
- **The page's design pass** — its look, and showing the full npub.
- **Smaller:** URL validation for typed fields; a relay list (kind 10002) for assistants; one display fallback for
  assistants with no profile; dead relays in the default lists (OPEN.md #270).

## 7. What product must validate

- [ ] Is "one writer, the person themselves" the right rule for every role — including an Owner who wants to fix a
      Customer's broken profile for them?
- [ ] Should people with a stale or broken published profile be told (a "needs attention" state), and should anyone ever be
      prompted to adopt the new default?
- [ ] What the people who *read* an assistant's profile need from it — is the owner's about text the right message?
- [ ] Whether the status endpoint may say who holds an assistant key at all, and to whom
- [ ] The fate of the legacy pages, and whether the My Assistant page needs its own design
