# A doc test that pins which Last-updated entry is newest breaks at the next story, and steers its wording meanwhile

**Id:** 2026-09-29-newest-entry-doc-tests-go-stale
**Type:** meta
**Opened:** 2026-09-29 (tagging-edges #3 review, harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** Story 2's contract test S2C16 (`test/tagging-edge-contract.test.js`) asserts that BIBLE's newest
Last-updated entry, the text before the first `; prior:`, names `tagging-edges #2`. Story 3 had to write a new newest
entry. It stays green only because that entry happens to mention "(CF-3 from tagging-edges #2's review)". The
Implementer kept that wording partly to keep the test green, and reported the test for the Tester, but neither of
story 3's Test Design rounds re-aimed it. A test that pins which entry is newest goes stale at the next story that
updates the line. Until then it shapes what that story may write.

**Fix shape.**
- Re-aim S2C16 to "some Last-updated entry records tagging-edges #2 / ADR 0002", as S2C9 was re-aimed.
- In the Tester's guidance (`engineering-team/workflows/3-test-design.md`), write doc tests as "an entry records X",
  never "the newest entry is X".

**Pointer:** `engineering-team/reviews/tagging-edges/3-real-time-path.md` § Harness friction 1; story 3 § Deviations
(Docs, first line).
