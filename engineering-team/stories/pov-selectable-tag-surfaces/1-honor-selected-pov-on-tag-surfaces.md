# Story 1: Tag surfaces honor the explicitly-selected POV

**Status:** Draft
**Created:** 2026-07-08
**Type:** Feature (epic: pov-selectable-tag-surfaces)
**Provenance:** OPEN.md #17 / `engineering-team/stories/_intake.md` 2026-07-06 "POV-selectable tag surfaces."
Planning decisions (operator, 2026-07-08): MVP wires the **existing** offered POVs only (no new-POV
provisioning); applicability stays **instance-global**; unprovisioned POV gets an explicit state
(that honesty piece is **Story 2**, not here).

## Background
Brainstorm's model is "pick from a few offered POVs, or your own." **Search already implements the
selectable POV** — the user chooses house / nosfabrica / their own (persisted in user preferences),
and search reads reflect that choice. **The tag surfaces do not honor that same choice:**

- Some tag surfaces (the tags directory, a tag's page, tag detail, authored-by, profile tags) thread
  a **login-binary** POV — *my* POV if I'm logged in, else house. They **ignore the explicit menu
  selection**: pick "nosfabrica" while logged in and you still see *your* POV.
- Other surfaces (the tags shown on a note; i.e. the event-tag reads) thread **no POV at all** — they
  always show the house POV.

So today there is no way to say "show me tags through nosfabrica's eyes" (or any offered POV) and have
the tag surfaces obey. This story makes **one explicit POV choice govern both search and every in-app
tag surface, consistently.** The backend tag reads already accept a POV parameter — the gap is that the
surfaces don't pass the *selected* one.

This is the tag analog of a capability search already has; it is the enabler for "select the LFO POV →
only that POV's taggings show" once an LFO POV is later provisioned (a separate epic).

## User-facing description
As someone who has chosen a point of view (house, a named POV like nosfabrica, or my own) the same way
I choose it for search, when I view **any** in-app tag surface — the tags on a note, a tag's page, the
tags directory, a profile's tags, the "tagged by" activity view — I want the taggings shown and their
counts to reflect **that selected POV's** web of trust, so the tags I see are the ones my chosen POV
trusts, not a login-based default and not always the house POV.

## Acceptance criteria
Testable from the outside (the POV selection is an input; the taggings/counts a surface shows are the
observable output).

- [ ] **The explicit selection is honored — not login-binary.** Given I am logged in **and** I have
  selected a POV other than my own (e.g. "nosfabrica"), when I view a tag surface, then the taggings and
  their counts reflect **the selected POV's** trust — not my own. (Today a logged-in user always sees
  their own POV regardless of the selection.)

- [ ] **My-own POV when I select it.** Given I am logged in and have selected "my own" POV, when I view a
  tag surface, then the taggings/counts reflect **my** web of trust.

- [ ] **House POV when house is selected (and the logged-out default).** Given I have selected "house"
  (or I am logged out and have made no selection), when I view a tag surface, then it shows the **house**
  POV — matching today's logged-out behavior (no regression).

- [ ] **Consistency across every tag surface.** Given a selected POV, when I view each of: the tags on a
  note, a tag's page, the tags directory/index, a profile's tags, and the "tagged by" activity view,
  then **all** of them reflect the same selected POV — no surface silently stays on house while the
  others switch.

- [ ] **One selection governs search and tags.** Given I change my POV selection in the one place the
  app offers it, when I then use search **and** view a tag surface, then both reflect the new selection —
  there is not a separate, independently-set POV for tags.

- [ ] **Switching POV updates the view.** Given I am viewing a tag surface, when I change the selected
  POV, then the surface re-reflects the newly selected POV's taggings/counts (on the next load of that
  surface) without requiring a full re-login.

## Concepts touched
(Plain-language; Architect to resolve `kind:pubkey:slug` handles via the Concept Graph API.)
- The **event-tag** read (tags shown on a note).
- The **tag** pages / **tag directory** / **tag detail** reads.
- The **profile-tag** and **authored-by** reads.
- The existing **selected-POV** mechanism that search consumes (house / named / own).

## Out of scope
- **The unprovisioned-POV honest state** (selected POV with no computed scores → explicit "unavailable"
  instead of silently counting everyone). That is **Story 2** of this epic — this story assumes a
  provisioned POV and does not change the fallback behavior.
- **Applicability picker POV-awareness.** The "which tags apply to events/people" picker stays
  **instance-global** (a house-derived, install-local discovery vocabulary) — deliberately deferred
  (operator decision 2026-07-08); a per-POV applicability view is a possible later follow-up with its
  own design.
- **Provisioning new offered POVs** (e.g. adding an LFO POV to the selector + computing its scores).
  MVP wires only the POVs the selector already offers; new-POV provisioning ties to
  Trust-Determination / customer-POV work and is a separate epic — now concretely scoped as
  **"external/named POV provisioning via NIP-85"** (`_intake.md` 2026-07-09 entry): the per-customer
  kind-30382 pipeline already exists; the remaining gaps are narrow (intake gaps a–f). This story's
  threading is the same `wotPov`/`userPubkey` plumbing that epic will ride.
- **Changing the tag write path** or any backend read API (the reads already accept a POV parameter).

## Open questions (for Architecture)
- **Where the selected POV lives and how a tag read consumes it.** Search already resolves the choice to
  a POV parameter; the Architect determines whether the tag surfaces reuse that exact resolution (a
  shared source) or each re-reads the preference, and how "my own / named / house" maps to the read
  parameter the backend already accepts. (This story asserts the *behavior*, not the wiring.)
- **The event-tag surface currently passes no POV** while the tag-page surfaces pass a login-binary one
  — confirm both converge on the same selected-POV resolution.
- **Whether any surface needs a new read parameter** or all needed POV parameters already exist on the
  backend (the intake says they do; verify per surface).

## Scope note (for the gate)
This is **Story 1 of a 2-story epic** (`pov-selectable-tag-surfaces`):
1. **(this story)** Tag surfaces honor the explicitly-selected POV — the core "one choice governs
   everything" behavior, assuming the POV is provisioned.
2. **(next)** Honest state for an unprovisioned selected POV — an explicit "this POV isn't computed on
   this instance" state on the tag surfaces, replacing the silent count-everyone fallback.

They split cleanly: Story 1 is the *plumbing + consistency* win (immediately useful for the already-
provisioned house/named/own POVs); Story 2 is the *honesty* guard that matters once someone selects a
POV the instance hasn't computed. Story 1 delivers value without Story 2; Story 2 depends on Story 1's
threading being in place.

## Linked artifacts
- ADR: (after Architecture)
- Test plan: (after Test Design)
- Review: (after Review)
