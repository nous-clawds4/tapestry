# PRD Seed: Done, but shared — your Treasure Map's choices respected, with a quiet nudge home

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/assistant-shared-categories/audit.md`
**Anchor:** the acceptance frame in `book.md`. It holds the owner's ask (quoted verbatim, and itself the answer to a
question about why their Lists card needed attention) and three decisions taken at intake: split counts as shared, a
pill and a line, and the Light trial. The owner added two refinements at Gate B: no ◐ mark, and the "·" kept with its
link. There was no Discovery conversation.
**Confidence:** **high** for what shipped and why. **Medium-high** for how it reads to a person: the rule was run on the
owner's own live Treasure Map and gives exactly the three states the owner asked for, but nobody has yet looked at the
hub signed in on a live instance.
**Date:** 2026-10-11

> This is a reverse-engineered baseline in the product-team PRD shape. It is a **strawman for the product team**, not a
> ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`. It extends
> `audits/assistant-trusted-content-status/prd-seed.md`, whose §7 "Backups" and "two pages' different questions" this
> book answered.

## 1. Product vision

`[FROM FRAME]` A person may choose to have another Assistant handle some of their Scores, Lists or Concepts. That might
be their Brainstorm Assistant, or one at another WoT Service Provider. The Assistant Management page should respect
that choice: it counts as done, so the hub's count and the top-bar reminder don't nag about it. It should also say,
quietly, that their Tapestry Assistant here isn't in full control, and offer a way to move those duties home.

`[INFERRED]` That makes the hub and `/treasure-map` agree on "done": any Assistant will do. The hub adds one nuance that
`/treasure-map` doesn't have: whether your Tapestry Assistant holds all of it, part of it, or none of it. The earlier
book's rule ("done only if your Tapestry Assistant is among them") read the same Map differently from `/treasure-map`,
which surprised the owner. That surprise is what started this book.

`[UNKNOWN — product input needed]` Whether "done" should eventually mean "an Assistant actually publishes it", not only
"the Map points at an Assistant". This is carried over from the earlier seed, and is now sharper (§6).

## 2. Personas

`[FROM FRAME]` / `[INFERRED]`, from the story and the owner's own case:

- **Someone who splits a category between Assistants.** The owner's Scores is an example: their Tapestry Assistant
  publishes `3038x`, and their Brainstorm Assistant publishes rank and follower scores. They see **Done** and
  **Shared** with "Partly handled by another Assistant · Move it here →", and nothing is counted.
- **Someone who gives a category entirely to another Assistant** (the owner's Lists). They see **Done** and **Shared**
  with "Handled by another Assistant · Move it here →", and nothing is counted. Before this book they saw **Needs
  attention**.
- **Someone whose Tapestry Assistant holds a category alone** (the owner's Concepts). They see plain **Done**, as
  before.
- **Someone with no Map, or a category nobody holds.** They see **Needs attention**, counted, as before.
- `[INFERRED]` **Someone who wants everything on their Tapestry Assistant.** For them the Shared pill and the line are
  the prompt, and the link takes them straight to `/treasure-map`.

## 3. Scope (as-built)

`[FROM FRAME]` On `staging`, not yet in production:

- **Three states** for Scores, Lists and Concepts:
  - **Needs attention**: no Map found, or no Assistant holds the category.
  - **Done**: only your Tapestry Assistant here holds it.
  - **Done, shared**: another Assistant holds part of it (partly) or all of it (entirely).
- **The look.** A shared card keeps ✓ and **Done**, and adds a muted **Shared** pill and one short line with a **Move it
  here →** link to `/treasure-map`. There is no ◐ mark, and the "·" stays with its link on a phone. Screen readers hear
  "Done, shared: Lists".
- **The count.** Shared is done, so neither the hub's count line nor the top-bar pill counts it.
- **The words.** Each card's page states the rule: "Needs attention until your Treasure Map gives Lists to an
  Assistant. Shared while any of it goes to an Assistant other than your Tapestry Assistant on this instance."
- `[INFERRED]` **How a Map is read.** Exactly as `/treasure-map`'s cards read it: only the preferred (first) Assistant
  on each key counts, so a backup never makes a category shared, and your Assistant only as a backup reads
  shared entirely.

## 4. Domain model

`[INFERRED]` No new entity. In the hub's answer, one category's state is now:

- **finished** or not (the Map could not be read);
- **done**, **pending** (no Map / not assigned), or neither while unfinished;
- **shared**: none, partly or entirely, and only when done.

The Treasure Map (kind 10040) is still only read, never written, by this check. "Your Tapestry Assistant" is still the
signed-in person's own Assistant on this instance (for the Owner, the instance's Tapestry Assistant).

## 5. Design rules (as-built)

`[INFERRED]`, from the shipped UI, the review and the owner's Gate B choices:

- **A nudge is not an alert.** Shared keeps the green Done look. Its prompt is a muted pill and one muted line, never
  the amber Needs attention pill, and never counted.
- **Short words.** The owner asked for "less wordy". The line is one clause and a link, and the variant (partly /
  entirely) carries the difference.
- **One way to act.** The line links to `/treasure-map`, where the Map is edited. The hub doesn't edit the Map itself.
- **No decoration that depends on the font.** The ◐ mark was dropped because it rendered differently from platform to
  platform.
- `[UNKNOWN]` Whether "muted" should also mean dimmer. The Shared pill is grey, but its text is brighter than the Done
  and Needs attention pills' (audit §4 #4).

## 6. Carry-forward & open questions

Promoted from audit §6:
- **Production** (audit §6 #1): with the next `staging` → `main` promotion.
- **The signed-in look** (§6 #2): a quick check on staging by the owner.
- **Self-entries** (§6 #3): a Map entry naming its own author reads as "another Assistant" today; revisit with the
  self-maps work, on both pages at once.
- **The Shared pill's brightness** (§6 #4).
- **Assigned versus publishing** (§6 #5): Done now means "some Assistant is assigned". A customer who gives Lists to
  their own Tapestry Assistant reads plain Done before customers' Assistants actually publish Lists. That is the
  owner's committed follow-up.
- **The three pages** (§6 #6): they could show the state, partly or entirely, and which Assistant holds which keys.

## 7. What product must validate

- [ ] **"Muted" — dimmer or just grey?** Should the Shared pill's text be dimmer than the Done and Needs attention
  pills', or is a grey hue enough?
- [ ] **Assigned versus publishing.** With "any Assistant" now counting, should the hub ever check that the assigned
  Assistant actually publishes the category, especially your own Tapestry Assistant before it supports Lists for
  customers?
- [ ] **Self-entries.** When your Map names your own key for a duty, should the hub treat it as unassigned (needs
  attention), as yours, or as shared? Today it is shared, matching `/treasure-map`. The self-maps draft says such an
  entry designates no one.
- [ ] **The pages behind the cards.** Should they now show which Assistant holds which part of a shared category, and
  offer more than the link?
