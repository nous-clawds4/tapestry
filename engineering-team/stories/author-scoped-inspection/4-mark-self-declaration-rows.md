# Story 4: A b-tag that points at itself is visibly a self-declaration

**Status:** Approved
**Created:** 2026-09-20
**Type:** Feature

## Background

Two unlike claims share the Active b-tags table and look identical in it.

A b-tag pointing at **another** event says *"my concept corresponds to that shared concept"* — a
correspondence claim, aimed outward. A b-tag pointing at the carrier's **own** coordinate says
something else entirely: it is the **self-declaration** — *"I am offering this concept as a shared
concept"* — the wire form the Community Offerings surface reads to build its directory, and the
form the sharing-state rule keys on.

Today they are indistinguishable in the table. 4 of 12 rows on this dev instance and 3 of 10 on
staging are self-declarations sitting unmarked among correspondences. A reader scanning the page
for "what have I wired up to other people's concepts" is counting the instance's own offerings in
that total.

Story 2 adds an author column, which makes the two *derivable* — a self-declaration's local author
and shared author are the same — but only by comparing two columns across a row. That is a thing
you can work out, not a thing you can see.

## User-facing description

As someone scanning Active b-tags, I want the rows where a b-tag points at its own event to look
different from the rest, so that I can tell a self-declaration from a correspondence without
reading the coordinates.

## Acceptance criteria

- [ ] Given a row whose b-tag value equals the coordinate of the event carrying it (a
      **self-declaration**), when the table renders, then that row is visually distinguished from
      the other rows — noticeable when looked for, and not so strong that it reads as an error or
      a warning.
- [ ] Given a row whose b-tag points at any other event, when the table renders, then it carries no
      such distinction.
- [ ] Given a self-declaration row, when its detail panel is opened, then the text
      `* self-declaration` appears immediately to the right of the control that copies the b-tag.
- [ ] Given a row that is not a self-declaration, when its detail panel is opened, then no such
      note appears and the panel is unchanged from what ships today.
- [ ] Given the distinction is carried by color, when a self-declaration row is viewed **at rest**
      and **under the pointer**, then it is visible in both states — neither the row's own tint nor
      the table's hover feedback erases the other.
      *(Amended at the Architecture gate. The original criterion said "in both the light and the
      dark theme"; the app is dark-only — `ui/src/styles.css` defines one palette and contains no
      `prefers-color-scheme` or `data-theme` rule. The hover interaction is the constraint that
      actually bites. ADR 0002 § Context fact 4.)*

## Concepts touched

- `39998:<TA>:concept-header` — concept header (the carrier; a row is a self-declaration when its
  b-tag equals the carrier's own coordinate).
- `39998:<TA>:shared-concept` — shared concept (what a self-declaration offers the carrier as).

## Out of scope

- Any change to which rows appear, their order, or the row count.
- Filtering or sorting by self-declaration. The distinction is visual only.
- Renaming the state. The panel reads `* self-declaration`, which is the term the codebase already
  uses for a b-tag pointing at its carrier's own coordinate (`carriesSelfPointer`; the Community
  Offerings surface reads the same wire form). The owner settled this at the story gate — an
  earlier draft said `* self-referencing`, and a reviewer who sees that string must reject.
- Applying the treatment to Active z-tags, which has no self-declaration case of this shape.
- Any change to the detail panel for rows that are not self-declarations.

## Open questions

None. This story is independent of stories 1–3 and could be built in any order relative to them.

## Linked artifacts
- ADR: `engineering-team/decisions/author-scoped-inspection/0002-author-scoped-views-on-active-b-tags.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
