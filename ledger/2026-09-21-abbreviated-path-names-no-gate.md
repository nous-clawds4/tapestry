# The abbreviated path names no Implementer test gate, and scoping one by filename grep misses the suites that walk `ui/src`

**Id:** 2026-09-21-abbreviated-path-names-no-gate
**Type:** meta
**Opened:** 2026-09-21 (setup-page-scaffold #1 review)
**Status:** OPEN
**Done:** —

Under the abbreviated path (Story + Implementer + Reviewer, chosen at intake for small work), the
Implementer's gate is still workflow 4's full `npm test`. On the Mac Studio that run takes about 53
minutes and is red by default on suites a UI-only diff cannot reach (OPEN.md row 191, and
`summaries-element-count`), so an Implementer is pushed to scope it, and nothing says how.

At setup-page-scaffold #1 the Implementer scoped it to the 36 registered suites that name the
touched files (`grep -rl -E "App\.jsx|styles\.css|pages/setup|TopBar" test/`), run through the
gate engine: `20260921T033512Z-57231-7977 [setup-scoped-ui] … on e923eec3 — PASS, 746 passed, 0
failed, 2 skipped, 36/36 suites`. The Reviewer found three more suites that walk `ui/src` and read
every `.js`/`.jsx` file in it, which no filename grep can find: `collapse-into-export-concept`,
`publish-export-a-concept`, `users-page-neo4j-endpoint`. The full run at review covered them, so
nothing escaped; the scoping method was still incomplete, and it would be again for the next
Implementer who reaches for it.

**Fix shape.** Give the abbreviated path the Light profile's Gate-A rule
(`engineering-team/workflows/light-profile.md`): the operator approves the story's scoped gate
command at intake. Write into that rule that suites which walk a tree belong to every diff under it
(`grep -rl readdirSync test/` finds the walkers). The standing answer is the story-scoped default
gate proposed in `_intake.md` "2026-08-18 — Make the test gate fast and honest", which would replace
per-story naming. Related: row 212 (the same path also defines no commit cadence).

**Pointer:** `engineering-team/stories/done/setup-page-scaffold/1-setup-page-and-placeholders.md`
§ Deviations; `engineering-team/reviews/done/setup-page-scaffold/1-setup-page-and-placeholders.md`.
