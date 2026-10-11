# Review: Story 1 — The hub's Duty Menu and Your Assistant's Treasure Map cards, as placeholders

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-11
**Diff:** `git diff d9e632e2^...e3e436e6`: four commits, the failing tests (`d9e632e2`), two test re-aims
(`0bd08ec5`, `82d660e2`) and the implementation (`e3e436e6`). The production change is `e3e436e6`.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`: **PASS**.
  `20261011T163902Z-12910-0236 [review] started 2026-10-11T16:39:02.405Z on e3e436e6 — PASS, exit 0, 5599 passed, 0 failed, 582 skipped, 299/299 suites`.
  - Compared with the Test-Design baseline (`20261011T153551Z-6371-269c`, 5587 / 0 / 582, 298 suites), this is the 12
    new tests and one new suite, with the same skips.
  - Nothing was listening on `:7778` during the run (checked first). See Harness friction 2 for why that matters.
- [x] Playwright:
  - **Local build:** 176 passed, 3 skipped, 0 failed, on chromium, across the eleven hub-related specs
    (`assistant-management-page`, `assistant-alert`, `assistant-outbox-relays`, `assistant-trusted-content`,
    `assistant-profile-check`, `assistant-identification-tags-page`, `assistant-attention`,
    `assistant-profile-checklist-page`, `assistant-taggings-publish`, `setup-alert`, `my-assistant-page`). The build
    was served on `:7799`. The 3 skips are the B8 placeholder checks of the three built pages, skipped as before.
  - **Live staging** (`BRAINSTORM_BASE_URL=https://staging.brainstorm.world`, deploy run 607 for `e3e436e6`,
    success): `assistant-management-page.spec.js` B1, B8 `/assistant/duty-menu`, B8 `/assistant/treasure-map`, B11
    and B12. **5 passed.**
  - **Staging by hand:** `/assistant`, `/assistant/duty-menu` and `/assistant/treasure-map` each answer 200
    `text/html`. The served bundle `assets/index-_gp3fstm.js` contains the new planning notes and both addresses.
- [x] `npx vite build` (in `ui/`): succeeds.
- [x] `bash scripts/harness-lint.sh`: clean (0 violations).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has a passing test (test plan § Coverage map, re-checked).
  - **AC-1:** C1 and C2, D2, and the browser B1 and B5.
  - **AC-2:**
    - C3, W1 and W2;
    - B8 for both addresses, locally and on staging;
    - B11, which types each address in and refreshes it;
    - H1 is a guard that skips without a stack.
  - **AC-3:** C4–C8, the browser B1/B2/B4, `assistant-alert` B1/B5/B6 (the pill reads 13), and the re-aimed
    `assistant-attention` B1–B5.
  - **AC-4:** S1, S2, and the unchanged words, links, notes and FAQ checks in D3–D5 and D10.
- [x] No criterion is silently dropped.
- [x] No behaviour added beyond the story. Both entries are data only, with no `editLink`, and neither key is in
  `CHECKED_ACTIONS`.
- [x] **Copy, verbatim.** I checked by script that every quoted phrase in story § Copy (both descriptions, both
  planning notes) appears exactly in `ui/src/pages/assistant/actions.js`. C2 pins the titles. The ADR's
  Implementation-notes snippet writes the Duty Menu description with `\'`; the code uses a double-quoted string. The
  words are the same.

## ADR adherence

- [x] **The files changed are exactly ADR 0001 § Implementation notes 1–2:**
  - `ui/src/pages/assistant/actions.js:87-106`: the two entries, after `outbox-relays`, before
    `trusted-assertions` (sub-decisions 1–4). The keys are `duty-menu` and `treasure-map`. The paths are built from
    `ASSISTANT_MANAGEMENT_PATH`. `alertCriteria: null`, the approved `planningNotes`, no `editLink`.
  - `actions.js:3-4, 19-23`: the header names thirteen actions and adds this story's § Copy (sub-decision 5).
  - `ui/src/pages/assistant/ActionPage.jsx:12-13` and `ui/src/App.jsx:335`: the count-free comments
    (sub-decision 5). No test covers these, as the test plan said; checked by reading.
- [x] `CHECKED_ACTIONS` (`actions.js:270`) and `assistantAttention()` are unchanged. `actions.js` keeps its one
  import. `Index.jsx`, `ActionPage.jsx`'s markup, the routes, `styles.css` and the server are untouched.
- [x] No new dependencies.

## Concept-graph integrity

- [x] No concept handles are introduced. The story's only concept, `39998:<TA>:nostr-user`, is unchanged.
- [x] No concept definitions changed, so no firmware reinstall is needed (ADR 0001 § Consequences).
- [x] Not applicable: no code reads the graph.

## Things tests can't catch

- [x] No secrets. No debug logging. No commented-out code.
- [x] Error paths: none new. The entries are static data, and the placeholder page and the marks already handle
  `alertCriteria: null`.
- [x] Concurrency: not applicable.
- [x] Security:
  - no input, no request, no signing;
  - the attention answer cannot promote either card to Done (C6, which tries a forged `done: true` answer);
  - no hardcoded TA pubkey.
- [x] **Layout:** five cards in the persona section do not scroll sideways at 375 px (B12, on staging).
- [x] **Key choice:** `treasure-map` is unambiguous inside the hub's namespace, because the attention answer is always
  about the viewer's own Assistant. The person's own Map stays at `/treasure-map` (S2). This holds as ADR
  sub-decision 2 argues; nothing in the diff contradicts it.

## House rules check

- [x] Concept Graph API authority respected (nothing reads it).
- [x] No new lint/typecheck/build tooling.

## Product-guide adherence *(when the story traces to a PRD)*

Not applicable. The book has no PRD (it has an acceptance frame).

## Findings

### Blocking

None.

### Non-blocking

1. **`tests/brainstorm/assistant-attention.spec.js:172-221`:** the hub and pill counts are still literals (now 12/13
   and 11/12/11/7/11), so every new hub card needs this edit again, and it is easy to miss (it was missed here).
   Optional improvement, for whichever book adds the next card: derive them from the fixture (the placeholders are
   `X.ACTIONS` minus the checked actions), as `assistant-profile-check.spec.js:40` already does.
2. **Order of operations.** The implementation reached `staging` and its deploy before this review, not after as
   agreed at intake. The environment's stop hook asked for a push at three turn ends. The session rebased onto two
   docs-only commits from the parallel `duty-menus-and-self-maps` session, re-ran the affected suites (green) and
   pushed (`e3e436e6`). Nothing reviewed here would have changed had the push waited: this review finds nothing
   blocking. Recorded on the existing ledger row (Harness friction 3).
3. **Test Design missed two browser pins.** These are the two `test:` re-aim commits made during Implementation. Both
   are correct: the only change is +2 cards or +2 counts, Outbox Relays stays the third persona card, and no assertion
   was weakened. Both are recorded in the test plan's § Verification amendment. Under the harness rule the
   Implementer may not edit tests to pass them, and here the edits went through Test Design as separate commits ahead
   of the implementation commit, as they should.

### Harness friction

Each item is recorded on an existing `meta` ledger row as a new occurrence. None needed a new row.

1. **The re-aim grep stopped at `test/` and at names, and missed browser specs that pin the hub by value.** Recurs:
   OPEN.md row `2026-09-21-adr-reaim-list-misses-outcome-asserts`, occurrence appended.
2. **Any HTTP responder on `:7778` makes the live tiers run.** A throwaway UI server there turned a green tree into 15
   failures across 8 unrelated suites. Variant of OPEN.md row `2026-09-20-live-tier-fails-on-stale-stack`, occurrence
   appended.
3. **A session on `staging` must choose between pushing red tests and holding commits against the stop hook.** Recurs:
   OPEN.md row `2026-10-07-staging-sessions-push-red-tests`, occurrence appended.

## Verdict

**PASS**

The diff is the ADR's two entries and three comment edits, and it matches the story's approved copy word for word.
Every acceptance criterion is covered and passing: the full Node gate, 176 browser tests locally, and the key hub specs
against live staging. Nothing blocking was found.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed (result in the chat, not here). `/close-book` offered if the book looks complete.
