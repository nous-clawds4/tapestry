# Story 1: Harden and restrict an admin computation endpoint

**Status:** Draft
**Created:** 2026-09-19
**Type:** Bug

> **Disclosure discipline (SECURITY.md; OPEN.md rows 276, 278) — strict.** The repo is public and this
> defect is live and unpatched. This file is **generic only** — it names neither the endpoint, the
> vulnerability class, nor the repro. Those are held out-of-band in an operator-held private note and
> passed to each phase directly. The regression test and the fix diff necessarily encode the specifics,
> so the branch stays **local** until the operator approves the PR. See
> `engineering-team/audits/compute-endpoint-hardening/book.md`.

## Background
An admin computation endpoint takes a client-supplied parameter and uses it to run a server-side
program. Two problems compound: the parameter is passed into subprocess execution without strict
validation or shell-free invocation, and the endpoint — which is intended for the instance owner — is
reachable without owner authentication on public deployments. Together these let an unauthenticated
caller influence what runs on the server. A dead duplicate of the endpoint's command module also
exists in the tree (loaded by nothing) and carries the same shape.

## User-facing description
As the operator of a Brainstorm deployment, I want an admin computation endpoint to accept only
well-formed input, run its program without a shell, and refuse callers who are not the owner, so that
a remote party cannot influence server-side execution through it.

## Acceptance criteria
Testable from the outside. Each criterion gets at least one test.

- [ ] Given a request whose parameter contains anything other than the strict expected form, when the
      endpoint is called, then the program is **not** run with that value (rejected before execution).
- [ ] Given the subprocess is invoked, then it is invoked **without a shell** (argument vector form),
      so shell metacharacters in any input are inert.
- [ ] Given an **unauthenticated** request (no owner session), when the endpoint is called, then it is
      **rejected** (not the owner → no execution), on the same deployment topology where it is
      currently reachable.
- [ ] Given a valid owner request with a well-formed parameter, the endpoint still performs its
      intended computation (no regression of the happy path).
- [ ] The dead duplicate command module is removed, with no behaviour change on any reachable path.
- [ ] The full test gate (`npm test`) is clean after the change.

## Concepts touched
None. Server-side endpoint hardening; no concept-graph concept, handle, or firmware definition.

## Out of scope
- Any broadening of the shared auth middleware's endpoint matching (e.g. making the owner-list apply
  to all methods) — that could change access for unrelated routes; this story gates the one endpoint
  in-handler.
- Other findings from the same sweep, if any — separate stories.

## Open questions
- None blocking. Input-format specifics and the exact gate location are in the out-of-band note.

## Linked artifacts
- ADR: none — Architecture skipped as obvious (Bug lane, Standard; `workflows/0-intake.md` step 3).
- Test plan: `engineering-team/stories/compute-endpoint-hardening/1-harden-and-restrict-compute-endpoint.test-plan.md`
- Review: (filled in after Review phase)
