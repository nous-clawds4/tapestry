# A re-aimed case that is stale can hide inside a test that fails on its other cases

**Id:** 2026-10-12-stale-case-hides-in-failing-test
**Type:** meta
**Opened:** 2026-10-12 (`assistant-duties-settings` book close, retro P5; review round 1 note 4, round 2 note 2)
**Status:** OPEN
**Done:** —

**What happened.** House style collects many cases into one test (`wrong.push(...)`, then one assert). In round 2 of
`assistant-duties-settings` #1, R3's "duplicate" case still used `30382::`, which the amended rule refuses as `bad-key`
before it can be a duplicate. At Test Design, R3 failed on its other, correctly re-aimed cases, so the red run looked
right and the stale case was invisible. It surfaced in Phase 4, when R3's other cases went green. The fix (`903c10e98`)
was then made in the Phase-4 session.

That was this book's third test edit outside Phase 3. All three were disclosed in their own commits and both reviews
judged them genuine, but the pattern is what the failing-tests-first contract is meant to prevent.

**Fix shape.** Add to `engineering-team/workflows/3-test-design.md` step 5, for a re-aim round:
- the verification lists each re-aimed *case*'s own outcome, not only each test's;
- or the Tester runs the suite once against a stub that makes the other cases pass.

**Pointer:** `engineering-team/stories/assistant-duties-settings/1-the-assistant-duties-tab.md` § Deviations;
`engineering-team/reviews/assistant-duties-settings/1-the-assistant-duties-tab.md` (round 2 note 2).
