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

**Update 2026-10-01 (my-assistants #4 review 1, harness friction 1): a third axis, the transition.** Story 4's plan
listed every surface for each forbidden claim, as this row asks: the list and the section, on N2 and N3. It still
missed one case: a surface already showing an answer whose input changes under it. A drawn row's NIP-05 changed on a
refresh, and the old verdict showed beside the new identifier for one render (NB1). Sampling can't see a one-render
flash; a change log can (a MutationObserver recording every DOM state, story 4's N7). So for a "never claim X
while…" rule, also pin the transition where a drawn surface's input changes, with a change-log assertion. The
test-design note that a held answer plus sampling beats a change log is true for held states, not for transitions.

**Pointer:** `engineering-team/reviews/my-assistants/3-the-treasure-map-on-the-page.md` § Harness friction 1 and
blocking 1; the test plan's § Amendment after review 1.
