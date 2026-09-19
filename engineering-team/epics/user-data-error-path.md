# Epic: user-data-error-path

**Created:** 2026-09-18
**Status:** Open
**Book:** `engineering-team/audits/user-data-error-path/book.md` (acceptance-frame)
**Provenance:** Operator request, 2026-09-18 in-session. A user-data handler mishandles one error
path; the handler and three neighbouring identifiers were found in a single read-only
undeclared-identifier sweep of `src/`. The specifics are held out-of-band (SECURITY.md; the error
path is live and unpatched on a public deployment) — see the book for the disclosure discipline.

## Goal

Harden the mishandled error path in a user-data handler so the failure produces a well-formed `500`
JSON response and leaves the process running, pinned by a regression test. Tidy three neighbouring
undeclared identifiers with no behaviour change. Raise — but do not decide — whether the server
entry point should adopt a global unhandled-rejection / uncaught-exception policy.

## Stories (planned at kickoff)
`stories/user-data-error-path/`:
1. `1-harden-user-data-error-path.md` — harden the error path (regression test + one-identifier fix),
   fold in the three neighbouring identifier tidies, and record the process-level policy question for
   the operator. Bug, Standard (Architecture skipped as obvious).

## Key facts / guardrails
- **Public text is pointer-level only.** No mechanism, file:line, endpoint or repro in any tracked
  file or commit until the fix is deployed. The story, test plan and review name the behaviour, not
  the trigger.
- **Branch stays local until the ship gate.** OPEN.md row 278: an open fix PR on a public repo is
  itself a disclosure window. Push → merge → staging smoke → promote → production smoke run back to
  back once the operator approves.
- **Follow-on doc lane.** Closing row 325 and correcting `docs/SMOKE_TEST.md` / `OPERATIONS.md` §9.5
  / the 2026-09-18 intake entry happens only after the fix is live, through its own doc-lane review.
