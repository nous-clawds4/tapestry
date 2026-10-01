# A test plan pinned each "never claim X while…" state once, not on every surface that can show X, so one surface went untested

**Id:** 2026-10-01-honest-states-pinned-per-state
**Type:** meta
**Opened:** 2026-10-01 (my-assistants #3 review 1, harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** Story my-assistants #3's AC-7 forbids any status, count or duty claim while the Treasure Map is read
or after a failed read. The claim can appear on four surfaces: a row's status line, an open row's panel, the
not-tagged section and the Duties tab. The test plan pinned the row line, the count and the Duties tab, each with a
mutant, but not the open panel. The Implementer then logged the panel's (correct) behaviour as a judgment call, and
nothing caught the gap until the Reviewer's mutant (the panel's two guard lines deleted) passed every suite. Round 2
added the panel to M3 and M4, with that mutant and a "keeps the claim" mutant.

**Fix shape.** In workflow 3, or the test-plan template: for each acceptance criterion that forbids a claim in a
state, list every surface that can render the claim, and pin each one with its own mutant. Same family as row
`2026-10-01-test-plan-credits-unpinned-behaviour` (a plan's prose credits a test with behaviour it doesn't pin) and the
test-design note that a "never shows X while loading" check needs a held answer, sampling, and a mutant that keeps X.

**Pointer:** `engineering-team/reviews/my-assistants/3-the-treasure-map-on-the-page.md` § Harness friction 1 and
blocking 1; the test plan's § Amendment after review 1.
