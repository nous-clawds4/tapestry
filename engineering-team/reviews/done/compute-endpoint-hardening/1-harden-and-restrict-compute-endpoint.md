# Review: Story 1 — Harden and restrict an admin computation endpoint

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-19
**Diff:** `git diff origin/staging..HEAD` (base `94fc855e` = staging tip = merge-base; HEAD `6f01af36`)

> **Disclosure discipline (SECURITY.md; OPEN.md rows 276, 278) — strict.** This review is **generic
> only**: it names neither the endpoint, the vulnerability class, nor a repro. The fix diff and the
> regression suite necessarily encode the specifics and stay local with the branch until the operator
> ships. Mechanism-level detail was verified out-of-band and reported to the operator directly, not
> written here.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. Faithful stack-free CI gate (Node 22, `--network none`, git present):
      `20260919T062140Z-22-64f4 started 2026-09-19T06:21:40.539Z on 6f01af36 — PASS, exit 0, 2856 passed, 0 failed, 522 skipped, 206/206 suites`.
      The new regression suite reports `harden-compute-endpoint: PASS (4 passed, 0 failed, 0 skipped)`.
- [x] Regression suite red-for-the-right-reason confirmed: against the pre-fix handler + middleware
      (`44abda5e`), the suite is `0 passed, 4 failed`, every failure behavioural (crafted value reaches
      execution; shell-string invocation; malformed secondary param passed through; middleware admits the
      unauthenticated request). Tree restored clean afterward.
- [ ] `npm run test:playwright` — n/a (no browser/UI surface in this change).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test.
  - AC-1 (crafted input rejected before execution) → `A1` (pass).
  - AC-2 (subprocess invoked without a shell; input a discrete argv element) → `A2` (pass).
  - AC-1 secondary (malformed secondary param not passed through) → `A3` (pass).
  - AC-3 (unauthenticated request rejected on the reachable topology) → `B1` (pass; the mock uses a
    proxied/remote request so the direct-local trust bypass does not apply — matching the topology the
    defect is reachable on).
  - AC-4 (happy path still runs) → `A2` asserts a valid request still invokes the program with the
    parameter as a discrete argv element. See note below on E2E depth.
  - AC-5 (dead duplicate removed) → the module is gone from `HEAD` and unreferenced; the gate stays
    clean.
  - AC-6 (gate clean) → full gate PASS above.
- [x] No criterion silently dropped.
- [x] No behaviour added beyond the story.

## ADR adherence
- [x] n/a — Architecture skipped as obvious (Bug lane, Standard; `workflows/0-intake.md` step 3). No ADR
      authorized or required. No new dependencies introduced (a `child_process` import was narrowed, not
      added).

## Concept-graph integrity
- [x] n/a — no concept, handle, or firmware definition touched (story "Concepts touched: None",
      confirmed against the diff). No firmware reinstall required.

## Things tests can't catch
- [x] No secrets in committed files. The input validation is a generic hex/integer shape, not a pinned
      value; no TA pubkey literal introduced (ADR 0015 `LEGACY_*` constants untouched).
- [x] Input validation at the boundary is airtight (verified empirically): the parameter is validated to
      an exact 64-hex shape **before** any execution, which closes both the subprocess-argument vector
      and the filesystem-path-segment vector (the same value is used as a path component) — traversal
      (`../`), embedded slash, leading/trailing newline, null byte, and shell metacharacters are all
      rejected. The subprocess is then invoked via an argument vector (no shell), so metacharacters are
      inert regardless — defence in depth.
- [x] Auth gate is targeted and does not over-match: only the one route's path contains the added
      substring (confirmed by scanning all registered routes), and the middleware's matching logic is
      unchanged (`.includes` + method) — the additions are data-only, GET-scoped, and follow the same
      shape as the sibling sensitive-GET entries already present.
- [x] No new debug logging or commented-out code introduced (pre-existing operational `console.*` in the
      handler was left as-is and is out of scope).
- [x] Error paths handled; unreachable-input branches return `400` before any side effect.
- [ ] Concurrency / race conditions — n/a (no shared mutable state added).

## House rules check
- [x] Concept Graph API authority respected (no concepts involved).
- [x] No new lint/typecheck/build tooling.
- [x] No hardcoded per-deployment TA pubkey introduced.

## Findings

### Blocking
None.

### Non-blocking
1. **Approach vs. planned mechanism (auth gate).** The epic guardrail and story "Out of scope" describe
   gating the endpoint *in-handler* and caution against changing the shared auth middleware; the
   implementation instead gates it via two data-only, GET-scoped additions to the shared middleware's
   existing owner/protected lists (`src/middleware/auth.js`). This is a mechanism divergence, **not** a
   violation of the guardrail's intent: the out-of-scope item specifically named "broadening the
   matching (e.g. making the owner-list apply to all methods)," which the change does **not** do — the
   matching logic is untouched and there is no over-match (verified). The chosen approach matches the
   established pattern for sibling sensitive GETs and the security outcome is correct. Recommend the
   operator reconcile the epic/story wording with the shipped approach (or explicitly bless it) so the
   record isn't self-contradictory.
2. **Commit-boundary slip.** The dead-duplicate deletion landed in the test-interception commit
   (`f4b52949`) rather than the impl commit (`6f01af36`). The **net** diff vs `origin/staging` is
   correct regardless (module absent from `HEAD`, both source fixes present, nothing references it).
   Cosmetic history only; the operator may wish to squash on merge.
3. **Stale historical reference.** A prior epic's review
   (`engineering-team/reviews/user-data-error-path/1-harden-user-data-error-path.md:49`) contains a
   `file:line` pointer into the module deleted by this story. It is a historical record of that review
   and needs no change; noting it only so the dangling pointer isn't mistaken for a live one.

### Harness friction
1. Base-ref ambiguity in the task brief (a candidate base that was not the actual merge-base). Confirmed
   independently: the branch's merge-base is the current staging tip (`94fc855e`), so
   `git diff origin/staging..HEAD` is the correct scope. Non-blocking; recorded for the record.

## Verdict
**PASS**

## On PASS (same commit)
- [ ] Story `**Status:**` intentionally **not** flipped and this file intentionally **not** committed —
      per the operator's instruction (branch is held local under the book's disclosure discipline; the
      operator commits and ships). Completion detection: the book's acceptance frame is satisfied by
      what shipped, but closing is the operator's call at ship time — not offered here.
