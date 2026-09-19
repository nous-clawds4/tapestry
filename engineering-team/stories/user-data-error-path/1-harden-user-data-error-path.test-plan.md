# Test Plan: Story 1 — Harden an error path in a user-data handler

**Story:** `engineering-team/stories/user-data-error-path/1-harden-user-data-error-path.md`
**ADR:** none — Architecture skipped as obvious (Bug lane, Standard).
**Date:** 2026-09-18

> **Pointer-level (SECURITY.md).** This plan names the behaviour under test, not the mechanism, the
> file:line, the endpoint, or the identifier. The verification output below is redacted for the same
> reason — the raw crash names the site. See the story and book for the disclosure discipline.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (500 JSON on datastore-unreachable) | `sends a 500 JSON response when the datastore is unreachable` | `test/harden-user-data-error-path.test.js` | integration (child process) |
| AC-2 (process survives) | `the process survives the datastore-unreachable failure` | `test/harden-user-data-error-path.test.js` | integration (child process) |
| AC-3 (red pre-fix for the right reason, green post-fix) | both of the above | `test/harden-user-data-error-path.test.js` | — |
| AC-4 (three neighbouring identifier tidies, no behaviour change) | covered by the full gate staying clean (no reachable path exercises them; each is dead / caller-guarded / in an unloaded module) | `npm test` | — |
| AC-5 (gate clean after fix) | `npm test` overall verdict | whole registry | — |

## Approach
The suite drives the **real** handler in a **child process** with its datastore pointed at an address
that refuses connections (a dead local port), stubbing only the config module before the handler
loads. Running in a child is what makes AC-2 observable: if the handler's failure escapes, the child
process crashes and exits non-zero, which the parent detects; if the failure is contained, the child
survives and reports the response it sent. Hermetic — no live stack, so it runs identically in CI
(stack-free) and locally.

## Edge cases
- [x] Datastore unreachable (the path under test).
- [x] Failure containment observed at the process level, not just the response level (child-process design).
- [ ] Datastore reachable but slow (the *timeout* branch) — out of scope: it already returns its
      intended status and is not the mishandled path; testing it needs a live, artificially-slow
      datastore. Noted so a reviewer knows the omission is deliberate.

## Test infrastructure
- Test framework: Node built-in runner via `node test/test.js`; the suite is registered in
  `test/registry.js` (one line, no skip note — it needs no live stack).
- Concept Graph API / stack: not required.
- Firmware state: none.
- Fixtures: the child script is generated at runtime into the OS temp dir and removed after the run;
  no tracked fixture file.

## How to run
```
npm test
```
The one suite, in isolation (used during Test Design):
```
node -e "require('./test/harden-user-data-error-path.test.js').run().then(r=>console.log(r))"
```

## Verification
The new tests fail with the current code. Confirmed 2026-09-18 at commit `3195b0d1` (Node 22, CI
parity), **output redacted to pointer-level:**

```
=== harden-user-data-error-path (user-data-error-path #1) ===
  FAIL  sends a 500 JSON response when the datastore is unreachable
        expected the handler to answer and the process to survive, but no RESULT was printed (exit=1 …)
  FAIL  the process survives the datastore-unreachable failure
        expected the child process to exit 0 (failure contained in the handler), but it exited 1 …

harden-user-data-error-path: 0 passed, 2 failed, 0 skipped
```

Both failures are for the right reason: the child reaches the datastore-unreachable branch (its error
is logged) and then the failure **escapes and crashes the process** — not an import or typo error.
The gate's registration guard (`test/stack-free-npm-test.test.js` G5) passes with the suite added.
```
