# Phase 3: Test Design

## Role
Tester. See `engineering-team/roles/tester.md`.

## Input
- An approved user story.
- An approved ADR.

## Output
1. A test plan at `engineering-team/stories/<epic-slug>/<n>-<slug>.test-plan.md` (same epic folder as the story).
2. Failing tests committed to the project's test directory (`test/`, `tests/`, or Playwright structure).
3. Verification: `npm test` runs and the new tests fail for the right reason.

## Steps

1. **Map every acceptance criterion to at least one test.** If a criterion can't be tested, push back to PO/Architect.
2. **Decide test levels.**
   - Concept-graph behavior → integration tests against the live API at `localhost:$TAPESTRY_PORT` (port per AGENTS.md §1) when the stack is running; otherwise dependency-injected tests (the pattern recent stories actually use), with skipped live suites noted in the plan.
   - Pure functions/utilities → unit tests in `test/`.
   - Browser/UI flows → Playwright tests via `playwright.config.js`.
3. **Use the project's testing approach:** Node's built-in runner + Playwright. No new test frameworks without an ADR.
4. **Write failing tests.** Test names should describe behavior in plain language.
5. **Run `npm test`** (or relevant subset). Confirm the tests fail — and that they fail because the feature isn't implemented, not because of a typo or import error. For a full run, read the result per [Running and reading the test gate](../README.md#running-and-reading-the-test-gate).
6. **Show plan + diff.** Iterate to approval.
7. **Gate:** "Test plan approved and tests fail correctly? Ready for Implementation?"
8. Hand off to `/implement-feature`.

## Common pitfalls
- Testing implementation details that the spec doesn't constrain. Brittle.
- Single happy-path test. Edge cases need explicit tests too.
- Skipping the "confirm the test fails" step. A test that doesn't actually fail tells you nothing.
- Tests that depend on graph state without saying so. Document prerequisites (`POST /api/firmware/install`, etc.) in the test plan.
- A test that asserts something did *not* happen ("nothing runs", "no shell", "never shows X") also passes when the code under test returns early. Pair it with an assertion that the path under test ran (the handler answered, the call was reached), and set up whatever that path needs: config, an owner, a fixture (audit `admin-action-owner-check` §7 #3).

## Per-phase commits
Yes. Commit the failing tests before moving on. The commit message should make clear these are intentionally failing (e.g., `test: failing tests for <slug> (<epic> #<n>)` — the slug/epic reference feeds `harness-stats.sh`, per workflow 1).

**On a feature branch, never on `staging` or `main`.** `.github/workflows/test.yml` runs the gate on every pull request into `staging` or `main`, against the merged tree. A failing test on either branch therefore turns every open PR into it red, and every book that lands there in the meantime inherits the failure. Commit the failing tests on `feat/<book-slug>`, branched off an up-to-date `staging`, and reuse that branch if the book already has one. The story's implementation and review commits go on the same branch, and the branch reaches `staging` by PR after the Review PASS (`/cycle-staging`). The rule holds in Direction mode too, where `/direct-feature` already names the branch.

**If your session's designated branch is `staging`, you may create and push that feature branch.** The owner has given this permission standing (2026-10-14), so don't stop to ask. Don't push the failing tests to `staging` instead. Don't hold them back to push with the implementation either: `staging` deploys on push, so the implementation would reach it before its Review (ledger row `2026-10-13-staging-pinned-session-vs-failing-tests`).
