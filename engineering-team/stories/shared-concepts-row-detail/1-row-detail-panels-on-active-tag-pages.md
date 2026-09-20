# Story 1: Row detail panels on the Active …-tags pages

**Status:** Approved
**Created:** 2026-09-20
**Type:** Feature

## Background

Two pages under Shared Concepts list what this instance points at: **Active b-tags** (locally-authored
DList Headers that carry a b-tag to a shared event) and **Active z-tags** (foreign-authored concept
headers that local events file themselves under). Both lead with a raw wire identifier — a kind, a
64-character pubkey and a slug — in its own column.

That column is the widest thing on either page and the least readable. It is there because the value
has to be **available**, not because it has to be **read**: a person working these pages wants to
recognize a row, and occasionally to grab its identifier and take it elsewhere. Today the page
optimizes for the second and makes the first hard.

At the same time, the one piece of prose that would tell a reader what a row is — the DList Header's
description — is not shown anywhere on either page, although it is already carried on the events the
pages read. On this dev instance 8 of the 13 b-tag rows have one.

Affected: anyone auditing what this instance has wired up or is using — today, the operator.

## User-facing description

As someone reading the Active b-tags and Active z-tags pages, I want each row to open into a small
panel holding its description and its tag value, and I want the tag value out of the table itself, so
that I can scan the list by what the rows *are* and still copy an identifier the moment I need one.

## Acceptance criteria

Testable from outside. Unless a criterion names one page, it applies to **both** Active b-tags and
Active z-tags.

- [ ] Given either page has loaded, when it is first rendered, then no row's panel is open, and the
      table shows no b-tag / z-tag column.
- [ ] Given a row, when its disclosure control is activated, then a panel opens beneath that row
      showing the row's description and its full tag value; when the control is activated again, the
      panel closes. Opening one row's panel does not close or open another's.
- [ ] Given an open panel, when its copy control is activated, then the row's **full** tag value —
      not a truncated or reflowed form of it — is on the system clipboard, and the control
      acknowledges the copy.
- [ ] Given a row whose underlying event carries no description, when its panel is opened, then the
      panel says the description is absent rather than rendering an empty region.
- [ ] Given text is typed into the filter box that occurs in a row's tag value, when the table
      re-filters, then that row is still among the matches — the tag value remains filterable though
      its column is gone.
- [ ] Given text is typed into the filter box that occurs in a row's description, when the table
      re-filters, then that row is among the matches — even though the description is visible only
      inside that row's panel, and the panel may be closed at the time.
- [ ] *(Active b-tags)* Given a row, when the row is clicked anywhere other than the disclosure
      control, then it still navigates to that row's b-tag pair page, unchanged.
- [ ] *(Active b-tags)* Given a row, when its panel is opened, then the description shown is the one
      on the **local** DList Header that carries the b-tag — not the description on the shared event
      the b-tag points at.
- [ ] Given either page, when rows are rendered, then the reserved `b-tag-deferred` sentinel is still
      skipped exactly as it is today, and no panel presents it as a tag value.
- [ ] Given any surface that marks text as muted — the new panel's "no description" fallback included
      — when it renders, then that text's computed colour is the palette's muted colour and is
      visibly distinct from ordinary body text. *(Added by the owner at the Architecture gate,
      2026-09-20: the muted-text class is referenced app-wide but defined nowhere, so no muted string
      in the app has ever rendered muted. Fixing it once is preferred to writing the new panel around
      it — see ADR 0001 §Decision, "Scope amendment".)*

## Concepts touched

- `39998:<TA>:concept-header` — concept header. The kind-39998 event behind every row on both pages;
  the source of the description, and on Active z-tags the row's identity.
- `39998:<TA>:shared-concept` — shared concept. What a b-tag points at and what a z-tag files under —
  the subject matter of both pages.

`<TA>` is **per-deployment** and must be resolved at runtime (CLAUDE.md § "Per-deployment TA pubkey").
On this dev instance it reads `11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767`.

## Out of scope

- **Which rows appear, and in what order.** No change to either page's scan, its counts, its
  self-filed toggle, or its point-of-view handling.
- **The b-tag pair (detail) page.** It already shows local and shared descriptions side by side and is
  untouched; this story only preserves the route into it.
- **Any new fetch or endpoint.** Both pages already read the events the panels need.
- **The same panel on other tables.** If the mechanism generalizes, other pages adopting it is
  separate work.

## Open questions

None. Two points settled at kickoff and recorded in the book's frame notes:

1. On Active z-tags there is no local event behind a row — the row *is* a foreign-authored header — so
   "the local event's description" has no z-tag analogue. That page shows the header's own description.
2. Active z-tags has no row-click destination today, so the disclosure control competes with nothing
   there; on Active b-tags it must stay clear of the existing navigation.

## Linked artifacts
- ADR: `engineering-team/decisions/shared-concepts-row-detail/0001-row-detail-panels-on-active-tag-pages.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
