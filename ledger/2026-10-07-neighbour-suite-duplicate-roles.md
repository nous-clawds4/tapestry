# Test Design checked a neighbour suite against old code only, so it missed that new UI would duplicate its page-wide queries

**Id:** 2026-10-07-neighbour-suite-duplicate-roles
**Type:** meta
**Opened:** 2026-10-07 (manage-treasure-map #2 review 1, Harness friction 1)
**Status:** OPEN
**Done:** —

manage-treasure-map #2 added a cards section that shows the same loading line, error line and **Try again** as story
1's raw viewer on the same page. Story 2's test plan promised story 1's suites would stay green "unchanged", and its
Phase-3 verification ran them against the *old* code, which can't reveal the duplication. In Phase 4 the Implementer
found four story-1 browser tests (T5, T5b, T6, T13) would now match twice under Playwright's strict mode, and narrowed
them to the raw viewer in a separate test-only commit (`f393b21`). That was well recorded, but it is a test re-aim made
in Phase 4, which `engineering-team/templates/adr.md` puts in Phase 3, and it was self-ratified.

**Fix shape.** When a story adds UI that repeats an existing page's words or ARIA roles (`status`, `alert`, a same-named
button), Test Design greps the neighbour suites for page-wide queries of those words and roles, and either pre-scopes
them in Phase 3 or lists them in the test plan as Phase-3 re-aims. A line in `engineering-team/workflows/3-test-design.md`
§ Common pitfalls would carry it.

**Seen again, 2026-10-08 (treasure-map-edit #3).** This time Test Design did grep the neighbour suites for the story's
new words and wiring (Edit, Save changes, `useConfig`, signing), and re-aimed four tests in Phase 3. It still missed a
*structural* assertion: `test/manage-treasure-map-cards.test.js` S3 requires exactly one `<pre>` on the page, and the
story's ADR adds a second one (the edited raw viewer). Phase 4 found it, and the Tester amended S3 in a separate commit,
recorded as Amendment 1 in that story's test plan. So the grep should cover structure the ADR adds (element counts,
new landmarks or regions), not only words and roles.

**Pointer:** `engineering-team/reviews/done/manage-treasure-map/2-the-assistants-by-category-cards.md` § Harness friction;
`engineering-team/stories/done/manage-treasure-map/2-the-assistants-by-category-cards.test-plan.md` § Amendment.
