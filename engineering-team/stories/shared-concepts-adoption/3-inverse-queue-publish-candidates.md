# Story 3: Inverse queue — publish candidates

**Status:** Approved
**Created:** 2026-08-06
**Type:** Feature
**Epic:** `shared-concepts-adoption`
**Book:** `shared-concepts-adoption` (F2)

## Background

The owner's taxonomy (intake 2026-08-05): *"I might identify events authored by me that I should
auto-b-tag, because others are using it"* — with the stated intended effect of *"prompting users to
auto publish lots of shared concepts, the result being an ever-growing community dictionary."*

F1 closed the adopt-theirs half of the loop; F2 closes publish-mine. The population is the F5
coverage set filtered by *external evidence*: TA-authored headers with cross-author usage
(z-filings by other authors under my headers, or b-affiliations by other authors pointing at them)
and no self-pointing b. Both actions are shipped and symmetric: **accept = self-declare**;
**decline = keep-private (the sentinel)** — which simultaneously removes the header from this
queue, from F5's undispositioned set, and from future re-prompting. No new disposition machinery
exists in this story.

**Who is affected:** the owner deciding what to offer the community; the community dictionary this
feeds.

## User-facing description

As **the owner**, I want to see which of my concept headers other people are already using — with
the usage evidence in front of me — and publish each as a shared concept (or deliberately keep it
private) in one click, so that **the concepts the community has organically gathered around become
properly offered shared concepts.**

## Acceptance criteria

- [ ] **Population:** the publish-candidates view lists TA-authored headers that carry **no b of
      any form** (undispositioned in F5's terms) and have **cross-author usage** — z-carriers by
      other authors filed under them and/or b-tags by other authors pointing at them; sorted by
      usage.
- [ ] **Evidence:** each candidate shows its cross-author usage — filing counts (events + distinct
      authors) and affiliation counts (pointing b-carriers by others) — distinguishably.
- [ ] **Accept:** "Submit as a Shared Concept" runs the shipped self-declare (idempotent;
      community-relay broadcast affordance); the candidate leaves the view immediately.
- [ ] **Decline:** "Keep private" runs the shipped keep-private disposition (the sentinel; no
      broadcast); the candidate leaves the view immediately and does not return while the sentinel
      stands.
- [ ] **Deferred-but-in-use reveal:** headers already marked keep-private that have cross-author
      usage are hidden by default behind a one-line collapsed count ("N kept-private headers have
      active usage"); expanding shows them with their evidence and the un-defer path
      (re-disposition per F5's rules).
- [ ] **Placement:** the view lives on the Adoption Queue page beside "theirs to adopt" and
      "declined" — the page presents the two queues as one adoption loop; the F1 view's behavior is
      unchanged.
- [ ] **Nothing auto-acts;** an empty view states plainly that every used header is offered or
      deliberately private.
- [ ] **Gating:** the view is public-read; both actions are owner-only with the shipped gates.
- [ ] **Gates:** new tests pass; no suite regresses beyond pre-existing rows;
      `bash scripts/harness-lint.sh` clean.

## Concepts touched

None changed (no firmware reinstall). Named in plain language: this instance's concept headers; the
sentinel/self-declare dispositions (BIBLE §31 first-person semantics; the shared-concepts draft's
"Deliberate non-affiliation").

## Out of scope

- **F3's trust-weighting** of the evidence.
- **Any change to F1's view or the F5 coverage surfaces** beyond the shared page growing a view.
- **Wired-header nomination** — a header with a real b (wired or self-declared) is dispositioned
  and never a candidate here (F5-coverage-consistent; self-declaring a wired header stays available
  from the F5 flow).
- **Batch actions; legacy-concept re-parenting.**

## Open questions

Resolved during planning (owner decisions, 2026-08-06):

- *Surface?* A second view on the existing **Adoption Queue page** — the page presents the two
  queues (theirs-to-adopt / mine-to-publish) plus Declined as one adoption loop.
- *Deferred-but-in-use?* **Hidden by default behind a collapsed one-line count**, expandable to the
  evidence and the un-defer path.

For the Architect: whether the publish-candidates assembly extends the existing queue endpoint or
stands beside it; reuse boundaries with the F1 page components.

## Linked artifacts

- ADR: `engineering-team/decisions/shared-concepts-adoption/0003-inverse-queue-publish-candidates.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
