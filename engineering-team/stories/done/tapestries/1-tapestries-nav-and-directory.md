# Story 1: Tapestries navigation + View Tapestries directory + Create stub

**Status:** Done
**Created:** 2026-07-23
**Type:** Feature

## Background
Tapestries exist in the data model (the `tapestry` concept and its elements, each carrying a
self-describing `graph` block) but are unreachable from the app. This story adds the **entry
points**: a "Tapestries" section in the main left navigation and the directory that lists every
tapestry, so a user can find a tapestry and open it. Authoring is deferred, so "Create New
Tapestry" is a non-functional placeholder for now. The per-tapestry Exploration page that rows
link to is built in `tapestries` #2.

## User-facing description
As any visitor to the app, I want a Tapestries area in the left nav that lists all tapestries and
points at (future) creation, so that I can discover a tapestry and navigate into it.

## Acceptance criteria
Testable from the outside. Each criterion gets at least one test.

- [ ] Given I am on any `/tapestry` page, when I view the left navigation, then a **"Tapestries"**
  group appears directly under **"Nostr Users"**, expandable to two links: **"View Tapestries"**
  and **"Create New Tapestry"**. The group is visible to all users (not owner-gated).
- [ ] Given I open **View Tapestries**, when the page loads, then I see a directory listing every
  element of the `tapestry` concept, each row showing its **title, description, and author**.
  (With current seed data, exactly one row appears: "Tapestry for Dog".)
- [ ] Given the directory is shown, when I click a tapestry row, then I navigate to that
  tapestry's exploration page at a URL that contains the tapestry's **uuid**
  (`/tapestry/tapestries/<uuid>`).
- [ ] Given there are no tapestry elements, when I open **View Tapestries**, then I see a friendly
  **empty-state** message (not an error, not a blank page).
- [ ] Given I open **Create New Tapestry**, when the page loads, then I see a **non-functional
  placeholder** that previews the planned authoring fields (e.g. title, description, member
  concepts) and clearly states that creating a tapestry is coming later — with no working submit.

## Concepts touched
- `39998:<TA>:tapestry` — the Tapestry concept; the directory lists its elements. `<TA>` is the
  runtime-resolved owner-assistant pubkey (never hardcode).

## Out of scope
- The **contents** of the Exploration page (that is `tapestries` #2) — this story only needs each
  row to *link* to `/tapestry/tapestries/<uuid>`.
- Actually creating or editing a tapestry (the Create page is a placeholder only).
- POV/WoT filtering of which tapestries are shown — the directory lists all tapestry elements.
- Any new backend endpoint — the directory reads existing endpoints only.

## Open questions
None outstanding.

## Linked artifacts
- ADR: `engineering-team/decisions/tapestries/0001-nav-directory-and-strfry-element-read.md`
- Test plan: `engineering-team/stories/tapestries/1-tapestries-nav-and-directory.test-plan.md`
- Review: `engineering-team/reviews/tapestries/1-nav-and-directory.md` — **PASS** (2026-07-23)
