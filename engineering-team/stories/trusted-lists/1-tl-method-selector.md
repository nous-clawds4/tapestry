# Story 1: TL membership-method selector (Count only)

**Status:** Approved
**Created:** 2026-08-27
**Type:** Feature

## Background

We are moving Trusted-List membership from count-based math toward GrapeRank-weighted certainty
(book `tl-weighted-certainty`; spec handoff
`/home/vcavallo/tl-weighted-certainty-spec-for-tapestry.md`, source decision Approved). The
operator has directed a **stepwise ladder** so each mathematical step can be validated by hand
before the next is built:

1. **Count** — integer total of gate-passing taggers (the current implementation).
2. **Input & agreement** — the weighted sum Σ(rank/100) over all non-neutral taggings
   ("input"), together with the apply/dispute weighted average (ratings +1/−1), so
   disagreement is represented from this rung on (a 50/50 equal-rank split averages to 0).
3. **Certainty** — one function call further: the input converted via the existing
   input→confidence function (rigor 0.5), multiplied by the same average — the full spec
   formula.
4. **Formalization** — the spec's wire contract becomes the default: integer 0–100 per-member
   scores, `rigor` metadata, the `score ≥ 1` membership predicate replacing
   `applies > disputes`, score-ordered lists. *(Holds the original spec story's ACs.)*

This story is rung 1's delivery: put the **method choice itself** on the Trust Determination
Methods page as a single pipeline-wide setting, with only Count available — proving the
selection plumbing end-to-end while behavior stays identical to today. The operator tests;
rungs 2 and 3 land as follow-on stories, one per test cycle.

## User-facing description

As the operator, I want a "TL membership method" selector on the Trust Determination Methods
page that governs how the whole TL refresh pipeline computes membership, so that as each new
method lands I can switch the pipeline over, compare published results, and validate the math
one step at a time.

## Acceptance criteria

- [ ] **Selector exists.** The Trust Determination Methods page shows a "TL membership method"
      control, clearly distinct from the existing viewer-side scoring-method choice, listing
      the four ladder methods above; only **Count** is selectable in this story, the other
      three visible but disabled and marked as not yet available.
- [ ] **Pipeline-wide and durable.** The selection is one global setting for the TL refresh
      pipeline (not per-pin, not per-browser): it survives page reloads, browser changes, and
      a container restart, and the page always displays the currently active method.
- [ ] **The pipeline honors it.** The TL refresh pipeline reads the active method at refresh
      time. With Count active, every published TL's membership, counts, ordering, and event
      shape are identical to today's output for the same inputs.
- [ ] **Method is auditable on the wire.** Each TL published by the pipeline records which
      membership method computed it, so the operator can confirm from the published event —
      not just the UI — which math produced a given list.
- [ ] **Default is Count.** With no selection ever made, the pipeline behaves exactly as
      before this story.
- [ ] **Local-only publishing.** All events produced while building and verifying this story
      go to the local dev relay only (standing project rule for tag-stack work).

## Concepts touched

Concept Graph API was not reachable at planning time — the Architect should resolve handles.
Plain-language list:

- **Trusted List** events (kinds 30392–30395) — gain a record of the computing method
  (read/write).
- **tag-pinning** pins and **nostr-user-tag** taggings — read-only; membership math unchanged
  in this story.
- The Trust Determination Methods surface — gains the selector.

## Out of scope

- Any change to membership math — Count remains the only implemented method here.
- Rungs 2–4 (Input & agreement; Certainty; Formalization) — follow-on stories in this epic,
  one per operator test cycle. During rungs 2–3 the membership *predicate* stays the current
  count-based one (`applies ≥ cutoff AND applies > disputes`) while the new numbers are
  published for validation; the predicate flips at rung 4. The always-on per-member score
  decision (Planning gate, 2026-08-27) applies from the rung that first publishes scores.
- Per-pin method selection — the operator chose pipeline-global for now.
- The kind-10040 TL-provider line (queued in intake; follows the ladder).

## Open questions

- None at planning. (Where the global setting persists and how the server pipeline reads it is
  the Architect's call.)

## Linked artifacts

- Book: `engineering-team/audits/tl-weighted-certainty/book.md`
- Epic: `engineering-team/epics/trusted-lists.md`
- Spec handoff: `/home/vcavallo/tl-weighted-certainty-spec-for-tapestry.md`
- ADR: `engineering-team/decisions/trusted-lists/0001-tl-membership-method-selector.md`
- Test plan: `engineering-team/stories/trusted-lists/1-tl-method-selector.test-plan.md`
- Review: (filled in after Review phase)
