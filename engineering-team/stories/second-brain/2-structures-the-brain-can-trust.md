# Story 2: Structures the brain can trust

**Status:** Done
**Created:** 2026-07-23
**Type:** Feature

**Epic:** `second-brain` (#2) — `engineering-team/epics/second-brain.md`
**Book:** `engineering-team/audits/second-brain/book.md` (PRD-backed)
**Source:** `product-team/stories-queue.md` → Second Brain block, Story 2 (queue order is pickup order)
**PRD:** `product-team/prd/second-brain.md` §5.7 (hygiene), §7.8 (adopt, runtime identity), §5.9 (second-operator guard), §10 ("hygiene check green" is an MVP success metric)
**Guides (binding at review):** `product-team/guides/second-brain-design-guide.md` (do-not-design list: **no health/monitoring surfaces** — the check is not a UI view), `second-brain-style-guide.md` (register applies to any sentence that reaches the owner; none is planned here)
**Pickup context:** `docs/SECOND_BRAIN_STORY2_HANDOFF.md` (defect-inventory corrections; classification-core reuse; shipped dependency)

## Background

Stories 3–8 build decomposition, pointers, proposals, and records on top of the goal structures. Before anything more is stacked on them, the brain must be able to prove those structures obey the graph's own class discipline — a session must be able to trust what it reads (Fresh-Context Session persona, tracing to owner journey 4 via the read loop), and the owner must be able to see "hygiene check green" (PRD §10). That check must be repeatable, because firmware reinstall re-derives membership edges from surviving z-tags (`src/firmware/install.js` pass 1d) — soundness verified once cannot be assumed permanent; it must be re-checkable on demand.

**The queue's defect inventory was written from a direction-erased view and is falsified live.** The `/neighbors` endpoint erases edge direction; the handoff mandated re-verification with directed Cypher before acceptance criteria were written. Verified live on the local instance 2026-07-23 (all handles runtime-resolved; TA `11f23fe4…` via `/api/assistant/pubkey`):

- **The "two known stray membership edges" are not defects.** (a) The `set-superset` / `superset-superset` → `tapestry-owner-goal-superset` `HAS_ELEMENT` edges are **incoming** — the goal superset is itself an element of the `set` and `superset` concepts: legitimate class-thread data. (b) The work-item headers' association with `concept-header-superset` is likewise **incoming** (`concept-header-superset -HAS_ELEMENT-> header`) and **universal**: all 44 concept headers on the instance carry exactly this membership. Deleting these edges, as the queue's AC literally reads, would damage legitimate structure and make the two work-item concepts anomalous — and reinstall would re-derive the element-side edges anyway. (c) The suspected header-side outgoing `HAS_ELEMENT` (header → `concept-header-superset`) **does not exist** on either work-item header.
- **One real, live defect: the goal concept's property record lags its schema.** Story 1 extended the schema element (`…:tapestry-owner-goal-schema`) with optional `origin` and `capturedOn` via `save-schema`, which does not regenerate the primary-property node (`…:tapestry-owner-goal-primary-property`) — that node's `property.properties` still declares only `name`/`slug`/`description`. Documented as known drift in ADR 0001 Consequences (a); confirmed live 2026-07-23.
- **Everything else is sound.** Both work-item headers carry identical, correct wiring (six machinery relationships in, concept-superset membership in, `IS_THE_CONCEPT_FOR` out). The goal superset has exactly the three goal elements; each element carries both its membership edge and a matching z-tag naming the goal header. The Goals API returns exactly those three goals.

**Divergence to ratify at the planning gate:** PRD §5.7's factual premise ("the two known live defects — stray membership edges on both work-item concepts — are cleaned") is contradicted by the directed live graph. This story **adjudicates and retains** the flagged edges instead of deleting them, and reconciles the one defect that is real. The book is PRD-backed, so this deviation is recorded here and must be carried into the book-close addendum.

The check and the Goals view must agree on what counts as a goal — one classification, not two (handoff-binding: the shared classification core story 1 shipped is the single source of that truth). The story's declared dependency is shipped: single-edge cleanup operations exist (`relationship-primitives` book, closed 2026-07-22) — referenced, never re-implemented (PRD §7.9); as adjudicated, no edge deletion is currently warranted, but if a real edge defect ever surfaces, those primitives are the paved road.

Affected: the Delegating Owner (trust in the substrate) and the Fresh-Context Session (a machine reader that cannot second-guess structure). The check itself is an operator/engineering surface — the design guide bans health/monitoring surfaces from the owner UI, and no owner-facing view is part of this story.

## User-facing description

As the Tapestry owner, I want a repeatable check that validates my brain's goal structures against the graph's own class discipline — with the one verified live defect reconciled and the falsely-accused edges cleared — so that I, and every fresh session that reads my brain, can trust the structures everything else is about to be built on.

## Acceptance criteria

Queue-authored intent, reconciled against the directed live graph (Background). Phrased testable-from-outside.

- [ ] **AC 1 — Repeatable check, green when sound.** Given goal structures with no structure defects, when the check runs, then it reports zero structure problems; and running it twice with no graph changes in between reports the same result.
- [ ] **AC 2 — Flagged edges adjudicated, not deleted.** Given the membership edges the queue flagged as strays (the two incoming class memberships on the goal superset, and each work-item header's membership under the concept-header superset), when the check runs, then each is classified sound — the classification is direction-aware — and every one of those edges is still present after this story ships. No cleanup deletes them.
- [ ] **AC 3 — The one live defect is reconciled.** Given the goal concept's property record that lags its extended schema (missing `origin`/`capturedOn`), when cleanup completes, then the concept's property record agrees with its schema and the check reports zero structure problems.
- [ ] **AC 4 — Recurrence is reported specifically.** Given an introduced structure defect of a known kind — a membership edge in the wrong direction, a membership edge and its element's z-tag declaration out of step with each other, or a property record lagging its schema — when the check runs, then the report names the specific structure and the specific kind of problem, not a generic failure.
- [ ] **AC 5 — No goal is lost.** Every goal element present before cleanup is present after it, with name, statement, origin, and capture date intact — the Goals API returns the same set of goals before and after.
- [ ] **AC 6 — Sound on any instance.** On a deployment where the goal concept does not exist yet, the check completes without error and reports that there is nothing to check (an absent concept is a state, not a defect — PRD §5.9); no instance identity or path is hardcoded — the assistant identity is resolved at runtime (house rule; PRD §7.8).

## Concepts touched

- `39998:<TA>:tapestry-owner-goal` — tapestry owner goal (validated; its primary-property record reconciled with its already-extended schema). `<TA>` resolved at runtime — never hardcoded.
- `39998:<TA>:project-for-the-engineering-team` — the sibling work-item concept (validated; verified clean live, no change expected).
- Class-thread context, read-only: `concept-header`, `set`, `superset`, and the per-concept machinery nodes (schema, primary property, properties set, graphs) — referenced for validation, never modified.
- No concept is created. No schema change (the schema is already extended; this story reconciles the lagging property record to it).

## Out of scope

- **Firmware/installer changes** — operator decision 2026-07-18; reinstall re-derivation stays as-is, which is exactly why the check detects recurrence rather than assuming cleanup is permanent.
- **Deleting the queue's flagged membership edges** — adjudicated legitimate (AC 2); the queue's literal deletion AC is superseded by the directed-graph findings, pending gate ratification.
- **The relationship whitelist and the shipped primitives** — no `HAS_SUBGOAL` extension (story 3's declared dependency path); no re-implementation or modification of `add-relationship` / `delete-relationship` (PRD §7.9).
- **Any owner-facing hygiene surface** — the design guide's do-not-design list bans health/monitoring surfaces; the check's report is a technical artifact. If any sentence of it ever reaches the owner, the style guide's register governs it — none is planned here.
- **Graph-wide hygiene** beyond the two work-item concepts and their class-thread context — the other 42 concepts are firmware-governed; auditing firmware is not this story.
- **The publishToStrfry silent-drop bug**, router configuration, and anything that writes to strfry — pre-existing, separately tracked.

## Open questions

None open. Three were resolved at the planning gate (operator, 2026-07-23):

1. **Queue/PRD divergence ratified** → **adjudicate and retain.** The flagged membership edges are classified sound (direction-aware) and never deleted; the PRD §5.7 premise ("two known live defects … are cleaned") is recorded as falsified live and must be carried into the book-close addendum.
2. **Check scope confirmed** → the two work-item concepts (goal + engineering-project sibling) plus their class-thread context read-only — not all 44 concepts.
3. **Cleanup confirmed** → reconciling the primary-property record with the extended schema is this story's one cleanup act, under AC 5's no-goal-loss guarantee.

## Deviations

*(Implementer log, 2026-07-23 — small judgment calls; the ADR was not departed from.)*

- **Journaled reconcile — goal concept (ADR decision 5, operational step):** `POST /api/normalize/reconcile-primary-property` `{"concept":"tapestry owner goal"}` run once against the local instance, 2026-07-23, after the code deploy (`supervisorctl restart brainstorm`). Response `success:true, result:'reconciled'`, properties before `[name, slug, description]` → after `[name, slug, description, origin, capturedOn]`, ppUuid `…:tapestry-owner-goal-primary-property`. Read-back verified: `GET /api/brain/hygiene` shows the goal concept at 0 problems. Other deployments run the same call at their bootstrap (after `save-schema`, per ADR 0001 decision 1's sequence).
- **Second live drift instance found and reconciled — the project sibling.** The check's first live run reported `property-record-drift` on `project-for-the-engineering-team`: its schema legitimately declares optional `prompt` ("the full prompt designed to kick off a new session from scratch" — a past `save-schema` extension) that its primary-property record lacked — the same defect class, previously unknown. The story's wording scoped "the one cleanup act" to the goal concept, but the planning gate confirmed the check's scope covers both work-item concepts and AC 1 requires green; reconciled with the same idempotent call (`{"concept":"project for the engineering team"}` → `result:'reconciled'`, before `[name, slug, description]` → after `+prompt`). Final check: `sound:true`, 0 problems, both concepts present (3 + 5 elements). The check catching a real unknown instance of a known kind on first contact is the story's purpose demonstrating itself.
- **Lazy requires in the reconcile handler** (`middleware/auth`, `lib/brain/hygiene`) — the composite module's established in-handler idiom (`normalize/index.js:2238,3328`) rather than new top-level imports; load-time import graph unchanged.
- **Check-side node resolution via machinery edges:** the hygiene route locates the schema and primary-property nodes from the header's `IS_THE_JSON_SCHEMA_FOR` / `IS_THE_PRIMARY_PROPERTY_FOR` edges (already fetched for classification) rather than assuming the d-tag naming convention — if the machinery is missing, `machinery-incomplete` already reports it specifically and the property comparison is skipped. The ADR's d3 sketch left this resolution unspecified.
- **One extra core export:** `MACHINERY_IN` (the expected-wiring list) is exported from `hygiene.js` alongside the four pinned functions — additive, for future stories' reuse; U1 pins the four, forbids nothing.
- **Tester-lane amendment executed during Phase 4 (story-1 suite, one allowlist entry):** the first full-gate run failed story 1's S2 — its brain-module import allowlist still pinned the 0001 four, while ADR 0002 prescribes exactly "the 0001 four plus lib/brain/hygiene". Amended `test/capture-a-goal-and-see-it.test.js` S2's `allowed` array with `/lib\/brain\/hygiene$/` (+ message updated to cite the 0002 re-pin). This WIDENS a story-1 assertion by the one ADR-prescribed entry — no assertion removed or otherwise weakened; story 2's S3 pins the same five-entry surface from the other side. Missed in Phase 3 planning; flagged for gate ratification and for the Reviewer's hunk-by-hunk test-diff audit.
- **Full-gate rerun under quiesced router:** the same first run also failed relationship-primitives H8 with the canonical +1 router-drift signature (`6001536 -> 6001537`; OPEN.md row 75) — unrelated to this story's diff; the failure message's own remedy ("quiesce and re-run") and the relationship-primitives close-gate precedent applied: `strfry-router` stopped for the rerun, restarted after.

## Linked artifacts

- ADR: `engineering-team/decisions/second-brain/0002-hygiene-check-and-primary-property-reconcile.md`
- Test plan: `engineering-team/stories/second-brain/2-structures-the-brain-can-trust.test-plan.md`
- Review: `engineering-team/reviews/second-brain/2-structures-the-brain-can-trust.md` (PASS)
