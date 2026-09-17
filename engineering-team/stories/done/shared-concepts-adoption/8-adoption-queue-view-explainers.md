# Story 8: Adoption Queue view explainers — say what each table means

**Status:** Done
**Created:** 2026-08-07
**Type:** Doc (UI copy; fast-track Implementer + Reviewer per the strictness table's doc class —
no ADR, no test plan; the review's manual walk verifies all three views)

## Background

The Adoption Queue presents three views (Theirs to adopt / Mine to publish / Declined) behind
one shared subtitle. A new user can't tell from the table headers what each population *is* or
what the actions *do* — the owner asked for a brief explainer at the top of each table that
changes with the selected view (request 2026-08-07).

**Who is affected:** anyone seeing the page for the first time; the owner onboarding others.

## User-facing description

As **a new user**, I want each adoption view to explain itself in a sentence or two, so that
**I know what I'm looking at and what the buttons will do before I press one.**

## Acceptance criteria

- [ ] Selecting each view shows its own short explainer between the view switcher and the table;
      switching views switches the text. Proposed copy (owner may amend at review):
      - **Theirs to adopt:** "Shared concepts published by others that people are actively using
        — sometimes including you (the 'Used by me' check). Adopt one to wire it to your own
        matching concept, Recognize it in your registry, or Decline to keep it out of this
        queue."
      - **Mine to publish:** "Your own concepts that other people already use — 📄 counts filings
        made under your concept, 🔗 counts affiliations pointing at it. Submit one to offer it as
        a Shared Concept, or Keep private to stop this page from suggesting it."
      - **Declined:** "Nominations you turned down. Nothing is deleted — they simply stay out of
        the queue until you Un-decline them."
- [ ] The existing page subtitle, view switcher, tables, actions, and reveal are otherwise
      unchanged.

## Concepts touched

None — copy only. No firmware reinstall.

## Out of scope

- Any behavioral change to views or actions; explainers elsewhere (e.g. Trusted Dictionary
  already carries its own subtitle).

## Linked artifacts
- ADR: skipped (doc-class fast-track)
- Test plan: skipped (doc-class fast-track; manual walk in the review)
- Review: `engineering-team/reviews/shared-concepts-adoption/8-adoption-queue-view-explainers.md`
