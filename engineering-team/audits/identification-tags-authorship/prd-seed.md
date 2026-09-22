# PRD Seed: Identification Tags — who authors the definitions, and which taggings are offered

**Mode:** reconstructed from as-built *(no prior PRD)*; a delta on the previous seed,
`engineering-team/audits/assistant-identification-tags/prd-seed.md`, which stays the baseline for the page.
**Build audit:** `engineering-team/audits/identification-tags-authorship/audit.md`
**Anchor:** the acceptance frame in `book.md` (the owner's ask, verbatim) and the four decisions at the story gate
**Confidence:** **high** for what shipped; **low** for the two parked taggings, which the owner has deliberately not
decided.
**Date:** 2026-09-22

> A strawman for the product team, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or
> `[UNKNOWN — product input needed]`. Read it with the previous seed open: this one records only what changed.

## 1. Product vision

`[FROM FRAME]` Unchanged: four taggings broadcast the relationship between a person and their Tapestry Assistant.
What changed is who says what a tag *is*. A tag definition belongs to whoever published it, and the app names the
definition it publishes against explicitly, per tagging: "My Tapestry Assistant" is Nous' tag, "My Tapestry Owner"
is the tag of Nous' Tapestry Assistant. There is no single canonical author any more.

`[INFERRED]` The R&D posture the owner stated: the feature ships with two of its four taggings parked so the team can
play with it before deciding the rest. Parked means visible and inert, not hidden.

## 2. Personas

`[INFERRED]`, on top of the previous seed's:

- **Nous and Nous' Tapestry Assistant** — the first real pair. Both their taggings already exist by name on
  production's relay, so after the promotion Nous' hub should read Done for this action with no press.
- **The owner's team as R&D users** who will exercise the page and decide the parked pair.
- **Outside clients** now have two definition authors to know, not one key; the reading convention is still
  unwritten (`protocols/`).

## 3. Scope (as-built)

`[FROM FRAME]` On staging (PR #752); the promotion to main was ordered at the close:

- The shared list carries, per tagging, its definition's author and whether it is offered. Offered: "My Tapestry
  Assistant" (Nous), "My Tapestry Owner" (Nous' Assistant). Parked: "My Agent", "My Human".
- The answer, the hub's card, the count line and the Assistant Alert consider the offered taggings only.
- A parked row is greyed, with a disabled unchecked box and "Not offered yet"; nothing reads or publishes it, and
  the Assistant's route refuses a parked key.
- Both publishers point at the definition its author published.

`[FROM FRAME]` Explicitly out: deciding the parked pair, authoring definitions for them, showing a parked tagging's
state, renaming "My Human", the `protocols/` note.

## 4. Domain model

`[INFERRED]` Deltas to the previous seed's model:

- **Required tagging** gains `offered` (boolean) and `author` (the key that published its definition; null while
  parked). Its **definition address** is `39999:<author>:<slug>` for an offered entry and nothing for a parked one.
- **Tag definition** — no longer "canonical" in the sense of one key; each offered tagging names its own.
- **Attention answer** — one row per *offered* tagging; parked ones have no row.

## 5. Design rules (as-built)

`[FROM FRAME]` / `[INFERRED]`:

- **Parked rows stay on their cards**, in the same order, greyed (opacity 0.55), the checkbox present but disabled
  and unchecked, the words "Not offered yet"; the cursor says not-allowed. In every state, signed out included.
- **A parked row never marks a card, never counts against Done, never joins a publish set, is never posted.**
- **The offered rows are unchanged** in words and behaviour.
- `[UNKNOWN]` Whether a long-parked tagging should eventually be hidden rather than greyed; whether "Not offered yet"
  should say by whom or why.

## 6. Carry-forward & open questions

Promoted from the build audit §6: the parked-pair decision; the promotion and Nous' hub on production; a guard for
a half-unpark; two docs tidies; the batching of outside reads; the `protocols/` note with two authors.

## 7. What product must validate

- [ ] Whether "My Agent" and "My Human" are offered, dropped, or stay parked, and under whose key their definitions
      would be published.
- [ ] Whether "Not offered yet" reads right to a person who is not on the team, or whether a parked tagging should
      be hidden until decided.
- [ ] Whether outside clients should learn the two authors through the `protocols/` note, and whether a tagging by
      a same-named tag from another author should keep counting as present (it does today).
- [ ] Whether the two author keys should be presented somewhere in the app (the page names only the tags).
