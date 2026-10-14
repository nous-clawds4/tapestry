# A browser test that says "this page never requests X" fails on requests the app shell makes on every page

**Id:** 2026-10-14-negative-request-assertions-need-shell-baseline
**Type:** meta
**Opened:** 2026-10-14 (book `about-this-instance` close, retro)
**Status:** OPEN
**Done:** —

**What was seen.**
- Test B5 (`tests/brainstorm/about-this-instance.spec.js`) required that `/about` make none of four "forbidden" reads.
- It failed against a correct implementation because `AssistantRosterProvider` (`ui/src/App.jsx`, around every page) reads `/api/assistant/roster` on every page load.
- Fixing it cost a kick-back to the Tester, an operator decision, and changes to the story's AC-4, an ADR amendment and the test plan.
- The re-aimed test counts each read on the page and on a page with the same shell but without the feature, and requires the counts to be equal.

**Fix shape.** One line in workflow 3's "Common pitfalls", beside the existing "a test that asserts something did not happen" item: a negative assertion about a page's network requests must baseline against the app shell (the same shell without the feature, compared per endpoint), because shared providers fetch on every page. An alternative is a short list of the shell's own requests kept in a shared test helper.

**Pointer:** `engineering-team/stories/done/about-this-instance/1-owner-admins-customer-count.test-plan.md` Amendment 1; audit §7.
