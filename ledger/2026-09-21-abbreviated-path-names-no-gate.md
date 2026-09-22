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

**A second instance (2026-09-21, setup-status-and-alert #1).** That story's test plan pinned its
walkers from a fresh `grep -rl readdirSync test/`. It still left out `gate-result-record`, whose C9
reads every `test/*.test.js`. The triage treated `test/` as untouched ("the rest walk trees this
story does not touch"). But every story whose Test Design adds a suite touches `test/`:
`stack-free-npm-test` was pinned for exactly that reason, and `gate-result-record` was missed. This
time it did no harm: it passed on its own, 34/0/0 (the story's review). The same fix shape applies,
plus one line for the recipe: **the `test/` walkers belong to any story that adds a suite.**

**And the branch, not just the code (setup-status-and-alert #1, review round 2).** A walker triage
that looks only at the story's code misses what the rest of the branch changes. That branch also
carried round 1's review commit, which added and edited `ledger/` rows, and `session-start` AC-5 reads
the real `ledger/`. So "the rest walk trees this story does not touch" held for the code but not for
the branch. It did no harm: 32/0 on its own, and `harness-lint` was clean. The fix shape grows by one
clause: **triage the walkers against `git diff <merge-base>...HEAD`, not the story's files.**

**And after a merge, again (setup-status-and-alert #2, before its staging PR).** Story 2's pinned
list was triaged against its branch. Then the owner-required merge of `origin/staging` brought in
`one-writer-assistant-profile` (assistant-profile #5), whose W5 walks `ui/src`, where story 2's code
lives. No filename grep finds it. Run on its own, it passed 17/0/0. The fix shape grows by one more
clause: **re-run the walker grep after merging the base branch, not only at Test Design.**

**And after Phase 4, and through spawned scripts (setup-status-and-alert #3 review).**
- **Phase 4 can touch a tree the triage ruled out.** Story 3's plan said the branch touched neither `src/` nor
  `ledger/`. Then its Phase-4 test fixes (`9fa997af`) edited one ledger row and added another.
- **A grep for `readdirSync` misses suites that read a tree through a script they spawn.** `harness-lint.test.js`
  runs `scripts/harness-lint.sh` on the real repo, and that script's L15 reads every `ledger/*.md`.
- Both passed here.
- The fix shape gains two clauses:
  - **re-triage after any commit that touches a new tree;**
  - **count a suite that spawns a repo script as a reader of whatever that script reads.**

**Pointer:** `engineering-team/stories/done/setup-page-scaffold/1-setup-page-and-placeholders.md`
§ Deviations; `engineering-team/reviews/done/setup-page-scaffold/1-setup-page-and-placeholders.md`; `engineering-team/reviews/setup-status-and-alert/1-setup-shows-where-you-stand.md` § Harness friction 1 and § Round 2, Harness friction 2.
