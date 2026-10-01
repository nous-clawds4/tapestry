# Story my-assistants #4's N7 catches a stale NIP-05 verdict only when it sits right after the new identifier, so a render that keeps the claim beside "Checking…" passes

**Id:** 2026-10-01-nip05-transition-test-misses-kept-claim
**Type:** cleanup
**Opened:** 2026-10-01 (my-assistants #4 review, round 2, non-blocking 4)
**Status:** OPEN
**Done:** —

**What was seen.** N7 (`tests/brainstorm/my-assistants-nip05.spec.js`, the change-log test for a NIP-05 that changes
under a drawn row) matches a verdict word *directly after* the new identifier. A mutant that renders "ava@new.example
Checking… Not valid", showing the old verdict next to "Checking…" for the whole hold, passed every test. The
shipped code can't produce that: `useNip05Status` returns one status per key (ADR my-assistants/0004 Amendment 1).
The realistic regressions (dropping the key match, dropping the no-NIP-05 guard, the section on an old hook) are all
caught. So this is test strength, not a live defect. The ADR's and the test plan's "fails on any verdict beside an
unchecked NIP-05" describe N7 more strongly than it is.

**Fix shape.** In N7, require that no verdict word appears anywhere in a row or section item whose NIP-05's check is
still held, not just right after the identifier. Add the keeps-the-claim mutant to the test plan's table. Test-only;
it needs a Tester pass and a short review, no implementation change. This is the "mutant that keeps X" the row
`2026-10-01-honest-states-pinned-per-state` already asks for.

**Pointer:** `engineering-team/reviews/done/my-assistants/4-nip05-validity-and-profile-links.md` § Re-review, round 2
(NB4); `engineering-team/stories/done/my-assistants/4-nip05-validity-and-profile-links.test-plan.md` § Amendment after
review 1.
