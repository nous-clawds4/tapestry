# Story 6: Take a concept out of a Tapestry (remove-only, on the existing Exploration page)

**Status:** Draft
**Created:** 2026-07-30
**Type:** Feature

## Background

The `tapestries` epic shipped browsing (#1–#2), owner-gated creation (#3), per-concept depth
(#4), and the first editing slice — add-only membership (#5). Its own future list named
**removing a member** as deferred work. This story delivers that slice, under the operational
Direction book `engineering-team/audits/take-a-concept-back-out/book.md` (owner-ratified goal
`take-a-concept-back-out`). The owner's deliverable, verbatim: *"From a Tapestry I am looking
at, I can take out a concept that is in it. After I save, the Tapestry no longer shows that
concept — to me, or to anyone else who opens it afterwards — and everything else in it stays as
it was."*

Today membership only grows: #5 lets the owner add a concept, but a concept added by mistake —
or one that no longer belongs — can only be outlived by abandoning the tapestry and creating a
new one. This story adds a **remove-only** affordance to the per-tapestry view that already
exists (the Exploration page), republishing the tapestry the way tapestries are already
published. The owner's boundary is the ceiling: removing only; a Tapestry keeps at least one
concept — taking out the last one is refused, because an emptied Tapestry is a deletion, and
deleting is not this goal; it works only on tapestries published under the owner's own key or
the assistant's, and the option is not offered for anyone else's; no new page and no new server
endpoint.

**Who is affected:** the instance **owner** (the curator persona from #3/#5) gains the
capability. Every visitor is affected passively — the tapestry they open afterwards shows the
reduced membership. The frame's first-person voice ("my own key or my assistant one"), with the
goal's prompt ("let the owner take a concept out"), scopes the acting user to the owner — the
same reading story #5 ratified.

## User-facing description

As the **instance owner**, when I am looking at a Tapestry published under my own key or my
assistant's, I want to take out a member concept (so long as at least one concept remains) and
save, so that the Tapestry — at its same address, with everything else unchanged — no longer
shows that concept to me or to anyone else who opens it afterwards.

## Acceptance criteria

Testable from the outside. Each criterion gets at least one test. Criteria are stated for one
concept per save; the flow can be repeated to remove more.

- [ ] **Offered only where editing is possible.** Given the owner viewing the Exploration page
  (`/tapestry/tapestries/<uuid>`) of a tapestry whose author is the owner's own pubkey or the
  instance's assistant (TA) pubkey, then a **take-out-a-concept affordance** is present on that
  existing page (no new page) for its member concepts. Given a tapestry authored by any other
  pubkey, or a viewer who is not the owner, then **no removal affordance is offered** — the
  tapestry cannot be edited here.
- [ ] **The last concept cannot be taken out.** Given such an editable tapestry whose
  membership is exactly one concept, then taking it out is **refused**: the owner sees a
  plain-language refusal (not an error after an attempted save), no save is possible for it,
  and the tapestry is unchanged. No save from this surface can leave a tapestry with zero
  member concepts.
- [ ] **Save = removing only, confirmed first, published as tapestries already are.** Given
  such an editable tapestry with two or more member concepts, when the owner chooses one to
  take out, then **nothing is published until the owner confirms the save**; declining leaves
  the tapestry unchanged. On confirmation the tapestry is republished under its **existing
  author key** via the publish paths #3 established and #5 reused (owner-key tapestry → signed
  in the browser by the owner; assistant tapestry → signed as the assistant), with **no new
  server endpoint**; and the result keeps the tapestry's identity and everything else intact:
  same uuid/URL, no duplicate entry in the Tapestries directory, every other member concept
  still present, title and description unchanged, everything else the element carried unchanged
  — the only difference is that the removed concept, and what the tapestry carried solely on
  its behalf, is gone. Given the publish fails, the owner sees a clear error and the tapestry's
  membership is unchanged.
- [ ] **Gone for me.** Given a successful save, then the Tapestry view the owner is looking at
  no longer shows the removed concept among the member concepts.
- [ ] **Gone for anyone else afterwards.** Given a successful save, when **any other session**
  (including one that is not signed in) opens the same tapestry (same uuid/URL, or via the
  directory) afterwards, then the removed concept no longer appears among its member concepts.

## Concepts touched

Handles use the instance's runtime-resolved TA pubkey (`<TA>`) — **never hardcode it** (CLAUDE.md).

- `39998:<TA>:tapestry` — **Tapestry**. The edited tapestry is one of its kind-39999 elements
  (z-tagged to this handle; what the directory reads). This story republishes such an element
  with one fewer member.
- Per removed concept: `39998:<TA>:<slug>` — the concept's **header** (the member being taken
  out), and `39999:<TA>:<slug>-concept-graph` — its importable **concept graph** (the
  per-member entry the element carries for it — the member shape #3 publishes and #5 appends;
  it leaves the element together with the member). The concepts themselves are untouched on the
  instance; only the tapestry's membership changes.

## Out of scope

The boundary's exclusions, verbatim where possible, plus continuity items:

- **Adding a concept** (#5, shipped) — "adding is already built and stays as it is." No change
  to its behavior.
- **Changing how concepts connect** — no authoring, altering, or removing of integrations
  between members; whatever the element carries passes through unchanged. In particular, this
  story defines **no behavior for taking out a concept that participates in authored
  connections**: per the owner's prompt, no tapestry in existence carries connections today
  (members-only v1, #3), and when connections exist, removing a connected concept is a
  successor of "change how two concepts connect," not this goal. If the Architect finds a live
  counter-example, that is surfaced to the Director rather than designed around.
- **Emptying or deleting a Tapestry** — refusing the last-concept removal is in scope (AC-2);
  deletion of the tapestry itself, by any means, is not this story.
- **Tapestries with no member concepts at all** (degraded / graph-less elements) — there is
  nothing in them to take out; growing them is #5's shipped first-add path.
- **Editing a tapestry published by someone else** — the option is not offered for it (AC-1).
  Whose key may republish such a tapestry is an unsettled question with its own goal and must
  not be answered here.
- **Any other edit** — title, description, or any field beyond membership; any change to the
  create flow (#3). The frame grants taking out a concept, nothing more.
- **No new page and no new server endpoint** (boundary, restated as a constraint on any design).
- **Batch-removal** of several concepts in one save — the frame's promise is singular ("a
  concept"); repeating the flow is the supported way to remove more. Not forbidden if it falls
  out naturally, but no criterion depends on it.
- **Editing by non-owner users** — the frame's acting user is the owner.
- **Any undo / restore / history surface** — replacement history makes removal recoverable in
  principle (owner's prompt), but no recovery affordance is in the frame.
- POV/WoT filtering of the directory or of who sees what (epic-level continuity).
- The **~71 unread tapestry rows in Neo4j** (continuity from the #5 book; explicitly not this
  story's problem).

## Open questions

None blocking. Readings recorded for the Director to veto at the gate if wrong:

1. **"My" = the instance owner.** The frame's "my own key or my assistant one" is read as the
   owner's key and the instance TA — the reading story #5 ratified (Director ruling,
   2026-07-28). Non-owner sessions (including admins) get no affordance anywhere.
2. **"After I save" = an explicit confirm-before-publish moment.** Choosing a concept to take
   out publishes nothing by itself; the save is a deliberate confirmation (aligned with the
   owner prompt's "ask the owner to confirm before it publishes"). Declining publishes nothing.
3. **"Refused" (last concept) = an up-front, plain-language refusal** — not
   offered-then-errored. The boundary's word is "refused"; the shape follows the owner's
   prompt ("refused with a plain sentence, not offered-and-errored").
4. **"No longer shows that concept" includes what the element carried solely for it.** The
   per-member entry the tapestry carries for the removed concept leaves with it (the owner's
   prompt: imports are derived from members; "there is nothing separate to clean up").
   "Everything else in it stays as it was" is read as everything not carried solely on the
   removed member's behalf.

## Linked artifacts

- ADR: `engineering-team/decisions/tapestries/0006-remove-concept-remove-only-republish.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
