# Book setup-status-and-alert closed with five small soft spots in its tests and one stale comment

**Id:** 2026-09-22-setup-book-test-soft-spots
**Type:** cleanup
**Opened:** 2026-09-22 (book `setup-status-and-alert` close, gathered from its three reviews)
**Status:** OPEN
**Done:** —

The code is right in every case. Each item is a check that could miss a regression, or a comment that points at the
wrong row. The larger one, story 2's "no pill" checks, has its own row: `2026-09-22-setup-alert-no-pill-checks-early`.

1. **S3 false-positives, and a `//` inside a string hides the rest of its line.** `test/setup-alert-polish.test.js`
   S3 fails on an `announce` that sets no publish option:
   - a named import, `import { announce } from '…'`;
   - a destructure, `const { announce } = props`;
   - a method call, `liveRegion.announce('Saved')`. A screen-reader live-region helper is a likely name in this area.

   `withoutComments` drops everything after a `//` that no colon precedes, so an `announce: false` after
   `'//cdn…'` on the same line passes. The false positives fail loudly, not silently.
   (story 3's review, round 4, Non-blocking 2)
   - **Fix shape:** narrow the member and shorthand forms to a publish call's arguments, or say so in the comment.
2. **The pill-log check in `expectHeldRecheck` is sound because of React's commit order, with no margin to spare.**
   React 19.2.4 commits the render that hides the pill before the effect that sends the re-check, so the page stamps
   the hide before `state.heldAt`. The gap measured 0–75 ms, and exactly 0 in 35 of 360 runs, which `<=` admits. An
   upgrade that flushed that effect inside the commit would make the check race on correct code. The samples would
   still catch the kept-answer mutants. (story 3's review, round 4, Non-blocking 3)
   - **Fix shape:** say so in the helper's comment, or stamp the pill's state synchronously when the re-check's
     `fetch` is called.
3. **Story 1's H2 cannot tell the two live branches apart.** It accepts either "finished and absent" or "unfinished"
   (`test/setup-status.test.js`, H2). (story 1's review, round 1, Non-blocking 3)
4. **Two gaps in story 2's browser class:**
   - B12 checks heights and scrolling only, so a rule that hid the whole brand would pass, and nothing pins ADR 0002
     Amendment 1's "the 🧠 stays";
   - B7 leaves out `/settings` (`.bss-top-bar`) and the results view below 1280 px.

   The reviewer's own sweep covered both. (story 2's review, Non-blocking 5)
5. **`src/api/_shared/relaySource.js:225` cites "OPEN.md row 280".** That row is 314 since the 2026-09-17
   renumbering. It predates this book. (story 1's review, round 1, Non-blocking 7)

**Pointer:** `engineering-team/audits/setup-status-and-alert/audit.md` §6 #10; the three reviews under
`engineering-team/reviews/done/setup-status-and-alert/`.
