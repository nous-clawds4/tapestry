# Four My Assistant page behaviours are checked only by the browser class, which CI does not run

**Id:** 2026-09-21-my-assistant-checks-browser-only
**Type:** cleanup
**Opened:** 2026-09-21 (assistant-profile #4 review, non-blocking 1)
**Status:** DONE
**Done:** 2026-09-21 (assistant-profile #5 Phase 3, `069ca3de`; #733, promoted by #735) — W17–W20 in `test/my-assistant-page.test.js`
are the CI-run counterparts of B1, B11, B12 and B16; each fails against the defect review 4 planted for its B-test.
Line 24 of story 4's test plan is reworded.

The code is correct today. The gap is that CI would not notice a regression. The review planted each of
these single edits, and each one passed every Node suite. Each was caught only by
`tests/brainstorm/my-assistant-page.spec.js`:

- the page ignores `hasMyAssistantPage` (`ui/src/pages/assistant/Index.jsx:36`) — caught by B11;
- the page drops its visitor branch (`:25`), so a visitor gets no sign-in button — caught by B1 (AC5);
- the page passes a no-op as `onAssistantCreated` (`:53`), or `refreshUser` keeps the old `assistantPubkey`
  (`ui/src/context/AuthContext.jsx:167`) — caught by B12;
- `&&` becomes `||` in the "no picture" condition (`ui/src/components/AssistantProfileEditor.jsx:147`), so
  every 404 reads "you have no profile picture" — caught by B16 (AC4).

The W-cases stop short:

- W14 checks that the page imports `hasMyAssistantPage`, not that the page's check uses it;
- W9 accepts the `||` form;
- W11 and W12 check neither the page's wiring nor what `refreshUser` sets.

The test plan's line 24 calls the W-class "the CI-enforced backstop for the B-class". That overstates it, one
story after `2026-09-21-status-no-key-relay-gate-unpinned` closed the same class of gap for story 3.

Fix shape (Tester's lane; story 5 touches the same files):

- Add W-cases with the suite's existing JSX helpers:
  - the editor renders only after the `!user` branch and under `hasMyAssistantPage(user)`;
  - `onAssistantCreated={refreshUser}`;
  - `refreshUser` sets `assistantPubkey` from `data`;
  - the "no profile picture" copy is guarded by `body.code === 'no-picture'` together with the 404.
- Reword line 24 of `engineering-team/stories/done/assistant-profile/4-my-assistant-page.test-plan.md`.

**Pointer:** `engineering-team/reviews/done/assistant-profile/4-my-assistant-page.md`, non-blocking finding 1 (with
the mutant tables).
