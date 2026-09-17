# Story 1: Tell me what actually happened when I offer or wire a concept

**Status:** Done
**Created:** 2026-08-10
**Type:** Bug
**Epic:** `shared-concepts-seeding`
**Book:** `shared-concepts-seeding`

## Background

The book's second frame bullet: *every path that offers a concept tells her truthfully whether it
reached the community.* Two of them don't.

Both broadcast-bearing disposition actions await the publish call and **discard its result**
(`ui/src/utils/dispositionActions.js:27` and `:54`), then return a message asserting the concept
reached the community relay. The publish call **does not throw on failure** — it resolves with a
result object listing successes and failures, and resolves with a "kept local" marker when the
deployment's external-publishing guard is switched off
(`ui/src/utils/nostrPublish.js:95`). So the `catch` those functions rely on is effectively dead for
the ordinary failure modes, and the success message prints regardless.

**The concept page already does this correctly** and is the working model: its own submit handler
inspects the result, distinguishing *published*, *kept local because the deployment says so*, and
*local write succeeded but the broadcast didn't land*.

**Four user-facing actions are affected, across two pages** — wider than first reported:

| Surface | Action | Message today |
|---|---|---|
| Concepts list → disposition panel | Submit as a Shared Concept | "Submitted as a shared concept." |
| Concepts list → disposition panel | Wire | "Wired — broadcast to the community relay." |
| Adoption Queue → "Mine to publish" | Submit | "Submitted as a shared concept." |
| Adoption Queue → nominations | **Adopt** | "Wired — broadcast to the community relay." |

Adopt matters most of the four: adopting is how one instance tells the community it recognises
another's concept, so a silent broadcast failure means the adoption exists only on that machine
while the user has been told otherwise.

**Why this has gone unnoticed:** the happy path works. At this book's open the owner offered `cat`
and `cat breed` from staging through this very machinery, and both genuinely reached
`dcosl.brainstorm.world` (verified by direct relay query). The message only lies when the broadcast
fails — which is exactly when a user most needs the truth.

This is also the state the previous book built two surfaces to *reveal* — declared here but not
sent — being actively misreported by the surfaces that perform the action.

**Who is affected:** anyone offering or adopting a concept from either page; most acutely a
deployment with external publishing switched off, where **every** such action reports community
reach and **none** of it is true.

## User-facing description

As **the owner**, when I offer or adopt a concept, I want to be told what actually happened — it
reached the community, it was kept on this machine, or it failed to get out — so that I never
believe something is shared when it isn't.

## Acceptance criteria

- [ ] Given the broadcast reaches at least one relay, when I submit a concept, then I am told it
      reached the community.
- [ ] Given this deployment has external publishing switched off, when I submit a concept, then I am
      told it was kept on this machine — worded distinctly from having reached the community, and
      not as an error, because it is a deliberate setting.
- [ ] Given the broadcast reaches no relay, when I submit a concept, then I am told the local
      declaration succeeded but it did not reach the community, and that I can try again.
- [ ] Given each of those three outcomes, when I **wire** a concept to another instance's shared
      concept, then I am told the corresponding truth — the wiring path makes no claim the
      submitting path wouldn't.
- [ ] Given the concept was already offered or already wired, when I repeat the action, then I am
      still told which of the three outcomes the re-broadcast had.
- [ ] Given I keep a concept private, then the outcome message makes no claim about the community at
      all — that action deliberately never broadcasts.
- [ ] Given any of these actions on **either** page that offers them, then the outcome I see is the
      same one — neither surface reports more confidently than the other.

## Concepts touched

None. This story changes what the user is told about an action's outcome; it does not change the
action, the wire format, or any concept definition. No firmware reinstall.

## Out of scope

- **Changing the shared publish helper's contract.** It has eight other callers that rely on its
  current shape; widening it is recorded as deferred debt (ADR `shared-concepts-legibility/0001`,
  Option C) and is not this story's business.
- **Fixing the sharing-state handler's local-read swallow** — a different defect in a different
  file, carried forward from the previous book.
- **Automatic retry.** Telling the truth is this story; recovering is not. My Offerings already
  shows which concepts never made it out.
- **The other two seeding items** — the My Offerings affordance and the bulk "not yet offered"
  filter.

## Open questions

**Both resolved at approval, 2026-08-10 — the owner agreed with both PO recommendations.**

1. **Is "kept on this machine" a success or a warning?** — **RESOLVED: neutral, informational.** The
   deployment guard is a deliberate setting, not a fault, and the concept page already words it that
   way. It must still read distinctly from having reached the community.
2. **Should a failed broadcast offer a retry in place?** — **RESOLVED: no.** Say what happened and
   where to see it. The action is already idempotent and repeatable, My Offerings shows what never
   made it out, and retry machinery across four call sites is scope the frame does not ask for.

## Linked artifacts
- ADR: (skipped — Bug under Standard; the concept page's handler is the working model, so there is
  no design choice to make)
- Test plan: `engineering-team/stories/shared-concepts-seeding/1-honest-broadcast-reporting.test-plan.md`
- Review: `engineering-team/reviews/shared-concepts-seeding/1-honest-broadcast-reporting.md`
