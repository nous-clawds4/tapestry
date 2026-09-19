# Test Plan: Story 1 — Harden and restrict an admin computation endpoint

**Story:** `engineering-team/stories/compute-endpoint-hardening/1-harden-and-restrict-compute-endpoint.md`
**ADR:** none — Architecture skipped as obvious (Bug lane, Standard).
**Date:** 2026-09-19

> **Generic only (SECURITY.md).** Names neither the endpoint nor the vulnerability class. The test file
> itself necessarily encodes the specifics and is held with the branch until the fix ships.

## Coverage map

| Criterion | Test | Level |
|---|---|---|
| AC-1 (crafted input rejected before execution) | `A1` | integration (subprocess spies) |
| AC-2 (subprocess invoked without a shell; input a discrete argv element) | `A2` | integration |
| AC-1 secondary (malformed secondary param not passed through) | `A3` | integration |
| AC-3 (unauthenticated request rejected) | `B1` | integration (middleware) |
| AC-4 (happy path still runs) | `A2` (valid input still invokes the program) | integration |
| AC-5 (dead duplicate removed) | covered by the gate staying clean (nothing loads it) | `npm test` |
| AC-6 (gate clean) | `npm test` overall | whole registry |

File: `test/harden-compute-endpoint.test.js`, registered in `test/registry.js`.

## Approach
Two hermetic surfaces, no live stack:
- **Handler** — `child_process` is intercepted before the handler loads, so the test asserts *what it
  tries to run* without running anything (this also makes it safe to feed a crafted value: the spy
  records, never executes). A crafted parameter must be rejected before any spawn; a valid parameter
  must be invoked via an argument vector (execFile/spawn), never a shell string, with the parameter as
  a discrete argv element.
- **Middleware** — `authMiddleware` is called directly with a remote (proxied) unauthenticated GET to
  the endpoint path; it must reject (401/403) and not call `next()`.

## Verification
Red on current code, confirmed 2026-09-19 (Node 22): `0 passed, 4 failed`. A1's failure shows the
handler reaching subprocess execution with the crafted value (the spy captured it, unexecuted); A2
shows a shell-string invocation; B1 shows the middleware calling `next()` for the unauthenticated GET.
All four fail for the behaviour under test, not import/typo errors.

## How to run
```
npm test
```
One suite in isolation:
```
node -e "require('./test/harden-compute-endpoint.test.js').run().then(r=>console.log(r))"
```
