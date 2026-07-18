# Story 2: Cycle-skill safe-to-merge check + canonical shared recipe

**Epic:** deploy-safety-gate
**Status:** Draft
**Created:** 2026-07-18
**Type:** Feature

## Background

Story #1 shipped the question and the answer: any tapestry instance can now be asked, with one plain unauthenticated request, whether it is safe to redeploy right now — running-now across both task sources, next scheduled fire, explicit safe/unsafe verdict. It is live on staging (deploy-safety-gate #1, review PASS 2026-07-18). But **nothing asks**. No cycle procedure makes any pre-merge check against the instance it is about to redeploy; every instance check the procedures perform today is post-deploy smoke — after the container has already been recreated and any in-flight task already killed. Until the answer is consulted *before* the merge, the gate exists but guards nothing, and the operator's manual mitigation (disable every scheduled entry before promoting, in effect since June) remains the only protection.

The consuming behavior is ratified at intake (2026-07-18, agreed decision 1): the originally proposed fixed 60-minute look-ahead — which sub-hourly schedule entries could never satisfy — was replaced by a two-part design. The instance owns the verdict policy (story #1's 10-minute-buffer verdict); the promotion procedure, when the verdict is unsafe, **waits and rechecks** — bounded, journaled — rather than either aborting outright or merging anyway. Never merge on unsafe; never wait forever silently.

Coverage is ratified too (agreed decision 5): promotions to `feat/tags` → tags.brainstorm.world redeploy the tags instance exactly the way staging and production promotions redeploy theirs — but no cycle skill exists for that path. So the check recipe must live canonically in **one shared document** that every cycle procedure references and that a tags promotion can follow directly — the same update-once-inherit-everywhere pattern the smoke-test recipe already established for post-deploy checks.

**Who is affected:** the operator (and any cycle procedure acting for them) promoting a branch; instance owners whose scoring data is silently corrupted when a deploy kills a batch mid-run.

## User-facing description

As **an operator promoting a branch that will redeploy an instance** — via cycle-staging, cycle-prod, cycle-full, or by hand for `feat/tags` — I want the promotion procedure to check that instance's deploy-safety answer before merging, and to visibly wait and recheck while the answer is unsafe, so that no deploy-triggering merge ever lands while a scheduled task is running or imminent, without me having to remember to check or to disable schedules by hand.

## Acceptance criteria

- [ ] **AC-1 (check before merge, on the instance that merge redeploys):** Given a cycle-staging or cycle-prod run has a change ready to merge, when the procedure reaches the deploy-triggering merge, then as that merge's immediate precursor it obtains the deploy-safety status answer shipped by story #1 **from the instance this specific merge will redeploy** (a staging promotion asks the staging instance; a production promotion asks the production instance), and it merges only on a safe verdict just observed — a safe answer is acted on, not banked across an open-ended delay. The procedure consumes the verdict as delivered; it does not re-derive its own safety policy from raw schedule data.

- [ ] **AC-2 (unsafe → bounded, journaled wait-and-recheck; never merge on unsafe):** Given the verdict is unsafe, when the check runs, then the procedure does not merge; it waits and rechecks on a stated cadence up to a stated bound — both written into the recipe, not improvised per run — and every attempt is visibly recorded in the run's record: when the check was made, what the verdict was, and, when unsafe, the reason the answer gave. At no point does the procedure merge while the most recently observed verdict is unsafe, and at no point does it wait without recording that it is waiting.

- [ ] **AC-3 (bound exhausted or no usable answer → loud stop, operator decides):** Given the verdict is still unsafe when the bound is exhausted — or the status answer cannot be obtained at all (instance unreachable, no usable answer) — then the procedure stops without merging, reports the last observed state and why it stopped, and hands the decision to the operator. An answer that could not be obtained is never treated as safe; proceeding anyway happens only as an explicit, recorded operator decision, never as the procedure's silent default. "Merged anyway without saying so" and "hung with no output" are both defects.

- [ ] **AC-4 (cycle-full inherits by delegation):** Given a cycle-full run performs its promotions, then each deploy-triggering merge it makes is protected by the same check because cycle-full delegates to the underlying cycle procedures — it carries no check logic or recipe text of its own, and no path through cycle-full reaches a deploy-triggering merge without the check.

- [ ] **AC-5 (one canonical recipe; `feat/tags` explicitly covered):** The check recipe exists in exactly **one** shared document, following the same update-once-inherit-everywhere pattern the smoke-test recipe uses: each cycle procedure points to it rather than restating it, so changing the recipe changes every consumer at once. The document explicitly covers promotions to `feat/tags` → tags.brainstorm.world — which has no cycle procedure of its own — stating how to run the identical check against that instance before such a merge, so a tags promotion is never the uncovered path.

## Product decisions (operator-ratified at intake, 2026-07-18 — requirements, not open for relitigation)

1. **Wait-and-recheck, not abort and not a fixed look-ahead** (agreed decision 1 + frame bullet 4): the procedures "check the endpoint **on the instance the merge will redeploy, before merging**, and wait-and-recheck (bounded, journaled) while unsafe; cycle-full inherits by delegation." The verdict policy itself (10-minute buffer, all enabled entries, both running sources, phantom exclusion) lives in the story #1 answer; consumers do not relitigate or re-implement it.
2. **Coverage extends to tags** (agreed decision 5): "the check must also cover promotions to `feat/tags` → tags.brainstorm.world (no cycle skill exists for that path; covered via the canonical shared recipe)."
3. **One canonical shared doc** (frame bullet 4): "The check recipe is canonical in one shared doc (the SMOKE_TEST.md pattern)."

Verbatim sources: intake entry "2026-07-18 — Feature: scheduled-task deploy-safety gate" in `engineering-team/stories/_intake.md`; acceptance-frame bullet 4 in `engineering-team/audits/deploy-safety-gate/book.md`.

## Concepts touched

None. Verified live against the local Concept Graph 2026-07-18 (48 concepts): no handle covers deploy procedures, branch promotion, scheduled tasks, or instance operations. Nothing in this story redefines an existing concept.

## Scope notes

- **One subsystem:** the deploy-procedure harness — the cycle procedures, the single shared recipe document, and any check tooling they invoke. No server code, no UI.
- **The wait-and-recheck numbers are the Architect's call** (the book delegates "the wait-and-recheck bounds (attempts × interval)" to the owning phase). The story requires only that a cadence and bound exist, are stated in the recipe, and are honored and journaled.
- **The recipe's form** — prose steps versus a shared check tool the procedures invoke — **and the shared document's location are the Architect's call** (same delegated decision, which also covers making the check testable).
- **"Journaled" means externally visible in the run's record** — timestamps, verdicts, reasons. The exact medium is the Architect's call.

## Out of scope

- The settings Scheduled Tasks panel aggregate countdown line (frame bullet 5) — next story in this epic.
- Any change to the status endpoint, its verdict policy, or the 10-minute buffer — story #1, Done.
- A dedicated cycle skill for `feat/tags` promotions — coverage is via the shared recipe, per the ratified decision.
- CI-side enforcement inside the deploy workflows (workflow-level gating, branch protection) — out of scope at intake; this gate is procedural.
- Promotions to the other deploy-triggering sandbox branches (`feat/communities`, `feature-magic-carpet`, `feat/curate`) — outside frame bullet 4's coverage list. The shared-recipe pattern leaves the door open, but covering them is not this story's requirement.
- Drain-on-deploy / graceful shutdown, resumable checkpointing, stale job data on stalled recovery, auth-gating the scheduled-tasks write endpoints — epic guardrails, tracked elsewhere.

## Open questions

None. The intake entry's ratified decisions and the book's acceptance-frame bullet 4 answer the policy questions this story raises; the wait bounds and recipe form are explicitly delegated to Architecture by the book's pre-registration.

## Deviations

- **Implementation (2026-07-18):** malformed `[max-attempts]`/`[interval-seconds]` args (non-numeric) also exit 3 with usage — the ADR's Implementation notes name only the URL arg for validation, but its Consequences exit contract reads code 3 as "usage-or-environment-error", and letting a garbage bound into the loop would be an unstated fourth behavior. No tested behavior changes.
- **Implementation (2026-07-18):** cycle-prod's new error-handling bullet includes one sentence on the endpoint-404 transition case (prod serves the endpoint only after story #1 reaches `main`, so the first gated promotion hits exit 2 by design) — the ADR states this sequencing reality in its Consequences and the doc carries the note; naming it in the bullet keeps the first real run from reading a correct fail-closed stop as a defect. No numbers, no recipe content restated.

## Linked artifacts

- Book: `engineering-team/audits/deploy-safety-gate/book.md`
- ADR: `engineering-team/decisions/deploy-safety-gate/0002-safe-to-merge-check-script-and-shared-recipe.md`
- Test plan: `engineering-team/stories/deploy-safety-gate/2-cycle-safe-to-merge-check.test-plan.md`
- Review: (filled in after Review phase)
