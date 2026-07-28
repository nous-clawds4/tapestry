# Story 5: Add a concept to a Tapestry (add-only, on the existing Exploration page)

**Status:** Draft
**Created:** 2026-07-28
**Type:** Feature

## Background

The `tapestries` epic shipped browsing (#1–#2), owner-gated creation (#3), and per-concept
depth (#4) — and its own future list named **Edit a Tapestry** as deferred work. This story
delivers the first, deliberately narrow slice of editing, under the operational Direction book
`engineering-team/audits/add-a-concept-to-a-tapestry/book.md` (owner-ratified goal
`add-a-concept-to-a-tapestry`). The owner's ask, verbatim: *"Put a concept into a Tapestry that
did not have it before."*

Today a tapestry's membership is fixed at creation: to include one more concept the owner would
have to create a whole new tapestry. This story adds an **add-only** affordance to the
per-tapestry view that already exists (the Exploration page), republishing the tapestry the way
tapestries are already published. The owner's boundary is the ceiling: adding only; it works
only on tapestries published under the owner's own key or the assistant's; a tapestry published
by someone else cannot be edited here and the option is not offered for it; no new page and no
new server endpoint.

**Who is affected:** the instance **owner** (the curator persona from #3) gains the capability.
Every visitor benefits passively — the tapestry they open afterwards shows the grown membership.
The frame's first-person voice ("my own key or my assistant one"), together with the goal's
prompt ("let the owner add a concept"), scopes the acting user to the owner.

## User-facing description

As the **instance owner**, when I am looking at a Tapestry published under my own key or my
assistant's, I want to add an existing concept that is not already in it and save, so that the
Tapestry — at its same address, with everything else unchanged — shows the new concept to me and
to anyone else who opens it afterwards.

## Acceptance criteria

Testable from the outside. Each criterion gets at least one test. Criteria are stated for one
concept per save; the flow can be repeated to add more.

- [ ] **Offered only where editing is possible.** Given the owner viewing the Exploration page
  (`/tapestry/tapestries/<uuid>`) of a tapestry whose author is the owner's own pubkey or the
  instance's assistant (TA) pubkey, then an **add-a-concept affordance** is present on that
  existing page (no new page). Given a tapestry authored by any other pubkey, or a viewer who is
  not the owner, then **no add affordance is offered** — the tapestry cannot be edited here.
- [ ] **Only non-members are addable.** Given the owner invokes the affordance, then they can
  find and choose from the concepts that exist on this instance, and a concept that is **already
  a member** of this tapestry **cannot be added** (it is excluded or not selectable, and no save
  can produce a duplicate member).
- [ ] **Save = adding only, published as tapestries already are.** Given the owner has chosen a
  non-member concept, when they save, then the tapestry is republished under its **existing
  author key** via the publish paths #3 established (owner-key tapestry → signed in the browser
  by the owner; assistant tapestry → signed as the assistant), with **no new server endpoint**;
  and the result keeps the tapestry's identity and everything else intact: same uuid/URL, **no
  duplicate** entry in the Tapestries directory, all prior member concepts still present, prior
  integrations shown unchanged, title and description unchanged — the only difference is the new
  member. Given the publish fails, the owner sees a clear error and the tapestry's membership is
  unchanged.
- [ ] **Visible to me.** Given a successful save, then the Tapestry view the owner is looking at
  shows the added concept among the member concepts.
- [ ] **Visible to anyone else afterwards.** Given a successful save, when **any other session**
  (including one that is not signed in) opens the same tapestry (same uuid/URL, or via the
  directory) afterwards, then the added concept appears among its member concepts.

## Concepts touched

Handles use the instance's runtime-resolved TA pubkey (`<TA>`) — **never hardcode it** (CLAUDE.md).

- `39998:<TA>:tapestry` — **Tapestry**. The edited tapestry is one of its kind-39999 elements
  (z-tagged to this handle; what the directory reads). This story republishes such an element
  with one more member.
- Per added concept: `39998:<TA>:<slug>` — the concept's **header** (the new member), and
  `39999:<TA>:<slug>-concept-graph` — its importable **concept graph** (resolved at read time by
  the Exploration page), the same member shape #3 publishes at create time.

## Out of scope

The boundary's exclusions, verbatim where possible, plus continuity items:

- **Removing a concept** from a tapestry ("taking a concept out … stays out").
- **Changing how concepts connect** — no authoring or altering of integrations between members
  (subsets / elements / enumerations); existing integrations pass through unchanged.
- **Editing a tapestry published by someone else** — the option is not offered for it. Whose key
  may republish such a tapestry is an unsettled question with its own goal and must not be
  answered here.
- **Any other edit** — title, description, or any field beyond membership. The frame grants
  adding a concept, nothing more.
- **No new page and no new server endpoint** (boundary, restated as a constraint on any design).
- **Batch-adding** several concepts in one save — not required (the frame's promise is singular);
  repeating the flow is the supported way to add more. Not forbidden if it falls out naturally,
  but no criterion depends on it.
- **Editing by non-owner users** (e.g., of a tapestry authored under their own key from
  elsewhere) — the frame's acting user is the owner.
- The **~71 unread tapestry rows in Neo4j** — recorded as an open question on the evidence goal
  `find-out-whether-saving-a-tapestry-again-actually-updates-it`; explicitly not this story's
  problem.
- POV/WoT filtering of the directory or of who sees what (epic-level continuity).

## Open questions

None blocking. One reading is recorded for the Director to veto at the gate if wrong:

- **"My" = the instance owner.** The frame's "my own key or my assistant one" is read as the
  owner's key and the instance TA — matching the goal's prompt ("let the owner add a concept")
  and #3's owner-gated authoring. Non-owner sessions get no affordance anywhere.

## Linked artifacts

- ADR: `engineering-team/decisions/tapestries/0005-add-concept-add-only-republish.md`
- Test plan: `engineering-team/stories/tapestries/5-add-a-concept-to-a-tapestry.test-plan.md`
- Review: (filled in after Review phase)
