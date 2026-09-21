# An ADR's "Test-file changes" list has twice missed specs that assert the old behaviour by value

**Id:** 2026-09-21-adr-reaim-list-misses-outcome-asserts
**Type:** meta
**Opened:** 2026-09-21 (assistant-profile #5, Architecture)
**Status:** OPEN
**Done:** —

**What happened.** Twice in the assistant-profile book, an ADR's "Test-file changes" list missed specs that
assert the old behaviour by value. The Tester caught both at Phase 3.

- **Story 3.** ADR assistant-profile/0003 renamed "Surprise me" to "Use the default profile". It missed story 1's
  `tests/brainstorm/assistant-setup-prompt.spec.js` B3 and B5, which look for the old label.
- **Story 4.** ADR assistant-profile/0004 moved the dashboard prompt's destinations to `/assistant`. It missed
  story 1's B3, B4, B5 and B8 in the same spec, which assert the old destinations.

**Why it happens.** The Architect found re-aims from the files the ADR edits and their own suites. A spec that
asserts an outcome by value — a path, a label, a piece of copy — breaks when that value changes, whichever
file produces it and whichever story wrote the spec.

**Fix shape.** The Architect finds re-aims by grepping `test/` and `tests/` for every literal the ADR removes or
renames (paths, labels, copy), not only for the files it edits. That is one line in
`engineering-team/roles/architect.md`, or in the ADR template's "Test-file changes" note.

**Pointer:** `engineering-team/stories/assistant-profile/4-my-assistant-page.test-plan.md`, the opening
"Re-aims" section (and the story 3 test plan's, `3-one-default-assistant-profile.test-plan.md:43-47`).
