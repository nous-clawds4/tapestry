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

**Second occurrence (2026-10-14, book `assistant-scores`, Phase 4).** Building a hub placeholder page
(`/assistant/trusted-assertions`) broke three pins the Phase 3 plan never listed: the built-pages list in
`assistant-identification-tags-page` S3, the placeholder loop's skip list in `assistant-management-page.spec.js` B8, and
the placeholder's alert criteria in `assistant-trusted-content.spec.js` TC5. Every earlier page story had re-aimed the
same three. Only the full gate and a browser run found them, after the implementation; the owner approved a return to
Test Design. The fix shape above covers it if it also says: when a story builds an action page, grep `test/` and
`tests/` for the action's path and key and for the lists of built or placeholder pages. Pointer:
`engineering-team/stories/assistant-scores/1-the-scores-page.test-plan.md` § Re-aims.

**Pointer:** `engineering-team/stories/done/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.test-plan.md` § Re-aimed suites (the Phase 4 additions)
