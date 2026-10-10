# Story 1: Ratify the self-pointing `b` (self-declared Shared Concepts)

**Status:** Approved
**Created:** 2026-10-10
**Type:** Doc

## Background

Duty Menus rests on one header that Nous offers as a Shared Concept by pointing its `b` at itself
([`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`](../../../docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md) D10). The rule is
already in use:
- "Submit as a Shared Concept" writes it;
- the community relay holds self-declared headers from several Assistants (`engineering-team/stories/_intake.md`, the
  2026-08-10 entries).

But it is only *proposed*, in [`protocols/drafts/amendments-2026-09.md`](../../../protocols/drafts/amendments-2026-09.md) § 3,
not written into the specs. That proposed wording also says "canonical", a word the Shared Concepts vocabulary policy keeps
out of normative text ([`docs/NIP_REORG_DESIGN_HANDOFF.md`](../../../docs/NIP_REORG_DESIGN_HANDOFF.md) D2).

## User-facing description

As an implementer publishing or reading shared concepts, I want the specs to say what a header whose `b` names itself
means, so that an independent client treats Nous' Duty Menu header, and every other self-declared header, the way we do.

## Acceptance criteria

- [ ] **AC1.** `protocols/drafts/inherit-from.md` § "The `b` tag" states the rule. A pointer-typed `b` naming the
  header's own coordinate offers that header as a shared concept others may affiliate with. It asserts no deference, opens
  no path and carries no aggregation weight. Whether others converge on it is resolved per point of view.
- [ ] **AC2.** `protocols/drafts/shared-concepts.md` § Declared affiliation says the same in one line and points to
  `inherit-from.md` for the wire form. There is no second normative copy.
- [ ] **AC3.** The new normative text contains neither "canonical" nor "consensus".
- [ ] **AC4.** `protocols/drafts/amendments-2026-09.md` § 3 is marked applied, with a pointer to where it landed. The rest
  of that file is unchanged.
- [ ] **AC5.** Links resolve, `harness-lint` is clean, and the stack-free `npm test` shows no regressions. No other
  `protocols/` file changes.

## Concepts touched

None changed (docs-mode). The rule governs any DList header (kind `39998`) that carries a `b` tag.

## Out of scope

- The Duty Menu spec (story 2) and Self-Maps (story 3).
- The UI gaps around self-declaration state logged in the 2026-08-10 intake entries.
- Any change to how the code writes the tag, which already matches the rule.

## Open questions

None blocking. The Architect picks the replacement word for "canonical", within D2's vocabulary (deference,
convergence, convention).

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: skipped (docs-mode)
- Review: (filled in after Review phase)
