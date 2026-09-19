# Story 1: Harden an error path in a user-data handler

**Status:** Draft
**Created:** 2026-09-18
**Type:** Bug

> **Disclosure discipline (SECURITY.md; OPEN.md rows 276, 278).** The repo is public and this error
> path is live and unpatched. This file is **pointer-level only** — it names the behaviour, never the
> mechanism, the file:line, the endpoint that triggers it, or the repro. Those are held out-of-band in
> an operator-held private note and passed to each phase directly. The regression test and the fix
> diff necessarily encode the mechanism, so the branch stays **local** until the operator approves the
> PR, and push → merge → staging smoke → promote → production smoke run back to back. See
> `engineering-team/audits/user-data-error-path/book.md`.

## Background
A handler that returns user data mishandles one of its error paths. When the datastore it reads from
is unreachable, the handler's failure branch does not send the intended `500` response; the failure
escapes the handler instead of being contained. On the affected deployment topology this failure is
reachable and its blast radius is larger than the single request. The defect and three neighbouring
undeclared-identifier slips in the same area were found in one read-only sweep of `src/`.

## User-facing description
As an operator of a Brainstorm deployment, I want a user-data handler to fail cleanly — a well-formed
error response, and a process that stays up — when its datastore is unreachable, so that a transient
datastore outage degrades one request instead of the whole control panel.

## Acceptance criteria
Testable from the outside. Each criterion gets at least one test.

- [ ] Given the handler is invoked while its datastore is unreachable, when its failure branch runs,
      then a `500` response with a JSON body is sent to the caller (not a thrown/rejected failure that
      never answers).
- [ ] Given that same invocation, when the failure branch runs, then the process is still alive
      afterwards (the failure is contained within the handler, not surfaced as a process-level crash).
- [ ] Given the pre-fix code, the regression test above is **red** for the right reason (it observes
      the mishandled failure, not an import/typo error); given the fix, it is **green**.
- [ ] Three neighbouring undeclared-identifier references in the same area are corrected, with **no
      behaviour change on any reachable path** (each is either dead, caller-guarded, or in a module
      nothing loads — enumerated in the out-of-band note).
- [ ] The full test gate (`npm test`) is clean after the change.

## Concepts touched
None. This is a server-side error-handling fix; it touches no concept-graph concept, handle, or
firmware definition.

## Out of scope
- The separate, more-serious finding from the same sweep (a distinct route/handler): tracked
  privately, to be its own story **after** this one — operator's decision, 2026-09-18.
- The server-wide unhandled-rejection / uncaught-exception policy: **raised, not decided** here (see
  Open questions). Adopting one is a separate change once the operator chooses.
- The remaining out-of-scope undeclared identifiers found outside the handler's area
  (`src/manage/…`, `bin/…`, and a parse error in `src/pipeline/…`): one OPEN.md row after deploy.
- Closing OPEN.md row 325 and correcting `docs/SMOKE_TEST.md` / `OPERATIONS.md` §9.5 / the
  2026-09-18 intake entry: a follow-on **doc-lane** task after the fix is live.

## Open questions
- **For the operator (raise, don't decide):** should `bin/control-panel.js` (the server entry) adopt
  a global `unhandledRejection` / `uncaughtException` policy — log-and-exit, or log-and-continue — so
  that a future mishandled async failure anywhere in the request path degrades one request rather than
  dropping the process? This story hardens the one known site; the policy question is whether to add a
  backstop. To be presented with options at the appropriate gate; the decision is recorded, not made
  inside this story.

## Linked artifacts
- ADR: none — Architecture skipped as obvious (Bug lane, Standard; `workflows/0-intake.md` step 3).
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
