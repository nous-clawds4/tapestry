# Phase 3's re-aim list misses pins that read a moved file's source, and other books' negative pins

**Id:** 2026-10-09-phase3-misses-moved-file-pins
**Type:** meta
**Opened:** 2026-10-09 (book `assistant-trusted-content-status`, Phase 4)
**Status:** OPEN
**Done:** —

ADR assistant-trusted-content-status/0001 § For the Tester named the class: "any suite that pins
`manageTreasureMap.js`'s *source* text". The Phase 3 plan still missed three pins, and Phase 4 had to re-aim them in their
own `test:` commits:
- `treasure-map-edit-mode` W4 and `treasure-map-card-details` S1 read `categoryAssistants`' JSDoc from the file the ADR
  moved the rule out of. The first plain run after the move found them.
- `treasure-map-needs-attention` S4 is another book's negative pin ("the Assistant alert's count doesn't learn about the
  Treasure Map"), which this story supersedes. Only the full gate found it, after the implementation.

Fix shape: one step in `workflows/3-test-design.md`. For every file the ADR moves, renames or makes newly
consulted, grep `test/` and `tests/` for its path inside `safeRead(` / `codeOnly(` and for negative-pin wording
("never", "reads nothing", "doesn't learn") that names the behaviour being changed. List each hit in the plan's re-aim
section as re-aimed or as deliberately kept.

**Pointer:** `engineering-team/stories/done/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.test-plan.md` § Re-aimed suites (the Phase 4 additions)
