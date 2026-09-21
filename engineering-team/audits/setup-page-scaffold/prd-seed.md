# PRD Seed: Account setup on a Tapestry instance

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/setup-page-scaffold/audit.md`
**Anchor:** acceptance frame in `book.md` (the owner's ask, quoted verbatim)
**Confidence:** **medium** — high for what shipped, low for what the product will be; see below
**Date:** 2026-09-21

> This is a reverse-engineered baseline in the product-team PRD shape. It is a **strawman for the
> product team**, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or
> `[UNKNOWN — product input needed]`.
>
> **Read the confidence honestly.** This book built a *shape*: one checklist page and three
> placeholder pages, in production and verified. The owner deliberately deferred everything that
> would make the page do something — checking each step, the alert that sends people there, and the
> steps themselves. So the product described below is mostly the owner's three one-line definitions
> plus Brainstorm's working precedent. That is a good starting point for `/discover`, not a design.

## 1. Product vision

`[FROM FRAME]` Tapestry should do what Brainstorm (`brainstorm.world/setup`) does: show a signed-in
person the few things that make their account actually work, prompt them until those things are
done, and send them to a page for each one. The owner named three:

1. **Create your account** — which, on Tapestry, means setting up your **Tapestry Assistant**.
2. **Create your follow list** — your kind 3 event, with at least one follow who is not you.
3. **Activate your Brainstorm account** — set up your **Treasure Map** (kind 10040) so that your
   rank and followers scores are managed by your Tapestry Assistant on this instance.

`[INFERRED]` The underlying problem is the gap between *having signed in* and *having scores that
work*: a person with no follows has nothing to score, and a person with no Treasure Map has scores
that other apps cannot find. `[UNKNOWN — product input needed]` whether the owner sees the same
problem for Tapestry's own users (many of whom sign in only to search), or a different one.

## 2. Personas

`[INFERRED]`, from the story's "as someone using Brainstorm Search" and the frame's "every viewer":

- **A newcomer** — signed in for the first time, no assistant, possibly no follow list. The person
  the checklist is most obviously for.
- **An existing nostr user** — already has a follow list elsewhere, possibly a Treasure Map naming
  another provider. For them, steps 2 and 3 may already be done, or done "wrong".
- **The instance owner** `[INFERRED from as-built]` — already has an assistant (the TA) and already
  sees a *different* setup checklist, the `/tapestry` Dashboard's Getting-Started card.
- **A signed-out visitor** `[FROM FRAME, interpreted]` — today sees the same page as everyone. Whether
  they should is open (§6).

## 3. Scope (as-built)

`[FROM FRAME]` In production at `/setup`: the heading "Finish setting up your account.", "0 of 3
complete" over an empty progress bar, and the three steps above, each shown as not done with a badge
and one sentence, each linking to its own placeholder page (`/setup/create-account`,
`/setup/follow`, `/setup/activate`). The page reads and writes nothing about the viewer, looks the
same signed in or out, and nothing links to it.

`[FROM FRAME]` Explicitly **not** built, by the owner's choice: checking whether each step is done,
the Setup Alert, and anything on the three step pages.

## 4. Domain model

`[INFERRED]` — none of this is wired yet; it is what the three steps are *about*:

- **Tapestry Assistant** (`39998:<TA>:tapestry-assistant`) — a nostr identity the instance holds for
  a person and signs with on their behalf. Owners, admins and customers have one; guests do not.
- **Follow list** — the person's kind 3 event. "Done" = at least one follow who is not themselves.
- **Treasure Map** — the person's kind 10040 event, which tells other apps who publishes their scores
  (kind 30382 Trusted Assertions) and where. "Done", per the owner = it names their Tapestry
  Assistant for rank and followers.
- **Setup state** — per person, per step. It is always the *viewer's own* state, never the instance
  TA's, and it has two readings in Brainstorm's precedent: an optimistic one for the page and a
  relay-verified one for anything that nags.

## 5. Design rules (as-built)

`[INFERRED]` from the shipped page and the story's recorded choices:

- The checklist follows Brainstorm's structure and words, in Tapestry's dark Brainstorm Search
  styling — not a copy of Brainstorm's light cards.
- A not-done step is a card: a numbered ring, the step's name, an amber badge, one sentence, a
  chevron. The whole card is a link.
- Badge and kicker text stays in sentence case, so the page shows exactly the approved words.
- Each step's state is announced to screen readers ("Not done:").
- Placeholder pages say "Placeholder page." plainly and name what they will do.
- `[UNKNOWN]` What a *done* step looks like — no rule exists yet.

## 6. Carry-forward & open questions

Promoted from the build audit §6:

- **Build the rest** (the owner's deferred list): real per-step status, the Setup Alert, and each
  step's page — in `engineering-team/stories/_intake.md`, entry dated 2026-09-20, with Brainstorm's
  model and what already exists to build on.
- **Create your account, per visitor.** What it means for a signed-out visitor, a guest with no
  assistant, a customer, an admin and the owner — and how it relates to the `assistant-profile`
  book's setup check and its planned My Assistant page.
- **When is a step done?** Which relays are read; whether a Treasure Map naming another provider
  counts; Brainstorm's own rule is inconsistent (`useFinishSetup.ts` line 60 against 61–63).
- **Who sees `/setup`, and how do they get there?** Signed-out visitors today; no link anywhere until
  the Setup Alert; where the alert appears — Brainstorm Search pages, the control panel, or both.
- **Three surfaces are called "setup"** — `/setup`, the Dashboard's Getting-Started checklist, and
  Trusted Agents → Set Up.
- **Small:** links on these pages shift hue on hover (an app-wide cleanup row), and the done state
  is undesigned.

## 7. What product must validate

- [ ] Is the problem "signed in but not scoreable / not findable" — or something else for
      Tapestry's users?
- [ ] Should the three steps be the same for every kind of visitor, or depend on role (owner,
      admin, customer, guest, signed out)?
- [ ] What each step's page must let a person do, and which of them lean Product Team first (the
      intake entry suggests all three)
- [ ] When the checklist should nag (the Setup Alert), and when it must not — e.g. never while a
      person's events are still loading, as Brainstorm guards
- [ ] How `/setup` and the Dashboard's Getting-Started checklist divide the work between a person's
      account and the instance's own setup
