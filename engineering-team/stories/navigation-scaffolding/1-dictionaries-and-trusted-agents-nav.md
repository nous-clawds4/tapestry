# Story 1: Dictionaries and Trusted Agents sections on the Tapestry sidebar

**Status:** Done
**Created:** 2026-09-08
**Type:** Feature

## Background

The left Tapestry sidebar (`ui/src/components/Layout.jsx`) ends at Shared Concepts. Two new
areas are coming — **Dictionaries** and **Trusted Agents** — and the operator wants their shape
in the navigation now, ahead of the pages themselves, so the information architecture can be
looked at and argued with before any of it is built.

The domain questions behind both are open on purpose. "Dictionary" already has a live thread in
`engineering-team/stories/_intake.md` (the S1/S2/S3 subset taxonomy, the trusted-dictionary
snapshot as a dated derived artifact); "Trusted Agents" has no concept in the graph at all —
the nearest is `tapestry assistant`. Nothing in this story should pre-commit either model.

## User-facing description

As the operator, I want Dictionaries and Trusted Agents to appear as collapsible sections on the
Tapestry menu with their sub-items in place, so that I can see and navigate the intended shape of
these areas before the real pages exist.

## Acceptance criteria

- [ ] Given the Tapestry sidebar, when it renders, then two new top-level groups appear **below**
      Shared Concepts, in this order: **📖 Dictionaries**, then **🕵️ Trusted Agents**.
- [ ] Given either new group, when its header is clicked, then it toggles open and closed exactly
      like the existing groups (chevron flips; children show/hide) — i.e. it reuses `NavGroup`.
- [ ] Given the Dictionaries group is open, then its children are, in order: **Dictionaries**,
      **Tags**, **DLists**, **Concepts**.
- [ ] Given the Trusted Agents group is open, then its children are, in order: **Mine**, **All**.
- [ ] Given any of the six new nav links, when it is followed, then a page renders that states in
      plain words that it is a placeholder for the surface named.
- [ ] Given a signed-in non-owner, when the sidebar renders, then both new groups are visible —
      neither is owner-gated (matching the Shared Concepts group they sit beneath).
- [ ] Given any new page, when it renders, then breadcrumbs resolve to readable names
      (no raw path segments).

## Routes

| Nav label | Route |
|---|---|
| Dictionaries → Dictionaries | `/tapestry/dictionaries` (index) |
| Dictionaries → Tags | `/tapestry/dictionaries/tags` |
| Dictionaries → DLists | `/tapestry/dictionaries/dlists` |
| Dictionaries → Concepts | `/tapestry/dictionaries/concepts` |
| Trusted Agents → Mine | `/tapestry/trusted-agents/mine` |
| Trusted Agents → All | `/tapestry/trusted-agents/all` |

`/tapestry/trusted-agents` (bare) redirects to `.../mine` — the operator listed no index page for
that group, and a bare prefix that 404s into `NotFound` is worse than a redirect.

## Concepts touched

None wired. Named on the placeholder pages for orientation only:

- `tag` — the Tags dictionary will eventually draw on it
- `list` — DLists
- `concept header` — Concepts
- `trusted dictionary snapshot` — the existing materialization precedent for a dictionary
- `tapestry assistant` — nearest existing concept to "Trusted Agent"; not the same thing

## Out of scope

- Any data access, POV filtering, or trust scoring on the new pages. They are placeholders.
- Deciding what a "Dictionary" or a "Trusted Agent" *is*. That is a Product Team question.
- The relationship between the new **Concepts** dictionary page and the existing 🧩 Concepts
  section, or between the new **Tags** page and `/tags`. They are distinct surfaces; reconciling
  them is later work.
- The avatar menus — Story 2.

## Open questions

None. Placement, labels, and order were given verbatim by the operator; gating and route naming
were settled at intake.

## Linked artifacts
- ADR: none (abbreviated path — no design choice beyond route naming, recorded above)
- Test plan: none (abbreviated path)
- Review: `engineering-team/reviews/navigation-scaffolding/1-dictionaries-and-trusted-agents-nav.md`
