# Story 1: Concept-header b-coverage audit and guided disposition

**Status:** Approved
**Created:** 2026-08-06
**Type:** Feature
**Epic:** `shared-concepts-adoption`
**Book:** `shared-concepts-adoption` (F5)

## Background

The owner's ask, verbatim (intake 2026-08-05): *"within the list of concept headers, we should keep
track of which ones have a b-tag to a shared concept and which ones do not. The goal should be to
prompt users to iterate through all of the ones that do not"* — taking one of three actions, with
the intended effect of *"prompting users to auto publish lots of shared concepts, the result being
an ever-growing community dictionary."*

The marker question underneath (worksheet W16) was settled by the owner on 2026-08-06 (`/discuss`,
after weighing a local disposition record): **the sentinel** — `["b", "b-tag-deferred"]`, a reserved
literal that is deliberately neither an a-tag nor an event id. The three disposition actions are
symmetric — each writes a `b`, differing only in value:

1. **Wire to an external shared concept** — `["b", "<external-a-tag>", "pointer"]`
2. **Auto b-tag** — `["b", "<own-a-tag>", "pointer"]` (the shipped self-declare)
3. **Keep private** — `["b", "b-tag-deferred"]`

The old "auto-b but don't publish" half-state is dropped (owner, 2026-08-06). Coverage becomes one
question: *does the header carry any `b` at all?* The W16 ruling — spec edits included — rides this
story (its stated graduation target).

**Who is affected:** the owner working through their concept inventory; every b-tag surface and the
strfry→Neo4j import (which must treat the sentinel deliberately, not accidentally); later suite
features (F1 consumes this story's wire-external primitive).

## User-facing description

As **the owner**, I want the concept-headers list to show which of my headers have a shared-concept
affiliation and which don't, and to step through the unaffiliated ones taking one of three one-click
dispositions — wire to an external shared concept, submit as a shared concept, or keep private — so
that **every header ends up deliberately dispositioned** and my instance steadily feeds the
community dictionary.

## Acceptance criteria

- [ ] **Coverage visibility:** the concept-headers list surfaces each header's disposition state —
      **wired** (b to a foreign a-tag), **self-declared** (self-pointing b), **deliberately
      private** (sentinel), **undispositioned** (no b) — and can filter to undispositioned.
- [ ] **Guided iteration:** from that list, the owner steps through undispositioned headers and
      takes any of the three actions without leaving the flow; an acted-on header leaves the
      undispositioned set immediately.
- [ ] **Wire-external:** given a chosen target (a-tag), the header gains `["b", <target>,
      "pointer"]` — existing tags preserved append-only, published to local strfry, imported to the
      graph, signed event returned for community-relay broadcast (the self-declare pattern);
      owner-only.
- [ ] **Auto b-tag:** the existing self-declare action, reachable from the flow, idempotent as
      shipped.
- [ ] **Keep private:** the header gains exactly `["b", "b-tag-deferred"]`; it thereafter renders as
      *deliberately private* on every coverage surface — never as a lookup error — and this action
      performs **no external publish**; owner-only.
- [ ] **Sentinel hygiene:** importing a sentinel-carrying header creates **no graph node or edge**
      for the sentinel (no phantom `NostrEvent`); the b-surfaces (Active b-tags, b-tag detail, the
      self-declared matcher) skip the sentinel by name.
- [ ] **Mutual exclusivity + re-disposition:** keep-private is offered only on headers with no real
      b; wiring or self-declaring a previously-deferred header **replaces** the sentinel (the header
      ends with real b's and no sentinel); deferral never removes a real b.
- [ ] **Spec ruling lands:** inherit-from gains the reserved third value form (exactly
      `b-tag-deferred`); shared-concepts gains the ruling paragraph; **W16 → Graduated**.
- [ ] **Gates:** new tests pass; no suite regresses beyond the pre-existing OPEN.md #143 failure;
      `bash scripts/harness-lint.sh` clean.

## Concepts touched

No concept definitions change (no firmware reinstall). Named in plain language: concept headers
(kind 39998) generally; the `shared-concept` registry concept as directory context. Stack is up at
`:7778` — the Architect resolves handles if any are needed.

## Out of scope

- **F1's nomination queue** (the S3 ∖ S2a candidates computation) and registry-record creation on
  adoption — F1's business; this story only supplies the wire-external primitive it will consume.
- **F2's inverse queue.**
- **Fixing OPEN.md #143** (the `show-the-four` route-count pin) — tester-lane, any session. Note
  this story adds UI; if it adds routes, #143's drifted pin count moves further — the disposition
  stays with #143, not here.
- **ADR-0015 legacy-concept re-parenting.**
- **Any community-visible "deliberately standalone" statement beyond the sentinel itself.**
- **Batch / multi-select disposition** — the flow is one header at a time.

## Open questions

Resolved during planning (owner decisions, 2026-08-06):

- *Epic home?* New epic `shared-concepts-adoption` (same slug as the book), this story #1; F1–F4
  join it as planned. F0 stays in `self-ontology`.
- *Build the wire-external primitive here or defer action 1 to F1?* Build it here — F5 leads the
  suite by owner priority, so the primitive moves with it; F1 consumes it later.

For the Architect:

- Literal-string skip vs a general value-form guard at the strfry→Neo4j import chokepoint
  (`src/api/neo4j/eventSync.js` b-branch) — the general guard also hardens against malformed `b`
  values from any source.
- Where the wire-external target picker draws from (the Shared Concepts directory surfaces).
- OPEN.md #142 (three divergent sign/publish/import copies — consolidate on `normalize/helpers`)
  interplay with the new endpoint.

## Linked artifacts

- ADR: `engineering-team/decisions/shared-concepts-adoption/0001-b-coverage-audit-and-disposition.md`
- Test plan: `engineering-team/stories/shared-concepts-adoption/1-b-coverage-audit-and-disposition.test-plan.md`
- Review: (filled in after Review phase)
