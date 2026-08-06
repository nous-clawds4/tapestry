# Story 2: Adoption-candidates queue

**Status:** Approved
**Created:** 2026-08-06
**Type:** Feature
**Epic:** `shared-concepts-adoption`
**Book:** `shared-concepts-adoption` (F1)

## Background

The owner's taxonomy (intake 2026-08-05): *"an element of S3, S3a, or S3b that is not in S2a would
be a candidate element of S2a, which would prompt me to update my local concept header
accordingly."* The observation instrument exists (Active z-tags: foreign-authored headers with
cross-author z-usage, self-filed excluded — PR #494's default); the adoption actions exist (F5's
wire-external `b-append` primitive, shipped for exactly this consumer, and the registry's
create-element machinery behind the Shared Concepts "Create New" page). F1 closes the loop with the
**proposal-loop shape**: the system nominates, the owner ratifies, nothing auto-acts.

A declined nomination needs a durable local marker so the queue stops re-prompting. The marker is
local **by construction** — the nominated header is a foreign author's event; only they can tag it —
so this is not the W16 sentinel question re-opened (that debate concerned markers on *this
instance's own* headers, where a tag travels with the event).

**Who is affected:** the owner processing nominations; F3, which later adds trust-weighted
refinement (S3b thresholds) over the same population.

## User-facing description

As **the owner**, I want a queue of shared concepts that are demonstrably in use but that my
instance hasn't adopted, each with one-glance usage evidence and one-click adopt / recognize /
decline actions, so that **my instance steadily converges on the community's live vocabulary
without anything happening unratified.**

## Acceptance criteria

- [ ] **Population:** the queue lists foreign-authored shared concepts with cross-author z-usage
      (the Active z-tags base, self-filed excluded), **minus** concepts any of my headers already
      b-points at, **minus** concepts a registry record already identifies, **minus** declined
      ones; sorted by usage.
- [ ] **Evidence:** each nomination shows usage counts (events + distinct authors) and a **"used by
      me"** badge when my own filings exist (S3a).
- [ ] **Adopt (wire a twin):** choosing one of my headers as the local twin wires it to the
      nominated concept via the shipped primitive (append-only, sentinel-replaced,
      community-broadcast affordance); the nomination leaves the queue immediately.
- [ ] **Recognize (registry):** creates the registry record with the nominated concept's
      identifiers prefilled; the nomination leaves the queue immediately.
- [ ] **Decline:** records a **dated, supersedable local decline**; the nomination leaves the queue
      immediately and stays gone across sessions; a "Declined" view lists declines and allows
      reversal (un-decline returns the concept to the queue).
- [ ] **Nothing auto-acts;** an empty queue states plainly that everything in use is adopted,
      recognized, or declined.
- [ ] **Gating:** the queue view is public-read like its sibling instruments; all three actions are
      owner-only with the F5 gate semantics.
- [ ] **Gates:** new tests pass; no suite regresses beyond the pre-existing OPEN.md #143 failure;
      `bash scripts/harness-lint.sh` clean.

## Concepts touched

The `shared concept` registry concept (handle constructible as `39998:<TA>:shared-concept`;
elements created by the Recognize action). No concept *definitions* change expected; the Architect
re-checks whether the decline marker warrants a runtime-created concept (the proposal-loop
precedent) — runtime-created either way, so no firmware reinstall.

## Out of scope

- **F3's trusted-usage thresholds and dictionary** (S3b deferred there — owner decision at
  planning, 2026-08-06; F1 ships raw counts + the "used by me" badge only).
- **F2's inverse queue.**
- **Any wire-format marker for declines** — local by construction.
- **Auto-adoption, batch actions.**
- **ADR-0015 legacy-concept re-parenting; fixing OPEN.md #143** (a new route nudges the drifted
  pin further; disposition stays with #143).

## Open questions

Resolved during planning (owner decisions, 2026-08-06):

- *Surface?* A dedicated **Adoption Queue page** under Shared Concepts — Active z-tags stays a pure
  observation instrument; the queue is an action surface.
- *Decline semantics?* A **dated, supersedable local decline record** — leaves the queue across
  sessions; reviewable and reversible from a "Declined" view.
- *S3b annotation?* **Deferred to F3.**

For the Architect: where the decline marker lives (registry-element field vs a sibling
runtime-created concept vs a brain record — the proposal-loop precedent applies); the twin-picker
source (this instance's headers); whether the queue assembles client-side on the z-tags scan
machinery or server-side.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
