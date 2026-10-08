# A brand-new browser spec can't run before its page exists, and nothing says who ratifies the Phase-4 fixes it needs

**Id:** 2026-10-08-new-browser-spec-amendments-unratified
**Type:** meta
**Opened:** 2026-10-08 (treasure-map-edit #3 review, harness friction 1)
**Status:** OPEN
**Done:** —

treasure-map-edit #3's Test Design wrote a new Playwright spec (`tests/brainstorm/treasure-map-edit.spec.js`) for a page
that didn't exist yet. Phase 3 could only check that it failed, not that its locators were right. When the page landed
in Phase 4, three of the spec's own faults showed up:

- two `has` filters rooted at `main` or `section` never matched;
- E7 clicked a toggle that an open list covers;
- E9 picked the card's current Assistant, which AC-2 says cancels the change.

The Tester's role fixed them in a separate commit (`5f46f81`), recorded as Amendment 1 in the test plan. The plan said
a fault "kicks it back here", but not who approves the amendment, so it was self-ratified.

This is a different cause from `2026-10-07-neighbour-suite-duplicate-roles`, which is about old suites colliding with
new UI.

**Fix shape.** In `engineering-team/workflows/3-test-design.md`, say that a spec for a page not yet built carries a
Phase-4 locator-fix allowance: fixes that keep each test's intent and weaken no assertion. They are recorded as a dated
amendment in their own commit, and the Reviewer ratifies them by auditing that amendment. A fix that changes what a
test asserts still goes back to the owner.

**Pointer:** `engineering-team/reviews/treasure-map-edit/3-edit-mode-assign-and-preview.md` § Harness friction 1;
`engineering-team/stories/treasure-map-edit/3-edit-mode-assign-and-preview.test-plan.md` § Amendment 1.
