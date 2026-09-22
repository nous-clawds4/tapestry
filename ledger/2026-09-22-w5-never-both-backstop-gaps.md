# The CI backstop for "never both" (W5) has two gaps that only the browser test covers

**Id:** 2026-09-22-w5-never-both-backstop-gaps
**Type:** cleanup
**Opened:** 2026-09-22 (book `assistant-management` close; story 2's review, post-verdict check)
**Status:** OPEN
**Done:** —

**What was seen.** `test/assistant-alert.test.js` W5 is the CI-run backstop for the rule that the Setup pill
and the Assistant pill never show together (ADR assistant-management/0002 Amendment 1 point 3). It fails on
six planted defects:
- five from the fix session;
- one from the Reviewer, a guard with no `loading`.

The Reviewer found two that it misses. Browser B3 in `tests/brainstorm/assistant-alert.spec.js` catches
both, but CI runs no browser test.
1. **A conditional pill before the guard.** An `if (…) return <Link …/>` placed ahead of
   `SetupAlert()`'s early `return null` passes W5. W5 treats only an *unconditional* non-null return before
   the guard as "drawn first".
2. **This story's own wiring.** `TopBarAlert.jsx` passes `setupPendingCount: setup.pendingCount` to the
   picker. Breaking it, for example by passing `0`, leaves the whole Node suite green.

**Fix shape** (the Reviewer's): two small assertions.
- For (1), treat any non-null return before the guard, at any depth, as drawn first.
- For (2), add a W1 check that the slot passes `setup.phase` and `setup.pendingCount` to `pickTopBarPill`.
- Plant each defect once to see the new check fail.

**Pointer:** review `engineering-team/reviews/done/assistant-management/2-the-assistant-alert.md`,
§ "Post-verdict check", item 1.
